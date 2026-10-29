// Fase 3.5 (DIM-03, 29 oct 2026): Calendario, Contenido, Analíticas, Anuncios y Tareas con Dimitri ensanchado (hasta 760 px).
// A 1024, 1366 y 1512 px: la vista abierta no se sale de su caja (sin scroll horizontal propio ni de la página) y ningún control queda
// más allá de su borde derecho. Oficina temporal sin keys. Uso: node scripts/vistas-dimitri-recorrido.mjs [--capturas]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CAP = process.argv.includes('--capturas'), OUT = path.join(ROOT, 'data', 'capturas', 'vistas-dimitri'); if (CAP) fs.mkdirSync(OUT, { recursive: true });
const probe = http.createServer(), port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-vdm-')), brain = path.join(dir, 'brain'); fs.mkdirSync(brain, { recursive: true });
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: 'no-real', CLAUDE_BIN: path.join(dir, 'no-claude') };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const LANZA = process.env.AO_CHROMIUM ? { executablePath: process.env.AO_CHROMIUM } : {}; let browser; try { browser = await chromium.launch(LANZA); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
const VISTAS = [['calOv', 'topCal', 'calOpen', 'Calendario'], ['ctOv', 'topContenido', 'ctOpen', 'Contenido'], ['anOv', 'topAnaliticas', 'anOpen', 'Analíticas'], ['anuOv', 'topAnuncios', 'anuOpen', 'Anuncios'], ['tvOv', 'topTareas', 'tvOpen', 'Tareas']];
try {
  for (const [w, h] of [[1024, 768], [1366, 768], [1512, 900]].filter(([x]) => !process.env.AO_W || String(x) === process.env.AO_W)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => { try { localStorage.setItem('ao.sub.w', '760'); } catch {} });
    const page = await ctx.newPage(); page.setDefaultTimeout(60000); await page.route(u => !u.href.startsWith(base), r => r.abort());
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/'); await page.waitForTimeout(1500);
    await page.keyboard.press('s'); await page.waitForSelector('#subOv.on'); await page.waitForTimeout(400);
    const sw = await page.evaluate(() => Math.round(document.querySelector('#subOv').getBoundingClientRect().width));
    for (const [id, btn, cls, nombre] of VISTAS) {
      const t = `${w}px · Dimitri ${sw}px · ${nombre}`;
      if (!(await page.evaluate(c => document.body.classList.contains(c), cls))) { await page.click('#' + btn); await page.waitForFunction(c => document.body.classList.contains(c), cls); }
      await page.waitForTimeout(900);
      const r = await page.evaluate(i => {
        const ov = document.getElementById(i), b = ov.getBoundingClientRect(), fuera = [];
        for (const e of ov.querySelectorAll('button, input, select, textarea, a, [role="tab"], h1, h2, h3, .cv-title')) {
          const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          const q = e.getBoundingClientRect(); if (!q.width || !q.height) continue;
          let clip = false; for (let n = e.parentElement; n && n !== ov; n = n.parentElement) { const o = getComputedStyle(n); if (/(auto|scroll|hidden|clip)/.test(o.overflowX) && n.scrollWidth > 0) { const nb = n.getBoundingClientRect(); if (q.right > nb.right + 1 || q.left < nb.left - 1) { clip = true; } break; } }
          if (q.right > b.right + 1 && !clip) fuera.push((e.id || e.className || e.tagName).toString().slice(0, 40) + '@' + Math.round(q.right - b.right));
        }
        return { left: Math.round(b.left), ancho: Math.round(b.width), sx: ov.scrollWidth - ov.clientWidth, pag: document.documentElement.scrollWidth - innerWidth, fuera: fuera.slice(0, 6) };
      }, id);
      step(r.left === sw, `${t}: empieza donde acaba Dimitri (${r.left}px, vista ${r.ancho}px)`);
      step(r.sx <= 1 && r.pag <= 0, `${t}: sin scroll horizontal (vista ${r.sx}, página ${r.pag})`);
      step(r.fuera.length === 0, `${t}: ningún control pasa de su borde derecho${r.fuera.length ? ' · ' + r.fuera.join(', ') : ''}`);
      if (CAP) await page.screenshot({ path: path.join(OUT, `${w}-${id}.png`) });
      await page.click('#' + btn); await page.waitForFunction(c => !document.body.classList.contains(c), cls); await page.waitForTimeout(300);
    }
    step(errs.length === 0, `${w}px: sin errores de la página${errs.length ? ' · ' + errs[0] : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); srv.kill(); }
console.log(fails ? `\n${fails} fallo(s)` : '\nTodo en orden'); process.exit(fails ? 1 : 0);
