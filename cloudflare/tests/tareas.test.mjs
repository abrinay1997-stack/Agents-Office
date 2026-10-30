// Fase 3: tareas, rutinas y calendario en el Worker — contra una D1 de verdad en memoria (con las migraciones reales).
// La paridad con la oficina local (misma forma de respuesta que serve.mjs) está en tests/nube-paridad-tareas.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { manejar } from '../worker/lib/rutas.js';
import { MODULOS } from '../worker/modulos/index.js';
import * as TAREAS from '../worker/modulos/tareas.js';
import { abrirSesion, conSesion, cargarTareas } from '../worker/lib/tareas/sesion.js';
import { instalarZona, desfase, DateReal } from '../worker/lib/zona.js'; // la zona vive en lib/zona.js (una sola, también para Contenido)
import { guardarDoc } from '../worker/lib/almacen.js';
import { idDeEjecucion, parcharRutina, DOC_ESTADO } from '../worker/lib/tareas/rutinas.js';
import { crearTarea } from '../../tareas/modelo.mjs';
import { dia } from '../../tareas/dueno.mjs';
import { exportar } from '../../scripts/migrar/tareas.mjs';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';

const RUTA_IA = { agent: 'piper', title: 'Armar la propuesta', plan: ['Leer', 'Escribir'], eta_minutes: 20, why: 'es de ventas', needs_ok: true };
const iaFalsa = (respuesta = RUTA_IA) => async () => new Response(JSON.stringify({ content: [{ type: 'text', text: typeof respuesta === 'string' ? respuesta : JSON.stringify(respuesta) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });

async function oficina({ ia = true } = {}) {
  instalarZona('America/Panama');
  const d1 = crearD1(); const admin = await sembrar(d1);
  const editor = await sembrar(d1, { email: 'editor@panaclaw.test', rol: 'editor' });
  const lectura = await sembrar(d1, { email: 'lee@panaclaw.test', rol: 'lectura' });
  const env = envDePrueba(d1, ia ? { ANTHROPIC_API_KEY: 'k', __pruebas: { fetchIA: iaFalsa() } } : {});
  const entrar = async u => (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: u.email, contrasena: u.clave } })).headers.get('set-cookie').split(';')[0];
  const cookies = { admin: await entrar(admin), editor: await entrar(editor), lectura: await entrar(lectura) };
  const llamar = (quien = 'admin') => async (metodo, ruta, cuerpo, extra = {}) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', cookie: cookies[quien], ...extra }, body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) }), env);
    const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j, r };
  };
  return { d1, env, api: llamar('admin'), editor: llamar('editor'), lectura: llamar('lectura') };
}
const ids = l => l.map(t => t.id);

test('el módulo está registrado, declara sus grupos y los relojes', () => {
  assert.ok(MODULOS.includes(TAREAS));
  assert.deepEqual([...TAREAS.grupos].sort(), ['agents', 'calendar.ics', 'routines', 'tareas', 'tasks', 'team']);
  for (const f of ['manejar', 'cadaMinuto', 'tomarSiguiente', 'guardarEjecucion', 'altaTareaDb']) assert.equal(typeof TAREAS[f], 'function', f);
});

test('la zona horaria: la hora «local» de las tareas es la de Panamá aunque el Worker corra en UTC', () => {
  instalarZona('America/Panama');
  const t = DateReal.UTC(2026, 9, 26, 2, 30); // 25 oct, 21:30 en Panamá
  const d = new Date(t);
  assert.deepEqual([d.getDate(), d.getHours(), d.getDay()], [25, 21, 0]);
  assert.equal(desfase(t), -5 * 3600e3);
  assert.equal(new Date(2026, 9, 26, 9, 0).toISOString(), '2026-10-26T14:00:00.000Z'); // componentes locales → instante real
  assert.equal(new Date('2026-10-26T09:00').toISOString(), '2026-10-26T14:00:00.000Z'); // una hora sin zona se lee en la zona de la oficina
  assert.equal(new Date('2026-10-26T09:00:00Z').toISOString(), '2026-10-26T09:00:00.000Z'); // con zona explícita, nada cambia
  const e = new Date('2026-10-26T09:00'); e.setHours(17, 30); e.setDate(e.getDate() + 7);
  assert.equal(e.toISOString(), '2026-11-02T22:30:00.000Z');
  assert.equal(new Date(Date.UTC(2026, 9, 26)).getTime(), Date.UTC(2026, 9, 26)); // getTime y Date.now no se tocan
  assert.equal(instalarZona('Zona/Que/No/Existe'), 'America/Panama'); // una zona rota no tumba nada
});

test('permisos: sin sesión 401; «lectura» solo mira; el editor trabaja pero no crea rutinas ni cambia agentes; el admin todo', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await pedir(manejar, o.env, '/api/tasks')).status, 401);
  assert.equal((await o.lectura('GET', '/api/tasks')).status, 200);
  assert.equal((await o.lectura('GET', '/api/tareas/catalogo')).status, 200);
  for (const [m, r, b] of [['POST', '/api/tasks', { dept: 'ops', text: 'x' }], ['POST', '/api/tareas/mias', { title: 'x' }], ['POST', '/api/routines', { dept: 'ops', text: 'cada día a las 8, x' }], ['PATCH', '/api/agents/elead', { name: 'X' }]]) assert.equal((await o.lectura(m, r, b)).status, 403, r);
  assert.equal((await o.editor('POST', '/api/tasks', { dept: 'sales', text: 'Arma la propuesta para Acme' })).status, 200);
  assert.equal((await o.editor('POST', '/api/routines', { dept: 'ops', text: 'cada día hábil a las 8, revisa el correo' })).status, 403);
  assert.equal((await o.editor('PATCH', '/api/agents/elead', { name: 'X' })).status, 403);
  const creada = await o.api('POST', '/api/routines', { dept: 'sales', text: 'cada día hábil a las 8, revisa el correo' }); assert.equal(creada.status, 200);
  assert.equal((await o.editor('DELETE', '/api/routines/' + creada.j.routine.id)).status, 403);
  assert.equal((await o.editor('POST', '/api/routines/' + creada.j.routine.id + '/pause')).status, 200); // pausar sí puede
});

test('crear, listar y editar tareas: lo que la IA enruta, lo que no, y lo que el dueño no puede hacer con una tarea que ya empezó', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.api('POST', '/api/tasks', '{no es json')).status, 400);
  assert.equal((await o.api('POST', '/api/tasks', { dept: 'brain', text: 'x' })).j.error, 'departamento desconocido');
  assert.equal((await o.api('POST', '/api/tasks', { dept: 'sales', text: ' ' })).j.error, 'la tarea está vacía');
  assert.equal((await o.api('POST', '/api/tasks', { dept: 'sales', text: 'x', at: Date.now() - 3600e3 })).status, 400);
  const a = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Arma la propuesta de Acme por $5000' })).j;
  assert.deepEqual([a.agent, a.title, a.plan.length, a.state, a.dept], ['piper', 'Armar la propuesta', 2, 'next', 'sales']);
  assert.equal(a.version, 1);
  // un agente que la IA se inventa no existe: lo toma el jefe
  const o2 = await oficina(); o2.env.__pruebas = { fetchIA: iaFalsa({ ...RUTA_IA, agent: 'fantasma' }) };
  assert.equal((await o2.api('POST', '/api/tasks', { dept: 'sales', text: 'algo' })).j.agent, 'lexi');
  // y sin IA conectada también: el jefe, con el título del propio pedido
  const o3 = await oficina({ ia: false });
  const sin = (await o3.api('POST', '/api/tasks', { dept: 'ops', text: 'Revisa los pagos pendientes' })).j;
  assert.deepEqual([sin.agent, sin.title], ['olead', 'Revisa los pagos pendientes']); assert.match(sin.why, /no está conectado/);
  // una programada para el futuro
  const futuro = Date.now() + 2 * 864e5;
  const p = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Llama a Acme', at: futuro })).j;
  assert.deepEqual([p.state, p.dueAt], ['scheduled', futuro]);
  const ed = await o.api('PATCH', `/api/tasks/${p.id}`, { title: 'Llamar a Acme el viernes', prioridad: 'alta', etiquetas: [] });
  assert.deepEqual([ed.status, ed.j.title, ed.j.prioridad], [200, 'Llamar a Acme el viernes', 'alta']);
  assert.equal((await o.api('PATCH', `/api/tasks/${p.id}`, { at: null })).j.state, 'next'); // desprogramada: a la cola
  assert.equal((await o.api('PATCH', `/api/tasks/${p.id}`, { agent: 'nadie' })).status, 400);
  // empezó: ya no se edita
  await conSesion(o.d1, async s => { s.alm.cambiar(a.id, t => { t.state = 'doing'; }); });
  assert.equal((await o.api('PATCH', `/api/tasks/${a.id}`, { title: 'otro' })).status, 409);
  assert.equal((await o.api('DELETE', `/api/tasks/${a.id}`)).status, 409);
  assert.equal((await o.api('POST', `/api/tasks/${a.id}/archive`)).status, 409);
  // comentar menciona a una persona → un aviso para ella
  await guardarDoc(o.d1, 'tareas.config', { team: { people: [{ name: 'Ana', depts: ['sales'] }] } });
  const c = await o.api('POST', `/api/tasks/${p.id}/comment`, { text: 'ojo @Ana con esto' });
  assert.deepEqual([c.status, c.j.comments.length, c.j.comments[0].by], [200, 1, 'Tú']);
  const avisos = o.d1._db.prepare("select json from filas where coleccion = 'avisos'").all().map(r => JSON.parse(r.json));
  assert.ok(avisos.some(x => x.kind === 'persona' && x.persona === 'Ana'));
  assert.equal((await o.api('GET', '/api/team')).j.people[0].name, 'Ana');
  assert.equal((await o.api('POST', `/api/tasks/${p.id}/person`, { person: 'Nadie' })).status, 400);
  assert.equal((await o.api('POST', `/api/tasks/${p.id}/person`, { person: 'Ana', why: 'es de ella' })).j.person, 'Ana');
  assert.equal((await o.api('DELETE', `/api/tasks/${p.id}`)).status, 200);
  assert.equal((await o.api('GET', '/api/tasks')).j.length, 1);
  // lo que necesita a un agente contesta 501 con su motivo, no un error mudo
  // fase 4: aprobar/devolver/detener/corregir existen y contestan como la local (el detalle está en agentes-*.test.mjs): la tarea ya empezó: aprobar da 400, corregir 409 y detener la cierra
  for (const [m, r, st] of [['POST', `/api/tasks/${a.id}/approve`, 400], ['POST', `/api/tasks/${a.id}/revise`, 409], ['POST', `/api/tasks/${a.id}/stop`, 200]]) { const x = await o.api(m, r, { feedback: '' }); assert.equal(x.status, st, r); assert.notEqual(x.status, 501); }
});

test('GET /api/tasks: ?light=1, ETag y 304, y la cola dice por qué espera cada una', { skip: SALTAR }, async () => {
  const o = await oficina();
  await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Primera' }); await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Segunda' });
  const g = await o.api('GET', '/api/tasks?light=1');
  const tag = g.r.headers.get('etag'); assert.match(tag, /^"[0-9a-f]{20}"$/);
  assert.equal((await o.api('GET', '/api/tasks?light=1', undefined, { 'if-none-match': tag })).status, 304);
  assert.ok(g.j.every(t => t.queue && t.queue.pos >= 1));
  assert.deepEqual(g.j.map(t => t.queue.why).sort(), ['agente', 'turno']); // los dos son de piper: una arranca, la otra espera a que se libere
});

test('mezclar en vez de pisar: dos peticiones que cambian la misma tarea a la vez no se pierden; la ejecución de un agente respeta lo que hizo el dueño', { skip: SALTAR }, async () => {
  const o = await oficina();
  const t = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Arma la propuesta' })).j;
  // dos sesiones abiertas a la vez, las dos cambian la misma tarea
  const s1 = await abrirSesion(o.d1), s2 = await abrirSesion(o.d1);
  s1.alm.cambiar(t.id, x => { x.prioridad = 'alta'; }, { por: 'dueno' });
  s2.alm.cambiar(t.id, x => { x.etiquetas = ['e-x']; }, { por: 'dueno' });
  await s1.terminar();
  await assert.rejects(() => s2.terminar(), e => e.conflicto);
  const lineas = o.d1._db.prepare('select count(*) n from tarea_bitacora').get().n;
  assert.equal(lineas, 2, 'la bitácora de la sesión que perdió no se escribió'); // creada + prioridad
  const ahora = (await cargarTareas(o.d1))[0]; assert.deepEqual([ahora.prioridad, ahora.etiquetas, ahora.version], ['alta', undefined, 2]);
  // conSesion repite desde cero con la copia nueva: se juntan los dos cambios
  let intentos = 0;
  await Promise.all([
    conSesion(o.d1, async s => { intentos++; await new Promise(r => setTimeout(r, 5)); s.alm.cambiar(t.id, x => { x.estimacion = 30; }, { por: 'dueno' }); }),
    conSesion(o.d1, async s => { intentos++; s.alm.cambiar(t.id, x => { x.proyecto = 'pr-x'; }, { por: 'dueno' }); }),
  ]);
  const unidas = (await cargarTareas(o.d1))[0]; assert.deepEqual([unidas.estimacion, unidas.proyecto, unidas.prioridad], [30, 'pr-x', 'alta']);
  assert.ok(intentos >= 2);
  // una ejecución larga: el agente trabaja sobre su copia, el dueño comenta y cambia la prioridad, y al terminar nada se pierde
  const [arrancada] = await TAREAS.tomarSiguiente(o.d1);
  assert.equal(arrancada.id, t.id); assert.equal(arrancada.state, 'doing');
  const base = JSON.parse(JSON.stringify(arrancada));
  assert.equal((await o.api('POST', `/api/tasks/${t.id}/comment`, { text: 'ojo' })).status, 200);
  assert.equal((await o.api('POST', `/api/tareas/${t.id}/organizar`, { prioridad: 'baja' })).status, 200);
  const r = await TAREAS.guardarEjecucion(o.d1, base, { ...base, state: 'done', doneAt: 5, result: 'Listo.' }, { por: 'agente:piper' });
  assert.deepEqual([r.tarea.state, r.tarea.prioridad, r.tarea.comments.length, r.tarea.result], ['done', 'baja', 1, 'Listo.']);
  assert.equal((await TAREAS.guardarEjecucion(o.d1, base, { ...base, id: 'borrada1' })).borrada, true);
});

test('la cola: tomarSiguiente reserva por prioridad, un agente a la vez, sin tocar lo del dueño ni lo bloqueado, y dos relojes no reservan la misma', { skip: SALTAR }, async () => {
  const o = await oficina();
  const alta = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Urgente', agent: 'piper', prioridad: 'alta' })).j;
  const baja = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Cuando se pueda', prioridad: 'baja' })).j;
  const otro = (await o.api('POST', '/api/tasks', { dept: 'ops', text: 'Otra cosa', agent: 'olead' })).j;
  const mia = (await o.api('POST', '/api/tareas/mias', { title: 'Llamar al contador' })).j.tarea;
  const bloq = (await o.api('POST', '/api/tasks', { dept: 'emails', text: 'Esperar a la urgente', agent: 'cmail', bloqueadaPor: [alta.id] })).j;
  assert.equal(bloq.bloqueadaPor?.[0], alta.id);
  const [a, b] = await Promise.all([TAREAS.tomarSiguiente(o.d1, { max: 3 }), TAREAS.tomarSiguiente(o.d1, { max: 3 })]);
  const tomadas = [...a, ...b].map(t => t.id);
  assert.equal(new Set(tomadas).size, tomadas.length, 'ninguna se reserva dos veces');
  const hoy = await cargarTareas(o.d1);
  const estado = id => hoy.find(t => t.id === id).state;
  assert.deepEqual([estado(alta.id), estado(otro.id), estado(baja.id), estado(mia.id), estado(bloq.id)], ['doing', 'doing', 'next', 'next', 'next']); // la baja espera a que piper se libere; lo tuyo y lo bloqueado nunca
  assert.equal(hoy.find(t => t.id === alta.id).tomadaPor, 'agente:piper');
  assert.deepEqual(await TAREAS.tomarSiguiente(o.d1, { max: 3 }), []);
  assert.deepEqual(await TAREAS.tomarSiguiente(o.d1, { max: 3, sinPresupuesto: true }), []);
  // al terminar la urgente por la ruta del dueño («hecha»), lo que esperaba se libera y queda contado en la bitácora
  await conSesion(o.d1, async s => { s.alm.cambiar(alta.id, t => { t.state = 'waiting'; }, {}); });
  assert.equal((await o.api('POST', `/api/tareas/${alta.id}/estado`, { a: 'done' })).status, 200);
  const det = (await o.api('GET', `/api/tareas/${bloq.id}`)).j;
  assert.ok(det.bitacora.some(l => l.tipo === 'desbloqueada' && l.por_tarea === alta.id), 'la bitácora cuenta que se desbloqueó');
  assert.deepEqual(det.bloquean, []);
});

test('lo del dueño por /api/tareas/*: crear la suya, tomar la de un agente, delegarla, y un agente nunca lo hace por su cuenta', { skip: SALTAR }, async () => {
  const o = await oficina();
  const mia = (await o.api('POST', '/api/tareas/mias', { title: 'Llamar al contador', limite: '2026-12-02' })).j.tarea;
  assert.deepEqual([mia.person, mia.agent], ['Dueno', undefined], 'en la nube «para mí» es de la cuenta que lo pide (26 oct 2026), no del «Tú» compartido');
  assert.equal((await o.api('POST', '/api/tareas/mias', { por: 'agente', agente: 'piper', title: 'x' })).status, 403);
  const de = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Arma la propuesta de Acme' })).j;
  const tom = await o.api('POST', `/api/tareas/${de.id}/tomar`, {});
  assert.deepEqual([tom.status, tom.j.tarea.person, tom.j.tarea.deAgente], [200, 'Dueno', 'piper']);
  const del = await o.api('POST', `/api/tareas/${de.id}/delegar`, { a: 'agente', dept: 'sales', agente: 'enzo' });
  assert.equal(del.status, 200);
  const lista = (await o.api('GET', '/api/tareas/mias')).j; assert.ok(lista.cuentas.todas >= 1);
  // los agentes solo sugieren
  const sug = await o.api('POST', '/api/tareas/sugerir', { por: 'agente', agente: 'piper', texto: 'Revisar los precios de la lista' });
  assert.equal(sug.status, 200);
  const l = await cargarTareas(o.d1); const s = l.find(t => t.sugeridaPor);
  assert.deepEqual([s.state, s.person], ['idea', 'Tú']);
});

test('rutinas: crear con el horario en la frase, listar con su próxima ejecución, pausar, saltar una, editar y borrar', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.api('POST', '/api/routines', { dept: 'ops', text: 'Revisa el correo' })).j.noSchedule, true);
  assert.equal((await o.api('POST', '/api/routines', { dept: 'ops', text: 'cada día hábil a las, x' })).status, 400);
  const c = await o.api('POST', '/api/routines', { dept: 'sales', text: 'cada lunes a las 9, arma el plan de la semana' });
  assert.equal(c.status, 200); const r = c.j.routine;
  assert.deepEqual([r.dept, r.agent, r.needsOk, r.paused, r.desc.length > 0, r.nextAt > Date.now()], ['sales', 'piper', true, false, true, true]);
  assert.equal(new Date(r.nextAt).getDay(), 1); assert.equal(new Date(r.nextAt).getHours(), 9); // el lunes a las 9 de Panamá
  assert.equal((await o.api('GET', '/api/routines')).j.routines.length, 1);
  assert.equal((await o.api('POST', `/api/routines/${r.id}/pause`)).j.routines[0].nextAt, null);
  assert.ok((await o.api('POST', `/api/routines/${r.id}/resume`)).j.routines[0].nextAt > Date.now());
  const sk = await o.api('POST', `/api/routines/${r.id}/skip`, { at: r.nextAt }); assert.deepEqual(sk.j.routines[0].skips, [r.nextAt]);
  assert.deepEqual((await o.api('POST', `/api/routines/${r.id}/unskip`, { at: r.nextAt })).j.routines[0].skips, []);
  assert.equal((await o.api('POST', `/api/routines/${r.id}/skip`, { at: 3 })).status, 400);
  const ed = await o.api('PATCH', `/api/routines/${r.id}`, { needsOk: false, title: 'Plan semanal', agent: 'enzo' });
  assert.deepEqual([ed.j.routine.needsOk, ed.j.routine.title, ed.j.routine.agent], [false, 'Plan semanal', 'enzo']);
  assert.equal((await o.api('PATCH', `/api/routines/${r.id}`, { agent: 'olead' })).status, 400); // otro departamento
  assert.equal((await o.api('PATCH', `/api/routines/${r.id}`, { when: { kind: 'weekly' } })).status, 400);
  assert.equal((await o.api('PATCH', `/api/routines/${r.id}`, { text: '' })).status, 400);
  // ejecutar ya: nace una tarea de esa rutina y la rutina anota que corrió
  const run = await o.api('POST', `/api/routines/${r.id}/run`);
  assert.equal(run.status, 200); assert.deepEqual([run.j.task.routine, run.j.task.agent, run.j.task.by], [r.id, 'enzo', 'you']);
  assert.equal(run.j.routines[0].runs, 1);
  assert.equal((await o.api('DELETE', `/api/routines/${r.id}`)).j.routines.length, 0);
  assert.equal((await o.api('GET', '/api/routines/zz')).status, 404);
});

test('el reloj: una rutina que toca se vuelve UNA tarea aunque corran dos relojes a la vez; una atrasada sale marcada; la que no se recupera, no sale', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = (await o.api('POST', '/api/routines', { dept: 'ops', text: 'cada día a las 8, revisa los pagos', needsOk: false })).j.routine;
  const pasada = async (ms, extra = {}) => { await guardarDoc(o.d1, DOC_ESTADO, { [r.id]: { nextAt: Date.now() - ms, when: JSON.stringify(r.when), ...extra } }); };
  await pasada(20e3);
  await Promise.all([TAREAS.cadaMinuto(o.env), TAREAS.cadaMinuto(o.env)]);
  let tareas = await cargarTareas(o.d1);
  assert.equal(tareas.length, 1, 'una sola tarea');
  const t = tareas[0]; assert.deepEqual([t.routine, t.agent, t.needsOk, t.late, t.by], [r.id, 'olead', false, false, 'routine']); assert.match(t.id, /^rt[a-z0-9]{6,12}$/);
  await TAREAS.cadaMinuto(o.env); assert.equal((await cargarTareas(o.d1)).length, 1, 'ya corrió: la siguiente es mañana');
  const ro = (await o.api('GET', '/api/routines')).j.routines[0]; assert.deepEqual([ro.runs, ro.lastTaskId, ro.nextAt > Date.now()], [1, t.id, true]);
  // la computadora dormida: tarde, una vez, y avisa
  await pasada(3 * 3600e3, { runs: 1 });
  await TAREAS.cadaMinuto(o.env);
  tareas = await cargarTareas(o.d1); assert.equal(tareas.length, 2);
  assert.equal(tareas.find(x => x.id !== t.id).late, true);
  const av = () => o.d1._db.prepare("select json from filas where coleccion = 'avisos'").all().map(x => JSON.parse(x.json));
  assert.ok(av().some(a => a.kind === 'late' && /se hizo tarde/.test(a.text)));
  // catchUp: false → se salta
  await parcharRutina(o.d1, r.id, { catchUp: false });
  await pasada(3 * 3600e3, { runs: 2 });
  await TAREAS.cadaMinuto(o.env);
  assert.equal((await cargarTareas(o.d1)).length, 2, 'no se hizo tarde');
  assert.ok(av().some(a => a.kind === 'missed'));
  // un id estable por ejecución: el mismo minuto da el mismo id
  assert.equal(idDeEjecucion('a', 1000), idDeEjecucion('a', 1000)); assert.notEqual(idDeEjecucion('a', 1000), idDeEjecucion('a', 2000));
});

test('el reloj: lo programado pasa a la cola en su minuto, los avisos de fecha límite salen una vez, y el equipo marca la rutina de equipo', { skip: SALTAR }, async () => {
  const o = await oficina();
  const t = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Llama a Acme', at: Date.now() + 3600e3 })).j;
  await conSesion(o.d1, async s => { s.alm.cambiar(t.id, x => { x.dueAt = Date.now() - 5 * 60e3; }); });
  await TAREAS.cadaMinuto(o.env);
  const n = (await cargarTareas(o.d1))[0]; assert.deepEqual([n.state, n.late, n.due], ['next', true, n.dueAt]);
  // fecha límite: la víspera, una sola vez
  const l = (await o.api('POST', '/api/tareas/mias', { title: 'Declaración', limite: dia(Date.now() + 864e5, 'America/Panama') })).j.tarea;
  const C = { nombreAgente: id => id };
  for (let i = 0; i < 2; i++) await conSesion(o.d1, async s => { TAREAS.avisarLimites(s, C, Date.now()); });
  const av = o.d1._db.prepare("select json from filas where coleccion = 'avisos'").all().map(x => JSON.parse(x.json)).filter(a => a.kind === 'limite');
  assert.equal(av.length, 1); assert.match(av[0].text, /Mañana vence «Declaración»/);
  assert.equal((await cargarTareas(o.d1)).find(x => x.id === l.id).avisos.vispera > 0, true);
});

test('una tarea que se repite: al terminar bien nace la siguiente, una sola abierta', { skip: SALTAR }, async () => {
  const o = await oficina();
  const hoy = new Date(); const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const m = (await o.api('POST', '/api/tareas/mias', { title: 'Pagar la luz', limite: ymd(hoy), repetir: { cada: 'mes', modo: 'fijo' } })).j.tarea;
  assert.equal(m.repetir.cada, 'mes');
  assert.equal((await o.api('POST', `/api/tareas/${m.id}/estado`, { a: 'done' })).status, 200);
  const l = await cargarTareas(o.d1); assert.equal(l.length, 2);
  const sig = l.find(t => t.repeatOf === m.id); assert.ok(sig && sig.state === 'next' && sig.person === 'Dueno' && sig.limite > ymd(hoy));
  assert.equal((await o.api('POST', `/api/tareas/${m.id}/estado`, { a: 'next' })).status, 200);
  assert.equal((await o.api('POST', `/api/tareas/${m.id}/estado`, { a: 'done' })).status, 200);
  assert.equal((await cargarTareas(o.d1)).length, 2, 'ya había una abierta: no nace otra');
});

test('proyectos, etiquetas y el lote deshacible por la API de tareas; la bitácora se guarda y se lee', { skip: SALTAR }, async () => {
  const o = await oficina();
  const p = (await o.api('POST', '/api/tareas/proyectos', { nombre: 'Lanzamiento', color: 'verde' })).j.proyecto; assert.equal(p.id, 'pr-lanzamiento');
  assert.equal((await o.api('POST', '/api/tareas/proyectos', { nombre: 'lanzamiento' })).status, 400);
  const e = (await o.api('POST', '/api/tareas/etiquetas', { nombre: 'lentes' })).j.etiqueta;
  const a = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Una' })).j, b = (await o.api('POST', '/api/tasks', { dept: 'ops', text: 'Dos' })).j;
  const lote = await o.api('POST', '/api/tareas/lote', { ids: [a.id, b.id], accion: 'proyecto', valor: p.id });
  assert.deepEqual(lote.j.hechas.sort(), [a.id, b.id].sort());
  assert.equal((await cargarTareas(o.d1)).every(t => t.proyecto === p.id), true);
  await o.api('POST', '/api/tareas/lote/deshacer', { antes: lote.j.antes });
  assert.equal((await cargarTareas(o.d1)).some(t => t.proyecto), false);
  const cat = (await o.api('GET', '/api/tareas/catalogo')).j; assert.deepEqual([cat.proyectos.length, cat.etiquetas.length, cat.proyectos[0].progreso.total], [1, 1, 0]);
  assert.equal((await o.api('DELETE', `/api/tareas/etiquetas/${e.id}`)).j.ok, true);
  const bit = (await o.api('GET', `/api/tareas/${a.id}/bitacora`)).j.lineas; assert.ok(bit.some(l => l.tipo === 'creada') && bit.some(l => l.tipo === 'campo' && l.campo === 'proyecto'));
  const res = (await o.api('GET', '/api/tareas/resumen?dias=30')).j; assert.ok(res && typeof res === 'object');
});

test('/api/agents: los 35 puestos como la local, y lo que el dueño edita se guarda validado y solo el administrador lo cambia', { skip: SALTAR }, async () => {
  const o = await oficina();
  const g = (await o.api('GET', '/api/agents')).j;
  assert.equal(g.agents.length, 35); assert.deepEqual(g.agents.filter(a => a.lead).map(a => a.department).sort(), ['delivery', 'emails', 'fin', 'marketing', 'ops', 'sales']);
  assert.ok(g.agents.find(a => a.id === 'elead').interviewer);
  assert.equal((await o.api('PATCH', '/api/agents/nadie', { name: 'x' })).status, 404);
  const largo = await o.api('PATCH', '/api/agents/elead', { brief: 'x'.repeat(2500) }); assert.equal(largo.status, 400); assert.match(largo.j.error, /2000/);
  assert.equal((await o.api('PATCH', '/api/agents/elead', { model: 'gpt' })).status, 400);
  const ok = await o.api('PATCH', '/api/agents/elead', { name: 'jefe de correos', brief: 'Responde corto.', model: 'opus' });
  assert.deepEqual([ok.status, ok.j.agent.name, ok.j.agent.model, ok.j.agent.setUp], [200, 'JEFE DE CORREOS', 'opus', true]);
  assert.equal((await o.api('GET', '/api/agents')).j.agents.find(a => a.id === 'elead').brief, 'Responde corto.');
  const ficha = (await o.api('GET', '/api/agents/elead')).j; assert.deepEqual(Object.keys(ficha).sort(), ['agent', 'biblioteca', 'connectors', 'contenido', 'lessons', 'recent', 'skills', 'stats', 'studio']);
  assert.equal((await o.api('POST', '/api/agents/elead/forget', { line: 'x' })).status, 404); // fase 4: olvidar una lección que no existe
  // la tarea del agente se ve en su ficha
  await o.api('POST', '/api/tasks', { dept: 'emails', text: 'Contesta a Ana', agent: 'elead' });
  assert.equal((await o.api('GET', '/api/agents/elead')).j.stats.pending, 1);
  // lo de fábrica + lo del cerebro + lo local, en ese orden
  await guardarDoc(o.d1, 'agentes.cerebro', { agents: [{ id: 'cmail', name: 'Correos de clientes', does: 'Contesta a los clientes.' }] });
  const c = (await o.api('GET', '/api/agents')).j; assert.equal(c.agents.find(a => a.id === 'cmail').name, 'CORREOS DE CLIENTES'); assert.ok(c.files.includes('brain/Agents Office/agents.json'));
});

test('/api/calendar.ics: las rutinas con su repetición y las tareas con fecha, en la hora de la oficina', { skip: SALTAR }, async () => {
  const o = await oficina();
  await o.api('POST', '/api/routines', { dept: 'sales', text: 'cada lunes a las 9, arma el plan de la semana' });
  await o.api('POST', '/api/tareas/mias', { title: 'Llamar al contador', limite: '2026-12-02T10:00' });
  const r = await o.api('GET', '/api/calendar.ics');
  assert.equal(r.r.headers.get('content-type'), 'text/calendar; charset=utf-8');
  assert.match(r.j, /^BEGIN:VCALENDAR\r\n/); assert.match(r.j, /RRULE:FREQ=WEEKLY;BYDAY=MO/); assert.match(r.j, /DTSTART:\d{8}T090000\r\n/); // las 9 de Panamá, no las 14 de UTC
  assert.match(r.j, /DTSTART:20261202T100000/); assert.match(r.j, /SUMMARY:⚑ Vence: Llamar al contador/); // (26 oct 2026: en la nube «para mí» es de la cuenta —«Dueno»—, no el «Tú» del dueño: sale como la tarea de una persona)
  assert.equal((await pedir(manejar, o.env, '/api/calendar.ics')).status, 401);
});

test('el sondeo ligero (?light=1) no saca de D1 el trabajo de lo archivado, y los avisos con la misma clave no se repiten en 6 horas', { skip: SALTAR }, async () => {
  const o = await oficina();
  const a = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Una vieja' })).j, b = (await o.api('POST', '/api/tasks', { dept: 'ops', text: 'Una viva' })).j;
  await conSesion(o.d1, async s => { s.alm.cambiar(a.id, t => { Object.assign(t, { state: 'done', doneAt: 5, result: 'ENTREGA ENORME '.repeat(2000), archived: true, archivedAt: 9 }); }); });
  const ligera = (await o.api('GET', '/api/tasks?light=1')).j, completa = (await o.api('GET', '/api/tasks')).j;
  assert.deepEqual(Object.keys(ligera.find(t => t.id === a.id)).sort(), ['addedAt', 'agent', 'archived', 'archivedAt', 'dept', 'doneAt', 'id', 'state', 'title']);
  assert.deepEqual(ligera.find(t => t.id === b.id), { ...completa.find(t => t.id === b.id), queue: ligera.find(t => t.id === b.id).queue }); // lo vivo, entero
  assert.match(completa.find(t => t.id === a.id).result, /^ENTREGA ENORME/); // y la entrega sigue guardada: la lectura ligera no escribió nada
  // un POST después de un sondeo ligero no recorta lo archivado
  await o.api('POST', `/api/tasks/${b.id}/comment`, { text: 'hola' });
  assert.match((await cargarTareas(o.d1)).find(t => t.id === a.id).result, /^ENTREGA ENORME/);
  // avisos con la misma clave
  for (let i = 0; i < 3; i++) await conSesion(o.d1, async s => { s.avisar('limite', 'Mañana vence algo', { key: 'limite-vispera-x' }); s.avisar('late', 'sin clave'); });
  const av = o.d1._db.prepare("select json from filas where coleccion = 'avisos'").all().map(x => JSON.parse(x.json));
  assert.equal(av.filter(x => x.key === 'limite-vispera-x').length, 1); assert.equal(av.filter(x => x.kind === 'late').length, 3);
});

test('un cuerpo de más de 1 MB se rechaza; y si el reloj no puede crear la tarea de una rutina, el minuto siguiente lo reintenta (sin duplicar)', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.api('POST', '/api/tasks', { dept: 'ops', text: 'x'.repeat(1.2 * 1024 * 1024) })).status, 413);
  const r = (await o.api('POST', '/api/routines', { dept: 'ops', text: 'cada día a las 8, revisa los pagos', needsOk: false })).j.routine;
  await guardarDoc(o.d1, DOC_ESTADO, { [r.id]: { nextAt: Date.now() - 20e3, when: JSON.stringify(r.when), runs: 4 } });
  const batch = o.d1.batch; o.d1.batch = async () => { throw new Error('D1 se cayó'); };
  await assert.rejects(() => TAREAS.cadaMinuto(o.env), /D1 se cayó/);
  o.d1.batch = batch;
  assert.equal((await cargarTareas(o.d1)).length, 0);
  assert.equal((await o.api('GET', '/api/routines')).j.routines[0].runs, 4, 'el reloj volvió atrás');
  await TAREAS.cadaMinuto(o.env);
  const l = await cargarTareas(o.d1); assert.deepEqual([l.length, l[0].routine], [1, r.id]);
  assert.equal((await o.api('GET', '/api/routines')).j.routines[0].runs, 5);
  await TAREAS.cadaMinuto(o.env); assert.equal((await cargarTareas(o.d1)).length, 1);
});

test('la migración: lo que exporta la oficina local sube con /api/migrar/* y se ve igual en la nube (sin llaves, y lo «en curso» vuelve a la cola)', { skip: SALTAR }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mig-'));
  try {
    fs.mkdirSync(path.join(dir, 'data', 'tareas'), { recursive: true }); fs.mkdirSync(path.join(dir, 'cerebro', 'Agents Office'), { recursive: true });
    const t1 = crearTarea({ dept: 'sales', agent: 'piper', title: 'Una', text: 'Una' }, { id: () => 'aaaa1' }), t2 = crearTarea({ dept: 'ops', agent: 'olead', title: 'Dos', text: 'Dos' }, { id: () => 'bbbb2' }); t2.state = 'doing'; t2.startedAt = 5; t2.tomadaPor = 'agente:olead';
    fs.writeFileSync(path.join(dir, 'data', 'tasks.json'), JSON.stringify([{ ...t1, v: undefined, version: undefined, prioridad: undefined }, t2, { id: 'raro!', title: 'sin id válido' }]));
    fs.writeFileSync(path.join(dir, 'data', 'routines.json'), JSON.stringify({ lunes: { nextAt: 4102444800000, runs: 3, when: JSON.stringify({ kind: 'weekly', days: [1], at: '09:00' }) } }));
    fs.writeFileSync(path.join(dir, 'data', 'tareas', 'proyectos.json'), JSON.stringify([{ id: 'pr-uno', nombre: 'Uno', color: 'azul', estado: 'activo' }]));
    fs.writeFileSync(path.join(dir, 'cerebro', 'Agents Office', 'routines.json'), JSON.stringify({ routines: [{ id: 'lunes', dept: 'sales', agent: 'piper', title: 'Plan', text: 'Arma el plan', when: { kind: 'weekly', days: [1], at: '09:00' } }] }));
    fs.writeFileSync(path.join(dir, 'cerebro', 'Agents Office', 'agents.json'), JSON.stringify({ agents: [{ id: 'piper', brief: 'Tutea.' }] }));
    fs.writeFileSync(path.join(dir, 'office.config.json'), JSON.stringify({ name: 'PanaClaw', approvals: { amountLimit: 500 }, team: { people: [{ name: 'Ana', depts: ['sales'], telegram: '123' }] }, telegram: { token: 'NO-DEBE-SUBIR' }, mcp: { allow: [] } })); // secrets-ok: una llave de mentira para comprobar que NO sube
    const x = await exportar({ raiz: dir, vault: path.join(dir, 'cerebro') });
    assert.deepEqual(x.filas.tareas.map(f => f.id), ['aaaa1', 'bbbb2']);
    assert.equal(x.filas.tareas[1].valor.state, 'next'); assert.equal(x.filas.tareas[1].valor.migrada.estaba, 'doing'); assert.equal(x.filas.tareas[1].valor.tomadaPor, undefined);
    assert.equal(x.filas.tareas[0].valor.version, 1); assert.equal(x.filas.tareas[0].valor.prioridad, 'media'); // en la forma de hoy
    assert.doesNotMatch(JSON.stringify(x), /NO-DEBE-SUBIR|token/i);
    assert.deepEqual(Object.keys(x.docs).sort(), ['agentes.cerebro', 'rutinas.estado', 'tareas.config', 'tareas.proyectos']);
    // y se sube con las rutas genéricas, como hace scripts/migrar-a-nube.mjs
    const o = await oficina();
    for (const [coleccion, filas] of Object.entries(x.filas)) assert.equal((await o.api('POST', '/api/migrar/filas', { coleccion, filas })).status, 200);
    for (const [clave, valor] of Object.entries(x.docs)) assert.equal((await o.api('POST', '/api/migrar/docs', { clave, valor })).status, 200);
    const tareas = (await o.api('GET', '/api/tasks')).j; assert.deepEqual(tareas.map(t => t.id), ['aaaa1', 'bbbb2']);
    const rs = (await o.api('GET', '/api/routines')).j.routines; assert.deepEqual([rs.length, rs[0].runs, rs[0].nextAt], [1, 3, 4102444800000]);
    assert.equal((await o.api('GET', '/api/tareas/catalogo')).j.proyectos[0].id, 'pr-uno');
    assert.equal((await o.api('GET', '/api/agents')).j.agents.find(a => a.id === 'piper').brief, 'Tutea.');
    assert.equal((await o.api('GET', '/api/team')).j.people[0].name, 'Ana');
    // el límite de aprobación del dueño manda: un importe grande pide el OK siempre
    const grande = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Cobra $900 a Acme', needsOk: false })).j; assert.equal(grande.needsOk, true);
    const chico = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Cobra $90 a Acme', needsOk: false })).j; assert.notEqual(chico.needsOk, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
