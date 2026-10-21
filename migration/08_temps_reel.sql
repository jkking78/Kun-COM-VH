-- ============================================================
-- MIGRATION 08 — LOT 3 « TEMPS RÉEL »
-- À exécuter APRÈS la 07. Idempotente, sans DROP.
--
-- 1) Échange de service : deux champs collaboratifs de l'événement, indexés
--    par membre, que chacun ne peut écrire QUE pour lui-même :
--      echanges[<id>] = { tache, le }     — « je propose ma place »
--      reprises[<id>] = { pour, le }      — « je reprends la place de <pour> »
--    Le responsable valide en modifiant les assignations (droit existant).
-- 2) Canaux de pôle : un message de canal est un message privé adressé à
--    « pole:<id du pôle> ». Lisible et inscriptible par les membres du pôle
--    (d'après leur fiche) et par l'Admin.
-- 3) Notifications sur le téléphone : abonnements Web Push (chacun gère les
--    siens), clés VAPID et journal des rappels envoyés (réservés au serveur).
-- La planification des rappels est dans 08b_rappels_planifies.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ÉCHANGE DE SERVICE
-- ------------------------------------------------------------
create or replace function public.kc_appliquer_collaboratif(res jsonb, anc jsonb, nou jsonb, acteur text, moderateur boolean)
returns jsonb language plpgsql immutable set search_path = public as $$
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
  return res;
end $$;

-- ------------------------------------------------------------
-- 2) CANAUX DE PÔLE
-- ------------------------------------------------------------
-- La personne connectée appartient-elle au pôle désigné par « pole:<id> » ?
-- (Admin : à tous.) Lu dans sa fiche, comme l'application.
create or replace function public.kc_membre_du_pole(cible text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(cible like 'pole:%', false) and (
    coalesce((select u.raw_app_meta_data ->> 'role' from auth.users u where u.id = auth.uid()), '') = 'GRAND_RESPONSABLE'
    or exists (
      select 1 from public.kun_com_profiles p
      where p.id = auth.uid()::text and jsonb_typeof(p.content) = 'object'
        and (
          (jsonb_typeof(p.content -> 'sections') = 'array' and p.content -> 'sections' ? substr(cible, 6))
          or p.content ->> 'section_id' = substr(cible, 6)
        )
    )
  );
$$;
revoke all on function public.kc_membre_du_pole(text) from public, anon;
grant execute on function public.kc_membre_du_pole(text) to authenticated;

alter policy p_dms_select on public.kun_com_dms
  using (
    (select public.kc_compte_approuve())
    and (from_id = auth.uid()::text or to_id = auth.uid()::text or public.kc_membre_du_pole(to_id))
  );
alter policy p_dms_insert on public.kun_com_dms
  with check (
    from_id = auth.uid()::text and (select public.kc_compte_approuve())
    and (to_id not like 'pole:%' or public.kc_membre_du_pole(to_id))
  );

-- ------------------------------------------------------------
-- 3) NOTIFICATIONS SUR LE TÉLÉPHONE
-- ------------------------------------------------------------
-- Un abonnement par appareil (id = adresse du service de push).
create table if not exists public.kun_com_push_abonnements (
  id text primary key,
  user_id text not null,
  abonnement jsonb not null,
  cree_le timestamptz not null default now()
);
alter table public.kun_com_push_abonnements enable row level security;
grant select, insert, update, delete on public.kun_com_push_abonnements to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'kun_com_push_abonnements' and policyname = 'push_ses_abonnements') then
    create policy push_ses_abonnements on public.kun_com_push_abonnements for all to authenticated
      using (user_id = auth.uid()::text)
      with check (user_id = auth.uid()::text and (select public.kc_compte_approuve()));
  end if;
end $$;

-- Clés VAPID (générées une fois par l'Edge Function push) et journal des
-- rappels envoyés : aucune règle d'accès, donc réservés au serveur.
create table if not exists public.kun_com_push_cles (
  id int primary key check (id = 1),
  publique text not null,
  privee text not null
);
alter table public.kun_com_push_cles enable row level security;

create table if not exists public.kun_com_push_envois (
  cle text primary key,
  envoye_le timestamptz not null default now()
);
alter table public.kun_com_push_envois enable row level security;
