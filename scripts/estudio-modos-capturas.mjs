// Herramienta de desarrollo (no entra en `npm run check`): el interruptor Básico · Avanzado del Estudio (2 oct 2026), en la demo
// file:// (sin servidor), a 390, 1024 y 1512 px, en claro y en oscuro.
//   node scripts/estudio-modos-capturas.mjs   → data/capturas/estudio-modos/
// Comprueba: Básico es el compositor de siempre (sin el paso «Presets» y sin descargar dist/estudio-extra.js); Avanzado enseña el
// banco con el Modelo y el Formato a la vista; el modo se recuerda al recargar; nada se sale del ancho.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'capturas', 'estudio-modos');
fs.mkdirSync(OUT, { recursive: true });
const URL_DEMO = 'file:///' + path.join(ROOT, 'dist', 'command-centre-v2.html').replace(/\\/g, '/');
const S = '#studioOv';
let malos = 0;
const ok = (paso, cond, detalle) => { if (!cond) malos++; console.log(`${cond ? '✓' : '✗'} ${paso}${detalle ? ' — ' + detalle : ''}`); };

const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
let browser; try { browser = await chromium.launch({ executablePath: process.env.AO_CHROME || undefined, args: ARGS }); } catch { browser = await chromium.launch({ channel: 'chrome', args: ARGS }); }
try {
  for (const tema of ['light', 'dark']) for (const [w, h] of [[390, 844], [1024, 768], [1512, 900]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500, reducedMotion: 'reduce' });
    const p = await c.newPage(); const errores = [], extra = [];
    p.on('pageerror', e => errores.push(e.message)); p.on('request', q => { if (/estudio-extra/.test(q.url())) extra.push(q.url()); });
    await p.goto(URL_DEMO); await p.waitForTimeout(1200);
    await p.evaluate(t => { document.body.classList.toggle('dark', t === 'dark'); document.documentElement.dataset.theme = t; }, tema);
    await p.keyboard.press('e'); await p.waitForSelector(`${S}.on`); await p.waitForTimeout(400);
    await p.click(`${S} [data-kind="image"]`); await p.waitForTimeout(300);
    if (w < 700) await p.click(`${S} [data-pt="gen"]`).catch(() => {});
    const basico = await p.evaluate(s => ({ nivel: document.querySelector(s + ' [data-nivel="basico"]')?.getAttribute('aria-pressed'), banco: !!document.querySelector(s + ' .bk')?.offsetParent, modelo: !!document.querySelector(s + ' .st-mpick')?.offsetParent, scrollX: document.documentElement.scrollWidth > innerWidth + 1 }), S);
    ok(`${w} ${tema} · Básico por defecto, sin «Presets», con el modelo`, basico.nivel === 'true' && !basico.banco && basico.modelo && !basico.scrollX, JSON.stringify(basico));
    ok(`${w} ${tema} · Básico no descarga el banco`, extra.length === 0);
    await p.screenshot({ path: path.join(OUT, `basico-${w}-${tema}.png`) });
    await p.click(`${S} [data-nivel="avanzado"]`); await p.waitForSelector(`${S} .bk-doors`, { timeout: 15000 });
    await p.evaluate(s => document.querySelector(s + ' .st-nivel')?.scrollIntoView({ block: 'start' }), S);
    const av = await p.evaluate(s => ({ banco: !!document.querySelector(s + ' .bk-doors')?.offsetParent, modelo: !!document.querySelector(s + ' .st-mpick')?.offsetParent, canal: !!document.querySelector(s + ' .bk-canal'), que: !!document.querySelector(s + ' .bk-que'), scrollX: document.documentElement.scrollWidth > innerWidth + 1, alto: Math.round(document.querySelector(s + ' .st-nivel button').getBoundingClientRect().height) }), S);
    ok(`${w} ${tema} · Avanzado: banco y modelo; sin «Para dónde» ni «Qué hará»`, av.banco && av.modelo && !av.canal && !av.que && !av.scrollX && av.alto >= 24, JSON.stringify(av));
    await p.screenshot({ path: path.join(OUT, `avanzado-${w}-${tema}.png`) });
    await p.reload(); await p.waitForTimeout(1200); await p.keyboard.press('e'); await p.waitForSelector(`${S}.on`); await p.waitForTimeout(400);
    ok(`${w} ${tema} · Avanzado se recuerda al recargar`, await p.getAttribute(`${S} [data-nivel="avanzado"]`, 'aria-pressed') === 'true');
    ok(`${w} ${tema} · sin errores de página`, !errores.length, errores.slice(0, 2).join(' | '));
    await c.close();
  }
} finally { await browser.close(); }
console.log(`\n${malos ? malos + ' mal' : 'todo bien'} · ${OUT}`);
process.exitCode = malos ? 1 : 0;
