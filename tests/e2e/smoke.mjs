// Test de bout en bout dans un vrai navigateur (Chromium, via playwright-core).
//
// L'application est servie depuis public/ par un petit serveur local, et TOUTES
// les requêtes vers Supabase sont interceptées : aucune donnée réelle n'est lue
// ni écrite. On vérifie :
//   1. sans session : l'écran de connexion s'affiche, sans erreur JavaScript ;
//   2. avec une session : le fil s'affiche à partir de données PIÉGÉES (HTML,
//      apostrophes, couleurs et URL malveillantes) sans qu'aucun script injecté
//      ne s'exécute ;
//   3. les fonctions d'échappement font l'aller-retour exact dans un
//      gestionnaire onclick réel.
//
// Lancement : node tests/e2e/smoke.mjs   (ou npm test)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const RACINE = fileURLToPath(new URL('../../public/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.css': 'text/css',
};

function demarrerServeur() {
  const serveur = createServer(async (req, res) => {
    const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let fichier = normalize(join(RACINE, chemin));
    if (!fichier.startsWith(RACINE)) { res.writeHead(403).end(); return; }
    try {
      if ((await stat(fichier)).isDirectory()) fichier = join(fichier, 'index.html');
    } catch { fichier = join(RACINE, 'index.html'); }   // repli SPA, comme vercel.json
    try {
      const corps = await readFile(fichier);
      res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' }).end(corps);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok(serveur)));
}

function navigateur() {
  const candidats = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);
  const executablePath = candidats.find((c) => existsSync(c));
  return chromium.launch(executablePath ? { executablePath } : {});
}

// ---- Données piégées ----
const MOI = 'aaaaaaaa-0000-4000-8000-000000000001';
const AUTRE = 'bbbbbbbb-0000-4000-8000-000000000002';
const PIEGE_HTML = '<img src=x onerror="window.__xss=\'html\'">';
const maintenant = Date.now();

const profils = [
  { id: MOI, content: { id: MOI, prenom: 'Awa', nom: 'Test', role: 'MEMBRE', sections: [], notifications: [] } },
  { id: AUTRE, content: {
    id: AUTRE, prenom: "O'Brien " + PIEGE_HTML, nom: 'X', role: 'MEMBRE', sections: [],
    avatar_color: 'red;" onmouseover="window.__xss=\'couleur\'" data-pirate="',
  } },
];
const publications = [
  { id: 'p_piege', created_at: new Date(maintenant).toISOString(), content: {
    id: 'p_piege', userId: AUTRE, author: "O'Brien", timestamp: maintenant,
    caption: 'Légende ' + PIEGE_HTML + " l'église #Culte",
    avatarColor: 'blue;" onclick="window.__xss=\'couleurPost\'" data-pirate="',
    postBg: null,
    mediaUrls: ['javascript:window.__xss="media"'],
    likedBy: [], comments: [{
      id: 'c1', userId: AUTRE, author: "');window.__xss='commentaire';//", text: PIEGE_HTML, timestamp: maintenant,
    }],
  } },
];

function jetonFactice(sub) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({
    sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(maintenant / 1000) + 3600,
    app_metadata: { role: 'MEMBRE' },
  }) + '.signature';
}

async function intercepterSupabase(page) {
  await page.route(/supabase\.co/, (route) => {
    const url = new URL(route.request().url());
    const json = (corps, code = 200) => route.fulfill({
      status: code, contentType: 'application/json', body: JSON.stringify(corps),
    });
    if (url.pathname.startsWith('/rest/v1/kun_com_posts')) return json(publications);
    if (url.pathname.startsWith('/rest/v1/kun_com_profiles')) return json(profils);
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    if (url.pathname.startsWith('/auth/v1/user')) return json({ id: MOI, aud: 'authenticated', app_metadata: { role: 'MEMBRE' } });
    if (url.pathname.startsWith('/auth/v1/')) return json({}, 400);
    return route.abort();
  });
  // Polices Google : inutiles au test, et le réseau peut être fermé.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
}

async function nouvellePage(nav, base, session) {
  const contexte = await nav.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await intercepterSupabase(page);
  if (session) {
    await page.addInitScript(([cle, valeur]) => {
      if (!localStorage.getItem('__kc_test_init')) {
        localStorage.setItem(cle, valeur);
        localStorage.setItem('__kc_test_init', '1');
      }
    }, ['sb-yugkryhikrfsxbuyxacl-auth-token', JSON.stringify(session)]);
  }
  await page.goto(base + '/');
  return { page, erreurs, contexte };
}

const serveur = await demarrerServeur();
const base = 'http://127.0.0.1:' + serveur.address().port;
const nav = await navigateur();
let echecs = 0;
async function cas(nom, fn) {
  try { await fn(); console.log('ok —', nom); }
  catch (e) { echecs++; console.error('ÉCHEC —', nom, '\n', e); }
}

try {
  await cas('sans session, l\'écran de connexion s\'affiche sans erreur', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, null);
    await page.waitForSelector('#loginSubmitBtn', { timeout: 15000 });
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('avec session, le fil s\'affiche et aucune donnée piégée ne s\'exécute', async () => {
    const session = {
      access_token: jetonFactice(MOI), refresh_token: 'r', token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(maintenant / 1000) + 3600,
      user: { id: MOI, aud: 'authenticated', email: 'awa@commit.aev', app_metadata: { role: 'MEMBRE' }, user_metadata: {} },
    };
    const { page, erreurs, contexte } = await nouvellePage(nav, base, session);
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    // Survol de chaque élément de la carte piégée : déclencherait un
    // gestionnaire onmouseover injecté par une couleur malveillante.
    await page.evaluate(() => {
      document.querySelectorAll('#post-p_piege, #post-p_piege *').forEach((el) => {
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      });
    });
    await page.waitForTimeout(500);
    const injectes = await page.$$eval('[data-pirate], img[src="x"]', (els) => els.map((e) => e.outerHTML.slice(0, 120)));
    assert.deepEqual(injectes, [], 'des attributs ou balises ont été injectés dans la page');
    const texte = await page.textContent('#post-p_piege');
    assert.ok(texte.includes('<img src=x'), 'la légende HTML doit s\'afficher comme du texte');
    assert.ok(texte.includes("l'église"), 'l\'apostrophe doit s\'afficher normalement');
    assert.ok(!texte.includes('&apos;') && !texte.includes('&#39;'), 'aucune entité ne doit apparaître à l\'écran');
    const xss = await page.evaluate(() => window.__xss);
    assert.equal(xss, undefined, 'un script injecté s\'est exécuté : ' + xss);
    const html = await page.innerHTML('#post-p_piege');
    assert.ok(!/javascript:/i.test(html), 'aucune URL javascript: ne doit atteindre le DOM');
    assert.ok(!/onmouseover="window/i.test(html), 'une couleur piégée ne doit pas créer d\'attribut');
    // Commentaires : l'auteur piégé finit dans le onclick du bouton « Répondre ».
    await page.evaluate(() => App.openComments('p_piege'));
    await page.waitForSelector('#commentsList', { timeout: 5000 });
    const repondre = await page.$('#commentsList button:has-text("Répondre")');
    assert.ok(repondre, 'le bouton « Répondre » doit être présent');
    await repondre.click();
    assert.equal(await page.evaluate(() => window.__xss), undefined, 'le onclick « Répondre » a exécuté du code injecté');
    assert.deepEqual(await page.$$eval('[data-pirate], img[src="x"]', (els) => els.length), 0);
    assert.deepEqual(erreurs, []);

    // Aller-retour exact d'une valeur hostile dans un vrai onclick.
    const valeurs = ["l'église", 'a"b<c>&d', 'x\\\');alert(1)//', 'ligne\nsuivante', '&#39;', 'é '];
    const recues = await page.evaluate((vals) => {
      const sortie = [];
      window.__capte = (v) => sortie.push(v);
      for (const v of vals) {
        const div = document.createElement('div');
        div.innerHTML = '<button onclick="window.__capte(\'' + jsArg(v) + '\')">x</button>';
        div.firstChild.click();
      }
      return sortie;
    }, valeurs);
    assert.deepEqual(recues, valeurs);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    await contexte.close();
  });
  // Tour de tous les écrans et panneaux : aucune erreur JavaScript, aucun
  // écran « Une erreur est survenue ». Fait pour un membre et pour l'Admin
  // (qui voit davantage de panneaux).
  for (const role of ['MEMBRE', 'GRAND_RESPONSABLE']) {
    await cas('tous les écrans s\'affichent sans erreur (' + role + ')', async () => {
      const session = {
        access_token: jetonFactice(MOI), refresh_token: 'r', token_type: 'bearer',
        expires_in: 3600, expires_at: Math.floor(maintenant / 1000) + 3600,
        user: { id: MOI, aud: 'authenticated', email: 'awa@commit.aev', app_metadata: { role }, user_metadata: {} },
      };
      const { page, erreurs, contexte } = await nouvellePage(nav, base, session);
      await page.waitForSelector('#post-p_piege', { timeout: 15000 });
      const etapes = [
        "App.tab('planning')", "App.tab('debrief')", "App.tab('profile')", "App.tab('home')",
        'App.openNotifications()', 'App.closeNotifications()',
        'App.openCreate()', 'App.closeCreate && App.closeCreate()',
        'App.openSettings()', 'App.closeSettings()',
        'App.openEditProfile()', 'App.closeEditProfile && App.closeEditProfile()',
        'App.openMembersList()', 'App.closeMembersList()',
        "App.openUserProfile('" + AUTRE + "')", "App.tab('home')",
      ];
      if (role === 'GRAND_RESPONSABLE') {
        etapes.push('App.openCreateEvent()', 'App.closeCreateEvent && App.closeCreateEvent()',
                    'App.openRolesPanel()', 'App.closeRolesPanel && App.closeRolesPanel()',
                    'App.openStorageStats()', 'App.closeStorageStats()');
      }
      for (const code of etapes) {
        await page.evaluate(code);
        await page.waitForTimeout(150);
        const plante = await page.$('text=Une erreur est survenue');
        assert.equal(plante, null, 'écran d\'erreur après ' + code);
      }
      assert.deepEqual(erreurs, []);
      assert.equal(await page.evaluate(() => window.__xss), undefined);
      await contexte.close();
    });
  }
} finally {
  await nav.close();
  serveur.close();
}

if (echecs) { console.error(echecs + ' test(s) de bout en bout en échec.'); process.exit(1); }
console.log('Tests de bout en bout : tout est passé.');
