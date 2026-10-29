// El proxy de imágenes de Meta (GET /api/imagen-meta): lista blanca de hosts, solo imágenes, tope, redirecciones, caché en R2, ritmo y que ninguna URL con token salga a la red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { validarUrl, claveDe, tipoDe, MAX_BYTES, PEDIDOS_POR_MINUTO } from '../worker/lib/imagen-meta.js';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const OK = 'https://scontent-mia3-1.cdninstagram.com/v/t51/avatar.jpg?stp=dst-jpg_s150x150&oh=AAA&oe=111&_nc_sid=1';

test('validarUrl: solo https de la red de Meta, sin usuario, sin puertos raros, sin token', () => {
  for (const bueno of [OK, 'https://scontent.xx.fbcdn.net/a.jpg', 'https://lookaside.fbsbx.com/x', 'https://fbcdn.net/a.png', 'https://scontent.cdninstagram.com:443/a.jpg']) assert.ok(validarUrl(bueno).url, bueno);
  const malos = ['http://scontent.fbcdn.net/a.jpg', 'https://evilfbcdn.net/a.jpg', 'https://fbcdn.net.evil.com/a.jpg', 'https://evil.com/fbcdn.net', 'https://user@scontent.fbcdn.net/a.jpg', 'https://user:pw@scontent.fbcdn.net/a.jpg',
    'https://127.0.0.1/a.jpg', 'https://[::1]/a.jpg', 'https://10.0.0.1:443/a.jpg', 'https://scontent.fbcdn.net:8443/a.jpg', 'https://scontent.fbcdn.net/a.jpg?access_token=SECRETO', 'https://scontent.fbcdn.net/a.jpg?ACCESS_TOKEN=x', 'javascript:alert(1)', 'data:image/png;base64,AA', '', '   ', 'no es una url', 'https://scontent.fbcdn.net@evil.com/a.jpg', 'https://scontent.fbcdn.net%2eevil.com/a.jpg', 'https://scontent.fbcdn.net./a.jpg.evil'];
  for (const m of malos) { const v = validarUrl(m); assert.ok(v.error, `debía rechazar: ${m}`); assert.ok([400, 403].includes(v.estado)); }
  assert.ok(validarUrl('https://scontent.fbcdn.net/' + 'a'.repeat(3000)).error, 'URL enorme');
});

test('claveDe: la firma que caduca (oh, oe, _nc_*) no cambia la clave; el tamaño (stp), el host y la ruta sí', async () => {
  const a = await claveDe(new URL(OK)), b = await claveDe(new URL(OK.replace('oh=AAA', 'oh=BBB').replace('oe=111', 'oe=999').replace('_nc_sid=1', '_nc_sid=9')));
  assert.equal(a, b); assert.match(a, /^[0-9a-f]{40}$/);
  assert.notEqual(a, await claveDe(new URL(OK.replace('s150x150', 's320x320'))));
  assert.notEqual(a, await claveDe(new URL(OK.replace('avatar', 'otra'))));
  assert.notEqual(a, await claveDe(new URL(OK.replace('scontent-mia3-1', 'scontent-lax3-1'))));
});

test('tipoDe: solo JPEG, PNG, WebP y GIF por sus bytes; SVG y HTML, no', () => {
  assert.equal(tipoDe(JPEG), 'jpeg'); assert.equal(tipoDe(SVG), null); assert.equal(tipoDe(new TextEncoder().encode('<html>hola que tal</html>')), null); assert.equal(tipoDe(new Uint8Array(5)), null);
});

async function oficina(extra = {}) {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' });
  const MEDIA = crearR2(), llamadas = [];
  let guion = () => new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  const FETCH_IMAGEN_META = async (url, init) => { llamadas.push({ url, init }); return guion(url, init); };
  const env = envDePrueba(d1, { MEDIA, FETCH_IMAGEN_META, ...extra });
  const id = d1._db.prepare('select id from users where email = ?').get(c.email).id;
  const cookie = `__Host-sesion=${await abrirSesion(d1, id)}`;
  const pedir = (u, { c = cookie, cab = {} } = {}) => manejar(new Request(`https://oficina.test/api/imagen-meta?u=${encodeURIComponent(u)}`, { headers: { ...(c ? { cookie: c } : {}), ...cab } }), env);
  return { d1, env, MEDIA, llamadas, pedir, cookie, id, poner: (f) => { guion = f; } };
}

test('sirve la imagen con sandbox, nosniff, caché privada y ETag; la copia queda en R2 y la segunda vez no sale a Meta ni aunque la URL haya cambiado de firma', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = await o.pedir(OK);
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.match(r.headers.get('content-security-policy'), /sandbox/); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('cache-control'), /private, max-age=86400/); assert.match(r.headers.get('etag'), /^"[0-9a-f]{40}"$/);
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [...JPEG]);
  assert.equal(o.llamadas.length, 1); assert.equal(o.llamadas[0].init.redirect, 'manual'); assert.equal(o.llamadas[0].init.headers.cookie, undefined, 'sin credenciales');
  assert.equal([...o.MEDIA._m.keys()].filter((k) => k.startsWith('contenido/imagen-meta/')).length, 1);
  // Meta ya no responde y la firma es otra: se sirve la copia
  o.poner(() => new Response('caducó', { status: 403 }));
  const r2 = await o.pedir(OK.replace('oh=AAA', 'oh=ZZZ'));
  assert.equal(r2.status, 200); assert.equal(o.llamadas.length, 1, 'no volvió a llamar a Meta');
  // If-None-Match
  const r3 = await o.pedir(OK, { cab: { 'if-none-match': r.headers.get('etag') } }); assert.equal(r3.status, 304);
});

test('lo que no se debe servir: hosts ajenos, no imágenes, SVG con script, más de 5 MB, un fallo de Meta; y sin sesión es 401', { skip: SALTAR }, async () => {
  const o = await oficina();
  for (const u of ['https://evilfbcdn.net/a.jpg', 'https://fbcdn.net.evil.com/a.jpg', 'http://scontent.fbcdn.net/a.jpg', 'https://u@scontent.fbcdn.net/a.jpg', 'https://127.0.0.1/a.jpg', 'https://scontent.fbcdn.net:444/a.jpg']) assert.ok([400, 403].includes((await o.pedir(u)).status), u);
  assert.equal((await o.pedir('https://scontent.fbcdn.net/a.jpg?access_token=SECRETO')).status, 400);
  assert.equal(o.llamadas.length, 0, 'nada de lo anterior salió a la red');
  o.poner(() => new Response(SVG, { status: 200, headers: { 'content-type': 'image/svg+xml' } })); assert.equal((await o.pedir('https://scontent.fbcdn.net/s.svg')).status, 404);
  o.poner(() => new Response('<html>hola que tal</html>', { status: 200, headers: { 'content-type': 'image/jpeg' } })); assert.equal((await o.pedir('https://scontent.fbcdn.net/h.jpg')).status, 404);
  o.poner(() => new Response(new Uint8Array(MAX_BYTES + 10).fill(1), { status: 200 })); assert.equal((await o.pedir('https://scontent.fbcdn.net/g.jpg')).status, 404);
  const grande = new Uint8Array(MAX_BYTES + 10); grande.set(JPEG); o.poner(() => new Response(grande, { status: 200 })); assert.equal((await o.pedir('https://scontent.fbcdn.net/g2.jpg')).status, 404, 'un JPEG real pero de más de 5 MB');
  o.poner(() => new Response('no', { status: 500 })); assert.equal((await o.pedir('https://scontent.fbcdn.net/e.jpg')).status, 404);
  assert.equal([...o.MEDIA._m.keys()].filter((k) => k.startsWith('contenido/imagen-meta/')).length, 0, 'nada malo quedó en R2');
  assert.equal((await o.pedir(OK, { c: null })).status, 401);
  assert.equal((await manejar(new Request('https://oficina.test/api/imagen-meta?u=' + encodeURIComponent(OK), { method: 'POST', headers: { cookie: o.cookie } }), o.env)).status, 405);
});

test('redirecciones: dentro de la lista blanca se siguen; hacia fuera, no; y en bucle se corta', { skip: SALTAR }, async () => {
  const o = await oficina();
  o.poner((url) => (String(url).includes('/a.jpg') ? new Response(null, { status: 302, headers: { location: 'https://scontent2.cdninstagram.com/b.jpg' } }) : new Response(JPEG, { status: 200 })));
  assert.equal((await o.pedir('https://scontent.fbcdn.net/a.jpg')).status, 200); assert.equal(o.llamadas.length, 2);
  o.llamadas.length = 0;
  o.poner(() => new Response(null, { status: 302, headers: { location: 'https://evil.com/x.jpg' } })); assert.equal((await o.pedir('https://scontent.fbcdn.net/c.jpg')).status, 404);
  o.poner(() => new Response(null, { status: 302, headers: { location: 'http://scontent.fbcdn.net/x.jpg' } })); assert.equal((await o.pedir('https://scontent.fbcdn.net/d.jpg')).status, 404, 'ni a http');
  o.poner(() => new Response(null, { status: 302, headers: { location: 'https://scontent.fbcdn.net/l.jpg' } })); assert.equal((await o.pedir('https://scontent.fbcdn.net/l.jpg')).status, 404, 'bucle');
  assert.ok(!o.llamadas.some((l) => /evil\.com/.test(l.url)), 'nunca se llamó al host de fuera');
});

test('cualquier rol con sesión la usa (lectura también); el ritmo limita las bajadas NUEVAS por persona, no las copias', { skip: SALTAR }, async () => {
  const o = await oficina({ RELOJ_MS: () => 1_700_000_000_000 });
  o.d1._db.prepare("update users set rol = 'lectura' where id = ?").run(o.id);
  assert.equal((await o.pedir(OK)).status, 200, 'lectura sí');
  for (let i = 1; i < PEDIDOS_POR_MINUTO; i++) assert.equal((await o.pedir(`https://scontent.fbcdn.net/n${i}.jpg`)).status, 200);
  assert.equal((await o.pedir('https://scontent.fbcdn.net/de-mas.jpg')).status, 429, 'la bajada número 61 en el minuto');
  assert.equal((await o.pedir(OK)).status, 200, 'una copia ya guardada se sirve aunque se pasara el ritmo');
});

test('la URL (con su firma) no se registra: ningún console.* la lleva', { skip: SALTAR }, async () => {
  const o = await oficina(); const vistos = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  for (const k of Object.keys(orig)) console[k] = (...a) => vistos.push(a.join(' '));
  try { await o.pedir(OK); o.poner(() => new Response('x', { status: 500 })); await o.pedir('https://scontent.fbcdn.net/zz.jpg?stp=1'); } finally { Object.assign(console, orig); }
  assert.ok(!vistos.some((v) => /fbcdn|cdninstagram|oh=/.test(v)), vistos.join('\n'));
});

// SEG-09: la copia en R2 expira (30 días) y tiene tope total (200 MB → baja a 160 MB, borrando lo más viejo)
import { podarImagenesMeta, RAIZ, DIAS_COPIA } from '../worker/lib/imagen-meta.js';
test('SEG-09: la poda borra lo subido hace más de 30 días y solo bajo contenido/imagen-meta/', async () => {
  const r2 = crearR2(), ahora = Date.now(), dia = 864e5;
  await r2.put(RAIZ + 'vieja.jpeg', JPEG, { __subida: new Date(ahora - (DIAS_COPIA + 1) * dia) });
  await r2.put(RAIZ + 'reciente.jpeg', JPEG, { __subida: new Date(ahora - 5 * dia) });
  await r2.put('clientes/otra/foto.jpeg', JPEG, { __subida: new Date(ahora - 90 * dia) });
  const x = await podarImagenesMeta(r2, ahora);
  assert.equal(x.borradas, 1); assert.deepEqual([...r2._m.keys()].sort(), ['clientes/otra/foto.jpeg', RAIZ + 'reciente.jpeg']);
});
test('SEG-09: pasado el tope total se borra lo más viejo hasta el objetivo; bajo el tope no se toca nada', async () => {
  const r2 = crearR2(), ahora = Date.now(), dia = 864e5, grande = new Uint8Array(1000).fill(1);
  for (let i = 0; i < 10; i++) await r2.put(RAIZ + `f${i}.jpeg`, grande, { __subida: new Date(ahora - (i + 1) * dia) }); // f9 es la más vieja
  assert.equal((await podarImagenesMeta(r2, ahora, { tope: 10_000, objetivo: 5000 })).borradas, 0, 'justo en el tope: nada');
  const x = await podarImagenesMeta(r2, ahora, { tope: 9000, objetivo: 5000 });
  assert.equal(x.borradas, 5); assert.ok(!r2._m.has(RAIZ + 'f9.jpeg') && !r2._m.has(RAIZ + 'f5.jpeg') && r2._m.has(RAIZ + 'f4.jpeg') && r2._m.has(RAIZ + 'f0.jpeg'));
  assert.equal((await podarImagenesMeta(null, ahora)).borradas, 0, 'sin R2 no hace nada');
});
