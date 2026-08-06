// Sert l'image (photo ou vignette vidéo) d'une publication sous forme de vraie
// URL HTTP, en décodant le data:URL base64 stocké dans Supabase — nécessaire
// car les aperçus de liens (WhatsApp, etc.) ne peuvent pas charger une image
// depuis un data:URL directement, seulement depuis une URL HTTP classique.

var SUPABASE_URL = 'https://yugkryhikrfsxbuyxacl.supabase.co';
var SUPABASE_KEY = 'sb_publishable_CMnVxHYsKJIP51J0zDRX6w_hdLgiHR7';

async function fetchPost(id) {
  var url = SUPABASE_URL + '/rest/v1/kun_com_posts?id=eq.' + encodeURIComponent(id) + '&select=*';
  var r = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
  });
  if (!r.ok) return null;
  var rows = await r.json();
  if (!rows || !rows[0]) return null;
  return rows[0].content || rows[0];
}

function pickImageDataUrl(post) {
  if (!post) return null;
  if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 && typeof post.mediaUrls[0] === 'string' && post.mediaUrls[0].indexOf('data:image') === 0) {
    return post.mediaUrls[0];
  }
  if (typeof post.videoPoster === 'string' && post.videoPoster.indexOf('data:image') === 0) {
    return post.videoPoster;
  }
  if (Array.isArray(post.originalMediaUrls) && post.originalMediaUrls.length > 0 && typeof post.originalMediaUrls[0] === 'string' && post.originalMediaUrls[0].indexOf('data:image') === 0) {
    return post.originalMediaUrls[0];
  }
  if (typeof post.originalVideoPoster === 'string' && post.originalVideoPoster.indexOf('data:image') === 0) {
    return post.originalVideoPoster;
  }
  return null;
}

module.exports = async function handler(req, res) {
  var id = (req.query && req.query.id) || '';

  try {
    var post = await fetchPost(id);
    var dataUrl = pickImageDataUrl(post);
    if (!dataUrl) { res.status(404).send('No image'); return; }

    var match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl);
    if (!match) { res.status(404).send('No image'); return; }

    var mime = match[1];
    var buffer = Buffer.from(match[2], 'base64');

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.status(200).send(buffer);
  } catch (e) {
    res.status(404).send('No image');
  }
};
