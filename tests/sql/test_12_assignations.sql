-- Tests de la migration 12 (après 03, 06 à 12).
\set ON_ERROR_STOP 1
\set QUIET 1

-- R : Responsable du cadrage ; S : Responsable de la régie ; Z : Admin ;
-- B, C : membres du cadrage ; D : membre de la régie.
insert into auth.users (id, email, raw_app_meta_data) values
  ('cccccccc-0000-0000-0000-000000000003', 'r@x', '{"role":"RESP_SECTION"}'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 's@x', '{"role":"RESP_SECTION"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'z@x', '{"role":"GRAND_RESPONSABLE","approuve":true}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('ffffffff-0000-0000-0000-000000000006', 'c@x', '{"role":"MEMBRE","approuve":true}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'd@x', '{"role":"MEMBRE","approuve":true}');

create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom
    when 'R' then 'cccccccc-0000-0000-0000-000000000003' when 'S' then 'aaaaaaaa-0000-0000-0000-000000000007'
    when 'Z' then 'dddddddd-0000-0000-0000-000000000004' when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'C' then 'ffffffff-0000-0000-0000-000000000006' when 'D' then 'eeeeeeee-0000-0000-0000-000000000005' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', case when nom in ('R', 'S') then 'RESP_SECTION'
                                                   when nom = 'Z' then 'GRAND_RESPONSABLE' else 'MEMBRE' end))::text, false);
$$;
create function public.tst_post(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_posts where id = pid;
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
create function public.tst_qui_assigne(pid text) returns text language sql security definer as $$
  select string_agg(a ->> 'task', ',' order by a ->> 'task') from public.kun_com_posts, jsonb_array_elements(content -> 'assignments') a where id = pid;
$$;
grant execute on all functions in schema public to anon, authenticated;
set role authenticated;

select tst_en_tant_que('R');
insert into kun_com_profiles (id, content) values (tst_qui('R'), '{"sections":["cadrage"]}');
select tst_en_tant_que('S');
insert into kun_com_profiles (id, content) values (tst_qui('S'), '{"section_id":"regie"}');
select tst_en_tant_que('B');
insert into kun_com_profiles (id, content) values (tst_qui('B'), '{"sections":["cadrage"]}');
select tst_en_tant_que('C');
insert into kun_com_profiles (id, content) values (tst_qui('C'), '{"sections":["cadrage"]}');
select tst_en_tant_que('D');
insert into kun_com_profiles (id, content) values (tst_qui('D'), '{"sections":["regie"]}');

-- L'Admin crée le service : une ancienne assignation sans pôle (B), une de la régie (D).
select tst_en_tant_que('Z');
insert into kun_com_posts (id, content) values ('ev1', jsonb_build_object('id', 'ev1', 'type', 'EVENT', 'userId', tst_qui('Z'),
  'eventTitle', 'Culte', 'assignments', jsonb_build_array(
    jsonb_build_object('userId', tst_qui('B'), 'task', 'Caméra 1'),
    jsonb_build_object('userId', tst_qui('D'), 'task', 'Console', 'sectionId', 'regie'))));

-- Le Responsable de la régie ajoute un membre en partant d'une copie qui n'a pas le cadrage.
select tst_en_tant_que('S');
insert into kun_com_posts (id, content) values ('ev1', jsonb_set(tst_post('ev1'), '{assignments}', jsonb_build_array(
    jsonb_build_object('userId', tst_qui('D'), 'task', 'Console', 'sectionId', 'regie'),
    jsonb_build_object('userId', tst_qui('D'), 'task', 'Micros', 'sectionId', 'regie'))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_qui_assigne('ev1') = 'Caméra 1,Console,Micros', 'la régie ajoute les siennes sans effacer le cadrage (même sans sectionId)');

-- Le Responsable du cadrage remplace B par C et tente de retirer la régie et d'y ajouter quelqu'un.
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', jsonb_set(tst_post('ev1'), '{assignments}', jsonb_build_array(
    jsonb_build_object('userId', tst_qui('C'), 'task', 'Caméra 2', 'sectionId', 'cadrage'),
    jsonb_build_object('userId', tst_qui('B'), 'task', 'Intrus', 'sectionId', 'regie'))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_qui_assigne('ev1') = 'Caméra 2,Console,Micros', 'le cadrage gère les siennes, la régie reste intacte');

-- L'Admin (auteur) garde la main sur toute la liste.
select tst_en_tant_que('Z');
update kun_com_posts set content = jsonb_set(content, '{assignments}', '[]'::jsonb) where id = 'ev1';
select tst_verifier(tst_qui_assigne('ev1') is null, 'l''Admin peut vider la liste');

-- Battement de présence : seule l'heure de passage change.
select tst_en_tant_que('B');
update kun_com_profiles set content = content || '{"preferencesNotif":{"jaime":true}}' where id = tst_qui('B');
select kc_battement();
select tst_verifier((select content ->> 'last_seen_at' from kun_com_profiles where id = tst_qui('B')) like '20%Z'
  and (select content #>> '{preferencesNotif,jaime}' from kun_com_profiles where id = tst_qui('B')) = 'true',
  'le battement n''écrit que l''heure de passage');
select tst_verifier((select count(*) from kun_com_profiles where content ? 'last_seen_at') = 1, 'le battement ne touche que sa propre fiche');

\echo 'Tous les tests de la migration 12 sont passés.'
