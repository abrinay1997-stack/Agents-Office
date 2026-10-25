// Lo que solo un navegador puede afirmar: que nube.js y invitacion.js ponen el texto ajeno como TEXTO (nunca como HTML), que el parche de fetch conserva
// las cabeceras de un Request y que el testigo de la invitación sale de la barra de direcciones y viaja en el cuerpo. Con Playwright (se salta sin él).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

let chromium = null;
for (const base of [import.meta.url, 'file:///opt/node22/lib/node_modules/']) { try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* siguiente */ } }
const leer = (f) => readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
const SALTAR = chromium ? false : 'Playwright no está instalado';
const MALO = '<img src=x onerror="window.__pwn=1">"\'><script>window.__pwn=2</script>';
let nav;
before(async () => { if (!SALTAR) nav = await chromium.launch().catch(() => null); });
after(async () => { await nav?.close(); });

const cuerpoHTML = { 'content-type': 'text/html; charset=utf-8' }, js = { 'content-type': 'text/javascript' }, css = { 'content-type': 'text/css' };
async function pagina(rutas) {
  const ctx = await nav.newContext(); const p = await ctx.newPage(); const vistos = [];
  await p.route('https://oficina.test/**', async (r) => {
    const req = r.request(), u = new URL(req.url()); vistos.push({ ruta: u.pathname, metodo: req.method(), cab: req.headers(), cuerpo: req.postData() });
    const h = rutas(u.pathname, req); if (h) return r.fulfill(h);
    return r.fulfill({ status: 404, body: 'no' });
  });
  return { p, ctx, vistos };
}

test('nube.js: nombres con HTML se pintan como texto en el menú, el equipo y el perfil; el parche de fetch conserva las cabeceras de un Request', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const yo = { id: 'u1', email: 'a@x.test', rol: 'admin', nombre: MALO, color: '#123456" onmouseover="window.__pwn=3', foto: null };
  const { p, ctx, vistos } = await pagina((ruta) => {
    if (ruta === '/') return { headers: cuerpoHTML, body: '<!doctype html><body><div id="topbar"><div id="topdock"></div></div><button id="topSettings">x</button><div id="setOv" hidden><div class="sg-tabs"></div><div class="sg-pane"></div></div><script src="/nube.js"></script></body>' };
    if (ruta === '/nube.js') return { headers: js, body: leer('nube.js') };
    if (ruta === '/api/yo') return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: yo }) };
    if (ruta === '/api/equipo') return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ yo: 'u1', roles: ['admin'], miembros: [{ ...yo, email: MALO, yo: true, fundador: true }, { id: 'u2', nombre: MALO, email: MALO, rol: 'editor', color: '#abcdef', foto: null }], invitaciones: [{ id: 'i1', email: MALO, rol: 'editor', expira: '2030-01-01' }] }) };
    if (ruta === '/api/probe') return { headers: { 'content-type': 'application/json' }, body: '{}' };
    return null;
  });
  await p.goto('https://oficina.test/'); await p.waitForSelector('#nubeYo');
  await p.click('#nubeYo'); await p.waitForSelector('#nubeMenu:not([hidden])');
  for (const pane of ['perfil', 'equipo']) {
    await p.evaluate((k) => { const pn = document.querySelector('.sg-pane'); pn.innerHTML = ''; window.AO_AJUSTES_EXTRA.find((t) => t.key === 'nube-' + k).render(pn); }, pane);
    await p.waitForTimeout(150);
  }
  const r = await p.evaluate(() => ({ pwn: window.__pwn ?? null, imgs: document.querySelectorAll('img[src="x"], img[onerror]').length, scripts: document.querySelectorAll('script:not([src])').length, tieneTexto: document.body.textContent.includes('<img src=x'), mouse: document.querySelectorAll('[onmouseover]').length }));
  assert.deepEqual([r.pwn, r.imgs, r.scripts, r.mouse], [null, 0, 0, 0], JSON.stringify(r));
  assert.equal(r.tieneTexto, true, 'el texto malicioso se ve como texto');
  // fetch: un Request con sus cabeceras + la pestaña; un GET sin ella; un init con cabeceras propias también
  await p.evaluate(async () => { await fetch(new Request('/api/probe', { method: 'POST', headers: { 'X-Otro': 'si', 'content-type': 'text/plain' }, body: 'x' })); await fetch('/api/probe'); await fetch('/api/probe', { method: 'PUT', headers: { 'X-Propia': 'ok' }, body: '{}' }); });
  const post = vistos.find((v) => v.ruta === '/api/probe' && v.metodo === 'POST'), put = vistos.find((v) => v.ruta === '/api/probe' && v.metodo === 'PUT'), get = vistos.find((v) => v.ruta === '/api/probe' && v.metodo === 'GET');
  assert.equal(post.cab['x-otro'], 'si', 'las cabeceras del Request se conservan'); assert.match(post.cab['x-pestana'], /^[A-Za-z0-9-]{1,40}$/); assert.equal(post.cab['content-type'], 'text/plain');
  assert.equal(put.cab['x-propia'], 'ok'); assert.ok(put.cab['x-pestana']); assert.equal(get.cab['x-pestana'], undefined);
  await ctx.close();
});

test('invitacion.js: lo que dice el servidor va como texto; el testigo sale de la dirección y viaja en el cuerpo, nunca en la ruta de la API', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const t = 'ab12'.repeat(12);
  const { p, ctx, vistos } = await pagina((ruta) => {
    if (ruta.startsWith('/invitacion') && !ruta.endsWith('.js')) return { headers: cuerpoHTML, body: leer('invitacion.html') };
    if (ruta === '/invitacion.js') return { headers: js, body: leer('invitacion.js') };
    if (ruta === '/acceso.css') return { headers: css, body: leer('acceso.css') };
    if (ruta === '/acceso-tema.js') return { headers: js, body: leer('acceso-tema.js') };
    if (ruta === '/api/invitacion/ver') return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invitacion: { tipo: 'invitacion', email: MALO, nombre: MALO, rol: 'editor', invita: MALO } }) };
    return null;
  });
  await p.goto(`https://oficina.test/invitacion/${t}`); await p.waitForSelector('#f:not(.oculto)');
  const r = await p.evaluate(() => ({ pwn: window.__pwn ?? null, imgs: document.querySelectorAll('img').length, quien: document.getElementById('quien').textContent, email: document.getElementById('email').value, ruta: location.pathname }));
  assert.equal(r.pwn, null); assert.equal(r.imgs, 0); assert.ok(r.quien.includes('<img src=x')); assert.equal(r.email, MALO);
  assert.equal(r.ruta, '/invitacion', 'el testigo ya no está en la barra de direcciones');
  const ver = vistos.find((v) => v.ruta === '/api/invitacion/ver'); assert.equal(ver.metodo, 'POST'); assert.equal(JSON.parse(ver.cuerpo).testigo, t);
  assert.ok(vistos.every((v) => !v.ruta.includes(t) || v.ruta === `/invitacion/${t}`), 'ninguna petición de la API lleva el testigo en la ruta');
  await p.reload(); await p.waitForSelector('#f:not(.oculto)'); // una recarga lo recupera de sessionStorage
  assert.equal(JSON.parse(vistos.filter((v) => v.ruta === '/api/invitacion/ver').at(-1).cuerpo).testigo, t);
  await ctx.close();
});

test('nube.js: una foto que no se puede leer y un corte de red se dicen en español (nunca «The source image could not be decoded» ni «Failed to fetch»)', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const yo = { id: 'u1', email: 'a@x.test', rol: 'admin', nombre: 'Ana', color: '#123456', foto: null };
  let cortar = false;
  const { p, ctx } = await pagina((ruta) => {
    if (ruta === '/') return { headers: cuerpoHTML, body: '<!doctype html><body><div id="topbar"><div id="topdock"></div></div><button id="topSettings">x</button><div id="setOv" hidden><div class="sg-tabs"></div><div class="sg-pane"></div></div><script src="/nube.js"></script></body>' };
    if (ruta === '/nube.js') return { headers: js, body: leer('nube.js') };
    if (ruta === '/api/yo') return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: yo }) };
    if (ruta === '/api/equipo') return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ yo: 'u1', roles: ['admin'], miembros: [{ ...yo, yo: true, fundador: true }], invitaciones: [] }) };
    return null;
  });
  await p.route('https://oficina.test/api/yo', (r) => (cortar && r.request().method() === 'PATCH' ? r.abort('connectionreset') : r.fallback()));
  await p.goto('https://oficina.test/'); await p.waitForSelector('#nubeYo');
  await p.evaluate(() => { const pn = document.querySelector('.sg-pane'); pn.innerHTML = ''; window.AO_AJUSTES_EXTRA.find((t) => t.key === 'nube-perfil').render(pn); });
  await p.setInputFiles('#nbArchivo', { name: 'rota.png', mimeType: 'image/png', buffer: Buffer.from('esto no es una imagen') });
  await p.waitForFunction(() => document.querySelector('.nb-msg')?.textContent && document.querySelector('.nb-msg').textContent !== 'Subiendo…');
  const foto = await p.textContent('.nb-msg');
  assert.match(foto, /No se pudo leer esa imagen/); assert.doesNotMatch(foto, /source image|decode/i);
  cortar = true;
  await p.evaluate(() => document.querySelector('[data-a="nombre"]').click()); await p.waitForFunction(() => /conexión/i.test(document.querySelector('.nb-msg')?.textContent || ''));
  const red = await p.textContent('.nb-msg'); assert.match(red, /Sin conexión con la oficina/); assert.doesNotMatch(red, /fetch|network/i);
  await ctx.close();
});

test('nube.js: «Suscribirme (.ics)» baja el archivo en lugar de copiar una dirección que una app de calendario no puede abrir (pide sesión)', { skip: SALTAR }, async (t0) => {
  if (!nav) return t0.skip('sin Chromium');
  const yo = { id: 'u1', email: 'a@x.test', rol: 'admin', nombre: 'Ana', color: '#123456', foto: null };
  const { p, ctx } = await pagina((ruta) => {
    if (ruta === '/') return { headers: cuerpoHTML, body: '<!doctype html><body><div id="topbar"><div id="topdock"></div></div><button id="topSettings">x</button><div id="setOv" hidden><div class="sg-tabs"></div><div class="sg-pane"></div></div><button data-ics id="ics">Suscribirme</button><script>document.body.addEventListener("click", (e) => { if (e.target.closest("[data-ics]")) window.__copio = 1; });</script><script src="/nube.js"></script></body>' };
    if (ruta === '/nube.js') return { headers: js, body: leer('nube.js') };
    if (ruta === '/api/yo') return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: yo }) };
    if (ruta === '/api/equipo') return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ yo: 'u1', roles: ['admin'], miembros: [{ ...yo, yo: true, fundador: true }], invitaciones: [] }) };
    if (ruta === '/api/calendar.ics') return { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="oficina.ics"' }, body: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' };
    return null;
  });
  await p.goto('https://oficina.test/'); await p.waitForSelector('#nubeYo');
  const [bajada] = await Promise.all([p.waitForEvent('download'), p.click('#ics')]);
  assert.equal(bajada.suggestedFilename(), 'oficina.ics');
  assert.equal(await p.evaluate(() => window.__copio ?? null), null, 'el manejador de la página (copiar la dirección) no corre');
  assert.match(await p.textContent('#nubeAviso'), /Se bajó tu calendario/);
  await ctx.close();
});
