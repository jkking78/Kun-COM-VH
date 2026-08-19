// KUN COM VH — Partie 2/8 : Médias (compression image/vidéo, upload/suppression Storage, vues)

  'use strict';
  // Helper for image compression to avoid LocalStorage QuotaExceededError
  // Accepts either a File/Blob (from an <input>) OR an already-encoded dataURL string (e.g. from a canvas crop)
  function compressImage(file, maxWidth, maxHeight, quality, callback) {
    if (!file) return;
    function processDataUrl(srcDataUrl) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width;
        var h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        if (h > maxHeight) {
          w = Math.round((w * maxHeight) / h);
          h = maxHeight;
        }
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', quality || 0.7);
        callback(dataUrl);
      };
      img.onerror = function() { callback(srcDataUrl); };
      img.src = srcDataUrl;
    }
    if (typeof file === 'string') {
      processDataUrl(file);
    } else {
      var reader = new FileReader();
      reader.onload = function(e) { processDataUrl(e.target.result); };
      reader.readAsDataURL(file);
    }
  }

  // Une vidéo est reconnue soit par son préfixe MIME (data:video, ancien format
  // encore présent sur les publications existantes), soit par son extension de
  // fichier (nouveau format : vraie URL hébergée sur Supabase Storage).
  function isVideoUrl(url) {
    if (typeof url !== 'string') return false;
    if (url.indexOf('data:video') === 0) return true;
    return /\.(webm|mp4|mov|m4v|3gp|avi|mkv)(\?|#|$)/i.test(url);
  }

  // Convertit un data:URL (base64) en Blob, pour pouvoir l'envoyer vers Supabase Storage.
  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mimeMatch = /:(.*?);/.exec(parts[0]);
    var mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    var bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function extFromDataUrl(dataUrl) {
    var m = /^data:[a-zA-Z0-9]+\/([a-zA-Z0-9.+-]+);/.exec(dataUrl || '');
    if (!m) return 'bin';
    var sub = m[1].toLowerCase().split('+')[0];
    if (sub === 'quicktime') return 'mov';
    if (sub === 'jpeg') return 'jpg';
    return sub;
  }

  // Envoie un média (photo ou vidéo compressée) vers Supabase Storage (bucket
  // "post-media") plutôt que de le garder en base64 dans la publication —
  // nécessaire pour que l'appli reste rapide/légère quand le nombre de
  // publications grandit. En cas d'échec (bucket pas encore créé, hors-ligne,
  // etc.) on retombe automatiquement sur le data:URL, pour ne jamais bloquer
  // la publication.
  // Nombre d'uploads média encore en cours. Sert à mettre le bouton « Publier »
  // en attente le temps que Storage réponde, pour ne JAMAIS enregistrer un média
  // en base64 dans la base par précipitation.
  var _mediaUploadsPending = 0;
  function mediaUploadsPending() { return _mediaUploadsPending; }
  // Attend la fin des uploads en cours. Pendant l'attente, met le bouton fourni
  // en état « Envoi du média… » (désactivé). Plafond de 60 s pour ne jamais
  // bloquer indéfiniment (au pire on publie ce qu'on a).
  function waitForMediaUploads(btn) {
    return new Promise(function(resolve) {
      if (_mediaUploadsPending <= 0) { resolve(); return; }
      var original = null, waited = 0;
      if (btn) { original = btn.textContent; btn.disabled = true; btn.style.opacity = '0.7'; btn.textContent = 'Envoi du média…'; }
      var timer = setInterval(function() {
        waited += 120;
        if (_mediaUploadsPending <= 0 || waited > 60000) {
          clearInterval(timer);
          if (btn) { btn.disabled = false; btn.style.opacity = ''; if (original !== null) btn.textContent = original; }
          resolve();
        }
      }, 120);
    });
  }

  function uploadMediaToStorage(dataUrl, callback) {
    if (!supabase || !supabase.storage) { callback(null); return; }
    var path, blob;
    try {
      var ext = extFromDataUrl(dataUrl);
      blob = dataUrlToBlob(dataUrl);
      var folder = (S.user && S.user.id) ? S.user.id : 'anon';
      path = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    } catch (e) { callback(null); return; }

    // À partir d'ici l'envoi est engagé : on compte un upload en cours, et on
    // garantit qu'il est décompté exactement une fois, quelle que soit l'issue.
    _mediaUploadsPending++;
    var settled = false;
    var done = function(url) {
      if (settled) return; settled = true;
      _mediaUploadsPending = Math.max(0, _mediaUploadsPending - 1);
      callback(url);
    };
    try {
      supabase.storage.from('post-media').upload(path, blob, { contentType: blob.type || undefined, upsert: false }).then(
        function(res) {
          if (!res || res.error) { console.warn('Storage upload error:', res && res.error); done(null); return; }
          try {
            var pub = supabase.storage.from('post-media').getPublicUrl(path);
            var url = pub && pub.data ? pub.data.publicUrl : null;
            done(url || null);
          } catch (e) { done(null); }
        },
        function(err) { console.warn('Storage upload exception:', err); done(null); }
      );
    } catch (e) { done(null); }
  }

  // Extrait le chemin interne (bucket path) d'une URL publique Supabase Storage,
  // nécessaire pour demander sa suppression. Retourne null pour tout ce qui n'est
  // pas une URL de notre bucket "post-media" (ex: data:URL, média externe).
  function storagePathFromUrl(url) {
    if (typeof url !== 'string') return null;
    var marker = '/storage/v1/object/public/post-media/';
    var idx = url.indexOf(marker);
    if (idx === -1) return null;
    try { return decodeURIComponent(url.slice(idx + marker.length)); } catch (e) { return url.slice(idx + marker.length); }
  }

  // Supprime de Supabase Storage les fichiers médias qui ne sont plus utilisés par
  // AUCUNE autre publication (un repost peut référencer la même URL que l'original,
  // donc on vérifie avant de supprimer pour ne jamais casser un partage existant).
  // Supprime définitivement des fichiers de Supabase Storage — y compris s'ils sont
  // encore référencés par un partage/repost fait par quelqu'un d'autre (choix
  // voulu : quand l'original disparaît, le média disparaît partout).
  function deleteUnusedMediaFromStorage(urls, excludePostId) {
    if (!supabase || !supabase.storage || !urls || urls.length === 0) return;
    try {
      var paths = urls.map(storagePathFromUrl).filter(Boolean);
      if (paths.length === 0) return;
      supabase.storage.from('post-media').remove(paths).then(function(){}, function(e){ console.warn('Storage delete error:', e); });
    } catch (e) { console.warn('deleteUnusedMediaFromStorage error:', e); }
  }

  // Réduction de qualité vidéo optionnelle : ré-encode en temps réel via canvas + MediaRecorder
  // (aucune librairie externe nécessaire). Si l'API n'est pas supportée par le navigateur,
  // on retombe automatiquement sur le fichier original sans compression.
  function compressVideo(file, callback) {
    if (!file) { callback(null); return; }
    var canSupport = (typeof MediaRecorder !== 'undefined') &&
      document.createElement('canvas').captureStream;
    function passthrough() {
      var reader = new FileReader();
      reader.onload = function(e) { callback(e.target.result); };
      reader.onerror = function() { callback(null); };
      reader.readAsDataURL(file);
    }
    if (!canSupport) { passthrough(); return; }

    var objectUrl = URL.createObjectURL(file);
    var videoEl = document.createElement('video');
    // Volume à 0 (plutôt que muted=true) : certains navigateurs ne capturent pas la piste
    // audio d'un élément <video> "muted" dans captureStream(), ce qui produisait des
    // vidéos recompressées sans son. Le volume à 0 garde la lecture silencieuse pour
    // l'utilisateur sans affecter la piste audio capturée.
    videoEl.volume = 0;
    videoEl.playsInline = true;
    videoEl.src = objectUrl;
    document.body.appendChild(videoEl);
    videoEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:2px;height:2px;opacity:0;pointer-events:none;';

    var finished = false;
    function cleanup() {
      try { URL.revokeObjectURL(objectUrl); } catch(e){}
      try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch(e){}
      try { if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl); } catch(e){}
    }

    videoEl.onerror = function() { if (finished) return; finished = true; cleanup(); passthrough(); };

    videoEl.onloadedmetadata = function() {
      try {
        // Qualité cible : HD (1280px sur le plus grand côté, portrait ou paysage) à 30 im/s,
        // comme les réseaux sociaux — on ne réduit jamais en dessous du HD.
        var maxLongSide = 1280;
        var srcW = videoEl.videoWidth || maxLongSide;
        var srcH = videoEl.videoHeight || maxLongSide;
        var longSide = Math.max(srcW, srcH);
        var scale = Math.min(1, maxLongSide / longSide);
        var w = Math.max(2, Math.round(srcW * scale));
        var h = Math.max(2, Math.round(srcH * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');

        // Récupère la piste audio de la vidéo source pour la recombiner avec le flux
        // vidéo du canvas — sans quoi la vidéo recompressée serait muette.
        var srcStream = (typeof videoEl.captureStream === 'function') ? videoEl.captureStream()
          : (typeof videoEl.mozCaptureStream === 'function') ? videoEl.mozCaptureStream()
          : null;
        var audioTracks = srcStream ? srcStream.getAudioTracks() : [];
        if (audioTracks.length === 0) {
          // Impossible de capturer l'audio sur ce navigateur (ex: Safari/iOS) : on ne
          // recompresse pas plutôt que de publier une vidéo sans son.
          finished = true;
          cleanup();
          passthrough();
          return;
        }

        var stream = canvas.captureStream(30);
        audioTracks.forEach(function(t){ stream.addTrack(t); });

        var mimeType = 'video/webm;codecs=vp8,opus';
        if (typeof MediaRecorder.isTypeSupported === 'function' && !MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8';
          if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
        }
        var recorder = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 2500000 });
        var chunks = [];
        recorder.ondataavailable = function(e) { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onerror = function() {
          if (finished) return;
          finished = true;
          try { videoEl.pause(); } catch(e){}
          cleanup();
          passthrough();
        };
        recorder.onstop = function() {
          if (finished) return;
          finished = true;
          cleanup();
          var blob = new Blob(chunks, { type: 'video/webm' });
          var reader = new FileReader();
          reader.onload = function(e) { callback(e.target.result); };
          reader.onerror = function() { callback(null); };
          reader.readAsDataURL(blob);
        };
        var drawFrame = function() {
          if (finished || videoEl.paused || videoEl.ended) return;
          try { ctx.drawImage(videoEl, 0, 0, w, h); } catch(e) {}
          requestAnimationFrame(drawFrame);
        };
        videoEl.onplay = function() { drawFrame(); };
        videoEl.onended = function() { if (recorder.state !== 'inactive') recorder.stop(); };
        recorder.start();
        videoEl.play().catch(function() {
          // Lecture bloquée par la politique autoplay (volume=0 non suffisant) : on
          // retente en "muted" (requis par certains navigateurs pour l'autoplay).
          videoEl.muted = true;
          videoEl.play().catch(function() {
            if (finished) return;
            finished = true;
            try { recorder.stop(); } catch(e){}
            cleanup();
            passthrough();
          });
        });
      } catch (err) {
        if (finished) return;
        finished = true;
        cleanup();
        passthrough();
      }
    };
  }

  // Génère une image d'aperçu (poster) à partir d'une vidéo, en capturant une image
  // à un instant proche du début — évite l'écran noir avant lecture (façon Facebook/Instagram).
  // `source` peut être un File/Blob (fortement recommandé : bien plus rapide et fiable
  // sur mobile qu'un data:URL de plusieurs dizaines de Mo) ou un data:URL.
  function generateVideoPoster(source, callback) {
    if (!source) { callback(null); return; }
    var objUrl = null;
    try {
      var src;
      if (typeof source === 'string') {
        src = source;
      } else {
        objUrl = URL.createObjectURL(source);
        src = objUrl;
      }

      var v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('crossorigin', 'anonymous');
      v.preload = 'auto';
      // Safari/iOS ne charge et ne décode pas de façon fiable un <video> qui n'est pas
      // attaché au DOM : on l'insère donc hors écran (invisible) le temps de la capture.
      v.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:2px;height:2px;opacity:0;pointer-events:none;';
      document.body.appendChild(v);

      var done = false;
      var captured = false;
      var timer = null;
      function cleanupEl() {
        if (timer) { clearTimeout(timer); timer = null; }
        try { v.pause(); } catch(e){}
        try { v.removeAttribute('src'); v.load(); } catch(e){}
        try { if (v.parentNode) v.parentNode.removeChild(v); } catch(e){}
        if (objUrl) { try { URL.revokeObjectURL(objUrl); } catch(e){} objUrl = null; }
      }
      function finish(poster) { if (done) return; done = true; cleanupEl(); callback(poster); }
      function capture() {
        if (captured || done) return;
        var w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) return; // Dimensions pas encore connues : on retentera.
        try {
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var ctx = c.getContext('2d');
          ctx.drawImage(v, 0, 0, w, h);
          var dataUrl = c.toDataURL('image/jpeg', 0.72);
          // Un canvas vide produit une image très courte : on la rejette pour ne pas
          // enregistrer une vignette noire/transparente inutile.
          if (!dataUrl || dataUrl.length < 1200) return;
          captured = true;
          finish(dataUrl);
        } catch (e) { finish(null); }
      }
      function trySeek() {
        try {
          var d = v.duration;
          var t = (isFinite(d) && d > 0) ? Math.min(0.15, d / 10) : 0.1;
          if (v.currentTime < t) { v.currentTime = t; } else { capture(); }
        } catch (e) { capture(); }
      }
      v.onloadedmetadata = trySeek;
      v.onloadeddata = function() { if (!captured) { capture(); trySeek(); } };
      v.onseeked = capture;
      v.oncanplay = capture;
      v.oncanplaythrough = capture;
      v.ontimeupdate = function() { if (!captured && v.currentTime > 0) capture(); };
      v.onerror = function() { finish(null); };

      // Filet de sécurité iOS : certains navigateurs ne décodent une image qu'une fois
      // la lecture réellement démarrée. On lance une lecture muette très brève.
      setTimeout(function() {
        if (captured || done) return;
        try {
          var pr = v.play();
          if (pr && pr.then) {
            pr.then(function() {
              setTimeout(function() { capture(); try { v.pause(); } catch(e){} }, 240);
            }, function() {});
          }
        } catch(e){}
      }, 700);

      try { v.load(); } catch(e){}
      timer = setTimeout(function() { finish(null); }, 10000);
    } catch (e) {
      if (objUrl) { try { URL.revokeObjectURL(objUrl); } catch(e2){} }
      callback(null);
    }
  }

  // Génère a posteriori la vignette des publications vidéo qui n'en ont pas
  // (publiées avant ce correctif, ou dont la génération avait échoué), puis
  // l'enregistre en local et sur Supabase pour ne le faire qu'une seule fois.
  // Traite la file un élément à la fois : générer plusieurs vignettes vidéo en
  // parallèle (un <video> caché par publication, tous en train de décoder en même
  // temps) surchargeait Safari mobile et faisait échouer ou traîner l'affichage.
  var _posterBackfillTried = {};
  var _posterBackfillQueue = [];
  var _posterBackfillBusy = false;
  function backfillVideoPoster(post) {
    if (!post || post.videoPoster) return;
    if (_posterBackfillTried[post.id]) return;
    var vidUrl = (post.mediaUrls || []).find(function(m){ return isVideoUrl(m); });
    if (!vidUrl) return;
    _posterBackfillTried[post.id] = true;
    _posterBackfillQueue.push({ id: post.id, url: vidUrl });
    processPosterBackfillQueue();
  }
  function processPosterBackfillQueue() {
    if (_posterBackfillBusy || _posterBackfillQueue.length === 0) return;
    _posterBackfillBusy = true;
    var item = _posterBackfillQueue.shift();
    generateVideoPoster(item.url, function(poster) {
      _posterBackfillBusy = false;
      if (poster) {
        var posts = db(SK.POSTS, []);
        var target = posts.find(function(p){ return p.id === item.id; });
        if (target && !target.videoPoster) {
          target.videoPoster = poster;
          dbSet(SK.POSTS, posts);
          if (supabase) {
            try {
              supabase.from('kun_com_posts').upsert({ id: target.id, content: target }, { onConflict: 'id' }).then(function(){}, function(){});
            } catch(e){}
          }
          render();
        }
      }
      processPosterBackfillQueue();
    });
  }

  // ============================================================
  // COMPTEUR DE VUES (façon Facebook) — une vue est enregistrée quand la
  // publication apparaît réellement à l'écran (pas au simple rendu), une seule
  // fois par membre. L'auteur ne se compte pas lui-même comme lecteur.
  // ============================================================
  var _viewObserver = null;
  var _viewMarkedThisSession = {};

  function markPostViewed(postId) {
    if (!S.user || !S.user.id) return;
    if (_viewMarkedThisSession[postId]) return;
    _viewMarkedThisSession[postId] = true;

    var posts = db(SK.POSTS, []);
    var post = posts.find(function(p){ return p.id === postId; });
    if (!post) return;
    if (post.userId === S.user.id) return; // l'auteur ne compte pas
    if (!Array.isArray(post.viewedBy)) post.viewedBy = [];
    if (post.viewedBy.indexOf(S.user.id) !== -1) return;

    post.viewedBy.push(S.user.id);
    dbSet(SK.POSTS, posts);
    if (supabase) {
      try {
        supabase.from('kun_com_posts').upsert({ id: post.id, content: post }, { onConflict: 'id' }).then(function(){}, function(){});
      } catch(e){}
    }
    // Met à jour le compteur affiché sans re-rendre tout le fil (évite de
    // perturber le défilement pendant la lecture).
    try {
      var el = document.getElementById('viewCount-' + post.id);
      if (el) el.textContent = post.viewedBy.length;
    } catch(e){}
  }

  function setupViewTracking() {
    if (typeof IntersectionObserver === 'undefined') return;
    try {
      if (!_viewObserver) {
        _viewObserver = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            var id = entry.target.getAttribute('data-postid');
            if (id) {
              markPostViewed(id);
              _viewObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.55 });
      }
      var nodes = document.querySelectorAll('article[data-postid]');
      for (var i = 0; i < nodes.length; i++) {
        var pid = nodes[i].getAttribute('data-postid');
        if (pid && !_viewMarkedThisSession[pid]) _viewObserver.observe(nodes[i]);
      }
    } catch(e) { console.warn('setupViewTracking error:', e); }
  }

    function getUserSections(u) {
    if (!u) return [];
    if (Array.isArray(u.sections) && u.sections.length > 0) return u.sections;
    if (u.section_id) return [u.section_id];
    return [];
  }

  function safeHtml(s) {
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function hashtagify(text) {
    if (!text) return '';
    var safe = safeHtml(text);
    var users = db(SK.USERS, []);
    var html = safe.replace(/#[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]+/gi, function(m) {
      return '<span onclick="App.filterTag(\'' + encodeURIComponent(m) + '\')" style="color:#007AFF;font-weight:700;cursor:pointer;">' + m + '</span>';
    }).replace(/@[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ_.-]+/gi, function(m) {
      var r = resolveMentionToken(m.slice(1), users);
      if (r && r.kind === 'user') {
        return '<span onclick="App.openUserProfile(\'' + r.user.id + '\')" style="color:#007AFF;font-weight:800;cursor:pointer;background:#EBF5FF;padding:2px 6px;border-radius:6px;">' + safeHtml(m) + '</span>';
      }
      // Mentions collectives : mises en évidence différemment (violet) pour qu'on
      // voie d'un coup d'œil qu'elles touchent plusieurs personnes.
      if (r && r.kind === 'all') {
        return '<span style="color:#5856D6;font-weight:800;background:#F0EFFF;padding:2px 6px;border-radius:6px;">' + safeHtml(m) + '</span>';
      }
      if (r && r.kind === 'section') {
        return '<span onclick="App.story(\'' + r.section.id + '\')" style="color:#5856D6;font-weight:800;cursor:pointer;background:#F0EFFF;padding:2px 6px;border-radius:6px;">' + safeHtml(m) + '</span>';
      }
      return '<span style="color:#007AFF;font-weight:700;">' + safeHtml(m) + '</span>';
    }).replace(/(https?:\/\/[^\s<]+)/gi, function(m) {
      return '<a href="' + m + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="color:#007AFF;font-weight:600;text-decoration:underline;word-break:break-all;">' + m + '</a>';
    }).replace(/\n/g, '<br>');
    return html;
  }

  // Extrait les liens http(s) d'un texte (pour l'enregistrement automatique dans le profil)
  function extractLinks(text) {
    if (!text) return [];
    var matches = text.match(/(https?:\/\/[^\s<]+)/gi) || [];
    // Dédoublonne dans le même texte
    var seen = {};
    return matches.filter(function(u) { if (seen[u]) return false; seen[u] = true; return true; });
  }

  // Enregistre automatiquement les liens partagés dans le profil de l'utilisateur
  function saveLinksToProfile(userId, links, sourcePostId) {
    if (!userId || !links || links.length === 0) return;
    var allUsers = db(SK.USERS, []);
    var uIdx = allUsers.findIndex(function(u){ return u.id === userId; });
    if (uIdx === -1) return;
    var u = allUsers[uIdx];
    if (!Array.isArray(u.sharedLinks)) u.sharedLinks = [];
    var existingUrls = {};
    u.sharedLinks.forEach(function(l){ existingUrls[l.url] = true; });
    var added = false;
    links.forEach(function(url) {
      if (!existingUrls[url]) {
        u.sharedLinks.unshift({ url: url, postId: sourcePostId || null, timestamp: Date.now() });
        existingUrls[url] = true;
        added = true;
      }
    });
    if (!added) return;
    if (u.sharedLinks.length > 100) u.sharedLinks = u.sharedLinks.slice(0, 100);
    allUsers[uIdx] = u;
    dbSet(SK.USERS, allUsers);
    if (S.user && S.user.id === userId) {
      S.user = u;
      try { localStorage.setItem(SK.SESS, JSON.stringify(u)); } catch(e){}
    }
    if (supabase) {
      supabase.from('kun_com_profiles').upsert({ id: u.id, content: u }, { onConflict: 'id' }).then(function(){}, function(e){});
    }
  }

  function trendingTags() {
    var posts = db(SK.POSTS, []);
    var cnt = {};
    posts.forEach(function(p) {
      var tags = ((p.caption||'') + ' ' + (p.title||'')).match(/#[\wéèêàâôûîçÉÈÊÀÂÔÛÎÇùÙ]+/gi) || [];
      tags.forEach(function(t) { var k = t.toLowerCase(); cnt[k] = (cnt[k]||0)+1; });
    });
    return Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]; }).slice(0,8)
      .map(function(t){ return t.charAt(0).toUpperCase()+t.slice(1); });
  }

  function userIsLiked(post) {
    return S.user && Array.isArray(post.likedBy) && post.likedBy.indexOf(S.user.id) !== -1;
  }

  // ============================================================
