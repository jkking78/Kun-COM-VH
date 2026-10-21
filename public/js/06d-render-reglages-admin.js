// KUN COM VH — Partie 6d : Paramètres, lieux enregistrés, tableau de bord Admin, conditions, visite guidée, installation, indisponibilités, alerte de pointage

  'use strict';
  // ============================================================
  // PAGE PARAMÈTRES
  // ============================================================
  // Regroupe tout ce qui encombrait le profil : informations, apparence,
  // administration, compte et déconnexion. Écran plein, sections en cartes.
  function renderSettingsModal() {
    if (!S.settingsOpen) return '';
    var u = S.user || {};
    var freshU = db(SK.USERS, []).find(function(x){ return x.id === u.id; }) || u;
    var uSecs = getUserSections(freshU).filter(function(s){ return SECTIONS.some(function(x){ return x.id === s; }); });
    var isAdmin = (freshU.role === 'GRAND_RESPONSABLE' || S.jwtRole === 'GRAND_RESPONSABLE');

    var section = function(titre, contenu) {
      return '<div style="margin-bottom:16px;">' +
        '<div style="font-size:12px;font-weight:700;color:' + UI.muted + ';margin:0 4px 8px;">' + titre + '</div>' +
        '<div style="background:' + UI.card + ';border-radius:20px;overflow:hidden;">' + contenu + '</div>' +
      '</div>';
    };
    // Ligne cliquable : libellé à gauche, valeur ou chevron à droite.
    var ligne = function(icone, libelle, droite, action, danger) {
      var col = danger ? UI.bad : UI.ink;
      return '<div ' + (action ? 'onclick="' + action + '" ' : '') + 'style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid ' + UI.line + ';' + (action ? 'cursor:pointer;' : '') + '">' +
        '<div style="width:32px;height:32px;border-radius:50%;background:' + UI.tile + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icone + '</div>' +
        '<div style="flex:1;min-width:0;font-size:15px;font-weight:500;color:' + col + ';">' + libelle + '</div>' +
        (droite ? '<div style="font-size:15px;color:' + UI.faint + ';flex-shrink:0;text-align:right;">' + droite + '</div>' : '') +
      '</div>';
    };
    var svg = function(d){ return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };

    // Ligne « Version » : même pattern que les autres (libellé 15px/500 à
    // gauche, valeur 14px faint à droite). APP_VERSION est défini par 08-bootstrap.
    var version = ligne(svg('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'), 'Version', safeHtml(String(window.APP_VERSION || 'v?')));

    var infos = ligne(svg('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'), 'Église', 'Vase d\'Honneur · Abidjan') +
      (uSecs.length ? ligne(svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'), 'Pôle', uSecs.map(function(s){ return secNom(s); }).join(' · ')) : '') +
      (freshU.phone ? ligne(svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'), 'Numéro', '<span style="font-family:' + UI.fontMono + ';">' + safeHtml(freshU.phone) + '</span>') : '') +
      ligne(svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>'), 'Conditions d\'utilisation', '›', 'ouvrirConditions()') +
      ligne(svg('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>'), 'Revoir la visite guidée', '›', 'App.closeSettings();ouvrirVisite()') +
      ligne(svg('<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'), 'Installer sur mon téléphone', '›', 'ouvrirAideInstallation()') +
      version;

    // Switch iOS (piste 51×31, knob 27) : la piste suit le thème via les
    // variables, le knob reste blanc dans les deux modes.
    var switchTheme =
      '<div onclick="App.toggleTheme()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid ' + UI.line + ';cursor:pointer;">' +
        '<div style="width:32px;height:32px;border-radius:50%;background:' + UI.tile + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>') + '</div>' +
        '<div style="flex:1;min-width:0;font-size:15px;font-weight:500;color:' + UI.ink + ';">Mode sombre</div>' +
        '<div aria-hidden="true" style="flex-shrink:0;width:51px;height:31px;border-radius:999px;background:' + (S.darkMode ? '#0B5FE0' : 'var(--line2)') + ';position:relative;transition:background 0.2s ease;">' +
          '<div style="position:absolute;top:2px;left:' + (S.darkMode ? '22px' : '2px') + ';width:27px;height:27px;border-radius:50%;background:#FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.25);transition:left 0.2s ease;"></div>' +
        '</div>' +
      '</div>';

    var apparence = switchTheme +
      ligne(svg('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'), 'Vider le cache', '›', 'App.viderCacheApp()') +
      '<div style="font-size:11px;color:' + UI.faint + ';padding:9px 16px 10px;line-height:1.4;">Utile si l\'app affiche une ancienne version.</div>';

    var admin = isAdmin
      ? ligne(svg('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'), 'Tableau de bord', '›', 'App.closeSettings();App.ouvrirTableauDeBord()') +
        ligne(svg('<path d="M3 6l4 3 5-6 5 6 4-3v12H3z"/>'), 'Gérer les rôles', '›', 'App.closeSettings();App.openRolesPanel()') +
        ligne(ico('pin', 16, UI.muted), 'Lieux enregistrés', (db(SK.LIEUX, []).length || '') + ' ›', 'App.closeSettings();App.ouvrirLieux()') +
        ligne(svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>'), 'Stockage', '›', 'App.closeSettings();App.openStorageStats()') +
        ligne(svg('<path d="M12 5v14M5 12h14"/>'), 'Quitter le rôle Admin', '›', 'App.revokeGrandResponsable()')
      : '';

    var compte = ligne(svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'), 'Modifier le profil', '›', 'App.closeSettings();App.openEditProfile()') +
      ligne('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + UI.bad + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>', 'Supprimer mon compte', '', 'App.closeSettings();App.openDeleteAccount()', true);

    return '<div class="safe-top" style="position:fixed;inset:0;z-index:10005;background:' + UI.page + ';display:flex;flex-direction:column;animation:fadeIn 0.2s ease-out;">' +
      enTetePleinEcran('Paramètres', 'App.closeSettings()') +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px 20px 40px;">' +
        section('Informations', infos) +
        section('Notifications', renderReglagesNotifications(freshU)) +
        section('Apparence', apparence) +
        (admin ? section('Administration', admin) : '') +
        section('Compte', compte) +
        '<button onclick="App.logout()" style="width:100%;background:var(--bad-soft);color:#D92D20;border:none;border-radius:999px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;">Se déconnecter</button>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // LIEUX ENREGISTRÉS (Admin) : retirer un lieu mal placé ou en double.
  // Les événements déjà créés gardent leur position.
  // ============================================================
  function renderLieuxPanel() {
    var lieux = db(SK.LIEUX, []).map(assainirLieu).filter(Boolean)
      .sort(function(a, b){ return b.utilisations - a.utilisations || a.nom.localeCompare(b.nom, 'fr'); });
    var admin = isGrandResponsable(S.user);
    return '<div class="safe-top" style="position:fixed;inset:0;z-index:10006;background:' + UI.page + ';display:flex;flex-direction:column;animation:fadeIn 0.2s ease-out;">' +
      enTetePleinEcran('Lieux enregistrés', 'App.fermerLieux()') +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 16px 40px;">' +
        '<div style="font-size:13px;color:var(--muted);line-height:1.45;margin:0 4px 12px;">Chaque lieu choisi pour un événement est enregistré ici et proposé à la saisie. Une position relevée sur place remplace celle d\'une recherche.</div>' +
        (lieux.length
          ? '<div style="background:var(--card);border-radius:20px;overflow:hidden;">' +
              lieux.map(function(l, i) {
                return '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;' + (i ? 'border-top:1px solid var(--line);' : '') + '">' +
                  '<span style="width:32px;height:32px;border-radius:16px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + ico(l.precision_m ? 'locate' : 'pin', 16, UI.lien) + '</span>' +
                  '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:15px;font-weight:700;color:var(--ink);overflow-wrap:anywhere;">' + safeHtml(l.nom) + '</div>' +
                    '<div style="font-size:12px;color:var(--muted);line-height:1.35;overflow-wrap:anywhere;">' + safeHtml(detailLieu(l)) + ' · ' + l.utilisations + ' utilisation' + (l.utilisations > 1 ? 's' : '') + '</div>' +
                  '</div>' +
                  '<a href="' + safeUrl('https://www.google.com/maps/search/?api=1&query=' + l.lat + ',' + l.lng) + '" target="_blank" rel="noopener noreferrer" aria-label="Voir ' + safeHtml(l.nom) + ' sur la carte" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--lien);">' + ico('globe', 18, 'currentColor') + '</a>' +
                  (admin ? '<button type="button" onclick="App.supprimerLieu(\'' + jsArg(l.id) + '\')" aria-label="Retirer ' + safeHtml(l.nom) + '" style="width:40px;height:40px;border:none;background:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;">' + ico('trash', 18, UI.bad) + '</button>' : '') +
                '</div>';
              }).join('') +
            '</div>'
          : '<div style="background:var(--card);border-radius:20px;padding:24px 16px;text-align:center;font-size:14px;color:var(--muted);line-height:1.45;">Aucun lieu enregistré pour l\'instant. Le prochain lieu choisi pour un événement apparaîtra ici.</div>') +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // TABLEAU DE BORD ADMIN (lot 3) : une vue d'ensemble, calculée à partir
  // des données déjà synchronisées.
  // ============================================================
  function donneesTableauDeBord(maintenant) {
    var now = maintenant || Date.now();
    var J = 864e5;
    var posts = db(SK.POSTS, []);
    var users = db(SK.USERS, []).filter(function(u){ return u && u.id && !compteEnAttente(u); });
    var nomDe = function(id) { var u = users.find(function(x){ return x.id === id; }); return u ? (u.prenom + ' ' + (u.nom || '')).trim() : 'Membre'; };

    var services = posts.filter(function(p) {
      if (p.type !== 'EVENT') return false;
      var t = eventStartTimestamp(p);
      return t && t >= now - 3 * 3600e3 && t <= now + 15 * J;
    }).sort(function(a, b){ return eventStartTimestamp(a) - eventStartTimestamp(b); }).map(function(ev) {
      var direct = (ev.assignments || []).filter(function(a){ return a && a.userId; });
      var conf = 0, decl = 0, att = [];
      direct.forEach(function(a) {
        var r = reponseConvocation(ev, a.userId);
        if (!r) att.push(a.userId); else if (r.statut === 'confirme') conf++; else decl++;
      });
      var presents = direct.length - decl;
      var besoin = Math.max(1, (ev.eventSections || []).length);
      return { ev: ev, debut: eventStartTimestamp(ev), convoques: direct.length, confirmes: conf, indisponibles: decl,
               enAttente: att, sousEffectif: presents < besoin };
    });

    var relances = [];
    services.forEach(function(s) {
      s.enAttente.forEach(function(uid){ relances.push({ ev: s.ev, uid: uid, nom: nomDe(uid) }); });
    });

    var depuis = now - 30 * J;
    var poles = SECTIONS.map(function(sec) {
      var membres = users.filter(function(u){ return getUserSections(u).indexOf(sec.id) !== -1; });
      var total = 0, aLheure = 0;
      membres.forEach(function(m) {
        var h = punctualityHistory(m.id, depuis, posts);
        total += h.count; aLheure += h.onTimeCount;
      });
      return { sec: sec, membres: membres.length, total: total, taux: total ? Math.round(aLheure / total * 100) : null };
    }).filter(function(p){ return p.membres > 0; });

    var inactifs = users.filter(function(u) {
      var vu = u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0;
      return !vu || vu < depuis;
    }).map(function(u) {
      return { u: u, vu: u.last_seen_at ? new Date(u.last_seen_at).getTime() : 0 };
    }).sort(function(a, b){ return a.vu - b.vu; });

    var tousServices = poles.reduce(function(n, p){ return n + p.total; }, 0);
    var tousALheure = poles.reduce(function(n, p){ return n + (p.taux === null ? 0 : Math.round(p.taux * p.total / 100)); }, 0);
    return {
      services: services, relances: relances, poles: poles, inactifs: inactifs,
      chiffres: {
        actifs: users.length - inactifs.length, membres: users.length,
        sousEffectif: services.filter(function(s){ return s.sousEffectif; }).length,
        relances: relances.length,
        taux: tousServices ? Math.round(tousALheure / tousServices * 100) : null,
        mesures: tousServices
      }
    };
  }

  function renderTableauDeBord() {
    var d = donneesTableauDeBord();
    var carte = function(titre, contenu, compte) {
      return '<section style="background:' + UI.card + ';border-radius:20px;padding:14px 16px;margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">' +
          '<h2 style="font-family:' + UI.fontDisplay + ';font-size:17px;font-weight:700;color:' + UI.ink + ';margin:0;">' + titre + '</h2>' +
          (compte !== undefined ? '<span style="font-size:12px;font-weight:700;color:' + UI.faint + ';">' + compte + '</span>' : '') +
        '</div>' + contenu + '</section>';
    };
    var vide = function(t){ return '<div style="font-size:13px;color:' + UI.faint + ';padding:6px 0;">' + t + '</div>'; };
    // Tuiles : pleines et colorées quand elles signalent un problème.
    var chiffre = function(v, l, alerte) {
      return '<div style="flex:1;min-width:0;background:' + (alerte ? alerte : UI.card) + ';color:' + (alerte ? '#FFF' : UI.ink) + ';border-radius:20px;padding:14px;">' +
        '<div style="font-size:28px;font-weight:800;line-height:1.1;">' + v + '</div>' +
        '<div style="font-size:12px;font-weight:700;margin-top:2px;line-height:1.3;' + (alerte ? '' : 'color:' + UI.muted + ';') + '">' + l + '</div>' +
      '</div>';
    };

    var c = d.chiffres;
    var tuiles = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
      chiffre(c.sousEffectif, 'service' + (c.sousEffectif > 1 ? 's' : '') + ' en sous-effectif (15 j)', c.sousEffectif > 0 ? '#B42318' : null) +
      chiffre(c.relances, 'réponse' + (c.relances > 1 ? 's' : '') + ' attendue' + (c.relances > 1 ? 's' : ''), c.relances > 0 ? '#C2410C' : null) +
      (c.mesures < 3
        ? chiffre('—', 'à l\'heure sur 30 jours · trop peu de services', null)
        : chiffre(c.taux + ' %', 'à l\'heure sur 30 jours', c.taux < 70 ? '#B42318' : null)) +
      chiffre(c.actifs + '/' + c.membres, 'membres actifs ce mois-ci', null) +
    '</div>';

    var services = d.services.map(function(s) {
      var date = new Date(s.debut).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      return '<div onclick="App.fermerTableauDeBord();App.goToPost(\'' + jsArg(s.ev.id) + '\')" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid ' + UI.tile + ';cursor:pointer;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:' + UI.ink + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(s.ev.eventTitle || 'Événement') + '</div>' +
          '<div style="font-size:12px;color:' + UI.faint + ';">' + date + ' · ' + [s.convoques + ' convoqué' + (s.convoques > 1 ? 's' : '')]
            .concat(s.confirmes ? [s.confirmes + ' confirmé' + (s.confirmes > 1 ? 's' : '')] : [])
            .concat(s.enAttente.length ? [s.enAttente.length + ' sans réponse'] : [])
            .concat(s.indisponibles ? [s.indisponibles + ' indisponible' + (s.indisponibles > 1 ? 's' : '')] : []).join(' · ') + '</div>' +
        '</div>' +
        (s.sousEffectif ? '<span style="font-size:11px;font-weight:800;padding:3px 8px;border-radius:8px;background:var(--bad-soft);color:var(--bad-ink);white-space:nowrap;">Sous-effectif</span>' : '<span style="font-size:11px;font-weight:800;padding:3px 8px;border-radius:8px;background:var(--ok-soft);color:var(--ok-ink);">OK</span>') +
      '</div>';
    }).join('');

    var relances = d.relances.slice(0, 20).map(function(r) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid ' + UI.tile + ';">' +
        '<div style="flex:1;min-width:0;font-size:13px;color:' + UI.ink + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><b>' + safeHtml(r.nom) + '</b> · ' + safeHtml(r.ev.eventTitle || 'Événement') + '</div>' +
        '<button type="button" onclick="App.relancerConvocation(\'' + jsArg(r.ev.id) + '\',\'' + jsArg(r.uid) + '\')" style="min-height:36px;padding:0 12px;border:none;border-radius:999px;background:' + UI.tile + ';color:' + UI.ink + ';font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;">Relancer</button>' +
      '</div>';
    }).join('');

    var poles = d.poles.map(function(p) {
      var col = p.taux === null ? UI.line : p.taux >= 80 ? UI.ok : p.taux >= 60 ? UI.warn : UI.bad;
      return '<div style="padding:8px 0;border-top:1px solid ' + UI.tile + ';">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:' + UI.ink + ';margin-bottom:5px;">' +
          '<span style="display:inline-flex;align-items:center;gap:6px;">' + icoPole(p.sec.id, 15) + safeHtml(p.sec.nom) + '</span>' +
          '<span style="color:' + (p.taux === null ? UI.faint : UI.ink) + ';">' + (p.taux === null ? 'aucun service' : p.taux + ' % · ' + p.total + ' service' + (p.total > 1 ? 's' : '')) + '</span>' +
        '</div>' +
        '<div style="height:8px;background:' + UI.tile + ';border-radius:4px;overflow:hidden;"><div class="kc-progression" style="height:100%;width:' + (p.taux || 0) + '%;background:' + col + ';border-radius:4px;"></div></div>' +
      '</div>';
    }).join('');

    var inactifs = d.inactifs.slice(0, 30).map(function(x) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid ' + UI.tile + ';">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:' + UI.ink + ';">' + safeHtml(((x.u.prenom || '') + ' ' + (x.u.nom || '')).trim() || 'Membre') + '</div>' +
          '<div style="font-size:12px;color:' + UI.faint + ';">' + (x.vu ? 'Vu le ' + new Date(x.vu).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Jamais vu') + '</div>' +
        '</div>' +
        '<button type="button" onclick="App.fermerTableauDeBord();App.openDirectMessage(\'' + jsArg(x.u.id) + '\')" style="min-height:36px;padding:0 12px;border:none;border-radius:999px;background:' + UI.tile + ';color:' + UI.ink + ';font-size:13px;font-weight:700;cursor:pointer;">Message</button>' +
      '</div>';
    }).join('');

    return '<div id="tableauDeBord" class="safe-top" style="position:fixed;inset:0;z-index:9500;background:' + UI.page + ';display:flex;flex-direction:column;animation:fadeIn 0.2s ease-out;">' +
      enTetePleinEcran('Tableau de bord', 'App.fermerTableauDeBord()') +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 16px 40px;">' +
        tuiles +
        carte('Services des 15 prochains jours', services || vide('Aucun service prévu.'), d.services.length) +
        carte('Convocations sans réponse', relances || vide('Tout le monde a répondu.'), d.relances.length) +
        carte('Ponctualité par pôle · 30 jours', poles || vide('Pas encore de service.')) +
        carte('Membres inactifs depuis un mois', inactifs || vide('Tout le monde est passé ce mois-ci.'), d.inactifs.length) +
      '</div>' +
    '</div>';
  }

  // Interrupteur façon iOS, réutilisé par les réglages de notifications.
  function interrupteur(actif, action, libelle, desc, fige) {
    return '<div ' + (fige ? '' : 'onclick="' + action + '" ') + 'role="switch" aria-checked="' + (actif ? 'true' : 'false') + '" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid ' + UI.line + ';' + (fige ? '' : 'cursor:pointer;') + '">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:15px;font-weight:500;color:' + UI.ink + ';">' + libelle + '</div>' +
        (desc ? '<div style="font-size:12px;color:' + UI.faint + ';margin-top:2px;">' + desc + '</div>' : '') +
      '</div>' +
      '<div aria-hidden="true" style="flex-shrink:0;width:51px;height:31px;border-radius:999px;background:' + (actif ? '#0B5FE0' : 'var(--line2)') + ';position:relative;transition:background 0.2s ease;' + (fige ? 'opacity:0.6;' : '') + '">' +
        '<div style="position:absolute;top:2px;left:' + (actif ? '22px' : '2px') + ';width:27px;height:27px;border-radius:50%;background:#FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.25);transition:left 0.2s ease;"></div>' +
      '</div>' +
    '</div>';
  }

  // Paramètres > Notifications : activation sur CE téléphone, puis un
  // interrupteur par type (valables pour tous les appareils du membre).
  function renderReglagesNotifications(u) {
    var etat = S.pushEtat || 'inconnu';
    var haut;
    if (!pushDisponible()) {
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
      haut = '<div style="padding:14px 16px;border-bottom:1px solid ' + UI.line + ';font-size:13px;line-height:1.5;color:' + UI.muted + ';">' +
        (ios ? 'Sur iPhone, installe d\'abord Commit sur l\'écran d\'accueil (iOS 16.4 ou plus récent), puis ouvre-le depuis son icône pour activer les notifications. <span onclick="ouvrirAideInstallation()" style="color:' + UI.lien + ';font-weight:700;cursor:pointer;">Comment faire</span>'
             : 'Ce navigateur ne peut pas recevoir de notifications.') +
      '</div>';
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      haut = '<div style="padding:14px 16px;border-bottom:1px solid ' + UI.line + ';font-size:13px;line-height:1.5;color:' + UI.muted + ';">Les notifications sont bloquées pour Commit dans les réglages du téléphone. Autorise-les puis reviens ici.</div>';
    } else {
      haut = interrupteur(etat === 'actif', etat === 'actif' ? 'App.desactiverPush()' : 'App.activerPush()',
        'Sur ce téléphone', etat === 'encours' ? 'Activation…' : (etat === 'actif' ? 'Tu recevras convocations et rappels même app fermée.' : 'Recevoir convocations, rappels et messages même app fermée.'),
        etat === 'encours');
    }
    return haut +
      interrupteur(true, '', 'Convocations', 'Toujours envoyées', true) +
      PREFS_NOTIF.map(function(p) {
        return interrupteur(prefNotifActive(u, p.id), 'App.basculerPrefNotif(\'' + p.id + '\')', p.libelle, p.desc);
      }).join('');
  }

  function renderPostOptionsModal(post) {
    if (!post) return '';
    var isMine = S.user && S.user.id === post.userId;
    return '<div onclick="App.closePostOptions()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:20px;border-top-right-radius:20px;padding:16px;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 20px;"></div>' +
        (isMine ? '<button onclick="App.deletePost(\''+jsArg(post.id)+'\')" style="width:100%;padding:14px;color:#D92D20;font-size:15px;font-weight:600;background:var(--tile);border:none;border-radius:999px;margin-bottom:8px;cursor:pointer;">Supprimer le post</button>' : '') +
        '<button onclick="App.viewPost(\''+jsArg(post.id)+'\')" style="width:100%;padding:14px;color:var(--ink);font-size:15px;font-weight:600;background:var(--tile);border:none;border-radius:999px;margin-bottom:8px;cursor:pointer;">Voir le post</button>' +
        '<button onclick="App.closePostOptions()" style="width:100%;padding:14px;color:var(--ink);font-size:15px;font-weight:600;background:var(--tile);border:none;border-radius:999px;cursor:pointer;">Annuler</button>' +
      '</div>' +
    '</div>';
  }



  // ============================================================
  // CONDITIONS D'UTILISATION
  // Consultables à tout moment depuis Paramètres et le bas de son profil, et
  // depuis l'écran d'inscription (avant même d'avoir un compte) : la fenêtre
  // est donc injectée directement dans la page, comme le toast, sans dépendre
  // de render() ni de l'écran affiché.
  // Toute modification du texte doit faire avancer CONDITIONS_VERSION.
  // ============================================================
  var CONDITIONS_VERSION = '21 octobre 2026';
  var CONDITIONS_SECTIONS = [
    ['Objet',
     '<p>Commit VH est l\'application interne du Département Communication de l\'Église Vase d\'Honneur (Abidjan). Elle sert à organiser les services (planning, convocations, pointage), à partager le travail de l\'équipe et à suivre l\'engagement de chacun.</p>' +
     '<p>Leur acceptation est demandée à la création du compte ; en utilisant l\'application, vous vous engagez à les respecter.</p>'],
    ['Accès et compte',
     '<ul><li>L\'application est réservée aux membres du département et aux personnes qu\'il accueille (stagiaires).</li>' +
     '<li>Un seul compte par personne, à votre vrai nom. Votre numéro de téléphone sert d\'identifiant de connexion.</li>' +
     '<li>Votre mot de passe et vos réponses aux questions de sécurité sont personnels : ne les communiquez à personne, pas même à un responsable.</li>' +
     '<li>Vous êtes responsable de ce qui est publié depuis votre compte. En cas de doute (téléphone perdu, compte utilisé par un autre), prévenez un Admin.</li></ul>'],
    ['Rôles',
     '<ul><li><b>Stagiaire</b> et <b>Membre</b> : consultent le planning, pointent leurs services, publient et commentent.</li>' +
     '<li><b>Responsable de pôle</b> : crée des événements et convoque les membres.</li>' +
     '<li><b>Admin</b> : publie les bilans, attribue les rôles et modère les contenus.</li></ul>' +
     '<p>Les rôles sont attribués par un Admin ; ils ne se demandent pas dans l\'application.</p>'],
    ['Règles de publication',
     '<ul><li>Restez respectueux : pas d\'insultes, de moqueries, de propos discriminants ou contraires aux valeurs de l\'église.</li>' +
     '<li><b>Droit à l\'image</b> : ne publiez la photo ou la vidéo d\'une personne reconnaissable qu\'avec son accord. Pour un mineur, l\'accord d\'un parent est nécessaire.</li>' +
     '<li>Les informations internes (plannings, bilans, échanges) restent internes : ne les diffusez pas hors de l\'application sans l\'accord d\'un responsable.</li>' +
     '<li>Le lien « Copier le lien » d\'une publication montre son auteur, sa légende et une image à toute personne qui l\'ouvre : ne le partagez qu\'à bon escient.</li></ul>'],
    ['Pointage et localisation',
     '<ul><li>Votre position n\'est demandée qu\'au moment où vous pointez votre arrivée à un service. Elle n\'est jamais suivie en continu.</li>' +
     '<li>Elle sert uniquement à vérifier que vous êtes sur place (dans un rayon de 500 m du lieu). La distance au lieu est visible des autres membres.</li>' +
     '<li>L\'heure d\'arrivée est contrôlée par le serveur et ne peut plus être modifiée ensuite.</li>' +
     '<li>Pointer à distance, ou refuser la localisation, compte comme une absence.</li></ul>'],
    ['Notes et engagement',
     '<p>La note se calcule par cycle de 15 jours (du 1er au 15, du 16 à la fin du mois), sur 30 points :</p>' +
     '<ul><li>Service : de +5 (à l\'heure) à −2 (retard de plus d\'1 h 30, absence ou pointage hors du lieu).</li>' +
     '<li>Tâche à livrer : +5 à temps, +2 en retard, −2 si elle n\'est jamais livrée.</li>' +
     '<li>Les bilans de pôle sont publiés par l\'Admin après les services.</li></ul>' +
     '<p>Ces notes servent à encourager et à organiser l\'équipe, pas à juger les personnes.</p>'],
    ['Messages privés',
     '<p>Un message privé n\'est lisible que par vous et votre interlocuteur. Les règles de publication s\'y appliquent aussi.</p>'],
    ['Vos données',
     '<ul><li>Sont enregistrés : vos nom, prénom, numéro de téléphone, pôles, photo, bio, vos publications, commentaires, messages, pointages (heure et distance au lieu) et notes.</li>' +
     '<li>Les membres connectés voient votre fiche, vos publications et vos notes. Sans compte, on ne peut rien consulter, sauf l\'aperçu d\'un lien partagé.</li>' +
     '<li>Les photos et vidéos sont stockées à une adresse longue et impossible à deviner, mais toute personne qui obtient cette adresse peut les voir.</li>' +
     '<li>Les données sont hébergées par Supabase (serveurs en Irlande, Union européenne) et l\'application par Vercel. Elles ne sont ni vendues ni utilisées à des fins publicitaires.</li>' +
     '<li>Vous pouvez modifier votre fiche à tout moment, et supprimer définitivement votre compte depuis Paramètres → Supprimer mon compte.</li></ul>'],
    ['Modération',
     '<p>L\'auteur d\'une publication et l\'Admin peuvent supprimer les commentaires qui y sont faits. L\'Admin peut retirer tout contenu contraire à ces règles. En cas de manquement répété, les Admin peuvent retirer l\'accès à l\'application, après en avoir parlé avec la personne.</p>'],
    ['Évolution des conditions',
     '<p>Ces conditions peuvent évoluer. La date de la version en vigueur figure en haut de cette page ; les changements importants sont annoncés dans l\'application.</p>' +
     '<p>Pour toute question : <b>07 99 44 24 02</b> (Département Communication).</p>']
  ];

  function ouvrirConditions() {
    if (document.getElementById('_kcConditions')) return;
    var fond = document.createElement('div');
    fond.id = '_kcConditions';
    fond.setAttribute('role', 'dialog');
    fond.setAttribute('aria-modal', 'true');
    fond.setAttribute('aria-label', 'Conditions d\'utilisation');
    fond.className = 'safe-top';
    fond.style.cssText = 'position:fixed;inset:0;z-index:9999990;background:var(--page,#F5F6F8);color:var(--ink,#0C1116);display:flex;flex-direction:column;animation:slideUp 0.28s cubic-bezier(0.22,1,0.36,1);font-family:var(--font-body,sans-serif);';
    var sommaire = CONDITIONS_SECTIONS.map(function(s, i) {
      return '<section style="background:var(--card,#FFF);border:1px solid var(--line,#E4E7EC);border-radius:12px;padding:16px;margin-bottom:12px;">' +
        '<h2 style="font-family:var(--font-display,sans-serif);font-size:17px;font-weight:700;margin:0 0 8px;">' + (i + 1) + '. ' + s[0] + '</h2>' +
        '<div class="kc-conditions" style="font-size:15px;line-height:1.55;color:var(--ink2,#2A313B);">' + s[1] + '</div>' +
      '</section>';
    }).join('');
    fond.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--card,#FFF);border-bottom:1px solid var(--line,#E4E7EC);">' +
        '<button type="button" data-fermer aria-label="Fermer" style="background:var(--tile,#EFF1F5);border:none;width:44px;height:44px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<div style="min-width:0;">' +
          '<h1 style="font-family:var(--font-display,sans-serif);font-size:22px;font-weight:700;margin:0;">Conditions d\'utilisation</h1>' +
          '<div style="font-size:13px;color:var(--faint,#8A93A0);margin-top:2px;">Version du ' + CONDITIONS_VERSION + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 16px 40px;">' + sommaire + '</div>';
    document.body.appendChild(fond);
    // Coche « Lire les conditions » de Bien démarrer (version lue retenue).
    if (S.user && S.auth === 'app' && S.user.conditionsLues !== CONDITIONS_VERSION && window.App && App._majMonProfil) {
      App._majMonProfil({ conditionsLues: CONDITIONS_VERSION });
    }
    var fermer = function() {
      fond.remove();
      document.removeEventListener('keydown', echap);
    };
    var echap = function(ev) { if (ev.key === 'Escape') fermer(); };
    document.addEventListener('keydown', echap);
    fond.querySelector('[data-fermer]').onclick = fermer;
    // Le focus passe dans la fenêtre (lecteurs d'écran, touche Échap) sans
    // dessiner de cadre autour du bouton retour.
    fond.tabIndex = -1;
    fond.style.outline = 'none';
    try { fond.focus(); } catch(e) {}
  }

  // ============================================================
  // VISITE GUIDÉE
  // Quatre écrans au premier lancement, rejouables depuis Paramètres. Fenêtre
  // injectée dans la page (comme les conditions), indépendante de render().
  // ============================================================
  var VISITE_ECRANS = [
    { couleur: '#0B5FE0', titre: 'Bienvenue sur Commit',
      texte: 'L\'application du Département Communication : le planning des services, tes convocations, le pointage et la vie de l\'équipe, au même endroit.',
      icone: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    { couleur: '#0E9F6E', titre: 'Ta mission en un coup d\'œil',
      texte: 'Quand un responsable te convoque, ta mission apparaît en haut de l\'Accueil avec ta tâche, l\'heure et l\'itinéraire. Tout le calendrier est dans l\'onglet Planning.',
      icone: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/>' },
    { couleur: '#D98A0B', titre: 'Pointe ton arrivée',
      texte: 'Le bouton « Je suis arrivé » s\'ouvre 3 h avant le début. Ta position est vérifiée dans un rayon de 500 m autour du lieu. Arriver à l\'heure rapporte +5.',
      icone: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
    { couleur: '#AF52DE', titre: 'Suis ta note',
      texte: 'Tous les 15 jours, tes services et tes tâches s\'additionnent sur 30 points. Ta jauge est dans ton Profil, les bilans des pôles dans l\'onglet Bilans.',
      icone: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="5.5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="15.5" y="9" width="3" height="8" rx="1"/>' }
  ];

  // Fenêtre plein écran commune à la visite et à l'aide d'installation.
  function fenetreInjectee(id, label) {
    var fond = document.createElement('div');
    fond.id = id;
    fond.setAttribute('role', 'dialog');
    fond.setAttribute('aria-modal', 'true');
    fond.setAttribute('aria-label', label);
    fond.className = 'safe-top';
    fond.tabIndex = -1;
    fond.style.cssText = 'position:fixed;inset:0;z-index:9999990;background:var(--page,#F5F6F8);color:var(--ink,#0C1116);display:flex;flex-direction:column;outline:none;font-family:var(--font-body,sans-serif);animation:fadeIn 0.25s ease-out;';
    return fond;
  }

  function ouvrirVisite() {
    if (document.getElementById('_kcVisite')) return;
    var fond = fenetreInjectee('_kcVisite', 'Visite guidée');
    var n = VISITE_ECRANS.length;
    fond.innerHTML =
      '<div style="display:flex;justify-content:flex-end;padding:8px 12px;">' +
        '<button type="button" data-passer style="background:none;border:none;min-height:44px;padding:0 12px;font-size:15px;font-weight:600;color:var(--muted,#5B6572);cursor:pointer;">Passer</button>' +
      '</div>' +
      '<div data-piste style="flex:1;display:flex;overflow:hidden;">' +
        '<div data-rail class="kc-rail" style="display:flex;flex-shrink:0;width:' + (n * 100) + '%;height:100%;">' +
          VISITE_ECRANS.map(function(e, i) {
            return '<div aria-hidden="' + (i ? 'true' : 'false') + '" style="width:' + (100 / n) + '%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 32px;text-align:center;box-sizing:border-box;">' +
              '<div class="kc-visite-icone" style="width:112px;height:112px;border-radius:36px;background:' + e.couleur + '1F;display:flex;align-items:center;justify-content:center;margin-bottom:28px;">' +
                '<svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="' + e.couleur + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + e.icone + '</svg>' +
              '</div>' +
              '<h2 style="font-family:var(--font-display,sans-serif);font-size:28px;font-weight:800;letter-spacing:-0.5px;margin:0 0 12px;">' + e.titre + '</h2>' +
              '<p style="font-size:15px;line-height:1.55;color:var(--muted,#5B6572);max-width:22rem;margin:0;">' + e.texte + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div style="padding:16px 24px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:18px;">' +
        '<div data-points style="display:flex;gap:8px;">' +
          VISITE_ECRANS.map(function(e, i){ return '<span style="height:8px;width:' + (i ? 8 : 24) + 'px;border-radius:4px;background:' + (i ? 'var(--line2,#D6DBE3)' : 'var(--accent,#0B5FE0)') + ';transition:width 0.25s,background 0.25s;"></span>'; }).join('') +
        '</div>' +
        '<button type="button" data-suivant style="width:100%;max-width:360px;min-height:52px;background:#0B5FE0;color:#FFF;border:none;border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;">Suivant</button>' +
      '</div>';
    document.body.appendChild(fond);
    try { fond.focus(); } catch(e) {}

    var rail = fond.querySelector('[data-rail]');
    var points = fond.querySelectorAll('[data-points] span');
    var pages = rail.children;
    var bouton = fond.querySelector('[data-suivant]');
    var courant = 0;
    var aller = function(i) {
      courant = Math.max(0, Math.min(n - 1, i));
      rail.style.transform = 'translateX(' + (-courant * 100 / n) + '%)';
      for (var k = 0; k < n; k++) {
        points[k].style.width = k === courant ? '24px' : '8px';
        points[k].style.background = k === courant ? 'var(--accent,#0B5FE0)' : 'var(--line2,#D6DBE3)';
        pages[k].setAttribute('aria-hidden', k === courant ? 'false' : 'true');
      }
      bouton.textContent = courant === n - 1 ? 'C\'est parti' : 'Suivant';
    };
    var terminer = function() {
      fond.remove();
      document.removeEventListener('keydown', clavier);
      if (S.user && !S.user.visiteVue && window.App && App._majMonProfil) App._majMonProfil({ visiteVue: true });
    };
    var clavier = function(ev) {
      if (ev.key === 'Escape') terminer();
      else if (ev.key === 'ArrowRight') aller(courant + 1);
      else if (ev.key === 'ArrowLeft') aller(courant - 1);
    };
    document.addEventListener('keydown', clavier);
    bouton.onclick = function() { if (courant === n - 1) terminer(); else aller(courant + 1); };
    fond.querySelector('[data-passer]').onclick = terminer;
    // Glisser du doigt pour changer d'écran.
    var x0 = null;
    var piste = fond.querySelector('[data-piste]');
    piste.addEventListener('touchstart', function(ev){ x0 = ev.touches[0].clientX; }, { passive: true });
    piste.addEventListener('touchend', function(ev){
      if (x0 === null) return;
      var dx = ev.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) aller(courant + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });
  }

  // Au premier lancement (fiche sans « visiteVue »), une fois la fiche
  // synchronisée : sans ce délai, un membre qui l'a déjà vue sur un autre
  // téléphone la reverrait avant que sa fiche n'arrive du serveur.
  function proposerVisiteSiNouvelle() {
    setTimeout(function() {
      try {
        if (!S.user || S.auth !== 'app') return;
        var fiche = db(SK.USERS, []).find(function(x){ return x && x.id === S.user.id; }) || S.user;
        if (!fiche.visiteVue && !S.user.visiteVue) ouvrirVisite();
      } catch(e) {}
    }, 2500);
  }

  // ============================================================
  // AIDE À L'INSTALLATION (écran d'accueil du téléphone)
  // ============================================================
  function ouvrirAideInstallation() {
    if (document.getElementById('_kcInstallation')) return;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    var fond = fenetreInjectee('_kcInstallation', 'Installer Commit');
    var etape = function(n, texte) {
      return '<li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;">' +
        '<span style="width:28px;height:28px;border-radius:50%;background:var(--accent-soft,#E8EEFB);color:var(--accent-ink,#0B4FC4);font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + n + '</span>' +
        '<span style="font-size:15px;line-height:1.5;padding-top:3px;">' + texte + '</span></li>';
    };
    fond.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--card,#FFF);border-bottom:1px solid var(--line,#E4E7EC);">' +
        '<button type="button" data-fermer aria-label="Fermer" style="background:var(--tile,#EFF1F5);border:none;width:44px;height:44px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:inherit;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<h1 style="font-family:var(--font-display,sans-serif);font-size:22px;font-weight:700;margin:0;">Installer Commit</h1>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;padding:20px 20px 40px;">' +
        '<p style="font-size:15px;line-height:1.55;color:var(--muted,#5B6572);margin:0 0 18px;">Installée sur l\'écran d\'accueil, l\'application s\'ouvre comme une vraie app, en plein écran, et pourra bientôt t\'envoyer tes convocations et rappels.</p>' +
        '<h2 style="font-size:15px;font-weight:700;margin:0 0 12px;">' + (ios ? 'Sur iPhone (Safari)' : 'Sur Android (Chrome)') + '</h2>' +
        '<ol style="list-style:none;padding:0;margin:0;">' +
          (ios
            ? etape(1, 'Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut), en bas de Safari.') +
              etape(2, 'Fais défiler et choisis <b>Sur l\'écran d\'accueil</b>.') +
              etape(3, 'Touche <b>Ajouter</b> : l\'icône Commit apparaît avec tes autres applications.')
            : etape(1, 'Touche le menu <b>⋮</b> en haut à droite de Chrome.') +
              etape(2, 'Choisis <b>Installer l\'application</b> (ou <b>Ajouter à l\'écran d\'accueil</b>).') +
              etape(3, 'Confirme : l\'icône Commit apparaît avec tes autres applications.')) +
        '</ol>' +
        '<p style="font-size:13px;color:var(--faint,#8A93A0);margin:8px 0 0;">' + (ios ? 'Sur Android : menu ⋮ de Chrome, puis « Installer l\'application ».' : 'Sur iPhone : bouton Partager de Safari, puis « Sur l\'écran d\'accueil ».') + '</p>' +
      '</div>';
    document.body.appendChild(fond);
    try { fond.focus(); } catch(e) {}
    // Consulter l'aide suffit à cocher l'étape : l'app ne peut pas savoir si
    // elle a été installée tant qu'on l'utilise depuis le navigateur.
    if (S.user && !S.user.installationVue && window.App && App._majMonProfil) App._majMonProfil({ installationVue: true });
    var fermer = function() { fond.remove(); document.removeEventListener('keydown', echap); };
    var echap = function(ev) { if (ev.key === 'Escape') fermer(); };
    document.addEventListener('keydown', echap);
    fond.querySelector('[data-fermer]').onclick = fermer;
  }

  // ============================================================
  // MES INDISPONIBILITÉS (lot 2)
  // Les dates où le membre sait qu'il sera absent, enregistrées sur sa fiche.
  // Les responsables les voient au moment de convoquer.
  // ============================================================
  function renderIndisposModal() {
    var moi = db(SK.USERS, []).find(function(x){ return S.user && x.id === S.user.id; }) || S.user || {};
    var auj = isoLocal();
    var liste = (moi.indisponibilites || []).filter(function(x){ return x && x.date >= auj; })
      .sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    return '<div onclick="App.fermerIndispos()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Mes indisponibilités" style="width:100%;max-width:460px;max-height:85vh;overflow-y:auto;background:var(--card);border-radius:20px 20px 0 0;padding:16px 20px calc(24px + env(safe-area-inset-bottom));animation:slideUp 0.28s cubic-bezier(0.22,1,0.36,1);">' +
        '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 16px;"></div>' +
        '<h2 style="font-family:' + UI.fontDisplay + ';font-size:22px;font-weight:700;color:var(--ink);margin:0 0 4px;">Mes indisponibilités</h2>' +
        '<p style="font-size:13px;color:var(--muted);line-height:1.5;margin:0 0 14px;">Les responsables les voient quand ils convoquent l\'équipe.</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px;background:var(--tile);border-radius:16px;padding:12px;">' +
          '<label for="indispoDate" style="font-size:13px;font-weight:700;color:var(--ink);">Date</label>' +
          '<input id="indispoDate" type="date" min="' + auj + '" class="kc-champ" style="' + styleChamp() + '">' +
          '<label for="indispoMotif" style="font-size:13px;font-weight:700;color:var(--ink);">Motif <span style="font-weight:500;color:var(--faint);">(facultatif)</span></label>' +
          '<input id="indispoMotif" type="text" maxlength="80" placeholder="Ex. voyage, examen" class="kc-champ" style="' + styleChamp() + '">' +
          '<button type="button" onclick="App.ajouterIndispo()" style="min-height:44px;background:#0B5FE0;color:#FFF;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;margin-top:4px;">Ajouter cette date</button>' +
        '</div>' +
        '<div style="margin-top:14px;">' +
          (liste.length
            ? liste.map(function(x) {
                var d = new Date(x.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                return '<div class="kc-apparait" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);">' +
                  '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:15px;font-weight:700;color:var(--ink);">' + safeHtml(d.charAt(0).toUpperCase() + d.slice(1)) + '</div>' +
                    (x.motif ? '<div style="font-size:13px;color:var(--muted);">' + safeHtml(x.motif) + '</div>' : '') +
                  '</div>' +
                  '<button type="button" onclick="App.retirerIndispo(\'' + jsArg(x.date) + '\')" aria-label="Retirer cette date" style="width:44px;height:44px;flex-shrink:0;background:none;border:none;border-radius:50%;color:var(--bad-ink);font-size:22px;cursor:pointer;">×</button>' +
                '</div>';
              }).join('')
            : '<p style="font-size:13px;color:var(--faint);text-align:center;margin:10px 0 0;">Aucune date à venir.</p>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // POINTAGE : ALERTE HORS ZONE ET CONFIRMATION ANIMÉE (lot 2)
  // ============================================================
  function fermerAlerteHorsZone() {
    var el = document.getElementById('_kcHorsZone');
    if (el) el.remove();
  }

  function ouvrirAlerteHorsZone() {
    fermerAlerteHorsZone();
    var h = S.pointageHorsZone;
    if (!h) return;
    var fond = document.createElement('div');
    fond.id = '_kcHorsZone';
    fond.setAttribute('role', 'alertdialog');
    fond.setAttribute('aria-modal', 'true');
    fond.style.cssText = 'position:fixed;inset:0;z-index:9999995;background:rgba(15,15,20,0.6);display:flex;align-items:flex-end;justify-content:center;';
    fond.innerHTML =
      '<div class="kc-apparait" style="width:100%;max-width:460px;background:var(--card,#FFF);color:var(--ink,#0C1116);border-radius:20px 20px 0 0;padding:20px 20px calc(24px + env(safe-area-inset-bottom));font-family:var(--font-body,sans-serif);">' +
        '<h2 style="font-family:var(--font-display,sans-serif);font-size:22px;font-weight:700;margin:0 0 6px;">Tu sembles loin du lieu</h2>' +
        '<p style="font-size:15px;line-height:1.5;color:var(--muted,#5B6572);margin:0 0 16px;">Ta position est à <b>' + formatDistance(h.distance || 0) + '</b> du lieu (il faut être à moins de ' + formatDistance(ON_SITE_RADIUS_M) + '). Un pointage hors zone compte comme une absence. Rapproche-toi et réessaie.</p>' +
        '<button type="button" data-reessayer style="width:100%;min-height:48px;background:#0B5FE0;color:#FFF;border:none;border-radius:999px;font-size:15px;font-weight:800;cursor:pointer;">Réessayer</button>' +
        '<button type="button" data-forcer style="width:100%;min-height:44px;margin-top:8px;background:none;border:none;font-size:15px;font-weight:700;color:var(--bad-ink,#B42318);cursor:pointer;">Pointer quand même</button>' +
      '</div>';
    document.body.appendChild(fond);
    // Réessayer : nouvelle position, mais la même heure d'arrivée (celle du premier appui).
    fond.querySelector('[data-reessayer]').onclick = function() { var x = S.pointageHorsZone; S.pointageHorsZone = null; App.pointerEnUnGeste(x.eventId, x.stamp, false); };
    fond.querySelector('[data-forcer]').onclick = function() { var x = S.pointageHorsZone; App.pointerEnUnGeste(x.eventId, x.stamp, true); };
    fond.onclick = function(ev) { if (ev.target === fond) { S.pointageHorsZone = null; fermerAlerteHorsZone(); } };
  }

  // Coche qui se dessine et points qui montent, puis disparaissent seuls.
  function celebrerPointage(points, detail) {
    try { if (navigator.vibrate) navigator.vibrate(points > 0 ? [30, 40, 30] : 60); } catch(e) {}
    var ancien = document.getElementById('_kcPointage');
    if (ancien) ancien.remove();
    var positif = points > 0;
    var el = document.createElement('div');
    el.id = '_kcPointage';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;inset:0;z-index:9999996;display:flex;align-items:center;justify-content:center;pointer-events:none;';
    el.innerHTML =
      '<div class="kc-pointage-carte" style="background:var(--card,#FFF);color:var(--ink,#0C1116);border-radius:20px;padding:24px 28px;box-shadow:0 20px 60px rgba(0,0,0,0.25);text-align:center;min-width:240px;max-width:86vw;font-family:var(--font-body,sans-serif);">' +
        '<svg width="72" height="72" viewBox="0 0 52 52" style="display:block;margin:0 auto 10px;">' +
          '<circle cx="26" cy="26" r="24" fill="' + (positif ? '#0E9F6E' : '#D92D20') + '"/>' +
          (positif
            ? '<path class="kc-coche" d="M15 27l7 7 15-16" fill="none" stroke="#FFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
            : '<path class="kc-coche" d="M18 18l16 16M34 18L18 34" fill="none" stroke="#FFF" stroke-width="4.5" stroke-linecap="round"/>') +
        '</svg>' +
        '<div style="font-size:17px;font-weight:800;">Arrivée enregistrée</div>' +
        '<div class="kc-points" style="font-family:var(--font-mono,monospace);font-size:28px;font-weight:700;color:' + (positif ? '#0E9F6E' : '#D92D20') + ';margin:4px 0;">' + (points > 0 ? '+' : '') + points + '★</div>' +
        '<div style="font-size:13px;color:var(--muted,#5B6572);">' + safeHtml(detail || '') + '</div>' +
      '</div>';
    document.body.appendChild(el);
    setTimeout(function(){ el.style.transition = 'opacity 0.3s'; el.style.opacity = '0'; }, 2200);
    setTimeout(function(){ el.remove(); }, 2600);
  }
