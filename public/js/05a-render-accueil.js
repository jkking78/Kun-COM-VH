// KUN COM VH — Partie 5a : Rendu principal, navigation, en-têtes, accueil, prochaine mission, Bien démarrer

  'use strict';
  // ============================================================
  // MAIN APP
  // ============================================================
  // Prédicat partagé de visibilité : définit ce qui n'apparaît PAS dans le fil
  // (marqueurs internes, programmation à venir, ciblage par pôles, éphémère
  // expirée). Le compteur de non-lus des pôles l'utilise aussi — sinon il
  // compte des publications que le membre ne verra jamais et affiche des
  // badges mensongers. Une seule source de vérité pour les deux.
  function publicationVisiblePour(p, u) {
    if (!p) return false;
    // Événement supprimé mais archivé pour préserver les étoiles déjà
    // attribuées (voir App.deletePost) : invisible dans le fil, comme une
    // suppression normale — seuls les calculs de ponctualité le retrouvent.
    if (p.type === 'EVENT_ARCHIVED') return false;

    // Enregistrement de tâche livrée : marqueur interne (voir toggleTaskDone),
    // jamais une publication du fil.
    if (p.type === 'TASK_DONE') return false;

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

    // Filter expired ephemeral posts
    if (p.is_ephemeral && p.ephemeral_expiry && p.ephemeral_expiry < Date.now()) return false;
    return true;
  }

  // Fil d'un pôle : la publication y figure si son auteur en fait partie
  // (sectionId), si elle tague ce pôle (« Sections ciblées ») ou, pour un
  // événement, s'il le concerne. Une publication taguée sur plusieurs pôles
  // apparaît dans le fil de chacun ; une publication modifiée après coup
  // pour taguer un pôle y apparaît aussitôt.
  function publicationDansPole(p, poleId) {
    if (!p || !poleId) return false;
    if (p.sectionId === poleId) return true;
    if (p.visibility === 'sections' && Array.isArray(p.targetSections) && p.targetSections.indexOf(poleId) !== -1) return true;
    return p.type === 'EVENT' && Array.isArray(p.eventSections) && p.eventSections.indexOf(poleId) !== -1;
  }

  function renderApp() {
    var u = S.user || {};
    if (compteEnAttente(u)) return renderAttenteValidation(u);
    var initial = (u.prenom || 'M').charAt(0).toUpperCase();
    var posts = db(SK.POSTS, []);

    // Filter posts
    var filtered = posts.slice().sort(function(a,b){
        var ap = isPinnedNow(a), bp = isPinnedNow(b);
        if (ap !== bp) return ap ? -1 : 1;
        return (b.timestamp||0)-(a.timestamp||0); 
      }).filter(function(p) {
        // Visibilité (marqueurs internes, programmation, ciblage par pôles,
        // éphémère expirée) : prédicat factorisé ci-dessus, partagé avec le
        // compteur de non-lus des pôles.
        if (!publicationVisiblePour(p, u)) return false;

        if (S.story !== 'all' && !publicationDansPole(p, S.story)) return false;
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
      content = '<div style="padding:100px 20px;text-align:center;"><div style="width:28px;height:28px;margin:0 auto;border:3px solid var(--line2);border-top-color:#0B5FE0;border-radius:50%;animation:spin 0.8s linear infinite;"></div><div style="margin-top:16px;font-size:15px;color:var(--faint);">Chargement du profil...</div></div>';
    } else if (!targetUser) {
      content = '<div style="padding:100px 20px;text-align:center;"><div style="display:flex;justify-content:center;">' + ico('alert', 36, UI.faint, 1.6) + '</div><div style="margin-top:16px;font-size:15px;font-weight:600;">Utilisateur introuvable</div><button onclick="App.closeUserProfile()" style="margin-top:20px;padding:10px 20px;background:#0B5FE0;color:#FFF;border:none;border-radius:20px;font-weight:600;cursor:pointer;">Retour</button></div>';
    } else {
      content = renderProfile(targetUser, posts);
    }
    
    return '<div class="safe-top" style="position:fixed;inset:0;background:var(--card);z-index:9000;overflow-y:auto;animation:slideIn 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      content +
    '</div>';
  }
    if (S.viewUserProfileId) modals += renderUserProfileModal();


    if (S.notificationsOpen) modals += renderNotificationsModal(u);
    if (S.editProfileOpen) modals += renderEditProfileModal(u);
    if (S.postOptionsOpen) modals += renderPostOptionsModal(posts.find(function(p){return p.id===S.selectedPostId;}));
    if (S.createEventOpen) modals += renderCreateEventModal() + renderEventSaveChoice();
    if (S.lieuxOuverts) modals += renderLieuxPanel();
    if (S.preparationId) modals += renderPreparation();
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
    if (S.storageStatsOpen) modals += renderStorageStatsModal();
    if (S.rolesPanelOpen) modals += renderRolesModal();
    if (S.settingsOpen) modals += renderSettingsModal();
    if (S.adminResetResult) modals += renderAdminResetPwModal();
    if (S.boiteOpen) modals += renderBoiteModal();
    if (S.tableauOpen && isGrandResponsable(u)) modals += renderTableauDeBord();
    if (S.dmOpen) modals += renderDirectMessageModal();
    if (S.assignManagerId) modals += renderAssignManagerModal();
    if (S.indisposOpen) modals += renderIndisposModal();
    // En dernier : la visionneuse doit passer par-dessus toutes les autres fenêtres.
    if (S.viewerImage) modals += renderImageViewer();

    return '<div style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:' + UI.page + ';font-family:var(--font-body);">' +
      // La réserve de bas de page suit la hauteur réelle de la barre de navigation
      // (66px posée à 14px du bas), indicateur d'accueil iPhone compris : sinon le
      // dernier élément du fil reste caché derrière elle. La cloche ne flotte plus
      // au-dessus du contenu : elle vit dans l'en-tête de chaque onglet.
      '<div id="mainContent" style="flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;padding-bottom:calc(' + (S.user && S.auth === 'app' ? '100px' : '24px') + ' + env(safe-area-inset-bottom));">' + content + '</div>' +
      modals +
      renderNav(initial) +
    '</div>';
  }

  function renderNav(initial) {
    // L'onglet Bilans reste visible pour tout le monde : un membre consulte les
    // bilans publiés même s'il ne peut pas noter (App.tab le bascule en lecture).
    // Chaque onglet porte son nom sous l'icône : les icônes seules ne se
    // devinaient pas (l'étoile des bilans en particulier).
    function nb(id, iconFn, lbl) {
      var a = S.tab === id;
      return '<button onclick="App.tab(\'' + jsArg(id) + '\')" aria-label="' + lbl + '"' + (a ? ' aria-current="page"' : '') + ' style="flex:1;min-width:0;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;height:100%;padding:8px 0 0;color:' + (a ? 'var(--accent-ink)' : 'var(--muted)') + ';-webkit-tap-highlight-color:transparent;">' +
        '<div style="width:56px;height:30px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:' + (a ? 'var(--accent-soft)' : 'transparent') + ';transition:background 0.2s;">' +
          iconFn(a) +
        '</div>' +
        '<span style="font-size:11px;font-weight:' + (a ? '700' : '600') + ';line-height:1.1;">' + lbl + '</span>' +
      '</button>';
    }
    // Barre ANCRÉE en bas (synthèse du design) : pleine largeur, filet en haut,
    // et l'espace de la barre d'accueil de l'iPhone sous les boutons.
    return '<nav aria-label="Navigation principale" style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;height:calc(64px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box;background:var(--nav-bg);border-top:1px solid var(--nav-line);display:flex;align-items:stretch;justify-content:space-around;z-index:9000;">' +
      nb('home', SVG.home, 'Accueil') +
      nb('planning', SVG.cal, 'Planning') +
      '<button onclick="App.openCreate()" aria-label="Publier" style="flex:1;min-width:0;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;height:100%;padding:6px 0 0;color:var(--muted);-webkit-tap-highlight-color:transparent;">' +
        '<div class="kc-publier" style="width:34px;height:34px;border-radius:17px;background:' + UI.accent + ';display:flex;align-items:center;justify-content:center;">' + SVG.plus + '</div>' +
        '<span style="font-size:11px;font-weight:600;line-height:1.1;">Publier</span>' +
      '</button>' +
      nb('debrief', SVG.chart, 'Bilans') +
      nb('profile', SVG.person, 'Profil') +
    '</nav>';
  }

  // Cloche des notifications, posée dans l'EN-TÊTE de chaque onglet (Accueil,
  // Planning, Bilans, Profil). Elle a été un bouton flottant pour être présente
  // partout, mais elle recouvrait alors la fin des cartes et leurs boutons.
  // Compte des non-lus au rendu précédent. Reste à null tant qu'aucune session
  // n'est ouverte : sinon la bascule « pas connecté (0) » -> « connecté (N) »
  // passerait pour une arrivée de notifications et la cloche s'agiterait à
  // chaque ouverture de l'application.
  var _notifSeen = null;

  function renderCloche() {
    if (!S.user || S.auth !== 'app') { _notifSeen = null; return ''; }
    var notifs = Array.isArray(S.user.notifications) ? S.user.notifications : [];
    var nonLus = notifs.filter(function(n){ return !n.read; }).length;

    // La secousse est déclenchée ICI, et sa durée est portée par l'état plutôt
    // que posée sur le nœud après coup : morphdom réécrit l'attribut style à
    // chaque rendu et effaçait l'animation en cours au premier rafraîchissement.
    if (_notifSeen !== null && nonLus > _notifSeen) S.notifShakeAt = Date.now();
    _notifSeen = nonLus;
    var secoue = S.notifShakeAt && (Date.now() - S.notifShakeAt) < 1500;

    return '<button id="notifCloche" onclick="App.openNotifications()" aria-label="Notifications' + (nonLus ? ' (' + nonLus + ' non lues)' : '') + '" ' +
      'style="position:relative;width:44px;height:44px;border-radius:' + UI.pill + ';border:none;cursor:pointer;padding:0;flex-shrink:0;' +
      'background:none;display:flex;align-items:center;justify-content:center;touch-action:manipulation;-webkit-tap-highlight-color:rgba(0,0,0,0.06);">' +
      '<span style="display:flex;transform-origin:50% 15%;' + (secoue ? 'animation:notifShake 0.7s cubic-bezier(0.36,0.07,0.19,0.97) 2;' : '') + '">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + (nonLus ? UI.accent : UI.muted) + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' +
        '</svg>' +
      '</span>' +
      (nonLus > 0
        ? '<span class="kc-pastille" style="position:absolute;top:4px;right:2px;min-width:18px;height:18px;padding:0 5px;border-radius:' + UI.pill + ';background:' + UI.bad + ';color:#FFF;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid ' + UI.card + ';">' + (nonLus > 99 ? '99+' : nonLus) + '</span>'
        : '') +
    '</button>';
  }

  // ============================================================
  // HOME TAB
  // ============================================================
  
  // En-tête des écrans plein écran (Paramètres, Messages, formulaires…) : un
  // seul modèle, flèche de retour + titre + action éventuelle à droite. Le titre
  // passe de 28 à 22 px quand il est long et qu'une action l'accompagne.
  function enTetePleinEcran(titre, retourJs, actionHtml) {
    var taille = (actionHtml && titre.length > 12) ? 22 : 28;
    return '<div style="display:flex;align-items:center;gap:12px;padding:20px 16px 8px;background:' + UI.page + ';">' +
      '<button type="button" onclick="' + retourJs + '" aria-label="Retour" style="background:' + UI.card + ';border:none;width:44px;height:44px;flex-shrink:0;border-radius:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + UI.ink + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
      '</button>' +
      '<h1 style="flex:1;min-width:0;font-family:' + UI.fontDisplay + ';font-size:' + taille + 'px;font-weight:800;letter-spacing:-0.5px;color:' + UI.ink + ';margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + titre + '</h1>' +
      (actionHtml || '') +
    '</div>';
  }
  // Action principale d'un en-tête plein écran (Créer, Terminer, Nouveau…).
  function boutonEnTete(libelle, onclickJs) {
    return '<button type="button" onclick="' + onclickJs + '" style="min-height:40px;padding:0 16px;flex-shrink:0;background:' + UI.accent + ';color:#FFF;border:none;border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;">' + libelle + '</button>';
  }

  function renderScreenHeader(title, subtitle, rightActionHtml) {
    var u = S.user || {};
    var initial = (u.prenom || 'M').charAt(0).toUpperCase();
    // Un seul niveau de titre, sans sur-titre en capitales : la hiérarchie vient
    // de la taille et du poids, pas de l'empilement de libellés colorés.
    // Titre d'écran en grand, posé sur le fond de page (synthèse du design).
    return '<header style="position:sticky;top:0;z-index:200;background:' + UI.page + ';padding:20px 16px 12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
        '<h1 style="font-size:28px;font-weight:800;color:' + UI.ink + ';margin:0;letter-spacing:-0.5px;min-width:0;">' + title + '</h1>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">' +
          (rightActionHtml || '') +
          renderCloche() +
          (u.avatar_url
            ? '<button onclick="App.tab(\'profile\')" style="width:30px;height:30px;border-radius:' + UI.pill + ';border:none;cursor:pointer;padding:0;overflow:hidden;flex-shrink:0;"><img src="' + safeUrl(u.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;" /></button>'
            : '<button onclick="App.tab(\'profile\')" style="width:30px;height:30px;border-radius:' + UI.pill + ';background:' + couleurSure(u.avatar_color, UI.accent) + ';border:none;cursor:pointer;color:#FFF;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;">' + initial + '</button>') +
        '</div>' +
      '</div>' +
    '</header>';
  }

  // ============================================================
  // MA PROCHAINE MISSION
  // Le service auquel le membre est convoqué, le plus proche dans le temps :
  // celui en cours (tant que le pointage reste possible) ou le prochain à venir.
  // Réutilise les règles du Planning (fenêtre de pointage, bouton « Je suis
  // arrivé ») pour qu'un membre n'ait plus à chercher sa mission.
  // ============================================================
  function prochaineMission(u, posts, now) {
    if (!u) return null;
    var candidats = (posts || []).filter(function(ev) {
      if (ev.type !== 'EVENT' || ev.status === 'deleted') return false;
      var a = (ev.assignments || []).find(function(x){ return x && x.userId === u.id; });
      if (!a) return false;
      var debut = eventStartTimestamp(ev);
      if (!debut) return false;
      var fin = eventEndTimestamp(ev) || debut;
      if (now > fin + CHECKIN_LATE_WINDOW_MS) return false;          // terminé
      // Service en cours déjà pointé : on passe au suivant une fois fini.
      if (now > fin && hasCheckedIn(u.id, ev.id, posts)) return false;
      return true;
    }).sort(function(a, b){ return (eventStartTimestamp(a) || 0) - (eventStartTimestamp(b) || 0); });
    if (!candidats.length) return null;
    var ev = candidats[0];
    return { ev: ev, affectation: (ev.assignments || []).find(function(x){ return x && x.userId === u.id; }) };
  }

  // « dans 2 j 3 h », « dans 45 min », « en cours », « terminé ».
  function compteARebours(debut, fin, now) {
    if (now >= debut) return now <= fin ? 'En cours' : 'Terminé';
    var min = Math.round((debut - now) / 60000);
    if (min < 60) return 'Dans ' + Math.max(1, min) + ' min';
    var h = Math.floor(min / 60), j = Math.floor(h / 24);
    if (j >= 1) return 'Dans ' + j + ' j' + (h % 24 ? ' ' + (h % 24) + ' h' : '');
    return 'Dans ' + h + ' h' + (min % 60 ? ' ' + String(min % 60).padStart(2, '0') : '');
  }

  function jourMission(ev, now) {
    var d = new Date((ev.eventDate || '') + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    var auj = new Date(now); auj.setHours(0, 0, 0, 0);
    var ecart = Math.round((d - auj) / 86400000);
    if (ecart === 0) return 'Aujourd\'hui';
    if (ecart === 1) return 'Demain';
    var t = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function renderProchaineMission(u) {
    var posts = db(SK.POSTS, []);
    var now = Date.now();
    var m = prochaineMission(u, posts, now);
    if (!m) return '';
    var ev = m.ev;
    var debut = eventStartTimestamp(ev);
    var fin = eventEndTimestamp(ev) || debut;
    var tache = m.affectation && m.affectation.task ? m.affectation.task : '';
    // Itinéraire : coordonnées exactes si le lieu a été situé sur la carte,
    // sinon recherche par le nom du lieu.
    var dest = (typeof ev.eventLat === 'number' && typeof ev.eventLng === 'number')
      ? ev.eventLat + ',' + ev.eventLng
      : (ev.eventLocation ? encodeURIComponent(ev.eventLocation + ', Abidjan') : '');
    var itineraire = dest ? 'https://www.google.com/maps/dir/?api=1&destination=' + dest : '';
    var etat = compteARebours(debut, fin, now);
    var enCours = now >= debut && now <= fin;

    // Les autres convoqués : on voit avec qui on sert.
    var equipe = [];
    (ev.assignments || []).forEach(function(a) {
      if (!a || !a.userId || a.userId === u.id || equipe.indexOf(a.userId) !== -1) return;
      equipe.push(a.userId);
    });
    var profils = db(SK.USERS, []);
    var visages = equipe.slice(0, 3).map(function(id, i) {
      var p = profils.find(function(x){ return x.id === id; }) || {};
      return '<span title="' + safeHtml((p.prenom || '') + ' ' + (p.nom || '')) + '" style="width:28px;height:28px;border-radius:14px;border:2px solid ' + UI.card + ';' + (i ? 'margin-left:-8px;' : '') + 'background:' + couleurSure(p.avatar_color, UI.accent) + ';color:#FFF;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">' +
        (p.avatar_url ? '<img src="' + safeUrl(p.avatar_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;">' : safeHtml((p.prenom || 'M').charAt(0).toUpperCase())) + '</span>';
    }).join('');
    var lien = 'font-size:13px;font-weight:700;color:' + UI.lien + ';text-decoration:none;background:none;border:none;padding:0;cursor:pointer;min-height:32px;display:inline-flex;align-items:center;';

    return '<section aria-label="Ma prochaine mission" style="padding:4px 16px;">' +
      '<div class="kc-apparait" style="background:' + UI.card + ';border-radius:20px;box-shadow:' + UI.sh2 + ';padding:18px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
          '<span style="font-size:12px;font-weight:700;color:' + UI.lien + ';">Prochaine mission</span>' +
          '<span data-compte-a-rebours="' + debut + '" data-fin="' + fin + '" style="font-size:12px;font-weight:700;padding:4px 10px;border-radius:12px;background:' + (enCours ? 'var(--ok-soft)' : 'var(--accent-soft)') + ';color:' + (enCours ? 'var(--ok-ink)' : UI.accentInk) + ';white-space:nowrap;">' + etat + '</span>' +
        '</div>' +
        '<h2 style="font-size:22px;font-weight:800;letter-spacing:-0.3px;color:' + UI.ink + ';margin:8px 0 4px;line-height:1.2;overflow-wrap:anywhere;">' + safeHtml(ev.eventTitle || 'Événement') + '</h2>' +
        '<div style="font-size:15px;color:' + UI.muted + ';line-height:1.5;">' +
          safeHtml(jourMission(ev, now)) + ' · ' + safeHtml(ev.eventStart || '') + (ev.eventEnd ? ' – ' + safeHtml(ev.eventEnd) : '') +
          (ev.eventLocation ? '<br>' + safeHtml(ev.eventLocation) : '') +
        '</div>' +
        ((tache || equipe.length) ? '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:12px;">' +
          (tache ? '<span style="font-size:13px;font-weight:700;color:' + UI.accentInk + ';background:var(--accent-soft);border-radius:12px;padding:6px 10px;"><span style="font-weight:500;">Ma tâche</span> ' + safeHtml(tache) + '</span>' : '') +
          (equipe.length ? '<span style="display:flex;align-items:center;gap:6px;"><span style="display:flex;">' + visages + '</span>' +
            (equipe.length > 3 ? '<span style="font-size:12px;color:' + UI.muted + ';">+ ' + (equipe.length - 3) + ' autre' + (equipe.length > 4 ? 's' : '') + '</span>' : '') + '</span>' : '') +
        '</div>' : '') +
        '<div style="margin-top:14px;">' + renderReponseConvocation(ev) + renderEchanges(ev) + renderEventCheckInAction(ev) + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px 18px;">' +
          '<button type="button" onclick="App.goToEvent(\'' + jsArg(ev.id) + '\')" style="' + lien + '">Voir l\'événement</button>' +
          (itineraire ? '<a href="' + safeUrl(itineraire) + '" target="_blank" rel="noopener noreferrer" style="' + lien + '">Itinéraire</a>' : '') +
          '<button type="button" onclick="App.ajouterAgenda(\'' + jsArg(ev.id) + '\')" style="' + lien + '">Agenda</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  // Le compte à rebours avance sans redessiner l'application : seule l'étiquette
  // change, une fois par minute.
  setInterval(function() {
    try {
      var now = Date.now();
      document.querySelectorAll('[data-compte-a-rebours]').forEach(function(el) {
        var t = compteARebours(Number(el.getAttribute('data-compte-a-rebours')), Number(el.getAttribute('data-fin')), now);
        if (el.textContent !== t) el.textContent = t;
      });
    } catch(e) {}
  }, 60000);

  // ============================================================
  // BIEN DÉMARRER
  // Les premiers gestes utiles d'un nouveau membre, cochés automatiquement à
  // partir de ses données. La carte disparaît d'elle-même quand tout est fait,
  // ou dès qu'on la masque (préférence enregistrée sur sa fiche).
  // ============================================================
  function etapesBienDemarrer(u, posts) {
    var estInstallee = false;
    try { estInstallee = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch(e) {}
    var aPublie = (posts || []).some(function(p){ return p && p.userId === u.id && !p.type && p.status !== 'deleted'; });
    return [
      { fait: !!u.visiteVue, titre: 'Faire la visite guidée', action: 'ouvrirVisite()' },
      { fait: !!u.avatar_url, titre: 'Ajouter ta photo de profil', action: "App.tab('profile');App.openEditProfile()" },
      { fait: !!(u.skills && String(u.skills).trim()), titre: 'Indiquer ton savoir-faire', action: "App.tab('profile');App.openEditProfile()" },
      { fait: !!u.conditionsLues, titre: 'Lire les conditions d\'utilisation', action: 'ouvrirConditions()' },
      { fait: aPublie, titre: 'Faire ta première publication', action: 'App.openCreate()' },
      { fait: estInstallee || !!u.installationVue, titre: 'Installer Commit sur ton téléphone', action: 'ouvrirAideInstallation()' }
    ];
  }

  function renderBienDemarrer(u) {
    if (!u || u.bienDemarrerMasque) return '';
    var etapes = etapesBienDemarrer(u, db(SK.POSTS, []));
    var faites = etapes.filter(function(e){ return e.fait; }).length;
    if (faites === etapes.length) return '';
    var pct = Math.round(faites / etapes.length * 100);
    return '<section aria-label="Bien démarrer" style="padding:14px 16px 4px;">' +
      '<div class="kc-apparait" style="background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:16px;box-shadow:' + UI.sh2 + ';padding:14px 16px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
          '<h2 style="font-family:' + UI.fontDisplay + ';font-size:17px;font-weight:700;color:' + UI.ink + ';margin:0;">Bien démarrer</h2>' +
          '<button type="button" onclick="App._majMonProfil({bienDemarrerMasque:true})" style="background:none;border:none;min-height:44px;padding:0 4px;font-size:13px;font-weight:600;color:' + UI.faint + ';cursor:pointer;">Masquer</button>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin:2px 0 8px;">' +
          '<div style="flex:1;height:6px;border-radius:3px;background:' + UI.tile + ';overflow:hidden;" role="progressbar" aria-valuemin="0" aria-valuemax="' + etapes.length + '" aria-valuenow="' + faites + '">' +
            '<div class="kc-progression" style="width:' + pct + '%;height:100%;border-radius:3px;background:' + UI.accent + ';"></div>' +
          '</div>' +
          '<span style="font-family:' + UI.fontMono + ';font-size:12px;color:' + UI.muted + ';">' + faites + '/' + etapes.length + '</span>' +
        '</div>' +
        etapes.map(function(e) {
          return '<button type="button"' + (e.fait ? ' disabled' : ' onclick="' + e.action + '"') + ' style="display:flex;align-items:center;gap:12px;width:100%;min-height:44px;background:none;border:none;border-top:1px solid ' + UI.line + ';padding:8px 0;text-align:left;cursor:' + (e.fait ? 'default' : 'pointer') + ';">' +
            '<span aria-hidden="true" style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;' + (e.fait ? 'background:' + UI.ok + ';' : 'border:2px solid ' + UI.line2 + ';') + '">' +
              (e.fait ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') +
            '</span>' +
            '<span style="flex:1;font-size:15px;font-weight:' + (e.fait ? '500' : '600') + ';color:' + (e.fait ? UI.faint : UI.ink) + ';' + (e.fait ? 'text-decoration:line-through;' : '') + '">' + e.titre + '</span>' +
            (e.fait ? '' : '<span aria-hidden="true" style="color:' + UI.faint + ';">›</span>') +
          '</button>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  // ÉCRAN D'ATTENTE : une inscription non validée ne voit rien d'autre (le
  // serveur ne lui renvoie de toute façon ni publication ni fiche d'un autre).
  function renderAttenteValidation(u) {
    return '<main id="attenteValidation" style="min-height:100vh;background:' + UI.page + ';display:flex;align-items:center;justify-content:center;padding:24px 16px;">' +
      '<div class="kc-apparait" style="width:100%;max-width:380px;background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:20px;box-shadow:' + UI.sh2 + ';padding:28px 22px;text-align:center;">' +
        '<div aria-hidden="true" style="display:flex;justify-content:center;">' + ico('hourglass', 44, UI.accent, 1.6) + '</div>' +
        '<h1 style="font-family:' + UI.fontDisplay + ';font-size:22px;font-weight:700;color:' + UI.ink + ';margin:14px 0 8px;">Compte en attente de validation</h1>' +
        '<p style="font-size:15px;line-height:1.55;color:' + UI.muted + ';margin:0 0 6px;">Bienvenue ' + safeHtml(u.prenom || '') + ' ! Un Admin ou un Responsable de pôle doit confirmer que tu fais partie du Département Communication.</p>' +
        '<p style="font-size:13px;line-height:1.5;color:' + UI.faint + ';margin:0 0 20px;">Tu auras accès à toute l\'application dès la validation. Besoin d\'aide : 07 99 44 24 02.</p>' +
        '<button type="button" onclick="App.verifierValidation()" style="width:100%;min-height:48px;background:' + UI.accent + ';color:#FFF;border:none;border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;">' + (S.verificationEnCours ? 'Vérification…' : 'Actualiser') + '</button>' +
        '<button type="button" onclick="ouvrirConditions()" style="width:100%;min-height:44px;margin-top:8px;background:none;border:none;color:' + UI.ink + ';font-size:15px;font-weight:600;cursor:pointer;">Conditions d\'utilisation</button>' +
        '<button type="button" onclick="App.logout()" style="width:100%;min-height:44px;background:none;border:none;color:' + UI.faint + ';font-size:15px;font-weight:600;cursor:pointer;">Se déconnecter</button>' +
      '</div>' +
    '</main>';
  }

  // Demandes d'inscription, en tête de l'accueil des Admins et Responsables.
  function renderDemandesInscription(u) {
    if (!u || !(isGrandResponsable(u) || isSectionResponsable(u))) return '';
    var demandes = db(SK.USERS, []).filter(compteEnAttente)
      .sort(function(a, b){ return (b.joined_at || 0) - (a.joined_at || 0); });
    if (!demandes.length) return '';
    return '<section id="demandesInscription" aria-label="Demandes d\'inscription" style="padding:14px 16px 4px;">' +
      '<div class="kc-apparait" style="background:' + UI.card + ';border:1.5px solid ' + UI.warn + '66;border-radius:16px;box-shadow:' + UI.sh2 + ';padding:14px 16px;">' +
        '<h2 style="font-family:' + UI.fontDisplay + ';font-size:17px;font-weight:700;color:' + UI.ink + ';margin:0 0 4px;">Demandes d\'inscription · ' + demandes.length + '</h2>' +
        '<p style="font-size:13px;color:' + UI.faint + ';margin:0 0 6px;">Ces personnes ne voient rien tant que tu n\'as pas validé leur compte.</p>' +
        demandes.map(function(m) {
          var poles = getUserSections(m).map(function(s){ return secNom(s); }).join(' · ');
          var quand = m.joined_at ? new Date(m.joined_at).toLocaleDateString('fr-FR', {day:'numeric', month:'short'}) : '';
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid ' + UI.line + ';">' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:15px;font-weight:700;color:' + UI.ink + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(((m.prenom || '') + ' ' + (m.nom || '')).trim() || 'Sans nom') + '</div>' +
              '<div style="font-size:12px;color:' + UI.faint + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml([m.phone, poles, quand].filter(Boolean).join(' · ')) + '</div>' +
            '</div>' +
            '<button type="button" onclick="App.validerInscription(\'' + jsArg(m.id) + '\', false)" style="min-height:40px;padding:0 12px;background:' + UI.tile + ';color:' + UI.ink + ';border:none;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;">Refuser</button>' +
            '<button type="button" onclick="App.validerInscription(\'' + jsArg(m.id) + '\', true)" style="min-height:40px;padding:0 14px;background:' + UI.accent + ';color:#FFF;border:none;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;">Valider</button>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</section>';
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

    // En-tête personnel (synthèse du design) : la date et « Bonjour <prénom> »,
    // posés sur le fond de page, avec recherche, messages et notifications.
    var dateDuJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    dateDuJour = dateDuJour.charAt(0).toUpperCase() + dateDuJour.slice(1);
    var header = '<header style="position:sticky;top:0;z-index:200;background:' + UI.page + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:20px 16px 12px;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:13px;font-weight:500;color:' + UI.muted + ';">' + dateDuJour + '</div>' +
          '<h1 style="font-size:28px;font-weight:800;color:' + UI.ink + ';margin:2px 0 0;letter-spacing:-0.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Bonjour ' + safeHtml(u.prenom || '') + '</h1>' +
        '</div>' +
        '<div style="display:flex;gap:2px;align-items:center;flex-shrink:0;margin-right:-8px;">' +
          iconBtn('App.openMembersList()', '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7.5"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>', 0) +
          renderBoiteBouton() +
          renderCloche() +
        '</div>' +
      '</div>' +
    '</header>';

    // Tendances : seulement dans le fil « Tous », pas dans celui d'un pôle.
    var trendsHtml = '';
    if (trends.length > 0 && (!S.story || S.story === 'all')) {
      trendsHtml = '<div style="background:' + UI.card + ';border-bottom:0.5px solid ' + UI.line + ';padding:9px 16px;">' +
        '<div style="display:flex;gap:7px;overflow-x:auto;align-items:center;-webkit-overflow-scrolling:touch;">' +
        '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:' + UI.faint + ';white-space:nowrap;flex-shrink:0;">' + ico('flame', 13, UI.faint) + 'Tendances</span>' +
        trends.map(function(t) {
          var active = S.q.toLowerCase() === t.toLowerCase();
          return '<button onclick="App.filterTag(\'' + jsArg(encodeURIComponent(t)) + '\')" style="flex-shrink:0;display:flex;align-items:center;min-height:44px;background:' + (active ? UI.accent : UI.tile) + ';color:' + (active ? '#FFF' : UI.muted) + ';border:none;padding:5px 12px;border-radius:' + UI.pill + ';font-size:12px;font-weight:500;cursor:pointer;">' + t + '</button>';
        }).join('') +
        '</div></div>';
    }

    // Pôles : l'icône de chaque équipe, dans sa couleur, au centre d'un anneau.
    var sectionSeen = db(SK.SECTION_SEEN, {});
    var allPostsForCount = db(SK.POSTS, []);
    var stories = '<div style="background:' + UI.card + ';border-bottom:0.5px solid ' + UI.line + ';padding:2px 0 12px;">' +
      '<div style="display:flex;gap:2px;padding:10px 12px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;">' +
      [{ id:'all', nom:'Tous' }].concat(SECTIONS).map(function(s) {
        var sel = S.story === s.id;
        var sc = secColor(s.id) || UI.accent;
        var lastSeen = s.id === 'all' ? null : (sectionSeen[s.id] || 0);
        // Le compteur applique le MÊME prédicat de visibilité que le fil
        // principal : sinon il compte des publications invisibles (programmées,
        // ciblées sur d'autres pôles…) et affiche des badges mensongers.
        var cnt = lastSeen === null ? 0 : allPostsForCount.filter(function(p){ return publicationDansPole(p, s.id) && (p.timestamp||0) > lastSeen && publicationVisiblePour(p, u); }).length;
        return '<div onclick="App.story(\'' + jsArg(s.id) + '\')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;min-width:64px;gap:6px;flex-shrink:0;">' +
          '<div style="position:relative;width:54px;height:54px;">' +
            '<div style="width:54px;height:54px;border-radius:50%;background:' + (sel ? sc + '1A' : UI.tile) + ';border:1.5px solid ' + (sel ? sc : 'transparent') + ';display:flex;align-items:center;justify-content:center;font-size:22px;transition:all 0.2s;">' +
              (s.id === 'all' ? ico('layers', 22, sel ? UI.accent : UI.muted) : icoPole(s.id, 22)) +
            '</div>' +
            (cnt > 0 ? '<div style="position:absolute;top:-2px;right:-2px;z-index:2;background:' + UI.accent + ';color:#FFF;font-size:11px;font-weight:600;min-width:18px;height:18px;border-radius:' + UI.pill + ';display:flex;align-items:center;justify-content:center;padding:0 5px;box-shadow:0 0 0 2px #FFF;">' + (cnt > 99 ? '99+' : cnt) + '</div>' : '') +
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
    // L'ancienne seconde clause (« cache plein mais filtre du fil Tous vide »)
    // a été retirée : elle affichait des squelettes À L'INFINI quand le fil
    // filtré était légitimement vide (uniquement des publications programmées
    // ou archivées en cache), rendant l'état « Aucune publication » inaccessible.
    // Désormais l'état vide s'affiche correctement dès la fin de la synchro.
    // S.initialLoading passe à false après 2,5 s même si le réseau est encore lent
    // (c'est voulu : ça ne débloque QUE l'écran plein écran). Sur un appareil sans
    // rien en cache, ça faisait passer un « toujours en train de charger » pour un
    // « fil vide pour de bon » avant même que la vraie réponse réseau soit arrivée —
    // vécu sur le terrain (réseau mobile) : la publication finissait par apparaître
    // seule, quelques secondes plus tard, comme si le fil s'était « réparé tout
    // seul ». S.syncEnCours reste vrai tant que la synchronisation n'est pas
    // RÉELLEMENT terminée (voir syncSupabaseToLocal) — c'est lui qui tranche ici.
    var isActuallySyncing = (S.initialLoading || S.syncEnCours) && allLocalPosts.length === 0;

    // Le fil est-il encore en train de se charger ? S.syncEnCours reste vrai
    // jusqu'à la fin RÉELLE de la requête (voir syncSupabaseToLocal) : tant qu'il
    // l'est, on ne prétend pas savoir ce que le fil contient.
    var chargementEnCours = !!(S.initialLoading || S.syncEnCours);

    if (isActuallySyncing && !S.q && S.story === 'all') {
      // Squelettes plutôt qu'une roue : la place des publications est réservée
      // dès le premier affichage, donc rien ne saute quand elles arrivent.
      feed = renderSkeletonCards(3);
    } else if (filtered.length === 0) {
      feed = '<div style="display:flex;flex-direction:column;align-items:center;padding:70px 24px;text-align:center;">' +
        '<div style="margin-bottom:16px;display:flex;justify-content:center;">' + ico('inbox', 44, UI.faint, 1.6) + '</div>' +
        '<h3 style="font-size:17px;font-weight:800;color:var(--ink);margin:0 0 8px;">' + (S.q ? 'Aucun résultat' : 'Aucune publication') + '</h3>' +
        '<p style="font-size:13px;color:var(--faint);margin:0 0 22px;max-width:240px;line-height:1.5;">' +
          (S.q ? 'Aucun résultat trouvé pour "' + safeHtml(S.q) + '"' : 'Aucune publication pour le moment. Sois le premier à publier.') +
        '</p>' +
        (S.q
          ? '<button onclick="App.search(\'\')" style="' + btnStyle('#0B5FE0') + 'height:44px;width:auto;padding:0 22px;font-size:15px;">Réinitialiser la recherche</button>'
          : '<button onclick="App.openCreate()" style="' + btnStyle('#0B5FE0') + 'height:44px;width:auto;padding:0 22px;font-size:15px;">Créer un post</button>') +
      '</div>';
    } else {
      // Les événements d'une même journée sont fusionnés en un carrousel unique ;
      // une journée à un seul événement garde exactement la carte habituelle.
      // À partir de DEUX épinglés, on les sort du flux pour les regrouper dans
      // un bloc repliable en tête. En dessous, rien ne change : une seule carte
      // épinglée ne gêne personne et mérite sa mise en avant pleine largeur.
      var epingles = filtered.filter(function(p){ return isPinnedNow(p); });
      var regroupe = epingles.length >= 2;
      var reste = regroupe ? filtered.filter(function(p){ return !isPinnedNow(p); }) : filtered;

      var elements = groupSameDayEvents(reste);
      // P5 : seules les 25 premières cartes sont dessinées (puis 25 de plus à
      // chaque « Afficher plus ») ; tout le cache l'était à chaque rendu.
      var limite = S.filLimite || 25;
      var masques = Math.max(0, elements.length - limite);
      var cartes = elements.slice(0, limite).map(function(item) {
        if (item.kind === 'post') return renderPostCard(item.post);
        if (item.events.length === 1) return renderPostCard(item.events[0]);
        return renderEventGroupCard(item.date, item.events);
      }).join('');

      // Le pied de liste n'apparaît QUE si la synchronisation est terminée ET
      // qu'au moins une carte est réellement affichée — et toujours APRÈS elles.
      // Avant : quand le cache ne contenait que des épinglés (sortis du flux dans
      // leur propre bloc), la liste restante était vide mais le pied s'affichait
      // quand même, collé sous les épinglés dès la première image ; l'arrivée des
      // publications le repoussait ensuite vers le bas. C'est le saut visuel
      // constaté au chargement.
      var footerHtml = '';
      // « Charger plus » uniquement, et seulement s'il reste vraiment quelque
      // chose à charger. Le bloc « Vous êtes à jour ✓ » a été retiré : il
      // n'offrait aucune action et ne faisait que signaler la fin d'une liste
      // déjà visiblement terminée.
      // Le pied ne paraît que si la synchronisation est finie ET qu'au moins une
      // carte est réellement rendue, et toujours APRÈS elles.
      var canLoadMore = S.story === 'all' && !S.q && !S.postsAllLoaded;
      if (masques > 0) {
        footerHtml = '<div style="padding:20px;text-align:center;">' +
          '<button type="button" onclick="App.afficherPlusFil()" style="background:var(--card);color:var(--ink);border:none;border-radius:16px;padding:12px 22px;font-size:13px;font-weight:800;cursor:pointer;">Afficher plus (' + masques + ')</button>' +
        '</div>';
      } else if (!chargementEnCours && elements.length > 0 && canLoadMore) {
        footerHtml = '<div style="padding:20px;text-align:center;background:var(--card);margin-top:8px;">' +
          (S.loadingMorePosts
            ? '<div style="display:flex;justify-content:center;padding:10px;"><div style="width:22px;height:22px;border:2.5px solid var(--line);border-top-color:#0B5FE0;border-radius:50%;animation:spin 0.7s linear infinite;"></div></div>'
            : '<button onclick="App.loadMorePosts()" style="background:var(--tile);color:var(--ink);border:none;border-radius:16px;padding:12px 22px;font-size:13px;font-weight:800;cursor:pointer;">Charger plus d\'anciennes publications</button>') +
        '</div>';
      }

      // Pendant le chargement, des squelettes réservent la place des publications
      // encore en route : la hauteur de la page ne change donc plus quand elles
      // arrivent, et le pied ne remonte jamais se coller sous les épinglés.
      var squelettes = chargementEnCours ? renderSkeletonCards(elements.length > 0 ? 1 : 3) : '';

      feed = (regroupe ? renderPinnedStack(epingles) : '') + cartes + squelettes + footerHtml;
    }

    // Carte « Ma prochaine mission » et liste « Bien démarrer » en tête du fil,
    // seulement sur la vue d'ensemble (pas pendant une recherche ou un filtre).
    var vueGenerale = (!S.story || S.story === 'all') && !S.q;
    return header + (vueGenerale ? renderDemandesInscription(u) + renderProchaineMission(u) + renderBienDemarrer(u) : '') + trendsHtml + stories + feed;
  }
