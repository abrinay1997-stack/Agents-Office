// VAN-06 — presupuesto por agente y por rutina, con corte duro.
//
// Lo que importa, por orden de gravedad:
//   1. Un agente o una rutina que se pasa de SU tope no arranca más tareas, y las de los demás siguen.
//   2. El motivo se dice en palabras (y la cola lo cuenta aparte del tope del mes de toda la oficina).
//   3. Un tope 0 = sin tope: la oficina de siempre no cambia de comportamiento.
//   4. El tope propio de una ficha gana sobre el de la oficina.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gastoPorDueno, topesDe, frenosDePresupuesto, conRutinaDeTarea, config, DEFAULTS } from '../costs-core.mjs';
import { planear, explicarCola } from '../tareas/cola.mjs';

const AHORA = new Date('2026-11-18T15:00:00').getTime();
const AYER = AHORA - 26 * 3600e3;
const MES_PASADO = new Date('2026-10-18T15:00:00').getTime();
const linea = (o) => ({ t: AHORA, agent: null, task: null, usd: 0, ...o });

describe('lo gastado por agente y por rutina', () => {
  it('suma el día y el mes, y deja fuera lo de otro mes', () => {
    const g = gastoPorDueno([
      linea({ agent: 'a1', usd: 1 }),
      linea({ agent: 'a1', usd: 2, t: AYER }),
      linea({ agent: 'a1', usd: 50, t: MES_PASADO }),
      linea({ agent: 'a2', routine: 'r1', usd: 4 }),
    ], AHORA);
    assert.deepEqual(g.agente.a1, { dia: 1, mes: 3 });
    assert.deepEqual(g.agente.a2, { dia: 4, mes: 4 });
    assert.deepEqual(g.rutina.r1, { dia: 4, mes: 4 });
    assert.equal(g.rutina.r2, undefined);
  });

  it('una línea sin agente ni rutina no cuenta para nadie', () => {
    const g = gastoPorDueno([linea({ usd: 9 })], AHORA);
    assert.deepEqual(g, { agente: {}, rutina: {} });
  });

  it('la rutina de una línea sale de su tarea cuando la línea no la trae (la nube)', () => {
    const l = [linea({ agent: 'a1', task: 't1', usd: 2 }), linea({ agent: 'a1', task: 't2', usd: 3 })];
    const con = conRutinaDeTarea(l, [{ id: 't1', routine: 'r1' }, { id: 't2' }]);
    assert.equal(con[0].routine, 'r1');
    assert.equal(con[1].routine, undefined);
    // No toca la que ya la trae, ni copia nada si ninguna tarea tiene rutina.
    const yaTiene = conRutinaDeTarea([linea({ task: 't1', routine: 'otra' })], [{ id: 't1', routine: 'r1' }]);
    assert.equal(yaTiene[0].routine, 'otra');
    assert.equal(conRutinaDeTarea(l, [{ id: 't1' }]), l);
  });
});

describe('los topes', () => {
  it('la oficina no cambia: sin topes puestos, nadie está frenado', () => {
    assert.equal(config({}).perAgentDay, 0);
    assert.equal(DEFAULTS.perRoutineMonth, 0);
    const f = frenosDePresupuesto([linea({ agent: 'a1', usd: 999 })], {}, { now: AHORA });
    assert.deepEqual(f, { agentes: {}, rutinas: {} });
  });

  it('el tope propio de una ficha gana sobre el de la oficina', () => {
    const cfg = { perAgentDay: 5, perRoutineDay: 5 };
    assert.deepEqual(topesDe(cfg, {}), { dia: 5, mes: 0 });
    assert.deepEqual(topesDe(cfg, { propio: { budgetDay: 20, budgetMonth: 100 } }), { dia: 20, mes: 100 });
    // Un 0 propio no apaga el de la oficina: para eso está el de la oficina en 0.
    assert.deepEqual(topesDe(cfg, { propio: { budgetDay: 0 } }), { dia: 5, mes: 0 });
    assert.deepEqual(topesDe(cfg, { rutina: true }), { dia: 5, mes: 0 });
  });

  it('frena al que se pasó, dice por qué, y no frena a los demás', () => {
    const lineas = [
      linea({ agent: 'caro', usd: 7 }),
      linea({ agent: 'barato', usd: 1 }),
      linea({ agent: 'x', routine: 'diaria', usd: 3 }),
    ];
    const f = frenosDePresupuesto(lineas, { perAgentDay: 5, perRoutineDay: 2 }, { now: AHORA });
    assert.match(f.agentes.caro, /presupuesto de hoy \(US\$7\.00 de US\$5\.00\)/);
    assert.equal(f.agentes.barato, undefined);
    assert.match(f.rutinas.diaria, /presupuesto de hoy/);
  });

  it('el del mes manda sobre el del día cuando los dos se cruzan', () => {
    const lineas = [linea({ agent: 'a1', usd: 4 }), linea({ agent: 'a1', usd: 20, t: AYER })];
    const f = frenosDePresupuesto(lineas, { perAgentDay: 3, perAgentMonth: 10 }, { now: AHORA });
    assert.match(f.agentes.a1, /presupuesto del mes \(US\$24\.00 de US\$10\.00\)/);
  });

  it('justo en el tope ya frena (>=), no hace falta pasarse', () => {
    const f = frenosDePresupuesto([linea({ agent: 'a1', usd: 5 })], { perAgentDay: 5 }, { now: AHORA });
    assert.ok(f.agentes.a1);
  });

  it('un tope propio en una ficha frena aunque la oficina no tenga ninguno', () => {
    const f = frenosDePresupuesto([linea({ agent: 'a1', usd: 9 })], {}, { now: AHORA, agentes: { a1: { budgetDay: 1 } } });
    assert.ok(f.agentes.a1);
  });
});

describe('la cola corta de verdad', () => {
  const t = (id, agent, extra = {}) => ({ id, state: 'next', agent, addedAt: AHORA - 60e3, ...extra });

  it('la tarea de un agente frenado no arranca; la de otro agente sí', () => {
    const tareas = [t('t1', 'caro'), t('t2', 'barato')];
    const frenados = { agentes: { caro: 'llegó a su presupuesto de hoy (US$7.00 de US$5.00)' }, rutinas: {} };
    const { arrancar, puestos } = planear(tareas, { max: 3, ahora: AHORA, frenados });
    assert.deepEqual(arrancar, ['t2']);
    assert.equal(puestos.t1.why, 'tope');
    assert.match(puestos.t1.motivo, /presupuesto de hoy/);
  });

  it('la tarea de una RUTINA frenada no arranca aunque su agente tenga presupuesto', () => {
    const tareas = [t('t1', 'a1', { routine: 'diaria' }), t('t2', 'a2')];
    const frenados = { agentes: {}, rutinas: { diaria: 'llegó a su presupuesto de hoy (US$3.00 de US$2.00)' } };
    const { arrancar, puestos } = planear(tareas, { max: 3, ahora: AHORA, frenados });
    assert.deepEqual(arrancar, ['t2']);
    assert.equal(puestos.t1.why, 'tope');
  });

  it('sin `frenados` la cola es exactamente la de siempre', () => {
    const tareas = [t('t1', 'caro', { routine: 'diaria' }), t('t2', 'barato')];
    assert.deepEqual(planear(tareas, { max: 3, ahora: AHORA }), planear(tareas, { max: 3, ahora: AHORA, frenados: null }));
    assert.deepEqual(planear(tareas, { max: 3, ahora: AHORA }).arrancar, ['t1', 't2']);
  });

  it('el tope del MES de la oficina sigue mandando sobre todo', () => {
    const tareas = [t('t1', 'a1')];
    const { arrancar, puestos } = planear(tareas, { max: 3, ahora: AHORA, sinPresupuesto: true, frenados: { agentes: { a1: 'x' }, rutinas: {} } });
    assert.deepEqual(arrancar, []);
    assert.equal(puestos.t1.why, 'presupuesto'); // el de la oficina se dice primero: es el que frena todo
  });

  it('explicarCola lo cuenta aparte y lo dice en palabras', () => {
    const tareas = [t('t1', 'caro'), t('t2', 'barato')];
    const frenados = { agentes: { caro: 'llegó a su presupuesto de hoy' }, rutinas: {} };
    const ex = explicarCola(tareas, { max: 3, ahora: AHORA, frenados });
    assert.equal(ex.razones.tope, 1);
    assert.equal(ex.razones.presupuesto, 0);
    assert.match(ex.texto, /presupuesto de su agente o de su rutina/);
    assert.ok(ex.esperando >= 1); // sí espera a la oficina: no es una tarea de una persona
  });
});
