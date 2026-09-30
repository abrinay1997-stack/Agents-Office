// V4.7: el motor de cuadrículas del calendario (src/calendar-core.js). Antes vivía dentro de calendar.js, sin tests; ahora que lo comparten
// el calendario de tareas y el de contenido, sus reglas —qué días entran en un mes, cuándo empieza una semana, a dónde salta ‹ y ›— se comprueban aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rangeOf, stepAnchor, weekStart, isoWeek, dowHead, titleHTML, dowHTML, monthHTML, timeGridHTML, agendaHTML, fmtDay, fmtLong, ymd, hm, startOfDay, DAY } from '../src/calendar-core.js';

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const days = r => Array.from({ length: r.days }, (_, i) => ymd(new Date(r.from + i * DAY)));

test('el mes se completa hasta semanas enteras que empiezan en lunes', () => {
  const r = rangeOf('month', at(2026, 9, 15));
  assert.equal(r.days % 7, 0);
  assert.equal(days(r)[0], '2026-08-31'); // septiembre 2026 empieza en martes
  assert.equal(days(r).at(-1), '2026-10-04');
  assert.equal(r.days, 35);
  assert.equal(new Date(r.from).getDay(), 1);
});

test('con la semana en domingo, el mes también empieza en domingo', () => {
  const r = rangeOf('month', at(2026, 9, 15), 0);
  assert.equal(days(r)[0], '2026-08-30');
  assert.equal(new Date(r.from).getDay(), 0);
  assert.equal(r.days % 7, 0);
});

test('un mes de seis semanas (agosto 2026 empieza en sábado y tiene 31 días)', () => {
  assert.equal(rangeOf('month', at(2026, 8, 10)).days, 42);
  assert.equal(rangeOf('month', at(2027, 2, 10)).days, 28); // febrero 2027 empieza en lunes y tiene 28 días: cuatro filas justas
  assert.equal(rangeOf('month', at(2026, 2, 10)).days, 35); // febrero 2026 empieza en domingo: el lunes anterior abre la primera fila
});

test('semana, día y agenda', () => {
  const w = rangeOf('week', at(2026, 9, 30, 15)); // miércoles
  assert.deepEqual([ymd(new Date(w.from)), w.days], ['2026-09-28', 7]);
  assert.equal(w.to - w.from, 7 * DAY);
  const d = rangeOf('day', at(2026, 9, 30, 15));
  assert.deepEqual([ymd(new Date(d.from)), d.days], ['2026-09-30', 1]);
  const a = rangeOf('agenda', at(2026, 9, 30, 15));
  assert.deepEqual([ymd(new Date(a.from)), a.days], ['2026-09-30', 14]);
});

test('‹ y › saltan por vista y no se pierden en el fin de mes', () => {
  assert.equal(ymd(new Date(stepAnchor('day', at(2026, 9, 30), 1))), '2026-10-01');
  assert.equal(ymd(new Date(stepAnchor('week', at(2026, 9, 30), -1))), '2026-09-23');
  assert.equal(ymd(new Date(stepAnchor('agenda', at(2026, 9, 30), 1))), '2026-10-14');
  assert.equal(ymd(new Date(stepAnchor('month', at(2026, 1, 31), -1))), '2025-12-01'); // enero → diciembre, sin caer en «31 de febrero»
  assert.equal(ymd(new Date(stepAnchor('month', at(2026, 3, 31), -1))), '2026-02-01');
  assert.equal(ymd(new Date(stepAnchor('month', at(2026, 12, 15), 1))), '2027-01-01');
});

test('weekStart, dowHead e isoWeek', () => {
  assert.equal(ymd(new Date(weekStart(at(2026, 9, 27), 1))), '2026-09-21'); // domingo 27 → lunes 21
  assert.equal(ymd(new Date(weekStart(at(2026, 9, 27), 0))), '2026-09-27'); // con la semana en domingo, es él mismo
  assert.deepEqual(dowHead(1).slice(0, 2), ['Lun', 'Mar']);
  assert.deepEqual(dowHead(0).slice(0, 2), ['Dom', 'Lun']);
  assert.equal(isoWeek(at(2026, 1, 1)), 1);
  assert.equal(isoWeek(at(2026, 9, 30)), 40);
  assert.equal(isoWeek(at(2026, 12, 31)), 53);
});

test('las fechas salen en español', () => {
  assert.equal(fmtDay(at(2026, 9, 30)), 'mié 30 sep');
  assert.equal(fmtLong(at(2026, 10, 2, 9, 5)), 'viernes 2 de octubre, 09:05');
  assert.equal(hm(at(2026, 9, 30, 7, 3)), '07:03');
  assert.equal(startOfDay(at(2026, 9, 30, 23, 59)), at(2026, 9, 30));
});

test('los títulos: mes, día, semana (con su número) y agenda', () => {
  const anchor = at(2026, 9, 30);
  assert.equal(titleHTML('month', anchor, rangeOf('month', anchor)), 'Septiembre <small>2026</small>');
  assert.equal(titleHTML('day', anchor, rangeOf('day', anchor)), '30 Septiembre <small>2026</small>');
  assert.match(titleHTML('week', anchor, rangeOf('week', anchor)), /^28 Sep – 4 Octubre <small>2026 · semana 40<\/small>$/);
  assert.match(titleHTML('week', at(2026, 9, 16), rangeOf('week', at(2026, 9, 16))), /^14–20 Septiembre <small>2026 · semana 38<\/small>$/); // una semana dentro de un mes no repite el mes
  assert.match(titleHTML('agenda', anchor, rangeOf('agenda', anchor)), /^30 sep – 13 oct <small>2026<\/small>$/);
});

test('la fila de días: nombres sobre el mes, la fecha entera sobre un día', () => {
  assert.equal((dowHTML('month', at(2026, 9, 1), 1).match(/<div>/g) || []).length, 7);
  assert.match(dowHTML('month', at(2026, 9, 1), 0), /^<div>Dom<\/div><div>Lun<\/div>/);
  assert.match(dowHTML('day', at(2026, 9, 30)), /Miércoles 30 de septiembre/);
});

const card = (ev, line) => `<i data-ev="${ev.id}"${line ? ' data-line' : ''}>${ev.id}</i>`;
const NOW = at(2026, 9, 30, 10, 20);

test('el mes: una celda por día, con hoy, los días de otros meses y los de antes marcados', () => {
  const r = rangeOf('month', NOW);
  const by = { '2026-09-30': [{ id: 'a', at: at(2026, 9, 30, 9) }, { id: 'vivo', at: at(2026, 9, 30, 10), live: true }] };
  const html = monthHTML({ ...r, anchor: NOW, by, card, live: ev => !!ev.live, now: NOW });
  assert.equal((html.match(/class="cv-day/g) || []).length, 35);
  assert.match(html, /class="cv-day today[^"]*" data-day="2026-09-30"/);
  assert.match(html, /class="cv-day out past[^"]*" data-day="2026-08-31"/);
  assert.match(html, /class="cv-day out[^"]*" data-day="2026-10-04"/);
  assert.match(html, /data-ev="a" data-line/); // en el mes, a una línea
  assert.ok(!html.includes('data-ev="vivo"'), 'lo que no lleva hora no va en la celda del mes');
  assert.match(html, /<span>Oct<\/span><b>01<\/b>/); // el día 1 dice el mes
  assert.match(html, /aria-label="Programar algo el 30 de septiembre"/);
  assert.match(monthHTML({ ...r, anchor: NOW, by, card, now: NOW, addLabel: d => `Nueva pieza el ${d.getDate()}` }), /aria-label="Nueva pieza el 30"/);
});

test('la semana: 24 horas por siete días, la línea de «ahora» solo en su casilla, y una fila para lo que no tiene hora', () => {
  const r = rangeOf('week', NOW);
  const by = { '2026-09-30': [{ id: 'nueve', at: at(2026, 9, 30, 9, 30) }, { id: 'vivo', at: at(2026, 9, 30, 10), live: true }] };
  const html = timeGridHTML({ ...r, by, card, live: ev => !!ev.live, now: NOW });
  assert.equal((html.match(/class="cv-day cv-slot/g) || []).length, 24 * 7);
  assert.equal((html.match(/cv-nowline/g) || []).length, 1);
  assert.match(html, /data-day="2026-09-30" data-hour="10"><i class="cv-nowline" style="top:33%"/);
  assert.match(html, /data-hour="9"><div class="cv-evs"><i data-ev="nueve">/);
  assert.match(html, /<div class="cv-tg-h lv">EN MARCHA<\/div>/);
  assert.match(html, /<div class="cv-tg-lv"><i data-ev="vivo">/);
  assert.match(html, /data-day="2026-09-29" data-hour="23"/);
  const sinVivos = timeGridHTML({ ...r, by: {}, card, now: NOW });
  assert.ok(!sinVivos.includes('cv-tg-h lv'), 'sin nada en marcha, no hay fila «en marcha»');
});

test('el día trae su nombre entero y la hora pasada se marca', () => {
  const r = rangeOf('day', NOW);
  const html = timeGridHTML({ ...r, by: {}, card, now: NOW });
  assert.match(html, /<span>miércoles<\/span><b>30<\/b><span>de septiembre<\/span>/);
  assert.match(html, /class="cv-day cv-slot past[^"]*" data-day="2026-09-30" data-hour="9"/);
  assert.match(html, /class="cv-day cv-slot now[^"]*" data-day="2026-09-30" data-hour="10"/);
  assert.match(html, /class="cv-day cv-slot[^"]*" data-day="2026-09-30" data-hour="11"/);
  assert.ok(!/cv-slot past[^"]*" data-day="2026-09-30" data-hour="11"/.test(html));
});

test('la agenda salta los días vacíos, salvo hoy, y dice hoy y mañana', () => {
  const r = rangeOf('agenda', NOW);
  const by = { '2026-10-01': [{ id: 'mañana', at: at(2026, 10, 1, 9) }], '2026-10-05': [{ id: 'lunes', at: at(2026, 10, 5, 9) }] };
  const html = agendaHTML({ ...r, by, card, now: NOW });
  assert.equal((html.match(/<section class="cv-day cv-ag-day/g) || []).length, 3);
  assert.match(html, /<b>30<\/b><span>miércoles · hoy<\/span>/);
  assert.match(html, /Nada para hoy\./);
  assert.match(html, /<span>jueves · mañana<\/span>/);
  assert.ok(!html.includes('data-day="2026-10-02"'));
  assert.equal(agendaHTML({ from: at(2026, 10, 10), days: 3, by: {}, card, now: NOW }), '<div class="cv-empty">Nada en estos días.</div>');
});
