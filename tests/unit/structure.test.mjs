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
