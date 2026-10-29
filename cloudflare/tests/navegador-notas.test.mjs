// N1: la campanita y la hoja «Mientras no estabas» en un navegador de verdad, contra el Worker real (D1 en memoria). Flag apagado: no pinta nada; encendido: cuenta, abre, cierra, deja una nota.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { guardarConfig } from '../worker/lib/notas-personales.js';
import { SALTAR as SIN_D1, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* siguiente */ } }
const SALTAR = SIN_D1 || (chromium ? false : 'Playwright no está instalado');
const leer = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
let nav;
before(async () => { if (!SALTAR) nav = await chromium.launch().catch(() => null); });
after(async () => { await nav?.close(); });
const SHIM = `window.AO_NUBE = { esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), yo: () => ({ rol: 'editor' }), aviso() {},
  api: async (ruta, { metodo = 'GET', cuerpo } = {}) => { const r = await fetch(ruta, { method: metodo, headers: { 'content-type': 'application/json' }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'falló'); return d; } };`;

async function abrir({ activa, ancho = 1280 }) {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' }), env = envDePrueba(d1);
  const nueva = (email, rol, nombre) => { const id = crypto.randomUUID(); d1._db.prepare("insert into users (id,email,rol,password_hash,salt) values (?,?,?,'x','x')").run(id, email, rol); d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(id, nombre); return id; };
  const ana = d1._db.prepare('select id from users where email = ?').get(c.email).id; d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(ana, 'Ana');
  const beto = nueva('beto@panaclaw.test', 'editor', 'Beto');
  if (activa) await guardarConfig(d1, { activo: true });
  const cookie = `__Host-sesion=${await abrirSesion(d1, beto)}`;
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 800 } }), p = await ctx.newPage(), errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.route('https://oficina.test/**', async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/') return r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--ink:#111;--cream:#fff;--hairline:#ddd;--grey:#555;--focus:#06c}${leer('nube.css')}</style></head><body><main>oficina</main></body></html>` });
    if (u.pathname === '/shim.js') return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: SHIM });
    if (u.pathname === '/nube-notas.js') return r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: leer('nube-notas.js') });
    const resp = await manejar(new Request(u.href, { method: req.method(), headers: { 'content-type': 'application/json', cookie }, body: req.postData() || undefined }), env);
    return r.fulfill({ status: resp.status, headers: { 'content-type': 'application/json' }, body: await resp.text() });
  });
  await p.goto('https://oficina.test/'); await p.addScriptTag({ url: '/shim.js' }); await p.addScriptTag({ url: '/nube-notas.js' });
  return { p, ctx, d1, ana, beto, errores };
}
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test('flag apagado: la campanita no existe', { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const { p, ctx, errores } = await abrir({ activa: false });
  await p.waitForTimeout(600);
  assert.equal(await p.locator('#nbCampana').count(), 0); assert.deepEqual(errores, []); await ctx.close();
});

for (const ancho of [390, 1280]) test(`encendido a ${ancho} px: cuenta lo nuevo, abre la hoja, escapa el texto, cierra la nota y deja otra`, { skip: SALTAR }, async (t) => {
  if (!nav) return t.skip('sin Chromium');
  const { p, ctx, d1, ana, beto, errores } = await abrir({ activa: true, ancho });
  d1._db.prepare("insert into notas_personales (id, de_user_id, para_tipo, para_valor, cuerpo, color, enlace, creada_at, vence_at) values ('00000001-aaaa', ?, 'persona', ?, ?, 'rosa', 'tarea:t1', ?, ?)").run(ana, beto, '<img src=x onerror=window.__xss=1> hola', Date.now(), Date.now() + 1e9);
  await p.evaluate(() => window.AO_NUBE.notas.recargar());
  await p.waitForSelector('#nbCampana .nt-n'); assert.equal((await p.textContent('#nbCampana .nt-n')).trim(), '1');
  assert.match(await p.getAttribute('#nbCampana', 'aria-label'), /1 sin leer/);
  await p.click('#nbCampana'); await p.waitForSelector('#nbNotas .nt-nota');
  assert.equal(await p.evaluate(() => window.__xss), undefined, 'el texto de la nota se escapa');
  assert.match(await p.textContent('#nbNotas .nt-cuerpo'), /<img src=x/);
  assert.equal(await sinDesborde(p), true);
  await p.waitForSelector('#nt-para option[value^="persona:"]', { state: 'attached' });
  assert.equal(await p.locator('#nt-para option[value="todos"]').count(), 1, 'un editor puede escribir a todos');
  await p.fill('#nt-texto', 'Gracias, ya lo vi'); await p.selectOption('#nt-para', `persona:${ana}`); await p.click('#nbNotas button[type=submit]');
  await p.waitForFunction(() => /Nota dejada/.test(document.querySelector('#nbNotas .nb-msg')?.textContent || ''));
  assert.equal(d1._db.prepare("select count(*) n from notas_personales where de_user_id = ?").get(beto).n, 1);
  await p.click('#nbNotas [data-a=cerrar]'); await p.waitForSelector('#nbNotas .nt-vacio');
  assert.equal(await p.locator('#nbCampana .nt-n').count(), 0);
  await p.keyboard.press('Escape'); await p.waitForSelector('#nbNotas', { state: 'detached' });
  assert.equal(await p.evaluate(() => document.activeElement?.id), 'nbCampana', 'el foco vuelve a la campanita');
  assert.deepEqual(errores, []); await ctx.close();
});
