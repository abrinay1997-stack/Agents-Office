// Cerebro — la búsqueda se mide, no se supone (issue #45). Las preguntas son de evals/cerebro-busqueda/preguntas.json y la línea base, de linea-base.json.
// Si este test falla porque la búsqueda EMPEORÓ, el cambio que lo causó no entra. Si mejoró, `node scripts/evals-cerebro.mjs --guardar` sube la línea.
import test from 'node:test';
import assert from 'node:assert/strict';
import { posicion, resumir, evaluarBusqueda, enlacesReales, sinEnlaces, evaluarEnlaces, indiceDeBusqueda, rankingBM25 } from '../cerebro-evals.mjs';
import { cargarNotas, cargarPreguntas, leerLineaBase } from '../scripts/evals-cerebro.mjs';

test('posicion: 1 es la primera; 0 si no aparece; vale cualquiera de las esperadas', () => {
  assert.equal(posicion(['a', 'b', 'c'], ['a']), 1);
  assert.equal(posicion(['a', 'b', 'c'], ['x', 'c']), 3);
  assert.equal(posicion(['a', 'b'], ['z']), 0);
  assert.equal(posicion([], ['a']), 0);
  assert.equal(posicion(undefined, ['a']), 0);
});

test('resumir: recall@k, MRR y los fallos (los que no aparecen en las 5 primeras)', () => {
  const r = resumir([
    { id: 'uno', q: 'q1', esperadas: ['a'], ranking: ['a', 'b'] },
    { id: 'tres', q: 'q2', esperadas: ['c'], ranking: ['a', 'b', 'c'] },
    { id: 'seis', q: 'q3', esperadas: ['f'], ranking: ['a', 'b', 'c', 'd', 'e', 'f'] },
    { id: 'nunca', q: 'q4', esperadas: ['z'], ranking: ['a'] },
  ]);
  assert.equal(r.n, 4);
  assert.deepEqual(r.recall, { 1: 0.25, 3: 0.5, 5: 0.5 });
  assert.equal(r.mrr, +((1 + 1 / 3 + 1 / 6 + 0) / 4).toFixed(4));
  assert.deepEqual(r.fallos.map((f) => f.id), ['seis', 'nunca']);
  assert.deepEqual(resumir([]).recall, { 1: 0, 3: 0, 5: 0 });
});

test('evaluarBusqueda: una pregunta que espera una nota que no existe es un error del conjunto, no un fallo del buscador', async () => {
  await assert.rejects(evaluarBusqueda(new Map([['a', 'hola']]), [{ id: 'x', q: 'hola', esperadas: ['no-existe'] }]), /no existen/);
});

test('enlacesReales y sinEnlaces: los [[enlaces]] que sí existen, y el texto como si no se hubieran escrito', () => {
  const notas = new Map([['a', 'ver [[b]] y [[c|alias]] y [[x]] y [[b]]'], ['b', 'vuelve a [[a]] y a sí misma [[b]]'], ['c', '']]);
  assert.deepEqual(enlacesReales(notas), [['a', 'b'], ['a', 'c'], ['b', 'a']]);
  assert.equal(sinEnlaces('ver [[carpeta/Nota|alias]] y [[otra#parte]]'), 'ver Nota y otra');
});

test('evaluarEnlaces: la fracción de enlaces escondidos que aparece en la lista de candidatas', async () => {
  const r = await evaluarEnlaces([['a', 'b'], ['a', 'c']], async (d, h) => (h === 'b' ? ['b', 'z'] : ['z']));
  assert.deepEqual(r, { n: 2, recall: 0.5, fallos: [['a', 'c']] });
});

test('el conjunto de preguntas es sano: muchas, con id único y todas apuntan a notas que existen', async () => {
  const preguntas = cargarPreguntas(), notas = cargarNotas();
  assert.ok(preguntas.length >= 40, 'al menos 40 preguntas para que un porcentaje signifique algo');
  assert.equal(new Set(preguntas.map((p) => p.id)).size, preguntas.length, 'ids únicos');
  for (const p of preguntas) { assert.ok(p.q.length > 10 && p.esperadas.length, p.id); for (const e of p.esperadas) assert.ok(notas.has(e), `${p.id} espera «${e}», que no existe`); }
  assert.ok(enlacesReales(notas).length > 100, 'las 59 notas de fábrica están muy enlazadas');
});

test('la búsqueda de los agentes no empeora: recall@5 y MRR contra la línea base', async () => {
  const base = leerLineaBase(); assert.ok(base?.busqueda, 'falta evals/cerebro-busqueda/linea-base.json (node scripts/evals-cerebro.mjs --guardar)');
  const r = await evaluarBusqueda(cargarNotas(), cargarPreguntas());
  assert.ok(r.recall[5] >= base.busqueda.recall[5] - 0.02, `recall@5 bajó de ${base.busqueda.recall[5]} a ${r.recall[5]}: ${r.fallos.map((f) => f.id).join(', ')}`);
  assert.ok(r.recall[1] >= base.busqueda.recall[1] - 0.03, `recall@1 bajó de ${base.busqueda.recall[1]} a ${r.recall[1]}`);
  assert.ok(r.mrr >= base.busqueda.mrr - 0.03, `MRR bajó de ${base.busqueda.mrr} a ${r.mrr}`);
});

test('el ranking por palabras no devuelve las notas que los agentes nunca ven (CLAUDE, index, log)', () => {
  const ix = indiceDeBusqueda(cargarNotas());
  for (const q of ['jerarquía cuando dos notas se contradicen', 'instrucciones para Claude']) assert.ok(!rankingBM25(ix, q).some((n) => ['CLAUDE', 'index', 'log'].includes(n)));
});
