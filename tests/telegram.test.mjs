// V4.4 — Dimitri on Telegram (telegram.mjs): who may use it, quiet hours, commands, and the approve flow end to end
// against a fake Telegram and a fake office. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as T from '../telegram.mjs';

const TOKEN = '123456789:AA' + 'x'.repeat(33); // secrets-ok (a fake token for the test)
test('only a real token and an owner id turn it on; strangers are not owners', () => {
  assert.equal(T.configured({ TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_OWNER_ID: '42' }), true);
  assert.equal(T.configured({ TELEGRAM_BOT_TOKEN: TOKEN }), false);
  assert.equal(T.configured({ TELEGRAM_BOT_TOKEN: 'nope', TELEGRAM_OWNER_ID: '42' }), false);
  assert.deepEqual(T.owners({ TELEGRAM_OWNER_ID: '42, 7;abc' }), ['42', '7']);
  assert.equal(T.allowed(42, ['42']), true);
  assert.equal(T.allowed(43, ['42']), false);
});

test('quiet hours, also across midnight', () => {
  const at = h => { const d = new Date(2026, 8, 25, h, 30); return d; };
  const q = { from: '21:00', to: '07:00' };
  assert.equal(T.isQuiet(q, at(23)), true); assert.equal(T.isQuiet(q, at(3)), true); assert.equal(T.isQuiet(q, at(12)), false);
  assert.equal(T.isQuiet({ from: '13:00', to: '14:00' }, at(13)), true);
  assert.equal(T.isQuiet(undefined, at(3)), false);
});

test('commands and tasks from the phone', () => {
  assert.deepEqual(T.parseCommand('/estado'), { cmd: 'estado', arg: '' });
  assert.deepEqual(T.parseCommand('/tarea@PanaBot ventas: llama a Sol'), { cmd: 'tarea', arg: 'ventas: llama a Sol' });
  assert.equal(T.parseCommand('¿cómo vamos con las ventas?').cmd, 'dimitri');
  assert.deepEqual(T.parseTask('Finanzas: lista las facturas vencidas'), { dept: 'fin', text: 'lista las facturas vencidas' });
  assert.equal(T.parseTask('algo sin departamento'), null);
  assert.equal(T.chunks('a'.repeat(9000)).length, 3);
  assert.match(T.approvalText({ title: '<b>x</b>', draft: 'hola & adiós' }, 'SOL', 'Ventas'), /&lt;b&gt;x&lt;\/b&gt;[\s\S]*hola &amp; adiós/);
});

test('end to end: an approval reaches the owner with buttons, ✅ approves in the office, a stranger is refused', async () => {
  const calls = { tg: [], office: [] };
  let updates = [];
  const tgSrv = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const m = req.url.split('/').pop(), body = JSON.parse(b || '{}'); calls.tg.push({ m, body });
    const result = m === 'getUpdates' ? updates.splice(0) : m === 'sendMessage' ? { message_id: 1 } : true;
    if (m === 'getUpdates' && !result.length) return setTimeout(() => { res.end(JSON.stringify({ ok: true, result: [] })); }, 30);
    res.end(JSON.stringify({ ok: true, result }));
  }); });
  const office = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { calls.office.push({ method: req.method, url: req.url, body: b }); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true })); }); });
  await new Promise(r => tgSrv.listen(0, '127.0.0.1', r)); await new Promise(r => office.listen(0, '127.0.0.1', r));
  const keep = { ...process.env };
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_OWNER_ID: '42', TELEGRAM_API_BASE: `http://127.0.0.1:${tgSrv.address().port}`, TELEGRAM_RETRY_MS: '50' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tg-'));
  let onTask = null;
  const bot = T.start({ port: office.address().port, cfg: { name: 'PanaClaw' }, dataDir: dir, onTask: f => { onTask = f; }, onNotice: () => {}, log: { warn() {} } });
  try {
    onTask({ id: 'tk1', state: 'waiting', title: 'Responder a Sol', draft: 'Para: sol@cliente.com', agentName: 'SOL', deptName: 'Ventas' });
    const until = async (ok, ms = 5000) => { for (const end = Date.now() + ms; !ok() && Date.now() < end;) await new Promise(r => setTimeout(r, 20)); }; // waits for what it checks, not a fixed time (a busy machine made 150 ms too short)
    const findSent = () => calls.tg.find(c => c.m === 'sendMessage' && /Espera tu visto bueno/.test(c.body.text));
    await until(findSent); const sent = findSent();
    assert.ok(sent, 'approval message sent'); assert.equal(sent.body.chat_id, '42');
    assert.equal(sent.body.reply_markup.inline_keyboard[0][0].callback_data, 'ap:tk1');
    updates.push({ update_id: 1, callback_query: { id: 'q1', from: { id: 42 }, data: 'ap:tk1', message: { message_id: 5, chat: { id: 42 } } } });
    updates.push({ update_id: 2, message: { from: { id: 99 }, chat: { id: 99 }, text: '/pendientes' } });
    await until(() => calls.office.some(c => c.method === 'POST' && c.url === '/api/tasks/tk1/approve') && calls.tg.some(c => c.m === 'sendMessage' && c.body.chat_id === 99));
    assert.ok(calls.office.some(c => c.method === 'POST' && c.url === '/api/tasks/tk1/approve'), 'the office was asked to approve');
    assert.ok(!calls.office.some(c => c.url === '/api/tasks' && c.method === 'GET'), 'the stranger got nothing from the office');
    assert.ok(calls.tg.some(c => c.m === 'sendMessage' && c.body.chat_id === 99 && /privado/.test(c.body.text)), 'the stranger is told it is private');
  } finally {
    bot.stop(); for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_OWNER_ID', 'TELEGRAM_API_BASE', 'TELEGRAM_RETRY_MS']) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; }
    tgSrv.closeAllConnections?.(); office.closeAllConnections?.(); tgSrv.close(); office.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('plan D: /yo te deja una tarea (con la fecha en palabras), /mias trae lo tuyo de hoy y ✅ la marca hecha', async () => {
  const calls = { tg: [], office: [] };
  let updates = [];
  const tgSrv = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const m = req.url.split('/').pop(), body = JSON.parse(b || '{}'); calls.tg.push({ m, body });
    const result = m === 'getUpdates' ? updates.splice(0) : m === 'sendMessage' ? { message_id: 1 } : true;
    if (m === 'getUpdates' && !result.length) return setTimeout(() => { res.end(JSON.stringify({ ok: true, result: [] })); }, 30);
    res.end(JSON.stringify({ ok: true, result }));
  }); });
  const office = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    calls.office.push({ method: req.method, url: req.url, body: b, by: req.headers['x-office-by'] }); res.setHeader('content-type', 'application/json');
    if (req.url === '/api/tareas/mias' && req.method === 'POST') { const j = JSON.parse(b); return res.end(JSON.stringify({ ok: true, tarea: { id: 'm2', title: j.title, limite: j.limite || null } })); }
    if (req.url === '/api/tareas/mias') return res.end(JSON.stringify({ cuentas: { bandeja: 3 }, listas: { hoy: { pendientes: [{ id: 'm1', title: 'Llamar al banco', limite: '2026-10-07T10:30', prioridad: 'alta', empezada: 1 }] } } }));
    res.end(JSON.stringify({ ok: true }));
  }); });
  await new Promise(r => tgSrv.listen(0, '127.0.0.1', r)); await new Promise(r => office.listen(0, '127.0.0.1', r));
  const keep = { ...process.env };
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_OWNER_ID: '42', TELEGRAM_API_BASE: `http://127.0.0.1:${tgSrv.address().port}`, TELEGRAM_RETRY_MS: '50' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tg-'));
  const bot = T.start({ port: office.address().port, cfg: { name: 'PanaClaw' }, dataDir: dir, onTask: () => {}, onNotice: () => {}, log: { warn() {} } });
  const until = async (ok, ms = 5000) => { for (const end = Date.now() + ms; !ok() && Date.now() < end;) await new Promise(r => setTimeout(r, 20)); };
  try {
    assert.deepEqual(T.parseCommand('/yo llamar al banco'), { cmd: 'yo', arg: 'llamar al banco' }); assert.equal(T.parseCommand('/mias').cmd, 'mias'); assert.equal(T.parseCommand('/hoy').cmd, 'mias');
    updates.push({ update_id: 1, message: { from: { id: 42 }, chat: { id: 42 }, text: '/yo urgente: firmar el contrato para mañana' } });
    await until(() => calls.tg.some(c => c.m === 'sendMessage' && /Para ti/.test(c.body.text)));
    const alta = calls.office.find(c => c.method === 'POST' && c.url === '/api/tareas/mias'); const j = JSON.parse(alta.body);
    assert.equal(j.prioridad, 'alta'); assert.match(j.limite, /^\d{4}-\d{2}-\d{2}$/); assert.match(j.title, /^Firmar el contrato$/i); assert.equal(alta.by, undefined, 'el dueño, como en la página');
    updates.push({ update_id: 2, message: { from: { id: 42 }, chat: { id: 42 }, text: '/mias' } });
    await until(() => calls.tg.some(c => c.m === 'sendMessage' && /Llamar al banco/.test(c.body.text)));
    const fila = calls.tg.find(c => c.m === 'sendMessage' && /Llamar al banco/.test(c.body.text));
    assert.match(fila.body.text, /▶ <b>Llamar al banco<\/b> · 2026-10-07 10:30 · prioridad alta/); assert.equal(fila.body.reply_markup.inline_keyboard[0][0].callback_data, 'mh:m1');
    assert.ok(calls.tg.some(c => c.m === 'sendMessage' && /Lo tuyo hoy<\/b> \(1\) · 3 en tu bandeja/.test(c.body.text)));
    updates.push({ update_id: 3, callback_query: { id: 'q9', from: { id: 42 }, data: 'mh:m1', message: { message_id: 7, chat: { id: 42 } } } });
    await until(() => calls.office.some(c => c.url === '/api/tareas/m1/estado'));
    const est = calls.office.find(c => c.url === '/api/tareas/m1/estado'); assert.deepEqual(JSON.parse(est.body), { a: 'done' });
  } finally {
    bot.stop(); for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_OWNER_ID', 'TELEGRAM_API_BASE', 'TELEGRAM_RETRY_MS']) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; }
    tgSrv.closeAllConnections?.(); office.closeAllConnections?.(); tgSrv.close(); office.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Anuncios A2: /anuncios trae lo activo con ⏸ Pausar (un toque) y lo pausado con ✅ Activar, que pide la cifra y un SEGUNDO toque; un aprobador no toca nada', async () => {
  const calls = { tg: [], office: [] };
  let updates = [];
  const tgSrv = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const m = req.url.split('/').pop(), body = JSON.parse(b || '{}'); calls.tg.push({ m, body });
    const result = m === 'getUpdates' ? updates.splice(0) : m === 'sendMessage' ? { message_id: 1 } : true;
    if (m === 'getUpdates' && !result.length) return setTimeout(() => { res.end(JSON.stringify({ ok: true, result: [] })); }, 30);
    res.end(JSON.stringify({ ok: true, result }));
  }); });
  const office = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const j = b ? JSON.parse(b) : {}; calls.office.push({ method: req.method, url: req.url, body: j }); res.setHeader('content-type', 'application/json');
    if (req.url === '/api/anuncios?rango=hoy') return res.end(JSON.stringify({ cuenta: { id: 'act_1' }, topes: { diario: 20, mensual: 300 }, gasto: { hoy: 4.8, mes: 40 }, avisos: [], campanas: [
      { id: 'C1', nombre: 'Mensajes', estado: 'ACTIVE', estadoTexto: 'Activa', presupuesto: { tipo: 'diario', usd: 10 }, cifras: { gasto: 4.8, resultados: 3, resultadoTexto: 'conversaciones iniciadas' } },
      { id: 'C2', nombre: 'Combo', estado: 'PAUSED', estadoTexto: 'En pausa', presupuesto: { tipo: 'diario', usd: 15 }, cifras: { gasto: 0 } }] }));
    if (req.url === '/api/anuncios/accion' && j.tipo === 'pausar') return res.end(JSON.stringify({ ok: true, hecho: { texto: 'En pausa: «Mensajes» (campaña). Deja de gastar.' }, deshacer: { token: 'dz1', hasta: new Date(Date.now() + 30e3).toISOString() } }));
    if (req.url === '/api/anuncios/accion' && j.tipo === 'activar' && !j.confirmacion) return res.end(JSON.stringify({ confirmar: { token: 'cf1', texto: 'Activar «Combo» — gasta hasta US$15 al día, US$105 esta semana', tipo: 'activar', id: 'C2', vence: new Date(Date.now() + 120e3).toISOString() } }));
    // A5: la sugerencia de escalar (dos toques) y el ↶ del piloto (reanudar: dos toques)
    if (req.url === '/api/anuncios/sugerencias/escalar-S1/aplicar') return res.end(JSON.stringify({ confirmar: { token: 'cf2', texto: 'Subir el presupuesto de «PA» de US$10 a US$12 al día — gasta hasta US$12 al día', tipo: 'subir_presupuesto', id: 'S1', valor: 12, vence: new Date(Date.now() + 120e3).toISOString() }, sugerencia: 'escalar-S1' }));
    if (req.url === '/api/anuncios/sugerencias/escalar-S1/descartar') return res.end(JSON.stringify({ ok: true }));
    if (req.url === '/api/anuncios/accion' && j.tipo === 'reanudar' && !j.confirmacion) return res.end(JSON.stringify({ confirmar: { token: 'cf3', texto: 'Reanudar «Promesa» — gasta hasta US$5 al día', tipo: 'reanudar', id: 'A9', vence: new Date(Date.now() + 120e3).toISOString() } }));
    if (req.url === '/api/anuncios/accion' && j.confirmacion === 'cf2') return res.end(JSON.stringify({ ok: true, hecho: { texto: 'Presupuesto de «PA» (conjunto): de US$10 a US$12 al día.' } }));
    if (req.url === '/api/anuncios/accion' && j.confirmacion) return res.end(JSON.stringify({ ok: true, hecho: { texto: 'Activado: «Combo» (campaña). Gasta hasta US$15 al día.' } }));
    res.end(JSON.stringify({ ok: true }));
  }); });
  await new Promise(r => tgSrv.listen(0, '127.0.0.1', r)); await new Promise(r => office.listen(0, '127.0.0.1', r));
  const keep = { ...process.env };
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_OWNER_ID: '42', TELEGRAM_API_BASE: `http://127.0.0.1:${tgSrv.address().port}`, TELEGRAM_RETRY_MS: '50' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tg-'));
  let onNotice = null;
  const bot = T.start({ port: office.address().port, cfg: { name: 'PanaClaw', telegram: { approvers: { 7: ['marketing'] } } }, dataDir: dir, onTask: () => {}, onNotice: f => { onNotice = f; }, log: { warn() {} } });
  const until = async (ok, ms = 5000) => { for (const end = Date.now() + ms; !ok() && Date.now() < end;) await new Promise(r => setTimeout(r, 20)); };
  const sent = re => calls.tg.find(c => c.m === 'sendMessage' && re.test(c.body.text));
  const acciones = () => calls.office.filter(c => c.url === '/api/anuncios/accion');
  try {
    assert.equal(T.parseCommand('/anuncios').cmd, 'anuncios'); assert.equal(T.parseCommand('/publicidad').cmd, 'anuncios');
    updates.push({ update_id: 1, message: { from: { id: 42 }, chat: { id: 42 }, text: '/anuncios' } });
    await until(() => sent(/Combo/));
    assert.match(sent(/Anuncios<\/b>/).body.text, /hoy US\$4\.80 de un tope de US\$20/);
    assert.deepEqual(sent(/Mensajes/).body.reply_markup.inline_keyboard[0][0], { text: '⏸ Pausar', callback_data: 'xp:C1' });
    assert.deepEqual(sent(/Combo/).body.reply_markup.inline_keyboard[0][0], { text: '✅ Activar — gasta hasta US$15/día', callback_data: 'xa:C2' });
    // un aprobador delegado no puede pausar ni activar
    updates.push({ update_id: 2, callback_query: { id: 'q0', from: { id: 7 }, data: 'xp:C1', message: { message_id: 3, chat: { id: 7 } } } });
    await until(() => calls.tg.some(c => c.m === 'answerCallbackQuery' && c.body.callback_query_id === 'q0'));
    assert.equal(acciones().length, 0, 'el aprobador no llegó a la oficina');
    // ⏸ Pausar: un toque, con ↶ Deshacer
    updates.push({ update_id: 3, callback_query: { id: 'q1', from: { id: 42 }, data: 'xp:C1', message: { message_id: 4, chat: { id: 42 } } } });
    await until(() => sent(/⏸ En pausa/));
    assert.deepEqual(acciones()[0].body, { tipo: 'pausar', id: 'C1', por: 'dueno' });
    assert.equal(sent(/⏸ En pausa/).body.reply_markup.inline_keyboard[0][0].callback_data, 'xu:dz1');
    // ✅ Activar: el primer toque pide la cifra al servidor (no cambia nada) y manda «Sí, activar»; el segundo, con el token del servidor
    updates.push({ update_id: 4, callback_query: { id: 'q2', from: { id: 42 }, data: 'xa:C2', message: { message_id: 5, chat: { id: 42 } } } });
    await until(() => sent(/💸/));
    assert.deepEqual(acciones()[1].body, { tipo: 'activar', id: 'C2', por: 'dueno' }, 'sin confirmación');
    const card = sent(/💸/); assert.match(card.body.text, /Activar «Combo» — gasta hasta US\$15 al día, US\$105 esta semana/);
    assert.deepEqual(card.body.reply_markup.inline_keyboard[0][0], { text: '✅ Sí, activar', callback_data: 'xc:cf1' });
    updates.push({ update_id: 5, callback_query: { id: 'q3', from: { id: 42 }, data: 'xc:cf1', message: { message_id: 6, chat: { id: 42 } } } });
    await until(() => sent(/✅ Activado/));
    assert.deepEqual(acciones()[2].body, { tipo: 'activar', id: 'C2', confirmacion: 'cf1', por: 'dueno' });
    updates.push({ update_id: 6, callback_query: { id: 'q4', from: { id: 42 }, data: 'xc:cf1', message: { message_id: 6, chat: { id: 42 } } } });
    await until(() => sent(/ya no sirve/));
    assert.equal(acciones().length, 3, 'el mismo toque dos veces no vuelve a pedir nada');
    // el aviso de un anuncio rechazado trae ⏸ Pausar
    onNotice({ kind: 'anuncios', level: 'warn', text: 'Meta rechazó el anuncio «Promesa» (id A9)', key: 'anuncios-rechazado:A9' });
    await until(() => sent(/rechazó el anuncio/));
    assert.equal(sent(/rechazó el anuncio/).body.reply_markup.inline_keyboard[0][0].callback_data, 'xp:A9');
    assert.deepEqual(T.pausaDeAviso({ key: 'anuncios-tope:2026-10-09' }), {}, 'el aviso del tope no trae botón');
    // A5: la sugerencia de escalar del día — «✅ Subir 20 % — hasta US$12/día» pide la cifra (nada cambia) y el segundo toque la confirma
    onNotice({ kind: 'anuncios', level: 'info', text: '📈 «PA» rinde bien', key: 'anuncios-escalar:escalar-S1@12' });
    await until(() => sent(/rinde bien/));
    assert.deepEqual(sent(/rinde bien/).body.reply_markup.inline_keyboard[0], [{ text: '✅ Subir 20 % — hasta US$12/día', callback_data: 'sx:escalar-S1' }, { text: 'Descartar', callback_data: 'sq:escalar-S1' }]);
    const n0 = acciones().length;
    updates.push({ update_id: 7, callback_query: { id: 'q5', from: { id: 42 }, data: 'sx:escalar-S1', message: { message_id: 7, chat: { id: 42 } } } });
    await until(() => sent(/Subir el presupuesto de «PA»/));
    assert.ok(calls.office.some(c => c.url === '/api/anuncios/sugerencias/escalar-S1/aplicar' && c.body.por === 'dueno'));
    assert.equal(acciones().length, n0, 'el primer toque no cambia nada: solo trae la cifra');
    assert.deepEqual(sent(/Subir el presupuesto de «PA»/).body.reply_markup.inline_keyboard[0][0], { text: '✅ Sí, subir', callback_data: 'xc:cf2' });
    updates.push({ update_id: 8, callback_query: { id: 'q6', from: { id: 42 }, data: 'xc:cf2', message: { message_id: 8, chat: { id: 42 } } } });
    await until(() => sent(/✅ Presupuesto de «PA»/));
    assert.deepEqual(acciones().at(-1).body, { tipo: 'subir_presupuesto', id: 'S1', valor: 12, sugerencia: 'escalar-S1', confirmacion: 'cf2', por: 'dueno' });
    updates.push({ update_id: 9, callback_query: { id: 'q7', from: { id: 42 }, data: 'sq:escalar-S1', message: { message_id: 9, chat: { id: 42 } } } });
    await until(() => sent(/descartada/));
    assert.ok(calls.office.some(c => c.url === '/api/anuncios/sugerencias/escalar-S1/descartar'));
    // A5: lo que pausó el piloto trae «↶ Deshacer», que reanuda con dos toques (reanudar vuelve a gastar)
    onNotice({ kind: 'anuncios', level: 'warn', text: '🤖 Piloto automático: pausé «Promesa» (id A9).', key: 'anuncios-piloto:A9' });
    await until(() => sent(/Piloto automático/));
    assert.deepEqual(sent(/Piloto automático/).body.reply_markup.inline_keyboard[0][0], { text: '↶ Deshacer (vuelve a gastar)', callback_data: 'xr:A9' });
    updates.push({ update_id: 10, callback_query: { id: 'q8', from: { id: 42 }, data: 'xr:A9', message: { message_id: 10, chat: { id: 42 } } } });
    await until(() => sent(/Reanudar «Promesa»/));
    assert.deepEqual(acciones().at(-1).body, { tipo: 'reanudar', id: 'A9', por: 'dueno' }, 'el primer toque solo pide la cifra');
    assert.deepEqual(sent(/Reanudar «Promesa»/).body.reply_markup.inline_keyboard[0][0], { text: '✅ Sí, reanudar', callback_data: 'xc:cf3' });
    assert.deepEqual(T.botonesAnuncio({ key: 'anuncios-otra:x' }), {});
  } finally {
    bot.stop(); for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_OWNER_ID', 'TELEGRAM_API_BASE', 'TELEGRAM_RETRY_MS']) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; }
    tgSrv.closeAllConnections?.(); office.closeAllConnections?.(); tgSrv.close(); office.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});
