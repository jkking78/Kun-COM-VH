// KUN COM VH — Partie 8/8 : CSS global, initialisation, démarrage

  'use strict';
  // ============================================================
  // CSS GLOBAL (injecté une seule fois)
  // ============================================================
  function injectCSS() {
    var style = document.createElement('style');
    style.textContent = [
      'html,body{height:100%;overflow:hidden;}',
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
  var APP_VERSION = 'v93';
  function verifierIntegrite() {
    // Synchronisation automatique des conteneurs PWA / Safari : dès qu'une nouvelle
    // version est déployée, les anciens caches de l'application installée sur l'écran
    // d'accueil sont vidés pour forcer l'alignement avec le serveur.
    try {
      var savedVer = localStorage.getItem('kc_app_version');
      if (savedVer !== APP_VERSION) {
        localStorage.setItem('kc_app_version', APP_VERSION);
        if (window.caches && caches.keys) {
          caches.keys().then(function(cles){
            return Promise.all(cles.map(function(c){ return caches.delete(c); }));
          });
        }
      }
    } catch(e) {}

    var presence = {
      UI: typeof UI, ico: typeof ico,
      render: typeof render, renderApp: typeof renderApp, renderLogin: typeof renderLogin,
      App: (window && window.App) ? 'object' : 'undefined',
      mergeNotifications: typeof mergeNotifications,
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

  function init() {
    if (!verifierIntegrite()) return;
    try { syncSupabaseToLocal(); } catch(e) { console.warn("syncSupabaseToLocal init error:", e); }
    try { injectCSS(); } catch(e) {}
    render();
    try { tryOpenDeepLinkedPost(); } catch(e){}
  }

  if (document.getElementById('root')) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

