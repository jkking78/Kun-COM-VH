// KUN COM VH — Partie 5b : Squelettes de chargement, cartes d'événement, de bilan et de publication, sondages, aperçus

  'use strict';
  // ============================================================
  // SQUELETTES DE CHARGEMENT
  // ============================================================
  // Cartes grises animées affichées à la place des publications tant que la
  // synchronisation n'a pas répondu. Elles occupent à peu près la hauteur d'une
  // vraie carte : la page ne se réorganise donc plus sous les yeux quand les
  // publications arrivent, contrairement à une simple roue qui ne réserve rien.
  function renderSkeletonBloc(largeur, hauteur, rayon, marge) {
    return '<div style="width:' + largeur + ';height:' + hauteur + 'px;border-radius:' + rayon + 'px;' +
      (marge ? 'margin:' + marge + ';' : '') +
      'background:linear-gradient(90deg,var(--skeleton) 25%,var(--tile) 50%,var(--skeleton) 75%);background-size:800px 100%;' +
      'animation:shimmer 1.4s linear infinite;"></div>';
  }

  function renderSkeletonCards(nb) {
    var une =
      '<article aria-hidden="true" style="background:' + UI.card + ';border-radius:' + UI.r2 + ';margin:0 0 8px;overflow:hidden;box-shadow:' + UI.sh2 + ';">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:13px 16px 11px;">' +
          renderSkeletonBloc('36px', 36, 18) +
          '<div style="flex:1;">' +
            renderSkeletonBloc('42%', 11, 6) +
            renderSkeletonBloc('26%', 9, 5, '7px 0 0') +
          '</div>' +
        '</div>' +
        '<div style="padding:0 16px 12px;">' +
          renderSkeletonBloc('92%', 10, 5) +
          renderSkeletonBloc('68%', 10, 5, '8px 0 0') +
        '</div>' +
        renderSkeletonBloc('100%', 190, 0) +
        '<div style="display:flex;gap:18px;padding:13px 16px;">' +
          renderSkeletonBloc('54px', 13, 6) +
          renderSkeletonBloc('54px', 13, 6) +
          renderSkeletonBloc('54px', 13, 6) +
        '</div>' +
      '</article>';
    var out = '';
    for (var i = 0; i < (nb || 3); i++) out += une;
    return out;
  }

  // ============================================================
  // POST CARD — Style Instagram complet
  // ============================================================
  // Corps visuel d'un événement (pastille de date, titre, horaires, lieu, équipe,
  // image éventuelle). Extrait dans sa propre fonction pour être réutilisé tel quel
  // par la carte du fil, le carrousel des journées à plusieurs événements et le
  // Planning — un seul endroit à faire évoluer.
  function renderEventCardInner(post) {
    var evDate = post.eventDate ? new Date(post.eventDate + 'T00:00:00') : null;
    var evMonth = evDate ? evDate.toLocaleDateString('fr-FR', {month:'short'}).toUpperCase() : '';
    var evDay = evDate ? evDate.getDate() : '';
    // Pôles concernés, en pastilles discrètes plutôt qu'en texte violet brut.
    var evSections = (post.eventSections || []).slice(0, 3).map(function(s) {
      // Un pôle ouvre son fil.
      return '<button type="button" onclick="event.stopPropagation();App.tab(\'home\');App.story(\'' + jsArg(s) + '\')" style="font:inherit;font-size:11px;color:#CBD9D3;background:' + UI.evTag + ';border:none;padding:3px 9px;border-radius:' + UI.pill + ';white-space:nowrap;cursor:pointer;">' + safeHtml(secNom(s)) + '</button>';
    }).join('');
    var evMore = (post.eventSections || []).length > 3
      ? '<span style="font-size:11px;color:' + UI.evMuted + ';padding:3px 4px;">+' + ((post.eventSections || []).length - 3) + '</span>'
      : '';

    // Statut calculé sur de vrais horodatages (et non sur une comparaison de
    // chaînes « HH:MM », qui classait à tort une veillée passant minuit).
    var nowTs = Date.now();
    var startTs = eventStartTimestamp(post);
    var endTs = eventEndTimestamp(post);
    var badge = function(txt, bg, col) {
      return '<span style="background:' + bg + ';color:' + col + ';padding:2px 9px;border-radius:' + UI.pill + ';font-size:11px;white-space:nowrap;font-weight:600;">' + txt + '</span>';
    };
    var evStatus;
    if (endTs && endTs < nowTs)                            evStatus = badge('Terminé', UI.evTag, UI.evMuted);
    else if (startTs && startTs <= nowTs)                  evStatus = badge('En cours', UI.evGold, UI.evBg);
    else                                                   evStatus = badge('À venir', UI.evGoldSoft, UI.evGold);

    // L'affiche de l'événement s'ouvre en grand : c'est souvent là que se
    // trouvent les détails (horaires, lieu) écrits dans le visuel lui-même.
    var evImage = post.eventImage
      // height fixe plutôt que auto : sans hauteur connue, l'affiche occupait zéro
      // pixel jusqu'à son arrivée, puis faisait grandir la carte d'un coup. Le
      // recalage du carrousel est déclenché à son chargement.
      ? '<img src="' + safeUrl(post.eventImage) + '" loading="lazy" onload="App.recalerCarrousels()" onerror="App.mediaEchoue(this)" onclick="event.stopPropagation();App.openImageViewer(\'' + jsArg(urlSure(String(post.eventImage))) + '\')" style="display:block;width:100%;height:200px;object-fit:cover;border-radius:' + UI.r1 + ';margin-bottom:14px;background:#000;cursor:pointer;" />'
      : '';

    // Vert profond + or : identité réservée aux événements, pour qu'ils se
    // repèrent instantanément au milieu des publications ordinaires.
    return '<div style="padding:16px;background:' + UI.evBg + ';border-radius:' + UI.r2 + ';">' +
      evImage +
      '<div style="display:flex;gap:13px;align-items:flex-start;">' +
        (evDate ? '<div style="width:48px;flex-shrink:0;background:' + UI.evGoldSoft + ';border:0.5px solid ' + UI.evGoldLine + ';border-radius:' + UI.r1 + ';text-align:center;padding:6px 0;">' +
          '<div style="font-family:' + UI.fontMono + ';font-size:11px;color:' + UI.evGold + ';letter-spacing:0.8px;">' + evMonth + '</div>' +
          '<div style="font-family:' + UI.fontMono + ';font-size:22px;font-weight:700;color:' + UI.evInk + ';line-height:1.15;">' + evDay + '</div>' +
        '</div>' : '') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;">' +
            '<h3 style="font-family:' + UI.fontDisplay + ';font-size:15px;font-weight:700;letter-spacing:-0.3px;color:' + UI.evInk + ';margin:0;flex:1;min-width:0;">' + safeHtml(post.eventTitle) + '</h3>' +
            evStatus +
          '</div>' +
          '<div style="font-size:12px;color:' + UI.evMuted + ';display:flex;flex-wrap:wrap;gap:12px;margin-bottom:' + (evSections ? '11px' : '0') + ';">' +
            (post.eventStart ? '<span style="font-family:' + UI.fontMono + ';">' + ico('clock', 13, UI.evMuted) + ' ' + safeHtml(post.eventStart) + (post.eventEnd ? ' – ' + safeHtml(post.eventEnd) : '') + (crossesMidnight(post) ? ' +1 j' : '') + '</span>' : '') +
            (post.eventLocation ? '<span style="min-width:0;">' + ico('pin', 13, UI.evMuted) + ' ' + safeHtml(post.eventLocation) + '</span>' : '') +
          '</div>' +
          (evSections ? '<div style="display:flex;flex-wrap:wrap;gap:5px;">' + evSections + evMore + '</div>' : '') +
          (post.assignments && post.assignments.length > 0 ?
            '<div style="margin-top:13px;border-top:0.5px solid rgba(255,255,255,0.10);padding-top:11px;">' +
              '<div style="font-size:11px;color:' + UI.evGold + ';letter-spacing:0.8px;margin-bottom:8px;">ÉQUIPE ASSIGNÉE</div>' +
              '<div style="display:flex;flex-direction:column;gap:6px;">' +
              post.assignments.map(function(a) {
                var isMeAssigned = S.user && S.user.id === a.userId;
                // Tâche à livrer (assignation avec deadline) : statut + échéance,
                // et pour le membre concerné un bouton pour la cocher « faite ».
                var ts = a.userId ? taskStatusFor(a.userId, post) : null;
                var taskBlock = '';
                if (ts) {
                  var chip, chipBg, chipFg;
                  if (ts.done && !ts.late) { chip = 'Livrée à temps ✓'; chipBg = 'rgba(14,159,110,0.22)'; chipFg = '#8FE9C4'; }
                  else if (ts.done && ts.late) { chip = 'Livrée en retard'; chipBg = 'rgba(217,138,11,0.22)'; chipFg = '#F3C77A'; }
                  else if (ts.overdue) { chip = 'Non livrée · en retard'; chipBg = 'rgba(226,68,92,0.22)'; chipFg = 'var(--bad-line)'; }
                  else { chip = 'À livrer'; chipBg = UI.evGoldSoft; chipFg = UI.evGold; }
                  taskBlock =
                    '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px;">' +
                      '<span style="font-size:11px;font-weight:800;color:' + chipFg + ';background:' + chipBg + ';padding:2px 8px;border-radius:999px;">' + chip + '</span>' +
                      '<span style="font-size:11px;color:' + UI.evMuted + ';">échéance ' + formatDeadline(a.deadline) + '</span>' +
                    '</div>' +
                    (isMeAssigned
                      ? '<button onclick="event.stopPropagation();App.toggleTaskDone(\'' + jsArg(post.id) + '\')" style="margin-top:8px;width:100%;background:' + (ts.done ? 'rgba(255,255,255,0.10)' : UI.evGold) + ';color:' + (ts.done ? UI.evInk : '#20160A') + ';border:none;border-radius:' + UI.r1 + ';padding:9px;font-size:13px;font-weight:800;cursor:pointer;">' +
                          (ts.done ? '↩︎ Remettre à faire' : '✓ Marquer comme fait') +
                        '</button>'
                      : '');
                }
                return '<div style="background:' + (isMeAssigned ? UI.evGoldSoft : 'rgba(255,255,255,0.05)') + ';border:0.5px solid ' + (isMeAssigned ? UI.evGoldLine : 'transparent') + ';border-radius:' + UI.r1 + ';padding:8px 11px;">' +
                  '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
                    // Le nom ouvre le profil du membre (ou le fil du pôle).
                    '<button type="button" onclick="event.stopPropagation();' + (a.isSection ? 'App.story(\'' + jsArg(a.sectionId) + '\')' : 'App.openUserProfile(\'' + jsArg(a.userId) + '\')') + '" style="background:none;border:none;padding:4px 0;margin:-4px 0;font:inherit;text-align:left;cursor:pointer;font-size:13px;font-weight:700;color:' + (isMeAssigned ? UI.evGold : UI.evInk) + ';min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.25);text-underline-offset:3px;">' + safeHtml(nomAssignation(a, db(SK.USERS, []))) + (isMeAssigned ? ' · toi' : '') + '</button>' +
                    (function(){
                      // Présence validée ou non : toujours affichée pour un membre.
                      if (!a.userId) return '';
                      var r = reponseConvocation(post, a.userId);
                      var st = !r ? ['En attente', 'rgba(255,255,255,0.10)', UI.evMuted]
                        : r.statut === 'confirme' ? ['Confirmé ✓', 'rgba(14,159,110,0.22)', '#8FE9C4']
                        : ['Indisponible', 'rgba(226,68,92,0.22)', '#F5A3AF'];
                      return '<span style="flex-shrink:0;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;background:' + st[1] + ';color:' + st[2] + ';">' + st[0] + '</span>';
                    })() +
                  '</div>' +
                  '<div style="font-size:12px;color:' + UI.evMuted + ';margin-top:1px;">' + safeHtml(a.task) + '</div>' +
                  taskBlock +
                '</div>';
              }).join('') +
              '</div>' +
            '</div>'
          : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Regroupe les événements partageant la même date : ils s'affichent alors dans un
  // seul carrousel plutôt qu'en cartes successives. Le groupe prend la place du
  // premier événement rencontré, et les événements y sont ordonnés par heure de
  // début croissante (de la première à la dernière de la journée).
  // Un même événement programmé sur plusieurs semaines (« Répéter chaque
  // semaine » : recurrenceGroupId commun) n'occupe qu'UNE carte du fil : un
  // carrousel de ses prochaines dates, à faire glisser de droite à gauche.
  // Les dates déjà passées restent dans le Planning (Historique) ; si toute la
  // série est passée, le carrousel montre ses dates de la plus récente à la
  // plus ancienne.
  function datesDeSerie(events, maintenant) {
    var now = maintenant || Date.now();
    var fin = function(e) { return eventEndTimestamp(e) || eventStartTimestamp(e) || 0; };
    var aVenir = events.filter(function(e){ return fin(e) >= now; });
    var tri = function(a, b) { return String(a.eventDate).localeCompare(String(b.eventDate)) || String(a.eventStart || '').localeCompare(String(b.eventStart || '')); };
    if (aVenir.length) return aVenir.sort(tri);
    return events.slice().sort(tri).reverse();
  }

  function groupSameDayEvents(list) {
    var out = [];
    var indexByDate = {};
    var series = {};
    (list || []).forEach(function(p) {
      var g = p && p.type === 'EVENT' && p.recurrenceGroupId;
      if (g) (series[g] = series[g] || []).push(p);
    });
    var serieVue = {};
    (list || []).forEach(function(p) {
      var isEvent = p && p.type === 'EVENT' && p.eventTitle && p.eventDate;
      if (!isEvent) { out.push({ kind: 'post', post: p }); return; }
      var g = p.recurrenceGroupId;
      if (g && series[g].length > 1) {
        if (serieVue[g]) return;
        serieVue[g] = true;
        var dates = datesDeSerie(series[g]);
        out.push(dates.length > 1 ? { kind: 'serie', id: g, events: dates } : { kind: 'eventGroup', date: dates[0].eventDate, events: dates });
        return;
      }
      if (indexByDate[p.eventDate] === undefined) {
        indexByDate[p.eventDate] = out.length;
        out.push({ kind: 'eventGroup', date: p.eventDate, events: [p] });
      } else {
        out[indexByDate[p.eventDate]].events.push(p);
      }
    });
    out.forEach(function(item) {
      if (item.kind !== 'eventGroup') return;
      item.events.sort(function(a, b) {
        return String(a.eventStart || '').localeCompare(String(b.eventStart || ''));
      });
    });
    return out;
  }

  // Carrousel d'une série : chaque volet laisse dépasser le suivant, et une
  // petite animation (le volet glisse puis revient, flèche qui pulse) montre
  // qu'on peut faire défiler. Elle s'arrête dès qu'on a fait glisser une série.
  function renderSerieCard(serieId, events) {
    var carId = 'evserie-' + String(serieId).replace(/[^A-Za-z0-9_-]/g, '');
    var curIdx = Math.min((S.eventGroupIdx && S.eventGroupIdx[serieId]) || 0, events.length - 1);
    if (!(curIdx > 0)) curIdx = 0;
    var indice = false;
    try { indice = localStorage.getItem('kc_glisse_vu') !== '1'; } catch(e) {}
    var premier = events[0];
    var fmt = function(e) { return new Date(e.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'short' }); };
    var periode = fmt(events[0]) + ' → ' + fmt(events[events.length - 1]);
    return '<article style="background:' + UI.card + ';border-radius:' + UI.r2 + ';box-shadow:' + UI.sh2 + ';margin:0 12px 12px;overflow:hidden;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px 8px;">' +
        '<div onclick="App.goToEvent(\'' + jsArg(premier.id) + '\')" style="min-width:0;cursor:pointer;">' +
          '<div style="font-size:15px;font-weight:800;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(premier.eventTitle) + '</div>' +
          '<div style="font-size:12px;color:var(--faint);font-weight:600;margin-top:2px;">' + events.length + ' dates · ' + safeHtml(periode) + '</div>' +
        '</div>' +
        '<div id="evgrpBadge-' + carId + '" style="background:var(--accent-soft);color:var(--lien);font-size:12px;font-weight:800;padding:4px 10px;border-radius:20px;flex-shrink:0;">' + (curIdx + 1) + '/' + events.length + '</div>' +
      '</div>' +
      (indice ? '<div class="kc-glisse-texte" style="display:flex;align-items:center;gap:6px;padding:0 14px 8px;font-size:12px;font-weight:700;color:var(--lien);">Glisse vers la gauche pour voir les autres dates <span class="kc-glisse-fleche" style="display:inline-flex;">' + ico('chevronRight', 14, 'currentColor') + '</span></div>' : '') +
      '<div id="' + carId + '" data-carrousel-ev="1" onscroll="App.eventGroupScroll(\'' + jsArg(serieId) + '\',\'' + jsArg(carId) + '\',this)" style="display:flex;align-items:flex-start;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:10px;padding:0 16px 4px;scroll-padding:0 16px;transition:height 0.18s ease;">' +
        events.map(function(ev) {
          return '<div class="' + (indice ? 'kc-glisse' : '') + '" style="flex:0 0 86%;scroll-snap-align:start;box-sizing:border-box;">' +
            '<div style="position:relative;">' +
              // Pas de bouton ⋯ par-dessus : il masquait l'état et le lieu. On
              // modifie une date depuis le Planning, où mène la carte.
              '<div onclick="App.goToEvent(\'' + jsArg(ev.id) + '\')" style="cursor:pointer;">' + renderEventCardInner(ev) + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div id="evgrpDots-' + carId + '" style="display:flex;justify-content:center;gap:5px;padding:8px 0 12px;">' +
        events.map(function(_, di) {
          var a = di === curIdx;
          return '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B5FE0':'var(--line)') + ';transition:all 0.25s;"></div>';
        }).join('') +
      '</div>' +
    '</article>';
  }

  function renderEventGroupCard(dateIso, events) {
    var d = new Date(dateIso + 'T00:00:00');
    var dateLabel = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    var carId = 'evgrp-' + dateIso.replace(/-/g, '');
    // Bornage au rendu : l'indice stocké peut survivre à une édition (événement
    // retiré du groupe) et produire un badge impossible (« 3/2 »).
    var curIdx = Math.min((S.eventGroupIdx && S.eventGroupIdx[dateIso]) || 0, events.length - 1);
    if (!(curIdx > 0)) curIdx = 0;
    var anyPinned = events.some(function(e){ return isPinnedNow(e); });

    return '<article style="background:' + UI.card + ';border-radius:' + UI.r2 + ';box-shadow:' + UI.sh2 + ';margin:0 12px 12px;overflow:hidden;">' +
      (anyPinned ? '<div style="background:#0B5FE0;color:#FFF;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;display:flex;align-items:center;gap:6px;">' + ico('pinned', 13, 'currentColor') + ' ÉPINGLÉ</div>' : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 8px;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:15px;font-weight:800;color:var(--ink);text-transform:capitalize;">' + safeHtml(dateLabel) + '</div>' +
          '<div style="font-size:12px;color:var(--faint);font-weight:600;margin-top:2px;">' + events.length + ' événements · faites défiler</div>' +
        '</div>' +
        '<div id="evgrpBadge-' + carId + '" style="background:var(--accent-soft);color:var(--lien);font-size:12px;font-weight:800;padding:4px 10px;border-radius:20px;flex-shrink:0;">' + (curIdx + 1) + '/' + events.length + '</div>' +
      '</div>' +
      // align-items:flex-start + hauteur pilotée en JS (voir App.recalerCarrousels) :
      // une rangée flex prend sinon la hauteur de son PLUS GRAND volet. Quand l'un
      // des événements porte une affiche et l'autre non, le volet court laissait
      // dessous un vide blanc de plusieurs centaines de pixels — vide qui grandissait
      // encore au chargement de l'image, et repoussait tout le fil vers le bas.
      '<div id="' + carId + '" data-carrousel-ev="1" onscroll="App.eventGroupScroll(\'' + jsArg(dateIso) + '\',\'' + jsArg(carId) + '\',this)" style="display:flex;align-items:flex-start;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0;transition:height 0.18s ease;">' +
        events.map(function(ev) {
          // La carte entière ouvre l'événement dans le Planning, à la bonne date :
          // sans cela il fallait quitter le fil et le retrouver à la main.
          return '<div style="flex:0 0 100%;scroll-snap-align:start;padding:0 16px 4px;box-sizing:border-box;">' +
            '<div style="position:relative;">' +
              '<div onclick="App.goToEvent(\'' + jsArg(ev.id) + '\')" style="cursor:pointer;">' + renderEventCardInner(ev) + '</div>' +
              '<button onclick="event.stopPropagation();App.openOptions(\'' + jsArg(ev.id) + '\')" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.92);border:none;width:44px;height:44px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.08);">' + SVG.dots + '</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div id="evgrpDots-' + carId + '" style="display:flex;justify-content:center;gap:5px;padding:8px 0 12px;">' +
        events.map(function(_, di) {
          var a = di === curIdx;
          return '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B5FE0':'var(--line)') + ';transition:all 0.25s;"></div>';
        }).join('') +
      '</div>' +
    '</article>';
  }

  // Bloc visuel d'UNE section évaluée (utilisé seul ou dans le carrousel).
  function renderEvaluationSlide(ev) {
    var score = ev.globalScore;
    var badgeBg = score>=4 ? UI.okPlein : score>=2 ? UI.warnPlein : UI.bad;
    var badgeShadow = score>=4 ? 'rgba(34,197,94,0.3)' : score>=2 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
    var crit = ev.criteria || {};
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div>' +
          '<div style="display:inline-flex;align-items:center;gap:4px;background:var(--card);padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' + ico('chart', 13, 'currentColor') + ' Évaluation</div>' +
          '<div style="font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-0.5px;">' + (ev.teamId ? icoPole(ev.teamId, 20) + ' ' : '') + safeHtml(ev.teamName || '') + '</div>' +
        '</div>' +
        '<div style="background:' + badgeBg + ';color:#FFF;padding:12px 16px;border-radius:16px;font-size:28px;font-weight:800;box-shadow:0 6px 16px ' + badgeShadow + ';text-shadow:0 2px 4px rgba(0,0,0,0.1);white-space:nowrap;">' + score + '/5</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px;">' +
        Object.keys(crit).map(function(k) {
          var v = crit[k];
          var pct = (v/5)*100;
          var cCol = v>=4?'#0E9F6E':v>=2?'#D98A0B':'#D92D20';
          return '<div style="display:flex;flex-direction:column;gap:6px;">' +
                   '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:var(--muted);"><span>' + safeHtml(k) + '</span><span style="color:var(--ink);">' + v + '/5</span></div>' +
                   '<div style="height:10px;background:var(--line);border-radius:8px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.06);">' +
                     '<div style="height:100%;width:' + pct + '%;background:' + cCol + ';border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.1);"></div>' +
                   '</div>' +
                 '</div>';
        }).join('') +
      '</div>' +
      // Détail de la ponctualité automatique : qui est arrivé quand, et ce que
      // chacun a apporté au total du pôle.
      (ev.punctuality && ev.punctuality.details && ev.punctuality.details.length
        ? '<div style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--line2);">' +
            '<div style="font-size:11px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Ponctualité — calcul automatique</div>' +
            ev.punctuality.details.map(function(d) {
              var dc = d.stars >= 4 ? '#0E9F6E' : d.stars >= 2 ? '#D98A0B' : '#D92D20';
              var when = d.absent ? 'aucune publication' : (d.delayMinutes <= 0 ? "à l'heure" : '+' + d.delayMinutes + ' min');
              var geoNote = '';
              if (!d.absent) {
                if (!d.geo || !d.geo.available) geoNote = '<span style="display:block;font-size:11px;color:#B45309;font-weight:700;">présence non vérifiée</span>';
                else if (d.distance === null || d.distance === undefined) geoNote = '';
                else if (d.onSite) geoNote = '<span style="display:block;font-size:11px;color:var(--ok-ink);">sur place (' + formatDistance(d.distance) + ')</span>';
                else geoNote = '<span style="display:block;font-size:11px;color:var(--bad-ink);font-weight:700;">à ' + formatDistance(d.distance) + ' du lieu</span>';
              }
              return '<div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:12px;padding:3px 0;gap:10px;">' +
                '<span style="color:var(--muted);min-width:0;">' + safeHtml(d.name) + (d.task ? ' <span style="color:var(--faint);">· ' + safeHtml(d.task) + '</span>' : '') + geoNote + '</span>' +
                '<span style="font-weight:800;color:' + dc + ';white-space:nowrap;">' + (d.stars>0?'+':'') + d.stars + '★ · ' + when + '</span>' +
              '</div>';
            }).join('') +
            '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:800;color:var(--ink);padding-top:8px;margin-top:6px;border-top:1px solid var(--line);">' +
              '<span>Total du pôle (' + ev.punctuality.count + ' membre' + (ev.punctuality.count>1?'s':'') + ')</span>' +
              '<span>' + ev.punctuality.average + '/5</span>' +
            '</div>' +
          '</div>'
        : '') +
      (ev.comment ? '<p style="font-size:13px;color:var(--ink2);margin:14px 0 0;line-height:1.4;">' + safeHtml(ev.comment) + '</p>' : '');
  }

  // Publication d'évaluation. Plusieurs sections évaluées = un carrousel horizontal
  // dans UNE seule publication (au lieu d'une publication distincte par section).
  function renderEvaluationContent(post) {
    var meta = post.metadata || {};
    var evBadge = meta.eventTitle
      ? '<div style="font-size:13px;font-weight:800;color:var(--lien);background:rgba(88,86,214,0.08);padding:6px 12px;border-radius:12px;margin-bottom:12px;display:flex;align-items:center;gap:6px;"><span>Événement :</span> <span>' + safeHtml(meta.eventTitle) + '</span></div>'
      : '';

    // Ancien format (une seule section, publications déjà en base) ramené au
    // format liste pour être rendu par le même code.
    var evals = meta.evaluations;
    if (!Array.isArray(evals) || evals.length === 0) {
      evals = [{ teamName: meta.teamName, globalScore: meta.globalScore, criteria: meta.criteria, comment: post.caption || '' }];
    }

    var boxStyle = 'padding:18px;background:linear-gradient(135deg, var(--card) 0%, var(--tile) 100%);border-radius:20px;border:1px solid var(--line);box-shadow:inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.03);';

    if (evals.length === 1) {
      return '<div style="margin:10px 14px;' + boxStyle + '">' + evBadge + renderEvaluationSlide(evals[0]) + '</div>';
    }

    // Bornage au rendu : l'indice stocké peut survivre à une édition et produire
    // un badge impossible (« 3/2 »).
    var curIdx = Math.min((S.evalCarouselIdx && S.evalCarouselIdx[post.id]) || 0, evals.length - 1);
    if (!(curIdx > 0)) curIdx = 0;
    return '<div style="margin:10px 14px;">' +
      evBadge +
      '<div style="position:relative;">' +
        '<div style="position:absolute;top:10px;right:10px;z-index:3;background:rgba(15,23,42,0.72);color:#FFF;font-size:12px;font-weight:800;padding:4px 10px;border-radius:12px;" id="evalBadge-' + post.id + '">' + (curIdx+1) + '/' + evals.length + '</div>' +
        '<div id="evalCar-' + post.id + '" onscroll="App.evalCarScroll(\'' + jsArg(post.id) + '\', this)" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;gap:0;">' +
          evals.map(function(ev) {
            return '<div style="flex:0 0 100%;scroll-snap-align:start;box-sizing:border-box;' + boxStyle + '">' + renderEvaluationSlide(ev) + '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div id="evalDots-' + post.id + '" style="display:flex;justify-content:center;gap:5px;margin-top:10px;">' +
        evals.map(function(_, di) {
          var a = di === curIdx;
          return '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B5FE0':'var(--line)') + ';transition:all 0.25s;"></div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  // Bandeau d'arrivée affiché publiquement sur une publication rattachée à un
  // événement : heure d'enregistrement, ponctualité obtenue et — c'est le point
  // essentiel — la distance au lieu. Tout le monde le voit, personne ne peut le
  // retirer : seule la suppression de la publication le fait disparaître, et cette
  // suppression est elle-même visible de tous.
  function renderCheckInBadge(post) {
    // Le badge n'apparaît que sur un ENREGISTREMENT D'ARRIVÉE, pas sur une simple
    // publication mentionnant un événement.
    if (!post || !post.checkInEventId) return '';
    // isEventLike : si l'événement a été supprimé puis archivé (voir
    // App.deletePost), ce badge — et les étoiles qu'il affiche — doit rester
    // visible sur la publication du membre malgré tout.
    var ev = db(SK.POSTS, []).find(function(p){ return p.id === post.checkInEventId && isEventLike(p); });
    if (!ev) return '';

    var startTs = eventStartTimestamp(ev);
    var arrival = post.checkInAt || post.timestamp || 0;
    var delay = startTs ? Math.round((arrival - startTs) / 60000) : null;
    var dist = checkInDistance(post, ev);
    var geo = post.geo;

    // On reprend le calcul officiel (qui invalide un pointage hors du lieu) plutôt
    // que de recalculer ici : les deux affichages ne peuvent pas diverger.
    var official = punctualityStars(post.userId, ev.id, db(SK.POSTS, []));
    var isThisCheckIn = official && official.checkInPostId === post.id;
    var stars = isThisCheckIn ? official.stars : (delay === null ? null : starsForDelay(delay));
    var offsite = isThisCheckIn && official.offsite;
    // État de présence (indépendant de la ponctualité) : voir punctualityStars.
    var venueKnown = typeof ev.eventLat === 'number' && typeof ev.eventLng === 'number';
    var presence = (isThisCheckIn && official.presence)
      ? official.presence
      : (!venueKnown ? 'no_venue'
         : (geo && geo.available ? (dist !== null && dist <= ON_SITE_RADIUS_M ? 'onsite' : 'offsite') : 'unverified'));
    var isAuthor = S.user && post.userId === S.user.id;

    var starCol = stars === null ? 'var(--faint)' : stars >= 4 ? '#0E9F6E' : stars >= 2 ? '#D98A0B' : '#D92D20';

    var confirmBtn = isAuthor
      ? '<div style="margin-top:6px;"><button onclick="App.confirmPresence(\'' + jsArg(post.id) + '\')"' + (S.geoCapturing ? ' disabled' : '') + ' style="background:var(--accent-soft);color:var(--lien);border:none;border-radius:12px;padding:7px 12px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;">' + ico('pin', 13, 'currentColor') + 'Confirmer ma présence</button></div>'
      : '';

    // Bloc position selon l'état de présence.
    var geoBlock;
    if (presence === 'onsite') {
      geoBlock = '<span style="color:var(--ok-ink);font-weight:800;">' + ico('pin',12,'var(--ok-ink)') + ' Sur place</span>' +
        (dist !== null ? '<span style="color:var(--muted);"> · à ' + formatDistance(dist) + ' du point de référence</span>' : '');
    } else if (presence === 'offsite') {
      geoBlock = '<span style="color:var(--bad-ink);font-weight:800;">' + ico('alert',12,'var(--bad-ink)') + ' Hors zone — à ' + formatDistance(dist) + ' du lieu</span>';
    } else if (presence === 'no_venue') {
      geoBlock = (geo && geo.available)
        ? '<span style="color:var(--muted);">Position enregistrée' + (geo.accuracy ? ' (±' + geo.accuracy + ' m)' : '') + ' · lieu de l\'événement non défini</span>'
        : '<span style="color:var(--faint);">Lieu de l\'événement non défini</span>';
    } else if (presence === 'pending') { // fenêtre de grâce en cours — PAS de pénalité
      geoBlock = '<span style="color:#B45309;font-weight:800;display:inline-flex;align-items:center;gap:5px;">' + ico('hourglass', 13, '#B45309') + 'Vérification de la présence en cours…</span>' +
        '<span style="color:var(--faint);"> · l\'heure d\'arrivée est déjà prise en compte</span>' + confirmBtn;
    } else { // unverified : grâce écoulée sans position — sanctionné
      geoBlock = '<span style="color:var(--bad-ink);font-weight:800;">' + ico('ban',12,'var(--bad-ink)') + ' Présence non vérifiée</span>' +
        '<span style="color:var(--faint);"> · position non obtenue dans le délai</span>' + confirmBtn;
    }

    var isBad = presence === 'offsite' || presence === 'unverified';
    var isWarn = presence === 'pending';
    var bg = isBad ? 'var(--bad-soft)' : (isWarn ? 'var(--warn-soft)' : 'var(--tile)');
    var border = isBad ? 'var(--bad-line)' : (isWarn ? '#FDE68A' : 'var(--line)');
    var headLabel = presence === 'offsite' ? ico('ban',12,'var(--bad-ink)') + ' Pointage hors zone'
      : presence === 'unverified' ? ico('ban',12,'var(--bad-ink)') + ' Pointage non validé'
      : ico('clock',12,'#64748B') + ' Arrivée enregistrée';
    var penaltyNote = presence === 'offsite'
      ? 'Arrivée non comptabilisée : il fallait être à moins de ' + formatDistance(ON_SITE_RADIUS_M) + ' du lieu.'
      : (presence === 'unverified' ? 'Arrivée non comptabilisée : présence non vérifiée dans la minute (position non partagée). Utilise « Confirmer ma présence » si tu es sur place.' : '');

    return '<div style="margin:0 14px 10px;padding:10px 12px;background:' + bg + ';border:1px solid ' + border + ';border-radius:16px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">' +
        '<span style="font-size:11px;font-weight:800;color:' + (isBad ? 'var(--bad-ink)' : 'var(--faint)') + ';text-transform:uppercase;letter-spacing:0.5px;">' + headLabel + '</span>' +
        (stars === null ? '' : '<span style="font-size:13px;font-weight:800;color:' + starCol + ';white-space:nowrap;">' + (stars>0?'+':'') + stars + '★</span>') +
      '</div>' +
      '<div style="font-size:12px;color:var(--muted);line-height:1.5;">' +
        (delay === null ? '' : (delay <= 0 ? "À l'heure" : 'Retard de ' + delay + ' min') + ' · ') +
        new Date(arrival).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) +
      '</div>' +
      '<div style="font-size:12px;line-height:1.5;margin-top:2px;">' + geoBlock + '</div>' +
      (penaltyNote ? '<div style="font-size:11px;color:var(--bad-ink);margin-top:3px;font-weight:700;line-height:1.4;">' + penaltyNote + '</div>' : '') +
      (post.checkInByEdit ? '<div style="font-size:11px;color:var(--bad-ink);margin-top:3px;font-weight:700;">Rattaché à l\'événement après publication</div>' : '') +
    '</div>';
  }

  // Pile des épinglés. Plusieurs cartes épinglées d'affilée saturent le haut du
  // fil et repoussent l'actualité hors de l'écran. On les regroupe donc en UN
  // bloc, replié par défaut : rien n'est retiré, tout reste accessible en une
  // touche. En dessous de deux, on garde la carte complète telle quelle.
  function renderPinnedStack(pinned) {
    var ouvert = !!S.pinnedOpen;

    var ligne = function(p) {
      var estEv = p.type === 'EVENT' && p.eventTitle;
      var titre = estEv ? p.eventTitle : (p.caption || 'Publication');
      var d = estEv && p.eventDate ? new Date(p.eventDate + 'T00:00:00') : null;
      var vignette = d
        ? '<div style="width:38px;flex-shrink:0;background:' + UI.evBg + ';border-radius:12px;text-align:center;padding:4px 0;">' +
            '<div style="font-size:8px;color:' + UI.evGold + ';letter-spacing:0.5px;">' + d.toLocaleDateString('fr-FR',{month:'short'}).toUpperCase() + '</div>' +
            '<div style="font-size:15px;font-weight:600;color:' + UI.evInk + ';line-height:1.1;">' + d.getDate() + '</div>' +
          '</div>'
        : '<div style="width:38px;height:38px;flex-shrink:0;border-radius:12px;background:' + UI.tile + ';display:flex;align-items:center;justify-content:center;">' + ico('message', 17, UI.faint) + '</div>';
      var meta = estEv
        ? ((p.eventStart || '') + (p.eventEnd ? ' – ' + p.eventEnd : '') + (p.eventLocation ? ' · ' + p.eventLocation : ''))
        : (p.author || '');
      var action = estEv ? "App.goToEvent('" + p.id + "')" : "App.goToPost('" + p.id + "')";
      return '<div onclick="' + action + '" style="display:flex;align-items:center;gap:11px;padding:9px 14px;border-top:0.5px solid ' + UI.line + ';cursor:pointer;">' +
        vignette +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:500;color:' + UI.ink + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(titre) + '</div>' +
          (meta ? '<div style="font-size:12px;color:' + UI.faint + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(meta) + '</div>' : '') +
        '</div>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + UI.line2 + '" stroke-width="2.4" style="flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>' +
      '</div>';
    };

    return '<div style="background:' + UI.card + ';border-radius:' + UI.r2 + ';box-shadow:' + UI.sh2 + ';margin:0 12px 12px;overflow:hidden;">' +
      '<div onclick="App.togglePinnedStack()" style="display:flex;align-items:center;gap:9px;padding:13px 14px;cursor:pointer;">' +
        ico('pinned', 16, UI.accent) +
        '<span style="font-size:13px;font-weight:600;color:' + UI.ink + ';">Épinglés</span>' +
        '<span style="font-size:12px;font-weight:600;color:' + UI.accentInk + ';background:' + UI.accentSoft + ';padding:1px 8px;border-radius:' + UI.pill + ';">' + pinned.length + '</span>' +
        '<span style="margin-left:auto;font-size:12px;color:' + UI.faint + ';">' + (ouvert ? 'Réduire' : 'Afficher') + '</span>' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' + UI.faint + '" stroke-width="2.2" style="transform:rotate(' + (ouvert ? '90' : '0') + 'deg);transition:transform 0.2s;flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>' +
      '</div>' +
      (ouvert ? '' : pinned.map(ligne).join('')) +
    '</div>' +
    // Déplié : les cartes complètes reprennent leur place habituelle, sous l'en-tête.
    (ouvert ? pinned.map(function(p){ return renderPostCard(p); }).join('') : '');
  }

  // Image en plein écran. Un simple toucher n'importe où referme : c'est le
  // geste attendu, et le bouton de fermeture reste là pour ceux qui le cherchent.
  function renderImageViewer() {
    if (!S.viewerImage) return '';
    return '<div onclick="App.closeImageViewer()" class="safe-top" style="position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.94);display:flex;align-items:center;justify-content:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom));animation:fadeIn 0.18s ease-out;">' +
      '<button onclick="event.stopPropagation();App.closeImageViewer()" aria-label="Fermer" style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.16);border:none;border-radius:50%;width:44px;height:44px;color:#FFF;font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation;">×</button>' +
      '<img src="' + safeUrl(S.viewerImage) + '" onclick="event.stopPropagation()" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:' + UI.r1 + ';" />' +
    '</div>';
  }

  // Vignette d'un lien : image si le site en fournit une, sinon domaine seul.
  // « compact » sert dans le composeur, où la place est comptée.
  function renderLinkPreviewCard(pv, opts) {
    if (!pv || !pv.url) return '';
    opts = opts || {};
    var domain = pv.siteName || linkDomain(pv.url);
    var titre = pv.title || domain;
    var img = pv.image
      ? '<img src="' + safeUrl(pv.image) + '" loading="lazy" onerror="this.style.display=\'none\'" style="display:block;width:100%;height:' + (opts.compact ? '120px' : '170px') + ';object-fit:cover;background:' + UI.tile + ';" />'
      : '';
    var inner =
      img +
      '<div style="padding:10px 12px;">' +
        '<div style="font-size:11px;color:' + UI.faint + ';text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">' + safeHtml(domain) + '</div>' +
        '<div style="font-size:13px;font-weight:600;color:' + UI.ink + ';line-height:1.35;">' + safeHtml(titre) + '</div>' +
        (pv.description && !opts.compact
          ? '<div style="font-size:12px;color:' + UI.muted + ';line-height:1.4;margin-top:3px;">' + safeHtml(pv.description) + '</div>'
          : '') +
      '</div>';

    var box = '<div style="border:0.5px solid ' + UI.line2 + ';border-radius:' + UI.r1 + ';overflow:hidden;background:' + UI.card + ';">' + inner + '</div>';
    if (opts.noLink) return box;
    return '<a href="' + safeUrl(pv.url) + '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">' + box + '</a>';
  }

  // Sondage optionnel attaché à une publication : question + options cliquables.
  // Une seule réponse par membre ; les résultats (barres + %) n'apparaissent
  // qu'une fois qu'on a soi-même voté, pour ne pas influencer le vote.
  function renderPollBlock(post) {
    if (!post || !post.poll || !Array.isArray(post.poll.options) || post.poll.options.length < 2) return '';
    var poll = post.poll;
    var myVote = S.user ? pollUserVote(poll, S.user.id) : null;
    var total = pollTotalVotes(poll);
    var hasVoted = myVote !== null;

    return '<div style="margin:0 14px 10px;padding:14px;background:var(--tile);border-radius:16px;">' +
      '<div style="font-size:11px;font-weight:800;color:var(--lien);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">' + ico('chart', 13, 'currentColor') + ' Sondage</div>' +
      '<div style="font-size:15px;font-weight:800;color:var(--ink);margin-bottom:10px;line-height:1.4;">' + safeHtml(poll.question||'') + '</div>' +
      poll.options.map(function(opt, idx) {
        var pct = pollOptionPct(poll, idx);
        var mine = myVote === idx;
        return '<div onclick="App.votePoll(\'' + jsArg(post.id) + '\', ' + idx + ')" style="position:relative;margin-bottom:7px;border-radius:12px;overflow:hidden;background:var(--card);border:1.5px solid ' + (mine?UI.accent:'var(--line)') + ';cursor:pointer;">' +
          (hasVoted ? '<div style="position:absolute;top:0;left:0;bottom:0;width:' + pct + '%;background:' + (mine?'var(--accent-soft)':'var(--tile)') + ';transition:width 0.3s;"></div>' : '') +
          '<div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;">' +
            '<span style="font-size:13px;font-weight:' + (mine?'800':'600') + ';color:' + (mine?'var(--accent-ink)':'var(--ink)') + ';">' + (mine ? '✓ ' : '') + safeHtml(opt) + '</span>' +
            (hasVoted ? '<span style="font-size:12px;font-weight:800;color:var(--faint);white-space:nowrap;">' + pct + '%</span>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
      '<div style="font-size:11px;color:var(--faint);font-weight:600;margin-top:2px;">' + total + ' vote' + (total!==1?'s':'') + (hasVoted ? ' · touche pour changer ton choix' : ' · touche une option pour voter') + '</div>' +
    '</div>';
  }

  // Troncature prudente de texte : ne coupe JAMAIS au milieu d'une paire
  // surrogate (sinon un emoji tronqué devient un caractère invalide « � »),
  // et si possible recule jusqu'au dernier espace pour ne pas couper un mot.
  // Exception : une caption contenant une URL est coupée dur à la longueur max,
  // sans reculer, pour ne pas risquer d'abîmer le lien.
  function sliceSafe(str, max) {
    if (!str || str.length <= max) return str || '';
    var cut = str.slice(0, max);
    var last = cut.charCodeAt(cut.length - 1);
    if (last >= 0xD800 && last <= 0xDBFF) cut = cut.slice(0, -1);
    if (str.indexOf('http') === -1 && cut.length < str.length) {
      var suivant = str.charAt(cut.length);
      if (suivant && suivant !== ' ') {
        var dernierEspace = cut.lastIndexOf(' ');
        if (dernierEspace > 0) cut = cut.slice(0, dernierEspace);
      }
    }
    return cut;
  }

  function renderPostCard(post) {
    var iLiked = userIsLiked(post);
    var iSaved = !!S.savedPosts[post.id];
    var hasMedia = post.mediaUrls && post.mediaUrls.length > 0;
    // Rattrapage : publications vidéo déjà en ligne sans vignette (générée trop tôt
    // ou échouée sur mobile). On la fabrique une fois puis on l'enregistre.
    backfillVideoPoster(post);
    // Bornage au rendu : l'indice stocké peut survivre à une édition de la
    // publication (média retiré) et produire un badge impossible (« 3/2 »).
    var curIdx = Math.min(S.carouselIdx[post.id] || 0, (post.mediaUrls||[]).length - 1);
    if (!(curIdx > 0)) curIdx = 0;
    var expanded = !!S.expandedCaptions[post.id];
    var ago = timeAgo(post.timestamp);
    var sec = SECTIONS.find(function(s){ return s.id === post.sectionId; }) || { id: '', color:'var(--faint)' };
    var likeCount = Array.isArray(post.likedBy) ? post.likedBy.length : (post.likes || 0);
    var viewCount = Array.isArray(post.viewedBy) ? post.viewedBy.length : 0;
    var postAuthorUser = db(SK.USERS, []).find(function(u){ return u.id === post.userId; });
    var postAuthorRoleLabel = roleLabel(postAuthorUser ? postAuthorUser.role : null);
    // Section du PROFIL de l'auteur (affichée dans l'en-tête) — différente du topic
    // détecté par hashtag sur la publication (affiché près des icônes like/commentaire/partage).
    var authorSecId = getUserSections(postAuthorUser)[0];
    var authorSecObj = SECTIONS.find(function(s){ return s.id === authorSecId; });
    var authorSecColor = authorSecObj ? authorSecObj.color : '#0B5FE0';
    var authorSecNom = authorSecObj ? authorSecObj.nom : 'Membre';

    // Caption truncation (Instagram style: max 3 lines)
    var fullCaption = post.caption || '';
    var captionHtml = '';
    var lines = fullCaption.split('\n');
    var needsTruncate = fullCaption.length > 120 || lines.length > 3;
    if (!expanded && needsTruncate) {
      var short = sliceSafe(fullCaption, 120);
      captionHtml = hashtagify(short) + '... <span onclick="App.expandCaption(\'' + jsArg(post.id) + '\')" style="color:var(--faint);cursor:pointer;font-weight:600;">plus</span>';
    } else {
      captionHtml = hashtagify(fullCaption);
      if (needsTruncate && expanded) {
        captionHtml += ' <span onclick="App.expandCaption(\'' + jsArg(post.id) + '\')" style="color:var(--faint);cursor:pointer;font-weight:600;">moins</span>';
      }
    }

    // Media zone
    var mediaZone = '';
    if (hasMedia) {
      var isMulti = post.mediaUrls.length > 1;
      mediaZone = '<div style="position:relative;background:#000;">' +
        (isMulti ? '<div id="badge-'+post.id+'" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.6);color:#FFF;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;z-index:10;">' + (curIdx+1) + '/' + post.mediaUrls.length + '</div>' : '') +
        '<div id="car-'+post.id+'" onscroll="App.carScroll(\''+jsArg(post.id)+'\',this)" ondblclick="App.doubleTapLike(\''+jsArg(post.id)+'\')" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;">' +
          post.mediaUrls.map(function(url) {
            // Les dimensions réelles du média sont conservées (pas de recadrage forcé en
            // carré) : width/height:auto + object-fit:contain, limité par max-height pour
            // ne pas laisser une vidéo très verticale envahir tout l'écran.
            var mediaTag = isVideoUrl(url)
              // Avec une vignette, preload="metadata" : la vidéo n'est téléchargée
              // qu'à la lecture (jusqu'à 19 Mo, sur données mobiles). Sans vignette,
              // preload="auto" + onloadeddata : on force le navigateur à afficher la
              // première image plutôt qu'un écran noir.
              // onerror : URL expirée/supprimée = encart « Média indisponible »
              // (voir App.mediaEchoue) au lieu d'un média cassé définitif.
              ? '<video src="'+safeUrl(url)+'"' + (post.videoPoster ? ' poster="'+safeUrl(post.videoPoster)+'" preload="metadata"' : ' preload="auto"') + ' controls playsinline onloadedmetadata="App.mediaCharge(this,\''+jsArg(url)+'\')" onloadeddata="App.primeVideoFrame(this)" onerror="App.mediaEchoue(this)" style="display:block;width:auto;height:auto;max-width:100%;max-height:640px;object-fit:contain;margin:0 auto;background:#000;"></video>'
              : '<img src="'+safeUrl(url)+'" loading="lazy" onload="App.mediaCharge(this,\''+jsArg(url)+'\')" onerror="App.mediaEchoue(this)" onclick="App.openImageViewer(\''+jsArg(url)+'\')" style="display:block;width:auto;height:auto;max-width:100%;max-height:640px;object-fit:contain;margin:0 auto;cursor:pointer;"/>';
            // Réservation de la hauteur AVANT que le média n'arrive : avec sa
            // proportion connue, la place est exacte et rien ne bouge ; sinon on
            // réserve une hauteur raisonnable, ce qui évite déjà que la carte soit
            // plate et que le pied de liste remonte en haut de l'écran.
            var r = ratioMedia(url);
            var reserve = r
              ? 'aspect-ratio:' + r + ';max-height:640px;'
              : 'min-height:320px;';
            return '<div style="flex:0 0 100%;scroll-snap-align:start;display:flex;align-items:center;justify-content:center;' + reserve + '">'+mediaTag+'</div>';
          }).join('') +
        '</div>' +
        (isMulti ? '<div id="dots-'+post.id+'" style="display:flex;justify-content:center;gap:5px;padding:8px 0;background:var(--card);">' +
          post.mediaUrls.map(function(_,di){
            var a = di === curIdx;
            return '<div style="width:'+(a?'18':'6')+'px;height:6px;border-radius:3px;background:'+(a?'#0B5FE0':'var(--line)')+';transition:all 0.25s;"></div>';
          }).join('') +
        '</div>' : '') +
      '</div>';
    } else {
      // Text-only: only show dark zone for vedette/scored posts
      if (post.postBg) {
        // Colored/gradient background post — Facebook style
        var bgStyle = post.postBg.startsWith('url')
          ? 'background:' + safeHtml(post.postBg) + ';background-size:cover;background-position:center;'
          : 'background:' + safeHtml(post.postBg) + ';';
        var captionForBg = post.caption || '';
        var fontSize = captionForBg.length > 100 ? '18px' : captionForBg.length > 60 ? '22px' : '26px';
        mediaZone = '<div ondblclick="App.doubleTapLike(\''+jsArg(post.id)+'\')" style="position:relative;' + bgStyle + 'min-height:220px;display:flex;align-items:center;justify-content:center;padding:28px 20px;text-align:center;overflow:hidden;">' +
          '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.08);"></div>' +
          '<p style="position:relative;z-index:1;font-size:' + fontSize + ';font-weight:800;color:#FFF;margin:0;line-height:1.4;text-shadow:0 2px 16px rgba(0,0,0,0.4);word-break:break-word;">' + hashtagify(captionForBg) + '</p>' +
        '</div>';
        // Don't show caption again below for bg posts (it's in the card)
        captionHtml = '';
      } else if (post.isVedette || post.scoreText) {
        mediaZone = '<div ondblclick="App.doubleTapLike(\''+jsArg(post.id)+'\')" style="background:linear-gradient(135deg,#1A1A2E,#2D2D44);min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center;position:relative;">' +
          '<div style="width:44px;height:44px;border-radius:20px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;margin-bottom:8px;">' + icoPole(sec.id, 22, '#FFF') + '</div>' +
          (post.isVedette ? '<div style="background:linear-gradient(135deg,#FFD700,#D98A0B);color:#5D3A00;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;letter-spacing:0.8px;margin-bottom:6px;">SECTION VEDETTE</div>' : '') +
          (post.scoreText ? '<div style="background:rgba(255,255,255,0.92);backdrop-filter:blur(8px);padding:5px 12px;border-radius:12px;position:absolute;bottom:12px;right:12px;"><strong style="font-size:13px;color:var(--ink);">★ ' + post.scoreText + '</strong></div>' : '') +
        '</div>';
      } else {
        // Plain text post — no background, caption shown below
        mediaZone = '';
      }
    }

    var pinnedBadge = isPinnedNow(post) ? '<div style="background:#0B5FE0;color:#FFF;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:4px 12px;display:flex;align-items:center;gap:6px;">' + ico('pinned', 13, 'currentColor') + ' ÉPINGLÉ</div>' : '';

      var contentZone = '';
      // Handle new-format EVENT posts (created by saveEvent)
      if (post.type === 'EVENT' && post.eventTitle) {
         // Cliquer sur l'événement dans le fil l'ouvre dans le Planning, à sa date.
         contentZone = '<div onclick="App.goToEvent(\'' + jsArg(post.id) + '\')" style="margin:0 16px 14px;cursor:pointer;">' + renderEventCardInner(post) + '</div>';
      } else if (post.type === 'EVENT' && post.metadata) {
         var participants = Object.keys(post.metadata.participations || {}).filter(function(k) { return post.metadata.participations[k] === 'yes'; });
         var partAvatars = '';
         if (participants.length > 0) {
             partAvatars = '<div style="display:flex;margin-left:8px;">';
             for (var i=0; i<Math.min(participants.length, 3); i++) {
                 partAvatars += '<div style="width:24px;height:24px;border-radius:12px;background:#0B5FE0;color:#FFF;border:2px solid var(--card);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;margin-left:-8px;">' + ico('user', 12, 'currentColor') + '</div>';
             }
             if (participants.length > 3) {
                 partAvatars += '<div style="width:24px;height:24px;border-radius:12px;background:var(--line);color:var(--ink);border:2px solid var(--card);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;margin-left:-8px;">+'+(participants.length-3)+'</div>';
             }
             partAvatars += '</div>';
         }

         contentZone = '<div style="margin:10px 14px;padding:20px;background:var(--tile);border-radius:20px;border-left:5px solid #0B5FE0;box-shadow:0 4px 12px rgba(0,0,0,0.03);position:relative;overflow:hidden;">' +
          '<div style="position:absolute;top:0;right:0;width:100px;height:100px;background:radial-gradient(circle, rgba(88,86,214,0.05) 0%, rgba(255,255,255,0) 70%);border-radius:50%;transform:translate(30%,-30%);"></div>' +
          
          '<div style="display:inline-block;background:rgba(88,86,214,0.1);color:var(--lien);padding:4px 10px;border-radius:8px;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">Événement Planning</div>' +
          
          '<div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">' +
            '<div style="background:var(--card);border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,0.08);width:70px;text-align:center;flex-shrink:0;border:1px solid var(--line);">' +
              '<div style="background:linear-gradient(135deg, #D92D20, #D92D20);color:#FFF;font-size:11px;font-weight:800;text-transform:uppercase;padding:6px 0;letter-spacing:1px;">' + (post.metadata.month||'MOIS') + '</div>' +
              '<div style="font-size:28px;font-weight:800;color:var(--ink);padding:8px 0;">' + (post.metadata.day||'00') + '</div>' +
            '</div>' +
            '<div style="flex:1;">' +
              '<h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:var(--ink);line-height:1.2;letter-spacing:-0.3px;">' + safeHtml(post.metadata.title||'') + '</h3>' +
              '<div style="display:flex;flex-wrap:wrap;gap:10px;">' +
                '<div style="font-size:13px;color:var(--lien);display:flex;align-items:center;gap:4px;font-weight:600;background:rgba(88,86,214,0.08);padding:4px 8px;border-radius:8px;">' + ico('clock', 14, 'currentColor') + ' ' + safeHtml(post.metadata.time||'') + '</div>' +
                '<div style="font-size:13px;color:var(--faint);display:flex;align-items:center;gap:4px;font-weight:600;background:var(--tile);padding:4px 8px;border-radius:8px;">' + ico('pin', 14, 'currentColor') + ' ' + safeHtml(post.metadata.location||'') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          
          (post.caption ? '<p style="font-size:15px;color:var(--ink2);margin:0 0 16px;line-height:1.5;">' + safeHtml(post.caption) + '</p>' : '') +
          
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-top:12px;border-top:1px dashed var(--line);">' +
            '<div style="display:flex;align-items:center;">' +
              '<span style="font-size:12px;color:var(--faint);font-weight:600;">' + participants.length + ' Confirmé(s)</span>' +
              partAvatars +
            '</div>' +
          '</div>' +

          '<div style="display:flex;gap:10px;">' +
            '<button onclick="App.toggleParticipation(\''+jsArg(post.id)+'\',\'yes\')" style="flex:1;padding:12px;border-radius:999px;font-size:15px;font-weight:800;border:none;cursor:pointer;background:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?UI.okPlein:'var(--card)')+';color:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'#FFF':'var(--ink)')+';box-shadow:'+((post.metadata.participations||{})[(S.user||{}).id]==='yes'?'0 4px 12px rgba(52,199,89,0.3)':'0 2px 6px rgba(0,0,0,0.05)')+';transition:all 0.2s;">' + ((post.metadata.participations||{})[(S.user||{}).id]==='yes' ? ico('thumb',14,'#FFF') + ' Confirmé' : ico('thumb',14,'currentColor') + ' Je participe') + '</button>' +
            '<button onclick="App.toggleParticipation(\''+jsArg(post.id)+'\',\'no\')" style="flex:1;padding:12px;border-radius:999px;font-size:15px;font-weight:800;border:none;cursor:pointer;background:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'linear-gradient(135deg,#D92D20,#D92D20)':'var(--card)')+';color:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'#FFF':'var(--ink)')+';box-shadow:'+((post.metadata.participations||{})[(S.user||{}).id]==='no'?'0 4px 12px rgba(255,59,48,0.3)':'0 2px 6px rgba(0,0,0,0.05)')+';transition:all 0.2s;">' + ((post.metadata.participations||{})[(S.user||{}).id]==='no' ? ico('x', 14, 'currentColor') + ' Indisponible' : ico('x', 14, 'currentColor') + ' Non dispo') + '</button>' +
          '</div>' +
        '</div>';
      } else if (post.type === 'EVALUATION' && post.metadata && (post.metadata.evaluations || post.metadata.teamName)) {
         contentZone = renderEvaluationContent(post);
      } else {
         // For standard posts: only the media zone goes in contentZone.
         // The caption is rendered separately in finalHtml below.
         contentZone = mediaZone;
         // For REPOST: override with original content
         if (post.type === 'REPOST') {
           var origMedia = post.originalMediaUrls || [];
           // Toucher le contenu repris ramène à la publication d'origine.
           var goOrig = post.originalPostId
             ? ' onclick="event.stopPropagation();App.goToOriginalPost(\'' + jsArg(post.originalPostId) + '\')" style="cursor:pointer;"'
             : '';
           if (origMedia.length > 0) {
              contentZone = '<div' + goOrig + '>' + origMedia.map(function(url){
                // onerror : même repli « Média indisponible » que les cartes normales.
                return isVideoUrl(url)
                  ? '<video src="' + safeUrl(url) + '"' + (post.originalVideoPoster ? ' poster="'+safeUrl(post.originalVideoPoster)+'"' : '') + ' controls playsinline preload="metadata" onerror="App.mediaEchoue(this)" style="width:100%;display:block;background:#000;"></video>'
                  : '<img src="' + safeUrl(url) + '" onerror="App.mediaEchoue(this)" style="width:100%;display:block;" />';
              }).join('') + '</div>';
           } else if (post.originalPostBg) {
              contentZone = '<div' + (goOrig ? goOrig.replace('style="cursor:pointer;"', '') : '') + ' style="background:' + safeHtml(post.originalPostBg) + ';min-height:200px;display:flex;align-items:center;justify-content:center;padding:30px;' + (goOrig ? 'cursor:pointer;' : '') + '"><p style="color:#FFF;font-size:22px;font-weight:800;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,0.3);margin:0;line-height:1.4;">' + safeHtml(post.originalCaption || '') + '</p></div>';
           }
         }
      }
    // Repost banner
    var repostBanner = '';
    if (post.type === 'REPOST') {
      // Le bandeau lui-même ramène à la publication d'origine : c'est l'endroit
      // que l'on touche naturellement quand on veut « voir l'original ».
      var bannerClick = post.originalPostId
        ? ' onclick="App.goToOriginalPost(\'' + jsArg(post.originalPostId) + '\')" style="padding:12px 16px 0;display:flex;align-items:center;gap:7px;color:' + UI.faint + ';font-size:13px;cursor:pointer;"'
        : ' style="padding:12px 16px 0;display:flex;align-items:center;gap:7px;color:' + UI.faint + ';font-size:13px;"';
      repostBanner = '<div' + bannerClick + '>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + UI.faint + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
        '<span style="min-width:0;">' + safeHtml(post.author || '') + ' a partagé la publication de ' + safeHtml(post.originalAuthor || '') + '</span>' +
        (post.originalPostId ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + UI.faint + '" stroke-width="2.2" style="margin-left:auto;flex-shrink:0;"><path d="M9 18l6-6-6-6"/></svg>' : '') +
      '</div>';
    }
    // Caption text (author + label), shown ABOVE the media — Facebook style
    var captionTextBlock = (!post.postBg && (captionHtml || (post.type === 'REPOST' && post.originalCaption && !post.originalPostBg)))
      ? '<div style="padding:0 16px 12px;">' +
          (post.type === 'REPOST' && post.originalCaption && !post.originalPostBg ? '<p style="font-size:15px;color:' + UI.ink2 + ';margin:0 0 4px;line-height:1.5;"><strong style="font-weight:600;">' + safeHtml(post.originalAuthor || '') + '</strong> ' + safeHtml(post.originalCaption) + '</p>' : '') +
          (captionHtml ? '<p style="font-size:15px;color:' + UI.ink2 + ';margin:0;line-height:1.5;">' + captionHtml + '</p>' : '') +
        '</div>'
      : '';

    // Lien vers les commentaires. L'heure n'est PLUS répétée ici : elle figure
    // déjà dans l'en-tête, à côté de l'auteur (elle apparaissait deux fois).
    var commentsLinkLabel = (post.comments || []).length > 0
      ? 'Voir les ' + (post.comments || []).length + ' commentaire' + ((post.comments || []).length > 1 ? 's' : '')
      : 'Ajouter un commentaire…';
    var metaFooterBlock =
      '<div style="padding:' + (post.postBg ? '2px' : '0') + ' 16px 12px;">' +
        '<button onclick="App.openComments(\'' + jsArg(post.id) + '\')" style="background:none;border:none;padding:0;font-size:13px;color:' + UI.faint + ';cursor:pointer;">' + commentsLinkLabel + '</button>' +
      '</div>';

    // Carte blanche détachée sur le fond gris de l'écran : c'est ce qui donne
    // au fil sa respiration, au lieu de bandes blanches collées bord à bord.
    var finalHtml = '<article id="post-'+post.id+'" data-postid="'+post.id+'" style="background:' + UI.card + ';border-radius:' + UI.r2 + ';box-shadow:' + UI.sh2 + ';margin:0 12px 12px;overflow:hidden;">' +
      repostBanner +
      pinnedBadge +
      (post.is_ephemeral ? '<div style="padding:10px 16px 0;"><span style="display:inline-flex;align-items:center;gap:5px;background:' + UI.tile + ';color:' + UI.muted + ';font-size:11px;padding:3px 9px;border-radius:' + UI.pill + ';">' + ico('clock', 12, UI.muted) + 'Éphémère · disparaît dans ' + (function(){ var h = Math.max(0, Math.round((post.ephemeral_expiry - Date.now()) / 3600000)); return h > 0 ? h + ' h' : 'bientôt'; })() + '</span></div>' : '') +
      // En-tête de la carte
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px 11px;">' +
        (function(){
          var allU = db(SK.USERS, []);
          var pAuthor = allU.find(function(u){ return u.id === post.userId; });
          var pAvatarUrl = (pAuthor && pAuthor.avatar_url) ? pAuthor.avatar_url : post.avatar_url;
          var pColor = couleurSure((pAuthor && pAuthor.avatar_color) ? pAuthor.avatar_color : post.avatarColor);
          var pInitial = (pAuthor && pAuthor.prenom) ? pAuthor.prenom.charAt(0).toUpperCase() : (post.authorAvatar || 'M');
          var pName = (pAuthor && pAuthor.prenom && pAuthor.nom) ? (pAuthor.prenom + ' ' + pAuthor.nom) : (post.author || 'Membre');

          var avatarNode = pAvatarUrl
            ? '<img src="' + safeUrl(pAvatarUrl) + '" style="width:36px;height:36px;border-radius:' + UI.pill + ';object-fit:cover;flex-shrink:0;" />'
            : '<div style="width:36px;height:36px;border-radius:' + UI.pill + ';background:' + pColor + ';color:#FFF;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + pInitial + '</div>';

          return '<div onclick="App.openUserProfile(\'' + jsArg(post.userId) + '\')" style="display:flex;align-items:center;gap:10px;cursor:pointer;min-width:0;">' +
            avatarNode +
            '<div style="min-width:0;">' +
              '<div style="font-size:15px;font-weight:700;letter-spacing:-0.1px;color:' + UI.ink + ';">' + safeHtml(pName) + '</div>';
        })() +
            '<div style="font-size:12px;color:' + UI.faint + ';display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
              '<span style="display:inline-flex;align-items:center;gap:4px;">' + (authorSecObj ? icoPole(authorSecObj.id, 13) : '') + authorSecNom + '</span>' +
              // Le grade doit rester visible à côté du pôle : c'est lui qui dit
              // qui est responsable de quoi dans l'équipe.
              (postAuthorRoleLabel ? '<span>·</span><span>' + postAuthorRoleLabel + '</span>' : '') +
              '<span>·</span><span style="font-family:' + UI.fontMono + ';">' + ago + '</span>' + (post.is_edited ? '<span style="font-style:italic;margin-left:2px;">modifié</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button onclick="App.openOptions(\'' + jsArg(post.id) + '\')" style="background:var(--tile);border:none;width:44px;height:44px;border-radius:12px;margin:-6px -6px -6px 0;cursor:pointer;display:flex;align-items:center;justify-content:center;">' + SVG.dots + '</button>' +
      '</div>' +
      (function(){
        if (!post.aboutEventId) return '';
        var aboutEv = db(SK.POSTS, []).find(function(p){ return p.id === post.aboutEventId && p.type === 'EVENT'; });
        if (!aboutEv) return '';
        var aEvDate = aboutEv.eventDate ? new Date(aboutEv.eventDate + 'T00:00:00') : null;
        var aEvDateStr = aEvDate ? aEvDate.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'}) : '';
        return '<div onclick="App.goToEvent(\''+jsArg(aboutEv.id)+'\')" style="margin:0 14px 10px;padding:10px 12px;background:var(--accent-soft);border-radius:16px;border:1px solid var(--line2);display:flex;align-items:center;gap:10px;cursor:pointer;">' +
          ico('calendar', 18, UI.lien) +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:11px;font-weight:800;color:var(--lien);text-transform:uppercase;letter-spacing:0.5px;">À propos de cet événement</div>' +
            '<div style="font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(aboutEv.eventTitle||'') + (aEvDateStr ? ' · ' + aEvDateStr : '') + (aboutEv.eventStart ? ' à ' + safeHtml(aboutEv.eventStart) : '') + '</div>' +
          '</div>' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B5FE0" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
        '</div>';
      })() +
      renderCheckInBadge(post) +
      captionTextBlock +
      (post.linkPreview ? '<div style="margin:0 16px 12px;">' + renderLinkPreviewCard(post.linkPreview) + '</div>' : '') +
      contentZone +
      renderPollBlock(post) +
      // Actions row
      // Barre d'engagement : icône + compteur sur une seule ligne, séparée du
      // contenu par un filet. Le compteur de j'aime n'a plus sa propre ligne.
      '<div style="display:flex;align-items:center;gap:18px;padding:11px 16px;border-top:0.5px solid ' + UI.line + ';color:' + UI.muted + ';font-size:13px;font-family:' + UI.fontMono + ';">' +
        '<button id="likeBtn-'+post.id+'" onclick="App.like(\''+jsArg(post.id)+'\')" aria-pressed="' + (iLiked ? 'true' : 'false') + '" aria-label="J\'aime · ' + likeCount + '" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;gap:6px;color:inherit;font-size:inherit;transition:transform 0.1s;" onmousedown="this.style.transform=\'scale(0.9)\'" onmouseup="this.style.transform=\'scale(1)\'">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (iLiked ? UI.bad : 'none') + '" stroke="' + (iLiked ? UI.bad : UI.muted) + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          '<span id="likeCount-'+post.id+'" style="color:' + (iLiked ? UI.bad : UI.muted) + ';">' + likeCount + '</span>' +
        '</button>' +
        '<button onclick="App.openComments(\''+jsArg(post.id)+'\')" aria-label="Commentaires · ' + (post.comments || []).length + '" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;gap:6px;color:inherit;font-size:inherit;">' +
          ico('message', 18, UI.muted) + '<span>' + (post.comments || []).length + '</span>' +
        '</button>' +
        '<button onclick="App.openRepostModal(\''+jsArg(post.id)+'\')" aria-label="Repartager" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;color:inherit;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
        '</button>' +
        '<button onclick="App.openViewers(\''+jsArg(post.id)+'\')" title="Vues" aria-label="Vues · ' + viewCount + '" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;gap:6px;color:inherit;font-size:inherit;">' +
          ico('eye', 18, UI.muted) + '<span id="viewCount-'+post.id+'">' + viewCount + '</span>' +
        '</button>' +
        '<button id="saveBtn-'+post.id+'" onclick="App.save(\''+jsArg(post.id)+'\')" aria-pressed="' + (iSaved ? 'true' : 'false') + '" aria-label="Enregistrer" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;margin-left:auto;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (iSaved ? UI.ink : 'none') + '" stroke="' + (iSaved ? UI.ink : UI.muted) + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
        '</button>' +
      '</div>' +

      metaFooterBlock +

    '</article>';
    return finalHtml;
  }
