// Ajustes → Funciones nuevas en un navegador de verdad, contra el Worker real (D1 en memoria): lo que se pinta, que no desborda a 390 px,
// que cada control tiene nombre, y el recorrido de elegir un modelo, probarlo y compararlo.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { SALTAR as SIN_D1 } from './d1-memoria.mjs';
import { oficina, crearFetch, URL_MCP } from './agentes-ayudas.mjs';
import { sembrar } from './d1-memoria.mjs';
import { leerDoc } from '../worker/lib/almacen.js';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* siguiente */ } }
const leer = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const SALTAR = SIN_D1 || (chromium ? false : 'Playwright no está instalado');
let nav;
before(async () => { if (!SALTAR) nav = await chromium.launch().catch(() => null); });
after(async () => { await nav?.close(); });

const SHIM = `window.AO_NUBE = { esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), yo: () => ({ rol: 'admin', nombre: 'Dueño' }), aviso: (t) => (window.__aviso = t),
  api: async (ruta, { metodo = 'GET', cuerpo } = {}) => { const r = await fetch(ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo completar.'); return d; }, abrirAjustes() {} };`;
const PAGINA = (css) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--ink:#111;--cream:#fff;--hairline:#ddd;--grey:#555;--focus:#06c;--ui:system-ui}body{font:14px system-ui;margin:0;background:#fff;color:#111}.pane{padding:16px;max-width:760px}.sg-f{display:flex;flex-direction:column;gap:4px;margin:0 0 14px}.sg-btn{min-height:36px;padding:0 12px}${css}</style></head><body><div class="pane" id="pane"></div></body></html>`;

async function abrir({ ancho, fetchIA, llaveMeta = true, conector = false, extraEnv = {} }) {
  const { d1, env } = await oficina({ env: { ...(llaveMeta ? { META_API_KEY: 'meta-llave-de-prueba' } : {}), ...extraEnv }, conector });
  env.__pruebas = { fetch: fetchIA };
  await sembrar(d1, { email: 'otro@panaclaw.test', rol: 'editor' });
  const { manejar } = await import('../worker/lib/rutas.js');
  const entrada = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'dueno@panaclaw.test', contrasena: 'una-clave-larga-123' }) }), env); // secrets-ok
  const cookie = entrada.headers.get('set-cookie').split(';')[0];
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } }); const p = await ctx.newPage(); const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.route('https://oficina.test/**', async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/') return r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: PAGINA(leer('nube.css')) });
    if (u.pathname === '/shim.js') return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: SHIM });
    if (u.pathname.startsWith('/nube-')) return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: leer(u.pathname.slice(1)) });
    const resp = await manejar(new Request(u.href, { method: req.method(), headers: { 'content-type': 'application/json', cookie }, body: req.postData() || undefined }), env);
    return r.fulfill({ status: resp.status, headers: { 'content-type': 'application/json' }, body: await resp.text() });
  });
  await p.goto('https://oficina.test/');
  return { p, ctx, d1, errores };
}
const montar = async (p, archivo, tab) => { await p.addScriptTag({ url: '/shim.js' }); await p.addScriptTag({ url: '/' + archivo }); await p.evaluate((t) => window.AO_AJUSTES_EXTRA.find((x) => x.key === t).render(document.getElementById('pane')), tab); };
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const sinNombre = (p) => p.evaluate(() => [...document.querySelectorAll('#pane input:not([type=hidden]), #pane select, #pane textarea')].filter((e) => !(e.labels?.length || e.getAttribute('aria-label'))).map((e) => e.id || e.tagName));


const medidas = (p) => p.evaluate(() => [...document.querySelectorAll('#pane button, #pane input, #pane select')].filter((e) => !e.disabled).map((e) => ({ n: e.textContent.trim().slice(0, 30) || e.id, h: e.getBoundingClientRect().height, f: parseFloat(getComputedStyle(e).fontSize) })));

for (const ancho of [320, 360, 390, 430, 1280]) {
  test(`Funciones nuevas a ${ancho} px: se pinta con el estado real, no desborda, enciende y apaga con confirmación en lo que gasta`, { skip: SALTAR }, async (t0) => {
    if (!nav) return t0.skip('sin Chromium');
    const { p, ctx, d1, errores } = await abrir({ ancho, fetchIA: null });
    await montar(p, 'nube-funciones.js', 'nube-funciones');
    await p.waitForSelector('.fn-card');
    assert.equal(await sinDesborde(p), true, 'sin scroll horizontal');
    assert.deepEqual(await sinNombre(p), []);
    assert.equal(await p.locator('.fn-card').count() >= 10, true);
    assert.match(await p.textContent('#pane'), /Chat interno del equipo/);
    assert.match(await p.textContent('#pane'), /No se puede encender todavía/, 'lo no construido dice por qué');
    assert.equal(await p.locator('button[data-fn="retoques-nube"]').isDisabled(), true);
    if (ancho < 500) for (const m of await medidas(p)) assert.ok(m.h >= 36, `${m.n}: ${m.h}px`);
    // encender el chat (no gasta): un toque
    await p.click('button[data-fn="chat"]');
    await p.waitForSelector('button[data-fn="chat"][data-on="1"]');
    assert.equal((await leerDoc(d1, 'chat.config', {})).valor.activo, true);
    // lo que gasta pide un segundo toque
    await p.click('button[data-fn="lotes-nube"]');
    assert.equal((await leerDoc(d1, 'estudio.config', {})).valor.lotesNube, undefined, 'el primer toque no enciende');
    assert.match(await p.textContent('button[data-fn="lotes-nube"]'), /Sí, encender/);
    await p.click('button[data-fn="lotes-nube"]');
    await p.waitForSelector('button[data-fn="lotes-nube"][data-on="1"]');
    assert.equal((await leerDoc(d1, 'estudio.config', {})).valor.lotesNube, true);
    // apagar siempre se puede, de un toque
    await p.click('button[data-fn="lotes-nube"]');
    await p.waitForSelector('button[data-fn="lotes-nube"][data-on="0"]');
    assert.equal((await leerDoc(d1, 'estudio.config', {})).valor.lotesNube, false);
    // las tres que antes pedían la consola: notas, notificaciones y la de lectura (viene ENCENDIDA y se puede apagar)
    await p.click('button[data-fn="notas-personales"]'); await p.waitForSelector('button[data-fn="notas-personales"][data-on="1"]');
    assert.equal((await leerDoc(d1, 'notas.config', {})).valor.activo, true);
    await p.click('button[data-fn="notificaciones"]'); await p.waitForSelector('button[data-fn="notificaciones"][data-on="1"]');
    assert.equal(await p.locator('button[data-fn="lectura-ve-resultados"]').getAttribute('data-on'), '1', 'viene encendida');
    assert.match(await p.textContent('#pane'), /Nunca ve dinero/);
    await p.click('button[data-fn="lectura-ve-resultados"]'); await p.waitForSelector('button[data-fn="lectura-ve-resultados"][data-on="0"]');
    assert.equal((await leerDoc(d1, 'notificaciones.config', {})).valor.lecturaVeResultados, false);
    assert.equal((await leerDoc(d1, 'notificaciones.config', {})).valor.activo, true);
    // un POST que falla no deja la confirmación abierta: el siguiente toque vuelve a pedirla
    await p.route('**/api/funciones', async (r) => { if (r.request().method() === 'POST') { await p.unroute('**/api/funciones'); return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"caído"}' }); } return r.fallback(); });
    await p.click('button[data-fn="lotes-nube"]'); await p.click('button[data-fn="lotes-nube"]');
    await p.waitForFunction(() => /caído/.test(document.querySelector('#pane').textContent));
    await p.click('button[data-fn="lotes-nube"]');
    assert.match(await p.textContent('button[data-fn="lotes-nube"]'), /Sí, encender/, 'vuelve a pedir el segundo toque');
    assert.equal((await leerDoc(d1, 'estudio.config', {})).valor.lotesNube, false, 'el toque tras el fallo no enciende');
    assert.equal(await sinDesborde(p), true);
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}
