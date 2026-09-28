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
