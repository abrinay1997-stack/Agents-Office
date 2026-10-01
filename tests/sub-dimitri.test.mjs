// Dimitri V4.11 against the real serve.mjs (a throwaway folder; Claude a local stand-in of the Messages API): questions with options and
// the answer that goes back, the history that remembers them, a cut answer never shown raw, a short prompt for «¿Cómo vamos?» that still
// sees Contenido, the «ops» that wait for the owner's click and can be undone, a video attached by id, «Nueva conversación» with DESHACER.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const ROUTE = JSON.stringify({ agent: '', title: 'Tarea', plan: [], eta: 10, why: '', needsOk: true }); // the router's answer (not Dimitri's)

async function office(t, answers) {
  const seen = [];
  const claude = http.createServer((rq, rs) => {
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
      const body = JSON.parse(b || '{}'); const sys = typeof body.system === 'string' ? body.system : JSON.stringify(body.system || '');
      const dim = /mano derecha del due/.test(sys); seen.push({ dim, system: sys, body });
      const text = dim ? (answers.length ? answers.shift() : JSON.stringify({ mode: 'charla', reply: 'ok' })) : ROUTE;
      rs.writeHead(200, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
    });
  });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-sub-dimitri-')), brain = path.join(dir, 'brain');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true });
  fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana y directa.\n');
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'),
    ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const call = async (p, b, method = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, j: await r.json() }; };
  if ((await call('/api/health').catch(() => ({ status: 0 }))).status !== 200) throw new Error('the office did not start: ' + log.split('\n').slice(-5).join(' | '));
  return { call, seen, dir, log: () => log, dims: () => seen.filter(s => s.dim) };
}

test('server: a question with options → the owner picks → the answer goes back as one message and the history remembers both', { timeout: 60000 }, async t => {
  const answers = [JSON.stringify({ mode: 'pregunta', reply: 'Me faltan dos datos.\n¿Qué producto va en la campaña?', questions: [{ id: 'producto', q: '¿Qué producto va en la campaña?', options: [{ label: 'Combo 2x1 (recomendado)', value: 'Combo 2x1' }, { label: 'Peluches', value: 'Peluches' }], other: true }, { id: 'dia', q: '¿Para qué día?', options: [{ label: 'Viernes 2', value: 'viernes 2' }, { label: 'Lunes 5', value: 'lunes 5' }] }] })];
  const o = await office(t, answers);
  const a = await o.call('/api/sub/chat', { text: 'Prepara la campaña de octubre' }); assert.equal(a.status, 200, JSON.stringify(a.j));
  const q = a.j.messages[1]; assert.equal(q.mode, 'pregunta'); assert.equal(q.plan.questions.length, 2); assert.equal(q.plan.questions[0].options[0].value, 'Combo 2x1');
  assert.equal(q.text, 'Me faltan dos datos.', 'the reply does not repeat the question drawn below it');
  answers.push(JSON.stringify({ mode: 'charla', reply: 'Perfecto.' }));
  const b = await o.call('/api/sub/chat', { text: 'Producto: Combo 2x1 · Día: viernes 2', answers: { msg: q.id, picks: [{ id: 'producto', value: 'Combo 2x1' }, { id: 'dia', value: 'viernes 2' }] } });
  assert.equal(b.status, 200, JSON.stringify(b.j));
  assert.match(b.j.messages[0].text, /Combo 2x1/); assert.deepEqual(b.j.messages[0].answers.picks.map(p => p.id), ['producto', 'dia']);
  const user = o.dims().at(-1).body.messages[0].content; const text = typeof user === 'string' ? user : user.map(c => c.text || '').join('');
  assert.match(text, /\[pregunté: ¿Qué producto va en la campaña\? \(opciones: Combo 2x1 \(recomendado\) \/ Peluches\)/, 'DIM-05: the history carries the questions');
  const s = (await o.call('/api/sub')).j; assert.deepEqual(s.messages.find(x => x.id === q.id).plan.answers.map(x => x.label), ['Combo 2x1', 'Viernes 2'], 'the question keeps what was chosen (locked on the page)');
  const again = await o.call('/api/sub/chat', { text: 'otra vez', answers: { msg: q.id, picks: [{ id: 'producto', value: 'Peluches' }] } });
  assert.equal(again.j.messages[0].answers, undefined, 'a question answered once is not answered again');
});

test('server: a cut answer is mended, a broken one is asked again and never shown raw (DIM-07)', { timeout: 60000 }, async t => {
  const answers = ['{"mode":"charla","reply":"Te cuento: vamos bien en ventas y', '{"mode":"plan","rep', '{"mode":"pl'];
  const o = await office(t, answers);
  const a = await o.call('/api/sub/chat', { text: '¿Cómo vamos?' });
  assert.match(a.j.messages[1].text, /^Te cuento: vamos bien en ventas y/); assert.match(a.j.messages[1].text, /llegó cortada/); assert.equal(a.j.messages[1].cut, true);
  const n = o.dims().length;
  const b = await o.call('/api/sub/chat', { text: 'reparte esto' });
  assert.equal(o.dims().length, n + 2, 'asked once more');
  assert.match(o.dims().at(-1).body.messages[0].content, /no era un JSON válido/);
  assert.doesNotMatch(b.j.messages[1].text, /\{"mode"/); assert.equal(b.j.messages[1].retry, true); assert.match(b.j.messages[1].text, /Se me cortó/);
});

test('server: «¿Cómo vamos?» is short and sees Contenido; a reel brings the Estudio; the spend is Dimitri\'s own (DIM-04, DIM-10, DIM-21)', { timeout: 60000 }, async t => {
  const o = await office(t, []);
  const d = new Date(); d.setDate(d.getDate() + 2); const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal((await o.call('/api/contenido/piezas', { titulo: 'Combo del viernes', fecha, hora: '18:00', formato: 'reel', texto: 'Ven' })).status, 200);
  await o.call('/api/sub/chat', { text: '¿Cómo vamos?' });
  const s1 = o.dims().at(-1).system;
  assert.doesNotMatch(s1, /MODELOS DEL ESTUDIO/); assert.match(s1, /Contenido \(próximos 7 días\): 1 pieza — .*reel IG · «Combo del viernes» \(borrador, falta imagen o video\)/);
  assert.match(s1, /Analíticas: Meta no está conectada/); assert.match(s1, /Rutinas: ninguna/);
  await o.call('/api/sub/chat', { text: 'Hazme un reel para Instagram' });
  assert.match(o.dims().at(-1).system, /<estudio>\nMODELOS DEL ESTUDIO ENCENDIDOS/);
  const ledger = fs.readFileSync(path.join(o.dir, 'data', 'costs.jsonl'), 'utf8');
  assert.match(ledger, /"kind":"dimitri"/);
});

test('server: ops wait for the click — a draft piece, a routine, a task moved — and DESHACER puts them back (DIM-11)', { timeout: 60000 }, async t => {
  const answers = [];
  const o = await office(t, answers);
  const later = Date.now() + 2 * 864e5; const tk = await o.call('/api/tasks', { dept: 'marketing', text: 'Haz el post del combo', at: later }); assert.equal(tk.status, 200, JSON.stringify(tk.j));
  const d = new Date(Date.now() + 3 * 864e5), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  answers.push(JSON.stringify({ mode: 'plan', reply: 'Así lo dejo.', ops: [
    { type: 'pieza_crear', titulo: 'Combo del viernes', fecha: day, hora: '18:00', formato: 'reel', redes: ['instagram'], texto: 'Ven por tu 2x1' },
    { type: 'rutina_crear', dept: 'fin', text: 'Manda el resumen de cobros', when: { kind: 'weekly', days: [1], at: '09:00' }, needsOk: true },
    { type: 'tarea_mover', id: tk.j.id, at: `${day}T10:00` }, { type: 'aprobar', id: 'x' }] }));
  const m = (await o.call('/api/sub/chat', { text: 'deja el post del viernes, el resumen de cobros cada lunes y mueve el post' })).j.messages[1];
  assert.deepEqual(m.ops.map(x => x.type), ['pieza_crear', 'rutina_crear', 'tarea_mover']);
  assert.equal((await o.call('/api/contenido')).j.piezas.length, 0, 'nothing happens before the click');
  const r = await o.call('/api/sub/ops', { msg: m.id, items: [{ k: 0, include: true }, { k: 1, include: true }, { k: 2, include: true }] });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.deepEqual(r.j.message.ops.map(x => x.state), ['done', 'done', 'done'], JSON.stringify(r.j.message.ops));
  const pz = (await o.call('/api/contenido/piezas/' + r.j.message.ops[0].pieza)).j.pieza; assert.equal(pz.estado, 'borrador'); assert.equal(pz.origen, 'dimitri'); assert.equal(pz.fecha, day);
  const rs = (await o.call('/api/routines')).j.routines; assert.equal(rs.length, 1); assert.equal(rs[0].dept, 'fin');
  const task = (await o.call('/api/tasks')).j.find(x => x.id === tk.j.id); assert.equal(task.dueAt, new Date(`${day}T10:00`).getTime());
  for (const k of [0, 1, 2]) assert.equal((await o.call('/api/sub/ops/undo', { msg: m.id, k })).status, 200);
  assert.equal((await o.call('/api/routines')).j.routines.length, 0); assert.equal((await o.call('/api/tasks')).j.find(x => x.id === tk.j.id).dueAt, later);
  assert.equal((await o.call('/api/contenido/piezas/' + r.j.message.ops[0].pieza)).status, 404, 'the draft went to the bin');
  assert.equal((await o.call('/api/sub/ops/undo', { msg: m.id, k: 0 })).status, 409, 'once');
});

test('server: a video from the gallery can be attached (by id, no vision); «Nueva conversación» has DESHACER', { timeout: 60000 }, async t => {
  const o = await office(t, []);
  const up = await o.call('/api/media/upload', { name: 'clip.mp4', data: 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=' });
  if (up.status === 200) {
    const r = await o.call('/api/sub/chat', { text: 'anima mejor este video', attach: [up.j.item.file] });
    assert.equal(r.status, 200, JSON.stringify(r.j)); assert.match(o.dims().at(-1).system, /VIDEO O AUDIO ADJUNTO[^\n]*\n- video id: /);
  }
  const odd = await o.call('/api/sub/chat', { text: 'x', attach: ['2026-09/no-esta.png'] }); assert.equal(odd.status, 400); assert.match(odd.j.error, /ya no está en el Estudio/);
  await o.call('/api/sub/chat', { text: 'hola' });
  const c = await o.call('/api/sub/clear', {}); assert.ok(c.j.archived); assert.equal((await o.call('/api/sub')).j.messages.length, 0);
  const back = await o.call('/api/sub/restore', { id: c.j.archived }); assert.equal(back.status, 200); assert.ok(back.j.messages.some(x => x.text === 'hola'));
});
