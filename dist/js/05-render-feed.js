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
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return (b.timestamp||0)-(a.timestamp||0); 
      }).filter(function(p) {
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
      content = '<div style="padding:100px 20px;text-align:center;"><div style="font-size:32px;animation:spin 1s linear infinite;">⏳</div><div style="margin-top:16px;font-size:14px;color:#8E8E93;">Chargement du profil...</div></div>';
    } else if (!targetUser) {
      content = '<div style="padding:100px 20px;text-align:center;"><div style="font-size:40px;">😕</div><div style="margin-top:16px;font-size:16px;font-weight:600;">Utilisateur introuvable</div><button onclick="App.closeUserProfile()" style="margin-top:20px;padding:10px 20px;background:#007AFF;color:#FFF;border:none;border-radius:20px;font-weight:600;cursor:pointer;">Retour</button></div>';
    } else {
      content = renderProfile(targetUser, posts);
    }
    
    return '<div style="position:fixed;inset:0;background:#FFF;z-index:9000;overflow-y:auto;animation:slideIn 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      content +
    '</div>';
  }
    if (S.rhMetricModal) modals += renderRhDetailsModal();
    if (S.viewUserProfileId) modals += renderUserProfileModal();

  function renderRhDetailsModal() {
    if (!S.rhMetricModal) return '';
    var metric = S.rhMetricModal;
    var targetId = S.rhMetricTargetUserId || (S.user ? S.user.id : null);
    var users = db(SK.USERS, []);
    var u = users.find(function(x){ return x.id === targetId; }) || S.user || {};
    var posts = db(SK.POSTS, []);
    
    var title = '';
    var contentHtml = '';
    
    if (metric === 'services') {
      title = '📋 Détail des Services Effectués';
      var eventsList = posts.filter(function(p){ return p.type === 'EVENT'; });
      var myEvents = eventsList.filter(function(ev) {
        var assignments = ev.assignments || [];
        var isAssigned = assignments.some(function(a){ return a.userId === u.id; });
        var isParticipant = Array.isArray(ev.likedBy) && ev.likedBy.indexOf(u.id) !== -1;
        return isAssigned || isParticipant;
      });
      
      if (myEvents.length === 0) {
        contentHtml = '<div style="text-align:center;padding:30px 10px;color:#8E8E93;"><div style="font-size:36px;margin-bottom:8px;">📌</div><p>Aucun service enregistré pour le moment.</p></div>';
      } else {
        contentHtml = myEvents.map(function(ev) {
          return '<div style="background:#F8F9FF;border:1px solid #E5E5EA;border-radius:14px;padding:12px;margin-bottom:10px;">' +
            '<div style="font-size:14px;font-weight:800;color:#000;">' + safeHtml(ev.title||'Service / Culte') + '</div>' +
            '<div style="font-size:12px;color:#8E8E93;margin-top:2px;">' + fmtDateTime(ev.event_date || ev.timestamp) + '</div>' +
            '<div style="margin-top:6px;display:flex;gap:6px;"><span style="background:#E0F0FF;color:#007AFF;font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;">✓ Présence Validée</span></div>' +
          '</div>';
        }).join('');
      }
    } else if (metric === 'ratings') {
      title = '⭐ Évaluations et Notes';
      var evalPosts = posts.filter(function(p){ return p.type === 'EVALUATION' || (p.metadata && p.metadata.type === 'EVALUATION'); });
      if (evalPosts.length === 0) {
        contentHtml = '<div style="text-align:center;padding:30px 10px;color:#8E8E93;"><div style="font-size:36px;margin-bottom:8px;">⭐</div><p>Note globale basée sur l\'assiduité et les retours d\'équipe (4.8 / 5).</p></div>';
      } else {
        contentHtml = evalPosts.map(function(ep) {
          var meta = ep.metadata || {};
          var r = meta.overallRating || ep.rating || '5';
          return '<div style="background:#FFF9E6;border:1px solid #FFE082;border-radius:14px;padding:12px;margin-bottom:10px;">' +
            '<div style="font-size:14px;font-weight:800;color:#B78103;">Score : ' + r + ' / 5 ⭐</div>' +
            '<div style="font-size:13px;color:#3A3A3C;margin-top:4px;">' + safeHtml(ep.caption||meta.comment||'Évaluation de service') + '</div>' +
          '</div>';
        }).join('');
      }
    } else if (metric === 'trust') {
      title = '🟢 Explication de l\'Indice de Confiance';
      contentHtml = '<div style="line-height:1.5;font-size:13.5px;color:#3A3A3C;">' +
        '<p style="margin-bottom:10px;">L\'<strong>Indice de Confiance</strong> reflète l\'assiduité globale aux cultes, répétitions et événements du département Communication.</p>' +
        '<div style="background:#F2F2F7;border-radius:12px;padding:12px;margin-bottom:10px;">' +
          '<div style="color:#34C759;font-weight:800;">🟢 > 80% : Fiabilité Élevée</div>' +
          '<div style="color:#FF9500;font-weight:800;margin-top:4px;">🟠 50% - 80% : Satisfaisant</div>' +
          '<div style="color:#FF3B30;font-weight:800;margin-top:4px;">🔴 < 50% : Suivi Requis</div>' +
        '</div>' +
        '<p style="font-size:12px;color:#8E8E93;">Chaque service effectué et validé augmente automatiquement cet indice.</p>' +
      '</div>';
    }

    return '<div onclick="App.closeRhDetailsModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:24px;border-top-right-radius:24px;padding:20px;max-height:80vh;overflow-y:auto;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;border-bottom:1px solid #E5E5EA;padding-bottom:12px;">' +
          '<h3 style="font-size:16.5px;font-weight:800;margin:0;color:#000;">' + title + '</h3>' +
          '<button onclick="App.closeRhDetailsModal()" style="background:#F2F2F7;border:none;border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>' +
        '</div>' +
        contentHtml +
      '</div>' +
    '</div>';
  }

    if (S.notificationsOpen) modals += renderNotificationsModal(u);
    if (S.editProfileOpen) modals += renderEditProfileModal(u);
    if (S.postOptionsOpen) modals += renderPostOptionsModal(posts.find(function(p){return p.id===S.selectedPostId;}));
    if (S.createEventOpen) modals += renderCreateEventModal();
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

    return '<div style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Text\',sans-serif;">' +
      '<div id="mainContent" style="flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;padding-bottom:70px;">' + content + '</div>' +
      modals +
      renderNav(initial) +
    '</div>';
  }

  function renderNav(initial) {
    // Seuls les Grands Responsables évaluent : l'onglet Notation n'apparaît pas
    // pour les autres profils (et App.tab refuse aussi l'accès direct).
    var canEvaluate = S.user && S.user.role === 'GRAND_RESPONSABLE';
    function nb(id, iconFn, lbl) {
      var a = S.tab === id;
      return '<button onclick="App.tab(\'' + id + '\')" style="flex:1;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 2px 4px;position:relative;-webkit-tap-highlight-color:transparent;">' +
        iconFn(a) +
        '<span style="font-size:9.5px;font-weight:' + (a?'800':'400') + ';color:' + (a?'#000':'#8E8E93') + ';margin-top:3px;">' + lbl + '</span>' +
        (a ? '<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:16px;height:2px;border-radius:2px;background:#000;"></div>' : '') +
      '</button>';
    }
    return '<nav style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;height:62px;background:rgba(255,255,255,0.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-top:0.5px solid rgba(0,0,0,0.12);display:flex;align-items:stretch;z-index:9000;safe-area-inset-bottom:env(safe-area-inset-bottom);">' +
      nb('home', SVG.home, 'Accueil') +
      nb('planning', SVG.cal, 'Planning') +
      '<button onclick="App.openCreate()" style="flex:1;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;">' +
        '<div style="width:46px;height:46px;border-radius:23px;background:linear-gradient(135deg,#007AFF,#0040CC);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,122,255,0.4);margin-bottom:8px;">' + SVG.plus + '</div>' +
      '</button>' +
      // Espace neutre pour les non-Grands Responsables : la barre garde le même
      // équilibre visuel sans exposer un onglet auquel ils n'ont pas accès.
      (canEvaluate ? nb('debrief', SVG.star, 'Notation') : '<div style="flex:1;"></div>') +
      nb('profile', SVG.person, 'Profil') +
    '</nav>';
  }

  // ============================================================
  // HOME TAB
  // ============================================================
  
  function renderScreenHeader(title, subtitle, rightActionHtml) {
    var u = S.user || {};
    var initial = (u.prenom || 'M').charAt(0).toUpperCase();
    return '<header style="position:sticky;top:0;z-index:200;background:rgba(255,255,255,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(0,0,0,0.1);padding:13px 16px 12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<div>' +
          '<div style="font-size:10px;font-weight:800;color:#007AFF;text-transform:uppercase;letter-spacing:1.5px;">' + (subtitle||"Église Vase d'Honneur") + '</div>' +
          '<h1 style="font-size:22px;font-weight:900;color:#000;margin:0;letter-spacing:-0.5px;">' + title + '</h1>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          (rightActionHtml || '') +
          (u.avatar_url ? '<button onclick="App.tab(\'profile\')" style="width:34px;height:34px;border-radius:17px;border:none;cursor:pointer;padding:0;overflow:hidden;flex-shrink:0;"><img src="' + u.avatar_url + '" style="width:100%;height:100%;object-fit:cover;" /></button>' : '<button onclick="App.tab(\'profile\')" style="width:34px;height:34px;border-radius:17px;background:linear-gradient(135deg,' + (u.avatar_color||'#007AFF') + ',#0040CC);border:none;cursor:pointer;color:#FFF;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + initial + '</button>') +
        '</div>' +
      '</div>' +
    '</header>';
  }

  function renderHome(filtered, initial, u) {
    var trends = trendingTags();

    var header = '<header style="position:sticky;top:0;z-index:200;background:rgba(255,255,255,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(0,0,0,0.1);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 16px 8px;">' +
        '<div>' +
          '<h1 style="font-size:22px;font-weight:900;color:#007AFF;margin:0 0 2px;letter-spacing:-0.5px;">Commit</h1>' +
          '<div style="font-size:10px;font-weight:800;color:#000;text-transform:uppercase;letter-spacing:1.5px;">Église Vase d\'Honneur</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          (function(){
            var unreadCount = (u && Array.isArray(u.notifications)) ? u.notifications.filter(function(n){ return !n.read; }).length : 0;
            return '<button onclick="App.openNotifications()" style="position:relative;width:34px;height:34px;border-radius:17px;background:#F2F2F7;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
              (unreadCount > 0 ? '<span style="position:absolute;top:-3px;right:-3px;background:#FF3B30;color:#FFF;font-size:9.5px;font-weight:900;padding:2px 5px;border-radius:10px;border:2px solid #FFF;line-height:1;">' + (unreadCount > 99 ? '99+' : unreadCount) + '</span>' : '') +
            '</button>';
          })() +
          '<button onclick="App.openCreate()" style="width:34px;height:34px;border-radius:17px;background:#F0F6FF;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>' +
          '</button>' +
          (u.avatar_url ? '<button onclick="App.tab(\'profile\')" style="width:34px;height:34px;border-radius:17px;border:none;cursor:pointer;padding:0;overflow:hidden;flex-shrink:0;"><img src="' + u.avatar_url + '" style="width:100%;height:100%;object-fit:cover;" /></button>' : '<button onclick="App.tab(\'profile\')" style="width:34px;height:34px;border-radius:17px;background:linear-gradient(135deg,' + (u.avatar_color||'#007AFF') + ',#0040CC);border:none;cursor:pointer;color:#FFF;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + initial + '</button>') +
        '</div>' +
      '</div>' +
      // Search
      '<div style="padding:0 14px 10px;">' +
        '<div style="display:flex;align-items:center;gap:8px;background:#F2F2F7;border-radius:12px;height:38px;padding:0 12px;">' +
          SVG.search +
          '<input id="searchInput" type="search" value="' + safeHtml(S.q) + '" oninput="App.search(this.value)" onfocus="App.setSearchFocused(true)" onblur="App.setSearchFocused(false)" placeholder="Rechercher..." style="flex:1;border:none;background:transparent;font-size:13.5px;color:#000;outline:none;">' +
          (S.q ? '<button onclick="App.search(\'\')" style="background:none;border:none;cursor:pointer;color:#8E8E93;font-size:18px;line-height:1;padding:0;">×</button>' : '') +
        '</div>' +
        (S.searchFocused ? '<div style="padding-top:8px;">' +
          '<div onmousedown="event.preventDefault();App.openMembersList();" style="display:flex;align-items:center;gap:10px;background:#F0F6FF;border-radius:12px;padding:10px 12px;cursor:pointer;">' +
            '<span style="font-size:18px;">👥</span>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:13px;font-weight:800;color:#007AFF;">Voir tous les membres</div>' +
              '<div style="font-size:11px;color:#8E8E93;">' + db(SK.USERS, []).length + ' membre(s) du département</div>' +
            '</div>' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
          '</div>' +
        '</div>' : '') +
      '</div>' +
    '</header>';

    // Trends
    var trendsHtml = '';
    if (trends.length > 0) {
      trendsHtml = '<div style="background:#FFF;border-bottom:0.5px solid #F2F2F7;padding:8px 16px;">' +
        '<div style="display:flex;gap:7px;overflow-x:auto;align-items:center;-webkit-overflow-scrolling:touch;">' +
        '<span style="font-size:10.5px;font-weight:800;color:#007AFF;white-space:nowrap;flex-shrink:0;">🔥 TENDANCES</span>' +
        trends.map(function(t) {
          var active = S.q.toLowerCase() === t.toLowerCase();
          return '<button onclick="App.filterTag(\'' + encodeURIComponent(t) + '\')" style="flex-shrink:0;background:' + (active?'#007AFF':'#EFF6FF') + ';color:' + (active?'#FFF':'#007AFF') + ';border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">' + t + '</button>';
        }).join('') +
        '</div></div>';
    }

    // Stories
    var sectionSeen = db(SK.SECTION_SEEN, {});
    var allPostsForCount = db(SK.POSTS, []);
    var stories = '<div style="background:#FFF;border-bottom:0.5px solid #F2F2F7;padding:4px 0 10px;">' +
      '<div style="display:flex;gap:2px;padding:8px 10px 0;overflow-x:auto;-webkit-overflow-scrolling:touch;">' +
      [{ id:'all', nom:'Tous', emoji:'✨' }].concat(SECTIONS).map(function(s) {
        var sel = S.story === s.id;
        var sc = secColor(s.id) || '#007AFF';
        var lastSeen = s.id === 'all' ? null : (sectionSeen[s.id] || 0);
        var cnt = lastSeen === null ? 0 : allPostsForCount.filter(function(p){ return p.sectionId === s.id && (p.timestamp||0) > lastSeen; }).length;
        return '<div onclick="App.story(\'' + s.id + '\')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;min-width:66px;gap:4px;flex-shrink:0;">' +
          '<div style="position:relative;width:58px;height:58px;">' +
            '<div style="width:58px;height:58px;border-radius:29px;' +
              (sel ? 'background:linear-gradient(135deg,' + sc + ',#0040CC);box-shadow:0 4px 14px rgba(0,0,0,0.2);' : 'background:#F2F2F7;') +
              'display:flex;align-items:center;justify-content:center;font-size:24px;transition:all 0.2s;">' +
              s.emoji +
            '</div>' +
            (cnt > 0 ? '<div style="position:absolute;top:-4px;right:-4px;z-index:2;background:#FF3B30;color:#FFF;font-size:11px;font-weight:800;min-width:19px;height:19px;line-height:19px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 0 0 2.5px #FFF;">' + (cnt > 99 ? '99+' : cnt) + '</div>' : '') +
          '</div>' +
          '<span style="font-size:10.5px;font-weight:' + (sel?'800':'400') + ';color:' + (sel?sc:'#8E8E93') + ';text-align:center;white-space:nowrap;">' + s.nom + '</span>' +
        '</div>';
      }).join('') +
      '</div></div>';

    // Feed
    var feed = '';
    if (filtered.length === 0 && S.initialLoading && !S.q) {
      // Chargement initial en cours (sync Supabase pas encore terminée) : on évite
      // d'afficher un faux "Aucune publication" qui pourrait faire croire à une perte de données.
      feed = '<div style="display:flex;justify-content:center;padding:48px 24px;">' +
        '<div style="width:26px;height:26px;border:2.5px solid #E5E5EA;border-top-color:#007AFF;border-radius:50%;animation:spin 0.7s linear infinite;"></div>' +
      '</div>';
    } else if (filtered.length === 0) {
      feed = '<div style="display:flex;flex-direction:column;align-items:center;padding:70px 24px;text-align:center;">' +
        '<div style="font-size:52px;margin-bottom:16px;">📭</div>' +
        '<h3 style="font-size:18px;font-weight:800;color:#000;margin:0 0 8px;">' + (S.q ? 'Aucun résultat' : 'Aucune publication') + '</h3>' +
        '<p style="font-size:13.5px;color:#8E8E93;margin:0 0 22px;max-width:240px;line-height:1.5;">' +
          (S.q ? 'Aucun résultat trouvé pour "' + safeHtml(S.q) + '"' : 'Aucune publication pour le moment. Soyez le premier à publier ! 🎉') +
        '</p>' +
        (S.q
          ? '<button onclick="App.search(\'\')" style="' + btnStyle('#007AFF') + 'height:44px;width:auto;padding:0 22px;font-size:14px;">Réinitialiser la recherche</button>'
          : '<button onclick="App.openCreate()" style="' + btnStyle('#007AFF') + 'height:44px;width:auto;padding:0 22px;font-size:14px;">Créer un post</button>') +
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
            ? '<div style="display:flex;justify-content:center;padding:10px;"><div style="width:22px;height:22px;border:2.5px solid #E5E5EA;border-top-color:#007AFF;border-radius:50%;animation:spin 0.7s linear infinite;"></div></div>'
            : '<button onclick="App.loadMorePosts()" style="background:#F2F2F7;color:#000;border:none;border-radius:14px;padding:12px 22px;font-size:13.5px;font-weight:800;cursor:pointer;">Charger plus d\'anciennes publications</button>') +
        '</div>';
      } else {
        footerHtml = '<div style="padding:36px 20px;text-align:center;background:#FFF;margin-top:8px;">' +
          '<div style="width:40px;height:40px;border-radius:20px;background:#F0F6FF;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">' + SVG.check + '</div>' +
          '<h4 style="font-size:15px;font-weight:800;color:#000;margin:0;">Vous êtes à jour ✓</h4>' +
          '<p style="font-size:12.5px;color:#8E8E93;margin:4px 0 0;">Toutes les publications ont été affichées.</p>' +
        '</div>';
      }
      // Les événements d'une même journée sont fusionnés en un carrousel unique ;
      // une journée à un seul événement garde exactement la carte habituelle.
      feed = groupSameDayEvents(filtered).map(function(item) {
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
    var evSections = (post.eventSections || []).map(function(s){ return '<span style="font-size:12px;font-weight:700;color:#5856D6;">' + s.charAt(0).toUpperCase() + s.slice(1) + '</span>'; }).join(' ');
    var nowDateStr = new Date().toISOString().split('T')[0];
    var nowTimeStr = new Date().toTimeString().slice(0,5);
    var evStatus;
    if (post.eventDate < nowDateStr || (post.eventDate === nowDateStr && post.eventEnd && nowTimeStr > post.eventEnd)) {
      evStatus = '<span style="background:#F2F2F7;color:#8E8E93;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;white-space:nowrap;">✅ Terminé</span>';
    } else if (post.eventDate === nowDateStr && post.eventStart && nowTimeStr >= post.eventStart) {
      evStatus = '<span style="background:#E5F4E9;color:#28A347;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;white-space:nowrap;">🟢 En cours</span>';
    } else {
      evStatus = '<span style="background:#F0EFFF;color:#5856D6;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;white-space:nowrap;">🗓 À venir</span>';
    }

    // Image de l'événement (une seule) — affichée en tête, proportions d'origine.
    var evImage = post.eventImage
      ? '<img src="' + post.eventImage + '" loading="lazy" style="display:block;width:100%;height:auto;max-height:260px;object-fit:cover;border-radius:14px;margin-bottom:14px;background:#000;" />'
      : '';

    return '<div style="padding:16px;background:linear-gradient(145deg,#F9F9FF,#F0F0FA);border-radius:18px;border-left:4px solid #5856D6;">' +
      evImage +
      '<div style="display:flex;gap:14px;align-items:flex-start;">' +
        (evDate ? '<div style="background:#FFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);width:54px;text-align:center;flex-shrink:0;border:1px solid #EFEFFF;">' +
          '<div style="background:#5856D6;color:#FFF;font-size:9px;font-weight:900;text-transform:uppercase;padding:4px 0;letter-spacing:1px;">' + evMonth + '</div>' +
          '<div style="font-size:24px;font-weight:900;color:#000;padding:4px 0;">' + evDay + '</div>' +
        '</div>' : '') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">' +
            '<h3 style="font-size:16px;font-weight:900;color:#1C1C1E;margin:0;flex:1;min-width:0;">' + safeHtml(post.eventTitle) + '</h3>' +
            evStatus +
          '</div>' +
          (evSections ? '<div style="margin-bottom:6px;">' + evSections + '</div>' : '') +
          '<div style="font-size:13px;color:#8E8E93;display:flex;flex-wrap:wrap;gap:8px;">' +
            (post.eventStart ? '<span>🕒 ' + post.eventStart + (post.eventEnd ? ' — ' + post.eventEnd : '') + '</span>' : '') +
            (post.eventLocation ? '<span>📍 ' + safeHtml(post.eventLocation) + '</span>' : '') +
          '</div>' +
          (post.assignments && post.assignments.length > 0 ?
            '<div style="margin-top:12px;border-top:1px solid rgba(88,86,214,0.15);padding-top:12px;">' +
              '<div style="font-size:11px;font-weight:800;color:#5856D6;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Équipe Assignée</div>' +
              '<div style="display:flex;flex-direction:column;gap:6px;">' +
              post.assignments.map(function(a) {
                var isMeAssigned = S.user && S.user.id === a.userId;
                var bg = isMeAssigned ? '#E5F4E9' : '#FFF';
                var border = isMeAssigned ? '1px solid #34C759' : '1px solid #EFEFFF';
                var nameColor = isMeAssigned ? '#28A347' : '#000';
                return '<div style="background:' + bg + ';border:' + border + ';border-radius:10px;padding:8px 12px;display:flex;flex-direction:column;">' +
                  '<span style="font-size:13px;font-weight:800;color:' + nameColor + ';">@' + safeHtml(a.userName) + (isMeAssigned ? ' (Vous)' : '') + '</span>' +
                  '<span style="font-size:13px;color:#3A3A3C;margin-top:2px;font-weight:500;">' + safeHtml(a.task) + '</span>' +
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
    var anyPinned = events.some(function(e){ return e.is_pinned; });

    return '<article style="background:#FFF;margin-bottom:10px;">' +
      (anyPinned ? '<div style="background:#5856D6;color:#FFF;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;display:flex;align-items:center;gap:6px;"><span style="font-size:12px;">📌</span> ÉPINGLÉ</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:15px;font-weight:900;color:#0B0B0C;text-transform:capitalize;">🗓 ' + safeHtml(dateLabel) + '</div>' +
          '<div style="font-size:12px;color:#8E8E93;font-weight:600;margin-top:2px;">' + events.length + ' événements · faites défiler</div>' +
        '</div>' +
        '<div id="evgrpBadge-' + carId + '" style="background:#F0EFFF;color:#5856D6;font-size:12px;font-weight:800;padding:4px 10px;border-radius:20px;flex-shrink:0;">' + (curIdx + 1) + '/' + events.length + '</div>' +
      '</div>' +
      '<div id="' + carId + '" onscroll="App.eventGroupScroll(\'' + dateIso + '\',\'' + carId + '\',this)" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0;">' +
        events.map(function(ev) {
          return '<div style="flex:0 0 100%;scroll-snap-align:start;padding:0 14px 4px;box-sizing:border-box;">' +
            '<div style="position:relative;">' +
              renderEventCardInner(ev) +
              '<button onclick="App.openOptions(\'' + ev.id + '\')" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.92);border:none;width:30px;height:30px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.08);">' + SVG.dots + '</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div id="evgrpDots-' + carId + '" style="display:flex;justify-content:center;gap:5px;padding:8px 0 12px;">' +
        events.map(function(_, di) {
          var a = di === curIdx;
          return '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#5856D6':'#C7C7CC') + ';transition:all 0.25s;"></div>';
        }).join('') +
      '</div>' +
    '</article>';
  }

  // Bloc visuel d'UNE section évaluée (utilisé seul ou dans le carrousel).
  function renderEvaluationSlide(ev) {
    var score = ev.globalScore;
    var badgeBg = score>=4 ? 'linear-gradient(135deg,#DCFCE7,#22C55E)' : score>=2 ? 'linear-gradient(135deg,#FEF3C7,#F59E0B)' : 'linear-gradient(135deg,#FEE2E2,#EF4444)';
    var badgeShadow = score>=4 ? 'rgba(34,197,94,0.3)' : score>=2 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
    var crit = ev.criteria || {};
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div>' +
          '<div style="display:inline-flex;align-items:center;gap:4px;background:#FFF;padding:4px 8px;border-radius:8px;font-size:10px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><span>📊</span> Évaluation</div>' +
          '<div style="font-size:20px;font-weight:900;color:#0F172A;letter-spacing:-0.5px;">' + (ev.emoji ? ev.emoji + ' ' : '') + safeHtml(ev.teamName || '') + '</div>' +
        '</div>' +
        '<div style="background:' + badgeBg + ';color:#FFF;padding:12px 16px;border-radius:16px;font-size:24px;font-weight:900;box-shadow:0 6px 16px ' + badgeShadow + ';text-shadow:0 2px 4px rgba(0,0,0,0.1);white-space:nowrap;">' + score + '/5</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px;">' +
        Object.keys(crit).map(function(k) {
          var v = crit[k];
          var pct = (v/5)*100;
          var cCol = v>=4?'linear-gradient(90deg,#34D399,#10B981)':v>=2?'linear-gradient(90deg,#FBBF24,#F59E0B)':'linear-gradient(90deg,#F87171,#EF4444)';
          return '<div style="display:flex;flex-direction:column;gap:6px;">' +
                   '<div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;color:#475569;"><span>' + safeHtml(k) + '</span><span style="color:#0F172A;">' + v + '/5</span></div>' +
                   '<div style="height:10px;background:#E2E8F0;border-radius:5px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.06);">' +
                     '<div style="height:100%;width:' + pct + '%;background:' + cCol + ';border-radius:5px;box-shadow:0 1px 2px rgba(0,0,0,0.1);"></div>' +
                   '</div>' +
                 '</div>';
        }).join('') +
      '</div>' +
      // Détail de la ponctualité automatique : qui est arrivé quand, et ce que
      // chacun a apporté au total du pôle.
      (ev.punctuality && ev.punctuality.details && ev.punctuality.details.length
        ? '<div style="margin-top:16px;padding-top:14px;border-top:1px dashed #CBD5E1;">' +
            '<div style="font-size:10.5px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">⏱️ Ponctualité — calcul automatique</div>' +
            ev.punctuality.details.map(function(d) {
              var dc = d.stars >= 4 ? '#10B981' : d.stars >= 2 ? '#F59E0B' : '#EF4444';
              var when = d.absent ? 'aucune publication' : (d.delayMinutes <= 0 ? "à l'heure" : '+' + d.delayMinutes + ' min');
              return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:3px 0;">' +
                '<span style="color:#475569;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(d.name) + (d.task ? ' <span style="color:#94A3B8;">· ' + safeHtml(d.task) + '</span>' : '') + '</span>' +
                '<span style="font-weight:800;color:' + dc + ';white-space:nowrap;margin-left:10px;">' + (d.stars>0?'+':'') + d.stars + '★ · ' + when + '</span>' +
              '</div>';
            }).join('') +
            '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:800;color:#0F172A;padding-top:8px;margin-top:6px;border-top:1px solid #E2E8F0;">' +
              '<span>Total du pôle (' + ev.punctuality.count + ' membre' + (ev.punctuality.count>1?'s':'') + ')</span>' +
              '<span>' + ev.punctuality.average + '/5</span>' +
            '</div>' +
          '</div>'
        : '') +
      (ev.comment ? '<p style="font-size:13px;color:#334155;margin:14px 0 0;line-height:1.4;">' + safeHtml(ev.comment) + '</p>' : '');
  }

  // Publication d'évaluation. Plusieurs sections évaluées = un carrousel horizontal
  // dans UNE seule publication (au lieu d'une publication distincte par section).
  function renderEvaluationContent(post) {
    var meta = post.metadata || {};
    var evBadge = meta.eventTitle
      ? '<div style="font-size:12.5px;font-weight:800;color:#5856D6;background:rgba(88,86,214,0.08);padding:6px 12px;border-radius:10px;margin-bottom:12px;display:flex;align-items:center;gap:6px;"><span>🗓️ Événement :</span> <span>' + safeHtml(meta.eventTitle) + '</span></div>'
      : '';

    // Ancien format (une seule section, publications déjà en base) ramené au
    // format liste pour être rendu par le même code.
    var evals = meta.evaluations;
    if (!Array.isArray(evals) || evals.length === 0) {
      evals = [{ teamName: meta.teamName, globalScore: meta.globalScore, criteria: meta.criteria, comment: post.caption || '' }];
    }

    var boxStyle = 'padding:18px;background:linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);border-radius:20px;border:1px solid #E2E8F0;box-shadow:inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.03);';

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
          return '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#5856D6':'#C7C7CC') + ';transition:all 0.25s;"></div>';
        }).join('') +
      '</div>' +
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
    var sec = SECTIONS.find(function(s){ return s.id === post.sectionId; }) || { emoji:'📢', color:'#8E8E93' };
    var likeCount = Array.isArray(post.likedBy) ? post.likedBy.length : (post.likes || 0);
    var viewCount = Array.isArray(post.viewedBy) ? post.viewedBy.length : 0;
    var postAuthorUser = db(SK.USERS, []).find(function(u){ return u.id === post.userId; });
    var postAuthorRoleLabel = roleLabel(postAuthorUser ? postAuthorUser.role : null);
    // Section du PROFIL de l'auteur (affichée dans l'en-tête) — différente du topic
    // détecté par hashtag sur la publication (affiché près des icônes like/commentaire/partage).
    var authorSecId = getUserSections(postAuthorUser)[0];
    var authorSecObj = SECTIONS.find(function(s){ return s.id === authorSecId; });
    var authorSecEmoji = authorSecObj ? authorSecObj.emoji : '🎥';
    var authorSecColor = authorSecObj ? authorSecObj.color : '#007AFF';
    var authorSecNom = authorSecObj ? authorSecObj.nom : 'Membre';

    // Caption truncation (Instagram style: max 3 lines)
    var fullCaption = post.caption || '';
    var captionHtml = '';
    var lines = fullCaption.split('\n');
    var needsTruncate = fullCaption.length > 120 || lines.length > 3;
    if (!expanded && needsTruncate) {
      var short = fullCaption.slice(0, 120);
      captionHtml = hashtagify(short) + '... <span onclick="App.expandCaption(\'' + post.id + '\')" style="color:#8E8E93;cursor:pointer;font-weight:600;">plus</span>';
    } else {
      captionHtml = hashtagify(fullCaption);
      if (needsTruncate && expanded) {
        captionHtml += ' <span onclick="App.expandCaption(\'' + post.id + '\')" style="color:#8E8E93;cursor:pointer;font-weight:600;">moins</span>';
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
              : '<img src="'+url+'" loading="lazy" style="display:block;width:auto;height:auto;max-width:100%;max-height:640px;object-fit:contain;margin:0 auto;"/>';
            return '<div style="flex:0 0 100%;scroll-snap-align:start;display:flex;justify-content:center;">'+mediaTag+'</div>';
          }).join('') +
        '</div>' +
        (isMulti ? '<div id="dots-'+post.id+'" style="display:flex;justify-content:center;gap:5px;padding:8px 0;background:#FFF;">' +
          post.mediaUrls.map(function(_,di){
            var a = di === curIdx;
            return '<div style="width:'+(a?'18':'6')+'px;height:6px;border-radius:3px;background:'+(a?'#007AFF':'#C7C7CC')+';transition:all 0.25s;"></div>';
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
          (post.isVedette ? '<div style="background:linear-gradient(135deg,#FFD700,#FF9500);color:#5D3A00;font-size:10px;font-weight:900;padding:4px 12px;border-radius:20px;letter-spacing:0.8px;margin-bottom:6px;">⭐ SECTION VEDETTE</div>' : '') +
          (post.scoreText ? '<div style="background:rgba(255,255,255,0.92);backdrop-filter:blur(8px);padding:5px 12px;border-radius:12px;position:absolute;bottom:12px;right:12px;"><strong style="font-size:13px;color:#1C1C1E;">★ ' + post.scoreText + '</strong></div>' : '') +
        '</div>';
      } else {
        // Plain text post — no background, caption shown below
        mediaZone = '';
      }
    }

    var pinnedBadge = post.is_pinned ? '<div style="background:#5856D6;color:#FFF;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;display:flex;align-items:center;gap:6px;"><span style="font-size:12px;">📌</span> ÉPINGLÉ</div>' : '';

      var contentZone = '';
      // Handle new-format EVENT posts (created by saveEvent)
      if (post.type === 'EVENT' && post.eventTitle) {
         contentZone = '<div style="margin:0 14px 10px;">' + renderEventCardInner(post) + '</div>';
      } else if (post.type === 'EVENT' && post.metadata) {
         var participants = Object.keys(post.metadata.participations || {}).filter(function(k) { return post.metadata.participations[k] === 'yes'; });
         var partAvatars = '';
         if (participants.length > 0) {
             partAvatars = '<div style="display:flex;margin-left:8px;">';
             for (var i=0; i<Math.min(participants.length, 3); i++) {
                 partAvatars += '<div style="width:24px;height:24px;border-radius:12px;background:#5856D6;color:#FFF;border:2px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;margin-left:-8px;">👤</div>';
             }
             if (participants.length > 3) {
                 partAvatars += '<div style="width:24px;height:24px;border-radius:12px;background:#E5E5EA;color:#000;border:2px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;margin-left:-8px;">+'+(participants.length-3)+'</div>';
             }
             partAvatars += '</div>';
         }

         contentZone = '<div style="margin:10px 14px;padding:20px;background:linear-gradient(145deg, #F9F9FF 0%, #F0F0FA 100%);border-radius:20px;border-left:5px solid #5856D6;box-shadow:0 4px 12px rgba(0,0,0,0.03);position:relative;overflow:hidden;">' +
          '<div style="position:absolute;top:0;right:0;width:100px;height:100px;background:radial-gradient(circle, rgba(88,86,214,0.05) 0%, rgba(255,255,255,0) 70%);border-radius:50%;transform:translate(30%,-30%);"></div>' +
          
          '<div style="display:inline-block;background:rgba(88,86,214,0.1);color:#5856D6;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">🗓️ Événement Planning</div>' +
          
          '<div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">' +
            '<div style="background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,0.08);width:70px;text-align:center;flex-shrink:0;border:1px solid #EFEFFF;">' +
              '<div style="background:linear-gradient(135deg, #FF3B30, #D70015);color:#FFF;font-size:11px;font-weight:900;text-transform:uppercase;padding:6px 0;letter-spacing:1px;">' + (post.metadata.month||'MOIS') + '</div>' +
              '<div style="font-size:28px;font-weight:900;color:#000;padding:8px 0;">' + (post.metadata.day||'00') + '</div>' +
            '</div>' +
            '<div style="flex:1;">' +
              '<h3 style="margin:0 0 8px;font-size:19px;font-weight:900;color:#1C1C1E;line-height:1.2;letter-spacing:-0.3px;">' + safeHtml(post.metadata.title||'') + '</h3>' +
              '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
                '<div style="font-size:13px;color:#5856D6;display:flex;align-items:center;gap:4px;font-weight:600;background:rgba(88,86,214,0.08);padding:4px 8px;border-radius:6px;"><span style="font-size:14px;">🕒</span> ' + safeHtml(post.metadata.time||'') + '</div>' +
                '<div style="font-size:13px;color:#8E8E93;display:flex;align-items:center;gap:4px;font-weight:600;background:#F2F2F7;padding:4px 8px;border-radius:6px;"><span style="font-size:14px;">📍</span> ' + safeHtml(post.metadata.location||'') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          
          (post.caption ? '<p style="font-size:14px;color:#3A3A3C;margin:0 0 16px;line-height:1.5;">' + safeHtml(post.caption) + '</p>' : '') +
          
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-top:12px;border-top:1px dashed #D1D1D6;">' +
            '<div style="display:flex;align-items:center;">' +
              '<span style="font-size:12px;color:#8E8E93;font-weight:600;">' + participants.length + ' Confirmé(s)</span>' +
              partAvatars +
            '</div>' +
          '</div>' +

          '<div style="display:flex;gap:10px;">' +
            '<button onclick="App.toggleParticipation(\''+post.id+'\',\'yes\')" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:800;border:none;cursor:pointer;background:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'linear-gradient(135deg,#34C759,#28A347)':'#FFF')+';color:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'#FFF':'#000')+';box-shadow:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'0 4px 12px rgba(52,199,89,0.3)':'0 2px 6px rgba(0,0,0,0.05)')+';transition:all 0.2s;">' + ((post.metadata.participations||{})[(S.user||{}).id]==='yes' ? '👍 Confirmé' : '👍 Je participe') + '</button>' +
            '<button onclick="App.toggleParticipation(\''+post.id+'\',\'no\')" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:800;border:none;cursor:pointer;background:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'linear-gradient(135deg,#FF3B30,#D70015)':'#FFF')+';color:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'#FFF':'#000')+';box-shadow:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'0 4px 12px rgba(255,59,48,0.3)':'0 2px 6px rgba(0,0,0,0.05)')+';transition:all 0.2s;">' + ((post.metadata.participations||{})[(S.user||{}).id]==='no' ? '❌ Indisponible' : '❌ Non dispo') + '</button>' +
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
           if (origMedia.length > 0) {
             contentZone = '<div style="padding:0;">' + origMedia.map(function(url){
               return isVideoUrl(url)
                 ? '<video src="' + url + '"' + (post.originalVideoPoster ? ' poster="'+post.originalVideoPoster+'"' : '') + ' controls playsinline preload="metadata" style="width:100%;display:block;background:#000;"></video>'
                 : '<img src="' + url + '" style="width:100%;display:block;" />';
             }).join('') + '</div>';
           } else if (post.originalPostBg) {
             contentZone = '<div style="background:' + post.originalPostBg + ';min-height:200px;display:flex;align-items:center;justify-content:center;padding:30px;"><p style="color:#FFF;font-size:20px;font-weight:800;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,0.3);margin:0;line-height:1.4;">' + safeHtml(post.originalCaption || '') + '</p></div>';
           }
         }
      }
    // Repost banner
    var repostBanner = '';
    if (post.type === 'REPOST') {
      repostBanner = '<div style="padding:10px 14px 0;display:flex;align-items:center;gap:6px;color:#8E8E93;font-size:12.5px;font-weight:700;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
        safeHtml(post.author || '') + ' a partagé la publication de ' + safeHtml(post.originalAuthor || '') +
      '</div>';
    }
    // Caption text (author + label), shown ABOVE the media — Facebook style
    var captionTextBlock = (!post.postBg && (captionHtml || (post.type === 'REPOST' && post.originalCaption && !post.originalPostBg)))
      ? '<div style="padding:0 14px 10px;">' +
          (post.type === 'REPOST' && post.originalCaption && !post.originalPostBg ? '<p style="font-size:14px;color:#000;margin:0 0 4px;line-height:1.45;"><strong>' + safeHtml(post.originalAuthor || '') + '</strong> ' + safeHtml(post.originalCaption) + '</p>' : '') +
          (captionHtml ? '<p style="font-size:14px;color:#000;margin:0;line-height:1.45;">' + captionHtml + '</p>' : '') +
        '</div>'
      : '';

    // Comments link + timestamp, stays below the media/actions
    var metaFooterBlock =
      (!post.postBg ? '<div style="padding:0 14px 10px;">' +
        ((post.comments || []).length > 0
          ? '<button onclick="App.openComments(\''+post.id+'\')" style="background:none;border:none;padding:0;font-size:13.5px;color:#8E8E93;cursor:pointer;">Voir les '+(post.comments || []).length+' commentaire'+((post.comments || []).length>1?'s':'')+'</button>'
          : '<button onclick="App.openComments(\''+post.id+'\')" style="background:none;border:none;padding:0;font-size:13.5px;color:#8E8E93;cursor:pointer;">Ajouter un commentaire…</button>'
        ) +
        '<div style="font-size:11px;color:#C7C7CC;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">' + ago + '</div>' +
      '</div>' : '') +
      // For bg posts: show timestamp and comment button below the card
      (post.postBg ? '<div style="padding:2px 14px 10px;display:flex;justify-content:space-between;align-items:center;">' +
        '<button onclick="App.openComments(\'' + post.id + '\')" style="background:none;border:none;padding:0;font-size:13.5px;color:#8E8E93;cursor:pointer;">' + ((post.comments || []).length>0?'Voir les '+(post.comments || []).length+' commentaire'+((post.comments || []).length>1?'s':''):' Ajouter un commentaire…') + '</button>' +
        '<div style="font-size:11px;color:#C7C7CC;text-transform:uppercase;letter-spacing:0.5px;">' + ago + '</div>' +
      '</div>' : '');

    var finalHtml = '<article id="post-'+post.id+'" data-postid="'+post.id+'" style="background:#FFF;margin-bottom:10px;">' +
      repostBanner +
      pinnedBadge +
      (post.is_ephemeral ? '<div style="padding:6px 14px 0;"><span style="background:#FFF3E0;color:#FF9500;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:8px;">🕐 Éphémère · disparaît dans ' + (function(){ var h = Math.max(0, Math.round((post.ephemeral_expiry - Date.now()) / 3600000)); return h > 0 ? h + 'h' : 'bientôt'; })() + '</span></div>' : '') +
      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;">' +
        (function(){
          var allU = db(SK.USERS, []);
          var pAuthor = allU.find(function(u){ return u.id === post.userId; });
          var pAvatarUrl = (pAuthor && pAuthor.avatar_url) ? pAuthor.avatar_url : post.avatar_url;
          var pColor = (pAuthor && pAuthor.avatar_color) ? pAuthor.avatar_color : (post.avatarColor || '#007AFF');
          var pInitial = (pAuthor && pAuthor.prenom) ? pAuthor.prenom.charAt(0).toUpperCase() : (post.authorAvatar || 'M');
          var pName = (pAuthor && pAuthor.prenom && pAuthor.nom) ? (pAuthor.prenom + ' ' + pAuthor.nom) : (post.author || 'Membre');

          var avatarNode = pAvatarUrl
            ? '<img src="' + pAvatarUrl + '" style="width:40px;height:40px;border-radius:20px;object-fit:cover;flex-shrink:0;" />'
            : '<div style="width:40px;height:40px;border-radius:20px;background:linear-gradient(135deg,' + pColor + ',#0040CC);color:#FFF;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + pInitial + '</div>';

          return '<div onclick="App.openUserProfile(\'' + post.userId + '\')" style="display:flex;align-items:center;gap:10px;cursor:pointer;">' +
            avatarNode +
            '<div>' +
              '<div style="font-size:13.5px;font-weight:700;color:#000;">' + safeHtml(pName) + '</div>';
        })() +
            '<div style="font-size:11.5px;color:#8E8E93;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
              '<span style="color:' + authorSecColor + ';font-weight:600;">' + authorSecEmoji + ' ' + authorSecNom + '</span>' +
              '<span>·</span><span>' + postAuthorRoleLabel + '</span>' +
              '<span>·</span><span>' + ago + '</span>' + (post.is_edited ? '<span style="font-style:italic;color:#8E8E93;margin-left:4px;">(modifié)</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button onclick="App.openOptions(\'' + post.id + '\')" style="background:#F2F2F7;border:none;width:32px;height:32px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' + SVG.dots + '</button>' +
      '</div>' +
      (function(){
        if (!post.aboutEventId) return '';
        var aboutEv = db(SK.POSTS, []).find(function(p){ return p.id === post.aboutEventId && p.type === 'EVENT'; });
        if (!aboutEv) return '';
        var aEvDate = aboutEv.eventDate ? new Date(aboutEv.eventDate + 'T00:00:00') : null;
        var aEvDateStr = aEvDate ? aEvDate.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'}) : '';
        return '<div onclick="App.goToEvent(\''+aboutEv.id+'\')" style="margin:0 14px 10px;padding:10px 12px;background:#F0EFFF;border-radius:14px;border:1px solid #E2E0FF;display:flex;align-items:center;gap:10px;cursor:pointer;">' +
          '<span style="font-size:18px;">🗓️</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:10px;font-weight:800;color:#5856D6;text-transform:uppercase;letter-spacing:0.5px;">À propos de cet événement</div>' +
            '<div style="font-size:13px;font-weight:800;color:#1C1C1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(aboutEv.eventTitle||'') + (aEvDateStr ? ' · ' + aEvDateStr : '') + (aboutEv.eventStart ? ' à ' + aboutEv.eventStart : '') + '</div>' +
          '</div>' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5856D6" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
        '</div>';
      })() +
      captionTextBlock +
      contentZone +
      // Actions row
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 6px;">' +
        '<div style="display:flex;gap:14px;align-items:center;">' +
          '<button id="likeBtn-'+post.id+'" onclick="App.like(\''+post.id+'\')" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;transition:transform 0.1s;" onmousedown="this.style.transform=\'scale(0.85)\'" onmouseup="this.style.transform=\'scale(1)\'">' + SVG.heart(iLiked, 26) + '</button>' +
          '<button onclick="App.openComments(\''+post.id+'\')" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;">' + SVG.comment + '</button>' +
          '<button onclick="App.openRepostModal(\''+post.id+'\')" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;">' + SVG.share + '</button>' +
          '<span style="font-size:11px;font-weight:700;color:' + sec.color + ';background:' + sec.color + '18;padding:4px 10px;border-radius:10px;margin-left:2px;">' + sec.emoji + ' ' + (post.sectionNom||'Général') + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<button onclick="App.openViewers(\''+post.id+'\')" title="Vues" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;gap:5px;">' +
            SVG.eye + '<span id="viewCount-'+post.id+'" style="font-size:13px;font-weight:700;color:#8E8E93;">' + viewCount + '</span>' +
          '</button>' +
          '<button id="saveBtn-'+post.id+'" onclick="App.save(\''+post.id+'\')" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;">' + SVG.bookmark(iSaved) + '</button>' +
        '</div>' +
      '</div>' +

      // Like count
      '<div style="padding:0 14px 5px;">' +
        '<div id="likeCount-'+post.id+'" style="font-size:13.5px;font-weight:700;color:#000;">' +
          (likeCount > 0 ? likeCount + ' j\'aime' : 'Soyez le premier à aimer') +
        '</div>' +
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

    var itemsHtml = '';
    if (notifs.length === 0) {
      itemsHtml = '<div style="padding:50px 20px;text-align:center;color:#8E8E93;">' +
        '<div style="font-size:48px;margin-bottom:12px;">🔔</div>' +
        '<div style="font-size:16px;font-weight:800;color:#1C1C1E;margin-bottom:6px;">Aucune notification</div>' +
        '<div style="font-size:13px;color:#8E8E93;">Vous êtes à jour ! Aucune nouvelle activité.</div>' +
      '</div>';
    } else {
      itemsHtml = notifs.map(function(n) {
        var icon = n.type === 'LIKE' ? '❤️' : (n.type === 'COMMENT' || n.type === 'REPLY') ? '💬' : n.type === 'EVALUATION' ? '📊' : n.type === 'MENTION' ? '📣' : n.type === 'MESSAGE' ? '✉️' : n.type === 'FOLLOW' ? '👤' : '🗓️';
        var bgIcon = n.type === 'LIKE' ? '#FF2D55' : (n.type === 'COMMENT' || n.type === 'REPLY') ? '#007AFF' : n.type === 'EVALUATION' ? '#FF9500' : n.type === 'MENTION' ? '#FF9500' : n.type === 'MESSAGE' ? '#34C759' : n.type === 'FOLLOW' ? '#AF52DE' : '#5856D6';
        var timeAgoStr = timeAgo(n.timestamp || Date.now());
        var isUnread = !n.read;

        var avatarHtml = n.senderAvatar
          ? '<img src="' + n.senderAvatar + '" style="width:44px;height:44px;border-radius:22px;object-fit:cover;flex-shrink:0;" />'
          : '<div style="width:44px;height:44px;border-radius:22px;background:linear-gradient(135deg,' + (n.senderColor||'#007AFF') + ',#0040CC);color:#FFF;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (n.senderName||'S').charAt(0).toUpperCase() + '</div>';

        return '<div onclick="App.clickNotification(\'' + n.id + '\', \'' + (n.targetId||'') + '\')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:0.5px solid #F2F2F7;background:' + (isUnread ? '#F0F6FF' : '#FFF') + ';cursor:pointer;transition:background 0.2s;position:relative;">' +
          '<div style="position:relative;flex-shrink:0;">' +
            avatarHtml +
            '<div style="position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;border-radius:9px;background:' + bgIcon + ';color:#FFF;font-size:10px;display:flex;align-items:center;justify-content:center;border:1.5px solid #FFF;">' + icon + '</div>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13.5px;color:#1C1C1E;line-height:1.35;word-break:break-word;">' +
              '<strong>' + safeHtml(n.senderName || 'Membre') + '</strong> ' + safeHtml(n.text || '') +
            '</div>' +
            '<div style="font-size:11px;color:#8E8E93;margin-top:3px;">' + timeAgoStr + '</div>' +
          '</div>' +
          (isUnread ? '<div style="width:8px;height:8px;border-radius:4px;background:#007AFF;flex-shrink:0;"></div>' : '') +
        '</div>';
      }).join('');
    }

    return '<div onclick="App.closeNotifications()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeNotifications()">' +
          '<div style="width:40px;height:4px;background:#D1D1D6;border-radius:2px;"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;border-bottom:0.5px solid #E5E5EA;">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<h2 style="font-size:19px;font-weight:900;color:#000;margin:0;">Notifications</h2>' +
            (unreadCount > 0 ? '<span style="background:#FF3B30;color:#FFF;font-size:11px;font-weight:900;padding:2px 8px;border-radius:10px;">' + unreadCount + '</span>' : '') +
          '</div>' +
          (unreadCount > 0 ? '<button onclick="App.markAllNotificationsRead()" style="background:none;border:none;color:#007AFF;font-size:13px;font-weight:700;cursor:pointer;">Tout lire</button>' : '') +
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
      '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:12px;">Image de l\'événement <span style="font-weight:500;color:#8E8E93;">(optionnelle)</span></label>' +
      (S.eventImageProcessing
        ? '<div style="display:flex;align-items:center;gap:10px;background:#F6F7F9;border-radius:12px;padding:14px;">' +
            '<div style="width:18px;height:18px;border:3px solid #E2E4E9;border-top-color:#007AFF;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
            '<span style="font-size:12.5px;font-weight:700;color:#3A3A3C;">Traitement de l\'image…</span>' +
          '</div>'
        : (S.eventImage
          ? '<div style="position:relative;border-radius:14px;overflow:hidden;background:#000;">' +
              '<img src="' + S.eventImage + '" style="display:block;width:100%;height:auto;max-height:260px;object-fit:contain;background:#000;" />' +
              '<button type="button" onclick="App.editEventImage()" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.72);border:none;border-radius:10px;padding:6px 12px;color:#FFF;font-size:12.5px;font-weight:800;cursor:pointer;">✏️ Modifier</button>' +
              '<button type="button" onclick="App.removeEventImage()" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.72);border:none;border-radius:14px;width:28px;height:28px;color:#FFF;font-size:15px;font-weight:900;cursor:pointer;">×</button>' +
            '</div>'
          : '<label style="display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed #C7C7CC;border-radius:14px;padding:22px;cursor:pointer;color:#007AFF;font-size:14px;font-weight:700;">' +
              '🖼️ Ajouter une image' +
              '<input type="file" accept="image/*" onchange="App.addEventImage(event)" style="display:none;" />' +
            '</label>')) +
    '</div>';

    return '<div style="position:fixed;inset:0;background:#FFF;z-index:10000;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      '<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #E5E5EA;background:#FFF;z-index:2;">' +
        '<button onclick="App.closeCreateEvent()" style="background:none;border:none;font-size:16px;color:#000;cursor:pointer;">Annuler</button>' +
        '<div style="font-weight:700;font-size:16px;">' + (isEdit ? 'Modifier l\'événement' : 'Nouvel Événement') + '</div>' +
        '<button onclick="App.saveEvent(this)" style="background:none;border:none;font-size:16px;font-weight:700;color:#007AFF;cursor:pointer;">' + (isEdit ? 'Enregistrer' : 'Créer') + '</button>' +
      '</header>' +
      '<div style="flex:1;overflow-y:auto;background:#FAFAFA;padding:16px;">' +
        imageBlock +

        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
              '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Titre de l\'événement</label>' +
              '<input type="text" id="eventTitle" value="' + safeHtml(titleVal) + '" placeholder="Ex: Culte de Dimanche" style="border:none;border-bottom:1px solid #E5E5EA;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;font-weight:600;" />' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
              '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Lieu / Salle</label>' +
              '<input type="text" id="eventLocation" value="' + safeHtml(locVal) + '" placeholder="Ex: Salle Principale" style="border:none;border-bottom:1px solid #E5E5EA;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E5E5EA;padding-bottom:12px;">' +
              '<label style="font-size:15px;color:#000;font-weight:600;">Date</label>' +
              '<input type="date" id="eventDate" value="' + dateVal + '" style="border:none;font-size:16px;outline:none;background:transparent;color:#007AFF;font-weight:600;" />' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E5E5EA;padding-bottom:12px;">' +
              '<label style="font-size:15px;color:#000;font-weight:600;">Heure de début</label>' +
              '<input type="time" id="eventStart" value="' + startVal + '" style="border:none;font-size:16px;outline:none;background:transparent;color:#007AFF;font-weight:600;" />' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<label style="font-size:15px;color:#000;font-weight:600;">Heure de fin</label>' +
              '<input type="time" id="eventEnd" value="' + endVal + '" style="border:none;font-size:16px;outline:none;background:transparent;color:#007AFF;font-weight:600;" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:12px;">Pôles concernés</label>' +
          '<div id="eventSectionBadgesContainer">' + App.renderSectionBadges(S.eventSections, 'toggleEventSection') + '</div>' + 
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<label style="font-size:13px;color:#8E8E93;font-weight:600;display:block;margin-bottom:8px;">Description / Notes</label>' +
          '<textarea id="eventDesc" placeholder="Ajoutez un briefing ou des notes pour les équipes..." style="width:100%;border:none;font-size:15px;outline:none;resize:none;font-family:inherit;min-height:80px;background:#F8F8F8;padding:12px;border-radius:12px;box-sizing:border-box;">' + safeHtml(descVal) + '</textarea>' +
        '</div>' +
        
        ((S.user && (S.user.role === 'RESP_SECTION' || S.user.role === 'GRAND_RESPONSABLE')) ? 
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:12px;">Assignations (Équipe)</label>' +
'<div id="eventAssignmentsList">' + App.renderAssignmentsList() + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid #E5E5EA;padding-top:12px;">' +
            '<select id="assignUserSelect" style="width:100%;padding:10px;border-radius:8px;border:1px solid #E5E5EA;font-size:14px;outline:none;background:#F8F8F8;">' +
              '<option value="">Sélectionner un membre...</option>' +
              db(SK.USERS, []).map(function(u) { return '<option value="' + u.id + '">' + safeHtml(u.prenom + ' ' + u.nom) + '</option>'; }).join('') +
            '</select>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="text" id="assignTaskInput" placeholder="Tâche..." style="flex:1;padding:10px;border-radius:8px;border:1px solid #E5E5EA;font-size:14px;outline:none;background:#F8F8F8;" />' +
              '<button onclick="App.addAssignment()" style="background:#007AFF;color:#FFF;border:none;border-radius:8px;padding:0 16px;font-weight:700;cursor:pointer;">Ajouter</button>' +
            '</div>' +
          '</div>' +
        '</div>' : '') +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' +
            '<div style="font-size:15px;font-weight:600;color:#000;">Épingler en haut du Feed</div>' +
            '<div style="font-size:12px;color:#8E8E93;margin-top:2px;">Rend l\'événement très visible</div>' +
          '</div>' +
          '<label style="position:relative;display:inline-block;width:50px;height:30px;">' +
            '<input type="checkbox" id="eventPinned"' + (pinnedVal ? ' checked' : '') + ' style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#34C759\':\'#E5E5EA\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';">' +
            '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (pinnedVal ? '#34C759' : '#E5E5EA') + ';transition:.3s;border-radius:30px;">' +
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

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#F0F6FF;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:#007AFF;width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+h+'\')" style="background:#007AFF;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeEditPost()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeEditPost()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeEditPost()" style="font-size:14.5px;color:#65686F;cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#0B0B0C;letter-spacing:-0.2px;">Modifier la publication</h3>' +
          '<button type="button" onclick="App.saveEditPost(\'' + post.id + '\')" style="font-size:14px;color:#FFF;font-weight:800;background:linear-gradient(135deg,#007AFF,#0062CC);border:none;border-radius:20px;padding:8px 18px;cursor:pointer;box-shadow:0 4px 12px rgba(0,122,255,0.28);">Enregistrer</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#F0F6FF;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;"></div>' +
          previewHtml +

          (S.pendingMedia.length === 0 && S.postBg
            ? '<div id="bgPreviewZone" style="border-radius:22px;overflow:hidden;margin-bottom:14px;position:relative;min-height:180px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,0.14);' + (S.postBg.startsWith('url') ? 'background:' + S.postBg + ';background-size:cover;background-position:center;' : 'background:' + S.postBg + ';') + '">' +
                (S.postBg && !S.postBg.includes('linear-gradient') && !S.postBg.includes('url') ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.18);border-radius:22px;"></div>' : '') +
                '<textarea id="editPostText" oninput="App.onPostInput(this.value)" placeholder="Modifiez votre texte..." style="width:100%;min-height:180px;border:none;background:transparent;font-size:24px;font-weight:900;line-height:1.4;color:#FFF;resize:none;outline:none;box-sizing:border-box;font-family:inherit;text-align:center;padding:24px 20px;text-shadow:0 2px 12px rgba(0,0,0,0.3);position:relative;z-index:1;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</div>'
            : '<textarea id="editPostText" oninput="App.onPostInput(this.value)" placeholder="Modifiez votre texte... Tapez @ pour mentionner un membre..." style="width:100%;min-height:120px;border:none;background:#F6F7F9;border-radius:18px;padding:14px;font-size:15.5px;line-height:1.55;color:#0B0B0C;resize:none;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:14px;">' + safeHtml(S.postText||'') + '</textarea>'
          ) +

          '<!-- Confidentialité -->' +
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:#0B0B0C;display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:13px;background:#EAF2FF;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">🔒</span>Qui peut voir cette publication ?</span>' +
            '<div style="display:flex;gap:4px;background:#EAEBEF;border-radius:16px;padding:3px;">' +
              '<button type="button" onclick="App.setPostVisibility(\'all\')" style="flex:1;padding:8px 6px;border-radius:13px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + (vis==='all'?'#FFFFFF':'transparent') + ';color:' + (vis==='all'?'#007AFF':'#6B7280') + ';box-shadow:' + (vis==='all'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">🌍 Tout le monde</button>' +
              '<button type="button" onclick="App.setPostVisibility(\'sections\')" style="flex:1;padding:8px 6px;border-radius:13px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + (vis==='sections'?'#FFFFFF':'transparent') + ';color:' + (vis==='sections'?'#007AFF':'#6B7280') + ';box-shadow:' + (vis==='sections'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">🔒 Sections ciblées</button>' +
            '</div>' +
            (vis === 'sections'
              ? '<div style="margin-top:10px;">' +
                  '<label style="font-size:12px;color:#8E8E93;font-weight:600;display:block;margin-bottom:6px;">Cliquer sur les sections autorisées :</label>' +
                  '<div id="targetSectionBadgesContainer">' + App.renderSectionBadges(S.postTargetSections||[], 'toggleTargetSection') + '</div>' +
                '</div>'
              : '') +
          '</div>' +

          '<!-- Programmation -->' +
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:#0B0B0C;display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:13px;background:#FFF3E5;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">⏰</span>Programmer la publication</span>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="date" id="editPostScheduleDate" value="' + schedDateVal + '" style="flex:1;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 10px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);" />' +
              '<input type="time" id="editPostScheduleTime" value="' + schedTimeVal + '" style="flex:1;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 10px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);" />' +
            '</div>' +
          '</div>' +

          renderPunctualityNudge() +

          '<!-- À propos -->' +
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (S.postAboutEventId?'10px':'0') + ';">' +
              '<span style="font-size:13px;font-weight:800;color:#0B0B0C;display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:13px;background:#F0EFFF;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">🗓️</span>À propos <span style="font-weight:600;color:#9AA0A8;font-size:11px;">(optionnel)</span></span>' +
              (S.postAboutEventId ? '<span onclick="App.clearAboutEvent()" style="color:#FF3B30;font-size:12px;font-weight:700;cursor:pointer;">Retirer</span>' : '') +
            '</div>' +
            (function(){
              if (!S.postAboutEventId) {
                return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;background:#FFF;border:1px dashed #C7C7CC;border-radius:12px;padding:10px;font-size:12.5px;font-weight:700;color:#5856D6;cursor:pointer;">+ Lier à un événement (ex : culte de dimanche)</button>';
              }
              var evAbout2 = db(SK.POSTS, []).find(function(p){ return p.id === S.postAboutEventId; });
              if (!evAbout2) return '';
              var evAbout2D = evAbout2.eventDate ? new Date(evAbout2.eventDate+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) : '';
              return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;display:flex;align-items:center;gap:8px;background:#FFF;border-radius:12px;padding:10px;text-align:left;border:none;cursor:pointer;">' +
                '<span style="font-size:16px;">🗓️</span>' +
                '<span style="flex:1;min-width:0;font-size:12.5px;font-weight:700;color:#1C1C1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(evAbout2.eventTitle||'') + (evAbout2D?' · '+evAbout2D:'') + (evAbout2.eventStart?' à '+evAbout2.eventStart:'') + '</span>' +
              '</button>';
            })() +
          '</div>' +

          '<!-- Éphémère -->' +
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="width:26px;height:26px;border-radius:13px;background:#FFEDE0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;">🕐</span>' +
                '<div>' +
                  '<div style="font-size:13px;font-weight:800;color:#0B0B0C;">Publication éphémère</div>' +
                  '<div style="font-size:11px;color:#8E8E93;">Disparaît automatiquement après 24h</div>' +
                '</div>' +
              '</div>' +
              '<label style="position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0;">' +
                '<input type="checkbox" id="editPostEphemeral" ' + (post.is_ephemeral ? 'checked' : '') + ' style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#FF9500\':\'#DADCE1\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';"/>' +
                '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (post.is_ephemeral?'#FF9500':'#DADCE1') + ';transition:.25s;border-radius:28px;">' +
                  '<span style="position:absolute;content:\'\';height:22px;width:22px;left:3px;bottom:3px;background-color:white;transition:.25s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);transform:' + (post.is_ephemeral?'translateX(20px)':'translateX(0)') + ';"></span>' +
                '</span>' +
              '</label>' +
            '</div>' +
          '</div>' +

        '</div>' +

        '<div style="padding:4px 16px 14px;">' +
          (S.pendingMedia.length === 0
            ? '<div style="display:flex;gap:8px;align-items:center;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none;">' +
                '<span style="font-size:11px;font-weight:700;color:#9AA0A8;flex-shrink:0;">Fond</span>' +
                '<div onclick="App.setPostBg(null)" style="width:30px;height:30px;border-radius:15px;background:#FFF;border:2px solid ' + (S.postBg===null?'#007AFF':'#E5E5EA') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:#3A3A3C;">Aa</div>' +
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
                  return '<div onclick="App.setPostBgIdx(' + idx + ')" style="width:30px;height:30px;border-radius:15px;background:' + bg + ';cursor:pointer;flex-shrink:0;border:2.5px solid ' + (isSel?'#FFF':'transparent') + ';box-shadow:' + (isSel?'0 0 0 2px #007AFF':'0 1px 3px rgba(0,0,0,0.15)') + ';transition:0.15s;"></div>';
                }).join('') +
              '</div>'
            : ''
          ) +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;color:#007AFF;font-size:12.5px;font-weight:800;background:#EAF2FF;padding:9px 14px;border-radius:16px;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
              'Photo / Vidéo' +
              '<input type="file" accept="image/*,video/*" multiple onchange="App.addMedia(event)" style="display:none;">' +
            '</label>' +
            '<span style="font-size:11.5px;color:#9AA0A8;font-weight:600;">' + (S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? '1 vidéo' : S.pendingMedia.length + '/10 photos') + '</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:12px;color:#6B7280;font-weight:600;line-height:1.4;background:#F6F7F9;padding:10px 12px;border-radius:14px;"><input type="checkbox" ' + (S.reduceVideoQuality?'checked':'') + ' onchange="App.toggleReduceVideoQuality()" style="width:17px;height:17px;flex-shrink:0;accent-color:#007AFF;"> 🎥 Nous réduisons la qualité vidéo en HD pour une expérience plus fluide</label>' +
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

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#F0F6FF;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:#007AFF;width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+h+'\')" style="background:#007AFF;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeRepostModal()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeRepostModal()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeRepostModal()" style="font-size:14.5px;color:#65686F;cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#0B0B0C;letter-spacing:-0.2px;">Partager</h3>' +
          '<button type="button" onclick="App.confirmRepost()" style="font-size:14px;color:#FFF;font-weight:800;background:linear-gradient(135deg,#007AFF,#0062CC);border:none;border-radius:20px;padding:8px 18px;cursor:pointer;box-shadow:0 4px 12px rgba(0,122,255,0.28);">Partager</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#F0F6FF;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;"></div>' +
          '<textarea id="repostText" oninput="App.onPostInput(this.value)" placeholder="Ajoutez un commentaire... Tapez # pour un hashtag ou @ pour mentionner un membre..." style="width:100%;min-height:90px;border:none;background:#F6F7F9;border-radius:18px;padding:14px;font-size:15.5px;line-height:1.55;color:#0B0B0C;resize:none;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:14px;">' + safeHtml(S.postText||'') + '</textarea>' +

          '<div style="background:#F6F7F9;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="padding:10px 12px;">' +
              '<strong style="font-size:13px;color:#0B0B0C;">' + safeHtml(post.author||'Membre') + '</strong>' +
            '</div>' +
            (previewMedia
              ? (isVideoUrl(previewMedia)
                  ? '<video src="'+previewMedia+'"' + (post.videoPoster ? ' poster="'+post.videoPoster+'"' : '') + ' muted preload="metadata" style="width:100%;max-height:220px;object-fit:cover;display:block;background:#000;"></video>'
                  : '<img src="'+previewMedia+'" style="width:100%;max-height:220px;object-fit:cover;display:block;">')
              : (post.postBg
                  ? '<div style="min-height:100px;display:flex;align-items:center;justify-content:center;padding:20px;background:' + post.postBg + ';"><p style="color:#FFF;font-size:15px;font-weight:800;text-align:center;margin:0;">' + safeHtml(previewCaption.slice(0,140)) + '</p></div>'
                  : '<p style="font-size:13.5px;color:#3A3A3C;margin:0;padding:12px;line-height:1.4;">' + safeHtml(previewCaption.slice(0,200)) + '</p>')
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
    return '<button type="button" onclick="App.selectAboutEvent(\''+ev.id+'\')" style="width:100%;display:flex;align-items:center;gap:12px;background:' + (isSel?'#F0EFFF':'#F8F8FA') + ';border:1.5px solid ' + (isSel?'#5856D6':'transparent') + ';border-radius:16px;padding:12px;margin-bottom:10px;cursor:pointer;text-align:left;">' +
      '<div style="background:#FFF;border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.06);width:44px;text-align:center;flex-shrink:0;">' +
        '<div style="background:#5856D6;color:#FFF;font-size:8.5px;font-weight:900;text-transform:uppercase;padding:3px 0;letter-spacing:0.5px;">' + evMonth + '</div>' +
        '<div style="font-size:18px;font-weight:900;color:#000;padding:3px 0;">' + evDay + '</div>' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:14px;font-weight:800;color:#1C1C1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(ev.eventTitle) + '</div>' +
        '<div style="font-size:12px;color:#8E8E93;margin-top:2px;">' + (ev.eventStart ? '🕒 ' + ev.eventStart + (ev.eventEnd ? ' — ' + ev.eventEnd : '') : '') + '</div>' +
      '</div>' +
      (isSel ? '<span style="color:#5856D6;font-size:18px;">✓</span>' : '') +
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
      return '<div style="text-align:center;padding:36px 20px;color:#8E8E93;">' +
        '<div style="font-size:38px;margin-bottom:10px;">🗓️</div>' +
        '<div style="font-size:15px;font-weight:800;color:#000;">' + (q ? 'Aucun résultat' : 'Aucun événement') + '</div>' +
        '<div style="font-size:13px;margin-top:4px;">' + (q ? 'Essayez un autre mot-clé.' : 'Créez un événement dans Planning & Cultes pour pouvoir le lier ici.') + '</div>' +
      '</div>';
    }

    var html = '';
    if (upcoming.length > 0) {
      html += '<div style="font-size:11px;font-weight:800;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 8px;">🔜 À venir</div>' +
        upcoming.map(renderAboutEventItemBtn).join('');
    }
    if (past.length > 0) {
      html += '<div style="font-size:11px;font-weight:800;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;margin:' + (upcoming.length>0?'14px':'4px') + ' 0 8px;">🕰️ Passés · pour un récap</div>' +
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
          '<span onclick="App.closeAboutEventPicker()" style="font-size:14.5px;color:#65686F;cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#0B0B0C;">À propos de quel événement ?</h3>' +
          '<span style="width:52px;"></span>' +
        '</div>' +
        '<div style="padding:0 16px 10px;">' +
          '<div style="display:flex;align-items:center;gap:8px;background:#F2F2F7;border-radius:12px;height:38px;padding:0 12px;">' +
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
        '<div style="width:20px;height:20px;border:3px solid #E2E4E9;border-top-color:#007AFF;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
        '<span style="font-size:12.5px;font-weight:700;color:#3A3A3C;">' + (S.reduceVideoQuality ? 'Traitement de la vidéo (HD)…' : 'Traitement de la vidéo…') + '</span>' +
      '</div>';
    }
    if (S.pendingMedia.length === 0) return '';

    var videoUrl = S.pendingMedia.find(function(m){ return isVideoUrl(m); });
    if (videoUrl) {
      return '<div style="position:relative;margin-bottom:12px;border-radius:18px;overflow:hidden;background:#000;">' +
        '<video src="' + videoUrl + '"' + (S.pendingVideoPoster ? ' poster="' + S.pendingVideoPoster + '"' : '') +
          ' controls playsinline preload="auto" onloadeddata="App.primeVideoFrame(this)" style="width:100%;max-height:300px;display:block;background:#000;"></video>' +
        '<button type="button" onclick="App.removeMedia(0)" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.65);border:none;border-radius:14px;width:28px;height:28px;color:#FFF;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;z-index:2;">×</button>' +
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

  // Rappel affiché dans le composeur quand l'utilisateur est assigné à un événement
  // du jour déjà commencé et n'a pas encore publié son arrivée : c'est cette
  // publication liée à l'événement qui déclenche le calcul de sa ponctualité.
  function renderPunctualityNudge() {
    if (!S.user) return '';
    var posts = db(SK.POSTS, []);
    var now = Date.now();
    var today = new Date().toISOString().split('T')[0];
    var pending = null;
    for (var i = 0; i < posts.length; i++) {
      var ev = posts[i];
      if (ev.type !== 'EVENT' || ev.eventDate !== today) continue;
      if (!(ev.assignments || []).some(function(a){ return a && a.userId === S.user.id; })) continue;
      var startTs = eventStartTimestamp(ev);
      if (!startTs || startTs > now) continue;             // pas encore commencé
      var alreadyCheckedIn = posts.some(function(p) {
        return p.userId === S.user.id && p.aboutEventId === ev.id && p.type !== 'EVENT' && p.type !== 'EVALUATION';
      });
      if (alreadyCheckedIn) continue;
      pending = { ev: ev, delay: Math.round((now - startTs) / 60000) };
      break;
    }
    if (!pending) return '';
    var stars = starsForDelay(pending.delay);
    var col = stars >= 4 ? '#10B981' : stars >= 2 ? '#F59E0B' : '#EF4444';
    var already = S.postAboutEventId === pending.ev.id;
    return '<div style="background:' + (already ? '#ECFDF5' : '#FFF7E6') + ';border:1px solid ' + (already ? '#A7F3D0' : '#FFE0A3') + ';border-radius:16px;padding:12px 14px;margin-bottom:10px;">' +
      '<div style="font-size:12.5px;font-weight:800;color:' + (already ? '#047857' : '#8A5A00') + ';margin-bottom:4px;">' +
        (already ? '✅ Arrivée enregistrée pour « ' + safeHtml(pending.ev.eventTitle || 'Événement') + ' »'
                 : '⏱️ Vous êtes assigné à « ' + safeHtml(pending.ev.eventTitle || 'Événement') + ' »') +
      '</div>' +
      '<div style="font-size:11.5px;color:#6B7280;line-height:1.45;">' +
        (already
          ? 'Publier maintenant vous attribuera <b style="color:' + col + ';">' + stars + '★</b> de ponctualité.'
          : 'Liez cette publication à l\'événement ci-dessous pour enregistrer votre arrivée. Actuellement : <b style="color:' + col + ';">' + stars + '★</b>' + (pending.delay > 0 ? ' (+' + pending.delay + ' min)' : ' (à l\'heure)') + '.') +
      '</div>' +
      (already ? '' :
        '<button type="button" onclick="App.selectAboutEvent(\'' + pending.ev.id + '\')" style="margin-top:8px;width:100%;background:#5856D6;color:#FFF;border:none;border-radius:12px;padding:9px;font-size:12.5px;font-weight:800;cursor:pointer;">Enregistrer mon arrivée à cet événement</button>') +
    '</div>';
  }

  function renderCreateModal(u) {
    var previewHtml = renderComposerMediaPreview();

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#F0F6FF;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:#007AFF;width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+h+'\')" style="background:#007AFF;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeCreate()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeCreate()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeCreate()" style="font-size:14.5px;color:#65686F;cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#0B0B0C;letter-spacing:-0.2px;">Nouvelle publication</h3>' +
          '<button type="submit" form="createPostForm" style="font-size:14px;color:#FFF;font-weight:800;background:linear-gradient(135deg,#007AFF,#0062CC);border:none;border-radius:20px;padding:8px 18px;cursor:pointer;box-shadow:0 4px 12px rgba(0,122,255,0.28);">Publier</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
            ((u && u.avatar_url)
              ? '<img src="' + u.avatar_url + '" style="width:42px;height:42px;border-radius:21px;object-fit:cover;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,0.12);" />'
              : '<div style="width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,' + ((u||{}).avatar_color||'#007AFF') + ',#0040CC);color:#FFF;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,0.12);">' + ((u&&u.prenom||'M').charAt(0)) + '</div>') +
            '<div>' +
              '<div style="font-size:14.5px;font-weight:800;color:#0B0B0C;">' + safeHtml((u&&u.prenom||'') + ' ' + (u&&u.nom||'')) + '</div>' +
              '<div style="font-size:11.5px;color:#007AFF;font-weight:700;background:#EEF5FF;display:inline-block;padding:2px 8px;border-radius:8px;margin-top:2px;">' + secNom((u&&u.section_id)||'cadrage') + ' · Tapez # pour les hashtags</div>' +
            '</div>' +
          '</div>' +

          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#F0F6FF;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;"></div>' +
          previewHtml +

          // Color preview or plain textarea — hauteur généreuse et garantie, tout le
          // reste (options, footer) défile désormais avec elle dans le même conteneur.
          (S.pendingMedia.length === 0 && S.postBg
            ? '<div id="bgPreviewZone" style="border-radius:22px;overflow:hidden;margin-bottom:14px;position:relative;min-height:180px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,0.14);' + (S.postBg.startsWith('url') ? 'background:' + S.postBg + ';background-size:cover;background-position:center;' : 'background:' + S.postBg + ';') + '">' +
                (S.postBg && !S.postBg.includes('linear-gradient') && !S.postBg.includes('url') ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.18);border-radius:22px;"></div>' : '') +
                '<textarea id="newPostText" oninput="App.onPostInput(this.value)" placeholder="Quoi de neuf ?" style="width:100%;min-height:180px;border:none;background:transparent;font-size:24px;font-weight:900;line-height:1.4;color:#FFF;resize:none;outline:none;box-sizing:border-box;font-family:inherit;text-align:center;padding:24px 20px;text-shadow:0 2px 12px rgba(0,0,0,0.3);position:relative;z-index:1;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</div>'
            : '<form id="createPostForm" onsubmit="App.submitPost(event)">' +
                '<textarea id="newPostText" oninput="App.onPostInput(this.value)" placeholder="Quoi de neuf ? Tapez # pour ajouter un hashtag de section..." style="width:100%;min-height:140px;border:none;background:transparent;font-size:15.5px;line-height:1.55;color:#0B0B0C;resize:none;outline:none;box-sizing:border-box;font-family:inherit;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</form>'
          ) +
          (S.postBg ? '<form id="createPostForm" onsubmit="App.submitPost(event)" style="display:none;"></form>' : '') +

          // Qui peut voir
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
              '<span style="font-size:13px;font-weight:800;color:#0B0B0C;display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:13px;background:#EAF2FF;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">🔒</span>Qui peut voir ?</span>' +
            '</div>' +
            '<div style="display:flex;gap:4px;background:#EAEBEF;border-radius:16px;padding:3px;">' +
              '<button type="button" onclick="App.setPostVisibility(\'all\')" style="flex:1;padding:8px 6px;border-radius:13px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + ((S.postVisibility||'all')==='all'?'#FFFFFF':'transparent') + ';color:' + ((S.postVisibility||'all')==='all'?'#007AFF':'#6B7280') + ';box-shadow:' + ((S.postVisibility||'all')==='all'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">🌍 Tout le monde</button>' +
              '<button type="button" onclick="App.setPostVisibility(\'sections\')" style="flex:1;padding:8px 6px;border-radius:13px;font-size:11.5px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + ((S.postVisibility||'all')==='sections'?'#FFFFFF':'transparent') + ';color:' + ((S.postVisibility||'all')==='sections'?'#007AFF':'#6B7280') + ';box-shadow:' + ((S.postVisibility||'all')==='sections'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">🔒 Sections ciblées</button>' +
            '</div>' +
            (S.postVisibility === 'sections'
              ? '<div style="margin-top:10px;"><div id="targetSectionBadgesContainer">' + App.renderSectionBadges(S.postTargetSections||[], 'toggleTargetSection') + '</div></div>'
              : '') +
          '</div>' +

          // Programmer
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:#0B0B0C;display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:13px;background:#FFF3E5;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">⏰</span>Programmer <span style="font-weight:600;color:#9AA0A8;font-size:11px;">(optionnel)</span></span>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="date" id="postScheduleDate" style="flex:1;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 10px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);" />' +
              '<input type="time" id="postScheduleTime" style="flex:1;height:40px;border-radius:12px;border:none;background:#FFF;padding:0 10px;font-size:12.5px;outline:none;box-shadow:0 1px 2px rgba(16,24,40,0.06);" />' +
            '</div>' +
          '</div>' +

          // À propos
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (S.postAboutEventId?'10px':'0') + ';">' +
              '<span style="font-size:13px;font-weight:800;color:#0B0B0C;display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:13px;background:#F0EFFF;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">🗓️</span>À propos <span style="font-weight:600;color:#9AA0A8;font-size:11px;">(optionnel)</span></span>' +
              (S.postAboutEventId ? '<span onclick="App.clearAboutEvent()" style="color:#FF3B30;font-size:12px;font-weight:700;cursor:pointer;">Retirer</span>' : '') +
            '</div>' +
            (function(){
              if (!S.postAboutEventId) {
                return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;background:#FFF;border:1px dashed #C7C7CC;border-radius:12px;padding:10px;font-size:12.5px;font-weight:700;color:#5856D6;cursor:pointer;">+ Lier à un événement (ex : culte de dimanche)</button>';
              }
              var evAbout = db(SK.POSTS, []).find(function(p){ return p.id === S.postAboutEventId; });
              if (!evAbout) return '';
              var evAboutD = evAbout.eventDate ? new Date(evAbout.eventDate+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) : '';
              return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;display:flex;align-items:center;gap:8px;background:#FFF;border-radius:12px;padding:10px;text-align:left;border:none;cursor:pointer;">' +
                '<span style="font-size:16px;">🗓️</span>' +
                '<span style="flex:1;min-width:0;font-size:12.5px;font-weight:700;color:#1C1C1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(evAbout.eventTitle||'') + (evAboutD?' · '+evAboutD:'') + (evAbout.eventStart?' à '+evAbout.eventStart:'') + '</span>' +
              '</button>';
            })() +
          '</div>' +

          // Éphémère
          '<div style="background:#F6F7F9;border-radius:20px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="width:26px;height:26px;border-radius:13px;background:#FFEDE0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;">🕐</span>' +
                '<div>' +
                  '<div style="font-size:13px;font-weight:800;color:#0B0B0C;">Publication éphémère</div>' +
                  '<div style="font-size:11px;color:#8E8E93;">Disparaît automatiquement après 24h</div>' +
                '</div>' +
              '</div>' +
              '<label style="position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0;">' +
                '<input type="checkbox" id="postEphemeral" style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#FF9500\':\'#DADCE1\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';"/>' +
                '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#DADCE1;transition:.25s;border-radius:28px;">' +
                  '<span style="position:absolute;content:\'\';height:22px;width:22px;left:3px;bottom:3px;background-color:white;transition:.25s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>' +
                '</span>' +
              '</label>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div style="padding:10px 16px 14px;border-top:0.5px solid #F2F2F7;flex-shrink:0;">' +
          // Color palette row
          (S.pendingMedia.length === 0
            ? '<div style="display:flex;gap:8px;align-items:center;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none;">' +
                '<span style="font-size:11px;font-weight:700;color:#9AA0A8;flex-shrink:0;">Fond</span>' +
                // "No color" option
                '<div onclick="App.setPostBg(null)" style="width:30px;height:30px;border-radius:15px;background:#FFF;border:2px solid ' + (S.postBg===null?'#007AFF':'#E5E5EA') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:#3A3A3C;">Aa</div>' +
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
                  return '<div onclick="App.setPostBgIdx(' + idx + ')" style="width:30px;height:30px;border-radius:15px;background:' + bg + ';cursor:pointer;flex-shrink:0;border:2.5px solid ' + (isSel?'#FFF':'transparent') + ';box-shadow:' + (isSel?'0 0 0 2px #007AFF':'0 1px 3px rgba(0,0,0,0.15)') + ';transition:0.15s;"></div>';
                }).join('') +
              '</div>'
            : ''
          ) +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;color:#007AFF;font-size:12.5px;font-weight:800;background:#EAF2FF;padding:9px 14px;border-radius:16px;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
              'Photo / Vidéo' +
              '<input type="file" accept="image/*,video/*" multiple onchange="App.addMedia(event)" style="display:none;">' +
            '</label>' +
            '<span style="font-size:11.5px;color:#9AA0A8;font-weight:600;">' + (S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? '1 vidéo' : S.pendingMedia.length + '/10 photos') + '</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:12px;color:#6B7280;font-weight:600;line-height:1.4;background:#F6F7F9;padding:10px 12px;border-radius:14px;"><input type="checkbox" ' + (S.reduceVideoQuality?'checked':'') + ' onchange="App.toggleReduceVideoQuality()" style="width:17px;height:17px;flex-shrink:0;accent-color:#007AFF;"> 🎥 Nous réduisons la qualité vidéo en HD pour une expérience plus fluide</label>' +
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
      listHtml = '<div style="text-align:center;padding:40px 20px;color:#8E8E93;">' +
        '<div style="font-size:38px;margin-bottom:10px;">👀</div>' +
        '<div style="font-size:15px;font-weight:800;color:#000;">Aucune vue pour l\'instant</div>' +
        '<div style="font-size:13px;margin-top:4px;">Les membres qui verront cette publication apparaîtront ici.</div>' +
      '</div>';
    } else {
      listHtml = ids.map(function(uid) {
        var vu = users.find(function(x){ return x.id === uid; });
        var nom = vu ? ((vu.prenom||'') + ' ' + (vu.nom||'')).trim() : 'Membre';
        var initial = (vu && vu.prenom ? vu.prenom.charAt(0) : 'M').toUpperCase();
        var color = (vu && vu.avatar_color) || '#007AFF';
        var avatarNode = (vu && vu.avatar_url)
          ? '<img src="' + vu.avatar_url + '" style="width:40px;height:40px;border-radius:20px;object-fit:cover;flex-shrink:0;" />'
          : '<div style="width:40px;height:40px;border-radius:20px;background:linear-gradient(135deg,' + color + ',#0040CC);color:#FFF;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + initial + '</div>';
        var secs = getUserSections(vu);
        var secLabel = secs.length > 0 ? secs.map(function(s){ return secNom(s); }).join(' · ') : '';
        return '<div onclick="App.closeViewers();App.openUserProfile(\'' + uid + '\')" style="display:flex;align-items:center;gap:12px;padding:10px 4px;cursor:pointer;">' +
          avatarNode +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:14px;font-weight:700;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(nom) + '</div>' +
            (secLabel ? '<div style="font-size:12px;color:#8E8E93;margin-top:1px;">' + safeHtml(secLabel) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    return '<div onclick="App.closeViewers()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10001;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;max-height:78vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;" onclick="App.closeViewers()">' +
          '<div style="width:38px;height:5px;background:#E2E4E9;border-radius:3px;"></div>' +
        '</div>' +
        '<div style="text-align:center;padding-bottom:12px;border-bottom:0.5px solid #F2F2F7;">' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#000;">Vues</h3>' +
          '<p style="font-size:12px;color:#8E8E93;margin:2px 0 0;">' + ids.length + ' membre' + (ids.length>1?'s':'') + ' ' + (ids.length>1?'ont':'a') + ' vu cette publication</p>' +
        '</div>' +
        '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 16px 24px;">' + listHtml + '</div>' +
      '</div>' +
    '</div>';
  }

