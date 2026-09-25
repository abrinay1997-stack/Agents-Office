// V4.4 — what the agents know (knowledge.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../knowledge.mjs';

const notes = new Map([
  ['precios-webs', '---\nrevisar: 2020-01-01\n---\n# Precios de webs\n\nLanding: $450.\n\n## Tienda online\n\nTienda completa desde $1.200 con pasarela de pago.'],
  ['plazos-entrega', '# Plazos\n\nUna landing se entrega en 7 días hábiles. Una tienda, en 21.'],
  ['voice', '# Voz\n\nCercana, directa, sin tecnicismos.'],
]);
test('search finds the passage by meaning of the words, accents and plurals aside', () => {
  const ix = K.buildIndex(notes);
  const r = K.search(ix, '¿Cuánto cuesta una tienda en línea con pagos?');
  assert.equal(r[0].note, 'precios-webs'); assert.match(r[0].passages[0], /Tienda completa/);
  const p = K.search(ix, 'en cuántos días entregan la landing');
  assert.equal(p[0].note, 'plazos-entrega');
  assert.ok(K.search(ix, 'x', { always: ['voice'] }).some(x => x.note === 'voice'));
});
test('hybrid ranking uses the vectors when there are some', () => {
  const ix = K.buildIndex(notes), vectors = {}; for (const d of ix.docs) vectors[d.hash] = d.note === 'voice' ? [1, 0] : [0, 1];
  const r = K.search(ix, 'tono de marca', { vectors, queryVec: [1, 0] });
  assert.equal(r[0].note, 'voice');
});
test('notes that need a look', () => {
  const now = Date.parse('2026-09-25');
  assert.equal(K.staleness('precios-webs', notes.get('precios-webs'), now, '10-Business', now).stale, true);
  assert.equal(K.staleness('x', '# x', now - 200 * 864e5, '10-Business', now).stale, true);
  assert.equal(K.staleness('x', '# x', now - 200 * 864e5, 'Agents Office', now).stale, false);
  assert.equal(K.staleness('x', '---\nactualizado: 2026-09-01\n---', now - 400 * 864e5, '10-Business', now).stale, false);
});
test('the same client across departments', () => {
  const now = Date.now();
  const tasks = [
    { id: 'a', dept: 'delivery', agent: 'pm', title: 'Plan de entrega para Sol Marina', text: 'Entregar a sol@marina.com en 3 semanas', state: 'done', doneAt: now - 864e5, result: 'Le prometimos la tienda el 15 de octubre.' },
    { id: 'b', dept: 'ops', agent: 'x', title: 'Inventario', text: 'Contar cajas', state: 'done', doneAt: now - 864e5, result: '' },
  ];
  const hits = K.sameClient(tasks, { id: 'n', title: 'Propuesta para Sol Marina', text: 'Escribir a sol@marina.com' });
  assert.equal(hits.length, 1); assert.equal(hits[0].t.id, 'a');
  assert.match(K.sameClientText(hits, id => id, d => d), /15 de octubre/);
  assert.equal(K.sameClient(tasks, { id: 'n', title: 'Hola', text: 'Revisa el correo' }).length, 0);
});
