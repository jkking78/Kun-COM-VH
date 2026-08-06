// KUN COM VH — Partie 1/8 : État global, stockage, notifications, sections, session

  'use strict';
  console.log('🚀 Commit VH v3.0 — Démarrage...');

  // ============================================================
  // STOCKAGE
  // ============================================================
  var SK = {
    USERS: 'kc_profiles',
    POSTS: 'kc_posts',
    SESS: 'kc_user',
    SAVED: 'kc_saved',
    LIKED_COMMENTS: 'kc_liked_comments',
    SECTION_SEEN: 'kc_section_seen'
  };

  var DB_CACHE = {};
  // Empêche la boucle infinie focus->render->focus quand on refocus programmatiquement
  // un input recréé par un render() complet (le nouvel input déclenche son propre onfocus).
  var _restoringSearchFocus = false;

  // ============================================================
  // INSTAGRAM-STYLE TARGETED NOTIFICATION SYSTEM
  // ============================================================
  function sendNotificationToUser(targetUserId, notifData) {
    if (!targetUserId) return;
    var allUsers = db(SK.USERS, []);
    var targetUser = allUsers.find(function(u){ return u.id === targetUserId; });
    if (!targetUser) return;
    
    if (!Array.isArray(targetUser.notifications)) targetUser.notifications = [];
    
    // Prevent duplicate
    var exists = targetUser.notifications.find(function(n){ 
      return n.targetId === notifData.targetId && n.type === notifData.type && n.senderId === (S.user ? S.user.id : 'system'); 
    });
    if (exists) return;
    
    var newNotif = {
      id: 'n_' + Date.now() + '_' + Math.floor(Math.random()*1000),
      senderId: S.user ? S.user.id : 'system',
      senderName: S.user ? (S.user.prenom + ' ' + (S.user.nom?S.user.nom.charAt(0)+'.':'')) : 'Système',
      senderAvatar: S.user ? S.user.avatar_url : null,
      senderColor: S.user ? (S.user.avatar_color || '#007AFF') : '#007AFF',
      type: notifData.type,
      title: notifData.title,
      text: notifData.text,
      targetId: notifData.targetId,
      timestamp: Date.now(),
      read: false
    };
    
    targetUser.notifications.unshift(newNotif);
    if (targetUser.notifications.length > 50) {
      targetUser.notifications = targetUser.notifications.slice(0, 50);
    }
    
    var uIdx = allUsers.findIndex(function(u){ return u.id === targetUserId; });
    if (uIdx !== -1) allUsers[uIdx] = targetUser;
    dbSet(SK.USERS, allUsers);
    
    if (S.user && S.user.id === targetUserId) {
      S.user = targetUser;
      try { localStorage.setItem(SK.SESS, JSON.stringify(targetUser)); } catch(e){}
    }
    
    if (supabase) {
      supabase.from('kun_com_profiles').upsert({ id: targetUser.id, content: targetUser }, { onConflict: 'id' }).then(function(){}, function(e){});
    }
    
    if (S.user && S.user.id === targetUserId) {
      toast('🔔 ' + notifData.title + ': ' + notifData.text, 'info');
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(notifData.title, { body: notifData.text }); } catch(e){}
      }
    }
  }

  function sendTargetedEventNotifications(post) {
    if (!post || post.type !== 'EVENT') return;
    var allUsers = db(SK.USERS, []);
    var assignedUserIds = (post.assignments || []).map(function(a){ return a.userId; });
    
    // Direct assignments
    (post.assignments || []).forEach(function(a) {
      if (a.userId && a.userId !== (S.user ? S.user.id : '')) {
        sendNotificationToUser(a.userId, {
          type: 'EVENT_ASSIGNED',
          title: '🗓️ Service assigné',
          text: 'Vous avez été convoqué(e) (' + a.task + ') pour ' + post.eventTitle,
          targetId: post.id
        });
      }
    });
    
    // Section members
    var evSections = post.eventSections || [];
    if (evSections.length > 0) {
      allUsers.forEach(function(u) {
        if (u.id === (S.user ? S.user.id : '')) return;
        if (assignedUserIds.indexOf(u.id) !== -1) return;
        var uSecs = u.sections || [];
        var match = evSections.some(function(s){ return uSecs.indexOf(s) !== -1; });
        if (match) {
          sendNotificationToUser(u.id, {
            type: 'EVENT_SECTION',
            title: '🗓️ Événement de Pôle',
            text: 'Un nouvel événement "' + post.eventTitle + '" concerne votre pôle.',
            targetId: post.id
          });
        }
      });
    }
  }

  function sendTargetedSectionPostNotifications(post) {
    if (!post || post.visibility !== 'sections') return;
    var targetSecs = post.targetSections || [];
    if (targetSecs.length === 0) return;
    var allUsers = db(SK.USERS, []);
    var authorId = S.user ? S.user.id : '';
    allUsers.forEach(function(u) {
      if (u.id === authorId) return;
      var uSecs = u.sections || [];
      var match = targetSecs.some(function(s){ return uSecs.indexOf(s) !== -1; });
      if (match) {
        sendNotificationToUser(u.id, {
          type: 'POST_SECTION',
          title: '📢 Nouvelle publication de Pôle',
          text: (S.user ? S.user.prenom : 'Quelqu\'un') + ' a publié pour votre pôle "' + post.sectionNom + '".',
          targetId: post.id
        });
      }
    });
  }


  // ============================================================
  // SUPABASE REALTIME CLIENT
  // ============================================================
  var SUPABASE_URL = 'https://yugkryhikrfsxbuyxacl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_CMnVxHYsKJIP51J0zDRX6w_hdLgiHR7';
  // ATTENTION : ce fichier s'exécute au niveau global (plus dans une fonction
  // isolée depuis le découpage en modules). "var supabase" écrase donc
  // window.supabase, où le SDK Supabase s'était installé. index.html en garde une
  // copie sous window.__supabaseSdk AVANT que cette ligne ne s'exécute ; c'est
  // cette copie qu'il faut utiliser pour créer le client.
  var supabase = null;
  try {
    var _supabaseSdk = window.__supabaseSdk || window.supabase;
    supabase = _supabaseSdk ? _supabaseSdk.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
    if (!supabase) console.error('Supabase SDK introuvable — synchronisation impossible.');
  } catch(e) {
    console.error("Supabase init error:", e);
  }

  // Password hashing utility (SHA-256)
  async function hashPassword(pwd) {
    try {
      var encoder = new TextEncoder();
      var data = encoder.encode(pwd + '_kun_salt_2026');
      var hash = await crypto.subtle.digest('SHA-256', data);
      var arr = Array.from(new Uint8Array(hash));
      return arr.map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
    } catch(e) {
      // Fallback: simple hash for older browsers
      var h = 0;
      for (var i = 0; i < pwd.length; i++) {
        var c = pwd.charCodeAt(i);
        h = ((h << 5) - h) + c;
        h |= 0;
      }
      return 'h_' + Math.abs(h).toString(36);
    }
  }

  // Identifiants des comptes créés sur CET appareil. Sert de garde-fou : tant qu'un
  // compte n'est pas confirmé côté serveur, il ne doit jamais être purgé du cache
  // local, sinon son propriétaire perd définitivement l'accès (le mot de passe n'est
  // stocké nulle part ailleurs).
  var SK_LOCAL_ACCOUNTS = 'kc_local_accounts';
  function localAccountIds() {
    try {
      var raw = localStorage.getItem(SK_LOCAL_ACCOUNTS);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch(e) { return []; }
  }
  function addLocalAccountId(id) {
    if (!id) return;
    try {
      var arr = localAccountIds();
      if (arr.indexOf(id) === -1) { arr.push(id); localStorage.setItem(SK_LOCAL_ACCOUNTS, JSON.stringify(arr)); }
    } catch(e) {}
  }
  function removeLocalAccountId(id) {
    if (!id) return;
    try {
      var arr = localAccountIds().filter(function(x){ return x !== id; });
      localStorage.setItem(SK_LOCAL_ACCOUNTS, JSON.stringify(arr));
    } catch(e) {}
  }

      function mergeProfilesWithLocal(remoteData) {
    var localUsers = db(SK.USERS, []);
    var map = {};
    // Le serveur fait autorité sur la liste des comptes (aucune pagination ici :
    // on récupère tous les profils à chaque fois). Un profil encore en cache local
    // mais absent du serveur a donc été supprimé — on ne le garde pas, sinon il
    // réapparaît indéfiniment et se fait même réinjecter dans la base par le renvoi
    // rétroactif.
    //
    // DEUX exceptions, sans lesquelles on pourrait détruire un compte :
    //  - le compte connecté sur cet appareil ;
    //  - tout compte CRÉÉ sur cet appareil et pas encore synchronisé (réseau coupé,
    //    serveur injoignable...). Sans cette garde, un membre inscrit hors-ligne qui
    //    se déconnecte verrait son compte effacé du cache et ne pourrait plus jamais
    //    se reconnecter — le mot de passe n'existant que localement.
    //    La protection est levée dès que le compte est réellement supprimé depuis
    //    cet appareil (voir removeLocalAccountId dans confirmDeleteAccount).
    var remoteIds = {};
    (remoteData || []).forEach(function(item) {
      var r = item.content || item;
      if (r && r.id) remoteIds[r.id] = true;
    });
    var ownIds = localAccountIds();
    (localUsers || []).forEach(function(u) {
      if (!u || !u.id) return;
      var isMine = (S.user && S.user.id === u.id) || ownIds.indexOf(u.id) !== -1;
      if (!remoteIds[u.id] && !isMine) return;
      map[u.id] = u;
    });
    (remoteData || []).forEach(function(item) {
      var rUser = item.content || item;
      if (rUser && rUser.id) {
        var existing = map[rUser.id] || {};
        var merged = Object.assign({}, existing, rUser);
        // Preserve pwd and security credentials if present locally
        if (existing.pwd && !merged.pwd) merged.pwd = existing.pwd;
        if (existing.sec_a1 && !merged.sec_a1) merged.sec_a1 = existing.sec_a1;
        if (existing.sec_a2 && !merged.sec_a2) merged.sec_a2 = existing.sec_a2;
        map[rUser.id] = merged;
      }
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  // purgeWindow : à activer quand remoteData correspond à la page LA PLUS RÉCENTE
  // (synchronisation initiale et sondage), jamais pour "Charger plus" qui ne
  // rapporte qu'une tranche ancienne de l'historique.
  function mergePostsWithLocal(remoteData, purgeWindow) {
    var localPosts = db(SK.POSTS, []);
    var map = {};
    (localPosts || []).forEach(function(p) {
      if (p && p.id) map[p.id] = p;
    });
    (remoteData || []).forEach(function(item) {
      var p = item.content || item;
      if (p && p.id) {
        var local = map[p.id];
        if (local) {
          // Smart merge: keep whichever has more comments/likes (most recent data)
          var localComments = (local.comments || []).length;
          var remoteComments = (p.comments || []).length;
          var localLikes = (local.likedBy || []).length;
          var remoteLikes = (p.likedBy || []).length;
          if (localComments > remoteComments || localLikes > remoteLikes) {
            // Local has newer interactions, keep local but merge remote metadata
            map[p.id] = Object.assign({}, p, local);
          } else {
            map[p.id] = p;
          }
        } else {
          map[p.id] = p;
        }
      }
    });

    // Purge des publications supprimées côté serveur. Avec la pagination, "absente
    // de la réponse" ne veut pas dire "supprimée" : elle peut simplement être plus
    // ancienne que la page reçue. On ne purge donc QUE la fenêtre réellement
    // couverte — soit les publications au moins aussi récentes que la plus ancienne
    // de la page. Sans ça, une publication supprimée restait affichée à vie sur les
    // autres appareils.
    if (purgeWindow && Array.isArray(remoteData)) {
      var remotePostIds = {};
      var oldestInPage = Infinity;
      remoteData.forEach(function(item) {
        var p = item.content || item;
        if (!p || !p.id) return;
        remotePostIds[p.id] = true;
        var ts = p.timestamp || 0;
        if (ts < oldestInPage) oldestInPage = ts;
      });
      // Page incomplète = le serveur a renvoyé TOUT l'historique : plus de zone
      // d'incertitude, on peut purger sans limite d'ancienneté.
      var serverReturnedEverything = remoteData.length < POSTS_PAGE_SIZE;
      // Publications créées à l'instant : peut-être pas encore remontées au serveur.
      var tooRecentToJudge = Date.now() - 15 * 60 * 1000;
      Object.keys(map).forEach(function(id) {
        var p = map[id];
        if (!p) return;
        if (remotePostIds[id]) return;                        // toujours présente
        var ts = p.timestamp || 0;
        if (ts > tooRecentToJudge) return;                    // envoi possiblement en cours
        if (!serverReturnedEverything && ts < oldestInPage) return;  // hors fenêtre connue
        delete map[id];                                       // supprimée sur le serveur
      });
    }

    var merged = Object.keys(map).map(function(k) { return map[k]; });
    merged.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    return merged;
  }

  // Pagination des publications : les chargements réguliers (initial + poll) ne
  // récupèrent que la page la plus récente pour rester rapides même avec beaucoup
  // de publications ; l'historique plus ancien se charge à la demande via
  // App.loadMorePosts() (bouton "Charger plus" en bas du fil), jamais en effaçant
  // ce qui est déjà affiché (mergePostsWithLocal est toujours additif).
  var POSTS_PAGE_SIZE = 60;

  var _syncRetryCount = 0;
  var MAX_SYNC_RETRIES = 4;
  async function syncSupabaseToLocal() {
    if (!supabase) {
      // Ne jamais échouer en silence : sans client Supabase, l'app n'affiche que le
      // cache local et donne l'illusion de fonctionner (aucune publication ni membre
      // des autres utilisateurs). C'est exactement le symptôme à diagnostiquer vite.
      console.error('Aucun client Supabase : l\'application fonctionne en mode local uniquement.');
      S.initialLoading = false; render(); return;
    }
    try {
      // Publications et profils récupérés EN PARALLÈLE (pas l'un après l'autre) —
      // divise par deux le temps de chargement initial.
      var _results = await Promise.all([
        supabase.from('kun_com_posts').select('*').order('created_at', { ascending: false }).range(0, POSTS_PAGE_SIZE - 1),
        supabase.from('kun_com_profiles').select('*')
      ]);
      var res = _results[0];
      var resProf = _results[1];
      if (res && res.error) { console.warn('Supabase posts fetch error:', res.error); }
      if (res && res.data) {
        S.postsAllLoaded = res.data.length < POSTS_PAGE_SIZE;
        var mergedPosts = mergePostsWithLocal(res.data, true);
        dbSet(SK.POSTS, mergedPosts);
        // Renvoie vers Supabase les publications créées hors-ligne et pas encore
        // synchronisées — repéré via leur horodatage très récent (pas juste "absent de
        // cette page"), car avec la pagination un post ancien peut légitimement être
        // absent de cette page sans être "local uniquement". On évite ainsi de renvoyer
        // tout l'historique local à chaque sync, ce qui ne passerait pas à l'échelle.
        var remotePostIds = (res.data || []).map(function(item){ return item.id; });
        var recentCutoff = Date.now() - 15 * 60 * 1000;
        mergedPosts.forEach(function(post) {
          if (post && post.id && (post.timestamp || 0) > recentCutoff && remotePostIds.indexOf(post.id) === -1) {
            supabase.from('kun_com_posts').upsert({ id: post.id, content: post }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Push post error:', e); });
          }
        });
      }
      // Profils (déjà récupérés en parallèle ci-dessus)
      if (resProf && resProf.data) {
        var mergedProfiles = mergeProfilesWithLocal(resProf.data);
        DB_CACHE[SK.USERS] = mergedProfiles;
        localStorage.setItem(SK.USERS, JSON.stringify(mergedProfiles));
        if (S.user) {
          var freshMe = mergedProfiles.find(function(x){ return x.id === S.user.id; });
          if (freshMe) {
            S.user = freshMe;
            localStorage.setItem(SK.SESS, JSON.stringify(freshMe));
          }
        }
        // Renvoi rétroactif LIMITÉ au compte connecté sur cet appareil. Auparavant
        // on renvoyait tout profil local absent du serveur : un cache périmé
        // ressuscitait alors les comptes supprimés à chaque synchronisation.
        // Chaque appareil ne fait autorité que sur son propre compte.
        var remoteProfileIds = (resProf.data || []).map(function(item){ return item.id; });
        if (S.user && S.user.id && remoteProfileIds.indexOf(S.user.id) === -1) {
          supabase.from('kun_com_profiles').upsert({ id: S.user.id, content: S.user }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Push profile error:', e); });
        }
      }
      
      // Filet de sécurité si le temps réel Supabase ne fonctionne pas. Espacé à 20 s :
      // à 3 s, chaque cycle re-téléchargeait tout le lot et reconstruisait tout le DOM,
      // ce qui faisait planter Safari mobile. Le temps réel (ci-dessous) reste la voie
      // principale pour les mises à jour instantanées. En pause quand l'onglet est masqué.
      if (!window._postsPollInterval) {
        window._postsPollInterval = setInterval(function() {
          if (document.hidden) return;
          fetchPostsSilently();
        }, 20000);
      }

      // Temps réel Supabase — abonné UNE SEULE FOIS : syncSupabaseToLocal() peut être
      // rappelé (réessais réseau), et sans ce garde-fou chaque appel créait un canal
      // supplémentaire, multipliant les rafraîchissements jusqu'à faire planter l'onglet.
      if (!window._realtimeSubscribed) {
        window._realtimeSubscribed = true;
        supabase.channel('public:kun_com_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kun_com_posts' }, function() {
             fetchPostsSilently();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kun_com_profiles' }, function() {
             fetchProfilesSilently();
          })
          .subscribe();
      }
        
      // Clean up expired ephemeral posts
      var allP = db(SK.POSTS, []);
      var now = Date.now();
      var cleanPosts = allP.filter(function(p) {
        if (p.is_ephemeral && p.ephemeral_expiry && p.ephemeral_expiry < now) return false;
        return true;
      });
      if (cleanPosts.length < allP.length) {
        dbSet(SK.POSTS, cleanPosts);
        // Also delete from Supabase
        var expired = allP.filter(function(p) { return p.is_ephemeral && p.ephemeral_expiry && p.ephemeral_expiry < now; });
        expired.forEach(function(ep) {
          supabase.from('kun_com_posts').delete().eq('id', ep.id).then(function(){}, function(){});
        });
      }

      _syncRetryCount = 0;
      S.initialLoading = false;
      if (window.App && window.App.tab) {
         render();
      }
      try { tryOpenDeepLinkedPost(); } catch(e){}
    } catch(e) {
      console.warn("Supabase Sync Error:", e);
      // Réessaie automatiquement (réseau instable au démarrage) avant d'abandonner
      // et d'afficher un état "Aucune publication" définitif.
      if (_syncRetryCount < MAX_SYNC_RETRIES) {
        _syncRetryCount++;
        setTimeout(function(){ syncSupabaseToLocal(); }, 1500 * _syncRetryCount);
      } else {
        S.initialLoading = false;
        render();
      }
    }
  }
  
  
  var _fetchProfilesInFlight = false;
  async function fetchProfilesSilently() {
    if (!supabase || _fetchProfilesInFlight) return;
    _fetchProfilesInFlight = true;
    try {
    var resProf = await supabase.from('kun_com_profiles').select('*');
    if (resProf && resProf.data) {
      var mergedProfiles = mergeProfilesWithLocal(resProf.data);
      DB_CACHE[SK.USERS] = mergedProfiles;
      try { localStorage.setItem(SK.USERS, JSON.stringify(mergedProfiles)); } catch(e){}
      if (S.user) {
        var freshMe = mergedProfiles.find(function(x){ return x.id === S.user.id; });
        if (freshMe) {
          S.user = freshMe;
          try { localStorage.setItem(SK.SESS, JSON.stringify(freshMe)); } catch(e){}
        }
      }
      // Ne pas re-rendre si l'utilisateur est en train de saisir (perte de focus/texte)
      var actEl = document.activeElement;
      var typing = actEl && (actEl.tagName === 'INPUT' || actEl.tagName === 'TEXTAREA');
      if (!typing) render();
    }
    } catch(e) { console.warn('fetchProfilesSilently error:', e); }
    _fetchProfilesInFlight = false;
  }
  // Empreinte légère d'un lot de publications, pour détecter un changement SANS
  // sérialiser tout le contenu (les médias base64 pèsent des dizaines de Mo :
  // faire JSON.stringify dessus toutes les quelques secondes saturait la mémoire
  // de Safari mobile et faisait planter l'onglet).
  function postsFingerprint(posts) {
    var parts = [];
    (posts || []).forEach(function(p) {
      if (!p || !p.id) return;
      parts.push(p.id + ':' + (p.timestamp||0) + ':' + ((p.comments||[]).length) + ':' +
        ((p.likedBy||[]).length) + ':' + (p.is_edited?1:0) + ':' + ((p.caption||'').length) +
        ':' + (p.videoPoster?1:0));
    });
    return parts.join('|');
  }

  var _lastPostsFingerprint = '';
  var _fetchPostsInFlight = false;
  async function fetchPostsSilently() {
    if (!supabase || _fetchPostsInFlight) return;
    _fetchPostsInFlight = true;
    try {
      var res = await supabase.from('kun_com_posts').select('*').order('created_at', { ascending: false }).range(0, POSTS_PAGE_SIZE - 1);
      if (res && res.error) { console.warn('Supabase posts poll error:', res.error); }
      if (res && res.data) {
        if (res.data.length < POSTS_PAGE_SIZE) S.postsAllLoaded = true;
        var mergedPosts = mergePostsWithLocal(res.data, true);
        var fp = postsFingerprint(mergedPosts);
        if (fp !== _lastPostsFingerprint) {
          _lastPostsFingerprint = fp;
          dbSet(SK.POSTS, mergedPosts);

          var activeEl = document.activeElement;
          var isTyping = activeEl && (activeEl.id === 'commentInput' || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
          if (!isTyping) {
            render();
          }
        }
      }
    } catch(e) { console.warn('fetchPostsSilently error:', e); }
    _fetchPostsInFlight = false;
  }

  function db(key, def) {
    if (DB_CACHE[key] !== undefined) return DB_CACHE[key];
    try { var r = localStorage.getItem(key); var parsed = r ? JSON.parse(r) : def; DB_CACHE[key] = parsed; return parsed; } catch(e) { return def; }
  }
  // Allège une publication avant sauvegarde locale : les médias encore en base64
  // (ancien format) pèsent des dizaines de Mo chacun et faisaient exploser le quota
  // localStorage — et, plus grave, saturaient la mémoire de Safari mobile jusqu'au
  // plantage de l'onglet. Ils restent disponibles depuis le serveur ; on ne garde
  // en local que les URL hébergées (légères) et les vignettes.
  function stripHeavyMediaForStorage(posts) {
    if (!Array.isArray(posts)) return posts;
    return posts.map(function(p) {
      if (!p) return p;
      var hasHeavy = (p.mediaUrls || []).some(function(u){ return typeof u === 'string' && u.indexOf('data:') === 0 && u.length > 100000; }) ||
                     (p.originalMediaUrls || []).some(function(u){ return typeof u === 'string' && u.indexOf('data:') === 0 && u.length > 100000; });
      if (!hasHeavy) return p;
      var copy = Object.assign({}, p);
      copy.mediaUrls = (p.mediaUrls || []).filter(function(u){ return !(typeof u === 'string' && u.indexOf('data:') === 0 && u.length > 100000); });
      copy.originalMediaUrls = (p.originalMediaUrls || []).filter(function(u){ return !(typeof u === 'string' && u.indexOf('data:') === 0 && u.length > 100000); });
      return copy;
    });
  }

  function dbSet(key, val) {
    DB_CACHE[key] = val;
    try {
      var toStore = (key === SK.POSTS) ? stripHeavyMediaForStorage(val) : val;
      localStorage.setItem(key, JSON.stringify(toStore));
    } catch(e) {
      // Quota dépassé : on purge le cache local des publications plutôt que de
      // laisser l'appli dans un état instable (les données restent sur le serveur).
      if (key === SK.POSTS) { try { localStorage.removeItem(SK.POSTS); } catch(e2){} }
    }
  }

  // ============================================================
  // DONNÉES PAR DÉFAUT
  // ============================================================
  if (!db(SK.USERS, null)) { dbSet(SK.USERS, []); }

    // Initial cleanup of old EVALUATION posts
  try {
    var initPosts = db(SK.POSTS, []);
    var filteredPosts = initPosts.filter(function(p){ return p.type !== 'EVALUATION'; });
    if (filteredPosts.length !== initPosts.length) {
      dbSet(SK.POSTS, filteredPosts);
    }
  } catch(e){}

  if (!db(SK.POSTS, null)) { dbSet(SK.POSTS, []); }

  // ============================================================
  // ÉTAT GLOBAL
  // ============================================================
  var S = {
    auth: 'login',
    // Vrai tant que la première synchronisation avec Supabase n'est pas terminée
    // (permet d'afficher "Chargement..." au lieu d'un faux "Aucune publication" au démarrage).
    initialLoading: true,
    cropperOpen: false,
    cropperDataUrl: null,
    cropperAspectRatio: 1,
    cropperTitle: 'Recadrer la photo',
    cropperOnConfirm: null,
    // Recadrage libre (photo de publication) : affiche la barre Pivoter/Réinitialiser/Carré
    cropperFreeRatio: false,
    cropperSquare: false,
    user: null,
    tab: 'home',
    story: 'all',
    q: '',
    searchFocused: false,
    membersListOpen: false,
    membersSearch: '',
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
    signupRole: 'MEMBRE',
    editSections: [],
    eventSections: [],
    selectedDate: null,
    postBg: null,
    postText: '',
    profileTab: 'tout',
    repostPostId: null,
    pendingCommentImage: null,
    showAllLinks: false,
    reduceVideoQuality: true,
    pendingVideoPoster: null,
    postAboutEventId: null,
    aboutEventPickerOpen: false,
    aboutEventSearch: '',
    videoProcessing: false,
    deleteAccountOpen: false,
    deleteAccountBusy: false,
    postsRemotePage: 1,
    postsAllLoaded: false,
    loadingMorePosts: false,
    profileSelectMode: false,
    selectedProfilePostIds: [],
    bulkDeleteConfirmOpen: false,
    bulkDeleteBusy: false,
    viewersPostId: null,
    // Panneau admin (stockage Supabase) — accessible depuis le profil via un code
    adminGateOpen: false,
    adminCodeInput: '',
    adminCodeError: false,
    adminUnlocked: false,
    storageStatsOpen: false,
    storageStatsLoading: false,
    storageStatsError: null,
    storageStatsTotalBytes: 0,
    storageStatsFileCount: 0,
    storageStatsUpdatedAt: null,
    // Événements : image unique + modification via le formulaire dédié
    eventImage: null,
    eventImageProcessing: false,
    editEventId: null,
    // Position courante dans chaque carrousel d'événements, par date
    eventGroupIdx: {}
  };

  // Code d'accès au panneau admin (stockage). Volontairement en clair côté client
  // (comme le reste de cette app) — protège juste contre un accès accidentel, pas
  // contre quelqu'un qui inspecte le code source.
  var ADMIN_ACCESS_CODE = 'AZ7887';
  // Ancien code du champ "Autre" à l'inscription (désormais retiré du formulaire) :
  // promeut le compte connecté au rôle Grand Responsable, saisi dans le même champ
  // que ADMIN_ACCESS_CODE ci-dessus.
  var GRAND_RESPONSABLE_CODE = 'ADMIN78';

  // ============================================================
  // LIEN PROFOND VERS UNE PUBLICATION (?post=ID)
  // Utilisé quand quelqu'un ouvre un lien copié/partagé (ex: WhatsApp) via
  // /api/p/:id, qui redirige vers l'appli avec ce paramètre.
  // ============================================================
  var _deepLinkPostId = (function() {
    try { return new URLSearchParams(location.search).get('post'); } catch(e) { return null; }
  })();
  function tryOpenDeepLinkedPost() {
    if (!_deepLinkPostId || !S.user) return;
    var posts = db(SK.POSTS, []);
    var target = posts.find(function(p){ return p.id === _deepLinkPostId; });
    if (!target) return; // Pas encore chargé (sync en cours) : on retentera au prochain appel.
    var id = _deepLinkPostId;
    _deepLinkPostId = null;
    S.tab = 'home'; S.q = ''; S.story = 'all';
    render();
    setTimeout(function() {
      var el = document.getElementById('post-' + id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'box-shadow 0.4s';
        el.style.boxShadow = '0 0 0 3px #007AFF inset';
        setTimeout(function(){ el.style.boxShadow = ''; }, 2200);
      }
    }, 350);
    // Nettoie l'URL pour éviter de rejouer le scroll à chaque rafraîchissement.
    try { history.replaceState(null, '', location.pathname); } catch(e){}
  }

  // ============================================================
  // RESTORE SESSION
  // ============================================================
  (function restoreSession() {
    try {
      var uStr = localStorage.getItem(SK.SESS) || sessionStorage.getItem(SK.SESS);
      if (uStr) {
        var parsedU = JSON.parse(uStr);
        var users = db(SK.USERS, []);
        var freshU = users.find(function(x){ return x.id === parsedU.id; }) || parsedU;
        S.user = freshU;
        S.auth = 'app';
        localStorage.setItem(SK.SESS, JSON.stringify(freshU));
      }
    } catch(e) {}
    // Restore saved posts
    S.savedPosts = db(SK.SAVED, {});
    // Panneau admin déjà déverrouillé sur cet appareil (pas besoin de retaper le code)
    try { S.adminUnlocked = localStorage.getItem('kc_admin_unlocked') === '1'; } catch(e) {}
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

  var ROLE_LABELS = {
    GRAND_RESPONSABLE: '👑 Grand Resp.',
    RESP_SECTION: '🎬 Responsable',
    MEMBRE: '🎥 Membre',
    STAGIAIRE: '✏️ Stagiaire'
  };
  function roleLabel(role) { return ROLE_LABELS[role] || ROLE_LABELS.MEMBRE; }

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

  // Formate un nombre d'octets en Ko/Mo/Go lisible (panneau admin — stockage)
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 Ko';
    var units = ['Ko', 'Mo', 'Go', 'To'];
    var val = bytes / 1024;
    var i = 0;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return val.toFixed(val >= 10 ? 0 : 1) + ' ' + units[i];
  }

