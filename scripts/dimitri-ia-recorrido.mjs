// UX-11: el ⓘ de Dimitri a 390 / 1024 / 1512 px, en claro y en oscuro: ya no hay línea de IA; el ⓘ abre un popover (escritorio) o una hoja (teléfono) con modelo,
// consultas y gasto; con una alerta real lleva su punto y la dice una vez en el hilo; accesible por teclado (Escape lo cierra y el foco vuelve al ⓘ).
// Oficina temporal sin keys; `ia` se inyecta en GET /api/sub (la oficina local no la informa). Uso: node scripts/dimitri-ia-recorrido.mjs [--capturas]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CAP = process.argv.includes('--capturas'), OUT = path.join(ROOT, 'data', 'capturas', 'dimitri-ia'); if (CAP) fs.mkdirSync(OUT, { recursive: true });
const probe = http.createServer(), port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-ia-')), brain = path.join(dir, 'brain'); fs.mkdirSync(brain, { recursive: true });
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: 'no-real', CLAUDE_BIN: path.join(dir, 'no-claude') };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const IA = { id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5', herramientas: true, consultas: true, gasto: { usd: 61.2, tope: 50, nivel: 'over' } };
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
try {
  const TAM = [[390, 844, 'light'], [390, 844, 'dark'], [1024, 768, 'light'], [1512, 900, 'light'], [1512, 900, 'dark']].filter(([w]) => !process.env.AO_W || String(w) === process.env.AO_W);
  for (const [w, h, tema] of TAM) {
    const tag = `${w}-${tema}`, movil = w < 500;
    for (const con of [true, false]) { // con una alerta (gasto pasado del tope) y sin ella
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil }); await ctx.addInitScript(() => { try { localStorage.removeItem('ao.sub.ia.dicho'); } catch {} });
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.route('**/api/sub', async r => { if (r.request().method() !== 'GET') return r.continue(); const j = await (await r.fetch()).json(); await r.fulfill({ json: { ...j, ia: { ...IA, gasto: con ? IA.gasto : { usd: 12.5, tope: 50, nivel: 'ok' } } } }); });
      await page.goto(base + '/' + (movil ? '#dimitri' : '')); await page.waitForTimeout(1500);
      await page.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); }, tema);
      const t = `${tag} ${con ? 'con alerta' : 'sin alerta'}`;
      if (movil) {
        await page.click('.mv-tab[data-tab="dimitri"]'); await page.waitForSelector('[data-vista="dimitri"] .mv-hilo'); await page.waitForTimeout(800);
        const b = page.locator('#mvAcc button[aria-label^="Con qué IA corre"]'); step(await b.count() === 1, `${t}: el ⓘ está en la cabecera`);
        step(!(await page.locator('.mv-ia').count()), `${t}: ya no hay línea de IA en el saludo`);
        const bb = await b.boundingBox(); step(bb && bb.width >= 44 && bb.height >= 44, `${t}: el ⓘ mide 44 px`);
        step((await page.locator('.mv-ic-punto').count() === 1) === con, `${t}: el punto ${con ? 'está' : 'no está'}`);
        step((await page.locator('.mv-ia-aviso').count() === 1) === con, `${t}: el aviso ${con ? 'sale una vez en el hilo' : 'no sale'}`);
        await b.click(); await page.waitForTimeout(500);
        const txt = await page.evaluate(() => document.body.innerText);
        step(/Claude Sonnet 5\.5/.test(txt) && /Gasto de IA del mes/.test(txt), `${t}: la hoja dice modelo y gasto`);
        if (CAP) await page.screenshot({ path: path.join(OUT, `${tag}-${con ? 'alerta' : 'normal'}.png`) });
        await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      } else {
        await page.keyboard.press('s'); await page.waitForSelector('#subOv:not([hidden])'); await page.waitForTimeout(600);
        step(!(await page.locator('#subOv .sb-ia-head').count()), `${t}: ya no hay línea de IA en la cabecera`);
        const b = page.locator('#subOv .sb-iab'); const bb = await b.boundingBox(); step(bb && bb.width >= 24 && bb.height >= 24, `${t}: el ⓘ mide 24 px o más`);
        step(await b.getAttribute('aria-expanded') === 'false', `${t}: cerrado al empezar`);
        step((await page.locator('#subOv .sb-ia-dot:not([hidden])').count() === 1) === con, `${t}: el punto ${con ? 'está' : 'no está'}`);
        step((await page.locator('#subOv .sb-msgs .sb-ia-aviso').count() === 1) === con, `${t}: el aviso ${con ? 'se dice en el hilo' : 'no se dice'}`);
        await b.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
        step(await b.getAttribute('aria-expanded') === 'true', `${t}: Enter lo abre`);
        step(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'sbIaPop', `${t}: el foco pasa al popover`);
        const pop = await page.locator('#sbIaPop').innerText(); step(/Claude Sonnet 5\.5/.test(pop) && /Gasto de IA del mes/.test(pop) && /consulta la oficina/.test(pop), `${t}: dice modelo, consultas y gasto`);
        const r = await page.evaluate(() => { const p = document.querySelector('#sbIaPop').getBoundingClientRect(), s = document.querySelector('#subOv').getBoundingClientRect(); return p.left >= s.left - 1 && p.right <= s.right + 1; }); step(r, `${t}: el popover cabe dentro del panel`);
        if (CAP) await page.screenshot({ path: path.join(OUT, `${tag}-${con ? 'alerta' : 'normal'}.png`) });
        await page.keyboard.press('Escape'); await page.waitForTimeout(250);
        step(await b.getAttribute('aria-expanded') === 'false' && await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('sb-iab')), `${t}: Escape lo cierra y el foco vuelve al ⓘ`);
        step(await page.locator('#subOv:not([hidden])').count() === 1, `${t}: y Dimitri sigue abierto`);
        await b.click(); await page.waitForTimeout(150); await page.mouse.click(w - 5, h - 5); await page.waitForTimeout(150);
        step(await b.getAttribute('aria-expanded') === 'false', `${t}: un clic fuera lo cierra`);
      }
      step(errs.length === 0, `${t}: sin errores de la página${errs.length ? ' · ' + errs[0] : ''}`);
      await ctx.close();
    }
  }
} finally { await browser.close(); srv.kill(); }
console.log(fails ? `\n${fails} fallo(s)` : '\nTodo en orden'); process.exit(fails ? 1 : 0);
