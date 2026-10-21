// Rappels des étapes du plan de préparation (Edge Function push, etapes.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapesDues, destinataires, message, dateCourte } from '../../migration/functions/push/etapes.ts';

const H = 3600e3;
const t = (iso) => Date.parse(iso);
const debut = (ev) => Date.parse(ev.eventDate + 'T' + ev.eventStart + ':00Z');
const ev = {
  id: 'ev1',
  content: {
    type: 'EVENT', eventTitle: 'Concert de Noël', eventDate: '2026-12-24', eventStart: '19:00',
    preparation: {
      cadrage: { v: 3, maj_par: 'admin', taches: [{ id: 't1', titre: 'Caméras', etapes: [
        { id: 'e1', titre: 'Charger les batteries', date: '2026-12-20', fait: false },
        { id: 'e2', titre: 'Réserver le drone', date: '2026-12-20', fait: true },
        { id: 'e3', titre: 'Tester les retours', date: '2026-12-18', fait: false },
        { id: 'e4', titre: 'Sans date', date: '', fait: false },
      ] }] },
    },
  },
};

test('la veille, à partir de 8 h, une étape non cochée est rappelée', () => {
  assert.deepEqual(etapesDues([ev], t('2026-12-19T07:59:00Z'), debut).filter((g) => g.genre === 'veille'), []);
  const g = etapesDues([ev], t('2026-12-19T08:00:00Z'), debut).find((x) => x.genre === 'veille');
  assert.deepEqual(g.etapes.map((e) => e.cle), ['etape-veille:ev1:e1']);   // e2 est cochée
});

test('une étape passée est signalée en retard le lendemain à partir de 8 h', () => {
  assert.equal(etapesDues([ev], t('2026-12-19T07:00:00Z'), debut).some((g) => g.genre === 'retard'), false);
  const g = etapesDues([ev], t('2026-12-19T08:00:00Z'), debut).find((x) => x.genre === 'retard');
  assert.deepEqual(g.etapes.map((e) => e.titre), ['Tester les retours']);
});

test('plus aucun rappel une fois l\'événement commencé', () => {
  assert.deepEqual(etapesDues([ev], t('2026-12-24T19:00:00Z'), debut), []);
});

test('les responsables du pôle reçoivent le rappel, sinon l\'auteur du plan', () => {
  const g = etapesDues([ev], t('2026-12-19T09:00:00Z'), debut)[0];
  assert.deepEqual(destinataires(g, [{ id: 'r1', sections: ['cadrage'] }, { id: 'r2', sections: ['photo'] }]), ['r1']);
  assert.deepEqual(destinataires(g, [{ id: 'r2', sections: ['photo'] }]), ['admin']);
});

test('le message nomme l\'événement, le pôle et les étapes', () => {
  const [veille, retard] = etapesDues([ev], t('2026-12-19T09:00:00Z'), debut);
  assert.deepEqual(message(veille, veille.etapes, 'Cadrage'),
    { titre: 'Demain : étape à faire', corps: '« Concert de Noël » · Cadrage : Charger les batteries' });
  assert.equal(message(retard, retard.etapes, 'Cadrage').corps, '« Concert de Noël » · Cadrage : Tester les retours (prévue le 18 déc.)');
  assert.equal(message(veille, [...veille.etapes, ...veille.etapes], 'Cadrage').titre, 'Demain : 2 étapes à faire');
  assert.equal(dateCourte('2026-08-03'), '3 août');
});
