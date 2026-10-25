// Versión móvil (25 oct 2026), equipo E — Tareas, Calendario y Dimitri completos. Lo PURO (el horario de una rutina y mover una ejecución, los filtros de
// tareas y qué columnas admite una tarea, la columna de 24 horas del día) y lo que toca al servidor (una rutina «con todo el equipo»). El recorrido de
// navegador (scripts/movil-e-recorrido.mjs) corre en tests/movil-e-navegador.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formDe, whenDeForm, validarForm, cambiosDe, moverEjecucion, resumenForm } from '../src/movil/rutinas-puro.js';
import { aplicarFiltro, pasaFiltro, filtroVacio, contarFiltro, filtroTexto, guardarFiltro, quitarFiltro, destinos, bloqueos, porEstado, conCronometro, reloj, idsDeCifra } from '../src/movil/tareas-puro.js';
import { distribuir, lineaAhora, scrollInicial, horaDeToque, PX_HORA, MIN_ALTO } from '../src/movil/dia-puro.js';
import { cifrasDe } from '../src/movil/vistas/tareas-medidas.js';
import { crearTarea } from '../tareas/modelo.mjs';

const HOY = '2026-10-25';

/* ---------- el horario de una rutina ---------- */
test('rutina: los siete botones arman un semanal con los días de lunes a domingo y la hora', () => {
  const f = formDe(null); f.days = [0, 4, 1]; f.at = '07:30';
  const r = whenDeForm(f, { hoy: HOY });
  assert.deepEqual(r.when, { kind: 'weekly', at: '07:30', days: [1, 4, 0] }); // lun, jue, dom
  assert.equal(resumenForm(f, { hoy: HOY }), 'lun, jue, dom a las 07:30');
});
test('rutina: sin ningún día, sin hora o con un horario roto, dice qué falta y no devuelve horario', () => {
  const f = formDe(null); f.days = [];
  assert.equal(whenDeForm(f, { hoy: HOY }).when, null); assert.match(whenDeForm(f, { hoy: HOY }).errores.days, /al menos un día/);
  f.days = [1]; f.at = ''; assert.match(whenDeForm(f, { hoy: HOY }).errores.at, /hora/);
});
test('rutina: cada hora (franja y solo laborables), mensual (día, último y «el segundo martes»), desde, hasta y veces', () => {
  const h = formDe(null); h.kind = 'hourly'; h.cada = 2; h.ventana = true; h.desde = '09:00'; h.hasta = '17:00'; h.soloLab = true;
  assert.deepEqual(whenDeForm(h, { hoy: HOY }).when, { kind: 'hourly', every: 2, from: '09:00', to: '17:00', weekdaysOnly: true });
  h.hasta = '08:00'; assert.match(whenDeForm(h, { hoy: HOY }).errores.ventana, /antes que la de fin/);
  const m = formDe(null); m.kind = 'monthly'; m.dia = -1; assert.deepEqual(whenDeForm(m, { hoy: HOY }).when, { kind: 'monthly', at: '09:00', day: -1 });
  m.modo = 'nth'; m.nth = 2; m.weekday = 2; assert.deepEqual(whenDeForm(m, { hoy: HOY }).when, { kind: 'monthly', at: '09:00', nth: 2, weekday: 2 });
  m.modo = 'dia'; m.dia = 40; assert.match(whenDeForm(m, { hoy: HOY }).errores.dia, /1 a 31/);
  const d = formDe(null); d.kind = 'daily'; d.inicio = '2026-11-02'; d.fin = '2026-11-30'; d.veces = '6';
  assert.deepEqual(whenDeForm(d, { hoy: HOY }).when, { kind: 'daily', at: '09:00', start: '2026-11-02', end: '2026-11-30', count: 6 });
  d.fin = '2026-10-30'; assert.match(whenDeForm(d, { hoy: HOY }).errores.fin, /antes de empezar/);
  d.inicio = '2026-10-01'; d.fin = ''; assert.match(whenDeForm(d, { hoy: HOY }).errores.inicio, /ya pasó/);
});
test('rutina: crear exige el texto y el departamento; manda team, needsOk y el agente solo si se eligió', () => {
  const f = formDe(null, { dept: 'fin' }); assert.equal(validarForm(f, { crear: true, hoy: HOY }).ok, false); assert.match(validarForm(f, { crear: true, hoy: HOY }).errores.texto, /Escribe qué/);
  f.texto = ' Cobrar las facturas '; f.equipo = true; f.needsOk = false;
  const v = validarForm(f, { crear: true, hoy: HOY });
  assert.equal(v.ok, true); assert.deepEqual(v.cuerpo, { text: 'Cobrar las facturas', when: { kind: 'weekly', at: '09:00', days: [1] }, needsOk: false, team: true, dept: 'fin' });
  f.agente = 'invo'; assert.equal(validarForm(f, { crear: true, hoy: HOY }).cuerpo.agent, 'invo');
});
test('rutina: editar manda solo lo que cambió', () => {
  const r = { id: 'x', dept: 'fin', agent: 'invo', text: 'Cobrar', when: { kind: 'weekly', at: '09:00', days: [1] }, needsOk: true };
  const f = formDe(r); assert.deepEqual(cambiosDe(r, f, { hoy: HOY }).cambios, {});
  f.texto = 'Cobrar y avisar'; f.needsOk = false; f.days = [1, 3];
  assert.deepEqual(cambiosDe(r, f, { hoy: HOY }).cambios, { text: 'Cobrar y avisar', when: { kind: 'weekly', at: '09:00', days: [1, 3] }, needsOk: false });
});

/* ---------- mover una ejecución ---------- */
const lunes9 = new Date('2026-10-26T09:00').getTime(), AHORA = new Date('2026-10-25T12:00').getTime();
test('mover una ejecución: la hora cambia «siempre» la hora; el día de una semanal cambia el día', () => {
  const r = { when: { kind: 'weekly', at: '09:00', days: [1, 4] } };
  const h = moverEjecucion(r, lunes9, new Date('2026-10-26T10:30').getTime(), AHORA);
  assert.equal(h.unaVez, true); assert.deepEqual(h.siempre, { kind: 'weekly', at: '10:30', days: [1, 4] });
  const d = moverEjecucion(r, lunes9, new Date('2026-10-27T09:00').getTime(), AHORA); // martes
  assert.deepEqual(d.siempre.days, [2, 4]); assert.equal(d.siempre.at, '09:00');
});
test('mover una ejecución: lo que no se puede para siempre dice por qué, y lo pasado no se mueve', () => {
  const horaria = { when: { kind: 'hourly', every: 2 } };
  assert.equal(moverEjecucion(horaria, lunes9, lunes9 + 36e5, AHORA).siempre, null); assert.match(moverEjecucion(horaria, lunes9, lunes9 + 36e5, AHORA).motivoSiempre, /Editar/);
  const diaria = { when: { kind: 'daily', at: '09:00' } };
  const m = moverEjecucion(diaria, lunes9, new Date('2026-10-27T09:00').getTime(), AHORA); assert.equal(m.siempre, null); assert.match(m.motivoSiempre, /solo esta vez/);
  assert.equal(moverEjecucion(diaria, lunes9, lunes9, AHORA).siempre, null); // no cambió nada
  const pasada = moverEjecucion(diaria, new Date('2026-10-24T09:00').getTime(), lunes9, AHORA); assert.equal(pasada.unaVez, false); assert.match(pasada.motivoUnaVez, /ya pasó/);
  const aTras = moverEjecucion(diaria, lunes9, new Date('2026-10-25T08:00').getTime(), AHORA); assert.equal(aTras.unaVez, false); assert.match(aTras.motivoUnaVez, /por venir/);
});

/* ---------- filtros de tareas ---------- */
const T = (o, i) => crearTarea({ title: 'x', ...o }, { id: 'f' + i, ahora: AHORA });
const tareas = [T({ title: 'Llamar al banco', prioridad: 'alta', etiquetas: ['e1'], proyecto: 'p1' }, 1), T({ title: 'Pagar el alquiler', prioridad: 'media', etiquetas: ['e1', 'e2'] }, 2), T({ title: 'Reunión con Ácme', text: 'llevar la propuesta' }, 3)];
test('filtros: prioridad, etiquetas (todas), proyecto, y texto sin tildes ni mayúsculas', () => {
  assert.equal(filtroVacio({ prio: [], etiquetas: [], proyecto: '', texto: ' ' }), true); assert.equal(aplicarFiltro(tareas, null), tareas);
  assert.deepEqual(aplicarFiltro(tareas, { prio: ['alta'] }).map(t => t.id), ['f1']);
  assert.deepEqual(aplicarFiltro(tareas, { etiquetas: ['e1', 'e2'] }).map(t => t.id), ['f2']);
  assert.deepEqual(aplicarFiltro(tareas, { proyecto: 'p1' }).map(t => t.id), ['f1']); assert.deepEqual(aplicarFiltro(tareas, { proyecto: '-' }).map(t => t.id), ['f2', 'f3']);
  assert.deepEqual(aplicarFiltro(tareas, { texto: 'acme' }).map(t => t.id), ['f3']); assert.deepEqual(aplicarFiltro(tareas, { texto: 'PROPUESTA' }).map(t => t.id), ['f3']);
  assert.equal(pasaFiltro(tareas[2], { prio: ['media'] }), true); // sin prioridad = media
  assert.equal(contarFiltro({ prio: ['alta', 'baja'], etiquetas: ['e1'], proyecto: 'p1', texto: 'a' }), 5);
  assert.equal(filtroTexto({ prio: ['alta'], etiquetas: ['e1'] }, { etiquetas: [{ id: 'e1', nombre: 'ventas' }] }), 'Prioridad alta · #ventas');
});
test('filtros guardados: máximo 8, el mismo nombre se reemplaza y un filtro vacío no se guarda', () => {
  let l = []; assert.equal(guardarFiltro(l, 'nada', { prio: [] }).length, 0);
  for (let i = 0; i < 10; i++) l = guardarFiltro(l, 'f' + i, { prio: ['alta'] }); assert.equal(l.length, 8);
  const antes = l.length; l = guardarFiltro(l, 'F9', { prio: ['baja'] }); assert.equal(l.length, antes); assert.deepEqual(l.at(-1).filtro.prio, ['baja']);
  assert.equal(quitarFiltro(l, l[0].id).length, antes - 1);
});

/* ---------- tablero, proyectos, cronómetro, medidas ---------- */
test('tablero: a qué columnas puede ir una tarea (las mismas reglas del tablero de escritorio)', () => {
  const idea = T({ title: 'i', state: 'idea', dept: 'ops', agent: 'x' }, 7), porId = new Map([[idea.id, idea]]);
  const d = destinos(idea, porId).map(x => x.accion).sort(); assert.ok(d.includes('pedir') && d.includes('tomar')); assert.ok(!d.includes('aprobar'));
  const mia = T({ title: 'm', person: 'Tú' }, 8); const dm = destinos(mia, new Map([[mia.id, mia]])).map(x => x.accion); assert.ok(dm.includes('hecha'));
  const enCurso = T({ title: 'c', dept: 'ops', agent: 'x' }, 9); enCurso.state = 'doing'; assert.deepEqual(destinos(enCurso, new Map([[enCurso.id, enCurso]])), []);
});
test('proyecto: las tareas por estado y quién espera a quién', () => {
  const a = T({ title: 'A' }, 20), b = T({ title: 'B', bloqueadaPor: [a.id] }, 21), c = T({ title: 'C' }, 22);
  const l = bloqueos([a, b, c]); assert.equal(l.length, 2); assert.deepEqual(l.find(x => x.id === b.id).espera.map(x => x.id), [a.id]); assert.deepEqual(l.find(x => x.id === a.id).laEsperan.map(x => x.id), [b.id]);
  assert.equal(porEstado([a, b, c], new Map([a, b, c].map(t => [t.id, t]))).length >= 1, true);
});
test('cronómetro: la tarea con un tramo abierto de esa persona, y el reloj en palabras', () => {
  const a = T({ title: 'A' }, 30), b = T({ title: 'B' }, 31); b.cronometro = [{ quien: 'Tú', inicio: 5 }, { quien: 'Ana', inicio: 9 }]; a.cronometro = [{ quien: 'Tú', inicio: 1, fin: 3 }];
  assert.equal(conCronometro([a, b], 'Tú').tarea.id, b.id); assert.equal(conCronometro([a, b], 'Ana').desde, 9); assert.equal(conCronometro([a], 'Tú'), null);
  assert.equal(reloj(65e3), '1:05'); assert.equal(reloj(3725e3), '1:02:05'); assert.equal(reloj(-5), '0:00');
});
test('medidas: diez cifras y «sin datos» cuando no se sabe (nunca un cero inventado)', () => {
  const c = x => ({ valor: x, ids: x ? ['a'] : [] });
  const r = { hechas: c(3), fallidas: c(0), aTiempo: { ...c(2), de: 3 }, tarde: c(1), cicloMin: { valor: null, ids: [], n: 0 }, esperaOkMin: { valor: 90, ids: ['a'], n: 4 }, esperanOk: c(1), bloqueadas: c(0), vencidas: c(2), devueltas: { ...c(0), veces: 0 } };
  const f = cifrasDe(r, 30); assert.equal(f.length, 10);
  assert.equal(f.find(x => x[0] === 'cicloMin')[2], 'sin datos'); assert.equal(f.find(x => x[0] === 'aTiempo')[2], '2/3'); assert.equal(f.find(x => x[0] === 'esperaOkMin')[2], '1,5 h');
  assert.deepEqual(idsDeCifra(r, 'hechas'), ['a']); assert.deepEqual(idsDeCifra(r, 'nada'), []);
});

/* ---------- la columna de 24 horas ---------- */
const INI = new Date('2026-10-25T00:00').getTime(), a = (h, m = 0) => INI + (h * 60 + m) * 60000;
test('día: cada evento cae en su hora y ninguno mide menos que un dedo', () => {
  const { arriba, cajas } = distribuir([{ at: a(9), titulo: 'a' }, { at: a(13, 30), titulo: 'b', dur: 120 }, { at: a(0), titulo: 'todo el día', conHora: false }, { at: a(0) + 864e5 + 1, titulo: 'mañana' }], INI);
  assert.equal(arriba.length, 1); assert.equal(cajas.length, 2); assert.equal(cajas[0].top, 9 * PX_HORA); assert.equal(cajas[1].top, Math.round(13.5 * PX_HORA));
  assert.ok(cajas.every(c => c.alto >= MIN_ALTO)); assert.equal(cajas[1].alto, 2 * PX_HORA);
});
test('día: lo que se pisa va lado a lado y lo que no, a todo el ancho', () => {
  const { cajas } = distribuir([{ at: a(9), titulo: 'a', dur: 60 }, { at: a(9, 15), titulo: 'b', dur: 60 }, { at: a(9, 20), titulo: 'c', dur: 30 }, { at: a(15), titulo: 'solo' }], INI);
  const g = t => cajas.find(c => c.ev.titulo === t);
  assert.deepEqual([g('a').col, g('b').col, g('c').col], [0, 1, 2]); assert.ok([g('a'), g('b'), g('c')].every(c => c.cols === 3)); assert.deepEqual([g('solo').col, g('solo').cols], [0, 1]);
});
test('día: la línea de «ahora», dónde se abre y qué hora es un toque', () => {
  assert.equal(lineaAhora(INI, a(12)), 12 * PX_HORA); assert.equal(lineaAhora(INI, a(12) + 864e5), null);
  assert.ok(scrollInicial(INI, a(15), 500) > 0 && scrollInicial(INI, a(15), 500) < 15 * PX_HORA); assert.equal(scrollInicial(INI, a(15) + 864e5, 500), 7 * PX_HORA - 8); // otro día: las 7:00
  assert.equal(horaDeToque(10 * PX_HORA + 5), '10:00'); assert.equal(horaDeToque(10.6 * PX_HORA), '10:30'); assert.equal(horaDeToque(99999), '23:30'); assert.equal(horaDeToque(-5), '00:00');
});

/* ---------- el estilo y el paquete ---------- */
test('estilo del equipo E: va en el paquete móvil, sin :hover, con objetivos de 44 px y ningún texto bajo 11 px', () => {
  const css = fs.readFileSync(new URL('../src/css/movil-e.css', import.meta.url), 'utf8'), build = fs.readFileSync(new URL('../build-movil.mjs', import.meta.url), 'utf8');
  assert.match(build, /CSS_MOVIL = \[[^\]]*'movil-e\.css'/); assert.ok(!/:hover/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'nada de :hover en el teléfono');
  const chicos = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => +m[1]).filter(n => n < 11); assert.deepEqual(chicos, []);
  for (const sel of ['.mv-dia-b', '.mv-sw', '.mv-mover', '.mv-hoja-cab .mv-ic']) assert.ok(css.includes(sel), 'falta ' + sel);
  assert.ok(/\.mv-dia-b \{[^}]*min-height: 52px/.test(css), 'los siete días miden ≥ 44 px');
});
test('las vistas del equipo E escapan lo que viene del servidor y no usan confirm() ni alert()', () => {
  for (const f of ['tareas', 'tareas-detalle', 'tareas-tablero', 'tareas-proyectos', 'tareas-medidas', 'tareas-delegar', 'calendario', 'calendario-rutinas', 'calendario-dia', 'dimitri', 'dimitri-tarjetas']) {
    const s = fs.readFileSync(new URL(`../src/movil/vistas/${f}.js`, import.meta.url), 'utf8');
    assert.ok(!/\b(?:confirm|alert|prompt)\(/.test(s.replace(/ctx\.confirmar\(/g, '').replace(/hojas\.confirmar/g, '')), `${f}: sin confirm()/alert()`);
    assert.ok(!/innerHTML\s*=\s*[^;]*\b(?:t|e|r|m|o|p)\.(?:title|titulo|text|nombre)\s*[`+}]/.test(s.replace(/esc\([^)]*\)/g, '')), `${f}: un título sin escapar`);
  }
});
