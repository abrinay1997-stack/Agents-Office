// «✨ Mejorar con Marketing» MIRA las fotos y los videos de la pieza (28 oct 2026) en Chromium de verdad: el navegador reduce una foto grande y saca cuadros de un video real (WebM hecho con ffmpeg),
// y el editor de Contenido de la oficina local los manda a Claude (de mentira) y enseña qué miró. Se salta sin Chromium, sin ffmpeg o sin sharp.
//   1. src/vision-copia.js suelto: la foto de 4000×3000 con ruido baja a ≤ 1568 px y ≤ 1,5 MB; un video da cuadros distintos y repartidos; lo que no se puede leer se dice.
//   2. la oficina: abrir una pieza con foto y video → ✨ Mejorar → «A partir de …» → Claude recibe 1 foto + 3 cuadros → «Miró 1 foto y 3 cuadros de un video: …» → Otra versión no vuelve a bajar los archivos → Usar este texto.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { for (const m of ['playwright', 'playwright-core']) { try { ({ chromium } = createRequire(base)(m)); break; } catch { /* siguiente */ } } if (chromium) break; }
let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* sin sharp */ }
const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SALTAR = !chromium ? 'sin Playwright' : !sharp ? 'sin sharp' : !ffmpeg ? 'sin ffmpeg' : false;
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

let nav = null, dir = '', archivos = '';
before(async () => {
  if (SALTAR) return; nav = await chromium.launch().catch(() => null); if (!nav) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-vision-nav-')); archivos = path.join(dir, 'archivos'); fs.mkdirSync(archivos);
  const ruido = Buffer.alloc(4000 * 3000 * 3); for (let i = 0; i < ruido.length; i++) ruido[i] = (i * 2654435761 >>> 24) & 255; // ruido: un JPEG de calidad alta que pesa de verdad
  fs.writeFileSync(path.join(archivos, 'grande.jpg'), await sharp(ruido, { raw: { width: 4000, height: 3000, channels: 3 } }).jpeg({ quality: 95 }).toBuffer());
  fs.writeFileSync(path.join(archivos, 'transparente.png'), await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer());
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=4:size=640x360:rate=10', '-c:v', 'libvpx', '-b:v', '300k', path.join(archivos, 'clip.webm')]);
  if (r.status !== 0) throw new Error('ffmpeg no pudo hacer el video de prueba: ' + String(r.stderr));
  fs.writeFileSync(path.join(archivos, 'roto.webm'), Buffer.from('esto no es un video'.repeat(40)));
});
after(async () => { await nav?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

/* ---------- 1 · el módulo suelto ---------- */
test('copias para Claude en Chromium: la foto grande baja a ≤ 1568 px y ≤ 1,5 MB, el PNG transparente queda sobre blanco, el video da cuadros distintos y repartidos, y lo que no se puede leer se dice', { skip: SALTAR, timeout: 120000 }, async t => {
  if (!nav) return t.skip('sin Chromium');
  const srv = http.createServer((rq, rs) => {
    const u = decodeURIComponent(rq.url.split('?')[0]);
    if (u === '/') { rs.writeHead(200, { 'content-type': 'text/html' }); return rs.end('<!doctype html><meta charset="utf-8"><body>x'); }
    if (u === '/vc.js') { rs.writeHead(200, { 'content-type': 'text/javascript' }); return rs.end(fs.readFileSync(path.join(ROOT, 'src', 'vision-copia.js'))); }
    const f = path.join(archivos, path.basename(u)); if (!u.startsWith('/m/') || !fs.existsSync(f)) { rs.writeHead(404); return rs.end(); }
    const b = fs.readFileSync(f), tipo = f.endsWith('.webm') ? 'video/webm' : f.endsWith('.png') ? 'image/png' : 'image/jpeg', m = /^bytes=(\d*)-(\d*)$/.exec(rq.headers.range || '');
    if (m) { const a = +m[1] || 0, z = m[2] ? +m[2] : b.length - 1; rs.writeHead(206, { 'content-type': tipo, 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${z}/${b.length}`, 'content-length': z - a + 1 }); return rs.end(b.subarray(a, z + 1)); }
    rs.writeHead(200, { 'content-type': tipo, 'accept-ranges': 'bytes', 'content-length': b.length }); rs.end(b);
  });
  const port = await listen(srv); t.after(() => srv.close());
  const p = await nav.newPage(); p.setDefaultTimeout(60000);
  await p.goto(`http://127.0.0.1:${port}/`);
  const r = await p.evaluate(async () => {
    const { copiasDeMedios, b64Bytes } = await import('/vc.js');
    const medir = async c => { const im = new Image(); await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = `data:${c.media_type};base64,${c.data}`; }); return { file: c.file, w: im.naturalWidth, h: im.naturalHeight, bytes: b64Bytes(c.data), cuadro: c.cuadro, tipo: c.media_type, huella: c.data.slice(-40) }; };
    const res = await copiasDeMedios(['grande.jpg', 'clip.webm'], { urlDe: id => '/m/' + id }), mal = await copiasDeMedios(['nada.jpg', 'musica.mp3', 'roto.webm', 'clip.webm', 'grande.jpg', 'transparente.png'], { urlDe: id => '/m/' + id });
    const ims = []; for (const c of res.imagenes) ims.push(await medir(c));
    const png = await copiasDeMedios(['transparente.png'], { urlDe: id => '/m/' + id }); const pm = await medir(png.imagenes[0]);
    // un píxel de la copia del PNG transparente: blanco (no negro)
    const im = new Image(); await new Promise(ok => { im.onload = ok; im.src = `data:${png.imagenes[0].media_type};base64,${png.imagenes[0].data}`; });
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const px = [...g.getImageData(10, 10, 1, 1).data];
    const otra = await copiasDeMedios(['grande.jpg'], { urlDe: id => '/m/' + id });
    return { ims, fotos: res.fotos, fotogramas: res.fotogramas, videos: res.videos, sinLeer: mal.sinLeer, malLeidas: mal.imagenes.map(i => i.file), omitidos: mal.omitidos, pm, px, sinCache: otra.imagenes.length };
  });
  assert.deepEqual([r.fotos, r.fotogramas, r.videos], [1, 3, 1]);
  assert.equal(r.ims.length, 4, 'la foto y 3 cuadros del video');
  const foto = r.ims[0]; assert.ok(Math.max(foto.w, foto.h) <= 1568 && Math.max(foto.w, foto.h) > 1000, `${foto.w}×${foto.h}`); assert.ok(foto.bytes <= 1.5 * 1024 * 1024 + 1, `${foto.bytes} bytes`); assert.equal(foto.tipo, 'image/jpeg');
  const cuadros = r.ims.slice(1); assert.ok(cuadros.every(c => c.file === 'clip.webm' && Number.isFinite(c.cuadro)), JSON.stringify(cuadros.map(c => c.cuadro)));
  assert.ok(cuadros[0].cuadro > 0.3 && cuadros[2].cuadro < 3.9 && cuadros[0].cuadro < cuadros[1].cuadro && cuadros[1].cuadro < cuadros[2].cuadro, 'repartidos por el clip: ' + JSON.stringify(cuadros.map(c => c.cuadro)));
  assert.equal(new Set(cuadros.map(c => c.huella)).size, 3, 'tres cuadros DISTINTOS (el contador del video avanza)'); assert.ok(cuadros.every(c => c.w === 640 && c.h === 360));
  const por = Object.fromEntries(r.sinLeer.map(x => [x.file, x.motivo])); assert.match(por['musica.mp3'], /no es una foto/); assert.match(por['nada.jpg'], /no pude abrir la imagen/);
  assert.match(por['roto.webm'], /no pude abrir el video/); assert.deepEqual(Object.keys(por).sort(), ['musica.mp3', 'nada.jpg', 'roto.webm'], 'solo lo que falló se cuenta como no leído');
  assert.deepEqual(r.malLeidas, ['clip.webm', 'grande.jpg'], 'el resto sí se leyó, aunque lo de antes fallara'); assert.equal(r.omitidos, 1, 'sobra uno: caben 4 archivos y había 5 mirables');
  assert.deepEqual(r.px.slice(0, 3), [255, 255, 255], 'un PNG transparente queda sobre blanco, no sobre negro'); assert.equal(r.sinCache, 1);
});

/* ---------- 2 · el editor de Contenido en la oficina de verdad ---------- */
test('oficina local: ✨ Mejorar → «A partir de …» manda 1 foto y 3 cuadros a Claude, dice qué miró, no vuelve a bajar los archivos en «Otra versión» y «Usar este texto» lo pone', { skip: SALTAR, timeout: 180000 }, async t => {
  if (!nav) return t.skip('sin Chromium');
  const pedidos = [];
  const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
    const body = JSON.parse(b || '{}'); const sys = JSON.stringify(body.system || ''); if (/mejores el TEXTO/.test(sys)) pedidos.push(body);
    const text = /mejores el TEXTO/.test(sys) ? JSON.stringify({ texto: `Propuesta número ${pedidos.length}: tu examen visual, gratis.`, porque: 'Partí de lo que se ve.', vi: 'Una pantalla con barras de colores y un contador' }) : '{}';
    rs.writeHead(200, { 'content-type': 'application/json' });
    rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
  }); });
  const cport = await listen(claude);
  const data = path.join(dir, 'oficina-data'), brain = path.join(dir, 'oficina-brain'); fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  const mes = new Date().toISOString().slice(0, 7), mdir = path.join(brain, 'Agents Office', 'media', mes); fs.mkdirSync(mdir, { recursive: true });
  for (const [n, k, w, h, ext] of [['grande', 'image', 4000, 3000, 'jpg'], ['clip', 'video', 640, 360, 'webm']]) { fs.copyFileSync(path.join(archivos, `${n}.${ext}`), path.join(mdir, `${n}.${ext}`)); fs.writeFileSync(path.join(mdir, `${n}.json`), JSON.stringify({ file: `${mes}/${n}.${ext}`, kind: k, model: 'upload', prompt: `Archivo ${n}`, w, h, at: Date.now(), by: 'dueno', ...(k === 'video' ? { seconds: 4 } : {}) })); }
  const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro', redes: ['instagram', 'facebook'] } }));
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, AO_VISION: '1', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 160; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún */ } await new Promise(r => setTimeout(r, 250)); }
  const manana = new Date(Date.now() + 864e5), ymd = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, '0')}-${String(manana.getDate()).padStart(2, '0')}`;
  const c = await (await fetch(base + '/api/contenido/piezas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ titulo: 'Examen visual', texto: '', redes: ['instagram'], fecha: ymd, hora: '10:00', medios: [`${mes}/grande.jpg`, `${mes}/clip.webm`] }) })).json();
  assert.ok(c.pieza?.id, JSON.stringify(c) + log.slice(-300));

  const ctx = await nav.newContext({ viewport: { width: 1512, height: 900 }, reducedMotion: 'reduce' }), p = await ctx.newPage(); p.setDefaultTimeout(90000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('ao.onboarded', '1'); localStorage.setItem('ao.movil', 'escritorio'); } catch { /* sin almacenamiento */ } window.__lecturas = { video: 0, canvas: 0 }; const crear = document.createElement.bind(document); document.createElement = (t, o) => { const k = String(t).toLowerCase(); if (k in window.__lecturas) window.__lecturas[k]++; return crear(t, o); }; }); // cuenta los <video> y <canvas> que crea el lector (las miniaturas de la galería se pintan con innerHTML, no cuentan)
  await p.goto(base + '/'); await p.waitForTimeout(1500); await p.keyboard.press('Escape'); await p.evaluate(() => document.activeElement?.blur());
  await p.keyboard.press('k'); await p.waitForSelector('#ctOv .ct-mode', { state: 'visible' });
  await p.waitForSelector(`[data-ev="p:${c.pieza.id}"]`); await p.click(`[data-ev="p:${c.pieza.id}"]`);
  const P = '.ct-panel:not([hidden]) '; await p.waitForSelector(P + '.pz-comp');
  await p.click(P + '[data-pop="mejorar"]'); await p.waitForSelector(P + '[data-mmirar]');
  assert.match(await p.textContent(P + '.pz-pop'), /Que mire la foto y el video/); assert.match(await p.textContent(P + '.pz-pop'), /de un video ve unos cuadros, no oye el sonido/);
  assert.equal(await p.isChecked(P + '[data-mmirar]'), true, 'con fotos en la pieza, mira por defecto');
  assert.match(await p.textContent(P + '.pz-qimg'), /A partir de las fotos y los videos|A partir de la foto/);
  if (process.env.AO_CAPTURAS) await p.screenshot({ path: path.join(process.env.AO_CAPTURAS, 'mejorar-antes-1512.png') });
  await p.click(P + '.pz-qimg'); await p.waitForSelector(P + '.pz-prop');
  assert.equal(pedidos.length, 1, 'una sola petición a Claude');
  const cont = pedidos[0].messages[0].content; assert.deepEqual(cont.map(x => x.type), ['image', 'image', 'image', 'image', 'text'], 'la foto y 3 cuadros, y después el texto');
  for (const im of cont.slice(0, 4)) { const m = await sharp(Buffer.from(im.source.data, 'base64')).metadata(); assert.ok(Math.max(m.width, m.height) <= 1568, `${m.width}×${m.height}`); assert.ok(im.source.data.length <= 1.6 * 1024 * 1024); }
  assert.match(cont[4].text, /imagen 1: la foto «grande\.jpg» · imagen 2: un cuadro del video «clip\.webm» \(segundo [\d,]+\)/); assert.match(cont[4].text, /Escríbelo a partir de lo que se ve/);
  const sis = JSON.stringify(pedidos[0].system); assert.match(sis, /IMÁGENES \(van antes del texto/);
  if (process.env.AO_CAPTURAS) { fs.mkdirSync(process.env.AO_CAPTURAS, { recursive: true }); await p.screenshot({ path: path.join(process.env.AO_CAPTURAS, 'mejorar-mira-1512.png') }); }
  const txt = await p.textContent(P + '.pz-pop'); assert.match(txt, /Propuesta número 1/); assert.match(txt, /Miró 1 foto y 3 cuadros de un video: Una pantalla con barras de colores y un contador/);
  // «Otra versión» reutiliza lo ya leído: no se vuelven a bajar ni la foto ni el video
  const antes = await p.evaluate(() => ({ ...window.__lecturas })); assert.equal(antes.video, 1, 'un solo <video> oculto para sacar los cuadros'); assert.ok(antes.canvas >= 4, 'un canvas por copia (o más al reducir)');
  await p.click(P + '[data-a="otra-prop"]'); await p.waitForFunction(() => /Propuesta número 2/.test(document.querySelector('.ct-panel:not([hidden]) .pz-pop')?.textContent || ''));
  assert.deepEqual(await p.evaluate(() => ({ ...window.__lecturas })), antes, 'no se vuelve a abrir ningún video ni a dibujar ninguna copia'); assert.equal(pedidos.length, 2);
  // apagar la casilla: el agente ya no mira, y el texto lo dice la propuesta (sin «Miró»)
  await p.click(P + '[data-a="descartar-prop"]'); await p.waitForSelector(P + '[data-mmirar]'); await p.uncheck(P + '[data-mmirar]'); await p.click(P + '[data-pide="Más corto"]');
  await p.waitForFunction(() => /Propuesta número 3/.test(document.querySelector('.ct-panel:not([hidden]) .pz-pop')?.textContent || ''));
  assert.equal(typeof pedidos[2].messages[0].content, 'string', 'sin la casilla, el mensaje es un texto: ni una imagen');
  // usar el texto
  await p.click(P + '[data-a="usar-prop"]'); await p.waitForTimeout(300);
  assert.match(await p.inputValue(P + '.pz-ta[data-f="texto"]'), /Propuesta número 3/);
  assert.deepEqual(errs, [], 'sin errores en la página');
});
