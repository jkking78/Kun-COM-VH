-- Tests de la migration 16 (après 06 et 16).
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_app_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('ffffffff-0000-0000-0000-000000000006', 'c@x', '{"role":"MEMBRE","approuve":true}');
create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002' when 'C' then 'ffffffff-0000-0000-0000-000000000006' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'MEMBRE', 'approuve', true))::text, false);
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;
set role authenticated;

select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values
  ('p1', jsonb_build_object('id', 'p1', 'userId', tst_qui('B'), 'caption', 'Secret', 'timestamp', 5, 'comments', '[{"text":"x"}]'::jsonb)),
  ('p2', jsonb_build_object('id', 'p2', 'userId', tst_qui('B'), 'caption', 'Reste'));

-- Un autre membre ne peut ni supprimer ni vider la publication.
select tst_en_tant_que('C');
update kun_com_posts set content = content || '{"status":"deleted"}' where id = 'p2';
select tst_verifier((select content ->> 'caption' from kun_com_posts where id = 'p2') = 'Reste',
  'un membre qui n''est pas l''auteur ne vide pas la publication d''un autre');

-- L'auteur supprime : il ne reste que le marqueur.
select tst_en_tant_que('B');
update kun_com_posts set content = content || '{"status":"deleted"}' where id = 'p1';
select tst_verifier((select content from kun_com_posts where id = 'p1') - 'deletedAt'
    = jsonb_build_object('id', 'p1', 'userId', tst_qui('B'), 'timestamp', 5, 'status', 'deleted'),
  'la publication supprimée ne garde que id, auteur, date et statut');
select tst_verifier((select (content ->> 'deletedAt')::bigint > 0 from kun_com_posts where id = 'p1'),
  'la date de suppression est notée');

-- Un événement supprimé garde sa date (relue par les appareils) et sa série.
reset role;
select set_config('request.jwt.claims', '', false);   -- créé par le serveur (un membre n'en crée pas)
insert into kun_com_posts (id, content) values
  ('ev', jsonb_build_object('id', 'ev', 'userId', tst_qui('B'), 'type', 'EVENT', 'eventTitle', 'Culte',
    'eventDate', '2030-01-01', 'recurrenceGroupId', 'g1', 'assignments', '[]'::jsonb));
set role authenticated;
select tst_en_tant_que('B');
update kun_com_posts set content = content || '{"status":"deleted"}' where id = 'ev';
select tst_verifier((select not (content ? 'eventTitle') and not (content ? 'assignments')
    and content ->> 'eventDate' = '2030-01-01' and content ->> 'recurrenceGroupId' = 'g1' from kun_com_posts where id = 'ev'),
  'un événement supprimé ne garde que sa date et sa série');

-- Une publication non supprimée n'est pas touchée.
select tst_verifier((select content ->> 'caption' from kun_com_posts where id = 'p2') = 'Reste',
  'une publication active garde son contenu');

\echo 'Tous les tests de la migration 16 sont passés.'
