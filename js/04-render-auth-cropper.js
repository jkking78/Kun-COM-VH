// KUN COM VH — Partie 4/8 : Écrans d'authentification, recadrage photo, liste des membres

  'use strict';
  // ============================================================
  // AUTH SCREENS
  // ============================================================
    function renderCropperModal() {
    if (!S.cropperOpen || !S.cropperDataUrl) return '';
    var title = S.cropperTitle || 'Recadrer la photo';
    // Barre d'outils (Pivoter / Réinitialiser / Carré) façon Facebook — uniquement
    // quand le recadrage est libre (photo de publication). Pour l'avatar ou la
    // couverture, le format est imposé, donc les outils de ratio n'ont pas de sens.
    var toolbar = '';
    if (S.cropperFreeRatio) {
      var sqActive = !!S.cropperSquare;
      toolbar = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 26px calc(16px + env(safe-area-inset-bottom));background:rgba(0,0,0,0.85);border-top:0.5px solid rgba(255,255,255,0.12);">' +
        '<button type="button" onclick="App.cropperRotate()" style="background:none;border:none;color:#FFF;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;padding:4px 8px;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="13" height="13" rx="2"/><path d="M16 4h3a2 2 0 0 1 2 2v3"/><polyline points="18 2 21 5 18 8"/></svg>' +
          '<span style="font-size:11.5px;font-weight:700;">Pivoter</span>' +
        '</button>' +
        '<button type="button" onclick="App.cropperReset()" style="background:none;border:none;color:#FFF;font-size:14px;font-weight:800;cursor:pointer;padding:8px 10px;">Réinitialiser</button>' +
        '<button type="button" onclick="App.cropperToggleSquare()" style="background:none;border:none;color:' + (sqActive ? '#0B63F6' : '#FFF') + ';display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;padding:4px 8px;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + (sqActive ? '#0B63F6' : '#FFF') + '" stroke-width="2" stroke-dasharray="3 2.5" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="1.5"/></svg>' +
          '<span style="font-size:11.5px;font-weight:700;">' + (sqActive ? 'Libre' : 'Carré') + '</span>' +
        '</button>' +
      '</div>';
    }
    return '<div id="cropperModal" class="safe-top" style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;flex-direction:column;box-sizing:border-box;animation:fadeIn 0.2s ease-out;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(0,0,0,0.8);border-bottom:0.5px solid rgba(255,255,255,0.15);box-sizing:border-box;z-index:10;">' +
        '<button onclick="App.closeCropper()" style="background:rgba(255,255,255,0.15);color:#FFF;border:none;border-radius:12px;padding:8px 16px;font-size:13.5px;font-weight:700;cursor:pointer;">Annuler</button>' +
        '<div style="font-size:15px;font-weight:800;color:#FFF;letter-spacing:-0.2px;">' + safeHtml(title) + '</div>' +
        '<button onclick="App.confirmCropper()" style="background:#0B63F6;color:#FFF;border:none;border-radius:12px;padding:8px 18px;font-size:13.5px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(0,122,255,0.4);">Terminé</button>' +
      '</div>' +
      // Scène de recadrage : conteneur en position absolue avec des dimensions
      // explicites. Cropper.js calcule la largeur de sa zone à partir du parent de
      // l'image — un parent en flex + padding lui faisait dépasser l'écran à droite.
      '<div style="flex:1;position:relative;overflow:hidden;background:#000;">' +
        // data-no-morph : Cropper.js injecte son propre DOM (poignées, canvas) à
        // l'intérieur de ce conteneur, en dehors de ce que ce template génère — il ne
        // faut jamais laisser le diffing DOM (morphdom) toucher ce sous-arbre, sous
        // peine de détruire l'instance de recadrage en cours à chaque re-render.
        '<div id="cropperStage" data-no-morph="true" style="position:absolute;top:12px;right:12px;bottom:12px;left:12px;overflow:hidden;">' +
          '<img id="cropperTargetImage" src="' + S.cropperDataUrl + '" style="display:block;max-width:100%;" />' +
        '</div>' +
      '</div>' +
      toolbar +
    '</div>';
  }

  // Met à jour le bouton "Carré / Libre" directement dans le DOM : un render() global
  // détruirait l'instance Cropper en cours (l'utilisateur perdrait son recadrage).
  function syncCropperSquareBtn() {
    var modal = document.getElementById('cropperModal');
    if (!modal) return;
    var btn = modal.querySelector('[onclick="App.cropperToggleSquare()"]');
    if (!btn) return;
    var col = S.cropperSquare ? '#0B63F6' : '#FFF';
    btn.style.color = col;
    var svg = btn.querySelector('svg'); if (svg) svg.setAttribute('stroke', col);
    var lbl = btn.querySelector('span'); if (lbl) lbl.textContent = S.cropperSquare ? 'Libre' : 'Carré';
  }

  function initCropperIfNeeded() {
    if (S.cropperOpen && S.cropperDataUrl && window.Cropper) {
      setTimeout(function() {
        var img = document.getElementById('cropperTargetImage');
        if (img && !img._cropperInst) {
          img._cropperInst = new Cropper(img, {
            aspectRatio: (S.cropperAspectRatio === undefined || S.cropperAspectRatio === null) ? 1 : S.cropperAspectRatio,
            viewMode: 1,
            dragMode: 'move',
            // Ratio libre : la sélection couvre toute l'image au départ, donc valider
            // sans rien toucher conserve exactement les proportions d'origine.
            autoCropArea: S.cropperFreeRatio ? 1 : 0.9,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false
          });
          window._currentCropper = img._cropperInst;
        }
      }, 50);
    }
  }

  // ============================================================
  // MODALE — Liste totale des membres
  // ============================================================
  function renderMembersModal() {
    if (!S.membersListOpen) return '';
    var allUsers = db(SK.USERS, []).slice().sort(function(a,b){
      return (a.prenom||'').localeCompare(b.prenom||'', 'fr', {sensitivity:'base'});
    });
    var q = (S.membersSearch || '').toLowerCase().trim();
    var users = q
      ? allUsers.filter(function(u){
          var full = ((u.prenom||'') + ' ' + (u.nom||'')).toLowerCase();
          return full.indexOf(q) !== -1;
        })
      : allUsers;

    var listHtml = users.length === 0
      ? '<div style="padding:60px 24px;text-align:center;color:#8A93A0;">' +
          '<div style="font-size:44px;margin-bottom:12px;">🔍</div>' +
          '<div style="font-size:14px;font-weight:700;">Aucun membre trouvé' + (q ? ' pour "' + safeHtml(S.membersSearch) + '"' : '') + '</div>' +
        '</div>'
      : users.map(function(u){
          var initial = (u.prenom||'M').charAt(0).toUpperCase();
          var avatarNode = u.avatar_url
            ? '<img src="' + u.avatar_url + '" style="width:48px;height:48px;border-radius:24px;object-fit:cover;flex-shrink:0;" />'
            : '<div style="width:48px;height:48px;border-radius:24px;background:' + (u.avatar_color||'#0B63F6') + ';color:#FFF;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + initial + '</div>';
          var uRoleLabel = roleLabel(u.role);
          var secs = getUserSections(u).filter(function(s){ return SECTIONS.some(function(x){ return x.id === s; }); }).map(function(s){ return secNom(s); }).join(' · ');
          return '<div onclick="App.closeMembersList();App.openUserProfile(\'' + u.id + '\');" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:0.5px solid #F7F7F7;cursor:pointer;">' +
            avatarNode +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-size:14.5px;font-weight:800;color:#000;">' + safeHtml((u.prenom||'') + ' ' + (u.nom||'')) + '</div>' +
              (secs ? '<div style="font-size:12px;color:#8A93A0;margin-top:2px;">' + safeHtml(secs) + '</div>' : '') +
            '</div>' +
            (function(){ var t = roleTint(u.role); return '<span style="font-size:11px;font-weight:600;color:' + t.fg + ';background:' + t.bg + ';padding:4px 10px;border-radius:' + UI.pill + ';white-space:nowrap;flex-shrink:0;">' + uRoleLabel + '</span>'; })() +
          '</div>';
        }).join('');

    return '<div class="safe-top" style="position:fixed;inset:0;z-index:9998;background:#FFF;display:flex;flex-direction:column;animation:fadeIn 0.2s ease-out;">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:0.5px solid #F6F7F9;">' +
        '<button onclick="App.closeMembersList()" style="background:#F6F7F9;border:none;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;border-radius:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<div style="font-size:17px;font-weight:800;color:#000;">Tous les membres <span style="color:#8A93A0;font-weight:600;">(' + allUsers.length + ')</span></div>' +
      '</div>' +
      '<div style="padding:10px 14px;border-bottom:0.5px solid #F6F7F9;">' +
        '<div style="display:flex;align-items:center;gap:8px;background:#F6F7F9;border-radius:12px;height:38px;padding:0 12px;">' +
          SVG.search +
          '<input id="membersSearchInput" type="search" value="' + safeHtml(S.membersSearch||'') + '" oninput="App.searchMembers(this.value)" placeholder="Rechercher un membre..." style="flex:1;border:none;background:transparent;font-size:13.5px;color:#000;outline:none;">' +
        '</div>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;">' + listHtml + '</div>' +
    '</div>';
  }

  function renderLogin() {
    return '<div style="flex:1;min-height:0;height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:28px 24px 40px;box-sizing:border-box;background:#FFFFFF;">' +
    '<div style="width:100%;max-width:360px;">' +

      '<div style="text-align:center;margin-bottom:40px;">' +
        '<div style="width:72px;height:72px;border-radius:24px;background:#0B63F6;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 8px 28px rgba(0,122,255,0.4);">' +
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '</div>' +
        '<h1 style="font-size:32px;font-weight:900;color:#0B63F6;margin:0 0 6px;letter-spacing:-1px;">Commit</h1>' +
        '<div style="font-size:11px;font-weight:800;color:#000;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Église Vase d\'Honneur AEV</div>' +
        '<p style="font-size:14px;color:#8A93A0;margin:6px 0 0;">Plateforme du département de la COM</p>' +
      '</div>' +

      '<form onsubmit="event.preventDefault(); App.login(event);" style="display:flex;flex-direction:column;gap:14px;">' +
        renderField('loginEmail', 'email', 'Adresse e-mail', 'votre.email@eglise.org', 'email') +
        renderField('loginPwd', 'password', 'Mot de passe', '••••••••', 'current-password') +
        '<div style="text-align:right;margin-top:-6px;"><span onclick="App.nav(\'forgot\')" style="color:#0B63F6;font-size:12.5px;font-weight:700;cursor:pointer;">Mot de passe oublié ?</span></div>' +
        '<button type="submit" style="' + btnStyle('#0B63F6') + '">Se connecter →</button>' +
      '</form>' +

      '<p style="text-align:center;font-size:13.5px;color:#8A93A0;margin-top:22px;">' +
        'Pas encore de compte ? <span onclick="App.nav(\'signup\')" style="color:#0B63F6;font-weight:700;cursor:pointer;">S\'inscrire</span>' +
      '</p>' +


    '</div></div>';
  }


  function renderForgot() {
    if (!S.forgotUser) {
      return '<div style="flex:1;min-height:0;height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:28px 24px 40px;box-sizing:border-box;background:#FFFFFF;">' +
        '<div style="width:100%;max-width:360px;">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">' +
            '<button onclick="App.nav(\'login\')" style="background:#F6F7F9;border:none;width:36px;height:36px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
            '</button>' +
            '<div><h1 style="font-size:22px;font-weight:900;color:#000;margin:0;">Mot de passe oublié</h1></div>' +
          '</div>' +
          '<p style="font-size:14px;color:#8A93A0;margin-bottom:24px;">Saisissez votre adresse e-mail pour retrouver votre compte et répondre à vos questions de sécurité.</p>' +
          '<form onsubmit="event.preventDefault(); App.checkForgotEmail(event);" style="display:flex;flex-direction:column;gap:14px;">' +
            renderField('forgotEmail', 'email', 'E-mail', 'jean.dupont@eglise.org', 'email') +
            '<button type="submit" style="' + btnStyle('#0B63F6') + '">Suivant →</button>' +
          '</form>' +
        '</div></div>';
    } else {
      return '<div style="flex:1;min-height:0;height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:28px 24px 40px;box-sizing:border-box;background:#FFFFFF;">' +
        '<div style="width:100%;max-width:360px;">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">' +
            '<button onclick="S.forgotUser=null;render();" style="background:#F6F7F9;border:none;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
            '</button>' +
            '<div><h1 style="font-size:22px;font-weight:900;color:#000;margin:0;">Réinitialisation</h1></div>' +
          '</div>' +
          '<p style="font-size:14px;color:#8A93A0;margin-bottom:20px;">Répondez aux deux questions de sécurité que vous avez définies lors de votre inscription.</p>' +
          '<form onsubmit="event.preventDefault(); App.resetPassword(event);" style="display:flex;flex-direction:column;gap:14px;">' +
            '<div><label style="font-size:12px;font-weight:700;color:#25303F;display:block;margin-bottom:5px;">Q1: ' + (S.forgotUser.sec_q1||'Question 1') + '</label>' +
            '<input id="forgotA1" type="text" placeholder="Votre réponse secrète" required style="width:100%;height:48px;border-radius:12px;border:1.5px solid #E4E7EC;background:#F6F7F9;padding:0 14px;font-size:14px;box-sizing:border-box;outline:none;" /></div>' +
            '<div><label style="font-size:12px;font-weight:700;color:#25303F;display:block;margin-bottom:5px;">Q2: ' + (S.forgotUser.sec_q2||'Question 2') + '</label>' +
            '<input id="forgotA2" type="text" placeholder="Votre réponse secrète" required style="width:100%;height:48px;border-radius:12px;border:1.5px solid #E4E7EC;background:#F6F7F9;padding:0 14px;font-size:14px;box-sizing:border-box;outline:none;" /></div>' +
            '<div style="margin-top:10px;">' + renderField('forgotPwd', 'password', 'Nouveau mot de passe', '8 caractères minimum', 'new-password') + '</div>' +
            '<button type="submit" style="' + btnStyle('#0B63F6') + 'margin-top:6px;">Réinitialiser le mot de passe</button>' +
          '</form>' +
        '</div></div>';
    }
  }

  function renderSignup() {
    return '<div style="flex:1;min-height:0;height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;padding:28px 24px 40px;box-sizing:border-box;background:#FFF;">' +
    '<div style="width:100%;max-width:360px;">' +

      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">' +
        '<button onclick="App.nav(\'login\')" style="background:#F6F7F9;border:none;width:36px;height:36px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
        '</button>' +
        '<div><p style="font-size:11px;font-weight:800;color:#0B63F6;text-transform:uppercase;letter-spacing:1.5px;margin:0;">Créer un compte</p>' +
        '<h1 style="font-size:22px;font-weight:900;color:#000;margin:0;">Rejoindre Commit</h1></div>' +
      '</div>' +

      '<form onsubmit="event.preventDefault(); App.signup(event);" style="display:flex;flex-direction:column;gap:12px;">' +
        '<div style="display:flex;gap:10px;">' +
          renderField('signupPrenom', 'text', 'Prénom', 'Jean', 'given-name') +
          renderField('signupNom', 'text', 'Nom', 'Dupont', 'family-name') +
        '</div>' +
        renderField('signupEmail', 'email', 'E-mail', 'jean.dupont@eglise.org', 'email') +
        '<div><label style="font-size:12px;font-weight:700;color:#25303F;display:block;margin-bottom:8px;">Sections / Pôles (1 à 2 max) <span style="color:#E2445C;">*</span></label>' +
          '<div id="signupSectionBadgesContainer">' +
            App.renderSectionBadges(S.signupSections, 'toggleSignupSection') +
          '</div>' +
        '</div>' +
        '<div><label style="font-size:12px;font-weight:700;color:#25303F;display:block;margin-bottom:8px;">Votre fonction <span style="color:#E2445C;">*</span></label>' +
          '<div style="display:flex;gap:8px;">' +
            '<button type="button" id="signupRoleMembre" onclick="App.setSignupRole(\'MEMBRE\')" style="flex:1;height:44px;border-radius:12px;border:1.5px solid #0B63F6;background:#E8EEFB;color:#0B63F6;font-size:13.5px;font-weight:800;cursor:pointer;">🎥 Membre</button>' +
            '<button type="button" id="signupRoleResp" onclick="App.setSignupRole(\'RESP_SECTION\')" style="flex:1;height:44px;border-radius:12px;border:1.5px solid #E4E7EC;background:#F6F7F9;color:#25303F;font-size:13.5px;font-weight:800;cursor:pointer;">🎬 Responsable</button>' +
          '</div>' +
        '</div>' +
        renderField('signupPwd', 'password', 'Mot de passe', '8 caractères minimum', 'new-password') +
        '<div style="margin-top:10px;border-top:1px dashed #E4E7EC;padding-top:12px;"><p style="font-size:13px;font-weight:800;margin:0 0 10px;">Questions de sécurité (Récupération)</p>' +
        '<div><label style="font-size:12px;font-weight:700;color:#25303F;display:block;margin-bottom:5px;">Question 1</label>' +
          '<select id="signupQ1" style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E4E7EC;background:#F6F7F9;padding:0 14px;font-size:13px;color:#000;box-sizing:border-box;margin-bottom:8px;outline:none;">' +
            '<option>Quel est votre verset préféré ?</option>' +
            '<option>Quel est le nom de votre premier animal ?</option>' +
            '<option>Quelle est votre couleur préférée ?</option>' +
          '</select>' +
          '<input id="signupA1" type="text" placeholder="Réponse secrète" required style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E4E7EC;background:#F6F7F9;padding:0 14px;font-size:13px;box-sizing:border-box;margin-bottom:12px;outline:none;" />' +
        '</div>' +
        '<div><label style="font-size:12px;font-weight:700;color:#25303F;display:block;margin-bottom:5px;">Question 2</label>' +
          '<select id="signupQ2" style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E4E7EC;background:#F6F7F9;padding:0 14px;font-size:13px;color:#000;box-sizing:border-box;margin-bottom:8px;outline:none;">' +
            '<option>Quelle est votre fonction dans la COM ?</option>' +
            '<option>Quel est le prénom de votre mère ?</option>' +
            '<option>Quel est votre plat préféré ?</option>' +
          '</select>' +
          '<input id="signupA2" type="text" placeholder="Réponse secrète" required style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E4E7EC;background:#F6F7F9;padding:0 14px;font-size:13px;box-sizing:border-box;margin-bottom:12px;outline:none;" />' +
        '</div></div>' +
        '<button type="submit" style="' + btnStyle('#0B63F6') + 'margin-top:6px;">Créer mon compte</button>' +
      '</form>' +

      '<p style="text-align:center;font-size:13.5px;color:#8A93A0;margin-top:20px;">' +
        'Déjà inscrit ? <span onclick="App.nav(\'login\')" style="color:#0B63F6;font-weight:700;cursor:pointer;">Se connecter</span>' +
      '</p>' +
    '</div></div>';
  }

  function renderField(id, type, label, placeholder, autocomplete) {
    return '<div style="flex:1;">' +
      '<label style="font-size:12px;font-weight:700;color:#25303F;display:block;margin-bottom:5px;">' + label + '</label>' +
      '<input id="' + id + '" type="' + type + '"' + '' + ' placeholder="' + placeholder + '" autocomplete="' + (autocomplete||'off') + '" required ' +
      'style="width:100%;height:50px;border-radius:14px;border:1.5px solid #E4E7EC;background:#F6F7F9;padding:0 16px;font-size:14.5px;color:#000;box-sizing:border-box;outline:none;transition:border-color 0.2s;" ' +
      'onfocus="this.style.borderColor=\'#0B63F6\'" onblur="this.style.borderColor=\'#E4E7EC\'">' +
    '</div>';
  }

  function btnStyle(bg) {
    return 'width:100%;height:52px;background:linear-gradient(135deg,' + bg + ',#0B63F6);color:#FFF;border:none;border-radius:16px;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(0,122,255,0.3);letter-spacing:0.2px;';
  }

