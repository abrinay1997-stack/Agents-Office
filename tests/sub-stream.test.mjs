// Auditoría 1 oct 2026 — Dimitri's answer while it is written, «Detener» (DIM-14), and «¿Cómo vamos?» at once (DIM-10).
// Pure first (src/sub-stream.js, sub.quickStatus), then the real serve.mjs in a throwaway folder whose Claude is a local stand-in of the
// Messages API that streams in slow chunks (SSE, as the SDK reads it with stream: true).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as sub from '../sub.mjs';
import { replyFromPartial, topStrings, cliDelta, isQuickStatus } from '../src/sub-stream.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('pure: the «reply» of a JSON answer cut anywhere, escapes decoded, never a nested one', () => {
  const full = JSON.stringify({ mode: 'plan', reply: 'Hola, «dueño».\nLínea 2 con "comillas" y \\ barra — ñ 😀', tasks: [{ reply: 'NO', title: 'x' }] });
  let prev = ''; const FINAL = JSON.parse(full).reply;
  for (let i = 0; i <= full.length; i++) { // every prefix: the text only grows, and never shows half an escape
    const r = replyFromPartial(full.slice(0, i));
    assert.ok(FINAL.startsWith(r.reply), `prefix ${i}: «${r.reply}» is not the start of the reply (half an escape?)`);
    assert.ok(r.reply.length >= prev.length - 1, `prefix ${i}: it went back`);
    if (r.reply) prev = r.reply;
  }
  assert.equal(replyFromPartial(full).reply, 'Hola, «dueño».\nLínea 2 con "comillas" y \\ barra — ñ 😀');
  assert.equal(replyFromPartial(full).mode, 'plan');
  assert.equal(replyFromPartial('{"mode":"charla","reply":"Te dig').reply, 'Te dig');
  assert.equal(replyFromPartial('{"mode":"charla","reply":"a\\u00f').reply, 'a', 'a \\u cut waits for its four digits');
  assert.equal(replyFromPartial('{"mode":"charla","reply":"a\\u00f1o"}').reply, 'año');
  assert.equal(replyFromPartial('```json\n{"reply":"con valla"').reply, 'con valla');
  assert.equal(replyFromPartial('{"creatives":[{"prompt":"say \\"reply\\": \\"x\\""}],"reply":"bien"}').reply, 'bien', 'a "reply" inside a prompt is not the reply');
  assert.equal(replyFromPartial('{"n":3,"ok":true,"reply":"tras números"}').reply, 'tras números');
  assert.equal(replyFromPartial('{"mode":"pla').mode, null, 'a mode still being written is not shown');
  assert.deepEqual(replyFromPartial('Hola, esto no es JSON y es largo'), { reply: 'Hola, esto no es JSON y es largo', mode: null, plain: true });
  assert.equal(replyFromPartial('').reply, '');
  assert.equal(replyFromPartial('{').reply, '');
  assert.deepEqual(topStrings('{"a":"1","b":{"c":"no"},"d":"2'), { a: '1', d: '2' });
});

test('pure: the CLI deltas, and which messages are «¿Cómo vamos?»', () => {
  assert.equal(cliDelta({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '{"re' } } }), '{"re');
  assert.equal(cliDelta({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{' } } }), null);
  assert.equal(cliDelta({ type: 'assistant', message: { content: [{ type: 'text', text: 'x' }] } }), null);
  assert.equal(cliDelta(null), null);
  for (const t of ['¿Cómo vamos?', '¿Cómo vamos? Dame el estado de la oficina.', 'como vamos', 'Y ¿cómo vamos hoy?', '¿Cómo va la oficina?', 'Dame el estado', '¿Qué tal vamos?', 'Resumen de hoy'])
    assert.ok(isQuickStatus(t), t);
  for (const t of ['¿Cómo vamos con Ventas?', '¿Cómo vamos? Y prepara la campaña del viernes', 'Analiza este estado de la oficina: qué te preocupa', '¿Qué falló hoy y qué hago con eso?', ''])
    assert.ok(!isQuickStatus(t), t);
});

test('pure: quickStatus — what runs, waits, failed today, is due later today, Contenido for 7 days, the spend', () => {
  const now = new Date(2026, 9, 1, 10, 30).getTime(), today = d => new Date(2026, 9, 1, d, 0).getTime();
  const tasks = [
    { id: 'a', state: 'doing', title: 'Conciliar septiembre', agent: 'invo' },
    { id: 'b', state: 'next', title: 'En cola', agent: 'invo' },
    { id: 'c', state: 'waiting', title: 'Correo a Acme', agent: 'mia', waitingAt: today(9) },
    { id: 'd', state: 'done', error: true, title: 'Informe de ventas', result: 'Could not complete this task: Gmail no respondió', doneAt: today(8) },
    { id: 'e', state: 'done', error: true, title: 'Ayer', doneAt: today(8) - 864e5 },
    { id: 'f', state: 'scheduled', title: 'Llamar a Pedro', agent: 'mia', dueAt: today(15) },
    { id: 'g', state: 'scheduled', title: 'Mañana', agent: 'mia', dueAt: today(15) + 864e5 },
    { id: 'h', state: 'waiting', title: 'Archivada', archived: true },
  ];
  const md = sub.quickStatus({ tasks, agents: [{ id: 'invo', name: 'INVO' }, { id: 'mia', name: 'MIA' }], now,
    piezas: [{ id: 'p1', fecha: '2026-10-02', hora: '09:00', formato: 'reel', redes: ['instagram'], titulo: 'Combo 2x1', estado: 'revision', medios: [] }, { id: 'p2', fecha: '2026-10-20', formato: 'post', redes: ['facebook'], titulo: 'Lejos', estado: 'idea' }],
    routines: [{ id: 'r1', title: 'Facturas vencidas', agent: 'invo', nextAt: today(17) }, { id: 'r2', title: 'Pausada', paused: true, nextAt: today(16) }],
    spentToday: 0.4234, budget: { spent: 12.3, budget: 50, ratio: 0.246 }, unread: 2 });
  assert.match(md, /Trabajando:\*\* «Conciliar septiembre» \(INVO\) · 1 en cola/);
  assert.match(md, /Esperan tu OK:\*\* 1 — «Correo a Acme» \(MIA\)/);
  assert.doesNotMatch(md, /Archivada|Ayer|Lejos|Pausada|Mañana/);
  assert.match(md, /Falló hoy:\*\* 1 — «Informe de ventas»: Gmail no respondió/);
  assert.match(md, /Más tarde hoy:\*\* 15:00 «Llamar a Pedro» \(MIA\) · 17:00 «Facturas vencidas» \(rutina, INVO\)/);
  assert.match(md, /Contenido, próximos 7 días:\*\* 1 pieza — .*09:00 reel IG «Combo 2x1» \(a revisar, falta imagen o video, sin texto\) · 1 a revisar · 6 días sin publicación/);
  assert.match(md, /Gasto de hoy:\*\* US\$0\.42 en modelos · el mes: US\$12\.30 de US\$50\.00 \(25 %\)/);
  assert.match(md, /Avisos sin leer:\*\* 2/);
  const calm = sub.quickStatus({ now });
  assert.match(calm, /nadie en este momento/); assert.match(calm, /Esperan tu OK:\*\* nada/); assert.match(calm, /nada programado/); assert.doesNotMatch(calm, /Avisos|Más tarde/);
});

/* ---------- the real server; its Claude streams slowly ---------- */
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const wait = ms => new Promise(r => setTimeout(r, ms));
function sse(rs, text, { chunk = 12, every = 40, onClose } = {}) { // Anthropic's own event stream, a few characters at a time
  rs.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const ev = (type, data) => rs.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  let closed = false; rs.on('close', () => { closed = true; onClose && onClose(); });
  return (async () => {
    ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    for (let i = 0; i < text.length && !closed; i += chunk) { ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(i, i + chunk) } }); await wait(every); }
    if (closed) return;
    ev('content_block_stop', { index: 0 }); ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } }); ev('message_stop', {}); rs.end();
  })();
}
async function office(t, answers, { streamFails = false } = {}) {
  const seen = [], closed = [];
  const claude = http.createServer((rq, rs) => {
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
      const body = JSON.parse(b || '{}'); seen.push({ path: rq.url, stream: !!body.stream });
      const a = answers.length ? answers.shift() : { text: JSON.stringify({ mode: 'charla', reply: 'ok' }) };
      if (body.stream && streamFails) { answers.unshift(a); rs.writeHead(400, { 'content-type': 'application/json' }); return rs.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'streaming no disponible aquí' } })); }
      if (body.stream) return sse(rs, a.text, { ...a, onClose: () => closed.push(Date.now()) });
      rs.writeHead(200, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: a.text }], usage: { input_tokens: 10, output_tokens: 10 } }));
    });
  });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-sub-stream-')), brain = path.join(dir, 'brain');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'),
    ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); claude.closeAllConnections?.(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await wait(250); }
  const call = async (p, b, method = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, j: await r.json() }; };
  if ((await call('/api/health').catch(() => ({ status: 0 }))).status !== 200) throw new Error('the office did not start: ' + log.split('\n').slice(-5).join(' | '));
  /** POST /api/sub/chat with stream: true → every NDJSON line, as it arrives (onLine may act mid-stream). */
  const stream = async (b, onLine = () => {}) => {
    const r = await fetch(base + '/api/sub/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...b, stream: true }) });
    assert.match(r.headers.get('content-type') || '', /ndjson/);
    const lines = [], rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) { const { value, done } = await rd.read(); if (value) buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const o = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); lines.push({ ...o, t: Date.now() }); await onLine(o, lines); } if (done) break; }
    return lines;
  };
  return { call, stream, seen, closed, log: () => log };
}

test('server: the answer arrives in pieces while Claude writes, and ends validated as before', { timeout: 60000 }, async t => {
  const answer = JSON.stringify({ mode: 'charla', reply: 'Te cuento: la oficina va bien. Hoy hay **tres** tareas en marcha y ninguna falló. Mañana sale el reel del combo.' });
  const o = await office(t, [{ text: answer, chunk: 10, every: 60 }]);
  const lines = await o.stream({ text: '¿Qué opinas de abrir los domingos?' });
  assert.equal(lines[0].type, 'start'); assert.match(lines[0].run, /^r/);
  const replies = lines.filter(l => l.type === 'reply');
  assert.ok(replies.length >= 4, `several pieces, got ${replies.length}`);
  for (let k = 1; k < replies.length; k++) assert.ok(replies[k].text.startsWith(replies[k - 1].text), 'each piece adds to the last');
  assert.ok(replies.every(r => !/[{}"]/.test(r.text.replace(/\*\*/g, ''))), 'never the raw JSON');
  assert.ok(replies[replies.length - 1].t - replies[0].t > 300, 'they arrived over time, not all at the end');
  const done = lines.at(-1); assert.equal(done.type, 'done');
  assert.equal(done.messages[1].text, JSON.parse(answer).reply); assert.equal(done.messages[1].mode, 'charla');
  assert.deepEqual(o.seen.map(s => s.stream), [true], 'the SDK asked with stream: true');
  const h = await o.call('/api/sub'); assert.equal(h.j.messages.length, 2);
  const plain = await o.call('/api/sub/chat', { text: 'sin streaming' }); assert.equal(plain.status, 200); assert.equal(plain.j.messages.length, 2, 'Telegram and older pages still get one JSON');
});

test('server: «Detener» kills the run — «Detenido por ti», and nothing it proposed is kept', { timeout: 60000 }, async t => {
  const answer = JSON.stringify({ mode: 'plan', reply: 'Así lo haría: Ventas llama a los clientes de septiembre y Marketing prepara el correo de seguimiento con la oferta de la semana.', tasks: [{ dept: 'sales', title: 'Llamar a los clientes', instruction: 'Llama a todos.', why: 'ventas' }] });
  const o = await office(t, [{ text: answer, chunk: 6, every: 80 }]);
  let stoppedAt = 0;
  const lines = await o.stream({ text: 'Que Ventas llame a los clientes de septiembre' }, async (l, all) => {
    if (l.type === 'reply' && !stoppedAt && all.filter(x => x.type === 'reply').length >= 3) { stoppedAt = Date.now(); const s = await o.call('/api/sub/stop', { run: all[0].run }); assert.equal(s.status, 200); }
  });
  const done = lines.at(-1); assert.equal(done.type, 'done', JSON.stringify(done)); assert.equal(done.stopped, true);
  const m = done.messages[1]; assert.equal(m.stopped, true); assert.match(m.text, /Detenido por ti/); assert.ok(!m.plan && !m.ops && !m.studio, 'no plan, no ops, no creatives');
  assert.ok(done.t - stoppedAt < 3000, 'it stops at once, not when Claude would have finished');
  await wait(300); assert.ok(o.closed.length >= 1, 'the stream to Claude was closed (aborted)');
  const tasks = await o.call('/api/tasks'); assert.ok(!(tasks.j.tasks || tasks.j || []).some?.(x => /clientes/i.test(x.title || '')), 'no task was made');
  const again = await o.call('/api/sub/stop', { run: lines[0].run }); assert.equal(again.status, 404, 'a run that ended cannot be stopped');
  const h = await o.call('/api/sub'); assert.equal(h.j.messages.at(-1).stopped, true);
});

test('server: if streaming fails before a word, the old call answers (the fallback)', { timeout: 60000 }, async t => {
  const o = await office(t, [{ text: JSON.stringify({ mode: 'charla', reply: 'Por el camino de siempre.' }) }], { streamFails: true });
  const lines = await o.stream({ text: 'hola' });
  assert.equal(lines.at(-1).type, 'done'); assert.equal(lines.at(-1).messages[1].text, 'Por el camino de siempre.');
  assert.deepEqual(o.seen.map(s => s.stream), [true, false]);
});

test('server: «¿Cómo vamos?» comes back at once, computed, without asking Claude', { timeout: 60000 }, async t => {
  const o = await office(t, []);
  const t0 = Date.now(), r = await o.call('/api/sub/estado', { text: '¿Cómo vamos?' }), ms = Date.now() - t0;
  assert.equal(r.status, 200); assert.ok(ms < 1500, `${ms} ms`);
  const [u, m] = r.j.messages; assert.equal(u.text, '¿Cómo vamos?'); assert.equal(m.quick, true); assert.equal(m.mode, 'estado');
  assert.match(m.text, /Trabajando:/); assert.match(m.text, /Esperan tu OK:/); assert.match(m.text, /Falló hoy:/); assert.match(m.text, /Contenido, próximos 7 días:/); assert.match(m.text, /Gasto de hoy:/);
  assert.equal(o.seen.length, 0, 'no model was asked');
  assert.equal((await o.call('/api/sub')).j.messages.length, 2, 'kept in the conversation: Dimitri reads it if the owner asks him to analyse');
});
