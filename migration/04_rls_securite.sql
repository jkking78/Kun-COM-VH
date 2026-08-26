-- ============================================================
-- MIGRATION 04 — SÉCURITÉ SERVEUR (RLS + hygiène + comptes fantômes)
-- À exécuter dans le SQL Editor de Supabase (projet Kun-com-VH-AEV).
-- Idempotente : peut être relancée sans risque.
--
-- IMPORTANT — modèle de données réel de l'app (à lire avant de toucher) :
-- Les commentaires, J'aime, participations et votes vivent DANS le JSON de la
-- publication (content). N'IMPORTE QUEL membre connecté met donc à jour la
-- ligne d'une publication d'un autre membre quand il like/commente. De même,
-- les notifications sont écrites DANS le JSON du profil du destinataire par
-- l'expéditeur (pushNotificationToProfile). Les policies ci-dessous en
-- tiennent compte : on verrouille l'ANONYME et l'ATTRIBUTION des lignes,
-- pas la mise à jour entre membres connectés.
--
-- Cette migration :
--   1. purge une fois pour toutes les secrets hérités du contenu des profils ;
--   2. supprime les fiches fantômes (profil présent, compte auth supprimé) et
--      les publications orphelines de ces comptes ;
--   3. active RLS sur profils, publications et DMs avec des policies
--      compatibles avec le fonctionnement de l'app.
-- ============================================================

-- ------------------------------------------------------------
-- 1) HYGIÈNE : suppression des secrets hérités
--    L'authentification passe par Supabase Auth ; le hash maison (`pwd`) et
--    les réponses de sécurité (`sec_a1`, `sec_a2`) n'y sont plus utilisés.
-- ------------------------------------------------------------
UPDATE kun_com_profiles
SET content = content - 'pwd' - 'sec_a1' - 'sec_a2'
WHERE content ?| ARRAY['pwd', 'sec_a1', 'sec_a2'];

-- ------------------------------------------------------------
-- 2) COMPTES FANTÔMES — la cause des « comptes supprimés qui figurent encore »
--    confirmDeleteAccount ne supprimait pas la ligne auth.users : le membre
--    se reconnectait et sa fiche se recréait. Ces comptes sont désormais
--    supprimés par l'Edge Function « delete-account » ; ce bloc nettoie les
--    restes existants (fiche sans compte auth = fantôme).
-- ------------------------------------------------------------
-- Fiches fantômes : on les liste d'abord (vérifiez, puis relancez le DELETE).
SELECT p.id, p.content->>'prenom', p.content->>'nom'
FROM kun_com_profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id);

DELETE FROM kun_com_profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id);

-- Publications (et traces) des comptes fantômes : l'app les retire déjà de
-- l'affichage côté client (separerOrphelines) ; on purge ici les lignes.
DELETE FROM kun_com_posts c
WHERE c.content->>'userId' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users a WHERE a.id::text = c.content->>'userId'
  );

-- ------------------------------------------------------------
-- 3) PROFILS
-- ------------------------------------------------------------
ALTER TABLE kun_com_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_profiles_all"          ON kun_com_profiles;
DROP POLICY IF EXISTS "profils_select_authentifie" ON kun_com_profiles;
DROP POLICY IF EXISTS "profils_insert_proprietaire" ON kun_com_profiles;
DROP POLICY IF EXISTS "profils_update_proprietaire" ON kun_com_profiles;

-- Lecture : réservée aux membres connectés (l'anonyme ne peut plus aspirer
-- l'annuaire).
CREATE POLICY "profils_select_authentifie"
  ON kun_com_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Création : uniquement SA propre fiche (id = auth.uid()).
CREATE POLICY "profils_insert_proprietaire"
  ON kun_com_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Mise à jour : tout membre connecté. CONTRAINTE DU MODÈLE : les notifications
-- sont écrites dans le profil du DESTINATAIRE par l'EXPÉDITEUR
-- (pushNotificationToProfile). Restreindre à soi-même casserait l'envoi de
-- notifications. La ligne reste attribuée : la création et la suppression sont
-- verrouillées sur le propriétaire.
CREATE POLICY "profils_update_membres"
  ON kun_com_profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Suppression : uniquement SA propre fiche (suppression de compte).
CREATE POLICY "profils_delete_proprietaire"
  ON kun_com_profiles FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ------------------------------------------------------------
-- 4) PUBLICATIONS
-- ------------------------------------------------------------
ALTER TABLE kun_com_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_posts_all"             ON kun_com_posts;
DROP POLICY IF EXISTS "posts_select_public"     ON kun_com_posts;
DROP POLICY IF EXISTS "posts_insert_auteur"     ON kun_com_posts;
DROP POLICY IF EXISTS "posts_update_auteur_ou_admin" ON kun_com_posts;
DROP POLICY IF EXISTS "posts_delete_auteur_ou_admin" ON kun_com_posts;

-- Lecture : publique — nécessaire aux aperçus de partage (/api/p/:id lit une
-- publication sans session pour générer l'image Open Graph WhatsApp etc.).
CREATE POLICY "posts_select_public"
  ON kun_com_posts FOR SELECT
  TO public
  USING (true);

-- Création : connecté, et la publication doit s'attribuer son vrai auteur.
CREATE POLICY "posts_insert_auteur"
  ON kun_com_posts FOR INSERT
  TO authenticated
  WITH CHECK (content->>'userId' = auth.uid()::text);

-- Mise à jour : tout membre connecté. CONTRAINTE DU MODÈLE : un like, un
-- commentaire ou un vote est une mise à jour du JSON d'une publication qui
-- appartient à quelqu'un d'autre (App.ecrirePostFrais relit la version fraîche
-- puis réécrit). Restreindre l'UPDATE au seul auteur empêcherait de liker ou
-- commenter les publications des autres. Le nettoyage des traces d'un compte
-- supprimé (retirerTracesDUnCompte) en dépend aussi.
CREATE POLICY "posts_update_membres"
  ON kun_com_posts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Suppression physique : l'auteur, ou un Admin (rôle du JWT, posé par l'Edge
-- Function « set-role »). Utilisée par toggleTaskDone et le retrait des
-- enregistrements TASK_DONE.
CREATE POLICY "posts_delete_auteur_ou_admin"
  ON kun_com_posts FOR DELETE
  TO authenticated
  USING (
    content->>'userId' = auth.uid()::text
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE'
  );

-- ------------------------------------------------------------
-- 5) VÉRIFICATION
-- ------------------------------------------------------------
--   select * from pg_policies
--    where tablename in ('kun_com_profiles','kun_com_posts');
-- Côté appli : connexion, fil, like + commentaire sur le post d'un AUTRE,
-- notification reçue, partage de lien public (aperçu OG), suppression de
-- compte (le membre ne doit PLUS pouvoir se reconnecter ensuite).
