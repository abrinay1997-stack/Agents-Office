// Herramienta de desarrollo (no entra en `npm run check`): el banco de presets en VIDEO (F5) y las fichas de Voz y Música (F6)
// EN EL NAVEGADOR, con una oficina de prueba en una carpeta temporal. Nunca una key real: las de los motores se vacían; el video
// sale del motor «prueba-video» (local, gratis) y MiniMax tiene una clave de mentira apuntada a un puerto cerrado (nada se genera
// con él: las fichas solo rellenan ajustes).
//   node scripts/presets-video-recorrido.mjs                       → data/capturas/presets/video/  (capturas + informe.json)
//   AO_AXE=/ruta/a/axe.min.js node scripts/presets-video-recorrido.mjs   → además, axe en cada captura
// Recorre, haciendo clic como el dueño (a 1512 px):
//   1. Video + Avanzado: el paso «Presets de video» con sus cuatro puertas; «Animar mi foto» pide el primer fotograma (paso 4)
//   2. El banco de video (B): «Giro 360» + «Vuelta completa alrededor» → las reglas del clip (un movimiento, rígidos)
//   3. GENERAR: compila (no gasta) y aplica por /api/media/presets/apply al motor de prueba
//   4. «De antes a después» sin la foto de llegada: el motivo junto a GENERAR y NO se genera
//   5. «Movimiento del sujeto»: pide el video de guía y el plan lo usa como guía
//   6. El escenario 3D en video · «Guardar como preset» (sale en el banco de video)
//   7. Voz y Música: las fichas ponen sus ajustes (con DESHACER)
// y captura el paso, el banco y las fichas a 390, 1024 (con Dimitri abierto) y 1512 px, en claro y en oscuro.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'presets', 'video');
fs.mkdirSync(OUT, { recursive: true });
const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? fs.readFileSync(process.env.AO_AXE, 'utf8') : null;
const informe = { pasos: [], capturas: [], axe: {}, errores: [] };
const ok = (paso, cond, detalle) => { informe.pasos.push({ paso, ok: !!cond, detalle }); console.log(`${cond ? '✓' : '✗'} ${paso}${detalle ? ' — ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)) : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* la galería de prueba: una cafetera (foto) y un video de guía (bytes de mentira: solo se elige, nunca se reproduce) */
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-presets-video-'));
const brain = path.join(sandbox, 'brain'), mdir = path.join(brain, 'Agents Office', 'media', '2026-10');
fs.mkdirSync(mdir, { recursive: true }); fs.writeFileSync(path.join(brain, 'index.md'), '# Prueba\n');
const cafetera = await sharp({ create: { width: 900, height: 900, channels: 3, background: { r: 236, g: 232, b: 226 } } }).composite([{ input: await sharp({ create: { width: 360, height: 480, channels: 3, background: { r: 190, g: 40, b: 40 } } }).png().toBuffer(), left: 270, top: 220 }]).png().toBuffer();
const pon = (file, buf, rec) => { fs.writeFileSync(path.join(brain, 'Agents Office', 'media', file), buf); fs.writeFileSync(path.join(brain, 'Agents Office', 'media', file.replace(/\.\w+$/, '.json')), JSON.stringify({ id: file, file, at: Date.now(), by: 'you', upload: true, provider: 'subida', model: '', ...rec })); };
pon('2026-10/2026-10-01 cafetera roja 100000.png', cafetera, { kind: 'image', ext: 'png', w: 900, h: 900, prompt: 'cafetera roja' });
pon('2026-10/2026-10-01 baile guia 100001.mp4', Buffer.from('no es un video de verdad'), { kind: 'video', ext: 'mp4', w: 720, h: 1280, prompt: 'baile guia' });

const SIN = ['HF_KEY', 'HF_API_KEY', 'HF_API_SECRET', 'FAL_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'VOYAGE_API_KEY', 'TELEGRAM_BOT_TOKEN', 'META_ACCESS_TOKEN', 'ANTHROPIC_API_KEY', 'METRICOOL_USER_TOKEN'];
const probe = http.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(sandbox, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(sandbox, 'local.json'), CLAUDE_BIN: path.join(sandbox, 'no-claude'),
  MINIMAX_API_KEY: 'clave-de-mentira', MINIMAX_API_BASE: 'http://127.0.0.1:9' }; // MiniMax «encendido» para ver las fichas; el puerto 9 está cerrado: nada sale
for (const k of SIN) env[k] = '';
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
let up = false; for (let i = 0; i < 160 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch {} if (!up) await wait(250); }
if (!up) { srv.kill(); throw new Error('la oficina de prueba no arrancó: ' + log.slice(-600)); }

const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let browser; try { browser = await chromium.launch({ executablePath: process.env.AO_CHROME || undefined, args: ARGS }); } catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }
const S = '#studioOv';
async function abrirEstudio(page, tema = 'light', kind = 'video', avanzado = true) {
  await page.goto(base + '/'); await page.waitForTimeout(1200);
  await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; }, tema);
  await page.keyboard.press('e'); await page.waitForSelector(`${S}.on`); await page.waitForTimeout(500);
  await page.click(`${S} [data-kind="${kind}"]`); await page.waitForTimeout(200);
  if (avanzado && await page.isVisible(`${S} [data-nivel="avanzado"]`)) await page.click(`${S} [data-nivel="avanzado"]`);
  if (kind === 'video' && avanzado) await page.waitForSelector(`${S} .bk-doors4`, { timeout: 15000 });
}
const elegirModelo = async (page, id) => { await page.click(`${S} .st-mpick`); await page.click(`${S} .st-mo[data-id="${id}"]`); await page.waitForTimeout(200); };
const elegirDeGaleria = async (page, quien) => { await page.waitForSelector(`${S}.st-pickmode`, { timeout: 8000 }); await page.click(`${S} .st-card[data-f*="${quien}"] .st-thumb`); await page.waitForTimeout(300); };
const banco = async (page, q, id) => {
  if (!(await page.isVisible(`${S} .st-bank .bk-qi`))) await page.click(`${S} .bk-open`);
  await page.fill(`${S} .bk-qi`, q); await page.waitForTimeout(200);
  await page.click(`${S} .bk-card[data-pid="${id}"]`); await page.waitForTimeout(150);
};
const limpiar = async page => { for (let i = 0; i < 12 && await page.$(`${S} .bk [data-unpila]`); i++) await page.click(`${S} .bk [data-unpila]`); };
const plan = async page => { await page.waitForFunction(s => { const t = document.querySelector(s + ' .st-est')?.textContent || ''; return t && !/calculando/.test(t); }, S, { timeout: 15000 }); await page.waitForTimeout(350); return (await page.textContent(`${S} .st-est`)).replace(/\s+/g, ' ').trim(); };
const reglas = page => page.$$eval(`${S} .bk-reglas li`, l => l.map(x => x.textContent.trim()));
const trabajos = async () => (await (await fetch(base + '/api/media')).json()).jobs || [];
async function axe(p, name) {
  if (!AXE) return;
  await p.evaluate(AXE);
  const r = await p.evaluate(async s => { const x = await window.axe.run(s, { resultTypes: ['violations'] }); return x.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, ej: v.nodes.slice(0, 3).map(nd => nd.target.join(' ')) })); }, S);
  informe.axe[name] = r; console.log('  axe', name, r.map(v => `${v.id}(${v.impact})×${v.n}`).join(', ') || 'limpio');
}
const medir = p => p.evaluate(s => {
  const root = document.querySelector(s), vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); };
  const ctl = [...root.querySelectorAll('.bk button, .bk input, .bk select, .st-bank button, .st-bank input')].filter(vis);
  const chicos = ctl.filter(x => { const r = x.getBoundingClientRect(); return r.height < 23.5 && !x.closest('.e3d'); }).map(x => (x.textContent || x.getAttribute('aria-label') || x.className).trim().slice(0, 30));
  const letras = [...root.querySelectorAll('.bk *, .st-bank *')].filter(x => vis(x) && [...x.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(x => parseFloat(getComputedStyle(x).fontSize)).filter(Boolean);
  return { scrollX: document.documentElement.scrollWidth > innerWidth + 1, chicos: [...new Set(chicos)].slice(0, 8), letraMin: letras.length ? Math.min(...letras) : null };
}, S);

try {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => informe.errores.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404|Failed to load resource|MEDIA_ERR|video/i.test(m.text())) informe.errores.push(m.text()); });

  /* 1. Video + Avanzado */
  await abrirEstudio(page, 'light', 'video', true);
  await elegirModelo(page, 'prueba-video');
  ok('Video tiene Básico · Avanzado y en Avanzado el paso «Presets de video» con cuatro puertas', await page.isVisible(`${S} .st-nivel`) && (await page.$$(`${S} .bk-doors4 [data-puerta]`)).length === 4);
  ok('El modelo y el formato siguen a la vista (son los del compositor)', await page.isVisible(`${S} .st-mpick`) && await page.isVisible(`${S} .st-ratios`));
  ok('En video, el material es el del paso 4 (se ve), no unas casillas del banco', await page.isVisible(`${S} .st-matstep`) && !(await page.$(`${S} .bk [data-subir="foto"]`)));
  await page.click(`${S} [data-puerta="foto"]`); await elegirDeGaleria(page, 'cafetera');
  await page.waitForTimeout(400);
  const mat = await page.textContent(`${S} .bk-mat`);
  ok('«Animar mi foto» pide el primer fotograma en el paso 4 y el banco lo ve', /primer fotograma/.test(mat) && (await page.$$(`${S} .st-slot[data-role="start"] .st-chip`)).length === 1, mat.trim());
  ok('La línea «Ahora» dice la puerta sin quejarse', /Animar mi foto/.test(await page.textContent(`${S} .bk-modo`)) && !(await page.$(`${S} .bk-modo .bk-falta`)));

  /* 2. El banco de video y las reglas del clip */
  await banco(page, 'giro 360', 'vp-giro-360');
  ok('El banco de video: su título y sus grupos (cámara, distancia, producto, look…)', /de video/.test(await page.textContent(`${S} .st-bank .bk-sh`)));
  await page.fill(`${S} .bk-qi`, ''); await page.waitForTimeout(200);
  const grupos = await page.$$eval(`${S} .st-bank .bk-g summary b`, l => l.map(x => x.textContent.trim()));
  ok('Los grupos de video, y ninguno de imagen', ['Movimiento de cámara', 'Distancia de la cámara', 'Producto en video', 'Look', 'Editar un video', 'Formato de salida', 'Sonido del video'].every(g => grupos.includes(g)) && !grupos.includes('Fondo'), grupos.join(', '));
  await banco(page, 'vuelta completa', 'cam-orbita');
  await page.screenshot({ path: path.join(OUT, 'recorrido-2-banco.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  let est = await plan(page), rg = await reglas(page);
  ok('Las reglas del clip: un movimiento de cámara por clip', rg.some(t => /Un movimiento de cámara por clip: «Vuelta completa alrededor»/.test(t)), rg.join(' | '));
  ok('Las reglas del clip: el aviso del giro 360 y que la receta ya mueve el producto', rg.some(t => /deformarse/.test(t)) && rg.some(t => /ya mueve el producto/.test(t)));
  ok('Junto a GENERAR: el costo del plan (prueba: gratis)', /Con presets · gratis/.test(est), est);
  await page.screenshot({ path: path.join(OUT, 'recorrido-2-reglas.png') });
  await banco(page, 'reel', 'vf-reel'); await page.keyboard.press('Escape'); await plan(page);
  rg = await reglas(page);
  ok('El formato del compositor manda: «Reel» (9:16) con 16:9 se dice y ofrece «Poner 9:16»', rg.some(t => /es 9:16; tu formato .* es 16:9/.test(t)) && await page.isVisible(`${S} [data-arfmt="9:16"]`), rg.join(' | '));
  await page.click(`${S} [data-arfmt="9:16"]`); await page.waitForTimeout(400); await plan(page);
  ok('…«Poner 9:16» lo cambia en el paso 5 (y el aviso se va)', await page.getAttribute(`${S} .st-ar[data-ar="9:16"]`, 'aria-checked') === 'true' && !(await page.$(`${S} [data-arfmt]`)));
  await page.click(`${S} .bk [data-unpila="2"]`); await page.waitForTimeout(200);

  /* 3. GENERAR: compile no gasta, apply sí (al motor de prueba) */
  const j0 = (await trabajos()).length;
  await page.click(`${S} .st-go`);
  await page.waitForFunction(s => /marcha|no |necesita/i.test(document.querySelector(s + ' .st-msg')?.textContent || ''), S, { timeout: 15000 });
  const msg3 = await page.textContent(`${S} .st-msg`);
  let j1 = []; for (let i = 0; i < 20 && j1.length <= j0; i++) { j1 = await trabajos(); if (j1.length <= j0) await wait(250); }
  const jv = j1.find(j => j.model === 'prueba-video');
  ok('GENERAR con presets de video: un trabajo de video con el motor de prueba', /marcha/.test(msg3) && jv && jv.kind === 'video', msg3);
  ok('El trabajo lleva la foto como primer fotograma y la receta', jv && JSON.stringify(jv).includes('cafetera') && JSON.stringify(jv).includes('vp-giro-360'));

  /* 4. Lo que no se puede: el motivo junto a GENERAR y no se genera */
  await limpiar(page); await banco(page, 'antes despues', 'vp-antes-despues'); await page.keyboard.press('Escape');
  est = await plan(page);
  ok('«De antes a después» sin la foto de llegada: el motivo junto a GENERAR', /necesita/i.test(est) && await page.$eval(`${S} .st-est`, x => x.classList.contains('over')), est);
  ok('…y las reglas lo dicen como «No se puede»', (await reglas(page)).some(t => /^No se puede:/.test(t)));
  const j2 = (await trabajos()).length; await page.click(`${S} .st-go`); await page.waitForTimeout(1200);
  ok('…y GENERAR no gasta', (await trabajos()).length === j2, await page.textContent(`${S} .st-msg`));

  /* 5. Movimiento del sujeto */
  await limpiar(page);
  await page.click(`${S} [data-movsuj]`);
  await elegirDeGaleria(page, 'baile');
  await page.waitForTimeout(500); est = await plan(page);
  ok('«Movimiento del sujeto»: el preset entra y pide el video de guía (paso 4)', await page.getAttribute(`${S} [data-movsuj]`, 'aria-pressed') === 'true' && /video de guía/.test(await page.textContent(`${S} .bk-mat`)), (await page.textContent(`${S} .bk-mat`)).trim());
  const cp = await (await fetch(base + '/api/media/presets/compile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'video', pila: [{ id: 'ved-copiar-movimiento' }], entradas: { inicial: ['2026-10/2026-10-01 cafetera roja 100000.png'], guia: ['2026-10/2026-10-01 baile guia 100001.mp4'] }, model: 'prueba-video' }) })).json();
  ok('…y el plan manda ese video como guía (la foto, como primer fotograma)', !cp.plan.errores.length && cp.plan.request.media.video?.length === 1 && cp.plan.request.media.start?.length === 1 && /gratis/.test(est), est);
  await page.screenshot({ path: path.join(OUT, 'recorrido-5-movimiento.png') });

  /* 6. Escenario 3D y Guardar como preset */
  await page.click(`${S} [data-movsuj]`); await page.waitForTimeout(300); est = await plan(page);
  ok('Sin el preset, el video del paso 4 deja de ser la guía (y el banco lo dice)', /tu video/.test(await page.textContent(`${S} .bk-mat`)));
  await page.click(`${S} .st-slot[data-role="video"] [data-unslot]`); await page.waitForTimeout(300);
  await banco(page, 'se acerca', 'cam-acercar'); await page.keyboard.press('Escape');
  await page.click(`${S} [data-escena="abrir"]`); await page.waitForSelector(`${S} .st-bank .e3d`, { timeout: 15000 }); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'recorrido-6-escenario.png') });
  await page.click(`${S} .st-bank .bk-pri[data-cerrar]`); await page.waitForTimeout(300); est = await plan(page);
  ok('Escenario 3D en video: dónde empieza la cámara, con el movimiento del preset', /dónde empieza la cámara/.test(await page.textContent(`${S} .bk-esc`)) && /Con presets · gratis/.test(est) && /al empezar/i.test(await page.textContent(`${S} .bk-escl`)), est + ' · ' + (await page.textContent(`${S} .bk-escl`)));
  const cmp = await (await fetch(base + '/api/media/presets/compile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'video', pila: [{ id: 'cam-acercar' }], escena: { cuadro: { proporcion: '16:9' } }, entradas: { inicial: ['2026-10/2026-10-01 cafetera roja 100000.png'] }, model: 'prueba-video' }) })).json();
  ok('…y el prompt dice la escena y el movimiento', /push in|moves in|closer/i.test(cmp.plan.prompt) && /m away|eye-level|view/i.test(cmp.plan.prompt), cmp.plan.prompt.slice(0, 200));
  await page.click(`${S} [data-guardar="receta"]`); await page.fill(`${S} .bk-guardar input[name=nombre]`, 'Reel de cafetera');
  await page.click(`${S} .bk-guardar button[type=submit]`); await page.waitForTimeout(1500);
  const lv = await (await fetch(base + '/api/media/presets?medio=video')).json(), li = await (await fetch(base + '/api/media/presets?medio=image')).json();
  ok('«Guardar como preset»: la receta de video sale en el banco de video (y no en el de imagen)', lv.presets.some(p => p.categoria === 'mios' && p.nombre === 'Reel de cafetera') && !li.presets.some(p => p.nombre === 'Reel de cafetera'));
  ok('…como nota del Cerebro', fs.existsSync(path.join(brain, 'Estudio', 'Presets', 'Reel de cafetera.md')));

  /* 7. Voz y Música: fichas rápidas */
  await page.click(`${S} [data-kind="audio"]`); await page.waitForSelector(`${S} .bk-fichas`, { timeout: 10000 });
  ok('Voz: las fichas rápidas a la vista (3) y sin el banco ni Avanzado', (await page.$$(`${S} .bk-ficha`)).length === 3 && !(await page.isVisible(`${S} .st-nivel`)) && !(await page.$(`${S} .bk-doors`)));
  await page.click(`${S} .bk-ficha[data-ficha="voz-anuncio"]`); await page.waitForTimeout(300);
  const emo = await page.$eval(`${S} select[data-set="emotion"]`, x => x.value).catch(() => ''), vel = await page.$eval(`${S} input[data-set="speed"]`, x => x.value).catch(() => '');
  ok('«Voz para anuncio» pone la emoción y la velocidad del modelo', emo === 'happy' && vel === '1.05', `${emo} · ${vel}`);
  ok('…la ficha queda pulsada y hay DESHACER', await page.getAttribute(`${S} .bk-ficha[data-ficha="voz-anuncio"]`, 'aria-pressed') === 'true' && await page.isVisible(`${S} .bk-toast [data-deshacer]`));
  await page.click(`${S} .bk-toast [data-deshacer]`); await page.waitForTimeout(300);
  ok('DESHACER devuelve los ajustes de antes', (await page.$eval(`${S} select[data-set="emotion"]`, x => x.value).catch(() => 'x')) !== 'happy');
  await page.click(`${S} [data-kind="music"]`); await page.waitForSelector(`${S} .bk-ficha[data-ficha="mus-reel"]`, { timeout: 10000 });
  await page.click(`${S} .bk-ficha[data-ficha="mus-reel"]`); await page.waitForTimeout(300);
  const inst = await page.$eval(`${S} input[data-set="instrumental"]`, x => x.checked).catch(() => null), sty = await page.$eval(`${S} input[data-set="style"]`, x => x.value).catch(() => '');
  ok('Música: «Fondo para reel» pone instrumental y el estilo', inst === true && /120 bpm/.test(sty), `${inst} · ${sty}`);
  await page.screenshot({ path: path.join(OUT, 'recorrido-7-musica.png') });
  await page.click(`${S} [data-kind="video"]`); await page.waitForSelector(`${S} .bk-doors4`);
  ok('Volver a Video conserva la receta de video', (await page.$$(`${S} .bk .bk-chip`)).length >= 1);
  await page.click(`${S} [data-kind="image"]`); await page.waitForSelector(`${S} .bk-doors:not(.bk-doors4)`);
  ok('En Imagen, el banco de imagen de siempre (tres puertas, sin la receta de video)', (await page.$$(`${S} .bk-doors [data-puerta]`)).length === 3 && !(await page.$(`${S} .bk [data-movsuj]`)));
  await ctx.close();

  /* la demo file:// (sin servidor): la fábrica de dist/presets-fabrica.js trae también los de video; B en Video abre su banco */
  const dctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, reducedMotion: 'reduce' });
  const dp = await dctx.newPage(); dp.on('pageerror', e => informe.errores.push('demo: ' + e.message));
  await dp.goto('file:///' + path.join(ROOT, 'dist', 'command-centre-v2.html').replace(/\\/g, '/')); await dp.waitForTimeout(1500);
  await dp.keyboard.press('e'); await dp.waitForSelector(`${S}.on`); await dp.click(`${S} [data-kind="video"]`); await dp.waitForTimeout(300);
  await dp.keyboard.press('b'); await dp.waitForSelector(`${S} .st-bank:not([hidden]) .bk-qi`, { timeout: 15000 });
  await dp.fill(`${S} .bk-qi`, 'la cámara se acerca'); await dp.waitForFunction(s => document.querySelectorAll(s + ' .bk-card').length > 0, S, { timeout: 10000 }).catch(() => {});
  const dk = await dp.$$eval(`${S} .bk-card`, l => l.map(x => x.dataset.pid));
  ok('Demo file://: B en Video se queda en Video y su banco busca con la fábrica junto a la página', await dp.getAttribute(`${S} [data-kind="video"]`, 'aria-pressed') === 'true' && dk.includes('cam-acercar'), dk.slice(0, 4).join(', '));
  await dp.click(`${S} .bk-card[data-pid="cam-acercar"]`); await dp.keyboard.press('Escape'); await dp.waitForTimeout(500);
  const dq = (await dp.textContent(`${S} .st-est`)).replace(/\s+/g, ' ');
  ok('Demo file://: el plan de video se arma sin servidor (la demo no tiene motores: lo dice junto a GENERAR)', /Con presets|Ningún modelo encendido/.test(dq) && !/calculando/.test(dq), dq.slice(0, 120));
  await dctx.close();

  /* ---------- capturas: 390 · 1024 (con Dimitri) · 1512, claro y oscuro ---------- */
  for (const tema of ['light', 'dark']) for (const [w, h] of [[390, 844], [1024, 768], [1512, 900]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, reducedMotion: 'reduce' });
    const p = await c.newPage(); p.on('pageerror', e => informe.errores.push(`${w} ${tema}: ${e.message}`));
    await abrirEstudio(p, tema, 'video', true);
    if (w === 1024) { await p.click('#topDimitri').catch(() => {}); await p.waitForTimeout(700); }
    const dim = await p.evaluate(() => document.body.classList.contains('subOpen'));
    await elegirModelo(p, 'prueba-video');
    await p.click(`${S} [data-puerta="foto"]`); await elegirDeGaleria(p, 'cafetera');
    if (w < 700) await p.click(`${S} [data-pt="gen"]`).catch(() => {});
    await banco(p, 'giro 360', 'vp-giro-360'); await banco(p, 'reel', 'vf-reel');
    const m1 = await medir(p); await p.screenshot({ path: path.join(OUT, `banco-${w}-${tema}.png`) }); await axe(p, `banco-${w}-${tema}`);
    await p.keyboard.press('Escape'); if (w < 700) await p.click(`${S} [data-pt="gen"]`).catch(() => {});
    await plan(p); await p.evaluate(s => document.querySelector(s + ' .bk')?.scrollIntoView({ block: 'start' }), S); await p.waitForTimeout(300);
    const m2 = await medir(p); await p.screenshot({ path: path.join(OUT, `compositor-${w}-${tema}.png`) }); await axe(p, `compositor-${w}-${tema}`);
    await p.click(`${S} [data-kind="music"]`); await p.waitForSelector(`${S} .bk-fichas`); await p.click(`${S} .bk-ficha[data-ficha="mus-tropical"]`); await p.waitForTimeout(300);
    await p.evaluate(s => document.querySelector(s + ' .bk')?.scrollIntoView({ block: 'start' }), S); await p.waitForTimeout(200);
    const m3 = await medir(p); await p.screenshot({ path: path.join(OUT, `fichas-${w}-${tema}.png`) }); await axe(p, `fichas-${w}-${tema}`);
    informe.capturas.push({ ancho: w, tema, dimitri: dim, banco: m1, compositor: m2, fichas: m3 });
    const chicos = [...m1.chicos, ...m2.chicos, ...m3.chicos];
    console.log(`  ${w} ${tema}${dim ? ' (Dimitri abierto)' : ''}: scroll horizontal ${m1.scrollX || m2.scrollX || m3.scrollX ? 'SÍ' : 'no'} · letra mínima ${Math.min(...[m1.letraMin, m2.letraMin, m3.letraMin].filter(Boolean))} px · objetivos < 24 px: ${chicos.join(', ') || 'ninguno'}`);
    ok(`${w} ${tema}: sin scroll horizontal, objetivos de 24 px y letra ≥ 10,5 px`, !m1.scrollX && !m2.scrollX && !m3.scrollX && !chicos.length && Math.min(...[m1.letraMin, m2.letraMin, m3.letraMin].filter(Boolean)) >= 10.5);
    if (w === 1024) ok('1024: Dimitri abierto al lado', dim);
    await c.close();
  }
} catch (e) { informe.errores.push('recorrido: ' + (e.stack || e.message)); console.error(e); }
finally {
  await browser.close(); srv.kill();
  fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(informe, null, 2));
  const mal = informe.pasos.filter(p => !p.ok).length, axeMal = Object.values(informe.axe).reduce((n, v) => n + v.length, 0);
  console.log(`\n${informe.pasos.length - mal} de ${informe.pasos.length} pasos bien · ${informe.errores.length} errores de página · axe: ${AXE ? (axeMal ? axeMal + ' reglas con fallos' : 'limpio') : 'sin AO_AXE'} · ${OUT}`);
  if (informe.errores.length) console.log(informe.errores.slice(0, 8).join('\n'));
  process.exitCode = mal || informe.errores.length || axeMal ? 1 : 0;
}
