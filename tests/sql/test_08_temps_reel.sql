-- Tests de la migration 08 (après 06, 07 et 08).
\set ON_ERROR_STOP 1
\set QUIET 1

-- B et C : membres validés du pôle « cadrage » / « photo » ; R : Responsable ;
-- Z : Admin ; P : inscription en attente (pôle cadrage).
insert into auth.users (id, email, raw_app_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('ffffffff-0000-0000-0000-000000000006', 'c@x', '{"role":"MEMBRE","approuve":true}'),
  ('cccccccc-0000-0000-0000-000000000003', 'r@x', '{"role":"RESP_SECTION"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'z@x', '{"role":"GRAND_RESPONSABLE","approuve":true}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'p@x', '{}');

create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom
    when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'C' then 'ffffffff-0000-0000-0000-000000000006'
    when 'R' then 'cccccccc-0000-0000-0000-000000000003'
    when 'Z' then 'dddddddd-0000-0000-0000-000000000004'
    when 'P' then 'eeeeeeee-0000-0000-0000-000000000005' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', case nom when 'R' then 'RESP_SECTION'
                                                       when 'Z' then 'GRAND_RESPONSABLE'
                                                       else 'MEMBRE' end))::text, false);
$$;
create function public.tst_post(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_posts where id = pid;
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;

set role authenticated;

-- Fiches (chacun crée la sienne).
select tst_en_tant_que('B');
insert into kun_com_profiles (id, content) values (tst_qui('B'), jsonb_build_object('id', tst_qui('B'), 'sections', '["cadrage"]'::jsonb));
select tst_en_tant_que('C');
insert into kun_com_profiles (id, content) values (tst_qui('C'), jsonb_build_object('id', tst_qui('C'), 'sections', '["photo"]'::jsonb));
select tst_en_tant_que('P');
insert into kun_com_profiles (id, content) values (tst_qui('P'), jsonb_build_object('id', tst_qui('P'), 'sections', '["cadrage"]'::jsonb));
select tst_en_tant_que('R');
insert into kun_com_profiles (id, content) values (tst_qui('R'), jsonb_build_object('id', tst_qui('R'), 'sections', '["cadrage"]'::jsonb));

-- ---------- Échange de service ----------
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', jsonb_build_object(
  'id','ev1','type','EVENT','userId', tst_qui('R'), 'eventTitle','Culte',
  'assignments', jsonb_build_array(jsonb_build_object('userId', tst_qui('B'), 'task', 'Caméra'))));

select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('ev1', tst_post('ev1') || jsonb_build_object(
  'echanges', jsonb_build_object(tst_qui('B'), jsonb_build_object('tache', 'Caméra'), tst_qui('C'), jsonb_build_object('tache', 'faux'))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') #>> array['echanges', tst_qui('B'), 'tache'] = 'Caméra', 'un membre propose sa place');
select tst_verifier(not (tst_post('ev1') -> 'echanges' ? tst_qui('C')), 'un membre ne propose pas la place d''un autre');

select tst_en_tant_que('C');
insert into kun_com_posts (id, content) values ('ev1', (tst_post('ev1') - 'echanges') || jsonb_build_object(
  'reprises', jsonb_build_object(tst_qui('C'), jsonb_build_object('pour', tst_qui('B')))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') #>> array['reprises', tst_qui('C'), 'pour'] = tst_qui('B')
  and tst_post('ev1') -> 'echanges' ? tst_qui('B'), 'un autre membre reprend la place, la proposition reste');

-- Le Responsable valide : il remplace l'assignation (droit existant).
select tst_en_tant_que('R');
update kun_com_posts set content = jsonb_set(content, '{assignments}',
  jsonb_build_array(jsonb_build_object('userId', tst_qui('C'), 'task', 'Caméra'))) where id = 'ev1';
select tst_verifier(tst_post('ev1') #>> '{assignments,0,userId}' = tst_qui('C')
  and tst_post('ev1') -> 'reprises' ? tst_qui('C'), 'le responsable valide l''échange sans effacer les réponses');

-- ---------- Canaux de pôle ----------
select tst_en_tant_que('B');
insert into kun_com_dms (id, from_id, to_id, content) values ('m1', tst_qui('B'), 'pole:cadrage', '{"text":"Batteries ?"}');
select tst_verifier((select count(*) from kun_com_dms where to_id = 'pole:cadrage') = 1, 'un membre écrit et lit dans le canal de son pôle');
do $$ begin
  insert into kun_com_dms (id, from_id, to_id, content) values ('m2', tst_qui('B'), 'pole:photo', '{}');
  raise exception 'ÉCHEC : message dans le canal d''un autre pôle accepté';
exception when insufficient_privilege then raise notice 'ok — pas de message dans le canal d''un autre pôle';
end $$;

select tst_en_tant_que('C');
select tst_verifier((select count(*) from kun_com_dms where to_id = 'pole:cadrage') = 0, 'un membre d''un autre pôle ne lit pas le canal');
select tst_en_tant_que('Z');
select tst_verifier((select count(*) from kun_com_dms where to_id = 'pole:cadrage') = 1, 'l''Admin lit tous les canaux');
select tst_en_tant_que('P');
select tst_verifier((select count(*) from kun_com_dms) = 0, 'un compte en attente ne lit pas le canal de son pôle');

-- Les messages privés restent privés.
select tst_en_tant_que('B');
insert into kun_com_dms (id, from_id, to_id, content) values ('m3', tst_qui('B'), tst_qui('C'), '{"text":"salut"}');
select tst_en_tant_que('Z');
select tst_verifier((select count(*) from kun_com_dms where id = 'm3') = 0, 'un message privé reste invisible aux autres, Admin compris');

-- ---------- Abonnements aux notifications ----------
select tst_en_tant_que('B');
insert into kun_com_push_abonnements (id, user_id, abonnement) values ('https://push/1', tst_qui('B'), '{}');
select tst_verifier((select count(*) from kun_com_push_abonnements) = 1, 'un membre enregistre son téléphone');
do $$ begin
  insert into kun_com_push_abonnements (id, user_id, abonnement) values ('https://push/2', tst_qui('C'), '{}');
  raise exception 'ÉCHEC : abonnement au nom d''un autre accepté';
exception when insufficient_privilege then raise notice 'ok — pas d''abonnement au nom d''un autre';
end $$;
select tst_en_tant_que('C');
select tst_verifier((select count(*) from kun_com_push_abonnements) = 0, 'on ne voit pas les abonnements des autres');
select tst_en_tant_que('P');
do $$ begin
  insert into kun_com_push_abonnements (id, user_id, abonnement) values ('https://push/3', tst_qui('P'), '{}');
  raise exception 'ÉCHEC : abonnement d''un compte en attente accepté';
exception when insufficient_privilege then raise notice 'ok — un compte en attente ne s''abonne pas';
end $$;
do $$ begin
  perform 1 from kun_com_push_cles;
  raise exception 'ÉCHEC : clés VAPID lisibles';
exception when insufficient_privilege then raise notice 'ok — les clés VAPID sont inaccessibles aux membres';
end $$;

\echo 'Tous les tests de la migration 08 sont passés.'
