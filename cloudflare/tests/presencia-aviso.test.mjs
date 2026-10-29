// N2b (Fase 8): «Ana se conectó». Una vez por visita, solo a administradores que lo pidieron, nunca al propio, sin texto, y detrás del flag de notificaciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { guardarConfig as encenderNotif } from '../worker/lib/notificaciones.js';
import { tocarPresencia, VISITA_NUEVA_MS } from '../worker/lib/notas-personales.js';
import { limpiarPref, avisarConexion } from '../worker/lib/presencia-aviso.js';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';

async function oficina({ activa = true } = {}) {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' }), env = envDePrueba(d1), enviados = [];
  env.HUB = { idFromName: () => 'x', get: () => ({ fetch: async (req) => { enviados.push(await req.json()); return new Response(null, { status: 204 }); } }) };
  const nueva = (email, rol, nombre) => { const id = crypto.randomUUID(); d1._db.prepare("insert into users (id,email,rol,password_hash,salt) values (?,?,?,'x','x')").run(id, email, rol); d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(id, nombre); return id; };
  const ana = d1._db.prepare('select id from users where email = ?').get(c.email).id; d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(ana, 'Ana');
  const beto = nueva('beto@panaclaw.test', 'editor', 'Beto'), carla = nueva('carla@panaclaw.test', 'lectura', 'Carla'), dario = nueva('dario@panaclaw.test', 'admin', 'Darío');
  if (activa) await encenderNotif(d1, { activo: true });
  const llamar = async (id, ruta, { metodo = 'GET', cuerpo } = {}) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { cookie: `__Host-sesion=${await abrirSesion(d1, id)}`, ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined }), env);
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const conexiones = () => enviados.filter((e) => e.tipo === 'conexion');
  return { d1, db: d1._db, env, ana, beto, carla, dario, llamar, enviados, conexiones };
}
const P = '/api/notas-personales/preferencias-conexion', E = '/api/notas-personales/entrada';

test('puro: las preferencias solo aceptan lo conocido y un no-administrador no puede recibir avisos', () => {
  assert.deepEqual(limpiarPref({ avisarme: true, basura: 1, de: ['x', 'x', 'y'], oficina: 'sí' }), { avisarme: true, oficina: true, telegram: false, de: ['x', 'y'], noAvisar: false });
  assert.equal(limpiarPref({ de: 'todas' }).de, 'todas');
});

test('flag apagado: nadie recibe nada ni se guarda la visita', { skip: SALTAR }, async () => {
  const o = await oficina({ activa: false });
  assert.deepEqual((await o.llamar(o.ana, P)).j, { activo: false }); assert.equal((await o.llamar(o.beto, E)).j.activo, false);
  assert.equal(o.conexiones().length, 0); assert.equal(o.db.prepare('select count(*) n from presencia_cuenta').get().n, 0);
});

test('opt-in: sin pedirlo nadie recibe; el administrador que lo pide recibe UNA vez por visita, sin texto, y no el propio', { skip: SALTAR }, async () => {
  const o = await oficina();
  await o.llamar(o.beto, E); assert.equal(o.conexiones().length, 0, 'nadie lo había pedido');
  const t0 = Date.now() - 3 * VISITA_NUEVA_MS; o.db.prepare('delete from presencia_cuenta').run();
  assert.equal((await o.llamar(o.ana, P, { metodo: 'POST', cuerpo: { avisarme: true } })).j.pref.avisarme, true);
  o.db.prepare('delete from presencia_cuenta').run();
  await o.llamar(o.beto, E);
  const c = o.conexiones(); assert.equal(c.length, 1); assert.deepEqual(c[0].para, [o.ana]); assert.equal(c[0].userId, o.beto);
  assert.ok(!JSON.stringify(c[0]).match(/Beto|beto@/), 'el socket lleva el id, nunca el nombre ni el correo');
  await o.llamar(o.beto, E); await o.llamar(o.beto, '/api/notas-personales'); assert.equal(o.conexiones().length, 1, 'una vez por visita');
  await o.llamar(o.ana, E); assert.equal(o.conexiones().length, 1, 'Ana no se avisa a sí misma');
});

test('volver antes de 30 min no repite; tras 30 min es una visita nueva', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.llamar(o.ana, P, { metodo: 'POST', cuerpo: { avisarme: true } });
  const ahora = Date.now(); const usuario = { id: o.beto, rol: 'editor' };
  const v1 = await tocarPresencia(o.d1, o.beto, ahora); assert.equal(v1.nueva, true); assert.equal(await avisarConexion(o.d1, o.env, usuario, v1), 1);
  const v2 = await tocarPresencia(o.d1, o.beto, ahora + 10 * 60_000); assert.equal(v2.nueva, false); assert.equal(await avisarConexion(o.d1, o.env, usuario, v2), 0, 'regreso en menos de 30 min');
  const v3 = await tocarPresencia(o.d1, o.beto, ahora + 10 * 60_000 + VISITA_NUEVA_MS + 1000); assert.equal(v3.nueva, true); assert.equal(await avisarConexion(o.d1, o.env, usuario, v3), 1);
});

test('«No avisar que me conecto» y la lista de personas vigiladas se respetan', { skip: SALTAR }, async () => {
  const o = await oficina(); await o.llamar(o.ana, P, { metodo: 'POST', cuerpo: { avisarme: true } });
  assert.equal((await o.llamar(o.beto, P, { metodo: 'POST', cuerpo: { noAvisar: true } })).j.pref.noAvisar, true);
  await o.llamar(o.beto, E); assert.equal(o.conexiones().length, 0, 'Beto eligió no avisar');
  await o.llamar(o.ana, P, { metodo: 'POST', cuerpo: { de: [o.carla] } });
  await o.llamar(o.carla, E); assert.equal(o.conexiones().length, 1, 'Ana vigila a Carla'); o.db.prepare("update presencia_cuenta set visto_at = 1, entro_at = 1 where user_id = ?").run(o.dario);
  await o.llamar(o.dario, E); assert.equal(o.conexiones().length, 1, 'Darío no está en su lista');
});

test('solo un administrador recibe avisos: un editor o una lectura no pueden activarlo ni vigilar', { skip: SALTAR }, async () => {
  const o = await oficina();
  for (const id of [o.beto, o.carla]) { const r = await o.llamar(id, P, { metodo: 'POST', cuerpo: { avisarme: true, de: ['x'] } }); assert.equal(r.j.pref.avisarme, false); assert.equal(r.j.pref.de, 'todas'); assert.equal(r.j.esAdmin, false); }
  await o.llamar(o.ana, E); assert.equal(o.conexiones().length, 0);
  const g = (await o.llamar(o.beto, P)).j; assert.match(g.transparencia, /Nunca qué hiciste/); assert.equal((await o.llamar(o.ana, P)).j.pref.avisarme, false, 'cada cuenta ve las suyas');
});
