// El favicon de un conector del usuario (GET /api/icono-conector): lista blanca = dominios de conectores guardados, solo https público, solo en su propio dominio,
// solo imágenes (nunca SVG), tope, redirecciones validadas, sin credenciales, copia en R2, ritmo y 401 sin sesión. No depende de la hora.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { validarHost, tipoDe, mismoDominio, MAX_BYTES, PEDIDOS_POR_MINUTO } from '../worker/lib/icono-conector.js';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 16]);
const ICO = Uint8Array.from([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0, 40, 1, 0, 0, 22, 0, 0, 0, 40, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

test('validarHost: solo dominios completos y públicos; nada de IP, localhost, .local, usuarios ni rutas', () => {
  assert.equal(validarHost('Mi.Sitio.com').host, 'mi.sitio.com'); assert.equal(validarHost('mi.sitio.com.').host, 'mi.sitio.com');
  for (const m of ['', 'localhost', '127.0.0.1', '10.0.0.1', '[::1]', 'x.local', 'intranet.corp', 'sitio', 'a@b.com', 'a.com/x', 'a.com:8443', 'a b.com', '-a.com', 'a'.repeat(260) + '.com', 'a.com?x=1', 'x.internal']) {
    const v = validarHost(m); assert.ok(v.error, `debía rechazar: ${m}`); assert.ok([400].includes(v.estado));
  }
});

test('tipoDe: PNG, JPEG, WebP, GIF e ICO por sus bytes; SVG, HTML y basura, no', () => {
  assert.equal(tipoDe(PNG), 'png'); assert.equal(tipoDe(ICO), 'ico'); assert.equal(tipoDe(SVG), null);
  assert.equal(tipoDe(new TextEncoder().encode('<html>hola que tal, esto no es una imagen</html>')), null); assert.equal(tipoDe(new Uint8Array(30)), null);
});

test('mismoDominio: el mismo dominio o un subdominio; nunca otro que solo se le parezca', () => {
  assert.ok(mismoDominio('a.com', 'a.com')); assert.ok(mismoDominio('www.a.com', 'a.com'));
  assert.ok(!mismoDominio('evila.com', 'a.com')); assert.ok(!mismoDominio('a.com.evil.test', 'a.com')); assert.ok(!mismoDominio('b.com', 'a.com'));
});

async function oficina(host = 'mi-servicio.example.com') {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' });
  if (host) d1._db.prepare("insert into conectores (id, nombre, url, secreto, departamentos, herramientas_lectura, herramientas_envio, activo, created_at) values ('c1','mio',?,null,'[]','[]','[]',1,'2026-01-01T00:00:00Z')").run(`https://${host}/mcp`);
  const MEDIA = crearR2(), llamadas = [];
  let guion = () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
  const FETCH_ICONO_CONECTOR = async (url, init) => { llamadas.push({ url, init }); return guion(url, init); };
  const env = envDePrueba(d1, { MEDIA, FETCH_ICONO_CONECTOR });
  const id = d1._db.prepare('select id from users where email = ?').get(c.email).id;
  const cookie = `__Host-sesion=${await abrirSesion(d1, id)}`;
  const pedir = (h, { c = cookie, cab = {}, metodo = 'GET' } = {}) => manejar(new Request(`https://oficina.test/api/icono-conector?host=${encodeURIComponent(h)}`, { method: metodo, headers: { ...(c ? { cookie: c } : {}), ...cab } }), env);
  return { d1, MEDIA, llamadas, pedir, poner: (f) => { guion = f; }, cookie };
}

test('sirve el favicon de un conector guardado: pide solo /favicon.ico de su dominio, sin credenciales; copia en R2; segunda vez sin red; If-None-Match', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = await o.pedir('mi-servicio.example.com');
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png');
  assert.match(r.headers.get('content-security-policy'), /sandbox/); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('etag'), /^"[0-9a-f]{40}"$/);
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [...PNG]);
  assert.equal(o.llamadas.length, 1); assert.equal(o.llamadas[0].url, 'https://mi-servicio.example.com/favicon.ico');
  assert.equal(o.llamadas[0].init.redirect, 'manual'); assert.equal(o.llamadas[0].init.headers.cookie, undefined); assert.equal(o.llamadas[0].init.headers.authorization, undefined);
  assert.equal([...o.MEDIA._m.keys()].filter((k) => k.startsWith('contenido/icono-conector/')).length, 1);
  o.poner(() => new Response('cayó', { status: 500 }));
  assert.equal((await o.pedir('MI-SERVICIO.example.com')).status, 200); assert.equal(o.llamadas.length, 1, 'la copia se sirve aunque el sitio ya no conteste');
  assert.equal((await o.pedir('mi-servicio.example.com', { cab: { 'if-none-match': r.headers.get('etag') } })).status, 304);
});

test('un ICO también vale; un SVG con script, un HTML, más de 128 KB y un fallo no se sirven ni dejan nada en R2', { skip: SALTAR }, async () => {
  const o = await oficina();
  o.poner(() => new Response(ICO, { status: 200 })); assert.equal((await o.pedir('mi-servicio.example.com')).headers.get('content-type'), 'image/x-icon');
  const p = await oficina();
  for (const cuerpo of [SVG, new TextEncoder().encode('<html>hola que tal, esto no es una imagen</html>'), (() => { const g = new Uint8Array(MAX_BYTES + 10); g.set(PNG); return g; })()]) {
    p.poner(() => new Response(cuerpo, { status: 200 })); assert.equal((await p.pedir('mi-servicio.example.com')).status, 404);
  }
  p.poner(() => new Response('no', { status: 500 })); assert.equal((await p.pedir('mi-servicio.example.com')).status, 404);
  assert.equal([...p.MEDIA._m.keys()].length, 0);
});

test('lista blanca: un dominio que no es de ningún conector, uno local o uno que solo se parece, no salen a la red', { skip: SALTAR }, async () => {
  const o = await oficina();
  for (const h of ['otro.example.com', 'evil.test', 'mi-servicio.example.com.evil.test', 'xmi-servicio.example.com']) assert.equal((await o.pedir(h)).status, 403, h);
  for (const h of ['127.0.0.1', 'localhost', '169.254.169.254', 'a@b.com']) assert.equal((await o.pedir(h)).status, 400, h);
  assert.equal(o.llamadas.length, 0, 'nada salió a la red');
  const sin = await oficina(null); assert.equal((await sin.pedir('mi-servicio.example.com')).status, 403, 'sin conectores no hay nada que servir');
});

test('redirecciones: dentro del mismo dominio se siguen (máx. 2); a otro dominio, a http o a una IP interna, no', { skip: SALTAR }, async () => {
  const o = await oficina();
  o.poner((u) => (u.endsWith('/favicon.ico') ? new Response(null, { status: 301, headers: { location: 'https://cdn.mi-servicio.example.com/i.png' } }) : new Response(PNG, { status: 200 })));
  assert.equal((await o.pedir('mi-servicio.example.com')).status, 200); assert.equal(o.llamadas.length, 2);
  for (const dest of ['https://evil.test/i.png', 'http://mi-servicio.example.com/i.png', 'https://169.254.169.254/latest', 'https://mi-servicio.example.com.evil.test/i.png', 'https://mi-servicio.example.com:8443/i.png', 'https://u@mi-servicio.example.com/i.png']) {
    const p = await oficina(); p.poner(() => new Response(null, { status: 302, headers: { location: dest } }));
    assert.equal((await p.pedir('mi-servicio.example.com')).status, 404, dest); assert.equal(p.llamadas.length, 1, `no siguió a ${dest}`);
  }
  const bucle = await oficina(); bucle.poner(() => new Response(null, { status: 302, headers: { location: 'https://mi-servicio.example.com/otra' } }));
  assert.equal((await bucle.pedir('mi-servicio.example.com')).status, 404); assert.equal(bucle.llamadas.length, 3, 'tope de redirecciones');
});

test('sin sesión 401, método distinto de GET 405 y ritmo de bajadas nuevas por persona', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.pedir('mi-servicio.example.com', { c: null })).status, 401);
  assert.equal((await o.pedir('mi-servicio.example.com', { metodo: 'POST' })).status, 405);
  assert.equal(o.llamadas.length, 0);
  o.poner(() => new Response('no', { status: 404 }));
  let ultimo; for (let i = 0; i < PEDIDOS_POR_MINUTO + 1; i++) ultimo = (await o.pedir('mi-servicio.example.com')).status;
  assert.equal(ultimo, 429); assert.equal(o.llamadas.length, PEDIDOS_POR_MINUTO);
});
