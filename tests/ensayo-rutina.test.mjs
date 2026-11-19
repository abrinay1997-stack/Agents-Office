// VAN-05: el ensayo de una rutina. Lo puro (`ensayo-core.mjs`: qué haría hoy y lo que suele costar) y, contra el serve.mjs REAL
// (carpeta temporal, Claude de mentira), las dos puertas: GET …/ensayo no gasta ni llama a ningún modelo, y POST …/ensayo deja una
// tarea marcada que NO puede enviar, NO se puede aprobar y NO mueve el reloj de la rutina.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mediana, corridasDe, estimadoDe, horasDeHoy, vistaPrevia } from '../ensayo-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const DIA = 864e5;
const alas = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };

test('lo puro: la mediana, las horas de hoy y el estimado que nunca se inventa', () => {
  assert.equal(mediana([]), null);
  assert.equal(mediana([0.3, 0.1, 0.2]), 0.2);
  assert.equal(mediana([0.1, 0.3]), 0.2);
  assert.equal(mediana([1, 'x', null, 3]), 2, 'lo que no es un número no cuenta');

  const ahora = alas(8);
  const diaria = { id: 'r1', nextAt: alas(9), paused: false };
  assert.deepEqual(horasDeHoy(diaria, t => t + DIA, ahora), [alas(9)], 'una vez al día: solo la de hoy');
  assert.deepEqual(horasDeHoy({ ...diaria, nextAt: alas(9) }, t => t + 36e5, ahora).length, 15, 'cada hora: las que caben antes de medianoche');
  assert.deepEqual(horasDeHoy({ ...diaria, paused: true }, t => t + DIA, ahora), [], 'en pausa no haría nada');
  assert.deepEqual(horasDeHoy({ id: 'r1', nextAt: null }, t => t + DIA, ahora), [], 'sin próxima ejecución, nada');

  const tareas = [
    { id: 't1', routine: 'r1', agent: 'invo', state: 'done', createdAt: 10 },
    { id: 't2', routine: 'r1', agent: 'invo', state: 'done', createdAt: 20 },
    { id: 't3', routine: 'otra', agent: 'invo', state: 'done', createdAt: 30 },
    { id: 't4', routine: 'r1', agent: 'invo', state: 'waiting', createdAt: 40, ensayo: true },
  ];
  const libro = [{ task: 't1', usd: 0.1 }, { task: 't2', usd: 0.3 }, { task: 't3', usd: 2 }, { task: 't4', usd: 9 }];
  assert.deepEqual(estimadoDe(tareas, libro, { rutina: 'r1', agente: 'invo' }), { usd: 0.2, de: 'rutina', n: 2 }, 'la mediana de ESTA rutina, y el ensayo no cuenta');
  assert.deepEqual(estimadoDe(tareas, libro, { rutina: 'nueva', agente: 'invo' }), { usd: 0.3, de: 'agente', n: 3 }, 'sin historial propio, el del agente');
  assert.deepEqual(estimadoDe(tareas, libro, { rutina: 'nueva', agente: 'nadie' }), { usd: 0.3, de: 'oficina', n: 3 }, 'ni eso: el de la oficina');
  assert.deepEqual(estimadoDe([], [], { rutina: 'nueva', agente: 'nadie' }), { usd: null, de: null, n: 0 }, 'sin nada que mirar NO se inventa');

  const c = corridasDe(tareas, libro, 'r1');
  assert.deepEqual(c.map(x => x.task), ['t4', 't2', 't1'], 'de la más nueva a la más vieja');
  assert.equal(c[0].ensayo, true);
  assert.equal(c[1].usd, 0.3);
});

test('lo puro: la vista previa habla en palabras y no se calla lo que no sabe', () => {
  const base = { rutina: { id: 'r1', title: 'Facturas vencidas', agent: 'invo', nextAt: alas(9), needsOk: true }, ahora: alas(8), siguiente: t => t + DIA, agente: { id: 'invo', name: 'FACTURAS' } };
  const v = vistaPrevia({ ...base, tasks: [{ id: 't1', routine: 'r1', agent: 'invo', state: 'done', createdAt: Date.now() - DIA }], lines: [{ task: 't1', usd: 0.12 }], lee: ['Xero', 'Gmail'], envian: ['Gmail'] });
  assert.match(v.texto, /Hoy correría a las 09:00/);
  assert.match(v.texto, /La lleva FACTURAS/);
  assert.match(v.texto, /espera tu OK/);
  assert.match(v.texto, /lee Xero, Gmail; podría enviar por Gmail \(en un ensayo, no\)/);
  assert.match(v.texto, /Suele costar US\$0\.12 por vuelta/);
  assert.match(v.texto, /terminó bien/);
  assert.equal(v.costo.de, 'rutina');
  assert.deepEqual(v.hoy, [alas(9)]);

  const nueva = vistaPrevia({ ...base, lee: [], envian: [] });
  assert.match(nueva.texto, /Nunca ha corrido, así que no sé lo que cuesta/);
  assert.match(nueva.texto, /ninguno de los suyos está conectado/);
  assert.match(vistaPrevia({ ...base, lee: ['Xero'], envian: [] }).texto, /lee Xero; ninguno de los suyos envía/);

  assert.match(vistaPrevia({ ...base, rutina: { ...base.rutina, paused: true } }).texto, /Está en pausa: hoy no haría nada/);
  assert.match(vistaPrevia({ ...base, rutina: { ...base.rutina, terminada: true } }).texto, /Ya cumplió su cuenta de ejecuciones/);
  assert.match(vistaPrevia({ ...base, rutina: { ...base.rutina, needsOk: false } }).texto, /NO espera tu OK/);
  assert.match(vistaPrevia({ ...base, rutina: { ...base.rutina, nextAt: alas(9) + 2 * DIA } }).texto, /Hoy no le toca; la próxima es el/);
});

test('con el serve.mjs de verdad: GET no gasta, el ensayo no envía, no se aprueba y no mueve el reloj de la rutina', { timeout: 120000 }, async t => {
  const ROUTE = JSON.stringify({ agent: '', title: 'Facturas vencidas', plan: [], eta: 10, why: '', needsOk: true });
  let llamadas = 0;
  const claude = http.createServer((rq, rs) => { // Claude de mentira: cuenta cada llamada (así se prueba que la vista previa no usa ninguna)
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
      llamadas++;
      rs.writeHead(200, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: ROUTE }], usage: { input_tokens: 10, output_tokens: 10 } }));
    });
  });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-ensayo-')), brain = path.join(dir, 'brain');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'),
    ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya */ } });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún */ } await new Promise(r => setTimeout(r, 250)); }
  const call = async (p, b, method = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  if ((await call('/api/health').catch(() => ({ status: 0 }))).status !== 200) throw new Error('la oficina no arrancó: ' + log.split('\n').slice(-5).join(' | '));

  // una rutina de verdad, escrita por la oficina
  const hecha = await call('/api/routines', { dept: 'fin', text: 'Lista las facturas vencidas y deja los recordatorios', when: { kind: 'daily', at: '09:00' }, needsOk: true });
  assert.equal(hecha.status, 200, JSON.stringify(hecha.j));
  const rid = hecha.j.routine?.id || hecha.j.routines?.at(-1)?.id;
  assert.ok(rid, 'la rutina se creó: ' + JSON.stringify(hecha.j));
  const antes = (await call('/api/routines')).j.routines.find(x => x.id === rid);

  // 1) la vista previa: sin modelo y sin gastar
  const tras = llamadas;
  const previa = await call(`/api/routines/${rid}/ensayo`);
  assert.equal(previa.status, 200);
  assert.equal(llamadas, tras, 'la vista previa NO llama a ningún modelo');
  assert.equal(previa.j.rutina, rid);
  assert.match(previa.j.texto, /correría|no le toca|pausa/);
  assert.match(previa.j.texto, /espera tu OK/);
  assert.equal(previa.j.needsOk, true);
  assert.equal(previa.j.costo.usd, null, 'sin historial no se inventa un costo');

  // 2) un agente no pide ensayos
  assert.equal((await call(`/api/routines/${rid}/ensayo`, { por: 'agente' })).status, 403);

  // 3) el ensayo: una tarea marcada, que espera el OK
  const ens = await call(`/api/routines/${rid}/ensayo`, {});
  assert.equal(ens.status, 200, JSON.stringify(ens.j));
  const tid = ens.j.task.id;
  assert.equal(ens.j.task.ensayo, true);
  assert.equal(ens.j.task.needsOk, true, 'un ensayo siempre espera que lo leas');
  assert.match(ens.j.task.title, /^ENSAYO · /);
  assert.equal(ens.j.task.routine, rid);

  // 4) el reloj de la rutina no se movió
  const despues = (await call('/api/routines')).j.routines.find(x => x.id === rid);
  assert.equal(despues.nextAt, antes.nextAt, 'el ensayo no consume el turno de la rutina');
  assert.equal(despues.runs, antes.runs, 'ni cuenta como una ejecución');
  assert.equal(despues.lastAt, antes.lastAt);

  // 5) dos ensayos a la vez, no
  assert.equal((await call(`/api/routines/${rid}/ensayo`, {})).status, 409);

  // 6) cuando termina, su entrega NO se puede aprobar
  let tarea = null;
  for (let i = 0; i < 160; i++) {
    tarea = (await call('/api/tasks')).j.find?.(x => x.id === tid) || (await call('/api/tasks')).j.tasks?.find(x => x.id === tid);
    if (tarea && tarea.state === 'waiting') break;
    await new Promise(r => setTimeout(r, 250));
  }
  assert.ok(tarea, 'la tarea del ensayo sigue en la lista');
  assert.equal(tarea.state, 'waiting', 'el ensayo acaba esperando que lo leas: ' + log.split('\n').slice(-4).join(' | '));
  const ok = await call(`/api/tasks/${tid}/approve`, {});
  assert.equal(ok.status, 409);
  assert.match(ok.j.error, /ENSAYO/);
  assert.equal((await call('/api/tasks')).j.find?.(x => x.id === tid)?.state ?? 'waiting', 'waiting', 'y sigue sin aprobarse');
});
