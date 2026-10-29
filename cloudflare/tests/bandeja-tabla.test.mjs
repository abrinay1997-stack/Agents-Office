// CON-11 paso 3: la Bandeja en la tabla `bandeja_items` (flag `nube.bandejaTabla`). Lo que se vigila: las MISMAS pruebas de la Bandeja pasan con la tabla (paridad), la importación
// del archivo viejo (sin duplicar), que un GET no escriba, que «enviando» sea compare-and-set (una respuesta no sale dos veces), que dos peticiones junten sus cambios y el camino de vuelta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cargarTabla, tablaAArchivo, tablaActiva, DOC_ESTADO } from '../worker/lib/bandeja-tabla.js';
import { sinArchivoBandeja, ESPEJO_BANDEJA, ESPEJO_ANUNCIOS, conBandeja } from '../worker/lib/anuncios-nube.js';
import { guardarDoc, leerDoc } from '../worker/lib/almacen.js';
import { PERMISOS_LECTURA, PERMISOS_PUBLICAR, PERMISOS_ANUNCIOS, PERMISOS_MENSAJES } from '../../contenido/meta.mjs';
import { SALTAR, crearD1 } from './d1-memoria.mjs';
import { nube } from './ayuda-meta.mjs';

const TODOS = [...PERMISOS_LECTURA, ...PERMISOS_PUBLICAR, ...PERMISOS_ANUNCIOS, ...PERMISOS_MENSAJES];
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const item = (id, extra = {}) => ({ id, estado: 'nuevo', fuente: 'meta', tipo: 'comentarios', cuando: hace(1), texto: 'hola', ...extra });

test('PARIDAD: las pruebas de la Bandeja de la nube pasan igual con la tabla encendida', { skip: SALTAR }, () => {
  const r = spawnSync(process.execPath, ['--test', new URL('./bandeja.test.mjs', import.meta.url).pathname], { env: { ...process.env, AO_BANDEJA_TABLA: '1' }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout.split('\n').filter((l) => /^\s*not ok|error:/.test(l)).join('\n') || r.stderr);
});

test('el flag: apagado por defecto y solo el booleano true lo enciende', () => {
  assert.equal(tablaActiva({}), false); assert.equal(tablaActiva({ nube: true }), false); assert.equal(tablaActiva({ nube: { bandejaTabla: 'si' } }), false); assert.equal(tablaActiva({ nube: { bandejaTabla: true } }), true);
});

test('con la tabla, bandeja.json sale de los espejos (Anuncios no lo lee: pasa por el mismo almacén)', () => {
  for (const e of [ESPEJO_BANDEJA, ESPEJO_ANUNCIOS]) { assert.ok(e.exactos.some((x) => x.endsWith('/bandeja.json'))); assert.ok(!sinArchivoBandeja(e).exactos.some((x) => x.endsWith('/bandeja.json'))); assert.ok(sinArchivoBandeja(e).exactos.some((x) => x.endsWith('/bandeja-meta.json')), 'el estado de la fuente de Meta se queda'); }
});

test('la primera vez importa el archivo viejo, una sola vez, y no lo borra', { skip: SALTAR }, async () => {
  const db = crearD1();
  const viejo = { items: { a: item('a'), b: item('b', { estado: 'respondido' }) }, ultimo: hace(2), error: '', alias: { x: 'a' }, fuentes: { meta: { ultimaAt: hace(2) } } };
  await guardarDoc(db, 'fs:data/contenido/bandeja.json', { t: JSON.stringify(viejo) });
  const alm = await cargarTabla(db);
  assert.deepEqual(Object.keys(alm.leer().items).sort(), ['a', 'b']); assert.deepEqual(alm.leer().alias, { x: 'a' });
  const n = () => db._db.prepare('select count(*) n from bandeja_items').get().n;
  assert.equal(n(), 2);
  await cargarTabla(db); assert.equal(n(), 2, 'repetirlo no duplica');
  assert.ok((await leerDoc(db, 'fs:data/contenido/bandeja.json', null)).valor, 'el archivo viejo se conserva: es el camino de vuelta');
});

test('un GET no escribe nada; cambiar un ítem escribe SOLO esa fila', { skip: SALTAR }, async () => {
  const db = crearD1(); await guardarDoc(db, 'fs:data/contenido/bandeja.json', { t: JSON.stringify({ items: Object.fromEntries(['a', 'b', 'c'].map((i) => [i, item(i)])) }) });
  const alm = await cargarTabla(db); const antes = db._db.prepare('select id, version from bandeja_items order by id').all();
  const alm2 = await cargarTabla(db); const d = alm2.leer(); alm2.escribir(d); await alm2.flush();
  assert.equal(alm2.cuenta.filasEscritas, 0, 'sin cambios no se escribe');
  const d2 = alm.leer(); d2.items.b.estado = 'descartado'; alm.escribir(d2); await alm.flush();
  assert.equal(alm.cuenta.filasEscritas, 1);
  const despues = db._db.prepare('select id, version, estado from bandeja_items order by id').all();
  assert.deepEqual(despues.map((r) => r.version), [antes[0].version, antes[1].version + 1, antes[2].version]); assert.equal(despues[1].estado, 'descartado');
});

test('«enviando» es compare-and-set: la segunda petición que intenta marcar el mismo ítem no pasa (la respuesta no sale dos veces)', { skip: SALTAR }, async () => {
  const db = crearD1(); await guardarDoc(db, 'fs:data/contenido/bandeja.json', { t: JSON.stringify({ items: { a: item('a', { tipo: 'conversaciones' }) } }) });
  const A = await cargarTabla(db), B = await cargarTabla(db); // las dos ven el ítem sin testigo
  const marca = (alm, texto) => { const d = alm.leer(); d.items.a.enviando = { at: new Date().toISOString(), texto }; alm.escribir(d); return alm.flush(); };
  await marca(A, 'primera');
  await assert.rejects(() => marca(B, 'segunda'), /ya se está enviando/);
  const fila = db._db.prepare('select json, enviando_at from bandeja_items where id = ?').get('a');
  assert.equal(JSON.parse(fila.json).enviando.texto, 'primera'); assert.ok(fila.enviando_at != null);
  // quien lo puso lo quita al terminar, y entonces otra petición puede volver a marcar
  const C = await cargarTabla(db); const d = C.leer(); d.items.a.enviando = null; d.items.a.estado = 'respondido'; C.escribir(d); await C.flush();
  assert.equal(db._db.prepare('select enviando_at from bandeja_items where id = ?').get('a').enviando_at, null);
});

test('dos peticiones cambian campos distintos del mismo ítem y del estado general: se juntan, no se pisan', { skip: SALTAR }, async () => {
  const db = crearD1(); await guardarDoc(db, 'fs:data/contenido/bandeja.json', { t: JSON.stringify({ items: { a: item('a'), b: item('b') }, error: '' }) });
  const A = await cargarTabla(db), B = await cargarTabla(db);
  let d = A.leer(); d.items.a.borrador = { texto: 'Hola' }; d.error = 'meta caída'; A.escribir(d); await A.flush();
  d = B.leer(); d.items.a.oculto = true; d.items.b.estado = 'descartado'; d.ultimo = 'ahora'; B.escribir(d); await B.flush();
  const C = (await cargarTabla(db)).leer();
  assert.equal(C.items.a.borrador.texto, 'Hola'); assert.equal(C.items.a.oculto, true); assert.equal(C.items.b.estado, 'descartado'); assert.equal(C.error, 'meta caída'); assert.equal(C.ultimo, 'ahora');
});

test('lo que el módulo recorta o quita se borra de la tabla', { skip: SALTAR }, async () => {
  const db = crearD1(); await guardarDoc(db, 'fs:data/contenido/bandeja.json', { t: JSON.stringify({ items: { a: item('a'), b: item('b') } }) });
  const A = await cargarTabla(db); const d = A.leer(); delete d.items.a; A.escribir(d); await A.flush();
  assert.deepEqual(db._db.prepare('select id from bandeja_items').all().map((r) => r.id), ['b']);
});

test('volver atrás: tablaAArchivo deja el archivo del espejo con lo que hay en la tabla', { skip: SALTAR }, async () => {
  const db = crearD1(); await guardarDoc(db, 'fs:data/contenido/bandeja.json', { t: JSON.stringify({ items: { a: item('a') } }) });
  const A = await cargarTabla(db); const d = A.leer(); d.items.n = item('n', { texto: 'llegó con la tabla' }); d.ultimo = 'hoy'; A.escribir(d); await A.flush();
  assert.equal(await tablaAArchivo(db), 2);
  const arch = JSON.parse((await leerDoc(db, 'fs:data/contenido/bandeja.json', null)).valor.t);
  assert.deepEqual(Object.keys(arch.items).sort(), ['a', 'n']); assert.equal(arch.ultimo, 'hoy');
});

test('de punta a punta con el flag: un GET de la Bandeja en caliente lee D1 poco y no escribe', { skip: SALTAR }, async () => {
  const o = await nube({ preparar: false, permisos: TODOS, config: { anuncios: { cuenta: 'act_1001' }, contenido: { modo: 'simulacro' }, nube: { bandejaTabla: true } } });
  await conBandeja({ db: o.d1, env: o.env }, async ({ bandeja }) => bandeja.listar({}));
  const orig = o.d1.prepare, v = { l: 0, e: 0 };
  o.d1.prepare = (sql) => { v[/^\s*(insert|update|delete|replace)/i.test(sql) ? 'e' : 'l']++; return orig(sql); };
  await conBandeja({ db: o.d1, env: o.env }, async ({ bandeja }) => bandeja.listar({}));
  o.d1.prepare = orig;
  assert.equal(v.e, 0, 'un GET no escribe'); assert.ok(v.l <= 4, `lecturas: ${v.l}`);
});
