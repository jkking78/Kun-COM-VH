// KUN COM VH — Partie 8 : CSS global, initialisation, démarrage

  'use strict';
  // ============================================================
  // CSS GLOBAL (injecté une seule fois)
  // ============================================================
  function injectCSS() {
    var style = document.createElement('style');
    style.textContent = [
      // Palette en variables CSS : bascule clair/sombre sans re-rendre l'app.
      // Refonte (fondations) : palette raffinée + identité typographique. Les
      // familles de polices sont partagées par les deux thèmes ; seules les
      // couleurs basculent. Bricolage Grotesque = titres, Inter = interface,
      // JetBrains Mono = données (heures, notes, compteurs).
      ':root{--font-display:\'Plus Jakarta Sans\',system-ui,-apple-system,"Segoe UI",sans-serif;--font-body:\'Plus Jakarta Sans\',system-ui,-apple-system,"Segoe UI",sans-serif;--font-mono:\'Plus Jakarta Sans\',system-ui,-apple-system,sans-serif;--page:#F4F5F7;--card:#FFFFFF;--tile:#EEF0F3;--line:#E6E9ED;--line2:#D5DAE1;--ink:#101418;--ink2:#2A313B;--muted:#5A6470;--faint:#6E7781;--lien:#0B5FE0;--accent-soft:#EAF1FD;--accent-ink:#0B4CB4;--ok:#0E9F6E;--ok-ink:#067647;--ok-soft:#E8F7EF;--ok-line:#A7F3D0;--warn:#D98A0B;--warn-ink:#93370D;--warn-soft:#FEF3E6;--warn-line:#FFE0A3;--bad:#D92D20;--bad-ink:#B42318;--bad-soft:#FEF2F2;--bad-line:#FECACA;--skeleton:#EDEFF3;--sh:0 1px 2px rgba(16,20,24,0.04);--sh2:0 1px 3px rgba(16,20,24,0.06);--nav-bg:#FFFFFF;--nav-line:#E6E9ED;--overlay:rgba(255,255,255,0.92);--pole-clair:0%;}',
      ':root[data-theme="dark"]{--page:#0A0A0B;--card:#141517;--tile:#1E2023;--line:#2A2D31;--line2:#33373C;--ink:#F2F3F5;--ink2:#D6D9DD;--muted:#9BA1A9;--faint:#8A9099;--accent-soft:#17233B;--lien:#5B9BFF;--accent-ink:#5B9BFF;--ok:#34D399;--ok-ink:#6EE7B7;--ok-soft:rgba(52,211,153,0.12);--ok-line:rgba(52,211,153,0.35);--warn:#FBBF24;--warn-ink:#FCD34D;--warn-soft:rgba(251,191,36,0.12);--warn-line:rgba(251,191,36,0.35);--bad:#FB7185;--bad-ink:#FDA4AF;--bad-soft:rgba(251,113,133,0.12);--bad-line:rgba(251,113,133,0.35);--skeleton:#1E2023;--sh:none;--sh2:0 6px 22px rgba(0,0,0,0.5);--nav-bg:#141517;--nav-line:rgba(255,255,255,0.10);--overlay:rgba(24,25,27,0.92);--pole-clair:55%;}',
      'html,body{height:100%;overflow:hidden;background:var(--page);font-family:var(--font-body);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;}',
      // Une seule police (Plus Jakarta Sans) : les boutons et champs l'héritent,
      // au lieu de la police système que les navigateurs leur imposent.
      'button,input,textarea,select{font-family:inherit;}',
      // Utilitaires typographiques réutilisés par les écrans de la refonte.
      '.kc-display{font-family:var(--font-display);letter-spacing:-0.01em;}',
      '.kc-mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums;}',
      '#root{height:100%;display:flex;flex-direction:column;overflow:hidden;}',
      '#mainContent{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}',
      '::-webkit-scrollbar{display:none;}',
      '*{scrollbar-width:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box;}',
      'button{-webkit-appearance:none;touch-action:manipulation;}',
      'input,textarea,select{-webkit-appearance:none;}',
      // Mode sombre : un champ sans couleur explicite gardait le fond blanc et le
      // texte noir du navigateur — illisible (ex. titre et lieu d'un événement).
      // Les styles en ligne, plus prioritaires, restent maîtres là où ils existent.
      'input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select{background-color:transparent;color:var(--ink);}',
      // Champ unique de l'app (styleChamp) : contour bleu au focus.
      '.kc-champ:focus{border-color:#0B5FE0 !important;}',
      '.kc-champ::placeholder{color:var(--faint);}',
      // Le zoom est désormais autorisé (accessibilité). iOS zoome automatiquement
      // sur tout champ dont le texte fait moins de 16px au moment de la saisie :
      // on garantit donc 16px minimum sur écran tactile pour éviter ce saut.
      '@media (pointer:coarse){input,textarea,select{font-size:max(16px,1em) !important;}}',
      '@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}',
      '@keyframes heartFloat{0%{transform:translate(-50%,-50%) scale(0);opacity:1}50%{transform:translate(-50%,-80%) scale(1.2);opacity:1}100%{transform:translate(-50%,-120%) scale(0.8);opacity:0}}',
      '@keyframes heartPop{0%{transform:scale(1)}30%{transform:scale(1.35)}60%{transform:scale(0.9)}100%{transform:scale(1)}}',
      '@keyframes spin{to{transform:rotate(360deg)}}',
      // Jauge de note du profil : l'arc se remplit depuis zéro à l'affichage.
      '@keyframes kcJauge{from{stroke-dashoffset:var(--kc-jauge-depart)}}',
      '.kc-jauge{animation:kcJauge 0.9s cubic-bezier(0.22,1,0.36,1) both;}',
      // Conditions d'utilisation : le reset global (margin/padding à 0) masquait les puces.
      // Lot 1 : cartes de l'accueil qui glissent en place, barre de progression
      // et rail de la visite qui coulissent, bouton Publier qui s'enfonce.
      '@keyframes kcApparait{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '.kc-apparait{animation:kcApparait 0.32s cubic-bezier(0.22,1,0.36,1) both;}',
      '.kc-progression{transition:width 0.5s cubic-bezier(0.22,1,0.36,1);}',
      '.kc-rail{transition:transform 0.35s cubic-bezier(0.22,1,0.36,1);}',
      '.kc-publier{transition:transform 0.12s ease;}button:active>.kc-publier{transform:scale(0.92);}',
      '@keyframes kcIcone{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:none}}',
      '.kc-visite-icone{animation:kcIcone 0.4s cubic-bezier(0.34,1.4,0.64,1) both;}',
      // Lot 2 : pointage (anneau de localisation, coche dessinée, points qui montent).
      '.kc-localise{animation:spin 0.9s linear infinite;}',
      '@keyframes kcCoche{from{stroke-dashoffset:40}to{stroke-dashoffset:0}}',
      '.kc-coche{stroke-dasharray:40;animation:kcCoche 0.45s 0.15s cubic-bezier(0.65,0,0.35,1) both;}',
      '@keyframes kcPoints{0%{opacity:0;transform:translateY(10px)}60%{opacity:1;transform:translateY(-4px)}100%{opacity:1;transform:none}}',
      '.kc-points{animation:kcPoints 0.6s 0.35s ease-out both;}',
      '@keyframes kcCarte{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:none}}',
      '.kc-pointage-carte{animation:kcCarte 0.25s cubic-bezier(0.34,1.4,0.64,1) both;}',
      '.kc-conditions p{margin:0 0 8px;}.kc-conditions ul{padding-left:20px;margin:4px 0 8px;}.kc-conditions li{margin:4px 0;}',
      // Balayage des cartes squelettes affichées pendant le chargement du fil.
      '@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}',
      // Respecte le réglage système « réduire les animations » (accessibilité,
      // et confort pour les personnes sensibles au mouvement).
      '@media (prefers-reduced-motion: reduce){*{animation-duration:0.01ms !important;animation-iteration-count:1 !important;}}',
      'article{transition:opacity 0.2s;}',
      'nav button:active>div{transform:scale(0.9);}',
    ].join('');
    document.head.appendChild(style);
  }

  // ============================================================
  // INIT
  // ============================================================
  // Le service worker sert les fichiers un par un. Si l'un d'eux reste en cache
  // dans une ancienne version alors que les autres sont à jour, une fonction
  // attendue par un fichier peut manquer dans l'autre — et l'application se
  // comporte de façon inexplicable. On vérifie donc que les briques essentielles
  // sont bien là avant de démarrer, et on recharge UNE fois en contournant le
  // cache si ce n'est pas le cas.
  var APP_VERSION = 'v168'; window.APP_VERSION = APP_VERSION; // Exposé pour l'écran Paramètres (ligne « Version »).
  // Nom du cache tenu par le service worker pour CETTE version. Doit rester
  // aligné sur CACHE_NAME dans sw.js.
  var CACHE_COURANT = 'kun-com-pwa-' + APP_VERSION;

  function verifierIntegrite() {
    // Synchronisation automatique des conteneurs PWA / Safari : à chaque nouvelle
    // version, les caches des versions PRÉCÉDENTES sont vidés.
    //
    // Attention : on ne touche surtout pas au cache de la version courante. Ce
    // code effaçait auparavant TOUS les caches, y compris celui que le service
    // worker venait de remplir en s'installant. Résultat : chaque déploiement
    // garantissait un démarrage lent, tout étant à retélécharger — et comme les
    // essais se font justement juste après une mise en ligne, les optimisations
    // de chargement paraissaient ne rien changer. Le service worker sait déjà
    // supprimer les anciens caches à son activation ; ceci n'est qu'un filet de
    // sécurité au cas où il ne serait pas actif.
    try {
      var savedVer = localStorage.getItem('kc_app_version');
      if (savedVer !== APP_VERSION) {
        localStorage.setItem('kc_app_version', APP_VERSION);
        if (window.caches && caches.keys) {
          caches.keys().then(function(cles){
            return Promise.all(cles
              .filter(function(c){ return c !== CACHE_COURANT; })
              .map(function(c){ return caches.delete(c); }));
          });
        }
      }
    } catch(e) {}

    var presence = {
      UI: typeof UI, ico: typeof ico,
      render: typeof render, renderApp: typeof renderApp, renderLogin: typeof renderLogin,
      App: (window && window.App) ? 'object' : 'undefined',
      mergeNotifications: typeof mergeNotifications,
      initAuthSession: typeof initAuthSession, applyAuthUser: typeof applyAuthUser,
      mergeProfilesWithLocal: typeof mergeProfilesWithLocal,
      mergePostsWithLocal: typeof mergePostsWithLocal,
      punctualityStars: typeof punctualityStars,
      isPinnedNow: typeof isPinnedNow,
      isEventLike: typeof isEventLike,
      getUserSections: typeof getUserSections,
      safeHtml: typeof safeHtml,
      demarrerBattementPresence: typeof demarrerBattementPresence,
      syncSupabaseToLocal: typeof syncSupabaseToLocal,
      tryOpenDeepLinkedPost: typeof tryOpenDeepLinkedPost,
      chargerCropper: typeof chargerCropper
    };
    var manquants = Object.keys(presence).filter(function(n){ return presence[n] === 'undefined'; });
    if (!manquants.length) return true;

    console.error('Fichiers incohérents, éléments manquants :', manquants.join(', '));
    var DEJA = 'kc_reload_integrite';
    try {
      if (sessionStorage.getItem(DEJA)) {
        console.error('Rechargement déjà tenté, on continue malgré tout.');
        return true;
      }
      sessionStorage.setItem(DEJA, '1');
    } catch(e) { return true; }

    if (window.caches && caches.keys) {
      caches.keys().then(function(cles){ return Promise.all(cles.map(function(c){ return caches.delete(c); })); })
        .then(function(){ location.reload(); }, function(){ location.reload(); });
    } else {
      location.reload();
    }
    return false;
  }

  async function init() {
    if (!verifierIntegrite()) return;
    try { injectCSS(); } catch(e) {}
    // Rendu protégé : une exception lancée par render() après un await laissait
    // sinon un écran blanc sans aucune récupération possible.
    function rendreProtege() {
      try { render(); } catch(eRender) {
        console.warn('[Bootstrap] Erreur de rendu:', eRender);
        try {
          var rootEl = document.getElementById('root');
          if (rootEl) rootEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:24px;text-align:center;font-family:-apple-system,sans-serif;"><p style="font-size:15px;font-weight:600;">Une erreur est survenue</p><button onclick="location.reload()" style="padding:10px 22px;border-radius:12px;border:none;background:#0B5FE0;color:#FFF;font-size:15px;font-weight:600;">Recharger</button></div>';
        } catch(e2) {}
      }
    }
    // L'authentification est désormais gouvernée par Supabase Auth : on attend la
    // restauration de session (ou son absence -> écran de connexion) AVANT le
    // premier rendu, sinon l'application s'afficherait brièvement à partir d'un
    // cache local sans session valide.
    try { await initAuthSession(); } catch(e) { console.warn("initAuthSession error:", e); }
    rendreProtege();
    try { syncSupabaseToLocal(); } catch(e) { console.warn("syncSupabaseToLocal init error:", e); }
    try { tryOpenDeepLinkedPost(); } catch(e){}
    // Notification touchée sur le téléphone : ouverture sur l'écran concerné,
    // depuis l'adresse (?kc=…, application fermée) ou par message du service
    // worker (application déjà ouverte).
    try {
      var kc = new URLSearchParams(location.search).get('kc');
      if (kc) {
        history.replaceState(null, '', location.pathname);
        if (S.user) App.ouvrirCible(kc);
      }
      if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function(ev) {
        if (ev.data && ev.data.type === 'kc-ouvrir' && S.user) App.ouvrirCible(ev.data.cible);
      });
    } catch(e) {}
    // Messages : relève régulière pour la pastille de la boîte de réception.
    try {
      var releverMessages = function() {
        if (!S.user || compteEnAttente(S.user) || document.hidden) return;
        // P2 : seulement les messages récents (5 min de marge), plus les 300 derniers.
        // La première relève est complète : elle retire aussi les messages supprimés.
        var dernier = releverMessages.faite ? db(SK.DMS, []).reduce(function(m, x){ return Math.max(m, (x && x.timestamp) || 0); }, 0) : 0;
        releverMessages.faite = true;
        var requete = (dernier && supabase) ? supabase.from('kun_com_dms').select('*')
          .gt('sent_at', new Date(dernier - 300000).toISOString()).order('sent_at', { ascending: false }).limit(300) : undefined;
        App._chargerMessages(requete).then(function(nouveau){ if (nouveau && !saisieEnCours()) render(); });
      };
      setTimeout(releverMessages, 3000);
      setInterval(releverMessages, 60000);
    } catch(e) {}
    // Visite guidée au premier lancement.
    try { proposerVisiteSiNouvelle(); } catch(e) {}
    // Présence : battement périodique tant que l'app est au premier plan.
    try { demarrerBattementPresence(); } catch(e) { console.warn('battement présence:', e); }
  }

  if (document.getElementById('root')) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

