// Plan D (7 oct 2026): las TAREAS DEL DUEÑO — lo puro (sus listas, el tablero personal, qué puede tomar o delegar, cómo lo leen los
// agentes y Dimitri), las rutas (/api/tareas/mias, tomar, delegar, empezar, sugerir) sobre una oficina temporal, el MCP de los agentes
// (sugerir_al_dueno, «DEL DUEÑO») y la vista (la pestaña Mías, la casilla redonda, el detalle en modo dueño).
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
import { crearRutasTareas } from '../tareas/rutas.mjs';
import { crearRutasDueno } from '../tareas/rutas-dueno.mjs';
import { crearTarea } from '../tareas/modelo.mjs';
import { visible, puede } from '../tareas/estados.mjs';
import { planear } from '../tareas/cola.mjs';
import { agenda, agendaTexto } from '../tareas/agenda.mjs';
import { deLista, cuentas, porFecha, columnaMia, movimientoMio, puedeTomar, puedeDelegar, origen, resumenDueno, dia } from '../tareas/dueno.mjs';
import { filaHTML } from '../src/tareas/comun.js';
import { miasHTML, railHTML, presetLista } from '../src/tareas/mias.js';
import { movimiento, columnaDe } from '../src/tareas/tablero.js';
import { filtrar } from '../src/tareas/lista.js';
import { inicioHTML } from '../src/tareas/inicio.js';
import { detalleHTML } from '../src/tareas/detalle.js';
import { parsePlan } from '../sub.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const H = 3600e3, AHORA = new Date('2026-10-07T11:00').getTime(), HOY = dia(AHORA), MANANA = dia(AHORA + 864e5);
const yo = (id, c = {}) => ({ id, state: 'next', person: 'Tú', title: 'Tarea ' + id, prioridad: 'media', addedAt: AHORA - H, ...c });

test('sus listas: Bandeja (sin fecha ni proyecto), Hoy (vence hoy, vencidas, haciendo), Próximos 7 días, Delegadas, Hechas y cada proyecto', () => {
  const l = [
    yo('b'), yo('h', { limite: HOY }), yo('v', { limite: dia(AHORA - 2 * 864e5) }), yo('e', { empezada: AHORA - H, limite: dia(AHORA + 5 * 864e5) }),
    yo('p', { limite: MANANA, prioridad: 'alta' }), yo('lejos', { limite: dia(AHORA + 20 * 864e5) }), yo('pr', { proyecto: 'pr-a' }),
    yo('s', { state: 'idea', sugeridaPor: 'piper' }), yo('hecha', { state: 'done', doneAt: AHORA - H }), yo('vieja', { state: 'done', doneAt: AHORA - 40 * 864e5 }),
    { id: 'ag', state: 'next', agent: 'piper', dept: 'sales', title: 'De un agente', prioridad: 'media' },
    { id: 'del', state: 'doing', agent: 'piper', dept: 'sales', title: 'Delegada', delegada: { at: AHORA - H, a: 'agente:piper' } },
    { id: 'delp', state: 'next', person: 'Ana', title: 'A Ana', delegada: { at: AHORA, a: 'persona:Ana' } },
    yo('arch', { archived: true }),
  ];
  const ids = (k, campo = 'pendientes') => deLista(l, k, { ahora: AHORA })[campo].map(t => t.id);
  assert.deepEqual(ids('bandeja'), ['b', 's'], 'sin fecha ni proyecto; una sugerencia también entra; lo archivado no');
  assert.deepEqual(ids('hoy'), ['e', 'v', 'h'], 'lo que estás haciendo primero; luego la vencida (fecha más vieja) y lo de hoy');
  assert.deepEqual(ids('hoy', 'hechas'), ['hecha']);
  assert.deepEqual(ids('proximos'), ['p', 'e'], 'por día: mañana antes que el día 5');
  assert.ok(!ids('todas').includes('ag'), 'lo de un agente no es tuyo');
  assert.deepEqual(ids('delegadas'), ['delp', 'del'], 'lo que pasaste a otro, lo último primero');
  assert.deepEqual(ids('hechas', 'hechas'), ['hecha'], 'treinta días');
  assert.deepEqual(ids('p:pr-a'), ['pr']);
  const n = cuentas(l, { ahora: AHORA });
  assert.equal(n.hoy, 3); assert.equal(n.vencidas, 1); assert.equal(n.bandeja, 2); assert.equal(n.delegadas, 2); assert.equal(n.hechasHoy, 1); assert.deepEqual(n.proyectos, { 'pr-a': 1 });
  assert.deepEqual(porFecha(deLista(l, 'todas', { ahora: AHORA }).pendientes, AHORA).map(g => g.k), ['vencidas', 'hoy', 'manana', 'semana', 'despues', 'sin']);
  assert.deepEqual(presetLista('hoy', AHORA), { limite: HOY }); assert.deepEqual(presetLista('proximos', AHORA), { limite: MANANA }); assert.deepEqual(presetLista('p:pr-a'), { proyecto: 'pr-a' }); assert.deepEqual(presetLista('bandeja'), {});
});

test('el estado «Tuya», la cola no la arranca, y los agentes la leen como DEL DUEÑO', () => {
  assert.equal(visible(yo('a')), 'tuya'); assert.equal(visible({ state: 'next', person: 'Ana' }), 'en_manos');
  assert.equal(visible(yo('a', { bloqueadaPor: ['x'] }), new Map([['x', { id: 'x', state: 'next' }]])), 'bloqueada', 'bloqueada gana');
  assert.deepEqual(planear([yo('a')], { max: 3 }).arrancar, [], 'una tarea tuya nunca la arranca un agente');
  assert.equal(puede('waiting', 'next', 'dueno').ok, true, '«Lo termino yo»'); assert.equal(puede('waiting', 'next', 'agente').ok, false);
  const a = agenda([yo('a', { limite: HOY }), { id: 'b', state: 'next', agent: 'piper', title: 'Suya', limite: HOY }], { ahora: AHORA });
  const txt = agendaTexto(a, { nombre: id => id.toUpperCase() });
  assert.match(txt, /«Tarea a» · DEL DUEÑO \(la hace él\)/); assert.match(txt, /«Suya» · PIPER/);
  assert.deepEqual(agenda([yo('a', { agent: 'piper', limite: HOY })], { ahora: AHORA, agente: 'piper' }).hoy, [], 'lo que tiene el dueño no sale en la agenda del agente');
  const r = resumenDueno([yo('v', { limite: dia(AHORA - 864e5) }), yo('e', { empezada: AHORA }), yo('s', { state: 'idea', sugeridaPor: 'piper' }), { id: 'd', state: 'doing', agent: 'piper', title: 'Encuesta', delegada: { at: AHORA, a: 'agente:piper' } }], { ahora: AHORA, nombre: id => id.toUpperCase() });
  assert.match(r, /1 vencidas: «Tarea v» \(v\)/); assert.match(r, /haciendo: «Tarea e»/); assert.match(r, /te sugirieron los agentes: «Tarea s» \(de PIPER\)/); assert.match(r, /Delegó y siguen abiertas: «Encuesta» a PIPER \(en curso\)/);
  assert.match(resumenDueno([], { ahora: AHORA }), /no tiene nada abierto/);
});

test('qué puede tomar y delegar; de dónde vino; el tablero personal', () => {
  assert.equal(puedeTomar({ state: 'next', agent: 'piper' }).ok, true); assert.equal(puedeTomar({ state: 'waiting', agent: 'piper' }).ok, true);
  assert.equal(puedeTomar({ state: 'done', error: true, agent: 'piper' }).ok, true, 'una que falló: la terminas tú');
  assert.match(puedeTomar({ state: 'doing', agent: 'piper' }).motivo, /trabajando/); assert.match(puedeTomar({ state: 'done', agent: 'piper' }).motivo, /hecha/);
  assert.match(puedeTomar({ state: 'next', routine: 'r1' }).motivo, /rutina/); assert.match(puedeTomar(yo('a')).motivo, /ya es tuya/); assert.equal(puedeTomar({ state: 'next', team: { lead: 'x' } }).ok, false);
  assert.equal(puedeDelegar(yo('a')).ok, true); assert.equal(puedeDelegar({ state: 'next', agent: 'piper' }).ok, false); assert.equal(puedeDelegar(yo('a', { state: 'done' })).ok, false);
  assert.equal(origen(yo('a', { sugeridaPor: 'p' })), 'sugerida'); assert.equal(origen(yo('a', { tomada: { at: 1 }, deAgente: 'p' })), 'tomada'); assert.equal(origen(yo('a', { deAgente: 'p' })), 'pasada'); assert.equal(origen(yo('a')), 'propia');
  assert.equal(columnaMia(yo('a')), 'porhacer'); assert.equal(columnaMia(yo('a', { empezada: 1 })), 'haciendo'); assert.equal(columnaMia(yo('a', { state: 'done' })), 'hecha');
  assert.equal(movimientoMio('porhacer', 'haciendo').accion, 'empezar'); assert.equal(movimientoMio('haciendo', 'porhacer').accion, 'pausar'); assert.equal(movimientoMio('haciendo', 'hecha').accion, 'hecha'); assert.equal(movimientoMio('hecha', 'porhacer').accion, 'reabrir');
  assert.equal(movimientoMio('hecha', 'haciendo'), null); assert.equal(movimientoMio('porhacer', 'porhacer').accion, 'orden');
  // el tablero de la oficina: una columna para lo tuyo y lo de personas; soltar ahí = «Lo hago yo»
  assert.equal(columnaDe(yo('a'), new Map()), 'personas'); assert.equal(columnaDe({ state: 'next', person: 'Ana' }, new Map()), 'personas');
  assert.equal(movimiento({ state: 'next', agent: 'p' }, 'cola', 'personas').accion, 'tomar'); assert.equal(movimiento({ state: 'next', routine: 'r' }, 'cola', 'personas'), null);
  assert.equal(movimiento(yo('a', { deAgente: 'p' }), 'personas', 'cola').accion, 'devolver'); assert.equal(movimiento(yo('a'), 'personas', 'cola'), null, 'una tarea tuya de siempre se delega desde su detalle');
  assert.equal(movimiento(yo('a'), 'personas', 'hecha').accion, 'hecha');
});

/* ---------- las rutas, sobre una oficina temporal ---------- */
function oficina({ enrutar = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-dueno-')), file = path.join(dir, 'tasks.json');
  const bus = crearBus(), alm = crearAlmacenTareas({ file, dataDir: dir, bus }), cat = crearCatalogo({ dataDir: dir });
  const avisos = [], personasAvisadas = []; let pumps = 0, n = 0;
  const agentes = [{ id: 'piper', department: 'sales', name: 'PIPER' }, { id: 'sam', department: 'sales', lead: true, name: 'SAM' }, { id: 'ema', department: 'emails', lead: true, name: 'EMA' }];
  const altaTarea = (c, { por, id } = {}) => { const t = crearTarea(c, { id: id || (() => 'tk' + (++n).toString().padStart(3, '0')) }); const l = alm.load(); l.push(t); alm.save(l, { por }); return t; };
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  const comun = { alm, cat, json, body, pump: () => { pumps++; }, agentes, depts: { sales: { name: 'Ventas' }, emails: { name: 'Correos' } }, leadOf: d => agentes.find(a => a.department === d && a.lead), avisar: (k, t, o) => avisos.push({ k, t, o }), altaTarea, nombre: id => agentes.find(a => a.id === id)?.name || id };
  const rutas = crearRutasTareas(comun);
  const dueno = crearRutasDueno({ ...comun, personas: () => ['Ana'], avisarPersona: (p, t) => personasAvisadas.push([p, t]), enrutar, adivinarOk: () => false, exigeOk: t => /\$\s?\d{4,}/.test(t) });
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/tasks') return json(res, 200, alm.load());
    if (!(await dueno(req, res, url) || await rutas(req, res, url))) json(res, 404, { error: 'no' });
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const api = async (m, p, b) => { const x = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: x.status, ...(await x.json()) }; };
    r({ dir, alm, cat, avisos, personasAvisadas, altaTarea, api, base, pumps: () => pumps, una: id => alm.load().find(t => t.id === id), cerrar: () => { srv.close(); fs.rmSync(dir, { recursive: true, force: true }); } });
  }));
}

test('tus tareas por la API: crearla (sin agente), empezarla, hacerla, reabrirla; un agente no te crea tareas', async () => {
  const o = await oficina();
  try {
    const r = await o.api('POST', '/api/tareas/mias', { title: 'Llamar al banco', prioridad: 'alta', at: new Date('2026-10-09T10:30').getTime(), notas: 'Pedir la tasa' });
    assert.equal(r.status, 200); const t = o.una(r.tarea.id);
    assert.equal(t.person, 'Tú'); assert.equal(t.agent, undefined); assert.equal(t.dept, undefined); assert.equal(t.limite, '2026-10-09T10:30', '«el jueves a las 10:30» es la hora a la que la tienes'); assert.equal(t.text, 'Pedir la tasa'); assert.equal(o.pumps(), 0, 'no despierta a la cola');
    assert.equal((await o.api('POST', '/api/tareas/mias', { title: '' })).status, 400);
    assert.equal((await o.api('POST', '/api/tareas/mias', { title: 'X', dept: 'sales' })).tarea.dept, 'sales', 'el área es opcional');
    assert.equal((await o.api('POST', '/api/tareas/mias', { title: 'X', por: 'agente', agente: 'piper' })).status, 403);
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/empezar`, {})).status, 200);
    let x = o.una(t.id); assert.ok(x.empezada); assert.equal(x.cronometro.length, 1); assert.ok(!x.cronometro[0].fin, 'su cronómetro corre');
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/empezar`, { empezar: false })).status, 200); x = o.una(t.id); assert.equal(x.empezada, undefined); assert.ok(x.cronometro[0].fin, 'dejarla para luego para el reloj');
    await o.api('POST', `/api/tareas/${t.id}/empezar`, {});
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/estado`, { a: 'done' })).status, 200);
    x = o.una(t.id); assert.equal(x.state, 'done'); assert.equal(x.hechaPor, 'Tú'); assert.equal(x.result, 'Hecha por ti.'); assert.equal(x.empezada, undefined); assert.ok(x.cronometro.every(c => c.fin), 'hecha para el cronómetro');
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/estado`, { a: 'next' })).status, 200); x = o.una(t.id); assert.equal(x.state, 'next'); assert.equal(x.result, undefined); assert.equal(x.hechaPor, undefined);
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/empezar`, { por: 'agente', agente: 'piper' })).status, 403, 'un agente no toca lo tuyo');
    const ag = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Suya' });
    assert.equal((await o.api('POST', `/api/tareas/${ag.id}/empezar`, {})).status, 409, 'solo empiezas una tarea tuya');
    const mias = await o.api('GET', '/api/tareas/mias'); assert.equal(mias.status, 200); assert.ok(mias.listas.todas.pendientes.some(p => p.id === t.id)); assert.match(mias.texto, /Las tareas del dueño/);
  } finally { o.cerrar(); }
});

test('«Lo hago yo»: tomar la tarea de un agente (en cola, programada, con borrador, fallida); DESHACER la devuelve como estaba', async () => {
  const o = await oficina();
  try {
    const a = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Propuesta Acme' });
    const r = await o.api('POST', `/api/tareas/${a.id}/tomar`, { nota: 'esta la cierro yo' }); assert.equal(r.status, 200);
    let x = o.una(a.id); assert.equal(x.person, 'Tú'); assert.equal(x.agent, undefined, 'ya no es de ningún escritorio'); assert.equal(x.deAgente, 'piper'); assert.ok(x.tomada); assert.equal(x.comments.at(-1).text, 'esta la cierro yo');
    assert.equal((await o.api('POST', `/api/tareas/${a.id}/tomar`, {})).status, 409, 'ya es tuya');
    // DESHACER: vuelve a Piper como estaba, sin marcas de «delegada»
    assert.equal((await o.api('POST', `/api/tareas/${a.id}/delegar`, { a: 'agente', dept: 'sales', agente: 'piper', deshacer: true })).status, 200);
    x = o.una(a.id); assert.equal(x.agent, 'piper'); assert.equal(x.person, undefined); assert.equal(x.delegada, undefined); assert.equal(x.tomada, undefined); assert.equal(x.deAgente, undefined);
    // programada: su hora pasa a ser la de la fecha límite; deshacer se la devuelve
    const dueAt = new Date('2030-01-02T09:15').getTime(); const p = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Programada', dueAt });
    await o.api('POST', `/api/tareas/${p.id}/tomar`, {}); x = o.una(p.id); assert.equal(x.limite, '2030-01-02T09:15'); assert.equal(x.dueAt, undefined); assert.equal(x.state, 'next');
    await o.api('POST', `/api/tareas/${p.id}/delegar`, { a: 'agente', dept: 'sales', agente: 'piper', deshacer: true, estado: 'scheduled', dueAt });
    x = o.una(p.id); assert.equal(x.state, 'scheduled'); assert.equal(x.dueAt, dueAt); assert.equal(x.limite, undefined, 'la fecha que salió de su hora se va');
    // un borrador que esperaba tu OK: lo terminas tú, con el borrador del agente a mano
    const w = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Con borrador' }); o.alm.cambiar(w.id, t => { Object.assign(t, { state: 'waiting', draft: 'Hola Acme…', result: 'Hola Acme…', waitingAt: 1, ask: '¿Lo mando?' }); });
    await o.api('POST', `/api/tareas/${w.id}/tomar`, {}); x = o.una(w.id); assert.equal(x.state, 'next'); assert.equal(x.borradorAgente, 'Hola Acme…'); assert.equal(x.waitingAt, undefined); assert.equal(x.ask, undefined);
    // una que falló
    const f = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Falló' }); o.alm.cambiar(f.id, t => { Object.assign(t, { state: 'done', error: true, doneAt: 1, result: 'No pude: el CRM no responde.' }); });
    await o.api('POST', `/api/tareas/${f.id}/tomar`, {}); x = o.una(f.id); assert.equal(x.state, 'next'); assert.equal(x.error, undefined); assert.equal(x.borradorAgente, 'No pude: el CRM no responde.');
    const d = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Corriendo' }); o.alm.cambiar(d.id, t => { t.state = 'doing'; });
    assert.equal((await o.api('POST', `/api/tareas/${d.id}/tomar`, {})).status, 409, 'lo que está en curso no se toma');
    assert.equal((await o.api('POST', `/api/tareas/${a.id}/tomar`, { por: 'agente', agente: 'sam' })).status, 403, 'un agente no toma nada');
  } finally { o.cerrar(); }
});

test('delegar: al agente que elijas, al que la tenía, al que elija el enrutador (o al jefe), o a una persona; con tu nota', async () => {
  const llamadas = []; const o = await oficina({ enrutar: async (dept, texto) => { llamadas.push([dept, texto]); return { agent: 'piper', plan: ['Leer', 'Escribir'], needsOk: true }; } });
  try {
    const t = (await o.api('POST', '/api/tareas/mias', { title: 'Responder a Óptica Sol', empezar: true })).tarea;
    let r = await o.api('POST', `/api/tareas/${t.id}/delegar`, { a: 'agente', dept: 'sales', nota: 'precio mayorista de la nota de ofertas' });
    assert.equal(r.status, 200); assert.equal(r.como, 'enrutador'); assert.equal(r.a, 'piper'); assert.equal(llamadas[0][0], 'sales'); assert.match(llamadas[0][1], /Nota del dueño al delegarla: precio mayorista/);
    let x = o.una(t.id); assert.equal(x.agent, 'piper'); assert.equal(x.dept, 'sales'); assert.equal(x.person, undefined); assert.equal(x.state, 'next'); assert.equal(x.empezada, undefined); assert.ok(x.cronometro.every(c => c.fin), 'tu reloj para');
    assert.equal(x.pasos.length, 2, 'el plan del enrutador'); assert.equal(x.needsOk, true); assert.equal(x.delegada.a, 'agente:piper'); assert.match(x.text, /Nota del dueño/); assert.ok(o.pumps() > 0, 'la cola la arranca');
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/delegar`, { a: 'agente', dept: 'sales' })).status, 409, 'ya no es tuya');
    assert.deepEqual(deLista(o.alm.load(), 'delegadas').pendientes.map(z => z.id), [t.id], 'la sigues en Delegadas');
    // DESHACER de delegar: vuelve a tu lista
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/tomar`, { deshacer: true })).status, 200); x = o.una(t.id); assert.equal(x.person, 'Tú'); assert.equal(x.delegada, undefined); assert.equal(x.tomada, undefined); assert.equal(x.deAgente, undefined);
    // al agente que elijas; uno de otro departamento no
    assert.equal((await o.api('POST', `/api/tareas/${t.id}/delegar`, { a: 'agente', dept: 'emails', agente: 'piper' })).status, 400);
    r = await o.api('POST', `/api/tareas/${t.id}/delegar`, { a: 'agente', dept: 'emails', agente: 'ema', needsOk: false }); assert.equal(r.como, 'elegido'); assert.equal(o.una(t.id).needsOk, false);
    // la que vino de un agente vuelve a él
    const a = o.altaTarea({ dept: 'sales', agent: 'sam', text: 'Del jefe' }); await o.api('POST', `/api/tareas/${a.id}/tomar`, {});
    r = await o.api('POST', `/api/tareas/${a.id}/delegar`, { a: 'agente' }); assert.equal(r.como, 'devuelta'); assert.equal(o.una(a.id).agent, 'sam'); assert.equal(llamadas.length, 1, 'sin enrutador');
    // un importe por encima del tope espera el OK siempre
    const caro = (await o.api('POST', '/api/tareas/mias', { title: 'Pagar al proveedor $ 5000' })).tarea;
    await o.api('POST', `/api/tareas/${caro.id}/delegar`, { a: 'agente', dept: 'sales', agente: 'piper', needsOk: false }); assert.equal(o.una(caro.id).needsOk, true);
    // a una persona
    const q = (await o.api('POST', '/api/tareas/mias', { title: 'Ir al banco' })).tarea;
    assert.equal((await o.api('POST', `/api/tareas/${q.id}/delegar`, { a: 'persona', persona: 'Nadie' })).status, 400);
    r = await o.api('POST', `/api/tareas/${q.id}/delegar`, { a: 'persona', persona: 'Ana', nota: 'antes de las 12' }); assert.equal(r.status, 200);
    x = o.una(q.id); assert.equal(x.person, 'Ana'); assert.equal(x.delegada.a, 'persona:Ana'); assert.deepEqual(o.personasAvisadas.at(-1), ['Ana', '👤 El dueño te pasó «Ir al banco»: antes de las 12.']);
    assert.equal((await o.api('POST', `/api/tareas/${q.id}/delegar`, { a: 'agente', dept: 'sales', por: 'dimitri' })).status, 403, 'delegar lo decide el dueño');
  } finally { o.cerrar(); }
});

test('el MCP: un agente ve lo tuyo como DEL DUEÑO, te SUGIERE algo (nace idea en tu Bandeja, cinco como mucho) y no te crea tareas', async () => {
  const o = await oficina();
  const mia = (await o.api('POST', '/api/tareas/mias', { title: 'Firmar el contrato' })).tarea;
  const suya = o.altaTarea({ dept: 'sales', agent: 'piper', text: 'Ficha' }); o.alm.cambiar(suya.id, t => { t.state = 'doing'; });
  const p = spawn(process.execPath, [path.join(ROOT, 'tareas-mcp.mjs')], { env: { ...process.env, AO_OFFICE: o.base, AO_AGENT: 'piper', AO_TASK: suya.id }, stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '', seq = 0; const pend = new Map();
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); pend.get(m.id)?.(m); } });
  const rpc = (method, params) => new Promise(r => { const id = ++seq; pend.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  const llamar = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result.content[0].text;
  try {
    const init = await rpc('initialize', {}); assert.match(init.result.instructions, /DEL DUEÑO/);
    assert.match(await llamar('ver_tareas', {}), new RegExp(`${mia.id} · «Firmar el contrato» · en cola · DEL DUEÑO`));
    const solo = await llamar('ver_tareas', { del_dueno: true }); assert.match(solo, /Firmar el contrato/); assert.doesNotMatch(solo, /Ficha/);
    assert.match(await llamar('sugerir_al_dueno', { texto: 'Llamar a Óptica Sol: preguntaron dos veces', porque: 'quieren precio mayorista', titulo: 'Llamar a Óptica Sol' }), /Bandeja del dueño/);
    const s = o.alm.load().find(t => t.title === 'Llamar a Óptica Sol');
    assert.equal(s.state, 'idea'); assert.equal(s.person, 'Tú'); assert.equal(s.sugeridaPor, 'piper'); assert.equal(s.agent, undefined); assert.equal(s.dept, 'sales'); assert.match(s.text, /Por qué: quieren precio mayorista/);
    assert.ok(o.avisos.some(a => a.k === 'sugerencia' && /PIPER te sugiere/.test(a.t)));
    assert.deepEqual(deLista(o.alm.load(), 'bandeja').pendientes.map(t => t.id).sort(), [mia.id, s.id].sort());
    for (let i = 0; i < 4; i++) await llamar('sugerir_al_dueno', { texto: 'Otra ' + i, porque: 'x' });
    assert.match(await llamar('sugerir_al_dueno', { texto: 'La sexta', porque: 'x' }), /No se pudo: ya le dejaste 5 sugerencias/);
    assert.equal((await o.api('POST', '/api/tareas/sugerir', { texto: 'Yo mismo' })).status, 403, 'el dueño añade sus tareas, no se las sugiere');
    assert.equal((await o.api('POST', `/api/tareas/${s.id}/estado`, { a: 'next' })).status, 200, 'aceptarla'); assert.equal(o.una(s.id).state, 'next');
    // pedir_bloqueo sin tarea: nace una tarea TUYA (sin escritorio), para hoy
    await llamar('pedir_bloqueo', { porque: 'falta el precio' });
    const para = o.alm.load().find(t => /^Para ti: falta el precio/.test(t.title)); assert.equal(para.person, 'Tú'); assert.equal(para.agent, undefined); assert.equal(para.deAgente, 'piper'); assert.equal(para.limite, dia(Date.now()));
  } finally { p.kill(); o.cerrar(); }
});

/* ---------- la vista ---------- */
const ctxDe = tareas => ({ porId: new Map(tareas.map(t => [t.id, t])), agente: id => ({ piper: { id: 'piper', name: 'PIPER', dept: 'sales' }, sam: { id: 'sam', name: 'SAM', dept: 'sales', lead: true } })[id], depto: k => ({ sales: { name: 'VENTAS', short: 'VENTAS', chip: '#eee' } })[k],
  deptKeys: ['sales'], proyecto: id => (id === 'pr-a' ? { id, nombre: 'Lentes', color: 'azul' } : null), etiqueta: () => null, proyectos: () => [{ id: 'pr-a', nombre: 'Lentes', color: 'azul' }], etiquetas: () => [], tareas: () => tareas,
  agentesDe: () => [{ id: 'piper', name: 'PIPER', dept: 'sales' }, { id: 'sam', name: 'SAM', dept: 'sales', lead: true }], personas: () => ['Ana'], quienSoy: () => 'Tú', prefCampos: () => ({ orden: [], ocultos: [] }), enOficina: true });

test('la pestaña Mías: el rail con sus números, la casilla redonda, «+ Añadir tarea», COMPLETADAS · N y el tablero personal', () => {
  const hoy = dia(Date.now());
  const l = [yo('a', { title: 'Llamar <al> banco', limite: hoy, empezada: Date.now() }), yo('b', { title: 'Visitar la feria', proyecto: 'pr-a', deAgente: 'piper', tomada: { at: 1 } }), yo('c', { state: 'done', doneAt: Date.now(), title: 'Pagar la luz' }), yo('s', { state: 'idea', sugeridaPor: 'piper', title: 'Llamar a Óptica Sol' }), { id: 'd', state: 'doing', agent: 'piper', title: 'Encuesta', delegada: { at: Date.now(), a: 'agente:piper' } }];
  const c = ctxDe(l);
  const rail = railHTML(l, c, { lista: 'hoy' });
  assert.match(rail, /data-mlista="hoy" aria-current="true">.*<span>Hoy<\/span><b>1<\/b>/); assert.match(rail, /data-mlista="p:pr-a"/); assert.match(rail, /<span>Delegadas<\/span><b>1<\/b>/);
  const h = miasHTML(l, c, { lista: 'hoy' });
  assert.match(h, /class="tv-hck" data-hecha="a" aria-label="Marcar hecha «Llamar &lt;al&gt; banco»"/); assert.match(h, /▶ Haciendo/); assert.match(h, /data-madd placeholder="Añadir tarea para hoy/);
  assert.match(h, /COMPLETADAS · 1/); assert.match(h, /data-hecha="c" aria-label="Reabrir «Pagar la luz»" checked/); assert.match(h, /1\/2/, 'hechas/total');
  assert.doesNotMatch(h, /<button[^>]*>[^<]*<button/, 'un botón nunca dentro de otro');
  const b = miasHTML(l, c, { lista: 'bandeja' }); assert.match(b, /Sugerida por PIPER/); assert.match(b, /data-aceptar="s"/); assert.doesNotMatch(b, /data-hecha="s"/, 'una sugerencia se acepta antes de hacerla');
  const p = miasHTML(l, c, { lista: 'p:pr-a' }); assert.match(p, /de PIPER/); assert.match(p, /<h2>Lentes<\/h2>/);
  const d = miasHTML(l, c, { lista: 'delegadas' }); assert.match(d, /→ PIPER/); assert.match(d, /En curso/); assert.doesNotMatch(d, /data-hecha=/); assert.doesNotMatch(d, /data-mmodo/, 'Delegadas no tiene tablero');
  const tb = miasHTML(l, c, { lista: 'todas', modo: 'tablero' });
  assert.match(tb, /data-mcol="porhacer"/); assert.match(tb, /data-mcol="haciendo"[^>]*>[\s\S]*data-t="a"/); assert.match(tb, /data-mcol="hecha"[\s\S]*data-t="c"/);
  assert.match(filaHTML(yo('x'), c), /tv-c-tuya"[^>]*>Tuya/, 'fuera de Mías, la fila dice que es tuya');
});

test('Inicio, Lista y el detalle: lo tuyo aparte, el filtro «Quién», y el detalle en modo dueño («Delegar…», «Lo hago yo»)', () => {
  const hoy = dia(Date.now());
  const l = [yo('a', { title: 'Lo mío', limite: hoy }), { id: 'g', state: 'next', agent: 'piper', dept: 'sales', title: 'Lo del agente', limite: hoy, prioridad: 'media' }, { id: 'n', state: 'next', person: 'Ana', title: 'De Ana', prioridad: 'media' }];
  const c = ctxDe(l);
  const ini = inicioHTML(l, c, new Set());
  assert.match(ini, /Lo tuyo hoy[\s\S]*data-hecha="a"[\s\S]*data-irmias="hoy"/); assert.match(ini, /Hoy en la oficina[\s\S]*data-t="g"/);
  assert.equal((ini.match(/data-t="a"/g) || []).length, 1, 'lo tuyo no sale dos veces');
  assert.deepEqual(filtrar(l, { quien: 'yo' }, c).map(t => t.id), ['a']); assert.deepEqual(filtrar(l, { quien: 'agentes' }, c).map(t => t.id), ['g']); assert.deepEqual(filtrar(l, { quien: 'personas' }, c).map(t => t.id), ['n']);
  const dm = detalleHTML({ tarea: yo('a', { deAgente: 'piper', tomada: { at: Date.now() } }), bitacora: [] }, c);
  assert.match(dm, /data-acc="hecha-mia"/); assert.match(dm, /data-acc="empezar"/); assert.match(dm, /data-acc="delegar"/); assert.match(dm, /data-acc="devolver-agente">Devolver a PIPER/);
  assert.match(dm, /class="tv-delegar" hidden/); assert.match(dm, /<option value="piper" selected>PIPER — la tenía/); assert.match(dm, /data-c="dept"/); assert.match(dm, /La tomaste de <b>PIPER<\/b>/);
  assert.doesNotMatch(dm, /data-acc="ejecutar"/); assert.doesNotMatch(dm, /aria-label="Agente"/); assert.doesNotMatch(dm, /data-acc="oficina"/, 'sin escritorio no hay panel de la oficina');
  const dg = detalleHTML({ tarea: l[1], bitacora: [] }, c); assert.match(dg, /data-acc="tomar">Lo hago yo/); assert.match(dg, /data-acc="ejecutar"/);
  const dw = detalleHTML({ tarea: { ...l[1], state: 'waiting', draft: 'Borrador' }, bitacora: [] }, c); assert.match(dw, /data-acc="tomar">Lo termino yo/);
  const ds = detalleHTML({ tarea: yo('s', { state: 'idea', sugeridaPor: 'piper', why: 'escribieron dos veces' }), bitacora: [] }, c); assert.match(ds, /data-acc="aceptar">Aceptar/); assert.match(ds, /Te la sugiere <b>PIPER<\/b>: escribieron dos veces/);
  assert.doesNotMatch(dm, /<button[^>]*>[^<]*<button/, 'un botón nunca dentro de otro');
});

test('Dimitri: una pieza puede ser para el dueño en persona («dueno»), sin equipo', () => {
  const p = parsePlan(JSON.stringify({ mode: 'plan', reply: 'Hecho', tasks: [{ dept: 'dueno', title: 'Llamar a Óptica Sol', instruction: 'Llámalos hoy', team: true, limite: '2026-10-08' }, { dept: 'sales', title: 'Propuesta', instruction: 'Escribe la propuesta' }] }), { depts: { sales: { name: 'Ventas' }, brain: {} }, agents: [{ id: 'sam', department: 'sales', lead: true }] });
  assert.equal(p.tasks.length, 2); assert.equal(p.tasks[0].dept, 'dueno'); assert.equal(p.tasks[0].lead, null); assert.equal(p.tasks[0].team, false); assert.equal(p.tasks[0].limite, '2026-10-08'); assert.equal(p.tasks[1].lead, 'sam');
});
