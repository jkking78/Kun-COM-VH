-- ============================================================
-- MIGRATION 05 — PURGE DÉFINITIVE & LIBÉRATION MÉMOIRE
-- À exécuter dans le SQL Editor de Supabase (projet Kun-com-VH-AEV).
--
-- Objectif : aucune trace des comptes et publications supprimés, et
-- récupération du maximum d'espace base de données.
--
-- Le script est ORDONNÉ : exécute-le ENTIÈREMENT, de haut en bas.
-- Les sections « 📊 » sont des rapports : regarde leur résultat, elles ne
-- modifient rien. Chaque suppression est précédée de son compteur de contrôle.
-- ============================================================

-- ============================================================
-- 📊 0) ÉTAT DES LIEUX — tailles AVANT
-- ============================================================
SELECT pg_size_pretty(pg_database_size(current_database())) AS taille_base;

SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS taille
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Les plus grosses fiches profils (les anciennes versions stockaient les
-- photos des notifications en base64 : jusqu'à 4 Mo par profil relevé)
SELECT p.id,
       p.content->>'prenom' AS prenom,
       pg_size_pretty(length(p.content::text)::bigint) AS taille_fiche
FROM kun_com_profiles p
ORDER BY length(p.content::text) DESC
LIMIT 10;

-- Contenu du Storage (fichiers réels : avatars, médias de publications)
SELECT bucket_id, count(*) AS fichiers,
       pg_size_pretty(COALESCE(sum((metadata->>'size')::bigint), 0)) AS taille
FROM storage.objects
GROUP BY bucket_id;

-- ============================================================
-- 1) PUBLICATIONS SUPPRIMÉES (tombstones status='deleted')
--    Ce sont les marques de suppression : plus aucune trace nécessaire.
--    (Tout appareil s'est synchronisé depuis leur création — au pire, un
--    appareil resté hors-ligne depuis garderai sa copie locale, sans jamais
--    la réenvoyer : les publications ne remontent jamais du cache.)
-- ============================================================
SELECT count(*) AS publications_supprimees_a_purger FROM kun_com_posts WHERE content->>'status' = 'deleted';
DELETE FROM kun_com_posts WHERE content->>'status' = 'deleted';

-- ============================================================
-- 2) PUBLICATIONS DES COMPTES FANTÔMES
--    (compte auth supprimé mais publications encore en base)
-- ============================================================
SELECT count(*) AS publications_fantomes_a_purger
FROM kun_com_posts c
WHERE c.content->>'userId' IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = c.content->>'userId');

DELETE FROM kun_com_posts c
WHERE c.content->>'userId' IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = c.content->>'userId');

-- ============================================================
-- 3) FICHES PROFILS FANTÔMES
--    (fiche présente sans compte auth correspondant)
-- ============================================================
SELECT count(*) AS fiches_fantomes_a_purger
FROM kun_com_profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id);

DELETE FROM kun_com_profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id);

-- ============================================================
-- 4) MESSAGES PRIVÉS IMPLIQUANT UN COMPTE FANTÔME
-- ============================================================
DELETE FROM kun_com_dms d
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = d.from_id)
   OR NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = d.to_id);

-- ============================================================
-- 5) SECRETS HÉRITÉS dans les fiches (hash maison + réponses de sécurité)
-- ============================================================
UPDATE kun_com_profiles
SET content = content - 'pwd' - 'sec_a1' - 'sec_a2'
WHERE content ?| ARRAY['pwd', 'sec_a1', 'sec_a2'];

-- ============================================================
-- 6) BASE64 DANS LES FICHES — le plus gros gain de place et de quota
--    (avatars/covers encodés, photos des notifications recopiées)
--    L'app replie proprement : initiale colorée à la place de l'avatar.
-- ============================================================
-- a) Avatars et couvertures en base64 → NULL
UPDATE kun_com_profiles
SET content = jsonb_strip_nulls(
  jsonb_set(
    jsonb_set(content, '{avatar_url}', 'null'),
    '{cover_url}', 'null'
  )
)
WHERE (content->>'avatar_url') LIKE 'data:%'
   OR (content->>'cover_url') LIKE 'data:%';

-- b) Photos des notifications en base64 → retirées (l'avatar de l'expéditeur
--    est re-téléchargé léger depuis son profil, jamais recopié)
UPDATE kun_com_profiles
SET content = jsonb_set(content, '{notifications}', (
  SELECT COALESCE(jsonb_agg(nettoie ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(content->'notifications') = 'array'
         THEN content->'notifications' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS t(n, ord),
  LATERAL (
    SELECT CASE
      WHEN (n->>'senderAvatar') LIKE 'data:%' THEN jsonb_set(n, '{senderAvatar}', 'null')
      ELSE n
    END AS nettoie
  ) x
))
WHERE content::text LIKE '%"senderAvatar": "data:%';

-- c) Images de notifications en base64 → champ retiré
UPDATE kun_com_profiles
SET content = jsonb_set(content, '{notifications}', (
  SELECT COALESCE(jsonb_agg(nettoie ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(content->'notifications') = 'array'
         THEN content->'notifications' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS t(n, ord),
  LATERAL (
    SELECT CASE
      WHEN (n->>'image') LIKE 'data:%' THEN n - 'image'
      ELSE n
    END AS nettoie
  ) x
))
WHERE content::text LIKE '%"image": "data:%';

-- d) Posters vidéo hérités en base64 dans les publications → retirés
--    (l'app en régénère un à la volée si besoin)
UPDATE kun_com_posts
SET content = content - 'videoPoster' - 'originalVideoPoster'
WHERE (content->>'videoPoster') LIKE 'data:%'
   OR (content->>'originalVideoPoster') LIKE 'data:%';

-- ============================================================
-- 7) ⚠️ OPTIONNEL — PHOTOS DES PUBLICATIONS EN BASE64
--    Décommente SEULEMENT si tu acceptes de perdre les photos/vidéos des
--    publications qui ne sont PAS hébergées dans Storage (ceux dont l'envoi
--    avait échoué et qui sont restées en base64 dans le JSON — ce sont
--    souvent les seules copies existantes).
-- ============================================================
-- SELECT id, pg_size_pretty(length(content::text)::bigint) AS taille
-- FROM kun_com_posts
-- WHERE content::text LIKE '%data:image%';
--
-- DELETE FROM kun_com_posts
-- WHERE content::text LIKE '%data:image%';

-- ============================================================
-- 8) COMPTES AUTH SANS FICHE — les « résurrectibles »
--    Comptes dans auth.users sans fiche profil : soit des membres qui ne
--    se sont pas reconnectés depuis la remise à zéro du 20/08 (ils
--    retrouveront leur compte en se reconnectant — NE PAS supprimer dans le
--    doute), soit d'anciens comptes supprimés avant le correctif (ceux-là
--    peuvent revenir se reconnecter et recréer une fiche).
--    → Vérifie la liste ; supprime AU CAS PAR CAS avec la commande en dessous.
-- ============================================================
SELECT a.id, a.email, a.phone, a.created_at, a.last_sign_in_at
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM kun_com_profiles p WHERE p.id = a.id)
ORDER BY a.last_sign_in_at DESC NULLS LAST;

-- Pour supprimer UN compte précis de la liste (remplace l'UUID) :
-- DELETE FROM auth.users WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

-- ============================================================
-- 9) RÉCUPÉRATION DE L'ESPACE DISQUE
--    VACUUM FULL rend l'espace à la base (VACUUM simple le garde pour un
--    réusage interne, invisible sur le quota). Tables minuscules : instantané.
-- ============================================================
VACUUM (FULL, ANALYZE) kun_com_posts;
VACUUM (FULL, ANALYZE) kun_com_profiles;
VACUUM (FULL, ANALYZE) kun_com_dms;

-- ============================================================
-- 📊 10) ÉTAT FINAL — tailles APRÈS (compare avec la section 0)
-- ============================================================
SELECT pg_size_pretty(pg_database_size(current_database())) AS taille_base;

SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS taille
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

SELECT (SELECT count(*) FROM kun_com_posts) AS publications,
       (SELECT count(*) FROM kun_com_profiles) AS profils,
       (SELECT count(*) FROM kun_com_dms) AS messages_prives;
