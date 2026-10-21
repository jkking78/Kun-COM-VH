// KUN COM VH — Partie 1c : Données par défaut, état global S, lien profond, restauration de session, pôles

  'use strict';
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
