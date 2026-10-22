// KUN COM VH — Partie 6a : Options, commentaires, convocations, échanges, plan de préparation, assignations

  'use strict';
  // ============================================================
  // OPTIONS MODAL
  // ============================================================
  function renderOptionsModal() {
    var post = S.optionsPost;
    if (!post) return '';
    var u = S.user || {};
    var canDelete = u.role === 'GRAND_RESPONSABLE' || post.userId === u.id;
    var isEventPost = post.type === 'EVENT' && !!post.eventTitle;
    // Un responsable de pôle peut assigner son équipe sur un événement créé par
    // quelqu'un d'autre, sans pour autant pouvoir modifier l'événement.
    var canAssignHere = isEventPost && canManageEventAssignments(post, u);

    return '<div onclick="App.closeOptions()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;padding:12px 16px 24px;animation:slideUp 0.25s;">' +
        '<div style="display:flex;justify-content:center;margin-bottom:16px;"><div style="width:40px;height:4px;background:var(--line);border-radius:2px;"></div></div>' +
        '<p style="text-align:center;font-size:12px;color:var(--faint);margin:0 0 14px;font-weight:600;">' + safeHtml(post.author||'Publication') + '</p>' +

        // Share
        '<button onclick="App.shareExternal(\''+jsArg(post.id)+'\');App.closeOptions();" style="width:100%;background:var(--tile);border:none;border-radius:999px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.share + '<span style="font-size:15px;font-weight:600;color:var(--ink);">Partager</span>' +
        '</button>' +

        // Copier le lien (utilisable sur WhatsApp etc., avec aperçu miniature)
        '<button onclick="App.copyPostLink(\''+jsArg(post.id)+'\');App.closeOptions();" style="width:100%;background:var(--tile);border:none;border-radius:999px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.link + '<span style="font-size:15px;font-weight:600;color:var(--ink);">Copier le lien</span>' +
        '</button>' +

        // Save / Unsave
        '<button onclick="App.save(\''+jsArg(post.id)+'\');App.closeOptions();" style="width:100%;background:var(--tile);border:none;border-radius:999px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.bookmark(S.savedPosts[post.id]) +
          '<span style="font-size:15px;font-weight:600;color:var(--ink);">' + (S.savedPosts[post.id] ? 'Retirer des favoris' : 'Enregistrer') + '</span>' +
        '</button>' +

        // Épingler / désépingler. Jusqu'ici App.togglePin existait mais n'était
        // appelée nulle part : l'épingle ne pouvait se retirer qu'en rouvrant le
        // formulaire de l'événement. Réservé au créateur et au Admin.
        (canDelete
          ? (function(){
              var estEpingle = !!post.is_pinned;
              var perime = isEventLike(post) && isEventPast(post) && estEpingle;
              return '<button onclick="App.togglePin(\''+jsArg(post.id)+'\')" style="width:100%;background:' + UI.tile + ';border:none;border-radius:999px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
                ico('pinned', 20, estEpingle ? UI.bad : UI.ink) +
                '<span style="min-width:0;">' +
                  '<span style="display:block;font-size:15px;font-weight:600;color:' + (estEpingle ? UI.bad : UI.ink) + ';">' + (estEpingle ? 'Retirer l\'épingle' : 'Épingler en haut du fil') + '</span>' +
                  (perime ? '<span style="display:block;font-size:12px;color:' + UI.faint + ';margin-top:1px;">Événement terminé : l\'épingle est déjà sans effet</span>' : '') +
                '</span>' +
              '</button>';
            })()
          : '') +

        (canAssignHere
          ? '<button onclick="App.openAssignManager(\''+jsArg(post.id)+'\')" style="width:100%;background:var(--accent-soft);border:1px solid var(--line2);border-radius:999px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5FE0" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
              '<span style="font-size:15px;font-weight:700;color:var(--lien);">Assigner mon équipe</span>' +
            '</button>'
          : '') +

        (canDelete
          // Un événement s'édite avec le formulaire événement (date, horaires, lieu,
          // pôles, assignations, image), pas avec l'éditeur de publication générique.
          ? '<button onclick="' + (isEventPost ? 'App.openEditEvent(\''+jsArg(post.id)+'\')' : 'App.openEditPost(\''+jsArg(post.id)+'\');App.closeOptions();') + '" style="width:100%;background:var(--tile);border:none;border-radius:999px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5FE0" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
              '<span style="font-size:15px;font-weight:600;color:var(--ink);">' + (isEventPost ? 'Modifier l\'événement' : 'Modifier la publication') + '</span>' +
            '</button>' +
            '<button onclick="App.deletePost(\''+jsArg(post.id)+'\')" style="width:100%;background:var(--bad-soft);border:1px solid var(--bad-line);border-radius:999px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              SVG.trash + '<span style="font-size:15px;font-weight:700;color:#D92D20;">Supprimer</span>' +
            '</button>'
          : '') +

        '<button onclick="App.closeOptions()" style="width:100%;background:var(--tile);border:none;border-radius:999px;padding:14px;font-size:15px;font-weight:700;color:var(--lien);cursor:pointer;">Annuler</button>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // COMMENTS MODAL — Bottom Sheet
  // ============================================================
  function renderCommentsModal(allPosts, userInitial) {
    var post = allPosts.find(function(p){ return p.id === S.commentPostId; });
    if (!post) return '';
    var u = S.user || {};

    // Un commentaire est supprimable par son auteur, par l'auteur de la
    // publication (canManagePost), ou par le Admin.
    var canManagePost = u.role === 'GRAND_RESPONSABLE' || post.userId === u.id;
    var commentItems = (post.comments || []).length > 0
      ? renderCommentsList(post.comments, post.id, canManagePost)
      : '<div style="display:flex;flex-direction:column;align-items:center;padding:44px 20px;text-align:center;"><div style="margin-bottom:10px;display:flex;justify-content:center;">' + ico('message', 40, UI.faint, 1.6) + '</div><strong style="font-size:15px;color:var(--ink);">Aucun commentaire</strong><p style="font-size:13px;color:var(--faint);margin:4px 0 0;">Sois le premier à commenter.</p></div>';

    var emojis = ['❤️','👏','🔥','🙌','😍','😂','😮','💪'];

    return '<div onclick="App.closeComments()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;height:82vh;display:flex;flex-direction:column;animation:slideUp 0.3s;">' +

        '<div onclick="App.closeComments()" style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;">' +
          '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;"></div>' +
        '</div>' +

        '<div style="text-align:center;padding-bottom:12px;border-bottom:0.5px solid var(--tile);">' +
          '<h3 style="font-size:15px;font-weight:800;margin:0;color:var(--ink);">Commentaires</h3>' +
          ((post.comments || []).length > 0 ? '<p style="font-size:12px;color:var(--faint);margin:2px 0 0;">'+(post.comments || []).length+' commentaire'+((post.comments || []).length>1?'s':'')+'</p>' : '') +
        '</div>' +

        '<div id="commentsList" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 14px;">' +
          commentItems +
        '</div>' +

        '<div style="border-top:0.5px solid var(--tile);">' +
          '<div id="replyingToBanner" style="display:' + (S.replyingToCommentId ? 'flex' : 'none') + ';align-items:center;justify-content:space-between;background:var(--accent-soft);padding:7px 14px;font-size:13px;color:var(--lien);border-top:1px solid var(--line2);">' +
            '<span>Réponse à <b>' + safeHtml(S.replyingToAuthor||'') + '</b></span>' +
            '<button type="button" onclick="App.cancelReply()" style="background:none;border:none;color:var(--lien);font-size:13px;font-weight:800;cursor:pointer;padding:2px 6px;">✕</button>' +
          '</div>' +
          '<div id="commentMentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:var(--accent-soft);border-top:1px solid var(--line2);padding:8px 14px;"></div>' +
          '<div id="commentImagePreview" style="padding:' + (S.pendingCommentImage ? '10px 14px 0' : '0') + ';">' +
            (S.pendingCommentImage
              ? '<div style="position:relative;display:inline-block;">' +
                  '<img src="'+safeUrl(S.pendingCommentImage)+'" style="width:64px;height:64px;object-fit:cover;border-radius:12px;border:1px solid var(--line);">' +
                  '<button type="button" onclick="App.removeCommentImage()" aria-label="Retirer l\'image" style="position:absolute;top:-8px;right:-8px;background:rgba(0,0,0,0.7);border:none;border-radius:50%;width:44px;height:44px;touch-action:manipulation;color:#FFF;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>' +
                '</div>'
              : '') +
          '</div>' +
          // Emojis rapides : boutons de 44×44 minimum (cible tactile), l'emoji
          // garde sa taille d'origine.
          '<div style="display:flex;justify-content:space-around;padding:8px 2px;border-bottom:0.5px solid var(--tile);">' +
            emojis.map(function(e) {
              return '<button type="button" onclick="App.addEmoji(\''+jsArg(e)+'\')" style="flex:1 1 auto;min-width:44px;min-height:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;background:none;border:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent;">'+e+'</button>';
            }).join('') +
          '</div>' +
          '<form onsubmit="event.preventDefault(); App.submitComment(event);" style="display:flex;align-items:center;gap:8px;padding:10px 14px;">' +
            (u.avatar_url ? '<img src="' + safeUrl(u.avatar_url) + '" style="width:34px;height:34px;border-radius:16px;object-fit:cover;flex-shrink:0;" />' : '<div style="width:34px;height:34px;border-radius:16px;background:' + couleurSure(u.avatar_color) + ';color:#FFF;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + userInitial + '</div>') +
            '<div style="flex:1;display:flex;align-items:center;background:var(--tile);border-radius:20px;height:40px;padding:0 6px 0 14px;">' +
              '<input id="commentInput" type="text" oninput="App.onCommentInput(this.value)" placeholder="' + (S.replyingToCommentId ? 'Répondre à ' + safeHtml(S.replyingToAuthor||'') + '…' : 'Ajouter un commentaire… (@ pour taguer)') + '" style="flex:1;border:none;background:transparent;font-size:15px;color:var(--ink);outline:none;">' +
              '<label style="cursor:pointer;padding:6px;display:flex;align-items:center;flex-shrink:0;">' +
                '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                '<input type="file" accept="image/*" onchange="App.addCommentImage(event)" style="display:none;">' +
              '</label>' +
              '<button type="submit" style="background:none;border:none;padding:0 0 0 4px;cursor:pointer;display:flex;align-items:center;">' + SVG.send + '</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderCommentItem(c, isReply, postId, canManagePost) {
    var likedComments = db(SK.LIKED_COMMENTS, {});
    var isLiked = !!likedComments[c.id];
    var allU = db(SK.USERS, []);
    var cAuthor = allU.find(function(u){ return u.id === c.userId; });
    var cAvatarUrl = (cAuthor && cAuthor.avatar_url) ? cAuthor.avatar_url : c.avatar_url;
    var cColor = couleurSure((cAuthor && cAuthor.avatar_color) ? cAuthor.avatar_color : c.avatarColor);
    var cInitial = (cAuthor && cAuthor.prenom) ? cAuthor.prenom.charAt(0).toUpperCase() : ((c.author||'U').charAt(0));
    // Nom affiché tiré de la fiche de l'auteur quand on la connaît : le champ
    // « author » du commentaire est libre et pouvait usurper un autre nom.
    var cNom = (cAuthor && cAuthor.prenom) ? cAuthor.prenom + (cAuthor.nom ? ' ' + cAuthor.nom.charAt(0) + '.' : '') : (c.author || 'Membre');
    var avSize = isReply ? 28 : 36;

    var cAvatarNode = cAvatarUrl
      ? '<img src="' + safeUrl(cAvatarUrl) + '" style="width:'+avSize+'px;height:'+avSize+'px;border-radius:'+(avSize/2)+'px;object-fit:cover;flex-shrink:0;" />'
      : '<div style="width:'+avSize+'px;height:'+avSize+'px;border-radius:'+(avSize/2)+'px;background:linear-gradient(135deg,' + cColor + ',#0B5FE0);color:#FFF;font-size:'+(isReply?'11px':'13px')+';font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + cInitial + '</div>';

    // Double contexte d'échappement : d'abord la chaîne JS à guillemets simples
    // (antislash puis apostrophe) — JSON.stringify() produisait des guillemets
    // doubles qui fermaient l'attribut prématurément et cassaient le bouton —,
    // ensuite l'attribut HTML délimité par des guillemets doubles : un nom
    // contenant « " » doit devenir &quot; sans quoi il referme l'attribut onclick
    // et permet l'injection de code.
    var replyBtn = isReply ? '' : '<button onclick="App.replyToComment(\'' + jsArg(c.id) + '\', \'' + jsArg(c.author || 'Membre') + '\')" style="background:none;border:none;padding:0;font-size:12px;font-weight:700;color:var(--faint);cursor:pointer;">Répondre</button>';

    var u = S.user || {};
    var canDelete = !!postId && (canManagePost || c.userId === u.id);

    var row = '<div id="cwrap-' + c.id + '" ' +
      (canDelete ? 'ontouchstart="App.commentSwipeStart(event)" ontouchmove="App.commentSwipeMove(event)" ontouchend="App.commentSwipeEnd(event)" ' : '') +
      'style="display:flex;align-items:flex-start;gap:10px;padding:2px 2px;background:' + UI.card + ';position:relative;touch-action:pan-y;">' +
      '<div onclick="App.openUserProfile(\'' + jsArg(c.userId) + '\')" style="cursor:pointer;">' + cAvatarNode + '</div>' +
      '<div style="flex:1;">' +
        '<div style="display:flex;align-items:baseline;gap:6px;">' +
          '<strong onclick="App.openUserProfile(\'' + jsArg(c.userId) + '\')" style="cursor:pointer;font-size:13px;color:var(--ink);">' + safeHtml(cNom) + '</strong>' +
          '<span style="font-size:12px;color:var(--faint);">' + timeAgo(c.timestamp) + '</span>' +
        '</div>' +
        (c.text ? '<p style="font-size:15px;color:var(--ink);margin:3px 0 5px;line-height:1.4;">' + hashtagify(c.text) + '</p>' : '') +
        (c.imageUrl ? '<img src="'+safeUrl(c.imageUrl)+'" onclick="event.stopPropagation();App.openImageViewer(\''+jsArg(c.imageUrl)+'\')" style="max-width:180px;max-height:180px;border-radius:' + UI.r1 + ';margin:2px 0 6px;display:block;object-fit:cover;cursor:pointer;">' : '') +
        replyBtn +
      '</div>' +
      '<div id="clike-'+c.id+'" onclick="App.likeComment(\''+jsArg(c.id)+'\')" style="cursor:pointer;width:44px;height:44px;display:flex;align-items:center;justify-content:center;margin:-6px -8px -6px 0;flex-shrink:0;">' +
        SVG.heart(isLiked, 15) +
      '</div>' +
    '</div>';

    if (!canDelete) {
      return '<div style="margin-bottom:' + (isReply?'10px':'6px') + ';">' + row + '</div>';
    }

    // Glissement vers la gauche pour révéler « Supprimer » (comme Mail/Messages
    // iOS) — jusqu'ici aucun moyen de retirer un commentaire n'existait dans
    // l'application. Le bouton rouge reste sous le commentaire, révélé par la
    // translation horizontale portée par App.commentSwipeMove/End.
    return '<div style="position:relative;overflow:hidden;border-radius:' + UI.r1 + ';margin-bottom:' + (isReply?'10px':'6px') + ';">' +
      '<div style="position:absolute;inset:0;background:' + UI.bad + ';display:flex;align-items:center;justify-content:flex-end;">' +
        '<button onclick="App.deleteComment(\''+jsArg(postId)+'\',\''+jsArg(c.id)+'\')" aria-label="Supprimer le commentaire" style="width:76px;height:100%;min-height:44px;background:none;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '</button>' +
      '</div>' +
      row +
    '</div>';
  }

  // Regroupe les commentaires en fil principal + réponses imbriquées (1 niveau,
  // à la Instagram). Chaque commentaire racine porte un conteneur "replies-<id>"
  // où les réponses s'ajoutent, y compris via App.submitComment sans re-render complet.
  function renderCommentsList(comments, postId, canManagePost) {
    // Une réponse dont le parent a été supprimé remonte au premier niveau au
    // lieu de disparaître (elle restait sinon comptée mais jamais rendue).
    var idsConnus = {};
    (comments || []).forEach(function(c){ idsConnus[c.id] = true; });
    var top = (comments || []).filter(function(c){
      if (!c.parentId) return true;
      return !idsConnus[c.parentId]; // parent supprimé -> remonte au niveau racine
    });
    var byParent = {};
    (comments || []).forEach(function(c) {
      if (!c.parentId) return;
      if (!byParent[c.parentId]) byParent[c.parentId] = [];
      byParent[c.parentId].push(c);
    });
    return top.map(function(c) {
      var replies = byParent[c.id] || [];
      return renderCommentItem(c, false, postId, canManagePost) +
        '<div id="replies-' + c.id + '" style="margin-left:44px;">' +
          replies.map(function(r){ return renderCommentItem(r, true, postId, canManagePost); }).join('') +
        '</div>';
    }).join('');
  }

  // Bandeau de pointage sur la fiche d'un événement (Planning). C'est le point
  // d'entrée le plus naturel : on regarde le planning, on voit qu'on est de
  // service, on pointe — sans avoir à deviner qu'il faut passer par le composeur.
  // ============================================================
  // RÉPONSE À UNE CONVOCATION (lot 2)
  // Le membre convoqué confirme ou décline (avec un motif) ; sa réponse vit
  // dans ev.reponsesConvocation[son id], que lui seul peut écrire (migration 07).
  // ============================================================
  function reponseConvocation(ev, userId) {
    var r = ev && ev.reponsesConvocation && ev.reponsesConvocation[userId];
    return (r && (r.statut === 'confirme' || r.statut === 'decline')) ? r : null;
  }

  function renderReponseConvocation(ev) {
    if (!S.user || !ev || ev.type !== 'EVENT') return '';
    var a = (ev.assignments || []).find(function(x){ return x && x.userId === S.user.id; });
    if (!a) return '';
    var debut = eventStartTimestamp(ev);
    if (debut && Date.now() > debut) return '';      // le service a commencé : place au pointage
    var r = reponseConvocation(ev, S.user.id);
    // Boutons pilule : plein pour l'action principale, cerclé pour l'autre.
    var bouton = function(action, libelle, fond, couleur, cercle) {
      return '<button type="button" onclick="' + action + '" style="flex:1;min-height:48px;border:' + (cercle ? '1.5px solid var(--line2)' : 'none') + ';border-radius:999px;background:' + fond + ';color:' + couleur + ';font-size:15px;font-weight:700;cursor:pointer;">' + libelle + '</button>';
    };

    if (S.declinerEvId === ev.id) {
      return '<div class="kc-apparait" style="background:var(--tile);border-radius:12px;padding:12px;margin-bottom:10px;">' +
        '<label for="motifDecline" style="display:block;font-size:13px;font-weight:700;color:var(--ink);margin-bottom:6px;">Pourquoi ne peux-tu pas venir&nbsp;?</label>' +
        '<input id="motifDecline" type="text" maxlength="120" placeholder="Ex. voyage, examen, maladie" class="kc-champ" style="' + styleChamp() + '">' +
        '<div style="display:flex;gap:8px;margin-top:8px;">' +
          bouton('App.annulerDecliner()', 'Annuler', 'var(--card)', 'var(--ink)') +
          bouton('App.repondreConvocation(\'' + jsArg(ev.id) + '\',\'decline\')', 'Envoyer', UI.bad, '#FFF') +
        '</div>' +
      '</div>';
    }

    if (!r) {
      return '<div id="reponse-' + safeHtml(ev.id) + '" style="margin-bottom:10px;border-radius:14px;transition:box-shadow 0.35s ease, background 0.35s ease;">' +
        '<div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:8px;">Tu es convoqué(e)' + (a.task ? ' · ' + safeHtml(a.task) : '') + '. Tu confirmes&nbsp;?</div>' +
        '<div style="display:flex;gap:8px;">' +
          bouton('App.repondreConvocation(\'' + jsArg(ev.id) + '\',\'confirme\')', 'Je confirme', UI.accent, '#FFF') +
          bouton('App.ouvrirDecliner(\'' + jsArg(ev.id) + '\')', 'Je ne peux pas', 'var(--card)', 'var(--ink)', true) +
        '</div>' +
      '</div>';
    }

    var ok = r.statut === 'confirme';
    return '<div id="reponse-' + safeHtml(ev.id) + '" style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:' + (ok ? 'var(--ok-soft)' : 'var(--bad-soft)') + ';border:1px solid ' + (ok ? 'var(--ok-line)' : 'var(--bad-line)') + ';border-radius:12px;padding:8px 8px 8px 12px;margin-bottom:10px;">' +
      '<span class="kc-apparait" style="font-size:13px;font-weight:800;color:' + (ok ? 'var(--ok-ink)' : 'var(--bad-ink)') + ';min-width:0;overflow-wrap:anywhere;">' +
        (ok ? '✓ Présence confirmée' : 'Indisponible' + (r.motif ? ' · ' + safeHtml(r.motif) : '')) +
      '</span>' +
      '<button type="button" onclick="App.annulerReponseConvocation(\'' + jsArg(ev.id) + '\')" style="flex-shrink:0;min-height:36px;background:none;border:none;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;">Modifier</button>' +
    '</div>';
  }

  // Pour l'organisateur (auteur, Responsable de pôle, Admin) : où en sont les
  // réponses des convoqués.
  // Qui est de service : visible de tous sur la carte du Planning, avec la
  // tâche de chacun et sa réponse à la convocation.
  function nomAssignation(a, users) {
    if (!a) return '';
    if (a.isSection) return 'Pôle ' + (a.sectionName || secNom(a.sectionId));
    var u = (users || []).find(function(x){ return x && x.id === a.userId; });
    return u ? (u.prenom + ' ' + (u.nom || '').charAt(0) + (u.nom ? '.' : '')).trim() : (a.userName || 'Membre');
  }
  function renderEquipeService(ev) {
    var liste = (ev && ev.assignments || []).filter(Boolean);
    if (!liste.length) return '';
    var users = db(SK.USERS, []);
    var lignes = liste.map(function(a) {
      var moi = S.user && a.userId === S.user.id;
      var r = a.userId ? reponseConvocation(ev, a.userId) : null;
      var point = !r ? 'var(--line2)' : r.statut === 'confirme' ? 'var(--ok)' : 'var(--bad)';
      return '<div style="display:flex;align-items:center;gap:8px;min-width:0;padding:5px 0;">' +
        '<span title="' + (!r ? 'En attente' : r.statut === 'confirme' ? 'Confirmé' : 'Indisponible') + '" style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + point + ';"></span>' +
        '<span style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;">' + safeHtml(nomAssignation(a, users)) + (moi ? ' · toi' : '') + '</span>' +
        (a.task ? '<span style="font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">' + safeHtml(a.task) + '</span>' : '') +
      '</div>';
    }).join('');
    return '<div style="background:var(--tile);border-radius:14px;padding:8px 12px;margin-bottom:12px;">' +
      '<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:0.3px;margin-bottom:2px;">De service (' + liste.length + ')</div>' +
      lignes +
    '</div>';
  }

  function renderSuiviConvocations(ev) {
    if (!S.user || !ev || ev.type !== 'EVENT' || !(ev.assignments || []).length) return '';
    var organisateur = ev.userId === S.user.id || canManageEventAssignments(ev, S.user);
    if (!organisateur) return '';
    var users = db(SK.USERS, []);
    var confirmes = 0, enAttente = 0, declines = [];
    (ev.assignments || []).forEach(function(a) {
      if (!a || !a.userId) return;
      var r = reponseConvocation(ev, a.userId);
      if (!r) enAttente++;
      else if (r.statut === 'confirme') confirmes++;
      else {
        var u = users.find(function(x){ return x.id === a.userId; });
        declines.push((u ? (u.prenom + ' ' + (u.nom || '').charAt(0) + '.') : (a.userName || 'Membre')) + (r.motif ? ' (' + r.motif + ')' : ''));
      }
    });
    var puce = function(n, libelle, fond, couleur) {
      if (!n) { fond = 'var(--tile)'; couleur = 'var(--muted)'; }   // un zéro n'alerte pas
      return '<span style="font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:' + fond + ';color:' + couleur + ';">' + n + ' ' + libelle + '</span>';
    };
    return '<div style="margin-bottom:10px;">' +
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;">' +
        '<span style="font-size:12px;font-weight:700;color:var(--muted);margin-right:2px;">Réponses</span>' +
        puce(confirmes, confirmes > 1 ? 'confirmés' : 'confirmé', 'var(--ok-soft)', 'var(--ok-ink)') +
        puce(declines.length, declines.length > 1 ? 'indisponibles' : 'indisponible', 'var(--bad-soft)', 'var(--bad-ink)') +
        puce(enAttente, 'en attente', 'var(--tile)', 'var(--muted)') +
      '</div>' +
      (declines.length ? '<div style="font-size:13px;color:var(--bad-ink);margin-top:6px;line-height:1.45;">' + declines.map(safeHtml).join(' · ') + '</div>' : '') +
    '</div>';
  }

  // ============================================================
  // ÉCHANGE DE SERVICE (lot 3)
  // Le convoqué propose sa place (ev.echanges[son id]) ; un membre du même
  // pôle la reprend (ev.reprises[son id] = { pour }) ; le responsable valide,
  // ce qui remplace l'assignation. Chacun n'écrit que son entrée (migration 08).
  // ============================================================
  function echangesOuverts(ev) {
    var assignes = (ev.assignments || []).filter(function(a){ return a && a.userId; });
    return Object.keys(ev.echanges || {}).map(function(uid) {
      var a = assignes.find(function(x){ return x.userId === uid; });
      if (!a) return null;                 // déjà remplacé : échange terminé
      var repreneurs = Object.keys(ev.reprises || {}).filter(function(r) {
        return ev.reprises[r] && ev.reprises[r].pour === uid && !assignes.some(function(x){ return x.userId === r; });
      });
      return { uid: uid, assignation: a, repreneurs: repreneurs };
    }).filter(Boolean);
  }
  // Un membre peut-il reprendre cette place ? Même pôle, pas déjà de service.
  function peutReprendre(u, ev, ech) {
    if (!u || compteEnAttente(u) || u.id === ech.uid) return false;
    if ((ev.assignments || []).some(function(a){ return a && a.userId === u.id; })) return false;
    var mesPoles = getUserSections(u);
    var poles = ech.assignation.sectionId ? [ech.assignation.sectionId]
      : getUserSections(db(SK.USERS, []).find(function(x){ return x.id === ech.uid; }) || {});
    return poles.some(function(p){ return mesPoles.indexOf(p) !== -1; });
  }

  function renderEchanges(ev) {
    if (!S.user || !ev || ev.type !== 'EVENT' || isEventPast(ev)) return '';
    var debut = eventStartTimestamp(ev);
    if (debut && Date.now() > debut) return '';
    var moi = S.user.id;
    var ouverts = echangesOuverts(ev);
    var bloc = function(fond, contenu) { return '<div class="kc-apparait" style="background:' + fond + ';border-radius:12px;padding:12px;margin-bottom:10px;">' + contenu + '</div>'; };
    var petitBouton = function(action, libelle, plein) {
      return '<button type="button" onclick="' + action + '" style="min-height:40px;padding:0 14px;border:none;border-radius:999px;background:' + (plein ? UI.accent : 'var(--card)') + ';color:' + (plein ? '#FFF' : 'var(--ink)') + ';font-size:13px;font-weight:700;cursor:pointer;">' + libelle + '</button>';
    };
    var nom = function(id) {
      var u = db(SK.USERS, []).find(function(x){ return x.id === id; });
      return u ? (u.prenom + ' ' + (u.nom || '').charAt(0) + '.') : 'Un membre';
    };
    var out = '';

    // 1) Le convoqué : proposer sa place, ou suivre sa proposition.
    var mienne = (ev.assignments || []).find(function(a){ return a && a.userId === moi; });
    if (mienne && !mienne.deadline) {
      var ouvert = ouverts.find(function(e){ return e.uid === moi; });
      if (!ouvert) {
        // Lien « Proposer ma place » : avec les liens de la carte (renderActionsEvenement).
      } else {
        out += bloc('var(--warn-soft)',
          '<div style="font-size:13px;font-weight:700;color:var(--warn-ink);margin-bottom:8px;">' +
            (ouvert.repreneurs.length ? safeHtml(ouvert.repreneurs.map(nom).join(', ')) + ' veut reprendre ta place. En attente du responsable.' : 'Ta place est proposée aux membres du pôle.') +
          '</div>' +
          petitBouton('App.retirerEchange(\'' + jsArg(ev.id) + '\')', 'Retirer ma proposition'));
      }
    }

    // 2) Les autres membres du pôle : reprendre une place proposée.
    ouverts.forEach(function(e) {
      if (!peutReprendre(S.user, ev, e)) return;
      var dejaPris = ev.reprises && ev.reprises[moi] && ev.reprises[moi].pour === e.uid;
      out += bloc('var(--accent-soft)',
        '<div style="font-size:13px;font-weight:700;color:var(--accent-ink);margin-bottom:8px;">' +
          (dejaPris ? 'Tu as proposé de reprendre la place de ' + safeHtml(nom(e.uid)) + '. En attente du responsable.'
                    : 'Place à reprendre : ' + safeHtml(nom(e.uid)) + (e.assignation.task ? ' · ' + safeHtml(e.assignation.task) : '')) +
        '</div>' +
        (dejaPris ? petitBouton('App.annulerReprise(\'' + jsArg(ev.id) + '\')', 'Annuler')
                  : petitBouton('App.reprendreEchange(\'' + jsArg(ev.id) + '\',\'' + jsArg(e.uid) + '\')', 'Je la reprends', true)));
    });

    // 3) L'organisateur : valider d'un geste.
    if (ev.userId === moi || canManageEventAssignments(ev, S.user)) {
      ouverts.forEach(function(e) {
        e.repreneurs.forEach(function(r) {
          out += bloc('var(--tile)',
            '<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:8px;">Échange : ' + safeHtml(nom(e.uid)) + ' → ' + safeHtml(nom(r)) + (e.assignation.task ? ' · ' + safeHtml(e.assignation.task) : '') + '</div>' +
            petitBouton('App.validerEchange(\'' + jsArg(ev.id) + '\',\'' + jsArg(e.uid) + '\',\'' + jsArg(r) + '\')', 'Valider l\'échange', true));
        });
      });
    }
    return out;
  }

  // Ajouter à l'agenda + itinéraire, sous la fiche d'un événement à venir.
  function renderActionsEvenement(ev) {
    if (!ev || ev.type !== 'EVENT' || isEventPast(ev)) return '';
    var dest = (typeof ev.eventLat === 'number' && typeof ev.eventLng === 'number')
      ? ev.eventLat + ',' + ev.eventLng
      : (ev.eventLocation ? encodeURIComponent(ev.eventLocation + ', Abidjan') : '');
    // Liens discrets (synthèse du design) : l'action principale reste le bouton.
    var lien = 'display:inline-flex;align-items:center;gap:6px;min-height:36px;background:none;color:' + UI.lien + ';border:none;padding:0;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;';
    // Plan de préparation : visible de tous dès qu'il existe, proposé aux
    // responsables de pôle et à l'Admin tant qu'il est vide.
    var st = statsPreparation(assainirPreparation(ev.preparation));
    var editeur = SECTIONS.some(function(sec){ return peutPreparer(S.user, sec.id); });
    var prep = (st.taches || editeur)
      ? '<button type="button" onclick="App.ouvrirPreparation(\'' + jsArg(ev.id) + '\')" style="' + lien + '">' +
          ico('clipboard', 14, 'currentColor', 2.2) +
          (st.total ? 'Préparation · ' + st.faites + '/' + st.total : (st.taches ? 'Préparation' : 'Préparer')) +
          (st.enRetard ? '<span style="color:var(--bad-ink);">· ' + st.enRetard + ' en retard</span>' : '') +
        '</button>'
      : '';
    // Convoqué sans échange en cours : proposer sa place à un membre du pôle.
    var maPlace = S.user && (ev.assignments || []).find(function(a){ return a && a.userId === S.user.id; });
    var debutEv = eventStartTimestamp(ev);
    var echange = (maPlace && !maPlace.deadline && !(ev.echanges && ev.echanges[S.user.id]) && !(debutEv && Date.now() > debutEv))
      ? '<button type="button" onclick="App.proposerEchange(\'' + jsArg(ev.id) + '\')" aria-label="Proposer ma place à un membre du pôle" style="' + lien + '">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4M21 7H7M7 21l-4-4 4-4M3 17h14"/></svg>Proposer ma place</button>'
      : '';
    return '<div style="display:flex;flex-wrap:wrap;gap:4px 18px;margin-bottom:8px;">' +
      prep +
      '<button type="button" onclick="App.ajouterAgenda(\'' + jsArg(ev.id) + '\')" style="' + lien + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>Mon agenda</button>' +
      (dest ? '<a href="' + safeUrl('https://www.google.com/maps/dir/?api=1&destination=' + dest) + '" target="_blank" rel="noopener noreferrer" style="' + lien + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Itinéraire</a>' : '') +
      echange +
    '</div>';
  }

  // ============================================================
  // PLAN DE PRÉPARATION D'UN ÉVÉNEMENT (migration 11)
  // ============================================================
  // Écran public : chaque pôle y présente ses tâches, découpées en étapes
  // datées à faire avant l'événement. Le responsable du pôle et l'Admin
  // ajoutent, modifient et cochent ; les autres membres consultent.
  function echeancePrep(date, fait, auj) {
    if (!date) return { txt: 'Sans date', col: 'var(--muted)', bg: 'var(--tile)' };
    var court = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    if (fait) return { txt: court, col: 'var(--muted)', bg: 'var(--tile)' };
    if (date < auj) return { txt: 'En retard · ' + court, col: 'var(--bad-ink)', bg: 'var(--bad-soft)' };
    if (date === auj) return { txt: 'Aujourd\'hui', col: 'var(--warn-ink)', bg: 'var(--warn-soft)' };
    if (date === isoLocal(new Date(Date.now() + 864e5))) return { txt: 'Demain', col: 'var(--accent-ink)', bg: 'var(--accent-soft)' };
    return { txt: court, col: 'var(--ink2)', bg: 'var(--tile)' };
  }

  // Case à cocher d'une étape : un bouton pour qui peut modifier le plan.
  function caseEtapePrep(pole, t, e, modifiable, auj) {
    var enRetard = !e.fait && e.date && e.date < auj;
    var icone = e.fait ? ico('check', 22, UI.okPlein, 2.2) : ico('circle', 22, enRetard ? 'var(--bad-ink)' : UI.faint, 2);
    if (!modifiable) return '<span aria-hidden="true" style="width:44px;height:44px;margin:-10px -6px -10px -12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icone + '</span>';
    return '<button type="button" onclick="App.prepBasculer(\'' + jsArg(pole) + '\',\'' + jsArg(t.id) + '\',\'' + jsArg(e.id) + '\')" aria-pressed="' + (e.fait ? 'true' : 'false') + '" aria-label="' + safeHtml((e.fait ? 'Décocher : ' : 'Marquer comme faite : ') + e.titre) + '" style="width:44px;height:44px;margin:-10px -6px -10px -12px;border:none;background:none;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;">' + icone + '</button>';
  }

  // Formulaire en ligne : nouvelle tâche / étape, ou modification.
  function formulairePrep(ev, f, assignees) {
    var etape = f.type === 'etape' || f.type === 'modifEtape';
    var modif = f.type === 'modifTache' || f.type === 'modifEtape';
    var entree = 'onkeydown="if(event.key===\'Enter\'){event.preventDefault();App.prepValider();}"';
    var bouton = function(libelle, action, principal, danger) {
      return '<button type="button" onclick="' + action + '" style="min-height:44px;padding:0 16px;border-radius:999px;border:none;font:inherit;font-size:15px;font-weight:700;cursor:pointer;' +
        (principal ? 'background:' + UI.accent + ';color:#FFF;' : danger ? 'background:none;color:var(--bad-ink);margin-right:auto;padding:0 4px;' : 'background:var(--card);color:var(--ink);') + '">' + libelle + '</button>';
    };
    return '<div id="prepFormulaire" style="background:var(--tile);border-radius:16px;padding:12px;margin-top:10px;display:flex;flex-direction:column;gap:10px;">' +
      '<label for="prepTitre" style="' + STYLE_LIBELLE + 'margin-bottom:-4px;">' + (etape ? (modif ? 'Étape' : 'Nouvelle étape') : (modif ? 'Tâche' : 'Nouvelle tâche')) + '</label>' +
      '<input type="text" id="prepTitre" class="kc-champ" maxlength="' + (etape ? 160 : 120) + '" value="' + safeHtml(S.prepSaisie || '') + '" oninput="S.prepSaisie=this.value" ' + entree +
        ' placeholder="' + (etape ? 'Ex. : Charger les batteries' : 'Ex. : Communication de l\'événement') + '" style="' + styleChamp() + '" />' +
      (etape
        ? '<div><label for="prepDate" style="' + STYLE_LIBELLE + '">À faire pour le</label>' +
            '<input type="date" id="prepDate" class="kc-champ" value="' + safeHtml(S.prepSaisieDate || '') + '"' + (ev.eventDate ? ' max="' + safeHtml(ev.eventDate) + '"' : '') + ' onchange="S.prepSaisieDate=this.value" style="' + styleChamp() + '" /></div>'
        : '') +
      // Nouvelle tâche : reprendre une tâche déjà assignée aux membres du pôle.
      (f.type === 'tache' && assignees.length
        ? '<div><div style="font-size:12px;font-weight:700;color:var(--muted);margin:0 4px 6px;">Reprendre une tâche assignée</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + assignees.map(function(a) {
              return '<button type="button" onclick="App.prepValider(\'' + jsArg(a) + '\')" style="min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer;">' + ico('plus', 13, UI.lien, 2.4) + ' ' + safeHtml(a) + '</button>';
            }).join('') + '</div></div>'
        : '') +
      '<div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap;">' +
        (modif ? bouton('Supprimer', 'App.prepSupprimer()', false, true) : '') +
        bouton(f.type === 'etape' ? 'Terminé' : 'Annuler', 'App.prepFermerForm()') +
        bouton(modif ? 'Enregistrer' : 'Ajouter', 'App.prepValider()', true) +
      '</div>' +
    '</div>';
  }

  function blocPolePrep(ev, pid, prep, auj) {
    var e = prep[pid] || { taches: [] };
    var modifiable = peutPreparer(S.user, pid);
    var f = S.prepForm && S.prepForm.pole === pid ? S.prepForm : null;
    var st = statsPreparation(prep, pid);
    var couleur = secColor(pid);
    var auteur = e.maj_par ? db(SK.USERS, []).find(function(x){ return x && x.id === e.maj_par; }) : null;
    var depuis = !e.maj_le ? '' : (Date.now() - e.maj_le < 60e3) ? 'à l\'instant'
      : (Date.now() - e.maj_le < 7 * 864e5) ? 'il y a ' + timeAgo(e.maj_le) : 'le ' + timeAgo(e.maj_le);
    var maj = e.maj_le ? 'mis à jour ' + (auteur ? 'par ' + (auteur.prenom || 'un membre') + ' ' : '') + depuis : '';
    // Tâches déjà confiées aux membres de ce pôle sur l'événement.
    var titres = e.taches.map(function(t){ return t.titre.toLowerCase(); });
    var assignees = [];
    (ev.assignments || []).forEach(function(a) {
      if (!a || !a.task || a.sectionId !== pid) return;
      var t = String(a.task).trim();
      if (t && titres.indexOf(t.toLowerCase()) === -1 && assignees.indexOf(t) === -1) assignees.push(t);
    });

    var taches = e.taches.map(function(t) {
      var faites = t.etapes.filter(function(x){ return x.fait; }).length;
      var enEdition = f && f.type === 'modifTache' && f.tache === t.id;
      return '<div style="border-top:1px solid var(--line);padding-top:12px;margin-top:12px;">' +
        (enEdition ? formulairePrep(ev, f, []) :
        '<div style="display:flex;align-items:flex-start;gap:8px;">' +
          (modifiable
            ? '<button type="button" onclick="App.prepOuvrirForm(\'modifTache\',\'' + jsArg(pid) + '\',\'' + jsArg(t.id) + '\')" style="flex:1;min-width:0;text-align:left;background:none;border:none;padding:0;font:inherit;cursor:pointer;display:flex;align-items:flex-start;gap:6px;">' +
                '<span style="font-size:15px;font-weight:800;color:var(--ink);line-height:1.3;overflow-wrap:anywhere;">' + safeHtml(t.titre) + '</span>' + ico('pencil', 14, UI.faint) +
              '</button>'
            : '<div style="flex:1;min-width:0;font-size:15px;font-weight:800;color:var(--ink);line-height:1.3;overflow-wrap:anywhere;">' + safeHtml(t.titre) + '</div>') +
          (t.etapes.length ? '<span style="font-size:12px;font-weight:700;color:' + (faites === t.etapes.length ? 'var(--ok-ink)' : 'var(--muted)') + ';flex-shrink:0;">' + faites + '/' + t.etapes.length + '</span>' : '') +
        '</div>') +
        '<div style="margin-top:6px;">' +
          (t.etapes.length ? t.etapes.map(function(et) {
            if (f && f.type === 'modifEtape' && f.etape === et.id) return formulairePrep(ev, f, []);
            var ech = echeancePrep(et.date, et.fait, auj);
            return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0 4px;">' +
              caseEtapePrep(pid, t, et, modifiable, auj) +
              '<div style="flex:1;min-width:0;">' +
                (modifiable
                  ? '<button type="button" onclick="App.prepOuvrirForm(\'modifEtape\',\'' + jsArg(pid) + '\',\'' + jsArg(t.id) + '\',\'' + jsArg(et.id) + '\')" style="display:block;width:100%;text-align:left;background:none;border:none;padding:0;font:inherit;cursor:pointer;">'
                  : '<div>') +
                  '<span style="display:block;font-size:14px;line-height:1.35;overflow-wrap:anywhere;color:' + (et.fait ? 'var(--muted)' : 'var(--ink)') + ';' + (et.fait ? 'text-decoration:line-through;' : '') + '">' + safeHtml(et.titre) + '</span>' +
                  '<span style="display:inline-block;margin-top:4px;font-size:12px;font-weight:700;padding:2px 8px;border-radius:8px;background:' + ech.bg + ';color:' + ech.col + ';">' + safeHtml(ech.txt) + '</span>' +
                (modifiable ? '</button>' : '</div>') +
              '</div>' +
            '</div>';
          }).join('') : '<div style="font-size:13px;color:var(--muted);padding:4px 0;">Pas encore d\'étape.</div>') +
          (modifiable && f && f.type === 'etape' && f.tache === t.id ? formulairePrep(ev, f, []) :
            (modifiable && !(f && (f.type === 'modifTache' && f.tache === t.id))
              ? '<button type="button" onclick="App.prepOuvrirForm(\'etape\',\'' + jsArg(pid) + '\',\'' + jsArg(t.id) + '\')" style="display:inline-flex;align-items:center;gap:6px;min-height:40px;margin-top:2px;background:none;border:none;padding:0;color:var(--lien);font:inherit;font-size:13px;font-weight:700;cursor:pointer;">' + ico('plus', 14, 'currentColor', 2.4) + 'Ajouter une étape</button>'
              : '')) +
        '</div>' +
      '</div>';
    }).join('');

    return '<section aria-label="' + safeHtml('Pôle ' + secNom(pid)) + '" style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:12px;">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
        '<span style="width:40px;height:40px;border-radius:20px;background:' + couleur + '1F;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:' + couleur + ';color:color-mix(in srgb, ' + couleur + ', #FFF var(--pole-clair));">' + icoPole(pid, 20, 'currentColor') + '</span>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:17px;font-weight:800;color:var(--ink);">' + safeHtml(secNom(pid)) + '</div>' +
          '<div style="font-size:12px;color:var(--muted);line-height:1.35;">' +
            (st.total ? st.faites + '/' + st.total + (st.total > 1 ? ' étapes faites' : ' étape faite') : (e.taches.length ? e.taches.length + ' tâche' + (e.taches.length > 1 ? 's' : '') : 'Rien de prévu pour l\'instant')) +
            (st.enRetard ? ' · <span style="color:var(--bad-ink);font-weight:700;">' + st.enRetard + ' en retard</span>' : '') +
            (maj ? ' · ' + safeHtml(maj) : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      taches +
      (modifiable
        ? (f && f.type === 'tache'
            ? '<div style="border-top:1px solid var(--line);margin-top:12px;">' + formulairePrep(ev, f, assignees) + '</div>'
            : '<button type="button" onclick="App.prepOuvrirForm(\'tache\',\'' + jsArg(pid) + '\')" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;margin-top:14px;border-radius:999px;border:1.5px dashed var(--line2);background:none;color:var(--lien);font:inherit;font-size:15px;font-weight:700;cursor:pointer;">' + ico('plus', 16, 'currentColor', 2.4) + 'Ajouter une tâche</button>')
        : '') +
    '</section>';
  }

  // Vue « Par date » : toutes les étapes de tous les pôles, dans l'ordre.
  function vueDatesPrep(prep, auj) {
    var etapes = etapesPreparation(prep);
    if (!etapes.length) return '';
    var groupes = [], courant = null;
    etapes.forEach(function(x) {
      var cle = !x.etape.date ? 'sans' : (!x.etape.fait && x.etape.date < auj) ? 'retard' : x.etape.date;
      var g = groupes.find(function(y){ return y.cle === cle; });
      if (!g) { g = { cle: cle, items: [] }; groupes.push(g); }
      g.items.push(x);
    });
    var rang = function(c){ return c === 'retard' ? '0' : c === 'sans' ? '9' : '1' + c; };
    groupes.sort(function(a, b){ return rang(a.cle) < rang(b.cle) ? -1 : 1; });
    return groupes.map(function(g) {
      var titre = g.cle === 'retard' ? 'En retard' : g.cle === 'sans' ? 'Sans date'
        : g.cle === auj ? 'Aujourd\'hui'
        : (function(){ var l = new Date(g.cle + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); return l.charAt(0).toUpperCase() + l.slice(1); })();
      return '<div style="font-size:12px;font-weight:700;color:' + (g.cle === 'retard' ? 'var(--bad-ink)' : UI.muted) + ';margin:16px 4px 8px;">' + safeHtml(titre) + '</div>' +
        '<div style="background:var(--card);border-radius:20px;padding:4px 16px;">' +
          g.items.map(function(x, i) {
            var couleur = secColor(x.pole);
            return '<div style="display:flex;align-items:flex-start;gap:10px;padding:12px 0 8px;' + (i ? 'border-top:1px solid var(--line);' : '') + '">' +
              caseEtapePrep(x.pole, x.tache, x.etape, peutPreparer(S.user, x.pole), auj) +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:14px;line-height:1.35;overflow-wrap:anywhere;color:' + (x.etape.fait ? 'var(--muted)' : 'var(--ink)') + ';' + (x.etape.fait ? 'text-decoration:line-through;' : '') + '">' + safeHtml(x.etape.titre) + '</div>' +
                '<div style="font-size:12px;color:var(--muted);margin-top:2px;overflow-wrap:anywhere;">' +
                  '<span style="font-weight:700;color:' + couleur + ';color:color-mix(in srgb, ' + couleur + ', #FFF var(--pole-clair));">' + safeHtml(secNom(x.pole)) + '</span> · ' + safeHtml(x.tache.titre) +
                  (g.cle === 'retard' ? ' · ' + safeHtml(echeancePrep(x.etape.date, false, auj).txt.replace('En retard · ', 'prévue ')) : '') +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>';
    }).join('');
  }

  function renderPreparation() {
    var ev = db(SK.POSTS, []).find(function(p){ return p.id === S.preparationId; });
    if (!ev) return '';
    var u = S.user || {};
    var prep = assainirPreparation(ev.preparation);
    var auj = isoLocal();
    var st = statsPreparation(prep);

    // Pôles affichés : ceux de l'événement, ceux qui ont un plan, ceux du
    // responsable connecté, et ceux que l'Admin vient d'ajouter.
    var vus = {};
    (ev.eventSections || []).forEach(function(id){ vus[id] = true; });
    Object.keys(prep).forEach(function(id){ if (prep[id].taches.length) vus[id] = true; });
    if (isSectionResponsable(u)) getUserSections(u).forEach(function(id){ vus[id] = true; });
    (S.prepPolesEnPlus || []).forEach(function(id){ vus[id] = true; });
    var poles = (ev.eventSections || []).filter(function(id){ return SECTIONS.some(function(x){ return x.id === id; }); })
      .concat(SECTIONS.map(function(x){ return x.id; }).filter(function(id){ return vus[id] && (ev.eventSections || []).indexOf(id) === -1; }));
    var autres = isGrandResponsable(u) ? SECTIONS.filter(function(x){ return poles.indexOf(x.id) === -1; }) : [];

    var jours = ev.eventDate ? Math.round((new Date(ev.eventDate + 'T00:00:00') - new Date(auj + 'T00:00:00')) / 864e5) : null;
    var compte = jours === null ? '' : jours > 1 ? 'J-' + jours : jours === 1 ? 'Demain' : jours === 0 ? 'Aujourd\'hui' : 'Passé';
    var evDate = ev.eventDate ? new Date(ev.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    var pct = st.total ? Math.round(st.faites / st.total * 100) : 0;
    var vue = S.prepVue === 'dates' ? 'dates' : 'poles';

    return '<div class="safe-top" id="preparation" style="position:fixed;inset:0;background:' + UI.page + ';z-index:10001;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      enTetePleinEcran('Préparation', 'App.fermerPreparation()') +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 16px 40px;">' +

        '<div style="background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:14px;margin-bottom:12px;display:flex;gap:12px;align-items:flex-start;">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:15px;font-weight:800;color:var(--ink);overflow-wrap:anywhere;">' + safeHtml(ev.eventTitle || 'Événement') + '</div>' +
            '<div style="font-size:13px;color:var(--muted);margin-top:2px;overflow-wrap:anywhere;">' + safeHtml(evDate) + (ev.eventStart ? ' · ' + safeHtml(ev.eventStart) : '') + (ev.eventLocation ? ' · ' + safeHtml(ev.eventLocation) : '') + '</div>' +
          '</div>' +
          (compte ? '<span style="flex-shrink:0;font-size:13px;font-weight:800;color:var(--accent-ink);background:var(--card);border-radius:10px;padding:4px 10px;">' + compte + '</span>' : '') +
        '</div>' +

        '<div style="background:var(--card);border-radius:20px;padding:16px;margin-bottom:12px;">' +
          (st.total
            ? '<div style="display:flex;align-items:baseline;gap:8px;">' +
                '<span style="font-size:28px;font-weight:800;color:var(--ink);letter-spacing:-0.5px;">' + st.faites + '<span style="color:var(--faint);font-size:20px;">/' + st.total + '</span></span>' +
                '<span style="font-size:14px;color:var(--muted);">' + (st.total > 1 ? 'étapes faites' : 'étape faite') + '</span>' +
                (st.enRetard ? '<span style="margin-left:auto;font-size:13px;font-weight:700;color:var(--bad-ink);background:var(--bad-soft);border-radius:8px;padding:2px 8px;">' + st.enRetard + ' en retard</span>' : '') +
              '</div>' +
              '<div role="progressbar" aria-label="Avancement de la préparation" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" style="height:8px;border-radius:4px;background:var(--tile);margin:10px 0;overflow:hidden;">' +
                '<div style="height:100%;width:' + pct + '%;background:' + UI.okPlein + ';border-radius:4px;"></div>' +
              '</div>' +
              (st.prochaine
                ? '<div style="font-size:13px;color:var(--ink2);line-height:1.4;overflow-wrap:anywhere;"><strong>Prochaine étape :</strong> ' + safeHtml(st.prochaine.etape.titre) + ' · ' + safeHtml(echeancePrep(st.prochaine.etape.date, false, auj).txt) + ' · ' + safeHtml(secNom(st.prochaine.pole)) + '</div>'
                : (st.faites === st.total ? '<div style="font-size:13px;font-weight:700;color:var(--ok-ink);">Tout est prêt.</div>' : ''))
            : '<div style="font-size:15px;font-weight:700;color:var(--ink);">Aucune étape pour l\'instant</div>' +
              '<div style="font-size:13px;color:var(--muted);line-height:1.45;margin-top:4px;">Chaque responsable de pôle inscrit ici ses tâches, puis les étapes à faire, date par date, avant l\'événement. Tout le monde peut suivre l\'avancement.</div>') +
        '</div>' +

        (st.total ? '<div style="margin-bottom:12px;">' + renderSegmented([
          { label: 'Par pôle', action: "App.prepChoisirVue('poles')", active: vue === 'poles' },
          { label: 'Par date', action: "App.prepChoisirVue('dates')", active: vue === 'dates' }
        ]) + '</div>' : '') +

        (vue === 'dates' && st.total
          ? vueDatesPrep(prep, auj)
          : poles.map(function(pid){ return blocPolePrep(ev, pid, prep, auj); }).join('') +
            (!poles.length ? '<div style="font-size:13px;color:var(--muted);text-align:center;padding:12px;">Aucun pôle n\'est encore concerné par cet événement.</div>' : '') +
            (autres.length
              ? '<div style="font-size:12px;font-weight:700;color:var(--muted);margin:16px 4px 8px;">Préparer un autre pôle</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + autres.map(function(x) {
                  return '<button type="button" onclick="App.prepAjouterPole(\'' + jsArg(x.id) + '\')" style="display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer;">' + icoPole(x.id, 14) + safeHtml(x.nom) + '</button>';
                }).join('') + '</div>'
              : '')) +
      '</div>' +
    '</div>';
  }

  function renderEventCheckInAction(ev) {
    if (!S.user || !ev || ev.type !== 'EVENT') return '';
    var isAssigned = (ev.assignments || []).some(function(a){ return a && a.userId === S.user.id; });
    if (!isAssigned) return '';

    var posts = db(SK.POSTS, []);
    var now = Date.now();

    // Déjà pointé : on affiche le résultat obtenu.
    if (hasCheckedIn(S.user.id, ev.id, posts)) {
      var p = punctualityStars(S.user.id, ev.id, posts);
      if (!p) return '';
      var c = p.stars >= 4 ? 'var(--ok-ink)' : p.stars >= 2 ? 'var(--warn-ink)' : 'var(--bad-ink)';
      var bg = p.stars >= 4 ? 'var(--ok-soft)' : p.stars >= 2 ? 'var(--warn-soft)' : 'var(--bad-soft)';
      var bd = p.stars >= 4 ? 'var(--ok-line)' : p.stars >= 2 ? 'var(--warn-line)' : 'var(--bad-line)';
      return '<div style="background:' + bg + ';border:1px solid ' + bd + ';border-radius:12px;padding:10px 12px;margin-bottom:10px;">' +
        '<div style="font-size:13px;font-weight:800;color:' + c + ';">' +
          (p.offsite ? 'Pointage non validé · ' : 'Arrivée enregistrée · ') + (p.stars>0?'+':'') + p.stars + '★' +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4;">' +
          (p.delayMinutes <= 0 ? "À l'heure" : 'Retard de ' + p.delayMinutes + ' min') +
          (p.distance !== null && p.distance !== undefined ? ' · ' + (p.onSite ? 'sur place' : 'à ' + formatDistance(p.distance) + ' du lieu') : '') +
        '</div>' +
        (p.offsite
          ? '<div style="font-size:11px;color:var(--bad-ink);font-weight:700;margin-top:4px;line-height:1.4;">' +
              'Pointage hors zone : tu devais être à moins de ' + formatDistance(ON_SITE_RADIUS_M) + ' du lieu.' +
            '</div>'
          : '') +
      '</div>';
    }

    var startTs = eventStartTimestamp(ev);
    if (!startTs) return '';
    var endTs = eventEndTimestamp(ev) || startTs;

    if (now < startTs - CHECKIN_EARLY_WINDOW_MS) {
      if (startTs - now > 24 * 3600e3) return '';
      return '<div style="background:var(--tile);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:var(--muted);line-height:1.4;">' +
        'Tu es de service. Le pointage s\'ouvrira 3 h avant le début.' +
      '</div>';
    }
    if (now > endTs + CHECKIN_LATE_WINDOW_MS) {
      return '<div style="background:var(--bad-soft);border:1px solid var(--bad-line);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:var(--bad-ink);font-weight:700;line-height:1.4;">' +
        'Tu étais de service et tu n\'as pas enregistré ton arrivée.' +
      '</div>';
    }

    var delay = Math.round((now - startTs) / 60000);
    var stars = starsForDelay(delay);
    // Pointage en un geste (lot 2) : un appui relève la position et enregistre
    // l'arrivée. La publication avec photo reste possible, en option.
    if (S.pointageEnCours === ev.id) {
      return '<button type="button" disabled aria-live="polite" style="width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:10px;background:#0B5FE0;color:#FFF;border:none;border-radius:999px;font-size:15px;font-weight:800;opacity:0.9;margin-bottom:10px;">' +
        '<svg class="kc-localise" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-opacity="0.3"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>' +
        'Localisation en cours…' +
      '</button>';
    }
    return '<button type="button" onclick="App.pointerEnUnGeste(\'' + jsArg(ev.id) + '\')" style="width:100%;min-height:48px;background:#0B5FE0;color:#FFF;border:none;border-radius:999px;padding:11px;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:6px;">' +
        'Je suis arrivé · ' + (stars>0?'+':'') + stars + '★' +
      '</button>' +
      '<div style="font-size:11px;color:var(--faint);text-align:center;margin-bottom:10px;line-height:1.45;">' +
        (delay > 0 ? 'Retard actuel : ' + delay + ' min. ' : 'Tu es à l\'heure. ') +
        'Ta position sera relevée et visible de tous. ' +
        '<button type="button" onclick="App.startCheckIn(\'' + jsArg(ev.id) + '\')" style="background:none;border:none;padding:4px 2px;font:inherit;font-weight:700;color:var(--lien);cursor:pointer;">Pointer avec une photo</button>' +
      '</div>';
  }

  // ============================================================
  // GESTION DES ASSIGNATIONS D'UN ÉVÉNEMENT EXISTANT
  // ============================================================
  // Écran restreint : on n'y touche QUE les assignations, pas l'événement.
  // C'est ce qui permet au responsable d'un pôle de désigner qui est de service
  // dans son équipe sur un événement créé par le Admin.
  function renderAssignManagerModal() {
    var post = db(SK.POSTS, []).find(function(p){ return p.id === S.assignManagerId; });
    if (!post) return '';
    var u = S.user || {};
    var evDate = post.eventDate ? new Date(post.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'}) : '';

    return '<div class="safe-top" style="position:fixed;inset:0;background:' + UI.page + ';z-index:10001;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      enTetePleinEcran('Assignations', 'App.closeAssignManager()', boutonEnTete('Enregistrer', 'App.saveAssignManager(this)')) +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 16px 16px;background:' + UI.page + ';">' +

        '<div style="background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:14px;margin-bottom:16px;">' +
          '<div style="font-size:11px;font-weight:800;color:var(--lien);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Événement</div>' +
          '<div style="font-size:15px;font-weight:800;color:var(--ink);">' + safeHtml(post.eventTitle || 'Événement') + '</div>' +
          '<div style="font-size:13px;color:var(--muted);margin-top:2px;">' + safeHtml(evDate) + (post.eventStart ? ' · ' + safeHtml(post.eventStart) : '') + (post.eventLocation ? ' · ' + safeHtml(post.eventLocation) : '') + '</div>' +
        '</div>' +

        '<div style="background:var(--card);border-radius:20px;padding:16px;">' +
          '<label style="font-size:15px;font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Qui est de service ?</label>' +
          '<div style="font-size:12px;color:var(--faint);margin-bottom:12px;line-height:1.4;">' +
            (isGrandResponsable(u)
              ? 'Tu peux assigner n\'importe quel membre ou confier une tâche à un pôle entier.'
              : 'Tu gères les membres de ton pôle. Les assignations des autres pôles sont verrouillées (' + ico('lock', 12, 'currentColor') + ') et resteront intactes.') +
          '</div>' +
          '<div id="eventAssignmentsList">' + App.renderAssignmentsList() + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px;">' +
            '<select id="assignUserSelect" class="kc-champ" style="' + styleSelect() + '">' +
              '<option value="">Sélectionner un membre…</option>' +
              renderAssignSelectOptions(u, post.eventDate) +
            '</select>' +
            '<input type="text" id="assignTaskInput" class="kc-champ" placeholder="Tâche (facultatif), ex. : Caméra 2" style="' + styleChamp() + '" />' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="datetime-local" id="assignDeadlineInput" class="kc-champ" style="' + styleChamp() + 'flex:1;min-width:0;" />' +
              '<button type="button" onclick="App.addAssignment()" style="background:' + UI.accent + ';color:#FFF;border:none;border-radius:999px;min-height:52px;padding:0 18px;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap;">Ajouter</button>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--faint);line-height:1.4;">Avec une échéance, l\'assignation devient une <strong>tâche à livrer</strong> comptée dans les services du membre (à temps +5, en retard +2, non livrée −2).</div>' +
          '</div>' +
        '</div>' +
        '<div style="height:40px;"></div>' +
      '</div>' +
    '</div>';
  }
