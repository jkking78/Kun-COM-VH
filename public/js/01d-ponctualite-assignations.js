// KUN COM VH — Partie 1d : Ponctualité, géolocalisation, lieux, plan de préparation, assignations

  'use strict';
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
  // Date du jour à Abidjan (UTC) : même référence que les heures d'événement.
  function isoLocal(d) {
    return (d || new Date()).toISOString().slice(0, 10);
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


  // Un événement dont l'heure de fin est antérieure ou égale à l'heure de début
  // se termine le LENDEMAIN (veillée 21:30 → 00:30, par exemple).
  function crossesMidnight(ev) {
    return !!(ev && ev.eventStart && ev.eventEnd && ev.eventEnd <= ev.eventStart);
  }

  // Horodatage de fin d'un événement. null si inconnu.
  // C8 : les heures d'événement sont celles d'Abidjan (UTC, sans heure d'été),
  // quel que soit le fuseau réglé sur le téléphone. Lues en heure locale, elles
  // décalaient les étoiles et la frise d'un téléphone réglé sur Paris.
  function heureAbidjan(date, hhmm) {
    return Date.parse(String(date) + 'T' + (hhmm || '00:00') + ':00Z');
  }
  // Échéance d'une tâche (« 2026-10-25T18:00 », saisie en heure d'Abidjan).
  function echeanceTs(deadline) {
    var s = String(deadline || '');
    if (!s) return NaN;
    return Date.parse(/Z|[+-]\d\d:\d\d$/.test(s) ? s : s + (s.length <= 16 ? ':00Z' : 'Z'));
  }
  function eventEndTimestamp(ev) {
    if (!ev || !ev.eventDate) return null;
    var hhmm = ev.eventEnd || '23:59';
    var t = heureAbidjan(ev.eventDate, hhmm);
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
    return ev.eventDate < isoLocal(new Date(now));
  }

  // Horodatage de début d'un événement (eventDate + eventStart). null si inconnu.
  function eventStartTimestamp(ev) {
    if (!ev || !ev.eventDate) return null;
    var hhmm = ev.eventStart || '00:00';
    var t = heureAbidjan(ev.eventDate, hhmm);
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
    // C6 : une position confirmée après coup (heure fixée par le serveur) vaut
    // arrivée à ce moment-là, pas à l'heure du premier pointage.
    if (typeof checkIn.geoConfirmeLe === 'number' && checkIn.geoConfirmeLe > arrival) arrival = checkIn.geoConfirmeLe;
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

  // Copie d'une assignation dont l'échéance (« AAAA-MM-JJTHH:MM ») avance de
  // jours (séries d'événements). Sans échéance, inchangée.
  function decalerEcheance(a, jours) {
    if (!a || typeof a.deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(a.deadline)) return Object.assign({}, a);
    var d = new Date(a.deadline.slice(0, 10) + 'T00:00:00Z');
    if (isNaN(d.getTime())) return Object.assign({}, a);
    d = new Date(d.getTime() + jours * 864e5);
    return Object.assign({}, a, { deadline: d.toISOString().slice(0, 10) + a.deadline.slice(10) });
  }

  // Le membre a-t-il répondu « Indisponible » à sa convocation ? Il est alors
  // excusé : ni attendu au pointage, ni compté absent, ni pénalisé.
  function aDecline(ev, userId) {
    var r = ev && ev.reponsesConvocation && ev.reponsesConvocation[userId];
    return !!(r && r.statut === 'decline');
  }

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
      if (aDecline(ev, user.id)) return false;
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
      if (aDecline(ev, userId)) return;               // excusé : rien à compter
      var startTs = eventStartTimestamp(ev);
      if (!startTs) return;

      // Deux natures d'assignation, exclusives :
      //  - avec deadline  → TÂCHE À LIVRER : notée quand le membre coche « fait »
      //                     (à temps / en retard) ou quand la deadline est passée
      //                     sans livraison. La présence physique n'entre pas en jeu.
      //  - sans deadline  → PRÉSENCE : ponctualité fondée sur l'heure de pointage.
      // Événement supprimé (archivé pour garder les étoiles déjà gagnées) : ne
      // compte que ce qui avait eu lieu AVANT la suppression. Une date future
      // supprimée comptait sinon « tâche non livrée » ou « absent » (−2★).
      var archiveLe = ev.type === 'EVENT_ARCHIVED' && typeof ev.archivedAt === 'number' ? ev.archivedAt : null;
      if (mine.deadline) {
        var dlTs = echeanceTs(mine.deadline);
        if (isNaN(dlTs)) return;
        if (archiveLe && dlTs >= archiveLe) return;
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
      // Sans pointage, le service ne compte qu'une fois le pointage fermé (fin +
      // délai de retard) : avant, il apparaissait « Manqué −2★ » alors que le
      // membre pouvait encore pointer.
      if (archiveLe && startTs >= archiveLe) return;
      var finPointage = (eventEndTimestamp(ev) || startTs) + CHECKIN_LATE_WINDOW_MS;
      if (now <= finPointage && !hasCheckedIn(userId, ev.id, posts)) return;
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
      // Services réellement assurés (les manqués n'en sont pas) : badges et tuile.
      assures: entries.filter(function(e){ return e.status !== 'missed'; }).length,
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

  // NIVEAU DE FIABILITÉ (carte « Mes engagements »)
  // Calculé sur les 10 derniers engagements (services et tâches), et non sur
  // un cycle : un mauvais jour s'efface de lui-même au fil des services
  // suivants. Seuls les engagements TENUS comptent (service à l'heure, tâche
  // livrée à temps) ; un retard ou un oubli ne retire rien, il ne compte pas.
  var FENETRE_FIABILITE = 10;
  var NIVEAUX_FIABILITE = [
    { id: 'engage', nom: 'Engagé', seuil: 0 },
    { id: 'fiable', nom: 'Fiable', seuil: 6 },
    { id: 'exemplaire', nom: 'Exemplaire', seuil: 9 }
  ];
  // entries : du plus récent au plus ancien (punctualityHistory).
  function niveauFiabilite(entries) {
    var tenu = function(e) { return e && e.status === 'ontime'; };
    var recents = (entries || []).slice(0, FENETRE_FIABILITE);
    var tenus = recents.filter(tenu).length;
    var rang = 0;
    NIVEAUX_FIABILITE.forEach(function(n, i) { if (tenus >= n.seuil) rang = i; });
    var suivant = NIVEAUX_FIABILITE[rang + 1] || null;
    // Engagements tenus d'affilée qu'il faut encore pour monter d'un niveau.
    // On simule la fenêtre qui glisse : chaque nouveau service en fait sortir
    // le plus ancien, qui pouvait lui-même être un engagement tenu.
    var manque = 0;
    if (suivant) {
      var fenetre = recents.slice();
      var t = tenus;
      while (t < suivant.seuil && manque < FENETRE_FIABILITE) {
        fenetre.unshift({ status: 'ontime' });
        if (fenetre.length > FENETRE_FIABILITE) fenetre.pop();
        t = fenetre.filter(tenu).length;
        manque++;
      }
    }
    return { niveau: NIVEAUX_FIABILITE[rang], rang: rang, suivant: suivant, manque: manque,
             tenus: tenus, total: recents.length, recents: recents };
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
      if (aDecline(ev, a.userId)) return false;      // excusé
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
