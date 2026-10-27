// 27 oct 2026 — ESCRIBIR en el Cerebro de la nube (pedido del dueño: «no puedo eliminar notas que yo he creado, ni editarlas; tengo que subir un documento»):
// crear, editar sin pisar a nadie, añadir, papelera de 30 días (con su poda) y vuelta; quién puede; el mapa sin la nota que se fue; y las dos acciones de Dimitri
// (una nota nueva y añadir a una que existe) con su DESHACER. Contra una D1 de verdad en memoria y el Worker entero.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, crearFetch, pagina, texto, filas } from './agentes-ayudas.mjs';
import { conNotasNuevas } from '../worker/lib/cerebro.js';
import { podar, RETENCION_DIAS } from '../worker/lib/mantenimiento.js';

const dimitri = (o) => texto(JSON.stringify({ mode: 'plan', ...o }));
async function mundo({ guion = [] } = {}) {
  const o = await oficina({ conector: false });
  const f = crearFetch({ guion }); o.env.__pruebas = { fetch: f.fetchFn };
  return { ...o, f, p: await pagina(o) };
}
const nota = (d1, nombre, texto0, grupo = '10-Business') => d1._db.prepare('insert into notas (nombre, grupo, oficina, texto, bytes, actualizado) values (?,?,?,?,?,?)').run(nombre, grupo, 0, texto0, texto0.length, 1000);
const leer = (m, n) => m.p.admin('GET', '/api/note?id=' + encodeURIComponent(n));

test('puro: sacar del mapa una nota CON enlaces rehace los índices de los enlaces y de las menciones; una suelta se va; una nueva entra al anillo', () => {
  const g = { notes: 4, nodes: [{ id: 'A', g: 'x', d: 2, x: 0, y: 0 }, { id: 'B', g: 'x', d: 2, x: 1, y: 0 }, { id: 'C', g: 'x', d: 1, x: 0, y: 1 }, { id: 'S', g: 'x', d: 0, x: 1.2, y: 0 }], links: [[0, 1], [1, 2], [0, 2]], extra: [[0, 1], [2, 3]], floor: [] };
  const f = (...n) => n.map((nombre) => ({ nombre, grupo: 'x', actualizado: 1, cab: '' }));
  assert.equal(conNotasNuevas(g, f('A', 'B', 'C', 'S')), g, 'nada que cambiar');
  const sinB = conNotasNuevas(g, f('A', 'C', 'S'));
  assert.deepEqual(sinB.nodes.map((n) => n.id), ['A', 'C', 'S']); assert.deepEqual(sinB.links, [[0, 1]], 'solo sobrevive el enlace A–C, con índices nuevos'); assert.deepEqual(sinB.extra, [], 'una mención que tocaba a B o a una suelta se va');
  const conNueva = conNotasNuevas(g, f('A', 'B', 'C', 'S', 'Nueva')); assert.equal(conNueva.nodes.at(-1).id === 'Nueva' || conNueva.nodes.some((n) => n.id === 'Nueva'), true); assert.deepEqual(conNueva.links, g.links);
});

test('escribir: crear, ver, editar, añadir; no pisa lo que otra persona cambió; nombres válidos; un lector no escribe', { skip: SALTAR }, async () => {
  const m = await mundo();
  let r = await m.p.admin('POST', '/api/note', { name: 'Ideas de octubre', text: '# Ideas\n\nUna.', group: 'Marketing' }); assert.equal(r.status, 200, r.texto);
  assert.ok(r.j.graph.nodes.some((n) => n.id === 'Ideas de octubre' && n.g === 'Marketing'), 'ya está en el mapa'); const m0 = r.j.modified;
  assert.equal((await m.p.editor('POST', '/api/note', { name: 'ideas DE octubre', text: 'x' })).status, 409, 'ni con otras mayúsculas'); assert.equal((await m.p.admin('POST', '/api/note', { name: 'a/b', text: 'x' })).status, 400); assert.equal((await m.p.admin('POST', '/api/note', { name: 'x', text: 'y', group: '../..' })).status, 400);
  assert.equal((await m.p.lectura('POST', '/api/note', { name: 'Intento', text: 'x' })).status, 403, 'un lector solo mira'); assert.equal((await m.p.lectura('PUT', '/api/note', { name: 'Ideas de octubre', text: 'x' })).status, 403); assert.equal((await m.p.lectura('POST', '/api/note/trash', { id: 'Ideas de octubre' })).status, 403);
  r = await leer(m, 'Ideas de octubre'); assert.deepEqual([r.j.editable, r.j.deletable, r.j.group], [true, true, 'Marketing']); assert.equal(r.j.modified, m0);
  r = await m.p.editor('PUT', '/api/note', { name: 'Ideas de octubre', text: '# Ideas\n\nDos.', base: m0 }); assert.equal(r.status, 200, r.texto); assert.ok(r.j.modified > m0);
  r = await m.p.admin('PUT', '/api/note', { name: 'Ideas de octubre', text: 'mi cambio', base: m0 }); assert.equal(r.status, 409, 'su `base` ya es vieja'); assert.match(r.j.error, /Otra persona cambió/); assert.match((await leer(m, 'Ideas de octubre')).j.text, /Dos\./);
  assert.equal((await m.p.admin('PUT', '/api/note', { name: 'Ideas de octubre', text: '   ' })).status, 413); assert.equal((await m.p.admin('PUT', '/api/note', { name: 'No existe', text: 'x' })).status, 404);
  r = await m.p.admin('POST', '/api/note/append', { name: 'Ideas de octubre', text: 'Tres.', section: 'Nuevas' }); assert.equal(r.status, 200, r.texto); assert.match((await leer(m, 'Ideas de octubre')).j.text, /Dos\.\n\n## Nuevas\n\nTres\.\n$/);
  assert.equal(filas(m.d1, "select count(*) n from auditoria where tipo = 'nota'")[0].n, 3, 'crear, editar y añadir quedan en la auditoría');
});

test('papelera: cualquier nota se va del mapa y de la búsqueda, se recupera 30 días (con -2 si su nombre ya se usó) y la poda la limpia', { skip: SALTAR }, async () => {
  const m = await mundo(); nota(m.d1, 'precios', '# Precios\nEl combo vale 10.', '10-Business');
  assert.equal((await m.p.admin('GET', '/api/brain/search?q=combo')).j.hits.length, 1);
  let r = await m.p.editor('POST', '/api/note/trash', { id: 'precios' }); assert.equal(r.status, 200, r.texto); assert.ok(!r.j.graph.nodes.some((n) => n.id === 'precios')); const id = r.j.trashed;
  assert.equal((await leer(m, 'precios')).status, 404); assert.equal((await m.p.admin('GET', '/api/brain/search?q=combo')).j.hits.length, 0, 'los agentes y la búsqueda ya no la ven');
  let bin = (await m.p.admin('GET', '/api/note/trash')).j; assert.deepEqual(bin.items.map((i) => i.name), ['precios']); assert.equal(bin.keepDays, 30);
  await m.p.admin('POST', '/api/note', { name: 'precios', text: 'una nueva con el mismo nombre' });
  r = await m.p.admin('POST', '/api/note/restore', { file: id }); assert.equal(r.status, 200, r.texto); assert.equal(r.j.name, 'precios-2'); assert.match((await leer(m, 'precios-2')).j.text, /El combo vale 10/); assert.equal((await leer(m, 'precios-2')).j.group, '10-Business');
  assert.equal((await m.p.admin('POST', '/api/note/restore', { file: id })).status, 404, 'ya no está en la papelera'); assert.equal((await m.p.admin('POST', '/api/note/trash', { id: 'nunca-existió' })).status, 404);
  await m.p.admin('POST', '/api/note/trash', { id: 'precios-2' });
  m.d1._db.prepare('update notas_papelera set borrada = ?').run(Date.now() - 31 * 864e5);
  const n = await podar(m.d1); assert.equal(n.notas_papelera, 1, 'a los 30 días se borra sola'); assert.equal(RETENCION_DIAS.notas_papelera, 30); assert.equal((await m.p.admin('GET', '/api/note/trash')).j.items.length, 0);
});

test('Dimitri: nota_crear y nota_agregar esperan el clic, se hacen con la sesión del dueño y se deshacen; el nombre tiene que ser exacto', { skip: SALTAR }, async () => {
  const plan = { reply: 'Te dejo la nota y le sumo lo del combo.', ops: [{ type: 'nota_crear', nombre: 'Reunión del lunes', texto: '# Reunión\n\nSe decidió abrir sábados.', grupo: 'Reuniones' }, { type: 'nota_agregar', nombre: 'PRECIOS', texto: 'El combo 2x1 vale 15.', seccion: 'Combos' }, { type: 'nota_agregar', nombre: 'No existe', texto: 'x' }] };
  const m = await mundo({ guion: [dimitri(plan)] }); nota(m.d1, 'precios', '# Precios\n\nLista.', '10-Business');
  const c = await m.p.admin('POST', '/api/sub/chat', { text: 'Anota la reunión y suma lo del combo a precios' }); assert.equal(c.status, 200, c.texto);
  const msg = c.j.messages.find((x) => x.who === 'sub'); assert.deepEqual(msg.ops.map((o) => [o.type, o.nombre]), [['nota_crear', 'Reunión del lunes'], ['nota_agregar', 'precios']], 'el inexistente se descartó'); assert.match(msg.text, /no hay una nota llamada «No existe»/);
  assert.equal(filas(m.d1, "select count(*) n from notas where nombre = 'Reunión del lunes'")[0].n, 0, 'proponer no escribe nada');
  const h = await m.p.admin('POST', '/api/sub/ops', { msg: msg.id, items: [{ k: 0, include: true }, { k: 1, include: true }] }); assert.equal(h.status, 200, h.texto);
  assert.deepEqual(h.j.message.ops.map((o) => o.state), ['done', 'done']);
  assert.equal((await leer(m, 'Reunión del lunes')).j.group, 'Reuniones'); assert.match((await leer(m, 'precios')).j.text, /Lista\.\n\n## Combos\n\nEl combo 2x1 vale 15\.\n$/);
  assert.equal((await m.p.admin('POST', '/api/sub/ops/undo', { msg: msg.id, k: 1 })).status, 200); assert.equal((await leer(m, 'precios')).j.text.trim(), '# Precios\n\nLista.', 'quita lo añadido y el título que creó');
  assert.equal((await m.p.admin('POST', '/api/sub/ops/undo', { msg: msg.id, k: 0 })).status, 200); assert.equal((await leer(m, 'Reunión del lunes')).status, 404); assert.equal((await m.p.admin('GET', '/api/note/trash')).j.items.some((i) => i.name === 'Reunión del lunes'), true, 'deshacer = a la papelera, nunca se pierde');
});
