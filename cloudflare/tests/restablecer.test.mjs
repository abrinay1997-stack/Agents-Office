// «Restablecer oficina» en la nube (parte C): vacía o PanaClaw por defecto, con confirmación en dos pasos, respaldo de 7 días, solo el administrador, sin tocar personas, llaves, conectores ni auditoría.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALTAR } from './d1-memoria.mjs';
import { oficina6, filas, dimitriDice } from './fase6-ayudas.mjs';
import { semillaEnDisco, assetsDe } from './semilla-ayudas.mjs';
import { guardarNotas } from '../worker/lib/cerebro.js';
import { guardarDoc, guardarFila } from '../worker/lib/almacen.js';
import { DESTINOS, CONSERVA_TABLAS, CONSERVA_DOCS, CONSERVA_PREFIJOS_DOCS, CONSERVA_FILAS, purgarVencidos, DOC_RESPALDOS } from '../worker/lib/restablecer.js';
import { IDS_AMBITOS, POR_DEFECTO, PALABRA } from '../../restablecer-core.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url)), WORKER = join(AQUI, '..', 'worker'), MIG = join(AQUI, '..', 'migraciones');

/* ---------- que nada nuevo quede sin decidir ---------- */
const todosLosDestinos = () => ({
  tablas: new Set([...Object.values(DESTINOS).flatMap((d) => d.tablas || []), ...CONSERVA_TABLAS]),
  docs: new Set([...Object.values(DESTINOS).flatMap((d) => d.docs || []), ...CONSERVA_DOCS]),
  prefijosDocs: [...Object.values(DESTINOS).flatMap((d) => d.prefijosDocs || []), ...CONSERVA_PREFIJOS_DOCS],
  filas: new Set([...Object.values(DESTINOS).flatMap((d) => d.filas || []), ...CONSERVA_FILAS]),
  prefijosFilas: Object.values(DESTINOS).flatMap((d) => d.prefijosFilas || []),
});
const fuentes = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? fuentes(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []);

test('CLASIFICACIÓN: toda tabla de D1, toda clave de `docs` y toda colección de `filas` está decidida (se restablece con un ámbito o se conserva); lo nuevo obliga a decidir', () => {
  const d = todosLosDestinos();
  const tablas = readdirSync(MIG).filter((f) => f.endsWith('.sql')).flatMap((f) => [...readFileSync(join(MIG, f), 'utf8').matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]));
  const sinDecidir = tablas.filter((t) => !d.tablas.has(t) && !['users'].includes(t) && !Object.values(DESTINOS).some((x) => (x.tablas || []).includes(t)));
  assert.deepEqual(sinDecidir, [], 'tablas sin decidir: ' + sinDecidir.join());
  const codigo = fuentes(WORKER).filter((f) => !/restablecer\.js$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
  // claves de docs: literales pasados a leerDoc/guardarDoc/mutarDoc y constantes DOC_*/CLAVE_*
  const claves = new Set([...codigo.matchAll(/(?:leerDoc|guardarDoc|mutarDoc)\(\s*\w+(?:\.\w+)?,\s*'([^']+)'/g)].map((m) => m[1]), [...codigo.matchAll(/(?:DOC_[A-Z_]+|CLAVE_CONFIG)\s*=\s*'([^']+)'/g)].map((m) => m[1]));
  const docSinDecidir = [...claves].filter((c) => !d.docs.has(c) && !d.prefijosDocs.some((p) => c.startsWith(p)));
  assert.deepEqual(docSinDecidir, [], 'claves de docs sin decidir: ' + docSinDecidir.join());
  const colecciones = new Set([...codigo.matchAll(/(?:listarFilas|guardarFila|guardarFilas|leerFila|borrarFila|contarFilas)\(\s*\w+,\s*'([^']+)'/g)].map((m) => m[1]), [...codigo.matchAll(/coleccion = '([^']+)'/g)].map((m) => m[1]), [...codigo.matchAll(/(?:COLECCION|COL|COL_HILO|TAREAS)\s*=\s*'([^']+)'/g)].map((m) => m[1]));
  const filaSinDecidir = [...colecciones].filter((c) => !d.filas.has(c) && !d.prefijosFilas.some((p) => c.startsWith(p)));
  assert.deepEqual(filaSinDecidir, [], 'colecciones de filas sin decidir: ' + filaSinDecidir.join());
  // y lo que se restablece nunca incluye lo que debe conservarse
  for (const t of Object.values(DESTINOS).flatMap((x) => x.tablas || [])) assert.ok(!CONSERVA_TABLAS.includes(t), t);
  for (const t of ['users', 'sessions', 'conectores', 'auditoria', 'auditoria_agentes', 'costos', 'perfiles']) assert.ok(!Object.values(DESTINOS).some((x) => (x.tablas || []).includes(t)), t + ' no se restablece NUNCA');
});

/* ---------- una oficina llena ---------- */
async function oficinaLlena({ semilla = true } = {}) {
  const { dir } = await semillaEnDisco();
  const o = await oficina6({ extraEnv: semilla ? { ASSETS: assetsDe(dir) } : {} }), d1 = o.d1;
  await guardarNotas(d1, [{ nombre: 'mi-nota', grupo: '10-Business', oficina: 0, texto: '# Mi nota\nUS$ 450', actualizado: 5, tarea: null }, { nombre: 'entrega-x', grupo: 'Agents Office', oficina: 1, texto: 'entrega', actualizado: 5, tarea: 't1' }]);
  d1._db.prepare("insert into grafo (id, json, notas, calculado) values (1, ?, 2, 'x')").run(JSON.stringify({ notes: 2, nodes: [], links: [] }));
  for (const [col, id] of [['tareas', 't1'], ['tareas', 't2'], ['tareas-archivo', 't0'], ['rutinas', 'mi-rutina'], ['skills', 'mi-skill'], ['biblioteca', 'mi-hab'], ['subgerente', 'm1'], ['subgerente', 'm2'], ['subgerente-hilo', 'actual'], ['subgerente-arch:c1', 'm1'], ['estudio-fichas', 'f1']]) await guardarFila(d1, col, id, { id, texto: 'x ' + col });
  for (const [k, v] of [['cifras', { items: [{ name: 'Precio', value: '450' }] }], ['cifras.porconfirmar', { items: [{ name: 'Otro', value: '1' }] }], ['kpis', { defs: [{ id: 'leads' }], values: {} }], ['agentes.local', { agents: [{ id: 'lexi', brief: 'mío' }] }], ['memoria', { notes: { 'mi-nota': 1 } }],
    ['feedback.lexi', { rules: ['sé breve'], oneOffs: [] }], ['ejemplos.lexi', { items: [] }], ['tareas.proyectos', { lista: [] }], ['subgerente.archivo', { lista: [] }], ['rutinas.estado', { x: 1 }], ['estudio.rev', { n: 3 }], ['estudio.carpetas', { c: [] }], ['arranque.propuesta', { id: 'p1' }],
    // lo que NO se toca:
    ['ajustes', { name: 'Mi Empresa', approvals: { amountLimit: 777 } }], ['tareas.config', { team: { people: [{ name: 'Ana' }] } }], ['triggers', { lista: [{ id: 'h1' }] }], ['meta.freno', { hasta: 0 }], ['fs:data/anuncios/cuenta.json', { t: '{"id":"act_1"}' }], ['estudio.uso', { dia: 3 }], ['config-local', { zona: 'America/Panama' }]]) await guardarDoc(d1, k, v);
  await guardarFila(d1, 'avisos', 'a1', { id: 'a1', text: 'un aviso' });
  d1._db.prepare("insert into tarea_bitacora (t, tarea, json) values (1, 't1', '{}')").run();
  d1._db.prepare("insert into estudio_archivos (file, at, kind, json) values ('2026-10/a.png', 1, 'image', '{}')").run();
  await o.env.MEDIA.put('2026-10/a.png', new Uint8Array([1, 2, 3]));
  d1._db.prepare("insert into contenido_piezas (id, fecha, estado, json, creada, actualizada) values ('p-1', '2026-10-30', 'borrador', '{}', 'x', 'x')").run();
  d1._db.prepare("insert into contenido_dias (id, mes, json) values ('c|2026-10-01', '2026-10', '{}')").run();
  d1._db.prepare("insert into conectores (id, nombre, url, secreto, created_at) values ('1', 'gmail', 'https://x.example/mcp', 'MCP_GMAIL_TOKEN', 'x')").run();
  d1._db.prepare("insert into auditoria (at, tipo, quien, detalle) values ('2026-10-01', 'prueba', 'yo', '{}')").run();
  d1._db.prepare("insert into costos (t, usd) values (1, 0.5)").run();
  return o;
}
const n = (d1, sql) => d1._db.prepare(sql).get().n;
const estadoDe = (d1) => ({
  notas: n(d1, 'select count(*) n from notas'), grafo: n(d1, 'select count(*) n from grafo'), tareas: n(d1, "select count(*) n from filas where coleccion in ('tareas','tareas-archivo')"), rutinas: n(d1, "select count(*) n from filas where coleccion = 'rutinas'"),
  skills: n(d1, "select count(*) n from filas where coleccion in ('skills','biblioteca')"), dimitri: n(d1, "select count(*) n from filas where coleccion like 'subgerente%'"), estudio: n(d1, 'select count(*) n from estudio_archivos'), contenido: n(d1, 'select count(*) n from contenido_piezas'),
  cifras: n(d1, "select count(*) n from docs where clave like 'cifras%'"), kpis: n(d1, "select count(*) n from docs where clave in ('kpis')"), aprendido: n(d1, "select count(*) n from docs where clave like 'feedback.%' or clave like 'ejemplos.%'"), bitacora: n(d1, 'select count(*) n from tarea_bitacora'),
});
const CONSERVADO = (d1) => JSON.stringify({
  users: d1._db.prepare('select id, email, rol, password_hash, salt from users order by id').all(), conectores: d1._db.prepare('select * from conectores').all(), costos: n(d1, 'select count(*) n from costos'),
  auditoria: n(d1, "select count(*) n from auditoria where tipo = 'prueba'"), docs: d1._db.prepare("select clave, json from docs where clave in ('ajustes','tareas.config','triggers','meta.freno','estudio.uso','config-local') or clave like 'fs:%' order by clave").all(),
  avisos: n(d1, "select count(*) n from filas where coleccion = 'avisos' and json not like '%restablec%'"), dias: n(d1, 'select count(*) n from contenido_dias'),
});

async function restablecer(o, modo, ambitos, { quien = 'admin' } = {}) {
  const p1 = await o[quien]('POST', '/api/restablecer', { modo, ambitos });
  if (p1.status !== 200) return { p1 };
  const p2 = await o[quien]('POST', '/api/restablecer/confirmar', { token: p1.j.pendiente.token, escribio: PALABRA });
  return { p1, p2 };
}

test('VACÍA: con todo marcado deja en blanco lo de la empresa y NO toca personas, llaves, conectores, auditoría, ajustes ni lo de Meta', { skip: SALTAR }, async () => {
  const o = await oficinaLlena(), conservado = CONSERVADO(o.d1);
  const antes = estadoDe(o.d1); assert.ok(Object.values(antes).every((v) => v > 0), JSON.stringify(antes));
  const { p1, p2 } = await restablecer(o, 'vacia', IDS_AMBITOS);
  assert.equal(p1.status, 200, p1.texto); assert.equal(p2.status, 200, p2.texto); assert.equal(p2.j.ok, true);
  assert.ok(p1.j.pendiente.resumen.length === IDS_AMBITOS.length && p1.j.pendiente.resumen.every((r) => r.texto.includes('queda en blanco')));
  assert.deepEqual(estadoDe(o.d1), Object.fromEntries(Object.keys(antes).map((k) => [k, 0])), 'todo en blanco');
  assert.equal(CONSERVADO(o.d1), conservado, 'lo que no se toca quedó idéntico (usuarios con sus hashes, conectores, costos, auditoría, ajustes, Meta, avisos)');
  const aud = filas(o.d1, "select quien, detalle from auditoria where tipo = 'restablecer'"); assert.equal(aud.length, 1); assert.equal(aud[0].quien, 'dueno@panaclaw.test'); assert.equal(JSON.parse(aud[0].detalle).respaldo, p2.j.respaldo.id);
  // la oficina sigue sana: el Cerebro vacío se pinta como vacío, el chat de Dimitri está en blanco, y las 50 habilidades de marketing siguen (son del producto)
  assert.equal((await o.admin('GET', '/api/brain')).j.vacio, true);
  assert.equal((await o.admin('GET', '/api/cifras')).j.items.length, 0);
  assert.equal((await o.admin('GET', '/api/tasks')).j.tasks?.length ?? (await o.admin('GET', '/api/tasks')).j.length ?? 0, 0);
  assert.equal(filas(o.d1, "select count(*) n from notas where nombre like '%backup%'")[0].n, 0);
});

test('LA CONFIRMACIÓN ES DE DOS PASOS: sin palabra, con otra clave, caducada o repetida no restablece nada; y la clave es de un solo uso', { skip: SALTAR }, async () => {
  const o = await oficinaLlena(), antes = estadoDe(o.d1);
  const sin = await o.admin('POST', '/api/restablecer/confirmar', { token: 'x', escribio: PALABRA }); assert.equal(sin.status, 409); assert.match(sin.j.error, /revisa lo que va a pasar/i);
  const p1 = await o.admin('POST', '/api/restablecer', { modo: 'vacia', ambitos: ['cerebro'] }); assert.equal(p1.status, 200);
  assert.deepEqual(estadoDe(o.d1), antes, 'pedir no cambia nada');
  for (const malo of ['restablecer', 'Restablecer', 'RESTABLECE', '', ' SI ']) assert.equal((await o.admin('POST', '/api/restablecer/confirmar', { token: p1.j.pendiente.token, escribio: malo })).status, 409, malo);
  assert.equal((await o.admin('POST', '/api/restablecer/confirmar', { token: 'otra', escribio: PALABRA })).status, 409);
  assert.deepEqual(estadoDe(o.d1), antes);
  // caduca a los 2 minutos
  const paso = JSON.parse(filas(o.d1, "select json from docs where clave = 'restablecer.paso'")[0].json); paso.vence = Date.now() - 1; o.d1._db.prepare("update docs set json = ? where clave = 'restablecer.paso'").run(JSON.stringify(paso)); // secrets-ok
  const tarde = await o.admin('POST', '/api/restablecer/confirmar', { token: p1.j.pendiente.token, escribio: PALABRA }); assert.equal(tarde.status, 409); assert.match(tarde.j.error, /caducó/);
  // de un solo uso, aunque lleguen dos a la vez
  const p2 = await o.admin('POST', '/api/restablecer', { modo: 'vacia', ambitos: ['cerebro'] });
  // una barrera: las dos peticiones LEEN la clave antes de que ninguna la quite (la carrera de verdad); solo la que consiga quitarla restablece
  const real = o.env.DB; let llegaron = 0, abrir; const barrera = new Promise((r) => { abrir = r; });
  o.env.DB = { ...real, prepare: (sql) => { const st = real.prepare(sql); return { ...st, bind: (...a) => { const b = st.bind(...a); return /select json, version from docs where clave = \?/.test(sql) && a[0] === 'restablecer.paso' ? { ...b, first: async () => { const r = await b.first(); if (++llegaron === 2) abrir(); if (llegaron <= 2) await barrera; return r; } } : b; } }; } };
  const [a, b] = await Promise.all([1, 2].map(() => o.admin('POST', '/api/restablecer/confirmar', { token: p2.j.pendiente.token, escribio: PALABRA })));
  o.env.DB = real;
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(filas(o.d1, "select count(*) n from auditoria where tipo = 'restablecer'")[0].n, 1, 'una sola vez');
  assert.equal((await o.admin('POST', '/api/restablecer/confirmar', { token: p2.j.pendiente.token, escribio: PALABRA })).status, 409);
});

test('RESPALDO: antes de tocar nada se guarda; «Restaurar» lo devuelve IDÉNTICO; restaurar también se puede deshacer; a los 7 días se borra (y los archivos del Estudio con él)', { skip: SALTAR }, async () => {
  const o = await oficinaLlena();
  const foto = () => JSON.stringify({ e: estadoDe(o.d1), notas: o.d1._db.prepare('select * from notas order by nombre').all(), filas: o.d1._db.prepare("select * from filas where coleccion != 'avisos' order by coleccion, id").all(), docs: o.d1._db.prepare("select clave, json from docs where clave not like 'restablecer.%' order by clave").all(), piezas: o.d1._db.prepare('select * from contenido_piezas').all(), arch: o.d1._db.prepare('select * from estudio_archivos').all(), bit: o.d1._db.prepare('select * from tarea_bitacora').all() });
  const antes = foto();
  const { p2 } = await restablecer(o, 'vacia', IDS_AMBITOS); assert.equal(p2.status, 200);
  const id = p2.j.respaldo.id;
  assert.ok(o.env.MEDIA._m.has(`respaldos/${id}.json.gz`), 'el respaldo está en R2, comprimido');
  const est = (await o.admin('GET', '/api/restablecer')).j; assert.equal(est.respaldos.length, 1); assert.equal(est.respaldos[0].id, id); assert.ok(est.respaldos[0].vence - est.respaldos[0].at >= 7 * 864e5 - 1000);
  assert.notEqual(foto(), antes);
  const r = await o.admin('POST', '/api/restablecer/deshacer', { id }); assert.equal(r.status, 200, r.texto);
  const despues = JSON.parse(foto()), orig = JSON.parse(antes);
  for (const k of Object.keys(orig)) assert.deepEqual(despues[k], orig[k], 'volvió igual: ' + k);
  assert.equal((await o.admin('GET', '/api/restablecer')).j.respaldos.length, 2, 'restaurar guardó antes el estado de ese momento: también se puede deshacer');
  // ¿y si se vuelve a vaciar y a restaurar? Sigue idéntico
  await restablecer(o, 'vacia', IDS_AMBITOS); const ult = (await o.admin('GET', '/api/restablecer')).j.respaldos[0];
  assert.equal((await o.admin('POST', '/api/restablecer/deshacer', { id: ult.id })).status, 200); assert.deepEqual(JSON.parse(foto()), orig);
  assert.equal((await o.admin('POST', '/api/restablecer/deshacer', { id: 'noexiste' })).status, 404);
  // vencen: se borran el archivo del respaldo y los archivos del Estudio que ya nadie usa
  await restablecer(o, 'vacia', ['estudio']);
  assert.ok(o.env.MEDIA._m.has('2026-10/a.png'), 'el archivo del Estudio sigue en R2 durante los 7 días');
  const lista = JSON.parse(filas(o.d1, "select json from docs where clave = 'restablecer.respaldos'")[0].json).lista; const ultimo = lista[0]; // secrets-ok
  assert.equal(await purgarVencidos(o.env, o.d1, Date.now() + 6 * 864e5), 0, 'a los 6 días aún no');
  assert.equal(await purgarVencidos(o.env, o.d1, Date.now() + 8 * 864e5), lista.length, 'a los 8 días todos');
  assert.ok(!o.env.MEDIA._m.has('2026-10/a.png'), 'el archivo del Estudio se borró con su respaldo'); assert.ok(!o.env.MEDIA._m.has(`respaldos/${ultimo.id}.json.gz`));
  assert.equal((await o.admin('POST', '/api/restablecer/deshacer', { id: ultimo.id })).status, 404);
});

test('PANACLAW POR DEFECTO: carga las 59 notas con su mapa, las skills y la Biblioteca de marketing; por defecto solo «Cerebro» y «Habilidades»', { skip: SALTAR }, async () => {
  const o = await oficinaLlena();
  assert.deepEqual(POR_DEFECTO.panaclaw, ['cerebro', 'habilidades']); assert.equal(POR_DEFECTO.vacia.length, IDS_AMBITOS.length);
  const est = (await o.admin('GET', '/api/restablecer')).j; assert.equal(est.semilla.notas, 59); assert.ok(est.modos.every((m) => m.disponible !== false));
  const tareas = estadoDe(o.d1).tareas;
  const { p2 } = await restablecer(o, 'panaclaw', POR_DEFECTO.panaclaw); assert.equal(p2.status, 200, p2.texto);
  assert.equal(n(o.d1, 'select count(*) n from notas'), 59); assert.equal(n(o.d1, "select count(*) n from notas where oficina = 0 and nombre = 'mi-nota'"), 0, 'tus notas se fueron (quedan en el respaldo)');
  const g = (await o.admin('GET', '/api/brain')).j; assert.equal(g.notes, 59); assert.equal(g.nodes.length, 59); assert.ok(g.links.length > 100, 'el mapa de fábrica ya viene calculado'); assert.ok(!g.vacio);
  assert.ok(n(o.d1, "select count(*) n from filas where coleccion = 'skills'") >= 15); assert.equal(n(o.d1, "select count(*) n from filas where coleccion = 'biblioteca'"), 0);
  assert.equal(estadoDe(o.d1).tareas, tareas, 'las tareas no se tocan en este modo por defecto'); assert.equal(estadoDe(o.d1).dimitri > 0, true);
  const nota = (await o.admin('GET', '/api/note?id=precios-webs')).j; assert.match(nota.text, /\$\d/);
  assert.equal(n(o.d1, "select count(*) n from notas where texto like '%Agents Office/%entrega%'"), 0);
  // la Biblioteca de marketing sigue entera (es del producto) y los agentes reciben las skills de fábrica
  assert.equal((await o.admin('GET', '/api/biblioteca')).j.total, 50);
  assert.ok((await o.admin('GET', '/api/agents/lexi')).j.skills.length >= 1);
  // con el equipo y las rutinas de fábrica también
  const seg = await restablecer(o, 'panaclaw', ['equipo', 'rutinas']); assert.equal(seg.p2.status, 200);
  assert.ok(n(o.d1, "select count(*) n from filas where coleccion = 'rutinas'") >= 2); assert.equal(n(o.d1, "select count(*) n from docs where clave = 'agentes.cerebro'"), 1); assert.equal(n(o.d1, "select count(*) n from docs where clave = 'agentes.local'"), 0); // secrets-ok
  assert.equal((await o.admin('GET', '/api/agents')).j.agents.find((a) => a.id === 'lexi').name, 'LÍDER VENTAS', 'el equipo de PanaClaw');
  // y es idempotente: repetirlo deja lo mismo
  const copia = JSON.stringify(o.d1._db.prepare('select nombre, texto from notas order by nombre').all());
  await restablecer(o, 'panaclaw', POR_DEFECTO.panaclaw); assert.equal(JSON.stringify(o.d1._db.prepare('select nombre, texto from notas order by nombre').all()), copia);
});

test('SIN SEMILLA no se quita nada: «PanaClaw por defecto» se dice no disponible y, si falta al confirmar, todo queda como estaba', { skip: SALTAR }, async () => {
  const o = await oficinaLlena({ semilla: false }), antes = estadoDe(o.d1);
  const est = (await o.admin('GET', '/api/restablecer')).j; assert.equal(est.semilla, null); assert.equal(est.modos.find((m) => m.id === 'panaclaw').disponible, false); assert.equal(est.modos.find((m) => m.id === 'vacia').disponible, undefined);
  const p = await o.admin('POST', '/api/restablecer', { modo: 'panaclaw', ambitos: ['cerebro'] }); assert.equal(p.status, 409);
  assert.deepEqual(estadoDe(o.d1), antes);
  // la semilla desaparece entre el paso 1 y el 2
  const { dir } = await semillaEnDisco(); let hay = true; const buena = assetsDe(dir); o.env.ASSETS = { fetch: async (r) => (hay ? buena.fetch(r) : new Response('no', { status: 404 })) };
  const p1 = await o.admin('POST', '/api/restablecer', { modo: 'panaclaw', ambitos: ['cerebro'] }); assert.equal(p1.status, 200); hay = false;
  const p2 = await o.admin('POST', '/api/restablecer/confirmar', { token: p1.j.pendiente.token, escribio: PALABRA }); assert.ok(p2.status >= 400); assert.deepEqual(estadoDe(o.d1), antes, 'no se quitó nada');
  assert.equal(filas(o.d1, "select count(*) n from docs where clave = 'restablecer.respaldos'")[0].n, 0, 'ni se creó un respaldo vacío'); // secrets-ok
});

test('SEGURIDAD: solo el administrador (también para mirar); pedidos mal armados se rechazan; el respaldo no lleva usuarios, hashes, sesiones ni llaves', { skip: SALTAR }, async () => {
  const o = await oficinaLlena(), antes = estadoDe(o.d1);
  for (const quien of ['editor', 'lectura']) for (const [m, r, c] of [['GET', '/api/restablecer'], ['POST', '/api/restablecer', { modo: 'vacia', ambitos: ['cerebro'] }], ['POST', '/api/restablecer/confirmar', { token: 'x', escribio: PALABRA }], ['POST', '/api/restablecer/deshacer', { id: 'x' }]]) assert.equal((await o[quien](m, r, c)).status, 403, `${quien} ${m} ${r}`);
  assert.equal((await o.anon('GET', '/api/restablecer')).status, 401); assert.equal((await o.anon('POST', '/api/restablecer', { modo: 'vacia', ambitos: ['cerebro'] })).status, 401);
  assert.deepEqual(estadoDe(o.d1), antes);
  for (const mal of [{}, { modo: 'otra', ambitos: ['cerebro'] }, { modo: 'vacia' }, { modo: 'vacia', ambitos: [] }, { modo: 'vacia', ambitos: ['users'] }, { modo: 'vacia', ambitos: ['cerebro', 'conectores'] }, { modo: 'vacia', ambitos: 'cerebro' }, { modo: 'vacia', ambitos: ['../etc'] }]) assert.equal((await o.admin('POST', '/api/restablecer', mal)).status, 400, JSON.stringify(mal));
  await restablecer(o, 'vacia', IDS_AMBITOS);
  const id = (await o.admin('GET', '/api/restablecer')).j.respaldos[0].id, gz = o.env.MEDIA._m.get(`respaldos/${id}.json.gz`).buf;
  const texto = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  for (const prohibido of ['password_hash', 'salt', 'token_hash', 'dueno@panaclaw.test', 'MCP_GMAIL_TOKEN', 'sk-ant', 'conectores', 'sessions']) assert.ok(!texto.includes(prohibido), 'el respaldo no debe llevar «' + prohibido + '»');
  assert.ok(texto.includes('mi-nota'), 'pero sí lo de la empresa');
});

test('ATÓMICO Y BARATO: todo en un lote de D1 (si falla, no cambia nada) y pocas sentencias (cabe en el plan gratuito)', { skip: SALTAR }, async () => {
  const o = await oficinaLlena({ semilla: true }), antes = estadoDe(o.d1);
  const real = o.d1.batch; let lotes = 0, prepares = 0;
  const prep = o.d1.prepare; o.d1.prepare = (sql) => { prepares++; return prep(sql); };
  o.d1.batch = async (l) => { lotes++; throw new Error('D1 se cayó a mitad'); };
  const p1 = await o.admin('POST', '/api/restablecer', { modo: 'vacia', ambitos: IDS_AMBITOS });
  const p2 = await o.admin('POST', '/api/restablecer/confirmar', { token: p1.j.pendiente.token, escribio: PALABRA }); assert.equal(p2.status, 500); assert.match(p2.j.error, /no cambió nada/); assert.equal(lotes, 1, 'un solo lote');
  assert.deepEqual(estadoDe(o.d1), antes);
  o.d1.batch = real; prepares = 0;
  const q1 = await o.admin('POST', '/api/restablecer', { modo: 'panaclaw', ambitos: IDS_AMBITOS }), antesPrep = prepares; prepares = 0;
  const q2 = await o.admin('POST', '/api/restablecer/confirmar', { token: q1.j.pendiente.token, escribio: PALABRA }); assert.equal(q2.status, 200, q2.texto);
  assert.ok(prepares <= 40, `confirmar usó ${prepares} sentencias (plan gratuito: 50 por petición)`); assert.ok(antesPrep <= 20, 'pedir: ' + antesPrep);
});
