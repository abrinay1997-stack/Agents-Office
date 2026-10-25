// Lo que pidió la revisión independiente del Estudio en la nube: el tope no se pasa con pedidos a la vez, reintentar solo lo terminado,
// el zip y la papelera con topes, nada crudo del proveedor hacia la página, y /media/<archivo> a través de las rutas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { manejar } from '../worker/lib/rutas.js';
import * as galeria from '../worker/lib/estudio/galeria.js';
import * as trabajos from '../worker/lib/estudio/trabajos.js';
import * as estudio from '../worker/modulos/estudio.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 4, 0, 0, 0, 2, 0]), Buffer.alloc(30)]);
const tick = () => new Promise((r) => setImmediate(r));
/** Un D1 que cede el turno (un await real) antes de cada lectura o escritura: así dos peticiones a la vez se mezclan de verdad. */
function conTurnos(d1) {
  // el insert de un trabajo tarda: todos los pedidos ya leyeron el presupuesto cuando el primero escribe (la carrera de verdad)
  const envolver = (s, lento) => { const espera = async () => { for (let i = 0; i < (lento ? 25 : 1); i++) await tick(); }; return { bind: (...a) => envolver(s.bind(...a), lento), first: async () => { await espera(); return s.first(); }, all: async () => { await espera(); return s.all(); }, run: async () => { await espera(); return s.run(); } }; };
  return { ...d1, prepare: (sql) => envolver(d1.prepare(sql), /^insert into estudio_trabajos/.test(sql)), batch: async (l) => { await tick(); return d1.batch(l); }, _db: d1._db };
}
async function montar(extra = {}, { turnos = false } = {}) {
  const base = crearD1(), admin = await sembrar(base), d1 = turnos ? conTurnos(base) : base, R2 = crearR2();
  const env = { ...envDePrueba(d1), MEDIA: R2, ...extra };
  const cookie = (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } })).headers.get('set-cookie').split(';')[0];
  const api = async (ruta, o = {}) => { const res = await pedir(manejar, env, ruta, { ...o, cookie }); const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { /* binario */ } return { status: res.status, j, res, t }; };
  return { d1, base, env, R2, cookie, api };
}
const GEMINI = { GEMINI_API_KEY: 'g-prueba-revision-01', AO_GEMINI_BASE: 'http://127.0.0.1:9' }; // secrets-ok: inventada; el puerto 9 no atiende: aquí nada llega a enviarse

test('dos pedidos de pago A LA VEZ no pasan del tope del día (aunque el D1 ceda el turno entre leer y escribir)', { skip: SALTAR }, async () => {
  const { env, cookie, api } = await montar(GEMINI, { turnos: true });
  assert.equal((await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: 0.1 } })).status, 200); // un Nano Banana 2 cuesta ≈ US$0,067: caben uno, no dos
  const pedido = () => manejar(new Request('https://oficina.test/api/media/jobs', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'a la vez', model: 'nano-banana-2', kind: 'image' }) }), env);
  const r = await Promise.all([pedido(), pedido(), pedido()]);
  const estados = r.map((x) => x.status).sort();
  assert.deepEqual(estados, [200, 400, 400], 'solo uno cabe: ' + estados);
  const malos = await Promise.all(r.filter((x) => x.status === 400).map((x) => x.json())); assert.ok(malos.every((m) => /presupuesto del día del Estudio/.test(m.error)));
  const { results } = await env.DB.prepare('select id from estudio_trabajos').all(); assert.equal(results.length, 1, 'los que no cabían no dejaron fila');
});

test('reintentar: solo un trabajo terminado; uno en marcha da 409; el reintento recuerda de cuál viene', { skip: SALTAR }, async () => {
  const { api, d1 } = await montar();
  const p = (await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'otra vez', model: 'prueba', kind: 'image' } })).j.job;
  const q = await api(`/api/media/jobs/${p.id}/retry`, { metodo: 'POST' });
  assert.equal(q.status, 200); assert.equal(q.j.job.retryOf, p.id);
  d1._db.prepare("update estudio_trabajos set estado = 'running', json = json_set(json, '$.state', 'running') where id = ?").run(p.id);
  const e = await api(`/api/media/jobs/${p.id}/retry`, { metodo: 'POST' });
  assert.equal(e.status, 409); assert.match(e.j.error, /sigue en marcha/);
});

test('el zip pasado de 40 MB da 413 en español; la papelera entera solo la vacía un administrador; el borrado en lote respeta su tope', { skip: SALTAR }, async () => {
  const { api, env, d1, R2 } = await montar();
  const a = await galeria.store(env, d1, png, 'png', { prompt: 'grande uno' }), b = await galeria.store(env, d1, png, 'png', { prompt: 'grande dos' });
  const real = R2.head; R2.head = async (k) => ({ ...(await real(k)), size: 25 * 1024 * 1024 }); // dos archivos de 25 MB: no se leen, solo se miden
  const z = await api('/api/media/zip', { metodo: 'POST', cuerpo: { ids: [a.file, b.file] } });
  assert.equal(z.status, 413); assert.match(z.j.error, /40 MB/); R2.head = real;
  assert.equal((await api('/api/media/zip', { metodo: 'POST', cuerpo: { ids: [a.file, b.file] } })).status, 200);
  // muchos a la papelera → se purgan de 100 en 100
  for (let i = 0; i < 130; i++) { const it = await galeria.store(env, d1, png, 'png', { prompt: 'p' + i }); await galeria.trash(d1, it.file); }
  const v = await api('/api/media/trash/purge', { metodo: 'POST', cuerpo: { all: true } });
  assert.equal(v.j.removed, galeria.PURGA_MAX * 2); assert.equal((await api('/api/media/trash')).j.items.length, 30, 'lo demás va en la siguiente pasada');
  // movimiento en lote: una consulta por tanda, no por archivo
  const c = (await api('/api/media/folders', { metodo: 'POST', cuerpo: { name: 'Lote' } })).j.folder;
  let consultas = 0; const prep = d1.prepare; d1.prepare = (sql) => { if (/update estudio_archivos set json = json_set/.test(sql)) consultas++; return prep(sql); };
  assert.equal((await api('/api/media/move', { metodo: 'POST', cuerpo: { files: [a.file, b.file], folder: c.id } })).j.moved, 2);
  assert.equal(consultas, 1); d1.prepare = prep;
});

test('un editor no vacía toda la papelera, pero sí lo suyo', { skip: SALTAR }, async () => {
  const { env, d1 } = await montar();
  const e = crearD1(); void e; void d1;
  const E = crearD1(), admin = await sembrar(E, { rol: 'editor' }), env2 = { ...envDePrueba(E), MEDIA: crearR2() };
  const cookie = (await pedir(manejar, env2, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } })).headers.get('set-cookie').split(';')[0];
  const t = async (cuerpo) => (await pedir(manejar, env2, '/api/media/trash/purge', { metodo: 'POST', cuerpo, cookie })).status;
  assert.equal(await t({ all: true }), 403); assert.equal(await t({ bin: [] }), 200); void env;
});

test('lo que cuenta un motor al fallar no lleva el cuerpo crudo ni nada que parezca una llave, ni se guarda como errorRaw', { skip: SALTAR }, async () => {
  const http = await import('node:http');
  const srv = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Request contains an invalid argument tok_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 detalle interno' } })); }); }); // secrets-ok: una llave inventada para probar el redactado
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const { api, env } = await montar({ GEMINI_API_KEY: 'g-prueba-revision-01', AO_GEMINI_BASE: `http://127.0.0.1:${srv.address().port}` }); // secrets-ok: inventada
    const p = (await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'x', model: 'nano-banana-2', kind: 'image' } })).j.job;
    await estudio.cadaMinuto(env);
    const f = (await api('/api/media/jobs/' + p.id)).j.job;
    assert.equal(f.state, 'failed'); assert.ok(!('errorRaw' in f)); assert.ok(!JSON.stringify(f).includes('tok_ABC') && !JSON.stringify(f).includes('detalle interno'));
  } finally { await new Promise((r) => srv.close(r)); }
});

test('borrar un archivo falla CERRADO si no se puede comprobar si una pieza de Contenido lo usa', { skip: SALTAR }, async () => {
  const { api, env, d1 } = await montar();
  const it = await galeria.store(env, d1, png, 'png', { prompt: 'usado' });
  const prep = d1.prepare; d1.prepare = (sql) => { if (/from contenido_piezas/.test(sql)) throw new Error('no existe la tabla'); return prep(sql); };
  const r = await api('/api/media/item/' + encodeURIComponent(it.file), { metodo: 'DELETE' });
  assert.equal(r.status, 503); assert.match(r.j.error, /no lo borro/); d1.prepare = prep;
  assert.equal((await api('/api/media?n=5')).j.total, 1, 'sigue en la galería');
});

test('si el archivo desaparece de R2 entre medir y leer, es un 404 y no un 500', { skip: SALTAR }, async () => {
  const { env, d1, R2 } = await montar();
  const it = await galeria.store(env, d1, png, 'png', { prompt: 'se fue' });
  const get = R2.get; R2.get = async () => null;
  const r = await estudio.servirMedia({ req: new Request('https://x/m'), env, db: d1, ruta: '/media/' + encodeURI(it.file) });
  assert.equal(r.status, 404); R2.get = get;
});

test('un archivo se guarda primero en R2 y no pisa a otro con el mismo nombre', { skip: SALTAR }, async () => {
  const { env, d1, R2 } = await montar();
  const ahora = Date.parse('2026-10-25T15:30:12Z');
  const a = await galeria.store(env, d1, png, 'png', { prompt: 'mismo' }, { ahora });
  const rotos = R2.put; R2.put = async () => { throw new Error('R2 caído'); };
  await assert.rejects(galeria.store(env, d1, png, 'png', { prompt: 'otro' }, { ahora }), /R2 caído/);
  R2.put = rotos;
  const { results } = await d1.prepare('select file from estudio_archivos').all(); assert.deepEqual(results.map((r) => r.file), [a.file], 'sin archivo no queda ficha');
  const b = await galeria.store(env, d1, Buffer.concat([png, Buffer.from('x')]), 'png', { prompt: 'mismo' }, { ahora });
  assert.notEqual(b.file, a.file); assert.deepEqual(R2._m.get(a.file).buf, png, 'el primero no se pisó');
});

test('/media/<clave> a través de las rutas: con sesión sirve el archivo, sin sesión no', { skip: SALTAR }, async () => {
  const { env, d1, cookie } = await montar();
  const it = await galeria.store(env, d1, png, 'png', { prompt: 'servida' });
  const url = 'https://oficina.test/media/' + encodeURI(it.file);
  const sin = await manejar(new Request(url), env); assert.notEqual(sin.status, 200, 'sin sesión no sale'); assert.equal(sin.headers.get('content-type')?.startsWith('image/'), false);
  const con = await manejar(new Request(url, { headers: { cookie } }), env); assert.equal(con.status, 200); assert.equal(con.headers.get('content-type'), 'image/png'); assert.deepEqual(Buffer.from(await con.arrayBuffer()), png);
  assert.equal((await manejar(new Request('https://oficina.test/media/2026-10/no-existe.png', { headers: { cookie } }), env)).status, 404);
});
