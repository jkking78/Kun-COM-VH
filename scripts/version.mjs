#!/usr/bin/env node
// Version unique de l'application.
//
// Le numéro apparaît à trois endroits qui DOIVENT rester alignés, sinon le
// service worker et la page ne parlent plus du même cache :
//   - public/index.html          : ?v=N sur chaque <script src="js/…">
//   - public/sw.js               : CACHE_NAME = 'kun-com-pwa-vN'
//   - public/js/08-bootstrap.js  : APP_VERSION = 'vN'
// La source de vérité est "appVersion" dans package.json.
//
//   node scripts/version.mjs check   → échoue si un fichier n'est pas aligné
//   node scripts/version.mjs bump    → incrémente puis réécrit les trois fichiers
//   node scripts/version.mjs sync    → réécrit les trois fichiers sans incrémenter

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'package.json');

const CIBLES = [
  {
    fichier: 'public/index.html',
    motif: /(<script src="js\/[\w-]+\.js\?v=)(\d+)(")/g,
    remplacer: (n) => (_, a, _v, b) => a + n + b,
  },
  {
    fichier: 'public/sw.js',
    motif: /(const CACHE_NAME = 'kun-com-pwa-v)(\d+)(')/g,
    remplacer: (n) => (_, a, _v, b) => a + n + b,
  },
  {
    fichier: 'public/js/08-bootstrap.js',
    motif: /(var APP_VERSION = 'v)(\d+)(')/g,
    remplacer: (n) => (_, a, _v, b) => a + n + b,
  },
];

function lirePkg() {
  return JSON.parse(readFileSync(PKG, 'utf8'));
}

function versionsTrouvees(contenu, motif) {
  return [...contenu.matchAll(motif)].map((m) => Number(m[2]));
}

export function verifier() {
  const attendu = Number(lirePkg().appVersion);
  const erreurs = [];
  for (const c of CIBLES) {
    const contenu = readFileSync(join(ROOT, c.fichier), 'utf8');
    const trouvees = versionsTrouvees(contenu, c.motif);
    if (!trouvees.length) erreurs.push(`${c.fichier} : aucun marqueur de version trouvé`);
    for (const v of trouvees) {
      if (v !== attendu) erreurs.push(`${c.fichier} : v${v} au lieu de v${attendu}`);
    }
  }
  return { attendu, erreurs };
}

function ecrire(n) {
  for (const c of CIBLES) {
    const chemin = join(ROOT, c.fichier);
    const contenu = readFileSync(chemin, 'utf8');
    writeFileSync(chemin, contenu.replace(c.motif, c.remplacer(n)));
  }
}

const action = process.argv[2];
if (action === 'bump' || action === 'sync') {
  const pkg = lirePkg();
  const n = Number(pkg.appVersion) + (action === 'bump' ? 1 : 0);
  pkg.appVersion = n;
  writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');
  ecrire(n);
  console.log(`Version v${n} appliquée.`);
} else if (action === 'check') {
  const { attendu, erreurs } = verifier();
  if (erreurs.length) {
    console.error(erreurs.join('\n'));
    process.exit(1);
  }
  console.log(`Version v${attendu} alignée partout.`);
} else if (action) {
  console.error('Usage : node scripts/version.mjs check|bump|sync');
  process.exit(2);
}
