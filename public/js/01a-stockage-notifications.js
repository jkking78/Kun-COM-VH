// KUN COM VH — Partie 1a : Stockage local, notifications (dans l'app et sur le téléphone), mentions, annonces

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
    // Une image SVG peut porter du script : jamais en data:URL.
    if (debut.indexOf('data:image/svg') === 0) return '';
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
    // Note affichée sur la carte : texte court seulement (échappé au rendu).
    if (p.scoreText !== undefined) p.scoreText = typeof p.scoreText === 'string' ? p.scoreText.slice(0, 40) : '';
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
  // Champs qui diffèrent entre deux versions d'un objet (un champ retiré vaut
  // null). Sert à n'écrire QUE ce qu'on a changé sur la version du serveur.
  function champsModifies(avant, apres) {
    var champs = {};
    var cles = {};
    Object.keys(avant || {}).forEach(function(k){ cles[k] = true; });
    Object.keys(apres || {}).forEach(function(k){ cles[k] = true; });
    Object.keys(cles).forEach(function(k) {
      var a = avant ? avant[k] : undefined, b = apres ? apres[k] : undefined;
      if (JSON.stringify(a === undefined ? null : a) !== JSON.stringify(b === undefined ? null : b)) {
        champs[k] = b === undefined ? null : b;
      }
    });
    return champs;
  }

  function profilSansSecret(u) {
    if (!u || typeof u !== 'object') return u;
    var copie = Object.assign({}, u);
    delete copie.pwd; delete copie.sec_a1; delete copie.sec_a2;
    delete copie.notifications;   // elles vivent dans kun_com_notifications
    return copie;
  }

  // Écrit SA fiche sans jamais renvoyer la copie entière de l'appareil : la
  // fiche du serveur est relue, seuls les champs modifiés y sont posés. Une
  // copie locale ancienne (autre appareil, cache vide, session ouverte depuis
  // longtemps) écrasait sinon photo, bio, abonnements ou date d'arrivée.
  // champs : objet, ou fonction(ficheServeur) -> objet (fusions, ex. notifications).
  // Sur une erreur de lecture, rien n'est écrit.
  function ecrireMaFiche(champs) {
    if (!supabase || !S.user || !S.user.id) return Promise.resolve();
    var id = S.user.id;
    return supabase.from('kun_com_profiles').select('content').eq('id', id).limit(1).then(function(r) {
      if (!r || r.error || !Array.isArray(r.data)) return null;
      var serveur = r.data[0] && r.data[0].content;
      if (typeof serveur === 'string') { try { serveur = JSON.parse(serveur); } catch(e) { serveur = null; } }
      var base = (serveur && typeof serveur === 'object') ? serveur : profilSansSecret(S.user);
      var modifs = typeof champs === 'function' ? (champs(base) || {}) : (champs || {});
      var fiche = Object.assign({}, base, modifs, { id: id });
      if (S.user && S.user.id === id) {
        Object.assign(S.user, base, modifs);
        try {
          var users = db(SK.USERS, []);
          var i = users.findIndex(function(u){ return u && u.id === id; });
          if (i !== -1) { users[i] = S.user; dbSet(SK.USERS, users); }
          sauverSession(S.user);
        } catch(e) {}
      }
      return supabase.from('kun_com_profiles').upsert({ id: id, content: profilSansSecret(fiche) }, { onConflict: 'id' });
    }).then(function(){}, function(e){ console.warn('Enregistrement de la fiche :', e); });
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

  // ============================================================
  // NOTIFICATIONS DANS L'APP : table kun_com_notifications (migration 22)
  // ============================================================
  // Une ligne par notification, lisible par son seul destinataire. Elles
  // vivaient auparavant dans la fiche du destinataire : lisibles par tous, et
  // chaque ajout renvoyait la fiche entière à tous les membres connectés.
  // La base signe chaque notification (expéditeur, nom, type, heure).

  // Anti-doublon d'envoi (même fait, même destinataire, moins de 10 min) : on
  // ne voit plus les notifications des autres, on retient donc ses envois.
  var _notifsEnvoyees = {};
  function dejaNotifie(cle) {
    var t = _notifsEnvoyees[cle];
    if (t && Date.now() - t < 10 * 60 * 1000) return true;
    _notifsEnvoyees[cle] = Date.now();
    return false;
  }

  // Dépose une notification chez un membre, puis la relaie sur son téléphone.
  function deposerNotification(destinataire, notif) {
    if (!supabase || !destinataire || !notif || !notif.id) return Promise.resolve(null);
    return supabase.from('kun_com_notifications').insert({ destinataire: destinataire, id: notif.id, content: notif }).then(function(r) {
      if (r && r.error) { console.warn('Notification non déposée :', r.error); return null; }
      if (!(S.user && S.user.id === destinataire)) notifierTelephone(destinataire, notif.id);
      return true;
    }, function(e) { console.warn('Notification non déposée :', e); return null; });
  }

  // Ses notifications, telles que le serveur les garde ; un « lu » local pas
  // encore arrivé au serveur est conservé.
  function chargerMesNotifications() {
    if (!supabase || !S.user || !S.user.id) return Promise.resolve();
    var moi = S.user.id;
    return supabase.from('kun_com_notifications').select('id, content').eq('destinataire', moi)
      .order('cree_le', { ascending: false }).limit(100).then(function(r) {
        if (!r || r.error || !Array.isArray(r.data) || !S.user || S.user.id !== moi) return;
        var lues = {};
        (S.user.notifications || []).forEach(function(n){ if (n && n.read) lues[n.id] = true; });
        S.user.notifications = r.data.map(function(l) {
          var n = Object.assign({}, l.content || {}, { id: l.id });
          if (lues[n.id]) n.read = true;
          return n;
        });
        enregistrerMesNotificationsLocalement();
        try { if (typeof render === 'function' && !saisieEnCours()) render(); } catch(e) {}
        ecouterMesNotifications();
      }, function(){});
  }
  function enregistrerMesNotificationsLocalement() {
    if (!S.user) return;
    try {
      var users = db(SK.USERS, []);
      var i = users.findIndex(function(u){ return u && u.id === S.user.id; });
      if (i !== -1) { users[i] = S.user; dbSet(SK.USERS, users); }
      sauverSession(S.user);
    } catch(e) {}
  }
  // Temps réel : seulement les siennes (filtre + règles de la base).
  var _canalNotifs = null, _canalNotifsPour = null;
  function ecouterMesNotifications() {
    if (!supabase || !S.user || !supabase.channel) return;
    if (_canalNotifsPour === S.user.id) return;
    try { if (_canalNotifs) supabase.removeChannel(_canalNotifs); } catch(e) {}
    _canalNotifsPour = S.user.id;
    _canalNotifs = supabase.channel('kc_notifs_' + S.user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kun_com_notifications', filter: 'destinataire=eq.' + S.user.id }, notificationRecue)
      .subscribe();
  }
  function notificationRecue(payload) {
    if (!payload || !S.user) return;
    var liste = Array.isArray(S.user.notifications) ? S.user.notifications.slice() : [];
    if (payload.eventType === 'DELETE') {
      var idSuppr = payload.old && payload.old.id;
      liste = liste.filter(function(n){ return n.id !== idSuppr; });
    } else if (payload.new && payload.new.id && payload.new.destinataire === S.user.id) {
      var n = Object.assign({}, payload.new.content || {}, { id: payload.new.id });
      var i = liste.findIndex(function(x){ return x.id === n.id; });
      if (i === -1) liste.unshift(n); else liste[i] = Object.assign({}, liste[i], n, { read: liste[i].read || n.read });
    } else return;
    S.user.notifications = liste.slice(0, 100);
    enregistrerMesNotificationsLocalement();
    try { if (typeof render === 'function' && !saisieEnCours()) render(); } catch(e) {}
  }
  // Enregistre « lu » sur le serveur pour ces notifications.
  function enregistrerLectures(ids) {
    if (!supabase || !S.user || !ids || !ids.length) return;
    supabase.from('kun_com_notifications').update({ content: { read: true } })
      .eq('destinataire', S.user.id).in('id', ids.slice(0, 100))
      .then(function(r){ if (r && r.error) console.warn('Lecture des notifications :', r.error); }, function(){});
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
    
    // Anti-doublon : évite deux notifications identiques pour le MÊME fait (ex.
    // un like retiré puis remis tout de suite ne doit pas spammer). Mais quand un
    // commentaire/réponse est fourni, il DOIT entrer dans la comparaison : sinon
    // un 2e commentaire sur la même publication (même targetId+type+senderId,
    // commentId différent) passait pour un doublon du premier et était
    // silencieusement ignoré.
    // C9 : l'anti-doublon ne vaut que pour 10 minutes ; au-delà, une deuxième
    // relance ou une ré-assignation au même événement est une vraie nouvelle.
    if (dejaNotifie([targetUserId, notifData.type, notifData.targetId || '', notifData.commentId || ''].join('|'))) return;
    
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
      commentId: notifData.commentId || null,
      timestamp: Date.now(),
      read: false
    };
    
    // À soi-même : affichée tout de suite. Dans tous les cas, déposée dans la
    // table (la base la signe), puis relayée sur le téléphone du destinataire.
    if (S.user && S.user.id === targetUserId) {
      if (!Array.isArray(S.user.notifications)) S.user.notifications = [];
      S.user.notifications.unshift(newNotif);
      enregistrerMesNotificationsLocalement();
    }
    deposerNotification(targetUserId, newNotif);

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
          text: 'a publié pour ton pôle "' + post.sectionNom + '".',
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
    if (!newUser || !newUser.id || !S.user) return;
    var secs = getUserSections(newUser).map(function(s){ return secNom(s); }).filter(Boolean).join(' · ');
    var nom = ((newUser.prenom || '') + ' ' + (newUser.nom || '')).trim() || 'Un nouveau membre';
    // Envoyée par celui qui valide l'inscription (la base signe à son nom) :
    // écrite au nom du nouveau membre, elle était refusée par le serveur.
    db(SK.USERS, []).forEach(function(u) {
      if (!u || !u.id || u.id === newUser.id || u.id === S.user.id || compteEnAttente(u)) return;
      deposerNotification(u.id, {
        id: 'n_new_' + newUser.id,
        senderId: S.user.id,
        type: 'NEW_MEMBER',
        title: 'Nouveau membre',
        text: 'a validé l\'arrivée de ' + nom + (secs ? ' · ' + secs : '') + '.',
        targetId: newUser.id,
        timestamp: Date.now(),
        read: false
      });
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
      if (supabase && window.App && App.ecrirePostFrais) App.ecrirePostFrais(pp.id, function(f) { f.arrivalAnnounced = true; }); }
    else { post.arrivalAnnounced = true; }

    // Seul l'auteur du pointage l'annonce (la base signe à son nom).
    if (!S.user || S.user.id !== post.userId) return;
    db(SK.USERS, []).forEach(function(u) {
      if (!u || !u.id || u.id === post.userId || compteEnAttente(u)) return;
      deposerNotification(u.id, Object.assign({}, notif));
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
