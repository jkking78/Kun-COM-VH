-- Tests de la migration 06, exécutés après supabase_mock.sql et la migration.
-- Chaque écriture imite PostgREST : upsert « insert ... on conflict do update »
-- sous le rôle authenticated, avec le JWT de l'acteur dans request.jwt.claims.
\set ON_ERROR_STOP 1
\set QUIET 1

-- Membres : A et B (MEMBRE), R (Responsable de pôle), Z (Admin).
insert into auth.users (id, email, raw_app_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x', '{"role":"MEMBRE"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'r@x', '{"role":"RESP_SECTION"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'z@x', '{"role":"GRAND_RESPONSABLE"}');

create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom
    when 'A' then 'aaaaaaaa-0000-0000-0000-000000000001'
    when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002'
    when 'R' then 'cccccccc-0000-0000-0000-000000000003'
    when 'Z' then 'dddddddd-0000-0000-0000-000000000004' end;
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
create function public.tst_profil(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_profiles where id = pid;
$$;
create function public.tst_verifier(cond boolean, message text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC : %', message; end if;
  raise notice 'ok — %', message;
end $$;
grant execute on all functions in schema public to anon, authenticated;

set role authenticated;

-- ---------- Publications ----------
select tst_en_tant_que('A');
insert into kun_com_posts (id, content) values ('p1', jsonb_build_object(
  'id', 'p1', 'userId', tst_qui('A'), 'caption', 'Bonjour', 'likedBy', '[]'::jsonb,
  'comments', '[]'::jsonb, 'poll', '{"options":["oui","non"],"votes":{}}'::jsonb));

-- B tente de tout réécrire en même temps qu'il aime la publication.
select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('p1', jsonb_build_object(
  'id', 'p1', 'userId', tst_qui('B'), 'caption', 'piraté', 'likedBy', jsonb_build_array(tst_qui('B'), 'fantome'),
  'comments', jsonb_build_array(jsonb_build_object('id', 'cx', 'userId', tst_qui('A'), 'text', 'faux')),
  'poll', jsonb_build_object('options', '["x"]'::jsonb, 'votes', jsonb_build_object(tst_qui('B'), 1, tst_qui('A'), 0))))
on conflict (id) do update set content = excluded.content;

select tst_verifier(tst_post('p1') ->> 'caption' = 'Bonjour', 'un non-auteur ne change pas la légende');
select tst_verifier(tst_post('p1') ->> 'userId' = tst_qui('A'), 'un non-auteur ne change pas le propriétaire');
select tst_verifier(tst_post('p1') -> 'likedBy' = jsonb_build_array(tst_qui('B')), 'seul le J''aime de B est retenu');
select tst_verifier(jsonb_array_length(tst_post('p1') -> 'comments') = 0, 'un commentaire signé d''un autre est refusé');
select tst_verifier(tst_post('p1') #> '{poll,votes}' = jsonb_build_object(tst_qui('B'), 1), 'seul le vote de B est retenu');
select tst_verifier(tst_post('p1') #> '{poll,options}' = '["oui","non"]'::jsonb, 'les options du sondage restent celles de l''auteur');

-- B commente.
insert into kun_com_posts (id, content) values ('p1', tst_post('p1') || jsonb_build_object(
  'comments', jsonb_build_array(jsonb_build_object('id', 'c1', 'userId', tst_qui('B'), 'text', 'super'))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('p1') #>> '{comments,0,id}' = 'c1', 'B ajoute son commentaire');

-- A (auteur) écrit depuis une copie PÉRIMÉE : sans le J'aime, le vote ni le
-- commentaire de B. Sa modification passe, rien de B ne se perd.
select tst_en_tant_que('A');
insert into kun_com_posts (id, content) values ('p1', jsonb_build_object(
  'id', 'p1', 'userId', tst_qui('A'), 'caption', 'Bonjour à tous', 'likedBy', '[]'::jsonb,
  'comments', '[]'::jsonb, 'poll', '{"options":["oui","non"],"votes":{}}'::jsonb, 'is_pinned', true))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('p1') ->> 'caption' = 'Bonjour à tous', 'l''auteur modifie sa légende');
select tst_verifier(tst_post('p1') -> 'is_pinned' = 'true'::jsonb, 'l''auteur épingle');
select tst_verifier(tst_post('p1') -> 'likedBy' = jsonb_build_array(tst_qui('B')), 'la copie périmée de l''auteur n''efface pas le J''aime de B');
select tst_verifier(jsonb_array_length(tst_post('p1') -> 'comments') = 1, 'la copie périmée de l''auteur n''efface pas le commentaire de B');
select tst_verifier(tst_post('p1') #> '{poll,votes}' = jsonb_build_object(tst_qui('B'), 1), 'la copie périmée de l''auteur n''efface pas le vote de B');

-- B répond à son propre commentaire, puis A modère le commentaire racine.
select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('p1', jsonb_set(tst_post('p1'), '{comments}',
  (tst_post('p1') -> 'comments') || jsonb_build_array(jsonb_build_object('id', 'c2', 'userId', tst_qui('B'), 'parentId', 'c1', 'text', 'réponse'))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(jsonb_array_length(tst_post('p1') -> 'comments') = 2, 'B ajoute une réponse');

-- Suppression implicite (absence) par B : ignorée.
insert into kun_com_posts (id, content) values ('p1', jsonb_set(tst_post('p1'), '{comments}', '[]'::jsonb))
on conflict (id) do update set content = excluded.content;
select tst_verifier(jsonb_array_length(tst_post('p1') -> 'comments') = 2, 'l''absence d''un commentaire ne le supprime pas');

select tst_en_tant_que('A');
insert into kun_com_posts (id, content) values ('p1', tst_post('p1') || '{"_supprimerCommentaires":["c1"]}'::jsonb)
on conflict (id) do update set content = excluded.content;
select tst_verifier(jsonb_array_length(tst_post('p1') -> 'comments') = 0, 'l''auteur supprime un commentaire et ses réponses');
select tst_verifier(not (tst_post('p1') ? '_supprimerCommentaires'), 'le marqueur de suppression n''est pas enregistré');

-- B ne peut pas supprimer le commentaire d'un autre.
select tst_en_tant_que('A');
insert into kun_com_posts (id, content) values ('p1', jsonb_set(tst_post('p1'), '{comments}',
  jsonb_build_array(jsonb_build_object('id', 'c3', 'userId', tst_qui('A'), 'text', 'de A'))))
on conflict (id) do update set content = excluded.content;
select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('p1', tst_post('p1') || '{"_supprimerCommentaires":["c3"]}'::jsonb)
on conflict (id) do update set content = excluded.content;
select tst_verifier(jsonb_array_length(tst_post('p1') -> 'comments') = 1, 'un membre ne supprime pas le commentaire d''un autre');

-- L'Admin modère.
select tst_en_tant_que('Z');
insert into kun_com_posts (id, content) values ('p1', tst_post('p1') || '{"_supprimerCommentaires":["c3"]}'::jsonb)
on conflict (id) do update set content = excluded.content;
select tst_verifier(jsonb_array_length(tst_post('p1') -> 'comments') = 0, 'l''Admin supprime un commentaire');

-- ---------- Nettoyage des traces d'un compte supprimé (Admin) ----------
reset role;
select set_config('request.jwt.claims', '', false);   -- écriture « serveur » pour préparer l'état
update kun_com_posts set content = content || jsonb_build_object(
  'likedBy', jsonb_build_array(tst_qui('B'), 'fantome-0000'),
  'comments', jsonb_build_array(
    jsonb_build_object('id', 'cf', 'userId', 'fantome-0000', 'text', 'parti'),
    jsonb_build_object('id', 'cfr', 'userId', tst_qui('B'), 'parentId', 'cf', 'text', 'réponse'),
    jsonb_build_object('id', 'cb', 'userId', tst_qui('B'), 'text', 'reste')),
  'poll', jsonb_build_object('options', '["oui","non"]'::jsonb, 'votes', jsonb_build_object(tst_qui('B'), 1, 'fantome-0000', 0)))
where id = 'p1';
set role authenticated;
select tst_en_tant_que('Z');
-- Copie de l'Admin : traces du fantôme retirées, MAIS aussi (copie périmée)
-- sans le J'aime, le vote ni le commentaire de B.
insert into kun_com_posts (id, content) values ('p1', tst_post('p1') || jsonb_build_object(
  'likedBy', '[]'::jsonb, 'comments', '[]'::jsonb,
  'poll', jsonb_build_object('options', '["oui","non"]'::jsonb, 'votes', '{}'::jsonb)))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('p1') -> 'likedBy' = jsonb_build_array(tst_qui('B')), 'l''Admin retire le J''aime d''un compte supprimé, pas celui de B');
select tst_verifier((select array_agg(c ->> 'id' order by c ->> 'id') from jsonb_array_elements(tst_post('p1') -> 'comments') c) = array['cb'],
  'l''Admin retire le commentaire d''un compte supprimé et ses réponses, pas celui de B');
select tst_verifier(tst_post('p1') #> '{poll,votes}' = jsonb_build_object(tst_qui('B'), 1), 'l''Admin retire le vote d''un compte supprimé, pas celui de B');
reset role;
select set_config('request.jwt.claims', '', false);
update kun_com_posts set content = content || '{"comments": [], "likedBy": [], "poll": {"options":["oui","non"],"votes":{}}}'::jsonb where id = 'p1';
set role authenticated;

-- ---------- Pointages et tâches ----------
select tst_en_tant_que('A');
insert into kun_com_posts (id, content) values ('ci1', jsonb_build_object(
  'id', 'ci1', 'userId', tst_qui('A'), 'checkInEventId', 'ev1', 'checkInAt', 1000));
select tst_verifier((tst_post('ci1') ->> 'checkInAt')::bigint > kc_maintenant_ms() - 60000, 'un pointage antidaté est ramené à l''heure du serveur');
select tst_verifier((tst_post('ci1') ->> 'checkInGraceUntil')::bigint = (tst_post('ci1') ->> 'checkInAt')::bigint + 60000, 'la fenêtre de grâce suit l''heure retenue');

insert into kun_com_posts (id, content) values ('ci1', tst_post('ci1') || '{"checkInAt": 5}'::jsonb || '{"geo":{"available":true}}'::jsonb)
on conflict (id) do update set content = excluded.content;
select tst_verifier((tst_post('ci1') ->> 'checkInAt')::bigint > 5, 'l''heure d''arrivée ne se modifie plus');
select tst_verifier(tst_post('ci1') #> '{geo,available}' = 'true'::jsonb, 'la position peut être ajoutée après coup');

insert into kun_com_posts (id, content) values ('ci2', jsonb_build_object(
  'id', 'ci2', 'userId', tst_qui('A'), 'checkInEventId', 'ev1', 'checkInAt', kc_maintenant_ms() - 30000));
select tst_verifier((tst_post('ci2') ->> 'checkInAt')::bigint < kc_maintenant_ms() - 20000, 'un horodatage plausible est conservé (rattrapage hors-ligne)');

insert into kun_com_posts (id, content) values ('td1', jsonb_build_object(
  'id', 'td1', 'type', 'TASK_DONE', 'userId', tst_qui('A'), 'taskDoneAt', 42, 'timestamp', 42));
select tst_verifier((tst_post('td1') ->> 'taskDoneAt')::bigint > kc_maintenant_ms() - 60000, 'une livraison de tâche antidatée est ramenée à l''heure du serveur');

-- ---------- Types réservés ----------
select tst_en_tant_que('A');
do $$ begin
  insert into kun_com_posts (id, content) values ('ev_a', jsonb_build_object('id','ev_a','type','EVENT','userId', tst_qui('A')));
  raise exception 'ÉCHEC : un membre a créé un événement';
exception when insufficient_privilege then raise notice 'ok — un membre ne crée pas d''événement';
end $$;
do $$ begin
  insert into kun_com_posts (id, content) values ('bil', jsonb_build_object('id','bil','type','EVALUATION','userId', tst_qui('A')));
  raise exception 'ÉCHEC : un membre a publié un bilan';
exception when insufficient_privilege then raise notice 'ok — un membre ne publie pas de bilan';
end $$;
do $$ begin
  insert into kun_com_posts (id, content) values ('x'');alert(1)//', jsonb_build_object('userId', tst_qui('A')));
  raise exception 'ÉCHEC : identifiant dangereux accepté';
exception when insufficient_privilege then raise notice 'ok — identifiant de publication au format imposé';
end $$;
-- Un membre ne transforme pas sa publication en bilan.
insert into kun_com_posts (id, content) values ('p1a', jsonb_build_object('id','p1a','userId', tst_qui('A')));
insert into kun_com_posts (id, content) values ('p1a', jsonb_build_object('id','p1a','userId', tst_qui('A'), 'type', 'EVALUATION'))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('p1a') -> 'type' is null or tst_post('p1a') -> 'type' = 'null'::jsonb, 'un membre ne change pas la nature de sa publication');

-- Le Responsable crée un événement ; un autre Responsable/membre n'en change que ce qui lui revient.
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', jsonb_build_object(
  'id','ev1','type','EVENT','userId', tst_qui('R'), 'eventTitle', 'Culte', 'assignments', '[]'::jsonb));
select tst_en_tant_que('Z');
insert into kun_com_posts (id, content) values ('ev1', tst_post('ev1') || '{"eventTitle":"Culte du dimanche"}'::jsonb)
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') ->> 'eventTitle' = 'Culte du dimanche', 'l''Admin modifie un événement');
select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('ev1', tst_post('ev1') || jsonb_build_object(
  'assignments', jsonb_build_array(jsonb_build_object('userId', tst_qui('B'))),
  'metadata', jsonb_build_object('participations', jsonb_build_object(tst_qui('B'), 'yes', tst_qui('A'), 'no'))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(jsonb_array_length(tst_post('ev1') -> 'assignments') = 0, 'un membre ne s''assigne pas lui-même');
select tst_verifier(tst_post('ev1') #> '{metadata,participations}' = jsonb_build_object(tst_qui('B'), 'yes'), 'seule la participation de B est retenue');

-- Archivage par l'auteur : permis.
select tst_en_tant_que('R');
insert into kun_com_posts (id, content) values ('ev1', tst_post('ev1') || '{"type":"EVENT_ARCHIVED"}'::jsonb)
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_post('ev1') ->> 'type' = 'EVENT_ARCHIVED', 'l''auteur archive son événement');

-- ---------- Profils ----------
select tst_en_tant_que('A');
insert into kun_com_profiles (id, content) values (tst_qui('A'), jsonb_build_object(
  'id', tst_qui('A'), 'prenom', 'Awa', 'role', 'GRAND_RESPONSABLE', 'pwd', 'hash', 'notifications', '[]'::jsonb));
select tst_verifier(tst_profil(tst_qui('A')) ->> 'role' = 'MEMBRE', 'le rôle d''une fiche vient d''auth.users, pas du client');
select tst_verifier(not (tst_profil(tst_qui('A')) ? 'pwd'), 'aucun secret n''est enregistré sur la fiche');

-- B notifie A et tente au passage de modifier sa fiche et de forger une notification.
select tst_en_tant_que('B');
insert into kun_com_profiles (id, content) values (tst_qui('A'), tst_profil(tst_qui('A')) || jsonb_build_object(
  'prenom', 'Pirate',
  'notifications', jsonb_build_array(
    jsonb_build_object('id', 'n1', 'senderId', tst_qui('B'), 'timestamp', 10, 'read', false),
    jsonb_build_object('id', 'n2', 'senderId', tst_qui('Z'), 'timestamp', 11, 'read', false))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_profil(tst_qui('A')) ->> 'prenom' = 'Awa', 'un membre ne modifie pas la fiche d''un autre');
select tst_verifier(jsonb_array_length(tst_profil(tst_qui('A')) -> 'notifications') = 1
  and tst_profil(tst_qui('A')) #>> '{notifications,0,id}' = 'n1', 'seule la notification signée de B est ajoutée');

-- A marque lue depuis une copie périmée, pendant que B a envoyé n3.
insert into kun_com_profiles (id, content) values (tst_qui('A'), jsonb_set(tst_profil(tst_qui('A')), '{notifications}',
  tst_profil(tst_qui('A')) -> 'notifications' || jsonb_build_array(jsonb_build_object('id', 'n3', 'senderId', tst_qui('B'), 'timestamp', 12, 'read', false))))
on conflict (id) do update set content = excluded.content;
select tst_en_tant_que('A');
insert into kun_com_profiles (id, content) values (tst_qui('A'), jsonb_build_object(
  'id', tst_qui('A'), 'prenom', 'Awa K.', 'notifications', jsonb_build_array(
    jsonb_build_object('id', 'n1', 'senderId', tst_qui('B'), 'timestamp', 10, 'read', true))))
on conflict (id) do update set content = excluded.content;
select tst_verifier(tst_profil(tst_qui('A')) ->> 'prenom' = 'Awa K.', 'le propriétaire modifie sa fiche');
select tst_verifier(jsonb_array_length(tst_profil(tst_qui('A')) -> 'notifications') = 2, 'la copie périmée ne fait pas disparaître la notification n3');
select tst_verifier((select bool_and(case e ->> 'id' when 'n1' then e -> 'read' = 'true'::jsonb else e -> 'read' = 'false'::jsonb end)
  from jsonb_array_elements(tst_profil(tst_qui('A')) -> 'notifications') e), 'l''état « lu » est fusionné notification par notification');

-- Un membre ne crée pas la fiche d'un autre.
do $$ begin
  insert into kun_com_profiles (id, content) values ('zzz', '{"prenom":"x"}');
  raise exception 'ÉCHEC : fiche créée pour un autre';
exception when insufficient_privilege then raise notice 'ok — un membre ne crée pas la fiche d''un autre';
end $$;

-- ---------- Accès anonyme ----------
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tst_verifier((select count(*) from kun_com_posts) = 0, 'aucune publication n''est lisible sans connexion');
select tst_verifier(kc_apercu_publication('p1') ->> 'caption' = 'Bonjour à tous', 'l''aperçu public d''un lien fonctionne');
select tst_verifier(kc_apercu_publication('td1') is null, 'pas d''aperçu pour un enregistrement interne');
select tst_verifier(kc_apercu_publication('nexistepas') is null, 'pas d''aperçu pour une publication inconnue');

-- ---------- Stockage ----------
reset role;
insert into storage.objects (bucket_id, name, owner, owner_id) values
  ('post-media', 'a.jpg', tst_qui('A')::uuid, tst_qui('A'));
set role authenticated;
select tst_en_tant_que('B');
update storage.objects set name = 'pirate.jpg' where name = 'a.jpg';
delete from storage.objects where name = 'a.jpg';
reset role;
select tst_verifier((select count(*) from storage.objects where name = 'a.jpg') = 1, 'un membre ne remplace ni ne supprime le fichier d''un autre');
set role authenticated;
select tst_en_tant_que('A');
delete from storage.objects where name = 'a.jpg';
reset role;
select tst_verifier((select count(*) from storage.objects where name = 'a.jpg') = 0, 'le propriétaire supprime son fichier');

-- ---------- Clé service_role / SQL Editor ----------
select set_config('request.jwt.claims', '', false);
update kun_com_posts set content = content || '{"caption":"maintenance"}' where id = 'p1';
select tst_verifier(tst_post('p1') ->> 'caption' = 'maintenance', 'les requêtes serveur (sans utilisateur) ne sont pas filtrées');

\echo 'Tous les tests de la migration 06 sont passés.'
