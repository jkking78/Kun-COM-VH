-- ============================================================================
-- COMMIT — Migration sécurité : Supabase Auth + RLS  (redémarrage à zéro)
-- À exécuter dans : Supabase → SQL Editor → coller → Run.
-- Prérequis : le client v106 (Supabase Auth) est déployé.
-- ============================================================================

-- 0) REPART DE ZÉRO — purge des comptes/données de test ----------------------
truncate table public.kun_com_profiles;
truncate table public.kun_com_posts;
truncate table public.kun_com_dms;

-- 1) COLONNE DE PROPRIÉTÉ POUR LES PUBLICATIONS ------------------------------
alter table public.kun_com_posts add column if not exists author_id text;

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

-- 2) RÔLE DEPUIS LE JWT -------------------------------------------------------
create or replace function public.jwt_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'MEMBRE');
$$;

-- 3) SUPPRIMER TOUTES LES POLICIES EXISTANTES --------------------------------
-- IMPORTANT : le projet contenait des policies « allow all » (souvent to public)
-- qui laissaient passer l'accès anonyme. On les supprime TOUTES avant de
-- recréer uniquement les nôtres, sinon l'ancienne policy permissive subsiste.
do $$
declare r record;
begin
  for r in
    select policyname, schemaname, tablename from pg_policies
    where (schemaname = 'public'  and tablename in ('kun_com_profiles','kun_com_posts','kun_com_dms'))
       or (schemaname = 'storage' and tablename = 'objects')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 4) ACTIVER RLS — coupe TOUT accès anonyme ----------------------------------
alter table public.kun_com_profiles enable row level security;
alter table public.kun_com_posts    enable row level security;
alter table public.kun_com_dms      enable row level security;

-- 5) POLICIES (uniquement pour les membres CONNECTÉS = role authenticated) ----
create policy p_profiles_all on public.kun_com_profiles
  for all to authenticated using (true) with check (true);

create policy p_posts_all on public.kun_com_posts
  for all to authenticated using (true) with check (true);

create policy p_dms_select on public.kun_com_dms
  for select to authenticated
  using (from_id = auth.uid()::text or to_id = auth.uid()::text);
create policy p_dms_insert on public.kun_com_dms
  for insert to authenticated
  with check (from_id = auth.uid()::text);
create policy p_dms_delete on public.kun_com_dms
  for delete to authenticated
  using (from_id = auth.uid()::text);

-- 6) STOCKAGE (buckets avatars / post-media) ---------------------------------
create policy p_storage_read on storage.objects
  for select using (bucket_id in ('avatars','post-media'));
create policy p_storage_write on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars','post-media'));
create policy p_storage_update on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars','post-media'));

-- 7) PURGE FINALE (efface d'éventuelles lignes-sonde de test) -----------------
truncate table public.kun_com_profiles;
truncate table public.kun_com_posts;
truncate table public.kun_com_dms;

-- 8) RAPPORT — rowsecurity doit être true partout ----------------------------
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('kun_com_profiles','kun_com_posts','kun_com_dms');
