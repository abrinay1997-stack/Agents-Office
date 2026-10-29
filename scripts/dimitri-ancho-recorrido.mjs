// Fase 3 (29 oct 2026): Dimitri a tu medida — el borde que se arrastra, plegar, ampliar, y el Estudio con Dimitri al lado.
// A 1024, 1366 y 1512 px (y el teléfono a 390): ancho con ratón y teclado, se recuerda, `--subW` = la medida real, las vistas se corren
// con él, sin scroll horizontal, el compositor del Estudio se pliega solo cuando la vista es angosta y vuelve al cerrar a Dimitri.
// Oficina temporal sin keys. Uso: node scripts/dimitri-ancho-recorrido.mjs [--capturas]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CAP = process.argv.includes('--capturas'), OUT = path.join(ROOT, 'data', 'capturas', 'dimitri-ancho'); if (CAP) fs.mkdirSync(OUT, { recursive: true });
const probe = http.createServer(), port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-anc-')), brain = path.join(dir, 'brain'); fs.mkdirSync(brain, { recursive: true });
const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'local.json'), ANTHROPIC_API_KEY: 'no-real', CLAUDE_BIN: path.join(dir, 'no-claude') };
const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
let fails = 0; const step = (ok, what) => { if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${what}`); };
const LANZA = process.env.AO_CHROMIUM ? { executablePath: process.env.AO_CHROMIUM } : {}; let browser; try { browser = await chromium.launch(LANZA); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
const wSub = p => p.evaluate(() => Math.round(document.querySelector('#subOv').getBoundingClientRect().width));
const subW = p => p.evaluate(() => Math.round(parseFloat(getComputedStyle(document.body).getPropertyValue('--subW')) || 0) || Math.round(document.querySelector('#subOv').getBoundingClientRect().width));
const sinScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
try {
  for (const [w, h, tema] of [[1024, 768, 'light'], [1366, 768, 'light'], [1512, 900, 'light'], [1512, 900, 'dark'], [390, 844, 'light']].filter(([x]) => !process.env.AO_W || String(x) === process.env.AO_W)) {
    const t = `${w}-${tema}`, movil = w < 500;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: movil, isMobile: movil });
    const page = await ctx.newPage(); page.setDefaultTimeout(60000); await page.route(u => !u.href.startsWith(base), r => r.abort()); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/' + (movil ? '#dimitri' : '')); await page.waitForTimeout(1500);
    await page.evaluate(x => document.body.classList.toggle('dark', x === 'dark'), tema);
    if (movil) {
      step(await page.evaluate(() => !document.querySelector('.sb-rsz') || getComputedStyle(document.querySelector('.sb-rsz')).display === 'none'), `${t}: el borde no existe en el teléfono`);
      step(await page.evaluate(() => ['.sb-fold', '.sb-max', '.sb-ftab'].every(s => getComputedStyle(document.querySelector(s)).display === 'none')), `${t}: plegar y ampliar no se ofrecen en el teléfono`);
      step(errs.length === 0, `${t}: sin errores de la página`); await ctx.close(); continue;
    }
    await page.keyboard.press('s'); await page.waitForSelector('#subOv.on'); await page.waitForTimeout(500);
    const def = await wSub(page);
    step(def >= 340 && def <= 440, `${t}: el ancho de siempre (${def}px) no cambió`);
    const lim = await page.evaluate(() => ({ max: Number(document.querySelector('.sb-rsz').getAttribute('aria-valuemax')), min: Number(document.querySelector('.sb-rsz').getAttribute('aria-valuemin')) }));
    step(lim.min === 340 && lim.max === Math.max(340, Math.min(760, w - 480)), `${t}: rango ${lim.min}–${lim.max} = 340 – min(760, ventana − 480)`);
    // teclado
    await page.focus('.sb-rsz'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
    step(await wSub(page) === Math.min(lim.max, def + 24), `${t}: → ensancha 24 px (${await wSub(page)})`);
    await page.keyboard.press('End'); await page.waitForTimeout(80); step(await wSub(page) === lim.max, `${t}: Fin = el más ancho (${lim.max})`);
    await page.keyboard.press('Home'); await page.waitForTimeout(80); step(await wSub(page) === 340, `${t}: Inicio = el más angosto (340)`);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    step(await page.evaluate(() => document.querySelector('#subOv') && !document.querySelector('#subOv').hidden), `${t}: las flechas del borde no cierran ni mueven la oficina`);
    // ratón
    const bx = await page.locator('.sb-rsz').boundingBox(); const cx = bx.x + bx.width / 2, cy = bx.y + bx.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 80, cy, { steps: 2 }); await page.mouse.up(); await page.waitForTimeout(100);
    const arr = await wSub(page); step(Math.abs(arr - (388 + 80)) <= 2 || arr === lim.max, `${t}: arrastrar con el ratón ensancha (${arr}px)`);
    step(await page.evaluate(() => localStorage.getItem('ao.sub.w')) === String(arr), `${t}: se recuerda en ao.sub.w`);
    await page.dblclick('.sb-rsz'); await page.waitForTimeout(80); step(await wSub(page) === 340, `${t}: doble clic vuelve al más angosto`);
    await page.focus('.sb-rsz'); await page.keyboard.press('End'); await page.waitForTimeout(80);
    // se recuerda al recargar
    await page.reload(); await page.waitForTimeout(1200); await page.keyboard.press('s'); await page.waitForSelector('#subOv.on'); await page.waitForTimeout(400);
    step(await wSub(page) === lim.max, `${t}: tras recargar vuelve a ${lim.max}`);
    // el evento que lee la oficina 3D
    const ev = await page.evaluate(() => new Promise(r => { addEventListener('ao:sub-ancho', e => r(e.detail), { once: true }); document.querySelector('.sb-fold').click(); }));
    step(ev.plegado === true && ev.w === 44, `${t}: ao:sub-ancho avisa del plegado (w=${ev.w})`);
    await page.waitForTimeout(150);
    step(await wSub(page) === 44 && await page.evaluate(() => document.body.classList.contains('subOpen')), `${t}: plegado = 44 px y sigue abierto (subOpen)`);
    step(await page.evaluate(() => getComputedStyle(document.querySelector('.sb-in')).display === 'none' && getComputedStyle(document.querySelector('.sb-ftab')).display !== 'none'), `${t}: solo se ve la pestaña`);
    await page.keyboard.press('e'); await page.waitForSelector('#studioOv.on, body.studioOpen'); await page.waitForTimeout(700);
    const left = await page.evaluate(() => Math.round(document.querySelector('#studioOv').getBoundingClientRect().left));
    step(left === 44, `${t}: con Dimitri plegado el Estudio empieza en ${left}px`);
    if (CAP) await page.screenshot({ path: path.join(OUT, `${t}-plegado.png`) });
    await page.click('.sb-ftab'); await page.waitForTimeout(200);
    step(await wSub(page) === lim.max, `${t}: la pestaña lo despliega al ancho de antes`);
    step(await page.evaluate(() => document.activeElement && document.activeElement.closest('#subOv') !== null), `${t}: y el foco vuelve dentro de Dimitri`);
    // Estudio con Dimitri al ancho máximo
    await page.waitForTimeout(500);
    const est = await page.evaluate(() => { const o = document.querySelector('#studioOv'), g = document.querySelector('#studioOv .st-gal').getBoundingClientRect(), b = document.querySelector('#studioOv .st-body').getBoundingClientRect(); return { left: Math.round(o.getBoundingClientRect().left), ancho: o.dataset.ancho, plegado: o.classList.contains('st-folded'), gal: Math.round(g.width), body: Math.round(b.width) }; });
    step(est.left === lim.max, `${t}: el Estudio se corre al ancho de Dimitri (${est.left}px)`);
    step(est.gal >= (est.ancho === 'estrecho' ? 200 : 320) , `${t}: la galería mide ${est.gal}px (vista ${est.body}px, nivel ${est.ancho}, compositor ${est.plegado ? 'plegado solo' : 'abierto'})`);
    step(est.ancho === (est.body >= 1200 ? 'ancho' : est.body >= 740 ? 'medio' : 'estrecho') && (est.ancho !== 'estrecho' || est.plegado), `${t}: el nivel de la vista manda (y bajo 740 el compositor se pliega)`);
    step(await sinScroll(page), `${t}: sin scroll horizontal`);
    if (CAP) await page.screenshot({ path: path.join(OUT, `${t}-estudio.png`) });
    // al achicar a Dimitri la vista crece y el compositor vuelve solo
    await page.focus('.sb-rsz'); await page.keyboard.press('Home'); await page.waitForTimeout(500);
    const e2 = await page.evaluate(() => ({ ancho: document.querySelector('#studioOv').dataset.ancho, plegado: document.querySelector('#studioOv').classList.contains('st-folded'), body: Math.round(document.querySelector('#studioOv .st-body').getBoundingClientRect().width) }));
    step(!(e2.body >= 740 && e2.plegado), `${t}: con la vista en ${e2.body}px (${e2.ancho}) el compositor ${e2.plegado ? 'sigue plegado' : 'se abrió solo'}`);
    await page.keyboard.press('Escape');
    // ampliar
    await page.keyboard.press('s'); await page.waitForSelector('#subOv.on'); await page.waitForTimeout(300);
    await page.click('.sb-max'); await page.waitForTimeout(250);
    step(await wSub(page) === w && await page.evaluate(() => document.body.classList.contains('subMax')), `${t}: ampliado cubre toda la ventana`);
    step(await page.evaluate(() => document.querySelector('#subOv').getAttribute('aria-modal') === 'true' && document.querySelector('.sb-max').getAttribute('aria-pressed') === 'true'), `${t}: es una ventana modal y el botón lo dice`);
    step(await sinScroll(page), `${t}: ampliado sin scroll horizontal`);
    if (CAP) await page.screenshot({ path: path.join(OUT, `${t}-ampliado.png`) });
    await page.click('.sb-max'); await page.waitForTimeout(250);
    step(await wSub(page) < w && !(await page.evaluate(() => document.body.classList.contains('subMax'))), `${t}: volver lo deja al lado`);
    await page.click('.sb-max'); await page.waitForTimeout(150);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    step(await page.evaluate(() => !document.body.classList.contains('subOpen') && !document.body.classList.contains('subMax') && !document.body.classList.contains('subFold')), `${t}: Esc cierra a Dimitri y deja todo normal`);
    step(errs.length === 0, `${t}: sin errores de la página${errs.length ? ' · ' + errs[0] : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); srv.kill(); }
console.log(fails ? `\n${fails} fallo(s)` : '\nTodo en orden'); process.exit(fails ? 1 : 0);
