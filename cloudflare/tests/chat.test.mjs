// C0 (Fase 8): el chat interno — modelo y rutas, sin pantalla. Pertenencia como única puerta, privacidad frente a administradores, roles, avisos por `notificaciones` sin texto, topes y poda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { abrirSesion } from '../worker/lib/sesion.js';
import { guardarConfig } from '../worker/lib/chat/chat.js';
import { guardarConfig as notif } from '../worker/lib/notificaciones.js';
import { podar } from '../worker/lib/mantenimiento.js';
import { limpiarCuerpo, cuerpoValido, nombreCanalValido, claveDirecto, leerMenciones, puedeEditar, noLeidos, tituloAviso, pagina, MAX_CUERPO } from '../../chat-core.mjs';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';

async function oficina({ activo = true } = {}) {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' }), env = envDePrueba(d1);
  const nueva = (email, rol, nombre) => { const id = crypto.randomUUID(); d1._db.prepare("insert into users (id,email,rol,password_hash,salt) values (?,?,?,'x','x')").run(id, email, rol); d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(id, nombre); return id; };
  const ana = d1._db.prepare('select id from users where email = ?').get(c.email).id; d1._db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(ana, 'Ana');
  const beto = nueva('beto@panaclaw.test', 'editor', 'Beto'), carla = nueva('carla@panaclaw.test', 'lectura', 'Carla'), dani = nueva('dani@panaclaw.test', 'editor', 'Dani María');
  if (activo) await guardarConfig(d1, { activo: true });
  const llamar = async (id, ruta, { metodo = 'GET', cuerpo } = {}) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { cookie: `__Host-sesion=${await abrirSesion(d1, id)}`, ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined }), env);
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  return { d1, db: d1._db, ana, beto, carla, dani, llamar };
}
const C = '/api/chat';
const escribe = (o, quien, canal, cuerpo, extra = {}) => o.llamar(quien, `${C}/canales/${canal}/mensajes`, { metodo: 'POST', cuerpo: { cuerpo, ...extra } });

test('puro: cuerpo, nombre de canal, directo único, menciones validadas y no leídos', () => {
  assert.equal(limpiarCuerpo('  hola‮\u0007 mundo\r\nlínea  '), 'hola mundo\nlínea');
  assert.equal(cuerpoValido('   ').ok, false); assert.equal(cuerpoValido('x'.repeat(MAX_CUERPO + 1)).ok, false); assert.equal(cuerpoValido('ok').ok, true);
  assert.deepEqual(nombreCanalValido('#Ventas'), { ok: true, nombre: 'Ventas', clave: 'ventas' }); assert.equal(nombreCanalValido('a').ok, false); assert.equal(nombreCanalValido('<img>').ok, false); assert.equal(nombreCanalValido('a@b').ok, false);
  assert.equal(claveDirecto('b', 'a'), claveDirecto('a', 'b'));
  const m = [{ id: '1', nombre: 'Ana' }, { id: '2', nombre: 'Dani María' }, { id: '3', nombre: 'Dani' }];
  assert.deepEqual(leerMenciones('hola @ana y @dani maría!', m, '9').sort(), ['1', '2']);
  assert.deepEqual(leerMenciones('@Ana, mira', m, '1'), [], 'nunca a quien escribe'); assert.deepEqual(leerMenciones('correo ana@x.com', m, '9'), [], 'un correo no es una mención'); assert.deepEqual(leerMenciones('@anabel', m, '9'), []);
  assert.deepEqual(leerMenciones('@Maria', m, '9'), [], 'solo el nombre entero');
  assert.equal(puedeEditar({ user_id: 'a', creado_at: 0 }, 'a', 14 * 60_000), true); assert.equal(puedeEditar({ user_id: 'a', creado_at: 0 }, 'a', 16 * 60_000), false); assert.equal(puedeEditar({ user_id: 'a', creado_at: 0 }, 'b', 1), false);
  assert.equal(noLeidos([{ id: 1, user_id: 'x' }, { id: 2, user_id: 'yo' }, { id: 3, user_id: 'x', borrado_at: 5 }, { id: 4, user_id: 'x' }], 1, 'yo'), 1);
  assert.ok(!tituloAviso({ de: 'Ana', canal: 'ventas', tipo: 'canal', mencion: true }).includes('hola')); assert.deepEqual(pagina('x', '500'), { antes: null, limite: 100 });
});

test('flag apagado: nada se crea ni se lee; solo un administrador lo enciende', { skip: SALTAR }, async () => {
  const o = await oficina({ activo: false });
  assert.deepEqual((await o.llamar(o.beto, `${C}/resumen`)).j, { activo: false, canales: [], total: 0 });
  assert.equal((await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'ventas' } })).status, 409);
  assert.equal(o.db.prepare('select count(*) n from chat_canales').get().n, 0, 'ni #general');
  assert.equal((await o.llamar(o.beto, `${C}/config`, { metodo: 'POST', cuerpo: { activo: true } })).status, 403);
  assert.deepEqual((await o.llamar(o.ana, `${C}/config`, { metodo: 'POST', cuerpo: { activo: true, basura: 1 } })).j, { activo: true });
  assert.equal((await o.llamar(o.beto, `${C}/resumen`)).j.activo, true);
});

test('#general existe desde el primer día para todos; quien solo lee lo ve pero no escribe', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = (await o.llamar(o.carla, `${C}/resumen`)).j; assert.deepEqual(r.canales.map((c) => [c.id, c.tipo, c.nombre]), [['general', 'general', 'general']]);
  assert.equal((await escribe(o, o.beto, 'general', 'Buen día a todos')).status, 201);
  assert.equal((await escribe(o, o.carla, 'general', 'yo también')).status, 403, 'lectura no escribe');
  assert.equal((await o.llamar(o.carla, `${C}/canales/general/mensajes`)).j.mensajes[0].cuerpo, 'Buen día a todos');
  assert.equal((await o.llamar(o.carla, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'mio' } })).status, 403);
  assert.equal((await o.llamar(o.carla, `${C}/directo`, { metodo: 'POST', cuerpo: { con: o.beto } })).status, 403);
});

test('canales: crear, nombre único, privado solo para sus miembros (404 ajeno), público con unirse; el administrador NO lee lo privado', { skip: SALTAR }, async () => {
  const o = await oficina();
  const pub = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Ventas' } })).j.id, priv = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Secreto', privado: true, miembros: [o.dani] } })).j.id;
  assert.equal((await o.llamar(o.dani, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'ventas' } })).status, 409, 'nombre repetido sin tildes ni mayúsculas'); assert.equal((await o.llamar(o.dani, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'General' } })).status, 409);
  await escribe(o, o.beto, priv, 'solo para Dani'); await escribe(o, o.beto, pub, 'hola ventas');
  for (const quien of [o.ana, o.carla]) {
    assert.equal((await o.llamar(quien, `${C}/canales/${priv}/mensajes`)).status, 404, 'lo privado no se confirma ni a un administrador');
    assert.equal((await escribe(o, quien, priv, 'intruso')).status, quien === o.carla ? 403 : 404);
    assert.equal((await o.llamar(quien, `${C}/canales/${priv}/leido`, { metodo: 'POST', cuerpo: { hasta: 99 } })).status, 404);
  }
  assert.equal((await o.llamar(o.dani, `${C}/canales/${priv}/mensajes`)).j.mensajes[0].cuerpo, 'solo para Dani');
  assert.equal((await o.llamar(o.ana, `${C}/canales/${pub}/mensajes`)).status, 404, 'público: hay que unirse para leer');
  assert.equal((await o.llamar(o.ana, `${C}/canales/${pub}/miembros`, { metodo: 'POST', cuerpo: {} })).status, 200);
  assert.equal((await o.llamar(o.ana, `${C}/canales/${pub}/mensajes`)).j.mensajes.length, 1);
  const lista = (await o.llamar(o.carla, `${C}/canales`)).j.publicos; assert.ok(lista.some((c) => c.nombre === 'Ventas') && !JSON.stringify(lista).includes('Secreto'));
  const adm = (await o.llamar(o.ana, `${C}/admin`)).j.canales; assert.equal(adm.find((c) => c.id === priv).nombre, null); assert.ok(!JSON.stringify(adm).includes('solo para Dani')); assert.equal((await o.llamar(o.beto, `${C}/admin`)).status, 403);
  assert.equal((await o.llamar(o.dani, `${C}/canales/${priv}/miembros`, { metodo: 'POST', cuerpo: { userId: o.ana } })).status, 403, 'solo el dueño añade');
  assert.equal((await o.llamar(o.beto, `${C}/canales/${priv}/miembros`, { metodo: 'POST', cuerpo: { userId: o.ana } })).status, 200);
});

test('directos: uno por pareja (a la vez también), privados de verdad, sin tocar sus miembros', { skip: SALTAR }, async () => {
  const o = await oficina();
  const [a, b] = await Promise.all([o.llamar(o.beto, `${C}/directo`, { metodo: 'POST', cuerpo: { con: o.dani } }), o.llamar(o.dani, `${C}/directo`, { metodo: 'POST', cuerpo: { con: o.beto } })]);
  assert.equal(a.j.id, b.j.id); assert.equal(o.db.prepare("select count(*) n from chat_canales where tipo = 'directo'").get().n, 1);
  assert.equal((await o.llamar(o.beto, `${C}/directo`, { metodo: 'POST', cuerpo: { con: o.beto } })).status, 400); assert.equal((await o.llamar(o.beto, `${C}/directo`, { metodo: 'POST', cuerpo: { con: 'no-existe' } })).status, 404);
  await escribe(o, o.beto, a.j.id, 'oye Dani');
  assert.equal((await o.llamar(o.ana, `${C}/canales/${a.j.id}/mensajes`)).status, 404, 'ni el administrador lee un directo ajeno');
  assert.equal((await o.llamar(o.beto, `${C}/canales/${a.j.id}/miembros`, { metodo: 'POST', cuerpo: { userId: o.ana } })).status, 404);
  const res = (await o.llamar(o.dani, `${C}/resumen`)).j; const d = res.canales.find((c) => c.tipo === 'directo'); assert.equal(d.nombre, 'Beto'); assert.equal(d.noLeidos, 1); assert.equal(res.total, 1);
  assert.equal((await o.llamar(o.ana, `${C}/admin`)).j.canales.find((c) => c.id === a.j.id).nombre, null);
});

test('mensajes: no leídos, menciones validadas, marcar leído (nunca baja), páginas, editar 15 min, borrar con lápida', { skip: SALTAR }, async () => {
  const o = await oficina();
  const id = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Equipo', miembros: [o.dani, o.ana] } })).j.id;
  const m1 = (await escribe(o, o.beto, id, 'Hola @Dani María y @Ana, revisen @Fantasma')).j.mensaje; assert.deepEqual(m1.menciones.sort(), [o.ana, o.dani].sort());
  for (let i = 0; i < 4; i++) await escribe(o, o.beto, id, 'mensaje ' + i);
  let r = (await o.llamar(o.dani, `${C}/resumen`)).j; const c = r.canales.find((x) => x.id === id); assert.deepEqual([c.noLeidos, c.menciones], [5, 1]); assert.equal(c.ultimo.texto, 'mensaje 3');
  const p1 = (await o.llamar(o.dani, `${C}/canales/${id}/mensajes?limite=3`)).j; assert.equal(p1.mensajes.length, 3); assert.equal(p1.hayMas, true); assert.equal(p1.mensajes.at(-1).cuerpo, 'mensaje 3');
  const p2 = (await o.llamar(o.dani, `${C}/canales/${id}/mensajes?limite=3&antes=${p1.mensajes[0].id}`)).j; assert.equal(p2.mensajes.length, 2); assert.equal(p2.hayMas, false);
  const ult = p1.mensajes.at(-1).id;
  await o.llamar(o.dani, `${C}/canales/${id}/leido`, { metodo: 'POST', cuerpo: { hasta: ult } }); await o.llamar(o.dani, `${C}/canales/${id}/leido`, { metodo: 'POST', cuerpo: { hasta: 1 } });
  assert.equal((await o.llamar(o.dani, `${C}/resumen`)).j.canales.find((x) => x.id === id).noLeidos, 0, 'el cursor no baja'); assert.equal((await o.llamar(o.beto, `${C}/resumen`)).j.canales.find((x) => x.id === id).noLeidos, 0, 'lo propio ya está leído');
  await o.llamar(o.dani, `${C}/canales/${id}/silenciar`, { metodo: 'POST', cuerpo: { silenciado: true } });
  await escribe(o, o.beto, id, 'otro más'); await escribe(o, o.beto, id, 'hey @dani maría');
  r = (await o.llamar(o.dani, `${C}/resumen`)).j; assert.equal(r.total, 1, 'silenciado: solo cuenta la mención');
  const mine = (await escribe(o, o.dani, id, 'borrador')).j.mensaje.id;
  assert.equal((await o.llamar(o.dani, `${C}/mensajes/${mine}`, { metodo: 'PATCH', cuerpo: { cuerpo: 'corregido' } })).status, 200);
  assert.equal((await o.llamar(o.beto, `${C}/mensajes/${mine}`, { metodo: 'PATCH', cuerpo: { cuerpo: 'ajeno' } })).status, 403);
  o.db.prepare('update chat_mensajes set creado_at = creado_at - ? where id = ?').run(16 * 60_000, mine);
  assert.equal((await o.llamar(o.dani, `${C}/mensajes/${mine}`, { metodo: 'PATCH', cuerpo: { cuerpo: 'tarde' } })).status, 403);
  assert.equal((await o.llamar(o.beto, `${C}/mensajes/${mine}`, { metodo: 'DELETE' })).status, 403, 'un editor solo borra lo suyo');
  assert.equal((await o.llamar(o.ana, `${C}/mensajes/${mine}`, { metodo: 'DELETE' })).status, 200, 'un administrador modera un canal público');
  const lap = (await o.llamar(o.beto, `${C}/canales/${id}/mensajes`)).j.mensajes.find((x) => x.id === mine); assert.deepEqual([lap.borrado, lap.cuerpo, lap.de], [true, '', null]);
  assert.equal((await o.llamar(o.carla, `${C}/mensajes/${mine}`, { metodo: 'DELETE' })).status, 403);
});

test('un administrador NO borra en un privado ajeno ni en un directo; un id de mensaje ajeno da 404', { skip: SALTAR }, async () => {
  const o = await oficina();
  const priv = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Intimo', privado: true, miembros: [o.dani] } })).j.id;
  const m = (await escribe(o, o.beto, priv, 'privado')).j.mensaje.id;
  assert.equal((await o.llamar(o.ana, `${C}/mensajes/${m}`, { metodo: 'DELETE' })).status, 404); assert.equal((await o.llamar(o.ana, `${C}/mensajes/${m}`, { metodo: 'PATCH', cuerpo: { cuerpo: 'x' } })).status, 404);
  assert.equal(o.db.prepare('select borrado_at b from chat_mensajes where id = ?').get(m).b, null);
});

test('novedades: la puesta al día solo trae MIS canales; respuesta a un mensaje de otro canal se rechaza', { skip: SALTAR }, async () => {
  const o = await oficina();
  const a = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Uno', privado: true } })).j.id, b = (await o.llamar(o.dani, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Dos', privado: true } })).j.id;
  const m1 = (await escribe(o, o.beto, a, 'de beto')).j.mensaje.id; await escribe(o, o.dani, b, 'de dani');
  const n = (await o.llamar(o.beto, `${C}/novedades?desde=0`)).j; assert.deepEqual(n.mensajes.map((x) => x.cuerpo), ['de beto']); assert.equal(n.ultimo, m1);
  assert.equal((await escribe(o, o.dani, b, 'cruzado', { respondeA: m1 })).status, 400);
  assert.equal((await o.llamar(o.beto, `${C}/novedades?desde=${m1}`)).j.mensajes.length, 0);
});

test('avisos por `notificaciones` (un solo sistema): directo y mención, sin el texto, nunca al autor, una vez; el canal normal no avisa', { skip: SALTAR }, async () => {
  const o = await oficina(); await notif(o.d1, { activo: true });
  const id = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Equipo', miembros: [o.dani, o.ana] } })).j.id;
  await escribe(o, o.beto, id, 'sin mención, texto-secreto'); assert.equal(o.db.prepare('select count(*) n from notificaciones').get().n, 0);
  await escribe(o, o.beto, id, 'mira esto @Ana texto-secreto');
  const d = (await o.llamar(o.beto, `${C}/directo`, { metodo: 'POST', cuerpo: { con: o.dani } })).j.id; await escribe(o, o.beto, d, 'hola texto-secreto');
  const nf = o.db.prepare('select user_id, categoria, titulo, enlace from notificaciones').all();
  assert.deepEqual(nf.map((x) => [x.user_id === o.ana ? 'ana' : 'dani', x.categoria]).sort(), [['ana', 'menciones'], ['dani', 'chat']]); assert.ok(nf.every((x) => !x.titulo.includes('texto-secreto') && x.user_id !== o.beto));
  const ana = (await o.llamar(o.ana, '/api/notificaciones')).j; assert.equal(ana.items[0].titulo, 'Beto te mencionó en #Equipo');
  o.db.exec('drop table notificaciones'); assert.equal((await escribe(o, o.beto, d, 'sigue')).status, 201, 'un aviso que falla no tumba el mensaje');
});

test('topes: 30 mensajes por minuto y persona; el cuerpo, 4.000; HTML y marcas bidi se guardan como texto plano limpio', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await escribe(o, o.beto, 'general', 'x'.repeat(4001))).status, 400); assert.equal((await escribe(o, o.beto, 'general', '   ')).status, 400);
  await escribe(o, o.beto, 'general', '<img src=x onerror=1> hola‮'); assert.equal((await o.llamar(o.beto, `${C}/canales/general/mensajes`)).j.mensajes[0].cuerpo, '<img src=x onerror=1> hola');
  let ultimo; for (let i = 0; i < 31; i++) ultimo = await escribe(o, o.beto, 'general', 'm' + i);
  assert.equal(ultimo.status, 429); assert.equal((await escribe(o, o.dani, 'general', 'yo sí')).status, 201, 'el tope es por persona');
});

test('poda: los mensajes de más de 365 días se van; los canales se quedan', { skip: SALTAR }, async () => {
  const o = await oficina(); const ahora = Date.now();
  await escribe(o, o.beto, 'general', 'viejo'); await escribe(o, o.beto, 'general', 'nuevo');
  o.db.prepare("update chat_mensajes set creado_at = ? where cuerpo = 'viejo'").run(ahora - 366 * 864e5);
  assert.equal((await podar(o.d1, ahora)).chat_mensajes, 1); assert.deepEqual(o.db.prepare('select cuerpo from chat_mensajes').all().map((x) => x.cuerpo), ['nuevo']); assert.equal(o.db.prepare('select count(*) n from chat_canales').get().n, 1);
});

test('una persona quitada del equipo deja sus mensajes con su nombre y ya no entra', { skip: SALTAR }, async () => {
  const o = await oficina(); await escribe(o, o.dani, 'general', 'estuve aquí');
  const m = (await o.llamar(o.beto, `${C}/canales/general/mensajes`)).j.mensajes[0]; assert.equal(m.de, 'Dani María');
  o.db.prepare("insert into perfiles (user_id, baja_at) values (?, 1) on conflict (user_id) do update set baja_at = 1").run(o.dani);
  assert.equal((await o.llamar(o.beto, `${C}/directo`, { metodo: 'POST', cuerpo: { con: o.dani } })).status, 404);
});

test('resumen en una consulta por lote, no una por canal (tope de consultas del plan gratuito)', { skip: SALTAR }, async () => {
  const o = await oficina();
  for (let i = 0; i < 8; i++) { const id = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Canal ' + i, miembros: [o.dani] } })).j.id; await escribe(o, o.beto, id, 'hola ' + i); }
  let n = 0; const real = o.d1.prepare.bind(o.d1); o.d1.prepare = (sql) => { n++; return real(sql); };
  const { resumen } = await import('../worker/lib/chat/chat.js'); const r = await resumen(o.d1, { id: o.dani, rol: 'editor' });
  assert.equal(r.canales.length, 9); assert.ok(r.canales.every((c) => c.id === 'general' || c.ultimo?.texto.startsWith('hola')), 'trae el último mensaje de cada uno'); assert.ok(n <= 6, `consultas: ${n}`);
});

test('topes al crear: 20 canales por persona, 10 miembros iniciales, 10 altas por minuto (canales y directos)', { skip: SALTAR }, async () => {
  const o = await oficina(); const ahora = Date.now();
  const gente = Array.from({ length: 14 }, (_, i) => { const id = crypto.randomUUID(); o.db.prepare("insert into users (id,email,rol,password_hash,salt) values (?,?, 'editor','x','x')").run(id, `p${i}@x.test`); o.db.prepare('insert into perfiles (user_id, nombre) values (?,?)').run(id, 'Persona ' + i); return id; });
  const c = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Grande', miembros: gente } })).j; assert.equal(c.miembros, 11, 'tú + 10 como mucho');
  o.db.prepare('delete from publica_tasa').run();
  for (let i = 0; i < 19; i++) { o.db.prepare('delete from publica_tasa').run(); assert.equal((await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Extra ' + i } })).status, 201); }
  o.db.prepare('delete from publica_tasa').run();
  assert.equal((await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Uno más' } })).status, 429, 'el canal 21');
  o.db.prepare('delete from publica_tasa').run();
  for (let i = 0; i < 10; i++) assert.equal((await o.llamar(o.dani, `${C}/directo`, { metodo: 'POST', cuerpo: { con: gente[i] } })).status, 200);
  assert.equal((await o.llamar(o.dani, `${C}/directo`, { metodo: 'POST', cuerpo: { con: gente[11] } })).status, 429, 'ráfaga de altas'); void ahora;
});

test('un nombre privado no delata nada: crear un canal con el nombre de uno privado ajeno no da 409', { skip: SALTAR }, async () => {
  const o = await oficina();
  await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Despidos', privado: true } });
  const r = await o.llamar(o.dani, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'despidos' } }); assert.equal(r.status, 201, 'sin pista de que existe');
  assert.equal((await o.llamar(o.ana, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'DESPIDOS' } })).status, 409, 'público contra público sí (ambos lo ven)');
});

test('#general: se lee antes de escribir y, al encender el chat, todas las cuentas quedan dentro', { skip: SALTAR }, async () => {
  const o = await oficina({ activo: false });
  assert.equal(o.db.prepare('select count(*) n from chat_miembros').get().n, 0);
  await o.llamar(o.ana, `${C}/config`, { metodo: 'POST', cuerpo: { activo: true } });
  assert.equal(o.db.prepare("select count(*) n from chat_miembros where canal_id = 'general'").get().n, 4, 'las 4 cuentas, sin que nadie lo haya usado');
  await o.llamar(o.beto, `${C}/resumen`);
  const escrituras = []; const real = o.d1.prepare.bind(o.d1); o.d1.prepare = (sql) => { if (/insert|update|delete/i.test(sql) && /chat_/.test(sql)) escrituras.push(sql); return real(sql); };
  await o.llamar(o.beto, `${C}/resumen`); assert.deepEqual(escrituras, [], 'una petición normal no escribe en el chat');
});

test('salir de un canal: no se saca a quien no está, el canal nunca queda sin dueño (hereda el más antiguo) y sin nadie se archiva; editar recalcula menciones sin avisar', { skip: SALTAR }, async () => {
  const o = await oficina();
  const id = (await o.llamar(o.beto, `${C}/canales`, { metodo: 'POST', cuerpo: { nombre: 'Relevo', miembros: [o.dani] } })).j.id;
  assert.equal((await o.llamar(o.beto, `${C}/canales/${id}/miembros`, { metodo: 'DELETE', cuerpo: { userId: o.ana } })).status, 404, 'Ana no está en el canal');
  assert.equal((await o.llamar(o.dani, `${C}/canales/${id}/miembros`, { metodo: 'DELETE', cuerpo: { userId: o.beto } })).status, 403);
  await o.llamar(o.beto, `${C}/canales/${id}/miembros`, { metodo: 'DELETE', cuerpo: {} });
  assert.equal(o.db.prepare("select rol from chat_miembros where canal_id = ? and user_id = ?").get(id, o.dani).rol, 'dueno', 'heredó');
  const m = (await escribe(o, o.dani, id, 'hola')).j.mensaje.id;
  await o.llamar(o.dani, `${C}/mensajes/${m}`, { metodo: 'PATCH', cuerpo: { cuerpo: 'ahora sí @Beto' } }); assert.equal(o.db.prepare('select menciones from chat_mensajes where id = ?').get(m).menciones, '[]', 'Beto ya no es miembro: no se menciona');
  await o.llamar(o.dani, `${C}/canales/${id}/miembros`, { metodo: 'DELETE', cuerpo: {} });
  assert.equal(o.db.prepare('select archivado_at a from chat_canales where id = ?').get(id).a != null, true, 'sin nadie, se archiva');
  assert.equal((await o.llamar(o.dani, `${C}/novedades?desde=0`)).j.mensajes.some((x) => x.canal === id), false, 'lo archivado no aparece en novedades');
});
