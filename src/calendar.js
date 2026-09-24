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

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']; // the week starts on Monday (AU/NZ/UK)
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const mondayOf = ts => { const d = new Date(startOfDay(ts)); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.getTime(); };
const CADENCES = [['daily', 'Todos los días'], ['weekdays', 'Cada día hábil'], ['mon', 'Lunes'], ['tue', 'Martes'], ['wed', 'Miércoles'], ['thu', 'Jueves'], ['fri', 'Viernes'], ['sat', 'Sábados'], ['sun', 'Domingos'], ['hourly', 'Cada hora, 9–5, días hábiles']];

export function initCalendar(ctx) {
  const { tasks, routines, agentOf, DEPTS, DEPT_KEYS, RT_DEPTS, rtRefuse, create, createRoutine, cancelTask, updateTask, updateRoutine, rtAct, openTask, act, backlog, skipRun, openAgent, esc, isLive, officeModel, MODEL_KEYS, modelName, business, currentDept } = ctx;
  const ov = document.getElementById('calOv'); if (!ov) return null;
  const $ = s => ov.querySelector(s);
  const E = { title: $('#cvTitle'), grid: $('#cvGrid'), dow: $('#cvDow'), rail: $('#cvRail'), railN: $('#cvRtN'), chips: $('#cvChips'), search: $('#cvSearch'), stats: $('#cvStats'), pop: $('#cvPop'), co: $('#cvCo'), seg: $('.cv-seg') };
  let openNow = false, view = 'month', anchor = startOfDay(Date.now()), q = '', deptOn = new Set(DEPT_KEYS), showRoutines = true, showDone = true, onlyRoutine = null, popKind = null, lastDept = 'marketing';
  const MAX = { month: 3, week: 8, day: 99 };
  const HOURS = [6, 22]; // the day view's timeline, 06:00–22:00
  const attr = v => esc(v).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); // inside title="…": a quote in a title must not end the attribute
  let dragging = null; // { kind: 't' | 'r', id, at } while a card is being dragged — nothing re-renders under it

  /* ---------- what is on each day ---------- */
  function range() { // [from, to) of the days on screen
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
      if (t.piece) continue; // a team's pieces sit under the lead's card
      if (onlyRoutine && t.routine !== onlyRoutine) continue;
      if (t.state === 'done') { if (showDone && t.doneAt >= from && t.doneAt < to) push({ kind: 'done', at: t.doneAt, title: t.title, dept: t.dept, agent: t.agent, t }); }
      else if (t.state === 'scheduled') { if (t.dueAt >= from && t.dueAt < to) push({ kind: 'sched', at: t.dueAt, title: t.title, dept: t.dept, agent: t.agent, t }); }
      else if (t.state === 'waiting' || t.state === 'doing' || t.state === 'next') { if (today >= from && today < to) push({ kind: t.state, at: Math.max(today + 1, Math.min(today + DAY - 1, t.changedAt || Date.now())), title: t.title, dept: t.dept, agent: t.agent, t }); }
    }
    if (showRoutines) for (const r of routines) {
      if (onlyRoutine && r.id !== onlyRoutine) continue; // paused ones stay, greyed: the timetable is not a guess
      if (!r.when || r.when.kind === 'minutes') continue; // a filming cadence is not a calendar
      const startAt = Math.max(from - 1, Date.now() - 1); // routines are only projected forward: what has run is a done task already
      const occ = occurrences(r.when, startAt, to - 1, 800);
      if (r.when.kind === 'hourly' && view !== 'day') { const seen = new Set(); for (const at of occ) { const k = ymd(new Date(at)); if (seen.has(k)) continue; seen.add(k); push({ kind: 'routine', at, title: r.title, dept: r.dept, agent: r.agent, r, hourly: true, paused: r.paused }); } }
      else for (const at of occ) push({ kind: 'routine', at, title: r.title, dept: r.dept, agent: r.agent, r, paused: r.paused, skipped: (r.skips || []).includes(at) });
    }
    for (const k in by) by[k].sort((a, b) => a.at - b.at);
    return by;
  }

  /* ---------- drawing ---------- */
  const av = (id) => { const a = agentOf(id); const c = a ? DEPTS[a.dept].chip : '#ccc'; return `<i class="cv-av" style="border-color:${c};background:${c}55" title="${attr(a ? a.name : id)}">${esc(a ? a.name[0] : '?')}</i>`; };
  function cardHTML(ev) {
    const chip = DEPTS[ev.dept].chip, a = agentOf(ev.agent);
    const time = ev.kind === 'routine' ? (ev.hourly ? describe(ev.r.when).replace(/ · desde .*$/, '') : hm(ev.at)) : ev.kind === 'done' ? `listo ${hm(ev.at)}` : ev.kind === 'sched' ? `${hm(ev.at)} · programado` : ev.kind === 'doing' ? 'en curso' : ev.kind === 'waiting' ? 'en espera de tu visto bueno' : 'en pendientes';
    const id = ev.t ? `t:${ev.t.id}` : `r:${ev.r.id}:${ev.at}`;
    const drag = (ev.kind === 'sched') || (ev.kind === 'routine' && !ev.paused && (ev.r.when.kind === 'weekly' && ev.r.when.days.length === 1 || (view === 'day' && (ev.r.when.kind === 'daily' || ev.r.when.kind === 'weekdays'))));
    return `<div class="cv-ev ${ev.kind}${ev.paused ? ' paused' : ''}${ev.skipped ? ' skipped' : ''}${ev.t?.error ? ' err' : ''}${ev.t?.team?.members?.length ? ' team' : ''}" data-ev="${id}" style="--chip:${chip}" title="${attr(ev.title)} · ${attr(a ? a.name : '')}${drag ? ' · arrastra para moverla' : ''}"${drag ? ' draggable="true"' : ''} role="button" tabindex="0">
      <div class="cv-ev-t">${ev.kind === 'routine' ? '<span class="cv-rt">⏱</span>' : ev.kind === 'done' ? '<span class="cv-tick">✓</span>' : ev.kind === 'sched' ? '<span class="cv-rt">◷</span>' : ev.t?.team?.members?.length ? '<span class="cv-rt">⚑</span>' : ''}${esc(ev.title)}</div>
      <div class="cv-ev-m"><span>${esc(time)}</span>${av(ev.agent)}</div></div>`;
  }
  function render() {
    if (dragging) return; // a re-render mid-drag would pull the card out from under the pointer
    const { from, to, days } = range();
    const by = events(from, to), today = ymd(new Date());
    const a = new Date(anchor);
    E.title.innerHTML = view === 'day' ? `${a.getDate()} ${MONTHS[a.getMonth()]} <small>${a.getFullYear()}</small>` : view === 'month' ? `${MONTHS[a.getMonth()]} <small>${a.getFullYear()}</small>` : (() => { const s = new Date(from), e = new Date(to - DAY); return `${s.getDate()}–${e.getDate()} ${s.getMonth() === e.getMonth() ? MONTHS[e.getMonth()] : MONTHS[s.getMonth()].slice(0, 3) + ' – ' + e.getDate() + ' ' + MONTHS[e.getMonth()]} <small>${e.getFullYear()}</small>`; })();
    E.seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
    E.dow.innerHTML = view === 'day' ? `<div class="cv-dayname">${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][a.getDay()]} ${a.getDate()} de ${MONTHS[a.getMonth()].toLowerCase()}</div>` : DOW.map(d => `<div>${d}</div>`).join('');
    E.grid.className = 'cv-grid ' + view; E.grid.style.setProperty('--rows', days / 7);
    let html = '', nDone = 0, nSched = 0, nRt = 0;
    for (let i = 0; i < days; i++) {
      const ts = from + i * DAY, d = new Date(ts), k = ymd(d), list = by[k] || [], dow = (d.getDay() + 6) % 7;
      const out = view === 'month' && d.getMonth() !== a.getMonth(), past = ts < startOfDay(Date.now()), max = view === 'month' && days > 35 ? 2 : MAX[view];
      for (const ev of list) { if (ev.kind === 'done') nDone++; else if (ev.kind === 'sched') nSched++; else if (ev.kind === 'routine') nRt++; }
      html += `<div class="cv-day${k === today ? ' today' : ''}${out ? ' out' : ''}${past ? ' past' : ''}${dow >= 5 ? ' wknd' : ''}" data-day="${k}">
        <button class="cv-add" type="button" title="Programar algo el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}" aria-label="Programar algo el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}">+</button>
        <div class="cv-evs">${list.slice(0, max).map(cardHTML).join('')}${list.length > max ? `<button class="cv-more" data-day="${k}">${list.length - max} más</button>` : ''}</div>
        <div class="cv-num">${view === 'week' ? `<span>${DOW[dow]}</span>` : ''}${d.getDate() === 1 && view === 'month' ? `<span>${MONTHS[d.getMonth()].slice(0, 3)}</span>` : ''}<b>${pad(d.getDate())}</b></div></div>`;
    }
    if (view === 'day') { // one day, by the hour: drag a card to an hour to change its time
      const k = ymd(new Date(from)), list = by[k] || [], past = from < startOfDay(Date.now());
      const nowH = new Date().getHours();
      let rows = '';
      for (let h = HOURS[0]; h <= HOURS[1]; h++) {
        const inHour = list.filter(ev => new Date(ev.at).getHours() === h || (h === HOURS[0] && new Date(ev.at).getHours() < h) || (h === HOURS[1] && new Date(ev.at).getHours() > h));
        rows += `<div class="cv-hour cv-day${past || (k === today && h < nowH) ? ' past' : ''}${k === today && h === nowH ? ' now' : ''}" data-day="${k}" data-hour="${h}"><div class="cv-h">${pad(h)}:00</div><div class="cv-evs">${inHour.map(cardHTML).join('')}</div></div>`;
      }
      html = rows; nDone = list.filter(e => e.kind === 'done').length; nSched = list.filter(e => e.kind === 'sched').length; nRt = list.filter(e => e.kind === 'routine').length;
      E.grid.className = 'cv-grid day';
    }
    E.grid.innerHTML = html;
    E.stats.innerHTML = `<span><b>${nRt}</b> rutina ${nRt === 1 ? 'ejecución' : 'ejecuciones'}</span><span><b>${nSched}</b> programadas</span><span><b>${nDone}</b> listas</span>`;
    renderRail(); renderChips();
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
    const list = routines.slice().sort((x, y) => (x.paused ? Infinity : x.nextAt || Infinity) - (y.paused ? Infinity : y.nextAt || Infinity));
    E.railN.textContent = list.length;
    E.rail.innerHTML = list.length ? list.map(r => { const a = agentOf(r.agent), chip = DEPTS[r.dept].chip; return `<div class="cv-r${r.paused ? ' paused' : ''}${onlyRoutine === r.id ? ' on' : ''}" data-rid="${r.id}" style="--chip:${chip}">
        <div class="cv-r-t">${esc(r.title)}</div>
        <div class="cv-r-m">${esc(r.desc || describe(r.when))} · ${esc(a ? a.name : r.agent)}</div>
        <div class="cv-r-n">${r.paused ? '<span class="cv-paused">PAUSADA</span>' : `próxima ${esc(untilText(r.nextAt))}`}${r.needsOk ? ' · en espera de tu visto bueno' : ''}</div></div>`; }).join('')
      : `<div class="cv-empty">Sin rutinas todavía.<br>Haz clic en un día, escribe lo que debe pasar, activa REPETIR.</div>`;
  }
  function renderChips() {
    E.chips.innerHTML = DEPT_KEYS.map(k => `<button class="cv-chip${deptOn.has(k) ? ' on' : ''}" data-dept="${k}"><i style="background:${DEPTS[k].chip}"></i>${DEPTS[k].short}</button>`).join('') +
      `<span class="cv-sep"></span><button class="cv-chip${showRoutines ? ' on' : ''}" data-tog="routines"><i class="rt">⏱</i>RUTINAS</button><button class="cv-chip${showDone ? ' on' : ''}" data-tog="done"><i class="tick">✓</i>LISTAS</button>` +
      (onlyRoutine ? `<button class="cv-chip only on" data-tog="only">SOLO ESTA RUTINA ✕</button>` : '');
  }

  /* ---------- the popovers: a day (create), an event (details), "n more" (the whole day) ---------- */
  function place(el, anchorEl) { // beside the cell, kept on screen
    const r = anchorEl.getBoundingClientRect(), W = el.offsetWidth || 360, H = el.offsetHeight || 300;
    let x = r.right + 10, y = r.top; if (x + W > innerWidth - 12) x = r.left - W - 10; if (x < 12) x = Math.max(12, Math.min(innerWidth - W - 12, r.left));
    if (y + H > innerHeight - 12) y = Math.max(12, innerHeight - H - 12);
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  function closePop() { E.pop.hidden = true; E.pop.innerHTML = ''; popKind = null; ov.querySelectorAll('.cv-day.sel').forEach(n => n.classList.remove('sel')); }
  function openCreate(dayKey, cell) {
    closePop(); popKind = 'create'; cell.classList.add('sel');
    if (currentDept && DEPT_KEYS.includes(currentDept())) lastDept = currentDept(); // the popover opens on the bar's department
    const d = new Date(dayKey + 'T00:00:00'), past = d.getTime() < startOfDay(Date.now());
    E.pop.innerHTML = `<div class="cv-pop-h"><span class="lab">PROGRAMAR PARA</span><b>${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}</b><span class="sp"></span><button class="cv-x" data-act="close">✕</button></div>
      ${past ? '<div class="cv-note">Ese día ya pasó — elige hoy o un día posterior.</div>' : ''}
      <div class="cv-row"><select class="cv-dept">${DEPT_KEYS.map(k => `<option value="${k}"${k === lastDept ? ' selected' : ''}>${DEPTS[k].name}</option>`).join('')}</select><input type="time" class="cv-time" value="${dayKey === ymd(new Date()) ? pad(Math.min(23, new Date().getHours() + 1)) + ':00' : '09:00'}"><select class="cv-model" title="which model runs it"><option value="">${esc(modelName(officeModel()).toUpperCase())}</option>${MODEL_KEYS.filter(k => k !== officeModel()).map(k => `<option value="${k}">${esc(modelName(k).toUpperCase())}</option>`).join('')}</select></div>
      <textarea class="cv-text" rows="3" placeholder="¿Qué debe pasar ese día?"></textarea>
      <div class="cv-row"><button class="cv-rep" data-act="rep">REPETIR</button><select class="cv-cad" hidden>${CADENCES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select><label class="cv-ok" hidden><input type="checkbox" class="cv-okc" checked> necesita mi visto bueno</label><span class="sp"></span><button class="cv-go" data-act="go"${past ? ' disabled' : ''}>AGREGAR</button></div>
      <div class="cv-hint">${past ? '' : 'Una tarea para este día — se ejecuta a esa hora y aparece en el panel. REPETIR la convierte en rutina desde esta fecha.'}</div>`;
    E.pop.hidden = false; place(E.pop, cell);
    const P = { dept: E.pop.querySelector('.cv-dept'), time: E.pop.querySelector('.cv-time'), model: E.pop.querySelector('.cv-model'), text: E.pop.querySelector('.cv-text'), rep: E.pop.querySelector('.cv-rep'), cad: E.pop.querySelector('.cv-cad'), ok: E.pop.querySelector('.cv-ok'), okc: E.pop.querySelector('.cv-okc'), go: E.pop.querySelector('.cv-go'), hint: E.pop.querySelector('.cv-hint') };
    let repeat = false;
    const hint = () => {
      if (past) return;
      const k = P.dept.value; lastDept = k;
      if (repeat) { const w = fromPicker(P.cad.value, P.time.value, dayKey); const first = occurrences(w, Date.now(), Date.now() + 400 * DAY, 1)[0]; P.hint.innerHTML = RT_DEPTS.includes(k) ? `Rutina · <b>${esc(describe(w))}</b> · primera ejecución ${esc(first ? new Date(first).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + hm(first) : '—')}${isLive() ? ' · Claude elige al agente' : ''}` : `<span class="amber">${esc(rtRefuse(k))}</span>`; P.go.disabled = !RT_DEPTS.includes(k); }
      else { P.hint.innerHTML = `Tarea para <b>${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} · ${esc(P.time.value)}</b>${isLive() ? ' · Claude elige al agente ahora, la ejecuta después' : ''}`; P.go.disabled = false; }
    };
    P.rep.addEventListener('click', () => { repeat = !repeat; P.rep.classList.toggle('on', repeat); P.cad.hidden = !repeat; P.ok.hidden = !repeat; if (repeat) { const dow = (d.getDay() + 6) % 7; P.cad.value = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][dow]; } hint(); });
    [P.dept, P.time, P.cad, P.model].forEach(el => { el.addEventListener('change', hint); el.addEventListener('keydown', e => e.stopPropagation()); });
    P.text.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } else if (e.key === 'Escape') closePop(); });
    P.go.addEventListener('click', go);
    hint(); P.text.focus();
    async function go() {
      const text = P.text.value.trim().replace(/[.!]+$/, ''); if (!text) { P.text.focus(); return; }
      const k = P.dept.value, model = P.model.value || undefined;
      P.go.disabled = true; P.hint.innerHTML = isLive() ? 'Claude está eligiendo al agente…' : 'Agregando…';
      let r;
      if (repeat) r = await createRoutine({ dept: k, text, when: fromPicker(P.cad.value, P.time.value, dayKey), needsOk: P.okc.checked, model });
      else r = await create({ dept: k, text, at: new Date(`${dayKey}T${P.time.value || '09:00'}:00`).getTime(), model });
      if (!r || !r.ok) { P.hint.innerHTML = `<span class="amber">${esc((r && r.error) || 'No se pudo agregar.')}</span>`; P.go.disabled = false; return; }
      closePop(); render();
      const el = E.grid.querySelector(`.cv-ev[data-ev="${repeat ? 'r:' + r.routine.id + ':' : 't:' + r.task.id}"], .cv-ev[data-ev^="${repeat ? 'r:' + r.routine.id + ':' : 't:' + r.task.id}"]`);
      if (el) { el.classList.add('new'); el.scrollIntoView({ block: 'nearest' }); }
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
        <div class="cv-row"><input type="date" class="cv-date" value="${ymd(due)}" min="${ymd(new Date())}" aria-label="Día"><input type="time" class="cv-time" value="${hm(due)}" aria-label="Hora"><select class="cv-model" aria-label="Modelo"><option value="">${esc(modelName(officeModel()).toUpperCase())}</option>${MODEL_KEYS.filter(k => k !== officeModel()).map(k => `<option value="${k}"${t.model === k ? ' selected' : ''}>${esc(modelName(k).toUpperCase())}</option>`).join('')}</select></div>`
        : (t.text && t.text !== t.title ? `<div class="cv-pop-p">${esc(t.text)}</div>` : '')}
        <div class="cv-row">${edit ? '<button class="cv-go" type="button" data-act="save">GUARDAR</button>' : ''}<button class="cv-btn" type="button" data-act="open">ABRIR EL AGENTE</button><span class="sp"></span>${edit ? '<button class="cv-btn warn" type="button" data-act="cancel">CANCELARLA</button>' : ''}</div>
        <div class="cv-hint" aria-live="polite">${edit ? 'Cambia el texto, el día o la hora. También puedes arrastrar la tarjeta a otro día.' : ''}</div>`;
      E.pop.hidden = false; place(E.pop, el);
      E.pop.querySelectorAll('textarea, input, select').forEach(x => x.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closePop(); }));
      E.pop.querySelector('[data-act="open"]').addEventListener('click', () => { close(); openAgent(t.agent, 'chat'); });
      E.pop.querySelector('[data-act="cancel"]')?.addEventListener('click', async e => {
        if (!confirm(`¿Cancelar «${t.title}»? No se ejecutará.`)) return;
        e.currentTarget.disabled = true; const r = await cancelTask(t);
        if (r && r.ok === false) { say('No se pudo cancelar: ' + r.error, true); e.currentTarget.disabled = false; return; }
        closePop(); render();
      });
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
      <input class="cv-title" value="${attr(r.title)}" aria-label="Título de la rutina" maxlength="90">
      <div class="cv-pop-m">${av(r.agent)} ${esc(a ? a.name : r.agent)} · ${esc(r.desc || describe(r.when))}${r.paused ? ' · <span class="cv-paused">PAUSADA</span>' : ''}</div>
      <div class="cv-pop-p">Esta ejecución: ${esc(new Date(at).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}${r.nextAt ? ` · próxima ${esc(untilText(r.nextAt))}` : ''}${r.lastAt ? ` · última vez ${esc(new Date(r.lastAt).toLocaleDateString([], { day: 'numeric', month: 'short' }))}` : ''}</div>
      <label class="cv-lab">Qué debe pasar</label><textarea class="cv-text" rows="3">${esc(r.text || r.title)}</textarea>
      <div class="cv-row"><select class="cv-cad" aria-label="Cada cuándo">${pk.custom ? `<option value="custom" selected>${esc(r.desc || describe(r.when))}</option>` : ''}${CADENCES.map(([v, l]) => `<option value="${v}"${v === pk.cadence ? ' selected' : ''}>${l}</option>`).join('')}</select><input type="time" class="cv-time" value="${pk.at}" aria-label="Hora"${pk.cadence === 'hourly' ? ' disabled' : ''}>
        <label class="cv-ok"><input type="checkbox" class="cv-okc"${r.needsOk ? ' checked' : ''}> necesita mi visto bueno</label></div>
      <div class="cv-row"><button class="cv-go" type="button" data-act="save">GUARDAR</button><button class="cv-btn" type="button" data-act="run">EJECUTAR AHORA</button><button class="cv-btn" type="button" data-act="${r.paused ? 'resume' : 'pause'}">${r.paused ? 'REANUDAR' : 'PAUSAR'}</button><button class="cv-btn" type="button" data-act="${(r.skips || []).includes(at) ? 'unskip' : 'skip'}">${(r.skips || []).includes(at) ? 'NO SALTAR' : 'SALTAR ESTA'}</button><button class="cv-btn" type="button" data-act="only">SOLO ESTA</button><span class="sp"></span><button class="cv-btn warn" type="button" data-act="delete">ELIMINAR</button></div>
      <div class="cv-hint" aria-live="polite">${r.needsOk ? 'Lo que haya que enviar espera tu visto bueno.' : 'Solo lee y reporta: no te espera.'}</div>`;
    E.pop.hidden = false; place(E.pop, el);
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
      if (act === 'delete' && !confirm(`¿Eliminar la rutina «${r.title}»? Sale del horario para siempre.`)) return;
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
      const old = new Date(t.dueAt); target.setHours(hour ?? old.getHours(), hour !== null ? 0 : old.getMinutes(), 0, 0);
      if (target.getTime() === t.dueAt) { render(); return; }
      if (target.getTime() <= Date.now()) { render(); E.stats.innerHTML = `<span class="amber">A esa hora ya pasó hoy — abre la tarea y elige otra hora.</span>`; return; }
      E.stats.innerHTML = '<span>Moviendo…</span>';
      const r = await updateTask(t, { at: target.getTime() });
      render();
      if (!r || !r.ok) E.stats.innerHTML = `<span class="amber">No se pudo mover: ${esc((r && r.error) || 'error')}</span>`; else flash('t:' + t.id);
      return;
    }
    const r = routines.find(x => x.id === d.id); if (!r) { render(); return; }
    if (hour !== null && r.when.at) { // day view: a routine dropped on another hour runs at that hour from now on
      const at = `${pad(hour)}:${r.when.at.slice(3)}`;
      if (at === r.when.at) { render(); return; }
      if (!confirm(`¿Cambiar «${r.title}» a las ${at}? Cambia todas sus ejecuciones.`)) { render(); return; }
      const res = await updateRoutine(r.id, { when: { ...r.when, at } }); render();
      if (!res || !res.ok) E.stats.innerHTML = `<span class="amber">No se pudo mover: ${esc((res && res.error) || 'error')}</span>`;
      return;
    }
    if (r.when.kind !== 'weekly') { render(); return; }
    const from = new Date(d.at).getDay(), to = target.getDay();
    if (from === to) { render(); return; }
    const names = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    if (!confirm(`¿Mover «${r.title}» de los ${names[from]} a los ${names[to]}? Cambia todas sus ejecuciones.`)) { render(); return; }
    const res = await updateRoutine(r.id, { when: { ...r.when, days: r.when.days.map(x => x === from ? to : x) } });
    render();
    if (!res || !res.ok) E.stats.innerHTML = `<span class="amber">No se pudo mover: ${esc((res && res.error) || 'error')}</span>`;
  });
  ov.addEventListener('keydown', e => { // a card opens with Enter too
    const card = e.target.closest && e.target.closest('.cv-ev'); if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); openEvent(card.dataset.ev, card); }
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
  function step(n) { const d = new Date(anchor); if (view === 'day') d.setDate(d.getDate() + n); else if (view === 'week') d.setDate(d.getDate() + 7 * n); else { d.setDate(1); d.setMonth(d.getMonth() + n); } anchor = d.getTime(); closePop(); render(); }
  ov.addEventListener('keydown', e => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); else if (e.key === 't' || e.key === 'T') { anchor = startOfDay(Date.now()); render(); } else if (e.key === 'w' || e.key === 'W') { view = 'week'; render(); } else if (e.key === 'm' || e.key === 'M') { view = 'month'; render(); } else if (e.key === 'd' || e.key === 'D') { view = 'day'; render(); } });
  ov.addEventListener('dblclick', e => { const day = e.target.closest('.cv-day[data-day]'); if (!day || view === 'day' || e.target.closest('.cv-ev')) return; anchor = new Date(day.dataset.day + 'T00:00:00').getTime(); view = 'day'; closePop(); render(); });

  let timer = null;
  let calOpener = null;
  ov.inert = true; // closed: out of Tab's reach
  function open() { if (openNow) return; openNow = true; calOpener = document.activeElement; ov.inert = false; E.co.textContent = business ? business() : ''; ov.classList.add('on'); document.body.classList.add('calOpen'); render(); ov.tabIndex = -1; ov.focus(); timer = setInterval(() => { if (E.pop.hidden && !dragging) render(); }, 30000); }
  function close() { if (!openNow) return; openNow = false; closePop(); ov.inert = true; ov.classList.remove('on'); document.body.classList.remove('calOpen'); clearInterval(timer); timer = null; if (calOpener && document.contains(calOpener) && calOpener.focus) calOpener.focus({ preventScroll: true }); } // focus goes back where it came from
  function toggle() { openNow ? close() : open(); }
  function openAt(ts) { anchor = startOfDay(ts || Date.now()); if (view === 'month' && ts) view = 'week'; if (openNow) { closePop(); render(); } else open(); setTimeout(() => { const el = E.grid.querySelector(`.cv-day[data-day="${ymd(new Date(anchor))}"]`); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); } }, 60); }
  return { open, openAt, close, toggle, isOpen: () => openNow, refresh: () => { if (openNow && E.pop.hidden && !dragging) render(); }, popOpen: () => !E.pop.hidden, closePop, get view() { return view; }, set view(v) { view = v; render(); } };
}
