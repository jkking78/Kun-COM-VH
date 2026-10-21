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

test('index.html charge les huit modules, dans l\'ordre, et rien depuis un CDN sans version fixe', () => {
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

test('Vercel sert public/ (une seule copie du code)', () => {
  const conf = JSON.parse(lire('vercel.json'));
  assert.equal(conf.outputDirectory, 'public');
  assert.ok(!existsSync(join(RACINE, 'index.html')), 'une copie de index.html traîne à la racine');
  assert.ok(!existsSync(join(RACINE, 'js')), 'une copie de js/ traîne à la racine');
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
  const app = lire('public/js/01-core.js');
  const fn = lire('migration/functions/password-recovery/index.ts');
  const extraire = (src, debut) => [...src.slice(src.indexOf(debut), src.indexOf('];', src.indexOf(debut))).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const a = extraire(app, 'var SECURITY_QUESTIONS = [');
  const f = extraire(fn, 'const QUESTIONS = [');
  assert.equal(a.length, 8);
  assert.deepEqual(f, a);
});

test('aperçu de liens : adresses internes et origines étrangères refusées', async () => {
  const og = await import(join(RACINE, 'api/og.js'));
  const { ipPrivee, origineAutorisee, isPublicHttpUrl } = (og.default || og)._interne;
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.4', '172.20.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) {
    assert.equal(ipPrivee(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '41.202.219.1', '2606:4700::1111']) assert.equal(ipPrivee(ip), false, ip);
  assert.equal(origineAutorisee('https://kun-com-vh.vercel.app'), true);
  assert.equal(origineAutorisee(''), true);
  assert.equal(origineAutorisee('https://pirate.example'), false);
  assert.equal(isPublicHttpUrl('file:///etc/passwd'), null);
});
