// KUN COM VH — Partie 7c : App controller — Session et compte : navigation, écritures fiables et file hors connexion, connexion et inscription, thème, suppression de compte, rôles et pôles, réglages, notifications push, statistiques (window.App)

  'use strict';
  Object.assign(App, {

    // Changer d'écran (connexion / inscription / mot de passe oublié) repart d'un
    // formulaire vierge : on ne veut pas retrouver le mot de passe tapé pour la
    // connexion pré-rempli dans le formulaire d'inscription.
    nav: function(v) { S.auth = v; S.champsAuth = {}; render(); },
    // Mémorise la frappe SANS redessiner (un render() à chaque touche ferait
    // sauter le curseur et le clavier sur mobile).
    // Aligne la hauteur de chaque carrousel d'événements sur celle du volet
    // actuellement visible. Sans cela, la rangée flex adopte la hauteur du plus
    // grand volet et laisse un vide blanc sous les plus courts.
    recalerCarrousels: function() {
      try {
        var listes = document.querySelectorAll('[data-carrousel-ev="1"]');
        for (var i = 0; i < listes.length; i++) {
          var el = listes[i];
          if (!el.children.length) continue;
          var largeur = el.children[0].offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
          if (!largeur) continue;
          var idx = Math.round(el.scrollLeft / largeur);
          if (idx < 0) idx = 0;
          if (idx > el.children.length - 1) idx = el.children.length - 1;
          var volet = el.children[idx];
          if (!volet) continue;
          var h = volet.offsetHeight;
          // Une hauteur nulle signifie que le contenu n'est pas encore mesurable
          // (média non chargé) : on ne fige surtout pas le carrousel à zéro.
          if (h > 0) el.style.height = h + 'px';
        }
      } catch(e) {}
    },
    // Un média vient de s'afficher : on retient sa proportion pour réserver
    // exactement sa place aux prochains rendus (voir memoriserRatioMedia). Aucun
    // redessin ici — la carte est déjà à la bonne taille, et redessiner pendant
    // le défilement serait pire que le mal.
    mediaCharge: function(el, url) {
      if (!el) return;
      var w = el.naturalWidth || el.videoWidth || 0;
      var h = el.naturalHeight || el.videoHeight || 0;
      if (w && h) memoriserRatioMedia(url, w, h);
    },

    // Média du fil introuvable (objet Storage supprimé avec sa publication
    // d'origine, URL invalide...) : remplace l'élément cassé par un encart
    // discret au lieu de laisser une image/vidéo brisée à l'écran. Appelé par
    // les attributs onerror des cartes du fil (05-render-feed).
    mediaEchoue: function(el) {
      if (!el || !el.parentNode) return;
      var encart = document.createElement('div');
      encart.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;padding:28px 16px;background:#F2F2F7;color:#8A93A0;font-size:13px;border-radius:12px;';
      encart.textContent = 'Média indisponible';
      el.parentNode.replaceChild(encart, el);
    },

    // ---- Écritures de publications SANS écrasement concurrent ----
    // Commentaires, likes et participations vivent DANS le JSON du post :
    // réécrire la version lue dans le cache local écraserait toute action
    // concurrente d'un autre membre (son commentaire disparaissait alors
    // définitivement, en base comme chez tous les clients). On relit donc la
    // version fraîche du serveur, on y applique UNIQUEMENT notre mutation en
    // valeur absolue (état final voulu, pas un basculement), puis on réécrit —
    // le même schéma que votePoll, généralisé.
    // apresServeur(post) : appelé avec la version retenue par le serveur.
    // Les écritures sur une même publication passent l'une après l'autre : sans
    // cela, deux actions rapides (deux étapes du plan, épingler puis modifier)
    // relisaient le serveur avant que la première y soit arrivée, et la seconde
    // effaçait la première.
    ecrirePostFrais: function(postId, mutateur, apresServeur) {
      var precedente = ecrituresEnChaine[postId] || Promise.resolve();
      var suivante = precedente.then(function() { return App._ecrirePostFraisMaintenant(postId, mutateur, apresServeur); });
      var fin = suivante.catch(function(){});
      ecrituresEnChaine[postId] = fin;
      fin.then(function() { if (ecrituresEnChaine[postId] === fin) delete ecrituresEnChaine[postId]; });
      return suivante;
    },
    _ecrirePostFraisMaintenant: async function(postId, mutateur, apresServeur) {
      var posts = db(SK.POSTS, []);
      var local = posts.find(function(p){ return p.id === postId; });
      if (!local) return null;
      var cible = local;
      if (supabase) {
        try {
          var res = await supabase.from('kun_com_posts').select('content').eq('id', postId).single();
          var frais = res && res.data && res.data.content ? parsePostItem({ id: postId, content: res.data.content }) : null;
          if (frais) cible = frais;
        } catch(e) { /* hors-ligne ou post absent : on mute la version locale */ }
      }
      var avantMutation = JSON.parse(JSON.stringify(cible));
      mutateur(cible);
      var champs = champsModifies(avantMutation, cible);
      var allPosts = db(SK.POSTS, []);
      var idx = allPosts.findIndex(function(p){ return p.id === postId; });
      if (idx !== -1) { allPosts[idx] = cible; dbSet(SK.POSTS, allPosts); }
      if (supabase) {
        // Le serveur fusionne lui-même l'écriture (migration 06) et renvoie la
        // version retenue : le cache local s'y recale aussitôt.
        var contenuServeur = await App._upsertFiable('kun_com_posts', { id: postId, content: cible }, champs);
        if (contenuServeur) {
          var posts2 = db(SK.POSTS, []);
          var i2 = posts2.findIndex(function(p){ return p.id === postId; });
          if (i2 !== -1) { posts2[i2] = parsePostItem({ id: postId, content: contenuServeur }) || posts2[i2]; dbSet(SK.POSTS, posts2); }
          if (apresServeur && i2 !== -1) { try { apresServeur(posts2[i2]); } catch(eApres) { console.warn(eApres); } }
        }
      }
      return cible;
    },
    // Modification d'une publication existante faite sur une copie (formulaire,
    // épingle, archivage...) : seuls les champs qui diffèrent entre « avant » et
    // « apres » sont posés sur la version fraîche du serveur. Renvoyer la copie
    // entière écrasait, pour l'auteur ou l'Admin, ce que d'autres avaient changé
    // entre-temps (assignations, heure...), ou ressuscitait une publication.
    ecrireModifications: function(avant, apres, apresServeur) {
      if (!apres || !apres.id) return Promise.resolve(null);
      var champs = champsModifies(avant || {}, apres);
      if (!Object.keys(champs).length) return Promise.resolve(null);
      return App.ecrirePostFrais(apres.id, function(f) { Object.assign(f, champs); }, apresServeur);
    },

    // Upsert qui ne perd rien : supabase-js ne REJETTE pas sa promesse en cas
    // d'échec, il la résout avec { error }. Les gestionnaires « .then(ok, échec) »
    // ne voyaient donc jamais les erreurs, et la file d'attente hors-ligne ne
    // recevait presque rien. Ici : erreur réseau → file d'attente ; refus du
    // serveur → journalisé (le rejouer ne changerait rien). Renvoie le contenu
    // tel qu'enregistré par le serveur, ou null.
    // champs (facultatif) : les seuls champs modifiés. Hors ligne, c'est eux qui
    // partent en file d'attente, réappliqués plus tard sur une version relue.
    _upsertFiable: function(table, row, champs) {
      if (!supabase) return Promise.resolve(null);
      // Tant que la réponse n'est pas là, une synchro ne doit pas remplacer la
      // copie locale par la version du serveur (voir mergePostsWithLocal).
      var enVol = table === 'kun_com_posts' && row && row.id;
      if (enVol) ecrituresEnVol[row.id] = Date.now();
      var fin = function() { if (enVol) delete ecrituresEnVol[row.id]; };
      return supabase.from(table).upsert(row, { onConflict: 'id' }).select('content').single().then(function(r) {
        fin();
        if (r && r.error) {
          if (estErreurReseau(r.error)) App._mettreEnFileAttenteEcriture({ table: table, row: row, champs: champs });
          else console.warn('Écriture refusée par le serveur (' + table + ') :', r.error);
          return null;
        }
        return (r && r.data && r.data.content) || null;
      }, function(e) {
        fin();
        App._mettreEnFileAttenteEcriture({ table: table, row: row, champs: champs });
        console.warn('Écriture mise en file d\'attente (' + table + ') :', e);
        return null;
      });
    },

    _messageNonEnvoye: function(id, err) {
      console.warn('Message refusé par le serveur :', err);
      var maj = function(liste) { (liste || []).forEach(function(m){ if (m && m.id === id) m.nonEnvoye = true; }); };
      var dms = db(SK.DMS, []); maj(dms); dbSet(SK.DMS, dms);
      maj(S.dmMessages);
      render();
      toast('Message non envoyé. Vérifie ton accès à cette conversation.', 'error');
    },
    // ---- File d'attente d'écritures hors-ligne ----
    // Les upserts réseau étaient « fire-and-forget » : hors connexion, le toast
    // annonçait un succès mais rien n'arrivait jamais au serveur (et une
    // suppression dont le tombstone échouait ressuscitait à chaque synchro).
    // Les écritures qui échouent sont désormais empilées dans le localStorage,
    // puis rejouées au retour du réseau / à la connexion suivante.
    _mettreEnFileAttenteEcriture: function(item) {
      try {
        var file = JSON.parse(localStorage.getItem('kc_pending_writes') || '[]');
        file.push(Object.assign({ at: Date.now() }, item));
        // Borne raisonnable : au-delà, on privilégie les écritures récentes.
        while (file.length > 200) file.shift();
        localStorage.setItem('kc_pending_writes', JSON.stringify(file));
      } catch(e) {}
    },
    viderFileAttenteEcriture: async function() {
      var file = [];
      try { file = JSON.parse(localStorage.getItem('kc_pending_writes') || '[]'); } catch(e) {}
      if (!file.length || !supabase) return;
      localStorage.setItem('kc_pending_writes', '[]'); // vidé d'abord : un échec ci-dessous repousse l'item
      for (var i = 0; i < file.length; i++) {
        var w = file[i];
        // Au-delà d'une semaine, une écriture en attente est abandonnée.
        if (w.at && Date.now() - w.at > 7 * 24 * 3600 * 1000) continue;
        try {
          var ligne = w.row;
          // Modification d'une publication : réappliquée sur la version du
          // serveur relue maintenant, jamais la copie entière d'il y a des jours.
          if (w.table === 'kun_com_posts' && w.champs && w.row && w.row.id) {
            var lu = await supabase.from('kun_com_posts').select('content').eq('id', w.row.id).limit(1);
            if (lu && lu.error) throw lu.error;
            var actuel = lu && lu.data && lu.data[0] && lu.data[0].content;
            if (actuel && typeof actuel === 'object') ligne = { id: w.row.id, content: Object.assign({}, actuel, w.champs) };
          }
          var r = await supabase.from(w.table).upsert(ligne, { onConflict: 'id' });
          if (r && r.error) throw r.error;
        } catch(e) {
          // Seule une panne réseau mérite un nouvel essai. Un refus du serveur
          // (droits, données invalides) se reproduirait à l'identique à chaque
          // démarrage : on l'abandonne au lieu de le rejouer indéfiniment.
          if (estErreurReseau(e)) {
            console.warn('File d\'attente : écriture toujours impossible, replacée.', e);
            App._mettreEnFileAttenteEcriture(w);
          } else {
            console.warn('File d\'attente : écriture refusée par le serveur, abandonnée.', e);
          }
        }
      }
    },
    saisieAuth: function(id, val) {
      if (!S.champsAuth) S.champsAuth = {};
      S.champsAuth[id] = val;
    },
    login: async function(e) {
      e && e.preventDefault();
      // Empêche les connexions concurrentes : sans ceci, un appui répété pendant
      // une connexion lente (réseau mobile) déclenchait autant de téléchargements
      // complets des profils EN PARALLÈLE, ce qui saturait encore plus la
      // connexion et allongeait l'attente au lieu de la raccourcir.
      if (App._loginEnCours) return;
      // Connexion au NUMÉRO (transformé en identifiant interne, voir phoneToEmail).
      var phoneRaw = ((document.getElementById('loginPhone')||{}).value || '').trim();
      var email = phoneToEmail(phoneRaw);
      var pwd = ((document.getElementById('loginPwd')||{}).value || '').trim();
      if (!email) { toast('Saisis ton numéro de téléphone.', 'error'); return; }
      if (!pwd) { toast('Saisis ton mot de passe.', 'error'); return; }

      App._loginEnCours = true;
      var btn = document.getElementById('loginSubmitBtn');
      var btnTexteOriginal = btn ? btn.textContent : null;
      if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Connexion...'; }

      try {
        // AUTHENTIFICATION SUPABASE — plus aucune comparaison de mot de passe côté
        // client. Supabase vérifie l'identifiant contre auth.users (bcrypt côté
        // serveur) et renvoie une session + un JWT (avec le rôle dans app_metadata).
        if (!supabase || !supabase.auth) { toast('Connexion indisponible.', 'error'); return; }
        var resp = await supabase.auth.signInWithPassword({ email: email, password: pwd });
        if (!resp || resp.error || !resp.data || !resp.data.user) {
          toast('Numéro ou mot de passe incorrect.', 'error');
          return;
        }
        applyAuthUser(resp.data.user);   // définit S.user (rôle depuis le JWT) + S.auth='app'
        S.tab = 'home';
        S.champsAuth = {};
        render();
        toast('Connexion réussie ! Bienvenue ' + (S.user && S.user.prenom || 'Membre') + '. ', 'success');
        try { syncSupabaseToLocal(); } catch(e){}
        try { App.viderFileAttenteEcriture(); } catch(e){}
        try { tryOpenDeepLinkedPost(); } catch(e){}
      } finally {
        App._loginEnCours = false;
        // Si l'écran de connexion est toujours affiché (erreur, mot de passe
        // incorrect, délai dépassé...), rétablir le bouton. En cas de connexion
        // réussie, render() a déjà remplacé tout l'écran : ce bouton n'existe
        // plus dans le document, la vérification ci-dessous l'ignore alors sans
        // risque.
        if (btn && document.body.contains(btn)) {
          btn.disabled = false; btn.style.opacity = '';
          if (btnTexteOriginal !== null) btn.textContent = btnTexteOriginal;
        }
      }
    },
    signup: async function(e) {
      e && e.preventDefault();
      // Garde anti double-clic (même raisonnement que _loginEnCours pour login) :
      // sans lui, un appui répété pendant l'inscription lançait deux signUp en
      // parallèle — le second produisait un faux « compte existe déjà ».
      if (App._signupEnCours) return;
      var prenom = ((document.getElementById('signupPrenom')||{}).value||'').trim();
      var nom = ((document.getElementById('signupNom')||{}).value||'').trim();
      // Inscription au NUMÉRO : identifiant interne dérivé, numéro lisible stocké.
      var phoneRaw = ((document.getElementById('signupPhone')||{}).value||'').trim();
      var email = phoneToEmail(phoneRaw);
      var phoneDigits = normalizePhone(phoneRaw);
      var phoneDisplay = formatPhoneDisplay(phoneRaw);
      var pwd = ((document.getElementById('signupPwd')||{}).value||'').trim();
      if (!prenom || !nom || !email || !pwd) { toast('Remplis tous les champs, numéro compris.', 'error'); return; }
      if (pwd.length < 8) { toast('Le mot de passe doit contenir au moins 8 caractères.', 'error'); return; }
      if (S.signupSections.length === 0) { toast('Choisis au moins un pôle.', 'error'); return; }
      var accepte = (document.getElementById('signupConditions') || {}).checked;
      if (!accepte) { toast('Pour créer un compte, coche « J\'accepte les conditions d\'utilisation ».', 'error'); return; }
      // Questions de sécurité obligatoires : c'est le seul moyen de récupération.
      var secQA = readSecurityQA('signup', true);
      if (!secQA) return;
      if (!supabase || !supabase.auth) { toast('Inscription indisponible.', 'error'); return; }
      App._signupEnCours = true;
      var userSecs = S.signupSections.length > 0 ? S.signupSections.slice() : ['cadrage'];
      try {
        // INSCRIPTION SUPABASE AUTH — crée le compte dans auth.users. Le rôle est
        // TOUJOURS MEMBRE ; l'élévation (Responsable / Admin) ne se fait
        // qu'ensuite, par un Admin via l'Edge Function protégée.
        var resp = await supabase.auth.signUp({
          email: email, password: pwd,
          options: { data: { prenom: prenom, nom: nom, phone: phoneDisplay } }
        });
        if (resp.error) {
          var m = resp.error.message || '';
          if (/registered|already|exists/i.test(m)) toast('Un compte existe déjà avec ce numéro.', 'error');
          else toast('Inscription impossible : ' + m, 'error');
          return;
        }
        var authUser = resp.data && resp.data.user;
        var session = resp.data && resp.data.session;
        if (!session) {
          // Pas de session immédiate = la confirmation e-mail est activée. On ne
          // connecte pas et on n'écrit pas encore le profil (l'upsert serait refusé
          // par la RLS faute de session) : la fiche sera créée à la 1re connexion
          // confirmée, via applyAuthUser. On mémorise les sections choisies pour
          // qu'elles soient conservées à ce moment-là.
          try { localStorage.setItem('kc_pending_signup', JSON.stringify({ email: email, phone: phoneDisplay, prenom: prenom, nom: nom, sections: userSecs, section_id: userSecs[0] })); } catch(e){}
          toast('Compte créé. Connecte-toi avec ton numéro.', 'success');
          S.auth = 'login'; S.signupSections = []; S.signupRole = 'MEMBRE'; S.champsAuth = {};
          render();
          return;
        }

        var newUser = { id: authUser.id, prenom: prenom, nom: nom, phone: phoneDisplay,
          sections: userSecs, section_id: userSecs[0], role: 'MEMBRE', is_online: true,
          last_seen_at: new Date().toISOString(), last_action: 'Inscription',
          avatar_color: ['#0B5FE0','#FF2D55','#0E9F6E','#D98A0B','#0B5FE0','#AF52DE'][Math.floor(Math.random()*6)],
          welcomeStars: 5, joined_at: Date.now(),   // bonus 5★ + date d'inscription
          // Trace de l'acceptation des conditions (version et date).
          conditionsAcceptees: { version: CONDITIONS_VERSION, le: Date.now() }, conditionsLues: CONDITIONS_VERSION,
          // En attente jusqu'à la validation par un Admin ou un Responsable
          // (le serveur impose de toute façon cette valeur).
          approuve: false };

        // Écrit le profil (SANS aucun secret : ni mot de passe, ni question de
        // sécurité). Autorisé par la policy RLS car id = auth.uid().
        try {
          var syncRes = await supabase.from('kun_com_profiles')
            .upsert({ id: newUser.id, content: newUser }, { onConflict: 'id' });
          if (syncRes.error) console.error('Supabase profile save error:', syncRes.error);
        } catch(err) { console.warn('Supabase signup sync exception:', err); }

        // Enregistre les questions de sécurité (hachées côté serveur via l'Edge
        // Function). Bloquant : sans elles, le membre n'aurait aucun moyen de
        // récupération. On la connexion vient d'être établie -> JWT disponible.
        try {
          var secRes = await supabase.functions.invoke('password-recovery', {
            body: { action: 'set', phone: phoneDigits, q1: secQA.q1, q2: secQA.q2, a1: secQA.a1, a2: secQA.a2 }
          });
          if (secRes && secRes.error) console.warn('set security questions error:', secRes.error);
        } catch(err) { console.warn('set security questions exception:', err); }

        var users = db(SK.USERS, []);
        users.push(newUser); dbSet(SK.USERS, users);
        sauverSession(newUser);
        S.user = newUser; S.auth = 'app';
        // L'arrivée est annoncée à l'équipe au moment de la validation
        // (App.validerInscription), plus à l'inscription.

        S.signupSections = []; S.signupRole = 'MEMBRE'; S.champsAuth = {};
        render();
        toast('Bienvenue ' + prenom + ' ! Ton compte a été créé.', 'success');
        try { syncSupabaseToLocal(); } catch(e){}
      } catch(err) {
        console.warn('signup error:', err);
        toast('Inscription impossible. Réessaie.', 'error');
      } finally {
        App._signupEnCours = false;
      }
    },
    toggleTheme: function() {
      S.darkMode = !S.darkMode;
      try { localStorage.setItem('kc_dark', S.darkMode ? '1' : '0'); } catch(e){}
      try { applyTheme(); } catch(e){}
      render();
    },
    // Vide tous les caches du service worker puis recharge l'app : utile quand
    // un appareil affiche une ancienne version malgré une mise à jour (cache
    // persistant, réseau capricieux). Le SW re-remplit son cache au chargement.
    viderCacheApp: async function() {
      try {
        if (!window.confirm('Vider le cache de l\'application ? L\'app va se recharger.')) return;
        if (window.caches && caches.keys) {
          var cles = await caches.keys();
          await Promise.all(cles.map(function(k){ return caches.delete(k); }));
        }
        toast('Cache vidé. Rechargement…', 'success');
        setTimeout(function(){ location.reload(); }, 400);
      } catch(e) { toast('Impossible de vider le cache.', 'error'); }
    },
    logout: async function() {
      if (S.user) {
        var users = db(SK.USERS, []); var idx = users.findIndex(function(u){ return u.id===S.user.id; });
        if (idx !== -1) { users[idx].is_online=false; users[idx].last_action='Déconnexion'; dbSet(SK.USERS, users); }
      }
      // Déconnexion RÉELLE : couper la session Supabase (sinon getSession() au
      // rechargement reconnecte automatiquement). onAuthStateChange remettra
      // l'écran de connexion.
      // Ce téléphone ne doit plus recevoir les notifications du compte quitté.
      try {
        var subPush = await App._abonnementPush();
        if (subPush && supabase) await supabase.from('kun_com_push_abonnements').delete().eq('id', subPush.endpoint);
      } catch(e) {}
      // Ce téléphone seulement : les autres appareils du compte restent connectés.
      try { if (supabase && supabase.auth) await supabase.auth.signOut({ scope: 'local' }); } catch(e) { console.warn('signOut:', e); }
      localStorage.removeItem(SK.SESS); sessionStorage.removeItem(SK.SESS);
      // S15 : sur un appareil partagé, rien du compte quitté ne doit rester
      // lisible (messages privés, fiches, publications), et ses écritures en
      // attente ne doivent pas repartir avec le jeton de la personne suivante.
      [SK.DMS, SK.USERS, SK.POSTS, SK.LIEUX, SK.SAVED, SK.LIKED_COMMENTS, SK.SECTION_SEEN, 'kc_pending_writes'].forEach(function(k) {
        try { localStorage.removeItem(k); } catch(e) {}
        try { delete DB_CACHE[k]; } catch(e) {}
      });
      S.user=null; S.jwtRole=null; S.jwtApprouve=false; S.auth='login'; S.tab='home'; render();
    },
    // Écran d'attente : la validation a-t-elle eu lieu ? Nouveau jeton (qui
    // porte app_metadata.approuve) puis relecture de sa fiche.
    verifierValidation: async function() {
      if (S.verificationEnCours || !supabase) return;
      S.verificationEnCours = true; render();
      try {
        try {
          var sess = await supabase.auth.refreshSession();
          if (sess && sess.data && sess.data.user) applyAuthUser(sess.data.user);
        } catch(e) {}
        await fetchProfilesSilently();
      } finally {
        S.verificationEnCours = false;
      }
      if (compteEnAttente(S.user)) {
        render();
        toast('Pas encore validé. Réessaie un peu plus tard.', 'info');
        return;
      }
      if (S.user) S.user.approuve = true;
      render();
      toast('Ton compte est validé. Bienvenue dans l\'équipe !', 'success');
      try { syncSupabaseToLocal(); } catch(e) {}
    },
    // Admin ou Responsable : valide (ou refuse) une inscription. Le refus
    // supprime le compte ; la validation annonce l'arrivée à toute l'équipe.
    validerInscription: async function(userId, accepter) {
      var users = db(SK.USERS, []);
      var m = users.find(function(x){ return x.id === userId; });
      if (!m || !supabase || !supabase.functions) return;
      var nom = ((m.prenom || '') + ' ' + (m.nom || '')).trim() || 'cette personne';
      if (!accepter && !window.confirm('Refuser l\'inscription de ' + nom + ' ? Son compte sera supprimé.')) return;
      try {
        var r = await supabase.functions.invoke('set-role', { body: { action: accepter ? 'approuver' : 'refuser', userId: userId } });
        if (r && r.error) {
          var msg = 'Échec : réessaie dans un instant.';
          try { if (r.error.context && r.error.context.json) { var b = await r.error.context.json(); if (b && b.error) msg = b.error; } } catch(e){}
          toast(msg, 'error');
          return;
        }
      } catch(e) { toast('Échec : réessaie dans un instant.', 'error'); return; }
      users = db(SK.USERS, []);
      if (accepter) {
        var idx = users.findIndex(function(x){ return x.id === userId; });
        if (idx !== -1) { users[idx].approuve = true; dbSet(SK.USERS, users); }
        try { announceNewMember(users[idx] || m); } catch(e) {}
        toast(nom + ' a maintenant accès à Commit.', 'success');
      } else {
        dbSet(SK.USERS, users.filter(function(x){ return x.id !== userId; }));
        toast('Inscription refusée.', 'success');
      }
      render();
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
    // Bascule entre « Publications » (les miennes) et « Enregistrées » (celles
    // que j'ai mises en favori, quel qu'en soit l'auteur) dans la grille du profil.
    setProfileGridTab: function(tab) {
      S.profileGridTab = tab;
      S.profileSelectMode = false;
      S.selectedProfilePostIds = [];
      render();
    },
    // Une image de publication hébergée peut expirer ou échouer à charger (URL
    // cassée, politique du bucket) : sans repli, la tuile de la grille du profil
    // restait totalement vide. On la remplace par le texte de la publication.
    handleProfileTileImgError: function(img) {
      var wrap = img.closest('[data-tile]');
      if (!wrap) return;
      var media = wrap.querySelectorAll('img,video');
      for (var i = 0; i < media.length; i++) media[i].remove();
      var fallback = document.createElement('div');
      fallback.style.cssText = 'width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;line-height:1.45;color:var(--muted);overflow:hidden;';
      fallback.textContent = img.getAttribute('data-fallback') || 'Publication';
      wrap.insertBefore(fallback, wrap.firstChild);
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
        // Contrôle de propriété : la sélection venait d'un état UI falsifiable.
        // On ne supprime que les publications appartenant réellement à
        // l'utilisateur (ou toutes si Admin), comme deletePost le fait unitairement.
        var uBulk = S.user || {};
        var toDelete = posts.filter(function(p){ return ids.indexOf(p.id) !== -1 && (p.userId === uBulk.id || uBulk.role === 'GRAND_RESPONSABLE'); });
        var remaining = posts.filter(function(p){ return ids.indexOf(p.id) === -1 || !(p.userId === uBulk.id || uBulk.role === 'GRAND_RESPONSABLE'); });
        dbSet(SK.POSTS, remaining);

        if (supabase) {
          // Suppression douce (voir App.deletePost) : sans marqueur explicite
          // status:'deleted', mergePostsWithLocal (additif par conception) ne
          // propage jamais la disparition aux autres appareils.
          toDelete.forEach(function(p) {
            var tombstone = Object.assign({}, p, { status: 'deleted' });
            // _upsertFiable : supabase-js ne rejette jamais, il renvoie { error } ;
            // hors ligne, la suppression part en file d'attente au lieu d'être perdue.
            App._upsertFiable('kun_com_posts', { id: p.id, content: tombstone });
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
        toast('Une erreur est survenue. Réessaie.', 'error');
      }
    },

    openDeleteAccount: function() { S.deleteAccountOpen = true; S.deleteAccountBusy = false; render(); setTimeout(function(){ var i=document.getElementById('deleteAccountConfirmInput'); if(i) i.focus(); },150); },
    closeDeleteAccount: function() { if (S.deleteAccountBusy) return; S.deleteAccountOpen = false; render(); },
    confirmDeleteAccount: async function() {
      if (S.deleteAccountBusy) return;
      var input = document.getElementById('deleteAccountConfirmInput');
      var val = (input ? input.value : '').trim().toUpperCase();
      if (val !== 'SUPPRIMER') { toast('Tape SUPPRIMER pour confirmer.', 'error'); return; }
      if (!S.user) return;
      var userId = S.user.id;
      // S16 : jamais sans Admin. Vérifié AVANT d'effacer quoi que ce soit (le
      // serveur refuse aussi, mais publications et fiche seraient déjà parties).
      if (isGrandResponsable(S.user) && db(SK.USERS, []).filter(function(u){ return u && u.role === 'GRAND_RESPONSABLE'; }).length <= 1) {
        toast('Tu es le dernier Admin : nomme d\'abord un autre Admin, puis supprime ton compte.', 'error');
        return;
      }

      S.deleteAccountBusy = true;
      render();

      try {
        // 1) Supprime toutes les publications de l'utilisateur (local + Supabase)
        var posts = db(SK.POSTS, []);
        var myPosts = posts.filter(function(p){ return p.userId === userId; });
        var remainingPosts = posts.filter(function(p){ return p.userId !== userId; });
        dbSet(SK.POSTS, remainingPosts);

        // Le cache local ne contient qu'une page récente (60 publications) : s'en
        // tenir à lui laissait DÉFINITIVEMENT en ligne les publications plus
        // anciennes, sans auteur et impossibles à supprimer ensuite. On demande
        // donc au serveur la liste complète des publications de ce compte.
        if (supabase) {
          try {
            var resMiennes = await supabase.from('kun_com_posts').select('*').eq('content->>userId', userId);
            if (resMiennes && resMiennes.data) {
              var connues = {};
              myPosts.forEach(function(p){ if (p && p.id) connues[p.id] = true; });
              resMiennes.data.forEach(function(item) {
                var p = parsePostItem(item);
                if (p && p.id && !connues[p.id]) { connues[p.id] = true; myPosts.push(p); }
              });
            }
          } catch(e) { console.warn('Lecture des publications à supprimer :', e); }
        }

        if (supabase) {
          // Suppression douce (voir App.deletePost) : sans marqueur explicite
          // status:'deleted', mergePostsWithLocal (additif par conception) ne
          // propage jamais la disparition aux autres appareils.
          myPosts.forEach(function(p) {
            var tombstone = Object.assign({}, p, { status: 'deleted' });
            App._upsertFiable('kun_com_posts', { id: p.id, content: tombstone });
          });
        }
        // Nettoie les fichiers médias associés dans Storage (sauf s'ils sont encore
        // utilisés par un partage fait par quelqu'un d'autre).
        myPosts.forEach(function(p) {
          deleteUnusedMediaFromStorage((p.mediaUrls || []), p.id);
        });

        // 1 bis) Retire ses traces DANS les publications des autres : ses J'aime
        // (qui continuaient d'être comptés), ses commentaires et réponses, ses
        // votes aux sondages, ses vues et ses assignations. Sans cela, un compte
        // supprimé restait visible partout ailleurs que dans ses propres
        // publications.
        var restantsNettoyes = retirerTracesDUnCompte(remainingPosts, userId);
        dbSet(SK.POSTS, restantsNettoyes.posts);
        if (supabase && restantsNettoyes.modifies.length) {
          await Promise.all(restantsNettoyes.modifies.map(function(p) {
            // Ses commentaires sont désignés explicitement : le serveur ne
            // supprime jamais un commentaire sur sa seule absence (migration 06).
            var avant = remainingPosts.find(function(x){ return x && x.id === p.id; }) || {};
            var miens = (avant.comments || []).filter(function(c){ return c && c.userId === userId && c.id; })
              .map(function(c){ return c.id; });
            // Recalculé sur la version du serveur (pas la copie locale entière).
            return App.ecrirePostFrais(p.id, function(f) {
              var propre = retirerTracesDUnCompte([f], userId).posts[0];
              if (propre) Object.assign(f, propre);
              if (miens.length) f._supprimerCommentaires = miens;
            }).catch(function(e){ console.warn('Nettoyage des traces sur ' + p.id + ' :', e); });
          }));
        }

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

        // 2 bis) Suppression RÉELLE du compte dans auth.users, via l'Edge
        // Function « delete-account » (clé service_role côté serveur). Sans
        // elle, le compte restait supprimable en apparence mais une simple
        // reconnexion recréait la fiche : le membre « supprimé » réapparaissait
        // dans l'annuaire. Si la fonction n'est pas encore déployée, on
        // continue (la fiche est déjà retirée) et l'erreur est journalisée.
        if (supabase && supabase.functions) {
          try {
            var rDelCompte = await supabase.functions.invoke('delete-account', { body: {} });
            if (rDelCompte && rDelCompte.error) console.warn('delete-account :', rDelCompte.error);
          } catch(eDelCompte) { console.warn('delete-account indisponible :', eDelCompte); }
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
        toast('Ton compte et tes publications ont été supprimés.', 'success');
      } catch(e) {
        console.warn('confirmDeleteAccount error:', e);
        S.deleteAccountBusy = false;
        render();
        toast('Une erreur est survenue. Réessaie.', 'error');
      }
    },

    // ============================================================
    // PANNEAU ADMIN — statistiques de stockage Supabase
    // Réservé au rôle Admin, lu dans le JWT. (Il était auparavant protégé par un
    // code écrit en clair dans le code source, donc lisible par n'importe qui.)
    // ============================================================
    // Rétrograde le compte connecté au rôle MEMBRE. Le rôle vit dans le JWT
    // (app_metadata), pas dans la fiche : l'ancienne version ne modifiait que la
    // fiche, et la reconnexion suivante rendait le rôle Admin. On passe donc par
    // l'Edge Function « set-role », qui refuse de retirer le DERNIER Admin.
    revokeGrandResponsable: async function() {
      if (!S.user || S.jwtRole !== 'GRAND_RESPONSABLE') return;
      if (!window.confirm('Quitter le rôle Admin et repasser en Membre simple ?')) return;
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      try {
        var r = await supabase.functions.invoke('set-role', { body: { userId: S.user.id, role: 'MEMBRE' } });
        if (r && r.error) {
          var msg = 'Échec : le rôle n\'a pas été modifié.';
          try { if (r.error.context && r.error.context.json) { var b = await r.error.context.json(); if (b && b.error) msg = b.error; } } catch(e){}
          toast(msg, 'error');
          return;
        }
        // Nouveau JWT tout de suite, pour que l'interface suive sans reconnexion.
        try {
          var sess = await supabase.auth.refreshSession();
          if (sess && sess.data && sess.data.user) applyAuthUser(sess.data.user);
        } catch(e) {}
        render();
        toast('Rôle Admin retiré : tu es de nouveau Membre.', 'success');
      } catch(e) {
        toast('Échec : le rôle n\'a pas été modifié.', 'error');
      }
    },
    openStorageStats: function() {
      if (!isGrandResponsable(S.user)) { toast('Réservé à l\'Admin.', 'error'); return; }
      S.storageStatsOpen = true;
      render();
      App.loadStorageStats();
    },
    closeStorageStats: function() { S.storageStatsOpen = false; render(); },

    // ---- Gestion des rôles (réservée au Admin) ----
    // Le changement de rôle passe par l'Edge Function « set-role » qui écrit le
    // rôle dans le JWT (app_metadata) côté serveur — un membre ne peut donc pas
    // se promouvoir lui-même. La personne concernée doit se reconnecter pour que
    // son nouveau jeton (et donc ses droits) prenne effet.
    openRolesPanel: function() {
      var meProf = S.user && db(SK.USERS, []).find(function(x){ return x.id === S.user.id; });
      var amAdmin = S.jwtRole === 'GRAND_RESPONSABLE'
        || (S.user && S.user.role === 'GRAND_RESPONSABLE')
        || (meProf && meProf.role === 'GRAND_RESPONSABLE');
      if (!amAdmin) { toast('Réservé à l\'Admin.', 'error'); return; }
      S.rolesPanelOpen = true; render();
    },
    closeRolesPanel: function() { S.rolesPanelOpen = false; S.roleUpdatingId = null; render(); },
    setMemberRole: async function(userId, role) {
      // Test sur le rôle du JWT (S.jwtRole, signé par Supabase) et non sur
      // S.user.role : ce dernier vient d'un JSON stocké en localStorage,
      // modifiable — adminResetPassword utilise déjà le JWT, on s'aligne.
      if (!S.user || S.jwtRole !== 'GRAND_RESPONSABLE') { toast('Réservé au Admin.', 'error'); return; }
      if (userId === S.user.id) { toast('Tu ne peux pas modifier ton propre rôle ici (pour ne pas te verrouiller dehors). Passe par un autre Admin.', 'info'); return; }
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      var LABELS = { STAGIAIRE: 'Stagiaire', MEMBRE: 'Membre', RESP_SECTION: 'Responsable de pôle', GRAND_RESPONSABLE: 'Admin' };
      S.roleUpdatingId = userId; render();
      try {
        var r = await supabase.functions.invoke('set-role', { body: { userId: userId, role: role } });
        if (r && r.error) {
          var msg = 'Échec de la mise à jour.';
          try { if (r.error.context && r.error.context.json) { var b = await r.error.context.json(); if (b && b.error) msg = b.error; } } catch(e){}
          toast(msg, 'error');
        } else {
          var users = db(SK.USERS, []);
          var idx = users.findIndex(function(u){ return u.id === userId; });
          // Un changement de rôle valide aussi le compte (voir set-role).
          if (idx !== -1) { users[idx].role = role; users[idx].approuve = true; dbSet(SK.USERS, users); }
          toast('Rôle mis à jour : ' + (LABELS[role] || role) + '. La personne doit se reconnecter.', 'success');
        }
      } catch(e) { toast('Échec de la mise à jour.', 'error'); }
      S.roleUpdatingId = null; render();
    },
    // Réinitialisation du mot de passe d'un membre par l'Admin (pour les comptes
    // sans questions de sécurité). L'Edge Function génère un mot de passe
    // provisoire via l'API admin ; on l'affiche à l'Admin pour qu'il le transmette.
    // S9 : seuls l'Admin (et le membre tant que son inscription est en
    // attente) fixent les pôles, qui ouvrent canaux et plan de préparation.
    definirPoleMembre: async function(userId, pole) {
      if (!isGrandResponsable(S.user) || !supabase) return;
      var u = db(SK.USERS, []).find(function(x){ return x.id === userId; });
      if (!u) return;
      var poles = getUserSections(u).filter(function(p){ return SECTIONS.some(function(s){ return s.id === p; }); });
      var i = poles.indexOf(pole);
      if (i !== -1) poles.splice(i, 1);
      else {
        if (poles.length >= 2) { toast('Deux pôles au plus : retire d\'abord l\'un des deux.', 'error'); return; }
        poles.push(pole);
      }
      var r = await supabase.rpc('kc_definir_poles', { p_membre: userId, p_poles: poles });
      if (r && r.error) { toast('Changement de pôle impossible. Réessaie.', 'error'); return; }
      var users = db(SK.USERS, []);
      var cible = users.find(function(x){ return x.id === userId; });
      if (cible) { cible.sections = poles; delete cible.section_id; dbSet(SK.USERS, users); }
      render();
      toast('Pôles de ' + (u.prenom || 'ce membre') + ' : ' + (poles.length ? poles.map(secNom).join(' et ') : 'aucun') + '.', 'success');
    },
    adminResetPassword: async function(userId, name) {
      if (!S.user || S.jwtRole !== 'GRAND_RESPONSABLE') { toast('Réservé à l\'Admin.', 'error'); return; }
      if (!supabase || !supabase.functions) { toast('Service indisponible.', 'error'); return; }
      if (!window.confirm('Générer un mot de passe provisoire pour ' + (name || 'ce membre') + ' ?')) return;
      try {
        var r = await supabase.functions.invoke('password-recovery', { body: { action: 'admin-reset', userId: userId } });
        if (r && r.error) {
          var msg = 'Échec de la réinitialisation.';
          try { if (r.error.context && r.error.context.json) { var b = await r.error.context.json(); if (b && b.error) msg = b.error; } } catch(e){}
          toast(msg, 'error'); return;
        }
        if (!r || !r.data || !r.data.ok) { toast('Échec de la réinitialisation.', 'error'); return; }
        S.adminResetResult = { name: name || 'ce membre', password: r.data.password };
        render();
      } catch(e) { toast('Échec de la réinitialisation.', 'error'); }
    },
    closeAdminReset: function() { S.adminResetResult = null; render(); },
    openSettings: function() { S.settingsOpen = true; render(); App.verifierEtatPush(); },
    closeSettings: function() { S.settingsOpen = false; render(); },

    // ---- Notifications sur le téléphone ----
    _abonnementPush: async function() {
      if (!pushDisponible()) return null;
      var reg = await navigator.serviceWorker.getRegistration();
      return reg ? await reg.pushManager.getSubscription() : null;
    },
    verifierEtatPush: async function() {
      try {
        var sub = await App._abonnementPush();
        var etat = sub ? 'actif' : 'inactif';
        if (S.pushEtat !== etat) { S.pushEtat = etat; render(); }
      } catch(e) {}
    },
    activerPush: async function() {
      if (!pushDisponible() || !S.user || !supabase) { toast('Notifications indisponibles sur cet appareil.', 'error'); return; }
      S.pushEtat = 'encours'; render();
      try {
        var permission = await Notification.requestPermission();
        if (permission !== 'granted') { S.pushEtat = 'inactif'; render(); toast('Autorisation refusée : rien ne sera envoyé sur ce téléphone.', 'info'); return; }
        var cle = await supabase.functions.invoke('push', { body: { action: 'cle' } });
        if (!cle || cle.error || !cle.data || !cle.data.publique) throw new Error('clé indisponible');
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.getSubscription() ||
          await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(cle.data.publique) });
        var res = await supabase.from('kun_com_push_abonnements')
          .upsert({ id: sub.endpoint, user_id: S.user.id, abonnement: sub.toJSON() }, { onConflict: 'id' });
        if (res && res.error) throw res.error;
        S.pushEtat = 'actif'; render();
        toast('Notifications activées sur ce téléphone.', 'success');
      } catch(e) {
        console.warn('activerPush :', e);
        S.pushEtat = 'inactif'; render();
        toast('Activation impossible pour le moment. Réessaie plus tard.', 'error');
      }
    },
    desactiverPush: async function() {
      try {
        var sub = await App._abonnementPush();
        if (sub) {
          if (supabase) await supabase.from('kun_com_push_abonnements').delete().eq('id', sub.endpoint);
          await sub.unsubscribe();
        }
      } catch(e) { console.warn('desactiverPush :', e); }
      S.pushEtat = 'inactif'; render();
      toast('Notifications coupées sur ce téléphone.', 'success');
    },
    basculerPrefNotif: function(id) {
      if (!S.user) return;
      var prefs = Object.assign({}, S.user.preferencesNotif || {});
      prefs[id] = !prefNotifActive(S.user, id);
      App._majMonProfil({ preferencesNotif: prefs });
    },
    // Écran ouvert par le toucher d'une notification (voir sw.js).
    ouvrirCible: function(cible) {
      cible = String(cible || '');
      if (cible.indexOf('dm:') === 0) { App.openDirectMessage(cible.slice(3)); return; }
      if (cible.indexOf('pole:') === 0) { App.openDirectMessage(cible); return; }
      if (cible === 'planning') { App.tab('planning'); return; }
      // Rappel d'étape : le plan de préparation de l'événement.
      if (cible.indexOf('prep:') === 0) {
        App.tab('planning');
        var evId = cible.slice(5);
        if (db(SK.POSTS, []).some(function(p){ return p.id === evId; })) App.ouvrirPreparation(evId);
        return;
      }
      App.openNotifications();
    },
    copyAdminResetPw: function() {
      var r = S.adminResetResult; if (!r) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.password);
        toast('Mot de passe copié.', 'success');
      } catch(e) { toast('Copie impossible — note-le à la main.', 'info'); }
    },
    // Additionne la taille de tous les fichiers du bucket post-media, page par page
    // (l'API Storage limite à 1000 résultats par appel).
    loadStorageStats: async function() {
      if (!supabase) { S.storageStatsError = 'Connexion indisponible.'; render(); return; }
      S.storageStatsLoading = true;
      S.storageStatsError = null;
      render();
      // Garde-fou : si l'appel Storage reste bloqué (réseau, CORS, policy manquante
      // qui ne renvoie jamais), on n'affiche pas un spinner infini — on bascule sur
      // un message d'erreur après 15s au lieu de laisser croire que "ça ne marche pas"
      // sans explication.
      function withTimeout(p, ms) {
        return Promise.race([
          p,
          new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error('Délai dépassé après ' + (ms/1000) + 's — vérifie la connexion ou les permissions Supabase.')); }, ms);
          })
        ]);
      }
      try {
        var totalBytes = 0;
        var fileCount = 0;
        var offset = 0;
        var pageSize = 1000;
        while (true) {
          var res = await withTimeout(
            supabase.storage.from('post-media').list('', { limit: pageSize, offset: offset, sortBy: { column: 'name', order: 'asc' } }),
            15000
          );
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
        // On affiche le détail réel de l'erreur Supabase (au lieu d'un message
        // générique) pour pouvoir diagnostiquer immédiatement depuis l'app.
        var detail = e && (e.message || e.error_description || e.msg || e.statusText);
        S.storageStatsError = 'Impossible de lire le stockage' + (detail ? ' : ' + detail : ' (vérifie la permission SELECT sur storage.objects pour le bucket post-media).');
      }
      S.storageStatsLoading = false;
      render();
    },
  });
