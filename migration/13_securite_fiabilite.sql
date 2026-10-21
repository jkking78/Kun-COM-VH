-- ============================================================
-- MIGRATION 13 — LOT D2 : SÉCURITÉ ET FIABILITÉ (Supabase)
-- À exécuter après la 12. Ré-exécutable sans effet de bord, sans DROP.
--  S9  : un membre validé ne change plus ses pôles lui-même (ils ouvrent les
--        canaux et le plan de préparation) ; l'Admin les fixe (kc_definir_poles).
--  C6  : bonus d'accueil (welcomeStars) non modifiable par le membre ; une
--        position ajoutée après coup à un pointage est horodatée par le serveur.
--  S11 : l'action « rappels » de la fonction push exige un jeton connu du
--        seul serveur (table privée kun_com_push_cles), envoyé par pg_cron.
--  S13 : envoi de fichiers réservé aux comptes validés, dans leur propre
--        dossier (post-media) ou sous leur propre nom (avatars) ; taille et
--        types limités par bucket.
-- ============================================================

-- ------------------------------------------------------------
-- 1) FICHES : PÔLES ET BONUS FIGÉS POUR LE MEMBRE (S9, C6)
-- ------------------------------------------------------------
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
    -- Bonus d'accueil : la valeur par défaut, jamais celle choisie par le membre.
    if res ? 'welcomeStars' then res := jsonb_set(res, '{welcomeStars}', '5'::jsonb); end if;
  elsif acteur = old.id then
    res := new.content - 'pwd' - 'sec_a1' - 'sec_a2';
    if jsonb_typeof(old.content) = 'object' then
      res := jsonb_set(res, '{notifications}',
        public.kc_fusion_notifs_proprietaire(old.content -> 'notifications', new.content -> 'notifications'));
      -- Bonus d'accueil figé (C6).
      res := case when old.content ? 'welcomeStars' then jsonb_set(res, '{welcomeStars}', old.content -> 'welcomeStars')
                  else res - 'welcomeStars' end;
      -- Pôles figés une fois le compte validé, sauf pour l'Admin (S9).
      if coalesce(approuve, false) and coalesce(vrai_role, 'MEMBRE') <> 'GRAND_RESPONSABLE' then
        res := case when old.content ? 'sections' then jsonb_set(res, '{sections}', old.content -> 'sections') else res - 'sections' end;
        res := case when old.content ? 'section_id' then jsonb_set(res, '{section_id}', old.content -> 'section_id') else res - 'section_id' end;
      end if;
    end if;
  else
    if jsonb_typeof(old.content) is distinct from 'object' then
      new.content := old.content;
      return new;
    end if;
    res := jsonb_set(old.content, '{notifications}',
      public.kc_fusion_notifs_tiers(old.content -> 'notifications', new.content -> 'notifications', acteur));
    -- Pôles fixés par l'Admin via kc_definir_poles (seul chemin autorisé).
    if current_setting('kc.poles_admin', true) = '1' and public.jwt_role() = 'GRAND_RESPONSABLE' then
      res := (res - 'section_id') || jsonb_build_object('sections', coalesce(new.content -> 'sections', '[]'::jsonb));
    end if;
  end if;

  res := jsonb_set(res, '{role}', to_jsonb(coalesce(vrai_role, 'MEMBRE')));
  res := jsonb_set(res, '{approuve}', to_jsonb(coalesce(approuve, false)));
  new.content := res;
  if tg_op = 'UPDATE' then new.id := old.id; end if;
  return new;
end $$;
revoke execute on function public.kc_profils_avant_ecriture() from public, anon, authenticated;

-- L'Admin fixe les pôles d'un membre (2 au plus, parmi des identifiants simples).
create or replace function public.kc_definir_poles(p_membre text, p_poles jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  poles jsonb;
begin
  if auth.uid() is null or public.jwt_role() <> 'GRAND_RESPONSABLE' then
    raise exception 'Réservé à l''Admin' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(distinct x), '[]'::jsonb) into poles
    from jsonb_array_elements_text(case when jsonb_typeof(p_poles) = 'array' then p_poles else '[]'::jsonb end) x
   where x ~ '^[A-Za-z0-9_-]{1,40}$';
  if jsonb_array_length(poles) > 2 then raise exception 'Deux pôles au plus' using errcode = '22023'; end if;
  perform set_config('kc.poles_admin', '1', true);
  update public.kun_com_profiles
     set content = (content - 'section_id') || jsonb_build_object('sections', poles)
   where id = p_membre and jsonb_typeof(content) = 'object';
  if not found then raise exception 'Fiche introuvable' using errcode = 'P0002'; end if;
  perform set_config('kc.poles_admin', '', true);
  return poles;
end $$;
revoke all on function public.kc_definir_poles(text, jsonb) from public, anon;
grant execute on function public.kc_definir_poles(text, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 2) POINTAGE : POSITION CONFIRMÉE APRÈS COUP (C6)
-- ------------------------------------------------------------
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

  -- C6 (13) : une position ajoutée à un pointage après son délai de grâce
  -- (« Confirmer ma présence ») est horodatée par le serveur ; l'application
  -- retient alors cette heure comme heure d'arrivée. Personne d'autre que
  -- ce mécanisme ne fixe geoConfirmeLe (sauf l'Admin).
  if public.jwt_role() <> 'GRAND_RESPONSABLE' and coalesce(anc -> 'checkInAt', 'null'::jsonb) <> 'null'::jsonb then
    if (nou -> 'geo') is distinct from (anc -> 'geo') and coalesce(nou -> 'geo', 'null'::jsonb) <> 'null'::jsonb
       and public.kc_maintenant_ms() > public.kc_num(anc -> 'checkInGraceUntil') then
      res := jsonb_set(res, '{geoConfirmeLe}', to_jsonb(public.kc_maintenant_ms()));
    elsif anc ? 'geoConfirmeLe' then
      res := jsonb_set(res, '{geoConfirmeLe}', anc -> 'geoConfirmeLe');
    else
      res := res - 'geoConfirmeLe';
    end if;
  end if;
  return res;
end $$;


-- ------------------------------------------------------------
-- 3) RAPPELS : JETON DU SERVEUR (S11)
-- ------------------------------------------------------------
alter table public.kun_com_push_cles add column if not exists jeton_rappels text;
update public.kun_com_push_cles set jeton_rappels = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 where jeton_rappels is null;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'kc-rappels',
      '*/10 * * * *',
      $c$ select net.http_post(
           url := 'https://yugkryhikrfsxbuyxacl.supabase.co/functions/v1/push',
           headers := jsonb_build_object('Content-Type', 'application/json',
                        'x-kc-jeton', (select jeton_rappels from public.kun_com_push_cles where id = 1)),
           body := '{"action": "rappels"}'::jsonb,
           timeout_milliseconds := 30000
         ); $c$);
  end if;
end $$;

-- ------------------------------------------------------------
-- 4) FICHIERS (S13)
-- ------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'p_storage_write') then
    alter policy p_storage_write on storage.objects
      with check (
        (bucket_id = 'post-media' and split_part(name, '/', 1) = (select auth.uid())::text
           and (select public.kc_compte_approuve()))
        or (bucket_id = 'avatars' and (name like 'avatar\_' || (select auth.uid())::text || '\_%'
                                      or name like 'cover\_' || (select auth.uid())::text || '\_%'))
      );
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets set file_size_limit = 52428800, allowed_mime_types = array['image/*', 'video/*'] where id = 'post-media';
    update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/*'] where id = 'avatars';
  end if;
end $$;

-- ------------------------------------------------------------
-- 5) RÉCUPÉRATION : UN IDENTIFIANT PAR COMPTE (S8)
-- ------------------------------------------------------------
-- L'identifiant (numéro) est désormais tiré du compte par la fonction ; il ne
-- peut plus être partagé par deux comptes.
do $$ begin
  if not exists (select 1 from public.kun_com_secrets group by email having count(*) > 1) then
    create unique index if not exists kun_com_secrets_email_unique on public.kun_com_secrets (email);
  end if;
end $$;
