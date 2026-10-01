// Banco de presets, integración F1 (presets.mjs + media/trabajos.mjs + media/posproceso.mjs). Run: npm test
// De punta a punta sin keys reales: lo local corre con sharp en esta máquina; la IA es un Google de mentira en 127.0.0.1 que
// guarda lo que la oficina le manda (como tests/google.test.mjs). Compilar no gasta; aplicar sí, y pasa por los topes.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as media from '../media.mjs';
import { crearPresets, cifrasComoObjeto, pedidoLimpio } from '../presets.mjs';
import { readVault } from '../graph-build.mjs';
import * as L from '../imagen-local.mjs';

let sharp = null; try { sharp = (await import('sharp')).default; } catch {}
const conSharp = { skip: sharp ? false : 'sin sharp en esta máquina' };

/** Una foto de bodega de mentira: pared gris clara, un mueble oscuro en el centro. */
async function fotoBodega(w = 640, h = 480, fondo = { r: 222, g: 218, b: 210 }) {
  const mueble = await sharp({ create: { width: Math.round(w * 0.5), height: Math.round(h * 0.4), channels: 3, background: { r: 120, g: 82, b: 50 } } }).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 3, background: fondo } }).composite([{ input: mueble, left: Math.round(w * 0.25), top: Math.round(h * 0.35) }]).png().toBuffer();
}
const dataUrl = buf => 'data:image/png;base64,' + buf.toString('base64');

function entorno() {
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-presets-'));
  const data = path.join(brain, 'data');
  media.configure({ media: { dailyLimit: 0 } }, brain, data);
  let notas = 0;
  const P = crearPresets({ brainPath: brain, dataDir: data, cifras: () => [{ name: 'Precio', value: '199' }], onNota: () => { notas++; } });
  return { brain, data, P, notas: () => notas };
}
async function stand() {
  const seen = [];
  const out = await fotoBodega(1024, 1024, { r: 250, g: 250, b: 250 });
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
      seen.push({ url: req.url, body: b ? JSON.parse(b) : null });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: out.toString('base64') } }] } }] }));
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, seen, base: `http://127.0.0.1:${srv.address().port}` };
}
const sinKeys = () => { const k = {}; for (const e of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'AO_GEMINI_BASE', 'XAI_API_KEY', 'OPENAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'FAL_KEY', 'HF_KEY', 'HF_API_KEY', 'HF_API_SECRET', 'MINIMAX_API_KEY']) { k[e] = process.env[e]; delete process.env[e]; } return () => { for (const [e, v] of Object.entries(k)) { if (v === undefined) delete process.env[e]; else process.env[e] = v; } }; };

test('pedidoLimpio y las cifras: nada pasa sin forma conocida', () => {
  const p = pedidoLimpio({ pila: ['luz-mas-clara', { id: '../x' }, { id: 'libre', texto: 'hola\u0001' }, { id: 'fondo-blanco', params: { intensidad: 'fuerte' } }], entradas: { foto: ['a.png', 7], referencias: [{ id: 'r.png', ejes: { color: 9, estilo: -1, raro: 2 } }] }, escena: { camara: { altura: -50 } } });
  assert.deepEqual(p.pila.map(x => x.id), ['luz-mas-clara', 'libre', 'fondo-blanco']);
  assert.equal(p.pila[1].texto, 'hola');
  assert.deepEqual(p.entradas.foto, ['a.png']);
  assert.deepEqual(p.entradas.referencias[0].ejes, { estilo: 0, color: 3 });
  assert.ok(p.escena.camara.altura >= 0, 'el piso es el cero');
  assert.deepEqual(cifrasComoObjeto([{ name: 'Precio de la cama', value: ' 199 ' }, { name: 'vacía', value: '' }]), { precio_de_la_cama: '199' });
});

test('«Que se vea más clara»: compilar no gasta; aplicar hace un trabajo local, gratis, que no toca el original', conSharp, async () => {
  const back = sinKeys();
  try {
    const { P } = entorno();
    const foto = media.upload({ name: 'cama bodega.png', data: dataUrl(await fotoBodega()) });
    const antes = media.budget();
    const { plan } = P.compilar({ pila: ['luz-mas-clara'], entradas: { foto: [foto.file] } });
    assert.equal(plan.soloLocal, true); assert.equal(plan.model, null); assert.equal(plan.costo.usd, 0);
    assert.deepEqual(media.jobs(), [], 'compilar no crea trabajos');
    const { jobs } = await P.aplicar({ pila: ['luz-mas-clara'], entradas: { foto: [foto.file] } });
    assert.equal(jobs[0].engine, 'local');
    const j = await media.wait(jobs[0].id, 20000);
    assert.equal(j.state, 'done', j.error);
    const it = media.item(j.items[0]);
    assert.equal(it.versionOf, foto.file, 'el resultado es una versión');
    assert.ok(it.post.pasos.some(s => s.op === 'exposicion' && s.hecho));
    assert.deepEqual(it.preset.map(x => x.id), ['luz-mas-clara']);
    const a = await L.leer(fs.readFileSync(media.resolve(foto.file))), b = await L.leer(fs.readFileSync(media.resolve(j.items[0])));
    const media0 = r => { let s = 0; for (let i = 0; i < r.data.length; i += 4) s += r.data[i]; return s / (r.data.length / 4); };
    assert.ok(media0(b) > media0(a) + 5, 'más clara de verdad');
    assert.equal(media.budget().cost, antes.cost, 'lo local no cuesta');
    assert.equal(media.item(foto.file).versions?.includes(j.items[0]), true, 'el original lista su versión y su archivo no cambia');
  } finally { back(); }
});

test('«Copiar el color de una foto»: local, con la referencia por ejes y la QA ΔE', conSharp, async () => {
  const back = sinKeys();
  try {
    const { P } = entorno();
    const foto = media.upload({ name: 'producto.png', data: dataUrl(await fotoBodega()) });
    const ref = media.upload({ name: 'ref calida.png', data: dataUrl(await fotoBodega(640, 480, { r: 250, g: 190, b: 120 })) });
    const { plan } = P.compilar({ pila: ['ref-color'], entradas: { foto: [foto.file], referencias: [{ id: ref.file, ejes: { color: 3, estilo: 0 } }] } });
    assert.equal(plan.soloLocal, true, plan.errores.join());
    assert.ok(plan.local.antes.some(o => o.op === 'transferir-color' && o.ref === ref.file));
    const { jobs } = await P.aplicar({ pila: ['ref-color'], entradas: { foto: [foto.file], referencias: [{ id: ref.file, ejes: { color: 3, estilo: 0 } }] } });
    const j = await media.wait(jobs[0].id, 20000);
    assert.equal(j.state, 'done', j.error);
    const it = media.item(j.items[0]);
    assert.ok(it.post.pasos.find(s => s.op === 'transferir-color').hecho, 'el color se copió');
    const de = it.qa?.checks.find(c => c.id === 'delta-e');
    assert.ok(de && de.ok === null && /a propósito/.test(de.motivo), 'el color cambió a propósito: la QA lo dice «no medido», no un «revisar» falso');
    assert.equal(it.qa.estado, 'ok');
  } finally { back(); }
});

test('«Fondo blanco» + «Exportar para un canal» con un Google de mentira: la IA, luego el 255 y el canal aquí, y la QA', conSharp, async () => {
  const back = sinKeys(); const { srv, seen, base } = await stand();
  Object.assign(process.env, { GEMINI_API_KEY: 'prueba-key', AO_GEMINI_BASE: base });
  try {
    const { P } = entorno();
    const foto = media.upload({ name: 'cama.png', data: dataUrl(await fotoBodega()) });
    const pedido = { pila: ['fondo-blanco', { id: 'sal-canal', params: { canal: 'web' } }], entradas: { foto: [foto.file] } };
    const { plan } = P.compilar(pedido);
    assert.ok(plan.model && /nano-banana/.test(plan.model), plan.errores.join());
    assert.equal(seen.length, 0, 'compilar no llama al motor');
    const { jobs } = await P.aplicar(pedido);
    const j = await media.wait(jobs[0].id, 30000);
    assert.equal(j.state, 'done', j.error);
    assert.equal(seen.length, 1, 'una sola llamada');
    const it = media.item(j.items[0]);
    assert.ok(it.post.pasos.some(s => s.op === 'fondo-blanco' && s.hecho));
    assert.ok(it.post.pasos.some(s => s.op === 'exportar' && s.hecho));
    assert.equal(it.w, 2048, 'el tamaño del canal Web PanaClaw'); assert.ok(it.file.endsWith('.webp'));
    const fondo = it.qa.checks.find(c => c.id === 'fondo-255'); assert.equal(fondo.ok, true, fondo.motivo);
    assert.ok(fs.readdirSync(path.join(media.dir(), '.crudo')).some(f => f.startsWith(j.id)), 'el crudo del modelo se guarda 7 días');
  } finally { srv.close(); back(); }
});

test('«Catálogo para la web»: lo de antes (luz y color) se hace sobre tu foto ANTES de la IA; lo de después, sobre el resultado', conSharp, async () => {
  const back = sinKeys(); const { srv, seen, base } = await stand();
  Object.assign(process.env, { GEMINI_API_KEY: 'prueba-key', AO_GEMINI_BASE: base });
  try {
    const { P } = entorno();
    const foto = media.upload({ name: 'cama.png', data: dataUrl(await fotoBodega()) });
    const { jobs, plan } = await P.aplicar({ pila: ['cat-web-panaclaw'], entradas: { foto: [foto.file] } });
    assert.ok(plan.local.antes.length > 0, 'la receta trae luz y color');
    const j = await media.wait(jobs[0].id, 30000); assert.equal(j.state, 'done', j.error);
    const prep = media.item(j.media.reference[0]);
    assert.notEqual(prep.file, foto.file, 'a la IA va la copia preparada'); assert.equal(prep.prep, true); assert.equal(prep.versionOf, foto.file);
    assert.ok(prep.post.pasos.some(s => s.op === 'balance' && s.hecho));
    assert.equal(j.versionOf, foto.file, 'el resultado sigue siendo versión de tu foto');
    const it = media.item(j.items[0]);
    assert.ok(!it.post.pasos.some(s => s.op === 'balance'), 'la luz y el color no se repiten sobre el resultado');
    assert.deepEqual(it.post.pasos.map(s => s.op), ['fondo-blanco', 'encuadrar', 'exportar']);
    assert.equal(seen.length, 1);
  } finally { srv.close(); back(); }
});

test('«Sala» con escenario 3D: la imagen guía y la escena en palabras llegan en la petición; la ocupación se compara con la estimada', conSharp, async () => {
  const back = sinKeys(); const { srv, seen, base } = await stand();
  Object.assign(process.env, { GEMINI_API_KEY: 'prueba-key', AO_GEMINI_BASE: base });
  try {
    const { P } = entorno();
    const foto = media.upload({ name: 'cama.png', data: dataUrl(await fotoBodega()) });
    const escena = { producto: { tipo: 'cama-queen', ancho: 160, alto: 50, fondo: 200 }, camara: { distancia: 500, azimut: 35, altura: 140, lente: 35 }, cuadro: { proporcion: '4:5' }, fondo: { tipo: 'locacion', valor: 'sala moderna' } };
    const pedido = { pila: ['esc-sala'], entradas: { foto: [foto.file] }, escena };
    const { plan } = P.compilar(pedido);
    assert.equal(plan.errores.length, 0, plan.errores.join());
    assert.equal(plan.guia?.pendiente, true);
    assert.doesNotMatch(plan.prompt, /Camera and framing:\s*Camera and framing:/, 'el rótulo no se repite');
    const { jobs, plan: p2 } = await P.aplicar(pedido);
    assert.ok(media.resolve(p2.guia.id), 'la guía está en la galería');
    assert.equal(media.item(p2.guia.id).guia, true);
    const j = await media.wait(jobs[0].id, 30000);
    assert.equal(j.state, 'done', j.error);
    const parts = seen[0].body.contents[0].parts;
    const text = parts.filter(x => x.text).map(x => x.text).join(' '), imgs = parts.filter(x => x.inlineData || x.inline_data);
    assert.equal(imgs.length, 2, 'tu foto y la guía');
    assert.match(text, /LAYOUT GUIDE ONLY/);
    assert.match(text, /three-quarter view/);
    assert.match(text, /Camera 5\.\d m away/, 'la distancia de la cámara, en metros');
    const it = media.item(j.items[0]);
    const occ = it.qa.checks.find(c => c.id === 'escena');
    assert.ok(occ, 'la QA compara con la escena'); assert.ok(occ.objetivo > 0 && occ.objetivo < 1);
    assert.deepEqual(it.receta.escena.camara.distancia, 500, 'la receta guarda la escena');
  } finally { srv.close(); back(); }
});

test('«Guardar como preset»: una nota en Estudio/Presets que el Cerebro lee y el banco lista; otra vez sube la versión', conSharp, async () => {
  const back = sinKeys();
  try {
    const { brain, P, notas } = entorno();
    const foto = media.upload({ name: 'cama.png', data: dataUrl(await fotoBodega()) });
    const { jobs } = await P.aplicar({ pila: [{ id: 'luz-mas-clara', params: { intensidad: 'fuerte' } }, 'color-blancos'], entradas: { foto: [foto.file] } });
    const j = await media.wait(jobs[0].id, 20000); assert.equal(j.state, 'done', j.error);
    const r = P.guardar({ desde: j.items[0], nombre: 'Bodega a catálogo', marca: 'PanaClaw' });
    assert.equal(r.archivo, 'Estudio/Presets/Bodega a catálogo.md');
    const md = fs.readFileSync(path.join(brain, 'Estudio', 'Presets', 'Bodega a catálogo.md'), 'utf8');
    assert.match(md, /tipo: preset/); assert.match(md, /\[\[PanaClaw\]\]/); assert.match(md, /luz-mas-clara/);
    assert.equal(notas(), 1, 'el Cerebro se reconstruye');
    assert.ok(readVault(brain).notes.has('Bodega a catálogo'), 'una neurona del Cerebro');
    const l = P.lista({ medio: 'image' });
    const mio = l.presets.find(p => p.id === r.preset.id); assert.ok(mio && mio.categoria === 'mios' && mio.on);
    const { plan } = P.compilar({ pila: [r.preset.id], entradas: { foto: [foto.file] } });
    assert.deepEqual(plan.preset.map(x => x.id), ['luz-mas-clara', 'color-blancos'], 'un preset propio se abre en su receta');
    const r2 = P.guardar({ receta: { pila: ['luz-mas-oscura'] }, nombre: 'Bodega a catálogo' });
    assert.equal(r2.preset.v, 2); assert.equal(P.versiones(r.preset.id).length, 1);
    assert.equal(P.borrar(r.preset.id), true); assert.ok(!P.lista({}).presets.some(p => p.id === r.preset.id));
    assert.throws(() => P.guardar({ nombre: 'x', receta: { pila: [] } }), /vacía/);
  } finally { back(); }
});

test('sin motor que edite: «Fondo blanco» no se cae a otra cosa; dice qué activar y no crea nada', conSharp, async () => {
  const back = sinKeys();
  try {
    const { P } = entorno();
    const foto = media.upload({ name: 'x.png', data: dataUrl(await fotoBodega()) });
    await assert.rejects(P.aplicar({ pila: ['fondo-blanco'], entradas: { foto: [foto.file] } }), /motor que edita|key/);
    assert.deepEqual(media.jobs(), []);
  } finally { back(); }
});
