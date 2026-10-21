-- Tests de la migration 10 (après 03, 06, 07, 08, 09 et 10).
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

-- Données posées SANS utilisateur (comme le SQL Editor) : une fiche portant
-- d'anciens extraits de messages privés, puis la migration rejouée.
insert into kun_com_profiles (id, content) values (tst_qui('C'), jsonb_build_object('id', tst_qui('C'), 'sections', '["photo"]'::jsonb,
  'notifications', jsonb_build_array(
    jsonb_build_object('id', 'n1', 'type', 'MESSAGE', 'senderId', tst_qui('B'), 'text', 'Awa : "je suis malade"', 'timestamp', 1),
    jsonb_build_object('id', 'n2', 'type', 'CANAL', 'senderId', tst_qui('B'), 'text', 'Awa : "secret"', 'timestamp', 2),
    jsonb_build_object('id', 'n3', 'type', 'LIKE', 'senderId', tst_qui('B'), 'text', 'a aimé ta publication.', 'timestamp', 3))));
\i migration/10_securite.sql
select tst_verifier((select count(*) from kun_com_profiles, jsonb_array_elements(content -> 'notifications') n
  where n ->> 'text' like '%malade%' or n ->> 'text' like '%secret%') = 0, 'les anciens extraits de messages privés sont effacés des fiches');
select tst_verifier((select n ->> 'text' from kun_com_profiles, jsonb_array_elements(content -> 'notifications') n where n ->> 'id' = 'n3') = 'a aimé ta publication.',
  'les autres notifications sont gardées telles quelles');

set role authenticated;

-- ---------- Notifications déposées chez un autre ----------
select tst_en_tant_que('B');
insert into kun_com_profiles (id, content) values (tst_qui('B'), jsonb_build_object('id', tst_qui('B'), 'sections', '["cadrage"]'::jsonb));
update kun_com_profiles set content = jsonb_set(content, '{notifications}', (content -> 'notifications') || (
  select jsonb_agg(jsonb_build_object('id', 'x' || i, 'type', 'CONVOCATION', 'senderId', tst_qui('B'),
    'title', repeat('T', 200), 'text', repeat('a', 1000), 'timestamp', 9e15, 'read', true))
  from generate_series(1, 7) i)) where id = tst_qui('C');
reset role;
select tst_verifier((select count(*) from kun_com_profiles, jsonb_array_elements(content -> 'notifications') n
  where id = tst_qui('C') and n ->> 'id' like 'x%') = 5, 'au plus 5 notifications ajoutées par écriture');
select tst_verifier((select bool_and((n ->> 'timestamp')::numeric < 1e14 and (n ->> 'read')::boolean = false
    and length(n ->> 'text') = 300 and length(n ->> 'title') = 80)
  from kun_com_profiles, jsonb_array_elements(content -> 'notifications') n where id = tst_qui('C') and n ->> 'id' like 'x%'),
  'heure du serveur, « non lue », titre et texte bornés');
set role authenticated;

-- ---------- Messages : expéditeur des colonnes ----------
select tst_en_tant_que('B');
insert into kun_com_dms (id, from_id, to_id, content) values ('m1', tst_qui('B'), tst_qui('C'),
  jsonb_build_object('id', 'autre', 'fromId', tst_qui('Z'), 'toId', tst_qui('B'), 'text', 'Je suis l''Admin'));
select tst_verifier((select content ->> 'fromId' = tst_qui('B') and content ->> 'toId' = tst_qui('C') and content ->> 'id' = 'm1'
  from kun_com_dms where id = 'm1'), 'un message ne peut pas se faire passer pour celui d''un autre');

-- ---------- Format des heures et dates d'événement ----------
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', jsonb_build_object('id', 'ev1', 'type', 'EVENT', 'userId', tst_qui('R'),
  'eventDate', '2026-10-25', 'eventStart', '09:00', 'eventEnd', ''));
select tst_verifier((select count(*) from kun_com_posts where id = 'ev1') = 1, 'un événement aux bons formats est accepté');
do $$ begin
  insert into kun_com_posts (id, content) values ('ev2', jsonb_build_object('id', 'ev2', 'type', 'EVENT', 'userId', tst_qui('R'),
    'eventStart', '<img src=x onerror=alert(1)>'));
  raise exception 'ÉCHEC : heure piégée acceptée';
exception when check_violation then raise notice 'ok — une heure piégée est refusée';
end $$;
do $$ begin
  update kun_com_posts set content = jsonb_set(content, '{eventDate}', '"25/10/2026<b>"') where id = 'ev1';
  raise exception 'ÉCHEC : date piégée acceptée';
exception when check_violation then raise notice 'ok — une date piégée est refusée';
end $$;

-- ---------- Récupération de mot de passe ----------
do $$ begin
  perform public.kc_reserver_essai(public.tst_qui('B')::uuid);
  raise exception 'ÉCHEC : un membre peut appeler kc_reserver_essai';
exception when insufficient_privilege then raise notice 'ok — les essais de récupération sont réservés au serveur';
end $$;
do $$ begin
  perform public.kc_limite('x', 1, interval '1 minute');
  raise exception 'ÉCHEC : un membre peut appeler kc_limite';
exception when insufficient_privilege then raise notice 'ok — la limite de débit est réservée au serveur';
end $$;
reset role;

insert into kun_com_secrets (user_id, email, q1, q2, a1_hash, a2_hash, salt)
values (tst_qui('B')::uuid, '0700000000', 'q1', 'q2', 'h1', 'h2', 's');
select tst_verifier((select bool_and(public.kc_reserver_essai(tst_qui('B')::uuid)) from generate_series(1, 5)), '5 essais sont acceptés');
select tst_verifier(not public.kc_reserver_essai(tst_qui('B')::uuid), 'le 6e essai est refusé : compte verrouillé');
select tst_verifier((select locked_until between now() + interval '14 minutes' and now() + interval '16 minutes' and verrous = 1 and fail_count = 0
  from kun_com_secrets where user_id = tst_qui('B')::uuid), 'premier verrou : 15 minutes');
update kun_com_secrets set locked_until = now() - interval '1 second' where user_id = tst_qui('B')::uuid;
select tst_verifier((select bool_and(public.kc_reserver_essai(tst_qui('B')::uuid)) from generate_series(1, 5)), 'après le verrou, 5 nouveaux essais');
select tst_verifier((select locked_until between now() + interval '29 minutes' and now() + interval '31 minutes' and verrous = 2
  from kun_com_secrets where user_id = tst_qui('B')::uuid), 'deuxième verrou : 30 minutes');

select tst_verifier((select array_agg(public.kc_limite('ip:1', 3, interval '1 hour') order by i) from generate_series(1, 4) i)
  = array[true, true, true, false], 'la limite de débit coupe au-delà du maximum');
select tst_verifier(public.kc_limite('ip:2', 3, interval '1 hour'), 'chaque clé a son propre compteur');

\echo 'Tous les tests de la migration 10 sont passés.'
