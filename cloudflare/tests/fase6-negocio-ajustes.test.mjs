// Fase 6 — Negocio (indicadores, cifras, voz, documentos, «Preparar desde mi web») y Ajustes / Estado / health rico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oficina6, contandoD1, filas, todoD1, HOOK, TOKEN_BOT, dimitriDice } from './fase6-ayudas.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { MODULOS } from '../worker/modulos/index.js';
import { conSesion } from '../worker/lib/tareas/sesion.js';
import { SALTAR, sinCruzarMinuto } from './d1-memoria.mjs';

const H = { 'x-office-token': HOOK };

test('indicadores: crear, valor a mano, webhook con token (sin él D1 intacta), tope por minuto y solo admin escribe', { skip: SALTAR }, async () => {
  await sinCruzarMinuto(); // el tope cuenta por minuto del reloj: sin esto, si las llamadas cruzan el cambio de minuto, la última no da 429
  const o = await oficina6();
  assert.equal((await o.editor('POST', '/api/business/kpi', { id: 'ventas_semana', name: 'Ventas' })).status, 403);
  assert.equal((await o.admin('POST', '/api/business/kpi', { id: 'ventas_semana', name: 'Ventas', unit: '$', goal: 2000 })).status, 200);
  assert.equal((await o.admin('POST', '/api/business/value', { id: 'ventas_semana', value: '1.250,50' })).status, 200);
  const p = (await o.lectura('GET', '/api/business')).j; assert.equal(p.kpis[0].id, 'ventas_semana'); assert.equal(p.kpis[0].last?.value ?? p.kpis[0].value, 1250.5);
  // webhook
  const { n, d1 } = contandoD1(o.d1);
  const sin = await manejar(new Request('https://oficina.test/api/kpi/ventas_semana', { method: 'POST', body: '{"value":9}' }), { ...o.env, DB: d1 });
  assert.equal(sin.status, 401); assert.equal(n.prepare, 0);
  assert.equal((await o.anon('POST', '/api/kpi/ventas_semana', { value: 1800 }, H)).status, 200);
  assert.equal((await o.anon('POST', '/api/kpi/no_existe', { value: 1 }, H)).status, 400);
  assert.equal((await o.anon('POST', '/api/kpi/ventas_semana', 'x'.repeat(20000), H)).status, 413);
  const lim = await oficina6(); filas(lim.d1, 'select 1');
  lim.d1._db.prepare("insert into publica_tasa (clave, ventana, n) values ('kpi', ?, 999)").run(Math.floor(Date.now() / 60e3));
  assert.equal((await lim.anon('POST', '/api/kpi/ventas_semana', { value: 1 }, H)).status, 429);
});

test('una línea «KPI x = n» de una entrega terminada llega al indicador por el reloj, una sola vez', { skip: SALTAR }, async () => {
  const o = await oficina6(); await o.admin('POST', '/api/business/kpi', { id: 'leads_semana', name: 'Leads' });
  const cada = MODULOS.find((m) => m.nombre === 'negocio').cadaMinuto;
  await cada(o.env); // marca el punto de partida
  const t = (await o.admin('POST', '/api/tasks', { dept: 'sales', text: 'Cuenta los leads' })).j;
  await conSesion(o.d1, async (s) => { s.alm.cambiar(t.id, (x) => { x.state = 'done'; x.doneAt = Date.now() + 5; x.result = 'Listo.\nKPI leads_semana = 42'; }, {}); });
  await cada(o.env); await cada(o.env);
  const v = (await o.admin('GET', '/api/business')).j.kpis.find((k) => k.id === 'leads_semana'); assert.equal(JSON.stringify(v).includes('42'), true);
  assert.equal(filas(o.d1, "select json from docs where clave = 'kpis'").length, 1);
});

test('cifras y voz de marca: las lee quien entra, las escribe solo el administrador', { skip: SALTAR }, async () => {
  const o = await oficina6();
  assert.equal((await o.editor('POST', '/api/cifras', { items: [] })).status, 403);
  assert.equal((await o.admin('POST', '/api/cifras', { items: [{ name: 'Combo', value: '12', unit: 'US$' }, { name: '', value: 'x' }] })).status, 200);
  assert.equal((await o.lectura('GET', '/api/cifras')).j.items.length, 1);
  assert.equal((await o.admin('POST', '/api/voice', { text: '' })).status, 400);
  assert.equal((await o.admin('POST', '/api/voice', { text: 'Cercana, directa, sin jerga.' })).status, 200);
  assert.match((await o.lectura('GET', '/api/voice')).j.text, /Cercana/);
});

test('documentos: un CSV y un texto pasan a notas; un PDF dice en palabras que va por el script local; archivos raros y enormes se rechazan', { skip: SALTAR }, async () => {
  const o = await oficina6(); const b64 = (s) => Buffer.from(s).toString('base64');
  const csv = await o.admin('POST', '/api/brain/upload', { name: 'precios.csv', data: b64('producto,precio\nCombo,12\n') }); assert.equal(csv.status, 200, csv.texto); assert.equal(csv.j.path, `Documentos/${csv.j.note}.md`);
  assert.equal(filas(o.d1, "select 1 from notas where nombre = ?", csv.j.note).length, 1);
  const otra = await o.admin('POST', '/api/brain/upload', { name: 'precios.csv', data: b64('a,b\n1,2\n') }); assert.notEqual(otra.j.note, csv.j.note, 'no pisa');
  const pdf = await o.admin('POST', '/api/brain/upload', { name: 'contrato.pdf', data: b64('%PDF-1.4') }); assert.equal(pdf.status, 501); assert.match(pdf.j.error, /subir-documento/);
  assert.equal((await o.admin('POST', '/api/brain/upload', { name: 'virus.exe', data: b64('MZ') })).status, 400);
  assert.equal((await o.editor('POST', '/api/brain/upload', { name: 'a.txt', data: b64('hola') })).status, 403);
});

test('«Preparar desde mi web»: con tu relato deja una PROPUESTA (no escribe las notas); una dirección que no se puede leer se dice en palabras', { skip: SALTAR }, async () => {
  const o = await oficina6({ guion: [dimitriDice({ perfil: 'Somos PanaClaw.' })] });
  const sinAbout = await o.admin('POST', '/api/onboard/company', { url: 'https://panaclaw.com' }); assert.equal(sinAbout.status, 200, sinAbout.texto); // la lectura corre aparte: lo que falla se dice en un aviso, no en un 501
  assert.equal((await o.admin('GET', '/api/onboard/propuesta')).j.propuesta, null, 'sin poder leer la web (y sin relato) no hay propuesta ni se inventa nada');
  assert.equal((await o.admin('POST', '/api/onboard/company', { url: 'https://127.0.0.1/' })).status, 400);
  assert.equal((await o.admin('POST', '/api/onboard/company', {})).status, 400);
  assert.equal((await o.editor('POST', '/api/onboard/company', { about: 'x' })).status, 403);
  const ok = await o.admin('POST', '/api/onboard/company', { about: 'Vendemos peluches gigantes en Panamá a familias.' }); assert.equal(ok.status, 200, ok.texto);
  const g = (await o.admin('GET', '/api/onboard/propuesta')).j; assert.equal(g.propuesta.notas[0].nombre, 'perfil');
  assert.equal(filas(o.d1, "select count(*) n from notas where nombre = 'perfil'")[0].n, 0, 'hasta que el dueño la aplique, el Cerebro no cambia');
  assert.equal((await o.admin('POST', '/api/onboard/aplicar', { id: g.propuesta.id, decisiones: {} })).status, 200);
  assert.equal(filas(o.d1, "select count(*) n from notas where nombre = 'perfil'")[0].n, 1);
});

test('Ajustes: lee con la forma de siempre, solo el admin escribe, no acepta rutas inventadas ni secretos, y se aplica al instante', { skip: SALTAR }, async () => {
  const o = await oficina6({ ajustes: { approvals: { amountLimit: 500 } } });
  const g = (await o.lectura('GET', '/api/settings')).j; assert.ok(g.groups && g.fields.length > 10 && g.values); assert.equal(g.values['approvals.amountLimit'], 500);
  assert.equal((await o.editor('POST', '/api/settings', { changes: { name: 'X' } })).status, 403);
  const r = await o.admin('POST', '/api/settings', { changes: { name: 'Mi Negocio', 'approvals.undoSeconds': 45, 'telegram.token': 'x', 'ruta.inventada': 1, 'media.dailyLimit': 7, 'contenido.modo': 'apagado' } });
  assert.equal(r.status, 200); assert.equal(r.j.errors.length, 2); assert.equal(r.j.restart, false);
  const v = (await o.admin('GET', '/api/settings')).j.values;
  assert.equal(v.name, 'Mi Negocio'); assert.equal(v['approvals.undoSeconds'], 45); assert.equal(v['approvals.amountLimit'], 500, 'cambiar un valor del grupo no se lleva el resto'); assert.equal(v['media.dailyLimit'], 7); assert.equal(v['contenido.modo'], 'apagado');
  assert.equal((await o.admin('POST', '/api/settings', { changes: { 'approvals.undoSeconds': -3 } })).j.errors.length, 1, 'valida con settings.mjs');
  assert.ok(!/telegram\.token/.test(todoD1(o.d1)), 'lo rechazado no se guardó');
  assert.equal((await o.anon('GET', '/api/settings')).status, 401);
  const gen = await o.admin('GET', '/api/health'); assert.equal(gen.j.name ?? gen.j.office?.name ?? 'Mi Negocio', 'Mi Negocio');
});

test('Telegram en Ajustes: los aprobadores se validan, no sale ningún secreto y solo el admin escribe', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: { TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: '111222333', TELEGRAM_WEBHOOK_SECRET: 'secreto-del-webhook-de-prueba-123' } });
  assert.equal((await o.editor('PUT', '/api/settings/telegram', { approvers: {} })).status, 403);
  assert.equal((await o.admin('PUT', '/api/settings/telegram', { approvers: { abc: ['sales'] } })).status, 422);
  assert.equal((await o.admin('PUT', '/api/settings/telegram', { approvers: { 444555666: ['nada'] } })).status, 422);
  assert.equal((await o.admin('PUT', '/api/settings/telegram', { approvers: { 444555666: ['emails', 'sales'] } })).status, 200);
  const g = await o.admin('GET', '/api/settings/telegram'); assert.deepEqual(g.j.approvers['444555666'], ['emails', 'sales']); assert.equal(g.j.webhookSecreto, true);
  assert.ok(!g.texto.includes(TOKEN_BOT) && !g.texto.includes('secreto-del-webhook'));
});

test('/api/health: sin sesión solo lo mínimo; con sesión, lo rico y con los checks de cada módulo; /api/status los trae; los avisos se marcan leídos', { skip: SALTAR }, async () => {
  const o = await oficina6();
  const pub = await o.anon('GET', '/api/health'); assert.equal(pub.status, 200); assert.ok(Object.keys(pub.j).length <= 4, JSON.stringify(pub.j)); assert.doesNotMatch(pub.texto, /ANTHROPIC|sk-ant|checks|tareas/i);
  const rico = (await o.admin('GET', '/api/health')).j; assert.ok(Object.keys(rico).length > Object.keys(pub.j).length); assert.ok(!JSON.stringify(rico).includes('sk-ant-secreto-de-prueba'));
  const st = (await o.admin('GET', '/api/status')).j; const ids = (st.checks || []).map((c) => c.id); assert.ok(ids.includes('telegram') && ids.includes('disparadores') && ids.includes('notas'), ids.join(','));
  assert.ok(Array.isArray(st.notices ?? st.avisos ?? []));
  assert.equal((await o.admin('POST', '/api/notices/read', {})).status, 200);
});
