// Agents Office V3.2.1 (16 Sep 2026) — the CALENDAR (P). One quiet screen with everything the office
// has done, is doing, and will do on the day it belongs to: finished tasks on the day they finished,
// today's work on today, tasks scheduled for a date, and every routine projected forward on the days
// it will fire. Click a day to schedule a task for it, or to start a routine from that date. A rail on
// the left lists the routines themselves — cadence, next run, paused — so the timetable is never a
// guess. Month and week. Reads the office's own task and routine arrays (tasks.js owns them); live or
// demo makes no difference here.
//
//   initCalendar(ctx) → { open, close, toggle, isOpen, refresh }
//   ctx: tasks, routines (the live arrays) · agentOf · DEPTS · DEPT_KEYS · RT_DEPTS · rtRefuse
//        create({ dept, text, at, model }) → Promise<{ ok, task, error }>   (a task for a date)
//        createRoutine({ dept, text, when, needsOk, model }) → Promise<{ ok, routine, error }>
//        cancelTask(t) · rtAct(id, act) · openAgent(id, tab) · esc · isLive() · officeModel() · MODEL_KEYS · modelName · business()
import { occurrences, describe, untilText, fromPicker, toPicker, shortDate } from './when.js';
import { modal } from './modal.js'; // V4.1: the page outside an open window is inert

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // the week starts on Monday (AU/NZ/UK)
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const mondayOf = ts => { const d = new Date(startOfDay(ts)); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.getTime(); };
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
// V4.2 (audit B15): dates and times in Spanish, whatever the browser's language — «Friday, September 25 at 08:30 AM» and «09/26/2026» are gone
const fmtDay = ts => { const d = new Date(ts); return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toLowerCase()}`; };
const fmtLong = ts => { const d = new Date(ts); return `${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}, ${hm(ts)}`; };
function timeOpts(val) { // a 24-hour menu every 15 minutes (plus the value it already has) instead of the browser's «10:05 AM»
  const set = new Set(); for (let m = 0; m < 1440; m += 15) set.add(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  if (val) set.add(val);
  return [...set].sort().map(v => `<option value="${v}"${v === val ? ' selected' : ''}>${v}</option>`).join('');
}
function dateOpts(val) { // the next 120 days, «jue 25 sep», instead of the browser's «09/26/2026»
  const out = [], t0 = startOfDay(Date.now()); let seen = false;
  for (let i = 0; i < 120; i++) { const d = new Date(t0); d.setDate(d.getDate() + i); const k = ymd(d); if (k === val) seen = true; out.push(`<option value="${k}"${k === val ? ' selected' : ''}>${i === 0 ? 'hoy · ' : i === 1 ? 'mañana · ' : ''}${fmtDay(d.getTime())}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}</option>`); }
  if (val && !seen) out.unshift(`<option value="${val}" selected>${fmtDay(new Date(val + 'T00:00:00').getTime())}</option>`);
  return out.join('');
}
const LIVE = ['doing', 'waiting', 'next']; // work under way: it has no hour, it sits in the «en marcha» row
const CADENCES = [['daily', 'Todos los días'], ['weekdays', 'Cada día hábil'], ['mon', 'Lunes'], ['tue', 'Martes'], ['wed', 'Miércoles'], ['thu', 'Jueves'], ['fri', 'Viernes'], ['sat', 'Sábados'], ['sun', 'Domingos'], ['hourly', 'Cada hora, 9–5, días hábiles']];

export function initCalendar(ctx) {
  const { tasks, routines, agentOf, DEPTS, DEPT_KEYS, RT_DEPTS, rtRefuse, create, createRoutine, cancelTask, updateTask, updateRoutine, rtAct, openTask, act, backlog, archivedTasks, skipRun, openAgent, esc, isLive, officeModel, MODEL_KEYS, modelName, business, currentDept } = ctx;
  const ov = document.getElementById('calOv'); if (!ov) return null;
  const $ = s => ov.querySelector(s);
  const E = { title: $('#cvTitle'), grid: $('#cvGrid'), dow: $('#cvDow'), rail: $('#cvRail'), railN: $('#cvRtN'), chips: $('#cvChips'), search: $('#cvSearch'), stats: $('#cvStats'), pop: $('#cvPop'), co: $('#cvCo'), seg: $('.cv-seg') };
  let openNow = false, view = 'month', anchor = startOfDay(Date.now()), q = '', deptOn = new Set(DEPT_KEYS), showRoutines = true, showDone = true, onlyRoutine = null, popKind = null, lastDept = 'marketing';
  const MAX = { month: 3, week: 8, day: 99 };
  // V4.2 (audit B2–B4): the week and the day are one time grid, 00:00–24:00 — the day view used to stop at 06–22 and put a 23:30 task in the 22:00 row
  let tgKey = '', tgScroll = 0; // which week or day the time grid shows, and where it was scrolled to (a re-render keeps it)
  const attr = v => esc(v).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); // inside title="…": a quote in a title must not end the attribute
  let dragging = null; // { kind: 't' | 'r', id, at } while a card is being dragged — nothing re-renders under it
  // V4.2 (audit B21): cancelling a task or deleting a routine no longer asks «¿seguro?» — it goes at once, with DESHACER for
  // 8 seconds, and only then reaches the server (closing the calendar, or the next one, sends it straight away)
  const gone = new Set(); let undoT = null, commitFn = null;
  const toastEl = document.createElement('div'); toastEl.className = 'cv-toast'; toastEl.hidden = true; toastEl.setAttribute('role', 'status');
  toastEl.innerHTML = '<span></span><button type="button">DESHACER</button>'; ov.appendChild(toastEl);
  function flushUndo() { clearTimeout(undoT); undoT = null; toastEl.hidden = true; const f = commitFn; commitFn = null; if (f) f(); }
  function later(key, label, commit) {
    flushUndo(); gone.add(key); closePop(); render();
    commitFn = async () => { const r = await commit(); gone.delete(key); if (openNow) render(); if (r && r.ok === false) { E.stats.innerHTML = `<span class="amber">No se pudo: ${esc(r.error || 'error')}</span>`; } };
    toastEl.querySelector('span').textContent = label; toastEl.hidden = false;
    toastEl.querySelector('button').onclick = () => { clearTimeout(undoT); commitFn = null; toastEl.hidden = true; gone.delete(key); render(); E.stats.innerHTML = '<span class="cv-said">Deshecho.</span>'; };
    undoT = setTimeout(flushUndo, 8000);
  }

  /* ---------- what is on each day ---------- */
  const AGENDA_DAYS = 14;
  const narrow = () => matchMedia('(max-width: 760px)').matches;
  function range() { // [from, to) of the days on screen
    if (view === 'agenda') { const a = startOfDay(anchor); return { from: a, to: a + AGENDA_DAYS * DAY, days: AGENDA_DAYS }; }
    if (view === 'day') { const a = startOfDay(anchor); return { from: a, to: a + DAY, days: 1 }; }
    if (view === 'week') { const a = mondayOf(anchor); return { from: a, to: a + 7 * DAY, days: 7 }; }
    const d = new Date(anchor); d.setDate(1); const first = mondayOf(d.getTime()); const rows = Math.ceil((new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() + ((d.getDay() + 6) % 7)) / 7);
    return { from: first, to: first + rows * 7 * DAY, days: rows * 7 };
  }
  const matches = s => !q || String(s || '').toLowerCase().includes(q);
  function events(from, to) { // day key → [{ kind, at, title, dept, agent, t?, r? }]
    const by = {}; const push = ev => { if (!deptOn.has(ev.dept)) return; if (!matches(ev.title + ' ' + (agentOf(ev.agent)?.name || ''))) return; (by[ymd(new Date(ev.at))] ||= []).push(ev); };
    const today = startOfDay(Date.now());
    for (const t of tasks) {
      if (t.piece || gone.has('t:' + t.id)) continue; // a team's pieces sit under the lead's card; a cancelled one waits out its DESHACER unseen
      if (onlyRoutine && t.routine !== onlyRoutine) continue;
      if (t.state === 'done') { if (showDone && t.doneAt >= from && t.doneAt < to) push({ kind: 'done', at: t.doneAt, title: t.title, dept: t.dept, agent: t.agent, t }); }
      else if (t.state === 'scheduled') { if (t.dueAt >= from && t.dueAt < to) push({ kind: 'sched', at: t.dueAt, title: t.title, dept: t.dept, agent: t.agent, t }); }
      else if (t.state === 'waiting' || t.state === 'doing' || t.state === 'next') { if (today >= from && today < to) push({ kind: t.state, at: Math.max(today + 1, Math.min(today + DAY - 1, t.changedAt || Date.now())), title: t.title, dept: t.dept, agent: t.agent, t }); }
    }
    if (showRoutines) for (const r of routines) {
      if (gone.has('r:' + r.id)) continue;
      if (onlyRoutine && r.id !== onlyRoutine) continue; // paused ones stay, greyed: the timetable is not a guess
      if (!r.when || r.when.kind === 'minutes') continue; // a filming cadence is not a calendar
      const startAt = Math.max(from - 1, Date.now() - 1); // forward: the runs to come
      const occ = occurrences(r.when, startAt, to - 1, 800);
      // V4.2 (audit B7): backward, the runs that should have happened. A run that fired is its task (shown as done ✓ or failed ⚠);
      // a skipped one says so; one with no task at all, after the routine's first run and while it was not paused, «no corrió».
      if (from < Date.now() && showRoutines) {
        const fired = [...tasks, ...(archivedTasks ? archivedTasks() : [])].filter(t => t.routine === r.id && t.due);
        const first = fired.length ? Math.min(...fired.map(t => t.due)) : Infinity;
        const past = occurrences(r.when, Math.max(from - 1, first - 1), Math.min(to, Date.now() - 10 * 60e3) - 1, 400);
        const collapse = r.when.kind === 'hourly' && (view === 'month' || view === 'agenda'), seen = new Set();
        for (const at of past) {
          if (fired.some(t => Math.abs(t.due - at) < 90e3)) continue; // it ran: its task is on the calendar already
          const skipped = (r.skips || []).includes(at);
          if (r.paused && !skipped) continue; // paused: nobody knows since when — say nothing rather than guess
          if (collapse) { const k = ymd(new Date(at)); if (seen.has(k)) continue; seen.add(k); }
          push({ kind: 'run', at, title: r.title, dept: r.dept, agent: r.agent, r, status: skipped ? 'skipped' : 'missed' });
        }
      }
      if (r.when.kind === 'hourly' && (view === 'month' || view === 'agenda')) { const seen = new Set(); for (const at of occ) { const k = ymd(new Date(at)); if (seen.has(k)) continue; seen.add(k); push({ kind: 'routine', at, title: r.title, dept: r.dept, agent: r.agent, r, hourly: true, paused: r.paused }); } }
      else for (const at of occ) push({ kind: 'routine', at, title: r.title, dept: r.dept, agent: r.agent, r, paused: r.paused, skipped: (r.skips || []).includes(at) });
    }
    for (const k in by) by[k].sort((a, b) => a.at - b.at);
    return by;
  }

  /* ---------- drawing ---------- */
  const av = (id) => { const a = agentOf(id); const c = a ? DEPTS[a.dept].chip : '#ccc'; return `<i class="cv-av" style="border-color:${c};background:${c}55" title="${attr(a ? a.name : id)}">${esc(a ? a.name[0] : '?')}</i>`; };
  function cardHTML(ev, line) {
    const chip = DEPTS[ev.dept].chip, a = agentOf(ev.agent);
    const time = ev.kind === 'routine' ? (ev.hourly ? describe(ev.r.when).replace(/ · desde .*$/, '') : hm(ev.at)) : ev.kind === 'run' ? `${hm(ev.at)} · ${ev.status === 'skipped' ? 'saltada' : 'no corrió'}` : ev.kind === 'done' ? `${ev.t?.error ? 'falló' : 'listo'} ${hm(ev.at)}${ev.t?.routine ? ' · rutina' : ''}${ev.t?.late ? ' · atrasada' : ''}` : ev.kind === 'sched' ? `${hm(ev.at)} · programado` : ev.kind === 'doing' ? 'en curso' : ev.kind === 'waiting' ? 'en espera de tu visto bueno' : 'en pendientes';
    const id = ev.t ? `t:${ev.t.id}` : `r:${ev.r.id}:${ev.at}`;
    const drag = (ev.kind === 'sched') || (ev.kind === 'routine' && !ev.paused && (ev.r.when.kind === 'weekly' && ev.r.when.days.length === 1 || (view !== 'month' && (ev.r.when.kind === 'daily' || ev.r.when.kind === 'weekdays'))));
    const glyph = ev.kind === 'routine' || ev.kind === 'run' ? '<span class="cv-rt">⏱</span>' : ev.kind === 'done' ? (ev.t?.error ? '<span class="cv-fail">⚠</span>' : '<span class="cv-tick">✓</span>') : ev.kind === 'sched' ? '<span class="cv-rt">◷</span>' : ev.t?.team?.members?.length ? '<span class="cv-rt">⚑</span>' : '';
    if (line) { // V4.2 (audit B1): the month is one line per event — two-line cards were cut in half by the cell
      const short = ev.kind === 'run' ? (ev.status === 'skipped' ? 'saltada' : 'no corrió') : ev.kind === 'routine' ? (ev.hourly ? `cada ${ev.r.when.every || 1} h` : hm(ev.at)) : ev.kind === 'done' || ev.kind === 'sched' ? hm(ev.at) : ev.kind === 'doing' ? 'ahora' : ev.kind === 'waiting' ? 'tu OK' : '';
      return `<div class="cv-ev line ${ev.kind}${ev.status ? ' ' + ev.status : ''}${ev.paused ? ' paused' : ''}${ev.skipped ? ' skipped' : ''}${ev.t?.error ? ' err' : ''}" data-ev="${id}" style="--chip:${chip}" title="${attr(ev.title)} · ${attr(time)} · ${attr(a ? a.name : '')}${drag ? ' · arrastra para moverla' : ''}"${drag ? ' draggable="true"' : ''} role="button" tabindex="0">${short ? `<span class="cv-ev-h">${esc(short)}</span>` : ''}<span class="cv-ev-t">${glyph}${esc(ev.title)}</span></div>`;
    }
    return `<div class="cv-ev ${ev.kind}${ev.status ? ' ' + ev.status : ''}${ev.paused ? ' paused' : ''}${ev.skipped ? ' skipped' : ''}${ev.t?.error ? ' err' : ''}${ev.t?.team?.members?.length ? ' team' : ''}" data-ev="${id}" style="--chip:${chip}" title="${attr(ev.title)} · ${attr(a ? a.name : '')}${ev.status === 'missed' ? ' · no hay tarea de esta ejecución: la oficina estaba cerrada o la tarea se borró' : ''}${drag ? ' · arrastra para moverla' : ''}"${drag ? ' draggable="true"' : ''} role="button" tabindex="0">
      <div class="cv-ev-t">${glyph}${esc(ev.title)}</div>
      <div class="cv-ev-m"><span>${esc(time)}</span>${av(ev.agent)}</div></div>`;
  }
  function render() {
    if (dragging) return; // a re-render mid-drag would pull the card out from under the pointer
    const { from, to, days } = range();
    const by = events(from, to), today = ymd(new Date());
    const a = new Date(anchor);
    E.title.innerHTML = view === 'day' ? `${a.getDate()} ${MONTHS[a.getMonth()]} <small>${a.getFullYear()}</small>` : view === 'month' ? `${MONTHS[a.getMonth()]} <small>${a.getFullYear()}</small>` : (() => { const s = new Date(from), e = new Date(to - DAY); return `${s.getDate()}–${e.getDate()} ${s.getMonth() === e.getMonth() ? MONTHS[e.getMonth()] : MONTHS[s.getMonth()].slice(0, 3) + ' – ' + e.getDate() + ' ' + MONTHS[e.getMonth()]} <small>${e.getFullYear()}</small>`; })();
    E.seg.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === view); b.setAttribute('aria-pressed', b.dataset.v === view); });
    E.dow.hidden = view !== 'month';
    if (view === 'agenda') { const e = new Date(from + (days - 1) * DAY); E.title.innerHTML = `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3).toLowerCase()} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0, 3).toLowerCase()} <small>${e.getFullYear()}</small>`; }
    E.dow.innerHTML = view === 'day' ? `<div class="cv-dayname">${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][a.getDay()]} ${a.getDate()} de ${MONTHS[a.getMonth()].toLowerCase()}</div>` : DOW.map(d => `<div>${d}</div>`).join('');
    E.grid.className = 'cv-grid ' + view; E.grid.style.setProperty('--rows', days / 7);
    let html = '', nDone = 0, nSched = 0, nRt = 0;
    for (let i = 0; i < days; i++) {
      const ts = from + i * DAY, d = new Date(ts), k = ymd(d), list = by[k] || [];
      for (const ev of list) { if (ev.kind === 'done') nDone++; else if (ev.kind === 'sched') nSched++; else if (ev.kind === 'routine') nRt++; }
    }
    if (view === 'month') for (let i = 0; i < days; i++) {
      const ts = from + i * DAY, d = new Date(ts), k = ymd(d), list = by[k] || [], dow = (d.getDay() + 6) % 7;
      const out = d.getMonth() !== a.getMonth(), past = ts < startOfDay(Date.now());
      html += `<div class="cv-day${k === today ? ' today' : ''}${out ? ' out' : ''}${past ? ' past' : ''}${dow >= 5 ? ' wknd' : ''}" data-day="${k}">
        <div class="cv-num">${d.getDate() === 1 ? `<span>${MONTHS[d.getMonth()].slice(0, 3)}</span>` : ''}<b>${pad(d.getDate())}</b></div>
        <button class="cv-add" type="button" title="Programar algo el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}" aria-label="Programar algo el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}">+</button>
        <div class="cv-evs">${list.map(ev => cardHTML(ev, true)).join('')}</div></div>`;
    }
    else if (view === 'agenda') { E.grid.className = 'cv-grid agenda'; html = agendaHTML(from, days, by); }
    else { E.grid.className = 'cv-grid tg tg-' + view; E.grid.style.setProperty('--n', days); html = `<div class="cv-tg">${timeGrid(from, days, by)}</div>`; }
    const key = view + ':' + from;
    if (view !== 'month' && key === tgKey) tgScroll = E.grid.scrollTop;
    E.grid.innerHTML = html;
    if (view === 'month') fitMonth();
    else if (view === 'agenda') { if (key !== tgKey) { tgKey = key; E.grid.scrollTop = 0; } else E.grid.scrollTop = tgScroll; }
    else if (key === tgKey) E.grid.scrollTop = tgScroll;
    else { // a new week or day opens on the working hours, or on «now» when today is on screen
      tgKey = key; const now = new Date(), onScreen = Date.now() >= from && Date.now() < from + days * DAY;
      const h = onScreen ? Math.max(0, now.getHours() - 1) : 7;
      const row = E.grid.querySelector(`.cv-tg-h[data-h="${h}"]`), head = E.grid.querySelector('.cv-tg-d');
      E.grid.scrollTop = row ? row.offsetTop - (head ? head.offsetHeight : 0) - E.grid.querySelector('.cv-tg-c').offsetTop : 0;
    }
    if (view === 'month') tgKey = '';
    E.stats.innerHTML = `<span><b>${nRt}</b> ${nRt === 1 ? 'ejecución de rutina' : 'ejecuciones de rutinas'}</span><span><b>${nSched}</b> programadas</span><span><b>${nDone}</b> listas</span>`;
    renderRail(); renderChips();
  }
  function timeGrid(from, days, by) { // columns = days, rows = hours; a slot is a drop target and a click schedules at that hour
    const today = ymd(new Date()), now = new Date();
    const cols = []; for (let i = 0; i < days; i++) { const ts = from + i * DAY, d = new Date(ts); cols.push({ ts, d, k: ymd(d), list: by[ymd(d)] || [] }); }
    let html = '<div class="cv-tg-c"></div>' + cols.map(({ d, k }) => `<div class="cv-tg-d${k === today ? ' today' : ''}" data-day="${k}"><span>${days === 1 ? DOW_LONG[d.getDay()] : DOW[(d.getDay() + 6) % 7]}</span><b>${d.getDate()}</b>${days === 1 ? `<span>de ${MONTHS[d.getMonth()].toLowerCase()}</span>` : ''}</div>`).join('');
    if (cols.some(c => c.list.some(ev => LIVE.includes(ev.kind)))) // work under way has no hour: a row of its own above the grid, never a fake hour
      html += '<div class="cv-tg-h lv">EN MARCHA</div>' + cols.map(c => `<div class="cv-tg-lv">${c.list.filter(ev => LIVE.includes(ev.kind)).map(ev => cardHTML(ev)).join('')}</div>`).join('');
    for (let h = 0; h < 24; h++) {
      html += `<div class="cv-tg-h" data-h="${h}">${pad(h)}:00</div>`;
      for (const c of cols) {
        const end = new Date(c.ts); end.setHours(h + 1, 0, 0, 0);
        const isNow = c.k === today && h === now.getHours(), wk = (c.d.getDay() + 6) % 7 >= 5;
        const list = c.list.filter(ev => !LIVE.includes(ev.kind) && new Date(ev.at).getHours() === h);
        html += `<div class="cv-day cv-slot${end.getTime() <= Date.now() ? ' past' : ''}${isNow ? ' now' : ''}${wk ? ' wknd' : ''}" data-day="${c.k}" data-hour="${h}">${isNow ? `<i class="cv-nowline" style="top:${Math.round(now.getMinutes() / 60 * 100)}%" aria-hidden="true"></i>` : ''}<div class="cv-evs">${list.map(ev => cardHTML(ev)).join('')}</div></div>`;
      }
    }
    return html;
  }
  function agendaHTML(from, days, by) { // V4.2 (audit B5): on a phone, a list by day — what is on, in order, readable; today always shows
    const today = ymd(new Date()); let html = '', any = false;
    for (let i = 0; i < days; i++) {
      const ts = from + i * DAY, d = new Date(ts), k = ymd(d), list = by[k] || [];
      if (!list.length && k !== today) continue; any = true;
      const rel = k === today ? 'hoy' : ymd(new Date(Date.now() + DAY)) === k ? 'mañana' : '';
      html += `<section class="cv-day cv-ag-day${k === today ? ' today' : ''}${ts < startOfDay(Date.now()) ? ' past' : ''}" data-day="${k}">
        <div class="cv-ag-h"><b>${d.getDate()}</b><span>${DOW_LONG[d.getDay()]}${rel ? ` · ${rel}` : ''}</span><span class="sp"></span><button class="cv-add" type="button" aria-label="Programar algo el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}">+</button></div>
        <div class="cv-evs">${list.length ? list.map(ev => cardHTML(ev)).join('') : '<div class="cv-empty">Nada para hoy.</div>'}</div></section>`;
    }
    return any ? html : '<div class="cv-empty">Nada en estos días.</div>';
  }
  function fitMonth() { // as many one-line events as the cell holds, then «+N más» — never a card cut in half
    for (const cell of E.grid.querySelectorAll('.cv-day')) {
      const evs = cell.querySelector('.cv-evs'), items = [...evs.querySelectorAll('.cv-ev')];
      if (!items.length || evs.scrollHeight <= evs.clientHeight + 1) continue;
      const room = evs.clientHeight - 20; let k = 0;
      for (const it of items) { if (it.offsetTop + it.offsetHeight <= room) k++; else break; }
      k = Math.max(1, k); items.slice(k).forEach(n => { n.hidden = true; });
      evs.insertAdjacentHTML('beforeend', `<button type="button" class="cv-more" data-day="${cell.dataset.day}">+${items.length - k} más</button>`);
    }
  }
  function renderBacklog() { // pending work with no date: drag it onto a day to schedule it
    const list = (backlog ? backlog() : []).filter(t => deptOn.has(t.dept) && matches(t.title));
    if (!E.back) { E.back = document.createElement('div'); E.back.className = 'cv-back'; E.rail.parentElement.insertBefore(E.back, E.rail.previousElementSibling); }
    E.back.innerHTML = `<div class="cv-rail-h">SIN FECHA <b>${list.length}</b></div>` + (list.length ? list.slice(0, 30).map(t => { const a = agentOf(t.agent); return `<div class="cv-bk" draggable="true" data-ev="t:${t.id}" style="--chip:${DEPTS[t.dept].chip}" role="button" tabindex="0" title="Arrástrala a un día para programarla"><div class="cv-r-t">${esc(t.title)}</div><div class="cv-r-m">${esc(a ? a.name : '')} · pendiente</div></div>`; }).join('') : '<div class="cv-empty">Nada pendiente sin fecha.</div>');
  }
  function renderLoad() { // who has how much in the days on screen: tasks and routine runs per agent
    const { from, to } = range(); const by = events(from, to), n = {};
    for (const k in by) for (const ev of by[k]) if (!ev.skipped && !ev.paused && ev.kind !== 'done') n[ev.agent] = (n[ev.agent] || 0) + 1;
    const top = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 8), max = top.length ? top[0][1] : 1;
    if (!E.load) { E.load = document.createElement('details'); E.load.className = 'cv-load'; E.load.open = true; E.rail.parentElement.appendChild(E.load); }
    const wasOpen = E.load.open;
    E.load.innerHTML = `<summary class="cv-rail-h">CARGA ${view === 'day' ? 'DEL DÍA' : view === 'week' ? 'DE LA SEMANA' : 'DEL MES'}</summary>` + (top.length ? top.map(([id, c]) => { const a = agentOf(id); return `<div class="cv-ld"><span>${esc(a ? a.name : id)}</span><i style="width:${Math.round(c / max * 100)}%;background:${a ? DEPTS[a.dept].chip : '#ccc'}"></i><b>${c}</b></div>`; }).join('') : '<div class="cv-empty">Nada por hacer en estos días.</div>');
    E.load.open = wasOpen;
  }
  function renderRail() {
    renderBacklog(); renderLoad();
    const list = routines.filter(r => !gone.has('r:' + r.id)).sort((x, y) => (x.paused ? Infinity : x.nextAt || Infinity) - (y.paused ? Infinity : y.nextAt || Infinity));
    E.railN.textContent = list.length;
    E.rail.innerHTML = list.length ? list.map(r => { const a = agentOf(r.agent), chip = DEPTS[r.dept].chip; return `<div class="cv-r${r.paused ? ' paused' : ''}${onlyRoutine === r.id ? ' on' : ''}" data-rid="${r.id}" style="--chip:${chip}" role="button" tabindex="0" aria-pressed="${onlyRoutine === r.id}" title="Ver solo esta rutina en el calendario">
        <div class="cv-r-t">${esc(r.title)}</div>
        <div class="cv-r-m">${esc(r.desc || describe(r.when))} · ${esc(a ? a.name : r.agent)}</div>
        <div class="cv-r-n">${r.paused ? '<span class="cv-paused">PAUSADA</span>' : `próxima ${esc(untilText(r.nextAt))}`}${tasks.some(t => t.routine === r.id && t.state === 'waiting') ? ' · <span class="cv-wait">un borrador espera tu OK</span>' : r.needsOk ? ' · pedirá tu OK' : ' · no te espera'}</div></div>`; }).join('')
      : `<div class="cv-empty">Sin rutinas todavía.<br>Haz clic en un día, escribe lo que debe pasar, activa REPETIR.</div>`;
  }
  function renderChips() {
    E.chips.innerHTML = DEPT_KEYS.map(k => `<button type="button" class="cv-chip${deptOn.has(k) ? ' on' : ''}" data-dept="${k}" aria-pressed="${deptOn.has(k)}"><i style="background:${DEPTS[k].chip}"></i>${DEPTS[k].short}</button>`).join('') +
      `<span class="cv-sep"></span><button type="button" class="cv-chip${showRoutines ? ' on' : ''}" data-tog="routines" aria-pressed="${showRoutines}"><i class="rt" aria-hidden="true">⏱</i>RUTINAS</button><button type="button" class="cv-chip${showDone ? ' on' : ''}" data-tog="done" aria-pressed="${showDone}"><i class="tick" aria-hidden="true">✓</i>LISTAS</button>` +
      (onlyRoutine ? `<button class="cv-chip only on" data-tog="only">SOLO ESTA RUTINA ✕</button>` : '');
  }

  /* ---------- the popovers: a day (create), an event (details), "n more" (the whole day) ---------- */
  function place(el, anchorEl) { // beside the cell, kept on screen
    const r = anchorEl.getBoundingClientRect(), W = el.offsetWidth || 360, H = el.offsetHeight || 300;
    let x = r.right + 10, y = r.top; if (x + W > innerWidth - 12) x = r.left - W - 10; if (x < 12) x = Math.max(12, Math.min(innerWidth - W - 12, r.left));
    if (y + H > innerHeight - 12) y = Math.max(12, innerHeight - H - 12);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  let createDraft = ''; // V4.1 (audit 26): what was typed in «Programar para» survives a click outside and comes back on the next day clicked
  function closePop() { if (popKind === 'create') { const tx = E.pop.querySelector('.cv-text'); if (tx) createDraft = tx.value; } E.pop.hidden = true; E.pop.innerHTML = ''; popKind = null; ov.querySelectorAll('.cv-day.sel').forEach(n => n.classList.remove('sel')); }
  function openCreate(dayKey, cell) {
    closePop(); popKind = 'create'; cell.classList.add('sel');
    const slotH = cell.dataset.hour !== undefined ? +cell.dataset.hour : null; // a click on an hour of the week or the day schedules at that hour
    if (currentDept && DEPT_KEYS.includes(currentDept())) lastDept = currentDept(); // the popover opens on the bar's department
    const d = new Date(dayKey + 'T00:00:00'), past = d.getTime() < startOfDay(Date.now());
    E.pop.innerHTML = `<div class="cv-pop-h"><span class="lab">PROGRAMAR PARA</span><b>${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}</b><span class="sp"></span><button class="cv-x" data-act="close">✕</button></div>
      ${past ? '<div class="cv-note">Ese día ya pasó — elige hoy o un día posterior.</div>' : ''}
      <div class="cv-row"><select class="cv-dept">${DEPT_KEYS.map(k => `<option value="${k}"${k === lastDept ? ' selected' : ''}>${DEPTS[k].name}</option>`).join('')}</select><select class="cv-time" aria-label="Hora">${timeOpts(slotH !== null ? pad(slotH) + ':00' : dayKey === ymd(new Date()) ? pad(Math.min(23, new Date().getHours() + 1)) + ':00' : '09:00')}</select><select class="cv-model" title="Qué modelo la ejecuta" aria-label="Modelo"><option value="">${esc(modelName(officeModel()).toUpperCase())}</option>${MODEL_KEYS.filter(k => k !== officeModel()).map(k => `<option value="${k}">${esc(modelName(k).toUpperCase())}</option>`).join('')}</select></div>
      <textarea class="cv-text" rows="3" placeholder="¿Qué debe pasar ese día?" aria-label="Qué debe pasar ese día">${esc(createDraft)}</textarea>${createDraft.trim() ? '<div class="cv-note">Recuperé lo que estabas escribiendo. <button type="button" class="cv-lnk" data-act="forget">Borrarlo</button></div>' : ''}
      <div class="cv-row"><button class="cv-rep" data-act="rep">REPETIR</button><select class="cv-cad" hidden aria-label="Cada cuándo">${CADENCES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select><label class="cv-ok" hidden><input type="checkbox" class="cv-okc" checked> necesita mi visto bueno</label><span class="sp"></span><button class="cv-go" data-act="go"${past ? ' disabled' : ''}>AGREGAR</button></div>
      <div class="cv-hint">${past ? '' : 'Una tarea para este día — se ejecuta a esa hora y aparece en el panel. REPETIR la convierte en rutina desde esta fecha.'}</div>`;
    E.pop.hidden = false; place(E.pop, cell);
    const P = { dept: E.pop.querySelector('.cv-dept'), time: E.pop.querySelector('.cv-time'), model: E.pop.querySelector('.cv-model'), text: E.pop.querySelector('.cv-text'), rep: E.pop.querySelector('.cv-rep'), cad: E.pop.querySelector('.cv-cad'), ok: E.pop.querySelector('.cv-ok'), okc: E.pop.querySelector('.cv-okc'), go: E.pop.querySelector('.cv-go'), hint: E.pop.querySelector('.cv-hint') };
    let repeat = false;
    const hint = () => {
      if (past) return;
      const k = P.dept.value; lastDept = k;
      if (repeat) { const w = fromPicker(P.cad.value, P.time.value, dayKey); const first = occurrences(w, Date.now(), Date.now() + 400 * DAY, 1)[0]; P.hint.innerHTML = RT_DEPTS.includes(k) ? `Rutina · <b>${esc(describe(w))}</b> · primera ejecución ${esc(first ? fmtDay(first) + ' ' + hm(first) : '—')}${isLive() ? ' · Claude elige al agente' : ''}` : `<span class="amber">${esc(rtRefuse(k))}</span>`; P.go.disabled = !RT_DEPTS.includes(k); }
      else { P.hint.innerHTML = `Tarea para <b>${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} · ${esc(P.time.value)}</b>${isLive() ? ' · Claude elige al agente ahora, la ejecuta después' : ''}`; P.go.disabled = false; }
    };
    P.rep.addEventListener('click', () => { repeat = !repeat; P.rep.classList.toggle('on', repeat); P.cad.hidden = !repeat; P.ok.hidden = !repeat; if (repeat) { const dow = (d.getDay() + 6) % 7; P.cad.value = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][dow]; } hint(); });
    [P.dept, P.time, P.cad, P.model].forEach(el => { el.addEventListener('change', hint); el.addEventListener('keydown', e => e.stopPropagation()); });
    P.text.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } else if (e.key === 'Escape') closePop(); });
    P.go.addEventListener('click', go);
    E.pop.querySelector('[data-act="forget"]')?.addEventListener('click', e => { createDraft = ''; P.text.value = ''; e.currentTarget.parentElement.remove(); P.text.focus(); });
    hint(); P.text.focus(); P.text.setSelectionRange(P.text.value.length, P.text.value.length);
    async function go() {
      const text = P.text.value.trim().replace(/[.!]+$/, ''); if (!text) { P.text.focus(); return; }
      const k = P.dept.value, model = P.model.value || undefined;
      P.go.disabled = true; P.hint.innerHTML = isLive() ? 'Claude está eligiendo al agente…' : 'Agregando…';
      let r;
      if (repeat) r = await createRoutine({ dept: k, text, when: fromPicker(P.cad.value, P.time.value, dayKey), needsOk: P.okc.checked, model });
      else r = await create({ dept: k, text, at: new Date(`${dayKey}T${P.time.value || '09:00'}:00`).getTime(), model });
      if (!r || !r.ok) { P.hint.innerHTML = `<span class="amber">${esc((r && r.error) || 'No se pudo agregar.')}</span>`; P.go.disabled = false; return; }
      P.text.value = ''; createDraft = ''; closePop(); render();
      const el = E.grid.querySelector(`.cv-ev[data-ev="${repeat ? 'r:' + r.routine.id + ':' : 't:' + r.task.id}"], .cv-ev[data-ev^="${repeat ? 'r:' + r.routine.id + ':' : 't:' + r.task.id}"]`);
      if (el) { el.classList.add('new'); el.scrollIntoView({ block: 'nearest' }); }
      // V4.2: who got it, said out loud — the popover used to close without telling
      const who = agentOf(repeat ? r.routine.agent : r.task.agent);
      if (who) E.stats.innerHTML = `<span class="cv-said">${repeat ? 'Rutina creada' : 'Programada'} · la tiene <b>${esc(who.name)}</b>${r.task && r.task.why && /enrutador/.test(r.task.why) ? ' (el jefe: el enrutador no respondió)' : ''}</span>`;
    }
  }
  const say = (msg, bad) => { const h = E.pop.querySelector('.cv-hint'); if (h) h.innerHTML = bad ? `<span class="amber">${esc(msg)}</span>` : esc(msg); };
  function openEvent(id, el) {
    closePop();
    const [kind, ...rest] = id.split(':');
    if (kind === 't') {
      const t = tasks.find(x => String(x.id) === rest[0]); if (!t) return;
      if (t.state !== 'scheduled' && openTask) { openTask(t); return; } // done · running · waiting · pending → the task's detail, over the calendar
      const a = agentOf(t.agent);
      popKind = 'event';
      const edit = t.state === 'scheduled';
      const due = new Date(t.dueAt || Date.now());
      E.pop.innerHTML = `<div class="cv-pop-h"><span class="lab">${edit ? 'TAREA PROGRAMADA' : { doing: 'EN CURSO', waiting: 'EN ESPERA DE TU VISTO BUENO', next: 'EN PENDIENTES' }[t.state] || t.state.toUpperCase()}</span><span class="sp"></span><button class="cv-x" type="button" data-act="close" aria-label="Cerrar">✕</button></div>
        <div class="cv-pop-t">${esc(t.title)}</div>
        <div class="cv-pop-m">${av(t.agent)} ${esc(a ? a.name : '')} · ${esc(DEPTS[t.dept].name)}${edit ? ` · se ejecuta ${esc(untilText(t.dueAt))}` : ''}${t.modelUsed ? ' · ' + esc(modelName(t.modelUsed)) : ''}</div>
        ${edit ? `<label class="cv-lab">Qué debe pasar</label><textarea class="cv-text" rows="3">${esc(t.text || t.title)}</textarea>
        <div class="cv-row"><select class="cv-date" aria-label="Día">${dateOpts(ymd(due))}</select><select class="cv-time" aria-label="Hora">${timeOpts(hm(due))}</select><select class="cv-model" aria-label="Modelo"><option value="">${esc(modelName(officeModel()).toUpperCase())}</option>${MODEL_KEYS.filter(k => k !== officeModel()).map(k => `<option value="${k}"${t.model === k ? ' selected' : ''}>${esc(modelName(k).toUpperCase())}</option>`).join('')}</select></div>`
        : (t.text && t.text !== t.title ? `<div class="cv-pop-p">${esc(t.text)}</div>` : '')}
        <div class="cv-row">${edit ? '<button class="cv-go" type="button" data-act="save">GUARDAR</button>' : ''}<button class="cv-btn" type="button" data-act="open">ABRIR EL AGENTE</button><span class="sp"></span>${edit ? '<button class="cv-btn warn" type="button" data-act="cancel">CANCELARLA</button>' : ''}</div>
        <div class="cv-hint" aria-live="polite">${edit ? 'Cambia el texto, el día o la hora. También puedes arrastrar la tarjeta a otro día.' : ''}</div>`;
      E.pop.hidden = false; place(E.pop, el);
      E.pop.querySelectorAll('textarea, input, select').forEach(x => x.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closePop(); }));
      E.pop.querySelector('[data-act="open"]').addEventListener('click', () => { close(); openAgent(t.agent, 'chat'); });
      E.pop.querySelector('[data-act="cancel"]')?.addEventListener('click', () => later('t:' + t.id, `Cancelada: «${t.title.slice(0, 60)}».`, () => cancelTask(t)));
      E.pop.querySelector('[data-act="save"]')?.addEventListener('click', async e => {
        const btn = e.currentTarget, P = { text: E.pop.querySelector('.cv-text'), date: E.pop.querySelector('.cv-date'), time: E.pop.querySelector('.cv-time'), model: E.pop.querySelector('.cv-model') };
        const text = P.text.value.trim(); if (!text) { P.text.focus(); return; }
        const at = new Date(`${P.date.value}T${P.time.value || '09:00'}:00`).getTime();
        const patch = {};
        if (at !== t.dueAt) patch.at = at;
        if (text !== (t.text || t.title)) patch.text = text;
        if ((P.model.value || '') !== (t.model || '')) patch.model = P.model.value;
        if (!Object.keys(patch).length) { closePop(); return; }
        btn.disabled = true; say(patch.text && isLive() ? 'Claude vuelve a elegir al agente…' : 'Guardando…');
        const r = await updateTask(t, patch);
        if (!r || !r.ok) { say((r && r.error) || 'No se pudo guardar.', true); btn.disabled = false; return; }
        closePop(); render(); flash('t:' + t.id);
      });
      return;
    }
    const r = routines.find(x => x.id === rest[0]); if (!r) return;
    const a = agentOf(r.agent), at = +rest[1];
    const pk = toPicker(r.when);
    popKind = 'event';
    E.pop.innerHTML = `<div class="cv-pop-h"><span class="lab">RUTINA</span><span class="sp"></span><button class="cv-x" type="button" data-act="close" aria-label="Cerrar">✕</button></div>
      <textarea class="cv-title" rows="1" aria-label="Título de la rutina" maxlength="90">${esc(r.title)}</textarea>
      <div class="cv-pop-m">${av(r.agent)} ${esc(a ? a.name : r.agent)} · ${esc(r.desc || describe(r.when))}${r.paused ? ' · <span class="cv-paused">PAUSADA</span>' : ''}</div>
      <div class="cv-pop-p">Esta ejecución: ${esc(fmtLong(at))}${r.nextAt ? ` · próxima ${esc(untilText(r.nextAt))}` : ''}${r.lastAt ? ` · última vez ${esc(fmtDay(r.lastAt))}` : ''}</div>
      <label class="cv-lab">Qué debe pasar</label><textarea class="cv-text" rows="3">${esc(r.text || r.title)}</textarea>
      <div class="cv-row"><select class="cv-cad" aria-label="Cada cuándo">${pk.custom ? `<option value="custom" selected>${esc(r.desc || describe(r.when))}</option>` : ''}${CADENCES.map(([v, l]) => `<option value="${v}"${v === pk.cadence ? ' selected' : ''}>${l}</option>`).join('')}</select><select class="cv-time" aria-label="Hora"${pk.cadence === 'hourly' ? ' disabled' : ''}>${timeOpts(pk.at)}</select>
        <label class="cv-ok"><input type="checkbox" class="cv-okc"${r.needsOk ? ' checked' : ''}> necesita mi visto bueno</label></div>
      <div class="cv-row"><button class="cv-go" type="button" data-act="save">GUARDAR</button><button class="cv-btn" type="button" data-act="run" title="La ejecuta ya, sin esperar a su hora">EJECUTAR AHORA</button></div>
      <div class="cv-row cv-row2">${at > Date.now() ? `<button class="cv-lk" type="button" data-act="${(r.skips || []).includes(at) ? 'unskip' : 'skip'}">${(r.skips || []).includes(at) ? 'No saltar esta' : 'Saltar solo esta'}</button>` : ''}<button class="cv-lk" type="button" data-act="${r.paused ? 'resume' : 'pause'}">${r.paused ? 'Reanudar' : 'Pausar'}</button><button class="cv-lk" type="button" data-act="only" title="El calendario muestra solo esta rutina">Ver solo esta</button><span class="sp"></span><button class="cv-lk warn" type="button" data-act="delete">Eliminar</button></div>
      <div class="cv-hint" aria-live="polite">${r.needsOk ? 'Lo que haya que enviar espera tu visto bueno.' : 'Solo lee y reporta: no te espera.'}</div>`;
    E.pop.hidden = false; place(E.pop, el);
    // V4.2 (audit B16): the title grows to show itself whole (a long one ran out of its field); the actions sit in two rows, none off-view
    const fitTitle = () => { const t = E.pop.querySelector('.cv-title'); t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    fitTitle(); E.pop.querySelector('.cv-title').addEventListener('input', fitTitle);
    E.pop.querySelector('.cv-title').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); }); // one line of text, however it wraps
    place(E.pop, el);
    const P = { title: E.pop.querySelector('.cv-title'), text: E.pop.querySelector('.cv-text'), cad: E.pop.querySelector('.cv-cad'), time: E.pop.querySelector('.cv-time'), okc: E.pop.querySelector('.cv-okc') };
    E.pop.querySelectorAll('textarea, input, select').forEach(x => x.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closePop(); }));
    P.cad.addEventListener('change', () => { P.time.disabled = P.cad.value === 'hourly'; });
    E.pop.querySelectorAll('[data-act]').forEach(b => { if (b.dataset.act === 'close') return; b.addEventListener('click', async () => {
      const act = b.dataset.act;
      if (act === 'only') { onlyRoutine = r.id; closePop(); render(); return; }
      if (act === 'save') {
        const patch = {}, title = P.title.value.trim(), text = P.text.value.trim();
        if (title && title !== r.title) patch.title = title;
        if (text && text !== r.text) patch.text = text;
        if (P.okc.checked !== !!r.needsOk) patch.needsOk = P.okc.checked;
        if (P.cad.value !== 'custom' && (P.cad.value !== pk.cadence || P.time.value !== pk.at)) patch.when = fromPicker(P.cad.value, P.time.value, r.when.start);
        if (P.cad.value === 'custom' && P.time.value !== pk.at && r.when.at) patch.when = { ...r.when, at: P.time.value };
        if (!Object.keys(patch).length) { closePop(); return; }
        b.disabled = true; say('Guardando…');
        const res = await updateRoutine(r.id, patch);
        if (!res || !res.ok) { say((res && res.error) || 'No se pudo guardar.', true); b.disabled = false; return; }
        closePop(); render(); return;
      }
      if (act === 'skip' || act === 'unskip') {
        if (!(at > Date.now())) { say('Esa ejecución ya pasó.', true); return; }
        b.disabled = true; const res = await skipRun(r.id, at, act === 'skip');
        if (!res || !res.ok) { say((res && res.error) || 'No se pudo.', true); b.disabled = false; return; }
        closePop(); render(); return;
      }
      if (act === 'delete') { later('r:' + r.id, `Rutina eliminada: «${r.title.slice(0, 60)}».`, () => rtAct(r.id, 'delete')); return; }
      b.disabled = true;
      const res = await rtAct(r.id, act);
      if (res && res.ok === false) { say('No se pudo: ' + res.error, true); b.disabled = false; return; }
      closePop(); render();
    }); });
  }
  function flash(evId) { const el = E.grid.querySelector(`.cv-ev[data-ev^="${evId}"]`); if (el) { el.classList.add('new'); el.scrollIntoView({ block: 'nearest' }); } }

  /* ---------- drag a card to another day: a scheduled task moves (same time), a weekly routine changes its weekday ---------- */
  ov.addEventListener('dragstart', e => {
    const card = e.target.closest('.cv-ev[draggable="true"], .cv-bk[draggable="true"]'); if (!card) return;
    const [kind, id, at] = card.dataset.ev.split(':');
    dragging = { kind, id, at: +at || 0 }; closePop();
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', card.dataset.ev);
    card.classList.add('cv-dragging'); ov.classList.add('dragging');
  });
  ov.addEventListener('dragend', () => { E.grid.querySelectorAll('.cv-dragging, .cv-day.drop').forEach(n => n.classList.remove('cv-dragging', 'drop')); ov.classList.remove('dragging'); setTimeout(() => { dragging = null; }, 0); });
  E.grid.addEventListener('dragover', e => {
    if (!dragging) return; const day = e.target.closest('.cv-day'); if (!day) return;
    if (day.classList.contains('past')) { e.dataTransfer.dropEffect = 'none'; return; }
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    E.grid.querySelectorAll('.cv-day.drop').forEach(n => { if (n !== day) n.classList.remove('drop'); }); day.classList.add('drop');
  });
  E.grid.addEventListener('dragleave', e => { const day = e.target.closest('.cv-day'); if (day && !day.contains(e.relatedTarget)) day.classList.remove('drop'); });
  E.grid.addEventListener('drop', async e => {
    if (!dragging) return; const day = e.target.closest('.cv-day'); if (!day || day.classList.contains('past')) return;
    e.preventDefault();
    const d = dragging; dragging = null; ov.classList.remove('dragging');
    await dropOn(day, d);
  });
  async function dropOn(day, d) { // the mouse and the finger end here alike
    const target = new Date(day.dataset.day + 'T00:00:00'), hour = day.dataset.hour !== undefined ? +day.dataset.hour : null;
    if (d.kind === 't') {
      const t = tasks.find(x => String(x.id) === d.id); if (!t) return;
      if (t.state === 'next') { // from «sin fecha»: it becomes a scheduled task on that day (09:00, or the hour it was dropped on)
        target.setHours(hour ?? 9, 0, 0, 0);
        if (target.getTime() <= Date.now()) { render(); E.stats.innerHTML = '<span class="amber">Esa hora ya pasó — suéltala en un día u hora por venir.</span>'; return; }
        E.stats.innerHTML = '<span>Programando…</span>';
        const r = act ? await act(t, 'save', { at: target.getTime() }) : { ok: false, error: 'no disponible' };
        render(); if (!r || !r.ok) E.stats.innerHTML = `<span class="amber">No se pudo programar: ${esc((r && r.error) || 'error')}</span>`; else flash('t:' + t.id);
        return;
      }
      const old = new Date(t.dueAt); target.setHours(hour ?? old.getHours(), hour !== null && hour !== old.getHours() ? 0 : old.getMinutes(), 0, 0); // same hour on another day keeps its minutes
      if (target.getTime() === t.dueAt) { render(); return; }
      if (target.getTime() <= Date.now()) { render(); E.stats.innerHTML = `<span class="amber">A esa hora ya pasó hoy — abre la tarea y elige otra hora.</span>`; return; }
      E.stats.innerHTML = '<span>Moviendo…</span>';
      const r = await updateTask(t, { at: target.getTime() });
      render();
      if (!r || !r.ok) E.stats.innerHTML = `<span class="amber">No se pudo mover: ${esc((r && r.error) || 'error')}</span>`; else flash('t:' + t.id);
      return;
    }
    const r = routines.find(x => x.id === d.id); if (!r) { render(); return; }
    // a routine dropped on the grid can change its hour (the week and the day have hours now) and, if weekly, its weekday — both in one question
    const when = { ...r.when }, said = [];
    if (hour !== null && r.when.at && +r.when.at.slice(0, 2) !== hour) { when.at = `${pad(hour)}:${r.when.at.slice(3)}`; said.push(`a las ${when.at}`); }
    const from = new Date(d.at).getDay(), to = target.getDay();
    if (r.when.kind === 'weekly' && from !== to) { when.days = r.when.days.map(x => x === from ? to : x); said.push(`de los ${DOW_LONG[from]} a los ${DOW_LONG[to]}`); }
    if (!said.length) { render(); return; }
    if (!confirm(`¿Mover «${r.title}» ${said.join(' y ')}? Cambia todas sus ejecuciones.`)) { render(); return; }
    const res = await updateRoutine(r.id, { when });
    render();
    if (!res || !res.ok) E.stats.innerHTML = `<span class="amber">No se pudo mover: ${esc((res && res.error) || 'error')}</span>`;
  }

  /* ---------- V4.2 (audit B28): drag with a finger — a tablet or a phone had no HTML5 drag at all. Hold a card still
     for a moment, then move it: the page stops scrolling, the day or hour under the finger lights up, lifting drops it. ---------- */
  let touch = null, eatClick = false;
  ov.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || touch) return;
    const card = e.target.closest('.cv-ev[draggable="true"], .cv-bk[draggable="true"]'); if (!card) return;
    touch = { card, x: e.clientX, y: e.clientY, on: false, ghost: null, over: null };
    touch.timer = setTimeout(() => {
      if (!touch) return;
      const [kind, id, at] = card.dataset.ev.split(':');
      dragging = { kind, id, at: +at || 0 }; closePop(); touch.on = true;
      card.classList.add('cv-dragging'); ov.classList.add('dragging');
      const g = card.cloneNode(true); g.classList.add('cv-ghost'); g.removeAttribute('draggable'); g.style.width = card.offsetWidth + 'px';
      document.body.appendChild(g); touch.ghost = g; moveGhost(touch.x, touch.y);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 380);
  });
  function moveGhost(x, y) { if (touch && touch.ghost) { touch.ghost.style.left = x + 'px'; touch.ghost.style.top = y + 'px'; } }
  function endTouch() {
    if (!touch) return; clearTimeout(touch.timer);
    if (touch.ghost) touch.ghost.remove();
    if (touch.on) { eatClick = true; setTimeout(() => { eatClick = false; }, 400); }
    touch.card.classList.remove('cv-dragging'); ov.classList.remove('dragging'); E.grid.querySelectorAll('.cv-day.drop').forEach(n => n.classList.remove('drop'));
    touch = null;
  }
  ov.addEventListener('pointermove', e => {
    if (!touch) return;
    if (!touch.on) { if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 8) { clearTimeout(touch.timer); touch = null; } return; } // a swipe: the page scrolls as always
    moveGhost(e.clientX, e.clientY);
    const under = document.elementFromPoint(e.clientX, e.clientY), day = under && under.closest('#cvGrid .cv-day');
    E.grid.querySelectorAll('.cv-day.drop').forEach(n => { if (n !== day) n.classList.remove('drop'); });
    touch.over = day && !day.classList.contains('past') ? day : null; if (touch.over) touch.over.classList.add('drop');
    // near the grid's top or bottom edge, it scrolls under the finger
    const g = E.grid.getBoundingClientRect(); if (e.clientY < g.top + 40) E.grid.scrollTop -= 12; else if (e.clientY > g.bottom - 40) E.grid.scrollTop += 12;
  });
  ov.addEventListener('touchmove', e => { if (touch && touch.on) e.preventDefault(); }, { passive: false }); // holding a card: the finger moves the card, not the page
  ov.addEventListener('pointerup', async () => {
    if (!touch) return; const was = touch.on, day = touch.over, d = dragging;
    endTouch(); dragging = null;
    if (was && day && d) await dropOn(day, d); else if (was) render();
  });
  ov.addEventListener('pointercancel', () => { if (touch) { const was = touch.on; endTouch(); if (was) { dragging = null; render(); } } });
  ov.addEventListener('contextmenu', e => { if (touch) e.preventDefault(); }); // a long press is a drag here, not the phone's menu
  ov.addEventListener('click', e => { if (eatClick) { e.stopPropagation(); e.preventDefault(); eatClick = false; } }, true);
  ov.addEventListener('keydown', e => { // a card opens with Enter too
    const card = e.target.closest && e.target.closest('.cv-ev'); if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); openEvent(card.dataset.ev, card); }
    const side = e.target.closest && e.target.closest('.cv-r[data-rid], .cv-bk'); if (side && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); side.click(); } // V4.1 (audit 94): the routines on the side and the undated tasks answer the keyboard too
  }, true);
  function openMore(dayKey, cell) {
    closePop(); popKind = 'more';
    const { from, to } = range(); const list = events(from, to)[dayKey] || []; const d = new Date(dayKey + 'T00:00:00');
    E.pop.innerHTML = `<div class="cv-pop-h"><span class="lab">${DOW[(d.getDay() + 6) % 7].toUpperCase()} ${d.getDate()} ${MONTHS[d.getMonth()].toUpperCase()}</span><b>${list.length}</b><span class="sp"></span><button class="cv-x" data-act="close">✕</button></div><div class="cv-pop-list">${list.map(cardHTML).join('')}</div>`;
    E.pop.hidden = false; place(E.pop, cell);
  }

  /* ---------- wiring ---------- */
  ov.addEventListener('click', e => {
    const x = e.target.closest('[data-act="close"], .cv-x'); if (x) { closePop(); return; }
    const bk = e.target.closest('.cv-bk'); if (bk) { const t = tasks.find(x => 't:' + x.id === bk.dataset.ev); if (t && openTask) openTask(t); return; }
    const ev = e.target.closest('.cv-ev'); if (ev) { openEvent(ev.dataset.ev, ev); return; }
    const more = e.target.closest('.cv-more'); if (more) { openMore(more.dataset.day, more.closest('.cv-day')); return; }
    const dh = e.target.closest('.cv-tg-d'); if (dh && view === 'week') { anchor = new Date(dh.dataset.day + 'T00:00:00').getTime(); view = 'day'; closePop(); render(); return; }
    const add = e.target.closest('.cv-add'); if (add) { const cell = add.closest('.cv-day'); openCreate(cell.dataset.day, cell); return; }
    const rr = e.target.closest('.cv-r'); if (rr) { onlyRoutine = onlyRoutine === rr.dataset.rid ? null : rr.dataset.rid; render(); return; }
    const chip = e.target.closest('.cv-chip'); if (chip) {
      if (chip.dataset.dept) { const k = chip.dataset.dept; if (deptOn.size === DEPT_KEYS.length) { deptOn = new Set([k]); } else if (deptOn.has(k)) { deptOn.delete(k); if (!deptOn.size) deptOn = new Set(DEPT_KEYS); } else deptOn.add(k); }
      else if (chip.dataset.tog === 'routines') showRoutines = !showRoutines; else if (chip.dataset.tog === 'done') showDone = !showDone; else if (chip.dataset.tog === 'only') onlyRoutine = null;
      render(); return;
    }
    const day = e.target.closest('.cv-day'); if (day && !E.pop.contains(e.target)) { if (e.target === day || e.target.classList.contains('cv-evs') || e.target.closest('.cv-num')) { openCreate(day.dataset.day, day); return; } }
    if (!E.pop.contains(e.target) && !E.pop.hidden) closePop();
  });
  E.seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; view = b.dataset.v; closePop(); render(); });
  $('#cvPrev').addEventListener('click', () => { step(-1); }); $('#cvNext').addEventListener('click', () => { step(1); });
  $('#cvToday').addEventListener('click', () => { anchor = startOfDay(Date.now()); closePop(); render(); });
  $('#cvClose').addEventListener('click', () => close());
  E.search.addEventListener('input', () => { q = E.search.value.trim().toLowerCase(); render(); });
  E.search.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { E.search.value = ''; q = ''; E.search.blur(); render(); } });
  function step(n) { const d = new Date(anchor); if (view === 'agenda') d.setDate(d.getDate() + AGENDA_DAYS * n); else if (view === 'day') d.setDate(d.getDate() + n); else if (view === 'week') d.setDate(d.getDate() + 7 * n); else { d.setDate(1); d.setMonth(d.getMonth() + n); } anchor = d.getTime(); closePop(); render(); }
  ov.addEventListener('keydown', e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); else if (e.key === 't' || e.key === 'T') { anchor = startOfDay(Date.now()); render(); } else if (e.key === 'w' || e.key === 'W') { view = 'week'; render(); } else if (e.key === 'm' || e.key === 'M') { view = 'month'; render(); } else if (e.key === 'a' || e.key === 'A') { view = 'agenda'; render(); } else if (e.key === 'd' || e.key === 'D') { view = 'day'; render(); } });
  ov.addEventListener('dblclick', e => { const day = e.target.closest('.cv-day[data-day]'); if (!day || view !== 'month' || e.target.closest('.cv-ev')) return; anchor = new Date(day.dataset.day + 'T00:00:00').getTime(); view = 'day'; closePop(); render(); });

  let timer = null;
  let calOpener = null;
  let fitT = 0; addEventListener('resize', () => { if (!openNow || view !== 'month') return; clearTimeout(fitT); fitT = setTimeout(() => { if (E.pop.hidden && !dragging) render(); }, 150); }); // the month re-counts what fits
  $('#cvKeys')?.addEventListener('click', () => dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))); // V4.2 (audit B38): the keys live in the «?» sheet, not in the band
  ov.inert = true; // closed: out of Tab's reach
  function open() { if (openNow) return; openNow = true; if (narrow() && (view === 'month' || view === 'week')) view = 'agenda'; /* a phone opens on the agenda */ calOpener = document.activeElement; ov.inert = false; modal.open(ov); E.co.textContent = business ? business() : ''; ov.classList.add('on'); document.body.classList.add('calOpen'); render(); ov.tabIndex = -1; ov.focus(); timer = setInterval(() => { if (E.pop.hidden && !dragging) render(); }, 30000); }
  function close() { if (!openNow) return; flushUndo(); openNow = false; closePop(); modal.close(ov); ov.inert = true; ov.classList.remove('on'); document.body.classList.remove('calOpen'); clearInterval(timer); timer = null; if (calOpener && document.contains(calOpener) && calOpener.focus) calOpener.focus({ preventScroll: true }); } // focus goes back where it came from
  function toggle() { openNow ? close() : open(); }
  function openAt(ts) { anchor = startOfDay(ts || Date.now()); if (view === 'month' && ts) view = 'week'; if (openNow) { closePop(); render(); } else open(); setTimeout(() => { const el = E.grid.querySelector(`.cv-day[data-day="${ymd(new Date(anchor))}"]`); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); } }, 60); }
  function openRoutine(rid) { // V4.1 (audit 29): a routine clicked on the board opens here, on its next run, with its editor
    const r = routines.find(x => x.id === rid); if (!r) return false;
    if (!r.nextAt || r.paused) { onlyRoutine = rid; showRoutines = true; if (openNow) render(); else open(); return true; } // paused: the calendar shows only it
    openAt(r.nextAt);
    setTimeout(() => { const el = E.grid.querySelector(`.cv-ev[data-ev^="r:${CSS.escape(rid)}:"]`); if (el) { el.scrollIntoView({ block: 'nearest' }); openEvent(el.dataset.ev, el); } }, 80);
    return true;
  }
  return { open, openAt, openRoutine, close, toggle, isOpen: () => openNow, refresh: () => { if (openNow && E.pop.hidden && !dragging) render(); }, popOpen: () => !E.pop.hidden, closePop, get view() { return view; }, set view(v) { view = v; render(); } };
}
