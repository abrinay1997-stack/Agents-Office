// Cerebro en la nube — lo que los agentes aprendieron (issue #45, ideas 6 y 7).
//  · GET /api/brain ya devuelve `learned` (antes iba vacío en la nube): el peso de cada nota y las sinapsis doradas, leídos del doc `memoria`.
//  · «Actualizar conexiones» ofrece como enlace las parejas que los agentes usaron juntas en trabajo bueno y nadie ha enlazado (gratis, sin IA); se escribe con el mismo camino de siempre y NUNCA en una nota
//    de fábrica, clave o de un agente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { mundoDelCerebro, crearNota, textoEnDb, memoriaCon } from './cerebro-ayudas.mjs';
import { guardarDoc } from '../worker/lib/almacen.js';
import { enlacesPorUso, MIN_USOS, MIN_PESO, MAX_PAREJAS } from '../worker/lib/cerebro-uso.js';

/* ---------- lo puro ---------- */
const AHORA = Date.UTC(2026, 9, 27);
const fila = (nombre, extra = {}) => ({ nombre, grupo: 'g', oficina: 0, actualizado: 1000, ...extra });
const mem = (pares) => memoriaCon(pares.map(([a, b, w, n]) => [a, b, w, n]));
const puede = (f) => !f.oficina && !['fab1', 'fab2', 'index'].includes(f.nombre); // como puedeEscribirNota: ni de fábrica, ni de un agente, ni los índices

test('puro: solo parejas usadas varias veces, con fuerza, que existen y no están enlazadas; se escribe en la nota que se puede', () => {
  const notas = [fila('mia'), fila('otra'), fila('fab1'), fila('fab2'), fila('agente', { oficina: 1 })];
  const m = mem([['mia', 'fab1', 0.4, 3], ['mia', 'otra', 0.4, 1], ['otra', 'fab1', 0.2, 5], ['fab1', 'fab2', 0.9, 9], ['mia', 'no-existe', 0.9, 9], ['agente', 'fab2', 0.9, 9]]);
  const r = enlacesPorUso({ mem: m, pares: [], notas, puedeEscribir: puede });
  assert.deepEqual(r.map((x) => [x.nota, x.enlaces.map((e) => e.a)]), [['mia', ['fab1']]], 'una sola vez, poca fuerza, dos de fábrica, una inexistente y una de un agente: ninguna');
  assert.equal(r[0].origen, 'uso'); assert.equal(r[0].rev, 1000); assert.equal(r[0].enlaces[0].usos, 3); assert.match(r[0].enlaces[0].porque, /3 trabajos/);
  assert.ok(MIN_USOS >= 2 && MIN_PESO > 0.2, 'una sola vez, o una sinapsis recién nacida (0,2), no es una razón para enlazar');
});

test('puro: lo que ya está enlazado no se vuelve a proponer (en cualquier dirección); si las dos se pueden escribir, se escribe en la más reciente', () => {
  const notas = [fila('a', { actualizado: 10 }), fila('b', { actualizado: 20 })];
  const m = mem([['a', 'b', 0.5, 4]]);
  assert.deepEqual(enlacesPorUso({ mem: m, pares: [['b', 'a']], notas, puedeEscribir: puede }), []);
  const r = enlacesPorUso({ mem: m, pares: [], notas, puedeEscribir: puede });
  assert.equal(r[0].nota, 'b'); assert.deepEqual(r[0].enlaces.map((e) => e.a), ['a']);
});

test('puro: no se enlaza a index/log/CLAUDE; el tope de parejas, la más fuerte primero; sin memoria, nada', () => {
  const notas = [fila('mia'), fila('index'), ...Array.from({ length: 20 }, (_, i) => fila('n' + String(i).padStart(2, '0')))];
  const pares = [['mia', 'index', 0.9, 9], ...notas.slice(2).map((n, i) => ['mia', n.nombre, 0.3 + i / 100, 3])];
  const r = enlacesPorUso({ mem: mem(pares), pares: [], notas, puedeEscribir: puede, puedeEnlazar: (f) => f.nombre !== 'index' });
  assert.ok(!r.some((x) => x.enlaces.some((e) => e.a === 'index')), 'el índice no se enlaza');
  const total = r.reduce((t, x) => t + x.enlaces.length, 0);
  assert.ok(total <= MAX_PAREJAS && total <= 5, 'tope por nota (5) y por vez: ' + total);
  assert.equal(r[0].enlaces[0].a, 'n19', 'la más fuerte primero'); assert.ok(r[0].enlaces[0].peso >= r[0].enlaces.at(-1).peso);
  for (const raro of [null, undefined, {}, { edges: null }]) assert.deepEqual(enlacesPorUso({ mem: raro, pares: [], notas, puedeEscribir: puede }), []);
});

test('puro: una sinapsis que no se usa se apaga sola y deja de proponerse', () => {
  const notas = [fila('a'), fila('b')], vieja = { ...mem([['a', 'b', 0.5, 4]]) };
  for (const e of Object.values(vieja.edges)) e.last = AHORA - 400 * 864e5; // 400 días sin uso: el peso vuelve casi a cero
  assert.deepEqual(enlacesPorUso({ mem: vieja, pares: [], notas, puedeEscribir: puede, ahora: AHORA }), []);
});

/* ---------- el Worker entero ---------- */
test('GET /api/brain en la nube trae lo aprendido: el peso de las notas y las sinapsis doradas, con los índices del mapa', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro();
  const sin = (await m.p.admin('GET', '/api/brain')).j; assert.deepEqual(sin.learned, { w: {}, links: [] }, 'sin memoria, vacío (como antes)');
  await guardarDoc(m.d1, 'memoria', memoriaCon([['precios-webs', 'MOC-Sales', 0.5, 4], ['precios-webs', 'nota-que-no-esta', 0.9, 9]], { 'precios-webs': 0.9, voice: 0.51, 'nota-que-no-esta': 0.1 }));
  const g = (await m.p.admin('GET', '/api/brain')).j, id = (i) => g.nodes[i].id;
  const pesos = Object.fromEntries(Object.entries(g.learned.w).map(([i, w]) => [id(i), w]));
  assert.ok(pesos['precios-webs'] > 0.8 && pesos['precios-webs'] <= 1, JSON.stringify(pesos)); assert.equal(pesos.voice, undefined, 'casi neutra: no se dibuja'); assert.equal(pesos['nota-que-no-esta'], undefined);
  assert.equal(g.learned.links.length, 1); const [a, b, w] = g.learned.links[0];
  assert.deepEqual([id(a), id(b)].sort(), ['MOC-Sales', 'precios-webs']); assert.ok(w >= 0.4);
  for (const rol of ['editor', 'lectura']) assert.equal((await m.p[rol]('GET', '/api/brain')).status, 200, 'el mapa lo ve todo el equipo');
});

test('estado: ofrece las parejas que los agentes usaron juntas; aplicarlas escribe «Relacionadas» solo en la nota tuya y no toca la cola de la IA', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro();
  await crearNota(m, 'Oferta de verano', '# Oferta de verano\n\nCombos y precios de la web.');
  await guardarDoc(m.d1, 'memoria', memoriaCon([
    ['Oferta de verano', 'precios-webs', 0.45, 3],     // se escribe en la tuya
    ['precios-webs', 'MOC-Sales', 0.9, 9],             // dos de fábrica: nada que escribir
    ['voice', 'Oferta de verano', 0.45, 2],            // una clave y la tuya: se escribe en la tuya
    ['Oferta de verano', 'decision-plan', 0.2, 8],     // fuerza de recién nacida
  ]));
  const e = (await m.p.admin('GET', '/api/brain/actualizar')).j;
  assert.deepEqual(e.porUso.map((x) => x.nota), ['Oferta de verano']);
  assert.deepEqual(e.porUso[0].enlaces.map((x) => x.a).sort(), ['precios-webs', 'voice']);
  assert.ok(e.candidatas.some((c) => c.nombre === 'Oferta de verano'), 'sigue en la cola de la IA');
  const r = await m.p.admin('POST', '/api/brain/actualizar', { paso: 'aplicar', origen: 'uso', revisadas: [{ nota: 'Oferta de verano', rev: e.porUso[0].rev }], conexiones: [{ nota: 'Oferta de verano', rev: e.porUso[0].rev, enlaces: e.porUso[0].enlaces.map(({ a, porque }) => ({ a, porque })) }] });
  assert.equal(r.status, 200, r.texto); assert.deepEqual(r.j.aplicadas.map((x) => x.nota), ['Oferta de verano']);
  assert.match(textoEnDb(m, 'Oferta de verano'), /\n## Relacionadas\n\n- \[\[precios-webs\]\] — los agentes las usaron juntas en 3 trabajos/);
  assert.ok(m.semilla.notas.every((n) => textoEnDb(m, n.nombre) === n.texto), 'ninguna nota de fábrica cambió');
  const luego = (await m.p.admin('GET', '/api/brain/actualizar')).j;
  assert.deepEqual(luego.porUso, [], 'ya están enlazadas: no se proponen otra vez');
  assert.ok(luego.candidatas.some((c) => c.nombre === 'Oferta de verano'), 'lo que sale del uso no cuenta como revisión de la IA: la nota sigue esperando a la IA');
});

test('aplicar parejas por uso: si alguien editó la nota mientras mirabas, no se escribe; en una nota de fábrica, jamás', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro();
  await crearNota(m, 'Oferta de verano', 'Combos.');
  const e0 = (await m.p.admin('GET', '/api/brain/actualizar')).j, rev = e0.candidatas.find((c) => c.nombre === 'Oferta de verano').rev;
  const nota = (await m.p.admin('GET', '/api/note?id=' + encodeURIComponent('Oferta de verano'))).j;
  await m.p.admin('PUT', '/api/note', { name: 'Oferta de verano', text: nota.text + '\nOtra línea.', base: nota.modified });
  const r = await m.p.admin('POST', '/api/brain/actualizar', { paso: 'aplicar', origen: 'uso', conexiones: [
    { nota: 'Oferta de verano', rev, enlaces: [{ a: 'precios-webs' }] },
    { nota: 'precios-webs', rev: 1000, enlaces: [{ a: 'Oferta de verano' }] },
  ] });
  assert.deepEqual(r.j.aplicadas, []); assert.match(r.j.omitidas[0].motivo, /editó/); assert.match(r.j.omitidas[1].motivo, /fábrica/);
  assert.ok(!/Relacionadas/.test(textoEnDb(m, 'Oferta de verano')));
});

test('limpiar o aplicar adelanta la fecha del mapa, pero las notas editadas que aún esperan a la IA siguen esperando (la referencia se fija antes de escribir)', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro();
  await crearNota(m, 'Editada con enlaces', 'Mira [[precios-webs]] otra vez.');   // ya tiene un enlace: solo es candidata por haberse editado después del mapa
  await crearNota(m, 'Oferta de verano', 'Combos.');
  const antes = (await m.p.admin('GET', '/api/brain/actualizar')).j;
  assert.deepEqual(antes.candidatas.map((c) => c.nombre).sort(), ['Editada con enlaces', 'Oferta de verano']);
  const rev = antes.candidatas.find((c) => c.nombre === 'Oferta de verano').rev;
  const r = await m.p.admin('POST', '/api/brain/actualizar', { paso: 'aplicar', origen: 'uso', conexiones: [{ nota: 'Oferta de verano', rev, enlaces: [{ a: 'precios-webs' }] }] });
  assert.equal(r.status, 200, r.texto); assert.equal(r.j.pendientes, 2, 'no se revisó ninguna con la IA: las dos siguen esperando');
  const luego = (await m.p.admin('GET', '/api/brain/actualizar')).j;
  assert.ok(luego.candidatas.some((c) => c.nombre === 'Editada con enlaces'), 'la editada con enlaces sigue en la cola de la IA');
  assert.ok(luego.candidatas.some((c) => c.nombre === 'Oferta de verano'));
});
