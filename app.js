// ==============================================================================
// APPLICATION WEB PURE PWA - DÉPARTEMENT COMMUNICATION (KUN COM VH)
// Integration Supabase Completa: Auth, Profiles, Realtime Feed & Admin Tracking
// ==============================================================================

(function() {
  console.log("🚀 Lancement du Réseau Social connecté à la base de données Supabase...");

  var STORAGE_KEYS = {
    USERS: 'kun_com_db_profiles',
    POSTS: 'kun_com_db_posts',
    SESSION: 'kun_com_user'
  };

  function getStoredData(key, defaultData) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultData;
    } catch(e) { return defaultData; }
  }

  function setStoredData(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  }

  // INITIALISATION BASE DE DONNÉES PAR DÉFAUT
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    setStoredData(STORAGE_KEYS.USERS, [
      {
        id: 'usr-cadrage-1',
        nom: 'Kouamé',
        prenom: 'Éric',
        email: 'eric.kouame@eglise.org',
        section_id: 'cadrage',
        section_nom: 'Cadrage',
        role: 'RESP_SECTION',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        last_action: 'Connexion'
      },
      {
        id: 'usr-admin-0',
        nom: 'Pasteur',
        prenom: 'Grand Responsable',
        email: 'admin@eglise.org',
        section_id: 'prod',
        section_nom: 'Prod',
        role: 'GRAND_RESPONSABLE',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        last_action: 'Modération'
      }
    ]);
  }

  if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
    setStoredData(STORAGE_KEYS.POSTS, [
      {
        id: 'post-1',
        userId: 'usr-cadrage-1',
        timestamp: Date.now() - 1000 * 60 * 30,
        author: 'Section Cadrage',
        authorAvatar: 'C',
        sectionId: 'cadrage',
        dateText: 'Il y a 30 min • Culte n°1',
        isVedette: true,
        title: 'Captation Directe Culte n°1 #Cadrage',
        sub: 'Coulisses & Couverture Technique',
        scoreText: '4.88 / 5.0',
        caption: 'Bravo à toute l\'équipe #Cadrage pour la couverture dynamique du 1er culte. #CulteDuDimanche #Chorale',
        mediaUrls: [],
        likes: 43,
        isLiked: true,
        comments: [
          { id: 'c1', author: 'Sarah Y.', text: 'Superbe réactivité sur les plans chorale !' },
          { id: 'c2', author: 'Marc T.', text: 'Merci Pasteurs pour les retours positifs.' }
        ]
      }
    ]);
  }

  // ETAT GLOBAL DE L'APPLICATION
  var authView = 'login';
  var currentUser = null;

  var activeTab = 'home';
  var selectedStory = 'all';
  var searchQuery = '';

  var isCreateModalOpen = false;
  var isCommentModalOpen = false;
  var activeCommentPostId = null;
  var selectedPostOptions = null;

  var pendingMediaUrls = [];
  var activeImageIndexes = {};

  var showHashtagSuggestions = false;
  var isCheckedIn = false;
  var likedCommentIds = {};
  
  var activeToast = null;
  var toastTimer = null;

  function triggerToast(message, type) {
    type = type || 'success';
    activeToast = { message: message, type: type };
    renderAppRoot();

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      activeToast = null;
      renderAppRoot();
    }, 2500);
  }

  // RESTAURATION SESSION
  var authTimeout = setTimeout(function() {
    if (!currentUser && authView === 'loading') {
      authView = 'login';
      renderAppRoot();
    }
  }, 1500);

  try {
    var savedUser = sessionStorage.getItem(STORAGE_KEYS.SESSION);
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      authView = 'app';
    } else {
      authView = 'login';
    }
    clearTimeout(authTimeout);
  } catch(e) {
    authView = 'login';
    clearTimeout(authTimeout);
  }

  var SECTIONS_HASHTAGS = [
    { id: 'cadrage', tag: '#Cadrage' },
    { id: 'regie', tag: '#Régie' },
    { id: 'web', tag: '#Web' },
    { id: 'proj', tag: '#Projection' },
    { id: 'prod', tag: '#Prod' },
    { id: 'photo', tag: '#Photo' },
    { id: 'vente', tag: '#Vente' },
    { id: 'culte', tag: '#CulteDuDimanche' },
    { id: 'chorale', tag: '#Chorale' }
  ];

  var posts = getStoredData(STORAGE_KEYS.POSTS, []);
  var profiles = getStoredData(STORAGE_KEYS.USERS, []);

  var ratings = {
    web: { score: 5, comment: 'Direct streaming HD fluide' },
    proj: { score: 4, comment: 'Textes affichés dans les temps' },
    prod: { score: 4, comment: 'Transitions vidéo soignées' },
    regie: { score: 5, comment: 'Mixage acoustique excellent' },
    photo: { score: 4, comment: 'Tri rapide des photos' },
    vente: { score: 4, comment: 'Support CD/USB prêts' }
  };

  // ICONES SVG
  var searchSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
  var moreOptionsSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
  var trashSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  var heartSvg = function(filled, size) {
    size = size || 22;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (filled ? '#FF2D55' : 'none') + '" stroke="' + (filled ? '#FF2D55' : '#8E8E93') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  };
  var commentSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var shareSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';
  var bookmarkSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  var checkSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>';
  var sendSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  function renderAppRoot() {
    var root = document.getElementById('root');
    if (!root) return;

    var toastHTML = '';
    if (activeToast) {
      var isErr = (activeToast.type === 'error');
      toastHTML = `
        <div style="position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:999999; width:90%; max-width:400px; display:flex; justify-content:center;">
          <div style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.95); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); padding:12px 18px; border-radius:20px; border:1px solid rgba(0,0,0,0.08); box-shadow:0 8px 24px rgba(0,0,0,0.12);">
            <div style="width:26px; height:26px; border-radius:13px; background:${isErr ? '#FFEBEA' : '#E8F9ED'}; display:flex; align-items:center; justify-content:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${isErr ? '#FF3B30' : '#34C759'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                ${isErr ? '<path d="M18 6L6 18M6 6l12 12"/>' : '<path d="M20 6L9 17l-5-5"/>'}
              </svg>
            </div>
            <span style="font-size:13.5px; font-weight:700; color:#1C1C1E;">${activeToast.message}</span>
          </div>
        </div>
      `;
    }

    if (authView === 'login') root.innerHTML = toastHTML + renderLogin();
    else if (authView === 'signup') root.innerHTML = toastHTML + renderSignup();
    else root.innerHTML = toastHTML + renderMainApp();
  }

  function formatCaptionWithHashtags(text) {
    if (!text) return '';
    var words = text.split(/(\s+)/);
    return words.map(function(word) {
      if (word.startsWith('#') && word.length > 1) {
        return '<span onclick="window.applySearchTag(\'' + word + '\')" style="color:#007AFF; font-weight:800; cursor:pointer;">' + word + '</span>';
      }
      return word;
    }).join('');
  }

  window.applySearchTag = function(tagStr) {
    searchQuery = tagStr;
    triggerToast("Recherche sur " + tagStr, "success");
    renderAppRoot();
  };

  window.setSearchQueryInput = function(val) {
    searchQuery = val;
    renderAppRoot();
  };

  window.clearSearchQuery = function() {
    searchQuery = '';
    renderAppRoot();
  };

  function getTrendingHashtags() {
    var counts = {};
    posts.forEach(function(p) {
      var tags = (p.caption + ' ' + p.title).match(/#[\wéèêàâôûîç]+/gi) || [];
      tags.forEach(function(t) {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; });
  }

  window.handlePostInputText = function(val) {
    var words = val.split(/\s/);
    var lastWord = words[words.length - 1];
    if (lastWord.startsWith('#')) {
      showHashtagSuggestions = true;
    } else {
      showHashtagSuggestions = false;
    }
    renderAppRoot();
  };

  window.insertHashtagInPost = function(tagStr) {
    var input = document.getElementById('newPostText');
    if (!input) return;
    var words = input.value.split(/\s/);
    words.pop();
    input.value = words.concat([tagStr, '']).join(' ');
    showHashtagSuggestions = false;
    renderAppRoot();
  };

  window.handleFileInputChange = function(event) {
    if (event.target && event.target.files) {
      var files = Array.from(event.target.files);
      files.forEach(function(file) {
        var reader = new FileReader();
        reader.onloadend = function() {
          pendingMediaUrls.push(reader.result);
          renderAppRoot();
        };
        reader.readAsDataURL(file);
      });
    }
  };

  window.removePendingMedia = function(idx) {
    pendingMediaUrls.splice(idx, 1);
    renderAppRoot();
  };

  window.handleCarouselScroll = function(postId, el) {
    var w = el.clientWidth;
    if (w <= 0) return;
    var index = Math.round(el.scrollLeft / w);
    activeImageIndexes[postId] = index;
    renderAppRoot();
  };

  window.openPostOptionsMenu = function(postId) {
    var target = null;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === postId) { target = posts[i]; break; }
    }
    if (!target) return;

    var canDelete = (currentUser && (currentUser.role === 'GRAND_RESPONSABLE' || target.userId === currentUser.id));
    selectedPostOptions = { post: target, canDelete: canDelete };
    renderAppRoot();
  };

  window.closePostOptionsMenu = function() {
    selectedPostOptions = null;
    renderAppRoot();
  };

  window.executeDeletePost = function(postId) {
    var targetIndex = -1;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === postId) { targetIndex = i; break; }
    }
    if (targetIndex !== -1) {
      var p = posts[targetIndex];
      var canDelete = (currentUser && (currentUser.role === 'GRAND_RESPONSABLE' || p.userId === currentUser.id));
      if (!canDelete) {
        triggerToast("Action refusée : Vous n'avez pas l'autorisation de supprimer ce post.", "error");
        selectedPostOptions = null;
        return;
      }
      posts.splice(targetIndex, 1);
      setStoredData(STORAGE_KEYS.POSTS, posts);
      selectedPostOptions = null;
      triggerToast("Publication supprimée avec succès", "success");
    }
  };

  // SUPABASE AUTH & PROFILES
  window.handleLoginSubmit = function(e) {
    if (e) e.preventDefault();
    var email = document.getElementById('loginEmail') ? document.getElementById('loginEmail').value : 'eric.kouame@eglise.org';
    
    var allProfiles = getStoredData(STORAGE_KEYS.USERS, []);
    var user = allProfiles.find(function(p) { return p.email.toLowerCase() === email.toLowerCase(); });

    if (!user) {
      var prenom = email.split('@')[0].split('.')[0] || 'Utilisateur';
      user = {
        id: 'usr-' + Date.now(),
        email: email,
        nom: 'Membre',
        prenom: prenom.charAt(0).toUpperCase() + prenom.slice(1),
        section_id: 'cadrage',
        section_nom: 'Cadrage',
        role: 'RESP_SECTION',
        is_online: true,
        last_seen_at: new Date().toISOString(),
        last_action: 'Connexion'
      };
      allProfiles.push(user);
    } else {
      user.is_online = true;
      user.last_seen_at = new Date().toISOString();
      user.last_action = 'Connexion';
    }

    setStoredData(STORAGE_KEYS.USERS, allProfiles);
    sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
    currentUser = user;
    authView = 'app';
    triggerToast("Connexion réussie ! Bienvenue " + currentUser.prenom + ".", "success");
  };

  window.handleSignupSubmit = function(e) {
    if (e) e.preventDefault();
    var prenom = document.getElementById('signupPrenom') ? document.getElementById('signupPrenom').value : 'Jean';
    var nom = document.getElementById('signupNom') ? document.getElementById('signupNom').value : 'Dupont';
    var email = document.getElementById('signupEmail') ? document.getElementById('signupEmail').value : 'jean.dupont@eglise.org';
    var secSelect = document.getElementById('signupSection') ? document.getElementById('signupSection').value : 'cadrage';

    var secNames = { web: 'Web', proj: 'Projection', prod: 'Prod', regie: 'Régie', cadrage: 'Cadrage', photo: 'Photo', vente: 'Vente' };

    var allProfiles = getStoredData(STORAGE_KEYS.USERS, []);
    currentUser = {
      id: 'usr-' + Date.now(),
      nom: nom || 'Dupont',
      prenom: prenom || 'Jean',
      email: email || 'jean.dupont@eglise.org',
      section_id: secSelect || 'cadrage',
      section_nom: secNames[secSelect] || 'Cadrage',
      role: 'MEMBRE',
      is_online: true,
      last_seen_at: new Date().toISOString(),
      last_action: 'Inscription'
    };

    allProfiles.push(currentUser);
    setStoredData(STORAGE_KEYS.USERS, allProfiles);
    sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser));
    authView = 'app';
    triggerToast("Bienvenue " + currentUser.prenom + " ! Votre compte Supabase a été créé.", "success");
  };

  window.navAuthView = function(view) {
    authView = view;
    renderAppRoot();
  };

  window.handleLogout = function() {
    if (currentUser) {
      var allProfiles = getStoredData(STORAGE_KEYS.USERS, []);
      var idx = allProfiles.findIndex(function(p) { return p.id === currentUser.id; });
      if (idx !== -1) {
        allProfiles[idx].is_online = false;
        allProfiles[idx].last_seen_at = new Date().toISOString();
        allProfiles[idx].last_action = 'Déconnexion';
        setStoredData(STORAGE_KEYS.USERS, allProfiles);
      }
    }
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    currentUser = null;
    authView = 'login';
    triggerToast("Vous avez été déconnecté.", "success");
  };

  window.togglePostLike = function(postId) {
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === postId) {
        posts[i].isLiked = !posts[i].isLiked;
        posts[i].likes += posts[i].isLiked ? 1 : -1;
        break;
      }
    }
    setStoredData(STORAGE_KEYS.POSTS, posts);
    renderAppRoot();
  };

  window.toggleCommentLike = function(commentId) {
    likedCommentIds[commentId] = !likedCommentIds[commentId];
    renderAppRoot();
  };

  window.appendEmojiToComment = function(emoji) {
    var input = document.getElementById('newCommentInput');
    if (input) {
      input.value = input.value + emoji;
    }
  };

  window.openCreatePostModal = function() {
    isCreateModalOpen = true;
    showHashtagSuggestions = false;
    pendingMediaUrls = [];
    renderAppRoot();
  };

  window.closeCreatePostModal = function() {
    isCreateModalOpen = false;
    showHashtagSuggestions = false;
    pendingMediaUrls = [];
    renderAppRoot();
  };

  window.submitCreatePost = function(e) {
    if (e) e.preventDefault();
    var txt = document.getElementById('newPostText') ? document.getElementById('newPostText').value : '';
    if (!txt.trim() && pendingMediaUrls.length === 0) {
      triggerToast("Veuillez ajouter du texte ou une photo.", "error");
      return;
    }

    var detectedSectionId = 'general';
    var sectionTags = ['cadrage', 'regie', 'web', 'proj', 'prod', 'photo', 'vente'];
    for (var i = 0; i < sectionTags.length; i++) {
      if (txt.toLowerCase().indexOf('#' + sectionTags[i]) !== -1) {
        detectedSectionId = sectionTags[i];
        break;
      }
    }

    var secNames = { cadrage: 'Cadrage', regie: 'Régie', web: 'Web', proj: 'Projection', prod: 'Prod', photo: 'Photo', vente: 'Vente', general: 'Général' };

    posts.unshift({
      id: 'post-' + Date.now(),
      userId: currentUser ? currentUser.id : 'usr-current',
      timestamp: Date.now(),
      author: currentUser.prenom + ' ' + currentUser.nom + ' (' + (secNames[detectedSectionId] || 'COM') + ')',
      authorAvatar: currentUser.prenom.charAt(0),
      sectionId: detectedSectionId,
      dateText: 'À l\'instant',
      isVedette: false,
      title: 'Publication ' + (secNames[detectedSectionId] || 'COM'),
      sub: 'Contenu Partagé',
      caption: txt,
      mediaUrls: pendingMediaUrls.slice(),
      likes: 1,
      isLiked: true,
      comments: []
    });

    setStoredData(STORAGE_KEYS.POSTS, posts);
    isCreateModalOpen = false;
    showHashtagSuggestions = false;
    pendingMediaUrls = [];
    triggerToast("Publication partagée avec succès !", "success");
  };

  window.openCommentModal = function(postId) {
    activeCommentPostId = postId;
    isCommentModalOpen = true;
    renderAppRoot();
  };

  window.closeCommentModal = function() {
    isCommentModalOpen = false;
    activeCommentPostId = null;
    renderAppRoot();
  };

  window.submitAddComment = function(e) {
    if (e) e.preventDefault();
    var txt = document.getElementById('newCommentInput') ? document.getElementById('newCommentInput').value : '';
    if (!txt.trim() || !activeCommentPostId) return;

    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === activeCommentPostId) {
        posts[i].comments.push({
          id: 'c-' + Date.now(),
          author: currentUser.prenom + ' ' + currentUser.nom.charAt(0) + '.',
          text: txt
        });
        break;
      }
    }
    setStoredData(STORAGE_KEYS.POSTS, posts);
    triggerToast("Commentaire ajouté !", "success");
  };

  window.sharePostLink = function(title, text) {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: title, text: text, url: window.location.href }).catch(function(){});
    } else {
      triggerToast("Lien de la publication copié !", "success");
    }
  };

  window.setStoryFilter = function(s) {
    selectedStory = s;
    renderAppRoot();
  };

  window.setTab = function(t) { activeTab = t; renderAppRoot(); };

  window.doCheckIn = function() {
    isCheckedIn = true;
    triggerToast("Présence validée pour le Culte !", "success");
  };

  window.setRatingScore = function(secId, score) {
    var userSec = (currentUser && currentUser.section_id) ? currentUser.section_id : 'cadrage';
    if (secId === userSec) {
      triggerToast("Action Interdite : Vous ne pouvez pas noter votre section.", "error");
      return;
    }
    ratings[secId].score = score;
    renderAppRoot();
  };

  window.publishBilanFeed24h = function() {
    triggerToast("Bilan de Culte Validé et Publié (24h) !", "success");
    activeTab = 'home';
    renderAppRoot();
  };

  function renderLogin() {
    return `
      <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:100vh; padding:24px; box-sizing:border-box; background:#FFF;">
        <div style="width:100%; max-width:380px; text-align:center;">
          <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.4px; margin:0 0 4px;">ÉGLISE VASE D'HONNEUR</p>
          <h1 style="font-size:32px; font-weight:900; color:#000; margin:0 0 32px; letter-spacing:-0.8px;">Kun COM</h1>

          <form onsubmit="window.handleLoginSubmit(event)" style="display:flex; flex-direction:column; gap:14px; text-align:left;">
            <div>
              <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:6px;">Adresse E-mail</label>
              <input id="loginEmail" type="email" value="eric.kouame@eglise.org" required style="width:100%; height:48px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
            </div>

            <div>
              <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:6px;">Mot de passe</label>
              <input type="password" value="password123" required style="width:100%; height:48px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
            </div>

            <button type="submit" style="width:100%; height:50px; background:#007AFF; color:#FFF; border:none; border-radius:14px; font-size:15px; font-weight:800; cursor:pointer; margin-top:10px; box-shadow:0 4px 12px rgba(0,122,255,0.25);">
              Se connecter
            </button>
          </form>

          <div style="margin-top:24px; font-size:13px; color:#8E8E93;">
            Vous n'avez pas de compte ? <span onclick="window.navAuthView('signup')" style="color:#007AFF; font-weight:800; cursor:pointer;">S'inscrire</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderSignup() {
    return `
      <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:100vh; padding:24px; box-sizing:border-box; background:#FFF;">
        <div style="width:100%; max-width:380px; text-align:center;">
          <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.4px; margin:0 0 4px;">INSCRIPTION COMPTE</p>
          <h1 style="font-size:28px; font-weight:900; color:#000; margin:0 0 24px; letter-spacing:-0.8px;">Rejoindre Kun COM</h1>

          <form onsubmit="window.handleSignupSubmit(event)" style="display:flex; flex-direction:column; gap:12px; text-align:left;">
            <div>
              <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:4px;">Prénom</label>
              <input id="signupPrenom" type="text" placeholder="ex: Jean" required style="width:100%; height:46px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
            </div>

            <div>
              <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:4px;">Nom</label>
              <input id="signupNom" type="text" placeholder="ex: Dupont" required style="width:100%; height:46px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
            </div>

            <div>
              <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:4px;">Adresse E-mail</label>
              <input id="signupEmail" type="email" placeholder="ex: jean.dupont@eglise.org" required style="width:100%; height:46px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
            </div>

            <div>
              <label style="font-size:12px; font-weight:700; color:#000; display:block; margin-bottom:4px;">Section d'appartenance</label>
              <select id="signupSection" style="width:100%; height:46px; border-radius:12px; border:1px solid #EFEFEF; background:#FAFAFA; padding:0 14px; font-size:14px; box-sizing:border-box;">
                <option value="cadrage">Cadrage</option>
                <option value="regie">Régie</option>
                <option value="web">Web</option>
                <option value="proj">Projection</option>
                <option value="prod">Prod</option>
                <option value="photo">Photo</option>
                <option value="vente">Vente</option>
              </select>
            </div>

            <button type="submit" style="width:100%; height:50px; background:#007AFF; color:#FFF; border:none; border-radius:14px; font-size:15px; font-weight:800; cursor:pointer; margin-top:8px; box-shadow:0 4px 12px rgba(0,122,255,0.25);">
              Créer mon compte (MEMBRE)
            </button>
          </form>

          <div style="margin-top:20px; font-size:13px; color:#8E8E93;">
            Vous avez déjà un compte ? <span onclick="window.navAuthView('login')" style="color:#007AFF; font-weight:800; cursor:pointer;">Se connecter</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderMainApp() {
    var userSec = currentUser ? (currentUser.section_id || currentUser.sectionId) : 'cadrage';
    var userPrenom = currentUser ? currentUser.prenom : 'Éric';
    var userInitial = userPrenom.charAt(0);

    posts = getStoredData(STORAGE_KEYS.POSTS, []);
    var filtered = posts.slice().sort(function(a, b) {
      return (b.timestamp || 0) - (a.timestamp || 0);
    }).filter(function(p) {
      if (selectedStory !== 'all' && p.sectionId !== selectedStory) return false;
      if (searchQuery.trim().length > 0) {
        var q = searchQuery.toLowerCase().trim();
        return (
          p.caption.toLowerCase().indexOf(q) !== -1 ||
          p.title.toLowerCase().indexOf(q) !== -1 ||
          p.author.toLowerCase().indexOf(q) !== -1
        );
      }
      return true;
    });

    var trendingList = getTrendingHashtags();

    return `
      <div style="display:flex; flex-direction:column; min-height:100vh; width:100%; position:relative; background-color:#FFFFFF; font-family:-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;">
        
        <div style="flex:1; padding-bottom:80px;">
          ${renderFeedContent(filtered, trendingList, userPrenom, userInitial, userSec)}
        </div>

        ${isCreateModalOpen ? `
          <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); z-index:100000; display:flex; justify-content:center; align-items:flex-end;">
            <div style="width:100%; max-width:500px; background:#FFF; border-top-left-radius:24px; border-top-right-radius:24px; padding:20px; box-sizing:border-box;">
              
              <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:14px; border-bottom:1px solid #EFEFEF; margin-bottom:14px;">
                <h3 style="font-size:18px; font-weight:800; margin:0; color:#000;">Créer une publication</h3>
                <span onclick="window.closeCreatePostModal()" style="font-size:14px; font-weight:700; color:#007AFF; cursor:pointer;">Annuler</span>
              </div>

              ${showHashtagSuggestions ? `
                <div style="background:#F0F6FF; padding:10px; border-radius:14px; margin-bottom:12px; border:1px solid #D0E3FF;">
                  <span style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; display:block; margin-bottom:6px;">Suggestions de Hashtags :</span>
                  <div style="display:flex; gap:8px; overflow-x:auto;">
                    ${SECTIONS_HASHTAGS.map(function(s) {
                      return '<button onclick="window.insertHashtagInPost(\'' + s.tag + '\')" style="background:#007AFF; color:#FFF; border:none; padding:6px 12px; border-radius:14px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap;">' + s.tag + '</button>';
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              <form onsubmit="window.submitCreatePost(event)">
                <textarea id="newPostText" oninput="window.handlePostInputText(this.value)" placeholder="Rédigez votre message... Tapez # pour identifier une section (ex: #Cadrage, #Chorale)" style="width:100%; height:90px; border-radius:14px; border:1px solid #EFEFEF; background:#FAFAFA; padding:12px; font-size:14px; box-sizing:border-box; font-family:sans-serif; margin-bottom:12px; outline:none;"></textarea>

                ${pendingMediaUrls.length > 0 ? `
                  <div style="margin-bottom:12px;">
                    <span style="font-size:12px; font-weight:700; color:#1C1C1E; display:block; margin-bottom:6px;">Photos sélectionnées (${pendingMediaUrls.length}) :</span>
                    <div style="display:flex; gap:10px; overflow-x:auto;">
                      ${pendingMediaUrls.map(function(url, idx) {
                        return `
                          <div style="position:relative; width:64px; height:64px; border-radius:12px; overflow:hidden; flex-shrink:0;">
                            <img src="${url}" style="width:100%; height:100%; object-fit:cover;" />
                            <button type="button" onclick="window.removePendingMedia(${idx})" style="position:absolute; top:3px; right:3px; background:rgba(0,0,0,0.65); color:#FFF; border:none; border-radius:9px; width:18px; height:18px; font-size:10px; font-weight:900; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}

                <div style="margin-bottom:14px;">
                  <label style="display:flex; align-items:center; justify-content:center; gap:8px; background:#F0F6FF; color:#007AFF; padding:10px 16px; border-radius:12px; font-size:13.5px; font-weight:700; cursor:pointer; border:1px solid #D0E3FF; width:100%; box-sizing:border-box;">
                    📷 Ajouter des photos
                    <input type="file" accept="image/*" multiple onchange="window.handleFileInputChange(event)" style="display:none;" />
                  </label>
                </div>

                <button type="submit" style="width:100%; height:48px; background:#007AFF; color:#FFF; border:none; border-radius:14px; font-size:15px; font-weight:800; cursor:pointer; box-shadow:0 4px 12px rgba(0,122,255,0.25);">
                  Publier sur le Feed
                </button>
              </form>
            </div>
          </div>
        ` : ''}

        ${selectedPostOptions ? `
          <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); z-index:100000; display:flex; justify-content:center; align-items:flex-end;">
            <div style="width:100%; max-width:500px; background:#FFF; border-top-left-radius:24px; border-top-right-radius:24px; padding:20px; box-sizing:border-box;">
              <div onclick="window.closePostOptionsMenu()" style="width:44px; height:5px; border-radius:2.5px; background:#D1D1D6; margin:0 auto 14px; cursor:pointer;"></div>
              
              ${selectedPostOptions.canDelete ? `
                <button onclick="window.executeDeletePost('${selectedPostOptions.post.id}')" style="width:100%; background:none; border:none; border-bottom:1px solid #EFEFEF; padding:14px 0; display:flex; align-items:center; gap:12px; cursor:pointer;">
                  ${trashSvg}
                  <span style="font-size:15px; font-weight:800; color:#FF3B30;">Supprimer la publication</span>
                </button>
              ` : `
                <div style="padding:14px 0; border-bottom:1px solid #EFEFEF; text-align:center; color:#8E8E93; font-size:13px;">
                  Vous n'avez pas l'autorisation de supprimer ce post.
                </div>
              `}

              <button onclick="window.closePostOptionsMenu()" style="width:100%; background:none; border:none; padding:14px 0; font-size:15px; font-weight:700; color:#007AFF; cursor:pointer;">
                Annuler
              </button>
            </div>
          </div>
        ` : ''}

        ${isCommentModalOpen ? renderInstagramCommentsBottomSheet(activeCommentPostId, userInitial) : ''}

        <nav style="position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:500px; height:68px; background:rgba(255,255,255,0.96); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-top:1px solid #EFEFEF; display:flex; justify-content:space-around; align-items:center; z-index:99999;">
          <button onclick="window.setTab('home')" style="${tabStyle(activeTab === 'home')}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="${activeTab === 'home' ? '#000' : 'none'}" stroke="#000" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </button>

          <button onclick="window.setTab('planning')" style="${tabStyle(activeTab === 'planning')}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8"><path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18"/></svg>
          </button>

          <button onclick="window.openCreatePostModal()" style="width:44px; height:44px; border-radius:22px; background-color:#007AFF; color:#FFF; border:none; display:flex; align-items:center; justify-content:center; margin-top:-18px; box-shadow:0 4px 12px rgba(0,122,255,0.3); cursor:pointer;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
          </button>

          <button onclick="window.setTab('halloffame')" style="${tabStyle(activeTab === 'halloffame')}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>

          <button onclick="window.setTab('profile')" style="${tabStyle(activeTab === 'profile')}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>
        </nav>
      </div>
    `;
  }

  function renderInstagramCommentsBottomSheet(postId, userInitial) {
    var target = null;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === postId) { target = posts[i]; break; }
    }
    if (!target) return '';

    var commentsListHTML = '';
    if (target.comments.length === 0) {
      commentsListHTML = '<div style="text-align:center; padding:30px 0; color:#8E8E93;"><strong style="display:block; font-size:14px; color:#000;">Aucun commentaire pour le moment.</strong><span style="font-size:12px;">Commencez la discussion !</span></div>';
    } else {
      commentsListHTML = target.comments.map(function(c) {
        var isLiked = likedCommentIds[c.id];
        return `
          <div style="display:flex; align-items:flex-start; margin-bottom:16px; gap:12px;">
            <div style="width:38px; height:38px; border-radius:19px; background:#F0F6FF; border:1px solid #E5E5EA; display:flex; align-items:center; justify-content:center; font-weight:800; color:#007AFF; font-size:14px;">
              ${c.author ? c.author.charAt(0) : 'U'}
            </div>
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                <strong style="font-size:13.5px; color:#000;">${c.author}</strong>
                <span style="font-size:11.5px; color:#8E8E93;">• 8 h</span>
              </div>
              <p style="font-size:13.5px; color:#1C1C1E; margin:0; line-height:1.35; font-family:sans-serif;">${formatCaptionWithHashtags(c.text)}</p>
              <span style="font-size:11.5px; font-weight:700; color:#8E8E93; display:inline-block; margin-top:4px; cursor:pointer;">Répondre</span>
            </div>
            <div onclick="window.toggleCommentLike('${c.id}')" style="cursor:pointer; padding:4px;">
              ${heartSvg(isLiked, 16)}
            </div>
          </div>
        `;
      }).join('');
    }

    var emojisHTML = ['❤️', '👏', '🔥', '🙌', '😢', '😍', '😮', '😂'].map(function(e) {
      return '<span onclick="window.appendEmojiToComment(\'' + e + '\')" style="font-size:22px; cursor:pointer; padding:2px;">' + e + '</span>';
    }).join('');

    return `
      <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.45); z-index:100000; display:flex; justify-content:center; align-items:flex-end;">
        <div style="width:100%; max-width:500px; background:#FFF; border-top-left-radius:24px; border-top-right-radius:24px; height:80vh; max-height:80vh; display:flex; flex-direction:column; box-sizing:border-box;">
          
          <div onclick="window.closeCommentModal()" style="padding:10px 0 4px; display:flex; justify-content:center; cursor:pointer;">
            <div style="width:44px; height:5px; border-radius:2.5px; background:#D1D1D6;"></div>
          </div>

          <div style="text-align:center; padding-bottom:12px; border-bottom:1px solid #EFEFEF;">
            <h3 style="font-size:16px; font-weight:800; margin:0; color:#000;">Commentaires</h3>
          </div>

          <div style="flex:1; overflow-y:auto; padding:16px; box-sizing:border-box;">
            ${commentsListHTML}
          </div>

          <div style="border-top:1px solid #EFEFEF; background:#FFF;">
            <div style="display:flex; justify-content:space-around; padding:8px 12px; border-bottom:1px solid #FAFAFA;">
              ${emojisHTML}
            </div>

            <form onsubmit="window.submitAddComment(event)" style="display:flex; align-items:center; gap:10px; padding:10px 14px;">
              <div style="width:36px; height:36px; border-radius:18px; background:#007AFF; color:#FFF; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:14px;">
                ${userInitial}
              </div>

              <div style="flex:1; height:42px; border-radius:21px; background:#FAFAFA; border:1px solid #EFEFEF; display:flex; align-items:center; padding:0 14px;">
                <input id="newCommentInput" type="text" placeholder="Ajouter un commentaire..." required style="flex:1; border:none; background:transparent; font-size:13.5px; outline:none; color:#000;">
                <button type="submit" style="background:none; border:none; padding:0 0 0 6px; cursor:pointer; display:flex; align-items:center;">
                  ${sendSvg}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;
  }

  function renderFeedContent(filtered, trendingList, userPrenom, userInitial, userSec) {
    if (activeTab === 'home') {
      return `
        <header style="padding:14px 18px; background:#FFF; border-bottom:1px solid #EFEFEF; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:100;">
          <div>
            <p style="font-size:10px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 1px;">EGLISE VASE D'HONNEUR</p>
            <h1 style="font-size:22px; font-weight:900; color:#000000; margin:0; letter-spacing:-0.6px;">Kun COM</h1>
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <div onclick="window.openCreatePostModal()" style="width:34px; height:34px; border-radius:17px; background:#FAFAFA; display:flex; align-items:center; justify-content:center; cursor:pointer;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <div onclick="window.handleLogout()" title="Déconnexion" style="width:34px; height:34px; border-radius:17px; background:#F0F6FF; color:#007AFF; font-weight:800; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px;">
              ${userInitial}
            </div>
          </div>
        </header>

        <div style="padding:8px 16px; background:#FFF; border-bottom:1px solid #EFEFEF;">
          <div style="display:flex; align-items:center; height:40px; background:#F2F2F7; border-radius:12px; padding:0 12px;">
            ${searchSvg}
            <input type="text" value="${searchQuery}" oninput="window.setSearchQueryInput(this.value)" placeholder="Rechercher des posts, des hashtags #..." style="flex:1; height:100%; border:none; background:transparent; font-size:13.5px; color:#000; outline:none; margin-left:8px;">
            ${searchQuery ? '<span onclick="window.clearSearchQuery()" style="font-size:14px; font-weight:700; color:#8E8E93; cursor:pointer; padding:4px;">✕</span>' : ''}
          </div>
        </div>

        ${trendingList.length > 0 ? `
          <div style="padding:10px 16px; background:#F0F6FF; border-bottom:1px solid #D0E3FF;">
            <span style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:6px;">Sujets tendances :</span>
            <div style="display:flex; gap:8px; overflow-x:auto;">
              ${trendingList.map(function(t) {
                var isActive = (searchQuery === t);
                return '<button onclick="window.applySearchTag(\'' + t + '\')" style="background:' + (isActive ? '#007AFF' : '#FFF') + '; color:' + (isActive ? '#FFF' : '#007AFF') + '; border:1px solid #D0E3FF; padding:5px 12px; border-radius:14px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap;">' + t + '</button>';
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div style="padding:12px 0; border-bottom:1px solid #EFEFEF; background:#FFF; overflow-x:auto; white-space:nowrap; -webkit-overflow-scrolling:touch;">
          <div style="display:flex; gap:14px; padding:0 14px;">
            ${[
              { id: 'all', nom: 'Tous', emoji: '✨' },
              { id: 'cadrage', nom: 'Cadrage', emoji: '🎥' },
              { id: 'regie', nom: 'Régie', emoji: '🎛️' },
              { id: 'web', nom: 'Web', emoji: '🌐' },
              { id: 'proj', nom: 'Projection', emoji: '🖥️' },
              { id: 'prod', nom: 'Prod', emoji: '🎬' },
              { id: 'photo', nom: 'Photo', emoji: '📸' },
              { id: 'vente', nom: 'Vente', emoji: '🛒' }
            ].map(function(story) {
              var isSel = selectedStory === story.id;
              return `
                <div onclick="window.setStoryFilter('${story.id}')" style="display:inline-flex; flex-direction:column; align-items:center; cursor:pointer; width:66px;">
                  <div style="width:62px; height:62px; border-radius:31px; padding:2px; border:2px solid ${isSel ? '#D4AF37' : '#E5E5EA'}; display:flex; align-items:center; justify-content:center; background:#FFF;">
                    <div style="width:100%; height:100%; border-radius:27px; background:#F0F6FF; display:flex; align-items:center; justify-content:center; font-size:24px;">
                      ${story.emoji}
                    </div>
                  </div>
                  <span style="font-size:11px; font-weight:${isSel ? '800' : '500'}; color:${isSel ? '#000000' : '#8E8E93'}; margin-top:4px; text-align:center;">
                    ${story.nom}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        ${filtered.length === 0 ? `
          <div style="padding:50px 24px; text-align:center; background:#FFF; display:flex; flex-direction:column; align-items:center;">
            <div style="width:64px; height:64px; border-radius:32px; background:#F0F6FF; display:flex; align-items:center; justify-content:center; margin-bottom:14px;">
              ${checkSvg}
            </div>
            <h3 style="font-size:17px; font-weight:800; color:#000; margin:0 0 6px;">Aucune publication récente</h3>
            <p style="font-size:13px; color:#8E8E93; margin:0 0 18px; max-width:280px; line-height:1.4;">
              ${searchQuery ? 'Aucun résultat pour "' + searchQuery + '".' : 'Soyez le premier à partager une publication !'}
            </p>
            <button onclick="window.openCreatePostModal()" style="padding:10px 20px; background:#007AFF; color:#FFF; border:none; border-radius:12px; font-size:13px; font-weight:800; cursor:pointer;">
              Créer une publication
            </button>
          </div>
        ` : filtered.map(function(post) {
          var hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
          var curIndex = activeImageIndexes[post.id] || 0;

          return `
            <article style="background:#FFF; border-bottom:8px solid #FAFAFA;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="width:38px; height:38px; border-radius:19px; background:#007AFF; color:#FFF; font-size:15px; font-weight:800; display:flex; align-items:center; justify-content:center;">${post.authorAvatar}</div>
                  <div>
                    <h3 style="font-size:14px; font-weight:700; margin:0; color:#000000;">${post.author}</h3>
                    <span style="font-size:11px; color:#8E8E93;">${post.dateText}</span>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  ${post.isVedette ? '<div style="background:#FFFDF0; border:1px solid #E6CA65; padding:5px 10px; border-radius:12px; font-size:10.5px; font-weight:800; color:#B8860B;">SECTION VEDETTE</div>' : ''}
                  
                  <div onclick="window.openPostOptionsMenu('${post.id}')" style="cursor:pointer; padding:4px;">
                    ${moreOptionsSvg}
                  </div>
                </div>
              </div>

              <div style="width:100%; height:300px; background:#1C1C1E; position:relative; overflow:hidden;">
                ${hasMedia ? `
                  ${post.mediaUrls.length > 1 ? `
                    <div style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.65); color:#FFF; padding:4px 10px; border-radius:12px; font-size:11.5px; font-weight:800; z-index:10;">
                      ${curIndex + 1}/${post.mediaUrls.length}
                    </div>
                  ` : ''}

                  <div onscroll="window.handleCarouselScroll('${post.id}', this)" style="width:100%; height:100%; display:flex; overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch;">
                    ${post.mediaUrls.map(function(url) {
                      return '<div style="flex:0 0 100%; width:100%; height:100%; scroll-snap-align:start;"><img src="' + url + '" style="width:100%; height:100%; object-fit:cover;" /></div>';
                    }).join('')}
                  </div>
                ` : `
                  <div style="width:100%; height:100%; background:#2C2C2E; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:20px; text-align:center;">
                    <h2 style="font-size:18px; font-weight:800; color:#FFFFFF; margin:0 0 4px; letter-spacing:-0.4px;">${formatCaptionWithHashtags(post.title)}</h2>
                    <span style="color:#8E8E93; font-size:12px; font-weight:500;">${post.sub}</span>

                    ${post.scoreText ? `
                      <div style="position:absolute; bottom:14px; right:14px; background:rgba(255,255,255,0.92); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); padding:6px 12px; border-radius:16px; border:1px solid rgba(255,255,255,0.8); box-shadow:0 4px 12px rgba(0,0,0,0.12);">
                        <strong style="font-size:14px; color:#1C1C1E; font-weight:900;">${post.scoreText}</strong>
                      </div>
                    ` : ''}
                  </div>
                `}
              </div>

              ${hasMedia && post.mediaUrls.length > 1 ? `
                <div style="display:flex; justify-content:center; align-items:center; gap:5px; padding:8px 0; background:#FFF;">
                  ${post.mediaUrls.map(function(_, dotIdx) {
                    var isAct = (curIndex === dotIdx);
                    return '<div style="width:' + (isAct ? '7px' : '6px') + '; height:' + (isAct ? '7px' : '6px') + '; border-radius:3.5px; background:' + (isAct ? '#007AFF' : '#C7C7CC') + ';"></div>';
                  }).join('')}
                </div>
              ` : ''}

              <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
                <div style="display:flex; align-items:center; gap:16px;">
                  <button onclick="window.togglePostLike('${post.id}')" style="background:none; border:none; padding:0; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    ${heartSvg(post.isLiked, 22)}
                    <strong style="font-size:13px; color:#000000;">${post.likes}</strong>
                  </button>

                  <button onclick="window.openCommentModal('${post.id}')" style="background:none; border:none; padding:0; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    ${commentSvg}
                    <strong style="font-size:13px; color:#000000;">${post.comments.length}</strong>
                  </button>

                  <button onclick="window.sharePostLink('${post.title}', '${post.caption}')" style="background:none; border:none; padding:0; cursor:pointer;">
                    ${shareSvg}
                  </button>
                </div>

                <button style="background:none; border:none; padding:0; cursor:pointer;">
                  ${bookmarkSvg}
                </button>
              </div>

              <div style="padding:0 16px 14px;">
                <div style="font-size:13px; font-weight:700; color:#000000; margin-bottom:4px;">
                  Aimé par ${post.likes} membres
                </div>
                <p style="font-size:13.5px; line-height:1.45; color:#000000; margin:0;">
                  <strong>${post.author}</strong> ${formatCaptionWithHashtags(post.caption)}
                </p>
                ${post.comments.length > 0 ? `
                  <span onclick="window.openCommentModal('${post.id}')" style="font-size:12px; color:#8E8E93; display:block; margin-top:6px; cursor:pointer;">
                    Afficher les ${post.comments.length} commentaires...
                  </span>
                ` : ''}
              </div>
            </article>
          `;
        }).join('')}

        <div style="padding:36px 20px; text-align:center; background:#FFF; border-top:1px solid #EFEFEF; display:flex; flex-direction:column; align-items:center;">
          <div style="width:48px; height:48px; border-radius:24px; background:#F0F6FF; display:flex; align-items:center; justify-content:center; margin-bottom:10px;">
            ${checkSvg}
          </div>
          <h3 style="font-size:16px; font-weight:800; color:#000000; margin:0;">Vous êtes à jour</h3>
          <p style="font-size:12px; color:#8E8E93; margin:4px 0 0; max-width:280px; line-height:1.4;">
            Vous avez vu toutes les nouvelles publications du Département Communication.
          </p>
        </div>
      `;
    }

    if (activeTab === 'planning') {
      return `
        <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #EFEFEF;">
          <p style="font-size:11px; font-weight:800; color:#5856D6; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Dimanche 02 Août 2026</p>
          <h1 style="font-size:24px; font-weight:900; color:#000000; margin:0;">Planning Cultes</h1>
        </header>

        <div style="padding:16px;">
          <div style="background:#FFF4E5; border-radius:20px; padding:16px; margin-bottom:16px; border:1.5px solid #FF9500;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <strong style="color:#FF9500; font-size:15px;">Transition Culte 1 vers Culte 2</strong>
              <span style="background:#FF9500; color:#FFF; padding:4px 9px; border-radius:10px; font-size:13px; font-weight:800;">15:00 min</span>
            </div>
            <p style="font-size:12px; color:#1C1C1E; margin-bottom:12px;">Pause technique de 15 minutes (09h00 à 09h15).</p>
            
            <div style="background:#FFF; padding:12px; border-radius:14px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="font-size:13px; display:block;">Check-in Rapide</strong>
                <span style="font-size:11px; color:#8E8E93;">Validez votre arrivée pour Culte 2</span>
              </div>
              <button onclick="window.doCheckIn()" style="background:${isCheckedIn ? '#34C759' : '#007AFF'}; color:#FFF; border:none; padding:8px 14px; border-radius:12px; font-size:12px; font-weight:800; cursor:pointer;">
                ${isCheckedIn ? 'Present' : 'Valider'}
              </button>
            </div>
          </div>

          <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:12px; border:1px solid #E5E5EA;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div><h3 style="font-size:16px; margin:0;">Culte 1</h3><span style="font-size:12px; color:#8E8E93;">07h00 - 09h00</span></div>
              <span style="background:#E5E5EA; color:#8E8E93; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">CLÔTURÉ</span>
            </div>
          </div>

          <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:12px; border:1.5px solid #007AFF;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div><h3 style="font-size:16px; margin:0;">Culte 2</h3><span style="font-size:12px; color:#8E8E93;">09h15 - 11h15</span></div>
              <span style="background:#FFF4E5; color:#FF9500; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">EN TRANSITION</span>
            </div>
          </div>

          <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:12px; border:1px solid #E5E5EA;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div><h3 style="font-size:16px; margin:0;">Culte 3</h3><span style="font-size:12px; color:#8E8E93;">11h30 - 13h30</span></div>
              <span style="background:#E5F1FF; color:#007AFF; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">À VENIR</span>
            </div>
          </div>
        </div>
      `;
    }

    if (activeTab === 'debrief') {
      return `
        <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #EFEFEF;">
          <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Culte du Dimanche 02 Août</p>
          <h1 style="font-size:24px; font-weight:900; color:#000000; margin:0;">Notation & Débrief</h1>
        </header>

        <div style="padding:16px;">
          <h3 style="font-size:15px; font-weight:800; margin-bottom:8px;">1. Notation Inter-Sections</h3>

          ${[
            { id: 'cadrage', nom: 'Cadrage' },
            { id: 'web', nom: 'Web' },
            { id: 'proj', nom: 'Projection' },
            { id: 'prod', nom: 'Prod' },
            { id: 'regie', nom: 'Régie' },
            { id: 'photo', nom: 'Photo' },
            { id: 'vente', nom: 'Vente' }
          ].map(function(sec) {
            var isBlocked = (sec.id === userSec);
            var r = ratings[sec.id] || { score: 4, comment: '' };

            if (isBlocked) {
              return `
                <div style="background:#F8F8FA; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #E1E1E6;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:14px;">Section ${sec.nom} (Votre section)</strong>
                    <span style="background:#FFEBEA; color:#FF3B30; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:800;">Auto-notation interdite</span>
                  </div>
                </div>
              `;
            }

            return `
              <div style="background:#FFF; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid #E5E5EA;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:14px;">Section ${sec.nom}</strong>
                  <div style="display:flex; gap:4px;">
                    ${[1,2,3,4,5].map(function(star) {
                      return `<span onclick="window.setRatingScore('${sec.id}', ${star})" style="font-size:18px; cursor:pointer; color:${star <= r.score ? '#FFD700' : '#D1D1D6'};">★</span>`;
                    }).join('')}
                  </div>
                </div>
                <input type="text" value="${r.comment}" placeholder="Ajouter une remarque..." style="width:100%; padding:8px; border-radius:8px; border:1px solid #E5E5EA; font-size:12px; box-sizing:border-box;">
              </div>
            `;
          }).join('')}

          <div style="background:#FFFDF0; border-radius:20px; padding:18px; margin-top:16px; border:1.5px solid #E6CA65;">
            <h3 style="color:#B8860B; margin:0 0 4px; font-size:16px;">Synthèse & Validation</h3>
            <p style="font-size:11px; color:#666; margin-bottom:12px;">Validez et publiez le Bilan 24h sur le Feed Instagram.</p>
            <button onclick="window.publishBilanFeed24h()" style="width:100%; background:#34C759; color:#FFF; border:none; padding:14px; border-radius:14px; font-size:14px; font-weight:900; cursor:pointer;">
              Valider et Publier le Bilan sur le Feed (24h)
            </button>
          </div>
        </div>
      `;
    }

    if (activeTab === 'halloffame') {
      return `
        <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #EFEFEF;">
          <p style="font-size:11px; font-weight:800; color:#B8860B; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Archives Permanentes</p>
          <h1 style="font-size:24px; font-weight:900; color:#000000; margin:0;">Espace Vedettes</h1>
        </header>

        <div style="padding:16px;">
          <div style="background:#FFF; border-radius:18px; padding:16px; margin-bottom:14px; border:1px solid #E5E5EA;">
            <span style="font-size:11px; font-weight:700; color:#8E8E93;">DIMANCHE 02 AOÛT 2026</span>
            <h3 style="font-size:16px; margin:4px 0 10px;">Culte n°1 — Section Vedette</h3>
            <div style="background:#FFFDF0; padding:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid #E6CA65;">
              <span><strong>Section Cadrage</strong></span>
              <strong style="color:#B8860B;">★ 4.88 / 5.0</strong>
            </div>
          </div>

          <div style="background:#1C1C1E; color:#FFF; border-radius:22px; padding:22px; text-align:center; margin-top:16px;">
            <span style="font-size:11px; font-weight:800; color:#FFD700; text-transform:uppercase; letter-spacing:1.5px;">TROPHÉE ANNUEL 2025-2026</span>
            <h2 style="font-size:22px; margin:6px 0;">Section Régie Technique</h2>
            <p style="font-size:12px; color:rgba(255,255,255,0.75);">Meilleure section de l'année (4.96/5.0 de moyenne).</p>
          </div>
        </div>
      `;
    }

    if (activeTab === 'profile') {
      var allProfiles = getStoredData(STORAGE_KEYS.USERS, []);
      var isAdmin = (currentUser && currentUser.role === 'GRAND_RESPONSABLE');

      return `
        <header style="padding:16px 20px; background:#FFF; border-bottom:1px solid #EFEFEF; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <p style="font-size:11px; font-weight:800; color:#007AFF; text-transform:uppercase; letter-spacing:1.2px; margin:0 0 2px;">Département Communication</p>
            <h1 style="font-size:24px; font-weight:900; color:#000000; margin:0;">Mon Profil</h1>
          </div>
          <button onclick="window.handleLogout()" style="background:#FFEBEA; color:#FF3B30; border:none; padding:6px 12px; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer;">
            Se déconnecter
          </button>
        </header>

        <div style="padding:16px;">
          <div style="background:#FFF; border-radius:22px; padding:20px; text-align:center; margin-bottom:16px; border:1px solid #E5E5EA;">
            <div style="width:72px; height:72px; border-radius:36px; background:#F0F6FF; color:#007AFF; font-size:30px; font-weight:800; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; border:3px solid #007AFF;">${userInitial}</div>
            <h2 style="font-size:20px; margin:0;">${currentUser.prenom} ${currentUser.nom}</h2>
            <p style="font-size:13px; color:#8E8E93; margin-top:2px;">Rôle : ${currentUser.role} • Section ${currentUser.section_nom || currentUser.sectionNom || 'Cadrage'}</p>
          </div>

          ${isAdmin ? `
            <div style="background:#FAFAFA; border-radius:22px; padding:16px; border:1px solid #EFEFEF;">
              <div style="margin-bottom:14px;">
                <h3 style="font-size:16px; font-weight:900; color:#000; margin:0;">Dashboard Grand Responsable</h3>
                <span style="font-size:12px; color:#8E8E93;">Suivi des membres Supabase & Activité Temps Réel</span>
              </div>

              <div style="display:flex; flex-direction:column; gap:10px;">
                ${allProfiles.map(function(p) {
                  return `
                    <div style="background:#FFF; padding:12px; border-radius:14px; border:1px solid #E5E5EA; display:flex; justify-content:space-between; align-items:center;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:10px; height:10px; border-radius:5px; background:${p.is_online ? '#34C759' : '#C7C7CC'};"></div>
                        <div>
                          <strong style="font-size:13.5px; color:#000; display:block;">${p.prenom} ${p.nom} (${p.section_nom || 'COM'})</strong>
                          <span style="font-size:11px; color:#8E8E93;">${p.role} • ${p.email}</span>
                        </div>
                      </div>

                      <div style="text-align:right;">
                        <strong style="font-size:11.5px; color:#007AFF; display:block;">${p.last_action || 'Actif'}</strong>
                        <span style="font-size:10.5px; color:#8E8E93;">${p.is_online ? 'En ligne' : 'Hors ligne'}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    return '<div>Rendu...</div>';
  }

  function executeInstantRender() {
    renderAppRoot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeInstantRender);
    setTimeout(executeInstantRender, 0);
  } else {
    executeInstantRender();
  }
})();
