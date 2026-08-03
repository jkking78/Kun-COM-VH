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
  var supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

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
    hashSuggestions: false
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
    var filtered = posts.slice().sort(function(a,b){ return (b.timestamp||0)-(a.timestamp||0); })
      .filter(function(p) {
        if (S.story !== 'all' && p.sectionId !== S.story) return false;
        if (S.q.trim()) {
          var q = S.q.toLowerCase();
          return (p.caption||'').toLowerCase().indexOf(q) !== -1 ||
                 (p.author||'').toLowerCase().indexOf(q) !== -1;
        }
        return true;
      });

    var content = '';
    if (S.tab === 'home')     content = renderHome(filtered, initial, u);
    else if (S.tab === 'planning') content = renderPlanning();
    else if (S.tab === 'debrief') content = renderDebrief(u);
    else if (S.tab === 'profile') content = renderProfile(u, posts);

    var modals = '';
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
          (S.q ? 'Aucun post ne correspond à "' + safeHtml(S.q) + '"' : 'Soyez le premier à partager quelque chose !') +
        '</p>' +
        (S.q
          ? '<button onclick="App.search(\'\')" style="' + btnStyle('#007AFF') + 'height:44px;width:auto;padding:0 22px;font-size:14px;">Voir tout</button>'
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
      // Text-only visual card
      mediaZone = '<div ondblclick="App.doubleTapLike(\''+post.id+'\')" style="background:linear-gradient(135deg,#1A1A2E,#2D2D44);min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;position:relative;">' +
        '<div style="width:48px;height:48px;border-radius:24px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:24px;">' + sec.emoji + '</div>' +
        (post.isVedette ? '<div style="background:linear-gradient(135deg,#FFD700,#FF9500);color:#5D3A00;font-size:10px;font-weight:900;padding:4px 12px;border-radius:20px;letter-spacing:0.8px;margin-bottom:8px;">⭐ SECTION VEDETTE</div>' : '') +
        (post.scoreText ? '<div style="background:rgba(255,255,255,0.92);backdrop-filter:blur(8px);padding:6px 14px;border-radius:14px;position:absolute;bottom:14px;right:14px;"><strong style="font-size:13px;color:#1C1C1E;">★ ' + post.scoreText + '</strong></div>' : '') +
      '</div>';
    }

    return '<article id="post-'+post.id+'" style="background:#FFF;margin-bottom:10px;">' +

      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
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

      mediaZone +

      // Actions row — style Instagram exact
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
  }

  // ============================================================
  // CREATE POST MODAL
  // ============================================================
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
      '<div style="width:36px;height:36px;border-radius:18px;background:linear-gradient(135deg,' + (c.avatarColor||'#007AFF') + ',#0040CC);color:#FFF;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ((c.author||'U').charAt(0)) + '</div>' +
      '<div style="flex:1;">' +
        '<div style="display:flex;align-items:baseline;gap:6px;">' +
          '<strong style="font-size:13.5px;color:#000;">' + safeHtml(c.author||'Membre') + '</strong>' +
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
    var now = new Date();
    var dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    function culteCard(name, hours, status) {
      var configs = {
        closed:   { label:'Clôturé',     bg:'#E5E5EA', color:'#8E8E93',  border:'#E5E5EA'  },
        active:   { label:'En cours',    bg:'#E5F1FF', color:'#007AFF',  border:'#007AFF'  },
        upcoming: { label:'À venir',     bg:'#F0EFFF', color:'#5856D6',  border:'#EFEFFF'  }
      };
      var cfg = configs[status] || configs.upcoming;
      return '<div style="background:#FFF;border-radius:18px;padding:16px;margin-bottom:10px;border:1.5px solid ' + cfg.border + ';box-shadow:' + (status==='active'?'0 4px 14px rgba(0,122,255,0.12)':'none') + ';">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div>' +
            '<h3 style="font-size:17px;font-weight:800;margin:0;color:#000;">' + name + '</h3>' +
            '<span style="font-size:12.5px;color:#8E8E93;">' + hours + '</span>' +
          '</div>' +
          '<span style="background:' + cfg.bg + ';color:' + cfg.color + ';padding:6px 12px;border-radius:20px;font-size:11.5px;font-weight:800;">' + cfg.label + '</span>' +
        '</div>' +
      '</div>';
    }

    return '<header style="padding:16px 18px;background:#FFF;border-bottom:0.5px solid #F2F2F7;">' +
        '<div style="font-size:11px;font-weight:800;color:#5856D6;text-transform:uppercase;letter-spacing:1.3px;margin-bottom:3px;">' + dateStr + '</div>' +
        '<h1 style="font-size:24px;font-weight:900;color:#000;margin:0;">Planning Cultes</h1>' +
      '</header>' +

      '<div style="padding:16px;">' +

        '<div style="background:linear-gradient(135deg,#FFF8EE,#FFFCF5);border:1.5px solid #FF9500;border-radius:22px;padding:18px;margin-bottom:16px;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<div style="width:8px;height:8px;border-radius:4px;background:#FF9500;box-shadow:0 0 0 4px rgba(255,149,0,0.2);"></div>' +
              '<strong style="font-size:15px;color:#D4700A;">Transition en cours</strong>' +
            '</div>' +
            '<span style="background:#FF9500;color:#FFF;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:800;">15 min</span>' +
          '</div>' +
          '<p style="font-size:13px;color:#7A4A00;margin:0 0 12px;line-height:1.4;">Pause technique : 09h00 → 09h15. Préparez votre check-in pour le Culte 2.</p>' +
          '<div style="background:#FFF;border-radius:14px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;">' +
            '<div><strong style="font-size:13.5px;display:block;color:#000;">Check-in Culte 2</strong><span style="font-size:11.5px;color:#8E8E93;">Validez votre présence</span></div>' +
            '<button id="checkInBtn" onclick="App.checkIn()" style="background:' + (S.checkedIn ? 'linear-gradient(135deg,#34C759,#28A347)' : 'linear-gradient(135deg,#007AFF,#0040CC)') + ';color:#FFF;border:none;padding:9px 16px;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.15);">' + (S.checkedIn ? '✓ Présent' : 'Valider') + '</button>' +
          '</div>' +
        '</div>' +

        culteCard('Culte 1', '07h00 — 09h00', 'closed') +
        culteCard('Culte 2', '09h15 — 11h15', 'active') +
        culteCard('Culte 3', '11h30 — 13h30', 'upcoming') +

        '<div style="background:#FFF;border-radius:20px;padding:18px;margin-top:6px;border:0.5px solid #EFEFEF;">' +
          '<h3 style="font-size:15px;font-weight:800;color:#000;margin:0 0 14px;">Équipes du Jour</h3>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">' +
          SECTIONS.map(function(s) {
            return '<div style="background:linear-gradient(135deg,' + s.color + '15,' + s.color + '08);border:1px solid ' + s.color + '30;border-radius:16px;padding:12px;text-align:center;">' +
              '<div style="font-size:26px;margin-bottom:4px;">' + s.emoji + '</div>' +
              '<p style="font-size:11px;font-weight:700;color:' + s.color + ';margin:0;">' + s.nom + '</p>' +
            '</div>';
          }).join('') +
          '</div>' +
        '</div>' +

      '</div>';
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
    var isAdmin = freshU.role === 'GRAND_RESPONSABLE';
    var ROLE_LABELS = {
      GRAND_RESPONSABLE: 'Grand Responsable',
      RESP_SECTION: 'Responsable de Section',
      MEMBRE: 'Membre',
      STAGIAIRE: 'Stagiaire'
    };
    var ROLE_COLORS = {
      GRAND_RESPONSABLE: { bg:'linear-gradient(135deg,#FFD700,#FF9500)', text:'#5D3A00' },
      RESP_SECTION: { bg:'linear-gradient(135deg,#007AFF,#0040CC)', text:'#FFF' },
      MEMBRE: { bg:'linear-gradient(135deg,#34C759,#28A347)', text:'#FFF' },
      STAGIAIRE: { bg:'linear-gradient(135deg,#AF52DE,#8A3DBF)', text:'#FFF' }
    };
    var roleConf = ROLE_COLORS[freshU.role] || ROLE_COLORS.MEMBRE;
    var myPosts = posts.filter(function(p){ return p.userId === freshU.id; });
    var myLikes = posts.filter(function(p){ return Array.isArray(p.likedBy) && p.likedBy.indexOf(freshU.id) !== -1; });
    var saved = Object.keys(S.savedPosts).filter(function(id){ return S.savedPosts[id]; });
    var myComments = 0;
    posts.forEach(function(p){ myComments += (p.comments||[]).filter(function(c){ return c.userId === freshU.id; }).length; });
    var secConf = SECTIONS.find(function(s){ return s.id === freshU.section_id; }) || { emoji:'📢', color:'#8E8E93', nom:'Général' };

    // ---- CARTE PROFIL HERO ----
    var heroCard = '<div style="position:relative;overflow:hidden;">' +
      '<div style="background:linear-gradient(160deg,' + (freshU.avatar_color||'#007AFF') + ' 0%,#001A66 100%);padding:32px 20px 24px;">' +
        '<button onclick="App.logout()" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#FFF;font-size:12px;font-weight:700;padding:6px 12px;border-radius:20px;cursor:pointer;backdrop-filter:blur(8px);">Déconnexion</button>' +

        '<div style="width:90px;height:90px;border-radius:45px;background:rgba(255,255,255,0.2);color:#FFF;font-size:38px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;border:3px solid rgba(255,255,255,0.6);box-shadow:0 8px 24px rgba(0,0,0,0.3);">' +
          freshU.prenom.charAt(0).toUpperCase() +
        '</div>' +

        '<h2 style="font-size:22px;font-weight:900;color:#FFF;text-align:center;margin:0 0 4px;">' + safeHtml(freshU.prenom + ' ' + freshU.nom) + '</h2>' +
        '<p style="font-size:12px;color:rgba(255,255,255,0.7);text-align:center;margin:0 0 12px;">' + safeHtml(freshU.email) + '</p>' +

        '<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:' + (freshU.bio ? '14px' : '0') + ';">' +
          '<div style="background:' + roleConf.bg + ';color:' + roleConf.text + ';padding:5px 14px;border-radius:20px;font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:5px;">' +
            (freshU.role === 'GRAND_RESPONSABLE' ? '⭐ ' : '') + (ROLE_LABELS[freshU.role]||'Membre') +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);color:#FFF;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:5px;">' +
            secConf.emoji + ' #' + secConf.nom +
          '</div>' +
        '</div>' +

        (freshU.bio ? '<p style="font-size:13px;color:rgba(255,255,255,0.85);text-align:center;line-height:1.45;max-width:300px;margin:0 auto;">' + safeHtml(freshU.bio) + '</p>' : '') +
      '</div>' +

      '<div style="background:' + (freshU.is_online ? '#EDFBF3' : '#F2F2F7') + ';border-bottom:1px solid ' + (freshU.is_online ? '#B8F0CE' : '#E5E5EA') + ';padding:10px 16px;display:flex;align-items:center;gap:8px;">' +
        '<div style="width:10px;height:10px;border-radius:5px;background:' + (freshU.is_online ? '#34C759' : '#C7C7CC') + ';' + (freshU.is_online ? 'box-shadow:0 0 0 3px rgba(52,199,89,0.25);' : '') + '"></div>' +
        '<span style="font-size:13px;font-weight:700;color:' + (freshU.is_online ? '#1B7A3E' : '#8E8E93') + ';">' + (freshU.is_online ? 'En ligne maintenant' : 'Hors ligne') + '</span>' +
        '<span style="font-size:12px;color:#8E8E93;margin-left:auto;">Vu ' + timeAgo(freshU.last_seen_at ? new Date(freshU.last_seen_at).getTime() : Date.now()) + '</span>' +
      '</div>' +
    '</div>';

    // ---- STATS BARRE ----
    var statsBar = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#F2F2F7;margin-bottom:10px;">' +
      [
        { val: myPosts.length, label: 'Posts', icon: '📝' },
        { val: myLikes.length, label: 'J\'aime', icon: '❤️' },
        { val: myComments, label: 'Commentaires', icon: '💬' },
        { val: saved.length, label: 'Sauvegardés', icon: '🔖' }
      ].map(function(s) {
        return '<div style="background:#FFF;padding:14px 8px;text-align:center;">' +
          '<div style="font-size:18px;margin-bottom:2px;">' + s.icon + '</div>' +
          '<strong style="font-size:20px;font-weight:900;color:#000;display:block;letter-spacing:-0.5px;">' + s.val + '</strong>' +
          '<span style="font-size:10.5px;color:#8E8E93;">' + s.label + '</span>' +
        '</div>';
      }).join('') +
    '</div>';

    // ---- CARTE INFOS DÉTAILLÉES ----
    var infoCard = '<div style="background:#FFF;margin-bottom:10px;">' +
      '<div style="padding:16px 18px;border-bottom:0.5px solid #F2F2F7;">' +
        '<h3 style="font-size:15px;font-weight:800;margin:0;color:#000;">Informations du profil</h3>' +
      '</div>' +
      '<div style="padding:4px 0;">' +

        infoRow('👤', 'Identité', safeHtml(freshU.prenom + ' ' + freshU.nom)) +
        infoRow('✉️', 'E-mail', safeHtml(freshU.email)) +
        infoRow(secConf.emoji, 'Section / Pôle', '#' + secConf.nom + ' — ' + safeHtml(freshU.section_nom||'')) +
        infoRow('🎖️', 'Rôle & Permissions', ROLE_LABELS[freshU.role]||'Membre') +
        infoRow('📅', 'Membre depuis le', fmtDate(freshU.joined_at)) +
        infoRow('🕐', 'Dernière visite (last_seen_at)', fmtDateTime(freshU.last_seen_at)) +
        infoRow('⚡', 'Dernière action (last_action_at)', (freshU.last_action_label||'Action') + ' · ' + fmtDateTime(freshU.last_action_at)) +
        infoRow('🌐', 'Statut de connexion', freshU.is_online ? '🟢 En ligne' : '⚪ Hors ligne') +

      '</div>' +
    '</div>';

    // ---- POSTS RÉCENTS DE L'UTILISATEUR ----
    var myPostsSection = myPosts.length > 0
      ? '<div style="background:#FFF;margin-bottom:10px;">' +
          '<div style="padding:14px 18px;border-bottom:0.5px solid #F2F2F7;display:flex;justify-content:space-between;align-items:center;">' +
            '<h3 style="font-size:15px;font-weight:800;margin:0;color:#000;">Mes publications</h3>' +
            '<span style="font-size:12px;color:#8E8E93;">' + myPosts.length + ' au total</span>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1.5px;background:#F2F2F7;">' +
          myPosts.slice(0,9).map(function(p) {
            if (p.mediaUrls && p.mediaUrls.length > 0) {
              return '<div onclick="App.openComments(\'' + p.id + '\')" style="aspect-ratio:1;overflow:hidden;cursor:pointer;"><img src="' + p.mediaUrls[0] + '" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/></div>';
            }
            return '<div onclick="App.openComments(\'' + p.id + '\')" style="aspect-ratio:1;background:linear-gradient(135deg,' + secColor(p.sectionId) + '25,#EEE);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-direction:column;gap:4px;">' +
              '<span style="font-size:22px;">' + secEmoji(p.sectionId) + '</span>' +
              '<span style="font-size:9px;color:#8E8E93;font-weight:600;text-align:center;padding:0 4px;">' + (p.caption||'').slice(0,20) + '…</span>' +
            '</div>';
          }).join('') +
          '</div>' +
        '</div>'
      : '';

    // ---- DASHBOARD ADMIN ----
    var adminDashboard = '';
    if (isAdmin) {
      var onlineCount = allProfiles.filter(function(p){ return p.is_online; }).length;
      var todayPosts = posts.filter(function(p){ return Date.now() - (p.timestamp||0) < 86400000; }).length;

      adminDashboard = '<div style="background:#FFF;margin-bottom:10px;">' +

        // En-tête dashboard
        '<div style="background:linear-gradient(135deg,#1A1A2E,#2D2D44);padding:18px;">' +
          '<div style="display:flex;align-items:center;gap:12px;">' +
            '<div style="width:44px;height:44px;border-radius:22px;background:linear-gradient(135deg,#FFD700,#FF9500);display:flex;align-items:center;justify-content:center;font-size:20px;">🛡️</div>' +
            '<div><h3 style="font-size:16px;font-weight:800;margin:0;color:#FFF;">Tableau de Bord Administration</h3><p style="font-size:12px;color:rgba(255,255,255,0.6);margin:0;">Gestion des profils & Activité temps réel</p></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;">' +
            adminKpi('🟢', onlineCount, 'En ligne') +
            adminKpi('📝', todayPosts, 'Posts 24h') +
            adminKpi('👥', allProfiles.length, 'Membres') +
          '</div>' +
        '</div>' +

        // Liste de tous les profils membres
        '<div style="padding:14px 16px;">' +
          '<h4 style="font-size:13px;font-weight:800;color:#8E8E93;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 12px;">Profils Membres — Supabase Realtime</h4>' +
          '<div style="display:flex;flex-direction:column;gap:10px;">' +
          allProfiles.map(function(p) {
            var pr = ROLE_COLORS[p.role] || ROLE_COLORS.MEMBRE;
            var pSec = SECTIONS.find(function(s){ return s.id===p.section_id; }) || { emoji:'📢', color:'#8E8E93', nom:'Général' };
            var pPosts = posts.filter(function(x){ return x.userId===p.id; }).length;
            return '<div style="background:#F8F9FF;border-radius:18px;padding:14px;border:1px solid #EFEFEF;">' +

              // Entête carte utilisateur
              '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
                '<div style="position:relative;flex-shrink:0;">' +
                  '<div style="width:44px;height:44px;border-radius:22px;background:linear-gradient(135deg,' + (p.avatar_color||'#007AFF') + ',#0040CC);color:#FFF;font-weight:900;font-size:17px;display:flex;align-items:center;justify-content:center;">' + p.prenom.charAt(0) + '</div>' +
                  '<div style="position:absolute;bottom:0;right:0;width:13px;height:13px;border-radius:7px;background:' + (p.is_online?'#34C759':'#C7C7CC') + ';border:2.5px solid #F8F9FF;"></div>' +
                '</div>' +
                '<div style="flex:1;min-width:0;">' +
                  '<div style="font-size:14px;font-weight:800;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(p.prenom + ' ' + p.nom) + '</div>' +
                  '<div style="font-size:11.5px;color:#8E8E93;">' + safeHtml(p.email) + '</div>' +
                '</div>' +
                '<div style="flex-shrink:0;">' +
                  '<span style="background:' + pr.bg + ';color:' + pr.text + ';font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:20px;white-space:nowrap;display:inline-block;">' + (ROLE_LABELS[p.role]||'Membre') + '</span>' +
                '</div>' +
              '</div>' +

              // Grille infos détaillées (Section, Inscription, Visite, Action)
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">' +
                adminMiniInfo(pSec.emoji, '#' + pSec.nom, pSec.color) +
                adminMiniInfo('📝', pPosts + ' post' + (pPosts > 1 ? 's' : ''), '#007AFF') +
                adminMiniInfo('🕐', 'Vu ' + timeAgo(p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0), '#8E8E93') +
                adminMiniInfo('⚡', (p.last_action_label||'Action') + ' ' + timeAgo(p.last_action_at ? new Date(p.last_action_at).getTime() : 0), '#FF9500') +
              '</div>' +

              // Date inscription
              '<div style="font-size:11px;color:#8E8E93;border-top:0.5px solid #EFEFEF;padding-top:6px;display:flex;justify-content:space-between;">' +
                '<span>📅 Inscrit le ' + fmtDate(p.joined_at) + '</span>' +
                '<span style="font-weight:700;color:' + (p.is_online?'#34C759':'#8E8E93') + ';">' + (p.is_online?'🟢 En ligne':'⚪ Hors ligne') + '</span>' +
              '</div>' +

            '</div>';
          }).join('') +
          '</div>' +
        '</div>' +

      '</div>';
    }

    return '<header style="padding:16px 18px;background:#FFF;border-bottom:0.5px solid #F2F2F7;display:flex;justify-content:space-between;align-items:center;">' +
        '<h1 style="font-size:20px;font-weight:900;color:#000;margin:0;">Mon Profil</h1>' +
        '<span style="font-size:12px;color:#8E8E93;font-weight:600;">' + safeHtml(freshU.email) + '</span>' +
      '</header>' +

      '<div style="padding-bottom:20px;">' +
        heroCard +
        statsBar +
        infoCard +
        myPostsSection +
        adminDashboard +
      '</div>';
  } '</strong>' +
                '<span style="font-size:11px;font-weight:600;color:' + (p.is_online?'#34C759':'#C7C7CC') + ';">' + (p.is_online?'● En ligne':'○ Hors ligne') + '</span>' +
              '</div>' +
            '</div>';
          }).join('') +
          '</div></div>' : '') +

      '</div>';
  }

  // ============================================================
  // APP CONTROLLER — toutes les actions
  // ============================================================
  window.App = {

    // Auth
    nav: function(v) { S.auth = v; render(); },
    login: function(e) {
      e && e.preventDefault();
      var email = (document.getElementById('loginEmail')||{}).value || '';
      if (!email.trim()) { toast('Veuillez saisir votre e-mail.', 'error'); return; }
      var users = db(SK.USERS, []);
      var user = users.find(function(u){ return u.email.toLowerCase() === email.toLowerCase(); });
      if (!user) {
        var p = email.split('@')[0]; var parts = p.split('.');
        user = { id: 'u'+Date.now(), prenom: parts[0]&&parts[0].charAt(0).toUpperCase()+parts[0].slice(1)||'Membre', nom: parts[1]&&parts[1].charAt(0).toUpperCase()+parts[1].slice(1)||'COM', email: email, section_id:'cadrage', section_nom:'Cadrage', role:'RESP_SECTION', is_online:true, last_seen_at:new Date().toISOString(), last_action:'Connexion', avatar_color:'#007AFF' };
        users.push(user);
      } else { user.is_online = true; user.last_seen_at = new Date().toISOString(); user.last_action = 'Connexion'; }
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
      var sec = ((document.getElementById('signupSection')||{}).value)||'cadrage';
      if (!prenom||!nom||!email) { toast('Veuillez remplir tous les champs.', 'error'); return; }
      var users = db(SK.USERS, []);
      if (users.find(function(u){ return u.email.toLowerCase()===email.toLowerCase(); })) {
        toast('Un compte existe déjà avec cet e-mail.', 'error'); return;
      }
      var newUser = { id:'u'+Date.now(), prenom:prenom, nom:nom, email:email, section_id:sec, section_nom:secNom(sec), role:'MEMBRE', is_online:true, last_seen_at:new Date().toISOString(), last_action:'Inscription', avatar_color: ['#007AFF','#FF2D55','#34C759','#FF9500','#5856D6','#AF52DE'][Math.floor(Math.random()*6)] };
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
      render();
      toast('Publication partagée ! 🎉', 'success');
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
      posts.unshift({
        id:'bilan-'+Date.now(), userId:S.user.id, timestamp:Date.now(),
        author:S.user.prenom+' '+S.user.nom, authorAvatar:S.user.prenom.charAt(0).toUpperCase(), avatarColor:S.user.avatar_color||'#FFD700',
        sectionId:'general', sectionNom:'Bilan Officiel', isVedette:true, scoreText:'4.88 / 5.0',
        caption:'Bilan officiel du culte du '+new Date().toLocaleDateString('fr-FR')+'. Excellente performance globale ! #CulteDuDimanche #Bilan',
        mediaUrls:[], likes:0, likedBy:[], comments:[]
      });
      dbSet(SK.POSTS, posts); S.tab='home'; render();
      toast('Bilan publié sur le feed !', 'success');
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
