// KUN COM VH — Partie 3/8 : Toast, icônes SVG, moteur de rendu (render + morphdom)

  'use strict';
  // TOAST — Non-bloquant, par injection DOM directe (pas re-render)
  // ============================================================
  function toast(msg, type) {
    type = type || 'success';
    if (S.toastTimer) clearTimeout(S.toastTimer);

    // Inject/update toast overlay without re-rendering the app
    var el = document.getElementById('_toast');
    if (!el) {
      el = document.createElement('div');
      el.id = '_toast';
      el.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-80px);z-index:9999999;max-width:360px;width:calc(100% - 32px);pointer-events:none;transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s;opacity:0;';
      document.body.appendChild(el);
    }

    var isErr = type === 'error';
    var isWarn = type === 'warning';
    var accent = isErr ? '#FF3B30' : isWarn ? '#FF9500' : '#34C759';
    var bgIcon = isErr ? '#FFF0EE' : isWarn ? '#FFF8EE' : '#EDFBF3';
    var icon = isErr
      ? '<path d="M18 6L6 18M6 6l12 12"/>'
      : '<path d="M20 6L9 17l-5-5"/>';

    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:13px 16px;border-radius:18px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 12px 40px rgba(0,0,0,0.18);">' +
      '<div style="width:28px;height:28px;border-radius:50%;background:' + bgIcon + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + accent + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg>' +
      '</div>' +
      '<span style="font-size:13.5px;font-weight:700;color:#1C1C1E;flex:1;line-height:1.3;">' + safeHtml(msg) + '</span>' +
    '</div>';

    requestAnimationFrame(function() {
      el.style.transform = 'translateX(-50%) translateY(0)';
      el.style.opacity = '1';
    });

    S.toastTimer = setTimeout(function() {
      el.style.transform = 'translateX(-50%) translateY(-80px)';
      el.style.opacity = '0';
    }, 2800);
  }

  // ============================================================
  // SVG ICONS
  // ============================================================
  var SVG = {
    heart: function(f, sz) {
      sz = sz || 24;
      var c = f ? '#FF2D55' : '#262626';
      return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="' + (f ? c : 'none') + '" stroke="' + c + '" stroke-width="' + (f ? '0' : '1.8') + '" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    },
    comment: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    share: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    link: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    eye: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    bookmark: function(saved) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (saved ? '#000' : 'none') + '" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    },
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    dots: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>',
    plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
    home: function(a) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (a?'2.1':'1.8') + '" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'; },
    cal: function(a) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (a?'2.1':'1.8') + '" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'; },
    star: function(a) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (a?'2.1':'1.8') + '" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'; },
    person: function(a) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (a?'2.1':'1.8') + '" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; }
  };

  // ============================================================
  // RENDER ENGINE
  // ============================================================
  function render() {
    var root = document.getElementById('root');
    if (!root) return;
    var prev = root.querySelector('#mainContent');
    var scrollTop = prev ? prev.scrollTop : 0;

    var html = '';
    try {
      if (S.auth === 'app' && (!S.user || !S.user.id)) {
        console.warn("Session non valide ou utilisateur manquant -> retour écran de connexion");
        S.auth = 'login';
        S.user = null;
      }

      if (S.auth === 'login') html = renderLogin();
      else if (S.auth === 'signup') html = renderSignup();
      else if (S.auth === 'forgot') html = renderForgot();
      else html = renderApp();
    } catch (err) {
      console.error("Critical render error caught, falling back to login:", err);
      S.auth = 'login';
      S.user = null;
      try {
        html = renderLogin();
      } catch(loginErr) {
        html = '<div style="padding:40px;text-align:center;font-family:sans-serif;">' +
                 '<h2>Une erreur est survenue</h2>' +
                 '<p style="color:#8E8E93;font-size:13px;">' + (err ? err.message : '') + '</p>' +
                 '<button onclick="localStorage.clear();location.reload();" style="margin-top:16px;padding:10px 20px;border-radius:10px;background:#007AFF;color:#FFF;border:none;font-weight:700;cursor:pointer;">Réinitialiser et recharger</button>' +
               '</div>';
      }
    }

    // Réconciliation DOM : on ne remplace plus tout le contenu à chaque appel
    // (root.innerHTML = html) mais on ne patch que ce qui a réellement changé, via
    // morphdom. Bénéfices concrets : une vidéo en cours de lecture n'est plus coupée
    // par le sondage périodique des publications (avant : tout le DOM était détruit et
    // recréé toutes les 20s), le focus/curseur des champs de saisie n'est plus perdu,
    // et on évite le travail de rendu inutile (moins de saccades, moins de mémoire).
    // Si morphdom n'est pas chargé (CDN indisponible) ou lève une erreur, on retombe
    // sur l'ancien comportement pour ne jamais bloquer l'application.
    if (typeof morphdom === 'function') {
      try {
        morphdom(root, '<div id="root">' + html + '</div>', {
          onBeforeElUpdated: function(fromEl) {
            // Sous-arbres gérés par une librairie externe qui injecte son propre DOM
            // (ex: Cropper.js) : ne jamais les re-générer / re-differ.
            if (fromEl.getAttribute && fromEl.getAttribute('data-no-morph') === 'true') return false;
            return true;
          }
        });
      } catch (morphErr) {
        console.warn('morphdom error, fallback complet:', morphErr);
        root.innerHTML = html;
      }
    } else {
      root.innerHTML = html;
    }

    // Restore scroll position (filet de sécurité — morphdom préserve déjà le scroll
    // dans la grande majorité des cas puisque le nœud #mainContent n'est pas recréé)
    var mc = root.querySelector('#mainContent');
    if (mc && scrollTop > 0 && mc.scrollTop !== scrollTop) mc.scrollTop = scrollTop;

    // Observe les publications visibles pour comptabiliser les vues
    try { setupViewTracking(); } catch(e){}

    // Secousse de la cloche à l'arrivée d'une notification.
    try { pulseNotifOnNew(); } catch(e){}
  }

  // Vibration courte à l'arrivée d'une notification. L'ANIMATION, elle, n'est
  // plus posée ici : morphdom réécrit l'attribut style à chaque rendu et coupait
  // la secousse en cours. Elle est désormais portée par le rendu lui-même
  // (voir renderNotifFab), donc elle survit aux rafraîchissements.
  var _notifBuzzAt = 0;
  function pulseNotifOnNew() {
    if (typeof S === 'undefined' || !S.notifShakeAt) return;
    if (S.notifShakeAt === _notifBuzzAt) return;   // déjà vibré pour celle-ci
    _notifBuzzAt = S.notifShakeAt;
    try { if (navigator.vibrate) navigator.vibrate(35); } catch(e){}
  }

