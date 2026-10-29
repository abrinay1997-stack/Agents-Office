// Fase 4 D: los retoques de foto en la nube con el binding IMAGES. El binding es una FALSIFICACIÓN hecha con sharp (decodifica a RGBA y vuelve a JPEG):
// prueba nuestro cableado, no el binding real de Cloudflare (que no se pudo probar aquí: ver docs/plan-estado/carril-d.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { manejar } from '../worker/lib/rutas.js';
import * as estudio from '../worker/modulos/estudio.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';
import { codificarPng, retocar, OPS_NUBE, motivoPreset, MAX_LADO, hayRetoques } from '../worker/lib/estudio/retoques.js';
import { cargarFabrica } from '../../presets/fabrica-worker.js';

let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* sin sharp en esta máquina */ }
const SIN = SALTAR || (sharp ? false : 'sin sharp para falsificar IMAGES');
const CLAVE = 'g-prueba-123456'; // secrets-ok: una llave inventada del doble de prueba
const leerTodo = async (s) => Buffer.from(await new Response(s).arrayBuffer());

/** IMAGES de mentira: info, input(...).transform(...).output({ format: 'rgba' | 'image/jpeg' | 'image/png' }). */
function imagenes(visto = []) {
  return {
    async info(s) { const b = await leerTodo(s), m = await sharp(b).metadata(); visto.push('info'); return { format: 'image/' + m.format, width: m.width, height: m.height, fileSize: b.length }; },
    input(s) {
      let t = {};
      return { transform(x) { t = x || {}; return this; },
        async output(o) {
          let img = sharp(await leerTodo(s)).rotate();
          if (t.width) img = img.resize(t.width, t.height, { fit: 'fill' });
          if (t.background) img = img.flatten({ background: t.background });
          visto.push('output:' + o.format);
          const data = o.format === 'rgba' ? await img.ensureAlpha().raw().toBuffer() : o.format === 'image/jpeg' ? await img.jpeg({ quality: o.quality || 90 }).toBuffer() : await img.png().toBuffer();
          return { response: () => new Response(data) };
        } };
    },
  };
}
const foto = (w = 64, h = 48, c = { r: 90, g: 90, b: 90 }) => sharp({ create: { width: w, height: h, channels: 3, background: c } }).png().toBuffer();
const dataUrl = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;
const media = async (b) => (await sharp(b).stats()).channels[0].mean;

async function montar(extra = {}, rol = 'admin') {
  const d1 = crearD1(), admin = await sembrar(d1, { rol }), R2 = crearR2();
  const env = { ...envDePrueba(d1), MEDIA: R2, ...extra };
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const api = async (ruta, o = {}) => { const res = await pedir(manejar, env, ruta, { ...o, cookie }); const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { /* binario */ } return { status: res.status, j, t }; };
  return { d1, env, R2, api };
}
const encender = (api) => api('/api/media/limites', { metodo: 'PUT', cuerpo: { retoquesNube: true } });
const subir = async (api, buf, mime) => (await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: 'bodega', data: dataUrl(buf, mime) } })).j.item.file;

test('el interruptor retoquesNube: apagado por defecto, solo verdadero o falso, y sin el binding IMAGES no hace nada', { skip: SIN }, async () => {
  const { api, env } = await montar({ IMAGES: imagenes() });
  assert.equal(hayRetoques(env, {}), false);
  assert.equal((await api('/api/media/limites', { metodo: 'PUT', cuerpo: { retoquesNube: 'si' } })).status, 422);
  assert.equal((await api('/api/media/limites')).j.limites.retoquesNube, undefined);
  assert.equal((await encender(api)).status, 200);
  assert.equal(hayRetoques(env, { retoquesNube: true }), true);
  assert.equal(hayRetoques({}, { retoquesNube: true }), false, 'sin IMAGES no se puede');
});

test('la lista: apagado todo lo local sale «solo en la oficina»; encendido, solo lo que IMAGES + píxeles puros pueden; el resto dice por qué', { skip: SIN }, async () => {
  const { api } = await montar({ IMAGES: imagenes(), GEMINI_API_KEY: CLAVE });
  const apagado = (await api('/api/media/presets?medio=image')).j.presets;
  assert.equal(apagado.find((p) => p.id === 'luz-mas-clara').on, false);
  await encender(api);
  const l = (await api('/api/media/presets?medio=image')).j;
  const por = (id) => l.presets.find((p) => p.id === id);
  assert.equal(l.sharp, true);
  assert.equal(por('luz-mas-clara').on, true); assert.equal(por('color-bn').on, true); assert.equal(por('fondo-blanco').on, true);
  for (const id of ['enc-distancia', 'cal-nitidez', 'sal-canal']) { assert.equal(por(id).on, false, id); assert.match(por(id).motivo, /todavía no está en la nube/, id); }
  // la tabla y la lista dicen lo mismo: un preset está activo solo si TODOS sus pasos están en OPS_NUBE
  const fab = cargarFabrica();
  for (const p of fab.presets.filter((x) => x.ejecutor === 'local' && x.medios.includes('image'))) assert.equal(por(p.id).on, !motivoPreset(p), p.id);
  const activos = fab.presets.filter((p) => p.ejecutor === 'local' && !motivoPreset(p)).map((p) => p.id);
  assert.ok(activos.length >= 10 && activos.length < 31, 'activos en la nube de los 31 locales: ' + activos.join(','));
});

test('todo local: una versión nueva de TU foto, gratis y sin IA; el original queda intacto y el trabajo queda en el historial', { skip: SIN }, async () => {
  const visto = [], g = await (async () => { const seen = []; const srv = http.createServer((q, r) => { seen.push(q.url); r.end('{}'); }); await new Promise((o) => srv.listen(0, '127.0.0.1', o)); return { seen, base: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((o) => srv.close(o)) }; })();
  try {
    const { api, R2 } = await montar({ IMAGES: imagenes(visto), GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    const original = await foto(); const id = await subir(api, original);
    const apagado = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['luz-mas-clara'], entradas: { foto: [id] } } });
    assert.equal(apagado.status, 400); assert.match(apagado.j.error, /nube/);
    await encender(api);
    const r = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['luz-mas-clara'], entradas: { foto: [id] } } });
    assert.equal(r.status, 200, r.t);
    const j = r.j.jobs[0]; assert.equal(j.state, 'done'); assert.equal(j.cost, 0); assert.equal(j.engineName, 'En tu máquina'.replace('tu máquina', 'tu máquina')); assert.equal(j.items.length, 1);
    const nuevo = (await api('/api/media/item/' + encodeURIComponent(j.items[0]))).j;
    assert.equal(nuevo.versionOf, id); assert.equal(nuevo.provider, 'local'); assert.equal(nuevo.preset[0].id, 'luz-mas-clara'); assert.equal(nuevo.qa, undefined, 'sin QA inventada');
    assert.ok(nuevo.post.pasos.some((p) => p.op === 'exposicion' && p.hecho));
    const bytes = Buffer.from(await R2.get(j.items[0]).then((o) => o.arrayBuffer()));
    assert.ok(await media(bytes) > await media(original) + 5, 'se ve más clara');
    assert.ok((await api('/api/media/item/' + encodeURIComponent(id))).j.versions.includes(j.items[0]), 'el original sabe de su versión');
    assert.deepEqual(Buffer.from(await R2.get(id).then((o) => o.arrayBuffer())), original, 'el original no se toca');
    assert.equal((await api('/api/media/jobs')).j.jobs.find((x) => x.id === j.id)?.state, 'done', 'queda en el historial de trabajos');
    assert.equal(g.seen.length, 0, 'no llamó a ningún motor'); assert.ok(visto.includes('output:rgba'));
    // un retoque que IMAGES no hace: 400 con el motivo, y nada se crea
    const antes = (await api('/api/media?n=50')).j.total;
    const no = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['enc-distancia'], entradas: { foto: [id] } } });
    assert.equal(no.status, 400); assert.match(no.j.error, /todavía no está en la nube/);
    assert.equal((await api('/api/media?n=50')).j.total, antes);
    // sin foto
    const sf = await api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['luz-mas-clara'] } }); assert.equal(sf.status, 400);
  } finally { await g.close(); }
});

test('con IA: lo de DESPUÉS (fondo blanco) lo hace el cron con IMAGES sobre lo que devuelve el modelo; si el retoque falla, va la imagen del modelo y se dice', { skip: SIN }, async () => {
  const salida = await foto(64, 48, { r: 200, g: 60, b: 60 }); // lo que «generó» el modelo: rojo liso
  const g = await (async () => { const seen = []; const srv = http.createServer((q, r) => { const ch = []; q.on('data', (d) => ch.push(d)); q.on('end', () => { seen.push(q.url); r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: salida.toString('base64') } }] } }] })); }); }); await new Promise((o) => srv.listen(0, '127.0.0.1', o)); return { seen, base: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((o) => srv.close(o)) }; })();
  try {
    const m = await montar({ IMAGES: imagenes(), GEMINI_API_KEY: CLAVE, AO_GEMINI_BASE: g.base });
    await encender(m.api);
    const id = await subir(m.api, await foto());
    const c = await m.api('/api/media/presets/compile', { metodo: 'POST', cuerpo: { pila: ['fondo-blanco'], entradas: { foto: [id] } } });
    assert.deepEqual(c.j.plan.errores, [], c.t);
    const r = await m.api('/api/media/presets/apply', { metodo: 'POST', cuerpo: { pila: ['fondo-blanco'], entradas: { foto: [id] } } });
    assert.equal(r.status, 200, r.t); assert.equal(r.j.jobs[0].state, 'queued'); assert.equal(g.seen.length, 0);
    await estudio.cadaMinuto(m.env);
    const h = (await m.api('/api/media/jobs')).j.jobs.find((x) => x.id === r.j.jobs[0].id); assert.equal(h.state, 'done', JSON.stringify(h));
    const it = (await m.api('/api/media/item/' + encodeURIComponent(h.items[0]))).j;
    assert.ok(it.post?.pasos?.some((p) => p.op === 'fondo-blanco'), 'el fondo blanco corrió en la nube: ' + JSON.stringify(it.post));
    assert.equal(it.qa, undefined);
    assert.equal(g.seen.length >= 1, true);
  } finally { await g.close(); }
});

test('codificarPng produce un PNG válido (lo lee sharp con los mismos píxeles) y retocar reduce lo que pasa de MAX_LADO y lo dice', { skip: SIN }, async () => {
  const data = Buffer.alloc(8 * 4 * 4); for (let i = 0; i < data.length; i += 4) { data[i] = i; data[i + 1] = 255 - i; data[i + 2] = 7; data[i + 3] = 255; }
  const png = await codificarPng({ data, width: 8, height: 4 });
  const { data: leido, info } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 8); assert.equal(info.height, 4); assert.equal(Buffer.compare(leido, data), 0, 'los mismos píxeles');
  const grande = await sharp({ create: { width: 3000, height: 100, channels: 3, background: '#808080' } }).jpeg().toBuffer();
  const r = await retocar({ IMAGES: imagenes() }, grande, [{ op: 'exposicion', ev: 0.4 }]);
  assert.equal(r.ancho, MAX_LADO); assert.match(r.avisos[0], /más grande/); assert.equal(r.ext, 'jpg');
  await assert.rejects(() => retocar({ IMAGES: imagenes() }, grande, [{ op: 'encuadrar' }]), /todavía no está en la nube/);
  assert.ok(OPS_NUBE.has('fondo-blanco') && !OPS_NUBE.has('exportar'));
});

test('si el binding no devuelve píxeles crudos, el retoque dice por qué y no guarda nada roto', { skip: SIN }, async () => {
  const roto = { info: async () => ({ format: 'image/png', width: 4, height: 4 }), input: () => ({ transform() { return this; }, output: async () => ({ response: () => new Response(new Uint8Array(5)) }) }) };
  const chica = await foto(4, 4);
  await assert.rejects(() => retocar({ IMAGES: roto }, chica, [{ op: 'exposicion', ev: 0.4 }]), /otra cosa|no pudo leer los píxeles/);
});

test('POST /api/media/jobs con pasos de retoque a mano sigue en 501: el rastro del banco solo lo pone el módulo de presets', { skip: SIN }, async () => {
  const { api } = await montar({ IMAGES: imagenes() });
  await encender(api);
  const r = await api('/api/media/jobs', { metodo: 'POST', cuerpo: { prompt: 'x', kind: 'image', model: 'prueba', post: [{ op: 'fondo-blanco' }] } });
  assert.equal(r.status, 501);
});
