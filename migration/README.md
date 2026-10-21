# Migration sécurité — Supabase Auth + RLS

Objectif : supprimer l'auth « maison » (SHA‑256 dans `content.pwd`) et fermer la
base (RLS). Après migration : plus aucun accès anonyme, les mots de passe et la
récupération vivent dans `auth.users` (jamais exposé), les DMs sont privés.

## Ce qui a déjà été changé dans le code (client v106)
- `js/01-core.js` : `applyAuthUser()` + `initAuthSession()` (session Supabase, rôle lu dans le JWT).
- `js/07-app-controller.js` : `login` → `signInWithPassword` ; `signup` → `auth.signUp` (sans mot de passe/questions stockés) ; `checkForgotEmail` → `resetPasswordForEmail`.
- `js/04-render-auth-cropper.js` : retrait du choix « Responsable » et des questions de sécurité à l'inscription.
- `js/08-bootstrap.js` : démarrage attend la session Supabase avant le 1er rendu ; version `v106`.
- `sw.js`, `index.html` : bump cache `v106`.

## Étapes à faire (toi)

### 1. Réglages Auth (Dashboard → Authentication → Providers/Settings)
- **Email** activé.
- **Confirm email : DÉSACTIVÉ** (recommandé pour ce lancement interne — sinon la
  1re inscription ne crée pas de session immédiate ; l'app gère les deux cas mais
  c'est plus simple désactivé).
- **Minimum password length : 8** (ou plus).
- Optionnel : activer **Leaked password protection**.
- Renseigner le **SMTP** (sinon les e‑mails de réinitialisation ne partent pas).

### 2. Déployer le client v106
Pousser le repo (Vercel redéploie). Vérifier que l'app charge l'écran de connexion.

### 3. Exécuter le SQL
Supabase → SQL Editor → coller `01_migration_auth_rls.sql` → **Run**.
(Il purge les données de test, ajoute les colonnes/triggers, active RLS + policies.)

### 4. Créer ton compte + te promouvoir
1. Dans l'app : **S'inscrire** (tu seras MEMBRE).
2. SQL Editor → `02_promote_admin.sql` en remplaçant ton e‑mail → **Run**.
3. Déconnexion / reconnexion (rafraîchit le JWT). Tu es Grand Responsable.

### 5. (Optionnel) Edge Function d'attribution de rôle
Pour promouvoir d'autres membres depuis l'app plus tard :
```
supabase functions deploy set-role
```
(Utilise `SUPABASE_SERVICE_ROLE_KEY`, jamais exposée au navigateur.)

## Vérifier que l'accès anonyme est bien coupé
Après l'étape 3, ceci doit renvoyer 401 / liste vide (plus jamais le dump complet) :
```bash
SUPA="https://yugkryhikrfsxbuyxacl.supabase.co"
KEY="sb_publishable_CMnVxHYsKJIP51J0zDRX6w_hdLgiHR7"
curl -s "$SUPA/rest/v1/kun_com_profiles?select=id" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
curl -s -X POST "$SUPA/rest/v1/kun_com_profiles" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
     -H "Content-Type: application/json" -d '{"id":"x"}' -o /dev/null -w "%{http_code}\n"
```

## Récupération par questions de sécurité (v125 — sans e-mail)

Rétablit la récupération par question/réponse retirée en v106, mais **sans stocker
les réponses en clair** : elles sont hachées + salées **côté serveur** dans une
table fermée à tout client (`kun_com_secrets`, aucune policy RLS). Seule l'Edge
Function `password-recovery` (service_role) y accède et change le mot de passe via
l'API admin.

Artefacts :
- `03_security_questions.sql` — crée la table `kun_com_secrets` (RLS activée, sans policy). **✅ déployé** (SQL Editor → Run).
- `functions/password-recovery/index.ts` — Edge Function (actions `set` / `questions` / `reset` / `admin-reset`). **✅ déployée** via Dashboard → Edge Functions → Deploy → Via Editor.
  - **Important** : sa vérification JWT (« Verify JWT with legacy secret ») doit être **OFF**
    (Settings de la fonction), car le « mot de passe oublié » l'appelle sans session.
    L'authentification est faite dans le code, par action. **✅ réglé.**

Vérifié bout-en-bout : inscription → `set` → `questions` → `reset` (mauvaises réponses
rejetées, bonnes acceptées, normalisation casse/accents/espaces) → reconnexion.

> Nettoyage en attente : un compte de test `e2e_…@example.com` (sans fiche profil,
> invisible dans l'app) a servi à la validation. Le supprimer :
> `delete from auth.users where email like 'e2e_%@example.com';`

## Migration 06 — durcissement des écritures (v148)

Remplace la « limite connue » des versions précédentes : un membre connecté ne
peut plus modifier la publication ou la fiche d'un autre. Un déclencheur SQL
recalcule chaque écriture à partir de la version en base et n'y applique que
ce que l'auteur de la requête a le droit de changer (son J'aime, son vote, ses
commentaires, sa participation ; tout le reste s'il est l'auteur ou l'Admin).
Conséquence directe : deux écritures simultanées ne s'écrasent plus.

> ⚠️ **Bug corrigé au passage.** Pour un upsert, PostgreSQL vérifie la policy
> d'INSERTION même quand la ligne existe déjà. Avec la policy de la 04, les
> J'aime / commentaires / votes posés sur la publication d'un autre, et les
> notifications envoyées à un autre, étaient **refusés par le serveur** depuis
> l'exécution de la 04 (l'interface les affichait quand même, localement).

Ce que fait aussi la 06 :
- rôle des fiches imposé depuis `auth.users` ;
- heures de pointage et de livraison de tâche bornées par l'horloge du serveur ;
- publications lisibles **uniquement par les membres connectés** ; les aperçus
  de liens partagés passent par la fonction `kc_apercu_publication` (auteur,
  légende, une image — rien d'autre) ;
- événements réservés aux responsables, bilans à l'Admin, identifiants de
  publication au format imposé ;
- fichiers du stockage remplaçables/supprimables par leur seul propriétaire.

### Ordre de mise en production
1. **Déployer le client v148** (pousser la branche → Vercel). Il envoie les
   suppressions de commentaires sous une forme que la 06 comprend
   (`_supprimerCommentaires`) et appelle `kc_apercu_publication`.
   Vercel sert désormais **`public/`** (fixé dans `vercel.json`).
2. **Exécuter `06_durcissement_ecritures.sql`** dans le SQL Editor (idempotent).
3. **Redéployer les Edge Functions** `set-role`, `password-recovery`,
   `delete-account` (CORS configurable ; `set-role` refuse de retirer le dernier
   Admin, et « Quitter le rôle Admin » passe désormais par elle).
4. Optionnel : définir le secret `ALLOWED_ORIGINS` des Edge Functions
   (ex. `https://kun-com-vh.vercel.app`) pour n'accepter que l'application.

### Tester la migration sans toucher à la base réelle
```bash
PGHOST=… PGPORT=… PGUSER=postgres npm run test:sql
```
Crée une base PostgreSQL jetable imitant Supabase (`tests/sql/supabase_mock.sql`),
applique la 06 deux fois, puis lance 50 vérifications (`tests/sql/test_06_durcissement.sql`).

## Migration 07 — réponses aux convocations et validation des comptes (v153)

- **Réponses aux convocations** : « Je confirme » / « Je ne peux pas » (avec
  motif) sont enregistrées dans `reponsesConvocation` de l'événement. Comme
  pour les votes, le serveur ne laisse chacun écrire que **sa propre** réponse,
  et la copie périmée de l'organisateur ne les efface pas.
- **Validation des comptes** : un compte créé depuis l'écran d'inscription ne
  voit plus rien (publications, fiches des autres, messages) tant qu'un Admin
  ou un Responsable de pôle ne l'a pas validé depuis l'accueil (« Demandes
  d'inscription »). La validation est écrite par l'Edge Function `set-role`
  (actions `approuver` / `refuser`) dans `app_metadata.approuve`. **Tous les
  comptes existants sont validés d'office** par la migration.

### Ordre de mise en production
1. **Exécuter `07_convocations_et_validation.sql`** (idempotente, sans DROP).
2. **Redéployer l'Edge Function `set-role`** (nouvelles actions).
3. **Déployer le client v153.** Pas avant les deux étapes précédentes : le
   nouveau client inscrit les comptes « en attente », et sans `set-role` à jour
   personne ne pourrait les valider.

`npm run test:sql` applique la 06 seule, puis la 06 + la 07, et lance les
vérifications des deux (`tests/sql/test_07_convocations_validation.sql`).

## Limites restantes (connues)
- La **position GPS** d'un pointage est fournie par le téléphone : le serveur
  borne l'heure, mais ne peut pas prouver la présence physique.
- Les **notes** (ponctualité, tâches, classements) restent calculées dans
  l'application. Un membre ne peut plus modifier les données des autres ; les
  siennes, seulement dans les bornes ci-dessus.
