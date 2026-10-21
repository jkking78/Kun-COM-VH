// KUN COM VH — Partie 6c : Activité, profil et badges

  'use strict';
  // ============================================================
  // HELPER : Mise à jour activité utilisateur courant
  // ============================================================
  function updateUserActivity(actionLabel) {
    if (!S.user) return;
    var users = db(SK.USERS, []);
    var idx = users.findIndex(function(u){ return u.id === S.user.id; });
    if (idx === -1) return;
    var now = new Date().toISOString();
    users[idx].last_action_at = now;
    users[idx].last_action_label = actionLabel || 'Action';
    users[idx].last_seen_at = now;
    users[idx].is_online = true;
    S.user = users[idx];
    try { localStorage.setItem(SK.SESS, JSON.stringify(S.user)); } catch(e) {}
    dbSet(SK.USERS, users);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    } catch(e) { return iso; }
  }





  // ============================================================
  // PROFILE TAB
  // ============================================================
  // BADGES : obtenus d'après l'historique réel des services (rien à saisir).
  // Les badges pas encore obtenus restent visibles, grisés, avec leur condition.
  function badgesMembre(userId) {
    var h = punctualityHistory(userId);
    var cycle = punctualityHistory(userId, currentCycleStartTs());
    var serie = 0;
    for (var i = 0; i < h.entries.length && h.entries[i].status === 'ontime'; i++) serie++;
    return [
      { id:'premier', emoji:'🎬', nom:'Premier service', cond:'Assurer un premier service', ok: h.count >= 1 },
      { id:'dix', emoji:'🔟', nom:'10 services', cond:'Assurer 10 services', ok: h.count >= 10 },
      { id:'serie', emoji:'🔥', nom:'Série de 5', cond:'5 services d\'affilée à l\'heure', ok: serie >= 5 },
      { id:'cycle', emoji:'⏱️', nom:'Cycle à l\'heure', cond:'Au moins 3 services ce cycle, tous à l\'heure', ok: cycle.count >= 3 && cycle.onTimeCount === cycle.count },
      { id:'tache', emoji:'📦', nom:'Livré à temps', cond:'Livrer une tâche avant sa date limite', ok: h.entries.some(function(e){ return e.kind === 'task' && e.status === 'ontime'; }) },
      { id:'pilier', emoji:'🏛️', nom:'Pilier', cond:'Assurer 25 services', ok: h.count >= 25 }
    ];
  }

  function renderBadges(freshU) {
    var badges = badgesMembre(freshU.id);
    var obtenus = badges.filter(function(b){ return b.ok; }).length;
    return '<div id="badges" style="background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:16px;padding:14px 16px;margin-top:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">' +
        '<strong style="font-size:15px;color:' + UI.ink + ';">Badges</strong>' +
        '<span style="font-size:12px;font-weight:700;color:' + UI.faint + ';">' + obtenus + ' / ' + badges.length + '</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
        badges.map(function(b) {
          return '<div title="' + safeHtml(b.cond) + '" class="' + (b.ok ? 'kc-apparait' : '') + '" style="text-align:center;padding:10px 4px;border-radius:12px;background:' + (b.ok ? 'var(--accent-soft)' : UI.tile) + ';' + (b.ok ? '' : 'opacity:0.55;') + '">' +
            '<div style="font-size:24px;line-height:1;' + (b.ok ? '' : 'filter:grayscale(1);') + '">' + b.emoji + '</div>' +
            '<div style="font-size:11.5px;font-weight:800;color:' + UI.ink + ';margin-top:6px;line-height:1.2;">' + safeHtml(b.nom) + '</div>' +
            (b.ok ? '' : '<div style="font-size:10px;color:' + UI.faint + ';margin-top:3px;line-height:1.25;">' + safeHtml(b.cond) + '</div>') +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  // HISTORIQUE DES SERVICES : chaque service ou tâche, avec son résultat.
  function renderHistoriqueServices(freshU) {
    var h = punctualityHistory(freshU.id);
    if (!h.count) return '';
    var tout = !!S.historiqueTout;
    var lignes = tout ? h.entries : h.entries.slice(0, 5);
    var pastille = function(e) {
      var c = e.status === 'ontime' ? ['var(--ok-soft)', UI.ok] : e.status === 'late' ? ['var(--warn-soft)', UI.warn] : ['var(--bad-soft)', UI.bad];
      return '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;background:' + c[0] + ';color:' + c[1] + ';white-space:nowrap;">' + (e.stars > 0 ? '+' : '') + e.stars + '★</span>';
    };
    return '<div id="historiqueServices" style="background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:16px;padding:14px 16px;margin-top:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">' +
        '<strong style="font-size:15px;color:' + UI.ink + ';">Historique des services</strong>' +
        '<span style="font-size:12px;font-weight:700;color:' + UI.faint + ';">' + h.count + '</span>' +
      '</div>' +
      lignes.map(function(e) {
        var d = e.startTs ? new Date(e.startTs).toLocaleDateString('fr-FR', {day:'numeric', month:'short', year:'numeric'}) : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid ' + UI.tile + ';">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:13px;font-weight:700;color:' + UI.ink + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(e.eventTitle) + (e.task ? ' · <span style="font-weight:600;color:' + UI.muted + ';">' + safeHtml(e.task) + '</span>' : '') + '</div>' +
            '<div style="font-size:11px;color:' + UI.faint + ';">' + d + ' · ' + safeHtml(e.label || '') + '</div>' +
          '</div>' +
          pastille(e) +
        '</div>';
      }).join('') +
      (h.count > 5
        ? '<button type="button" onclick="App.basculerHistorique()" style="width:100%;min-height:40px;margin-top:6px;background:none;border:none;color:' + UI.lien + ';font-size:13px;font-weight:700;cursor:pointer;">' + (tout ? 'Réduire' : 'Voir les ' + h.count + ' services') + '</button>'
        : '') +
    '</div>';
  }

  function renderProfile(u, posts) {
    try {
    if (!u || !u.id) {
      return '<div style="min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center;">' +
        '<div style="width:36px;height:36px;border:3px solid var(--line);border-top-color:#0B5FE0;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:12px;"></div>' +
        '<div style="font-size:15px;font-weight:700;color:var(--ink);">Chargement du profil...</div>' +
      '</div>';
    }
    var allProfiles = db(SK.USERS, []);
    var freshU = allProfiles.find(function(p){ return p.id === u.id; }) || u;

    var isMe = S.user && S.user.id === freshU.id;
    var profileTab = S.profileTab || 'tout';

    var ROLE_THEMES = {
      GRAND_RESPONSABLE: {
        primary: '#D4AF37', // Gold
        coverGradient: '#CBA35C',
        badgeBg: '#CBA35C',
        badgeText: '#5A4300'
      },
      RESP_SECTION: {
        primary: '#0B3B60', // Sapphire
        coverGradient: '#0B0D12',
        badgeBg: '#0B5FE0',
        badgeText: '#FFF'
      },
      MEMBRE: {
        primary: '#0B5FE0', // Standard Blue
        coverGradient: '#0B0D12',
        badgeBg: 'var(--tile)',
        badgeText: '#0B5FE0'
      },
      STAGIAIRE: {
        primary: '#D98A0B', // Orange
        coverGradient: '#D98A0B',
        badgeBg: 'var(--warn-soft)',
        badgeText: '#D98A0B'
      }
    };
    var theme = ROLE_THEMES[freshU.role] || ROLE_THEMES['MEMBRE'];

    // ---- Stats ----
    var myPosts = posts.filter(function(p){ return p.userId === freshU.id && p.type !== 'TASK_DONE' && p.type !== 'EVENT_ARCHIVED'; }).sort(function(a,b){return (b.timestamp||0)-(a.timestamp||0)});
    var photosPosts = myPosts.filter(function(p){ return p.mediaUrls && p.mediaUrls.length > 0; });
    var eventPosts = myPosts.filter(function(p){ return p.type === 'EVENT'; });
    var myLikesCount = posts.filter(function(p){ return Array.isArray(p.likedBy) && p.likedBy.indexOf(freshU.id) !== -1; }).length;
    var myCommentsCount = 0;
    posts.forEach(function(p){ myCommentsCount += (p.comments||[]).filter(function(c){ return c.userId === freshU.id; }).length; });

    // ---- Avatar ----

    // NOTE : l'ancien « indice de confiance » combinait présences et évaluations
    // (score sur 20, bonus/malus, moyenne des bilans). Il a été remplacé par
    // renderEngagementsCard, entièrement fondé sur la ponctualité automatique.
    // Ses calculs ont été retirés : ils tournaient encore à chaque rendu de profil
    // sans que rien ne les affiche.

    var avatarContent = freshU.avatar_url
      ? '<img src="' + safeUrl(freshU.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
      : '<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,'+(theme.primary)+',#000);color:#FFF;font-size:34px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';

    // ---- Cover ----
    var coverBg = freshU.cover_url
      ? 'background:url(\'' + jsArg(urlSure(freshU.cover_url)) + '\') center/cover no-repeat;'
      : 'background:' + theme.coverGradient + ';';

    // ---- Sections badges ----
    // On n'affiche que les sections reconnues (évite le badge "Général" fantôme
    // pour d'anciennes sections supprimées comme Son/Lumière/Montage).
    var uSecs = getUserSections(freshU).filter(function(s){ return SECTIONS.some(function(x){ return x.id === s; }); });
    var secBadges = uSecs.map(function(s){
      var sc = secColor(s) || '#0B5FE0';
      return '<span style="background:' + sc + '22;color:' + sc + ';padding:4px 10px;border-radius:12px;font-size:12px;font-weight:800;">' + secNom(s) + '</span>';
    }).join('');

    // ---- Sticky top bar ----
    // Sur SON PROPRE profil, la maquette n'a pas de barre de titre : l'écran
    // s'ouvre directement sur le grand nom. On ne garde la barre (avec retour)
    // que pour le profil d'un autre membre, où elle est indispensable.
    var topBar = isMe ? '' : '<div style="position:sticky;top:0;z-index:200;background:' + UI.card + ';border-bottom:0.5px solid ' + UI.line + ';display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">' +
      (isMe
        ? '<button onclick="App.tab(\'home\')" style="background:none;border:none;width:34px;height:34px;border-radius:' + UI.pill + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
            '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
          '</button>'
        : '<button onclick="App.closeUserProfile()" style="background:none;border:none;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;border-radius:' + UI.pill + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
            '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
          '</button>'
      ) +
      '<div style="font-size:15px;font-weight:600;color:' + UI.ink + ';letter-spacing:-0.2px;">' + safeHtml(freshU.prenom) + ' ' + safeHtml(freshU.nom) + '</div>' +
      '<div style="display:flex;gap:8px;">' +
        (isMe ? '<button onclick="App.openEditProfile()" style="background:none;border:none;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;border-radius:' + UI.pill + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '</button>' : '') +
        // Ouvre l'annuaire des membres (avec champ de recherche) : le bouton
        // n'était relié à rien jusqu'ici.
        '<button onclick="App.openMembersList()" title="Rechercher un membre" style="background:none;border:none;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;border-radius:' + UI.pill + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';

    // ---- Bandeau de couverture + avatar centré ----
    // L'avatar chevauche la couverture et les deux chiffres l'encadrent, comme
    // sur les références : la lecture part du visage, pas d'un coin de l'écran.
    // Sans borne de date : total des services depuis la création du compte.
    var hStats = punctualityHistory(freshU.id);
    // « Note » du profil = total de points du CYCLE en cours, sur 30 (même
    // valeur que la jauge de la carte « Mes engagements »).
    var noteCycle = Math.min(punctualityHistory(freshU.id, currentCycleStartTs()).total, 30);
    var isFollowing = !!(S.user && S.user.following && S.user.following.indexOf(freshU.id) !== -1);

    // Barre de données façon "readout" caméra : chiffres en chasse fixe.
    var online = estEnLigne(freshU);
    var avatarInner = freshU.avatar_url
      ? '<img src="' + safeUrl(freshU.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;display:block;" />'
      : '<div style="width:100%;height:100%;background:' + couleurSure(freshU.avatar_color) + ';color:#FFF;font-family:' + UI.fontDisplay + ';font-size:30px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';
    var roleLbl = ROLE_LABELS[freshU.role] || 'Membre';
    var elevated = freshU.role && freshU.role !== 'MEMBRE';
    // HERO aux couleurs du pôle (synthèse du design, profil « Équipe ») :
    // l'identité et les trois chiffres clés sur un bandeau coloré.
    var couleurPole = secColor(uSecs[0]) || UI.accent;
    var serie = 0;
    for (var si = 0; si < hStats.entries.length && hStats.entries[si].status === 'ontime'; si++) serie++;
    var tuile = function(v, l) {
      return '<div style="flex:1;min-width:0;background:rgba(255,255,255,0.16);border-radius:16px;padding:10px 12px;">' +
        '<div style="font-size:22px;font-weight:800;line-height:1.2;">' + v + '</div>' +
        '<div style="font-size:11px;font-weight:600;opacity:0.92;">' + l + '</div>' +
      '</div>';
    };
    var boutonVerre = function(action, label, svgPath, id) {
      return '<button' + (id ? ' id="' + id + '"' : '') + ' onclick="' + action + '" aria-label="' + label + '" style="width:40px;height:40px;flex-shrink:0;border:none;border-radius:20px;background:rgba(255,255,255,0.18);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
        '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + svgPath + '</svg></button>';
    };
    var nonLusProfil = isMe ? (S.user.notifications || []).filter(function(n){ return !n.read; }).length : 0;

    var hero = '<div style="background:' + couleurPole + ';color:#FFF;padding:20px 16px 20px;border-radius:0 0 28px 28px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
        '<span style="font-size:12px;font-weight:700;background:rgba(255,255,255,0.18);border-radius:12px;padding:5px 10px;">' +
          (uSecs.length ? 'Pôle ' + safeHtml(uSecs.map(function(x){ return secNom(x); }).join(' · ')) : 'Commit') + (elevated ? ' · ' + safeHtml(roleLbl) : '') +
        '</span>' +
        (isMe ? '<div style="display:flex;gap:6px;">' +
          '<span style="position:relative;display:flex;">' + boutonVerre('App.openNotifications()', 'Notifications', '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', 'notifCloche') +
            (nonLusProfil ? '<span style="position:absolute;top:-2px;right:-2px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#FFF;color:' + couleurPole + ';font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + nonLusProfil + '</span>' : '') + '</span>' +
          boutonVerre('App.openSettings()', 'Paramètres', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>') +
        '</div>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:14px;margin-top:14px;">' +
        '<div style="position:relative;flex-shrink:0;">' +
          '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#FFF;border:2px solid #FFF;">' + avatarInner + '</div>' +
          (online && !isMe ? '<span style="position:absolute;bottom:1px;right:1px;width:14px;height:14px;border-radius:50%;background:#22C55E;border:3px solid ' + couleurPole + ';"></span>' : '') +
          (isMe ? '<label aria-label="Changer ma photo" style="position:absolute;bottom:-2px;right:-2px;background:#FFF;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#101418" stroke-width="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
            '<input type="file" accept="image/*" onchange="App.handleAvatarSelect(event)" style="display:none;">' +
          '</label>' : '') +
        '</div>' +
        '<div style="min-width:0;">' +
          '<h1 style="font-size:24px;font-weight:800;letter-spacing:-0.3px;line-height:1.15;margin:0;overflow-wrap:anywhere;">' + safeHtml(freshU.prenom + ' ' + freshU.nom) + '</h1>' +
          (freshU.joined_at ? '<div style="font-size:13px;opacity:0.92;margin-top:2px;">Membre depuis ' + new Date(freshU.joined_at).toLocaleDateString('fr-FR', {month:'long', year:'numeric'}) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:18px;">' +
        tuile(noteCycle + '<span style="font-size:12px;opacity:0.85;">/30</span>', 'Note du cycle') +
        tuile(hStats.count, 'Services') +
        tuile(serie, 'Série à l\'heure') +
      '</div>' +
    '</div>' +

    // Présentation et actions, sur le fond de page.
    '<div style="background:' + UI.page + ';padding:16px 16px 4px;">' +
      (freshU.bio ? '<p style="font-size:15px;color:' + UI.ink2 + ';line-height:1.5;margin:0 0 10px;white-space:pre-wrap;">' + safeHtml(freshU.bio) + '</p>' : '') +
      (freshU.skills ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">' +
        freshU.skills.split(',').map(function(x){ var t=(x||'').trim(); return t ? '<span style="background:' + UI.card + ';color:' + UI.ink + ';font-size:13px;font-weight:600;padding:5px 12px;border-radius:12px;">' + safeHtml(t) + '</span>' : ''; }).join('') +
      '</div>' : '') +
      '<div style="display:flex;gap:8px;">' +
        (isMe
          ? '<button onclick="App.openEditProfile()" style="flex:1;min-height:48px;background:' + UI.accent + ';color:#FFF;border:none;border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;">Modifier le profil</button>' +
            '<button onclick="App.tab(\'home\');App.openCreate();" style="flex:1;min-height:48px;background:' + UI.card + ';color:' + UI.ink + ';border:1.5px solid var(--line2);border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;">Publier</button>'
          : '<button onclick="App.toggleFollow(\'' + jsArg(freshU.id) + '\')" style="flex:1;min-height:48px;background:' + (isFollowing ? UI.card : UI.accent) + ';color:' + (isFollowing ? UI.ink : '#FFF') + ';border:' + (isFollowing ? '1.5px solid var(--line2)' : 'none') + ';border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;">' + (isFollowing ? 'Suivi' : 'Suivre') + '</button>' +
            '<button onclick="App.openDirectMessage(\'' + jsArg(freshU.id) + '\')" style="flex:1;min-height:48px;background:' + UI.card + ';color:' + UI.ink + ';border:1.5px solid var(--line2);border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;">Message</button>'
        ) +
      '</div>' +
    '</div>';

    // ---- Info block ----
    // Le nom, le rôle, les pôles et la bio sont désormais dans le bandeau centré
    // ci-dessus : ce bloc ne garde que l'indice de confiance et les informations.
    // Le profil ne porte plus que la carte « Mes engagements » (maquette).
    // Informations, apparence, administration, compte et déconnexion vivent
    // désormais dans la page Paramètres (voir renderSettingsModal).
    var infoBlock = '<div style="background:' + UI.page + ';padding:0 16px 16px;">' +
      renderBadges(freshU) +
      renderHistoriqueServices(freshU) +
      '<div style="margin-top:12px;">' + renderEngagementsCard(freshU) + '</div>' +
      // Accès direct aux conditions d'utilisation depuis son propre profil.
      (isMe ? '<button type="button" onclick="ouvrirConditions()" style="display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;margin-top:4px;padding:12px 16px;background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:999px;font-size:15px;font-weight:600;color:' + UI.ink + ';cursor:pointer;text-align:left;">' +
        '<span>Conditions d\'utilisation</span><span style="color:' + UI.faint + ';">›</span>' +
      '</button>' : '') +
    '</div>';

    // ---- Continuous scroll (no tabs) ----
    var tabBar = '';

    // ---- Feed: continuous scroll layout ----
    var feed = '<div style="background:var(--tile);min-height:50vh;padding-bottom:100px;">';

    // Sections « Médias », « Événements » et « Liens partagés » retirées :
    // la maquette ne garde qu'une grille « Publications récentes », et ces
    // blocs reprenaient déjà les mêmes publications sous une autre forme.

    // Section 3: All publications header
    var gridTab = isMe ? (S.profileGridTab || 'posts') : 'posts';
    var selectMode = isMe && gridTab === 'posts' && S.profileSelectMode;
    var selectedIds = S.selectedProfilePostIds || [];
    var savedPostsMap = S.savedPosts || {};
    var savedPosts = posts.filter(function(p){ return savedPostsMap[p.id] && p.type !== 'EVENT_ARCHIVED'; }).sort(function(a,b){return (b.timestamp||0)-(a.timestamp||0);});

    feed += '<div style="background:' + UI.page + ';padding:4px 20px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
      (isMe
        ? '<div style="display:flex;gap:4px;background:' + UI.tile + ';border-radius:12px;padding:3px;">' +
            '<span onclick="App.setProfileGridTab(\'posts\')" style="display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:' + (gridTab==='posts'?UI.card:'transparent') + ';color:' + (gridTab==='posts'?UI.ink:UI.faint) + ';">Publications</span>' +
            '<span onclick="App.setProfileGridTab(\'saved\')" style="display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:' + (gridTab==='saved'?UI.card:'transparent') + ';color:' + (gridTab==='saved'?UI.ink:UI.faint) + ';">Enregistrées</span>' +
          '</div>'
        : '<h3 style="font-family:' + UI.fontDisplay + ';font-size:28px;font-weight:800;letter-spacing:-0.5px;color:var(--ink);margin:0;">Publications récentes</h3>') +
      (isMe && gridTab === 'posts' && myPosts.length > 0
        ? '<span onclick="App.toggleProfileSelectMode()" style="font-size:13px;font-weight:700;color:' + UI.lien + ';cursor:pointer;flex-shrink:0;">' + (selectMode ? 'Annuler' : 'Sélectionner') + '</span>'
        : '') +
    '</div>';

    var filteredPosts = gridTab === 'saved' ? savedPosts : myPosts;

    if (filteredPosts.length === 0) {
      feed += '<div style="padding:44px 20px;text-align:center;background:' + UI.page + ';">' +
        '<div style="font-size:15px;font-weight:600;color:' + UI.ink + ';margin-bottom:4px;">' + (gridTab === 'saved' ? 'Aucune publication enregistrée' : 'Aucune publication') + '</div>' +
        '<div style="font-size:13px;color:' + UI.faint + ';">' + (gridTab === 'saved' ? 'Le signet sur une publication l\'ajoute ici.' : 'Tes publications apparaîtront ici.') + '</div>' +
      '</div>';
    } else {
      // GRILLE de vignettes carrées, 2 colonnes (maquette). Une publication sans
      // média affiche un extrait de son texte sur une tuile ; si le média échoue à
      // charger (URL cassée/expirée), on retombe aussi sur ce texte via onerror.
      feed += '<div style="background:' + UI.page + ';padding:0 20px 24px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        filteredPosts.map(function(p) {
          var isEvent = p.type === 'EVENT' || p.type === 'EVENT_ARCHIVED';
          var isRepost = p.type === 'REPOST';
          // Un événement héberge son image dans eventImage (pas mediaUrls) ; un
          // repartage sans média/texte propres retombe sur ceux de la publication
          // d'origine — sinon sa tuile était toujours vide.
          var media = (p.mediaUrls && p.mediaUrls.length) ? p.mediaUrls[0]
            : (isEvent && p.eventImage) ? p.eventImage
            : (isRepost && p.originalMediaUrls && p.originalMediaUrls.length) ? p.originalMediaUrls[0]
            : null;
          var isVid = media && isVideoUrl(media);
          var bg = p.postBg || (isRepost ? p.originalPostBg : null);
          var textSource = p.caption || (isRepost ? p.originalCaption : '') || p.eventTitle;
          var textFallback = safeHtml(String(textSource || '').trim().slice(0, 90) || 'Publication');
          var inner = media
            ? (isVid
                ? '<video src="' + safeUrl(media) + '"' + (p.videoPoster ? ' poster="' + safeUrl(p.videoPoster) + '"' : '') + ' muted playsinline preload="metadata" onerror="App.handleProfileTileImgError(this)" data-fallback="' + textFallback + '" style="width:100%;height:100%;object-fit:cover;display:block;"></video>' +
                  '<div style="position:absolute;top:8px;right:8px;pointer-events:none;"><svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.95)"><path d="M8 5v14l11-7z"/></svg></div>'
                : '<img src="' + safeUrl(media) + '" loading="lazy" onerror="App.handleProfileTileImgError(this)" data-fallback="' + textFallback + '" style="width:100%;height:100%;object-fit:cover;display:block;" />')
            // Un événement sans image se reconnaît d'un coup d'œil (icône + date).
            : (isEvent
                ? '<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;background:linear-gradient(160deg, rgba(11,95,224,0.12), rgba(11,95,224,0.04));">' +
                    ico('calendar', 22, UI.lien) +
                    '<p style="margin:0;color:' + UI.ink + ';font-size:13px;font-weight:800;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">' + safeHtml(String(p.eventTitle || 'Événement').slice(0, 60)) + '</p>' +
                    (p.eventDate ? '<span style="font-size:11px;font-weight:700;color:' + UI.lien + ';">' + new Date(p.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', {day:'numeric', month:'short'}) + '</span>' : '') +
                  '</div>'
                // Une publication sans média mais avec un fond coloré (texte stylisé,
                // y compris via un repartage) reprend ce même fond en miniature.
                : (bg
                    ? '<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;' + (String(bg).indexOf('url') === 0 ? 'background:' + bg + ';background-size:cover;background-position:center;' : 'background:' + bg + ';') + '">' +
                        '<p style="margin:0;color:#FFF;font-size:13px;font-weight:800;line-height:1.4;text-shadow:0 1px 4px rgba(0,0,0,0.28);overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;">' + textFallback + '</p>' +
                      '</div>'
                    : '<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;line-height:1.45;color:' + UI.muted + ';overflow:hidden;">' + textFallback + '</div>'));
          var isSel = selectedIds.indexOf(p.id) !== -1;
          var action = selectMode
            ? 'App.toggleSelectProfilePost(\'' + jsArg(p.id) + '\')'
            : 'App.goToPost(\'' + jsArg(p.id) + '\')';
          return '<div data-tile onclick="' + action + '" style="position:relative;aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:' + UI.tile + ';cursor:pointer;">' +
            inner +
            (selectMode
              ? '<div style="position:absolute;inset:0;background:' + (isSel ? 'rgba(11,95,224,0.18)' : 'transparent') + ';"></div>' +
                '<div style="position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:12px;background:' + (isSel ? UI.accent : 'rgba(255,255,255,0.92)') + ';border:2px solid ' + (isSel ? UI.accent : UI.line) + ';display:flex;align-items:center;justify-content:center;">' +
                  (isSel ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') +
                '</div>'
              : '') +
          '</div>';
        }).join('') +
      '</div>';
    }

    feed += '</div>';

    // Barre d'action flottante en mode sélection
    if (selectMode) {
      feed += '<div style="position:fixed;left:0;right:0;bottom:64px;z-index:500;display:flex;justify-content:center;padding:0 16px;">' +
        '<div style="width:100%;max-width:460px;background:#0B0D12;border-radius:20px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 8px 24px rgba(0,0,0,0.28);">' +
          '<span style="color:#FFF;font-size:13px;font-weight:700;">' + selectedIds.length + ' sélectionnée' + (selectedIds.length>1?'s':'') + '</span>' +
          '<div style="display:flex;gap:8px;">' +
            '<span onclick="App.selectAllProfilePosts()" style="color:var(--faint);font-size:13px;font-weight:700;cursor:pointer;padding:8px 4px;">Tout</span>' +
            '<button onclick="App.openBulkDeleteConfirm()" ' + (selectedIds.length===0?'disabled':'') + ' style="background:#D92D20;color:#FFF;border:none;border-radius:12px;padding:9px 16px;font-size:13px;font-weight:800;cursor:pointer;opacity:' + (selectedIds.length===0?'0.4':'1') + ';">Supprimer</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return topBar + hero + infoBlock + tabBar + feed;
    } catch(profileErr) {
      console.error("Profile Screen render error:", profileErr);
      return '<div style="padding:40px;text-align:center;min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
        '<div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:8px;">Impossible d\'afficher le profil</div>' +
        '<p style="font-size:13px;color:var(--faint);margin-bottom:16px;">Une erreur temporaire d\'affichage est survenue.</p>' +
        '<button onclick="App.tab(\'profile\')" style="background:#0B5FE0;color:#FFF;border:none;padding:10px 20px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">Réessayer</button>' +
      '</div>';
    }
  }

    // ============================================================
    // SUPPRESSION DE COMPTE — action irréversible, double confirmation
    // ============================================================
    function renderDeleteAccountModal() {
      var u = S.user || {};
      var posts = db(SK.POSTS, []);
      var myPostsCount = posts.filter(function(p){ return p.userId === u.id; }).length;
      var busy = S.deleteAccountBusy;

      return '<div onclick="' + (busy?'':'App.closeDeleteAccount()') + '" style="position:fixed;inset:0;background:rgba(15,15,20,0.65);backdrop-filter:blur(2px);z-index:10002;display:flex;justify-content:center;align-items:center;padding:24px;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:380px;background:var(--card);border-radius:20px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
          '<div style="width:52px;height:52px;border-radius:26px;background:var(--bad-soft);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' + ico('alert', 26, UI.bad) + '</div>' +
          '<h3 style="font-size:17px;font-weight:800;color:var(--ink);margin:0 0 8px;text-align:center;">Supprimer définitivement ton compte ?</h3>' +
          '<p style="font-size:13px;color:var(--muted);line-height:1.5;margin:0 0 4px;text-align:center;">' +
            'Cette action est <strong>irréversible</strong>. Ton profil ainsi que ' +
            (myPostsCount > 0 ? '<strong>' + myPostsCount + ' publication' + (myPostsCount>1?'s':'') + '</strong>' : 'toutes tes publications') +
            ' seront supprimés définitivement. Tu ne pourras pas les récupérer.' +
          '</p>' +
          '<div style="background:var(--tile);border-radius:16px;padding:12px;margin:16px 0 10px;">' +
            '<label style="font-size:12px;font-weight:700;color:var(--muted);display:block;margin-bottom:6px;">Tape <strong style="color:#D92D20;">SUPPRIMER</strong> pour confirmer</label>' +
            '<input id="deleteAccountConfirmInput" type="text" placeholder="SUPPRIMER" ' + (busy?'disabled':'') + ' class="kc-champ" style="' + styleChamp() + 'font-weight:700;text-transform:uppercase;" />' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">' +
            '<button type="button" onclick="App.confirmDeleteAccount()" ' + (busy?'disabled':'') + ' style="width:100%;background:#D92D20;color:#FFF;border:none;border-radius:999px;padding:13px;font-size:15px;font-weight:800;cursor:pointer;opacity:' + (busy?'0.6':'1') + ';">' + (busy ? 'Suppression en cours…' : 'Supprimer définitivement') + '</button>' +
            '<button type="button" onclick="App.closeDeleteAccount()" ' + (busy?'disabled':'') + ' style="width:100%;background:var(--tile);color:var(--ink);border:none;border-radius:999px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;">Annuler</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // ============================================================
    // SUPPRESSION GROUPÉE — confirmation pour la sélection multiple depuis le profil
    // ============================================================
    function renderBulkDeleteConfirmModal() {
      var count = (S.selectedProfilePostIds || []).length;
      var busy = S.bulkDeleteBusy;
      return '<div onclick="' + (busy?'':'App.closeBulkDeleteConfirm()') + '" style="position:fixed;inset:0;background:rgba(15,15,20,0.65);backdrop-filter:blur(2px);z-index:10003;display:flex;justify-content:center;align-items:center;padding:24px;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:380px;background:var(--card);border-radius:20px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
          '<div style="width:52px;height:52px;border-radius:26px;background:var(--bad-soft);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' + ico('trash', 26, UI.bad) + '</div>' +
          '<h3 style="font-size:17px;font-weight:800;color:var(--ink);margin:0 0 8px;text-align:center;">Supprimer ' + count + ' publication' + (count>1?'s':'') + ' ?</h3>' +
          '<p style="font-size:13px;color:var(--muted);line-height:1.5;margin:0;text-align:center;">' +
            'Cette action est <strong>irréversible</strong>. Les publications et leurs photos/vidéos seront supprimées définitivement.' +
          '</p>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:18px;">' +
            '<button type="button" onclick="App.confirmBulkDelete()" ' + (busy?'disabled':'') + ' style="width:100%;background:#D92D20;color:#FFF;border:none;border-radius:999px;padding:13px;font-size:15px;font-weight:800;cursor:pointer;opacity:' + (busy?'0.6':'1') + ';">' + (busy ? 'Suppression en cours…' : 'Supprimer définitivement') + '</button>' +
            '<button type="button" onclick="App.closeBulkDeleteConfirm()" ' + (busy?'disabled':'') + ' style="width:100%;background:var(--tile);color:var(--ink);border:none;border-radius:999px;padding:13px;font-size:15px;font-weight:700;cursor:pointer;">Annuler</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // Panneau « Gérer les rôles » : liste les membres et permet à un Grand
    // Responsable de changer leur rôle (via l'Edge Function set-role → JWT).
    function renderRolesModal() {
      var me = S.user || {};
      var rank = { GRAND_RESPONSABLE: 0, RESP_SECTION: 1, MEMBRE: 2, STAGIAIRE: 3 };
      var members = (db(SK.USERS, []) || []).filter(function(m){ return m && m.id; });
      members.sort(function(a, b) {
        var ra = rank[a.role] == null ? 2 : rank[a.role];
        var rb = rank[b.role] == null ? 2 : rank[b.role];
        if (ra !== rb) return ra - rb;
        return (((a.prenom||'') + ' ' + (a.nom||'')).trim()).localeCompare(((b.prenom||'') + ' ' + (b.nom||'')).trim());
      });
      var roleBtn = function(m, role, label) {
        var active = (m.role || 'MEMBRE') === role;
        var busy = S.roleUpdatingId === m.id;
        var isSelf = m.id === me.id;
        var disabled = active || busy || isSelf;
        var bg = active ? '#0B5FE0' : 'var(--tile)';
        var col = active ? '#FFF' : 'var(--ink2)';
        return '<button ' + (disabled ? 'disabled ' : '') +
          'onclick="App.setMemberRole(\'' + jsArg(m.id) + '\',\'' + jsArg(role) + '\')" ' +
          'style="flex:1;background:' + bg + ';color:' + col + ';border:none;border-radius:999px;padding:8px 4px;font-size:11px;font-weight:800;cursor:' + (disabled ? 'default' : 'pointer') + ';opacity:' + ((busy || (isSelf && !active)) ? '0.45' : '1') + ';">' + label + '</button>';
      };
      var rows = members.map(function(m) {
        var name = safeHtml((((m.prenom||'') + ' ' + (m.nom||'')).trim()) || 'Membre');
        var color = couleurSure(m.avatar_color);
        var initial = (m.prenom || 'M').charAt(0).toUpperCase();
        var isMe = m.id === me.id;
        return '<div style="padding:12px 0;border-bottom:1px solid var(--line);">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
            '<div style="width:36px;height:36px;border-radius:20px;background:' + color + ';color:#FFF;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;">' + initial + '</div>' +
            '<div style="min-width:0;flex:1;">' +
              '<div style="font-size:15px;font-weight:800;color:var(--ink);">' + name + (isMe ? ' <span style="font-size:11px;color:var(--faint);font-weight:700;">(toi)</span>' : '') + '</div>' +
              '<div style="font-family:' + UI.fontMono + ';font-size:12px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(m.phone || m.email || '') + '</div>' +
            '</div>' +
            // Actions rares (mot de passe) rangées dans un menu, plus sous chaque membre.
            (isMe ? '' : '<button type="button" onclick="S.roleMenuId=(S.roleMenuId===\'' + jsArg(m.id) + '\'?null:\'' + jsArg(m.id) + '\');render()" aria-label="' + safeHtml('Plus d\'actions pour ' + (((m.prenom||'') + ' ' + (m.nom||'')).trim() || 'ce membre')) + '" aria-expanded="' + (S.roleMenuId === m.id ? 'true' : 'false') + '" style="width:44px;height:44px;flex-shrink:0;border:none;border-radius:22px;background:' + (S.roleMenuId === m.id ? 'var(--tile)' : 'none') + ';color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>') +
          '</div>' +
          '<div style="display:flex;gap:6px;">' +
            roleBtn(m, 'STAGIAIRE', 'Stagiaire') +
            roleBtn(m, 'MEMBRE', 'Membre') +
            roleBtn(m, 'RESP_SECTION', 'Responsable') +
            roleBtn(m, 'GRAND_RESPONSABLE', 'Admin') +
          '</div>' +
          (isMe || S.roleMenuId !== m.id ? '' :
            '<div style="margin-top:10px;">' +
              '<div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px;">Pôles (2 au plus)</div>' +
              '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + SECTIONS.map(function(sec) {
                var dedans = getUserSections(m).indexOf(sec.id) !== -1;
                return '<button type="button" aria-pressed="' + (dedans ? 'true' : 'false') + '" onclick="App.definirPoleMembre(\'' + jsArg(m.id) + '\',\'' + jsArg(sec.id) + '\')" style="display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:0 10px;border-radius:999px;border:1px solid ' + (dedans ? UI.accent : 'var(--line2)') + ';background:' + (dedans ? 'var(--accent-soft)' : 'var(--card)') + ';color:' + (dedans ? 'var(--accent-ink)' : 'var(--ink)') + ';font:inherit;font-size:12px;font-weight:700;cursor:pointer;">' + icoPole(sec.id, 13, 'currentColor') + safeHtml(sec.nom) + '</button>';
              }).join('') + '</div>' +
            '</div>') +
          (isMe || S.roleMenuId !== m.id ? '' :
            '<button onclick="S.roleMenuId=null;App.adminResetPassword(\'' + jsArg(m.id) + '\',\'' + jsArg(((m.prenom||'') + ' ' + (m.nom||'')).trim() || 'Membre') + '\')" style="margin-top:8px;width:100%;min-height:44px;box-sizing:border-box;background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:10px 12px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">' + ico('key', 14, 'currentColor') + 'Réinitialiser le mot de passe</button>') +
        '</div>';
      }).join('');

      return '<div onclick="App.closeRolesPanel()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10004;display:flex;justify-content:center;align-items:flex-end;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;max-height:88vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
          '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeRolesPanel()"><div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div></div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 4px;">' +
            '<h3 style="font-family:' + UI.fontDisplay + ';font-size:17px;font-weight:800;letter-spacing:-0.3px;margin:0;color:var(--ink);">Gérer les rôles</h3>' +
            '<button onclick="App.closeRolesPanel()" style="background:var(--tile);border:none;border-radius:16px;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;font-size:15px;cursor:pointer;">✕</button>' +
          '</div>' +
          '<p style="font-size:12px;color:var(--faint);padding:2px 20px 8px;margin:0;line-height:1.4;">Choisis un rôle pour chaque membre. La personne devra se <b>déconnecter puis reconnecter</b> pour que son nouveau rôle prenne effet.</p>' +
          '<div style="padding:0 20px 28px;">' + (rows || '<p style="text-align:center;color:var(--faint);padding:24px 0;">Aucun membre pour le moment.</p>') + '</div>' +
        '</div>' +
      '</div>';
    }

    // Mot de passe provisoire affiché à l'Admin après une réinitialisation, à
    // communiquer au membre (qui le changera ensuite dans son profil).
    function renderAdminResetPwModal() {
      var r = S.adminResetResult;
      if (!r) return '';
      return '<div onclick="App.closeAdminReset()" style="position:fixed;inset:0;background:rgba(15,15,20,0.6);z-index:10006;display:flex;justify-content:center;align-items:center;padding:24px;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:380px;background:var(--card);border-radius:20px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;">' +
          '<div style="margin-bottom:8px;display:flex;justify-content:center;">' + ico('key', 34, UI.accent, 1.6) + '</div>' +
          '<h3 style="font-size:17px;font-weight:800;color:var(--ink);margin:0 0 6px;">Mot de passe provisoire</h3>' +
          '<p style="font-size:13px;color:var(--muted);margin:0 0 16px;line-height:1.5;">Communique-le à <strong>' + safeHtml(r.name) + '</strong>. Il pourra le changer dans « Modifier le profil ».</p>' +
          '<div style="display:flex;align-items:center;gap:8px;background:var(--tile);border-radius:12px;padding:14px;margin-bottom:16px;">' +
            '<code style="flex:1;font-size:17px;font-weight:800;letter-spacing:1px;color:var(--ink);word-break:break-all;">' + safeHtml(r.password) + '</code>' +
            '<button onclick="App.copyAdminResetPw()" style="background:' + UI.accent + ';color:#FFF;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;">Copier</button>' +
          '</div>' +
          '<button onclick="App.closeAdminReset()" style="width:100%;background:var(--tile);color:var(--ink);border:none;border-radius:999px;padding:12px;font-size:15px;font-weight:800;cursor:pointer;">Fermer</button>' +
        '</div>' +
      '</div>';
    }

    function renderStorageStatsModal() {
      var loading = S.storageStatsLoading;
      var totalBytes = S.storageStatsTotalBytes || 0;
      var fileCount = S.storageStatsFileCount || 0;
      // Seuils des forfaits Supabase (indicatif — à ajuster si les tarifs changent)
      var FREE_LIMIT = 1 * 1024 * 1024 * 1024;      // 1 Go
      var PRO_LIMIT = 100 * 1024 * 1024 * 1024;      // 100 Go
      var pctFree = Math.min(100, (totalBytes / FREE_LIMIT) * 100);
      var pctPro = Math.min(100, (totalBytes / PRO_LIMIT) * 100);
      var overFree = totalBytes > FREE_LIMIT;
      var overPro = totalBytes > PRO_LIMIT;
      var overProCost = overPro ? (((totalBytes - PRO_LIMIT) / (1024*1024*1024)) * 0.0213) : 0;

      var bar = function(label, pct, over, sub) {
        return '<div style="margin-bottom:14px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">' +
            '<span style="font-size:13px;font-weight:700;color:var(--ink2);">' + label + '</span>' +
            '<span style="font-size:12px;font-weight:800;color:' + (over?'#D92D20':'var(--faint)') + ';">' + pct.toFixed(1) + '%</span>' +
          '</div>' +
          '<div style="height:8px;border-radius:4px;background:var(--line);overflow:hidden;">' +
            '<div style="height:100%;width:' + pct + '%;background:' + (over?'#D92D20':'#0B5FE0') + ';border-radius:4px;transition:width 0.4s;"></div>' +
          '</div>' +
          (sub ? '<div style="font-size:11px;color:var(--faint);margin-top:4px;">' + sub + '</div>' : '') +
        '</div>';
      };

      return '<div onclick="App.closeStorageStats()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10004;display:flex;justify-content:center;align-items:flex-end;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;max-height:88vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
          '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeStorageStats()">' +
            '<div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 4px;">' +
            '<h3 style="font-size:15px;font-weight:800;margin:0;color:var(--ink);">Stockage (Admin)</h3>' +
            '<button onclick="App.closeStorageStats()" style="background:var(--tile);border:none;border-radius:16px;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;font-size:15px;cursor:pointer;">✕</button>' +
          '</div>' +
          '<div style="padding:6px 20px 28px;">' +
            (loading ? '<div style="display:flex;align-items:center;gap:10px;justify-content:center;padding:30px 0;">' +
              '<div style="width:20px;height:20px;border:3px solid var(--line2);border-top-color:#0B5FE0;border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
              '<span style="font-size:13px;font-weight:700;color:var(--muted);">Calcul en cours…</span>' +
            '</div>' :
            S.storageStatsError ? '<div style="text-align:center;padding:20px 0;">' +
              '<p style="font-size:13px;color:#D92D20;font-weight:600;margin:0 0 14px;">' + safeHtml(S.storageStatsError) + '</p>' +
              '<button onclick="App.loadStorageStats()" style="background:var(--tile);border:none;border-radius:12px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;">Réessayer</button>' +
            '</div>' :
            (
              '<div style="text-align:center;padding:8px 0 20px;">' +
                '<div style="font-size:32px;font-weight:800;color:var(--ink);letter-spacing:-0.5px;">' + formatBytes(totalBytes) + '</div>' +
                '<div style="font-size:13px;color:var(--faint);font-weight:600;margin-top:2px;">' + fileCount + ' fichier' + (fileCount>1?'s':'') + ' dans le bucket post-media</div>' +
              '</div>' +
              bar('Forfait Gratuit (1 Go)', pctFree, overFree, overFree ? 'Dépassé — passage au forfait Pro nécessaire.' : (FREE_LIMIT-totalBytes > 0 ? formatBytes(FREE_LIMIT-totalBytes) + ' restants' : '')) +
              bar('Forfait Pro (100 Go inclus)', pctPro, overPro, overPro ? '≈ +' + overProCost.toFixed(2) + ' $/mois de dépassement' : formatBytes(PRO_LIMIT-totalBytes) + ' restants') +
              '<div style="font-size:11px;color:var(--faint);text-align:center;margin-top:16px;">Mis à jour ' + (S.storageStatsUpdatedAt ? timeAgo(S.storageStatsUpdatedAt) : '—') + '</div>'
            )) +
            '<div style="display:flex;gap:8px;margin-top:20px;">' +
              '<button onclick="App.loadStorageStats()" ' + (loading?'disabled':'') + ' style="flex:1;background:var(--tile);color:var(--ink);border:none;border-radius:999px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">' + ico('refresh', 14, 'currentColor') + 'Actualiser</button>' +
              '<button onclick="App.closeStorageStats()" style="flex:1;background:var(--bad-soft);color:#D92D20;border:none;border-radius:999px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;">Fermer</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function renderEditProfileModal(u) {
    var freshU = db(SK.USERS, []).find(function(p){ return p.id === u.id; }) || u;
    
    var displayAvatar = S.avatarPreview || freshU.avatar_url;

    var avatarContent = displayAvatar 
      ? '<img id="editAvatarPreview" src="' + safeUrl(displayAvatar) + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '<div id="editAvatarPreview" style="width:100%;height:100%;background:linear-gradient(135deg,'+couleurSure(freshU.avatar_color)+',#0B5FE0);color:#FFF;font-size:32px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';

    var displayCover = S.coverPreview || freshU.cover_url;
    var coverContent = displayCover
      ? '<img src="' + safeUrl(displayCover) + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '';

    return '<div class="safe-top" style="position:fixed;inset:0;background:' + UI.page + ';z-index:10000;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      enTetePleinEcran('Modifier le profil', 'App.closeEditProfile()', boutonEnTete('Terminer', 'App.saveProfile(this)')) +
      '<div style="flex:1;overflow-y:auto;background:' + UI.page + ';">' +
        
        '<!-- Avatar Area -->' +
        '<div style="display:flex;justify-content:center;margin-top:24px;margin-bottom:20px;">' +
          '<div style="position:relative;">' +
            '<div style="width:90px;height:90px;border-radius:45px;border:4px solid ' + UI.page + ';overflow:hidden;background:var(--card);">' +
               avatarContent +
            '</div>' +
            '<label style="position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:16px;background:#0B5FE0;border:2px solid ' + UI.page + ';color:#FFF;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.2);">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
              '<input type="file" id="editAvatarInput" accept="image/*" style="display:none;" onchange="App.handleAvatarSelect(event)" />' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div style="padding:0 16px 30px;">' +
          '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:16px;">' +
            '<div style="display:flex;flex-direction:column;gap:16px;">' +
              (function(){
                var eData = S.editProfileData || {};
                var prenomVal = eData.prenom !== undefined ? eData.prenom : (freshU.prenom||'');
                var nomVal = eData.nom !== undefined ? eData.nom : (freshU.nom||'');
                var bioVal = eData.bio !== undefined ? eData.bio : (freshU.bio||'');
                var skillsVal = eData.skills !== undefined ? eData.skills : (freshU.skills||'');
                return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                  '<div>' +
                    '<label for="editPrenom" style="' + STYLE_LIBELLE + '">Prénom</label>' +
                    '<input type="text" id="editPrenom" class="kc-champ" value="' + safeHtml(prenomVal) + '" style="' + styleChamp() + '" />' +
                  '</div>' +
                  '<div>' +
                    '<label for="editNom" style="' + STYLE_LIBELLE + '">Nom</label>' +
                    '<input type="text" id="editNom" class="kc-champ" value="' + safeHtml(nomVal) + '" style="' + styleChamp() + '" />' +
                  '</div>' +
                '</div>' +
                '<div>' +
                  '<label for="editBio" style="' + STYLE_LIBELLE + '">Bio</label>' +
                  '<textarea id="editBio" class="kc-champ" placeholder="Quelques mots sur toi" style="' + styleChamp(true) + '">' + safeHtml(bioVal) + '</textarea>' +
                '</div>' +
                '<div>' +
                  '<label for="editSavoirFaire" style="' + STYLE_LIBELLE + '">Savoir-faire</label>' +
                  '<textarea id="editSavoirFaire" class="kc-champ" placeholder="Ex. : montage vidéo, cadrage, éclairage, son…" style="' + styleChamp(true) + '">' + safeHtml(skillsVal) + '</textarea>' +
                '</div>';
              })() +
            '</div>' +
          '</div>' +

          '<div style="background:var(--card);border-radius:20px;padding:16px;">' +
            '<label style="font-size:15px;font-weight:700;color:var(--ink);display:block;margin-bottom:12px;">Pôles (2 au plus)</label>' +
            // S9 : une fois le compte validé, seuls l'Admin et l'inscription en
            // attente choisissent les pôles (ils ouvrent canaux et préparation).
            (compteEnAttente(u) || isGrandResponsable(u)
              ? '<div id="editSectionBadgesContainer">' + App.renderSectionBadges(S.editSections, 'toggleEditSection') + '</div>'
              : '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + (getUserSections(u).map(function(id) {
                  return '<span style="display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:999px;background:var(--tile);color:var(--ink);font-size:13px;font-weight:700;">' + icoPole(id, 14) + safeHtml(secNom(id)) + '</span>';
                }).join('') || '<span style="font-size:13px;color:var(--muted);">Aucun pôle</span>') + '</div>' +
                '<div style="font-size:12px;color:var(--muted);line-height:1.45;margin-top:8px;">Pour changer de pôle, demande à l\'Admin : tes pôles ouvrent les canaux et le plan de préparation.</div>') +
          '</div>' +

          '<div style="background:var(--card);border-radius:20px;padding:16px;margin-top:16px;">' +
            '<label style="font-size:15px;font-weight:700;color:var(--ink);display:block;margin-bottom:12px;">Connexion</label>' +
            '<div style="display:flex;flex-direction:column;gap:16px;">' +
              '<div>' +
                '<span style="' + STYLE_LIBELLE + '">Numéro de téléphone</span>' +
                '<div style="' + styleChamp() + 'display:flex;align-items:center;background:var(--tile);border-color:transparent;color:var(--muted);">' + safeHtml(freshU.phone || 'Non renseigné') + '</div>' +
                '<span style="display:block;font-size:12px;color:var(--faint);margin-top:6px;">C\'est ton identifiant de connexion. Pour le changer, demande à un Admin.</span>' +
              '</div>' +
              '<div>' +
                '<label for="editNewPwd" style="' + STYLE_LIBELLE + '">Nouveau mot de passe</label>' +
                '<input type="password" id="editNewPwd" class="kc-champ" placeholder="Laisse vide pour ne pas changer" autocomplete="new-password" style="' + styleChamp() + '" />' +
                '<span style="display:block;font-size:12px;color:var(--faint);margin-top:6px;">8 caractères minimum.</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div style="background:var(--card);border-radius:20px;padding:16px;margin-top:16px;">' +
            '<label style="font-size:15px;font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Questions de sécurité</label>' +
            '<p style="font-size:12px;color:var(--faint);margin:0 0 14px;line-height:1.4;">Elles servent à récupérer ton mot de passe sans e-mail. Renseigne les deux pour les (re)définir ; laisse vide pour ne rien changer.</p>' +
            renderSecurityQAFields('edit', '', '') +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
  }
