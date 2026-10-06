// Plan T0/T1 (6 oct 2026): el módulo de tareas — la fábrica, los estados, la mezcla de cambios, la cola, las dependencias, el orden,
// los permisos, la agenda, el progreso de un proyecto y las analíticas. Todo puro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearTarea, normalizar, leerCampos, pasosDe, normalizarPasos, limiteMs, ESQUEMA } from '../tareas/modelo.mjs';
import { visible, puede, bloqueos } from '../tareas/estados.mjs';
import { mezclar, diferencias, quienPorDefecto } from '../tareas/cambios.mjs';
import { planear, ordenCola, ocupacion } from '../tareas/cola.mjs';
import { ciclo, desbloqueadas, limpiar, siguientes } from '../tareas/dependencias.mjs';
import { entre, colocar, repartir, HUECO } from '../tareas/orden.mjs';
import { revisar, puedeMarcarPaso } from '../tareas/permisos.mjs';
import { agenda, agendaTexto, fechaDe } from '../tareas/agenda.mjs';
import { progresoProyecto } from '../tareas/progreso.mjs';
import { resumenTareas } from '../tareas/resumen.mjs';
import { crearBus } from '../tareas/eventos.mjs';

test('una sola fábrica: valores por defecto que no piden nada, el plan del enrutador se vuelve pasos, una fecha la programa', () => {
  let n = 0; const t = crearTarea({ dept: 'sales', agent: 'piper', text: '  Propuesta para Acme ', plan: ['Leer el hilo', 'Escribir', ''], by: 'you' }, { id: () => 'k' + ++n, ahora: 5 });
  assert.equal(t.id, 'k1'); assert.equal(t.title, 'Propuesta para Acme'); assert.equal(t.text, 'Propuesta para Acme'); assert.equal(t.state, 'next'); assert.equal(t.addedAt, 5);
  assert.equal(t.prioridad, 'media'); assert.equal(t.v, ESQUEMA); assert.equal(t.version, 1);
  assert.deepEqual(t.pasos.map(p => [p.texto, p.hecho]), [['Leer el hilo', false], ['Escribir', false]]);
  assert.ok(!('etiquetas' in t) && !('limite' in t) && !('proyecto' in t), 'lo vacío no se guarda');
  const p = crearTarea({ dept: 'ops', agent: 'x', text: 'y', dueAt: 99, prioridad: 'alta', limite: '2026-10-20', estimacion: '45', etiquetas: ['e-a', 'e-a', 'e-b'], bloqueadaPor: ['z', 'self'] }, { id: 'self' });
  assert.equal(p.state, 'scheduled'); assert.equal(p.prioridad, 'alta'); assert.equal(p.limite, '2026-10-20'); assert.equal(p.estimacion, 45);
  assert.deepEqual(p.etiquetas, ['e-a', 'e-b']); assert.deepEqual(p.bloqueadaPor, ['z'], 'no se bloquea a sí misma');
  assert.equal(crearTarea({ text: 'x', state: 'idea' }).state, 'idea'); assert.equal(crearTarea({ text: 'x', state: 'doing' }).state, 'next', 'nadie nace en curso');
  assert.equal(crearTarea({ text: 'x', prioridad: 'urgente', limite: 'viernes' }).prioridad, 'media');
});

test('la migración: lo de antes se lee en la forma de hoy, sin pasos inventados en lo ya hecho, y es idempotente', () => {
  const v1 = { id: 'a', state: 'next', plan: ['uno', 'dos'], addedAt: 1 };
  const n = normalizar(v1); assert.equal(n.v, ESQUEMA); assert.equal(n.prioridad, 'media'); assert.equal(n.version, 1); assert.equal(n.pasos.length, 2);
  assert.equal(normalizar(n), n, 'una v2 vuelve igual');
  assert.ok(!normalizar({ id: 'b', state: 'done', plan: ['x'] }).pasos, 'lo hecho no gana pasos sin marcar');
});

test('los campos que llegan: errores en palabras, null borra, y los pasos se juntan por id sin perder lo marcado', () => {
  assert.match(leerCampos({ prioridad: 'ya' }).error, /alta, media o baja/);
  assert.match(leerCampos({ limite: '20/10' }).error, /AAAA-MM-DD/);
  assert.match(leerCampos({ etiquetas: ['nope'] }, { existeEtiqueta: () => false }).error, /no existe la etiqueta «nope»/);
  assert.match(leerCampos({ proyecto: 'pr-x' }, { existeProyecto: () => false }).error, /ese proyecto no existe/);
  assert.match(leerCampos({ estimacion: -3 }).error, /minutos/);
  assert.deepEqual(leerCampos({ proyecto: null, estimacion: '' }).campos, { proyecto: null, estimacion: null });
  assert.equal(limiteMs('2026-10-20'), new Date('2026-10-20T23:59').getTime());
  const viejos = [{ id: 'p1', texto: 'A', hecho: true, at: 7, por: 'agente:x' }, { id: 'p2', texto: 'B', hecho: false }];
  const nuevos = normalizarPasos([{ id: 'p1', texto: 'A cambiado' }, 'C nuevo'], viejos);
  assert.deepEqual(nuevos.map(p => [p.id === 'p1' ? 'p1' : 'nuevo', p.texto, p.hecho]), [['p1', 'A cambiado', true], ['nuevo', 'C nuevo', false]]);
  assert.equal(pasosDe(['  ', 'x']).length, 1);
});

test('los estados: lo que se ve sale de lo guardado y de las marcas; cada puerta pregunta antes de mover', () => {
  const dep = { id: 'd', state: 'next' };
  assert.equal(visible({ state: 'done', error: true }), 'fallida'); assert.equal(visible({ state: 'done' }), 'hecha');
  assert.equal(visible({ state: 'next', person: 'Ana' }), 'en_manos'); assert.equal(visible({ state: 'scheduled' }), 'programada');
  assert.equal(visible({ state: 'next', bloqueadaPor: ['d'] }, { d: dep }), 'bloqueada');
  assert.equal(visible({ state: 'next', bloqueadaPor: ['d'] }, { d: { ...dep, state: 'done' } }), 'en_cola', 'terminada bien, ya no bloquea');
  assert.equal(visible({ state: 'next', bloqueadaPor: ['d'] }, { d: { ...dep, state: 'done', error: true } }), 'bloqueada', 'una que falló sigue bloqueando');
  assert.equal(bloqueos({ bloqueadaPor: ['gone'] }, {}).length, 0, 'una dependencia borrada no bloquea');
  assert.ok(puede('idea', 'next', 'dueno').ok); assert.equal(puede('idea', 'next', 'agente').codigo, 'permiso');
  assert.equal(puede('waiting', 'done', 'agente').codigo, 'permiso', 'un agente nunca aprueba');
  assert.equal(puede('next', 'doing', 'dueno').codigo, 'permiso', 'la cola arranca, no la página');
  assert.equal(puede('done', 'waiting', 'oficina').codigo, 'transicion');
  assert.match(puede('idea', 'next', 'agente').motivo, /dueño o el jefe/);
});

test('mezclar: lo que el dueño hizo mientras un agente trabajaba ya no se pierde', () => {
  const base = { id: 't', state: 'doing', title: 'X', prioridad: 'media', comments: [{ at: 1, by: 'Tú', text: 'hola' }], pasos: [{ id: 'a', texto: 'A', hecho: false }, { id: 'b', texto: 'B', hecho: false }], version: 3 };
  const mio = { ...base, state: 'done', result: 'listo', doneAt: 9, pasos: [{ id: 'a', texto: 'A', hecho: true }, { id: 'b', texto: 'B', hecho: false }] };
  const enDisco = { ...base, prioridad: 'alta', person: undefined, comments: [...base.comments, { at: 5, by: 'Tú', text: 'ojo con el precio' }], vote: 'up', pasos: [{ id: 'a', texto: 'A', hecho: false }, { id: 'b', texto: 'B', hecho: true }], version: 4 };
  const { tarea, choques } = mezclar(base, mio, enDisco);
  assert.equal(tarea.state, 'done'); assert.equal(tarea.result, 'listo'); assert.equal(tarea.prioridad, 'alta'); assert.equal(tarea.vote, 'up');
  assert.deepEqual(tarea.comments.map(c => c.text), ['hola', 'ojo con el precio']);
  assert.deepEqual(tarea.pasos.map(p => [p.id, p.hecho]), [['a', true], ['b', true]], 'un paso marcado en cualquiera de los dos queda marcado');
  assert.equal(tarea.version, 4); assert.deepEqual(choques, []);
  const ambos = mezclar({ prioridad: 'media', state: 'doing' }, { prioridad: 'baja', state: 'done' }, { prioridad: 'alta', state: 'doing' });
  assert.equal(ambos.tarea.prioridad, 'alta', 'en un choque, lo del dueño gana'); assert.equal(ambos.tarea.state, 'done', 'y el estado es de la ejecución'); assert.deepEqual(ambos.choques, ['prioridad']);
  assert.equal(mezclar(base, mio, null).tarea, mio);
});

test('las diferencias son la bitácora: estado, campos, pasos, comentarios; y quién lo hizo si nadie lo dijo', () => {
  const a = { id: 't', state: 'next', title: 'A', prioridad: 'media', pasos: [{ id: 'p', texto: 'x', hecho: false }] };
  const d = diferencias(a, { ...a, state: 'doing', prioridad: 'alta', pasos: [{ id: 'p', texto: 'x', hecho: true, por: 'agente:piper' }, { id: 'q', texto: 'y' }], comments: [{ by: 'Tú', text: 'hola' }] });
  assert.deepEqual(d.map(x => x.tipo + (x.campo ? ':' + x.campo : x.accion ? ':' + x.accion : '')), ['estado', 'campo:prioridad', 'paso:hecho', 'paso:añadido', 'comentario']);
  assert.equal(diferencias(null, a)[0].tipo, 'creada'); assert.equal(diferencias(a, null)[0].tipo, 'borrada'); assert.deepEqual(diferencias(a, { ...a }), []);
  assert.equal(diferencias(a, { ...a, state: 'done', error: true })[0].a, 'done:error');
  assert.equal(quienPorDefecto({ state: 'next' }, { state: 'doing' }), 'oficina');
  assert.equal(quienPorDefecto({ state: 'doing' }, { state: 'waiting', agent: 'piper' }), 'agente:piper');
  assert.equal(quienPorDefecto(null, { by: 'routine' }), 'rutina');
});

test('la cola: prioridad → fecha límite → orden manual → antigüedad; espera lo bloqueado, lo de una persona y el agente ocupado; un equipo cuenta por pieza', () => {
  const T = (id, x) => ({ id, state: 'next', agent: id, addedAt: 10, ...x });
  const l = [T('viejo', { addedAt: 1 }), T('alta', { prioridad: 'alta', addedAt: 9 }), T('lim', { limite: '2026-10-07', addedAt: 8 }), T('ord', { orden: 5, addedAt: 7 })];
  assert.deepEqual(l.slice().sort(ordenCola).map(t => t.id), ['alta', 'lim', 'ord', 'viejo']);
  const dep = { id: 'dep', state: 'doing', agent: 'z' };
  const lista = [dep, T('bloq', { bloqueadaPor: ['dep'], prioridad: 'alta' }), T('pers', { person: 'Ana' }), T('a1', { agent: 'z' }), T('libre'), T('otra', { addedAt: 20 })];
  const r = planear(lista, { max: 2 });
  assert.deepEqual(r.arrancar, ['libre'], 'z está ocupado y solo queda un hueco (dep ocupa uno)');
  assert.equal(r.puestos.bloq.why, 'bloqueada'); assert.equal(r.puestos.pers.why, 'persona'); assert.equal(r.puestos.a1.why, 'agente'); assert.equal(r.puestos.otra.why, 'oficina');
  const equipo = { id: 'eq', state: 'doing', agent: 'lead', team: { pieces: [{ agent: 'p1', state: 'doing' }, { agent: 'p2', state: 'doing' }, { agent: 'p3', state: 'done' }] } };
  assert.equal(ocupacion([equipo]).procesos, 2); assert.ok(ocupacion([equipo]).agentes.has('p1'));
  assert.deepEqual(planear([equipo, T('p1'), T('x')], { max: 3 }).arrancar, ['x'], 'el agente de una pieza en marcha está ocupado y las piezas llenan los huecos');
  assert.equal(planear([T('x')], { max: 3, sinPresupuesto: true }).puestos.x.why, 'presupuesto');
});

test('las dependencias: un círculo se rechaza; al terminar una, siguen las que ya no esperan a nadie', () => {
  const l = [{ id: 'a', bloqueadaPor: ['b'] }, { id: 'b', bloqueadaPor: ['c'] }, { id: 'c' }, { id: 'd', bloqueadaPor: ['c', 'a'], state: 'next' }];
  assert.deepEqual(ciclo(l, 'c', ['a']), ['c', 'a', 'b', 'c']); assert.ok(ciclo(l, 'c', ['d']), 'd espera a c: c no puede esperar a d');
  assert.equal(ciclo(l, 'a', ['c']), null);
  assert.deepEqual(limpiar(l, 'a', ['a', 'zz', 'c', 'c']), ['c']);
  const hecho = [{ id: 'x', state: 'done' }, { id: 'y', state: 'next', bloqueadaPor: ['x'] }, { id: 'z', state: 'next', bloqueadaPor: ['x', 'w'] }, { id: 'w', state: 'next' }];
  assert.deepEqual(desbloqueadas(hecho, 'x').map(t => t.id), ['y']);
  assert.deepEqual(siguientes(hecho, { id: 'x' }).map(t => t.id), ['y', 'z']);
});

test('el orden manual: el punto medio, al principio y al final; si no cabe, se reparte la columna', () => {
  assert.equal(entre(null, null), HUECO); assert.equal(entre(1024, 2048), 1536); assert.equal(entre(null, 1024), 0); assert.equal(entre(2048, null), 3072); assert.equal(entre(1, 1 + 1e-9), null);
  const vista = [{ id: 'a', orden: 1024 }, { id: 'b', orden: 2048 }, { id: 'c', orden: 3072 }];
  assert.deepEqual(colocar(vista, 'c', 1), { c: 1536 });
  assert.deepEqual(colocar([{ id: 'a' }, { id: 'b', orden: 5 }], 'n', 1), repartir(['a', 'n', 'b']), 'sin orden en todas, se reparte');
});

test('los permisos por campo: un agente solo marca pasos de SU tarea en curso; lo de trabajo, solo antes de empezar', () => {
  const t = { state: 'doing', agent: 'piper' };
  assert.ok(!revisar(t, ['prioridad'], 'agente').ok); assert.match(revisar(t, ['limite'], 'agente').motivo, /un agente no puede cambiar la fecha límite/);
  assert.ok(revisar(t, ['prioridad', 'etiquetas'], 'dueno').ok, 'organizar vale en curso');
  assert.match(revisar(t, ['text'], 'dueno').motivo, /antes de que empiece/);
  assert.match(revisar({ state: 'done' }, ['prioridad'], 'dueno').motivo, /ya está hecha/); assert.ok(revisar({ state: 'done' }, ['etiquetas'], 'dueno').ok);
  assert.ok(puedeMarcarPaso(t, 'piper')); assert.ok(!puedeMarcarPaso(t, 'otro')); assert.ok(!puedeMarcarPaso({ ...t, state: 'next' }, 'piper'));
  assert.ok(puedeMarcarPaso({ state: 'doing', agent: 'lead', team: { pieces: [{ agent: 'p1', state: 'doing' }] } }, 'p1'), 'el de una pieza en marcha también');
});

test('la agenda: vencidas, hoy, en curso, esperan el OK, bloqueadas, próximas y recientes; y en palabras con ids', () => {
  const ahora = new Date('2026-10-06T10:00').getTime();
  const l = [
    { id: 'v', state: 'next', title: 'Vencida', limite: '2026-10-05', agent: 'a' },
    { id: 'h', state: 'next', title: 'Hoy', limite: '2026-10-06', agent: 'a', prioridad: 'alta' },
    { id: 'c', state: 'doing', title: 'En curso', agent: 'b', pasos: [{ hecho: true }, { hecho: false }] },
    { id: 'w', state: 'waiting', title: 'OK', agent: 'a', waitingAt: 5 },
    { id: 'p', state: 'scheduled', title: 'Jueves', dueAt: new Date('2026-10-08T09:00').getTime(), agent: 'a' },
    { id: 'b', state: 'next', title: 'Bloq', bloqueadaPor: ['c'], agent: 'a' },
    { id: 'r', state: 'done', title: 'Ayer', doneAt: ahora - 3600e3, agent: 'a' },
    { id: 'i', state: 'idea', title: 'Idea', agent: 'a' },
  ];
  const a = agenda(l, { ahora });
  assert.deepEqual(Object.fromEntries(['vencidas', 'hoy', 'enCurso', 'esperanOk', 'bloqueadas', 'proximas', 'recientes'].map(k => [k, a[k].map(t => t.id)])),
    { vencidas: ['v'], hoy: ['h'], enCurso: ['c'], esperanOk: ['w'], bloqueadas: ['b'], proximas: ['p'], recientes: ['r'] });
  assert.equal(fechaDe(l[4]), '2026-10-08');
  const txt = agendaTexto(a); assert.match(txt, /VENCIDAS \(1\):\n- v · «Vencida»/); assert.match(txt, /h · «Hoy» · a · prioridad ALTA · límite 2026-10-06/); assert.match(txt, /pasos 1\/2/);
  assert.deepEqual(agenda(l, { ahora, agente: 'b' }).enCurso.map(t => t.id), ['c']);
});

test('el progreso de un proyecto y las analíticas: cada cifra con sus tareas, y lo que no se sabe es null', () => {
  const ahora = new Date('2026-10-10T12:00').getTime();
  const l = [
    { id: '1', proyecto: 'pr-l', state: 'done', addedAt: ahora - 7200e3, doneAt: ahora - 3600e3, limite: '2026-10-11', cost: 0.5, waitingAt: ahora - 5400e3, approvedAt: ahora - 3600e3 },
    { id: '2', proyecto: 'pr-l', state: 'next', agent: 'x', bloqueadaPor: ['3'], limite: '2026-10-09' },
    { id: '3', proyecto: 'pr-l', state: 'doing', agent: 'x' },
    { id: '4', state: 'done', error: true, doneAt: ahora - 100, addedAt: ahora - 200, revisions: 2 },
  ];
  const p = progresoProyecto({ id: 'pr-l', limite: '2026-10-20' }, l, ahora);
  assert.equal(p.total, 3); assert.equal(p.hechas, 1); assert.equal(p.bloqueadas, 1); assert.equal(p.enCurso, 1); assert.equal(p.vencidas, 1); assert.equal(p.pct, 33); assert.equal(p.atrasado, true); assert.equal(p.diasRestantes, 10);
  const lineas = [{ t: 0, tarea: '1', tipo: 'creada', estado: 'next' }, { t: 60000, tarea: '1', tipo: 'estado', de: 'next', a: 'doing' }, { t: 180000, tarea: '1', tipo: 'estado', de: 'doing', a: 'done' }];
  const r = resumenTareas({ tareas: l, lineas, desde: 0, ahora, nombre: id => id.toUpperCase() });
  assert.equal(r.hechas.valor, 1); assert.deepEqual(r.hechas.ids, ['1']); assert.equal(r.fallidas.valor, 1); assert.equal(r.aTiempo.valor, 1); assert.equal(r.tarde.valor, 0);
  assert.equal(r.cicloMin.valor, 60); assert.equal(r.esperaOkMin.valor, 30); assert.equal(r.bloqueadas.valor, 1); assert.equal(r.vencidas.valor, 1); assert.equal(r.devueltas.veces, 2);
  assert.deepEqual(r.tiempoEnEstado, { next: { mediana: 1, n: 1 }, doing: { mediana: 2, n: 1 } });
  assert.equal(r.carga[0].quien, 'X'); assert.equal(r.carga[0].abiertas, 2);
  assert.equal(resumenTareas({}).cicloMin.valor, null, 'sin datos, null — nunca un cero inventado');
});

test('el bus: un oyente que falla no tumba a los demás', async () => {
  const errores = [], bus = crearBus({ registrar: (t, e) => errores.push(e.message) }), vistos = [];
  bus.on('tarea.estado', () => { throw new Error('roto'); }); bus.on('tarea.estado', d => vistos.push(d.a)); bus.on('*', (d, tipo) => vistos.push(tipo));
  bus.on('tarea.estado', async () => { throw new Error('roto async'); });
  bus.emit('tarea.estado', { a: 'done' }); await new Promise(r => setImmediate(r));
  assert.deepEqual(vistos, ['done', 'tarea.estado']); assert.deepEqual(errores, ['roto', 'roto async']);
});
