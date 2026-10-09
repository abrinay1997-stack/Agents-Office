// Plan T0 (6 oct 2026) contra el serve.mjs de verdad (una carpeta desechable; Claude, un doble local de la API de Mensajes):
// lo que el dueño hace MIENTRAS un agente trabaja (un comentario, la prioridad, una etiqueta) ya no se pierde cuando el agente
// termina; cada paso queda en la bitácora con quién; una tarea nace con los campos de T1 por POST /api/tasks; y la cola respeta
// la prioridad y los bloqueos.
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
const espera = ms => new Promise(r => setTimeout(r, ms));

async function office(t, { lento = 0 } = {}) {
  const claude = http.createServer((rq, rs) => {
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', async () => {
      const body = JSON.parse(b || '{}'); const sys = typeof body.system === 'string' ? body.system : JSON.stringify(body.system || '');
      const router = /You are the router for/.test(sys);
      const text = router ? JSON.stringify({ agent: '', title: 'Tarea de prueba', plan: ['Leer', 'Escribir'], eta: 10, why: 'prueba', needsOk: false }) : 'ENTREGA LISTA\nFuentes: —';
      if (!router && lento) await espera(lento);
      rs.writeHead(200, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
    });
  });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tareas-run-')), brain = path.join(dir, 'brain');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nDirecta.\n');
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'),
    ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), // secrets-ok
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '', METRICOOL_USER_TOKEN: '', METRICOOL_USER_ID: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await espera(250); }
  const call = async (p, b, method = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, j: await r.json() }; };
  const tarea = async id => (await call('/api/tasks')).j.find(x => x.id === id);
  const hasta = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await espera(150); } throw new Error('no llegó: ' + log.split('\n').slice(-6).join(' | ')); };
  return { call, tarea, hasta, log: () => log };
}

test('server: un comentario, la prioridad y una etiqueta puestos mientras el agente trabaja siguen ahí cuando termina; la bitácora dice quién', { timeout: 60000 }, async t => {
  const o = await office(t, { lento: 2500 });
  const et = (await o.call('/api/tareas/etiquetas', { nombre: 'urgente-cliente' })).j.etiqueta;
  const pr = (await o.call('/api/tareas/proyectos', { nombre: 'Lanzamiento' })).j.proyecto;
  const c = await o.call('/api/tasks', { dept: 'sales', text: 'Escribe la propuesta para Acme', limite: '2026-12-01', proyecto: pr.id });
  assert.equal(c.status, 200, JSON.stringify(c.j)); assert.equal(c.j.limite, '2026-12-01'); assert.equal(c.j.proyecto, pr.id); assert.equal(c.j.v, 2);
  assert.deepEqual(c.j.pasos.map(p => p.texto), ['Leer', 'Escribir'], 'el plan del enrutador llega como pasos');
  const id = c.j.id;
  await o.hasta(async () => (await o.tarea(id))?.state === 'doing');
  assert.equal((await o.tarea(id)).tomadaPor?.startsWith('agente:'), true, 'tomada por su agente');
  await o.call(`/api/tasks/${id}/comment`, { text: 'Ojo: el precio subió' });
  const org = await o.call(`/api/tareas/${id}/organizar`, { prioridad: 'alta', etiquetas: [et.id] }); assert.equal(org.status, 200, JSON.stringify(org.j));
  const fin = await o.hasta(async () => { const x = await o.tarea(id); return x?.state === 'done' ? x : null; });
  assert.match(fin.result, /ENTREGA LISTA/);
  assert.equal(fin.comments?.length, 1, 'el comentario no se perdió'); assert.equal(fin.prioridad, 'alta'); assert.deepEqual(fin.etiquetas, [et.id]);
  assert.ok(!fin.tomadaPor, 'al terminar se suelta');
  const bit = (await o.call(`/api/tareas/${id}/bitacora`)).j.lineas.map(x => `${x.tipo}${x.campo ? ':' + x.campo : ''}${x.a ? '>' + x.a : ''}@${x.por.split(':')[0]}`);
  for (const l of ['creada@dueno', 'estado>doing@oficina', 'comentario@dueno', 'campo:prioridad@dueno', 'estado>done@agente']) assert.ok(bit.includes(l), `${l} en ${bit.join(', ')}`);
  const cat = (await o.call('/api/tareas/catalogo')).j; assert.equal(cat.proyectos[0].progreso.hechas, 1);
});

test('server: la cola espera a la bloqueada y arranca la de prioridad alta primero; un círculo se rechaza al crear', { timeout: 60000 }, async t => {
  const o = await office(t, { lento: 1500 });
  const a = (await o.call('/api/tasks', { dept: 'sales', text: 'Primero las fotos' })).j;
  const b = (await o.call('/api/tasks', { dept: 'sales', text: 'Luego el post', bloqueadaPor: [a.id] })).j;
  assert.deepEqual(b.bloqueadaPor, [a.id]);
  // 8 oct 2026: con la máquina cargada, A y B podían terminar entre dos miradas (cada 150 ms) y el test fallaba aunque el orden era el
  // bueno. Lo que importa —que B no arranque antes de que A termine— lo prueba `startedAt >= doneAt` abajo, que no depende de mirar a tiempo.
  const q = await o.hasta(async () => { const l = (await o.call('/api/tasks')).j; const x = l.find(y => y.id === b.id); return x?.queue?.why === 'bloqueada' || x?.state === 'done' ? x : null; });
  assert.ok(q.state === 'done' || q.queue.why === 'bloqueada', 'mientras A trabaja, B dice que está bloqueada');
  await o.hasta(async () => (await o.tarea(b.id))?.state === 'done', 30000);
  const ta = await o.tarea(a.id), tb = await o.tarea(b.id); assert.ok(tb.startedAt >= ta.doneAt, 'empezó después de que la otra terminara');
  const det = (await o.call(`/api/tareas/${b.id}`)).j; assert.ok(det.bitacora.some(x => x.tipo === 'desbloqueada'));
  const circ = await o.call(`/api/tasks/${a.id}`, { bloqueadaPor: [b.id] }, 'PATCH'); assert.ok([400, 409].includes(circ.status));
});
