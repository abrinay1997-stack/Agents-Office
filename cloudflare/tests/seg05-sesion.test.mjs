// SEG-05 — sesión deslizante (flag `sesion.deslizante`), «cerrar en todos los sitios» y lista de dispositivos.
// Lo que más importa: encender el flag NO desloguea a nadie, y apagado todo es como antes (30 días fijos, ninguna escritura extra).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion, olvidarFlagSesion, conciliarFlagSesion, dispositivoDe, HORAS_DESLIZANTE } from '../worker/lib/sesion.js';
import { guardarDoc } from '../worker/lib/almacen.js';
import { sha256 } from '../worker/lib/ids.js';

const DIA = 24 * 3600_000, iso = (ms) => new Date(ms).toISOString();
async function mundo({ flag = false } = {}) {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' }), env = envDePrueba(d1), db = d1._db;
  const nueva = (email, rol) => { const id = crypto.randomUUID(); db.prepare("insert into users (id,email,rol,password_hash,salt) values (?,?,?,'x','x')").run(id, email, rol); return id; };
  const ana = db.prepare('select id from users where email = ?').get(c.email).id, leo = nueva('leo@panaclaw.test', 'lectura'), beto = nueva('beto@panaclaw.test', 'editor');
  if (flag) { await guardarDoc(d1, 'config-local', { sesion: { deslizante: true } }); await guardarDoc(d1, 'sesion.estado', { activo: true, desde: iso(Date.now() - 60 * DIA) }); olvidarFlagSesion(d1); } // encendido hace tiempo
  const yo = async (cookie, ruta = '/api/yo', metodo = 'GET', cuerpo) => manejar(new Request('https://oficina.test' + ruta, { method: metodo, headers: { cookie: `__Host-sesion=${cookie}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }), env);
  const sesion = async (uid, { creada = Date.now(), expira = Date.now() + 30 * DIA, uso = null, ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537' } = {}) => {
    const t = await abrirSesion(d1, uid, ua), h = await sha256(t);
    db.prepare('update sessions set created_at = ?, expires_at = ? where token_hash = ?').run(iso(creada), iso(expira), h);
    if (uso) db.prepare('insert into sesiones_uso (token_hash, last_used_at) values (?,?)').run(h, iso(uso));
    return { t, h };
  };
  return { d1, db, env, c, ana, leo, beto, yo, sesion };
}

test('flag APAGADO: todo como antes (30 días, ninguna escritura extra, sin Set-Cookie nuevo)', { skip: SALTAR }, async () => {
  const m = await mundo();
  const s = await m.sesion(m.ana, { creada: Date.now() - 20 * DIA, expira: Date.now() + 10 * DIA });
  const antes = m.db.prepare('select total_changes() c').get().c;
  const r = await m.yo(s.t); assert.equal(r.status, 200); assert.equal(r.headers.get('set-cookie'), null);
  assert.equal(m.db.prepare('select total_changes() c').get().c, antes, 'ni una escritura');
  const l = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: m.c.email, contrasena: m.c.clave }) }), m.env);
  assert.equal(l.status, 200); assert.match(l.headers.get('set-cookie'), new RegExp(`Max-Age=${30 * 24 * 3600}`));
});

test('flag ENCENDIDO: las sesiones que ya existen siguen valiendo (nadie se desloguea), también sin fila en sesiones_uso', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const vieja = await m.sesion(m.ana, { creada: Date.now() - 12 * DIA, expira: Date.now() + 18 * DIA }); // de 30 días, sin "último uso"
  const lectura = await m.sesion(m.leo, { creada: Date.now() - 25 * DIA, expira: Date.now() + 5 * DIA });
  assert.equal((await m.yo(vieja.t)).status, 200); assert.equal((await m.yo(lectura.t)).status, 200);
});

test('flag ENCENDIDO: dos peticiones el mismo día = una sola escritura', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const s = await m.sesion(m.ana, { creada: Date.now() - 3 * DIA, expira: Date.now() + 27 * DIA });
  const c0 = m.db.prepare('select total_changes() c').get().c;
  assert.equal((await m.yo(s.t)).status, 200);
  const c1 = m.db.prepare('select total_changes() c').get().c; assert.equal(c1 - c0, 1, 'la primera apunta el último uso');
  assert.equal((await m.yo(s.t)).status, 200); assert.equal((await m.yo(s.t)).status, 200);
  assert.equal(m.db.prepare('select total_changes() c').get().c, c1, 'las demás del día no escriben');
  // al día siguiente, otra
  m.db.prepare('update sesiones_uso set last_used_at = ?').run(iso(Date.now() - 25 * 3600_000));
  const c2 = m.db.prepare('select total_changes() c').get().c; await m.yo(s.t); assert.equal(m.db.prepare('select total_changes() c').get().c - c2, 1);
});

test('flag ENCENDIDO: si faltan menos de 24 h se renueva 7 días y la MISMA respuesta reenvía la cookie', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const s = await m.sesion(m.ana, { creada: Date.now() - 6.5 * DIA, expira: Date.now() + 12 * 3600_000 });
  const r = await m.yo(s.t); assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), new RegExp(`__Host-sesion=${s.t}; .*Max-Age=${HORAS_DESLIZANTE * 3600}`));
  const exp = Date.parse(m.db.prepare('select expires_at e from sessions where token_hash = ?').get(s.h).e);
  assert.ok(Math.abs(exp - (Date.now() + 7 * DIA)) < 60_000, 'quedó a 7 días');
  const r2 = await m.yo(s.t); assert.equal(r2.headers.get('set-cookie'), null, 'ya no hace falta');
  // con más de 24 h por delante, no se toca la caducidad ni se reenvía
  const s2 = await m.sesion(m.ana, { expira: Date.now() + 3 * DIA }); const e0 = m.db.prepare('select expires_at e from sessions where token_hash = ?').get(s2.h).e;
  const r3 = await m.yo(s2.t); assert.equal(r3.headers.get('set-cookie'), null); assert.equal(m.db.prepare('select expires_at e from sessions where token_hash = ?').get(s2.h).e, e0);
});

test('flag ENCENDIDO (BLOQUEANTE de la revisión): una sesión de 30 días creada hace 20 días, de admin y de editor, SIN fila de uso, sigue valiendo; y al apagar y volver a encender también', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const a = await m.sesion(m.ana, { creada: Date.now() - 20 * DIA, expira: Date.now() + 10 * DIA }), e = await m.sesion(m.beto, { creada: Date.now() - 25 * DIA, expira: Date.now() + 5 * DIA });
  assert.equal((await m.yo(a.t)).status, 200); assert.equal((await m.yo(e.t)).status, 200);
  assert.equal(m.db.prepare('select count(*) n from sesiones_uso').get().n, 2, 'la fila se graba en esa misma petición');
  // apagado un tiempo (la fila queda vieja) y vuelto a encender: lo único que cuenta es lo que dice la fila
  await guardarDoc(m.d1, 'config-local', {}); olvidarFlagSesion(m.d1); await conciliarFlagSesion(m.d1); // el reloj anota que se apagó
  m.db.prepare('update sesiones_uso set last_used_at = ?').run(iso(Date.now() - 20 * DIA)); // pasó más de 14 días apagado: la fila quedó vieja
  await guardarDoc(m.d1, 'config-local', { sesion: { deslizante: true } }); olvidarFlagSesion(m.d1);
  assert.equal((await m.yo(a.t)).status, 200, 'una fila anterior al encendido no cuenta'); assert.equal((await m.yo(e.t)).status, 200);
  // y a partir de ahí la inactividad vuelve a medirse: 15 días después de lo anotado, sí vence
  m.db.prepare('update sesiones_uso set last_used_at = ?').run(iso(Date.now() - 15 * DIA)); m.db.prepare('update sessions set expires_at = ?').run(iso(Date.now() + 5 * DIA));
  await guardarDoc(m.d1, 'sesion.estado', { activo: true, desde: iso(Date.now() - 16 * DIA) }); olvidarFlagSesion(m.d1);
  assert.equal((await m.yo(a.t)).status, 401, 'pasados 14 días desde el último uso y desde el encendido');
});

test('flag ENCENDIDO y migración 0300 SIN aplicar: nadie recibe un 500, se sigue como con el flag apagado', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const s = await m.sesion(m.ana); m.db.exec('pragma foreign_keys = off; drop table sesiones_uso');
  const r = await m.yo(s.t); assert.equal(r.status, 200);
  assert.equal((await m.yo(s.t, '/api/yo/sesiones')).status, 200);
});

test('cerrar una sesión cierra también el socket en vivo de esa persona', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true }), llamadas = [];
  m.env.HUB = { idFromName: () => 'h', get: () => ({ fetch: async (rq) => { llamadas.push(new URL(rq.url).pathname); return new Response('{}'); } }) };
  const a1 = await m.sesion(m.ana), a2 = await m.sesion(m.ana);
  assert.equal((await m.yo(a1.t, '/api/yo/sesiones/cerrar', 'POST', { id: a2.h.slice(0, 16) })).status, 200);
  assert.ok(llamadas.includes('/cerrar'), JSON.stringify(llamadas));
});

test('flag ENCENDIDO: admin y editor pierden la sesión tras 14 días sin usarla; lectura no tiene ese tope', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const a = await m.sesion(m.ana, { creada: Date.now() - 20 * DIA, expira: Date.now() + 10 * DIA, uso: Date.now() - 15 * DIA });
  const l = await m.sesion(m.leo, { creada: Date.now() - 20 * DIA, expira: Date.now() + 10 * DIA, uso: Date.now() - 15 * DIA });
  const ok = await m.sesion(m.ana, { creada: Date.now() - 20 * DIA, expira: Date.now() + 10 * DIA, uso: Date.now() - 13 * DIA });
  assert.equal((await m.yo(a.t)).status, 401);
  assert.equal((await m.yo(l.t)).status, 200); assert.equal((await m.yo(ok.t)).status, 200);
  assert.equal(m.db.prepare('select count(*) n from sessions where token_hash = ?').get(a.h).n, 0, 'la inactiva se borra');
});

test('flag ENCENDIDO: el acceso nuevo dura 7 días; la cookie igual', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const l = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: m.c.email, contrasena: m.c.clave }) }), m.env);
  assert.equal(l.status, 200); assert.match(l.headers.get('set-cookie'), new RegExp(`Max-Age=${HORAS_DESLIZANTE * 3600}`));
});

test('lista de dispositivos, cerrar una y cerrar todas (cada quien solo las suyas; lectura también)', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const a1 = await m.sesion(m.ana, { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604' }), a2 = await m.sesion(m.ana), b1 = await m.sesion(m.beto), l1 = await m.sesion(m.leo), l2 = await m.sesion(m.leo);
  const lista = await (await m.yo(a1.t, '/api/yo/sesiones')).json();
  assert.equal(lista.sesiones.length, 2); assert.equal(lista.sesiones.filter((x) => x.actual).length, 1);
  assert.ok(lista.sesiones.some((x) => x.dispositivo === 'Safari en iPhone o iPad'));
  assert.ok(!JSON.stringify(lista).includes(a1.h) && !JSON.stringify(lista).includes(a1.t), 'ni el hash completo ni el testigo salen');
  // la ajena no se puede cerrar; la propia actual tampoco (para eso está Salir)
  assert.equal((await m.yo(a1.t, '/api/yo/sesiones/cerrar', 'POST', { id: b1.h.slice(0, 16) })).status, 404);
  assert.equal((await m.yo(a1.t, '/api/yo/sesiones/cerrar', 'POST', { id: a1.h.slice(0, 16) })).status, 404);
  assert.equal((await m.yo(a1.t, '/api/yo/sesiones/cerrar', 'POST', { id: 'nada' })).status, 404);
  assert.equal((await m.yo(a1.t, '/api/yo/sesiones/cerrar', 'POST', { id: a2.h.slice(0, 16) })).status, 200);
  assert.equal((await m.yo(a2.t)).status, 401, 'la cerrada ya no entra'); assert.equal((await m.yo(b1.t)).status, 200, 'la de otro intacta');
  // lectura puede cerrar las suyas
  const r = await m.yo(l1.t, '/api/yo/sesiones/cerrar-todas', 'POST', {}); assert.equal(r.status, 200); assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await m.yo(l1.t)).status, 401); assert.equal((await m.yo(l2.t)).status, 401); assert.equal((await m.yo(a1.t)).status, 200, 'las de otras personas siguen');
  assert.ok(m.db.prepare("select count(*) n from auditoria where tipo = 'sesion'").get().n >= 2, 'queda en la auditoría');
});

test('sin sesión las rutas nuevas son 401', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  for (const [ruta, metodo] of [['/api/yo/sesiones', 'GET'], ['/api/yo/sesiones/cerrar', 'POST'], ['/api/yo/sesiones/cerrar-todas', 'POST']]) assert.equal((await manejar(new Request('https://oficina.test' + ruta, { method: metodo }), m.env)).status, 401, ruta);
});

test('sesiones_uso: se borra con su sesión (cascada) y el reloj limpia las huérfanas', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  const s = await m.sesion(m.ana, { uso: Date.now() }); await m.yo(s.t, '/api/yo/sesiones/cerrar-todas', 'POST', {});
  assert.equal(m.db.prepare('select count(*) n from sesiones_uso').get().n, 0);
  m.db.pragma?.('foreign_keys = off'); m.db.exec('pragma foreign_keys = off'); m.db.prepare("insert into sesiones_uso values ('huerfana', ?)").run(iso(Date.now())); m.db.exec('pragma foreign_keys = on');
  const { correrReloj } = await import('../worker/lib/rutas.js'); await correrReloj(m.env);
  assert.equal(m.db.prepare('select count(*) n from sesiones_uso').get().n, 0);
});

test('dispositivoDe no devuelve el texto crudo del navegador', () => {
  assert.equal(dispositivoDe('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537'), 'Chrome en Android');
  assert.equal(dispositivoDe('Mozilla/5.0 (Macintosh; Intel Mac OS X 14) Firefox/121'), 'Firefox en Mac');
  assert.equal(dispositivoDe(''), 'Navegador');
});

test('primer encendido: la primera petición apunta "desde" y una fila vieja no desconecta a nadie', { skip: SALTAR }, async () => {
  const m = await mundo();
  const a = await m.sesion(m.ana, { creada: Date.now() - 25 * DIA, expira: Date.now() + 5 * DIA, uso: Date.now() - 20 * DIA });
  await guardarDoc(m.d1, 'config-local', { sesion: { deslizante: true } }); olvidarFlagSesion(m.d1);
  assert.equal((await m.yo(a.t)).status, 200);
  const est = JSON.parse(m.db.prepare("select json from docs where clave = 'sesion.estado'").get().json); assert.equal(est.activo, true); // secrets-ok
});
