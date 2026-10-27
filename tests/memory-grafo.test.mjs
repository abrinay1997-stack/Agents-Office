// memory.learnedForGraph: lo que el Cerebro aprendió, en la forma que dibuja la página (GET /api/brain → learned). Es la misma función en serve.mjs y en el Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as memory from '../memory.mjs';

const AHORA = Date.UTC(2026, 9, 27);
const nodos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

test('learnedForGraph: el peso de cada nota (solo si se aparta de lo neutro) y las sinapsis, con los índices de los nodos', () => {
  const mem = memory.emptyMemory();
  memory.reinforce(mem, { id: 't1', r: 1, cited: ['a', 'b'], read: ['c'] }, AHORA);
  memory.reinforce(mem, { id: 't2', r: 1, cited: ['a', 'b'], read: [] }, AHORA);
  const l = memory.learnedForGraph(mem, nodos, AHORA);
  assert.ok(l.w[0] > 0.52, 'a subió'); assert.ok(l.w[1] > 0.52, 'b subió'); assert.equal(l.w[2], undefined, 'c, leída y no citada, se movió demasiado poco para dibujarse');
  assert.equal(l.w[3], undefined, 'd no se tocó: neutra, no se dibuja');
  assert.equal(l.links.length, 1); assert.deepEqual(l.links[0].slice(0, 2), [0, 1]); assert.ok(l.links[0][2] >= 0.1);
});

test('learnedForGraph: es lo mismo que calculaba serve.mjs a mano (misma forma, mismos números)', () => {
  const mem = memory.emptyMemory();
  memory.reinforce(mem, { id: 't1', r: 0.75, cited: ['b', 'd'], read: ['a'] }, AHORA);
  memory.reinforce(mem, { id: 't2', r: 1, cited: ['b', 'd'], read: [] }, AHORA);
  // la fórmula de antes, copiada
  const at = new Map(nodos.map((n, i) => [n.id, i])), w = {};
  for (const [name, e] of Object.entries(mem.notes)) { const v = memory.effective(e, AHORA); if (at.has(name) && Math.abs(v - 0.5) > 0.02) w[at.get(name)] = +v.toFixed(3); }
  const links = memory.learnedLinks(mem, AHORA).filter(([a, b]) => at.has(a) && at.has(b)).map(([a, b, x]) => [at.get(a), at.get(b), x]);
  assert.deepEqual(memory.learnedForGraph(mem, nodos, AHORA), { w, links });
});

test('learnedForGraph: una nota o una pareja que no está en el mapa no se dibuja; sin memoria o con una memoria rara, vacío', () => {
  const mem = memory.emptyMemory();
  memory.reinforce(mem, { id: 't1', r: 1, cited: ['a', 'fantasma'], read: [] }, AHORA);
  memory.reinforce(mem, { id: 't2', r: 1, cited: ['a', 'fantasma'], read: [] }, AHORA);
  const l = memory.learnedForGraph(mem, nodos, AHORA);
  assert.deepEqual(Object.keys(l.w), ['0']); assert.deepEqual(l.links, [], 'la pareja con una nota que no existe no se dibuja');
  for (const raro of [null, undefined, {}, { notes: {} }, { edges: {} }, 'x']) assert.deepEqual(memory.learnedForGraph(raro, nodos, AHORA), { w: {}, links: [] });
  assert.deepEqual(memory.learnedForGraph(mem, undefined, AHORA), { w: {}, links: [] });
});
