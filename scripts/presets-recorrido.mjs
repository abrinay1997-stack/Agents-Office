// Herramienta de desarrollo (no entra en `npm run check`): el banco de presets de punta a punta EN EL NAVEGADOR, con una
// oficina de prueba en una carpeta temporal y un Google de mentira (nunca una key real: todas las keys de motores se vacían).
//   node scripts/presets-recorrido.mjs   → data/capturas/presets/integracion/  (capturas + informe.json)
// Recorre, haciendo clic como el dueño:
//   1. «Que se vea más clara» (local, gratis)        2. «Catálogo para la web» (la IA de mentira + el blanco 255 y el canal, local)
//   3. «Copiar el color de una foto» (local)         4. «Sala» con el escenario 3D (la guía y las frases llegan a la petición)
//   5. «Guardar como preset» (la nota en <cerebro>/Estudio/Presets y en /api/brain)
// y después captura el compositor, el banco y el escenario a 390, 1024 y 1512 px, en claro y en oscuro.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'presets', 'integracion');
fs.mkdirSync(OUT, { recursive: true });
const informe = { pasos: [], capturas: [], errores: [] };
const ok = (paso, cond, detalle) => { informe.pasos.push({ paso, ok: !!cond, detalle }); console.log(`${cond ? '✓' : '✗'} ${paso}${detalle ? ' — ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)) : ''}`); };

/* las fotos de prueba: una cama en la bodega y una referencia cálida */
async function foto(w, h, fondo, mueble) {
  const m = await sharp({ create: { width: Math.round(w * 0.5), height: Math.round(h * 0.4), channels: 3, background: mueble } }).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 3, background: fondo } }).composite([{ input: m, left: Math.round(w * 0.25), top: Math.round(h * 0.35) }]).png().toBuffer();
}
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-presets-'));
const brain = path.join(sandbox, 'brain'), mdir = path.join(brain, 'Agents Office', 'media', '2026-10');
fs.mkdirSync(mdir, { recursive: true }); fs.writeFileSync(path.join(brain, 'index.md'), '# Prueba\n');
const FOTOS = [['cama-bodega', await foto(900, 700, { r: 222, g: 218, b: 210 }, { r: 120, g: 82, b: 50 })], ['referencia-calida', await foto(900, 700, { r: 250, g: 190, b: 120 }, { r: 200, g: 120, b: 60 })]];
FOTOS.forEach(([id, buf], i) => {
  const file = `2026-10/2026-10-01 ${id} 10000${i}.png`;
  fs.writeFileSync(path.join(brain, 'Agents Office', 'media', file), buf);
  fs.writeFileSync(path.join(brain, 'Agents Office', 'media', file.replace(/\.png$/, '.json')), JSON.stringify({ id: file, file, kind: 'image', ext: 'png', at: Date.now() - i * 1000, w: 900, h: 700, prompt: id, provider: 'subida', model: '', by: 'you', upload: true }));
});

/* el Google de mentira: guarda lo que le llega y devuelve la cama sobre casi blanco */
const vistos = []; const salida = await foto(1024, 1024, { r: 250, g: 250, b: 248 }, { r: 120, g: 82, b: 50 });
const g = http.createServer((req, res) => { let b = ''; req.on('data', d => { b += d; }); req.on('end', () => { try { vistos.push({ url: req.url, body: JSON.parse(b || '{}') }); } catch { vistos.push({ url: req.url }); } res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: salida.toString('base64') } }] } }] })); }); });
await new Promise(r => g.listen(0, '127.0.0.1', r));

const SIN = ['HF_KEY', 'HF_API_KEY', 'HF_API_SECRET', 'FAL_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'MINIMAX_API_KEY', 'GOOGLE_API_KEY', 'VOYAGE_API_KEY', 'TELEGRAM_BOT_TOKEN', 'META_ACCESS_TOKEN'];
const port = 4800 + Math.floor(Math.random() * 90);
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(sandbox, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(sandbox, 'local.json'), GEMINI_API_KEY: 'clave-de-mentira', AO_GEMINI_BASE: `http://127.0.0.1:${g.address().port}` };
for (const k of SIN) env[k] = '';
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://localhost:${port}`;
let up = false; for (let i = 0; i < 80 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch {} if (!up) await new Promise(r => setTimeout(r, 250)); }
if (!up) { srv.kill(); g.close(); throw new Error('la oficina de prueba no arrancó: ' + log.slice(-600)); }

const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let browser; try { browser = await chromium.launch({ executablePath: process.env.AO_CHROME || undefined, args: ARGS }); } catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }
const S = '#studioOv';
async function abrirEstudio(page, w, tema = 'light') {
  await page.goto(base + '/'); await page.waitForTimeout(1200);
  await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; }, tema);
  await page.keyboard.press('e'); await page.waitForSelector(`${S}.on`); await page.waitForTimeout(500);
  await page.click(`${S} [data-kind="image"]`);
}
const elegirDeGaleria = async (page, quien) => { await page.waitForSelector(`${S}.st-pickmode`); await page.click(`${S} .st-card[data-f*="${quien}"] .st-thumb`); await page.waitForTimeout(200); };
const banco = async (page, q, id) => {
  if (!(await page.isVisible(`${S} .st-bank`))) await page.click(`${S} .bk-open`);
  await page.fill(`${S} .bk-qi`, q); await page.waitForTimeout(150);
  await page.click(`${S} .bk-card[data-pid="${id}"]`); await page.waitForTimeout(100);
};
const limpiar = async page => { for (let i = 0; i < 12 && await page.$(`${S} [data-unpila]`); i++) await page.click(`${S} [data-unpila]`); if (await page.$(`${S} [data-escena="quitar"]`)) await page.click(`${S} [data-escena="quitar"]`); };
const generar = async page => {
  await page.waitForFunction(s => { const q = document.querySelector(s + ' .bk-que summary'); return q && !/calculando/.test(q.textContent); }, S, { timeout: 15000 });
  const que = await page.textContent(`${S} .bk-que summary`);
  const antes = await page.$$eval(`${S} .bk-r`, l => l.length);
  await page.click(`${S} .st-go`);
  await page.waitForFunction(([s, n]) => [...document.querySelectorAll(s + ' .bk-r')].length > n || /no |falta|necesita/i.test(document.querySelector(s + ' .st-msg')?.textContent || ''), [S, antes], { timeout: 15000 });
  await page.waitForFunction(s => { const r = document.querySelector(s + ' .bk-r'); return r && !/Haciéndose/.test(r.textContent); }, S, { timeout: 60000 });
  return { que: que.replace(/\s+/g, ' ').trim(), res: (await page.textContent(`${S} .bk-r`)).replace(/\s+/g, ' ').trim(), msg: await page.textContent(`${S} .st-msg`) };
};

try {
  /* ---------- el recorrido, a 1512 px ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => informe.errores.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) informe.errores.push(m.text()); });
  await abrirEstudio(page, 1512);
  await page.click(`${S} [data-puerta="foto"]`); await elegirDeGaleria(page, 'cama-bodega');
  ok('Mejorar mi foto: la foto entra en el banco', await page.$(`${S} .bk-th img`));

  // 1. Más luz (local)
  await banco(page, 'se ve oscura', 'luz-mas-clara'); await page.keyboard.press('Escape');
  let r = await generar(page);
  ok('«Que se vea más clara»: «Qué hará» dice gratis y en tu máquina', /gratis/.test(r.que) && /máquina/.test(r.que), r.que);
  ok('«Que se vea más clara»: sale el resultado con antes y después', /Resultado/.test(r.res) && await page.$(`${S} .bk-ba`), r.res.slice(0, 120));
  ok('«Que se vea más clara»: ninguna llamada a la IA', vistos.length === 0);
  await page.screenshot({ path: path.join(OUT, 'recorrido-1-mas-luz.png') });

  // 2. Catálogo para la web (IA de mentira + fondo 255 y canal en local)
  await limpiar(page);
  await banco(page, 'catalogo web', 'cat-web-panaclaw'); await page.keyboard.press('Escape');
  r = await generar(page);
  ok('«Catálogo para la web»: «Qué hará» dice el costo y el modelo antes de gastar', /US\$|Nano Banana/i.test(r.que), r.que);
  ok('«Catálogo para la web»: una sola llamada a la IA', vistos.length === 1);
  ok('«Catálogo para la web»: la QA del fondo 255 y la ocupación en el resultado', /blanco|Fondo/i.test(r.res) && /ocupa/i.test(r.res), r.res.slice(0, 300));
  await page.screenshot({ path: path.join(OUT, 'recorrido-2-catalogo.png') });

  // 3. Copiar el color de una referencia (local)
  await limpiar(page);
  await page.click(`${S} [data-galeria="ref"]`); await elegirDeGaleria(page, 'referencia-calida');
  await page.click(`${S} [data-atajo="color"]`);
  await banco(page, 'copiar color', 'ref-color'); await page.keyboard.press('Escape');
  const n0 = vistos.length; r = await generar(page);
  ok('«Copiar el color»: gratis y en tu máquina', /gratis/.test(r.que), r.que);
  ok('«Copiar el color»: sin llamar a la IA', vistos.length === n0);
  ok('«Copiar el color»: la QA mide el color', /Color|ΔE|color/i.test(r.res), r.res.slice(0, 200));
  await page.click(`${S} [data-unref="0"]`);

  // 4. Sala con escenario 3D
  await limpiar(page);
  await banco(page, 'sala', 'esc-sala'); await page.keyboard.press('Escape');
  await page.click(`${S} [data-escena="abrir"]`); await page.waitForSelector(`${S} .st-bank .e3d`);
  const toma = await page.$(`${S} .st-bank .e3d [data-toma="tres-cuartos"], ${S} .st-bank .e3d button:has-text("3/4")`); if (toma) await toma.click();
  const dist = await page.$(`${S} .st-bank .e3d [data-dist="margen"], ${S} .st-bank .e3d button:has-text("Con margen")`); if (dist) await dist.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'recorrido-4-escenario.png') });
  await page.click(`${S} .st-bank .bk-pri[data-cerrar]`);
  const n1 = vistos.length; r = await generar(page);
  const pet = vistos[n1]?.body?.contents?.[0]?.parts || [], texto = pet.filter(x => x.text).map(x => x.text).join(' '), imgs = pet.filter(x => x.inlineData || x.inline_data).length;
  ok('«Sala» + escena: la petición lleva la foto y la imagen guía', imgs === 2, `${imgs} imágenes`);
  ok('«Sala» + escena: el rótulo de la guía va en el prompt', /LAYOUT GUIDE ONLY/.test(texto));
  ok('«Sala» + escena: las frases de la escena van en el prompt', /view/.test(texto) && /m away/.test(texto), texto.slice(0, 400));
  ok('«Sala» + escena: la QA compara la ocupación con la de la escena', /escena|ocupa|No medido/i.test(r.res), r.res.slice(0, 200));
  await page.screenshot({ path: path.join(OUT, 'recorrido-4-sala.png') });

  // 5. Guardar como preset desde el resultado
  await page.click(`${S} .bk-r [data-guardar]`);
  await page.fill(`${S} .bk-guardar input[name=nombre]`, 'Sala de PanaClaw'); await page.fill(`${S} .bk-guardar input[name=marca]`, 'PanaClaw');
  await page.click(`${S} .bk-guardar button[type=submit]`); await page.waitForTimeout(1500);
  const nota = path.join(brain, 'Estudio', 'Presets', 'Sala de PanaClaw.md');
  ok('«Guardar como preset»: la nota está en <cerebro>/Estudio/Presets', fs.existsSync(nota));
  const cerebro = await (await fetch(base + '/api/brain')).json();
  ok('«Guardar como preset»: el Cerebro la tiene como neurona', (cerebro.nodes || []).some(n => /Sala de PanaClaw/.test(n.id || n.name || n.label || '')));
  const lista = await (await fetch(base + '/api/media/presets?medio=image')).json();
  ok('«Guardar como preset»: el banco la lista en «De PanaClaw»', lista.presets.some(p => p.categoria === 'mios' && p.nombre === 'Sala de PanaClaw'));
  await ctx.close();

  // 6. La demo file:// (sin servidor): la fábrica llega de dist/presets-fabrica.js; busca y arma el plan
  const dctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, reducedMotion: 'reduce' });
  const dp = await dctx.newPage(); dp.on('pageerror', e => informe.errores.push('demo: ' + e.message));
  await dp.goto('file:///' + path.join(ROOT, 'dist', 'command-centre-v2.html').replace(/\\/g, '/')); await dp.waitForTimeout(1500);
  await dp.keyboard.press('e'); await dp.waitForSelector(`${S}.on`); await dp.click(`${S} [data-kind="image"]`);
  await dp.keyboard.press('b'); await dp.waitForSelector(`${S} .st-bank:not([hidden]) .bk-qi`); await dp.fill(`${S} .bk-qi`, 'fondo blanco'); await dp.waitForTimeout(300);
  const nDemo = await dp.$$eval(`${S} .bk-card`, l => l.length);
  ok('Demo file://: el banco busca con la fábrica junto a la página', nDemo > 3, `${nDemo} tarjetas`);
  await dp.fill(`${S} .bk-qi`, 'se ve oscura'); await dp.waitForTimeout(200);
  await dp.click(`${S} .bk-card[data-pid="luz-mas-clara"]`); await dp.keyboard.press('Escape'); await dp.waitForTimeout(500);
  const qd = (await dp.textContent(`${S} .bk-que`)).replace(/\s+/g, ' ');
  ok('Demo file://: «Qué hará» se arma sin servidor (y pide la foto)', /foto/i.test(qd), qd.slice(0, 160));
  await dp.screenshot({ path: path.join(OUT, 'demo-file.png') });
  await dctx.close();

  /* ---------- capturas: 390 · 1024 · 1512, claro y oscuro ---------- */
  for (const tema of ['light', 'dark']) for (const [w, h] of [[390, 844], [1024, 768], [1512, 900]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, reducedMotion: 'reduce' });
    const p = await c.newPage(); p.on('pageerror', e => informe.errores.push(`${w} ${tema}: ${e.message}`));
    await abrirEstudio(p, w, tema);
    await p.click(`${S} [data-puerta="foto"]`); await elegirDeGaleria(p, 'cama-bodega');
    if (w < 700) await p.click(`${S} [data-pt="gen"]`).catch(() => {});
    await p.click(`${S} .bk-open`); await p.fill(`${S} .bk-qi`, 'fondo blanco'); await p.waitForTimeout(200);
    const medir = () => p.evaluate(s => {
      const root = document.querySelector(s); const vis = [...root.querySelectorAll('.bk button, .bk select, .bk input, .st-bank button, .st-bank input')].filter(x => x.offsetParent && x.getBoundingClientRect().width);
      const chicos = vis.filter(x => { const r = x.getBoundingClientRect(); return r.height < 23.5 && !x.closest('.e3d'); }).map(x => (x.textContent || x.getAttribute('aria-label') || x.className).trim().slice(0, 30));
      const letras = [...root.querySelectorAll('.bk *, .st-bank *')].filter(x => x.offsetParent && x.childNodes.length && [...x.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(x => parseFloat(getComputedStyle(x).fontSize)).filter(Boolean);
      return { scrollX: document.documentElement.scrollWidth > innerWidth + 1, chicos: [...new Set(chicos)].slice(0, 8), letraMin: Math.min(...letras) };
    }, S);
    await p.click(`${S} .bk-card[data-pid="fondo-blanco"]`); await p.waitForTimeout(150);
    const m1 = await medir();
    await p.screenshot({ path: path.join(OUT, `banco-${w}-${tema}.png`) });
    await p.keyboard.press('Escape');
    if (w < 700) await p.click(`${S} [data-pt="gen"]`).catch(() => {});
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, `compositor-${w}-${tema}.png`), fullPage: false });
    await p.click(`${S} [data-escena="abrir"]`); await p.waitForSelector(`${S} .st-bank .e3d`); await p.waitForTimeout(500);
    const m2 = await medir();
    await p.screenshot({ path: path.join(OUT, `escenario-${w}-${tema}.png`) });
    informe.capturas.push({ ancho: w, tema, banco: m1, escenario: m2 });
    console.log(`  ${w} ${tema}: scroll horizontal ${m1.scrollX || m2.scrollX ? 'SÍ' : 'no'} · letra mínima ${Math.min(m1.letraMin, m2.letraMin)} px · objetivos < 24 px: ${[...m1.chicos, ...m2.chicos].join(', ') || 'ninguno'}`);
    await c.close();
  }
} catch (e) { informe.errores.push('recorrido: ' + (e.stack || e.message)); console.error(e); }
finally {
  await browser.close(); srv.kill(); g.close();
  fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(informe, null, 2));
  const mal = informe.pasos.filter(p => !p.ok).length;
  console.log(`\n${informe.pasos.length - mal} de ${informe.pasos.length} pasos bien · ${informe.errores.length} errores de página · ${OUT}`);
  if (informe.errores.length) console.log(informe.errores.slice(0, 8).join('\n'));
  process.exitCode = mal || informe.errores.length ? 1 : 0;
}
