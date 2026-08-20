// KUN COM VH — Partie 8/8 : CSS global, initialisation, démarrage

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
      ':root{--font-display:\'Bricolage Grotesque\',system-ui,-apple-system,"Segoe UI",sans-serif;--font-body:\'Inter\',system-ui,-apple-system,"Segoe UI",sans-serif;--font-mono:\'JetBrains Mono\',ui-monospace,"SF Mono",Menlo,monospace;--page:#F5F6F8;--card:#FFFFFF;--tile:#EFF1F5;--line:#E4E7EC;--line2:#D6DBE3;--ink:#0C1116;--ink2:#2A313B;--muted:#5B6572;--faint:#8A93A0;--accent-soft:#E8EEFB;--accent-ink:#0B4FC4;--sh:0 1px 2px rgba(16,24,40,0.04);--sh2:0 4px 20px rgba(16,24,40,0.06);--nav-bg:rgba(255,255,255,0.96);--nav-line:rgba(0,0,0,0.10);--overlay:rgba(255,255,255,0.92);}',
      ':root[data-theme="dark"]{--page:#0A0A0B;--card:#141517;--tile:#1E2023;--line:#2A2D31;--line2:#33373C;--ink:#F2F3F5;--ink2:#D6D9DD;--muted:#9BA1A9;--faint:#6E747C;--accent-soft:#17233B;--accent-ink:#5B9BFF;--sh:none;--sh2:0 6px 22px rgba(0,0,0,0.5);--nav-bg:rgba(20,21,23,0.92);--nav-line:rgba(255,255,255,0.10);--overlay:rgba(24,25,27,0.92);}',
      'html,body{height:100%;overflow:hidden;background:var(--page);font-family:var(--font-body);}',
      // Utilitaires typographiques réutilisés par les écrans de la refonte.
      '.kc-display{font-family:var(--font-display);letter-spacing:-0.01em;}',
      '.kc-mono{font-family:var(--font-mono);font-variant-numeric:tabular-nums;}',
      '#root{height:100%;display:flex;flex-direction:column;overflow:hidden;}',
      '#mainContent{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}',
      '::-webkit-scrollbar{display:none;}',
      '*{scrollbar-width:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box;}',
      'button{-webkit-appearance:none;touch-action:manipulation;}',
      'input,textarea,select{-webkit-appearance:none;}',
      '@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}',
      '@keyframes heartFloat{0%{transform:translate(-50%,-50%) scale(0);opacity:1}50%{transform:translate(-50%,-80%) scale(1.2);opacity:1}100%{transform:translate(-50%,-120%) scale(0.8);opacity:0}}',
      '@keyframes heartPop{0%{transform:scale(1)}30%{transform:scale(1.35)}60%{transform:scale(0.9)}100%{transform:scale(1)}}',
      '@keyframes spin{to{transform:rotate(360deg)}}',
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
  var APP_VERSION = 'v130';
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
      isEventLike: typeof isEventLike
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
        .then(function(){ location.reload(true); }, function(){ location.reload(true); });
    } else {
      location.reload(true);
    }
    return false;
  }

  async function init() {
    if (!verifierIntegrite()) return;
    try { injectCSS(); } catch(e) {}
    // L'authentification est désormais gouvernée par Supabase Auth : on attend la
    // restauration de session (ou son absence -> écran de connexion) AVANT le
    // premier rendu, sinon l'application s'afficherait brièvement à partir d'un
    // cache local sans session valide.
    try { await initAuthSession(); } catch(e) { console.warn("initAuthSession error:", e); }
    render();
    try { syncSupabaseToLocal(); } catch(e) { console.warn("syncSupabaseToLocal init error:", e); }
    try { tryOpenDeepLinkedPost(); } catch(e){}
  }

  if (document.getElementById('root')) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

