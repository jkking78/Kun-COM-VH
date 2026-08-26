-- ============================================================
-- MIGRATION 04 — SÉCURITÉ SERVEUR (RLS + hygiène des secrets)
-- À exécuter dans le SQL Editor de Supabase (projet yugkryhikrfsxbuyxacl).
--
-- Constat d'audit : aucune politique RLS n'était définie sur les tables
-- applicatives kun_com_*. Avec la seule clé publique (exposée dans le bundle,
-- c'est normal pour Supabase), N'IMPORTE QUI pouvait lire et réécrire tous les
-- profils et toutes les publications. Des fiches legacy embarquaient en outre
-- le hash du mot de passe (`pwd`) et les réponses aux questions de sécurité
-- (`sec_a1`, `sec_a2`) dans leur JSON.
--
-- Cette migration :
--   1. purge une fois pour toutes les secrets hérités du contenu des profils ;
--   2. active RLS sur profils et publications ;
--   3. restreint l'écriture : chacun ne modifie que ses propres lignes
--      (l'édition/suppression par un Admin reste possible côté client via son
--      rôle JWT ; pour un verrouillage serveur complet du rôle, voir la note
--      en fin de fichier).
--
-- PRÉREQUIS : auth.users doit contenir les comptes avec id = uuid de profil
-- (c'est déjà le cas : les profils sont créés avec id = auth.uid(), voir
-- l'inscription dans 07-app-controller.js).
-- ============================================================

-- ------------------------------------------------------------
-- 1) HYGIÈNE : suppression des secrets hérités (à exécuter AVANT d'activer RLS)
--    L'authentification passe par Supabase Auth ; le hash maison et les
--    réponses de sécurité n'y sont plus utilisés nulle part.
-- ------------------------------------------------------------
UPDATE kun_com_profiles
SET content = content - 'pwd' - 'sec_a1' - 'sec_a2'
WHERE content ?| ARRAY['pwd', 'sec_a1', 'sec_a2'];

-- ------------------------------------------------------------
-- 2) PROFILS
-- ------------------------------------------------------------
ALTER TABLE kun_com_profiles ENABLE ROW LEVEL SECURITY;

-- Une policy "p_profiles_all" (tout autoriser à tout connecté) existe déjà
-- depuis la migration 01 : la laisser en place annulerait complètement le
-- resserrement ci-dessous (Postgres additionne les policies permissives avec
-- un OU logique — la plus large l'emporte toujours). On la retire donc d'abord.
DROP POLICY IF EXISTS "p_profiles_all" ON kun_com_profiles;

-- Lecture : réservée aux utilisateurs connectés (l'app est un annuaire interne ;
-- l'anonyme ne peut plus aspirer la liste des membres).
CREATE POLICY "profils_select_authentifie"
  ON kun_com_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Insertion / mise à jour : UNIQUEMENT sa propre fiche.
-- Les upserts clients écrivent {id, content} avec id = auth.uid().
-- id est de type text (pas uuid) : cast explicite obligatoire.
CREATE POLICY "profils_insert_proprietaire"
  ON kun_com_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid()::text);

CREATE POLICY "profils_update_proprietaire"
  ON kun_com_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Pas de policy DELETE : personne ne supprime de ligne de profil via le client.

-- ------------------------------------------------------------
-- 3) PUBLICATIONS
-- ------------------------------------------------------------
ALTER TABLE kun_com_posts ENABLE ROW LEVEL SECURITY;

-- Même remarque que pour les profils : la policy "p_posts_all" de la
-- migration 01 (tout autoriser à tout connecté) doit être retirée, sinon elle
-- reste active en parallèle et rend les policies ci-dessous sans effet.
DROP POLICY IF EXISTS "p_posts_all" ON kun_com_posts;

-- Lecture : publique (anonyme inclus) — nécessaire au partage de liens
-- (/api/p/:id lit une publication sans session pour générer l'aperçu Open
-- Graph WhatsApp etc.). Les publications partagées hors de l'app sont de toute
-- façon destinées à être vues. Si ce n'est pas souhaité, remplacer `TO public`
-- par `TO authenticated` ET faire transiter l'aperçu OG par une Edge Function
-- utilisant la service_role key.
CREATE POLICY "posts_select_public"
  ON kun_com_posts FOR SELECT
  TO public
  USING (true);

-- Création : connecté, et la publication doit s'attribuer son vrai auteur.
CREATE POLICY "posts_insert_auteur"
  ON kun_com_posts FOR INSERT
  TO authenticated
  WITH CHECK (content->>'userId' = auth.uid()::text);

-- Modification : l'auteur, ou un Admin (rôle présent dans le JWT via
-- app_metadata, posé par l'Edge Function « set-role »).
CREATE POLICY "posts_update_auteur_ou_admin"
  ON kun_com_posts FOR UPDATE
  TO authenticated
  USING (
    content->>'userId' = auth.uid()::text
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE'
  )
  WITH CHECK (
    content->>'userId' = auth.uid()::text
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE'
  );

-- Suppression physique : l'auteur ou un Admin (utilisée par toggleTaskDone
-- pour retirer un enregistrement TASK_DONE).
CREATE POLICY "posts_delete_auteur_ou_admin"
  ON kun_com_posts FOR DELETE
  TO authenticated
  USING (
    content->>'userId' = auth.uid()::text
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'GRAND_RESPONSABLE'
  );

-- ------------------------------------------------------------
-- NOTE — rôle serveur pour setMemberRole / adminResetPassword
-- ------------------------------------------------------------
-- Les Edge Functions « set-role » et « password-recovery » tournent déjà avec
-- la service_role key et constituent la vraie barrière d'habilitation (elles
-- vérifient le rôle du JWT appelant). Les policies ci-dessus complètent le
-- dispositif côté table : même un client falsifié ne peut plus réécrire ni
-- effacer les lignes d'autrui.
--
-- VÉRIFICATION après exécution :
--   select * from pg_policies where tablename in ('kun_com_profiles','kun_com_posts');
-- Et côté appli : connexion, fil, publication, commentaire, like, partage de
-- lien public (aperçu OG), reset mot de passe.
