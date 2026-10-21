// KUN COM VH — Partie 7/8 : App controller — toutes les actions (window.App)

  'use strict';
  // ============================================================
  // APP CONTROLLER — toutes les actions
  // ============================================================
  window.App = {
    renderAssignmentsList: function() {
      if (!S.eventAssignments || S.eventAssignments.length === 0) {
        return '<div style="font-size:13px;color:var(--faint);margin-bottom:12px;">Aucune assignation.</div>';
      }
      var me = S.user;
      var allU = db(SK.USERS, []);
      return '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">' +
        S.eventAssignments.map(function(a, idx) {
          var mine = canTouchAssignment(a, me, allU);
          var label = a.isSection
            ? (a.sectionEmoji ? a.sectionEmoji + ' ' : '') + safeHtml(a.sectionName || '') + ' <span style="font-size:11px;font-weight:800;color:var(--lien);background:var(--accent-soft);padding:1px 6px;border-radius:8px;">PÔLE</span>'
            : safeHtml(a.userName || '');
          var dl = a.deadline ? formatDeadline(a.deadline) : '';
          return '<div style="display:flex;align-items:center;justify-content:space-between;background:' + (a.isSection ? '#F5F5FF' : 'var(--tile)') + ';padding:8px 12px;border-radius:8px;">' +
            '<div style="display:flex;flex-direction:column;min-width:0;">' +
              '<span style="font-size:13px;font-weight:700;color:var(--ink);">' + label +
                (dl ? ' <span style="font-size:11px;font-weight:800;color:#B45309;background:#FEF3C7;padding:1px 6px;border-radius:8px;vertical-align:middle;">TÂCHE</span>' : '') +
              '</span>' +
              '<span style="font-size:12px;color:var(--faint);">' + safeHtml(a.task || '') +
                (dl ? ' · à livrer le ' + dl : '') +
              '</span>' +
            '</div>' +
            (mine
              ? '<button type="button" onclick="App.removeAssignment(' + idx + ')" style="background:none;border:none;color:#D92D20;font-size:15px;cursor:pointer;">&times;</button>'
              : '<span title="Relève d\'un autre pôle" style="font-size:11px;color:var(--line);white-space:nowrap;">🔒</span>') +
          '</div>';
        }).join('') +
      '</div>';
    },
    addAssignment: function() {
      var select = document.getElementById('assignUserSelect');
      var taskInput = document.getElementById('assignTaskInput');
      if (!select || !select.value || !taskInput || !taskInput.value.trim()) {
        toast('Choisissez un membre (ou un pôle) et indiquez la tâche.', 'error');
        return;
      }
      var task = taskInput.value.trim();
      // Deadline optionnelle : si renseignée, l'assignation devient une TÂCHE À
      // LIVRER (notée quand le membre coche « fait ») plutôt qu'une simple présence.
      var deadlineInput = document.getElementById('assignDeadlineInput');
      var deadline = (deadlineInput && deadlineInput.value) ? deadlineInput.value : '';
      S.eventAssignments = S.eventAssignments || [];

      // Valeur "sec:<id>" = tâche confiée à un pôle entier (Admin).
      if (select.value.indexOf('sec:') === 0) {
        if (!isGrandResponsable(S.user)) { toast('Seul le Admin peut assigner un pôle entier.', 'error'); return; }
        var secId = select.value.slice(4);
        var sec = SECTIONS.find(function(s){ return s.id === secId; });
        if (!sec) return;
        if (S.eventAssignments.some(function(a){ return a.isSection && a.sectionId === secId && a.task === task; })) {
          toast('Cette tâche est déjà confiée à ce pôle.', 'info'); return;
        }
        S.eventAssignments.push({
          isSection: true,
          sectionId: sec.id,
          sectionName: sec.nom,
          sectionEmoji: sec.emoji,
          task: task,
          deadline: deadline
        });
      } else {
        var allU = db(SK.USERS, []);
        var u = allU.find(function(user){ return user.id === select.value; });
        if (!u) return;
        // Un responsable de section ne peut assigner que ses propres membres.
        if (!isGrandResponsable(S.user)) {
          var allowed = assignableMembers(S.user, allU).some(function(x){ return x.id === u.id; });
          if (!allowed) { toast('Vous ne pouvez assigner que les membres de votre pôle.', 'error'); return; }
        }
        var uSecs = getUserSections(u);
        var mineSecs = assignableSectionIds(S.user);
        var owningSec = uSecs.find(function(s){ return mineSecs.indexOf(s) !== -1; }) || uSecs[0] || null;
        S.eventAssignments.push({
          userId: u.id,
          userName: u.prenom + ' ' + u.nom,
          sectionId: owningSec,
          task: task,
          deadline: deadline
        });
      }
      select.value = '';
      taskInput.value = '';
      if (deadlineInput) deadlineInput.value = '';
      var container = document.getElementById('eventAssignmentsList');
      if (container) container.innerHTML = App.renderAssignmentsList();
      else render();
    },
    removeAssignment: function(idx) {
      if (!S.eventAssignments) return;
      var a = S.eventAssignments[idx];
      if (!canTouchAssignment(a, S.user, db(SK.USERS, []))) {
        toast('Cette assignation relève d\'un autre pôle.', 'error');
        return;
      }
      S.eventAssignments.splice(idx, 1);
      var container = document.getElementById('eventAssignmentsList');
      if (container) container.innerHTML = App.renderAssignmentsList();
      else render();
    },
    // ============================================================
    // GESTION DES ASSIGNATIONS SUR UN ÉVÉNEMENT EXISTANT
    // ============================================================
    // Permet à un responsable de section de désigner qui est de service dans SON
    // pôle sur un événement créé par quelqu'un d'autre (le Admin en
    // général), sans lui donner le droit de modifier l'événement lui-même.
    openAssignManager: function(postId) {
      var post = db(SK.POSTS, []).find(function(p){ return p.id === postId; });
      if (!post) { toast('Événement introuvable.', 'error'); return; }
      if (!canManageEventAssignments(post, S.user)) {
        toast('Vous n\'avez pas le droit d\'assigner sur cet événement.', 'error');
        return;
      }
      S.optionsOpen = false; S.optionsPost = null; S.postOptionsOpen = false;
      S.assignManagerId = postId;
      S.eventAssignments = (post.assignments || []).slice();
      render();
    },
    closeAssignManager: function() {
      S.assignManagerId = null;
      S.eventAssignments = [];
      render();
    },
    saveAssignManager: async function(btn) {
      var postId = S.assignManagerId;
      if (!postId) return;
      var posts = db(SK.POSTS, []);
      var idx = posts.findIndex(function(p){ return p.id === postId; });
      if (idx === -1) { toast('Événement introuvable.', 'error'); return; }
      var post = posts[idx];
      if (!canManageEventAssignments(post, S.user)) {
        toast('Vous n\'avez pas le droit d\'assigner sur cet événement.', 'error');
        return;
      }
      if (btn) { btn.textContent = 'Enregistrement…'; btn.disabled = true; }

      var allU = db(SK.USERS, []);
      // Fusion prudente : on ne réécrit QUE les assignations qui relèvent de
      // l'utilisateur. Celles des autres pôles sont reprises telles quelles, pour
      // éviter qu'un responsable n'efface le travail d'un autre en enregistrant.
      var others = (post.assignments || []).filter(function(a){ return !canTouchAssignment(a, S.user, allU); });
      var mine = (S.eventAssignments || []).filter(function(a){ return canTouchAssignment(a, S.user, allU); });
      var merged = others.concat(mine);

      var before = (post.assignments || []).map(function(a){ return a.userId || ('sec:'+a.sectionId); });
      var updated = Object.assign({}, post, { assignments: merged, assignmentsUpdatedAt: Date.now() });
      posts[idx] = updated;
      dbSet(SK.POSTS, posts);
      if (supabase) {
        try { await supabase.from('kun_com_posts').upsert({ id: updated.id, content: updated }, { onConflict: 'id' }); }
        catch(e) { console.warn('Update assignations supabase error:', e); }
      }

      // Prévient les membres nouvellement assignés (et eux seuls).
      mine.forEach(function(a) {
        if (a.isSection || !a.userId) return;
        if (before.indexOf(a.userId) !== -1) return;
        if (S.user && a.userId === S.user.id) return;
        sendNotificationToUser(a.userId, {
          type: 'EVENT_ASSIGNED',
          title: 'Service assigné',
          text: 'Vous êtes de service (' + a.task + ') pour ' + (post.eventTitle || 'un événement'),
          targetId: post.id
        });
      });

      S.assignManagerId = null;
      S.eventAssignments = [];
      render();
      toast('Assignations enregistrées ! ✅', 'success');
    },

    syncCreateEventData: function() {
      var titleEl = document.getElementById('eventTitle');
      var locEl = document.getElementById('eventLocation');
      var dateEl = document.getElementById('eventDate');
      var startEl = document.getElementById('eventStart');
      var endEl = document.getElementById('eventEnd');
      var descEl = document.getElementById('eventDesc');
      var pinnedEl = document.getElementById('eventPinned');
      var recurWeeklyEl = document.getElementById('eventRecurWeekly');
      var recurWeeksEl = document.getElementById('eventRecurWeeks');
      if (titleEl || locEl || descEl) {
        var prev = S.createEventData || {};
        S.createEventData = {
          title: titleEl ? titleEl.value : (prev.title || ''),
          location: locEl ? locEl.value : (prev.location || ''),
          date: dateEl ? dateEl.value : (prev.date || ''),
          start: startEl ? startEl.value : (prev.start || ''),
          end: endEl ? endEl.value : (prev.end || ''),
          desc: descEl ? descEl.value : (prev.desc || ''),
          pinned: pinnedEl ? pinnedEl.checked : !!prev.pinned,
          recurWeekly: recurWeeklyEl ? recurWeeklyEl.checked : !!prev.recurWeekly,
          recurWeeks: recurWeeksEl ? (parseInt(recurWeeksEl.value, 10) || 8) : (prev.recurWeeks || 8),
          // Coordonnées du lieu : pas de champ de saisie, elles viennent de la
          // recherche d'adresse — on les reporte telles quelles.
          lat: prev.lat,
          lng: prev.lng,
          accuracy: prev.accuracy,
          placeName: prev.placeName,
          placeLabel: prev.placeLabel
        };
      }
    },
    // Recherche du lieu par son nom ou son adresse. On ne relève JAMAIS la position
    // du créateur : il prépare généralement l'événement à l'avance depuis chez lui,
    // sa position n'a donc aucun rapport avec le lieu de l'événement.
    onEventPlaceInput: function(val) {
      S.eventPlaceQuery = val;
      S.eventPlaceError = null;
      if (App._placeTimer) clearTimeout(App._placeTimer);
      if (!val || val.trim().length < 3) {
        S.eventPlaceResults = [];
        var box0 = document.getElementById('eventPlaceResults');
        if (box0) box0.innerHTML = '';
        return;
      }
      App._placeTimer = setTimeout(function(){ App.searchEventPlace(); }, 600);
    },
    searchEventPlace: async function() {
      var q = (S.eventPlaceQuery || '').trim();
      if (q.length < 3) return;
      App.syncCreateEventData();
      S.eventPlaceSearching = true;
      S.eventPlaceError = null;
      render();
      App._refocusPlaceInput();
      try {
        // countrycodes=ci : la recherche ne renvoie que des lieux ivoiriens.
        var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=1'
                + '&countrycodes=' + COUNTRY_CODE
                + '&q=' + encodeURIComponent(q);
        var res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        S.eventPlaceResults = (data || []).map(function(r) {
          return {
            label: r.display_name || q,
            shortLabel: (r.name && r.name.length ? r.name : (r.display_name || q).split(',')[0]),
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon)
          };
        }).filter(function(r) {
          // Double filet : on ne retient que ce qui tombe dans les frontières.
          return !isNaN(r.lat) && !isNaN(r.lng) && isInIvoryCoast(r.lat, r.lng);
        });
        if (S.eventPlaceResults.length === 0) S.eventPlaceError = 'Aucun lieu trouvé en Côte d\'Ivoire. Essayez avec le quartier ou la commune.';
      } catch (e) {
        console.warn('Recherche de lieu :', e);
        S.eventPlaceResults = [];
        S.eventPlaceError = 'Recherche indisponible. Vérifiez votre connexion et réessayez.';
      }
      S.eventPlaceSearching = false;
      render();
      App._refocusPlaceInput();
    },
    // Le rendu recrée le champ : sans cela le clavier se referme à chaque
    // recherche et la saisie devient impossible sur mobile.
    _refocusPlaceInput: function() {
      setTimeout(function() {
        var el = document.getElementById('eventPlaceInput');
        if (!el || document.activeElement === el) return;
        el.focus();
        try { el.setSelectionRange(el.value.length, el.value.length); } catch(e) {}
      }, 0);
    },
    selectEventPlace: function(idx) {
      var r = (S.eventPlaceResults || [])[idx];
      if (!r) return;
      App.syncCreateEventData();
      // syncCreateEventData ne crée l'objet que si les champs du formulaire sont
      // déjà dans le DOM ; on le garantit ici.
      if (!S.createEventData) S.createEventData = {};
      S.createEventData.lat = r.lat;
      S.createEventData.lng = r.lng;
      S.createEventData.placeName = r.shortLabel;
      S.createEventData.placeLabel = r.label;
      S.createEventData.accuracy = undefined;
      S.eventPlaceResults = [];
      S.eventPlaceQuery = '';
      S.eventPlaceError = null;
      render();
      toast('Lieu situé : ' + r.shortLabel + ' 📍', 'success');
    },
    clearEventPosition: function() {
      App.syncCreateEventData();
      if (!S.createEventData) S.createEventData = {};
      S.createEventData.lat = undefined;
      S.createEventData.lng = undefined;
      S.createEventData.accuracy = undefined;
      S.createEventData.placeName = undefined;
      S.createEventData.placeLabel = undefined;
      S.eventPlaceResults = [];
      S.eventPlaceQuery = '';
      render();
    },
    openCreateEvent: function() {
      S.createEventOpen = true; S.editEventId = null;
      S.eventSections = []; S.eventAssignments = []; S.createEventData = null;
      S.eventImage = null; S.eventImageProcessing = false;
      S.eventSaveChoiceOpen = false; S.eventSaveMode = null;
      render();
    },
    // Modification d'un événement : on rouvre le formulaire ÉVÉNEMENT pré-rempli,
    // et non l'éditeur de publication générique (champs sans rapport : fond coloré,
    // éphémère, médias multiples...).
    openEditEvent: function(postId) {
      var post = db(SK.POSTS, []).find(function(p){ return p.id === postId; });
      if (!post) { toast('Événement introuvable.', 'error'); return; }
      S.optionsOpen = false; S.optionsPost = null; S.postOptionsOpen = false;
      S.createEventOpen = true;
      S.editEventId = post.id;
      S.createEventData = {
        title: post.eventTitle || '',
        location: post.eventLocation || '',
        date: post.eventDate || '',
        start: post.eventStart || '',
        end: post.eventEnd || '',
        desc: post.caption || '',
        pinned: !!post.is_pinned,
        lat: typeof post.eventLat === 'number' ? post.eventLat : undefined,
        lng: typeof post.eventLng === 'number' ? post.eventLng : undefined,
        accuracy: post.eventGeoAccuracy,
        placeName: post.eventPlaceName,
        placeLabel: post.eventPlaceLabel
      };
      S.eventPlaceQuery = '';
      S.eventPlaceResults = [];
      S.eventPlaceError = null;
      S.eventSections = (post.eventSections || []).slice();
      S.eventAssignments = (post.assignments || []).slice();
      S.eventImage = post.eventImage || null;
      S.eventImageProcessing = false;
      S.eventSaveChoiceOpen = false; S.eventSaveMode = null;
      render();
    },
    closeCreateEvent: function() {
      S.createEventOpen = false; S.createEventData = null; S.editEventId = null;
      S.eventImage = null; S.eventImageProcessing = false;
      S.eventSaveChoiceOpen = false; S.eventSaveMode = null;
      render();
    },
    // --- Image d'un événement (une seule) ---
    addEventImage: function(e) {
      var file = e && e.target && e.target.files && e.target.files[0];
      if (!file || !file.type || file.type.indexOf('image/') !== 0) return;
      App.syncCreateEventData();
      S.eventImageProcessing = true;
      render();
      var reader = new FileReader();
      reader.onload = function(evt) {
        compressImage(evt.target.result, 1440, 1440, 0.82, function(dataUrl) {
          if (!dataUrl) { S.eventImageProcessing = false; render(); toast('Image illisible.', 'error'); return; }
          S.eventImage = dataUrl;          // aperçu immédiat
          S.eventImageProcessing = false;
          render();
          // Bascule vers l'URL hébergée en arrière-plan (évite le base64 en base)
          uploadMediaToStorage(dataUrl, function(hostedUrl) {
            if (hostedUrl && S.eventImage === dataUrl) S.eventImage = hostedUrl;
          });
        });
      };
      reader.onerror = function() { S.eventImageProcessing = false; render(); toast('Image illisible.', 'error'); };
      reader.readAsDataURL(file);
    },
    editEventImage: function() {
      if (!S.eventImage) return;
      App.syncCreateEventData();
      App.openCropper(S.eventImage, NaN, 'Modifier l\'image', function(croppedDataUrl) {
        compressImage(croppedDataUrl, 1440, 1440, 0.82, function(dataUrl) {
          if (!dataUrl) return;
          S.eventImage = dataUrl;
          render();
          uploadMediaToStorage(dataUrl, function(hostedUrl) {
            if (hostedUrl && S.eventImage === dataUrl) S.eventImage = hostedUrl;
          });
        });
      });
    },
    removeEventImage: function() {
      App.syncCreateEventData();
      S.eventImage = null;
      render();
    },
    // Retour immédiat à la saisie : signale une durée nulle (erreur) ou un
    // événement qui se poursuit après minuit (information, pas une erreur).
    onEventTimeChange: function() {
      var s = document.getElementById('eventStart');
      var e = document.getElementById('eventEnd');
      var err = document.getElementById('eventTimeError');
      if (!err) return;
      if (!s || !e || !s.value || !e.value) { err.style.display = 'none'; return; }
      if (e.value === s.value) {
        err.textContent = 'La fin ne peut pas être identique au début.';
        err.style.color = '#B42318';
        err.style.background = '#FEF2F2';
        err.style.display = 'block';
      } else if (e.value < s.value) {
        err.textContent = 'Se termine le lendemain à ' + e.value + '.';
        err.style.color = 'var(--lien)';
        err.style.background = 'var(--accent-soft)';
        err.style.display = 'block';
      } else {
        err.style.display = 'none';
      }
    },
    selectDate: function(d) { S.selectedDate = d; render(); },
    toggleEventSection: function(sec) {
      var idx = S.eventSections.indexOf(sec);
      if (idx !== -1) { S.eventSections.splice(idx, 1); }
      else { S.eventSections.push(sec); }
      var container = document.getElementById('eventSectionBadgesContainer');
      if (container) {
        container.innerHTML = '<div id="eventSectionBadgesContainer">' + App.renderSectionBadges(S.eventSections, 'toggleEventSection') + '</div>';
      } else {
        render();
      }
    },
    saveEvent: async function(btn) {
      var titleEl = document.getElementById('eventTitle');
      var dateEl = document.getElementById('eventDate');
      var startEl = document.getElementById('eventStart');
      var endEl = document.getElementById('eventEnd');
      var locEl = document.getElementById('eventLocation');
      var descEl = document.getElementById('eventDesc');
      var pinnedEl = document.getElementById('eventPinned');
      var title = titleEl ? titleEl.value.trim() : '';
      var date = dateEl ? dateEl.value : '';
      var start = startEl ? startEl.value : '';
      var end = endEl ? endEl.value : '';
      var loc = locEl ? locEl.value.trim() : '';
      var desc = descEl ? descEl.value.trim() : '';
      var pinned = pinnedEl ? pinnedEl.checked : false;
      if (!title || !date || !start) { toast('Titre, Date et Heure de début requis.', 'error'); return; }
      // Une fin antérieure au début signifie que l'événement se poursuit après
      // minuit (veillée). C'est légitime et désormais géré ; on refuse seulement
      // une durée nulle, qui n'a pas de sens.
      if (end && end === start) {
        toast('L\'heure de fin ne peut pas être identique à l\'heure de début.', 'error');
        return;
      }
      if (S.eventImageProcessing) { toast('L\'image est encore en cours de traitement.', 'info'); return; }

      // Attendre la fin de l'envoi de l'image vers Storage (jamais de base64 en base).
      // Le bouton passe en « Envoi du média… » le temps que Storage réponde.
      await waitForMediaUploads(btn);

      // ---- Mode MODIFICATION ----
      // Deux issues possibles : écraser l'événement existant, ou en créer un
      // nouveau en conservant l'ancien (pratique pour les événements répétitifs :
      // on rouvre le culte de dimanche dernier, on change la date, on duplique).
      // On demande à l'utilisateur, sauf s'il a déjà choisi.
      if (S.editEventId && !S.eventSaveMode) {
        // Le re-rendu ci-dessous reconstruit le formulaire à partir de
        // S.createEventData : sans cette synchronisation, les valeurs tapées
        // (date, titre, heure...) étaient perdues et l'ancienne date réapparaissait.
        S.createEventData = { title: title, location: loc, date: date, start: start, end: end, desc: desc, pinned: pinned,
          lat: (S.createEventData||{}).lat, lng: (S.createEventData||{}).lng, accuracy: (S.createEventData||{}).accuracy,
          placeName: (S.createEventData||{}).placeName, placeLabel: (S.createEventData||{}).placeLabel };
        S.eventSaveChoiceOpen = true;
        render();
        return;
      }

      // Choix « nouvel événement » : on retombe volontairement sur la branche de
      // création, en oubliant l'identifiant d'origine.
      if (S.editEventId && S.eventSaveMode === 'duplicate') {
        S.editEventId = null;
      }

      if (S.editEventId) {
        var allP = db(SK.POSTS, []);
        var idxE = allP.findIndex(function(p){ return p.id === S.editEventId; });
        if (idxE === -1) { toast('Événement introuvable.', 'error'); return; }
        if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }
        var updated = Object.assign({}, allP[idxE], {
          eventTitle: title,
          eventDate: date,
          eventStart: start,
          eventEnd: end,
          eventLocation: loc,
          eventLat: typeof (S.createEventData||{}).lat === 'number' ? S.createEventData.lat : null,
          eventLng: typeof (S.createEventData||{}).lng === 'number' ? S.createEventData.lng : null,
          eventGeoAccuracy: (S.createEventData||{}).accuracy || null,
          eventPlaceName: (S.createEventData||{}).placeName || null,
          eventPlaceLabel: (S.createEventData||{}).placeLabel || null,
          eventSections: (S.eventSections||[]).slice(),
          assignments: (S.eventAssignments||[]).slice(),
          eventImage: S.eventImage || null,
          caption: desc,
          is_pinned: pinned,
          edited: true,
          editedAt: Date.now()
        });
        allP[idxE] = updated;
        dbSet(SK.POSTS, allP);
        if (supabase) {
          try {
            await supabase.from('kun_com_posts').upsert({ id: updated.id, content: updated }, { onConflict: 'id' });
          } catch(e) { console.warn('Update event supabase error:', e); }
        }
        S.createEventOpen = false;
        S.editEventId = null;
        S.eventSaveMode = null;
        S.createEventData = null;
        S.eventImage = null;
        S.selectedDate = date;
        render();
        toast('Événement modifié ! ', 'success');
        return;
      }

      if (btn) { btn.textContent = 'Création...'; btn.disabled = true; }
      var newPost = {
        id: 'evt_' + Date.now(),
        userId: S.user.id,
        author: S.user.prenom + ' ' + S.user.nom,
        authorAvatar: (S.user.prenom||'M').charAt(0).toUpperCase(),
        avatarColor: S.user.avatar_color || '#0B5FE0',
        avatar_color: S.user.avatar_color || '#0B5FE0',
        avatar_url: S.user.avatar_url || null,
        role: S.user.role,
        type: 'EVENT',
        eventTitle: title,
        eventDate: date,
        eventStart: start,
        eventEnd: end,
        eventLocation: loc,
        eventLat: typeof (S.createEventData||{}).lat === 'number' ? S.createEventData.lat : null,
        eventLng: typeof (S.createEventData||{}).lng === 'number' ? S.createEventData.lng : null,
        eventGeoAccuracy: (S.createEventData||{}).accuracy || null,
        eventPlaceName: (S.createEventData||{}).placeName || null,
        eventPlaceLabel: (S.createEventData||{}).placeLabel || null,
        eventSections: (S.eventSections||[]).slice(),
        assignments: (S.eventAssignments||[]).slice(),
        eventImage: S.eventImage || null,
        caption: desc,
        is_pinned: pinned,
        timestamp: Date.now(),
        likedBy: [],
        comments: [],
        mediaUrls: []
      };

      // Répétition hebdomadaire : on crée d'un coup toutes les occurrences
      // (même titre/heure/lieu/assignations, date +7 jours à chaque fois) pour
      // éviter de reprogrammer chaque semaine un événement fixe (ex. les cultes).
      var recurWeeklyEl = document.getElementById('eventRecurWeekly');
      var recurWeeksEl = document.getElementById('eventRecurWeeks');
      var recurWeekly = recurWeeklyEl ? recurWeeklyEl.checked : false;
      var recurWeeks = recurWeekly ? Math.max(2, Math.min(52, parseInt(recurWeeksEl && recurWeeksEl.value, 10) || 8)) : 1;
      if (recurWeekly) newPost.recurrenceGroupId = newPost.id;
      var createdPosts = [newPost];
      for (var w = 1; w < recurWeeks; w++) {
        var occDateObj = new Date(date + 'T00:00:00');
        occDateObj.setDate(occDateObj.getDate() + w * 7);
        // Formatage en heure LOCALE : toISOString() convertit en UTC, ce qui
        // décalait chaque occurrence à la veille sur tous les fuseaux positifs
        // (Europe...) — le culte du dimanche devenait samedi.
        var occDateIso = occDateObj.getFullYear() + '-' + ('0' + (occDateObj.getMonth() + 1)).slice(-2) + '-' + ('0' + occDateObj.getDate()).slice(-2);
        createdPosts.push(Object.assign({}, newPost, {
          id: 'evt_' + (Date.now() + w),
          eventDate: occDateIso,
          timestamp: Date.now(),
          likedBy: [],
          comments: []
        }));
      }

      var allPosts = db(SK.POSTS, []);
      dbSet(SK.POSTS, createdPosts.concat(allPosts));
      // Seule l'occurrence la plus proche notifie les équipes : personne n'a
      // besoin d'être alerté d'un culte prévu dans 8 semaines.
      sendTargetedEventNotifications(newPost);
      if (supabase) {
        try {
          await supabase.from('kun_com_posts').upsert(createdPosts.map(function(p) {
            return { id: p.id, content: p, created_at: new Date().toISOString() };
          }), { onConflict: 'id' });
        } catch(e) {
          console.warn("Save event supabase error:", e);
        }
      }
      var wasDuplicate = S.eventSaveMode === 'duplicate';
      S.createEventOpen = false;
      S.eventImage = null;
      S.eventSaveMode = null;
      S.createEventData = null;
      S.selectedDate = date;
      S.tab = pinned ? 'home' : 'planning';
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast(wasDuplicate ? 'Nouvel événement créé, l\'ancien est conservé ! '
        : (recurWeekly ? recurWeeks + ' occurrences créées (chaque semaine) ! ' : 'Événement créé avec succès ! '), 'success');
    },
    // Choix proposé à l'enregistrement d'une modification.
    chooseEventSaveMode: function(mode) {
      S.eventSaveMode = mode;              // 'overwrite' | 'duplicate'
      S.eventSaveChoiceOpen = false;
      render();
      // Le formulaire est de nouveau dans le DOM : on relance l'enregistrement.
      setTimeout(function(){ App.saveEvent(null); }, 0);
    },
    cancelEventSaveChoice: function() {
      S.eventSaveChoiceOpen = false;
      S.eventSaveMode = null;
      render();
    },
    togglePin: function(postId) {
      var u = S.user || {};
      var posts = db(SK.POSTS, []);
      var p = posts.find(function(x){ return x.id === postId; });
      if (!p) { toast('Publication introuvable.', 'error'); return; }
      // Le créateur de la publication et le Admin, personne d'autre.
      if (u.role !== 'GRAND_RESPONSABLE' && p.userId !== u.id) {
        toast('Seul l\'auteur peut épingler cette publication.', 'error');
        return;
      }
      p.is_pinned = !p.is_pinned;
      dbSet(SK.POSTS, posts);
      if (supabase) supabase.from('kun_com_posts').upsert({ id: p.id, content: p }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Épingle :', e); });
      S.optionsOpen = false; S.optionsPost = null;
      render();
      toast(p.is_pinned ? 'Épinglé en haut du fil.' : 'Épingle retirée.', 'success');
    },
    
    
    toggleSignupSection: function(sec) {
      var idx = S.signupSections.indexOf(sec);
      if (idx !== -1) { S.signupSections.splice(idx, 1); }
      else {
        if (S.signupSections.length >= 2) { toast('Maximum 2 sections autorisées.', 'error'); return; }
        S.signupSections.push(sec);
      }
      var container = document.getElementById('signupSectionBadgesContainer');
      if (container) {
        container.innerHTML = App.renderSectionBadges(S.signupSections, 'toggleSignupSection');
      } else {
        render();
      }
    },
    setSignupRole: function(role) {
      S.signupRole = role;
      // Mise à jour ciblée du style (pas de render() complet pour ne pas effacer les champs déjà saisis)
      var activeStyle = 'flex:1;height:44px;border-radius:12px;border:1.5px solid #0B5FE0;background:var(--accent-soft);color:var(--lien);font-size:13px;font-weight:800;cursor:pointer;';
      var inactiveStyle = 'flex:1;height:44px;border-radius:12px;border:1.5px solid var(--line);background:var(--tile);color:var(--ink2);font-size:13px;font-weight:800;cursor:pointer;';
      var mBtn = document.getElementById('signupRoleMembre');
      var rBtn = document.getElementById('signupRoleResp');
      if (mBtn) mBtn.style.cssText = (role === 'MEMBRE') ? activeStyle : inactiveStyle;
      if (rBtn) rBtn.style.cssText = (role === 'RESP_SECTION') ? activeStyle : inactiveStyle;
    },
    toggleEditSection: function(sec) {
      var idx = S.editSections.indexOf(sec);
      if (idx !== -1) { S.editSections.splice(idx, 1); }
      else {
        if (S.editSections.length >= 2) { toast('Maximum 2 sections autorisées.', 'error'); return; }
        S.editSections.push(sec);
      }
      var container = document.getElementById('editSectionBadgesContainer');
      if (container) {
        container.innerHTML = '<div id="editSectionBadgesContainer">' + App.renderSectionBadges(S.editSections, 'toggleEditSection') + '</div>';
      } else {
        render();
      }
    },
    renderSectionBadges: function(selected, toggleFnName) {
      var sections = [
        {id:'cadrage', label:'Cadrage', icon:'🎥'},
        {id:'regie', label:'Régie', icon:'🎛️'},
        {id:'web', label:'Web', icon:'🌐'},
        {id:'proj', label:'Projection', icon:'🖥️'},
        {id:'prod', label:'Prod', icon:'🎬'},
        {id:'photo', label:'Photo', icon:'📷'},
        {id:'vente', label:'Vente', icon:'🛒'}
      ];
      var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
      sections.forEach(function(s) {
        var isSel = selected.indexOf(s.id) !== -1;
        var bg = isSel ? '#0B5FE0' : 'var(--tile)';
        var color = isSel ? '#FFF' : 'var(--ink2)';
        html += '<div onclick="App.' + toggleFnName + '(\'' + jsArg(s.id) + '\')" style="background:' + bg + ';color:' + color + ';padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;transition:0.2s;">' + s.icon + ' ' + s.label + '</div>';
      });
      html += '</div>';
      return html;
    },
    // Étape 1 : on récupère les questions de sécurité du compte (via l'Edge
    // Function, seule habilitée à lire la table fermée des secrets).
    checkForgotEmail: async function(e) {
      e && e.preventDefault();
      // Récupération au NUMÉRO (clé de recherche = chiffres canoniques).
      var phone = normalizePhone(((document.getElementById('forgotPhone')||{}).value||'').trim());
      if (!phone) { toast('Veuillez saisir votre numéro de téléphone.', 'error'); return; }
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      try {
        var res = await supabase.functions.invoke('password-recovery', { body: { action: 'questions', email: phone } });
        var data = res && res.data;
        if (!data || !data.found) {
          toast('Aucune question de sécurité pour ce numéro. Demandez à un Admin de réinitialiser votre mot de passe.', 'error');
          return;
        }
        if (data.locked) { toast('Trop de tentatives récentes. Réessayez dans quelques minutes.', 'error'); return; }
        S.forgotUser = { phone: phone, sec_q1: data.q1, sec_q2: data.q2 };
        render();
      } catch(err) {
        console.warn('forgot questions error:', err);
        toast('Impossible de récupérer vos questions. Réessayez.', 'error');
      }
    },
    // Étape 2 : on envoie les réponses + le nouveau mot de passe. L'Edge Function
    // vérifie les réponses (hachées) et, si elles correspondent, change le mot de
    // passe via l'API admin. Le navigateur ne voit jamais les hachés.
    resetPassword: async function(e) {
      e && e.preventDefault();
      if (!S.forgotUser) { S.auth = 'login'; render(); return; }
      var a1 = ((document.getElementById('forgotA1')||{}).value||'').trim();
      var a2 = ((document.getElementById('forgotA2')||{}).value||'').trim();
      var pwd = ((document.getElementById('forgotPwd')||{}).value||'').trim();
      if (!a1 || !a2) { toast('Répondez aux deux questions.', 'error'); return; }
      if (pwd.length < 8) { toast('Le mot de passe doit contenir au moins 8 caractères.', 'error'); return; }
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      try {
        var res = await supabase.functions.invoke('password-recovery', {
          body: { action: 'reset', email: S.forgotUser.phone, a1: a1, a2: a2, newPassword: pwd }
        });
        // invoke() renvoie une erreur JS pour tout statut != 2xx : on lit le message.
        if (res && res.error) {
          var msg = 'Réponses incorrectes.';
          try { msg = (await res.error.context.json()).error || msg; } catch(_) {}
          toast(msg, 'error');
          return;
        }
        if (!res || !res.data || !res.data.ok) { toast('Réponses incorrectes.', 'error'); return; }
        toast('Mot de passe réinitialisé ! Connectez-vous avec le nouveau.', 'success');
        // Purge les champs sensibles restés dans l'état (mot de passe fraîchement
        // utilisé, réponses aux questions) — même hygiène que login/signup.
        S.champsAuth = {};
        S.forgotUser = null; S.auth = 'login'; render();
      } catch(err) {
        console.warn('reset password error:', err);
        toast('Réinitialisation impossible. Vérifiez vos réponses.', 'error');
      }
    },
    // (Ancienne définition dupliquée de toggleParticipation supprimée : la clé
    // existait DEUX fois dans ce littéral objet — la seconde, complète,
    // écrasait silencieusement la première. Risque : corriger un jour la
    // mauvaise copie.)

    // Détail d'une métrique RH (fenêtre encore présente dans le code, sa fermeture
    // n'était reliée à rien : le panneau serait resté bloqué à l'écran).

    // Participation à un événement depuis le Planning. La liste des participants
    // est stockée dans ev.likedBy (c'est elle qu'affiche le compteur de la fiche).
    // Participation sur une fiche d'événement à l'ANCIEN format, qui stocke les
    // réponses dans metadata.participations ('yes' / 'no') au lieu de likedBy.
    // Ces boutons appelaient une méthode inexistante : ils ne faisaient rien.
    toggleParticipation: function(eventId, reponse) {
      if (!S.user) { toast('Vous devez être connecté.', 'error'); return; }
      var posts = db(SK.POSTS, []);
      var ev = posts.find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
      if (!ev) { toast('Événement introuvable.', 'error'); return; }
      if (!ev.metadata) ev.metadata = {};
      if (!ev.metadata.participations) ev.metadata.participations = {};

      var actuel = ev.metadata.participations[S.user.id];
      // Retoucher le même bouton annule la réponse : on peut se raviser.
      var nouvelleValeur;
      if (actuel === reponse) { delete ev.metadata.participations[S.user.id]; nouvelleValeur = null; }
      else { ev.metadata.participations[S.user.id] = reponse; nouvelleValeur = reponse; }

      dbSet(SK.POSTS, posts);
      // Écriture serveur via relecture fraîche (même raisonnement que like/submitComment).
      App.ecrirePostFrais(ev.id, function(frais) {
        if (!frais.metadata) frais.metadata = {};
        if (!frais.metadata.participations) frais.metadata.participations = {};
        if (nouvelleValeur === null) delete frais.metadata.participations[S.user.id];
        else frais.metadata.participations[S.user.id] = nouvelleValeur;
      });
      var nouveau = nouvelleValeur; // pour la notification et le toast ci-dessous
      if (nouveau === 'yes' && ev.userId && ev.userId !== S.user.id) {
        sendNotificationToUser(ev.userId, {
          type: 'EVENT_PARTICIPATION',
          title: 'Nouvelle participation',
          text: (S.user.prenom || 'Quelqu\'un') + ' participera à « ' + ((ev.metadata && ev.metadata.title) || ev.eventTitle || 'votre événement') + ' ».',
          targetId: ev.id
        });
      }
      render();
      toast(nouveau === 'yes' ? 'Participation confirmée.' : nouveau === 'no' ? 'Indisponibilité enregistrée.' : 'Réponse retirée.', 'success');
    },

    // ---- Mes indisponibilités (lot 2) ----
    // Planning : défile jusqu'aux services d'un jour de la frise.
    allerAuJour: function(iso) {
      var el = document.getElementById('jour-' + iso);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else toast('Aucun service ce jour-là.', 'info');
    },
    filtrerPlanning: function(mode) { S.planningFiltre = mode === 'miens' ? 'miens' : 'tous'; render(); },
    ouvrirIndispos: function() { S.indisposOpen = true; render(); },
    fermerIndispos: function() { S.indisposOpen = false; render(); },
    ajouterIndispo: function() {
      if (!S.user) return;
      var date = ((document.getElementById('indispoDate') || {}).value || '').trim();
      var motif = ((document.getElementById('indispoMotif') || {}).value || '').trim().slice(0, 80);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Choisis une date.', 'error'); return; }
      var auj = new Date().toISOString().split('T')[0];
      if (date < auj) { toast('Cette date est déjà passée.', 'error'); return; }
      // Les dates passées sont retirées au passage : la liste reste courte.
      var liste = (S.user.indisponibilites || []).filter(function(x){ return x && x.date >= auj && x.date !== date; });
      liste.push({ date: date, motif: motif });
      App._majMonProfil({ indisponibilites: liste });
      toast('Indisponibilité enregistrée.', 'success');
    },
    retirerIndispo: function(date) {
      if (!S.user) return;
      App._majMonProfil({ indisponibilites: (S.user.indisponibilites || []).filter(function(x){ return x && x.date !== date; }) });
    },

    // ---- Réponse à une convocation (lot 2) ----
    ouvrirDecliner: function(eventId) {
      S.declinerEvId = eventId;
      render();
      setTimeout(function(){ var i = document.getElementById('motifDecline'); if (i) i.focus(); }, 80);
    },
    annulerDecliner: function() { S.declinerEvId = null; render(); },
    repondreConvocation: function(eventId, statut) {
      if (!S.user) return;
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
      if (!ev) { toast('Événement introuvable.', 'error'); return; }
      var motif = '';
      if (statut === 'decline') {
        motif = ((document.getElementById('motifDecline') || {}).value || '').trim().slice(0, 120);
        if (!motif) { toast('Indique en quelques mots pourquoi tu ne peux pas venir.', 'error'); return; }
      }
      var reponse = { statut: statut, motif: motif, le: Date.now() };
      var uid = S.user.id;
      // Affichage immédiat, puis écriture fusionnée côté serveur.
      var posts = db(SK.POSTS, []);
      var local = posts.find(function(p){ return p.id === eventId; });
      if (local) { local.reponsesConvocation = Object.assign({}, local.reponsesConvocation || {}); local.reponsesConvocation[uid] = reponse; dbSet(SK.POSTS, posts); }
      S.declinerEvId = null;
      render();
      App.ecrirePostFrais(eventId, function(frais) {
        frais.reponsesConvocation = Object.assign({}, frais.reponsesConvocation || {});
        frais.reponsesConvocation[uid] = reponse;
      });
      // L'organisateur est prévenu d'un désistement (une confirmation ne
      // mérite pas de notification : elle se lit dans la fiche).
      if (statut === 'decline' && ev.userId && ev.userId !== uid) {
        sendNotificationToUser(ev.userId, {
          type: 'CONVOCATION', title: 'Indisponible',
          text: 'ne pourra pas être là pour « ' + (ev.eventTitle || 'l\'événement') + ' » : ' + motif,
          targetId: ev.id
        });
      }
      toast(statut === 'confirme' ? 'Présence confirmée.' : 'Réponse envoyée à l\'organisateur.', 'success');
    },
    // ---- Échange de service ----
    _majCleEvenement: function(eventId, champ, valeur) {
      var uid = S.user.id;
      var applique = function(p) {
        p[champ] = Object.assign({}, p[champ] || {});
        if (valeur) p[champ][uid] = valeur; else delete p[champ][uid];
      };
      var posts = db(SK.POSTS, []);
      var local = posts.find(function(p){ return p.id === eventId; });
      if (local) { applique(local); dbSet(SK.POSTS, posts); }
      render();
      App.ecrirePostFrais(eventId, applique);
      return local;
    },
    proposerEchange: function(eventId) {
      if (!S.user) return;
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === eventId; });
      var a = ev && (ev.assignments || []).find(function(x){ return x && x.userId === S.user.id; });
      if (!a) return;
      App._majCleEvenement(eventId, 'echanges', { tache: a.task || '', le: Date.now() });
      // Prévenir les membres qui peuvent reprendre la place.
      var e = { uid: S.user.id, assignation: a };
      db(SK.USERS, []).forEach(function(m) {
        if (!peutReprendre(m, ev, e)) return;
        sendNotificationToUser(m.id, {
          type: 'ECHANGE', title: 'Place à reprendre',
          text: 'propose sa place' + (a.task ? ' (' + a.task + ')' : '') + ' pour « ' + (ev.eventTitle || 'un service') + ' ».',
          targetId: eventId
        });
      });
      toast('Ta place est proposée aux membres du pôle.', 'success');
    },
    retirerEchange: function(eventId) { if (S.user) App._majCleEvenement(eventId, 'echanges', null); },
    reprendreEchange: function(eventId, pour) {
      if (!S.user) return;
      var ev = App._majCleEvenement(eventId, 'reprises', { pour: pour, le: Date.now() });
      // Le responsable doit valider ; le membre remplacé est prévenu.
      var titre = (ev && ev.eventTitle) || 'un service';
      var aPrevenir = [pour];
      if (ev && ev.userId) aPrevenir.push(ev.userId);
      aPrevenir.filter(function(id, i, t){ return id && id !== S.user.id && t.indexOf(id) === i; }).forEach(function(id) {
        sendNotificationToUser(id, { type: 'ECHANGE', title: 'Échange de service', text: 'propose de reprendre une place pour « ' + titre + ' ». À valider.', targetId: eventId });
      });
      toast('Proposition envoyée. Le responsable doit la valider.', 'success');
    },
    annulerReprise: function(eventId) { if (S.user) App._majCleEvenement(eventId, 'reprises', null); },
    validerEchange: function(eventId, pour, repreneur) {
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === eventId; });
      if (!ev || !(ev.userId === S.user.id || canManageEventAssignments(ev, S.user))) { toast('Seul l\'organisateur valide un échange.', 'error'); return; }
      var r = db(SK.USERS, []).find(function(x){ return x.id === repreneur; });
      if (!r) { toast('Membre introuvable.', 'error'); return; }
      var remplacer = function(p) {
        p.assignments = (p.assignments || []).map(function(a) {
          if (!a || a.userId !== pour) return a;
          return Object.assign({}, a, { userId: repreneur, userName: (r.prenom + ' ' + (r.nom || '')).trim() });
        });
        p.assignmentsUpdatedAt = Date.now();
      };
      var posts = db(SK.POSTS, []);
      var local = posts.find(function(p){ return p.id === eventId; });
      if (local) { remplacer(local); dbSet(SK.POSTS, posts); }
      render();
      App.ecrirePostFrais(eventId, remplacer);
      var titre = ev.eventTitle || 'le service';
      sendNotificationToUser(repreneur, { type: 'EVENT_ASSIGNED', title: 'Échange validé', text: 'Tu remplaces ' + nomCourt(pour) + ' pour « ' + titre + ' ».', targetId: eventId });
      sendNotificationToUser(pour, { type: 'ECHANGE', title: 'Échange validé', text: nomCourt(repreneur) + ' te remplace pour « ' + titre + ' ».', targetId: eventId });
      toast('Échange validé.', 'success');
    },
    annulerReponseConvocation: function(eventId) {
      if (!S.user) return;
      var uid = S.user.id;
      var posts = db(SK.POSTS, []);
      var local = posts.find(function(p){ return p.id === eventId; });
      if (local && local.reponsesConvocation) { local.reponsesConvocation = Object.assign({}, local.reponsesConvocation); delete local.reponsesConvocation[uid]; dbSet(SK.POSTS, posts); }
      render();
      App.ecrirePostFrais(eventId, function(frais) {
        if (frais.reponsesConvocation) { frais.reponsesConvocation = Object.assign({}, frais.reponsesConvocation); delete frais.reponsesConvocation[uid]; }
      });
    },

    // ---- Ajouter un événement à l'agenda du téléphone (.ics) ----
    ajouterAgenda: function(eventId) {
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === eventId && isEventLike(p); });
      if (!ev) { toast('Événement introuvable.', 'error'); return; }
      var debut = eventStartTimestamp(ev);
      if (!debut) { toast('Cet événement n\'a pas d\'heure de début.', 'error'); return; }
      var fin = eventEndTimestamp(ev) || (debut + 2 * 3600000);
      var utc = function(ts) { return new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
      var echapper = function(t) { return String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'); };
      var ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Commit VH//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:' + ev.id + '@commit-vh',
        'DTSTAMP:' + utc(Date.now()),
        'DTSTART:' + utc(debut),
        'DTEND:' + utc(fin),
        'SUMMARY:' + echapper(ev.eventTitle || 'Service'),
        'LOCATION:' + echapper(ev.eventLocation || ''),
        'DESCRIPTION:' + echapper(ev.caption || 'Département Communication — Commit VH'),
        // Rappel la veille et 2 h avant, dans l'agenda du téléphone.
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + echapper(ev.eventTitle || 'Service'), 'TRIGGER:-P1D', 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + echapper(ev.eventTitle || 'Service'), 'TRIGGER:-PT2H', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
      try {
        var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
        var a = document.createElement('a');
        a.href = url;
        a.download = (ev.eventTitle || 'evenement').replace(/[^\wÀ-ÿ -]/g, '').trim().replace(/\s+/g, '-') + '.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        toast('Ouvre le fichier pour l\'ajouter à ton agenda.', 'success');
      } catch(e) {
        toast('Impossible de créer le fichier d\'agenda sur ce téléphone.', 'error');
      }
    },

    toggleEventParticipation: function(eventId) {
      if (!S.user) { toast('Vous devez être connecté.', 'error'); return; }
      var posts = db(SK.POSTS, []);
      var ev = posts.find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
      if (!ev) { toast('Événement introuvable.', 'error'); return; }
      if (!Array.isArray(ev.likedBy)) ev.likedBy = [];
      var idx = ev.likedBy.indexOf(S.user.id);
      var joining;
      if (idx === -1) { ev.likedBy.push(S.user.id); joining = true; }
      else { ev.likedBy.splice(idx, 1); joining = false; }
      dbSet(SK.POSTS, posts);
      // Écriture serveur via relecture fraîche : on applique notre état FINAL
      // (présent/absent) sur la version du serveur, sans écraser les autres.
      App.ecrirePostFrais(ev.id, function(frais) {
        if (!Array.isArray(frais.likedBy)) frais.likedBy = [];
        var iFrais = frais.likedBy.indexOf(S.user.id);
        if (joining) { if (iFrais === -1) frais.likedBy.push(S.user.id); }
        else { if (iFrais !== -1) frais.likedBy.splice(iFrais, 1); }
      });
      // Prévient l'organisateur, sauf s'il s'agit de lui-même.
      if (joining && ev.userId && ev.userId !== S.user.id) {
        sendNotificationToUser(ev.userId, {
          type: 'EVENT_PARTICIPATION',
          title: '👍 Nouvelle participation',
          text: (S.user.prenom || 'Quelqu\'un') + ' participera à « ' + (ev.eventTitle || 'votre événement') + ' ».',
          targetId: ev.id
        });
      }
      render();
      toast(joining ? 'Participation confirmée ! 👍' : 'Participation retirée.', joining ? 'success' : 'info');
    },

    openUserProfile: async function(userId) {
      if (!userId) return;
      if (S.user && userId === S.user.id) {
        S.tab = 'profile';
        if (S.postOptionsOpen) App.closePostOptions();
        if (S.commentPostId) App.closeComments();
        render();
        return;
      }
      S.viewUserProfileId = userId;
      S.loadingUserProfile = true;
      render();
      
      if (supabase) {
        try {
          var res = await supabase.from('kun_com_profiles').select('*').eq('id', userId).single();
          if (res && res.data && res.data.content) {
            var users = db(SK.USERS, []);
            var idx = users.findIndex(function(u){ return u.id === userId; });
            if (idx !== -1) users[idx] = res.data.content;
            else users.push(res.data.content);
            dbSet(SK.USERS, users);
          }
          
          var pres = await supabase.from('kun_com_posts').select('*').eq('content->>userId', userId).order('created_at', {ascending:false});
          if (pres && pres.data && pres.data.length > 0) {
            var allPosts = db(SK.POSTS, []);
            pres.data.forEach(function(up) {
              var mapped = up.content;
              var pIdx = allPosts.findIndex(function(p){ return p.id === mapped.id; });
              if (pIdx !== -1) allPosts[pIdx] = Object.assign(allPosts[pIdx], mapped);
              else allPosts.push(mapped);
            });
            dbSet(SK.POSTS, allPosts);
          }
        } catch(e) {
          console.error("Erreur chargement profil:", e);
        }
      }
      
      S.loadingUserProfile = false;
      render();
    },
    closeUserProfile: function() {
      S.viewUserProfileId = null;
      render();
    },

    // ============================================================
    // ABONNEMENT (bouton "Suivre" sur un profil)
    // ============================================================
    // Enregistre quelques champs de SA fiche (préférences d'interface : visite
    // vue, conditions lues, carte masquée...) en local puis sur le serveur.
    _majMonProfil: function(champs) {
      if (!S.user || !champs) return;
      Object.assign(S.user, champs);
      var allUsers = db(SK.USERS, []);
      var uIdx = allUsers.findIndex(function(u){ return u.id === S.user.id; });
      if (uIdx !== -1) Object.assign(allUsers[uIdx], champs);
      dbSet(SK.USERS, allUsers);
      sauverSession(S.user);
      App._upsertFiable('kun_com_profiles', { id: S.user.id, content: profilSansSecret(S.user) });
      try { render(); } catch(e) {}
    },
    toggleFollow: function(targetUserId) {
      if (!S.user || !targetUserId || targetUserId === S.user.id) return;
      if (!Array.isArray(S.user.following)) S.user.following = [];
      var idx = S.user.following.indexOf(targetUserId);
      var nowFollowing;
      if (idx !== -1) { S.user.following.splice(idx, 1); nowFollowing = false; }
      else { S.user.following.push(targetUserId); nowFollowing = true; }
      var allUsers = db(SK.USERS, []);
      var uIdx = allUsers.findIndex(function(u){ return u.id === S.user.id; });
      if (uIdx !== -1) allUsers[uIdx] = S.user;
      dbSet(SK.USERS, allUsers);
      sauverSession(S.user);
      if (supabase) supabase.from('kun_com_profiles').upsert({ id: S.user.id, content: profilSansSecret(S.user) }, { onConflict: 'id' }).then(function(){}, function(e){});
      if (nowFollowing) {
        sendNotificationToUser(targetUserId, {
          type: 'FOLLOW',
          title: '👤 Nouvel abonné',
          text: (S.user.prenom || 'Quelqu\'un') + ' a commencé à vous suivre.',
          targetId: targetUserId
        });
      }
      render();
    },

    // ============================================================
    // MESSAGERIE PRIVÉE (simple, 1-à-1)
    // ============================================================
    // Boîte de réception : toutes ses conversations (canaux de pôle compris).
    ouvrirBoite: async function() {
      if (!S.user) return;
      S.boiteOpen = true; render();
      await App._chargerMessages();
      if (S.boiteOpen) render();
    },
    fermerBoite: function() { S.boiteOpen = false; render(); },
    ouvrirTableauDeBord: function() { if (isGrandResponsable(S.user)) { S.tableauOpen = true; render(); } },
    fermerTableauDeBord: function() { S.tableauOpen = false; render(); },
    relancerConvocation: function(eventId, userId) {
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === eventId; });
      if (!ev) return;
      sendNotificationToUser(userId, {
        type: 'CONVOCATION', title: 'Ta réponse est attendue',
        text: 'Peux-tu confirmer ta présence pour « ' + (ev.eventTitle || 'le service') + ' » ?',
        targetId: eventId
      });
      toast('Relance envoyée à ' + nomCourt(userId) + '.', 'success');
    },
    // Relit les messages récents visibles (les siens et ceux de ses pôles :
    // c'est la base qui filtre) et les fusionne au cache local.
    _chargerMessages: async function(requete) {
      if (!supabase || !S.user) return false;
      try {
        var res = await (requete || supabase.from('kun_com_dms').select('*').order('sent_at', { ascending: false }).limit(300));
        if (!res || !res.data) return false;
        var byId = {};
        db(SK.DMS, []).forEach(function(m){ if (m && m.id) byId[m.id] = m; });
        var nouveau = false;
        res.data.forEach(function(row) {
          var m = row.content;
          if (m && m.id) { if (!byId[m.id]) nouveau = true; byId[m.id] = m; }
        });
        dbSet(SK.DMS, Object.keys(byId).map(function(k){ return byId[k]; }));
        return nouveau;
      } catch(e) { console.warn('Erreur chargement messages:', e); return false; }
    },
    _requeteConversation: function(autre) {
      var q = supabase.from('kun_com_dms').select('*');
      q = estCanal(autre) ? q.eq('to_id', autre)
        : q.or('and(from_id.eq.' + S.user.id + ',to_id.eq.' + autre + '),and(from_id.eq.' + autre + ',to_id.eq.' + S.user.id + ')');
      return q.order('sent_at', { ascending: true });
    },
    _messagesConversation: function(autre) {
      return db(SK.DMS, []).filter(function(m){ return dansConversation(m, autre); })
        .sort(function(a,b){ return a.timestamp - b.timestamp; });
    },

    // ============================================================
    // MESSAGERIE : privée (1-à-1) ou canal de pôle (« pole:<id> »)
    // ============================================================
    openDirectMessage: async function(userId) {
      if (!S.user || !userId || userId === S.user.id) return;
      if (estCanal(userId) && mesCanaux(S.user).indexOf(userId) === -1) { toast('Ce canal est réservé aux membres du pôle.', 'info'); return; }
      S.dmOpen = true;
      S.dmWithUserId = userId;
      S.dmLoading = true;
      S.dmMessages = App._messagesConversation(userId);
      marquerConversationLue(userId);
      render();
      setTimeout(function(){ var el = document.getElementById('dmMessagesList'); if (el) el.scrollTop = el.scrollHeight; }, 50);

      if (supabase) {
        await App._chargerMessages(App._requeteConversation(userId));
        if (S.dmWithUserId === userId) S.dmMessages = App._messagesConversation(userId);
      }
      marquerConversationLue(userId);
      S.dmLoading = false;
      render();
      setTimeout(function(){ var el = document.getElementById('dmMessagesList'); if (el) el.scrollTop = el.scrollHeight; }, 50);
      App._startDmPolling();
    },
    closeDirectMessage: function() {
      S.dmOpen = false;
      S.dmWithUserId = null;
      S.dmMessages = [];
      App._stopDmPolling();
      render();
    },
    _startDmPolling: function() {
      App._stopDmPolling();
      if (!supabase) return;
      window._dmPollInterval = setInterval(async function() {
        if (!S.dmOpen || !S.dmWithUserId || !S.user) return;
        var autre = S.dmWithUserId;
        var nouveau = await App._chargerMessages(App._requeteConversation(autre));
        if (!nouveau || S.dmWithUserId !== autre) return;
        S.dmMessages = App._messagesConversation(autre);
        marquerConversationLue(autre);
        var list = document.getElementById('dmMessagesList');
        if (list) {
          var wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
          list.innerHTML = S.dmMessages.map(function(m){ return renderDmBubble(m); }).join('');
          if (wasAtBottom) list.scrollTop = list.scrollHeight;
        }
      }, 4000);
    },
    _stopDmPolling: function() {
      if (window._dmPollInterval) { clearInterval(window._dmPollInterval); window._dmPollInterval = null; }
    },
    sendDirectMessage: function(ev) {
      ev && ev.preventDefault();
      var input = document.getElementById('dmInput');
      var txt = input ? input.value.trim() : '';
      if (!txt || !S.user || !S.dmWithUserId) return;
      var autre = S.dmWithUserId;
      var newMsg = { id: 'dm' + Date.now() + Math.floor(Math.random()*1000), fromId: S.user.id, toId: autre, text: txt, timestamp: Date.now() };
      var all = db(SK.DMS, []);
      all.push(newMsg);
      dbSet(SK.DMS, all);
      S.dmMessages.push(newMsg);
      marquerConversationLue(autre);
      if (supabase) {
        supabase.from('kun_com_dms').upsert({ id: newMsg.id, from_id: newMsg.fromId, to_id: newMsg.toId, content: newMsg, sent_at: new Date(newMsg.timestamp).toISOString() }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Erreur envoi message:', e); });
      }
      var extrait = txt.slice(0, 40) + (txt.length > 40 ? '…' : '');
      if (estCanal(autre)) {
        // Canal : une notification par membre du pôle, et une seule tant qu'il
        // n'a pas lu la précédente (pas de rafale pendant une discussion).
        var pole = poleDuCanal(autre);
        db(SK.USERS, []).forEach(function(m) {
          if (!m || m.id === S.user.id || compteEnAttente(m)) return;
          if (getUserSections(m).indexOf(autre.slice(5)) === -1) return;
          var dejaNonLue = (m.notifications || []).some(function(n){ return n.type === 'CANAL' && !n.read && String(n.targetId || '').indexOf(autre + '#') === 0; });
          if (dejaNonLue) return;
          sendNotificationToUser(m.id, {
            type: 'CANAL',
            title: 'Canal ' + (pole ? pole.nom : 'du pôle'),
            text: (S.user.prenom || 'Quelqu\'un') + ' : "' + extrait + '"',
            targetId: autre + '#' + newMsg.id
          });
        });
      } else {
        // targetId = l'ID du MESSAGE (unique), pas celui de l'expéditeur : le
        // garde-fou anti-doublon de sendNotificationToUser compare type+targetId+
        // senderId, et un targetId constant (l'expéditeur) pour toute la
        // conversation faisait passer le 2e message et les suivants pour des
        // doublons du premier — ils étaient donc silencieusement ignorés. Le clic
        // sur une notif MESSAGE ouvre la conversation via notif.senderId, jamais
        // via targetId : ce changement ne touche donc pas la navigation.
        sendNotificationToUser(autre, {
          type: 'MESSAGE',
          title: 'Nouveau message',
          text: (S.user.prenom || 'Quelqu\'un') + ' : "' + extrait + '"',
          targetId: newMsg.id
        });
      }
      if (input) input.value = '';
      var list = document.getElementById('dmMessagesList');
      if (list) {
        var div = document.createElement('div');
        div.innerHTML = renderDmBubble(newMsg);
        list.appendChild(div.firstChild || div);
        list.scrollTop = list.scrollHeight;
      } else { render(); }
    },

    // Role Unlock Methods
    openCropper: function(dataUrl, aspectRatio, title, onConfirm) {
      if (window._currentCropper) {
        try { window._currentCropper.destroy(); } catch(e){}
        window._currentCropper = null;
      }
      S.cropperOpen = true;
      S.cropperDataUrl = dataUrl;
      S.cropperAspectRatio = (aspectRatio === undefined || aspectRatio === null) ? 1 : aspectRatio;
      // Ratio libre = NaN (aucune contrainte) : c'est le cas des photos de publication,
      // qui gardent leurs proportions d'origine sauf si l'utilisateur choisit "Carré".
      S.cropperFreeRatio = (typeof S.cropperAspectRatio === 'number' && isNaN(S.cropperAspectRatio));
      S.cropperSquare = false;
      S.cropperTitle = title || 'Recadrer la photo';
      S.cropperOnConfirm = onConfirm;
      render();
      initCropperIfNeeded();
    },
    // Pivote l'image de 90° dans le sens horaire (bouton "Pivoter")
    cropperRotate: function() {
      if (!window._currentCropper) return;
      try { window._currentCropper.rotate(90); } catch(e){}
    },
    // Annule recadrage/rotation/zoom et revient à l'image d'origine
    cropperReset: function() {
      if (!window._currentCropper) return;
      S.cropperSquare = false;
      try {
        window._currentCropper.reset();
        window._currentCropper.setAspectRatio(NaN);
      } catch(e){}
      syncCropperSquareBtn();
    },
    // Bascule entre recadrage libre (proportions réelles) et carré 1:1
    cropperToggleSquare: function() {
      if (!window._currentCropper) return;
      S.cropperSquare = !S.cropperSquare;
      try { window._currentCropper.setAspectRatio(S.cropperSquare ? 1 : NaN); } catch(e){}
      syncCropperSquareBtn();
    },
    closeCropper: function() {
      if (window._currentCropper) {
        try { window._currentCropper.destroy(); } catch(e){}
        window._currentCropper = null;
      }
      S.cropperOpen = false;
      S.cropperDataUrl = null;
      S.cropperOnConfirm = null;
      S.cropperFreeRatio = false;
      S.cropperSquare = false;
      render();
    },
    confirmCropper: function() {
      if (!window._currentCropper) return;
      var canvas = window._currentCropper.getCroppedCanvas({
        maxWidth: 1200,
        maxHeight: 1200,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });
      if (!canvas) return;
      var croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      var cb = S.cropperOnConfirm;
      this.closeCropper();
      if (cb) cb(croppedDataUrl);
    },
    openEditProfile: function() { S.editProfileOpen = true; S.avatarFile = null; S.coverFile = null; S.avatarPreview = null; S.coverPreview = null; S.editProfileData = null; S.editSections = getUserSections(S.user).slice(); render(); },
    closeEditProfile: function() { S.editProfileOpen = false; S.avatarFile = null; S.coverFile = null; S.avatarPreview = null; S.coverPreview = null; S.editProfileData = null; render(); },
    handleAvatarSelect: function(e) {
      var file = e.target.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function(evt) {
          App.openCropper(evt.target.result, 1, 'Photo de Profil (1:1)', function(croppedDataUrl) {
            compressImage(croppedDataUrl, 240, 240, 0.75, function(dataUrl) {
              S.avatarPreview = dataUrl;
              if (!S.editProfileOpen) {
                S.editProfileOpen = true;
                S.editSections = getUserSections(S.user).slice();
                render();
              } else {
                var el = document.getElementById('editAvatarPreview');
                if (el) {
                  var parent = el.parentNode;
                  parent.innerHTML = '<img id="editAvatarPreview" src="' + safeUrl(dataUrl) + '" style="width:100%;height:100%;object-fit:cover;" />';
                }
              }
            });
          });
        };
        reader.readAsDataURL(file);
      }
    },
    handleCoverSelect: function(e) {
      var file = e.target.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function(evt) {
          App.openCropper(evt.target.result, 16 / 9, 'Photo de Couverture (16:9)', function(croppedDataUrl) {
            compressImage(croppedDataUrl, 640, 360, 0.75, function(dataUrl) {
              S.coverPreview = dataUrl;
              if (!S.editProfileOpen) {
                S.editProfileOpen = true;
                S.editSections = getUserSections(S.user).slice();
                render();
              } else {
                var el = document.getElementById('editCoverPreview');
                if (el) {
                  el.innerHTML = '<img src="' + safeUrl(dataUrl) + '" style="width:100%;height:100%;object-fit:cover;" />';
                }
              }
            });
          });
        };
        reader.readAsDataURL(file);
      }
    },

    saveProfile: async function(btn) {
      if (btn) { btn.innerHTML = 'Enregistrement...'; btn.disabled = true; }
      var u = S.user;
      var prenom = document.getElementById('editPrenom').value.trim();
      var nom = document.getElementById('editNom').value.trim();
      var bio = document.getElementById('editBio').value.trim();
      var skills = ((document.getElementById('editSavoirFaire')||{}).value || '').trim();
      var newPwd = ((document.getElementById('editNewPwd')||{}).value || '').trim();

      if (S.editSections.length === 0) {
        toast('Veuillez sélectionner au moins 1 section.', 'error');
        if (btn) { btn.innerHTML = 'Terminer'; btn.disabled = false; }
        return;
      }
      
      var avatar_url = u.avatar_url;
      var cover_url = u.cover_url;
      
      if (S.avatarPreview) {
        avatar_url = S.avatarPreview;
      }
      if (S.coverPreview) {
        cover_url = S.coverPreview;
      }

      if (supabase) {
        if (S.avatarFile) {
          try {
            var ext = (S.avatarFile.name || 'img.jpg').split('.').pop();
            var fileName = 'avatar_' + u.id + '_' + Date.now() + '.' + ext;
            var res = await supabase.storage.from('avatars').upload(fileName, S.avatarFile, { upsert: true });
            if (!res.error) {
              var urlRes = supabase.storage.from('avatars').getPublicUrl(fileName);
              if (urlRes && urlRes.data && urlRes.data.publicUrl) {
                avatar_url = urlRes.data.publicUrl;
              }
            }
          } catch(err) {
            // Keep base64 fallback in avatar_url
          }
        }
        
        if (S.coverFile) {
          try {
            var ext2 = (S.coverFile.name || 'img.jpg').split('.').pop();
            var fileName2 = 'cover_' + u.id + '_' + Date.now() + '.' + ext2;
            var res2 = await supabase.storage.from('avatars').upload(fileName2, S.coverFile, { upsert: true });
            if (!res2.error) {
              var urlRes2 = supabase.storage.from('avatars').getPublicUrl(fileName2);
              if (urlRes2 && urlRes2.data && urlRes2.data.publicUrl) {
                cover_url = urlRes2.data.publicUrl;
              }
            }
          } catch(err) {
            // Keep base64 fallback in cover_url
          }
        }
      }
      
      var updatedUser = Object.assign({}, u, {
        prenom: prenom,
        nom: nom,
        bio: bio,
        skills: skills,
        phone: u.phone,
        sections: S.editSections.slice(),
        avatar_url: avatar_url,
        cover_url: cover_url
      });
      // Le rôle reste celui du JWT (source de vérité) : une sauvegarde de profil
      // ne doit jamais rétrograder un Admin par une valeur locale périmée.
      updatedUser.role = S.jwtRole || u.role || 'MEMBRE';
      delete updatedUser.section_id;
      delete updatedUser.section_nom;
      
      S.user = updatedUser;
      
      // Sauvegarde tolérante au quota (voir sauverSession dans 01-core.js) :
      // allègement progressif au lieu d'une exception qui interromprait la suite.
      sauverSession(updatedUser);
      
      var users = db(SK.USERS, []);
      var idx = users.findIndex(function(x){ return x.id === u.id; });
      if (idx !== -1) {
        users[idx] = updatedUser;
      } else {
        users.push(updatedUser);
      }
      dbSet(SK.USERS, users);
      
      var allPosts = db(SK.POSTS, []);
      var postsModified = false;
      allPosts.forEach(function(p) {
        if (p.userId === updatedUser.id) {
          p.avatar_url = updatedUser.avatar_url;
          p.author = updatedUser.prenom + ' ' + updatedUser.nom;
          p.authorAvatar = (updatedUser.prenom || 'M').charAt(0).toUpperCase();
          postsModified = true;
        }
        if (Array.isArray(p.comments)) {
          p.comments.forEach(function(c) {
            if (c.userId === updatedUser.id) {
              c.avatar_url = updatedUser.avatar_url;
              c.author = updatedUser.prenom + ' ' + updatedUser.nom;
              postsModified = true;
            }
          });
        }
      });
      if (postsModified) {
        dbSet(SK.POSTS, allPosts);
      }
      
      // Upsert to Supabase safely
      if (supabase) {
        try {
          await supabase.from('kun_com_profiles').upsert({ id: updatedUser.id, content: updatedUser }, { onConflict: 'id' });
        } catch(supErr) {
          console.warn("Supabase profile save error:", supErr);
        }
      }
      
      // Mot de passe via Supabase Auth. Le NUMÉRO de connexion ne se change pas
      // ici (il sert d'identifiant) — un Admin peut réinitialiser si besoin.
      var authMsgs = [];
      if (supabase && supabase.auth) {
        if (newPwd) {
          if (newPwd.length < 8) { authMsgs.push('Mot de passe : 8 caractères minimum.'); }
          else {
            try {
              var pr = await supabase.auth.updateUser({ password: newPwd });
              if (pr && pr.error) authMsgs.push('Mot de passe : ' + pr.error.message);
              else authMsgs.push('Mot de passe mis à jour.');
            } catch(e) { authMsgs.push('Échec du changement de mot de passe.'); }
          }
        }
      }

      // Questions de sécurité : (re)définies seulement si le bloc est rempli.
      // Un bloc vide = « ne rien changer » ; un bloc partiel déclenche un toast et
      // interrompt l'enregistrement (readSecurityQA renvoie null).
      var editQA = readSecurityQA('edit', false);
      if (editQA === null) { if (btn) { btn.innerHTML = 'Terminer'; btn.disabled = false; } return; }
      if (editQA && !editQA.empty && supabase && supabase.functions) {
        try {
          var sqr = await supabase.functions.invoke('password-recovery', {
            body: { action: 'set', phone: normalizePhone(u.phone), q1: editQA.q1, q2: editQA.q2, a1: editQA.a1, a2: editQA.a2 }
          });
          if (sqr && sqr.error) authMsgs.push('Questions de sécurité : échec de l\'enregistrement.');
          else authMsgs.push('Questions de sécurité mises à jour.');
        } catch(e) { authMsgs.push('Questions de sécurité : échec de l\'enregistrement.'); }
      }

      S.editProfileOpen = false;
      render();
      toast(authMsgs.length ? ('Profil mis à jour. ' + authMsgs.join(' ')) : 'Profil mis à jour !', 'success');
    },
    openNotifications: function() {
      S.notificationsOpen = true;
      if ('Notification' in window && Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch(e){}
      }
      render();
    },
    viewPost: function(id) {
       S.postOptionsOpen = false; S.selectedPostId = null;
       S.q = ''; // clear search
       S.story = 'all'; // même raison que goToPost : un filtre de section actif masquait la cible et le scroll échouait en silence
       // Scroll to post logic could go here
       render();
       setTimeout(function() {
         var el = document.getElementById('post-' + id);
         if (el) el.scrollIntoView({behavior: 'smooth'});
       }, 100);
    },
    closePostOptions: function() { S.postOptionsOpen = false; S.selectedPostId = null; render(); },
    closeNotifications: function() {
      S.notificationsOpen = false;
      render();
    },
    // Enregistre l'état de lecture. On relit d'abord le profil côté serveur pour
    // ne pas effacer une notification arrivée pendant qu'on lisait, puis on
    // fusionne : une notification lue le reste, quelle que soit la version.
    _persistNotifications: function() {
      var moi = S.user;
      if (!moi) return;
      var allUsers = db(SK.USERS, []);
      var uIdx = allUsers.findIndex(function(u){ return u.id === moi.id; });
      if (uIdx !== -1) allUsers[uIdx] = moi;
      dbSet(SK.USERS, allUsers);
      sauverSession(moi);
      if (!supabase) return;
      supabase.from('kun_com_profiles').select('content').eq('id', moi.id).single()
        .then(function(res) {
          var distant = (res && res.data && res.data.content) ? res.data.content : null;
          if (distant) moi.notifications = mergeNotifications(moi.notifications, distant.notifications);
          return supabase.from('kun_com_profiles').upsert({ id: moi.id, content: moi }, { onConflict: 'id' });
        })
        .then(function(){}, function(e){ console.warn('Notifications :', e); });
    },

    markAllNotificationsRead: function() {
      if (!S.user || !Array.isArray(S.user.notifications)) return;
      S.user.notifications.forEach(function(n){ n.read = true; });
      this._persistNotifications();
      render();
    },
    clickNotification: function(notifId, targetId) {
      if (!S.user || !Array.isArray(S.user.notifications)) return;
      var notif = S.user.notifications.find(function(n){ return n.id === notifId; });
      if (notif) notif.read = true;
      this._persistNotifications();
      
      S.notificationsOpen = false;
      render();

      if (notif && (notif.type === 'MESSAGE')) {
        App.openDirectMessage(notif.senderId);
        return;
      }
      if (notif && notif.type === 'CANAL') {
        App.openDirectMessage(String(notif.targetId || '').split('#')[0]);
        return;
      }
      if (notif && (notif.type === 'FOLLOW' || notif.type === 'NEW_MEMBER')) {
        App.openUserProfile(notif.senderId);
        return;
      }

      if (!targetId) return;
      var posts = db(SK.POSTS, []);
      var targetPost = posts.find(function(p){ return p.id === targetId; });
      if (!targetPost) { toast('Cette publication n\'existe plus.', 'info'); return; }

      // Notification portant sur un COMMENTAIRE (réponse, mention, nouveau
      // commentaire) : on ouvre directement la discussion et on met en évidence
      // le commentaire concerné. Auparavant on atterrissait sur la publication
      // et il fallait retrouver soi-même le message dans toute la conversation.
      if (notif && notif.commentId) {
        this.openCommentsAt(targetId, notif.commentId);
        return;
      }

      if (isEventLike(targetPost)) { this.goToEvent(targetId); return; }
      this.goToPost(targetId);
    },

    // Ouvre la discussion d'une publication et amène le commentaire visé à
    // l'écran, avec une mise en évidence temporaire pour le repérer.
    openCommentsAt: function(postId, commentId) {
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id === postId; });
      if (!post) { toast('Cette publication n\'existe plus.', 'info'); return; }

      S.tab = 'home';
      S.commentPostId = postId;
      S.commentOpen = true;
      S.notificationsOpen = false;
      S.replyingToCommentId = null; S.replyingToAuthor = null;
      render();

      var existe = (post.comments || []).some(function(c){ return c.id === commentId; });
      if (!existe) { toast('Ce commentaire a été supprimé.', 'info'); return; }

      // Laisse le temps à la fenêtre de s'ouvrir avant de faire défiler.
      setTimeout(function() {
        var el = document.getElementById('cwrap-' + commentId);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background 0.4s ease';
        el.style.background = UI.accentSoft;
        el.style.borderRadius = UI.r1;
        window.setTimeout(function(){ el.style.background = 'transparent'; }, 2000);
      }, 220);
    },

    // Changer d'écran (connexion / inscription / mot de passe oublié) repart d'un
    // formulaire vierge : on ne veut pas retrouver le mot de passe tapé pour la
    // connexion pré-rempli dans le formulaire d'inscription.
    nav: function(v) { S.auth = v; S.champsAuth = {}; render(); },
    // Mémorise la frappe SANS redessiner (un render() à chaque touche ferait
    // sauter le curseur et le clavier sur mobile).
    // Aligne la hauteur de chaque carrousel d'événements sur celle du volet
    // actuellement visible. Sans cela, la rangée flex adopte la hauteur du plus
    // grand volet et laisse un vide blanc sous les plus courts.
    recalerCarrousels: function() {
      try {
        var listes = document.querySelectorAll('[data-carrousel-ev="1"]');
        for (var i = 0; i < listes.length; i++) {
          var el = listes[i];
          var largeur = el.clientWidth;
          if (!largeur || !el.children.length) continue;
          var idx = Math.round(el.scrollLeft / largeur);
          if (idx < 0) idx = 0;
          if (idx > el.children.length - 1) idx = el.children.length - 1;
          var volet = el.children[idx];
          if (!volet) continue;
          var h = volet.offsetHeight;
          // Une hauteur nulle signifie que le contenu n'est pas encore mesurable
          // (média non chargé) : on ne fige surtout pas le carrousel à zéro.
          if (h > 0) el.style.height = h + 'px';
        }
      } catch(e) {}
    },
    // Un média vient de s'afficher : on retient sa proportion pour réserver
    // exactement sa place aux prochains rendus (voir memoriserRatioMedia). Aucun
    // redessin ici — la carte est déjà à la bonne taille, et redessiner pendant
    // le défilement serait pire que le mal.
    mediaCharge: function(el, url) {
      if (!el) return;
      var w = el.naturalWidth || el.videoWidth || 0;
      var h = el.naturalHeight || el.videoHeight || 0;
      if (w && h) memoriserRatioMedia(url, w, h);
    },

    // Média du fil introuvable (objet Storage supprimé avec sa publication
    // d'origine, URL invalide...) : remplace l'élément cassé par un encart
    // discret au lieu de laisser une image/vidéo brisée à l'écran. Appelé par
    // les attributs onerror des cartes du fil (05-render-feed).
    mediaEchoue: function(el) {
      if (!el || !el.parentNode) return;
      var encart = document.createElement('div');
      encart.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;padding:28px 16px;background:#F2F2F7;color:#8A93A0;font-size:13px;border-radius:12px;';
      encart.textContent = 'Média indisponible';
      el.parentNode.replaceChild(encart, el);
    },

    // ---- Écritures de publications SANS écrasement concurrent ----
    // Commentaires, likes et participations vivent DANS le JSON du post :
    // réécrire la version lue dans le cache local écraserait toute action
    // concurrente d'un autre membre (son commentaire disparaissait alors
    // définitivement, en base comme chez tous les clients). On relit donc la
    // version fraîche du serveur, on y applique UNIQUEMENT notre mutation en
    // valeur absolue (état final voulu, pas un basculement), puis on réécrit —
    // le même schéma que votePoll, généralisé.
    ecrirePostFrais: async function(postId, mutateur) {
      var posts = db(SK.POSTS, []);
      var local = posts.find(function(p){ return p.id === postId; });
      if (!local) return null;
      var cible = local;
      if (supabase) {
        try {
          var res = await supabase.from('kun_com_posts').select('content').eq('id', postId).single();
          if (res && res.data && res.data.content) cible = res.data.content;
        } catch(e) { /* hors-ligne ou post absent : on mute la version locale */ }
      }
      mutateur(cible);
      var allPosts = db(SK.POSTS, []);
      var idx = allPosts.findIndex(function(p){ return p.id === postId; });
      if (idx !== -1) { allPosts[idx] = cible; dbSet(SK.POSTS, allPosts); }
      if (supabase) {
        // Le serveur fusionne lui-même l'écriture (migration 06) et renvoie la
        // version retenue : le cache local s'y recale aussitôt.
        App._upsertFiable('kun_com_posts', { id: postId, content: cible }).then(function(contenuServeur) {
          if (!contenuServeur) return;
          var posts2 = db(SK.POSTS, []);
          var i2 = posts2.findIndex(function(p){ return p.id === postId; });
          if (i2 !== -1) { posts2[i2] = parsePostItem({ id: postId, content: contenuServeur }) || posts2[i2]; dbSet(SK.POSTS, posts2); }
        });
      }
      return cible;
    },

    // Upsert qui ne perd rien : supabase-js ne REJETTE pas sa promesse en cas
    // d'échec, il la résout avec { error }. Les gestionnaires « .then(ok, échec) »
    // ne voyaient donc jamais les erreurs, et la file d'attente hors-ligne ne
    // recevait presque rien. Ici : erreur réseau → file d'attente ; refus du
    // serveur → journalisé (le rejouer ne changerait rien). Renvoie le contenu
    // tel qu'enregistré par le serveur, ou null.
    _upsertFiable: function(table, row) {
      if (!supabase) return Promise.resolve(null);
      return supabase.from(table).upsert(row, { onConflict: 'id' }).select('content').single().then(function(r) {
        if (r && r.error) {
          if (estErreurReseau(r.error)) App._mettreEnFileAttenteEcriture({ table: table, row: row });
          else console.warn('Écriture refusée par le serveur (' + table + ') :', r.error);
          return null;
        }
        return (r && r.data && r.data.content) || null;
      }, function(e) {
        App._mettreEnFileAttenteEcriture({ table: table, row: row });
        console.warn('Écriture mise en file d\'attente (' + table + ') :', e);
        return null;
      });
    },

    // ---- File d'attente d'écritures hors-ligne ----
    // Les upserts réseau étaient « fire-and-forget » : hors connexion, le toast
    // annonçait un succès mais rien n'arrivait jamais au serveur (et une
    // suppression dont le tombstone échouait ressuscitait à chaque synchro).
    // Les écritures qui échouent sont désormais empilées dans le localStorage,
    // puis rejouées au retour du réseau / à la connexion suivante.
    _mettreEnFileAttenteEcriture: function(item) {
      try {
        var file = JSON.parse(localStorage.getItem('kc_pending_writes') || '[]');
        file.push(Object.assign({ at: Date.now() }, item));
        // Borne raisonnable : au-delà, on privilégie les écritures récentes.
        while (file.length > 200) file.shift();
        localStorage.setItem('kc_pending_writes', JSON.stringify(file));
      } catch(e) {}
    },
    viderFileAttenteEcriture: async function() {
      var file = [];
      try { file = JSON.parse(localStorage.getItem('kc_pending_writes') || '[]'); } catch(e) {}
      if (!file.length || !supabase) return;
      localStorage.setItem('kc_pending_writes', '[]'); // vidé d'abord : un échec ci-dessous repousse l'item
      for (var i = 0; i < file.length; i++) {
        var w = file[i];
        // Au-delà d'une semaine, une écriture en attente est abandonnée.
        if (w.at && Date.now() - w.at > 7 * 24 * 3600 * 1000) continue;
        try {
          var r = await supabase.from(w.table).upsert(w.row, { onConflict: 'id' });
          if (r && r.error) throw r.error;
        } catch(e) {
          // Seule une panne réseau mérite un nouvel essai. Un refus du serveur
          // (droits, données invalides) se reproduirait à l'identique à chaque
          // démarrage : on l'abandonne au lieu de le rejouer indéfiniment.
          if (estErreurReseau(e)) {
            console.warn('File d\'attente : écriture toujours impossible, replacée.', e);
            App._mettreEnFileAttenteEcriture(w);
          } else {
            console.warn('File d\'attente : écriture refusée par le serveur, abandonnée.', e);
          }
        }
      }
    },
    saisieAuth: function(id, val) {
      if (!S.champsAuth) S.champsAuth = {};
      S.champsAuth[id] = val;
    },
    login: async function(e) {
      e && e.preventDefault();
      // Empêche les connexions concurrentes : sans ceci, un appui répété pendant
      // une connexion lente (réseau mobile) déclenchait autant de téléchargements
      // complets des profils EN PARALLÈLE, ce qui saturait encore plus la
      // connexion et allongeait l'attente au lieu de la raccourcir.
      if (App._loginEnCours) return;
      // Connexion au NUMÉRO (transformé en identifiant interne, voir phoneToEmail).
      var phoneRaw = ((document.getElementById('loginPhone')||{}).value || '').trim();
      var email = phoneToEmail(phoneRaw);
      var pwd = ((document.getElementById('loginPwd')||{}).value || '').trim();
      if (!email) { toast('Veuillez saisir votre numéro de téléphone.', 'error'); return; }
      if (!pwd) { toast('Veuillez saisir votre mot de passe.', 'error'); return; }

      App._loginEnCours = true;
      var btn = document.getElementById('loginSubmitBtn');
      var btnTexteOriginal = btn ? btn.textContent : null;
      if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Connexion...'; }

      try {
        // AUTHENTIFICATION SUPABASE — plus aucune comparaison de mot de passe côté
        // client. Supabase vérifie l'identifiant contre auth.users (bcrypt côté
        // serveur) et renvoie une session + un JWT (avec le rôle dans app_metadata).
        if (!supabase || !supabase.auth) { toast('Connexion indisponible.', 'error'); return; }
        var resp = await supabase.auth.signInWithPassword({ email: email, password: pwd });
        if (!resp || resp.error || !resp.data || !resp.data.user) {
          toast('Numéro ou mot de passe incorrect.', 'error');
          return;
        }
        applyAuthUser(resp.data.user);   // définit S.user (rôle depuis le JWT) + S.auth='app'
        S.tab = 'home';
        S.champsAuth = {};
        render();
        toast('Connexion réussie ! Bienvenue ' + (S.user && S.user.prenom || 'Membre') + '. ', 'success');
        try { syncSupabaseToLocal(); } catch(e){}
        try { App.viderFileAttenteEcriture(); } catch(e){}
        try { tryOpenDeepLinkedPost(); } catch(e){}
      } finally {
        App._loginEnCours = false;
        // Si l'écran de connexion est toujours affiché (erreur, mot de passe
        // incorrect, délai dépassé...), rétablir le bouton. En cas de connexion
        // réussie, render() a déjà remplacé tout l'écran : ce bouton n'existe
        // plus dans le document, la vérification ci-dessous l'ignore alors sans
        // risque.
        if (btn && document.body.contains(btn)) {
          btn.disabled = false; btn.style.opacity = '';
          if (btnTexteOriginal !== null) btn.textContent = btnTexteOriginal;
        }
      }
    },
    signup: async function(e) {
      e && e.preventDefault();
      // Garde anti double-clic (même raisonnement que _loginEnCours pour login) :
      // sans lui, un appui répété pendant l'inscription lançait deux signUp en
      // parallèle — le second produisait un faux « compte existe déjà ».
      if (App._signupEnCours) return;
      var prenom = ((document.getElementById('signupPrenom')||{}).value||'').trim();
      var nom = ((document.getElementById('signupNom')||{}).value||'').trim();
      // Inscription au NUMÉRO : identifiant interne dérivé, numéro lisible stocké.
      var phoneRaw = ((document.getElementById('signupPhone')||{}).value||'').trim();
      var email = phoneToEmail(phoneRaw);
      var phoneDigits = normalizePhone(phoneRaw);
      var phoneDisplay = formatPhoneDisplay(phoneRaw);
      var pwd = ((document.getElementById('signupPwd')||{}).value||'').trim();
      if (!prenom || !nom || !email || !pwd) { toast('Veuillez remplir tous les champs (numéro compris).', 'error'); return; }
      if (pwd.length < 8) { toast('Le mot de passe doit contenir au moins 8 caractères.', 'error'); return; }
      if (S.signupSections.length === 0) { toast('Veuillez choisir au moins 1 section.', 'error'); return; }
      var accepte = (document.getElementById('signupConditions') || {}).checked;
      if (!accepte) { toast('Pour créer un compte, coche « J\'accepte les conditions d\'utilisation ».', 'error'); return; }
      // Questions de sécurité obligatoires : c'est le seul moyen de récupération.
      var secQA = readSecurityQA('signup', true);
      if (!secQA) return;
      if (!supabase || !supabase.auth) { toast('Inscription indisponible.', 'error'); return; }
      App._signupEnCours = true;
      var userSecs = S.signupSections.length > 0 ? S.signupSections.slice() : ['cadrage'];
      try {
        // INSCRIPTION SUPABASE AUTH — crée le compte dans auth.users. Le rôle est
        // TOUJOURS MEMBRE ; l'élévation (Responsable / Admin) ne se fait
        // qu'ensuite, par un Admin via l'Edge Function protégée.
        var resp = await supabase.auth.signUp({
          email: email, password: pwd,
          options: { data: { prenom: prenom, nom: nom, phone: phoneDisplay } }
        });
        if (resp.error) {
          var m = resp.error.message || '';
          if (/registered|already|exists/i.test(m)) toast('Un compte existe déjà avec ce numéro.', 'error');
          else toast('Inscription impossible : ' + m, 'error');
          return;
        }
        var authUser = resp.data && resp.data.user;
        var session = resp.data && resp.data.session;
        if (!session) {
          // Pas de session immédiate = la confirmation e-mail est activée. On ne
          // connecte pas et on n'écrit pas encore le profil (l'upsert serait refusé
          // par la RLS faute de session) : la fiche sera créée à la 1re connexion
          // confirmée, via applyAuthUser. On mémorise les sections choisies pour
          // qu'elles soient conservées à ce moment-là.
          try { localStorage.setItem('kc_pending_signup', JSON.stringify({ email: email, phone: phoneDisplay, prenom: prenom, nom: nom, sections: userSecs, section_id: userSecs[0] })); } catch(e){}
          toast('Compte créé ! Connectez-vous avec votre numéro.', 'success');
          S.auth = 'login'; S.signupSections = []; S.signupRole = 'MEMBRE'; S.champsAuth = {};
          render();
          return;
        }

        var newUser = { id: authUser.id, prenom: prenom, nom: nom, phone: phoneDisplay,
          sections: userSecs, section_id: userSecs[0], role: 'MEMBRE', is_online: true,
          last_seen_at: new Date().toISOString(), last_action: 'Inscription',
          avatar_color: ['#0B5FE0','#FF2D55','#0E9F6E','#D98A0B','#0B5FE0','#AF52DE'][Math.floor(Math.random()*6)],
          welcomeStars: 5, joined_at: Date.now(),   // bonus 5★ + date d'inscription
          // Trace de l'acceptation des conditions (version et date).
          conditionsAcceptees: { version: CONDITIONS_VERSION, le: Date.now() }, conditionsLues: CONDITIONS_VERSION,
          // En attente jusqu'à la validation par un Admin ou un Responsable
          // (le serveur impose de toute façon cette valeur).
          approuve: false };

        // Écrit le profil (SANS aucun secret : ni mot de passe, ni question de
        // sécurité). Autorisé par la policy RLS car id = auth.uid().
        try {
          var syncRes = await supabase.from('kun_com_profiles')
            .upsert({ id: newUser.id, content: newUser }, { onConflict: 'id' });
          if (syncRes.error) console.error('Supabase profile save error:', syncRes.error);
        } catch(err) { console.warn('Supabase signup sync exception:', err); }

        // Enregistre les questions de sécurité (hachées côté serveur via l'Edge
        // Function). Bloquant : sans elles, le membre n'aurait aucun moyen de
        // récupération. On la connexion vient d'être établie -> JWT disponible.
        try {
          var secRes = await supabase.functions.invoke('password-recovery', {
            body: { action: 'set', phone: phoneDigits, q1: secQA.q1, q2: secQA.q2, a1: secQA.a1, a2: secQA.a2 }
          });
          if (secRes && secRes.error) console.warn('set security questions error:', secRes.error);
        } catch(err) { console.warn('set security questions exception:', err); }

        var users = db(SK.USERS, []);
        users.push(newUser); dbSet(SK.USERS, users);
        sauverSession(newUser);
        S.user = newUser; S.auth = 'app';
        // L'arrivée est annoncée à l'équipe au moment de la validation
        // (App.validerInscription), plus à l'inscription.

        S.signupSections = []; S.signupRole = 'MEMBRE'; S.champsAuth = {};
        render();
        toast('Bienvenue ' + prenom + ' ! Ton compte a été créé.', 'success');
        try { syncSupabaseToLocal(); } catch(e){}
      } catch(err) {
        console.warn('signup error:', err);
        toast('Inscription impossible. Réessayez.', 'error');
      } finally {
        App._signupEnCours = false;
      }
    },
    toggleSearch: function() {
      S.searchOpen = !S.searchOpen;
      if (!S.searchOpen) { S.q = ''; S.searchFocused = false; }
      render();
      if (S.searchOpen) { setTimeout(function(){ var i = document.getElementById('searchInput'); if (i) i.focus(); }, 90); }
    },
    toggleTheme: function() {
      S.darkMode = !S.darkMode;
      try { localStorage.setItem('kc_dark', S.darkMode ? '1' : '0'); } catch(e){}
      try { applyTheme(); } catch(e){}
      render();
    },
    // Vide tous les caches du service worker puis recharge l'app : utile quand
    // un appareil affiche une ancienne version malgré une mise à jour (cache
    // persistant, réseau capricieux). Le SW re-remplit son cache au chargement.
    viderCacheApp: async function() {
      try {
        if (!window.confirm('Vider le cache de l\'application ? L\'app va se recharger.')) return;
        if (window.caches && caches.keys) {
          var cles = await caches.keys();
          await Promise.all(cles.map(function(k){ return caches.delete(k); }));
        }
        toast('Cache vidé. Rechargement…', 'success');
        setTimeout(function(){ location.reload(); }, 400);
      } catch(e) { toast('Impossible de vider le cache.', 'error'); }
    },
    logout: async function() {
      if (S.user) {
        var users = db(SK.USERS, []); var idx = users.findIndex(function(u){ return u.id===S.user.id; });
        if (idx !== -1) { users[idx].is_online=false; users[idx].last_action='Déconnexion'; dbSet(SK.USERS, users); }
      }
      // Déconnexion RÉELLE : couper la session Supabase (sinon getSession() au
      // rechargement reconnecte automatiquement). onAuthStateChange remettra
      // l'écran de connexion.
      // Ce téléphone ne doit plus recevoir les notifications du compte quitté.
      try {
        var subPush = await App._abonnementPush();
        if (subPush && supabase) await supabase.from('kun_com_push_abonnements').delete().eq('id', subPush.endpoint);
      } catch(e) {}
      try { if (supabase && supabase.auth) await supabase.auth.signOut(); } catch(e) { console.warn('signOut:', e); }
      localStorage.removeItem(SK.SESS); sessionStorage.removeItem(SK.SESS);
      S.user=null; S.jwtRole=null; S.jwtApprouve=false; S.auth='login'; S.tab='home'; render();
    },
    // Écran d'attente : la validation a-t-elle eu lieu ? Nouveau jeton (qui
    // porte app_metadata.approuve) puis relecture de sa fiche.
    verifierValidation: async function() {
      if (S.verificationEnCours || !supabase) return;
      S.verificationEnCours = true; render();
      try {
        try {
          var sess = await supabase.auth.refreshSession();
          if (sess && sess.data && sess.data.user) applyAuthUser(sess.data.user);
        } catch(e) {}
        await fetchProfilesSilently();
      } finally {
        S.verificationEnCours = false;
      }
      if (compteEnAttente(S.user)) {
        render();
        toast('Pas encore validé. Réessaie un peu plus tard.', 'info');
        return;
      }
      if (S.user) S.user.approuve = true;
      render();
      toast('Ton compte est validé. Bienvenue dans l\'équipe !', 'success');
      try { syncSupabaseToLocal(); } catch(e) {}
    },
    // Admin ou Responsable : valide (ou refuse) une inscription. Le refus
    // supprime le compte ; la validation annonce l'arrivée à toute l'équipe.
    validerInscription: async function(userId, accepter) {
      var users = db(SK.USERS, []);
      var m = users.find(function(x){ return x.id === userId; });
      if (!m || !supabase || !supabase.functions) return;
      var nom = ((m.prenom || '') + ' ' + (m.nom || '')).trim() || 'cette personne';
      if (!accepter && !window.confirm('Refuser l\'inscription de ' + nom + ' ? Son compte sera supprimé.')) return;
      try {
        var r = await supabase.functions.invoke('set-role', { body: { action: accepter ? 'approuver' : 'refuser', userId: userId } });
        if (r && r.error) {
          var msg = 'Échec : réessaie dans un instant.';
          try { if (r.error.context && r.error.context.json) { var b = await r.error.context.json(); if (b && b.error) msg = b.error; } } catch(e){}
          toast(msg, 'error');
          return;
        }
      } catch(e) { toast('Échec : réessaie dans un instant.', 'error'); return; }
      users = db(SK.USERS, []);
      if (accepter) {
        var idx = users.findIndex(function(x){ return x.id === userId; });
        if (idx !== -1) { users[idx].approuve = true; dbSet(SK.USERS, users); }
        try { announceNewMember(users[idx] || m); } catch(e) {}
        toast(nom + ' a maintenant accès à Commit.', 'success');
      } else {
        dbSet(SK.USERS, users.filter(function(x){ return x.id !== userId; }));
        toast('Inscription refusée.', 'success');
      }
      render();
    },

    // ============================================================
    // SUPPRESSION DE COMPTE — irréversible : supprime le profil ET
    // toutes les publications de l'utilisateur (local + Supabase).
    // ============================================================
    // Vues d'une publication
    openViewers: function(postId) { S.viewersPostId = postId; render(); },
    closeViewers: function() { S.viewersPostId = null; render(); },

    // ============================================================
    // SUPPRESSION GROUPÉE DE PUBLICATIONS (depuis le profil)
    // ============================================================
    toggleProfileSelectMode: function() {
      S.profileSelectMode = !S.profileSelectMode;
      S.selectedProfilePostIds = [];
      render();
    },
    // Bascule entre « Publications » (les miennes) et « Enregistrées » (celles
    // que j'ai mises en favori, quel qu'en soit l'auteur) dans la grille du profil.
    setProfileGridTab: function(tab) {
      S.profileGridTab = tab;
      S.profileSelectMode = false;
      S.selectedProfilePostIds = [];
      render();
    },
    // Une image de publication hébergée peut expirer ou échouer à charger (URL
    // cassée, politique du bucket) : sans repli, la tuile de la grille du profil
    // restait totalement vide. On la remplace par le texte de la publication.
    handleProfileTileImgError: function(img) {
      var wrap = img.closest('[data-tile]');
      if (!wrap) return;
      var media = wrap.querySelectorAll('img,video');
      for (var i = 0; i < media.length; i++) media[i].remove();
      var fallback = document.createElement('div');
      fallback.style.cssText = 'width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;line-height:1.45;color:var(--muted);overflow:hidden;';
      fallback.textContent = img.getAttribute('data-fallback') || 'Publication';
      wrap.insertBefore(fallback, wrap.firstChild);
    },
    toggleSelectProfilePost: function(postId) {
      var idx = S.selectedProfilePostIds.indexOf(postId);
      if (idx !== -1) S.selectedProfilePostIds.splice(idx, 1);
      else S.selectedProfilePostIds.push(postId);
      render();
    },
    selectAllProfilePosts: function() {
      if (!S.user) return;
      var myIds = db(SK.POSTS, []).filter(function(p){ return p.userId === S.user.id; }).map(function(p){ return p.id; });
      var allSelected = myIds.length > 0 && myIds.every(function(id){ return S.selectedProfilePostIds.indexOf(id) !== -1; });
      S.selectedProfilePostIds = allSelected ? [] : myIds;
      render();
    },
    openBulkDeleteConfirm: function() {
      if ((S.selectedProfilePostIds || []).length === 0) return;
      S.bulkDeleteConfirmOpen = true;
      S.bulkDeleteBusy = false;
      render();
    },
    closeBulkDeleteConfirm: function() { if (S.bulkDeleteBusy) return; S.bulkDeleteConfirmOpen = false; render(); },
    confirmBulkDelete: async function() {
      if (S.bulkDeleteBusy) return;
      var ids = (S.selectedProfilePostIds || []).slice();
      if (ids.length === 0) return;
      S.bulkDeleteBusy = true;
      render();
      try {
        var posts = db(SK.POSTS, []);
        // Contrôle de propriété : la sélection venait d'un état UI falsifiable.
        // On ne supprime que les publications appartenant réellement à
        // l'utilisateur (ou toutes si Admin), comme deletePost le fait unitairement.
        var uBulk = S.user || {};
        var toDelete = posts.filter(function(p){ return ids.indexOf(p.id) !== -1 && (p.userId === uBulk.id || uBulk.role === 'GRAND_RESPONSABLE'); });
        var remaining = posts.filter(function(p){ return ids.indexOf(p.id) === -1 || !(p.userId === uBulk.id || uBulk.role === 'GRAND_RESPONSABLE'); });
        dbSet(SK.POSTS, remaining);

        if (supabase) {
          // Suppression douce (voir App.deletePost) : sans marqueur explicite
          // status:'deleted', mergePostsWithLocal (additif par conception) ne
          // propage jamais la disparition aux autres appareils.
          toDelete.forEach(function(p) {
            var tombstone = Object.assign({}, p, { status: 'deleted' });
            supabase.from('kun_com_posts').upsert({ id: p.id, content: tombstone }, { onConflict: 'id' })
              .then(function(){}, function(e){
                console.warn('Bulk delete post error:', e);
                App._mettreEnFileAttenteEcriture({ table: 'kun_com_posts', row: { id: p.id, content: tombstone } });
              });
          });
        }
        toDelete.forEach(function(p) {
          deleteUnusedMediaFromStorage((p.mediaUrls || []), p.id);
        });

        S.bulkDeleteConfirmOpen = false;
        S.bulkDeleteBusy = false;
        S.profileSelectMode = false;
        S.selectedProfilePostIds = [];
        render();
        toast(ids.length + ' publication' + (ids.length>1?'s':'') + ' supprimée' + (ids.length>1?'s':'') + '.', 'success');
      } catch (e) {
        console.warn('confirmBulkDelete error:', e);
        S.bulkDeleteBusy = false;
        render();
        toast('Une erreur est survenue. Réessayez.', 'error');
      }
    },

    openDeleteAccount: function() { S.deleteAccountOpen = true; S.deleteAccountBusy = false; render(); setTimeout(function(){ var i=document.getElementById('deleteAccountConfirmInput'); if(i) i.focus(); },150); },
    closeDeleteAccount: function() { if (S.deleteAccountBusy) return; S.deleteAccountOpen = false; render(); },
    confirmDeleteAccount: async function() {
      if (S.deleteAccountBusy) return;
      var input = document.getElementById('deleteAccountConfirmInput');
      var val = (input ? input.value : '').trim().toUpperCase();
      if (val !== 'SUPPRIMER') { toast('Tapez SUPPRIMER pour confirmer.', 'error'); return; }
      if (!S.user) return;
      var userId = S.user.id;

      S.deleteAccountBusy = true;
      render();

      try {
        // 1) Supprime toutes les publications de l'utilisateur (local + Supabase)
        var posts = db(SK.POSTS, []);
        var myPosts = posts.filter(function(p){ return p.userId === userId; });
        var remainingPosts = posts.filter(function(p){ return p.userId !== userId; });
        dbSet(SK.POSTS, remainingPosts);

        // Le cache local ne contient qu'une page récente (60 publications) : s'en
        // tenir à lui laissait DÉFINITIVEMENT en ligne les publications plus
        // anciennes, sans auteur et impossibles à supprimer ensuite. On demande
        // donc au serveur la liste complète des publications de ce compte.
        if (supabase) {
          try {
            var resMiennes = await supabase.from('kun_com_posts').select('*').eq('content->>userId', userId);
            if (resMiennes && resMiennes.data) {
              var connues = {};
              myPosts.forEach(function(p){ if (p && p.id) connues[p.id] = true; });
              resMiennes.data.forEach(function(item) {
                var p = parsePostItem(item);
                if (p && p.id && !connues[p.id]) { connues[p.id] = true; myPosts.push(p); }
              });
            }
          } catch(e) { console.warn('Lecture des publications à supprimer :', e); }
        }

        if (supabase) {
          // Suppression douce (voir App.deletePost) : sans marqueur explicite
          // status:'deleted', mergePostsWithLocal (additif par conception) ne
          // propage jamais la disparition aux autres appareils.
          myPosts.forEach(function(p) {
            var tombstone = Object.assign({}, p, { status: 'deleted' });
            supabase.from('kun_com_posts').upsert({ id: p.id, content: tombstone }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Delete post error:', e); });
          });
        }
        // Nettoie les fichiers médias associés dans Storage (sauf s'ils sont encore
        // utilisés par un partage fait par quelqu'un d'autre).
        myPosts.forEach(function(p) {
          deleteUnusedMediaFromStorage((p.mediaUrls || []), p.id);
        });

        // 1 bis) Retire ses traces DANS les publications des autres : ses J'aime
        // (qui continuaient d'être comptés), ses commentaires et réponses, ses
        // votes aux sondages, ses vues et ses assignations. Sans cela, un compte
        // supprimé restait visible partout ailleurs que dans ses propres
        // publications.
        var restantsNettoyes = retirerTracesDUnCompte(remainingPosts, userId);
        dbSet(SK.POSTS, restantsNettoyes.posts);
        if (supabase && restantsNettoyes.modifies.length) {
          restantsNettoyes.modifies.forEach(function(p) {
            // Ses commentaires sont désignés explicitement : le serveur ne
            // supprime jamais un commentaire sur sa seule absence (migration 06).
            var avant = remainingPosts.find(function(x){ return x && x.id === p.id; }) || {};
            var miens = (avant.comments || []).filter(function(c){ return c && c.userId === userId && c.id; })
              .map(function(c){ return c.id; });
            var contenu = miens.length ? Object.assign({}, p, { _supprimerCommentaires: miens }) : p;
            supabase.from('kun_com_posts').upsert({ id: p.id, content: contenu }, { onConflict: 'id' })
              .then(function(){}, function(e){ console.warn('Nettoyage des traces sur ' + p.id + ' :', e); });
          });
        }

        // 2) Supprime le profil utilisateur (local + Supabase)
        var users = db(SK.USERS, []);
        var remainingUsers = users.filter(function(u){ return u.id !== userId; });
        dbSet(SK.USERS, remainingUsers);
        // Lève la protection anti-purge : le compte est supprimé volontairement,
        // il ne doit donc plus être conservé ni réinjecté par la synchronisation.
        removeLocalAccountId(userId);

        if (supabase) {
          try {
            await supabase.from('kun_com_profiles').delete().eq('id', userId);
          } catch(e) { console.warn('Delete profile error:', e); }
        }

        // 2 bis) Suppression RÉELLE du compte dans auth.users, via l'Edge
        // Function « delete-account » (clé service_role côté serveur). Sans
        // elle, le compte restait supprimable en apparence mais une simple
        // reconnexion recréait la fiche : le membre « supprimé » réapparaissait
        // dans l'annuaire. Si la fonction n'est pas encore déployée, on
        // continue (la fiche est déjà retirée) et l'erreur est journalisée.
        if (supabase && supabase.functions) {
          try {
            var rDelCompte = await supabase.functions.invoke('delete-account', { body: {} });
            if (rDelCompte && rDelCompte.error) console.warn('delete-account :', rDelCompte.error);
          } catch(eDelCompte) { console.warn('delete-account indisponible :', eDelCompte); }
        }

        // 3) Nettoie la session locale et revient à l'écran de connexion
        localStorage.removeItem(SK.SESS);
        sessionStorage.removeItem(SK.SESS);
        S.user = null;
        S.auth = 'login';
        S.tab = 'home';
        S.deleteAccountOpen = false;
        S.deleteAccountBusy = false;
        render();
        toast('Votre compte et vos publications ont été supprimés.', 'success');
      } catch(e) {
        console.warn('confirmDeleteAccount error:', e);
        S.deleteAccountBusy = false;
        render();
        toast('Une erreur est survenue. Réessayez.', 'error');
      }
    },

    // ============================================================
    // PANNEAU ADMIN — statistiques de stockage Supabase
    // Réservé au rôle Admin, lu dans le JWT. (Il était auparavant protégé par un
    // code écrit en clair dans le code source, donc lisible par n'importe qui.)
    // ============================================================
    // Rétrograde le compte connecté au rôle MEMBRE. Le rôle vit dans le JWT
    // (app_metadata), pas dans la fiche : l'ancienne version ne modifiait que la
    // fiche, et la reconnexion suivante rendait le rôle Admin. On passe donc par
    // l'Edge Function « set-role », qui refuse de retirer le DERNIER Admin.
    revokeGrandResponsable: async function() {
      if (!S.user || S.jwtRole !== 'GRAND_RESPONSABLE') return;
      if (!window.confirm('Quitter le rôle Admin et repasser en Membre simple ?')) return;
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      try {
        var r = await supabase.functions.invoke('set-role', { body: { userId: S.user.id, role: 'MEMBRE' } });
        if (r && r.error) {
          var msg = 'Échec : le rôle n\'a pas été modifié.';
          try { if (r.error.context && r.error.context.json) { var b = await r.error.context.json(); if (b && b.error) msg = b.error; } } catch(e){}
          toast(msg, 'error');
          return;
        }
        // Nouveau JWT tout de suite, pour que l'interface suive sans reconnexion.
        try {
          var sess = await supabase.auth.refreshSession();
          if (sess && sess.data && sess.data.user) applyAuthUser(sess.data.user);
        } catch(e) {}
        render();
        toast('Rôle Admin retiré — vous êtes de nouveau Membre.', 'success');
      } catch(e) {
        toast('Échec : le rôle n\'a pas été modifié.', 'error');
      }
    },
    openStorageStats: function() {
      if (!isGrandResponsable(S.user)) { toast('Réservé à l\'Admin.', 'error'); return; }
      S.storageStatsOpen = true;
      render();
      App.loadStorageStats();
    },
    closeStorageStats: function() { S.storageStatsOpen = false; render(); },

    // ---- Gestion des rôles (réservée au Admin) ----
    // Le changement de rôle passe par l'Edge Function « set-role » qui écrit le
    // rôle dans le JWT (app_metadata) côté serveur — un membre ne peut donc pas
    // se promouvoir lui-même. La personne concernée doit se reconnecter pour que
    // son nouveau jeton (et donc ses droits) prenne effet.
    openRolesPanel: function() {
      var meProf = S.user && db(SK.USERS, []).find(function(x){ return x.id === S.user.id; });
      var amAdmin = S.jwtRole === 'GRAND_RESPONSABLE'
        || (S.user && S.user.role === 'GRAND_RESPONSABLE')
        || (meProf && meProf.role === 'GRAND_RESPONSABLE');
      if (!amAdmin) { toast('Réservé à l\'Admin.', 'error'); return; }
      S.rolesPanelOpen = true; render();
    },
    closeRolesPanel: function() { S.rolesPanelOpen = false; S.roleUpdatingId = null; render(); },
    setMemberRole: async function(userId, role) {
      // Test sur le rôle du JWT (S.jwtRole, signé par Supabase) et non sur
      // S.user.role : ce dernier vient d'un JSON stocké en localStorage,
      // modifiable — adminResetPassword utilise déjà le JWT, on s'aligne.
      if (!S.user || S.jwtRole !== 'GRAND_RESPONSABLE') { toast('Réservé au Admin.', 'error'); return; }
      if (userId === S.user.id) { toast('Vous ne pouvez pas modifier votre propre rôle ici (évite de te verrouiller dehors). Passe par un autre Admin.', 'info'); return; }
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      var LABELS = { STAGIAIRE: 'Stagiaire', MEMBRE: 'Membre', RESP_SECTION: 'Responsable de pôle', GRAND_RESPONSABLE: 'Admin' };
      S.roleUpdatingId = userId; render();
      try {
        var r = await supabase.functions.invoke('set-role', { body: { userId: userId, role: role } });
        if (r && r.error) {
          var msg = 'Échec de la mise à jour.';
          try { if (r.error.context && r.error.context.json) { var b = await r.error.context.json(); if (b && b.error) msg = b.error; } } catch(e){}
          toast(msg, 'error');
        } else {
          var users = db(SK.USERS, []);
          var idx = users.findIndex(function(u){ return u.id === userId; });
          // Un changement de rôle valide aussi le compte (voir set-role).
          if (idx !== -1) { users[idx].role = role; users[idx].approuve = true; dbSet(SK.USERS, users); }
          toast('Rôle mis à jour : ' + (LABELS[role] || role) + '. La personne doit se reconnecter.', 'success');
        }
      } catch(e) { toast('Échec de la mise à jour.', 'error'); }
      S.roleUpdatingId = null; render();
    },
    // Réinitialisation du mot de passe d'un membre par l'Admin (pour les comptes
    // sans questions de sécurité). L'Edge Function génère un mot de passe
    // provisoire via l'API admin ; on l'affiche à l'Admin pour qu'il le transmette.
    adminResetPassword: async function(userId, name) {
      if (!S.user || S.jwtRole !== 'GRAND_RESPONSABLE') { toast('Réservé à l\'Admin.', 'error'); return; }
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      if (!window.confirm('Générer un mot de passe provisoire pour ' + (name || 'ce membre') + ' ?')) return;
      try {
        var r = await supabase.functions.invoke('password-recovery', { body: { action: 'admin-reset', userId: userId } });
        if (r && r.error) {
          var msg = 'Échec de la réinitialisation.';
          try { if (r.error.context && r.error.context.json) { var b = await r.error.context.json(); if (b && b.error) msg = b.error; } } catch(e){}
          toast(msg, 'error'); return;
        }
        if (!r || !r.data || !r.data.ok) { toast('Échec de la réinitialisation.', 'error'); return; }
        S.adminResetResult = { name: name || 'ce membre', password: r.data.password };
        render();
      } catch(e) { toast('Échec de la réinitialisation.', 'error'); }
    },
    closeAdminReset: function() { S.adminResetResult = null; render(); },
    openSettings: function() { S.settingsOpen = true; render(); App.verifierEtatPush(); },
    closeSettings: function() { S.settingsOpen = false; render(); },

    // ---- Notifications sur le téléphone ----
    _abonnementPush: async function() {
      if (!pushDisponible()) return null;
      var reg = await navigator.serviceWorker.getRegistration();
      return reg ? await reg.pushManager.getSubscription() : null;
    },
    verifierEtatPush: async function() {
      try {
        var sub = await App._abonnementPush();
        var etat = sub ? 'actif' : 'inactif';
        if (S.pushEtat !== etat) { S.pushEtat = etat; render(); }
      } catch(e) {}
    },
    activerPush: async function() {
      if (!pushDisponible() || !S.user || !supabase) { toast('Notifications indisponibles sur cet appareil.', 'error'); return; }
      S.pushEtat = 'encours'; render();
      try {
        var permission = await Notification.requestPermission();
        if (permission !== 'granted') { S.pushEtat = 'inactif'; render(); toast('Autorisation refusée : rien ne sera envoyé sur ce téléphone.', 'info'); return; }
        var cle = await supabase.functions.invoke('push', { body: { action: 'cle' } });
        if (!cle || cle.error || !cle.data || !cle.data.publique) throw new Error('clé indisponible');
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.getSubscription() ||
          await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(cle.data.publique) });
        var res = await supabase.from('kun_com_push_abonnements')
          .upsert({ id: sub.endpoint, user_id: S.user.id, abonnement: sub.toJSON() }, { onConflict: 'id' });
        if (res && res.error) throw res.error;
        S.pushEtat = 'actif'; render();
        toast('Notifications activées sur ce téléphone.', 'success');
      } catch(e) {
        console.warn('activerPush :', e);
        S.pushEtat = 'inactif'; render();
        toast('Activation impossible pour le moment. Réessaie plus tard.', 'error');
      }
    },
    desactiverPush: async function() {
      try {
        var sub = await App._abonnementPush();
        if (sub) {
          if (supabase) await supabase.from('kun_com_push_abonnements').delete().eq('id', sub.endpoint);
          await sub.unsubscribe();
        }
      } catch(e) { console.warn('desactiverPush :', e); }
      S.pushEtat = 'inactif'; render();
      toast('Notifications coupées sur ce téléphone.', 'success');
    },
    basculerPrefNotif: function(id) {
      if (!S.user) return;
      var prefs = Object.assign({}, S.user.preferencesNotif || {});
      prefs[id] = !prefNotifActive(S.user, id);
      App._majMonProfil({ preferencesNotif: prefs });
    },
    // Écran ouvert par le toucher d'une notification (voir sw.js).
    ouvrirCible: function(cible) {
      cible = String(cible || '');
      if (cible.indexOf('dm:') === 0) { App.openDirectMessage(cible.slice(3)); return; }
      if (cible.indexOf('pole:') === 0) { App.openDirectMessage(cible); return; }
      if (cible === 'planning') { App.tab('planning'); return; }
      App.openNotifications();
    },
    copyAdminResetPw: function() {
      var r = S.adminResetResult; if (!r) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.password);
        toast('Mot de passe copié.', 'success');
      } catch(e) { toast('Copie impossible — notez-le manuellement.', 'info'); }
    },
    // Additionne la taille de tous les fichiers du bucket post-media, page par page
    // (l'API Storage limite à 1000 résultats par appel).
    loadStorageStats: async function() {
      if (!supabase) { S.storageStatsError = 'Connexion indisponible.'; render(); return; }
      S.storageStatsLoading = true;
      S.storageStatsError = null;
      render();
      // Garde-fou : si l'appel Storage reste bloqué (réseau, CORS, policy manquante
      // qui ne renvoie jamais), on n'affiche pas un spinner infini — on bascule sur
      // un message d'erreur après 15s au lieu de laisser croire que "ça ne marche pas"
      // sans explication.
      function withTimeout(p, ms) {
        return Promise.race([
          p,
          new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('Délai dépassé après ' + (ms/1000) + 's — vérifie la connexion ou les permissions Supabase.')); }, ms);
          })
        ]);
      }
      try {
        var totalBytes = 0;
        var fileCount = 0;
        var offset = 0;
        var pageSize = 1000;
        while (true) {
          var res = await withTimeout(
            supabase.storage.from('post-media').list('', { limit: pageSize, offset: offset, sortBy: { column: 'name', order: 'asc' } }),
            15000
          );
          if (res.error) throw res.error;
          var items = res.data || [];
          items.forEach(function(it) {
            // .list() renvoie aussi les "dossiers" virtuels (sans metadata) — on ne
            // compte que les vrais fichiers.
            if (it && it.metadata && typeof it.metadata.size === 'number') {
              totalBytes += it.metadata.size;
              fileCount++;
            }
          });
          if (items.length < pageSize) break;
          offset += pageSize;
          if (offset > 200000) break; // garde-fou anti-boucle infinie
        }
        S.storageStatsTotalBytes = totalBytes;
        S.storageStatsFileCount = fileCount;
        S.storageStatsUpdatedAt = Date.now();
      } catch (e) {
        console.warn('loadStorageStats error:', e);
        // On affiche le détail réel de l'erreur Supabase (au lieu d'un message
        // générique) pour pouvoir diagnostiquer immédiatement depuis l'app.
        var detail = e && (e.message || e.error_description || e.msg || e.statusText);
        S.storageStatsError = 'Impossible de lire le stockage' + (detail ? ' : ' + detail : ' (vérifie la permission SELECT sur storage.objects pour le bucket post-media).');
      }
      S.storageStatsLoading = false;
      render();
    },

    // Navigation
    tab: function(t) {
      // Noter est réservé aux Grands Responsables, mais consulter le Suivi
      // (historique des bilans déjà publiés) est ouvert à tout le monde : sans
      // ça, un membre perdait toute trace des notations une fois sorties du fil.
      if (t === 'debrief' && !(S.user && isGrandResponsable(S.user))) {
        S.debriefView = 'suivi';
      }
      S.tab=t;
      // Toucher un onglet de la barre du bas doit TOUJOURS y amener, quoi qu'il
      // y ait à l'écran. Avant : seuls createOpen/commentOpen/optionsOpen se
      // fermaient — un profil consulté, une messagerie, une visionneuse d'image
      // ou n'importe quelle autre fenêtre plein écran restait affichée par-dessus,
      // et appuyer sur « Accueil » donnait l'impression que rien ne s'était passé.
      S.createOpen=false; S.commentOpen=false; S.commentPostId=null; S.optionsOpen=false; S.optionsPost=null;
      S.viewUserProfileId=null; S.notificationsOpen=false; S.editProfileOpen=false;
      S.postOptionsOpen=false; S.selectedPostId=null; S.createEventOpen=false; S.editPostId=null;
      S.cropperOpen=false; S.membersListOpen=false; S.repostPostId=null; S.aboutEventPickerOpen=false;
      S.deleteAccountOpen=false; S.bulkDeleteConfirmOpen=false; S.viewersPostId=null; S.indisposOpen=false; S.declinerEvId=null;
      S.storageStatsOpen=false; S.dmOpen=false; S.dmWithUserId=null; S.boiteOpen=false; S.tableauOpen=false; S.assignManagerId=null; S.viewerImage=null;
      // Quitter un écran via la barre détruit proprement ce qui y vivait :
      // l'instance Cropper (canvas + listeners, sinon détachée du DOM mais
      // vivante) et l'interval de polling de la messagerie (sinon orphelin à
      // chaque sortie par la barre d'onglets).
      try { if (window._currentCropper) { window._currentCropper.destroy(); window._currentCropper = null; } } catch(eCropperTab){}
      try { App._stopDmPolling(); } catch(eDmTab){}
      render();
    },

    // Charge la page suivante de publications plus anciennes (pagination à la
    // demande — voir POSTS_PAGE_SIZE). N'efface jamais ce qui est déjà affiché :
    // mergePostsWithLocal est purement additif.
    loadMorePosts: async function() {
      if (S.loadingMorePosts || S.postsAllLoaded || !supabase) return;
      S.loadingMorePosts = true;
      render();
      try {
        // Pagination par CURSEUR (created_at du dernier post reçu) et non plus
        // par offset : avec .range(offset…), une publication créée entre deux
        // clics décalait toute la fenêtre et des publications plus anciennes
        // sautaient un créneau — devenues définitivement injoignables depuis
        // le fil. Avec un curseur, la fenêtre ne bouge pas.
        var curseur = S.postsRemoteCursor || null;
        if (!curseur) {
          var datesConnues = db(SK.POSTS, [])
            .map(function(p){ return p.created_at; })
            .filter(Boolean).sort().reverse();
          curseur = datesConnues[0] || null;
        }
        var requete = supabase.from('kun_com_posts').select('*').order('created_at', { ascending: false }).limit(POSTS_PAGE_SIZE);
        if (curseur) requete = requete.lt('created_at', curseur);
        var res = await requete;
        if (res && res.error) { console.warn('loadMorePosts error:', res.error); toast('Impossible de charger plus de publications.', 'error'); }
        if (res && res.data) {
          if (res.data.length < POSTS_PAGE_SIZE) S.postsAllLoaded = true;
          if (res.data.length > 0) {
            S.postsRemoteCursor = res.data[res.data.length - 1].created_at || S.postsRemoteCursor || null;
            var mergedPosts = mergePostsWithLocal(res.data);
            dbSet(SK.POSTS, mergedPosts);
          } else {
            S.postsAllLoaded = true;
          }
        }
      } catch (e) {
        console.warn('loadMorePosts exception:', e);
        toast('Impossible de charger plus de publications.', 'error');
      }
      S.loadingMorePosts = false;
      render();
    },
    story: function(s) {
      S.story=s; S.q='';
      if (s !== 'all') {
        var seen = db(SK.SECTION_SEEN, {});
        seen[s] = Date.now();
        dbSet(SK.SECTION_SEEN, seen);
      }
      render();
    },
    search: function(q) {
      S.q = q;
      // Debounced render (préserve la saisie ET le focus/curseur du champ)
      if (this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(function(){
        _restoringSearchFocus = true;
        render();
        var input = document.getElementById('searchInput');
        if (input) {
          input.focus();
          var len = input.value.length;
          try { input.setSelectionRange(len, len); } catch(e) {}
        }
        _restoringSearchFocus = false;
      }, 250);
    },
    setSearchFocused: function(v) {
      if (_restoringSearchFocus) return; // ignore les événements focus/blur déclenchés par le re-render lui-même
      if (v) {
        S.searchFocused = true;
        _restoringSearchFocus = true;
        render();
        var input = document.getElementById('searchInput');
        if (input) {
          input.focus();
          var len = input.value.length;
          try { input.setSelectionRange(len, len); } catch(e) {}
        }
        _restoringSearchFocus = false;
      } else {
        // Petit délai pour laisser le clic sur "Voir tous les membres" s'exécuter avant de masquer le bandeau
        setTimeout(function(){ S.searchFocused = false; render(); }, 180);
      }
    },
    openMembersList: function() { S.membersListOpen = true; S.membersSearch = ''; render(); },
    closeMembersList: function() { S.membersListOpen = false; render(); },
    setPunctualityChart: function(which) { S.punctualityChart = which; render(); },
    basculerHistorique: function() { S.historiqueTout = !S.historiqueTout; render(); },
    // Le membre coche (ou décoche) SA tâche à livrer sur un événement. La note
    // est ensuite recalculée automatiquement d'après la deadline (voir
    // punctualityHistory / taskStatusFor). Enregistrement à part (type
    // 'TASK_DONE', invisible dans le fil) que le membre possède — il peut donc
    // l'écrire et le retirer lui-même sans toucher à l'événement.
    toggleTaskDone: async function(eventId) {
      if (!S.user) return;
      var posts = db(SK.POSTS, []);
      var ev = posts.find(function(p){ return p.id === eventId && isEventLike(p); });
      if (!ev) { toast('Événement introuvable.', 'error'); return; }
      var mine = (ev.assignments || []).find(function(a){ return a && a.userId === S.user.id; });
      if (!mine || !mine.deadline) { toast('Aucune tâche à livrer pour vous ici.', 'error'); return; }

      var existing = posts.find(function(p){
        return p.type === 'TASK_DONE' && p.userId === S.user.id && p.taskEventId === eventId;
      });

      if (existing) {
        // Annulation : on retire la validation.
        var rest = posts.filter(function(p){ return p.id !== existing.id; });
        dbSet(SK.POSTS, rest);
        if (supabase) {
          try { supabase.from('kun_com_posts').delete().eq('id', existing.id).then(function(){}, function(){}); }
          catch(e) { console.warn('toggleTaskDone delete error:', e); }
        }
        render();
        toast('Tâche remise à faire.', 'info');
        return;
      }

      var now = Date.now();
      var rec = {
        id: 'td' + now,
        type: 'TASK_DONE',
        userId: S.user.id,
        author: (S.user.prenom || '') + ' ' + (S.user.nom || ''),
        taskEventId: eventId,
        taskDoneAt: now,
        timestamp: now
      };
      // Dédoublonnage SERVEUR : le cache local ne garde que ~60 publications,
      // une validation plus ancienne peut donc exister en base sans être dans
      // `posts`. Sans cette relecture, re-cocher créait un second enregistrement
      // distant que la dé-coche ne retirait qu'en partie. On réutilise l'id
      // existant : l'upsert met simplement l'horodatage à jour.
      if (supabase) {
        try {
          var resTD = await supabase.from('kun_com_posts').select('id')
            .filter('content->>type', 'eq', 'TASK_DONE')
            .filter('content->>userId', 'eq', String(S.user.id))
            .filter('content->>taskEventId', 'eq', String(eventId))
            .limit(1);
          if (resTD && resTD.data && resTD.data[0] && resTD.data[0].id) rec.id = resTD.data[0].id;
        } catch(eTDdedup) { console.warn('toggleTaskDone dedup error:', eTDdedup); }
      }
      posts.unshift(rec);
      dbSet(SK.POSTS, posts);
      if (supabase) {
        try { supabase.from('kun_com_posts').upsert({ id: rec.id, content: rec, created_at: new Date().toISOString() }, { onConflict: 'id' }).then(function(){}); }
        catch(e) { console.warn('toggleTaskDone upsert error:', e); }
      }
      render();
      var dlTs = new Date(mine.deadline).getTime();
      toast(now <= dlTs ? 'Tâche livrée à temps ! +5 ★' : 'Tâche livrée (en retard) · +2 ★', 'success');
    },
    searchMembers: function(q) { S.membersSearch = q; render(); var i=document.getElementById('membersSearchInput'); if(i){i.focus(); var l=i.value.length; try{i.setSelectionRange(l,l);}catch(e){}} },
    filterTag: function(tag) { S.q = decodeURIComponent(tag); S.tab='home'; render(); },

    // Posts
    like: function(postId) {
      if (!S.user) return;
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===postId; });
      if (!post) return;
      if (!Array.isArray(post.likedBy)) post.likedBy = [];
      var idx = post.likedBy.indexOf(S.user.id);
      if (idx === -1) { post.likedBy.push(S.user.id); }
      else { post.likedBy.splice(idx, 1); }
      var nowLiked = post.likedBy.indexOf(S.user.id) !== -1;
      dbSet(SK.POSTS, posts);
      // Rendu optimiste immédiat, puis écriture serveur via relecture fraîche :
      // appliquer notre état FINAL sur la version du serveur au lieu de réécrire
      // la version locale empêche d'effacer un like/commentaire concurrent.
      App.ecrirePostFrais(postId, function(frais) {
        if (!Array.isArray(frais.likedBy)) frais.likedBy = [];
        var iFrais = frais.likedBy.indexOf(S.user.id);
        if (nowLiked) { if (iFrais === -1) frais.likedBy.push(S.user.id); }
        else { if (iFrais !== -1) frais.likedBy.splice(iFrais, 1); }
      });
      if (nowLiked && post.userId && post.userId !== S.user.id) {
        sendNotificationToUser(post.userId, {
          type: 'LIKE',
          title: "❤️ Nouveau J'aime",
          text: (S.user.prenom + ' ' + (S.user.nom||'')) + ' a aimé votre publication.',
          targetId: post.id
        });
      }
      
      render(); // Force full UI update instantly
      
      var btn = document.getElementById('likeBtn-'+postId);
      if (btn && nowLiked) { btn.style.animation='heartPop 0.35s'; window.setTimeout(function(){btn.style.animation='';},350); }
    },
    doubleTapLike: function(postId) {
      this.like(postId);
      // Show floating heart animation
      var article = document.getElementById('post-'+postId);
      if (article) {
        var heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);font-size:80px;pointer-events:none;z-index:100;animation:heartFloat 0.8s forwards;';
        article.style.position = 'relative';
        article.appendChild(heart);
        setTimeout(function(){ heart.remove(); }, 800);
      }
    },
    expandCaption: function(postId) {
      S.expandedCaptions[postId] = !S.expandedCaptions[postId];
      // Re-render only the caption part (DOM targeted)
      render();
    },
    save: function(postId) {
      S.savedPosts[postId] = !S.savedPosts[postId];
      dbSet(SK.SAVED, S.savedPosts);
      var btn = document.getElementById('saveBtn-'+postId);
      if (btn) btn.innerHTML = SVG.bookmark(S.savedPosts[postId]);
      if (!S.optionsOpen) toast(S.savedPosts[postId] ? 'Publication enregistrée.' : 'Retiré des favoris.', 'success');
    },
    openRepostModal: function(postId) {
      if (!S.user) return;
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===postId; });
      if (!post) return;
      var alreadyReposted = posts.some(function(p){ return p.type === 'REPOST' && p.originalPostId === postId && p.userId === S.user.id; });
      if (alreadyReposted) { toast('Vous avez déjà partagé cette publication.', 'error'); return; }
      S.repostPostId = postId;
      S.postText = '';
      render();
    },
    closeRepostModal: function() {
      S.repostPostId = null;
      S.postText = '';
      render();
    },
    confirmRepost: function() {
      var postId = S.repostPostId;
      if (!postId || !S.user) return;
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===postId; });
      if (!post) return;
      var ta = document.getElementById('repostText');
      var txt = (ta ? ta.value : (S.postText||'')).trim();
      var repost = {
        id: 'rp_' + Date.now(), userId: S.user.id, timestamp: Date.now(),
        author: S.user.prenom + ' ' + S.user.nom,
        authorAvatar: S.user.prenom.charAt(0).toUpperCase(),
        avatarColor: S.user.avatar_color || '#0B5FE0',
        avatar_url: S.user.avatar_url || null,
        sectionId: post.sectionId || 'general', sectionNom: post.sectionNom || '',
        type: 'REPOST', originalPostId: postId,
        originalAuthor: post.author || 'Membre',
        originalCaption: post.caption || '',
        originalMediaUrls: (post.mediaUrls || []).slice(),
        originalPostBg: post.postBg || null,
        originalVideoPoster: post.videoPoster || null,
        caption: txt, mediaUrls: [], postBg: null,
        likes: 0, likedBy: [], comments: [],
        visibility: 'all', targetSections: []
      };
      posts.unshift(repost);
      dbSet(SK.POSTS, posts);
      if (supabase) {
        supabase.from('kun_com_posts').upsert({ id: repost.id, content: repost, created_at: new Date().toISOString() }, { onConflict: 'id' }).then(function(){}, function(e){});
      }
      saveLinksToProfile(repost.userId, extractLinks(txt), repost.id);
      notifyMentionedUsers(txt, repost.id);
      updateUserActivity('Partage');
      S.repostPostId = null;
      S.postText = '';
      render();
      toast('Publication partagée sur votre mur ! 🔄', 'success');
    },
    // Force l'affichage de la première image d'une vidéo sans vignette (poster).
    // Sans cela, un <video> non lu reste noir sur mobile. On avance très légèrement
    // la tête de lecture, ce qui oblige le navigateur à décoder et peindre une image.
    primeVideoFrame: function(el) {
      try {
        if (!el || el.getAttribute('poster')) return;
        if (el.dataset && el.dataset.framePrimed === '1') return;
        if (el.dataset) el.dataset.framePrimed = '1';
        if (el.currentTime < 0.1) {
          var d = el.duration;
          el.currentTime = (isFinite(d) && d > 0) ? Math.min(0.1, d / 10) : 0.1;
        }
      } catch(e){}
    },

    // Construit le lien public d'une publication (page de prévisualisation avec
    // miniature Open Graph, via la fonction serverless /api/p/:id), utilisable
    // en dehors de l'appli (WhatsApp, SMS, etc.).
    postShareUrl: function(postId) {
      return location.origin + '/api/p/' + encodeURIComponent(postId);
    },
    shareExternal: function(postId) {
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===postId; });
      var txt = post ? (post.caption||'').slice(0,100) : '';
      var url = App.postShareUrl(postId);
      if (navigator.share) {
        navigator.share({ title:'Commit VH', text:txt, url:url }).catch(function(){});
      } else {
        App.copyPostLink(postId);
      }
    },
    copyPostLink: function(postId) {
      var url = App.postShareUrl(postId);
      function done(ok) { toast(ok ? 'Lien copié ! Collez-le sur WhatsApp ou ailleurs.' : 'Impossible de copier le lien.', ok ? 'success' : 'error'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function(){ done(true); }, function(){ done(false); });
      } else {
        try {
          var ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus(); ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          done(ok);
        } catch(e) { done(false); }
      }
    },

    // Create post
    // Mentions & Privacy
    insertMention: function(mention) {
      var ta = document.getElementById('newPostText') || document.getElementById('editPostText') || document.getElementById('repostText');
      if (!ta) return;
      var val = ta.value;
      ta.value = val.replace(/@[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]*$/, mention);
      S.postText = ta.value;
      var box = document.getElementById('mentionSugg');
      if (box) box.style.display = 'none';
      ta.focus();
    },
    toggleTargetSection: function(sec) {
      S.postTargetSections = S.postTargetSections || [];
      var idx = S.postTargetSections.indexOf(sec);
      if (idx !== -1) S.postTargetSections.splice(idx, 1);
      else S.postTargetSections.push(sec);
      var container = document.getElementById('targetSectionBadgesContainer');
      if (container) {
        container.innerHTML = App.renderSectionBadges(S.postTargetSections, 'toggleTargetSection');
      } else {
        render();
      }
    },
    setPostVisibility: function(vis) {
      S.postVisibility = vis;
      render();
    },
    // "À propos" : lier une publication à un événement du planning (ex : culte de dimanche 7h30)
    openAboutEventPicker: function() { S.aboutEventPickerOpen = true; S.aboutEventSearch = ''; render(); },
    closeAboutEventPicker: function() { S.aboutEventPickerOpen = false; S.aboutEventSearch = ''; render(); },
    searchAboutEvents: function(val) {
      S.aboutEventSearch = val;
      var container = document.getElementById('aboutEventListContainer');
      if (container) container.innerHTML = renderAboutEventListHtml();
    },
    selectAboutEvent: function(eventId) {
      S.postAboutEventId = eventId;
      S.aboutEventPickerOpen = false;
      S.aboutEventSearch = '';
      render();
    },
    clearAboutEvent: function() { S.postAboutEventId = null; render(); },
    // Enregistrement d'arrivée : c'est CE choix, et lui seul, qui déclenche le
    // relevé de position et le calcul de ponctualité.
    setCheckInEvent: function(eventId) { S.postCheckInEventId = eventId || null; if (eventId) { try { startGeoPrewarm(); } catch(e){} } render(); },
    // Ouvre le composeur directement en mode pointage pour cet événement.
    startCheckIn: function(eventId) {
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
      if (!ev) { toast('Événement introuvable.', 'error'); return; }
      S.createOpen = true;
      S.pendingMedia = []; S.pendingVideoPoster = null; S.postBg = null;
      S.videoProcessing = false;
      S.postAboutEventId = null;
      S.postCheckInEventId = eventId;
      S.postText = 'Je suis arrivé pour ' + (ev.eventTitle || 'le service') + '.';
      // Pré-chauffe la position pendant que le membre rédige : au moment de
      // publier, elle est déjà prête (pas d'attente ni de prompt de dernière minute).
      try { startGeoPrewarm(); } catch(e){}
      render();
      setTimeout(function(){
        var t = document.getElementById('newPostText');
        if (t) { t.value = S.postText; t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
      }, 140);
    },
    clearCheckInEvent: function() { S.postCheckInEventId = null; render(); },

    // ---- Pointage en un geste (lot 2) ----
    // L'heure d'arrivée est figée au moment de l'appui ; la position est relevée
    // ensuite. Loin du lieu, on prévient AVANT d'enregistrer : un pointage hors
    // zone compte comme une absence, autant laisser une chance de se rapprocher.
    pointerEnUnGeste: async function(eventId, stampExistant, forcer) {
      if (!S.user || S.pointageEnCours) return;
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
      if (!ev) { toast('Événement introuvable.', 'error'); return; }
      if (hasCheckedIn(S.user.id, eventId)) { toast('Ton arrivée est déjà enregistrée.', 'info'); return; }
      var stamp = stampExistant || Date.now();
      var geo = forcer && S.pointageHorsZone ? S.pointageHorsZone.geo : null;
      fermerAlerteHorsZone();
      if (!geo) {
        S.pointageEnCours = eventId;
        render();
        try { geo = await positionForCheckIn(); }
        catch (e) { geo = { available: false, reason: 'unavailable' }; }
        S.pointageEnCours = null;
      }
      var essai = { geo: geo, checkInAt: stamp, checkInGraceUntil: stamp + CHECKIN_GRACE_MS };
      if (!forcer && checkInPresence(essai, ev) === 'offsite') {
        S.pointageHorsZone = { eventId: eventId, stamp: stamp, geo: geo, distance: checkInDistance(essai, ev) };
        render();
        ouvrirAlerteHorsZone();
        return;
      }
      var p = {
        id: 'p' + Date.now(), userId: S.user.id, timestamp: Date.now(),
        author: S.user.prenom + ' ' + S.user.nom,
        authorAvatar: (S.user.prenom || 'M').charAt(0).toUpperCase(),
        avatarColor: S.user.avatar_color || '#0B5FE0',
        avatar_url: S.user.avatar_url || null,
        sectionId: 'general', sectionNom: secNom('general'),
        caption: '📍 Arrivé(e) pour « ' + (ev.eventTitle || 'le service') + ' ».',
        mediaUrls: [], likes: 0, likedBy: [], comments: [], visibility: 'all', targetSections: [],
        checkInEventId: eventId, geo: geo, checkInAt: stamp, checkInGraceUntil: stamp + CHECKIN_GRACE_MS
      };
      var posts = db(SK.POSTS, []);
      posts.unshift(p);
      dbSet(SK.POSTS, posts);
      App._upsertFiable('kun_com_posts', { id: p.id, content: p, created_at: new Date().toISOString() });
      var presence = checkInPresence(p, ev);
      if (presence === 'onsite' || presence === 'no_venue') { try { announceArrival(p, ev); } catch(e){} }
      else if (presence === 'pending') { try { scheduleCheckInVerify(p.id); } catch(e){} }
      try { updateUserActivity('Pointage'); } catch(e) {}
      render();
      var debut = eventStartTimestamp(ev) || stamp;
      var retard = Math.round((stamp - debut) / 60000);
      var points = presence === 'offsite' ? PUNCTUALITY_OFFSITE_STARS : starsForDelay(retard);
      celebrerPointage(points,
        presence === 'offsite' ? 'Hors du lieu : compte comme une absence'
        : (retard <= 0 ? 'À l\'heure' : 'Retard de ' + retard + ' min') +
          (presence === 'onsite' ? ' · sur place' : presence === 'pending' ? ' · position en cours de vérification' : ''));
    },
    // Rattrapage : attache (ou met à jour) la position d'un pointage déjà publié,
    // sans toucher à l'heure d'arrivée (la ponctualité reste figée). Sert quand la
    // localisation avait été refusée par erreur, était lente, ou indisponible.
    confirmPresence: async function(postId) {
      var posts = db(SK.POSTS, []);
      var p = posts.find(function(x){ return x.id === postId; });
      if (!p || !p.checkInEventId) return;
      if (!S.user || p.userId !== S.user.id) { toast('Seul l\'auteur peut confirmer sa présence.', 'error'); return; }
      if (S.geoCapturing) return;
      S.geoCapturing = true; render();
      var g;
      // Capture FRAÎCHE (la personne peut s'être rapprochée du lieu entre-temps).
      try { g = await capturePosition(15000, 0, true); }
      catch (e) { g = { available: false, reason: 'unavailable' }; }
      S.geoCapturing = false;
      if (!g || !g.available) {
        render();
        toast('Localisation indisponible. Active-la dans les réglages puis réessaie.', 'error');
        return;
      }
      p.geo = g;                 // on n'écrase PAS checkInAt : la ponctualité est inchangée
      dbSet(SK.POSTS, posts);
      if (supabase) supabase.from('kun_com_posts').upsert({ id: p.id, content: p }, { onConflict: 'id' }).then(function(){}, function(e){});
      var evP = posts.find(function(x){ return x.id === p.checkInEventId && isEventLike(x); });
      var onsite = evP ? (checkInPresence(p, evP) === 'onsite') : true;
      if (onsite && evP) { try { announceArrival(p, evP); } catch(e){} }   // présence validée → tout le monde est prévenu
      render();
      toast(onsite ? 'Présence confirmée sur place. ' : 'Position enregistrée, mais hors zone.', onsite ? 'success' : 'info');
    },
    goToEvent: function(eventId) {
      var posts = db(SK.POSTS, []);
      var ev = posts.find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
      if (!ev) { toast('Cet événement n\'existe plus.', 'error'); return; }
      var todayIso = new Date().toISOString().split('T')[0];
      // On bascule sur l'onglet où l'événement se trouve réellement : un culte
      // terminé ce matin est dans l'Historique, pas dans « À venir ».
      S.planningMode = isEventPast(ev) ? 'history' : 'upcoming';
      S.selectedDate = ev.eventDate || todayIso;
      S.tab = 'planning';
      S.createOpen = false; S.commentOpen = false; S.optionsOpen = false;
      // Le carrousel du jour s'ouvre sur l'événement demandé, et non sur le premier.
      var sameDay = posts.filter(function(p) {
        return p.type === 'EVENT' && p.eventDate === S.selectedDate;
      }).sort(function(a,b) {
        var ap = isEventPast(a) ? 1 : 0, bp = isEventPast(b) ? 1 : 0;
        if (ap !== bp) return ap - bp;
        var as = a.eventStart || '', bs = b.eventStart || '';
        return ap ? bs.localeCompare(as) : as.localeCompare(bs);
      });
      var idx = sameDay.findIndex(function(p){ return p.id === eventId; });
      if (!S.eventGroupIdx) S.eventGroupIdx = {};
      S.eventGroupIdx[S.selectedDate] = idx > 0 ? idx : 0;
      render();
      // Le carrousel est un conteneur défilant : on le positionne après le rendu.
      if (idx > 0) {
        setTimeout(function() {
          var carId = 'evgrpplan-' + String(S.selectedDate || '').replace(/-/g, '');
          var el = document.getElementById(carId);
          if (el && el.clientWidth) el.scrollLeft = idx * el.clientWidth;
        }, 60);
      }
    },
    openEditPost: function(postId) {
      var posts = db(SK.POSTS, []);
      var p = posts.find(function(x){ return x.id === postId; });
      if (!p) return;
      // Même contrôle que deletePost : sans lui, n'importe qui appelant la
      // méthode (console, lien forgé) pouvait ouvrir l'éditeur d'un post tiers.
      var u = S.user || {};
      if (u.role !== 'GRAND_RESPONSABLE' && p.userId !== u.id) { toast('Action non autorisée.', 'error'); return; }
      S.editPostId = postId;
      S.postVisibility = p.visibility || 'all';
      S.postTargetSections = (p.targetSections || []).slice();
      S.pendingMedia = (p.mediaUrls || []).slice();
      S.postBg = p.postBg || null;
      S.postText = p.caption || '';
      S.pendingVideoPoster = p.videoPoster || null;
      S.postAboutEventId = p.aboutEventId || null;
      S.postCheckInEventId = p.checkInEventId || null;
      S.videoProcessing = false;
      render();
    },
    closeEditPost: function() {
      S.editPostId = null;
      S.pendingMedia = [];
      clearPendingLocalCopies();
      S.postBg = null;
      S.postText = '';
      S.pendingVideoPoster = null;
      S.postAboutEventId = null;
      S.videoProcessing = false;
      render();
    },
    saveEditPost: async function(postId) {
      if (S.videoProcessing) { toast('Patientez, la vidéo est en cours de traitement…', 'warning'); return; }
      var ta = document.getElementById('editPostText');
      var txt = (ta ? ta.value : (S.postText||'')).trim();
      if (!txt && S.pendingMedia.length === 0) { toast('Ajoutez du texte ou une photo.', 'error'); return; }
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id === postId; });
      if (!post) return;
      // Contrôle serveur-symétrique : l'ouverture de l'éditeur est déjà gardée,
      // mais la sauvegarde reste le point d'écriture réel — on y revérifie.
      var uSave = S.user || {};
      if (uSave.role !== 'GRAND_RESPONSABLE' && post.userId !== uSave.id) { toast('Action non autorisée.', 'error'); return; }

      post.caption = txt;
      post.is_edited = true;
      post.visibility = S.postVisibility || 'all';
      post.targetSections = (S.postTargetSections || []).slice();
      var oldMediaUrls = (post.mediaUrls || []).slice();
      post.mediaUrls = S.pendingMedia.slice();
      // Nettoie Storage pour les médias retirés pendant la modification (photo/vidéo
      // supprimée avant d'enregistrer), sauf s'ils sont encore utilisés ailleurs.
      var removedUrls = oldMediaUrls.filter(function(u){ return post.mediaUrls.indexOf(u) === -1; });
      if (removedUrls.length > 0) deleteUnusedMediaFromStorage(removedUrls, postId);
      post.videoPoster = S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? (S.pendingVideoPoster || null) : null;
      post.postBg = S.pendingMedia.length === 0 ? (S.postBg || null) : null;

      post.aboutEventId = S.postAboutEventId || null;

      // Si la modification transforme la publication en enregistrement d'arrivée,
      // le pointage se fait MAINTENANT : position relevée et horodatage à cet
      // instant. Sans ça, publier à l'heure puis pointer plus tard effacerait
      // tout retard.
      var newCheckInId = S.postCheckInEventId || null;
      var wasCheckIn = !!post.checkInEventId;
      post.checkInEventId = newCheckInId;
      if (newCheckInId && (!wasCheckIn || !post.checkInAt)) {
        post.checkInAt = Date.now();
        post.checkInByEdit = true;
        if (!post.geo) {
          toast('Enregistrement de votre position…', 'info');
          try { post.geo = await capturePosition(12000); }
          catch (err) { post.geo = { available: false, reason: 'unavailable' }; }
        }
      }

      var ephEl = document.getElementById('editPostEphemeral');
      if (ephEl) {
        if (ephEl.checked) {
          if (!post.is_ephemeral) post.ephemeral_expiry = Date.now() + 86400000;
          post.is_ephemeral = true;
        } else {
          post.is_ephemeral = false;
          post.ephemeral_expiry = null;
        }
      }

      var dateEl = document.getElementById('editPostScheduleDate');
      var timeEl = document.getElementById('editPostScheduleTime');
      if (dateEl && dateEl.value && timeEl && timeEl.value) {
        var schedDate = new Date(dateEl.value + 'T' + timeEl.value);
        if (schedDate.getTime() > Date.now()) {
          post.status = 'scheduled';
          post.scheduled_at = schedDate.getTime();
        } else {
          post.status = 'published';
          post.scheduled_at = null;
        }
      }

      dbSet(SK.POSTS, posts);
      if (supabase) {
        try {
          await supabase.from('kun_com_posts').upsert({ id: post.id, content: post, created_at: new Date(post.timestamp).toISOString() }, { onConflict: 'id' });
        } catch(e){}
      }

      // Notifie et enregistre les liens si la publication ciblée/modifiée en contient
      if (post.visibility === 'sections' && (!post.status || post.status !== 'scheduled')) {
        sendTargetedSectionPostNotifications(post);
      }
      saveLinksToProfile(post.userId, extractLinks(txt), post.id);

      S.editPostId = null;
      S.pendingMedia = [];
      clearPendingLocalCopies();
      S.postBg = null;
      S.postText = '';
      S.pendingVideoPoster = null;
      S.postAboutEventId = null;
      render();
      toast('Publication modifiée ! ', 'success');
    },
    basculerOptionsPublication: function() {
      // Préserve le texte en cours à travers le re-rendu.
      var ta = document.getElementById('newPostText'); if (ta) S.postText = ta.value;
      S.createOptionsOpen = !S.createOptionsOpen;
      render();
    },
    openCreate: function() { S.createOpen=true; S.createOptionsOpen=false; S.pendingMedia=[]; S.pendingVideoPoster=null; S.postAboutEventId=null; S.postCheckInEventId=null; S.videoProcessing=false; S.pollOpen=false; S.pollQuestion=''; S.pollOptions=['','']; S.linkPreview=null; S.linkPreviewUrl=null; S.linkPreviewLoading=false; S.linkPreviewDismissed=false; render(); setTimeout(function(){ var t=document.getElementById('newPostText'); if(t) t.focus(); },120); // Prépare l'outil de recadrage en arrière-plan : il n'est plus chargé au démarrage
      // de l'application (il en retardait l'affichage), mais l'avoir prêt dès l'ouverture
      // du composeur rend le recadrage instantané au moment de choisir une photo.
      try { chargerCropper(); } catch(e){} },
    closeCreate: function() {
      // Un brouillon substantiel mérite une confirmation : le fond du composeur
      // est cliquable et un tap mal placé effaçait un long texte sans retour.
      var brouillonSubstantiel = (S.postText && S.postText.trim()) ||
        (S.pendingMedia && S.pendingMedia.length > 0) ||
        (S.pollQuestion && S.pollQuestion.trim());
      if (brouillonSubstantiel && !window.confirm('Abandonner cette publication ? Le brouillon sera perdu.')) return;
      S.createOpen=false; S.pendingMedia=[]; clearPendingLocalCopies(); S.hashSuggestions=false; S.postBg=null; S.postText=''; S.pendingVideoPoster=null; S.postAboutEventId=null; S.postCheckInEventId=null; S.videoProcessing=false; S.pollOpen=false; S.pollQuestion=''; S.pollOptions=['','']; S.linkPreview=null; S.linkPreviewUrl=null; S.linkPreviewLoading=false; S.linkPreviewDismissed=false; render();
    },
    // Déplie / replie la pile des épinglés.
    togglePinnedStack: function() { S.pinnedOpen = !S.pinnedOpen; render(); },

    // ---- Visionneuse d'image ----
    openImageViewer: function(url) {
      if (!url) return;
      S.viewerImage = url;
      render();
    },
    closeImageViewer: function() { S.viewerImage = null; render(); },

    // ---- Aperçu de lien (composeur) ----
    // Détecte le premier lien du texte et va chercher ses métadonnées. Attend
    // 700 ms après la dernière frappe pour ne pas interroger le serveur à chaque
    // caractère pendant qu'on tape ou colle une longue URL.
    refreshLinkPreview: function(text) {
      var links = extractLinks(text || '');
      var url = links.length ? links[0] : null;

      if (!url) {
        if (S.linkPreview || S.linkPreviewUrl || S.linkPreviewLoading) {
          S.linkPreview = null; S.linkPreviewUrl = null; S.linkPreviewLoading = false;
          S.linkPreviewDismissed = false;
          render();
        }
        return;
      }
      // Lien inchangé : rien à refaire. Retiré à la main : on n'insiste pas.
      if (url === S.linkPreviewUrl || (S.linkPreviewDismissed && url === S.linkPreviewDismissed)) return;

      S.linkPreviewUrl = url;
      S.linkPreview = null;
      S.linkPreviewLoading = true;
      clearTimeout(window._linkPreviewTimer);
      window._linkPreviewTimer = setTimeout(function() {
        var asked = url;
        fetchLinkPreview(url).then(function(data) {
          // L'auteur a pu continuer à écrire : on ignore une réponse devenue
          // obsolète, sinon un ancien aperçu écraserait le nouveau.
          if (S.linkPreviewUrl !== asked) return;
          S.linkPreview = data || null;
          S.linkPreviewLoading = false;
          render();
        });
      }, 700);
      render();
    },
    // Retirer l'aperçu sans retirer le lien du texte.
    dismissLinkPreview: function() {
      S.linkPreviewDismissed = S.linkPreviewUrl;
      S.linkPreview = null;
      S.linkPreviewUrl = null;
      S.linkPreviewLoading = false;
      render();
    },

    // ---- Sondage (composeur) ----
    togglePoll: function() {
      S.pollOpen = !S.pollOpen;
      if (!S.pollOpen) { S.pollQuestion=''; S.pollOptions=['','']; }
      render();
    },
    setPollQuestion: function(val) { S.pollQuestion = val; },
    setPollOption: function(idx, val) { if (S.pollOptions && S.pollOptions[idx] !== undefined) S.pollOptions[idx] = val; },
    addPollOption: function() {
      if (!S.pollOptions) S.pollOptions = ['',''];
      if (S.pollOptions.length >= 5) return;
      S.pollOptions.push('');
      render();
    },
    removePollOption: function(idx) {
      if (!S.pollOptions || S.pollOptions.length <= 2) return;
      S.pollOptions.splice(idx, 1);
      render();
    },
    // Vote sur un sondage publié : une seule réponse par membre, recliquer son
    // choix actuel le retire (permet de s'abstenir après coup).
    votePoll: function(postId, optionIdx) {
      if (!S.user) { toast('Vous devez être connecté.', 'error'); return; }
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id === postId; });
      if (!post || !post.poll || !Array.isArray(post.poll.options)) return;
      if (optionIdx < 0 || optionIdx >= post.poll.options.length) return;
      var uid = S.user.id;

      // Intention figée AU MOMENT DU CLIC : voter pour optionIdx, ou retirer son
      // vote s'il avait déjà choisi cette même option. On ne recalculera plus ce
      // choix ensuite — seulement l'APPLIQUER — pour ne jamais "rebasculer" un
      // vote deux fois lors de la fusion avec la version serveur la plus fraîche.
      var already = pollUserVote(post.poll, uid);
      var intended = (already === optionIdx) ? null : optionIdx;
      function applyIntent(pollObj) {
        if (!pollObj.votes) pollObj.votes = {};
        if (intended === null) delete pollObj.votes[uid];
        else pollObj.votes[uid] = intended;
        return pollObj;
      }

      // Mise à jour optimiste immédiate : le membre voit son vote sans délai,
      // pas besoin d'attendre l'aller-retour réseau.
      applyIntent(post.poll);
      dbSet(SK.POSTS, posts);
      render();

      if (!supabase) return;

      // Avant d'écrire sur le serveur, on relit la publication la plus récente :
      // si un autre membre a voté entre-temps, sa réponse est déjà dans cette
      // version fraîche, et on n'y superpose alors QUE notre propre entrée —
      // jamais celle des autres. Ça évite qu'un envoi encore en cours n'écrase
      // le vote de quelqu'un d'autre publié entre-temps.
      supabase.from('kun_com_posts').select('content').eq('id', postId).single()
        .then(function(res) {
          var fresh = (res && res.data && res.data.content && res.data.content.poll) ? res.data.content : post;
          applyIntent(fresh.poll);
          // Recale aussi le cache local sur cette version fusionnée, au cas où
          // d'autres votes concurrents s'y trouvaient déjà.
          var localPosts = db(SK.POSTS, []);
          var idx = localPosts.findIndex(function(p){ return p.id === postId; });
          if (idx !== -1) { localPosts[idx] = fresh; dbSet(SK.POSTS, localPosts); render(); }
          return supabase.from('kun_com_posts').upsert({ id: postId, content: fresh }, { onConflict: 'id' });
        })
        .then(function(){}, function(e){ console.warn('Vote sondage :', e); });
    },
    onPostInput: function(val) {
      // Préserve le texte tapé à travers les re-render (ex: changement de fond)
      S.postText = val;

      // Aperçu du premier lien collé. On ne relance rien tant que l'URL n'a pas
      // changé : sans ce garde-fou, chaque frappe déclencherait une requête.
      this.refreshLinkPreview(val);

      // Suggestions de hashtags
      var words = val.split(/\s/); var last = words[words.length-1];
      var show = last.length > 0 && last.startsWith('#');
      var hashBox = document.getElementById('hashSugg');
      if (hashBox) hashBox.style.display = show ? 'flex' : 'none';

      // Suggestions de mentions (@)
      var match = val.match(/@([\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]*)$/);
      var mentionBox = document.getElementById('mentionSugg');
      if (match && mentionBox) {
        var html = App.buildMentionSuggestions(match[1], 'insertMention');
        mentionBox.innerHTML = html;
        mentionBox.style.display = html ? 'flex' : 'none';
      } else if (mentionBox) {
        mentionBox.style.display = 'none';
      }
    },
    // Suggestions de mention : « Tous », les pôles entiers, puis les membres.
    // Une mention collective notifie tout le groupe concerné.
    buildMentionSuggestions: function(query, insertFn) {
      var q = (query || '').toLowerCase();
      var out = '';

      var collective = '';
      if (!q || 'tous'.indexOf(q) === 0 || 'all'.indexOf(q) === 0) {
        collective += '<button type="button" onclick="App.' + insertFn + '(\'@tous \')" style="background:var(--accent-soft);color:var(--lien);border:none;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;">📣 Tous les membres</button>';
      }
      SECTIONS.forEach(function(s) {
        if (q && s.nom.toLowerCase().indexOf(q) !== 0 && s.id.toLowerCase().indexOf(q) !== 0) return;
        collective += '<button type="button" onclick="App.' + insertFn + '(\'@' + safeHtml(s.nom.replace(/\s+/g,'')) + ' \')" style="background:var(--accent-soft);color:var(--lien);border:none;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;">' + s.emoji + ' Pôle ' + safeHtml(s.nom) + '</button>';
      });
      if (collective) {
        out += '<div style="font-size:11px;font-weight:800;color:var(--lien);width:100%;margin-bottom:4px;">Mentionner un groupe :</div>' + collective;
      }

      var users = db(SK.USERS, []).filter(function(u) {
        if (!q) return true;
        return ((u.prenom||'') + ' ' + (u.nom||'')).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 5);
      if (users.length > 0) {
        out += '<div style="font-size:11px;font-weight:800;color:var(--lien);width:100%;margin:6px 0 4px;">Membres :</div>' +
          users.map(function(u) {
            return '<button type="button" onclick="App.' + insertFn + '(\'@' + safeHtml((u.prenom||'') + (u.nom||'')) + ' \')" style="background:var(--accent-soft);color:var(--lien);border:none;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;">👤 ' + safeHtml((u.prenom||'') + ' ' + (u.nom||'')) + '</button>';
          }).join('');
      }
      return out;
    },
    insertTag: function(tag) {
      var ta = document.getElementById('newPostText') || document.getElementById('editPostText') || document.getElementById('repostText'); if (!ta) return;
      var words = ta.value.split(/\s/); words.pop();
      ta.value = words.concat([tag,'']).join(' ');
      S.postText = ta.value;
      var box = document.getElementById('hashSugg'); if (box) box.style.display='none';
      ta.focus();
    },
    addMedia: function(e) {
      var files = Array.from((e.target && e.target.files) || []);
      if (files.length === 0) return;

      var videoFile = files.find(function(f){ return f.type.startsWith('video/'); });
      var imageFiles = files.filter(function(f){ return f.type.startsWith('image/'); });
      var hasVideoPending = S.pendingMedia.some(function(m){ return isVideoUrl(m); });

      // Vidéo : format libre (aucun recadrage), un seul média vidéo par publication, façon Facebook
      if (videoFile) {
        if (S.pendingMedia.length > 0 && !hasVideoPending) {
          toast('Impossible de mélanger une vidéo avec des photos dans la même publication. Retirez d\'abord les photos.', 'error');
          return;
        }
        var maxVideoBytes = 60 * 1024 * 1024;
        if (videoFile.size > maxVideoBytes) {
          toast('Vidéo trop volumineuse (max 60 Mo). Choisissez une vidéo plus courte ou plus légère.', 'error');
          return;
        }
        S.pendingMedia = [];
        S.pendingVideoPoster = null;
        S.videoProcessing = true;
        render();
        toast(S.reduceVideoQuality ? 'Traitement de la vidéo (HD)…' : 'Traitement de la vidéo…', 'info');

        // 1) Vignette générée EN PREMIER, directement depuis le fichier choisi :
        //    c'est rapide (aucune compression/upload à attendre) et ça permet
        //    d'afficher un aperçu visible pendant tout le traitement.
        generateVideoPoster(videoFile, function(poster) {
          S.pendingVideoPoster = poster;
          render();
        });

        var finishVideo = function(dataUrl) {
          if (!dataUrl) { S.videoProcessing = false; toast('Impossible de traiter cette vidéo.', 'error'); render(); return; }
          // 2) Envoie la vidéo vers Supabase Storage (vraie URL hébergée) plutôt que
          //    de la garder en base64 — c'est le plus gros contributeur au poids d'une
          //    publication. En cas d'échec (bucket pas créé, hors-ligne...), on retombe
          //    sur le data:URL pour ne jamais bloquer la publication.
          uploadMediaToStorage(dataUrl, function(hostedUrl) {
            // Le composeur a pu être fermé pendant l'envoi (vidéo jusqu'à 60 Mo) :
            // sans ce garde, l'URL arrivait trop tard et se retrouvait poussée
            // dans le tableau fraîchement vidé — média fantôme pré-chargé dans
            // la PROCHAINE publication. La branche image se protège déjà.
            if (!S.createOpen && !S.editPostId) { S.videoProcessing = false; clearPendingLocalCopies(); return; }
            S.pendingMedia.push(hostedUrl || dataUrl);
            S.videoProcessing = false;
            render();
          });
        };
        if (S.reduceVideoQuality) {
          compressVideo(videoFile, finishVideo);
        } else {
          var vReader = new FileReader();
          vReader.onload = function(ev){ finishVideo(ev.target.result); };
          vReader.onerror = function(){ finishVideo(null); };
          vReader.readAsDataURL(videoFile);
        }
        return;
      }

      if (hasVideoPending) {
        toast('Une vidéo est déjà sélectionnée. Retirez-la pour ajouter des photos.', 'error');
        return;
      }

      var remaining = 10 - S.pendingMedia.length;
      if (imageFiles.length === 0 || remaining <= 0) return;
      var queue = imageFiles.slice(0, remaining);
      // Comme sur Facebook : les photos sont ajoutées immédiatement avec leurs
      // proportions d'origine, SANS étape de recadrage obligatoire. Le recadrage
      // reste disponible ensuite via le bouton "Modifier" sur chaque photo.
      function processNext() {
        if (queue.length === 0) return;
        var file = queue.shift();
        var reader = new FileReader();
        reader.onload = function(evt) {
          compressImage(evt.target.result, 1440, 1800, 0.82, function(dataUrl) {
            var idx = S.pendingMedia.length;
            S.pendingMedia.push(dataUrl); // aperçu instantané, pas d'attente réseau
            render();
            // Bascule silencieusement vers l'URL hébergée une fois l'envoi terminé
            // (le composeur reste réactif pendant l'upload en arrière-plan).
            uploadMediaToStorage(dataUrl, function(hostedUrl) {
              if (hostedUrl && S.pendingMedia[idx] === dataUrl) {
                S.pendingMedia[idx] = hostedUrl;
                // Garde la copie locale : le recadrage "Modifier" lit ainsi une image
                // du même domaine (pas de canvas "tainted" par une URL distante).
                _pendingLocalCopies[hostedUrl] = dataUrl;
              }
            });
            processNext();
          });
        };
        reader.readAsDataURL(file);
      }
      processNext();
    },
    // Ouvre le recadrage sur une photo déjà ajoutée au composeur (bouton "Modifier"),
    // exactement comme l'éditeur de Facebook : optionnel, jamais imposé.
    editPendingMedia: function(i) {
      var current = S.pendingMedia[i];
      if (!current || isVideoUrl(current)) return;
      var source = _pendingLocalCopies[current] || current;
      App.openCropper(source, NaN, 'Modifier la photo', function(croppedDataUrl) {
        compressImage(croppedDataUrl, 1440, 1800, 0.82, function(dataUrl) {
          if (S.pendingMedia[i] === undefined) return;
          S.pendingMedia[i] = dataUrl;
          render();
          uploadMediaToStorage(dataUrl, function(hostedUrl) {
            if (hostedUrl && S.pendingMedia[i] === dataUrl) {
              S.pendingMedia[i] = hostedUrl;
              _pendingLocalCopies[hostedUrl] = dataUrl;
            }
          });
        });
      });
    },
    toggleReduceVideoQuality: function() {
      S.reduceVideoQuality = !S.reduceVideoQuality;
      render();
    },
    removeMedia: function(i) {
      var gone = S.pendingMedia[i];
      if (gone && _pendingLocalCopies[gone]) delete _pendingLocalCopies[gone];
      S.pendingMedia.splice(i,1);
      if (S.pendingMedia.length === 0) { S.pendingVideoPoster = null; clearPendingLocalCopies(); }
      render();
    },
    setPostBgIdx: function(idx) {
      var BG_PALETTES = [
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
        'linear-gradient(135deg,#F7971E,#FFD200)'
      ];
      var taIdx = document.getElementById('newPostText') || document.getElementById('editPostText') || document.getElementById('repostText'); if (taIdx) S.postText = taIdx.value;
      S.postBg = BG_PALETTES[idx] || null;
      render();
    },
    setPostBg: function(bg) {
      var ta = document.getElementById('newPostText') || document.getElementById('editPostText') || document.getElementById('repostText'); if (ta) S.postText = ta.value;
      S.postBg = bg;
      render();
    },
    submitPost: async function(e) {
      e && e.preventDefault();
      if (S.videoProcessing) { toast('Patientez, la vidéo est en cours de traitement…', 'warning'); return; }
      var txt = ((document.getElementById('newPostText')||{}).value||'').trim();
      if (!txt && S.pendingMedia.length===0 && !S.pollOpen) { toast('Ajoutez du texte, une photo ou un sondage.', 'error'); return; }
      if (!S.user) { toast('Vous devez être connecté.', 'error'); return; }

      // Ne jamais enregistrer un média en base64 : si un envoi vers Storage est
      // encore en cours, on met « Publier » en attente (« Envoi du média… ») et on
      // ne construit la publication qu'une fois les URLs hébergées disponibles.
      var _submitBtn = (e && e.submitter) || document.querySelector('button[form="createPostForm"]');
      await waitForMediaUploads(_submitBtn);

      // Sondage optionnel : validé avant tout appel réseau (géoloc), pour ne
      // pas faire attendre l'utilisateur pour rien s'il a laissé le formulaire incomplet.
      var pollData = null;
      if (S.pollOpen) {
        var pQuestion = (S.pollQuestion || '').trim();
        var pOptions = (S.pollOptions || []).map(function(o){ return (o||'').trim(); }).filter(function(o){ return o.length > 0; });
        if (!pQuestion) { toast('Ajoutez une question à votre sondage.', 'error'); return; }
        if (pOptions.length < 2) { toast('Le sondage doit avoir au moins 2 options.', 'error'); return; }
        pollData = { question: pQuestion, options: pOptions, votes: {} };
      }

      // Seul un ENREGISTREMENT D'ARRIVÉE relève la position. Un simple lien
      // « À propos » vers un événement ne géolocalise rien : c'est une mention,
      // pas un pointage.
      var geo = null;
      // L'HEURE D'ARRIVÉE est figée MAINTENANT, au clic — jamais après le GPS.
      // Un GPS lent ou refusé ne peut donc plus dégrader la ponctualité.
      var checkInStamp = S.postCheckInEventId ? Date.now() : null;
      if (S.postCheckInEventId) {
        if (S.geoCapturing) return;
        S.geoCapturing = true;
        render();
        // Position pré-chauffée si dispo (instantané), sinon capture courte.
        // L'horodatage étant déjà figé, cette étape ne pénalise plus l'heure.
        try { geo = await positionForCheckIn(); }
        catch (err) { geo = { available: false, reason: 'unavailable' }; }
        S.geoCapturing = false;
      }
      // Detect section (topic de la publication) : "general" si aucun hashtag reconnu.
      // Ce topic s'affiche désormais près des icônes like/commentaire/partage, pas dans l'en-tête
      // (l'en-tête affiche la section du profil de l'auteur, voir renderPostCard).
      var secId = 'general';
      var low = txt.toLowerCase();
      for (var i=0;i<SECTIONS.length;i++) {
        if (low.indexOf('#'+SECTIONS[i].id) !== -1 || low.indexOf('#'+SECTIONS[i].nom.toLowerCase()) !== -1) { secId=SECTIONS[i].id; break; }
      }
      var newPost = {
        id: 'p'+Date.now(), userId: S.user.id, timestamp: Date.now(),
        author: S.user.prenom + ' ' + S.user.nom,
        authorAvatar: S.user.prenom.charAt(0).toUpperCase(),
        avatarColor: S.user.avatar_color || '#0B5FE0',
        avatar_url: S.user.avatar_url || null,
        sectionId: secId, sectionNom: secNom(secId),
        isVedette: false, scoreText: '',
        caption: txt, mediaUrls: S.pendingMedia.slice(),
        videoPoster: S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? (S.pendingVideoPoster || null) : null,
        postBg: S.pendingMedia.length === 0 ? (S.postBg || null) : null,
        likes: 0, likedBy: [], comments: [],
        visibility: S.postVisibility || 'all',
        targetSections: (S.postTargetSections || []).slice(),
        aboutEventId: S.postAboutEventId || null,
        // Enregistrement d'arrivée (pointage) — distinct du lien informatif.
        checkInEventId: S.postCheckInEventId || null,
        // Position d'arrivée : définitive, publique, non modifiable depuis l'app.
        geo: geo,
        // Moment du pointage. C'est CETTE heure qui fait foi pour la ponctualité,
        // pas celle de la publication : sans cela, il suffirait de publier à
        // l'heure puis de pointer plus tard pour effacer son retard.
        checkInAt: checkInStamp,
        // Échéance de la fenêtre de grâce pour obtenir la position (voir CHECKIN_GRACE_MS).
        checkInGraceUntil: checkInStamp ? (checkInStamp + CHECKIN_GRACE_MS) : null,
        // Sondage optionnel : question + options figées à la publication, votes vides.
        poll: pollData,
        // Aperçu du lien figé ici : la publication reste lisible même si le site
        // change ou disparaît, et le fil n'interroge aucun serveur au défilement.
        linkPreview: (S.linkPreview && S.linkPreviewUrl && txt.indexOf(S.linkPreviewUrl) !== -1) ? S.linkPreview : null
      };

      // Ephemeral post handling
      var ephemeralEl = document.getElementById('postEphemeral');
      if (ephemeralEl && ephemeralEl.checked) {
        newPost.is_ephemeral = true;
        newPost.ephemeral_expiry = Date.now() + 86400000; // 24 hours
      }

      var schedDateEl = document.getElementById('postScheduleDate');
      var schedTimeEl = document.getElementById('postScheduleTime');
      if (schedDateEl && schedDateEl.value && schedTimeEl && schedTimeEl.value) {
        var schedDate = new Date(schedDateEl.value + 'T' + schedTimeEl.value);
        if (schedDate.getTime() > Date.now()) {
          newPost.status = 'scheduled';
          newPost.scheduled_at = schedDate.getTime();
        }
      }

      var posts = db(SK.POSTS, []);
      posts.unshift(newPost);
      dbSet(SK.POSTS, posts);

      if (supabase) {
        try {
          supabase.from('kun_com_posts').upsert({ id: newPost.id, content: newPost, created_at: new Date().toISOString() }, { onConflict: 'id' })
            .then(function(){}, function(eSync){
              // Hors-ligne : le toast « publié » reste vrai localement, mais
              // sans file d'attente la publication n'atteignait JAMAIS les
              // autres appareils.
              console.warn('Supabase submitPost sync error:', eSync);
              App._mettreEnFileAttenteEcriture({ table: 'kun_com_posts', row: { id: newPost.id, content: newPost, created_at: new Date().toISOString() } });
            });
        } catch(err) {
          console.warn("Supabase submitPost sync error:", err);
        }
      }

      // Pointage : présence validée → on prévient tout le monde ; position pas
      // encore obtenue → vérification en arrière-plan (3 essais sur 1 min) avant
      // d'éventuellement basculer en « non vérifié ».
      if (newPost.checkInEventId) {
        var evCI = db(SK.POSTS, []).find(function(x){ return x.id === newPost.checkInEventId && isEventLike(x); });
        var presCI = checkInPresence(newPost, evCI);
        if (presCI === 'onsite' || presCI === 'no_venue') { try { announceArrival(newPost, evCI); } catch(e){} }
        else if (presCI === 'pending') { try { scheduleCheckInVerify(newPost.id); } catch(e){} }
      }

      // Notifie automatiquement les membres des sections ciblées
      if (!newPost.status || newPost.status !== 'scheduled') {
        sendTargetedSectionPostNotifications(newPost);
      }

      // Notifie les membres mentionnés (@Prénom Nom) dans le texte
      if (!newPost.status || newPost.status !== 'scheduled') {
        notifyMentionedUsers(txt, newPost.id);
      }

      // Enregistre automatiquement les liens partagés dans le profil
      saveLinksToProfile(newPost.userId, extractLinks(txt), newPost.id);

      updateUserActivity('Publication');
      S.createOpen=false; S.pendingMedia=[]; clearPendingLocalCopies(); S.hashSuggestions=false; S.postBg=null; S.postText=''; S.pendingVideoPoster=null; S.postVisibility='all'; S.postTargetSections=[]; S.postAboutEventId=null; S.postCheckInEventId=null; S.pollOpen=false; S.pollQuestion=''; S.pollOptions=['','']; S.linkPreview=null; S.linkPreviewUrl=null; S.linkPreviewLoading=false; S.linkPreviewDismissed=false;
      S.tab = 'home';
      S.q = ''; // Optional: clear search if they were searching
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast('Publication publiée avec succès ! ', 'success');
    },

    // Options
    openOptions: function(postId) {
      var posts = db(SK.POSTS, []);
      S.optionsPost = posts.find(function(p){ return p.id===postId; }) || null;
      S.optionsOpen = true; render();
    },
    closeOptions: function() { S.optionsOpen=false; S.optionsPost=null; render(); },
    deletePost: function(postId) {
      var u = S.user || {};
      var posts = db(SK.POSTS, []);
      var idx = posts.findIndex(function(p){ return p.id===postId; });
      if (idx === -1) return;
      var p = posts[idx];
      if (u.role !== 'GRAND_RESPONSABLE' && p.userId !== u.id) { toast('Action non autorisée.', 'error'); return; }

      // Un événement auquel des membres ont déjà pointé, été notés, ou même
      // simplement assignés, ne doit JAMAIS emporter leurs étoiles avec lui.
      // On l'archive (type -> EVENT_ARCHIVED) au lieu de le détruire : il
      // disparaît de partout où il s'affiche (fil, Planning, sélecteurs — tous
      // testent type === 'EVENT' au sens strict), mais punctualityStars et
      // punctualityHistory continuent de le retrouver via isEventLike().
      // Sans historique attaché, un événement se supprime normalement.
      var hasHistory = p.type === 'EVENT' && (
        posts.some(function(x){ return x.checkInEventId === postId; }) ||
        posts.some(function(x){ return x.type === 'EVALUATION' && x.metadata && x.metadata.eventId === postId; }) ||
        (Array.isArray(p.assignments) && p.assignments.length > 0)
      );

      if (hasHistory) {
        p.type = 'EVENT_ARCHIVED';
        p.archivedAt = Date.now();
        dbSet(SK.POSTS, posts);
        if (supabase) {
          supabase.from('kun_com_posts').upsert({ id: p.id, content: p }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Archive event error:', e); });
        }
      } else {
        posts.splice(idx, 1); dbSet(SK.POSTS, posts);
        if (supabase) {
          // Suppression DOUCE : on marque le contenu distant status:'deleted' au lieu
          // de supprimer la ligne. mergePostsWithLocal (voir 01-core.js) est désormais
          // strictement additif — il ne purge JAMAIS une publication simplement absente
          // d'une réponse serveur, pour ne pas en effacer par erreur lors d'une réponse
          // tronquée. Une suppression réelle doit donc laisser une trace explicite,
          // sans quoi elle disparaît seulement de CET appareil : les autres membres la
          // revoient indéfiniment, ressuscitée à chaque synchronisation.
          var tombstone = Object.assign({}, p, { status: 'deleted' });
          supabase.from('kun_com_posts').upsert({ id: p.id, content: tombstone }, { onConflict: 'id' })
            .then(function(){}, function(eDel){
              // Si le marqueur status:'deleted' n'arrive pas au serveur, la
              // publication ressuscite à chaque synchro (fusion additive) :
              // on l'empile pour rejeu au retour du réseau.
              console.warn('Delete post error:', eDel);
              App._mettreEnFileAttenteEcriture({ table: 'kun_com_posts', row: { id: p.id, content: tombstone } });
            });
        }
        deleteUnusedMediaFromStorage((p.mediaUrls || []), postId);
      }
      S.optionsOpen=false; S.optionsPost=null;
      render();
      toast(hasHistory ? 'Événement supprimé — les étoiles déjà attribuées restent conservées.' : 'Publication supprimée.', 'success');
    },

    // Comments
    openComments: function(postId) {
      S.commentPostId=postId; S.commentOpen=true; S.pendingCommentImage=null; S.replyingToCommentId=null; S.replyingToAuthor=null; render();
      window.setTimeout(function(){ var i=document.getElementById('commentInput'); if(i) i.focus(); },150);
    },
    closeComments: function() { S.commentOpen=false; S.commentPostId=null; S.pendingCommentImage=null; S.replyingToCommentId=null; S.replyingToAuthor=null; render(); },
    addEmoji: function(e) { var i=document.getElementById('commentInput'); if(i){i.value+=e;i.focus();} },
    addCommentImage: function(e) {
      var file = (e.target && e.target.files && e.target.files[0]) || null;
      if (!file) return;
      compressImage(file, 800, 800, 0.7, function(dataUrl) {
        S.pendingCommentImage = dataUrl;
        var prev = document.getElementById('commentImagePreview');
        if (prev) {
          prev.style.padding = '10px 14px 0';
          prev.innerHTML = '<div style="position:relative;display:inline-block;">' +
            '<img src="'+safeUrl(dataUrl)+'" style="width:64px;height:64px;object-fit:cover;border-radius:12px;border:1px solid var(--line);">' +
            '<button type="button" onclick="App.removeCommentImage()" style="position:absolute;top:-6px;right:-6px;background:rgba(0,0,0,0.7);border:none;border-radius:8px;width:32px;height:32px;color:#FFF;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>' +
          '</div>';
        } else {
          render();
        }
      });
    },
    removeCommentImage: function() {
      S.pendingCommentImage = null;
      var prev = document.getElementById('commentImagePreview');
      if (prev) { prev.style.padding = '0'; prev.innerHTML = ''; } else { render(); }
    },
    onCommentInput: function(val) {
      var match = val.match(/@([\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]*)$/);
      var box = document.getElementById('commentMentionSugg');
      if (match && box) {
        var htmlC = App.buildMentionSuggestions(match[1], 'insertCommentMention');
        box.innerHTML = htmlC;
        box.style.display = htmlC ? 'flex' : 'none';
      } else if (box) {
        box.style.display = 'none';
      }
    },
    insertCommentMention: function(mention) {
      var input = document.getElementById('commentInput');
      if (!input) return;
      var val = input.value;
      input.value = val.replace(/@[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]*$/, mention);
      var box = document.getElementById('commentMentionSugg');
      if (box) box.style.display = 'none';
      input.focus();
    },
    // Réponse directe à un commentaire (fil imbriqué, 1 niveau)
    replyToComment: function(commentId, authorName) {
      S.replyingToCommentId = commentId;
      S.replyingToAuthor = authorName;
      var banner = document.getElementById('replyingToBanner');
      if (banner) {
        banner.style.display = 'flex';
        var b = banner.querySelector('b');
        if (b) b.textContent = authorName;
      }
      var input = document.getElementById('commentInput');
      if (input) { input.placeholder = 'Répondre à ' + authorName + '…'; input.focus(); }
    },
    cancelReply: function() {
      S.replyingToCommentId = null;
      S.replyingToAuthor = null;
      var banner = document.getElementById('replyingToBanner');
      if (banner) banner.style.display = 'none';
      var input = document.getElementById('commentInput');
      if (input) input.placeholder = 'Ajouter un commentaire… (@ pour taguer)';
    },
    submitComment: function(ev) {
      ev && ev.preventDefault();
      var input = document.getElementById('commentInput');
      var txt = input ? input.value.trim() : '';
      if ((!txt && !S.pendingCommentImage) || !S.user || !S.commentPostId) return;
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===S.commentPostId; });
      if (!post) return;
      if (!Array.isArray(post.comments)) post.comments = [];
      var parentId = S.replyingToCommentId || null;
      var parentComment = parentId ? post.comments.find(function(c){ return c.id === parentId; }) : null;
      var newC = { id:'c'+Date.now(), userId:S.user.id, author:(S.user.prenom||'User')+' '+(S.user.nom?S.user.nom.charAt(0):'')+'.', avatarColor:S.user.avatar_color||'#0B5FE0', text:txt, imageUrl:S.pendingCommentImage||null, timestamp:Date.now(), parentId: parentId };
      post.comments.push(newC); dbSet(SK.POSTS, posts);
      // Affichage optimiste, puis écriture serveur via relecture fraîche : on
      // ajoute NOTRE commentaire à la version du serveur au lieu de réécrire la
      // version locale (qui aurait effacé les commentaires arrivés entre-temps).
      App.ecrirePostFrais(post.id, function(frais) {
        if (!Array.isArray(frais.comments)) frais.comments = [];
        if (!frais.comments.some(function(c){ return c.id === newC.id; })) frais.comments.push(newC);
      });
      if (parentComment && parentComment.userId && parentComment.userId !== S.user.id) {
        sendNotificationToUser(parentComment.userId, {
          type: 'REPLY',
          title: 'Nouvelle réponse',
          text: S.user.prenom + ' a répondu à votre commentaire : "' + (txt ? txt.slice(0, 40) : 'Photo') + '"',
          targetId: post.id,
          // Sans cet identifiant, on retombait sur la publication et il fallait
          // retrouver soi-même le commentaire concerné dans toute la discussion.
          commentId: newC.id
        });
      } else if (!parentComment && post.userId && post.userId !== S.user.id) {
        sendNotificationToUser(post.userId, {
          type: 'COMMENT',
          title: 'Nouveau commentaire',
          text: S.user.prenom + ' : "' + (txt ? txt.slice(0, 40) : 'Photo') + '"',
          targetId: post.id,
          commentId: newC.id
        });
      }
      notifyMentionedUsers(txt, post.id, newC.id);
      updateUserActivity('Commentaire');
      // DOM update: insère dans le fil racine ou dans le conteneur de réponses du parent
      if (parentId) {
        var repliesContainer = document.getElementById('replies-' + parentId);
        if (repliesContainer) {
          var rdiv = document.createElement('div');
          rdiv.style.cssText = 'animation:fadeIn 0.3s;';
          rdiv.innerHTML = renderCommentItem(newC, true);
          repliesContainer.appendChild(rdiv);
        } else { render(); }
      } else {
        var list = document.getElementById('commentsList');
        if (list) {
          var div = document.createElement('div');
          div.style.cssText = 'animation:fadeIn 0.3s;';
          div.innerHTML = renderCommentItem(newC, false) + '<div id="replies-' + newC.id + '" style="margin-left:44px;"></div>';
          list.appendChild(div);
        } else { render(); }
      }
      // Update comment count on post card (outside modal)
      var ccBtn = document.querySelector('#post-'+S.commentPostId+' button[onclick*="openComments"]');
      if (ccBtn && ccBtn.textContent.indexOf('commentaire') !== -1) {
        ccBtn.textContent = 'Voir les ' + post.comments.length + ' commentaire' + (post.comments.length>1?'s':'');
      }
      if (input) input.value = '';
      App.removeCommentImage();
      App.cancelReply();
      toast(parentId ? 'Réponse ajoutée !' : 'Commentaire ajouté !', 'success');
    },
    likeComment: function(cId) {
      var likedComments = db(SK.LIKED_COMMENTS, {});
      likedComments[cId] = !likedComments[cId]; dbSet(SK.LIKED_COMMENTS, likedComments);
      var el = document.getElementById('clike-'+cId);
      if (el) el.innerHTML = SVG.heart(likedComments[cId], 15);
    },

    // Supprime un commentaire (ou une réponse). Réservé à son auteur, à l'auteur
    // de la publication, ou au Admin — même logique de permission que
    // App.deletePost. Un commentaire racine supprimé emporte ses réponses avec
    // lui : les laisser flotter sans parent créerait une discussion incompréhensible.
    deleteComment: function(postId, commentId) {
      var u = S.user || {};
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id === postId; });
      if (!post || !Array.isArray(post.comments)) return;
      var c = post.comments.find(function(x){ return x.id === commentId; });
      if (!c) return;
      var canDelete = u.role === 'GRAND_RESPONSABLE' || c.userId === u.id || post.userId === u.id;
      if (!canDelete) { toast('Action non autorisée.', 'error'); return; }
      post.comments = post.comments.filter(function(x){ return x.id !== commentId && x.parentId !== commentId; });
      dbSet(SK.POSTS, posts);
      // Le serveur ne déduit JAMAIS une suppression de l'absence d'un commentaire
      // (une copie locale périmée en manque toujours) : elle se demande
      // explicitement, et il vérifie le droit de la faire (migration 06).
      if (supabase) {
        App._upsertFiable('kun_com_posts', { id: post.id, content: Object.assign({}, post, { _supprimerCommentaires: [commentId] }) });
      }
      render();
      toast('Commentaire supprimé.', 'success');
    },

    // Glissement tactile vers la gauche pour révéler le bouton Supprimer d'un
    // commentaire (comme Mail/Messages iOS). État transitoire porté directement
    // par le nœud DOM (pas par S) : un simple geste n'a pas besoin de déclencher
    // de rendu, et un rendu déclenché entre-temps par autre chose (nouveau
    // commentaire reçu en temps réel...) ne doit pas interrompre le geste en cours.
    _commentSwipe: {},
    commentSwipeStart: function(e) {
      var t = e.touches && e.touches[0]; if (!t) return;
      App._commentSwipe = { el: e.currentTarget, startX: t.clientX, startY: t.clientY, dx: 0, decided: false, horizontal: false };
      e.currentTarget.style.transition = 'none';
    },
    commentSwipeMove: function(e) {
      var st = App._commentSwipe;
      if (!st || !st.el) return;
      var t = e.touches && e.touches[0]; if (!t) return;
      var dx = t.clientX - st.startX;
      var dy = t.clientY - st.startY;
      if (!st.decided) {
        // Sous 6 px, on ne sait pas encore si le doigt part à l'horizontale (pour
        // révéler « Supprimer ») ou à la verticale (pour faire défiler la liste) —
        // trancher trop tôt bloquerait le scroll normal à chaque frôlement.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        st.decided = true;
        st.horizontal = Math.abs(dx) > Math.abs(dy);
        if (!st.horizontal) { App._commentSwipe = {}; return; }
      }
      if (!st.horizontal) return;
      if (e.cancelable) e.preventDefault();
      var base = st.el._swipeOpen ? -76 : 0;
      var next = base + dx;
      if (next > 0) next = 0;
      if (next < -96) next = -96;
      st.dx = next;
      st.el.style.transform = 'translateX(' + next + 'px)';
    },
    commentSwipeEnd: function() {
      var st = App._commentSwipe;
      if (!st || !st.el) { App._commentSwipe = {}; return; }
      st.el.style.transition = 'transform 0.18s ease-out';
      var open = st.dx < -40;
      st.el.style.transform = open ? 'translateX(-76px)' : 'translateX(0)';
      st.el._swipeOpen = open;
      App._commentSwipe = {};
    },
    carScroll: function(postId, el) {
      var w = el.clientWidth; if (!w) return;
      var idx = Math.round(el.scrollLeft / w);
      if (S.carouselIdx[postId] === idx) return;
      S.carouselIdx[postId] = idx;
      var badge = document.getElementById('badge-'+postId);
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===postId; });
      if (badge && post) badge.textContent = (idx+1)+'/'+post.mediaUrls.length;
      var dots = document.getElementById('dots-'+postId);
      if (dots && post) {
        dots.innerHTML = post.mediaUrls.map(function(_,di){
          var a=di===idx; return '<div style="width:'+(a?'18':'6')+'px;height:6px;border-radius:3px;background:'+(a?'#0B5FE0':'var(--line)')+';transition:all 0.25s;"></div>';
        }).join('');
      }
    },

    // Défilement du carrousel d'une publication d'évaluation (une section par vue).
    evalCarScroll: function(postId, el) {
      var w = el.clientWidth; if (!w) return;
      var idx = Math.round(el.scrollLeft / w);
      if (!S.evalCarouselIdx) S.evalCarouselIdx = {};
      if (S.evalCarouselIdx[postId] === idx) return;
      S.evalCarouselIdx[postId] = idx;
      var total = el.children ? el.children.length : 0;
      var badge = document.getElementById('evalBadge-' + postId);
      if (badge && total) badge.textContent = (idx + 1) + '/' + total;
      var dots = document.getElementById('evalDots-' + postId);
      if (dots && total) {
        var html = '';
        for (var i = 0; i < total; i++) {
          var a = i === idx;
          html += '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B5FE0':'var(--line)') + ';transition:all 0.25s;"></div>';
        }
        dots.innerHTML = html;
      }
    },

    // Défilement d'un carrousel d'événements d'une même journée. Met à jour le
    // compteur et les pastilles directement dans le DOM (pas de render() global,
    // qui interromprait le défilement en cours).
    eventGroupScroll: function(dateIso, carId, el) {
      var w = el.clientWidth; if (!w) return;
      var idx = Math.round(el.scrollLeft / w);
      if (!S.eventGroupIdx) S.eventGroupIdx = {};
      if (S.eventGroupIdx[dateIso] === idx) return;
      S.eventGroupIdx[dateIso] = idx;
      var total = el.children ? el.children.length : 0;
      var badge = document.getElementById('evgrpBadge-' + carId);
      if (badge && total) badge.textContent = (idx + 1) + '/' + total;
      var dots = document.getElementById('evgrpDots-' + carId);
      if (dots && total) {
        var html = '';
        for (var i = 0; i < total; i++) {
          var a = i === idx;
          html += '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B5FE0':'var(--line)') + ';transition:all 0.25s;"></div>';
        }
        dots.innerHTML = html;
      }
      // Le volet affiché change : la hauteur du carrousel le suit.
      App.recalerCarrousels();
    },

    // Debrief
    // ---- Onglet Notation : bascule saisie / suivi ----
    // 'noter' reste réservé aux Grands Responsables : un membre qui forcerait
    // cet appel (ou un vieux bouton en cache) retombe sur le Suivi, jamais un
    // formulaire de notation auquel il n'a pas droit.
    setDebriefView: function(v) {
      if (v === 'noter' && !(S.user && isGrandResponsable(S.user))) v = 'suivi';
      S.debriefView = v;
      render();
    },
    setScoreboardPeriod: function(all) { S.scoreboardAll = !!all; render(); },
    toggleScoreboardSection: function(secId) {
      S.scoreboardOpen = (S.scoreboardOpen === secId) ? null : secId;
      render();
    },
    // Ouvre un bilan précis dans le fil, plutôt que de le chercher à la main.
    // Navigation générique vers une publication du fil : remet le fil à zéro
    // (recherche et filtre par pôle effacés, sinon la cible resterait masquée),
    // fait défiler jusqu'à elle et la met brièvement en évidence pour qu'on la
    // repère au milieu des autres. Utilisée par les bilans du tableau de bord et
    // par les partages, qui doivent ramener à la publication d'origine.
    goToPost: function(postId, labelIntrouvable) {
      var post = db(SK.POSTS, []).find(function(p){ return p.id === postId; });
      if (!post) { toast(labelIntrouvable || 'Cette publication n\'existe plus.', 'error'); return; }
      S.tab = 'home';
      S.q = '';
      S.story = 'all';
      S.createOpen = false; S.commentOpen = false; S.optionsOpen = false;
      S.viewUserProfileId = null;
      render();
      setTimeout(function() {
        var el = document.getElementById('post-' + postId);
        if (!el) { toast('Cette publication n\'est plus dans le fil chargé.', 'info'); return; }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Halo temporaire : sans repère visuel, on ne sait pas laquelle des
        // cartes à l'écran est celle qu'on cherchait.
        el.style.transition = 'box-shadow 0.35s ease';
        el.style.boxShadow = '0 0 0 2px ' + UI.accent;
        window.setTimeout(function(){ el.style.boxShadow = 'none'; }, 1600);
      }, 120);
    },
    openBilan: function(postId) { this.goToPost(postId, 'Ce bilan n\'existe plus.'); },
    // Depuis un partage, on revient à la publication d'origine.
    goToOriginalPost: function(postId) { this.goToPost(postId, 'La publication d\'origine a été supprimée.'); },

    // Déplie/replie une section dans l'écran Notation (une seule à la fois).
    // Les Grands Responsables peuvent noter toutes les sections, y compris la leur.
    toggleEvalSection: function(secId) {
      S.evalExpandedSection = (S.evalExpandedSection === secId) ? null : secId;
      render();
    },
    // Note un critère précis d'une section. Chaque critère est indépendant ;
    // la note globale affichée est leur moyenne, recalculée immédiatement dans le
    // DOM (auparavant le compteur de droite n'était rafraîchi qu'au rendu suivant,
    // d'où l'impression de latence).
    rateCriterion: function(secId, critId, score) {
      if (!S.ratings[secId]) S.ratings[secId] = { criteria:{}, comment:'' };
      if (!S.ratings[secId].criteria) S.ratings[secId].criteria = {};
      S.ratings[secId].criteria[critId] = score;

      var starsEl = document.getElementById('critstars-' + secId + '-' + critId);
      if (starsEl) {
        starsEl.innerHTML = [1,2,3,4,5].map(function(s) {
          return '<button type="button" onclick="App.rateCriterion(\'' + jsArg(secId) + '\',\'' + jsArg(critId) + '\',' + s + ')" style="font-size:28px;cursor:pointer;background:none;border:none;padding:0;line-height:1;color:' + (s<=score?'#FFD700':'var(--line)') + ';">★</button>';
        }).join('');
      }
      var valEl = document.getElementById('critval-' + secId + '-' + critId);
      if (valEl) { valEl.textContent = score + '/5'; valEl.style.color = '#0B0D12'; }

      var crit = S.ratings[secId].criteria;
      // La note de tête inclut la ponctualité automatique, comme au rendu.
      var vals = EVAL_CRITERIA.map(function(c){ return crit[c.id] || 0; }).filter(function(v){ return v > 0; });
      var punc = S.evalEventId ? sectionPunctuality(secId, S.evalEventId) : null;
      if (punc) vals.push(punc.average);
      var avg = vals.length ? Math.round((vals.reduce(function(a,b){ return a+b; }, 0) / vals.length) * 10) / 10 : 0;
      var avgEl = document.getElementById('evalavg-' + secId);
      if (avgEl) {
        avgEl.textContent = avg > 0 ? avg + '/5' : '—';
        avgEl.style.color = avg >= 4 ? '#0E9F6E' : avg >= 2 ? '#D98A0B' : avg > 0 ? '#D92D20' : 'var(--line)';
      }
      var subEl = document.getElementById('evalsub-' + secId);
      if (subEl) {
        var n = EVAL_CRITERIA.filter(function(c){ return (crit[c.id]||0) > 0; }).length;
        subEl.textContent = n + '/' + EVAL_CRITERIA.length + ' critères notés';
      }
    },
    rateComment: function(secId, val) {
      if (!S.ratings[secId]) S.ratings[secId] = { criteria:{}, comment:'' };
      S.ratings[secId].comment = val;
    },
    // Publie UNE seule publication regroupant toutes les sections évaluées
    // (auparavant : une publication séparée par section, ce qui noyait le fil).
    // Les sections s'y consultent sous forme de carrousel.
    publishBilan: function() {
      if (!S.user) return;
      var eventSelect = document.getElementById('evalEventSelect');
      var eventId = S.evalEventId || (eventSelect ? eventSelect.value : '');
      if (!eventId) {
        toast("Veuillez sélectionner l'événement à évaluer.", 'error');
        return;
      }
      var posts = db(SK.POSTS, []);
      var selectedEv = posts.find(function(p){ return p.id === eventId; });
      var eventTitle = selectedEv ? (selectedEv.eventTitle || (selectedEv.metadata && selectedEv.metadata.title) || 'Événement') : 'Événement';

      var allUsers = db(SK.USERS, []);
      var evaluations = [];
      SECTIONS.forEach(function(sec) {
        var r = S.ratings[sec.id];
        if (!r) return;
        if (!r.criteria) r.criteria = {};
        var manualAvg = ratingAverage(r.criteria);
        // Ponctualité calculée automatiquement à partir des heures d'arrivée des
        // membres du pôle assignés à cet événement (aucune saisie manuelle).
        var punc = sectionPunctuality(sec.id, eventId, posts, allUsers);
        // Une section n'apparaît dans le bilan que si elle a été notée à la main
        // OU si elle avait des membres assignés (ponctualité automatique).
        if (manualAvg <= 0 && !punc) return;

        // Critères libellés en clair pour l'affichage, dans l'ordre défini.
        var crit = {};
        if (punc) crit['Ponctualité'] = punc.average;
        EVAL_CRITERIA.forEach(function(c) {
          var v = r.criteria[c.id] || 0;
          if (v > 0) crit[c.nom] = v;
        });

        // Note globale = moyenne de TOUS les critères retenus, ponctualité incluse.
        var vals = Object.keys(crit).map(function(k){ return crit[k]; });
        var globalScore = vals.length
          ? Math.round((vals.reduce(function(a,b){ return a+b; }, 0) / vals.length) * 10) / 10
          : 0;

        evaluations.push({
          teamId: sec.id,
          teamName: sec.nom,
          emoji: sec.emoji,
          color: sec.color,
          globalScore: globalScore,
          criteria: crit,
          punctuality: punc || null,
          comment: r.comment || ''
        });
      });

      if (evaluations.length === 0) {
        toast('Notez au moins un critère dans une section.', 'error');
        return;
      }

      var ts = Date.now();
      var metadata = {
        eventId: eventId,
        eventTitle: eventTitle,
        evaluations: evaluations,
        // Champs conservés pour compatibilité avec l'ancien format à une seule
        // section (profils, statistiques, publications déjà en base).
        teamName: evaluations[0].teamName,
        globalScore: evaluations[0].globalScore,
        criteria: evaluations[0].criteria
      };
      var caption = evaluations.length > 1
        ? 'Bilan de ' + evaluations.length + ' pôles — ' + eventTitle
        : ("Évaluation de l'équipe " + evaluations[0].teamName);

      // Un même responsable ne crée qu'UN bilan par événement : s'il en existe
      // déjà un de sa part, on le met à jour au lieu d'en empiler un second.
      var existing = findOwnBilan(eventId);
      var savedPost;
      if (existing) {
        existing.metadata = metadata;
        existing.caption = caption;
        existing.updatedAt = ts;
        savedPost = existing;
      } else {
        savedPost = {
          id: 'eval-' + ts, userId: S.user.id, timestamp: ts,
          author: S.user.prenom + ' ' + S.user.nom,
          authorAvatar: S.user.prenom.charAt(0).toUpperCase(),
          avatarColor: S.user.avatar_color || '#0B5FE0',
          avatar_url: S.user.avatar_url || null,
          sectionId: S.user.section_id || 'general', sectionNom: secNom(S.user.section_id || 'general'),
          type: 'EVALUATION',
          metadata: metadata,
          caption: caption,
          mediaUrls: [], likes: 0, likedBy: [], comments: []
        };
        posts.unshift(savedPost);
      }
      dbSet(SK.POSTS, posts);
      if (supabase) supabase.from('kun_com_posts').upsert({ id: savedPost.id, content: savedPost, created_at: new Date(savedPost.timestamp).toISOString() }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Erreur publication bilan:', e); });

      // Réinitialise proprement l'écran de notation
      S.ratings = {};
      SECTIONS.forEach(function(sec){ S.ratings[sec.id] = { criteria:{}, comment:'' }; });
      S.evalEventId = null;
      S.evalExpandedSection = null;
      S.tab = 'home';
      S.q = '';
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast(existing ? 'Bilan mis à jour ! ✏️' : 'Bilan publié avec succès ! ', 'success');
    },

    // Changement d'événement dans l'écran Notation : si un bilan a déjà été publié
    // par cet utilisateur pour cet événement, on repré-remplit le formulaire avec
    // ses notes pour qu'il les corrige plutôt que de repartir de zéro.
    selectEvalEvent: function(eventId) {
      S.evalEventId = eventId;
      S.ratings = {};
      SECTIONS.forEach(function(sec){ S.ratings[sec.id] = { criteria:{}, comment:'' }; });
      S.evalExpandedSection = null;
      var existing = eventId ? findOwnBilan(eventId) : null;
      if (existing && existing.metadata && Array.isArray(existing.metadata.evaluations)) {
        existing.metadata.evaluations.forEach(function(ev) {
          var secId = ev.teamId;
          if (!secId) {
            var found = SECTIONS.find(function(s){ return s.nom === ev.teamName; });
            secId = found ? found.id : null;
          }
          if (!secId) return;
          var crit = {};
          EVAL_CRITERIA.forEach(function(c) {
            var v = (ev.criteria || {})[c.nom];
            if (v > 0) crit[c.id] = v;
          });
          S.ratings[secId] = { criteria: crit, comment: ev.comment || '' };
        });
        toast('Bilan existant chargé — vos modifications le mettront à jour.', 'info');
      }
      render();
    }
  };

  // Retour du réseau : on rejoue les écritures restées en file d'attente
  // (publications, suppressions, commentaires... créés hors connexion).
  window.addEventListener('online', function() {
    try { App.viderFileAttenteEcriture(); } catch(e) {}
  });

