-- ============================================================================
-- COMMIT — Migration sécurité : Supabase Auth + RLS  (redémarrage à zéro)
-- À exécuter dans : Supabase → SQL Editor → coller → Run.
-- Prérequis : le client v106 (Supabase Auth) est déployé.
-- ============================================================================

-- 0) REPART DE ZÉRO — purge des comptes/données de test ----------------------
truncate table public.kun_com_profiles;
truncate table public.kun_com_posts;
truncate table public.kun_com_dms;
-- Les anciens comptes n'existaient que dans kun_com_profiles (auth « maison »),
-- pas dans auth.users : cette purge suffit. Les comptes de test éventuellement
-- créés dans Auth se suppriment dans Authentication → Users.

-- 1) COLONNE DE PROPRIÉTÉ POUR LES PUBLICATIONS ------------------------------
alter table public.kun_com_posts add column if not exists author_id text;
-- kun_com_dms possède déjà from_id / to_id (écrits par le client).
-- kun_com_profiles.id contient désormais l'uid Supabase Auth (texte).

-- Estampille automatiquement l'auteur connecté à l'insertion d'une publication.
create or replace function public.stamp_post_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    new.author_id := coalesce(new.author_id, auth.uid()::text);
  end if;
  return new;
end $$;
drop trigger if exists trg_stamp_post_author on public.kun_com_posts;
create trigger trg_stamp_post_author
  before insert on public.kun_com_posts
  for each row execute function public.stamp_post_author();

-- 2) RÔLE DEPUIS LE JWT (jamais depuis une colonne modifiable par le membre) --
create or replace function public.jwt_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'MEMBRE');
$$;

-- 3) ACTIVER RLS — coupe TOUT accès anonyme ----------------------------------
alter table public.kun_com_profiles enable row level security;
alter table public.kun_com_posts    enable row level security;
alter table public.kun_com_dms      enable row level security;

drop policy if exists p_profiles_all on public.kun_com_profiles;
drop policy if exists p_posts_all    on public.kun_com_posts;
drop policy if exists p_dms_select   on public.kun_com_dms;
drop policy if exists p_dms_insert   on public.kun_com_dms;
drop policy if exists p_dms_delete   on public.kun_com_dms;

-- 4) POLICIES ----------------------------------------------------------------
-- PROFILS : réservés aux membres CONNECTÉS (plus aucun accès anonyme). Les
-- écritures inter-membres restent permises car le système de notifications écrit
-- dans la fiche du destinataire. Plus aucun secret ici : mot de passe et
-- récupération vivent dans auth.users (jamais exposé via l'API REST).
create policy p_profiles_all on public.kun_com_profiles
  for all to authenticated using (true) with check (true);

-- PUBLICATIONS : réservées aux membres connectés. Écritures inter-membres
-- permises (j'aime / commentaires modifient la publication d'autrui).
create policy p_posts_all on public.kun_com_posts
  for all to authenticated using (true) with check (true);

-- MESSAGES PRIVÉS : lisibles UNIQUEMENT par l'expéditeur et le destinataire.
create policy p_dms_select on public.kun_com_dms
  for select to authenticated
  using (from_id = auth.uid()::text or to_id = auth.uid()::text);
create policy p_dms_insert on public.kun_com_dms
  for insert to authenticated
  with check (from_id = auth.uid()::text);
create policy p_dms_delete on public.kun_com_dms
  for delete to authenticated
  using (from_id = auth.uid()::text);

-- 5) STOCKAGE (buckets avatars / post-media) ---------------------------------
drop policy if exists p_storage_read   on storage.objects;
drop policy if exists p_storage_write  on storage.objects;
drop policy if exists p_storage_update on storage.objects;
create policy p_storage_read on storage.objects
  for select using (bucket_id in ('avatars','post-media'));
create policy p_storage_write on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars','post-media'));
create policy p_storage_update on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars','post-media'));

-- ============================================================================
-- FAIT. Vérifie ensuite (script de contrôle en fin de fichier README) que
-- l'accès anonyme est bien refusé, puis désigne le premier Grand Responsable
-- avec 02_promote_admin.sql.
-- ============================================================================
