// Recorrido de la pantalla de Series de imágenes dentro del armazón móvil COMPLETO (dist/movil.js) a 390 px: Más → Series de imágenes, la lista, el detalle, el presupuesto con la cifra (el primer toque no autoriza),
// el segundo toque (una sola autorización con su Idempotency-Key), 44 px, sin desborde y, con AO_AXE=<axe.min.js>, axe. La nube se simula con AO_NUBE y rutas de mentira que hablan como modulos/series.js.
// Antes: `node build.mjs`. Uso: node scripts/movil-series-recorrido.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oficina } from './movil-recorrido.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (route, cuerpo, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });
let fallos = 0;
const paso = (ok, que) => { if (!ok) fallos++; console.log(`${ok ? '✓' : '✗'} ${que}`); };

const o = await oficina();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
const AXE = process.env.AO_AXE && fs.existsSync(process.env.AO_AXE) ? process.env.AO_AXE : null;
const errores = [], autorizaciones = []; let gets = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }), page = await ctx.newPage();
  await ctx.addInitScript(() => {
    try { localStorage.setItem('ao.onboarded', '1'); } catch {}
    window.AO_NUBE = { pestana: 'prueba', esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), yo: () => ({ rol: 'admin', nombre: 'Abrinay' }), aviso() {}, abrirAjustes() {},
      api: async (ruta, { metodo = 'GET', cuerpo, cabeceras } = {}) => { const r = await fetch(ruta, { method: metodo, headers: { 'content-type': 'application/json', ...(cabeceras || {}) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo.'); return d; } };
  });
  await ctx.addInitScript({ content: fs.readFileSync(path.join(ROOT, 'cloudflare/public/nube-series.js'), 'utf8') });
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errores.push('console: ' + m.text()); });
  let estado = 'previsto';
  const serie = () => ({ id: 'serie-abc', titulo: 'Sala de verano', estado, etiqueta: estado, progreso: { total: 4, listos: 0, revisar: 0, previstos: 4, corriendo: 0, omitidos: 0 }, gasto: { topeUsd: 10, gastadoUsd: 0, reservadoUsd: 0, inciertoUsd: 0, disponibleUsd: 10, excedido: false }, pausa_motivo: null, muestra_lista: false, autorizada: false, pasos_inciertos: [], hash: 'h',
    escaleta: [1, 2, 3, 4].map((n) => ({ n, estado: 'previsto', descripcion: `plano ${n}`, modelo: 'prueba', versiones: [], motivo: null })) });
  await page.route('**/api/**', async (r) => {
    const p = new URL(r.request().url()).pathname, m = r.request().method();
    if (m === 'GET' && p.startsWith('/api/series')) gets++;
    if (p === '/api/series' && m === 'GET') return json(r, { series: [serie()], activo: true });
    if (p === '/api/series/libro/huerfanas') return json(r, { huerfanas: [] });
    if (p === '/api/series/serie-abc' && m === 'GET') return json(r, { serie: serie() });
    if (p === '/api/series/serie-abc/presupuesto') return json(r, { confirmar: { token: 'tok-simulado-123', texto: 'Generar 3 planos de «Sala de verano»: gasta hasta US$0.', costoMostradoUsd: 0, topeUsd: 10, planos: 3, inciertos: 0, vence: Date.now() + 120000, topeMesUsd: 45, estudio: { dailyBudget: 0, monthlyBudget: 0, limit: 0 } }, gasta: false }); // secrets-ok
    if (p === '/api/series/serie-abc/generar') { autorizaciones.push({ idem: r.request().headers()['idempotency-key'], cuerpo: JSON.parse(r.request().postData() || '{}') }); estado = 'muestra'; return json(r, { gasta: true, autorizado: {} }); }
    return r.fallback();
  });
  await page.goto(o.base); await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, 'cloudflare/public/nube.css'), 'utf8') }); /* en la nube el Worker inyecta nube.css en la misma página */ await page.waitForSelector('#mvRoot .mv-tabs', { timeout: 15000 }); await espera(400);
  await page.locator('.mv-tabs button').last().tap(); await page.waitForSelector('.mv-hoja'); await espera(300);
  paso(await page.locator('.mv-hoja [data-vista="series"], .mv-hoja button[data-vista="series"]').count() > 0, 'Más lista «Series de imágenes»');
  await page.locator('.mv-hoja button[data-vista="series"]').tap(); await page.waitForSelector('[data-vista="series"] .sr-card', { timeout: 10000 });
  const vista = '[data-vista="series"]:not([hidden])';
  const medir = async (n) => {
    const r = await page.evaluate(() => { const raiz = document.getElementById('mvRoot'); const chicos = [...document.querySelectorAll('[data-vista="series"]:not([hidden]) button, [data-vista="series"]:not([hidden]) input')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => (e.textContent || e.id).trim().slice(0, 25)); const dentro = [...document.querySelectorAll('[data-vista="series"]:not([hidden]) .sr-raiz *')].every((e) => !e.offsetParent || e.getBoundingClientRect().right <= innerWidth + 1); return { dentro, chicos, ancho: document.documentElement.scrollWidth, vw: innerWidth, raiz: raiz.scrollWidth }; });
    paso(r.chicos.length === 0, `${n}: todos los botones miden 44 px` + (r.chicos.length ? ' → ' + r.chicos.join(', ') : '')); paso(r.ancho <= r.vw + 1, `${n}: sin desborde horizontal`); paso(r.dentro, `${n}: todo cabe dentro de la pantalla (nada recortado por el contenedor)`);
  };
  paso(/Preparada: todavía no se ha generado nada/.test(await page.textContent(vista)), 'La lista dice el estado en palabras'); await medir('Lista');
  if (process.env.AO_DEBUG) { console.log(JSON.stringify(await page.evaluate(() => { const q = (s) => { const e = document.querySelector(s); const r = e?.getBoundingClientRect(); return e ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null; }; return { abrir: q('.sr-abrir'), sr: q('.sr-raiz'), lista: q('.sr-lista'), srd: getComputedStyle(document.querySelector('.sr-raiz')).display + '|' + getComputedStyle(document.querySelector('.sr-raiz')).gridTemplateColumns + '|' + getComputedStyle(document.querySelector('.sr-lista')).gridTemplateColumns + '|' + getComputedStyle(document.querySelector('.mv-series')).display, card: q('.sr-card'), cuerpo: q('.mv-series'), scroll: q('[data-vista="series"] .mv-scroll'), bar: q('.mv-bar') }; }))); await page.screenshot({ path: '/tmp/sr.png' }); }
  await page.locator(`${vista} .sr-abrir`).tap(); await page.waitForSelector(`${vista} .sr-planos`); paso(await page.locator(`${vista} .sr-plano`).count() === 4, 'El detalle muestra los 4 planos'); await medir('Detalle');
  await page.locator(`${vista} button[data-a="presupuesto"][data-modo="muestra"]`).tap(); await page.waitForSelector(`${vista} .sr-conf`);
  paso(autorizaciones.length === 0, 'El primer toque (la cifra) NO autoriza nada'); paso(/Costo máximo de esta tanda/.test(await page.textContent(`${vista} .sr-conf`)), 'La confirmación enseña la cifra'); await medir('Confirmación');
  if (AXE) { await page.addScriptTag({ path: AXE }); const v = await page.evaluate(async () => (await axe.run(document.querySelector('[data-vista="series"]:not([hidden])'))).violations.filter((x) => ['critical', 'serious'].includes(x.impact)).map((x) => x.id + ':' + x.nodes.length)); paso(v.length === 0, 'axe: sin críticos ni serios' + (v.length ? ' → ' + v.join(', ') : '')); } else console.log('(sin AO_AXE: axe no se corrió)');
  await page.locator(`${vista} button[data-a="generar"]`).tap(); await page.waitForFunction(() => /Autorizada|Generando/.test(document.querySelector('[data-vista="series"]')?.textContent || ''), null, { timeout: 8000 });
  paso(autorizaciones.length === 1 && /^sr[0-9a-f]{24}$/.test(autorizaciones[0].idem) && autorizaciones[0].cuerpo.confirmacion === 'tok-simulado-123', 'El segundo toque manda UNA autorización con su Idempotency-Key y el token del servidor');
  // Volver a la pantalla una y otra vez: UNA instancia (una petición por visita), y oculta no sondea (la serie está «generando»)
  await page.waitForSelector(`${vista} .sr-planos`); await espera(800);
  const irYVolver = async () => { await page.locator('.mv-tabs button').first().tap(); await espera(400); await page.locator('.mv-tabs button').last().tap(); await page.waitForSelector('.mv-hoja'); await espera(300); await page.locator('.mv-hoja button[data-vista="series"]').tap(); await page.waitForSelector(`${vista} .sr-planos`); await espera(600); };
  estado = 'pausado'; await espera(300); // sin serie generando no hay sondeo: las peticiones que se cuentan son solo las de volver
  const g0 = gets; for (let i = 0; i < 3; i++) await irYVolver();
  paso(gets - g0 === 3, `Volver 3 veces a Series: una petición por visita (${gets - g0})`);
  estado = 'muestra'; await irYVolver(); /* ahora la serie SÍ está generando y la pantalla la sondea */ await page.locator('.mv-tabs button').first().tap(); await espera(400); const g1 = gets; await espera(11500);
  paso(gets === g1, `Oculta no se sondea, ni siquiera con una serie generando (${gets - g1} peticiones en 11,5 s)`);
  paso(errores.length === 0, 'Sin errores de consola ni de página' + (errores.length ? ' → ' + errores.slice(0, 3).join(' | ') : ''));
  await ctx.close();
} finally { await browser.close(); await o.cerrar?.(); }
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
