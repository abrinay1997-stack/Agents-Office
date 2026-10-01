// Herramienta de desarrollo (no entra en `npm run check`): la pestaña LOTES del Estudio en el navegador, de punta a punta
// (banco de presets F2, integración). Levanta su propia oficina en una carpeta temporal, sin keys, y con un preset local (gratis):
//   1. el recorrido del dueño a 1512 px: Estudio → L → Nuevo lote → un Excel de 12 fotos incrustadas → «Más clara» → el plan →
//      PROBAR CON 3 → «Seguir con las 9» → Pausar → Reanudar → la oficina se cae y vuelve a mitad (retoma sin duplicar) →
//      Terminado → «Otra versión» de una foto → «Aprobar las listas» → Descargar todo (ZIP);
//   2. capturas de la lista, los 3 pasos y el seguimiento a 390, 1024 y 1512 px, en claro y en oscuro, midiendo lo que la casa
//      pide: sin scroll horizontal, objetivos de 24 px o más, ningún texto bajo 10,5 px y ningún error en la consola.
//   node scripts/lotes-capturas.mjs   → data/capturas/presets/integracion-f2/ (+ informe.json)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'presets', 'integracion-f2');
const espera = ms => new Promise(r => setTimeout(r, ms));
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-lotes-ui-'));
const brain = path.join(sandbox, 'brain'); fs.mkdirSync(brain, { recursive: true }); fs.writeFileSync(path.join(brain, 'index.md'), '# Prueba\n');
fs.mkdirSync(OUT, { recursive: true });

// el Excel: 12 camas de la bodega, con su SKU, nombre y medidas
const XLSX = path.join(sandbox, 'camas-bodega.xlsx');
{
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Camas');
  ws.addRow(['Foto', 'SKU', 'Producto', 'Medidas']);
  for (let i = 0; i < 12; i++) {
    const cama = await sharp({ create: { width: 220 + i * 6, height: 90, channels: 3, background: { r: 120 + i * 6, g: 84, b: 52 } } }).png().toBuffer();
    const img = await sharp({ create: { width: 480, height: 360, channels: 3, background: { r: 96 + i * 3, g: 92, b: 86 } } }).composite([{ input: cama, left: 90, top: 170 }]).jpeg().toBuffer();
    ws.addRow(['', `CM-${140 + i}`, `Cama ${['Roma', 'Milán', 'Lisboa', 'Oslo'][i % 4]} ${140 + i}`, `${140 + i} x 45 x 200`]);
    ws.addImage(wb.addImage({ buffer: img, extension: 'jpeg' }), { tl: { col: 0, row: i + 1 }, ext: { width: 48, height: 36 } });
  }
  fs.writeFileSync(XLSX, Buffer.from(await wb.xlsx.writeBuffer()));
}

const port = 4900 + Math.floor(Math.random() * 90), base = `http://localhost:${port}`;
let srv = null, log = '';
async function arrancar() {
  srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), AO_DATA: path.join(sandbox, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(sandbox, 'local.json'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', HF_API_SECRET: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' } /* sin keys: nada puede gastar */, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await espera(250); }
  throw new Error('la oficina de prueba no arrancó: ' + log.slice(-400));
}
const caer = () => new Promise(r => { srv.once('exit', r); srv.kill(); });
await arrancar();

const informe = [], pasos = [];
const ok = (cond, que) => { pasos.push({ ok: !!cond, que }); console.log(`${cond ? '✓' : '✗'} ${que}`); };
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let browser;
try { browser = await chromium.launch({ executablePath: process.env.AO_CHROME || undefined, args: ARGS }); }
catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }

async function pagina(w, h, tema) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, reducedMotion: 'reduce', acceptDownloads: true });
  await ctx.addInitScript(t => { try { localStorage.setItem('ao.theme', JSON.stringify(t)); localStorage.setItem('ao.theme.raw', t); } catch {} }, tema);
  const page = await ctx.newPage(), errores = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|net::/.test(m.text())) errores.push(m.text()); });
  page.on('pageerror', e => errores.push(e.message));
  await page.goto(base + '/'); await page.waitForTimeout(1500);
  await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; }, tema);
  await page.keyboard.press('e'); await page.waitForSelector('#studioOv.on'); await page.waitForTimeout(400);
  await page.locator('#studioOv').press('l'); await page.waitForSelector('#studioOv .st-lotes:not([hidden]) .lt h2');
  return { ctx, page, errores };
}
const L = '#studioOv .st-lotes';
/** Lo que la casa pide de una pantalla (CLAUDE.md, reglas de la interfaz), medido dentro de la pestaña Lotes. */
async function medir(page) {
  return page.evaluate(sel => {
    const root = document.querySelector(sel), vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const chicos = [...root.querySelectorAll('button, a[href], select, input:not([type=hidden]):not([type=radio]):not([type=checkbox]), summary')].filter(vis)
      .filter(e => { const r = e.getBoundingClientRect(); return r.height < 23.5 || r.width < 23.5; }).map(e => `${e.tagName.toLowerCase()}«${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}» ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`);
    const letra = [...root.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).filter(e => parseFloat(getComputedStyle(e).fontSize) < 10.5).map(e => `${e.tagName.toLowerCase()} ${getComputedStyle(e).fontSize} «${e.textContent.trim().slice(0, 20)}»`);
    const anidados = root.querySelectorAll('button button, a button, button a').length;
    return { scrollX: document.documentElement.scrollWidth > innerWidth + 1 || root.scrollWidth > root.clientWidth + 1, chicos: chicos.slice(0, 8), nChicos: chicos.length, letra: letra.slice(0, 6), anidados };
  }, L);
}
async function captura(page, nombre, tema, w, errores) {
  await page.waitForTimeout(250);
  const m = await medir(page);
  const bien = !m.scrollX && !m.nChicos && !m.letra.length && !m.anidados && !errores.length;
  informe.push({ escena: nombre, tema, ancho: w, ...m, errores: [...errores], bien });
  console.log(`${bien ? '✓' : '✗'} ${nombre.padEnd(16)} ${tema.padEnd(5)} ${String(w).padStart(4)} px${m.scrollX ? ' · SCROLL X' : ''}${m.nChicos ? ` · ${m.nChicos} objetivos chicos: ${m.chicos.join(', ')}` : ''}${m.letra.length ? ` · letra chica: ${m.letra.join(', ')}` : ''}${m.anidados ? ' · botones anidados' : ''}${errores.length ? ' · consola: ' + errores.join(' | ').slice(0, 200) : ''}`);
  await page.screenshot({ path: path.join(OUT, `${nombre}-${tema}-${w}.png`), fullPage: false });
}
const estadoLote = async id => (await (await fetch(`${base}/api/media/lotes/${id}`)).json()).lote;
async function hasta(fn, ms = 40000, que = '') { const fin = Date.now() + ms; while (Date.now() < fin) { const v = await fn().catch(() => null); if (v) return v; await espera(300); } throw new Error('no llegó: ' + que); }

let loteId = null;
try {
  /* ---------- 1. el recorrido del dueño, a 1512 px en claro ---------- */
  {
    const { ctx, page, errores } = await pagina(1512, 900, 'light');
    await page.click(`${L} [data-nuevo]`);
    await page.check(`${L} input[value="hoja"]`);
    await page.setInputFiles(`${L} [data-in="hoja"]`, XLSX);
    await page.waitForSelector(`${L} .lt-cols select`, { timeout: 20000 });
    const cols = await page.$$eval(`${L} .lt-cols select`, s => s.map(x => x.value));
    ok(cols.join(',') === 'foto,sku,nombre,medidas', `las columnas se emparejan solas: ${cols.join(', ')}`);
    await page.click(`${L} [data-sig]`); await page.waitForSelector(`${L} [data-q]`);
    await page.fill(`${L} [data-q]`, 'más clara'); await page.waitForSelector(`${L} [data-add="luz-mas-clara"]`);
    await page.click(`${L} [data-add="luz-mas-clara"]`);
    await page.click(`${L} [data-sig]`); await page.waitForSelector(`${L} [data-lanzar="probar"]:not([disabled])`, { timeout: 30000 });
    const plan = await page.textContent(`${L} .lt-plan`);
    ok(/Fotos\s*12/.test(plan) && /Costo\s*gratis/.test(plan), `el plan dice 12 fotos y «gratis» antes de gastar (${plan.replace(/\s+/g, ' ').slice(0, 120)})`);
    loteId = (await (await fetch(base + '/api/media/lotes')).json()).lotes[0].id;
    ok((await estadoLote(loteId)).estado === 'previsto', 'el lote nace «previsto»: nada enviado');
    await page.click(`${L} [data-lanzar="probar"]`);
    await page.waitForSelector(`${L} [data-ctl="continuar"]`, { timeout: 40000 });
    const lm = await estadoLote(loteId);
    ok(lm.estado === 'pausado' && lm.filas.filter(f => f.out).length === 3, 'PROBAR CON 3 hace 3 y se para a preguntar');
    await captura(page, '4-muestra', 'light', 1512, errores);
    await page.click(`${L} [data-ctl="continuar"]`);
    await page.waitForSelector(`${L} [data-ctl="pausar"]`); await page.click(`${L} [data-ctl="pausar"]`);
    await page.waitForSelector(`${L} [data-ctl="reanudar"]`);
    const lp = await estadoLote(loteId);
    ok(lp.estado === 'pausado' && lp.pausa?.por === 'dueño', `Pausar lo para (motivo: ${lp.motivo})`);
    await captura(page, '5-pausado', 'light', 1512, errores);
    await page.click(`${L} [data-ctl="reanudar"]`);
    await page.waitForSelector(`${L} [data-ctl="pausar"]`);
    // la oficina se cae a mitad y vuelve
    await espera(600); const antes = (await estadoLote(loteId)).filas.filter(f => f.out).length;
    await caer(); await espera(800); await arrancar();
    ok(antes < 12, `la oficina se cae con ${antes} de 12 hechas`);
    const fin = await hasta(async () => { const l = await estadoLote(loteId); return l.estado === 'hecho' && l; }, 90000, 'terminar tras el reinicio');
    const jobs = (await (await fetch(base + '/api/media/jobs')).json()).jobs.filter(j => j.lote?.id === loteId && j.state === 'done');
    const veces = new Map(); for (const j of jobs) veces.set(j.lote.fila, (veces.get(j.lote.fila) || 0) + 1);
    ok([...veces.values()].every(n => n === 1) && fin.filas.every(f => f.estado === 'lista'), `retoma sin duplicar: 12 listas, ${jobs.length} trabajos hechos`);
    const visto = await page.waitForFunction(sel => /Terminado/.test(document.querySelector(sel)?.textContent || ''), `${L} .lt-hd .lt-est`, { timeout: 20000 }).then(() => true, () => false);
    ok(visto, 'la página lo ve terminado sin recargar');
    await captura(page, '6-terminado', 'light', 1512, errores);
    // «Otra versión» de la foto #3 (fila 3 del Excel = n 3)
    const fila = page.locator(`${L} .lt-fila`).nth(1);
    await fila.locator('.lt-menu summary').click(); await fila.locator('[data-acc="otra"]').click();
    await hasta(async () => { const l = await estadoLote(loteId); const f = l.filas[1]; return l.estado === 'hecho' && f.jobs.length === 2 && f.estado === 'lista'; }, 40000, 'otra versión');
    ok(true, 'Otra versión rehace una foto y el lote vuelve a terminar');
    await page.waitForTimeout(3000);
    await page.click(`${L} [data-aprobartodas]`);
    await hasta(async () => (await estadoLote(loteId)).filas.every(f => f.estado === 'aprobada'), 10000, 'aprobar');
    ok(true, '«Aprobar las listas» las aprueba todas');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(`${L} a[href$="/zip"]`)]);
    const zp = path.join(sandbox, 'lote.zip'); await dl.saveAs(zp); const zb = fs.readFileSync(zp);
    ok(zb.subarray(0, 2).toString() === 'PK' && zb.includes(Buffer.from('CM-140_01.')) && zb.includes(Buffer.from('resumen.csv')), `Descargar todo: ${dl.suggestedFilename()} con los nombres por SKU y resumen.csv`);
    ok(!errores.length, `sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
    // «Editar en lote…» desde la galería: 3 seleccionadas → el paso 2 con ellas
    await page.click('#studioOv [data-pt="gen"]'); await page.waitForTimeout(400);
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('#studioOv .st-body')).display !== 'none' && document.querySelector('#studioOv .st-lotes').hidden), 'la pestaña «Crear y galería» vuelve a mostrar el compositor y la galería');
    const re = page.locator('#studioOv .st-grid button', { hasText: 'Reintentar' }); if (await re.count()) await re.first().click(); // la galería que falló mientras la oficina estaba caída
    await page.waitForSelector('#studioOv .st-card .st-thumb', { timeout: 30000 });
    await page.click('#studioOv .st-selbtn'); await page.waitForTimeout(200);
    const cards = page.locator('#studioOv .st-card'); for (let i = 0; i < 3; i++) await cards.nth(i).locator('.st-thumb').click();
    await page.click('#studioOv .st-selbar [data-b="lote"]');
    await page.waitForSelector(`${L} [data-q]`);
    ok(/3 fotos/.test(await page.textContent(`${L} h2`)), '«Editar en lote…» abre Lotes con las 3 seleccionadas, ya en la receta');
    await captura(page, '7-desde-seleccion', 'light', 1512, errores);
    await ctx.close();
  }

  /* ---------- 2. capturas en tres anchos y dos temas ---------- */
  for (const tema of ['light', 'dark']) for (const [w, h] of [[390, 844], [1024, 768], [1512, 900]]) {
    const { ctx, page, errores } = await pagina(w, h, tema);
    await page.waitForSelector(`${L} .lt-item`);
    await captura(page, '1-lista', tema, w, errores);
    await page.click(`${L} [data-ver="${loteId}"]`); await page.waitForSelector(`${L} .lt-fila`);
    await captura(page, '2-seguimiento', tema, w, errores);
    await page.locator(`${L} .lt-fila`).first().locator('.lt-menu summary').click();
    await captura(page, '3-menu-fila', tema, w, errores);
    await page.keyboard.press('Escape');
    await page.click(`${L} [data-volver]`); await page.click(`${L} [data-nuevo]`);
    await page.check(`${L} input[value="hoja"]`); await page.setInputFiles(`${L} [data-in="hoja"]`, XLSX);
    await page.waitForSelector(`${L} .lt-cols select`, { timeout: 20000 });
    await captura(page, 'p1-hoja', tema, w, errores);
    await page.click(`${L} [data-sig]`); await page.waitForSelector(`${L} [data-add]`);
    await page.click(`${L} [data-add]`);
    await captura(page, 'p2-receta', tema, w, errores);
    await page.click(`${L} [data-sig]`); await page.waitForSelector(`${L} [data-lanzar]`, { timeout: 30000 });
    await captura(page, 'p3-plan', tema, w, errores);
    await page.click(`${L} [data-descartar]`);
    await ctx.close();
  }
} finally {
  await browser.close(); srv?.kill(); await espera(300); try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch {}
}
fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify({ pasos, capturas: informe }, null, 1));
const malos = [...pasos.filter(p => !p.ok), ...informe.filter(x => !x.bien)];
console.log(`\n${pasos.filter(p => p.ok).length}/${pasos.length} pasos · ${informe.filter(x => x.bien).length}/${informe.length} capturas sin problemas · ${path.relative(ROOT, OUT)}`);
process.exitCode = malos.length ? 1 : 0;
