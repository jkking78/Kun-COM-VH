// ==============================================================================
// KUN COM VH — RÉSEAU SOCIAL PWA
// Version 3.1 — Profils enrichis : identité, section, rôle, statut, activité
// Tous bugs corrigés — Zéro alert() — Toast non-bloquant — Scroll préservé
// ==============================================================================

(function() {
  'use strict';
  console.log('🚀 Kun COM VH v3.0 — Démarrage...');

  // ============================================================
  // STOCKAGE
  // ============================================================
  var SK = {
    USERS: 'kc_profiles',
    POSTS: 'kc_posts',
    SESS: 'kc_user',
    SAVED: 'kc_saved',
    LIKED_COMMENTS: 'kc_liked_comments'
  };

  var DB_CACHE = {};

  // ============================================================
  // SUPABASE REALTIME CLIENT
  // ============================================================
  var SUPABASE_URL = 'https://yugkryhikrfsxbuyxacl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_CMnVxHYsKJIP51J0zDRX6w_hdLgiHR7';
  var supabase = null;
  try {
    supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  } catch(e) {
    console.error("Supabase init error:", e);
  }

  async function syncSupabaseToLocal() {
    if (!supabase) return;
    try {
      // Fetch posts
      var res = await supabase.from('kun_com_posts').select('*');
      if (res && res.data && res.data.length > 0) {
        var mergedPosts = res.data.map(function(p) { return p.content; });
        mergedPosts.sort(function(a,b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
        DB_CACHE[SK.POSTS] = mergedPosts;
        localStorage.setItem(SK.POSTS, JSON.stringify(mergedPosts));
      }
      // Fetch profiles
      var resProf = await supabase.from('kun_com_profiles').select('*');
      if (resProf && resProf.data && resProf.data.length > 0) {
        var mergedProfiles = resProf.data.map(function(p) { return p.content; });
        DB_CACHE[SK.USERS] = mergedProfiles;
        localStorage.setItem(SK.USERS, JSON.stringify(mergedProfiles));
      }
      
      // Setup Realtime
      supabase.channel('public:kun_com_posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kun_com_posts' }, function(payload) {
           console.log('Realtime post update:', payload);
           fetchPostsSilently();
        })
        .subscribe();
        
      if (window.App && window.App.tab) {
         render(); 
      }
    } catch(e) {
      console.warn("Supabase Sync Error:", e);
    }
  }
  
  async function fetchPostsSilently() {
    if (!supabase) return;
    var res = await supabase.from('kun_com_posts').select('*');
    if (res && res.data && res.data.length > 0) {
      var mergedPosts = res.data.map(function(p) { return p.content; });
      mergedPosts.sort(function(a,b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
      DB_CACHE[SK.POSTS] = mergedPosts;
      localStorage.setItem(SK.POSTS, JSON.stringify(mergedPosts));
      render();
    }
  }

  function dbSetSupabase(key, val) {
    if (!supabase) return;
    if (key === SK.POSTS && Array.isArray(val)) {
       val.forEach(async function(post) {
         await supabase.from('kun_com_posts').upsert({ id: post.id, content: post }, { onConflict: 'id' });
       });
    } else if (key === SK.USERS && Array.isArray(val)) {
       val.forEach(async function(user) {
         await supabase.from('kun_com_profiles').upsert({ id: user.id, content: user }, { onConflict: 'id' });
       });
    }
  }

  function db(key, def) {
    if (DB_CACHE[key] !== undefined) return DB_CACHE[key];
    try { var r = localStorage.getItem(key); var parsed = r ? JSON.parse(r) : def; DB_CACHE[key] = parsed; return parsed; } catch(e) { return def; }
  }
  function dbSet(key, val) {
    DB_CACHE[key] = val;
    dbSetSupabase(key, val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  }

  // ============================================================
  // DONNÉES PAR DÉFAUT
  // ============================================================
  if (!db(SK.USERS, null)) {
    var _now = new Date().toISOString();
    dbSet(SK.USERS, [
      {
        id: 'u1', prenom: 'Éric', nom: 'Kouamé',
        email: 'eric.kouame@eglise.org',
        bio: 'Responsable Cadrage depuis 2022. Passionné de cinématographie et de captation live. 🎥',
        section_id: 'cadrage', section_nom: 'Cadrage',
        role: 'RESP_SECTION',
        is_online: true,
        joined_at: '2022-01-15T08:00:00.000Z',
        last_seen_at: _now,
        last_action_at: _now,
        last_action_label: 'Publication',
        avatar_color: '#007AFF'
      },
      {
        id: 'u2', prenom: 'Sarah', nom: 'Yao',
        email: 'sarah.yao@eglise.org',
        bio: 'Photographe de l\'équipe. Je capture les meilleurs moments du culte 📸',
        section_id: 'photo', section_nom: 'Photo',
        role: 'MEMBRE',
        is_online: true,
        joined_at: '2023-03-10T09:00:00.000Z',
        last_seen_at: _now,
        last_action_at: new Date(Date.now() - 900000).toISOString(),
        last_action_label: 'Commentaire',
        avatar_color: '#FF2D55'
      },
      {
        id: 'u3', prenom: 'Marc', nom: 'Touré',
        email: 'marc.toure@eglise.org',
        bio: 'Régie son & lumières. 3 ans au service du département. 🎛️',
        section_id: 'regie', section_nom: 'Régie',
        role: 'RESP_SECTION',
        is_online: false,
        joined_at: '2021-06-01T07:00:00.000Z',
        last_seen_at: new Date(Date.now() - 3600000).toISOString(),
        last_action_at: new Date(Date.now() - 7200000).toISOString(),
        last_action_label: 'Like',
        avatar_color: '#34C759'
      },
      {
        id: 'u0', prenom: 'Grand Resp.', nom: 'Pasteur',
        email: 'admin@eglise.org',
        bio: 'Responsable général du Département Communication VH. Vision, excellence et foi. 🙏',
        section_id: 'prod', section_nom: 'Prod',
        role: 'GRAND_RESPONSABLE',
        is_online: true,
        joined_at: '2020-01-01T06:00:00.000Z',
        last_seen_at: _now,
        last_action_at: _now,
        last_action_label: 'Modération',
        avatar_color: '#FFD700'
      }
    ]);
  }

  if (!db(SK.POSTS, null)) {
    var now = Date.now();
    dbSet(SK.POSTS, [
      {
        id: 'p1', userId: 'u1', timestamp: now - 1800000,
        author: 'Éric Kouamé', authorAvatar: 'É', avatarColor: '#007AFF',
        sectionId: 'cadrage', sectionNom: 'Cadrage',
        isVedette: true, scoreText: '4.88 / 5.0',
        caption: 'Excellente captation pour le Culte n°1 ! Toute l\'équipe #Cadrage a assuré. Merci à chacun pour le professionnalisme. #CulteDuDimanche 🙌',
        mediaUrls: [], likes: 43, likedBy: ['u2', 'u3', 'u0'], comments: [
          { id: 'c1', userId: 'u2', author: 'Sarah Yao', avatarColor: '#FF2D55', text: 'Superbe réactivité sur les plans chorale ! 🔥', timestamp: now - 1500000 },
          { id: 'c2', userId: 'u3', author: 'Marc Touré', avatarColor: '#34C759', text: 'Merci à toute l\'équipe, travail impeccable 👏', timestamp: now - 900000 }
        ]
      },
      {
        id: 'p2', userId: 'u2', timestamp: now - 5400000,
        author: 'Sarah Yao', authorAvatar: 'S', avatarColor: '#FF2D55',
        sectionId: 'photo', sectionNom: 'Photo',
        isVedette: false, scoreText: '',
        caption: 'Photos du culte disponibles dans le drive partagé 📸 #Photo #CulteDuDimanche\nUn grand merci au responsable pour la coordination !',
        mediaUrls: [], likes: 19, likedBy: ['u1'], comments: []
      },
      {
        id: 'p3', userId: 'u0', timestamp: now - 7200000,
        author: 'Grand Resp. Pasteur', authorAvatar: 'G', avatarColor: '#FFD700',
        sectionId: 'prod', sectionNom: 'Prod',
        isVedette: false, scoreText: '',
        caption: 'Bravo à tout le département #Prod pour l\'excellente coordination de ce dimanche. Continuez dans cet élan ! 💪 #CulteDuDimanche #Chorale',
        mediaUrls: [], likes: 31, likedBy: ['u1', 'u2'], comments: [
          { id: 'c3', userId: 'u1', author: 'Éric Kouamé', avatarColor: '#007AFF', text: 'Merci infiniment Pasteur ! On donne le meilleur 🙏', timestamp: now - 6800000 }
        ]
      }
    ]);
  }

  // ============================================================
  // ÉTAT GLOBAL
  // ============================================================
  var S = {
    auth: 'login',
    user: null,
    tab: 'home',
    story: 'all',
    q: '',
    // Modals
    createOpen: false,
    commentOpen: false,
    commentPostId: null,
    optionsOpen: false,
    optionsPost: null,
    // Media
    pendingMedia: [],
    carouselIdx: {},
    // Post state
    expandedCaptions: {},
    savedPosts: {},
    // Feed
    ratings: {
      cadrage: { score: 0, comment: '' },
      web: { score: 0, comment: '' },
      proj: { score: 0, comment: '' },
      prod: { score: 0, comment: '' },
      regie: { score: 0, comment: '' },
      photo: { score: 0, comment: '' },
      vente: { score: 0, comment: '' }
    },
    checkedIn: false,
    // Toast
    toast: null,
    toastTimer: null,
    // Hashtag
    hashSuggestions: false,
    editProfileOpen: false,
    postOptionsOpen: false,
    selectedPostId: null,
    avatarFile: null,
    viewUserProfileId: null,
    loadingUserProfile: false,
    createEventOpen: false,
    forgotUser: null,
    signupSections: [],
    editSections: [],
    eventSections: [],
    selectedDate: null
};

  // ============================================================
  // RESTORE SESSION
  // ============================================================
  (function restoreSession() {
    try {
      var u = sessionStorage.getItem(SK.SESS);
      if (u) { S.user = JSON.parse(u); S.auth = 'app'; }
    } catch(e) {}
    // Restore saved posts
    S.savedPosts = db(SK.SAVED, {});
  })();

  // ============================================================
  // SECTIONS
  // ============================================================
  var SECTIONS = [
    { id: 'cadrage', nom: 'Cadrage', emoji: '🎥', color: '#007AFF' },
    { id: 'regie',   nom: 'Régie',   emoji: '🎛️', color: '#FF9500' },
    { id: 'web',     nom: 'Web',     emoji: '🌐', color: '#34C759' },
    { id: 'proj',    nom: 'Projection', emoji: '🖥️', color: '#5856D6' },
    { id: 'prod',    nom: 'Prod',    emoji: '🎬', color: '#FF3B30' },
    { id: 'photo',   nom: 'Photo',   emoji: '📸', color: '#FF2D55' },
    { id: 'vente',   nom: 'Vente',   emoji: '🛒', color: '#AF52DE' }
  ];
  var HASHTAGS = ['#Cadrage','#Régie','#Web','#Projection','#Prod','#Photo','#Vente','#CulteDuDimanche','#Chorale','#Formation','#Bilan'];

  function secNom(id) { var s = SECTIONS.find(function(x){ return x.id===id; }); return s ? s.nom : 'Général'; }
  function secEmoji(id) { var s = SECTIONS.find(function(x){ return x.id===id; }); return s ? s.emoji : '📢'; }
  function secColor(id) { var s = SECTIONS.find(function(x){ return x.id===id; }); return s ? s.color : '#8E8E93'; }

  function timeAgo(ts) {
    var d = Math.floor((Date.now() - (ts||Date.now())) / 1000);
    if (d < 5)    return 'À l\'instant';
    if (d < 60)   return d + 's';
    if (d < 3600) return Math.floor(d/60) + ' min';
    if (d < 86400) return Math.floor(d/3600) + ' h';
    if (d < 604800) return Math.floor(d/86400) + ' j';
    return new Date(ts).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
  }

  function safeHtml(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function hashtagify(text) {
    if (!text) return '';
    var safe = safeHtml(text);
    return safe.replace(/#[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]+/gi, function(m) {
      return '<span onclick="App.filterTag(\'' + encodeURIComponent(m) + '\')" style="color:#007AFF;font-weight:700;cursor:pointer;">' + m + '</span>';
    }).replace(/\n/g, '<br>');
  }

  function trendingTags() {
    var posts = db(SK.POSTS, []);
    var cnt = {};
    posts.forEach(function(p) {
      var tags = ((p.caption||'') + ' ' + (p.title||'')).match(/#[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]+/gi) || [];
      tags.forEach(function(t) { var k = t.toLowerCase(); cnt[k] = (cnt[k]||0)+1; });
    });
    return Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }).slice(0,8)
      .map(function(t){ return t.charAt(0).toUpperCase()+t.slice(1); });
  }

  function userIsLiked(post) {
    return S.user && Array.isArray(post.likedBy) && post.likedBy.indexOf(S.user.id) !== -1;
  }

  // ============================================================
  // TOAST — Non-bloquant, par injection DOM directe (pas re-render)
  // ============================================================
  function toast(msg, type) {
    type = type || 'success';
    if (S.toastTimer) clearTimeout(S.toastTimer);

    // Inject/update toast overlay without re-rendering the app
    var el = document.getElementById('_toast');
    if (!el) {
      el = document.createElement('div');
      el.id = '_toast';
      el.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-80px);z-index:9999999;max-width:360px;width:calc(100% - 32px);pointer-events:none;transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s;opacity:0;';
      document.body.appendChild(el);
    }

    var isErr = type === 'error';
    var isWarn = type === 'warning';
    var accent = isErr ? '#FF3B30' : isWarn ? '#FF9500' : '#34C759';
    var bgIcon = isErr ? '#FFF0EE' : isWarn ? '#FFF8EE' : '#EDFBF3';
    var icon = isErr
      ? '<path d="M18 6L6 18M6 6l12 12"/>'
      : '<path d="M20 6L9 17l-5-5"/>';

    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:13px 16px;border-radius:18px;border:1px solid rgba(0,0,0,0.06);box-shadow:0 12px 40px rgba(0,0,0,0.18);">' +
      '<div style="width:28px;height:28px;border-radius:50%;background:' + bgIcon + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + accent + '" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg>' +
      '</div>' +
      '<span style="font-size:13.5px;font-weight:700;color:#1C1C1E;flex:1;line-height:1.3;">' + safeHtml(msg) + '</span>' +
    '</div>';

    requestAnimationFrame(function() {
      el.style.transform = 'translateX(-50%) translateY(0)';
      el.style.opacity = '1';
    });

    S.toastTimer = setTimeout(function() {
      el.style.transform = 'translateX(-50%) translateY(-80px)';
      el.style.opacity = '0';
    }, 2800);
  }

  // ============================================================
  // SVG ICONS
  // ============================================================
  var SVG = {
    heart: function(f, sz) {
      sz = sz || 24;
      var c = f ? '#FF2D55' : '#262626';
      return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="' + (f ? c : 'none') + '" stroke="' + c + '" stroke-width="' + (f ? '0' : '1.8') + '" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    },
    comment: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    share: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    bookmark: function(saved) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (saved ? '#000' : 'none') + '" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
    },
    send: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    dots: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>',
    plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
    home: function(a) { return '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (a?'#000':'none') + '" stroke="' + (a?'#000':'#8E8E93') + '" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'; },
    cal: function(a) { return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + (a?'#000':'#8E8E93') + '" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'; },
    star: function(a) { return '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (a?'#000':'none') + '" stroke="' + (a?'#000':'#8E8E93') + '" stroke-width="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'; },
    person: function(a) { return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + (a?'#000':'#8E8E93') + '" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; }
  };

  // ============================================================
  // RENDER ENGINE
  // ============================================================
  function render() {
    var root = document.getElementById('root');
    if (!root) return;
    var prev = root.querySelector('#mainContent');
    var scrollTop = prev ? prev.scrollTop : 0;

    var html = '';
    if (S.auth === 'login') html = renderLogin();
    else if (S.auth === 'signup') html = renderSignup();
    else html = renderApp();

    root.innerHTML = html;

    // Restore scroll position
    var mc = root.querySelector('#mainContent');
    if (mc && scrollTop > 0) mc.scrollTop = scrollTop;
  }

  // ============================================================
  // AUTH SCREENS
  // ============================================================
  function renderLogin() {
    return '<div style="min-height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:28px 24px;box-sizing:border-box;background:linear-gradient(180deg,#F8F9FF 0%,#FFFFFF 100%);">' +
    '<div style="width:100%;max-width:360px;">' +

      '<div style="text-align:center;margin-bottom:40px;">' +
        '<div style="width:72px;height:72px;border-radius:24px;background:linear-gradient(135deg,#007AFF 0%,#0040CC 100%);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 8px 28px rgba(0,122,255,0.4);">' +
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '</div>' +
        '<div style="font-size:11px;font-weight:800;color:#007AFF;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Église Vase d\'Honneur</div>' +
        '<h1 style="font-size:32px;font-weight:900;color:#000;margin:0;letter-spacing:-1px;">Kun COM</h1>' +
        '<p style="font-size:14px;color:#8E8E93;margin:6px 0 0;">Département Communication</p>' +
      '</div>' +

      '<form onsubmit="App.login(event)" style="display:flex;flex-direction:column;gap:14px;">' +
        renderField('loginEmail', 'email', 'Adresse e-mail', 'eric.kouame@eglise.org', 'email') +
        renderField('loginPwd', 'password', 'Mot de passe', '••••••••', 'current-password') +
        '<button type="submit" style="' + btnStyle('#007AFF') + '">Se connecter →</button>' +
      '</form>' +

      '<p style="text-align:center;font-size:13.5px;color:#8E8E93;margin-top:22px;">' +
        'Pas encore de compte ? <span onclick="App.nav(\'signup\')" style="color:#007AFF;font-weight:700;cursor:pointer;">S\'inscrire</span>' +
      '</p>' +

      '<div style="margin-top:20px;padding:14px 16px;background:#F0F6FF;border-radius:16px;border:1px solid #CCDEFF;">' +
        '<p style="font-size:11px;font-weight:700;color:#007AFF;margin:0 0 5px;">Démo rapide :</p>' +
        '<p style="font-size:11.5px;color:#3A3A3C;margin:0;line-height:1.6;">eric.kouame@eglise.org<br>admin@eglise.org <span style="color:#B8860B;">(Grand Responsable)</span></p>' +
      '</div>' +
    '</div></div>';
  }


  function renderForgot() {
    if (!S.forgotUser) {
      return '<div style="min-height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:28px 24px;box-sizing:border-box;background:linear-gradient(180deg,#F8F9FF 0%,#FFFFFF 100%);">' +
        '<div style="width:100%;max-width:360px;">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">' +
            '<button onclick="App.nav(\'login\')" style="background:#F2F2F7;border:none;width:36px;height:36px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
            '</button>' +
            '<div><h1 style="font-size:22px;font-weight:900;color:#000;margin:0;">Mot de passe oublié</h1></div>' +
          '</div>' +
          '<p style="font-size:14px;color:#8E8E93;margin-bottom:24px;">Saisissez votre adresse e-mail pour retrouver votre compte et répondre à vos questions de sécurité.</p>' +
          '<form onsubmit="App.checkForgotEmail(event)" style="display:flex;flex-direction:column;gap:14px;">' +
            renderField('forgotEmail', 'email', 'E-mail', 'jean.dupont@eglise.org', 'email') +
            '<button type="submit" style="' + btnStyle('#007AFF') + '">Suivant →</button>' +
          '</form>' +
        '</div></div>';
    } else {
      return '<div style="min-height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:28px 24px;box-sizing:border-box;background:linear-gradient(180deg,#F8F9FF 0%,#FFFFFF 100%);">' +
        '<div style="width:100%;max-width:360px;">' +
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">' +
            '<button onclick="S.forgotUser=null;render();" style="background:#F2F2F7;border:none;width:36px;height:36px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
            '</button>' +
            '<div><h1 style="font-size:22px;font-weight:900;color:#000;margin:0;">Réinitialisation</h1></div>' +
          '</div>' +
          '<p style="font-size:14px;color:#8E8E93;margin-bottom:20px;">Répondez aux deux questions de sécurité que vous avez définies lors de votre inscription.</p>' +
          '<form onsubmit="App.resetPassword(event)" style="display:flex;flex-direction:column;gap:14px;">' +
            '<div><label style="font-size:12px;font-weight:700;color:#3A3A3C;display:block;margin-bottom:5px;">Q1: ' + (S.forgotUser.sec_q1||'Question 1') + '</label>' +
            '<input id="forgotA1" type="text" placeholder="Votre réponse secrète" required style="width:100%;height:48px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 14px;font-size:14px;box-sizing:border-box;outline:none;" /></div>' +
            '<div><label style="font-size:12px;font-weight:700;color:#3A3A3C;display:block;margin-bottom:5px;">Q2: ' + (S.forgotUser.sec_q2||'Question 2') + '</label>' +
            '<input id="forgotA2" type="text" placeholder="Votre réponse secrète" required style="width:100%;height:48px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 14px;font-size:14px;box-sizing:border-box;outline:none;" /></div>' +
            '<div style="margin-top:10px;">' + renderField('forgotPwd', 'password', 'Nouveau mot de passe', '8 caractères minimum', 'new-password') + '</div>' +
            '<button type="submit" style="' + btnStyle('#007AFF') + 'margin-top:6px;">Réinitialiser le mot de passe</button>' +
          '</form>' +
        '</div></div>';
    }
  }

  function renderSignup() {
    return '<div style="min-height:100%;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:28px 24px;box-sizing:border-box;background:#FFF;">' +
    '<div style="width:100%;max-width:360px;">' +

      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">' +
        '<button onclick="App.nav(\'login\')" style="background:#F2F2F7;border:none;width:36px;height:36px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>' +
        '</button>' +
        '<div><p style="font-size:11px;font-weight:800;color:#007AFF;text-transform:uppercase;letter-spacing:1.5px;margin:0;">Créer un compte</p>' +
        '<h1 style="font-size:22px;font-weight:900;color:#000;margin:0;">Rejoindre Kun COM</h1></div>' +
      '</div>' +

      '<form onsubmit="App.signup(event)" style="display:flex;flex-direction:column;gap:12px;">' +
        '<div style="display:flex;gap:10px;">' +
          renderField('signupPrenom', 'text', 'Prénom', 'Jean', 'given-name') +
          renderField('signupNom', 'text', 'Nom', 'Dupont', 'family-name') +
        '</div>' +
        renderField('signupEmail', 'email', 'E-mail', 'jean.dupont@eglise.org', 'email') +
        '<div><label style="font-size:12px;font-weight:700;color:#3A3A3C;display:block;margin-bottom:5px;">Section</label>' +
          '<select id="signupSection" style="width:100%;height:48px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 14px;font-size:14px;color:#000;box-sizing:border-box;outline:none;cursor:pointer;" onfocus="this.style.borderColor=\'#007AFF\'" onblur="this.style.borderColor=\'#E5E5EA\'">' +
          SECTIONS.map(function(s){ return '<option value="'+s.id+'">'+s.emoji+' '+s.nom+'</option>'; }).join('') +
        '</select></div>' +
        renderField('signupPwd', 'password', 'Mot de passe', '8 caractères minimum', 'new-password') +
        '<div style="margin-top:10px;border-top:1px dashed #E5E5EA;padding-top:12px;"><p style="font-size:13px;font-weight:800;margin:0 0 10px;">Questions de sécurité (Récupération)</p>' +
        '<div><label style="font-size:12px;font-weight:700;color:#3A3A3C;display:block;margin-bottom:5px;">Question 1</label>' +
          '<select id="signupQ1" style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 14px;font-size:13px;color:#000;box-sizing:border-box;margin-bottom:8px;outline:none;">' +
            '<option>Quel est votre verset préféré ?</option>' +
            '<option>Quel est le nom de votre premier animal ?</option>' +
            '<option>Quelle est votre couleur préférée ?</option>' +
          '</select>' +
          '<input id="signupA1" type="text" placeholder="Réponse secrète" required style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 14px;font-size:13px;box-sizing:border-box;margin-bottom:12px;outline:none;" />' +
        '</div>' +
        '<div><label style="font-size:12px;font-weight:700;color:#3A3A3C;display:block;margin-bottom:5px;">Question 2</label>' +
          '<select id="signupQ2" style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 14px;font-size:13px;color:#000;box-sizing:border-box;margin-bottom:8px;outline:none;">' +
            '<option>Quelle est votre fonction dans la COM ?</option>' +
            '<option>Quel est le prénom de votre mère ?</option>' +
            '<option>Quel est votre plat préféré ?</option>' +
          '</select>' +
          '<input id="signupA2" type="text" placeholder="Réponse secrète" required style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 14px;font-size:13px;box-sizing:border-box;margin-bottom:12px;outline:none;" />' +
        '</div></div>' +
        '<button type="submit" style="' + btnStyle('#007AFF') + 'margin-top:6px;">Créer mon compte</button>' +
      '</form>' +

      '<p style="text-align:center;font-size:13.5px;color:#8E8E93;margin-top:20px;">' +
        'Déjà inscrit ? <span onclick="App.nav(\'login\')" style="color:#007AFF;font-weight:700;cursor:pointer;">Se connecter</span>' +
      '</p>' +
    '</div></div>';
  }

  function renderField(id, type, label, placeholder, autocomplete) {
    return '<div style="flex:1;">' +
      '<label style="font-size:12px;font-weight:700;color:#3A3A3C;display:block;margin-bottom:5px;">' + label + '</label>' +
      '<input id="' + id + '" type="' + type + '"' + (type==='email' && id==='loginEmail' ? ' value="eric.kouame@eglise.org"' : '') + ' placeholder="' + placeholder + '" autocomplete="' + (autocomplete||'off') + '" required ' +
      'style="width:100%;height:50px;border-radius:14px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 16px;font-size:14.5px;color:#000;box-sizing:border-box;outline:none;transition:border-color 0.2s;" ' +
      'onfocus="this.style.borderColor=\'#007AFF\'" onblur="this.style.borderColor=\'#E5E5EA\'">' +
    '</div>';
  }

  function btnStyle(bg) {
    return 'width:100%;height:52px;background:linear-gradient(135deg,' + bg + ',#0040CC);color:#FFF;border:none;border-radius:16px;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(0,122,255,0.3);letter-spacing:0.2px;';
  }

  // ============================================================
  // MAIN APP
  // ============================================================
  function renderApp() {
    var u = S.user || {};
    var initial = (u.prenom || 'M').charAt(0).toUpperCase();
    var posts = db(SK.POSTS, []);

    // Filter posts
    var filtered = posts.slice().sort(function(a,b){
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return (b.timestamp||0)-(a.timestamp||0); 
      }).filter(function(p) {
        if (S.story !== 'all' && p.sectionId !== S.story) return false;
        if (S.q.trim()) {
          var q = S.q.toLowerCase();
          return (p.caption||'').toLowerCase().indexOf(q) !== -1 ||
                 (p.author||'').toLowerCase().indexOf(q) !== -1 ||
                 (p.sectionNom||'').toLowerCase().indexOf(q) !== -1 ||
                 (p.hashtags && p.hashtags.some(function(h){ return h.toLowerCase().indexOf(q) !== -1; }));
        }
        return true;
      });

    var content = '';
    if (S.tab === 'home')     content = renderHome(filtered, initial, u);
    else if (S.tab === 'planning') content = renderPlanning();
    else if (S.tab === 'debrief') content = renderDebrief(u);
    else if (S.tab === 'profile') content = renderProfile(u, posts);

    var modals = '';
    
  function renderUserProfileModal() {
    if (!S.viewUserProfileId) return '';
    var targetUser = db(SK.USERS, []).find(function(p){ return p.id === S.viewUserProfileId; });
    var posts = db(SK.POSTS, []);
    
    var content = '';
    if (S.loadingUserProfile) {
      content = '<div style="padding:100px 20px;text-align:center;"><div style="font-size:32px;animation:spin 1s linear infinite;">⏳</div><div style="margin-top:16px;font-size:14px;color:#8E8E93;">Chargement du profil...</div></div>';
    } else if (!targetUser) {
      content = '<div style="padding:100px 20px;text-align:center;"><div style="font-size:40px;">😕</div><div style="margin-top:16px;font-size:16px;font-weight:600;">Utilisateur introuvable</div><button onclick="App.closeUserProfile()" style="margin-top:20px;padding:10px 20px;background:#007AFF;color:#FFF;border:none;border-radius:20px;font-weight:600;cursor:pointer;">Retour</button></div>';
    } else {
      content = renderProfile(targetUser, posts);
    }
    
    return '<div style="position:fixed;inset:0;background:#FFF;z-index:9000;overflow-y:auto;animation:slideIn 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      content +
    '</div>';
  }
    if (S.viewUserProfileId) modals += renderUserProfileModal();
    if (S.editProfileOpen) modals += renderEditProfileModal(u);
    if (S.postOptionsOpen) modals += renderPostOptionsModal(posts.find(function(p){return p.id===S.selectedPostId;}));
    if (S.createEventOpen) modals += renderCreateEventModal();
    if (S.createOpen) modals += renderCreateModal(u);
    if (S.optionsOpen && S.optionsPost) modals += renderOptionsModal();
    if (S.commentOpen && S.commentPostId) modals += renderCommentsModal(posts, initial);

    return '<div style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Text\',sans-serif;">' +
      '<div id="mainContent" style="flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;padding-bottom:70px;">' + content + '</div>' +
      modals +
      renderNav(initial) +
    '</div>';
  }

  function renderNav(initial) {
    function nb(id, iconFn, lbl) {
      var a = S.tab === id;
      return '<button onclick="App.tab(\'' + id + '\')" style="flex:1;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 2px 4px;position:relative;-webkit-tap-highlight-color:transparent;">' +
        iconFn(a) +
        '<span style="font-size:9.5px;font-weight:' + (a?'800':'400') + ';color:' + (a?'#000':'#8E8E93') + ';margin-top:3px;">' + lbl + '</span>' +
        (a ? '<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:16px;height:2px;border-radius:2px;background:#000;"></div>' : '') +
      '</button>';
    }
    return '<nav style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;height:62px;background:rgba(255,255,255,0.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-top:0.5px solid rgba(0,0,0,0.12);display:flex;align-items:stretch;z-index:9000;safe-area-inset-bottom:env(safe-area-inset-bottom);">' +
      nb('home', SVG.home, 'Accueil') +
      nb('planning', SVG.cal, 'Planning') +
      '<button onclick="App.openCreate()" style="flex:1;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;">' +
        '<div style="width:46px;height:46px;border-radius:23px;background:linear-gradient(135deg,#007AFF,#0040CC);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,122,255,0.4);margin-bottom:8px;">' + SVG.plus + '</div>' +
      '</button>' +
      nb('debrief', SVG.star, 'Notation') +
      nb('profile', SVG.person, 'Profil') +
    '</nav>';
  }

  // ============================================================
  // HOME TAB
  // ============================================================
  function renderHome(filtered, initial, u) {
    var trends = trendingTags();

    var header = '<header style="position:sticky;top:0;z-index:200;background:rgba(255,255,255,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(0,0,0,0.1);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 16px 8px;">' +
        '<div>' +
          '<div style="font-size:10px;font-weight:800;color:#007AFF;text-transform:uppercase;letter-spacing:1.5px;">Église Vase d\'Honneur</div>' +
          '<h1 style="font-size:22px;font-weight:900;color:#000;margin:0;letter-spacing:-0.5px;">Kun COM</h1>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<button onclick="App.openCreate()" style="width:34px;height:34px;border-radius:17px;background:#F0F6FF;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>' +
          '</button>' +
          '<button onclick="App.tab(\'profile\')" style="width:34px;height:34px;border-radius:17px;background:linear-gradient(135deg,' + (u.avatar_color||'#007AFF') + ',#0040CC);border:none;cursor:pointer;color:#FFF;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + initial + '</button>' +
        '</div>' +
      '</div>' +
      // Search
      '<div style="padding:0 14px 10px;">' +
        '<div style="display:flex;align-items:center;gap:8px;background:#F2F2F7;border-radius:12px;height:38px;padding:0 12px;">' +
          SVG.search +
          '<input id="searchInput" type="search" value="' + safeHtml(S.q) + '" oninput="App.search(this.value)" placeholder="Rechercher..." style="flex:1;border:none;background:transparent;font-size:13.5px;color:#000;outline:none;">' +
          (S.q ? '<button onclick="App.search(\'\')" style="background:none;border:none;cursor:pointer;color:#8E8E93;font-size:18px;line-height:1;padding:0;">×</button>' : '') +
        '</div>' +
      '</div>' +
    '</header>';

    // Trends
    var trendsHtml = '';
    if (trends.length > 0) {
      trendsHtml = '<div style="background:#FFF;border-bottom:0.5px solid #F2F2F7;padding:8px 16px;">' +
        '<div style="display:flex;gap:7px;overflow-x:auto;align-items:center;-webkit-overflow-scrolling:touch;">' +
        '<span style="font-size:10.5px;font-weight:800;color:#007AFF;white-space:nowrap;flex-shrink:0;">🔥 TENDANCES</span>' +
        trends.map(function(t) {
          var active = S.q.toLowerCase() === t.toLowerCase();
          return '<button onclick="App.filterTag(\'' + encodeURIComponent(t) + '\')" style="flex-shrink:0;background:' + (active?'#007AFF':'#EFF6FF') + ';color:' + (active?'#FFF':'#007AFF') + ';border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">' + t + '</button>';
        }).join('') +
        '</div></div>';
    }

    // Stories
    var stories = '<div style="background:#FFF;border-bottom:0.5px solid #F2F2F7;padding:10px 0;">' +
      '<div style="display:flex;gap:2px;padding:0 10px;overflow-x:auto;-webkit-overflow-scrolling:touch;">' +
      [{ id:'all', nom:'Tous', emoji:'✨' }].concat(SECTIONS).map(function(s) {
        var sel = S.story === s.id;
        var sc = secColor(s.id) || '#007AFF';
        return '<div onclick="App.story(\'' + s.id + '\')" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;min-width:66px;gap:4px;flex-shrink:0;">' +
          '<div style="width:58px;height:58px;border-radius:29px;' +
            (sel ? 'background:linear-gradient(135deg,' + sc + ',#0040CC);box-shadow:0 4px 14px rgba(0,0,0,0.2);' : 'background:#F2F2F7;') +
            'display:flex;align-items:center;justify-content:center;font-size:24px;transition:all 0.2s;">' +
            s.emoji +
          '</div>' +
          '<span style="font-size:10.5px;font-weight:' + (sel?'800':'400') + ';color:' + (sel?sc:'#8E8E93') + ';text-align:center;white-space:nowrap;">' + s.nom + '</span>' +
        '</div>';
      }).join('') +
      '</div></div>';

    // Feed
    var feed = '';
    if (filtered.length === 0) {
      feed = '<div style="display:flex;flex-direction:column;align-items:center;padding:70px 24px;text-align:center;">' +
        '<div style="font-size:52px;margin-bottom:16px;">📭</div>' +
        '<h3 style="font-size:18px;font-weight:800;color:#000;margin:0 0 8px;">' + (S.q ? 'Aucun résultat' : 'Aucune publication') + '</h3>' +
        '<p style="font-size:13.5px;color:#8E8E93;margin:0 0 22px;max-width:240px;line-height:1.5;">' +
          (S.q ? 'Aucun résultat trouvé pour "' + safeHtml(S.q) + '"' : 'Soyez le premier à partager quelque chose !') +
        '</p>' +
        (S.q
          ? '<button onclick="App.search(\'\')" style="' + btnStyle('#007AFF') + 'height:44px;width:auto;padding:0 22px;font-size:14px;">Réinitialiser la recherche</button>'
          : '<button onclick="App.openCreate()" style="' + btnStyle('#007AFF') + 'height:44px;width:auto;padding:0 22px;font-size:14px;">Créer un post</button>') +
      '</div>';
    } else {
      feed = filtered.map(renderPostCard).join('') +
        '<div style="padding:36px 20px;text-align:center;background:#FFF;margin-top:8px;">' +
          '<div style="width:40px;height:40px;border-radius:20px;background:#F0F6FF;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">' + SVG.check + '</div>' +
          '<h4 style="font-size:15px;font-weight:800;color:#000;margin:0;">Vous êtes à jour ✓</h4>' +
          '<p style="font-size:12.5px;color:#8E8E93;margin:4px 0 0;">Toutes les publications ont été affichées.</p>' +
        '</div>';
    }

    return header + trendsHtml + stories + feed;
  }

  // ============================================================
  // POST CARD — Style Instagram complet
  // ============================================================
  function renderPostCard(post) {
    var iLiked = userIsLiked(post);
    var iSaved = !!S.savedPosts[post.id];
    var hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
    var curIdx = S.carouselIdx[post.id] || 0;
    var expanded = !!S.expandedCaptions[post.id];
    var ago = timeAgo(post.timestamp);
    var sec = SECTIONS.find(function(s){ return s.id === post.sectionId; }) || { emoji:'📢', color:'#8E8E93' };
    var likeCount = Array.isArray(post.likedBy) ? post.likedBy.length : (post.likes || 0);

    // Caption truncation (Instagram style: max 3 lines)
    var fullCaption = post.caption || '';
    var captionHtml = '';
    var lines = fullCaption.split('\n');
    var needsTruncate = fullCaption.length > 120 || lines.length > 3;
    if (!expanded && needsTruncate) {
      var short = fullCaption.slice(0, 120);
      captionHtml = hashtagify(short) + '... <span onclick="App.expandCaption(\'' + post.id + '\')" style="color:#8E8E93;cursor:pointer;font-weight:600;">plus</span>';
    } else {
      captionHtml = hashtagify(fullCaption);
      if (needsTruncate && expanded) {
        captionHtml += ' <span onclick="App.expandCaption(\'' + post.id + '\')" style="color:#8E8E93;cursor:pointer;font-weight:600;">moins</span>';
      }
    }

    // Media zone
    var mediaZone = '';
    if (hasMedia) {
      var isMulti = post.mediaUrls.length > 1;
      mediaZone = '<div style="position:relative;background:#000;">' +
        (isMulti ? '<div id="badge-'+post.id+'" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.6);color:#FFF;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;z-index:10;">' + (curIdx+1) + '/' + post.mediaUrls.length + '</div>' : '') +
        '<div id="car-'+post.id+'" onscroll="App.carScroll(\''+post.id+'\',this)" ondblclick="App.doubleTapLike(\''+post.id+'\')" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;aspect-ratio:1/1;scrollbar-width:none;">' +
          post.mediaUrls.map(function(url) {
            return '<div style="flex:0 0 100%;scroll-snap-align:start;"><img src="'+url+'" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;aspect-ratio:1/1;"/></div>';
          }).join('') +
        '</div>' +
        (isMulti ? '<div id="dots-'+post.id+'" style="display:flex;justify-content:center;gap:5px;padding:8px 0;background:#FFF;">' +
          post.mediaUrls.map(function(_,di){
            var a = di === curIdx;
            return '<div style="width:'+(a?'18':'6')+'px;height:6px;border-radius:3px;background:'+(a?'#007AFF':'#C7C7CC')+';transition:all 0.25s;"></div>';
          }).join('') +
        '</div>' : '') +
      '</div>';
    } else {
      // Text-only: only show dark zone for vedette/scored posts
      if (post.isVedette || post.scoreText) {
        mediaZone = '<div ondblclick="App.doubleTapLike(\''+post.id+'\')" style="background:linear-gradient(135deg,#1A1A2E,#2D2D44);min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center;position:relative;">' +
          '<div style="width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;margin-bottom:8px;font-size:22px;">' + sec.emoji + '</div>' +
          (post.isVedette ? '<div style="background:linear-gradient(135deg,#FFD700,#FF9500);color:#5D3A00;font-size:10px;font-weight:900;padding:4px 12px;border-radius:20px;letter-spacing:0.8px;margin-bottom:6px;">⭐ SECTION VEDETTE</div>' : '') +
          (post.scoreText ? '<div style="background:rgba(255,255,255,0.92);backdrop-filter:blur(8px);padding:5px 12px;border-radius:12px;position:absolute;bottom:12px;right:12px;"><strong style="font-size:13px;color:#1C1C1E;">★ ' + post.scoreText + '</strong></div>' : '') +
        '</div>';
      } else {
        // Plain text post — no dark background, just show caption below
        mediaZone = '';
      }
    }

    var pinnedBadge = post.is_pinned ? '<div style="background:#5856D6;color:#FFF;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;display:flex;align-items:center;gap:6px;"><span style="font-size:12px;">📌</span> ÉPINGLÉ</div>' : '';

      var contentZone = '';
      // Handle new-format EVENT posts (created by saveEvent)
      if (post.type === 'EVENT' && post.eventTitle) {
         var evDate = post.eventDate ? new Date(post.eventDate + 'T00:00:00') : null;
         var evMonth = evDate ? evDate.toLocaleDateString('fr-FR', {month:'short'}).toUpperCase() : '';
         var evDay = evDate ? evDate.getDate() : '';
         var evSections = (post.eventSections || []).map(function(s){ return '<span style="font-size:12px;font-weight:700;color:#5856D6;">' + s.charAt(0).toUpperCase() + s.slice(1) + '</span>'; }).join(' ');
         var evStatus = '';
         var nowDateStr = new Date().toISOString().split('T')[0];
         var nowTimeStr = new Date().toTimeString().slice(0,5);
         if (post.eventDate < nowDateStr || (post.eventDate === nowDateStr && post.eventEnd && nowTimeStr > post.eventEnd)) {
           evStatus = '<span style="background:#F2F2F7;color:#8E8E93;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;">✅ Terminé</span>';
         } else if (post.eventDate === nowDateStr && post.eventStart && nowTimeStr >= post.eventStart) {
           evStatus = '<span style="background:#E5F4E9;color:#28A347;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;">🟢 En cours</span>';
         } else {
           evStatus = '<span style="background:#F0EFFF;color:#5856D6;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:800;">🗓 À venir</span>';
         }
         contentZone = '<div style="margin:0 14px 10px;padding:16px;background:linear-gradient(145deg,#F9F9FF,#F0F0FA);border-radius:18px;border-left:4px solid #5856D6;">' +
           '<div style="display:flex;gap:14px;align-items:flex-start;">' +
             (evDate ? '<div style="background:#FFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);width:54px;text-align:center;flex-shrink:0;border:1px solid #EFEFFF;">' +
               '<div style="background:#5856D6;color:#FFF;font-size:9px;font-weight:900;text-transform:uppercase;padding:4px 0;letter-spacing:1px;">' + evMonth + '</div>' +
               '<div style="font-size:24px;font-weight:900;color:#000;padding:4px 0;">' + evDay + '</div>' +
             '</div>' : '') +
             '<div style="flex:1;min-width:0;">' +
               '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                 '<h3 style="font-size:16px;font-weight:900;color:#1C1C1E;margin:0;flex:1;">' + safeHtml(post.eventTitle) + '</h3>' +
                 evStatus +
               '</div>' +
               (evSections ? '<div style="margin-bottom:6px;">' + evSections + '</div>' : '') +
               '<div style="font-size:13px;color:#8E8E93;display:flex;flex-wrap:wrap;gap:8px;">' +
                 (post.eventStart ? '<span>🕒 ' + post.eventStart + (post.eventEnd ? ' — ' + post.eventEnd : '') + '</span>' : '') +
                 (post.eventLocation ? '<span>📍 ' + safeHtml(post.eventLocation) + '</span>' : '') +
               '</div>' +
             '</div>' +
           '</div>' +
         '</div>';
      } else if (post.type === 'EVENT' && post.metadata) {
         var participants = Object.keys(post.metadata.participations || {}).filter(function(k) { return post.metadata.participations[k] === 'yes'; });
         var partAvatars = '';
         if (participants.length > 0) {
             partAvatars = '<div style="display:flex;margin-left:8px;">';
             for (var i=0; i<Math.min(participants.length, 3); i++) {
                 partAvatars += '<div style="width:24px;height:24px;border-radius:12px;background:#5856D6;color:#FFF;border:2px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;margin-left:-8px;">👤</div>';
             }
             if (participants.length > 3) {
                 partAvatars += '<div style="width:24px;height:24px;border-radius:12px;background:#E5E5EA;color:#000;border:2px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;margin-left:-8px;">+'+(participants.length-3)+'</div>';
             }
             partAvatars += '</div>';
         }

         contentZone = '<div style="margin:10px 14px;padding:20px;background:linear-gradient(145deg, #F9F9FF 0%, #F0F0FA 100%);border-radius:20px;border-left:5px solid #5856D6;box-shadow:0 4px 12px rgba(0,0,0,0.03);position:relative;overflow:hidden;">' +
          '<div style="position:absolute;top:0;right:0;width:100px;height:100px;background:radial-gradient(circle, rgba(88,86,214,0.05) 0%, rgba(255,255,255,0) 70%);border-radius:50%;transform:translate(30%,-30%);"></div>' +
          
          '<div style="display:inline-block;background:rgba(88,86,214,0.1);color:#5856D6;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">🗓️ Événement Planning</div>' +
          
          '<div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">' +
            '<div style="background:#FFF;border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,0.08);width:70px;text-align:center;flex-shrink:0;border:1px solid #EFEFFF;">' +
              '<div style="background:linear-gradient(135deg, #FF3B30, #D70015);color:#FFF;font-size:11px;font-weight:900;text-transform:uppercase;padding:6px 0;letter-spacing:1px;">' + (post.metadata.month||'MOIS') + '</div>' +
              '<div style="font-size:28px;font-weight:900;color:#000;padding:8px 0;">' + (post.metadata.day||'00') + '</div>' +
            '</div>' +
            '<div style="flex:1;">' +
              '<h3 style="margin:0 0 8px;font-size:19px;font-weight:900;color:#1C1C1E;line-height:1.2;letter-spacing:-0.3px;">' + safeHtml(post.metadata.title||'') + '</h3>' +
              '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
                '<div style="font-size:13px;color:#5856D6;display:flex;align-items:center;gap:4px;font-weight:600;background:rgba(88,86,214,0.08);padding:4px 8px;border-radius:6px;"><span style="font-size:14px;">🕒</span> ' + safeHtml(post.metadata.time||'') + '</div>' +
                '<div style="font-size:13px;color:#8E8E93;display:flex;align-items:center;gap:4px;font-weight:600;background:#F2F2F7;padding:4px 8px;border-radius:6px;"><span style="font-size:14px;">📍</span> ' + safeHtml(post.metadata.location||'') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          
          (post.caption ? '<p style="font-size:14px;color:#3A3A3C;margin:0 0 16px;line-height:1.5;">' + safeHtml(post.caption) + '</p>' : '') +
          
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-top:12px;border-top:1px dashed #D1D1D6;">' +
            '<div style="display:flex;align-items:center;">' +
              '<span style="font-size:12px;color:#8E8E93;font-weight:600;">' + participants.length + ' Confirmé(s)</span>' +
              partAvatars +
            '</div>' +
          '</div>' +

          '<div style="display:flex;gap:10px;">' +
            '<button onclick="App.toggleParticipation(\''+post.id+'\',\'yes\')" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:800;border:none;cursor:pointer;background:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'linear-gradient(135deg,#34C759,#28A347)':'#FFF')+';color:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'#FFF':'#000')+';box-shadow:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'0 4px 12px rgba(52,199,89,0.3)':'0 2px 6px rgba(0,0,0,0.05)')+';transition:all 0.2s;">' + ((post.metadata.participations||{})[(S.user||{}).id]==='yes' ? '👍 Confirmé' : '👍 Je participe') + '</button>' +
            '<button onclick="App.toggleParticipation(\''+post.id+'\',\'no\')" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:800;border:none;cursor:pointer;background:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'linear-gradient(135deg,#FF3B30,#D70015)':'#FFF')+';color:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'#FFF':'#000')+';box-shadow:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'0 4px 12px rgba(255,59,48,0.3)':'0 2px 6px rgba(0,0,0,0.05)')+';transition:all 0.2s;">' + ((post.metadata.participations||{})[(S.user||{}).id]==='no' ? '❌ Indisponible' : '❌ Non dispo') + '</button>' +
          '</div>' +
        '</div>';
      } else if (post.type === 'EVALUATION' && post.metadata && post.metadata.teamName) {
         contentZone = '<div style="margin:10px 14px;padding:18px;background:linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);border-radius:20px;border:1px solid #E2E8F0;box-shadow:inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.03);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<div>' +
              '<div style="display:inline-flex;align-items:center;gap:4px;background:#FFF;padding:4px 8px;border-radius:8px;font-size:10px;font-weight:800;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);"><span>📊</span> Évaluation</div>' +
              '<div style="font-size:20px;font-weight:900;color:#0F172A;letter-spacing:-0.5px;">' + safeHtml(post.metadata.teamName || '') + '</div>' +
            '</div>' +
            '<div style="background:' + (post.metadata.globalScore>=4?'linear-gradient(135deg,#DCFCE7,#22C55E)':post.metadata.globalScore>=2?'linear-gradient(135deg,#FEF3C7,#F59E0B)':'linear-gradient(135deg,#FEE2E2,#EF4444)') + ';color:#FFF;padding:12px 16px;border-radius:16px;font-size:24px;font-weight:900;box-shadow:0 6px 16px ' + (post.metadata.globalScore>=4?'rgba(34,197,94,0.3)':post.metadata.globalScore>=2?'rgba(245,158,11,0.3)':'rgba(239,68,68,0.3)') + ';text-shadow:0 2px 4px rgba(0,0,0,0.1);">' + post.metadata.globalScore + '/5</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            (post.metadata.criteria ? Object.keys(post.metadata.criteria).map(function(k) {
              var v = post.metadata.criteria[k];
              var pct = (v/5)*100;
              var cCol = v>=4?'linear-gradient(90deg,#34D399,#10B981)':v>=2?'linear-gradient(90deg,#FBBF24,#F59E0B)':'linear-gradient(90deg,#F87171,#EF4444)';
              return '<div style="display:flex;flex-direction:column;gap:6px;">' +
                       '<div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;color:#475569;"><span>' + safeHtml(k) + '</span><span style="color:#0F172A;">' + v + '/5</span></div>' +
                       '<div style="height:10px;background:#E2E8F0;border-radius:5px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.06);">' +
                         '<div style="height:100%;width:' + pct + '%;background:' + cCol + ';border-radius:5px;transition:width 1s cubic-bezier(0.34, 1.56, 0.64, 1);box-shadow:0 1px 2px rgba(0,0,0,0.1);"></div>' +
                       '</div>' +
                     '</div>';
            }).join('') : '') +
          '</div>' +
          '<p style="font-size:13px;color:#334155;margin:14px 0 0;line-height:1.4;">' + safeHtml(post.caption||'') + '</p>' +
        '</div>';
      } else {
         // For standard posts: only the media zone goes in contentZone.
         // The caption is rendered separately in finalHtml below.
         contentZone = mediaZone;
      }
      
    var finalHtml = '<article id="post-'+post.id+'" style="background:#FFF;margin-bottom:10px;">' +
      pinnedBadge +
      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;">' +
        '<div onclick="App.openUserProfile(\'' + post.userId + '\')" style="display:flex;align-items:center;gap:10px;cursor:pointer;">' +
          '<div style="width:40px;height:40px;border-radius:20px;background:linear-gradient(135deg,' + (post.avatarColor||'#007AFF') + ',#0040CC);color:#FFF;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (post.authorAvatar||'M') + '</div>' +
          '<div>' +
            '<div style="font-size:13.5px;font-weight:700;color:#000;">' + safeHtml(post.author||'Membre') + '</div>' +
            '<div style="font-size:11.5px;color:#8E8E93;display:flex;align-items:center;gap:4px;">' +
              '<span style="color:' + sec.color + ';font-weight:600;">' + sec.emoji + ' ' + (post.sectionNom||'') + '</span>' +
              '<span>·</span><span>' + ago + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button onclick="App.openOptions(\'' + post.id + '\')" style="background:#F2F2F7;border:none;width:32px;height:32px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' + SVG.dots + '</button>' +
      '</div>' +
      contentZone +
      // Actions row
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px 6px;">' +
        '<div style="display:flex;gap:14px;align-items:center;">' +
          '<button id="likeBtn-'+post.id+'" onclick="App.like(\''+post.id+'\')" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;transition:transform 0.1s;" onmousedown="this.style.transform=\'scale(0.85)\'" onmouseup="this.style.transform=\'scale(1)\'">' + SVG.heart(iLiked, 26) + '</button>' +
          '<button onclick="App.openComments(\''+post.id+'\')" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;">' + SVG.comment + '</button>' +
          '<button onclick="App.share(\''+post.id+'\')" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;">' + SVG.share + '</button>' +
        '</div>' +
        '<button id="saveBtn-'+post.id+'" onclick="App.save(\''+post.id+'\')" style="background:none;border:none;padding:2px;cursor:pointer;display:flex;align-items:center;">' + SVG.bookmark(iSaved) + '</button>' +
      '</div>' +

      // Like count
      '<div style="padding:0 14px 5px;">' +
        '<div id="likeCount-'+post.id+'" style="font-size:13.5px;font-weight:700;color:#000;">' +
          (likeCount > 0 ? likeCount + ' j\'aime' : 'Soyez le premier à aimer') +
        '</div>' +
      '</div>' +

      // Caption
      '<div style="padding:0 14px 10px;">' +
        '<p style="font-size:14px;color:#000;margin:0;line-height:1.45;">' +
          '<strong>' + safeHtml(post.author||'') + '</strong> ' + captionHtml +
        '</p>' +
        (post.comments && post.comments.length > 0
          ? '<button onclick="App.openComments(\''+post.id+'\')" style="background:none;border:none;padding:0;margin-top:5px;font-size:13.5px;color:#8E8E93;cursor:pointer;">Voir les '+post.comments.length+' commentaire'+(post.comments.length>1?'s':'')+'</button>'
          : '<button onclick="App.openComments(\''+post.id+'\')" style="background:none;border:none;padding:0;margin-top:5px;font-size:13.5px;color:#8E8E93;cursor:pointer;">Ajouter un commentaire…</button>'
        ) +
        '<div style="font-size:11px;color:#C7C7CC;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;">' + ago + '</div>' +
      '</div>' +

    '</article>';
    return finalHtml;
  }

  // ============================================================
  // CREATE POST MODAL
  // ============================================================

  function renderCreateEventModal() {
    var today = new Date().toISOString().split('T')[0];
    return '<div style="position:fixed;inset:0;background:#FFF;z-index:10000;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      '<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #E5E5EA;background:#FFF;z-index:2;">' +
        '<button onclick="App.closeCreateEvent()" style="background:none;border:none;font-size:16px;color:#000;cursor:pointer;">Annuler</button>' +
        '<div style="font-weight:700;font-size:16px;">Nouvel Événement</div>' +
        '<button onclick="App.saveEvent(this)" style="background:none;border:none;font-size:16px;font-weight:700;color:#007AFF;cursor:pointer;">Créer</button>' +
      '</header>' +
      '<div style="flex:1;overflow-y:auto;background:#FAFAFA;padding:16px;">' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
              '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Titre de l\'événement</label>' +
              '<input type="text" id="eventTitle" placeholder="Ex: Culte de Dimanche" style="border:none;border-bottom:1px solid #E5E5EA;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;font-weight:600;" />' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:4px;">' +
              '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Lieu / Salle</label>' +
              '<input type="text" id="eventLocation" placeholder="Ex: Salle Principale" style="border:none;border-bottom:1px solid #E5E5EA;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E5E5EA;padding-bottom:12px;">' +
              '<label style="font-size:15px;color:#000;font-weight:600;">Date</label>' +
              '<input type="date" id="eventDate" value="' + today + '" style="border:none;font-size:16px;outline:none;background:transparent;color:#007AFF;font-weight:600;" />' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E5E5EA;padding-bottom:12px;">' +
              '<label style="font-size:15px;color:#000;font-weight:600;">Heure de début</label>' +
              '<input type="time" id="eventStart" value="09:00" style="border:none;font-size:16px;outline:none;background:transparent;color:#007AFF;font-weight:600;" />' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<label style="font-size:15px;color:#000;font-weight:600;">Heure de fin</label>' +
              '<input type="time" id="eventEnd" value="11:30" style="border:none;font-size:16px;outline:none;background:transparent;color:#007AFF;font-weight:600;" />' +
            '</div>' +
          '</div>' +
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:12px;">Pôles concernés</label>' +
          App.renderSectionBadges(S.eventSections, 'toggleEventSection') + 
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
          '<label style="font-size:13px;color:#8E8E93;font-weight:600;display:block;margin-bottom:8px;">Description / Notes</label>' +
          '<textarea id="eventDesc" placeholder="Ajoutez un briefing ou des notes pour les équipes..." style="width:100%;border:none;font-size:15px;outline:none;resize:none;font-family:inherit;min-height:80px;background:#F8F8F8;padding:12px;border-radius:12px;box-sizing:border-box;"></textarea>' +
        '</div>' +
        
        '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:space-between;">' +
          '<div>' +
            '<div style="font-size:15px;font-weight:600;color:#000;">Épingler en haut du Feed</div>' +
            '<div style="font-size:12px;color:#8E8E93;margin-top:2px;">Rend l\'événement très visible</div>' +
          '</div>' +
          '<label style="position:relative;display:inline-block;width:50px;height:30px;">' +
            '<input type="checkbox" id="eventPinned" style="opacity:0;width:0;height:0;" onchange="this.nextElementSibling.style.background=this.checked?\'#34C759\':\'#E5E5EA\'; this.nextElementSibling.children[0].style.transform=this.checked?\'translateX(20px)\':\'translateX(0)\';">' +
            '<span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#E5E5EA;transition:.3s;border-radius:30px;">' +
              '<span style="position:absolute;content:\'\';height:26px;width:26px;left:2px;bottom:2px;background-color:white;transition:.3s;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>' +
            '</span>' +
          '</label>' +
        '</div>' +

      '</div>' +
    '</div>';
  }
  function renderCreateModal(u) {
    var previewHtml = '';
    if (S.pendingMedia.length > 0) {
      previewHtml = '<div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:12px;padding-bottom:4px;">' +
        S.pendingMedia.map(function(url, i) {
          return '<div style="position:relative;flex-shrink:0;width:72px;height:72px;border-radius:12px;overflow:hidden;border:2px solid #E5E5EA;">' +
            '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;">' +
            '<button type="button" onclick="App.removeMedia('+i+')" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,0.7);border:none;border-radius:8px;width:18px;height:18px;color:#FFF;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;">×</button>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    var hashHtml = '<div id="hashSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#F0F6FF;border:1px solid #CCDEFF;border-radius:14px;padding:10px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:800;color:#007AFF;width:100%;margin-bottom:4px;">Hashtags suggérés :</div>' +
      HASHTAGS.map(function(h) {
        return '<button type="button" onclick="App.insertTag(\''+h+'\')" style="background:#007AFF;color:#FFF;border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">'+h+'</button>';
      }).join('') +
    '</div>';

    return '<div onclick="App.closeCreate()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;max-height:92vh;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +

        '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeCreate()">' +
          '<div style="width:40px;height:4px;background:#D1D1D6;border-radius:2px;"></div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px 10px;border-bottom:0.5px solid #F2F2F7;">' +
          '<span onclick="App.closeCreate()" style="font-size:15px;color:#007AFF;cursor:pointer;font-weight:600;">Annuler</span>' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#000;">Nouvelle publication</h3>' +
          '<button type="submit" form="createPostForm" style="font-size:15px;color:#007AFF;font-weight:800;background:none;border:none;cursor:pointer;">Publier</button>' +
        '</div>' +

        '<div style="overflow-y:auto;flex:1;padding:16px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
            '<div style="width:40px;height:40px;border-radius:20px;background:linear-gradient(135deg,' + ((u||{}).avatar_color||'#007AFF') + ',#0040CC);color:#FFF;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ((u&&u.prenom||'M').charAt(0)) + '</div>' +
            '<div>' +
              '<div style="font-size:14px;font-weight:700;color:#000;">' + safeHtml((u&&u.prenom||'') + ' ' + (u&&u.nom||'')) + '</div>' +
              '<div style="font-size:11.5px;color:#007AFF;font-weight:600;">' + secNom((u&&u.section_id)||'cadrage') + ' · Tapez # pour les hashtags</div>' +
            '</div>' +
          '</div>' +

          hashHtml +
          previewHtml +

          '<form id="createPostForm" onsubmit="App.submitPost(event)">' +
            '<textarea id="newPostText" oninput="App.onPostInput(this.value)" placeholder="Quoi de neuf ? Tapez # pour ajouter un hashtag de section..." style="width:100%;min-height:110px;border:none;background:transparent;font-size:15px;line-height:1.5;color:#000;resize:none;outline:none;box-sizing:border-box;font-family:inherit;"></textarea>' +
          '</form>' +
        '</div>' +

        '<div style="border-top:0.5px solid #F2F2F7;padding:10px 16px;display:flex;gap:14px;align-items:center;">' +
          '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;color:#007AFF;font-size:13px;font-weight:700;">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
            'Photo' +
            '<input type="file" accept="image/*" multiple onchange="App.addMedia(event)" style="display:none;">' +
          '</label>' +
          '<span style="color:#8E8E93;font-size:13px;">|</span>' +
          '<span style="font-size:12px;color:#8E8E93;">' + S.pendingMedia.length + '/10 photos</span>' +
        '</div>' +

      '</div>' +
    '</div>';
  }

  // ============================================================
  // OPTIONS MODAL
  // ============================================================
  function renderOptionsModal() {
    var post = S.optionsPost;
    if (!post) return '';
    var u = S.user || {};
    var canDelete = u.role === 'GRAND_RESPONSABLE' || post.userId === u.id;

    return '<div onclick="App.closeOptions()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;padding:12px 16px 24px;animation:slideUp 0.25s;">' +
        '<div style="display:flex;justify-content:center;margin-bottom:16px;"><div style="width:40px;height:4px;background:#D1D1D6;border-radius:2px;"></div></div>' +
        '<p style="text-align:center;font-size:12px;color:#8E8E93;margin:0 0 14px;font-weight:600;">' + safeHtml(post.author||'Publication') + '</p>' +

        // Share
        '<button onclick="App.share(\''+post.id+'\');App.closeOptions();" style="width:100%;background:#F8F8F8;border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.share + '<span style="font-size:15px;font-weight:600;color:#000;">Partager</span>' +
        '</button>' +

        // Save / Unsave
        '<button onclick="App.save(\''+post.id+'\');App.closeOptions();" style="width:100%;background:#F8F8F8;border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.bookmark(S.savedPosts[post.id]) +
          '<span style="font-size:15px;font-weight:600;color:#000;">' + (S.savedPosts[post.id] ? 'Retirer des favoris' : 'Enregistrer') + '</span>' +
        '</button>' +

        (canDelete
          ? '<button onclick="App.deletePost(\''+post.id+'\')" style="width:100%;background:#FFF5F5;border:1px solid #FFE0E0;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              SVG.trash + '<span style="font-size:15px;font-weight:700;color:#FF3B30;">Supprimer</span>' +
            '</button>'
          : '') +

        '<button onclick="App.closeOptions()" style="width:100%;background:#F2F2F7;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:700;color:#007AFF;cursor:pointer;">Annuler</button>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // COMMENTS MODAL — Bottom Sheet
  // ============================================================
  function renderCommentsModal(allPosts, userInitial) {
    var post = allPosts.find(function(p){ return p.id === S.commentPostId; });
    if (!post) return '';
    var u = S.user || {};

    var commentItems = post.comments && post.comments.length > 0
      ? post.comments.map(function(c) { return renderCommentItem(c); }).join('')
      : '<div style="display:flex;flex-direction:column;align-items:center;padding:44px 20px;text-align:center;"><div style="font-size:44px;margin-bottom:10px;">💬</div><strong style="font-size:15px;color:#000;">Aucun commentaire</strong><p style="font-size:13px;color:#8E8E93;margin:4px 0 0;">Soyez le premier à commenter !</p></div>';

    var emojis = ['❤️','👏','🔥','🙌','😍','😂','😮','💪'];

    return '<div onclick="App.closeComments()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;height:82vh;display:flex;flex-direction:column;animation:slideUp 0.3s;">' +

        '<div onclick="App.closeComments()" style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;">' +
          '<div style="width:40px;height:4px;background:#D1D1D6;border-radius:2px;"></div>' +
        '</div>' +

        '<div style="text-align:center;padding-bottom:12px;border-bottom:0.5px solid #F2F2F7;">' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#000;">Commentaires</h3>' +
          (post.comments && post.comments.length > 0 ? '<p style="font-size:12px;color:#8E8E93;margin:2px 0 0;">'+post.comments.length+' commentaire'+(post.comments.length>1?'s':'')+'</p>' : '') +
        '</div>' +

        '<div id="commentsList" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 14px;">' +
          commentItems +
        '</div>' +

        '<div style="border-top:0.5px solid #F2F2F7;">' +
          '<div style="display:flex;justify-content:space-around;padding:8px 14px;border-bottom:0.5px solid #F7F7F7;">' +
            emojis.map(function(e) {
              return '<span onclick="App.addEmoji(\''+e+'\')" style="font-size:22px;cursor:pointer;padding:3px 2px;-webkit-tap-highlight-color:transparent;">'+e+'</span>';
            }).join('') +
          '</div>' +
          '<form onsubmit="App.submitComment(event)" style="display:flex;align-items:center;gap:10px;padding:10px 14px;">' +
            '<div style="width:34px;height:34px;border-radius:17px;background:linear-gradient(135deg,' + (u.avatar_color||'#007AFF') + ',#0040CC);color:#FFF;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + userInitial + '</div>' +
            '<div style="flex:1;display:flex;align-items:center;background:#F2F2F7;border-radius:22px;height:40px;padding:0 14px;">' +
              '<input id="commentInput" type="text" placeholder="Ajouter un commentaire…" style="flex:1;border:none;background:transparent;font-size:14px;color:#000;outline:none;" required>' +
              '<button type="submit" style="background:none;border:none;padding:0 0 0 8px;cursor:pointer;display:flex;align-items:center;">' + SVG.send + '</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderCommentItem(c) {
    var likedComments = db(SK.LIKED_COMMENTS, {});
    var isLiked = !!likedComments[c.id];
    return '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:16px;">' +
      '<div onclick="App.openUserProfile(\'' + c.userId + '\')" style="cursor:pointer;width:36px;height:36px;border-radius:18px;background:linear-gradient(135deg,' + (c.avatarColor||'#007AFF') + ',#0040CC);color:#FFF;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ((c.author||'U').charAt(0)) + '</div>' +
      '<div style="flex:1;">' +
        '<div style="display:flex;align-items:baseline;gap:6px;">' +
          '<strong onclick="App.openUserProfile(\'' + c.userId + '\')" style="cursor:pointer;font-size:13.5px;color:#000;">' + safeHtml(c.author||'Membre') + '</strong>' +
          '<span style="font-size:11.5px;color:#8E8E93;">' + timeAgo(c.timestamp) + '</span>' +
        '</div>' +
        '<p style="font-size:14px;color:#1C1C1E;margin:3px 0 5px;line-height:1.4;">' + hashtagify(c.text) + '</p>' +
        '<button style="background:none;border:none;padding:0;font-size:12px;font-weight:700;color:#8E8E93;cursor:pointer;">Répondre</button>' +
      '</div>' +
      '<div id="clike-'+c.id+'" onclick="App.likeComment(\''+c.id+'\')" style="cursor:pointer;padding:4px;margin-top:2px;">' +
        SVG.heart(isLiked, 15) +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // PLANNING TAB
  // ============================================================
  function renderPlanning() {
    if (!S.selectedDate) {
      S.selectedDate = new Date().toISOString().split('T')[0];
    }
    
    var baseDate = new Date(); // Today
    var dates = [];
    for(var i = -1; i < 6; i++) {
      var d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(d);
    }

    var canCreate = S.user && (S.user.role === 'RESP_SECTION' || S.user.role === 'GRAND_RESPONSABLE');
    
    var header = '<header style="padding:16px 16px 0;background:#FFF;display:flex;justify-content:space-between;align-items:center;">' +
        '<div>' +
          '<h1 style="font-size:28px;font-weight:900;color:#000;margin:0;letter-spacing:-0.5px;">Planning</h1>' +
        '</div>' +
        (canCreate ? '<button onclick="App.openCreateEvent()" style="background:#000;color:#FFF;border:none;border-radius:20px;padding:8px 16px;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Événement</button>' : '') +
      '</header>';

    // Date Slider
    var slider = '<div style="background:#FFF;padding:16px;border-bottom:1px solid #E5E5EA;display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;">' +
      dates.map(function(d) {
        var iso = d.toISOString().split('T')[0];
        var isSel = (iso === S.selectedDate);
        var dayName = d.toLocaleDateString('fr-FR', {weekday:'short'}).toUpperCase();
        var dayNum = d.getDate();
        var bg = isSel ? '#000' : '#F2F2F7';
        var col = isSel ? '#FFF' : '#8E8E93';
        var numCol = isSel ? '#FFF' : '#000';
        return '<div onclick="App.selectDate(\''+iso+'\')" style="min-width:54px;height:70px;border-radius:16px;background:'+bg+';display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:0.2s;">' +
          '<span style="font-size:11px;font-weight:700;color:'+col+';margin-bottom:4px;">'+dayName+'</span>' +
          '<span style="font-size:20px;font-weight:800;color:'+numCol+';">'+dayNum+'</span>' +
        '</div>';
      }).join('') +
    '</div>';

    var allPosts = db(SK.POSTS, []);
    var dayEvents = allPosts.filter(function(p) { 
      return p.type === 'EVENT' && p.eventDate === S.selectedDate;
    }).sort(function(a,b) {
      if (a.eventStart && b.eventStart) return a.eventStart.localeCompare(b.eventStart);
      return 0;
    });

    var timeline = '<div style="padding:20px 16px;min-height:50vh;background:#FAFAFA;">';
    
    if (dayEvents.length === 0) {
      timeline += '<div style="text-align:center;padding:40px 20px;color:#8E8E93;">' +
        '<div style="font-size:40px;margin-bottom:12px;">📅</div>' +
        '<div style="font-size:18px;font-weight:700;color:#000;">Aucun événement</div>' +
        '<div style="font-size:14px;margin-top:4px;">Rien de prévu pour cette date.</div>' +
      '</div>';
    } else {
      var nowIso = new Date().toISOString().split('T')[0];
      var nowTime = new Date().toTimeString().slice(0,5); // HH:MM
      
      dayEvents.forEach(function(ev) {
        var status = 'upcoming';
        var statusHtml = '';
        if (ev.eventDate < nowIso) status = 'closed';
        else if (ev.eventDate === nowIso) {
          if (nowTime >= ev.eventStart && nowTime <= ev.eventEnd) status = 'active';
          else if (nowTime > ev.eventEnd) status = 'closed';
        }

        if (status === 'active') {
          statusHtml = '<div style="display:inline-flex;align-items:center;gap:4px;background:#E5F4E9;color:#28A347;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;"><div style="width:6px;height:6px;border-radius:3px;background:#28A347;animation:blink 1.5s infinite;"></div>En cours</div>';
        } else if (status === 'closed') {
          statusHtml = '<div style="display:inline-block;background:#F2F2F7;color:#8E8E93;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;">✅ Terminé</div>';
        }

        var secTags = (ev.eventSections || []).map(function(s){
          return '<span style="font-size:12px;font-weight:700;color:#007AFF;">' + secNom(s) + '</span>';
        }).join('<span style="color:#D1D1D6;margin:0 4px;">•</span>');

        timeline += '<div style="display:flex;margin-bottom:24px;">' +
          '<div style="width:60px;flex-shrink:0;text-align:right;padding-right:12px;padding-top:2px;">' +
            '<div style="font-size:14px;font-weight:800;color:#000;">' + (ev.eventStart||'--:--') + '</div>' +
            '<div style="font-size:12px;font-weight:600;color:#8E8E93;margin-top:2px;">' + (ev.eventEnd||'--:--') + '</div>' +
          '</div>' +
          '<div style="position:relative;padding-left:16px;border-left:2px solid ' + (status==='active'?'#28A347':(status==='closed'?'#E5E5EA':'#000')) + ';flex:1;">' +
            '<div style="position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:5px;background:' + (status==='active'?'#28A347':(status==='closed'?'#E5E5EA':'#000')) + ';border:2px solid #FAFAFA;"></div>' +
            '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1px solid #F2F2F7;">' +
              statusHtml +
              '<h3 style="font-size:17px;font-weight:800;color:#000;margin:0 0 6px;">' + safeHtml(ev.eventTitle) + '</h3>' +
              (secTags ? '<div style="margin-bottom:8px;">' + secTags + '</div>' : '') +
              '<div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#8E8E93;margin-bottom:12px;font-weight:600;">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                safeHtml(ev.eventLocation || 'Non défini') +
              '</div>' +
              (ev.caption ? '<p style="font-size:13px;color:#3A3A3C;margin:0 0 16px;line-height:1.4;">' + safeHtml(ev.caption) + '</p>' : '') +
              '<button onclick="toast(\'Participation enregistrée !\', \'success\')" style="width:100%;background:' + (status==='closed'?'#F2F2F7':'#E5F0FF') + ';color:' + (status==='closed'?'#8E8E93':'#007AFF') + ';border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">' + (status==='closed'?'Terminé':'Je participe 👍') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
    }
    
    timeline += '</div>';

    return header + slider + timeline;
  }
  // ============================================================
  // DEBRIEF TAB
  // ============================================================
  function renderDebrief(u) {
    var userSec = (u && u.section_id) || '';

    return '<header style="padding:16px 18px;background:#FFF;border-bottom:0.5px solid #F2F2F7;">' +
        '<div style="font-size:11px;font-weight:800;color:#007AFF;text-transform:uppercase;letter-spacing:1.3px;margin-bottom:3px;">Évaluation Inter-Sections</div>' +
        '<h1 style="font-size:24px;font-weight:900;color:#000;margin:0;">Notation & Débrief</h1>' +
      '</header>' +

      '<div style="padding:16px;">' +
        '<p style="font-size:13.5px;color:#8E8E93;margin:0 0 16px;line-height:1.5;">Notez les performances des autres sections. La notation de votre propre section est interdite.</p>' +

        SECTIONS.map(function(sec) {
          var blocked = sec.id === userSec;
          var r = S.ratings[sec.id] || { score: 0, comment: '' };
          if (blocked) {
            return '<div style="background:#F8F8FC;border-radius:18px;padding:14px;margin-bottom:10px;border:1px solid #EFEFEF;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;">' +
                '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:22px;">' + sec.emoji + '</span><strong style="color:#8E8E93;font-size:14px;">' + sec.nom + '</strong></div>' +
                '<span style="background:#FFEBEA;color:#FF3B30;font-size:11px;font-weight:800;padding:5px 10px;border-radius:20px;">Votre section</span>' +
              '</div></div>';
          }
          var scoreColor = r.score >= 4 ? '#34C759' : r.score >= 2 ? '#FF9500' : r.score > 0 ? '#FF3B30' : '#C7C7CC';
          return '<div style="background:#FFF;border-radius:18px;padding:16px;margin-bottom:10px;border:1px solid #EFEFEF;box-shadow:0 2px 8px rgba(0,0,0,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,' + sec.color + '20,' + sec.color + '10);display:flex;align-items:center;justify-content:center;font-size:20px;">' + sec.emoji + '</div>' +
                '<div><strong style="font-size:14.5px;color:#000;display:block;">' + sec.nom + '</strong>' +
                '<span style="font-size:11.5px;color:#8E8E93;">Cliquez pour noter</span></div>' +
              '</div>' +
              '<div style="font-size:20px;font-weight:900;color:' + scoreColor + ';">' + (r.score > 0 ? r.score+'/5' : '—') + '</div>' +
            '</div>' +
            '<div id="stars-'+sec.id+'" style="display:flex;gap:6px;margin-bottom:12px;">' +
              [1,2,3,4,5].map(function(star) {
                return '<button type="button" onclick="App.rate(\''+sec.id+'\','+star+')" style="font-size:28px;cursor:pointer;background:none;border:none;padding:0;transition:transform 0.1s;color:' + (star<=r.score?'#FFD700':'#D1D1D6') + ';" onmousedown="this.style.transform=\'scale(1.2)\'" onmouseup="this.style.transform=\'scale(1)\'">★</button>';
              }).join('') +
            '</div>' +
            '<input type="text" value="' + safeHtml(r.comment||'') + '" onchange="App.rateComment(\''+sec.id+'\',this.value)" placeholder="Ajouter une observation..." ' +
            'style="width:100%;height:40px;border:1.5px solid #EFEFEF;border-radius:12px;padding:0 12px;font-size:13.5px;color:#000;box-sizing:border-box;outline:none;background:#FAFAFA;" ' +
            'onfocus="this.style.borderColor=\'#007AFF\'" onblur="this.style.borderColor=\'#EFEFEF\'">' +
          '</div>';
        }).join('') +

          '<button onclick="App.publishBilan()" style="width:100%;background:linear-gradient(135deg,#34C759,#28A347);color:#FFF;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(52,199,89,0.3);">Valider & Publier le Bilan ✓</button>' +
        '</div>' +

      '</div>';
  }

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
    sessionStorage.setItem(SK.SESS, JSON.stringify(S.user));
    dbSet(SK.USERS, users);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    } catch(e) { return iso; }
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) +
             ' à ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    } catch(e) { return iso; }
  }

  function infoRow(icon, label, val) {
    return '<div style="display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:0.5px solid #F7F7F7;">' +
      '<span style="font-size:18px;width:24px;text-align:center;">' + icon + '</span>' +
      '<div style="flex:1;">' +
        '<div style="font-size:11.5px;color:#8E8E93;font-weight:600;margin-bottom:1px;">' + label + '</div>' +
        '<div style="font-size:14px;color:#000;font-weight:600;">' + val + '</div>' +
      '</div>' +
    '</div>';
  }

  function adminKpi(icon, val, label) {
    return '<div style="background:rgba(255,255,255,0.12);border-radius:14px;padding:10px;text-align:center;">' +
      '<div style="font-size:16px;">' + icon + '</div>' +
      '<strong style="font-size:22px;font-weight:900;color:#FFF;display:block;">' + val + '</strong>' +
      '<span style="font-size:10.5px;color:rgba(255,255,255,0.6);">' + label + '</span>' +
    '</div>';
  }

  function adminMiniInfo(icon, text, color) {
    return '<div style="background:#FFF;border-radius:10px;padding:8px 10px;display:flex;align-items:center;gap:6px;">' +
      '<span style="font-size:13px;">' + icon + '</span>' +
      '<span style="font-size:12px;font-weight:700;color:' + (color||'#000') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + text + '</span>' +
    '</div>';
  }

  // ============================================================
  // PROFILE TAB
  // ============================================================
  function renderProfile(u, posts) {
    if (!u) return '<div style="padding:40px;text-align:center;">Chargement...</div>';
    var allProfiles = db(SK.USERS, []);
    var freshU = allProfiles.find(function(p){ return p.id === u.id; }) || u;
    
    var isMe = S.user && S.user.id === freshU.id;
    
    var ROLE_LABELS = {
      GRAND_RESPONSABLE: 'Grand Resp.',
      RESP_SECTION: 'Responsable',
      MEMBRE: 'Membre',
      STAGIAIRE: 'Stagiaire'
    };
    
    var myPosts = posts.filter(function(p){ return p.userId === freshU.id; }).sort(function(a,b){return (b.timestamp||0)-(a.timestamp||0)});
    var myLikes = posts.filter(function(p){ return Array.isArray(p.likedBy) && p.likedBy.indexOf(freshU.id) !== -1; });
    var myComments = 0;
    posts.forEach(function(p){ myComments += (p.comments||[]).filter(function(c){ return c.userId === freshU.id; }).length; });

    var avatarContent = freshU.avatar_url 
      ? '<img src="' + freshU.avatar_url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
      : '<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,'+(freshU.avatar_color||'#007AFF')+',#0040CC);color:#FFF;font-size:32px;font-weight:900;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';

    var header = '<header style="padding:12px 16px;background:#FFF;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E5E5EA;position:sticky;top:0;z-index:20;">' +
      (isMe 
        ? '<div style="font-size:18px;font-weight:900;color:#000;letter-spacing:-0.5px;">' + safeHtml(freshU.prenom) + '_kun</div>' +
          '<button onclick="App.logout()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#000;">≡</button>'
        : '<button onclick="App.closeUserProfile()" style="background:none;border:none;font-size:16px;font-weight:600;color:#007AFF;cursor:pointer;display:flex;align-items:center;gap:4px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Retour</button>' +
          '<div style="font-size:16px;font-weight:800;color:#000;letter-spacing:-0.5px;">' + safeHtml(freshU.prenom) + '</div><div style="width:70px;"></div>'
      ) +
    '</header>';

    var coverContent = freshU.cover_url
      ? '<img src="' + freshU.cover_url + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '<div style="width:100%;height:100%;background:linear-gradient(135deg, #E5E5EA 0%, #D1D1D6 100%);"></div>';

    var topSection = '<div style="background:#FFF;position:relative;">' +
      '<div style="width:100%;height:160px;position:relative;">' + 
        coverContent + 
        (isMe ? '<div onclick="App.openEditProfile()" style="position:absolute;bottom:12px;right:12px;width:32px;height:32px;border-radius:16px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);color:#FFF;display:flex;align-items:center;justify-content:center;cursor:pointer;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>' : '') +
      '</div>' +
      '<div style="padding:0 16px 20px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:-40px;margin-bottom:12px;">' +
          '<div style="width:90px;height:90px;border-radius:45px;border:4px solid #FFF;background:#FFF;position:relative;overflow:hidden;flex-shrink:0;">' +
            avatarContent +
          '</div>' +
          (isMe ? '<button onclick="App.openEditProfile()" style="background:#F2F2F7;border:none;border-radius:20px;padding:8px 16px;font-size:14px;font-weight:700;cursor:pointer;color:#000;">Éditer profil</button>' : '') +
        '</div>' +
        
        '<div>' +
          '<div style="font-size:22px;font-weight:900;color:#000;margin-bottom:2px;letter-spacing:-0.5px;">' + safeHtml(freshU.prenom + ' ' + freshU.nom) + '</div>' +
          '<div style="font-size:13px;color:#8E8E93;margin-bottom:12px;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">' +
            (function(){
              var uSecs = App.getUserSections(freshU);
              return uSecs.map(function(s){ return '<span style="background:#F2F2F7;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;color:#000;">' + secNom(s) + '</span>'; }).join('');
            })() + 
            '<span style="background:#E5F0FF;color:#007AFF;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">' + (ROLE_LABELS[freshU.role]||'Membre') + '</span>' +
          '</div>' +
          (freshU.bio ? '<div style="font-size:14px;line-height:1.4;white-space:pre-wrap;color:#000;margin-bottom:16px;">' + safeHtml(freshU.bio) + '</div>' : '') +
        '</div>' +

        '<div style="display:flex;gap:24px;border-top:1px solid #F2F2F7;padding-top:16px;">' +
          '<div><strong style="font-size:16px;color:#000;">' + myPosts.length + '</strong> <span style="font-size:14px;color:#8E8E93;">Posts</span></div>' +
          '<div><strong style="font-size:16px;color:#000;">' + myLikes.length + '</strong> <span style="font-size:14px;color:#8E8E93;">J\'aime</span></div>' +
          '<div><strong style="font-size:16px;color:#000;">' + myComments + '</strong> <span style="font-size:14px;color:#8E8E93;">Commentaires</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';

    var separator = '<div style="background:#F2F2F7;padding:12px 16px;font-size:12px;font-weight:800;color:#8E8E93;letter-spacing:1px;text-transform:uppercase;">Publications</div>';

    var feed = '<div style="background:#F2F2F7;min-height:30vh;padding-bottom:100px;">';
    if (myPosts.length === 0) {
      feed += '<div style="padding:40px 20px;text-align:center;color:#8E8E93;">' +
        '<div style="font-size:40px;margin-bottom:16px;">📝</div>' +
        '<strong style="font-size:18px;color:#000;display:block;margin-bottom:8px;">Aucune publication pour le moment</strong>' +
        '<span style="font-size:14px;">Publiez pour les voir ici sur votre mur.</span>' +
      '</div>';
    } else {
      feed += myPosts.map(function(p) { return renderPostCard(p, false); }).join('');
    }
    feed += '</div>';

    return header + topSection + separator + feed;
  }

  function renderEditProfileModal(u) {
    var freshU = db(SK.USERS, []).find(function(p){ return p.id === u.id; }) || u;
    
    var avatarContent = freshU.avatar_url 
      ? '<img id="editAvatarPreview" src="' + freshU.avatar_url + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '<div id="editAvatarPreview" style="width:100%;height:100%;background:linear-gradient(135deg,'+(freshU.avatar_color||'#007AFF')+',#0040CC);color:#FFF;font-size:32px;font-weight:900;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';

    var coverContent = freshU.cover_url
      ? '<img src="' + freshU.cover_url + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '';

    return '<div style="position:fixed;inset:0;background:#FFF;z-index:10000;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      '<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #E5E5EA;background:#FFF;z-index:2;">' +
        '<button onclick="App.closeEditProfile()" style="background:none;border:none;font-size:16px;color:#000;cursor:pointer;">Annuler</button>' +
        '<div style="font-weight:700;font-size:16px;">Modifier le profil</div>' +
        '<button onclick="App.saveProfile(this)" style="background:none;border:none;font-size:16px;font-weight:700;color:#007AFF;cursor:pointer;">Terminer</button>' +
      '</header>' +
      '<div style="flex:1;overflow-y:auto;background:#FAFAFA;">' +
        
        '<!-- Cover Area -->' +
        '<div style="position:relative;width:100%;height:140px;background:linear-gradient(135deg, #E5E5EA 0%, #D1D1D6 100%);">' +
          '<div id="editCoverPreview" style="width:100%;height:100%;">' + coverContent + '</div>' +
          '<label style="position:absolute;bottom:12px;right:12px;width:32px;height:32px;border-radius:16px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);color:#FFF;display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
            '<input type="file" id="editCoverInput" accept="image/*" style="display:none;" onchange="App.handleCoverSelect(event)" />' +
          '</label>' +
        '</div>' +
        
        '<!-- Avatar Area -->' +
        '<div style="display:flex;justify-content:center;margin-top:-45px;margin-bottom:20px;">' +
          '<div style="position:relative;">' +
            '<div style="width:90px;height:90px;border-radius:45px;border:4px solid #FAFAFA;overflow:hidden;background:#FFF;">' +
               avatarContent +
            '</div>' +
            '<label style="position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:14px;background:#007AFF;border:2px solid #FAFAFA;color:#FFF;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.2);">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
              '<input type="file" id="editAvatarInput" accept="image/*" style="display:none;" onchange="App.handleAvatarSelect(event)" />' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div style="padding:0 16px 30px;">' +
          '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
            '<div style="display:flex;flex-direction:column;gap:16px;">' +
              '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Prénom</label>' +
                '<input type="text" id="editPrenom" value="' + safeHtml(freshU.prenom) + '" style="border:none;border-bottom:1px solid #E5E5EA;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
              '</div>' +
              '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Nom</label>' +
                '<input type="text" id="editNom" value="' + safeHtml(freshU.nom) + '" style="border:none;border-bottom:1px solid #E5E5EA;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
              '</div>' +
              '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Bio</label>' +
                '<textarea id="editBio" style="border:none;font-size:16px;outline:none;resize:none;font-family:inherit;min-height:60px;background:#F8F8F8;padding:12px;border-radius:12px;">' + safeHtml(freshU.bio||'') + '</textarea>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
            '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:12px;">Sections (2 max)</label>' +
            App.renderSectionBadges(S.editSections, 'toggleEditSection') + 
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
  }
  function renderPostOptionsModal(post) {
    if (!post) return '';
    var isMine = S.user && S.user.id === post.userId;
    return '<div onclick="App.closePostOptions()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:20px;border-top-right-radius:20px;padding:16px;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="width:40px;height:4px;background:#D1D1D6;border-radius:2px;margin:0 auto 20px;"></div>' +
        (isMine ? '<button onclick="App.deletePost(\''+post.id+'\')" style="width:100%;padding:14px;color:#FF3B30;font-size:16px;font-weight:600;background:#F2F2F7;border:none;border-radius:12px;margin-bottom:8px;cursor:pointer;">Supprimer le post</button>' : '') +
        '<button onclick="App.viewPost(\''+post.id+'\')" style="width:100%;padding:14px;color:#000;font-size:16px;font-weight:600;background:#F2F2F7;border:none;border-radius:12px;margin-bottom:8px;cursor:pointer;">Voir le post</button>' +
        '<button onclick="App.closePostOptions()" style="width:100%;padding:14px;color:#000;font-size:16px;font-weight:600;background:#F2F2F7;border:none;border-radius:12px;cursor:pointer;">Annuler</button>' +
      '</div>' +
    '</div>';
  }


  // ============================================================
  // APP CONTROLLER — toutes les actions
  // ============================================================
  window.App = {
    openCreateEvent: function() { S.createEventOpen = true; S.eventSections = []; render(); },
    closeCreateEvent: function() { S.createEventOpen = false; render(); },
    selectDate: function(d) { S.selectedDate = d; render(); },
    toggleEventSection: function(sec) {
      var idx = S.eventSections.indexOf(sec);
      if (idx !== -1) { S.eventSections.splice(idx, 1); }
      else { S.eventSections.push(sec); }
      render();
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
      if (supabase) {
        supabase.from('kun_com_posts').upsert([{ id: newPost.id, content: newPost }], { onConflict: 'id' }).then(function(){});
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
      render();
    },
    toggleEditSection: function(sec) {
      var idx = S.editSections.indexOf(sec);
      if (idx !== -1) { S.editSections.splice(idx, 1); }
      else {
        if (S.editSections.length >= 2) { toast('Maximum 2 sections autorisées.', 'error'); return; }
        S.editSections.push(sec);
      }
      render();
    },
    renderSectionBadges: function(selected, toggleFnName) {
      var sections = [
        {id:'cadrage', label:'Cadrage', icon:'🎥'},
        {id:'regie', label:'Régie', icon:'🎛️'},
        {id:'montage', label:'Montage', icon:'🎬'},
        {id:'web', label:'Web', icon:'🌐'},
        {id:'son', label:'Son', icon:'🎧'},
        {id:'photo', label:'Photo', icon:'📷'},
        {id:'light', label:'Lumière', icon:'💡'},
        {id:'proj', label:'Proj', icon:'🖥️'}
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
    resetPassword: function(e) {
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
        users[idx].pwd = newPwd;
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

    openEditProfile: function() { S.editProfileOpen = true; S.avatarFile = null; S.coverFile = null; S.editSections = App.getUserSections(S.user).slice(); render(); },
    closeEditProfile: function() { S.editProfileOpen = false; S.avatarFile = null; S.coverFile = null; render(); },
    handleAvatarSelect: function(e) {
      var file = e.target.files[0];
      if (file) {
        S.avatarFile = file;
        var reader = new FileReader();
        reader.onload = function(evt) {
          var el = document.getElementById('editAvatarPreview');
          if (el) {
            var parent = el.parentNode;
            parent.innerHTML = '<img id="editAvatarPreview" src="' + evt.target.result + '" style="width:100%;height:100%;object-fit:cover;" />';
          }
        };
        reader.readAsDataURL(file);
      }
    },
    handleCoverSelect: function(e) {
      var file = e.target.files[0];
      if (file) {
        S.coverFile = file;
        var reader = new FileReader();
        reader.onload = function(evt) {
          var el = document.getElementById('editCoverPreview');
          if (el) {
            el.innerHTML = '<img src="' + evt.target.result + '" style="width:100%;height:100%;object-fit:cover;" />';
          }
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
      
      try {
        if (S.avatarFile && supabase) {
          var ext = S.avatarFile.name.split('.').pop();
          var fileName = 'avatar_' + u.id + '_' + Date.now() + '.' + ext;
          var res = await supabase.storage.from('avatars').upload(fileName, S.avatarFile);
          if (res.error) throw res.error;
          var urlRes = supabase.storage.from('avatars').getPublicUrl(fileName);
          avatar_url = urlRes.data.publicUrl;
        }
        
        if (S.coverFile && supabase) {
          var ext2 = S.coverFile.name.split('.').pop();
          var fileName2 = 'cover_' + u.id + '_' + Date.now() + '.' + ext2;
          // You could use a 'covers' bucket or just 'avatars'. Assuming 'avatars' bucket is available.
          var res2 = await supabase.storage.from('avatars').upload(fileName2, S.coverFile);
          if (res2.error) throw res2.error;
          var urlRes2 = supabase.storage.from('avatars').getPublicUrl(fileName2);
          cover_url = urlRes2.data.publicUrl;
        }
      } catch(e) {
        console.error('Upload error:', e);
        toast('Erreur lors de l\'upload de l\'image', 'error');
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
      sessionStorage.setItem(SK.SESS, JSON.stringify(updatedUser));
      
      var users = db(SK.USERS, []);
      var idx = users.findIndex(function(x){ return x.id === u.id; });
      if (idx !== -1) {
        users[idx] = updatedUser;
      } else {
        users.push(updatedUser);
      }
      dbSet(SK.USERS, users);
      
      if (supabase) {
        await supabase.from('kun_com_profiles').upsert({ id: updatedUser.id, content: updatedUser }, { onConflict: 'id' });
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
    deletePost: async function(id) {
       if (!confirm("Voulez-vous vraiment supprimer cette publication ?")) return;
       var posts = db(SK.POSTS, []);
       posts = posts.filter(function(p){ return p.id !== id; });
       dbSet(SK.POSTS, posts);
       if (supabase) {
         try { await supabase.from('kun_com_posts').delete().eq('id', id); } catch(e){}
       }
       S.postOptionsOpen = false;
       S.selectedPostId = null;
       render();
       toast('Publication supprimée', 'success');
    },
    shareProfile: function() { toast('Fonction de partage bientôt disponible !'); },


    // Auth
    nav: function(v) { S.auth = v; render(); },
    login: function(e) {
      e && e.preventDefault();
      var email = (document.getElementById('loginEmail')||{}).value || '';
      var pwd = ((document.getElementById('loginPwd')||{}).value||'').trim();
      if (!email.trim()) { toast('Veuillez saisir votre e-mail.', 'error'); return; }
      var users = db(SK.USERS, []);
      var user = users.find(function(u){ return u.email.toLowerCase() === email.toLowerCase(); });
      if (!user) {
        var p = email.split('@')[0]; var parts = p.split('.');
        user = { id: 'u'+Date.now(), prenom: parts[0]&&parts[0].charAt(0).toUpperCase()+parts[0].slice(1)||'Membre', nom: parts[1]&&parts[1].charAt(0).toUpperCase()+parts[1].slice(1)||'COM', email: email, section_id:'cadrage', section_nom:'Cadrage', role:'RESP_SECTION', is_online:true, last_seen_at:new Date().toISOString(), last_action:'Connexion', avatar_color:'#007AFF' };
        users.push(user);
      } else { 
        if (user.pwd && user.pwd !== pwd) { toast('Mot de passe incorrect.', 'error'); return; }
        user.is_online = true; user.last_seen_at = new Date().toISOString(); user.last_action = 'Connexion'; 
      }
      dbSet(SK.USERS, users);
      sessionStorage.setItem(SK.SESS, JSON.stringify(user));
      S.user = user; S.auth = 'app';
      render();
      toast('Connexion réussie ! Bienvenue ' + user.prenom + '.', 'success');
    },
    signup: function(e) {
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
      var newUser = { id:'u'+Date.now(), prenom:prenom, nom:nom, email:email, sections: S.signupSections.slice(), role:'MEMBRE', is_online:true, last_seen_at:new Date().toISOString(), last_action:'Inscription', avatar_color: ['#007AFF','#FF2D55','#34C759','#FF9500','#5856D6','#AF52DE'][Math.floor(Math.random()*6)], pwd: pwd, sec_q1: q1, sec_a1: a1, sec_q2: q2, sec_a2: a2 };
      users.push(newUser); dbSet(SK.USERS, users);
      sessionStorage.setItem(SK.SESS, JSON.stringify(newUser));
      S.user = newUser; S.auth = 'app';
      render();
      toast('Bienvenue ' + prenom + ' ! Votre compte a été créé. 🎉', 'success');
    },
    logout: function() {
      if (S.user) {
        var users = db(SK.USERS, []); var idx = users.findIndex(function(u){ return u.id===S.user.id; });
        if (idx !== -1) { users[idx].is_online=false; users[idx].last_action='Déconnexion'; dbSet(SK.USERS, users); }
      }
      sessionStorage.removeItem(SK.SESS); S.user=null; S.auth='login'; S.tab='home'; render();
    },

    // Navigation
    tab: function(t) { S.tab=t; S.createOpen=false; S.commentOpen=false; S.optionsOpen=false; render(); },
    story: function(s) { S.story=s; S.q=''; render(); },
    search: function(q) {
      S.q = q;
      // Debounced render (préserve la saisie)
      if (this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(function(){ render(); }, 250);
    },
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
      // DOM update only (no full re-render)
      var btn = document.getElementById('likeBtn-'+postId);
      if (btn) { btn.innerHTML = SVG.heart(nowLiked, 26); btn.style.animation='heartPop 0.35s'; setTimeout(function(){btn.style.animation='';},350); }
      var countEl = document.getElementById('likeCount-'+postId);
      if (countEl) countEl.textContent = likeCount > 0 ? likeCount + ' j\'aime' : 'Soyez le premier à aimer';
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
    share: function(postId) {
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===postId; });
      var txt = post ? (post.caption||'').slice(0,100) : '';
      if (navigator.share) {
        navigator.share({ title:'Kun COM VH', text:txt, url:location.href }).catch(function(){});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href).then(function(){ toast('Lien copié !', 'success'); });
      } else { toast('Lien copié !', 'success'); }
    },

    // Create post
    openCreate: function() { S.createOpen=true; S.pendingMedia=[]; render(); setTimeout(function(){ var t=document.getElementById('newPostText'); if(t) t.focus(); },120); },
    closeCreate: function() { S.createOpen=false; S.pendingMedia=[]; S.hashSuggestions=false; render(); },
    onPostInput: function(val) {
      var words = val.split(/\s/); var last = words[words.length-1];
      var show = last.length > 0 && last.startsWith('#');
      var box = document.getElementById('hashSugg');
      if (box) box.style.display = show ? 'flex' : 'none';
    },
    insertTag: function(tag) {
      var ta = document.getElementById('newPostText'); if (!ta) return;
      var words = ta.value.split(/\s/); words.pop();
      ta.value = words.concat([tag,'']).join(' ');
      var box = document.getElementById('hashSugg'); if (box) box.style.display='none';
      ta.focus();
    },
    addMedia: function(e) {
      var files = Array.from((e.target&&e.target.files)||[]);
      var remaining = 10 - S.pendingMedia.length;
      files.slice(0, remaining).forEach(function(f) {
        if (!f.type.startsWith('image/')) return;
        var r = new FileReader();
        r.onloadend = function() { S.pendingMedia.push(r.result); render(); };
        r.readAsDataURL(f);
      });
    },
    removeMedia: function(i) { S.pendingMedia.splice(i,1); render(); },
    submitPost: function(e) {
      e && e.preventDefault();
      var txt = ((document.getElementById('newPostText')||{}).value||'').trim();
      if (!txt && S.pendingMedia.length===0) { toast('Ajoutez du texte ou une photo.', 'error'); return; }
      if (!S.user) { toast('Vous devez être connecté.', 'error'); return; }
      // Detect section
      var secId = 'general';
      var low = txt.toLowerCase();
      for (var i=0;i<SECTIONS.length;i++) {
        if (low.indexOf('#'+SECTIONS[i].id) !== -1 || low.indexOf('#'+SECTIONS[i].nom.toLowerCase()) !== -1) { secId=SECTIONS[i].id; break; }
      }
      var posts = db(SK.POSTS, []);
      posts.unshift({
        id: 'p'+Date.now(), userId: S.user.id, timestamp: Date.now(),
        author: S.user.prenom + ' ' + S.user.nom,
        authorAvatar: S.user.prenom.charAt(0).toUpperCase(),
        avatarColor: S.user.avatar_color || '#007AFF',
        sectionId: secId, sectionNom: secNom(secId),
        isVedette: false, scoreText: '',
        caption: txt, mediaUrls: S.pendingMedia.slice(),
        likes: 0, likedBy: [], comments: []
      });
      dbSet(SK.POSTS, posts);
      updateUserActivity('Publication');
      S.createOpen=false; S.pendingMedia=[]; S.hashSuggestions=false;
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
      S.optionsOpen=false; S.optionsPost=null;
      render();
      toast('Publication supprimée.', 'success');
    },

    // Comments
    openComments: function(postId) {
      S.commentPostId=postId; S.commentOpen=true; render();
      setTimeout(function(){ var i=document.getElementById('commentInput'); if(i) i.focus(); },150);
    },
    closeComments: function() { S.commentOpen=false; S.commentPostId=null; render(); },
    addEmoji: function(e) { var i=document.getElementById('commentInput'); if(i){i.value+=e;i.focus();} },
    submitComment: function(ev) {
      ev && ev.preventDefault();
      var input = document.getElementById('commentInput');
      var txt = input ? input.value.trim() : '';
      if (!txt || !S.user || !S.commentPostId) return;
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===S.commentPostId; });
      if (!post) return;
      var newC = { id:'c'+Date.now(), userId:S.user.id, author:S.user.prenom+' '+S.user.nom.charAt(0)+'.', avatarColor:S.user.avatar_color||'#007AFF', text:txt, timestamp:Date.now() };
      post.comments.push(newC); dbSet(SK.POSTS, posts);
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
          return '<button type="button" onclick="App.rate(\''+secId+'\','+s+')" style="font-size:28px;cursor:pointer;background:none;border:none;padding:0;color:'+(s<=score?'#FFD700':'#D1D1D6')+';transition:transform 0.1s;" onmousedown="this.style.transform=\'scale(1.2)\'" onmouseup="this.style.transform=\'scale(1)\')">★</button>';
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
      var posts = db(SK.POSTS, []);
      var hasRatings = false;
      var ts = Date.now();
      
      Object.keys(S.ratings).forEach(function(secId) {
        var r = S.ratings[secId];
        if (r && r.score > 0) {
          hasRatings = true;
          var targetSec = SECTIONS.find(function(s){ return s.id === secId; });
          var tNom = targetSec ? targetSec.nom : secId;
          
          var globalScore = r.score;
          // Simulate criteria based on global score
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
            sectionId: S.user.section_id || 'general', sectionNom: secNom(S.user.section_id || 'general'),
            type: 'EVALUATION',
            metadata: {
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
      S.ratings = {};
      S.tab='home'; 
      S.q = ''; // Reset search
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast('Évaluations publiées avec succès ! 🎉', 'success');
    }
  };

  // ============================================================
  // CSS GLOBAL (injecté une seule fois)
  // ============================================================
  function injectCSS() {
    var style = document.createElement('style');
    style.textContent = [
      'html,body{height:100%;overflow:hidden;}',
      '#root{height:100%;display:flex;flex-direction:column;overflow:hidden;}',
      '#mainContent{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}',
      '::-webkit-scrollbar{display:none;}',
      '*{scrollbar-width:none;-webkit-tap-highlight-color:transparent;box-sizing:border-box;}',
      'button{-webkit-appearance:none;touch-action:manipulation;}',
      'input,textarea,select{-webkit-appearance:none;}',
      '@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}',
      '@keyframes heartFloat{0%{transform:translate(-50%,-50%) scale(0);opacity:1}50%{transform:translate(-50%,-80%) scale(1.2);opacity:1}100%{transform:translate(-50%,-120%) scale(0.8);opacity:0}}',
      '@keyframes heartPop{0%{transform:scale(1)}30%{transform:scale(1.35)}60%{transform:scale(0.9)}100%{transform:scale(1)}}',
      'article{transition:opacity 0.2s;}',
      'nav button:active>div{transform:scale(0.9);}',
    ].join('');
    document.head.appendChild(style);
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    syncSupabaseToLocal();
    injectCSS();
    render();
  }

  if (document.getElementById('root')) {
    init();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
