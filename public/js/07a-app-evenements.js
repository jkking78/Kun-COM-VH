// KUN COM VH — Partie 7a : App controller — Événements : assignations, lieux, plan de préparation, création et édition, Planning, convocations, échanges de service, agenda (window.App)

  'use strict';
  // ============================================================
  // APP CONTROLLER — toutes les actions
  // ============================================================
  // Les actions sont réparties dans les fichiers 07a à 07e, par domaine ;
  // chacun ajoute les siennes à App avec Object.assign.
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
            ? (a.sectionId ? icoPole(a.sectionId, 14) + ' ' : '') + safeHtml(a.sectionName || '') + ' <span style="font-size:11px;font-weight:800;color:var(--lien);background:var(--accent-soft);padding:1px 6px;border-radius:8px;">PÔLE</span>'
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
              : '<span title="Relève d\'un autre pôle" style="white-space:nowrap;">' + ico('lock', 13, UI.faint) + '</span>') +
          '</div>';
        }).join('') +
      '</div>';
    },
    addAssignment: function() {
      var select = document.getElementById('assignUserSelect');
      var taskInput = document.getElementById('assignTaskInput');
      if (!select || !select.value) {
        toast('Choisis un membre (ou un pôle).', 'error');
        return;
      }
      // La tâche est facultative : être de service suffit.
      if (!taskInput) return;
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
          if (!allowed) { toast('Tu ne peux assigner que les membres de ton pôle.', 'error'); return; }
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
        toast('Tu n\'as pas le droit d\'assigner sur cet événement.', 'error');
        return;
      }
      S.optionsOpen = false; S.optionsPost = null; S.postOptionsOpen = false;
      S.assignManagerId = postId;
      S.eventAssignments = (post.assignments || []).slice();
      S.assignOriginal = (post.assignments || []).slice();
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
        toast('Tu n\'as pas le droit d\'assigner sur cet événement.', 'error');
        return;
      }
      // Membre choisi mais pas encore ajouté : on l'ajoute plutôt que de l'oublier.
      var choixEnAttente = document.getElementById('assignUserSelect');
      if (choixEnAttente && choixEnAttente.value) App.addAssignment();
      if (btn) { btn.textContent = 'Enregistrement…'; btn.disabled = true; }

      var allU = db(SK.USERS, []);
      // On ne touche QUE les assignations qui relèvent de l'utilisateur, et on
      // n'applique que ses ajouts et retraits à la version fraîche du serveur :
      // un autre responsable qui enregistre en même temps ne perd rien (C2).
      var original = S.assignOriginal || post.assignments || [];
      var mine = (S.eventAssignments || []).filter(function(a){ return canTouchAssignment(a, S.user, allU); });
      var voulue = original.filter(function(a){ return !canTouchAssignment(a, S.user, allU); }).concat(mine);
      var before = original.map(function(a){ return a.userId || ('sec:'+a.sectionId); });
      await App.ecrirePostFrais(postId, function(p) {
        p.assignments = fusionnerAssignations(p.assignments, original, voulue);
        p.assignmentsUpdatedAt = Date.now();
      });

      // Prévient les membres nouvellement assignés (et eux seuls).
      mine.forEach(function(a) {
        if (a.isSection || !a.userId) return;
        if (before.indexOf(a.userId) !== -1) return;
        if (S.user && a.userId === S.user.id) return;
        sendNotificationToUser(a.userId, {
          type: 'EVENT_ASSIGNED',
          title: 'Service assigné',
          text: 'Tu es de service (' + a.task + ') pour ' + (post.eventTitle || 'un événement'),
          targetId: post.id
        });
      });

      S.assignManagerId = null;
      S.eventAssignments = [];
      S.assignOriginal = null;
      render();
      toast('Assignations enregistrées.', 'success');
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
    // Recherche du lieu par son nom ou son adresse. La position du créateur
    // n'est relevée que s'il le demande (« Utiliser ma position actuelle ») :
    // il prépare souvent l'événement de chez lui, loin du lieu.
    onEventPlaceInput: function(val) {
      S.eventPlaceQuery = val;
      S.eventPlaceError = null;
      if (App._placeTimer) clearTimeout(App._placeTimer);
      S.eventPlaceResults = [];
      // Les lieux enregistrés s'affichent tout de suite, sans réseau.
      var box0 = document.getElementById('eventPlaceResults');
      if (box0) box0.innerHTML = renderResultatsLieu(val, []);
      if (!val || val.trim().length < 3) return;
      App._placeTimer = setTimeout(function(){ App.searchEventPlace(); }, 600);
    },
    // ---- Lieux enregistrés (migration 11) ----
    chargerLieux: function() {
      if (!supabase || !S.user) return Promise.resolve();
      return supabase.from('kun_com_lieux').select('id,nom,adresse,lat,lng,precision_m,utilisations')
        .order('utilisations', { ascending: false }).limit(300).then(function(r) {
          if (!r || r.error || !Array.isArray(r.data)) return;
          dbSet(SK.LIEUX, r.data.map(assainirLieu).filter(Boolean));
          // Formulaire ouvert : propositions rafraîchies sans voler le focus.
          var box = document.getElementById('eventLieuxProposes');
          var champ = document.getElementById('eventLocation');
          if (box && champ) box.innerHTML = renderLieuxProposes(champ.value, S.createEventData);
          if (S.lieuxOuverts) render();
        }, function(){});
    },
    onEventLocationInput: function(val) {
      var box = document.getElementById('eventLieuxProposes');
      if (box) box.innerHTML = renderLieuxProposes(val, S.createEventData);
    },
    // depuis = 'lieu' (sous « Lieu / salle ») ou 'carte' (recherche d'adresse) :
    // depuis la carte, un nom de salle déjà tapé est gardé, seule la position change.
    choisirLieu: function(id, depuis) {
      var l = db(SK.LIEUX, []).map(assainirLieu).filter(Boolean).find(function(x){ return x.id === id; });
      if (!l) return;
      App.syncCreateEventData();
      if (!S.createEventData) S.createEventData = {};
      var d = S.createEventData;
      if (depuis !== 'carte' || !(d.location || '').trim()) d.location = l.nom;
      d.lat = l.lat; d.lng = l.lng;
      d.accuracy = l.precision_m || undefined;
      d.placeName = l.nom;
      d.placeLabel = l.adresse || '';
      S.eventPlaceResults = []; S.eventPlaceQuery = ''; S.eventPlaceError = null;
      render();
      toast('Lieu choisi : ' + l.nom + '.', 'success');
    },
    // Sur place, le responsable relève la position du lieu avec son téléphone.
    utiliserMaPosition: async function() {
      if (S.eventGeoEnCours) return;
      App.syncCreateEventData();
      S.eventGeoEnCours = true; S.eventPlaceError = null;
      render();
      var g = await releverPositionPrecise(12000);
      S.eventGeoEnCours = false;
      if (!S.createEventOpen) return;
      App.syncCreateEventData();   // le formulaire a pu changer pendant le relevé
      if (!g || !g.available) {
        S.eventPlaceError = (g && g.reason === 'denied') ? 'Accès à ta position refusé. Autorise-le dans les réglages du navigateur, puis réessaie.'
          : (g && g.reason === 'outside_country') ? 'Ta position semble hors de Côte d\'Ivoire. Réessaie dehors ou cherche l\'adresse.'
          : 'Position introuvable. Réessaie près d\'une fenêtre ou cherche l\'adresse.';
        render();
        return;
      }
      if (!S.createEventData) S.createEventData = {};
      var d = S.createEventData;
      d.lat = g.lat; d.lng = g.lng; d.accuracy = g.accuracy;
      d.placeName = (d.location || '').trim() || 'Position relevée sur place';
      d.placeLabel = '';
      S.eventPlaceResults = []; S.eventPlaceQuery = '';
      render();
      toast(g.accuracy > 100 ? 'Position relevée, mais approximative (à ' + g.accuracy + ' m près).'
        : 'Position du lieu relevée (à ' + g.accuracy + ' m près).', g.accuracy > 100 ? 'info' : 'success');
    },
    // Mémorise le lieu d'un événement enregistré (responsables et Admin).
    _memoriserLieu: function(nom, adresse, lat, lng, precision) {
      nom = String(nom || '').trim();
      if (!nom || typeof lat !== 'number' || typeof lng !== 'number' || !canAssign(S.user)) return;
      var prec = (typeof precision === 'number' && precision > 0) ? Math.round(precision) : null;
      memoriserLieuLocal({ nom: nom, adresse: adresse || '', lat: lat, lng: lng, precision_m: prec });
      if (!supabase) return;
      supabase.rpc('kc_memoriser_lieu', { p_nom: nom, p_adresse: adresse || '', p_lat: lat, p_lng: lng, p_precision: prec })
        .then(function(r) {
          if (r && r.error) { console.warn('Lieu non mémorisé :', r.error); return; }
          App.chargerLieux();
        }, function(e) { console.warn('Lieu non mémorisé :', e); });
    },
    // Nom sous lequel le lieu est mémorisé : le champ « Lieu / salle », sinon
    // le nom trouvé par la recherche. Une position GPS (avec sa précision) sans
    // nom n'est pas mémorisée : « Position relevée sur place » ne dit rien.
    _nomDuLieu: function(loc, d) {
      if (loc) return loc;
      return (d && typeof d.accuracy !== 'number') ? (d.placeName || '') : '';
    },
    // ---- Plan de préparation d'un événement (migration 11) ----
    // Chaque pôle a son plan : des tâches, découpées en étapes datées à faire
    // avant l'événement. Le responsable du pôle et l'Admin l'écrivent, tout le
    // monde le consulte depuis la fiche de l'événement (Planning).
    ouvrirPreparation: function(evId) {
      if (!db(SK.POSTS, []).some(function(p){ return p.id === evId; })) { toast('Événement introuvable.', 'error'); return; }
      S.preparationId = evId; S.prepForm = null; S.prepPolesEnPlus = [];
      S.prepSaisie = ''; S.prepSaisieDate = '';
      if (S.prepVue !== 'dates') S.prepVue = 'poles';
      render();
    },
    fermerPreparation: function() { S.preparationId = null; S.prepForm = null; render(); },
    prepChoisirVue: function(v) { S.prepVue = v === 'dates' ? 'dates' : 'poles'; S.prepForm = null; render(); },
    prepAjouterPole: function(pole) {
      if (!peutPreparer(S.user, pole)) return;
      if ((S.prepPolesEnPlus || []).indexOf(pole) === -1) S.prepPolesEnPlus = (S.prepPolesEnPlus || []).concat([pole]);
      App.prepOuvrirForm('tache', pole);
    },
    // type : 'tache' (nouvelle), 'etape' (nouvelle, dans une tâche),
    // 'modifTache', 'modifEtape'.
    prepOuvrirForm: function(type, pole, tacheId, etapeId) {
      if (!peutPreparer(S.user, pole)) return;
      S.prepForm = { type: type, pole: pole, tache: tacheId || null, etape: etapeId || null };
      S.prepSaisie = ''; S.prepSaisieDate = '';
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === S.preparationId; });
      var e = ev && assainirPreparation(ev.preparation)[pole];
      var t = e && e.taches.find(function(x){ return x.id === tacheId; });
      if (type === 'modifTache' && t) S.prepSaisie = t.titre;
      if (type === 'modifEtape' && t) {
        var et = t.etapes.find(function(x){ return x.id === etapeId; });
        if (et) { S.prepSaisie = et.titre; S.prepSaisieDate = et.date; }
      }
      render();
      setTimeout(function() {
        var el = document.getElementById('prepTitre');
        if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch(e) {} }
      }, 0);
    },
    prepFermerForm: function() { S.prepForm = null; S.prepSaisie = ''; S.prepSaisieDate = ''; render(); },
    // Enregistre le formulaire ouvert. titreImpose : tâche reprise d'une assignation.
    prepValider: function(titreImpose) {
      var f = S.prepForm;
      var ev = f && db(SK.POSTS, []).find(function(p){ return p.id === S.preparationId; });
      if (!ev) return;
      var champ = document.getElementById('prepTitre');
      var titre = String(titreImpose || (champ ? champ.value : S.prepSaisie) || '').replace(/\s+/g, ' ').trim();
      if (!titre) { toast(f.type === 'tache' || f.type === 'modifTache' ? 'Indique la tâche.' : 'Indique l\'étape.', 'error'); return; }
      var champDate = document.getElementById('prepDate');
      var date = champDate ? champDate.value : (S.prepSaisieDate || '');
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) date = '';
      if (date && ev.eventDate && date > ev.eventDate) {
        toast('Choisis une date au plus tard le jour de l\'événement.', 'error');
        return;
      }
      var ok;
      if (f.type === 'tache') {
        var idT = idPrep('t');
        titre = titre.slice(0, 120);
        ok = App._ecrirePreparation(ev.id, f.pole, function(taches) {
          if (taches.some(function(x){ return x.id === idT; })) return;
          if (taches.length >= PREP_MAX_TACHES) return false;
          taches.push({ id: idT, titre: titre, etapes: [] });
        });
        // Tâche créée : on enchaîne sur ses étapes.
        if (ok) { S.prepForm = { type: 'etape', pole: f.pole, tache: idT }; toast('Tâche ajoutée. Ajoute maintenant ses étapes.', 'success'); }
      } else if (f.type === 'etape') {
        var idE = idPrep('e');
        ok = App._ecrirePreparation(ev.id, f.pole, function(taches) {
          var t = taches.find(function(x){ return x.id === f.tache; });
          if (!t) return false;
          if (t.etapes.some(function(x){ return x.id === idE; })) return;
          if (t.etapes.length >= PREP_MAX_ETAPES) return false;
          t.etapes.push({ id: idE, titre: titre.slice(0, 160), date: date, fait: false, faitLe: null });
          trierEtapes(t.etapes);
        });
        // Le formulaire reste ouvert pour l'étape suivante.
      } else if (f.type === 'modifTache') {
        ok = App._ecrirePreparation(ev.id, f.pole, function(taches) {
          var t = taches.find(function(x){ return x.id === f.tache; });
          if (!t) return false;
          t.titre = titre.slice(0, 120);
        });
        if (ok) S.prepForm = null;
      } else if (f.type === 'modifEtape') {
        ok = App._ecrirePreparation(ev.id, f.pole, function(taches) {
          var t = taches.find(function(x){ return x.id === f.tache; });
          var e = t && t.etapes.find(function(x){ return x.id === f.etape; });
          if (!e) return false;
          e.titre = titre.slice(0, 160); e.date = date;
          trierEtapes(t.etapes);
        });
        if (ok) S.prepForm = null;
      }
      if (ok) { S.prepSaisie = ''; S.prepSaisieDate = ''; render(); App._focusPrep(); }
      else if (ok === false) toast('Modification impossible (limite atteinte ou élément supprimé).', 'error');
    },
    _focusPrep: function() {
      setTimeout(function(){ var el = document.getElementById('prepTitre'); if (el) el.focus(); }, 0);
    },
    // Supprime la tâche ou l'étape du formulaire de modification ouvert.
    prepSupprimer: function() {
      var f = S.prepForm;
      var ev = f && db(SK.POSTS, []).find(function(p){ return p.id === S.preparationId; });
      if (!ev) return;
      var e = assainirPreparation(ev.preparation)[f.pole];
      var t = e && e.taches.find(function(x){ return x.id === f.tache; });
      if (!t) return;
      if (f.type === 'modifTache') {
        if (!confirm('Supprimer la tâche « ' + t.titre + ' »' + (t.etapes.length ? ' et ses ' + t.etapes.length + ' étape' + (t.etapes.length > 1 ? 's' : '') : '') + ' ?')) return;
        App._ecrirePreparation(ev.id, f.pole, function(taches) {
          var i = taches.findIndex(function(x){ return x.id === f.tache; });
          if (i !== -1) taches.splice(i, 1);
        });
      } else if (f.type === 'modifEtape') {
        if (!confirm('Supprimer cette étape ?')) return;
        App._ecrirePreparation(ev.id, f.pole, function(taches) {
          var tt = taches.find(function(x){ return x.id === f.tache; });
          if (tt) tt.etapes = tt.etapes.filter(function(x){ return x.id !== f.etape; });
        });
      } else return;
      S.prepForm = null; S.prepSaisie = ''; S.prepSaisieDate = '';
      render();
    },
    // Coche ou décoche une étape (valeur voulue fixée d'avance : rejouée sur
    // la version fraîche du serveur, elle ne s'inverse pas deux fois).
    prepBasculer: function(pole, tacheId, etapeId) {
      var ev = db(SK.POSTS, []).find(function(p){ return p.id === S.preparationId; });
      var e = ev && assainirPreparation(ev.preparation)[pole];
      var t = e && e.taches.find(function(x){ return x.id === tacheId; });
      var et = t && t.etapes.find(function(x){ return x.id === etapeId; });
      if (!et) return;
      var fait = !et.fait;
      App._ecrirePreparation(ev.id, pole, function(taches) {
        var tt = taches.find(function(x){ return x.id === tacheId; });
        var ee = tt && tt.etapes.find(function(x){ return x.id === etapeId; });
        if (!ee) return false;
        ee.fait = fait; ee.faitLe = fait ? Date.now() : null;
      });
      render();
    },
    // Applique une modification au plan d'un pôle : d'abord sur la copie
    // locale (affichage immédiat), puis sur la version fraîche du serveur.
    // modifier(taches) agit sur une copie et doit pouvoir être rejoué sans
    // double effet ; il renvoie false si la modification est impossible.
    _ecrirePreparation: function(evId, pole, modifier) {
      if (!peutPreparer(S.user, pole)) { toast('Seul le responsable du pôle peut modifier ce plan.', 'error'); return null; }
      var appliquer = function(ev) {
        var prep = assainirPreparation(ev.preparation);
        var e = prep[pole] || { taches: [], v: 0 };
        var taches = JSON.parse(JSON.stringify(e.taches || []));
        if (modifier(taches) === false) return false;
        prep[pole] = { taches: taches, v: (e.v || 0) + 1, maj_le: Date.now(), maj_par: S.user.id };
        ev.preparation = prep;
        return prep[pole].v;
      };
      var posts = db(SK.POSTS, []);
      var idx = posts.findIndex(function(p){ return p.id === evId; });
      if (idx === -1) return false;
      var copie = Object.assign({}, posts[idx]);
      if (appliquer(copie) === false) return false;
      posts[idx] = copie;
      dbSet(SK.POSTS, posts);
      var versionEnvoyee = null;
      App.ecrirePostFrais(evId, function(ev) { versionEnvoyee = appliquer(ev); }, function(retenu) {
        // Version refusée (modifiée au même moment par quelqu'un d'autre, ou
        // trop volumineuse) : l'écran reprend la version enregistrée.
        var e = assainirPreparation(retenu.preparation)[pole];
        if (versionEnvoyee && (!e || e.v < versionEnvoyee)) {
          toast('Modification non enregistrée : le plan a sans doute changé entre-temps. Vérifie-le et recommence.', 'info');
        }
        if (S.preparationId === evId || S.tab === 'planning') render();
      });
      return true;
    },
    ouvrirLieux: function() { S.lieuxOuverts = true; render(); App.chargerLieux(); },
    fermerLieux: function() { S.lieuxOuverts = false; render(); },
    supprimerLieu: async function(id) {
      if (!isGrandResponsable(S.user)) return;
      var l = db(SK.LIEUX, []).find(function(x){ return x && x.id === id; });
      if (!l || !confirm('Retirer « ' + l.nom + ' » des lieux enregistrés ? Les événements déjà créés gardent leur position.')) return;
      if (supabase && String(id).indexOf('local:') !== 0) {
        var r = await supabase.from('kun_com_lieux').delete().eq('id', id);
        if (r && r.error) { toast('Suppression impossible. Réessaie.', 'error'); return; }
      }
      dbSet(SK.LIEUX, db(SK.LIEUX, []).filter(function(x){ return x && x.id !== id; }));
      render();
      toast('Lieu retiré.', 'success');
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
        if (S.eventPlaceResults.length === 0) S.eventPlaceError = 'Aucun lieu trouvé en Côte d\'Ivoire. Essaie avec le quartier ou la commune.';
      } catch (e) {
        console.warn('Recherche de lieu :', e);
        S.eventPlaceResults = [];
        S.eventPlaceError = 'Recherche indisponible. Vérifie ta connexion et réessaie.';
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
      toast('Lieu situé : ' + r.shortLabel + '.', 'success');
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
      S.eventPlaceQuery = ''; S.eventPlaceResults = []; S.eventPlaceError = null; S.eventGeoEnCours = false;
      render();
      App.chargerLieux();
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
      S.eventGeoEnCours = false;
      App.chargerLieux();
      S.eventSections = (post.eventSections || []).slice();
      S.eventAssignments = (post.assignments || []).slice();
      S.assignOriginal = (post.assignments || []).slice();
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
      // Un membre choisi dans « Qui est de service ? » sans avoir touché
      // « Ajouter » était oublié : l'événement partait sans personne assignée.
      var choixEnAttente = document.getElementById('assignUserSelect');
      if (choixEnAttente && choixEnAttente.value) App.addAssignment();

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
      // Position relevée au GPS : elle prend le nom du champ « Lieu / salle ».
      var dLieu = S.createEventData || {};
      var nomPosition = (typeof dLieu.accuracy === 'number' && loc) ? loc : dLieu.placeName;

      if (S.editEventId) {
        var allP = db(SK.POSTS, []);
        var idxE = allP.findIndex(function(p){ return p.id === S.editEventId; });
        if (idxE === -1) { toast('Événement introuvable.', 'error'); return; }
        if (btn) { btn.textContent = 'Enregistrement...'; btn.disabled = true; }
        var avant = allP[idxE];
        var updated = Object.assign({}, allP[idxE], {
          eventTitle: title,
          eventDate: date,
          eventStart: start,
          eventEnd: end,
          eventLocation: loc,
          eventLat: typeof (S.createEventData||{}).lat === 'number' ? S.createEventData.lat : null,
          eventLng: typeof (S.createEventData||{}).lng === 'number' ? S.createEventData.lng : null,
          eventGeoAccuracy: (S.createEventData||{}).accuracy || null,
          eventPlaceName: nomPosition || null,
          eventPlaceLabel: (S.createEventData||{}).placeLabel || null,
          eventSections: (S.eventSections||[]).slice(),
          assignments: (S.eventAssignments||[]).slice(),
          eventImage: S.eventImage || null,
          caption: desc,
          is_pinned: pinned,
          edited: true,
          editedAt: Date.now()
        });
        // Assignations : seulement ses ajouts et retraits, appliqués à la
        // version fraîche du serveur (C2).
        if (supabase && S.assignOriginal) {
          try {
            var fr = await supabase.from('kun_com_posts').select('content').eq('id', updated.id).single();
            var frais = fr && fr.data && fr.data.content ? parsePostItem({ id: updated.id, content: fr.data.content }) : null;
            if (frais) updated.assignments = fusionnerAssignations(frais.assignments, S.assignOriginal, updated.assignments);
          } catch(e) { /* hors ligne : la liste éditée part telle quelle */ }
        }
        S.assignOriginal = null;
        allP[idxE] = updated;
        dbSet(SK.POSTS, allP);
        // Lieu mémorisé seulement s'il a changé : rouvrir l'événement pour en
        // corriger l'heure ne compte pas comme une nouvelle utilisation.
        if (updated.eventLocation !== avant.eventLocation || updated.eventLat !== avant.eventLat || updated.eventLng !== avant.eventLng) {
          App._memoriserLieu(App._nomDuLieu(loc, S.createEventData), (S.createEventData||{}).placeLabel, updated.eventLat, updated.eventLng, updated.eventGeoAccuracy);
        }
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
        eventPlaceName: nomPosition || null,
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
      App._memoriserLieu(App._nomDuLieu(loc, dLieu), dLieu.placeLabel, newPost.eventLat, newPost.eventLng, newPost.eventGeoAccuracy);
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
      // Une puce par pôle : son icône et sa couleur ; pleine quand elle est choisie.
      var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
      SECTIONS.forEach(function(s) {
        var isSel = selected.indexOf(s.id) !== -1;
        html += '<button type="button" aria-pressed="' + isSel + '" onclick="App.' + toggleFnName + '(\'' + jsArg(s.id) + '\')" style="display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;cursor:pointer;font:inherit;font-size:13px;font-weight:700;' +
          (isSel ? 'background:' + s.color + ';color:#FFF;border:1.5px solid ' + s.color + ';' : 'background:var(--card);color:var(--ink2);border:1.5px solid var(--line2);') + '">' +
          icoPole(s.id, 15, isSel ? '#FFF' : s.color) + safeHtml(s.nom) +
        '</button>';
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
      if (!phone) { toast('Saisis ton numéro de téléphone.', 'error'); return; }
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      try {
        var res = await supabase.functions.invoke('password-recovery', { body: { action: 'questions', email: phone } });
        var data = res && res.data;
        if (!data || !data.found) {
          toast('Aucune question de sécurité pour ce numéro. Demande à un Admin de réinitialiser ton mot de passe.', 'error');
          return;
        }
        if (data.locked) { toast('Trop de tentatives récentes. Réessaie plus tard.', 'error'); return; }
        S.forgotUser = { phone: phone, sec_q1: data.q1, sec_q2: data.q2 };
        render();
      } catch(err) {
        console.warn('forgot questions error:', err);
        toast('Impossible de récupérer tes questions. Réessaie.', 'error');
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
      if (!a1 || !a2) { toast('Réponds aux deux questions.', 'error'); return; }
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
        toast('Mot de passe réinitialisé. Connecte-toi avec le nouveau.', 'success');
        // Purge les champs sensibles restés dans l'état (mot de passe fraîchement
        // utilisé, réponses aux questions) — même hygiène que login/signup.
        S.champsAuth = {};
        S.forgotUser = null; S.auth = 'login'; render();
      } catch(err) {
        console.warn('reset password error:', err);
        toast('Réinitialisation impossible. Vérifie tes réponses.', 'error');
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
      if (!S.user) { toast('Tu dois être connecté.', 'error'); return; }
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
          text: (S.user.prenom || 'Quelqu\'un') + ' participera à « ' + ((ev.metadata && ev.metadata.title) || ev.eventTitle || 'ton événement') + ' ».',
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
      var auj = isoLocal();
      if (date < auj) { toast('Cette date est déjà passée.', 'error'); return; }
      // Les dates passées sont retirées au passage : la liste reste courte.
      var liste = (S.user.indisponibilites || []).filter(function(x){ return x && x.date >= auj && x.date !== date; });
      liste.push({ date: date, motif: motif });
      App._majMonProfil({ indisponibilites: liste });
      ['indispoDate', 'indispoMotif'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
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
      if (!S.user) { toast('Tu dois être connecté.', 'error'); return; }
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
          title: 'Nouvelle participation',
          text: (S.user.prenom || 'Quelqu\'un') + ' participera à « ' + (ev.eventTitle || 'ton événement') + ' ».',
          targetId: ev.id
        });
      }
      render();
      toast(joining ? 'Participation confirmée.' : 'Participation retirée.', joining ? 'success' : 'info');
    },
  };
