// Revisión de control (9 oct 2026), contra el serve.mjs real (carpeta temporal; Claude, un doble local): el ejecutor único de cambios
// (/api/oficina/accion → sub.parseOps → runOp) con su DESHACER, las reglas de lo del dueño, lo que nunca se puede (aprobar, publicar…),
// un agente que no toca lo que espera el OK del dueño, Dimitri que dice lo que no pudo proponer, y oficina-mcp.mjs — el MCP para
// cualquier IA del dueño — que lista, lee y hace con las mismas reglas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as sub from '../sub.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const ROUTE = JSON.stringify({ agent: '', title: 'Tarea', plan: [], eta: 10, why: '', needsOk: true });
const PROHIBIDAS = /aprob|envi|public|pag[oa]|borr|elimin|delete|send|approve|publish|pay/i;

async function office(t, answers = []) {
  const claude = http.createServer((rq, rs) => {
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
      const body = JSON.parse(b || '{}'); const sys = typeof body.system === 'string' ? body.system : JSON.stringify(body.system || '');
      const text = /mano derecha del due/.test(sys) ? (answers.length ? answers.shift() : JSON.stringify({ mode: 'charla', reply: 'ok' })) : ROUTE;
      rs.writeHead(200, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }));
    });
  });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-oficina-')), brain = path.join(dir, 'brain');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'),
    ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const call = async (p, b, method = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, j: await r.json() }; };
  if ((await call('/api/health').catch(() => ({ status: 0 }))).status !== 200) throw new Error('the office did not start: ' + log.split('\n').slice(-5).join(' | '));
  const hacer = op => call('/api/oficina/accion', { op });
  return { base, call, hacer, dir, log: () => log };
}

function mcp(t, base) {
  const p = spawn(process.execPath, [path.join(ROOT, 'oficina-mcp.mjs')], { env: { ...process.env, AO_OFFICE: base }, stdio: ['pipe', 'pipe', 'inherit'] });
  t.after(() => p.kill());
  const rl = readline.createInterface({ input: p.stdout }), espera = new Map(); let n = 0;
  rl.on('line', l => { const m = JSON.parse(l); espera.get(m.id)?.(m); espera.delete(m.id); });
  const rpc = (method, params) => new Promise(r => { const id = ++n; espera.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  const llamar = async (name, args = {}) => { const r = await rpc('tools/call', { name, arguments: args }); return { text: r.result.content[0].text, error: !!r.result.isError }; };
  return { rpc, llamar };
}

test('el ejecutor único: lo del dueño se cambia por su fecha límite, se marca hecho y se deshace; las rutinas se pausan, se editan y vuelven; nunca aprobar ni publicar', { timeout: 90000 }, async t => {
  const o = await office(t);
  const mapa = (await o.call('/api/oficina/mapa')).j;
  assert.deepEqual(Object.keys(mapa.acciones).sort(), [...sub.OPS].sort(), 'cada cambio de Dimitri está a mano del asistente, y ninguno más'); assert.match(mapa.mapa, /MAPA DE LA OFICINA/);

  const mia = (await o.call('/api/tareas/mias', { title: 'Llamar a Juan', limite: '2030-12-01' })).j.tarea;
  let r = await o.hacer({ type: 'tarea_cancelar', id: mia.id }); assert.equal(r.status, 409); assert.match(r.j.error, /es del dueño/);
  r = await o.hacer({ type: 'tarea_editar', id: mia.id, prioridad: 'alta', limite: '2030-12-03T16:00' }); assert.equal(r.status, 200, JSON.stringify(r.j)); assert.match(r.j.hecho, /Tu tarea «Llamar a Juan»: prioridad alta/);
  let tt = (await o.call('/api/tareas/' + mia.id)).j.tarea; assert.equal(tt.prioridad, 'alta'); assert.equal(tt.limite, '2030-12-03T16:00');
  assert.equal((await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer })).status, 200);
  tt = (await o.call('/api/tareas/' + mia.id)).j.tarea; assert.equal(tt.prioridad, 'media'); assert.equal(tt.limite, '2030-12-01', 'deshacer devuelve lo de antes');
  assert.equal((await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer })).status, 409, 'una clave sirve una vez');
  r = await o.hacer({ type: 'mia_hecha', id: mia.id }); assert.equal(r.status, 200); assert.equal((await o.call('/api/tareas/' + mia.id)).j.tarea.state, 'done');
  await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer }); assert.equal((await o.call('/api/tareas/' + mia.id)).j.tarea.state, 'next');

  r = await o.hacer({ type: 'rutina_crear', dept: 'fin', text: 'Lista los cobros vencidos', when: { kind: 'weekly', days: [1], at: '09:00' }, needsOk: false });
  assert.equal(r.status, 200, JSON.stringify(r.j)); const rid = r.j.op.routineId; assert.ok(rid);
  let rt = (await o.call('/api/routines')).j.routines.find(x => x.id === rid); assert.equal(rt.needsOk, true, 'lo que crea un asistente espera el OK: quitarlo es del dueño');
  r = await o.hacer({ type: 'rutina_pausar', id: rid }); assert.equal(r.status, 200); assert.equal((await o.call('/api/routines')).j.routines.find(x => x.id === rid).paused, true);
  assert.equal((await o.hacer({ type: 'rutina_pausar', id: rid })).j.motivo, 'ya estaba pausada');
  await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer }); assert.ok(!(await o.call('/api/routines')).j.routines.find(x => x.id === rid).paused);
  r = await o.hacer({ type: 'rutina_editar', id: rid, when: { kind: 'monthly', day: 15, at: '10:00' } }); assert.equal(r.status, 200, JSON.stringify(r.j));
  rt = (await o.call('/api/routines')).j.routines.find(x => x.id === rid); assert.equal(rt.when.kind, 'monthly'); assert.equal(rt.when.day, 15);
  await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer }); assert.equal((await o.call('/api/routines')).j.routines.find(x => x.id === rid).when.kind, 'weekly');

  for (const type of ['aprobar_pieza', 'publicar', 'enviar', 'rutina_borrar']) { const x = await o.hacer({ type, id: 'p' }); assert.equal(x.status, 403, type); assert.match(x.j.error, /lo hace el dueño/); }

  const est = (await o.call('/api/oficina/estado')).j.texto; assert.match(est, new RegExp(`id ${rid}`), 'el estado lleva los ids'); assert.match(est, /Publicación: modo/);
  const hoy = new Date(), ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, en = new Date(hoy); en.setDate(en.getDate() + 13);
  const cal = (await o.call(`/api/oficina/calendario?desde=${ymd(hoy)}&hasta=${ymd(en)}`)).j.texto; assert.match(cal, /Ejecuciones de rutinas \(\d+\)/); assert.match(cal, /«Lista los cobros vencidos»|rutina /);
  const audit = fs.readdirSync(path.join(o.dir, 'data', 'audit')).map(f => fs.readFileSync(path.join(o.dir, 'data', 'audit', f), 'utf8')).join('');
  assert.match(audit, /"kind":"oficina","por":"asistente","accion":"rutina_pausar"/, 'cada cambio del asistente queda en el registro');
});

test('Contenido: una pieza del asistente nace borrador y se deshace; un agente no toca lo que espera tu OK ni borra', { timeout: 60000 }, async t => {
  const o = await office(t);
  let r = await o.hacer({ type: 'pieza_crear', titulo: 'Examen gratis', texto: 'Ven por tu examen', fecha: '2030-11-04', hora: '18:00', redes: ['instagram', 'linkedin'] });
  assert.equal(r.status, 200, JSON.stringify(r.j)); const pid = r.j.op.pieza;
  const pz = (await o.call('/api/contenido/piezas/' + pid)).j.pieza; assert.equal(pz.estado, 'borrador'); assert.equal(pz.origen, 'asistente'); assert.deepEqual(pz.redes, ['instagram', 'linkedin']);
  await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer }); assert.equal((await o.call('/api/contenido/piezas/' + pid)).status, 404);

  const rev = (await o.call('/api/contenido/piezas', { titulo: 'Para revisar', texto: 'Hola', fecha: '2030-11-05', hora: '18:00', estado: 'revision' })).j.pieza;
  r = await o.call('/api/contenido/piezas/' + rev.id, { texto: 'Cambiado por un agente', por: 'agente', agente: 'mia' }, 'PATCH'); assert.equal(r.status, 409); assert.match(r.j.error, /espera el OK del dueño/);
  const bor = (await o.call('/api/contenido/piezas', { titulo: 'Borrador', texto: 'Hola', por: 'agente', agente: 'mia' })).j.pieza;
  assert.equal((await o.call('/api/contenido/piezas/' + bor.id, { texto: 'Mejor', por: 'agente', agente: 'mia' }, 'PATCH')).status, 200, 'un borrador, sí');
  assert.equal((await o.call('/api/contenido/piezas/' + rev.id, { por: 'agente', agente: 'mia' }, 'DELETE')).status, 403);
  assert.equal((await o.call('/api/contenido/guardados/Promo', { por: 'agente' }, 'DELETE')).status, 403);
  assert.equal((await o.call('/api/contenido/piezas/' + rev.id, null, 'DELETE')).status, 200, 'el dueño sí');
});

test('Dimitri: el JSON se lee aunque piense antes, y lo que no puede proponer lo dice (no se pierde en silencio)', { timeout: 60000 }, async t => {
  const answers = [], o = await office(t, answers);
  const mia = (await o.call('/api/tareas/mias', { title: 'Firmar el contrato' })).j.tarea;
  answers.push(`Vale, lo pienso: el dueño quiere {pausar cosas}.\n${JSON.stringify({ mode: 'plan', reply: 'Lo dejo así.', ops: [{ type: 'tarea_editar', id: mia.id, prioridad: 'alta' }, { type: 'tarea_cancelar', id: mia.id }, { type: 'publicar', id: 'x' }] })}`);
  const c = await o.call('/api/sub/chat', { text: 'Sube la prioridad de firmar el contrato y quítalo de mi lista' }); assert.equal(c.status, 200, JSON.stringify(c.j));
  const m = c.j.messages[1];
  assert.equal(m.mode, 'plan'); assert.deepEqual(m.ops.map(x => x.type), ['tarea_editar']);
  assert.match(m.text, /^Lo dejo así\./); assert.match(m.text, /No incluyo 2 cambios que pensé: cancelar una tarea — es del dueño: solo él la quita de su lista; publicar — no es algo que yo pueda hacer desde aquí/);
  const hecho = await o.call('/api/sub/ops', { msg: m.id, items: [{ k: 0, include: true }] }); assert.equal(hecho.status, 200);
  assert.equal((await o.call('/api/tareas/' + mia.id)).j.tarea.prioridad, 'alta', 'con el clic del dueño (HACER), hecho');
});

test('oficina-mcp.mjs: cualquier cliente MCP lee y hace con las reglas de la oficina; no hay herramienta para aprobar, enviar, publicar, pagar ni borrar', { timeout: 60000 }, async t => {
  const o = await office(t);
  const m = mcp(t, o.base);
  const ini = await m.rpc('initialize', { protocolVersion: '2025-06-18' }); assert.equal(ini.result.serverInfo.name, 'agents-office'); assert.match(ini.result.instructions, /no se puede/);
  const tools = (await m.rpc('tools/list')).result.tools.map(x => x.name);
  for (const n of tools) assert.doesNotMatch(n, PROHIBIDAS, `«${n}» suena a algo que el asistente no debe poder hacer`);
  for (const n of ['como_funciona', 'estado_oficina', 'ver_calendario', 'ver_tareas', 'ver_mis_tareas', 'ver_rutinas', 'ver_contenido', 'ver_resultados', 'ver_huecos', 'hablar_con_dimitri', 'crear_tarea', 'crear_mi_tarea', 'hacer', 'deshacer']) assert.ok(tools.includes(n), n);
  const hacerTipos = (await m.rpc('tools/list')).result.tools.find(x => x.name === 'hacer').inputSchema.properties.type.enum;
  assert.deepEqual([...hacerTipos].sort(), [...sub.OPS].sort(), 'el esquema de «hacer» es la lista cerrada de Dimitri');

  assert.match((await m.llamar('como_funciona')).text, /MAPA DE LA OFICINA[\s\S]*NO SE PUEDE[\s\S]*rutina_pausar:/);
  const t1 = await m.llamar('crear_mi_tarea', { titulo: 'Revisar el precio del combo', limite: '2030-10-20' }); assert.match(t1.text, /En la lista del dueño: (\w+) «Revisar el precio del combo»/);
  const id = /: (\w+) «/.exec(t1.text)[1];
  assert.match((await m.llamar('ver_mis_tareas')).text, new RegExp(id));
  const h = await m.llamar('hacer', { type: 'tarea_editar', id, limite: '2030-10-22' }); assert.equal(h.error, false, h.text); const clave = /clave (\S+) /.exec(h.text)[1];
  assert.match((await m.llamar('deshacer', { clave })).text, /^Deshecho:/);
  const no = await m.llamar('hacer', { type: 'tarea_cancelar', id }); assert.equal(no.error, true); assert.match(no.text, /es del dueño/);
  assert.match((await m.llamar('estado_oficina')).text, /<estado>[\s\S]*Publicación: modo/);
  assert.match((await m.llamar('ver_resultados')).text, /Meta no está conectada/);
  assert.match((await m.llamar('ver_rutinas')).text, /No hay rutinas|rutina\(s\)/);
});

test('llenar la semana desde una acción: las copias que vuelven y UNA tarea a Marketing; repetir una tarea hecha', { timeout: 60000 }, async t => {
  const o = await office(t);
  const r = await o.hacer({ type: 'contenido_llenar', dias: 3, redes: ['instagram'], pide: 'Que sean reels' });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.ok(r.j.op.huecos >= 1); assert.ok(r.j.op.tarea, 'la tarea a Marketing');
  const tarea = (await o.call('/api/tareas/' + r.j.op.tarea)).j.tarea; assert.equal(tarea.dept, 'marketing'); assert.match(tarea.text, /Que sean reels/);
  for (let i = 0; i < 40 && (await o.call('/api/tareas/' + r.j.op.tarea)).j.tarea.state !== 'done'; i++) await new Promise(x => setTimeout(x, 250)); // el doble de Claude contesta en seguida
  const rep = await o.hacer({ type: 'tarea_repetir', id: r.j.op.tarea }); assert.equal(rep.status, 200, JSON.stringify(rep.j)); assert.match(rep.j.hecho, /(Repetir|Reintentar) la tarea/);
  const nueva = (await o.call('/api/tareas/' + rep.j.op.task)).j.tarea; assert.equal(nueva.repeatOf, r.j.op.tarea);
});
