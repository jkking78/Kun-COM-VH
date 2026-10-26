-- Tests de la migration 21 (après 03, 06 à 13 et 21).
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_app_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x', '{"role":"MEMBRE","approuve":true}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@x', '{"role":"MEMBRE","approuve":false}'),
  ('dddddddd-0000-0000-0000-000000000004', 'z@x', '{"role":"GRAND_RESPONSABLE","approuve":true}');
create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom when 'A' then 'aaaaaaaa-0000-0000-0000-000000000001' when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'C' then 'cccccccc-0000-0000-0000-000000000003' when 'Z' then 'dddddddd-0000-0000-0000-000000000004' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', case nom when 'Z' then 'GRAND_RESPONSABLE' else 'MEMBRE' end))::text, false);
$$;
create function public.tst_fiche(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_profiles where id = pid;
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;
set role authenticated;

-- 1. Pôles à la création.
select tst_en_tant_que('C');
insert into kun_com_profiles (id, content) values (tst_qui('C'),
  jsonb_build_object('id', tst_qui('C'), 'prenom', 'Cleo', 'sections', '["cadrage","regie","photo","prod"]'::jsonb));
select tst_verifier(tst_fiche(tst_qui('C')) -> 'sections' = '["cadrage","regie"]'::jsonb, 'une inscription garde 2 pôles au plus');

select tst_en_tant_que('A');
insert into kun_com_profiles (id, content) values (tst_qui('A'),
  jsonb_build_object('id', tst_qui('A'), 'prenom', 'Awa', 'nom', 'Test', 'sections', '["cadrage","regie","photo"]'::jsonb));
select tst_verifier(tst_fiche(tst_qui('A')) -> 'sections' = '[]'::jsonb, 'un compte validé ne se donne aucun pôle en créant sa fiche');

select tst_en_tant_que('Z');
insert into kun_com_profiles (id, content) values (tst_qui('Z'),
  jsonb_build_object('id', tst_qui('Z'), 'prenom', 'Zoé', 'sections', '["regie"]'::jsonb));
select tst_verifier(tst_fiche(tst_qui('Z')) -> 'sections' = '["regie"]'::jsonb, 'l''Admin garde ses pôles');

-- 2. Notification déposée chez A par B : nom, type et photo imposés.
select tst_en_tant_que('B');
insert into kun_com_profiles (id, content) values (tst_qui('B'), jsonb_build_object('id', tst_qui('B'), 'prenom', 'Bob', 'nom', 'Kouassi'));
update kun_com_profiles set content = jsonb_set(content, '{notifications}', jsonb_build_array(jsonb_build_object(
  'id', 'n1', 'senderId', tst_qui('B'), 'senderName', 'Pasteur X', 'type', 'PIRATE',
  'senderAvatar', 'data:image/svg+xml;base64,AAAA', 'text', 'CONVOCATION URGENTE')))
 where id = tst_qui('A');
select tst_verifier((select n ->> 'senderName' = 'Bob K.' and n ->> 'type' = 'EVENT' and n -> 'senderAvatar' = 'null'::jsonb
    from jsonb_array_elements(tst_fiche(tst_qui('A')) -> 'notifications') n where n ->> 'id' = 'n1'),
  'le nom affiché vient de la fiche de l''expéditeur ; type inconnu et photo base64 écartés');
update kun_com_profiles set content = jsonb_set(content, '{notifications}', jsonb_build_array(jsonb_build_object(
  'id', 'n2', 'senderId', tst_qui('Z'), 'senderName', 'Admin', 'type', 'LIKE', 'text', 'faux')))
 where id = tst_qui('A');
select tst_verifier(not exists (select 1 from jsonb_array_elements(tst_fiche(tst_qui('A')) -> 'notifications') n where n ->> 'id' = 'n2'),
  'une notification signée par un autre reste refusée');

\echo 'Tous les tests de la migration 21 sont passés.'
