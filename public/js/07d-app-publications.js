// KUN COM VH — Partie 7d : App controller — Publications : onglets et fil, J'aime, partage, mentions, visibilité, pointage, édition, création, sondages, médias, suppression (window.App)

  'use strict';
  Object.assign(App, {

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
      S.preparationId=null; S.prepForm=null; S.lieuxOuverts=false;
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
    afficherPlusFil: function() { S.filLimite = (S.filLimite || 25) + 25; render(); },
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
      S.story=s; S.q=''; S.filLimite = 25;
      if (s !== 'all') {
        var seen = db(SK.SECTION_SEEN, {});
        seen[s] = Date.now();
        dbSet(SK.SECTION_SEEN, seen);
      }
      render();
    },
    search: function(q) {
      S.q = q; S.filLimite = 25;
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
    openMembersList: function() { S.membersListOpen = true; S.membersSearch = ''; render(); },
    closeMembersList: function() { S.membersListOpen = false; render(); },
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
      if (!mine || !mine.deadline) { toast('Aucune tâche à livrer pour toi ici.', 'error'); return; }

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
      var dlTs = echeanceTs(mine.deadline);
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
          title: "Nouveau J'aime",
          text: (S.user.prenom + ' ' + (S.user.nom||'')) + ' a aimé ta publication.',
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
      if (btn) { btn.innerHTML = SVG.bookmark(S.savedPosts[postId]); btn.setAttribute('aria-pressed', S.savedPosts[postId] ? 'true' : 'false'); }
      if (!S.optionsOpen) toast(S.savedPosts[postId] ? 'Publication enregistrée.' : 'Retiré des favoris.', 'success');
    },
    openRepostModal: function(postId) {
      if (!S.user) return;
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===postId; });
      if (!post) return;
      var alreadyReposted = posts.some(function(p){ return p.type === 'REPOST' && p.originalPostId === postId && p.userId === S.user.id; });
      if (alreadyReposted) { toast('Tu as déjà partagé cette publication.', 'error'); return; }
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
      toast('Publication partagée sur ton mur.', 'success');
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
    // serie = lien de toute la série d'un événement répété, plutôt que d'une date.
    postShareUrl: function(postId, serie) {
      return location.origin + '/api/p/' + encodeURIComponent(postId) + (serie ? '?serie=1' : '');
    },
    // Texte qui accompagne le lien : pour un événement, son titre et sa date
    // (ou la période de sa série).
    _texteDePartage: function(post, serie) {
      if (!post) return '';
      if (post.type !== 'EVENT' || !post.eventTitle) return (post.caption || '').slice(0, 100);
      var fmt = function(e, o) { return new Date(e.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', o); };
      if (serie) {
        var dates = datesDeSerie(occurrencesDeSerie(post));
        if (dates.length > 1) return post.eventTitle + ' · ' + dates.length + ' dates, du ' + fmt(dates[0], { day:'numeric', month:'short' }) + ' au ' + fmt(dates[dates.length - 1], { day:'numeric', month:'short' });
      }
      return post.eventTitle + ' · ' + fmt(post, { weekday:'long', day:'numeric', month:'long' }) + (post.eventStart ? ' à ' + post.eventStart : '');
    },
    shareExternal: function(postId, serie) {
      var post = db(SK.POSTS, []).find(function(p){ return p.id === postId; });
      var url = App.postShareUrl(postId, serie);
      if (navigator.share) {
        navigator.share({ title: 'Commit VH', text: App._texteDePartage(post, serie), url: url }).catch(function(){});
      } else {
        App.copyPostLink(postId, serie);
      }
    },
    copyPostLink: function(postId, serie) {
      var url = App.postShareUrl(postId, serie);
      function done(ok) { toast(ok ? 'Lien copié. Colle-le sur WhatsApp ou ailleurs.' : 'Impossible de copier le lien.', ok ? 'success' : 'error'); }
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
      App.ecrirePostFrais(p.id, function(f) { f.geo = g; });
      var evP = posts.find(function(x){ return x.id === p.checkInEventId && isEventLike(x); });
      var onsite = evP ? (checkInPresence(p, evP) === 'onsite') : true;
      if (onsite && evP) { try { announceArrival(p, evP); } catch(e){} }   // présence validée → tout le monde est prévenu
      render();
      toast(onsite ? 'Présence confirmée sur place. ' : 'Position enregistrée, mais hors zone.', onsite ? 'success' : 'info');
    },
    // ⋯ de l'en-tête d'un carrousel de série : options de la date affichée.
    ouvrirOptionsSerie: function(serieId) {
      var membre = db(SK.POSTS, []).find(function(p){ return p.type === 'EVENT' && p.recurrenceGroupId === serieId; });
      if (!membre) return;
      var dates = datesDeSerie(occurrencesDeSerie(membre));
      var idx = Math.min((S.eventGroupIdx && S.eventGroupIdx[serieId]) || 0, dates.length - 1);
      App.openOptions((dates[idx > 0 ? idx : 0] || membre).id);
    },
    // ---- Sélection de dates dans le carrousel d'une série ----
    _datesSerieCourante: function() {
      var sel = S.selSerie;
      if (!sel) return [];
      var membre = db(SK.POSTS, []).find(function(p){ return p.type === 'EVENT' && p.recurrenceGroupId === sel.id; });
      return membre ? datesDeSerie(occurrencesDeSerie(membre)) : [];
    },
    selectionnerSerie: function(serieId, premierId) {
      S.optionsOpen = false; S.optionsPost = null;
      S.selSerie = { id: serieId, ids: {} };
      if (premierId) S.selSerie.ids[premierId] = true;
      render();
    },
    basculerDateSerie: function(id) {
      if (!S.selSerie) return;
      if (S.selSerie.ids[id]) delete S.selSerie.ids[id]; else S.selSerie.ids[id] = true;
      render();
    },
    toutSelectionnerSerie: function() {
      if (!S.selSerie) return;
      var dates = App._datesSerieCourante();
      var toutes = dates.every(function(e){ return S.selSerie.ids[e.id]; });
      S.selSerie.ids = {};
      if (!toutes) dates.forEach(function(e){ S.selSerie.ids[e.id] = true; });
      render();
    },
    quitterSelectionSerie: function() { S.selSerie = null; render(); },
    _datesChoisies: function() {
      var sel = S.selSerie;
      return sel ? App._datesSerieCourante().filter(function(e){ return sel.ids[e.id]; }) : [];
    },
    // Une date : son lien. Plusieurs : le lien de la série et la liste des dates.
    partagerSelectionSerie: function() {
      var choisies = App._datesChoisies();
      if (!choisies.length) return;
      if (choisies.length === 1) { App.shareExternal(choisies[0].id); return; }
      var liste = choisies.map(function(e){ return new Date(e.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' }); }).join(', ');
      var texte = choisies[0].eventTitle + ' : ' + liste;
      var url = App.postShareUrl(choisies[0].id, true);
      if (navigator.share) { navigator.share({ title: 'Commit VH', text: texte, url: url }).catch(function(){}); }
      else App.copyPostLink(choisies[0].id, true);
    },
    supprimerSelectionSerie: function() {
      var choisies = App._datesChoisies();
      if (!choisies.length) return;
      var n = choisies.length;
      if (!window.confirm('Supprimer ' + (n > 1 ? 'ces ' + n + ' dates' : 'cette date') + ' ? Les personnes convoquées seront prévenues de l\'annulation.')) return;
      choisies.forEach(function(e){ App.deletePost(e.id, true); });
      S.selSerie = null;
      if (S.eventGroupIdx && choisies[0]) S.eventGroupIdx[choisies[0].recurrenceGroupId] = 0;
      render();
      toast(n > 1 ? n + ' dates supprimées.' : 'Date supprimée.', 'success');
    },
    // « Republier » une date : le formulaire de création, pré-rempli avec
    // cette date (équipe comprise, sans les réponses), proposée la semaine
    // qui suit la dernière date de la série. Publiée, elle rejoint la série.
    republierSelectionSerie: function() {
      var choisies = App._datesChoisies();
      if (choisies.length !== 1) { toast('Sélectionne une seule date pour la republier.', 'info'); return; }
      var source = choisies[0];
      var suivante = nouvellesDatesSerie([source], occurrencesDeSerie(source), 'suite')[0];
      S.selSerie = null;
      App.openEditEvent(source.id);
      S.editEventId = null;            // création, pas modification
      S.assignOriginal = null;
      S.republierSerie = source.recurrenceGroupId || source.id;
      S.republierDepuis = source.eventDate;
      S.eventAssignments = (source.assignments || []).map(function(a){ return Object.assign({}, a); });
      if (suivante) S.createEventData.date = suivante.date;
      S.createEventData.pinned = false;
      render();
    },
    goToEvent: function(eventId) {
      var posts = db(SK.POSTS, []);
      var ev = posts.find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
      if (!ev) { toast('Cet événement n\'existe plus.', 'error'); return; }
      var todayIso = isoLocal();
      // On bascule sur l'onglet où l'événement se trouve réellement : un culte
      // terminé ce matin est dans l'Historique, pas dans « À venir ».
      S.planningMode = isEventPast(ev) ? 'history' : 'upcoming';
      S.selectedDate = ev.eventDate || todayIso;
      S.tab = 'planning';
      S.createOpen = false; S.commentOpen = false; S.optionsOpen = false;
      // Le filtre « Mes services » cacherait un événement où l'on n'est pas convoqué.
      var convoque = !!(S.user && (ev.assignments || []).some(function(a){ return a && a.userId === S.user.id; }));
      if (S.planningFiltre === 'miens' && !convoque) S.planningFiltre = 'tous';
      render();
      // On amène l'écran sur la carte de l'événement. Pour un convoqué, sur
      // « Je confirme / Je ne peux pas » (ou sa réponse, modifiable), mis en
      // évidence un instant : c'est la raison pour laquelle il a touché la carte.
      setTimeout(function() {
        var carte = document.getElementById('planev-' + eventId);
        if (!carte) { toast('Événement introuvable dans le Planning.', 'info'); return; }
        var reponse = convoque ? document.getElementById('reponse-' + eventId) : null;
        (reponse || carte).scrollIntoView({ behavior: 'smooth', block: reponse ? 'center' : 'start' });
        var halo = carte.firstElementChild && carte.firstElementChild.firstElementChild;
        if (halo) {
          halo.style.transition = 'box-shadow 0.35s ease';
          halo.style.boxShadow = '0 0 0 2px ' + UI.accent;
          setTimeout(function(){ halo.style.boxShadow = ''; }, 1800);
        }
        if (reponse) {
          reponse.style.boxShadow = '0 0 0 6px var(--accent-soft)';
          reponse.style.background = 'var(--accent-soft)';
          setTimeout(function(){ reponse.style.boxShadow = ''; reponse.style.background = ''; }, 1800);
        }
      }, 80);
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
      if (S.videoProcessing) { toast('Patiente, la vidéo est en cours de traitement…', 'warning'); return; }
      var ta = document.getElementById('editPostText');
      var txt = (ta ? ta.value : (S.postText||'')).trim();
      if (!txt && S.pendingMedia.length === 0) { toast('Ajoute du texte ou une photo.', 'error'); return; }
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id === postId; });
      if (!post) return;
      // Contrôle serveur-symétrique : l'ouverture de l'éditeur est déjà gardée,
      // mais la sauvegarde reste le point d'écriture réel — on y revérifie.
      var uSave = S.user || {};
      if (uSave.role !== 'GRAND_RESPONSABLE' && post.userId !== uSave.id) { toast('Action non autorisée.', 'error'); return; }
      var avantEdition = JSON.parse(JSON.stringify(post));

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
          toast('Enregistrement de ta position…', 'info');
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

      // Seuls les champs modifiés partent, posés sur la version du serveur.
      var apresEdition = JSON.parse(JSON.stringify(post));
      Object.keys(post).forEach(function(k){ delete post[k]; });
      Object.assign(post, avantEdition);
      dbSet(SK.POSTS, posts);
      await App.ecrireModifications(avantEdition, apresEdition);
      post = db(SK.POSTS, []).find(function(p){ return p.id === postId; }) || apresEdition;

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
    // « Événement » dans Nouvelle publication : on passe au formulaire
    // d'événement en emportant le texte (description) et la première photo
    // (affiche) déjà saisis.
    passerEnEvenement: function() {
      var champ = document.getElementById('newPostText');
      var texte = ((champ ? champ.value : S.postText) || '').trim();
      var photo = (S.pendingMedia || []).find(function(m){ return typeof m === 'string' && !isVideoUrl(m) && m.indexOf('https://') === 0; }) || null;
      S.postText = ''; S.pendingMedia = []; S.pollQuestion = '';   // brouillon emporté : pas de confirmation
      App.closeCreate();
      App.openCreateEvent();
      S.createEventData = { desc: texte };
      if (photo) S.eventImage = photo;
      render();
      setTimeout(function(){ var t = document.getElementById('eventTitle'); if (t) t.focus(); }, 120);
    },
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
      if (!S.user) { toast('Tu dois être connecté.', 'error'); return; }
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
          var lu = res && res.data && res.data.content ? parsePostItem({ id: postId, content: res.data.content }) : null;
          var fresh = (lu && lu.poll) ? lu : post;
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
        collective += '<button type="button" onclick="App.' + insertFn + '(\'@tous \')" style="background:var(--accent-soft);color:var(--lien);border:none;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">' + ico('megaphone', 13, 'currentColor') + 'Tous les membres</button>';
      }
      SECTIONS.forEach(function(s) {
        if (q && s.nom.toLowerCase().indexOf(q) !== 0 && s.id.toLowerCase().indexOf(q) !== 0) return;
        collective += '<button type="button" onclick="App.' + insertFn + '(\'@' + jsArg(s.nom.replace(/\s+/g,'')) + ' \')" style="background:var(--accent-soft);color:var(--lien);border:none;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">' + icoPole(s.id, 13) + 'Pôle ' + safeHtml(s.nom) + '</button>';
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
            return '<button type="button" onclick="App.' + insertFn + '(\'@' + jsArg((u.prenom||'') + (u.nom||'')) + ' \')" style="background:var(--accent-soft);color:var(--lien);border:none;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">' + ico('user', 13, 'currentColor') + safeHtml((u.prenom||'') + ' ' + (u.nom||'')) + '</button>';
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
          toast('Impossible de mélanger une vidéo avec des photos dans la même publication. Retire d\'abord les photos.', 'error');
          return;
        }
        var maxVideoBytes = 60 * 1024 * 1024;
        if (videoFile.size > maxVideoBytes) {
          toast('Vidéo trop volumineuse (60 Mo au plus). Choisis une vidéo plus courte ou plus légère.', 'error');
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
        toast('Une vidéo est déjà sélectionnée. Retire-la pour ajouter des photos.', 'error');
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
      if (S.videoProcessing) { toast('Patiente, la vidéo est en cours de traitement…', 'warning'); return; }
      var txt = ((document.getElementById('newPostText')||{}).value||'').trim();
      if (!txt && S.pendingMedia.length===0 && !S.pollOpen) { toast('Ajoute du texte, une photo ou un sondage.', 'error'); return; }
      if (!S.user) { toast('Tu dois être connecté.', 'error'); return; }

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
        if (!pQuestion) { toast('Ajoute une question à ton sondage.', 'error'); return; }
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
    deletePost: function(postId, silencieux) {
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

      // Un événement supprimé est un événement ANNULÉ pour ceux qui y étaient
      // convoqués : ils sont prévenus (cloche et téléphone), sinon leur
      // convocation restait en suspens sans explication.
      if (p.type === 'EVENT' && Array.isArray(p.assignments)) {
        var quand = p.eventDate ? new Date(p.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }) : '';
        var prevenus = {};
        p.assignments.forEach(function(a) {
          if (!a || !a.userId || a.userId === u.id || prevenus[a.userId]) return;
          prevenus[a.userId] = true;
          sendNotificationToUser(a.userId, {
            type: 'EVENT_CANCELLED',
            title: 'Événement annulé',
            text: '« ' + (p.eventTitle || 'Événement') + ' »' + (quand ? ' du ' + quand : '') + ' est annulé. Tu n\'es plus attendu(e).',
            targetId: p.id
          });
        });
      }

      if (hasHistory) {
        var archiveLe = Date.now();
        App.ecrirePostFrais(p.id, function(f) { f.type = 'EVENT_ARCHIVED'; f.archivedAt = archiveLe; });
        p.type = 'EVENT_ARCHIVED';
        p.archivedAt = archiveLe;
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
          // Hors ligne, le marqueur part en file d'attente (_upsertFiable) : sans
          // lui, la publication ressusciterait à chaque synchro.
          var tombstone = Object.assign({}, p, { status: 'deleted' });
          App._upsertFiable('kun_com_posts', { id: p.id, content: tombstone });
        }
        deleteUnusedMediaFromStorage((p.mediaUrls || []), postId);
      }
      S.optionsOpen=false; S.optionsPost=null;
      if (silencieux) return;
      render();
      toast(hasHistory ? 'Événement supprimé — les étoiles déjà attribuées restent conservées.' : 'Publication supprimée.', 'success');
    },
  });
