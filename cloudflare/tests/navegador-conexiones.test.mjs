// «Actualizar conexiones» en un navegador de verdad (27 oct 2026): la PÁGINA real de la oficina con lo de la nube inyectado, hablando con el Worker real (D1 en memoria, IA de mentira) y las 59 notas
// de fábrica. El botón sale solo para un administrador; el recorrido: abrir → ver qué hay → buscar conexiones con IA (de a tres, con avance) → quitar una → aplicar → ver el mapa cambiar → deshacer.
// A 1280 px (el panel del Cerebro) y a 390 px (la hoja del celular: botones de 44 px, sin desbordes). Lo que escribe cualquiera se pinta como texto, nunca como HTML.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { SALTAR as SIN_D1, sembrar } from './d1-memoria.mjs';
import { oficina, texto } from './agentes-ayudas.mjs';
import { semillaEnDisco, assetsDe } from './semilla-ayudas.mjs';
import { guardarNotas, guardarGrafo } from '../worker/lib/cerebro.js';
import { guardarDoc } from '../worker/lib/almacen.js';
import { memoriaCon } from './cerebro-ayudas.mjs';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* siguiente */ } }
const PAGINA = new URL('../../dist/command-centre-v2.html', import.meta.url);
const pub = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const SALTAR = SIN_D1 || (!existsSync(PAGINA) ? 'falta dist/ (node build.mjs)' : chromium ? false : 'Playwright no está instalado');
let nav;
before(async () => { if (!SALTAR) nav = await chromium.launch().catch(() => null); });
after(async () => { await nav?.close(); });
const INYECCION = '<link rel="stylesheet" href="/nube.css"><script src="/nube.js" defer></script>';
const conNube = (h) => { const i = h.lastIndexOf('</body>'); return h.slice(0, i) + INYECCION + h.slice(i); };
const TIPO = { js: 'text/javascript', css: 'text/css' };
const XSS = 'Nota <img src=x onerror=window.__xss=1> rara';

/** La IA de mentira: contesta según la nota que lee. */
const ia = (pedidos) => async (url, init = {}) => {
  const c = JSON.parse(init.body), pedido = typeof c.messages.at(-1).content === 'string' ? c.messages.at(-1).content : JSON.stringify(c.messages.at(-1).content);
  pedidos.push(pedido);
  if (/FRASE A:/.test(pedido)) return new Response(JSON.stringify(texto(JSON.stringify({ veredicto: 'contradice', porque: 'El precio de Corporate no coincide.' }))), { status: 200 }); // duplicados y contradicciones: la IA confirma
  const nom = /NOTA: «(.+?)»/.exec(pedido)?.[1];
  const r = nom === 'Oferta de verano' ? { enlaces: [{ a: 'precios-webs', porque: 'habla de los mismos precios' }, { a: 'MOC-Sales', porque: 'es de ventas' }] } : nom === 'Idea de reel' ? { enlaces: [{ a: 'canal-meta', porque: 'sale por Meta' }] } : { enlaces: [] };
  return new Response(JSON.stringify(texto(JSON.stringify(r))), { status: 200 });
};

async function abrir({ ancho, rol = 'admin', memoria = null, notas = [] }) {
  const { d1, env } = await oficina({ conector: false }), { dir, semilla } = await semillaEnDisco(), pedidos = [];
  env.ASSETS = assetsDe(dir); env.__pruebas = { fetch: ia(pedidos) };
  await guardarNotas(d1, [...semilla.notas.map((n) => ({ nombre: n.nombre, grupo: n.grupo, oficina: 0, texto: n.texto, actualizado: 1000, tarea: null })),
    { nombre: 'Oferta de verano', grupo: 'Notas', oficina: 0, texto: '# Oferta de verano\n\nDescuento en los combos de la web, con los precios y plazos de entrega.', actualizado: 5000, tarea: null },
    { nombre: 'Idea de reel', grupo: 'Notas', oficina: 0, texto: 'Un reel del taller para Instagram.', actualizado: 5000, tarea: null },
    { nombre: XSS, grupo: 'Notas', oficina: 0, texto: 'Una nota con un nombre malicioso.', actualizado: 5000, tarea: null },
    ...notas.map((n) => ({ grupo: 'Notas', oficina: 0, actualizado: 5000, tarea: null, ...n }))]);
  if (memoria) await guardarDoc(d1, 'memoria', memoria); // lo que los agentes aprendieron del trabajo aprobado
  await guardarGrafo(d1, structuredClone(semilla.grafo)); d1._db.prepare('update grafo set calculado = ? where id = 1').run(new Date(2000).toISOString());
  if (rol !== 'admin') await sembrar(d1, { email: 'otro@panaclaw.test', rol });
  const { manejar } = await import('../worker/lib/rutas.js');
  const quien = rol === 'admin' ? { email: 'dueno@panaclaw.test', clave: 'una-clave-larga-123' } : { email: 'otro@panaclaw.test', clave: 'una-clave-larga-123' }; // secrets-ok
  const entrada = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: quien.email, contrasena: quien.clave }) }), env);
  const cookie = entrada.headers.get('set-cookie').split(';')[0];
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } }), p = await ctx.newPage(); const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.route('https://oficina.test/**', async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/') return r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: conNube(readFileSync(PAGINA, 'utf8')) });
    if (/^\/nube[\w-]*\.(js|css)$/.test(u.pathname)) return r.fulfill({ status: 200, headers: { 'content-type': TIPO[u.pathname.split('.').pop()] }, body: pub(u.pathname.slice(1)) });
    if (u.pathname === '/api/live') return r.abort();
    if (!u.pathname.startsWith('/api/')) return r.fulfill({ status: 404, body: 'no' });
    const resp = await manejar(new Request(u.href, { method: req.method(), headers: { 'content-type': 'application/json', cookie }, body: req.postData() || undefined }), env);
    return r.fulfill({ status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/json' }, body: await resp.text() });
  });
  await p.goto('https://oficina.test/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  return { p, ctx, d1, errores, pedidos, semilla };
}
const textoEnDb = (d1, nombre) => d1._db.prepare('select texto from notas where nombre = ?').get(nombre)?.texto;
const sinDesborde = (p) => p.evaluate(() => { const c = document.querySelector('#cxprueba'); return (!c || c.scrollWidth <= c.clientWidth + 1) && [...document.querySelectorAll('.cx, .cx *')].every((e) => e.getBoundingClientRect().right <= window.innerWidth + 1); });

test('escritorio (1280 px): el botón está en las herramientas del Cerebro y el recorrido completo funciona; lo que escribe cualquiera es texto', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, d1, errores, pedidos, semilla } = await abrir({ ancho: 1280 });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.()?.rol === 'admin', null, { timeout: 40000 });
  await p.click('#topBrain'); await p.waitForSelector('#brainOv .bv-tools .bv-cx', { timeout: 40000 });
  await p.click('.bv-cx'); await p.waitForSelector('.bv-pb .cx [data-a=proponer]', { timeout: 20000 });
  let cx = await p.textContent('.bv-pb .cx');
  assert.match(cx, /No corre solo/); assert.match(cx, /3 notas nuevas o cambiadas/); assert.match(cx, /Oferta de verano/); assert.match(cx, /notas de fábrica y las notas clave nunca se tocan/);
  assert.equal(await p.evaluate(() => window.__xss), undefined, 'un nombre con HTML no se ejecuta'); assert.match(cx, /Nota <img src=x onerror=window\.__xss=1> rara/, 'se ve como texto');
  assert.equal(await sinDesborde(p), true);
  // buscar con IA: avanza y llega a la revisión
  await p.click('[data-a=proponer]'); await p.waitForSelector('.cx [data-a=aplicar]', { timeout: 20000 });
  cx = await p.textContent('.cx'); assert.match(cx, /La IA propone enlaces para 2 notas/); assert.match(cx, /\[\[precios-webs\]\]/); assert.match(cx, /habla de los mismos precios/); assert.match(cx, /1 nota sin conexiones claras/);
  assert.equal(pedidos.length, 3, 'una llamada por nota (tres notas)');
  assert.equal(await p.locator('.cx input[type=checkbox]:checked').count(), 3);
  assert.match(await p.textContent('[data-a=aplicar]'), /Aplicar 3 conexiones/);
  // quitar una: el botón lo dice
  await p.locator('.cx-enl', { hasText: 'MOC-Sales' }).locator('input').uncheck();
  assert.match(await p.textContent('[data-a=aplicar]'), /Aplicar 2 conexiones/);
  const antes = await p.evaluate(() => fetch('/api/brain').then((r) => r.json()));
  await p.click('[data-a=aplicar]'); await p.waitForSelector('.cx [data-a=deshacer]', { timeout: 20000 });
  cx = await p.textContent('.cx'); assert.match(cx, /2 conexiones nuevas en 2 notas/); assert.match(cx, /Mapa al día/);
  assert.match(textoEnDb(d1, 'Oferta de verano'), /## Relacionadas\n\n- \[\[precios-webs\]\] — habla de los mismos precios\n$/); assert.doesNotMatch(textoEnDb(d1, 'Oferta de verano'), /MOC-Sales/, 'la que quité no se escribió');
  assert.match(textoEnDb(d1, 'Idea de reel'), /\[\[canal-meta\]\]/);
  assert.ok(semilla.notas.every((n) => textoEnDb(d1, n.nombre) === n.texto), 'ninguna nota de fábrica cambió');
  const despues = await p.evaluate(() => fetch('/api/brain').then((r) => r.json()));
  assert.equal(despues.nodes.find((n) => n.id === 'Oferta de verano').d, 1); assert.equal(despues.nodes.find((n) => n.id === 'precios-webs').d, antes.nodes.find((n) => n.id === 'precios-webs').d + 1);
  // el mapa de la página (el 3D) ya lo sabe: la ficha de la nota dice cuántas conexiones tiene
  assert.equal(await p.evaluate(() => document.querySelector('#brainOv') && !document.querySelector('#brainOv').hidden), true);
  // deshacer
  await p.click('[data-a=deshacer]'); await p.waitForFunction(() => /Deshecho en 2 notas/.test(document.querySelector('.cx')?.textContent || ''), null, { timeout: 20000 });
  assert.equal(textoEnDb(d1, 'Oferta de verano'), '# Oferta de verano\n\nDescuento en los combos de la web, con los precios y plazos de entrega.\n'); assert.doesNotMatch(textoEnDb(d1, 'Idea de reel'), /Relacionadas/);
  assert.deepEqual(errores, [], 'sin errores en la página');
  await ctx.close();
});

test('un editor no ve el botón (el servidor también lo niega)', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 1280, rol: 'editor' });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.(), null, { timeout: 40000 });
  await p.click('#topBrain'); await p.waitForSelector('#brainOv .bv-tools', { timeout: 40000 });
  assert.equal(await p.locator('.bv-cx').count(), 0, 'ni siquiera aparece');
  const estado = await p.evaluate(() => fetch('/api/brain/actualizar').then((r) => r.status)); assert.equal(estado, 403);
  await ctx.close();
});

for (const ancho of [320, 360, 390, 430]) {
  test(`teléfono (${ancho} px): el componente cabe, no desborda y cada botón mide 44 px o más, con letra de 16 px`, { skip: SALTAR }, async (t0) => {
    if (!nav) return t0.skip('sin Chromium');
    const { p, ctx, errores } = await abrir({ ancho });
    await p.waitForFunction(() => window.AO_NUBE?.yo?.()?.rol === 'admin', null, { timeout: 40000 });
    // la hoja del celular: el mismo componente dentro de un contenedor con `body.movil`
    await p.evaluate(() => { document.body.classList.add('movil'); const c = document.createElement('div'); c.id = 'cxprueba'; c.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#fff;padding:12px;z-index:9999'; document.body.appendChild(c); window.AO_NUBE.actualizarConexiones(c, { alGrafo: () => {} }); });
    await p.waitForSelector('#cxprueba .cx [data-a=proponer]', { timeout: 30000 });
    const medidas = async () => p.evaluate(() => [...document.querySelectorAll('#cxprueba button, #cxprueba summary, #cxprueba .cx-enl')].map((e) => ({ t: (e.textContent || '').trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height), f: parseFloat(getComputedStyle(e).fontSize) })));
    for (const m of await medidas()) { assert.ok(m.h >= 44, `«${m.t}» mide ${m.h} px`); if (m.t) assert.ok(m.f >= 15.9, `«${m.t}» tiene letra de ${m.f} px`); }
    assert.equal(await sinDesborde(p), true, 'sin scroll horizontal (resumen)');
    const chicas = await p.evaluate(() => [...document.querySelectorAll('#cxprueba .cx *')].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.textContent.trim().slice(0, 20)));
    assert.deepEqual(chicas, [], 'ningún texto bajo 11 px');
    await p.click('#cxprueba [data-a=proponer]'); await p.waitForSelector('#cxprueba [data-a=aplicar]', { timeout: 20000 });
    for (const m of await medidas()) assert.ok(m.h >= 44, `(revisión) «${m.t}» mide ${m.h} px`);
    assert.equal(await sinDesborde(p), true, 'sin scroll horizontal (revisión)');
    assert.equal(await p.locator('#cxprueba input[type=checkbox]').first().evaluate((e) => e.getBoundingClientRect().width >= 22), true, 'la casilla se toca con el dedo');
    assert.deepEqual(errores, []);
    await ctx.close();
  });
}

test('si no se puede traer el actualizador, se dice en palabras y se puede reintentar', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 1280 });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.(), null, { timeout: 40000 });
  await p.route('https://oficina.test/nube-cerebro.js', (r) => r.abort());
  await p.evaluate(() => { const c = document.createElement('div'); c.id = 'cxfalla'; c.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;padding:12px'; document.body.appendChild(c); window.AO_NUBE.actualizarConexiones(c, {}); });
  await p.waitForSelector('#cxfalla [data-reintentar]', { timeout: 20000 });
  assert.match(await p.textContent('#cxfalla'), /No pude traer el actualizador/);
  await p.unroute('https://oficina.test/nube-cerebro.js'); await p.route('https://oficina.test/nube-cerebro.js', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: pub('nube-cerebro.js') }));
  await p.click('#cxfalla [data-reintentar]'); await p.waitForSelector('#cxfalla .cx [data-a=proponer]', { timeout: 20000 });
  await ctx.close();
});

const USADAS = () => memoriaCon([['Oferta de verano', 'precios-webs', 0.45, 3]]);

test('las parejas que los agentes usaron juntas se ofrecen gratis: se ven, se eligen y se escriben sin llamar a la IA', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, d1, errores, pedidos, semilla } = await abrir({ ancho: 1280, memoria: USADAS() });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.()?.rol === 'admin', null, { timeout: 40000 });
  await p.click('#topBrain'); await p.waitForSelector('#brainOv .bv-tools .bv-cx', { timeout: 40000 });
  await p.click('.bv-cx'); await p.waitForSelector('.bv-pb .cx [data-a=uso]', { timeout: 20000 });
  let cx = await p.textContent('.bv-pb .cx');
  assert.match(cx, /3 · Notas que tus agentes usan juntas/); assert.match(cx, /1 pareja de notas que tus agentes usaron juntas/); assert.match(cx, /«Oferta de verano» y «precios-webs»/); assert.match(cx, /3 trabajos/);
  await p.click('[data-a=uso]'); await p.waitForSelector('.cx [data-a=aplicar]', { timeout: 20000 });
  cx = await p.textContent('.cx'); assert.match(cx, /Tus agentes usaron juntas estas notas/); assert.match(cx, /\[\[precios-webs\]\]/); assert.match(cx, /3 trabajos que salieron bien/);
  assert.equal(await p.locator('.cx input[type=checkbox]:checked').count(), 1); assert.match(await p.textContent('[data-a=aplicar]'), /Aplicar 1 conexión/);
  await p.click('[data-a=aplicar]'); await p.waitForSelector('.cx [data-a=deshacer]', { timeout: 20000 });
  assert.match(await p.textContent('.cx'), /1 conexión nueva en 1 nota/);
  assert.match(textoEnDb(d1, 'Oferta de verano'), /## Relacionadas\n\n- \[\[precios-webs\]\] — los agentes las usaron juntas en 3 trabajos que salieron bien\n$/);
  assert.equal(pedidos.length, 0, 'ni una llamada a la IA: es lo que ya pasó');
  assert.ok(semilla.notas.every((n) => textoEnDb(d1, n.nombre) === n.texto), 'ninguna nota de fábrica cambió');
  assert.deepEqual(errores, []);
  await ctx.close();
});

test('teléfono (390 px): la sección de parejas usadas cabe, sus botones miden 44 px y la letra 16 px', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 390, memoria: USADAS() });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.()?.rol === 'admin', null, { timeout: 40000 });
  await p.evaluate(() => { document.body.classList.add('movil'); const c = document.createElement('div'); c.id = 'cxprueba'; c.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#fff;padding:12px;z-index:9999'; document.body.appendChild(c); window.AO_NUBE.actualizarConexiones(c, { alGrafo() {}, alCerrar() {} }); });
  await p.waitForSelector('#cxprueba .cx [data-a=uso]', { timeout: 30000 });
  const b = await p.locator('#cxprueba [data-a=uso]').evaluate((e) => ({ h: e.getBoundingClientRect().height, f: parseFloat(getComputedStyle(e).fontSize) }));
  assert.ok(b.h >= 44 && b.f >= 15.9, JSON.stringify(b)); assert.equal(await sinDesborde(p), true);
  await ctx.close();
});

test('reacomodar el mapa entero desde el panel: se calcula, se ve el resultado, el mapa de la página cambia y se puede volver al anterior', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, d1, errores, semilla } = await abrir({ ancho: 1280 });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.()?.rol === 'admin', null, { timeout: 40000 });
  await p.click('#topBrain'); await p.waitForSelector('#brainOv .bv-tools .bv-cx', { timeout: 40000 });
  await p.click('.bv-cx'); await p.waitForSelector('.bv-pb .cx [data-a=mapa]', { timeout: 20000 });
  let cx = await p.textContent('.bv-pb .cx'); assert.match(cx, /4 · Reacomodar todo el mapa/); assert.match(cx, /Todas las neuronas pueden moverse/); assert.match(cx, /Las notas no se tocan/);
  const antes = await p.evaluate(() => fetch('/api/brain').then((r) => r.json()));
  await p.click('[data-a=mapa]'); await p.waitForSelector('.cx [data-a=mapa-deshacer]', { timeout: 60000 });
  cx = await p.textContent('.cx'); assert.match(cx, /Mapa recalculado: 62 neuronas/); assert.doesNotMatch(cx, /cálculo de reserva/);
  const despues = await p.evaluate(() => fetch('/api/brain').then((r) => r.json()));
  assert.equal(despues.nodes.length, antes.nodes.length); assert.ok(despues.nodes.some((n) => { const a = antes.nodes.find((x) => x.id === n.id); return a && (a.x !== n.x || a.y !== n.y); }), 'las neuronas se reacomodaron');
  assert.ok(semilla.notas.every((n) => textoEnDb(d1, n.nombre) === n.texto), 'ninguna nota cambió');
  await p.click('[data-a=mapa-deshacer]'); await p.waitForFunction(() => /Volví al mapa anterior/.test(document.querySelector('.cx')?.textContent || ''), null, { timeout: 30000 });
  const vuelta = await p.evaluate(() => fetch('/api/brain').then((r) => r.json()));
  for (const a of antes.nodes) { const v = vuelta.nodes.find((x) => x.id === a.id); assert.deepEqual([v.x, v.y], [a.x, a.y], `«${a.id}» volvió a su sitio`); }
  assert.deepEqual(errores, [], 'sin errores en la página');
  await ctx.close();
});

test('teléfono (390 px): el botón de reacomodar el mapa mide 44 px y cabe', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 390 });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.()?.rol === 'admin', null, { timeout: 40000 });
  await p.evaluate(() => { document.body.classList.add('movil'); const c = document.createElement('div'); c.id = 'cxprueba'; c.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#fff;padding:12px;z-index:9999'; document.body.appendChild(c); window.AO_NUBE.actualizarConexiones(c, { alGrafo() {}, alCerrar() {} }); });
  await p.waitForSelector('#cxprueba .cx [data-a=mapa]', { timeout: 30000 });
  const b = await p.locator('#cxprueba [data-a=mapa]').evaluate((e) => ({ h: e.getBoundingClientRect().height, f: parseFloat(getComputedStyle(e).fontSize) }));
  assert.ok(b.h >= 44 && b.f >= 15.9, JSON.stringify(b)); assert.equal(await sinDesborde(p), true);
  await ctx.close();
});

const CONTRADICE = [{ nombre: 'Precios 2026', texto: 'PanaClaw Corporate cuesta $950, con hasta 10 páginas, blog y dominio incluido, entrega en 8–12 días.' }];

test('notas repetidas o que se contradicen: se buscan gratis, la de fábrica manda, la IA confirma con tu clic y «ya lo revisé» lo quita', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx, d1, errores, pedidos, semilla } = await abrir({ ancho: 1280, notas: CONTRADICE });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.()?.rol === 'admin', null, { timeout: 40000 });
  await p.click('#topBrain'); await p.waitForSelector('#brainOv .bv-tools .bv-cx', { timeout: 40000 });
  await p.click('.bv-cx'); await p.waitForSelector('.bv-pb .cx [data-a=calidad]', { timeout: 20000 });
  assert.match(await p.textContent('.bv-pb .cx'), /5 · Notas repetidas o que se contradicen/);
  const antes = pedidos.length;
  await p.click('[data-a=calidad]'); await p.waitForSelector('.cx [data-a=cal-ign]', { timeout: 30000 });
  let cx = await p.textContent('.cx'); assert.match(cx, /1 posible contradicción/); assert.match(cx, /«Precios 2026» frente a «precios-webs»|«precios-webs» frente a «Precios 2026»/); assert.match(cx, /\$950 frente a \$850|\$850 frente a \$950/);
  assert.match(cx, /La nota de fábrica «precios-webs» manda: corrige «Precios 2026»/); assert.equal(pedidos.length, antes, 'buscar es gratis: no llama a la IA'); assert.match(cx, /Pedirle a la IA|puede confirmar/);
  await p.click('[data-a=cal-ia]'); await p.waitForFunction(() => /La IA: sí se contradicen/.test(document.querySelector('.cx')?.textContent || ''), null, { timeout: 30000 });
  cx = await p.textContent('.cx'); assert.match(cx, /El precio de Corporate no coincide/); assert.equal(pedidos.length, antes + 1, 'una llamada por aviso');
  await p.click('[data-a=cal-ign]'); await p.waitForFunction(() => /No encontré notas repetidas/.test(document.querySelector('.cx')?.textContent || ''), null, { timeout: 20000 });
  assert.match(await p.textContent('.cx'), /Dejé fuera 1 aviso que ya revisaste/);
  assert.ok(semilla.notas.every((n) => textoEnDb(d1, n.nombre) === n.texto), 'ninguna nota de fábrica cambió'); assert.match(textoEnDb(d1, 'Precios 2026'), /\$950/, 'y la tuya tampoco: solo avisa');
  assert.deepEqual(errores, []);
  await ctx.close();
});

test('teléfono (390 px): la sección de notas repetidas y su resultado caben, con botones de 44 px y letra de 16 px', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 390, notas: CONTRADICE });
  await p.waitForFunction(() => window.AO_NUBE?.yo?.()?.rol === 'admin', null, { timeout: 40000 });
  await p.evaluate(() => { document.body.classList.add('movil'); const c = document.createElement('div'); c.id = 'cxprueba'; c.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#fff;padding:12px;z-index:9999'; document.body.appendChild(c); window.AO_NUBE.actualizarConexiones(c, { alGrafo() {}, alCerrar() {} }); });
  await p.waitForSelector('#cxprueba .cx [data-a=calidad]', { timeout: 30000 });
  await p.click('#cxprueba [data-a=calidad]'); await p.waitForSelector('#cxprueba [data-a=cal-ign]', { timeout: 30000 });
  const medidas = await p.evaluate(() => [...document.querySelectorAll('#cxprueba button')].map((e) => ({ t: e.textContent.trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height), f: parseFloat(getComputedStyle(e).fontSize) })));
  for (const m of medidas) assert.ok(m.h >= 44 && m.f >= 15.9, `«${m.t}» mide ${m.h} px con letra de ${m.f}`);
  assert.equal(await sinDesborde(p), true);
  const chicas = await p.evaluate(() => [...document.querySelectorAll('#cxprueba .cx *')].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => e.textContent.trim().slice(0, 20)));
  assert.deepEqual(chicas, [], 'ningún texto bajo 11 px');
  await ctx.close();
});
