// Fase 4 E: los lotes del Estudio en la nube. Apagados por defecto (`lotesNube`); nacen «previstos» y no gastan; el goteo del reloj mira los topes ANTES de cada foto; un lote de agente
// desde 10 fotos o US$2 espera el OK del dueño. Motores de mentira en 127.0.0.1: jamás una llave real. El IMAGES de las pruebas de retoque local es una falsificación hecha con sharp.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { manejar } from '../worker/lib/rutas.js';
import * as estudio from '../worker/modulos/estudio.js';
import * as lotes from '../worker/lib/estudio/lotes.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';
import * as C from '../../lotes-core.mjs';

let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* sin sharp */ }
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 4, 0, 0, 0, 2, 0]), Buffer.alloc(30)]);
const dataUrl = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;
const CLAVE = 'g-prueba-123456'; // secrets-ok: una llave inventada del doble de prueba
const IA = { pila: ['fondo-gris'] }; // edita con un modelo de pago (nano-banana-pro)

async function google() {
  const seen = [];
  const srv = http.createServer((req, res) => { const ch = []; req.on('data', (d) => ch.push(d)); req.on('end', () => { seen.push(req.url); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] })); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { seen, base: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}
async function montar(extra = {}, rol = 'admin') {
  const d1 = crearD1(), admin = await sembrar(d1, { rol }), R2 = crearR2();
  const env = { ...envDePrueba(d1), MEDIA: R2, ...extra };
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const api = async (ruta, o = {}) => { const res = await pedir(manejar, env, ruta, { ...o, cookie }); const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { /* binario */ } return { status: res.status, j, t, headers: res.headers }; };
  /** Otra cuenta de la MISMA oficina con otro rol. */
  const como = async (rol2) => { const u = await sembrar(d1, { rol: rol2, email: rol2 + '@panaclaw.test' }); const rr = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: u.email, contrasena: u.clave } }); const ck = rr.headers.get('set-cookie').split(';')[0];
    return async (ruta, o = {}) => { const res = await pedir(manejar, env, ruta, { ...o, cookie: ck }); const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { /* binario */ } return { status: res.status, j, t }; }; };
  return { d1, env, R2, api, admin, cookie, como };
}
const encender = (api, extra = {}) => api('/api/media/limites', { metodo: 'PUT', cuerpo: { lotesNube: true, ...extra } });
async function fotos(api, n) { const ids = []; for (let i = 0; i < n; i++) ids.push((await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: `silla ${i + 1}`, data: dataUrl(Buffer.concat([png, Buffer.from([i])])) } })).j.item.file); return ids; }
const crearLote = (api, ids, extra = {}) => api('/api/media/lotes', { metodo: 'POST', cuerpo: { nombre: 'Sillas', origen: { tipo: 'seleccion', files: ids }, receta: IA, ...extra } });
const patch = (api, id, accion) => api('/api/media/lotes/' + id, { metodo: 'PATCH', cuerpo: { accion } });
/** Avanza el reloj hasta que se cumpla `fin` (con tope: nunca un tiempo fijo). */
async function avanzar(env, api, id, fin, { veces = 40 } = {}) { for (let i = 0; i < veces; i++) { await estudio.cadaMinuto(env); const l = (await api('/api/media/lotes/' + id)).j.lote; if (fin(l)) return l; } throw new Error('el lote no llegó: ' + JSON.stringify((await api('/api/media/lotes/' + id)).j.lote?.cuentas)); }

test('lotes-core: lo puro compartido no toca archivos ni red, y lotes.mjs (local) exporta lo mismo', async () => {
  const t = fs.readFileSync(new URL('../../lotes-core.mjs', import.meta.url), 'utf8');
  assert.ok(!/from\s+['"]node:/.test(t) && !/from\s+['"]\.\/media/.test(t));
  const local = await import('../../lotes.mjs');
  for (const k of ['ESTADOS', 'transicion', 'pideOkAgente', 'zipDe', 'nombresPorSku', 'celdaCsv', 'cuentas']) assert.equal(local[k], C[k], k);
});

test('apagado por defecto: ni una ruta de lotes responde, y el reloj no hace nada', { skip: SALTAR }, async () => {
  const { api, env } = await montar({ GEMINI_API_KEY: CLAVE });
  for (const [m, r] of [['GET', '/api/media/lotes'], ['POST', '/api/media/lotes'], ['POST', '/api/media/lotes/hoja'], ['GET', '/api/media/lotes/Lzzzzz']]) { const x = await api(r, { metodo: m, cuerpo: m === 'POST' ? {} : undefined }); assert.equal(x.status, 501, r); assert.equal(x.j.pendiente, true); assert.match(x.j.error, /apagados/); }
  assert.deepEqual(await lotes.cadaMinuto(env, env.DB), { activo: false });
  assert.equal((await api('/api/media/limites', { metodo: 'PUT', cuerpo: { lotesNube: 'si' } })).status, 422);
});

test('nace previsto y NO gasta; un editor lo crea pero no lo pone a gastar; un lector ni eso', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env, como } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const ids = await fotos(api, 3);
    const r = await crearLote(api, ids);
    assert.equal(r.status, 200, r.t);
    assert.equal(r.j.lote.estado, 'previsto'); assert.equal(r.j.lote.filas.length, 3); assert.ok(r.j.vista.total > 0); assert.equal(r.j.sugerido, 'iniciar'); assert.ok(r.j.lote.previa.costo > 0);
    await estudio.cadaMinuto(env); await estudio.cadaMinuto(env);
    assert.equal(g.seen.length, 0, 'ni el reloj ni la creación llamaron a un motor');
    assert.equal((await api('/api/media/jobs')).j.jobs.length, 0, 'ningún trabajo');
    assert.equal((await api('/api/media/lotes')).j.lotes.length, 1);
    // las salvaguardas de rol, con cuentas de verdad de la misma oficina
    const editor = await como('editor'), lector = await como('lectura'), id = r.j.lote.id;
    const le = await crearLote(editor, ids); assert.equal(le.status, 200, 'un editor sí puede crear (no gasta)');
    for (const accion of ['iniciar', 'probar', 'autorizar']) assert.equal((await patch(editor, id, accion)).status, 403, 'un editor no pone un lote a gastar: ' + accion);
    assert.equal((await editor('/api/media/lotes/' + id + '/filas', { metodo: 'POST', cuerpo: { accion: 'reintentar', filas: 'todas' } })).status, 403);
    assert.equal((await crearLote(lector, ids)).status, 403); assert.equal((await patch(lector, id, 'cancelar')).status, 403); assert.equal((await lector('/api/media/lotes')).status, 200, 'un lector mira');
    assert.equal(g.seen.length, 0);
    assert.equal((await patch(api, 'Lzzzzz', 'iniciar')).status, 404);
  } finally { await g.close(); }
});

test('probar con unas pocas, revisar, seguir: el goteo manda de a poco, el gasto se suma y todo termina «hecho» con su ZIP y su CSV', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const ids = await fotos(api, 5);
    const c = await crearLote(api, ids, { muestra: 2 });
    const id = c.j.lote.id;
    assert.equal(c.j.sugerido, 'probar');
    assert.equal((await patch(api, id, 'probar')).j.lote.estado, 'muestra');
    await lotes.cadaMinuto(env, env.DB);
    const uno = (await api('/api/media/lotes/' + id)).j.lote;
    assert.equal(uno.filas.filter((f) => f.estado === 'editando').length, 2, 'manda su concurrencia (2) y no más');
    assert.equal(g.seen.length, 0, 'mandar = poner el trabajo en cola; lo envía el cron del Estudio');
    const pausado = await avanzar(env, api, id, (l) => l.estado === 'pausado');
    assert.equal(pausado.motivo, 'muestra'); assert.equal(pausado.pausa.por, 'muestra');
    assert.equal(pausado.cuentas.lista, 2); assert.equal(g.seen.length, 2, 'solo se gastaron las dos de prueba');
    assert.ok(pausado.costo.gastado > 0);
    assert.equal((await patch(api, id, 'probar')).status, 409, 'la muestra ya se hizo');
    assert.equal((await patch(api, id, 'continuar')).j.lote.estado, 'corriendo');
    const hecho = await avanzar(env, api, id, (l) => l.estado === 'hecho');
    assert.equal(hecho.cuentas.lista, 5); assert.equal(g.seen.length, 5, 'una llamada por foto, ni una más');
    // aprobar es idempotente; el ZIP lleva nombres por SKU y el CSV todo
    const ap = await api('/api/media/lotes/' + id + '/filas', { metodo: 'POST', cuerpo: { accion: 'aprobar', filas: 'listas' } });
    assert.equal(ap.status, 200); assert.equal(ap.j.lote.cuentas.aprobada, 5);
    assert.equal((await api('/api/media/lotes/' + id + '/filas', { metodo: 'POST', cuerpo: { accion: 'aprobar', filas: 'todas' } })).j.filas.every((f) => f.ya), true);
    const z = await api('/api/media/lotes/' + id + '/zip?que=aprobadas'); assert.equal(z.status, 200); assert.match(z.headers.get('content-type'), /zip/);
    const csv = await api('/api/media/lotes/' + id + '/csv'); assert.match(csv.t, /fila,sku,nombre/); assert.equal(csv.t.split('\r\n').filter(Boolean).length, 6);
  } finally { await g.close(); }
});

test('los topes se miran ANTES de cada foto: el del lote y el presupuesto del día pausan sin gastar nada', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const ids = await fotos(api, 4);
    const a = await crearLote(api, ids, { tope: { usd: 0.01 } });
    assert.equal(a.j.vista.cabe.lote, false); assert.match(a.j.vista.cabe.por, /tope del lote/);
    await patch(api, a.j.lote.id, 'iniciar'); await lotes.cadaMinuto(env, env.DB);
    const pa = (await api('/api/media/lotes/' + a.j.lote.id)).j.lote;
    assert.equal(pa.estado, 'pausado'); assert.match(pa.motivo, /tope del lote/); assert.equal(pa.pausa.por, 'presupuesto'); assert.equal(g.seen.length, 0);
    await patch(api, a.j.lote.id, 'cancelar');
    await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: 0.01 } });
    const b = await crearLote(api, ids); assert.equal(b.j.vista.cabe.dia, false);
    await patch(api, b.j.lote.id, 'iniciar'); await lotes.cadaMinuto(env, env.DB);
    const pb = (await api('/api/media/lotes/' + b.j.lote.id)).j.lote; assert.equal(pb.estado, 'pausado'); assert.match(pb.motivo, /presupuesto del día/);
    assert.equal(g.seen.length, 0); assert.equal((await api('/api/media/jobs')).j.jobs.length, 0, 'no se pidió ningún trabajo');
  } finally { await g.close(); }
});

test('un lote de un AGENTE desde 10 fotos espera el OK del dueño; autorizar es solo de un administrador y el agente no lo salta partiéndolo', { skip: SALTAR }, async () => {
  const { api, env, admin } = await montar({ GEMINI_API_KEY: CLAVE });
  await encender(api);
  const ids = await fotos(api, 12);
  const a = await lotes.crear(env, env.DB, { nombre: 'Muchas', origen: { ids }, receta: IA, agent: 'mara', task: 't1' }, { by: 'agent' });
  assert.equal(a.lote.estado, 'espera_ok'); assert.match(a.lote.motivo, /agente/);
  await assert.rejects(() => lotes.accion(env, env.DB, a.lote.id, 'iniciar', { by: 'agent' }), (e) => e.status === 409 || e.status === 403);
  await assert.rejects(() => lotes.accion(env, env.DB, a.lote.id, 'autorizar', { by: 'agent', usuario: { rol: 'admin' } }), (e) => e.status === 403);
  await assert.rejects(() => lotes.accion(env, env.DB, a.lote.id, 'autorizar', { by: 'you', usuario: { rol: 'editor' } }), (e) => e.status === 403);
  const ok = await lotes.accion(env, env.DB, a.lote.id, 'autorizar', { by: 'you', usuario: { rol: 'admin', email: admin.email } });
  assert.equal(ok.estado, 'previsto');
  // partirlo en lotes de 4 no salta el OK: lo ya pedido se suma
  const p1 = await lotes.crear(env, env.DB, { nombre: 'P1', origen: { ids: ids.slice(0, 6) }, receta: IA, agent: 'otro', task: 't9' }, { by: 'agent' });
  assert.equal(p1.lote.estado, 'previsto');
  const p2 = await lotes.crear(env, env.DB, { nombre: 'P2', origen: { ids: ids.slice(6, 12) }, receta: IA, agent: 'otro', task: 't9' }, { by: 'agent' });
  assert.equal(p2.lote.estado, 'espera_ok', 'sumando las 12 llega al umbral');
  // un agente solo arranca su propio lote previsto
  const s = await lotes.crear(env, env.DB, { nombre: 'S', origen: { ids: ids.slice(0, 2) }, receta: IA, agent: 'solo', task: 't2' }, { by: 'agent' });
  assert.equal(s.lote.estado, 'previsto');
  assert.equal((await lotes.accion(env, env.DB, s.lote.id, 'iniciar', { by: 'agent' })).estado, 'corriendo');
  await assert.rejects(() => lotes.accion(env, env.DB, p1.lote.id, 'continuar', { by: 'agent' }), (e) => e.status === 403 || e.status === 409);
});

test('todo local con IMAGES: gratis, sin llamar a ningún motor, y el original queda intacto', { skip: SALTAR || (sharp ? false : 'sin sharp para falsificar IMAGES') }, async () => {
  const g = await google();
  const imagenes = { async info(s) { const b = Buffer.from(await new Response(s).arrayBuffer()), m = await sharp(b).metadata(); return { format: 'image/' + m.format, width: m.width, height: m.height }; },
    input(s) { return { transform() { return this; }, async output(o) { let img = sharp(Buffer.from(await new Response(s).arrayBuffer())); const data = o.format === 'rgba' ? await img.ensureAlpha().raw().toBuffer() : o.format === 'image/jpeg' ? await img.jpeg().toBuffer() : await img.png().toBuffer(); return { response: () => new Response(data) }; } }; } };
  try {
    const { api, env, R2 } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base, IMAGES: imagenes });
    await encender(api, { retoquesNube: true });
    const base = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#555555' } }).png().toBuffer();
    const ids = []; for (let i = 0; i < 3; i++) ids.push((await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: `foto ${i}`, data: dataUrl(await sharp({ create: { width: 32 + i, height: 24, channels: 3, background: '#555555' } }).png().toBuffer()) } })).j.item.file);
    const c = await crearLote(api, ids, { receta: { pila: ['luz-mas-clara'] } });
    assert.equal(c.status, 200, c.t); assert.equal(c.j.vista.total, 0); assert.equal(c.j.lote.filas.every((f) => f.local), true);
    await patch(api, c.j.lote.id, 'iniciar');
    const h = await avanzar(env, api, c.j.lote.id, (l) => l.estado === 'hecho');
    assert.equal(h.cuentas.lista, 3); assert.equal(h.costo.gastado, 0); assert.equal(g.seen.length, 0);
    assert.ok(h.filas.every((f) => f.out && f.out !== f.src));
    assert.ok(R2._m.has(ids[0]), 'el original sigue ahí');
    void base;
  } finally { await g.close(); }
});

test('una hoja CSV: columnas, presets por fila y problemas por fila sin gastar; el Excel dice cómo pasarlo a CSV', { skip: SALTAR }, async () => {
  const { api, env } = await montar({ GEMINI_API_KEY: CLAVE });
  await encender(api);
  const ids = await fotos(api, 2);
  const nombre = (id) => id.split('/').pop().replace(/\.[a-z]+$/, '');
  void nombre;
  const csv = `foto,sku,nombre,preset\nsilla-1.png,S-1,Silla uno,fondo-gris\nsilla-2.png,S-2,Silla dos,preset-que-no-existe\n`;
  const x = await api('/api/media/lotes/hoja', { metodo: 'POST', cuerpo: { name: 'sillas.csv', data: dataUrl(Buffer.from(csv), 'text/csv') } });
  assert.equal(x.status, 200, x.t); assert.ok(x.j.id && x.j.filas.length === 2);
  const xl = await api('/api/media/lotes/hoja', { metodo: 'POST', cuerpo: { name: 'sillas.xlsx', data: dataUrl(Buffer.from('x')) } }); assert.equal(xl.status, 400); assert.match(xl.j.error, /CSV/);
  const c = await api('/api/media/lotes', { metodo: 'POST', cuerpo: { nombre: 'Hoja', origen: { tipo: 'hoja', hoja: x.j.id, fotos: ids }, receta: {} } });
  assert.equal(c.status, 200, c.t);
  const l = c.j.lote;
  assert.equal(l.filas.length, 2); assert.ok(l.filas.every((f) => f.estado === 'revisar'), 'nombres que no están en la galería y un preset que no existe: para revisar, sin gastar');
  assert.equal(l.costo.estimado, 0); assert.equal(l.estado, 'previsto'); void env;
});

test('un envío que se cayó a medias no se repite: se busca por la marca del lote; sin trabajo, vuelve a la cola', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env, d1 } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const ids = await fotos(api, 2);
    const c = await crearLote(api, ids); const id = c.j.lote.id;
    await patch(api, id, 'iniciar');
    const fila = await d1.prepare('select json from estudio_lotes where id = ?').bind(id).first(); const l = JSON.parse(fila.json);
    // la fila 1 quedó «editando» hace 5 minutos y SU trabajo existe (con la marca); la 2, también, pero sin trabajo
    for (const f of l.filas) { f.estado = 'editando'; f.envio = Date.now() - 5 * 60e3; f.intentos = 1; f.job = null; }
    const marca1 = lotes.proposito(l, l.filas[0]);
    const j1 = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'x', kind: 'image', model: 'prueba', purpose: marca1 } });
    assert.equal(j1.status, 200);
    await d1.prepare('update estudio_lotes set json = ?, version = version + 1 where id = ?').bind(JSON.stringify(l), id).run();
    await lotes.cadaMinuto(env, env.DB);
    const u = (await api('/api/media/lotes/' + id)).j.lote;
    assert.equal(u.filas[0].job, j1.j.job.id, 'la fila 1 tomó el trabajo que ya existía, sin mandar otro');
    assert.ok(['editando', 'lista'].includes(u.filas[0].estado));
    assert.ok(['editando', 'en_cola'].includes(u.filas[1].estado), 'la fila 2 volvió a la cola (y se mandó de nuevo): ' + u.filas[1].estado);
    assert.equal(u.filas[1].intentos, 1, 'sin contar el envío que nunca existió como intento');
    assert.equal((await api('/api/media/jobs')).j.jobs.filter((j) => j.purpose === marca1).length, 1, 'un solo trabajo para la fila 1');
  } finally { await g.close(); }
});

test('cancelar: lo que esperaba se omite, el gasto ya hecho se conserva y el lote no vuelve a moverse', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const ids = await fotos(api, 4); const c = await crearLote(api, ids); const id = c.j.lote.id;
    await patch(api, id, 'iniciar'); await lotes.cadaMinuto(env, env.DB);
    const x = await patch(api, id, 'cancelar'); assert.equal(x.j.lote.estado, 'cancelado');
    assert.ok(x.j.lote.filas.every((f) => f.estado === 'omitida'));
    const antes = g.seen.length; await estudio.cadaMinuto(env); await estudio.cadaMinuto(env);
    assert.equal(g.seen.length, antes, 'el trabajo que estaba en cola se canceló: no gasta'); assert.equal((await patch(api, id, 'iniciar')).status, 409);
  } finally { await g.close(); }
});

test('roles: un lector no pausa ni omite (ni por HTTP ni por el motor); un editor sí', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env, como } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const c = await crearLote(api, await fotos(api, 2)); const id = c.j.lote.id;
    await patch(api, id, 'iniciar');
    const lector = await como('lectura'), editor = await como('editor');
    assert.equal((await patch(lector, id, 'pausar')).status, 403);
    assert.equal((await lector('/api/media/lotes/' + id + '/filas', { metodo: 'POST', cuerpo: { accion: 'omitir', filas: [1] } })).status, 403);
    await assert.rejects(() => lotes.accion(env, env.DB, id, 'pausar', { by: 'you', usuario: { rol: 'lectura', email: 'x@y.z' } }), (e) => e.status === 403);
    await assert.rejects(() => lotes.accionFilas(env, env.DB, id, { accion: 'omitir', filas: [1] }, { by: 'you', usuario: { rol: 'lectura' } }), (e) => e.status === 403);
    assert.equal((await patch(editor, id, 'pausar')).j.lote.estado, 'pausado', 'un editor sí pausa');
    assert.equal((await editor('/api/media/lotes/' + id + '/filas', { metodo: 'POST', cuerpo: { accion: 'omitir', filas: [1] } })).status, 200);
  } finally { await g.close(); }
});

test('el dinero lo gasta un administrador VIGENTE: si quien inició deja de serlo, se borra, o nadie lo inició, el lote se pausa sin gastar', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env, d1, admin } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const ids = await fotos(api, 3);
    // 1) degradado a editor después de iniciar
    const a = await crearLote(api, ids); await patch(api, a.j.lote.id, 'iniciar');
    d1._db.prepare("update users set rol = 'editor' where email = ?").run(admin.email);
    // (el reloj no necesita sesión: lee al usuario por su correo)
    await lotes.cadaMinuto(env, env.DB);
    const pa = (await lotes.uno(env, env.DB, a.j.lote.id)); assert.equal(pa.estado, 'pausado'); assert.match(pa.motivo, /ya no es administrador/); assert.equal(g.seen.length, 0);
    assert.equal((await api('/api/media/jobs')).j.jobs.length, 0);
    // 2) el usuario se borró (otro lote, iniciado por quien ya no existe)
    d1._db.prepare("update users set rol = 'admin' where email = ?").run(admin.email);
    const b = await crearLote(api, ids); await patch(api, b.j.lote.id, 'iniciar');
    const fila = d1._db.prepare('select json from estudio_lotes where id = ?').get(b.j.lote.id); const l = JSON.parse(fila.json); l.inicioPor = { email: 'ya-no-existe@panaclaw.test', nombre: 'Fantasma' };
    d1._db.prepare('update estudio_lotes set json = ?, version = version + 1 where id = ?').run(JSON.stringify(l), b.j.lote.id);
    await lotes.cadaMinuto(env, env.DB);
    assert.match((await lotes.uno(env, env.DB, b.j.lote.id)).motivo, /ya no es administrador/);
    // 3) nadie lo inició (un lote de agente arrancado por el agente): no se inventa un administrador
    const s = await lotes.crear(env, env.DB, { nombre: 'S', origen: { ids: ids.slice(0, 2) }, receta: IA, agent: 'solo', task: 't2' }, { by: 'agent' });
    await lotes.accion(env, env.DB, s.lote.id, 'iniciar', { by: 'agent' }); await lotes.cadaMinuto(env, env.DB);
    const ps = await lotes.uno(env, env.DB, s.lote.id); assert.equal(ps.estado, 'pausado'); assert.match(ps.motivo, /ningún administrador/);
    assert.equal(g.seen.length, 0, 'ni una llamada a un motor'); assert.equal((await api('/api/media/jobs')).j.jobs.length, 0);
  } finally { await g.close(); }
});

test('si aplicar falla DESPUÉS de crear el trabajo, la foto no se reintenta: se toma el trabajo que ya existe', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env, d1 } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const c = await crearLote(api, await fotos(api, 1), { muestra: 0 }); const id = c.j.lote.id;
    await patch(api, id, 'iniciar');
    // D1 «cae» al apuntar la auditoría del trabajo (pedir ya insertó la fila del trabajo)
    let cae = true; const real = env.DB;
    env.DB = new Proxy(real, { get: (t, k) => (k === 'prepare' ? (sql) => (cae && /insert into auditoria/.test(sql) ? { bind: () => ({ run: async () => { throw new Error('D1 se cayó'); } }) } : t.prepare(sql)) : (typeof t[k] === 'function' ? t[k].bind(t) : t[k])) });
    await lotes.cadaMinuto(env, env.DB);
    cae = false; env.DB = real;
    const l = await lotes.uno(env, env.DB, id);
    assert.equal(l.filas[0].estado, 'editando', 'no falló ni volvió a la cola: ya va'); assert.ok(l.filas[0].job);
    assert.equal((await api('/api/media/jobs')).j.jobs.length, 1, 'un solo trabajo');
    const h = await avanzar(env, api, id, (x) => x.estado === 'hecho'); assert.equal(h.cuentas.lista, 1); assert.equal(g.seen.length, 1);
    void d1;
  } finally { await g.close(); }
});

test('una fila «editando» cuyo trabajo ya se podó, o con un reintento, no se queda atascada ni confunde marcas', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env, d1 } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const c = await crearLote(api, await fotos(api, 2), { muestra: 0 }); const id = c.j.lote.id;
    await patch(api, id, 'pausar').catch(() => {}); await patch(api, id, 'iniciar');
    const l = JSON.parse(d1._db.prepare('select json from estudio_lotes where id = ?').get(id).json);
    l.filas[0].estado = 'editando'; l.filas[0].job = 'jbbbbbbbbbbb'; l.filas[0].envio = Date.now() - 10 * 60e3; l.filas[0].intentos = 1;
    d1._db.prepare('update estudio_lotes set json = ?, version = version + 1 where id = ?').run(JSON.stringify(l), id);
    await lotes.cadaMinuto(env, env.DB);
    const u = await lotes.uno(env, env.DB, id);
    assert.notEqual(u.filas[0].job, 'jbbbbbbbbbbb'); assert.ok(['en_cola', 'editando'].includes(u.filas[0].estado));
    assert.notEqual(lotes.proposito(u, { n: 1, intentos: 1 }), lotes.proposito(u, { n: 1, intentos: 2 }), 'cada intento tiene su marca');
  } finally { await g.close(); }
});

test('el goteo es por turnos y acotado: 3 fotos por minuto como mucho, y un lote nuevo no se queda sin vez; las hojas CSV tienen tope', { skip: SALTAR }, async () => {
  const g = await google();
  try {
    const { api, env, d1 } = await montar({ GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(api);
    const ids = await fotos(api, 2), lotesIds = [];
    for (let i = 0; i < 7; i++) { const c = await crearLote(api, ids, { nombre: 'L' + i, muestra: 0 }); lotesIds.push(c.j.lote.id); await patch(api, c.j.lote.id, 'iniciar'); }
    const r1 = await lotes.cadaMinuto(env, env.DB);
    assert.ok(r1.enviadas <= lotes.MAX_ENVIOS_TICK && r1.enviadas > 0, 'enviadas: ' + r1.enviadas); assert.equal(r1.lotes, 5);
    const vistos = new Set(d1._db.prepare("select id from estudio_lotes where turno > 0").all().map((x) => x.id));
    assert.equal(vistos.size, 5);
    await lotes.cadaMinuto(env, env.DB);
    const sin = lotesIds.filter((x) => !d1._db.prepare('select turno from estudio_lotes where id = ?').get(x).turno);
    assert.deepEqual(sin, [], 'en la segunda vuelta les tocó a todos');
    // hojas
    const csv = dataUrl(Buffer.from('foto,sku\na.png,1\n'), 'text/csv');
    for (let i = 0; i < lotes.MAX_HOJAS; i++) assert.equal((await api('/api/media/lotes/hoja', { metodo: 'POST', cuerpo: { name: 'h.csv', data: csv } })).status, 200);
    const tope = await api('/api/media/lotes/hoja', { metodo: 'POST', cuerpo: { name: 'h.csv', data: csv } }); assert.equal(tope.status, 429); assert.match(tope.j.error, /demasiadas hojas/);
  } finally { await g.close(); }
});
