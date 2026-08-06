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

    return '<div onclick="App.closeOptions()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;padding:12px 16px 24px;animation:slideUp 0.25s;">' +
        '<div style="display:flex;justify-content:center;margin-bottom:16px;"><div style="width:40px;height:4px;background:#D1D1D6;border-radius:2px;"></div></div>' +
        '<p style="text-align:center;font-size:12px;color:#8E8E93;margin:0 0 14px;font-weight:600;">' + safeHtml(post.author||'Publication') + '</p>' +

        // Share
        '<button onclick="App.shareExternal(\''+post.id+'\');App.closeOptions();" style="width:100%;background:#F8F8F8;border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.share + '<span style="font-size:15px;font-weight:600;color:#000;">Partager</span>' +
        '</button>' +

        // Copier le lien (utilisable sur WhatsApp etc., avec aperçu miniature)
        '<button onclick="App.copyPostLink(\''+post.id+'\');App.closeOptions();" style="width:100%;background:#F8F8F8;border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.link + '<span style="font-size:15px;font-weight:600;color:#000;">Copier le lien</span>' +
        '</button>' +

        // Save / Unsave
        '<button onclick="App.save(\''+post.id+'\');App.closeOptions();" style="width:100%;background:#F8F8F8;border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
          SVG.bookmark(S.savedPosts[post.id]) +
          '<span style="font-size:15px;font-weight:600;color:#000;">' + (S.savedPosts[post.id] ? 'Retirer des favoris' : 'Enregistrer') + '</span>' +
        '</button>' +

        (canDelete
          ? '<button onclick="App.openEditPost(\''+post.id+'\');App.closeOptions();" style="width:100%;background:#F8F8F8;border:none;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
              '<span style="font-size:15px;font-weight:600;color:#000;">✏️ Modifier la publication</span>' +
            '</button>' +
            '<button onclick="App.deletePost(\''+post.id+'\')" style="width:100%;background:#FFF5F5;border:1px solid #FFE0E0;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px;text-align:left;">' +
              SVG.trash + '<span style="font-size:15px;font-weight:700;color:#FF3B30;">Supprimer</span>' +
            '</button>'
          : '') +

        '<button onclick="App.closeOptions()" style="width:100%;background:#F2F2F7;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:700;color:#007AFF;cursor:pointer;">Annuler</button>' +
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

    var commentItems = (post.comments || []).length > 0
      ? post.comments.map(function(c) { return renderCommentItem(c); }).join('')
      : '<div style="display:flex;flex-direction:column;align-items:center;padding:44px 20px;text-align:center;"><div style="font-size:44px;margin-bottom:10px;">💬</div><strong style="font-size:15px;color:#000;">Aucun commentaire</strong><p style="font-size:13px;color:#8E8E93;margin:4px 0 0;">Soyez le premier à commenter !</p></div>';

    var emojis = ['❤️','👏','🔥','🙌','😍','😂','😮','💪'];

    return '<div onclick="App.closeComments()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:28px;border-top-right-radius:28px;height:82vh;display:flex;flex-direction:column;animation:slideUp 0.3s;">' +

        '<div onclick="App.closeComments()" style="display:flex;justify-content:center;padding:12px 0 8px;cursor:pointer;">' +
          '<div style="width:40px;height:4px;background:#D1D1D6;border-radius:2px;"></div>' +
        '</div>' +

        '<div style="text-align:center;padding-bottom:12px;border-bottom:0.5px solid #F2F2F7;">' +
          '<h3 style="font-size:16px;font-weight:800;margin:0;color:#000;">Commentaires</h3>' +
          ((post.comments || []).length > 0 ? '<p style="font-size:12px;color:#8E8E93;margin:2px 0 0;">'+(post.comments || []).length+' commentaire'+((post.comments || []).length>1?'s':'')+'</p>' : '') +
        '</div>' +

        '<div id="commentsList" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 14px;">' +
          commentItems +
        '</div>' +

        '<div style="border-top:0.5px solid #F2F2F7;">' +
          '<div id="commentMentionSugg" style="display:none;flex-wrap:wrap;gap:6px;background:#F0F6FF;border-top:1px solid #CCDEFF;padding:8px 14px;"></div>' +
          '<div id="commentImagePreview" style="padding:' + (S.pendingCommentImage ? '10px 14px 0' : '0') + ';">' +
            (S.pendingCommentImage
              ? '<div style="position:relative;display:inline-block;">' +
                  '<img src="'+S.pendingCommentImage+'" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #E5E5EA;">' +
                  '<button type="button" onclick="App.removeCommentImage()" style="position:absolute;top:-6px;right:-6px;background:rgba(0,0,0,0.7);border:none;border-radius:8px;width:18px;height:18px;color:#FFF;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>' +
                '</div>'
              : '') +
          '</div>' +
          '<div style="display:flex;justify-content:space-around;padding:8px 14px;border-bottom:0.5px solid #F7F7F7;">' +
            emojis.map(function(e) {
              return '<span onclick="App.addEmoji(\''+e+'\')" style="font-size:22px;cursor:pointer;padding:3px 2px;-webkit-tap-highlight-color:transparent;">'+e+'</span>';
            }).join('') +
          '</div>' +
          '<form onsubmit="event.preventDefault(); App.submitComment(event);" style="display:flex;align-items:center;gap:8px;padding:10px 14px;">' +
            (u.avatar_url ? '<img src="' + u.avatar_url + '" style="width:34px;height:34px;border-radius:17px;object-fit:cover;flex-shrink:0;" />' : '<div style="width:34px;height:34px;border-radius:17px;background:linear-gradient(135deg,' + (u.avatar_color||'#007AFF') + ',#0040CC);color:#FFF;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + userInitial + '</div>') +
            '<div style="flex:1;display:flex;align-items:center;background:#F2F2F7;border-radius:22px;height:40px;padding:0 6px 0 14px;">' +
              '<input id="commentInput" type="text" oninput="App.onCommentInput(this.value)" placeholder="Ajouter un commentaire… (@ pour taguer)" style="flex:1;border:none;background:transparent;font-size:14px;color:#000;outline:none;">' +
              '<label style="cursor:pointer;padding:6px;display:flex;align-items:center;flex-shrink:0;">' +
                '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                '<input type="file" accept="image/*" onchange="App.addCommentImage(event)" style="display:none;">' +
              '</label>' +
              '<button type="submit" style="background:none;border:none;padding:0 0 0 4px;cursor:pointer;display:flex;align-items:center;">' + SVG.send + '</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderCommentItem(c) {
    var likedComments = db(SK.LIKED_COMMENTS, {});
    var isLiked = !!likedComments[c.id];
    var allU = db(SK.USERS, []);
    var cAuthor = allU.find(function(u){ return u.id === c.userId; });
    var cAvatarUrl = (cAuthor && cAuthor.avatar_url) ? cAuthor.avatar_url : c.avatar_url;
    var cColor = (cAuthor && cAuthor.avatar_color) ? cAuthor.avatar_color : (c.avatarColor || '#007AFF');
    var cInitial = (cAuthor && cAuthor.prenom) ? cAuthor.prenom.charAt(0).toUpperCase() : ((c.author||'U').charAt(0));

    var cAvatarNode = cAvatarUrl
      ? '<img src="' + cAvatarUrl + '" style="width:36px;height:36px;border-radius:18px;object-fit:cover;flex-shrink:0;" />'
      : '<div style="width:36px;height:36px;border-radius:18px;background:linear-gradient(135deg,' + cColor + ',#0040CC);color:#FFF;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + cInitial + '</div>';

    return '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:16px;">' +
      '<div onclick="App.openUserProfile(\'' + c.userId + '\')" style="cursor:pointer;">' + cAvatarNode + '</div>' +
      '<div style="flex:1;">' +
        '<div style="display:flex;align-items:baseline;gap:6px;">' +
          '<strong onclick="App.openUserProfile(\'' + c.userId + '\')" style="cursor:pointer;font-size:13.5px;color:#000;">' + safeHtml(c.author||'Membre') + '</strong>' +
          '<span style="font-size:11.5px;color:#8E8E93;">' + timeAgo(c.timestamp) + '</span>' +
        '</div>' +
        (c.text ? '<p style="font-size:14px;color:#1C1C1E;margin:3px 0 5px;line-height:1.4;">' + hashtagify(c.text) + '</p>' : '') +
        (c.imageUrl ? '<img src="'+c.imageUrl+'" style="max-width:180px;max-height:180px;border-radius:12px;margin:2px 0 6px;display:block;object-fit:cover;">' : '') +
        '<button style="background:none;border:none;padding:0;font-size:12px;font-weight:700;color:#8E8E93;cursor:pointer;">Répondre</button>' +
      '</div>' +
      '<div id="clike-'+c.id+'" onclick="App.likeComment(\''+c.id+'\')" style="cursor:pointer;padding:4px;margin-top:2px;">' +
        SVG.heart(isLiked, 15) +
      '</div>' +
    '</div>';
  }

  // ============================================================
  // PLANNING TAB
  // ============================================================
  function renderPlanning() {
    if (!S.selectedDate) S.selectedDate = new Date().toISOString().split('T')[0];
    if (!S.planningMode) S.planningMode = 'upcoming';
    
    var canCreate = S.user && (S.user.role === 'RESP_SECTION' || S.user.role === 'GRAND_RESPONSABLE');
    var rightBtn = canCreate ? '<button onclick="App.openCreateEvent()" style="background:#007AFF;color:#FFF;border:none;border-radius:17px;padding:6px 14px;font-size:12.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:5px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Événement</button>' : '';
    var header = renderScreenHeader('Planning & Cultes', 'Département COM', rightBtn);

    var modeSwitch = '<div style="background:#FFF;padding:10px 16px;display:flex;gap:10px;border-bottom:1px solid #E5E5EA;">' +
      '<button onclick="S.planningMode=\'upcoming\';render()" style="flex:1;padding:10px;border-radius:12px;font-weight:800;font-size:13.5px;border:none;cursor:pointer;transition:0.2s;' + (S.planningMode==='upcoming' ? 'background:#000;color:#FFF;' : 'background:#F2F2F7;color:#8E8E93;') + '">À venir</button>' +
      '<button onclick="S.planningMode=\'history\';render()" style="flex:1;padding:10px;border-radius:12px;font-weight:800;font-size:13.5px;border:none;cursor:pointer;transition:0.2s;' + (S.planningMode==='history' ? 'background:#000;color:#FFF;' : 'background:#F2F2F7;color:#8E8E93;') + '">Historique</button>' +
    '</div>';

    var allPosts = db(SK.POSTS, []);
    var todayIso = new Date().toISOString().split('T')[0];

    if (S.planningMode === 'history') {
      var pastEvents = allPosts.filter(function(p) { return p.type === 'EVENT' && p.eventDate < todayIso; });
      pastEvents.sort(function(a,b) { return b.eventDate.localeCompare(a.eventDate); });
      var historyHtml = '<div style="padding:20px 16px;min-height:50vh;background:#FAFAFA;">';
      if (pastEvents.length === 0) {
         historyHtml += '<div style="text-align:center;padding:40px 20px;color:#8E8E93;"><div style="font-size:40px;margin-bottom:12px;">🕰️</div><div style="font-size:18px;font-weight:700;color:#000;">Aucun historique</div><div style="font-size:14px;margin-top:4px;">Les événements passés s\'afficheront ici.</div></div>';
      } else {
         pastEvents.forEach(function(ev) {
            historyHtml += '<div style="background:#FFF;border-radius:16px;padding:16px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1px solid #EFEFEF;">' +
              '<div style="font-size:12px;font-weight:800;color:#8E8E93;margin-bottom:6px;">📅 ' + (new Date(ev.eventDate).toLocaleDateString('fr-FR')) + '</div>' +
              '<h3 style="font-size:17px;font-weight:800;color:#000;margin:0 0 12px;">' + safeHtml(ev.eventTitle) + '</h3>' +
              '<button onclick="S.evalEventId=\''+ev.id+'\';S.tab=\'debrief\';render()" style="width:100%;background:linear-gradient(135deg,#FF9500,#FF3B30);color:#FFF;border:none;border-radius:12px;padding:10px;font-size:13.5px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(255,59,48,0.3);">✍️ Évaluer / Débriefer</button>' +
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

    var slider = '<div style="background:#FFF;padding:16px;border-bottom:1px solid #E5E5EA;display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;">' +
      dates.map(function(d) {
        var iso = d.toISOString().split('T')[0];
        var isSel = (iso === S.selectedDate);
        var dayName = d.toLocaleDateString('fr-FR', {weekday:'short'}).toUpperCase();
        var dayNum = d.getDate();
        var bg = isSel ? '#000' : '#F2F2F7';
        var col = isSel ? '#FFF' : '#8E8E93';
        var numCol = isSel ? '#FFF' : '#000';
        var hasEv = allPosts.some(function(p){ return p.type==='EVENT' && p.eventDate===iso; });
        var dot = hasEv ? '<div style="width:4px;height:4px;border-radius:2px;background:'+(isSel?'#FFF':'#FF3B30')+';margin-top:2px;"></div>' : '<div style="height:6px;"></div>';
        return '<div onclick="App.selectDate(\''+iso+'\')" style="min-width:54px;height:74px;border-radius:16px;background:'+bg+';display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:0.2s;">' +
          '<span style="font-size:11px;font-weight:700;color:'+col+';margin-bottom:2px;">'+dayName+'</span>' +
          '<span style="font-size:20px;font-weight:800;color:'+numCol+';line-height:1;">'+dayNum+'</span>' +
          dot +
        '</div>';
      }).join('') +
    '</div>';

    var dayEvents = allPosts.filter(function(p) { 
      return p.type === 'EVENT' && p.eventDate === S.selectedDate;
    }).sort(function(a,b) {
      if (a.eventStart && b.eventStart) return a.eventStart.localeCompare(b.eventStart);
      return 0;
    });

    var timeline = '<div style="padding:20px 16px;min-height:50vh;background:#FAFAFA;">';
    
    if (dayEvents.length === 0) {
      timeline += '<div style="text-align:center;padding:40px 20px;color:#8E8E93;">' +
        '<div style="font-size:40px;margin-bottom:12px;">📅</div>' +
        '<div style="font-size:18px;font-weight:700;color:#000;">Aucun événement</div>' +
        '<div style="font-size:14px;margin-top:4px;">Rien de prévu pour cette date.</div>' +
      '</div>';
    } else {
      var nowTime = new Date().toTimeString().slice(0,5);
      
      dayEvents.forEach(function(ev) {
        var status = 'upcoming';
        var statusHtml = '';
        if (ev.eventDate < todayIso) status = 'closed';
        else if (ev.eventDate === todayIso) {
          if (nowTime >= ev.eventStart && nowTime <= ev.eventEnd) status = 'active';
          else if (nowTime > ev.eventEnd) status = 'closed';
        }

        if (status === 'active') {
          statusHtml = '<div style="display:inline-flex;align-items:center;gap:4px;background:#E5F4E9;color:#28A347;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;"><div style="width:6px;height:6px;border-radius:3px;background:#28A347;animation:blink 1.5s infinite;"></div>En cours</div>';
        } else if (status === 'closed') {
          statusHtml = '<div style="display:inline-block;background:#F2F2F7;color:#8E8E93;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;">✅ Terminé</div>';
        }

        var secTags = (ev.eventSections || []).map(function(s){
          return '<span style="font-size:12px;font-weight:700;color:#007AFF;">' + secNom(s) + '</span>';
        }).join('<span style="color:#D1D1D6;margin:0 4px;">•</span>');

        timeline += '<div style="display:flex;margin-bottom:24px;">' +
          '<div style="width:60px;flex-shrink:0;text-align:right;padding-right:12px;padding-top:2px;">' +
            '<div style="font-size:14px;font-weight:800;color:#000;">' + (ev.eventStart||'--:--') + '</div>' +
            '<div style="font-size:12px;font-weight:600;color:#8E8E93;margin-top:2px;">' + (ev.eventEnd||'--:--') + '</div>' +
          '</div>' +
          '<div style="position:relative;padding-left:16px;border-left:2px solid ' + (status==='active'?'#28A347':(status==='closed'?'#E5E5EA':'#000')) + ';flex:1;">' +
            '<div style="position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:5px;background:' + (status==='active'?'#28A347':(status==='closed'?'#E5E5EA':'#000')) + ';border:2px solid #FAFAFA;"></div>' +
            '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1px solid #F2F2F7;">' +
              statusHtml +
              '<h3 style="font-size:17px;font-weight:800;color:#000;margin:0 0 6px;">' + safeHtml(ev.eventTitle) + '</h3>' +
              (secTags ? '<div style="margin-bottom:8px;">' + secTags + '</div>' : '') +
              '<div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#8E8E93;margin-bottom:12px;font-weight:600;">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                safeHtml(ev.eventLocation || 'Non défini') +
              '</div>' +
              (ev.caption ? '<p style="font-size:13px;color:#3A3A3C;margin:0 0 16px;line-height:1.4;">' + safeHtml(ev.caption) + '</p>' : '') +
              (function(){
                var isPart = S.user && Array.isArray(ev.likedBy) && ev.likedBy.indexOf(S.user.id) !== -1;
                var count = Array.isArray(ev.likedBy) ? ev.likedBy.length : 0;
                if (status === 'closed') {
                  return '<button disabled style="width:100%;background:#F2F2F7;color:#8E8E93;border:none;border-radius:12px;padding:11px;font-size:13.5px;font-weight:700;">Terminé (' + count + ' participants)</button>';
                }
                return '<button onclick="App.toggleEventParticipation(\'' + ev.id + '\')" style="width:100%;background:' + (isPart ? 'linear-gradient(135deg,#34C759,#28A347)' : 'linear-gradient(135deg,#007AFF,#0055CC)') + ';color:#FFF;border:none;border-radius:12px;padding:11px;font-size:13.5px;font-weight:800;cursor:pointer;box-shadow:' + (isPart ? '0 4px 12px rgba(52,199,89,0.3)' : '0 4px 12px rgba(0,122,255,0.3)') + ';">' + (isPart ? '✓ Participation Confirmée (' + count + ')' : '+ Je participe 👍 (' + count + ')') + '</button>';
              })() +
            '</div>' +
          '</div>' +
        '</div>';
      });
    }
    
    timeline += '</div>';

    return header + modeSwitch + slider + timeline;
  }
  // ============================================================
  // DEBRIEF TAB
  // ============================================================
  function renderDebrief(u) {
    var userSec = (u && u.section_id) || '';

    return renderScreenHeader('Notation & Débrief', 'Évaluation Inter-Sections', '') +

      '<div style="padding:16px;">' +
        '<p style="font-size:13.5px;color:#8E8E93;margin:0 0 16px;line-height:1.5;">Notez les performances des autres sections pour un événement. La notation de votre propre section est interdite.</p>' +

        (function(){
          var eventPosts = db(SK.POSTS, []).filter(function(p){ return p.type === 'EVENT'; });
          return '<div style="background:#FFF;border-radius:18px;padding:16px;margin-bottom:14px;border:1px solid #EFEFEF;box-shadow:0 2px 8px rgba(0,0,0,0.04);">' +
            '<label style="font-size:13px;font-weight:800;color:#000;display:block;margin-bottom:8px;">📍 Événement concerné <span style="color:#FF3B30;">*</span></label>' +
            '<select id="evalEventSelect" onchange="S.evalEventId=this.value" style="width:100%;height:44px;border-radius:12px;border:1.5px solid #E5E5EA;background:#FAFAFA;padding:0 12px;font-size:14px;color:#000;outline:none;font-weight:600;">' +
              '<option value="">Sélectionner l\'événement à évaluer...</option>' +
              eventPosts.map(function(ev){
                var evTitle = ev.eventTitle || (ev.metadata && ev.metadata.title) || 'Événement';
                var evDate = ev.eventDate || (ev.metadata && ev.metadata.date) || '';
                var sel = S.evalEventId === ev.id ? ' selected' : '';
                return '<option value="' + ev.id + '"' + sel + '>' + safeHtml(evTitle) + (evDate ? ' (' + evDate + ')' : '') + '</option>';
              }).join('') +
            '</select>' +
          '</div>';
        })() +

        SECTIONS.map(function(sec) {
          var blocked = sec.id === userSec;
          var r = S.ratings[sec.id] || { score: 0, comment: '' };
          if (blocked) {
            return '<div style="background:#F8F8FC;border-radius:18px;padding:14px;margin-bottom:10px;border:1px solid #EFEFEF;">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;">' +
                '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:22px;">' + sec.emoji + '</span><strong style="color:#8E8E93;font-size:14px;">' + sec.nom + '</strong></div>' +
                '<span style="background:#FFEBEA;color:#FF3B30;font-size:11px;font-weight:800;padding:5px 10px;border-radius:20px;">Votre section</span>' +
              '</div></div>';
          }
          var scoreColor = r.score >= 4 ? '#34C759' : r.score >= 2 ? '#FF9500' : r.score > 0 ? '#FF3B30' : '#C7C7CC';
          return '<div style="background:#FFF;border-radius:18px;padding:16px;margin-bottom:10px;border:1px solid #EFEFEF;box-shadow:0 2px 8px rgba(0,0,0,0.04);">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
              '<div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,' + sec.color + '20,' + sec.color + '10);display:flex;align-items:center;justify-content:center;font-size:20px;">' + sec.emoji + '</div>' +
                '<div><strong style="font-size:14.5px;color:#000;display:block;">' + sec.nom + '</strong>' +
                '<span style="font-size:11.5px;color:#8E8E93;">Cliquez pour noter</span></div>' +
              '</div>' +
              '<div style="font-size:20px;font-weight:900;color:' + scoreColor + ';">' + (r.score > 0 ? r.score+'/5' : '—') + '</div>' +
            '</div>' +
            '<div id="stars-'+sec.id+'" style="display:flex;gap:6px;margin-bottom:12px;">' +
              [1,2,3,4,5].map(function(star) {
                return '<button type="button" onclick="App.rate(\''+sec.id+'\','+star+')" style="font-size:28px;cursor:pointer;background:none;border:none;padding:0;transition:transform 0.1s;color:' + (star<=r.score?'#FFD700':'#D1D1D6') + ';" onmousedown="this.style.transform=\'scale(1.2)\'" onmouseup="this.style.transform=\'scale(1)\'">★</button>';
              }).join('') +
            '</div>' +
            '<input type="text" value="' + safeHtml(r.comment||'') + '" onchange="App.rateComment(\''+sec.id+'\',this.value)" placeholder="Ajouter une observation..." ' +
            'style="width:100%;height:40px;border:1.5px solid #EFEFEF;border-radius:12px;padding:0 12px;font-size:13.5px;color:#000;box-sizing:border-box;outline:none;background:#FAFAFA;" ' +
            'onfocus="this.style.borderColor=\'#007AFF\'" onblur="this.style.borderColor=\'#EFEFEF\'">' +
          '</div>';
        }).join('') +

          '<button onclick="App.publishBilan()" style="width:100%;background:linear-gradient(135deg,#34C759,#28A347);color:#FFF;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(52,199,89,0.3);">Valider & Publier le Bilan ✓</button>' +
        '</div>' +

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
    return '<div style="display:flex;align-items:center;gap:12px;padding:13px 18px;border-bottom:0.5px solid #F7F7F7;">' +
      '<span style="font-size:18px;width:24px;text-align:center;">' + icon + '</span>' +
      '<div style="flex:1;">' +
        '<div style="font-size:11.5px;color:#8E8E93;font-weight:600;margin-bottom:1px;">' + label + '</div>' +
        '<div style="font-size:14px;color:#000;font-weight:600;">' + val + '</div>' +
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
    return '<div style="background:#FFF;border-radius:10px;padding:8px 10px;display:flex;align-items:center;gap:6px;">' +
      '<span style="font-size:13px;">' + icon + '</span>' +
      '<span style="font-size:12px;font-weight:700;color:' + (color||'#000') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + text + '</span>' +
    '</div>';
  }

  // ============================================================
  // PROFILE TAB
  // ============================================================
  function renderProfile(u, posts) {
    try {
    if (!u || !u.id) {
      return '<div style="min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center;">' +
        '<div style="width:36px;height:36px;border:3px solid #E5E5EA;border-top-color:#007AFF;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:12px;"></div>' +
        '<div style="font-size:14px;font-weight:700;color:#1C1C1E;">Chargement du profil...</div>' +
      '</div>';
    }
    var allProfiles = db(SK.USERS, []);
    var freshU = allProfiles.find(function(p){ return p.id === u.id; }) || u;

    var isMe = S.user && S.user.id === freshU.id;
    var profileTab = S.profileTab || 'tout';

    var ROLE_THEMES = {
      GRAND_RESPONSABLE: {
        primary: '#D4AF37', // Gold
        coverGradient: 'linear-gradient(135deg, #C5A028 0%, #FFDF00 50%, #996515 100%)',
        badgeBg: 'linear-gradient(135deg, #FFDF00, #D4AF37)',
        badgeText: '#5A4300'
      },
      RESP_SECTION: {
        primary: '#0B3B60', // Sapphire
        coverGradient: 'linear-gradient(135deg, #062136 0%, #1A5276 50%, #062136 100%)',
        badgeBg: 'linear-gradient(135deg, #1A5276, #0B3B60)',
        badgeText: '#FFF'
      },
      MEMBRE: {
        primary: '#007AFF', // Standard Blue
        coverGradient: 'linear-gradient(135deg,#1A1A2E 0%,#2D2D5E 50%,#1A1A2E 100%)',
        badgeBg: '#F2F2F7',
        badgeText: '#007AFF'
      },
      STAGIAIRE: {
        primary: '#FF9500', // Orange
        coverGradient: 'linear-gradient(135deg,#FF9500 0%,#FFCC00 50%,#FF9500 100%)',
        badgeBg: '#FFF5E5',
        badgeText: '#FF9500'
      }
    };
    var theme = ROLE_THEMES[freshU.role] || ROLE_THEMES['MEMBRE'];

    // ---- Stats ----
    var myPosts = posts.filter(function(p){ return p.userId === freshU.id; }).sort(function(a,b){return (b.timestamp||0)-(a.timestamp||0)});
    var photosPosts = myPosts.filter(function(p){ return p.mediaUrls && p.mediaUrls.length > 0; });
    var eventPosts = myPosts.filter(function(p){ return p.type === 'EVENT'; });
    var myLikesCount = posts.filter(function(p){ return Array.isArray(p.likedBy) && p.likedBy.indexOf(freshU.id) !== -1; }).length;
    var myCommentsCount = 0;
    posts.forEach(function(p){ myCommentsCount += (p.comments||[]).filter(function(c){ return c.userId === freshU.id; }).length; });

    // ---- Avatar ----
        // ---- Dynamic RH Metrics (15-day cycle) ----
    var now = new Date();
    var cycleStr = now.getDate() <= 15 ? "1er - 15 " + now.toLocaleDateString('fr-FR', {month:'short'}) : "16 - Fin " + now.toLocaleDateString('fr-FR', {month:'short'});
    var currentCycleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() <= 15 ? 1 : 16).getTime();

    // Calcul Historique Global
    var eventsList = posts.filter(function(p){ return p.type === 'EVENT' && (p.timestamp || 0) >= currentCycleStart; });
    var myServicesCount = 0;
    eventsList.forEach(function(ev) {
      var isParticipant = (ev.metadata && ev.metadata.participations && ev.metadata.participations[freshU.id] === 'yes');
      var isAssigned = (ev.assignments || []).some(function(a){ return a.userId === freshU.id; });
      if (isAssigned || isParticipant) myServicesCount++;
    });

    var totalEvents = eventsList.length;
    var baseScore = 20;
    var missedEvents = Math.max(0, totalEvents - myServicesCount);
    // Minus 2 points per missed event in the cycle
    var currentScore = Math.max(0, baseScore - (missedEvents * 2));
    
    var evalPosts = posts.filter(function(p){ 
      var isEval = p.type === 'EVALUATION' || (p.metadata && p.metadata.type === 'EVALUATION');
      return isEval && (p.timestamp || 0) >= currentCycleStart; 
    });
    
    // Add bonus points for great evaluations
    evalPosts.forEach(function(ep) {
      var meta = ep.metadata || {};
      var r = parseFloat(meta.globalScore || 0);
      if (r >= 4) currentScore = Math.min(20, currentScore + 1); // +1 bonus for good eval
      if (r <= 2 && r > 0) currentScore = Math.max(0, currentScore - 1); // -1 penalty for bad eval
    });

    var scoreColor = currentScore < 10 ? '#EF4444' : (currentScore < 15 ? '#F59E0B' : '#10B981');
    var scoreLabel = currentScore < 10 ? 'Critique' : (currentScore < 15 ? 'Moyen' : 'Excellent 🌟');

    var evalCount = evalPosts.length;
    var avgRating = '—';
    if (evalCount > 0) {
      var sumRating = 0;
      evalPosts.forEach(function(ep){
        var meta = ep.metadata || {};
        sumRating += parseFloat(meta.globalScore || 0);
      });
      avgRating = (sumRating / evalCount).toFixed(1);
    }
    var trustScore = Math.round((currentScore / 20) * 100);
    var trustColor = scoreColor;
    var trustLabel = scoreLabel;


    var avatarContent = freshU.avatar_url
      ? '<img src="' + freshU.avatar_url + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
      : '<div style="width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,'+(theme.primary)+',#000);color:#FFF;font-size:34px;font-weight:900;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';

    // ---- Cover ----
    var coverBg = freshU.cover_url
      ? 'background:url(\'' + freshU.cover_url + '\') center/cover no-repeat;'
      : 'background:' + theme.coverGradient + ';';

    // ---- Sections badges ----
    // On n'affiche que les sections reconnues (évite le badge "Général" fantôme
    // pour d'anciennes sections supprimées comme Son/Lumière/Montage).
    var uSecs = getUserSections(freshU).filter(function(s){ return SECTIONS.some(function(x){ return x.id === s; }); });
    var secBadges = uSecs.map(function(s){
      var sc = secColor(s) || '#007AFF';
      return '<span style="background:' + sc + '22;color:' + sc + ';padding:4px 10px;border-radius:12px;font-size:12px;font-weight:800;">' + secNom(s) + '</span>';
    }).join('');

    // ---- Sticky top bar ----
    var topBar = '<div style="position:sticky;top:0;z-index:200;background:rgba(0,0,0,0.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">' +
      (isMe
        ? '<button onclick="App.tab(\'home\')" style="background:rgba(255,255,255,0.15);border:none;width:36px;height:36px;border-radius:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
          '</button>'
        : '<button onclick="App.closeUserProfile()" style="background:rgba(255,255,255,0.15);border:none;width:36px;height:36px;border-radius:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
          '</button>'
      ) +
      '<div style="font-size:17px;font-weight:800;color:#FFF;letter-spacing:-0.3px;">' + safeHtml(freshU.prenom) + ' ' + safeHtml(freshU.nom) + '</div>' +
      '<div style="display:flex;gap:8px;">' +
        (isMe ? '<button onclick="App.openEditProfile()" style="background:rgba(255,255,255,0.15);border:none;width:36px;height:36px;border-radius:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '</button>' : '') +
        '<button style="background:rgba(255,255,255,0.15);border:none;width:36px;height:36px;border-radius:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '</button>' +
      '</div>' +
    '</div>';

    // ---- Hero cover block ----
    var hero = '<div style="position:relative;' + coverBg + 'min-height:220px;display:flex;flex-direction:column;justify-content:flex-end;">' +
      '<div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.7) 100%);"></div>' +
      // Camera icon for cover
      (isMe ? '<label style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.5);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
        '<input type="file" accept="image/*" onchange="App.handleCoverSelect(event)" style="display:none;">' +
      '</label>' : '') +
      // Avatar + name bottom left
      '<div style="position:relative;z-index:2;padding:0 16px 16px;display:flex;align-items:flex-end;justify-content:space-between;">' +
        '<div style="position:relative;">' +
          '<div style="width:90px;height:90px;border-radius:45px;border:3px solid #FFF;overflow:hidden;background:#1A1A2E;">' +
            avatarContent +
          '</div>' +
          (isMe ? '<label style="position:absolute;bottom:2px;right:2px;background:#FFF;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
            '<input type="file" accept="image/*" onchange="App.handleAvatarSelect(event)" style="display:none;">' +
          '</label>' : '') +
        '</div>' +
        // Follow / Edit buttons
        '<div style="display:flex;gap:8px;">' +
          (isMe
            ? '<button onclick="App.openEditProfile()" style="background:' + theme.primary + ';color:#FFF;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">Modifier</button>'
            : '<button onclick="App.toggleFollow(\'' + freshU.id + '\')" style="background:' + ((S.user && S.user.following && S.user.following.indexOf(freshU.id)!==-1) ? '#34C759' : theme.primary) + ';color:#FFF;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">' + ((S.user && S.user.following && S.user.following.indexOf(freshU.id)!==-1) ? '✓ Suivi' : 'Suivre') + '</button>' +
              '<button onclick="App.openDirectMessage(\'' + freshU.id + '\')" style="background:rgba(255,255,255,0.9);color:#000;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;">Message</button>'
          ) +
        '</div>' +
      '</div>' +
    '</div>';

    // ---- Info block ----
    var infoBlock = '<div style="background:#FFF;padding:16px;border-bottom:8px solid #F2F2F7;">' +
      // Name + role
      '<div style="font-size:22px;font-weight:900;color:#000;letter-spacing:-0.5px;margin-bottom:4px;">' + safeHtml(freshU.prenom + ' ' + freshU.nom) + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
        '<span style="font-size:12px;font-weight:800;color:' + theme.badgeText + ';background:' + theme.badgeBg + ';padding:4px 10px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">' + (ROLE_LABELS[freshU.role]||'Membre') + '</span>' +
        (secBadges ? '<span style="color:#D1D1D6;">·</span>' + secBadges : '') +
      '</div>' +
      // ---- Performances & Suivi (Redesign) ----
      '<div style="margin:16px 0;">' +
        '<div style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 55%,#0F172A 100%);border-radius:24px;padding:20px;position:relative;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,0.28);animation:fadeIn 0.4s ease-out;">' +
          '<div style="position:absolute;top:-50px;right:-50px;width:160px;height:160px;border-radius:80px;background:' + trustColor + '30;filter:blur(36px);pointer-events:none;"></div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;margin-bottom:18px;">' +
            '<div>' +
              '<div style="font-size:10.5px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:3px;">Cycle ' + cycleStr + '</div>' +
              '<div style="font-size:17px;font-weight:800;color:#FFF;letter-spacing:-0.3px;">Performances & Suivi</div>' +
            '</div>' +
            '<div onclick="App.openRhDetailsModal(\'services\', \'' + freshU.id + '\')" style="background:rgba(255,255,255,0.1);border-radius:18px;padding:7px 12px;font-size:11px;font-weight:700;color:#FFF;cursor:pointer;display:flex;align-items:center;gap:4px;">' +
              'Détails <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>' +
            '</div>' +
          '</div>' +
          '<div onclick="App.openRhDetailsModal(\'services\', \'' + freshU.id + '\')" style="display:flex;align-items:center;gap:18px;position:relative;z-index:1;margin-bottom:18px;cursor:pointer;transition:opacity 0.15s;" onmousedown="this.style.opacity=\'0.7\'" onmouseup="this.style.opacity=\'1\'">' +
            '<div style="width:78px;height:78px;border-radius:39px;background:conic-gradient(' + trustColor + ' ' + trustScore + '%, rgba(255,255,255,0.08) 0);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<div style="width:64px;height:64px;background:#0F172A;border-radius:32px;display:flex;align-items:center;justify-content:center;">' +
                '<span style="font-size:19px;font-weight:900;color:#FFF;">' + trustScore + '<span style="font-size:11px;color:#94A3B8;">%</span></span>' +
              '</div>' +
            '</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:14.5px;font-weight:800;color:#FFF;margin-bottom:3px;">Indice de Confiance</div>' +
              '<div style="font-size:12px;color:#94A3B8;margin-bottom:7px;">Présences & fidélité</div>' +
              '<div style="display:inline-block;font-size:10.5px;font-weight:800;color:' + trustColor + ';background:' + trustColor + '22;padding:3px 10px;border-radius:10px;">' + trustLabel + '</div>' +
            '</div>' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
          '</div>' +
          '<div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:16px;position:relative;z-index:1;"></div>' +
          '<div style="display:flex;position:relative;z-index:1;">' +
            '<div onclick="App.openRhDetailsModal(\'services\', \'' + freshU.id + '\')" style="flex:1;cursor:pointer;transition:transform 0.15s;" onmousedown="this.style.transform=\'scale(0.96)\'" onmouseup="this.style.transform=\'scale(1)\'">' +
              '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">' +
                '<span style="width:26px;height:26px;border-radius:8px;background:rgba(251,191,36,0.15);display:flex;align-items:center;justify-content:center;font-size:14px;">🏆</span>' +
                '<span style="font-size:23px;font-weight:900;color:#FFF;">' + myServicesCount + '</span>' +
              '</div>' +
              '<div style="font-size:11.5px;font-weight:700;color:#CBD5E1;">Prestations & Cultes</div>' +
              '<div style="font-size:10.5px;color:#64748B;">Cette quinzaine</div>' +
            '</div>' +
            '<div style="width:1px;background:rgba(255,255,255,0.08);margin:2px 16px;"></div>' +
            '<div onclick="App.openRhDetailsModal(\'ratings\', \'' + freshU.id + '\')" style="flex:1;cursor:pointer;transition:transform 0.15s;" onmousedown="this.style.transform=\'scale(0.96)\'" onmouseup="this.style.transform=\'scale(1)\'">' +
              '<div style="display:flex;align-items:baseline;gap:4px;margin-bottom:5px;">' +
                '<span style="font-size:23px;font-weight:900;color:#FFF;">' + (avgRating === '—' ? '—' : avgRating) + '</span>' +
                '<span style="font-size:11px;font-weight:700;color:#64748B;">/20</span>' +
              '</div>' +
              '<div style="display:flex;gap:1.5px;margin-bottom:5px;">' +
                (function(){
                  var n = evalCount > 0 ? Math.round((parseFloat(avgRating)/20)*5) : 0;
                  var out = '';
                  for (var i=1;i<=5;i++) { out += '<span style="font-size:11px;color:' + (i<=n ? '#FBBF24' : '#334155') + ';">★</span>'; }
                  return out;
                })() +
              '</div>' +
              '<div style="font-size:11.5px;font-weight:700;color:#CBD5E1;">Note Globale</div>' +
              '<div style="font-size:10.5px;color:#64748B;">' + (evalCount > 0 ? evalCount + ' évaluation(s)' : 'Pas d\'éval') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      // Bio
      (freshU.bio ? '<div style="font-size:14px;color:#3A3A3C;line-height:1.5;margin-bottom:14px;white-space:pre-wrap;">' + safeHtml(freshU.bio) + '</div>' : '') +
      // Infos personnelles
      '<div style="background:#F8F8F8;border-radius:16px;padding:14px;margin-bottom:14px;">' +
        '<div style="font-size:13px;font-weight:800;color:#000;margin-bottom:10px;">Informations</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#3A3A3C;">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
            '<span>Église Vase d\'Honneur · Abidjan</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#3A3A3C;">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
            '<span>Membre depuis ' + (freshU.joined_at ? new Date(freshU.joined_at).toLocaleDateString('fr-FR', {month:'long', year:'numeric'}) : '2024') + '</span>' +
          '</div>' +
          (uSecs.length > 0 ? '<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#3A3A3C;">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
            '<span>' + uSecs.map(function(s){ return secNom(s); }).join(' · ') + '</span>' +
          '</div>' : '') +
        '</div>' +
      '</div>' +
      // Action buttons
      (isMe ? '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<div style="display:flex;gap:10px;">' +
          '<button onclick="App.tab(\'home\');App.openCreate();" style="flex:1;background:' + theme.primary + ';color:#FFF;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Publier' +
          '</button>' +
          '<button onclick="App.openEditProfile()" style="flex:1;background:#F2F2F7;color:#000;border:none;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;">✏️ Modifier le profil</button>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:6px;">' +
          '<button onclick="App.openDeleteAccount()" style="background:none;color:#B0B4BB;border:none;padding:8px 6px;font-size:11.5px;font-weight:700;cursor:pointer;">Supprimer mon compte</button>' +
          '<button onclick="App.logout()" style="background:#FEE2E2;color:#EF4444;border:none;border-radius:10px;padding:8px 14px;font-size:12.5px;font-weight:800;cursor:pointer;">Se déconnecter 🚪</button>' +
        '</div>' +
      '</div>' : '') +
    '</div>';

    // ---- Continuous scroll (no tabs) ----
    var tabBar = '';

    // ---- Feed: continuous scroll layout ----
    var feed = '<div style="background:#F2F2F7;min-height:50vh;padding-bottom:100px;">';

    // Section 1: Photos/Vidéos grid (if any)
    if (photosPosts.length > 0) {
      feed += '<div style="background:#FFF;padding:14px;margin-bottom:8px;">' +
        '<div style="font-size:15px;font-weight:800;color:#000;margin-bottom:10px;display:flex;align-items:center;gap:6px;">📷 Médias <span style="font-size:12px;font-weight:600;color:#8E8E93;">(' + photosPosts.length + ')</span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;border-radius:12px;overflow:hidden;">' +
        photosPosts.slice(0, 9).map(function(p) {
          var mediaUrl = p.mediaUrls[0];
          var isVid = isVideoUrl(mediaUrl);
          return '<div style="aspect-ratio:1;overflow:hidden;cursor:pointer;position:relative;background:#000;" onclick="App.viewPost(\'' + p.id + '\')">' +
            (isVid
              ? '<video src="' + mediaUrl + '"' + (p.videoPoster ? ' poster="'+p.videoPoster+'"' : '') + ' muted preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)"><path d="M8 5v14l11-7z"/></svg></div>'
              : '<img src="' + mediaUrl + '" style="width:100%;height:100%;object-fit:cover;" />') +
          '</div>';
        }).join('') +
        '</div>' +
        (photosPosts.length > 9 ? '<button onclick="S.showAllPhotos=true;render();" style="width:100%;margin-top:8px;background:#F2F2F7;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;color:#007AFF;cursor:pointer;">Voir tous les médias (' + photosPosts.length + ')</button>' : '') +
      '</div>';
    }

    // Section 2: Events (if any)
    if (eventPosts.length > 0) {
      feed += '<div style="background:#FFF;padding:14px;margin-bottom:8px;">' +
        '<div style="font-size:15px;font-weight:800;color:#000;margin-bottom:10px;display:flex;align-items:center;gap:6px;">📅 Événements <span style="font-size:12px;font-weight:600;color:#8E8E93;">(' + eventPosts.length + ')</span></div>' +
        eventPosts.slice(0, 3).map(function(ev) {
          var meta = ev.metadata || {};
          return '<div style="background:#F9FAFB;border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid #E5E5EA;">' +
            '<div style="font-size:14px;font-weight:700;color:#000;">' + safeHtml(meta.title || ev.eventTitle || ev.caption || '') + '</div>' +
            '<div style="font-size:12px;color:#8E8E93;margin-top:4px;">' + safeHtml(meta.date || ev.eventDate || '') + (meta.time || ev.eventStart ? ' · ' + safeHtml(meta.time || ev.eventStart || '') : '') + '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    // Section 2.5: Liens partagés (enregistrés automatiquement)
    var sharedLinks = Array.isArray(freshU.sharedLinks) ? freshU.sharedLinks : [];
    if (sharedLinks.length > 0) {
      var showAllLinksNow = !!S.showAllLinks;
      var linksToShow = showAllLinksNow ? sharedLinks : sharedLinks.slice(0, 5);
      feed += '<div style="background:#FFF;padding:14px;margin-bottom:8px;">' +
        '<div style="font-size:15px;font-weight:800;color:#000;margin-bottom:10px;display:flex;align-items:center;gap:6px;">🔗 Liens partagés <span style="font-size:12px;font-weight:600;color:#8E8E93;">(' + sharedLinks.length + ')</span></div>' +
        linksToShow.map(function(l) {
          return '<a href="' + l.url + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display:block;background:#F9FAFB;border:1px solid #E5E5EA;border-radius:12px;padding:10px 12px;margin-bottom:8px;text-decoration:none;">' +
            '<div style="font-size:13px;color:#007AFF;font-weight:700;word-break:break-all;">' + safeHtml(l.url) + '</div>' +
            '<div style="font-size:11px;color:#8E8E93;margin-top:2px;">' + timeAgo(l.timestamp) + '</div>' +
          '</a>';
        }).join('') +
        (sharedLinks.length > 5 && !showAllLinksNow ? '<button onclick="S.showAllLinks=true;render();" style="width:100%;background:#F2F2F7;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;color:#007AFF;cursor:pointer;">Voir tous les liens (' + sharedLinks.length + ')</button>' : '') +
      '</div>';
    }

    // Section 3: All publications header
    var selectMode = isMe && S.profileSelectMode;
    var selectedIds = S.selectedProfilePostIds || [];
    feed += '<div style="background:#FFF;padding:14px 14px 8px;margin-bottom:1px;display:flex;align-items:center;justify-content:space-between;">' +
      '<div style="font-size:15px;font-weight:800;color:#000;display:flex;align-items:center;gap:6px;">📝 Publications <span style="font-size:12px;font-weight:600;color:#8E8E93;">(' + myPosts.length + ')</span></div>' +
      (isMe && myPosts.length > 0
        ? '<span onclick="App.toggleProfileSelectMode()" style="font-size:12.5px;font-weight:800;color:#007AFF;cursor:pointer;">' + (selectMode ? 'Annuler' : 'Sélectionner') + '</span>'
        : '') +
    '</div>';

    var filteredPosts = myPosts;

    if (filteredPosts.length === 0) {
      feed += '<div style="padding:50px 20px;text-align:center;color:#8E8E93;background:#FFF;margin-top:1px;">' +
        '<div style="font-size:44px;margin-bottom:14px;">📝</div>' +
        '<div style="font-size:17px;font-weight:700;color:#000;margin-bottom:6px;">Aucune publication</div>' +
        '<div style="font-size:13px;">Rien à afficher dans cet onglet pour le moment.</div>' +
      '</div>';
    } else {
      filteredPosts.forEach(function(p) {
        if (!selectMode) { feed += renderPostCard(p); return; }
        var isSel = selectedIds.indexOf(p.id) !== -1;
        feed += '<div style="position:relative;">' +
          '<div onclick="App.toggleSelectProfilePost(\'' + p.id + '\')" style="position:absolute;inset:0;z-index:5;cursor:pointer;background:' + (isSel ? 'rgba(0,122,255,0.08)' : 'transparent') + ';"></div>' +
          '<div style="position:absolute;top:12px;left:12px;z-index:6;width:26px;height:26px;border-radius:13px;background:' + (isSel ? '#007AFF' : 'rgba(255,255,255,0.92)') + ';border:2px solid ' + (isSel ? '#007AFF' : '#C7C7CC') + ';display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.12);pointer-events:none;">' +
            (isSel ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') +
          '</div>' +
          renderPostCard(p) +
        '</div>';
      });
    }

    feed += '</div>';

    // Barre d'action flottante en mode sélection
    if (selectMode) {
      feed += '<div style="position:fixed;left:0;right:0;bottom:64px;z-index:500;display:flex;justify-content:center;padding:0 16px;">' +
        '<div style="width:100%;max-width:460px;background:#1C1C1E;border-radius:18px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 8px 24px rgba(0,0,0,0.28);">' +
          '<span style="color:#FFF;font-size:13.5px;font-weight:700;">' + selectedIds.length + ' sélectionnée' + (selectedIds.length>1?'s':'') + '</span>' +
          '<div style="display:flex;gap:8px;">' +
            '<span onclick="App.selectAllProfilePosts()" style="color:#8E8E93;font-size:13px;font-weight:700;cursor:pointer;padding:8px 4px;">Tout</span>' +
            '<button onclick="App.openBulkDeleteConfirm()" ' + (selectedIds.length===0?'disabled':'') + ' style="background:#FF3B30;color:#FFF;border:none;border-radius:12px;padding:9px 16px;font-size:13px;font-weight:800;cursor:pointer;opacity:' + (selectedIds.length===0?'0.4':'1') + ';">Supprimer</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return topBar + hero + infoBlock + tabBar + feed;
    } catch(profileErr) {
      console.error("Profile Screen render error:", profileErr);
      return '<div style="padding:40px;text-align:center;min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
        '<div style="font-size:16px;font-weight:700;color:#000;margin-bottom:8px;">Impossible d\'afficher le profil</div>' +
        '<p style="font-size:13px;color:#8E8E93;margin-bottom:16px;">Une erreur temporaire d\'affichage est survenue.</p>' +
        '<button onclick="App.tab(\'profile\')" style="background:#007AFF;color:#FFF;border:none;padding:10px 20px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">Réessayer</button>' +
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
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:380px;background:#FFF;border-radius:24px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
          '<div style="width:52px;height:52px;border-radius:26px;background:#FFF0EE;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;">⚠️</div>' +
          '<h3 style="font-size:17px;font-weight:900;color:#000;margin:0 0 8px;text-align:center;">Supprimer définitivement votre compte ?</h3>' +
          '<p style="font-size:13px;color:#6B7280;line-height:1.5;margin:0 0 4px;text-align:center;">' +
            'Cette action est <strong>irréversible</strong>. Votre profil ainsi que ' +
            (myPostsCount > 0 ? '<strong>' + myPostsCount + ' publication' + (myPostsCount>1?'s':'') + '</strong>' : 'toutes vos publications') +
            ' seront supprimés définitivement. Vous ne pourrez pas les récupérer.' +
          '</p>' +
          '<div style="background:#F6F7F9;border-radius:14px;padding:12px;margin:16px 0 10px;">' +
            '<label style="font-size:11.5px;font-weight:700;color:#6B7280;display:block;margin-bottom:6px;">Tapez <strong style="color:#FF3B30;">SUPPRIMER</strong> pour confirmer</label>' +
            '<input id="deleteAccountConfirmInput" type="text" placeholder="SUPPRIMER" ' + (busy?'disabled':'') + ' style="width:100%;height:40px;border-radius:10px;border:1.5px solid #E5E5EA;background:#FFF;padding:0 12px;font-size:14px;font-weight:700;outline:none;box-sizing:border-box;text-transform:uppercase;" />' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">' +
            '<button type="button" onclick="App.confirmDeleteAccount()" ' + (busy?'disabled':'') + ' style="width:100%;background:#FF3B30;color:#FFF;border:none;border-radius:14px;padding:13px;font-size:14.5px;font-weight:800;cursor:pointer;opacity:' + (busy?'0.6':'1') + ';">' + (busy ? 'Suppression en cours…' : 'Supprimer définitivement') + '</button>' +
            '<button type="button" onclick="App.closeDeleteAccount()" ' + (busy?'disabled':'') + ' style="width:100%;background:#F2F2F7;color:#000;border:none;border-radius:14px;padding:13px;font-size:14.5px;font-weight:700;cursor:pointer;">Annuler</button>' +
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
        '<div onclick="event.stopPropagation()" style="width:100%;max-width:380px;background:#FFF;border-radius:24px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
          '<div style="width:52px;height:52px;border-radius:26px;background:#FFF0EE;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px;">🗑️</div>' +
          '<h3 style="font-size:17px;font-weight:900;color:#000;margin:0 0 8px;text-align:center;">Supprimer ' + count + ' publication' + (count>1?'s':'') + ' ?</h3>' +
          '<p style="font-size:13px;color:#6B7280;line-height:1.5;margin:0;text-align:center;">' +
            'Cette action est <strong>irréversible</strong>. Les publications et leurs photos/vidéos seront supprimées définitivement.' +
          '</p>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:18px;">' +
            '<button type="button" onclick="App.confirmBulkDelete()" ' + (busy?'disabled':'') + ' style="width:100%;background:#FF3B30;color:#FFF;border:none;border-radius:14px;padding:13px;font-size:14.5px;font-weight:800;cursor:pointer;opacity:' + (busy?'0.6':'1') + ';">' + (busy ? 'Suppression en cours…' : 'Supprimer définitivement') + '</button>' +
            '<button type="button" onclick="App.closeBulkDeleteConfirm()" ' + (busy?'disabled':'') + ' style="width:100%;background:#F2F2F7;color:#000;border:none;border-radius:14px;padding:13px;font-size:14.5px;font-weight:700;cursor:pointer;">Annuler</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function renderEditProfileModal(u) {
    var freshU = db(SK.USERS, []).find(function(p){ return p.id === u.id; }) || u;
    
    var displayAvatar = S.avatarPreview || freshU.avatar_url;
        // ---- Dynamic RH Metrics (15-day cycle) ----
    var posts = db(SK.POSTS, []);
    var now = new Date();
    // Cycle de 15 jours: du 1er au 15, puis du 16 à la fin du mois
    var currentCycleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() <= 15 ? 1 : 16).getTime();

    var eventsList = posts.filter(function(p){ return p.type === 'EVENT' && (p.timestamp || 0) >= currentCycleStart; });
    var myServicesCount = 0;
    eventsList.forEach(function(ev) {
      var assignments = ev.assignments || [];
      var isAssigned = assignments.some(function(a){ return a.userId === freshU.id; });
      var isParticipant = Array.isArray(ev.likedBy) && ev.likedBy.indexOf(freshU.id) !== -1;
      if (isAssigned || isParticipant) myServicesCount++;
    });

    var evalPosts = posts.filter(function(p){ 
      var isEval = p.type === 'EVALUATION' || (p.metadata && p.metadata.type === 'EVALUATION');
      return isEval && (p.timestamp || 0) >= currentCycleStart; 
    });
    var sumScores = 0;
    var evalCount = 0;
    evalPosts.forEach(function(ep) {
      var meta = ep.metadata || {};
      var r = parseFloat(meta.globalScore || meta.overallRating || meta.rating || ep.rating || 0);
      if (r > 0) {
        if (r <= 5.0) { r = r * 4; } // Conversion automatique sur 20
        sumScores += r;
        evalCount++;
      }
    });
    var avgRating = evalCount > 0 ? (sumScores / evalCount).toFixed(1) : '—';

    // Calculate real trust score based on event participation ratio
    var totalEvents = eventsList.length;
    var trustScore;
    if (freshU.trust_score !== undefined) {
      trustScore = freshU.trust_score;
    } else if (totalEvents > 0) {
      trustScore = Math.round((myServicesCount / totalEvents) * 100);
    } else {
      trustScore = myServicesCount > 0 ? 100 : 0;
    }
    var trustColor = trustScore < 50 ? '#FF3B30' : (trustScore <= 80 ? '#FF9500' : '#34C759');
    var trustLabel = trustScore < 50 ? 'Suivi Requis' : (trustScore <= 80 ? 'Assiduité Satisfaisante' : 'Fiabilité Élevée 🌟');

    var avatarContent = displayAvatar 
      ? '<img id="editAvatarPreview" src="' + displayAvatar + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '<div id="editAvatarPreview" style="width:100%;height:100%;background:linear-gradient(135deg,'+(freshU.avatar_color||'#007AFF')+',#0040CC);color:#FFF;font-size:32px;font-weight:900;display:flex;align-items:center;justify-content:center;">' + (freshU.prenom||'M').charAt(0).toUpperCase() + '</div>';

    var displayCover = S.coverPreview || freshU.cover_url;
    var coverContent = displayCover
      ? '<img src="' + displayCover + '" style="width:100%;height:100%;object-fit:cover;" />'
      : '';

    return '<div style="position:fixed;inset:0;background:#FFF;z-index:10000;display:flex;flex-direction:column;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
      '<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #E5E5EA;background:#FFF;z-index:2;">' +
        '<button onclick="App.closeEditProfile()" style="background:none;border:none;font-size:16px;color:#000;cursor:pointer;">Annuler</button>' +
        '<div style="font-weight:700;font-size:16px;">Modifier le profil</div>' +
        '<button onclick="App.saveProfile(this)" style="background:none;border:none;font-size:16px;font-weight:700;color:#007AFF;cursor:pointer;">Terminer</button>' +
      '</header>' +
      '<div style="flex:1;overflow-y:auto;background:#FAFAFA;">' +
        
        '<!-- Cover Area -->' +
        '<div style="position:relative;width:100%;height:140px;background:linear-gradient(135deg, #E5E5EA 0%, #D1D1D6 100%);">' +
          '<div id="editCoverPreview" style="width:100%;height:100%;">' + coverContent + '</div>' +
          '<label style="position:absolute;bottom:12px;right:12px;width:32px;height:32px;border-radius:16px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);color:#FFF;display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
            '<input type="file" id="editCoverInput" accept="image/*" style="display:none;" onchange="App.handleCoverSelect(event)" />' +
          '</label>' +
        '</div>' +
        
        '<!-- Avatar Area -->' +
        '<div style="display:flex;justify-content:center;margin-top:-45px;margin-bottom:20px;">' +
          '<div style="position:relative;">' +
            '<div style="width:90px;height:90px;border-radius:45px;border:4px solid #FAFAFA;overflow:hidden;background:#FFF;">' +
               avatarContent +
            '</div>' +
            '<label style="position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:14px;background:#007AFF;border:2px solid #FAFAFA;color:#FFF;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,0.2);">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
              '<input type="file" id="editAvatarInput" accept="image/*" style="display:none;" onchange="App.handleAvatarSelect(event)" />' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div style="padding:0 16px 30px;">' +
          '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:16px;">' +
            '<div style="display:flex;flex-direction:column;gap:16px;">' +
              (function(){
                var eData = S.editProfileData || {};
                var prenomVal = eData.prenom !== undefined ? eData.prenom : (freshU.prenom||'');
                var nomVal = eData.nom !== undefined ? eData.nom : (freshU.nom||'');
                var bioVal = eData.bio !== undefined ? eData.bio : (freshU.bio||'');
                return '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Prénom</label>' +
                  '<input type="text" id="editPrenom" value="' + safeHtml(prenomVal) + '" style="border:none;border-bottom:1px solid #E5E5EA;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Nom</label>' +
                  '<input type="text" id="editNom" value="' + safeHtml(nomVal) + '" style="border:none;border-bottom:1px solid #E5E5EA;font-size:16px;outline:none;padding-bottom:8px;border-radius:0;" />' +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;">' +
                  '<label style="font-size:13px;color:#8E8E93;font-weight:600;">Bio</label>' +
                  '<textarea id="editBio" style="border:none;font-size:16px;outline:none;resize:none;font-family:inherit;min-height:60px;background:#F8F8F8;padding:12px;border-radius:12px;">' + safeHtml(bioVal) + '</textarea>' +
                '</div>';
              })() +
            '</div>' +
          '</div>' +

          '<div style="background:#FFF;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">' +
            '<label style="font-size:14px;font-weight:700;color:#000;display:block;margin-bottom:12px;">Sections (2 max)</label>' +
            '<div id="editSectionBadgesContainer">' + App.renderSectionBadges(S.editSections, 'toggleEditSection') + '</div>' + 
          '</div>' +
        '</div>' +

      '</div>' +
    '</div>';
  }
  function renderPostOptionsModal(post) {
    if (!post) return '';
    var isMine = S.user && S.user.id === post.userId;
    return '<div onclick="App.closePostOptions()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;justify-content:center;align-items:flex-end;">' +
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:460px;background:#FFF;border-top-left-radius:20px;border-top-right-radius:20px;padding:16px;animation:slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1);">' +
        '<div style="width:40px;height:4px;background:#D1D1D6;border-radius:2px;margin:0 auto 20px;"></div>' +
        (isMine ? '<button onclick="App.deletePost(\''+post.id+'\')" style="width:100%;padding:14px;color:#FF3B30;font-size:16px;font-weight:600;background:#F2F2F7;border:none;border-radius:12px;margin-bottom:8px;cursor:pointer;">Supprimer le post</button>' : '') +
        '<button onclick="App.viewPost(\''+post.id+'\')" style="width:100%;padding:14px;color:#000;font-size:16px;font-weight:600;background:#F2F2F7;border:none;border-radius:12px;margin-bottom:8px;cursor:pointer;">Voir le post</button>' +
        '<button onclick="App.closePostOptions()" style="width:100%;padding:14px;color:#000;font-size:16px;font-weight:600;background:#F2F2F7;border:none;border-radius:12px;cursor:pointer;">Annuler</button>' +
      '</div>' +
    '</div>';
  }


