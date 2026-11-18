// VAN-06 en la nube: el presupuesto por agente y por rutina CORTA de verdad.
//
// El criterio de aceptación del plan: «un test corta una rutina al pasar su tope diario y registra el motivo».
// Aquí se comprueba con D1 de verdad y el reloj de los agentes, no con dobles:
//   1. Con el tope de la rutina cruzado, su tarea NO la toma la cola (se queda en `next`) y la de otra rutina sí.
//   2. Lo mismo por agente, y el motivo se dice en palabras.
//   3. Sin topes puestos, el reloj se comporta exactamente como antes (y no lee el libro de costos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, tareaEnDisco, crearFetch, texto, minutos } from './agentes-ayudas.mjs';
import * as TAREAS from '../worker/modulos/tareas.js';
import * as costos from '../worker/lib/agentes/costos.js';

/** Un gasto ya hecho en el libro, como si una ejecución de antes lo hubiera apuntado. */
const gastar = (d1, { tarea: t = null, agente = null, usd, t: cuando = Date.now() }) =>
  d1._db.prepare('insert into costos (t, tarea, agente, dept, tipo, modelo, proveedor, tin, tout, cache_read, cache_write, usd, fuente, ms) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(cuando, t, agente, 'emails', 'task', 'claude-sonnet-5', 'anthropic', 0, 0, 0, 0, usd, 'tabla', null);

test('una RUTINA que pasó su tope diario no arranca más; la de otra rutina sí', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ ajustes: { costs: { perRoutineDay: 2 } } });
  // Lo que ya gastó hoy la rutina «caray»: una tarea suya terminada y su línea en el libro.
  const vieja = await tarea(env, { routine: 'caray', title: 'Lo de ayer' });
  gastar(d1, { tarea: vieja.id, agente: 'elead', usd: 3 });

  const dela = await tarea(env, { routine: 'caray', title: 'Otra de la rutina caray' });
  const otra = await tarea(env, { routine: 'tranquila', title: 'De otra rutina' });

  const frenados = await costos.frenos(d1, { perRoutineDay: 2 }, await TAREAS.leerTareas(d1));
  assert.match(frenados.rutinas.caray, /presupuesto de hoy \(US\$3\.00 de US\$2\.00\)/, 'dice el motivo con sus cifras');
  assert.equal(frenados.rutinas.tranquila, undefined);

  const tomadas = await TAREAS.tomarSiguiente(d1, { max: 3, frenados });
  const ids = tomadas.map(t => t.id);
  assert.ok(!ids.includes(dela.id), 'la tarea de la rutina frenada se queda en la cola');
  assert.ok(ids.includes(otra.id), 'la de la otra rutina arranca');
  assert.equal((await tareaEnDisco(d1, dela.id)).state, 'next');
});

test('un AGENTE que pasó su tope del mes no arranca más, y el reloj no lo toca', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ ajustes: { costs: { perAgentMonth: 5 } } });
  const vieja = await tarea(env, { title: 'Lo de antes' });
  gastar(d1, { tarea: vieja.id, agente: 'elead', usd: 6 });
  const suya = await tarea(env, { title: 'Otra de elead' });

  const f = crearFetch({ guion: [texto('No debería ejecutarse.\nFuentes: —')] });
  const [r] = await minutos(env, f.fetchFn);
  assert.deepEqual(r.frenados, { agentes: 1, rutinas: 0 });
  assert.ok(!r.tomadas.includes(suya.id), 'el reloj no la toma');
  assert.equal((await tareaEnDisco(d1, suya.id)).state, 'next');
  assert.equal(f.registro.anthropic.length, 0, 'no se llamó al modelo: el corte es antes de gastar');
});

test('sin topes puestos, nada cambia: el reloj arranca la tarea y no mira el libro', { skip: SALTAR }, async () => {
  // Con el presupuesto de la invocación holgado, una sola vuelta la toma Y la ejecuta (como en agentes-robustez).
  const { d1, env } = await oficina({ env: { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' } });
  const t = await tarea(env);
  gastar(d1, { agente: 'elead', usd: 9999 }); // mucho gasto, pero sin tope por agente no frena a nadie
  assert.equal(await costos.frenos(d1, {}, await TAREAS.leerTareas(d1)), null);

  const f = crearFetch({ guion: [texto('Hecho.\nFuentes: —')] });
  const [r] = await minutos(env, f.fetchFn);
  assert.equal(r.frenados, null);
  assert.ok(r.tomadas.includes(t.id));
  // Una vuelta del reloj la TOMA y da su primer paso (terminarla puede llevar otra): lo que importa es que arrancó.
  assert.ok(['doing', 'done'].includes((await tareaEnDisco(d1, t.id)).state));
  assert.ok(f.registro.anthropic.length >= 1, 'se llamó al modelo: nada la frenó');
});
