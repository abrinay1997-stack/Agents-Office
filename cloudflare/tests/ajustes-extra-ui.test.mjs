// La MISMA interfaz de Ajustes (Restablecer oficina y Revisar lo que leí) pero servida por el Worker de la nube: Chromium carga la oficina real y cada petición se contesta con `manejar(...)` del Worker en este proceso
// (D1 y R2 en memoria, la semilla real del despliegue como ASSETS, un sitio web y un Anthropic de mentira). A 1280 px en claro y a 390 px en oscuro, con axe-core si AO_AXE apunta a axe.min.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { oficina6, dimitriDice } from './fase6-ayudas.mjs';
import { semillaEnDisco } from './semilla-ayudas.mjs';
import { guardarNotas } from '../worker/lib/cerebro.js';
import { manejar } from '../worker/lib/rutas.js';
import { sitioFalso, pagina } from '../../tests/sitio-falso.mjs';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { for (const m of ['playwright', 'playwright-core']) { try { ({ chromium } = createRequire(base)(m)); break; } catch { /* siguiente */ } } if (chromium) break; }
const AQUI = dirname(fileURLToPath(import.meta.url)), RAIZ = join(AQUI, '..', '..'), PUBLICO = join(AQUI, '..', 'public');
const DIST = join(RAIZ, 'dist'), SALTAR = !chromium ? 'Playwright no está instalado' : !existsSync(join(DIST, 'ajustes-extra.js')) ? 'falta dist/ajustes-extra.js (node build.mjs)' : false;
const MODELO = { perfil: 'PanaClaw hace webs.\nNuestra web básica cuesta US$ 390.', oferta: '| Web básica | US$ 390 |', briefs: { marketing: 'Habla de tú.' } };

async function nube(t) {
  const { dir } = await semillaEnDisco();
  const archivos = (p) => {
    const q = p.replace(/^\/oficina\//, '/');
    if (p === '/oficina/index.html') return join(DIST, 'command-centre-v2.html');
    if (p.startsWith('/oficina/')) return join(DIST, q.slice(1));
    if (p.startsWith('/semilla/')) return join(dir, p.slice('/semilla/'.length));
    return join(PUBLICO, p.slice(1));
  };
  const o = await oficina6({ guion: [dimitriDice(MODELO)], extraEnv: { ASSETS: { fetch: async (req) => { const f = archivos(new URL(req.url).pathname); return existsSync(f) ? new Response(readFileSync(f), { headers: { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'application/json', etag: '"v1"' } }) : new Response('no', { status: 404 }); } } } });
  const sitio = sitioFalso({ 'https://panaclaw.com/': pagina('PanaClaw', '<p>Hacemos webs. La web básica cuesta US$ 390.</p><a href="/precios">Precios</a>'), 'https://panaclaw.com/precios': pagina('Precios', '<p>Web básica US$ 390. Incluye diseño, textos, formulario de contacto y un año de alojamiento sin costo adicional para tu negocio.</p>') });
  o.env.__pruebas.fetchWeb = sitio.fetchFn;
  await guardarNotas(o.d1, [{ nombre: 'precios-webs', grupo: '10-Business', oficina: 0, texto: '# Precios\n| Web básica | US$ 450 |\n', actualizado: 5, tarea: null }, { nombre: 'perfil', grupo: '00-Empresa', oficina: 0, texto: '# Perfil de la empresa\n\nPanaClaw hace webs.\nNuestra web básica cuesta US$ 450.\n', actualizado: 5, tarea: null }]);
  const login = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'dueno@panaclaw.test', contrasena: 'una-clave-larga-123' }) }), o.env); // secrets-ok: de prueba
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const nav = await chromium.launch(); t.after(() => nav.close());
  const abrir = async (ancho, alto, tema) => {
    const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema }), p = await ctx.newPage(); p.setDefaultTimeout(90000);
    await p.addInitScript((tm) => { try { localStorage.setItem('ao.theme', tm); } catch { /* ya */ } }, tema);
    await p.route('https://oficina.test/**', async (r) => {
      const rq = r.request(), cab = { ...rq.headers(), cookie }; delete cab['content-length'];
      const pend = []; const resp = await manejar(new Request(rq.url(), { method: rq.method(), headers: cab, body: ['GET', 'HEAD'].includes(rq.method()) ? undefined : rq.postData() }), o.env, { waitUntil: (x) => pend.push(x) });
      const h = {}; resp.headers.forEach((v, k) => { if (k !== 'set-cookie' && k !== 'content-encoding' && k !== 'content-length') h[k] = v; });
      await r.fulfill({ status: resp.status, headers: h, body: Buffer.from(await resp.arrayBuffer()) }); await Promise.allSettled(pend);
    });
    return { ctx, p };
  };
  return { o, abrir };
}
const axe = async (p, que) => {
  if (!process.env.AO_AXE) return;
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: process.env.AO_AXE });
  const r = await p.evaluate(async () => (await window.axe.run('#setOv .sg-pane', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 2).map((n) => n.html.slice(0, 90)).join(' | ')}`));
  assert.deepEqual(r, [], `axe en ${que}`);
};
const abrirAjustes = async (p, tab) => { await p.waitForSelector('#topSettings', { state: 'attached' }); await p.waitForTimeout(1200); await p.keyboard.press(','); await p.waitForSelector('#setOv:not([hidden])'); await p.waitForSelector(`#setOv [data-tab="${tab}"]`); await p.click(`#setOv [data-tab="${tab}"]`); };
const desborda = (p) => p.evaluate(() => { const a = document.querySelector('#setOv .sg-pane'); return a.scrollWidth > a.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1; });

for (const [ancho, alto, tema] of [[1280, 800, 'light'], [390, 844, 'dark']]) {
  test(`NUBE ${ancho}px (${tema}): «PanaClaw por defecto» desde Ajustes carga las 59 notas con su mapa; «Vacía» las quita; restaurar las devuelve`, { skip: SALTAR, timeout: 240000 }, async (t) => {
    const { o, abrir } = await nube(t), { ctx, p } = await abrir(ancho, alto, tema); const errores = []; p.on('pageerror', (e) => errores.push(e.message));
    await p.goto('https://oficina.test/'); await abrirAjustes(p, 'restablecer');
    assert.ok((await p.$$eval('#setOv .sg-tabs [role=tab]', (l) => l.map((x) => x.textContent.trim()))).includes('Revisar lo que leí'));
    await p.click('label.ax-modo:has(input[value=panaclaw])'); await p.waitForSelector('#axRevisar:not([disabled])');
    assert.deepEqual(await p.$$eval('.ax-ck input:checked', (l) => l.map((x) => x.value)), ['cerebro', 'habilidades']);
    assert.match(await p.textContent('.ax-modos'), /59 notas/); await axe(p, 'nube · modos'); assert.equal(await desborda(p), false);
    await p.click('#axRevisar'); await p.fill('#axPalabra', 'RESTABLECER'); await axe(p, 'nube · confirmar'); assert.equal(await desborda(p), false);
    await p.click('#axConfirmar'); await p.waitForSelector('[data-restaurar]');
    assert.equal(o.d1._db.prepare('select count(*) n from notas').get().n, 59); assert.equal(o.d1._db.prepare("select count(*) n from notas where nombre = 'precios-webs'").get().n, 1); assert.match(o.d1._db.prepare("select texto from notas where nombre = 'precios-webs'").get().texto, /PanaClaw Launch/, 'las notas de fábrica, no las del dueño');
    await p.click('label.ax-modo:has(input[value=vacia])'); await p.click('#axRevisar'); await p.fill('#axPalabra', 'RESTABLECER'); await p.click('#axConfirmar');
    await p.waitForFunction(() => document.querySelectorAll('[data-restaurar]').length === 2, null, { timeout: 90000 }).catch(async (e) => { throw new Error(`${e.message} · msg=${await p.textContent('#setOv .sg-msg')} · n=${await p.locator('[data-restaurar]').count()}`); });
    assert.equal(o.d1._db.prepare('select count(*) n from notas').get().n, 0);
    await axe(p, 'nube · hecho'); assert.equal(await desborda(p), false);
    await p.evaluate(() => { const b = document.querySelector('[data-restaurar]'); b.click(); b.click(); });
    await p.waitForFunction(() => /Restaurado/.test(document.querySelector('#setOv .sg-msg').textContent), null, { timeout: 90000 });
    assert.equal(o.d1._db.prepare('select count(*) n from notas').get().n, 59);
    assert.deepEqual(errores, []); await ctx.close();
  });

  test(`NUBE ${ancho}px (${tema}): leer la web de verdad → «Revisar lo que leí»: conflicto en ámbar con las dos versiones, aplicar sin pisar tu nota`, { skip: SALTAR, timeout: 240000 }, async (t) => {
    const { o, abrir } = await nube(t), { ctx, p } = await abrir(ancho, alto, tema); const errores = []; p.on('pageerror', (e) => errores.push(e.message));
    await p.goto('https://oficina.test/'); await abrirAjustes(p, 'empresa');
    await p.fill('#sgUrl', 'https://panaclaw.com'); await p.click('#setOv [data-a="bootstrap"]');
    await p.waitForSelector('.ax-nota', { timeout: 40000 });
    const conf = await p.$$eval('.ax-conf', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ')));
    assert.ok(conf.some((c) => /En tu Cerebro dice.*US\$ 450.*precios-webs/.test(c) && /En tu web dice.*US\$ 390/.test(c)), conf.join(' | '));
    assert.match(await p.textContent('.ax'), /Leí 2 página\(s\) de/); assert.equal(o.d1._db.prepare("select count(*) n from notas where nombre = 'oferta'").get().n, 0);
    await axe(p, 'nube · revisar'); assert.equal(await desborda(p), false);
    const antes = o.d1._db.prepare("select texto from notas where nombre = 'perfil'").get().texto;
    await p.click('#axAplicar'); await p.waitForFunction(() => /Ya apliqué/.test(document.querySelector('#setOv .sg-pane').textContent), null, { timeout: 90000 });
    assert.equal(o.d1._db.prepare("select texto from notas where nombre = 'perfil'").get().texto, antes, 'tu perfil quedó como estaba');
    assert.equal(o.d1._db.prepare("select count(*) n from notas where nombre = 'oferta'").get().n, 1);
    assert.ok(await p.locator('[data-confirmar]').count() >= 1, 'el precio de la web espera en «por confirmar»'); await axe(p, 'nube · aplicada');
    assert.deepEqual(errores, []); await ctx.close();
  });
}
