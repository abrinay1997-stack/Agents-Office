// Agents Office V4.7 (30 sep 2026) — el MOTOR de las cuadrículas del calendario. Sale de calendar.js para que dos calendarios lo usen:
// el de tareas y rutinas (P, `calendar.js`) y el de contenido (`contenido.js`). Es puro: no sabe qué es una tarea, una rutina o una
// pieza de contenido. Recibe eventos ya agrupados por día ({ 'AAAA-MM-DD': [ev, …] }, cada uno con `at` en milisegundos) y una función
// `card(ev, enLinea)` que pinta cada uno; devuelve HTML. Lo único que toca el DOM es `fitMonth`, que mide una cuadrícula ya pintada.
//
//   fechas:       pad · ymd · hm · startOfDay · mondayOf · weekStart · dowHead · isoWeek · fmtDay · fmtLong · stepAnchor
//   rango:        rangeOf(view, anchor, ws) → { from, to, days }
//   cabeceras:    titleHTML(view, anchor, r) · dowHTML(view, anchor, ws)
//   cuadrículas:  monthHTML · timeGridHTML · agendaHTML · fitMonth
// `view` es 'month' | 'week' | 'day' | 'agenda'; `ws` es el día en que empieza la semana (1 = lunes, 0 = domingo).
// Cubierto por tests/calendar-core.test.mjs.

export const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // la semana empieza el lunes (AU/NZ/UK)
export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const DAY = 864e5;
export const AGENDA_DAYS = 14;

export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const mondayOf = ts => { const d = new Date(startOfDay(ts)); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.getTime(); };
// V4.2 (auditoría B15): fechas y horas en español, sea cual sea el idioma del navegador — «Friday, September 25 at 08:30 AM» y «09/26/2026» ya no salen
export const fmtDay = ts => { const d = new Date(ts); return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toLowerCase()}`; };
export const fmtLong = ts => { const d = new Date(ts); return `${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}, ${hm(ts)}`; };

// V4.2 (auditoría B13): la semana empieza el lunes o el domingo (lo elige el dueño y el navegador lo recuerda)
export const weekStart = (ts, ws = 1) => { const d = new Date(startOfDay(ts)); d.setDate(d.getDate() - (d.getDay() - ws + 7) % 7); return d.getTime(); };
export const dowHead = (ws = 1) => ws === 1 ? DOW : ['Dom', ...DOW.slice(0, 6)];
export const isoWeek = ts => { const d = new Date(startOfDay(ts)); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / DAY - 3 + (w1.getDay() + 6) % 7) / 7); };

/** Los días que hay en pantalla: [from, to) y cuántos son. El mes se completa hasta semanas enteras. */
export function rangeOf(view, anchor, ws = 1) {
  if (view === 'agenda') { const a = startOfDay(anchor); return { from: a, to: a + AGENDA_DAYS * DAY, days: AGENDA_DAYS }; }
  if (view === 'day') { const a = startOfDay(anchor); return { from: a, to: a + DAY, days: 1 }; }
  if (view === 'week') { const a = weekStart(anchor, ws); return { from: a, to: a + 7 * DAY, days: 7 }; }
  const d = new Date(anchor); d.setDate(1); const first = weekStart(d.getTime(), ws);
  const rows = Math.ceil((new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() + ((d.getDay() - ws + 7) % 7)) / 7);
  return { from: first, to: first + rows * 7 * DAY, days: rows * 7 };
}

/** A dónde va el ancla al pulsar ‹ o ›: una agenda salta 14 días, un día 1, una semana 7, un mes al mes vecino. */
export function stepAnchor(view, anchor, n) {
  const d = new Date(anchor);
  if (view === 'agenda') d.setDate(d.getDate() + AGENDA_DAYS * n);
  else if (view === 'day') d.setDate(d.getDate() + n);
  else if (view === 'week') d.setDate(d.getDate() + 7 * n);
  else { d.setDate(1); d.setMonth(d.getMonth() + n); }
  return d.getTime();
}

/** El título de la banda: «Septiembre 2026», «28 sep – 4 octubre 2026 · semana 40», «30 septiembre 2026»… (con <small>). */
export function titleHTML(view, anchor, { from, to, days }) {
  const a = new Date(anchor);
  if (view === 'agenda') { const e = new Date(from + (days - 1) * DAY); return `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3).toLowerCase()} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 3).toLowerCase()} <small>${e.getFullYear()}</small>`; }
  if (view === 'day') return `${a.getDate()} ${MONTHS[a.getMonth()]} <small>${a.getFullYear()}</small>`;
  if (view === 'month') return `${MONTHS[a.getMonth()]} <small>${a.getFullYear()}</small>`;
  const s = new Date(from), e = new Date(to - DAY);
  // una semana dentro de un mes: «14–20 Septiembre»; una que cruza de mes: «28 Sep – 4 Octubre» (antes salía «28–4 Sep – 4 Octubre»)
  return `${s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()} ${MONTHS[e.getMonth()]}` : `${s.getDate()} ${MONTHS[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTHS[e.getMonth()]}`} <small>${e.getFullYear()} · semana ${isoWeek(from + 3 * DAY)}</small>`;
}

/** La fila de nombres de día (Lun Mar …) sobre el mes, o «Domingo 27 de septiembre» sobre un día. */
export function dowHTML(view, anchor, ws = 1) {
  const a = new Date(anchor);
  return view === 'day' ? `<div class="cv-dayname">${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][a.getDay()]} ${a.getDate()} de ${MONTHS[a.getMonth()].toLowerCase()}</div>` : dowHead(ws).map(d => `<div>${d}</div>`).join('');
}

const defaultAdd = d => `Programar algo el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;

/**
 * El mes: una celda por día, con su número, el «+» y sus eventos a una línea. `live(ev)` dice cuáles no llevan hora (no van en la celda);
 * `addLabel(d)` es lo que dice el «+» ante un lector de pantalla.
 */
export function monthHTML({ from, days, anchor, by, card, live = () => false, addLabel = defaultAdd, now = Date.now() }) {
  const today = ymd(new Date(now)), a = new Date(anchor); let html = '';
  for (let i = 0; i < days; i++) {
    const ts = from + i * DAY, d = new Date(ts), k = ymd(d), list = (by[k] || []).filter(ev => !live(ev));
    const out = d.getMonth() !== a.getMonth(), past = ts < startOfDay(now);
    html += `<div class="cv-day${k === today ? ' today' : ''}${out ? ' out' : ''}${past ? ' past' : ''}${d.getDay() === 0 || d.getDay() === 6 ? ' wknd' : ''}" data-day="${k}">
        <div class="cv-num">${d.getDate() === 1 ? `<span>${MONTHS[d.getMonth()].slice(0, 3)}</span>` : ''}<b>${pad(d.getDate())}</b></div>
        <button class="cv-add" type="button" title="${addLabel(d)}" aria-label="${addLabel(d)}">+</button>
        <div class="cv-evs">${list.map(ev => card(ev, true)).join('')}</div></div>`;
  }
  return html;
}

/**
 * La semana o el día: columnas = días, filas = horas de 00:00 a 24:00; una casilla es un destino de arrastre y un clic programa a esa
 * hora. Lo que está en marcha no tiene hora: va en una fila propia («EN MARCHA») sobre la cuadrícula, nunca en una hora falsa.
 */
export function timeGridHTML({ from, days, by, card, live = () => false, now = Date.now(), liveLabel = 'EN MARCHA' }) {
  const nowD = new Date(now), today = ymd(nowD);
  const cols = []; for (let i = 0; i < days; i++) { const ts = from + i * DAY, d = new Date(ts); cols.push({ ts, d, k: ymd(d), list: by[ymd(d)] || [] }); }
  let html = '<div class="cv-tg-c"></div>' + cols.map(({ d, k }) => `<div class="cv-tg-d${k === today ? ' today' : ''}" data-day="${k}"><span>${days === 1 ? DOW_LONG[d.getDay()] : DOW[(d.getDay() + 6) % 7]}</span><b>${d.getDate()}</b>${days === 1 ? `<span>de ${MONTHS[d.getMonth()].toLowerCase()}</span>` : ''}</div>`).join('');
  if (cols.some(c => c.list.some(live)))
    html += `<div class="cv-tg-h lv">${liveLabel}</div>` + cols.map(c => `<div class="cv-tg-lv">${c.list.filter(live).map(ev => card(ev)).join('')}</div>`).join('');
  for (let h = 0; h < 24; h++) {
    html += `<div class="cv-tg-h" data-h="${h}">${pad(h)}:00</div>`;
    for (const c of cols) {
      const end = new Date(c.ts); end.setHours(h + 1, 0, 0, 0);
      const isNow = c.k === today && h === nowD.getHours(), wk = (c.d.getDay() + 6) % 7 >= 5;
      const list = c.list.filter(ev => !live(ev) && new Date(ev.at).getHours() === h);
      html += `<div class="cv-day cv-slot${end.getTime() <= now ? ' past' : ''}${isNow ? ' now' : ''}${wk ? ' wknd' : ''}" data-day="${c.k}" data-hour="${h}">${isNow ? `<i class="cv-nowline" style="top:${Math.round(nowD.getMinutes() / 60 * 100)}%" aria-hidden="true"></i>` : ''}<div class="cv-evs">${list.map(ev => card(ev)).join('')}</div></div>`;
    }
  }
  return html;
}

/** V4.2 (auditoría B5): en el teléfono, una lista por día — lo que hay, en orden, legible; hoy siempre sale. */
export function agendaHTML({ from, days, by, card, live = () => false, addLabel = defaultAdd, now = Date.now(), emptyDay = 'Nada para hoy.', emptyAll = 'Nada en estos días.' }) {
  const today = ymd(new Date(now)); let html = '', any = false;
  for (let i = 0; i < days; i++) {
    const ts = from + i * DAY, d = new Date(ts), k = ymd(d), list = (by[k] || []).filter(ev => !live(ev));
    if (!list.length && k !== today) continue; any = true;
    const rel = k === today ? 'hoy' : ymd(new Date(now + DAY)) === k ? 'mañana' : '';
    html += `<section class="cv-day cv-ag-day${k === today ? ' today' : ''}${ts < startOfDay(now) ? ' past' : ''}" data-day="${k}">
        <div class="cv-ag-h"><b>${d.getDate()}</b><span>${DOW_LONG[d.getDay()]}${rel ? ` · ${rel}` : ''}</span><span class="sp"></span><button class="cv-add" type="button" aria-label="${addLabel(d)}">+</button></div>
        <div class="cv-evs">${list.length ? list.map(ev => card(ev)).join('') : `<div class="cv-empty">${emptyDay}</div>`}</div></section>`;
  }
  return any ? html : `<div class="cv-empty">${emptyAll}</div>`;
}

/** Tantos eventos de una línea como quepan en la celda, y luego «+N más»: nunca una tarjeta cortada por la mitad. */
export function fitMonth(grid) {
  for (const cell of grid.querySelectorAll('.cv-day')) {
    const evs = cell.querySelector('.cv-evs'), items = [...evs.querySelectorAll('.cv-ev')];
    if (!items.length || evs.scrollHeight <= evs.clientHeight + 1) continue;
    const room = evs.clientHeight - 20; let k = 0;
    for (const it of items) { if (it.offsetTop + it.offsetHeight <= room) k++; else break; }
    k = Math.max(1, k); items.slice(k).forEach(n => { n.hidden = true; });
    evs.insertAdjacentHTML('beforeend', `<button type="button" class="cv-more" data-day="${cell.dataset.day}">+${items.length - k} más</button>`);
  }
}

/** Las horas del menú: cada 15 minutos (más la que ya tiene) en lugar del «10:05 AM» del navegador. <option> listas para un <select>. */
export function timeOpts(val) {
  const set = new Set(); for (let m = 0; m < 1440; m += 15) set.add(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  if (val) set.add(val);
  return [...set].sort().map(v => `<option value="${v}"${v === val ? ' selected' : ''}>${v}</option>`).join('');
}
/** Los próximos 120 días, «jue 25 sep», en lugar del «09/26/2026» del navegador; un día fuera de ese rango (una pieza vieja) se añade al principio. */
export function dateOpts(val, now = Date.now()) {
  const out = [], t0 = startOfDay(now); let seen = false;
  for (let i = 0; i < 120; i++) { const d = new Date(t0); d.setDate(d.getDate() + i); const k = ymd(d); if (k === val) seen = true; out.push(`<option value="${k}"${k === val ? ' selected' : ''}>${i === 0 ? 'hoy · ' : i === 1 ? 'mañana · ' : ''}${fmtDay(d.getTime())}${d.getFullYear() !== new Date(now).getFullYear() ? ' ' + d.getFullYear() : ''}</option>`); }
  if (val && !seen) out.unshift(`<option value="${val}" selected>${fmtDay(new Date(val + 'T00:00:00').getTime())}</option>`);
  return out.join('');
}
