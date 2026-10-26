-- Migration 21 : pôles à l'inscription, notifications signées, fichiers.
--
-- Audit sécurité :
--  1. Pôles : à la CRÉATION d'une fiche, les pôles choisis étaient repris tels
--     quels. Une inscription pouvait demander tous les pôles (et donc, une fois
--     validée, lire tous les canaux et publications ciblées). Désormais :
--       - compte en attente : 2 pôles au plus ;
--       - compte déjà validé (hors Admin) : une fiche créée part sans pôle
--         (cas anormal : seul l'Admin attribue les pôles, kc_definir_poles).
--     Une mise à jour de sa propre fiche garde, comme avant, les pôles du
--     serveur une fois le compte validé.
--  2. Notifications déposées chez un autre membre : le serveur imposait déjà
--     l'expéditeur, l'heure et la longueur. Il impose maintenant aussi le NOM
--     affiché (tiré de la fiche de l'expéditeur : impossible de signer
--     « Pasteur X »), n'accepte que les types connus de l'application, ne
--     garde la photo que si c'est une adresse hébergée, et limite chaque
--     membre à 150 notifications par heure (au-delà, ignorées).
--  3. Fichiers : la liste du stockage n'est plus lisible sans connexion (les
--     adresses publiques des fichiers restent servies). Types de fichiers
--     limités aux photos et vidéos courantes : plus d'image SVG, qui peut
--     porter du script.
--  4. search_path figé pour kc_dms_avant_ecriture (alerte de la base).
-- Idempotente.

create or replace function public.kc_fusion_notifs_tiers(anciennes jsonb, nouvelles jsonb, acteur text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  types_connus text[] := array['ARRIVAL','CANAL','COMMENT','CONVOCATION','ECHANGE','EVALUATION','EVENT',
    'EVENT_ASSIGNED','EVENT_CANCELLED','EVENT_PARTICIPATION','EVENT_SECTION','FOLLOW','LIKE','MENTION',
    'MESSAGE','NEW_MEMBER','POST_SECTION','REPLY','REPOST','TASK_DONE'];
  fiche jsonb;
  nom text;
  base jsonb := case when jsonb_typeof(anciennes) = 'array' then anciennes else '[]'::jsonb end;
  ajouts jsonb := '[]'::jsonb;
  nv jsonb;
  n int := 0;
begin
  select p.content into fiche from public.kun_com_profiles p where p.id = acteur;
  nom := trim(coalesce(fiche ->> 'prenom', '') || ' ' ||
              case when coalesce(fiche ->> 'nom', '') <> '' then left(fiche ->> 'nom', 1) || '.' else '' end);
  if nom = '' then nom := 'Membre'; end if;

  for nv in select e from jsonb_array_elements(case when jsonb_typeof(nouvelles) = 'array' then nouvelles else '[]'::jsonb end) e loop
    exit when n >= 5;
    continue when jsonb_typeof(nv) is distinct from 'object' or nv ->> 'senderId' is distinct from acteur;
    continue when exists (select 1 from jsonb_array_elements(base) a where a ->> 'id' = nv ->> 'id');
    continue when not public.kc_limite('notif:' || acteur, 150, interval '1 hour');
    ajouts := ajouts || jsonb_build_array(nv || jsonb_build_object(
      'timestamp', (extract(epoch from now()) * 1000)::bigint,
      'read', false,
      'senderName', nom,
      'senderAvatar', case when nv ->> 'senderAvatar' like 'https://%' then to_jsonb(left(nv ->> 'senderAvatar', 500)) else 'null'::jsonb end,
      'type', case when nv ->> 'type' = any (types_connus) then nv ->> 'type' else 'EVENT' end,
      'title', left(coalesce(nv ->> 'title', ''), 80),
      'text', left(coalesce(nv ->> 'text', ''), 300)));
    n := n + 1;
  end loop;

  return coalesce((
    select jsonb_agg(e order by public.kc_num(e -> 'timestamp') desc)
      from (select e from jsonb_array_elements(base || ajouts) e
            order by public.kc_num(e -> 'timestamp') desc limit 50) s), '[]'::jsonb);
end $$;
revoke all on function public.kc_fusion_notifs_tiers(jsonb, jsonb, text) from public, anon, authenticated;

create or replace function public.kc_profils_avant_ecriture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
    -- Pôles à la création (21) : 2 au plus pour une inscription ; aucun pour
    -- un compte déjà validé (l'Admin les attribue). L'Admin garde les siens.
    if coalesce(vrai_role, 'MEMBRE') <> 'GRAND_RESPONSABLE' then
      if coalesce(approuve, false) then
        res := jsonb_set(res - 'section_id', '{sections}', '[]'::jsonb);
      elsif jsonb_typeof(res -> 'sections') = 'array' then
        res := jsonb_set(res, '{sections}', coalesce((
          select jsonb_agg(x order by o) from jsonb_array_elements(res -> 'sections') with ordinality t(x, o)
           where o <= 2 and jsonb_typeof(x) = 'string'), '[]'::jsonb));
      elsif res ? 'sections' then
        res := jsonb_set(res, '{sections}', '[]'::jsonb);
      end if;
    end if;
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

do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'p_storage_read') then
    drop policy p_storage_read on storage.objects;
    create policy p_storage_read on storage.objects for select to authenticated
      using (bucket_id in ('avatars', 'post-media') and (select public.kc_compte_approuve()));
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v', 'video/mpeg'] where id = 'post-media';
    update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'] where id = 'avatars';
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_proc where proname = 'kc_dms_avant_ecriture') then
    alter function public.kc_dms_avant_ecriture() set search_path = public;
  end if;
end $$;
