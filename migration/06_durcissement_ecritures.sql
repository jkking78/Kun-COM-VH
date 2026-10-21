-- ============================================================
-- MIGRATION 06 — DURCISSEMENT DES ÉCRITURES (fusion côté serveur)
-- À exécuter dans le SQL Editor de Supabase. Idempotente : peut être relancée.
--
-- Problème corrigé (limite connue de la migration 04) :
--   Les J'aime, commentaires, votes et participations vivent DANS le JSON de la
--   publication ; les notifications DANS le JSON du profil du destinataire.
--   Pour que l'application fonctionne, la 04 laissait donc N'IMPORTE QUEL
--   membre connecté réécrire N'IMPORTE QUELLE publication ou fiche
--   (UPDATE ... USING (true) WITH CHECK (true)) : changer la légende d'un
--   autre, effacer ses commentaires, se donner un rôle sur sa fiche, antidater
--   un pointage... Et deux écritures simultanées pouvaient s'écraser.
--
-- Solution, SANS changer le modèle de données ni casser les clients en place :
--   un déclencheur BEFORE UPDATE recalcule la ligne à partir de la version
--   ACTUELLE en base (OLD) et n'y applique QUE ce que l'auteur de la requête a
--   le droit de changer :
--     - son propre J'aime / sa propre vue / son propre vote / sa participation ;
--     - ses propres commentaires (ajout, modification, suppression) ;
--     - la suppression de n'importe quel commentaire s'il est l'auteur de la
--       publication ou Admin (modération) ;
--     - tout le reste de la publication s'il en est l'auteur ou Admin ;
--     - les assignations d'un événement s'il est Responsable de pôle ;
--     - l'ajout d'une notification signée de son nom sur la fiche d'un autre.
--   Tout le reste est ignoré silencieusement : un client périmé ou malveillant
--   ne peut plus rien écraser, et la fusion se faisant sur OLD (la ligne
--   verrouillée par l'UPDATE), deux écritures concurrentes ne se perdent plus.
--
-- Également :
--   - rôle des fiches profil imposé depuis auth.users (plus d'auto-promotion
--     visible des autres) ;
--   - heures de pointage et de livraison de tâche bornées par l'horloge du
--     serveur (pas d'antidatage au-delà de 10 minutes) ;
--   - lecture des publications réservée aux membres connectés ; l'aperçu des
--     liens partagés passe par une fonction qui n'expose que le strict minimum ;
--   - création d'événements réservée aux responsables, de bilans à l'Admin ;
--   - fichiers du stockage modifiables / supprimables par leur seul propriétaire.
--
-- Les requêtes faites avec la clé service_role (Edge Functions) ou depuis le
-- SQL Editor n'ont pas d'utilisateur (auth.uid() est NULL) : elles ne sont pas
-- filtrées.
-- ============================================================

-- ------------------------------------------------------------
-- 0) OUTILS
-- ------------------------------------------------------------
create or replace function public.jwt_role()
returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'MEMBRE');
$$;

create or replace function public.kc_maintenant_ms()
returns bigint language sql volatile as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

-- Horodatage fourni par le client, accepté s'il est plausible (10 min d'avance
-- de rattrapage hors-ligne, 2 min de décalage d'horloge), sinon remplacé par
-- l'heure du serveur.
create or replace function public.kc_horodatage_sur(v jsonb)
returns bigint language plpgsql volatile as $$
declare
  maintenant bigint := public.kc_maintenant_ms();
  n numeric;
begin
  if v is null or jsonb_typeof(v) <> 'number' then return maintenant; end if;
  n := v::numeric;
  if n between maintenant - 600000 and maintenant + 120000 then return n::bigint; end if;
  return maintenant;
end $$;

-- Liste d'identifiants (likedBy, viewedBy) : seule l'entrée de l'acteur peut
-- changer ; toutes les autres sont reprises de la version en base.
create or replace function public.kc_fusion_ids(anciens jsonb, nouveaux jsonb, acteur text)
returns jsonb language plpgsql immutable as $$
declare
  base jsonb := case when jsonb_typeof(anciens) = 'array' then anciens else '[]'::jsonb end;
  veut boolean := jsonb_typeof(nouveaux) = 'array' and nouveaux @> jsonb_build_array(acteur);
  res jsonb;
begin
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into res
  from jsonb_array_elements(base) with ordinality t(e, o)
  where e is distinct from to_jsonb(acteur);
  if veut then res := res || jsonb_build_array(acteur); end if;
  return res;
end $$;

-- Objet indexé par membre (poll.votes, metadata.participations) : seule la clé
-- de l'acteur peut changer.
create or replace function public.kc_fusion_cle(anciens jsonb, nouveaux jsonb, acteur text)
returns jsonb language sql immutable as $$
  select case
    when jsonb_typeof(nouveaux) = 'object' and nouveaux ? acteur
      then coalesce(case when jsonb_typeof(anciens) = 'object' then anciens end, '{}'::jsonb)
           || jsonb_build_object(acteur, nouveaux -> acteur)
    else coalesce(case when jsonb_typeof(anciens) = 'object' then anciens end, '{}'::jsonb) - acteur
  end;
$$;

-- Commentaires : chacun ajoute / modifie les siens. Une SUPPRESSION n'est
-- jamais déduite de l'absence d'un commentaire (c'est exactement ce que
-- produit une copie locale périmée) : elle doit être demandée explicitement
-- dans « _supprimerCommentaires » (liste d'ids), et n'est appliquée que pour
-- ses propres commentaires, ou pour tous si l'acteur est l'auteur de la
-- publication ou l'Admin. Une suppression emporte les réponses du commentaire.
create or replace function public.kc_fusion_commentaires(anciens jsonb, nouveaux jsonb, acteur text, moderateur boolean, demandes jsonb)
returns jsonb language plpgsql immutable as $$
declare
  a jsonb := case when jsonb_typeof(anciens) = 'array' then anciens else '[]'::jsonb end;
  n jsonb := case when jsonb_typeof(nouveaux) = 'array' then nouveaux else '[]'::jsonb end;
  ids_nouveaux text[];
  ids_anciens text[];
  supprimes text[] := '{}';
  a_supprimer text[];
  res jsonb := '[]'::jsonb;
  c jsonb;
  version_nouvelle jsonb;
begin
  select coalesce(array_agg(e ->> 'id'), '{}') into ids_nouveaux
    from jsonb_array_elements(n) e where e ->> 'id' is not null;
  select coalesce(array_agg(e ->> 'id'), '{}') into ids_anciens
    from jsonb_array_elements(a) e where e ->> 'id' is not null;
  select coalesce(array_agg(x), '{}') into a_supprimer
    from jsonb_array_elements_text(case when jsonb_typeof(demandes) = 'array' then demandes else '[]'::jsonb end) x;

  -- 1) Commentaires déjà en base, dans leur ordre.
  for c in select e from jsonb_array_elements(a) with ordinality t(e, o) order by o loop
    if c ->> 'id' is null then
      res := res || jsonb_build_array(c);
    elsif c ->> 'id' = any(a_supprimer) and (moderateur or c ->> 'userId' = acteur) then
      supprimes := supprimes || (c ->> 'id');
    elsif not (c ->> 'id' = any(ids_nouveaux)) then
      res := res || jsonb_build_array(c);             -- copie périmée : on garde
    else
      select e into version_nouvelle from jsonb_array_elements(n) e
        where e ->> 'id' = c ->> 'id' limit 1;
      if c ->> 'userId' = acteur and version_nouvelle ->> 'userId' = acteur then
        res := res || jsonb_build_array(version_nouvelle);
      else
        res := res || jsonb_build_array(c);
      end if;
    end if;
  end loop;

  -- 2) Nouveaux commentaires : uniquement ceux signés par l'acteur.
  for c in select e from jsonb_array_elements(n) with ordinality t(e, o) order by o loop
    if c ->> 'id' is not null and not (c ->> 'id' = any(ids_anciens))
       and c ->> 'userId' = acteur then
      res := res || jsonb_build_array(c);
    end if;
  end loop;

  -- 3) Les réponses d'un commentaire supprimé partent avec lui.
  if array_length(supprimes, 1) > 0 then
    select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into res
      from jsonb_array_elements(res) with ordinality t(e, o)
      where coalesce(e ->> 'parentId', '') <> all(supprimes);
  end if;
  return res;
end $$;

-- Champs collaboratifs d'une publication : recalculés depuis la version en
-- base + la seule contribution de l'acteur, QUEL QUE SOIT son rôle (même
-- l'auteur ne peut pas inventer ou retirer le J'aime d'un autre, et sa copie
-- périmée n'efface plus les contributions arrivées entre-temps).
create or replace function public.kc_appliquer_collaboratif(res jsonb, anc jsonb, nou jsonb, acteur text, moderateur boolean)
returns jsonb language plpgsql immutable as $$
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
  return res;
end $$;

-- Nettoyage par l'Admin des traces d'un compte SUPPRIMÉ (voir
-- enregistrerNettoyageTraces côté client) : une entrée dont l'auteur n'existe
-- plus dans auth.users et que la version envoyée a retirée disparaît. Les
-- entrées des membres existants restent protégées par la fusion ci-dessus.
create or replace function public.kc_purger_disparus(res jsonb, nou jsonb)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  cle text;
  tmp jsonb;
  partis text[];
  n_com jsonb := case when jsonb_typeof(nou -> 'comments') = 'array' then nou -> 'comments' else '[]'::jsonb end;
begin
  foreach cle in array array['likedBy', 'viewedBy'] loop
    if jsonb_typeof(res -> cle) = 'array' then
      select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into tmp
        from jsonb_array_elements(res -> cle) with ordinality t(e, o)
        where (jsonb_typeof(nou -> cle) = 'array' and (nou -> cle) @> jsonb_build_array(e))
           or exists (select 1 from auth.users u where u.id::text = e #>> '{}');
      res := jsonb_set(res, array[cle], tmp);
    end if;
  end loop;

  if jsonb_typeof(res -> 'comments') = 'array' then
    select coalesce(array_agg(c ->> 'id'), '{}') into partis
      from jsonb_array_elements(res -> 'comments') c
      where c ->> 'id' is not null and c ->> 'userId' is not null
        and not exists (select 1 from auth.users u where u.id::text = c ->> 'userId')
        and not exists (select 1 from jsonb_array_elements(n_com) n where n ->> 'id' = c ->> 'id');
    if array_length(partis, 1) > 0 then
      select coalesce(jsonb_agg(c order by o), '[]'::jsonb) into tmp
        from jsonb_array_elements(res -> 'comments') with ordinality t(c, o)
        where coalesce(c ->> 'id', '') <> all(partis)
          and coalesce(c ->> 'parentId', '') <> all(partis);
      res := jsonb_set(res, '{comments}', tmp);
    end if;
  end if;

  if jsonb_typeof(res #> '{poll,votes}') = 'object' then
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into tmp
      from jsonb_each(res #> '{poll,votes}') x(k, v)
      where (jsonb_typeof(nou #> '{poll,votes}') = 'object' and (nou #> '{poll,votes}') ? k)
         or exists (select 1 from auth.users u where u.id::text = k);
    res := jsonb_set(res, '{poll,votes}', tmp);
  end if;
  return res;
end $$;

-- ------------------------------------------------------------
-- 1) PUBLICATIONS — déclencheurs
-- ------------------------------------------------------------
-- À l'INSERTION : bornage des horodatages de pointage / de tâche. (Ce
-- déclencheur s'exécute aussi pour un upsert qui finira en UPDATE : il ne doit
-- donc jamais lever d'erreur, seulement normaliser.)
create or replace function public.kc_posts_avant_insertion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c jsonb := new.content;
  ts bigint;
begin
  if auth.uid() is null or jsonb_typeof(c) is distinct from 'object' or public.jwt_role() = 'GRAND_RESPONSABLE' then
    return new;
  end if;
  -- Upsert d'une ligne existante : c'est kc_posts_avant_maj qui tranche, en
  -- comparant à la version en base. Normaliser ici fausserait cette comparaison
  -- (EXCLUDED reprend les modifications faites par ce déclencheur).
  if exists (select 1 from public.kun_com_posts where id = new.id) then
    return new;
  end if;
  if c ? 'checkInAt' and c -> 'checkInAt' <> 'null'::jsonb then
    ts := public.kc_horodatage_sur(c -> 'checkInAt');
    c := jsonb_set(c, '{checkInAt}', to_jsonb(ts));
    c := jsonb_set(c, '{checkInGraceUntil}', to_jsonb(ts + 60000));
  end if;
  if c ->> 'type' = 'TASK_DONE' then
    ts := public.kc_horodatage_sur(c -> 'taskDoneAt');
    c := jsonb_set(c, '{taskDoneAt}', to_jsonb(ts));
    c := jsonb_set(c, '{timestamp}', to_jsonb(ts));
  end if;
  new.content := c;
  return new;
end $$;

drop trigger if exists trg_kc_posts_avant_insertion on public.kun_com_posts;
create trigger trg_kc_posts_avant_insertion
  before insert on public.kun_com_posts
  for each row execute function public.kc_posts_avant_insertion();

create or replace function public.kc_posts_avant_maj()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  acteur text := auth.uid()::text;
  role_acteur text := public.jwt_role();
  admin boolean := public.jwt_role() = 'GRAND_RESPONSABLE';
  anc jsonb := old.content;
  nou jsonb := new.content;
  res jsonb;
  est_auteur boolean;
  ts bigint;
begin
  if acteur is null then return new; end if;            -- service_role / SQL Editor

  if jsonb_typeof(anc) is distinct from 'object' or jsonb_typeof(nou) is distinct from 'object' then
    -- Contenu hérité non structuré : seul l'Admin peut le remplacer.
    if not admin then new.content := old.content; end if;
    return new;
  end if;

  est_auteur := coalesce(anc ->> 'userId' = acteur, false);

  if admin or est_auteur then
    res := nou;
    if not admin then
      -- Une publication ne change pas de propriétaire...
      res := jsonb_set(res, '{userId}', coalesce(anc -> 'userId', 'null'::jsonb));
      -- ... ni de nature (seul l'archivage d'un événement est permis).
      if nou ->> 'type' is distinct from anc ->> 'type'
         and not (anc ->> 'type' in ('EVENT', 'EVENT_ARCHIVED') and nou ->> 'type' in ('EVENT', 'EVENT_ARCHIVED')) then
        res := jsonb_set(res, '{type}', coalesce(anc -> 'type', 'null'::jsonb));
      end if;
    end if;
  else
    res := anc;
    -- Un Responsable de pôle gère les assignations de n'importe quel événement.
    if role_acteur = 'RESP_SECTION' and anc ->> 'type' = 'EVENT' then
      if nou ? 'assignments' then res := jsonb_set(res, '{assignments}', nou -> 'assignments'); end if;
      if nou ? 'assignmentsUpdatedAt' then
        res := jsonb_set(res, '{assignmentsUpdatedAt}', nou -> 'assignmentsUpdatedAt');
      end if;
    end if;
    -- Vignette vidéo générée a posteriori par un lecteur (voir
    -- backfillVideoPoster) : permise seulement si la publication n'en a pas.
    if coalesce(anc -> 'videoPoster', 'null'::jsonb) = 'null'::jsonb
       and jsonb_typeof(nou -> 'videoPoster') = 'string'
       and (nou ->> 'videoPoster' like 'data:image/%' or nou ->> 'videoPoster' like 'https://%') then
      res := jsonb_set(res, '{videoPoster}', nou -> 'videoPoster');
    end if;
  end if;

  res := public.kc_appliquer_collaboratif(res, anc, nou, acteur, admin or est_auteur);
  if admin then res := public.kc_purger_disparus(res, nou); end if;

  if not admin then
    -- L'heure d'arrivée d'un pointage est figée une fois enregistrée ; posée
    -- pour la première fois (rattachement après coup), elle est bornée.
    if coalesce(anc -> 'checkInAt', 'null'::jsonb) <> 'null'::jsonb then
      res := jsonb_set(res, '{checkInAt}', anc -> 'checkInAt');
      res := jsonb_set(res, '{checkInGraceUntil}', coalesce(anc -> 'checkInGraceUntil', 'null'::jsonb));
    elsif coalesce(res -> 'checkInAt', 'null'::jsonb) <> 'null'::jsonb then
      ts := public.kc_horodatage_sur(res -> 'checkInAt');
      res := jsonb_set(res, '{checkInAt}', to_jsonb(ts));
      res := jsonb_set(res, '{checkInGraceUntil}', to_jsonb(ts + 60000));
    end if;
    if res ->> 'type' = 'TASK_DONE' and (res -> 'taskDoneAt') is distinct from (anc -> 'taskDoneAt') then
      ts := public.kc_horodatage_sur(res -> 'taskDoneAt');
      res := jsonb_set(res, '{taskDoneAt}', to_jsonb(ts));
      res := jsonb_set(res, '{timestamp}', to_jsonb(ts));
    end if;
  end if;

  new.content := res;
  new.id := old.id;
  return new;
end $$;

drop trigger if exists trg_kc_posts_avant_maj on public.kun_com_posts;
create trigger trg_kc_posts_avant_maj
  before update on public.kun_com_posts
  for each row execute function public.kc_posts_avant_maj();

-- ------------------------------------------------------------
-- 2) PROFILS — déclencheur
-- ------------------------------------------------------------
-- Nombre JSON tolérant (un horodatage mal formé ne doit jamais faire échouer
-- l'écriture entière).
create or replace function public.kc_num(v jsonb)
returns numeric language sql immutable as $$
  select case when jsonb_typeof(v) = 'number' then v::numeric else 0 end;
$$;

-- Notifications du propriétaire : union par id (aucune fonction de l'app ne
-- supprime une notification), « lue » l'emporte, 50 plus récentes gardées.
create or replace function public.kc_fusion_notifs_proprietaire(anciennes jsonb, nouvelles jsonb)
returns jsonb language sql immutable as $$
  with a as (
    select e, e ->> 'id' as id from jsonb_array_elements(
      case when jsonb_typeof(anciennes) = 'array' then anciennes else '[]'::jsonb end) e
  ), n as (
    select e, e ->> 'id' as id from jsonb_array_elements(
      case when jsonb_typeof(nouvelles) = 'array' then nouvelles else '[]'::jsonb end) e
  ), tout as (
    select case
             when a.e -> 'read' = 'true'::jsonb then jsonb_set(n.e, '{read}', 'true'::jsonb)
             else n.e
           end as e
      from n left join a on a.id = n.id
    union all
    select a.e from a where a.id is null or not exists (select 1 from n where n.id = a.id)
  )
  select coalesce(jsonb_agg(e order by public.kc_num(e -> 'timestamp') desc), '[]'::jsonb)
    from (select e from tout order by public.kc_num(e -> 'timestamp') desc limit 50) s;
$$;

-- Fiche d'un autre : on ne peut qu'y AJOUTER une notification signée de soi.
create or replace function public.kc_fusion_notifs_tiers(anciennes jsonb, nouvelles jsonb, acteur text)
returns jsonb language sql immutable as $$
  with a as (
    select e from jsonb_array_elements(
      case when jsonb_typeof(anciennes) = 'array' then anciennes else '[]'::jsonb end) e
  ), ajouts as (
    select nv.e from jsonb_array_elements(
      case when jsonb_typeof(nouvelles) = 'array' then nouvelles else '[]'::jsonb end) nv(e)
    where nv.e ->> 'senderId' = acteur
      and not exists (select 1 from a where a.e ->> 'id' = nv.e ->> 'id')
  ), tout as (select e from a union all select e from ajouts)
  select coalesce(jsonb_agg(e order by public.kc_num(e -> 'timestamp') desc), '[]'::jsonb)
    from (select e from tout order by public.kc_num(e -> 'timestamp') desc limit 50) s;
$$;

create or replace function public.kc_profils_avant_ecriture()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  acteur text := auth.uid()::text;
  vrai_role text;
  res jsonb;
begin
  if acteur is null then return new; end if;            -- service_role / SQL Editor
  if jsonb_typeof(new.content) is distinct from 'object' then
    if tg_op = 'UPDATE' then new.content := old.content; end if;
    return new;
  end if;

  select coalesce(u.raw_app_meta_data ->> 'role', 'MEMBRE') into vrai_role
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
  new.content := res;
  if tg_op = 'UPDATE' then new.id := old.id; end if;
  return new;
end $$;

drop trigger if exists trg_kc_profils_avant_ecriture on public.kun_com_profiles;
create trigger trg_kc_profils_avant_ecriture
  before insert or update on public.kun_com_profiles
  for each row execute function public.kc_profils_avant_ecriture();

-- ------------------------------------------------------------
-- 3) POLICIES
-- ------------------------------------------------------------
alter table public.kun_com_posts enable row level security;
alter table public.kun_com_profiles enable row level security;

-- Lecture des publications : membres connectés uniquement (elle était ouverte
-- à tout Internet pour les aperçus de liens — voir kc_apercu_publication).
drop policy if exists "posts_select_public" on public.kun_com_posts;
drop policy if exists "posts_select_authentifie" on public.kun_com_posts;
create policy "posts_select_authentifie"
  on public.kun_com_posts for select
  to authenticated
  using (true);

-- ATTENTION — piège de PostgreSQL : pour un upsert (INSERT ... ON CONFLICT DO
-- UPDATE, ce que fait supabase-js .upsert()), la condition WITH CHECK de la
-- policy d'INSERTION est vérifiée sur la ligne proposée MÊME quand la ligne
-- existe déjà et que l'upsert finira en mise à jour. Avec la policy de la 04
-- (content->>'userId' = auth.uid()), tout J'aime / commentaire / vote posé sur
-- la publication d'un autre était donc REJETÉ par le serveur. Une ligne qui
-- existe déjà est désormais laissée au déclencheur de mise à jour, qui filtre.
create or replace function public.kc_post_existe(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.kun_com_posts where id = p_id);
$$;
create or replace function public.kc_profil_existe(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.kun_com_profiles where id = p_id);
$$;

-- Création : sa propre publication, identifiant au format attendu (il finit
-- interpolé dans le HTML), événements réservés aux responsables, bilans à
-- l'Admin.
drop policy if exists "posts_insert_auteur" on public.kun_com_posts;
create policy "posts_insert_auteur"
  on public.kun_com_posts for insert
  to authenticated
  with check (
    public.kc_post_existe(id)
    or (
      content ->> 'userId' = auth.uid()::text
      and id ~ '^[A-Za-z0-9_-]{1,64}$'
      and (content ->> 'type' is distinct from 'EVALUATION' or public.jwt_role() = 'GRAND_RESPONSABLE')
      and (coalesce(content ->> 'type', '') not in ('EVENT', 'EVENT_ARCHIVED')
           or public.jwt_role() in ('GRAND_RESPONSABLE', 'RESP_SECTION'))
    )
  );

drop policy if exists "profils_insert_proprietaire" on public.kun_com_profiles;
create policy "profils_insert_proprietaire"
  on public.kun_com_profiles for insert
  to authenticated
  with check (id = auth.uid()::text or public.kc_profil_existe(id));

-- Modification : reste ouverte aux membres connectés (J'aime, commentaires...)
-- mais le déclencheur kc_posts_avant_maj filtre désormais le contenu.
drop policy if exists "posts_update_membres" on public.kun_com_posts;
create policy "posts_update_membres"
  on public.kun_com_posts for update
  to authenticated
  using (true)
  with check (true);

-- Même principe pour les profils (notifications), filtrés par
-- kc_profils_avant_ecriture.
drop policy if exists "profils_update_membres" on public.kun_com_profiles;
create policy "profils_update_membres"
  on public.kun_com_profiles for update
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- 4) APERÇU PUBLIC D'UNE PUBLICATION (liens partagés, /api/p/:id)
--    Ne renvoie que l'auteur, la légende et UNE image, et seulement pour une
--    publication ordinaire visible de tous. Rien d'autre n'est lisible sans
--    connexion.
-- ------------------------------------------------------------
create or replace function public.kc_apercu_publication(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'author', c ->> 'author',
    'caption', left(coalesce(c ->> 'caption', ''), 300),
    'image', (
      select v from (
        select c #>> '{mediaUrls,0}' as v, 1 as rang
        union all select c ->> 'videoPoster', 2
        union all select c #>> '{originalMediaUrls,0}', 3
        union all select c ->> 'originalVideoPoster', 4
      ) cand
      where v like 'https://%' or v like 'data:image/%'
      order by rang limit 1
    )
  )
  from (select content as c from public.kun_com_posts where id = p_id) p
  where jsonb_typeof(c) = 'object'
    and coalesce(c ->> 'status', '') <> 'deleted'
    and coalesce(c ->> 'type', 'POST') in ('POST', 'REPOST', 'EVENT')
    and coalesce(c ->> 'visibility', 'all') = 'all';
$$;

revoke all on function public.kc_apercu_publication(text) from public;
grant execute on function public.kc_apercu_publication(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 5) STOCKAGE : un fichier ne peut être remplacé ou supprimé que par la
--    personne qui l'a envoyé (ou l'Admin pour la suppression).
-- ------------------------------------------------------------
do $$
declare
  col text;
begin
  select case when exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'objects' and column_name = 'owner_id'
  ) then 'owner_id' else 'owner' end into col;

  execute 'drop policy if exists p_storage_update on storage.objects';
  execute 'drop policy if exists p_storage_delete on storage.objects';
  if col = 'owner_id' then
    execute $p$create policy p_storage_update on storage.objects for update to authenticated
      using (bucket_id in ('avatars','post-media') and owner_id = auth.uid()::text)$p$;
    execute $p$create policy p_storage_delete on storage.objects for delete to authenticated
      using (bucket_id in ('avatars','post-media')
             and (owner_id = auth.uid()::text or public.jwt_role() = 'GRAND_RESPONSABLE'))$p$;
  else
    execute $p$create policy p_storage_update on storage.objects for update to authenticated
      using (bucket_id in ('avatars','post-media') and owner = auth.uid())$p$;
    execute $p$create policy p_storage_delete on storage.objects for delete to authenticated
      using (bucket_id in ('avatars','post-media')
             and (owner = auth.uid() or public.jwt_role() = 'GRAND_RESPONSABLE'))$p$;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6) RÔLES DÉJÀ ENREGISTRÉS SUR LES FICHES : réalignés sur auth.users.
-- ------------------------------------------------------------
update public.kun_com_profiles p
set content = jsonb_set(p.content, '{role}', to_jsonb(coalesce(u.raw_app_meta_data ->> 'role', 'MEMBRE')))
from auth.users u
where u.id::text = p.id
  and jsonb_typeof(p.content) = 'object'
  and p.content ->> 'role' is distinct from coalesce(u.raw_app_meta_data ->> 'role', 'MEMBRE');

-- ------------------------------------------------------------
-- 7) RAPPORT
-- ------------------------------------------------------------
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('kun_com_posts', 'kun_com_profiles', 'kun_com_dms')
order by tablename, cmd;
