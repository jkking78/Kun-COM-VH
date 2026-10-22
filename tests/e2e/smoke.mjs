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

// Les scénarios existants supposent la visite guidée déjà vue ; le scénario
// « nouveau membre » la remet à zéro.
let VISITE_VUE = true;
// Le scénario « compte en attente » passe la fiche de MOI à non validée.
let APPROUVE = true;
const ATTENTE = 'cccccccc-0000-4000-8000-000000000003';
const profils = [
  { id: MOI, content: { id: MOI, prenom: 'Awa', nom: 'Test', role: 'MEMBRE', sections: [], notifications: [], get visiteVue() { return VISITE_VUE; }, get approuve() { return APPROUVE; } } },
  { id: ATTENTE, content: { id: ATTENTE, prenom: 'Nouveau', nom: 'Venu', role: 'MEMBRE', sections: ['cadrage'], phone: '07 00 00 00 00', approuve: false } },
  { id: AUTRE, content: {
    id: AUTRE, prenom: "O'Brien " + PIEGE_HTML, nom: 'X', role: 'MEMBRE', sections: [],
    avatar_color: 'red;" onmouseover="window.__xss=\'couleur\'" data-pirate="',
  } },
];
const demain = new Date(maintenant + 864e5).toISOString().split('T')[0];
const publications = [
  { id: 'ev_mission', created_at: new Date(maintenant - 1000).toISOString(), content: {
    id: 'ev_mission', userId: AUTRE, author: 'O', type: 'EVENT', eventTitle: 'Culte du dimanche', eventDate: demain,
    eventStart: '09:00', eventEnd: '12:00', eventLocation: 'Temple central', eventSections: ['cadrage'],
    assignments: [{ userId: MOI, task: 'Caméra 2', sectionId: 'cadrage' }], timestamp: maintenant - 1000, likedBy: [], comments: [], mediaUrls: [] } },
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

// Messages privés servis par le faux serveur (le scénario « sécurité » en ajoute).
let MESSAGES = [];

// Lieux enregistrés (migration 11) et appels de mémorisation reçus.
const LIEUX = [
  { id: '11111111-0000-4000-8000-000000000001', nom: "Église Vase d'Honneur", adresse: '', lat: 5.3712, lng: -3.9871, precision_m: 9, utilisations: 12 },
  { id: '11111111-0000-4000-8000-000000000002', nom: 'Salle ' + PIEGE_HTML, adresse: 'Cocody', lat: 5.36, lng: -3.99, precision_m: null, utilisations: 3 },
];
const LIEUX_MEMORISES = [];

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
    const unique = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    if (url.pathname.startsWith('/rest/v1/kun_com_posts')) return json(publications);
    if (url.pathname.startsWith('/rest/v1/kun_com_profiles')) {
      if (!unique) return json(profils);
      const p = profils.find((x) => 'eq.' + x.id === url.searchParams.get('id'));
      return p ? json(p) : json({ message: 'introuvable' }, 406);
    }
    if (url.pathname.startsWith('/rest/v1/kun_com_dms')) return json(MESSAGES);
    if (url.pathname.startsWith('/rest/v1/kun_com_lieux')) return json(LIEUX);
    if (url.pathname.startsWith('/rest/v1/rpc/kc_memoriser_lieu')) {
      LIEUX_MEMORISES.push(JSON.parse(route.request().postData() || '{}'));
      return json('22222222-0000-4000-8000-000000000009');
    }
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

  await cas('accessibilité : tout élément cliquable est atteignable et activable au clavier', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, null);
    await page.waitForSelector('#loginSubmitBtn', { timeout: 15000 });
    const oublie = page.locator('[role="button"]', { hasText: 'Mot de passe oublié' }).first();
    assert.equal(await oublie.getAttribute('tabindex'), '0');
    await oublie.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => S.auth === 'forgot');
    const muets = await page.$$eval('[onclick]', (els) => els.filter((el) =>
      !/^(BUTTON|A|INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName) && el.getAttribute('tabindex') === null
      && !/position:\s*fixed/.test(el.getAttribute('style') || '') && !/^\s*event\.stopPropagation/.test(el.getAttribute('onclick'))).length);
    assert.equal(muets, 0, 'des éléments cliquables restent inaccessibles au clavier');
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('les conditions d\'utilisation s\'ouvrent depuis l\'inscription', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, null);
    await page.waitForSelector('#loginSubmitBtn', { timeout: 15000 });
    await page.evaluate("App.nav('signup')");
    assert.ok(await page.$('#signupConditions'), 'la case d\'acceptation doit être présente');
    await page.click('text=conditions d\'utilisation');
    await page.waitForSelector('#_kcConditions');
    const texteConditions = await page.textContent('#_kcConditions');
    assert.ok(texteConditions.includes('Droit à l\'image') && texteConditions.includes('07 99 44 24 02'));
    await page.click('#_kcConditions [data-fermer]');
    assert.equal(await page.$('#_kcConditions'), null, 'la fenêtre doit se fermer');
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
  await cas('sécurité : profil, mentions, heures, expéditeur et fusion ne laissent rien passer', async () => {
    const session = {
      access_token: jetonFactice(MOI), refresh_token: 'r', token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(maintenant / 1000) + 3600,
      user: { id: MOI, aud: 'authenticated', email: 'awa@commit.aev', app_metadata: { role: 'MEMBRE' }, user_metadata: {} },
    };
    // Événement à l'heure piégée et faux expéditeur, pour ce scénario seulement.
    publications.push({ id: 'ev_piege', created_at: new Date(maintenant - 500).toISOString(), content: {
      id: 'ev_piege', userId: AUTRE, author: 'O', type: 'EVENT', eventTitle: 'Piège', eventDate: demain,
      eventStart: '<img src=x onerror="window.__xss=\'heure\'">', eventEnd: '12:00', eventSections: ['cadrage'],
      assignments: [{ userId: MOI, task: 'Caméra', sectionId: 'cadrage' }], timestamp: maintenant - 500, likedBy: [], comments: [], mediaUrls: [] } });
    MESSAGES = [{ id: 'dm_faux', from_id: AUTRE, to_id: MOI, sent_at: new Date(maintenant).toISOString(),
      content: { id: 'dm_faux', fromId: 'dddddddd-0000-4000-8000-000000000004', toId: MOI, text: 'Je suis l\'Admin', timestamp: maintenant } }];
    try {
      const { page, erreurs, contexte } = await nouvellePage(nav, base, session);
      await page.waitForSelector('#post-p_piege', { timeout: 15000 });

      // S3 : l'heure piégée est écartée à la réception, sur le fil comme au planning.
      await page.evaluate(() => App.tab('planning'));
      await page.waitForTimeout(300);
      const evenement = await page.evaluate(() => db(SK.POSTS, []).find((p) => p.id === 'ev_piege'));
      assert.equal(evenement.eventStart, '', 'une heure au format inattendu doit être écartée');
      const filtre = await page.evaluate(() => {
        const p = parsePostItem({ id: 'e', content: { id: 'e', eventStart: '09:00', eventEnd: '<b>', eventDate: '2026-1-1"' } });
        return [p.eventStart, p.eventEnd, p.eventDate];
      });
      assert.deepEqual(filtre, ['09:00', '', null]);

      // S1 : ouvrir le profil d'un membre à la couleur piégée.
      await page.evaluate((id) => App.openUserProfile(id), AUTRE);
      await page.waitForTimeout(600);
      const couleur = await page.evaluate((id) => db(SK.USERS, []).find((u) => u.id === id).avatar_color, AUTRE);
      assert.equal(couleur, '#0B5FE0', 'la fiche relue doit être assainie avant d\'entrer dans le cache');
      await page.evaluate(() => document.querySelectorAll('*').forEach((el) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))));

      // S2 : suggestions de mention avec un nom piégé (apostrophe + HTML).
      const recues = await page.evaluate(() => {
        const sortie = [];
        App.__capteMention = (v) => sortie.push(v);
        const div = document.createElement('div');
        div.innerHTML = App.buildMentionSuggestions('o', '__capteMention');
        document.body.appendChild(div);
        div.querySelectorAll('button').forEach((b) => b.click());
        div.remove();
        return sortie;
      });
      assert.ok(recues.includes('@O\'Brien ' + PIEGE_HTML + 'X '), 'la mention doit insérer le nom exact : ' + JSON.stringify(recues));

      // S6 : l'expéditeur affiché est celui de la colonne, pas celui du JSON.
      await page.evaluate(() => App._chargerMessages());
      const message = await page.evaluate(() => db(SK.DMS, []).find((m) => m.id === 'dm_faux'));
      assert.equal(message.fromId, AUTRE, 'l\'expéditeur doit venir de la colonne from_id');

      // C1 : le serveur fait foi, sauf écriture locale en attente.
      const fusion = await page.evaluate(() => {
        const distant = [{ id: 'm1', content: { id: 'm1', type: 'EVENT', eventStart: '08:00', likedBy: [], timestamp: 1 } }];
        const local = [{ id: 'm1', type: 'EVENT', eventStart: '09:00', likedBy: ['x'], viewedBy: ['v'], timestamp: 1 }];
        const a = mergePostsWithLocal(distant, false, local).find((p) => p.id === 'm1');
        localStorage.setItem('kc_pending_writes', JSON.stringify([{ table: 'kun_com_posts', row: { id: 'm1' } }]));
        const b = mergePostsWithLocal(distant, false, local).find((p) => p.id === 'm1');
        localStorage.setItem('kc_pending_writes', '[]');
        return { serveur: [a.eventStart, a.likedBy.length, a.viewedBy.join()], enAttente: b.eventStart };
      });
      assert.deepEqual(fusion.serveur, ['08:00', 0, 'v'], 'la version du serveur doit l\'emporter (vues locales gardées)');
      assert.equal(fusion.enAttente, '09:00', 'une écriture locale en attente doit être gardée');

      assert.equal(await page.evaluate(() => window.__xss), undefined, 'un script injecté s\'est exécuté');
      assert.deepEqual(await page.$$eval('[data-pirate], img[src="x"]', (els) => els.length), 0);
      assert.deepEqual(erreurs, []);
      await contexte.close();
    } finally {
      publications.pop();
      MESSAGES = [];
    }
  });

  await cas('lot 1 : navigation, cloche, mission, Bien démarrer, publier simple', async () => {
    const session = {
      access_token: jetonFactice(MOI), refresh_token: 'r', token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(maintenant / 1000) + 3600,
      user: { id: MOI, aud: 'authenticated', email: 'awa@commit.aev', app_metadata: { role: 'MEMBRE' }, user_metadata: {} },
    };
    const { page, erreurs, contexte } = await nouvellePage(nav, base, session);
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    // Barre du bas : un libellé lisible par onglet.
    const libelles = await page.$$eval('nav[aria-label="Navigation principale"] button', (bs) => bs.map((b) => b.textContent.trim()));
    assert.deepEqual(libelles, ['Accueil', 'Planning', 'Publier', 'Bilans', 'Profil']);
    // Cloche dans l'en-tête de chaque onglet, plus de bouton flottant.
    for (const onglet of ['home', 'planning', 'debrief', 'profile']) {
      await page.evaluate((o) => App.tab(o), onglet);
      await page.waitForTimeout(150);
      assert.ok(await page.$('#notifCloche'), 'cloche absente sur ' + onglet);
    }
    assert.equal(await page.$('#notifFab'), null);
    await page.evaluate("App.tab('home')");
    // Ma prochaine mission : l'événement de demain, avec la tâche.
    const mission = await page.textContent('section[aria-label="Ma prochaine mission"]');
    assert.ok(mission.includes('Culte du dimanche') && mission.includes('Caméra 2') && mission.includes('Demain'), mission);
    // Bien démarrer : la visite est déjà vue (1 étape cochée sur 6).
    const bd = await page.textContent('section[aria-label="Bien démarrer"]');
    assert.ok(bd.includes('1/6'), bd);
    // Publier : options repliées puis dépliées.
    await page.evaluate('App.openCreate()');
    await page.waitForTimeout(200);
    assert.equal(await page.$eval('.kc-options', (e) => getComputedStyle(e).display), 'none');
    await page.click('text=Plus d\'options');
    await page.waitForTimeout(200);
    assert.equal(await page.$eval('.kc-options', (e) => getComputedStyle(e).display), 'block');
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('lot 1 : visite guidée proposée à un nouveau membre', async () => {
    VISITE_VUE = false;
    const session = {
      access_token: jetonFactice(MOI), refresh_token: 'r', token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(maintenant / 1000) + 3600,
      user: { id: MOI, aud: 'authenticated', email: 'awa@commit.aev', app_metadata: { role: 'MEMBRE' }, user_metadata: {} },
    };
    try {
      const { page, erreurs, contexte } = await nouvellePage(nav, base, session);
      await page.waitForSelector('#_kcVisite', { timeout: 15000 });
      for (let i = 0; i < 3; i++) await page.click('#_kcVisite [data-suivant]');
      assert.equal((await page.textContent('#_kcVisite [data-suivant]')).trim(), 'C\'est parti');
      await page.click('#_kcVisite [data-suivant]');
      assert.equal(await page.$('#_kcVisite'), null);
      assert.equal(await page.evaluate(() => S.user.visiteVue), true);
      assert.deepEqual(erreurs, []);
      await contexte.close();
    } finally { VISITE_VUE = true; }
  });

  const sessionPour = (role) => ({
    access_token: jetonFactice(MOI), refresh_token: 'r', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(maintenant / 1000) + 3600,
    user: { id: MOI, aud: 'authenticated', email: 'awa@commit.aev', app_metadata: { role }, user_metadata: {} },
  });

  await cas('lot 2 : convocation, indisponibilités, pointage, badges', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('MEMBRE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    // Réponse à la convocation depuis la carte « Ma prochaine mission ».
    const mission = 'section[aria-label="Ma prochaine mission"]';
    assert.ok((await page.textContent(mission)).includes('Tu confirmes'));
    await page.click(mission + ' >> text=Je ne peux pas');
    await page.fill('#motifDecline', 'Voyage');
    await page.click(mission + ' >> text=Envoyer');
    const reponse = await page.evaluate((id) => db(SK.POSTS, []).find((p) => p.id === 'ev_mission').reponsesConvocation[id], MOI);
    assert.equal(reponse.statut, 'decline');
    assert.equal(reponse.motif, 'Voyage');
    assert.ok((await page.textContent(mission)).includes('Indisponible'));
    // Indisponibilités : ajout d'une date depuis le Planning.
    await page.evaluate("App.tab('planning')");
    await page.click('[aria-label^="Mes indisponibilités"]');
    await page.fill('#indispoDate', demain);
    await page.fill('#indispoMotif', 'Examen');
    await page.click('text=Ajouter cette date');
    assert.deepEqual(await page.evaluate(() => S.user.indisponibilites.map((i) => i.date)), [demain]);
    await page.evaluate('App.fermerIndispos()');
    // Célébration du pointage (le pointage réel dépend de la géolocalisation).
    await page.evaluate("celebrerPointage(3, 'À l\\'heure')");
    await page.waitForSelector('#_kcPointage');
    assert.ok((await page.textContent('#_kcPointage')).includes('+3'));
    // Profil : badges ; Bilans : rien à signaler pour un membre sans pôle.
    await page.evaluate("App.tab('profile')");
    assert.ok((await page.textContent('#badges')).includes('0 / 6'));
    await page.evaluate("App.tab('debrief')");
    assert.equal(await page.$('#monPole'), null);
    // Un membre ne voit pas les demandes d'inscription, et ne peut pas
    // assigner une personne en attente.
    await page.evaluate("App.tab('home')");
    assert.equal(await page.$('#demandesInscription'), null);
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('lot 2 : un compte en attente ne voit que l\'écran d\'attente', async () => {
    APPROUVE = false;
    try {
      const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('MEMBRE'));
      await page.waitForSelector('#attenteValidation', { timeout: 15000 });
      assert.equal(await page.$('#post-p_piege'), null);
      assert.equal(await page.$('nav[aria-label="Navigation principale"]'), null);
      assert.deepEqual(erreurs, []);
      await contexte.close();
    } finally { APPROUVE = true; }
  });

  await cas('lot 2 : l\'Admin voit les demandes d\'inscription', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('GRAND_RESPONSABLE'));
    await page.waitForSelector('#demandesInscription', { timeout: 15000 });
    const texte = await page.textContent('#demandesInscription');
    assert.ok(texte.includes('Nouveau Venu') && texte.includes('Valider') && texte.includes('Refuser'), texte);
    // La personne en attente n'est pas proposée à l'assignation.
    const assignables = await page.evaluate(() => assignableMembers(S.user).map((m) => m.id));
    assert.ok(!assignables.includes('cccccccc-0000-4000-8000-000000000003'));
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('lot 3 : messages, canal de pôle, réglages de notifications, échange', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('MEMBRE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    // Un message privé non lu allume la boîte de réception.
    await page.evaluate(([autre, moi]) => {
      dbSet(SK.DMS, [{ id: 'dm1', fromId: autre, toId: moi, text: 'Salut', timestamp: Date.now() }]);
      S.user.sections = ['cadrage'];
      render();
    }, [AUTRE, MOI]);
    assert.ok((await page.getAttribute('#boiteMessages', 'aria-label')).includes('1 non lu'));
    await page.click('#boiteMessages');
    const boite = await page.textContent('body');
    assert.ok(boite.includes('Canal Cadrage') && boite.includes('Salut'), 'la boîte liste le canal et la conversation');
    // Canal du pôle : envoi d'un message.
    await page.evaluate("App.openDirectMessage('pole:cadrage')");
    await page.fill('#dmInput', 'Batteries chargées ?');
    await page.press('#dmInput', 'Enter');
    assert.ok((await page.textContent('#dmMessagesList')).includes('Batteries chargées ?'));
    assert.equal(await page.evaluate(() => db(SK.DMS, []).filter((m) => m.toId === 'pole:cadrage').length), 1);
    await page.evaluate('App.closeDirectMessage(); App.fermerBoite()');
    // Un canal d'un autre pôle est refusé.
    await page.evaluate("App.openDirectMessage('pole:photo')");
    assert.equal(await page.evaluate(() => S.dmOpen), false);
    // Paramètres : préférences de notifications.
    await page.evaluate('App.openSettings()');
    const reglages = await page.textContent('body');
    assert.ok(reglages.includes('Rappels de service') && reglages.includes('Toujours envoyées'));
    await page.click('text=J\'aime');
    assert.equal(await page.evaluate(() => S.user.preferencesNotif.jaime), true);
    await page.evaluate('App.closeSettings()');
    // Échange de service : le convoqué propose sa place, puis la retire.
    await page.evaluate("App.tab('planning')");
    await page.click('text=Proposer ma place');
    assert.ok(await page.evaluate((id) => !!db(SK.POSTS, []).find((p) => p.id === 'ev_mission').echanges[id], MOI));
    assert.ok((await page.textContent('body')).includes('Ta place est proposée'));
    await page.click('text=Retirer ma proposition');
    assert.ok(await page.evaluate((id) => !db(SK.POSTS, []).find((p) => p.id === 'ev_mission').echanges[id], MOI));
    // Toucher une notification « planning » ouvre le Planning.
    await page.evaluate("App.tab('home'); App.ouvrirCible('planning')");
    assert.equal(await page.evaluate(() => S.tab), 'planning');
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('lot 3 : tableau de bord et validation d\'un échange (Admin)', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('GRAND_RESPONSABLE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    await page.evaluate('App.ouvrirTableauDeBord()');
    const tdb = await page.textContent('#tableauDeBord');
    assert.ok(tdb.includes('Services des 15 prochains jours') && tdb.includes('Culte du dimanche'), tdb);
    assert.ok(tdb.includes('Convocations sans réponse') && tdb.includes('Awa Test'), tdb);
    await page.click('#tableauDeBord >> text=Relancer');
    await page.evaluate('App.fermerTableauDeBord()');
    // Un échange proposé et repris : l'organisateur le valide d'un geste.
    await page.evaluate(([moi, autre]) => {
      const posts = db(SK.POSTS, []);
      const ev = posts.find((p) => p.id === 'ev_mission');
      ev.echanges = { [moi]: { tache: 'Caméra 2' } };
      ev.reprises = { [autre]: { pour: moi } };
      dbSet(SK.POSTS, posts);
      App.tab('planning');
    }, [MOI, AUTRE]);
    await page.click('text=Valider l\'échange');
    assert.equal(await page.evaluate(() => db(SK.POSTS, []).find((p) => p.id === 'ev_mission').assignments[0].userId), AUTRE);
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('lieux enregistrés et plan de préparation par pôle', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('RESP_SECTION'));
    await contexte.grantPermissions(['geolocation']);
    await contexte.setGeolocation({ latitude: 5.37125, longitude: -3.98705, accuracy: 11 });
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    // C2 : la fusion par différence garde le travail d'un autre responsable.
    const fusion = await page.evaluate(() => fusionnerAssignations(
      [{ userId: 'b', task: 'Caméra' }, { userId: 'd', task: 'Console' }, { userId: 'e', task: 'Micros' }],
      [{ userId: 'b', task: 'Caméra' }, { userId: 'd', task: 'Console' }],
      [{ userId: 'c', task: 'Caméra 2' }, { userId: 'd', task: 'Console' }]).map((a) => a.userId).join(','));
    assert.equal(fusion, 'd,e,c');
    // Recherche dans les lieux : « l'église » trouve « Église Vase d'Honneur ».
    const trouves = await page.evaluate(() => lieuxCorrespondants("l'église", db(SK.LIEUX, []).length ? db(SK.LIEUX, []) : [
      { id: 'a', nom: "Église Vase d'Honneur", lat: 5, lng: -4, utilisations: 1 }, { id: 'b', nom: 'Salle polyvalente', lat: 5, lng: -4, utilisations: 9 }]).map((l) => l.nom));
    assert.deepEqual(trouves, ["Église Vase d'Honneur"]);
    // Plan piégé reçu du serveur : pôle inconnu et date invalide écartés, titres affichés comme du texte.
    await page.evaluate(([piege]) => {
      S.user.sections = ['cadrage'];
      const posts = db(SK.POSTS, []);
      const ev = posts.find((p) => p.id === 'ev_mission');
      ev.preparation = assainirPreparation({
        cadrage: { v: 1, taches: [{ id: 't1', titre: 'Tâche ' + piege, etapes: [{ id: 'e1', titre: 'Étape ' + piege, date: '2026-01-01");alert(1)//', fait: false }] }] },
        regie: { v: 2, taches: [{ id: 't2', titre: 'Sonorisation', etapes: [{ id: 'e2', titre: 'Tester la console', date: '2020-01-01', fait: false }] }] },
        pirate: { v: 1, taches: [{ id: 't3', titre: 'Intrus', etapes: [] }] },
      });
      dbSet(SK.POSTS, posts);
      App.tab('planning');
    }, [PIEGE_HTML]);
    assert.ok((await page.textContent('body')).includes('Préparation · 0/2'), 'le lien Préparation résume l\'avancement');
    await page.click('text=Préparation · 0/2');
    const plan = await page.textContent('#preparation');
    assert.ok(plan.includes('Tâche <img src=x') && plan.includes('Sans date') && !plan.includes('Intrus'), plan);
    assert.ok(plan.includes('1 en retard'), 'l\'étape passée de la régie est en retard');
    assert.equal(await page.$('#preparation img[src="x"]'), null);
    // Le responsable du cadrage ajoute une tâche et une étape, puis la coche ;
    // il ne peut pas toucher au plan de la régie.
    await page.click('#preparation section[aria-label="Pôle Cadrage"] >> text=Ajouter une tâche');
    await page.fill('#prepTitre', 'Communication');
    await page.press('#prepTitre', 'Enter');
    await page.fill('#prepTitre', 'Affiches imprimées');
    await page.press('#prepTitre', 'Enter');
    await page.click('#prepFormulaire >> text=Terminé');
    await page.click('[aria-label="Marquer comme faite : Affiches imprimées"]');
    const cadrage = await page.evaluate(() => db(SK.POSTS, []).find((p) => p.id === 'ev_mission').preparation.cadrage);
    assert.equal(cadrage.taches[1].titre, 'Communication');
    assert.equal(cadrage.taches[1].etapes[0].fait, true);
    assert.ok(cadrage.v >= 2 && cadrage.maj_par === MOI);
    assert.equal(await page.$$eval('#preparation section[aria-label="Pôle Régie"] button[aria-pressed]', (b) => b.length), 0);
    assert.equal(await page.$('#preparation section[aria-label="Pôle Régie"] >> text=Ajouter une tâche'), null);
    await page.evaluate("App.prepChoisirVue('dates')");
    assert.ok((await page.textContent('#preparation')).includes('En retard'));
    await page.evaluate('App.fermerPreparation()');
    // Formulaire d'événement : lieux enregistrés proposés, position relevée sur place.
    await page.evaluate('App.openCreateEvent()');
    await page.waitForFunction(() => db(SK.LIEUX, []).length === 2);
    await page.evaluate('render()');
    assert.ok((await page.textContent('#eventLieuxProposes')).includes("Église Vase d'Honneur"));
    assert.equal(await page.$('#eventLieuxProposes img[src="x"]'), null);
    await page.fill('#eventLocation', "l'eglise");
    await page.evaluate("App.onEventLocationInput(\"l'eglise\")");
    await page.click("#eventLieuxProposes >> text=Église Vase d'Honneur");
    assert.equal(await page.evaluate(() => S.createEventData.lat), 5.3712);
    await page.click('text=Changer');
    await page.fill('#eventLocation', 'Grande salle');
    await page.click('text=Utiliser ma position actuelle');
    await page.waitForFunction(() => S.createEventData && S.createEventData.accuracy === 11, null, { timeout: 15000 });
    await page.fill('#eventTitle', 'Veillée');
    await page.evaluate('App.saveEvent(null)');
    await page.waitForFunction(() => !S.createEventOpen);
    const ev = await page.evaluate(() => db(SK.POSTS, []).find((p) => p.eventTitle === 'Veillée'));
    assert.equal(ev.eventPlaceName, 'Grande salle');
    assert.equal(ev.eventGeoAccuracy, 11);
    await page.waitForTimeout(300);
    assert.deepEqual(LIEUX_MEMORISES.at(-1), { p_nom: 'Grande salle', p_adresse: '', p_lat: 5.37125, p_lng: -3.98705, p_precision: 11 });
    assert.deepEqual(erreurs, []);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    await contexte.close();
  });

  await cas('lot D3 : Échap, liens à paramètres, fil par tranches, déconnexion propre', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('MEMBRE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    // A3 : les Paramètres sont un dialogue, Échap les ferme.
    await page.evaluate('App.openSettings()');
    assert.ok(await page.$('[role="dialog"][aria-modal="true"]'), 'la fenêtre est annoncée comme dialogue');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => !!S.settingsOpen), false, 'Échap ferme la fenêtre');
    // C11 : un lien à paramètres n'est échappé qu'une fois.
    const lien = await page.evaluate(() => hashtagify('voir https://exemple.ci/page?a=1&b=2'));
    assert.ok(lien.includes('href="https://exemple.ci/page?a=1&amp;b=2"') && !lien.includes('&amp;amp;'), lien);
    // P5 : le fil ne dessine que 25 cartes, puis « Afficher plus ».
    const nb = await page.evaluate(() => {
      const posts = db(SK.POSTS, []);
      for (let i = 0; i < 40; i++) posts.push({ id: 'pp' + i, userId: 'x', author: 'X', caption: 'Publication ' + i, timestamp: Date.now() - 1e6 - i, likedBy: [], comments: [], mediaUrls: [] });
      dbSet(SK.POSTS, posts); S.filLimite = 25; render();
      return document.querySelectorAll('article[id^="post-"]').length;
    });
    assert.ok(nb <= 26, 'au plus 25 cartes (+ épinglée éventuelle) : ' + nb);
    await page.click('text=/Afficher plus/');
    assert.ok((await page.$$('article[id^="post-"]')).length > nb);
    // S15 : la déconnexion efface les données du compte sur l'appareil.
    await page.evaluate(() => { dbSet(SK.DMS, [{ id: 'd1', fromId: 'a', toId: 'b', text: 'secret', timestamp: 1 }]); localStorage.setItem('kc_pending_writes', '[{"x":1}]'); });
    await page.evaluate('App.logout()');
    await page.waitForSelector('#loginSubmitBtn', { timeout: 15000 });
    const restes = await page.evaluate(() => [localStorage.getItem('kc_dms'), localStorage.getItem('kc_pending_writes'), localStorage.getItem('kc_profiles')]);
    assert.deepEqual(restes, [null, null, null]);
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('fil des pôles : une publication taguée apparaît dans chaque pôle, tendances dans « Tous » seulement', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('GRAND_RESPONSABLE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    const vu = (pole) => page.evaluate((pole) => {
      const posts = db(SK.POSTS, []);
      if (!posts.some((p) => p.id === 'p_tag')) {
        const base = { userId: 'x', author: 'X', sectionId: 'web', likedBy: [], comments: [], mediaUrls: [], hashtags: ['#Culte'] };
        posts.push(Object.assign({ id: 'p_tag', caption: 'Tag #Culte', timestamp: Date.now() - 5e6, visibility: 'sections', targetSections: ['cadrage', 'photo'] }, base));
        posts.push(Object.assign({ id: 'p_web', caption: 'Web #Culte', timestamp: Date.now() - 6e6, visibility: 'all', targetSections: ['regie'] }, base));
        dbSet(SK.POSTS, posts);
      }
      App.story(pole);
      return ['p_tag', 'p_web'].filter((id) => document.getElementById('post-' + id));
    }, pole);
    assert.deepEqual(await vu('cadrage'), ['p_tag'], 'tagué Cadrage');
    assert.deepEqual(await vu('photo'), ['p_tag'], 'tagué aussi Photo');
    assert.deepEqual(await vu('web'), ['p_tag', 'p_web'], 'pôle de l\'auteur');
    assert.deepEqual(await vu('regie'), [], 'un tag resté sous « Tout le monde » ne compte pas');
    assert.equal(await page.evaluate(() => document.body.textContent.includes('Tendances')), false, 'pas de tendances dans un pôle');
    await vu('all');
    assert.ok(await page.evaluate(() => trendingTags().length > 0 && document.body.textContent.includes('Tendances')), 'tendances dans « Tous »');
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('guide d\'utilisation : depuis le profil, rubriques repliées, Échap ferme', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('MEMBRE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    await page.evaluate('App.tab(\'profile\')');
    await page.click('text=Guide d\'utilisation');
    await page.waitForSelector('#_kcGuide[role="dialog"]');
    const etat = await page.evaluate(() => ({
      rubriques: document.querySelectorAll('#_kcGuide details').length,
      ouvertes: document.querySelectorAll('#_kcGuide details[open]').length,
    }));
    assert.ok(etat.rubriques >= 12, 'rubriques : ' + etat.rubriques);
    assert.equal(etat.ouvertes, 0);
    await page.click('#_kcGuide summary >> text=Pointer ton arrivée');
    assert.ok(await page.isVisible('#_kcGuide >> text=moins de 500 m'));
    await page.keyboard.press('Escape');
    assert.equal(await page.$('#_kcGuide'), null);
    // Les conditions s'ouvrent toujours, sans note sur 30.
    await page.click('text=Conditions d\'utilisation');
    assert.equal(await page.evaluate(() => document.getElementById('_kcConditions').textContent.includes('30 points')), false);
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('événement : la saisie survit aux rafraîchissements, le membre choisi est assigné et visible au Planning', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('GRAND_RESPONSABLE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    await page.evaluate('App.tab(\'planning\')');
    await page.evaluate('App.openCreateEvent()');
    await page.waitForSelector('#eventTitle');
    await page.fill('#eventTitle', '2e Culte');
    await page.fill('#eventDesc', 'Briefing à 6 h 30');
    // Rafraîchissement d'arrière-plan (sondage du fil, temps réel…).
    await page.evaluate(() => render());
    assert.equal(await page.inputValue('#eventTitle'), '2e Culte', 'le titre tapé reste');
    assert.equal(await page.inputValue('#eventDesc'), 'Briefing à 6 h 30');
    // Une valeur changée par l'application elle-même s'applique toujours.
    await page.evaluate(() => { App.syncCreateEventData(); S.createEventData.title = 'Titre imposé'; render(); });
    assert.equal(await page.inputValue('#eventTitle'), 'Titre imposé');
    await page.fill('#eventTitle', '2e Culte');
    await page.fill('#eventDate', ''); await page.type('#eventDate', '12312030');
    await page.evaluate(() => { document.getElementById('eventDate').value = '2030-12-31'; });
    await page.fill('#eventStart', '09:30');
    const membre = await page.evaluate(() => [...document.querySelectorAll('#assignUserSelect option')].map((o) => o.value).find((v) => v && v.indexOf('sec:') !== 0));
    await page.selectOption('#assignUserSelect', membre);
    await page.fill('#assignTaskInput', 'Caméra 2');
    await page.evaluate(() => render());
    assert.equal(await page.inputValue('#assignUserSelect'), membre, 'le membre choisi reste sélectionné');
    // Enregistrer sans avoir touché « Ajouter ».
    await page.evaluate(() => App.saveEvent(null));
    await page.waitForFunction(() => !S.createEventOpen);
    const cree = await page.evaluate(() => db(SK.POSTS, []).find((p) => p.eventTitle === '2e Culte'));
    assert.equal(cree.assignments.length, 1);
    assert.equal(cree.assignments[0].userId, membre);
    assert.equal(cree.assignments[0].task, 'Caméra 2');
    await page.evaluate(() => { S.selectedDate = '2030-12-31'; S.planningMode = 'tous'; render(); });
    const carte = await page.evaluate(() => document.body.textContent);
    assert.ok(/De service \(1\)/.test(carte) && carte.includes('Caméra 2'), 'l\'équipe apparaît sur la carte du Planning');
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('série d\'événements : un seul carrousel dans le fil, statuts de présence, tout est cliquable', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('GRAND_RESPONSABLE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    await page.evaluate(({ autre, moi }) => {
      const posts = db(SK.POSTS, []);
      ['2030-03-03', '2030-03-10', '2030-03-17'].forEach((d, i) => posts.unshift({
        id: 'serie_' + i, type: 'EVENT', userId: moi, author: 'A', eventTitle: 'Culte en série', eventDate: d,
        eventStart: '07:00', eventEnd: '09:00', eventSections: ['regie'], recurrenceGroupId: 'serie_0',
        assignments: [{ userId: autre, userName: 'O', task: 'Son' }, { userId: moi, userName: 'Moi', task: 'Régie' }],
        reponsesConvocation: { [moi]: { statut: 'confirme' } },
        timestamp: Date.now() + 5000, likedBy: [], comments: [], mediaUrls: [] }));
      dbSet(SK.POSTS, posts);
      try { localStorage.removeItem('kc_glisse_vu'); } catch (e) {}
      App.tab('home');
    }, { autre: AUTRE, moi: MOI });
    await page.waitForSelector('[id^="evserie-"]');
    const etat = await page.evaluate(() => {
      const car = document.querySelector('[id^="evserie-"]');
      return {
        cartes: document.querySelectorAll('[id^="evserie-"]').length,
        volets: car.children.length,
        indice: !!document.querySelector('.kc-glisse-texte') && !!car.querySelector('.kc-glisse'),
        texte: car.textContent,
        seules: ['serie_0', 'serie_1', 'serie_2'].filter((id) => document.getElementById('post-' + id)).length,
      };
    });
    assert.equal(etat.cartes, 1, 'une seule carte pour la série');
    assert.equal(etat.volets, 3);
    assert.equal(etat.seules, 0, 'pas de carte séparée par date');
    assert.ok(etat.indice, 'indication « glisse » animée');
    assert.ok(etat.texte.includes('Confirmé') && etat.texte.includes('En attente'), 'statut de chaque assigné');
    // Glisser enregistre que l'indication a été comprise.
    await page.evaluate(() => { const car = document.querySelector('[id^="evserie-"]'); car.scrollLeft = car.children[1].offsetLeft; car.dispatchEvent(new Event('scroll')); });
    assert.equal(await page.evaluate(() => localStorage.getItem('kc_glisse_vu')), '1');
    // Le nom d'un assigné ouvre son profil, sans ouvrir l'événement.
    await page.evaluate(() => [...document.querySelectorAll('[id^="evserie-"] button')].find((b) => b.textContent.includes('O\'Brien')).click());
    assert.equal(await page.evaluate(() => S.viewUserProfileId), AUTRE);
    assert.equal(await page.evaluate(() => S.tab), 'home');
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('un convoqué qui touche la carte arrive sur « Je confirme » et peut répondre', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('MEMBRE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    // Beaucoup d'événements avant, pour que la carte soit loin dans la liste.
    await page.evaluate(() => {
      const posts = db(SK.POSTS, []);
      const d = new Date(Date.now() + 3600e3 * 2).toISOString().slice(0, 10);
      for (let i = 0; i < 8; i++) posts.push({ id: 'avant' + i, type: 'EVENT', userId: 'x', author: 'X', eventTitle: 'Réunion ' + i, eventDate: d, eventStart: '23:5' + i, timestamp: 1, likedBy: [], comments: [], mediaUrls: [] });
      dbSet(SK.POSTS, posts);
      S.planningFiltre = 'miens';
    });
    await page.click('#post-ev_mission >> text=Culte du dimanche');
    await page.waitForSelector('#reponse-ev_mission');
    await page.waitForTimeout(900);
    const vue = await page.evaluate(() => {
      const r = document.getElementById('reponse-ev_mission').getBoundingClientRect();
      return { tab: S.tab, visible: r.top >= 0 && r.bottom <= innerHeight, texte: document.getElementById('reponse-ev_mission').textContent };
    });
    assert.equal(vue.tab, 'planning');
    assert.ok(vue.visible, 'les boutons de réponse sont à l\'écran');
    assert.ok(vue.texte.includes('Je confirme'));
    await page.click('#reponse-ev_mission >> text=Je confirme');
    await page.waitForFunction(() => /Présence confirmée/.test(document.getElementById('reponse-ev_mission').textContent));
    // Un non-convoqué arrive sur la carte même depuis le filtre « Mes services ».
    await page.evaluate(() => { S.planningFiltre = 'miens'; App.goToEvent('avant3'); });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => [S.planningFiltre, !!document.getElementById('planev-avant3')].join()), 'tous,true');
    assert.deepEqual(erreurs, []);
    await contexte.close();
  });

  await cas('un membre consulte le plan de préparation sans pouvoir le modifier', async () => {
    const { page, erreurs, contexte } = await nouvellePage(nav, base, sessionPour('MEMBRE'));
    await page.waitForSelector('#post-p_piege', { timeout: 15000 });
    await page.evaluate(() => {
      const posts = db(SK.POSTS, []);
      posts.find((p) => p.id === 'ev_mission').preparation = { cadrage: { v: 1, taches: [{ id: 't1', titre: 'Caméras', etapes: [{ id: 'e1', titre: 'Charger les batteries', date: '', fait: false }] }] } };
      dbSet(SK.POSTS, posts);
      App.tab('planning');
    });
    await page.click('text=Préparation · 0/1');
    const plan = await page.textContent('#preparation');
    assert.ok(plan.includes('Caméras') && plan.includes('Charger les batteries'));
    assert.equal(await page.$('#preparation button[aria-pressed]'), null);
    assert.equal(await page.$('#preparation >> text=Ajouter une tâche'), null);
    assert.equal(await page.$('#preparation >> text=Ajouter une étape'), null);
    // L'action est refusée même appelée directement.
    await page.evaluate("App.prepBasculer('cadrage', 't1', 'e1')");
    assert.equal(await page.evaluate(() => db(SK.POSTS, []).find((p) => p.id === 'ev_mission').preparation.cadrage.taches[0].etapes[0].fait), false);
    // Toucher le rappel d'une étape ouvre le plan de l'événement.
    await page.evaluate("App.fermerPreparation(); App.tab('home'); App.ouvrirCible('prep:ev_mission')");
    assert.ok(await page.$('#preparation'), 'le rappel ouvre le plan');
    assert.equal(await page.evaluate(() => S.tab), 'planning');
    assert.deepEqual(erreurs, []);
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
        'App.ouvrirIndispos()', 'App.fermerIndispos()',
        'App.ouvrirBoite()', 'App.fermerBoite()',
        "App.tab('planning')", "App.ouvrirPreparation('ev_mission')", "App.prepChoisirVue('dates')", "App.prepChoisirVue('poles')", 'App.fermerPreparation()',
      ];
      if (role === 'GRAND_RESPONSABLE') {
        etapes.push('App.openCreateEvent()', 'App.closeCreateEvent && App.closeCreateEvent()',
                    'App.openRolesPanel()', 'App.closeRolesPanel && App.closeRolesPanel()',
                    'App.openStorageStats()', 'App.closeStorageStats()',
                    'App.ouvrirTableauDeBord()', 'App.fermerTableauDeBord()',
                    'App.ouvrirLieux()', 'App.fermerLieux()',
                    "App.ouvrirPreparation('ev_mission')", "App.prepAjouterPole('photo')", 'App.fermerPreparation()');
      }
      etapes.push('ouvrirVisite()', "document.querySelector('#_kcVisite [data-passer]').click()",
                  'ouvrirAideInstallation()', "document.querySelector('#_kcInstallation [data-fermer]').click()");
      etapes.push('App.openSettings()', 'ouvrirConditions()', "document.querySelector('#_kcConditions [data-fermer]').click()", 'App.closeSettings()');
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
