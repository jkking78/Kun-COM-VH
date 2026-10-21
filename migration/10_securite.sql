-- ============================================================
-- MIGRATION 10 — LOT SÉCURITÉ (Supabase)
-- À exécuter après la 09. Ré-exécutable sans effet de bord.
--  1) Notifications déposées dans la fiche d'un autre : heure du serveur,
--     texte borné, 5 au plus par écriture (S5 : plus de « squat » de la liste
--     avec une date dans le futur).
--  2) Extraits de messages privés déjà rangés dans les fiches : effacés (S4).
--  3) Messages : l'expéditeur et le destinataire du JSON sont ceux des
--     colonnes, que la règle d'accès contrôle (S6).
--  4) Événements : heures « 09:00 » et date « 2026-10-25 » seulement (S3).
--  5) Récupération de mot de passe : essais comptés de façon atomique,
--     verrouillage progressif, limite par adresse (S7).
-- ============================================================

-- ------------------------------------------------------------
-- 1) NOTIFICATIONS CHEZ UN AUTRE
-- ------------------------------------------------------------
-- Même contrat qu'en 06 (on ne peut qu'AJOUTER une notification signée de
-- soi), avec en plus : heure imposée par le serveur, titre et texte bornés,
-- « non lue », et 5 ajouts au plus par écriture.
create or replace function public.kc_fusion_notifs_tiers(anciennes jsonb, nouvelles jsonb, acteur text)
returns jsonb language sql stable as $$
  with a as (
    select e from jsonb_array_elements(
      case when jsonb_typeof(anciennes) = 'array' then anciennes else '[]'::jsonb end) e
  ), ajouts as (
    select nv.e || jsonb_build_object(
             'timestamp', (extract(epoch from now()) * 1000)::bigint,
             'read', false,
             'title', left(coalesce(nv.e ->> 'title', ''), 80),
             'text', left(coalesce(nv.e ->> 'text', ''), 300)) as e
    from jsonb_array_elements(
      case when jsonb_typeof(nouvelles) = 'array' then nouvelles else '[]'::jsonb end) nv(e)
    where nv.e ->> 'senderId' = acteur
      and not exists (select 1 from a where a.e ->> 'id' = nv.e ->> 'id')
    limit 5
  ), tout as (select e from a union all select e from ajouts)
  select coalesce(jsonb_agg(e order by public.kc_num(e -> 'timestamp') desc), '[]'::jsonb)
    from (select e from tout order by public.kc_num(e -> 'timestamp') desc limit 50) s;
$$;

-- ------------------------------------------------------------
-- 2) EXTRAITS DE MESSAGES DÉJÀ RANGÉS DANS LES FICHES
-- ------------------------------------------------------------
-- (requête sans utilisateur : le déclencheur des profils la laisse passer)
update public.kun_com_profiles p
set content = jsonb_set(p.content, '{notifications}', (
  select jsonb_agg(case
    when n ->> 'type' = 'MESSAGE' then jsonb_set(n, '{text}', '"t''a envoyé un message."')
    when n ->> 'type' = 'CANAL' then jsonb_set(n, '{text}', '"a écrit dans le canal."')
    else n end order by o)
  from jsonb_array_elements(p.content -> 'notifications') with ordinality as x(n, o)))
where jsonb_typeof(p.content) = 'object'
  and jsonb_typeof(p.content -> 'notifications') = 'array'
  and exists (select 1 from jsonb_array_elements(p.content -> 'notifications') n
              where n ->> 'type' in ('MESSAGE', 'CANAL')
                and n ->> 'text' not in ('t''a envoyé un message.', 'a écrit dans le canal.'));

-- ------------------------------------------------------------
-- 3) MESSAGES : EXPÉDITEUR ET DESTINATAIRE DES COLONNES
-- ------------------------------------------------------------
create or replace function public.kc_dms_avant_ecriture()
returns trigger language plpgsql as $$
begin
  if jsonb_typeof(new.content) = 'object' then
    new.content := new.content || jsonb_build_object('id', new.id, 'fromId', new.from_id, 'toId', new.to_id);
  end if;
  return new;
end $$;

create or replace trigger trg_kc_dms_avant_ecriture
  before insert or update on public.kun_com_dms
  for each row execute function public.kc_dms_avant_ecriture();

-- ------------------------------------------------------------
-- 4) FORMAT DES HEURES ET DATES D'ÉVÉNEMENT
-- ------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kc_posts_formats_evenement') then
    alter table public.kun_com_posts add constraint kc_posts_formats_evenement check (
      coalesce(content ->> 'eventStart', '') ~ '^(([01][0-9]|2[0-3]):[0-5][0-9])?$'
      and coalesce(content ->> 'eventEnd', '') ~ '^(([01][0-9]|2[0-3]):[0-5][0-9])?$'
      and coalesce(content ->> 'eventDate', '') ~ '^([0-9]{4}-[0-9]{2}-[0-9]{2})?$'
    );
  end if;
end $$;

-- ------------------------------------------------------------
-- 5) RÉCUPÉRATION DE MOT DE PASSE
-- ------------------------------------------------------------
-- Nombre de verrouillages successifs : chaque nouveau verrou dure deux fois
-- plus longtemps (15 min, 30 min, 1 h… jusqu'à 24 h).
alter table public.kun_com_secrets add column if not exists verrous int not null default 0;

-- Réserve UN essai avant de comparer les réponses. L'incrément est atomique :
-- des requêtes lancées en parallèle ne lisent plus toutes « 0 échec ». Le
-- 5e essai pose le verrou. Renvoie false si le compte est verrouillé.
create or replace function public.kc_reserver_essai(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  ok boolean;
begin
  update public.kun_com_secrets s
     set fail_count = case when s.fail_count + 1 >= 5 then 0 else s.fail_count + 1 end,
         locked_until = case when s.fail_count + 1 >= 5
                             then now() + least(interval '15 minutes' * power(2, s.verrous), interval '24 hours')
                             else s.locked_until end,
         verrous = case when s.fail_count + 1 >= 5 then least(s.verrous + 1, 10) else s.verrous end
   where s.user_id = p_user
     and (s.locked_until is null or s.locked_until <= now())
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function public.kc_reserver_essai(uuid) from public, anon, authenticated;
grant execute on function public.kc_reserver_essai(uuid) to service_role;

-- Limite de débit générique (par adresse IP, par expéditeur…) : au plus
-- p_max appels par fenêtre. Réservée aux fonctions serveur.
create table if not exists public.kun_com_limites (
  cle text primary key,
  debut timestamptz not null default now(),
  nombre int not null default 0
);
alter table public.kun_com_limites enable row level security;
revoke all on public.kun_com_limites from anon, authenticated;

create or replace function public.kc_limite(p_cle text, p_max int, p_fenetre interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  insert into public.kun_com_limites as l (cle, debut, nombre) values (p_cle, now(), 1)
  on conflict (cle) do update set
    nombre = case when l.debut < now() - p_fenetre then 1 else l.nombre + 1 end,
    debut = case when l.debut < now() - p_fenetre then now() else l.debut end
  returning nombre into n;
  return n <= p_max;
end $$;
revoke all on function public.kc_limite(text, int, interval) from public, anon, authenticated;
grant execute on function public.kc_limite(text, int, interval) to service_role;
