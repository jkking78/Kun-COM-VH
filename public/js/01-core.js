// KUN COM VH — Partie 1/8 : État global, stockage, notifications, sections, session (v80)

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
    DMS: 'kc_dms',
    LIEUX: 'kc_lieux'
  };

  var DB_CACHE = {};
  // Empêche la boucle infinie focus->render->focus quand on refocus programmatiquement
  // un input recréé par un render() complet (le nouvel input déclenche son propre onfocus).
  var _restoringSearchFocus = false;

  // ============================================================
  // INSTAGRAM-STYLE TARGETED NOTIFICATION SYSTEM
  // ============================================================
  // Ne conserve une photo que si c'est une URL hébergée (quelques dizaines
  // d'octets). Une image en base64 est refusée : recopiée dans chaque
  // notification, elle a saturé à elle seule tout le stockage local.
  function avatarLeger(url) {
    if (typeof url !== 'string' || !url) return null;
    if (url.indexOf('data:') === 0) return null;
    return url.length > 500 ? null : url;
  }

  // Une erreur Supabase vient-elle du réseau (à retenter) ou d'un refus du
  // serveur (droits, données invalides : inutile de retenter) ? Les refus
  // portent un code PostgreSQL / PostgREST ('42501', 'PGRST116'...) ; une
  // requête qui n'a pas abouti n'en a pas.
  function estErreurReseau(e) {
    return !(e && typeof e.code === 'string' && e.code.length > 0);
  }

  // Adresse d'un média ou d'un lien venue des données : refuse les schémas
  // exécutables (javascript:, data: autre qu'image/vidéo...) et renvoie
  // l'adresse brute, ou '' si elle est refusée.
  function urlSure(u) {
    if (typeof u !== 'string' || !u) return '';
    var debut = u.slice(0, 40).replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
    if (/^(javascript|vbscript|file):/.test(debut)) return '';
    if (debut.indexOf('data:') === 0 && !/^data:(image|video)\//.test(debut)) return '';
    return u;
  }
  // Couleur venue des données (avatar, fond...) placée dans un attribut style :
  // une valeur libre pourrait refermer l'attribut. Seules les formes simples
  // passent, sinon la couleur de repli.
  function couleurSure(c, repli) {
    if (typeof c === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(c.trim())) return c.trim();
    return repli || '#0B5FE0';
  }

  // Fond de publication (couleur unie ou dégradé) : mêmes précautions, sans
  // guillemets, point-virgule ni url().
  function fondSur(f) {
    if (typeof f !== 'string' || !f) return null;
    return (/^[#\w\s(),.%-]+$/.test(f) && !/url\s*\(/i.test(f) && !/expression/i.test(f)) ? f : null;
  }

  // Assainissement À LA RÉCEPTION des champs que le rendu insère tels quels
  // dans des attributs (style, src) : un membre peut écrire n'importe quoi dans
  // sa fiche ou ses publications via l'API, et le rendu concatène du HTML. On
  // neutralise ici, une fois pour toutes, plutôt qu'à chacun des dizaines
  // d'endroits qui les affichent.
  function assainirAuteur(o, champsCouleur, champsUrl) {
    if (!o || typeof o !== 'object') return o;
    champsCouleur.forEach(function(k) {
      if (o[k] !== undefined && o[k] !== null) o[k] = couleurSure(o[k], '#0B5FE0');
    });
    champsUrl.forEach(function(k) {
      if (typeof o[k] === 'string') o[k] = urlSure(o[k]) || null;
    });
    return o;
  }
  function assainirProfil(r) {
    assainirAuteur(r, ['avatar_color'], ['avatar_url', 'cover_url']);
    if (r && Array.isArray(r.notifications)) {
      r.notifications.forEach(function(n){ assainirAuteur(n, ['senderColor'], ['senderAvatar']); });
    }
    return r;
  }
  function assainirPost(p) {
    if (!p || typeof p !== 'object') return p;
    assainirAuteur(p, ['avatarColor', 'avatar_color'], ['avatar_url', 'videoPoster', 'originalVideoPoster', 'eventImage']);
    ['postBg', 'originalPostBg'].forEach(function(k) {
      if (p[k] !== undefined && p[k] !== null) p[k] = fondSur(p[k]);
    });
    ['mediaUrls', 'originalMediaUrls'].forEach(function(k) {
      if (Array.isArray(p[k])) p[k] = p[k].map(function(u){ return urlSure(u); }).filter(Boolean);
    });
    // Heures et date d'un événement : concaténées telles quelles à une dizaine
    // d'endroits du rendu. Seules les formes « 09:00 » et « 2026-10-25 » passent
    // (le serveur les impose aussi, migration 10).
    ['eventStart', 'eventEnd'].forEach(function(k) {
      if (p[k] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(p[k]))) p[k] = '';
    });
    if (p.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(p.eventDate))) p.eventDate = null;
    if (p.preparation !== undefined) p.preparation = assainirPreparation(p.preparation);
    if (Array.isArray(p.comments)) {
      p.comments.forEach(function(c){ assainirAuteur(c, ['avatarColor'], ['avatar_url', 'imageUrl']); });
    }
    return p;
  }

  // Copie de profil SANS secrets pour toute écriture vers Supabase : le hash
  // legacy du mot de passe et les réponses aux questions de sécurité n'ont
  // rien à faire sur un serveur partagé (l'authentification passe désormais
  // par Supabase Auth, côté serveur).
  function profilSansSecret(u) {
    if (!u || typeof u !== 'object') return u;
    var copie = Object.assign({}, u);
    delete copie.pwd; delete copie.sec_a1; delete copie.sec_a2;
    return copie;
  }

  // Allège une liste de notifications déjà stockée. Sert au nettoyage des
  // données existantes : les notifications écrites par les anciennes versions
  // portent toutes une image en base64 qu'il faut évacuer une bonne fois.
  function allegerNotifications(liste) {
    if (!Array.isArray(liste)) return liste;
    return liste.map(function(n) {
      if (!n || !n.senderAvatar) return n;
      var leger = avatarLeger(n.senderAvatar);
      if (leger === n.senderAvatar) return n;
      var copie = Object.assign({}, n);
      copie.senderAvatar = leger;
      return copie;
    });
  }

  // Guérison passive des profils DISTANTS encore bloqués sur l'ancien format : le
  // nettoyage au démarrage (nettoyerStockageHerite) n'allège que le disque de CET
  // appareil ; il ne réécrit rien côté serveur. Tant qu'un membre n'a pas lui-même
  // rouvert une version qui sait alléger ses notifications, son profil reste lourd
  // sur Supabase — et TOUT appareil qui télécharge la liste complète des profils
  // (démarrage, ou filet de secours à la connexion) doit retélécharger ces
  // mégaoctets hérités à chaque fois. Sur un réseau mobile lent, c'est précisément
  // ce qui rend une connexion interminable. On répare donc discrètement le profil
  // distant dès qu'il paraît anormalement lourd, pour que les téléchargements
  // suivants — les siens comme ceux des autres appareils — soient enfin légers.
  function purgerNotificationsBloateesServeur(remoteData) {
    if (!supabase || !Array.isArray(remoteData)) return;
    remoteData.forEach(function(item) {
      try {
        var brut = typeof item.content === 'string' ? item.content : JSON.stringify(item.content || {});
        // Un profil sain (photo hébergée, jamais en base64) tient largement sous
        // 50 Ko. Au-delà, il porte presque toujours des notifications héritées
        // avec photo recopiée en base64 (jusqu'à 4 Mo relevés pour un seul compte).
        if (!brut || brut.length < 50000) return;
        var propre = parseProfileItem(item);
        if (!propre || !propre.id) return;
        // Depuis la migration 06, le serveur n'accepte de modifier les
        // notifications existantes que sur SA propre fiche : réécrire celle des
        // autres ne ferait que consommer du réseau pour rien.
        if (!S.user || propre.id !== S.user.id) return;
        var allegees = allegerNotifications(propre.notifications);
        var copie = Object.assign({}, propre, { notifications: allegees });
        supabase.from('kun_com_profiles').upsert({ id: propre.id, content: copie }, { onConflict: 'id' })
          .then(function(){}, function(e){ console.warn('Nettoyage serveur (notifications) échoué pour ' + propre.id + ':', e); });
      } catch(e) {}
    });
  }

  // Écrit une notification dans le profil DISTANT d'un utilisateur en relisant
  // D'ABORD sa version serveur la plus fraîche, puis en n'écrivant QUE le
  // résultat fusionné. C'est le correctif central contre les notifications déjà
  // lues qui redevenaient non lues : avant cette fonction, sendNotificationToUser
  // et announceNewMember écrivaient directement leur copie LOCALE (potentiellement
  // vieille de plusieurs minutes sur l'appareil de l'expéditeur) du profil complet
  // du destinataire — écrasant au passage toute lecture qu'il avait faite ailleurs,
  // ou toute autre notification reçue entre-temps. mergeNotifications (utilisé
  // pendant la synchronisation normale) ne pouvait rien y faire : le mal était déjà
  // fait côté serveur avant même que le destinataire ne synchronise quoi que ce soit.
  function pushNotificationToProfile(userId, notif, fallbackProfile) {
    if (!supabase || !userId) return Promise.resolve();
    return supabase.from('kun_com_profiles').select('content').eq('id', userId).single().then(function(res) {
      var fresh = res && res.data && res.data.content;
      if (typeof fresh === 'string') { try { fresh = JSON.parse(fresh); } catch(e){ fresh = null; } }
      var base = (fresh && typeof fresh === 'object') ? fresh : fallbackProfile;
      if (!base) return null;
      var baseNotifs = Array.isArray(base.notifications) ? base.notifications.slice() : [];
      if (!baseNotifs.some(function(n){ return n.id === notif.id; })) {
        baseNotifs.unshift(notif);
        if (baseNotifs.length > 50) baseNotifs = baseNotifs.slice(0, 50);
      }
      var toWrite = Object.assign({}, base, { id: userId, notifications: baseNotifs });
      return supabase.from('kun_com_profiles').upsert({ id: userId, content: toWrite }, { onConflict: 'id' });
    }, function(e){ console.warn('pushNotificationToProfile error:', e); });
  }

  // ============================================================
  // NOTIFICATIONS SUR LE TÉLÉPHONE (Web Push, Edge Function « push »)
  // ============================================================
  function notifierTelephone(destinataire, notifId) {
    try {
      if (!supabase || !supabase.functions || !destinataire || !notifId) return;
      supabase.functions.invoke('push', { body: { action: 'notifier', destinataire: destinataire, notifId: notifId } })
        .then(function(){}, function(){});
    } catch(e) {}
  }
  function pushDisponible() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  // Préférences par type (Paramètres). Les convocations ne se coupent pas ;
  // les J'aime sont coupés par défaut (même règle côté serveur).
  var PREFS_NOTIF = [
    { id: 'rappels', libelle: 'Rappels de service', desc: 'La veille, 2 h avant, oubli de pointage, étapes à préparer' },
    { id: 'messages', libelle: 'Messages', desc: 'Messages privés et canaux de pôle' },
    { id: 'mentions', libelle: 'Mentions', desc: 'Quand on te cite avec @' },
    { id: 'commentaires', libelle: 'Commentaires', desc: 'Sur tes publications' },
    { id: 'jaime', libelle: 'J\'aime', desc: 'Sur tes publications' },
    { id: 'autres', libelle: 'Le reste', desc: 'Nouveaux membres, publications de pôle, bilans' }
  ];
  function prefNotifActive(u, id) {
    var p = (u && u.preferencesNotif) || {};
    if (Object.prototype.hasOwnProperty.call(p, id)) return p[id] !== false;
    return id !== 'jaime';
  }
  function cleEnOctets(b64) {
    var b = String(b64).replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(b + '==='.slice((b.length + 3) % 4));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function sendNotificationToUser(targetUserId, notifData) {
    if (!targetUserId) return;
    var allUsers = db(SK.USERS, []);
    var targetUser = allUsers.find(function(u){ return u.id === targetUserId; });
    if (!targetUser) return;
    
    if (!Array.isArray(targetUser.notifications)) targetUser.notifications = [];
    
    // Anti-doublon : évite deux notifications identiques pour le MÊME fait (ex.
    // un like retiré puis remis tout de suite ne doit pas spammer). Mais quand un
    // commentaire/réponse est fourni, il DOIT entrer dans la comparaison : sinon
    // un 2e commentaire sur la même publication (même targetId+type+senderId,
    // commentId différent) passait pour un doublon du premier et était
    // silencieusement ignoré.
    var exists = targetUser.notifications.find(function(n){
      return n.targetId === notifData.targetId && n.type === notifData.type && n.senderId === (S.user ? S.user.id : 'system')
        && (n.commentId || null) === (notifData.commentId || null);
    });
    if (exists) return;
    
    var newNotif = {
      id: 'n_' + Date.now() + '_' + Math.floor(Math.random()*1000),
      senderId: S.user ? S.user.id : 'system',
      senderName: S.user ? (S.user.prenom + ' ' + (S.user.nom?S.user.nom.charAt(0)+'.':'')) : 'Système',
      // JAMAIS l'image elle-même : une photo en base64 recopiée dans chacune des
      // 50 notifications d'un membre représentait jusqu'à 4 Mo par compte, soit
      // 8 Mo pour deux membres — le stockage local entier saturé, plus rien ne
      // pouvait s'enregistrer. L'affichage retrouve la photo à jour via senderId
      // dans la liste des profils (voir renderNotificationsModal).
      senderAvatar: avatarLeger(S.user ? S.user.avatar_url : null),
      senderColor: S.user ? (S.user.avatar_color || '#0B5FE0') : '#0B5FE0',
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
      sauverSession(targetUser);
    }
    
    pushNotificationToProfile(targetUserId, newNotif, targetUser).then(function(r){
      // Une fois la notification enregistrée dans la fiche du destinataire, le
      // serveur peut la relayer sur son téléphone (il vérifie qu'elle y est).
      if (!(r && r.error) && !(S.user && S.user.id === targetUserId)) notifierTelephone(targetUserId, newNotif.id);
    }, function(e){ console.warn('sendNotificationToUser push error:', e); });

    if (S.user && S.user.id === targetUserId) {
      toast(notifData.title + ' : ' + notifData.text, 'info');
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
          title: 'Service assigné',
          text: 'Tu as été convoqué(e) (' + a.task + ') pour ' + post.eventTitle,
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
            title: 'Événement de pôle',
            text: 'Un nouvel événement "' + post.eventTitle + '" concerne ton pôle.',
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
          title: 'Nouvelle publication de pôle',
          text: (S.user ? S.user.prenom : 'Quelqu\'un') + ' a publié pour ton pôle "' + post.sectionNom + '".',
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
      senderAvatar: avatarLeger(newUser.avatar_url),
      senderColor: newUser.avatar_color || '#0B5FE0',
      type: 'NEW_MEMBER',
      title: 'Nouveau membre',
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
    // Un envoi par profil touché (voir pushNotificationToProfile) : chacun relit sa
    // propre version serveur fraîche avant d'y ajouter la notification, au lieu
    // d'écraser tout le monde avec cette copie locale potentiellement périmée.
    touched.forEach(function(u) {
      pushNotificationToProfile(u.id, Object.assign({}, notif), u).then(function(r){
        if (!(r && r.error)) notifierTelephone(u.id, notif.id);
      }, function(e){ console.warn('Annonce nouveau membre :', e); });
    });
  }

  // Diffuse à TOUT LE MONDE l'arrivée validée d'un membre à un événement, et lie
  // la notification à la publication de pointage (l'ouvrir mène à la publication,
  // elle-même reliée à l'événement). Ne se déclenche qu'UNE fois par pointage.
  function announceArrival(post, ev) {
    if (!post || !post.id || post.arrivalAnnounced) return;
    var author = db(SK.USERS, []).find(function(u){ return u && u.id === post.userId; }) || S.user || {};
    var evTitle = (ev && (ev.eventTitle || ev.caption)) || 'un événement';
    var notif = {
      id: 'n_arr_' + post.id,
      senderId: post.userId,
      senderName: (author.prenom || '') + ' ' + (author.nom ? author.nom.charAt(0) + '.' : ''),
      senderAvatar: avatarLeger(author.avatar_url),
      senderColor: author.avatar_color || '#0E9F6E',
      type: 'ARRIVAL',
      title: 'Arrivée',
      text: 'est arrivé(e) pour « ' + evTitle + ' ».',
      targetId: post.id,               // ouvre la publication de pointage
      timestamp: Date.now(),
      read: false
    };
    // Marque le pointage comme annoncé (persisté) pour ne pas re-notifier.
    var posts = db(SK.POSTS, []);
    var pp = posts.find(function(x){ return x.id === post.id; });
    if (pp) { pp.arrivalAnnounced = true; dbSet(SK.POSTS, posts); post.arrivalAnnounced = true;
      if (supabase) supabase.from('kun_com_posts').upsert({ id: pp.id, content: pp }, { onConflict: 'id' }).then(function(){}, function(){}); }
    else { post.arrivalAnnounced = true; }

    var allUsers = db(SK.USERS, []);
    var touched = [];
    allUsers.forEach(function(u) {
      if (!u || !u.id || u.id === post.userId) return;
      if (!Array.isArray(u.notifications)) u.notifications = [];
      if (u.notifications.some(function(n){ return n.id === notif.id; })) return;
      u.notifications.unshift(Object.assign({}, notif));
      if (u.notifications.length > 50) u.notifications = u.notifications.slice(0, 50);
      touched.push(u);
    });
    if (touched.length === 0) return;
    dbSet(SK.USERS, allUsers);
    touched.forEach(function(u) {
      pushNotificationToProfile(u.id, Object.assign({}, notif), u).then(function(){}, function(e){ console.warn('Annonce arrivée :', e); });
    });
  }

  // Vérification en arrière-plan de la position d'un pointage : jusqu'à 3 essais
  // répartis sur la minute de grâce. Dès qu'une position valable arrive, on
  // l'attache ; si elle est « sur place », on annonce l'arrivée à tout le monde.
  function scheduleCheckInVerify(postId) {
    var attempts = 0;
    var tick = function() {
      attempts++;
      capturePosition(9000, 0, false).then(function(g) {
        var posts = db(SK.POSTS, []);
        var p = posts.find(function(x){ return x.id === postId; });
        if (!p) return;
        var deadline = p.checkInGraceUntil || 0;
        if (g && g.available) {
          p.geo = g; dbSet(SK.POSTS, posts);
          // Relecture fraîche avant l'upsert : réécrire le post entier depuis
          // le cache local pouvait écraser un commentaire/like arrivé entre-temps.
          if (supabase) {
            supabase.from('kun_com_posts').select('content').eq('id', p.id).single()
              .then(function(resGeo){
                var frais = (resGeo && resGeo.data && resGeo.data.content) ? resGeo.data.content : p;
                frais.geo = g;
                return supabase.from('kun_com_posts').upsert({ id: p.id, content: frais }, { onConflict: 'id' });
              })
              .then(function(){}, function(){});
          }
          var ev = posts.find(function(x){ return x.id === p.checkInEventId && isEventLike(x); });
          if (ev && checkInPresence(p, ev) === 'onsite') announceArrival(p, ev);
          try { render(); } catch(e){}
          return; // succès : on arrête les essais
        }
        if (attempts < CHECKIN_MAX_ATTEMPTS && Date.now() < deadline) setTimeout(tick, 20000);
        else { try { render(); } catch(e){} }   // grâce écoulée : le score bascule en non vérifié
      }, function() {
        var posts = db(SK.POSTS, []);
        var p = posts.find(function(x){ return x.id === postId; });
        var deadline = p ? (p.checkInGraceUntil || 0) : 0;
        if (attempts < CHECKIN_MAX_ATTEMPTS && Date.now() < deadline) setTimeout(tick, 20000);
        else { try { render(); } catch(e){} }
      });
    };
    setTimeout(tick, 3000);   // premier réessai peu après la publication
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

  function notifyMentionedUsers(text, targetId, commentId) {
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
        commentId: commentId || null,
        title: 'Tu as été mentionné(e)',
        text: why
          ? author + ' a mentionné ' + why + ' : ' + extract
          : author + ' t\'a mentionné : ' + extract,
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

  // ============================================================
  // SESSION SUPABASE AUTH — source de vérité de l'authentification.
  // Les identifiants vivent dans auth.users (gérés par Supabase). Le RÔLE vient
  // du JWT (app_metadata.role), écrit uniquement côté serveur : un membre ne peut
  // plus se promouvoir Responsable/Admin en modifiant le stockage
  // local ou la base — les policies RLS n'accordent les droits que sur le JWT.
  // ============================================================
  // Inscription en attente de validation (voir migration 07) : la fiche porte
  // approuve === false, posé par le serveur. Les fiches antérieures n'ont pas
  // le champ et restent donc validées. Pour SON compte, le jeton fait foi dès
  // qu'il annonce la validation (la fiche locale peut être en retard).
  function compteEnAttente(u) {
    if (!u || u.approuve !== false) return false;
    if (u.role === 'GRAND_RESPONSABLE' || u.role === 'RESP_SECTION') return false;
    if (S.user && S.user.id === u.id && S.jwtApprouve) return false;
    return true;
  }

  function applyAuthUser(authUser) {
    if (!authUser) { S.user = null; S.auth = 'login'; return; }
    var role = (authUser.app_metadata && authUser.app_metadata.role) || 'MEMBRE';
    S.jwtRole = role;                     // rôle de référence pour l'utilisateur courant
    S.jwtApprouve = !!(authUser.app_metadata && authUser.app_metadata.approuve === true);
    var meta = authUser.user_metadata || {};
    var users = db(SK.USERS, []);
    var me = users.find(function(x){ return x && x.id === authUser.id; });
    if (me) {
      me.role = role;                     // le rôle du JWT fait toujours autorité
      me.email = me.email || authUser.email;
      // Présence : la pastille verte des autres membres se calcule sur la
      // fraîcheur de last_seen_at (voir estEnLigne). On la rafraîchit donc à
      // l'ouverture de session, et on pousse la fiche pour que l'équipe le voie.
      me.is_online = true;
      me.last_seen_at = new Date().toISOString();
      try { dbSet(SK.USERS, users); } catch(e){}
      try {
        if (supabase) supabase.from('kun_com_profiles')
          .upsert({ id: me.id, content: me }, { onConflict: 'id' })
          .then(function(){}, function(){});
      } catch(e){}
      S.user = me;
    } else {
      // Profil pas encore dans le cache local : squelette minimal (complété par la
      // synchronisation) et on garantit que la ligne profil existe côté serveur.
      // On récupère les sections/nom choisis à l'inscription si une confirmation
      // e-mail avait différé la création de la fiche (voir signup > kc_pending_signup).
      var pending = null;
      try {
        var praw = localStorage.getItem('kc_pending_signup');
        if (praw) { var pj = JSON.parse(praw);
          if (pj && pj.email && authUser.email && pj.email.toLowerCase() === authUser.email.toLowerCase()) pending = pj; }
      } catch(e){}
      S.user = { id: authUser.id, email: authUser.email, role: role,
                 phone: meta.phone || (pending && pending.phone) || '',
                 prenom: (pending && pending.prenom) || meta.prenom || '',
                 nom: (pending && pending.nom) || meta.nom || '',
                 sections: (pending && pending.sections) || [],
                 section_id: (pending && pending.section_id) || null,
                 avatar_color: '#0B5FE0', welcomeStars: 5, joined_at: Date.now(),
                 is_online: true, last_seen_at: new Date().toISOString() };
      try { if (pending) localStorage.removeItem('kc_pending_signup'); } catch(e){}
      users.push(S.user);
      try { dbSet(SK.USERS, users); } catch(e){}
      try {
        if (supabase) supabase.from('kun_com_profiles')
          .upsert({ id: S.user.id, content: profilSansSecret(S.user) }, { onConflict: 'id' })
          .then(function(){}, function(){});
      } catch(e){}
    }
    S.auth = 'app';
    try { sauverSession(S.user); } catch(e){}
  }

  // Lien de réinitialisation reçu par e-mail : saisie du nouveau mot de passe.
  // Fenêtre injectée directement dans la page (comme le toast), indépendante
  // de render() : elle doit fonctionner quel que soit l'écran affiché. Remplace
  // window.prompt, qui affichait le mot de passe en clair, n'offrait aucune
  // confirmation et est bloqué dans certaines applis installées (iOS).
  function demanderNouveauMotDePasse() {
    if (document.getElementById('_kcNouveauMdp')) return;
    var fond = document.createElement('div');
    fond.id = '_kcNouveauMdp';
    fond.style.cssText = 'position:fixed;inset:0;z-index:9999998;background:rgba(15,15,20,0.65);display:flex;align-items:center;justify-content:center;padding:16px;';
    fond.innerHTML =
      '<form style="width:100%;max-width:340px;background:var(--card,#FFF);color:var(--ink,#0B0D12);border-radius:20px;padding:24px;font-family:var(--font-body,sans-serif);">' +
        '<h3 style="font-size:17px;font-weight:800;margin:0 0 6px;text-align:center;">Nouveau mot de passe</h3>' +
        '<p style="font-size:13px;color:var(--muted,#6B7280);margin:0 0 14px;text-align:center;">8 caractères minimum.</p>' +
        '<input name="mdp1" type="password" autocomplete="new-password" placeholder="Nouveau mot de passe" class="kc-champ" style="' + styleChamp() + 'margin-bottom:8px;">' +
        '<input name="mdp2" type="password" autocomplete="new-password" placeholder="Confirmer" class="kc-champ" style="' + styleChamp() + '">' +
        '<div data-erreur style="color:#D92D20;font-size:13px;font-weight:700;text-align:center;min-height:18px;margin-top:8px;"></div>' +
        '<button type="submit" style="width:100%;min-height:44px;margin-top:6px;background:#0B5FE0;color:#FFF;border:none;border-radius:999px;font-size:15px;font-weight:800;">Enregistrer</button>' +
        '<button type="button" data-annuler style="width:100%;min-height:44px;margin-top:8px;background:none;color:inherit;border:none;font-size:15px;font-weight:600;">Annuler</button>' +
      '</form>';
    document.body.appendChild(fond);
    var form = fond.querySelector('form');
    var erreur = fond.querySelector('[data-erreur]');
    fond.querySelector('[data-annuler]').onclick = function() { fond.remove(); };
    form.onsubmit = function(ev) {
      ev.preventDefault();
      var a = form.mdp1.value, b = form.mdp2.value;
      if (a.length < 8) { erreur.textContent = 'Trop court (8 caractères minimum).'; return; }
      if (a !== b) { erreur.textContent = 'Les deux saisies ne correspondent pas.'; return; }
      erreur.textContent = '';
      supabase.auth.updateUser({ password: a }).then(function(r) {
        if (r && r.error) { erreur.textContent = 'Échec : ' + r.error.message; return; }
        fond.remove();
        toast('Mot de passe mis à jour.', 'success');
      }, function(errUpd) {
        console.warn('updateUser error:', errUpd);
        erreur.textContent = 'Réinitialisation impossible pour le moment.';
      });
    };
    setTimeout(function(){ try { form.mdp1.focus(); } catch(e){} }, 50);
  }

  async function initAuthSession() {
    if (!supabase || !supabase.auth) { S.auth = 'login'; return; }
    try {
      var resp = await supabase.auth.getSession();
      var session = resp && resp.data && resp.data.session;
      if (session && session.user) applyAuthUser(session.user);
      else { S.user = null; S.auth = 'login'; }
    } catch(e) {
      console.warn('initAuthSession:', e); S.auth = 'login';
    }
    try {
      // Garde anti-doublon : initAuthSession peut être rappelée (réessai réseau).
      // Sans lui, chaque appel ré-enregistrait un listener onAuthStateChange →
      // applyAuthUser + render() exécutés N fois par événement.
      if (!supabase._kcAuthListenerAttache) {
        supabase._kcAuthListenerAttache = true;
        supabase.auth.onAuthStateChange(function(event, sess){
          if (event === 'PASSWORD_RECOVERY') {
            demanderNouveauMotDePasse();
            return;
          }
          if (sess && sess.user) applyAuthUser(sess.user);
          else { S.user = null; S.auth = 'login'; }
          try { if (typeof render === 'function') render(); } catch(e){}
        });
      }
    } catch(e){}
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

  // Fusionne deux listes de notifications par identifiant. Règle essentielle :
  // « lu » ne redevient JAMAIS « non lu ». C'est un état à sens unique, décidé
  // par le propriétaire du compte ; le serveur, lui, ne fait que recevoir des
  // écritures d'autres appareils qui n'en savent rien.
  function mergeNotifications(locales, distantes) {
    var A = Array.isArray(locales) ? locales : [];
    var B = Array.isArray(distantes) ? distantes : [];

    var ensureId = function(n) {
      if (!n || typeof n !== 'object') return null;
      var obj = Object.assign({}, n);
      if (!obj.id) {
        obj.id = 'n_' + (obj.timestamp || 0) + '_' + (obj.type || '') + '_' + (obj.targetId || '') + '_' + String(obj.title || '').slice(0, 10);
      }
      // Point de passage obligé de TOUTE notification, locale comme distante :
      // on y évacue les photos en base64 héritées des anciennes versions. Sans
      // ça, les 8 Mo déjà présents sur le serveur reviendraient à chaque
      // synchronisation et resatureraient le stockage aussitôt nettoyé.
      if (obj.senderAvatar) obj.senderAvatar = avatarLeger(obj.senderAvatar);
      return obj;
    };

    A = A.map(ensureId).filter(Boolean);
    B = B.map(ensureId).filter(Boolean);

    // Le plafond s'applique aussi aux raccourcis : sans cela une liste déjà
    // trop longue passait à travers sans être tronquée.
    var plafonne = function(list) {
      var out = list.slice();
      out.sort(function(x, y){ return (y.timestamp || 0) - (x.timestamp || 0); });
      return out.slice(0, 100);
    };
    if (!A.length) return plafonne(B);
    if (!B.length) return plafonne(A);

    var parId = {};
    var ordre = [];
    var prendre = function(n) {
      if (!n || !n.id) return;
      if (!parId[n.id]) { parId[n.id] = Object.assign({}, n); ordre.push(n.id); return; }
      var deja = parId[n.id];
      // Une lecture constatée d'un côté ou de l'autre l'emporte toujours.
      deja.read = !!(deja.read || n.read);
    };
    B.forEach(prendre);   // le serveur fait foi pour la LISTE
    A.forEach(prendre);   // le local fait foi pour les LECTURES

    var out = ordre.map(function(id){ return parId[id]; });
    out.sort(function(x, y){ return (y.timestamp || 0) - (x.timestamp || 0); });
    return out.slice(0, 100);
  }

  // Une seule fiche par adresse e-mail à l'AFFICHAGE. Constaté en production :
  // deux inscriptions du même membre (faites pendant la période où le stockage
  // saturé faisait échouer les connexions) coexistent sur le serveur avec le même
  // e-mail. On ne supprime rien ici — trop risqué tant que des appareils restent
  // connectés sur l'un ou l'autre des doublons — mais l'annuaire, lui, n'a aucune
  // raison de montrer deux fois la même personne. Préférences, dans l'ordre : la
  // fiche du compte connecté sur CET appareil, puis la plus récemment active.
  function profilsUniquesParEmail(liste) {
    if (!Array.isArray(liste)) return liste;
    var parEmail = {};
    var sansEmail = [];
    var ordre = [];
    liste.forEach(function(u) {
      if (!u) return;
      var cle = (u.email || '').toLowerCase().trim();
      if (!cle) { sansEmail.push(u); return; }
      if (!parEmail[cle]) { parEmail[cle] = u; ordre.push(cle); return; }
      var deja = parEmail[cle];
      var estMoi = S.user && S.user.id === u.id;
      var dejaMoi = S.user && S.user.id === deja.id;
      if (dejaMoi) return;
      if (estMoi) { parEmail[cle] = u; return; }
      var actU = Date.parse(u.last_seen_at || 0) || 0;
      var actD = Date.parse(deja.last_seen_at || 0) || 0;
      if (actU > actD) parEmail[cle] = u;
    });
    return ordre.map(function(cle){ return parEmail[cle]; }).concat(sansEmail);
  }

  function parseProfileItem(item) {
    if (!item) return null;
    var r = item;
    if (item.content) {
      if (typeof item.content === 'string') {
        try { r = JSON.parse(item.content); } catch(e){ r = item; }
      } else if (typeof item.content === 'object') {
        r = item.content;
      }
    }
    if (typeof r === 'string') {
      try { r = JSON.parse(r); } catch(e){ return null; }
    }
    if (!r || typeof r !== 'object') return null;
    if (!r.id && item.id) r.id = item.id;
    if (!r.id && r.email) r.id = 'u_' + String(r.email).toLowerCase().replace(/[^a-z0-9]/gi, '_');
    return assainirProfil(r);
  }

  function parsePostItem(item) {
    if (!item) return null;
    var p = item;
    if (item.content) {
      if (typeof item.content === 'string') {
        try { p = JSON.parse(item.content); } catch(e){ p = item; }
      } else if (typeof item.content === 'object') {
        p = item.content;
      }
    }
    if (typeof p === 'string') {
      try { p = JSON.parse(p); } catch(e){ return null; }
    }
    if (!p || typeof p !== 'object') return null;
    if (!p.id && item.id) p.id = item.id;
    // Hygiène d'identité : l'id de profil finit interpolé dans des gestionnaires
    // inline (mentions de profil). Un identifiant au format inattendu est
    // rejeté à l'ingestion plutôt que propagé jusqu'au rendu.
    if (p.id && !/^[A-Za-z0-9_\-]{1,64}$/.test(String(p.id))) return null;
    return assainirPost(p);
  }

  function mergeProfilesWithLocal(remoteData) {
    var localUsers = db(SK.USERS, []);
    var map = {};

    var remoteIds = {};
    (remoteData || []).forEach(function(item) {
      var r = parseProfileItem(item);
      if (r && r.id) remoteIds[r.id] = true;
    });
    var ownIds = localAccountIds();

    // Le serveur Supabase fait autorité pour l'annuaire : une fiche absente du
    // serveur et qui n'est pas la nôtre est retirée du cache (compte supprimé).
    // On ne purge QUE si le serveur a répondu avec au moins une fiche, pour ne
    // pas vider l'annuaire sur une réponse vide fortuite (réseau, erreur).
    var remoteEmpty = !((remoteData || []).length);

    (localUsers || []).forEach(function(raw) {
      var u = parseProfileItem(raw);
      if (!u || !u.id) return;
      var isMine = (S.user && S.user.id === u.id) || ownIds.indexOf(u.id) !== -1;
      if (!remoteIds[u.id] && !isMine && !remoteEmpty) return;
      map[u.id] = u;
    });
    (remoteData || []).forEach(function(item) {
      var rUser = parseProfileItem(item);
      if (rUser && rUser.id) {
        var existing = map[rUser.id] || {};
        var estMoi = S.user && S.user.id === rUser.id;
        // Hygiène des secrets : des fiches legacy pouvaient embarquer le hash
        // du mot de passe et les réponses aux questions de sécurité. L'auth
        // passe désormais par Supabase Auth : ces champs n'ont rien à faire
        // dans un cache partagé — on ne les conserve que pour SA propre fiche.
        if (!estMoi) { delete rUser.pwd; delete rUser.sec_a1; delete rUser.sec_a2; }
        var merged = Object.assign({}, existing, rUser);
        if (estMoi && existing.pwd && !merged.pwd) merged.pwd = existing.pwd;
        if (estMoi && existing.sec_a1 && !merged.sec_a1) merged.sec_a1 = existing.sec_a1;
        if (estMoi && existing.sec_a2 && !merged.sec_a2) merged.sec_a2 = existing.sec_a2;
        merged.notifications = mergeNotifications(existing.notifications, rUser.notifications);
        map[rUser.id] = merged;
      }
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  // Union de deux listes d'identifiants (likes, participants) sans doublon,
  // en conservant l'ordre : local d'abord (état affiché), puis les distants absents.
  function unionSansDoublons(a, b) {
    var out = [];
    var vus = {};
    (a || []).concat(b || []).forEach(function(id) {
      if (id && !vus[id]) { vus[id] = true; out.push(id); }
    });
    return out;
  }

  // Fusion des commentaires local + distant, dédoublonnée par id (les ids sont
  // uniques : 'c' + Date.now()). Le plus complet des deux gagne, l'autre
  // n'est jamais perdu.
  function fusionnerCommentaires(a, b) {
    var map = {};
    var out = [];
    (a || []).concat(b || []).forEach(function(c) {
      if (!c) return;
      var key = c.id || ('idx' + c.timestamp + c.userId);
      if (!map[key]) { map[key] = true; out.push(c); }
    });
    return out;
  }

  // mergePostsWithLocal : fusionne les publications distantes avec le cache local
  // de manière additive et non destructrice. Les anciennes publications conservées
  // localement ne sont JAMAIS effacées par omission (principe Local-First).
  // baseLocal (optionnel) : fusionner par-dessus une liste DÉJÀ EN MÉMOIRE plutôt
  // que de relire le store persistant. Indispensable pour enchaîner deux fusions
  // (posts récents, puis événements) sans perdre la première au passage — voir
  // le bug corrigé dans syncSupabaseToLocal.
  // Écritures de publications parties de cet appareil et pas encore confirmées
  // (id → heure d'envoi), tenues par App._upsertFiable. Les écritures en file
  // d'attente hors connexion sont lues dans kc_pending_writes.
  var ecrituresEnVol = {};
  function idsEcrituresLocalesEnCours() {
    var ids = {};
    Object.keys(ecrituresEnVol).forEach(function(id) {
      if (Date.now() - ecrituresEnVol[id] < 30000) ids[id] = true;
      else delete ecrituresEnVol[id];
    });
    try {
      JSON.parse(localStorage.getItem('kc_pending_writes') || '[]').forEach(function(w) {
        if (w && w.table === 'kun_com_posts' && w.row && w.row.id) ids[w.row.id] = true;
      });
    } catch(e) {}
    return ids;
  }

  function mergePostsWithLocal(remoteData, purgeWindow, baseLocal) {
    var localPosts = baseLocal || db(SK.POSTS, []);
    var enCours = idsEcrituresLocalesEnCours();
    var map = {};
    (localPosts || []).forEach(function(raw) {
      var p = parsePostItem(raw);
      if (p && p.id && p.status !== 'deleted') map[p.id] = p;
    });
    (remoteData || []).forEach(function(raw) {
      var p = parsePostItem(raw);
      if (p && p.id) {
        if (p.status === 'deleted') {
          delete map[p.id];
          return;
        }
        var local = map[p.id];
        if (local && enCours[p.id]) {
          // Une écriture de cet appareil n'est pas encore arrivée au serveur :
          // la copie locale porte le changement, on y ajoute ce que le serveur
          // a reçu d'autres membres (likes, commentaires).
          var fusion = Object.assign({}, p, local);
          fusion.likedBy = unionSansDoublons(local.likedBy, p.likedBy);
          fusion.comments = fusionnerCommentaires(local.comments, p.comments);
          fusion.timestamp = Math.max(local.timestamp || 0, p.timestamp || 0);
          map[p.id] = fusion;
        } else if (local) {
          // Sinon le serveur fait foi : il fusionne lui-même les écritures de
          // chacun (migration 06). Laisser gagner la copie locale gardait une
          // heure ou une assignation périmée, un J'aime retiré, un commentaire
          // modéré. Seul « viewedBy », compté sur l'appareil, est conservé.
          p.viewedBy = unionSansDoublons(local.viewedBy, p.viewedBy);
          map[p.id] = p;
        } else {
          map[p.id] = p;
        }
      }
    });

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

  // ============================================================
  // PROPORTIONS DES MÉDIAS (réservation de la place avant chargement)
  // ============================================================
  // Une image sans dimensions connues occupe ZÉRO pixel tant qu'elle n'est pas
  // chargée : les cartes du fil sont alors plates, et le pied « Vous êtes à jour »
  // se retrouve tout en haut de l'écran, avant même que les publications ne soient
  // visibles. Puis chaque image qui arrive fait grandir sa carte et repousse tout
  // vers le bas. On mémorise donc la proportion de chaque média la première fois
  // qu'il s'affiche, pour réserver ensuite exactement la bonne hauteur.
  var SK_RATIOS = 'kc_media_ratios';
  var MAX_RATIOS = 400;
  var RATIOS_MEDIA = (function() {
    try { return JSON.parse(localStorage.getItem(SK_RATIOS) || '{}') || {}; }
    catch(e) { return {}; }
  })();

  // Clé courte et stable : les URL Supabase sont longues, et le nom de fichier
  // suffit à les distinguer.
  function cleMedia(url) {
    if (typeof url !== 'string' || !url) return null;
    if (url.indexOf('data:') === 0) return null; // média encore en base64, non hébergé
    var sansParams = url.split('?')[0];
    return sansParams.slice(-60);
  }

  function ratioMedia(url) {
    var k = cleMedia(url);
    return (k && RATIOS_MEDIA[k]) ? RATIOS_MEDIA[k] : null;
  }

  function memoriserRatioMedia(url, w, h) {
    var k = cleMedia(url);
    if (!k || !w || !h) return;
    var r = Math.round((w / h) * 1000) / 1000;
    if (!isFinite(r) || r <= 0) return;
    if (RATIOS_MEDIA[k] === r) return;
    RATIOS_MEDIA[k] = r;
    var cles = Object.keys(RATIOS_MEDIA);
    if (cles.length > MAX_RATIOS) {
      // Simple garde-fou de taille : on repart des plus récentes.
      var recentes = {};
      cles.slice(-Math.floor(MAX_RATIOS / 2)).forEach(function(c){ recentes[c] = RATIOS_MEDIA[c]; });
      RATIOS_MEDIA = recentes;
    }
    // Écriture tolérante : ce confort d'affichage ne doit jamais faire échouer
    // quoi que ce soit si le stockage est plein.
    try { localStorage.setItem(SK_RATIOS, JSON.stringify(RATIOS_MEDIA)); } catch(e) {}
  }

  var _syncRetryCount = 0;
  var MAX_SYNC_RETRIES = 4;

  // L'utilisateur est-il en train d'écrire ? Un redessin pendant la saisie efface
  // le contenu des champs (le moteur de diff réaligne la valeur de l'input sur le
  // HTML régénéré, qui est vide), fait sauter le curseur et referme le clavier.
  function saisieEnCours() {
    try {
      var el = document.activeElement;
      if (!el) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true;
    } catch(e) { return false; }
  }

  // ============================================================
  // PUBLICATIONS ORPHELINES (auteur dont le compte a été supprimé)
  // ============================================================
  // Règle demandée : quand un compte est supprimé, TOUTES ses publications
  // disparaissent. La suppression faite depuis l'application s'en charge déjà
  // (App.confirmDeleteAccount pose des pierres tombales). Mais un compte effacé
  // autrement — directement dans la base, par exemple — ne laissait aucune trace
  // exploitable : ses publications restaient visibles indéfiniment, sans auteur.
  // On les traite donc aussi à la source, à chaque synchronisation.
  //
  // Liste des identifiants réellement présents sur le SERVEUR au dernier
  // téléchargement complet des profils. null = on ne sait pas encore : dans le
  // doute on ne masque jamais rien.
  var _idsProfilsServeur = null;

  function memoriserProfilsServeur(remoteData) {
    if (!Array.isArray(remoteData) || !remoteData.length) return;
    var ids = {};
    remoteData.forEach(function(item) {
      var p = parseProfileItem(item);
      if (p && p.id) ids[p.id] = true;
    });
    var count = Object.keys(ids).length;
    if (!count) return;
    // Une lecture tronquée (coupure réseau, réponse partielle) qui perd d'un
    // coup plusieurs comptes d'un seul coup ne doit jamais être prise pour une
    // vague de suppressions réelles — celles-ci se font une par une, depuis
    // l'admin. Sans ce garde-fou, un simple accroc réseau pendant le sondage
    // silencieux (fetchProfilesSilently, toutes les quelques secondes) pouvait
    // faire disparaître définitivement les publications de membres bien vivants
    // au prochain passage de separerOrphelines — c'est exactement ce qui a fait
    // disparaître (puis réapparaître, une fois son profil rechargé à la main)
    // les publications d'un membre qui venait de se déconnecter.
    if (_idsProfilsServeur) {
      var previousCount = Object.keys(_idsProfilsServeur).length;
      if (count < previousCount - 1) return;
    }
    _idsProfilsServeur = ids;
  }

  // Prudence maximale : on ne déclare une publication orpheline que si la liste
  // des profils du serveur est connue ET non vide. Une liste absente ou vide
  // signifierait une panne réseau ou une lecture partielle — et masquer alors
  // tout le fil serait bien pire que le problème à corriger.
  function auteurSupprime(p) {
    if (!p || !p.userId) return false;
    if (!_idsProfilsServeur) return false;
    if (S.user && S.user.id === p.userId) return false;
    // Compte créé sur cet appareil et peut-être pas encore remonté au serveur.
    if (localAccountIds().indexOf(p.userId) !== -1) return false;
    return !_idsProfilsServeur[p.userId];
  }

  function separerOrphelines(posts) {
    var gardees = [], orphelines = [];
    (posts || []).forEach(function(p) {
      if (auteurSupprime(p)) orphelines.push(p); else gardees.push(p);
    });
    return { gardees: gardees, orphelines: orphelines };
  }

  // Supprimer les publications d'un compte ne suffit pas : il laisse des traces
  // DANS celles des autres — ses J'aime (le compteur continuait de les compter),
  // ses commentaires et réponses, ses votes aux sondages, ses vues, et ses
  // assignations sur les événements. On les retire toutes, avec exactement les
  // mêmes garde-fous que pour les publications (voir auteurSupprime).
  // Renvoie la liste nettoyée et celles qui ont réellement changé, pour n'écrire
  // sur le serveur que le strict nécessaire.
  function nettoyerTracesComptesSupprimes(posts) {
    if (!_idsProfilsServeur) return { posts: posts, modifies: [] };
    return retirerTraces(posts, function(uid){ return auteurSupprime({ userId: uid }); });
  }

  // Même nettoyage, mais pour UN compte précis : utilisé au moment où quelqu'un
  // supprime son propre compte, alors qu'il figure encore dans la liste du serveur.
  function retirerTracesDUnCompte(posts, userId) {
    if (!userId) return { posts: posts, modifies: [] };
    return retirerTraces(posts, function(uid){ return uid === userId; });
  }

  function retirerTraces(posts, idSupprime) {
    var modifies = [];

    var sortie = (posts || []).map(function(p) {
      if (!p) return p;
      var change = false;
      var copie = p;
      var muter = function() { if (copie === p) copie = Object.assign({}, p); change = true; };

      if (Array.isArray(p.likedBy)) {
        var jaime = p.likedBy.filter(function(uid){ return !idSupprime(uid); });
        if (jaime.length !== p.likedBy.length) { muter(); copie.likedBy = jaime; }
      }
      if (Array.isArray(p.viewedBy)) {
        var vues = p.viewedBy.filter(function(uid){ return !idSupprime(uid); });
        if (vues.length !== p.viewedBy.length) { muter(); copie.viewedBy = vues; }
      }
      if (Array.isArray(p.comments)) {
        // Un commentaire racine supprimé emporte ses réponses : sans cela, elles
        // resteraient orphelines et sans fil de discussion lisible.
        var racinesParties = {};
        var restants = p.comments.filter(function(c) {
          if (!c) return false;
          if (idSupprime(c.userId)) { if (c.id) racinesParties[c.id] = true; return false; }
          return true;
        }).filter(function(c) {
          return !(c.parentId && racinesParties[c.parentId]);
        });
        if (restants.length !== p.comments.length) { muter(); copie.comments = restants; }
      }
      if (p.poll && p.poll.votes && typeof p.poll.votes === 'object') {
        var votes = {}, retire = false;
        Object.keys(p.poll.votes).forEach(function(uid) {
          if (idSupprime(uid)) retire = true; else votes[uid] = p.poll.votes[uid];
        });
        if (retire) { muter(); copie.poll = Object.assign({}, p.poll, { votes: votes }); }
      }
      if (Array.isArray(p.assignments)) {
        var affect = p.assignments.filter(function(a){ return !(a && a.userId && idSupprime(a.userId)); });
        if (affect.length !== p.assignments.length) { muter(); copie.assignments = affect; }
      }

      if (change) modifies.push(copie);
      return copie;
    });
    return { posts: sortie, modifies: modifies };
  }

  // Enregistre les publications d'autrui dont on vient de retirer les traces d'un
  // compte supprimé. Réservé au Admin, comme pour les pierres
  // tombales : c'est une modification du contenu des autres.
  function enregistrerNettoyageTraces(modifies) {
    if (!supabase || !modifies || !modifies.length) return;
    if (!S.user || S.user.role !== 'GRAND_RESPONSABLE') return;
    modifies.forEach(function(p) {
      supabase.from('kun_com_posts').upsert({ id: p.id, content: p }, { onConflict: 'id' })
        .then(function(){}, function(e){ console.warn('Nettoyage des traces sur ' + p.id + ' :', e); });
    });
    console.log('Traces d\'un compte supprimé retirées de ' + modifies.length + ' publication(s).');
  }

  // Rend la disparition DÉFINITIVE et visible par tous : sans pierre tombale, la
  // fusion étant volontairement additive, les publications reviendraient sur les
  // appareils qui les ont encore en cache. Réservé au Admin : c'est
  // une écriture destructrice, elle ne doit pas partir de n'importe quel appareil.
  function tombaliserOrphelines(orphelines) {
    if (!supabase || !orphelines || !orphelines.length) return;
    if (!S.user || S.user.role !== 'GRAND_RESPONSABLE') return;
    orphelines.forEach(function(p) {
      if (!p || !p.id || p.status === 'deleted') return;
      var pierre = Object.assign({}, p, { status: 'deleted' });
      supabase.from('kun_com_posts').upsert({ id: p.id, content: pierre }, { onConflict: 'id' })
        .then(function(){}, function(e){ console.warn('Nettoyage publication orpheline ' + p.id + ' :', e); });
      try { deleteUnusedMediaFromStorage((p.mediaUrls || []), p.id); } catch(e) {}
    });
    console.log(orphelines.length + ' publication(s) d\'un compte supprimé retirée(s) définitivement.');
  }
  var _syncEnVol = false;
  async function syncSupabaseToLocal() {
    // Garde anti-chevauchement : les réessais programmés pouvaient courir en
    // parallèle d'un déclenchement manuel → doubles upserts de renvoi et
    // courses sur S.syncEnCours/initialLoading dans le finally.
    if (_syncEnVol) return;
    _syncEnVol = true;
    // S.initialLoading ne sert qu'à débloquer l'écran de chargement PLEIN ÉCRAN au
    // bout de 2,5 s — un choix cosmétique pour ne jamais laisser l'utilisateur face
    // à une roue qui tourne indéfiniment. Il ne veut PAS dire que la synchronisation
    // est terminée : sur un réseau mobile lent, la vraie requête peut encore être en
    // vol bien après ce délai. S.syncEnCours, lui, reste vrai jusqu'à ce que cette
    // fonction se termine réellement (bloc finally) — c'est LUI qu'il faut lire pour
    // savoir si un fil vide est un fil vide POUR DE BON ou juste pas encore arrivé.
    // Avant cette distinction : passé les 2,5 s, un appareil sans aucune publication
    // encore en cache affichait « Vous êtes à jour, aucune publication » alors que le
    // téléchargement continuait en arrière-plan — la vraie publication n'apparaissait
    // qu'au rendu suivant, donnant l'impression d'un fil cassé sur réseau lent.
    S.syncEnCours = true;
    // Verrou de sécurité : l'écran de chargement initial ne doit JAMAIS bloquer
    // au-delà de 2,5 s (réseau lent, timeout Supabase, etc.).
    setTimeout(function() {
      if (S.initialLoading) {
        S.initialLoading = false;
        if (window.App && typeof render === 'function' && !saisieEnCours()) render();
      }
    }, 2500);

    if (!supabase) {
      // Ne jamais échouer en silence : sans client Supabase, l'app n'affiche que le
      // cache local et donne l'illusion de fonctionner (aucune publication ni membre
      // des autres utilisateurs). C'est exactement le symptôme à diagnostiquer vite.
      console.error('Aucun client Supabase : l\'application fonctionne en mode local uniquement.');
      S.initialLoading = false; S.syncEnCours = false; _syncEnVol = false; render(); return;
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
        // Borne de pagination : le curseur de la page la plus récente, utilisé
        // ensuite par App.loadMorePosts (pagination par curseur, voir 07).
        if (res.data.length > 0 && res.data[res.data.length - 1] && res.data[res.data.length - 1].created_at) {
          S.postsRemoteCursor = res.data[res.data.length - 1].created_at;
        }
        // La purge se calcule sur la SEULE page courante : y mêler les événements
        // anciens repousserait la borne "plus ancien de la page" très loin en
        // arrière et ferait supprimer des publications valides simplement absentes
        // de cette page.
        var mergedPosts = mergePostsWithLocal(res.data, true);
        // Les événements sont ensuite ajoutés SANS purge (fusion purement additive),
        // pour qu'un nouveau compte voie tout le planning même ancien.
        if (resEvents && resEvents.data && resEvents.data.length) {
          // BUG CORRIGÉ : cet appel relisait auparavant le store PERSISTANT
          // (via db(SK.POSTS,[]) par défaut) au lieu de continuer depuis
          // mergedPosts déjà calculé ci-dessus — donc ÉCRASAIT toute
          // publication venant d'arriver dans res.data mais pas encore
          // enregistrée localement (posts tout juste créés par soi ou par un
          // autre membre). Elles disparaissaient de l'écran jusqu'au cycle de
          // synchronisation silencieuse suivant, qui les retrouvait. On fusionne
          // maintenant explicitement PAR-DESSUS mergedPosts, jamais par-dessus
          // une version périmée du store.
          mergedPosts = mergePostsWithLocal(resEvents.data, false, mergedPosts);
        }
        // Les profils arrivent dans le même lot (requêtes parallèles) : on connaît
        // donc ici, au même instant, qui existe encore. Les publications dont le
        // compte a disparu sont retirées avant même d'être enregistrées, ce qui
        // les fait disparaître de TOUS les écrans d'un coup (fil, planning,
        // profils, recherche) sans avoir à filtrer chacun d'eux séparément.
        if (resProf && resProf.data) memoriserProfilsServeur(resProf.data);
        var triPosts = separerOrphelines(mergedPosts);
        mergedPosts = triPosts.gardees;
        tombaliserOrphelines(triPosts.orphelines);
        // Puis les traces laissées DANS les publications des autres (J'aime,
        // commentaires, votes, vues, assignations).
        var nettoye = nettoyerTracesComptesSupprimes(mergedPosts);
        mergedPosts = nettoye.posts;
        enregistrerNettoyageTraces(nettoye.modifies);
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
        // dbSet et non localStorage.setItem en direct : cette ligne écrivait sans
        // aucune protection et levait QuotaExceededError dès que le stockage était
        // plein. L'exception interrompait alors TOUT le reste de la synchronisation —
        // y compris S.initialLoading = false plus bas — d'où la roue de chargement
        // qui ne s'arrêtait jamais, l'absence d'abonnement temps réel, et la perte
        // silencieuse de la liste des membres et des notifications lues.
        dbSet(SK.USERS, mergedProfiles);
        // Répare les profils distants encore lourds (voir purgerNotificationsBloateesServeur)
        // pendant que la synchronisation est déjà en cours — aucun coût réseau
        // additionnel, cela ne fait qu'écrire les profils déjà téléchargés.
        try { purgerNotificationsBloateesServeur(resProf.data); } catch(e) {}
        if (S.user) {
          var freshMe = mergedProfiles.find(function(x){ return x.id === S.user.id; });
          if (freshMe) {
            if (S.jwtRole) freshMe.role = S.jwtRole;   // le JWT reste la référence du rôle
            S.user = freshMe;
            sauverSession(freshMe);
          }
        }
        // Renvoi rétroactif LIMITÉ au compte connecté sur cet appareil. Auparavant
        // on renvoyait tout profil local absent du serveur : un cache périmé
        // ressuscitait alors les comptes supprimés à chaque synchronisation.
        // Chaque appareil ne fait autorité que sur son propre compte.
        var remoteProfileIds = (resProf.data || []).map(function(item){ return item.id; });
        if (S.user && S.user.id && remoteProfileIds.indexOf(S.user.id) === -1) {
          supabase.from('kun_com_profiles').upsert({ id: S.user.id, content: profilSansSecret(S.user) }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Push profile error:', e); });
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
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kun_com_profiles' }, function(payload) {
             profilRecu(payload);
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
      try { tryOpenDeepLinkedPost(); } catch(e){}
    } catch(e) {
      console.warn("Supabase Sync Error:", e);
      // Un problème de STOCKAGE local (quota dépassé) n'est pas un problème de
      // réseau : réessayer ne fera qu'échouer à l'identique en boucle. On ne
      // relance que sur les erreurs réellement transitoires.
      var quotaSature = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || e)));
      if (!quotaSature && _syncRetryCount < MAX_SYNC_RETRIES) {
        _syncRetryCount++;
        setTimeout(function(){ syncSupabaseToLocal(); }, 1500 * _syncRetryCount);
      }
    } finally {
      // GARANTIE ABSOLUE : quoi qu'il arrive au-dessus — quota saturé, réseau
      // coupé, réponse malformée — l'écran de chargement se libère et l'interface
      // se redessine. C'était le défaut central : une exception en plein milieu
      // (l'écriture des profils, ligne ~599) sautait par-dessus cette libération,
      // et l'application restait bloquée sur la roue indéfiniment.
      S.initialLoading = false;
      S.syncEnCours = false;
      _syncEnVol = false;
      // Ne pas redessiner par-dessus une saisie en cours : sur un réseau mobile
      // lent, la synchronisation se termine souvent pendant que l'utilisateur
      // remplit le formulaire d'inscription, et le redessin lui effaçait ce qu'il
      // venait de taper. (Les champs sont désormais aussi mémorisés dans l'état,
      // ceci évite en plus la perte du curseur et la fermeture du clavier.)
      try { if (!saisieEnCours()) render(); } catch(eRender) { console.warn('Rendu après synchronisation :', eRender); }
    }
  }
  
  
  // P1 : une fiche modifiée arrive par le temps réel avec son contenu. On
  // l'applique telle quelle au lieu de retélécharger toutes les fiches (chaque
  // battement de présence faisait relire l'annuaire entier à tous les membres
  // en ligne : un coût qui croissait comme le carré de leur nombre).
  var _profilsRecus = {};
  var _profilsRecusTimer = null;
  var _profilsSupprimes = {};
  function profilRecu(payload) {
    if (!payload) return;
    if (payload.eventType === 'DELETE') {
      if (payload.old && payload.old.id) _profilsSupprimes[payload.old.id] = true;
    } else if (payload.new && payload.new.id && payload.new.content) {
      _profilsRecus[payload.new.id] = payload.new;
    } else {
      fetchProfilesSilently();   // ligne incomplète (rare) : relecture complète
      return;
    }
    // Regroupement : plusieurs fiches reçues ensemble ne coûtent qu'un rendu.
    if (!_profilsRecusTimer) _profilsRecusTimer = setTimeout(appliquerProfilsRecus, 800);
  }
  // Seuls l'heure de passage et le drapeau « en ligne » ont changé ?
  function seulementPresence(avant, apres) {
    var sans = function(o) { var c = Object.assign({}, o); delete c.last_seen_at; delete c.is_online; return JSON.stringify(c); };
    try { return sans(avant) === sans(apres); } catch(e) { return false; }
  }
  function appliquerProfilsRecus() {
    _profilsRecusTimer = null;
    var lignes = Object.keys(_profilsRecus).map(function(k){ return _profilsRecus[k]; });
    var supprimes = _profilsSupprimes;
    _profilsRecus = {}; _profilsSupprimes = {};
    var users = db(SK.USERS, []).filter(function(u){ return !(u && supprimes[u.id]); });
    var aRedessiner = Object.keys(supprimes).length > 0;
    lignes.forEach(function(ligne) {
      var r = parseProfileItem(ligne);
      if (!r || !r.id) return;
      var i = users.findIndex(function(u){ return u && u.id === r.id; });
      var existant = i !== -1 ? users[i] : {};
      var estMoi = S.user && S.user.id === r.id;
      if (!estMoi) { delete r.pwd; delete r.sec_a1; delete r.sec_a2; }
      var fusion = Object.assign({}, existant, r);
      fusion.notifications = mergeNotifications(existant.notifications, r.notifications);
      if (estMoi && S.jwtRole) fusion.role = S.jwtRole;   // le JWT reste la référence du rôle
      if (i === -1 || !seulementPresence(existant, fusion)) aRedessiner = true;
      if (i === -1) users.push(fusion); else users[i] = fusion;
      if (estMoi) { S.user = fusion; try { sauverSession(fusion); } catch(e) {} }
    });
    dbSet(SK.USERS, users);
    // Une simple présence ne redessine rien : la pastille suit au rendu suivant.
    if (aRedessiner && !saisieEnCours()) render();
  }

  var _fetchProfilesInFlight = false;
  async function fetchProfilesSilently() {
    if (!supabase || _fetchProfilesInFlight) return;
    _fetchProfilesInFlight = true;
    try {
    var resProf = await supabase.from('kun_com_profiles').select('*');
    if (resProf && resProf.data) {
      memoriserProfilsServeur(resProf.data);
      var mergedProfiles = mergeProfilesWithLocal(resProf.data);
      DB_CACHE[SK.USERS] = mergedProfiles;
      try {
        localStorage.setItem(SK.USERS, JSON.stringify(mergedProfiles));
      } catch(eQuotaProfils) {
        // Même chemin d'allègement que dbSet : sans lui, un profil hérité
        // encore lourd faisait échouer CE setItem EN BOUCLE (c'est le chemin de
        // synchro le plus fréquent) — le disque n'était alors jamais rafraîchi.
        try {
          localStorage.setItem(SK.USERS, JSON.stringify(stripHeavyProfilesForStorage(mergedProfiles)));
        } catch(eQuota2) {
          try {
            var minima = profilsMinimum(mergedProfiles, S.user && S.user.id);
            DB_CACHE[SK.USERS] = minima;
            localStorage.setItem(SK.USERS, JSON.stringify(minima));
          } catch(eQuota3) {}
        }
      }
      if (S.user) {
        var freshMe = mergedProfiles.find(function(x){ return x.id === S.user.id; });
        if (freshMe) {
          if (S.jwtRole) freshMe.role = S.jwtRole;   // le JWT reste la référence du rôle
          S.user = freshMe;
          sauverSession(freshMe);
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
    // Déconnecté : le poll de secours (20 s) tournait encore après logout et
    // interrogeait Supabase pour rien, voire redessinait l'écran de connexion.
    if (!S.user || S.auth !== 'app') return;
    _fetchPostsInFlight = true;
    try {
      var res = await supabase.from('kun_com_posts').select('*').order('created_at', { ascending: false }).range(0, POSTS_PAGE_SIZE - 1);
      if (res && res.error) { console.warn('Supabase posts poll error:', res.error); }
      if (res && res.data) {
        if (res.data.length < POSTS_PAGE_SIZE) S.postsAllLoaded = true;
        if (res.data.length > 0 && res.data[res.data.length - 1] && res.data[res.data.length - 1].created_at) {
          S.postsRemoteCursor = res.data[res.data.length - 1].created_at;
        }
        // Profite d'une synchro réussie pour rejouer les écritures restées en
        // file d'attente pendant une coupure réseau.
        try { App.viderFileAttenteEcriture(); } catch(eFlush){}
        var mergedPosts = mergePostsWithLocal(res.data, true);
        var triSilencieux = separerOrphelines(mergedPosts);
        mergedPosts = triSilencieux.gardees;
        tombaliserOrphelines(triSilencieux.orphelines);
        var nettoyeSil = nettoyerTracesComptesSupprimes(mergedPosts);
        mergedPosts = nettoyeSil.posts;
        enregistrerNettoyageTraces(nettoyeSil.modifies);
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

  // Même problème que pour les publications, mais sur les PROFILS — et jamais
  // traité jusqu'ici : une photo de profil ou une couverture encore au format
  // base64 (ancien format, avant l'hébergement des images) pèse plusieurs Mo.
  // Avec une dizaine de membres, le quota localStorage (5 Mo) explose, l'écriture
  // de kc_profiles échoue, et PLUS RIEN ne se sauvegarde : ni la liste des
  // membres, ni les notifications lues (elles sont stockées dans le profil).
  // C'était la cause commune de « l'annuaire à 1 membre » et des « notifications
  // qui redeviennent non lues ». Les images restent servies depuis le serveur.
  function stripHeavyProfilesForStorage(profiles) {
    if (!Array.isArray(profiles)) return profiles;
    var lourd = function(u){ return typeof u === 'string' && u.indexOf('data:') === 0 && u.length > 20000; };
    return profiles.map(function(p) {
      if (!p) return p;
      // Les NOTIFICATIONS étaient de loin le premier poste de consommation :
      // chacune embarquait la photo de son expéditeur en base64. Relevé réel sur
      // l'appareil de l'utilisateur : 8,05 Mo de notifications sur 8,35 Mo au
      // total, dont deux comptes à eux seuls à 3,85 et 4,20 Mo.
      var notifsLegeres = allegerNotifications(p.notifications);
      var notifsChangees = notifsLegeres !== p.notifications;
      if (!lourd(p.avatar_url) && !lourd(p.cover_url) && !notifsChangees) return p;
      var copy = Object.assign({}, p);
      if (lourd(copy.avatar_url)) copy.avatar_url = null;
      if (lourd(copy.cover_url)) copy.cover_url = null;
      if (notifsChangees) copy.notifications = notifsLegeres;
      return copy;
    });
  }

  // Réduit un profil à l'essentiel : dernier recours quand l'allègement des
  // images ne suffit pas. On garde de quoi afficher et identifier un membre —
  // le reste se retrouve au prochain passage du serveur.
  function profilsMinimum(profiles, gardeId) {
    if (!Array.isArray(profiles)) return profiles;
    return profiles.map(function(p) {
      if (!p) return p;
      if (gardeId && p.id === gardeId) return p;   // jamais son propre compte
      return {
        id: p.id, prenom: p.prenom, nom: p.nom, email: p.email, role: p.role,
        sections: p.sections, section_id: p.section_id,
        avatar_url: (typeof p.avatar_url === 'string' && p.avatar_url.indexOf('data:') !== 0) ? p.avatar_url : null,
        avatar_color: p.avatar_color,
        // Pas de secrets ici non plus : ce repli d'urgence n'a pas à recopier
        // hash de mot de passe ni réponses de sécurité hérités.
        notifications: Array.isArray(p.notifications) ? p.notifications.slice(0, 30) : []
      };
    });
  }

  // Écriture locale à tolérance de quota. Le cache mémoire (DB_CACHE) est TOUJOURS
  // mis à jour en premier : même si le disque refuse tout, la session en cours
  // continue de fonctionner normalement. En cas de quota dépassé, on réessaie en
  // allégeant progressivement plutôt que de tout jeter — auparavant un dépassement
  // effaçait purement et simplement le cache des publications.
  function dbSet(key, val) {
    DB_CACHE[key] = val;
    var essais = [];
    if (key === SK.POSTS) {
      essais = [
        function(){ return stripHeavyMediaForStorage(val); },
        function(){ return stripHeavyMediaForStorage(val).slice(0, 40); },
        function(){ return stripHeavyMediaForStorage(val).slice(0, 15); }
      ];
    } else if (key === SK.USERS) {
      essais = [
        function(){ return stripHeavyProfilesForStorage(val); },
        function(){ return profilsMinimum(stripHeavyProfilesForStorage(val), S.user && S.user.id); }
      ];
    } else {
      essais = [ function(){ return val; } ];
    }

    for (var i = 0; i < essais.length; i++) {
      try {
        localStorage.setItem(key, JSON.stringify(essais[i]()));
        return true;
      } catch(e) {
        // Au dernier essai seulement, on libère de la place en sacrifiant le cache
        // des publications (toujours re-téléchargeable) — jamais les profils, qui
        // portent les comptes créés hors-ligne et les notifications lues.
        if (i === essais.length - 1) {
          if (key !== SK.POSTS) { try { localStorage.removeItem(SK.POSTS); DB_CACHE[SK.POSTS] = undefined; } catch(e2){} }
          try { localStorage.setItem(key, JSON.stringify(essais[i]())); return true; } catch(e3) {}
          console.warn('Stockage local saturé pour « ' + key + ' » : la session continue en mémoire.');
        }
      }
    }
    return false;
  }

  // Sauvegarde la session (compte connecté) sans jamais lever d'exception : une
  // écriture de session qui échoue ne doit surtout pas interrompre l'opération en
  // cours (connexion, inscription, synchronisation...). Si le profil complet ne
  // passe pas, on retente sans les images lourdes, puis à l'essentiel.
  function sauverSession(u) {
    if (!u) return false;
    var essais = [
      function(){ return u; },
      function(){ return stripHeavyProfilesForStorage([u])[0]; },
      function(){ return profilsMinimum([u])[0]; }
    ];
    for (var i = 0; i < essais.length; i++) {
      try { localStorage.setItem(SK.SESS, JSON.stringify(essais[i]())); return true; } catch(e) {}
    }
    console.warn('Session non sauvegardée localement (stockage saturé) — la session en cours reste active.');
    return false;
  }

  // NETTOYAGE UNIQUE DU STOCKAGE HÉRITÉ
  // Les versions antérieures recopiaient la photo de l'expéditeur, en base64,
  // dans chacune de ses notifications. Relevé réel sur l'appareil de
  // l'utilisateur : 8,35 Mo de profils, dont 8,05 Mo de notifications — le quota
  // du navigateur entièrement consommé, plus aucune écriture possible.
  // Corriger la source ne suffit pas : ces octets restent sur le disque tant
  // qu'on ne les réécrit pas. On le fait une seule fois, au premier démarrage
  // d'une version qui sait le faire.
  function nettoyerStockageHerite() {
    try {
      if (localStorage.getItem('kc_purge_avatars_notifs') === '1') return;
      var brut = localStorage.getItem(SK.USERS);
      if (brut) {
        var avant = brut.length;
        var profils = JSON.parse(brut);
        if (Array.isArray(profils)) {
          var allegés = profils.map(function(p) {
            if (!p) return p;
            var copie = Object.assign({}, p);
            copie.notifications = allegerNotifications(p.notifications);
            return copie;
          });
          var apres = JSON.stringify(allegés);
          localStorage.setItem(SK.USERS, apres);
          DB_CACHE[SK.USERS] = allegés;
          var gagne = ((avant - apres.length) * 2 / 1048576);
          if (gagne > 0.05) console.log('Nettoyage du stockage : ' + gagne.toFixed(2) + ' Mo libérés.');
        }
      }
      localStorage.setItem('kc_purge_avatars_notifs', '1');
    } catch(e) {
      // Le stockage peut être trop plein pour réécrire : on dégrade en version
      // minimale construite DEPUIS LE CACHE MÉMOIRE (lui reste intact), plutôt
      // que d'effacer le disque — l'ancien repli removeItem() détruisait aussi
      // les comptes créés hors-ligne jamais synchronisés, pourtant conçus pour
      // être protégés via kc_local_accounts.
      try {
        var minimaPurge = profilsMinimum(DB_CACHE[SK.USERS] || [], S.user && S.user.id);
        localStorage.setItem(SK.USERS, JSON.stringify(minimaPurge));
        DB_CACHE[SK.USERS] = minimaPurge;
        localStorage.setItem('kc_purge_avatars_notifs', '1');
        console.warn('Stockage trop saturé : cache des profils dégradé au minimum (comptes locaux conservés).');
      } catch(e2) {
        // Vraiment aucun espace : on n'a plus le choix.
        try {
          localStorage.removeItem(SK.USERS);
          DB_CACHE[SK.USERS] = undefined;
          localStorage.setItem('kc_purge_avatars_notifs', '1');
        } catch(e3) {}
      }
    }
  }
  nettoyerStockageHerite();

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
    // Graphique actif de la carte ponctualité : 'note' | 'ontime' | 'services'
    punctualityChart: 'note',
    // Résultat d'une réinitialisation de mot de passe par l'Admin (mdp provisoire à afficher)
    adminResetResult: null,
    // Page Paramètres (informations, apparence, administration, compte)
    settingsOpen: false,
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
    // Contenu saisi dans les formulaires de connexion / inscription. Conservé ici
    // et non uniquement dans la page, afin qu'un redessin (fin de synchronisation
    // réseau, notamment) ne vide plus les champs en pleine saisie.
    champsAuth: {},
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
    postsRemoteCursor: null,
    postsAllLoaded: false,
    loadingMorePosts: false,
    profileSelectMode: false,
    selectedProfilePostIds: [],
    // Onglet actif de la grille du profil : 'posts' (mes publications) ou
    // 'saved' (celles que j'ai enregistrées avec le signet).
    profileGridTab: 'posts',
    bulkDeleteConfirmOpen: false,
    bulkDeleteBusy: false,
    viewersPostId: null,
    // Panneau « Gérer les rôles » (Admin) — voir renderRolesModal.
    rolesPanelOpen: false,
    // Thème sombre (voir applyTheme / App.toggleTheme).
    darkMode: false,
    // Barre de recherche repliée par défaut (ouverte via l'icône 🔍 de l'en-tête).
    searchOpen: false,
    roleUpdatingId: null,
    // Rôle issu du JWT (app_metadata) : fait autorité pour l'utilisateur courant,
    // même si une fiche serveur porte encore un ancien rôle.
    jwtRole: null,
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
    // Instant de la dernière notification reçue : la cloche flottante secoue
    // pendant 1,5 s à partir de là.
    notifShakeAt: 0,
    // Pile des publications épinglées : repliée par défaut dès qu'il y en a
    // plusieurs, pour ne pas encombrer le haut du fil.
    pinnedOpen: false,
    // Image affichée en grand par-dessus l'écran (commentaires, publications).
    viewerImage: null,
    // Aperçu du lien collé dans le composeur (titre, description, image).
    linkPreview: null,        // objet renvoyé par /api/og
    linkPreviewUrl: null,     // URL pour laquelle l'aperçu a été demandé
    linkPreviewLoading: false,
    linkPreviewDismissed: false,   // l'auteur a retiré l'aperçu à la main
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
        el.style.boxShadow = '0 0 0 3px #0B5FE0 inset';
        setTimeout(function(){ el.style.boxShadow = ''; }, 2200);
      }
    }, 350);
    // Nettoie l'URL pour éviter de rejouer le scroll à chaque rafraîchissement.
    try { history.replaceState(null, '', location.pathname); } catch(e){}
  }

  // ============================================================
  // RESTORE SESSION
  // ============================================================
  // Applique le thème (clair/sombre) via un attribut sur <html> ; les variables
  // CSS (voir injectCSS) font basculer toutes les couleurs neutres.
  function applyTheme() {
    try { document.documentElement.setAttribute('data-theme', S.darkMode ? 'dark' : 'light'); } catch(e) {}
  }

  (function restoreSession() {
    // Thème mémorisé sur cet appareil (avant le 1er rendu, pour éviter un flash).
    try { S.darkMode = localStorage.getItem('kc_dark') === '1'; } catch(e) {}
    applyTheme();
    try {
      var uStr = localStorage.getItem(SK.SESS) || sessionStorage.getItem(SK.SESS);
      if (uStr) {
        var parsedU = JSON.parse(uStr);
        if (parsedU) {
          if (!parsedU.id && parsedU.email) {
            parsedU.id = 'u_' + String(parsedU.email).toLowerCase().replace(/[^a-z0-9]/gi, '_');
          }
          var users = db(SK.USERS, []);
          var freshU = users.find(function(x){ return (x.id && x.id === parsedU.id) || (x.email && x.email.toLowerCase() === (parsedU.email||'').toLowerCase()); }) || parsedU;
          if (!freshU.id && freshU.email) freshU.id = 'u_' + String(freshU.email).toLowerCase().replace(/[^a-z0-9]/gi, '_');
          S.user = freshU;
          S.auth = 'app';
          sauverSession(freshU);
        }
      }
    } catch(e) {}
    // Restore saved posts
    S.savedPosts = db(SK.SAVED, {});
    // Panneau admin déjà déverrouillé sur cet appareil (pas besoin de retaper le code)
    try { localStorage.removeItem('kc_admin_unlocked'); } catch(e) {}
  })();

  // ============================================================
  // SECTIONS
  // ============================================================
  // ============================================================
  // SYSTÈME DE DESIGN — source unique de vérité
  // ============================================================
  // Avant : 29 rayons d'arrondi, 95 dégradés et 145 couleurs différentes
  // éparpillés en dur dans les écrans. C'est cette accumulation qui donnait
  // à l'interface son aspect « généré automatiquement ». Tout passe désormais
  // par cet objet : une seule couleur d'accent, quatre rayons, aucun dégradé
  // hors des cartes d'événement.
  // Les couleurs neutres passent par des VARIABLES CSS (voir injectCSS) pour
  // basculer entre thème clair et sombre sans re-rendre chaque écran.
  var UI = {
    accent:     '#0B5FE0',   // l'unique couleur d'action de l'app (identique clair/sombre)
    accentSoft: 'var(--accent-soft)',
    accentInk:  'var(--accent-ink)',   // texte lisible sur accentSoft
    lien:       'var(--lien)',   // liens et textes bleus : accent en clair, plus lumineux en sombre

    ink:   'var(--ink)',     // titres
    ink2:  'var(--ink2)',    // corps de texte
    muted: 'var(--muted)',   // libellés secondaires
    faint: 'var(--faint)',   // métadonnées, horodatages

    page:  'var(--page)',    // fond d'écran
    card:  'var(--card)',    // surface d'une carte
    tile:  'var(--tile)',    // encadré interne (tuile de statistique)
    line:  'var(--line)',    // filet de séparation
    line2: 'var(--line2)',   // bordure de contrôle

    // Identité réservée aux ÉVÉNEMENTS : vert profond et or. Ce contraste les
    // rend reconnaissables au premier coup d'œil dans le fil, et n'apparaît
    // nulle part ailleurs pour ne pas diluer l'effet.
    evBg:    '#0C2A23',
    evGold:  '#CBA35C',
    evInk:   '#F7F4EE',
    evMuted: '#8FA79E',
    evTag:   'rgba(255,255,255,0.07)',
    evGoldSoft: 'rgba(203,163,92,0.14)',
    evGoldLine: 'rgba(203,163,92,0.40)',

    ok: '#0E9F6E', warn: '#D98A0B', bad: '#D92D20',
    // Fonds pleins sous un texte blanc : assez foncés pour 4,5:1 (le vert et
    // l'orange ci-dessus n'atteignent que 3,4 et 2,8).
    okPlein: '#047857', warnPlein: '#B45309',

    r1: '12px', r2: '16px', r3: '20px', pill: '999px',
    sh:  'var(--sh)',
    sh2: 'var(--sh2)',   // relief doux des cartes détachées (voir injectCSS)

    // Une seule police, Plus Jakarta Sans (voir index.html + injectCSS) : les
    // trois rôles restent nommés, mais pointent tous vers elle. Les chiffres
    // sont à chasse fixe partout (font-variant-numeric), sans police « code ».
    fontDisplay: 'var(--font-display)',  // titres
    fontBody:    'var(--font-body)',     // interface
    fontMono:    'var(--font-mono)'      // données (heures, notes, compteurs)
  };

  // Icônes au trait remplaçant les emoji d'interface. Chaque PÔLE a la sienne
  // (voir SECTIONS), affichée dans sa couleur : l'emoji changeait d'aspect
  // d'un téléphone à l'autre et jurait avec les autres icônes. Les emoji
  // restent dans le CONTENU (badges, réactions, publications).
  var ICO_PATHS = {
    pin:      '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert:    '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    lock:     '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    chart:    '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    message:  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    star:     '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 6.9-1L12 2z"/>',
    check:    '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    users:    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    pinned:   '<path d="M12 17v5"/><path d="M9 2h6l-1 6 3 3v2H7v-2l3-3-1-6z"/>',
    flame:    '<path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3 0 2 1 3 2 3 1.5 0 1-4 2-10z"/>',
    eye:      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    moon:     '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    ban:      '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    pencil:   '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    inbox:    '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.4 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z"/>',
    history:  '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    thumb:    '<path d="M7 22V11l5-9a3 3 0 0 1 3 3v4h4.5a2 2 0 0 1 2 2.4l-1.6 8A2 2 0 0 1 18 22z"/><path d="M7 11H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
    sparkle:  '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    search:   '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    // Pôles
    video:    '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    sliders:  '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    globe:    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    monitor:  '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    film:     '<rect x="2" y="2" width="20" height="20" rx="2.2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
    camera:   '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    cart:     '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    // Interface
    user:     '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    megaphone:'<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>',
    key:      '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    shield:   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    hourglass:'<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"/>',
    refresh:  '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    trash:    '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    x:        '<path d="M18 6L6 18M6 6l12 12"/>',
    layers:   '<path d="M12 2l10 5-10 5L2 7l10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
    locate:   '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
    circle:   '<circle cx="12" cy="12" r="9"/>',
    clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 12l2 2 4-4M9 18h6"/>'
  };

  // Champ de saisie : UN seul style dans toute l'app, celui de la connexion
  // (blanc, arrondi, 52 px). styleChamp(true) → zone de texte. La classe
  // kc-champ donne le contour bleu au focus (voir injectCSS).
  function styleChamp(zoneTexte) {
    return 'width:100%;' +
      (zoneTexte ? 'min-height:96px;padding:14px 16px;border-radius:20px;resize:vertical;line-height:1.45;'
                 : 'height:52px;padding:0 16px;border-radius:26px;') +
      'border:1.5px solid var(--line2);background:var(--card);font:inherit;font-size:15px;color:var(--ink);box-sizing:border-box;outline:none;transition:border-color 0.2s;';
  }
  var STYLE_LIBELLE = 'font-size:13px;font-weight:700;color:var(--ink2);display:block;margin-bottom:6px;';
  // Liste déroulante au même style : la flèche native est remplacée par un
  // chevron (sinon iOS impose son propre rendu gris).
  function styleSelect() {
    return styleChamp() + 'padding-right:44px;-webkit-appearance:none;appearance:none;background-repeat:no-repeat;background-position:right 16px center;' +
      'background-image:url(data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236E7781%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E);';
  }

  // ico('pin', 14, UI.faint) → une icône au trait, taille et couleur libres.
  function ico(name, size, color, strokeWidth) {
    var d = ICO_PATHS[name];
    if (!d) return '';
    var s = size || 16;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="' +
      (color || 'currentColor') + '" stroke-width="' + (strokeWidth || 1.9) +
      '" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;vertical-align:-2px;">' + d + '</svg>';
  }

  // Une couleur par pôle, assez foncée pour porter du texte blanc (contraste
  // AA) et se décliner en teinte claire (couleur + '1F').
  var SECTIONS = [
    { id: 'cadrage', nom: 'Cadrage', emoji: '🎥', icone: 'video',   color: '#0B5FE0' },
    { id: 'regie',   nom: 'Régie',   emoji: '🎛️', icone: 'sliders', color: '#C2410C' },
    { id: 'web',     nom: 'Web',     emoji: '🌐', icone: 'globe',   color: '#0E7490' },
    { id: 'proj',    nom: 'Projection', emoji: '🖥️', icone: 'monitor', color: '#6B2FD0' },
    { id: 'prod',    nom: 'Prod',    emoji: '🎬', icone: 'film',    color: '#A61E4D' },
    { id: 'photo',   nom: 'Photo',   emoji: '📸', icone: 'camera',  color: '#0A6B4A' },
    { id: 'vente',   nom: 'Vente',   emoji: '🛒', icone: 'cart',    color: '#92400E' }
  ];
  // Icône d'un pôle, dans sa couleur par défaut (repli : icône « équipe »).
  // L'emoji reste dans SECTIONS pour les données déjà enregistrées (bilans).
  function icoPole(id, size, color) {
    var s = SECTIONS.find(function(x){ return x.id === id; });
    return s ? ico(s.icone, size, color || s.color) : ico('users', size, color || 'currentColor');
  }
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
    { maxMinutes: 90,       stars: -1, label: 'Retard critique (≤ 1 h 30)' },
    { maxMinutes: Infinity, stars: -2, label: 'Retard majeur (> 1 h 30)' }
  ];
  // Absence : aucune publication d'arrivée pour un membre assigné. Sanction plus
  // lourde qu'un simple retard, car rien ne permet même de mesurer une tentative.
  var PUNCTUALITY_ABSENT_STARS = -2;
  // Pointer loin du lieu, ou sans partager sa position, ne vaut pas une arrivée :
  // c'est sanctionné AU MOINS aussi sévèrement qu'une absence (même valeur). Sans
  // cela, il suffisait de refuser la géolocalisation ou de pointer de chez soi pour
  // obtenir 5★ en toute impunité — et un pointage frauduleux serait alors mieux
  // traité qu'une absence honnête, ce qui viderait l'anti-triche de son sens.
  var PUNCTUALITY_OFFSITE_STARS = -2;

  // Étoiles d'une TÂCHE À LIVRER (assignation portant une deadline, par
  // opposition à une simple présence). Le membre coche lui-même « fait » ; le
  // barème est calculé automatiquement d'après la deadline :
  //   livrée à temps → +5, livrée en retard → +2, jamais livrée → -4.
  var TASK_ON_TIME_STARS = 5;
  var TASK_LATE_STARS = 2;
  var TASK_MISSED_STARS = -2;

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

  // timeoutMs : délai max. maxAgeMs : âge maximal d'un fix déjà connu que l'on
  // accepte de réutiliser (0 = toujours frais). highAccuracy : GPS précis (plus
  // lent) — indispensable au pointage depuis que le rayon « sur place » est de 500 m.
  function capturePosition(timeoutMs, maxAgeMs, highAccuracy) {
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
        { enableHighAccuracy: highAccuracy !== false, timeout: timeoutMs || 12000, maximumAge: maxAgeMs || 0 }
      );
    });
  }

  // Relevé précis de la position, pour situer un lieu quand on y est (bouton
  // « Utiliser ma position actuelle » du formulaire d'événement). Le premier
  // relevé d'un téléphone est souvent grossier : on écoute le GPS quelques
  // secondes et on garde le meilleur, en s'arrêtant dès qu'il est à 15 m près.
  function releverPositionPrecise(dureeMaxMs) {
    return new Promise(function(resolve) {
      if (!navigator || !navigator.geolocation) { resolve({ available: false, reason: 'unsupported' }); return; }
      var meilleur = null, fini = false, ident = null;
      var terminer = function(echec) {
        if (fini) return;
        fini = true;
        clearTimeout(minuterie);
        if (ident !== null) { try { navigator.geolocation.clearWatch(ident); } catch(e) {} }
        if (!meilleur) { resolve(echec || { available: false, reason: 'timeout' }); return; }
        if (!isInIvoryCoast(meilleur.lat, meilleur.lng)) { resolve(Object.assign({ available: false, reason: 'outside_country' }, meilleur)); return; }
        resolve(Object.assign({ available: true }, meilleur));
      };
      var minuterie = setTimeout(function(){ terminer(); }, dureeMaxMs || 12000);
      ident = navigator.geolocation.watchPosition(function(pos) {
        var r = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy || 0), at: Date.now() };
        if (!meilleur || r.accuracy < meilleur.accuracy) meilleur = r;
        if (meilleur.accuracy <= 15) terminer();
      }, function(err) {
        // Un échec après un premier relevé n'efface pas ce relevé.
        if (err && err.code === 1) terminer({ available: false, reason: 'denied' });
        else if (!meilleur && err && err.code !== 3) terminer({ available: false, reason: 'unavailable' });
      }, { enableHighAccuracy: true, timeout: dureeMaxMs || 12000, maximumAge: 0 });
    });
  }

  // ============================================================
  // LIEUX ENREGISTRÉS (migration 11)
  // ============================================================
  // Chaque lieu retenu pour un événement est mémorisé dans la table partagée
  // kun_com_lieux, puis proposé à la saisie, même loin du lieu. Copie locale
  // dans SK.LIEUX pour proposer aussi hors connexion.
  function assainirLieu(l) {
    if (!l || typeof l !== 'object') return null;
    var lat = Number(l.lat), lng = Number(l.lng);
    var nom = String(l.nom || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!nom || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    var prec = Number(l.precision_m);
    return {
      id: String(l.id || ('local:' + nom.toLowerCase())),
      nom: nom,
      adresse: String(l.adresse || '').slice(0, 200),
      lat: lat, lng: lng,
      precision_m: (l.precision_m === null || l.precision_m === undefined || !isFinite(prec)) ? null : Math.round(prec),
      utilisations: Math.max(0, parseInt(l.utilisations, 10) || 0)
    };
  }
  // Mots significatifs d'une saisie : « l'Église VH » → ['eglise', 'vh'].
  // Les articles (l', la, de…) sont ignorés pour que « l'église » trouve
  // « Église Vase d'Honneur ».
  var MOTS_VIDES = ['l', 'd', 'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'au', 'aux', 'et', 'a'];
  function motsDe(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/).filter(Boolean);
  }
  function lieuxCorrespondants(saisie, lieux, max) {
    var liste = (lieux || []).map(assainirLieu).filter(Boolean);
    var mots = motsDe(saisie);
    var utiles = mots.filter(function(m){ return MOTS_VIDES.indexOf(m) === -1; });
    if (!utiles.length) utiles = mots.filter(function(m){ return m.length > 1; });
    var tri = function(a, b){ return b.utilisations - a.utilisations || a.nom.localeCompare(b.nom, 'fr'); };
    if (!utiles.length) return mots.length ? [] : liste.sort(tri).slice(0, max || 6);
    return liste.map(function(l) {
      var motsNom = motsDe(l.nom), motsTout = motsNom.concat(motsDe(l.adresse));
      var ok = utiles.every(function(m){ return motsTout.some(function(w){ return w.indexOf(m) === 0; }); });
      if (!ok) return null;
      // Le nom avant l'adresse : « eglise » trouve d'abord « Église VH ».
      var dansNom = utiles.every(function(m){ return motsNom.some(function(w){ return w.indexOf(m) === 0; }); });
      return { l: l, rang: dansNom ? 0 : 1 };
    }).filter(Boolean).sort(function(a, b){ return a.rang - b.rang || tri(a.l, b.l); })
      .slice(0, max || 6).map(function(x){ return x.l; });
  }
  // Ajoute ou met à jour un lieu dans la copie locale (même règle de nom que
  // le serveur : sans tenir compte des majuscules ni des espaces).
  function memoriserLieuLocal(lieu) {
    var l = assainirLieu(lieu);
    if (!l) return;
    var cle = l.nom.toLowerCase();
    var liste = db(SK.LIEUX, []).filter(function(x){ return x && String(x.nom || '').toLowerCase().trim() !== cle; });
    var ancien = db(SK.LIEUX, []).find(function(x){ return x && String(x.nom || '').toLowerCase().trim() === cle; });
    if (ancien) { l.id = ancien.id || l.id; l.utilisations = (ancien.utilisations || 0) + 1; }
    else l.utilisations = Math.max(1, l.utilisations);
    liste.unshift(l);
    dbSet(SK.LIEUX, liste.slice(0, 300));
  }

  // ============================================================
  // PLAN DE PRÉPARATION D'UN ÉVÉNEMENT (migration 11)
  // ============================================================
  // ev.preparation = { <pôle>: { taches: [{ id, titre, etapes: [{ id, titre,
  // date, fait, faitLe }] }], v, maj_le, maj_par } }. Le responsable du pôle
  // et l'Admin écrivent l'entrée du pôle ; tout le monde la lit.
  var PREP_MAX_TACHES = 60, PREP_MAX_ETAPES = 30;
  function assainirPreparation(prep) {
    var res = {};
    if (!prep || typeof prep !== 'object' || Array.isArray(prep)) return res;
    var texte = function(v, max){ return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''; };
    var ident = function(v){ return typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : ''; };
    SECTIONS.forEach(function(sec) {
      var e = prep[sec.id];
      if (!e || typeof e !== 'object' || !Array.isArray(e.taches)) return;
      res[sec.id] = {
        taches: e.taches.slice(0, PREP_MAX_TACHES).map(function(t) {
          if (!t || typeof t !== 'object') return null;
          var id = ident(t.id), titre = texte(t.titre, 120);
          if (!id || !titre) return null;
          return {
            id: id, titre: titre,
            etapes: (Array.isArray(t.etapes) ? t.etapes : []).slice(0, PREP_MAX_ETAPES).map(function(et) {
              if (!et || typeof et !== 'object') return null;
              var eid = ident(et.id), etitre = texte(et.titre, 160);
              if (!eid || !etitre) return null;
              return {
                id: eid, titre: etitre,
                date: (typeof et.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(et.date)) ? et.date : '',
                fait: et.fait === true,
                faitLe: typeof et.faitLe === 'number' ? et.faitLe : null
              };
            }).filter(Boolean)
          };
        }).filter(Boolean),
        v: typeof e.v === 'number' ? e.v : 0,
        maj_le: typeof e.maj_le === 'number' ? e.maj_le : null,
        maj_par: typeof e.maj_par === 'string' ? e.maj_par : null
      };
    });
    return res;
  }
  // Date du jour en heure LOCALE (toISOString passerait en UTC).
  function isoLocal(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  // Étapes d'un plan (d'un pôle ou de tous), à plat, dans l'ordre des dates.
  function etapesPreparation(prep, poleId) {
    var out = [];
    Object.keys(prep || {}).forEach(function(pid) {
      if (poleId && pid !== poleId) return;
      ((prep[pid] || {}).taches || []).forEach(function(t) {
        (t.etapes || []).forEach(function(e) { out.push({ pole: pid, tache: t, etape: e }); });
      });
    });
    return out.sort(function(a, b) {
      return (a.etape.date || '9999') < (b.etape.date || '9999') ? -1 : (a.etape.date || '9999') > (b.etape.date || '9999') ? 1 : 0;
    });
  }
  // Bilan d'un plan : étapes faites, en retard, prochaine échéance.
  function statsPreparation(prep, poleId) {
    var auj = isoLocal();
    var etapes = etapesPreparation(prep, poleId);
    var taches = 0;
    Object.keys(prep || {}).forEach(function(pid){ if (!poleId || pid === poleId) taches += ((prep[pid] || {}).taches || []).length; });
    var restantes = etapes.filter(function(x){ return !x.etape.fait; });
    return {
      taches: taches,
      total: etapes.length,
      faites: etapes.length - restantes.length,
      enRetard: restantes.filter(function(x){ return x.etape.date && x.etape.date < auj; }).length,
      prochaine: restantes.filter(function(x){ return x.etape.date && x.etape.date >= auj; })[0] || null
    };
  }
  // Qui peut écrire le plan d'un pôle : l'Admin, ou un responsable de ce pôle
  // (même règle que le serveur, kc_peut_preparer).
  function peutPreparer(u, poleId) {
    if (isGrandResponsable(u)) return true;
    return isSectionResponsable(u) && getUserSections(u).indexOf(poleId) !== -1;
  }
  // Étapes d'une tâche dans l'ordre des dates (sans date : à la fin).
  function trierEtapes(etapes) {
    return etapes.sort(function(a, b){ return (a.date || '9999') < (b.date || '9999') ? -1 : (a.date || '9999') > (b.date || '9999') ? 1 : 0; });
  }
  // Identifiant court pour une tâche ou une étape.
  function idPrep(prefixe) {
    return prefixe + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ============================================================
  // PRÉ-CHAUFFAGE DE LA POSITION (pointage sans attente ni pénalité injuste)
  // ============================================================
  // Dès que le membre déclare vouloir pointer, on lance une capture EN AVANCE,
  // pendant qu'il rédige. Au moment de publier, la position est déjà prête :
  // plus d'attente de dernière minute, plus de prompt au pire moment.
  var _prewarmedGeo = null;      // dernier fix exploitable (avec .at)
  var _prewarmInFlight = false;
  function startGeoPrewarm() {
    if (_prewarmInFlight) return;
    // Un bon fix récent (< 90 s) suffit : inutile de relancer.
    if (_prewarmedGeo && _prewarmedGeo.available && _prewarmedGeo.at && (Date.now() - _prewarmedGeo.at) < 90000) return;
    _prewarmInFlight = true;
    // GPS précis (rayon de 500 m) + réutilisation d'un fix jusqu'à 90 s.
    capturePosition(15000, 90000, true).then(function(g) {
      // Ne jamais écraser un bon fix par un refus/échec ultérieur.
      if (g && g.available) _prewarmedGeo = g;
      else if (!_prewarmedGeo) _prewarmedGeo = g;
      _prewarmInFlight = false;
    }, function() { _prewarmInFlight = false; });
  }
  // Position pour le pointage, SANS bloquer l'horodatage : un fix pré-chauffé
  // récent s'il existe, sinon une capture courte (l'heure d'arrivée, elle, est
  // déjà figée par l'appelant avant tout appel GPS).
  function positionForCheckIn() {
    if (_prewarmedGeo && _prewarmedGeo.available && _prewarmedGeo.at && (Date.now() - _prewarmedGeo.at) < 120000) {
      return Promise.resolve(_prewarmedGeo);
    }
    return capturePosition(12000, 60000, true);
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

  // Rayon en deçà duquel on considère le membre "sur place" : 500 m. Le
  // pointage demande donc une position GPS précise (voir positionForCheckIn) :
  // la position approximative du réseau peut se tromper de plusieurs centaines
  // de mètres.
  var ON_SITE_RADIUS_M = 500;

  // Fenêtre de grâce pour obtenir la position d'un pointage : 1 minute, avec
  // jusqu'à 3 tentatives automatiques. Tant qu'on est dans cette fenêtre, une
  // position absente n'est PAS pénalisée (état « en cours de vérification »).
  // Passé ce délai sans position valable → pointage non vérifié → sanctionné.
  var CHECKIN_GRACE_MS = 60000;
  var CHECKIN_MAX_ATTEMPTS = 3;

  // État de présence d'un pointage, indépendant de l'heure d'arrivée :
  //  'onsite' | 'offsite' | 'pending' (grâce en cours) | 'unverified' (grâce
  //  écoulée sans position) | 'no_venue' (lieu non renseigné).
  function checkInPresence(post, ev) {
    var venueKnown = ev && typeof ev.eventLat === 'number' && typeof ev.eventLng === 'number';
    if (!venueKnown) return 'no_venue';
    var geo = post && post.geo;
    if (geo && geo.available && typeof geo.lat === 'number') {
      var dist = geoDistance(geo.lat, geo.lng, ev.eventLat, ev.eventLng);
      return dist <= ON_SITE_RADIUS_M ? 'onsite' : 'offsite';
    }
    var arrival = (post && (post.checkInAt || post.timestamp)) || 0;
    var deadline = (post && post.checkInGraceUntil) || (arrival + CHECKIN_GRACE_MS);
    return Date.now() < deadline ? 'pending' : 'unverified';
  }

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

  // Un événement supprimé qui portait déjà des pointages ou des bilans n'est
  // jamais vraiment détruit : son type passe à EVENT_ARCHIVED (voir
  // App.deletePost) au lieu d'être retiré du stockage. Tous les endroits qui
  // AFFICHENT des événements (fil, Planning, sélecteurs) continuent de tester
  // strictement type === 'EVENT' et l'ignorent donc automatiquement. Seuls les
  // calculs de ponctualité doivent encore le retrouver, via ce repère commun —
  // sans ça, les étoiles déjà attribuées disparaîtraient avec l'événement.
  function isEventLike(p) {
    return !!p && (p.type === 'EVENT' || p.type === 'EVENT_ARCHIVED');
  }

  // Une épingle ne vaut que pour ce qui est encore d'actualité : un événement
  // terminé garde son drapeau en base (le remettre à une date future le
  // ré-épingle tout seul) mais cesse d'être remonté en tête du fil.
  function isPinnedNow(post, nowTs) {
    if (!post || !post.is_pinned) return false;
    if (isEventLike(post) && isEventPast(post, nowTs)) return false;
    return true;
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
    var ev = posts.find(function(p){ return p.id === eventId && isEventLike(p); });
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

    // Statut de présence, INDÉPENDANT de la ponctualité (l'heure d'arrivée) :
    //  - 'onsite'     : position relevée dans le rayon du lieu   → ✅ confirmé
    //  - 'offsite'    : position relevée MAIS loin du lieu       → ⚠️ hors zone (sanctionné)
    //  - 'unverified' : pas de position (refus / lent / indispo) → ⏳ non pénalisé
    //  - 'no_venue'   : lieu de l'événement non renseigné        → rien à vérifier
    var presence = checkInPresence(checkIn, ev);

    // Sanction (-2★) pour un HORS ZONE avéré (position loin du lieu) OU une
    // présence NON VÉRIFIÉE une fois la fenêtre de grâce (1 min / 3 essais)
    // écoulée. Pendant la grâce ('pending') : aucune pénalité, position en cours
    // de vérification. 'onsite'/'no_venue' : ponctualité fondée sur l'heure.
    if (presence === 'offsite') {
      offsite = true;
      stars = PUNCTUALITY_OFFSITE_STARS;
      label = 'Pointage à ' + formatDistance(dist) + ' du lieu — hors zone';
    } else if (presence === 'unverified') {
      offsite = true;
      stars = PUNCTUALITY_OFFSITE_STARS;
      label = 'Présence non vérifiée — pointage non validé';
    }

    return {
      stars: stars,
      delayMinutes: delayMinutes,
      label: label,
      checkInPostId: checkIn.id,
      absent: false,
      // Pointage effectué mais invalidé car hors zone (position loin du lieu).
      offsite: offsite,
      // Statut de présence à part (voir ci-dessus) — pour l'affichage.
      presence: presence,
      geo: geo,
      byEdit: !!checkIn.checkInByEdit,
      distance: dist,
      onSite: onSite
    };
  }

  // ============================================================
  // ASSIGNATIONS : QUI PEUT ASSIGNER QUOI
  // ============================================================
  // - Admin : assigne n'importe quel membre, et peut confier une tâche
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
  // Le Admin les a tous.
  function assignableSectionIds(u) {
    if (isGrandResponsable(u)) return SECTIONS.map(function(s){ return s.id; });
    if (isSectionResponsable(u)) return getUserSections(u).slice();
    return [];
  }

  // Membres que l'utilisateur a le droit d'assigner.
  function assignableMembers(u, allUsers) {
    // Une inscription pas encore validée n'est assignable à rien.
    var users = (allUsers || db(SK.USERS, [])).filter(function(x){ return !compteEnAttente(x); });
    if (isGrandResponsable(u)) return users.slice();
    if (!isSectionResponsable(u)) return [];
    var mine = assignableSectionIds(u);
    return users.filter(function(x) {
      return getUserSections(x).some(function(s){ return mine.indexOf(s) !== -1; });
    });
  }

  // Peut-il intervenir sur les assignations de cet événement ?
  // Oui pour le Admin, oui pour un responsable de section (limité à
  // ses propres membres), même si l'événement a été créé par un autre.
  function canManageEventAssignments(post, u) {
    if (!post || post.type !== 'EVENT') return false;
    return canAssign(u);
  }

  // Peut-il modifier l'événement lui-même (titre, date, lieu, pôles) ?
  // Réservé au Admin et au créateur.
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

  // C2 : fusion des assignations par différence. original = la liste au moment
  // où l'écran a été ouvert, actuelle = la liste éditée, fraiche = la version
  // relue sur le serveur juste avant d'écrire. On n'applique que ses propres
  // ajouts et retraits : ceux faits entre-temps par un autre responsable restent.
  function cleAssignation(a) {
    return a ? (a.isSection ? 'sec:' + a.sectionId : String(a.userId)) + '|' + String(a.task || '') : '';
  }
  function fusionnerAssignations(fraiche, original, actuelle) {
    var avant = (original || []).map(cleAssignation);
    var apres = (actuelle || []).map(cleAssignation);
    var res = (fraiche || []).filter(function(a) {
      var k = cleAssignation(a);
      return a && !(avant.indexOf(k) !== -1 && apres.indexOf(k) === -1);
    });
    var presentes = res.map(cleAssignation);
    (actuelle || []).forEach(function(a) {
      var k = cleAssignation(a);
      if (avant.indexOf(k) === -1 && presentes.indexOf(k) === -1) { res.push(a); presentes.push(k); }
    });
    return res;
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
      // isEventLike (pas type==='EVENT' strict) : un événement supprimé après
      // coup mais archivé (voir App.deletePost) doit continuer à compter dans
      // l'historique du membre — ses étoiles ne disparaissent pas avec lui.
      if (!isEventLike(ev)) return;
      // Assignation DIRECTE du membre (les assignations de pôle ne portent pas
      // sur un membre précis, donc ni présence ni tâche individuelle).
      var mine = (ev.assignments || []).find(function(a){ return a && a.userId === userId; });
      if (!mine) return;
      var startTs = eventStartTimestamp(ev);
      if (!startTs) return;

      // Deux natures d'assignation, exclusives :
      //  - avec deadline  → TÂCHE À LIVRER : notée quand le membre coche « fait »
      //                     (à temps / en retard) ou quand la deadline est passée
      //                     sans livraison. La présence physique n'entre pas en jeu.
      //  - sans deadline  → PRÉSENCE : ponctualité fondée sur l'heure de pointage.
      if (mine.deadline) {
        var dlTs = new Date(mine.deadline).getTime();
        if (isNaN(dlTs)) return;
        var doneP = posts.find(function(p){
          return p.type === 'TASK_DONE' && p.userId === userId && p.taskEventId === ev.id;
        });
        var doneAt = doneP ? (doneP.taskDoneAt || doneP.timestamp || 0) : 0;
        // Tant qu'elle n'est ni livrée ni en retard, la tâche est « en attente »
        // et ne compte pas encore (comme un événement de présence à venir).
        if (!doneP && now <= dlTs) return;
        // La borne de période s'appuie sur la deadline (moment où la tâche « pèse »).
        if (sinceTs && dlTs < sinceTs) return;
        var late = doneP ? (doneAt > dlTs) : false;
        var stars = !doneP ? TASK_MISSED_STARS : (late ? TASK_LATE_STARS : TASK_ON_TIME_STARS);
        var status = !doneP ? 'missed' : (late ? 'late' : 'ontime');
        entries.push({
          eventId: ev.id,
          eventTitle: ev.eventTitle || 'Événement',
          eventDate: ev.eventDate || '',
          startTs: dlTs,
          stars: stars,
          delayMinutes: null,
          label: !doneP ? 'Tâche non livrée' : (late ? 'Tâche livrée en retard' : 'Tâche livrée à temps'),
          absent: !doneP,
          kind: 'task',
          status: status,
          done: !!doneP,
          task: mine.task || ''
        });
        return;
      }

      // --- PRÉSENCE ---
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
        absent: p.absent,
        kind: 'presence',
        // Un pointage sanctionné (hors zone / non vérifié) peut avoir
        // delayMinutes <= 0 : sans le test sur les étoiles, il était classé
        // « ontime » et gonflait artificiellement le compte de ponctualité.
        status: p.absent ? 'missed' : ((p.stars || 0) < 0 ? 'late' : (p.delayMinutes > 0 ? 'late' : 'ontime')),
        task: mine.task || ''
      });
    });
    entries.sort(function(a,b){ return b.startTs - a.startTs; });

    var sumEvents = entries.reduce(function(acc, e){ return acc + e.stars; }, 0);
    // Bonus de BIENVENUE : chaque membre démarre avec 5★ (posé à l'inscription via
    // welcomeStars ; 5 par défaut). Compté comme une note de départ — dans le total
    // ET la moyenne — mais PAS comme un service assuré (count = nb réel d'événements).
    var _me = db(SK.USERS, []).find(function(u){ return u && u.id === userId; });
    var welcomeBonus = (_me && typeof _me.welcomeStars === 'number') ? _me.welcomeStars : 5;
    var total = sumEvents + welcomeBonus;
    var average = Math.round((total / (entries.length + 1)) * 10) / 10;
    // Statut unifié présence + tâche : à l'heure / en retard / manqué.
    var lateEntries = entries.filter(function(e){ return e.status === 'late' && e.delayMinutes > 0; });
    var avgDelay = lateEntries.length
      ? Math.round(lateEntries.reduce(function(acc,e){ return acc + e.delayMinutes; }, 0) / lateEntries.length)
      : 0;
    var onTimeCount = entries.filter(function(e){ return e.status === 'ontime'; }).length;
    var lateCount = entries.filter(function(e){ return e.status === 'late'; }).length;
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
      lateCount: lateCount,
      absentCount: entries.filter(function(e){ return e.status === 'missed'; }).length,
      taskCount: entries.filter(function(e){ return e.kind === 'task'; }).length,
      debt: debt
    };
  }

  // Ponctualité cumulée d'une SECTION sur un événement : moyenne des étoiles de
  // tous ses membres assignés. C'est le total calculé automatiquement après
  // l'événement, qui alimente le critère Ponctualité du bilan.
  function sectionPunctuality(sectionId, eventId, allPosts, allUsers) {
    var posts = allPosts || db(SK.POSTS, []);
    var users = allUsers || db(SK.USERS, []);
    var ev = posts.find(function(p){ return p.id === eventId && isEventLike(p); });
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
  // untilTs (optionnel) borne la période en haut, EXCLUSIF : utilisé pour isoler
  // un cycle précis (vue "Depuis le début" groupée par cycle) plutôt que tout
  // prendre depuis sinceTs jusqu'à maintenant.
  function sectionScoreboard(sectionId, sinceTs, allPosts, untilTs) {
    var posts = allPosts || db(SK.POSTS, []);
    var entries = [];

    posts.forEach(function(p) {
      if (p.type !== 'EVALUATION' || !p.metadata) return;
      if (sinceTs && (p.timestamp || 0) < sinceTs) return;
      if (untilTs && (p.timestamp || 0) >= untilTs) return;
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
    // La Ponctualité est calculée automatiquement et PEUT légitimement être
    // négative (absence ou pointage frauduleux) : il ne faut jamais l'exclure,
    // sous peine de faire disparaître discrètement les sanctions les plus graves
    // du tableau de bord. Les autres critères sont saisis à la main sur une
    // échelle 1-5 : une valeur négative n'y a pas de sens et signale une entrée
    // absente plutôt qu'une vraie note, donc on continue de l'ignorer.
    var critTotals = {}, critCounts = {};
    entries.forEach(function(e) {
      Object.keys(e.criteria).forEach(function(k) {
        var v = parseFloat(e.criteria[k]);
        if (isNaN(v)) return;
        // Critères manuels (échelle 1-5) : 0 = entrée absente, on ne la compte
        // PAS dans la moyenne (l'ancienne condition `v !== 0` laissait au
        // contraire passer le zéro et tirait les moyennes vers le bas). Seule la
        // Ponctualité, qui peut être négative, garde un traitement spécial.
        if (k !== 'Ponctualité' && !(v > 0)) return;
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

  // Bornes [début, fin[ (fin EXCLUSIVE) du cycle de 15 jours contenant ts.
  function cycleBoundsForTs(ts) {
    var d = new Date(ts);
    var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    if (day <= 15) {
      return { startTs: new Date(y, m, 1).getTime(), endTs: new Date(y, m, 16).getTime() };
    }
    return { startTs: new Date(y, m, 16).getTime(), endTs: new Date(y, m + 1, 1).getTime() };
  }

  // Bornes du cycle précédant immédiatement celui donné.
  function previousCycleBounds(bounds) {
    return cycleBoundsForTs(bounds.startTs - 1);
  }

  // Libellé lisible d'un cycle, avec l'année pour ne jamais confondre deux
  // cycles identiques d'années différentes dans un historique long.
  function cycleLabel(bounds) {
    var d = new Date(bounds.startTs);
    var monthYear = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return (d.getDate() === 1 ? '1er – 15 ' : '16 – fin ') + monthYear;
  }

  // Tous les cycles, du plus récent (cycle en cours, même incomplet) au plus
  // ancien cycle contenant au moins un bilan publié. Purement dérivé des
  // données réelles et de la date du jour : un nouveau cycle apparaît de
  // lui-même dès qu'un bilan y est publié, sans rien à mettre à jour à la main.
  function historicalCycles(allPosts) {
    var posts = allPosts || db(SK.POSTS, []);
    var evalTimestamps = posts.filter(function(p){ return p.type === 'EVALUATION'; }).map(function(p){ return p.timestamp || 0; });
    if (evalTimestamps.length === 0) return [];
    var oldestBounds = cycleBoundsForTs(Math.min.apply(null, evalTimestamps));
    var cycles = [];
    var cur = cycleBoundsForTs(Date.now());
    while (true) {
      cycles.push(cur);
      if (cur.startTs <= oldestBounds.startTs) break;
      cur = previousCycleBounds(cur);
    }
    return cycles;
  }

  // ============================================================
  // APERÇU DES LIENS
  // ============================================================
  // Un navigateur ne peut pas lire le HTML d'un site tiers (CORS) : c'est la
  // fonction serveur /api/og qui va chercher les métadonnées et nous renvoie
  // titre, description et image.
  function fetchLinkPreview(url) {
    return fetch('/api/og?url=' + encodeURIComponent(url))
      .then(function(r){ return r.ok ? r.json() : null; })
      .catch(function(){ return null; });
  }

  // Nom de domaine lisible, utilisé quand le site ne fournit aucune métadonnée.
  function linkDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
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

  // ============================================================
  // QUESTIONS DE SÉCURITÉ (récupération de mot de passe sans e-mail)
  // ============================================================
  // Liste proposée à l'inscription et dans le profil. Le TEXTE choisi est ce qui
  // est stocké (et réaffiché lors de la récupération) — pas un identifiant.
  var SECURITY_QUESTIONS = [
    "Le prénom de ton meilleur(e) ami(e) d'enfance ?",
    "Le nom de ton premier animal de compagnie ?",
    "Ta ville de naissance ?",
    "Le prénom de ta grand-mère maternelle ?",
    "Le nom de ton école primaire ?",
    "Le titre de ton chant préféré ?",
    "Le prénom de ton parrain ou de ta marraine ?",
    "Ton plat préféré ?"
  ];

  // Deux blocs question (menu déroulant) + réponse, réutilisés à l'inscription et
  // dans « Modifier le profil ». prefix distingue les identifiants (« signup » /
  // « edit »). q1/q2 pré-sélectionnent une question déjà définie.
  function renderSecurityQAFields(prefix, q1, q2) {
    var opts = function(sel) {
      return '<option value="">Choisir une question…</option>' +
        SECURITY_QUESTIONS.map(function(q){
          return '<option value="' + safeHtml(q) + '"' + (q === sel ? ' selected' : '') + '>' + safeHtml(q) + '</option>';
        }).join('');
    };
    var selStyle = styleSelect();
    var inpStyle = styleChamp() + 'margin-top:8px;';
    return '<div style="display:flex;flex-direction:column;gap:16px;">' +
      '<div>' +
        '<select id="' + prefix + 'SecQ1" class="kc-champ" style="' + selStyle + '">' + opts(q1) + '</select>' +
        '<input id="' + prefix + 'SecA1" type="text" class="kc-champ" placeholder="Ta réponse" autocomplete="off" style="' + inpStyle + '" />' +
      '</div>' +
      '<div>' +
        '<select id="' + prefix + 'SecQ2" class="kc-champ" style="' + selStyle + '">' + opts(q2) + '</select>' +
        '<input id="' + prefix + 'SecA2" type="text" class="kc-champ" placeholder="Ta réponse" autocomplete="off" style="' + inpStyle + '" />' +
      '</div>' +
    '</div>';
  }

  // Lit les 4 champs (2 questions + 2 réponses) d'un bloc. Renvoie null + toast si
  // incomplet ou si les deux questions sont identiques.
  function readSecurityQA(prefix, requireAnswers) {
    var q1 = ((document.getElementById(prefix + 'SecQ1') || {}).value || '').trim();
    var q2 = ((document.getElementById(prefix + 'SecQ2') || {}).value || '').trim();
    var a1 = ((document.getElementById(prefix + 'SecA1') || {}).value || '').trim();
    var a2 = ((document.getElementById(prefix + 'SecA2') || {}).value || '').trim();
    // Bloc entièrement vide + réponses non obligatoires : on considère « non défini ».
    if (!requireAnswers && !q1 && !q2 && !a1 && !a2) return { empty: true };
    if (!q1 || !q2 || !a1 || !a2) { toast('Choisis deux questions et donne tes deux réponses.', 'error'); return null; }
    if (q1 === q2) { toast('Choisis deux questions différentes.', 'error'); return null; }
    return { q1: q1, q2: q2, a1: a1, a2: a2 };
  }

  // ============================================================
  // IDENTIFIANT PAR NUMÉRO DE TÉLÉPHONE (sans SMS)
  // ============================================================
  // La connexion se fait au NUMÉRO, jamais par e-mail ni SMS. Sous le capot, le
  // numéro est transformé en identifiant interne « <chiffres>@commit.aev » que
  // Supabase Auth accepte sans rien envoyer (confirmations désactivées). Le membre
  // ne voit et ne saisit que son numéro.
  //
  // normalizePhone rend un même numéro IDENTIQUE quelle que soit sa saisie
  // (avec/sans 0 initial, avec/sans +225, espaces, tirets). Par défaut Côte
  // d'Ivoire (+225) : la partie significative est préfixée de « 225 ». Renvoie
  // les chiffres canoniques (sans +) ou null si vide.
  var PHONE_EMAIL_DOMAIN = 'commit.aev';
  function normalizePhone(raw) {
    var d = String(raw == null ? '' : raw).replace(/\D/g, '');
    if (!d) return null;
    if (d.indexOf('225') === 0) d = d.slice(3);   // retire l'indicatif s'il est déjà là
    d = d.replace(/^0+/, '');                      // retire le 0 de tête (préfixe local)
    if (!d) return null;
    return '225' + d;                              // forme canonique : 225 + partie significative
  }
  // Identifiant interne Supabase à partir d'un numéro. null si numéro vide.
  function phoneToEmail(raw) {
    var d = normalizePhone(raw);
    return d ? (d + '@' + PHONE_EMAIL_DOMAIN) : null;
  }
  // Affichage lisible d'un numéro canonique : « +225 07 07 07 07 07 ».
  function formatPhoneDisplay(raw) {
    var d = normalizePhone(raw);
    if (!d) return String(raw || '');
    var local = d.slice(3);                         // partie après 225
    // Les numéros ivoiriens s'écrivent avec un 0 de tête, groupés par 2.
    var withZero = '0' + local;
    var groups = withZero.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    return '+225 ' + groups;
  }

  // ============================================================
  // PRÉSENCE EN LIGNE
  // ============================================================
  // Le drapeau is_online ne retombe qu'à une déconnexion EXPLICITE : fermer
  // l'onglet ou l'application le laissait à vrai, et la pastille verte restait
  // allumée pour des membres absents. La présence se déduit donc de la
  // FRAÎCHEUR de last_seen_at (rafraîchi à chaque action), avec le drapeau comme
  // condition supplémentaire. L'utilisateur courant est toujours en ligne.
  var ONLINE_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
  function estEnLigne(u) {
    if (!u) return false;
    if (S.user && u.id === S.user.id) return true;
    if (!u.is_online) return false;
    var vu = Date.parse(u.last_seen_at || 0) || 0;
    if (!vu) return false;
    return (Date.now() - vu) < ONLINE_WINDOW_MS;
  }


  // Battement de présence : tant que l'application est au PREMIER PLAN et qu'une
  // session est ouverte, on rafraîchit périodiquement last_seen_at. Sans lui, un
  // membre qui lit le fil sans rien publier passait « hors ligne » au bout de
  // cinq minutes (voir estEnLigne). Rien n'est redessiné : seule la donnée est
  // mise à jour, la pastille des autres se rafraîchit au rendu suivant.
  var BATTEMENT_MS = 2 * 60 * 1000;       // 2 minutes
  var _battementTimer = null;
  var _dernierBattement = 0;

  function envoyerBattement(force) {
    if (!S.user || S.auth !== 'app') return;
    // Onglet masqué : on ne signale pas une présence qui n'en est pas une.
    if (!force && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    var maintenant = Date.now();
    // Garde-fou : jamais deux écritures rapprochées (retour au premier plan
    // répété), pour ne pas multiplier les requêtes ni le trafic sortant.
    if (!force && (maintenant - _dernierBattement) < (BATTEMENT_MS - 5000)) return;
    _dernierBattement = maintenant;

    var iso = new Date(maintenant).toISOString();
    try {
      var users = db(SK.USERS, []);
      var idx = users.findIndex(function(u){ return u && u.id === S.user.id; });
      if (idx === -1) return;
      users[idx].is_online = true;
      users[idx].last_seen_at = iso;
      S.user = users[idx];
      dbSet(SK.USERS, users);
      try { sauverSession(S.user); } catch(e){}
    } catch(e) { return; }

    // Seule l'heure de passage est écrite, côté serveur (kc_battement,
    // migration 12) : renvoyer toute la fiche écrasait ce qu'un autre appareil
    // venait d'y enregistrer (C7) et alourdissait chaque battement.
    try {
      if (supabase) supabase.rpc('kc_battement').then(function(){}, function(){});
    } catch(e){}
  }

  function demarrerBattementPresence() {
    if (_battementTimer) return;
    _battementTimer = setInterval(function(){ envoyerBattement(false); }, BATTEMENT_MS);
    try {
      document.addEventListener('visibilitychange', function(){
        // Retour au premier plan : on se resignale tout de suite.
        if (document.visibilityState === 'visible') envoyerBattement(false);
      });
    } catch(e){}
    envoyerBattement(true);   // premier battement immédiat
  }

  // Échéance d'une tâche, lisible (« 25 août 18:00 »). '' si non renseignée.
  function formatDeadline(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
      ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // Statut de la tâche à livrer d'un membre sur un événement, pour l'affichage :
  // { done, doneAt, late, overdue, deadlineTs }. null si l'assignation n'est pas
  // une tâche (pas de deadline) ou si le membre n'y est pas assigné directement.
  function taskStatusFor(userId, ev, allPosts) {
    if (!ev || !userId) return null;
    var mine = (ev.assignments || []).find(function(a){ return a && a.userId === userId; });
    if (!mine || !mine.deadline) return null;
    var dlTs = new Date(mine.deadline).getTime();
    if (isNaN(dlTs)) return null;
    var posts = allPosts || db(SK.POSTS, []);
    var doneP = posts.find(function(p){
      return p.type === 'TASK_DONE' && p.userId === userId && p.taskEventId === ev.id;
    });
    var doneAt = doneP ? (doneP.taskDoneAt || doneP.timestamp || 0) : 0;
    return {
      task: mine.task || '',
      deadline: mine.deadline,
      deadlineTs: dlTs,
      done: !!doneP,
      doneAt: doneAt,
      late: doneP ? (doneAt > dlTs) : false,
      overdue: !doneP && Date.now() > dlTs
    };
  }

  // Moyenne des critères effectivement notés (0 si aucun).
  function ratingAverage(critObj) {
    if (!critObj) return 0;
    var vals = EVAL_CRITERIA.map(function(c){ return critObj[c.id] || 0; }).filter(function(v){ return v > 0; });
    if (vals.length === 0) return 0;
    var sum = vals.reduce(function(a,b){ return a+b; }, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }

  // Les grades n'ont plus d'emoji : ceux d'avant (🎬 clap, 🎥 caméra) étaient
  // empruntés au vocabulaire vidéo et entraient en collision avec les emoji des
  // PÔLES — 🎬 désigne Prod et 🎥 Cadrage. Un membre du pôle Vente se retrouvait
  // ainsi étiqueté d'un clap de cinéma. La hiérarchie passe désormais par la
  // couleur du badge (voir roleTint), qui elle ne peut rien signifier d'autre.
  var ROLE_LABELS = {
    GRAND_RESPONSABLE: 'Admin',
    RESP_SECTION: 'Responsable de pôle',
    MEMBRE: 'Membre',
    STAGIAIRE: 'Stagiaire'
  };
  function roleLabel(role) { return ROLE_LABELS[role] || ROLE_LABELS.MEMBRE; }

  // Teinte du badge de grade : plus le rôle porte de responsabilité, plus la
  // couleur est marquante. Le membre reste neutre, c'est le cas courant.
  var ROLE_TINTS = {
    // Dans la palette, et lisibles en mode sombre : bleu plein pour l'Admin,
    // bleu clair pour les responsables, gris pour les autres.
    GRAND_RESPONSABLE: { fg: '#FFF', bg: '#0B5FE0' },
    RESP_SECTION:      { fg: 'var(--accent-ink)', bg: 'var(--accent-soft)' },
    MEMBRE:            { fg: 'var(--muted)', bg: 'var(--tile)' },
    STAGIAIRE:         { fg: 'var(--faint)', bg: 'var(--tile)' }
  };
  function roleTint(role) { return ROLE_TINTS[role] || ROLE_TINTS.MEMBRE; }

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

