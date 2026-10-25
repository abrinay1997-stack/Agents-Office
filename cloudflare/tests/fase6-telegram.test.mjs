// Fase 6 — Telegram: el webhook público comprueba su secreto antes de abrir nada; solo los ids del dueño usan el bot; un aprobador delegado solo toca sus departamentos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oficina6, contandoD1, filas, todoD1, TOKEN_BOT, SECRETO_WEBHOOK, DUENO_TG, APROBADOR_TG, EXTRANO_TG, dimitriDice } from './fase6-ayudas.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { conSesion, cargarTareas } from '../worker/lib/tareas/sesion.js';
import { MODULOS } from '../worker/modulos/index.js';
import { SALTAR } from './d1-memoria.mjs';

const EXTRA = { TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: DUENO_TG, TELEGRAM_WEBHOOK_SECRET: SECRETO_WEBHOOK };
const S = { 'x-telegram-bot-api-secret-token': SECRETO_WEBHOOK };
let uid = 1000;
const msg = (de, texto) => ({ update_id: ++uid, message: { message_id: uid, from: { id: +de }, chat: { id: +de, type: 'private' }, text: texto } });
const toque = (de, data) => ({ update_id: ++uid, callback_query: { id: 'cb' + uid, from: { id: +de }, data, message: { message_id: 5, chat: { id: +de, type: 'private' } } } });
const enviar = (o, u, h = S) => o.anon('POST', '/api/telegram/webhook', u, h);
const dicho = (o) => o.m.textosTelegram().join('\n');

async function conEspera(o, dept = 'sales') {
  const t = (await o.admin('POST', '/api/tasks', { dept, text: 'Prepara el correo para Acme' })).j;
  await conSesion(o.d1, async (s) => { s.alm.cambiar(t.id, (x) => { x.state = 'waiting'; x.draft = 'Borrador para acme@ej.com'; }, {}); });
  return t.id;
}
const estado = async (o, id) => (await cargarTareas(o.d1)).find((x) => x.id === id).state;

test('el secreto va primero: sin él o con otro, 401 y D1 intacta; sin TELEGRAM_WEBHOOK_SECRET nadie entra', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: EXTRA }); const { n, d1 } = contandoD1(o.d1);
  const r = await manejar(new Request('https://oficina.test/api/telegram/webhook', { method: 'POST', body: JSON.stringify(msg(DUENO_TG, '/estado')) }), { ...o.env, DB: d1 });
  assert.equal(r.status, 401); assert.equal(n.prepare, 0);
  assert.equal((await enviar(o, msg(DUENO_TG, '/estado'), { 'x-telegram-bot-api-secret-token': 'otro' })).status, 401);
  const sin = await oficina6({ extraEnv: { ...EXTRA, TELEGRAM_WEBHOOK_SECRET: '' } });
  assert.equal((await enviar(sin, msg(DUENO_TG, '/estado'), { 'x-telegram-bot-api-secret-token': '' })).status, 401);
  assert.equal(o.m.registro.telegram.length, 0); assert.equal((await o.anon('GET', '/api/telegram/webhook')).status, 405);
});

test('un extraño no recibe NADA (ni su id); el dueño usa /estado y le habla a Dimitri', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: EXTRA, guion: [dimitriDice({ mode: 'charla', reply: 'Todo tranquilo por aquí.' })] });
  const r = await enviar(o, msg(EXTRANO_TG, '/estado')); assert.deepEqual([r.status, r.texto], [200, '{"ok":true}']);
  assert.equal(o.m.registro.telegram.length, 0, 'ni un solo mensaje a un extraño'); assert.equal(o.m.registro.anthropic.length, 0);
  await enviar(o, msg(DUENO_TG, '/estado')); assert.ok(o.m.registro.telegram.length >= 1);
  await enviar(o, msg(DUENO_TG, '¿cómo vamos?')); assert.match(dicho(o), /Todo tranquilo/); assert.equal(o.m.registro.anthropic.length, 1);
});

test('el mismo update_id se atiende una sola vez', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: EXTRA }); const u = msg(DUENO_TG, '/estado');
  await enviar(o, u); const a = o.m.registro.telegram.length; await enviar(o, u); assert.equal(o.m.registro.telegram.length, a);
});

test('✅ del dueño aprueba; un extraño no; un aprobador delegado solo en sus departamentos', { skip: SALTAR }, async () => {
  const p = await oficina6({ extraEnv: EXTRA, ajustes: { telegram: { approvers: { [APROBADOR_TG]: ['emails'] } } } });
  const respuestas = () => p.m.registro.telegram.map((x) => x.cuerpo?.text || '').join('|');
  const venta = await conEspera(p, 'sales');
  await enviar(p, toque(EXTRANO_TG, 'ap:' + venta)); assert.equal(respuestas(), '', 'un extraño: silencio, y no aprueba');
  p.m.registro.telegram.length = 0;
  await enviar(p, toque(APROBADOR_TG, 'ap:' + venta)); assert.match(respuestas(), /No tienes permiso/); assert.doesNotMatch(respuestas(), /Aprobada/, 'sales no es de su departamento');
  p.m.registro.telegram.length = 0;
  const correo = await conEspera(p, 'emails');
  await enviar(p, toque(APROBADOR_TG, 'ap:' + correo)); assert.match(respuestas(), /Aprobada/, 'emails sí');
  p.m.registro.telegram.length = 0;
  await enviar(p, toque(DUENO_TG, 'ap:' + venta)); assert.match(respuestas(), /Aprobada/, 'el dueño aprueba lo suyo');
});

test('↩ Devolver pide el motivo y la siguiente línea lo trae; la tarea sale de la espera', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: EXTRA }); const id = await conEspera(o);
  await enviar(o, toque(DUENO_TG, 'rj:' + id)); assert.match(dicho(o), /Qué debe cambiar/);
  await enviar(o, msg(DUENO_TG, 'Menciona el descuento'));
  assert.notEqual(await estado(o, id), 'waiting');
});

test('los avisos salientes: llegan una vez, sin inundar con el historial, y el no molestar los retiene', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: EXTRA });
  const cada = MODULOS.find((m) => m.nombre === 'telegram').cadaMinuto;
  await cada(o.env); assert.equal(o.m.textosTelegram().length, 0, 'la primera vez solo se apunta lo que ya había');
  const id = await conEspera(o); await cada(o.env);
  assert.match(dicho(o), /Acme|aprob|espera/i); const n = o.m.registro.telegram.length;
  await cada(o.env); assert.equal(o.m.registro.telegram.length, n, 'no se repite');
  assert.ok(id);
});

test('el token del bot nunca sale en D1, ni en una respuesta, ni en un fallo de Telegram', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: EXTRA, telegramFalla: 'Forbidden' });
  await enviar(o, msg(DUENO_TG, '/estado'));
  assert.ok(!todoD1(o.d1).includes(TOKEN_BOT)); assert.ok(!todoD1(o.d1).includes(SECRETO_WEBHOOK));
  const s = await o.admin('GET', '/api/settings/telegram'); assert.ok(!s.texto.includes(TOKEN_BOT)); assert.equal(s.j.on, true);
  assert.equal(filas(o.d1, 'select * from telegram_updates').length >= 1, true);
});

test('anuncios por Telegram: nadie salvo el dueño toca la lista y /anuncios sin cuenta lo dice en palabras', { skip: SALTAR }, async () => {
  const p = await oficina6({ extraEnv: EXTRA, ajustes: { telegram: { approvers: { [APROBADOR_TG]: ['marketing'] } } } });
  await enviar(p, msg(APROBADOR_TG, '/anuncios')); assert.doesNotMatch(dicho(p), /Activar/);
  await enviar(p, toque(APROBADOR_TG, 'an:act:x1')); assert.doesNotMatch(dicho(p), /gasta hasta/);
});
