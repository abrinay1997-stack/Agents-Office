// Versión móvil (25 oct 2026): lo puro — navegación, gestos y agenda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TABS, leerHash, aHash, pestanaDe, crearPila, esGestoVolver, cierraHoja, gestoFila, tiraRefrescar } from '../src/movil/nav.js';
import { eventos, agrupar, mesGrid, etiquetaDia, horaDe } from '../src/movil/agenda.js';

test('la barra inferior tiene cinco destinos y Más es el último', () => {
  assert.equal(TABS.length, 5); assert.deepEqual(TABS.map(t => t.id), ['inicio', 'tareas', 'calendario', 'dimitri', 'mas']);
});
test('la dirección va y vuelve; una vista desconocida cae en Inicio', () => {
  assert.deepEqual(leerHash('#m=tareas&l=hoy'), { vista: 'tareas', params: { l: 'hoy' } });
  assert.equal(aHash('tareas', { l: 'hoy', x: '' }), '#m=tareas&l=hoy');
  assert.equal(leerHash('#m=nada').vista, 'inicio'); assert.equal(leerHash('').vista, 'inicio');
  assert.equal(pestanaDe('aprobaciones'), 'inicio'); assert.equal(pestanaDe('estudio'), 'mas'); assert.equal(pestanaDe('dimitri'), 'dimitri');
});
test('la pila cierra de arriba abajo y deja quitar una capa del medio', () => {
  const p = crearPila(); p.push('a'); p.push('b'); p.push('c');
  assert.equal(p.cima(), 'c'); assert.equal(p.pop(), 'c'); assert.equal(p.quitar('a'), true); assert.equal(p.largo, 1); assert.equal(p.pop(), 'b'); assert.equal(p.pop(), null);
});
test('gestos: volver solo desde el borde, hoja con umbral, fila con dirección', () => {
  assert.equal(esGestoVolver({ x0: 10, dx: 100, dy: 10 }), true); assert.equal(esGestoVolver({ x0: 120, dx: 100, dy: 10 }), false); assert.equal(esGestoVolver({ x0: 10, dx: 100, dy: 90 }), false);
  assert.equal(cierraHoja({ dy: 100, alto: 800 }), true); assert.equal(cierraHoja({ dy: 40, alto: 800 }), false); assert.equal(cierraHoja({ dy: 70, alto: 200 }), true);
  assert.equal(gestoFila({ dx: 120, dy: 5 }), 'completar'); assert.equal(gestoFila({ dx: -120, dy: 5 }), 'posponer'); assert.equal(gestoFila({ dx: 40, dy: 0 }), null); assert.equal(gestoFila({ dx: 100, dy: 90 }), null);
  assert.equal(tiraRefrescar({ dy: 80, scrollTop: 0 }), true); assert.equal(tiraRefrescar({ dy: 80, scrollTop: 30 }), false);
});

const AHORA = new Date('2026-10-26T10:00:00').getTime(), D = n => AHORA + n * 864e5;
test('la agenda agrupa por día, pone Hoy aunque esté vacío y ordena por hora', () => {
  const tareas = [
    { id: 'a', title: 'Llamar', person: 'Tú', state: 'next', limite: '2026-10-27' },
    { id: 'b', title: 'Post', state: 'scheduled', dueAt: new Date('2026-10-27T09:00').getTime(), dept: 'marketing', agent: 'x' },
    { id: 'c', title: 'Cerrada', state: 'done', doneAt: AHORA - 1000, dueAt: D(0) },
    { id: 'd', title: 'Vieja', state: 'scheduled', dueAt: D(-3), archived: true },
  ];
  const desde = new Date('2026-10-26T00:00').getTime(), hasta = desde + 7 * 864e5;
  const ev = eventos({ tareas, rutinas: [], desde, hasta });
  assert.deepEqual(ev.map(e => e.titulo), ['Post', 'Llamar']); // 09:00 antes que el final del día
  const g = agrupar(ev, { ahora: AHORA, desde, hasta });
  assert.deepEqual(g.map(x => x.titulo), ['Hoy', 'Mañana']); assert.equal(g[0].items.length, 0); assert.equal(g[1].items.length, 2);
  assert.equal(horaDe(ev[0]), '09:00'); assert.equal(horaDe(ev[1]), 'todo el día');
  assert.equal(eventos({ tareas, desde, hasta, hechas: true }).filter(e => e.hecha).length, 1, 'las hechas entran solo si se piden');
});
test('una rutina diaria sale una vez por día y una pausada se marca', () => {
  const desde = Date.now(), hasta = desde + 3 * 864e5;
  const ev = eventos({ rutinas: [{ id: 'r', title: 'Resumen', when: { kind: 'daily', at: '23:30' }, dept: 'ops' }, { id: 'p', title: 'Pausa', paused: true, when: { kind: 'daily', at: '23:31' } }, { id: 'f', title: 'Cine', when: { kind: 'minutes', every: 2 } }], desde, hasta });
  assert.ok(ev.filter(e => e.id === 'r').length >= 2); assert.ok(ev.filter(e => e.id === 'p').every(e => e.pausada)); assert.equal(ev.some(e => e.id === 'f'), false);
});
test('el mes: semanas de lunes a domingo con los puntos', () => {
  const m = mesGrid(new Date('2026-10-15T12:00').getTime(), [{ at: new Date('2026-10-27T09:00').getTime(), tipo: 'rutina' }, { at: new Date('2026-10-27T10:00').getTime(), tipo: 'mia' }]);
  assert.equal(m.titulo, 'Octubre 2026'); assert.equal(m.semanas[0].length, 7); assert.equal(m.semanas[0][0].dia, '2026-09-28'); // 1 oct 2026 es jueves
  const c = m.semanas.flat().find(x => x.dia === '2026-10-27'); assert.equal(c.n, 2); assert.deepEqual([...c.tipos].sort(), ['mia', 'rutina']);
  assert.ok(m.semanas.length >= 5 && m.semanas.length <= 6);
  assert.equal(etiquetaDia('2026-10-26', AHORA), 'Hoy'); assert.equal(etiquetaDia('2026-10-30', AHORA), 'viernes 30 de octubre');
});
