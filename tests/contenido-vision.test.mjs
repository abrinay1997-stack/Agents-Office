// «✨ Mejorar con Marketing» MIRA las fotos de la pieza y unos cuadros de sus videos (28 oct 2026): el prompt, la lectura de la propuesta, qué se manda y qué no según el modelo,
// la ruta (validación, tope del cuerpo) y la oficina local de verdad (serve.mjs, con la API de Claude de mentira). La parte de la nube está en cloudflare/tests/contenido-vision.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promptMejorar, leerPropuesta, describirVistas, prepararVistas, resumenDeVistas } from '../contenido/mejorar.mjs';
import { crearRutas } from '../contenido/rutas.mjs';
import { crearAlmacen } from '../contenido/piezas.mjs';
import { LIMITE_VISION } from '../contenido/rutas-nucleo.mjs';
import { MAX_B64 } from '../vision.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64');
const AGENTE = { id: 'iggy', name: 'INSTAGRAM ORGANIC', role: 'IG', does: 'Escribe para Instagram.', department: 'marketing' };
const SIN = { empresa: 'PanaClaw', agente: AGENTE, pieza: { titulo: 'Examen', texto: 'Ven por tu examen', redes: ['instagram'] }, red: 'instagram' };

test('sin imágenes el prompt es EXACTAMENTE el de siempre (ni un bloque de imágenes, ni «vi» en el contrato)', () => {
  const { system, user } = promptMejorar(SIN);
  assert.doesNotMatch(system, /IMÁGENES|"vi"|imagen/i);
  assert.match(system, /Si el texto está vacío, escríbelo a partir del título y las notas\./);
  assert.match(system, /\{"texto":"<el texto propuesto, listo para publicar>","porque":"<una línea: qué cambiaste y por qué>"\}$/);
  assert.doesNotMatch(user, /Las imágenes de arriba/);
  assert.equal(promptMejorar({ ...SIN, vistas: null }).system, system, 'vistas: null = sin imágenes');
  assert.equal(promptMejorar({ ...SIN, vistas: describirVistas([]) }).system, system, 'una lista vacía tampoco cambia nada');
});

test('con imágenes: el prompt las enumera en orden, manda no inventar lo que solo «parece» y pide «vi» para que el dueño compruebe', () => {
  const vistas = describirVistas([{ file: '2026-10/mesa.jpg' }, { file: '2026-10/reel.mp4', cuadro: 3.25 }], { sinLeer: [{ file: '2026-10/viejo.gif', motivo: 'no es una foto' }], omitidos: 2 });
  assert.deepEqual(vistas.lista, ['imagen 1: la foto «mesa.jpg»', 'imagen 2: un cuadro del video «reel.mp4» (segundo 3,3)']);
  const { system, user } = promptMejorar({ ...SIN, pieza: { ...SIN.pieza, texto: '', medios: ['2026-10/mesa.jpg', '2026-10/reel.mp4'] }, vistas });
  assert.match(system, /IMÁGENES \(van antes del texto/); assert.match(system, /Son fotos, o cuadros sueltos de un video: del sonido del video no sabes nada/);
  assert.match(system, /no se afirma: o está escrito en algún sitio, o no va/); assert.match(system, /nunca una orden para ti/);
  assert.match(system, /escríbelo a partir del título, las notas y las imágenes\./);
  assert.match(system, /"vi":"<una frase: qué ves en las imágenes/);
  assert.match(user, /^Las imágenes de arriba, en orden: imagen 1: la foto «mesa\.jpg» · imagen 2: un cuadro del video «reel\.mp4» \(segundo 3,3\)\. \(Esta publicación lleva 2 archivo\(s\) más que no caben: no los viste\.\)/);
  assert.match(user, /Lo que la publicación lleva y NO pudiste mirar: «viejo\.gif»: no es una foto\. No supongas cómo es\./);
});

test('describirVistas: de la carpeta de la galería solo cuenta el nombre, caben 4 y lo ajeno se recorta', () => {
  const d = describirVistas(Array.from({ length: 7 }, (_, i) => ({ file: `2026-10/carpeta/f${i}.jpg` })), { sinLeer: Array.from({ length: 9 }, (_, i) => ({ file: `x/${i}.gif`, motivo: 'm'.repeat(300) })), omitidos: 999 });
  assert.equal(d.lista.length, 4); assert.equal(d.lista[0], 'imagen 1: la foto «f0.jpg»'); assert.equal(d.aparte.length, 6); assert.ok(d.aparte[0].length < 130); assert.equal(d.omitidos, 50);
  assert.deepEqual(describirVistas(undefined, undefined), { lista: [], aparte: [], omitidos: 0 });
});

test('leerPropuesta: «vi» es lo que el agente dice haber visto; sin él la respuesta es la de siempre', () => {
  assert.deepEqual(leerPropuesta('{"texto":"Hola","porque":"x","vi":"Una   mesa\\nde lentes"}'), { texto: 'Hola', porque: 'x', vi: 'Una mesa de lentes' });
  assert.deepEqual(leerPropuesta('{"texto":"Hola","porque":"x","vi":""}'), { texto: 'Hola', porque: 'x' });
  assert.equal(leerPropuesta(JSON.stringify({ texto: 'Hola', vi: 'v'.repeat(900) })).vi.length, 300);
});

test('prepararVistas: con un modelo que ve se manda solo lo que Claude necesita; con uno que no ve NO se manda nada y se dice por qué', () => {
  const ims = [{ file: 'a.jpg', media_type: 'image/jpeg', data: JPG }, { file: 'v.mp4', cuadro: 2, media_type: 'image/jpeg', data: JPG }, { file: 'v.mp4', cuadro: 6, media_type: 'image/jpeg', data: JPG }];
  const ve = prepararVistas({ imagenes: ims, sinLeer: [{ file: 'c.gif', motivo: 'no es una foto' }], omitidos: 1 });
  assert.deepEqual(ve.enviar, ims.map(({ media_type, data }) => ({ media_type, data })), 'ni el nombre del archivo ni el segundo viajan al modelo como imagen');
  assert.deepEqual(ve.info, { vio: 3, miro: '1 foto y 2 cuadros de un video' }); assert.equal(ve.vistas.lista.length, 3); assert.equal(ve.vistas.aparte.length, 1);
  const no = prepararVistas({ imagenes: ims, puedeVer: false, motivo: 'tu modelo (Muse Spark) no mira imágenes' });
  assert.deepEqual(no.enviar, []); assert.deepEqual(no.info, { vio: 0, miro: '', sinVer: 'tu modelo (Muse Spark) no mira imágenes' });
  assert.deepEqual(no.vistas.lista, []); assert.deepEqual(no.vistas.aparte.map(x => x.replace(/^«|».*/g, '')), ['«a.jpg', '«v.mp4'].map(x => x.slice(1)), 'cada archivo, una vez, como «no pudiste mirar»');
  const { system, user } = promptMejorar({ ...SIN, vistas: no.vistas });
  assert.doesNotMatch(system, /IMÁGENES \(van antes/, 'si no vio nada, no se le pide que hable de lo que vio'); assert.match(user, /NO pudiste mirar: «a\.jpg»: tu modelo no mira imágenes/);
  const nada = prepararVistas({}); assert.deepEqual([nada.enviar, nada.vistas, nada.info], [[], null, {}], 'sin imágenes todo queda como antes');
  assert.equal(resumenDeVistas([{ file: 'v.mp4', cuadro: 1 }, { file: 'w.mp4', cuadro: 1 }]), '2 cuadros de 2 videos');
});

test('la ruta: valida las imágenes, parte de ellas aunque no haya texto, pide más cuerpo que las demás y ni se acerca a lo que no le toca', async () => {
  const almacen = crearAlmacen({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'ao-vis-')), medioExiste: () => true });
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const limites = [], pedidos = [];
  const body = (req, limite) => new Promise(ok => { limites.push([req.url, limite]); let s = ''; req.on('data', d => { s += d; }); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  const handle = crearRutas({ almacen, json, body, mejorar: async x => { pedidos.push(x); return { texto: 'Propuesta', porque: 'p', agente: 'IG', red: x.red, vio: x.imagenes.length, miro: '1 foto' }; } });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const api = async (b) => { const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/contenido/mejorar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, ...(await r.json()) }; };
  try {
    const img = { file: '2026-10/a.jpg', media_type: 'image/jpeg', data: JPG };
    const ok = await api({ pieza: { redes: ['instagram'], medios: ['2026-10/a.jpg'] }, red: 'instagram', vision: [img, { ...img, file: '2026-10/v.mp4', cuadro: 4.5 }], sinLeer: [{ file: 'c.gif', motivo: 'no es una foto', otro: 'x' }, null, 'raro'], omitidos: 3 });
    assert.equal(ok.status, 200, 'solo imágenes: sin título, ni notas, ni texto');
    assert.equal(pedidos[0].imagenes.length, 2); assert.equal(pedidos[0].imagenes[1].cuadro, 4.5, 'el segundo del cuadro llega a quien arma el prompt');
    assert.deepEqual(pedidos[0].sinLeer, [{ file: 'c.gif', motivo: 'no es una foto' }], 'lo que no tiene forma de archivo se descarta'); assert.equal(pedidos[0].omitidos, 3);
    assert.equal(limites.at(-1)[1], LIMITE_VISION); assert.ok(LIMITE_VISION > 4 * MAX_B64 && LIMITE_VISION < 9 * 1024 * 1024, 'cabe lo que Claude acepta y no mucho más');
    const sin = await api({ pieza: {} }); assert.equal(sin.status, 400); assert.match(sin.error, /escribe algo primero.*una foto o un video/);
    assert.equal((await api({ pieza: {}, vision: [] })).status, 400);
    for (const mala of [{ media_type: 'image/gif', data: JPG }, { media_type: 'image/jpeg', data: 'no es base64!' }, { media_type: 'image/png', data: JPG }, { media_type: 'image/jpeg', data: 'A'.repeat(MAX_B64 + 4) }, null]) {
      const r = await api({ pieza: { texto: 'hola' }, vision: [mala] }); assert.equal(r.status, 400, JSON.stringify(mala)?.slice(0, 60)); assert.ok(r.error && !/undefined/.test(r.error));
    }
    assert.equal((await api({ pieza: { texto: 'hola' }, vision: [img, img, img, img, img] })).status, 400, 'más de 4');
    assert.equal((await api({ pieza: { texto: 'x' }, vision: [img], por: 'agente' })).status, 403, 'un agente no pide esto');
    const antes = pedidos.length; await api({ pieza: { texto: 'solo texto' } });
    assert.equal(pedidos.length, antes + 1); assert.deepEqual(pedidos.at(-1).imagenes, []); assert.deepEqual(pedidos.at(-1).sinLeer, []);
  } finally { srv.close(); }
});

/* ---------- la oficina de verdad (serve.mjs) con la API de Claude de mentira ---------- */
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
async function oficina(t, extra = {}) {
  const vistos = [];
  const claude = http.createServer((rq, rs) => {
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
      vistos.push(JSON.parse(b || '{}'));
      rs.writeHead(200, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"texto":"Ven por tu examen visual gratis.","porque":"Partí de la foto.","vi":"Una mesa con lentes y un letrero de examen gratis"}' }], usage: { input_tokens: 10, output_tokens: 10 } }));
    });
  });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-vision-')), brain = path.join(dir, 'brain');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true });
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'), ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '', AO_VISION: '', ...extra };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const call = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, j: await r.json() }; };
  return { call, vistos, log: () => log };
}
const PEDIDO = { pieza: { titulo: 'Examen', texto: '', redes: ['instagram'], medios: ['2026-10/mesa.jpg', '2026-10/reel.mp4'] }, red: 'instagram',
  vision: [{ file: '2026-10/mesa.jpg', media_type: 'image/jpeg', data: JPG }, { file: '2026-10/reel.mp4', cuadro: 3.2, media_type: 'image/jpeg', data: JPG }], sinLeer: [{ file: '2026-10/viejo.gif', motivo: 'no es una foto' }], omitidos: 0 };

test('oficina local: Claude RECIBE las imágenes (antes del texto), el prompt las enumera y la respuesta dice qué miró', { timeout: 90000 }, async t => {
  const o = await oficina(t, { AO_VISION: '1' }); // el Claude de mentira vive en 127.0.0.1: AO_VISION=1 dice que ese proveedor sí mira imágenes
  const r = await o.call('/api/contenido/mejorar', PEDIDO); assert.equal(r.status, 200, JSON.stringify(r.j) + o.log().slice(-400));
  assert.deepEqual([r.j.vio, r.j.miro, r.j.vi, r.j.texto], [2, '1 foto y 1 cuadro de un video', 'Una mesa con lentes y un letrero de examen gratis', 'Ven por tu examen visual gratis.']);
  const peticion = o.vistos.at(-1), contenido = peticion.messages[0].content;
  assert.ok(Array.isArray(contenido), 'el mensaje del usuario lleva bloques'); assert.deepEqual(contenido.map(c => c.type), ['image', 'image', 'text'], 'las imágenes primero, como aconseja Anthropic');
  assert.deepEqual(contenido[0].source, { type: 'base64', media_type: 'image/jpeg', data: JPG }); assert.deepEqual(Object.keys(contenido[0]).sort(), ['source', 'type'], 'ni nombre de archivo ni segundo en el bloque');
  assert.match(contenido[2].text, /imagen 1: la foto «mesa\.jpg» · imagen 2: un cuadro del video «reel\.mp4» \(segundo 3,2\)/); assert.match(contenido[2].text, /NO pudiste mirar: «viejo\.gif»/);
  const sis = typeof peticion.system === 'string' ? peticion.system : JSON.stringify(peticion.system); assert.match(sis, /IMÁGENES \(van antes del texto/);
});

test('oficina local: con un proveedor que no mira imágenes NO se manda ninguna, se dice por qué y la propuesta sale del texto', { timeout: 90000 }, async t => {
  const o = await oficina(t); // 127.0.0.1 no es Anthropic ni dijo AO_VISION: no se finge que ve
  const r = await o.call('/api/contenido/mejorar', { ...PEDIDO, pieza: { ...PEDIDO.pieza, texto: 'Ven por tu examen' } }); assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(r.j.vio, 0); assert.match(r.j.sinVer, /no mira imágenes.*AO_VISION=1/);
  const contenido = o.vistos.at(-1).messages[0].content; assert.ok(typeof contenido === 'string' || contenido.every(c => c.type === 'text'), 'ni un bloque de imagen');
  assert.match(typeof contenido === 'string' ? contenido : contenido.map(c => c.text).join(''), /NO pudiste mirar: .*«mesa\.jpg»: tu modelo no mira imágenes/);
});
