// La PÁGINA real de la oficina con lo de la nube inyectado (nube.js + sus pestañas), hablando con el Worker real: la barra de conectores con el icono de cada uno, su panel con
// «+ Añadir conector» (nada de «claude mcp add»), el estado vacío que lleva a Ajustes → Conectores, y los modelos en uso junto al perfil. A 390 y a 1280 px.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { SALTAR as SIN_D1 } from './d1-memoria.mjs';
import { oficina } from './agentes-ayudas.mjs';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* siguiente */ } }
const PAGINA = new URL('../../dist/command-centre-v2.html', import.meta.url);
const pub = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const SALTAR = SIN_D1 || (!existsSync(PAGINA) ? 'falta dist/ (node build.mjs)' : chromium ? false : 'Playwright no está instalado');
let nav;
before(async () => { if (!SALTAR) nav = await chromium.launch().catch(() => null); });
after(async () => { await nav?.close(); });
const INYECCION = '<link rel="stylesheet" href="/nube.css"><script src="/nube.js" defer></script><script src="/nube-modelos.js" defer></script><script src="/nube-conectores.js" defer></script>';
const conNube = (h) => { const i = h.lastIndexOf('</body>'); return h.slice(0, i) + INYECCION + h.slice(i); }; // la ÚLTIMA: la página trae '</body>' dentro de un script (en producción lo hace HTMLRewriter)
const TIPO = { js: 'text/javascript', css: 'text/css' };

async function abrir({ ancho, conectores = [], extraEnv = {}, modelos = null, tema = null }) {
  const { d1, env } = await oficina({ env: extraEnv, conector: false });
  const ins = d1._db.prepare("insert into conectores (id,nombre,url,secreto,departamentos,herramientas_lectura,herramientas_envio,activo,created_at) values (?,?,?,?,?,?,?,1,'x')");
  const ext = d1._db.prepare("insert into conectores_extra (nombre, auth_tipo, token_cifrado, plantilla, etiqueta, updated_at) values (?,?,?,?,?,'x')");
  for (const c of conectores) { ins.run(c.nombre, c.nombre, c.url, null, '["emails"]', '["search_threads"]', '[]'); ext.run(c.nombre, c.auth || 'bearer', c.cifrado === false ? null : 'v1.aaaa.bbbb', c.plantilla || null, c.etiqueta || null); }
  if (modelos) d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('modelos', ?, 1, 'x')").run(JSON.stringify(modelos));
  const { manejar } = await import('../worker/lib/rutas.js');
  const entrada = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'dueno@panaclaw.test', contrasena: 'una-clave-larga-123' }) }), env); // secrets-ok
  const cookie = entrada.headers.get('set-cookie').split(';')[0];
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } }), p = await ctx.newPage(); const errores = [];
  if (tema) await p.addInitScript((t) => { try { localStorage.setItem('ao.theme', t); } catch { /* sin almacenamiento */ } }, tema);
  p.on('pageerror', (e) => errores.push(String(e)));
  await p.route('https://oficina.test/**', async (r) => {
    const req = r.request(), u = new URL(req.url());
    if (u.pathname === '/') return r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: conNube(readFileSync(PAGINA, 'utf8')) });
    if (/^\/nube[\w-]*\.(js|css)$/.test(u.pathname)) return r.fulfill({ status: 200, headers: { 'content-type': TIPO[u.pathname.split('.').pop()] }, body: pub(u.pathname.slice(1)) });
    if (u.pathname === '/api/live') return r.abort();
    if (!u.pathname.startsWith('/api/')) return r.fulfill({ status: 404, body: 'no' }); // los paquetes bajo demanda (dictado, editor…) no son de este test: en el Worker real los sirve ASSETS
    const resp = await manejar(new Request(u.href, { method: req.method(), headers: { 'content-type': 'application/json', cookie }, body: req.postData() || undefined }), env);
    return r.fulfill({ status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'application/json' }, body: await resp.text() });
  });
  await p.goto('https://oficina.test/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  return { p, ctx, errores };
}
const CONECTORES = [{ nombre: 'zapier', etiqueta: 'Zapier de Ana', plantilla: 'zapier', url: 'https://mcp.zapier.example.com/mcp' }, { nombre: 'mi-crm', etiqueta: 'Mi CRM', url: 'https://crm.example.org/mcp' }, { nombre: 'n8n', plantilla: 'n8n', url: 'https://n8n.example.net/mcp', cifrado: false }];

for (const ancho of [1280, 390]) {
  test(`barra y panel de conectores a ${ancho} px: cada uno con su icono (plantilla o monograma), el estado en palabras y «+ Añadir conector»; nada de «claude mcp add»`, { skip: SALTAR }, async (t0) => {
    if (!nav) return t0.skip('sin Chromium');
    const { p, ctx, errores } = await abrir({ ancho, conectores: CONECTORES });
    await p.waitForSelector('#topconn img', { timeout: 40000, state: 'attached' });
    const imgs = await p.$$eval('#topconn img', (l) => l.map((i) => ({ src: i.src.slice(0, 26), alt: i.alt, title: i.title })));
    assert.ok(imgs.length >= 2, 'los conectores listos están en la barra'); assert.ok(imgs.every((i) => i.src.startsWith('data:image/svg+xml')), 'sus iconos son SVG propios en línea, no se piden a nadie de fuera');
    assert.ok(imgs.some((i) => /Zapier de Ana/.test(i.alt + i.title)) && imgs.some((i) => /Mi CRM/.test(i.alt + i.title)));
    if (ancho <= 760) { // el teléfono: la barra de conectores no cabe y se esconde; se llega por el «⋯» a Ajustes → Conectores MCP, con tarjetas de 56 px
      assert.equal(await p.isVisible('#topconn'), false);
      await p.click('#topMore'); await p.click('#topMoreMenu [data-nube=conectores]');
      await p.waitForSelector('#setOv [data-tab="nube-conectores"][aria-selected="true"]', { timeout: 8000 }); await p.waitForSelector('.cn-card');
      const t = await p.$$eval('.cn-card', (l) => l.map((c) => ({ h: c.getBoundingClientRect().height, w: c.getBoundingClientRect().width, icono: c.querySelector('img.cn-ic')?.src.startsWith('data:image/svg+xml') && c.querySelector('img.cn-ic').naturalWidth > 0, estado: !!c.querySelector('.cn-st') && c.querySelector('.cn-st').textContent.trim().length > 3 })));
      assert.equal(t.length, 3); assert.ok(t.every((x) => x.h >= 56 && x.w <= 390 && x.icono && x.estado), JSON.stringify(t));
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await p.screenshot({ path: `/tmp/claude-0/-home-user/129deb44-974d-5bcb-a574-82c86e65af21/scratchpad/conectores-${ancho}.png` });
      assert.deepEqual(errores, []); await ctx.close(); return;
    }
    // el panel
    await p.click('#topconn .tc-lab'); await p.waitForSelector('.cp-item');
    const texto = await p.textContent('.cp-body');
    assert.doesNotMatch(texto, /claude mcp add/); assert.match(texto, /\+ Añadir conector/); assert.match(texto, /Zapier de Ana/); assert.match(texto, /Mi CRM/);
    const tarjetas = await p.$$eval('.cp-item .cp-c', (l) => l.map((b) => ({ h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width, icono: b.querySelector('img')?.src.startsWith('data:image/svg+xml'), ancho: innerWidth })));
    assert.ok(tarjetas.every((t) => t.icono && t.h >= 40 && t.w <= t.ancho), JSON.stringify(tarjetas));
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'sin scroll horizontal');
    // el conector sin token se dice aparte y con qué hacer
    assert.match(await p.textContent('.cp-body'), /pide entrar|Piden entrar/i);
    await p.click('.cp-add');
    await p.waitForSelector('#setOv:not([hidden]) [data-tab="nube-conectores"][aria-selected="true"]', { timeout: 8000 }).catch(async () => { assert.fail('«+ Añadir conector» no abrió Ajustes → Conectores: ' + (await p.evaluate(() => document.getElementById('setOv')?.className))); });
    await p.screenshot({ path: `/tmp/claude-0/-home-user/129deb44-974d-5bcb-a574-82c86e65af21/scratchpad/conectores-${ancho}.png` });
    assert.deepEqual(errores, []); await ctx.close();
  });
}
test('sin conectores la barra no manda a «claude mcp add»: invita a añadir el primero y abre Ajustes → Conectores', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 1700 }); // por debajo de 1600 px la página pliega los iconos en la pastilla «CONECTORES · N» (su panel lleva el mismo «+ Añadir conector»)
  const b = await p.waitForSelector('#topconn button.tc-none', { timeout: 40000, state: 'attached' }).catch(async (e) => { throw new Error(e.message + ' · #topconn: ' + (await p.evaluate(() => document.getElementById('topconn')?.outerHTML.slice(0, 600)))); });
  assert.match(await b.textContent(), /sin conectores/); assert.doesNotMatch(await p.textContent('#topconn'), /claude mcp add/);
  await b.click(); await p.waitForSelector('#setOv [data-tab="nube-conectores"][aria-selected="true"]', { timeout: 8000 });
  await ctx.close();
});
test('sin conectores, con la barra plegada (menos de 1600 px): la pastilla abre un panel que dice «Aún no hay conectores» y ofrece añadir', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 1280 });
  await p.click('#topconn .tc-lab', { timeout: 60000 }); await p.waitForSelector('.cp-add');
  assert.match(await p.textContent('.cp-body'), /Aún no hay conectores/); assert.doesNotMatch(await p.textContent('.cp-body'), /claude mcp add/);
  await p.click('.cp-add'); await p.waitForSelector('#setOv [data-tab="nube-conectores"][aria-selected="true"]', { timeout: 8000 });
  await ctx.close();
});
test('modelos junto al perfil: con Muse asignado a una función aparece su chip, con el título de quién hace qué', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const { p, ctx } = await abrir({ ancho: 1280, extraEnv: { META_API_KEY: 'meta-llave-de-prueba' }, modelos: { personalizados: [{ id: 'claude-nuevo-6', proveedor: 'anthropic', nombre: 'Claude Nuevo 6', herramientas: true, vision: false, razonamiento: false, in: null, out: null, nota: '' }], oficina: 'claude-sonnet-5-5', funciones: { dimitri: 'muse-spark-1.3', redactar: 'claude-nuevo-6' }, departamentos: {}, agentes: {} } });
  await p.waitForSelector('#topmodels .nb-mod', { timeout: 40000, state: 'attached' });
  await p.waitForFunction(() => document.querySelectorAll('#topmodels .nb-mod').length >= 2, null, { timeout: 15000 }).catch(() => {});
  const chips = await p.$$eval('#topmodels .nb-mod', (l) => l.map((i) => i.alt)); assert.deepEqual(chips.sort(), ['Claude Nuevo 6', 'Meta Muse Spark 1.3'], await p.evaluate(() => document.getElementById('topmodels').outerHTML.replace(/src="[^"]{40,}"/g, 'src=…')));
  assert.match(await p.getAttribute('#topmodels .nb-mod', 'title'), /Modelos en uso: .*Muse Spark 1\.3.*Ajustes → Modelos/);
  await ctx.close();
});

/* ---------- accesibilidad con axe-core (AO_AXE=<axe.min.js>; sin él se salta) ---------- */
const AXE = process.env.AO_AXE && existsSync(process.env.AO_AXE) ? process.env.AO_AXE : null;
for (const [ancho, tema] of [[390, 'light'], [390, 'dark'], [1280, 'light'], [1280, 'dark']]) {
  for (const [tab, esperar] of [['nube-modelos', '.md-cat'], ['nube-conectores', '.cn-card']]) {
    test(`axe: Ajustes → ${tab === 'nube-modelos' ? 'Modelos' : 'Conectores MCP'} a ${ancho} px, tema ${tema}: sin violaciones serias ni críticas`, { skip: SALTAR || (AXE ? false : 'falta AO_AXE (axe.min.js)') }, async (t0) => {
      if (!nav) return t0.skip('sin Chromium');
      const { p, ctx } = await abrir({ ancho, tema, conectores: CONECTORES, extraEnv: { META_API_KEY: 'meta-llave-de-prueba' } });
      await p.waitForFunction(() => window.AO_NUBE && window.AO_NUBE.yo && window.AO_NUBE.yo() && window.AO_AJUSTES_EXTRA && window.AO_AJUSTES_EXTRA.length >= 4, null, { timeout: 60000 });
      await p.evaluate(() => document.getElementById('topSettings').click());
      await p.waitForSelector(`#setOv [data-tab="${tab}"]`, { timeout: 20000 }); await p.click(`#setOv [data-tab="${tab}"]`);
      await p.waitForSelector(`#setOv ${esperar}`, { timeout: 20000 });
      if (tab === 'nube-conectores') { await p.click('[data-a=nuevo]'); await p.waitForSelector('.cn-tile'); await p.click('.cn-tile:has-text("Zapier MCP")'); await p.waitForSelector('#cn-url'); }
      assert.equal(await p.evaluate(() => document.body.classList.contains('dark')), tema === 'dark', 'el tema pedido está aplicado');
      await p.addScriptTag({ content: readFileSync(AXE, 'utf8') });
      const r = await p.evaluate(() => axe.run('#setOv', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'], resultTypes: ['violations'] }));
      const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      assert.deepEqual(graves, []);
      await ctx.close();
    });
  }
}
