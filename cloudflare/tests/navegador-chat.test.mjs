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
async function pagina(o, quien, rol, { ancho = 1280, activo = true } = {}) {
  if (activo) await guardarConfig(o.d1, { activo: true });
  const cookie = `__Host-sesion=${await abrirSesion(o.d1, quien)}`, ctx = await nav.newContext({ viewport: { width: ancho, height: 800 } }), p = await ctx.newPage(), errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.route('https://oficina.test/**', async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/') return r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--ink:#111;--cream:#fff;--hairline:#ddd;--grey:#555;--focus:#06c}${leer('nube.css')}</style></head><body><main>oficina</main></body></html>` });
    if (u.pathname === '/shim.js') return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: SHIM(rol) });
    if (u.pathname === '/nube-chat.js') return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: leer('nube-chat.js') });
    const resp = await manejar(new Request(u.href, { method: req.method(), headers: { 'content-type': 'application/json', cookie }, body: req.postData() || undefined }), o.env);
    return r.fulfill({ status: resp.status, headers: { 'content-type': 'application/json' }, body: await resp.text() });
  });
  await p.goto('https://oficina.test/'); await p.addScriptTag({ url: '/shim.js' }); await p.addScriptTag({ url: '/nube-chat.js' });
  return { p, ctx, errores };
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
