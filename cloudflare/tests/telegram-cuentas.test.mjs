// N2 (Fase 8): vincular Telegram por CUENTA (D01–D05). Código con HMAC y un solo uso, respuesta uniforme sin oráculo, confirmación en la app, una cuenta vinculada NUNCA es `who`
// (ni aprueba ni envía), comandos por rol, «no molestar» por persona, avisos sin texto, y todo apagado con el flag de notificaciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { oficina6, TOKEN_BOT, SECRETO_WEBHOOK, DUENO_TG, EXTRANO_TG, filas } from './fase6-ayudas.mjs';
import { guardarConfig as notif } from '../worker/lib/notificaciones.js';
import { guardarConfig as notas } from '../worker/lib/notas-personales.js';
import { generarCodigo, limpiarCodigo, ALFABETO, LARGO_CODIGO, enSilencio, hmacCodigo } from '../worker/lib/telegram-cuentas.js';
import { parseSilencio, parteComando } from '../worker/lib/telegram-cuentas-bot.js';
import { SALTAR } from './d1-memoria.mjs';

const EXTRA = { TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: DUENO_TG, TELEGRAM_WEBHOOK_SECRET: SECRETO_WEBHOOK };
const S = { 'x-telegram-bot-api-secret-token': SECRETO_WEBHOOK };
const ED_TG = '700100200', LE_TG = '700100300';
let uid = 5000;
const msg = (de, texto) => ({ update_id: ++uid, message: { message_id: uid, from: { id: +de, username: 'u' + de }, chat: { id: +de, type: 'private' }, text: texto } });
const toque = (de, data) => ({ update_id: ++uid, callback_query: { id: 'cb' + uid, from: { id: +de }, data, message: { message_id: 5, chat: { id: +de, type: 'private' } } } });
const tg = (o, u) => o.anon('POST', '/api/telegram/webhook', u, S);
const dicho = (o, chat) => o.m.registro.telegram.filter((x) => x.metodo === 'sendMessage' && (chat == null || String(x.cuerpo?.chat_id) === String(chat))).map((x) => x.cuerpo.text);

async function mundo({ activo = true } = {}) {
  const o = await oficina6({ extraEnv: EXTRA });
  if (activo) { await notif(o.d1, { activo: true }); await notas(o.d1, { activo: true }); }
  const vincular = async (quien, chat) => {
    const c = (await o[quien]('POST', '/api/vinculo-telegram/codigo', {})).j.codigo;
    await tg(o, msg(chat, '/vincular ' + c));
    const r = await o[quien]('POST', '/api/vinculo-telegram/confirmar', { aceptar: true });
    return { c, r };
  };
  return { ...o, vincular };
}

test('puro: el código es de 10 caracteres sin ambiguos (49 bits), se limpia, y el HMAC no es el código', async () => {
  for (let i = 0; i < 200; i++) { const c = generarCodigo(); assert.equal(c.length, LARGO_CODIGO); assert.ok([...c].every((x) => ALFABETO.includes(x))); }
  assert.equal(limpiarCodigo('ABCDEFGH'), null, 'largo malo'); assert.equal(limpiarCodigo('0OIL1ABCDE'), null, 'caracteres ambiguos');
  const c = generarCodigo(); assert.equal(limpiarCodigo(c.toLowerCase()), c);
  const h = await hmacCodigo({ TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(20) }, c); assert.match(h, /^[0-9a-f]{64}$/); assert.ok(!h.includes(c));
  assert.deepEqual(parseSilencio('0'), { quitar: true }); assert.deepEqual(parseSilencio('22-7'), { desde_h: 22, hasta_h: 7 }); assert.equal(parseSilencio('99'), null); assert.ok(parseSilencio('2', 1000).hasta === 1000 + 7200e3);
  assert.deepEqual(parteComando('/nota@MiBot @ana hola'), { cmd: 'nota', arg: '@ana hola' }); assert.equal(parteComando('hola'), null);
  assert.equal(enSilencio({ hasta: 5000 }, 1000), true); assert.equal(enSilencio({ hasta: 500 }, 1000), false);
});

test('flag apagado: la app no da códigos, el bot sigue en silencio total y /vincular no contesta', { skip: SALTAR }, async () => {
  const o = await mundo({ activo: false });
  assert.equal((await o.editor('GET', '/api/vinculo-telegram')).j.activo, false); assert.equal((await o.editor('POST', '/api/vinculo-telegram/codigo', {})).status, 409);
  await tg(o, msg(ED_TG, '/vincular ABCDEFGHJK')); assert.equal(o.m.registro.telegram.length, 0, 'ni una respuesta');
});

test('vincular: código → /vincular → confirmar en la app; un código de un solo uso; un administrador no se vincula por aquí', { skip: SALTAR }, async () => {
  const o = await mundo();
  assert.equal((await o.admin('POST', '/api/vinculo-telegram/codigo', {})).status, 403);
  const { c, r } = await o.vincular('editor', ED_TG);
  assert.equal(r.status, 200); assert.match(dicho(o, ED_TG)[0], /confirma la vinculación en la app/); assert.match(dicho(o, ED_TG).at(-1), /Listo/);
  assert.equal((await o.editor('GET', '/api/vinculo-telegram')).j.estado, 'activa');
  assert.ok(!JSON.stringify(filas(o.d1, 'select * from cuenta_telegram')).includes(c), 'el código no se guarda en claro');
  await tg(o, msg(LE_TG, '/vincular ' + c)); // reutilizado
  assert.equal((await o.lectura('GET', '/api/vinculo-telegram')).j.estado, 'ninguna');
});

test('SIN ORÁCULO: un código bueno, malo, vencido o ajeno recibe exactamente la misma respuesta; el extraño sin /vincular, nada', { skip: SALTAR }, async () => {
  const o = await mundo();
  const bueno = (await o.editor('POST', '/api/vinculo-telegram/codigo', {})).j.codigo;
  await tg(o, msg(ED_TG, '/vincular ' + bueno)); await tg(o, msg(EXTRANO_TG, '/vincular ABCDEFGHJK')); await tg(o, msg(EXTRANO_TG, '/vincular basura'));
  o.d1._db.prepare('update cuenta_telegram set codigo_hmac = null'); // (ya canjeado)
  const t = dicho(o); assert.equal(t.length, 3); assert.equal(new Set(t).size, 1, 'la misma frase para todos');
  await tg(o, msg(EXTRANO_TG, '/estado')); await tg(o, msg(EXTRANO_TG, 'hola')); assert.equal(dicho(o).length, 3, 'fuera de /vincular, silencio');
});

test('un código vencido no vincula; rechazar en la app deja todo como estaba; un id no sirve para dos cuentas', { skip: SALTAR }, async () => {
  const o = await mundo();
  const c1 = (await o.editor('POST', '/api/vinculo-telegram/codigo', {})).j.codigo;
  o.d1._db.prepare('update cuenta_telegram set codigo_vence_at = 1').run();
  await tg(o, msg(ED_TG, '/vincular ' + c1)); assert.equal((await o.editor('GET', '/api/vinculo-telegram')).j.estado, 'ninguna');
  const c2 = (await o.editor('POST', '/api/vinculo-telegram/codigo', {})).j.codigo; await tg(o, msg(ED_TG, '/vincular ' + c2));
  assert.equal((await o.editor('GET', '/api/vinculo-telegram')).j.estado, 'pendiente'); assert.equal((await o.editor('GET', '/api/vinculo-telegram')).j.username, 'u' + ED_TG);
  assert.equal((await o.editor('POST', '/api/vinculo-telegram/confirmar', { aceptar: false })).status, 200); assert.equal((await o.editor('GET', '/api/vinculo-telegram')).j.estado, 'ninguna');
  assert.equal((await o.editor('POST', '/api/vinculo-telegram/confirmar', { aceptar: true })).status, 404, 'sin nada pendiente');
  await o.vincular('editor', ED_TG);
  const c3 = (await o.lectura('POST', '/api/vinculo-telegram/codigo', {})).j.codigo; await tg(o, msg(ED_TG, '/vincular ' + c3));
  assert.equal((await o.lectura('GET', '/api/vinculo-telegram')).j.estado, 'codigo', 'el id ya es de otra cuenta: no se liga');
});

test('topes de intentos: pasados 5 en un minuto desde un id, deja de contestar', { skip: SALTAR }, async () => {
  const o = await mundo();
  for (let i = 0; i < 9; i++) await tg(o, msg(EXTRANO_TG, '/vincular ABCDEFGHJK'));
  assert.equal(dicho(o).length, 5);
});

test('una cuenta vinculada NO es `who`: no aprueba, no ve /pendientes ni /anuncios, un ✅ de aprobar no hace nada', { skip: SALTAR }, async () => {
  const o = await mundo(); await o.vincular('editor', ED_TG);
  const t = (await o.admin('POST', '/api/tasks', { dept: 'sales', text: 'Prepara el correo' })).j;
  o.d1._db.prepare("update filas set json = json_set(json, '$.state', 'waiting') where coleccion = 'tareas' and id = ?").run(t.id);
  const antes = dicho(o).length, ia0 = o.m.registro.anthropic.length;
  for (const c of ['/pendientes', '/anuncios', '/estado', '/contenido', 'cuéntame todo']) await tg(o, msg(ED_TG, c));
  const nuevos = dicho(o).slice(antes); assert.equal(nuevos.length, 5); assert.ok(nuevos.every((x) => /No autorizado|ayuda/.test(x)), nuevos.join('|'));
  await tg(o, toque(ED_TG, 'ap:' + t.id));
  assert.ok(o.m.registro.telegram.some((x) => x.metodo === 'answerCallbackQuery' && /No autorizado/.test(x.cuerpo.text)));
  assert.equal(filas(o.d1, "select json_extract(json,'$.state') s from filas where coleccion = 'tareas' and id = ?", t.id)[0].s, 'waiting', 'nada se aprobó');
  assert.equal(o.m.registro.anthropic.length, ia0, 'ni Dimitri contesta');
});

test('comandos por rol: lectura no tiene /mias ni /yo; el editor sí, y /yo escribe a SU nombre', { skip: SALTAR }, async () => {
  const o = await mundo(); await o.vincular('editor', ED_TG); await o.vincular('lectura', LE_TG);
  await tg(o, msg(LE_TG, '/mias')); assert.match(dicho(o, LE_TG).at(-1), /No autorizado/);
  await tg(o, msg(LE_TG, '/ayuda')); assert.ok(!/\/mias/.test(dicho(o, LE_TG).at(-1)));
  await tg(o, msg(ED_TG, '/yo llamar al proveedor')); assert.match(dicho(o, ED_TG).at(-1), /Anotada/);
  await tg(o, msg(ED_TG, '/mias')); assert.match(dicho(o, ED_TG).at(-1), /llamar al proveedor/);
  await tg(o, msg(LE_TG, '/mias')); assert.doesNotMatch(dicho(o, LE_TG).at(-1), /llamar al proveedor/);
});

test('notas por Telegram: /nota crea (lectura a una persona), avisa SIN el texto, /notas no lo trae, y «Cerrar» cierra solo las suyas', { skip: SALTAR }, async () => {
  const o = await mundo(); await o.vincular('editor', ED_TG); await o.vincular('lectura', LE_TG);
  const nombreEd = (await o.editor('GET', '/api/yo')).j.usuario.nombre;
  await tg(o, msg(LE_TG, `/nota @${nombreEd} secreto de la lectura`)); assert.match(dicho(o, LE_TG).at(-1), /Nota dejada/);
  const aviso = dicho(o, ED_TG).at(-1); assert.match(aviso, /te dejó una nota/); assert.ok(!aviso.includes('secreto'), 'Telegram es un tercero: nunca el texto');
  await tg(o, msg(ED_TG, '/notas')); const lista = dicho(o, ED_TG).at(-1); assert.ok(!lista.includes('secreto')); assert.match(lista, /Léela en la oficina/);
  const id = filas(o.d1, 'select id from notas_personales')[0].id;
  await tg(o, toque(LE_TG, 'nc:' + id)); assert.equal(filas(o.d1, 'select count(*) n from notas_estado where cerrada_at is not null')[0].n, 0, 'otro no la cierra');
  await tg(o, toque(ED_TG, 'nc:' + id)); assert.equal(filas(o.d1, 'select count(*) n from notas_estado where cerrada_at is not null')[0].n, 1);
});

test('«no molestar» por persona: /silencio calla sus avisos sin tocar a los demás; desvincular y quitar a la persona cortan todo', { skip: SALTAR }, async () => {
  const o = await mundo(); await o.vincular('editor', ED_TG); await o.vincular('lectura', LE_TG);
  const nombreEd = (await o.editor('GET', '/api/yo')).j.usuario.nombre, nombreLe = (await o.lectura('GET', '/api/yo')).j.usuario.nombre;
  await tg(o, msg(ED_TG, '/silencio 2')); assert.match(dicho(o, ED_TG).at(-1), /Sin avisos por 2/);
  const e0 = dicho(o, ED_TG).length, l0 = dicho(o, LE_TG).length;
  await o.admin('POST', '/api/notas-personales', { para: 'persona:' + filas(o.d1, "select u.id from users u where u.email = 'editor@panaclaw.test'")[0].id, cuerpo: 'hola' });
  await o.admin('POST', '/api/notas-personales', { para: 'persona:' + filas(o.d1, "select u.id from users u where u.email = 'lee@panaclaw.test'")[0].id, cuerpo: 'hola' });
  assert.equal(dicho(o, ED_TG).length, e0, 'el editor está en silencio'); assert.equal(dicho(o, LE_TG).length, l0 + 1, 'la lectura sí recibe');
  await tg(o, msg(ED_TG, '/silencio 0')); await tg(o, msg(LE_TG, '/desvincular'));
  assert.equal((await o.lectura('GET', '/api/vinculo-telegram')).j.estado, 'ninguna');
  await tg(o, msg(LE_TG, '/mias')); assert.equal(dicho(o, LE_TG).filter((x) => /No autorizado/.test(x)).length, 0, 'ya es un extraño: silencio');
  o.d1._db.prepare("insert into perfiles (user_id, baja_at) values ((select id from users where email = 'editor@panaclaw.test'), 1) on conflict (user_id) do update set baja_at = 1").run();
  const n = dicho(o, ED_TG).length; await tg(o, msg(ED_TG, '/ayuda')); assert.equal(dicho(o, ED_TG).length, n, 'quitada del equipo: silencio'); void nombreEd; void nombreLe;
});

test('presencia por Telegram: el administrador que lo pidió recibe «se conectó» una vez, sin socket vivo; con socket, solo el aviso de dentro', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: EXTRA }); await notif(o.d1, { activo: true });
  const adminId = filas(o.d1, "select id from users where email = 'admin@panaclaw.test' or rol = 'admin'")[0].id, emailAdmin = filas(o.d1, 'select email from users where id = ?', adminId)[0].email;
  o.d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('ajustes', ?, 1, 'x') on conflict (clave) do update set json = excluded.json").run(JSON.stringify({ telegram: { admins: { [DUENO_TG]: emailAdmin } } }));
  await o.admin('POST', '/api/notas-personales/preferencias-conexion', { avisarme: true, oficina: false, telegram: true });
  await o.editor('GET', '/api/notas-personales/entrada');
  assert.equal(dicho(o, DUENO_TG).filter((x) => /se conectó/.test(x)).length, 1);
  await o.editor('GET', '/api/notas-personales/entrada'); assert.equal(dicho(o, DUENO_TG).filter((x) => /se conectó/.test(x)).length, 1, 'una vez por visita');
});

test('canje ATÓMICO: dos /vincular a la vez con el mismo código, solo uno lo gasta', { skip: SALTAR }, async () => {
  const o = await mundo(); const { canjearCodigo } = await import('../worker/lib/telegram-cuentas.js');
  const c = (await o.editor('POST', '/api/vinculo-telegram/codigo', {})).j.codigo;
  const r = await Promise.all([canjearCodigo(o.d1, o.env, { telegramId: '700100201', username: 'a', codigo: c }), canjearCodigo(o.d1, o.env, { telegramId: '700100202', username: 'b', codigo: c })]);
  assert.deepEqual(r.filter(Boolean).length, 1);
  const est = (await o.editor('GET', '/api/vinculo-telegram')).j; assert.equal(est.estado, 'pendiente'); assert.match(est.telegramId, /^7001002/, 'la app enseña también el id numérico');
});

test('los extraños tienen su cubo: ni las cuentas vinculadas ni /vincular lo gastan, y un extraño cuenta una sola vez', { skip: SALTAR }, async () => {
  const o = await mundo(); await o.vincular('editor', ED_TG);
  const cubo = () => filas(o.d1, "select coalesce(sum(n),0) n from publica_tasa where clave = 'telegram-extranos'")[0].n; // secrets-ok: no es una clave
  for (let i = 0; i < 30; i++) await tg(o, msg(ED_TG, '/ayuda')); for (let i = 0; i < 3; i++) await tg(o, msg(EXTRANO_TG, '/vincular ABCDEFGHJK'));
  assert.equal(cubo(), 0, 'cuentas y /vincular no cuentan como extraños');
  await tg(o, msg(EXTRANO_TG, 'hola')); assert.equal(cubo(), 1, 'un extraño, una vez');
  assert.equal(filas(o.d1, 'select count(*) n from telegram_updates')[0].n >= 0, true);
  const antes = filas(o.d1, 'select count(*) n from telegram_updates')[0].n; await tg(o, msg(EXTRANO_TG, 'otra')); assert.equal(filas(o.d1, 'select count(*) n from telegram_updates')[0].n, antes, 'un extraño no escribe en D1');
});

test('un aviso de una persona de Ajustes → Equipo no llega a una cuenta de otro con el mismo nombre; la cuenta sola recibe un aviso genérico', { skip: SALTAR }, async () => {
  const o = await mundo(); await o.vincular('lectura', LE_TG);
  const nombreLe = (await o.lectura('GET', '/api/yo')).j.usuario.nombre;
  const { armar, salientes } = await import('../worker/lib/telegram.js'); const { MODULOS_BOT } = await import('../worker/modulos/telegram.js');
  const { emitirAviso } = await import('../worker/lib/avisos.js');
  const t = await armar({ env: o.env, db: o.d1, modulos: MODULOS_BOT }); await salientes(t); // la primera pasada solo apunta lo que ya había
  await emitirAviso(o.d1, { kind: 'persona', text: 'Te asignaron «Factura privada»', persona: nombreLe });
  const t2 = await armar({ env: o.env, db: o.d1, modulos: MODULOS_BOT }); t2.st.avisosHasta = Date.now() - 5000; await salientes(t2);
  const dicho2 = dicho(o, LE_TG).join('|'); assert.match(dicho2, /Tienes un aviso nuevo/); assert.ok(!dicho2.includes('Factura privada'), 'la cuenta no recibe el texto del aviso');
});
