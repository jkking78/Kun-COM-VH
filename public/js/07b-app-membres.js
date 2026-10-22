// KUN COM VH — Partie 7b : App controller — Membres : profils, abonnements, messagerie et canaux, recadrage de photo, édition du profil, notifications (window.App)

  'use strict';
  Object.assign(App, {

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
          // Fiche relue telle que son propriétaire l'a écrite : assainie comme à
          // chaque réception (couleur et adresses finissent dans des attributs).
          var fiche = res && res.data && res.data.content ? parseProfileItem({ id: userId, content: res.data.content }) : null;
          if (fiche) {
            var users = db(SK.USERS, []);
            var idx = users.findIndex(function(u){ return u.id === userId; });
            if (idx !== -1) users[idx] = fiche;
            else users.push(fiche);
            dbSet(SK.USERS, users);
          }
          
          var pres = await supabase.from('kun_com_posts').select('*').eq('content->>userId', userId).order('created_at', {ascending:false});
          if (pres && pres.data && pres.data.length > 0) {
            var allPosts = db(SK.POSTS, []);
            pres.data.forEach(function(up) {
              var mapped = parsePostItem(up);
              if (!mapped) return;
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
          title: 'Nouvel abonné',
          text: (S.user.prenom || 'Quelqu\'un') + ' a commencé à te suivre.',
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
          if (!row || !row.id || !row.content || typeof row.content !== 'object') return;
          // Expéditeur et destinataire pris dans les colonnes, que la base
          // contrôle (from_id = l'auteur) : le JSON, lui, est libre et pouvait
          // faire passer un message pour celui d'un autre.
          var m = Object.assign({}, row.content, { id: row.id, fromId: row.from_id, toId: row.to_id });
          if (!byId[m.id]) nouveau = true;
          byId[m.id] = m;
        });
        // P6 : le cache des messages est plafonné aux 1000 plus récents.
        dbSet(SK.DMS, Object.keys(byId).map(function(k){ return byId[k]; })
          .sort(function(a, b){ return (b.timestamp || 0) - (a.timestamp || 0); }).slice(0, 1000));
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
        if (document.hidden) return;   // P2 : rien à relever quand l'app est en arrière-plan
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
        // C5 : hors connexion, le message part dans la file d'attente ; refusé
        // par le serveur, il est marqué « Non envoyé » au lieu de passer pour livré.
        var ligneDm = { id: newMsg.id, from_id: newMsg.fromId, to_id: newMsg.toId, content: newMsg, sent_at: new Date(newMsg.timestamp).toISOString() };
        supabase.from('kun_com_dms').upsert(ligneDm, { onConflict: 'id' }).then(function(r) {
          if (!r || !r.error) return;
          if (estErreurReseau(r.error)) App._mettreEnFileAttenteEcriture({ table: 'kun_com_dms', row: ligneDm });
          else App._messageNonEnvoye(newMsg.id, r.error);
        }, function() { App._mettreEnFileAttenteEcriture({ table: 'kun_com_dms', row: ligneDm }); });
      }
      // Pas d'extrait dans la notification : elle est rangée dans la fiche du
      // destinataire, que tous les membres peuvent lire. L'aperçu du message
      // n'apparaît que sur le téléphone, ajouté par le serveur (fonction push).
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
            text: 'a écrit dans le canal.',
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
          text: 't\'a envoyé un message.',
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

    saveProfile: async function(btn) {
      if (btn) { btn.innerHTML = 'Enregistrement...'; btn.disabled = true; }
      var u = S.user;
      var prenom = document.getElementById('editPrenom').value.trim();
      var nom = document.getElementById('editNom').value.trim();
      var bio = document.getElementById('editBio').value.trim();
      var skills = ((document.getElementById('editSavoirFaire')||{}).value || '').trim();
      var newPwd = ((document.getElementById('editNewPwd')||{}).value || '').trim();

      if (S.editSections.length === 0) {
        toast('Choisis au moins un pôle.', 'error');
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

      if (notif && notificationAnnulee(notif)) {
        toast('Cet événement a été annulé : tu n\'es plus attendu(e).', 'info');
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
  });
