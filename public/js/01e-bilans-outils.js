// KUN COM VH — Partie 1e : Suivi des bilans, aperçu des liens, sondages, questions de sécurité, identifiant, présence

  'use strict';
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
  // Deux listes : la première question se choisit dans la première, la
  // seconde dans la deuxième. Les questions déjà enregistrées avec l'ancienne
  // liste restent valables pour la récupération (le serveur garde le texte).
  var SECURITY_QUESTIONS_1 = [
    "Ta ville de naissance ?",
    "Ton plat préféré ?",
    "Ta couleur préférée ?"
  ];
  var SECURITY_QUESTIONS_2 = [
    "Ton premier lieu de culte ?",
    "Ton premier département dans l'église ?",
    "Ta tribu ?"
  ];

  // Deux blocs question (menu déroulant) + réponse, réutilisés à l'inscription et
  // dans « Modifier le profil ». prefix distingue les identifiants (« signup » /
  // « edit »). q1/q2 pré-sélectionnent une question déjà définie.
  function renderSecurityQAFields(prefix, q1, q2) {
    var opts = function(sel, liste) {
      return '<option value="">Choisir une question…</option>' +
        liste.map(function(q){
          return '<option value="' + safeHtml(q) + '"' + (q === sel ? ' selected' : '') + '>' + safeHtml(q) + '</option>';
        }).join('');
    };
    var selStyle = styleSelect();
    var inpStyle = styleChamp() + 'margin-top:8px;';
    return '<div style="display:flex;flex-direction:column;gap:16px;">' +
      '<div>' +
        '<select id="' + prefix + 'SecQ1" class="kc-champ" style="' + selStyle + '">' + opts(q1, SECURITY_QUESTIONS_1) + '</select>' +
        '<input id="' + prefix + 'SecA1" type="text" class="kc-champ" placeholder="Ta réponse" autocomplete="off" style="' + inpStyle + '" />' +
      '</div>' +
      '<div>' +
        '<select id="' + prefix + 'SecQ2" class="kc-champ" style="' + selStyle + '">' + opts(q2, SECURITY_QUESTIONS_2) + '</select>' +
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
    var dlTs = echeanceTs(mine.deadline);
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
