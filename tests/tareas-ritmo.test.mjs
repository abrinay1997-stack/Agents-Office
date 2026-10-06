// Planes T4 y T5 (6 oct 2026): Dimitri planifica PROYECTOS con prioridad, fecha límite y dependencias; las rutinas MENSUALES (día,
// último día, «el segundo martes»), con fin y número de veces; las tareas que se REPITEN (fija o al completar); los AVISOS de fecha
// límite; y lo que Dimitri lee de los proyectos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWhen, nextRun, valid, describe as decir, occurrences } from '../src/when.js';
import { withState, advance } from '../routines.mjs';
import { siguiente, proximas, avisosLimite, leerRepetir } from '../tareas/ritmo.mjs';
import { parsePlan, proyectosText, parseOps } from '../sub.mjs';

const ms = s => new Date(s).getTime();

test('rutinas mensuales: el día, el último día, el n-ésimo día de la semana; con fecha de fin y número de veces', () => {
  assert.deepEqual(parseWhen('el segundo martes de cada mes a las 10 revisa los precios').when, { kind: 'monthly', nth: 2, weekday: 2, at: '10:00' });
  assert.deepEqual(parseWhen('el último día de cada mes a las 17 cierra la caja').when, { kind: 'monthly', day: -1, at: '17:00' });
  assert.deepEqual(parseWhen('el 15 de cada mes a las 9 manda las facturas').when, { kind: 'monthly', day: 15, at: '09:00' });
  assert.equal(parseWhen('el 15 de cada mes a las 9 manda las facturas').text, 'manda las facturas');
  assert.equal(parseWhen('cada mes informe').needsDay, true);
  assert.equal(parseWhen('cada lunes a las 9 resumen hasta el 30 de noviembre').when.end.slice(5), '11-30');
  assert.equal(parseWhen('todos los días a las 8 durante 2 semanas el reporte').when.count, 14);
  assert.equal(parseWhen('cada lunes y jueves a las 9 durante 3 semanas').when.count, 6);
  assert.equal(nextRun({ kind: 'monthly', nth: 2, weekday: 2, at: '10:00' }, ms('2026-10-06T12:00')), ms('2026-10-13T10:00'));
  assert.equal(nextRun({ kind: 'monthly', nth: -1, weekday: 5, at: '10:00' }, ms('2026-10-06T12:00')), ms('2026-10-30T10:00'), 'el último viernes');
  assert.equal(nextRun({ kind: 'monthly', day: -1, at: '17:00' }, ms('2027-02-10T12:00')), ms('2027-02-28T17:00'));
  assert.equal(nextRun({ kind: 'monthly', day: 31, at: '09:00' }, ms('2026-11-05T12:00')), ms('2026-11-30T09:00'), 'el 31 en un mes de 30 cae el 30');
  assert.equal(nextRun({ kind: 'daily', at: '09:00', end: '2026-10-06' }, ms('2026-10-06T10:00')), null, 'después de su fin, nada');
  assert.equal(occurrences({ kind: 'monthly', day: 1, at: '08:00' }, ms('2026-10-02'), ms('2027-01-02')).length, 3);
  assert.ok(!valid({ kind: 'monthly', at: '09:00', day: 32 })); assert.ok(!valid({ kind: 'monthly', at: '09:00', nth: 5, weekday: 1 })); assert.ok(!valid({ kind: 'daily', at: '09:00', count: 0 }));
  assert.equal(decir({ kind: 'monthly', nth: 2, weekday: 2, at: '10:00' }), 'el segundo martes de cada mes a las 10:00');
  assert.match(decir({ kind: 'weekly', days: [1], at: '09:00', count: 6 }), /lunes a las 09:00 · 6 veces/);
});

test('una rutina con «6 veces» se detiene después de la sexta, y lo dice', () => {
  const r = { id: 'x', when: { kind: 'daily', at: '09:00', count: 2 } }, st = {};
  withState([r], st, ms('2026-10-06T08:00'));
  advance(st, r, ms('2026-10-06T09:00')); assert.ok(st.x.nextAt);
  advance(st, r, ms('2026-10-07T09:00')); assert.equal(st.x.nextAt, null);
  const v = withState([r], st, ms('2026-10-08T08:00')); assert.equal(v.list[0].nextAt, null); assert.equal(v.list[0].terminada, true);
});

test('repetir una tarea: fija desde su fecha límite, o al completar; una sola abierta; si se terminó tarde, no nace vencida', () => {
  const ahora = ms('2026-10-06T10:00');
  assert.equal(siguiente({ state: 'done', doneAt: ahora, limite: '2026-10-05', repetir: { cada: 'semana', modo: 'fijo' }, person: 'Ana' }, ahora).limite, '2026-10-12');
  assert.equal(siguiente({ state: 'done', doneAt: ahora, limite: '2026-09-01', repetir: { cada: 'semana', modo: 'fijo' }, person: 'Ana' }, ahora).limite >= '2026-10-06', true, 'tarde: salta a la primera que no pasó');
  const ag = siguiente({ state: 'done', doneAt: ahora, limite: '2026-10-02', repetir: { cada: 'mes', modo: 'alcompletar' }, agent: 'x', title: 'T' }, ahora);
  assert.equal(ag.limite, '2026-11-06'); assert.equal(ag.dueAt, ms('2026-11-06T09:00'), 'la de un agente arranca ese día a las 9');
  assert.equal(siguiente({ state: 'done', error: true, repetir: { cada: 'dia' } }, ahora), null, 'una que falló no se repite sola');
  assert.equal(siguiente({ state: 'done', doneAt: ahora, limite: '2026-10-06', repetir: { cada: 'semana', hasta: '2026-10-10' } }, ahora), null, 'después de «hasta», no');
  assert.deepEqual(proximas({ cada: 'mes' }, '2027-01-31', 3), ['2027-02-28', '2027-03-31', '2027-04-30']);
  assert.match(leerRepetir({ cada: 'año' }).error, /dia, semana/); assert.deepEqual(leerRepetir(null), { repetir: null });
});

test('los avisos de fecha límite: la víspera si no empezó, el día si es de una persona, y al vencer; una vez cada uno', () => {
  const ahora = ms('2026-10-06T10:00');
  const l = [{ id: 'a', state: 'next', limite: '2026-10-07' }, { id: 'b', state: 'doing', limite: '2026-10-07' }, { id: 'c', state: 'next', limite: '2026-10-05' }, { id: 'd', state: 'next', limite: '2026-10-06', person: 'Ana' },
    { id: 'e', state: 'next', limite: '2026-10-05', avisos: { vencida: 1 } }, { id: 'f', state: 'done', limite: '2026-10-01' }, { id: 'g', state: 'idea', limite: '2026-10-01' }];
  assert.deepEqual(avisosLimite(l, ahora).map(x => `${x.id}:${x.tipo}`), ['a:vispera', 'c:vencida', 'd:hoy']);
});

test('Dimitri: un plan con proyecto, prioridad, fecha límite y quién espera a quién (sin círculos); y lo que lee de los proyectos', () => {
  const depts = { marketing: {}, emails: {}, delivery: {}, brain: {} }, agents = [{ id: 'm', department: 'marketing', lead: true }, { id: 'e', department: 'emails', lead: true }, { id: 'd', department: 'delivery', lead: true }];
  const j = { mode: 'plan', reply: 'Hecho.', proyecto: { nombre: 'Lanzamiento lentes', objetivo: '200 pares', limite: '2026-10-20' }, tasks: [
    { dept: 'marketing', title: 'Fotos', instruction: 'Fotos', prioridad: 'alta', limite: '2026-10-14' },
    { dept: 'nope', title: 'Malo', instruction: 'x' },
    { dept: 'marketing', title: 'Post', instruction: 'Post', espera: [0], limite: '2026-10-18' },
    { dept: 'emails', title: 'Correo', instruction: 'Correo', espera: [2, 3] },
    { dept: 'delivery', title: 'Ficha', instruction: 'Ficha', espera: [0, 4], limite: 'viernes' }] };
  const p = parsePlan(JSON.stringify(j), { depts, agents });
  assert.deepEqual(p.proyecto, { nombre: 'Lanzamiento lentes', objetivo: '200 pares', limite: '2026-10-20' });
  assert.deepEqual(p.tasks.map(t => [t.title, t.prioridad, t.limite || null, t.espera]), [['Fotos', 'alta', '2026-10-14', []], ['Post', 'media', '2026-10-18', [0]], ['Correo', 'media', null, [1]], ['Ficha', 'media', null, [0]]],
    'los índices se ajustan al quitar la pieza mala; «espera» a sí misma o a una que no existe se cae; una fecha que no es fecha, también');
  const circ = parsePlan(JSON.stringify({ mode: 'plan', tasks: [{ dept: 'marketing', instruction: 'A', espera: [1] }, { dept: 'emails', instruction: 'B', espera: [0] }] }), { depts, agents });
  assert.ok(circ.tasks.some(t => !t.espera.length), 'un círculo se rompe');
  assert.deepEqual(parsePlan(JSON.stringify({ mode: 'plan', proyecto: { id: 'pr-lentes' }, tasks: [{ dept: 'emails', instruction: 'x' }] }), { depts, agents }).proyecto, { id: 'pr-lentes' });
  assert.equal(parsePlan(JSON.stringify({ mode: 'charla', reply: 'hola', proyecto: { nombre: 'X' } }), { depts, agents }).proyecto, undefined, 'una charla no trae proyecto');
  const txt = proyectosText([{ id: 'pr-l', nombre: 'Lentes', estado: 'activo', limite: '2026-10-20', progreso: { hechas: 1, total: 3, atrasado: true, vencidas: 1, diasRestantes: 4 } }],
    [{ id: 'a', proyecto: 'pr-l', state: 'next', title: 'Post', bloqueadaPor: ['b'] }, { id: 'b', proyecto: 'pr-l', state: 'next', title: 'Para ti: precio', person: 'Tú' }], { name: id => id });
  assert.match(txt, /pr-l · «Lentes» · 1\/3 hechas · vence 2026-10-20 \(en 4 días\) · 1 tareas vencidas · VA ATRASADO · bloqueos: «Post» espera a «Para ti: precio» \(la tiene Tú\)/);
  assert.equal(proyectosText([]), '');
  const ops = parseOps([{ type: 'rutina_crear', dept: 'fin', text: 'cerrar la caja', when: { kind: 'monthly', day: -1, at: '17:00', count: 6 } }], { depts: { fin: {} }, agents: [{ id: 'f', department: 'fin', lead: true }], routineDepts: ['fin'], routines: [], tasks: [] });
  assert.deepEqual(ops.ops[0]?.when, { kind: 'monthly', at: '17:00', day: -1, count: 6 }, 'Dimitri propone rutinas mensuales');
});
