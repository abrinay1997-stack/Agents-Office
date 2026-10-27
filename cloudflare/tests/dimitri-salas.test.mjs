// 27 oct 2026 — Dimitri tiene UN CHAT POR CUENTA (pedido del dueño: «que Avalon no vea lo que hablo con Dimitri»). Hasta hoy la conversación, su historial y el resumen de la sesión eran comunes
// a todos los administradores. Ahora cada cuenta tiene su sala (lib/dimitri/chat.js): lo que habla una no lo lee la otra, ni en el chat, ni en el historial, ni abriendo una conversación ajena por su id.
// Contra el Worker entero y una D1 de verdad en memoria, con un Anthropic de mentira.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SALTAR, sembrar } from './d1-memoria.mjs';
import { oficina6, dimitriDice, filas, DUENO_TG } from './fase6-ayudas.mjs';
import { manejar } from '../worker/lib/rutas.js';
import * as chat from '../worker/lib/dimitri/chat.js';
import { informeSemanal } from '../worker/lib/dimitri/semanal.js';

const charla = (reply) => dimitriDice({ mode: 'charla', reply });
/** Una segunda cuenta de administrador (la que no es el dueño), con su propia sesión. */
async function segundoAdmin(o, email = 'avalon@panaclaw.test') {
  const c = await sembrar(o.d1, { email, rol: 'admin' });
  const r = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: c.email, contrasena: c.clave }) }), o.env);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const uid = filas(o.d1, 'select id from users where email = ?', email)[0].id;
  const llamar = async (metodo, ruta, cuerpo) => {
    const x = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', cookie }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), o.env);
    const tx = await x.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: x.status, j, texto: tx };
  };
  return { llamar, uid };
}
const dueno = (o) => filas(o.d1, "select id from users where email = 'dueno@panaclaw.test'")[0].id;

test('cada cuenta tiene SU chat: lo que habla una no lo ve la otra, y el historial tampoco', { skip: SALTAR }, async () => {
  const o = await oficina6({ guion: [charla('Para el dueño.'), charla('Para Avalon.')] }), av = await segundoAdmin(o);
  assert.equal((await o.admin('POST', '/api/sub/chat', { text: 'Mi secreto de precios: bajar el combo a 9' })).status, 200);
  assert.equal((await av.llamar('POST', '/api/sub/chat', { text: 'Pregunta de Avalon sobre el lunes' })).status, 200);
  const suyo = (await o.admin('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n'), ajeno = (await av.llamar('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n');
  assert.match(suyo, /Mi secreto de precios/); assert.doesNotMatch(suyo, /Pregunta de Avalon/, 'el dueño no ve lo de Avalon');
  assert.match(ajeno, /Pregunta de Avalon/); assert.doesNotMatch(ajeno, /Mi secreto de precios/, 'Avalon no ve lo del dueño');
  assert.equal((await av.llamar('GET', '/api/sub')).j.messages.length, 2);
  // el prompt de Avalon tampoco trae lo del dueño (cada turno lee SU conversación)
  const sistemas = o.m.registro.anthropic.map((x) => x.system + JSON.stringify(x.messages));
  assert.ok(!sistemas[1].includes('Mi secreto de precios'), 'a Dimitri no se le cuela la conversación ajena');
  assert.equal(filas(o.d1, "select count(distinct coleccion) n from filas where coleccion like 'subgerente:%'")[0].n, 2, 'dos salas, una por cuenta');

  // «Nueva conversación», historial: cada una el suyo
  const a1 = (await o.admin('POST', '/api/sub/clear', {})).j.archived; assert.ok(a1);
  assert.equal((await o.admin('GET', '/api/sub/conversaciones')).j.lista.length, 1);
  assert.equal((await av.llamar('GET', '/api/sub/conversaciones')).j.lista.length, 0, 'Avalon no ve el historial del dueño');
  assert.equal((await av.llamar('GET', `/api/sub/conversaciones/${a1}`)).status, 404, 'ni la lee por su id');
  assert.equal((await av.llamar('POST', '/api/sub/abrir', { id: a1 })).status, 404, 'ni la abre');
  assert.equal((await av.llamar('POST', '/api/sub/borrar', { id: a1 })).status, 404, 'ni la borra');
  assert.equal((await av.llamar('POST', '/api/sub/restore', { id: a1 })).status, 404, 'ni la trae a su chat');
  assert.equal((await av.llamar('POST', '/api/sub/renombrar', { id: a1, titulo: 'mía' })).status, 404, 'ni le cambia el título');
  assert.equal((await av.llamar('GET', '/api/sub')).j.messages.length, 2, 'y su chat sigue como estaba');
  assert.equal((await o.admin('GET', `/api/sub/conversaciones/${a1}`)).status, 200, 'la dueña de la conversación sí la lee');
});

test('quién puede: solo un administrador (un editor o un lector, 403); su sala es la de su cuenta, y renombrar una conversación archivada funciona', { skip: SALTAR }, async () => {
  const o = await oficina6({ guion: [charla('ok')] });
  assert.equal((await o.editor('GET', '/api/sub')).status, 403); assert.equal((await o.lectura('POST', '/api/sub/chat', { text: 'hola' })).status, 403); assert.equal((await o.anon('GET', '/api/sub')).status, 401);
  const ia = (await o.admin('GET', '/api/sub')).j.ia; assert.equal(typeof ia.gasto.usd, 'number', 'la pastilla del gasto de IA del mes'); assert.ok(['none', 'ok', 'alert', 'over'].includes(ia.gasto.nivel));
  await o.admin('POST', '/api/sub/chat', { text: '¿Cómo vamos con las ventas?' });
  const id = (await o.admin('POST', '/api/sub/clear', {})).j.archived;
  assert.equal((await o.admin('POST', '/api/sub/renombrar', { id, titulo: '  Ventas   de octubre  ' })).status, 200);
  assert.equal((await o.admin('GET', '/api/sub/conversaciones')).j.lista[0].titulo, 'Ventas de octubre', 'el título nuevo, sin espacios de sobra');
  assert.equal((await o.admin('POST', '/api/sub/renombrar', { id, titulo: '   ' })).status, 404, 'un título vacío no se acepta');
  assert.equal((await o.admin('POST', '/api/sub/renombrar', { id: 'zzzz', titulo: 'x' })).status, 404);
});

test('Telegram: el dueño del bot usa el chat del dueño; una cuenta con su id registrado, el suyo; una que dejó de ser administradora, ninguno', { skip: SALTAR }, async () => {
  const o = await oficina6({ guion: [charla('desde el teléfono del dueño'), charla('desde el teléfono de Avalon')] }), av = await segundoAdmin(o);
  const d1 = o.d1, db = o.env.DB;
  d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('ajustes', ?, 1, 'x')").run(JSON.stringify({ telegram: { admins: { '555666777': 'avalon@panaclaw.test' } } }));
  assert.equal(await chat.uidDe(db, { id: 'telegram', email: 'telegram:' + DUENO_TG }), dueno(o), 'sin cuenta registrada: la del dueño');
  assert.equal(await chat.uidDe(db, { id: 'telegram', email: 'telegram:555666777' }), av.uid, 'con su id registrado: la suya');
  assert.equal(await chat.uidDe(db, { id: 'telegram', email: 'telegram: Ana' }), null, 'un texto que no es un id no tiene sala');
  assert.equal(await chat.uidDe(db, { id: 'oficina', email: 'oficina' }), null, 'el reloj tampoco');
  // por la ruta de verdad (lo que hace el bot): el mensaje cae en la sala correcta
  const tg = async (de, texto) => (await import('../worker/modulos/dimitri.js')).manejar({ req: new Request('https://oficina.test/api/sub/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: texto }) }), env: o.env, db, usuario: { id: 'telegram', email: 'telegram:' + de, rol: 'admin' }, ruta: '/api/sub/chat' });
  assert.equal((await tg(DUENO_TG, 'Hola desde el teléfono del dueño')).status, 200); assert.equal((await tg('555666777', 'Hola desde el teléfono de Avalon')).status, 200);
  assert.match((await o.admin('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n'), /teléfono del dueño/); assert.doesNotMatch((await o.admin('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n'), /teléfono de Avalon/);
  assert.match((await av.llamar('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n'), /teléfono de Avalon/);
  d1._db.prepare("update users set rol = 'editor' where email = 'avalon@panaclaw.test'").run();
  assert.equal(await chat.uidDe(db, { id: 'telegram', email: 'telegram:555666777' }), null, 'degradada: el bot ya no le abre su chat');
});

test('el resumen del lunes llega al chat de CADA administrador (una sola llamada al modelo); el botón lo pone solo en el de quien lo pulsa', { skip: SALTAR }, async () => {
  const o = await oficina6({ guion: [charla('x')] }), av = await segundoAdmin(o);
  o.m.guion.length = 0; o.m.guion.push(dimitriDice('Semana tranquila: 4 tareas hechas y nada atrasado.'));
  const antes = o.m.registro.anthropic.length;
  await informeSemanal({ env: o.env, db: o.env.DB, force: true, fetchFn: o.env.__pruebas.fetch });
  assert.equal(o.m.registro.anthropic.length - antes, 1, 'se escribe una vez');
  for (const quien of [o.admin, av.llamar]) { const t = (await quien('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n'); assert.match(t, /Resumen de la semana/); }
  // el botón «ahora» (semana ya reclamada: force) solo escribe en la sala de quien lo pulsa
  o.m.guion.push(dimitriDice('Otro resumen a pedido.'));
  const r = await av.llamar('POST', '/api/sub/weekly', {}); assert.equal(r.status, 200, r.texto);
  assert.match((await av.llamar('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n'), /Otro resumen a pedido/);
  assert.doesNotMatch((await o.admin('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n'), /Otro resumen a pedido/, 'el del dueño no lo recibió');
});

test('la migración 0101 le da la conversación común al administrador más antiguo (mensajes, resumen e historial) y no toca las archivadas', { skip: SALTAR }, async () => {
  const o = await oficina6(), db = o.d1._db, duenoId = dueno(o);
  await segundoAdmin(o); // otra cuenta, más nueva
  const viejo = o.d1._db.prepare("select id from users order by created_at asc, rowid asc limit 1").get().id; assert.equal(viejo, duenoId, 'el dueño es la cuenta más antigua');
  // cómo estaba la nube antes: una sola conversación para todos
  db.prepare("insert into filas (coleccion, id, json, orden, actualizado) values ('subgerente', 'm1', '{\"id\":\"m1\",\"who\":\"user\",\"text\":\"antes\",\"at\":1}', 1, 'x'), ('subgerente', 'm2', '{\"id\":\"m2\",\"who\":\"sub\",\"text\":\"respuesta\",\"at\":2}', 2, 'x'), ('subgerente-hilo', 'actual', '{\"decisiones\":[\"x\"]}', 0, 'x'), ('subgerente-hilo', 'c1abc', '{\"decisiones\":[\"y\"]}', 0, 'x'), ('subgerente-arch:c1abc', 'a1', '{\"id\":\"a1\"}', 1, 'x')").run();
  db.prepare("insert into docs (clave, json, version, actualizado) values ('subgerente.archivo', '{\"lista\":[{\"id\":\"c1abc\",\"at\":1,\"n\":1,\"titulo\":\"vieja\"}]}', 1, 'x')").run();
  db.exec(fs.readFileSync(new URL('../migraciones/0101_dimitri_por_cuenta.sql', import.meta.url), 'utf8'));
  assert.deepEqual(filas(o.d1, "select id from filas where coleccion = ? order by id", 'subgerente:' + duenoId).map((x) => x.id), ['m1', 'm2']);
  assert.equal(filas(o.d1, "select count(*) n from filas where coleccion = 'subgerente'")[0].n, 0, 'ya no queda conversación común');
  assert.deepEqual(filas(o.d1, "select id from filas where coleccion = 'subgerente-hilo' order by id").map((x) => x.id), ['actual:' + duenoId, 'c1abc'], 'su resumen es suyo; el de la archivada sigue con su id');
  assert.equal(filas(o.d1, "select count(*) n from filas where coleccion = 'subgerente-arch:c1abc'")[0].n, 1);
  assert.equal(filas(o.d1, "select count(*) n from docs where clave = ?", 'subgerente.archivo:' + duenoId)[0].n, 1); assert.equal(filas(o.d1, "select count(*) n from docs where clave = 'subgerente.archivo'")[0].n, 0); // secrets-ok: `clave` es la columna de la tabla de documentos
  // y la página del dueño la ve, con su historial; la del otro administrador, vacía
  assert.deepEqual((await o.admin('GET', '/api/sub')).j.messages.map((m) => m.id), ['m1', 'm2']);
  assert.equal((await o.admin('GET', '/api/sub/conversaciones')).j.lista[0].titulo, 'vieja');
  // idempotente: volver a correrla no mueve nada más
  db.exec(fs.readFileSync(new URL('../migraciones/0101_dimitri_por_cuenta.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await o.admin('GET', '/api/sub')).j.messages.map((m) => m.id), ['m1', 'm2']);
});

test('migrar desde la computadora: la conversación de allá entra en la sala de quien migra (no en una común)', { skip: SALTAR }, async () => {
  const o = await oficina6(), av = await segundoAdmin(o);
  const r = await av.llamar('POST', '/api/migrar/filas', { coleccion: 'subgerente', filas: [{ id: 'l1', valor: { id: 'l1', who: 'user', text: 'desde mi compu', at: 1 } }] }); assert.equal(r.status, 200, r.texto); assert.equal(r.j.total, 1);
  assert.match((await av.llamar('GET', '/api/sub')).j.messages.map((m) => m.text).join('\n'), /desde mi compu/);
  assert.equal((await o.admin('GET', '/api/sub')).j.messages.length, 0, 'el dueño no la recibe');
  const d = await av.llamar('POST', '/api/migrar/docs', { clave: 'subgerente.archivo', valor: { lista: [{ id: 'c9zzz', at: 1, n: 1, titulo: 'de la compu' }] } }); assert.equal(d.status, 200, d.texto); // secrets-ok: `clave` es la columna de la tabla de documentos
  assert.equal((await av.llamar('GET', '/api/sub/conversaciones')).j.lista[0].titulo, 'de la compu'); assert.equal((await o.admin('GET', '/api/sub/conversaciones')).j.lista.length, 0);
});

test('los creativos que terminan avisan en el chat de QUIEN los pidió (el reloj recorre las salas con algo esperando)', { skip: SALTAR }, async () => {
  const o = await oficina6(), av = await segundoAdmin(o), db = o.env.DB;
  const salaA = chat.sala(db, av.uid), salaD = chat.sala(db, dueno(o));
  await salaA.anexar({ id: 'p1', who: 'sub', text: 'propuesta', at: Date.now(), studio: { creatives: [{ i: 0, state: 'sent', jobId: 'no-existe', title: 'Foto' }] } });
  await salaD.anexar({ id: 'p2', who: 'sub', text: 'otra', at: Date.now() });
  assert.deepEqual(await chat.uidsConSala(db, { enviados: true }), [av.uid], 'solo la sala con un creativo esperando');
  assert.deepEqual((await chat.uidsConSala(db)).sort(), [av.uid, dueno(o)].sort());
  assert.deepEqual(await chat.uidsAdmins(db), [dueno(o), av.uid], 'el dueño primero');
  assert.equal((await chat.mensajeEnCualquierSala(db, 'p1')).uid, av.uid, 'la segunda mitad del clic de Anuncios encuentra la tarjeta en su sala');
  assert.equal(await chat.mensajeEnCualquierSala(db, 'nadie'), null);
  assert.equal(await chat.mensajeConToken(db, 'x'), null, 'un token corto o raro no busca nada'); assert.equal(await chat.mensajeConToken(db, "x' or '1'='1"), null);
});
