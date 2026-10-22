// KUN COM VH — Partie 5c : Notifications, création et édition d'événement et de publication, partage, « À propos », vues

  'use strict';
  // ============================================================
  // CREATE POST MODAL
  // ============================================================

  
  // Convocation (ou notification d'événement) dont l'événement a été supprimé
  // depuis : elle reste dans la cloche, mais marquée « Annulé ».
  var TYPES_EVENEMENT = ['EVENT_ASSIGNED', 'EVENT_SECTION', 'CONVOCATION', 'ECHANGE', 'EVENT_CANCELLED'];
  function notificationAnnulee(n) {
    if (!n || TYPES_EVENEMENT.indexOf(n.type) === -1 || !n.targetId) return false;
    if (n.type === 'EVENT_CANCELLED') return true;
    var ev = db(SK.POSTS, []).find(function(p){ return p.id === n.targetId; });
    if (ev) return ev.type === 'EVENT_ARCHIVED' || ev.status === 'deleted';
    // Absent du cache : supprimé, sauf si la synchronisation n'est pas finie.
    return !(S.initialLoading || S.syncEnCours);
  }

  function renderNotificationsModal(u) {
    var notifs = (u && Array.isArray(u.notifications)) ? u.notifications : [];
    var unreadCount = notifs.filter(function(n){ return !n.read; }).length;

    var tousMembres = db(SK.USERS, []);
    var itemsHtml = '';
    if (notifs.length === 0) {
      itemsHtml = '<div style="padding:50px 20px;text-align:center;color:var(--faint);">' +
        '<div style="margin-bottom:10px;">' + ico('inbox', 40, UI.line2, 1.4) + '</div>' +
        '<div style="font-size:15px;font-weight:800;color:var(--ink);margin-bottom:6px;">Aucune notification</div>' +
        '<div style="font-size:13px;color:var(--faint);">Tu es à jour : aucune nouvelle activité.</div>' +
      '</div>';
    } else {
      // Groupage par jour : les notifications défilaient en vrac, sans repère
      // temporel. On insère un sur-titre collant devant chaque groupe.
      // jourIso travaille en heure LOCALE (getFullYear/getMonth/getDate) :
      // toISOString bascule sur UTC et aurait envoyé les notifications du soir
      // dans « Hier » pour un membre en UTC+.
      var jourIso = function(ts) {
        var d = new Date(ts || Date.now());
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      };
      var isoAujourdhui = jourIso(Date.now());
      var hierDate = new Date();
      hierDate.setDate(hierDate.getDate() - 1);
      var isoHier = jourIso(hierDate.getTime());

      // Libellé du sur-titre : Aujourd'hui / Hier / date précise (ex. « Lun. 12 août »).
      var libelleJour = function(iso) {
        if (iso === isoAujourdhui) return 'Aujourd\u2019hui';
        if (iso === isoHier) return 'Hier';
        var morceaux = iso.split('-');
        var d = new Date(Number(morceaux[0]), Number(morceaux[1]) - 1, Number(morceaux[2]));
        var label = d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'long' });
        if (d.getFullYear() !== new Date().getFullYear()) label += ' ' + d.getFullYear();
        return label.charAt(0).toUpperCase() + label.slice(1);
      };

      // Rendu d'un item (identique à l'ancien rendu unitaire) ; le fond distingue
      // toujours les non-lues via --accent-soft.
      var itemNotifHtml = function(n) {
        var iconName = n.type === 'LIKE' ? 'star'
          : (n.type === 'COMMENT' || n.type === 'REPLY' || n.type === 'MENTION') ? 'message'
          : n.type === 'EVALUATION' ? 'chart'
          : n.type === 'MESSAGE' ? 'inbox'
          : (n.type === 'FOLLOW' || n.type === 'NEW_MEMBER') ? 'users'
          : 'calendar';
        var annulee = notificationAnnulee(n);
        if (annulee) iconName = 'x';
        var icon = ico(iconName, 10, '#FFF', 2.4);
        var bgIcon = n.type === 'LIKE' ? UI.bad : (n.type === 'COMMENT' || n.type === 'REPLY') ? '#0B5FE0' : n.type === 'EVALUATION' ? UI.warnPlein : n.type === 'MENTION' ? UI.warnPlein : n.type === 'MESSAGE' ? '#0E9F6E' : n.type === 'FOLLOW' ? UI.accent : n.type === 'NEW_MEMBER' ? '#0E9F6E' : '#0B5FE0';
        if (annulee) bgIcon = UI.bad;
        var timeAgoStr = timeAgo(n.timestamp || Date.now());
        var isUnread = !n.read;

        // La photo n'est plus recopiée dans la notification (elle saturait le
        // stockage) : on la retrouve dans le profil de l'expéditeur via senderId.
        // Bénéfice au passage : un membre qui change de photo la voit changer
        // dans toutes ses notifications passées, au lieu de rester figée.
        var expediteur = n.senderId ? tousMembres.find(function(m){ return m.id === n.senderId; }) : null;
        var photo = (expediteur && expediteur.avatar_url) || n.senderAvatar || null;
        var teinte = couleurSure((expediteur && expediteur.avatar_color) || n.senderColor);

        var avatarHtml = photo
          ? '<img src="' + safeUrl(photo) + '" style="width:44px;height:44px;border-radius:20px;object-fit:cover;flex-shrink:0;" />'
          : '<div style="width:44px;height:44px;border-radius:20px;background:' + teinte + ';color:#FFF;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (n.senderName||'S').charAt(0).toUpperCase() + '</div>';

        return '<div onclick="App.clickNotification(\'' + jsArg(n.id) + '\', \'' + jsArg((n.targetId||'')) + '\')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:0.5px solid var(--tile);background:' + (isUnread ? 'var(--accent-soft)' : 'var(--card)') + ';cursor:pointer;transition:background 0.2s;position:relative;">' +
          '<div style="position:relative;flex-shrink:0;">' +
            avatarHtml +
            '<div style="position:absolute;bottom:-2px;right:-2px;width:19px;height:19px;border-radius:' + UI.pill + ';background:' + bgIcon + ';display:flex;align-items:center;justify-content:center;border:1.5px solid ' + UI.card + ';">' + icon + '</div>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;color:var(--ink);line-height:1.35;word-break:break-word;' + (annulee && n.type !== 'EVENT_CANCELLED' ? 'opacity:0.6;text-decoration:line-through;' : '') + '">' +
              '<strong>' + safeHtml(n.senderName || 'Membre') + '</strong> ' + safeHtml(n.text || '') +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--faint);margin-top:3px;">' + timeAgoStr +
              (annulee ? '<span style="font-size:11px;font-weight:800;color:var(--bad-ink);background:var(--bad-soft);padding:1px 7px;border-radius:999px;">Annulé</span>' : '') +
            '</div>' +
          '</div>' +
          (isUnread ? '<div style="width:8px;height:8px;border-radius:4px;background:#0B5FE0;flex-shrink:0;"></div>' : '') +
        '</div>';
      };

      // Bucket par jour en préservant l'ordre d'arrivée du tableau (déjà du plus
      // récent au plus ancien) : chaque jour ne donne lieu qu'à UN seul sur-titre.
      var groupes = [];
      var indexParJour = {};
      notifs.forEach(function(n) {
        var iso = jourIso(n.timestamp || Date.now());
        if (indexParJour[iso] === undefined) {
          indexParJour[iso] = groupes.length;
          groupes.push({ iso: iso, items: [] });
        }
        groupes[indexParJour[iso]].items.push(itemNotifHtml(n));
      });

      // Sur-titre collant : il reste visible tant que son groupe défile sous lui
      // (le conteneur parent est le seul scrollable de la feuille).
      itemsHtml = groupes.map(function(g) {
        return '<div style="position:sticky;top:0;z-index:2;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);background:var(--page);padding:8px 16px;">' +
          libelleJour(g.iso) +
        '</div>' +
        g.items.join('');
      }).join('');
    }

    return '<div onclick="App.closeNotifications()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeNotifications()">' +
          '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 8px 12px 18px;border-bottom:0.5px solid var(--line);">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<h2 style="font-family:' + UI.fontDisplay + ';font-size:22px;font-weight:800;letter-spacing:-0.4px;color:var(--ink);margin:0;">Notifications</h2>' +
            (unreadCount > 0 ? '<span style="background:#D92D20;color:#FFF;font-size:11px;font-weight:800;padding:2px 8px;border-radius:12px;">' + unreadCount + '</span>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:2px;flex-shrink:0;">' +
            (unreadCount > 0 ? '<button onclick="App.markAllNotificationsRead()" style="background:none;border:none;color:var(--lien);font-size:13px;font-weight:700;cursor:pointer;padding:0 8px;height:44px;">Tout lire</button>' : '') +
            // Auparavant, la seule façon de fermer était de viser la fine bande grise
            // au-dessus de la feuille ou la petite poignée — difficile à atteindre à
            // une main sur un écran presque entièrement occupé par la liste. Un bouton
            // explicite, à taille de cible tactile normale, referme la feuille sans ambiguïté.
            '<button onclick="App.closeNotifications()" aria-label="Fermer" style="background:none;border:none;width:44px;height:44px;border-radius:' + UI.pill + ';color:var(--ink);font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">×</button>' +
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
  // Le Admin voit tout le monde + une entrée « pôle entier » par
  // section ; un responsable de section ne voit que ses propres membres.
  // Indisponibilité déclarée par un membre pour une date (lot 2).
  function indisponibilite(m, dateIso) {
    if (!m || !dateIso || !Array.isArray(m.indisponibilites)) return null;
    return m.indisponibilites.find(function(x){ return x && x.date === dateIso; }) || null;
  }

  // dateIso (facultatif) : date de l'événement, pour signaler les membres
  // qui se sont déclarés indisponibles ce jour-là.
  function renderAssignSelectOptions(u, dateIso) {
    var allU = db(SK.USERS, []);
    var libelleMembre = function(m) {
      var indispo = indisponibilite(m, dateIso);
      return safeHtml((m.prenom||'') + ' ' + (m.nom||'')) + (indispo ? ' — indisponible' + (indispo.motif ? ' (' + safeHtml(indispo.motif) + ')' : '') : '');
    };
    var members = assignableMembers(u, allU);
    var secIds = assignableSectionIds(u);
    var out = '';

    if (isGrandResponsable(u)) {
      out += '<optgroup label="Confier à un pôle entier">' +
        SECTIONS.map(function(s) {
          return '<option value="sec:' + s.id + '">Pôle ' + safeHtml(s.nom) + '</option>';
        }).join('') +
      '</optgroup>';
    }

    var placed = {};
    secIds.forEach(function(secId) {
      var sec = SECTIONS.find(function(s){ return s.id === secId; });
      if (!sec) return;
      var inSec = members.filter(function(m){ return getUserSections(m).indexOf(secId) !== -1; });
      if (inSec.length === 0) return;
      out += '<optgroup label="' + safeHtml(sec.nom) + '">' +
        inSec.map(function(m) {
          placed[m.id] = true;
          return '<option value="' + m.id + '">' + libelleMembre(m) + '</option>';
        }).join('') +
      '</optgroup>';
    });

    // Membres sans pôle reconnu (uniquement visibles du Admin).
    var orphans = members.filter(function(m){ return !placed[m.id]; });
    if (orphans.length > 0) {
      out += '<optgroup label="Sans pôle">' +
        orphans.map(function(m) {
          return '<option value="' + m.id + '">' + libelleMembre(m) + '</option>';
        }).join('') +
      '</optgroup>';
    }

    if (!out) out = '<option value="" disabled>Aucun membre dans ton pôle</option>';
    return out;
  }

  // Choix proposé quand on enregistre la modification d'un événement.
  // Rendu PAR-DESSUS le formulaire (et non à sa place) pour que les champs
  // restent dans le DOM : saveEvent les relit juste après le choix.
  function renderEventSaveChoice() {
    if (!S.eventSaveChoiceOpen) return '';
    return '<div onclick="App.cancelEventSaveChoice()" style="position:fixed;inset:0;background:rgba(15,15,20,0.6);z-index:10002;display:flex;justify-content:center;align-items:center;padding:24px;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:360px;background:var(--card);border-radius:20px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
        '<h3 style="font-size:17px;font-weight:800;color:var(--ink);margin:0 0 6px;text-align:center;">Enregistrer les modifications</h3>' +
        '<p style="font-size:13px;color:var(--muted);line-height:1.5;margin:0 0 18px;text-align:center;">Remplacer cet événement, ou en créer un nouveau en gardant l\'ancien ?</p>' +

        '<button type="button" onclick="App.chooseEventSaveMode(\'overwrite\')" style="width:100%;background:var(--tile);border:none;border-radius:999px;padding:14px;margin-bottom:10px;cursor:pointer;text-align:left;">' +
          '<div style="font-size:15px;font-weight:800;color:var(--ink);margin-bottom:2px;">Mettre à jour cet événement</div>' +
          '<div style="font-size:12px;color:var(--faint);line-height:1.4;">L\'événement d\'origine est remplacé. Ses assignations et son historique sont conservés.</div>' +
        '</button>' +

        '<button type="button" onclick="App.chooseEventSaveMode(\'duplicate\')" style="width:100%;background:var(--accent-soft);border:1px solid var(--line2);border-radius:999px;padding:14px;margin-bottom:14px;cursor:pointer;text-align:left;">' +
          '<div style="font-size:15px;font-weight:800;color:var(--lien);margin-bottom:2px;display:flex;align-items:center;gap:6px;">' + ico('plus', 15, 'currentColor') + 'Créer un nouvel événement</div>' +
          '<div style="font-size:12px;color:#5A7BAA;line-height:1.4;">L\'ancien reste intact. Idéal pour répéter un événement : changez la date et dupliquez.</div>' +
        '</button>' +

        '<button type="button" onclick="App.cancelEventSaveChoice()" style="width:100%;background:none;border:none;padding:8px;font-size:13px;font-weight:700;color:var(--faint);cursor:pointer;">Annuler</button>' +
      '</div>' +
    '</div>';
  }

  // ---- Lieux enregistrés (formulaire d'événement) ----
  var STYLE_BOUTON_POSITION = 'display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;padding:0 16px;border-radius:999px;border:1.5px solid var(--line2);background:var(--card);color:var(--lien);font:inherit;font-size:15px;font-weight:700;cursor:pointer;';
  function detailLieu(l) {
    if (l.adresse) return l.adresse;
    return l.precision_m ? 'Relevé sur place · à ' + l.precision_m + ' m près' : (l.lat.toFixed(4) + ', ' + l.lng.toFixed(4));
  }
  function ligneLieu(l, depuis) {
    return '<button type="button" onclick="App.choisirLieu(\'' + jsArg(l.id) + '\',\'' + depuis + '\')" style="width:100%;display:flex;align-items:center;gap:10px;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:8px 12px;min-height:48px;cursor:pointer;font:inherit;">' +
      '<span style="width:30px;height:30px;border-radius:15px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ico('pin', 15, UI.lien) + '</span>' +
      '<span style="min-width:0;flex:1;">' +
        '<span style="display:block;font-size:14px;font-weight:700;color:var(--ink);overflow-wrap:anywhere;">' + safeHtml(l.nom) + '</span>' +
        '<span style="display:block;font-size:12px;color:var(--muted);line-height:1.35;overflow-wrap:anywhere;">' + safeHtml(detailLieu(l)) + '</span>' +
      '</span>' +
      '<span style="font-size:11px;font-weight:700;color:var(--muted);background:var(--tile);border-radius:8px;padding:2px 7px;flex-shrink:0;">Enregistré</span>' +
    '</button>';
  }
  // Sous « Lieu / salle » : les lieux les plus utilisés tant que rien n'est
  // tapé, puis ceux qui correspondent à la saisie (« l'église » → « Église VH »).
  function renderLieuxProposes(saisie, cData) {
    var lieux = db(SK.LIEUX, []);
    if (!lieux.length) return '';
    var q = String(saisie || '').trim();
    var situe = cData && typeof cData.lat === 'number';
    if (!q) {
      if (situe) return '';
      return '<div style="margin-top:10px;">' +
        '<div style="font-size:12px;font-weight:700;color:var(--muted);margin:0 4px 6px;">Lieux enregistrés</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
          lieuxCorrespondants('', lieux, 6).map(function(l) {
            return '<button type="button" onclick="App.choisirLieu(\'' + jsArg(l.id) + '\',\'lieu\')" style="display:inline-flex;align-items:center;gap:6px;min-height:36px;max-width:100%;padding:0 12px;border-radius:999px;border:1px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer;">' +
              ico('pin', 14, UI.lien) + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(l.nom) + '</span></button>';
          }).join('') +
        '</div>' +
      '</div>';
    }
    var res = lieuxCorrespondants(q, lieux, 4).filter(function(l) {
      return !(situe && l.lat === cData.lat && l.lng === cData.lng);
    });
    if (!res.length) return '';
    return '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">' +
      res.map(function(l){ return ligneLieu(l, 'lieu'); }).join('') + '</div>';
  }
  // Résultats de la recherche d'adresse : lieux enregistrés d'abord (sans
  // réseau), puis ceux de la carte.
  function renderResultatsLieu(saisie, resultats) {
    var q = String(saisie || '').trim();
    var enregistres = q ? lieuxCorrespondants(q, db(SK.LIEUX, []), 3) : [];
    var carte = resultats || [];
    if (!enregistres.length && !carte.length) return '';
    return '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">' +
      enregistres.map(function(l){ return ligneLieu(l, 'carte'); }).join('') +
      carte.map(function(r, i) {
        return '<button type="button" onclick="App.selectEventPlace(' + i + ')" style="width:100%;display:flex;align-items:center;gap:10px;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:8px 12px;min-height:48px;cursor:pointer;font:inherit;">' +
          '<span style="width:30px;height:30px;border-radius:15px;background:var(--tile);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ico('search', 14, UI.muted) + '</span>' +
          '<span style="min-width:0;flex:1;">' +
            '<span style="display:block;font-size:14px;font-weight:700;color:var(--ink);overflow-wrap:anywhere;">' + safeHtml(r.shortLabel) + '</span>' +
            '<span style="display:block;font-size:12px;color:var(--muted);line-height:1.35;overflow-wrap:anywhere;">' + safeHtml(r.label) + '</span>' +
          '</span>' +
        '</button>';
      }).join('') +
    '</div>';
  }

  function renderCreateEventModal() {
    var today = isoLocal();
    var cData = S.createEventData || {};
    var isEdit = !!S.editEventId;
    var titleVal = cData.title !== undefined ? cData.title : '';
    var locVal = cData.location !== undefined ? cData.location : '';
    var dateVal = cData.date !== undefined ? cData.date : today;
    var startVal = cData.start !== undefined ? cData.start : '09:00';
    var endVal = cData.end !== undefined ? cData.end : '11:30';
    var descVal = cData.desc !== undefined ? cData.desc : '';
    var pinnedVal = !!cData.pinned;
    var recurWeeklyVal = !!cData.recurWeekly;
    var recurWeeksVal = cData.recurWeeks || 8;

    // Bloc image (une seule image par événement)
    var imageBlock = '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:16px;">' +
      '<label style="font-size:15px;font-weight:700;color:var(--ink);display:block;margin-bottom:12px;">Image de l\'événement <span style="font-weight:500;color:var(--faint);">(optionnelle)</span></label>' +
      (S.eventImageProcessing
        ? '<div style="display:flex;align-items:center;gap:10px;background:var(--tile);border-radius:12px;padding:14px;">' +
            '<div style="width:18px;height:18px;border:3px solid var(--line2);border-top-color:#0B5FE0;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
            '<span style="font-size:13px;font-weight:700;color:var(--ink2);">Traitement de l\'image…</span>' +
          '</div>'
        : (S.eventImage
          ? '<div style="position:relative;border-radius:16px;overflow:hidden;background:#000;">' +
              '<img src="' + safeUrl(S.eventImage) + '" style="display:block;width:100%;height:auto;max-height:260px;object-fit:contain;background:#000;" />' +
              '<button type="button" onclick="App.editEventImage()" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.72);border:none;border-radius:12px;padding:6px 12px;color:#FFF;font-size:13px;font-weight:800;cursor:pointer;">Modifier</button>' +
              '<button type="button" onclick="App.removeEventImage()" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.72);border:none;border-radius:16px;width:32px;height:32px;color:#FFF;font-size:15px;font-weight:800;cursor:pointer;">×</button>' +
            '</div>'
          : '<label style="display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed var(--line);border-radius:16px;padding:22px;cursor:pointer;color:var(--lien);font-size:15px;font-weight:700;">' +
              'Ajouter une image' +
              '<input type="file" accept="image/*" onchange="App.addEventImage(event)" style="display:none;" />' +
            '</label>')) +
    '</div>';

    return '<div class="safe-top" style="position:fixed;inset:0;background:' + UI.page + ';z-index:10000;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      enTetePleinEcran(isEdit ? 'Modifier l\'événement' : S.republierSerie ? 'Republier l\'événement' : 'Nouvel événement', 'App.closeCreateEvent()', boutonEnTete(isEdit ? 'Enregistrer' : S.republierSerie ? 'Publier' : 'Créer', 'App.saveEvent(this)')) +
      (S.republierSerie && !isEdit
        ? '<div role="status" style="margin:12px 16px 0;background:var(--accent-soft);color:var(--accent-ink);border-radius:14px;padding:12px 14px;font-size:13px;font-weight:600;line-height:1.45;">Copie de la date du ' + safeHtml(new Date((S.republierDepuis || '') + 'T00:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })) + '. Change ce que tu veux (date, équipe, heure…), puis touche « Publier ». Elle rejoindra la même série.</div>'
        : '') +
      '<div style="flex:1;overflow-y:auto;background:' + UI.page + ';padding:8px 16px 32px;">' +
        imageBlock +

        '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:16px;">' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div>' +
              '<label for="eventTitle" style="' + STYLE_LIBELLE + '">Titre de l\'événement</label>' +
              '<input type="text" id="eventTitle" class="kc-champ" value="' + safeHtml(titleVal) + '" placeholder="Ex. : Culte du dimanche" style="' + styleChamp() + '" />' +
            '</div>' +
            '<div>' +
              '<label for="eventLocation" style="' + STYLE_LIBELLE + '">Lieu / salle</label>' +
              '<input type="text" id="eventLocation" class="kc-champ" value="' + safeHtml(locVal) + '" oninput="App.onEventLocationInput(this.value)" autocomplete="off" placeholder="Ex. : Église, salle principale" style="' + styleChamp() + '" />' +
              // Lieux déjà enregistrés : proposés à la saisie, même loin du lieu.
              '<div id="eventLieuxProposes">' + renderLieuxProposes(locVal, cData) + '</div>' +
            '</div>' +
            // Position du lieu : relevée sur place (bouton « ma position »), ou
            // cherchée par son nom ou son adresse. Jamais relevée sans le demander :
            // on prépare souvent un événement de chez soi.
            '<div style="display:flex;flex-direction:column;gap:8px;">' +
              '<label for="eventPlaceInput" style="' + STYLE_LIBELLE + 'margin-bottom:0;">Situer le lieu sur la carte <span style="font-weight:500;color:var(--faint);">(facultatif)</span></label>' +
              (typeof cData.lat === 'number'
                ? (function() {
                    var gps = typeof cData.accuracy === 'number' && cData.accuracy > 0;
                    var approx = gps && cData.accuracy > 100;
                    var detail = gps
                      ? 'Relevé sur place · à ' + cData.accuracy + ' m près' + (cData.placeLabel ? ' · ' + cData.placeLabel : '')
                      : (cData.placeLabel || (cData.lat.toFixed(5) + ', ' + cData.lng.toFixed(5)));
                    return '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;background:' + (approx ? 'var(--warn-soft)' : 'var(--ok-soft)') + ';border:1px solid ' + (approx ? 'var(--warn-line)' : 'var(--ok-line)') + ';border-radius:12px;padding:10px 12px;">' +
                      '<div style="min-width:0;display:flex;gap:8px;align-items:flex-start;">' +
                        ico(gps ? 'locate' : 'pin', 16, approx ? 'var(--warn-ink)' : 'var(--ok-ink)') +
                        '<div style="min-width:0;">' +
                          '<div style="font-size:13px;font-weight:800;color:' + (approx ? 'var(--warn-ink)' : 'var(--ok-ink)') + ';">' + safeHtml(cData.placeName || 'Lieu situé') + '</div>' +
                          '<div style="font-size:12px;color:var(--muted);line-height:1.35;">' + safeHtml(detail) + '</div>' +
                          (approx ? '<div style="font-size:12px;color:var(--warn-ink);line-height:1.35;margin-top:2px;">Position approximative : réessaie dehors ou près d\'une fenêtre.</div>' : '') +
                          (gps && !(cData.location || '').trim() && cData.placeName === 'Position relevée sur place'
                            ? '<div style="font-size:12px;color:var(--muted);line-height:1.35;margin-top:2px;">Donne un nom au lieu ci-dessus pour le retrouver la prochaine fois.</div>' : '') +
                        '</div>' +
                      '</div>' +
                      '<button type="button" onclick="App.clearEventPosition()" style="background:none;border:none;color:var(--lien);min-height:32px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">Changer</button>' +
                    '</div>';
                  })()
                : '<div>' +
                    (S.eventGeoEnCours
                      ? '<button type="button" disabled style="' + STYLE_BOUTON_POSITION + 'opacity:0.8;cursor:default;">' +
                          '<div style="width:16px;height:16px;border:2.5px solid var(--line2);border-top-color:#0B5FE0;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
                          'Relevé de ta position…</button>'
                      : '<button type="button" onclick="App.utiliserMaPosition()" style="' + STYLE_BOUTON_POSITION + '">' +
                          ico('locate', 18, 'currentColor', 2.2) + 'Utiliser ma position actuelle</button>') +
                    '<div style="font-size:12px;color:var(--faint);line-height:1.4;margin:6px 4px 10px;">Tu es sur le lieu ? Ta position devient celle du lieu, et il sera proposé la prochaine fois.</div>' +
                    '<div style="display:flex;align-items:center;gap:8px;height:52px;padding:0 16px;border:1.5px solid var(--line2);border-radius:26px;background:var(--card);box-sizing:border-box;">' +
                      ico('search', 18, UI.faint) +
                      '<input type="text" id="eventPlaceInput" value="' + safeHtml(S.eventPlaceQuery || '') + '" oninput="App.onEventPlaceInput(this.value)" autocomplete="off" placeholder="Ou cherche une adresse" style="flex:1;border:none;background:transparent;font-size:15px;color:var(--ink);outline:none;min-width:0;" />' +
                      '<span style="font-size:11px;font-weight:800;color:var(--faint);background:var(--line);padding:2px 7px;border-radius:8px;flex-shrink:0;">CI</span>' +
                      (S.eventPlaceSearching
                        ? '<div style="width:15px;height:15px;border:2.5px solid var(--line2);border-top-color:#0B5FE0;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>'
                        : '') +
                    '</div>' +
                    (S.eventPlaceError
                      ? '<div role="alert" style="font-size:12px;color:var(--bad-ink);font-weight:600;margin-top:6px;line-height:1.4;">' + safeHtml(S.eventPlaceError) + '</div>'
                      : '') +
                    '<div id="eventPlaceResults">' + renderResultatsLieu(S.eventPlaceQuery, S.eventPlaceResults) + '</div>' +
                  '</div>') +
              '<div style="font-size:11px;color:var(--faint);line-height:1.4;">Un membre est considéré « sur place » s\'il enregistre son arrivée à moins de ' + formatDistance(ON_SITE_RADIUS_M) + ' de ce point. La distance de chacun sera visible de tous.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        
        '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:16px;">' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div>' +
              '<label for="eventDate" style="' + STYLE_LIBELLE + '">Date</label>' +
              '<input type="date" id="eventDate" class="kc-champ" value="' + safeHtml(dateVal) + '" style="' + styleChamp() + '" />' +
            '</div>' +
            // Le message occupe sa PROPRE ligne sous le champ : placé dans la même
            // rangée que l'heure, il se superposait à la valeur et forçait le
            // libellé « Heure de fin » à passer sur deux lignes.
            '<div>' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                '<div>' +
                  '<label for="eventStart" style="' + STYLE_LIBELLE + '">Début</label>' +
                  '<input type="time" id="eventStart" class="kc-champ" value="' + safeHtml(startVal) + '" oninput="App.onEventTimeChange()" style="' + styleChamp() + '" />' +
                '</div>' +
                '<div>' +
                  '<label for="eventEnd" style="' + STYLE_LIBELLE + '">Fin</label>' +
                  '<input type="time" id="eventEnd" class="kc-champ" value="' + safeHtml(endVal) + '" oninput="App.onEventTimeChange()" style="' + styleChamp() + '" />' +
                '</div>' +
              '</div>' +
              // État initial calculé au rendu : à la réouverture d'une veillée
              // déjà enregistrée, la mention doit être visible sans toucher au champ.
              (function(){
                var msg = '', col = '#0B5FE0', bg = 'var(--accent-soft)';
                if (startVal && endVal && endVal === startVal) {
                  msg = 'La fin ne peut pas être identique au début.'; col = 'var(--bad-ink)'; bg = 'var(--bad-soft)';
                } else if (startVal && endVal && endVal < startVal) {
                  msg = 'Se termine le lendemain à ' + endVal + '.';
                }
                return '<div id="eventTimeError" style="display:' + (msg ? 'block' : 'none') + ';font-size:12px;font-weight:700;line-height:1.4;margin-top:8px;padding:7px 10px;border-radius:12px;background:' + bg + ';color:' + col + ';">' + msg + '</div>';
              })() +
            '</div>' +
          '</div>' +
        '</div>' +

        // Répétition hebdomadaire : évite de recréer manuellement chaque semaine
        // un événement récurrent (ex : les 3 cultes du dimanche). Uniquement à la
        // création — modifier une série déjà créée se fait événement par événement.
        (isEdit ? '' :
        '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:16px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
            '<div>' +
              '<div style="font-size:15px;font-weight:600;color:var(--ink);">Se répète chaque semaine</div>' +
              '<div style="font-size:12px;color:var(--faint);margin-top:2px;">Crée automatiquement les prochaines occurrences (même jour, même heure)</div>' +
            '</div>' +
            '<label style="position:relative;display:inline-block;width:50px;height:30px;flex-shrink:0;">' +
              '<input type="checkbox" id="eventRecurWeekly"' + (recurWeeklyVal ? ' checked' : '') + ' style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#0B5FE0\':\'var(--line)\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\'; document.getElementById(\'eventRecurWeeksRow\').style.display=this.checked?\'flex\':\'none\';">' +
              '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (recurWeeklyVal ? UI.accent : 'var(--line)') + ';transition:.3s;border-radius:30px;">' +
                '<span style="position:absolute;content:\'\';height:26px;width:26px;left:2px;bottom:2px;background-color:white;transition:.3s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);transform:' + (recurWeeklyVal ? 'translateX(20px)' : 'translateX(0)') + ';"></span>' +
              '</span>' +
            '</label>' +
          '</div>' +
          '<div id="eventRecurWeeksRow" style="display:' + (recurWeeklyVal ? 'flex' : 'none') + ';align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--line);margin-top:14px;padding-top:14px;">' +
            '<label style="font-size:15px;color:var(--ink);font-weight:600;">Nombre de semaines</label>' +
            '<input type="number" id="eventRecurWeeks" class="kc-champ" min="2" max="52" value="' + recurWeeksVal + '" style="' + styleChamp() + 'width:88px;text-align:center;font-weight:700;" />' +
          '</div>' +
        '</div>') +

        '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:16px;">' +
          '<label style="font-size:15px;font-weight:700;color:var(--ink);display:block;margin-bottom:12px;">Pôles concernés</label>' +
          '<div id="eventSectionBadgesContainer">' + App.renderSectionBadges(S.eventSections, 'toggleEventSection') + '</div>' + 
        '</div>' +
        
        '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:16px;">' +
          '<label for="eventDesc" style="' + STYLE_LIBELLE + '">Description / notes</label>' +
          '<textarea id="eventDesc" class="kc-champ" placeholder="Ajoute un briefing ou des notes pour les équipes…" style="' + styleChamp(true) + '">' + safeHtml(descVal) + '</textarea>' +
        '</div>' +
        
        (canAssign(S.user) ?
        '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:16px;">' +
          '<label style="font-size:15px;font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Assignations (Équipe)</label>' +
          '<div style="font-size:12px;color:var(--faint);margin-bottom:12px;line-height:1.4;">' +
            (isGrandResponsable(S.user)
              ? 'Tu peux confier une tâche à un membre précis ou à un pôle entier : son responsable la répartira ensuite.'
              : 'Tu assignes les membres de ton pôle. Les autres responsables complètent pour le leur.') +
          '</div>' +
          '<div id="eventAssignmentsList">' + App.renderAssignmentsList() + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px;">' +
            '<select id="assignUserSelect" class="kc-champ" style="' + styleSelect() + '">' +
              '<option value="">Sélectionner un membre…</option>' +
              renderAssignSelectOptions(S.user, dateVal) +
            '</select>' +
            '<input type="text" id="assignTaskInput" class="kc-champ" placeholder="Tâche (facultatif), ex. : Caméra 2" style="' + styleChamp() + '" />' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="datetime-local" id="assignDeadlineInput" class="kc-champ" style="' + styleChamp() + 'flex:1;min-width:0;" />' +
              '<button type="button" onclick="App.addAssignment()" style="background:' + UI.accent + ';color:#FFF;border:none;border-radius:999px;min-height:52px;padding:0 18px;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;">Ajouter</button>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--faint);line-height:1.4;">Avec une échéance, l\'assignation devient une <strong>tâche à livrer</strong> : le membre la coche « faite » et elle compte dans ses services (à temps +5, en retard +2, non livrée −2). Sans échéance, c\'est une simple présence.</div>' +
          '</div>' +
        '</div>' : '') +
        
        '<div style="background:var(--card);border-radius:20px;padding:16px;display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' +
            '<div style="font-size:15px;font-weight:600;color:var(--ink);">Épingler en haut du fil</div>' +
            '<div style="font-size:12px;color:var(--faint);margin-top:2px;">Rend l\'événement très visible</div>' +
          '</div>' +
          '<label style="position:relative;display:inline-block;width:50px;height:30px;">' +
            '<input type="checkbox" id="eventPinned"' + (pinnedVal ? ' checked' : '') + ' style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#0B5FE0\':\'var(--line)\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';">' +
            '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (pinnedVal ? UI.accent : 'var(--line)') + ';transition:.3s;border-radius:30px;">' +
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
      schedDateVal = isoLocal(d);
      schedTimeVal = d.toTimeString().split(' ')[0].slice(0, 5);
    }

    var previewHtml = renderComposerMediaPreview();

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:var(--lien);width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+jsArg(h)+'\')" style="display:inline-flex;align-items:center;min-height:36px;background:#0B5FE0;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeEditPost()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeEditPost()">' +
          '<div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeEditPost()" style="font-size:15px;color:var(--muted);cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:15px;font-weight:800;margin:0;color:var(--ink);letter-spacing:-0.2px;">Modifier la publication</h3>' +
          '<button type="button" onclick="App.saveEditPost(\'' + jsArg(post.id) + '\')" style="font-size:15px;color:#FFF;font-weight:800;background:#0B5FE0;border:none;border-radius:20px;padding:8px 18px;cursor:pointer;">Enregistrer</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:10px;margin-bottom:12px;"></div>' +
          previewHtml +

          (S.pendingMedia.length === 0 && S.postBg
            ? '<div id="bgPreviewZone" style="border-radius:20px;overflow:hidden;margin-bottom:14px;position:relative;min-height:180px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,0.14);' + (S.postBg.startsWith('url') ? 'background:' + safeHtml(S.postBg) + ';background-size:cover;background-position:center;' : 'background:' + safeHtml(S.postBg) + ';') + '">' +
                (S.postBg && !S.postBg.includes('linear-gradient') && !S.postBg.includes('url') ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.18);border-radius:20px;"></div>' : '') +
                '<textarea id="editPostText" oninput="App.onPostInput(this.value)" placeholder="Modifie ton texte…" style="width:100%;min-height:180px;border:none;background:transparent;font-size:28px;font-weight:800;line-height:1.4;color:#FFF;resize:none;outline:none;box-sizing:border-box;font-family:inherit;text-align:center;padding:24px 20px;text-shadow:0 2px 12px rgba(0,0,0,0.3);position:relative;z-index:1;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</div>'
            : '<textarea id="editPostText" oninput="App.onPostInput(this.value)" placeholder="Modifie ton texte… Tape @ pour mentionner un membre" style="width:100%;min-height:120px;border:none;background:var(--tile);border-radius:20px;padding:14px;font-size:15px;line-height:1.55;color:var(--ink);resize:none;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:14px;">' + safeHtml(S.postText||'') + '</textarea>'
          ) +

          '<!-- Confidentialité -->' +
          '<div style="background:var(--tile);border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:12px;background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;font-size:13px;">' + ico('lock', 14, UI.lien) + '</span>Qui peut voir cette publication ?</span>' +
            '<div style="display:flex;gap:4px;background:var(--line2);border-radius:16px;padding:3px;">' +
              '<button type="button" onclick="App.setPostVisibility(\'all\')" style="flex:1;padding:8px 6px;border-radius:999px;font-size:12px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + (vis==='all'?'#FFFFFF':'transparent') + ';color:' + (vis==='all'?'#0B5FE0':'var(--muted)') + ';box-shadow:' + (vis==='all'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">' + ico('globe', 14, 'currentColor') + ' Tout le monde</button>' +
              '<button type="button" onclick="App.setPostVisibility(\'sections\')" style="flex:1;padding:8px 6px;border-radius:999px;font-size:12px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + (vis==='sections'?'#FFFFFF':'transparent') + ';color:' + (vis==='sections'?'#0B5FE0':'var(--muted)') + ';box-shadow:' + (vis==='sections'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">Sections ciblées</button>' +
            '</div>' +
            (vis === 'sections'
              ? '<div style="margin-top:10px;">' +
                  '<label style="font-size:12px;color:var(--faint);font-weight:600;display:block;margin-bottom:6px;">Cliquer sur les sections autorisées :</label>' +
                  '<div id="targetSectionBadgesContainer">' + App.renderSectionBadges(S.postTargetSections||[], 'toggleTargetSection') + '</div>' +
                '</div>'
              : '') +
          '</div>' +

          '<!-- Programmation -->' +
          '<div style="background:var(--tile);border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:12px;background:#FFF3E5;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">' + ico('clock', 14, '#B45309') + '</span>Programmer la publication</span>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="date" id="editPostScheduleDate" value="' + schedDateVal + '" class="kc-champ" style="' + styleChamp() + 'flex:1;min-width:0;" />' +
              '<input type="time" id="editPostScheduleTime" value="' + schedTimeVal + '" class="kc-champ" style="' + styleChamp() + 'flex:1;min-width:0;" />' +
            '</div>' +
          '</div>' +

          '<!-- À propos -->' +
          '<div style="background:var(--tile);border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (S.postAboutEventId?'10px':'0') + ';">' +
              '<span style="font-size:13px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:12px;background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;font-size:13px;">' + ico('calendar', 14, UI.lien) + '</span>À propos <span style="font-weight:600;color:var(--faint);font-size:11px;">(optionnel)</span></span>' +
              (S.postAboutEventId ? '<span onclick="App.clearAboutEvent()" style="color:#D92D20;font-size:12px;font-weight:700;cursor:pointer;">Retirer</span>' : '') +
            '</div>' +
            (function(){
              if (!S.postAboutEventId) {
                return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;background:var(--card);border:1px dashed var(--line);border-radius:999px;padding:10px;font-size:13px;font-weight:700;color:var(--lien);cursor:pointer;">+ Lier à un événement (ex : culte de dimanche)</button>';
              }
              var evAbout2 = db(SK.POSTS, []).find(function(p){ return p.id === S.postAboutEventId; });
              if (!evAbout2) return '';
              var evAbout2D = evAbout2.eventDate ? new Date(evAbout2.eventDate+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) : '';
              return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;display:flex;align-items:center;gap:8px;background:var(--card);border-radius:999px;padding:10px;text-align:left;border:none;cursor:pointer;">' +
                ico('calendar', 16, UI.lien) +
                '<span style="flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(evAbout2.eventTitle||'') + (evAbout2D?' · '+evAbout2D:'') + (evAbout2.eventStart?' à '+safeHtml(evAbout2.eventStart):'') + '</span>' +
              '</button>';
            })() +
          '</div>' +

          '<!-- Éphémère -->' +
          '<div style="background:var(--tile);border-radius:20px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="width:26px;height:26px;border-radius:12px;background:#FFEDE0;display:inline-flex;align-items:center;justify-content:center;font-size:15px;">' + ico('clock', 15, '#B45309') + '</span>' +
                '<div>' +
                  '<div style="font-size:13px;font-weight:800;color:var(--ink);">Publication éphémère</div>' +
                  '<div style="font-size:11px;color:var(--faint);">Disparaît automatiquement après 24h</div>' +
                '</div>' +
              '</div>' +
              '<label style="position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0;">' +
                '<input type="checkbox" id="editPostEphemeral" ' + (post.is_ephemeral ? 'checked' : '') + ' style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'var(--warn)\':\'var(--line2)\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';"/>' +
                '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:' + (post.is_ephemeral?'var(--warn)':'var(--line2)') + ';transition:.25s;border-radius:28px;">' +
                  '<span style="position:absolute;content:\'\';height:22px;width:22px;left:3px;bottom:3px;background-color:white;transition:.25s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);transform:' + (post.is_ephemeral?'translateX(20px)':'translateX(0)') + ';"></span>' +
                '</span>' +
              '</label>' +
            '</div>' +
          '</div>' +

        '</div>' +

        '<div style="padding:4px 16px 14px;">' +
          (S.pendingMedia.length === 0
            ? '<div style="display:flex;gap:8px;align-items:center;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none;">' +
                '<span style="font-size:11px;font-weight:700;color:var(--faint);flex-shrink:0;">Fond</span>' +
                '<div onclick="App.setPostBg(null)" style="width:30px;height:30px;border-radius:16px;background:var(--card);border:2px solid ' + (S.postBg===null?'#0B5FE0':'var(--line)') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:var(--ink2);">Aa</div>' +
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
                  return '<div onclick="App.setPostBgIdx(' + idx + ')" style="width:30px;height:30px;border-radius:16px;background:' + bg + ';cursor:pointer;flex-shrink:0;border:2.5px solid ' + (isSel?'#FFF':'transparent') + ';box-shadow:' + (isSel?'0 0 0 2px #0B5FE0':'0 1px 3px rgba(0,0,0,0.15)') + ';transition:0.15s;"></div>';
                }).join('') +
              '</div>'
            : ''
          ) +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--lien);font-size:13px;font-weight:800;background:var(--accent-soft);padding:9px 14px;border-radius:16px;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5FE0" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
              'Photo / Vidéo' +
              '<input type="file" accept="image/*,video/*" multiple onchange="App.addMedia(event)" style="display:none;">' +
            '</label>' +
            '<span style="font-size:12px;color:var(--faint);font-weight:600;">' + (S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? '1 vidéo' : S.pendingMedia.length + '/10 photos') + '</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:12px;color:var(--muted);font-weight:600;line-height:1.4;background:var(--tile);padding:10px 12px;border-radius:16px;"><input type="checkbox" ' + (S.reduceVideoQuality?'checked':'') + ' onchange="App.toggleReduceVideoQuality()" style="width:17px;height:17px;flex-shrink:0;accent-color:#0B5FE0;"> ' + ico('video', 14, 'currentColor') + ' Nous réduisons la qualité vidéo en HD pour une expérience plus fluide</label>' +
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

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:var(--lien);width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+jsArg(h)+'\')" style="display:inline-flex;align-items:center;min-height:36px;background:#0B5FE0;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeRepostModal()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeRepostModal()">' +
          '<div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeRepostModal()" style="font-size:15px;color:var(--muted);cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:15px;font-weight:800;margin:0;color:var(--ink);letter-spacing:-0.2px;">Partager</h3>' +
          '<button type="button" onclick="App.confirmRepost()" style="font-size:15px;color:#FFF;font-weight:800;background:#0B5FE0;border:none;border-radius:20px;padding:8px 18px;cursor:pointer;">Partager</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:10px;margin-bottom:12px;"></div>' +
          '<textarea id="repostText" oninput="App.onPostInput(this.value)" placeholder="Ajoute un commentaire… Tape # pour un hashtag ou @ pour mentionner un membre" style="width:100%;min-height:90px;border:none;background:var(--tile);border-radius:20px;padding:14px;font-size:15px;line-height:1.55;color:var(--ink);resize:none;outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:14px;">' + safeHtml(S.postText||'') + '</textarea>' +

          '<div style="background:var(--tile);border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="padding:10px 12px;">' +
              '<strong style="font-size:13px;color:var(--ink);">' + safeHtml(post.author||'Membre') + '</strong>' +
            '</div>' +
            (previewMedia
              ? (isVideoUrl(previewMedia)
                  ? '<video src="'+safeUrl(previewMedia)+'"' + (post.videoPoster ? ' poster="'+safeUrl(post.videoPoster)+'"' : '') + ' muted preload="metadata" style="width:100%;max-height:220px;object-fit:cover;display:block;background:#000;"></video>'
                  : '<img src="'+safeUrl(previewMedia)+'" style="width:100%;max-height:220px;object-fit:cover;display:block;">')
              : (post.postBg
                  ? '<div style="min-height:100px;display:flex;align-items:center;justify-content:center;padding:20px;background:' + safeHtml(post.postBg) + ';"><p style="color:#FFF;font-size:15px;font-weight:800;text-align:center;margin:0;">' + safeHtml(previewCaption.slice(0,140)) + '</p></div>'
                  : '<p style="font-size:13px;color:var(--ink2);margin:0;padding:12px;line-height:1.4;">' + safeHtml(previewCaption.slice(0,200)) + '</p>')
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
    return '<button type="button" onclick="App.selectAboutEvent(\''+jsArg(ev.id)+'\')" style="width:100%;display:flex;align-items:center;gap:12px;background:' + (isSel?'var(--accent-soft)':'#F8F8FA') + ';border:1.5px solid ' + (isSel?'#0B5FE0':'transparent') + ';border-radius:999px;padding:12px;margin-bottom:10px;cursor:pointer;text-align:left;">' +
      '<div style="background:var(--card);border-radius:12px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.06);width:44px;text-align:center;flex-shrink:0;">' +
        '<div style="background:#0B5FE0;color:#FFF;font-size:8.5px;font-weight:800;text-transform:uppercase;padding:3px 0;letter-spacing:0.5px;">' + evMonth + '</div>' +
        '<div style="font-size:17px;font-weight:800;color:var(--ink);padding:3px 0;">' + evDay + '</div>' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:15px;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(ev.eventTitle) + '</div>' +
        '<div style="font-size:12px;color:var(--faint);margin-top:2px;">' + (ev.eventStart ? safeHtml(ev.eventStart) + (ev.eventEnd ? ' — ' + safeHtml(ev.eventEnd) : '') : '') + '</div>' +
      '</div>' +
      (isSel ? '<span style="color:var(--lien);font-size:17px;">✓</span>' : '') +
    '</button>';
  }

  // Construit la liste (À venir + Passés, pour permettre de lier une publication à un
  // récap d'un événement déjà passé), filtrée par la recherche en cours.
  function renderAboutEventListHtml() {
    var allPosts = db(SK.POSTS, []);
    var todayIso = isoLocal();
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
      return '<div style="text-align:center;padding:36px 20px;color:var(--faint);">' +
        '<div style="margin-bottom:10px;display:flex;justify-content:center;">' + ico('calendar', 36, UI.faint, 1.6) + '</div>' +
        '<div style="font-size:15px;font-weight:800;color:var(--ink);">' + (q ? 'Aucun résultat' : 'Aucun événement') + '</div>' +
        '<div style="font-size:13px;margin-top:4px;">' + (q ? 'Essaie un autre mot-clé.' : 'Crée un événement dans le Planning pour pouvoir le lier ici.') + '</div>' +
      '</div>';
    }

    var html = '';
    if (upcoming.length > 0) {
      html += '<div style="font-size:11px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 8px;">À venir</div>' +
        upcoming.map(renderAboutEventItemBtn).join('');
    }
    if (past.length > 0) {
      html += '<div style="font-size:11px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:0.5px;margin:' + (upcoming.length>0?'14px':'4px') + ' 0 8px;">Passés · pour un récap</div>' +
        past.map(renderAboutEventItemBtn).join('');
    }
    return html;
  }

  function renderAboutEventPickerModal() {
    return '<div onclick="App.closeAboutEventPicker()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10001;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeAboutEventPicker()">' +
          '<div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeAboutEventPicker()" style="font-size:15px;color:var(--muted);cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-size:15px;font-weight:800;margin:0;color:var(--ink);">À propos de quel événement ?</h3>' +
          '<span style="width:52px;"></span>' +
        '</div>' +
        '<div style="padding:0 16px 10px;">' +
          '<div style="display:flex;align-items:center;gap:8px;background:var(--tile);border-radius:12px;height:38px;padding:0 12px;">' +
            SVG.search +
            '<input id="aboutEventSearchInput" type="search" value="' + safeHtml(S.aboutEventSearch||'') + '" oninput="App.searchAboutEvents(this.value)" placeholder="Rechercher un événement (à venir ou passé)..." style="flex:1;border:none;background:transparent;font-size:13px;color:var(--ink);outline:none;">' +
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
        return '<div style="position:relative;margin-bottom:12px;border-radius:20px;overflow:hidden;background:#000;">' +
          '<img src="' + safeUrl(S.pendingVideoPoster) + '" style="width:100%;max-height:300px;object-fit:contain;display:block;background:#000;" />' +
          '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.35);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">' +
            '<div style="width:26px;height:26px;border:3px solid rgba(255,255,255,0.35);border-top-color:#FFF;border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
            '<span style="font-size:12px;font-weight:700;color:#FFF;text-align:center;padding:0 16px;">' + (S.reduceVideoQuality ? 'Traitement de la vidéo (HD)…' : 'Traitement de la vidéo…') + '</span>' +
          '</div>' +
        '</div>';
      }
      return '<div style="display:flex;align-items:center;gap:10px;background:var(--tile);border-radius:16px;padding:14px;margin-bottom:12px;">' +
        '<div style="width:20px;height:20px;border:3px solid var(--line2);border-top-color:#0B5FE0;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
        '<span style="font-size:13px;font-weight:700;color:var(--ink2);">' + (S.reduceVideoQuality ? 'Traitement de la vidéo (HD)…' : 'Traitement de la vidéo…') + '</span>' +
      '</div>';
    }
    if (S.pendingMedia.length === 0) return '';

    var videoUrl = S.pendingMedia.find(function(m){ return isVideoUrl(m); });
    if (videoUrl) {
      return '<div style="position:relative;margin-bottom:12px;border-radius:20px;overflow:hidden;background:#000;">' +
        '<video src="' + safeUrl(videoUrl) + '"' + (S.pendingVideoPoster ? ' poster="' + safeUrl(S.pendingVideoPoster) + '"' : '') +
          ' controls playsinline preload="auto" onloadeddata="App.primeVideoFrame(this)" style="width:100%;max-height:300px;display:block;background:#000;"></video>' +
          '<button type="button" onclick="App.removeMedia(0)" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.65);border:none;border-radius:16px;width:44px;height:44px;color:#FFF;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:800;z-index:2;">×</button>' +
      '</div>';
    }

    // Photos : affichage empilé pleine largeur, chacune à ses proportions réelles
    // (aucun recadrage imposé), avec les boutons "Modifier" et "✕" façon Facebook.
    return '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px;">' +
      S.pendingMedia.map(function(url, i) {
        return '<div style="position:relative;border-radius:16px;overflow:hidden;background:#000;">' +
          '<img src="'+safeUrl(url)+'" style="display:block;width:100%;height:auto;max-height:420px;object-fit:contain;background:#000;">' +
          '<button type="button" onclick="App.editPendingMedia('+i+')" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.72);border:none;border-radius:12px;padding:6px 12px;color:#FFF;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;z-index:2;">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
            'Modifier' +
          '</button>' +
          '<button type="button" onclick="App.removeMedia('+i+')" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.72);border:none;border-radius:16px;width:44px;height:44px;color:#FFF;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:800;z-index:2;">×</button>' +
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
    var today = isoLocal();

    var selectedId = S.postCheckInEventId;
    if (!selectedId) return '';

    var selectedEv = selectedId ? posts.find(function(p){ return p.id === selectedId; }) : null;

    if (selectedEv) {
      var startTsSel = eventStartTimestamp(selectedEv);
      var delay = startTsSel ? Math.round((now - startTsSel) / 60000) : 0;
      var stars = starsForDelay(delay);
      var col = stars >= 4 ? '#0E9F6E' : stars >= 2 ? '#D98A0B' : '#D92D20';
      return '<div style="background:var(--ok-soft);border:1px solid var(--ok-line);border-radius:16px;padding:12px 14px;margin-bottom:10px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">' +
          '<span style="font-size:13px;font-weight:800;color:var(--ok-ink);min-width:0;overflow-wrap:anywhere;">Arrivée : ' + safeHtml(selectedEv.eventTitle || 'Événement') + '</span>' +
          '<button type="button" onclick="App.clearCheckInEvent()" style="background:none;border:none;color:#D92D20;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Retirer</button>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--muted);line-height:1.45;">' +
          'En publiant maintenant : <b style="color:' + col + ';">' + (stars>0?'+':'') + stars + '★</b> de ponctualité' +
          (delay > 0 ? ' (retard de ' + delay + ' min)' : ' (à l\'heure)') + '.' +
        '</div>' +
        '<div style="font-size:11px;color:var(--faint);line-height:1.4;margin-top:6px;">Ta position sera relevée et visible de tous. Elle ne pourra plus être retirée.</div>' +
      '</div>';
    }

    // Pas de pointage proposé d'office ici : il fait doublon avec « Je suis
    // arrivé » (accueil, Planning). Le bloc ci-dessus n'apparaît que si le
    // membre a choisi « Pointer avec une photo ».
    return '';
  }

  function renderCreateModal(u) {
    var previewHtml = renderComposerMediaPreview();

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:var(--lien);width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+jsArg(h)+'\')" style="display:inline-flex;align-items:center;min-height:36px;background:#0B5FE0;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeCreate()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:32px;border-top-right-radius:32px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeCreate()">' +
          '<div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 12px;">' +
          '<span onclick="App.closeCreate()" style="font-size:15px;color:var(--muted);cursor:pointer;font-weight:700;padding:8px 4px;">Annuler</span>' +
          '<h3 style="font-family:' + UI.fontDisplay + ';font-size:17px;font-weight:800;margin:0;color:var(--ink);letter-spacing:-0.3px;">Nouvelle publication</h3>' +
          '<button type="submit" form="createPostForm" style="font-size:15px;color:#FFF;font-weight:800;background:#0B5FE0;border:none;border-radius:20px;padding:8px 18px;cursor:pointer;">Publier</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:4px 16px 16px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
            ((u && u.avatar_url)
              ? '<img src="' + safeUrl(u.avatar_url) + '" style="width:42px;height:42px;border-radius:20px;object-fit:cover;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,0.12);" />'
              : '<div style="width:42px;height:42px;border-radius:20px;background:linear-gradient(135deg,' + couleurSure((u||{}).avatar_color) + ',#0B5FE0);color:#FFF;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,0.12);">' + ((u&&u.prenom||'M').charAt(0)) + '</div>') +
            '<div>' +
              '<div style="font-size:15px;font-weight:800;color:var(--ink);">' + safeHtml((u&&u.prenom||'') + ' ' + (u&&u.nom||'')) + '</div>' +
              '<div style="font-size:12px;color:var(--lien);font-weight:700;background:var(--accent-soft);display:inline-block;padding:2px 8px;border-radius:8px;margin-top:2px;">' + secNom((u&&u.section_id)||'cadrage') + ' · Tape # pour les hashtags</div>' +
            '</div>' +
          '</div>' +

          // Publication ou événement : les responsables créent un événement
          // d'ici aussi, sans passer par le Planning.
          ((u && (u.role === 'RESP_SECTION' || u.role === 'GRAND_RESPONSABLE'))
            ? '<div role="tablist" aria-label="Type de publication" style="display:flex;gap:4px;background:var(--tile);border-radius:999px;padding:4px;margin-bottom:14px;">' +
                '<button type="button" role="tab" aria-selected="true" style="flex:1;min-height:40px;border:none;border-radius:999px;background:var(--card);box-shadow:' + UI.sh2 + ';font-size:13px;font-weight:800;color:var(--ink);cursor:default;display:flex;align-items:center;justify-content:center;gap:6px;">' + ico('pencil', 15, 'currentColor') + 'Publication</button>' +
                '<button type="button" role="tab" aria-selected="false" onclick="App.passerEnEvenement()" style="flex:1;min-height:40px;border:none;border-radius:999px;background:transparent;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">' + ico('calendar', 15, 'currentColor') + 'Événement</button>' +
              '</div>'
            : '') +

          // Le pointage passe en tête du formulaire : quand on est de service,
          // c'est l'action la plus urgente, elle ne doit pas être enfouie tout en bas.
          renderCheckInBlock() +

          hashHtml +
          '<div id="mentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:10px;margin-bottom:12px;"></div>' +
          previewHtml +

          // Color preview or plain textarea — hauteur généreuse et garantie, tout le
          // reste (options, footer) défile désormais avec elle dans le même conteneur.
          (S.pendingMedia.length === 0 && S.postBg
            ? '<div id="bgPreviewZone" style="border-radius:20px;overflow:hidden;margin-bottom:14px;position:relative;min-height:180px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,0.14);' + (S.postBg.startsWith('url') ? 'background:' + safeHtml(S.postBg) + ';background-size:cover;background-position:center;' : 'background:' + safeHtml(S.postBg) + ';') + '">' +
                (S.postBg && !S.postBg.includes('linear-gradient') && !S.postBg.includes('url') ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.18);border-radius:20px;"></div>' : '') +
                '<textarea id="newPostText" oninput="App.onPostInput(this.value)" placeholder="Quoi de neuf ?" style="width:100%;min-height:180px;border:none;background:transparent;font-size:28px;font-weight:800;line-height:1.4;color:#FFF;resize:none;outline:none;box-sizing:border-box;font-family:inherit;text-align:center;padding:24px 20px;text-shadow:0 2px 12px rgba(0,0,0,0.3);position:relative;z-index:1;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</div>'
            : '<form id="createPostForm" onsubmit="App.submitPost(event)">' +
                '<textarea id="newPostText" oninput="App.onPostInput(this.value)" placeholder="Quoi de neuf ? Tape # pour ajouter un hashtag de pôle" style="width:100%;min-height:140px;border:none;background:transparent;font-size:15px;line-height:1.55;color:var(--ink);resize:none;outline:none;box-sizing:border-box;font-family:inherit;">' + safeHtml(S.postText||'') + '</textarea>' +
              '</form>'
          ) +
          (S.postBg ? '<form id="createPostForm" onsubmit="App.submitPost(event)" style="display:none;"></form>' : '') +

          // Aperçu du lien collé
          (S.linkPreviewLoading
            ? '<div style="display:flex;align-items:center;gap:9px;border:0.5px solid ' + UI.line2 + ';border-radius:' + UI.r1 + ';padding:12px;margin-bottom:12px;color:' + UI.faint + ';font-size:13px;">' +
                '<div style="width:15px;height:15px;border:2px solid ' + UI.line2 + ';border-top-color:' + UI.accent + ';border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></div>' +
                'Chargement de l\'aperçu du lien…' +
              '</div>'
            : (S.linkPreview
                ? '<div style="position:relative;margin-bottom:12px;">' +
                    renderLinkPreviewCard(S.linkPreview, { compact: true, noLink: true }) +
                    '<button type="button" onclick="App.dismissLinkPreview()" title="Retirer l\'aperçu" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:44px;height:44px;color:#FFF;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">×</button>' +
                  '</div>'
                : '')) +

          // Options repliées par défaut : pour poster un texte ou une photo, il n'y
          // a rien d'autre à comprendre. Elles s'ouvrent seules si l'une d'elles est
          // déjà utilisée. Repliées, elles restent dans la page (display:none) : la
          // publication lit toujours leurs champs (programmation, éphémère).
          (function(){
            var utilisees = S.postVisibility === 'sections' || !!S.postAboutEventId || !!S.pollOpen;
            var ouvert = !!S.createOptionsOpen || utilisees;
            return '<button type="button" onclick="App.basculerOptionsPublication()" aria-expanded="' + ouvert + '" style="display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;background:var(--tile);border:none;border-radius:999px;padding:10px 14px;margin-bottom:10px;font-size:13px;font-weight:700;color:var(--ink);cursor:pointer;">' +
              '<span style="text-align:left;">' + (ouvert ? 'Moins d\'options' : 'Plus d\'options') + ' <span style="font-weight:500;color:var(--faint);">· visibilité, programmation, événement, sondage</span></span>' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform 0.2s;transform:rotate(' + (ouvert ? '180' : '0') + 'deg);"><path d="M6 9l6 6 6-6"/></svg>' +
            '</button>' +
            '<div class="kc-options" style="display:' + (ouvert ? 'block' : 'none') + ';">';
          })() +
          // Qui peut voir
          '<div style="background:var(--tile);border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
              '<span style="font-size:13px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:12px;background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;font-size:13px;">' + ico('lock', 14, UI.lien) + '</span>Qui peut voir ?</span>' +
            '</div>' +
            '<div style="display:flex;gap:4px;background:var(--line2);border-radius:16px;padding:3px;">' +
              '<button type="button" onclick="App.setPostVisibility(\'all\')" style="flex:1;padding:8px 6px;border-radius:999px;font-size:12px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + ((S.postVisibility||'all')==='all'?'#FFFFFF':'transparent') + ';color:' + ((S.postVisibility||'all')==='all'?'#0B5FE0':'var(--muted)') + ';box-shadow:' + ((S.postVisibility||'all')==='all'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">' + ico('globe', 14, 'currentColor') + ' Tout le monde</button>' +
              '<button type="button" onclick="App.setPostVisibility(\'sections\')" style="flex:1;padding:8px 6px;border-radius:999px;font-size:12px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;background:' + ((S.postVisibility||'all')==='sections'?'#FFFFFF':'transparent') + ';color:' + ((S.postVisibility||'all')==='sections'?'#0B5FE0':'var(--muted)') + ';box-shadow:' + ((S.postVisibility||'all')==='sections'?'0 2px 6px rgba(0,0,0,0.08)':'none') + ';">Sections ciblées</button>' +
            '</div>' +
            (S.postVisibility === 'sections'
              ? '<div style="margin-top:10px;"><div id="targetSectionBadgesContainer">' + App.renderSectionBadges(S.postTargetSections||[], 'toggleTargetSection') + '</div></div>'
              : '') +
          '</div>' +

          // Programmer
          '<div style="background:var(--tile);border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<span style="font-size:13px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="width:26px;height:26px;border-radius:12px;background:#FFF3E5;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">' + ico('clock', 14, '#B45309') + '</span>Programmer <span style="font-weight:600;color:var(--faint);font-size:11px;">(optionnel)</span></span>' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="date" id="postScheduleDate" class="kc-champ" style="' + styleChamp() + 'flex:1;min-width:0;" />' +
              '<input type="time" id="postScheduleTime" class="kc-champ" style="' + styleChamp() + 'flex:1;min-width:0;" />' +
            '</div>' +
          '</div>' +

          // À propos
          '<div style="background:var(--tile);border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (S.postAboutEventId?'10px':'0') + ';">' +
              '<span style="font-size:13px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:12px;background:var(--accent-soft);display:inline-flex;align-items:center;justify-content:center;font-size:13px;">' + ico('calendar', 14, UI.lien) + '</span>À propos <span style="font-weight:600;color:var(--faint);font-size:11px;">(optionnel)</span></span>' +
              (S.postAboutEventId ? '<span onclick="App.clearAboutEvent()" style="color:#D92D20;font-size:12px;font-weight:700;cursor:pointer;">Retirer</span>' : '') +
            '</div>' +
            (function(){
              if (!S.postAboutEventId) {
                return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;background:var(--card);border:1px dashed var(--line);border-radius:999px;padding:10px;font-size:13px;font-weight:700;color:var(--lien);cursor:pointer;">+ Lier à un événement (ex : culte de dimanche)</button>';
              }
              var evAbout = db(SK.POSTS, []).find(function(p){ return p.id === S.postAboutEventId; });
              if (!evAbout) return '';
              var evAboutD = evAbout.eventDate ? new Date(evAbout.eventDate+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) : '';
              return '<button type="button" onclick="App.openAboutEventPicker()" style="width:100%;display:flex;align-items:center;gap:8px;background:var(--card);border-radius:999px;padding:10px;text-align:left;border:none;cursor:pointer;">' +
                ico('calendar', 16, UI.lien) +
                '<span style="flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(evAbout.eventTitle||'') + (evAboutD?' · '+evAboutD:'') + (evAbout.eventStart?' à '+safeHtml(evAbout.eventStart):'') + '</span>' +
              '</button>';
            })() +
          '</div>' +

          // Sondage
          '<div style="background:var(--tile);border-radius:20px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (S.pollOpen?'10px':'0') + ';">' +
              '<span style="font-size:13px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:8px;"><span style="width:26px;height:26px;border-radius:12px;background:#E6F9F0;display:inline-flex;align-items:center;justify-content:center;font-size:13px;">' + ico('chart', 14, '#047857') + '</span>Sondage <span style="font-weight:600;color:var(--faint);font-size:11px;">(optionnel)</span></span>' +
              (S.pollOpen ? '<span onclick="App.togglePoll()" style="color:#D92D20;font-size:12px;font-weight:700;cursor:pointer;">Retirer</span>' : '') +
            '</div>' +
            (S.pollOpen
              ? (
                  '<input type="text" value="' + safeHtml(S.pollQuestion||'') + '" oninput="App.setPollQuestion(this.value)" placeholder="Pose ta question…" maxlength="140" class="kc-champ" style="' + styleChamp() + 'margin-bottom:8px;" />' +
                  (S.pollOptions||[]).map(function(opt, idx) {
                    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">' +
                      '<input type="text" value="' + safeHtml(opt||'') + '" oninput="App.setPollOption(' + idx + ', this.value)" placeholder="Option ' + (idx+1) + '" maxlength="60" class="kc-champ" style="' + styleChamp() + 'flex:1;min-width:0;" />' +
                      (S.pollOptions.length > 2 ? '<button type="button" onclick="App.removePollOption(' + idx + ')" style="width:44px;height:44px;flex-shrink:0;margin:-6px -6px -6px 0;border-radius:12px;border:none;background:#FFF0EF;color:#D92D20;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>' : '') +
                    '</div>';
                  }).join('') +
                  (S.pollOptions.length < 5
                    ? '<button type="button" onclick="App.addPollOption()" style="background:var(--card);border:1px dashed var(--line);border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;color:var(--lien);cursor:pointer;width:100%;margin-top:2px;">+ Ajouter une option</button>'
                    : '') +
                  '<div style="font-size:11px;color:var(--faint);line-height:1.4;margin-top:6px;">Une seule réponse par membre. Question et au moins 2 options requises.</div>'
                )
              : '<button type="button" onclick="App.togglePoll()" style="width:100%;background:var(--card);border:1px dashed var(--line);border-radius:999px;padding:10px;font-size:13px;font-weight:700;color:var(--ok-ink);cursor:pointer;">+ Ajouter un sondage</button>'
            ) +
          '</div>' +

          // Éphémère
          '<div style="background:var(--tile);border-radius:20px;padding:14px;box-shadow:0 1px 2px rgba(16,24,40,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="width:26px;height:26px;border-radius:12px;background:#FFEDE0;display:inline-flex;align-items:center;justify-content:center;font-size:15px;">' + ico('clock', 15, '#B45309') + '</span>' +
                '<div>' +
                  '<div style="font-size:13px;font-weight:800;color:var(--ink);">Publication éphémère</div>' +
                  '<div style="font-size:11px;color:var(--faint);">Disparaît automatiquement après 24h</div>' +
                '</div>' +
              '</div>' +
              '<label style="position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0;">' +
                '<input type="checkbox" id="postEphemeral" style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'var(--warn)\':\'var(--line2)\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';"/>' +
                '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:var(--line2);transition:.25s;border-radius:28px;">' +
                  '<span style="position:absolute;content:\'\';height:22px;width:22px;left:3px;bottom:3px;background-color:white;transition:.25s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>' +
                '</span>' +
              '</label>' +
            '</div>' +
          '</div>' +
          '</div>' +   // fin des options repliables
        '</div>' +

        '<div style="padding:10px 16px 14px;border-top:0.5px solid var(--tile);flex-shrink:0;">' +
          // Color palette row
          (S.pendingMedia.length === 0
            ? '<div style="display:flex;gap:8px;align-items:center;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none;">' +
                '<span style="font-size:11px;font-weight:700;color:var(--faint);flex-shrink:0;">Fond</span>' +
                // "No color" option
                '<div onclick="App.setPostBg(null)" style="width:30px;height:30px;border-radius:16px;background:var(--card);border:2px solid ' + (S.postBg===null?'#0B5FE0':'var(--line)') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:700;color:var(--ink2);">Aa</div>' +
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
                  return '<div onclick="App.setPostBgIdx(' + idx + ')" style="width:30px;height:30px;border-radius:16px;background:' + bg + ';cursor:pointer;flex-shrink:0;border:2.5px solid ' + (isSel?'#FFF':'transparent') + ';box-shadow:' + (isSel?'0 0 0 2px #0B5FE0':'0 1px 3px rgba(0,0,0,0.15)') + ';transition:0.15s;"></div>';
                }).join('') +
              '</div>'
            : ''
          ) +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--lien);font-size:13px;font-weight:800;background:var(--accent-soft);padding:9px 14px;border-radius:16px;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5FE0" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
              'Photo / Vidéo' +
              '<input type="file" accept="image/*,video/*" multiple onchange="App.addMedia(event)" style="display:none;">' +
            '</label>' +
            '<span style="font-size:12px;color:var(--faint);font-weight:600;">' + (S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? '1 vidéo' : S.pendingMedia.length + '/10 photos') + '</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;font-size:12px;color:var(--muted);font-weight:600;line-height:1.4;background:var(--tile);padding:10px 12px;border-radius:16px;"><input type="checkbox" ' + (S.reduceVideoQuality?'checked':'') + ' onchange="App.toggleReduceVideoQuality()" style="width:17px;height:17px;flex-shrink:0;accent-color:#0B5FE0;"> ' + ico('video', 14, 'currentColor') + ' Nous réduisons la qualité vidéo en HD pour une expérience plus fluide</label>' +
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
      listHtml = '<div style="text-align:center;padding:40px 20px;color:var(--faint);">' +
        '<div style="margin-bottom:10px;display:flex;justify-content:center;">' + ico('eye', 36, UI.faint, 1.6) + '</div>' +
        '<div style="font-size:15px;font-weight:800;color:var(--ink);">Aucune vue pour l\'instant</div>' +
        '<div style="font-size:13px;margin-top:4px;">Les membres qui verront cette publication apparaîtront ici.</div>' +
      '</div>';
    } else {
      listHtml = ids.map(function(uid) {
        var vu = users.find(function(x){ return x.id === uid; });
        var nom = vu ? ((vu.prenom||'') + ' ' + (vu.nom||'')).trim() : 'Membre';
        var initial = (vu && vu.prenom ? vu.prenom.charAt(0) : 'M').toUpperCase();
        var color = couleurSure(vu && vu.avatar_color);
        var avatarNode = (vu && vu.avatar_url)
          ? '<img src="' + safeUrl(vu.avatar_url) + '" style="width:40px;height:40px;border-radius:20px;object-fit:cover;flex-shrink:0;" />'
          : '<div style="width:40px;height:40px;border-radius:20px;background:' + color + ';color:#FFF;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + initial + '</div>';
        var secs = getUserSections(vu);
        var secLabel = secs.length > 0 ? secs.map(function(s){ return secNom(s); }).join(' · ') : '';
        return '<div onclick="App.closeViewers();App.openUserProfile(\'' + jsArg(uid) + '\')" style="display:flex;align-items:center;gap:12px;padding:10px 4px;cursor:pointer;">' +
          avatarNode +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:15px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(nom) + '</div>' +
            (secLabel ? '<div style="font-size:12px;color:var(--faint);margin-top:1px;">' + safeHtml(secLabel) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    return '<div onclick="App.closeViewers()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10001;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;max-height:78vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;" onclick="App.closeViewers()">' +
          '<div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div>' +
        '</div>' +
        '<div style="text-align:center;padding-bottom:12px;border-bottom:0.5px solid var(--tile);">' +
          '<h3 style="font-size:15px;font-weight:800;margin:0;color:var(--ink);">Vues</h3>' +
          '<p style="font-size:12px;color:var(--faint);margin:2px 0 0;">' + ids.length + ' membre' + (ids.length>1?'s':'') + ' ' + (ids.length>1?'ont':'a') + ' vu cette publication</p>' +
        '</div>' +
        '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 16px 24px;">' + listHtml + '</div>' +
      '</div>' +
    '</div>';
  }
