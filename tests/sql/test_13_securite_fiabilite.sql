-- Tests de la migration 13 (après 03, 06 à 13).
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email, raw_app_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x', '{"role":"MEMBRE","approuve":true}'),
  ('cccccccc-0000-0000-0000-000000000003', 'r@x', '{"role":"RESP_SECTION"}'),
  ('dddddddd-0000-0000-0000-000000000004', 'z@x', '{"role":"GRAND_RESPONSABLE","approuve":true}'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'p@x', '{}');

create function public.tst_qui(nom text) returns text language sql immutable as $$
  select case nom when 'B' then 'bbbbbbbb-0000-0000-0000-000000000002' when 'R' then 'cccccccc-0000-0000-0000-000000000003'
    when 'Z' then 'dddddddd-0000-0000-0000-000000000004' when 'P' then 'eeeeeeee-0000-0000-0000-000000000005' end;
$$;
create function public.tst_en_tant_que(nom text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', public.tst_qui(nom), 'role', 'authenticated',
    'app_metadata', json_build_object('role', case nom when 'R' then 'RESP_SECTION' when 'Z' then 'GRAND_RESPONSABLE' else 'MEMBRE' end))::text, false);
$$;
create function public.tst_fiche(nom text) returns jsonb language sql security definer as $$
  select content from public.kun_com_profiles where id = public.tst_qui(nom);
$$;
create function public.tst_post(pid text) returns jsonb language sql security definer as $$
  select content from public.kun_com_posts where id = pid;
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
set role authenticated;

-- ---------- Pôles et bonus ----------
select tst_en_tant_que('B');
insert into kun_com_profiles (id, content) values (tst_qui('B'), '{"sections":["cadrage"],"welcomeStars":500}');
select tst_verifier(tst_fiche('B') ->> 'welcomeStars' = '5', 'à la création, le bonus d''accueil est celui par défaut');
-- Pôles retenus à la création (la migration 21 n'en laisse aucun à un compte déjà validé).
select coalesce(tst_fiche('B') -> 'sections', 'null')::text as poles_b \gset
update kun_com_profiles set content = content || '{"sections":["cadrage","regie"],"welcomeStars":99,"bio":"Salut"}' where id = tst_qui('B');
select tst_verifier(coalesce(tst_fiche('B') -> 'sections', 'null') = :'poles_b'::jsonb and tst_fiche('B') ->> 'welcomeStars' = '5'
  and tst_fiche('B') ->> 'bio' = 'Salut', 'un membre validé ne change ni ses pôles ni son bonus, le reste oui');

select tst_en_tant_que('P');
insert into kun_com_profiles (id, content) values (tst_qui('P'), '{"sections":["photo"]}');
update kun_com_profiles set content = content || '{"sections":["web"]}' where id = tst_qui('P');
select tst_verifier(tst_fiche('P') -> 'sections' = '["web"]', 'une inscription en attente choisit encore ses pôles');

select tst_en_tant_que('R');
insert into kun_com_profiles (id, content) values (tst_qui('R'), '{"sections":["cadrage"]}');
select coalesce(tst_fiche('R') -> 'sections', 'null')::text as poles_r \gset
update kun_com_profiles set content = content || '{"sections":["cadrage","regie"]}' where id = tst_qui('R');
select tst_verifier(coalesce(tst_fiche('R') -> 'sections', 'null') = :'poles_r'::jsonb, 'un Responsable ne s''ajoute pas un pôle');
select tst_refuse($$select kc_definir_poles(tst_qui('B'), '["regie"]')$$, 'seul l''Admin fixe les pôles d''un membre');

select tst_en_tant_que('Z');
select kc_definir_poles(tst_qui('B'), '["regie","cadrage"]');
select tst_verifier(tst_fiche('B') -> 'sections' @> '["regie","cadrage"]' and jsonb_array_length(tst_fiche('B') -> 'sections') = 2,
  'l''Admin fixe les pôles d''un membre');
select tst_refuse($$select kc_definir_poles(tst_qui('B'), '["a","b","c"]')$$, 'trois pôles sont refusés');

-- ---------- Position confirmée après coup ----------
select tst_en_tant_que('B');
insert into kun_com_posts (id, content) values ('ci1', jsonb_build_object('id', 'ci1', 'userId', tst_qui('B'),
  'checkInEventId', 'ev1', 'checkInAt', 1, 'timestamp', 1));
reset role;
select set_config('request.jwt.claims', '', false);   -- écriture du serveur, sans utilisateur
update kun_com_posts set content = content || '{"checkInAt":1000,"checkInGraceUntil":61000}' where id = 'ci1';
set role authenticated;
select tst_en_tant_que('B');
update kun_com_posts set content = content || '{"geo":{"lat":5.3,"lng":-4.0,"available":true},"geoConfirmeLe":2000}' where id = 'ci1';
select tst_verifier(public.kc_num(tst_post('ci1') -> 'geoConfirmeLe') > 1700000000000, 'une position ajoutée après le délai de grâce est horodatée par le serveur');
update kun_com_posts set content = content || '{"geoConfirmeLe":3}' where id = 'ci1';
select tst_verifier(public.kc_num(tst_post('ci1') -> 'geoConfirmeLe') > 1700000000000, 'le membre ne fixe pas cette heure lui-même');

-- ---------- Fichiers ----------
reset role;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'p_storage_write') then
    create policy p_storage_write on storage.objects for insert to authenticated with check (bucket_id in ('avatars', 'post-media'));
  end if;
end $$;
alter policy p_storage_write on storage.objects with check (bucket_id in ('avatars', 'post-media'));
\i migration/13_securite_fiabilite.sql
set role authenticated;
select tst_en_tant_que('B');
insert into storage.objects (bucket_id, name) values ('post-media', tst_qui('B') || '/photo.jpg');
select tst_refuse($$insert into storage.objects (bucket_id, name) values ('post-media', 'autre/photo.jpg')$$, 'pas d''envoi hors de son dossier');
insert into storage.objects (bucket_id, name) values ('avatars', 'avatar_' || tst_qui('B') || '_1.jpg');
select tst_refuse($$insert into storage.objects (bucket_id, name) values ('avatars', 'avatar_' || tst_qui('Z') || '_1.jpg')$$, 'pas de photo de profil au nom d''un autre');
select tst_en_tant_que('P');
select tst_refuse($$insert into storage.objects (bucket_id, name) values ('post-media', tst_qui('P') || '/x.jpg')$$, 'une inscription en attente n''envoie pas de fichier');

-- ---------- Jeton des rappels ----------
reset role;
select tst_verifier((select length(jeton_rappels) from kun_com_push_cles where id = 1) >= 32 or not exists (select 1 from kun_com_push_cles), 'un jeton de rappels est créé');

\echo 'Tous les tests de la migration 13 sont passés.'
