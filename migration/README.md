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

## Limite connue (durcissement recommandé plus tard)
Un membre **connecté** peut techniquement modifier la publication ou la fiche d'un
autre, car « j'aime / commentaires / notifications » réécrivent l'objet entier.
C'est acceptable pour une équipe interne de confiance, et c'est un progrès énorme
vs l'accès anonyme mondial d'avant. Durcissement futur : déplacer j'aime,
commentaires et notifications dans des tables dédiées + RPC `security definer`,
puis restreindre `kun_com_posts`/`kun_com_profiles` au propriétaire.
