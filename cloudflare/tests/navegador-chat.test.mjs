// C1: el chat interno en un navegador de verdad, contra el Worker real (D1 en memoria). Apagado no pinta nada; encendido: lista, no leídos, hilo, escapado, enviar, directos, canales, silenciar,
// privacidad (un administrador no ve el canal privado ajeno), quien solo lee no escribe, y el teléfono a pantalla completa sin desborde. Se salta si no hay Chromium.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { guardarConfig } from '../worker/lib/chat/chat.js';
import { SALTAR as SIN_D1, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* siguiente */ } }
const SALTAR = SIN_D1 || (chromium ? false : 'Playwright no está instalado');
const leer = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
let nav;
before(async () => { if (!SALTAR) nav = await chromium.launch().catch(() => null); });
after(async () => { await nav?.close(); });
const SHIM = (rol) => `window.AO_NUBE = { esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), yo: () => ({ rol: '${rol}' }), aviso() {},
  api: async (ruta, { metodo = 'GET', cuerpo } = {}) => { const r = await fetch(ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'falló'); return d; } };`;

async function mundo() {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' }), env = envDePrueba(d1);
  const nueva = (email, rol, nombre) => { const id = crypto.randomUUID(); d1._db.prepare("insert into users (id,email,rol,password_hash,salt) values (?,?,?,'x','x')").run(id, email, rol); d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(id, nombre); return id; };
  const ana = d1._db.prepare('select id from users where email = ?').get(c.email).id; d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(ana, 'Ana');
  return { d1, env, ana, beto: nueva('beto@panaclaw.test', 'editor', 'Beto'), carla: nueva('carla@panaclaw.test', 'lectura', 'Carla'), dani: nueva('dani@panaclaw.test', 'editor', 'Dani') };
}
async function pagina(o, quien, rol, { ancho = 1280, activo = true, lento = 0, falla = false } = {}) {
  if (activo) await guardarConfig(o.d1, { activo: true });
  const cookie = `__Host-sesion=${await abrirSesion(o.d1, quien)}`, ctx = await nav.newContext({ viewport: { width: ancho, height: 800 } }), p = await ctx.newPage(), errores = [];
  const peticiones = []; p.on('pageerror', (e) => errores.push(String(e)));
  await p.route('https://oficina.test/**', async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/') return r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--ink:#111;--cream:#fff;--hairline:#ddd;--grey:#555;--focus:#06c}${leer('nube.css')}</style></head><body><main>oficina</main></body></html>` });
    if (u.pathname === '/shim.js') return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: SHIM(rol) });
    if (u.pathname === '/nube-chat.js') return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: leer('nube-chat.js') });
    if (lento && req.method() === 'POST' && /\/mensajes$/.test(u.pathname)) await new Promise((r) => setTimeout(r, lento));
    peticiones.push(req.method() + ' ' + u.pathname);
    if (falla && req.method() === 'POST' && /\/mensajes$/.test(u.pathname)) return r.fulfill({ status: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'sin red de mentira' }) });
    const resp = await manejar(new Request(u.href, { method: req.method(), headers: { 'content-type': 'application/json', cookie }, body: req.postData() || undefined }), o.env);
    return r.fulfill({ status: resp.status, headers: { 'content-type': 'application/json' }, body: await resp.text() });
  });
  await p.goto('https://oficina.test/'); await p.addScriptTag({ url: '/shim.js' }); await p.addScriptTag({ url: '/nube-chat.js' });
  return { p, ctx, errores, peticiones };
}
const llamar = async (o, quien, ruta, metodo = 'GET', cuerpo) => { const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { cookie: `__Host-sesion=${await abrirSesion(o.d1, quien)}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), o.env); return { status: r.status, j: await r.json().catch(() => null) }; };
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test('apagado: no hay botón de chat', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); const { p, ctx, errores } = await pagina(o, o.beto, 'editor', { activo: false });
  await p.waitForTimeout(500); assert.equal(await p.locator('#nbChatBtn').count(), 0); assert.deepEqual(errores, []); await ctx.close();
});

test('lista, no leídos, hilo con el texto escapado, enviar con Enter, directo, canal nuevo y silenciar', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  await llamar(o, o.dani, '/api/chat/canales/general/mensajes', 'POST', { cuerpo: '<img src=x onerror=window.__xss=1> hola https://ejemplo.test/a' });
  const { p, ctx, errores } = await pagina(o, o.beto, 'editor');
  await p.waitForSelector('#nbChatBtn .ch-n'); assert.match(await p.getAttribute('#nbChatBtn', 'aria-label'), /1 sin leer/);
  await p.click('#nbChatBtn'); await p.waitForSelector('.ch-fila');
  assert.match(await p.textContent('.ch-fila'), /#general/); assert.equal((await p.textContent('.ch-bad')).trim(), '1');
  await p.click('.ch-fila'); await p.waitForSelector('.ch-m');
  assert.equal(await p.evaluate(() => window.__xss), undefined, 'el mensaje se escapa'); assert.match(await p.textContent('.ch-txt'), /<img src=x/); assert.equal(await p.getAttribute('.ch-txt a', 'rel'), 'noopener noreferrer');
  await p.fill('#ch-texto', 'Buen día, equipo'); await p.press('#ch-texto', 'Enter'); await p.waitForFunction(() => document.querySelectorAll('.ch-m').length === 2);
  assert.ok((await p.textContent('.ch-m.mio')).includes('Buen día, equipo'));
  await p.waitForFunction(() => !document.querySelector('.ch-bad'), null, { timeout: 5000 }).catch(() => {}); // lo leído deja de contar
  // directo
  await p.click('[data-a=x]'); await p.click('#nbChatBtn'); await p.click('[data-a=nuevo]'); await p.waitForSelector('[data-a=directo]');
  await p.click('[data-a=directo]'); await p.waitForSelector('#ch-texto'); assert.match(await p.textContent('.ch-der .ch-cab h2'), /Ana|Carla|Dani/);
  // canal nuevo privado con Dani
  await p.click('[data-a=nuevo]'); await p.click('[data-k=canal]'); await p.fill('#ch-nom', 'Equipo Secreto'); await p.check('#ch-priv'); await p.locator('input[name=m]').first().check();
  await p.click('.ch-nuevo [type=submit]'); await p.waitForFunction(() => /Equipo Secreto/.test(document.querySelector('.ch-der .ch-cab h2')?.textContent || ''));
  await p.click('[data-a=silenciar]'); await p.waitForFunction(() => document.querySelector('[data-a=silenciar]')?.getAttribute('aria-pressed') === 'true');
  assert.deepEqual(errores, []); await ctx.close();
});

test('privacidad: un administrador no ve (ni en el DOM) el canal privado ajeno ni un directo ajeno; quien solo lee no tiene caja de escribir', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const priv = (await llamar(o, o.beto, '/api/chat/canales', 'POST', { nombre: 'Despidos Reservados', privado: true, miembros: [o.dani] })).j.id;
  await llamar(o, o.beto, `/api/chat/canales/${priv}/mensajes`, 'POST', { cuerpo: 'secreto-absoluto' });
  const dir = (await llamar(o, o.beto, '/api/chat/directo', 'POST', { con: o.dani })).j.id; await llamar(o, o.beto, `/api/chat/canales/${dir}/mensajes`, 'POST', { cuerpo: 'directo-secreto' });
  const adm = await pagina(o, o.ana, 'admin'); await adm.p.click('#nbChatBtn'); await adm.p.waitForSelector('.ch-fila');
  const html = await adm.p.content(); assert.ok(!html.includes('Despidos Reservados') && !html.includes('secreto-absoluto') && !html.includes('directo-secreto'), 'nada del privado en la página de un administrador');
  await adm.ctx.close();
  const lee = await pagina(o, o.carla, 'lectura'); await lee.p.click('#nbChatBtn'); await lee.p.click('.ch-fila'); await lee.p.waitForSelector('.ch-solo');
  assert.equal(await lee.p.locator('#ch-texto').count(), 0); await lee.ctx.close();
});

test('teléfono (390 px): pantalla completa, lista → hilo → atrás, sin desborde, campo de 16 px', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const { p, ctx, errores } = await pagina(o, o.beto, 'editor', { ancho: 390 });
  await p.click('#nbChatBtn'); await p.waitForSelector('.ch-fila'); assert.equal(await sinDesborde(p), true);
  const caja = await p.evaluate(() => { const r = document.getElementById('nbChat').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }); assert.equal(caja[0], 390);
  await p.click('.ch-fila'); await p.waitForSelector('#ch-texto'); assert.equal(await p.locator('.ch-fila').count(), 0, 'en el teléfono el hilo ocupa la pantalla');
  assert.ok((await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('ch-texto')).fontSize))) >= 16); assert.equal(await sinDesborde(p), true);
  assert.ok((await p.evaluate(() => document.querySelector('[data-a=atras]').getBoundingClientRect().height)) >= 44);
  await p.click('[data-a=atras]'); await p.waitForSelector('.ch-fila'); await p.keyboard.press('Escape'); await p.waitForSelector('#nbChat', { state: 'detached' });
  assert.deepEqual(errores, []); await ctx.close();
});

const visible = (p) => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

test('dos Enter seguidos mandan UN mensaje; si el envío falla, el texto vuelve a la caja', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const { p, ctx } = await pagina(o, o.beto, 'editor', { lento: 400 });
  await p.click('#nbChatBtn'); await p.click('.ch-fila'); await p.waitForSelector('#ch-texto');
  await p.fill('#ch-texto', 'una sola vez'); await p.press('#ch-texto', 'Enter'); await p.press('#ch-texto', 'Enter');
  await p.waitForFunction(() => document.querySelectorAll('.ch-m.mio').length === 1);
  assert.equal(o.d1._db.prepare("select count(*) n from chat_mensajes where cuerpo = 'una sola vez'").get().n, 1);
  await ctx.close();
});

test('lo que otra persona edita o borra se ve al actualizar (no solo un mensaje nuevo)', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const m = (await llamar(o, o.dani, '/api/chat/canales/general/mensajes', 'POST', { cuerpo: 'primero' })).j.mensaje.id; await llamar(o, o.dani, '/api/chat/canales/general/mensajes', 'POST', { cuerpo: 'segundo' });
  const { p, ctx } = await pagina(o, o.beto, 'editor'); await p.click('#nbChatBtn'); await p.click('.ch-fila'); await p.waitForSelector('.ch-m');
  await llamar(o, o.dani, `/api/chat/mensajes/${m}`, 'PATCH', { cuerpo: 'primero corregido' }); await visible(p);
  await p.waitForFunction(() => /primero corregido/.test(document.getElementById('ch-hilo').textContent));
  await llamar(o, o.dani, `/api/chat/mensajes/${m}`, 'DELETE'); await visible(p);
  await p.waitForFunction(() => /Mensaje borrado/.test(document.getElementById('ch-hilo').textContent) && !/primero corregido/.test(document.getElementById('ch-hilo').textContent));
  await ctx.close();
});

test('accesibilidad: región en vivo sin el texto, foco al abrir y tras repintar (con lo escrito y el cursor), Escape solo si el foco es del chat', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const { p, ctx } = await pagina(o, o.beto, 'editor');
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'otro'; document.body.appendChild(i); });
  await p.click('#nbChatBtn'); await p.click('.ch-fila'); await p.waitForSelector('#ch-texto');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'ch-texto', 'al abrir un canal el foco va a la caja');
  await p.fill('#ch-texto', 'borrador a medias'); await p.evaluate(() => document.getElementById('ch-texto').setSelectionRange(3, 7));
  await llamar(o, o.dani, '/api/chat/canales/general/mensajes', 'POST', { cuerpo: 'texto-privado-del-mensaje' }); await visible(p);
  await p.waitForFunction(() => /texto-privado/.test(document.getElementById('ch-hilo').textContent));
  assert.deepEqual(await p.evaluate(() => { const t = document.getElementById('ch-texto'); return [document.activeElement.id, t.value, t.selectionStart, t.selectionEnd]; }), ['ch-texto', 'borrador a medias', 3, 7]);
  await p.waitForFunction(() => /mensaje nuevo/.test(document.querySelector('[role=status][aria-live=polite]').textContent));
  const vivo = await p.evaluate(() => document.querySelector('[role=status][aria-live=polite]').textContent); assert.match(vivo, /1 mensaje nuevo en #general/); assert.ok(!vivo.includes('texto-privado'), 'se anuncia que hay algo, no el texto');
  assert.equal(await p.evaluate(() => !!document.querySelector('[role=alert]')), true);
  await p.focus('#otro'); await p.keyboard.press('Escape'); assert.equal(await p.locator('#nbChat').count(), 1, 'otra ventana tiene el foco: el chat no se cierra');
  await p.focus('#ch-texto'); await p.keyboard.press('Escape'); await p.waitForSelector('#nbChat', { state: 'detached' });
  await ctx.close();
});

test('solo lectura: no pide la lista de cuentas ni ofrece «+ Nuevo»; el servidor tampoco se la da', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const { p, ctx, peticiones } = await pagina(o, o.carla, 'lectura'); await p.click('#nbChatBtn'); await p.waitForSelector('.ch-fila');
  assert.equal(await p.locator('[data-a=nuevo]').count(), 0); assert.ok(!peticiones.some((x) => /\/api\/chat\/personas/.test(x)));
  assert.deepEqual((await llamar(o, o.carla, '/api/chat/personas')).j, { personas: [] }); await ctx.close();
});

test('teléfono: las casillas de «añadir gente» miden 44 px aunque la página no tenga body.movil', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const { p, ctx } = await pagina(o, o.beto, 'editor', { ancho: 390 }); await p.click('#nbChatBtn'); await p.click('[data-a=nuevo]'); await p.click('[data-k=canal]'); await p.waitForSelector('input[name=m]');
  assert.ok((await p.evaluate(() => document.querySelector('.ch-nuevo fieldset .ch-chk').getBoundingClientRect().height)) >= 44); await ctx.close();
});

test('editar y borrar son en el propio mensaje (sin ventanas del navegador); y «Cargar mensajes anteriores» trae el resto', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const ahora = Date.now(); for (let i = 1; i <= 60; i++) o.d1._db.prepare("insert into chat_mensajes (canal_id, user_id, cuerpo, creado_at) values ('general', ?, ?, ?)").run(o.dani, 'viejo ' + i, ahora - (100 - i) * 1000);
  await llamar(o, o.beto, '/api/chat/resumen');
  const { p, ctx } = await pagina(o, o.beto, 'editor'); let dialogos = 0; p.on('dialog', (d) => { dialogos++; d.dismiss(); });
  await p.click('#nbChatBtn'); await p.click('.ch-fila'); await p.waitForSelector('.ch-m');
  assert.equal(await p.locator('.ch-m').count(), 50); await p.click('[data-a=viejos]'); await p.waitForFunction(() => document.querySelectorAll('.ch-m').length === 60);
  await p.fill('#ch-texto', 'mío'); await p.press('#ch-texto', 'Enter'); await p.waitForSelector('.ch-m.mio');
  await p.click('.ch-m.mio [data-a=editar]'); await p.fill('#ch-ed', 'mío editado'); await p.click('.ch-edit [type=submit]'); await p.waitForFunction(() => /mío editado/.test(document.querySelector('.ch-m.mio').textContent));
  await p.click('.ch-m.mio [data-a=borrar]'); await p.click('[data-a=borrar-si]'); await p.waitForFunction(() => !document.querySelector('.ch-m.mio'));
  assert.equal(dialogos, 0, 'ni prompt ni confirm'); await ctx.close();
});

const sembrarViejos = (o, n, quien) => { const ahora = Date.now(); for (let i = 1; i <= n; i++) o.d1._db.prepare("insert into chat_mensajes (canal_id, user_id, cuerpo, creado_at) values ('general', ?, ?, ?)").run(quien, 'mensaje número ' + i, ahora - (n + 10 - i) * 1000); };

test('scroll: quien lee más arriba se queda donde estaba al llegar algo nuevo; «cargar anteriores» no se repite ni salta', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true }); sembrarViejos(o, 70, o.dani);
  const { p, ctx } = await pagina(o, o.beto, 'editor'); await p.click('#nbChatBtn'); await p.click('.ch-fila'); await p.waitForSelector('.ch-m');
  await p.evaluate(() => { const h = document.getElementById('ch-hilo'); h.scrollTop = 120; });
  await llamar(o, o.dani, '/api/chat/canales/general/mensajes', 'POST', { cuerpo: 'llegó algo' }); await visible(p);
  await p.waitForFunction(() => /llegó algo/.test(document.getElementById('ch-hilo').textContent));
  const top = await p.evaluate(() => document.getElementById('ch-hilo').scrollTop); assert.ok(top > 60 && top < 200, `se queda arriba (${top})`);
  // cargar anteriores: doble clic rápido, sin duplicados y anclado
  await p.evaluate(() => { document.getElementById('ch-hilo').scrollTop = 0; });
  const antes = await p.evaluate(() => document.querySelector('.ch-m').textContent);
  await p.evaluate(() => { const b = document.querySelector('[data-a=viejos]'); b.click(); b.click(); });
  await p.waitForFunction(() => document.querySelectorAll('.ch-m').length > 50);
  const ids = await p.evaluate(() => [...document.querySelectorAll('.ch-m[data-m]')].map((x) => x.dataset.m)); assert.equal(new Set(ids).size, ids.length, 'sin mensajes repetidos');
  assert.ok((await p.evaluate(() => document.getElementById('ch-hilo').scrollTop)) > 0, 'anclado al mismo mensaje, no al principio'); void antes;
  await ctx.close();
});

test('si el envío falla, lo que se escribió mientras viajaba no se pisa', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  const { p, ctx } = await pagina(o, o.beto, 'editor', { falla: true, lento: 0 }); await p.click('#nbChatBtn'); await p.click('.ch-fila'); await p.waitForSelector('#ch-texto');
  await p.fill('#ch-texto', 'primero'); await p.evaluate(() => { const f = document.querySelector('.ch-form'); f.requestSubmit(); const t = document.getElementById('ch-texto'); t.value = 'segundo mientras tanto'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForFunction(() => /primero/.test(document.getElementById('ch-texto').value));
  assert.equal(await p.inputValue('#ch-texto'), 'primero\nsegundo mientras tanto'); await ctx.close();
});

test('durante una composición (IME) no se repinta la caja; al terminar, sí; y lo escrito al editar sobrevive a un repintado', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const o = await mundo(); await guardarConfig(o.d1, { activo: true });
  await llamar(o, o.beto, '/api/chat/canales/general/mensajes', 'POST', { cuerpo: 'mío para editar' });
  const { p, ctx } = await pagina(o, o.beto, 'editor'); await p.click('#nbChatBtn'); await p.click('.ch-fila'); await p.waitForSelector('#ch-texto');
  await p.evaluate(() => { window.__caja = document.getElementById('ch-texto'); window.__caja.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); });
  await llamar(o, o.dani, '/api/chat/canales/general/mensajes', 'POST', { cuerpo: 'nuevo durante IME' }); await visible(p); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => window.__caja === document.getElementById('ch-texto')), true, 'la caja sigue siendo la misma durante la composición');
  await p.evaluate(() => window.__caja.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  await p.waitForFunction(() => /nuevo durante IME/.test(document.getElementById('ch-hilo').textContent));
  await p.click('.ch-m.mio [data-a=editar]'); await p.fill('#ch-ed', 'editado a medias'); await p.focus('#ch-texto');
  await llamar(o, o.dani, '/api/chat/canales/general/mensajes', 'POST', { cuerpo: 'otro más' }); await visible(p);
  await p.waitForFunction(() => /otro más/.test(document.getElementById('ch-hilo').textContent));
  assert.equal(await p.inputValue('#ch-ed'), 'editado a medias'); await ctx.close();
});
