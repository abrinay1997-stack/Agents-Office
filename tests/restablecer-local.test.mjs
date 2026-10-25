// «Restablecer oficina» en la oficina local (parte C): lo que se quita se MUEVE a data/respaldos/ y vuelve idéntico; «PanaClaw por defecto» copia el Cerebro de fábrica; nunca toca costos, auditoría, avisos, Anuncios ni ajustes.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearRestablecerLocal, RUTAS, CONSERVA_DATA } from '../restablecer-local.mjs';
import { PALABRA, POR_DEFECTO, IDS_AMBITOS } from '../restablecer-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escribir = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
/** Una huella de toda una carpeta (nombres y contenidos) para probar que algo volvió idéntico. */
function huella(dir) {
  const h = crypto.createHash('sha256');
  (function ir(d) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(d, e.name); if (p.includes(`${path.sep}respaldos`)) continue; h.update(path.relative(dir, p) + '\0'); if (e.isDirectory()) ir(p); else h.update(fs.readFileSync(p)); } })(dir);
  return h.digest('hex');
}

function oficinaLocal({ fabrica = path.join(ROOT, 'brain-panaclaw'), enMarcha = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-reset-')), brain = path.join(dir, 'brain'), data = path.join(dir, 'data'), root = path.join(dir, 'root');
  const AO = path.join(brain, 'Agents Office');
  escribir(path.join(brain, '10-Business', 'precios.md'), '# Precios\nUS$ 450'); escribir(path.join(brain, '00-Empresa', 'perfil.md'), '# Perfil\nSomos X'); escribir(path.join(brain, 'CLAUDE.md'), '# Reglas');
  escribir(path.join(AO, '2026-10-25 entrega.md'), 'una entrega'); escribir(path.join(AO, 'skills', 'mia', 'SKILL.md'), '---\nname: mia\n---\nMis pasos'); escribir(path.join(AO, 'biblioteca', 'mi-hab', 'SKILL.md'), 'x');
  escribir(path.join(AO, 'agents.json'), '{"agents":[{"id":"lexi","brief":"mío"}]}'); escribir(path.join(AO, 'routines.json'), '{"routines":[{"id":"r1"}]}'); escribir(path.join(AO, 'cifras.json'), '{"items":[{"name":"P","value":"1"}]}');
  escribir(path.join(AO, 'feedback', 'lexi.md'), '- regla'); escribir(path.join(AO, 'media', '2026-10', 'a.png'), 'png'); escribir(path.join(AO, 'contenido', '2026-10', 'p-1.md'), 'pieza'); escribir(path.join(AO, 'estudio', '2026-10', 'n.md'), 'rastro');
  for (const [f, t] of [['tasks.json', '[{"id":"t1","state":"done"}]'], ['routines.json', '{}'], ['kpis.json', '{"defs":[{"id":"x"}]}'], ['memory.json', '{"notes":{"a":1}}'], ['embeddings.json', '{}'], ['routing.json', '[]'], ['subgerente.json', '{"messages":[{"role":"user","text":"hola"}]}'], ['subgerente-archivo.json', '[]'], ['weekly.json', '{}'],
    ['media-index.json', '{}'], ['media-jobs.json', '[]'], ['media-lotes.json', '[]'], ['tareas/catalogo.json', '{}'], ['archive/tasks-2026-01.json', '[]'], ['history/skill-mia.json', '{}'], ['contenido/cola.json', '{}'], ['contenido/simulacro.json', '{}'], ['contenido/bandeja.json', '{"mensajes":[1]}'],
    // lo que NO se toca
    ['costs.jsonl', '{"usd":1}\n'], ['audit/2026-10-25.jsonl', '{}\n'], ['backups/tasks-2026-10-25.json', '[]'], ['notices.json', '[{"text":"aviso"}]'], ['triggers.json', '{}'], ['anuncios/cuenta.json', '{"id":"act_1"}'], ['media-usage.json', '{"n":3}'], ['usage.json', '{}']]) escribir(path.join(data, f), t);
  escribir(path.join(root, 'office.agents.local.json'), '{"agents":[]}'); escribir(path.join(root, 'office.config.local.json'), '{"name":"Mi Empresa"}');
  let cambios = 0; const avisos = [];
  const r = crearRestablecerLocal({ root, brain, data, hayTareasEnMarcha: () => enMarcha, alCambiar: async () => { cambios++; }, avisar: (k, t) => avisos.push(t), fabricaDe: () => ({ dir: fabrica, desdeGit: false }) });
  return { r, dir, brain, data, root, AO, avisos, cambios: () => cambios, existe: (...p) => fs.existsSync(path.join(...p)) };
}
const hacer = async (o, modo, ambitos) => { const p = o.r.pedir({ modo, ambitos }); if (p.error) return { p }; return { p, c: await o.r.confirmar({ token: p.pendiente.token, escribio: PALABRA }) }; };

test('LOCAL · VACÍA: la oficina queda en blanco y NO se toca nada de lo que debe conservarse', async () => {
  const o = oficinaLocal();
  const conservado = () => ['costs.jsonl', 'notices.json', 'triggers.json', 'media-usage.json', 'usage.json', 'contenido/bandeja.json', 'audit/2026-10-25.jsonl', 'backups/tasks-2026-10-25.json', 'anuncios/cuenta.json'].map((f) => fs.readFileSync(path.join(o.data, ...f.split('/')), 'utf8')).join('|') + fs.readFileSync(path.join(o.root, 'office.config.local.json'), 'utf8');
  const antes = conservado();
  const { p, c } = await hacer(o, 'vacia', IDS_AMBITOS);
  assert.ok(p.pendiente.resumen.length === IDS_AMBITOS.length); assert.equal(c.ok, true, JSON.stringify(c));
  for (const f of ['10-Business/precios.md', '00-Empresa/perfil.md', 'CLAUDE.md', 'Agents Office/2026-10-25 entrega.md', 'Agents Office/skills', 'Agents Office/biblioteca', 'Agents Office/agents.json', 'Agents Office/routines.json', 'Agents Office/cifras.json', 'Agents Office/feedback', 'Agents Office/media', 'Agents Office/contenido', 'Agents Office/estudio']) assert.equal(o.existe(o.brain, ...f.split('/')), false, f + ' debía irse');
  for (const f of ['tasks.json', 'routines.json', 'kpis.json', 'memory.json', 'embeddings.json', 'routing.json', 'subgerente.json', 'subgerente-archivo.json', 'weekly.json', 'media-index.json', 'media-jobs.json', 'media-lotes.json', 'tareas', 'archive', 'history', 'contenido/cola.json', 'contenido/simulacro.json']) assert.equal(o.existe(o.data, ...f.split('/')), false, f + ' debía irse');
  assert.equal(o.existe(o.root, 'office.agents.local.json'), false);
  assert.equal(conservado(), antes, 'costos, auditoría, copias, avisos, disparadores, Anuncios, Bandeja y tus ajustes: intactos');
  assert.equal(o.cambios(), 1); assert.equal(o.r.respaldos().length, 1);
  assert.match(o.avisos.at(-1), /Restableciste la oficina/);
});

test('LOCAL · RESTAURAR devuelve TODO idéntico (byte a byte), y restaurar también se puede deshacer', async () => {
  const o = oficinaLocal(), h0 = huella(o.dir), notas0 = huella(o.brain);
  const { c } = await hacer(o, 'vacia', IDS_AMBITOS); assert.notEqual(huella(o.dir), h0);
  const r = await o.r.restaurar({ id: c.respaldo.id }); assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(huella(o.dir), h0, 'idéntico'); assert.equal(huella(o.brain), notas0);
  assert.equal(o.r.respaldos().length, 1, 'quedó el estado previo a restaurar, por si te arrepientes');
  const otra = await o.r.restaurar({ id: o.r.respaldos()[0].id }); assert.equal(otra.ok, true); assert.notEqual(huella(o.dir), h0, 'se deshizo la restauración: vuelve a estar vacía');
  assert.equal((await o.r.restaurar({ id: 'noexiste' })).status, 404);
});

test('LOCAL · LOS DOS PASOS: sin palabra, con otra clave, repetida o caducada no se mueve nada', async () => {
  const o = oficinaLocal(), h0 = huella(o.dir);
  assert.equal((await o.r.confirmar({ token: 'x', escribio: PALABRA })).status, 409);
  const p = o.r.pedir({ modo: 'vacia', ambitos: ['cerebro'] }); assert.equal(huella(o.dir), h0, 'pedir no mueve nada');
  for (const m of ['restablecer', 'SI', '']) assert.equal((await o.r.confirmar({ token: p.pendiente.token, escribio: m })).status, 409);
  assert.equal((await o.r.confirmar({ token: 'otra', escribio: PALABRA })).status, 409);
  assert.equal((await o.r.confirmar({ token: p.pendiente.token, escribio: PALABRA }, { ahora: Date.now() + 3 * 60_000 })).status, 409, 'caducó');
  assert.equal(huella(o.dir), h0);
  const q = o.r.pedir({ modo: 'vacia', ambitos: ['cerebro'] }); assert.equal((await o.r.confirmar({ token: q.pendiente.token, escribio: PALABRA })).ok, true);
  assert.equal((await o.r.confirmar({ token: q.pendiente.token, escribio: PALABRA })).status, 409, 'de un solo uso');
  for (const mal of [{}, { modo: 'x', ambitos: ['cerebro'] }, { modo: 'vacia', ambitos: [] }, { modo: 'vacia', ambitos: ['../../etc'] }, { modo: 'vacia', ambitos: ['costos'] }]) assert.equal(o.r.pedir(mal).status, 400, JSON.stringify(mal));
});

test('LOCAL · PANACLAW POR DEFECTO: carga las 59 notas de fábrica (con sus skills si se marca); lo demás no se toca; repetirlo deja lo mismo', async () => {
  const o = oficinaLocal(); assert.deepEqual(POR_DEFECTO.panaclaw, ['cerebro', 'habilidades']);
  const tareas = fs.readFileSync(path.join(o.data, 'tasks.json'), 'utf8');
  const { c } = await hacer(o, 'panaclaw', POR_DEFECTO.panaclaw); assert.equal(c.ok, true, JSON.stringify(c));
  const md = (d) => { let n = 0; (function ir(x) { for (const e of fs.readdirSync(x, { withFileTypes: true })) { if (e.name === 'Agents Office' || e.name.startsWith('.')) continue; if (e.isDirectory()) ir(path.join(x, e.name)); else if (e.name.endsWith('.md')) n++; } })(d); return n; };
  assert.equal(md(o.brain), 59, 'las 59 notas de PanaClaw'); assert.equal(o.existe(o.brain, '10-Business', 'precios.md'), false, 'tus notas se fueron (respaldadas)'); assert.ok(o.existe(o.brain, '10-Business', 'precios-webs.md'));
  assert.ok(o.existe(o.AO, 'skills', 'house-style', 'SKILL.md') || fs.readdirSync(path.join(o.AO, 'skills')).length >= 10, 'las skills de fábrica'); assert.equal(o.existe(o.AO, 'skills', 'mia'), false); assert.equal(o.existe(o.AO, 'biblioteca'), false);
  assert.equal(fs.readFileSync(path.join(o.data, 'tasks.json'), 'utf8'), tareas, 'las tareas no se tocan en este modo por defecto'); assert.ok(o.existe(o.AO, 'agents.json') && fs.readFileSync(path.join(o.AO, 'agents.json'), 'utf8').includes('mío'), 'el equipo tampoco (no estaba marcado)');
  const seg = await hacer(o, 'panaclaw', ['equipo', 'rutinas']); assert.equal(seg.c.ok, true);
  assert.ok(!fs.readFileSync(path.join(o.AO, 'agents.json'), 'utf8').includes('"mío"')); assert.ok(JSON.parse(fs.readFileSync(path.join(o.AO, 'routines.json'), 'utf8')).routines.length >= 2); assert.equal(o.existe(o.root, 'office.agents.local.json'), false);
  const h = huella(o.brain); await hacer(o, 'panaclaw', POR_DEFECTO.panaclaw); assert.equal(huella(o.brain), h, 'idempotente');
});

test('LOCAL · si no se puede leer la fábrica no se quita nada; con una tarea en marcha tampoco; los respaldos vencen', async () => {
  const sin = oficinaLocal({ fabrica: '/no/existe/brain-panaclaw' }), h0 = huella(sin.dir);
  assert.equal(sin.r.estado().modos.find((m) => m.id === 'panaclaw').disponible, false);
  const p = sin.r.pedir({ modo: 'panaclaw', ambitos: ['cerebro'] }); assert.equal(p.status, 409); assert.equal(huella(sin.dir), h0);
  const ocupada = oficinaLocal({ enMarcha: true }), h1 = huella(ocupada.dir);
  const q = ocupada.r.pedir({ modo: 'vacia', ambitos: ['tareas'] }), c = await ocupada.r.confirmar({ token: q.pendiente.token, escribio: PALABRA }); assert.equal(c.status, 409); assert.match(c.error, /tarea de un agente en marcha/); assert.equal(huella(ocupada.dir), h1);
  const o = oficinaLocal(); const { c: r } = await hacer(o, 'vacia', ['kpis']);
  assert.equal(o.r.respaldos(Date.now() + 6 * 864e5).length, 1); assert.equal(o.r.respaldos(Date.now() + 8 * 864e5).length, 0, 'a los 8 días ya venció');
  assert.equal(o.r.purgar(Date.now() + 8 * 864e5), 1); assert.equal(fs.existsSync(path.join(o.data, 'respaldos', r.respaldo.id)), false);
});

test('LOCAL · CLASIFICACIÓN: todo archivo de data/ que usa la oficina o se restablece con un ámbito o se conserva; lo nuevo obliga a decidir', () => {
  const nombres = new Set(); const mirar = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', 'tests', 'docs', 'dist', 'cloudflare', 'scripts', '.git', 'brain', 'brain-panaclaw', 'biblioteca', 'data'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) mirar(p); else if (/\.(mjs|js)$/.test(e.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/\b(?:DATA|dataDir|datos)\s*,\s*'([^']+)'/g)) nombres.add(m[1]); } };
  mirar(ROOT);
  const mios = new Set([...Object.values(RUTAS).flat().filter((r) => r.base === 'data').map((r) => r.rel.split('/')[0]), ...CONSERVA_DATA.map((x) => x.split('/')[0])]);
  const sin = [...nombres].filter((x) => !mios.has(x));
  assert.deepEqual(sin, [], 'archivos de data/ sin decidir en restablecer-local.mjs: ' + sin.join());
  for (const x of CONSERVA_DATA) assert.ok(!Object.values(RUTAS).flat().some((r) => r.base === 'data' && r.rel === x), x + ' está en los dos lados');
});

/* ---------- el serve.mjs real ---------- */
const escuchar = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
test('serve.mjs: GET /api/restablecer, los dos pasos, lo que la oficina ve después (Cerebro vacío, sin tareas, sin rutinas) y restaurar', { timeout: 120000 }, async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-reset-srv-')), brain = path.join(dir, 'brain'), data = path.join(dir, 'data');
  escribir(path.join(brain, '10-Business', 'precios.md'), '# Precios\nUS$ 450 [[perfil]]'); escribir(path.join(brain, '00-Empresa', 'perfil.md'), '# Perfil\nSomos X [[precios]]');
  escribir(path.join(brain, 'Agents Office', 'routines.json'), JSON.stringify({ routines: [{ id: 'saludo', dept: 'ops', agent: 'olead', title: 'Saludo', text: 'saluda', when: { kind: 'daily', at: '09:00' }, needsOk: true, paused: true }] }));
  escribir(path.join(data, 'tasks.json'), JSON.stringify([{ id: 'abc12345', text: 'una tarea vieja', title: 'una tarea vieja', dept: 'ops', agent: 'olead', state: 'done', doneAt: Date.now(), addedAt: Date.now(), result: 'hecho' }]));
  const probe = http.createServer(), port = await escuchar(probe); await new Promise((r) => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: data, AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'), ANTHROPIC_API_KEY: 'test-key-not-real', CLAUDE_BIN: path.join(dir, 'no-claude.exe'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  t.after(() => { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya */ } });
  const base = `http://127.0.0.1:${port}`; for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún no */ } await new Promise((r) => setTimeout(r, 250)); }
  const call = async (p, b, m = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j }; };
  const e = (await call('/api/restablecer')).j; assert.ok(e.ambitos.length === 10 && e.respaldos.length === 0 && e.conserva.length >= 5, JSON.stringify(e).slice(0, 300)); assert.equal(e.ambitos.find((a) => a.id === 'cerebro').actual, '2 notas');
  assert.equal((await call('/api/restablecer', { modo: 'x', ambitos: ['cerebro'] })).status, 400);
  assert.equal((await call('/api/brain')).j.notes, 2); assert.equal((await call('/api/tasks')).j.length ?? (await call('/api/tasks')).j.tasks?.length, 1);
  const p = await call('/api/restablecer', { modo: 'vacia', ambitos: IDS_AMBITOS }); assert.equal(p.status, 200);
  assert.equal((await call('/api/restablecer/confirmar', { token: p.j.pendiente.token, escribio: 'si' })).status, 409);
  assert.equal((await call('/api/brain')).j.notes, 2, 'sin la palabra no cambia nada');
  const c = await call('/api/restablecer/confirmar', { token: p.j.pendiente.token, escribio: PALABRA }); assert.equal(c.status, 200, JSON.stringify(c.j) + log.slice(-300));
  assert.equal((await call('/api/brain')).j.notes, 0, 'el Cerebro quedó vacío'); const ts = (await call('/api/tasks')).j; assert.equal((Array.isArray(ts) ? ts : ts.tasks || []).length, 0);
  assert.equal((await call('/api/routines')).j.routines?.length ?? 0, 0);
  assert.ok(fs.existsSync(path.join(data, 'respaldos', c.j.respaldo.id, 'meta.json')));
  const r = await call('/api/restablecer/deshacer', { id: c.j.respaldo.id }); assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal((await call('/api/brain')).j.notes, 2); assert.equal((await call('/api/routines')).j.routines?.length, 1);
  assert.equal(fs.readFileSync(path.join(brain, '10-Business', 'precios.md'), 'utf8'), '# Precios\nUS$ 450 [[perfil]]');
  assert.match(await (await fetch(base + '/')).text(), /<script src="\/ajustes-extra\.js" defer><\/script><\/body>/, 'la página lleva su línea');
  assert.equal((await fetch(base + '/ajustes-extra.js')).status, 200);
});

test('LOCAL · si tu Cerebro ES brain-panaclaw/ del repositorio, «de fábrica» es lo que Git guardó (HEAD), no tus cambios sin subir', async () => {
  const { execFileSync } = await import('node:child_process');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-git-')), brain = path.join(repo, 'brain-panaclaw'), data = path.join(repo, 'data');
  const git = (...a) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t.test', '-c', 'commit.gpgsign=false', ...a], { stdio: 'ignore' });
  escribir(path.join(brain, '10-Business', 'precios.md'), '# Precios\nUS$ 295 (de fábrica)'); escribir(path.join(brain, 'Agents Office', 'agents.json'), '{"agents":[]}');
  git('init', '-q'); git('add', '.'); git('commit', '-q', '-m', 'fábrica');
  escribir(path.join(brain, '10-Business', 'precios.md'), '# Precios\nUS$ 999 (lo edité yo, sin subir)'); escribir(path.join(brain, '10-Business', 'nueva-mia.md'), '# Mía\nsin subir');
  const r = crearRestablecerLocal({ root: repo, brain, data, alCambiar: async () => {} });
  assert.equal(r.estado().semilla.notas, 1, 'la fábrica tiene 1 nota (la que Git guardó), no las 2 del disco');
  const p = r.pedir({ modo: 'panaclaw', ambitos: ['cerebro'] }); assert.equal((await r.confirmar({ token: p.pendiente.token, escribio: PALABRA })).ok, true);
  assert.match(fs.readFileSync(path.join(brain, '10-Business', 'precios.md'), 'utf8'), /US\$ 295 \(de fábrica\)/); assert.equal(fs.existsSync(path.join(brain, '10-Business', 'nueva-mia.md')), false, 'lo tuyo se fue al respaldo');
  const id = r.respaldos()[0].id; assert.equal((await r.restaurar({ id })).ok, true);
  assert.match(fs.readFileSync(path.join(brain, '10-Business', 'precios.md'), 'utf8'), /US\$ 999/); assert.ok(fs.existsSync(path.join(brain, '10-Business', 'nueva-mia.md')), 'y restaurar devuelve tus cambios sin subir');
  // sin Git no se inventa una fábrica
  const sinGit = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-singit-')); fs.cpSync(brain, path.join(sinGit, 'brain-panaclaw'), { recursive: true });
  const r2 = crearRestablecerLocal({ root: sinGit, brain: path.join(sinGit, 'brain-panaclaw'), data: path.join(sinGit, 'data'), alCambiar: async () => {} });
  assert.equal(r2.estado().modos.find((m) => m.id === 'panaclaw').disponible, false); assert.equal(r2.pedir({ modo: 'panaclaw', ambitos: ['cerebro'] }).status, 409);
});
