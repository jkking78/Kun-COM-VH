-- Tests de la migration 14 (après 03, 06 à 14).
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_app_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('ffffffff-0000-0000-0000-000000000006', 'c@x', '{"role":"MEMBRE","approuve":true}'),
  ('dddddddd-0000-0000-0000-000000000004', 'z@x', '{"role":"GRAND_RESPONSABLE","approuve":true}');
create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002' when 'C' then 'ffffffff-0000-0000-0000-000000000006'
    when 'Z' then 'dddddddd-0000-0000-0000-000000000004' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', case nom when 'Z' then 'GRAND_RESPONSABLE' else 'MEMBRE' end))::text, false);
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;
set role authenticated;

select tst_en_tant_que('B');
insert into kun_com_profiles (id, content) values (tst_qui('B'), '{"sections":["cadrage"]}');
insert into kun_com_posts (id, content) values
  ('p_tous', jsonb_build_object('id', 'p_tous', 'userId', tst_qui('B'), 'caption', 'Pour tous')),
  ('p_cadrage', jsonb_build_object('id', 'p_cadrage', 'userId', tst_qui('B'), 'visibility', 'sections', 'targetSections', '["cadrage"]'::jsonb)),
  ('p_plus_tard', jsonb_build_object('id', 'p_plus_tard', 'userId', tst_qui('B'), 'status', 'scheduled', 'scheduled_at', 9e15)),
  ('p_passee', jsonb_build_object('id', 'p_passee', 'userId', tst_qui('B'), 'status', 'scheduled', 'scheduled_at', 1));
select tst_verifier((select count(*) from kun_com_posts) = 4, 'l''auteur voit toutes ses publications');

select tst_en_tant_que('C');
insert into kun_com_profiles (id, content) values (tst_qui('C'), '{"sections":["photo"]}');
select tst_verifier((select string_agg(id, ',' order by id) from kun_com_posts) = 'p_passee,p_tous',
  'un membre d''un autre pôle ne voit ni la publication ciblée ni celle programmée plus tard');

reset role;
select set_config('request.jwt.claims', '', false);   -- écriture du serveur (pôles figés pour le membre)
update kun_com_profiles set content = '{"sections":["photo","cadrage"]}' where id = tst_qui('C');
set role authenticated;
select tst_en_tant_que('C');
select tst_verifier((select count(*) from kun_com_posts where id = 'p_cadrage') = 1, 'un membre du pôle visé la voit');

select tst_en_tant_que('Z');
select tst_verifier((select count(*) from kun_com_posts) = 4, 'l''Admin voit tout');

\echo 'Tous les tests de la migration 14 sont passés.'
