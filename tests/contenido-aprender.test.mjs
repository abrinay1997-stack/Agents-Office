// F4 de Contenido (9 oct 2026): lo publicado enseña al Cerebro (las notas que usó el agente que escribió una pieza se acercan a cómo le
// fue en las redes) y el informe del lunes habla de las redes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { puntuar, lecciones, semanaContenido, MINIMO } from '../contenido/aprender.mjs';
import * as memory from '../memory.mjs';

const AHORA = new Date('2026-10-09T12:00:00').getTime();
const pz = (id, fecha, o = {}) => ({ id, fecha, hora: '19:00', redes: ['instagram'], estado: 'aprobada', titulo: 'Pieza ' + id, ...o });
const res = n => [{ red: 'instagram', alcance: n * 10, interacciones: n }];

test('puntuar: el lugar de cada pieza madura entre las que tienen cifras (la mejor 1, la peor 0,25); con poco dato, nada', () => {
  const piezas = [pz('a', '2026-09-20'), pz('b', '2026-09-22'), pz('c', '2026-09-25'), pz('d', '2026-09-28'), pz('e', '2026-10-07')];
  const porPieza = { a: res(10), b: res(40), c: res(25), d: res(5), e: res(999) };
  const p = puntuar(piezas, porPieza, { ahora: AHORA });
  assert.deepEqual([...p.keys()].sort(), ['a', 'b', 'c', 'd'], 'la del 7 oct aún sube (menos de 5 días): no cuenta');
  assert.equal(p.get('b').r, 1); assert.equal(p.get('d').r, 0.25); assert.equal(p.get('b').lugar, 1); assert.equal(p.get('d').de, 4);
  assert.ok(p.get('c').r > p.get('a').r);
  assert.equal(puntuar(piezas.slice(0, MINIMO - 1), porPieza, { ahora: AHORA }).size, 0, 'con menos de 4, no se puntúa');
});

test('lecciones: solo las piezas de un agente con «Fuentes:»; enseñan a esas notas, y el Cerebro las acerca o aleja', () => {
  const piezas = [pz('a', '2026-09-20', { tarea: 't1' }), pz('b', '2026-09-22', { tarea: 't2' }), pz('c', '2026-09-25'), pz('d', '2026-09-28', { tarea: 't3' })];
  const porPieza = { a: res(10), b: res(40), c: res(25), d: res(5) };
  const tareas = [
    { id: 't1', read: ['oferta', 'voz'], result: 'Texto…\nFuentes: oferta' },
    { id: 't2', read: ['clientes', 'voz'], result: 'Texto…\nFuentes: clientes, voz' },
    { id: 't3', read: ['precios'], result: 'Texto sin fuentes' },
  ];
  const ls = lecciones({ piezas, porPieza, tareas, citadas: t => ({ cited: memory.cited(t.result, t.read), read: t.read }), ahora: AHORA });
  assert.deepEqual(ls.map(l => [l.id, l.r, l.cited.join(',')]), [['contenido:a', 0.5, 'oferta'], ['contenido:b', 1, 'clientes,voz']], 'c no es de un agente; d no citó nada');
  const mem = memory.emptyMemory();
  for (const l of ls) memory.reinforce(mem, l, AHORA);
  assert.ok(mem.notes.clientes.w > 0.5 && mem.notes.voz.w > 0.5, 'lo que mejor funcionó acerca sus notas');
  assert.ok(mem.edges[['clientes', 'voz'].sort().join('\u0001')], 'y las une');
  const antes = mem.notes.clientes.w; memory.reinforce(mem, ls[1], AHORA); assert.equal(mem.notes.clientes.w, antes, 'la misma lección dos veces no cuenta doble');
});

test('semanaContenido: lo que salió y cómo le fue, lo que viene, los huecos y lo que puede volver; sin Meta, lo dice', () => {
  const piezas = [pz('a', '2026-10-05', { titulo: 'Examen gratis' }), pz('b', '2026-10-06', { titulo: 'Kit de limpieza' }), pz('c', '2026-10-07', { titulo: 'Monturas' }),
    pz('n1', '2026-10-10', { estado: 'aprobada' }), pz('n2', '2026-10-11', { estado: 'revision' }), pz('n3', '2026-10-12', { estado: 'borrador' }), pz('i', '2026-10-12', { estado: 'idea' })];
  const porPieza = { a: res(120), b: res(30), c: res(60) };
  const t = semanaContenido({ piezas, porPieza, sueltas: [{ red: 'facebook', alcance: 100, interacciones: 4 }], huecos: [{ fecha: '2026-10-13' }, { fecha: '2026-10-14' }], vuelven: [{ pieza: { titulo: 'Antes y después' } }], ahora: AHORA });
  assert.match(t, /salieron 4 publicaciones \(Instagram 3, Facebook 1\), 1 hechas fuera de Contenido; 2,2 mil de alcance y 214 interacciones/);
  assert.match(t, /La que más movió: «Examen gratis»/); assert.match(t, /La que menos: «Kit de limpieza» \(30 interacciones\)/);
  assert.match(t, /Próximos 7 días: 3 piezas \(1 aprobadas, 1 esperan tu OK, 1 borradores\); 2 días sin nada \(10-13, 10-14\): se tapan con «Llenar la semana»/);
  assert.match(t, /Puede volver .*«Antes y después»/);
  assert.match(semanaContenido({ piezas: [], porPieza: {}, conectado: false, ahora: AHORA }), /Meta no está conectada/);
  assert.match(semanaContenido({ piezas: [], porPieza: {}, conectado: true, ahora: AHORA }), /Redes \(7 días\): no salió nada/);
});
