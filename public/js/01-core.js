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
    SECTION_SEEN: 'kc_section_seen',
    DMS: 'kc_dms'
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
  // MENTIONS (@Prénom Nom) — notifie chaque membre tagué dans un texte
  // (publication, commentaire, réponse). Réutilise la même logique de
  // correspondance que hashtagify() dans 02-media.js.
  // ============================================================
  // Annonce l'arrivée d'un nouveau membre à tous les comptes existants.
  // Écriture groupée : une seule sauvegarde locale et un seul aller-retour par
  // profil, plutôt qu'une réécriture complète du fichier des membres par personne.
  function announceNewMember(newUser) {
    if (!newUser || !newUser.id) return;
    var allUsers = db(SK.USERS, []);
    var secs = getUserSections(newUser).map(function(s){ return secNom(s); }).filter(Boolean).join(' · ');
    var notif = {
      id: 'n_new_' + newUser.id,
      senderId: newUser.id,
      senderName: (newUser.prenom || '') + ' ' + (newUser.nom ? newUser.nom.charAt(0) + '.' : ''),
      senderAvatar: newUser.avatar_url || null,
      senderColor: newUser.avatar_color || '#007AFF',
      type: 'NEW_MEMBER',
      title: '🎉 Nouveau membre',
      text: 'a rejoint Commit' + (secs ? ' · ' + secs : '') + '.',
      targetId: newUser.id,
      timestamp: Date.now(),
      read: false
    };

    var touched = [];
    allUsers.forEach(function(u) {
      if (!u || !u.id || u.id === newUser.id) return;
      if (!Array.isArray(u.notifications)) u.notifications = [];
      if (u.notifications.some(function(n){ return n.id === notif.id; })) return;
      u.notifications.unshift(Object.assign({}, notif));
      if (u.notifications.length > 50) u.notifications = u.notifications.slice(0, 50);
      touched.push(u);
    });
    if (touched.length === 0) return;

    dbSet(SK.USERS, allUsers);
    if (supabase) {
      supabase.from('kun_com_profiles')
        .upsert(touched.map(function(u){ return { id: u.id, content: u }; }), { onConflict: 'id' })
        .then(function(){}, function(e){ console.warn('Annonce nouveau membre :', e); });
    }
  }

  // Jetons de mention collective : @tous notifie tout le monde.
  var MENTION_ALL_TOKENS = ['tous', 'toutes', 'all', 'everyone', 'tout'];

  function normalizeMention(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // retire les accents
      .replace(/[\s_.-]/g, '');
  }

  // À quoi correspond un jeton @xxx ? Retourne
  // { kind:'all' } | { kind:'section', section } | { kind:'user', user } | null
  function resolveMentionToken(token, users) {
    var clean = normalizeMention(token);
    if (!clean) return null;
    if (MENTION_ALL_TOKENS.indexOf(clean) !== -1) return { kind: 'all' };
    var sec = SECTIONS.find(function(s) {
      return normalizeMention(s.id) === clean || normalizeMention(s.nom) === clean;
    });
    if (sec) return { kind: 'section', section: sec };
    var list = users || db(SK.USERS, []);
    var found = list.find(function(u) {
      var fullName = normalizeMention((u.prenom||'') + (u.nom||''));
      var prenom = normalizeMention(u.prenom||'');
      return fullName === clean || prenom === clean;
    });
    if (found) return { kind: 'user', user: found };
    return null;
  }

  function notifyMentionedUsers(text, targetId) {
    if (!text) return;
    var matches = text.match(/@[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ_.-]+/gi);
    if (!matches) return;
    var users = db(SK.USERS, []);
    var meId = S.user ? S.user.id : null;
    var author = S.user ? S.user.prenom : 'Quelqu\'un';
    var extract = '"' + text.slice(0, 40) + (text.length > 40 ? '…' : '') + '"';

    // On rassemble d'abord TOUS les destinataires, puis on notifie une seule fois
    // chacun : sans cela « @tous @Régie » enverrait deux notifications aux membres
    // de la Régie.
    var targets = {};
    var reason = {};
    matches.forEach(function(m) {
      var r = resolveMentionToken(m.slice(1), users);
      if (!r) return;
      if (r.kind === 'all') {
        users.forEach(function(u) {
          if (!u || !u.id || u.id === meId) return;
          if (!targets[u.id]) { targets[u.id] = u.id; reason[u.id] = 'tout le monde'; }
        });
      } else if (r.kind === 'section') {
        users.forEach(function(u) {
          if (!u || !u.id || u.id === meId) return;
          if (getUserSections(u).indexOf(r.section.id) === -1) return;
          if (!targets[u.id]) { targets[u.id] = u.id; reason[u.id] = 'le pôle ' + r.section.nom; }
        });
      } else if (r.kind === 'user') {
        if (r.user.id === meId) return;
        targets[r.user.id] = r.user.id;
        reason[r.user.id] = null;                 // mention nominative
      }
    });

    Object.keys(targets).forEach(function(uid) {
      var why = reason[uid];
      sendNotificationToUser(uid, {
        type: 'MENTION',
        title: '📣 Vous avez été mentionné(e)',
        text: why
          ? author + ' a mentionné ' + why + ' : ' + extract
          : author + ' vous a mentionné : ' + extract,
        targetId: targetId
      });
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
      // Les événements PASSÉS ne sont plus rapatriés (la synchronisation ne demande
      // que les événements en cours et à venir, pour qu'un nouveau membre n'hérite
      // pas de tout l'historique). Leur absence de la réponse ne prouve donc rien :
      // les purger effacerait l'historique de planning des membres déjà en place.
      var todayIso = new Date().toISOString().split('T')[0];
      Object.keys(map).forEach(function(id) {
        var p = map[id];
        if (!p) return;
        if (remotePostIds[id]) return;                        // toujours présente
        if (p.type === 'EVENT' && p.eventDate && p.eventDate < todayIso) return;  // hors périmètre de la requête
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
      // 3 requêtes en parallèle :
      //  - la page récente de publications (fil normal, paginé)
      //  - les événements EN COURS ET À VENIR uniquement : un nouveau membre doit
      //    voir le planning à partir de son arrivée, pas tout l'historique de
      //    l'équipe. Les événements passés restent visibles pour ceux qui les ont
      //    déjà en cache (leur propre historique).
      //  - les profils
      var _todayIso = new Date().toISOString().split('T')[0];
      var _results = await Promise.all([
        supabase.from('kun_com_posts').select('*').order('created_at', { ascending: false }).range(0, POSTS_PAGE_SIZE - 1),
        supabase.from('kun_com_profiles').select('*'),
        supabase.from('kun_com_posts').select('*')
          .eq('content->>type', 'EVENT')
          .gte('content->>eventDate', _todayIso)
          .order('created_at', { ascending: false }).limit(400)
      ]);
      var res = _results[0];
      var resProf = _results[1];
      var resEvents = _results[2];
      if (res && res.error) { console.warn('Supabase posts fetch error:', res.error); }
      if (resEvents && resEvents.error) { console.warn('Supabase events fetch error:', resEvents.error); }
      if (res && res.data) {
        S.postsAllLoaded = res.data.length < POSTS_PAGE_SIZE;
        // La purge se calcule sur la SEULE page courante : y mêler les événements
        // anciens repousserait la borne "plus ancien de la page" très loin en
        // arrière et ferait supprimer des publications valides simplement absentes
        // de cette page.
        var mergedPosts = mergePostsWithLocal(res.data, true);
        // Les événements sont ensuite ajoutés SANS purge (fusion purement additive),
        // pour qu'un nouveau compte voie tout le planning même ancien.
        if (resEvents && resEvents.data && resEvents.data.length) {
          DB_CACHE[SK.POSTS] = mergedPosts;
          mergedPosts = mergePostsWithLocal(resEvents.data, false);
        }
        dbSet(SK.POSTS, mergedPosts);
        var pageData = res.data;
        // Renvoie vers Supabase les publications créées hors-ligne et pas encore
        // synchronisées — repéré via leur horodatage très récent (pas juste "absent de
        // cette page"), car avec la pagination un post ancien peut légitimement être
        // absent de cette page sans être "local uniquement". On évite ainsi de renvoyer
        // tout l'historique local à chaque sync, ce qui ne passerait pas à l'échelle.
        var remotePostIds = pageData.map(function(item){ return item.id; });
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
    // Chaque section se note désormais critère par critère (voir EVAL_CRITERIA).
    // La note globale est la moyenne des critères notés, elle n'est plus saisie
    // directement ni inventée aléatoirement comme avant.
    ratings: {
      cadrage: { criteria: {}, comment: '' },
      web: { criteria: {}, comment: '' },
      proj: { criteria: {}, comment: '' },
      prod: { criteria: {}, comment: '' },
      regie: { criteria: {}, comment: '' },
      photo: { criteria: {}, comment: '' },
      vente: { criteria: {}, comment: '' }
    },
    // Section actuellement dépliée dans l'écran Notation (accordéon)
    evalExpandedSection: null,
    // Onglet Notation : 'noter' (saisie d'un bilan) ou 'suivi' (tableau de bord)
    debriefView: 'noter',
    scoreboardOpen: null,
    scoreboardAll: false,
    // Position courante dans le carrousel d'une publication d'évaluation
    evalCarouselIdx: {},
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
    eventGroupIdx: {},
    // Enregistrement d'arrivée : événement pour lequel la publication en cours
    // vaut pointage (distinct de postAboutEventId, purement informatif).
    postCheckInEventId: null,
    // Sondage optionnel attaché à la publication en cours de création.
    pollOpen: false,
    pollQuestion: '',
    pollOptions: ['', ''],
    // Réponses imbriquées aux commentaires
    replyingToCommentId: null,
    replyingToAuthor: null,
    // Gestion des assignations sur un événement existant (responsables de pôle)
    assignManagerId: null,
    // Enregistrement d'une modification d'événement : écraser ou dupliquer
    eventSaveChoiceOpen: false,
    eventSaveMode: null,
    // Géolocalisation (arrivées + lieu d'un événement)
    geoCapturing: false,
    // Recherche d'adresse pour situer le lieu d'un événement. Le créateur prépare
    // souvent l'événement à l'avance depuis chez lui : on ne relève donc JAMAIS sa
    // position, il désigne le lieu en le cherchant par son nom ou son adresse.
    eventPlaceQuery: '',
    eventPlaceResults: [],
    eventPlaceSearching: false,
    eventPlaceError: null,
    // Messagerie privée simple (1-à-1)
    dmOpen: false,
    dmWithUserId: null,
    dmMessages: [],
    dmLoading: false
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

  // Critères d'évaluation d'une section. Chacun se note indépendamment des autres
  // (auparavant une seule note globale était saisie, et les critères affichés dans
  // la publication étaient générés aléatoirement autour d'elle — d'où des notes
  // incohérentes avec ce qui avait réellement été saisi).
  // NOTE : la Ponctualité ne figure PAS ici — elle n'est plus saisie à la main.
  // Elle est calculée automatiquement à partir de l'heure de publication du membre
  // assigné (voir punctualityStars / sectionPunctuality ci-dessous) puis injectée
  // dans le bilan au moment de la publication.
  var EVAL_CRITERIA = [
    { id: 'technique',   nom: 'Technique' },
    { id: 'reactivite',  nom: 'Réactivité' },
    { id: 'esprit',      nom: "Esprit d'équipe" }
  ];

  // ============================================================
  // PONCTUALITÉ AUTOMATIQUE
  // ============================================================
  // Un membre assigné à un événement publie en arrivant sur place, en liant sa
  // publication à l'événement ("À propos de"). L'écart entre l'heure de début de
  // l'événement et l'heure de cette publication donne sa note de ponctualité.
  // Barème par paliers de 15 min ; au-delà d'1h le score devient négatif et devra
  // être rattrapé lors des événements suivants.
  var PUNCTUALITY_SCALE = [
    { maxMinutes: 0,        stars: 5,  label: "À l'heure" },
    { maxMinutes: 15,       stars: 4,  label: 'Retard léger (≤ 15 min)' },
    { maxMinutes: 30,       stars: 3,  label: 'Retard toléré (≤ 30 min)' },
    { maxMinutes: 45,       stars: 2,  label: 'Retard notable (≤ 45 min)' },
    { maxMinutes: 60,       stars: 1,  label: "Retard important (≤ 1 h)" },
    { maxMinutes: 90,       stars: -1, label: 'Retard critique (> 1 h)' },
    { maxMinutes: Infinity, stars: -2, label: 'Retard majeur (> 1 h 30)' }
  ];
  var PUNCTUALITY_ABSENT_STARS = -2;
  // Pointer loin du lieu, ou sans partager sa position, ne vaut pas une arrivée :
  // c'est sanctionné comme une absence. Sans cela, il suffisait de refuser la
  // géolocalisation ou de pointer de chez soi pour obtenir 5★ en toute impunité.
  var PUNCTUALITY_OFFSITE_STARS = -2;

  // ============================================================
  // GÉOLOCALISATION DES ARRIVÉES (transparence anti-triche)
  // ============================================================
  // La position n'est capturée QUE pour les publications rattachées à un
  // événement (enregistrement d'arrivée). On ne géolocalise jamais les
  // publications ordinaires : ce serait exposer le domicile des membres.
  // Une fois attachée, la position ne peut plus être retirée — seule la
  // suppression de la publication la fait disparaître, ce qui se voit.
  // L'application ne sert qu'en Côte d'Ivoire : une position relevée hors des
  // frontières du pays est forcément erronée ou falsifiée. On la marque comme
  // invalide plutôt que de l'accepter en silence.
  var CI_BOUNDS = { minLat: 4.0, maxLat: 10.8, minLng: -8.70, maxLng: -2.40 };
  var COUNTRY_CODE = 'ci';

  function isInIvoryCoast(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    return lat >= CI_BOUNDS.minLat && lat <= CI_BOUNDS.maxLat
        && lng >= CI_BOUNDS.minLng && lng <= CI_BOUNDS.maxLng;
  }

  function capturePosition(timeoutMs) {
    return new Promise(function(resolve) {
      if (!navigator || !navigator.geolocation) {
        resolve({ available: false, reason: 'unsupported' });
        return;
      }
      var done = false;
      var timer = setTimeout(function() {
        if (done) return;
        done = true;
        resolve({ available: false, reason: 'timeout' });
      }, timeoutMs || 12000);

      navigator.geolocation.getCurrentPosition(
        function(pos) {
          if (done) return;
          done = true; clearTimeout(timer);
          var lat = pos.coords.latitude, lng = pos.coords.longitude;
          // Hors Côte d'Ivoire : on conserve les coordonnées (elles restent
          // consultables et parlantes) mais la position n'est pas valable.
          if (!isInIvoryCoast(lat, lng)) {
            resolve({
              available: false,
              reason: 'outside_country',
              lat: lat, lng: lng,
              accuracy: Math.round(pos.coords.accuracy || 0),
              at: Date.now()
            });
            return;
          }
          resolve({
            available: true,
            lat: lat,
            lng: lng,
            accuracy: Math.round(pos.coords.accuracy || 0),
            at: Date.now()
          });
        },
        function(err) {
          if (done) return;
          done = true; clearTimeout(timer);
          // code 1 = permission refusée, 2 = position indisponible, 3 = délai dépassé
          resolve({ available: false, reason: err && err.code === 1 ? 'denied' : 'unavailable' });
        },
        { enableHighAccuracy: true, timeout: timeoutMs || 12000, maximumAge: 0 }
      );
    });
  }

  // Distance en mètres entre deux points (formule de haversine).
  function geoDistance(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var toRad = function(d){ return d * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }

  function formatDistance(m) {
    if (m === null || m === undefined) return '—';
    if (m < 1000) return m + ' m';
    return (Math.round(m / 100) / 10).toString().replace('.', ',') + ' km';
  }

  // Rayon en deçà duquel on considère le membre "sur place". Large à dessein :
  // le GPS est imprécis en intérieur, mieux vaut ne pas accuser à tort.
  var ON_SITE_RADIUS_M = 1500;

  // Distance entre une publication d'arrivée et le lieu de son événement.
  // Retourne null si l'un des deux n'a pas de coordonnées.
  function checkInDistance(post, ev) {
    if (!post || !ev) return null;
    if (!post.geo || !post.geo.available) return null;
    if (typeof ev.eventLat !== 'number' || typeof ev.eventLng !== 'number') return null;
    return geoDistance(post.geo.lat, post.geo.lng, ev.eventLat, ev.eventLng);
  }

  // Libellé lisible de l'état de position d'une publication d'arrivée.
  function geoStatusLabel(geo) {
    if (!geo) return 'Position non enregistrée';
    if (geo.available) return 'Position enregistrée';
    if (geo.reason === 'denied') return 'Position refusée par le membre';
    if (geo.reason === 'unsupported') return 'Position non disponible sur cet appareil';
    if (geo.reason === 'outside_country') return 'Position hors Côte d\'Ivoire';
    return 'Position introuvable';
  }

  // Un événement dont l'heure de fin est antérieure ou égale à l'heure de début
  // se termine le LENDEMAIN (veillée 21:30 → 00:30, par exemple).
  function crossesMidnight(ev) {
    return !!(ev && ev.eventStart && ev.eventEnd && ev.eventEnd <= ev.eventStart);
  }

  // Horodatage de fin d'un événement. null si inconnu.
  function eventEndTimestamp(ev) {
    if (!ev || !ev.eventDate) return null;
    var hhmm = ev.eventEnd || '23:59';
    var t = new Date(ev.eventDate + 'T' + hhmm + ':00').getTime();
    if (isNaN(t)) return null;
    // Sans ce décalage, une veillée se terminant à 00:30 était datée au petit matin
    // du MÊME jour, donc déjà passée : elle s'affichait « Terminé » avant même
    // d'avoir commencé.
    if (crossesMidnight(ev)) t += 24 * 3600 * 1000;
    return t;
  }

  // Un événement est "passé" dès qu'il est TERMINÉ, pas seulement quand sa date
  // est dépassée : un culte du matin doit basculer dans l'historique l'après-midi
  // même, sans attendre le lendemain.
  function isEventPast(ev, nowTs) {
    if (!ev || ev.type !== 'EVENT' || !ev.eventDate) return false;
    var now = nowTs || Date.now();
    var endTs = eventEndTimestamp(ev);
    if (endTs) return endTs < now;
    // Sans heure de fin exploitable, on retombe sur la comparaison de dates.
    return ev.eventDate < new Date(now).toISOString().split('T')[0];
  }

  // Horodatage de début d'un événement (eventDate + eventStart). null si inconnu.
  function eventStartTimestamp(ev) {
    if (!ev || !ev.eventDate) return null;
    var hhmm = ev.eventStart || '00:00';
    var t = new Date(ev.eventDate + 'T' + hhmm + ':00').getTime();
    return isNaN(t) ? null : t;
  }

  // Convertit un retard (en minutes) en note d'étoiles selon le barème.
  function starsForDelay(delayMinutes) {
    if (delayMinutes <= 0) return PUNCTUALITY_SCALE[0].stars;
    for (var i = 0; i < PUNCTUALITY_SCALE.length; i++) {
      if (delayMinutes <= PUNCTUALITY_SCALE[i].maxMinutes) return PUNCTUALITY_SCALE[i].stars;
    }
    return PUNCTUALITY_SCALE[PUNCTUALITY_SCALE.length - 1].stars;
  }

  function labelForDelay(delayMinutes) {
    if (delayMinutes <= 0) return PUNCTUALITY_SCALE[0].label;
    for (var i = 0; i < PUNCTUALITY_SCALE.length; i++) {
      if (delayMinutes <= PUNCTUALITY_SCALE[i].maxMinutes) return PUNCTUALITY_SCALE[i].label;
    }
    return PUNCTUALITY_SCALE[PUNCTUALITY_SCALE.length - 1].label;
  }

  // Ponctualité d'UN membre sur UN événement.
  // Retourne { stars, delayMinutes, label, checkInPostId, absent }.
  // "absent" = assigné mais aucune publication rattachée à l'événement.
  function punctualityStars(userId, eventId, allPosts) {
    var posts = allPosts || db(SK.POSTS, []);
    var ev = posts.find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
    var startTs = eventStartTimestamp(ev);
    if (!ev || !startTs) return null;

    // Première publication d'ARRIVÉE du membre pour cet événement.
    // On s'appuie sur checkInEventId, distinct du lien générique aboutEventId :
    // parler d'un événement dans une publication ne vaut pas pointage.
    var checkIns = posts.filter(function(p) {
      return p.userId === userId && p.checkInEventId === eventId && p.type !== 'EVENT' && p.type !== 'EVALUATION';
    }).sort(function(a,b){ return (a.checkInAt||a.timestamp||0) - (b.checkInAt||b.timestamp||0); });

    if (checkIns.length === 0) {
      return { stars: PUNCTUALITY_ABSENT_STARS, delayMinutes: null, label: 'Aucune publication d\'arrivée', checkInPostId: null, absent: true, geo: null, distance: null, onSite: null };
    }
    var checkIn = checkIns[0];
    // checkInAt = moment où le lien avec l'événement a été établi (voir submitPost /
    // saveEditPost). On retombe sur timestamp pour les publications antérieures à
    // cette mécanique.
    var arrival = checkIn.checkInAt || checkIn.timestamp || 0;
    var delayMinutes = Math.round((arrival - startTs) / 60000);
    var dist = checkInDistance(checkIn, ev);
    var geo = checkIn.geo || null;
    // true = sur place, false = loin, null = impossible à établir
    var onSite = dist === null ? null : dist <= ON_SITE_RADIUS_M;

    var stars = starsForDelay(delayMinutes);
    var label = labelForDelay(delayMinutes);
    var offsite = false;

    // Le lieu ne fait foi que si le responsable l'a renseigné : sans coordonnées
    // d'événement, on ne peut rien reprocher au membre.
    var venueKnown = ev && typeof ev.eventLat === 'number' && typeof ev.eventLng === 'number';
    if (venueKnown) {
      if (!geo || !geo.available) {
        offsite = true;
        stars = PUNCTUALITY_OFFSITE_STARS;
        label = geoStatusLabel(geo) + ' — pointage non validé';
      } else if (onSite === false) {
        offsite = true;
        stars = PUNCTUALITY_OFFSITE_STARS;
        label = 'Pointage à ' + formatDistance(dist) + ' du lieu — non validé';
      }
    }

    return {
      stars: stars,
      delayMinutes: delayMinutes,
      label: label,
      checkInPostId: checkIn.id,
      absent: false,
      // Pointage effectué, mais invalidé faute d'être sur place.
      offsite: offsite,
      geo: geo,
      byEdit: !!checkIn.checkInByEdit,
      distance: dist,
      onSite: onSite
    };
  }

  // ============================================================
  // ASSIGNATIONS : QUI PEUT ASSIGNER QUOI
  // ============================================================
  // - Grand Responsable : assigne n'importe quel membre, et peut confier une tâche
  //   à un pôle entier (à charge pour son responsable de la répartir).
  // - Responsable de section : assigne uniquement les membres de son ou ses pôles,
  //   y compris sur un événement créé par quelqu'un d'autre (typiquement le Grand
  //   Responsable) — c'est lui qui sait qui est de service dans son équipe.
  function isGrandResponsable(u) {
    return !!u && u.role === 'GRAND_RESPONSABLE';
  }
  function isSectionResponsable(u) {
    return !!u && u.role === 'RESP_SECTION';
  }
  function canAssign(u) {
    return isGrandResponsable(u) || isSectionResponsable(u);
  }

  // Pôles sur lesquels l'utilisateur a autorité pour assigner.
  // Le Grand Responsable les a tous.
  function assignableSectionIds(u) {
    if (isGrandResponsable(u)) return SECTIONS.map(function(s){ return s.id; });
    if (isSectionResponsable(u)) return getUserSections(u).slice();
    return [];
  }

  // Membres que l'utilisateur a le droit d'assigner.
  function assignableMembers(u, allUsers) {
    var users = allUsers || db(SK.USERS, []);
    if (isGrandResponsable(u)) return users.slice();
    if (!isSectionResponsable(u)) return [];
    var mine = assignableSectionIds(u);
    return users.filter(function(x) {
      return getUserSections(x).some(function(s){ return mine.indexOf(s) !== -1; });
    });
  }

  // Peut-il intervenir sur les assignations de cet événement ?
  // Oui pour le Grand Responsable, oui pour un responsable de section (limité à
  // ses propres membres), même si l'événement a été créé par un autre.
  function canManageEventAssignments(post, u) {
    if (!post || post.type !== 'EVENT') return false;
    return canAssign(u);
  }

  // Peut-il modifier l'événement lui-même (titre, date, lieu, pôles) ?
  // Réservé au Grand Responsable et au créateur.
  function canEditEvent(post, u) {
    if (!post || !u) return false;
    return isGrandResponsable(u) || post.userId === u.id;
  }

  // Cette assignation relève-t-elle de l'autorité de l'utilisateur ?
  // Sert à empêcher un responsable de retirer les membres d'un autre pôle.
  function canTouchAssignment(a, u, allUsers) {
    if (isGrandResponsable(u)) return true;
    if (!isSectionResponsable(u) || !a) return false;
    var mine = assignableSectionIds(u);
    if (a.isSection) return mine.indexOf(a.sectionId) !== -1;
    if (a.sectionId) return mine.indexOf(a.sectionId) !== -1;
    var users = allUsers || db(SK.USERS, []);
    var target = users.find(function(x){ return x.id === a.userId; });
    if (!target) return false;
    return getUserSections(target).some(function(s){ return mine.indexOf(s) !== -1; });
  }

  // Combien de temps AVANT le début on peut déjà pointer. Arriver en avance est
  // la situation idéale : il serait absurde d'empêcher de l'enregistrer.
  var CHECKIN_EARLY_WINDOW_MS = 3 * 3600 * 1000;   // 3 h avant
  var CHECKIN_LATE_WINDOW_MS  = 3 * 3600 * 1000;   // 3 h après la fin

  // Un membre a-t-il déjà pointé pour cet événement ?
  function hasCheckedIn(userId, eventId, allPosts) {
    var posts = allPosts || db(SK.POSTS, []);
    return posts.some(function(p) {
      return p.userId === userId && p.checkInEventId === eventId
          && p.type !== 'EVENT' && p.type !== 'EVALUATION';
    });
  }

  // Événements pour lesquels l'utilisateur est de service et doit encore pointer.
  function pendingCheckIns(user, allPosts, nowTs) {
    if (!user) return [];
    var posts = allPosts || db(SK.POSTS, []);
    var now = nowTs || Date.now();
    return posts.filter(function(ev) {
      if (ev.type !== 'EVENT') return false;
      if (!(ev.assignments || []).some(function(a){ return a && a.userId === user.id; })) return false;
      var startTs = eventStartTimestamp(ev);
      if (!startTs) return false;
      if (now < startTs - CHECKIN_EARLY_WINDOW_MS) return false;   // trop tôt
      var endTs = eventEndTimestamp(ev) || startTs;
      if (now > endTs + CHECKIN_LATE_WINDOW_MS) return false;      // trop tard
      return !hasCheckedIn(user.id, ev.id, posts);
    }).sort(function(a,b){ return (eventStartTimestamp(a)||0) - (eventStartTimestamp(b)||0); });
  }

  // Historique de ponctualité d'un membre sur une période : tous les événements
  // passés auxquels il était assigné. Alimente l'indice de confiance du profil.
  function punctualityHistory(userId, sinceTs, allPosts) {
    var posts = allPosts || db(SK.POSTS, []);
    var now = Date.now();
    var entries = [];
    posts.forEach(function(ev) {
      if (ev.type !== 'EVENT') return;
      var assigned = (ev.assignments || []).some(function(a){ return a && a.userId === userId; });
      if (!assigned) return;
      var startTs = eventStartTimestamp(ev);
      if (!startTs) return;
      // Un événement à venir ne compte pas encore… SAUF si le membre a déjà pointé
      // (arrivée en avance) : sans cette exception, ses étoiles n'apparaissaient
      // nulle part dans son profil avant l'heure de début.
      if (startTs > now && !hasCheckedIn(userId, ev.id, posts)) return;
      if (sinceTs && startTs < sinceTs) return;        // hors période
      var p = punctualityStars(userId, ev.id, posts);
      if (!p) return;
      entries.push({
        eventId: ev.id,
        eventTitle: ev.eventTitle || 'Événement',
        eventDate: ev.eventDate || '',
        startTs: startTs,
        stars: p.stars,
        delayMinutes: p.delayMinutes,
        label: p.label,
        absent: p.absent
      });
    });
    entries.sort(function(a,b){ return b.startTs - a.startTs; });

    var total = entries.reduce(function(acc, e){ return acc + e.stars; }, 0);
    var average = entries.length ? Math.round((total / entries.length) * 10) / 10 : 0;
    var lateEntries = entries.filter(function(e){ return !e.absent && e.delayMinutes > 0; });
    var avgDelay = lateEntries.length
      ? Math.round(lateEntries.reduce(function(acc,e){ return acc + e.delayMinutes; }, 0) / lateEntries.length)
      : 0;
    var onTimeCount = entries.filter(function(e){ return !e.absent && e.delayMinutes <= 0; }).length;
    // "Dette" à rattraper : somme des étoiles négatives accumulées.
    var debt = entries.filter(function(e){ return e.stars < 0; })
                      .reduce(function(acc,e){ return acc + e.stars; }, 0);
    return {
      entries: entries,
      count: entries.length,
      total: total,
      average: average,
      avgDelay: avgDelay,
      onTimeCount: onTimeCount,
      absentCount: entries.filter(function(e){ return e.absent; }).length,
      debt: debt
    };
  }

  // Ponctualité cumulée d'une SECTION sur un événement : moyenne des étoiles de
  // tous ses membres assignés. C'est le total calculé automatiquement après
  // l'événement, qui alimente le critère Ponctualité du bilan.
  function sectionPunctuality(sectionId, eventId, allPosts, allUsers) {
    var posts = allPosts || db(SK.POSTS, []);
    var users = allUsers || db(SK.USERS, []);
    var ev = posts.find(function(p){ return p.id === eventId && p.type === 'EVENT'; });
    if (!ev) return null;

    var members = (ev.assignments || []).filter(function(a) {
      if (!a || !a.userId) return false;
      var u = users.find(function(x){ return x.id === a.userId; });
      if (!u) return false;
      return getUserSections(u).indexOf(sectionId) !== -1;
    });
    if (members.length === 0) return null;

    var details = [];
    var seen = {};
    members.forEach(function(a) {
      if (seen[a.userId]) return;   // un membre peut avoir plusieurs tâches
      seen[a.userId] = true;
      var p = punctualityStars(a.userId, eventId, posts);
      if (!p) return;
      var u = users.find(function(x){ return x.id === a.userId; });
      details.push({
        userId: a.userId,
        name: u ? ((u.prenom||'') + ' ' + (u.nom||'')).trim() : 'Membre',
        task: a.task || '',
        stars: p.stars,
        delayMinutes: p.delayMinutes,
        label: p.label,
        absent: p.absent,
        geo: p.geo,
        distance: p.distance,
        onSite: p.onSite
      });
    });
    if (details.length === 0) return null;

    var sum = details.reduce(function(acc, d){ return acc + d.stars; }, 0);
    var avg = Math.round((sum / details.length) * 10) / 10;
    return { average: avg, total: sum, count: details.length, details: details };
  }

  // ============================================================
  // SUIVI DES NOTATIONS PAR PÔLE
  // ============================================================
  // Rassemble tous les bilans publiés concernant un pôle sur une période, pour
  // en sortir une moyenne par critère et une tendance. Sans cela, un bilan publié
  // il y a trois semaines est enseveli dans le fil et rien ne montre l'évolution.
  function sectionScoreboard(sectionId, sinceTs, allPosts) {
    var posts = allPosts || db(SK.POSTS, []);
    var entries = [];

    posts.forEach(function(p) {
      if (p.type !== 'EVALUATION' || !p.metadata) return;
      if (sinceTs && (p.timestamp || 0) < sinceTs) return;
      var evals = Array.isArray(p.metadata.evaluations) && p.metadata.evaluations.length
        ? p.metadata.evaluations
        : [{ teamId: null, teamName: p.metadata.teamName, globalScore: p.metadata.globalScore, criteria: p.metadata.criteria, comment: p.caption || '' }];
      evals.forEach(function(ev) {
        // L'ancien format ne portait pas d'identifiant de pôle : on retombe sur le nom.
        var id = ev.teamId;
        if (!id && ev.teamName) {
          var found = SECTIONS.find(function(s){ return s.nom === ev.teamName; });
          id = found ? found.id : null;
        }
        if (id !== sectionId) return;
        entries.push({
          postId: p.id,
          eventId: p.metadata.eventId || null,
          eventTitle: p.metadata.eventTitle || 'Événement',
          timestamp: p.timestamp || 0,
          author: p.author || '',
          globalScore: parseFloat(ev.globalScore) || 0,
          criteria: ev.criteria || {},
          punctuality: ev.punctuality || null,
          comment: ev.comment || ''
        });
      });
    });

    entries.sort(function(a,b){ return b.timestamp - a.timestamp; });   // plus récent d'abord

    // Moyenne par critère, sur les seules évaluations qui le renseignent.
    var critTotals = {}, critCounts = {};
    entries.forEach(function(e) {
      Object.keys(e.criteria).forEach(function(k) {
        var v = parseFloat(e.criteria[k]);
        if (!(v > 0) && v !== 0) return;
        critTotals[k] = (critTotals[k] || 0) + v;
        critCounts[k] = (critCounts[k] || 0) + 1;
      });
    });
    var criteriaAvg = {};
    Object.keys(critTotals).forEach(function(k) {
      criteriaAvg[k] = Math.round((critTotals[k] / critCounts[k]) * 10) / 10;
    });

    var count = entries.length;
    var average = count
      ? Math.round((entries.reduce(function(a,e){ return a + e.globalScore; }, 0) / count) * 10) / 10
      : 0;

    // Tendance : moyenne de la moitié récente comparée à la moitié ancienne.
    var trend = 0;
    if (count >= 2) {
      var half = Math.floor(count / 2);
      var recent = entries.slice(0, half);
      var older = entries.slice(count - half);
      var avgR = recent.reduce(function(a,e){ return a + e.globalScore; }, 0) / recent.length;
      var avgO = older.reduce(function(a,e){ return a + e.globalScore; }, 0) / older.length;
      trend = Math.round((avgR - avgO) * 10) / 10;
    }

    return {
      sectionId: sectionId,
      entries: entries,
      count: count,
      average: average,
      criteriaAvg: criteriaAvg,
      trend: trend,
      lastAt: count ? entries[0].timestamp : null
    };
  }

  // Début du cycle de 15 jours en cours (1–15, puis 16–fin de mois).
  function currentCycleStartTs() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() <= 15 ? 1 : 16).getTime();
  }

  // ============================================================
  // SONDAGES — sondage optionnel attaché à une publication
  // ============================================================
  // Un sondage vit dans post.poll = { question, options:[texte,...], votes:{userId:optionIdx} }.
  // Une seule réponse par membre : revoter change le choix, recliquer sur son
  // choix actuel retire son vote (permet de changer d'avis ou de s'abstenir).

  function pollTotalVotes(poll) {
    if (!poll || !poll.votes) return 0;
    return Object.keys(poll.votes).length;
  }

  function pollOptionVotes(poll, idx) {
    if (!poll || !poll.votes) return 0;
    var n = 0;
    Object.keys(poll.votes).forEach(function(uid) { if (poll.votes[uid] === idx) n++; });
    return n;
  }

  function pollOptionPct(poll, idx) {
    var total = pollTotalVotes(poll);
    if (!total) return 0;
    return Math.round((pollOptionVotes(poll, idx) / total) * 100);
  }

  // Choix actuel d'un membre pour ce sondage, ou null s'il n'a pas voté.
  function pollUserVote(poll, userId) {
    if (!poll || !poll.votes || !userId) return null;
    var v = poll.votes[userId];
    return (v === undefined) ? null : v;
  }

  // Retrouve le bilan déjà publié par l'utilisateur courant pour cet événement.
  // Un responsable n'a qu'un seul bilan par événement : le re-noter met à jour
  // la publication existante au lieu d'en créer une nouvelle.
  function findOwnBilan(eventId) {
    if (!S.user || !eventId) return null;
    return db(SK.POSTS, []).find(function(p) {
      return p.type === 'EVALUATION'
        && p.userId === S.user.id
        && p.metadata && p.metadata.eventId === eventId;
    }) || null;
  }

  // Moyenne des critères effectivement notés (0 si aucun).
  function ratingAverage(critObj) {
    if (!critObj) return 0;
    var vals = EVAL_CRITERIA.map(function(c){ return critObj[c.id] || 0; }).filter(function(v){ return v > 0; });
    if (vals.length === 0) return 0;
    var sum = vals.reduce(function(a,b){ return a+b; }, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }

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

