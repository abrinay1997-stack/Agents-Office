// Cerebro en la nube — recalcular el mapa ENTERO (issue #45, idea 1). Con las 59 notas de fábrica de verdad. El mapa es solo el dibujo: las notas jamás se tocan; el anterior se guarda y se puede recuperar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR, sinCruzarMinuto } from './d1-memoria.mjs';
import { mundoDelCerebro, crearNota, textoEnDb } from './cerebro-ayudas.mjs';
import { calcularMapa, recalcularMapa, deshacerMapa, MAX_NOTAS_MAPA } from '../worker/lib/cerebro-mapa.js';
import { analizarEnlaces } from '../worker/lib/conexiones.js';
import { layoutGraphFromNotes } from '../../graph-core.mjs';

// El motor depende de lo instalado: con las librerías de la raíz es d3-force (como en la computadora y en el Worker publicado); sin ellas, el cálculo de reserva.
const MOTOR = await import('d3-force').then(() => 'd3-force', () => 'interno');
const guardado = (m) => JSON.parse(m.d1._db.prepare('select json from grafo where id = 1').get().json);
const posiciones = (g) => Object.fromEntries(g.nodes.map((n) => [n.id, [n.x, n.y]]));
const filasDeSemilla = (m) => m.semilla.notas.map((n) => ({ nombre: n.nombre, grupo: n.grupo, oficina: 0, actualizado: 1000, texto: n.texto }));
/** El mapa es coherente: cada línea apunta a dos nodos que existen, el grado de cada neurona es el de sus líneas y las conectadas van antes que las sueltas. */
function coherente(g) {
  const grado = new Map(g.nodes.map((n) => [n.id, 0]));
  for (const [i, j] of g.links) { assert.ok(g.nodes[i] && g.nodes[j], `línea [${i},${j}] sin nodo`); grado.set(g.nodes[i].id, grado.get(g.nodes[i].id) + 1); grado.set(g.nodes[j].id, grado.get(g.nodes[j].id) + 1); }
  for (const n of g.nodes) { assert.equal(n.d, grado.get(n.id), `el grado de «${n.id}»`); assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y) && Math.abs(n.x) < 1.5 && Math.abs(n.y) < 1.5, `«${n.id}» fuera de la hoja`); }
  assert.equal(g.notes, g.nodes.length); assert.equal(new Set(g.nodes.map((n) => n.id)).size, g.nodes.length);
  const l = g.nodes.map((n) => n.d > 0), i = l.indexOf(false); if (i >= 0) assert.ok(l.slice(i).every((x) => !x), 'las conectadas van antes que las sueltas');
}

test('puro: el mismo texto da el mismo mapa; cada nota sale una vez; las líneas son los enlaces de verdad; es el cálculo de graph-core', async () => {
  const m = await mundoDelCerebro(), filas = filasDeSemilla(m);
  const a = await calcularMapa(filas), b = await calcularMapa([...filas].reverse());
  assert.deepEqual(a, b, 'el orden en que llegan las notas no cambia el dibujo'); coherente(a);
  assert.equal(a.notes, filas.length); assert.equal(a.links.length, analizarEnlaces(filas).pares.length);
  const nombres = (g) => new Set(g.links.map(([i, j]) => [g.nodes[i].id, g.nodes[j].id].sort().join('|')));
  assert.deepEqual([...nombres(a)].sort(), [...nombres(m.semilla.grafo)].sort(), 'las mismas líneas que el mapa que calculó la computadora');
  assert.deepEqual(new Set(a.nodes.map((n) => n.id)), new Set(m.semilla.grafo.nodes.map((n) => n.id)), 'las mismas neuronas');
  const directo = await layoutGraphFromNotes(new Map(filas.map((f) => [f.nombre, { group: f.grupo, text: f.texto, mtime: f.actualizado }])), analizarEnlaces(filas).pares, { mtimeOf: (n) => n.mtime });
  assert.equal(JSON.stringify(a.links.length), JSON.stringify(directo.links.length));
});

test('recalcular: mueve las neuronas, deja el mapa limpio y coherente y NO toca ninguna nota; guarda el anterior', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro();
  await crearNota(m, 'Oferta de verano', 'Combos y precios.\n\n## Relacionadas\n\n- [[precios-webs]]\n');
  const antes = guardado(m), e0 = (await m.p.admin('GET', '/api/brain/actualizar')).j;
  assert.deepEqual(e0.mapaCompleto, { notas: m.fabrica.size + 1, tope: MAX_NOTAS_MAPA, puede: true, copia: null });
  const r = await m.p.admin('POST', '/api/brain/actualizar', { paso: 'mapa' });
  assert.equal(r.status, 200, r.texto); assert.equal(r.j.ok, true); assert.equal(r.j.motor, MOTOR); assert.equal(r.j.copia, true); assert.equal(r.j.notas, m.fabrica.size + 1);
  const despues = guardado(m); coherente(despues); coherente(r.j.graph);
  assert.equal(despues.nodes.find((n) => n.id === 'Oferta de verano').d, 1, 'la nota nueva entra conectada');
  assert.equal(despues.nodes.find((n) => n.id === 'precios-webs').d, antes.nodes.find((n) => n.id === 'precios-webs').d + 1);
  const pa = posiciones(antes), pd = posiciones(despues);
  assert.ok(Object.keys(pa).some((id) => pd[id] && (pa[id][0] !== pd[id][0] || pa[id][1] !== pd[id][1])), 'esta vez sí se reacomoda');
  assert.ok(m.semilla.notas.every((n) => textoEnDb(m, n.nombre) === n.texto), 'ninguna nota de fábrica cambió'); assert.match(textoEnDb(m, 'Oferta de verano'), /^Combos y precios\./);
  const e1 = (await m.p.admin('GET', '/api/brain/actualizar')).j;
  assert.equal(e1.limpieza.hay, false, 'el mapa nuevo ya está al día: ' + JSON.stringify(e1.limpieza)); assert.equal(e1.mapaCompleto.copia.por.length > 0, true);
  assert.equal(m.d1._db.prepare("select count(*) n from auditoria where tipo = 'cerebro'").get().n, 1);
});

test('volver al mapa anterior: las posiciones de antes vuelven exactas, las notas nuevas se acomodan sin mover nada, y solo se puede una vez', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro();
  const antes = guardado(m), pa = posiciones(antes);
  await m.p.admin('POST', '/api/brain/actualizar', { paso: 'mapa' });
  await crearNota(m, 'Nota de después', 'Habla de [[precios-webs]].'); // una nota que nace DESPUÉS del recálculo
  const d = await m.p.admin('POST', '/api/brain/actualizar', { paso: 'mapa-deshacer' });
  assert.equal(d.status, 200, d.texto); const g = d.j.graph; coherente(g);
  for (const n of antes.nodes) assert.deepEqual([g.nodes.find((x) => x.id === n.id).x, g.nodes.find((x) => x.id === n.id).y], pa[n.id], `«${n.id}» volvió a su sitio`);
  assert.equal(g.nodes.find((n) => n.id === 'Nota de después').d, 1, 'la nota de después sigue en el mapa, conectada');
  const otra = await m.p.admin('POST', '/api/brain/actualizar', { paso: 'mapa-deshacer' });
  assert.equal(otra.status, 409); assert.match(otra.j.error, /No hay un mapa anterior/);
  assert.equal((await m.p.admin('GET', '/api/brain/actualizar')).j.mapaCompleto.copia, null);
});

test('sin mapa guardado todavía: se crea uno, sin copia a la que volver', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro(); m.d1._db.prepare('delete from grafo').run();
  const r = await recalcularMapa({ db: m.d1, por: 'prueba' });
  assert.equal(r.ok, true); assert.equal(r.copia, false); coherente(guardado(m));
  assert.equal((await deshacerMapa({ db: m.d1 })).estado, 409);
});

test('el tope de notas se respeta con una explicación; sin notas no hay nada que dibujar', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro();
  const r = await recalcularMapa({ db: m.d1, tope: 10 });
  assert.equal(r.estado, 409); assert.match(r.error, /Son \d+ notas.*tope de 10/); assert.equal((await m.p.admin('GET', '/api/brain/actualizar')).j.mapaCompleto.puede, true);
  m.d1._db.prepare('delete from notas').run();
  assert.match((await recalcularMapa({ db: m.d1 })).error, /no hay notas/);
});

test('solo un administrador; y no más de 4 recálculos por minuto', { skip: SALTAR }, async () => {
  await sinCruzarMinuto(); // el tope cuenta por minuto del reloj: sin esto, si las llamadas cruzan el cambio de minuto, la última no da 429
  const m = await mundoDelCerebro();
  for (const rol of ['editor', 'lectura']) for (const paso of ['mapa', 'mapa-deshacer']) assert.equal((await m.p[rol]('POST', '/api/brain/actualizar', { paso })).status, 403, `${rol} ${paso}`);
  const estados = []; for (let i = 0; i < 5; i++) estados.push((await m.p.admin('POST', '/api/brain/actualizar', { paso: 'mapa' })).status);
  assert.deepEqual(estados, [200, 200, 200, 200, 429]);
});

test('las notas editadas que aún esperan a la IA siguen esperando después de recalcular el mapa', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro();
  await crearNota(m, 'Editada con enlaces', 'Mira [[precios-webs]] otra vez.');
  assert.ok((await m.p.admin('GET', '/api/brain/actualizar')).j.candidatas.some((c) => c.nombre === 'Editada con enlaces'));
  await m.p.admin('POST', '/api/brain/actualizar', { paso: 'mapa' });
  assert.ok((await m.p.admin('GET', '/api/brain/actualizar')).j.candidatas.some((c) => c.nombre === 'Editada con enlaces'), 'sigue en la cola de la IA');
});
