// Revisión de control (9 oct 2026): Dimitri y cualquier IA conectada controlan el calendario, las tareas y Contenido con UNA lista
// cerrada de cambios (sub.OPS), validada contra la oficina (sub.parseOps) — lo del dueño no se toca como si fuera de un agente, lo que no
// se puede se dice en palabras, y el JSON se lee aunque el modelo escriba algo antes (cualquier IA, no solo Claude).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sub from '../sub.mjs';
import { opLabel, whenWords, opsHTML } from '../src/sub-ops.js';
import { ACCIONES } from '../oficina/rutas.mjs';
import { MAPA, REGLAS_ASISTENTE } from '../oficina/mapa.mjs';

const NOW = new Date('2026-10-09T10:00:00');
const DEPTS = { emails: { name: 'Emails' }, sales: { name: 'Ventas' }, marketing: { name: 'Marketing' }, ops: { name: 'Operaciones' }, fin: { name: 'Finanzas' }, delivery: { name: 'Entregas' }, brain: { name: 'Cerebro' } };
const AGENTS = [{ id: 'mia', department: 'marketing', lead: true, name: 'MIA' }, { id: 'rex', department: 'sales', lead: true, name: 'REX' }, { id: 'cobra', department: 'fin', lead: true, name: 'COBRA' }];
const ctx = (o = {}) => ({ depts: DEPTS, agents: AGENTS, routineDepts: ['fin', 'marketing', 'sales'], now: NOW.getTime(), piezaHas: id => id === 'p-1',
  routines: [{ id: 'cobros', title: 'Cobros', when: { kind: 'weekly', days: [1], at: '09:00' }, nextAt: new Date('2026-10-12T09:00').getTime(), text: 'Lista los cobros', needsOk: true }, { id: 'parada', title: 'Parada', paused: true, when: { kind: 'daily', at: '08:00' } }],
  tasks: [{ id: 'ag1', state: 'scheduled', title: 'Post', agent: 'mia', dueAt: NOW.getTime() + 864e5 }, { id: 'mio1', state: 'next', title: 'Llamar a Juan', person: 'Tú', limite: '2026-10-10' }, { id: 'per1', state: 'next', title: 'Visitar', person: 'Ana' }, { id: 'hecha1', state: 'done', title: 'Informe', agent: 'cobra', error: true }, { id: 'mio2', state: 'done', title: 'Firmar', person: 'Tú' }], ...o });

test('las tareas del dueño no se mueven ni se cancelan como si fueran de un agente; se cambian por su fecha límite, se delegan o se marcan hechas', () => {
  const r = sub.parseOps([
    { type: 'tarea_mover', id: 'mio1', at: '2026-10-11T10:00' }, { type: 'tarea_cancelar', id: 'mio1' }, { type: 'tarea_cancelar', id: 'per1' },
    { type: 'tarea_editar', id: 'mio1', limite: '2026-10-14T16:00', prioridad: 'alta' }, { type: 'mia_delegar', id: 'mio1', dept: 'sales', nota: 'Llámalo tú' }, { type: 'mia_hecha', id: 'mio1' },
    { type: 'mia_hecha', id: 'ag1' }, { type: 'mia_hecha', id: 'mio2' }, { type: 'mia_delegar', id: 'mio1', dept: 'brain' }, { type: 'tarea_mover', id: 'ag1', at: '2026-10-11T10:00' }], ctx());
  assert.deepEqual(r.ops.map(o => o.type), ['tarea_editar', 'mia_delegar', 'mia_hecha', 'tarea_mover']);
  assert.equal(r.ops[0].mia, true); assert.equal(r.ops[0].limite, '2026-10-14T16:00'); assert.deepEqual(r.ops[0].antes, { prioridad: 'media', limite: '2026-10-10' }, 'lo de antes, para deshacer');
  assert.equal(r.ops[1].dept, 'sales'); assert.equal(r.ops[1].agent, null);
  const por = Object.fromEntries(r.motivos.map((m, i) => [`${m.type}#${i}`, m.why]));
  assert.match(por['tarea_mover#0'], /es del dueño: se mueve cambiando su fecha límite/);
  assert.match(por['tarea_cancelar#1'], /es del dueño: solo él la quita/);
  assert.match(por['tarea_cancelar#2'], /la tiene Ana/);
  assert.match(por['mia_hecha#3'], /no es del dueño/); assert.match(por['mia_hecha#4'], /ya estaba hecha/);
  assert.equal(r.dropped.length, 6, 'dropped sigue siendo la lista de tipos (compatibilidad)');
});

test('las rutinas enteras: pausar, reanudar, cambiar el horario o el pedido, correr ahora — y nada sobre una rutina que no existe', () => {
  const r = sub.parseOps([
    { type: 'rutina_pausar', id: 'cobros' }, { type: 'rutina_pausar', id: 'parada' }, { type: 'rutina_reanudar', id: 'parada' }, { type: 'rutina_reanudar', id: 'cobros' },
    { type: 'rutina_editar', id: 'cobros', when: { kind: 'monthly', day: -1, at: '17:00' }, needsOk: false }, { type: 'rutina_editar', id: 'cobros', when: { kind: 'monthly', at: '17:00' } }, { type: 'rutina_editar', id: 'cobros' },
    { type: 'rutina_ahora', id: 'cobros' }, { type: 'rutina_ahora', id: 'nada' }], ctx());
  assert.deepEqual(r.ops.map(o => o.type), ['rutina_pausar', 'rutina_reanudar', 'rutina_editar', 'rutina_ahora']);
  const ed = r.ops[2]; assert.deepEqual(ed.when, { kind: 'monthly', at: '17:00', day: -1 }); assert.equal(ed.needsOk, undefined, 'Dimitri solo puede ENCENDER el OK; apagarlo es del dueño en la tarjeta');
  assert.deepEqual(ed.antes.when, { kind: 'weekly', days: [1], at: '09:00' });
  assert.deepEqual(r.motivos.map(m => m.why), ['ya estaba pausada', 'no estaba pausada', 'el horario no está completo', 'no dice qué cambiar', 'esa rutina no existe']);
  const dueno = sub.parseOps([{ type: 'rutina_editar', id: 'cobros', needsOk: false }], { ...ctx(), owner: true });
  assert.equal(dueno.ops[0].needsOk, false, 'el dueño, en su tarjeta, sí puede quitar el OK');
});

test('repetir lo que falló, llenar la semana y piezas en las nueve redes', () => {
  const r = sub.parseOps([{ type: 'tarea_repetir', id: 'hecha1' }, { type: 'tarea_repetir', id: 'ag1' }, { type: 'tarea_repetir', id: 'mio2' },
    { type: 'contenido_llenar', dias: 40, redes: ['instagram', 'orkut'], pide: 'Que sean reels' }, { type: 'pieza_crear', titulo: 'Hola', redes: ['linkedin', 'x'], texto: 'Hola' }], ctx());
  assert.deepEqual(r.ops.map(o => o.type), ['tarea_repetir', 'contenido_llenar', 'pieza_crear']);
  assert.equal(r.ops[0].fallo, true); assert.equal(r.ops[1].dias, 14, 'como mucho 14 días'); assert.deepEqual(r.ops[1].redes, ['instagram']);
  assert.deepEqual(r.ops[2].redes, ['linkedin', 'x']);
  assert.match(sub.motivosText(r.motivos), /No incluyo 2 cambios que pensé: repetir una tarea — todavía no terminó; repetir una tarea — es de una persona/);
});

test('aprobar, enviar, publicar, pagar o borrar no existe en la lista: ni Dimitri ni una IA conectada lo pueden pedir', () => {
  const malos = ['aprobar_pieza', 'pieza_aprobar', 'publicar', 'enviar_correo', 'pagar', 'rutina_borrar', 'tarea_borrar', 'aprobar_tarea'];
  const r = sub.parseOps(malos.map(type => ({ type, id: 'p-1' })), ctx());
  assert.equal(r.ops.length, 0); assert.deepEqual(r.dropped, malos);
  for (const t of sub.OPS) assert.doesNotMatch(t, /aprob|envi|public|pag[oa]|borr|elimin|delete|send|approve|publish|pay/i, `«${t}» no puede sonar a una acción de fuera`);
});

test('cada cambio de la lista tiene su texto en la tarjeta, su línea en el prompt de Dimitri y sus campos para el asistente', () => {
  const p = sub.systemPrompt({ business: 'PanaClaw', depts: DEPTS, agents: AGENTS, skillsOf: () => [], routineDepts: ['fin'], status: '', now: NOW });
  for (const t of sub.OPS) {
    assert.ok(p.includes(`"type":"${t}"`), `el prompt describe ${t}`);
    assert.ok(ACCIONES[t], `oficina/rutas.mjs → ACCIONES describe ${t}`);
    assert.ok(opLabel({ type: t, title: 'X', titulo: 'X', id: 'x', when: { kind: 'daily', at: '09:00' }, at: NOW.getTime(), dept: 'fin', redes: ['instagram'], prioridad: 'alta' }, { deptName: k => k }), `la tarjeta dice qué hace ${t}`);
  }
  assert.ok(p.includes(MAPA), 'Dimitri conoce el mapa de la oficina');
  assert.match(REGLAS_ASISTENTE, /Aprobar, enviar, publicar, pagar ni borrar/);
});

test('la rutina mensual se lee en palabras y su tarjeta no la convierte en semanal (sin botones de días)', () => {
  assert.equal(whenWords({ kind: 'monthly', day: 15, at: '09:00' }), 'el día 15 de cada mes a las 09:00');
  assert.equal(whenWords({ kind: 'monthly', day: -1, at: '18:00' }), 'el último día de cada mes a las 18:00');
  assert.equal(whenWords({ kind: 'monthly', nth: 2, weekday: 2, at: '09:00', count: 6 }), 'el segundo martes de cada mes a las 09:00, 6 veces');
  const m = { id: 'm1', ops: [{ k: 0, type: 'rutina_crear', state: 'proposed', dept: 'fin', title: 'Cierre', text: 'Cierre', when: { kind: 'monthly', day: -1, at: '18:00' }, needsOk: true }] };
  const h = opsHTML(m, { esc: s => String(s), deptName: k => k });
  assert.doesNotMatch(h, /so-day/); assert.match(h, /el último día de cada mes/);
  const w = opsHTML({ ...m, ops: [{ ...m.ops[0], when: { kind: 'weekly', days: [1], at: '09:00' } }] }, { esc: s => String(s), deptName: k => k });
  assert.match(w, /so-day/);
});

test('el JSON de la respuesta se lee aunque el modelo piense en voz alta antes, ponga un ejemplo o lo meta en un bloque de código', () => {
  const ok = JSON.stringify({ mode: 'plan', reply: 'Hecho', ops: [{ type: 'rutina_pausar', id: 'cobros' }] });
  for (const raw of [ok, '```json\n' + ok + '\n```', 'Voy a pensarlo: el dueño quiere {pausar}. ' + ok, 'Ejemplo: {"type":"x"}\nRespuesta: ' + ok + '\nListo.', 'Ejemplo {"a":1} ' + ok + ' y otro {"b":2}']) {
    const p = sub.parsePlan(raw, { depts: DEPTS, agents: AGENTS, now: NOW.getTime() });
    assert.equal(p.mode, 'plan', raw.slice(0, 40)); assert.equal(p.reply, 'Hecho'); assert.equal(p.ops.length, 1); assert.ok(!p.bad && !p.cut);
  }
  const conComillas = sub.pickJSON('nota: {"mode":"charla","reply":"dice \\"}\\" y sigue"}'); assert.equal(conComillas.j.reply, 'dice "}" y sigue');
  const cortada = sub.parsePlan('Pienso… {"mode":"charla","reply":"Esto se cor', { depts: DEPTS, agents: AGENTS }); assert.equal(cortada.cut, true); assert.equal(cortada.reply, 'Esto se cor');
  assert.equal(sub.parsePlan('Solo texto, sin JSON.', { depts: DEPTS, agents: AGENTS }).reply, 'Solo texto, sin JSON.');
});

test('Dimitri ve cómo sale lo publicado y el calendario de tareas en palabras, con ids', () => {
  const e = { modo: 'real', conductor: { id: 'meta', nombre: 'Meta directo', ok: false, motivo: 'falta el permiso instagram_content_publish', cuota: { nuestras: 3, usadas: 12, total: 50 } }, cuenta: { espera: 2, entregando: 0, en_red: 1, fallo: 1 } };
  const t = sub.publicacionText(e);
  assert.match(t, /modo REAL/); assert.match(t, /NO está listo: falta el permiso/); assert.match(t, /Instagram en 24 h: 12\/50 según Meta/); assert.match(t, /FALLARON 1/);
  assert.equal(sub.publicacionText(null), '');
  const c = sub.calendarioText({ desde: '2026-10-09', hasta: '2026-10-15', tareas: [{ id: 'ag1', title: 'Post', agent: 'mia', state: 'scheduled', dueAt: new Date('2026-10-10T09:00').getTime() }], rutinas: [{ at: new Date('2026-10-12T09:00').getTime(), id: 'cobros', title: 'Cobros', agent: 'cobra', skip: true }], mias: [{ id: 'mio1', title: 'Llamar a Juan', limite: '2026-10-10T16:00', state: 'next' }], piezas: [], name: id => id.toUpperCase() });
  assert.match(c, /«Post» \(MIA, scheduled, id ag1\)/); assert.match(c, /«Cobros» \(COBRA, rutina cobros, SALTADA\)/); assert.match(c, /2026-10-10 16:00 «Llamar a Juan» \(id mio1\)/); assert.match(c, /Contenido: nada\./);
  const s = sub.statusText([...ctx().tasks, { id: 'w1', state: 'waiting', title: 'Correo a Sol', agent: 'mia' }], AGENTS, DEPTS);
  assert.match(s, /Correo a Sol \(MIA, id w1\)/, 'lo que espera el OK lleva su id'); assert.doesNotMatch(s, /Llamar a Juan/, 'lo del dueño va aparte (resumenDueno)'); assert.match(s, /Visitar \(Ana, persona, id per1\)/);
});
