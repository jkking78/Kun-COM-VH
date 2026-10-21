// Logique centrale du client (modules 01a à 01e, 02-media.js), chargée hors navigateur
// dans un contexte isolé : fusions, échappements, heures d'Abidjan, ponctualité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function chargerCoeur() {
  const stock = {};
  const noeud = () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {} });
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (k) => (k in stock ? stock[k] : null),
      setItem: (k, v) => { stock[k] = String(v); },
      removeItem: (k) => { delete stock[k]; },
    },
    document: {
      addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
      getElementById: () => null, createElement: noeud, body: noeud(), documentElement: noeud(), head: noeud(),
    },
    navigator: {}, location: { search: '', href: '', origin: 'https://kun-com-vh.vercel.app' },
    setTimeout, clearTimeout, setInterval() {}, clearInterval() {}, addEventListener() {},
  };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const modules = fs.readdirSync('public/js').filter((f) => /^0[12]/.test(f)).sort();
  for (const f of modules) {
    vm.runInContext(fs.readFileSync(`public/js/${f}`, 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const C = chargerCoeur();
// Les objets créés dans le contexte isolé n'ont pas les mêmes prototypes.
const nu = (x) => JSON.parse(JSON.stringify(x));

test('assignations : on n\'applique que ses propres ajouts et retraits', () => {
  const a = (userId, task = '') => ({ userId, task });
  const original = [a('u1'), a('u2')];
  const actuelle = [a('u1'), a('u3')];                 // j'ai retiré u2, ajouté u3
  const fraiche = [a('u1'), a('u2'), a('u4')];         // un autre responsable a ajouté u4
  assert.deepEqual(nu(C.fusionnerAssignations(fraiche, original, actuelle)).map((x) => x.userId), ['u1', 'u4', 'u3']);
  // un retrait fait par l'autre responsable n'est pas annulé par ma copie
  assert.deepEqual(nu(C.fusionnerAssignations([a('u2')], original, original)).map((x) => x.userId), ['u2']);
  // même membre, autre tâche : deux assignations distinctes
  assert.equal(C.fusionnerAssignations([a('u1', 'son')], [], [a('u1', 'image')]).length, 2);
  assert.equal(C.cleAssignation({ isSection: true, sectionId: 'cadrage', task: 'x' }), 'sec:cadrage|x');
});

test('publications : le serveur fait foi, sauf écriture locale encore en vol', () => {
  const distant = [{ id: 'p1', content: { id: 'p1', text: 'serveur', likedBy: ['a'], timestamp: 2 } }];
  const local = [{ id: 'p1', text: 'local', likedBy: ['b'], viewedBy: ['v'], timestamp: 1 }];
  const r = nu(C.mergePostsWithLocal(distant, null, local));
  assert.equal(r[0].text, 'serveur');
  assert.deepEqual(r[0].likedBy, ['a']);
  assert.deepEqual(r[0].viewedBy, ['v']);                // compté sur l'appareil : conservé
  C.ecrituresEnVol.p1 = Date.now();
  const enVol = nu(C.mergePostsWithLocal(distant, null, local));
  delete C.ecrituresEnVol.p1;
  assert.equal(enVol[0].text, 'local');
  assert.deepEqual(enVol[0].likedBy.sort(), ['a', 'b']);
  // une suppression côté serveur retire la copie locale ; une publication
  // seulement locale n'est jamais effacée par omission
  const sup = nu(C.mergePostsWithLocal([{ id: 'p1', content: { id: 'p1', status: 'deleted' } }], null, local.concat([{ id: 'p2', timestamp: 5 }])));
  assert.deepEqual(sup.map((p) => p.id), ['p2']);
});

test('publications reçues : identifiants, heures, couleurs et liens assainis', () => {
  assert.equal(C.parsePostItem({ id: 'x"onclick', content: {} }), null);
  const p = nu(C.parsePostItem({ id: 'e1', content: {
    type: 'EVENT', eventStart: '<img src=x>', eventEnd: '25:00', eventDate: '2026-1-1',
    avatarColor: 'red"><script>', mediaUrls: ['javascript:alert(1)', 'https://x/a.jpg'], postBg: 'url(https://x)',
  } }));
  assert.equal(p.id, 'e1');
  assert.equal(p.eventStart, '');
  assert.equal(p.eventEnd, '');
  assert.equal(p.eventDate, null);
  assert.equal(p.avatarColor, '#0B5FE0');
  assert.deepEqual(p.mediaUrls, ['https://x/a.jpg']);
  assert.equal(p.postBg, null);
  assert.equal(C.parsePostItem({ id: 'e2', content: { eventStart: '09:30', eventDate: '2026-12-24' } }).eventStart, '09:30');
});

test('échappements : texte HTML et argument de gestionnaire inline', () => {
  assert.equal(C.safeHtml(`<a href="x">l'été & co</a>`), '&lt;a href=&quot;x&quot;&gt;l&apos;été &amp; co&lt;/a&gt;');
  assert.equal(C.safeHtml(null), '');
  // L'apostrophe doit rester échappée pour JavaScript APRÈS le décodage de l'attribut.
  const arg = C.jsArg(`x');alert(1);('`);
  const decode = arg.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  assert.equal(new Function(`return '${decode}'`)(), `x');alert(1);('`);
  assert.equal(C.jsArg('abc-123'), 'abc-123');
  assert.equal(C.urlSure(' JavaScript:alert(1)'), '');
  assert.equal(C.urlSure('data:text/html,<b>'), '');
  assert.equal(C.urlSure('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
});

test('heures d\'événement : toujours celles d\'Abidjan (UTC), quel que soit le téléphone', () => {
  assert.equal(C.heureAbidjan('2026-12-24', '19:00'), Date.UTC(2026, 11, 24, 19, 0));
  assert.equal(C.echeanceTs('2026-10-25T18:00'), Date.UTC(2026, 9, 25, 18, 0));
  assert.equal(C.echeanceTs('2026-10-25T18:00:30'), Date.UTC(2026, 9, 25, 18, 0, 30));
  assert.equal(C.echeanceTs('2026-10-25T18:00+01:00'), Date.UTC(2026, 9, 25, 17, 0));
  assert.ok(Number.isNaN(C.echeanceTs('')));
  assert.equal(C.isoLocal(new Date(Date.UTC(2026, 0, 1, 23, 30))), '2026-01-01');
  // une veillée 21:30 → 00:30 finit le lendemain
  const veillee = { eventDate: '2026-12-31', eventStart: '21:30', eventEnd: '00:30' };
  assert.equal(C.eventEndTimestamp(veillee), Date.UTC(2027, 0, 1, 0, 30));
  assert.equal(C.eventStartTimestamp({ eventDate: '2026-12-31' }), Date.UTC(2026, 11, 31));
});

test('ponctualité : retard compté depuis le début, position confirmée après coup, absence', () => {
  const debut = Date.UTC(2026, 11, 24, 19, 0);
  const ev = { id: 'ev', type: 'EVENT', eventDate: '2026-12-24', eventStart: '19:00', eventEnd: '21:00' };
  const arrivee = (min, extra = {}) => ({ id: 'c', userId: 'u', checkInEventId: 'ev', type: 'TEXT', checkInAt: debut + min * 60000, ...extra });
  const aHeure = C.punctualityStars('u', 'ev', [ev, arrivee(-5)]);
  const enRetard = C.punctualityStars('u', 'ev', [ev, arrivee(40)]);
  assert.equal(aHeure.delayMinutes, -5);
  assert.equal(aHeure.presence, 'no_venue');
  assert.ok(enRetard.stars < aHeure.stars);
  // C6 : une position confirmée plus tard vaut arrivée à ce moment-là
  const confirme = C.punctualityStars('u', 'ev', [ev, arrivee(-5, { geoConfirmeLe: debut + 40 * 60000 })]);
  assert.equal(confirme.delayMinutes, 40);
  const absent = C.punctualityStars('u', 'ev', [ev]);
  assert.equal(absent.absent, true);
  // lieu connu : sur place / hors zone
  const lieu = { ...ev, eventLat: 5.3364, eventLng: -4.0267 };
  const surPlace = C.punctualityStars('u', 'ev', [lieu, arrivee(0, { geo: { available: true, lat: 5.3365, lng: -4.0267 } })]);
  const loin = C.punctualityStars('u', 'ev', [lieu, arrivee(0, { geo: { available: true, lat: 5.40, lng: -4.0267 } })]);
  assert.equal(surPlace.presence, 'onsite');
  assert.equal(loin.presence, 'offsite');
  assert.ok(loin.stars < surPlace.stars);
});

test('notifications : fusion sans doublon, plafonnée à 100, sans photo en base64', () => {
  const n = (i) => ({ id: 'n' + i, timestamp: i, senderAvatar: i === 1 ? 'data:image/png;base64,AAAA' : null });
  const r = nu(C.mergeNotifications([n(1), n(2)], [n(2), n(3)]));
  assert.deepEqual(r.map((x) => x.id).sort(), ['n1', 'n2', 'n3']);
  assert.equal(r.find((x) => x.id === 'n1').senderAvatar, null);
  const beaucoup = Array.from({ length: 150 }, (_, i) => n(i + 10));
  const p = C.mergeNotifications(beaucoup, [n(500)]);
  assert.equal(p.length, 100);
  assert.equal(p[0].id, 'n500');
});

test('niveau de fiabilité : calculé sur les 10 derniers engagements, sans pénalité', () => {
  const e = (status) => ({ status });
  const niveau = (liste) => nu(C.niveauFiabilite(liste));
  const neuf = niveau([]);
  assert.equal(neuf.niveau.nom, 'Engagé');
  assert.equal(neuf.manque, 6);
  assert.equal(neuf.total, 0);
  // 6 tenus sur 10 : Fiable ; il en manque 3 pour Exemplaire
  const six = niveau([...Array(6)].map(() => e('ontime')).concat([e('late'), e('missed'), e('late'), e('missed')]));
  assert.equal(six.niveau.nom, 'Fiable');
  assert.equal(six.manque, 3);
  // seuls les 10 plus récents comptent : un vieux retard sort de la fenêtre
  const ancien = niveau([...Array(10)].map(() => e('ontime')).concat([e('missed'), e('missed')]));
  assert.equal(ancien.niveau.nom, 'Exemplaire');
  assert.equal(ancien.suivant, null);
  // la fenêtre glisse : les engagements tenus qui en sortent sont pris en compte
  const glisse = niveau([e('late'), e('late'), e('late'), e('late'), e('late'), e('ontime'), e('ontime'), e('ontime'), e('ontime'), e('ontime')]);
  assert.equal(glisse.tenus, 5);
  assert.equal(glisse.manque, 6);   // les 5 premiers nouveaux font sortir les 5 anciens tenus
  // un retard ou un oubli ne fait jamais descendre en dessous d'Engagé
  assert.equal(niveau([...Array(10)].map(() => e('missed'))).niveau.nom, 'Engagé');
});
