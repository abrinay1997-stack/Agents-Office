// «✨ Mejorar con Marketing» en el CELULAR (28 oct 2026): Crear publicación → paso Medios → «Escribir el texto a partir de la foto y el video». Chromium con pantalla táctil de 390 px, la oficina de verdad
// (serve.mjs, con AO_VISION=1 y una API de Claude de mentira) y un WebM de ffmpeg: el teléfono saca la foto reducida y 3 cuadros del video, Claude los recibe y la hoja dice qué miró.
// Se salta sin Chromium, sin ffmpeg o sin sharp. Con AO_CAPTURAS=<carpeta> guarda una captura.
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
let nav = null, dir = '';
before(async () => { if (SALTAR) return; nav = await chromium.launch().catch(() => null); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-vision-mov-')); });
after(async () => { await nav?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

test('celular: Crear publicación mira la foto y el video, Claude recibe 1 foto y 3 cuadros y la hoja dice qué miró; «Usar este texto» lo pone y avisa', { skip: SALTAR, timeout: 240000 }, async t => {
  if (!nav) return t.skip('sin Chromium');
  const pedidos = [];
  const claude = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
    const body = JSON.parse(b || '{}'); const sys = JSON.stringify(body.system || ''); if (/mejores el TEXTO/.test(sys)) pedidos.push(body);
    const text = /mejores el TEXTO/.test(sys) ? JSON.stringify({ texto: 'Tu examen visual, gratis todo octubre.', porque: 'Partí de lo que se ve.', vi: 'Una pantalla con barras de colores' }) : '{}';
    rs.writeHead(200, { 'content-type': 'application/json' });
    rs.end(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
  }); });
  const cport = await listen(claude);
  const data = path.join(dir, 'data'), brain = path.join(dir, 'brain'); fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
  const mes = new Date().toISOString().slice(0, 7), mdir = path.join(brain, 'Agents Office', 'media', mes); fs.mkdirSync(mdir, { recursive: true });
  fs.writeFileSync(path.join(mdir, 'mesa.jpg'), await sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 230, g: 106, b: 47 } } }).jpeg().toBuffer());
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=4:size=640x360:rate=10', '-c:v', 'libvpx', '-b:v', '300k', path.join(mdir, 'clip.webm')]); assert.equal(r.status, 0, String(r.stderr));
  for (const [n, k, ext, w, h] of [['mesa', 'image', 'jpg', 2400, 1800], ['clip', 'video', 'webm', 640, 360]]) fs.writeFileSync(path.join(mdir, `${n}.json`), JSON.stringify({ file: `${mes}/${n}.${ext}`, kind: k, model: 'upload', prompt: n, w, h, at: Date.now() + (k === 'video' ? 1 : 0), by: 'dueno' }));
  const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro', redes: ['instagram', 'facebook'] } }));
  const probe = http.createServer(), port = await listen(probe); await new Promise(rr => probe.close(rr));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_API_KEY: 'no-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, AO_VISION: '1', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 160; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún */ } await new Promise(rr => setTimeout(rr, 250)); }

  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: 'reduce' }), p = await ctx.newPage(); p.setDefaultTimeout(90000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('ao.onboarded', '1'); localStorage.setItem('ao.movil', 'movil'); } catch { /* sin almacenamiento */ } });
  await p.goto(base + '/'); await p.waitForSelector('#mvRoot .mv-tabs');
  await p.locator('.mv-tab[data-tab="mas"]').tap(); await p.waitForSelector('.mv-hoja.mv-mas'); await p.locator('.mv-lista-b[data-vista="contenido"]').tap(); await p.waitForSelector('[data-vista="contenido"]:not([hidden])');
  await p.locator('[data-vista="contenido"] [data-nueva]').first().tap(); await p.waitForSelector('[data-vista="crear"]:not([hidden]) .md-red');
  const C = '[data-vista="crear"]';
  await p.locator(`${C} [data-ir="1"]`).tap(); await p.locator(`${C} [data-ir="1"]`).tap(); // Dónde → Qué → Medios
  await p.waitForSelector(`${C} .md-gal-b[data-gal]`);
  assert.equal(await p.locator(`${C} [data-mejorar]`).count(), 0, 'sin medios en la publicación, el paso Medios no ofrece escribir a partir de la foto');
  for (const f of [`${mes}/mesa.jpg`, `${mes}/clip.webm`]) await p.locator(`${C} .md-gal-b[data-gal="${f}"]`).tap();
  await p.waitForSelector(`${C} [data-mejorar]`);
  assert.match(await p.locator(`${C} [data-mejorar]`).first().innerText(), /Escribir el texto a partir de la foto y el video/);
  assert.match(await p.locator(C).innerText(), /de un video ve unos cuadros, no oye el sonido/);
  await p.locator(`${C} [data-mejorar]`).first().tap();
  await p.waitForSelector('.mv-hoja:has-text("Propuesta de Marketing")');
  assert.equal(pedidos.length, 1);
  const cont = pedidos[0].messages[0].content; assert.deepEqual(cont.map(x => x.type), ['image', 'image', 'image', 'image', 'text'], 'la foto y 3 cuadros del video');
  for (const im of cont.slice(0, 4)) { const m = await sharp(Buffer.from(im.source.data, 'base64')).metadata(); assert.ok(Math.max(m.width, m.height) <= 1568, `${m.width}×${m.height}`); }
  assert.match(cont[4].text, /imagen 1: la foto «mesa\.jpg» · imagen 2: un cuadro del video «clip\.webm»/); assert.match(cont[4].text, /Escríbelo a partir de lo que se ve/, 'sin texto, parte de la foto');
  const hoja = await p.locator('.mv-hoja:has-text("Propuesta de Marketing")').innerText(); assert.match(hoja, /Tu examen visual, gratis todo octubre\./); assert.match(hoja, /Miró 1 foto y 3 cuadros de un video: Una pantalla con barras de colores/);
  if (process.env.AO_CAPTURAS) { fs.mkdirSync(process.env.AO_CAPTURAS, { recursive: true }); await p.screenshot({ path: path.join(process.env.AO_CAPTURAS, 'mejorar-mira-movil.png') }); }
  const botones = await p.locator('.mv-hoja button').evaluateAll(bs => bs.filter(b => b.offsetParent).map(b => ({ t: b.textContent.trim(), h: b.getBoundingClientRect().height })).filter(b => /Usar este texto|Dejar el mío/.test(b.t)));
  assert.ok(botones.length === 2 && botones.every(b => b.h >= 44), 'los botones de la hoja miden 44 px o más: ' + JSON.stringify(botones));
  await p.locator('.mv-hoja button:has-text("Usar este texto")').tap();
  await p.waitForFunction(() => /Puse el texto/.test(document.body.innerText));
  await p.locator(`${C} [data-ir="-1"]`).tap(); await p.waitForSelector(`${C} #mdTexto`);
  assert.equal(await p.inputValue(`${C} #mdTexto`), 'Tu examen visual, gratis todo octubre.');
  assert.match(await p.locator(C).innerText(), /Mira la foto y el video de la publicación para escribir/);
  assert.deepEqual(errs, [], 'sin errores en la página');
});
