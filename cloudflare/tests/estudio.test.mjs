// El Estudio en la nube (fase 8a): galería en R2 + D1, trabajos por pasos, motores de mentira, topes y permisos.
// Los motores son dobles locales (http en 127.0.0.1) puestos con las variables AO_*_BASE: jamás la red real ni una llave real.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { manejar } from '../worker/lib/rutas.js';
import { MODULOS } from '../worker/modulos/index.js';
import * as estudio from '../worker/modulos/estudio.js';
import { servirMedia } from '../worker/modulos/estudio.js';
import * as trabajos from '../worker/lib/estudio/trabajos.js';
import * as galeria from '../worker/lib/estudio/galeria.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';
import { standIn as minimaxStand, KEY as MMX_KEY, png as pngMmx, mp3 } from '../../tests/minimax-stand.mjs';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 4, 0, 0, 0, 2, 0]), Buffer.alloc(30)]);
const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(64, 7)]);

/** Un servicio de mentira: guarda lo que le llega y contesta lo que el test diga. */
async function stand(answer) {
  const seen = [];
  const srv = http.createServer((req, res) => { const ch = []; req.on('data', (d) => ch.push(d)); req.on('end', () => {
    const raw = Buffer.concat(ch).toString('utf8'); let body = null; try { body = raw ? JSON.parse(raw) : null; } catch { body = raw.slice(0, 80); }
    const base = `http://127.0.0.1:${srv.address().port}`; seen.push({ method: req.method, url: req.url, body, auth: req.headers.authorization, key: req.headers['x-goog-api-key'] });
    const a = answer(req, base, seen.length);
    if (Buffer.isBuffer(a)) { res.writeHead(200, { 'content-type': 'image/png' }); res.end(a); } else { res.writeHead(a?._estado || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(a)); }
  }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { seen, base: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

async function montar(extra = {}, rol = 'admin') {
  const d1 = crearD1(), admin = await sembrar(d1, { rol }), R2 = crearR2();
  const env = { ...envDePrueba(d1), MEDIA: R2, ...extra };
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const api = async (ruta, o = {}) => { const res = await pedir(manejar, env, ruta, { ...o, cookie }); const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { /* binario */ } return { status: res.status, j, res, t }; };
  return { d1, env, R2, cookie, api };
}
const esperar = async (fn, { veces = 40 } = {}) => { for (let i = 0; i < veces; i++) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 25)); } throw new Error('no llegó a pasar'); };
const dataUrl = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;

test('el módulo del Estudio se registra con sus grupos y los grupos no se repiten', () => {
  assert.ok(MODULOS.includes(estudio));
  assert.deepEqual(estudio.grupos.sort(), ['media', 'voces']);
});

test('sin sesión no sale nada; con rol «lectura» solo se mira', { skip: SALTAR }, async () => {
  const { env, d1 } = await montar();
  assert.equal((await pedir(manejar, env, '/api/media')).status, 401);
  assert.equal((await pedir(manejar, env, '/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'x' } })).status, 401);
  const L = await montar({}, 'lectura');
  assert.equal((await L.api('/api/media')).status, 200);
  for (const [ruta, metodo] of [['/api/media/jobs', 'POST'], ['/api/media/folders', 'POST'], ['/api/media/upload', 'POST'], ['/api/media/trash/purge', 'POST'], ['/api/voces/design', 'POST']])
    assert.equal((await L.api(ruta, { metodo, cuerpo: {} })).status, 403, ruta);
  void d1;
});

test('GET /api/media: la misma forma que la oficina local (galería + catálogo + estado de los motores)', { skip: SALTAR }, async () => {
  const { api } = await montar({ GEMINI_API_KEY: 'g-prueba' });
  const { status, j } = await api('/api/media?catalog=1');
  assert.equal(status, 200);
  // las claves de serve.mjs → GET /api/media: la página (≈ src/studio.js load) lee exactamente estas
  for (const k of ['folders', 'items', 'total', 'next', 'counts', 'rev', 'budget', 'engines', 'models', 'jobs', 'providers', 'default', 'editModels', 'departments']) assert.ok(k in j, k);
  assert.deepEqual(Object.keys(j.counts).sort(), ['agent', 'all', 'fav', 'music', 'none', 'up', 'video', 'voice', 'you']);
  const g = j.engines.find((e) => e.id === 'gemini'), h = j.engines.find((e) => e.id === 'higgsfield');
  assert.equal(g.on, true); assert.equal(h.on, false);
  assert.match(h.how, /secreto.*GitHub/, 'cómo activarlo EN LA NUBE (no «setx» en Windows)');
  assert.ok(j.models.find((m) => m.id === 'nano-banana-2').on, 'el modelo se enciende con la llave del Worker');
  assert.ok(!JSON.stringify(j).includes('g-prueba'), 'la llave nunca sale en una respuesta');
  assert.equal(j.default.image !== undefined, true);
  const pagina = (await api('/api/media?n=5')).j; // paginado sin catálogo
  assert.deepEqual(Object.keys(pagina).sort(), ['counts', 'folders', 'items', 'next', 'rev', 'total']);
});

test('con la tarjeta de prueba (gratis): pedir, que salga a la galería con su clave, servirla, favorito, carpeta, papelera y recuperar', { skip: SALTAR }, async () => {
  const { api, R2, env, d1 } = await montar();
  const nuevo = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'Un gato naranja en una silla', kind: 'image', model: 'prueba', n: 2, settings: { aspectRatio: '1:1' } } });
  assert.equal(nuevo.status, 200);
  assert.ok(nuevo.j.budget, 'trae el presupuesto como la local');
  const hecho = nuevo.j.job.state === 'done' ? nuevo.j.job : (await esperar(async () => { const r = (await api('/api/media/jobs')).j.jobs[0]; return r.state === 'done' && r; }));
  assert.equal(hecho.items.length, 2);
  const [f1, f2] = hecho.items;
  assert.match(f1, /^\d{4}-\d{2}\/\d{4}-\d{2}-\d{2} un-gato-naranja-en-una-silla \d{6}(-\d+)?\.svg$/, 'la MISMA convención de clave que la oficina local');
  assert.ok(R2._m.has(f1) && R2._m.has(f2), 'los bytes están en R2 con esa clave');
  assert.notEqual(f1, f2);
  // la ficha, como el .json de al lado
  const it = (await api('/api/media/item/' + encodeURIComponent(f1))).j;
  for (const k of ['id', 'file', 'kind', 'ext', 'at', 'prompt', 'provider', 'model', 'modelName', 'settings', 'by', 'job']) assert.ok(k in it, k);
  assert.equal(it.by, 'you'); assert.equal(it.kind, 'image'); assert.equal(it.w, 1024);
  // servir: exige sesión, un SVG va en jaula, rangos
  const dentro = await servirMedia({ req: new Request('https://x/media/' + encodeURI(f1)), env, db: d1, ruta: '/media/' + encodeURI(f1) });
  assert.equal(dentro.status, 200); assert.match(dentro.headers.get('content-security-policy'), /sandbox/); assert.equal(dentro.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await servirMedia({ req: new Request('https://x/media/../etc'), env, db: d1, ruta: '/media/../etc' })).status, 404);
  const rango = await servirMedia({ req: new Request('https://x/m', { headers: { range: 'bytes=0-9' } }), env, db: d1, ruta: '/media/' + encodeURI(f1) });
  assert.equal(rango.status, 206); assert.equal((await rango.arrayBuffer()).byteLength, 10);
  // favoritos y «usado»
  assert.equal((await api('/api/media/item/' + encodeURIComponent(f1), { metodo: 'PATCH', cuerpo: { fav: true } })).j.fav, true);
  assert.equal((await api('/api/media/item/' + encodeURIComponent(f1), { metodo: 'PATCH', cuerpo: { used: 'nada' } })).status, 400);
  assert.deepEqual((await api('/api/media/item/' + encodeURIComponent(f1), { metodo: 'PATCH', cuerpo: { used: 'pieza' } })).j.used, ['pieza']);
  // carpetas: crear con archivos, renombrar, repetida, mover, borrar (los archivos se quedan)
  const c = await api('/api/media/folders', { metodo: 'POST', cuerpo: { name: ' Gatos ', files: [f1] } });
  assert.equal(c.j.folder.name, 'Gatos'); assert.equal(c.j.moved, 1); assert.equal(c.j.folders[0].n, 1);
  assert.equal((await api('/api/media/folders', { metodo: 'POST', cuerpo: { name: 'gatos' } })).status, 400);
  assert.equal((await api('/api/media/folders/' + c.j.folder.id, { metodo: 'PATCH', cuerpo: { name: 'Michis' } })).j.folder.name, 'Michis');
  assert.equal((await api('/api/media/move', { metodo: 'POST', cuerpo: { files: [f2], folder: c.j.folder.id } })).j.moved, 1);
  const enCarpeta = (await api('/api/media?folder=' + c.j.folder.id)).j; assert.equal(enCarpeta.total, 2);
  assert.equal((await api('/api/media?filter=fav')).j.total, 1);
  assert.equal((await api('/api/media?q=silla')).j.total, 2);
  assert.equal((await api('/api/media?q=perro')).j.total, 0);
  assert.equal((await api('/api/media/folders/' + c.j.folder.id, { metodo: 'DELETE' })).j.freed, 2);
  assert.equal((await api('/api/media?folder=none')).j.total, 2);
  // papelera: se va, se ve con sus días, se recupera con su nombre de siempre; vaciar la deja sin archivo en R2
  const t = await api('/api/media/item/' + encodeURIComponent(f1), { metodo: 'DELETE' });
  assert.equal(t.status, 200); assert.equal(t.j.undo.id, f1); assert.equal(t.j.undo.bin.length, 2);
  assert.equal((await api('/api/media?n=10')).j.total, 1);
  const bin = (await api('/api/media/trash')).j; assert.equal(bin.days, 30); assert.equal(bin.items[0].daysLeft, 30); assert.equal(bin.items[0].id, f1);
  assert.equal((await api('/api/media/trash/file?n=' + encodeURIComponent(bin.items[0].name))).status, 200, 'la miniatura de la papelera');
  assert.equal((await api('/api/media/trash/file?n=../x')).status, 404);
  assert.equal((await api('/api/media/restore', { metodo: 'POST', cuerpo: { id: f1, bin: ['999-otro.svg'] } })).status, 409);
  assert.equal((await api('/api/media/restore', { metodo: 'POST', cuerpo: t.j.undo })).status, 200);
  assert.equal((await api('/api/media?n=10')).j.total, 2);
  await api('/api/media/item/' + encodeURIComponent(f2), { metodo: 'DELETE' });
  const v = await api('/api/media/trash/purge', { metodo: 'POST', cuerpo: { all: true } });
  assert.equal(v.j.removed, 2); assert.ok(!R2._m.has(f2), 'borrar para siempre quita también el archivo de R2');
  assert.equal((await api('/api/media/item/' + encodeURIComponent(f2))).status, 404);
});

test('el nombre de un archivo nunca se reutiliza, ni el de uno que está en la papelera', { skip: SALTAR }, async () => {
  const { env, d1, R2 } = await montar();
  const ahora = Date.parse('2026-10-25T15:30:12Z');
  const a = await galeria.store(env, d1, png, 'png', { prompt: 'Mismo prompt' }, { ahora });
  assert.match(a.file, /^2026-10\/2026-10-25 mismo-prompt 103012\.png$/, 'el día y la hora son los del dueño (Panamá), no los de UTC');
  await galeria.trash(d1, a.file);
  const b = await galeria.store(env, d1, png, 'png', { prompt: 'Mismo prompt' }, { ahora });
  assert.notEqual(b.file, a.file); assert.match(b.file, / 103012-2\.png$/);
  assert.ok(R2._m.has(a.file) && R2._m.has(b.file));
});

test('subir: se reconoce por sus primeros bytes, con tope y sin SVG; zip de varios', { skip: SALTAR }, async () => {
  const { api } = await montar();
  const ok = await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'Mi producto.png', data: dataUrl(png, 'image/png') } });
  assert.equal(ok.status, 200); assert.equal(ok.j.item.upload, true); assert.equal(ok.j.item.provider, 'subida'); assert.equal(ok.j.item.w, 1024);
  assert.equal((await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'x.png', data: dataUrl(Buffer.from('<script>alert(1)</script>'), 'image/png') } })).status, 400);
  assert.equal((await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'x.svg', data: dataUrl(Buffer.from('<svg/>'), 'image/svg+xml') } })).status, 400);
  const v = await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'clip', data: dataUrl(mp4, 'video/mp4') } });
  assert.equal(v.j.item.kind, 'video');
  const z = await api('/api/media/zip', { metodo: 'POST', cuerpo: { ids: [ok.j.item.file, v.j.item.file, 'no/existe.png'] } });
  assert.equal(z.status, 200); assert.equal(z.res.headers.get('content-type'), 'application/zip');
  assert.equal((await api('/api/media/zip', { metodo: 'POST', cuerpo: { ids: ['nada.png'] } })).status, 404);
});

test('un motor de pago: el editor no puede, el administrador sí; se avanza en el cron, queda en R2, gasta una vez y respeta el tope', { skip: SALTAR }, async () => {
  const g = await stand((req) => (/generateContent/.test(req.url) ? { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] } : {}));
  try {
    const clave = 'g-prueba-123456'; // secrets-ok: una llave inventada del doble de prueba
    const { api, env, d1, R2 } = await montar({ GEMINI_API_KEY: clave, AO_GEMINI_BASE: g.base });
    await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: 0.2 } });
    const caro = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'x', model: 'nano-banana-pro', kind: 'image', n: 8 } });
    assert.equal(caro.status, 400); assert.match(caro.j.error, /presupuesto del día del Estudio/);
    await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: 0 } });

    const e = await montar({ GEMINI_API_KEY: clave, AO_GEMINI_BASE: g.base }, 'editor');
    const no = await e.api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'x', model: 'nano-banana-2', kind: 'image' } });
    assert.equal(no.status, 403); assert.match(no.j.error, /administrador/);
    assert.equal(g.seen.length, 0, 'el editor no llegó a gastar nada');

    const p = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'Lentes sobre mármol', model: 'nano-banana-2', kind: 'image', n: 1, settings: { aspectRatio: '4:5' } } });
    assert.equal(p.status, 200); assert.equal(p.j.job.state, 'queued', 'una imagen de pago no espera dentro de la petición: la avanza el cron');
    assert.equal(g.seen.length, 0);
    await estudio.cadaMinuto(env); // el reloj de cada minuto
    const h = await esperar(async () => { const j = (await api('/api/media/jobs')).j.jobs[0]; return j.state === 'done' && j; });
    assert.equal(g.seen.length, 1, 'se envió UNA vez');
    assert.equal(g.seen[0].key, clave, 'la llave del Worker viaja al motor');
    assert.equal(g.seen[0].body.generationConfig.imageConfig.aspectRatio, '4:5');
    assert.ok(R2._m.has(h.items[0])); assert.ok(h.cost > 0);
    assert.ok(!JSON.stringify(h).includes(clave), 'ni la llave ni nada parecido en el trabajo');
    const b = (await api('/api/media/jobs')).j.budget; assert.ok(b.cost > 0 && b.images === 1, 'gastado hoy: ' + JSON.stringify(b));
    await estudio.cadaMinuto(env); assert.equal(g.seen.length, 1, 'otro paso del cron no lo envía otra vez');
    const aud = await d1.prepare("select detalle from auditoria where tipo = 'estudio'").all(); assert.equal(aud.results.length, 1);
    // un archivo que dice ser PNG pero no lo es (un HTML disfrazado) no entra a la galería
    g.seen.length = 0;
    const g2 = await stand(() => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('<html><script>1</script></html>').toString('base64') } }] } }] }));
    try {
      const x = await montar({ GEMINI_API_KEY: clave, AO_GEMINI_BASE: g2.base });
      await x.api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'trampa', model: 'nano-banana-2', kind: 'image' } });
      await estudio.cadaMinuto(x.env);
      const f = (await x.api('/api/media/jobs')).j.jobs[0]; assert.equal(f.state, 'failed'); assert.match(f.error, /no es una imagen|devolvió algo/); assert.equal((await x.api('/api/media?n=5')).j.total, 0);
    } finally { await g2.close(); }
  } finally { await g.close(); }
});

test('un motor con cola (fal video): el id remoto se guarda antes de nada, cada paso solo pregunta, y se completa sin enviar de nuevo', { skip: SALTAR }, async () => {
  let consultas = 0;
  const f = await stand((req, base) => {
    if (req.method === 'POST') return { request_id: 'rq1', status_url: `${base}/fal-ai/kling/requests/rq1/status`, response_url: `${base}/fal-ai/kling/requests/rq1`, cancel_url: 'https://malo.example/robar-la-llave' };
    if (/status/.test(req.url)) return { status: ++consultas < 3 ? 'IN_PROGRESS' : 'COMPLETED' };
    if (/requests\/rq1$/.test(req.url)) return { video: { url: `${base}/archivo.mp4` } };
    return mp4;
  });
  try {
    const { api, env, R2 } = await montar({ FAL_KEY: 'fal-prueba', AO_FAL_QUEUE: f.base });
    const m = (await api('/api/media?catalog=1')).j.models.find((x) => x.engine === 'fal' && x.kind === 'video' && x.on);
    assert.ok(m, 'hay un modelo de video de fal encendido');
    const p = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'Zoom lento', model: m.id, kind: 'video', n: 1} });
    if (p.status !== 200) assert.fail(JSON.stringify(p.j));
    await estudio.cadaMinuto(env);
    let j = (await api('/api/media/jobs')).j.jobs[0];
    assert.equal(j.state, 'running'); assert.equal(j.remote, 1, 'el id remoto quedó apuntado');
    assert.equal(f.seen.filter((x) => x.method === 'POST').length, 1);
    for (let i = 0; i < 6 && j.state !== 'done'; i++) { await estudio.cadaMinuto(env); j = (await api('/api/media/jobs')).j.jobs[0]; }
    assert.equal(j.state, 'done', JSON.stringify(j));
    assert.equal(f.seen.filter((x) => x.method === 'POST').length, 1, 'se envió una sola vez aunque se consultó varias');
    assert.match(j.items[0], /\.mp4$/); assert.ok(R2._m.has(j.items[0]));
    assert.ok(f.seen.every((x) => !/malo\.example/.test(x.url)), 'una dirección de seguimiento ajena no se sigue');
  } finally { await f.close(); }
});

test('un paso que murió a mitad de ENVIAR no se repite: se dice que puede haberse cobrado', { skip: SALTAR }, async () => {
  const g = await stand(() => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }));
  try {
    const { api, env, d1 } = await montar({ GEMINI_API_KEY: 'g-prueba-123456', AO_GEMINI_BASE: g.base });
    const p = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'cortado', model: 'nano-banana-2', kind: 'image' } });
    const id = p.j.job.id;
    // se simula un Worker que murió después de apuntar «voy a enviar» y con el permiso vencido
    const fila = await d1.prepare('select json from estudio_trabajos where id = ?').bind(id).first(); const j = JSON.parse(fila.json);
    Object.assign(j, { state: 'running', enviando: Date.now() - 20 * 60e3, startedAt: Date.now() - 20 * 60e3 });
    d1._db.prepare('update estudio_trabajos set json = ?, estado = ?, lease = ? where id = ?').run(JSON.stringify(j), 'running', Date.now() - 1000, id);
    await estudio.cadaMinuto(env);
    const f = (await api('/api/media/jobs/' + id)).j.job;
    assert.equal(f.state, 'failed'); assert.match(f.error, /puede que ya lo haya cobrado/);
    assert.equal(g.seen.length, 0, 'no volvió a llamar al motor');
    // y el permiso: dos pasos a la vez sobre el mismo trabajo no se pisan
    const q = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'dos a la vez', model: 'nano-banana-2', kind: 'image' } });
    const [a, b] = await Promise.all([trabajos.avanzar(env, d1, q.j.job.id), trabajos.avanzar(env, d1, q.j.job.id)]);
    assert.equal(g.seen.length, 1, 'se envió una sola vez'); assert.equal([a.hizo, b.hizo].filter(Boolean).length, 1);
  } finally { await g.close(); }
});

test('cancelar: uno en cola se cancela sin gastar; olvidar solo lo terminado', { skip: SALTAR }, async () => {
  const g = await stand(() => ({ candidates: [] }));
  try {
    const { api } = await montar({ GEMINI_API_KEY: 'g-prueba-123456', AO_GEMINI_BASE: g.base });
    const p = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'x', model: 'nano-banana-2', kind: 'image' } });
    assert.equal((await api(`/api/media/jobs/${p.j.job.id}`, { metodo: 'DELETE' })).status, 409);
    const c = await api(`/api/media/jobs/${p.j.job.id}/cancel`, { metodo: 'POST' });
    assert.equal(c.j.job.state, 'failed'); assert.equal(c.j.job.error, 'Cancelado por ti.');
    assert.equal((await api(`/api/media/jobs/${p.j.job.id}`, { metodo: 'DELETE' })).status, 200);
    assert.equal((await api('/api/media/jobs/zzzz')).status, 404);
    assert.equal(g.seen.length, 0);
  } finally { await g.close(); }
});

test('lo que depende de sharp o de otras fases contesta 501 en español; la página no se rompe', { skip: SALTAR }, async () => {
  const { api } = await montar();
  for (const r of ['/api/media/plantillas', '/api/media/understand', '/api/media/to-dept']) {
    const x = await api(r); assert.equal(x.status, 501, r); assert.equal(x.j.pendiente, true); assert.match(x.j.error, /nube|equipo|tareas/);
  }
  const loc = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { local: true, prompt: 'x', source: 'a/b.png' } });
  assert.equal(loc.status, 501); assert.match(loc.j.error, /todavía no están en la nube/);
});

test('mejorar el prompt usa el modelo de texto sin llaves a la vista; sin llave, un aviso en español', { skip: SALTAR }, async () => {
  const { api } = await montar();
  const r = await api('/api/media/enhance', { metodo: 'POST', cuerpo: { prompt: 'un cartel', kind: 'image', lang: 'es' } });
  assert.equal(r.status, 502); assert.match(r.j.error, /Falta el secreto ANTHROPIC_API_KEY/);
  assert.equal((await api('/api/media/enhance', { metodo: 'POST', cuerpo: { prompt: '' } })).status, 400);
});

test('los topes se fijan solo por el administrador y con valores válidos', { skip: SALTAR }, async () => {
  const { api } = await montar();
  assert.equal((await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: -3 } })).status, 422);
  assert.equal((await api('/api/media/limites', { metodo: 'PUT', cuerpo: { dailyBudget: 5, concurrency: 99, departments: ['marketing'] } })).j.limites.concurrency, 6);
  assert.equal((await api('/api/media/limites', { metodo: 'PUT', cuerpo: { departments: ['nada'] } })).status, 422);
  assert.equal((await api('/api/media?catalog=1')).j.departments[0], 'marketing');
  assert.equal((await api('/api/media?catalog=1')).j.budget.dailyBudget, 5);
});

test('voces de MiniMax: listar (sin llave: aviso), diseñar y borrar con el doble de MiniMax; clonar pide el consentimiento', { skip: SALTAR }, async () => {
  const sin = await montar();
  const s = await sin.api('/api/voces'); assert.equal(s.status, 409); assert.match(s.j.error, /MINIMAX_API_KEY/);
  const st = await minimaxStand();
  try {
    const { api, d1 } = await montar({ MINIMAX_API_KEY: MMX_KEY, MINIMAX_API_BASE: st.base });
    const l = await api('/api/voces'); assert.equal(l.status, 200); assert.deepEqual(l.j.voices, []); assert.ok(l.j.system.length > 0);
    const d = await api('/api/voces/design', { metodo: 'POST', cuerpo: { name: 'Voz PanaClaw', prompt: 'Mujer cálida, acento panameño', previewText: 'Hola.' } });
    assert.equal(d.status, 200); assert.equal(d.j.voice.kind, 'design'); assert.equal(d.j.voice.pinned, true); assert.equal(Buffer.from(d.j.preview, 'base64').equals(mp3), true);
    assert.equal((await api('/api/voces')).j.voices.length, 1);
    const b = (await api('/api/media?n=0')).j; void b;
    const cargo = (await api('/api/media/jobs')).j.budget; assert.ok(cargo.cost >= 3, 'diseñar una voz cuenta en el día: ' + cargo.cost);
    const c = await api('/api/voces/clone', { metodo: 'POST', cuerpo: { name: 'X', voiceId: 'AbrinayVoz01', audioBase64: mp3.toString('base64'), filename: 'm.mp3' } });
    assert.equal(c.status, 400); assert.match(c.j.error, /confirmación/);
    const v = (await api('/api/voces')).j.voices[0].voiceId;
    assert.equal((await api('/api/voces/' + v, { metodo: 'DELETE' })).j.ok, true);
    assert.equal((await api('/api/voces/' + v, { metodo: 'DELETE' })).status, 404);
    const aud = await d1.prepare("select count(*) n from auditoria where tipo = 'estudio'").first(); assert.equal(aud.n, 1);
  } finally { await st.close(); }
});

test('importar un archivo de la computadora del dueño conserva su clave y su ficha (solo administrador)', { skip: SALTAR }, async () => {
  const { api, env, d1, R2, cookie } = await montar();
  const clave = '2026-09/2026-09-30 un cartel 101010.png';
  await api('/api/migrar/filas', { metodo: 'POST', cuerpo: { coleccion: 'estudio-fichas', filas: [{ id: clave, valor: { id: clave, file: clave, kind: 'image', ext: 'png', at: 1790000000000, prompt: 'Un cartel', model: 'nano-banana-2', fav: true }, orden: 1790000000000 }] } });
  const res = await pedir(manejar, env, '/api/media/archivo/' + encodeURIComponent(clave), { metodo: 'PUT', cookie }); void res;
  const put = await manejar(new Request('https://oficina.test/api/media/archivo/' + encodeURIComponent(clave), { method: 'PUT', headers: { cookie }, body: png }), env);
  assert.equal(put.status, 200);
  const it = (await api('/api/media/item/' + encodeURIComponent(clave))).j; assert.equal(it.fav, true); assert.equal(it.prompt, 'Un cartel'); assert.ok(R2._m.has(clave));
  const falso = await manejar(new Request('https://oficina.test/api/media/archivo/' + encodeURIComponent('2026-09/otro.png'), { method: 'PUT', headers: { cookie }, body: Buffer.from('<html>') }), env);
  assert.equal(falso.status, 422);
  const E = await montar({}, 'editor');
  const no = await manejar(new Request('https://oficina.test/api/media/archivo/' + encodeURIComponent(clave), { method: 'PUT', headers: { cookie: E.cookie }, body: png }), E.env);
  assert.equal(no.status, 403); void d1;
});
