// El medidor de la esquina en la nube, en la página REAL de la oficina (dist/command-centre-v2.html) hablando con el Worker real (D1 en memoria): «HOY US$ · MES US$ de N (P %)»,
// barra ámbar/roja desde 75/90 %, sin la palabra «reinicia». La oficina local con plan de Claude sigue como estaba (ese caso fija /api/usage a mano).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { SALTAR as SIN_D1 } from './d1-memoria.mjs';
import { oficina } from './agentes-ayudas.mjs';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* siguiente */ } }
const PAGINA = new URL('../../dist/command-centre-v2.html', import.meta.url);
const SALTAR = SIN_D1 || (!existsSync(PAGINA) ? 'falta dist/ (node build.mjs)' : chromium ? false : 'Playwright no está instalado');
let nav;
before(async () => { if (!SALTAR) nav = await chromium.launch().catch(() => null); });
after(async () => { await nav?.close(); });

async function medidor({ gastoMes = 0, gastoHoy = 0, tope = 0, aMano = null, ancho = 1280 }) {
  const { d1, env } = await oficina({ ajustes: tope ? { costs: { monthlyBudget: tope } } : null, conector: false });
  const ins = d1._db.prepare("insert into costos (t, tarea, agente, dept, tipo, modelo, proveedor, tin, tout, cache_read, cache_write, usd, fuente) values (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  if (gastoMes - gastoHoy > 0) ins.run(Date.now() - 1000 * 3600 * 30, 'a', 'elead', 'emails', 'task', 'claude-sonnet-5', 'anthropic', 100, 50, 0, 0, gastoMes - gastoHoy, 'tabla');
  if (gastoHoy > 0) ins.run(Date.now() - 1000, 'b', 'elead', 'emails', 'task', 'claude-sonnet-5', 'anthropic', 22000, 0, 0, 0, gastoHoy, 'tabla');
  const { sembrar } = await import('./d1-memoria.mjs'); void sembrar;
  const { manejar } = await import('../worker/lib/rutas.js');
  const entrada = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'dueno@panaclaw.test', contrasena: 'una-clave-larga-123' }) }), env); // secrets-ok
  const cookie = entrada.headers.get('set-cookie').split(';')[0];
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 800 } }), p = await ctx.newPage();
  await p.route('https://oficina.test/**', async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/') return r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: readFileSync(PAGINA, 'utf8') });
    if (aMano && u.pathname === '/api/usage') return r.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(aMano) });
    const resp = await manejar(new Request(u.href, { method: req.method(), headers: { 'content-type': 'application/json', cookie }, body: req.postData() || undefined }), env);
    return r.fulfill({ status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/json' }, body: await resp.text() });
  });
  await p.goto('https://oficina.test/', { waitUntil: 'domcontentloaded' });
  const sel = '#usageDock .tm-usage';
  await p.waitForFunction((s) => { const e = document.querySelector(s); return e && e.textContent.trim().length > 3; }, sel, { timeout: 20000 }).catch(() => {});
  const r = { texto: await p.evaluate((q) => [...document.querySelector(q).children].map((c) => c.textContent.trim()).filter(Boolean).join(' '), sel).catch(() => ''), titulo: (await p.getAttribute(sel, 'title').catch(() => '')) || '', barra: await p.getAttribute(sel + ' .ub i', 'class').catch(() => null), visible: await p.isVisible('#usageDock').catch(() => false) };
  await ctx.close(); return r;
}

test('nube con tope: «HOY US$0,42 · MES US$7,10 de 30 24 %», barra normal y sin la palabra «reinicia»', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  if (new Date().getDate() === 1) return t0.skip('el día 1 «ayer» cae en el mes anterior');
  const r = await medidor({ gastoMes: 7.1, gastoHoy: 0.42, tope: 30 });
  assert.match(r.texto, /^HOY US\$0,42 · MES US\$7,10 de 30 24 %$/); assert.doesNotMatch(r.texto, /REINICIA|VENTANA|TOKENS/i); assert.doesNotMatch(r.titulo, /reinicia/i);
  assert.match(r.titulo, /estimaci/i); assert.match(r.titulo, /libro de costos/); assert.equal(r.barra, ''); assert.equal(r.visible, true);
});
test('la barra se vuelve ámbar desde 75 % y roja desde 90 %; sin tope no hay barra ni porcentaje', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  if (new Date().getDate() === 1) return t0.skip('el día 1 «ayer» cae en el mes anterior');
  assert.equal((await medidor({ gastoMes: 24, gastoHoy: 1, tope: 30 })).barra, 'w');
  assert.equal((await medidor({ gastoMes: 28, gastoHoy: 1, tope: 30 })).barra, 'c');
  const s = await medidor({ gastoMes: 3, gastoHoy: 0.42 });
  assert.equal(s.texto, 'HOY US$0,42 · MES US$3,00'); assert.equal(s.barra, null); assert.match(s.titulo, /tope del mes/);
});
test('la oficina local con plan de Claude sigue igual (SESIÓN / SEMANA)', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const r = await medidor({ aMano: { ok: true, source: 'claude', session: { percent: 40, resetsAt: Date.now() + 36e5 }, week: { percent: 10, resetsAt: Date.now() + 864e5 } } });
  assert.match(r.texto, /SESIÓN/); assert.match(r.titulo, /se reinicia/);
});
