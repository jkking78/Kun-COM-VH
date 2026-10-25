// KUN COM VH — Partie 7e : App controller — Commentaires, carrousels, classement de ponctualité et bilans d'événement (window.App)

  'use strict';
  Object.assign(App, {

    // Comments
    openComments: function(postId) {
      S.commentPostId=postId; S.commentOpen=true; S.pendingCommentImage=null; S.replyingToCommentId=null; S.replyingToAuthor=null; render();
      window.setTimeout(function(){ var i=document.getElementById('commentInput'); if(i) i.focus(); },150);
    },
    closeComments: function() { S.commentOpen=false; S.commentPostId=null; S.pendingCommentImage=null; S.replyingToCommentId=null; S.replyingToAuthor=null; render(); },
    addEmoji: function(e) { var i=document.getElementById('commentInput'); if(i){i.value+=e;i.focus();} },
    addCommentImage: function(e) {
      var file = (e.target && e.target.files && e.target.files[0]) || null;
      if (!file) return;
      compressImage(file, 800, 800, 0.7, function(dataUrl) {
        S.pendingCommentImage = dataUrl;
        // L'image part dans Storage : le commentaire n'en garde que l'adresse.
        uploadMediaToStorage(dataUrl, function(url) {
          if (url && S.pendingCommentImage === dataUrl) S.pendingCommentImage = url;
        });
        var prev = document.getElementById('commentImagePreview');
        if (prev) {
          prev.style.padding = '10px 14px 0';
          prev.innerHTML = '<div style="position:relative;display:inline-block;">' +
            '<img src="'+safeUrl(dataUrl)+'" style="width:64px;height:64px;object-fit:cover;border-radius:12px;border:1px solid var(--line);">' +
            '<button type="button" onclick="App.removeCommentImage()" style="position:absolute;top:-6px;right:-6px;background:rgba(0,0,0,0.7);border:none;border-radius:8px;width:32px;height:32px;color:#FFF;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>' +
          '</div>';
        } else {
          render();
        }
      });
    },
    removeCommentImage: function() {
      S.pendingCommentImage = null;
      var prev = document.getElementById('commentImagePreview');
      if (prev) { prev.style.padding = '0'; prev.innerHTML = ''; } else { render(); }
    },
    onCommentInput: function(val) {
      var match = val.match(/@([\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]*)$/);
      var box = document.getElementById('commentMentionSugg');
      if (match && box) {
        var htmlC = App.buildMentionSuggestions(match[1], 'insertCommentMention');
        box.innerHTML = htmlC;
        box.style.display = htmlC ? 'flex' : 'none';
      } else if (box) {
        box.style.display = 'none';
      }
    },
    insertCommentMention: function(mention) {
      var input = document.getElementById('commentInput');
      if (!input) return;
      var val = input.value;
      input.value = val.replace(/@[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]*$/, mention);
      var box = document.getElementById('commentMentionSugg');
      if (box) box.style.display = 'none';
      input.focus();
    },
    // Réponse directe à un commentaire (fil imbriqué, 1 niveau)
    replyToComment: function(commentId, authorName) {
      S.replyingToCommentId = commentId;
      S.replyingToAuthor = authorName;
      var banner = document.getElementById('replyingToBanner');
      if (banner) {
        banner.style.display = 'flex';
        var b = banner.querySelector('b');
        if (b) b.textContent = authorName;
      }
      var input = document.getElementById('commentInput');
      if (input) { input.placeholder = 'Répondre à ' + authorName + '…'; input.focus(); }
    },
    cancelReply: function() {
      S.replyingToCommentId = null;
      S.replyingToAuthor = null;
      var banner = document.getElementById('replyingToBanner');
      if (banner) banner.style.display = 'none';
      var input = document.getElementById('commentInput');
      if (input) input.placeholder = 'Ajouter un commentaire… (@ pour taguer)';
    },
    submitComment: function(ev) {
      ev && ev.preventDefault();
      var input = document.getElementById('commentInput');
      var txt = input ? input.value.trim() : '';
      if ((!txt && !S.pendingCommentImage) || !S.user || !S.commentPostId) return;
      // Image encore en cours d'envoi : on attend, puis on reprend.
      if (S.pendingCommentImage && S.pendingCommentImage.indexOf('data:') === 0) {
        if (mediaUploadsPending()) { waitForMediaUploads(null).then(function(){ App.submitComment(); }); return; }
        toast('L\'image n\'a pas pu être envoyée. Vérifie ta connexion et réessaie.', 'error');
        return;
      }
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===S.commentPostId; });
      if (!post) return;
      if (!Array.isArray(post.comments)) post.comments = [];
      var parentId = S.replyingToCommentId || null;
      var parentComment = parentId ? post.comments.find(function(c){ return c.id === parentId; }) : null;
      var newC = { id:'c'+Date.now(), userId:S.user.id, author:(S.user.prenom||'User')+' '+(S.user.nom?S.user.nom.charAt(0):'')+'.', avatarColor:S.user.avatar_color||'#0B5FE0', text:txt, imageUrl:S.pendingCommentImage||null, timestamp:Date.now(), parentId: parentId };
      post.comments.push(newC); dbSet(SK.POSTS, posts);
      // Affichage optimiste, puis écriture serveur via relecture fraîche : on
      // ajoute NOTRE commentaire à la version du serveur au lieu de réécrire la
      // version locale (qui aurait effacé les commentaires arrivés entre-temps).
      App.ecrirePostFrais(post.id, function(frais) {
        if (!Array.isArray(frais.comments)) frais.comments = [];
        if (!frais.comments.some(function(c){ return c.id === newC.id; })) frais.comments.push(newC);
      });
      if (parentComment && parentComment.userId && parentComment.userId !== S.user.id) {
        sendNotificationToUser(parentComment.userId, {
          type: 'REPLY',
          title: 'Nouvelle réponse',
          text: S.user.prenom + ' a répondu à ton commentaire : "' + (txt ? txt.slice(0, 40) : 'Photo') + '"',
          targetId: post.id,
          // Sans cet identifiant, on retombait sur la publication et il fallait
          // retrouver soi-même le commentaire concerné dans toute la discussion.
          commentId: newC.id
        });
      } else if (!parentComment && post.userId && post.userId !== S.user.id) {
        sendNotificationToUser(post.userId, {
          type: 'COMMENT',
          title: 'Nouveau commentaire',
          text: S.user.prenom + ' : "' + (txt ? txt.slice(0, 40) : 'Photo') + '"',
          targetId: post.id,
          commentId: newC.id
        });
      }
      notifyMentionedUsers(txt, post.id, newC.id);
      updateUserActivity('Commentaire');
      // DOM update: insère dans le fil racine ou dans le conteneur de réponses du parent
      if (parentId) {
        var repliesContainer = document.getElementById('replies-' + parentId);
        if (repliesContainer) {
          var rdiv = document.createElement('div');
          rdiv.style.cssText = 'animation:fadeIn 0.3s;';
          rdiv.innerHTML = renderCommentItem(newC, true);
          repliesContainer.appendChild(rdiv);
        } else { render(); }
      } else {
        var list = document.getElementById('commentsList');
        if (list) {
          var div = document.createElement('div');
          div.style.cssText = 'animation:fadeIn 0.3s;';
          div.innerHTML = renderCommentItem(newC, false) + '<div id="replies-' + newC.id + '" style="margin-left:44px;"></div>';
          list.appendChild(div);
        } else { render(); }
      }
      // Update comment count on post card (outside modal)
      var ccBtn = document.querySelector('#post-'+S.commentPostId+' button[onclick*="openComments"]');
      if (ccBtn && ccBtn.textContent.indexOf('commentaire') !== -1) {
        ccBtn.textContent = 'Voir les ' + post.comments.length + ' commentaire' + (post.comments.length>1?'s':'');
      }
      if (input) input.value = '';
      App.removeCommentImage();
      App.cancelReply();
      toast(parentId ? 'Réponse ajoutée !' : 'Commentaire ajouté !', 'success');
    },
    likeComment: function(cId) {
      var likedComments = db(SK.LIKED_COMMENTS, {});
      likedComments[cId] = !likedComments[cId]; dbSet(SK.LIKED_COMMENTS, likedComments);
      var el = document.getElementById('clike-'+cId);
      if (el) el.innerHTML = SVG.heart(likedComments[cId], 15);
    },

    // Supprime un commentaire (ou une réponse). Réservé à son auteur, à l'auteur
    // de la publication, ou au Admin — même logique de permission que
    // App.deletePost. Un commentaire racine supprimé emporte ses réponses avec
    // lui : les laisser flotter sans parent créerait une discussion incompréhensible.
    deleteComment: function(postId, commentId) {
      var u = S.user || {};
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id === postId; });
      if (!post || !Array.isArray(post.comments)) return;
      var c = post.comments.find(function(x){ return x.id === commentId; });
      if (!c) return;
      var canDelete = u.role === 'GRAND_RESPONSABLE' || c.userId === u.id || post.userId === u.id;
      if (!canDelete) { toast('Action non autorisée.', 'error'); return; }
      var retire = function(x){ return x.id !== commentId && x.parentId !== commentId; };
      post.comments = post.comments.filter(retire);
      dbSet(SK.POSTS, posts);
      // Le serveur ne déduit JAMAIS une suppression de l'absence d'un commentaire
      // (une copie locale périmée en manque toujours) : elle se demande
      // explicitement, et il vérifie le droit de la faire (migration 06).
      if (supabase) {
        App.ecrirePostFrais(post.id, function(f) {
          f.comments = (f.comments || []).filter(retire);
          f._supprimerCommentaires = [commentId];
        }, function(retenu) { if (retenu) delete retenu._supprimerCommentaires; });
      }
      render();
      toast('Commentaire supprimé.', 'success');
    },

    // Glissement tactile vers la gauche pour révéler le bouton Supprimer d'un
    // commentaire (comme Mail/Messages iOS). État transitoire porté directement
    // par le nœud DOM (pas par S) : un simple geste n'a pas besoin de déclencher
    // de rendu, et un rendu déclenché entre-temps par autre chose (nouveau
    // commentaire reçu en temps réel...) ne doit pas interrompre le geste en cours.
    _commentSwipe: {},
    commentSwipeStart: function(e) {
      var t = e.touches && e.touches[0]; if (!t) return;
      App._commentSwipe = { el: e.currentTarget, startX: t.clientX, startY: t.clientY, dx: 0, decided: false, horizontal: false };
      e.currentTarget.style.transition = 'none';
    },
    commentSwipeMove: function(e) {
      var st = App._commentSwipe;
      if (!st || !st.el) return;
      var t = e.touches && e.touches[0]; if (!t) return;
      var dx = t.clientX - st.startX;
      var dy = t.clientY - st.startY;
      if (!st.decided) {
        // Sous 6 px, on ne sait pas encore si le doigt part à l'horizontale (pour
        // révéler « Supprimer ») ou à la verticale (pour faire défiler la liste) —
        // trancher trop tôt bloquerait le scroll normal à chaque frôlement.
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        st.decided = true;
        st.horizontal = Math.abs(dx) > Math.abs(dy);
        if (!st.horizontal) { App._commentSwipe = {}; return; }
      }
      if (!st.horizontal) return;
      if (e.cancelable) e.preventDefault();
      var base = st.el._swipeOpen ? -76 : 0;
      var next = base + dx;
      if (next > 0) next = 0;
      if (next < -96) next = -96;
      st.dx = next;
      st.el.style.transform = 'translateX(' + next + 'px)';
    },
    commentSwipeEnd: function() {
      var st = App._commentSwipe;
      if (!st || !st.el) { App._commentSwipe = {}; return; }
      st.el.style.transition = 'transform 0.18s ease-out';
      var open = st.dx < -40;
      st.el.style.transform = open ? 'translateX(-76px)' : 'translateX(0)';
      st.el._swipeOpen = open;
      App._commentSwipe = {};
    },
    carScroll: function(postId, el) {
      var w = el.clientWidth; if (!w) return;
      var idx = Math.round(el.scrollLeft / w);
      if (S.carouselIdx[postId] === idx) return;
      S.carouselIdx[postId] = idx;
      var badge = document.getElementById('badge-'+postId);
      var posts = db(SK.POSTS, []);
      var post = posts.find(function(p){ return p.id===postId; });
      if (badge && post) badge.textContent = (idx+1)+'/'+post.mediaUrls.length;
      var dots = document.getElementById('dots-'+postId);
      if (dots && post) {
        dots.innerHTML = post.mediaUrls.map(function(_,di){
          var a=di===idx; return '<div style="width:'+(a?'18':'6')+'px;height:6px;border-radius:3px;background:'+(a?'#0B5FE0':'var(--line)')+';transition:all 0.25s;"></div>';
        }).join('');
      }
    },

    // Défilement du carrousel d'une publication d'évaluation (une section par vue).
    evalCarScroll: function(postId, el) {
      var w = el.clientWidth; if (!w) return;
      var idx = Math.round(el.scrollLeft / w);
      if (!S.evalCarouselIdx) S.evalCarouselIdx = {};
      if (S.evalCarouselIdx[postId] === idx) return;
      S.evalCarouselIdx[postId] = idx;
      var total = el.children ? el.children.length : 0;
      var badge = document.getElementById('evalBadge-' + postId);
      if (badge && total) badge.textContent = (idx + 1) + '/' + total;
      var dots = document.getElementById('evalDots-' + postId);
      if (dots && total) {
        var html = '';
        for (var i = 0; i < total; i++) {
          var a = i === idx;
          html += '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B5FE0':'var(--line)') + ';transition:all 0.25s;"></div>';
        }
        dots.innerHTML = html;
      }
    },

    // Défilement d'un carrousel d'événements d'une même journée. Met à jour le
    // compteur et les pastilles directement dans le DOM (pas de render() global,
    // qui interromprait le défilement en cours).
    eventGroupScroll: function(dateIso, carId, el) {
      // Largeur d'un volet (pas du conteneur) : les volets d'une série laissent
      // dépasser le suivant, et sont séparés d'un espace.
      var premier = el.children && el.children[0];
      var w = premier ? premier.offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0) : el.clientWidth;
      if (!w) return;
      var idx = Math.round(el.scrollLeft / w);
      // Une série a été parcourue : l'indication « glisse » n'est plus utile.
      if (idx > 0 && carId.indexOf('evserie-') === 0) { try { localStorage.setItem('kc_glisse_vu', '1'); } catch(e) {} }
      if (!S.eventGroupIdx) S.eventGroupIdx = {};
      if (S.eventGroupIdx[dateIso] === idx) return;
      S.eventGroupIdx[dateIso] = idx;
      var total = el.children ? el.children.length : 0;
      var badge = document.getElementById('evgrpBadge-' + carId);
      if (badge && total) badge.textContent = (idx + 1) + '/' + total;
      var dots = document.getElementById('evgrpDots-' + carId);
      if (dots && total) {
        var html = '';
        for (var i = 0; i < total; i++) {
          var a = i === idx;
          html += '<div style="width:' + (a?'18':'6') + 'px;height:6px;border-radius:3px;background:' + (a?'#0B5FE0':'var(--line)') + ';transition:all 0.25s;"></div>';
        }
        dots.innerHTML = html;
      }
      // Le volet affiché change : la hauteur du carrousel le suit.
      App.recalerCarrousels();
    },

    // Debrief
    // ---- Onglet Notation : bascule saisie / suivi ----
    // 'noter' reste réservé aux Grands Responsables : un membre qui forcerait
    // cet appel (ou un vieux bouton en cache) retombe sur le Suivi, jamais un
    // formulaire de notation auquel il n'a pas droit.
    setDebriefView: function(v) {
      if (v === 'noter' && !(S.user && isGrandResponsable(S.user))) v = 'suivi';
      S.debriefView = v;
      render();
    },
    setScoreboardPeriod: function(all) { S.scoreboardAll = !!all; render(); },
    toggleScoreboardSection: function(secId) {
      S.scoreboardOpen = (S.scoreboardOpen === secId) ? null : secId;
      render();
    },
    // Ouvre un bilan précis dans le fil, plutôt que de le chercher à la main.
    // Navigation générique vers une publication du fil : remet le fil à zéro
    // (recherche et filtre par pôle effacés, sinon la cible resterait masquée),
    // fait défiler jusqu'à elle et la met brièvement en évidence pour qu'on la
    // repère au milieu des autres. Utilisée par les bilans du tableau de bord et
    // par les partages, qui doivent ramener à la publication d'origine.
    goToPost: function(postId, labelIntrouvable) {
      var post = db(SK.POSTS, []).find(function(p){ return p.id === postId; });
      if (!post) { toast(labelIntrouvable || 'Cette publication n\'existe plus.', 'error'); return; }
      S.tab = 'home';
      S.q = '';
      S.story = 'all';
      S.createOpen = false; S.commentOpen = false; S.optionsOpen = false;
      S.viewUserProfileId = null;
      render();
      setTimeout(function() {
        var el = document.getElementById('post-' + postId);
        if (!el) { toast('Cette publication n\'est plus dans le fil chargé.', 'info'); return; }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Halo temporaire : sans repère visuel, on ne sait pas laquelle des
        // cartes à l'écran est celle qu'on cherchait.
        el.style.transition = 'box-shadow 0.35s ease';
        el.style.boxShadow = '0 0 0 2px ' + UI.accent;
        window.setTimeout(function(){ el.style.boxShadow = 'none'; }, 1600);
      }, 120);
    },
    openBilan: function(postId) { this.goToPost(postId, 'Ce bilan n\'existe plus.'); },
    // Depuis un partage, on revient à la publication d'origine.
    goToOriginalPost: function(postId) { this.goToPost(postId, 'La publication d\'origine a été supprimée.'); },

    // Déplie/replie une section dans l'écran Notation (une seule à la fois).
    // Les Grands Responsables peuvent noter toutes les sections, y compris la leur.
    toggleEvalSection: function(secId) {
      S.evalExpandedSection = (S.evalExpandedSection === secId) ? null : secId;
      render();
    },
    // Note un critère précis d'une section. Chaque critère est indépendant ;
    // la note globale affichée est leur moyenne, recalculée immédiatement dans le
    // DOM (auparavant le compteur de droite n'était rafraîchi qu'au rendu suivant,
    // d'où l'impression de latence).
    rateCriterion: function(secId, critId, score) {
      if (!S.ratings[secId]) S.ratings[secId] = { criteria:{}, comment:'' };
      if (!S.ratings[secId].criteria) S.ratings[secId].criteria = {};
      S.ratings[secId].criteria[critId] = score;

      var starsEl = document.getElementById('critstars-' + secId + '-' + critId);
      if (starsEl) {
        starsEl.innerHTML = [1,2,3,4,5].map(function(s) {
          return '<button type="button" onclick="App.rateCriterion(\'' + jsArg(secId) + '\',\'' + jsArg(critId) + '\',' + s + ')" style="font-size:28px;cursor:pointer;background:none;border:none;padding:0;line-height:1;color:' + (s<=score?'#FFD700':'var(--line)') + ';">★</button>';
        }).join('');
      }
      var valEl = document.getElementById('critval-' + secId + '-' + critId);
      if (valEl) { valEl.textContent = score + '/5'; valEl.style.color = '#0B0D12'; }

      var crit = S.ratings[secId].criteria;
      // La note de tête inclut la ponctualité automatique, comme au rendu.
      var vals = EVAL_CRITERIA.map(function(c){ return crit[c.id] || 0; }).filter(function(v){ return v > 0; });
      var punc = S.evalEventId ? sectionPunctuality(secId, S.evalEventId) : null;
      if (punc) vals.push(punc.average);
      var avg = vals.length ? Math.round((vals.reduce(function(a,b){ return a+b; }, 0) / vals.length) * 10) / 10 : 0;
      var avgEl = document.getElementById('evalavg-' + secId);
      if (avgEl) {
        avgEl.textContent = avg > 0 ? avg + '/5' : '—';
        avgEl.style.color = avg >= 4 ? '#0E9F6E' : avg >= 2 ? '#D98A0B' : avg > 0 ? '#D92D20' : 'var(--line)';
      }
      var subEl = document.getElementById('evalsub-' + secId);
      if (subEl) {
        var n = EVAL_CRITERIA.filter(function(c){ return (crit[c.id]||0) > 0; }).length;
        subEl.textContent = n + '/' + EVAL_CRITERIA.length + ' critères notés';
      }
    },
    rateComment: function(secId, val) {
      if (!S.ratings[secId]) S.ratings[secId] = { criteria:{}, comment:'' };
      S.ratings[secId].comment = val;
    },
    // Publie UNE seule publication regroupant toutes les sections évaluées
    // (auparavant : une publication séparée par section, ce qui noyait le fil).
    // Les sections s'y consultent sous forme de carrousel.
    publishBilan: function() {
      if (!S.user) return;
      var eventSelect = document.getElementById('evalEventSelect');
      var eventId = S.evalEventId || (eventSelect ? eventSelect.value : '');
      if (!eventId) {
        toast("Choisis l'événement à évaluer.", 'error');
        return;
      }
      var posts = db(SK.POSTS, []);
      var selectedEv = posts.find(function(p){ return p.id === eventId; });
      if (selectedEv && !isEventPast(selectedEv)) {
        toast('Cet événement n\'est pas encore terminé : tu pourras le noter après.', 'error');
        return;
      }
      var eventTitle = selectedEv ? (selectedEv.eventTitle || (selectedEv.metadata && selectedEv.metadata.title) || 'Événement') : 'Événement';

      var allUsers = db(SK.USERS, []);
      var evaluations = [];
      SECTIONS.forEach(function(sec) {
        var r = S.ratings[sec.id];
        if (!r) return;
        if (!r.criteria) r.criteria = {};
        var manualAvg = ratingAverage(r.criteria);
        // Ponctualité calculée automatiquement à partir des heures d'arrivée des
        // membres du pôle assignés à cet événement (aucune saisie manuelle).
        var punc = sectionPunctuality(sec.id, eventId, posts, allUsers);
        // Une section n'apparaît dans le bilan que si elle a été notée à la main
        // OU si elle avait des membres assignés (ponctualité automatique).
        if (manualAvg <= 0 && !punc) return;

        // Critères libellés en clair pour l'affichage, dans l'ordre défini.
        var crit = {};
        if (punc) crit['Ponctualité'] = punc.average;
        EVAL_CRITERIA.forEach(function(c) {
          var v = r.criteria[c.id] || 0;
          if (v > 0) crit[c.nom] = v;
        });

        // Note globale = moyenne de TOUS les critères retenus, ponctualité incluse.
        var vals = Object.keys(crit).map(function(k){ return crit[k]; });
        var globalScore = vals.length
          ? Math.round((vals.reduce(function(a,b){ return a+b; }, 0) / vals.length) * 10) / 10
          : 0;

        evaluations.push({
          teamId: sec.id,
          teamName: sec.nom,
          emoji: sec.emoji,
          color: sec.color,
          globalScore: globalScore,
          criteria: crit,
          punctuality: punc || null,
          comment: r.comment || ''
        });
      });

      if (evaluations.length === 0) {
        toast('Note au moins un critère dans un pôle.', 'error');
        return;
      }

      var ts = Date.now();
      var metadata = {
        eventId: eventId,
        eventTitle: eventTitle,
        evaluations: evaluations,
        // Champs conservés pour compatibilité avec l'ancien format à une seule
        // section (profils, statistiques, publications déjà en base).
        teamName: evaluations[0].teamName,
        globalScore: evaluations[0].globalScore,
        criteria: evaluations[0].criteria
      };
      var caption = evaluations.length > 1
        ? 'Bilan de ' + evaluations.length + ' pôles — ' + eventTitle
        : ("Évaluation de l'équipe " + evaluations[0].teamName);

      // Un même responsable ne crée qu'UN bilan par événement : s'il en existe
      // déjà un de sa part, on le met à jour au lieu d'en empiler un second.
      var existing = findOwnBilan(eventId);
      var savedPost;
      if (existing) {
        existing.metadata = metadata;
        existing.caption = caption;
        existing.updatedAt = ts;
        savedPost = existing;
      } else {
        savedPost = {
          id: 'eval-' + ts, userId: S.user.id, timestamp: ts,
          author: S.user.prenom + ' ' + S.user.nom,
          authorAvatar: S.user.prenom.charAt(0).toUpperCase(),
          avatarColor: S.user.avatar_color || '#0B5FE0',
          avatar_url: avatarLeger(S.user.avatar_url),   // photo hébergée seulement, jamais de base64 recopié
          sectionId: S.user.section_id || 'general', sectionNom: secNom(S.user.section_id || 'general'),
          type: 'EVALUATION',
          metadata: metadata,
          caption: caption,
          mediaUrls: [], likes: 0, likedBy: [], comments: []
        };
        posts.unshift(savedPost);
      }
      dbSet(SK.POSTS, posts);
      if (supabase) supabase.from('kun_com_posts').upsert({ id: savedPost.id, content: savedPost, created_at: new Date(savedPost.timestamp).toISOString() }, { onConflict: 'id' }).then(function(){}, function(e){ console.warn('Erreur publication bilan:', e); });

      // Réinitialise proprement l'écran de notation
      S.ratings = {};
      SECTIONS.forEach(function(sec){ S.ratings[sec.id] = { criteria:{}, comment:'' }; });
      S.evalEventId = null;
      S.evalExpandedSection = null;
      S.tab = 'home';
      S.q = '';
      render();
      setTimeout(function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
      toast(existing ? 'Bilan mis à jour.' : 'Bilan publié.', 'success');
    },

    // Changement d'événement dans l'écran Notation : si un bilan a déjà été publié
    // par cet utilisateur pour cet événement, on repré-remplit le formulaire avec
    // ses notes pour qu'il les corrige plutôt que de repartir de zéro.
    selectEvalEvent: function(eventId) {
      S.evalEventId = eventId;
      S.ratings = {};
      SECTIONS.forEach(function(sec){ S.ratings[sec.id] = { criteria:{}, comment:'' }; });
      S.evalExpandedSection = null;
      var existing = eventId ? findOwnBilan(eventId) : null;
      if (existing && existing.metadata && Array.isArray(existing.metadata.evaluations)) {
        existing.metadata.evaluations.forEach(function(ev) {
          var secId = ev.teamId;
          if (!secId) {
            var found = SECTIONS.find(function(s){ return s.nom === ev.teamName; });
            secId = found ? found.id : null;
          }
          if (!secId) return;
          var crit = {};
          EVAL_CRITERIA.forEach(function(c) {
            var v = (ev.criteria || {})[c.nom];
            if (v > 0) crit[c.id] = v;
          });
          S.ratings[secId] = { criteria: crit, comment: ev.comment || '' };
        });
        toast('Bilan existant chargé : tes modifications le mettront à jour.', 'info');
      }
      render();
    }
  });

  // Retour du réseau : on rejoue les écritures restées en file d'attente
  // (publications, suppressions, commentaires... créés hors connexion).
  window.addEventListener('online', function() {
    try { App.viderFileAttenteEcriture(); } catch(e) {}
  });

