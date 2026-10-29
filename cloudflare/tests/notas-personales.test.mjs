// N1 (Fase 8): notas para cuando entres, «mientras no estabas» y la última visita por cuenta. Flag apagado por defecto; privacidad, topes y roles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { guardarConfig, TOPE_CUERPO, MAX_ABIERTAS_PAR, MAX_DIA_REMITENTE, MAX_GRUPALES_ABIERTAS, limpiarCuerpo, parseEnlace, parsePara, tocarPresencia, VISITA_NUEVA_MS } from '../worker/lib/notas-personales.js';
import { guardarConfig as encenderNotif } from '../worker/lib/notificaciones.js';
import { emitirAviso } from '../worker/lib/avisos.js';
import { podar } from '../worker/lib/mantenimiento.js';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';

async function oficina({ activa = true } = {}) {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' });
  const env = envDePrueba(d1);
  const nueva = (email, rol, nombre) => { const id = crypto.randomUUID(); d1._db.prepare("insert into users (id,email,rol,password_hash,salt) values (?,?,?,'x','x')").run(id, email, rol); d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(id, nombre); return id; };
  const ana = d1._db.prepare('select id from users where email = ?').get(c.email).id;
  d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(ana, 'Ana');
  const beto = nueva('beto@panaclaw.test', 'editor', 'Beto'), carla = nueva('carla@panaclaw.test', 'lectura', 'Carla'), dani = nueva('dani@panaclaw.test', 'editor', 'Dani');
  if (activa) await guardarConfig(d1, { activo: true });
  const llamar = async (id, ruta, { metodo = 'GET', cuerpo } = {}) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { cookie: `__Host-sesion=${await abrirSesion(d1, id)}`, ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined }), env);
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  const deja = (de, para, cuerpo = 'Hola', extra = {}) => llamar(de, '/api/notas-personales', { metodo: 'POST', cuerpo: { para, cuerpo, ...extra } });
  return { d1, db: d1._db, env, ana, beto, carla, dani, llamar, deja };
}
const N = '/api/notas-personales';

test('puro: el texto se limpia, el enlace es interno y el destino se entiende', () => {
  assert.equal(limpiarCuerpo('  hola‮ mundo\u0007\n  '), 'hola mundo');
  assert.equal(parseEnlace('tarea:abc-1'), 'tarea:abc-1'); assert.equal(parseEnlace('https://x.test'), null); assert.equal(parseEnlace('javascript:alert(1)'), null); assert.equal(parseEnlace('otro:1'), null);
  assert.deepEqual(parsePara('todos'), { tipo: 'todos', valor: '' }); assert.deepEqual(parsePara('rol:editor'), { tipo: 'rol', valor: 'editor' });
  assert.equal(parsePara('rol:dios'), null); assert.equal(parsePara(''), null); assert.deepEqual(parsePara('persona:abc'), { tipo: 'persona', valor: 'abc' });
});

test('flag apagado por defecto: no se puede dejar nada, las listas están vacías y no se marca presencia', { skip: SALTAR }, async () => {
  const o = await oficina({ activa: false });
  assert.equal((await o.deja(o.ana, `persona:${o.beto}`)).status, 409);
  assert.deepEqual((await o.llamar(o.beto, N)).j, { activo: false, notas: [] });
  assert.equal((await o.llamar(o.beto, N + '/entrada')).j.hay, false);
  assert.equal(o.db.prepare('select count(*) n from notas_personales').get().n, 0); assert.equal(o.db.prepare('select count(*) n from presencia_cuenta').get().n, 0);
});

test('una nota llega a la persona correcta y a nadie más; se cierra y desaparece solo para ella', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = await o.deja(o.ana, `persona:${o.beto}`, 'Revisa el presupuesto', { color: 'rosa', enlace: 'tarea:t1' });
  assert.equal(r.status, 201);
  const beto = (await o.llamar(o.beto, N)).j;
  assert.equal(beto.notas.length, 1); assert.deepEqual([beto.notas[0].de, beto.notas[0].cuerpo, beto.notas[0].color, beto.notas[0].enlace, beto.notas[0].grupal], ['Ana', 'Revisa el presupuesto', 'rosa', 'tarea:t1', false]);
  assert.equal((await o.llamar(o.dani, N)).j.notas.length, 0, 'otro editor no la ve'); assert.equal((await o.llamar(o.ana, N)).j.notas.length, 0, 'ni quien la dejó');
  assert.equal((await o.llamar(o.dani, `${N}/${r.j.id}/cerrar`, { metodo: 'POST' })).status, 404, 'cerrar la nota de otro es 404');
  assert.equal((await o.llamar(o.beto, N)).j.notas.length, 1, 'y no le quitó nada a Beto');
  assert.equal((await o.llamar(o.beto, `${N}/${r.j.id}/leer`, { metodo: 'POST' })).status, 200);
  assert.equal((await o.llamar(o.beto, N)).j.notas[0].leida, true);
  assert.equal((await o.llamar(o.beto, `${N}/${r.j.id}/cerrar`, { metodo: 'POST' })).status, 200);
  assert.equal((await o.llamar(o.beto, N)).j.notas.length, 0);
  const env = (await o.llamar(o.ana, N + '/enviadas')).j.notas[0];
  assert.deepEqual([env.para, env.vistas, env.cerradas], ['Beto', 1, 1], 'quien la dejó ve «vista» y «cerrada»');
});

test('lectura puede dejar una nota a una persona, no a un rol ni a todos; no se puede una nota a uno mismo ni a quien no existe', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.deja(o.carla, `persona:${o.beto}`)).status, 201);
  assert.equal((await o.deja(o.carla, 'todos')).status, 403); assert.equal((await o.deja(o.carla, 'rol:admin')).status, 403);
  assert.equal((await o.deja(o.beto, `persona:${o.beto}`)).status, 400);
  assert.equal((await o.deja(o.beto, 'persona:no-existe')).status, 404);
  assert.equal((await o.deja(o.beto, 'quien-sea')).status, 400);
});

test('una nota grupal llega una vez a cada persona (menos a quien la dejó); «rol» solo a ese rol', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.deja(o.ana, 'todos', 'Reunión mañana')).status, 201);
  assert.equal((await o.deja(o.ana, 'rol:editor', 'Solo editores')).status, 201);
  const cuantas = async (id) => (await o.llamar(id, N)).j.notas.map((n) => n.cuerpo).sort();
  assert.deepEqual(await cuantas(o.beto), ['Reunión mañana', 'Solo editores']); assert.deepEqual(await cuantas(o.carla), ['Reunión mañana']); assert.deepEqual(await cuantas(o.ana), []);
  const cerrar = (await o.llamar(o.beto, N)).j.notas[0].id; await o.llamar(o.beto, `${N}/${cerrar}/cerrar`, { metodo: 'POST' });
  assert.equal((await cuantas(o.beto)).length, 1, 'cerrarla es solo para Beto'); assert.deepEqual(await cuantas(o.dani), ['Reunión mañana', 'Solo editores']);
});

test('topes: texto, par remitente→destinatario, notas grupales y por día', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.deja(o.ana, `persona:${o.beto}`, 'x'.repeat(TOPE_CUERPO + 1))).status, 422); assert.equal((await o.deja(o.ana, `persona:${o.beto}`, '   ')).status, 400);
  assert.equal((await o.deja(o.ana, `persona:${o.beto}`, 'a', { color: 'fucsia' })).status, 400); assert.equal((await o.deja(o.ana, `persona:${o.beto}`, 'a', { enlace: 'https://malo.test' })).status, 400);
  for (let i = 0; i < MAX_ABIERTAS_PAR; i++) assert.equal((await o.deja(o.ana, `persona:${o.beto}`, 'n' + i)).status, 201);
  assert.equal((await o.deja(o.ana, `persona:${o.beto}`, 'una más')).status, 429, 'el par ya tiene 5 abiertas');
  assert.equal((await o.deja(o.ana, `persona:${o.dani}`, 'a otro sí')).status, 201);
  const id = (await o.llamar(o.beto, N)).j.notas[0].id; await o.llamar(o.beto, `${N}/${id}/cerrar`, { metodo: 'POST' });
  assert.equal((await o.deja(o.ana, `persona:${o.beto}`, 'ahora sí')).status, 201, 'al cerrar una, cabe otra');
  for (let i = 0; i < MAX_GRUPALES_ABIERTAS; i++) assert.equal((await o.deja(o.beto, 'todos', 'g' + i)).status, 201);
  assert.equal((await o.deja(o.beto, 'todos', 'g de más')).status, 429);
  // tope por día: se fuerza el contador sin crear 20 pares
  const o2 = await oficina(); const ahora = Date.now();
  for (let i = 0; i < MAX_DIA_REMITENTE; i++) o2.db.prepare("insert into notas_personales (id, de_user_id, para_tipo, para_valor, cuerpo, color, creada_at, vence_at) values (?,?, 'persona', ?, 'x', 'amarillo', ?, ?)").run(crypto.randomUUID(), o2.ana, 'otro-' + i, ahora - 1000, ahora + 1e9);
  assert.equal((await o2.deja(o2.ana, `persona:${o2.dani}`)).status, 429);
});

test('lo privado es privado: el administrador ve que existe y si se vio, no el texto; solo el de una reportada', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = await o.deja(o.beto, `persona:${o.dani}`, 'texto muy privado'); await o.deja(o.beto, `persona:${o.carla}`, 'otro privado');
  const v = (await o.llamar(o.ana, N + '/admin')).j.notas;
  assert.equal(v.length, 2); assert.ok(!JSON.stringify(v).includes('privado'), 'sin texto'); assert.equal((await o.llamar(o.beto, N + '/admin')).status, 403);
  assert.equal((await o.llamar(o.ana, N)).j.notas.length, 0, 'Ana no recibe notas ajenas por ser administradora');
  await o.llamar(o.dani, `${N}/${r.j.id}/reportar`, { metodo: 'POST' });
  const w = (await o.llamar(o.ana, N + '/admin')).j.notas;
  assert.equal(w.find((x) => x.id === r.j.id).cuerpo, 'texto muy privado'); assert.equal(w.find((x) => x.id === r.j.id).reportada, true); assert.equal(w.filter((x) => x.cuerpo).length, 1);
  // quien la dejó la puede retirar; otro no
  assert.equal((await o.llamar(o.dani, `${N}/${r.j.id}`, { metodo: 'DELETE' })).status, 404); assert.equal((await o.llamar(o.beto, `${N}/${r.j.id}`, { metodo: 'DELETE' })).status, 200);
  assert.equal((await o.llamar(o.dani, N)).j.notas.length, 0);
});

test('vence sola y la poda se lleva lo vencido hace 30 días con su estado', { skip: SALTAR }, async () => {
  const o = await oficina(); const ahora = Date.now();
  const r = await o.deja(o.ana, `persona:${o.beto}`, 'caduca', { venceDias: 1 });
  await o.llamar(o.beto, N); // entregada
  o.db.prepare('update notas_personales set vence_at = ? where id = ?').run(ahora - 1000, r.j.id);
  assert.equal((await o.llamar(o.beto, N)).j.notas.length, 0, 'vencida: no se ve');
  assert.equal((await podar(o.d1, ahora)).notas_personales, 0, 'aún dentro de los 30 días de gracia');
  const n = await podar(o.d1, ahora + 31 * 864e5);
  assert.equal(n.notas_personales, 1); assert.equal(o.db.prepare('select count(*) n from notas_personales').get().n, 0); assert.equal(o.db.prepare('select count(*) n from notas_estado').get().n, 0, 'el estado cae por cascada');
});

test('última visita: una escritura cada 5 min; una visita nueva tras 30 min sin verte, con el anterior guardado', { skip: SALTAR }, async () => {
  const o = await oficina(); const t0 = 1_800_000_000_000;
  let v = await tocarPresencia(o.d1, o.beto, t0);
  assert.deepEqual([v.visto, v.entro, v.anterior], [t0, t0, null]);
  v = await tocarPresencia(o.d1, o.beto, t0 + 60_000); assert.equal(v.visto, t0, 'menos de 5 min: no escribe');
  v = await tocarPresencia(o.d1, o.beto, t0 + 6 * 60_000); assert.deepEqual([v.visto, v.entro, v.anterior], [t0 + 6 * 60_000, t0, null], 'misma visita: entro no cambia');
  const ultimo = t0 + 6 * 60_000;
  v = await tocarPresencia(o.d1, o.beto, ultimo + VISITA_NUEVA_MS + 1000);
  assert.deepEqual([v.entro, v.anterior], [ultimo + VISITA_NUEVA_MS + 1000, ultimo], 'visita nueva: el anterior queda para «mientras no estabas»');
  assert.equal(o.db.prepare('select count(*) n from presencia_cuenta').get().n, 1);
});

test('«mientras no estabas»: notas + notificaciones sin leer, y «hay» solo si hay algo', { skip: SALTAR }, async () => {
  const o = await oficina(); await encenderNotif(o.d1, { activo: true });
  assert.equal((await o.llamar(o.beto, N + '/entrada')).j.hay, false);
  await o.deja(o.ana, `persona:${o.beto}`, 'mira esto'); await emitirAviso(o.d1, { kind: 'persona', text: 'Te asignaron «X»', persona: 'beto', task: 't9' });
  const e = (await o.llamar(o.beto, N + '/entrada')).j;
  assert.equal(e.hay, true); assert.equal(e.notas.length, 1); assert.equal(e.notificaciones.noLeidas, 1);
  assert.equal((await o.llamar(o.carla, N + '/entrada')).j.hay, false, 'Carla no ve lo de Beto');
});

test('el aviso en vivo va dirigido y lleva ids, nunca texto', { skip: SALTAR }, async () => {
  const o = await oficina(); const enviados = [];
  o.env.HUB = { idFromName: () => 'x', get: () => ({ fetch: async (req) => { enviados.push(await req.json()); return new Response(null, { status: 204 }); } }) };
  await o.deja(o.ana, `persona:${o.beto}`, 'secreto de Ana'); await o.deja(o.ana, 'rol:lectura', 'otro secreto');
  const notas = enviados.filter((e) => e.tipo === 'nota');
  assert.deepEqual(notas[0].para, [o.beto]); assert.deepEqual(notas[1].para, [o.carla]);
  assert.ok(!JSON.stringify(enviados).includes('secreto'));
});
