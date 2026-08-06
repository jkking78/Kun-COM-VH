// Page de prévisualisation publique d'une publication (utilisée quand un lien
// "Copier le lien" est partagé hors de l'appli, ex: WhatsApp). Les crawlers de
// réseaux sociaux ne lisent que le HTML brut (pas de JS) : cette fonction
// serverless renvoie donc des balises Open Graph statiques, puis redirige un
// vrai visiteur vers l'application (?post=ID) qui ouvre la publication.

var SUPABASE_URL = 'https://yugkryhikrfsxbuyxacl.supabase.co';
var SUPABASE_KEY = 'sb_publishable_CMnVxHYsKJIP51J0zDRX6w_hdLgiHR7';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

module.exports = async function handler(req, res) {
  var id = (req.query && req.query.id) || '';
  var proto = req.headers['x-forwarded-proto'] || 'https';
  var host = req.headers['x-forwarded-host'] || req.headers.host;
  var origin = proto + '://' + host;
  var appUrl = origin + '/?post=' + encodeURIComponent(id);

  var post = null;
  try { post = await fetchPost(id); } catch (e) { post = null; }

  var title = 'Commit VH';
  var description = 'Découvrez cette publication sur Commit — Église Vase d\'Honneur.';
  var hasImage = false;

  if (post) {
    var authorName = post.author || 'Un membre';
    title = authorName + ' · Commit VH';
    var caption = (post.caption || '').trim();
    description = caption ? caption.slice(0, 180) : 'Découvrez cette publication sur Commit VH.';
    hasImage = (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 && typeof post.mediaUrls[0] === 'string' && post.mediaUrls[0].indexOf('data:image') === 0)
      || (typeof post.videoPoster === 'string' && post.videoPoster.indexOf('data:image') === 0)
      || (Array.isArray(post.originalMediaUrls) && post.originalMediaUrls.length > 0 && typeof post.originalMediaUrls[0] === 'string' && post.originalMediaUrls[0].indexOf('data:image') === 0)
      || (typeof post.originalVideoPoster === 'string' && post.originalVideoPoster.indexOf('data:image') === 0);
  }

  var imageTag = '';
  if (hasImage) {
    var imageUrl = origin + '/api/p-image/' + encodeURIComponent(id);
    imageTag =
      '<meta property="og:image" content="' + esc(imageUrl) + '">' +
      '<meta name="twitter:image" content="' + esc(imageUrl) + '">' +
      '<meta name="twitter:card" content="summary_large_image">';
  } else {
    imageTag = '<meta name="twitter:card" content="summary">';
  }

  var html = '<!DOCTYPE html>' +
    '<html lang="fr"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta property="og:type" content="article">' +
    '<meta property="og:site_name" content="Commit VH">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' +
    '<meta property="og:url" content="' + esc(appUrl) + '">' +
    '<meta name="twitter:title" content="' + esc(title) + '">' +
    '<meta name="twitter:description" content="' + esc(description) + '">' +
    imageTag +
    '<title>' + esc(title) + '</title>' +
    '<meta http-equiv="refresh" content="0; url=' + esc(appUrl) + '">' +
    '<script>location.replace(' + JSON.stringify(appUrl) + ');</script>' +
    '</head><body>' +
    '<p style="font-family:sans-serif;padding:24px;">Redirection vers <a href="' + esc(appUrl) + '">Commit VH</a>…</p>' +
    '</body></html>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).send(html);
};
