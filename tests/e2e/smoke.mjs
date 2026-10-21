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
    await page.click('text=Mes indisponibilités');
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
      ];
      if (role === 'GRAND_RESPONSABLE') {
        etapes.push('App.openCreateEvent()', 'App.closeCreateEvent && App.closeCreateEvent()',
                    'App.openRolesPanel()', 'App.closeRolesPanel && App.closeRolesPanel()',
                    'App.openStorageStats()', 'App.closeStorageStats()',
                    'App.ouvrirTableauDeBord()', 'App.fermerTableauDeBord()');
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
