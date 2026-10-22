// Page d'aperçu d'un lien partagé (api/p.js) : événement seul et série.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handler = require('../../api/p.js');

async function page(query, apercu) {
  const avant = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => apercu });
  let html = '';
  const res = { setHeader() {}, status() { return { send(h) { html = h; } }; } };
  try { await handler({ query, headers: { host: 'kun-com-vh.vercel.app' } }, res); }
  finally { globalThis.fetch = avant; }
  return html;
}
const culte = { author: 'Awa', caption: '', image: null, eventTitle: '1er Culte', eventDate: '2026-10-25', eventStart: '07:00',
  serie: { nb: 4, debut: '2026-10-25', fin: '2026-11-15' } };

test('lien d\'une date : titre, jour et heure de l\'événement', async () => {
  const html = await page({ id: 'evt_1' }, culte);
  assert.match(html, /<title>1er Culte · Commit VH<\/title>/);
  assert.match(html, /Dimanche 25 octobre à 07 h 00/);
  assert.match(html, /\/\?post=evt_1"/);
});

test('lien de la série : nombre de dates et période, l\'appli ouvre la série', async () => {
  const html = await page({ id: 'evt_1', serie: '1' }, culte);
  assert.match(html, /4 dates, du 25 oct\. au 15 nov\./);
  assert.match(html, /\/\?post=evt_1&amp;serie=1"/);
});

test('publication ordinaire : inchangée', async () => {
  const html = await page({ id: 'p1' }, { author: 'Awa', caption: 'Bonjour', image: null });
  assert.match(html, /<title>Awa · Commit VH<\/title>/);
  assert.match(html, /content="Bonjour"/);
});
