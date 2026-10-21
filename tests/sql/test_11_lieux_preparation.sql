-- Tests de la migration 11 (après 03, 06, 07, 08, 09, 10 et 11).
\set ON_ERROR_STOP 1
\set QUIET 1

-- B : membre validé (cadrage) ; R : Responsable du pôle cadrage ;
-- S : Responsable du pôle photo ; Z : Admin ; P : inscription en attente.
insert into auth.users (id, email, raw_app_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('cccccccc-0000-0000-0000-000000000003', 'r@x', '{"role":"RESP_SECTION"}'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 's@x', '{"role":"RESP_SECTION"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'z@x', '{"role":"GRAND_RESPONSABLE","approuve":true}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'p@x', '{}');

create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom
    when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'R' then 'cccccccc-0000-0000-0000-000000000003'
    when 'S' then 'aaaaaaaa-0000-0000-0000-000000000007'
    when 'Z' then 'dddddddd-0000-0000-0000-000000000004'
    when 'P' then 'eeeeeeee-0000-0000-0000-000000000005' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', case when nom in ('R', 'S') then 'RESP_SECTION'
                                                   when nom = 'Z' then 'GRAND_RESPONSABLE'
                                                   else 'MEMBRE' end))::text, false);
$$;
create function public.tst_post(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_posts where id = pid;
$$;
create function public.tst_lieu(n text) returns public.kun_com_lieux language sql security definer as $$
  select * from public.kun_com_lieux where cle = lower(n);
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
-- Une instruction doit échouer (refus de droit ou donnée invalide).
create function public.tst_refuse(sql text, message text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok — %', message;
    return;
  end;
  raise exception 'ÉCHEC : % (instruction acceptée)', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;

set role authenticated;

select tst_en_tant_que('B');
insert into kun_com_profiles (id, content) values (tst_qui('B'), jsonb_build_object('id', tst_qui('B'), 'sections', '["cadrage"]'::jsonb));
select tst_en_tant_que('R');
insert into kun_com_profiles (id, content) values (tst_qui('R'), jsonb_build_object('id', tst_qui('R'), 'sections', '["cadrage"]'::jsonb));
select tst_en_tant_que('S');
insert into kun_com_profiles (id, content) values (tst_qui('S'), jsonb_build_object('id', tst_qui('S'), 'section_id', 'photo'));

-- ---------- Lieux enregistrés ----------
select tst_en_tant_que('R');
select kc_memoriser_lieu('  Église   VH ', 'Cocody, Abidjan', 5.35, -3.98, 12);
select tst_verifier((tst_lieu('église vh')).nom = 'Église VH' and (tst_lieu('église vh')).precision_m = 12,
  'un responsable enregistre un lieu relevé sur place (nom nettoyé)');

-- Même nom, autre casse : même lieu, une utilisation de plus.
select kc_memoriser_lieu('église vh', '', 5.40, -3.90, null);
select tst_verifier((tst_lieu('église vh')).utilisations = 2 and (tst_lieu('église vh')).lat = 5.35
  and (tst_lieu('église vh')).adresse = 'Cocody, Abidjan',
  'un résultat de recherche ne remplace pas un relevé GPS ni l''adresse connue');
select kc_memoriser_lieu('Église VH', '', 5.36, -3.97, 30);
select tst_verifier((tst_lieu('église vh')).lat = 5.36 and (tst_lieu('église vh')).precision_m = 30,
  'un relevé GPS à peine moins précis (moins de 50 m) met la position à jour');
select kc_memoriser_lieu('Église VH', '', 5.50, -3.50, 500);
select tst_verifier((tst_lieu('église vh')).lat = 5.36 and (tst_lieu('église vh')).utilisations = 4,
  'un relevé grossier n''écrase pas un relevé précis');
select kc_memoriser_lieu('Salle polyvalente', 'Plateau', 5.32, -4.02, null);
select kc_memoriser_lieu('Salle polyvalente', '', 5.33, -4.01, null);
select tst_verifier((tst_lieu('salle polyvalente')).lat = 5.33,
  'une recherche met à jour un lieu qui venait lui-même d''une recherche');

select tst_refuse($$select kc_memoriser_lieu('', 'x', 5, -4, null)$$, 'un lieu sans nom est refusé');
select tst_refuse($$select kc_memoriser_lieu('Nulle part', 'x', 95, -4, null)$$, 'une latitude impossible est refusée');
select tst_refuse($$insert into kun_com_lieux (nom, lat, lng) values ('Direct', 1, 1)$$, 'on n''écrit pas dans la table sans passer par la fonction');
select tst_refuse($$update kun_com_lieux set lat = 0$$, 'on ne modifie pas un lieu directement');

select tst_en_tant_que('B');
select tst_refuse($$select kc_memoriser_lieu('Chez moi', '', 5, -4, 5)$$, 'un membre n''enregistre pas de lieu');
select tst_verifier((select count(*) from kun_com_lieux) = 2, 'un membre validé voit les lieux enregistrés');
delete from kun_com_lieux;
select tst_verifier((select count(*) from kun_com_lieux) = 2, 'un membre ne supprime pas de lieu');

select tst_en_tant_que('P');
select tst_verifier((select count(*) from kun_com_lieux) = 0, 'une inscription en attente ne voit pas les lieux');

select tst_en_tant_que('R');
delete from kun_com_lieux where cle = 'salle polyvalente';
select tst_verifier((select count(*) from kun_com_lieux) = 2, 'un responsable ne supprime pas de lieu');
select tst_en_tant_que('Z');
delete from kun_com_lieux where cle = 'salle polyvalente';
select tst_verifier((select count(*) from kun_com_lieux) = 1, 'l''Admin supprime un lieu');

reset role;
select tst_verifier(not has_table_privilege('anon', 'public.kun_com_lieux', 'select'), 'aucun accès anonyme aux lieux');
set role anon;
select set_config('request.jwt.claims', '', false);
select tst_refuse($$select kc_memoriser_lieu('Anonyme', '', 5, -4, 5)$$, 'un visiteur anonyme n''enregistre pas de lieu');
reset role;
set role authenticated;

-- ---------- Plan de préparation ----------
select tst_en_tant_que('Z');
insert into kun_com_posts (id, content) values ('ev1', jsonb_build_object(
  'id', 'ev1', 'type', 'EVENT', 'userId', tst_qui('Z'), 'eventTitle', 'Culte', 'eventDate', '2026-11-01'));

-- R prépare son pôle (cadrage), et tente aussi celui de la photo.
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', tst_post('ev1') || jsonb_build_object(
  'eventTitle', 'Pirate',
  'preparation', jsonb_build_object(
    'cadrage', jsonb_build_object('v', 1, 'maj_par', 'quelqu''un', 'taches', jsonb_build_array(
      jsonb_build_object('id', 't1', 'titre', 'Caméras', 'etapes', jsonb_build_array(
        jsonb_build_object('id', 'e1', 'titre', 'Charger les batteries', 'date', '2026-10-30', 'fait', false))))),
    'photo', jsonb_build_object('v', 1, 'taches', '[]'::jsonb))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') #>> '{preparation,cadrage,taches,0,titre}' = 'Caméras'
  and tst_post('ev1') #>> '{preparation,cadrage,v}' = '1'
  and tst_post('ev1') #>> '{preparation,cadrage,maj_par}' = tst_qui('R'),
  'le responsable du pôle écrit son plan (auteur et version fixés par le serveur)');
select tst_verifier(not (tst_post('ev1') -> 'preparation' ? 'photo'), 'il n''écrit pas le plan d''un autre pôle');
select tst_verifier(tst_post('ev1') ->> 'eventTitle' = 'Culte', 'il ne touche pas au reste de l''événement');

-- Un membre du pôle ne peut pas écrire le plan.
select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('ev1', jsonb_set(tst_post('ev1'), '{preparation,cadrage}',
  jsonb_build_object('v', 9, 'taches', '[]'::jsonb)))
on conflict (id) do update set content = excluded.content;
select tst_verifier(jsonb_array_length(tst_post('ev1') #> '{preparation,cadrage,taches}') = 1, 'un simple membre ne modifie pas le plan');

-- S (photo, rattaché par section_id) prépare son pôle sans toucher au cadrage.
select tst_en_tant_que('S');
insert into kun_com_posts (id, content) values ('ev1', jsonb_set(tst_post('ev1') - 'preparation', '{preparation}', jsonb_build_object(
  'photo', jsonb_build_object('v', 1, 'taches', jsonb_build_array(jsonb_build_object('id', 't2', 'titre', 'Reportage', 'etapes', '[]'::jsonb))))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') #>> '{preparation,photo,taches,0,titre}' = 'Reportage'
  and tst_post('ev1') #>> '{preparation,cadrage,taches,0,titre}' = 'Caméras',
  'un autre responsable prépare son pôle, le plan du cadrage reste');

-- L'Admin (auteur) enregistre l'événement depuis une copie ancienne : les
-- plans des pôles ne sont pas effacés.
select tst_en_tant_que('Z');
update kun_com_posts set content = (content - 'preparation') || jsonb_build_object('eventTitle', 'Culte de fin d''année',
  'preparation', jsonb_build_object('cadrage', jsonb_build_object('v', 1, 'taches', '[]'::jsonb)))
  where id = 'ev1';
select tst_verifier(tst_post('ev1') ->> 'eventTitle' = 'Culte de fin d''année'
  and jsonb_array_length(tst_post('ev1') #> '{preparation,cadrage,taches}') = 1
  and tst_post('ev1') -> 'preparation' ? 'photo',
  'une copie ancienne de l''événement n''efface pas les plans');

-- Copie périmée du responsable (v égal à la base) : refusée ; v suivant : accepté.
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', jsonb_set(tst_post('ev1'), '{preparation,cadrage}',
  jsonb_build_object('v', 1, 'taches', '[]'::jsonb)))
on conflict (id) do update set content = excluded.content;
select tst_verifier(jsonb_array_length(tst_post('ev1') #> '{preparation,cadrage,taches}') = 1, 'une version périmée du plan est ignorée');
insert into kun_com_posts (id, content) values ('ev1', jsonb_set(tst_post('ev1'), '{preparation,cadrage}',
  jsonb_build_object('v', 2, 'taches', jsonb_build_array(
    jsonb_build_object('id', 't1', 'titre', 'Caméras', 'etapes', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'titre', 'Charger les batteries', 'date', '2026-10-30', 'fait', true)))))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') #>> '{preparation,cadrage,taches,0,etapes,0,fait}' = 'true'
  and tst_post('ev1') #>> '{preparation,cadrage,v}' = '2', 'la version suivante est enregistrée');

-- L'Admin écrit le plan de n'importe quel pôle.
select tst_en_tant_que('Z');
update kun_com_posts set content = jsonb_set(content, '{preparation,vente}', jsonb_build_object('v', 1, 'taches', '[]'::jsonb)) where id = 'ev1';
select tst_verifier(tst_post('ev1') #>> '{preparation,vente,maj_par}' = tst_qui('Z'), 'l''Admin écrit le plan de tout pôle');

-- Plan démesuré : ignoré.
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', jsonb_set(tst_post('ev1'), '{preparation,cadrage}',
  jsonb_build_object('v', 3, 'taches', (select jsonb_agg(jsonb_build_object('id', 't' || i, 'titre', 'x')) from generate_series(1, 61) i))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') #>> '{preparation,cadrage,v}' = '2', 'un plan de plus de 60 tâches est refusé');

-- Archivé : le plan est figé.
select tst_en_tant_que('Z');
update kun_com_posts set content = jsonb_set(content, '{type}', '"EVENT_ARCHIVED"') where id = 'ev1';
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', jsonb_set(tst_post('ev1'), '{preparation,cadrage}',
  jsonb_build_object('v', 3, 'taches', '[]'::jsonb)))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') #>> '{preparation,cadrage,v}' = '2', 'le plan d''un événement archivé est figé');

-- Une publication ordinaire ne reçoit pas de plan.
select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('p1', jsonb_build_object('id', 'p1', 'type', 'POST', 'userId', tst_qui('B'), 'caption', 'Salut'));
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('p1', tst_post('p1') || jsonb_build_object(
  'preparation', jsonb_build_object('cadrage', jsonb_build_object('v', 1, 'taches', '[]'::jsonb))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(not (tst_post('p1') ? 'preparation'), 'une publication ordinaire ne reçoit pas de plan');

\echo 'Tous les tests de la migration 11 sont passés.'
