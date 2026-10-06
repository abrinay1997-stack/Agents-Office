// Plan T0–T3 (6 oct 2026): el almacén de tareas (bitácora, mezcla, copia diaria), las rutas /api/tareas/* y el MCP de los agentes,
// sobre una carpeta temporal y un servidor de verdad. Habla con tareas-mcp.mjs como lo haría Claude Code: JSON-RPC por stdio.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearAlmacenTareas } from '../tareas/almacen.mjs';
import { crearBus } from '../tareas/eventos.mjs';
import { crearCatalogo } from '../tareas/catalogo.mjs';
import { crearRutasTareas, despachadorDependencias } from '../tareas/rutas.mjs';
import { crearTarea } from '../tareas/modelo.mjs';
import { kindOf } from '../safety.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const espera = ms => new Promise(r => setTimeout(r, ms));

function oficina() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tareas-')), file = path.join(dir, 'tasks.json');
  const bus = crearBus(), alm = crearAlmacenTareas({ file, dataDir: dir, bus }), cat = crearCatalogo({ dataDir: dir });
  const avisos = []; let pumps = 0; let n = 0;
  const agentes = [{ id: 'piper', department: 'sales', name: 'PIPER' }, { id: 'sam', department: 'sales', lead: true, name: 'SAM' }, { id: 'ema', department: 'emails', lead: true, name: 'EMA' }];
  const altaTarea = (c, { por } = {}) => { const t = crearTarea(c, { id: () => 'tk' + (++n).toString().padStart(3, '0') }); const l = alm.load(); l.push(t); alm.save(l, { por }); return t; };
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  const rutas = crearRutasTareas({ alm, cat, json, body, pump: () => { pumps++; }, agentes, depts: { sales: { name: 'Ventas' }, emails: { name: 'Correos' } }, leadOf: d => agentes.find(a => a.department === d && a.lead), avisar: (k, t, o) => avisos.push({ k, t, o }), altaTarea, nombre: id => agentes.find(a => a.id === id)?.name || id });
  despachadorDependencias({ bus, alm, pump: () => { pumps++; }, avisar: (k, t) => avisos.push({ k, t }) });
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/tasks') return json(res, 200, alm.load());
    if (!await rutas(req, res, url)) json(res, 404, { error: 'no' });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const api = async (m, p, b) => { const x = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: x.status, ...(await x.json()) }; };
    r({ dir, file, alm, cat, bus, avisos, altaTarea, api, base, pumps: () => pumps, cerrar: () => { srv.close(); fs.rmSync(dir, { recursive: true, force: true }); } });
  }));
}

test('el almacén: cada guardado deja su bitácora (quién, qué) y emite al bus; la mezcla no pierde lo del dueño', async () => {
  const o = await oficina(); const vistos = []; o.bus.on('*', (d, tipo) => vistos.push(tipo));
  try {
    const t = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Propuesta Acme', plan: ['Leer', 'Escribir'] }, { por: 'dueno' });
    const l = o.alm.load(); l[0].state = 'doing'; o.alm.save(l, { por: 'oficina' });
    const base = JSON.parse(JSON.stringify(o.alm.load()[0]));
    o.alm.cambiar(t.id, x => { (x.comments ||= []).push({ at: 1, by: 'Tú', text: 'ojo' }); x.prioridad = 'alta'; }, { por: 'dueno' }); // el dueño, mientras trabaja
    const mio = { ...base, state: 'done', result: 'hecho', doneAt: 5 };
    const r = o.alm.guardarEjecucion(base, mio, { por: 'agente:piper' });
    assert.equal(r.tarea.state, 'done'); assert.equal(r.tarea.prioridad, 'alta'); assert.equal(r.tarea.comments.length, 1, 'el comentario sigue');
    const bit = o.alm.bitacora(t.id);
    assert.deepEqual(bit.map(x => `${x.tipo}${x.campo ? ':' + x.campo : ''}@${x.por}`), ['creada@dueno', 'estado@oficina', 'campo:prioridad@dueno', 'comentario@dueno', 'estado@agente:piper', 'resultado@agente:piper']);
    assert.equal(o.alm.load()[0].version, 4);
    await espera(5); assert.deepEqual([...new Set(vistos)].sort(), ['tarea.cambio', 'tarea.creada', 'tarea.estado']);
    assert.equal(o.alm.guardarEjecucion(base, { ...mio, id: 'gone' }).borrada, true, 'borrada mientras trabajaba: no se resucita');
  } finally { o.cerrar(); }
});

test('un tasks.json dañado vuelve de la copia diaria; uno de antes (v1) se lee sin anotar la migración como cambio', async () => {
  const o = await oficina();
  try {
    fs.writeFileSync(o.file, JSON.stringify([{ id: 'v1', state: 'next', title: 'Vieja', plan: ['a'] }]));
    const l = o.alm.load(); assert.equal(l[0].prioridad, 'media'); assert.equal(l[0].pasos.length, 1);
    assert.equal(o.alm.save(l), 0, 'normalizar no cuenta como un cambio');
    fs.mkdirSync(path.join(o.dir, 'backups')); fs.writeFileSync(path.join(o.dir, 'backups', 'tasks-2026-10-05.json'), JSON.stringify([{ id: 'ok', state: 'done' }]));
    fs.writeFileSync(o.file, '{ roto');
    assert.deepEqual(o.alm.load().map(t => t.id), ['ok']);
    assert.ok(fs.readdirSync(o.dir).some(f => f.startsWith('tasks.unreadable-')));
  } finally { o.cerrar(); }
});

test('organizar por la API: proyectos y etiquetas, bloqueos sin círculos, permisos por quien llama; al terminar una, sigue la que esperaba', async () => {
  const o = await oficina();
  try {
    const pr = await o.api('POST', '/api/tareas/proyectos', { nombre: 'Lentes polarizados', limite: '2026-10-20', color: 'azul' }); assert.equal(pr.status, 200);
    assert.equal((await o.api('POST', '/api/tareas/proyectos', { nombre: 'lentes polarizados' })).status, 400, 'no dos con el mismo nombre');
    assert.equal((await o.api('POST', '/api/tareas/proyectos', { nombre: 'Sin fecha' })).status, 200, 'la fecha límite es opcional');
    assert.equal((await o.api('POST', '/api/tareas/proyectos', { nombre: 'X', por: 'agente', agente: 'piper' })).status, 403);
    const et = (await o.api('POST', '/api/tareas/etiquetas', { nombre: '#lanzamiento' })).etiqueta; assert.equal(et.nombre, 'lanzamiento');
    const a = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Fotos' }), b = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Post' });
    const ok = await o.api('POST', `/api/tareas/${b.id}/organizar`, { prioridad: 'alta', etiquetas: [et.id], limite: '2026-10-18', proyecto: pr.proyecto.id, bloqueadaPor: [a.id] });
    assert.equal(ok.status, 200); assert.equal(ok.tarea.prioridad, 'alta'); assert.deepEqual(ok.tarea.bloqueadaPor, [a.id]);
    const circ = await o.api('POST', `/api/tareas/${a.id}/organizar`, { bloqueadaPor: [b.id] }); assert.equal(circ.status, 409); assert.match(circ.error, /círculo/);
    assert.equal((await o.api('POST', `/api/tareas/${b.id}/organizar`, { prioridad: 'baja', por: 'agente', agente: 'piper' })).status, 403);
    assert.match((await o.api('POST', `/api/tareas/${b.id}/organizar`, { limite: 'mañana' })).error, /AAAA-MM-DD/);
    const cat = await o.api('GET', '/api/tareas/catalogo'); assert.equal(cat.proyectos[0].progreso.total, 1); assert.equal(cat.proyectos[0].progreso.bloqueadas, 1);
    const p0 = o.pumps();
    o.alm.cambiar(a.id, t => { t.state = 'done'; t.doneAt = Date.now(); }, { por: 'agente:piper' });
    await espera(30);
    assert.ok(o.pumps() > p0, 'el despachador pone la cola a andar'); assert.ok(o.avisos.some(x => x.k === 'desbloqueada' && /«Post» ya no espera/.test(x.t)));
    assert.ok(o.alm.bitacora(b.id).some(x => x.tipo === 'desbloqueada'));
    const det = await o.api('GET', `/api/tareas/${b.id}`); assert.equal(det.visible, 'en_cola'); assert.ok(det.bitacora.length >= 2);
    const borrar = await o.api('DELETE', `/api/tareas/proyectos/${pr.proyecto.id}`); assert.deepEqual(borrar.tareas, [b.id]); assert.ok(!o.alm.load().find(t => t.id === b.id).proyecto);
    await o.api('POST', '/api/tareas/proyectos/restaurar', { proyecto: borrar.proyecto, tareas: borrar.tareas }); assert.equal(o.alm.load().find(t => t.id === b.id).proyecto, pr.proyecto.id, 'DESHACER las vuelve a juntar');
  } finally { o.cerrar(); }
});

test('estado, orden y varias a la vez: una idea se pide; un agente no mueve estados; DESHACER devuelve lo de antes', async () => {
  const o = await oficina();
  try {
    const i = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Idea', state: 'idea' });
    assert.equal((await o.api('POST', `/api/tareas/${i.id}/estado`, { a: 'next', por: 'agente', agente: 'piper' })).status, 403);
    const r = await o.api('POST', `/api/tareas/${i.id}/estado`, { a: 'next' }); assert.equal(r.tarea.state, 'next'); assert.equal(r.antes, 'idea');
    assert.equal((await o.api('POST', `/api/tareas/${i.id}/estado`, { a: 'doing' })).status, 403, 'la cola arranca, no la página');
    const x = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'X' }), y = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Y' });
    const ord = await o.api('POST', '/api/tareas/orden', { id: y.id, ids: [y.id, i.id, x.id] }); assert.equal(ord.status, 200);
    const l = o.alm.load(); assert.ok(l.find(t => t.id === y.id).orden < l.find(t => t.id === i.id).orden);
    const lote = await o.api('POST', '/api/tareas/lote', { ids: [x.id, y.id], accion: 'prioridad', valor: 'alta' }); assert.deepEqual(lote.hechas.sort(), [x.id, y.id].sort());
    assert.equal(o.alm.load().find(t => t.id === x.id).prioridad, 'alta');
    await o.api('POST', '/api/tareas/lote/deshacer', { antes: lote.antes }); assert.equal(o.alm.load().find(t => t.id === x.id).prioridad, 'media');
    assert.equal((await o.api('POST', '/api/tareas/lote', { ids: [x.id], accion: 'prioridad', valor: 'alta', por: 'dimitri' })).status, 403);
  } finally { o.cerrar(); }
});

test('el MCP de tareas: un agente ve su tarea, marca SUS pasos, anota, pide un bloqueo (nace una tarea para el dueño) y propone trabajo como idea; nada aprueba', async () => {
  const o = await oficina();
  const t = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Ficha de producto', plan: ['Leer la nota', 'Escribir la ficha'] });
  o.alm.cambiar(t.id, x => { x.state = 'doing'; x.startedAt = Date.now(); });
  const otra = o.altaTarea({ dept: 'sales', agent: 'sam', text: 'Otra' });
  const p = spawn(process.execPath, [path.join(ROOT, 'tareas-mcp.mjs')], { env: { ...process.env, AO_OFFICE: o.base, AO_AGENT: 'piper', AO_TASK: t.id }, stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '', seq = 0; const pend = new Map();
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); pend.get(m.id)?.(m); } });
  const rpc = (method, params) => new Promise(r => { const id = ++seq; pend.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  const llamar = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;
  const texto = r => r.content[0].text;
  try {
    const init = await rpc('initialize', {}); assert.equal(init.result.serverInfo.name, 'tareas'); assert.match(init.result.instructions, /nunca los adivines/);
    const nombres = (await rpc('tools/list', {})).result.tools.map(x => x.name).sort();
    assert.deepEqual(nombres, ['anotar_en_bitacora', 'crear_borrador_tarea', 'marcar_paso', 'pedir_bloqueo', 'registrar_trabajo', 'ver_agenda', 'ver_mi_tarea', 'ver_tareas']);
    assert.ok(!nombres.some(n => /aprob|enviar|publicar|borrar|eliminar|estado|prioridad/.test(n)), 'ninguna herramienta aprueba, envía, borra ni cambia estado o prioridad');
    for (const n of nombres) assert.equal(kindOf(`mcp__tareas__${n}`), 'read', 'el candado de envío trata a Tareas como interno');
    const mi = texto(await llamar('ver_mi_tarea', {})); assert.match(mi, /PASOS:\n1\. \[ \] Leer la nota \(id (p\w+)\)/);
    const paso = /\(id (p\w+)\)/.exec(mi)[1];
    assert.match(texto(await llamar('marcar_paso', { paso, nota: 'precio en la nota de ofertas' })), /Pasos 1\/2/);
    assert.match(texto(await llamar('anotar_en_bitacora', { texto: 'usé la plantilla de fichas' })), /Anotado/);
    const ajena = await o.api('POST', `/api/tareas/${otra.id}/paso`, { paso: 'x', por: 'agente', agente: 'piper' }); assert.equal(ajena.status, 403);
    assert.match(texto(await llamar('ver_agenda', { mia: true })), /EN CURSO \(1\)/);
    assert.match(texto(await llamar('ver_tareas', { buscar: 'otra' })), new RegExp(otra.id));
    const bl = texto(await llamar('pedir_bloqueo', { porque: 'falta el precio de los lentes' })); assert.match(bl, /espera a el dueño/);
    const tras = o.alm.load(), yo = tras.find(x => x.id === t.id), para = tras.find(x => x.id === yo.bloqueadaPor[0]);
    assert.equal(para.person, 'Tú'); assert.equal(para.prioridad, 'alta'); assert.match(para.title, /^Para ti: falta el precio/);
    assert.ok(yo.pidioBloqueo && yo.notas.some(n => /Bloqueada/.test(n.texto)));
    assert.ok(o.avisos.some(a => a.k === 'bloqueo'));
    const idea = texto(await llamar('crear_borrador_tarea', { dept: 'emails', texto: 'Correo del lanzamiento', porque: 'sale el lunes' }));
    assert.match(idea, /IDEA/); const nueva = o.alm.load().find(x => x.text === 'Correo del lanzamiento'); assert.equal(nueva.state, 'idea'); assert.equal(nueva.agent, 'ema'); assert.equal(nueva.agenteOrigen, 'piper');
    assert.match(texto(await llamar('registrar_trabajo', { texto: 'Revisé las fichas viejas' })), /Registrado/);
    assert.equal(o.alm.load().find(x => x.text === 'Revisé las fichas viejas').state, 'done');
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/estado`, { a: 'done', por: 'agente', agente: 'piper' })).status, 403, 'un agente no cierra ni aprueba');
  } finally { p.kill(); o.cerrar(); }
});
