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

/* ---------- revisión de F1 (1 oct 2026) ---------- */

test('revisión F1: guardar una receta con canal funciona, y una nota con canal no tumba el banco', conSharp, () => {
  const back = sinKeys();
  try {
    const { brain, P } = entorno();
    const r = P.guardar({ receta: { pila: [{ id: 'sal-canal', params: { canal: 'web' } }], canal: 'web' }, nombre: 'Web con canal' });
    assert.equal(r.preset.receta.canal, 'web');
    // una nota escrita a mano (o traída por git) con canal
    const dir = path.join(brain, 'Estudio', 'Presets');
    fs.writeFileSync(path.join(dir, 'A mano.md'), fs.readFileSync(path.join(dir, 'Web con canal.md'), 'utf8').replace(/^id: .*$/m, 'id: mio-a-mano').replace(/^nombre: .*$/m, 'nombre: A mano'));
    const l = P.lista({});
    assert.ok(l.propios.includes('mio-web-con-canal') && l.propios.includes('mio-a-mano'), JSON.stringify(l.problemas));
    assert.equal(P.compilar({ pila: ['mio-a-mano'] }).plan.preset[0].id, 'sal-canal');
    assert.throws(() => P.guardar({ receta: { pila: ['sal-canal'], canal: 'no-existe' }, nombre: 'Mal' }), /no es un canal/);
  } finally { back(); }
});

test('revisión F1: «Catálogo web» y «Catalogo web» son el mismo preset (una nota, un id, un historial)', conSharp, () => {
  const back = sinKeys();
  try {
    const { brain, data, P } = entorno();
    P.guardar({ receta: { pila: ['luz-mas-clara'] }, nombre: 'Catálogo web' });
    const r2 = P.guardar({ receta: { pila: ['luz-mas-oscura'] }, nombre: 'Catalogo web' });
    assert.equal(r2.archivo, 'Estudio/Presets/Catálogo web.md', 'se guarda en la nota que ya había');
    assert.equal(r2.preset.v, 2);
    const dir = path.join(brain, 'Estudio', 'Presets');
    assert.deepEqual(fs.readdirSync(dir).filter(f => f.endsWith('.md')), ['Catálogo web.md']);
    assert.equal(fs.readdirSync(path.join(data, 'history', 'presets', 'mio-catalogo-web')).length, 1);
    // dos notas con el mismo id (copiadas a mano): se carga una y se dice
    fs.copyFileSync(path.join(dir, 'Catálogo web.md'), path.join(dir, 'Copia.md'));
    const l = P.lista({});
    assert.deepEqual(l.propios, ['mio-catalogo-web']);
    assert.ok(l.problemas.some(x => /mismo id/.test(x)), JSON.stringify(l.problemas));
  } finally { back(); }
});

test('revisión F1: lo local sin su LUT no se ofrece ni se hace; un paso que falla no sale «done» limpio', conSharp, async () => {
  const back = sinKeys();
  try {
    const { P } = entorno();
    const l = P.lista({ medio: 'image' });
    for (const id of ['color-pastel', 'color-pelicula', 'ref-lut-aplicar']) {
      const p = l.presets.find(x => x.id === id);
      assert.ok(p, id); assert.equal(p.on, false, id); assert.ok(p.motivo, id);
    }
    const foto = media.upload({ name: 'x.png', data: dataUrl(await fotoBodega()) });
    assert.ok(P.compilar({ pila: ['color-pastel'], entradas: { foto: [foto.file] } }).plan.errores.some(e => /LUT/.test(e)));
    await assert.rejects(P.aplicar({ pila: ['color-pastel'], entradas: { foto: [foto.file] } }), /LUT/);
    // un trabajo local con una LUT que falta: termina, pero lo dice, y sin la ruta de la máquina
    const j0 = media.submit({ local: true, source: foto.file, post: [{ op: 'lut', archivo: 'presets/luts/no-existe.cube' }] });
    const j = await media.wait(j0.id, 20000);
    assert.equal(j.state, 'done', j.error);
    assert.match(j.warning || '', /no-existe\.cube/);
    const avisos = media.item(j.items[0]).post.avisos.join(' ');
    assert.doesNotMatch(avisos + j.warning, /[A-Za-z]:\\|ENOENT|\/tmp\//, 'sin rutas absolutas');
  } finally { back(); }
});

test('revisión F1: la LUT del paso (id de la galería) se lee y se aplica', conSharp, async () => {
  const { procesar } = await import('../media/posproceso.mjs');
  entorno();
  const mes = new Date().toISOString().slice(0, 7), d = path.join(media.dir(), mes); fs.mkdirSync(d, { recursive: true });
  // una LUT que invierte (la galería todavía no recibe .cube: aquí se escribe a mano para probar el cableado)
  const cube = L.exportarCube(L.lutDeFuncion((r, g, b, o) => { o[0] = 1 - r; o[1] = 1 - g; o[2] = 1 - b; }, 17), 'Invertir');
  fs.writeFileSync(path.join(d, 'lut-prueba.png'), cube);
  const r = await procesar(await fotoBodega(64, 48), { post: [{ op: 'lut3d', lut: `${mes}/lut-prueba.png` }] });
  assert.deepEqual(r.sinHacer, []);
  assert.ok(r.post.pasos.some(s => s.op === 'lut3d' && s.hecho));
  const px = (await L.leer(r.buffer)).data; assert.ok(px[0] < 60, 'la pared clara sale oscura');
});

test('revisión F1: si submit dice que no (presupuesto), la guía y la foto preparada no quedan huérfanas en la galería', conSharp, async () => {
  const back = sinKeys(); const { srv, seen, base } = await stand();
  Object.assign(process.env, { GEMINI_API_KEY: 'prueba-key', AO_GEMINI_BASE: base });
  try {
    const { brain, data, P } = entorno();
    const foto = media.upload({ name: 'cama.png', data: dataUrl(await fotoBodega()) });
    media.setLimits({ dailyBudget: 0.0001 });
    const n0 = media.list({ limit: 1e6 }).length;
    const escena = { producto: { tipo: 'cama-queen', ancho: 160, alto: 50, fondo: 200 }, camara: { distancia: 500, azimut: 35, altura: 140, lente: 35 }, cuadro: { proporcion: '4:5' }, fondo: { tipo: 'locacion', valor: 'sala moderna' } };
    await assert.rejects(P.aplicar({ pila: ['esc-sala'], entradas: { foto: [foto.file] }, escena }), /presupuesto/);
    await assert.rejects(P.aplicar({ pila: ['cat-web-panaclaw'], entradas: { foto: [foto.file] } }), /presupuesto/);
    await assert.rejects(P.aplicar({ pila: ['cat-web-panaclaw'], entradas: { foto: [foto.file] } }), /presupuesto/);
    assert.equal(media.list({ limit: 1e6 }).length, n0, 'nada nuevo en la galería');
    assert.equal(seen.length, 0);
    // con presupuesto, la guía de esa escena se sube una vez y se reutiliza aunque la caché se pierda (otro crearPresets = reinicio)
    media.setLimits({ dailyBudget: 0 });
    const a = await P.aplicar({ pila: ['esc-sala'], entradas: { foto: [foto.file] }, escena });
    await media.wait(a.jobs[0].id, 30000);
    const P2 = crearPresets({ brainPath: brain, dataDir: data });
    const b = await P2.aplicar({ pila: ['esc-sala'], entradas: { foto: [foto.file] }, escena });
    await media.wait(b.jobs[0].id, 30000);
    assert.equal(b.plan.guia.id, a.plan.guia.id, 'la misma guía tras el reinicio');
  } finally { media.setLimits({ dailyBudget: 0 }); srv.close(); back(); }
});

// Revisión F1, desde la pantalla: «Guardar como preset» con un canal ELEGIDO en el compositor manda exactamente este cuerpo
// (src/studio-banco.js → guardar(): pila de { id, params }, ejes, escena, canal, modelo). Y «Guardar como preset…» en una
// tarjeta de la galería manda { desde }, cuya receta también lleva el canal. Antes daba 400 «canales.has is not a function».
// No necesita sharp: guardar no toca imágenes.
test('revisión F1: «Guardar como preset» con canal elegido, desde el compositor y desde la galería', () => {
  const back = sinKeys();
  try {
    const { brain, P } = entorno();
    const r = P.guardar({ nombre: 'Feed de Instagram', marca: undefined, receta: { pila: [{ id: 'sal-canal', params: { canal: 'ig-feed' } }], ejes: null, escena: null, canal: 'ig-feed', modelo: null } });
    assert.equal(r.preset.receta.canal, 'ig-feed');
    assert.ok(fs.existsSync(path.join(brain, 'Estudio', 'Presets', 'Feed de Instagram.md')));
    // desde una imagen de la galería que salió de una receta con canal
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    const it = media.upload({ name: 'resultado.png', data: dataUrl(png) });
    media.update(it.file, { receta: { pila: [{ id: 'sal-canal', params: { canal: 'ig-story' } }], canal: 'ig-story' } });
    const r2 = P.guardar({ nombre: 'Historia', desde: it.file });
    assert.equal(r2.preset.receta.canal, 'ig-story');
    // las dos se cargan en el banco y el banco sigue entero
    const l = P.lista({});
    assert.ok(l.propios.includes(r.preset.id) && l.propios.includes(r2.preset.id), JSON.stringify(l.problemas));
    assert.deepEqual(l.problemas, []);
    assert.ok(l.presets.length > l.propios.length, 'los de fábrica siguen saliendo');
    // un canal que no existe sigue siendo un error claro (400), no un 500
    assert.throws(() => P.guardar({ nombre: 'Mal', receta: { pila: [{ id: 'sal-canal', params: { canal: 'tiktok' } }], canal: 'tiktok' } }), e => e.status === 400 && /no es un canal|no existe/.test(e.message));
  } finally { back(); }
});
