-- Tests de la migration 22 (après 03, 06 à 13, 21 et 22).
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_app_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x', '{"role":"MEMBRE","approuve":true}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@x', '{"role":"MEMBRE","approuve":false}');
create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom when 'A' then 'aaaaaaaa-0000-0000-0000-000000000001' when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'C' then 'cccccccc-0000-0000-0000-000000000003' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', 'MEMBRE'))::text, false);
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
create function public.tst_refuse(sql text, message text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'ok — %', message; return; end;
  raise exception 'ÉCHEC : % (instruction acceptée)', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;

-- Fiches existantes avec des notifications (avant la migration, donc copiées).
-- (le banc rejoue la migration : on insère ici côté serveur puis on la rejoue)
insert into kun_com_profiles (id, content) values
  (tst_qui('A'), jsonb_build_object('id', tst_qui('A'), 'prenom', 'Awa', 'nom', 'Test',
     'notifications', '[{"id":"ancienne","senderId":"x","text":"Vieille","timestamp":1000,"read":true}]'::jsonb)),
  (tst_qui('B'), jsonb_build_object('id', tst_qui('B'), 'prenom', 'Bob', 'nom', 'Kouassi')),
  (tst_qui('C'), jsonb_build_object('id', tst_qui('C'), 'prenom', 'Cleo'));
\i migration/22_notifications_table.sql
create function public.tst_toutes() returns setof public.kun_com_notifications language sql security definer as $$
  select * from public.kun_com_notifications;
$$;
grant execute on all functions in schema public to anon, authenticated;
select tst_verifier((select count(*) = 1 from tst_toutes() where destinataire = tst_qui('A') and id = 'ancienne'), 'les notifications existantes sont reprises dans la table');
select tst_verifier((select not (content ? 'notifications') from kun_com_profiles where id = tst_qui('A')), 'les fiches ne portent plus de notifications');

set role authenticated;
-- B notifie A : signée par la base.
select tst_en_tant_que('B');
insert into kun_com_notifications (destinataire, id, content) values (tst_qui('A'), 'n1',
  jsonb_build_object('senderId', tst_qui('A'), 'senderName', 'Pasteur X', 'type', 'PIRATE', 'text', 'Bonjour', 'read', true));
select tst_verifier((select content ->> 'senderId' = tst_qui('B') and content ->> 'senderName' = 'Bob K.' and content ->> 'type' = 'EVENT'
    and content ->> 'read' = 'false' from tst_toutes() where id = 'n1'),
  'expéditeur, nom, type et état imposés par la base');
select tst_verifier((select count(*) = 0 from kun_com_notifications), 'B ne lit pas les notifications de A');

-- A lit les siennes et ne peut changer que « lu ».
select tst_en_tant_que('A');
select tst_verifier((select count(*) = 2 from kun_com_notifications), 'A lit ses notifications');
update kun_com_notifications set content = '{"read":true,"text":"modifié","senderName":"Moi"}' where id = 'n1';
select tst_verifier((select content ->> 'read' = 'true' and content ->> 'text' = 'Bonjour' and content ->> 'senderName' = 'Bob K.'
    from kun_com_notifications where id = 'n1'), 'le destinataire ne change que l''état « lu »');

-- Un compte en attente ne notifie personne.
select tst_en_tant_que('C');
select tst_refuse($$insert into kun_com_notifications (destinataire, id, content) values (tst_qui('A'), 'n2', '{"text":"x"}')$$,
  'un compte en attente ne crée pas de notification');

-- Ancienne version : notification déposée dans la fiche de A → ligne de la table.
select tst_en_tant_que('B');
update kun_com_profiles set content = jsonb_set(content, '{notifications}', jsonb_build_array(jsonb_build_object(
  'id', 'n3', 'senderId', tst_qui('B'), 'senderName', 'Admin', 'type', 'LIKE', 'text', 'a aimé ta publication.')))
 where id = tst_qui('A');
select tst_verifier((select content ->> 'senderName' = 'Bob K.' from tst_toutes() where destinataire = tst_qui('A') and id = 'n3'),
  'une notification écrite par une ancienne version devient une ligne signée');
reset role;
select tst_verifier((select not (content ? 'notifications') from kun_com_profiles where id = tst_qui('A')), 'la fiche reste sans notifications');

-- 100 gardées par destinataire.
select set_config('request.jwt.claims', '', false);
insert into kun_com_notifications (destinataire, id, content, cree_le)
select tst_qui('B'), 'm' || g, '{}'::jsonb, now() - (g || ' minutes')::interval from generate_series(1, 120) g;
select tst_verifier((select count(*) = 100 from kun_com_notifications where destinataire = tst_qui('B')), '100 notifications gardées par destinataire');

\echo 'Tous les tests de la migration 22 sont passés.'
