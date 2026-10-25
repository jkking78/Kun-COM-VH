// Sert l'image (photo ou vignette vidéo) d'une publication sous forme de vraie
// URL HTTP, en décodant le data:URL base64 stocké dans Supabase — nécessaire
// car les aperçus de liens (WhatsApp, etc.) ne peuvent pas charger une image
// depuis un data:URL directement, seulement depuis une URL HTTP classique.

var SUPABASE_URL = 'https://yugkryhikrfsxbuyxacl.supabase.co';
var SUPABASE_KEY = 'sb_publishable_CMnVxHYsKJIP51J0zDRX6w_hdLgiHR7';

// Lecture via la fonction publique kc_apercu_publication (voir api/p.js) :
// les publications elles-mêmes ne sont plus lisibles sans connexion.
async function fetchImage(id) {
  var r = await fetch(SUPABASE_URL + '/rest/v1/rpc/kc_apercu_publication', {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_id: String(id) })
  });
  if (!r.ok) return null;
  var apercu = await r.json();
  return apercu && typeof apercu.image === 'string' ? apercu.image : null;
}

module.exports = async function handler(req, res) {
  var id = (req.query && req.query.id) || '';

  try {
    var dataUrl = await fetchImage(id);
    if (!dataUrl) { res.status(404).send('No image'); return; }

    // Photos seulement : une image SVG servie depuis notre domaine exécuterait
    // son script avec les droits de l'application (vol de session).
    var match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]*)$/.exec(dataUrl);
    if (!match) { res.status(404).send('No image'); return; }

    var mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    var buffer = Buffer.from(match[2], 'base64');

    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.status(200).send(buffer);
  } catch (e) {
    res.status(404).send('No image');
  }
};
