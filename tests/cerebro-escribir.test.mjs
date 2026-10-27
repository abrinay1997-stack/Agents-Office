// 27 oct 2026 — ESCRIBIR en el Cerebro (pedido del dueño: «no puedo eliminar notas que yo he creado, ni editarlas… quisiera escribirlas o pedirle a Dimitri que añada información a una nota»).
// Lo puro (nombres, añadir a una sección, quitarlo al deshacer), el módulo de archivos (cerebro-local.mjs) y el serve.mjs real: crear, editar sin pisar a nadie, añadir, mandar CUALQUIER nota
// a la papelera, recuperarla en su carpeta, y las dos acciones de Dimitri con su DESHACER.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as N from '../notas-core.mjs';
import { crearNotasLocal } from '../cerebro-local.mjs';
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


test('puro: el nombre de una nota no rompe enlaces ni carpetas; la carpeta es una sola', () => {
  assert.deepEqual(N.nombreValido('  Mi   plan de   ventas '), { ok: true, nombre: 'Mi plan de ventas' });
  for (const malo of ['', '   ', 'a/b', 'a\\b', '..', '.oculta', 'termina.', 'con [[enlace]]', 'a#b', 'a|b', 'x'.repeat(81)]) assert.equal(N.nombreValido(malo).ok, false, JSON.stringify(malo));
  assert.equal(N.grupoValido('').grupo, 'Notas'); assert.equal(N.grupoValido('Ventas 2026').grupo, 'Ventas 2026'); assert.equal(N.grupoValido('../fuera').ok, false); assert.equal(N.grupoValido('a/b').ok, false);
  assert.equal(N.textoValido('x'.repeat(N.MAX_NOTA + 1)).ok, false); assert.equal(N.textoValido('   ', { vacio: false }).ok, false); assert.equal(N.textoValido('a\r\nb').texto, 'a\nb');
});

test('puro: añadir a una nota no toca lo que decía — al final, a una sección que existe o a una nueva — y quitarlo lo deja como estaba', () => {
  const base = '---\ntitulo: Precios\n---\n# Precios\n\nHola.\n\n## Combos\n\nA 10\n\n## Otro\n\nZ\n';
  const fin = N.agregarTexto(base, 'Nota nueva'); assert.ok(fin.startsWith(base.trimEnd()) && fin.endsWith('\n\nNota nueva\n'));
  const enSeccion = N.agregarTexto(base, 'B 20', { seccion: 'combos' }); assert.equal(enSeccion, '---\ntitulo: Precios\n---\n# Precios\n\nHola.\n\n## Combos\n\nA 10\n\nB 20\n\n## Otro\n\nZ\n');
  const nueva = N.agregarTexto(base, 'Hoy', { seccion: '## Cambios' }); assert.ok(nueva.endsWith('\n\n## Cambios\n\nHoy\n'));
  assert.equal(N.agregarTexto('', 'Primero'), 'Primero\n'); assert.equal(N.agregarTexto('x', '   '), 'x\n', 'nada que añadir, nada cambia');
  assert.equal(N.agregarTexto('# T\n```\n## Combos\n```\n', 'v', { seccion: 'Combos' }).includes('## Combos\n\nv'), true, 'un título dentro de un bloque de código no cuenta: se crea la sección');
  assert.equal(N.quitarTexto(enSeccion, 'B 20').texto, base); assert.equal(N.quitarTexto(nueva, 'Hoy', { seccion: 'Cambios', seccionCreada: true }).texto, base); assert.equal(N.quitarTexto(base, 'no estaba').ok, false);
  assert.equal(N.tieneSeccion(base, 'COMBOS'), true); assert.equal(N.tieneSeccion(base, 'Cambios'), false); assert.equal(N.esClave('voice'), true); assert.equal(N.esClave('mi-nota'), false);
});

function bóveda() { // cerebro-local.mjs contra una carpeta temporal, con el mismo índice que arma serve.mjs
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-notas-')), BRAIN = path.join(dir, 'brain'), TRASH = path.join(BRAIN, 'Agents Office', '.papelera');
  fs.mkdirSync(path.join(BRAIN, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(BRAIN, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  const indice = () => { const m = new Map(); const ir = (d, g) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith('.')) continue; const p = path.join(d, e.name); if (e.isDirectory()) ir(p, g || e.name); else if (e.name.endsWith('.md')) m.set(e.name.slice(0, -3), { path: p, group: g || '', office: false }); } }; ir(BRAIN, ''); return m; };
  const dentro = (p) => { const r = path.relative(fs.realpathSync(BRAIN), fs.realpathSync(p)); return !!r && !r.startsWith('..') && !path.isAbsolute(r); };
  const renombrar = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.renameSync(a, b); };
  return { dir, BRAIN, TRASH, n: crearNotasLocal({ BRAIN, TRASH, indice, dentro, renombrar }) };
}

test('cerebro-local: crear, editar sin pisar, añadir, papelera con vuelta a su carpeta y nombres que no chocan', (t) => {
  const { dir, BRAIN, TRASH, n } = bóveda(); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let r = n.crear({ nombre: 'Plan de ventas', texto: '# Plan\n\nHola.', grupo: 'Ventas' }); assert.equal(r.ok, true, JSON.stringify(r)); assert.ok(fs.existsSync(path.join(BRAIN, 'Ventas', 'Plan de ventas.md')));
  assert.equal(n.crear({ nombre: 'plan de VENTAS' }).estado, 409, 'ni con otras mayúsculas'); assert.equal(n.crear({ nombre: 'voice' }).estado, 409, 'ni el nombre de una nota de otra carpeta'); assert.equal(n.crear({ nombre: '../x' }).estado, 400); assert.equal(n.crear({ nombre: 'ok', grupo: '../..' }).estado, 400);
  const m0 = r.modified;
  r = n.guardar({ nombre: 'Plan de ventas', texto: '# Plan\n\nCambiado.', base: m0 }); assert.equal(r.ok, true); assert.equal(r.antes, '# Plan\n\nHola.');
  fs.writeFileSync(path.join(BRAIN, 'Ventas', 'Plan de ventas.md'), 'lo cambió otro programa', 'utf8'); fs.utimesSync(path.join(BRAIN, 'Ventas', 'Plan de ventas.md'), new Date(Date.now() + 5000), new Date(Date.now() + 5000));
  assert.equal(n.guardar({ nombre: 'Plan de ventas', texto: 'mi cambio', base: m0 }).estado, 409, 'otra mano la cambió: no se pisa'); assert.equal(fs.readFileSync(path.join(BRAIN, 'Ventas', 'Plan de ventas.md'), 'utf8'), 'lo cambió otro programa');
  assert.equal(n.guardar({ nombre: 'No existe', texto: 'x' }).estado, 404); assert.equal(n.guardar({ nombre: 'Plan de ventas', texto: '   ' }).estado, 413);
  r = n.agregar({ nombre: 'Plan de ventas', texto: 'Una línea más', seccion: 'Novedades' }); assert.equal(r.ok, true); assert.match(fs.readFileSync(path.join(BRAIN, 'Ventas', 'Plan de ventas.md'), 'utf8'), /lo cambió otro programa\n\n## Novedades\n\nUna línea más\n$/);
  // papelera: cualquier nota, y vuelve a SU carpeta
  r = n.aPapelera('Plan de ventas'); assert.equal(r.ok, true); assert.ok(!fs.existsSync(path.join(BRAIN, 'Ventas', 'Plan de ventas.md'))); const lista = n.listarPapelera(); assert.equal(lista.items.length, 1); assert.equal(lista.items[0].name, 'Plan de ventas'); assert.equal(n.hallar('Plan de ventas'), null);
  r = n.crear({ nombre: 'Plan de ventas', texto: 'otra distinta' }); assert.equal(r.ok, true, 'el nombre quedó libre al irse a la papelera');
  const v = n.restaurar(lista.items[0].file, { porDefecto: path.join(BRAIN, 'Agents Office') }); assert.equal(v.ok, true); assert.equal(v.nombre, 'Plan de ventas-2', 'su nombre ya lo tenía otra: vuelve con -2'); assert.ok(fs.existsSync(path.join(BRAIN, 'Ventas', 'Plan de ventas-2.md')), 'a la carpeta de antes');
  assert.equal(n.restaurar('../../etc__1.md').estado, 404); assert.equal(n.aPapelera('voice').ok, true, 'hasta una nota clave va a la papelera (se recupera)'); assert.equal(n.listarPapelera().items.length, 1);
  assert.ok(fs.readdirSync(TRASH).some((f) => f.endsWith('.json')), 'guarda de dónde vino');
});

test('parseOps: nota_crear exige un nombre nuevo y válido; nota_agregar, el nombre EXACTO de una que existe', () => {
  const notaDe = (n) => ({ 'plan de ventas': 'Plan de ventas' })[String(n).toLowerCase()] || null, ctx = { depts: {}, agents: [], notaDe };
  const ok = sub.parseOps([{ type: 'nota_crear', nombre: 'Ideas', texto: 'Una idea', grupo: 'Marketing' }, { type: 'nota_agregar', nombre: 'PLAN DE VENTAS', texto: 'más', seccion: '## Novedades' }], ctx);
  assert.deepEqual(ok.ops.map((o) => [o.type, o.nombre, o.grupo || o.seccion]), [['nota_crear', 'Ideas', 'Marketing'], ['nota_agregar', 'Plan de ventas', 'Novedades']]);
  const mal = sub.parseOps([{ type: 'nota_crear', nombre: 'Plan de ventas', texto: 'x' }, { type: 'nota_crear', nombre: 'a/b', texto: 'x' }, { type: 'nota_crear', nombre: 'Vacía', texto: '  ' }, { type: 'nota_agregar', nombre: 'Inventada', texto: 'x' }, { type: 'nota_agregar', nombre: 'Plan de ventas', texto: '' }], ctx);
  assert.equal(mal.ops.length, 0); assert.equal(mal.motivos.length, 5); assert.match(mal.motivos[0].why, /ya hay una nota «Plan de ventas»/); assert.match(mal.motivos[3].why, /no hay una nota llamada «Inventada»/);
  assert.equal(sub.parseOps([{ type: 'nota_agregar', nombre: 'x', texto: 'y' }], { depts: {}, agents: [] }).ops.length, 0, 'sin índice de notas no se inventa ninguna');
  for (const t of ['nota_borrar', 'nota_editar', 'nota_reemplazar']) assert.ok(!sub.OPS.includes(t), t + ' no existe: Dimitri solo crea y añade');
});

test('serve.mjs: /api/note crea, edita sin pisar, añade y manda CUALQUIER nota a la papelera (vuelve a su carpeta); el asistente/Dimitri crean y añaden con su DESHACER', { timeout: 120000 }, async (t) => {
  const o = await office(t);
  let r = await o.call('/api/note', { name: 'Ideas de octubre', text: '# Ideas\n\nUna.', group: 'Marketing' });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.ok(r.j.graph.nodes.some((n) => n.id === 'Ideas de octubre'), 'la nota nueva ya está en el mapa'); const m0 = r.j.modified;
  assert.equal((await o.call('/api/note', { name: 'ideas de OCTUBRE', text: 'x' })).status, 409); assert.equal((await o.call('/api/note', { name: 'a/b', text: 'x' })).status, 400);
  r = await o.call('/api/note?id=' + encodeURIComponent('Ideas de octubre')); assert.equal(r.j.deletable, true); assert.equal(r.j.editable, true); assert.equal(r.j.group, 'Marketing'); assert.match(r.j.text, /Una\./);
  assert.equal((await o.call('/api/note?id=voice')).j.key, true, 'voice es una nota clave (el botón avisa)');
  r = await o.call('/api/note', { name: 'Ideas de octubre', text: '# Ideas\n\nDos.', base: m0 }, 'PUT'); assert.equal(r.status, 200, JSON.stringify(r.j));
  r = await o.call('/api/note', { name: 'Ideas de octubre', text: 'otro', base: m0 }, 'PUT'); assert.equal(r.status, 409, 'con un `base` viejo no se pisa'); assert.match(r.j.error, /cambió/);
  r = await o.call('/api/note/append', { name: 'Ideas de octubre', text: 'Tres.', section: 'Nuevas' }); assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.match((await o.call('/api/note?id=' + encodeURIComponent('Ideas de octubre'))).j.text, /Dos\.\n\n## Nuevas\n\nTres\.\n$/);
  // la papelera es para todas: una de las de siempre también, y vuelve a su carpeta
  r = await o.call('/api/note/trash', { id: 'voice' }); assert.equal(r.status, 200, JSON.stringify(r.j)); assert.ok(!r.j.graph.nodes.some((n) => n.id === 'voice'), 'sale del mapa'); assert.equal((await o.call('/api/note?id=voice')).status, 404);
  const bin = (await o.call('/api/note/trash')).j; assert.ok(bin.items.some((i) => i.name === 'voice'));
  r = await o.call('/api/note/restore', { file: bin.items.find((i) => i.name === 'voice').file }); assert.equal(r.status, 200); assert.equal(r.j.name, 'voice'); assert.equal((await o.call('/api/note?id=voice')).j.group, '20-Brand', 'a su carpeta de antes');
  assert.equal((await o.call('/api/note/trash', { id: 'no-existe' })).status, 404);
  // Dimitri y el asistente: la misma puerta (runOp) con su DESHACER
  r = await o.hacer({ type: 'nota_crear', nombre: 'Desde Dimitri', texto: 'Hola desde la oficina.', grupo: 'Notas' }); assert.equal(r.status, 200, JSON.stringify(r.j)); assert.match(r.j.hecho, /Nota nueva en el Cerebro: «Desde Dimitri»/);
  assert.match((await o.call('/api/note?id=' + encodeURIComponent('Desde Dimitri'))).j.text, /Hola desde la oficina/);
  assert.equal((await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer })).status, 200); assert.equal((await o.call('/api/note?id=' + encodeURIComponent('Desde Dimitri'))).status, 404, 'deshacer = a la papelera');
  assert.match((await o.hacer({ type: 'nota_crear', nombre: 'Ideas de octubre', texto: 'x' })).j.motivo, /ya hay una nota/); assert.match((await o.hacer({ type: 'nota_agregar', nombre: 'Inventada', texto: 'x' })).j.motivo, /no hay una nota llamada/);
  r = await o.hacer({ type: 'nota_agregar', nombre: 'IDEAS DE OCTUBRE', texto: 'Cuatro.', seccion: 'Hoy' }); assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.match((await o.call('/api/note?id=' + encodeURIComponent('Ideas de octubre'))).j.text, /## Hoy\n\nCuatro\.\n$/);
  assert.equal((await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer })).status, 200); const t2 = (await o.call('/api/note?id=' + encodeURIComponent('Ideas de octubre'))).j.text; assert.ok(!/Cuatro/.test(t2) && !/## Hoy/.test(t2) && /Tres\./.test(t2), 'quita lo añadido y el título que creó, nada más');
  // si la nota se editó después, deshacer no la pisa
  r = await o.hacer({ type: 'nota_agregar', nombre: 'Ideas de octubre', texto: 'Cinco.' }); const ed = (await o.call('/api/note?id=' + encodeURIComponent('Ideas de octubre'))).j;
  await o.call('/api/note', { name: 'Ideas de octubre', text: ed.text.replace('Cinco.', 'Cinco, editado a mano.'), base: ed.modified }, 'PUT');
  assert.equal((await o.call('/api/oficina/deshacer', { deshacer: r.j.deshacer })).status, 409, 'lo que tocó la persona después no se pierde');
});
