// Herramienta de desarrollo (no entra en `npm run check`): la CARGA BAJO DEMANDA del Estudio en el navegador (1 oct 2026, INF-09).
// dist/estudio-extra.js (el banco, el escenario 3D y los lotes) va junto a la página y llega la primera vez que hace falta.
// Con una oficina de prueba en una carpeta temporal (sin keys) y con la página abierta como archivo (file://), a 1512 y 390 px:
//   1. la oficina sola no lo pide; abrir el Estudio lo pide UNA vez; el banco, el escenario 3D y los lotes funcionan con él;
//   2. si llega tarde, «Banco» enseña la hoja con «Cargando el banco de presets…» y después el banco de verdad;
//   3. si no llega, el paso dice por qué y «Reintentar» lo trae (servido: la petición se corta; file://: el archivo no está);
//   4. ningún error en la consola (salvo el 404/abortado que el paso 3 provoca a propósito).
//   node scripts/carga-recorrido.mjs   → data/capturas/presets/carga/ (capturas + informe.json)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'presets', 'carga');
fs.mkdirSync(OUT, { recursive: true });
const informe = { pasos: [], capturas: [], errores: [] };
const ok = (paso, cond, detalle) => { informe.pasos.push({ paso, ok: !!cond, detalle }); console.log(`${cond ? '✓' : '✗'} ${paso}${detalle ? ' — ' + (typeof detalle === 'string' ? detalle : JSON.stringify(detalle)) : ''}`); };
if (!fs.existsSync(path.join(ROOT, 'dist', 'estudio-extra.js'))) throw new Error('falta dist/estudio-extra.js: node build.mjs');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-carga-'));
const brain = path.join(sandbox, 'brain'); fs.mkdirSync(path.join(brain, 'Agents Office', 'media'), { recursive: true }); fs.writeFileSync(path.join(brain, 'index.md'), '# Prueba\n');
const SIN = ['HF_KEY', 'HF_API_KEY', 'HF_API_SECRET', 'FAL_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'MINIMAX_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'VOYAGE_API_KEY', 'TELEGRAM_BOT_TOKEN', 'META_ACCESS_TOKEN'];
const port = 4900 + Math.floor(Math.random() * 90);
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(sandbox, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(sandbox, 'local.json') };
for (const k of SIN) env[k] = '';
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://localhost:${port}`;
let up = false; for (let i = 0; i < 80 && !up; i++) { try { up = (await fetch(base + '/api/health')).ok; } catch {} if (!up) await new Promise(r => setTimeout(r, 250)); }
if (!up) { srv.kill(); throw new Error('la oficina de prueba no arrancó: ' + log.slice(-600)); }

// la página como archivo, en una carpeta propia: con su paquete al lado, y otra sin él (para el fallo en file://)
const conExtra = path.join(sandbox, 'demo'), sinExtra = path.join(sandbox, 'demo-sin');
for (const d of [conExtra, sinExtra]) { fs.mkdirSync(d); fs.copyFileSync(path.join(ROOT, 'dist', 'command-centre-v2.html'), path.join(d, 'index.html')); fs.copyFileSync(path.join(ROOT, 'dist', 'presets-fabrica.js'), path.join(d, 'presets-fabrica.js')); }
fs.copyFileSync(path.join(ROOT, 'dist', 'estudio-extra.js'), path.join(conExtra, 'estudio-extra.js'));
const URLS = { servido: base + '/', file: pathToFileURL(path.join(conExtra, 'index.html')).href };

const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let browser; try { browser = await chromium.launch({ executablePath: process.env.AO_CHROME || undefined, args: ARGS }); } catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }
const S = '#studioOv';
const vigilar = (page, donde, permitido = null) => {
  page.on('pageerror', e => informe.errores.push(`${donde}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text() + (m.location()?.url || '')) && !(permitido && permitido.test(m.text()))) informe.errores.push(`${donde}: ${m.text()} ${m.location()?.url || ''}`); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) informe.errores.push(`${donde}: ${r.status()} ${r.url()}`); });
};
const contar = page => { const n = { v: 0 }; page.on('request', r => { if (/estudio-extra\.js/.test(r.url())) n.v++; }); return n; };
async function abrirEstudio(page) { await page.keyboard.press('e'); await page.waitForSelector(`${S}.on`); await page.waitForTimeout(300); if (await page.isVisible(`${S} [data-kind="image"]`)) await page.click(`${S} [data-kind="image"]`); }
async function medir(page) {
  return page.evaluate(() => {
    const scroll = document.documentElement.scrollWidth > innerWidth + 1;
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const st = document.querySelector('#studioOv'), chicos = [...st.querySelectorAll('button, [role="tab"], summary, input:not([type="hidden"]):not([type="file"]), select')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.width < 24 || r.height < 24; }).map(e => (e.getAttribute('aria-label') || e.textContent || e.className).trim().slice(0, 30));
    const letras = [...st.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => parseFloat(getComputedStyle(e).fontSize));
    return { scroll, chicos: chicos.slice(0, 6), min: letras.length ? Math.min(...letras) : null };
  });
}
async function captura(page, nombre) { const f = path.join(OUT, nombre + '.png'); await page.screenshot({ path: f }); const m = await medir(page); informe.capturas.push({ nombre, ...m }); console.log(`  ${nombre}: scroll horizontal ${m.scroll ? 'SÍ' : 'no'} · letra mínima ${m.min} px · objetivos < 24 px: ${m.chicos.join(', ') || 'ninguno'}`); }

try {
  for (const [modo, url] of Object.entries(URLS)) {
    for (const w of [1512, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 }, reducedMotion: 'reduce', hasTouch: w < 500 });
      const page = await ctx.newPage(); vigilar(page, `${modo} ${w}`); const n = contar(page);
      await page.goto(url); await page.waitForTimeout(1500);
      ok(`${modo} ${w}: la oficina sola no pide el paquete aparte`, n.v === 0 && !(await page.evaluate(() => !!window.AO_ESTUDIO_EXTRA)), `${n.v} peticiones`);
      await abrirEstudio(page);
      await page.waitForSelector(`${S} [data-puerta="foto"]`, { timeout: 15000 });
      ok(`${modo} ${w}: al abrir el Estudio llega el banco de verdad (sus puertas)`, true);
      ok(`${modo} ${w}: una sola petición`, n.v === 1, `${n.v}`);
      ok(`${modo} ${w}: three.js compartido (window.AO_THREE) y el paquete es de esta construcción`, await page.evaluate(() => !!window.AO_THREE?.WebGLRenderer && !!window.AO_ESTUDIO_EXTRA?.version));
      ok(`${modo} ${w}: el estilo de los lotes y del escenario llegó una vez`, await page.evaluate(() => document.querySelectorAll('style[data-ao-extra]').length === 1));
      await captura(page, `${modo}-${w}-1-compositor`);
      // el banco
      await page.keyboard.press('b'); await page.waitForSelector(`${S} .st-bank:not([hidden]) .bk-qi`, { timeout: 10000 });
      await page.fill(`${S} .bk-qi`, 'fondo blanco'); await page.waitForTimeout(400);
      const tarjetas = await page.$$eval(`${S} .bk-card`, l => l.length);
      ok(`${modo} ${w}: el banco busca`, tarjetas > 0, `${tarjetas} tarjetas`);
      await captura(page, `${modo}-${w}-2-banco`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      // el escenario 3D
      if (w < 500) await page.click(`${S} [data-pt="gen"]`).catch(() => {});
      await page.click(`${S} [data-escena="abrir"]`); await page.waitForSelector(`${S} .st-bank:not([hidden]) .e3d`, { timeout: 10000 }); await page.waitForTimeout(800);
      const lienzo = await page.$$eval(`${S} .e3d canvas`, l => l.filter(c => c.width > 0).length);
      ok(`${modo} ${w}: el escenario 3D dibuja con el three.js de la página`, lienzo > 0, `${lienzo} lienzo(s)`);
      await captura(page, `${modo}-${w}-3-escenario`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      // los lotes
      await page.click(`${S} [data-pt="lotes"]`); await page.waitForSelector(`${S} .st-lotes .lt:not(.lt-dif) [data-nuevo]`, { timeout: 10000 });
      ok(`${modo} ${w}: los lotes de verdad (sin la tarjeta provisional)`, !(await page.$(`${S} .lt-dif`)));
      await page.click(`${S} [data-nuevo]`); await page.waitForTimeout(400);
      await captura(page, `${modo}-${w}-4-lotes`);
      ok(`${modo} ${w}: sigue siendo una sola petición`, n.v === 1, `${n.v}`);
      await ctx.close();
    }
  }

  /* llega tarde: «Banco» antes de que llegue enseña la hoja con «Cargando…» y después el banco */
  {
    const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage(); vigilar(page, 'tarde');
    await page.route('**/estudio-extra.js*', async r => { await new Promise(x => setTimeout(x, 2500)); await r.continue(); });
    await page.goto(base + '/'); await page.waitForTimeout(1200); await abrirEstudio(page);
    const paso = await page.textContent(`${S} .bk-dif .exc`).catch(() => '');
    ok('tarde: el paso del compositor dice «Cargando…» (role=status)', /Cargando/.test(paso || '') && !!(await page.$(`${S} .bk-dif .exc[role="status"]`)), paso);
    await page.click(`${S} .bk-dif [data-ir="banco"]`); await page.waitForTimeout(150);
    const hoja = await page.textContent(`${S} .st-bank.bk-dif`).catch(() => '');
    ok('tarde: «Banco» abre la hoja con «Cargando el banco de presets…»', /Cargando el banco de presets/.test(hoja || ''), (hoja || '').replace(/\s+/g, ' ').trim());
    await captura(page, 'tarde-1512-cargando');
    await page.waitForSelector(`${S} .st-bank:not([hidden]):not(.bk-dif) .bk-qi`, { timeout: 15000 });
    ok('tarde: al llegar, el banco de verdad ocupa la hoja y queda abierto', true);
    await ctx.close();
  }

  /* no llega (servido): el motivo y «Reintentar» */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
    const page = await ctx.newPage(); vigilar(page, 'falla servido', /ERR_FAILED|net::|Failed to load resource/);
    let cortar = true; await page.route('**/estudio-extra.js*', r => (cortar ? r.abort() : r.continue()));
    await page.goto(base + '/'); await page.waitForTimeout(1200); await abrirEstudio(page);
    await page.waitForSelector(`${S} .bk-dif .exc-mal:not([hidden])`, { timeout: 10000 });
    const txt = (await page.textContent(`${S} .bk-dif .exc-mal`)).replace(/\s+/g, ' ').trim();
    ok('falla servido: el paso dice por qué (role=alert) y ofrece «Reintentar»', /oficina/.test(txt) && /Reintentar/.test(txt) && !!(await page.$(`${S} .bk-dif .exc-mal [role="alert"]`)), txt);
    await captura(page, 'falla-servido-390');
    cortar = false; await page.click(`${S} .bk-dif .exc-re`);
    await page.waitForSelector(`${S} [data-puerta="foto"]`, { timeout: 10000 });
    ok('falla servido: «Reintentar» lo trae y el banco aparece', true);
    await ctx.close();
  }

  /* no llega (file://): el archivo no está junto a la página; se pone y «Reintentar» */
  {
    const ctx = await browser.newContext({ viewport: { width: 1512, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage(); vigilar(page, 'falla file', /ERR_FILE_NOT_FOUND|Failed to load resource/);
    await page.goto(pathToFileURL(path.join(sinExtra, 'index.html')).href); await page.waitForTimeout(1200); await abrirEstudio(page);
    await page.waitForSelector(`${S} .bk-dif .exc-mal:not([hidden])`, { timeout: 10000 });
    const txt = (await page.textContent(`${S} .bk-dif .exc-mal`)).replace(/\s+/g, ' ').trim();
    ok('falla file://: dice que falta estudio-extra.js junto a la página y cómo construirlo', /estudio-extra\.js/.test(txt) && /node build\.mjs/.test(txt), txt);
    await page.click(`${S} [data-pt="lotes"]`).catch(() => {}); await page.waitForTimeout(400);
    const lt = (await page.textContent(`${S} .lt-dif`).catch(() => '') || '').replace(/\s+/g, ' ').trim();
    ok('falla file://: la pestaña Lotes también lo dice, con «Reintentar»', /estudio-extra\.js/.test(lt) && /Reintentar/.test(lt), lt.slice(0, 160));
    await captura(page, 'falla-file-1512-lotes');
    fs.copyFileSync(path.join(ROOT, 'dist', 'estudio-extra.js'), path.join(sinExtra, 'estudio-extra.js'));
    await page.click(`${S} .lt-dif .exc-re`);
    await page.waitForSelector(`${S} .st-lotes .lt:not(.lt-dif) [data-nuevo]`, { timeout: 10000 });
    ok('falla file://: con el archivo en su sitio, «Reintentar» trae los lotes (y el banco con ellos)', !!(await page.$(`${S} .bk:not(.bk-dif)`)));
    await ctx.close();
  }
} catch (e) { informe.errores.push('recorrido: ' + (e.stack || e.message)); console.error(e); }
finally {
  await browser.close(); srv.kill();
  fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify(informe, null, 2));
  try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch {}
  const bien = informe.pasos.filter(p => p.ok).length;
  console.log(`\n${bien} de ${informe.pasos.length} pasos bien · ${informe.errores.length} errores de consola o de página · ${OUT}`);
  for (const e of informe.errores) console.log('  ! ' + e.slice(0, 300));
  process.exitCode = bien === informe.pasos.length && !informe.errores.length ? 0 : 1;
}
