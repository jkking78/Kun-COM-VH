-- ============================================================
-- MIGRATION 12 — LOT D1 : ASSIGNATIONS PAR PÔLE, BATTEMENT DE PRÉSENCE
-- À exécuter après la 11. Ré-exécutable sans effet de bord, sans DROP.
--  C2 / S10 : deux Responsables qui préparent le même service s'écrasaient
--  leurs assignations (le serveur reprenait la liste en bloc). Désormais, un
--  Responsable de pôle ne peut ajouter ou retirer que les assignations de
--  SES pôles (champ sectionId, ou pôles du membre assigné) ; les autres sont conservées depuis la base.
--  L'auteur de l'événement et l'Admin gardent la main sur toute la liste
--  (l'application leur applique une fusion par différence, voir 01-core).
--  P1 / C7 : le battement de présence (toutes les 2 min) n'écrit plus toute
--  la fiche, seulement l'heure de passage, par la fonction kc_battement.
-- ============================================================

create or replace function public.kc_battement()
returns void language sql security invoker set search_path = public as $$
  update public.kun_com_profiles
     set content = content || jsonb_build_object(
           'last_seen_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'is_online', true)
   where id = auth.uid()::text and jsonb_typeof(content) = 'object';
$$;
revoke all on function public.kc_battement() from public, anon;
grant execute on function public.kc_battement() to authenticated;


-- Une assignation relève-t-elle d'un pôle de la personne connectée ? Par son
-- champ sectionId, ou, pour les anciennes assignations qui n'en ont pas, par
-- les pôles du membre assigné (même règle que l'application).
create or replace function public.kc_assignation_a_moi(e jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when coalesce(e ->> 'sectionId', '') <> '' then public.kc_peut_preparer(e ->> 'sectionId')
    else exists (
      select 1 from public.kun_com_profiles p
      cross join lateral (
        select jsonb_array_elements_text(case when jsonb_typeof(p.content -> 'sections') = 'array' then p.content -> 'sections' else '[]'::jsonb end) as pole
        union select p.content ->> 'section_id'
      ) x
      where p.id = e ->> 'userId' and jsonb_typeof(p.content) = 'object'
        and x.pole is not null and public.kc_peut_preparer(x.pole))
  end;
$$;
revoke all on function public.kc_assignation_a_moi(jsonb) from public, anon;
grant execute on function public.kc_assignation_a_moi(jsonb) to authenticated;

-- Assignations des autres pôles reprises de la base, celles de ses pôles
-- reprises de l'écriture. Ordre conservé : la base d'abord, puis les siennes.
create or replace function public.kc_fusion_assignations(anc jsonb, nou jsonb)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(e order by rang, o), '[]'::jsonb) from (
    select a.e, 0 as rang, a.o from jsonb_array_elements(
      case when jsonb_typeof(anc) = 'array' then anc else '[]'::jsonb end) with ordinality a(e, o)
    where not public.kc_assignation_a_moi(a.e)
    union all
    select n.e, 1, n.o from jsonb_array_elements(
      case when jsonb_typeof(nou) = 'array' then nou else '[]'::jsonb end) with ordinality n(e, o)
    where jsonb_typeof(n.e) = 'object' and public.kc_assignation_a_moi(n.e)
  ) s;
$$;

-- Version de la 11, plus la fusion des assignations d'un Responsable de pôle
-- qui n'est pas l'auteur de l'événement (dernier bloc).
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

  -- Assignations (12) : un Responsable de pôle qui n'est ni l'auteur ni
  -- l'Admin ne réécrit que celles de ses pôles ; celles des autres pôles
  -- restent telles qu'en base, même s'il enregistre depuis une copie ancienne.
  if not moderateur and public.jwt_role() = 'RESP_SECTION' and anc ->> 'type' = 'EVENT' and nou ? 'assignments' then
    res := jsonb_set(res, '{assignments}', public.kc_fusion_assignations(anc -> 'assignments', nou -> 'assignments'));
  end if;
  return res;
end $$;

