// N0.0 (D06): un único `emitirAviso()`. Los avisos de la oficina salen de UN sitio (lib/avisos.js); estos tests fijan que cada emisor
// produce el mismo aviso que antes del refactor y que no aparece un escritor directo nuevo (grep estructural).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearD1, SALTAR } from './d1-memoria.mjs';
import { conSesion } from '../worker/lib/tareas/sesion.js';
import { avisar, emitirAviso, emitirAvisos, leerAvisos, marcarAvisosLeidos } from '../worker/lib/avisos.js';
import { avisosTodos, marcarAvisosLeidos as marcarTodos } from '../worker/lib/salud.js';
import { leerDoc } from '../worker/lib/almacen.js';
import { avisarD1 } from '../worker/lib/contenido/servicio.js';
import { crearAvisos } from '../worker/lib/anuncios-nube.js';

const filas = async (d1) => (await d1.prepare("select id, json, orden, actualizado from filas where coleccion = 'avisos' order by orden, id").all()).results;
const T0 = Date.UTC(2026, 9, 29, 12, 0, 0);

test('avisar(): la forma del aviso, el dedupe de 6 horas y el null del repetido', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  const a = await avisar(d1, { kind: 'trigger', level: 'warn', text: 'hola', key: 'k1', extra: 1 }, T0);
  assert.deepEqual(Object.keys(a).sort(), ['extra', 'id', 'key', 'kind', 'level', 'read', 't', 'task', 'text'].sort());
  assert.equal(a.read, false); assert.equal(a.t, T0); assert.equal(a.task, null); assert.equal(a.level, 'warn');
  assert.equal(await avisar(d1, { kind: 'trigger', text: 'otra vez', key: 'k1' }, T0 + 5 * 3600e3), null, 'misma key dentro de 6 h: se dice una');
  assert.ok(await avisar(d1, { kind: 'trigger', text: 'ya pasó', key: 'k1' }, T0 + 7 * 3600e3), 'pasadas 6 h se vuelve a decir');
  const r = await filas(d1);
  assert.equal(r.length, 2); assert.equal(r[0].orden, T0); assert.equal(r[0].actualizado, new Date(T0).toISOString());
  assert.deepEqual(JSON.parse(r[0].json), a);
  const sinKey = await avisar(d1, { kind: 'x', text: 'a' }, T0); const sinKey2 = await avisar(d1, { kind: 'x', text: 'a' }, T0);
  assert.ok(sinKey && sinKey2, 'sin key nunca se deduplica');
});

test('emitirAviso(): el aviso del ejecutor de agentes (sin kind obligatorio, level info, text tal cual)', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  await emitirAviso(d1, { kind: 'budget', level: 'error', text: 'presupuesto', key: 'budget-over' }, { ahora: T0 });
  await emitirAviso(d1, { kind: 'budget', level: 'error', text: 'presupuesto', key: 'budget-over' }, { ahora: T0 + 1000 });
  const r = await filas(d1);
  assert.equal(r.length, 1);
  assert.deepEqual({ ...JSON.parse(r[0].json), id: 'x' }, { id: 'x', t: T0, read: false, kind: 'budget', level: 'error', text: 'presupuesto', task: null, key: 'budget-over' });
});

test('la sesión de tareas vuelca sus avisos con el mismo dedupe (en la tanda y contra lo ya guardado)', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  await avisar(d1, { kind: 'limite', text: 'ya dicho', key: 'limite-1' }, Date.now());
  await conSesion(d1, {}, async (s) => {
    s.avisar('limite', 'ya dicho', { key: 'limite-1' });          // ya estaba: no entra
    s.avisar('persona', 'te asignaron', { persona: 'Ana', task: 't1' });
    s.avisar('persona', 'otra', { persona: 'Ana', key: 'p-1' });
    s.avisar('persona', 'repetida en la tanda', { key: 'p-1' });  // misma key en la tanda: una
    s.avisar('limite', 'tarde', { level: 'warn', task: 't2', key: 'limite-2' });
  });
  const lista = (await filas(d1)).map((r) => JSON.parse(r.json));
  assert.deepEqual(lista.map((a) => a.text).sort(), ['otra', 'te asignaron', 'tarde', 'ya dicho'].sort());
  const p = lista.find((a) => a.text === 'te asignaron');
  assert.equal(p.read, false); assert.equal(p.persona, 'Ana'); assert.equal(p.task, 't1'); assert.equal(p.level, 'info'); assert.equal(p.key, null); assert.equal(p.kind, 'persona');
  assert.equal(lista.find((a) => a.text === 'tarde').level, 'warn');
});

test('el doc `notices` (Contenido y Anuncios): forma, dedupe de 6 h y tope de 200', { skip: SALTAR }, async () => {
  const d1 = crearD1(); let ahora = T0;
  const av = avisarD1(d1, () => ahora);
  await av('contenido', 'x'.repeat(700), { key: 'c1', level: 'warn', task: 'p1' });
  await av('contenido', 'repetido', { key: 'c1' });
  const n = (await leerDoc(d1, 'notices', [])).valor;
  assert.equal(n.length, 1); assert.equal(n[0].text.length, 600); assert.deepEqual(Object.keys(n[0]).sort(), ['id', 'key', 'kind', 'level', 'read', 't', 'task', 'text']);
  assert.equal(n[0].id.length, 8); assert.equal(n[0].read, false);
  const an = crearAvisos(d1, { ahora: () => ahora });
  an.avisar('anuncios', 'rechazado', { key: 'a1', level: 'error' }); an.avisar('anuncios', 'dup', { key: 'a1' }); an.avisar('anuncios', 'sin key');
  await an.volcar();
  const m = (await leerDoc(d1, 'notices', [])).valor;
  assert.deepEqual(m.map((x) => x.text), ['x'.repeat(600), 'rechazado', 'sin key']);
  assert.equal(m[1].id.length, 12);
  for (let i = 0; i < 210; i++) await av('contenido', 'n' + i);
  assert.equal((await leerDoc(d1, 'notices', [])).valor.length, 200);
});

test('avisosTodos() junta las dos tablas, y «marcar leídos» marca las dos', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  await avisar(d1, { kind: 'a', text: 'fila' }, T0);
  await avisarD1(d1, () => T0 + 10)('contenido', 'doc');
  const todos = await avisosTodos(d1, 30);
  assert.deepEqual(todos.map((n) => n.text), ['doc', 'fila']);
  assert.equal((await leerAvisos(d1, 30)).length, 1);
  await marcarAvisosLeidos(d1); await marcarTodos(d1);
  assert.ok((await avisosTodos(d1, 30)).every((n) => n.read));
});

// ---- estructural: nadie escribe avisos por su cuenta ----
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'worker');
const PERMITIDO = new Set(['lib/avisos.js']);
const PODA = new Set(['modulos/tareas.js']); // la poda de lo viejo (delete) no emite nada: es mantenimiento
const todos = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? todos(p) : /\.m?js$/.test(f) ? [p] : []; });

test('estructura: solo lib/avisos.js escribe en filas(avisos) o en el doc notices', () => {
  const malos = [];
  for (const p of todos(RAIZ)) {
    const rel = relative(RAIZ, p).replaceAll('\\', '/');
    if (PERMITIDO.has(rel)) continue;
    const src = readFileSync(p, 'utf8');
    const escribe = /(insert|update|delete)[^;`'"]{0,60}\bfilas\b[^;`']{0,80}'avisos'/i.test(src) || /(insert|update|delete)[^;`'"]{0,40}from filas where coleccion = 'avisos'/i.test(src)
      || /(insert|update)[^;`]{0,200}\bfilas\b[\s\S]{0,300}\.bind\('avisos'/i.test(src)
      || /(mutarDoc|guardarDoc)\([^)]*['"]notices['"]/.test(src);
    if (escribe && !PODA.has(rel)) malos.push(rel);
    if (PODA.has(rel) && /(insert|update)[^;`]{0,200}'avisos'/i.test(src)) malos.push(rel + ' (inserta)');
  }
  assert.deepEqual(malos, [], 'un aviso nuevo se dice con emitirAviso()/emitirAvisos() de lib/avisos.js, no escribiendo en filas/notices');
});
