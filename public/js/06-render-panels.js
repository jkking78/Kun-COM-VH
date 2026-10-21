// KUN COM VH — Partie 6/8 : Options, commentaires, planning, débrief, profil

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
        '<button onclick="App.shareExternal(\''+jsArg(post.id)+'\');App.closeOptions();" style="width:100%;background:var(--tile);border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.share + '<span style="font-size:15px;font-weight:600;color:var(--ink);">Partager</span>' +
        '</button>' +

        // Copier le lien (utilisable sur WhatsApp etc., avec aperçu miniature)
        '<button onclick="App.copyPostLink(\''+jsArg(post.id)+'\');App.closeOptions();" style="width:100%;background:var(--tile);border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.link + '<span style="font-size:15px;font-weight:600;color:var(--ink);">Copier le lien</span>' +
        '</button>' +

        // Save / Unsave
        '<button onclick="App.save(\''+jsArg(post.id)+'\');App.closeOptions();" style="width:100%;background:var(--tile);border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
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
              return '<button onclick="App.togglePin(\''+jsArg(post.id)+'\')" style="width:100%;background:' + UI.tile + ';border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
                ico('pinned', 20, estEpingle ? UI.bad : UI.ink) +
                '<span style="min-width:0;">' +
                  '<span style="display:block;font-size:15px;font-weight:600;color:' + (estEpingle ? UI.bad : UI.ink) + ';">' + (estEpingle ? 'Retirer l\'épingle' : 'Épingler en haut du fil') + '</span>' +
                  (perime ? '<span style="display:block;font-size:11.5px;color:' + UI.faint + ';margin-top:1px;">Événement terminé : l\'épingle est déjà sans effet</span>' : '') +
                '</span>' +
              '</button>';
            })()
          : '') +

        (canAssignHere
          ? '<button onclick="App.openAssignManager(\''+jsArg(post.id)+'\')" style="width:100%;background:var(--accent-soft);border:1px solid var(--line2);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B63F6" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
              '<span style="font-size:15px;font-weight:700;color:#0B63F6;">Assigner mon équipe</span>' +
            '</button>'
          : '') +

        (canDelete
          // Un événement s'édite avec le formulaire événement (date, horaires, lieu,
          // pôles, assignations, image), pas avec l'éditeur de publication générique.
          ? '<button onclick="' + (isEventPost ? 'App.openEditEvent(\''+jsArg(post.id)+'\')' : 'App.openEditPost(\''+jsArg(post.id)+'\');App.closeOptions();') + '" style="width:100%;background:var(--tile);border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B63F6" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
              '<span style="font-size:15px;font-weight:600;color:var(--ink);">' + (isEventPost ? 'Modifier l\'événement' : 'Modifier la publication') + '</span>' +
            '</button>' +
            '<button onclick="App.deletePost(\''+jsArg(post.id)+'\')" style="width:100%;background:var(--bad-soft);border:1px solid var(--bad-line);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              SVG.trash + '<span style="font-size:15px;font-weight:700;color:#E2445C;">Supprimer</span>' +
            '</button>'
          : '') +

        '<button onclick="App.closeOptions()" style="width:100%;background:var(--tile);border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:700;color:#0B63F6;cursor:pointer;">Annuler</button>' +
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
      : '<div style="display:flex;flex-direction:column;align-items:center;padding:44px 20px;text-align:center;"><div style="font-size:44px;margin-bottom:10px;">💬</div><strong style="font-size:15px;color:var(--ink);">Aucun commentaire</strong><p style="font-size:13px;color:var(--faint);margin:4px 0 0;">Soyez le premier à commenter !</p></div>';

    var emojis = ['❤️','👏','🔥','🙌','😍','😂','😮','💪'];

    return '<div onclick="App.closeComments()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;height:82vh;display:flex;flex-direction:column;animation:slideUp 0.3s;">' +

        '<div onclick="App.closeComments()" style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;">' +
          '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;"></div>' +
        '</div>' +

        '<div style="text-align:center;padding-bottom:12px;border-bottom:0.5px solid var(--tile);">' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:var(--ink);">Commentaires</h3>' +
          ((post.comments || []).length > 0 ? '<p style="font-size:12px;color:var(--faint);margin:2px 0 0;">'+(post.comments || []).length+' commentaire'+((post.comments || []).length>1?'s':'')+'</p>' : '') +
        '</div>' +

        '<div id="commentsList" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 14px;">' +
          commentItems +
        '</div>' +

        '<div style="border-top:0.5px solid var(--tile);">' +
          '<div id="replyingToBanner" style="display:' + (S.replyingToCommentId ? 'flex' : 'none') + ';align-items:center;justify-content:space-between;background:var(--accent-soft);padding:7px 14px;font-size:12.5px;color:#0B63F6;border-top:1px solid var(--line2);">' +
            '<span>Réponse à <b>' + safeHtml(S.replyingToAuthor||'') + '</b></span>' +
            '<button type="button" onclick="App.cancelReply()" style="background:none;border:none;color:#0B63F6;font-size:13px;font-weight:800;cursor:pointer;padding:2px 6px;">✕</button>' +
          '</div>' +
          '<div id="commentMentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:var(--accent-soft);border-top:1px solid var(--line2);padding:8px 14px;"></div>' +
          '<div id="commentImagePreview" style="padding:' + (S.pendingCommentImage ? '10px 14px 0' : '0') + ';">' +
            (S.pendingCommentImage
              ? '<div style="position:relative;display:inline-block;">' +
                  '<img src="'+safeUrl(S.pendingCommentImage)+'" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid var(--line);">' +
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
            (u.avatar_url ? '<img src="' + safeUrl(u.avatar_url) + '" style="width:34px;height:34px;border-radius:17px;object-fit:cover;flex-shrink:0;" />' : '<div style="width:34px;height:34px;border-radius:17px;background:' + (u.avatar_color||'#0B63F6') + ';color:#FFF;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + userInitial + '</div>') +
            '<div style="flex:1;display:flex;align-items:center;background:var(--tile);border-radius:22px;height:40px;padding:0 6px 0 14px;">' +
              '<input id="commentInput" type="text" oninput="App.onCommentInput(this.value)" placeholder="' + (S.replyingToCommentId ? 'Répondre à ' + safeHtml(S.replyingToAuthor||'') + '…' : 'Ajouter un commentaire… (@ pour taguer)') + '" style="flex:1;border:none;background:transparent;font-size:14px;color:var(--ink);outline:none;">' +
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
    var cColor = (cAuthor && cAuthor.avatar_color) ? cAuthor.avatar_color : (c.avatarColor || '#0B63F6');
    var cInitial = (cAuthor && cAuthor.prenom) ? cAuthor.prenom.charAt(0).toUpperCase() : ((c.author||'U').charAt(0));
    var avSize = isReply ? 28 : 36;

    var cAvatarNode = cAvatarUrl
      ? '<img src="' + safeUrl(cAvatarUrl) + '" style="width:'+avSize+'px;height:'+avSize+'px;border-radius:'+(avSize/2)+'px;object-fit:cover;flex-shrink:0;" />'
      : '<div style="width:'+avSize+'px;height:'+avSize+'px;border-radius:'+(avSize/2)+'px;background:linear-gradient(135deg,' + cColor + ',#0B63F6);color:#FFF;font-size:'+(isReply?'11px':'13px')+';font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + cInitial + '</div>';

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
          '<strong onclick="App.openUserProfile(\'' + jsArg(c.userId) + '\')" style="cursor:pointer;font-size:13.5px;color:var(--ink);">' + safeHtml(c.author||'Membre') + '</strong>' +
          '<span style="font-size:11.5px;color:var(--faint);">' + timeAgo(c.timestamp) + '</span>' +
        '</div>' +
        (c.text ? '<p style="font-size:14px;color:var(--ink);margin:3px 0 5px;line-height:1.4;">' + hashtagify(c.text) + '</p>' : '') +
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
    var bouton = function(action, libelle, fond, couleur) {
      return '<button type="button" onclick="' + action + '" style="flex:1;min-height:44px;border:none;border-radius:12px;background:' + fond + ';color:' + couleur + ';font-size:13.5px;font-weight:800;cursor:pointer;">' + libelle + '</button>';
    };

    if (S.declinerEvId === ev.id) {
      return '<div class="kc-apparait" style="background:var(--tile);border-radius:12px;padding:12px;margin-bottom:10px;">' +
        '<label for="motifDecline" style="display:block;font-size:13px;font-weight:700;color:var(--ink);margin-bottom:6px;">Pourquoi ne peux-tu pas venir&nbsp;?</label>' +
        '<input id="motifDecline" type="text" maxlength="120" placeholder="Ex. voyage, examen, maladie" style="width:100%;min-height:44px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--card);color:var(--ink);font-size:14px;box-sizing:border-box;">' +
        '<div style="display:flex;gap:8px;margin-top:8px;">' +
          bouton('App.annulerDecliner()', 'Annuler', 'var(--card)', 'var(--ink)') +
          bouton('App.repondreConvocation(\'' + jsArg(ev.id) + '\',\'decline\')', 'Envoyer', 'var(--bad)', '#FFF') +
        '</div>' +
      '</div>';
    }

    if (!r) {
      return '<div style="background:var(--accent-soft);border-radius:12px;padding:12px;margin-bottom:10px;">' +
        '<div style="font-size:13px;font-weight:700;color:var(--accent-ink);margin-bottom:8px;">Tu es convoqué(e)' + (a.task ? ' · ' + safeHtml(a.task) : '') + '. Tu confirmes&nbsp;?</div>' +
        '<div style="display:flex;gap:8px;">' +
          bouton('App.repondreConvocation(\'' + jsArg(ev.id) + '\',\'confirme\')', 'Je confirme', '#0E9F6E', '#FFF') +
          bouton('App.ouvrirDecliner(\'' + jsArg(ev.id) + '\')', 'Je ne peux pas', 'var(--card)', 'var(--bad-ink)') +
        '</div>' +
      '</div>';
    }

    var ok = r.statut === 'confirme';
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:' + (ok ? 'var(--ok-soft)' : 'var(--bad-soft)') + ';border:1px solid ' + (ok ? 'var(--ok-line)' : 'var(--bad-line)') + ';border-radius:12px;padding:8px 8px 8px 12px;margin-bottom:10px;">' +
      '<span class="kc-apparait" style="font-size:13px;font-weight:800;color:' + (ok ? 'var(--ok-ink)' : 'var(--bad-ink)') + ';min-width:0;overflow-wrap:anywhere;">' +
        (ok ? '✓ Présence confirmée' : 'Indisponible' + (r.motif ? ' · ' + safeHtml(r.motif) : '')) +
      '</span>' +
      '<button type="button" onclick="App.annulerReponseConvocation(\'' + jsArg(ev.id) + '\')" style="flex-shrink:0;min-height:36px;background:none;border:none;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;">Modifier</button>' +
    '</div>';
  }

  // Pour l'organisateur (auteur, Responsable de pôle, Admin) : où en sont les
  // réponses des convoqués.
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
      return '<span style="font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:' + fond + ';color:' + couleur + ';">' + n + ' ' + libelle + '</span>';
    };
    return '<div style="border-top:1px solid var(--line);margin-top:4px;padding-top:10px;margin-bottom:10px;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--faint);margin-bottom:6px;">Réponses des convoqués</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
        puce(confirmes, confirmes > 1 ? 'confirmés' : 'confirmé', 'var(--ok-soft)', 'var(--ok-ink)') +
        puce(declines.length, declines.length > 1 ? 'indisponibles' : 'indisponible', 'var(--bad-soft)', 'var(--bad-ink)') +
        puce(enAttente, 'en attente', 'var(--tile)', 'var(--muted)') +
      '</div>' +
      (declines.length ? '<div style="font-size:12.5px;color:var(--bad-ink);margin-top:6px;line-height:1.45;">' + declines.map(safeHtml).join(' · ') + '</div>' : '') +
    '</div>';
  }

  // Ajouter à l'agenda + itinéraire, sous la fiche d'un événement à venir.
  function renderActionsEvenement(ev) {
    if (!ev || ev.type !== 'EVENT' || isEventPast(ev)) return '';
    var dest = (typeof ev.eventLat === 'number' && typeof ev.eventLng === 'number')
      ? ev.eventLat + ',' + ev.eventLng
      : (ev.eventLocation ? encodeURIComponent(ev.eventLocation + ', Abidjan') : '');
    var lien = 'display:flex;align-items:center;justify-content:center;gap:6px;flex:1;min-height:40px;background:var(--tile);color:var(--ink);border:none;border-radius:10px;font-size:12.5px;font-weight:700;cursor:pointer;text-decoration:none;';
    return '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
      '<button type="button" onclick="App.ajouterAgenda(\'' + jsArg(ev.id) + '\')" style="' + lien + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>Mon agenda</button>' +
      (dest ? '<a href="' + safeUrl('https://www.google.com/maps/dir/?api=1&destination=' + dest) + '" target="_blank" rel="noopener noreferrer" style="' + lien + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Itinéraire</a>' : '') +
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
        '<div style="font-size:12.5px;font-weight:800;color:' + c + ';">' +
          (p.offsite ? '⛔ Pointage non validé · ' : 'Arrivée enregistrée · ') + (p.stars>0?'+':'') + p.stars + '★' +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4;">' +
          (p.delayMinutes <= 0 ? "À l'heure" : 'Retard de ' + p.delayMinutes + ' min') +
          (p.distance !== null && p.distance !== undefined ? ' · ' + (p.onSite ? 'sur place' : 'à ' + formatDistance(p.distance) + ' du lieu') : '') +
        '</div>' +
        (p.offsite
          ? '<div style="font-size:11px;color:var(--bad-ink);font-weight:700;margin-top:4px;line-height:1.4;">' +
              'Pointage hors zone : vous deviez être à moins de ' + formatDistance(ON_SITE_RADIUS_M) + ' du lieu.' +
            '</div>'
          : '') +
      '</div>';
    }

    var startTs = eventStartTimestamp(ev);
    if (!startTs) return '';
    var endTs = eventEndTimestamp(ev) || startTs;

    if (now < startTs - CHECKIN_EARLY_WINDOW_MS) {
      return '<div style="background:var(--tile);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:11.5px;color:var(--muted);line-height:1.4;">' +
        'Vous êtes de service. Le pointage s\'ouvrira 3 h avant le début.' +
      '</div>';
    }
    if (now > endTs + CHECKIN_LATE_WINDOW_MS) {
      return '<div style="background:var(--bad-soft);border:1px solid var(--bad-line);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:11.5px;color:var(--bad-ink);font-weight:700;line-height:1.4;">' +
        'Vous étiez de service et n\'avez pas enregistré votre arrivée.' +
      '</div>';
    }

    var delay = Math.round((now - startTs) / 60000);
    var stars = starsForDelay(delay);
    // Pointage en un geste (lot 2) : un appui relève la position et enregistre
    // l'arrivée. La publication avec photo reste possible, en option.
    if (S.pointageEnCours === ev.id) {
      return '<button type="button" disabled aria-live="polite" style="width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:10px;background:#0B63F6;color:#FFF;border:none;border-radius:12px;font-size:14px;font-weight:800;opacity:0.9;margin-bottom:10px;">' +
        '<svg class="kc-localise" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-opacity="0.3"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>' +
        'Localisation en cours…' +
      '</button>';
    }
    return '<button type="button" onclick="App.pointerEnUnGeste(\'' + jsArg(ev.id) + '\')" style="width:100%;min-height:48px;background:#0B63F6;color:#FFF;border:none;border-radius:12px;padding:11px;font-size:14.5px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(11,99,246,0.3);margin-bottom:6px;">' +
        '📍 Je suis arrivé · ' + (stars>0?'+':'') + stars + '★' +
      '</button>' +
      '<div style="font-size:11px;color:var(--faint);text-align:center;margin-bottom:10px;line-height:1.45;">' +
        (delay > 0 ? 'Retard actuel : ' + delay + ' min. ' : 'Tu es à l\'heure. ') +
        'Ta position sera relevée et visible de tous. ' +
        '<button type="button" onclick="App.startCheckIn(\'' + jsArg(ev.id) + '\')" style="background:none;border:none;padding:4px 2px;font:inherit;font-weight:700;color:#0B63F6;cursor:pointer;">Pointer avec une photo</button>' +
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

    return '<div class="safe-top" style="position:fixed;inset:0;background:var(--card);z-index:10001;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      '<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);">' +
        '<button onclick="App.closeAssignManager()" style="background:none;border:none;font-size:16px;color:var(--ink);cursor:pointer;">Annuler</button>' +
        '<div style="font-weight:700;font-size:16px;">Assignations</div>' +
        '<button onclick="App.saveAssignManager(this)" style="background:none;border:none;font-size:16px;font-weight:700;color:#0B63F6;cursor:pointer;">Enregistrer</button>' +
      '</header>' +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;background:var(--tile);">' +

        '<div style="background:var(--accent-soft);border:1px solid var(--line2);border-radius:16px;padding:14px;margin-bottom:16px;">' +
          '<div style="font-size:10px;font-weight:800;color:#0B63F6;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Événement</div>' +
          '<div style="font-size:15px;font-weight:800;color:var(--ink);">' + safeHtml(post.eventTitle || 'Événement') + '</div>' +
          '<div style="font-size:12.5px;color:var(--muted);margin-top:2px;">' + safeHtml(evDate) + (post.eventStart ? ' · ' + safeHtml(post.eventStart) : '') + (post.eventLocation ? ' · ' + safeHtml(post.eventLocation) : '') + '</div>' +
        '</div>' +

        '<div style="background:var(--card);border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
          '<label style="font-size:14px;font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Qui est de service ?</label>' +
          '<div style="font-size:11.5px;color:var(--faint);margin-bottom:12px;line-height:1.4;">' +
            (isGrandResponsable(u)
              ? 'Vous pouvez assigner n\'importe quel membre ou confier une tâche à un pôle entier.'
              : 'Vous gérez les membres de votre pôle. Les assignations des autres pôles sont verrouillées (🔒) et resteront intactes.') +
          '</div>' +
          '<div id="eventAssignmentsList">' + App.renderAssignmentsList() + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px;">' +
            '<select id="assignUserSelect" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);font-size:14px;outline:none;background:var(--tile);">' +
              '<option value="">Sélectionner un membre…</option>' +
              renderAssignSelectOptions(u, post.eventDate) +
            '</select>' +
            '<input type="text" id="assignTaskInput" placeholder="Tâche / travail à faire..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);font-size:14px;outline:none;background:var(--tile);box-sizing:border-box;" />' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="datetime-local" id="assignDeadlineInput" style="flex:1;min-width:0;padding:10px;border-radius:8px;border:1px solid var(--line);font-size:14px;outline:none;background:var(--tile);" />' +
              '<button onclick="App.addAssignment()" style="background:#0B63F6;color:#FFF;border:none;border-radius:8px;padding:0 16px;font-weight:700;cursor:pointer;white-space:nowrap;">Ajouter</button>' +
            '</div>' +
            '<div style="font-size:10.5px;color:var(--faint);line-height:1.4;">Avec une échéance, l\'assignation devient une <strong>tâche à livrer</strong> comptée dans les services du membre (à temps +5, en retard +2, non livrée −2).</div>' +
          '</div>' +
        '</div>' +
        '<div style="height:40px;"></div>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // MESSAGERIE PRIVÉE (simple, 1-à-1)
  // ============================================================
  function renderDmBubble(m) {
    var mine = S.user && m.fromId === S.user.id;
    return '<div style="display:flex;justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';margin-bottom:8px;">' +
      '<div style="max-width:72%;background:' + (mine ? '#0B63F6' : 'var(--tile)') + ';color:' + (mine ? '#FFF' : 'var(--ink)') + ';padding:9px 13px;border-radius:16px;' + (mine ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;') + 'font-size:14.5px;line-height:1.4;word-break:break-word;">' +
        safeHtml(m.text) +
        '<div style="font-family:' + UI.fontMono + ';font-size:10px;margin-top:3px;opacity:0.7;text-align:right;">' + timeAgo(m.timestamp) + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderDirectMessageModal() {
    if (!S.dmWithUserId) return '';
    var allU = db(SK.USERS, []);
    var other = allU.find(function(u){ return u.id === S.dmWithUserId; }) || {};
    var otherName = (other.prenom || 'Membre') + ' ' + (other.nom || '');
    var otherAvatar = other.avatar_url
      ? '<img src="' + safeUrl(other.avatar_url) + '" style="width:34px;height:34px;border-radius:17px;object-fit:cover;flex-shrink:0;" />'
      : '<div style="width:34px;height:34px;border-radius:17px;background:' + (other.avatar_color||'#0B63F6') + ';color:#FFF;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (other.prenom||'M').charAt(0).toUpperCase() + '</div>';

    var messagesHtml = S.dmLoading
      ? '<div style="padding:40px 20px;text-align:center;color:var(--faint);font-size:13px;">Chargement…</div>'
      : (S.dmMessages.length > 0
          ? S.dmMessages.map(function(m){ return renderDmBubble(m); }).join('')
          : '<div style="display:flex;flex-direction:column;align-items:center;padding:44px 20px;text-align:center;"><div style="font-size:40px;margin-bottom:8px;">💬</div><strong style="font-size:14px;color:var(--ink);">Aucun message</strong><p style="font-size:12.5px;color:var(--faint);margin:4px 0 0;">Envoyez le premier message à ' + safeHtml(other.prenom||'ce membre') + '.</p></div>');

    return '<div onclick="App.closeDirectMessage()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;height:82vh;display:flex;flex-direction:column;animation:slideUp 0.3s;">' +
        '<div onclick="App.closeDirectMessage()" style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;">' +
          '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;padding:6px 16px 12px;border-bottom:0.5px solid var(--tile);">' +
          '<div onclick="App.closeDirectMessage()" aria-label="Retour" style="cursor:pointer;width:44px;height:44px;display:flex;align-items:center;justify-content:center;margin-left:-8px;flex-shrink:0;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" stroke-width="2.3"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
          '</div>' +
          otherAvatar +
          '<strong style="font-family:' + UI.fontDisplay + ';font-size:16px;font-weight:700;letter-spacing:-0.2px;color:var(--ink);">' + safeHtml(otherName) + '</strong>' +
        '</div>' +
        '<div id="dmMessagesList" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px;">' +
          messagesHtml +
        '</div>' +
        '<form onsubmit="event.preventDefault(); App.sendDirectMessage(event);" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:0.5px solid var(--tile);">' +
          '<div style="flex:1;display:flex;align-items:center;background:var(--tile);border-radius:22px;height:40px;padding:0 6px 0 14px;">' +
            '<input id="dmInput" type="text" placeholder="Écrire un message…" style="flex:1;border:none;background:transparent;font-size:14px;color:var(--ink);outline:none;">' +
            '<button type="submit" style="background:none;border:none;padding:0 6px;cursor:pointer;display:flex;align-items:center;">' + SVG.send + '</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // PLANNING TAB
  // ============================================================
  // Sélecteur à onglets partagé (Planning, Notation, période du suivi) :
  // des pastilles dans un rail gris, un seul style pour les trois écrans.
  function renderSegmented(items) {
    return '<div style="display:flex;gap:3px;background:' + UI.tile + ';border-radius:' + UI.r1 + ';padding:3px;">' +
      items.map(function(it) {
        return '<button onclick="' + it.action + '" style="flex:1;padding:8px 6px;border-radius:9px;font-size:12.5px;font-weight:' + (it.active ? '600' : '400') + ';border:none;cursor:pointer;white-space:nowrap;background:' +
          (it.active ? UI.card : 'transparent') + ';color:' + (it.active ? UI.ink : UI.muted) + ';box-shadow:' + (it.active ? UI.sh : 'none') + ';">' + it.label + '</button>';
      }).join('') +
    '</div>';
  }

  function renderPlanning() {
    if (!S.selectedDate) S.selectedDate = new Date().toISOString().split('T')[0];
    if (!S.planningMode) S.planningMode = 'upcoming';
    
    var canCreate = S.user && (S.user.role === 'RESP_SECTION' || S.user.role === 'GRAND_RESPONSABLE');
    var rightBtn = canCreate ? '<button onclick="App.openCreateEvent()" aria-label="Nouvel événement" style="background:' + UI.accent + ';color:#FFF;border:none;border-radius:14px;width:44px;height:44px;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(11,99,246,0.3);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg></button>' : '';
    // En-tête « écran plein » à grand titre (façon maquette).
    var header = '<div style="background:' + UI.card + ';padding:22px 18px 16px;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">' +
        '<div style="min-width:0;">' +
          '<h1 style="font-family:' + UI.fontDisplay + ';font-size:30px;font-weight:800;letter-spacing:-1px;color:' + UI.ink + ';margin:0;line-height:1.05;">Planning</h1>' +
          '<p style="font-size:13.5px;color:' + UI.faint + ';margin:5px 0 0;">Gérez et suivez les événements du département.</p>' +
          (function(){
            var mes = ((db(SK.USERS, []).find(function(x){ return S.user && x.id === S.user.id; }) || S.user || {}).indisponibilites || [])
              .filter(function(x){ return x && x.date >= new Date().toISOString().split('T')[0]; });
            return '<button type="button" onclick="App.ouvrirIndispos()" style="margin-top:10px;min-height:36px;display:inline-flex;align-items:center;gap:6px;background:' + UI.tile + ';border:none;border-radius:999px;padding:0 14px;font-size:13px;font-weight:700;color:' + UI.ink + ';cursor:pointer;">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="14" x2="15" y2="18"/><line x1="15" y1="14" x2="9" y2="18"/></svg>' +
              'Mes indisponibilités' + (mes.length ? ' · ' + mes.length : '') +
            '</button>';
          })() +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' + renderCloche() + rightBtn + '</div>' +
      '</div>' +
    '</div>';

    var modeSwitch = '<div style="background:' + UI.card + ';padding:10px 16px 12px;border-bottom:0.5px solid ' + UI.line + ';">' +
      renderSegmented([
        { label:'À venir',    action:"S.planningMode='upcoming';render()", active: S.planningMode==='upcoming' },
        { label:'Historique', action:"S.planningMode='history';render()",  active: S.planningMode==='history'  }
      ]) +
    '</div>';

    var allPosts = db(SK.POSTS, []);
    var todayIso = new Date().toISOString().split('T')[0];

    if (S.planningMode === 'history') {
      // Un événement bascule ici dès qu'il est terminé (heure de fin dépassée),
      // pas seulement le lendemain.
      var pastEvents = allPosts.filter(function(p) { return isEventPast(p); });
      pastEvents.sort(function(a,b) { return (eventEndTimestamp(b)||0) - (eventEndTimestamp(a)||0); });
      var historyHtml = '<div style="padding:14px 12px 90px;min-height:50vh;background:' + UI.page + ';">';
      if (pastEvents.length === 0) {
         historyHtml += '<div style="text-align:center;padding:50px 24px;color:' + UI.faint + ';">' + ico('history', 40, UI.line2, 1.4) + '<div style="font-size:16px;font-weight:600;color:' + UI.ink + ';margin-top:10px;">Aucun historique</div><div style="font-size:13.5px;margin-top:4px;">Les événements passés s\'afficheront ici.</div></div>';
      } else {
         var canEvaluate = S.user && S.user.role === 'GRAND_RESPONSABLE';
         pastEvents.forEach(function(ev) {
            historyHtml += '<div style="margin-bottom:12px;">' +
              '<div onclick="App.goToEvent(\''+jsArg(ev.id)+'\')" style="cursor:pointer;">' + renderEventCardInner(ev) + '</div>' +
              (canEvaluate
                ? '<button onclick="App.selectEvalEvent(\''+jsArg(ev.id)+'\');S.tab=\'debrief\';render()" style="width:100%;margin-top:8px;background:' + UI.card + ';color:' + UI.accentInk + ';border:0.5px solid ' + UI.line2 + ';border-radius:' + UI.r1 + ';padding:11px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;">' + ico('pencil', 15, UI.accentInk) + 'Évaluer / débriefer</button>'
                : '') +
            '</div>';
         });
      }
      historyHtml += '</div>';
      return header + modeSwitch + historyHtml;
    }

    var baseDate = new Date();
    var todayIso = baseDate.toISOString().split('T')[0];
    var dateMap = {};
    // Add today + next 6 days automatically
    for(var i = 0; i < 7; i++) {
      var d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dateMap[d.toISOString().split('T')[0]] = d;
    }
    
    // Add any future dates that have events
    allPosts.forEach(function(p) {
      if (p.type === 'EVENT' && p.eventDate && p.eventDate >= todayIso) {
         if (!dateMap[p.eventDate]) dateMap[p.eventDate] = new Date(p.eventDate);
      }
    });
    var dates = Object.keys(dateMap).sort().map(function(k){ return dateMap[k]; });
    var nowTsSlider = Date.now();

    var slider = '<div style="background:var(--card);padding:16px;border-bottom:1px solid var(--line);display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;">' +
      dates.map(function(d) {
        var iso = d.toISOString().split('T')[0];
        var isSel = (iso === S.selectedDate);
        var dayName = d.toLocaleDateString('fr-FR', {weekday:'short'}).toUpperCase();
        var dayNum = d.getDate();
        // Cellule sélectionnée : fond var(--ink) / contenu var(--page) — les
        // seules valeurs qui restent contrastées dans les DEUX thèmes.
        var bg = isSel ? 'var(--ink)' : 'var(--tile)';
        var col = isSel ? 'var(--page)' : 'var(--faint)';
        var numCol = isSel ? 'var(--page)' : 'var(--ink)';
        var hasEv = allPosts.some(function(p){ return p.type==='EVENT' && p.eventDate===iso && !isEventPast(p, nowTsSlider); });
        var dot = hasEv ? '<div style="width:4px;height:4px;border-radius:2px;background:'+(isSel?'var(--page)':'#E2445C')+';margin-top:2px;"></div>' : '<div style="height:6px;"></div>';
        return '<div onclick="App.selectDate(\''+jsArg(iso)+'\')" style="min-width:54px;height:74px;border-radius:16px;background:'+bg+';display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:0.2s;">' +
          '<span style="font-size:11px;font-weight:700;color:'+col+';margin-bottom:2px;">'+dayName+'</span>' +
          '<span style="font-size:20px;font-weight:800;color:'+numCol+';line-height:1;">'+dayNum+'</span>' +
          dot +
        '</div>';
      }).join('') +
    '</div>';

    // Les événements encore à venir (ou en cours) passent devant, du plus proche
    // au plus lointain ; les événements déjà terminés viennent ensuite. Le
    // carrousel s'ouvre donc toujours sur ce qui concerne l'utilisateur maintenant.
    var nowTs = Date.now();
    var dayEvents = allPosts.filter(function(p) {
      if (p.type !== 'EVENT' || !p.eventDate) return false;
      // « À venir » ne montre que ce qui reste à venir ou est en cours. Un
      // événement déjà terminé n'a rien à y faire — il n'appartient qu'à
      // l'Historique. Sans ce filtre, la vue affichait des fiches « Terminé »
      // dans l'onglet censé lister ce qui arrive.
      return !isEventPast(p, nowTs);
    }).sort(function(a,b) {
      // Groupé par JOUR (maquette) : on trie par date puis par heure de début.
      var d = String(a.eventDate).localeCompare(String(b.eventDate));
      if (d !== 0) return d;
      return String(a.eventStart || '').localeCompare(String(b.eventStart || ''));
    });

    var timeline = '<div style="padding:8px 20px 40px;min-height:50vh;background:' + UI.page + ';">';
    
    if (dayEvents.length === 0) {
      timeline += '<div style="text-align:center;padding:40px 20px;color:var(--faint);">' +
        '<div style="font-size:40px;margin-bottom:12px;">📅</div>' +
        '<div style="font-size:18px;font-weight:700;color:var(--ink);">Aucun événement</div>' +
        '<div style="font-size:14px;margin-top:4px;">Rien de prévu pour cette date.</div>' +
      '</div>';
    } else {
      // Chaque événement produit un bloc ; on décide ensuite de l'affichage :
      // liste verticale habituelle s'il n'y en a qu'un, carrousel horizontal dès
      // que la journée en compte plusieurs (ordonnés par heure de début).
      var planBlocks = [];
      var dernierJour = null;   // suit le jour courant pour insérer les en-têtes

      dayEvents.forEach(function(ev) {
        // Statut calculé sur des horodatages, pas sur une comparaison de chaînes :
        // « 21:27 > 01:30 » est vrai en texte, ce qui marquait « Terminé » une
        // veillée de 22:00 à 01:30 avant même qu'elle ne commence.
        var status = 'upcoming';
        var statusHtml = '';
        var evStartTs = eventStartTimestamp(ev);
        var evEndTs = eventEndTimestamp(ev);
        if (evStartTs && evEndTs) {
          if (nowTs > evEndTs) status = 'closed';
          else if (nowTs >= evStartTs) status = 'active';
        } else if (ev.eventDate < todayIso) {
          status = 'closed';
        }

        if (status === 'active') {
          statusHtml = '<div style="display:inline-flex;align-items:center;gap:4px;background:var(--ok-soft);color:#0E9F6E;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;"><div style="width:6px;height:6px;border-radius:3px;background:#0E9F6E;animation:blink 1.5s infinite;"></div>En cours</div>';
        } else if (status === 'closed') {
          statusHtml = '<div style="display:inline-block;background:var(--tile);color:var(--faint);padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;">Terminé</div>';
        }

        // Les pôles passent à la ligne au lieu de déborder hors de la fiche.
        var secTags = (ev.eventSections || []).map(function(s){
          return '<span style="font-size:12px;font-weight:700;color:#0B63F6;white-space:nowrap;">' + secNom(s) + '</span>';
        }).join('<span style="color:var(--line);margin:0 4px;">•</span>');

        // min-width:0 est indispensable : sans lui, un élément flex refuse de
        // rétrécir sous la largeur de son contenu et la fiche déborde de l'écran
        // (pôles et bouton coupés à droite).
        // En-tête de JOUR (maquette) : libellé en chasse fixe, majuscules
        // espacées, précédé d'une pastille pleine pour le jour en cours.
        if (ev.eventDate !== dernierJour) {
          dernierJour = ev.eventDate;
          var dObj = new Date(ev.eventDate + 'T00:00:00');
          var estAujourdhui = ev.eventDate === todayIso;
          planBlocks.push('<div style="display:flex;align-items:center;gap:8px;margin:' + (planBlocks.length ? '28px' : '0') + ' 0 14px;">' +
            '<span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;' + (estAujourdhui ? 'background:' + UI.accent + ';' : 'border:1.5px solid ' + UI.line2 + ';') + '"></span>' +
            '<span style="font-family:' + UI.fontMono + ';font-size:13px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:' + UI.muted + ';">' +
              safeHtml(dObj.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })) +
            '</span>' +
          '</div>');
        }

        planBlocks.push('<div style="margin-bottom:14px;max-width:100%;">' +
          '<div style="min-width:0;">' +
            '<div style="background:var(--card);border-radius:12px;padding:20px;box-shadow:' + UI.sh2 + ';border:1px solid ' + UI.line + ';overflow:hidden;">' +
              statusHtml +
              '<h3 style="font-family:' + UI.fontDisplay + ';font-size:22px;font-weight:800;letter-spacing:-0.6px;color:var(--ink);margin:0 0 10px;line-height:1.1;overflow-wrap:anywhere;">' + safeHtml(ev.eventTitle) + '</h3>' +
              (secTags ? '<div style="display:flex;flex-wrap:wrap;align-items:center;margin-bottom:12px;">' + secTags + '</div>' : '') +
              // Horaire + Lieu en lignes à pastille ronde (façon maquette).
              '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                  '<div style="width:34px;height:34px;border-radius:50%;background:var(--tile);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
                  '</div>' +
                  '<div style="min-width:0;">' +
                    '<div style="font-size:10.5px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:var(--faint);">Horaire</div>' +
                    '<div style="font-family:' + UI.fontMono + ';font-size:15px;font-weight:700;color:var(--ink);">' + (ev.eventStart||'--:--') + ' - ' + (ev.eventEnd||'--:--') + '</div>' +
                  '</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                  '<div style="width:34px;height:34px;border-radius:50%;background:var(--tile);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                  '</div>' +
                  '<div style="min-width:0;">' +
                    '<div style="font-size:10.5px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:var(--faint);">Lieu</div>' +
                    '<div style="font-size:14px;font-weight:600;color:var(--ink);overflow-wrap:anywhere;">' + safeHtml(ev.eventLocation || 'Non défini') + '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              (ev.caption ? '<p style="font-size:13px;color:var(--ink2);margin:0 0 16px;line-height:1.4;overflow-wrap:anywhere;">' + safeHtml(ev.caption) + '</p>' : '') +
              renderActionsEvenement(ev) +
              renderReponseConvocation(ev) +
              renderEventCheckInAction(ev) +
              renderSuiviConvocations(ev) +
              (function(){
                // Un convoqué répond à sa convocation ci-dessus : le bouton de
                // participation libre ne s'adresse qu'aux autres membres.
                if (S.user && (ev.assignments || []).some(function(a){ return a && a.userId === S.user.id; })) return '';
                var isPart = S.user && Array.isArray(ev.likedBy) && ev.likedBy.indexOf(S.user.id) !== -1;
                var count = Array.isArray(ev.likedBy) ? ev.likedBy.length : 0;
                if (status === 'closed') {
                  return '<button disabled style="width:100%;background:var(--tile);color:var(--faint);border:none;border-radius:12px;padding:11px;font-size:13.5px;font-weight:700;">Terminé (' + count + ' participants)</button>';
                }
                return '<button onclick="App.toggleEventParticipation(\'' + jsArg(ev.id) + '\')" style="width:100%;background:' + (isPart ? '#0E9F6E' : '#0B63F6') + ';color:#FFF;border:none;border-radius:12px;padding:11px;font-size:13.5px;font-weight:800;cursor:pointer;box-shadow:' + (isPart ? '0 4px 12px rgba(52,199,89,0.3)' : '0 4px 12px rgba(11,99,246,0.3)') + ';">' + (isPart ? '✓ Participation Confirmée (' + count + ')' : '+ Je participe 👍 (' + count + ')') + '</button>';
              })() +
            '</div>' +
          '</div>' +
        '</div>');
      });

      // Liste verticale simple : les en-têtes de jour sont dans planBlocks,
      // un carrousel horizontal les couperait.
      timeline += planBlocks.join('');
    }

    timeline += '</div>';

    return header + modeSwitch + timeline;
  }
  // ============================================================
  // DEBRIEF TAB
  // ============================================================
  // Onglet Notation : deux vues, la saisie d'un bilan et le suivi dans le temps.
  function renderDebrief(u) {
    var canEvaluate = isGrandResponsable(u);
    // Un membre ne peut pas noter, mais doit pouvoir consulter l'historique des
    // bilans déjà publiés (ils finissent par disparaître du fil) : on le fige
    // sur le Suivi, en lecture seule, sans jamais lui proposer l'onglet Noter.
    var view = canEvaluate ? (S.debriefView === 'suivi' ? 'suivi' : 'noter') : 'suivi';

    var tabs = canEvaluate
      ? '<div style="background:' + UI.card + ';padding:10px 16px 12px;border-bottom:0.5px solid ' + UI.line + ';">' +
          renderSegmented([
            { label:'Noter', action:"App.setDebriefView('noter')", active: view !== 'suivi' },
            { label:'Suivi', action:"App.setDebriefView('suivi')", active: view === 'suivi' }
          ]) +
        '</div>'
      : '<div style="padding:12px 16px 0;">' +
          '<div style="background:var(--accent-soft);border-radius:12px;padding:10px 12px;font-size:12px;color:#0B63F6;font-weight:700;display:flex;align-items:center;gap:8px;line-height:1.4;">' +
            '<span style="font-size:16px;">👀</span> Consultation seule : seul l\'Admin publie les bilans.' +
          '</div>' +
        '</div>';

    if (view === 'suivi') {
      return renderScreenHeader('Bilans', 'Évaluation des pôles', '') + tabs + renderMonPole(u) + renderScoreboard(canEvaluate);
    }
    return renderScreenHeader('Bilans', 'Évaluation des pôles', '') + tabs + renderDebriefForm(u);
  }

  // ============================================================
  // SUIVI : tableau de bord par pôle
  // ============================================================
  function renderScoreboard(canEvaluate) {
    var now = new Date();
    var cycleStr = now.getDate() <= 15 ? '1er – 15 ' + now.toLocaleDateString('fr-FR',{month:'long'})
                                       : '16 – fin ' + now.toLocaleDateString('fr-FR',{month:'long'});
    var posts = db(SK.POSTS, []);

    var periodSwitch = '<div style="padding:14px 16px 6px;">' +
      renderSegmented([
        { label:'Cycle ' + cycleStr,  action:'App.setScoreboardPeriod(false)', active: !S.scoreboardAll },
        { label:'Depuis le début',    action:'App.setScoreboardPeriod(true)',  active: !!S.scoreboardAll }
      ]) +
    '</div>';

    var emptyMsg = '<div style="font-size:13.5px;line-height:1.5;">' + (canEvaluate ? 'Publiez un bilan depuis l\'onglet « Noter » : les moyennes et l\'évolution de chaque pôle apparaîtront ici.' : 'Dès qu\'un Admin publiera un bilan, les moyennes et l\'évolution de chaque pôle apparaîtront ici.') + '</div>';
    var emptyBlock = function(title) {
      return '<div style="padding:50px 24px;text-align:center;color:var(--faint);">' +
          '<div style="font-size:44px;margin-bottom:12px;">📊</div>' +
          '<div style="font-size:17px;font-weight:800;color:var(--ink);margin-bottom:6px;">' + title + '</div>' +
          emptyMsg +
        '</div>';
    };

    if (!S.scoreboardAll) {
      // Vue "Cycle en cours" : un seul classement, comme avant.
      var sinceTs = currentCycleStartTs();
      var boards = SECTIONS.map(function(sec) {
        return { sec: sec, board: sectionScoreboard(sec.id, sinceTs, posts) };
      }).sort(function(a,b) {
        if (a.board.count !== b.board.count && (!a.board.count || !b.board.count)) return b.board.count - a.board.count;
        return b.board.average - a.board.average;   // les mieux notés d'abord
      });
      var anyData = boards.some(function(b){ return b.board.count > 0; });
      if (!anyData) return periodSwitch + emptyBlock('Aucun bilan sur cette période');
      return periodSwitch +
        '<div style="padding:10px 16px 90px;">' +
          boards.map(function(b){ return renderScoreboardCard(b.sec, b.board, b.sec.id); }).join('') +
        '</div>';
    }

    // Vue "Depuis le début" : regroupée cycle par cycle, du plus récent au plus
    // ancien. Chaque cycle qui voit passer un nouveau bilan apparaît de lui-même
    // ici, sans rien à configurer — c'est purement dérivé des publications réelles.
    var cycles = historicalCycles(posts);
    var groups = cycles.map(function(cy) {
      var boards = SECTIONS.map(function(sec) {
        return { sec: sec, board: sectionScoreboard(sec.id, cy.startTs, posts, cy.endTs) };
      }).filter(function(b){ return b.board.count > 0; })
        .sort(function(a,b){ return b.board.average - a.board.average; });
      return { cycle: cy, boards: boards };
    }).filter(function(g){ return g.boards.length > 0; });

    if (groups.length === 0) return periodSwitch + emptyBlock('Aucun bilan pour le moment');

    return periodSwitch +
      '<div style="padding:10px 16px 90px;">' +
        groups.map(function(g) {
          var groupKey = 'c' + g.cycle.startTs;
          return '<div style="margin-bottom:20px;">' +
            '<div style="font-size:11px;font-weight:900;color:#0B63F6;text-transform:uppercase;letter-spacing:0.8px;padding:4px 2px 10px;">' + safeHtml(cycleLabel(g.cycle)) + '</div>' +
            g.boards.map(function(b){ return renderScoreboardCard(b.sec, b.board, groupKey + '::' + b.sec.id); }).join('') +
          '</div>';
        }).join('') +
      '</div>';
  }

  // « MON PÔLE » : en tête du Suivi, la note de son ou ses pôles et le dernier
  // mot de l'Admin, sans avoir à chercher sa carte dans le classement.
  function renderMonPole(u) {
    var mesPoles = getUserSections(u || {}).filter(function(s){ return SECTIONS.some(function(x){ return x.id === s; }); });
    if (!mesPoles.length) return '';
    var posts = db(SK.POSTS, []);
    var cycleTs = currentCycleStartTs();
    var couleur = function(v){ return v >= 4 ? '#0E9F6E' : v >= 2 ? '#D98A0B' : '#E2445C'; };
    return '<div id="monPole" style="padding:14px 16px 0;">' +
      '<div style="font-size:11px;font-weight:900;color:#0B63F6;text-transform:uppercase;letter-spacing:0.8px;padding:0 2px 8px;">' + (mesPoles.length > 1 ? 'Mes pôles' : 'Mon pôle') + '</div>' +
      mesPoles.map(function(id) {
        var sec = SECTIONS.find(function(x){ return x.id === id; });
        var cycle = sectionScoreboard(id, cycleTs, posts);
        var tout = sectionScoreboard(id, 0, posts);
        var dernier = tout.entries[0];
        return '<div class="kc-apparait" style="background:var(--card);border-radius:18px;margin-bottom:10px;border:1.5px solid ' + sec.color + '55;padding:14px 16px;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:40px;height:40px;border-radius:20px;background:' + sec.color + '1f;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;">' + sec.emoji + '</div>' +
            '<div style="flex:1;min-width:0;">' +
              '<strong style="font-size:14.5px;color:var(--ink);display:block;">' + safeHtml(sec.nom) + '</strong>' +
              '<span style="font-size:11.5px;color:var(--faint);">' + (tout.count ? tout.count + ' bilan' + (tout.count > 1 ? 's' : '') + ' au total' : 'Pas encore évalué') + '</span>' +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0;">' +
              '<div style="font-family:' + UI.fontMono + ';font-size:20px;font-weight:700;color:' + (cycle.count ? couleur(cycle.average) : 'var(--faint)') + ';">' + (cycle.count ? cycle.average + '/5' : '—') + '</div>' +
              '<div style="font-size:10.5px;color:var(--faint);font-weight:700;">ce cycle</div>' +
            '</div>' +
          '</div>' +
          (dernier
            ? '<div onclick="App.openBilan(\'' + jsArg(dernier.postId) + '\')" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--tile);cursor:pointer;">' +
                '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;font-weight:700;color:var(--muted);">' +
                  '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Dernier bilan · ' + safeHtml(dernier.eventTitle) + '</span>' +
                  '<span style="color:' + couleur(dernier.globalScore) + ';flex-shrink:0;">' + dernier.globalScore + '/5</span>' +
                '</div>' +
                (dernier.comment ? '<div style="font-size:13px;color:var(--ink);line-height:1.45;margin-top:6px;font-style:italic;">« ' + safeHtml(String(dernier.comment).slice(0, 220)) + ' »</div>' : '') +
              '</div>'
            : '') +
        '</div>';
      }).join('') +
    '</div>';
  }

  // cardKey identifie la carte dans S.scoreboardOpen : sec.id seul pour la vue
  // "Cycle en cours" (comportement historique, un pôle = une seule carte), ou
  // "c<startTs>::<secId>" pour la vue groupée par cycle, où le MÊME pôle peut
  // avoir une carte distincte (et donc un état ouvert/fermé indépendant) par cycle.
  function renderScoreboardCard(sec, board, cardKey) {
    var key = cardKey || sec.id;
    var open = S.scoreboardOpen === key;
    var has = board.count > 0;
    var col = !has ? 'var(--line)' : board.average >= 4 ? '#0E9F6E' : board.average >= 2 ? '#D98A0B' : '#E2445C';

    var trendHtml = '';
    if (has && board.count >= 2 && board.trend !== 0) {
      var up = board.trend > 0;
      trendHtml = '<span style="font-size:11px;font-weight:800;color:' + (up ? '#0E9F6E' : '#E2445C') + ';background:' + (up ? 'var(--ok-soft)' : 'var(--bad-soft)') + ';padding:2px 7px;border-radius:8px;white-space:nowrap;">' +
        (up ? '▲ +' : '▼ ') + board.trend + '</span>';
    }

    // Barres par critère : Ponctualité en tête (automatique), puis les critères saisis.
    var order = ['Ponctualité'].concat(EVAL_CRITERIA.map(function(c){ return c.nom; }));
    var critHtml = order.filter(function(k){ return board.criteriaAvg[k] !== undefined; }).map(function(k) {
      var v = board.criteriaAvg[k];
      // La ponctualité peut être négative : on ramène l'échelle -4..5 sur 0..100 %
      // (le plancher correspond à une absence ou un pointage frauduleux, -2★).
      var pct = Math.max(0, Math.min(100, ((v + 2) / 7) * 100));
      var cc = v >= 4 ? '#0E9F6E' : v >= 2 ? '#D98A0B' : '#E2445C';
      return '<div style="margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:4px;">' +
          '<span>' + safeHtml(k) + (k === 'Ponctualité' ? ' <span style="font-size:9.5px;font-weight:800;color:var(--faint);background:var(--tile);padding:1px 5px;border-radius:5px;">AUTO</span>' : '') + '</span>' +
          '<span style="color:var(--ink);">' + v + '/5</span>' +
        '</div>' +
        '<div style="height:8px;background:var(--line);border-radius:4px;overflow:hidden;">' +
          '<div style="height:100%;width:' + pct + '%;background:' + cc + ';border-radius:4px;"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    var listHtml = board.entries.slice(0, 8).map(function(e) {
      var ec = e.globalScore >= 4 ? '#0E9F6E' : e.globalScore >= 2 ? '#D98A0B' : '#E2445C';
      var d = new Date(e.timestamp).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
      return '<div onclick="App.openBilan(\'' + jsArg(e.postId) + '\')" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--tile);cursor:pointer;">' +
        '<div style="min-width:0;">' +
          '<div style="font-size:12.5px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(e.eventTitle) + '</div>' +
          '<div style="font-size:10.5px;color:var(--faint);">' + d + (e.author ? ' · ' + safeHtml(e.author) : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">' +
          '<span style="font-size:13px;font-weight:900;color:' + ec + ';">' + e.globalScore + '/5</span>' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--line)" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div style="background:var(--card);border-radius:18px;margin-bottom:10px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.04);overflow:hidden;">' +
      '<div onclick="App.toggleScoreboardSection(\'' + jsArg(key) + '\')" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px;cursor:pointer;">' +
        '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
          '<div style="width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,' + sec.color + '20,' + sec.color + '10);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">' + sec.emoji + '</div>' +
          '<div style="min-width:0;">' +
            '<strong style="font-size:14.5px;color:var(--ink);display:block;">' + safeHtml(sec.nom) + '</strong>' +
            '<span style="font-size:11.5px;color:var(--faint);">' + (has ? board.count + ' bilan' + (board.count>1?'s':'') : 'Jamais évalué') + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">' +
          trendHtml +
          '<div style="font-family:' + UI.fontMono + ';font-size:20px;font-weight:700;color:' + col + ';">' + (has ? board.average + '/5' : '—') + '</div>' +
          '<span style="font-size:13px;color:var(--line);transform:rotate(' + (open?'90':'0') + 'deg);transition:transform 0.2s;">›</span>' +
        '</div>' +
      '</div>' +
      (open && has
        ? '<div style="padding:0 16px 16px;">' +
            '<div style="font-size:10.5px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Moyennes par critère</div>' +
            critHtml +
            '<div style="font-size:10.5px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:0.8px;margin:14px 0 2px;">Bilans</div>' +
            listHtml +
          '</div>'
        : '') +
    '</div>';
  }

  function renderDebriefForm(u) {
    var userSec = (u && u.section_id) || '';

    return '' +

      '<div style="padding:16px;">' +
        '<p style="font-size:13.5px;color:var(--faint);margin:0 0 16px;line-height:1.5;">Notez les performances des pôles pour un événement, critère par critère. Si vous avez déjà publié un bilan pour cet événement, il sera mis à jour.</p>' +

        (function(){
          var eventPosts = db(SK.POSTS, []).filter(function(p){ return p.type === 'EVENT'; });
          return '<div style="background:var(--card);border-radius:18px;padding:16px;margin-bottom:14px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.04);">' +
            '<label style="font-size:13px;font-weight:800;color:var(--ink);display:block;margin-bottom:8px;">Événement concerné <span style="color:#E2445C;">*</span></label>' +
            '<select id="evalEventSelect" onchange="App.selectEvalEvent(this.value)" style="width:100%;height:44px;border-radius:12px;border:1.5px solid var(--line);background:var(--tile);padding:0 12px;font-size:14px;color:var(--ink);outline:none;font-weight:600;">' +
              '<option value="">Sélectionner l\'événement à évaluer...</option>' +
              eventPosts.map(function(ev){
                var evTitle = ev.eventTitle || (ev.metadata && ev.metadata.title) || 'Événement';
                var evDate = ev.eventDate || (ev.metadata && ev.metadata.date) || '';
                var sel = S.evalEventId === ev.id ? ' selected' : '';
                var already = findOwnBilan(ev.id) ? ' ✓ déjà noté' : '';
                return '<option value="' + ev.id + '"' + sel + '>' + safeHtml(evTitle) + (evDate ? ' (' + evDate + ')' : '') + already + '</option>';
              }).join('') +
            '</select>' +
            (S.evalEventId && findOwnBilan(S.evalEventId)
              ? '<div style="margin-top:10px;background:var(--warn-soft);border:1px solid var(--warn-line);border-radius:12px;padding:10px 12px;font-size:12.5px;color:var(--warn-ink);font-weight:600;line-height:1.45;">Vous avez déjà publié un bilan pour cet événement. Vos notes sont pré-remplies — valider mettra à jour cette publication.</div>'
              : '') +
          '</div>';
        })() +

        SECTIONS.map(function(sec) { return renderEvalSectionCard(sec, userSec); }).join('') +

          // padding-bottom généreux : la barre de navigation du bas est en position
          // fixe et recouvrait la moitié du bouton (on ne pouvait pas l'atteindre).
          '<button id="publishBilanBtn" onclick="App.publishBilan()" style="width:100%;background:#0E9F6E;color:#FFF;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(52,199,89,0.3);">' + (S.evalEventId && findOwnBilan(S.evalEventId) ? 'Mettre à jour le Bilan ✓' : 'Valider &amp; Publier le Bilan ✓') + '</button>' +
          '<div style="height:96px;"></div>' +
        '</div>' +

      '</div>';
  }

  // Une carte de section dans l'écran Notation. Repliée : nom + moyenne.
  // Dépliée : une ligne d'étoiles par critère, notés indépendamment.
  // Indice de Confiance du profil : entièrement basé sur la ponctualité, calculée
  // automatiquement à partir des heures d'arrivée. Aucune saisie manuelle.
  function renderPunctualityCard(freshU, cycleStr) {
    // Bornée au CYCLE en cours : c'est ce qu'annonce l'en-tête de la carte.
    // Le total depuis la création du compte est affiché séparément, en haut du
    // profil à côté de l'avatar.
    var h = punctualityHistory(freshU.id, currentCycleStartTs());
    // La carte s'affiche aussi sur le profil d'un autre membre : les textes
    // passent alors de « votre » à « sa ».
    var estMoi = !!(S.user && freshU && S.user.id === freshU.id);
    // NOTE DU CYCLE : total de points ACCUMULÉS pendant le cycle, sur 30.
    // Chaque service et chaque tâche ajoute (ou retire) ses points ; la jauge se
    // remplit donc au fil du travail fourni, au lieu d'afficher une moyenne.
    var NOTE_MAX = 30;
    var score = Math.min(h.total, NOTE_MAX);
    var col = score >= 24 ? UI.ok : score >= 15 ? UI.warn : UI.bad;
    var label = !h.count ? 'Note de départ'
      : score >= 24 ? 'Excellent'
      : score >= 15 ? 'En bonne voie'
      : score >= 0 ? 'À améliorer'
      : 'Rattrapage requis';

    // Trois « éléments » de la ponctualité, chacun avec son propre graphique,
    // basculables via un sélecteur segmenté : la note (jauge + évolution), la
    // répartition à l'heure/retard/absent (anneau), et le détail par service
    // (barres). L'onglet actif est mémorisé dans S.punctualityChart.
    var chart = S.punctualityChart || 'note';
    var chrono = h.entries.slice().reverse();          // du plus ancien au plus récent
    var lateCount = h.lateCount;
    var starColor = function(s){ return s >= 4 ? UI.ok : s >= 2 ? UI.warn : UI.bad; };
    var shortDate = function(e){
      if (e.startTs) { var d = new Date(e.startTs); return d.getDate() + '/' + (d.getMonth() + 1); }
      return (e.eventDate || '').slice(5).replace('-', '/');
    };
    var empty = function(txt){
      return '<div style="text-align:center;padding:30px 14px;color:' + UI.faint + ';font-size:12.5px;line-height:1.5;">' + txt + '</div>';
    };

    // ---- Sélecteur segmenté (façon iOS : pastille active en relief) ----
    var seg = function(id, txt){
      var on = chart === id;
      return '<button type="button" onclick="App.setPunctualityChart(\'' + jsArg(id) + '\')" ' +
        'style="flex:1;height:32px;border:none;cursor:pointer;border-radius:' + UI.pill + ';font-size:12px;' +
        'font-weight:' + (on ? '700' : '600') + ';color:' + (on ? UI.ink : UI.faint) + ';' +
        'background:' + (on ? UI.card : 'transparent') + ';box-shadow:' + (on ? UI.sh2 : 'none') + ';' +
        'transition:color 0.2s, background 0.2s;">' + txt + '</button>';
    };
    var switcher = '<div style="display:flex;gap:4px;background:' + UI.page + ';border-radius:' + UI.pill + ';padding:4px;margin-bottom:16px;">' +
      seg('note', 'Note') + seg('ontime', "À l'heure") + seg('services', 'Services') +
    '</div>';

    // ============================================================
    // GRAPHIQUE 1 — NOTE : jauge demi-cercle + courbe d'évolution
    // ============================================================
    // JAUGE demi-cercle (aspect de la maquette profil_commit/code.html) tracée
    // en SVG. L'ancienne version superposait deux dégradés coniques tournés :
    // le remplissage n'était pas limité à la moitié haute et débordait des deux
    // côtés (deux « ailes » bleues quelle que soit la note). Ici un seul arc,
    // dont la longueur visible porte la valeur ; il se remplit à l'affichage.
    var pctJauge = Math.max(0, Math.min(1, score / NOTE_MAX));
    var arc = 'M 14 106 A 92 92 0 0 1 198 106';
    var gauge = '<div style="position:relative;width:100%;max-width:240px;margin:16px auto 0;">' +
      '<svg viewBox="0 0 212 116" width="100%" style="display:block;overflow:visible;" aria-hidden="true">' +
        '<path d="' + arc + '" fill="none" stroke="' + UI.tile + '" stroke-width="22" stroke-linecap="round"/>' +
        '<path class="kc-jauge" d="' + arc + '" fill="none" stroke="' + UI.accent + '" stroke-width="22" stroke-linecap="round" ' +
          'pathLength="100" stroke-dasharray="100" stroke-dashoffset="' + (100 - pctJauge * 100).toFixed(1) + '" ' +
          'style="--kc-jauge-depart:100;' + (pctJauge === 0 ? 'opacity:0;' : '') + '"/>' +
      '</svg>' +
      '<div style="position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;">' +
        '<div style="font-family:' + UI.fontDisplay + ';font-size:48px;font-weight:800;letter-spacing:-0.02em;color:' + UI.accent + ';line-height:1;">' + score + '</div>' +
        '<div style="font-size:14px;font-weight:600;color:' + UI.faint + ';margin-top:6px;">/ ' + NOTE_MAX + '</div>' +
      '</div>' +
    '</div>';

    // Courbe d'évolution : point de départ (bonus de bienvenue) puis une note par
    // service, du plus ancien au plus récent. On la trace seulement dès qu'il y a
    // au moins un service — sinon la « courbe » serait un point isolé.
    var _me = db(SK.USERS, []).find(function(u){ return u && u.id === freshU.id; });
    var welcome = (_me && typeof _me.welcomeStars === 'number') ? _me.welcomeStars : 5;
    var evolution = '';
    if (chrono.length) {
      var series = [{ v: welcome, dep: true }].concat(chrono.map(function(e){ return { v: e.stars, dep: false }; }));
      var W = 300, HH = 76, padX = 10, padY = 12;
      var innerW = W - padX * 2, innerH = HH - padY * 2;
      var xAt = function(i){ return padX + (series.length === 1 ? innerW / 2 : innerW * i / (series.length - 1)); };
      var yAt = function(v){ return padY + innerH * (1 - (v + 2) / 7); };
      var zeroY = yAt(0);
      var pts = series.map(function(p, i){ return xAt(i) + ',' + yAt(p.v); });
      var areaPath = 'M' + xAt(0) + ',' + zeroY + ' L' + pts.join(' L') + ' L' + xAt(series.length - 1) + ',' + zeroY + ' Z';
      var dots = series.map(function(p, i){
        return '<circle cx="' + xAt(i) + '" cy="' + yAt(p.v) + '" r="' + (p.dep ? 3 : 3.4) + '" fill="' + (p.dep ? UI.faint : starColor(p.v)) + '" stroke="' + UI.card + '" stroke-width="1.6"/>';
      }).join('');
      evolution = '<div style="margin-top:14px;">' +
        '<div style="font-size:10px;color:' + UI.faint + ';letter-spacing:0.5px;text-transform:uppercase;margin-bottom:6px;">Évolution</div>' +
        '<svg width="100%" viewBox="0 0 ' + W + ' ' + HH + '" preserveAspectRatio="none" style="display:block;">' +
          '<line x1="' + padX + '" y1="' + zeroY + '" x2="' + (W - padX) + '" y2="' + zeroY + '" stroke="' + UI.line + '" stroke-width="1" stroke-dasharray="3 4"/>' +
          '<path d="' + areaPath + '" fill="' + col + '" fill-opacity="0.10"/>' +
          '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
          dots +
        '</svg>' +
        '<div style="display:flex;justify-content:space-between;font-size:9.5px;color:' + UI.faint + ';margin-top:3px;"><span>Départ</span><span>Récent</span></div>' +
      '</div>';
    } else {
      // Sans service, la phrase de synthèse suffit : pas de doublon ici.
      evolution = '';
    }
    // Phrase de synthèse sous la jauge (maquette).
    // Phrase alignée sur le TOTAL de points du cycle (même seuils que l'étiquette).
    var verdict = !h.count
      ? (estMoi ? 'Votre note de départ, en attendant votre premier service.' : 'Note de départ, en attendant son premier service.')
      : (score >= NOTE_MAX ? 'Cycle au maximum : rien à redire.'
        : score >= 24 ? 'Performance exceptionnelle ce cycle.'
        : score >= 15 ? 'Bon rythme : continuez à cumuler des points.'
        : score >= 0 ? 'Encore ' + (15 - score) + ' points pour être en bonne voie.'
        : 'Points négatifs : à redresser rapidement.');
    // La maquette ne montre que la jauge et la phrase de synthèse sur l'onglet
    // « Note » ; la courbe d'évolution n'y figure pas.
    var noteChart = gauge +
      '<p style="text-align:center;font-size:16px;color:' + UI.muted + ';margin:12px 0 0;line-height:1.5;">' + verdict + '</p>';

    // ============================================================
    // GRAPHIQUE 2 — À L'HEURE : anneau de répartition
    // ============================================================
    var onTimeChart;
    var C = 2 * Math.PI * 52;
    var donutSegs = [
      { v: h.onTimeCount, color: UI.ok,  name: "À l'heure" },
      { v: lateCount,     color: UI.warn, name: 'En retard' },
      { v: h.absentCount, color: UI.bad,  name: 'Absent' }
    ];
    var onTimePct = h.count ? Math.round((h.onTimeCount / h.count) * 100) : 0;
    var ringOffset = 0;
    var ring = donutSegs.filter(function(s){ return s.v > 0; }).map(function(s){
      var len = (s.v / (h.count || 1)) * C;
      var el = '<circle cx="70" cy="70" r="52" fill="none" stroke="' + s.color + '" stroke-width="15" ' +
        'stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-ringOffset) + '" ' +
        'transform="rotate(-90 70 70)"/>';
      ringOffset += len;
      return el;
    }).join('');
    var donut = '<div style="position:relative;width:140px;height:140px;margin:4px auto 0;">' +
      '<svg width="140" height="140" viewBox="0 0 140 140">' +
        '<circle cx="70" cy="70" r="52" fill="none" stroke="' + UI.line + '" stroke-width="15"/>' + ring +
      '</svg>' +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
        '<div style="font-family:' + UI.fontMono + ';font-size:28px;font-weight:700;color:' + UI.ink + ';line-height:1;">' + (h.count ? onTimePct + '%' : '—') + '</div>' +
        '<div style="font-size:10px;color:' + UI.faint + ';margin-top:3px;">à l\'heure</div>' +
      '</div>' +
    '</div>';
    var legendRow = function(s){
      return '<div style="display:flex;align-items:center;gap:9px;padding:6px 0;">' +
        '<span style="width:9px;height:9px;border-radius:3px;background:' + s.color + ';flex-shrink:0;"></span>' +
        '<span style="flex:1;font-size:12.5px;color:' + UI.ink2 + ';">' + s.name + '</span>' +
        '<span style="font-size:12.5px;font-weight:700;color:' + UI.ink + ';">' + s.v + '</span>' +
      '</div>';
    };
    if (h.count) {
      onTimeChart = donut +
        '<div style="margin-top:14px;">' + donutSegs.map(legendRow).join('') + '</div>' +
        (h.avgDelay > 0
          ? '<div style="font-size:11.5px;color:' + UI.muted + ';text-align:center;margin-top:8px;border-top:0.5px solid ' + UI.line + ';padding-top:10px;">Retard moyen de <strong style="color:' + UI.warn + ';">' + h.avgDelay + ' min</strong> sur les services concernés.</div>'
          : '');
    } else {
      onTimeChart = donut + empty('Aucun service pointé sur ce cycle.<br>La répartition apparaîtra dès ' + (estMoi ? 'votre' : 'son') + ' premier pointage.');
    }

    // ============================================================
    // GRAPHIQUE 3 — SERVICES : barres divergentes (une par service)
    // ============================================================
    var servicesChart;
    if (chrono.length) {
      var step = 46, padTop = 18, padBot = 32, chartH = 92;
      var yVal = function(v){ return padTop + chartH * (1 - (v + 2) / 7); };
      var baseY = yVal(0);
      var dateY = padTop + chartH + 24;
      var svgW = Math.max(280, chrono.length * step);
      var bars = chrono.map(function(e, i){
        var cx = i * step + step / 2;
        var y = yVal(e.stars), c = starColor(e.stars);
        var top = Math.min(y, baseY), bh = Math.max(3, Math.abs(y - baseY));
        var valStr = (e.stars > 0 ? '+' : '') + e.stars;
        var valY = e.stars >= 0 ? top - 6 : top + bh + 12;
        return '<rect x="' + (cx - 11) + '" y="' + top + '" width="22" height="' + bh + '" rx="5" fill="' + c + '"/>' +
          '<text x="' + cx + '" y="' + valY + '" text-anchor="middle" font-size="11" font-weight="700" fill="' + c + '">' + valStr + '</text>' +
          '<text x="' + cx + '" y="' + dateY + '" text-anchor="middle" font-size="9.5" fill="' + UI.faint + '">' + shortDate(e) + '</text>';
      }).join('');
      servicesChart =
        '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">' +
          '<svg width="' + svgW + '" height="' + (padTop + chartH + padBot) + '" viewBox="0 0 ' + svgW + ' ' + (padTop + chartH + padBot) + '" style="display:block;">' +
            '<line x1="0" y1="' + baseY + '" x2="' + svgW + '" y2="' + baseY + '" stroke="' + UI.line + '" stroke-width="1" stroke-dasharray="3 4"/>' +
            bars +
          '</svg>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-around;text-align:center;margin-top:12px;border-top:0.5px solid ' + UI.line + ';padding-top:12px;">' +
          '<div><div style="font-family:' + UI.fontMono + ';font-size:18px;font-weight:700;color:' + UI.ink + ';">' + h.count + '</div><div style="font-size:10px;color:' + UI.faint + ';">Services</div></div>' +
          '<div><div style="font-family:' + UI.fontMono + ';font-size:18px;font-weight:700;color:' + UI.ok + ';">' + h.onTimeCount + '</div><div style="font-size:10px;color:' + UI.faint + ';">À l\'heure</div></div>' +
          '<div><div style="font-family:' + UI.fontMono + ';font-size:18px;font-weight:700;color:' + col + ';">' + score + '</div><div style="font-size:10px;color:' + UI.faint + ';">Points</div></div>' +
        '</div>';
    } else {
      servicesChart = empty('Aucun service sur ce cycle.<br>' + (estMoi ? 'Vos' : 'Ses') + ' services assurés s\'afficheront ici, notés étoile par étoile.');
    }

    var body = chart === 'ontime' ? onTimeChart : chart === 'services' ? servicesChart : noteChart;

    return '<div style="margin:16px 0 14px;">' +
      '<div style="background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:12px;box-shadow:' + UI.sh2 + ';padding:16px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;">' +
          '<h2 style="font-family:' + UI.fontDisplay + ';font-size:24px;font-weight:600;color:' + UI.ink + ';letter-spacing:-0.4px;line-height:1.15;margin:0;">' + (estMoi ? 'Mes engagements' : 'Engagements') + '</h2>' +
          '<div style="font-family:' + UI.fontMono + ';font-size:13px;color:' + UI.faint + ';text-align:right;line-height:1.35;max-width:44%;min-width:0;overflow-wrap:anywhere;">Cycle ' + cycleStr + ' · ' + label + '</div>' +
        '</div>' +
        switcher +
        '<div style="min-height:170px;">' + body + '</div>' +
        (h.debt < 0
          ? '<div style="display:flex;gap:9px;background:' + UI.card + ';border-radius:' + UI.r2 + ';box-shadow:' + UI.sh2 + ';padding:11px 12px;margin-top:14px;">' +
              ico('alert', 16, UI.bad) +
              '<div style="min-width:0;">' +
                '<div style="font-size:12.5px;font-weight:600;color:var(--bad-ink);margin-bottom:2px;">Rattrapage requis : ' + h.debt + ' étoiles</div>' +
                '<div style="font-size:11.5px;color:' + UI.muted + ';line-height:1.45;">Soyez à l\'heure aux prochains services pour revenir au positif.</div>' +
              '</div>' +
            '</div>'
          : '') +
      '</div>' +
    '</div>';
  }

  // Mention de position à côté d'un membre dans le détail de ponctualité :
  // signale clairement une arrivée enregistrée loin du lieu ou sans position.
  function renderGeoFlag(d) {
    if (d.absent) return '';
    if (!d.geo || !d.geo.available) {
      return '<span style="display:block;color:var(--warn-ink);font-weight:700;font-size:10.5px;">présence non vérifiée</span>';
    }
    if (d.distance === null || d.distance === undefined) {
      return '<span style="display:block;color:var(--faint);font-size:10.5px;">position enregistrée (lieu non défini)</span>';
    }
    if (d.onSite) {
      return '<span style="display:block;color:var(--ok-ink);font-size:10.5px;">sur place (' + formatDistance(d.distance) + ')</span>';
    }
    return '<span style="display:block;color:var(--bad-ink);font-weight:700;font-size:10.5px;">à ' + formatDistance(d.distance) + ' du lieu</span>';
  }

  function renderEvalSectionCard(sec, userSec) {
    // Les Grands Responsables (seuls habilités à noter) évaluent toutes les
    // sections, y compris la leur — l'ancien blocage a été retiré. On garde
    // simplement un repère visuel.
    var isOwn = sec.id === userSec;
    var r = S.ratings[sec.id] || { criteria: {}, comment: '' };
    if (!r.criteria) r.criteria = {};

    // Ponctualité : bloc en lecture seule, calculé automatiquement à partir des
    // heures d'arrivée (publications "À propos de" des membres assignés).
    var punc = S.evalEventId ? sectionPunctuality(sec.id, S.evalEventId) : null;

    // La note affichée en tête combine la ponctualité automatique et les critères
    // saisis à la main — c'est exactement ce qui sera publié dans le bilan.
    var headVals = EVAL_CRITERIA.map(function(c){ return r.criteria[c.id] || 0; }).filter(function(v){ return v > 0; });
    if (punc) headVals.push(punc.average);
    var avg = headVals.length ? Math.round((headVals.reduce(function(a,b){ return a+b; }, 0) / headVals.length) * 10) / 10 : 0;

    var ratedCount = EVAL_CRITERIA.filter(function(c){ return (r.criteria[c.id]||0) > 0; }).length;
    var expanded = S.evalExpandedSection === sec.id;
    var scoreColor = avg >= 4 ? '#0E9F6E' : avg >= 2 ? '#D98A0B' : avg > 0 ? '#E2445C' : 'var(--line)';

    var puncHtml = '';
    if (S.evalEventId) {
      if (punc) {
        var pc = punc.average >= 4 ? '#0E9F6E' : punc.average >= 2 ? '#D98A0B' : punc.average > 0 ? '#E2445C' : '#E2445C';
        puncHtml = '<div style="padding:10px 0;border-top:1px solid var(--tile);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<span style="font-size:13.5px;font-weight:700;color:var(--ink);">Ponctualité <span style="font-size:10px;font-weight:800;color:var(--faint);background:var(--tile);padding:2px 6px;border-radius:6px;">AUTO</span></span>' +
            '<span style="font-size:13px;font-weight:800;color:' + pc + ';">' + punc.average + '/5</span>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">' +
            punc.details.map(function(d) {
              var dc = d.stars >= 4 ? '#0E9F6E' : d.stars >= 2 ? '#D98A0B' : '#E2445C';
              var when = d.absent ? 'aucune publication' : (d.delayMinutes <= 0 ? "à l'heure" : '+' + d.delayMinutes + ' min');
              return '<div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:11.5px;color:var(--muted);gap:8px;">' +
                '<span style="min-width:0;">' + safeHtml(d.name) + (d.task ? ' · ' + safeHtml(d.task) : '') +
                  renderGeoFlag(d) +
                '</span>' +
                '<span style="font-weight:700;color:' + dc + ';white-space:nowrap;">' + d.stars + '★ · ' + when + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      } else {
        puncHtml = '<div style="padding:10px 0;border-top:1px solid var(--tile);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="font-size:13.5px;font-weight:700;color:var(--ink);">Ponctualité <span style="font-size:10px;font-weight:800;color:var(--faint);background:var(--tile);padding:2px 6px;border-radius:6px;">AUTO</span></span>' +
            '<span style="font-size:12px;color:var(--faint);">Aucun membre assigné</span>' +
          '</div>' +
        '</div>';
      }
    }

    var criteriaHtml = puncHtml + EVAL_CRITERIA.map(function(c) {
      var v = r.criteria[c.id] || 0;
      return '<div style="padding:10px 0;border-top:1px solid var(--tile);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<span style="font-size:13.5px;font-weight:700;color:var(--ink);">' + c.nom + '</span>' +
          '<span id="critval-' + sec.id + '-' + c.id + '" style="font-size:13px;font-weight:800;color:' + (v>0?'var(--ink)':'var(--line)') + ';">' + (v>0 ? v+'/5' : '—') + '</span>' +
        '</div>' +
        '<div id="critstars-' + sec.id + '-' + c.id + '" style="display:flex;gap:5px;">' +
          [1,2,3,4,5].map(function(star) {
            return '<button type="button" onclick="App.rateCriterion(\'' + jsArg(sec.id) + '\',\'' + jsArg(c.id) + '\',' + star + ')" style="font-size:26px;cursor:pointer;background:none;border:none;padding:0;line-height:1;color:' + (star<=v?'#FFD700':'var(--line)') + ';">★</button>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');

    return '<div style="background:var(--card);border-radius:18px;margin-bottom:10px;border:1px solid var(--line);box-shadow:0 2px 8px rgba(0,0,0,0.04);overflow:hidden;">' +
      '<div onclick="App.toggleEvalSection(\'' + jsArg(sec.id) + '\')" style="display:flex;align-items:center;justify-content:space-between;padding:16px;cursor:pointer;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div style="width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,' + sec.color + '20,' + sec.color + '10);display:flex;align-items:center;justify-content:center;font-size:20px;">' + sec.emoji + '</div>' +
          '<div><strong style="font-size:14.5px;color:var(--ink);display:block;">' + sec.nom +
            (isOwn ? ' <span style="font-size:10px;font-weight:800;color:#0B63F6;background:var(--accent-soft);padding:2px 7px;border-radius:8px;vertical-align:middle;">Votre pôle</span>' : '') +
          '</strong>' +
          '<span id="evalsub-' + sec.id + '" style="font-size:11.5px;color:var(--faint);">' + (ratedCount > 0 ? ratedCount + '/' + EVAL_CRITERIA.length + ' critères notés' : 'Appuyez pour noter les critères') + '</span></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<div id="evalavg-' + sec.id + '" style="font-family:' + UI.fontMono + ';font-size:20px;font-weight:700;color:' + scoreColor + ';">' + (avg > 0 ? avg+'/5' : '—') + '</div>' +
          '<span style="font-size:13px;color:var(--line);transform:rotate(' + (expanded?'90':'0') + 'deg);transition:transform 0.2s;">›</span>' +
        '</div>' +
      '</div>' +
      (expanded
        ? '<div style="padding:0 16px 16px;">' +
            criteriaHtml +
            '<input type="text" value="' + safeHtml(r.comment||'') + '" onchange="App.rateComment(\'' + jsArg(sec.id) + '\',this.value)" placeholder="Ajouter une observation..." ' +
            'style="width:100%;height:40px;border:1.5px solid var(--line);border-radius:12px;padding:0 12px;font-size:13.5px;color:var(--ink);box-sizing:border-box;outline:none;background:var(--tile);margin-top:12px;" ' +
            'onfocus="this.style.borderColor=\'#0B63F6\'" onblur="this.style.borderColor=\'var(--line)\'">' +
          '</div>'
        : '') +
    '</div>';
  }

  // ============================================================
  // HELPER : Mise à jour activité utilisateur courant
  // ============================================================
  function updateUserActivity(actionLabel) {
    if (!S.user) return;
    var users = db(SK.USERS, []);
    var idx = users.findIndex(function(u){ return u.id === S.user.id; });
    if (idx === -1) return;
    var now = new Date().toISOString();
    users[idx].last_action_at = now;
    users[idx].last_action_label = actionLabel || 'Action';
    users[idx].last_seen_at = now;
    users[idx].is_online = true;
    S.user = users[idx];
    try { localStorage.setItem(SK.SESS, JSON.stringify(S.user)); } catch(e) {}
    dbSet(SK.USERS, users);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    } catch(e) { return iso; }
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) +
             ' à ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    } catch(e) { return iso; }
  }

  function infoRow(icon, label, val) {
    return '<div style="display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:0.5px solid var(--tile);">' +
      '<span style="font-size:18px;width:24px;text-align:center;">' + icon + '</span>' +
      '<div style="flex:1;">' +
        '<div style="font-size:11.5px;color:var(--faint);font-weight:600;margin-bottom:1px;">' + label + '</div>' +
        '<div style="font-size:14px;color:var(--ink);font-weight:600;">' + val + '</div>' +
      '</div>' +
    '</div>';
  }

  function adminKpi(icon, val, label) {
    return '<div style="background:rgba(255,255,255,0.12);border-radius:14px;padding:10px;text-align:center;">' +
      '<div style="font-size:16px;">' + icon + '</div>' +
      '<strong style="font-size:22px;font-weight:900;color:#FFF;display:block;">' + val + '</strong>' +
      '<span style="font-size:10.5px;color:rgba(255,255,255,0.6);">' + label + '</span>' +
    '</div>';
  }

  function adminMiniInfo(icon, text, color) {
    return '<div style="background:var(--card);border-radius:10px;padding:8px 10px;display:flex;align-items:center;gap:6px;">' +
      '<span style="font-size:13px;">' + icon + '</span>' +
      '<span style="font-size:12px;font-weight:700;color:' + (color||'#000') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + text + '</span>' +
    '</div>';
  }

  // ============================================================
  // PROFILE TAB
  // ============================================================
  // BADGES : obtenus d'après l'historique réel des services (rien à saisir).
  // Les badges pas encore obtenus restent visibles, grisés, avec leur condition.
  function badgesMembre(userId) {
    var h = punctualityHistory(userId);
    var cycle = punctualityHistory(userId, currentCycleStartTs());
    var serie = 0;
    for (var i = 0; i < h.entries.length && h.entries[i].status === 'ontime'; i++) serie++;
    return [
      { id:'premier', emoji:'🎬', nom:'Premier service', cond:'Assurer un premier service', ok: h.count >= 1 },
      { id:'dix', emoji:'🔟', nom:'10 services', cond:'Assurer 10 services', ok: h.count >= 10 },
      { id:'serie', emoji:'🔥', nom:'Série de 5', cond:'5 services d\'affilée à l\'heure', ok: serie >= 5 },
      { id:'cycle', emoji:'⏱️', nom:'Cycle à l\'heure', cond:'Au moins 3 services ce cycle, tous à l\'heure', ok: cycle.count >= 3 && cycle.onTimeCount === cycle.count },
      { id:'tache', emoji:'📦', nom:'Livré à temps', cond:'Livrer une tâche avant sa date limite', ok: h.entries.some(function(e){ return e.kind === 'task' && e.status === 'ontime'; }) },
      { id:'pilier', emoji:'🏛️', nom:'Pilier', cond:'Assurer 25 services', ok: h.count >= 25 }
    ];
  }

  function renderBadges(freshU) {
    var badges = badgesMembre(freshU.id);
    var obtenus = badges.filter(function(b){ return b.ok; }).length;
    return '<div id="badges" style="background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:16px;padding:14px 16px;margin-top:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">' +
        '<strong style="font-size:15px;color:' + UI.ink + ';">Badges</strong>' +
        '<span style="font-size:12px;font-weight:700;color:' + UI.faint + ';">' + obtenus + ' / ' + badges.length + '</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">' +
        badges.map(function(b) {
          return '<div title="' + safeHtml(b.cond) + '" class="' + (b.ok ? 'kc-apparait' : '') + '" style="text-align:center;padding:10px 4px;border-radius:12px;background:' + (b.ok ? 'var(--accent-soft)' : UI.tile) + ';' + (b.ok ? '' : 'opacity:0.55;') + '">' +
            '<div style="font-size:24px;line-height:1;' + (b.ok ? '' : 'filter:grayscale(1);') + '">' + b.emoji + '</div>' +
            '<div style="font-size:11.5px;font-weight:800;color:' + UI.ink + ';margin-top:6px;line-height:1.2;">' + safeHtml(b.nom) + '</div>' +
            (b.ok ? '' : '<div style="font-size:10px;color:' + UI.faint + ';margin-top:3px;line-height:1.25;">' + safeHtml(b.cond) + '</div>') +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }

  // HISTORIQUE DES SERVICES : chaque service ou tâche, avec son résultat.
  function renderHistoriqueServices(freshU) {
    var h = punctualityHistory(freshU.id);
    if (!h.count) return '';
    var tout = !!S.historiqueTout;
    var lignes = tout ? h.entries : h.entries.slice(0, 5);
    var pastille = function(e) {
      var c = e.status === 'ontime' ? ['var(--ok-soft)', UI.ok] : e.status === 'late' ? ['var(--warn-soft)', UI.warn] : ['var(--bad-soft)', UI.bad];
      return '<span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;background:' + c[0] + ';color:' + c[1] + ';white-space:nowrap;">' + (e.stars > 0 ? '+' : '') + e.stars + '★</span>';
    };
    return '<div id="historiqueServices" style="background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:16px;padding:14px 16px;margin-top:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">' +
        '<strong style="font-size:15px;color:' + UI.ink + ';">Historique des services</strong>' +
        '<span style="font-size:12px;font-weight:700;color:' + UI.faint + ';">' + h.count + '</span>' +
      '</div>' +
      lignes.map(function(e) {
        var d = e.startTs ? new Date(e.startTs).toLocaleDateString('fr-FR', {day:'numeric', month:'short', year:'numeric'}) : '';
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid ' + UI.tile + ';">' +
          '<div style="min-width:0;">' +
            '<div style="font-size:13px;font-weight:700;color:' + UI.ink + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + safeHtml(e.eventTitle) + (e.task ? ' · <span style="font-weight:600;color:' + UI.muted + ';">' + safeHtml(e.task) + '</span>' : '') + '</div>' +
            '<div style="font-size:11px;color:' + UI.faint + ';">' + d + ' · ' + safeHtml(e.label || '') + '</div>' +
          '</div>' +
          pastille(e) +
        '</div>';
      }).join('') +
      (h.count > 5
        ? '<button type="button" onclick="App.basculerHistorique()" style="width:100%;min-height:40px;margin-top:6px;background:none;border:none;color:' + UI.accent + ';font-size:13px;font-weight:700;cursor:pointer;">' + (tout ? 'Réduire' : 'Voir les ' + h.count + ' services') + '</button>'
        : '') +
    '</div>';
  }

  function renderProfile(u, posts) {
    try {
    if (!u || !u.id) {
      return '<div style="min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center;">' +
        '<div style="width:36px;height:36px;border:3px solid var(--line);border-top-color:#0B63F6;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:12px;"></div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--ink);">Chargement du profil...</div>' +
      '</div>';
    }
    var allProfiles = db(SK.USERS, []);
    var freshU = allProfiles.find(function(p){ return p.id === u.id; }) || u;

    var isMe = S.user && S.user.id === freshU.id;
    var profileTab = S.profileTab || 'tout';

    var ROLE_THEMES = {
      GRAND_RESPONSABLE: {
        primary: '#D4AF37', // Gold
        coverGradient: '#CBA35C',
        badgeBg: '#CBA35C',
        badgeText: '#5A4300'
      },
      RESP_SECTION: {
        primary: '#0B3B60', // Sapphire
        coverGradient: '#0B0D12',
        badgeBg: '#0B63F6',
        badgeText: '#FFF'
      },
      MEMBRE: {
        primary: '#0B63F6', // Standard Blue
        coverGradient: '#0B0D12',
        badgeBg: 'var(--tile)',
        badgeText: '#0B63F6'
      },
      STAGIAIRE: {
        primary: '#D98A0B', // Orange
        coverGradient: '#D98A0B',
        badgeBg: 'var(--warn-soft)',
        badgeText: '#D98A0B'
      }
    };
    var theme = ROLE_THEMES[freshU.role] || ROLE_THEMES['MEMBRE'];

    // ---- Stats ----
    var myPosts = posts.filter(function(p){ return p.userId === freshU.id && p.type !== 'TASK_DONE' && p.type !== 'EVENT_ARCHIVED'; }).sort(function(a,b){return (b.timestamp||0)-(a.timestamp||0)});
    var photosPosts = myPosts.filter(function(p){ return p.mediaUrls && p.mediaUrls.length > 0; });
    var eventPosts = myPosts.filter(function(p){ return p.type === 'EVENT'; });
    var myLikesCount = posts.filter(function(p){ return Array.isArray(p.likedBy) && p.likedBy.indexOf(freshU.id) !== -1; }).length;
    var myCommentsCount = 0;
    posts.forEach(function(p){ myCommentsCount += (p.comments||[]).filter(function(c){ return c.userId === freshU.id; }).length; });

    // ---- Avatar ----
        // ---- Dynamic RH Metrics (15-day cycle) ----
    var now = new Date();
    // Numéro de cycle court (maquette : « Cycle 16 »). Deux cycles par mois :
    // 1–15 puis 16–fin. Le libellé long débordait sur trois lignes.
    // Même libellé que l'écran Bilans (« 16 – fin octobre ») : le profil
    // affichait un numéro (« Cycle 20 ») qui ne correspondait à rien ailleurs.
    var cycleStr = now.getDate() <= 15 ? '1er – 15 ' + now.toLocaleDateString('fr-FR',{month:'long'})
                                       : '16 – fin ' + now.toLocaleDateString('fr-FR',{month:'long'});

    // NOTE : l'ancien « indice de confiance » combinait présences et évaluations
    // (score sur 20, bonus/malus, moyenne des bilans). Il a été remplacé par
    // renderPunctualityCard, entièrement fondé sur la ponctualité automatique.
    // Ses calculs ont été retirés : ils tournaient encore à chaque rendu de profil
    // sans que rien ne les affiche.

    var avatarContent = freshU.avatar_url
      ? '<img src="' + safeUrl(freshU.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
      : '<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,'+(theme.primary)+',#000);color:#FFF;font-size:34px;font-weight:900;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';

    // ---- Cover ----
    var coverBg = freshU.cover_url
      ? 'background:url(\'' + jsArg(urlSure(freshU.cover_url)) + '\') center/cover no-repeat;'
      : 'background:' + theme.coverGradient + ';';

    // ---- Sections badges ----
    // On n'affiche que les sections reconnues (évite le badge "Général" fantôme
    // pour d'anciennes sections supprimées comme Son/Lumière/Montage).
    var uSecs = getUserSections(freshU).filter(function(s){ return SECTIONS.some(function(x){ return x.id === s; }); });
    var secBadges = uSecs.map(function(s){
      var sc = secColor(s) || '#0B63F6';
      return '<span style="background:' + sc + '22;color:' + sc + ';padding:4px 10px;border-radius:12px;font-size:12px;font-weight:800;">' + secNom(s) + '</span>';
    }).join('');

    // ---- Sticky top bar ----
    // Sur SON PROPRE profil, la maquette n'a pas de barre de titre : l'écran
    // s'ouvre directement sur le grand nom. On ne garde la barre (avec retour)
    // que pour le profil d'un autre membre, où elle est indispensable.
    var topBar = isMe ? '' : '<div style="position:sticky;top:0;z-index:200;background:' + UI.card + ';border-bottom:0.5px solid ' + UI.line + ';display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">' +
      (isMe
        ? '<button onclick="App.tab(\'home\')" style="background:none;border:none;width:34px;height:34px;border-radius:' + UI.pill + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
            '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
          '</button>'
        : '<button onclick="App.closeUserProfile()" style="background:none;border:none;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;border-radius:' + UI.pill + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
            '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
          '</button>'
      ) +
      '<div style="font-size:15.5px;font-weight:600;color:' + UI.ink + ';letter-spacing:-0.2px;">' + safeHtml(freshU.prenom) + ' ' + safeHtml(freshU.nom) + '</div>' +
      '<div style="display:flex;gap:8px;">' +
        (isMe ? '<button onclick="App.openEditProfile()" style="background:none;border:none;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;border-radius:' + UI.pill + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '</button>' : '') +
        // Ouvre l'annuaire des membres (avec champ de recherche) : le bouton
        // n'était relié à rien jusqu'ici.
        '<button onclick="App.openMembersList()" title="Rechercher un membre" style="background:none;border:none;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;border-radius:' + UI.pill + ';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';

    // ---- Bandeau de couverture + avatar centré ----
    // L'avatar chevauche la couverture et les deux chiffres l'encadrent, comme
    // sur les références : la lecture part du visage, pas d'un coin de l'écran.
    // Sans borne de date : total des services depuis la création du compte.
    var hStats = punctualityHistory(freshU.id);
    // « Note » du profil = total de points du CYCLE en cours, sur 30 (même
    // valeur que la jauge de la carte « Mes engagements »).
    var noteCycle = Math.min(punctualityHistory(freshU.id, currentCycleStartTs()).total, 30);
    var isFollowing = !!(S.user && S.user.following && S.user.following.indexOf(freshU.id) !== -1);

    // Barre de données façon "readout" caméra : chiffres en chasse fixe.
    var online = estEnLigne(freshU);
    var avatarInner = freshU.avatar_url
      ? '<img src="' + safeUrl(freshU.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;display:block;" />'
      : '<div style="width:100%;height:100%;background:' + (freshU.avatar_color || '#0B63F6') + ';color:#FFF;font-family:' + UI.fontDisplay + ';font-size:30px;font-weight:800;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';
    var roleLbl = ROLE_LABELS[freshU.role] || 'Membre';
    var elevated = freshU.role && freshU.role !== 'MEMBRE';
    // Statistique empilée : chiffre en mono (chasse fixe, léger interlettrage),
    // libellé en petites capitales — exactement comme la maquette.
    var statInline = function(v, l, accent){
      return '<div style="min-width:0;">' +
        '<div style="font-family:' + UI.fontMono + ';font-size:20px;font-weight:700;letter-spacing:0.05em;line-height:1.2;color:' + (accent ? UI.accent : UI.ink) + ';">' + v + '</div>' +
        '<div style="font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:' + UI.muted + ';margin-top:2px;">' + l + '</div>' +
      '</div>';
    };

    // Pastille de rôle : or doux pour l'Admin, bleu doux pour un Responsable
    // (maquette : fond très translucide + fin liseré de la même teinte).
    var pillTint = (freshU.role === 'GRAND_RESPONSABLE') ? '139,105,40' : '11,99,246';
    var pillInk  = (freshU.role === 'GRAND_RESPONSABLE') ? '#8B6928' : UI.accentInk;
    var rolePill = elevated
      ? '<div style="display:inline-flex;align-items:center;background:rgba(' + pillTint + ',0.10);color:' + pillInk + ';border:1px solid rgba(' + pillTint + ',0.22);font-size:14px;font-weight:600;padding:4px 14px;border-radius:999px;margin-top:8px;">' + roleLbl + '</div>'
      : '';

    // HERO — posé sur le fond de page (pas de carte blanche), comme la maquette.
    var hero = '<div style="background:' + UI.page + ';padding:34px 20px 16px;">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;">' +
        '<div style="flex:1;min-width:0;">' +
          '<h1 style="font-family:' + UI.fontDisplay + ';font-size:32px;font-weight:700;letter-spacing:-1px;color:' + UI.ink + ';line-height:1.06;margin:0;overflow-wrap:anywhere;">' + safeHtml(freshU.prenom + ' ' + freshU.nom) + '</h1>' +
          rolePill +
        '</div>' +
        // Cloche puis engrenage des Paramètres, discrets, à gauche de l'avatar.
        (isMe ? renderCloche() : '') +
        (isMe ? '<button onclick="App.openSettings()" aria-label="Paramètres" style="background:none;border:none;width:40px;height:40px;flex-shrink:0;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;margin-top:10px;">' +
          '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="' + UI.muted + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
        '</button>' : '') +
        '<div style="position:relative;flex-shrink:0;">' +
          '<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:' + UI.tile + ';border:2px solid ' + UI.line + ';">' + avatarInner + '</div>' +
          (online && !isMe ? '<span style="position:absolute;bottom:1px;right:1px;width:14px;height:14px;border-radius:50%;background:#22C55E;border:3px solid ' + UI.page + ';"></span>' : '') +
          (isMe ? '<label style="position:absolute;bottom:-2px;right:-2px;background:' + UI.card + ';border:1px solid ' + UI.line2 + ';border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.12);">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' + UI.ink + '" stroke-width="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
            '<input type="file" accept="image/*" onchange="App.handleAvatarSelect(event)" style="display:none;">' +
          '</label>' : '') +
        '</div>' +
      '</div>' +

      (freshU.bio ? '<p style="font-size:16px;color:' + UI.muted + ';line-height:1.5;margin:16px 0 0;max-width:24rem;white-space:pre-wrap;">' + safeHtml(freshU.bio) + '</p>' : '') +

      // Pôle + « membre depuis », ligne discrète sous la bio.
      ((uSecs.length || freshU.joined_at) ? '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;color:' + UI.faint + ';margin-top:10px;">' +
        (uSecs.length ? '<span>' + uSecs.map(function(s){ return secNom(s); }).join(' · ') + '</span>' : '') +
        ((uSecs.length && freshU.joined_at) ? '<span>·</span>' : '') +
        (freshU.joined_at ? '<span>Membre depuis ' + new Date(freshU.joined_at).toLocaleDateString('fr-FR', {month:'long', year:'numeric'}) + '</span>' : '') +
      '</div>' : '') +

      (freshU.skills ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">' +
        freshU.skills.split(',').map(function(s){ var t=(s||'').trim(); return t ? '<span style="background:' + UI.tile + ';color:' + UI.ink + ';font-size:12.5px;font-weight:600;padding:5px 12px;border-radius:999px;">' + safeHtml(t) + '</span>' : ''; }).join('') +
      '</div>' : '') +

      // Statistiques empilées : nombre en mono, libellé en petites capitales.
      '<div style="display:flex;gap:24px;margin-top:24px;">' +
        statInline(myPosts.length, 'Publications') +
        statInline(hStats.count, 'Services') +
        statInline(noteCycle + '<span style="font-size:13px;color:' + UI.faint + ';">/30</span>', 'Note', true) +
      '</div>' +

      // Actions en PILULES pleine largeur.
      '<div style="display:flex;gap:16px;margin-top:24px;">' +
        (isMe
          ? '<button onclick="App.openEditProfile()" style="flex:1;background:' + UI.accent + ';color:#FFF;border:none;border-radius:999px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">Modifier le profil</button>' +
            '<button onclick="App.tab(\'home\');App.openCreate();" style="flex:1;background:' + UI.line + ';color:' + UI.ink + ';border:none;border-radius:999px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">Publier</button>'
          : '<button onclick="App.toggleFollow(\'' + jsArg(freshU.id) + '\')" style="flex:1;background:' + (isFollowing ? UI.line : UI.accent) + ';color:' + (isFollowing ? UI.ink : '#FFF') + ';border:none;border-radius:999px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">' + (isFollowing ? 'Suivi' : 'Suivre') + '</button>' +
            '<button onclick="App.openDirectMessage(\'' + jsArg(freshU.id) + '\')" style="flex:1;background:' + UI.line + ';color:' + UI.ink + ';border:none;border-radius:999px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">Message</button>'
        ) +
      '</div>' +
    '</div>';

    // ---- Info block ----
    // Le nom, le rôle, les pôles et la bio sont désormais dans le bandeau centré
    // ci-dessus : ce bloc ne garde que l'indice de confiance et les informations.
    // Le profil ne porte plus que la carte « Mes engagements » (maquette).
    // Informations, apparence, administration, compte et déconnexion vivent
    // désormais dans la page Paramètres (voir renderSettingsModal).
    var infoBlock = '<div style="background:' + UI.page + ';padding:0 20px 16px;">' +
      renderPunctualityCard(freshU, cycleStr) +
      renderBadges(freshU) +
      renderHistoriqueServices(freshU) +
      // Accès direct aux conditions d'utilisation depuis son propre profil.
      (isMe ? '<button type="button" onclick="ouvrirConditions()" style="display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;margin-top:4px;padding:12px 16px;background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:12px;font-size:14px;font-weight:600;color:' + UI.ink + ';cursor:pointer;text-align:left;">' +
        '<span>📜 Conditions d\'utilisation</span><span style="color:' + UI.faint + ';">›</span>' +
      '</button>' : '') +
    '</div>';

    // ---- Continuous scroll (no tabs) ----
    var tabBar = '';

    // ---- Feed: continuous scroll layout ----
    var feed = '<div style="background:var(--tile);min-height:50vh;padding-bottom:100px;">';

    // Sections « Médias », « Événements » et « Liens partagés » retirées :
    // la maquette ne garde qu'une grille « Publications récentes », et ces
    // blocs reprenaient déjà les mêmes publications sous une autre forme.

    // Section 3: All publications header
    var gridTab = isMe ? (S.profileGridTab || 'posts') : 'posts';
    var selectMode = isMe && gridTab === 'posts' && S.profileSelectMode;
    var selectedIds = S.selectedProfilePostIds || [];
    var savedPostsMap = S.savedPosts || {};
    var savedPosts = posts.filter(function(p){ return savedPostsMap[p.id] && p.type !== 'EVENT_ARCHIVED'; }).sort(function(a,b){return (b.timestamp||0)-(a.timestamp||0);});

    feed += '<div style="background:' + UI.page + ';padding:4px 20px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
      (isMe
        ? '<div style="display:flex;gap:4px;background:' + UI.tile + ';border-radius:12px;padding:3px;">' +
            '<span onclick="App.setProfileGridTab(\'posts\')" style="display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:' + (gridTab==='posts'?UI.card:'transparent') + ';color:' + (gridTab==='posts'?UI.ink:UI.faint) + ';">Publications</span>' +
            '<span onclick="App.setProfileGridTab(\'saved\')" style="display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;background:' + (gridTab==='saved'?UI.card:'transparent') + ';color:' + (gridTab==='saved'?UI.ink:UI.faint) + ';">Enregistrées</span>' +
          '</div>'
        : '<h3 style="font-family:' + UI.fontDisplay + ';font-size:24px;font-weight:600;letter-spacing:-0.4px;color:var(--ink);margin:0;">Publications récentes</h3>') +
      (isMe && gridTab === 'posts' && myPosts.length > 0
        ? '<span onclick="App.toggleProfileSelectMode()" style="font-size:12.5px;font-weight:700;color:' + UI.accent + ';cursor:pointer;flex-shrink:0;">' + (selectMode ? 'Annuler' : 'Sélectionner') + '</span>'
        : '') +
    '</div>';

    var filteredPosts = gridTab === 'saved' ? savedPosts : myPosts;

    if (filteredPosts.length === 0) {
      feed += '<div style="padding:44px 20px;text-align:center;background:' + UI.page + ';">' +
        '<div style="font-size:15px;font-weight:600;color:' + UI.ink + ';margin-bottom:4px;">' + (gridTab === 'saved' ? 'Aucune publication enregistrée' : 'Aucune publication') + '</div>' +
        '<div style="font-size:13.5px;color:' + UI.faint + ';">' + (gridTab === 'saved' ? 'Le signet sur une publication l\'ajoute ici.' : 'Vos publications apparaîtront ici.') + '</div>' +
      '</div>';
    } else {
      // GRILLE de vignettes carrées, 2 colonnes (maquette). Une publication sans
      // média affiche un extrait de son texte sur une tuile ; si le média échoue à
      // charger (URL cassée/expirée), on retombe aussi sur ce texte via onerror.
      feed += '<div style="background:' + UI.page + ';padding:0 20px 24px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        filteredPosts.map(function(p) {
          var isEvent = p.type === 'EVENT' || p.type === 'EVENT_ARCHIVED';
          var isRepost = p.type === 'REPOST';
          // Un événement héberge son image dans eventImage (pas mediaUrls) ; un
          // repartage sans média/texte propres retombe sur ceux de la publication
          // d'origine — sinon sa tuile était toujours vide.
          var media = (p.mediaUrls && p.mediaUrls.length) ? p.mediaUrls[0]
            : (isEvent && p.eventImage) ? p.eventImage
            : (isRepost && p.originalMediaUrls && p.originalMediaUrls.length) ? p.originalMediaUrls[0]
            : null;
          var isVid = media && isVideoUrl(media);
          var bg = p.postBg || (isRepost ? p.originalPostBg : null);
          var textSource = p.caption || (isRepost ? p.originalCaption : '') || p.eventTitle;
          var textFallback = safeHtml(String(textSource || '').trim().slice(0, 90) || 'Publication');
          var inner = media
            ? (isVid
                ? '<video src="' + safeUrl(media) + '"' + (p.videoPoster ? ' poster="' + safeUrl(p.videoPoster) + '"' : '') + ' muted playsinline preload="metadata" onerror="App.handleProfileTileImgError(this)" data-fallback="' + textFallback + '" style="width:100%;height:100%;object-fit:cover;display:block;"></video>' +
                  '<div style="position:absolute;top:8px;right:8px;pointer-events:none;"><svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.95)"><path d="M8 5v14l11-7z"/></svg></div>'
                : '<img src="' + safeUrl(media) + '" loading="lazy" onerror="App.handleProfileTileImgError(this)" data-fallback="' + textFallback + '" style="width:100%;height:100%;object-fit:cover;display:block;" />')
            // Un événement sans image se reconnaît d'un coup d'œil (icône + date).
            : (isEvent
                ? '<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;background:linear-gradient(160deg, rgba(11,99,246,0.12), rgba(11,99,246,0.04));">' +
                    '<span style="font-size:20px;line-height:1;">🗓️</span>' +
                    '<p style="margin:0;color:' + UI.ink + ';font-size:12.5px;font-weight:800;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">' + safeHtml(String(p.eventTitle || 'Événement').slice(0, 60)) + '</p>' +
                    (p.eventDate ? '<span style="font-size:11px;font-weight:700;color:' + UI.accent + ';">' + new Date(p.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', {day:'numeric', month:'short'}) + '</span>' : '') +
                  '</div>'
                // Une publication sans média mais avec un fond coloré (texte stylisé,
                // y compris via un repartage) reprend ce même fond en miniature.
                : (bg
                    ? '<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;' + (String(bg).indexOf('url') === 0 ? 'background:' + bg + ';background-size:cover;background-position:center;' : 'background:' + bg + ';') + '">' +
                        '<p style="margin:0;color:#FFF;font-size:12.5px;font-weight:800;line-height:1.4;text-shadow:0 1px 4px rgba(0,0,0,0.28);overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;">' + textFallback + '</p>' +
                      '</div>'
                    : '<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;line-height:1.45;color:' + UI.muted + ';overflow:hidden;">' + textFallback + '</div>'));
          var isSel = selectedIds.indexOf(p.id) !== -1;
          var action = selectMode
            ? 'App.toggleSelectProfilePost(\'' + jsArg(p.id) + '\')'
            : 'App.goToPost(\'' + jsArg(p.id) + '\')';
          return '<div data-tile onclick="' + action + '" style="position:relative;aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:' + UI.tile + ';cursor:pointer;">' +
            inner +
            (selectMode
              ? '<div style="position:absolute;inset:0;background:' + (isSel ? 'rgba(11,99,246,0.18)' : 'transparent') + ';"></div>' +
                '<div style="position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:12px;background:' + (isSel ? UI.accent : 'rgba(255,255,255,0.92)') + ';border:2px solid ' + (isSel ? UI.accent : UI.line) + ';display:flex;align-items:center;justify-content:center;">' +
                  (isSel ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') +
                '</div>'
              : '') +
          '</div>';
        }).join('') +
      '</div>';
    }

    feed += '</div>';

    // Barre d'action flottante en mode sélection
    if (selectMode) {
      feed += '<div style="position:fixed;left:0;right:0;bottom:64px;z-index:500;display:flex;justify-content:center;padding:0 16px;">' +
        '<div style="width:100%;max-width:460px;background:#0B0D12;border-radius:18px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 8px 24px rgba(0,0,0,0.28);">' +
          '<span style="color:#FFF;font-size:13.5px;font-weight:700;">' + selectedIds.length + ' sélectionnée' + (selectedIds.length>1?'s':'') + '</span>' +
          '<div style="display:flex;gap:8px;">' +
            '<span onclick="App.selectAllProfilePosts()" style="color:var(--faint);font-size:13px;font-weight:700;cursor:pointer;padding:8px 4px;">Tout</span>' +
            '<button onclick="App.openBulkDeleteConfirm()" ' + (selectedIds.length===0?'disabled':'') + ' style="background:#E2445C;color:#FFF;border:none;border-radius:12px;padding:9px 16px;font-size:13px;font-weight:800;cursor:pointer;opacity:' + (selectedIds.length===0?'0.4':'1') + ';">Supprimer</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return topBar + hero + infoBlock + tabBar + feed;
    } catch(profileErr) {
      console.error("Profile Screen render error:", profileErr);
      return '<div style="padding:40px;text-align:center;min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
        '<div style="font-size:16px;font-weight:700;color:var(--ink);margin-bottom:8px;">Impossible d\'afficher le profil</div>' +
        '<p style="font-size:13px;color:var(--faint);margin-bottom:16px;">Une erreur temporaire d\'affichage est survenue.</p>' +
        '<button onclick="App.tab(\'profile\')" style="background:#0B63F6;color:#FFF;border:none;padding:10px 20px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">Réessayer</button>' +
      '</div>';
    }
  }

    // ============================================================
    // SUPPRESSION DE COMPTE — action irréversible, double confirmation
    // ============================================================
    function renderDeleteAccountModal() {
      var u = S.user || {};
      var posts = db(SK.POSTS, []);
      var myPostsCount = posts.filter(function(p){ return p.userId === u.id; }).length;
      var busy = S.deleteAccountBusy;

      return '<div onclick="' + (busy?'':'App.closeDeleteAccount()') + '" style="position:fixed;inset:0;background:rgba(15,15,20,0.65);backdrop-filter:blur(2px);z-index:10002;display:flex;justify-content:center;align-items:center;padding:24px;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:380px;background:var(--card);border-radius:24px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
          '<div style="width:52px;height:52px;border-radius:26px;background:var(--bad-soft);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;">⚠️</div>' +
          '<h3 style="font-size:17px;font-weight:900;color:var(--ink);margin:0 0 8px;text-align:center;">Supprimer définitivement votre compte ?</h3>' +
          '<p style="font-size:13px;color:var(--muted);line-height:1.5;margin:0 0 4px;text-align:center;">' +
            'Cette action est <strong>irréversible</strong>. Votre profil ainsi que ' +
            (myPostsCount > 0 ? '<strong>' + myPostsCount + ' publication' + (myPostsCount>1?'s':'') + '</strong>' : 'toutes vos publications') +
            ' seront supprimés définitivement. Vous ne pourrez pas les récupérer.' +
          '</p>' +
          '<div style="background:var(--tile);border-radius:14px;padding:12px;margin:16px 0 10px;">' +
            '<label style="font-size:11.5px;font-weight:700;color:var(--muted);display:block;margin-bottom:6px;">Tapez <strong style="color:#E2445C;">SUPPRIMER</strong> pour confirmer</label>' +
            '<input id="deleteAccountConfirmInput" type="text" placeholder="SUPPRIMER" ' + (busy?'disabled':'') + ' style="width:100%;height:40px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);padding:0 12px;font-size:14px;font-weight:700;outline:none;box-sizing:border-box;text-transform:uppercase;" />' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">' +
            '<button type="button" onclick="App.confirmDeleteAccount()" ' + (busy?'disabled':'') + ' style="width:100%;background:#E2445C;color:#FFF;border:none;border-radius:14px;padding:13px;font-size:14.5px;font-weight:800;cursor:pointer;opacity:' + (busy?'0.6':'1') + ';">' + (busy ? 'Suppression en cours…' : 'Supprimer définitivement') + '</button>' +
            '<button type="button" onclick="App.closeDeleteAccount()" ' + (busy?'disabled':'') + ' style="width:100%;background:var(--tile);color:var(--ink);border:none;border-radius:14px;padding:13px;font-size:14.5px;font-weight:700;cursor:pointer;">Annuler</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // ============================================================
    // SUPPRESSION GROUPÉE — confirmation pour la sélection multiple depuis le profil
    // ============================================================
    function renderBulkDeleteConfirmModal() {
      var count = (S.selectedProfilePostIds || []).length;
      var busy = S.bulkDeleteBusy;
      return '<div onclick="' + (busy?'':'App.closeBulkDeleteConfirm()') + '" style="position:fixed;inset:0;background:rgba(15,15,20,0.65);backdrop-filter:blur(2px);z-index:10003;display:flex;justify-content:center;align-items:center;padding:24px;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:380px;background:var(--card);border-radius:24px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
          '<div style="width:52px;height:52px;border-radius:26px;background:var(--bad-soft);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;">🗑️</div>' +
          '<h3 style="font-size:17px;font-weight:900;color:var(--ink);margin:0 0 8px;text-align:center;">Supprimer ' + count + ' publication' + (count>1?'s':'') + ' ?</h3>' +
          '<p style="font-size:13px;color:var(--muted);line-height:1.5;margin:0;text-align:center;">' +
            'Cette action est <strong>irréversible</strong>. Les publications et leurs photos/vidéos seront supprimées définitivement.' +
          '</p>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:18px;">' +
            '<button type="button" onclick="App.confirmBulkDelete()" ' + (busy?'disabled':'') + ' style="width:100%;background:#E2445C;color:#FFF;border:none;border-radius:14px;padding:13px;font-size:14.5px;font-weight:800;cursor:pointer;opacity:' + (busy?'0.6':'1') + ';">' + (busy ? 'Suppression en cours…' : 'Supprimer définitivement') + '</button>' +
            '<button type="button" onclick="App.closeBulkDeleteConfirm()" ' + (busy?'disabled':'') + ' style="width:100%;background:var(--tile);color:var(--ink);border:none;border-radius:14px;padding:13px;font-size:14.5px;font-weight:700;cursor:pointer;">Annuler</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // Panneau « Gérer les rôles » : liste les membres et permet à un Grand
    // Responsable de changer leur rôle (via l'Edge Function set-role → JWT).
    function renderRolesModal() {
      var me = S.user || {};
      var rank = { GRAND_RESPONSABLE: 0, RESP_SECTION: 1, MEMBRE: 2, STAGIAIRE: 3 };
      var members = (db(SK.USERS, []) || []).filter(function(m){ return m && m.id; });
      members.sort(function(a, b) {
        var ra = rank[a.role] == null ? 2 : rank[a.role];
        var rb = rank[b.role] == null ? 2 : rank[b.role];
        if (ra !== rb) return ra - rb;
        return (((a.prenom||'') + ' ' + (a.nom||'')).trim()).localeCompare(((b.prenom||'') + ' ' + (b.nom||'')).trim());
      });
      var roleBtn = function(m, role, label) {
        var active = (m.role || 'MEMBRE') === role;
        var busy = S.roleUpdatingId === m.id;
        var isSelf = m.id === me.id;
        var disabled = active || busy || isSelf;
        var bg = active ? '#0B63F6' : 'var(--tile)';
        var col = active ? '#FFF' : 'var(--ink2)';
        return '<button ' + (disabled ? 'disabled ' : '') +
          'onclick="App.setMemberRole(\'' + jsArg(m.id) + '\',\'' + jsArg(role) + '\')" ' +
          'style="flex:1;background:' + bg + ';color:' + col + ';border:none;border-radius:10px;padding:8px 4px;font-size:11px;font-weight:800;cursor:' + (disabled ? 'default' : 'pointer') + ';opacity:' + ((busy || (isSelf && !active)) ? '0.45' : '1') + ';">' + label + '</button>';
      };
      var rows = members.map(function(m) {
        var name = safeHtml((((m.prenom||'') + ' ' + (m.nom||'')).trim()) || 'Membre');
        var color = m.avatar_color || '#0B63F6';
        var initial = (m.prenom || 'M').charAt(0).toUpperCase();
        var isMe = m.id === me.id;
        return '<div style="padding:12px 0;border-bottom:1px solid var(--line);">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
            '<div style="width:36px;height:36px;border-radius:18px;background:' + color + ';color:#FFF;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;">' + initial + '</div>' +
            '<div style="min-width:0;flex:1;">' +
              '<div style="font-size:14px;font-weight:800;color:var(--ink);">' + name + (isMe ? ' <span style="font-size:10px;color:var(--faint);font-weight:700;">(vous)</span>' : '') + '</div>' +
              '<div style="font-family:' + UI.fontMono + ';font-size:11.5px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + safeHtml(m.phone || m.email || '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;">' +
            roleBtn(m, 'STAGIAIRE', 'Stagiaire') +
            roleBtn(m, 'MEMBRE', 'Membre') +
            roleBtn(m, 'RESP_SECTION', 'Responsable') +
            roleBtn(m, 'GRAND_RESPONSABLE', 'Admin') +
          '</div>' +
          (isMe ? '' :
            '<button onclick="App.adminResetPassword(\'' + jsArg(m.id) + '\',\'' + jsArg(((m.prenom||'') + ' ' + (m.nom||'')).trim() || 'Membre') + '\')" style="margin-top:8px;width:100%;min-height:44px;box-sizing:border-box;background:none;border:1px solid var(--line);color:var(--muted);border-radius:10px;padding:10px 12px;font-size:11.5px;font-weight:700;cursor:pointer;">🔑 Réinitialiser le mot de passe</button>') +
        '</div>';
      }).join('');

      return '<div onclick="App.closeRolesPanel()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10004;display:flex;justify-content:center;align-items:flex-end;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;max-height:88vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
          '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeRolesPanel()"><div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div></div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 4px;">' +
            '<h3 style="font-family:' + UI.fontDisplay + ';font-size:18px;font-weight:800;letter-spacing:-0.3px;margin:0;color:var(--ink);">👑 Gérer les rôles</h3>' +
            '<button onclick="App.closeRolesPanel()" style="background:var(--tile);border:none;border-radius:16px;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;font-size:14px;cursor:pointer;">✕</button>' +
          '</div>' +
          '<p style="font-size:12px;color:var(--faint);padding:2px 20px 8px;margin:0;line-height:1.4;">Choisis un rôle pour chaque membre. La personne devra se <b>déconnecter puis reconnecter</b> pour que son nouveau rôle prenne effet.</p>' +
          '<div style="padding:0 20px 28px;">' + (rows || '<p style="text-align:center;color:var(--faint);padding:24px 0;">Aucun membre pour le moment.</p>') + '</div>' +
        '</div>' +
      '</div>';
    }

    // Mot de passe provisoire affiché à l'Admin après une réinitialisation, à
    // communiquer au membre (qui le changera ensuite dans son profil).
    function renderAdminResetPwModal() {
      var r = S.adminResetResult;
      if (!r) return '';
      return '<div onclick="App.closeAdminReset()" style="position:fixed;inset:0;background:rgba(15,15,20,0.6);z-index:10006;display:flex;justify-content:center;align-items:center;padding:24px;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:380px;background:var(--card);border-radius:22px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;">' +
          '<div style="font-size:36px;margin-bottom:8px;">🔑</div>' +
          '<h3 style="font-size:17px;font-weight:900;color:var(--ink);margin:0 0 6px;">Mot de passe provisoire</h3>' +
          '<p style="font-size:13px;color:var(--muted);margin:0 0 16px;line-height:1.5;">Communiquez-le à <strong>' + safeHtml(r.name) + '</strong>. Il pourra le changer dans « Modifier le profil ».</p>' +
          '<div style="display:flex;align-items:center;gap:8px;background:var(--tile);border-radius:12px;padding:14px;margin-bottom:16px;">' +
            '<code style="flex:1;font-size:18px;font-weight:800;letter-spacing:1px;color:var(--ink);word-break:break-all;">' + safeHtml(r.password) + '</code>' +
            '<button onclick="App.copyAdminResetPw()" style="background:' + UI.accent + ';color:#FFF;border:none;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;">Copier</button>' +
          '</div>' +
          '<button onclick="App.closeAdminReset()" style="width:100%;background:var(--tile);color:var(--ink);border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:800;cursor:pointer;">Fermer</button>' +
        '</div>' +
      '</div>';
    }

    function renderStorageStatsModal() {
      var loading = S.storageStatsLoading;
      var totalBytes = S.storageStatsTotalBytes || 0;
      var fileCount = S.storageStatsFileCount || 0;
      // Seuils des forfaits Supabase (indicatif — à ajuster si les tarifs changent)
      var FREE_LIMIT = 1 * 1024 * 1024 * 1024;      // 1 Go
      var PRO_LIMIT = 100 * 1024 * 1024 * 1024;      // 100 Go
      var pctFree = Math.min(100, (totalBytes / FREE_LIMIT) * 100);
      var pctPro = Math.min(100, (totalBytes / PRO_LIMIT) * 100);
      var overFree = totalBytes > FREE_LIMIT;
      var overPro = totalBytes > PRO_LIMIT;
      var overProCost = overPro ? (((totalBytes - PRO_LIMIT) / (1024*1024*1024)) * 0.0213) : 0;

      var bar = function(label, pct, over, sub) {
        return '<div style="margin-bottom:14px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">' +
            '<span style="font-size:12.5px;font-weight:700;color:var(--ink2);">' + label + '</span>' +
            '<span style="font-size:12px;font-weight:800;color:' + (over?'#E2445C':'var(--faint)') + ';">' + pct.toFixed(1) + '%</span>' +
          '</div>' +
          '<div style="height:8px;border-radius:4px;background:var(--line);overflow:hidden;">' +
            '<div style="height:100%;width:' + pct + '%;background:' + (over?'#E2445C':'#0B63F6') + ';border-radius:4px;transition:width 0.4s;"></div>' +
          '</div>' +
          (sub ? '<div style="font-size:11px;color:var(--faint);margin-top:4px;">' + sub + '</div>' : '') +
        '</div>';
      };

      return '<div onclick="App.closeStorageStats()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);backdrop-filter:blur(2px);z-index:10004;display:flex;justify-content:center;align-items:flex-end;">' +
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:28px;border-top-right-radius:28px;max-height:88vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.18);animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
          '<div style="display:flex;justify-content:center;padding:10px 0 0;cursor:pointer;" onclick="App.closeStorageStats()">' +
            '<div style="width:38px;height:5px;background:var(--line2);border-radius:3px;"></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px 4px;">' +
            '<h3 style="font-size:16px;font-weight:900;margin:0;color:var(--ink);">Stockage (Admin)</h3>' +
            '<button onclick="App.closeStorageStats()" style="background:var(--tile);border:none;border-radius:16px;width:44px;height:44px;flex-shrink:0;touch-action:manipulation;font-size:14px;cursor:pointer;">✕</button>' +
          '</div>' +
          '<div style="padding:6px 20px 28px;">' +
            (loading ? '<div style="display:flex;align-items:center;gap:10px;justify-content:center;padding:30px 0;">' +
              '<div style="width:20px;height:20px;border:3px solid var(--line2);border-top-color:#0B63F6;border-radius:50%;animation:spin 0.8s linear infinite;"></div>' +
              '<span style="font-size:13px;font-weight:700;color:var(--muted);">Calcul en cours…</span>' +
            '</div>' :
            S.storageStatsError ? '<div style="text-align:center;padding:20px 0;">' +
              '<p style="font-size:13px;color:#E2445C;font-weight:600;margin:0 0 14px;">' + safeHtml(S.storageStatsError) + '</p>' +
              '<button onclick="App.loadStorageStats()" style="background:var(--tile);border:none;border-radius:12px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;">Réessayer</button>' +
            '</div>' :
            (
              '<div style="text-align:center;padding:8px 0 20px;">' +
                '<div style="font-size:32px;font-weight:900;color:var(--ink);letter-spacing:-0.5px;">' + formatBytes(totalBytes) + '</div>' +
                '<div style="font-size:12.5px;color:var(--faint);font-weight:600;margin-top:2px;">' + fileCount + ' fichier' + (fileCount>1?'s':'') + ' dans le bucket post-media</div>' +
              '</div>' +
              bar('Forfait Gratuit (1 Go)', pctFree, overFree, overFree ? 'Dépassé — passage au forfait Pro nécessaire.' : (FREE_LIMIT-totalBytes > 0 ? formatBytes(FREE_LIMIT-totalBytes) + ' restants' : '')) +
              bar('Forfait Pro (100 Go inclus)', pctPro, overPro, overPro ? '≈ +' + overProCost.toFixed(2) + ' $/mois de dépassement' : formatBytes(PRO_LIMIT-totalBytes) + ' restants') +
              '<div style="font-size:11px;color:var(--faint);text-align:center;margin-top:16px;">Mis à jour ' + (S.storageStatsUpdatedAt ? timeAgo(S.storageStatsUpdatedAt) : '—') + '</div>'
            )) +
            '<div style="display:flex;gap:8px;margin-top:20px;">' +
              '<button onclick="App.loadStorageStats()" ' + (loading?'disabled':'') + ' style="flex:1;background:var(--tile);color:var(--ink);border:none;border-radius:14px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;">🔄 Actualiser</button>' +
              '<button onclick="App.closeStorageStats()" style="flex:1;background:var(--bad-soft);color:#E2445C;border:none;border-radius:14px;padding:12px;font-size:13.5px;font-weight:700;cursor:pointer;">Fermer</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function renderEditProfileModal(u) {
    var freshU = db(SK.USERS, []).find(function(p){ return p.id === u.id; }) || u;
    
    var displayAvatar = S.avatarPreview || freshU.avatar_url;

    var avatarContent = displayAvatar 
      ? '<img id="editAvatarPreview" src="' + safeUrl(displayAvatar) + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '<div id="editAvatarPreview" style="width:100%;height:100%;background:linear-gradient(135deg,'+(freshU.avatar_color||'#0B63F6')+',#0B63F6);color:#FFF;font-size:32px;font-weight:900;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';

    var displayCover = S.coverPreview || freshU.cover_url;
    var coverContent = displayCover
      ? '<img src="' + safeUrl(displayCover) + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '';

    return '<div class="safe-top" style="position:fixed;inset:0;background:var(--card);z-index:10000;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      '<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--card);z-index:2;">' +
        '<button onclick="App.closeEditProfile()" style="background:none;border:none;font-size:16px;color:var(--ink);cursor:pointer;">Annuler</button>' +
        '<div style="font-weight:700;font-size:16px;">Modifier le profil</div>' +
        '<button onclick="App.saveProfile(this)" style="background:none;border:none;font-size:16px;font-weight:700;color:#0B63F6;cursor:pointer;">Terminer</button>' +
      '</header>' +
      '<div style="flex:1;overflow-y:auto;background:var(--tile);">' +
        
        '<!-- Avatar Area -->' +
        '<div style="display:flex;justify-content:center;margin-top:24px;margin-bottom:20px;">' +
          '<div style="position:relative;">' +
            '<div style="width:90px;height:90px;border-radius:45px;border:4px solid var(--tile);overflow:hidden;background:var(--card);">' +
               avatarContent +
            '</div>' +
            '<label style="position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:14px;background:#0B63F6;border:2px solid var(--tile);color:#FFF;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.2);">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
              '<input type="file" id="editAvatarInput" accept="image/*" style="display:none;" onchange="App.handleAvatarSelect(event)" />' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div style="padding:0 16px 30px;">' +
          '<div style="background:var(--card);border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
            '<div style="display:flex;flex-direction:column;gap:16px;">' +
              (function(){
                var eData = S.editProfileData || {};
                var prenomVal = eData.prenom !== undefined ? eData.prenom : (freshU.prenom||'');
                var nomVal = eData.nom !== undefined ? eData.nom : (freshU.nom||'');
                var bioVal = eData.bio !== undefined ? eData.bio : (freshU.bio||'');
                var skillsVal = eData.skills !== undefined ? eData.skills : (freshU.skills||'');
                return '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  '<label style="font-size:13px;color:var(--faint);font-weight:600;">Prénom</label>' +
                  '<input type="text" id="editPrenom" value="' + safeHtml(prenomVal) + '" style="border:none;border-bottom:1px solid var(--line);font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  '<label style="font-size:13px;color:var(--faint);font-weight:600;">Nom</label>' +
                  '<input type="text" id="editNom" value="' + safeHtml(nomVal) + '" style="border:none;border-bottom:1px solid var(--line);font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  '<label style="font-size:13px;color:var(--faint);font-weight:600;">Bio</label>' +
                  '<textarea id="editBio" style="border:none;font-size:16px;outline:none;resize:none;font-family:inherit;min-height:60px;background:var(--tile);padding:12px;border-radius:12px;">' + safeHtml(bioVal) + '</textarea>' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  '<label style="font-size:13px;color:var(--faint);font-weight:600;">Savoir-faire</label>' +
                  '<textarea id="editSavoirFaire" placeholder="Ex. Montage vidéo, Cadrage, Éclairage, Son…" style="border:none;font-size:16px;outline:none;resize:none;font-family:inherit;min-height:50px;background:var(--tile);padding:12px;border-radius:12px;">' + safeHtml(skillsVal) + '</textarea>' +
                '</div>';
              })() +
            '</div>' +
          '</div>' +

          '<div style="background:var(--card);border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
            '<label style="font-size:14px;font-weight:700;color:var(--ink);display:block;margin-bottom:12px;">Sections (2 max)</label>' +
            '<div id="editSectionBadgesContainer">' + App.renderSectionBadges(S.editSections, 'toggleEditSection') + '</div>' +
          '</div>' +

          '<div style="background:var(--card);border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-top:16px;">' +
            '<label style="font-size:14px;font-weight:700;color:var(--ink);display:block;margin-bottom:12px;">Connexion</label>' +
            '<div style="display:flex;flex-direction:column;gap:16px;">' +
              '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<label style="font-size:13px;color:var(--faint);font-weight:600;">Numéro de téléphone</label>' +
                '<div style="display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid var(--line);">' +
                  '<span style="font-family:' + UI.fontMono + ';font-size:16px;color:var(--ink);">' + safeHtml(freshU.phone || '—') + '</span>' +
                '</div>' +
                '<span style="font-size:11.5px;color:var(--faint);margin-top:4px;">C\'est votre identifiant de connexion. Pour le changer, contactez un Admin.</span>' +
              '</div>' +
              '<div style="display:flex;flex-direction:column;gap:4px;">' +
                '<label style="font-size:13px;color:var(--faint);font-weight:600;">Nouveau mot de passe</label>' +
                '<input type="password" id="editNewPwd" placeholder="Laisser vide pour ne pas changer" autocomplete="new-password" style="border:none;border-bottom:1px solid var(--line);font-size:16px;outline:none;padding-bottom:8px;border-radius:0;background:none;" />' +
                '<span style="font-size:11.5px;color:var(--faint);margin-top:4px;">8 caractères minimum.</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div style="background:var(--card);border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-top:16px;">' +
            '<label style="font-size:14px;font-weight:700;color:var(--ink);display:block;margin-bottom:4px;">Questions de sécurité</label>' +
            '<p style="font-size:11.5px;color:var(--faint);margin:0 0 14px;line-height:1.4;">Servent à récupérer votre mot de passe sans e-mail. Renseignez les deux pour les (re)définir ; laissez vide pour ne rien changer.</p>' +
            renderSecurityQAFields('edit', '', '') +
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
  }

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
        '<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:' + UI.faint + ';margin:0 4px 8px;">' + titre + '</div>' +
        '<div style="background:' + UI.card + ';border:1px solid ' + UI.line + ';border-radius:12px;box-shadow:' + UI.sh2 + ';overflow:hidden;">' + contenu + '</div>' +
      '</div>';
    };
    // Ligne cliquable : libellé à gauche, valeur ou chevron à droite.
    var ligne = function(icone, libelle, droite, action, danger) {
      var col = danger ? UI.bad : UI.ink;
      return '<div ' + (action ? 'onclick="' + action + '" ' : '') + 'style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid ' + UI.line + ';' + (action ? 'cursor:pointer;' : '') + '">' +
        '<div style="width:32px;height:32px;border-radius:50%;background:' + UI.tile + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + icone + '</div>' +
        '<div style="flex:1;min-width:0;font-size:15px;font-weight:500;color:' + col + ';">' + libelle + '</div>' +
        (droite ? '<div style="font-size:14px;color:' + UI.faint + ';flex-shrink:0;text-align:right;">' + droite + '</div>' : '') +
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
        '<div aria-hidden="true" style="flex-shrink:0;width:51px;height:31px;border-radius:999px;background:' + (S.darkMode ? '#0B63F6' : 'var(--line2)') + ';position:relative;transition:background 0.2s ease;">' +
          '<div style="position:absolute;top:2px;left:' + (S.darkMode ? '22px' : '2px') + ';width:27px;height:27px;border-radius:50%;background:#FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.25);transition:left 0.2s ease;"></div>' +
        '</div>' +
      '</div>';

    var apparence = switchTheme +
      ligne(svg('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'), 'Vider le cache', '›', 'App.viderCacheApp()') +
      '<div style="font-size:11px;color:' + UI.faint + ';padding:9px 16px 10px;line-height:1.4;">Utile si l\'app affiche une ancienne version.</div>';

    var admin = isAdmin
      ? ligne(svg('<path d="M3 6l4 3 5-6 5 6 4-3v12H3z"/>'), 'Gérer les rôles', '›', 'App.closeSettings();App.openRolesPanel()') +
        ligne(svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>'), 'Stockage', '›', 'App.closeSettings();App.openStorageStats()') +
        ligne(svg('<path d="M12 5v14M5 12h14"/>'), 'Quitter le rôle Admin', '›', 'App.revokeGrandResponsable()')
      : '';

    var compte = ligne(svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'), 'Modifier le profil', '›', 'App.closeSettings();App.openEditProfile()') +
      ligne('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + UI.bad + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>', 'Supprimer mon compte', '', 'App.closeSettings();App.openDeleteAccount()', true);

    return '<div class="safe-top" style="position:fixed;inset:0;z-index:10005;background:' + UI.page + ';display:flex;flex-direction:column;animation:fadeIn 0.2s ease-out;">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:' + UI.card + ';border-bottom:1px solid ' + UI.line + ';">' +
        '<button onclick="App.closeSettings()" aria-label="Retour" style="background:' + UI.tile + ';border:none;width:44px;height:44px;flex-shrink:0;border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + UI.ink + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<h1 style="font-family:' + UI.fontDisplay + ';font-size:24px;font-weight:600;letter-spacing:-0.4px;color:' + UI.ink + ';margin:0;">Paramètres</h1>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px 20px 40px;">' +
        section('Informations', infos) +
        section('Apparence', apparence) +
        (admin ? section('Administration', admin) : '') +
        section('Compte', compte) +
        '<button onclick="App.logout()" style="width:100%;background:var(--bad-soft);color:#E2445C;border:none;border-radius:999px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px;">Se déconnecter</button>' +
      '</div>' +
    '</div>';
  }

  function renderPostOptionsModal(post) {
    if (!post) return '';
    var isMine = S.user && S.user.id === post.userId;
    return '<div onclick="App.closePostOptions()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:var(--card);border-top-left-radius:20px;border-top-right-radius:20px;padding:16px;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 20px;"></div>' +
        (isMine ? '<button onclick="App.deletePost(\''+jsArg(post.id)+'\')" style="width:100%;padding:14px;color:#E2445C;font-size:16px;font-weight:600;background:var(--tile);border:none;border-radius:12px;margin-bottom:8px;cursor:pointer;">Supprimer le post</button>' : '') +
        '<button onclick="App.viewPost(\''+jsArg(post.id)+'\')" style="width:100%;padding:14px;color:var(--ink);font-size:16px;font-weight:600;background:var(--tile);border:none;border-radius:12px;margin-bottom:8px;cursor:pointer;">Voir le post</button>' +
        '<button onclick="App.closePostOptions()" style="width:100%;padding:14px;color:var(--ink);font-size:16px;font-weight:600;background:var(--tile);border:none;border-radius:12px;cursor:pointer;">Annuler</button>' +
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
     '<li>Elle sert uniquement à vérifier que vous êtes sur place (dans un rayon de 1,5 km du lieu). La distance au lieu est visible des autres membres.</li>' +
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
        '<div class="kc-conditions" style="font-size:14.5px;line-height:1.55;color:var(--ink2,#2A313B);">' + s[1] + '</div>' +
      '</section>';
    }).join('');
    fond.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--card,#FFF);border-bottom:1px solid var(--line,#E4E7EC);">' +
        '<button type="button" data-fermer aria-label="Fermer" style="background:var(--tile,#EFF1F5);border:none;width:44px;height:44px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<div style="min-width:0;">' +
          '<h1 style="font-family:var(--font-display,sans-serif);font-size:21px;font-weight:700;margin:0;">Conditions d\'utilisation</h1>' +
          '<div style="font-size:12.5px;color:var(--faint,#8A93A0);margin-top:2px;">Version du ' + CONDITIONS_VERSION + '</div>' +
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
    { couleur: '#0B63F6', titre: 'Bienvenue sur Commit',
      texte: 'L\'application du Département Communication : le planning des services, tes convocations, le pointage et la vie de l\'équipe, au même endroit.',
      icone: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    { couleur: '#0E9F6E', titre: 'Ta mission en un coup d\'œil',
      texte: 'Quand un responsable te convoque, ta mission apparaît en haut de l\'Accueil avec ta tâche, l\'heure et l\'itinéraire. Tout le calendrier est dans l\'onglet Planning.',
      icone: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/>' },
    { couleur: '#D98A0B', titre: 'Pointe ton arrivée',
      texte: 'Le bouton « Je suis arrivé » s\'ouvre 3 h avant le début. Ta position est vérifiée dans un rayon de 1,5 km autour du lieu. Arriver à l\'heure rapporte +5.',
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
              '<h2 style="font-family:var(--font-display,sans-serif);font-size:26px;font-weight:800;letter-spacing:-0.5px;margin:0 0 12px;">' + e.titre + '</h2>' +
              '<p style="font-size:16px;line-height:1.55;color:var(--muted,#5B6572);max-width:22rem;margin:0;">' + e.texte + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div style="padding:16px 24px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:18px;">' +
        '<div data-points style="display:flex;gap:8px;">' +
          VISITE_ECRANS.map(function(e, i){ return '<span style="height:8px;width:' + (i ? 8 : 24) + 'px;border-radius:4px;background:' + (i ? 'var(--line2,#D6DBE3)' : 'var(--accent,#0B63F6)') + ';transition:width 0.25s,background 0.25s;"></span>'; }).join('') +
        '</div>' +
        '<button type="button" data-suivant style="width:100%;max-width:360px;min-height:52px;background:#0B63F6;color:#FFF;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;">Suivant</button>' +
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
        points[k].style.background = k === courant ? 'var(--accent,#0B63F6)' : 'var(--line2,#D6DBE3)';
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
        '<span style="font-size:15.5px;line-height:1.5;padding-top:3px;">' + texte + '</span></li>';
    };
    fond.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--card,#FFF);border-bottom:1px solid var(--line,#E4E7EC);">' +
        '<button type="button" data-fermer aria-label="Fermer" style="background:var(--tile,#EFF1F5);border:none;width:44px;height:44px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:inherit;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<h1 style="font-family:var(--font-display,sans-serif);font-size:21px;font-weight:700;margin:0;">Installer Commit</h1>' +
      '</div>' +
      '<div style="flex:1;overflow-y:auto;padding:20px 20px 40px;">' +
        '<p style="font-size:15.5px;line-height:1.55;color:var(--muted,#5B6572);margin:0 0 18px;">Installée sur l\'écran d\'accueil, l\'application s\'ouvre comme une vraie app, en plein écran, et pourra bientôt t\'envoyer tes convocations et rappels.</p>' +
        '<h2 style="font-size:16px;font-weight:700;margin:0 0 12px;">' + (ios ? 'Sur iPhone (Safari)' : 'Sur Android (Chrome)') + '</h2>' +
        '<ol style="list-style:none;padding:0;margin:0;">' +
          (ios
            ? etape(1, 'Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut), en bas de Safari.') +
              etape(2, 'Fais défiler et choisis <b>Sur l\'écran d\'accueil</b>.') +
              etape(3, 'Touche <b>Ajouter</b> : l\'icône Commit apparaît avec tes autres applications.')
            : etape(1, 'Touche le menu <b>⋮</b> en haut à droite de Chrome.') +
              etape(2, 'Choisis <b>Installer l\'application</b> (ou <b>Ajouter à l\'écran d\'accueil</b>).') +
              etape(3, 'Confirme : l\'icône Commit apparaît avec tes autres applications.')) +
        '</ol>' +
        '<p style="font-size:13.5px;color:var(--faint,#8A93A0);margin:8px 0 0;">' + (ios ? 'Sur Android : menu ⋮ de Chrome, puis « Installer l\'application ».' : 'Sur iPhone : bouton Partager de Safari, puis « Sur l\'écran d\'accueil ».') + '</p>' +
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
    var auj = new Date().toISOString().split('T')[0];
    var liste = (moi.indisponibilites || []).filter(function(x){ return x && x.date >= auj; })
      .sort(function(a, b){ return a.date < b.date ? -1 : 1; });
    return '<div onclick="App.fermerIndispos()" style="position:fixed;inset:0;background:rgba(15,15,20,0.55);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Mes indisponibilités" style="width:100%;max-width:460px;max-height:85vh;overflow-y:auto;background:var(--card);border-radius:20px 20px 0 0;padding:16px 20px calc(24px + env(safe-area-inset-bottom));animation:slideUp 0.28s cubic-bezier(0.22,1,0.36,1);">' +
        '<div style="width:40px;height:4px;background:var(--line);border-radius:2px;margin:0 auto 16px;"></div>' +
        '<h2 style="font-family:' + UI.fontDisplay + ';font-size:20px;font-weight:700;color:var(--ink);margin:0 0 4px;">Mes indisponibilités</h2>' +
        '<p style="font-size:13.5px;color:var(--muted);line-height:1.5;margin:0 0 14px;">Les responsables les voient quand ils convoquent l\'équipe.</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px;background:var(--tile);border-radius:14px;padding:12px;">' +
          '<label for="indispoDate" style="font-size:12.5px;font-weight:700;color:var(--ink);">Date</label>' +
          '<input id="indispoDate" type="date" min="' + auj + '" style="min-height:44px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--card);color:var(--ink);font-size:16px;">' +
          '<label for="indispoMotif" style="font-size:12.5px;font-weight:700;color:var(--ink);">Motif <span style="font-weight:500;color:var(--faint);">(facultatif)</span></label>' +
          '<input id="indispoMotif" type="text" maxlength="80" placeholder="Ex. voyage, examen" style="min-height:44px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--card);color:var(--ink);font-size:16px;">' +
          '<button type="button" onclick="App.ajouterIndispo()" style="min-height:44px;background:#0B63F6;color:#FFF;border:none;border-radius:12px;font-size:14.5px;font-weight:800;cursor:pointer;margin-top:4px;">Ajouter cette date</button>' +
        '</div>' +
        '<div style="margin-top:14px;">' +
          (liste.length
            ? liste.map(function(x) {
                var d = new Date(x.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                return '<div class="kc-apparait" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);">' +
                  '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:14.5px;font-weight:700;color:var(--ink);">' + safeHtml(d.charAt(0).toUpperCase() + d.slice(1)) + '</div>' +
                    (x.motif ? '<div style="font-size:12.5px;color:var(--muted);">' + safeHtml(x.motif) + '</div>' : '') +
                  '</div>' +
                  '<button type="button" onclick="App.retirerIndispo(\'' + jsArg(x.date) + '\')" aria-label="Retirer cette date" style="width:44px;height:44px;flex-shrink:0;background:none;border:none;border-radius:50%;color:var(--bad-ink);font-size:20px;cursor:pointer;">×</button>' +
                '</div>';
              }).join('')
            : '<p style="font-size:13.5px;color:var(--faint);text-align:center;margin:10px 0 0;">Aucune date à venir.</p>') +
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
        '<h2 style="font-family:var(--font-display,sans-serif);font-size:20px;font-weight:700;margin:0 0 6px;">Tu sembles loin du lieu</h2>' +
        '<p style="font-size:14.5px;line-height:1.5;color:var(--muted,#5B6572);margin:0 0 16px;">Ta position est à <b>' + formatDistance(h.distance || 0) + '</b> du lieu (il faut être à moins de ' + formatDistance(ON_SITE_RADIUS_M) + '). Un pointage hors zone compte comme une absence. Rapproche-toi et réessaie.</p>' +
        '<button type="button" data-reessayer style="width:100%;min-height:48px;background:#0B63F6;color:#FFF;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;">Réessayer</button>' +
        '<button type="button" data-forcer style="width:100%;min-height:44px;margin-top:8px;background:none;border:none;font-size:14px;font-weight:700;color:var(--bad-ink,#B42318);cursor:pointer;">Pointer quand même</button>' +
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
      '<div class="kc-pointage-carte" style="background:var(--card,#FFF);color:var(--ink,#0C1116);border-radius:24px;padding:24px 28px;box-shadow:0 20px 60px rgba(0,0,0,0.25);text-align:center;min-width:240px;max-width:86vw;font-family:var(--font-body,sans-serif);">' +
        '<svg width="72" height="72" viewBox="0 0 52 52" style="display:block;margin:0 auto 10px;">' +
          '<circle cx="26" cy="26" r="24" fill="' + (positif ? '#0E9F6E' : '#E2445C') + '"/>' +
          (positif
            ? '<path class="kc-coche" d="M15 27l7 7 15-16" fill="none" stroke="#FFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'
            : '<path class="kc-coche" d="M18 18l16 16M34 18L18 34" fill="none" stroke="#FFF" stroke-width="4.5" stroke-linecap="round"/>') +
        '</svg>' +
        '<div style="font-size:17px;font-weight:800;">Arrivée enregistrée</div>' +
        '<div class="kc-points" style="font-family:var(--font-mono,monospace);font-size:28px;font-weight:700;color:' + (positif ? '#0E9F6E' : '#E2445C') + ';margin:4px 0;">' + (points > 0 ? '+' : '') + points + '★</div>' +
        '<div style="font-size:13.5px;color:var(--muted,#5B6572);">' + safeHtml(detail || '') + '</div>' +
      '</div>';
    document.body.appendChild(el);
    setTimeout(function(){ el.style.transition = 'opacity 0.3s'; el.style.opacity = '0'; }, 2200);
    setTimeout(function(){ el.remove(); }, 2600);
  }
