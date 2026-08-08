// Lecture des métadonnées Open Graph d'un lien, pour afficher une miniature
// dans le composeur et sur la publication.
//
// Pourquoi une fonction serveur : le navigateur ne peut pas lire le HTML d'un
// site tiers (blocage CORS). Il faut donc que ce soit le serveur qui aille
// chercher la page et n'en renvoie que le titre, la description et l'image.

var TIMEOUT_MS = 6000;
var MAX_BYTES = 400 * 1024;   // l'en-tête <head> tient largement dedans

// Garde-fou anti-SSRF : sans cela, n'importe qui pourrait faire interroger par
// notre serveur des adresses du réseau interne (localhost, 10.x, 192.168.x,
// métadonnées cloud…) et en lire la réponse. Seul le web public est autorisé.
var BLOCKED_HOST = /^(localhost$|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

function isPublicHttpUrl(raw) {
  var u;
  try { u = new URL(raw); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (BLOCKED_HOST.test(u.hostname)) return null;
  if (!u.hostname || u.hostname.indexOf('.') === -1) return null;
  return u;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, function(_, n){ try { return String.fromCharCode(n); } catch(e){ return ''; } })
    .replace(/&amp;/g, '&');
}

// Récupère le contenu d'une balise meta, quel que soit l'ordre des attributs
// (property="og:title" content="…" ou content="…" property="og:title").
function meta(html, names) {
  for (var i = 0; i < names.length; i++) {
    var n = names[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re1 = new RegExp('<meta[^>]+(?:property|name)\\s*=\\s*["\']' + n + '["\'][^>]*content\\s*=\\s*["\']([^"\']*)["\']', 'i');
    var re2 = new RegExp('<meta[^>]+content\\s*=\\s*["\']([^"\']*)["\'][^>]*(?:property|name)\\s*=\\s*["\']' + n + '["\']', 'i');
    var m = html.match(re1) || html.match(re2);
    if (m && m[1] && m[1].trim()) return decodeEntities(m[1].trim());
  }
  return '';
}

// Lit au plus MAX_BYTES : inutile de télécharger une page entière alors que
// tout ce qui nous intéresse se trouve dans son <head>.
async function fetchHead(url, signal) {
  var r = await fetch(url, {
    signal: signal,
    redirect: 'follow',
    headers: {
      // Beaucoup de sites ne servent les balises Open Graph qu'aux robots
      // sociaux ; se présenter comme un navigateur classique donne souvent
      // une page sans métadonnées.
      'User-Agent': 'Mozilla/5.0 (compatible; CommitVH-LinkPreview/1.0; +https://kun-com-vh.vercel.app)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });
  if (!r.ok) return { ok: false, status: r.status, html: '', finalUrl: r.url || url };
  var type = (r.headers.get('content-type') || '').toLowerCase();
  if (type.indexOf('text/html') === -1 && type.indexOf('xhtml') === -1) {
    return { ok: false, status: 415, html: '', finalUrl: r.url || url };
  }
  var buf = await r.arrayBuffer();
  var slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
  return { ok: true, status: r.status, html: Buffer.from(slice).toString('utf8'), finalUrl: r.url || url };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  var raw = (req.query && req.query.url) || '';
  var target = isPublicHttpUrl(raw);
  if (!target) { res.status(400).json({ error: 'url invalide' }); return; }

  // Même en cas d'échec, on renvoie de quoi afficher une vignette minimale
  // (nom de domaine + favicon) : mieux qu'une URL brute illisible.
  var fallback = {
    url: target.href,
    siteName: target.hostname.replace(/^www\./, ''),
    title: '',
    description: '',
    image: '',
    favicon: target.origin + '/favicon.ico',
    partial: true
  };

  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, TIMEOUT_MS);
  try {
    var r = await fetchHead(target.href, ctrl.signal);
    clearTimeout(timer);
    if (!r.ok) { res.setHeader('Cache-Control', 'public, s-maxage=600'); res.status(200).json(fallback); return; }

    var html = r.html;
    var finalUrl = r.finalUrl;
    var title = meta(html, ['og:title', 'twitter:title']);
    if (!title) {
      var t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (t) title = decodeEntities(t[1].replace(/\s+/g, ' ').trim());
    }
    var image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    // Une image donnée en chemin relatif doit être ramenée en absolue, sinon
    // le navigateur tenterait de la charger depuis NOTRE domaine.
    if (image) { try { image = new URL(image, finalUrl).href; } catch (e) { image = ''; } }
    if (image && !/^https?:\/\//i.test(image)) image = '';

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({
      url: target.href,
      siteName: meta(html, ['og:site_name']) || fallback.siteName,
      title: (title || '').slice(0, 160),
      description: (meta(html, ['og:description', 'twitter:description', 'description']) || '').slice(0, 240),
      image: image,
      favicon: fallback.favicon,
      partial: !title && !image
    });
  } catch (e) {
    clearTimeout(timer);
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(200).json(fallback);
  }
};
