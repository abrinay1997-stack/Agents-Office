// Series de imágenes en la nube (N6) en un navegador de verdad, contra el Worker real con su D1 en memoria: lo que se pinta, que no desborda de 320 a 1280 px, que cada botón mide 44 px,
// y los recorridos del dinero: el primer toque NO cambia nada, el segundo lleva la cifra del servidor, y quien no es administrador no ve botones ni dinero.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { SALTAR as SIN_D1, sembrar } from './d1-memoria.mjs';
import { oficina } from './agentes-ayudas.mjs';
import { guardarDoc } from '../worker/lib/almacen.js';
import { serializarBiblia } from '../../biblia-core.mjs';
import { crearAlmacenD1 } from '../worker/lib/series/almacen.js';
import { proponer } from '../worker/lib/series/propuesta.js';
import * as L from '../worker/lib/series/libro.js';
import { claveIdempotencia } from '../../serie-core.mjs';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* siguiente */ } }
const leer = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const SALTAR = SIN_D1 || (chromium ? false : 'Playwright no está instalado');
let nav;
before(async () => { if (!SALTAR) nav = await chromium.launch().catch(() => null); });
after(async () => { await nav?.close(); });

const BIB = { tono: 'cálido y sencillo', luz: 'luz natural', composicion: 'producto centrado', nunca: ['neón'], paleta: [{ rol: 'primario', hex: '#336699' }] };
const SHIM = (rol) => `window.AO_NUBE = { esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), yo: () => ({ rol: '${rol}', nombre: 'Persona' }), aviso: (t) => (window.__aviso = t), abrirAjustes: (k) => (window.__ajustes = k),
  api: async (ruta, { metodo = 'GET', cuerpo, cabeceras } = {}) => { const r = await fetch(ruta, { method: metodo, headers: { 'content-type': 'application/json', ...(cabeceras || {}) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'No se pudo completar.'); return d; } };`;
const PAGINA = (css) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--ink:#111;--cream:#fff;--hairline:#ddd;--grey:#555;--focus:#06c}body{font:14px system-ui;margin:0;background:#fff;color:#111}.pane{padding:16px;max-width:760px}${css}</style></head><body><div class="pane" id="pane"></div></body></html>`;

/** Una oficina con una serie guardada (si `serie`), el interruptor encendido (si `encendido`), la página, y las peticiones que hace la pantalla anotadas. */
async function abrir({ ancho, rol = 'admin', encendido = true, titulo = 'Sala de verano', huerfana = false, reloj = false, enMarcha = false }) {
  const { d1, env } = await oficina({ conector: false });
  const editor = await sembrar(d1, { email: 'ed@panaclaw.test', rol: 'editor' }); void editor;
  if (encendido) await guardarDoc(d1, 'config-local', { dimitri: { seriesNube: true } });
  d1._db.prepare('insert or replace into notas (nombre, grupo, oficina, texto, bytes, actualizado) values (?,?,?,?,?,?)').run('biblia-visual', 'Marca', 0, serializarBiblia(BIB, { version: 1, estado: 'aprobada', aprobada_por: 'dueño' }), 100, 1);
  const almacen = crearAlmacenD1(d1);
  const r = await proponer(env, d1, { brief: { titulo, objetivo: 'mostrar el sofá', formato: 'carrusel' }, planos: [1, 2, 3, 4].map((i) => ({ descripcion: `plano ${i}`, prompt: `un sofá gris en una sala luminosa, vista ${i}`, modelo: 'prueba' })), guardar: true }, { almacen });
  const id = r.cuerpo.guardada.id;
  if (enMarcha) { const f = d1._db.prepare('select json from series where id = ?').get(id), j = JSON.parse(f.json); j.estado = 'muestra'; d1._db.prepare("update series set json = ?, estado = 'muestra' where id = ?").run(JSON.stringify(j), id); } // una serie «generando»: la pantalla la sondea
  let clave = null;
  if (huerfana) { clave = claveIdempotencia(id, 1, 1); await L.reservar(d1, { clave, serieId: id, n: 1, intento: 1, maxMicro: 500_000, topeSerieMicro: 10_000_000, mes: '2026-10', dia: '2026-10-30', carrusel: true, topeMesMicro: 45_000_000, peso: 1, cupoDiaPeso: 0, ahora: Date.now() - 20 * 60e3 }); await L.marcarIncierto(d1, clave); d1._db.prepare('delete from series').run(); }
  const { manejar } = await import('../worker/lib/rutas.js');
  const correo = rol === 'admin' ? 'dueno@panaclaw.test' : 'ed@panaclaw.test';
  const entrada = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: correo, contrasena: 'una-clave-larga-123' }) }), env); // secrets-ok
  const cookie = entrada.headers.get('set-cookie').split(';')[0];
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } }); const p = await ctx.newPage(); const errores = [], pedidos = [], gets = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.route('https://oficina.test/**', async (rt) => {
    const req = rt.request(), u = new URL(req.url());
    if (u.pathname === '/') return rt.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: PAGINA(leer('nube.css')) });
    if (u.pathname === '/shim.js') return rt.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: SHIM(rol) });
    if (u.pathname === '/nube-series.js') return rt.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: leer('nube-series.js') });
    if (req.method() === 'GET') gets.push(u.pathname); else pedidos.push({ m: req.method(), ruta: u.pathname, idem: req.headers()['idempotency-key'] || null, cuerpo: req.postData() });
    const resp = await manejar(new Request(u.href, { method: req.method(), headers: { 'content-type': 'application/json', cookie, ...(req.headers()['idempotency-key'] ? { 'idempotency-key': req.headers()['idempotency-key'] } : {}) }, body: req.postData() || undefined }), env);
    return rt.fulfill({ status: resp.status, headers: { 'content-type': 'application/json' }, body: await resp.text() });
  });
  if (reloj) await p.clock.install(); // el tiempo lo mueve el test, no el reloj de la pared
  await p.goto('https://oficina.test/');
  await p.addScriptTag({ url: '/shim.js' }); await p.addScriptTag({ url: '/nube-series.js' });
  await p.evaluate(() => window.AO_AJUSTES_EXTRA.find((x) => x.key === 'nube-series').render(document.getElementById('pane')));
  return { p, ctx, d1, id, clave, errores, pedidos, gets, env };
}
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const medidas = (p) => p.evaluate(() => [...document.querySelectorAll('#pane button, #pane input')].filter((e) => !e.disabled && e.offsetParent).map((e) => ({ n: (e.textContent || e.id).trim().slice(0, 30), h: e.getBoundingClientRect().height, f: parseFloat(getComputedStyle(e).fontSize), tag: e.tagName })));
const serieEn = (d1, id) => d1._db.prepare('select estado, json from series where id = ?').get(id);

for (const ancho of [320, 360, 390, 430, 1280]) {
  test(`Series a ${ancho} px: lista en palabras, sin desborde, botones de 44 px; presupuesto → la cifra → generar con segundo toque; pausar y cancelar`, { skip: SALTAR }, async (t0) => {
    if (!nav) return t0.skip('sin Chromium');
    const { p, ctx, d1, id, errores, pedidos } = await abrir({ ancho });
    await p.waitForSelector('.sr-card');
    const txt = await p.textContent('#pane');
    assert.match(txt, /Preparada: todavía no se ha generado nada/); assert.match(txt, /0 de 4 imágenes listas/); assert.match(txt, /motores de pago siguen cerrados/);
    assert.equal(await sinDesborde(p), true, 'lista sin scroll horizontal');
    await p.click('.sr-abrir');
    await p.waitForSelector('.sr-planos');
    assert.equal(await p.locator('.sr-plano').count(), 4); assert.match(await p.textContent('#pane'), /Presupuesto/); assert.match(await p.textContent('#pane'), /Tope de esta serie/);
    assert.equal(await sinDesborde(p), true, 'detalle sin scroll horizontal');
    for (const m of await medidas(p)) { assert.ok(m.h >= 44 - 0.5, `${m.n}: ${m.h}px de alto`); }
    // primer toque: la cifra. NADA se autoriza todavía.
    await p.click('button[data-a="presupuesto"][data-modo="muestra"]');
    await p.waitForSelector('.sr-conf');
    assert.match(await p.textContent('.sr-conf'), /Generar 3 planos/); assert.match(await p.textContent('.sr-conf'), /Costo máximo de esta tanda/); assert.match(await p.textContent('.sr-conf'), /Sí, generar — gasta hasta US\$0,00/);
    assert.equal(pedidos.some((x) => x.ruta.endsWith('/generar')), false, 'ninguna autorización con el primer toque'); assert.notEqual(serieEn(d1, id).estado, 'muestra');
    assert.equal(await sinDesborde(p), true, 'con la confirmación abierta tampoco desborda');
    // Escape la cierra sin gastar
    await p.keyboard.press('Escape'); await p.waitForSelector('.sr-conf', { state: 'detached' }); assert.notEqual(serieEn(d1, id).estado, 'muestra');
    // volver a pedirla y confirmar: UNA autorización con su Idempotency-Key y el token del servidor
    await p.click('button[data-a="presupuesto"][data-modo="muestra"]'); await p.waitForSelector('.sr-conf');
    await p.click('button[data-a="generar"]');
    await p.waitForFunction(() => /Autorizada|Generando/.test(document.getElementById('pane').textContent), null, { timeout: 8000 });
    const gen = pedidos.filter((x) => x.ruta.endsWith('/generar')); assert.equal(gen.length, 1, 'una sola autorización'); assert.match(gen[0].idem, /^sr[0-9a-f]{24}$/);
    const cuerpo = JSON.parse(gen[0].cuerpo); assert.match(cuerpo.confirmacion, /^[A-Za-z0-9_-]{6,80}$/); assert.equal(cuerpo.modo, 'muestra'); assert.equal(typeof cuerpo.costoMostradoUsd, 'number');
    assert.equal(serieEn(d1, id).estado, 'muestra');
    await p.waitForSelector('button[data-a="pausar"]');
    await p.click('button[data-a="pausar"]');
    await p.waitForFunction(() => /En pausa/.test(document.getElementById('pane').textContent), null, { timeout: 8000 });
    assert.equal(serieEn(d1, id).estado, 'pausado');
    // cancelar pide un segundo toque
    await p.click('button[data-a="cancelar-pedir"]');
    assert.equal(serieEn(d1, id).estado, 'pausado', 'el primer toque de cancelar no cancela'); assert.match(await p.textContent('#pane'), /Cancelar es definitivo/);
    await p.click('button[data-a="cancelar-ok"]');
    await p.waitForFunction(() => /Cancelada/.test(document.getElementById('pane').textContent), null, { timeout: 8000 });
    assert.equal(serieEn(d1, id).estado, 'cancelado');
    assert.deepEqual(errores, []); await ctx.close();
  });
}

test('Series: quien no es administrador ve avances y estados, pero ni botones de gasto ni una sola cifra de dinero', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, errores } = await abrir({ ancho: 390, rol: 'editor' });
  await p.waitForSelector('.sr-card'); let txt = await p.textContent('#pane');
  assert.match(txt, /Preparada/); assert.doesNotMatch(txt, /gastado|tope de|US\$/i);
  await p.click('.sr-abrir'); await p.waitForSelector('.sr-planos'); txt = await p.textContent('#pane');
  assert.match(txt, /Solo un administrador puede generar/); assert.doesNotMatch(txt, /Presupuesto|Tope|gastado|US\$/);
  assert.equal(await p.locator('button[data-a="presupuesto"], button[data-a="generar"], button[data-a="pausar"], button[data-a="cancelar-pedir"], button[data-a="libro"]').count(), 0);
  assert.deepEqual(errores, []); await ctx.close();
});

test('Series apagadas: la pantalla no falla, dice que están apagadas y cómo encenderlas', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, errores } = await abrir({ ancho: 390, encendido: false });
  await p.waitForSelector('.sr-h'); const txt = await p.textContent('#pane');
  assert.match(txt, /apagadas/); assert.match(txt, /Ajustes → Funciones nuevas/); assert.match(txt, /Series de imágenes en la nube: ver y proponer/); assert.match(txt, /motor gratis «Prueba»/);
  assert.equal(await sinDesborde(p), true);
  await p.click('button[data-a="funciones"]'); assert.equal(await p.evaluate(() => window.__ajustes), 'nube-funciones');
  assert.deepEqual(errores, []); await ctx.close();
});

test('Series: un título con HTML se escribe como texto (esc) y no ejecuta nada', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, errores } = await abrir({ ancho: 390, titulo: 'Sala <img src=x onerror="window.__x=1"> y <b>negrita</b>' });
  await p.waitForSelector('.sr-card'); assert.equal(await p.evaluate(() => window.__x), undefined); assert.equal(await p.locator('#pane img, #pane b b').count(), 0);
  assert.match(await p.textContent('.sr-abrir'), /<img src=x/); assert.deepEqual(errores, []); await ctx.close();
});

test('Series: la línea huérfana se decide con dos toques — el primero NO cambia nada, el segundo anota la cifra que mostró el servidor, y no hay forma de deshacerlo (se dice)', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, d1, clave, errores, pedidos } = await abrir({ ancho: 390, huerfana: true });
  await p.waitForSelector('.sr-ojo'); assert.match(await p.textContent('.sr-ojo'), /1 línea del libro sin serie/);
  await p.click('button[data-a="huerfanas"]'); await p.waitForSelector('button[data-huerfana="1"]');
  assert.match(await p.textContent('#pane'), /En duda: puede haberse cobrado/);
  await p.click('button[data-huerfana="1"]'); await p.waitForSelector('#sr-real');
  assert.match(await p.textContent('.sr-conf'), /no se puede deshacer/);
  await p.fill('#sr-real', '0,2'); await p.click('button[data-a="resolver-pedir"][data-cobro="1"]'); await p.waitForSelector('button[data-a="resolver-ok"]');
  assert.match(await p.textContent('.sr-conf'), /SÍ se cobró.*US\$0\.2.*No se puede deshacer/); assert.match(await p.textContent('button[data-a="resolver-ok"]'), /Sí, anotar US\$0,20 de gasto/);
  assert.equal(d1._db.prepare('select estado from series_libro where clave = ?').get(clave).estado, 'incierto', 'el primer toque no cambia nada');
  await p.click('button[data-a="resolver-ok"]');
  await p.waitForFunction(() => /No hay líneas sueltas/.test(document.getElementById('pane').textContent), null, { timeout: 8000 });
  const l = d1._db.prepare('select estado, real_micro from series_libro where clave = ?').get(clave); assert.equal(l.estado, 'liquidado'); assert.equal(l.real_micro, 200_000);
  assert.equal(pedidos.filter((x) => x.ruta === '/api/series/libro/resolver').length, 2, 'dos peticiones: pedir la cifra y confirmar');
  assert.equal(await sinDesborde(p), true); assert.deepEqual(errores, []); await ctx.close();
});

const cuantos = (gets, ruta) => gets.filter((x) => x === ruta).length;

test('Series: UNA sola instancia por contenedor — abrir() otra vez (el armazón móvil lo hace en cada «mostrar») no duplica ni clics ni peticiones, y no pierde la confirmación abierta', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, id, errores, pedidos, gets } = await abrir({ ancho: 390 });
  await p.waitForSelector('.sr-card');
  const base = cuantos(gets, '/api/series');
  for (let i = 1; i <= 3; i++) { await p.evaluate(() => window.AO_NUBE.series.abrir(document.getElementById('pane'))); await p.waitForSelector('.sr-card'); await p.waitForFunction((n) => true, base); }
  await p.waitForTimeout(300);
  assert.equal(cuantos(gets, '/api/series') - base, 3, 'cada «mostrar» pide la lista UNA vez, no una por cada instancia que hubiera');
  assert.equal(await p.evaluate(() => { const c = document.getElementById('pane'); return !!c._srInst; }), true);
  await p.click('.sr-abrir'); await p.waitForSelector('.sr-planos');
  for (let i = 0; i < 3; i++) await p.evaluate(() => window.AO_NUBE.series.abrir(document.getElementById('pane')));
  await p.waitForSelector('.sr-planos');
  await p.click('button[data-a="presupuesto"][data-modo="muestra"]'); await p.waitForSelector('.sr-conf');
  assert.equal(pedidos.filter((x) => x.ruta.endsWith('/presupuesto')).length, 1, 'un clic = una petición (no una por instancia)');
  // volver a la pantalla (mostrar) con la confirmación abierta: sigue ahí y no la pisa una lista ni un detalle viejo
  for (let i = 0; i < 3; i++) { await p.evaluate(() => window.AO_NUBE.series.abrir(document.getElementById('pane'))); await p.waitForTimeout(250); assert.equal(await p.locator('.sr-conf').count(), 1, 'la confirmación abierta no se pierde'); assert.equal(await p.locator('.sr-lista').count(), 0, 'ninguna instancia pinta la lista encima'); }
  await p.click('button[data-a="generar"]');
  await p.waitForFunction(() => /Autorizada|Generando/.test(document.getElementById('pane').textContent), null, { timeout: 8000 });
  assert.equal(pedidos.filter((x) => x.ruta.endsWith('/generar')).length, 1, 'una sola autorización'); void id;
  assert.deepEqual(errores, []); await ctx.close();
});

test('Series: el sondeo de 10 s solo corre con la pantalla a la vista, la pestaña visible y una serie generando — oculta no pide nada; al volver, se reanuda; un «Actualizar» a mano no se solapa', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, errores, gets } = await abrir({ ancho: 390, reloj: true, enMarcha: true });
  await p.waitForSelector('.sr-card'); await p.waitForTimeout(200);
  const n0 = cuantos(gets, '/api/series');
  await p.clock.runFor(10100); await p.waitForTimeout(300);
  assert.equal(cuantos(gets, '/api/series') - n0, 1, 'visible y generando: UNA petición cada 10 s');
  // oculta (como hace el armazón móvil: sin desconectar)
  await p.evaluate(() => document.getElementById('pane')._srInst.ocultar());
  const n1 = cuantos(gets, '/api/series');
  await p.clock.runFor(65000); await p.waitForTimeout(300);
  assert.equal(cuantos(gets, '/api/series') - n1, 0, 'oculta: ninguna petición en 65 s');
  // la pestaña del navegador oculta tampoco sondea
  await p.evaluate(() => document.getElementById('pane')._srInst.mostrar()); await p.waitForTimeout(300);
  const n2 = cuantos(gets, '/api/series'); assert.equal(n2 - n1, 1, 'al volver se reanuda con UNA carga');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.clock.runFor(35000); await p.waitForTimeout(300);
  assert.equal(cuantos(gets, '/api/series') - n2, 0, 'con la pestaña oculta no se sondea');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(300);
  assert.equal(cuantos(gets, '/api/series') - n2, 1, 'al volver la pestaña se pone al día una vez');
  // un «Actualizar» a mano y el temporizador a la vez: la carga en curso no se duplica
  const n3 = cuantos(gets, '/api/series');
  await p.evaluate(() => { const i = document.getElementById('pane')._srInst; i.recargar(); i.recargar(true); i.recargar(true); }); await p.waitForTimeout(400);
  assert.equal(cuantos(gets, '/api/series') - n3, 1, 'las cargas del temporizador no se solapan con una en curso');
  // sin serie generando no hay sondeo
  assert.deepEqual(errores, []); await ctx.close();
});

test('Series: sin ninguna serie generando no se sondea nunca', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, gets } = await abrir({ ancho: 390, reloj: true });
  await p.waitForSelector('.sr-card'); await p.waitForTimeout(200); const n0 = cuantos(gets, '/api/series');
  await p.clock.runFor(120000); await p.waitForTimeout(300);
  assert.equal(cuantos(gets, '/api/series') - n0, 0); await ctx.close();
});
