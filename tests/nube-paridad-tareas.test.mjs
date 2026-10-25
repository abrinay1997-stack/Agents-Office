// Puerto a Cloudflare, fase 3: la MISMA petición a la oficina local (serve.mjs de verdad, con un Claude de mentira) y al Worker (con una D1 en memoria)
// tiene que dar la misma FORMA de respuesta: mismas claves, mismos tipos, mismos estados. Es la prueba de que la página no nota el cambio.
// Se salta en Node < 22.5 (la D1 de mentira usa node:sqlite); la corre el workflow de Cloudflare y la oficina con Node 22.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from '../cloudflare/tests/d1-memoria.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const RUTA = { agent: 'olead', title: 'Revisar los pagos', plan: ['Mirar', 'Resumir'], eta_minutes: 10, why: 'es de operaciones', needs_ok: false };

/** La oficina local de verdad, en una carpeta temporal, con un Claude de mentira que solo sabe enrutar. */
async function local(t) {
  const claude = http.createServer((rq, rs) => {
    let b = ''; rq.on('data', d => { b += d; }); rq.on('end', () => {
      rs.writeHead(200, { 'content-type': 'application/json' });
      rs.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(RUTA) }], usage: { input_tokens: 10, output_tokens: 10 } }));
    });
  });
  const cport = await listen(claude);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-paridad-')), brain = path.join(dir, 'brain');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'), ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: `http://127.0.0.1:${cport}`, CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', METRICOOL_USER_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); claude.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const call = async (metodo, ruta, cuerpo) => { const r = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json' }, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}) }); const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j }; };
  if ((await call('GET', '/api/health').catch(() => ({ status: 0 }))).status !== 200) throw new Error('la oficina local no arrancó: ' + log.split('\n').slice(-5).join(' | '));
  return { call };
}

/** El Worker de verdad (rutas.js) sobre una D1 en memoria, con la IA de mentira que enruta igual. */
async function nube() {
  const { manejar } = await import('../cloudflare/worker/lib/rutas.js');
  const d1 = crearD1(); const admin = await sembrar(d1);
  const env = envDePrueba(d1, { ANTHROPIC_API_KEY: 'k', __pruebas: { fetchIA: async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(RUTA) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 }) } });
  const r0 = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } });
  const cookie = r0.headers.get('set-cookie').split(';')[0];
  const call = async (metodo, ruta, cuerpo) => { const r = await pedir(manejar, env, ruta, { metodo, cuerpo, cookie }); const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j }; };
  return { call, d1 };
}

/** Diferencias de FORMA entre dos respuestas: claves y tipos. De un arreglo cuenta su primer elemento; un arreglo vacío o un null no dicen nada de la forma (se salta). */
export function diferencias(x, y, ruta = '$') {
  if (x === null || y === null || x === undefined || y === undefined) return [];
  if (Array.isArray(x) || Array.isArray(y)) {
    if (!Array.isArray(x) || !Array.isArray(y)) return [`${ruta}: uno es arreglo y el otro no`];
    return x.length && y.length ? diferencias(x[0], y[0], ruta + '[0]') : [];
  }
  if (typeof x === 'object' && typeof y === 'object') {
    const kx = Object.keys(x).sort(), ky = Object.keys(y).sort(), out = [];
    for (const k of kx) if (!ky.includes(k)) out.push(`${ruta}.${k}: solo en la local`);
    for (const k of ky) if (!kx.includes(k)) out.push(`${ruta}.${k}: solo en la nube`);
    for (const k of kx) if (ky.includes(k)) out.push(...diferencias(x[k], y[k], ruta + '.' + k));
    return out;
  }
  return typeof x === typeof y ? [] : [`${ruta}: ${typeof x} frente a ${typeof y}`];
}

test('las mismas peticiones a la oficina local y al Worker dan la misma forma de respuesta (tareas, rutinas, calendario, agentes)', { skip: SALTAR, timeout: 120000 }, async t => {
  const L = await local(t), N = await nube();
  const dos = async (metodo, ruta, cuerpo, { sinForma = false } = {}) => {
    const [a, b] = [await L.call(metodo, ruta, cuerpo), await N.call(metodo, ruta, cuerpo)];
    assert.equal(b.status, a.status, `${metodo} ${ruta}: el estado (local ${a.status}, nube ${b.status}): ${JSON.stringify(b.j).slice(0, 200)}`);
    if (!sinForma && typeof a.j === 'object') assert.deepEqual(diferencias(a.j, b.j), [], `${metodo} ${ruta}: la forma de la respuesta`);
    return { local: a.j, nube: b.j };
  };

  // el roster y el equipo
  const ag = await dos('GET', '/api/agents'); assert.equal(ag.nube.agents.length, 35); assert.deepEqual(ag.nube.agents.map(a => a.id), ag.local.agents.map(a => a.id));
  await dos('GET', '/api/team');
  await dos('GET', '/api/tasks?light=1');

  // una tarea de la barra, enrutada
  const a = await dos('POST', '/api/tasks', { dept: 'ops', text: 'Revisa los pagos pendientes y arma un resumen', prioridad: 'alta', idea: true });
  assert.equal(a.nube.agent, 'olead'); assert.equal(a.nube.title, 'Revisar los pagos'); assert.equal(a.nube.prioridad, 'alta');
  await dos('POST', '/api/tasks', { dept: 'zzz', text: 'x' }); await dos('POST', '/api/tasks', { dept: 'ops', text: '   ' });
  const lista = await dos('GET', '/api/tasks'); assert.equal(lista.nube.length, 1);
  const idL = a.local.id, idN = a.nube.id;
  const sep = async (metodo, ruta, cuerpo, op) => { // la misma operación con el id de cada lado
    const [x, y] = [await L.call(metodo, ruta.replace('{id}', idL), cuerpo), await N.call(metodo, ruta.replace('{id}', idN), cuerpo)];
    assert.equal(y.status, x.status, `${metodo} ${ruta}: ${JSON.stringify(y.j).slice(0, 200)} / ${JSON.stringify(x.j).slice(0, 200)}`);
    if (typeof x.j === 'object') assert.deepEqual(diferencias(x.j, y.j), [], `${metodo} ${ruta}: la forma`);
    return { local: x.j, nube: y.j };
  };
  await sep('PATCH', '/api/tasks/{id}', { text: 'Revisa los pagos y arma un resumen corto', model: 'opus' });
  await sep('POST', '/api/tasks/{id}/comment', { text: 'ojo con los de octubre' });
  await sep('POST', '/api/tasks/{id}/seen');
  await sep('POST', '/api/tasks/{id}/vote', { vote: 'up' });
  await sep('GET', '/api/tareas/{id}');
  await sep('GET', '/api/tareas/{id}/bitacora');
  await sep('POST', '/api/tareas/{id}/organizar', { prioridad: 'baja', limite: '2026-12-01', estimacion: 30 });
  await sep('POST', '/api/tareas/{id}/organizar', { prioridad: 'urgentísima' });
  await sep('POST', '/api/tareas/{id}/nota', { texto: 'una nota' });
  await sep('POST', '/api/tareas/{id}/estado', { a: 'inexistente' });
  await sep('POST', '/api/tasks/{id}/person', { person: 'Tú' }); // pasa a ser del dueño: ningún agente la arranca
  await sep('POST', '/api/tasks/{id}/repeat');
  await sep('POST', '/api/tasks/{id}/archive', { archived: true });

  // el catálogo, las agendas y lo del dueño
  await dos('POST', '/api/tareas/proyectos', { nombre: 'Lanzamiento de lentes', color: 'verde' });
  await dos('POST', '/api/tareas/etiquetas', { nombre: 'lentes' });
  await dos('GET', '/api/tareas/catalogo');
  await dos('GET', '/api/tareas/agenda?dias=7');
  await dos('GET', '/api/tareas/resumen?dias=30');
  const mia = await dos('POST', '/api/tareas/mias', { title: 'Llamar al contador', limite: '2026-12-02', etiquetas: [] });
  assert.equal(mia.nube.tarea.person, 'Tú');
  await dos('GET', '/api/tareas/mias');
  await dos('GET', '/api/tareas/mias?desde=2026-12-01&hasta=2026-12-31');

  // las rutinas y el calendario
  const rt = await dos('POST', '/api/routines', { dept: 'ops', text: 'cada día hábil a las 8, revisa el correo de la noche y resume lo urgente' });
  assert.equal(rt.nube.ok, true); assert.equal(rt.nube.routine.agent, 'olead');
  const rid = rt.nube.routine.id;
  assert.equal(rt.nube.routine.id, rt.local.routine.id, 'el mismo id de rutina');
  await dos('GET', '/api/routines');
  await dos('POST', `/api/routines/${rid}/pause`); await dos('POST', `/api/routines/${rid}/resume`);
  const futuro = Date.now() + 5 * 864e5;
  await dos('POST', `/api/routines/${rid}/skip`, { at: futuro }); await dos('POST', `/api/routines/${rid}/unskip`, { at: futuro });
  await dos('POST', `/api/routines/${rid}/skip`, { at: 5 });
  await dos('PATCH', `/api/routines/${rid}`, { needsOk: false, title: 'Correo de la noche' });
  await dos('PATCH', `/api/routines/${rid}`, { when: { kind: 'daily' } });
  await dos('POST', '/api/routines/no-existe/pause');
  const ics = [await L.call('GET', '/api/calendar.ics'), await N.call('GET', '/api/calendar.ics')];
  for (const x of ics) assert.match(x.j, /^BEGIN:VCALENDAR/);
  const tipos = x => x.j.split(/\r?\n/).filter(l => /^(BEGIN|END|UID|RRULE|SUMMARY):/.test(l)).map(l => l.replace(/:.*/, '')).join();
  assert.equal(tipos(ics[1]), tipos(ics[0]), 'el .ics trae los mismos eventos');
  await dos('DELETE', `/api/routines/${rid}`);
});
