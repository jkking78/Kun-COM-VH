-- Imitation minimale de l'environnement Supabase pour tester les migrations
-- sur un PostgreSQL local : rôles anon/authenticated, auth.uid()/auth.jwt()
-- lus depuis request.jwt.claims (comme PostgREST), auth.users, storage.objects
-- et les trois tables de l'application.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_app_meta_data jsonb not null default '{}'::jsonb
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create schema storage;
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  owner_id text
);
alter table storage.objects enable row level security;

create table public.kun_com_posts (
  id text primary key,
  content jsonb,
  created_at timestamptz default now(),
  author_id text
);
create table public.kun_com_profiles (
  id text primary key,
  content jsonb,
  created_at timestamptz default now()
);
create table public.kun_com_dms (
  id text primary key,
  from_id text,
  to_id text,
  content jsonb,
  sent_at timestamptz
);

grant usage on schema public, auth, storage to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant select on auth.users to authenticated;

-- Politiques telles que relevées sur la base de production (octobre 2026).
alter table public.kun_com_posts enable row level security;
alter table public.kun_com_profiles enable row level security;
create policy "posts_select_public" on public.kun_com_posts for select to public using (true);
create policy "posts_insert_auteur" on public.kun_com_posts for insert to authenticated
  with check (content ->> 'userId' = auth.uid()::text);
create policy "posts_update_auteur_ou_admin" on public.kun_com_posts for update to authenticated
  using (content ->> 'userId' = auth.uid()::text or (auth.jwt() -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE')
  with check (content ->> 'userId' = auth.uid()::text or (auth.jwt() -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE');
create policy "posts_delete_auteur_ou_admin" on public.kun_com_posts for delete to authenticated
  using (content ->> 'userId' = auth.uid()::text or (auth.jwt() -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE');
create policy "profils_select_authentifie" on public.kun_com_profiles for select to authenticated using (true);
create policy "profils_insert_proprietaire" on public.kun_com_profiles for insert to authenticated with check (id = auth.uid()::text);
create policy "profils_update_proprietaire" on public.kun_com_profiles for update to authenticated
  using (id = auth.uid()::text) with check (id = auth.uid()::text);
create policy p_storage_read on storage.objects for select using (bucket_id in ('avatars','post-media'));
create policy p_storage_write on storage.objects for insert to authenticated with check (bucket_id in ('avatars','post-media'));
create policy p_storage_update on storage.objects for update to authenticated using (bucket_id in ('avatars','post-media'));
