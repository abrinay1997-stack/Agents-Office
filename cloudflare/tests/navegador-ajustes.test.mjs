// Ajustes → Modelos y Ajustes → Conectores en un navegador de verdad, contra el Worker real (D1 en memoria): lo que se pinta, que no desborda a 390 px,
// que cada control tiene nombre, y el recorrido de elegir un modelo, probarlo y compararlo.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { SALTAR as SIN_D1 } from './d1-memoria.mjs';
import { oficina, crearFetch, URL_MCP } from './agentes-ayudas.mjs';
import { sembrar } from './d1-memoria.mjs';

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

const ia = async (url, init) => { const c = JSON.parse(init.body); return new Response(JSON.stringify({ content: [{ type: 'text', text: `Soy ${c.model}.` }], usage: { input_tokens: 30, output_tokens: 12 }, model: c.model }), { status: 200 }); };

for (const ancho of [390, 1280]) {
  test(`Modelos a ${ancho} px: se pinta, no desborda, todo tiene nombre; elegir, guardar, probar y comparar (con el costo antes)`, { skip: SALTAR }, async (t0) => {
    if (!nav) return t0.skip('sin Chromium');
    const { p, ctx, errores } = await abrir({ ancho, fetchIA: ia });
    await montar(p, 'nube-modelos.js', 'nube-modelos');
    await p.waitForSelector('.md-cat');
    assert.deepEqual(await sinNombre(p), []); assert.equal(await sinDesborde(p), true, 'sin scroll horizontal');
    assert.match(await p.textContent('.md-llaves'), /llave puesta/);
    assert.match(await p.textContent('.md-cat'), /Muse Spark 1\.3/); assert.match(await p.textContent('.md-cat'), /US\$\d/);
    // una función a Meta: avisa lo de las herramientas solo donde importa
    await p.selectOption('#md-f\\:dimitri', 'muse-spark-1.3');
    assert.equal(await p.locator('#md-f\\:dimitri ~ .md-aviso').count(), 0, 'Dimitri no usa herramientas: sin aviso');
    await p.selectOption('#md-f\\:agentes', 'muse-spark-1.3');
    assert.match(await p.textContent('#md-f\\:agentes ~ .md-aviso, .md-fila:has(#md-f\\:agentes) .md-aviso'), /no usa herramientas/);
    await p.click('[data-a=guardar]'); await p.waitForFunction(() => /Guardado/.test(document.querySelector('.md-barra .nb-msg').textContent));
    const guardado = await p.evaluate(() => fetch('/api/modelos').then((r) => r.json()));
    assert.equal(guardado.ajustes.funciones.dimitri, 'muse-spark-1.3'); assert.equal(guardado.ajustes.funciones.agentes, 'muse-spark-1.3');
    // probar
    await p.click('[data-a=probar]'); await p.waitForSelector('.md-r');
    assert.match(await p.textContent('#md-res'), /Soy claude-sonnet-5-5/); assert.match(await p.textContent('#md-res'), /tokens · US\$/);
    // comparar: la primera pulsación solo dice el costo
    await p.click('[data-a=comparar]'); await p.waitForSelector('.md-costo');
    assert.match(await p.textContent('.md-costo'), /gasta como mucho US\$/); assert.equal(await p.locator('.md-lado').count(), 0);
    await p.click('[data-a=comparar]'); await p.waitForSelector('.md-lado .md-r');
    assert.equal(await p.locator('.md-lado .md-r').count(), 2);
    assert.equal(await sinDesborde(p), true);
    assert.deepEqual(errores, []);
    // un modelo propio: inválido se dice, válido entra
    await p.click('summary:has-text("Modelo personalizado")'); await p.fill('#md-pid', 'gpt-9'); await p.click('[data-a=anadir-m]');
    await p.waitForFunction(() => /prefijo|empieza|no es válido|«claude-»/.test(document.querySelector('.md-barra .nb-msg').textContent));
    await p.fill('#md-pid', 'claude-nuevo-6'); await p.fill('#md-pin', '3,5'); await p.click('[data-a=anadir-m]');
    await p.waitForFunction(() => /Añadido: claude-nuevo-6/.test(document.querySelector('.md-barra .nb-msg').textContent));
    assert.match(await p.textContent('.md-cat'), /claude-nuevo-6/);
    await ctx.close();
  });
}


/* ---------- Ajustes → Conectores ---------- */
const CENT = 'CENTINELA-token-pantalla-1a2b3c4d5e'; // secrets-ok
for (const ancho of [390, 1280]) {
  test(`Conectores a ${ancho} px: vacío claro, plantillas con icono, guía de Zapier, probar con herramientas lee/envía, guardar con token cifrado y tarjeta con estado; el token no se ve`, { skip: SALTAR }, async (t0) => {
    if (!nav) return t0.skip('sin Chromium');
    const stand = crearFetch({ herramientasMcp: { search_threads: { salida: 'x' }, create_draft: { salida: 'y' }, send_email: { salida: 'z' } }, tokenMcp: CENT });
    const { p, ctx, errores, d1 } = await abrir({ ancho, fetchIA: stand.fetchFn, extraEnv: { AO_CLAVE_CIFRADO: 'una-clave-de-cifrado-muy-larga-de-prueba-0123456789' } }); // secrets-ok
    await montar(p, 'nube-conectores.js', 'nube-conectores');
    await p.waitForSelector('.cn-nada');
    assert.doesNotMatch(await p.textContent('#pane'), /claude mcp add/); assert.match(await p.textContent('#pane'), /\+ Añadir conector/);
    assert.equal(await sinDesborde(p), true);
    await p.click('[data-a=nuevo]');
    assert.ok((await p.locator('.cn-tile').count()) >= 17, 'las plantillas');
    const tam = await p.evaluate(() => [...document.querySelectorAll('.cn-tile')].map((b) => ({ h: b.getBoundingClientRect().height, img: b.querySelector('img').naturalWidth })));
    assert.ok(tam.every((x) => x.h >= 56 && x.img > 0), 'cada plantilla es una tarjeta de 56 px o más con su icono cargado');
    const nombres = await p.$$eval('.cn-tile span', (l) => l.map((e) => e.textContent)); for (const n of ['Zapier MCP', 'n8n (MCP Server Trigger)', 'Make', 'Gmail', 'Slack', 'Notion', 'GitHub', 'Stripe', 'HubSpot', 'Airtable', 'Canva', 'Cloudflare', 'Linear', 'Asana', 'Meta Ads']) assert.ok(nombres.includes(n), n);
    await p.click('.cn-tile:has-text("Zapier MCP")');
    assert.equal(await p.locator('.cn-guia li').count(), 3); assert.match(await p.textContent('.cn-guia'), /zapier\.com\/mcp/);
    assert.deepEqual(await sinNombre(p), [], 'todo control tiene nombre');
    // sin probar: avisa antes de guardar
    await p.fill('#cn-url', URL_MCP); await p.fill('#cn-token', 'token-equivocado-123');
    await p.click('input[name=cn-dep][value=emails]');
    await p.click('[data-a=probar-form]'); await p.waitForFunction(() => /rechazó el acceso/.test(document.querySelector('#cn-pmsg').textContent));
    await p.fill('#cn-token', CENT); await p.click('[data-a=probar-form]'); await p.waitForSelector('.cn-hs');
    assert.equal(await p.locator('.cn-h.lectura input:checked').count(), 2); assert.equal(await p.locator('.cn-h.envio input:checked').count(), 0, 'lo que envía nace sin marcar');
    assert.match(await p.textContent('.cn-hs'), /envía/);
    await p.click('[data-a=guardar-form]'); await p.waitForSelector('.cn-card');
    const card = p.locator('.cn-card').first();
    assert.match(await card.textContent(), /Zapier MCP/); assert.match(await card.textContent(), /Listo/); assert.match(await card.textContent(), /token ••• guardado cifrado/); assert.match(await card.textContent(), /2 de lectura/);
    const caja = await card.boundingBox(); assert.ok(caja.height >= 56 && caja.width <= ancho);
    assert.ok(await card.locator('img.cn-ic').evaluate((i) => i.naturalWidth > 0 && i.getBoundingClientRect().width >= 40), 'su icono');
    assert.equal(await sinDesborde(p), true);
    assert.equal((await p.content()).includes(CENT), false, 'el token no aparece en la página'); assert.equal(await p.evaluate(() => document.getElementById('pane').innerHTML.includes('v1.')), false);
    // un conector sin token pide autorización y dice qué hacer
    await p.click('[data-a=nuevo]'); await p.click('.cn-tile:has-text("Slack")'); await p.fill('#cn-url', 'https://mcp.slack.example.com/mcp'); await p.click('[data-a=guardar-form]'); await p.click('[data-a=guardar-form]');
    await p.waitForFunction(() => document.querySelectorAll('.cn-card').length === 2);
    assert.match(await p.locator('.cn-card:has-text("Slack")').textContent(), /Necesita su token.*Ábrelo con «Editar»/s);
    // apagar y quitar (segundo clic)
    await p.click('.cn-card:has-text("Slack") [data-a=quitar]'); assert.equal(await p.locator('.cn-card').count(), 2); await p.click('.cn-card:has-text("Slack") [data-a=quitar]'); await p.waitForFunction(() => document.querySelectorAll('.cn-card').length === 1);
    assert.equal(d1._db.prepare('select count(*) n from conectores_extra').get().n, 1);
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}
test('Conectores sin AO_CLAVE_CIFRADO: la opción de guardar el token aquí está apagada y lo dice', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 390, fetchIA: ia });
  await montar(p, 'nube-conectores.js', 'nube-conectores');
  await p.waitForSelector('.cn-nada'); assert.match(await p.textContent('.sg-lead'), /AO_CLAVE_CIFRADO/);
  await p.click('[data-a=nuevo]'); await p.click('.cn-tile:has-text("n8n")');
  assert.equal(await p.locator('input[name=cn-donde][value=aqui]').isDisabled(), true); assert.equal(await p.locator('input[name=cn-donde][value=secreto]').isChecked(), true);
  assert.equal(await p.locator('.cn-guia li').count(), 3); assert.match(await p.textContent('.cn-guia'), /MCP Server Trigger/);
  await ctx.close();
});
