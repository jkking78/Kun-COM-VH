-- ============================================================
-- MIGRATION 11 — LIEUX ENREGISTRÉS ET PLAN DE PRÉPARATION (Supabase)
-- À exécuter après la 10. Ré-exécutable sans effet de bord, sans DROP.
--  1) Lieux enregistrés : chaque lieu retenu pour un événement est mémorisé
--     (nom, adresse, position) puis proposé à la saisie, même loin du lieu.
--     Lecture : membres validés. Écriture : fonction kc_memoriser_lieu
--     (responsables et Admin). Suppression : Admin.
--  2) Plan de préparation d'un événement : content.preparation, une entrée
--     par pôle { taches, v, maj_le, maj_par }. Seuls l'Admin et un
--     responsable du pôle écrivent l'entrée de ce pôle, et une copie plus
--     ancienne (v pas plus grand qu'en base) ne remplace jamais la version
--     enregistrée : enregistrer l'événement n'efface plus le plan d'un pôle.
-- ============================================================

-- ------------------------------------------------------------
-- 1) LIEUX ENREGISTRÉS
-- ------------------------------------------------------------
create table if not exists public.kun_com_lieux (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 1 and 80),
  -- Un lieu par nom, sans tenir compte des majuscules ni des espaces.
  cle text generated always as (lower(btrim(nom))) stored,
  adresse text not null default '' check (char_length(adresse) <= 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  -- Précision du relevé GPS en mètres ; null pour un lieu trouvé par recherche.
  precision_m int check (precision_m is null or precision_m between 0 and 100000),
  utilisations int not null default 1,
  cree_par text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create unique index if not exists kun_com_lieux_cle on public.kun_com_lieux (cle);

alter table public.kun_com_lieux enable row level security;
revoke all on public.kun_com_lieux from anon, authenticated;
grant select, delete on public.kun_com_lieux to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kun_com_lieux' and policyname = 'p_lieux_select') then
    create policy p_lieux_select on public.kun_com_lieux for select to authenticated
      using ((select public.kc_compte_approuve()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'kun_com_lieux' and policyname = 'p_lieux_delete') then
    create policy p_lieux_delete on public.kun_com_lieux for delete to authenticated
      using ((select public.jwt_role()) = 'GRAND_RESPONSABLE');
  end if;
end $$;

-- Mémorise un lieu (ou le met à jour s'il porte déjà ce nom). La position
-- n'est remplacée que par un relevé au moins aussi fiable : un relevé GPS
-- fait sur place l'emporte sur un résultat de recherche, et un relevé
-- grossier (à 500 m près) n'écrase pas un relevé précis.
create or replace function public.kc_memoriser_lieu(p_nom text, p_adresse text, p_lat double precision,
                                                    p_lng double precision, p_precision int default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  n text := left(btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g')), 80);
  prec int := case when p_precision between 0 and 100000 then p_precision end;
  ident uuid;
begin
  if auth.uid() is null or public.jwt_role() not in ('GRAND_RESPONSABLE', 'RESP_SECTION') then
    raise exception 'Réservé aux responsables' using errcode = '42501';
  end if;
  if n = '' or p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Lieu invalide' using errcode = '22023';
  end if;
  if not public.kc_limite('lieu:' || auth.uid()::text, 30, interval '10 minutes') then
    raise exception 'Trop de lieux enregistrés à la suite' using errcode = '54000';
  end if;

  insert into public.kun_com_lieux as l (nom, adresse, lat, lng, precision_m, cree_par)
  values (n, left(coalesce(p_adresse, ''), 200), p_lat, p_lng, prec, auth.uid()::text)
  on conflict (cle) do update set
    nom = excluded.nom,
    adresse = case when excluded.adresse <> '' then excluded.adresse else l.adresse end,
    lat = case when public.kc_lieu_plus_fiable(l.precision_m, excluded.precision_m) then excluded.lat else l.lat end,
    lng = case when public.kc_lieu_plus_fiable(l.precision_m, excluded.precision_m) then excluded.lng else l.lng end,
    precision_m = case when public.kc_lieu_plus_fiable(l.precision_m, excluded.precision_m) then excluded.precision_m else l.precision_m end,
    utilisations = l.utilisations + 1,
    maj_le = now()
  returning id into ident;
  return ident;
end $$;

-- Le nouveau relevé (precision « nouv ») remplace-t-il l'ancien (« anc ») ?
create or replace function public.kc_lieu_plus_fiable(anc int, nouv int)
returns boolean language sql immutable set search_path = public as $$
  select case
    when nouv is null then anc is null                 -- recherche : seulement sur une autre recherche
    else anc is null or nouv <= greatest(anc, 50)      -- GPS : pas plus grossier que l'ancien (50 m de tolérance)
  end;
$$;

revoke all on function public.kc_memoriser_lieu(text, text, double precision, double precision, int) from public, anon;
grant execute on function public.kc_memoriser_lieu(text, text, double precision, double precision, int) to authenticated;

-- ------------------------------------------------------------
-- 2) PLAN DE PRÉPARATION
-- ------------------------------------------------------------
-- La personne connectée peut-elle écrire le plan de ce pôle ?
-- Admin : tous les pôles. Responsable : les pôles de sa fiche.
create or replace function public.kc_peut_preparer(pole text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(pole ~ '^[A-Za-z0-9_-]{1,40}$', false) and (
    public.jwt_role() = 'GRAND_RESPONSABLE'
    or (public.jwt_role() = 'RESP_SECTION' and public.kc_membre_du_pole('pole:' || pole))
  );
$$;
revoke all on function public.kc_peut_preparer(text) from public, anon;
grant execute on function public.kc_peut_preparer(text) to authenticated;

-- Fusion pôle par pôle : on part de la version en base, et l'entrée d'un pôle
-- n'est reprise de l'écriture que si l'auteur en a le droit ET qu'elle est
-- plus récente (v plus grand). Le serveur fixe lui-même v, maj_le et maj_par.
create or replace function public.kc_fusion_preparation(anc jsonb, nou jsonb)
returns jsonb language plpgsql volatile set search_path = public as $$
declare
  res jsonb := case when jsonb_typeof(anc) = 'object' then anc else '{}'::jsonb end;
  k text;
  v jsonb;
  version_anc numeric;
begin
  if jsonb_typeof(nou) is distinct from 'object' then return res; end if;
  for k, v in select * from jsonb_each(nou) loop
    continue when jsonb_typeof(v) is distinct from 'object'
      or jsonb_typeof(v -> 'taches') is distinct from 'array'
      or jsonb_array_length(v -> 'taches') > 60
      or octet_length(v::text) > 40000;
    version_anc := public.kc_num(res -> k -> 'v');
    continue when public.kc_num(v -> 'v') <= version_anc;
    continue when not (res ? k) and (select count(*) from jsonb_object_keys(res)) >= 30;
    continue when not public.kc_peut_preparer(k);
    res := jsonb_set(res, array[k], jsonb_build_object(
      'taches', v -> 'taches',
      'v', version_anc + 1,
      'maj_le', public.kc_maintenant_ms(),
      'maj_par', auth.uid()::text));
  end loop;
  return res;
end $$;

-- Version de la 08, plus le plan de préparation (dernier bloc). Elle appelle
-- désormais une fonction qui lit l'heure : déclarée volatile.
create or replace function public.kc_appliquer_collaboratif(res jsonb, anc jsonb, nou jsonb, acteur text, moderateur boolean)
returns jsonb language plpgsql volatile set search_path = public as $$
declare
  cle text;
  meta jsonb;
  parts jsonb;
  sondage jsonb;
begin
  foreach cle in array array['likedBy', 'viewedBy'] loop
    if anc ? cle or nou ? cle then
      res := jsonb_set(res, array[cle], public.kc_fusion_ids(anc -> cle, nou -> cle, acteur));
    end if;
  end loop;

  if anc ? 'comments' or nou ? 'comments' then
    res := jsonb_set(res, '{comments}',
      public.kc_fusion_commentaires(anc -> 'comments', nou -> 'comments', acteur, moderateur,
                                    nou -> '_supprimerCommentaires'));
  end if;
  res := res - '_supprimerCommentaires';

  sondage := res -> 'poll';
  if jsonb_typeof(sondage) = 'object' then
    sondage := jsonb_set(sondage, '{votes}',
      public.kc_fusion_cle(anc #> '{poll,votes}', nou #> '{poll,votes}', acteur));
    res := jsonb_set(res, '{poll}', sondage);
  end if;

  if anc #> '{metadata,participations}' is not null or nou #> '{metadata,participations}' is not null then
    parts := public.kc_fusion_cle(anc #> '{metadata,participations}', nou #> '{metadata,participations}', acteur);
    meta := case when jsonb_typeof(res -> 'metadata') = 'object' then res -> 'metadata' else '{}'::jsonb end;
    res := jsonb_set(res, '{metadata}', jsonb_set(meta, '{participations}', parts));
  end if;

  -- Réponses aux convocations (07), propositions et reprises d'échange (08) :
  -- { "<id du membre>": {...} }, chacun n'écrit que sa propre entrée.
  foreach cle in array array['reponsesConvocation', 'echanges', 'reprises'] loop
    if anc ? cle or nou ? cle then
      res := jsonb_set(res, array[cle], public.kc_fusion_cle(anc -> cle, nou -> cle, acteur));
    end if;
  end loop;

  -- Plan de préparation (11) : modifiable tant que l'événement est à venir
  -- ou en cours ; figé une fois archivé, et absent des autres publications.
  if anc ? 'preparation' or nou ? 'preparation' then
    if anc ->> 'type' = 'EVENT' then
      res := jsonb_set(res, '{preparation}', public.kc_fusion_preparation(anc -> 'preparation', nou -> 'preparation'));
    elsif anc ? 'preparation' then
      res := jsonb_set(res, '{preparation}', anc -> 'preparation');
    else
      res := res - 'preparation';
    end if;
  end if;
  return res;
end $$;

-- ------------------------------------------------------------
-- 3) RAPPORT
-- ------------------------------------------------------------
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'kun_com_lieux'
order by policyname;
