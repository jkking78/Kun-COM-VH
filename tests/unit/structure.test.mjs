// Vérifications rapides de la structure du projet (node --test tests/unit/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifier } from '../../scripts/version.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const lire = (p) => readFileSync(join(RACINE, p), 'utf8');

test('le numéro de version est le même partout (page, service worker, application)', () => {
  const { erreurs } = verifier();
  assert.deepEqual(erreurs, []);
});

test('chaque module JavaScript de l\'application se compile', () => {
  for (const f of readdirSync(join(RACINE, 'public/js'))) {
    assert.doesNotThrow(() => new Function(lire('public/js/' + f)), f);
  }
});

test('index.html charge tous les modules, dans l\'ordre, et rien depuis un CDN sans version fixe', () => {
  const html = lire('public/index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const modules = scripts.filter((s) => s.startsWith('js/')).map((s) => s.replace(/\?.*$/, ''));
  assert.deepEqual(modules, readdirSync(join(RACINE, 'public/js')).sort().map((f) => 'js/' + f));
  for (const s of scripts) {
    assert.ok(!/^https?:/.test(s), 'script externe : ' + s);
    assert.ok(existsSync(join(RACINE, 'public', s.replace(/\?.*$/, ''))), 'fichier manquant : ' + s);
  }
});

test('le service worker ne pré-charge que des fichiers qui existent', () => {
  const sw = lire('public/sw.js');
  const liste = sw.slice(sw.indexOf('const STATIC_ASSETS'), sw.indexOf('].concat('));
  for (const [, chemin] of liste.matchAll(/'\.\/([^']+)'/g)) {
    assert.ok(existsSync(join(RACINE, 'public', chemin)), chemin);
  }
});

test('le service worker pré-charge exactement les modules de public/js', () => {
  const sw = lire('public/sw.js');
  const liste = sw.slice(sw.indexOf('const JS_FILES'), sw.indexOf('];', sw.indexOf('const JS_FILES')));
  const declares = [...liste.matchAll(/'([\w-]+)'/g)].map((m) => m[1] + '.js');
  assert.deepEqual(declares, readdirSync(join(RACINE, 'public/js')).sort());
});

test('Vercel sert public/ (une seule copie du code)', () => {
  const conf = JSON.parse(lire('vercel.json'));
  assert.equal(conf.outputDirectory, 'public');
  assert.ok(!existsSync(join(RACINE, 'index.html')), 'une copie de index.html traîne à la racine');
  assert.ok(!existsSync(join(RACINE, 'js')), 'une copie de js/ traîne à la racine');
});

test('l\'ancienne adresse redirige vers commitcomaev.app, chemin et paramètres compris', () => {
  const conf = JSON.parse(lire('vercel.json'));
  const r = (conf.redirects || []).find((x) => (x.has || []).some((h) => h.type === 'host' && h.value === 'kun-com-vh.vercel.app'));
  assert.ok(r, 'redirection de l\'ancienne adresse');
  assert.equal(r.source, '/:chemin*');
  assert.equal(r.destination, 'https://commitcomaev.app/:chemin*');
  assert.equal(r.permanent, true);
});

test('aucun code d\'accès en clair dans le client', () => {
  for (const f of readdirSync(join(RACINE, 'public/js'))) {
    const src = lire('public/js/' + f);
    assert.ok(!/AZ7887|ADMIN78|RP787/i.test(src), f);
  }
});

test('les fonctions Vercel se chargent', async () => {
  for (const f of ['api/og.js', 'api/p.js', 'api/p-image.js']) {
    const mod = await import(join(RACINE, f));
    assert.equal(typeof (mod.default || mod), 'function', f);
  }
});

test('les questions de sécurité de l\'app et de la fonction de récupération sont les mêmes', () => {
  const app = lire('public/js/01e-bilans-outils.js');
  const fn = lire('migration/functions/password-recovery/index.ts');
  const extraire = (src, debut) => [...src.slice(src.indexOf(debut), src.indexOf('];', src.indexOf(debut))).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const n of [1, 2]) {
    const a = extraire(app, 'var SECURITY_QUESTIONS_' + n + ' = [');
    const f = extraire(fn, 'const QUESTIONS_' + n + ' = [');
    assert.equal(a.length, 3);
    assert.deepEqual(f, a);
  }
});

test('aperçu de liens : adresses internes et origines étrangères refusées', async () => {
  const og = await import(join(RACINE, 'api/og.js'));
  const { ipPrivee, origineAutorisee, isPublicHttpUrl } = (og.default || og)._interne;
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.4', '172.20.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) {
    assert.equal(ipPrivee(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '41.202.219.1', '2606:4700::1111']) assert.equal(ipPrivee(ip), false, ip);
  assert.equal(origineAutorisee('https://kun-com-vh.vercel.app'), true);
  assert.equal(origineAutorisee('https://commitcomaev.app'), true);
  assert.equal(origineAutorisee('https://www.commitcomaev.app'), true);
  assert.equal(origineAutorisee('https://commitcomaev.app.evil.com'), false);
  assert.equal(origineAutorisee(''), true);
  assert.equal(origineAutorisee('https://pirate.example'), false);
  assert.equal(isPublicHttpUrl('file:///etc/passwd'), null);
});

test('/api/p-image ne sert que des photos, jamais une image SVG', async () => {
  const mod = await import(join(RACINE, 'api/p-image.js'));
  const handler = mod.default || mod;
  const servir = async (image) => {
    const avant = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ image }) });
    const rep = { code: 0, entetes: {}, corps: null };
    const res = {
      setHeader(k, v) { rep.entetes[k.toLowerCase()] = v; },
      status(c) { rep.code = c; return this; },
      send(b) { rep.corps = b; return this; },
    };
    try { await handler({ query: { id: 'x' } }, res); } finally { globalThis.fetch = avant; }
    return rep;
  };
  const svg = await servir('data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64'));
  assert.equal(svg.code, 404);
  const jpeg = await servir('data:image/jpeg;base64,/9j/4AAQ');
  assert.equal(jpeg.code, 200);
  assert.equal(jpeg.entetes['content-type'], 'image/jpeg');
  assert.equal(jpeg.entetes['x-content-type-options'], 'nosniff');
  assert.match(jpeg.entetes['content-security-policy'], /sandbox/);
});
