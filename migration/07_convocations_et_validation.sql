-- ============================================================
-- MIGRATION 07 — RÉPONSES AUX CONVOCATIONS ET VALIDATION DES COMPTES
-- À exécuter APRÈS la 06, dans le SQL Editor de Supabase. Idempotente.
-- Écrite sans DROP (ALTER POLICY, CREATE OR REPLACE) : elle s'applique aussi
-- par le connecteur Supabase sans confirmation manuelle.
--
-- 1) Réponse à une convocation (« Je confirme » / « Je ne peux pas ») : champ
--    collaboratif reponsesConvocation de l'événement, indexé par membre.
--    Comme pour les votes, chacun ne peut écrire QUE sa propre réponse.
-- 2) Validation des comptes : un compte créé depuis l'écran d'inscription ne
--    voit plus rien (publications, fiches des autres, messages) tant qu'un
--    Admin ou un Responsable de pôle ne l'a pas validé. Les comptes existants
--    sont validés d'office. La validation est écrite par l'Edge Function
--    set-role (action « approuver ») dans app_metadata.approuve.
-- ============================================================

-- ------------------------------------------------------------
-- 1) RÉPONSES AUX CONVOCATIONS
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

  -- Réponses aux convocations : { "<id du membre>": { statut, motif, le } }.
  if anc ? 'reponsesConvocation' or nou ? 'reponsesConvocation' then
    res := jsonb_set(res, '{reponsesConvocation}',
      public.kc_fusion_cle(anc -> 'reponsesConvocation', nou -> 'reponsesConvocation', acteur));
  end if;
  return res;
end $$;

-- ------------------------------------------------------------
-- 2) VALIDATION DES COMPTES
-- ------------------------------------------------------------
-- Comptes existants : validés d'office (ils utilisent déjà l'application).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"approuve": true}'::jsonb
where coalesce(raw_app_meta_data ->> 'approuve', '') <> 'true';

-- Le compte de la personne connectée est-il validé ? Lu dans auth.users (et
-- non dans le jeton) : une validation prend effet immédiatement, sans attendre
-- le renouvellement du jeton. Les responsables sont validés par leur rôle.
create or replace function public.kc_compte_approuve()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((
    select u.raw_app_meta_data ->> 'approuve' = 'true'
        or coalesce(u.raw_app_meta_data ->> 'role', '') in ('GRAND_RESPONSABLE', 'RESP_SECTION')
    from auth.users u where u.id = auth.uid()
  ), false);
$$;
revoke all on function public.kc_compte_approuve() from public, anon;
grant execute on function public.kc_compte_approuve() to authenticated;

-- La fiche porte l'état de validation (imposé par le serveur, comme le rôle) :
-- l'application s'en sert pour afficher l'écran d'attente et la liste des
-- demandes aux responsables.
create or replace function public.kc_profils_avant_ecriture()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  acteur text := auth.uid()::text;
  vrai_role text;
  approuve boolean;
  res jsonb;
begin
  if acteur is null then return new; end if;            -- service_role / SQL Editor
  if jsonb_typeof(new.content) is distinct from 'object' then
    if tg_op = 'UPDATE' then new.content := old.content; end if;
    return new;
  end if;

  select coalesce(u.raw_app_meta_data ->> 'role', 'MEMBRE'),
         (u.raw_app_meta_data ->> 'approuve' = 'true')
           or coalesce(u.raw_app_meta_data ->> 'role', '') in ('GRAND_RESPONSABLE', 'RESP_SECTION')
    into vrai_role, approuve
    from auth.users u where u.id::text = new.id;

  if tg_op = 'INSERT' then
    res := new.content - 'pwd' - 'sec_a1' - 'sec_a2';
  elsif acteur = old.id then
    res := new.content - 'pwd' - 'sec_a1' - 'sec_a2';
    if jsonb_typeof(old.content) = 'object' then
      res := jsonb_set(res, '{notifications}',
        public.kc_fusion_notifs_proprietaire(old.content -> 'notifications', new.content -> 'notifications'));
    end if;
  else
    if jsonb_typeof(old.content) is distinct from 'object' then
      new.content := old.content;
      return new;
    end if;
    res := jsonb_set(old.content, '{notifications}',
      public.kc_fusion_notifs_tiers(old.content -> 'notifications', new.content -> 'notifications', acteur));
  end if;

  res := jsonb_set(res, '{role}', to_jsonb(coalesce(vrai_role, 'MEMBRE')));
  res := jsonb_set(res, '{approuve}', to_jsonb(coalesce(approuve, false)));
  new.content := res;
  if tg_op = 'UPDATE' then new.id := old.id; end if;
  return new;
end $$;
revoke execute on function public.kc_profils_avant_ecriture() from public, anon, authenticated;

-- Fiches existantes : état de validation recopié depuis auth.users.
update public.kun_com_profiles p
set content = jsonb_set(p.content, '{approuve}', to_jsonb(
      (u.raw_app_meta_data ->> 'approuve' = 'true')
      or coalesce(u.raw_app_meta_data ->> 'role', '') in ('GRAND_RESPONSABLE', 'RESP_SECTION')))
from auth.users u
where u.id::text = p.id and jsonb_typeof(p.content) = 'object';

-- Règles d'accès : tout passe par la validation, sauf sa propre fiche (pour
-- que la personne en attente voie son état) et la création de cette fiche.
alter policy "posts_select_authentifie" on public.kun_com_posts
  using ((select public.kc_compte_approuve()));

alter policy "posts_insert_auteur" on public.kun_com_posts
  with check (
    (select public.kc_compte_approuve())
    and (
      public.kc_post_existe(id)
      or (
        content ->> 'userId' = auth.uid()::text
        and id ~ '^[A-Za-z0-9_-]{1,64}$'
        and (content ->> 'type' is distinct from 'EVALUATION' or public.jwt_role() = 'GRAND_RESPONSABLE')
        and (coalesce(content ->> 'type', '') not in ('EVENT', 'EVENT_ARCHIVED')
             or public.jwt_role() in ('GRAND_RESPONSABLE', 'RESP_SECTION'))
      )
    )
  );

alter policy "posts_update_membres" on public.kun_com_posts
  using ((select public.kc_compte_approuve()))
  with check ((select public.kc_compte_approuve()));

alter policy "posts_delete_auteur_ou_admin" on public.kun_com_posts
  using (
    (select public.kc_compte_approuve())
    and (content ->> 'userId' = auth.uid()::text
         or (auth.jwt() -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE')
  );

alter policy "profils_select_authentifie" on public.kun_com_profiles
  using (id = auth.uid()::text or (select public.kc_compte_approuve()));

alter policy "profils_insert_proprietaire" on public.kun_com_profiles
  with check (id = auth.uid()::text or ((select public.kc_compte_approuve()) and public.kc_profil_existe(id)));

alter policy "profils_update_membres" on public.kun_com_profiles
  using (id = auth.uid()::text or (select public.kc_compte_approuve()))
  with check (id = auth.uid()::text or (select public.kc_compte_approuve()));

alter policy p_dms_select on public.kun_com_dms
  using ((from_id = auth.uid()::text or to_id = auth.uid()::text) and (select public.kc_compte_approuve()));
alter policy p_dms_insert on public.kun_com_dms
  with check (from_id = auth.uid()::text and (select public.kc_compte_approuve()));

-- Rapport : comptes et état de validation.
select count(*) filter (where raw_app_meta_data ->> 'approuve' = 'true') as valides,
       count(*) filter (where coalesce(raw_app_meta_data ->> 'approuve', '') <> 'true') as en_attente
from auth.users;
