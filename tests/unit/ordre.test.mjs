// Les modules de public/js sont des scripts classiques qui partagent la portée
// globale : un module ne doit rien utiliser, AU CHARGEMENT, qui soit déclaré
// dans un module chargé après lui (dans un seul fichier, les déclarations de
// fonctions étaient « remontées » ; réparties sur plusieurs, elles ne le sont
// plus). Chaque nom d'un module pas encore chargé est piégé : y accéder est
// signalé, même quand l'erreur serait avalée par un try/catch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

test('aucun module n\'utilise au chargement un nom déclaré par un module suivant', () => {
  const html = fs.readFileSync('public/index.html', 'utf8');
  const fichiers = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map((m) => 'public/' + m[1]);
  const declares = fichiers.map((f) => [...fs.readFileSync(f, 'utf8')
    .matchAll(/^  (?:async )?function\s+([\w$]+)|^  var ([\w$]+)/gm)].map((m) => m[1] || m[2]));
  const maintenant = Date.now();
  // Une session et quelques données, pour parcourir les chemins de démarrage.
  const stock = {
    kc_user: JSON.stringify({ id: 'u1', firstName: 'A', lastName: 'B', role: 'MEMBRE', email: 'a@b' }),
    kc_profiles: JSON.stringify([{ id: 'u1', firstName: 'A', lastName: 'B', role: 'MEMBRE' }]),
    kc_posts: JSON.stringify([
      { id: 'p1', type: 'EVENT', eventDate: '2026-12-24', eventStart: '19:00', timestamp: maintenant },
      { id: 'p2', type: 'EVALUATION', timestamp: maintenant },
    ]),
    kc_dark: '1',
  };
  const erreurs = [];
  // Élément de page factice : toute méthode existe et renvoie un autre élément factice.
  const noeud = () => new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[a-z]/.test(k) ? () => noeud() : undefined),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const sansFin = () => new Proxy(() => {}, { get: () => sansFin(), apply: () => sansFin() });
  const ctx = {
    console: { log() {}, warn() {}, info() {}, error: (...a) => erreurs.push('console.error : ' + a.join(' ')) },
    localStorage: { getItem: (k) => (k in stock ? stock[k] : null), setItem: (k, v) => { stock[k] = String(v); }, removeItem: (k) => { delete stock[k]; }, key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: noeud(), navigator: { onLine: true, userAgent: 'node' },
    location: { search: '?post=p1', href: 'https://x/?post=p1', origin: 'https://x', pathname: '/', reload: () => erreurs.push('rechargement demandé') },
    history: { replaceState() {} }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    morphdom() {}, requestAnimationFrame() {}, fetch: () => new Promise(() => {}),
    __supabaseSdk: { createClient: () => sansFin() },
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  fichiers.forEach((f, k) => {
    const plusTard = new Set(declares.slice(k + 1).flat());
    for (const d of declares.slice(0, k + 1).flat()) plusTard.delete(d);
    for (const nom of plusTard) {
      if (Object.prototype.hasOwnProperty.call(ctx, nom)) continue;
      Object.defineProperty(ctx, nom, {
        configurable: true,
        get() { erreurs.push(`${f} utilise « ${nom} » avant son chargement`); return undefined; },
        set(v) { Object.defineProperty(ctx, nom, { value: v, writable: true, configurable: true, enumerable: true }); },
      });
    }
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }); }
    catch (e) { erreurs.push(`${f} : ${e.message}`); }
    for (const nom of plusTard) {
      const d = Object.getOwnPropertyDescriptor(ctx, nom);
      if (d && d.get) delete ctx[nom];
    }
  });
  assert.deepEqual(erreurs, []);
  assert.equal(typeof ctx.App.tab, 'function');
});
