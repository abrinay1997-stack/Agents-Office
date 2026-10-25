import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { validarNotas, conNotasNuevas } from '../worker/lib/cerebro.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';

test('validarNotas rechaza nombres peligrosos y lotes enormes', () => {
  assert.equal(validarNotas([]).ok, false);
  for (const nombre of ['', '../x', 'a/b', '.oculta', 'a\\b']) assert.equal(validarNotas([{ nombre, texto: 'x' }]).ok, false, nombre);
  assert.equal(validarNotas(Array.from({ length: 201 }, (_, i) => ({ nombre: 'n' + i, texto: 'x' }))).ok, false);
  const v = validarNotas([{ nombre: 'oferta', grupo: '00-Empresa', texto: 'hola', actualizado: '1700000000000', oficina: 1 }]);
  assert.equal(v.ok, true); assert.equal(v.notas[0].oficina, 1); assert.equal(v.notas[0].actualizado, 1700000000000);
});

async function entrar(env, c) {
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: c.clave } });
  return r.headers.get('set-cookie').split(';')[0];
}
const NOTAS = [
  { nombre: 'oferta', grupo: '00-Empresa', texto: '---\nactualizado: 2026-10-01\n---\n# Oferta\nEl combo de lentes cuesta poco. Garantía de un año.', actualizado: 1790000000000 },
  { nombre: 'voz', grupo: '00-Empresa', texto: 'Hablamos de tú, con calidez.' },
  { nombre: '2026-10-25 entrega', grupo: 'Agents Office', oficina: 1, texto: '---\ntask: t1\nagent: elead\n---\nBorrador del correo.' },
];
const GRAFO = { notes: 3, nodes: [{ id: 'oferta', g: '00-Empresa', d: 1, x: 0.1, y: 0.2, t: 1 }], links: [], extra: [], floor: { r: 1 } };

test('el Cerebro en la nube: subir, mapa, búsqueda y lectura con la forma de la oficina local', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const admin = await sembrar(d1); const env = envDePrueba(d1); const ck = await entrar(env, admin);
  assert.equal((await pedir(manejar, env, '/api/brain')).status, 401);

  const vacio = await (await pedir(manejar, env, '/api/brain', { cookie: ck })).json();
  assert.deepEqual([vacio.nodes, vacio.learned, vacio.vacio], [[], { w: {}, links: [] }, true]); // sin mapa: vacío y marcado, para que la página no enseñe el de muestra

  const sub = await pedir(manejar, env, '/api/migrar/notas', { metodo: 'POST', cuerpo: { notas: NOTAS, grafo: GRAFO }, cookie: ck });
  assert.equal(sub.status, 200);
  assert.deepEqual(await sub.json(), { subidas: 3, grafo: true, notas: 3, deAgentes: 1 });
  // volver a subir no duplica
  const otra = await (await pedir(manejar, env, '/api/migrar/notas', { metodo: 'POST', cuerpo: { notas: NOTAS }, cookie: ck })).json();
  assert.equal(otra.notas, 3);

  const g = await (await pedir(manejar, env, '/api/brain', { cookie: ck })).json();
  assert.equal(g.nodes[0].id, 'oferta'); assert.deepEqual(g.learned, { w: {}, links: [] });

  const b = await (await pedir(manejar, env, '/api/brain/search?q=garantia', { cookie: ck })).json();
  assert.equal(b.total, 1); assert.equal(b.hits[0].name, 'oferta'); assert.match(b.hits[0].snippet, /Garantía/);
  assert.deepEqual(await (await pedir(manejar, env, '/api/brain/search?q=a', { cookie: ck })).json(), { q: 'a', hits: [] });

  const n = await (await pedir(manejar, env, '/api/note?id=oferta', { cookie: ck })).json();
  assert.deepEqual(Object.keys(n).sort(), ['cut', 'deletable', 'group', 'modified', 'name', 'size', 'text']);
  assert.equal(n.group, '00-Empresa'); assert.equal(n.modified, 1790000000000); assert.equal(n.deletable, false);
  const entrega = await (await pedir(manejar, env, '/api/note?id=' + encodeURIComponent('2026-10-25 entrega'), { cookie: ck })).json();
  assert.equal(entrega.deletable, true);
  const p = await (await pedir(manejar, env, '/api/note?peek=1&id=oferta', { cookie: ck })).json();
  assert.deepEqual(Object.keys(p).sort(), ['group', 'name', 'peek']); assert.ok(p.peek.length > 5);
  assert.equal((await pedir(manejar, env, '/api/note?id=nada', { cookie: ck })).status, 404);
});

test('solo un administrador sube el Cerebro; lo que aún no está portado dice 501 en español', { skip: SALTAR }, async () => {
  const d1 = crearD1(); await sembrar(d1); const ed = await sembrar(d1, { email: 'ed@x.test', rol: 'editor' }); const env = envDePrueba(d1);
  const ck = await entrar(env, ed);
  assert.equal((await pedir(manejar, env, '/api/migrar/notas', { metodo: 'POST', cuerpo: { notas: NOTAS }, cookie: ck })).status, 403);
  const r = await pedir(manejar, env, '/api/salvapantallas', { cookie: ck }); // (una ruta que ninguna fase ha portado)
  assert.equal(r.status, 501); const cuerpo = await r.json();
  assert.match(cuerpo.error, /todavía no está en la nube/); assert.equal(cuerpo.pendiente, true);
});

test('importación genérica de filas y documentos: solo admin, validada, idempotente', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const admin = await sembrar(d1); const ed = await sembrar(d1, { email: 'ed2@x.test', rol: 'editor' }); const env = envDePrueba(d1);
  const ck = await entrar(env, admin), ce = await entrar(env, ed);
  const filas = { coleccion: 'tareas', filas: [{ id: 't1', valor: { titulo: 'A' }, orden: 1 }, { id: 't2', valor: { titulo: 'B' } }] };
  assert.equal((await pedir(manejar, env, '/api/migrar/filas', { metodo: 'POST', cuerpo: filas, cookie: ce })).status, 403);
  assert.deepEqual(await (await pedir(manejar, env, '/api/migrar/filas', { metodo: 'POST', cuerpo: filas, cookie: ck })).json(), { subidas: 2, coleccion: 'tareas', total: 2 });
  assert.equal((await (await pedir(manejar, env, '/api/migrar/filas', { metodo: 'POST', cuerpo: filas, cookie: ck })).json()).total, 2); // repetir no duplica
  for (const malo of [{ coleccion: 'Mal Nombre', filas: filas.filas }, { coleccion: 'x', filas: [] }, { coleccion: 'tareas', filas: [{ id: '', valor: {} }] }, { coleccion: 'tareas', filas: [{ id: 'a', valor: 'texto' }] }])
    assert.equal((await pedir(manejar, env, '/api/migrar/filas', { metodo: 'POST', cuerpo: malo, cookie: ck })).status, 422);
  assert.deepEqual(await (await pedir(manejar, env, '/api/migrar/docs', { metodo: 'POST', cuerpo: { clave: 'kpis', valor: { a: 1 } }, cookie: ck })).json(), { clave: 'kpis', version: 1 });
  assert.equal((await pedir(manejar, env, '/api/migrar/docs', { metodo: 'POST', cuerpo: { clave: 'Mal', valor: {} }, cookie: ck })).status, 422);
});

test('conNotasNuevas: una nota que llegó después del mapa entra como neurona suelta sin mover los índices de los enlaces; la suelta que se borra se va', () => {
  const g = { notes: 3, nodes: [{ id: 'a', g: 'G', d: 1, x: 0.1, y: 0.2, t: 1 }, { id: 'b', g: 'G', d: 1, x: -0.1, y: 0.2, t: 1 }, { id: 'sola', g: 'G', d: 0, x: 1.1, y: 0, t: 1 }], links: [[0, 1]], extra: [], floor: [[0, 0], [1, 1]] };
  const fila = (nombre, extra = {}) => ({ nombre, grupo: 'Agents Office', actualizado: 1790000000000, cab: '', ...extra });
  assert.equal(conNotasNuevas(g, [fila('a'), fila('b'), fila('sola')]), g, 'sin novedades devuelve el mismo mapa');
  const n = conNotasNuevas(g, [fila('a'), fila('b'), fila('sola'), fila('entrega', { cab: '---\nagent: elead\ndepartment: emails\ndone: 2026-10-25T10:00:00Z\n---\n' })]);
  assert.deepEqual(n.nodes.slice(0, 2), g.nodes.slice(0, 2), 'los nodos con enlaces siguen en su sitio');
  assert.deepEqual(n.links, g.links); assert.deepEqual(n.floor, g.floor); assert.equal(n.notes, 4);
  const e = n.nodes.find((x) => x.id === 'entrega'); assert.deepEqual([e.d, e.a, e.dep, e.t], [0, 'elead', 'emails', Math.round(Date.parse('2026-10-25T10:00:00Z') / 1000)]); assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
  assert.ok(Math.hypot(e.x, e.y) > 1, 'en el anillo exterior');
  const m = conNotasNuevas(g, [fila('a'), fila('b')]); assert.deepEqual(m.nodes.map((x) => x.id), ['a', 'b'], 'la suelta borrada se va');
  assert.equal(conNotasNuevas(null, []), null); const solo = conNotasNuevas(null, [fila('x')]); assert.deepEqual([solo.nodes.length, solo.links], [1, []]);
});
