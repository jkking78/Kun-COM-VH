// KUN COM VH — Partie 6b : Messagerie et canaux, Planning, Notation et suivi par pôle

  'use strict';
  // ============================================================
  // MESSAGERIE : messages privés (1-à-1) et canaux de pôle
  // Un canal est une conversation dont l'interlocuteur est « pole:<id> » :
  // le message est adressé au pôle, lisible par ses membres (migration 08).
  // ============================================================
  function estCanal(id) { return String(id || '').indexOf('pole:') === 0; }
  function poleDuCanal(id) { var pid = String(id).slice(5); return SECTIONS.find(function(s){ return s.id === pid; }) || null; }
  function dansConversation(m, autre) {
    if (!m || !S.user) return false;
    if (estCanal(autre)) return m.toId === autre;
    return (m.fromId === S.user.id && m.toId === autre) || (m.fromId === autre && m.toId === S.user.id);
  }
  // Canaux accessibles : ceux de ses pôles (tous pour l'Admin).
  function mesCanaux(u) {
    if (!u) return [];
    var ids = isGrandResponsable(u) ? SECTIONS.map(function(s){ return s.id; })
      : getUserSections(u).filter(function(id){ return SECTIONS.some(function(s){ return s.id === id; }); });
    return ids.map(function(id){ return 'pole:' + id; });
  }
  // Dernière lecture de chaque conversation. Gardée sur l'appareil ET dans le
  // compte (user_metadata.dm_lus, visible de soi seul) : sinon un nouvel
  // appareil, une réinstallation ou un changement d'adresse faisait revenir
  // en « non lus » tous les messages déjà lus.
  function dmLus() { return db('kc_dm_lus', {}) || {}; }
  var _dmLusCompte = null;     // dernière version connue côté compte
  var _dmLusEnvoi = null;
  function fusionnerLecturesCompte(distant) {
    if (!distant || typeof distant !== 'object') return;
    _dmLusCompte = Object.assign({}, distant);
    var lus = Object.assign({}, dmLus());
    var change = false;
    Object.keys(distant).forEach(function(k) {
      var t = Number(distant[k]) || 0;
      if (t > (lus[k] || 0)) { lus[k] = t; change = true; }
    });
    if (change) dbSet('kc_dm_lus', lus);
  }
  function envoyerLecturesCompte() {
    if (_dmLusEnvoi || !supabase || !supabase.auth || !S.user) return;
    _dmLusEnvoi = setTimeout(function() {
      _dmLusEnvoi = null;
      var lus = dmLus();
      supabase.auth.updateUser({ data: { dm_lus: lus } }).then(function(r) {
        if (r && !r.error) _dmLusCompte = Object.assign({}, lus);
      }, function(){});
    }, 4000);
  }
  // Au démarrage : relit le compte (la session en cache peut être ancienne).
  function recupererLecturesCompte() {
    if (!supabase || !supabase.auth || !S.user) return Promise.resolve();
    return supabase.auth.getUser().then(function(r) {
      var meta = r && r.data && r.data.user && r.data.user.user_metadata;
      if (meta) fusionnerLecturesCompte(meta.dm_lus || {});
    }, function(){});
  }
  function marquerConversationLue(autre) {
    var lus = Object.assign({}, dmLus());
    var avaitNonLus = nonLusConversation(autre) > 0;
    lus[autre] = Date.now();
    dbSet('kc_dm_lus', lus);
    // Pas d'envoi à chaque relève (toutes les 4 s) : seulement quand des
    // messages viennent d'être lus ou que le compte ne connaît pas encore la conversation.
    if (avaitNonLus || !_dmLusCompte || !_dmLusCompte[autre]) envoyerLecturesCompte();
  }
  function nonLusConversation(autre, tous) {
    var depuis = dmLus()[autre] || 0;
    return (tous || db(SK.DMS, [])).filter(function(m) {
      return dansConversation(m, autre) && m.fromId !== S.user.id && (m.timestamp || 0) > depuis;
    }).length;
  }
  // Conversations : ses canaux d'abord, puis les échanges privés, du plus
  // récent au plus ancien.
  function conversations() {
    if (!S.user) return [];
    var tous = db(SK.DMS, []);
    var parAutre = {};
    tous.forEach(function(m) {
      if (!m) return;
      var autre = estCanal(m.toId) ? m.toId : (m.fromId === S.user.id ? m.toId : (m.toId === S.user.id ? m.fromId : null));
      if (!autre) return;
      if (!parAutre[autre] || (m.timestamp || 0) > (parAutre[autre].timestamp || 0)) parAutre[autre] = m;
    });
    var canaux = mesCanaux(S.user).map(function(c){ return { autre: c, dernier: parAutre[c] || null, nonLus: nonLusConversation(c, tous) }; });
    var prives = Object.keys(parAutre).filter(function(a){ return !estCanal(a); })
      .map(function(a){ return { autre: a, dernier: parAutre[a], nonLus: nonLusConversation(a, tous) }; })
      .sort(function(a, b){ return (b.dernier.timestamp || 0) - (a.dernier.timestamp || 0); });
    return canaux.concat(prives);
  }
  function totalNonLus() {
    if (!S.user) return 0;
    return conversations().reduce(function(n, c){ return n + c.nonLus; }, 0);
  }

  // Bouton de l'en-tête : la bulle de messages, avec le nombre de non-lus.
  function renderBoiteBouton() {
    if (!S.user || S.auth !== 'app') return '';
    var n = totalNonLus();
    return '<button id="boiteMessages" onclick="App.ouvrirBoite()" aria-label="Messages' + (n ? ' (' + n + ' non lus)' : '') + '" ' +
      'style="position:relative;width:44px;height:44px;border-radius:' + UI.pill + ';border:none;cursor:pointer;padding:0;flex-shrink:0;background:none;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + (n ? UI.accent : UI.muted) + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      (n ? '<span class="kc-pastille" style="position:absolute;top:4px;right:2px;min-width:18px;height:18px;padding:0 5px;border-radius:' + UI.pill + ';background:' + UI.bad + ';color:#FFF;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid ' + UI.card + ';">' + (n > 99 ? '99+' : n) + '</span>' : '') +
    '</button>';
  }

  function avatarConversation(autre, taille) {
    var t = taille || 44;
    if (estCanal(autre)) {
      var p = poleDuCanal(autre) || { id: '', color: '#0B5FE0' };
      return '<div style="width:' + t + 'px;height:' + t + 'px;border-radius:' + (t / 2) + 'px;background:' + p.color + '1F;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (p.id ? icoPole(p.id, Math.round(t * 0.46)) : ico('message', Math.round(t * 0.46), p.color)) + '</div>';
    }
    var o = db(SK.USERS, []).find(function(u){ return u.id === autre; }) || {};
    return o.avatar_url
      ? '<img src="' + safeUrl(o.avatar_url) + '" style="width:' + t + 'px;height:' + t + 'px;border-radius:' + (t / 2) + 'px;object-fit:cover;flex-shrink:0;" />'
      : '<div style="width:' + t + 'px;height:' + t + 'px;border-radius:' + (t / 2) + 'px;background:' + couleurSure(o.avatar_color) + ';color:#FFF;font-weight:800;font-size:' + Math.round(t * 0.38) + 'px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (o.prenom || 'M').charAt(0).toUpperCase() + '</div>';
  }
  function nomConversation(autre) {
    if (estCanal(autre)) { var p = poleDuCanal(autre); return 'Canal ' + (p ? p.nom : 'du pôle'); }
    var o = db(SK.USERS, []).find(function(u){ return u.id === autre; }) || {};
    return ((o.prenom || 'Membre') + ' ' + (o.nom || '')).trim();
  }

  function renderBoiteModal() {
    var liste = conversations();
    var ligne = function(c) {
      var d = c.dernier;
      var apercu = d ? ((d.fromId === S.user.id ? 'Toi : ' : (estCanal(c.autre) ? nomCourt(d.fromId) + ' : ' : '')) + String(d.text || '')) : 'Discussion du pôle pour la logistique du jour J';
      return '<button type="button" onclick="App.openDirectMessage(\'' + jsArg(c.autre) + '\')" style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 16px;background:none;border:none;border-bottom:1px solid ' + UI.line + ';text-align:left;cursor:pointer;">' +
        avatarConversation(c.autre) +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;">' +
            '<strong style="font-size:15px;color:' + UI.ink + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(nomConversation(c.autre)) + '</strong>' +
            (d ? '<span style="font-size:12px;color:' + UI.faint + ';flex-shrink:0;">' + timeAgo(d.timestamp) + '</span>' : '') +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:2px;">' +
            '<span style="font-size:13px;color:' + (c.nonLus ? UI.ink : UI.faint) + ';font-weight:' + (c.nonLus ? '600' : '400') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(apercu.slice(0, 80)) + '</span>' +
            (c.nonLus ? '<span style="min-width:20px;height:20px;padding:0 6px;border-radius:12px;background:' + UI.accent + ';color:#FFF;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + c.nonLus + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</button>';
    };
    // Deux groupes (synthèse du design) : les canaux de ses pôles, puis les
    // conversations privées, chacun dans sa carte.
    var groupe = function(titre, items) {
      if (!items.length) return '';
      return '<div style="margin:16px 20px 8px;font-size:12px;font-weight:700;color:' + UI.muted + ';">' + titre + '</div>' +
        '<div style="margin:0 16px;background:' + UI.card + ';border-radius:20px;overflow:hidden;">' + items.map(ligne).join('') + '</div>';
    };
    // Canaux : ceux qui ont des messages et ceux de ses pôles d'abord ; les
    // canaux vides des autres pôles (l'Admin les voit tous) sont repliés en bas.
    var mesPoles = getUserSections(S.user);
    var canaux = liste.filter(function(c){ return estCanal(c.autre); });
    var utiles = canaux.filter(function(c){ return c.dernier || mesPoles.indexOf(String(c.autre).slice(5)) !== -1; });
    var replies = canaux.filter(function(c){ return utiles.indexOf(c) === -1; });
    var lignes = groupe('Canaux de pôle', utiles) +
      groupe('Conversations', liste.filter(function(c){ return !estCanal(c.autre); })) +
      (replies.length
        ? '<button type="button" onclick="S.boiteCanauxOuverts=!S.boiteCanauxOuverts;render()" aria-expanded="' + (S.boiteCanauxOuverts ? 'true' : 'false') + '" style="display:flex;align-items:center;justify-content:space-between;width:calc(100% - 32px);margin:16px 16px 0;min-height:48px;padding:0 16px;background:' + UI.card + ';border:none;border-radius:' + (S.boiteCanauxOuverts ? '20px 20px 0 0' : '20px') + ';font:inherit;font-size:15px;font-weight:600;color:' + UI.ink + ';cursor:pointer;">' +
            '<span>Autres canaux <span style="color:' + UI.faint + ';font-weight:500;">· ' + replies.length + '</span></span>' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transform:rotate(' + (S.boiteCanauxOuverts ? '180' : '0') + 'deg);"><path d="M6 9l6 6 6-6"/></svg>' +
          '</button>' +
          (S.boiteCanauxOuverts ? '<div style="margin:0 16px;background:' + UI.card + ';border-radius:0 0 20px 20px;overflow:hidden;border-top:1px solid ' + UI.line + ';">' + replies.map(ligne).join('') + '</div>' : '')
        : '');
    return '<div class="safe-top" style="position:fixed;inset:0;z-index:9500;background:' + UI.page + ';display:flex;flex-direction:column;animation:fadeIn 0.2s ease-out;">' +
      enTetePleinEcran('Messages', 'App.fermerBoite()', boutonEnTete('Nouveau', 'App.fermerBoite();App.openMembersList()')) +
      '<div id="boiteListe" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;background:' + UI.page + ';padding-bottom:24px;">' +
        (lignes || '<div style="padding:50px 24px;text-align:center;color:' + UI.faint + ';font-size:15px;">Aucune conversation. Ouvre le profil d\'un membre et touche « Message ».</div>') +
      '</div>' +
    '</div>';
  }
  function nomCourt(id) {
    var o = db(SK.USERS, []).find(function(u){ return u.id === id; });
    return o ? (o.prenom || 'Membre') : 'Membre';
  }

  function renderDmBubble(m) {
    var mine = S.user && m.fromId === S.user.id;
    // Dans un canal, le prénom de l'auteur au-dessus de ses messages.
    var auteur = (!mine && estCanal(m.toId)) ? '<div style="font-size:12px;font-weight:700;color:' + UI.lien + ';margin:0 0 2px 4px;">' + safeHtml(nomCourt(m.fromId)) + '</div>' : '';
    return '<div style="display:flex;flex-direction:column;align-items:' + (mine ? 'flex-end' : 'flex-start') + ';margin-bottom:8px;">' + auteur +
      '<div style="max-width:72%;background:' + (mine ? '#0B5FE0' : 'var(--tile)') + ';color:' + (mine ? '#FFF' : 'var(--ink)') + ';padding:9px 13px;border-radius:16px;' + (mine ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;') + 'font-size:15px;line-height:1.4;word-break:break-word;">' +
        safeHtml(m.text) +
        '<div style="font-family:' + UI.fontMono + ';font-size:11px;margin-top:3px;opacity:0.7;text-align:right;">' + timeAgo(m.timestamp) + '</div>' +
      '</div>' +
      (m.nonEnvoye ? '<div role="status" style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--bad-ink);margin-top:3px;">' + ico('alert', 13, 'currentColor') + 'Non envoyé</div>' : '') +
    '</div>';
  }

  function renderDirectMessageModal() {
    if (!S.dmWithUserId) return '';
    var autre = S.dmWithUserId;
    var canal = estCanal(autre);
    var membresCanal = canal ? db(SK.USERS, []).filter(function(u){ return getUserSections(u).indexOf(autre.slice(5)) !== -1 && !compteEnAttente(u); }).length : 0;

    var messagesHtml = S.dmLoading
      ? '<div style="padding:40px 20px;text-align:center;color:var(--faint);font-size:13px;">Chargement…</div>'
      : (S.dmMessages.length > 0
          ? S.dmMessages.map(function(m){ return renderDmBubble(m); }).join('')
          : '<div style="display:flex;flex-direction:column;align-items:center;padding:44px 20px;text-align:center;"><div style="margin-bottom:8px;display:flex;justify-content:center;">' + ico('message', 36, UI.faint, 1.6) + '</div><strong style="font-size:15px;color:var(--ink);">Aucun message</strong><p style="font-size:13px;color:var(--faint);margin:4px 0 0;">' +
              (canal ? 'Lance la discussion du pôle : matériel, horaires, consignes du jour J.' : 'Envoie le premier message à ' + safeHtml(nomCourt(autre)) + '.') + '</p></div>');

    return '<div onclick="App.closeDirectMessage()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;height:82vh;display:flex;flex-direction:column;animation:slideUp 0.3s;">' +
        '<div onclick="App.closeDirectMessage()" style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;">' +
          '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;padding:6px 16px 12px;border-bottom:0.5px solid var(--tile);">' +
          '<div onclick="App.closeDirectMessage()" aria-label="Retour" style="cursor:pointer;width:44px;height:44px;display:flex;align-items:center;justify-content:center;margin-left:-8px;flex-shrink:0;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
          '</div>' +
          avatarConversation(autre, 34) +
          '<div style="min-width:0;">' +
            '<strong style="display:block;font-family:' + UI.fontDisplay + ';font-size:15px;font-weight:700;letter-spacing:-0.2px;color:var(--ink);">' + safeHtml(nomConversation(autre)) + '</strong>' +
            (canal ? '<span style="font-size:12px;color:var(--faint);">' + membresCanal + ' membre' + (membresCanal > 1 ? 's' : '') + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div id="dmMessagesList" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px;">' +
          messagesHtml +
        '</div>' +
        '<form onsubmit="event.preventDefault(); App.sendDirectMessage(event);" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:0.5px solid var(--tile);">' +
          '<div style="flex:1;display:flex;align-items:center;background:var(--tile);border-radius:20px;height:40px;padding:0 6px 0 14px;">' +
            '<input id="dmInput" type="text" placeholder="' + (canal ? 'Écrire au pôle…' : 'Écrire un message…') + '" style="flex:1;border:none;background:transparent;font-size:15px;color:var(--ink);outline:none;">' +
            '<button type="submit" style="background:none;border:none;padding:0 6px;cursor:pointer;display:flex;align-items:center;">' + SVG.send + '</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // PLANNING TAB
  // ============================================================
  // Sélecteur à onglets partagé (Planning, Notation, période du suivi) :
  // des pastilles dans un rail gris, un seul style pour les trois écrans.
  function renderSegmented(items) {
    return '<div style="display:flex;gap:3px;background:' + UI.tile + ';border-radius:' + UI.r1 + ';padding:3px;">' +
      items.map(function(it) {
        return '<button onclick="' + it.action + '" style="flex:1;padding:8px 6px;border-radius:8px;font-size:13px;font-weight:' + (it.active ? '600' : '400') + ';border:none;cursor:pointer;white-space:nowrap;background:' +
          (it.active ? UI.card : 'transparent') + ';color:' + (it.active ? UI.ink : UI.muted) + ';box-shadow:' + (it.active ? UI.sh : 'none') + ';">' + it.label + '</button>';
      }).join('') +
    '</div>';
  }

  function renderPlanning() {
    if (!S.selectedDate) S.selectedDate = isoLocal();
    if (!S.planningMode) S.planningMode = 'upcoming';
    
    var canCreate = S.user && (S.user.role === 'RESP_SECTION' || S.user.role === 'GRAND_RESPONSABLE');
    var rightBtn = canCreate ? '<button onclick="App.openCreateEvent()" aria-label="Nouvel événement" style="background:' + UI.accent + ';color:#FFF;border:none;border-radius:22px;width:44px;height:44px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg></button>' : '';
    // En-tête à grand titre posé sur le fond de page (synthèse du design).
    var mesServices = (db(SK.POSTS, [])).filter(function(p) {
      return p.type === 'EVENT' && !isEventPast(p) && S.user && (p.assignments || []).some(function(a){ return a && a.userId === S.user.id; });
    }).length;
    var mesIndispos = ((db(SK.USERS, []).find(function(x){ return S.user && x.id === S.user.id; }) || S.user || {}).indisponibilites || [])
      .filter(function(x){ return x && x.date >= isoLocal(); });
    // Ligne 1 : grand titre à gauche, cloche et « + » à droite.
    // Ligne 2 : le résumé du mois et « Mes indisponibilités », qui passent
    // l'un sous l'autre si l'écran est étroit au lieu d'écraser le titre.
    var header = '<div style="background:' + UI.page + ';padding:20px 16px 8px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
        '<h1 style="font-size:28px;font-weight:800;letter-spacing:-0.5px;color:' + UI.ink + ';margin:0;line-height:1.1;">Planning</h1>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' + renderCloche() + rightBtn + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;">' +
        '<p style="font-size:13px;color:' + UI.muted + ';margin:0;min-width:0;">' + (mesServices ? mesServices + ' service' + (mesServices > 1 ? 's' : '') + ' à venir pour toi' : 'Aucun service à venir pour toi') + '</p>' +
        '<button type="button" onclick="App.ouvrirIndispos()" aria-label="Mes indisponibilités' + (mesIndispos.length ? ' : ' + mesIndispos.length : '') + '" style="height:36px;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;background:' + UI.card + ';border:none;border-radius:999px;padding:0 12px;font-size:13px;font-weight:700;color:' + UI.ink + ';cursor:pointer;white-space:nowrap;">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="14" x2="15" y2="18"/><line x1="15" y1="14" x2="9" y2="18"/></svg>' +
          'Mes indispos' + (mesIndispos.length ? ' · ' + mesIndispos.length : '') +
        '</button>' +
      '</div>' +
    '</div>';

    var filtreMiens = S.planningFiltre === 'miens';
    var modeSwitch = '<div style="background:' + UI.page + ';padding:4px 16px 8px;display:flex;gap:8px;">' +
      '<div style="flex:1;min-width:0;">' + renderSegmented([
        { label:'À venir',    action:"S.planningMode='upcoming';render()", active: S.planningMode==='upcoming' },
        { label:'Historique', action:"S.planningMode='history';render()",  active: S.planningMode==='history'  }
      ]) + '</div>' +
      (S.planningMode === 'history' ? '' : '<div style="flex:1;min-width:0;">' + renderSegmented([
        { label:'Mes services', action:"App.filtrerPlanning('miens')", active: filtreMiens },
        { label:'Tous',         action:"App.filtrerPlanning('tous')",  active: !filtreMiens }
      ]) + '</div>') +
    '</div>';

    var allPosts = db(SK.POSTS, []);
    var todayIso = isoLocal();

    if (S.planningMode === 'history') {
      // Un événement bascule ici dès qu'il est terminé (heure de fin dépassée),
      // pas seulement le lendemain.
      var pastEvents = allPosts.filter(function(p) { return isEventPast(p); });
      pastEvents.sort(function(a,b) { return (eventEndTimestamp(b)||0) - (eventEndTimestamp(a)||0); });
      var historyHtml = '<div style="padding:14px 12px 90px;min-height:50vh;background:' + UI.page + ';">';
      if (pastEvents.length === 0) {
         historyHtml += '<div style="text-align:center;padding:50px 24px;color:' + UI.faint + ';">' + ico('history', 40, UI.line2, 1.4) + '<div style="font-size:15px;font-weight:600;color:' + UI.ink + ';margin-top:10px;">Aucun historique</div><div style="font-size:13px;margin-top:4px;">Les événements passés s\'afficheront ici.</div></div>';
      } else {
         var canEvaluate = S.user && S.user.role === 'GRAND_RESPONSABLE';
         pastEvents.forEach(function(ev) {
            historyHtml += '<div style="margin-bottom:12px;">' +
              '<div onclick="App.goToEvent(\''+jsArg(ev.id)+'\')" style="cursor:pointer;">' + renderEventCardInner(ev) + '</div>' +
              (canEvaluate
                ? '<button onclick="App.selectEvalEvent(\''+jsArg(ev.id)+'\');S.tab=\'debrief\';render()" style="width:100%;margin-top:8px;background:' + UI.card + ';color:' + UI.accentInk + ';border:0.5px solid ' + UI.line2 + ';border-radius:' + UI.r1 + ';padding:11px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;">' + ico('pencil', 15, UI.accentInk) + 'Évaluer / débriefer</button>'
                : '') +
            '</div>';
         });
      }
      historyHtml += '</div>';
      return header + modeSwitch + historyHtml;
    }

    // Jours à l'heure d'Abidjan (= UTC), comme isoLocal et les événements :
    // lire un jour avec le fuseau du téléphone décalait la frise d'un jour
    // sur un téléphone réglé ailleurs (Europe, voyage).
    var jourUTC = function(iso) { return new Date(iso + 'T00:00:00Z'); };
    var todayIso = isoLocal();
    var dateMap = {};
    for (var i = 0; i < 7; i++) {
      var isoJ = isoLocal(new Date(Date.now() + i * 864e5));
      dateMap[isoJ] = jourUTC(isoJ);
    }
    
    // Add any future dates that have events
    allPosts.forEach(function(p) {
      if (p.type === 'EVENT' && p.eventDate && p.eventDate >= todayIso) {
         if (!dateMap[p.eventDate]) dateMap[p.eventDate] = jourUTC(p.eventDate);
      }
    });
    var dates = Object.keys(dateMap).sort().map(function(k){ return dateMap[k]; });
    var nowTsSlider = Date.now();

    // Frise des 7 prochains jours (synthèse du design) : toucher un jour fait
    // défiler jusqu'à ses services ; les jours qui en ont sont teintés.
    var monId = S.user ? S.user.id : '';
    var frise = '<div role="list" aria-label="Sept prochains jours" style="display:flex;gap:6px;padding:4px 16px 10px;background:' + UI.page + ';">' +
      dates.slice(0, 7).map(function(d) {
        var iso = isoLocal(d);
        var estAuj = iso === todayIso;
        var aMoi = allPosts.some(function(p){ return p.type === 'EVENT' && p.eventDate === iso && !isEventPast(p, nowTsSlider) && (p.assignments || []).some(function(a){ return a && a.userId === monId; }); });
        var aDesEv = allPosts.some(function(p){ return p.type === 'EVENT' && p.eventDate === iso && !isEventPast(p, nowTsSlider); });
        var fond = estAuj ? 'var(--ink)' : (aMoi ? 'var(--accent-soft)' : UI.card);
        var encre = estAuj ? 'var(--page)' : (aMoi ? UI.accentInk : UI.ink);
        return '<button type="button" role="listitem" onclick="App.allerAuJour(\'' + jsArg(iso) + '\')" aria-label="' + safeHtml(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })) + '" style="flex:1;min-width:0;padding:8px 0;border:none;border-radius:16px;background:' + fond + ';color:' + encre + ';cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;">' +
          '<span style="font-size:11px;font-weight:600;opacity:0.85;">' + d.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '') + '</span>' +
          '<span style="font-size:17px;font-weight:800;">' + d.getUTCDate() + '</span>' +
          '<span style="width:4px;height:4px;border-radius:2px;background:' + (aDesEv ? (estAuj ? 'var(--page)' : UI.accent) : 'transparent') + ';"></span>' +
        '</button>';
      }).join('') +
    '</div>';

    // Les événements encore à venir (ou en cours) passent devant, du plus proche
    // au plus lointain ; les événements déjà terminés viennent ensuite. Le
    // carrousel s'ouvre donc toujours sur ce qui concerne l'utilisateur maintenant.
    var nowTs = Date.now();
    var dayEvents = allPosts.filter(function(p) {
      if (p.type !== 'EVENT' || !p.eventDate) return false;
      // « À venir » ne montre que ce qui reste à venir ou est en cours. Un
      // événement déjà terminé n'a rien à y faire — il n'appartient qu'à
      // l'Historique. Sans ce filtre, la vue affichait des fiches « Terminé »
      // dans l'onglet censé lister ce qui arrive.
      if (filtreMiens && !(p.assignments || []).some(function(a){ return a && a.userId === monId; })) return false;
      return !isEventPast(p, nowTs);
    }).sort(function(a,b) {
      // Groupé par JOUR (maquette) : on trie par date puis par heure de début.
      var d = String(a.eventDate).localeCompare(String(b.eventDate));
      if (d !== 0) return d;
      return String(a.eventStart || '').localeCompare(String(b.eventStart || ''));
    });

    var timeline = '<div style="padding:8px 16px 100px;min-height:50vh;background:' + UI.page + ';">';
    
    if (dayEvents.length === 0) {
      timeline += '<div style="text-align:center;padding:40px 20px;color:var(--faint);">' +
        '<div style="margin-bottom:12px;">' + ico('calendar', 40, 'var(--line2)', 1.6) + '</div>' +
        '<div style="font-size:17px;font-weight:700;color:var(--ink);">' + (filtreMiens ? 'Aucun service pour toi' : 'Aucun événement à venir') + '</div>' +
        '<div style="font-size:15px;margin-top:4px;">' + (filtreMiens ? 'Touche « Tous » pour voir tout le planning.' : 'Les prochains services apparaîtront ici.') + '</div>' +
      '</div>';
    } else {
      // Chaque événement produit un bloc ; on décide ensuite de l'affichage :
      // liste verticale habituelle s'il n'y en a qu'un, carrousel horizontal dès
      // que la journée en compte plusieurs (ordonnés par heure de début).
      var planBlocks = [];
      var dernierJour = null;   // suit le jour courant pour insérer les en-têtes

      dayEvents.forEach(function(ev) {
        // Statut calculé sur des horodatages, pas sur une comparaison de chaînes :
        // « 21:27 > 01:30 » est vrai en texte, ce qui marquait « Terminé » une
        // veillée de 22:00 à 01:30 avant même qu'elle ne commence.
        var status = 'upcoming';
        var statusHtml = '';
        var evStartTs = eventStartTimestamp(ev);
        var evEndTs = eventEndTimestamp(ev);
        if (evStartTs && evEndTs) {
          if (nowTs > evEndTs) status = 'closed';
          else if (nowTs >= evStartTs) status = 'active';
        } else if (ev.eventDate < todayIso) {
          status = 'closed';
        }

        if (status === 'active') {
          statusHtml = '<div style="display:inline-flex;align-items:center;gap:4px;background:var(--ok-soft);color:#0E9F6E;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;"><div style="width:6px;height:6px;border-radius:3px;background:#0E9F6E;animation:blink 1.5s infinite;"></div>En cours</div>';
        } else if (status === 'closed') {
          statusHtml = '<div style="display:inline-block;background:var(--tile);color:var(--faint);padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;">Terminé</div>';
        }

        // Pôles concernés, chacun dans sa couleur.
        var secTags = (ev.eventSections || []).map(function(sid){
          var c = secColor(sid) || UI.accent;
          // En sombre, le texte est éclairci (--pole-clair) pour rester lisible.
          return '<span style="font-size:11px;font-weight:700;color:' + c + ';color:color-mix(in srgb, ' + c + ', #FFF var(--pole-clair));background:' + c + '1F;border-radius:8px;padding:3px 8px;white-space:nowrap;">' + safeHtml(secNom(sid)) + '</span>';
        }).join('');

        // En-tête de JOUR, ancre de la frise.
        if (ev.eventDate !== dernierJour) {
          dernierJour = ev.eventDate;
          var dObj = new Date(ev.eventDate + 'T00:00:00');
          var estAujourdhui = ev.eventDate === todayIso;
          var libJour = estAujourdhui ? 'Aujourd\'hui' : dObj.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
          planBlocks.push('<div id="jour-' + safeHtml(ev.eventDate) + '" style="scroll-margin-top:12px;margin:' + (planBlocks.length ? '20px' : '4px') + ' 2px 8px;font-size:12px;font-weight:700;color:' + (estAujourdhui ? UI.accent : UI.muted) + ';">' +
            safeHtml(libJour.charAt(0).toUpperCase() + libJour.slice(1)) +
          '</div>');
        }

        // Ma situation sur ce service : pastille d'état à droite du titre.
        var monAff = S.user ? (ev.assignments || []).find(function(a){ return a && a.userId === S.user.id; }) : null;
        var maRep = monAff ? reponseConvocation(ev, S.user.id) : null;
        var etat = status === 'active' ? ['En cours', 'var(--ok-soft)', 'var(--ok-ink)']
          : !monAff ? null
          : !maRep ? ['À confirmer', 'var(--warn-soft)', 'var(--warn-ink)']
          : maRep.statut === 'confirme' ? ['Confirmé', 'var(--ok-soft)', 'var(--ok-ink)']
          : ['Indisponible', 'var(--bad-soft)', 'var(--bad-ink)'];
        var couleurEv = secColor((ev.eventSections || [])[0]) || UI.accent;
        var duree = (evStartTs && evEndTs) ? Math.max(0, Math.round((evEndTs - evStartTs) / 3600000 * 10) / 10) : null;

        planBlocks.push('<div id="planev-' + safeHtml(ev.id) + '" style="margin-bottom:10px;max-width:100%;scroll-margin-top:12px;">' +
          '<div style="min-width:0;">' +
            '<div style="background:var(--card);border-radius:20px;padding:16px;box-shadow:' + UI.sh2 + ';overflow:hidden;">' +
              '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px;">' +
                '<div style="width:58px;flex-shrink:0;text-align:center;background:' + couleurEv + '1F;color:' + couleurEv + ';border-radius:16px;padding:8px 0;">' +
                  '<div style="font-size:13px;font-weight:800;">' + safeHtml(ev.eventStart || '--:--') + '</div>' +
                  (duree ? '<div style="font-size:11px;font-weight:600;">' + String(duree).replace('.', ',') + ' h</div>' : '') +
                '</div>' +
                '<div style="flex:1;min-width:0;">' +
                  '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
                    '<h3 style="font-size:17px;font-weight:800;color:var(--ink);margin:0;line-height:1.25;overflow-wrap:anywhere;">' + safeHtml(ev.eventTitle) + '</h3>' +
                    (etat ? '<span style="flex-shrink:0;font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;background:' + etat[1] + ';color:' + etat[2] + ';white-space:nowrap;">' + etat[0] + '</span>' : (status === 'closed' ? '<span style="flex-shrink:0;font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;background:var(--tile);color:var(--muted);">Terminé</span>' : '')) +
                  '</div>' +
                  '<div style="font-size:13px;color:var(--muted);margin-top:2px;overflow-wrap:anywhere;">' + safeHtml(ev.eventLocation || 'Lieu à préciser') + (monAff && monAff.task ? ' · ' + safeHtml(monAff.task) : '') + (ev.eventEnd ? ' · jusqu\'à ' + safeHtml(ev.eventEnd) : '') + '</div>' +
                  (secTags ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;">' + secTags + '</div>' : '') +
                '</div>' +
              '</div>' +
              (ev.caption ? '<p style="font-size:13px;color:var(--ink2);margin:0 0 16px;line-height:1.4;overflow-wrap:anywhere;">' + safeHtml(ev.caption) + '</p>' : '') +
              renderEquipeService(ev) +
              renderActionsEvenement(ev) +
              renderReponseConvocation(ev) +
              renderEchanges(ev) +
              renderEventCheckInAction(ev) +
              renderSuiviConvocations(ev) +
              (function(){
                // Un convoqué répond à sa convocation ci-dessus : le bouton de
                // participation libre ne s'adresse qu'aux autres membres.
                if (S.user && (ev.assignments || []).some(function(a){ return a && a.userId === S.user.id; })) return '';
                var isPart = S.user && Array.isArray(ev.likedBy) && ev.likedBy.indexOf(S.user.id) !== -1;
                var count = Array.isArray(ev.likedBy) ? ev.likedBy.length : 0;
                if (status === 'closed') {
                  return '<button disabled style="width:100%;background:var(--tile);color:var(--faint);border:none;border-radius:999px;padding:11px;font-size:13px;font-weight:700;">Terminé (' + count + ' participants)</button>';
                }
                return '<button onclick="App.toggleEventParticipation(\'' + jsArg(ev.id) + '\')" style="width:100%;background:' + (isPart ? '#0E9F6E' : '#0B5FE0') + ';color:#FFF;border:none;border-radius:999px;padding:11px;font-size:13px;font-weight:800;cursor:pointer;box-shadow:' + (isPart ? '0 4px 12px rgba(52,199,89,0.3)' : '0 4px 12px rgba(11,95,224,0.3)') + ';">' + (isPart ? '✓ Participation confirmée (' + count + ')' : '+ Je participe (' + count + ')') + '</button>';
              })() +
            '</div>' +
          '</div>' +
        '</div>');
      });

      // Liste verticale simple : les en-têtes de jour sont dans planBlocks,
      // un carrousel horizontal les couperait.
      timeline += planBlocks.join('');
    }

    timeline += '</div>';

    return header + modeSwitch + frise + timeline;
  }
  // ============================================================
  // DEBRIEF TAB
  // ============================================================
  // Onglet Notation : deux vues, la saisie d'un bilan et le suivi dans le temps.
  function renderDebrief(u) {
    var canEvaluate = isGrandResponsable(u);
    // Un membre ne peut pas noter, mais doit pouvoir consulter l'historique des
    // bilans déjà publiés (ils finissent par disparaître du fil) : on le fige
    // sur le Suivi, en lecture seule, sans jamais lui proposer l'onglet Noter.
    var view = canEvaluate ? (S.debriefView === 'suivi' ? 'suivi' : 'noter') : 'suivi';

    var tabs = canEvaluate
      ? '<div style="background:' + UI.page + ';padding:0 16px 8px;">' +
          renderSegmented([
            { label:'Noter', action:"App.setDebriefView('noter')", active: view !== 'suivi' },
            { label:'Suivi', action:"App.setDebriefView('suivi')", active: view === 'suivi' }
          ]) +
        '</div>'
      : '<div style="padding:0 18px 8px;font-size:13px;color:' + UI.muted + ';">Les bilans sont publiés par l\'Admin après chaque service.</div>';

    if (view === 'suivi') {
      return renderScreenHeader('Bilans', 'Évaluation des pôles', '') + tabs + renderMonPole(u) + renderScoreboard(canEvaluate);
    }
    return renderScreenHeader('Bilans', 'Évaluation des pôles', '') + tabs + renderDebriefForm(u);
  }

  // ============================================================
  // SUIVI : tableau de bord par pôle
  // ============================================================
  function renderScoreboard(canEvaluate) {
    var now = new Date();
    var cycleStr = now.getDate() <= 15 ? '1er – 15 ' + now.toLocaleDateString('fr-FR',{month:'long'})
                                       : '16 – fin ' + now.toLocaleDateString('fr-FR',{month:'long'});
    var posts = db(SK.POSTS, []);

    var periodSwitch = '<div style="padding:14px 16px 6px;">' +
      renderSegmented([
        { label:'Cycle ' + cycleStr,  action:'App.setScoreboardPeriod(false)', active: !S.scoreboardAll },
        { label:'Depuis le début',    action:'App.setScoreboardPeriod(true)',  active: !!S.scoreboardAll }
      ]) +
    '</div>';

    var emptyMsg = '<div style="font-size:13px;line-height:1.5;">' + (canEvaluate ? 'Publie un bilan depuis l\'onglet « Noter » : les moyennes et l\'évolution de chaque pôle apparaîtront ici.' : 'Dès qu\'un Admin publiera un bilan, les moyennes et l\'évolution de chaque pôle apparaîtront ici.') + '</div>';
    var emptyBlock = function(title) {
      return '<div style="padding:50px 24px;text-align:center;color:var(--faint);">' +
          '<div style="margin-bottom:12px;display:flex;justify-content:center;">' + ico('chart', 40, UI.faint, 1.6) + '</div>' +
          '<div style="font-size:17px;font-weight:800;color:var(--ink);margin-bottom:6px;">' + title + '</div>' +
          emptyMsg +
        '</div>';
    };

    if (!S.scoreboardAll) {
      // Vue "Cycle en cours" : un seul classement, comme avant.
      var sinceTs = currentCycleStartTs();
      var boards = SECTIONS.map(function(sec) {
        return { sec: sec, board: sectionScoreboard(sec.id, sinceTs, posts) };
      }).sort(function(a,b) {
        if (a.board.count !== b.board.count && (!a.board.count || !b.board.count)) return b.board.count - a.board.count;
        return b.board.average - a.board.average;   // les mieux notés d'abord
      });
      var anyData = boards.some(function(b){ return b.board.count > 0; });
      if (!anyData) return periodSwitch + emptyBlock('Aucun bilan sur cette période');
      return periodSwitch +
        '<div style="padding:10px 16px 90px;">' +
          boards.map(function(b){ return renderScoreboardCard(b.sec, b.board, b.sec.id); }).join('') +
        '</div>';
    }

    // Vue "Depuis le début" : regroupée cycle par cycle, du plus récent au plus
    // ancien. Chaque cycle qui voit passer un nouveau bilan apparaît de lui-même
    // ici, sans rien à configurer — c'est purement dérivé des publications réelles.
    var cycles = historicalCycles(posts);
    var groups = cycles.map(function(cy) {
      var boards = SECTIONS.map(function(sec) {
        return { sec: sec, board: sectionScoreboard(sec.id, cy.startTs, posts, cy.endTs) };
      }).filter(function(b){ return b.board.count > 0; })
        .sort(function(a,b){ return b.board.average - a.board.average; });
      return { cycle: cy, boards: boards };
    }).filter(function(g){ return g.boards.length > 0; });

    if (groups.length === 0) return periodSwitch + emptyBlock('Aucun bilan pour le moment');

    return periodSwitch +
      '<div style="padding:10px 16px 90px;">' +
        groups.map(function(g) {
          var groupKey = 'c' + g.cycle.startTs;
          return '<div style="margin-bottom:20px;">' +
            '<div style="font-size:11px;font-weight:800;color:var(--lien);text-transform:uppercase;letter-spacing:0.8px;padding:4px 2px 10px;">' + safeHtml(cycleLabel(g.cycle)) + '</div>' +
            g.boards.map(function(b){ return renderScoreboardCard(b.sec, b.board, groupKey + '::' + b.sec.id); }).join('') +
          '</div>';
        }).join('') +
      '</div>';
  }

  // « MON PÔLE » : en tête du Suivi, la note de son ou ses pôles et le dernier
  // mot de l'Admin, sans avoir à chercher sa carte dans le classement.
  function renderMonPole(u) {
    var mesPoles = getUserSections(u || {}).filter(function(s){ return SECTIONS.some(function(x){ return x.id === s; }); });
    if (!mesPoles.length) return '';
    var posts = db(SK.POSTS, []);
    var cycleTs = currentCycleStartTs();
    // Rang du cycle parmi les pôles déjà évalués.
    var classement = SECTIONS.map(function(sec){ return { id: sec.id, b: sectionScoreboard(sec.id, cycleTs, posts) }; })
      .filter(function(x){ return x.b.count; })
      .sort(function(x, y){ return y.b.average - x.b.average; });
    var virgule = function(v){ return String(v).replace('.', ','); };
    return '<div id="monPole" style="padding:4px 16px 0;">' +
      mesPoles.map(function(id) {
        var sec = SECTIONS.find(function(x){ return x.id === id; });
        var cycle = sectionScoreboard(id, cycleTs, posts);
        var tout = sectionScoreboard(id, 0, posts);
        var dernier = tout.entries[0];
        var rang = classement.findIndex(function(x){ return x.id === id; });
        return '<section class="kc-apparait" style="background:' + sec.color + ';color:#FFF;border-radius:20px;margin-bottom:10px;padding:18px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
            '<span style="font-size:12px;font-weight:700;background:rgba(255,255,255,0.18);border-radius:12px;padding:5px 10px;">' + (mesPoles.length > 1 ? 'Mes pôles' : 'Mon pôle') + ' · ' + safeHtml(sec.nom) + '</span>' +
            (rang !== -1 ? '<span style="font-size:12px;font-weight:700;">' + (rang + 1) + (rang ? 'e' : 'er') + ' sur ' + classement.length + '</span>' : '') +
          '</div>' +
          (cycle.count
            ? '<div style="display:flex;align-items:baseline;gap:6px;margin-top:12px;">' +
                '<span style="font-size:44px;font-weight:800;line-height:1;">' + virgule(cycle.average) + '</span>' +
                '<span style="font-size:15px;opacity:0.85;">/5 ce cycle</span>' +
                (cycle.count >= 2 && cycle.trend ? '<span style="margin-left:6px;font-size:12px;font-weight:700;background:rgba(255,255,255,0.18);border-radius:10px;padding:3px 8px;">' + (cycle.trend > 0 ? '+' : '') + virgule(cycle.trend) + '</span>' : '') +
              '</div>'
            : '<div style="font-size:15px;font-weight:600;margin-top:12px;opacity:0.92;">' + (tout.count ? 'Pas encore évalué ce cycle.' : 'Pas encore évalué.') + '</div>') +
          (dernier
            ? '<button type="button" onclick="App.openBilan(\'' + jsArg(dernier.postId) + '\')" style="display:block;width:100%;text-align:left;margin-top:12px;padding:0;background:none;border:none;color:#FFF;cursor:pointer;">' +
                (dernier.comment ? '<span style="display:block;font-size:15px;line-height:1.5;">« ' + safeHtml(String(dernier.comment).slice(0, 220)) + ' »</span>' : '') +
                '<span style="display:block;font-size:12px;font-weight:600;opacity:0.9;margin-top:4px;">Dernier bilan · ' + safeHtml(dernier.eventTitle) + ' · ' + virgule(dernier.globalScore) + '/5</span>' +
              '</button>'
            : '') +
        '</section>';
      }).join('') +
    '</div>';
  }

  // cardKey identifie la carte dans S.scoreboardOpen : sec.id seul pour la vue
  // "Cycle en cours" (comportement historique, un pôle = une seule carte), ou
  // "c<startTs>::<secId>" pour la vue groupée par cycle, où le MÊME pôle peut
  // avoir une carte distincte (et donc un état ouvert/fermé indépendant) par cycle.
  function renderScoreboardCard(sec, board, cardKey) {
    var key = cardKey || sec.id;
    var open = S.scoreboardOpen === key;
    var has = board.count > 0;
    var col = !has ? 'var(--line)' : board.average >= 4 ? 'var(--ok-ink)' : board.average >= 2 ? 'var(--warn-ink)' : 'var(--bad-ink)';

    var trendHtml = '';
    if (has && board.count >= 2 && board.trend !== 0) {
      var up = board.trend > 0;
      trendHtml = '<span style="font-size:11px;font-weight:800;color:' + (up ? '#0E9F6E' : '#D92D20') + ';background:' + (up ? 'var(--ok-soft)' : 'var(--bad-soft)') + ';padding:2px 7px;border-radius:8px;white-space:nowrap;">' +
        (up ? '▲ +' : '▼ ') + board.trend + '</span>';
    }

    // Barres par critère : Ponctualité en tête (automatique), puis les critères saisis.
    var order = ['Ponctualité'].concat(EVAL_CRITERIA.map(function(c){ return c.nom; }));
    var critHtml = order.filter(function(k){ return board.criteriaAvg[k] !== undefined; }).map(function(k) {
      var v = board.criteriaAvg[k];
      // La ponctualité peut être négative : on ramène l'échelle -4..5 sur 0..100 %
      // (le plancher correspond à une absence ou un pointage frauduleux, -2★).
      var pct = Math.max(0, Math.min(100, ((v + 2) / 7) * 100));
      var cc = v >= 4 ? '#0E9F6E' : v >= 2 ? '#D98A0B' : '#D92D20';
      return '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:4px;">' +
          '<span>' + safeHtml(k) + (k === 'Ponctualité' ? ' <span style="font-size:11px;font-weight:800;color:var(--faint);background:var(--tile);padding:1px 5px;border-radius:8px;">AUTO</span>' : '') + '</span>' +
          '<span style="color:var(--ink);">' + v + '/5</span>' +
        '</div>' +
        '<div style="height:8px;background:var(--line);border-radius:4px;overflow:hidden;">' +
          '<div style="height:100%;width:' + pct + '%;background:' + cc + ';border-radius:4px;"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    var listHtml = board.entries.slice(0, 8).map(function(e) {
      var ec = e.globalScore >= 4 ? 'var(--ok-ink)' : e.globalScore >= 2 ? 'var(--warn-ink)' : 'var(--bad-ink)';
      var d = new Date(e.timestamp).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
      return '<div onclick="App.openBilan(\'' + jsArg(e.postId) + '\')" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--tile);cursor:pointer;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(e.eventTitle) + '</div>' +
          '<div style="font-size:11px;color:var(--faint);">' + d + (e.author ? ' · ' + safeHtml(e.author) : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
          '<span style="font-size:13px;font-weight:800;color:' + ec + ';">' + String(e.globalScore).replace('.', ',') + '/5</span>' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--line)" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div style="background:var(--card);border-radius:20px;margin-bottom:10px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.04);overflow:hidden;">' +
      '<div onclick="App.toggleScoreboardSection(\'' + jsArg(key) + '\')" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px;cursor:pointer;">' +
        '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
          '<div style="width:42px;height:42px;border-radius:20px;background:linear-gradient(135deg,' + sec.color + '20,' + sec.color + '10);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icoPole(sec.id, 22) + '</div>' +
          '<div style="min-width:0;">' +
            '<strong style="font-size:15px;color:var(--ink);display:block;">' + safeHtml(sec.nom) + '</strong>' +
            '<span style="font-size:12px;color:var(--faint);">' + (has ? board.count + ' bilan' + (board.count>1?'s':'') : 'Jamais évalué') + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">' +
          trendHtml +
          '<div style="font-family:' + UI.fontMono + ';font-size:22px;font-weight:700;color:' + col + ';">' + (has ? String(board.average).replace('.', ',') + '/5' : '—') + '</div>' +
          '<span style="font-size:13px;color:var(--line);transform:rotate(' + (open?'90':'0') + 'deg);transition:transform 0.2s;">›</span>' +
        '</div>' +
      '</div>' +
      (open && has
        ? '<div style="padding:0 16px 16px;">' +
            '<div style="font-size:11px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Moyennes par critère</div>' +
            critHtml +
            '<div style="font-size:11px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:0.8px;margin:14px 0 2px;">Bilans</div>' +
            listHtml +
          '</div>'
        : '') +
    '</div>';
  }

  function renderDebriefForm(u) {
    var userSec = (u && u.section_id) || '';

    return '' +

      '<div style="padding:16px;">' +
        '<p style="font-size:13px;color:var(--faint);margin:0 0 16px;line-height:1.5;">Note les performances des pôles pour un événement, critère par critère. Si tu as déjà publié un bilan pour cet événement, il sera mis à jour.</p>' +

        (function(){
          // Seuls les événements terminés se notent (un événement à venir donnait
          // −2★ de ponctualité à tous ses convoqués), du plus récent au plus ancien.
          var eventPosts = db(SK.POSTS, []).filter(function(p){ return p.type === 'EVENT' && isEventPast(p); })
            .sort(function(a, b){ return (eventStartTimestamp(b) || 0) - (eventStartTimestamp(a) || 0); });
          return '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:14px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.04);">' +
            '<label style="font-size:13px;font-weight:800;color:var(--ink);display:block;margin-bottom:8px;">Événement concerné <span style="color:#D92D20;">*</span></label>' +
            '<select id="evalEventSelect" onchange="App.selectEvalEvent(this.value)" class="kc-champ" style="' + styleSelect() + 'font-weight:600;">' +
              '<option value="">Sélectionner l\'événement à évaluer...</option>' +
              eventPosts.map(function(ev){
                var evTitle = ev.eventTitle || (ev.metadata && ev.metadata.title) || 'Événement';
                var evDate = ev.eventDate || (ev.metadata && ev.metadata.date) || '';
                var sel = S.evalEventId === ev.id ? ' selected' : '';
                var already = findOwnBilan(ev.id) ? ' ✓ déjà noté' : '';
                return '<option value="' + ev.id + '"' + sel + '>' + safeHtml(evTitle) + (evDate ? ' (' + safeHtml(evDate) + ')' : '') + already + '</option>';
              }).join('') +
            '</select>' +
            (S.evalEventId && findOwnBilan(S.evalEventId)
              ? '<div style="margin-top:10px;background:var(--warn-soft);border:1px solid var(--warn-line);border-radius:12px;padding:10px 12px;font-size:13px;color:var(--warn-ink);font-weight:600;line-height:1.45;">Tu as déjà publié un bilan pour cet événement. Tes notes sont pré-remplies : publier mettra à jour ce bilan.</div>'
              : '') +
          '</div>';
        })() +

        SECTIONS.map(function(sec) { return renderEvalSectionCard(sec, userSec); }).join('') +

          // padding-bottom généreux : la barre de navigation du bas est en position
          // fixe et recouvrait la moitié du bouton (on ne pouvait pas l'atteindre).
          '<button id="publishBilanBtn" onclick="App.publishBilan()" style="width:100%;background:' + UI.accent + ';color:#FFF;border:none;border-radius:999px;padding:15px;font-size:15px;font-weight:800;cursor:pointer;">' + (S.evalEventId && findOwnBilan(S.evalEventId) ? 'Mettre à jour le bilan' : 'Publier le bilan') + '</button>' +
          '<div style="height:96px;"></div>' +
        '</div>' +

      '</div>';
  }

  // Une carte de section dans l'écran Notation. Repliée : nom + moyenne.
  // Dépliée : une ligne d'étoiles par critère, notés indépendamment.
  // CARTE « MES ENGAGEMENTS » : niveau de fiabilité (Engagé, Fiable,
  // Exemplaire) calculé sur les 10 derniers engagements (niveauFiabilite).
  // Pas de note sur 30 ni de points négatifs : on voit où l'on en est, ce qui
  // manque pour monter d'un niveau, et ses derniers services en pastilles.
  function renderEngagementsCard(freshU) {
    var estMoi = !!(S.user && freshU && S.user.id === freshU.id);
    var h = punctualityHistory(freshU.id);
    var f = niveauFiabilite(h.entries);
    var tes = estMoi ? 'tes' : 'ses';

    // Phrase d'accompagnement : toujours tournée vers la suite.
    var phrase;
    if (!f.total) {
      phrase = estMoi ? 'Ton premier service lancera ta progression.' : 'Sa progression commencera avec son premier service.';
    } else if (!f.suivant) {
      phrase = estMoi ? 'Tu es au plus haut niveau. Bravo, continue comme ça !' : 'Au plus haut niveau. Bravo !';
    } else {
      phrase = 'Encore ' + f.manque + ' engagement' + (f.manque > 1 ? 's' : '') + ' tenu' + (f.manque > 1 ? 's' : '') +
        ' pour devenir <strong style="color:' + UI.ink + ';">' + f.suivant.nom + '</strong>.';
    }

    // Les trois niveaux, l'actuel mis en avant.
    var marches = NIVEAUX_FIABILITE.map(function(n, i) {
      var atteint = i <= f.rang, actuel = i === f.rang;
      return '<div style="flex:1;min-width:0;text-align:center;">' +
        '<div style="height:8px;border-radius:4px;background:' + (atteint ? UI.accent : UI.tile) + ';"></div>' +
        '<div style="font-size:12px;margin-top:7px;font-weight:' + (actuel ? '800' : '600') + ';color:' + (actuel ? UI.lien : UI.faint) + ';">' + n.nom + '</div>' +
      '</div>';
    }).join('');

    // Les 10 derniers engagements, du plus ancien (à gauche) au plus récent.
    var couleur = function(e) { return e.status === 'ontime' ? UI.ok : e.status === 'late' ? UI.warn : 'var(--line2)'; };
    var chrono = f.recents.slice().reverse();
    var pastilles = '';
    for (var i = 0; i < FENETRE_FIABILITE; i++) {
      var e = chrono[i];
      pastilles += e
        ? '<span title="' + safeHtml((e.eventTitle || '') + ' · ' + (e.label || '')) + '" style="flex:1;max-width:22px;aspect-ratio:1;border-radius:50%;background:' + couleur(e) + ';"></span>'
        : '<span style="flex:1;max-width:22px;aspect-ratio:1;border-radius:50%;border:1.5px dashed var(--line2);box-sizing:border-box;"></span>';
    }
    var legende = function(c, txt, pointille) {
      return '<span style="display:inline-flex;align-items:center;gap:5px;">' +
        '<span style="width:9px;height:9px;border-radius:50%;' + (pointille ? 'border:1.5px dashed ' + c + ';box-sizing:border-box;' : 'background:' + c + ';') + '"></span>' + txt + '</span>';
    };

    return '<div style="margin:16px 0 14px;">' +
      '<div style="background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:12px;box-shadow:' + UI.sh2 + ';padding:16px;">' +
        '<h2 style="font-family:' + UI.fontDisplay + ';font-size:22px;font-weight:700;color:' + UI.ink + ';letter-spacing:-0.3px;line-height:1.2;margin:0;">' + (estMoi ? 'Mes engagements' : 'Engagements') + '</h2>' +
        '<div style="font-size:12px;color:' + UI.faint + ';line-height:1.35;margin-top:2px;">Sur ' + tes + ' ' + FENETRE_FIABILITE + ' derniers services et tâches</div>' +
        // Niveau actuel
        '<div style="display:flex;align-items:center;gap:12px;margin-top:16px;">' +
          '<div style="width:52px;height:52px;flex-shrink:0;border-radius:50%;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;">' +
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="' + UI.lien + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              (f.rang === 2 ? '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z"/>'
               : f.rang === 1 ? '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>'
               : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>') +
            '</svg>' +
          '</div>' +
          '<div style="min-width:0;">' +
            '<div style="font-size:12px;font-weight:600;color:' + UI.faint + ';">Niveau</div>' +
            '<div style="font-family:' + UI.fontDisplay + ';font-size:28px;font-weight:800;letter-spacing:-0.02em;color:' + UI.lien + ';line-height:1.1;">' + f.niveau.nom + '</div>' +
          '</div>' +
          '<div style="margin-left:auto;text-align:right;flex-shrink:0;">' +
            '<div style="font-family:' + UI.fontDisplay + ';font-size:22px;font-weight:800;color:' + UI.ink + ';line-height:1;">' + f.tenus + '<span style="font-size:13px;font-weight:600;color:' + UI.faint + ';"> / ' + FENETRE_FIABILITE + '</span></div>' +
            '<div style="font-size:11px;color:' + UI.faint + ';margin-top:3px;">tenus</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-top:16px;">' + marches + '</div>' +
        '<p style="font-size:14px;color:' + UI.muted + ';margin:14px 0 0;line-height:1.5;">' + phrase + '</p>' +
        // Derniers engagements
        '<div style="border-top:1px solid ' + UI.line + ';margin-top:14px;padding-top:12px;">' +
          '<div style="display:flex;gap:6px;justify-content:space-between;align-items:center;">' + pastilles + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;color:' + UI.muted + ';margin-top:10px;">' +
            legende(UI.ok, 'Tenu') + legende(UI.warn, 'En retard') + legende('var(--line2)', 'Manqué') +
          '</div>' +
          '<div style="font-size:11.5px;color:' + UI.faint + ';margin-top:8px;line-height:1.45;">Un engagement est tenu quand on arrive à l\'heure ou qu\'on livre sa tâche à temps. Un retard ne retire rien : il ne compte simplement pas.</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Mention de position à côté d'un membre dans le détail de ponctualité :
  // signale clairement une arrivée enregistrée loin du lieu ou sans position.
  function renderGeoFlag(d) {
    if (d.absent) return '';
    if (!d.geo || !d.geo.available) {
      return '<span style="display:block;color:var(--warn-ink);font-weight:700;font-size:11px;">présence non vérifiée</span>';
    }
    if (d.distance === null || d.distance === undefined) {
      return '<span style="display:block;color:var(--faint);font-size:11px;">position enregistrée (lieu non défini)</span>';
    }
    if (d.onSite) {
      return '<span style="display:block;color:var(--ok-ink);font-size:11px;">sur place (' + formatDistance(d.distance) + ')</span>';
    }
    return '<span style="display:block;color:var(--bad-ink);font-weight:700;font-size:11px;">à ' + formatDistance(d.distance) + ' du lieu</span>';
  }

  function renderEvalSectionCard(sec, userSec) {
    // Les Grands Responsables (seuls habilités à noter) évaluent toutes les
    // sections, y compris la leur — l'ancien blocage a été retiré. On garde
    // simplement un repère visuel.
    var isOwn = sec.id === userSec;
    var r = S.ratings[sec.id] || { criteria: {}, comment: '' };
    if (!r.criteria) r.criteria = {};

    // Ponctualité : bloc en lecture seule, calculé automatiquement à partir des
    // heures d'arrivée (publications "À propos de" des membres assignés).
    var punc = S.evalEventId ? sectionPunctuality(sec.id, S.evalEventId) : null;

    // La note affichée en tête combine la ponctualité automatique et les critères
    // saisis à la main — c'est exactement ce qui sera publié dans le bilan.
    var headVals = EVAL_CRITERIA.map(function(c){ return r.criteria[c.id] || 0; }).filter(function(v){ return v > 0; });
    if (punc) headVals.push(punc.average);
    var avg = headVals.length ? Math.round((headVals.reduce(function(a,b){ return a+b; }, 0) / headVals.length) * 10) / 10 : 0;

    var ratedCount = EVAL_CRITERIA.filter(function(c){ return (r.criteria[c.id]||0) > 0; }).length;
    var expanded = S.evalExpandedSection === sec.id;
    var scoreColor = avg >= 4 ? 'var(--ok-ink)' : avg >= 2 ? 'var(--warn-ink)' : avg > 0 ? 'var(--bad-ink)' : 'var(--line)';

    var puncHtml = '';
    if (S.evalEventId) {
      if (punc) {
        var pc = punc.average >= 4 ? 'var(--ok-ink)' : punc.average >= 2 ? 'var(--warn-ink)' : punc.average > 0 ? 'var(--bad-ink)' : 'var(--bad-ink)';
        puncHtml = '<div style="padding:10px 0;border-top:1px solid var(--tile);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<span style="font-size:13px;font-weight:700;color:var(--ink);">Ponctualité <span style="font-size:11px;font-weight:800;color:var(--faint);background:var(--tile);padding:2px 6px;border-radius:8px;">AUTO</span></span>' +
            '<span style="font-size:13px;font-weight:800;color:' + pc + ';">' + String(punc.average).replace('.', ',') + '/5</span>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">' +
            punc.details.map(function(d) {
              var dc = d.stars >= 4 ? 'var(--ok-ink)' : d.stars >= 2 ? 'var(--warn-ink)' : 'var(--bad-ink)';
              var when = d.absent ? 'aucune publication' : (d.delayMinutes <= 0 ? "à l'heure" : '+' + d.delayMinutes + ' min');
              return '<div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:12px;color:var(--muted);gap:8px;">' +
                '<span style="min-width:0;">' + safeHtml(d.name) + (d.task ? ' · ' + safeHtml(d.task) : '') +
                  renderGeoFlag(d) +
                '</span>' +
                '<span style="font-weight:700;color:' + dc + ';white-space:nowrap;">' + d.stars + '★ · ' + when + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      } else {
        puncHtml = '<div style="padding:10px 0;border-top:1px solid var(--tile);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="font-size:13px;font-weight:700;color:var(--ink);">Ponctualité <span style="font-size:11px;font-weight:800;color:var(--faint);background:var(--tile);padding:2px 6px;border-radius:8px;">AUTO</span></span>' +
            '<span style="font-size:12px;color:var(--faint);">Aucun membre assigné</span>' +
          '</div>' +
        '</div>';
      }
    }

    var criteriaHtml = puncHtml + EVAL_CRITERIA.map(function(c) {
      var v = r.criteria[c.id] || 0;
      return '<div style="padding:10px 0;border-top:1px solid var(--tile);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<span style="font-size:13px;font-weight:700;color:var(--ink);">' + c.nom + '</span>' +
          '<span id="critval-' + sec.id + '-' + c.id + '" style="font-size:13px;font-weight:800;color:' + (v>0?'var(--ink)':'var(--line)') + ';">' + (v>0 ? v+'/5' : '—') + '</span>' +
        '</div>' +
        '<div id="critstars-' + sec.id + '-' + c.id + '" style="display:flex;gap:5px;">' +
          [1,2,3,4,5].map(function(star) {
            return '<button type="button" onclick="App.rateCriterion(\'' + jsArg(sec.id) + '\',\'' + jsArg(c.id) + '\',' + star + ')" style="font-size:28px;cursor:pointer;background:none;border:none;padding:0;line-height:1;color:' + (star<=v?'#FFD700':'var(--line)') + ';">★</button>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');

    return '<div style="background:var(--card);border-radius:20px;margin-bottom:10px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.04);overflow:hidden;">' +
      '<div onclick="App.toggleEvalSection(\'' + jsArg(sec.id) + '\')" style="display:flex;align-items:center;justify-content:space-between;padding:16px;cursor:pointer;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div style="width:42px;height:42px;border-radius:20px;background:linear-gradient(135deg,' + sec.color + '20,' + sec.color + '10);display:flex;align-items:center;justify-content:center;">' + icoPole(sec.id, 22) + '</div>' +
          '<div><strong style="font-size:15px;color:var(--ink);display:block;">' + sec.nom +
            (isOwn ? ' <span style="font-size:11px;font-weight:800;color:var(--lien);background:var(--accent-soft);padding:2px 7px;border-radius:8px;vertical-align:middle;">Ton pôle</span>' : '') +
          '</strong>' +
          '<span id="evalsub-' + sec.id + '" style="font-size:12px;color:var(--faint);">' + (ratedCount > 0 ? ratedCount + '/' + EVAL_CRITERIA.length + ' critères notés' : 'Touche pour noter les critères') + '</span></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div id="evalavg-' + sec.id + '" style="font-family:' + UI.fontMono + ';font-size:22px;font-weight:700;color:' + scoreColor + ';">' + (avg > 0 ? String(avg).replace('.', ',') + '/5' : '—') + '</div>' +
          '<span style="font-size:13px;color:var(--line);transform:rotate(' + (expanded?'90':'0') + 'deg);transition:transform 0.2s;">›</span>' +
        '</div>' +
      '</div>' +
      (expanded
        ? '<div style="padding:0 16px 16px;">' +
            criteriaHtml +
            '<input type="text" value="' + safeHtml(r.comment||'') + '" onchange="App.rateComment(\'' + jsArg(sec.id) + '\',this.value)" placeholder="Ajouter une observation..." ' +
            'class="kc-champ" style="' + styleChamp() + 'margin-top:12px;" ' +
            'onfocus="this.style.borderColor=\'#0B5FE0\'" onblur="this.style.borderColor=\'var(--line)\'">' +
          '</div>'
        : '') +
    '</div>';
  }
