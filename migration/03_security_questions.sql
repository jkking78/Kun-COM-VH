-- ============================================================
-- RÉCUPÉRATION PAR QUESTIONS DE SÉCURITÉ (sans e-mail)
-- ============================================================
-- Les réponses ne sont JAMAIS stockées en clair, ni lisibles par le navigateur.
-- Cette table n'a AUCUNE policy RLS : anon et authenticated n'y ont donc aucun
-- accès. Seule l'Edge Function « password-recovery » (clé service_role, qui
-- contourne la RLS) la lit et l'écrit — c'est elle qui hache les réponses côté
-- serveur et qui réinitialise le mot de passe via l'API admin.
--
-- À exécuter une fois dans le SQL Editor du projet Supabase.

create table if not exists public.kun_com_secrets (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  q1            text not null,
  q2            text not null,
  a1_hash       text not null,
  a2_hash       text not null,
  salt          text not null,
  fail_count    int  not null default 0,
  locked_until  timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists kun_com_secrets_email_idx
  on public.kun_com_secrets (lower(email));

-- RLS activée SANS aucune policy => table fermée à tout client.
alter table public.kun_com_secrets enable row level security;
revoke all on public.kun_com_secrets from anon, authenticated;
