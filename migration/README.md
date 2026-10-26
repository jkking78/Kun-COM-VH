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

## Migration 08 — lot 3 « temps réel » (v154)

- **Échange de service** : `echanges` (« je propose ma place ») et `reprises`
  (« je reprends la place de… ») sont des champs collaboratifs de l'événement ;
  chacun n'écrit que sa propre entrée. Le responsable valide en modifiant les
  assignations (droit existant).
- **Canaux de pôle** : un message adressé à `pole:<id>` est lisible et
  inscriptible par les membres du pôle (d'après leur fiche) et par l'Admin.
  Les messages privés restent visibles des deux seuls interlocuteurs.
- **Notifications sur le téléphone** : table `kun_com_push_abonnements` (chacun
  gère les siens), clés VAPID et journal des rappels réservés au serveur. Les
  clés sont créées automatiquement par l'Edge Function `push` à sa première
  utilisation : **aucun secret à saisir**.
- **Rappels** (`08b_rappels_planifies.sql`) : toutes les 10 minutes, `pg_cron`
  appelle `push` (veille, 2 h avant, oubli de pointage 10 min après le début,
  échéance de tâche la veille). Chaque rappel n'est envoyé qu'une fois.

### Ordre de mise en production
1. **Exécuter `08_temps_reel.sql`**.
2. **Déployer l'Edge Function `push`** (fichiers `index.ts` et `webpush.ts`,
   *sans* vérification automatique du jeton : la fonction contrôle elle-même
   l'appelant).
3. **Exécuter `08b_rappels_planifies.sql`** (active `pg_cron` et `pg_net`).
4. **Déployer le client v154.**

Sur iPhone, les notifications ne fonctionnent qu'avec l'application installée
sur l'écran d'accueil (iOS 16.4 ou plus récent).

## Migration 09 — performances et rappels (v158)

- **`09_performances_rls.sql`** : neuf règles d'accès réécrites avec
  `(select auth.uid())` pour que l'identité soit calculée une fois par requête
  et non à chaque ligne (alerte « auth_rls_initplan » de Supabase). Aucun droit
  ne change : `npm run test:sql` rejoue les tests de la 08 par-dessus.
- **`09b_rappels_delai.sql`** (Supabase uniquement) : l'appel planifié des
  rappels attend 30 s au lieu de 5 s, et l'historique de `pg_cron` est purgé
  chaque dimanche (7 jours gardés).
- **Edge Function `push`** : les trois lectures des rappels partent en
  parallèle.

### Ordre de mise en production
1. **Exécuter `09_performances_rls.sql`**, puis **`09b_rappels_delai.sql`**.
2. **Redéployer l'Edge Function `push`** (mêmes réglages qu'en 08).
3. **Déployer le client v158.**

## Migration 10 — lot sécurité (v159)

- **Notifications chez un autre** : heure imposée par le serveur, titre et
  texte bornés, 5 ajouts au plus par écriture (plus de liste « squattée » avec
  une date dans le futur).
- **Extraits de messages privés** : effacés des fiches, où tous les membres
  pouvaient les lire. L'aperçu n'apparaît plus que sur le téléphone, ajouté
  par la fonction `push`, qui lit le message elle-même.
- **Messages** : l'expéditeur et le destinataire du JSON sont ceux des colonnes.
- **Événements** : heures « 09:00 » et date « 2026-10-25 » seulement.
- **Récupération de mot de passe** : essais réservés de façon atomique
  (`kc_reserver_essai`), verrou de 15 min qui double à chaque récidive
  (24 h au plus), 30 demandes par heure et par adresse IP (`kc_limite`),
  jokers neutralisés dans la recherche du numéro.
- **Fonction `push`** : titre fixé selon le type, nom de l'expéditeur tiré de
  sa fiche, envoi unique par notification, 30 par minute et par expéditeur ;
  seuls les responsables passent outre les préférences.

### Ordre de mise en production
1. **Exécuter `10_securite.sql`**.
2. **Redéployer les Edge Functions `password-recovery` et `push`** (sans
   vérification automatique du jeton, comme avant).
3. **Déployer le client v159.**

## Migration 11 — lieux enregistrés et plan de préparation (v161)

- **Lieux enregistrés** (`kun_com_lieux`) : chaque lieu retenu pour un
  événement est mémorisé par la fonction `kc_memoriser_lieu` (responsables et
  Admin), puis proposé à la saisie. Un lieu par nom (sans tenir compte des
  majuscules) ; un relevé GPS fait sur place remplace un résultat de
  recherche, jamais l'inverse, et un relevé grossier n'écrase pas un relevé
  précis. Lecture : membres validés. Suppression : Admin. 30 enregistrements
  par 10 minutes et par personne.
- **Plan de préparation** (`content.preparation` d'un événement) : une entrée
  par pôle, écrite seulement par l'Admin et les responsables de ce pôle.
  Une copie plus ancienne (version `v` pas plus grande qu'en base) ne
  remplace jamais le plan enregistré : modifier l'événement n'efface pas le
  travail des pôles. Le serveur fixe la version, l'heure et l'auteur. Figé
  une fois l'événement archivé ; 60 tâches et 40 Ko au plus par pôle.

### Ordre de mise en production
1. **Exécuter `11_lieux_et_preparation.sql`** (sans effet sur le client v160,
   qui n'envoie ni lieu ni plan).
2. **Déployer le client v161.**

**Rappels des étapes (v162)** : la fonction `push` (appelée toutes les 10 min,
comme les autres rappels) prévient les responsables du pôle la veille d'une
étape non cochée (à partir de 8 h) puis, une seule fois, le lendemain de sa
date si elle est en retard ; à défaut de responsable, l'auteur du plan. Un
message par événement et par pôle, qui renvoie au plan. Préférence
« Rappels de service ». Rien à exécuter en SQL : redéployer `push` (avec
`etapes.ts`).

## Migration 12 — lot D1 : assignations par pôle et présence (v164)

- **Assignations (C2, S10)** : un Responsable de pôle qui n'est pas l'auteur
  de l'événement n'ajoute ni ne retire que les assignations de SES pôles
  (champ `sectionId`, ou pôles du membre assigné pour les anciennes) ; les
  autres sont conservées depuis la base. L'application applique en plus une
  fusion par différence (seuls ses ajouts et retraits), pour tout le monde.
- **Présence (P1, C7)** : `kc_battement()` n'écrit que l'heure de passage ;
  l'application n'envoie plus toute sa fiche toutes les 2 minutes, et
  applique la fiche reçue en temps réel au lieu de retélécharger l'annuaire.

### Ordre de mise en production
1. **Exécuter `12_assignations_par_pole.sql`.**
2. **Déployer le client v164.**

## Migration 13 — lot D2 : sécurité et fiabilité (v165)

- **Pôles (S9)** : un membre validé (Responsable compris) ne change plus ses
  pôles lui-même ; l'Admin les fixe (`kc_definir_poles`, menu « ⋯ » de Gérer
  les rôles). Une inscription en attente choisit encore les siens.
- **Ponctualité (C6)** : bonus d'accueil (`welcomeStars`) figé ; une position
  ajoutée à un pointage après son délai de grâce reçoit `geoConfirmeLe`
  (heure du serveur), retenue comme heure d'arrivée.
- **Rappels (S11)** : la fonction `push` exige l'en-tête `x-kc-jeton`, que la
  tâche planifiée lit dans `kun_com_push_cles.jeton_rappels`.
- **Fichiers (S13)** : `post-media` réservé aux comptes validés, dans le
  dossier `<id>/` ; `avatars` sous `avatar_<id>_…` ou `cover_<id>_…` ; 50 Mo
  (images et vidéos) et 10 Mo (images) au plus.
- **Récupération (S8)** : identifiant unique par compte (index) ; la fonction
  le tire du compte et répond pareil qu'un numéro soit inscrit ou non.

### Ordre de mise en production
1. **Exécuter `13_securite_fiabilite.sql`** (la tâche planifiée envoie dès
   lors le jeton ; l'ancienne fonction l'ignore).
2. **Redéployer `push` puis `password-recovery`** (sans vérification
   automatique du jeton, comme avant).
3. **Déployer le client v165.**

## Migration 14 — lot D3 : visibilité ciblée (v166)

- **S14** : une publication réservée à des pôles, ou programmée, n'est plus
  livrée par la base qu'à son auteur, à l'Admin et (une fois publiée) aux
  membres des pôles visés (`kc_publication_visible`, règle de lecture).
- Avec ce lot : fonction `delete-account` (refus de supprimer le dernier
  Admin, abonnements et questions de sécurité effacés), en-têtes de sécurité
  (`vercel.json`).

### Ordre de mise en production
1. **Exécuter `14_visibilite_ciblee.sql`.**
2. **Redéployer `delete-account`.**
3. **Déployer le client v166.**

## Migration 15 — aperçu des événements partagés (v175)

- `kc_apercu_publication` renvoie aussi, pour un événement visible de tous,
  son titre, sa date, son heure de début et son affiche ; pour une série
  (« Répéter chaque semaine »), le nombre de ses dates à venir et leur
  période. Ni le lieu ni l'équipe ne sont exposés.
- `api/p.js` : `/api/p/<id>` partage une date, `/api/p/<id>?serie=1` toute
  la série ; l'aperçu WhatsApp affiche titre et date (ou période).

### Ordre de mise en production
1. **Exécuter `15_apercu_evenements.sql`** (remplace la fonction, même signature).
2. **Déployer le client v175.**

## Migration 16 — une publication supprimée ne garde plus son contenu

La suppression reste « douce » : la ligne garde `status: 'deleted'` pour que
chaque appareil apprenne la suppression. Mais un déclencheur ne laisse plus
que `id`, `status`, `type`, `userId`, `timestamp`, `eventDate`,
`recurrenceGroupId` et `deletedAt` : texte, sondage, commentaires et
assignations sont effacés. Les publications déjà supprimées sont vidées à
l'application de la migration. Les fichiers (images, vidéos) étaient déjà
retirés du stockage par l'application.

### Ordre de mise en production
1. Appliquer `16_suppression_videe.sql` (aucun changement de l'application).

## Migration 17 — vues des publications enregistrées sur le serveur (v184)

`viewedBy` n'était tenu que sur chaque appareil : chacun ne voyait que sa
propre vue. `kc_marquer_vues(ids)` ajoute la personne connectée à `viewedBy`
et rien d'autre. Elle s'exécute avec les droits de l'appelant, donc RLS
(compte validé, publication visible) et le déclencheur de la migration 06
(chacun n'ajoute que son propre identifiant) s'appliquent. L'auteur ne se
compte pas. L'application regroupe les vues et les envoie toutes les 4 s.

### Ordre de mise en production
1. Appliquer `17_vues.sql`.
2. Déployer l'application (v184).

## Migration 18 — aperçu public sans image SVG ni publication programmée (v186)

`/api/p-image` sert, depuis le domaine de l'application, l'image renvoyée par
`kc_apercu_publication`. Une image `data:image/svg+xml` y exécutait son script.
L'aperçu ne renvoie plus que des photos (png, jpeg, webp, gif), et ignore les
publications programmées. `/api/p-image` applique la même liste et ajoute
`nosniff` et une CSP `sandbox`.

### Ordre de mise en production
1. Appliquer `18_apercu_sans_svg.sql`.
2. Déployer l'application (v186).

## Migration 19 — une publication supprimée le reste (v187)

Pour l'auteur ou l'Admin, le serveur prenait le contenu envoyé tel quel,
`status` compris : un appareil qui avait encore la publication en cache
(épingler, modifier, file hors ligne) la faisait revenir en ligne. Le
déclencheur de la migration 16 garde désormais le marqueur de suppression
quelle que soit l'écriture suivante.

### Ordre de mise en production
1. Appliquer `19_suppression_definitive.sql`.
2. Déployer l'application (v187).

## Migration 20 — publications sans photo de profil recopiée (v188)

La photo de profil (base64) était recopiée dans chaque publication et
téléchargée par tous à chaque synchronisation. L'application ne recopie plus
qu'une adresse hébergée, et envoie désormais les photos de profil dans
Storage ; cette migration retire les copies base64 déjà enregistrées.

### Ordre de mise en production
1. Déployer l'application (v188).
2. Appliquer `20_publications_sans_photo_copiee.sql`.

## Migration 21 — pôles à l'inscription, notifications signées, fichiers (v190)

- À la création d'une fiche : 2 pôles au plus pour une inscription en
  attente, aucun pour un compte déjà validé (hors Admin ; l'Admin attribue
  les pôles par `kc_definir_poles`).
- Notification déposée chez un autre membre : nom affiché tiré de la fiche de
  l'expéditeur, type limité à la liste de l'application, photo seulement si
  c'est une adresse hébergée, 150 notifications par heure et par membre.
- Liste du stockage réservée aux membres validés (les adresses publiques
  restent servies) ; types de fichiers limités aux photos et vidéos courantes
  (plus de SVG).
- `search_path` figé pour `kc_dms_avant_ecriture`.

### Ordre de mise en production
1. Appliquer `21_securite_poles_notifications.sql`.
2. Déployer l'application (v190).

## Limites restantes (connues)
- **Pas de CSP stricte** : les ~270 gestionnaires `onclick` en ligne
  l'empêchent ; seuls `frame-ancestors`, `object-src` et `base-uri` sont posés.
- **Pointage différé hors réseau** : rejoué plus de 10 min après, il est
  réhorodaté par le serveur (protection contre la triche, C6).
- **Média publié en base64** si l'envoi vers Storage échoue (pour ne jamais
  perdre une publication) ; les vignettes vidéo, elles, n'y vont plus.
- **Session** : une réinitialisation de mot de passe ne ferme pas les
  sessions déjà ouvertes ; une rétrogradation prend effet au renouvellement
  du jeton.
- La **position GPS** d'un pointage est fournie par le téléphone : le serveur
  borne l'heure, mais ne peut pas prouver la présence physique.
- Les **notes** (ponctualité, tâches, classements) restent calculées dans
  l'application. Un membre ne peut plus modifier les données des autres ; les
  siennes, seulement dans les bornes ci-dessus.
