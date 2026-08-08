// KUN COM VH — Partie 5/8 : App principale, fil d'actualité, cartes de publication, composeur

  'use strict';
  // ============================================================
  // MAIN APP
  // ============================================================
  function renderApp() {
    var u = S.user || {};
    var initial = (u.prenom || 'M').charAt(0).toUpperCase();
    var posts = db(SK.POSTS, []);

    // Filter posts
    var filtered = posts.slice().sort(function(a,b){
        var ap = isPinnedNow(a), bp = isPinnedNow(b);
        if (ap !== bp) return ap ? -1 : 1;
        return (b.timestamp||0)-(a.timestamp||0); 
      }).filter(function(p) {
        // Événement supprimé mais archivé pour préserver les étoiles déjà
        // attribuées (voir App.deletePost) : invisible dans le fil, comme une
        // suppression normale — seuls les calculs de ponctualité le retrouvent.
        if (p.type === 'EVENT_ARCHIVED') return false;

        // Scheduled post filter
        if (p.status === 'scheduled' && p.scheduled_at && p.scheduled_at > Date.now()) {
          if (u.role !== 'GRAND_RESPONSABLE' && p.userId !== u.id) return false;
        }

        // Privacy / Targeted sections filter
        if (p.visibility === 'sections' && Array.isArray(p.targetSections) && p.targetSections.length > 0) {
          if (u.role !== 'GRAND_RESPONSABLE' && p.userId !== u.id) {
            var mySecs = getUserSections(u);
            var hasAccess = p.targetSections.some(function(sec) { return mySecs.indexOf(sec) !== -1; });
            if (!hasAccess) return false;
          }
        }

        if (S.story !== 'all' && p.sectionId !== S.story) return false;
        // Filter expired ephemeral posts
        if (p.is_ephemeral && p.ephemeral_expiry && p.ephemeral_expiry < Date.now()) return false;
        if (S.q.trim()) {
          var q = S.q.toLowerCase();
          return (p.caption||'').toLowerCase().indexOf(q) !== -1 ||
                 (p.author||'').toLowerCase().indexOf(q) !== -1 ||
                 (p.sectionNom||'').toLowerCase().indexOf(q) !== -1 ||
                 (p.hashtags && p.hashtags.some(function(h){ return h.toLowerCase().indexOf(q) !== -1; }));
        }
        return true;
      });

    var content = '';
    if (S.tab === 'home')     content = renderHome(filtered, initial, u);
    else if (S.tab === 'planning') content = renderPlanning();
    else if (S.tab === 'debrief') content = renderDebrief(u);
    else if (S.tab === 'profile') content = renderProfile(u, posts);

    var modals = '';
    
  function renderUserProfileModal() {
    if (!S.viewUserProfileId) return '';
    var targetUser = db(SK.USERS, []).find(function(p){ return p.id === S.viewUserProfileId; });
    var posts = db(SK.POSTS, []);
    
    var content = '';
    if (S.loadingUserProfile) {
      content = '<div style="padding:100px 20px;text-align:center;"><div style="font-size:32px;animation:spin 1s linear infinite;">⏳</div><div style="margin-top:16px;font-size:14px;color:#8A93A0;">Chargement du profil...</div></div>';
    } else if (!targetUser) {
      content = '<div style="padding:100px 20px;text-align:center;"><div style="font-size:40px;">😕</div><div style="margin-top:16px;font-size:16px;font-weight:600;">Utilisateur introuvable</div><button onclick="App.closeUserProfile()" style="margin-top:20px;padding:10px 20px;background:#0B63F6;color:#FFF;border:none;border-radius:20px;font-weight:600;cursor:pointer;">Retour</button></div>';
    } else {
      content = renderProfile(targetUser, posts);
    }
    
    return '<div class="safe-top" style="position:fixed;inset:0;background:#FFF;z-index:9000;overflow-y:auto;animation:slideIn 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      content +
    '</div>';
  }
    if (S.viewUserProfileId) modals += renderUserProfileModal();


    if (S.notificationsOpen) modals += renderNotificationsModal(u);
    if (S.editProfileOpen) modals += renderEditProfileModal(u);
    if (S.postOptionsOpen) modals += renderPostOptionsModal(posts.find(function(p){return p.id===S.selectedPostId;}));
    if (S.createEventOpen) modals += renderCreateEventModal() + renderEventSaveChoice();
    if (S.editPostId) modals += renderEditPostModal();
    if (S.createOpen) modals += renderCreateModal(u);
    if (S.optionsOpen && S.optionsPost) modals += renderOptionsModal();
    if (S.commentOpen && S.commentPostId) modals += renderCommentsModal(posts, initial);
    if (S.cropperOpen) modals += renderCropperModal();
    if (S.membersListOpen) modals += renderMembersModal();
    if (S.repostPostId) modals += renderRepostModal();
    if (S.aboutEventPickerOpen) modals += renderAboutEventPickerModal();
    if (S.deleteAccountOpen) modals += renderDeleteAccountModal();
    if (S.bulkDeleteConfirmOpen) modals += renderBulkDeleteConfirmModal();
    if (S.viewersPostId) modals += renderViewersModal();
    if (S.adminGateOpen) modals += renderAdminGateModal();
    if (S.storageStatsOpen) modals += renderStorageStatsModal();
    if (S.dmOpen) modals += renderDirectMessageModal();
    if (S.assignManagerId) modals += renderAssignManagerModal();
    // En dernier : la visionneuse doit passer par-dessus toutes les autres fenêtres.
    if (S.viewerImage) modals += renderImageViewer();

    return '<div style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:' + UI.page + ';font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Text\',sans-serif;">' +
      // La réserve de bas de page suit la hauteur réelle de la barre de navigation,
      // indicateur d'accueil iPhone compris : sinon le dernier élément du fil reste
      // caché derrière elle et ne peut plus être atteint.
      '<div id="mainContent" style="flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;padding-bottom:calc(70px + env(safe-area-inset-bottom));">' + content + '</div>' +
      modals +
      renderNotifFab() +
      renderNav(initial) +
    '</div>';
  }

  function renderNav(initial) {
    // Seuls les Grands Responsables peuvent NOTER, mais l'onglet Notation reste
    // visible pour tout le monde : un membre doit pouvoir consulter l'historique
    // des bilans déjà publiés (le Suivi), même s'ils ont disparu du fil.
    // App.tab bascule automatiquement les autres profils sur cette vue lecture seule.
    function nb(id, iconFn, lbl) {
      var a = S.tab === id;
      return '<button onclick="App.tab(\'' + id + '\')" style="flex:1;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 2px 4px;-webkit-tap-highlight-color:transparent;color:' + (a ? UI.accent : '#98A1AC') + ';">' +
        iconFn(a) +
        '<span style="font-size:9.5px;font-weight:' + (a?'600':'400') + ';margin-top:3px;">' + lbl + '</span>' +
      '</button>';
    }
    // « safe-area-inset-bottom » n'est pas une propriété CSS : la ligne d'origine
    // ne faisait donc rien et la barre passait sous l'indicateur d'accueil iPhone.
    // On agrandit la barre de la hauteur réservée et on décale son contenu vers
    // le haut d'autant, pour que les onglets restent entièrement touchables.
    return '<nav style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;height:calc(62px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:rgba(255,255,255,0.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-top:0.5px solid rgba(0,0,0,0.12);display:flex;align-items:stretch;z-index:9000;">' +
      nb('home', SVG.home, 'Accueil') +
      nb('planning', SVG.cal, 'Planning') +
      '<button onclick="App.openCreate()" style="flex:1;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;">' +
        '<div style="width:46px;height:46px;border-radius:23px;background:#0B63F6;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,122,255,0.4);margin-bottom:8px;">' + SVG.plus + '</div>' +
      '</button>' +
      nb('debrief', SVG.star, 'Notation') +
      nb('profile', SVG.person, 'Profil') +
    '</nav>';
  }

  // Bouton flottant des notifications, posé au-dessus de la barre du bas et à
  // droite. Il suit l'utilisateur sur TOUS les onglets, alors que la cloche
  // n'existait que sur l'Accueil : une notification reçue pendant qu'on
  // consultait le Planning n'était signalée nulle part.
  // Compte des non-lus au rendu précédent. Reste à null tant qu'aucune session
  // n'est ouverte : sinon la bascule « pas connecté (0) » -> « connecté (N) »
  // passerait pour une arrivée de notifications et la cloche s'agiterait à
  // chaque ouverture de l'application.
  var _notifSeen = null;

  function renderNotifFab() {
    if (!S.user || S.auth !== 'app') { _notifSeen = null; return ''; }
    var notifs = Array.isArray(S.user.notifications) ? S.user.notifications : [];
    var nonLus = notifs.filter(function(n){ return !n.read; }).length;

    // La secousse est déclenchée ICI, et sa durée est portée par l'état plutôt
    // que posée sur le nœud après coup : morphdom réécrit l'attribut style à
    // chaque rendu et effaçait l'animation en cours au premier rafraîchissement.
    if (_notifSeen !== null && nonLus > _notifSeen) S.notifShakeAt = Date.now();
    _notifSeen = nonLus;
    var secoue = S.notifShakeAt && (Date.now() - S.notifShakeAt) < 1500;

    return '<button id="notifFab" onclick="App.openNotifications()" aria-label="Notifications' + (nonLus ? ' (' + nonLus + ' non lues)' : '') + '" ' +
      'style="position:fixed;right:16px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:8999;' +
      'width:52px;height:52px;border-radius:' + UI.pill + ';border:none;cursor:pointer;padding:0;' +
      'background:' + UI.card + ';box-shadow:0 4px 16px rgba(23,43,77,0.18);' +
      'display:flex;align-items:center;justify-content:center;touch-action:manipulation;">' +
      '<span id="notifFabIcon" style="display:flex;transform-origin:50% 15%;' + (secoue ? 'animation:notifShake 0.7s cubic-bezier(0.36,0.07,0.19,0.97) 2;' : '') + '">' +
        '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="' + (nonLus ? UI.accent : UI.muted) + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' +
        '</svg>' +
      '</span>' +
      (nonLus > 0
        ? '<span style="position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 5px;border-radius:' + UI.pill + ';background:' + UI.bad + ';color:#FFF;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid ' + UI.card + ';">' + (nonLus > 99 ? '99+' : nonLus) + '</span>'
        : '') +
    '</button>';
  }

  // ============================================================
  // HOME TAB
  // ============================================================
  
  function renderScreenHeader(title, subtitle, rightActionHtml) {
    var u = S.user || {};
    var initial = (u.prenom || 'M').charAt(0).toUpperCase();
    // Un seul niveau de titre, sans sur-titre en capitales : la hiérarchie vient
    // de la taille et du poids, pas de l'empilement de libellés colorés.
    return '<header style="position:sticky;top:0;z-index:200;background:' + UI.card + ';border-bottom:0.5px solid ' + UI.line + ';padding:14px 16px 12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
        '<h1 style="font-size:19px;font-weight:600;color:' + UI.ink + ';margin:0;letter-spacing:-0.3px;min-width:0;">' + title + '</h1>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">' +
          (rightActionHtml || '') +
          (u.avatar_url
            ? '<button onclick="App.tab(\'profile\')" style="width:30px;height:30px;border-radius:' + UI.pill + ';border:none;cursor:pointer;padding:0;overflow:hidden;flex-shrink:0;"><img src="' + u.avatar_url + '" style="width:100%;height:100%;object-fit:cover;" /></button>'
            : '<button onclick="App.tab(\'profile\')" style="width:30px;height:30px;border-radius:' + UI.pill + ';background:' + (u.avatar_color||UI.accent) + ';border:none;cursor:pointer;color:#FFF;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;">' + initial + '</button>') +
        '</div>' +
      '</div>' +
    '</header>';
  }

  function renderHome(filtered, initial, u) {
    var trends = trendingTags();

    // 44 px : c'est la taille de cible tactile minimale recommandée par Apple.
    // À 34 px et 6 px d'écart, comme auparavant, on visait la cloche et on
    // touchait le « + » — d'autant que ces boutons n'ont plus de fond visible,
    // donc rien n'indique où commence la zone sensible.
    var iconBtn = function(action, svg, badgeCount) {
      return '<button onclick="' + action + '" style="position:relative;width:44px;height:44px;border-radius:' + UI.pill + ';background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;touch-action:manipulation;-webkit-tap-highlight-color:rgba(0,0,0,0.06);">' +
        svg +
        (badgeCount > 0 ? '<span style="position:absolute;top:7px;right:8px;width:8px;height:8px;border-radius:50%;background:' + UI.accent + ';border:1.5px solid ' + UI.card + ';"></span>' : '') +
      '</button>';
    };

    var header = '<header style="position:sticky;top:0;z-index:200;background:' + UI.card + ';border-bottom:0.5px solid ' + UI.line + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px;">' +
        '<h1 style="font-size:19px;font-weight:600;color:' + UI.ink + ';margin:0;letter-spacing:-0.3px;min-width:0;">Commit</h1>' +
        '<div style="display:flex;gap:2px;align-items:center;flex-shrink:0;margin-right:-8px;">' +
          iconBtn('App.openCreate()', '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>', 0) +
          '<button onclick="App.tab(\'profile\')" style="width:44px;height:44px;border-radius:' + UI.pill + ';background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation;">' +
            (u.avatar_url
              ? '<img src="' + u.avatar_url + '" style="width:32px;height:32px;border-radius:' + UI.pill + ';object-fit:cover;" />'
              : '<span style="width:32px;height:32px;border-radius:' + UI.pill + ';background:' + UI.accent + ';color:#FFF;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;">' + initial + '</span>') +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div style="padding:0 16px 12px;">' +
        '<div style="display:flex;align-items:center;gap:8px;background:' + UI.tile + ';border-radius:' + UI.r1 + ';height:38px;padding:0 12px;">' +
          ico('search', 16, UI.faint) +
          '<input id="searchInput" type="search" value="' + safeHtml(S.q) + '" oninput="App.search(this.value)" onfocus="App.setSearchFocused(true)" onblur="App.setSearchFocused(false)" placeholder="Rechercher" style="flex:1;border:none;background:transparent;font-size:13.5px;color:' + UI.ink + ';outline:none;">' +
          (S.q ? '<button onclick="App.search(\'\')" style="background:none;border:none;cursor:pointer;color:' + UI.faint + ';font-size:17px;line-height:1;padding:0;">×</button>' : '') +
        '</div>' +
        (S.searchFocused ? '<div style="padding-top:8px;">' +
          '<div onmousedown="event.preventDefault();App.openMembersList();" style="display:flex;align-items:center;gap:10px;background:' + UI.accentSoft + ';border-radius:' + UI.r1 + ';padding:11px 12px;cursor:pointer;">' +
            ico('users', 18, UI.accent) +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:13px;font-weight:600;color:' + UI.accentInk + ';">Voir tous les membres</div>' +
              '<div style="font-size:11.5px;color:' + UI.muted + ';">' + profilsUniquesParEmail(db(SK.USERS, [])).length + ' membre(s) du département</div>' +
            '</div>' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + UI.accent + '" stroke-width="2.2"><path d="M9 18l6-6-6-6"/></svg>' +
          '</div>' +
        '</div>' : '') +
      '</div>' +
    '</header>';

    // Tendances
    var trendsHtml = '';
    if (trends.length > 0) {
      trendsHtml = '<div style="background:' + UI.card + ';border-bottom:0.5px solid ' + UI.line + ';padding:9px 16px;">' +
        '<div style="display:flex;gap:7px;overflow-x:auto;align-items:center;-webkit-overflow-scrolling:touch;">' +
        '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:' + UI.faint + ';white-space:nowrap;flex-shrink:0;">' + ico('flame', 13, UI.faint) + 'Tendances</span>' +
        trends.map(function(t) {
          var active = S.q.toLowerCase() === t.toLowerCase();
          return '<button onclick="App.filterTag(\'' + encodeURIComponent(t) + '\')" style="flex-shrink:0;background:' + (active ? UI.accent : UI.tile) + ';color:' + (active ? '#FFF' : UI.muted) + ';border:none;padding:5px 12px;border-radius:' + UI.pill + ';font-size:12px;font-weight:500;cursor:pointer;">' + t + '</button>';
        }).join('') +
        '</div></div>';
    }

    // Pôles — les emoji sont conservés ici : ils portent l'identité de chaque
    // équipe. L'anneau coloré remplace l'ancien fond dégradé.
    var sectionSeen = db(SK.SECTION_SEEN, {});
    var allPostsForCount = db(SK.POSTS, []);
    var stories = '<div style="background:' + UI.card + ';border-bottom:0.5px solid ' + UI.line + ';padding:2px 0 12px;">' +
      '<div style="display:flex;gap:2px;padding:10px 12px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;">' +
      [{ id:'all', nom:'Tous', emoji:'✨' }].concat(SECTIONS).map(function(s) {
        var sel = S.story === s.id;
        var sc = secColor(s.id) || UI.accent;
        var lastSeen = s.id === 'all' ? null : (sectionSeen[s.id] || 0);
        var cnt = lastSeen === null ? 0 : allPostsForCount.filter(function(p){ return p.sectionId === s.id && (p.timestamp||0) > lastSeen; }).length;
        return '<div onclick="App.story(\'' + s.id + '\')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;min-width:64px;gap:6px;flex-shrink:0;">' +
          '<div style="position:relative;width:54px;height:54px;">' +
            '<div style="width:54px;height:54px;border-radius:50%;background:' + (sel ? sc + '1A' : UI.tile) + ';border:1.5px solid ' + (sel ? sc : 'transparent') + ';display:flex;align-items:center;justify-content:center;font-size:22px;transition:all 0.2s;">' +
              s.emoji +
            '</div>' +
            (cnt > 0 ? '<div style="position:absolute;top:-2px;right:-2px;z-index:2;background:' + UI.accent + ';color:#FFF;font-size:10px;font-weight:600;min-width:18px;height:18px;border-radius:' + UI.pill + ';display:flex;align-items:center;justify-content:center;padding:0 5px;box-shadow:0 0 0 2px #FFF;">' + (cnt > 99 ? '99+' : cnt) + '</div>' : '') +
          '</div>' +
          '<span style="font-size:11px;font-weight:' + (sel?'600':'400') + ';color:' + (sel ? UI.ink : UI.muted) + ';text-align:center;white-space:nowrap;">' + s.nom + '</span>' +
        '</div>';
      }).join('') +
      '</div></div>';

    // Feed
    var feed = '';
    var allLocalPosts = db(SK.POSTS, []);
    // La roue de chargement ne doit apparaître que si on n'a RIEN à montrer.
    // Avant : elle se déclenchait sur S.initialLoading seul, donc à CHAQUE
    // réouverture de l'app — même avec un cache local plein de publications
    // déjà prêtes à s'afficher — l'utilisateur attendait la synchronisation
    // réseau (jusqu'à 2,5 s, plus si le réseau est lent) devant un écran vide
    // avant de voir son propre fil. C'est le bug « ça charge trop longtemps ».
    // Désormais : s'il existe déjà des publications en cache, on les affiche
    // tout de suite et la synchronisation se termine silencieusement derrière.
    // Le second cas (déjà présent avant) couvre une incohérence transitoire
    // distincte : des publications existent dans le cache global mais le filtre
    // du fil "Tous" les exclut toutes (ex. juste après une fusion) — il exige
    // explicitement allLocalPosts.length > 0 et reste donc sans effet quand le
    // cache est simplement vide pour de bon (voir « Aucune publication » ci-dessous).
    // S.initialLoading passe à false après 2,5 s même si le réseau est encore lent
    // (c'est voulu : ça ne débloque QUE l'écran plein écran). Sur un appareil sans
    // rien en cache, ça faisait passer un « toujours en train de charger » pour un
    // « fil vide pour de bon » avant même que la vraie réponse réseau soit arrivée —
    // vécu sur le terrain (réseau mobile) : la publication finissait par apparaître
    // seule, quelques secondes plus tard, comme si le fil s'était « réparé tout
    // seul ». S.syncEnCours reste vrai tant que la synchronisation n'est pas
    // RÉELLEMENT terminée (voir syncSupabaseToLocal) — c'est lui qui tranche ici.
    var isActuallySyncing = ((S.initialLoading || S.syncEnCours) && allLocalPosts.length === 0) ||
      (allLocalPosts.length > 0 && filtered.length === 0 && !S.q && S.story === 'all');

    if (isActuallySyncing && !S.q && S.story === 'all') {
      // Chargement initial ou synchronisation en cours : on évite d'afficher un faux
      // "Aucune publication" passager qui clignoterait avant l'arrivée des posts.
      feed = '<div style="display:flex;justify-content:center;padding:48px 24px;">' +
        '<div style="width:26px;height:26px;border:2.5px solid #E4E7EC;border-top-color:#0B63F6;border-radius:50%;animation:spin 0.7s linear infinite;"></div>' +
      '</div>';
    } else if (filtered.length === 0) {
      feed = '<div style="display:flex;flex-direction:column;align-items:center;padding:70px 24px;text-align:center;">' +
        '<div style="font-size:52px;margin-bottom:16px;">📭</div>' +
        '<h3 style="font-size:18px;font-weight:800;color:#000;margin:0 0 8px;">' + (S.q ? 'Aucun résultat' : 'Aucune publication') + '</h3>' +
        '<p style="font-size:13.5px;color:#8A93A0;margin:0 0 22px;max-width:240px;line-height:1.5;">' +
          (S.q ? 'Aucun résultat trouvé pour "' + safeHtml(S.q) + '"' : 'Aucune publication pour le moment. Soyez le premier à publier ! ') +
        '</p>' +
        (S.q
          ? '<button onclick="App.search(\'\')" style="' + btnStyle('#0B63F6') + 'height:44px;width:auto;padding:0 22px;font-size:14px;">Réinitialiser la recherche</button>'
          : '<button onclick="App.openCreate()" style="' + btnStyle('#0B63F6') + 'height:44px;width:auto;padding:0 22px;font-size:14px;">Créer un post</button>') +
      '</div>';
    } else {
      // "Charger plus" ne s'applique qu'au fil principal non filtré (pagination
      // côté serveur) — avec une recherche ou une section active, on a déjà tout
      // ce qui est en cache local sous les yeux.
      var canLoadMore = S.story === 'all' && !S.q && !S.postsAllLoaded;
      var footerHtml;
      if (canLoadMore) {
        footerHtml = '<div style="padding:20px;text-align:center;background:#FFF;margin-top:8px;">' +
          (S.loadingMorePosts
            ? '<div style="display:flex;justify-content:center;padding:10px;"><div style="width:22px;height:22px;border:2.5px solid #E4E7EC;border-top-color:#0B63F6;border-radius:50%;animation:spin 0.7s linear infinite;"></div></div>'
            : '<button onclick="App.loadMorePosts()" style="background:#F6F7F9;color:#000;border:none;border-radius:14px;padding:12px 22px;font-size:13.5px;font-weight:800;cursor:pointer;">Charger plus d\'anciennes publications</button>') +
        '</div>';
      } else {
        footerHtml = '<div style="padding:36px 20px;text-align:center;background:#FFF;margin-top:8px;">' +
          '<div style="width:40px;height:40px;border-radius:20px;background:#E8EEFB;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">' + SVG.check + '</div>' +
          '<h4 style="font-size:15px;font-weight:800;color:#000;margin:0;">Vous êtes à jour ✓</h4>' +
          '<p style="font-size:12.5px;color:#8A93A0;margin:4px 0 0;">Toutes les publications ont été affichées.</p>' +
        '</div>';
      }
      // Les événements d'une même journée sont fusionnés en un carrousel unique ;
      // une journée à un seul événement garde exactement la carte habituelle.
      // À partir de DEUX épinglés, on les sort du flux pour les regrouper dans
      // un bloc repliable en tête. En dessous, rien ne change : une seule carte
      // épinglée ne gêne personne et mérite sa mise en avant pleine largeur.
      var epingles = filtered.filter(function(p){ return isPinnedNow(p); });
      var regroupe = epingles.length >= 2;
      var reste = regroupe ? filtered.filter(function(p){ return !isPinnedNow(p); }) : filtered;

      feed = (regroupe ? renderPinnedStack(epingles) : '') +
        groupSameDayEvents(reste).map(function(item) {
          if (item.kind === 'post') return renderPostCard(item.post);
          if (item.events.length === 1) return renderPostCard(item.events[0]);
          return renderEventGroupCard(item.date, item.events);
        }).join('') + footerHtml;
    }

    return header + trendsHtml + stories + feed;
  }

  // ============================================================
  // POST CARD — Style Instagram complet
  // ============================================================
  // Corps visuel d'un événement (pastille de date, titre, horaires, lieu, équipe,
  // image éventuelle). Extrait dans sa propre fonction pour être réutilisé tel quel
  // par la carte du fil, le carrousel des journées à plusieurs événements et le
  // Planning — un seul endroit à faire évoluer.
  function renderEventCardInner(post) {
    var evDate = post.eventDate ? new Date(post.eventDate + 'T00:00:00') : null;
    var evMonth = evDate ? evDate.toLocaleDateString('fr-FR', {month:'short'}).toUpperCase() : '';
    var evDay = evDate ? evDate.getDate() : '';
    // Pôles concernés, en pastilles discrètes plutôt qu'en texte violet brut.
    var evSections = (post.eventSections || []).slice(0, 3).map(function(s) {
      return '<span style="font-size:10.5px;color:#CBD9D3;background:' + UI.evTag + ';padding:3px 9px;border-radius:' + UI.pill + ';white-space:nowrap;">' + safeHtml(secNom(s)) + '</span>';
    }).join('');
    var evMore = (post.eventSections || []).length > 3
      ? '<span style="font-size:10.5px;color:' + UI.evMuted + ';padding:3px 4px;">+' + ((post.eventSections || []).length - 3) + '</span>'
      : '';

    // Statut calculé sur de vrais horodatages (et non sur une comparaison de
    // chaînes « HH:MM », qui classait à tort une veillée passant minuit).
    var nowTs = Date.now();
    var startTs = eventStartTimestamp(post);
    var endTs = eventEndTimestamp(post);
    var badge = function(txt, bg, col) {
      return '<span style="background:' + bg + ';color:' + col + ';padding:2px 9px;border-radius:' + UI.pill + ';font-size:10px;white-space:nowrap;font-weight:600;">' + txt + '</span>';
    };
    var evStatus;
    if (endTs && endTs < nowTs)                            evStatus = badge('Terminé', UI.evTag, UI.evMuted);
    else if (startTs && startTs <= nowTs)                  evStatus = badge('En cours', UI.evGold, UI.evBg);
    else                                                   evStatus = badge('À venir', UI.evGoldSoft, UI.evGold);

    // L'affiche de l'événement s'ouvre en grand : c'est souvent là que se
    // trouvent les détails (horaires, lieu) écrits dans le visuel lui-même.
    var evImage = post.eventImage
      ? '<img src="' + post.eventImage + '" loading="lazy" onclick="event.stopPropagation();App.openImageViewer(\'' + post.eventImage + '\')" style="display:block;width:100%;height:auto;max-height:240px;object-fit:cover;border-radius:' + UI.r1 + ';margin-bottom:14px;background:#000;cursor:pointer;" />'
      : '';

    // Vert profond + or : identité réservée aux événements, pour qu'ils se
    // repèrent instantanément au milieu des publications ordinaires.
    return '<div style="padding:16px;background:' + UI.evBg + ';border-radius:' + UI.r2 + ';">' +
      evImage +
      '<div style="display:flex;gap:13px;align-items:flex-start;">' +
        (evDate ? '<div style="width:48px;flex-shrink:0;background:' + UI.evGoldSoft + ';border:0.5px solid ' + UI.evGoldLine + ';border-radius:' + UI.r1 + ';text-align:center;padding:6px 0;">' +
          '<div style="font-size:9.5px;color:' + UI.evGold + ';letter-spacing:0.8px;">' + evMonth + '</div>' +
          '<div style="font-size:20px;font-weight:600;color:' + UI.evInk + ';line-height:1.15;">' + evDay + '</div>' +
        '</div>' : '') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;">' +
            '<h3 style="font-size:15px;font-weight:600;color:' + UI.evInk + ';margin:0;flex:1;min-width:0;">' + safeHtml(post.eventTitle) + '</h3>' +
            evStatus +
          '</div>' +
          '<div style="font-size:12px;color:' + UI.evMuted + ';display:flex;flex-wrap:wrap;gap:12px;margin-bottom:' + (evSections ? '11px' : '0') + ';">' +
            (post.eventStart ? '<span>' + ico('clock', 13, UI.evMuted) + ' ' + post.eventStart + (post.eventEnd ? ' – ' + post.eventEnd : '') + (crossesMidnight(post) ? ' +1 j' : '') + '</span>' : '') +
            (post.eventLocation ? '<span style="min-width:0;">' + ico('pin', 13, UI.evMuted) + ' ' + safeHtml(post.eventLocation) + '</span>' : '') +
          '</div>' +
          (evSections ? '<div style="display:flex;flex-wrap:wrap;gap:5px;">' + evSections + evMore + '</div>' : '') +
          (post.assignments && post.assignments.length > 0 ?
            '<div style="margin-top:13px;border-top:0.5px solid rgba(255,255,255,0.10);padding-top:11px;">' +
              '<div style="font-size:10px;color:' + UI.evGold + ';letter-spacing:0.8px;margin-bottom:8px;">ÉQUIPE ASSIGNÉE</div>' +
              '<div style="display:flex;flex-direction:column;gap:6px;">' +
              post.assignments.map(function(a) {
                var isMeAssigned = S.user && S.user.id === a.userId;
                return '<div style="background:' + (isMeAssigned ? UI.evGoldSoft : 'rgba(255,255,255,0.05)') + ';border:0.5px solid ' + (isMeAssigned ? UI.evGoldLine : 'transparent') + ';border-radius:' + UI.r1 + ';padding:8px 11px;">' +
                  '<div style="font-size:12.5px;font-weight:600;color:' + (isMeAssigned ? UI.evGold : UI.evInk) + ';">' + safeHtml(a.userName) + (isMeAssigned ? ' · vous' : '') + '</div>' +
                  '<div style="font-size:12px;color:' + UI.evMuted + ';margin-top:1px;">' + safeHtml(a.task) + '</div>' +
                '</div>';
              }).join('') +
              '</div>' +
            '</div>'
          : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Regroupe les événements partageant la même date : ils s'affichent alors dans un
  // seul carrousel plutôt qu'en cartes successives. Le groupe prend la place du
  // premier événement rencontré, et les événements y sont ordonnés par heure de
  // début croissante (de la première à la dernière de la journée).
  function groupSameDayEvents(list) {
    var out = [];
    var indexByDate = {};
    (list || []).forEach(function(p) {
      var isEvent = p && p.type === 'EVENT' && p.eventTitle && p.eventDate;
      if (!isEvent) { out.push({ kind: 'post', post: p }); return; }
      if (indexByDate[p.eventDate] === undefined) {
        indexByDate[p.eventDate] = out.length;
        out.push({ kind: 'eventGroup', date: p.eventDate, events: [p] });
      } else {
        out[indexByDate[p.eventDate]].events.push(p);
      }
    });
    out.forEach(function(item) {
      if (item.kind !== 'eventGroup') return;
      item.events.sort(function(a, b) {
        return String(a.eventStart || '').localeCompare(String(b.eventStart || ''));
      });
    });
    return out;
  }

  // Carrousel horizontal des événements d'une même journée.
  function renderEventGroupCard(dateIso, events) {
    var d = new Date(dateIso + 'T00:00:00');
    var dateLabel = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    var carId = 'evgrp-' + dateIso.replace(/-/g, '');
    var curIdx = S.eventGroupIdx && S.eventGroupIdx[dateIso] ? S.eventGroupIdx[dateIso] : 0;
    var anyPinned = events.some(function(e){ return isPinnedNow(e); });

    return '<article style="background:' + UI.card + ';border-radius:' + UI.r2 + ';box-shadow:' + UI.sh2 + ';margin:0 12px 12px;overflow:hidden;">' +
      (anyPinned ? '<div style="background:#0B63F6;color:#FFF;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;display:flex;align-items:center;gap:6px;"><span style="font-size:12px;">📌</span> ÉPINGLÉ</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:15px;font-weight:900;color:#0B0D12;text-transform:capitalize;">' + safeHtml(dateLabel) + '</div>' +
          '<div style="font-size:12px;color:#8A93A0;font-weight:600;margin-top:2px;">' + events.length + ' événements · faites défiler</div>' +
        '</div>' +
        '<div id="evgrpBadge-' + carId + '" style="background:#E8EEFB;color:#0B63F6;font-size:12px;font-weight:800;padding:4px 10px;border-radius:20px;flex-shrink:0;">' + (curIdx + 1) + '/' + events.length + '</div>' +
      '</div>' +
      '<div id="' + carId + '" onscroll="App.eventGroupScroll(\'' + dateIso + '\',\'' + carId + '\',this)" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0;">' +
        events.map(function(ev) {
          // La carte entière ouvre l'événement dans le Planning, à la bonne date :
          // sans cela il fallait quitter le fil et le retrouver à la main.
          return '<div style="flex:0 0 100%;scroll-snap-align:start;padding:0 16px 4px;box-sizing:border-box;">' +
            '<div style="position:relative;">' +
              '<div onclick="App.goToEvent(\'' + ev.id + '\')" style="cursor:pointer;">' + renderEventCardInner(ev) + '</div>' +
              '<button onclick="event.stopPropagation();App.openOptions(\'' + ev.id + '\')" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.92);border:none;width:30px;height:30px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.08);">' + SVG.dots + '</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div id="evgrpDots-' + carId + '" style="display:flex;justify-content:center;gap:5px;padding:8px 0 12px;">' +
        events.map(function(_, di) {
          var a = di === curIdx;
          return '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B63F6':'#E4E7EC') + ';transition:all 0.25s;"></div>';
        }).join('') +
      '</div>' +
    '</article>';
  }

  // Bloc visuel d'UNE section évaluée (utilisé seul ou dans le carrousel).
  function renderEvaluationSlide(ev) {
    var score = ev.globalScore;
    var badgeBg = score>=4 ? '#0E9F6E' : score>=2 ? '#D98A0B' : '#E2445C';
    var badgeShadow = score>=4 ? 'rgba(34,197,94,0.3)' : score>=2 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
    var crit = ev.criteria || {};
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div>' +
          '<div style="display:inline-flex;align-items:center;gap:4px;background:#FFF;padding:4px 8px;border-radius:8px;font-size:10px;font-weight:800;color:#8A93A0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><span>📊</span> Évaluation</div>' +
          '<div style="font-size:20px;font-weight:900;color:#0B0D12;letter-spacing:-0.5px;">' + (ev.emoji ? ev.emoji + ' ' : '') + safeHtml(ev.teamName || '') + '</div>' +
        '</div>' +
        '<div style="background:' + badgeBg + ';color:#FFF;padding:12px 16px;border-radius:16px;font-size:24px;font-weight:900;box-shadow:0 6px 16px ' + badgeShadow + ';text-shadow:0 2px 4px rgba(0,0,0,0.1);white-space:nowrap;">' + score + '/5</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px;">' +
        Object.keys(crit).map(function(k) {
          var v = crit[k];
          var pct = (v/5)*100;
          var cCol = v>=4?'#0E9F6E':v>=2?'#D98A0B':'#E2445C';
          return '<div style="display:flex;flex-direction:column;gap:6px;">' +
                   '<div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;color:#5A6472;"><span>' + safeHtml(k) + '</span><span style="color:#0B0D12;">' + v + '/5</span></div>' +
                   '<div style="height:10px;background:#E4E7EC;border-radius:5px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.06);">' +
                     '<div style="height:100%;width:' + pct + '%;background:' + cCol + ';border-radius:5px;box-shadow:0 1px 2px rgba(0,0,0,0.1);"></div>' +
                   '</div>' +
                 '</div>';
        }).join('') +
      '</div>' +
      // Détail de la ponctualité automatique : qui est arrivé quand, et ce que
      // chacun a apporté au total du pôle.
      (ev.punctuality && ev.punctuality.details && ev.punctuality.details.length
        ? '<div style="margin-top:16px;padding-top:14px;border-top:1px dashed #CBD5E1;">' +
            '<div style="font-size:10.5px;font-weight:800;color:#8A93A0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Ponctualité — calcul automatique</div>' +
            ev.punctuality.details.map(function(d) {
              var dc = d.stars >= 4 ? '#0E9F6E' : d.stars >= 2 ? '#D98A0B' : '#E2445C';
              var when = d.absent ? 'aucune publication' : (d.delayMinutes <= 0 ? "à l'heure" : '+' + d.delayMinutes + ' min');
              var geoNote = '';
              if (!d.absent) {
                if (!d.geo || !d.geo.available) geoNote = '<span style="display:block;font-size:10.5px;color:#B42318;font-weight:700;">' + geoStatusLabel(d.geo) + '</span>';
                else if (d.distance === null || d.distance === undefined) geoNote = '';
                else if (d.onSite) geoNote = '<span style="display:block;font-size:10.5px;color:#047857;">sur place (' + formatDistance(d.distance) + ')</span>';
                else geoNote = '<span style="display:block;font-size:10.5px;color:#B42318;font-weight:700;">à ' + formatDistance(d.distance) + ' du lieu</span>';
              }
              return '<div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:12px;padding:3px 0;gap:10px;">' +
                '<span style="color:#5A6472;min-width:0;">' + safeHtml(d.name) + (d.task ? ' <span style="color:#8A93A0;">· ' + safeHtml(d.task) + '</span>' : '') + geoNote + '</span>' +
                '<span style="font-weight:800;color:' + dc + ';white-space:nowrap;">' + (d.stars>0?'+':'') + d.stars + '★ · ' + when + '</span>' +
              '</div>';
            }).join('') +
            '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:800;color:#0B0D12;padding-top:8px;margin-top:6px;border-top:1px solid #E4E7EC;">' +
              '<span>Total du pôle (' + ev.punctuality.count + ' membre' + (ev.punctuality.count>1?'s':'') + ')</span>' +
              '<span>' + ev.punctuality.average + '/5</span>' +
            '</div>' +
          '</div>'
        : '') +
      (ev.comment ? '<p style="font-size:13px;color:#25303F;margin:14px 0 0;line-height:1.4;">' + safeHtml(ev.comment) + '</p>' : '');
  }

  // Publication d'évaluation. Plusieurs sections évaluées = un carrousel horizontal
  // dans UNE seule publication (au lieu d'une publication distincte par section).
  function renderEvaluationContent(post) {
    var meta = post.metadata || {};
    var evBadge = meta.eventTitle
      ? '<div style="font-size:12.5px;font-weight:800;color:#0B63F6;background:rgba(88,86,214,0.08);padding:6px 12px;border-radius:10px;margin-bottom:12px;display:flex;align-items:center;gap:6px;"><span>Événement :</span> <span>' + safeHtml(meta.eventTitle) + '</span></div>'
      : '';

    // Ancien format (une seule section, publications déjà en base) ramené au
    // format liste pour être rendu par le même code.
    var evals = meta.evaluations;
    if (!Array.isArray(evals) || evals.length === 0) {
      evals = [{ teamName: meta.teamName, globalScore: meta.globalScore, criteria: meta.criteria, comment: post.caption || '' }];
    }

    var boxStyle = 'padding:18px;background:linear-gradient(135deg, #F8FAFC 0%, #F6F7F9 100%);border-radius:20px;border:1px solid #E4E7EC;box-shadow:inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.03);';

    if (evals.length === 1) {
      return '<div style="margin:10px 14px;' + boxStyle + '">' + evBadge + renderEvaluationSlide(evals[0]) + '</div>';
    }

    var curIdx = (S.evalCarouselIdx && S.evalCarouselIdx[post.id]) || 0;
    return '<div style="margin:10px 14px;">' +
      evBadge +
      '<div style="position:relative;">' +
        '<div style="position:absolute;top:10px;right:10px;z-index:3;background:rgba(15,23,42,0.72);color:#FFF;font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:12px;" id="evalBadge-' + post.id + '">' + (curIdx+1) + '/' + evals.length + '</div>' +
        '<div id="evalCar-' + post.id + '" onscroll="App.evalCarScroll(\'' + post.id + '\', this)" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;gap:0;">' +
          evals.map(function(ev) {
            return '<div style="flex:0 0 100%;scroll-snap-align:start;box-sizing:border-box;' + boxStyle + '">' + renderEvaluationSlide(ev) + '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div id="evalDots-' + post.id + '" style="display:flex;justify-content:center;gap:5px;margin-top:10px;">' +
        evals.map(function(_, di) {
          var a = di === curIdx;
          return '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B63F6':'#E4E7EC') + ';transition:all 0.25s;"></div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  // Bandeau d'arrivée affiché publiquement sur une publication rattachée à un
  // événement : heure d'enregistrement, ponctualité obtenue et — c'est le point
  // essentiel — la distance au lieu. Tout le monde le voit, personne ne peut le
  // retirer : seule la suppression de la publication le fait disparaître, et cette
  // suppression est elle-même visible de tous.
  function renderCheckInBadge(post) {
    // Le badge n'apparaît que sur un ENREGISTREMENT D'ARRIVÉE, pas sur une simple
    // publication mentionnant un événement.
    if (!post || !post.checkInEventId) return '';
    // isEventLike : si l'événement a été supprimé puis archivé (voir
    // App.deletePost), ce badge — et les étoiles qu'il affiche — doit rester
    // visible sur la publication du membre malgré tout.
    var ev = db(SK.POSTS, []).find(function(p){ return p.id === post.checkInEventId && isEventLike(p); });
    if (!ev) return '';

    var startTs = eventStartTimestamp(ev);
    var arrival = post.checkInAt || post.timestamp || 0;
    var delay = startTs ? Math.round((arrival - startTs) / 60000) : null;
    var dist = checkInDistance(post, ev);
    var geo = post.geo;

    // On reprend le calcul officiel (qui invalide un pointage hors du lieu) plutôt
    // que de recalculer ici : les deux affichages ne peuvent pas diverger.
    var official = punctualityStars(post.userId, ev.id, db(SK.POSTS, []));
    var isThisCheckIn = official && official.checkInPostId === post.id;
    var stars = isThisCheckIn ? official.stars : (delay === null ? null : starsForDelay(delay));
    var offsite = isThisCheckIn && official.offsite;

    var starCol = stars === null ? '#8A93A0' : stars >= 4 ? '#0E9F6E' : stars >= 2 ? '#D98A0B' : '#E2445C';

    // Bloc position : c'est lui qui rend la triche visible.
    var geoBlock;
    if (geo && geo.available) {
      if (dist === null) {
        geoBlock = '<span style="color:#5A6472;">Position enregistrée' + (geo.accuracy ? ' (±' + geo.accuracy + ' m)' : '') + ' · lieu de l\'événement non défini</span>';
      } else {
        var near = dist <= ON_SITE_RADIUS_M;
        geoBlock = '<span style="color:' + (near ? '#047857' : '#B42318') + ';font-weight:800;">' +
          (near ? ico('pin',12,'#047857') + ' Sur place' : ico('alert',12,'#B42318') + ' À ' + formatDistance(dist) + ' du lieu') +
          '</span>' +
          (near ? '<span style="color:#5A6472;"> · à ' + formatDistance(dist) + ' du point de référence</span>' : '');
      }
    } else {
      geoBlock = '<span style="color:#B42318;font-weight:800;">' + geoStatusLabel(geo) + '</span>';
    }

    var bg = (geo && geo.available && (dist === null || dist <= ON_SITE_RADIUS_M)) ? '#F8FAFC' : '#FEF2F2';
    var border = (geo && geo.available && (dist === null || dist <= ON_SITE_RADIUS_M)) ? '#E4E7EC' : '#FECACA';

    return '<div style="margin:0 14px 10px;padding:10px 12px;background:' + bg + ';border:1px solid ' + border + ';border-radius:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">' +
        '<span style="font-size:10px;font-weight:800;color:' + (offsite ? '#B42318' : '#8A93A0') + ';text-transform:uppercase;letter-spacing:0.5px;">' + (offsite ? ico('ban',12,'#B42318') + ' Pointage non validé' : ico('clock',12,'#64748B') + ' Arrivée enregistrée') + '</span>' +
        (stars === null ? '' : '<span style="font-size:12.5px;font-weight:900;color:' + starCol + ';white-space:nowrap;">' + (stars>0?'+':'') + stars + '★</span>') +
      '</div>' +
      '<div style="font-size:11.5px;color:#5A6472;line-height:1.5;">' +
        (delay === null ? '' : (delay <= 0 ? "À l'heure" : 'Retard de ' + delay + ' min') + ' · ') +
        new Date(arrival).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) +
      '</div>' +
      '<div style="font-size:11.5px;line-height:1.5;margin-top:2px;">' + geoBlock + '</div>' +
      (offsite ? '<div style="font-size:10.5px;color:#B42318;margin-top:3px;font-weight:700;line-height:1.4;">Arrivée non comptabilisée : il fallait être à moins de ' + formatDistance(ON_SITE_RADIUS_M) + ' du lieu.</div>' : '') +
      (post.checkInByEdit ? '<div style="font-size:10.5px;color:#B42318;margin-top:3px;font-weight:700;">Rattaché à l\'événement après publication</div>' : '') +
    '</div>';
  }

  // Pile des épinglés. Plusieurs cartes épinglées d'affilée saturent le haut du
  // fil et repoussent l'actualité hors de l'écran. On les regroupe donc en UN
  // bloc, replié par défaut : rien n'est retiré, tout reste accessible en une
  // touche. En dessous de deux, on garde la carte complète telle quelle.
  function renderPinnedStack(pinned) {
    var ouvert = !!S.pinnedOpen;

    var ligne = function(p) {
      var estEv = p.type === 'EVENT' && p.eventTitle;
      var titre = estEv ? p.eventTitle : (p.caption || 'Publication');
      var d = estEv && p.eventDate ? new Date(p.eventDate + 'T00:00:00') : null;
      var vignette = d
        ? '<div style="width:38px;flex-shrink:0;background:' + UI.evBg + ';border-radius:10px;text-align:center;padding:4px 0;">' +
            '<div style="font-size:8px;color:' + UI.evGold + ';letter-spacing:0.5px;">' + d.toLocaleDateString('fr-FR',{month:'short'}).toUpperCase() + '</div>' +
            '<div style="font-size:15px;font-weight:600;color:' + UI.evInk + ';line-height:1.1;">' + d.getDate() + '</div>' +
          '</div>'
        : '<div style="width:38px;height:38px;flex-shrink:0;border-radius:10px;background:' + UI.tile + ';display:flex;align-items:center;justify-content:center;">' + ico('message', 17, UI.faint) + '</div>';
      var meta = estEv
        ? ((p.eventStart || '') + (p.eventEnd ? ' – ' + p.eventEnd : '') + (p.eventLocation ? ' · ' + p.eventLocation : ''))
        : (p.author || '');
      var action = estEv ? "App.goToEvent('" + p.id + "')" : "App.goToPost('" + p.id + "')";
      return '<div onclick="' + action + '" style="display:flex;align-items:center;gap:11px;padding:9px 14px;border-top:0.5px solid ' + UI.line + ';cursor:pointer;">' +
        vignette +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13.5px;font-weight:500;color:' + UI.ink + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(titre) + '</div>' +
          (meta ? '<div style="font-size:11.5px;color:' + UI.faint + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(meta) + '</div>' : '') +
        '</div>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + UI.line2 + '" stroke-width="2.4" style="flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>' +
      '</div>';
    };

    return '<div style="background:' + UI.card + ';border-radius:' + UI.r2 + ';box-shadow:' + UI.sh2 + ';margin:0 12px 12px;overflow:hidden;">' +
      '<div onclick="App.togglePinnedStack()" style="display:flex;align-items:center;gap:9px;padding:13px 14px;cursor:pointer;">' +
        ico('pinned', 16, UI.accent) +
        '<span style="font-size:13.5px;font-weight:600;color:' + UI.ink + ';">Épinglés</span>' +
        '<span style="font-size:11.5px;font-weight:600;color:' + UI.accentInk + ';background:' + UI.accentSoft + ';padding:1px 8px;border-radius:' + UI.pill + ';">' + pinned.length + '</span>' +
        '<span style="margin-left:auto;font-size:11.5px;color:' + UI.faint + ';">' + (ouvert ? 'Réduire' : 'Afficher') + '</span>' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' + UI.faint + '" stroke-width="2.2" style="transform:rotate(' + (ouvert ? '90' : '0') + 'deg);transition:transform 0.2s;flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>' +
      '</div>' +
      (ouvert ? '' : pinned.map(ligne).join('')) +
    '</div>' +
    // Déplié : les cartes complètes reprennent leur place habituelle, sous l'en-tête.
    (ouvert ? pinned.map(function(p){ return renderPostCard(p); }).join('') : '');
  }

  // Image en plein écran. Un simple toucher n'importe où referme : c'est le
  // geste attendu, et le bouton de fermeture reste là pour ceux qui le cherchent.
  function renderImageViewer() {
    if (!S.viewerImage) return '';
    return '<div onclick="App.closeImageViewer()" class="safe-top" style="position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.94);display:flex;align-items:center;justify-content:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom));animation:fadeIn 0.18s ease-out;">' +
      '<button onclick="event.stopPropagation();App.closeImageViewer()" aria-label="Fermer" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.16);border:none;border-radius:50%;width:44px;height:44px;color:#FFF;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">×</button>' +
      '<img src="' + safeHtml(S.viewerImage) + '" onclick="event.stopPropagation()" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:' + UI.r1 + ';" />' +
    '</div>';
  }

  // Vignette d'un lien : image si le site en fournit une, sinon domaine seul.
  // « compact » sert dans le composeur, où la place est comptée.
  function renderLinkPreviewCard(pv, opts) {
    if (!pv || !pv.url) return '';
    opts = opts || {};
    var domain = pv.siteName || linkDomain(pv.url);
    var titre = pv.title || domain;
    var img = pv.image
      ? '<img src="' + safeHtml(pv.image) + '" loading="lazy" onerror="this.style.display=\'none\'" style="display:block;width:100%;height:' + (opts.compact ? '120px' : '170px') + ';object-fit:cover;background:' + UI.tile + ';" />'
      : '';
    var inner =
      img +
      '<div style="padding:10px 12px;">' +
        '<div style="font-size:10.5px;color:' + UI.faint + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">' + safeHtml(domain) + '</div>' +
        '<div style="font-size:13.5px;font-weight:600;color:' + UI.ink + ';line-height:1.35;">' + safeHtml(titre) + '</div>' +
        (pv.description && !opts.compact
          ? '<div style="font-size:12px;color:' + UI.muted + ';line-height:1.4;margin-top:3px;">' + safeHtml(pv.description) + '</div>'
          : '') +
      '</div>';

    var box = '<div style="border:0.5px solid ' + UI.line2 + ';border-radius:' + UI.r1 + ';overflow:hidden;background:' + UI.card + ';">' + inner + '</div>';
    if (opts.noLink) return box;
    return '<a href="' + safeHtml(pv.url) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">' + box + '</a>';
  }

  // Sondage optionnel attaché à une publication : question + options cliquables.
  // Une seule réponse par membre ; les résultats (barres + %) n'apparaissent
  // qu'une fois qu'on a soi-même voté, pour ne pas influencer le vote.
  function renderPollBlock(post) {
    if (!post || !post.poll || !Array.isArray(post.poll.options) || post.poll.options.length < 2) return '';
    var poll = post.poll;
    var myVote = S.user ? pollUserVote(poll, S.user.id) : null;
    var total = pollTotalVotes(poll);
    var hasVoted = myVote !== null;

    return '<div style="margin:0 14px 10px;padding:14px;background:#F6FBF8;border:1px solid #DCF3E6;border-radius:16px;">' +
      '<div style="font-size:10px;font-weight:800;color:#0EA65C;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><span>📊</span> Sondage</div>' +
      '<div style="font-size:14.5px;font-weight:800;color:#0B0D12;margin-bottom:10px;line-height:1.4;">' + safeHtml(poll.question||'') + '</div>' +
      poll.options.map(function(opt, idx) {
        var pct = pollOptionPct(poll, idx);
        var mine = myVote === idx;
        return '<div onclick="App.votePoll(\'' + post.id + '\', ' + idx + ')" style="position:relative;margin-bottom:7px;border-radius:12px;overflow:hidden;background:#FFF;border:1.5px solid ' + (mine?'#0EA65C':'#E4E7EC') + ';cursor:pointer;">' +
          (hasVoted ? '<div style="position:absolute;top:0;left:0;bottom:0;width:' + pct + '%;background:' + (mine?'rgba(14,166,92,0.16)':'rgba(142,142,147,0.12)') + ';transition:width 0.3s;"></div>' : '') +
          '<div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;">' +
            '<span style="font-size:13px;font-weight:' + (mine?'800':'600') + ';color:' + (mine?'#0B7A42':'#0B0D12') + ';">' + (mine ? '✓ ' : '') + safeHtml(opt) + '</span>' +
            (hasVoted ? '<span style="font-size:12px;font-weight:800;color:#8A93A0;white-space:nowrap;">' + pct + '%</span>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
      '<div style="font-size:11px;color:#8A93A0;font-weight:600;margin-top:2px;">' + total + ' vote' + (total!==1?'s':'') + (hasVoted ? ' · touchez pour changer votre choix' : ' · touchez une option pour voter') + '</div>' +
    '</div>';
  }

  function renderPostCard(post) {
    var iLiked = userIsLiked(post);
    var iSaved = !!S.savedPosts[post.id];
    var hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
    // Rattrapage : publications vidéo déjà en ligne sans vignette (générée trop tôt
    // ou échouée sur mobile). On la fabrique une fois puis on l'enregistre.
    backfillVideoPoster(post);
    var curIdx = S.carouselIdx[post.id] || 0;
    var expanded = !!S.expandedCaptions[post.id];
    var ago = timeAgo(post.timestamp);
    var sec = SECTIONS.find(function(s){ return s.id === post.sectionId; }) || { emoji:'📢', color:'#8A93A0' };
    var likeCount = Array.isArray(post.likedBy) ? post.likedBy.length : (post.likes || 0);
    var viewCount = Array.isArray(post.viewedBy) ? post.viewedBy.length : 0;
    var postAuthorUser = db(SK.USERS, []).find(function(u){ return u.id === post.userId; });
    var postAuthorRoleLabel = roleLabel(postAuthorUser ? postAuthorUser.role : null);
    // Section du PROFIL de l'auteur (affichée dans l'en-tête) — différente du topic
    // détecté par hashtag sur la publication (affiché près des icônes like/commentaire/partage).
    var authorSecId = getUserSections(postAuthorUser)[0];
    var authorSecObj = SECTIONS.find(function(s){ return s.id === authorSecId; });
    var authorSecEmoji = authorSecObj ? authorSecObj.emoji : '🎥';
    var authorSecColor = authorSecObj ? authorSecObj.color : '#0B63F6';
    var authorSecNom = authorSecObj ? authorSecObj.nom : 'Membre';

    // Caption truncation (Instagram style: max 3 lines)
    var fullCaption = post.caption || '';
    var captionHtml = '';
    var lines = fullCaption.split('\n');
    var needsTruncate = fullCaption.length > 120 || lines.length > 3;
    if (!expanded && needsTruncate) {
      var short = fullCaption.slice(0, 120);
      captionHtml = hashtagify(short) + '... <span onclick="App.expandCaption(\'' + post.id + '\')" style="color:#8A93A0;cursor:pointer;font-weight:600;">plus</span>';
    } else {
      captionHtml = hashtagify(fullCaption);
      if (needsTruncate && expanded) {
        captionHtml += ' <span onclick="App.expandCaption(\'' + post.id + '\')" style="color:#8A93A0;cursor:pointer;font-weight:600;">moins</span>';
      }
    }

    // Media zone
    var mediaZone = '';
    if (hasMedia) {
      var isMulti = post.mediaUrls.length > 1;
      mediaZone = '<div style="position:relative;background:#000;">' +
        (isMulti ? '<div id="badge-'+post.id+'" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.6);color:#FFF;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;z-index:10;">' + (curIdx+1) + '/' + post.mediaUrls.length + '</div>' : '') +
        '<div id="car-'+post.id+'" onscroll="App.carScroll(\''+post.id+'\',this)" ondblclick="App.doubleTapLike(\''+post.id+'\')" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;">' +
          post.mediaUrls.map(function(url) {
            // Les dimensions réelles du média sont conservées (pas de recadrage forcé en
            // carré) : width/height:auto + object-fit:contain, limité par max-height pour
            // ne pas laisser une vidéo très verticale envahir tout l'écran.
            var mediaTag = isVideoUrl(url)
              // preload="auto" + onloadeddata : si aucune vignette n'a pu être générée,
              // on force le navigateur à afficher la première image plutôt qu'un écran noir.
              ? '<video src="'+url+'"' + (post.videoPoster ? ' poster="'+post.videoPoster+'"' : '') + ' controls playsinline preload="auto" onloadeddata="App.primeVideoFrame(this)" style="display:block;width:auto;height:auto;max-width:100%;max-height:640px;object-fit:contain;margin:0 auto;background:#000;"></video>'
              : '<img src="'+url+'" loading="lazy" onclick="App.openImageViewer(\''+url+'\')" style="display:block;width:auto;height:auto;max-width:100%;max-height:640px;object-fit:contain;margin:0 auto;cursor:pointer;"/>';
            return '<div style="flex:0 0 100%;scroll-snap-align:start;display:flex;justify-content:center;">'+mediaTag+'</div>';
          }).join('') +
        '</div>' +
        (isMulti ? '<div id="dots-'+post.id+'" style="display:flex;justify-content:center;gap:5px;padding:8px 0;background:#FFF;">' +
          post.mediaUrls.map(function(_,di){
            var a = di === curIdx;
            return '<div style="width:'+(a?'18':'6')+'px;height:6px;border-radius:3px;background:'+(a?'#0B63F6':'#E4E7EC')+';transition:all 0.25s;"></div>';
          }).join('') +
        '</div>' : '') +
      '</div>';
    } else {
      // Text-only: only show dark zone for vedette/scored posts
      if (post.postBg) {
        // Colored/gradient background post — Facebook style
        var bgStyle = post.postBg.startsWith('url') 
          ? 'background:' + post.postBg + ';background-size:cover;background-position:center;'
          : 'background:' + post.postBg + ';';
        var captionForBg = post.caption || '';
        var fontSize = captionForBg.length > 100 ? '18px' : captionForBg.length > 60 ? '22px' : '26px';
        mediaZone = '<div ondblclick="App.doubleTapLike(\''+post.id+'\')" style="position:relative;' + bgStyle + 'min-height:220px;display:flex;align-items:center;justify-content:center;padding:28px 20px;text-align:center;overflow:hidden;">' +
          '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.08);"></div>' +
          '<p style="position:relative;z-index:1;font-size:' + fontSize + ';font-weight:900;color:#FFF;margin:0;line-height:1.4;text-shadow:0 2px 16px rgba(0,0,0,0.4);word-break:break-word;">' + hashtagify(captionForBg) + '</p>' +
        '</div>';
        // Don't show caption again below for bg posts (it's in the card)
        captionHtml = '';
      } else if (post.isVedette || post.scoreText) {
        mediaZone = '<div ondblclick="App.doubleTapLike(\''+post.id+'\')" style="background:linear-gradient(135deg,#1A1A2E,#2D2D44);min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center;position:relative;">' +
          '<div style="width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;margin-bottom:8px;font-size:22px;">' + sec.emoji + '</div>' +
          (post.isVedette ? '<div style="background:linear-gradient(135deg,#FFD700,#D98A0B);color:#5D3A00;font-size:10px;font-weight:900;padding:4px 12px;border-radius:20px;letter-spacing:0.8px;margin-bottom:6px;">SECTION VEDETTE</div>' : '') +
          (post.scoreText ? '<div style="background:rgba(255,255,255,0.92);backdrop-filter:blur(8px);padding:5px 12px;border-radius:12px;position:absolute;bottom:12px;right:12px;"><strong style="font-size:13px;color:#0B0D12;">★ ' + post.scoreText + '</strong></div>' : '') +
        '</div>';
      } else {
        // Plain text post — no background, caption shown below
        mediaZone = '';
      }
    }

    var pinnedBadge = isPinnedNow(post) ? '<div style="background:#0B63F6;color:#FFF;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;display:flex;align-items:center;gap:6px;"><span style="font-size:12px;">📌</span> ÉPINGLÉ</div>' : '';

      var contentZone = '';
      // Handle new-format EVENT posts (created by saveEvent)
      if (post.type === 'EVENT' && post.eventTitle) {
         // Cliquer sur l'événement dans le fil l'ouvre dans le Planning, à sa date.
         contentZone = '<div onclick="App.goToEvent(\'' + post.id + '\')" style="margin:0 16px 14px;cursor:pointer;">' + renderEventCardInner(post) + '</div>';
      } else if (post.type === 'EVENT' && post.metadata) {
         var participants = Object.keys(post.metadata.participations || {}).filter(function(k) { return post.metadata.participations[k] === 'yes'; });
         var partAvatars = '';
         if (participants.length > 0) {
             partAvatars = '<div style="display:flex;margin-left:8px;">';
             for (var i=0; i<Math.min(participants.length, 3); i++) {
                 partAvatars += '<div style="width:24px;height:24px;border-radius:12px;background:#0B63F6;color:#FFF;border:2px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;margin-left:-8px;">👤</div>';
             }
             if (participants.length > 3) {
                 partAvatars += '<div style="width:24px;height:24px;border-radius:12px;background:#E4E7EC;color:#000;border:2px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;margin-left:-8px;">+'+(participants.length-3)+'</div>';
             }
             partAvatars += '</div>';
         }

         contentZone = '<div style="margin:10px 14px;padding:20px;background:#F6F7F9;border-radius:20px;border-left:5px solid #0B63F6;box-shadow:0 4px 12px rgba(0,0,0,0.03);position:relative;overflow:hidden;">' +
          '<div style="position:absolute;top:0;right:0;width:100px;height:100px;background:radial-gradient(circle, rgba(88,86,214,0.05) 0%, rgba(255,255,255,0) 70%);border-radius:50%;transform:translate(30%,-30%);"></div>' +
          
          '<div style="display:inline-block;background:rgba(88,86,214,0.1);color:#0B63F6;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">Événement Planning</div>' +
          
          '<div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">' +
            '<div style="background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,0.08);width:70px;text-align:center;flex-shrink:0;border:1px solid #EAECF0;">' +
              '<div style="background:linear-gradient(135deg, #E2445C, #E2445C);color:#FFF;font-size:11px;font-weight:900;text-transform:uppercase;padding:6px 0;letter-spacing:1px;">' + (post.metadata.month||'MOIS') + '</div>' +
              '<div style="font-size:28px;font-weight:900;color:#000;padding:8px 0;">' + (post.metadata.day||'00') + '</div>' +
            '</div>' +
            '<div style="flex:1;">' +
              '<h3 style="margin:0 0 8px;font-size:19px;font-weight:900;color:#0B0D12;line-height:1.2;letter-spacing:-0.3px;">' + safeHtml(post.metadata.title||'') + '</h3>' +
              '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
                '<div style="font-size:13px;color:#0B63F6;display:flex;align-items:center;gap:4px;font-weight:600;background:rgba(88,86,214,0.08);padding:4px 8px;border-radius:6px;"><span style="font-size:14px;">🕒</span> ' + safeHtml(post.metadata.time||'') + '</div>' +
                '<div style="font-size:13px;color:#8A93A0;display:flex;align-items:center;gap:4px;font-weight:600;background:#F6F7F9;padding:4px 8px;border-radius:6px;"><span style="font-size:14px;">📍</span> ' + safeHtml(post.metadata.location||'') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          
          (post.caption ? '<p style="font-size:14px;color:#25303F;margin:0 0 16px;line-height:1.5;">' + safeHtml(post.caption) + '</p>' : '') +
          
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-top:12px;border-top:1px dashed #E4E7EC;">' +
            '<div style="display:flex;align-items:center;">' +
              '<span style="font-size:12px;color:#8A93A0;font-weight:600;">' + participants.length + ' Confirmé(s)</span>' +
              partAvatars +
            '</div>' +
          '</div>' +

          '<div style="display:flex;gap:10px;">' +
            '<button onclick="App.toggleParticipation(\''+post.id+'\',\'yes\')" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:800;border:none;cursor:pointer;background:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'#0E9F6E':'#FFF')+';color:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'#FFF':'#000')+';box-shadow:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'0 4px 12px rgba(52,199,89,0.3)':'0 2px 6px rgba(0,0,0,0.05)')+';transition:all 0.2s;">' + ((post.metadata.participations||{})[(S.user||{}).id]==='yes' ? ico('thumb',14,'#FFF') + ' Confirmé' : ico('thumb',14,'currentColor') + ' Je participe') + '</button>' +
            '<button onclick="App.toggleParticipation(\''+post.id+'\',\'no\')" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:800;border:none;cursor:pointer;background:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'linear-gradient(135deg,#E2445C,#E2445C)':'#FFF')+';color:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'#FFF':'#000')+';box-shadow:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'0 4px 12px rgba(255,59,48,0.3)':'0 2px 6px rgba(0,0,0,0.05)')+';transition:all 0.2s;">' + ((post.metadata.participations||{})[(S.user||{}).id]==='no' ? '❌ Indisponible' : '❌ Non dispo') + '</button>' +
          '</div>' +
        '</div>';
      } else if (post.type === 'EVALUATION' && post.metadata && (post.metadata.evaluations || post.metadata.teamName)) {
         contentZone = renderEvaluationContent(post);
      } else {
         // For standard posts: only the media zone goes in contentZone.
         // The caption is rendered separately in finalHtml below.
         contentZone = mediaZone;
         // For REPOST: override with original content
         if (post.type === 'REPOST') {
           var origMedia = post.originalMediaUrls || [];
           // Toucher le contenu repris ramène à la publication d'origine.
           var goOrig = post.originalPostId
             ? ' onclick="event.stopPropagation();App.goToOriginalPost(\'' + post.originalPostId + '\')" style="cursor:pointer;"'
             : '';
           if (origMedia.length > 0) {
             contentZone = '<div' + goOrig + '>' + origMedia.map(function(url){
               return isVideoUrl(url)
                 ? '<video src="' + url + '"' + (post.originalVideoPoster ? ' poster="'+post.originalVideoPoster+'"' : '') + ' controls playsinline preload="metadata" style="width:100%;display:block;background:#000;"></video>'
                 : '<img src="' + url + '" style="width:100%;display:block;" />';
             }).join('') + '</div>';
           } else if (post.originalPostBg) {
             contentZone = '<div' + (goOrig ? goOrig.replace('style="cursor:pointer;"', '') : '') + ' style="background:' + post.originalPostBg + ';min-height:200px;display:flex;align-items:center;justify-content:center;padding:30px;' + (goOrig ? 'cursor:pointer;' : '') + '"><p style="color:#FFF;font-size:20px;font-weight:800;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,0.3);margin:0;line-height:1.4;">' + safeHtml(post.originalCaption || '') + '</p></div>';
           }
         }
      }
    // Repost banner
    var repostBanner = '';
    if (post.type === 'REPOST') {
      // Le bandeau lui-même ramène à la publication d'origine : c'est l'endroit
      // que l'on touche naturellement quand on veut « voir l'original ».
      var bannerClick = post.originalPostId
        ? ' onclick="App.goToOriginalPost(\'' + post.originalPostId + '\')" style="padding:12px 16px 0;display:flex;align-items:center;gap:7px;color:' + UI.faint + ';font-size:12.5px;cursor:pointer;"'
        : ' style="padding:12px 16px 0;display:flex;align-items:center;gap:7px;color:' + UI.faint + ';font-size:12.5px;"';
      repostBanner = '<div' + bannerClick + '>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + UI.faint + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
        '<span style="min-width:0;">' + safeHtml(post.author || '') + ' a partagé la publication de ' + safeHtml(post.originalAuthor || '') + '</span>' +
        (post.originalPostId ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + UI.faint + '" stroke-width="2.2" style="margin-left:auto;flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>' : '') +
      '</div>';
    }
    // Caption text (author + label), shown ABOVE the media — Facebook style
    var captionTextBlock = (!post.postBg && (captionHtml || (post.type === 'REPOST' && post.originalCaption && !post.originalPostBg)))
      ? '<div style="padding:0 16px 12px;">' +
          (post.type === 'REPOST' && post.originalCaption && !post.originalPostBg ? '<p style="font-size:14px;color:' + UI.ink2 + ';margin:0 0 4px;line-height:1.5;"><strong style="font-weight:600;">' + safeHtml(post.originalAuthor || '') + '</strong> ' + safeHtml(post.originalCaption) + '</p>' : '') +
          (captionHtml ? '<p style="font-size:14px;color:' + UI.ink2 + ';margin:0;line-height:1.5;">' + captionHtml + '</p>' : '') +
        '</div>'
      : '';

    // Lien vers les commentaires. L'heure n'est PLUS répétée ici : elle figure
    // déjà dans l'en-tête, à côté de l'auteur (elle apparaissait deux fois).
    var commentsLinkLabel = (post.comments || []).length > 0
      ? 'Voir les ' + (post.comments || []).length + ' commentaire' + ((post.comments || []).length > 1 ? 's' : '')
      : 'Ajouter un commentaire…';
    var metaFooterBlock =
      '<div style="padding:' + (post.postBg ? '2px' : '0') + ' 16px 12px;">' +
        '<button onclick="App.openComments(\'' + post.id + '\')" style="background:none;border:none;padding:0;font-size:13px;color:' + UI.faint + ';cursor:pointer;">' + commentsLinkLabel + '</button>' +
      '</div>';

    // Carte blanche détachée sur le fond gris de l'écran : c'est ce qui donne
    // au fil sa respiration, au lieu de bandes blanches collées bord à bord.
    var finalHtml = '<article id="post-'+post.id+'" data-postid="'+post.id+'" style="background:' + UI.card + ';border-radius:' + UI.r2 + ';box-shadow:' + UI.sh2 + ';margin:0 12px 12px;overflow:hidden;">' +
      repostBanner +
      pinnedBadge +
      (post.is_ephemeral ? '<div style="padding:10px 16px 0;"><span style="display:inline-flex;align-items:center;gap:5px;background:' + UI.tile + ';color:' + UI.muted + ';font-size:11px;padding:3px 9px;border-radius:' + UI.pill + ';">' + ico('clock', 12, UI.muted) + 'Éphémère · disparaît dans ' + (function(){ var h = Math.max(0, Math.round((post.ephemeral_expiry - Date.now()) / 3600000)); return h > 0 ? h + ' h' : 'bientôt'; })() + '</span></div>' : '') +
      // En-tête de la carte
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px 11px;">' +
        (function(){
          var allU = db(SK.USERS, []);
          var pAuthor = allU.find(function(u){ return u.id === post.userId; });
          var pAvatarUrl = (pAuthor && pAuthor.avatar_url) ? pAuthor.avatar_url : post.avatar_url;
          var pColor = (pAuthor && pAuthor.avatar_color) ? pAuthor.avatar_color : (post.avatarColor || '#0B63F6');
          var pInitial = (pAuthor && pAuthor.prenom) ? pAuthor.prenom.charAt(0).toUpperCase() : (post.authorAvatar || 'M');
          var pName = (pAuthor && pAuthor.prenom && pAuthor.nom) ? (pAuthor.prenom + ' ' + pAuthor.nom) : (post.author || 'Membre');

          var avatarNode = pAvatarUrl
            ? '<img src="' + pAvatarUrl + '" style="width:36px;height:36px;border-radius:' + UI.pill + ';object-fit:cover;flex-shrink:0;" />'
            : '<div style="width:36px;height:36px;border-radius:' + UI.pill + ';background:' + pColor + ';color:#FFF;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + pInitial + '</div>';

          return '<div onclick="App.openUserProfile(\'' + post.userId + '\')" style="display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0;">' +
            avatarNode +
            '<div style="min-width:0;">' +
              '<div style="font-size:13.5px;font-weight:600;color:' + UI.ink + ';">' + safeHtml(pName) + '</div>';
        })() +
            '<div style="font-size:11.5px;color:' + UI.faint + ';display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
              '<span>' + authorSecEmoji + ' ' + authorSecNom + '</span>' +
              // Le grade doit rester visible à côté du pôle : c'est lui qui dit
              // qui est responsable de quoi dans l'équipe.
              (postAuthorRoleLabel ? '<span>·</span><span>' + postAuthorRoleLabel + '</span>' : '') +
              '<span>·</span><span>' + ago + '</span>' + (post.is_edited ? '<span style="font-style:italic;margin-left:2px;">modifié</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button onclick="App.openOptions(\'' + post.id + '\')" style="background:#F6F7F9;border:none;width:32px;height:32px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' + SVG.dots + '</button>' +
      '</div>' +
      (function(){
        if (!post.aboutEventId) return '';
        var aboutEv = db(SK.POSTS, []).find(function(p){ return p.id === post.aboutEventId && p.type === 'EVENT'; });
        if (!aboutEv) return '';
        var aEvDate = aboutEv.eventDate ? new Date(aboutEv.eventDate + 'T00:00:00') : null;
        var aEvDateStr = aEvDate ? aEvDate.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'}) : '';
        return '<div onclick="App.goToEvent(\''+aboutEv.id+'\')" style="margin:0 14px 10px;padding:10px 12px;background:#E8EEFB;border-radius:14px;border:1px solid #E2E0FF;display:flex;align-items:center;gap:10px;cursor:pointer;">' +
          '<span style="font-size:18px;">🗓️</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:10px;font-weight:800;color:#0B63F6;text-transform:uppercase;letter-spacing:0.5px;">À propos de cet événement</div>' +
            '<div style="font-size:13px;font-weight:800;color:#0B0D12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(aboutEv.eventTitle||'') + (aEvDateStr ? ' · ' + aEvDateStr : '') + (aboutEv.eventStart ? ' à ' + aboutEv.eventStart : '') + '</div>' +
          '</div>' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B63F6" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
        '</div>';
      })() +
      renderCheckInBadge(post) +
      captionTextBlock +
      (post.linkPreview ? '<div style="margin:0 16px 12px;">' + renderLinkPreviewCard(post.linkPreview) + '</div>' : '') +
      contentZone +
      renderPollBlock(post) +
      // Actions row
      // Barre d'engagement : icône + compteur sur une seule ligne, séparée du
      // contenu par un filet. Le compteur de j'aime n'a plus sa propre ligne.
      '<div style="display:flex;align-items:center;gap:18px;padding:11px 16px;border-top:0.5px solid ' + UI.line + ';color:' + UI.muted + ';font-size:12.5px;">' +
        '<button id="likeBtn-'+post.id+'" onclick="App.like(\''+post.id+'\')" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;gap:6px;color:inherit;font-size:inherit;transition:transform 0.1s;" onmousedown="this.style.transform=\'scale(0.9)\'" onmouseup="this.style.transform=\'scale(1)\'">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (iLiked ? UI.bad : 'none') + '" stroke="' + (iLiked ? UI.bad : UI.muted) + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          '<span id="likeCount-'+post.id+'" style="color:' + (iLiked ? UI.bad : UI.muted) + ';">' + likeCount + '</span>' +
        '</button>' +
        '<button onclick="App.openComments(\''+post.id+'\')" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;gap:6px;color:inherit;font-size:inherit;">' +
          ico('message', 18, UI.muted) + '<span>' + (post.comments || []).length + '</span>' +
        '</button>' +
        '<button onclick="App.openRepostModal(\''+post.id+'\')" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;color:inherit;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
        '</button>' +
        '<button onclick="App.openViewers(\''+post.id+'\')" title="Vues" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;gap:6px;color:inherit;font-size:inherit;">' +
          ico('eye', 18, UI.muted) + '<span id="viewCount-'+post.id+'">' + viewCount + '</span>' +
        '</button>' +
        '<button id="saveBtn-'+post.id+'" onclick="App.save(\''+post.id+'\')" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;margin-left:auto;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (iSaved ? UI.ink : 'none') + '" stroke="' + (iSaved ? UI.ink : UI.muted) + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
        '</button>' +
      '</div>' +

      metaFooterBlock +

    '</article>';
    return finalHtml;
  }

  // ============================================================
  // CREATE POST MODAL
  // ============================================================

  
  function renderNotificationsModal(u) {
    var notifs = (u && Array.isArray(u.notifications)) ? u.notifications : [];
    var unreadCount = notifs.filter(function(n){ return !n.read; }).length;

    var tousMembres = db(SK.USERS, []);
    var itemsHtml = '';
    if (notifs.length === 0) {
      itemsHtml = '<div style="padding:50px 20px;text-align:center;color:#8A93A0;">' +
        '<div style="margin-bottom:10px;">' + ico('inbox', 40, UI.line2, 1.4) + '</div>' +
        '<div style="font-size:16px;font-weight:800;color:#0B0D12;margin-bottom:6px;">Aucune notification</div>' +
        '<div style="font-size:13px;color:#8A93A0;">Vous êtes à jour ! Aucune nouvelle activité.</div>' +
      '</div>';
    } else {
      itemsHtml = notifs.map(function(n) {
        var iconName = n.type === 'LIKE' ? 'star'
          : (n.type === 'COMMENT' || n.type === 'REPLY' || n.type === 'MENTION') ? 'message'
          : n.type === 'EVALUATION' ? 'chart'
          : n.type === 'MESSAGE' ? 'inbox'
          : (n.type === 'FOLLOW' || n.type === 'NEW_MEMBER') ? 'users'
          : 'calendar';
        var icon = ico(iconName, 10, '#FFF', 2.4);
        var bgIcon = n.type === 'LIKE' ? '#FF2D55' : (n.type === 'COMMENT' || n.type === 'REPLY') ? '#0B63F6' : n.type === 'EVALUATION' ? '#D98A0B' : n.type === 'MENTION' ? '#D98A0B' : n.type === 'MESSAGE' ? '#0E9F6E' : n.type === 'FOLLOW' ? '#AF52DE' : n.type === 'NEW_MEMBER' ? '#0E9F6E' : '#0B63F6';
        var timeAgoStr = timeAgo(n.timestamp || Date.now());
        var isUnread = !n.read;

        // La photo n'est plus recopiée dans la notification (elle saturait le
        // stockage) : on la retrouve dans le profil de l'expéditeur via senderId.
        // Bénéfice au passage : un membre qui change de photo la voit changer
        // dans toutes ses notifications passées, au lieu de rester figée.
        var expediteur = n.senderId ? tousMembres.find(function(m){ return m.id === n.senderId; }) : null;
        var photo = (expediteur && expediteur.avatar_url) || n.senderAvatar || null;
        var teinte = (expediteur && expediteur.avatar_color) || n.senderColor || '#0B63F6';

        var avatarHtml = photo
          ? '<img src="' + photo + '" style="width:44px;height:44px;border-radius:22px;object-fit:cover;flex-shrink:0;" />'
          : '<div style="width:44px;height:44px;border-radius:22px;background:' + teinte + ';color:#FFF;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (n.senderName||'S').charAt(0).toUpperCase() + '</div>';

        return '<div onclick="App.clickNotification(\'' + n.id + '\', \'' + (n.targetId||'') + '\')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:0.5px solid #F6F7F9;background:' + (isUnread ? '#E8EEFB' : '#FFF') + ';cursor:pointer;transition:background 0.2s;position:relative;">' +
          '<div style="position:relative;flex-shrink:0;">' +
            avatarHtml +
            '<div style="position:absolute;bottom:-2px;right:-2px;width:19px;height:19px;border-radius:' + UI.pill + ';background:' + bgIcon + ';display:flex;align-items:center;justify-content:center;border:1.5px solid ' + UI.card + ';">' + icon + '</div>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13.5px;color:#0B0D12;line-height:1.35;word-break:break-word;">' +
              '<strong>' + safeHtml(n.senderName || 'Membre') + '</strong> ' + safeHtml(n.text || '') +
            '</div>' +
            '<div style="font-size:11px;color:#8A93A0;margin-top:3px;">' + timeAgoStr + '</div>' +
          '</div>' +
          (isUnread ? '<div style="width:8px;height:8px;border-radius:4px;background:#0B63F6;flex-shrink:0;"></div>' : '') +
        '</div>';
      }).join('');
    }

    return '<div onclick="App.closeNotifications()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeNotifications()">' +
          '<div style="width:40px;height:4px;background:#E4E7EC;border-radius:2px;"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 8px 12px 18px;border-bottom:0.5px solid #E4E7EC;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<h2 style="font-size:19px;font-weight:900;color:#000;margin:0;">Notifications</h2>' +
            (unreadCount > 0 ? '<span style="background:#E2445C;color:#FFF;font-size:11px;font-weight:900;padding:2px 8px;border-radius:10px;">' + unreadCount + '</span>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:2px;flex-shrink:0;">' +
            (unreadCount > 0 ? '<button onclick="App.markAllNotificationsRead()" style="background:none;border:none;color:#0B63F6;font-size:13px;font-weight:700;cursor:pointer;padding:0 8px;height:44px;">Tout lire</button>' : '') +
            // Auparavant, la seule façon de fermer était de viser la fine bande grise
            // au-dessus de la feuille ou la petite poignée — difficile à atteindre à
            // une main sur un écran presque entièrement occupé par la liste. Un bouton
            // explicite, à taille de cible tactile normale, referme la feuille sans ambiguïté.
            '<button onclick="App.closeNotifications()" aria-label="Fermer" style="background:none;border:none;width:44px;height:44px;border-radius:' + UI.pill + ';color:#000;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">×</button>' +
          '</div>' +
        '</div>' +
        '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;">' +
          itemsHtml +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Sert à la fois à créer et à modifier un événement (S.editEventId non nul).
  // La modification d'un événement n'utilise donc PLUS l'éditeur de publication
  // générique : elle réutilise ce formulaire, avec les mêmes champs métier.
  // Options du sélecteur d'assignation, groupées par pôle.
  // Le Grand Responsable voit tout le monde + une entrée « pôle entier » par
  // section ; un responsable de section ne voit que ses propres membres.
  function renderAssignSelectOptions(u) {
    var allU = db(SK.USERS, []);
    var members = assignableMembers(u, allU);
    var secIds = assignableSectionIds(u);
    var out = '';

    if (isGrandResponsable(u)) {
      out += '<optgroup label="Confier à un pôle entier">' +
        SECTIONS.map(function(s) {
          return '<option value="sec:' + s.id + '">' + s.emoji + ' Pôle ' + safeHtml(s.nom) + '</option>';
        }).join('') +
      '</optgroup>';
    }

    var placed = {};
    secIds.forEach(function(secId) {
      var sec = SECTIONS.find(function(s){ return s.id === secId; });
      if (!sec) return;
      var inSec = members.filter(function(m){ return getUserSections(m).indexOf(secId) !== -1; });
      if (inSec.length === 0) return;
      out += '<optgroup label="' + sec.emoji + ' ' + safeHtml(sec.nom) + '">' +
        inSec.map(function(m) {
          placed[m.id] = true;
          return '<option value="' + m.id + '">' + safeHtml((m.prenom||'') + ' ' + (m.nom||'')) + '</option>';
        }).join('') +
      '</optgroup>';
    });

    // Membres sans pôle reconnu (uniquement visibles du Grand Responsable).
    var orphans = members.filter(function(m){ return !placed[m.id]; });
    if (orphans.length > 0) {
      out += '<optgroup label="Sans pôle">' +
        orphans.map(function(m) {
          return '<option value="' + m.id + '">' + safeHtml((m.prenom||'') + ' ' + (m.nom||'')) + '</option>';
        }).join('') +
      '</optgroup>';
    }

    if (!out) out = '<option value="" disabled>Aucun membre dans votre pôle</option>';
    return out;
  }

  // Choix proposé quand on enregistre la modification d'un événement.
  // Rendu PAR-DESSUS le formulaire (et non à sa place) pour que les champs
  // restent dans le DOM : saveEvent les relit juste après le choix.
  function renderEventSaveChoice() {
    if (!S.eventSaveChoiceOpen) return '';
    return '<div onclick="App.cancelEventSaveChoice()" style="position:fixed;inset:0;background:rgba(15,15,20,0.6);z-index:10002;display:flex;justify-content:center;align-items:center;padding:24px;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:360px;background:#FFF;border-radius:24px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
        '<h3 style="font-size:17px;font-weight:900;color:#000;margin:0 0 6px;text-align:center;">Enregistrer les modifications</h3>' +
        '<p style="font-size:12.5px;color:#5A6472;line-height:1.5;margin:0 0 18px;text-align:center;">Voulez-vous remplacer cet événement, ou en créer un nouveau en gardant l\'ancien ?</p>' +

        '<button type="button" onclick="App.chooseEventSaveMode(\'overwrite\')" style="width:100%;background:#F6F7F9;border:none;border-radius:16px;padding:14px;margin-bottom:10px;cursor:pointer;text-align:left;">' +
          '<div style="font-size:14.5px;font-weight:800;color:#000;margin-bottom:2px;">Mettre à jour cet événement</div>' +
          '<div style="font-size:11.5px;color:#8A93A0;line-height:1.4;">L\'événement d\'origine est remplacé. Ses assignations et son historique sont conservés.</div>' +
        '</button>' +

        '<button type="button" onclick="App.chooseEventSaveMode(\'duplicate\')" style="width:100%;background:#EEF5FF;border:1px solid #CCDEFF;border-radius:16px;padding:14px;margin-bottom:14px;cursor:pointer;text-align:left;">' +
          '<div style="font-size:14.5px;font-weight:800;color:#0B63F6;margin-bottom:2px;">➕ Créer un nouvel événement</div>' +
          '<div style="font-size:11.5px;color:#5A7BAA;line-height:1.4;">L\'ancien reste intact. Idéal pour répéter un événement : changez la date et dupliquez.</div>' +
        '</button>' +

        '<button type="button" onclick="App.cancelEventSaveChoice()" style="width:100%;background:none;border:none;padding:8px;font-size:13.5px;font-weight:700;color:#8A93A0;cursor:pointer;">Annuler</button>' +
      '</div>' +
    '</div>';
  }

  function renderCreateEventModal() {
    var today = new Date().toISOString().split('T')[0];
    var cData = S.createEventData || {};
    var isEdit = !!S.editEventId;
    var titleVal = cData.title !== undefined ? cData.title : '';
    var locVal = cData.location !== undefined ? cData.location : '';
    var dateVal = cData.date !== undefined ? cData.date : today;
    var startVal = cData.start !== undefined ? cData.start : '09:00';
    var endVal = cData.end !== undefined ? cData.end : '11:30';
    var descVal = cData.desc !== undefined ? cData.desc : '';
    var pinnedVal = !!cData.pinned;

    // Bloc image (une seule image par événement)
    var imageBlock = '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
      '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:12px;">Image de l\'événement <span style="font-weight:500;color:#8A93A0;">(optionnelle)</span></label>' +
      (S.eventImageProcessing
        ? '<div style="display:flex;align-items:center;gap:10px;background:#F6F7F9;border-radius:12px;padding:14px;">' +
            '<div style="width:18px;height:18px;border:3px solid #E2E4E9;border-top-color:#0B63F6;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
            '<span style="font-size:12.5px;font-weight:700;color:#25303F;">Traitement de l\'image…</span>' +
          '</div>'
        : (S.eventImage
          ? '<div style="position:relative;border-radius:14px;overflow:hidden;background:#000;">' +
              '<img src="' + S.eventImage + '" style="display:block;width:100%;height:auto;max-height:260px;object-fit:contain;background:#000;" />' +
              '<button type="button" onclick="App.editEventImage()" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.72);border:none;border-radius:10px;padding:6px 12px;color:#FFF;font-size:12.5px;font-weight:800;cursor:pointer;">Modifier</button>' +
              '<button type="button" onclick="App.removeEventImage()" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.72);border:none;border-radius:14px;width:32px;height:32px;color:#FFF;font-size:15px;font-weight:900;cursor:pointer;">×</button>' +
            '</div>'
          : '<label style="display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed #E4E7EC;border-radius:14px;padding:22px;cursor:pointer;color:#0B63F6;font-size:14px;font-weight:700;">' +
              'Ajouter une image' +
              '<input type="file" accept="image/*" onchange="App.addEventImage(event)" style="display:none;" />' +
            '</label>')) +
    '</div>';

    return '<div class="safe-top" style="position:fixed;inset:0;background:#FFF;z-index:10000;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      '<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #E4E7EC;background:#FFF;z-index:2;">' +
        '<button onclick="App.closeCreateEvent()" style="background:none;border:none;font-size:16px;color:#000;cursor:pointer;">Annuler</button>' +
        '<div style="font-weight:700;font-size:16px;">' + (isEdit ? 'Modifier l\'événement' : 'Nouvel Événement') + '</div>' +
        '<button onclick="App.saveEvent(this)" style="background:none;border:none;font-size:16px;font-weight:700;color:#0B63F6;cursor:pointer;">' + (isEdit ? 'Enregistrer' : 'Créer') + '</button>' +
      '</header>' +
      '<div style="flex:1;overflow-y:auto;background:#F6F7F9;padding:16px;">' +
        imageBlock +

        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
              '<label style="font-size:13px;color:#8A93A0;font-weight:600;">Titre de l\'événement</label>' +
              '<input type="text" id="eventTitle" value="' + safeHtml(titleVal) + '" placeholder="Ex: Culte de Dimanche" style="border:none;border-bottom:1px solid #E4E7EC;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;font-weight:600;" />' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
              '<label style="font-size:13px;color:#8A93A0;font-weight:600;">Lieu / Salle</label>' +
              '<input type="text" id="eventLocation" value="' + safeHtml(locVal) + '" placeholder="Ex: Salle Principale" style="border:none;border-bottom:1px solid #E4E7EC;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
            '</div>' +
            // Position du lieu : recherchée par son nom/adresse. On ne relève jamais
            // la position du créateur — il prépare l'événement à l'avance, souvent
            // de chez lui, sa position n'a donc rien à voir avec le lieu.
            '<div style="display:flex;flex-direction:column;gap:8px;">' +
              '<label style="font-size:13px;color:#8A93A0;font-weight:600;">Situer le lieu sur la carte <span style="font-weight:500;">(optionnel)</span></label>' +
              (typeof cData.lat === 'number'
                ? '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:10px 12px;">' +
                    '<div style="min-width:0;">' +
                      '<div style="font-size:12.5px;font-weight:800;color:#047857;">' + safeHtml(cData.placeName || 'Lieu situé') + '</div>' +
                      '<div style="font-size:11px;color:#5A6472;line-height:1.35;">' + safeHtml(cData.placeLabel || (cData.lat.toFixed(5) + ', ' + cData.lng.toFixed(5))) + '</div>' +
                    '</div>' +
                    '<button type="button" onclick="App.clearEventPosition()" style="background:none;border:none;color:#E2445C;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Changer</button>' +
                  '</div>'
                : '<div>' +
                    '<div style="display:flex;align-items:center;gap:8px;background:#F6F7F9;border-radius:12px;padding:0 12px;height:44px;">' +
                      '<span style="font-size:15px;">🔎</span>' +
                      '<input type="text" id="eventPlaceInput" value="' + safeHtml(S.eventPlaceQuery || '') + '" oninput="App.onEventPlaceInput(this.value)" placeholder="Ex : Église Vase d\'Honneur, Cocody" style="flex:1;border:none;background:transparent;font-size:14px;color:#000;outline:none;min-width:0;" />' +
                      '<span style="font-size:10px;font-weight:800;color:#8A93A0;background:#EAECF0;padding:2px 7px;border-radius:6px;flex-shrink:0;">🇨🇮 CI</span>' +
                      (S.eventPlaceSearching
                        ? '<div style="width:15px;height:15px;border:2.5px solid #E2E4E9;border-top-color:#0B63F6;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>'
                        : '') +
                    '</div>' +
                    (S.eventPlaceError
                      ? '<div style="font-size:11.5px;color:#B42318;font-weight:600;margin-top:6px;">' + safeHtml(S.eventPlaceError) + '</div>'
                      : '') +
                    '<div id="eventPlaceResults" style="margin-top:' + ((S.eventPlaceResults||[]).length ? '6px' : '0') + ';">' +
                      (S.eventPlaceResults||[]).map(function(r, i) {
                        return '<button type="button" onclick="App.selectEventPlace(' + i + ')" style="width:100%;text-align:left;background:#FFF;border:1px solid #EFEFEF;border-radius:12px;padding:9px 11px;margin-bottom:5px;cursor:pointer;display:block;">' +
                          '<div style="font-size:13px;font-weight:800;color:#0B0D12;">' + safeHtml(r.shortLabel) + '</div>' +
                          '<div style="font-size:11px;color:#8A93A0;line-height:1.35;">' + safeHtml(r.label) + '</div>' +
                        '</button>';
                      }).join('') +
                    '</div>' +
                  '</div>') +
              '<div style="font-size:11px;color:#8A93A0;line-height:1.4;">Un membre est considéré « sur place » s\'il enregistre son arrivée à moins de ' + formatDistance(ON_SITE_RADIUS_M) + ' de ce point. La distance de chacun sera visible de tous.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #E4E7EC;padding-bottom:12px;">' +
              '<label style="font-size:15px;color:#000;font-weight:600;white-space:nowrap;">Date</label>' +
              '<input type="date" id="eventDate" value="' + dateVal + '" style="border:none;font-size:16px;outline:none;background:transparent;color:#0B63F6;font-weight:600;text-align:right;" />' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #E4E7EC;padding-bottom:12px;">' +
              '<label style="font-size:15px;color:#000;font-weight:600;white-space:nowrap;">Heure de début</label>' +
              '<input type="time" id="eventStart" value="' + startVal + '" oninput="App.onEventTimeChange()" style="border:none;font-size:16px;outline:none;background:transparent;color:#0B63F6;font-weight:600;text-align:right;" />' +
            '</div>' +
            // Le message occupe sa PROPRE ligne sous le champ : placé dans la même
            // rangée que l'heure, il se superposait à la valeur et forçait le
            // libellé « Heure de fin » à passer sur deux lignes.
            '<div>' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
                '<label style="font-size:15px;color:#000;font-weight:600;white-space:nowrap;">Heure de fin</label>' +
                '<input type="time" id="eventEnd" value="' + endVal + '" oninput="App.onEventTimeChange()" style="border:none;font-size:16px;outline:none;background:transparent;color:#0B63F6;font-weight:600;text-align:right;" />' +
              '</div>' +
              // État initial calculé au rendu : à la réouverture d'une veillée
              // déjà enregistrée, la mention doit être visible sans toucher au champ.
              (function(){
                var msg = '', col = '#0B63F6', bg = '#E8EEFB';
                if (startVal && endVal && endVal === startVal) {
                  msg = 'La fin ne peut pas être identique au début.'; col = '#B42318'; bg = '#FEF2F2';
                } else if (startVal && endVal && endVal < startVal) {
                  msg = 'Se termine le lendemain à ' + endVal + '.';
                }
                return '<div id="eventTimeError" style="display:' + (msg ? 'block' : 'none') + ';font-size:11.5px;font-weight:700;line-height:1.4;margin-top:8px;padding:7px 10px;border-radius:10px;background:' + bg + ';color:' + col + ';">' + msg + '</div>';
              })() +
            '</div>' +
          '</div>' +
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:12px;">Pôles concernés</label>' +
          '<div id="eventSectionBadgesContainer">' + App.renderSectionBadges(S.eventSections, 'toggleEventSection') + '</div>' + 
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<label style="font-size:13px;color:#8A93A0;font-weight:600;display:block;margin-bottom:8px;">Description / Notes</label>' +
          '<textarea id="eventDesc" placeholder="Ajoutez un briefing ou des notes pour les équipes..." style="width:100%;border:none;font-size:15px;outline:none;resize:none;font-family:inherit;min-height:80px;background:#F6F7F9;padding:12px;border-radius:12px;box-sizing:border-box;">' + safeHtml(descVal) + '</textarea>' +
        '</div>' +
        
        (canAssign(S.user) ?
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:4px;">Assignations (Équipe)</label>' +
          '<div style="font-size:11.5px;color:#8A93A0;margin-bottom:12px;line-height:1.4;">' +
            (isGrandResponsable(S.user)
              ? 'Vous pouvez confier une tâche à un membre précis ou à un pôle entier — son responsable la répartira ensuite.'
              : 'Vous assignez les membres de votre pôle. Les autres responsables complètent pour le leur.') +
          '</div>' +
          '<div id="eventAssignmentsList">' + App.renderAssignmentsList() + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid #E4E7EC;padding-top:12px;">' +
            '<select id="assignUserSelect" style="width:100%;padding:10px;border-radius:8px;border:1px solid #E4E7EC;font-size:14px;outline:none;background:#F6F7F9;">' +
              '<option value="">Sélectionner un membre…</option>' +
              renderAssignSelectOptions(S.user) +
            '</select>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="text" id="assignTaskInput" placeholder="Tâche..." style="flex:1;padding:10px;border-radius:8px;border:1px solid #E4E7EC;font-size:14px;outline:none;background:#F6F7F9;" />' +
              '<button onclick="App.addAssignment()" style="background:#0B63F6;color:#FFF;border:none;border-radius:8px;padding:0 16px;font-weight:700;cursor:pointer;">Ajouter</button>' +
            '</div>' +
          '</div>' +
        '</div>' : '') +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' +
            '<div style="font-size:15px;font-weight:600;color:#000;">Épingler en haut du Feed</div>' +
            '<div style="font-size:12px;color:#8A93A0;margin-top:2px;">Rend l\'événement très visible</div>' +
          '</div>' +
          '<label style="position:relative;display:inline-block;width:50px;height:30px;">' +
            '<input type="checkbox" id="eventPinned"' + (pinnedVal ? ' checked' : '') + ' style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#0E9F6E\':\'#E4E7EC\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';">' +
            '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (pinnedVal ? '#0E9F6E' : '#E4E7EC') + ';transition:.3s;border-radius:30px;">' +
              '<span style="position:absolute;content:\'\';height:26px;width:26px;left:2px;bottom:2px;background-color:white;transition:.3s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);transform:' + (pinnedVal ? 'translateX(20px)' : 'translateX(0)') + ';"></span>' +
            '</span>' +
          '</label>' +
        '</div>' +

      '</div>' +
    '</div>';
  }
  function renderEditPostModal() {
    if (!S.editPostId) return '';
    var posts = db(SK.POSTS, []);
    var post = posts.find(function(p){ return p.id === S.editPostId; });
    if (!post) return '';

    var vis = S.postVisibility || post.visibility || 'all';
    var schedDateVal = '';
    var schedTimeVal = '';
    if (post.scheduled_at) {
      var d = new Date(post.scheduled_at);
      schedDateVal = d.toISOString().split('T')[0];
      schedTimeVal = d.toTimeString().split(' ')[0].slice(0, 5);
    }

    var previewHtml = renderComposerMediaPreview();

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#E8EEFB;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:#0B63F6;width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+h+'\')" style="background:#0B63F6;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeEditPost()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeEditPost()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeEditPost()" style="font-size:14.5px;color:#5A6472;cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#0B0D12;letter-spacing:-0.2px;">Modifier la publication</h3>' +
          '<button type="button" onclick="App.saveEditPost(\'' + post.id + '\')" style="font-size:14px;color:#FFF;font-weight:800;background:#0B63F6;border:none;border-radius:20px;padding:8px 18px;cursor:pointer;box-shadow:0 4px 12px rgba(0,122,255,0.28);">Enregistrer</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#E8EEFB;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;"></div>' +
          previewHtml +

          (S.pendingMedia.length === 0 && S.postBg
            ? '<div id="bgPreviewZone" style="border-radius:22px;overflow:hidden;margin-bottom:14px;position:relative;min-height:180px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,0.14);' + (S.postBg.startsWith('url') ? 'background:' + S.postBg + ';background-size:cover;background-position:center;' : 'background:' + S.postBg + ';') + '">' +
                (S.postBg && !S.postBg.includes('linear-gradient') && !S.postBg.includes('url') ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.18);border-radius:22px;"></div>' : '') +
                '<textarea id="editPostText" oninput="App.onPostInput(this.value)" placeholder="Modifiez votre texte..." style="width:100%;min-height:180px;border:none;background:transparent;font-size:24px;font-weight:900;line-height:1.4;color:#FFF;resize:none;outline:none;box-sizing:border-box;font-family:inherit;text-align:center;padding:24px 20px;text-shadow:0 2px 12px rgba(0,0,0,0.3);position:relative;z-index:1;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</div>'
            : '<textarea id="editPostText" oninput="App.onPostInput(this.value)" placeholder="Modifiez votre texte... Tapez @ pour mentionner un membre..." style="width:100%;min-height:120px;border:none;background:#F6F7F9;border-radius:18px;padding:14px;font-size:15.5px;line-height:1.55;color:#0B0D12;resize:none;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:14px;">' + safeHtml(S.postText||'') + '</textarea>'
          ) +

          '<!-- Confidentialité -->' +
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:#0B0D12;display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:13px;background:#E8EEFB;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">🔒</span>Qui peut voir cette publication ?</span>' +
            '<div style="display:flex;gap:4px;background:#EAEBEF;border-radius:16px;padding:3px;">' +
              '<button type="button" onclick="App.setPostVisibility(\'all\')" style="flex:1;padding:8px 6px;border-radius:13px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + (vis==='all'?'#FFFFFF':'transparent') + ';color:' + (vis==='all'?'#0B63F6':'#5A6472') + ';box-shadow:' + (vis==='all'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">🌍 Tout le monde</button>' +
              '<button type="button" onclick="App.setPostVisibility(\'sections\')" style="flex:1;padding:8px 6px;border-radius:13px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + (vis==='sections'?'#FFFFFF':'transparent') + ';color:' + (vis==='sections'?'#0B63F6':'#5A6472') + ';box-shadow:' + (vis==='sections'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">Sections ciblées</button>' +
            '</div>' +
            (vis === 'sections'
              ? '<div style="margin-top:10px;">' +
                  '<label style="font-size:12px;color:#8A93A0;font-weight:600;display:block;margin-bottom:6px;">Cliquer sur les sections autorisées :</label>' +
                  '<div id="targetSectionBadgesContainer">' + App.renderSectionBadges(S.postTargetSections||[], 'toggleTargetSection') + '</div>' +
                '</div>'
              : '') +
          '</div>' +

          '<!-- Programmation -->' +
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:#0B0D12;display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:13px;background:#FFF3E5;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">⏰</span>Programmer la publication</span>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="date" id="editPostScheduleDate" value="' + schedDateVal + '" style="flex:1;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 10px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);" />' +
              '<input type="time" id="editPostScheduleTime" value="' + schedTimeVal + '" style="flex:1;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 10px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);" />' +
            '</div>' +
          '</div>' +

          '<!-- À propos -->' +
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (S.postAboutEventId?'10px':'0') + ';">' +
              '<span style="font-size:13px;font-weight:800;color:#0B0D12;display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:13px;background:#E8EEFB;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">🗓️</span>À propos <span style="font-weight:600;color:#8A93A0;font-size:11px;">(optionnel)</span></span>' +
              (S.postAboutEventId ? '<span onclick="App.clearAboutEvent()" style="color:#E2445C;font-size:12px;font-weight:700;cursor:pointer;">Retirer</span>' : '') +
            '</div>' +
            (function(){
              if (!S.postAboutEventId) {
                return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;background:#FFF;border:1px dashed #E4E7EC;border-radius:12px;padding:10px;font-size:12.5px;font-weight:700;color:#0B63F6;cursor:pointer;">+ Lier à un événement (ex : culte de dimanche)</button>';
              }
              var evAbout2 = db(SK.POSTS, []).find(function(p){ return p.id === S.postAboutEventId; });
              if (!evAbout2) return '';
              var evAbout2D = evAbout2.eventDate ? new Date(evAbout2.eventDate+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) : '';
              return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;display:flex;align-items:center;gap:8px;background:#FFF;border-radius:12px;padding:10px;text-align:left;border:none;cursor:pointer;">' +
                '<span style="font-size:16px;">🗓️</span>' +
                '<span style="flex:1;min-width:0;font-size:12.5px;font-weight:700;color:#0B0D12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(evAbout2.eventTitle||'') + (evAbout2D?' · '+evAbout2D:'') + (evAbout2.eventStart?' à '+evAbout2.eventStart:'') + '</span>' +
              '</button>';
            })() +
          '</div>' +

          '<!-- Éphémère -->' +
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="width:26px;height:26px;border-radius:13px;background:#FFEDE0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;">🕐</span>' +
                '<div>' +
                  '<div style="font-size:13px;font-weight:800;color:#0B0D12;">Publication éphémère</div>' +
                  '<div style="font-size:11px;color:#8A93A0;">Disparaît automatiquement après 24h</div>' +
                '</div>' +
              '</div>' +
              '<label style="position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0;">' +
                '<input type="checkbox" id="editPostEphemeral" ' + (post.is_ephemeral ? 'checked' : '') + ' style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#D98A0B\':\'#DADCE1\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';"/>' +
                '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (post.is_ephemeral?'#D98A0B':'#DADCE1') + ';transition:.25s;border-radius:28px;">' +
                  '<span style="position:absolute;content:\'\';height:22px;width:22px;left:3px;bottom:3px;background-color:white;transition:.25s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);transform:' + (post.is_ephemeral?'translateX(20px)':'translateX(0)') + ';"></span>' +
                '</span>' +
              '</label>' +
            '</div>' +
          '</div>' +

        '</div>' +

        '<div style="padding:4px 16px 14px;">' +
          (S.pendingMedia.length === 0
            ? '<div style="display:flex;gap:8px;align-items:center;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none;">' +
                '<span style="font-size:11px;font-weight:700;color:#8A93A0;flex-shrink:0;">Fond</span>' +
                '<div onclick="App.setPostBg(null)" style="width:30px;height:30px;border-radius:15px;background:#FFF;border:2px solid ' + (S.postBg===null?'#0B63F6':'#E4E7EC') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:#25303F;">Aa</div>' +
                [
                  'linear-gradient(135deg,#1A1A2E,#16213E)',
                  'linear-gradient(135deg,#FF6B6B,#FF8E53)',
                  'linear-gradient(135deg,#4ECDC4,#2ECC71)',
                  'linear-gradient(135deg,#667EEA,#764BA2)',
                  'linear-gradient(135deg,#F093FB,#F5576C)',
                  'linear-gradient(135deg,#4481EB,#04BEFE)',
                  'linear-gradient(135deg,#0F2027,#203A43,#2C5364)',
                  'linear-gradient(135deg,#FFA62E,#EA4D2C)',
                  'linear-gradient(135deg,#56AB2F,#A8E063)',
                  'linear-gradient(135deg,#373B44,#4286F4)',
                  'linear-gradient(135deg,#C94B4B,#4B134F)',
                  'linear-gradient(135deg,#F7971E,#FFD200)',
                ].map(function(bg, idx) {
                  var isSel = S.postBg === bg;
                  return '<div onclick="App.setPostBgIdx(' + idx + ')" style="width:30px;height:30px;border-radius:15px;background:' + bg + ';cursor:pointer;flex-shrink:0;border:2.5px solid ' + (isSel?'#FFF':'transparent') + ';box-shadow:' + (isSel?'0 0 0 2px #0B63F6':'0 1px 3px rgba(0,0,0,0.15)') + ';transition:0.15s;"></div>';
                }).join('') +
              '</div>'
            : ''
          ) +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;color:#0B63F6;font-size:12.5px;font-weight:800;background:#E8EEFB;padding:9px 14px;border-radius:16px;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B63F6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
              'Photo / Vidéo' +
              '<input type="file" accept="image/*,video/*" multiple onchange="App.addMedia(event)" style="display:none;">' +
            '</label>' +
            '<span style="font-size:11.5px;color:#8A93A0;font-weight:600;">' + (S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? '1 vidéo' : S.pendingMedia.length + '/10 photos') + '</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:12px;color:#5A6472;font-weight:600;line-height:1.4;background:#F6F7F9;padding:10px 12px;border-radius:14px;"><input type="checkbox" ' + (S.reduceVideoQuality?'checked':'') + ' onchange="App.toggleReduceVideoQuality()" style="width:17px;height:17px;flex-shrink:0;accent-color:#0B63F6;"> 🎥 Nous réduisons la qualité vidéo en HD pour une expérience plus fluide</label>' +
        '</div>' +

      '</div>' +
    '</div>';
  }

  function renderRepostModal() {
    if (!S.repostPostId) return '';
    var posts = db(SK.POSTS, []);
    var post = posts.find(function(p){ return p.id === S.repostPostId; });
    if (!post) return '';

    var previewCaption = post.caption || '';
    var previewMedia = (post.mediaUrls && post.mediaUrls[0]) || null;

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#E8EEFB;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:#0B63F6;width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+h+'\')" style="background:#0B63F6;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeRepostModal()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeRepostModal()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeRepostModal()" style="font-size:14.5px;color:#5A6472;cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#0B0D12;letter-spacing:-0.2px;">Partager</h3>' +
          '<button type="button" onclick="App.confirmRepost()" style="font-size:14px;color:#FFF;font-weight:800;background:#0B63F6;border:none;border-radius:20px;padding:8px 18px;cursor:pointer;box-shadow:0 4px 12px rgba(0,122,255,0.28);">Partager</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#E8EEFB;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;"></div>' +
          '<textarea id="repostText" oninput="App.onPostInput(this.value)" placeholder="Ajoutez un commentaire... Tapez # pour un hashtag ou @ pour mentionner un membre..." style="width:100%;min-height:90px;border:none;background:#F6F7F9;border-radius:18px;padding:14px;font-size:15.5px;line-height:1.55;color:#0B0D12;resize:none;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:14px;">' + safeHtml(S.postText||'') + '</textarea>' +

          '<div style="background:#F6F7F9;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="padding:10px 12px;">' +
              '<strong style="font-size:13px;color:#0B0D12;">' + safeHtml(post.author||'Membre') + '</strong>' +
            '</div>' +
            (previewMedia
              ? (isVideoUrl(previewMedia)
                  ? '<video src="'+previewMedia+'"' + (post.videoPoster ? ' poster="'+post.videoPoster+'"' : '') + ' muted preload="metadata" style="width:100%;max-height:220px;object-fit:cover;display:block;background:#000;"></video>'
                  : '<img src="'+previewMedia+'" style="width:100%;max-height:220px;object-fit:cover;display:block;">')
              : (post.postBg
                  ? '<div style="min-height:100px;display:flex;align-items:center;justify-content:center;padding:20px;background:' + post.postBg + ';"><p style="color:#FFF;font-size:15px;font-weight:800;text-align:center;margin:0;">' + safeHtml(previewCaption.slice(0,140)) + '</p></div>'
                  : '<p style="font-size:13.5px;color:#25303F;margin:0;padding:12px;line-height:1.4;">' + safeHtml(previewCaption.slice(0,200)) + '</p>')
            ) +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
  }

  // ============================================================
  // "À PROPOS" — sélecteur d'événement à lier à une publication
  // ============================================================
  function renderAboutEventItemBtn(ev) {
    var evDate = ev.eventDate ? new Date(ev.eventDate + 'T00:00:00') : null;
    var evMonth = evDate ? evDate.toLocaleDateString('fr-FR', {month:'short'}).toUpperCase() : '';
    var evDay = evDate ? evDate.getDate() : '';
    var isSel = S.postAboutEventId === ev.id;
    return '<button type="button" onclick="App.selectAboutEvent(\''+ev.id+'\')" style="width:100%;display:flex;align-items:center;gap:12px;background:' + (isSel?'#E8EEFB':'#F8F8FA') + ';border:1.5px solid ' + (isSel?'#0B63F6':'transparent') + ';border-radius:16px;padding:12px;margin-bottom:10px;cursor:pointer;text-align:left;">' +
      '<div style="background:#FFF;border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.06);width:44px;text-align:center;flex-shrink:0;">' +
        '<div style="background:#0B63F6;color:#FFF;font-size:8.5px;font-weight:900;text-transform:uppercase;padding:3px 0;letter-spacing:0.5px;">' + evMonth + '</div>' +
        '<div style="font-size:18px;font-weight:900;color:#000;padding:3px 0;">' + evDay + '</div>' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:14px;font-weight:800;color:#0B0D12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(ev.eventTitle) + '</div>' +
        '<div style="font-size:12px;color:#8A93A0;margin-top:2px;">' + (ev.eventStart ? '' + ev.eventStart + (ev.eventEnd ? ' — ' + ev.eventEnd : '') : '') + '</div>' +
      '</div>' +
      (isSel ? '<span style="color:#0B63F6;font-size:18px;">✓</span>' : '') +
    '</button>';
  }

  // Construit la liste (À venir + Passés, pour permettre de lier une publication à un
  // récap d'un événement déjà passé), filtrée par la recherche en cours.
  function renderAboutEventListHtml() {
    var allPosts = db(SK.POSTS, []);
    var todayIso = new Date().toISOString().split('T')[0];
    var q = (S.aboutEventSearch || '').trim().toLowerCase();
    var all = allPosts.filter(function(p){
      if (p.type !== 'EVENT' || !p.eventTitle) return false;
      if (q && p.eventTitle.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var upcoming = all.filter(function(p){ return p.eventDate >= todayIso; }).sort(function(a,b){
      if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate);
      return (a.eventStart||'').localeCompare(b.eventStart||'');
    });
    var past = all.filter(function(p){ return p.eventDate < todayIso; }).sort(function(a,b){
      if (a.eventDate !== b.eventDate) return b.eventDate.localeCompare(a.eventDate);
      return (b.eventStart||'').localeCompare(a.eventStart||'');
    });

    if (upcoming.length === 0 && past.length === 0) {
      return '<div style="text-align:center;padding:36px 20px;color:#8A93A0;">' +
        '<div style="font-size:38px;margin-bottom:10px;">🗓️</div>' +
        '<div style="font-size:15px;font-weight:800;color:#000;">' + (q ? 'Aucun résultat' : 'Aucun événement') + '</div>' +
        '<div style="font-size:13px;margin-top:4px;">' + (q ? 'Essayez un autre mot-clé.' : 'Créez un événement dans Planning & Cultes pour pouvoir le lier ici.') + '</div>' +
      '</div>';
    }

    var html = '';
    if (upcoming.length > 0) {
      html += '<div style="font-size:11px;font-weight:800;color:#8A93A0;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 8px;">🔜 À venir</div>' +
        upcoming.map(renderAboutEventItemBtn).join('');
    }
    if (past.length > 0) {
      html += '<div style="font-size:11px;font-weight:800;color:#8A93A0;text-transform:uppercase;letter-spacing:0.5px;margin:' + (upcoming.length>0?'14px':'4px') + ' 0 8px;">Passés · pour un récap</div>' +
        past.map(renderAboutEventItemBtn).join('');
    }
    return html;
  }

  function renderAboutEventPickerModal() {
    return '<div onclick="App.closeAboutEventPicker()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10001;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeAboutEventPicker()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeAboutEventPicker()" style="font-size:14.5px;color:#5A6472;cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#0B0D12;">À propos de quel événement ?</h3>' +
          '<span style="width:52px;"></span>' +
        '</div>' +
        '<div style="padding:0 16px 10px;">' +
          '<div style="display:flex;align-items:center;gap:8px;background:#F6F7F9;border-radius:12px;height:38px;padding:0 12px;">' +
            SVG.search +
            '<input id="aboutEventSearchInput" type="search" value="' + safeHtml(S.aboutEventSearch||'') + '" oninput="App.searchAboutEvents(this.value)" placeholder="Rechercher un événement (à venir ou passé)..." style="flex:1;border:none;background:transparent;font-size:13.5px;color:#000;outline:none;">' +
          '</div>' +
        '</div>' +
        '<div id="aboutEventListContainer" style="overflow-y:auto;flex:1;padding:4px 16px 20px;">' + renderAboutEventListHtml() + '</div>' +
      '</div>' +
    '</div>';
  }

  // Copies locales (data:URL) des photos déjà envoyées vers Supabase Storage, gardées
  // uniquement le temps de la composition : permet de rouvrir le recadrage "Modifier"
  // sur une image du même domaine. Vidé dès que le composeur se ferme (mémoire).
  var _pendingLocalCopies = {};
  function clearPendingLocalCopies() { _pendingLocalCopies = {}; }

  // Aperçu des médias en cours de composition (création ET modification).
  // Une vidéo s'affiche en grand avec ses contrôles natifs pour pouvoir être relue
  // avant publication (comme Facebook/Instagram) ; les photos restent en vignettes.
  function renderComposerMediaPreview() {
    if (S.videoProcessing) {
      // Pendant le traitement : dès que la vignette est prête (générée en premier,
      // avant compression/upload), on l'affiche en grand avec l'indicateur par-dessus
      // — l'utilisateur voit tout de suite quelle vidéo est en cours d'ajout.
      if (S.pendingVideoPoster) {
        return '<div style="position:relative;margin-bottom:12px;border-radius:18px;overflow:hidden;background:#000;">' +
          '<img src="' + S.pendingVideoPoster + '" style="width:100%;max-height:300px;object-fit:contain;display:block;background:#000;" />' +
          '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">' +
            '<div style="width:26px;height:26px;border:3px solid rgba(255,255,255,0.35);border-top-color:#FFF;border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
            '<span style="font-size:12px;font-weight:700;color:#FFF;text-align:center;padding:0 16px;">' + (S.reduceVideoQuality ? 'Traitement de la vidéo (HD)…' : 'Traitement de la vidéo…') + '</span>' +
          '</div>' +
        '</div>';
      }
      return '<div style="display:flex;align-items:center;gap:10px;background:#F6F7F9;border-radius:16px;padding:14px;margin-bottom:12px;">' +
        '<div style="width:20px;height:20px;border:3px solid #E2E4E9;border-top-color:#0B63F6;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
        '<span style="font-size:12.5px;font-weight:700;color:#25303F;">' + (S.reduceVideoQuality ? 'Traitement de la vidéo (HD)…' : 'Traitement de la vidéo…') + '</span>' +
      '</div>';
    }
    if (S.pendingMedia.length === 0) return '';

    var videoUrl = S.pendingMedia.find(function(m){ return isVideoUrl(m); });
    if (videoUrl) {
      return '<div style="position:relative;margin-bottom:12px;border-radius:18px;overflow:hidden;background:#000;">' +
        '<video src="' + videoUrl + '"' + (S.pendingVideoPoster ? ' poster="' + S.pendingVideoPoster + '"' : '') +
          ' controls playsinline preload="auto" onloadeddata="App.primeVideoFrame(this)" style="width:100%;max-height:300px;display:block;background:#000;"></video>' +
        '<button type="button" onclick="App.removeMedia(0)" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.65);border:none;border-radius:14px;width:32px;height:32px;color:#FFF;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:2;">×</button>' +
      '</div>';
    }

    // Photos : affichage empilé pleine largeur, chacune à ses proportions réelles
    // (aucun recadrage imposé), avec les boutons "Modifier" et "✕" façon Facebook.
    return '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px;">' +
      S.pendingMedia.map(function(url, i) {
        return '<div style="position:relative;border-radius:14px;overflow:hidden;background:#000;">' +
          '<img src="'+url+'" style="display:block;width:100%;height:auto;max-height:420px;object-fit:contain;background:#000;">' +
          '<button type="button" onclick="App.editPendingMedia('+i+')" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.72);border:none;border-radius:10px;padding:6px 12px;color:#FFF;font-size:12.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;z-index:2;">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
            'Modifier' +
          '</button>' +
          '<button type="button" onclick="App.removeMedia('+i+')" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.72);border:none;border-radius:14px;width:28px;height:28px;color:#FFF;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:2;">×</button>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  // Bloc « Enregistrer mon arrivée » du composeur — distinct du champ « À propos ».
  // C'est LUI qui déclenche le relevé de position et le calcul de la ponctualité ;
  // mentionner un événement dans « À propos » ne vaut pas pointage.
  function renderCheckInBlock() {
    if (!S.user) return '';
    var posts = db(SK.POSTS, []);
    var now = Date.now();
    var today = new Date().toISOString().split('T')[0];

    var candidates = pendingCheckIns(S.user, posts, now);

    var selectedId = S.postCheckInEventId;
    if (!candidates.length && !selectedId) return '';

    var selectedEv = selectedId ? posts.find(function(p){ return p.id === selectedId; }) : null;

    if (selectedEv) {
      var startTsSel = eventStartTimestamp(selectedEv);
      var delay = startTsSel ? Math.round((now - startTsSel) / 60000) : 0;
      var stars = starsForDelay(delay);
      var col = stars >= 4 ? '#0E9F6E' : stars >= 2 ? '#D98A0B' : '#E2445C';
      return '<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:16px;padding:12px 14px;margin-bottom:10px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">' +
          '<span style="font-size:12.5px;font-weight:800;color:#047857;min-width:0;overflow-wrap:anywhere;">Arrivée : ' + safeHtml(selectedEv.eventTitle || 'Événement') + '</span>' +
          '<button type="button" onclick="App.clearCheckInEvent()" style="background:none;border:none;color:#E2445C;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Retirer</button>' +
        '</div>' +
        '<div style="font-size:11.5px;color:#5A6472;line-height:1.45;">' +
          'En publiant maintenant : <b style="color:' + col + ';">' + (stars>0?'+':'') + stars + '★</b> de ponctualité' +
          (delay > 0 ? ' (retard de ' + delay + ' min)' : ' (à l\'heure)') + '.' +
        '</div>' +
        '<div style="font-size:10.5px;color:#8A93A0;line-height:1.4;margin-top:6px;">Votre position sera relevée et visible de tous. Elle ne pourra plus être retirée.</div>' +
      '</div>';
    }

    return '<div style="background:#FFF7E6;border:1px solid #FFE0A3;border-radius:16px;padding:12px 14px;margin-bottom:10px;">' +
      '<div style="font-size:12.5px;font-weight:800;color:#8A5A00;margin-bottom:6px;">Enregistrer mon arrivée</div>' +
      '<div style="font-size:11.5px;color:#5A6472;line-height:1.45;margin-bottom:8px;">Vous êtes de service ' + (candidates.length > 1 ? 'sur ces événements' : 'sur cet événement') + '. Pointez pour valider votre ponctualité.</div>' +
      candidates.map(function(ev) {
        var st = eventStartTimestamp(ev);
        var dl = st ? Math.round((now - st) / 60000) : 0;
        var sc = starsForDelay(dl);
        var c = sc >= 4 ? '#0E9F6E' : sc >= 2 ? '#D98A0B' : '#E2445C';
        return '<button type="button" onclick="App.setCheckInEvent(\'' + ev.id + '\')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:#FFF;border:1px solid #F0E0BC;border-radius:12px;padding:10px 12px;margin-bottom:6px;cursor:pointer;text-align:left;">' +
          '<span style="min-width:0;">' +
            '<span style="display:block;font-size:13px;font-weight:800;color:#0B0D12;overflow-wrap:anywhere;">' + safeHtml(ev.eventTitle || 'Événement') + '</span>' +
            '<span style="display:block;font-size:11px;color:#8A93A0;">' + safeHtml(ev.eventStart || '') + (dl > 0 ? ' · retard de ' + dl + ' min' : ' · à l\'heure') + '</span>' +
          '</span>' +
          '<span style="font-size:13px;font-weight:900;color:' + c + ';white-space:nowrap;">' + (sc>0?'+':'') + sc + '★</span>' +
        '</button>';
      }).join('') +
      '<div style="font-size:10.5px;color:#8A93A0;line-height:1.4;">Le pointage relève votre position, visible de tous et non retirable.</div>' +
    '</div>';
  }

  function renderCreateModal(u) {
    var previewHtml = renderComposerMediaPreview();

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#E8EEFB;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:#0B63F6;width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+h+'\')" style="background:#0B63F6;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeCreate()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeCreate()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeCreate()" style="font-size:14.5px;color:#5A6472;cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#0B0D12;letter-spacing:-0.2px;">Nouvelle publication</h3>' +
          '<button type="submit" form="createPostForm" style="font-size:14px;color:#FFF;font-weight:800;background:#0B63F6;border:none;border-radius:20px;padding:8px 18px;cursor:pointer;box-shadow:0 4px 12px rgba(0,122,255,0.28);">Publier</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
            ((u && u.avatar_url)
              ? '<img src="' + u.avatar_url + '" style="width:42px;height:42px;border-radius:21px;object-fit:cover;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,0.12);" />'
              : '<div style="width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,' + ((u||{}).avatar_color||'#0B63F6') + ',#0B63F6);color:#FFF;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,0.12);">' + ((u&&u.prenom||'M').charAt(0)) + '</div>') +
            '<div>' +
              '<div style="font-size:14.5px;font-weight:800;color:#0B0D12;">' + safeHtml((u&&u.prenom||'') + ' ' + (u&&u.nom||'')) + '</div>' +
              '<div style="font-size:11.5px;color:#0B63F6;font-weight:700;background:#EEF5FF;display:inline-block;padding:2px 8px;border-radius:8px;margin-top:2px;">' + secNom((u&&u.section_id)||'cadrage') + ' · Tapez # pour les hashtags</div>' +
            '</div>' +
          '</div>' +

          // Le pointage passe en tête du formulaire : quand on est de service,
          // c'est l'action la plus urgente, elle ne doit pas être enfouie tout en bas.
          renderCheckInBlock() +

          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#E8EEFB;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;"></div>' +
          previewHtml +

          // Color preview or plain textarea — hauteur généreuse et garantie, tout le
          // reste (options, footer) défile désormais avec elle dans le même conteneur.
          (S.pendingMedia.length === 0 && S.postBg
            ? '<div id="bgPreviewZone" style="border-radius:22px;overflow:hidden;margin-bottom:14px;position:relative;min-height:180px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,0.14);' + (S.postBg.startsWith('url') ? 'background:' + S.postBg + ';background-size:cover;background-position:center;' : 'background:' + S.postBg + ';') + '">' +
                (S.postBg && !S.postBg.includes('linear-gradient') && !S.postBg.includes('url') ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.18);border-radius:22px;"></div>' : '') +
                '<textarea id="newPostText" oninput="App.onPostInput(this.value)" placeholder="Quoi de neuf ?" style="width:100%;min-height:180px;border:none;background:transparent;font-size:24px;font-weight:900;line-height:1.4;color:#FFF;resize:none;outline:none;box-sizing:border-box;font-family:inherit;text-align:center;padding:24px 20px;text-shadow:0 2px 12px rgba(0,0,0,0.3);position:relative;z-index:1;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</div>'
            : '<form id="createPostForm" onsubmit="App.submitPost(event)">' +
                '<textarea id="newPostText" oninput="App.onPostInput(this.value)" placeholder="Quoi de neuf ? Tapez # pour ajouter un hashtag de section..." style="width:100%;min-height:140px;border:none;background:transparent;font-size:15.5px;line-height:1.55;color:#0B0D12;resize:none;outline:none;box-sizing:border-box;font-family:inherit;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</form>'
          ) +
          (S.postBg ? '<form id="createPostForm" onsubmit="App.submitPost(event)" style="display:none;"></form>' : '') +

          // Aperçu du lien collé
          (S.linkPreviewLoading
            ? '<div style="display:flex;align-items:center;gap:9px;border:0.5px solid ' + UI.line2 + ';border-radius:' + UI.r1 + ';padding:12px;margin-bottom:12px;color:' + UI.faint + ';font-size:12.5px;">' +
                '<div style="width:15px;height:15px;border:2px solid ' + UI.line2 + ';border-top-color:' + UI.accent + ';border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div>' +
                'Chargement de l\'aperçu du lien…' +
              '</div>'
            : (S.linkPreview
                ? '<div style="position:relative;margin-bottom:12px;">' +
                    renderLinkPreviewCard(S.linkPreview, { compact: true, noLink: true }) +
                    '<button type="button" onclick="App.dismissLinkPreview()" title="Retirer l\'aperçu" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:32px;height:32px;color:#FFF;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">×</button>' +
                  '</div>'
                : '')) +

          // Qui peut voir
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
              '<span style="font-size:13px;font-weight:800;color:#0B0D12;display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:13px;background:#E8EEFB;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">🔒</span>Qui peut voir ?</span>' +
            '</div>' +
            '<div style="display:flex;gap:4px;background:#EAEBEF;border-radius:16px;padding:3px;">' +
              '<button type="button" onclick="App.setPostVisibility(\'all\')" style="flex:1;padding:8px 6px;border-radius:13px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + ((S.postVisibility||'all')==='all'?'#FFFFFF':'transparent') + ';color:' + ((S.postVisibility||'all')==='all'?'#0B63F6':'#5A6472') + ';box-shadow:' + ((S.postVisibility||'all')==='all'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">🌍 Tout le monde</button>' +
              '<button type="button" onclick="App.setPostVisibility(\'sections\')" style="flex:1;padding:8px 6px;border-radius:13px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + ((S.postVisibility||'all')==='sections'?'#FFFFFF':'transparent') + ';color:' + ((S.postVisibility||'all')==='sections'?'#0B63F6':'#5A6472') + ';box-shadow:' + ((S.postVisibility||'all')==='sections'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">Sections ciblées</button>' +
            '</div>' +
            (S.postVisibility === 'sections'
              ? '<div style="margin-top:10px;"><div id="targetSectionBadgesContainer">' + App.renderSectionBadges(S.postTargetSections||[], 'toggleTargetSection') + '</div></div>'
              : '') +
          '</div>' +

          // Programmer
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:#0B0D12;display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:13px;background:#FFF3E5;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">⏰</span>Programmer <span style="font-weight:600;color:#8A93A0;font-size:11px;">(optionnel)</span></span>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="date" id="postScheduleDate" style="flex:1;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 10px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);" />' +
              '<input type="time" id="postScheduleTime" style="flex:1;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 10px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);" />' +
            '</div>' +
          '</div>' +

          // À propos
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (S.postAboutEventId?'10px':'0') + ';">' +
              '<span style="font-size:13px;font-weight:800;color:#0B0D12;display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:13px;background:#E8EEFB;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">🗓️</span>À propos <span style="font-weight:600;color:#8A93A0;font-size:11px;">(optionnel)</span></span>' +
              (S.postAboutEventId ? '<span onclick="App.clearAboutEvent()" style="color:#E2445C;font-size:12px;font-weight:700;cursor:pointer;">Retirer</span>' : '') +
            '</div>' +
            (function(){
              if (!S.postAboutEventId) {
                return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;background:#FFF;border:1px dashed #E4E7EC;border-radius:12px;padding:10px;font-size:12.5px;font-weight:700;color:#0B63F6;cursor:pointer;">+ Lier à un événement (ex : culte de dimanche)</button>';
              }
              var evAbout = db(SK.POSTS, []).find(function(p){ return p.id === S.postAboutEventId; });
              if (!evAbout) return '';
              var evAboutD = evAbout.eventDate ? new Date(evAbout.eventDate+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) : '';
              return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;display:flex;align-items:center;gap:8px;background:#FFF;border-radius:12px;padding:10px;text-align:left;border:none;cursor:pointer;">' +
                '<span style="font-size:16px;">🗓️</span>' +
                '<span style="flex:1;min-width:0;font-size:12.5px;font-weight:700;color:#0B0D12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(evAbout.eventTitle||'') + (evAboutD?' · '+evAboutD:'') + (evAbout.eventStart?' à '+evAbout.eventStart:'') + '</span>' +
              '</button>';
            })() +
          '</div>' +

          // Sondage
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (S.pollOpen?'10px':'0') + ';">' +
              '<span style="font-size:13px;font-weight:800;color:#0B0D12;display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:13px;background:#E6F9F0;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">📊</span>Sondage <span style="font-weight:600;color:#8A93A0;font-size:11px;">(optionnel)</span></span>' +
              (S.pollOpen ? '<span onclick="App.togglePoll()" style="color:#E2445C;font-size:12px;font-weight:700;cursor:pointer;">Retirer</span>' : '') +
            '</div>' +
            (S.pollOpen
              ? (
                  '<input type="text" value="' + safeHtml(S.pollQuestion||'') + '" oninput="App.setPollQuestion(this.value)" placeholder="Posez votre question…" maxlength="140" style="width:100%;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 12px;font-size:13px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);margin-bottom:8px;box-sizing:border-box;" />' +
                  (S.pollOptions||[]).map(function(opt, idx) {
                    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">' +
                      '<input type="text" value="' + safeHtml(opt||'') + '" oninput="App.setPollOption(' + idx + ', this.value)" placeholder="Option ' + (idx+1) + '" maxlength="60" style="flex:1;height:38px;border-radius:11px;border:none;background:#FFF;padding:0 12px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);box-sizing:border-box;" />' +
                      (S.pollOptions.length > 2 ? '<button type="button" onclick="App.removePollOption(' + idx + ')" style="width:32px;height:32px;flex-shrink:0;border-radius:10px;border:none;background:#FFF0EF;color:#E2445C;font-size:16px;font-weight:800;cursor:pointer;">×</button>' : '') +
                    '</div>';
                  }).join('') +
                  (S.pollOptions.length < 5
                    ? '<button type="button" onclick="App.addPollOption()" style="background:#FFF;border:1px dashed #E4E7EC;border-radius:12px;padding:8px 12px;font-size:12px;font-weight:700;color:#0B63F6;cursor:pointer;width:100%;margin-top:2px;">+ Ajouter une option</button>'
                    : '') +
                  '<div style="font-size:10.5px;color:#8A93A0;line-height:1.4;margin-top:6px;">Une seule réponse par membre. Question et au moins 2 options requises.</div>'
                )
              : '<button type="button" onclick="App.togglePoll()" style="width:100%;background:#FFF;border:1px dashed #E4E7EC;border-radius:12px;padding:10px;font-size:12.5px;font-weight:700;color:#0EA65C;cursor:pointer;">+ Ajouter un sondage</button>'
            ) +
          '</div>' +

          // Éphémère
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="width:26px;height:26px;border-radius:13px;background:#FFEDE0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;">🕐</span>' +
                '<div>' +
                  '<div style="font-size:13px;font-weight:800;color:#0B0D12;">Publication éphémère</div>' +
                  '<div style="font-size:11px;color:#8A93A0;">Disparaît automatiquement après 24h</div>' +
                '</div>' +
              '</div>' +
              '<label style="position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0;">' +
                '<input type="checkbox" id="postEphemeral" style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#D98A0B\':\'#DADCE1\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';"/>' +
                '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#DADCE1;transition:.25s;border-radius:28px;">' +
                  '<span style="position:absolute;content:\'\';height:22px;width:22px;left:3px;bottom:3px;background-color:white;transition:.25s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>' +
                '</span>' +
              '</label>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div style="padding:10px 16px 14px;border-top:0.5px solid #F6F7F9;flex-shrink:0;">' +
          // Color palette row
          (S.pendingMedia.length === 0
            ? '<div style="display:flex;gap:8px;align-items:center;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none;">' +
                '<span style="font-size:11px;font-weight:700;color:#8A93A0;flex-shrink:0;">Fond</span>' +
                // "No color" option
                '<div onclick="App.setPostBg(null)" style="width:30px;height:30px;border-radius:15px;background:#FFF;border:2px solid ' + (S.postBg===null?'#0B63F6':'#E4E7EC') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:#25303F;">Aa</div>' +
                // Color swatches
                [
                  'linear-gradient(135deg,#1A1A2E,#16213E)',
                  'linear-gradient(135deg,#FF6B6B,#FF8E53)',
                  'linear-gradient(135deg,#4ECDC4,#2ECC71)',
                  'linear-gradient(135deg,#667EEA,#764BA2)',
                  'linear-gradient(135deg,#F093FB,#F5576C)',
                  'linear-gradient(135deg,#4481EB,#04BEFE)',
                  'linear-gradient(135deg,#0F2027,#203A43,#2C5364)',
                  'linear-gradient(135deg,#FFA62E,#EA4D2C)',
                  'linear-gradient(135deg,#56AB2F,#A8E063)',
                  'linear-gradient(135deg,#373B44,#4286F4)',
                  'linear-gradient(135deg,#C94B4B,#4B134F)',
                  'linear-gradient(135deg,#F7971E,#FFD200)',
                ].map(function(bg, idx) {
                  var isSel = S.postBg === bg;
                  return '<div onclick="App.setPostBgIdx(' + idx + ')" style="width:30px;height:30px;border-radius:15px;background:' + bg + ';cursor:pointer;flex-shrink:0;border:2.5px solid ' + (isSel?'#FFF':'transparent') + ';box-shadow:' + (isSel?'0 0 0 2px #0B63F6':'0 1px 3px rgba(0,0,0,0.15)') + ';transition:0.15s;"></div>';
                }).join('') +
              '</div>'
            : ''
          ) +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;color:#0B63F6;font-size:12.5px;font-weight:800;background:#E8EEFB;padding:9px 14px;border-radius:16px;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B63F6" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
              'Photo / Vidéo' +
              '<input type="file" accept="image/*,video/*" multiple onchange="App.addMedia(event)" style="display:none;">' +
            '</label>' +
            '<span style="font-size:11.5px;color:#8A93A0;font-weight:600;">' + (S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? '1 vidéo' : S.pendingMedia.length + '/10 photos') + '</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:12px;color:#5A6472;font-weight:600;line-height:1.4;background:#F6F7F9;padding:10px 12px;border-radius:14px;"><input type="checkbox" ' + (S.reduceVideoQuality?'checked':'') + ' onchange="App.toggleReduceVideoQuality()" style="width:17px;height:17px;flex-shrink:0;accent-color:#0B63F6;"> 🎥 Nous réduisons la qualité vidéo en HD pour une expérience plus fluide</label>' +
        '</div>' +

      '</div>' +
    '</div>';
  }

  // ============================================================
  // VUES — liste des membres ayant vu la publication
  // ============================================================
  function renderViewersModal() {
    var posts = db(SK.POSTS, []);
    var post = posts.find(function(p){ return p.id === S.viewersPostId; });
    if (!post) return '';
    var users = db(SK.USERS, []);
    var ids = Array.isArray(post.viewedBy) ? post.viewedBy : [];

    var listHtml;
    if (ids.length === 0) {
      listHtml = '<div style="text-align:center;padding:40px 20px;color:#8A93A0;">' +
        '<div style="font-size:38px;margin-bottom:10px;">👀</div>' +
        '<div style="font-size:15px;font-weight:800;color:#000;">Aucune vue pour l\'instant</div>' +
        '<div style="font-size:13px;margin-top:4px;">Les membres qui verront cette publication apparaîtront ici.</div>' +
      '</div>';
    } else {
      listHtml = ids.map(function(uid) {
        var vu = users.find(function(x){ return x.id === uid; });
        var nom = vu ? ((vu.prenom||'') + ' ' + (vu.nom||'')).trim() : 'Membre';
        var initial = (vu && vu.prenom ? vu.prenom.charAt(0) : 'M').toUpperCase();
        var color = (vu && vu.avatar_color) || '#0B63F6';
        var avatarNode = (vu && vu.avatar_url)
          ? '<img src="' + vu.avatar_url + '" style="width:40px;height:40px;border-radius:20px;object-fit:cover;flex-shrink:0;" />'
          : '<div style="width:40px;height:40px;border-radius:20px;background:' + color + ';color:#FFF;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + initial + '</div>';
        var secs = getUserSections(vu);
        var secLabel = secs.length > 0 ? secs.map(function(s){ return secNom(s); }).join(' · ') : '';
        return '<div onclick="App.closeViewers();App.openUserProfile(\'' + uid + '\')" style="display:flex;align-items:center;gap:12px;padding:10px 4px;cursor:pointer;">' +
          avatarNode +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:14px;font-weight:700;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(nom) + '</div>' +
            (secLabel ? '<div style="font-size:12px;color:#8A93A0;margin-top:1px;">' + safeHtml(secLabel) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    return '<div onclick="App.closeViewers()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10001;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;max-height:78vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;" onclick="App.closeViewers()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +
        '<div style="text-align:center;padding-bottom:12px;border-bottom:0.5px solid #F6F7F9;">' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#000;">Vues</h3>' +
          '<p style="font-size:12px;color:#8A93A0;margin:2px 0 0;">' + ids.length + ' membre' + (ids.length>1?'s':'') + ' ' + (ids.length>1?'ont':'a') + ' vu cette publication</p>' +
        '</div>' +
        '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 16px 24px;">' + listHtml + '</div>' +
      '</div>' +
    '</div>';
  }

