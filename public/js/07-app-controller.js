// KUN COM VH — Partie 7/8 : App controller — toutes les actions (window.App)

  'use strict';
  // ============================================================
  // APP CONTROLLER — toutes les actions
  // ============================================================
  window.App = {
    renderAssignmentsList: function() {
      if (!S.eventAssignments || S.eventAssignments.length === 0) {
        return '<div style="font-size:13px;color:#8E8E93;margin-bottom:12px;">Aucun membre assigné.</div>';
      }
      return '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">' +
        S.eventAssignments.map(function(a, idx) {
          return '<div style="display:flex;align-items:center;justify-content:space-between;background:#F2F2F7;padding:8px 12px;border-radius:8px;">' +
            '<div style="display:flex;flex-direction:column;">' +
              '<span style="font-size:13px;font-weight:700;color:#000;">' + safeHtml(a.userName) + '</span>' +
              '<span style="font-size:12px;color:#8E8E93;">' + safeHtml(a.task) + '</span>' +
            '</div>' +
            '<button type="button" onclick="App.removeAssignment(' + idx + ')" style="background:none;border:none;color:#FF3B30;font-size:16px;cursor:pointer;">&times;</button>' +
          '</div>';
        }).join('') +
      '</div>';
    },
    addAssignment: function() {
      var select = document.getElementById('assignUserSelect');
      var taskInput = document.getElementById('assignTaskInput');
      if (select && select.value && taskInput && taskInput.value.trim()) {
        var allU = db(SK.USERS, []);
        var u = allU.find(function(user){ return user.id === select.value; });
        if (u) {
          S.eventAssignments = S.eventAssignments || [];
          S.eventAssignments.push({
            userId: u.id,
            userName: u.prenom + ' ' + u.nom,
            task: taskInput.value.trim()
          });
          select.value = '';
          taskInput.value = '';
          var container = document.getElementById('eventAssignmentsList');
          if (container) {
            container.innerHTML = App.renderAssignmentsList();
          } else {
            render();
          }
        }
      }
    },
    removeAssignment: function(idx) {
      if (S.eventAssignments) {
        S.eventAssignments.splice(idx, 1);
        var container = document.getElementById('eventAssignmentsList');
        if (container) {
          container.innerHTML = App.renderAssignmentsList();
        } else {
          render();
        }
      }
    },
    syncCreateEventData: function() {
      var titleEl = document.getElementById('eventTitle');
      var locEl = document.getElementById('eventLocation');
      var dateEl = document.getElementById('eventDate');
      var startEl = document.getElementById('eventStart');
      var endEl = document.getElementById('eventEnd');
      var descEl = document.getElementById('eventDesc');
      var pinnedEl = document.getElementById('eventPinned');
      if (titleEl || locEl || descEl) {
        S.createEventData = {
          title: titleEl ? titleEl.value : '',
          location: locEl ? locEl.value : '',
          date: dateEl ? dateEl.value : '',
          start: startEl ? startEl.value : '',
          end: endEl ? endEl.value : '',
          desc: descEl ? descEl.value : '',
          pinned: pinnedEl ? pinnedEl.checked : false
        };
      }
    },
    syncEditProfileData: function() {
      var prenomEl = document.getElementById('editPrenom');
      var nomEl = document.getElementById('editNom');
      var bioEl = document.getElementById('editBio');
      if (prenomEl || nomEl || bioEl) {
        S.editProfileData = {
          prenom: prenomEl ? prenomEl.value : '',
          nom: nomEl ? nomEl.value : '',
          bio: bioEl ? bioEl.value : ''
        };
      }
    },
    openCreateEvent: function() { S.createEventOpen = true; S.eventSections = []; S.eventAssignments = []; S.createEventData = null; render(); },
    closeCreateEvent: function() { S.createEventOpen = false; S.createEventData = null; render(); },
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
      if (btn) { btn.textContent = 'Création...'; btn.disabled = true; }
      var newPost = {
        id: 'evt_' + Date.now(),
        userId: S.user.id,
        author: S.user.prenom + ' ' + S.user.nom,
        authorAvatar: (S.user.prenom||'M').charAt(0).toUpperCase(),
        avatarColor: S.user.avatar_color || '#5856D6',
        avatar_color: S.user.avatar_color || '#5856D6',
        avatar_url: S.user.avatar_url || null,
        role: S.user.role,
        type: 'EVENT',
        eventTitle: title,
        eventDate: date,
        eventStart: start,
        eventEnd: end,
        eventLocation: loc,
        eventSections: (S.eventSections||[]).slice(),
        assignments: (S.eventAssignments||[]).slice(),
        caption: desc,
        is_pinned: pinned,
        timestamp: Date.now(),
        likedBy: [],
        comments: [],
        mediaUrls: []
      };
      var allPosts = db(SK.POSTS, []);
      allPosts.unshift(newPost);
      dbSet(SK.POSTS, allPosts);
      sendTargetedEventNotifications(newPost);
      if (supabase) {
        try {
          await supabase.from('kun_com_posts').upsert({ id: newPost.id, content: newPost, created_at: new Date().toISOString() }, { onConflict: 'id' });
        } catch(e) {
          console.warn("Save event supabase error:", e);
        }
      }
      S.createEventOpen = false;
      S.selectedDate = date;
      S.tab = pinned ? 'home' : 'planning';
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast('Événement créé avec succès ! 🎉', 'success');
    },
    submitEvent: function() {
      var title = (document.getElementById('evTitle')||{}).value;
      var dStr = (document.getElementById('evDate')||{}).value;
      var tStr = (document.getElementById('evTime')||{}).value;
      var loc = (document.getElementById('evLocation')||{}).value;
      var sec = (document.getElementById('evSection')||{}).value;
      var desc = (document.getElementById('evDesc')||{}).value;
      var pin = (document.getElementById('evPinned')||{}).checked;
      
      if (!title || !dStr) { toast('Titre et date obligatoires', 'error'); return; }
      
      var d = new Date(dStr);
      var monthStr = d.toLocaleDateString('fr-FR', { month:'short' });
      var dayStr = d.toLocaleDateString('fr-FR', { day:'2-digit' });
      
      var secObj = SECTIONS.find(function(s){ return s.id === sec; });
      var secNomStr = secObj ? secObj.nom : 'Département';
      
      var posts = db(SK.POSTS, []);
      var newPost = {
        id: 'event-'+Date.now(), userId: S.user.id, timestamp: Date.now(),
        author: S.user.prenom + ' ' + S.user.nom, authorAvatar: S.user.prenom.charAt(0).toUpperCase(),
        avatarColor: S.user.avatar_color || '#007AFF',
        sectionId: sec, sectionNom: secNomStr,
        type: 'EVENT', is_pinned: pin,
        metadata: {
           title: title, date: dStr, time: tStr, location: loc,
           month: monthStr, day: dayStr, participations: {}
        },
        caption: desc, mediaUrls: [], likes: 0, likedBy: [], comments: []
      };
      
      posts.unshift(newPost);
      dbSet(SK.POSTS, posts);
      
      if (supabase) supabase.from('kun_com_posts').upsert({ id: newPost.id, content: newPost, created_at: new Date().toISOString() }, { onConflict: 'id' }).then(function(){});
      
      S.createEventOpen = false;
      S.tab = 'home'; S.q = '';
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast('Événement créé ! 🎉', 'success');
    },
    togglePin: function(postId) {
      var posts = db(SK.POSTS, []);
      var p = posts.find(function(x){ return x.id === postId; });
      if (p) {
        p.is_pinned = !p.is_pinned;
        dbSet(SK.POSTS, posts);
        if (supabase) supabase.from('kun_com_posts').upsert({ id: p.id, content: p }, { onConflict: 'id' }).then(function(){});
      }
      S.optionsOpen = false; S.optionsPost = null;
      render();
    },
    
    
    getUserSections: function(u) {
      if (!u) return [];
      if (Array.isArray(u.sections) && u.sections.length > 0) return u.sections;
      if (u.section_id) return [u.section_id];
      return [];
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
      var activeStyle = 'flex:1;height:44px;border-radius:12px;border:1.5px solid #007AFF;background:#F0F6FF;color:#007AFF;font-size:13.5px;font-weight:800;cursor:pointer;';
      var inactiveStyle = 'flex:1;height:44px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;color:#3A3A3C;font-size:13.5px;font-weight:800;cursor:pointer;';
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
        var bg = isSel ? '#007AFF' : '#F2F2F7';
        var color = isSel ? '#FFF' : '#3A3A3C';
        html += '<div onclick="App.' + toggleFnName + '(\'' + s.id + '\')" style="background:' + bg + ';color:' + color + ';padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;transition:0.2s;">' + s.icon + ' ' + s.label + '</div>';
      });
      html += '</div>';
      return html;
    },
checkForgotEmail: function(e) {
      e && e.preventDefault();
      var email = ((document.getElementById('forgotEmail')||{}).value||'').trim();
      var users = db(SK.USERS, []);
      var u = users.find(function(x){ return x.email.toLowerCase() === email.toLowerCase(); });
      if (!u) { toast('Aucun compte trouvé avec cet e-mail.', 'error'); return; }
      if (!u.sec_q1) { toast('Ce compte n\'a pas configuré de questions de sécurité.', 'error'); return; }
      S.forgotUser = u;
      render();
    },
    resetPassword: async function(e) {
      e && e.preventDefault();
      if (!S.forgotUser) return;
      var a1 = ((document.getElementById('forgotA1')||{}).value||'').trim().toLowerCase();
      var a2 = ((document.getElementById('forgotA2')||{}).value||'').trim().toLowerCase();
      var newPwd = ((document.getElementById('forgotPwd')||{}).value||'').trim();
      if (a1 !== S.forgotUser.sec_a1 || a2 !== S.forgotUser.sec_a2) {
        toast('Les réponses de sécurité sont incorrectes.', 'error'); return;
      }
      var users = db(SK.USERS, []);
      var idx = users.findIndex(function(x){ return x.id === S.forgotUser.id; });
      if (idx !== -1) {
        var hashedNewPwd = await hashPassword(newPwd);
        users[idx].pwd = hashedNewPwd;
        dbSet(SK.USERS, users);
        if (supabase) supabase.from('kun_com_profiles').upsert({ id: users[idx].id, content: users[idx] }, { onConflict: 'id' }).then(function(){});
      }
      S.forgotUser = null;
      S.auth = 'login';
      render();
      toast('Votre mot de passe a été réinitialisé ! 🎉', 'success');
    },
toggleParticipation: function(postId, status) {
      if (!S.user) return;
      var posts = db(SK.POSTS, []);
      var p = posts.find(function(x){ return x.id === postId; });
      if (p && p.metadata) {
        if (!p.metadata.participations) p.metadata.participations = {};
        p.metadata.participations[S.user.id] = status;
        dbSet(SK.POSTS, posts);
        if (supabase) supabase.from('kun_com_posts').upsert({ id: p.id, content: p }, { onConflict: 'id' }).then(function(){});
        render();
      }
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
                  parent.innerHTML = '<img id="editAvatarPreview" src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;" />';
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
                  el.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;" />';
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
        sections: S.editSections.slice(),
        avatar_url: avatar_url,
        cover_url: cover_url
      });
      delete updatedUser.section_id;
      delete updatedUser.section_nom;
      
      S.user = updatedUser;
      
      // Save session safely
      try {
        localStorage.setItem(SK.SESS, JSON.stringify(updatedUser));
      } catch(e) {
        var cleanUser = Object.assign({}, updatedUser);
        if (cleanUser.avatar_url && cleanUser.avatar_url.length > 30000) cleanUser.avatar_url = null;
        if (cleanUser.cover_url && cleanUser.cover_url.length > 30000) cleanUser.cover_url = null;
        try { localStorage.setItem(SK.SESS, JSON.stringify(cleanUser)); } catch(e2){}
      }
      
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
      
      S.editProfileOpen = false;
      render();
      toast('Profil mis à jour !', 'success');    },
    openPostOptions: function(id) { S.selectedPostId = id; S.postOptionsOpen = true; render(); },
    closePostOptions: function() { S.postOptionsOpen = false; S.selectedPostId = null; render(); },
    viewPost: function(id) {
       S.postOptionsOpen = false; S.selectedPostId = null;
       S.q = ''; // clear search
       // Scroll to post logic could go here
       render();
       setTimeout(function() {
         var el = document.getElementById('post-' + id);
         if (el) el.scrollIntoView({behavior: 'smooth'});
       }, 100);
    },
    shareProfile: function() { toast('Fonction de partage bientôt disponible !'); },


    // Auth

    // Notifications System
    openNotifications: function() {
      S.notificationsOpen = true;
      if ('Notification' in window && Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch(e){}
      }
      render();
    },
    closeNotifications: function() {
      S.notificationsOpen = false;
      render();
    },
    markAllNotificationsRead: function() {
      if (!S.user || !Array.isArray(S.user.notifications)) return;
      S.user.notifications.forEach(function(n){ n.read = true; });
      var allUsers = db(SK.USERS, []);
      var uIdx = allUsers.findIndex(function(u){ return u.id === S.user.id; });
      if (uIdx !== -1) allUsers[uIdx] = S.user;
      dbSet(SK.USERS, allUsers);
      try { localStorage.setItem(SK.SESS, JSON.stringify(S.user)); } catch(e){}
      if (supabase) supabase.from('kun_com_profiles').upsert({ id: S.user.id, content: S.user }, { onConflict: 'id' }).then(function(){}, function(e){});
      render();
    },
    clickNotification: function(notifId, targetId) {
      if (!S.user || !Array.isArray(S.user.notifications)) return;
      var notif = S.user.notifications.find(function(n){ return n.id === notifId; });
      if (notif) notif.read = true;
      var allUsers = db(SK.USERS, []);
      var uIdx = allUsers.findIndex(function(u){ return u.id === S.user.id; });
      if (uIdx !== -1) allUsers[uIdx] = S.user;
      dbSet(SK.USERS, allUsers);
      try { localStorage.setItem(SK.SESS, JSON.stringify(S.user)); } catch(e){}
      if (supabase) supabase.from('kun_com_profiles').upsert({ id: S.user.id, content: S.user }, { onConflict: 'id' }).then(function(){}, function(e){});
      
      S.notificationsOpen = false;
      render();
      
      if (targetId) {
        var posts = db(SK.POSTS, []);
        var targetPost = posts.find(function(p){ return p.id === targetId; });
        if (targetPost) {
          if (targetPost.type === 'EVENT') {
            S.tab = 'calendar';
            render();
          } else {
            S.tab = 'home';
            render();
            var el = document.getElementById('post-' + targetId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    },

    nav: function(v) { S.auth = v; render(); },
    login: async function(e) {
      e && e.preventDefault();
      var email = ((document.getElementById('loginEmail')||{}).value || '').trim();
      var pwd = ((document.getElementById('loginPwd')||{}).value || '').trim();
      if (!email) { toast('Veuillez saisir votre e-mail.', 'error'); return; }
      if (!pwd) { toast('Veuillez saisir votre mot de passe.', 'error'); return; }

      var users = db(SK.USERS, []);
      var user = users.find(function(u){ return u.email && u.email.toLowerCase() === email.toLowerCase(); });

      // Supabase Remote Search Fallback if user not found in local cache
      if (!user && supabase) {
        try {
          var res = await supabase.from('kun_com_profiles').select('*');
          if (res && res.data) {
            var remoteUsers = res.data.map(function(item){ return item.content || item; });
            user = remoteUsers.find(function(u){ return u.email && u.email.toLowerCase() === email.toLowerCase(); });
            if (user) {
              users.push(user);
              dbSet(SK.USERS, users);
            }
          }
        } catch(err){}
      }

      if (!user) {
        toast('Compte introuvable. Veuillez vérifier votre e-mail ou vous inscrire.', 'error');
        return;
      }

      var hashedLoginPwd = await hashPassword(pwd);
      // Support both old plaintext and new hashed passwords
      if (user.pwd && user.pwd !== pwd && user.pwd !== hashedLoginPwd) {
        toast('Mot de passe incorrect.', 'error');
        return;
      }

      user.is_online = true;
      user.last_seen_at = new Date().toISOString();
      user.last_action = 'Connexion';
      
      var uIdx = users.findIndex(function(x){ return x.id === user.id; });
      if (uIdx !== -1) users[uIdx] = user;
      else users.push(user);
      dbSet(SK.USERS, users);

      try {
        localStorage.setItem(SK.SESS, JSON.stringify(user));
      } catch(quotaErr) {
        var cleanUser = Object.assign({}, user);
        if (cleanUser.avatar_url && cleanUser.avatar_url.length > 30000) cleanUser.avatar_url = null;
        if (cleanUser.cover_url && cleanUser.cover_url.length > 30000) cleanUser.cover_url = null;
        localStorage.setItem(SK.SESS, JSON.stringify(cleanUser));
      }

      S.user = user;
      S.auth = 'app';
      S.tab = 'home';
      try { localStorage.setItem(SK.SESS, JSON.stringify(user)); } catch(e){}
      render();
      toast('Connexion réussie ! Bienvenue ' + (user.prenom||'Membre') + '. 🎉', 'success');
      try { tryOpenDeepLinkedPost(); } catch(e){}
    },
    signup: async function(e) {
      e && e.preventDefault();
      var prenom = ((document.getElementById('signupPrenom')||{}).value||'').trim();
      var nom = ((document.getElementById('signupNom')||{}).value||'').trim();
      var email = ((document.getElementById('signupEmail')||{}).value||'').trim();
      var pwd = ((document.getElementById('signupPwd')||{}).value||'').trim();
      var q1 = ((document.getElementById('signupQ1')||{}).value||'');
      var a1 = ((document.getElementById('signupA1')||{}).value||'').trim().toLowerCase();
      var q2 = ((document.getElementById('signupQ2')||{}).value||'');
      var a2 = ((document.getElementById('signupA2')||{}).value||'').trim().toLowerCase();
      if (!prenom||!nom||!email||!pwd||!a1||!a2) { toast('Veuillez remplir tous les champs et questions de sécurité.', 'error'); return; }
      if (S.signupSections.length === 0) { toast('Veuillez choisir au moins 1 section.', 'error'); return; }

      var users = db(SK.USERS, []);
      if (users.find(function(u){ return u.email.toLowerCase()===email.toLowerCase(); })) {
        toast('Un compte existe déjà avec cet e-mail.', 'error'); return;
      }
      var userSecs = S.signupSections.length > 0 ? S.signupSections.slice() : ['cadrage'];
      // L'accès Grand Responsable ne se donne plus à l'inscription (champ "Autre"
      // retiré) — il se fait désormais depuis le profil, panneau Administration.
      var finalRole = (S.signupRole === 'RESP_SECTION' ? 'RESP_SECTION' : 'MEMBRE');
      var hashedPwd = await hashPassword(pwd);
      var newUser = { id:'u'+Date.now(), prenom:prenom, nom:nom, email:email, sections: userSecs, section_id: userSecs[0], role: finalRole, is_online:true, last_seen_at:new Date().toISOString(), last_action:'Inscription', avatar_color: ['#007AFF','#FF2D55','#34C759','#FF9500','#5856D6','#AF52DE'][Math.floor(Math.random()*6)], pwd: hashedPwd, sec_q1: q1, sec_a1: a1, sec_q2: q2, sec_a2: a2 };
      users.push(newUser); dbSet(SK.USERS, users);
      // Compte créé sur cet appareil : protégé de la purge du cache tant qu'il n'est
      // pas confirmé côté serveur (sinon une inscription hors-ligne serait perdue).
      addLocalAccountId(newUser.id);
      localStorage.setItem(SK.SESS, JSON.stringify(newUser));
      S.user = newUser; S.auth = 'app';

      if (supabase) {
        try {
          var syncRes = await supabase.from('kun_com_profiles').upsert({ id: newUser.id, content: newUser }, { onConflict: 'id' });
          if (syncRes.error) {
            console.error("Supabase profile save error:", syncRes.error);
          }
        } catch(err) {
          console.warn("Supabase signup sync exception:", err);
        }
      }

      S.signupSections = []; S.signupRole = 'MEMBRE';
      render();
      toast('Bienvenue ' + prenom + ' ! Votre compte a été créé. 🎉', 'success');
    },
    logout: function() {
      if (S.user) {
        var users = db(SK.USERS, []); var idx = users.findIndex(function(u){ return u.id===S.user.id; });
        if (idx !== -1) { users[idx].is_online=false; users[idx].last_action='Déconnexion'; dbSet(SK.USERS, users); }
      }
      localStorage.removeItem(SK.SESS); sessionStorage.removeItem(SK.SESS); S.user=null; S.auth='login'; S.tab='home'; render();
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
        var toDelete = posts.filter(function(p){ return ids.indexOf(p.id) !== -1; });
        var remaining = posts.filter(function(p){ return ids.indexOf(p.id) === -1; });
        dbSet(SK.POSTS, remaining);

        if (supabase) {
          toDelete.forEach(function(p) {
            supabase.from('kun_com_posts').delete().eq('id', p.id).then(function(){}, function(e){ console.warn('Bulk delete post error:', e); });
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

        if (supabase) {
          myPosts.forEach(function(p) {
            supabase.from('kun_com_posts').delete().eq('id', p.id).then(function(){}, function(e){ console.warn('Delete post error:', e); });
          });
        }
        // Nettoie les fichiers médias associés dans Storage (sauf s'ils sont encore
        // utilisés par un partage fait par quelqu'un d'autre).
        myPosts.forEach(function(p) {
          deleteUnusedMediaFromStorage((p.mediaUrls || []), p.id);
        });

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
    // PANNEAU ADMIN — statistiques de stockage Supabase (accès par code)
    // ============================================================
    openAdminGate: function() {
      S.adminGateOpen = true;
      S.adminCodeInput = '';
      S.adminCodeError = false;
      render();
      setTimeout(function(){ var i = document.getElementById('adminCodeInput'); if (i) i.focus(); }, 120);
    },
    closeAdminGate: function() { S.adminGateOpen = false; render(); },
    onAdminCodeInput: function(val) { S.adminCodeInput = val; S.adminCodeError = false; },
    // Ce même champ gère deux codes distincts, historiquement séparés (le code
    // stockage AZ7887 et l'ancien code "Admin78" du champ "Autre" à l'inscription,
    // désormais retiré du formulaire) :
    // - AZ7887 ouvre le panneau de statistiques de stockage
    // - Admin78 promeut le compte actuellement connecté au rôle Grand Responsable
    submitAdminCode: function(e) {
      e && e.preventDefault();
      var v = (S.adminCodeInput || '').trim().toUpperCase();
      if (v === ADMIN_ACCESS_CODE) {
        S.adminUnlocked = true;
        S.adminGateOpen = false;
        try { localStorage.setItem('kc_admin_unlocked', '1'); } catch(err) {}
        render();
        App.openStorageStats();
      } else if (v === GRAND_RESPONSABLE_CODE) {
        App.grantGrandResponsable();
      } else {
        S.adminCodeError = true;
        render();
        setTimeout(function(){ var i = document.getElementById('adminCodeInput'); if (i) i.focus(); }, 120);
      }
    },
    // Promeut le compte connecté au rôle Grand Responsable (accès complet : création
    // de publications, suppression de n'importe quelle publication, etc.).
    grantGrandResponsable: function() {
      if (!S.user) { S.adminCodeError = true; render(); return; }
      if (S.user.role === 'GRAND_RESPONSABLE') {
        S.adminGateOpen = false;
        render();
        toast('Ce compte est déjà Grand Responsable.', 'info');
        return;
      }
      S.user.role = 'GRAND_RESPONSABLE';
      var allUsers = db(SK.USERS, []);
      var uIdx = allUsers.findIndex(function(u){ return u.id === S.user.id; });
      if (uIdx !== -1) allUsers[uIdx] = S.user;
      dbSet(SK.USERS, allUsers);
      try { localStorage.setItem(SK.SESS, JSON.stringify(S.user)); } catch(e) {}
      if (supabase) supabase.from('kun_com_profiles').upsert({ id: S.user.id, content: S.user }, { onConflict: 'id' }).then(function(){}, function(e){});
      S.adminGateOpen = false;
      S.adminCodeInput = '';
      render();
      toast('Accès Grand Responsable accordé. 👑', 'success');
    },
    lockAdmin: function() {
      S.adminUnlocked = false;
      S.storageStatsOpen = false;
      try { localStorage.removeItem('kc_admin_unlocked'); } catch(e) {}
      render();
      toast('Panneau admin verrouillé.', 'success');
    },
    openStorageStats: function() {
      if (!S.adminUnlocked) { App.openAdminGate(); return; }
      S.storageStatsOpen = true;
      render();
      App.loadStorageStats();
    },
    closeStorageStats: function() { S.storageStatsOpen = false; render(); },
    // Additionne la taille de tous les fichiers du bucket post-media, page par page
    // (l'API Storage limite à 1000 résultats par appel).
    loadStorageStats: async function() {
      if (!supabase) { S.storageStatsError = 'Connexion indisponible.'; render(); return; }
      S.storageStatsLoading = true;
      S.storageStatsError = null;
      render();
      try {
        var totalBytes = 0;
        var fileCount = 0;
        var offset = 0;
        var pageSize = 1000;
        while (true) {
          var res = await supabase.storage.from('post-media').list('', { limit: pageSize, offset: offset, sortBy: { column: 'name', order: 'asc' } });
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
        S.storageStatsError = 'Impossible de lire le stockage (vérifie la permission SELECT sur storage.objects pour le bucket post-media).';
      }
      S.storageStatsLoading = false;
      render();
    },

    // Navigation
    tab: function(t) { S.tab=t; S.createOpen=false; S.commentOpen=false; S.optionsOpen=false; render(); },

    // Charge la page suivante de publications plus anciennes (pagination à la
    // demande — voir POSTS_PAGE_SIZE). N'efface jamais ce qui est déjà affiché :
    // mergePostsWithLocal est purement additif.
    loadMorePosts: async function() {
      if (S.loadingMorePosts || S.postsAllLoaded || !supabase) return;
      S.loadingMorePosts = true;
      render();
      try {
        var offset = S.postsRemotePage * POSTS_PAGE_SIZE;
        var res = await supabase.from('kun_com_posts').select('*').order('created_at', { ascending: false }).range(offset, offset + POSTS_PAGE_SIZE - 1);
        if (res && res.error) { console.warn('loadMorePosts error:', res.error); toast('Impossible de charger plus de publications.', 'error'); }
        if (res && res.data) {
          if (res.data.length < POSTS_PAGE_SIZE) S.postsAllLoaded = true;
          if (res.data.length > 0) {
            var mergedPosts = mergePostsWithLocal(res.data);
            dbSet(SK.POSTS, mergedPosts);
            S.postsRemotePage++;
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
      var likeCount = post.likedBy.length;
      dbSet(SK.POSTS, posts);
      if (supabase && post) {
        supabase.from('kun_com_posts').upsert({ id: post.id, content: post }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn(e); });
      }
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
        avatarColor: S.user.avatar_color || '#007AFF',
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
    goToEvent: function(eventId) {
      var posts = db(SK.POSTS, []);
      var ev = posts.find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
      if (!ev) { toast('Cet événement n\'existe plus.', 'error'); return; }
      var todayIso = new Date().toISOString().split('T')[0];
      S.planningMode = ev.eventDate && ev.eventDate < todayIso ? 'history' : 'upcoming';
      S.selectedDate = ev.eventDate || todayIso;
      S.tab = 'planning';
      S.createOpen = false; S.commentOpen = false; S.optionsOpen = false;
      render();
    },
    openEditPost: function(postId) {
      var posts = db(SK.POSTS, []);
      var p = posts.find(function(x){ return x.id === postId; });
      if (!p) return;
      S.editPostId = postId;
      S.postVisibility = p.visibility || 'all';
      S.postTargetSections = (p.targetSections || []).slice();
      S.pendingMedia = (p.mediaUrls || []).slice();
      S.postBg = p.postBg || null;
      S.postText = p.caption || '';
      S.pendingVideoPoster = p.videoPoster || null;
      S.postAboutEventId = p.aboutEventId || null;
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
      toast('Publication modifiée ! 🎉', 'success');
    },
    openCreate: function() { S.createOpen=true; S.pendingMedia=[]; S.pendingVideoPoster=null; S.postAboutEventId=null; S.videoProcessing=false; render(); setTimeout(function(){ var t=document.getElementById('newPostText'); if(t) t.focus(); },120); },
    closeCreate: function() { S.createOpen=false; S.pendingMedia=[]; clearPendingLocalCopies(); S.hashSuggestions=false; S.postBg=null; S.postText=''; S.pendingVideoPoster=null; S.postAboutEventId=null; S.videoProcessing=false; render(); },
    onPostInput: function(val) {
      // Préserve le texte tapé à travers les re-render (ex: changement de fond)
      S.postText = val;

      // Suggestions de hashtags
      var words = val.split(/\s/); var last = words[words.length-1];
      var show = last.length > 0 && last.startsWith('#');
      var hashBox = document.getElementById('hashSugg');
      if (hashBox) hashBox.style.display = show ? 'flex' : 'none';

      // Suggestions de mentions (@)
      var match = val.match(/@([\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]*)$/);
      var mentionBox = document.getElementById('mentionSugg');
      if (match && mentionBox) {
        var query = match[1].toLowerCase();
        var users = db(SK.USERS, []).filter(function(u) {
          var name = ((u.prenom||'') + ' ' + (u.nom||'')).toLowerCase();
          return name.indexOf(query) !== -1;
        }).slice(0, 5);

        if (users.length > 0) {
          mentionBox.innerHTML = '<div style="font-size:11px;font-weight:800;color:#007AFF;width:100%;margin-bottom:4px;">Membres à mentionner :</div>' +
            users.map(function(u) {
              return '<button type="button" onclick="App.insertMention(\'@' + safeHtml(u.prenom + u.nom) + ' \')" style="background:#EBF5FF;color:#007AFF;border:none;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;">👤 ' + safeHtml(u.prenom + ' ' + u.nom) + '</button>';
            }).join('');
          mentionBox.style.display = 'flex';
        } else {
          mentionBox.style.display = 'none';
        }
      } else if (mentionBox) {
        mentionBox.style.display = 'none';
      }
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
    setProfileTab: function(tab) {
      S.profileTab = tab;
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
    submitPost: function(e) {
      e && e.preventDefault();
      if (S.videoProcessing) { toast('Patientez, la vidéo est en cours de traitement…', 'warning'); return; }
      var txt = ((document.getElementById('newPostText')||{}).value||'').trim();
      if (!txt && S.pendingMedia.length===0) { toast('Ajoutez du texte ou une photo.', 'error'); return; }
      if (!S.user) { toast('Vous devez être connecté.', 'error'); return; }
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
        avatarColor: S.user.avatar_color || '#007AFF',
        avatar_url: S.user.avatar_url || null,
        sectionId: secId, sectionNom: secNom(secId),
        isVedette: false, scoreText: '',
        caption: txt, mediaUrls: S.pendingMedia.slice(),
        videoPoster: S.pendingMedia.some(function(m){return isVideoUrl(m);}) ? (S.pendingVideoPoster || null) : null,
        postBg: S.pendingMedia.length === 0 ? (S.postBg || null) : null,
        likes: 0, likedBy: [], comments: [],
        visibility: S.postVisibility || 'all',
        targetSections: (S.postTargetSections || []).slice(),
        aboutEventId: S.postAboutEventId || null
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
          supabase.from('kun_com_posts').upsert({ id: newPost.id, content: newPost, created_at: new Date().toISOString() }, { onConflict: 'id' }).then(function(){});
        } catch(err) {
          console.warn("Supabase submitPost sync error:", err);
        }
      }

      // Notifie automatiquement les membres des sections ciblées
      if (!newPost.status || newPost.status !== 'scheduled') {
        sendTargetedSectionPostNotifications(newPost);
      }

      // Enregistre automatiquement les liens partagés dans le profil
      saveLinksToProfile(newPost.userId, extractLinks(txt), newPost.id);

      updateUserActivity('Publication');
      S.createOpen=false; S.pendingMedia=[]; clearPendingLocalCopies(); S.hashSuggestions=false; S.postBg=null; S.postText=''; S.pendingVideoPoster=null; S.postVisibility='all'; S.postTargetSections=[]; S.postAboutEventId=null;
      S.tab = 'home';
      S.q = ''; // Optional: clear search if they were searching
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast('Publication publiée avec succès ! 🎉', 'success');
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
      posts.splice(idx, 1); dbSet(SK.POSTS, posts);
      if (supabase) {
        supabase.from('kun_com_posts').delete().eq('id', postId).then(function(){}, function(e){ console.warn('Delete post error:', e); });
      }
      deleteUnusedMediaFromStorage((p.mediaUrls || []), postId);
      S.optionsOpen=false; S.optionsPost=null;
      render();
      toast('Publication supprimée.', 'success');
    },

    // Comments
    openComments: function(postId) {
      S.commentPostId=postId; S.commentOpen=true; S.pendingCommentImage=null; render();
      window.setTimeout(function(){ var i=document.getElementById('commentInput'); if(i) i.focus(); },150);
    },
    closeComments: function() { S.commentOpen=false; S.commentPostId=null; S.pendingCommentImage=null; render(); },
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
            '<img src="'+dataUrl+'" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #E5E5EA;">' +
            '<button type="button" onclick="App.removeCommentImage()" style="position:absolute;top:-6px;right:-6px;background:rgba(0,0,0,0.7);border:none;border-radius:8px;width:18px;height:18px;color:#FFF;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>' +
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
        var query = match[1].toLowerCase();
        var users = db(SK.USERS, []).filter(function(u) {
          var name = ((u.prenom||'') + ' ' + (u.nom||'')).toLowerCase();
          return name.indexOf(query) !== -1;
        }).slice(0, 5);
        if (users.length > 0) {
          box.innerHTML = users.map(function(u) {
            return '<button type="button" onclick="App.insertCommentMention(\'@' + safeHtml(u.prenom + u.nom) + ' \')" style="background:#EBF5FF;color:#007AFF;border:none;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;">👤 ' + safeHtml(u.prenom + ' ' + u.nom) + '</button>';
          }).join('');
          box.style.display = 'flex';
        } else {
          box.style.display = 'none';
        }
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
    submitComment: function(ev) {
      ev && ev.preventDefault();
      var input = document.getElementById('commentInput');
      var txt = input ? input.value.trim() : '';
      if ((!txt && !S.pendingCommentImage) || !S.user || !S.commentPostId) return;
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===S.commentPostId; });
      if (!post) return;
      var newC = { id:'c'+Date.now(), userId:S.user.id, author:(S.user.prenom||'User')+' '+(S.user.nom?S.user.nom.charAt(0):'')+'.', avatarColor:S.user.avatar_color||'#007AFF', text:txt, imageUrl:S.pendingCommentImage||null, timestamp:Date.now() };
      if (!Array.isArray(post.comments)) post.comments = [];
      post.comments.push(newC); dbSet(SK.POSTS, posts);
      if (supabase && post) supabase.from('kun_com_posts').upsert({ id: post.id, content: post }, { onConflict: 'id' }).then(function(){}, function(e){});
      if (post.userId && post.userId !== S.user.id) {
        sendNotificationToUser(post.userId, {
          type: 'COMMENT',
          title: '💬 Nouveau Commentaire',
          text: S.user.prenom + ' : "' + (txt ? txt.slice(0, 40) : '📷 Photo') + '"',
          targetId: post.id
        });
      }
      updateUserActivity('Commentaire');
      // DOM update: append to list without full re-render
      var list = document.getElementById('commentsList');
      if (list) {
        var div = document.createElement('div');
        div.style.cssText = 'animation:fadeIn 0.3s;';
        div.innerHTML = renderCommentItem(newC);
        list.appendChild(div);
      } else { render(); }
      // Update comment count on post card (outside modal)
      var ccBtn = document.querySelector('#post-'+S.commentPostId+' button[onclick*="openComments"]');
      if (ccBtn && ccBtn.textContent.indexOf('commentaire') !== -1) {
        ccBtn.textContent = 'Voir les ' + post.comments.length + ' commentaire' + (post.comments.length>1?'s':'');
      }
      if (input) input.value = '';
      App.removeCommentImage();
      toast('Commentaire ajouté !', 'success');
    },
    likeComment: function(cId) {
      var likedComments = db(SK.LIKED_COMMENTS, {});
      likedComments[cId] = !likedComments[cId]; dbSet(SK.LIKED_COMMENTS, likedComments);
      var el = document.getElementById('clike-'+cId);
      if (el) el.innerHTML = SVG.heart(likedComments[cId], 15);
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
          var a=di===idx; return '<div style="width:'+(a?'18':'6')+'px;height:6px;border-radius:3px;background:'+(a?'#007AFF':'#C7C7CC')+';transition:all 0.25s;"></div>';
        }).join('');
      }
    },

    // Debrief
    rate: function(secId, score) {
      var u = S.user || {};
      if (secId === u.section_id) { toast('Vous ne pouvez pas noter votre propre section.', 'error'); return; }
      if (!S.ratings[secId]) S.ratings[secId] = { score:0, comment:'' };
      S.ratings[secId].score = score;
      var starsEl = document.getElementById('stars-'+secId);
      if (starsEl) {
        starsEl.innerHTML = [1,2,3,4,5].map(function(s) {
          return '<button type="button" onclick="App.rate(\''+secId+'\','+s+')" style="font-size:28px;cursor:pointer;background:none;border:none;padding:0;color:'+(s<=score?'#FFD700':'#D1D1D6')+';transition:transform 0.1s;" onmousedown="this.style.transform=\'scale(1.2)\'" onmouseup="this.style.transform=\'scale(1)\'">★</button>';
        }).join('');
      }
    },
    rateComment: function(secId, val) {
      if (!S.ratings[secId]) S.ratings[secId] = { score:0, comment:'' };
      S.ratings[secId].comment = val;
    },
    checkIn: function() {
      S.checkedIn = true;
      var btn = document.getElementById('checkInBtn');
      if (btn) { btn.textContent='✓ Présent'; btn.style.background='linear-gradient(135deg,#34C759,#28A347)'; }
      toast('Présence validée ! ✓', 'success');
    },
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

      var hasRatings = false;
      var ts = Date.now();
      
      Object.keys(S.ratings).forEach(function(secId) {
        var r = S.ratings[secId];
        if (r && r.score > 0) {
          hasRatings = true;
          var targetSec = SECTIONS.find(function(s){ return s.id === secId; });
          var tNom = targetSec ? targetSec.nom : secId;
          
          var globalScore = r.score;
          var crit = {
             "Ponctualité": Math.min(5, Math.max(1, globalScore + (Math.random()>0.5?1:0))),
             "Technique": globalScore,
             "Réactivité": Math.min(5, Math.max(1, globalScore - (Math.random()>0.5?1:0))),
             "Esprit d'équipe": Math.min(5, Math.max(1, globalScore + (Math.random()>0.5?1:-1)))
          };
          
          var newPost = {
            id: 'eval-'+secId+'-'+ts, userId: S.user.id, timestamp: ts++,
            author: S.user.prenom + ' ' + S.user.nom,
            authorAvatar: S.user.prenom.charAt(0).toUpperCase(),
            avatarColor: S.user.avatar_color || '#007AFF',
            avatar_url: S.user.avatar_url || null,
            sectionId: S.user.section_id || 'general', sectionNom: secNom(S.user.section_id || 'general'),
            type: 'EVALUATION',
            metadata: {
               eventId: eventId,
               eventTitle: eventTitle,
               teamName: tNom,
               globalScore: globalScore,
               criteria: crit
            },
            caption: r.comment || ("Évaluation de l'équipe " + tNom),
            mediaUrls: [], likes: 0, likedBy: [], comments: []
          };
          posts.unshift(newPost);
        }
      });
      
      if (!hasRatings) {
         toast('Veuillez noter au moins une section.', 'error');
         return;
      }
      
      dbSet(SK.POSTS, posts); 
      if (supabase && newPost) supabase.from('kun_com_posts').upsert({ id: newPost.id, content: newPost }, { onConflict: 'id' }).then(function(){}, function(e){});
      S.ratings = {};
      S.evalEventId = null;
      S.tab='home'; 
      S.q = ''; // Reset search
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast('Évaluations publiées avec succès ! 🎉', 'success');
    }
  };

