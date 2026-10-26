// KUN COM VH — Partie 1b : Client Supabase, session, fusion et synchronisation des fiches et publications, médias

  'use strict';
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

  // À l'ouverture de session, la fiche du SERVEUR fait foi : on la relit
  // avant d'écrire. Sinon un appareil au cache vide (nouvel appareil,
  // réinstallation, changement d'adresse) envoyait un squelette qui écrasait
  // la vraie fiche : photo, bio, abonnements et date d'arrivée perdus. Le
  // squelette n'est écrit que si le serveur confirme qu'aucune fiche n'existe ;
  // sur une erreur de lecture, rien n'est écrit.
  function ecrireMaFicheApresServeur(locale) {
    if (!supabase || !locale || !locale.id) return;
    var id = locale.id;
    try {
      supabase.from('kun_com_profiles').select('content').eq('id', id).limit(1).then(function(r) {
        if (!r || r.error || !Array.isArray(r.data)) return;
        var serveur = r.data[0] && r.data[0].content ? parseProfileItem({ id: id, content: r.data[0].content }) : null;
        var fiche = serveur
          ? Object.assign({}, serveur, { id: id, role: locale.role, email: serveur.email || locale.email,
              is_online: true, last_seen_at: locale.last_seen_at || new Date().toISOString() })
          : locale;
        if (serveur && S.user && S.user.id === id) {
          Object.assign(S.user, fiche);
          var users = db(SK.USERS, []);
          var i = users.findIndex(function(u){ return u && u.id === id; });
          if (i !== -1) users[i] = S.user; else users.push(S.user);
          try { dbSet(SK.USERS, users); sauverSession(S.user); } catch(e){}
          try { if (typeof render === 'function') render(); } catch(e){}
        }
        return supabase.from('kun_com_profiles').upsert({ id: id, content: profilSansSecret(fiche) }, { onConflict: 'id' });
      }).then(function(){}, function(){});
    } catch(e){}
  }

  function applyAuthUser(authUser) {
    if (!authUser) { S.user = null; S.auth = 'login'; return; }
    var role = (authUser.app_metadata && authUser.app_metadata.role) || 'MEMBRE';
    S.jwtRole = role;                     // rôle de référence pour l'utilisateur courant
    S.jwtApprouve = !!(authUser.app_metadata && authUser.app_metadata.approuve === true);
    var meta = authUser.user_metadata || {};
    if (meta.dm_lus && typeof fusionnerLecturesCompte === 'function') fusionnerLecturesCompte(meta.dm_lus);
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
      ecrireMaFicheApresServeur(me);
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
      ecrireMaFicheApresServeur(S.user);
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
        // Ses notifications viennent de kun_com_notifications (migration 22) ;
        // celles des autres ne sont plus lisibles ni gardées.
        if (estMoi) merged.notifications = mergeNotifications(existing.notifications, rUser.notifications);
        else delete merged.notifications;
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
  // Dernière écriture en cours par publication (voir App.ecrirePostFrais).
  var ecrituresEnChaine = {};
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
    // Recalculé sur la version du serveur : renvoyer la copie locale entière
    // écrasait ce que d'autres avaient changé entre-temps (assignations...).
    modifies.forEach(function(p) {
      App.ecrirePostFrais(p.id, function(f) {
        var propre = nettoyerTracesComptesSupprimes([f]).posts[0];
        if (propre) Object.assign(f, propre);
      });
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
      var _todayIso = isoLocal();
      var _results = await Promise.all([
        supabase.from('kun_com_posts').select('*').order('created_at', { ascending: false }).range(0, POSTS_PAGE_SIZE - 1),
        supabase.from('kun_com_profiles').select('*'),
        requeteEvenementsAVenir()
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
        // Ses notifications (table à part, migration 22) et leur temps réel.
        try { chargerMesNotifications(); } catch(eNotifs) {}
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
      // Quand le temps réel est connecté, la relève complète n'est plus qu'un
      // filet espacé (3 min) : à 20 s, chaque téléphone retéléchargeait toute la
      // page même quand rien n'avait changé.
      if (!window._postsPollInterval) {
        var _derniereReleve = Date.now();
        window._postsPollInterval = setInterval(function() {
          if (document.hidden) return;
          if (_tempsReelPret && Date.now() - _derniereReleve < 180000) return;
          _derniereReleve = Date.now();
          fetchPostsSilently();
        }, 20000);
      }

      // Temps réel Supabase — abonné UNE SEULE FOIS : syncSupabaseToLocal() peut être
      // rappelé (réessais réseau), et sans ce garde-fou chaque appel créait un canal
      // supplémentaire, multipliant les rafraîchissements jusqu'à faire planter l'onglet.
      if (!window._realtimeSubscribed) {
        window._realtimeSubscribed = true;
        supabase.channel('public:kun_com_realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kun_com_posts' }, function(payload) {
             publicationRecue(payload);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kun_com_profiles' }, function(payload) {
             profilRecu(payload);
          })
          .subscribe(function(etat) {
             var avant = _tempsReelPret;
             _tempsReelPret = etat === 'SUBSCRIBED';
             // Reconnexion : on rattrape une fois ce qui a pu être manqué.
             if (_tempsReelPret && avant === false) fetchPostsSilently();
          });
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
  // Publications reçues en temps réel : la ligne envoyée par le serveur est
  // appliquée telle quelle (RLS déjà appliquée par Supabase), au lieu de
  // retélécharger toute la page à chaque changement. C'était coûteux depuis
  // l'enregistrement des vues : une vue = un changement chez tous les membres.
  // Regroupées sur 800 ms ; si seules les vues ont changé, on ne met à jour
  // que les compteurs, sans redessiner l'écran.
  var _tempsReelPret = null;
  var _publicationsRecues = {};
  var _publicationsRecuesTimer = null;
  function publicationRecue(payload) {
    if (!payload) return;
    if (payload.eventType === 'DELETE' || !(payload.new && payload.new.id && payload.new.content)) {
      fetchPostsSilently();   // suppression réelle ou ligne incomplète : relecture
      return;
    }
    _publicationsRecues[payload.new.id] = payload.new;
    if (!_publicationsRecuesTimer) _publicationsRecuesTimer = setTimeout(appliquerPublicationsRecues, 800);
  }
  function sansVues(p) {
    var c = Object.assign({}, p); delete c.viewedBy;
    try { return JSON.stringify(c); } catch(e) { return String(Math.random()); }
  }
  function appliquerPublicationsRecues() {
    _publicationsRecuesTimer = null;
    var lignes = Object.keys(_publicationsRecues).map(function(k){ return _publicationsRecues[k]; });
    _publicationsRecues = {};
    if (!lignes.length || !S.user) return;
    var avant = {};
    db(SK.POSTS, []).forEach(function(p){ if (p && p.id) avant[p.id] = p; });
    var fusion = mergePostsWithLocal(lignes, false);
    var apres = {};
    fusion.forEach(function(p){ apres[p.id] = p; });
    var aRedessiner = false;
    lignes.forEach(function(l) {
      var a = avant[l.id], b = apres[l.id];
      if (!a || !b || sansVues(a) !== sansVues(b)) aRedessiner = true;
    });
    dbSet(SK.POSTS, fusion);
    _lastPostsFingerprint = postsFingerprint(fusion);
    if (aRedessiner) {
      if (!saisieEnCours()) render();
      return;
    }
    lignes.forEach(function(l) {
      var b = apres[l.id];
      var el = document.getElementById('viewCount-' + l.id);
      if (el && b) el.textContent = Array.isArray(b.viewedBy) ? b.viewedBy.length : 0;
    });
  }

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
      if (estMoi) fusion.notifications = mergeNotifications(existant.notifications, r.notifications);
      else delete fusion.notifications;
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
        ':' + (p.videoPoster?1:0) + ':' + ((p.viewedBy||[]).length));
    });
    return parts.join('|');
  }

  // Événements à venir, quelle que soit leur ancienneté dans le fil : une série
  // créée d'un coup sort vite des 60 publications récentes. Annulés
  // (EVENT_ARCHIVED) et supprimés compris, pour que l'annulation se propage.
  function requeteEvenementsAVenir() {
    return supabase.from('kun_com_posts').select('*')
      .in('content->>type', ['EVENT', 'EVENT_ARCHIVED'])
      .gte('content->>eventDate', isoLocal())
      .order('created_at', { ascending: false }).limit(400);
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
      var lots = await Promise.all([
        supabase.from('kun_com_posts').select('*').order('created_at', { ascending: false }).range(0, POSTS_PAGE_SIZE - 1),
        requeteEvenementsAVenir()
      ]);
      var res = lots[0];
      var resEv = lots[1];
      if (res && res.error) { console.warn('Supabase posts poll error:', res.error); }
      if (res && res.data) {
        if (res.data.length < POSTS_PAGE_SIZE) S.postsAllLoaded = true;
        // Le curseur de « Charger plus » ne recule jamais : remis à la fin de la
        // page 1 à chaque relève, il faisait retélécharger la page 2 sans fin.
        var finPage = res.data.length > 0 && res.data[res.data.length - 1] && res.data[res.data.length - 1].created_at;
        if (finPage && (!S.postsRemoteCursor || finPage < S.postsRemoteCursor)) S.postsRemoteCursor = finPage;
        // Profite d'une synchro réussie pour rejouer les écritures restées en
        // file d'attente pendant une coupure réseau.
        try { App.viderFileAttenteEcriture(); } catch(eFlush){}
        var mergedPosts = mergePostsWithLocal(res.data, true);
        if (resEv && resEv.data && resEv.data.length) mergedPosts = mergePostsWithLocal(resEv.data, false, mergedPosts);
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
  // Copie pour le DISQUE : aucune image en base64 (photo recopiée, vignette,
  // image de commentaire, média non hébergé) et au plus 150 publications, les
  // plus récentes. La mémoire garde tout ; le reste se retélécharge au
  // démarrage. Sans cela, le stockage (5 Mo sur Safari) finissait plein et
  // Safari mobile pouvait planter.
  var MAX_POSTS_DISQUE = 150;
  function sansBase64(u) { return !(typeof u === 'string' && u.indexOf('data:') === 0); }
  function allegerPourDisque(posts) {
    if (!Array.isArray(posts)) return posts;
    return posts.slice(0, MAX_POSTS_DISQUE).map(function(p) {
      if (!p || typeof p !== 'object') return p;
      var c = Object.assign({}, p);
      ['avatar_url', 'videoPoster', 'originalVideoPoster', 'eventImage'].forEach(function(k) {
        if (!sansBase64(c[k])) c[k] = null;
      });
      if (Array.isArray(c.mediaUrls)) c.mediaUrls = c.mediaUrls.filter(sansBase64);
      if (Array.isArray(c.originalMediaUrls)) c.originalMediaUrls = c.originalMediaUrls.filter(sansBase64);
      if (Array.isArray(c.comments) && c.comments.some(function(x){ return x && !sansBase64(x.imageUrl || x.avatar_url); })) {
        c.comments = c.comments.map(function(x) {
          if (!x) return x;
          var y = Object.assign({}, x);
          if (!sansBase64(y.imageUrl)) y.imageUrl = null;
          if (!sansBase64(y.avatar_url)) y.avatar_url = null;
          return y;
        });
      }
      return c;
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
        function(){ return allegerPourDisque(val); },
        function(){ return allegerPourDisque(val).slice(0, 40); },
        function(){ return allegerPourDisque(val).slice(0, 15); }
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
