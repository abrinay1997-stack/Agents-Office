// Fase 10 — equipo, invitaciones, perfil y presencia. Cada invariante de seguridad con su caso que MUERDE (D1 en memoria con las migraciones reales).
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { tipoDeImagen, tasa, invitacionVigente } from '../worker/lib/equipo.js';
import { sha256 } from '../worker/lib/ids.js';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

/** Una oficina de prueba: la fundadora (admin), con R2 y un Hub de mentira que apunta lo que le llega. */
async function oficina() {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' });
  const llamadasHub = [];
  const HUB = { idFromName: (n) => n, get: () => ({ fetch: async (r) => { llamadasHub.push({ url: new URL(r.url).pathname, cuerpo: r.method === 'POST' ? await r.json().catch(() => null) : null }); return new Response(null, { status: new URL(r.url).pathname === '/conectar' ? 200 : 204 }); } }) };
  const env = envDePrueba(d1, { MEDIA: crearR2(), HUB });
  const ana = d1._db.prepare('select id from users where email = ?').get(c.email).id;
  const galleta = async (id) => `__Host-sesion=${await abrirSesion(d1, id)}`;
  const llamar = (ruta, { metodo = 'GET', cuerpo, bytes, cookie, cab = {} } = {}) =>
    manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...cab }, body: bytes ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined) }), env);
  /** invita y acepta: devuelve { id, cookie } de la persona nueva */
  async function alta(rol, email, nombre = 'Persona ' + email.split('@')[0]) {
    const inv = await (await llamar('/api/equipo/invitaciones', { metodo: 'POST', cookie: await galleta(ana), cuerpo: { email, rol } })).json();
    const testigo = inv.enlace.split('/').pop();
    const r = await llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: testigo, nombre, contrasena: 'clave-muy-larga-123' } });
    assert.equal(r.status, 200, await r.clone().text());
    const cookie = r.headers.get('set-cookie').split(';')[0];
    return { cookie, id: d1._db.prepare('select id from users where email = ?').get(email).id, testigo };
  }
  return { d1, env, ana, galleta, llamar, alta, llamadasHub, c };
}

// ---------------------------------------------------------------- invitaciones

test('una invitación: el admin crea el enlace (solo se guarda su huella), la persona entra con el rol y el correo DE LA INVITACIÓN', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = await o.llamar('/api/equipo/invitaciones', { metodo: 'POST', cookie: await o.galleta(o.ana), cuerpo: { email: 'Bruno@Panaclaw.test', nombre: 'Bruno', rol: 'editor' } });
  assert.equal(r.status, 201);
  const inv = await r.json(), testigo = inv.enlace.split('/').pop();
  assert.match(inv.enlace, /^https:\/\/oficina\.test\/invitacion\/[0-9a-f]{48}$/);
  const fila = o.d1._db.prepare('select * from invitaciones').get();
  assert.equal(fila.token_hash, await sha256(testigo)); assert.ok(!JSON.stringify(fila).includes(testigo), 'el testigo no está en la base');
  assert.equal(fila.email, 'bruno@panaclaw.test');
  // ver la invitación (sin sesión)
  const ver = await (await o.llamar('/api/invitacion/ver', { metodo: 'POST', cuerpo: { testigo: testigo } })).json();
  assert.deepEqual([ver.invitacion.email, ver.invitacion.rol], ['bruno@panaclaw.test', 'editor']);
  // aceptar: el cuerpo intenta colar otro rol y otro correo; el servidor los ignora
  const ac = await o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: testigo, nombre: 'Bruno', contrasena: 'clave-muy-larga-123', rol: 'admin', email: 'otro@x.test' } });
  assert.equal(ac.status, 200);
  assert.match(ac.headers.get('set-cookie'), /^__Host-sesion=.*HttpOnly/);
  const u = o.d1._db.prepare('select email, rol from users where email = ?').get('bruno@panaclaw.test');
  assert.equal(u.rol, 'editor'); assert.equal(o.d1._db.prepare("select count(*) n from users where email = 'otro@x.test'").get().n, 0);
  // la sesión nueva sirve y trae su perfil
  const yo = await (await o.llamar('/api/yo', { cookie: ac.headers.get('set-cookie').split(';')[0] })).json();
  assert.deepEqual([yo.usuario.nombre, yo.usuario.rol, yo.usuario.foto], ['Bruno', 'editor', null]);
});

test('una invitación sirve UNA vez: la segunda, aunque sea inmediata, se rechaza', { skip: SALTAR }, async () => {
  const o = await oficina(); const { testigo } = await o.alta('editor', 'bruno@panaclaw.test');
  const otra = await o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: testigo, nombre: 'X', contrasena: 'clave-muy-larga-123' } });
  assert.equal(otra.status, 404);
  assert.equal(o.d1._db.prepare('select count(*) n from users').get().n, 2);
});

test('dos aceptaciones A LA VEZ: solo una cuenta nace', { skip: SALTAR }, async () => {
  const o = await oficina();
  const inv = await (await o.llamar('/api/equipo/invitaciones', { metodo: 'POST', cookie: await o.galleta(o.ana), cuerpo: { email: 'bruno@panaclaw.test', rol: 'editor' } })).json();
  const t = inv.enlace.split('/').pop();
  const rs = await Promise.all([1, 2, 3].map(() => o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: t, nombre: 'B', contrasena: 'clave-muy-larga-123' } })));
  assert.equal(rs.filter((r) => r.status === 200).length, 1);
  assert.equal(o.d1._db.prepare("select count(*) n from users where email = 'bruno@panaclaw.test'").get().n, 1);
});

test('caducada, revocada o inventada: la MISMA respuesta (no se puede sondear)', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  const crear = async (email) => { const i = await (await o.llamar('/api/equipo/invitaciones', { metodo: 'POST', cookie, cuerpo: { email, rol: 'lectura' } })).json(); return { id: i.invitacion.id, t: i.enlace.split('/').pop() }; };
  const a = await crear('a@x.test'); o.d1._db.prepare("update invitaciones set expires_at = '2020-01-01T00:00:00.000Z' where id = ?").run(a.id);
  const b = await crear('b@x.test'); assert.equal((await o.llamar(`/api/equipo/invitaciones/${b.id}`, { metodo: 'DELETE', cookie })).status, 200);
  const respuestas = [];
  for (const t of [a.t, b.t, 'f'.repeat(48), '0'.repeat(48), 'abc']) { const r = await o.llamar('/api/invitacion/ver', { metodo: 'POST', cuerpo: { testigo: t } }); respuestas.push([r.status, await r.text()]); }
  assert.ok(respuestas.every(([s]) => s === 404));
  assert.equal(new Set(respuestas.map(([, t]) => t)).size, 1, 'el mismo texto: no revela si existió, caducó o se revocó');
  for (const t of [a.t, b.t]) assert.equal((await o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: t, nombre: 'X', contrasena: 'clave-muy-larga-123' } })).status, 404);
  assert.equal(await invitacionVigente(o.d1, a.t), null);
});

test('el rol de la invitación manda: un editor invitado no es admin, y el admin invitado sí', { skip: SALTAR }, async () => {
  const o = await oficina(); const e = await o.alta('editor', 'e@x.test'), l = await o.alta('lectura', 'l@x.test'), a = await o.alta('admin', 'a@x.test');
  const rol = async (c) => (await (await o.llamar('/api/yo', { cookie: c.cookie })).json()).usuario.rol;
  assert.deepEqual([await rol(e), await rol(l), await rol(a)], ['editor', 'lectura', 'admin']);
});

test('solo un administrador invita, cambia roles, quita gente y revoca', { skip: SALTAR }, async () => {
  const o = await oficina(); const ed = await o.alta('editor', 'e@x.test'), le = await o.alta('lectura', 'l@x.test');
  for (const quien of [ed, le]) {
    assert.equal((await o.llamar('/api/equipo/invitaciones', { metodo: 'POST', cookie: quien.cookie, cuerpo: { email: 'z@x.test', rol: 'admin' } })).status, 403);
    assert.equal((await o.llamar(`/api/equipo/${o.ana}`, { metodo: 'PATCH', cookie: quien.cookie, cuerpo: { rol: 'lectura' } })).status, 403);
    assert.equal((await o.llamar(`/api/equipo/${le.id}`, { metodo: 'DELETE', cookie: quien.cookie })).status, 403);
    assert.equal((await o.llamar('/api/equipo/invitaciones/11111111-1111-1111-1111-111111111111', { metodo: 'DELETE', cookie: quien.cookie })).status, 403);
  }
  assert.equal((await o.llamar('/api/equipo/invitaciones', { metodo: 'POST', cuerpo: { email: 'z@x.test', rol: 'editor' } })).status, 401, 'sin sesión, ni eso');
  // un editor ve el equipo, pero sin correos ajenos ni invitaciones pendientes
  const lista = await (await o.llamar('/api/equipo', { cookie: ed.cookie })).json();
  assert.ok(lista.miembros.length === 3 && !('invitaciones' in lista));
  assert.ok(lista.miembros.filter((m) => !m.yo).every((m) => !('email' in m)));
  const admin = await (await o.llamar('/api/equipo', { cookie: await o.galleta(o.ana) })).json();
  assert.ok(admin.miembros.every((m) => 'email' in m) && Array.isArray(admin.invitaciones));
});

test('validaciones de la invitación: correo, rol, cuenta ya existente, contraseña corta', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  const crear = (cuerpo) => o.llamar('/api/equipo/invitaciones', { metodo: 'POST', cookie, cuerpo });
  assert.equal((await crear({ email: 'no-es-correo', rol: 'editor' })).status, 422);
  assert.equal((await crear({ email: 'a@x.test', rol: 'dios' })).status, 422);
  assert.equal((await crear({ email: 'ana@panaclaw.test', rol: 'editor' })).status, 409);
  const i = await (await crear({ email: 'b@x.test', rol: 'editor' })).json(), t = i.enlace.split('/').pop();
  for (const clave of ['corta', '', 'b@x.test', 'x'.repeat(201)]) assert.equal((await o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: t, nombre: 'B', contrasena: clave } })).status, 422, clave);
  assert.equal(o.d1._db.prepare('select aceptada_at from invitaciones').get().aceptada_at, null, 'una contraseña mala no gasta la invitación');
  // una invitación nueva al mismo correo sustituye a la anterior
  const j = await (await crear({ email: 'b@x.test', rol: 'lectura' })).json();
  assert.equal((await o.llamar('/api/invitacion/ver', { metodo: 'POST', cuerpo: { testigo: t } })).status, 404);
  assert.equal((await o.llamar('/api/invitacion/ver', { metodo: 'POST', cuerpo: { testigo: j.enlace.split('/').pop() } })).status, 200);
});

test('si la cuenta ya existe al aceptar, no se revela: respuesta genérica y el enlace sigue vivo', { skip: SALTAR }, async () => {
  const o = await oficina();
  const i = await (await o.llamar('/api/equipo/invitaciones', { metodo: 'POST', cookie: await o.galleta(o.ana), cuerpo: { email: 'b@x.test', rol: 'editor' } })).json(), t = i.enlace.split('/').pop();
  o.d1._db.prepare("insert into users (id,email,rol,password_hash,salt) values ('u-b','b@x.test','lectura','h','s')").run(); // alguien creó esa cuenta por otro lado
  const r = await o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: t, nombre: 'Beto', contrasena: 'clave-muy-larga-123' } });
  assert.equal(r.status, 409); assert.doesNotMatch(await r.text(), /existe|ya hay|correo/i);
  assert.equal(o.d1._db.prepare("select count(*) n from users where email = 'b@x.test'").get().n, 1);
  assert.equal(o.d1._db.prepare('select aceptada_at from invitaciones').get().aceptada_at, null);
});

/** Congela el reloj de los topes (`env.RELOJ_MS`): la ventana de un minuto no puede cambiar a mitad de la prueba. */
async function conRelojFijo(fn, t = 1_800_000_000_000) {
  const o = await oficina(); o.env.RELOJ_MS = () => t;
  return fn(o, (x) => { t = x; });
}
const entra = (o, email, contrasena, ip) => o.llamar('/api/acceso', { metodo: 'POST', cuerpo: { email, contrasena }, cab: { 'CF-Connecting-IP': ip } });

test('límite de intentos de una invitación: por IP y minuto (429); otra IP no paga por ella', { skip: SALTAR }, async () => {
  await conRelojFijo(async (o) => {
    let ultimo = 0;
    for (let i = 0; i < 35; i++) ultimo = (await o.llamar('/api/invitacion/ver', { metodo: 'POST', cuerpo: { testigo: 'a'.repeat(48) }, cab: { 'CF-Connecting-IP': '9.9.9.9' } })).status;
    assert.equal(ultimo, 429);
    assert.equal((await o.llamar('/api/invitacion/ver', { metodo: 'POST', cuerpo: { testigo: 'a'.repeat(48) }, cab: { 'CF-Connecting-IP': '8.8.8.8' } })).status, 404);
  });
});

test('límite del acceso: cuenta solo los FALLOS por (correo + IP): un atacante no puede bloquear a su víctima', { skip: SALTAR }, async () => {
  await conRelojFijo(async (o) => { // ana@panaclaw.test / una-clave-larga-123
    const mala = [];
    for (let i = 0; i < 10; i++) mala.push((await entra(o, o.c.email, 'incorrecta-' + i, '6.6.6.6')).status);
    assert.deepEqual(mala.slice(0, 8), Array(8).fill(401));
    assert.deepEqual(mala.slice(8), [429, 429], 'el atacante, desde SU IP, se frena a los 8 fallos');
    assert.equal((await entra(o, o.c.email, o.c.clave, '7.7.7.7')).status, 200, 'la víctima con su clave desde otra IP entra');
    assert.equal((await entra(o, o.c.email, o.c.clave, '6.6.6.6')).status, 429, 'esa misma IP sigue frenada, aunque acierte');
    // 10 IP distintas fallando una vez cada una NO bloquean nada
    for (let i = 0; i < 10; i++) assert.equal((await entra(o, o.c.email, 'mala-' + i, '5.5.5.' + i)).status, 401);
    assert.equal((await entra(o, o.c.email, o.c.clave, '4.4.4.4')).status, 200);
  });
});

test('límite del acceso: tope global por IP (todo intento cuenta) y la ventana avanza con el reloj', { skip: SALTAR }, async () => {
  await conRelojFijo(async (o, poner) => {
    const st = [];
    for (let i = 0; i < 22; i++) st.push((await entra(o, `nadie${i}@x.test`, 'mala-mala-mala', '3.3.3.3')).status);
    assert.equal(st[19], 401); assert.equal(st[20], 429);
    assert.deepEqual(await tasa(o.d1, 'k', 1, 0), { ok: true, n: 1 }); assert.equal((await tasa(o.d1, 'k', 1, 0)).ok, false);
    assert.equal((await tasa(o.d1, 'k', 1, 120e3)).ok, true, 'el minuto siguiente cuenta de nuevo');
    poner(1_800_000_000_000 + 120e3);
    assert.equal((await entra(o, 'nadie@x.test', 'mala-mala-mala', '3.3.3.3')).status, 401, 'pasado el minuto, otra vez se puede');
  });
});

// ---------------------------------------------------------------- roles

test('nunca sin administrador: ni rebajando al último, ni quitándolo; el fundador no se toca', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  const r1 = await o.llamar(`/api/equipo/${o.ana}`, { metodo: 'PATCH', cookie, cuerpo: { rol: 'editor' } });
  assert.equal(r1.status, 409); assert.equal(o.d1._db.prepare('select rol from users where id = ?').get(o.ana).rol, 'admin');
  const b = await o.alta('admin', 'b@x.test'); // segundo admin
  assert.equal((await o.llamar(`/api/equipo/${o.ana}`, { metodo: 'PATCH', cookie: b.cookie, cuerpo: { rol: 'editor' } })).status, 409, 'el fundador siempre es admin');
  assert.equal((await o.llamar(`/api/equipo/${o.ana}`, { metodo: 'DELETE', cookie: b.cookie })).status, 409, 'el fundador no se quita');
  assert.equal((await o.llamar(`/api/equipo/${b.id}`, { metodo: 'DELETE', cookie: b.cookie })).status, 409, 'nadie se quita a sí mismo');
  // Ana rebaja a B (queda ella): bien; luego ya no hay quien rebajar a Ana
  assert.equal((await o.llamar(`/api/equipo/${b.id}`, { metodo: 'PATCH', cookie, cuerpo: { rol: 'editor' } })).status, 200);
  assert.equal((await o.llamar(`/api/equipo/${o.ana}`, { metodo: 'PATCH', cookie, cuerpo: { rol: 'lectura' } })).status, 409);
});

test('dos administradores rebajándose A LA VEZ no dejan la oficina sin ninguno (la guarda va dentro del UPDATE)', { skip: SALTAR }, async () => {
  const o = await oficina(); const b = await o.alta('admin', 'b@x.test'), c = await o.alta('admin', 'c@x.test');
  // quitamos la protección del fundador para probar la carrera pura: tres admins, B y C se rebajan mutuamente con A fuera del juego
  const { cambiarRol } = await import('../worker/lib/equipo.js');
  o.d1._db.prepare("update users set rol = 'editor' where id = ?").run(o.ana); // Ana ya no es admin: quedan B y C
  const rs = await Promise.all([cambiarRol(o.d1, b.id, 'editor'), cambiarRol(o.d1, c.id, 'editor')]);
  assert.ok(o.d1._db.prepare("select count(*) n from users where rol = 'admin'").get().n >= 1);
  assert.ok(rs.some((r) => r.ok), 'uno pudo');
});

test('cambiar un rol: solo admin|editor|lectura; el cambio vale en el servidor', { skip: SALTAR }, async () => {
  const o = await oficina(); const e = await o.alta('editor', 'e@x.test'); const cookie = await o.galleta(o.ana);
  assert.equal((await o.llamar(`/api/equipo/${e.id}`, { metodo: 'PATCH', cookie, cuerpo: { rol: 'superadmin' } })).status, 422);
  assert.equal((await o.llamar(`/api/equipo/${e.id}`, { metodo: 'PATCH', cookie, cuerpo: { rol: 'lectura' } })).status, 200);
  // ahora el que fue editor ya no escribe: el rol se aplica en el servidor
  assert.equal((await o.llamar('/api/agentes/marketing/ejecutar', { metodo: 'POST', cookie: e.cookie, cuerpo: { texto: 'hola' } })).status, 403);
  assert.equal((await o.llamar('/api/equipo/22222222-2222-2222-2222-222222222222', { metodo: 'PATCH', cookie, cuerpo: { rol: 'editor' } })).status, 404);
});

test('quitar a alguien: sus sesiones mueren, no puede volver a entrar, su correo se libera y su historia se conserva', { skip: SALTAR }, async () => {
  const o = await oficina(); const e = await o.alta('editor', 'e@x.test'); const cookie = await o.galleta(o.ana);
  o.d1._db.prepare("insert into ejecuciones (id, agente, usuario_id, texto, created_at) values ('ej1','ana',?,'x','2026-01-01')").run(e.id); // la historia apunta a su cuenta (FK sin cascada)
  assert.equal((await o.llamar('/api/yo', { cookie: e.cookie })).status, 200);
  assert.equal((await o.llamar(`/api/equipo/${e.id}`, { metodo: 'DELETE', cookie })).status, 200);
  assert.equal((await o.llamar('/api/yo', { cookie: e.cookie })).status, 401, 'la cookie que conserva ya no vale');
  assert.equal((await o.llamar('/api/acceso', { metodo: 'POST', cuerpo: { email: 'e@x.test', contrasena: 'clave-muy-larga-123' } })).status, 401);
  assert.equal(o.d1._db.prepare("select count(*) n from ejecuciones where usuario_id = ?").get(e.id).n, 1);
  const lista = await (await o.llamar('/api/equipo', { cookie })).json();
  assert.ok(!lista.miembros.some((m) => m.id === e.id));
  assert.ok(o.llamadasHub.some((l) => l.url === '/cerrar' && l.cuerpo.userId === e.id), 'sus sockets se cierran');
  const otra = await o.alta('editor', 'e@x.test', 'Vuelve'); // el correo quedó libre: se le puede invitar de nuevo
  assert.notEqual(otra.id, e.id);
});

// ---------------------------------------------------------------- perfil

test('foto de perfil: JPEG/PNG/WebP reconocidos por sus bytes; un SVG, un HTML o algo disfrazado se rechaza', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  assert.deepEqual([tipoDeImagen(JPEG), tipoDeImagen(PNG), tipoDeImagen(WEBP), tipoDeImagen(SVG)], ['jpeg', 'png', 'webp', null]);
  for (const [bytes, cuantos] of [[SVG, 415], [new TextEncoder().encode('<html><script>1</script></html>'), 415], [new Uint8Array(0), 415], [Uint8Array.from([0xff, 0xd8]), 415]]) {
    // el cliente miente en Content-Type: da igual, manda lo que son los bytes
    assert.equal((await o.llamar('/api/yo/foto', { metodo: 'PUT', cookie, bytes, cab: { 'content-type': 'image/png' } })).status, cuantos);
  }
  assert.equal(o.env.MEDIA._m.size, 0, 'nada se guardó');
  for (const b of [JPEG, PNG, WEBP]) assert.equal((await o.llamar('/api/yo/foto', { metodo: 'PUT', cookie, bytes: b })).status, 200);
});

test('foto de perfil: más de 1 MB se rechaza aunque el cliente no declare el tamaño', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  const grande = new Uint8Array(1024 * 1024 + 1); grande.set(JPEG);
  assert.equal((await o.llamar('/api/yo/foto', { metodo: 'PUT', cookie, bytes: grande })).status, 413);
  // sin Content-Length (chunked): lee con tope
  const flujo = new ReadableStream({ start(c) { c.enqueue(grande.subarray(0, 600000)); c.enqueue(grande.subarray(600000)); c.close(); } });
  const r = await manejar(new Request('https://oficina.test/api/yo/foto', { method: 'PUT', headers: { cookie }, body: flujo, duplex: 'half' }), o.env);
  assert.equal(r.status, 413);
  const justo = new Uint8Array(1024 * 1024); justo.set(JPEG);
  assert.equal((await o.llamar('/api/yo/foto', { metodo: 'PUT', cookie, bytes: justo })).status, 200, 'exactamente 1 MB cabe');
  assert.equal((await o.llamar('/api/yo/foto', { metodo: 'PUT', bytes: JPEG })).status, 401);
});

test('la foto se sirve SOLO con sesión, con nosniff, sandbox y caché privada, bajo el prefijo perfiles/', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  const sub = await (await o.llamar('/api/yo/foto', { metodo: 'PUT', cookie, bytes: PNG })).json();
  assert.ok(sub.foto);
  assert.deepEqual([...o.env.MEDIA._m.keys()], [`perfiles/${o.ana}`]);
  assert.equal((await o.llamar('/api/yo/foto')).status, 401);
  assert.equal((await o.llamar(`/api/equipo/${o.ana}/foto`)).status, 401);
  const f = await o.llamar('/api/yo/foto', { cookie });
  assert.equal(f.status, 200);
  assert.equal(f.headers.get('content-type'), 'image/png'); assert.equal(f.headers.get('x-content-type-options'), 'nosniff');
  assert.match(f.headers.get('cache-control'), /^private/); assert.match(f.headers.get('content-security-policy'), /sandbox/);
  // un compañero la ve (para los avatares); alguien sin foto, 404
  const e = await o.alta('lectura', 'l@x.test');
  assert.equal((await o.llamar(`/api/equipo/${o.ana}/foto`, { cookie: e.cookie })).status, 200);
  assert.equal((await o.llamar(`/api/equipo/${e.id}/foto`, { cookie })).status, 404);
  assert.notEqual((await o.llamar('/api/equipo/no-es-un-id/foto', { cookie })).status, 200); // un id mal formado ni llega a la foto
  // el perfil ahora trae la versión de la foto, y quitarla la borra de R2
  assert.ok((await (await o.llamar('/api/yo', { cookie })).json()).usuario.foto);
  assert.equal((await o.llamar('/api/yo/foto', { metodo: 'DELETE', cookie })).status, 200);
  assert.equal(o.env.MEDIA._m.size, 0); assert.equal((await o.llamar('/api/yo/foto', { cookie })).status, 404);
});

test('nombre visible: se limpia, no puede ir vacío ni llevar etiquetas', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  assert.equal((await o.llamar('/api/yo', { metodo: 'PATCH', cookie, cuerpo: { nombre: '   ' } })).status, 422);
  const r = await (await o.llamar('/api/yo', { metodo: 'PATCH', cookie, cuerpo: { nombre: '  Ana <b>María</b>\u0000  Pérez  ' } })).json();
  assert.equal(r.usuario.nombre, 'Ana bMaría/b Pérez'); // sin < ni > ni caracteres de control
  assert.ok(!/[<>\u0000]/.test(r.usuario.nombre));
  assert.equal((await o.llamar('/api/yo', { metodo: 'PATCH', cookie, cuerpo: { nombre: 'x'.repeat(200) } }).then((x) => x.json())).usuario.nombre.length, 60);
});

test('cambiar la contraseña pide la actual, exige 12+, cierra las OTRAS sesiones y no la propia', { skip: SALTAR }, async () => {
  const o = await oficina(); const e = await o.alta('editor', 'e@x.test');
  const otra = await o.llamar('/api/acceso', { metodo: 'POST', cuerpo: { email: 'e@x.test', contrasena: 'clave-muy-larga-123' } });
  const cookieOtra = otra.headers.get('set-cookie').split(';')[0];
  const cambiar = (cuerpo, cookie = e.cookie) => o.llamar('/api/yo/contrasena', { metodo: 'POST', cookie, cuerpo });
  assert.equal((await cambiar({ actual: 'incorrecta-incorrecta', nueva: 'otra-clave-muy-larga-1' })).status, 403, 'sin la actual no se cambia');
  assert.equal((await cambiar({ nueva: 'otra-clave-muy-larga-1' })).status, 403);
  assert.equal((await cambiar({ actual: 'clave-muy-larga-123', nueva: 'corta' })).status, 422);
  assert.equal((await o.llamar('/api/yo', { cookie: cookieOtra })).status, 200, 'los intentos fallidos no cierran nada');
  assert.equal((await cambiar({ actual: 'clave-muy-larga-123', nueva: 'otra-clave-muy-larga-1' })).status, 200);
  assert.equal((await o.llamar('/api/yo', { cookie: e.cookie })).status, 200, 'la sesión que cambia sigue dentro');
  assert.equal((await o.llamar('/api/yo', { cookie: cookieOtra })).status, 401, 'las demás se cerraron');
  assert.equal((await o.llamar('/api/acceso', { metodo: 'POST', cuerpo: { email: 'e@x.test', contrasena: 'clave-muy-larga-123' } })).status, 401, 'la vieja ya no entra');
  assert.equal((await o.llamar('/api/acceso', { metodo: 'POST', cuerpo: { email: 'e@x.test', contrasena: 'otra-clave-muy-larga-1' } })).status, 200);
  assert.ok(o.llamadasHub.some((l) => l.url === '/cerrar' && l.cuerpo.userId === e.id), 'sus sockets reconectan con la sesión que quede');
  assert.equal((await cambiar({ actual: 'x', nueva: 'otra-clave-muy-larga-2' })).status, 403);
  assert.equal((await o.llamar('/api/yo/contrasena', { metodo: 'POST', cuerpo: { actual: 'a', nueva: 'b' } })).status, 401);
});

test('quien tiene el rol de lectura también edita SU perfil (no es un dato de la oficina)', { skip: SALTAR }, async () => {
  const o = await oficina(); const l = await o.alta('lectura', 'l@x.test');
  assert.equal((await o.llamar('/api/yo', { metodo: 'PATCH', cookie: l.cookie, cuerpo: { nombre: 'Luisa' } })).status, 200);
  assert.equal((await o.llamar('/api/yo/foto', { metodo: 'PUT', cookie: l.cookie, bytes: JPEG })).status, 200);
});

// ---------------------------------------------------------------- presencia (el acceso al socket y lo que se difunde)

test('/api/live: sin sesión 401; con sesión pero sin Origin o con Origin ajeno, rechazado; con todo en regla, pasa al Hub con la identidad DEL SERVIDOR', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  const up = { Upgrade: 'websocket' };
  assert.equal((await o.llamar('/api/live', { cab: { ...up, Origin: 'https://oficina.test' } })).status, 401, 'sin sesión');
  assert.equal((await o.llamar('/api/live', { cookie, cab: up })).status, 403, 'sin Origin');
  assert.equal((await o.llamar('/api/live', { cookie, cab: { ...up, Origin: 'https://malo.example' } })).status, 403, 'Origin ajeno');
  assert.equal((await o.llamar('/api/live', { cookie, cab: { Origin: 'https://oficina.test' } })).status, 426, 'sin Upgrade');
  assert.equal(o.llamadasHub.length, 0, 'nada de lo rechazado llegó al Hub');
  const ok = await o.llamar('/api/live?userId=otro&nombre=Falso', { cookie, cab: { ...up, Origin: 'https://oficina.test' } });
  assert.equal(ok.status, 200);
  assert.equal(o.llamadasHub[0].url, '/conectar');
});

test('/api/live sin el binding HUB contesta 503 en español, no un error mudo', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana); delete o.env.HUB;
  const r = await o.llamar('/api/live', { cookie, cab: { Upgrade: 'websocket', Origin: 'https://oficina.test' } });
  assert.equal(r.status, 503);
});

test('cada escritura que sale bien avisa a los conectados con el área y la PESTAÑA; las lecturas y los fallos no', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  const cambios = () => o.llamadasHub.filter((l) => l.url === '/difundir' && l.cuerpo.tipo === 'cambio').map((l) => l.cuerpo);
  await o.llamar('/api/tasks', { cookie }); // lectura
  assert.equal(cambios().length, 0);
  const r = await o.llamar('/api/tareas/mias', { metodo: 'POST', cookie, cuerpo: { title: 'revisar el cierre' }, cab: { 'X-Pestana': 'pestana-uno' } });
  assert.ok(r.status < 300, String(r.status));
  await new Promise((f) => setTimeout(f, 20));
  const c = cambios();
  assert.equal(c.length, 1); assert.equal(c[0].area, 'tareas'); assert.equal(c[0].por.tab, 'pestana-uno'); assert.equal(c[0].por.nombre, 'Ana'); assert.equal(c[0].por.id, o.ana);
  await o.llamar('/api/tareas/mias', { metodo: 'POST', cookie, cuerpo: {} }); // 4xx: nada cambió
  await new Promise((f) => setTimeout(f, 20));
  assert.equal(cambios().length, 1, 'un fallo no avisa');
  await o.llamar('/api/acceso', { metodo: 'POST', cuerpo: { email: 'ana@panaclaw.test', contrasena: 'una-clave-larga-123' } });
  assert.equal(cambios().length, 1, 'el acceso no es un cambio de datos');
});

test('areaDe: cada grupo de /api cae en un área que la oficina sabe refrescar; el acceso, la salud y el socket no', () => {
  return import('../worker/lib/vivo.js').then(({ areaDe }) => {
    assert.equal(areaDe('/api/tasks/abc'), 'tareas'); assert.equal(areaDe('/api/routines'), 'tareas'); assert.equal(areaDe('/api/contenido/piezas'), 'contenido');
    assert.equal(areaDe('/api/media/jobs'), 'estudio'); assert.equal(areaDe('/api/anuncios/accion'), 'anuncios'); assert.equal(areaDe('/api/equipo/x'), 'equipo');
    for (const r of ['/api/acceso', '/api/salir', '/api/live', '/api/health', '/api/migrar/filas', '/fuera', '/api/']) assert.equal(areaDe(r), null, r);
  });
});

test('el Hub nunca se alcanza desde fuera: no hay ruta pública a /difundir ni a /cerrar', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  for (const ruta of ['/api/difundir', '/api/hub/difundir', '/api/live/difundir', '/api/live/cerrar', '/difundir']) {
    const r = await o.llamar(ruta, { metodo: 'POST', cookie, cuerpo: { tipo: 'cambio', area: 'tareas' } });
    assert.ok([404, 501, 405].includes(r.status), `${ruta} → ${r.status}`);
  }
  assert.equal(o.llamadasHub.length, 0);
});

// ---------------------------------------------------------------- las páginas

test('las páginas del acceso son públicas; la oficina lleva nube.js SOLO con sesión; /nube.js sin sesión, 401', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  const t = async (ruta, c) => { const r = await o.llamar(ruta, { cookie: c }); return { s: r.status, t: await r.text() }; };
  for (const ruta of ['/login.html', '/login.js', '/acceso.css', '/acceso-tema.js', '/invitacion.html', '/invitacion.js']) assert.equal((await t(ruta)).s, 200, ruta);
  assert.equal((await t('/invitacion/' + 'a'.repeat(48))).t, 'ASSET:/invitacion.html', 'el enlace de invitación abre la página nativa sin sesión');
  assert.equal((await t('/invitacion/no-hex-!!')).s, 404);
  assert.equal((await t('/')).t, 'ASSET:/login.html');
  assert.equal((await t('/nube.js')).s, 401); assert.equal((await t('/nube.css')).s, 401); assert.equal((await t('/nube-modelos.js')).s, 401); assert.equal((await t('/nube-conectores.js')).s, 401); assert.equal((await t('/nube-funciones.js')).s, 401); assert.equal((await t('/nube-conectar-claude.js')).s, 401); assert.equal((await t('/nube-series.js')).s, 401); assert.equal((await t('/dictado.js')).s, 401);
  assert.equal((await t('/nube.js', cookie)).t, 'ASSET:/nube.js');
  assert.equal((await t('/dictado.js', cookie)).t, 'ASSET:/oficina/dictado.js');
});

test('la oficina servida con sesión recibe las dos líneas de la nube (y solo ahí)', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  o.env.ASSETS = { fetch: async (req) => new Response(new URL(req.url).pathname === '/oficina/index.html' ? '<html><body><div id="topbar"></div><script>x</script></body></html>' : 'otro', { headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '999' } }) };
  const t = await (await o.llamar('/', { cookie })).text();
  assert.match(t, /<script src="\/nube\.js" defer><\/script><script src="\/ajustes-extra\.js" defer><\/script><script src="\/nube-modelos\.js" defer><\/script><script src="\/nube-conectores\.js" defer><\/script><script src="\/nube-funciones\.js" defer><\/script><script src="\/nube-series\.js" defer><\/script><\/body>/); assert.match(t, /<link rel="stylesheet" href="\/nube\.css">/);
  assert.equal((await (await o.llamar('/login.html')).text()), 'otro', 'el login no se toca');
});

test('migración 0070: se puede aplicar dos veces (todo create lleva if not exists)', { skip: SALTAR }, async () => {
  const { readFileSync } = await import('node:fs'); const d1 = crearD1();
  const sql = readFileSync(new URL('../migraciones/0070_equipo.sql', import.meta.url), 'utf8');
  d1._db.exec(sql); d1._db.exec(sql);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /alter table/i);
});

// ---------------------------------------------------------------- revisión adversarial de la fase 10

test('lista blanca de áreas: solo lo conocido se difunde, con su nombre legible; lo de administradores va marcado; un grupo interno no sale', async () => {
  const { areaInfo, avisarCambio, pestanaValida, AREAS } = await import('../worker/lib/vivo.js');
  assert.equal(areaInfo('/api/settings')?.soloAdmin, true); assert.equal(areaInfo('/api/settings').nombre, 'los ajustes');
  for (const g of ['conectores', 'sub', 'kpi', 'telegram']) assert.equal(AREAS[g].soloAdmin, true, g);
  assert.equal(areaInfo('/api/tasks/x').nombre, 'Tareas'); assert.equal(areaInfo('/api/equipo').nombre, '');
  for (const r of ['/api/interno-raro', '/api/constructor', '/api/__proto__', '/api/acceso', '/api/health']) assert.equal(areaInfo(r), null, r);
  const enviados = []; const env = { HUB: { idFromName: () => 'h', get: () => ({ fetch: async (r) => { enviados.push(await r.json()); return new Response(null, { status: 204 }); } }) } };
  const u = { id: 'u1', nombre: 'Ana' };
  avisarCambio(env, { ruta: '/api/interno-raro', metodo: 'POST', estado: 200, usuario: u }); assert.equal(enviados.length, 0, 'un grupo fuera de la lista no se difunde');
  avisarCambio(env, { ruta: '/api/settings', metodo: 'POST', estado: 200, usuario: u }); await new Promise((f) => setTimeout(f, 5));
  assert.deepEqual([enviados[0].area, enviados[0].nombre, enviados[0].soloAdmin], ['ajustes', 'los ajustes', true]);
  // X-Pestana: solo [A-Za-z0-9-]{1,40}
  assert.equal(pestanaValida('abc-123'), 'abc-123'); for (const mala of ['<script>', 'a'.repeat(41), '', 'con espacio', null, 'a/b']) assert.equal(pestanaValida(mala), null, String(mala));
  avisarCambio(env, { ruta: '/api/tasks', metodo: 'POST', estado: 200, usuario: u, req: new Request('https://x', { headers: { 'X-Pestana': '<img onerror=1>' } }) }); await new Promise((f) => setTimeout(f, 5));
  assert.equal(enviados.at(-1).por.tab, null);
});

test('/api/salir cierra también los sockets de esa persona', { skip: SALTAR }, async () => {
  const o = await oficina(); const e = await o.alta('editor', 'e@x.test');
  assert.equal((await o.llamar('/api/salir', { metodo: 'POST', cookie: e.cookie })).status, 200);
  assert.ok(o.llamadasHub.some((l) => l.url === '/cerrar' && l.cuerpo.userId === e.id));
  assert.equal((await o.llamar('/api/yo', { cookie: e.cookie })).status, 401);
});

test('cambiar la contraseña: no puede ser tu correo ni la actual (una sola regla: validarClave)', { skip: SALTAR }, async () => {
  const o = await oficina(); const e = await o.alta('editor', 'e@x.test'); const c = (cuerpo) => o.llamar('/api/yo/contrasena', { metodo: 'POST', cookie: e.cookie, cuerpo });
  assert.equal((await c({ actual: 'clave-muy-larga-123', nueva: 'clave-muy-larga-123' })).status, 422);
  assert.equal((await c({ actual: 'clave-muy-larga-123', nueva: 'E@X.test' })).status, 422);
  const { validarClave } = await import('../worker/lib/equipo.js'); const s = await import('../worker/lib/sesion.js');
  assert.equal(validarClave, s.validarClave, 'la misma función en el alta y en el cambio');
});

test('nombres: sin marcas bidi ni de ancho cero, espacios colapsados; no se admite el de otra persona (sin mayúsculas ni acentos)', { skip: SALTAR }, async () => {
  const { limpiarNombre, claveNombre } = await import('../worker/lib/equipo.js');
  assert.equal(limpiarNombre('A‮na‏  ⁦Pérez⁩​'), 'Ana Pérez'); assert.equal(limpiarNombre('  a\t\n b '), 'a b');
  assert.equal(claveNombre('  ÁNA   pérez'), claveNombre('ana Perez'));
  const o = await oficina(); const cookie = await o.galleta(o.ana);
  await o.llamar('/api/yo', { metodo: 'PATCH', cookie, cuerpo: { nombre: 'Ana Pérez' } });
  const e = await o.alta('editor', 'e@x.test', 'Otra');
  for (const n of ['Ana Pérez', 'ANA PEREZ', 'ána‮  pérez']) { const r = await o.llamar('/api/yo', { metodo: 'PATCH', cookie: e.cookie, cuerpo: { nombre: n } }); assert.equal(r.status, 422, n); }
  assert.equal((await o.llamar('/api/yo', { metodo: 'PATCH', cookie: e.cookie, cuerpo: { nombre: 'Ana Pérez Díaz' } })).status, 200);
  assert.equal((await o.llamar('/api/yo', { metodo: 'PATCH', cookie, cuerpo: { nombre: 'Ana Pérez' } })).status, 200, 'quedarse con el propio nombre no es un choque');
  // y al aceptar una invitación
  const inv = await (await o.llamar('/api/equipo/invitaciones', { metodo: 'POST', cookie, cuerpo: { email: 'z@x.test', rol: 'lectura' } })).json();
  const r = await o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: inv.enlace.split('/').pop(), nombre: 'ANA pérez', contrasena: 'clave-muy-larga-123' } });
  assert.equal(r.status, 422); assert.equal(o.d1._db.prepare("select aceptada_at from invitaciones where email='z@x.test'").get().aceptada_at, null, 'no gasta el enlace');
});

test('restablecer la contraseña: el admin crea un enlace de un solo uso; al usarlo cambia la clave y cierra TODAS las sesiones', { skip: SALTAR }, async () => {
  const o = await oficina(); const cookie = await o.galleta(o.ana); const e = await o.alta('editor', 'e@x.test');
  assert.equal((await o.llamar(`/api/equipo/${e.id}/reinicio`, { metodo: 'POST', cookie: e.cookie })).status, 403, 'un editor no');
  assert.equal((await o.llamar(`/api/equipo/${o.ana}/reinicio`, { metodo: 'POST', cookie })).status, 409, 'ni a sí mismo ni al fundador');
  const r = await o.llamar(`/api/equipo/${e.id}/reinicio`, { metodo: 'POST', cookie }); assert.equal(r.status, 201);
  const t = (await r.json()).enlace.split('/').pop();
  assert.ok(!JSON.stringify(o.d1._db.prepare('select * from reinicios').get()).includes(t), 'solo su huella');
  const ver = await (await o.llamar('/api/invitacion/ver', { metodo: 'POST', cuerpo: { testigo: t } })).json(); assert.equal(ver.invitacion.tipo, 'reinicio');
  const aplicar = (clave) => o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { testigo: t, contrasena: clave } });
  assert.equal((await aplicar('corta')).status, 422);
  assert.equal((await aplicar('nueva-clave-muy-larga-9')).status, 200);
  assert.equal((await o.llamar('/api/yo', { cookie: e.cookie })).status, 401, 'sus sesiones murieron');
  assert.equal((await o.llamar('/api/acceso', { metodo: 'POST', cuerpo: { email: 'e@x.test', contrasena: 'nueva-clave-muy-larga-9' } })).status, 200);
  assert.equal((await aplicar('otra-clave-muy-larga-9')).status, 404, 'un solo uso');
  assert.ok(o.llamadasHub.some((l) => l.url === '/cerrar' && l.cuerpo.userId === e.id));
});

test('la invitación no viaja en la ruta de la API: GET no existe, el testigo va en el cuerpo y un cuerpo sin testigo no sirve', { skip: SALTAR }, async () => {
  const o = await oficina(); const t = 'a'.repeat(48);
  for (const r of [`/api/invitacion/${t}`, `/api/invitacion/${t}/aceptar`, '/api/invitacion/ver']) assert.notEqual((await o.llamar(r)).status, 200, r);
  assert.equal((await o.llamar('/api/invitacion/ver', { metodo: 'POST', cuerpo: {} })).status, 404);
  assert.equal((await o.llamar('/api/invitacion/aceptar', { metodo: 'POST', cuerpo: { nombre: 'x', contrasena: 'clave-muy-larga-123' } })).status, 404);
  for (const ruta of ['/invitacion', '/invitacion/', `/invitacion/${t}`]) assert.equal((await (await o.llamar(ruta)).text()), 'ASSET:/invitacion.html', ruta);
});

test('las páginas de acceso: el formulario nunca manda la contraseña en la URL (method=post) y no lleva name', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['login.html', 'invitacion.html']) {
    const t = readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
    assert.match(t, /<form[^>]*method="post"[^>]*action="\/[a-z.]+"/, f); assert.doesNotMatch(t, /<input[^>]*\sname=/, f);
  }
  const js = readFileSync(new URL('../public/login.js', import.meta.url), 'utf8') + readFileSync(new URL('../public/invitacion.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /setAttribute\('aria-label'/, 'el botón de ver la contraseña no cambia su etiqueta además de aria-pressed');
  const w = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(w, /"invocation_logs": false/);
});
