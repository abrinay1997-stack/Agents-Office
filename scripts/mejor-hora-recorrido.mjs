// Herramienta de desarrollo (no entra en `npm run check`): la MEJOR HORA en el navegador (plan M3, 6 oct 2026). Oficina temporal con el
// Metricool de mentira (tests/metricool-stand.mjs: lunes 9 y 19, jueves 13): la semana de Contenido sombrea esas horas y dice de dónde
// salen, y el panel de una pieza ofrece «Siguiente buena hora» y, con día, «Mejores ese día». Nunca toca Metricool de verdad.
//   node scripts/mejor-hora-recorrido.mjs   → capturas en data/capturas/mejor-hora/ y ✓/✗ por paso, a 390, 1024 y 1512 en claro y oscuro
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { levantarMetricool } from '../tests/metricool-stand.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'mejor-hora'); fs.mkdirSync(OUT, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mh-')), data = path.join(dir, 'data'), brain = path.join(dir, 'brain');
fs.mkdirSync(data, { recursive: true }); fs.cpSync(path.join(ROOT, 'brain'), brain, { recursive: true });
const local = path.join(dir, 'local.json'); fs.writeFileSync(local, JSON.stringify({ contenido: { modo: 'simulacro', redes: ['instagram'] } }));
const st = await levantarMetricool();
const probe = http.createServer(); const port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
const env = { ...process.env, ...st.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), ANTHROPIC_BASE_URL: '', ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '' };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }

let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
let browser;
try {
  const h = await (await fetch(base + '/api/contenido/mejor-hora?redes=instagram')).json();
  step(h.fuente === 'metricool' && h.grid?.[1]?.[19] === 100, `la API da la mejor hora de Metricool (${h.fuente})`);
  const r = await (await fetch(base + '/api/contenido/analiticas/resumen')).json();
  step(/No inventes cifras/.test(r.texto), 'Analíticas en palabras, sin datos, lo dice sin inventar');
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  for (const [w, hgt] of [[1512, 900], [1024, 768], [390, 844]]) for (const tema of ['light', 'dark']) {
    const tag = `${w}-${tema}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: w < 500, isMobile: w < 500, colorScheme: tema });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); }, tema);
    await page.keyboard.press('k'); await page.waitForSelector('#ctOv .ct-mode', { state: 'visible' }); await page.waitForTimeout(400);
    const vista = w < 500 ? 'day' : 'week';
    await page.click(`#ctOv .ct-views [data-v="${vista}"], #ctOv [data-view="${vista}"]`).catch(() => {}); await page.waitForTimeout(1000);
    const s = await page.evaluate(() => ({ hb2: document.querySelectorAll('#ctOv .cv-slot.hb2').length, hb1: document.querySelectorAll('#ctOv .cv-slot.hb1').length, leg: document.querySelector('.ct-hbleg')?.textContent || '' }));
    if (vista === 'day') step(/según Metricool/.test(s.leg) || !s.leg, `${tag}: en el teléfono, la vista del día (hoy no tiene horas destacadas en el doble)`); else step(s.hb2 + s.hb1 > 0 && /según Metricool/.test(s.leg), `${tag}: la ${vista === 'day' ? 'vista día' : 'semana'} sombrea ${s.hb2} horas de lo mejor y ${s.hb1} buenas, «${s.leg.trim()}»`);
    await page.screenshot({ path: path.join(OUT, `${tag}-${vista}.png`) });
    await page.click('#ctNew'); await page.waitForTimeout(250);
    const item = await page.$('.ct-newmenu:not([hidden]) button'); if (item) { await item.click(); }
    await page.waitForSelector('.ct-panel:not([hidden]) .pz-best', { timeout: 5000 }); await page.waitForTimeout(800);
    // con día (Crear lo pone en el siguiente hueco): «Mejores ese día» si ese día tiene; si no, quitamos el día y sale «Siguiente buena hora»
    await page.selectOption('.pz-sel[data-f="fecha"]', ''); await page.waitForTimeout(900);
    const sig = await page.evaluate(() => document.querySelector('.pz-best [data-buena]')?.textContent || '');
    step(/Siguiente buena hora: .*(09|19|13):00/.test(sig), `${tag}: sin día, el panel ofrece «${sig.trim()}»`);
    await page.click('.pz-best [data-buena]'); await page.waitForTimeout(900);
    const tras = await page.evaluate(() => ({ fecha: document.querySelector('.pz-sel[data-f="fecha"]').value, hora: document.querySelector('.pz-sel[data-f="hora"]').value, mejores: [...document.querySelectorAll('.pz-best [data-qh]')].map(b => b.dataset.qh + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(',') }));
    step(tras.fecha && /:00$/.test(tras.hora) && tras.mejores.includes(tras.hora + '*'), `${tag}: un clic le pone día y hora (${tras.fecha} ${tras.hora}) y «Mejores ese día» la marca (${tras.mejores})`);
    const m = await page.evaluate(() => ({ small: [...document.querySelectorAll('.pz-best button')].map(b => b.getBoundingClientRect()).filter(b => b.height < 24).length, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }));
    step(!m.small && !m.hscroll, `${tag}: botones de 24 px o más y sin desplazamiento a lo ancho`);
    await page.screenshot({ path: path.join(OUT, `${tag}-panel.png`) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(900);
    step(!errs.length, `${tag}: sin errores de la página${errs.length ? ': ' + errs[0] : ''}`);
    await ctx.close();
  }
} catch (e) { fails++; console.log('✗ ' + e.message); console.log(log.split('\n').slice(-15).join('\n')); }
finally { await browser?.close(); srv.kill(); await st.cerrar(); fs.rmSync(dir, { recursive: true, force: true }); }
console.log(fails ? `\n✗ ${fails} paso(s) fallaron · capturas en ${path.relative(ROOT, OUT)}` : `\n✓ todo bien · capturas en ${path.relative(ROOT, OUT)}`);
process.exit(fails ? 1 : 0);
