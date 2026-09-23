// Agents Office — the TASK DETAIL drawer: one place for everything about a task, opened from the task list, the
// company board and the calendar. It shows what was asked, who has it, its history and its deliverable, and the
// actions that make sense in its state:
//   pending    → edit the words · reassign to another desk · give it a date · mark done by hand · delete
//   scheduled  → edit · move the date · run now (unschedule) · delete
//   running    → stop (the agent's process is killed)
//   waiting    → approve · send back with a note · read the draft
//   done       → repeat · open the chat · open its note in the Brain · archive · delete (optionally with its note)
//
//   initDetail(ctx) → { open(t), close(), refresh(), isOpen(), current() }
//   ctx: agentOf · AGENTS · DEPTS · DEPT_KEYS · esc · isLive() · act(t, name, payload) → Promise<{ ok, error }>
//        openAgent(id) · openNote(name) → bool · openCalendar(ts) · modelName · MODEL_KEYS · officeModel()
import { mdToHtml } from './md.js';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const when = ts => ts ? new Date(ts).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const STATE = { next: ['PENDIENTE', 'next'], scheduled: ['PROGRAMADA', 'sched'], doing: ['EN CURSO', 'doing'], waiting: ['ESPERA TU VISTO BUENO', 'waiting'], done: ['LISTA', 'done'] };
const BY = { you: 'ti', sub: 'el Subgerente', routine: 'una rutina', team: 'el líder (equipo)' };

export function initDetail(ctx) {
  const { agentOf, AGENTS, DEPTS, DEPT_KEYS, esc, isLive, act, openAgent, openNote, openCalendar, modelName, MODEL_KEYS, officeModel } = ctx;
  const el = document.createElement('aside'); el.id = 'tdDrawer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'false'); el.setAttribute('aria-label', 'Detalle de la tarea'); el.hidden = true;
  document.body.appendChild(el);
  let cur = null, busy = false, opener = null;

  function agentOptions(sel, onlyLeads) {
    return DEPT_KEYS.map(k => `<optgroup label="${esc(DEPTS[k].name)}">${AGENTS.filter(a => a.dept === k && (!onlyLeads || a.lead)).map(a => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${esc(a.name)}${a.lead ? ' ★' : ''}</option>`).join('')}</optgroup>`).join('');
  }
  function history(t) {
    const rows = [];
    rows.push(['Creada', when(t.addedAt), t.by ? `por ${BY[t.by] || t.by}` : '']);
    if (t.dueAt) rows.push([t.state === 'scheduled' ? 'Se ejecuta' : 'Programada para', when(t.dueAt), t.late ? 'se atrasó' : '']);
    if (t.state === 'waiting' && t.draftAt) rows.push(['Borrador listo', when(t.draftAt), 'espera tu visto bueno']);
    if (t.doneAt) rows.push([t.error ? 'Terminó con error' : 'Terminada', when(t.doneAt), t.approved ? 'enviada tras tu visto bueno' : t.manual ? 'marcada a mano' : '']);
    return `<ol class="td-hist">${rows.map(([a, b, c]) => `<li><b>${esc(a)}</b> ${esc(b)}${c ? ` · <span>${esc(c)}</span>` : ''}</li>`).join('')}</ol>`;
  }
  function render() {
    const t = cur; if (!t) return;
    const a = agentOf(t.agent), d = DEPTS[t.dept];
    const [label, cls] = STATE[t.state] || [t.state, ''];
    const editable = (t.state === 'next' || t.state === 'scheduled') && !t.piece && !(t.routine && t.state === 'next');
    const live = isLive() && t.live;
    const due = t.dueAt ? new Date(t.dueAt) : null;
    const result = t.state === 'waiting' ? (t.draft || t.result) : t.result;
    el.innerHTML = `
      <div class="td-head"><span class="td-st ${cls}">${label}</span><span class="sp"></span><button type="button" class="td-x" data-a="close" aria-label="Cerrar">✕</button></div>
      <h2 class="td-title">${t.routine ? '⏱ ' : ''}${t.team?.members?.length || t.team ? '⚑ ' : ''}${esc(t.title)}</h2>
      <div class="td-who"><span class="td-dot" style="background:${d.chip}"></span>${esc(d.name)} · ${esc(a ? a.name : t.agent)}${t.team ? ' · en equipo' : ''}${t.modelUsed ? ' · ' + esc(modelName(t.modelUsed)) : ''}${t.piece ? ' · pieza del equipo' : ''}</div>
      ${history(t)}
      ${editable ? `
        <label class="td-lab" for="tdText">Qué se pidió</label>
        <textarea id="tdText" class="td-text" rows="4">${esc(t.text || t.title)}</textarea>
        <div class="td-grid">
          <label class="td-lab">Asignada a<select class="td-agent">${agentOptions(t.agent, !!t.team)}</select></label>
          <label class="td-lab">Día<input type="date" class="td-date" value="${due ? ymd(due) : ''}" min="${ymd(new Date())}"></label>
          <label class="td-lab">Hora<input type="time" class="td-time" value="${due ? hm(due) : '09:00'}"></label>
          <label class="td-lab">Modelo<select class="td-model"><option value="">${esc(modelName(officeModel()))} (oficina)</option>${MODEL_KEYS.map(k => `<option value="${k}"${t.model === k ? ' selected' : ''}>${esc(modelName(k))}</option>`).join('')}</select></label>
        </div>
        <p class="td-note">${t.state === 'scheduled' ? 'Cambia el día o la hora para moverla. «Ejecutar ahora» la pasa a pendientes.' : 'Pon un día para programarla; sin día, el agente la toma en cuanto se libere.'}${live ? ' Si cambias el texto, el líder vuelve a elegir el escritorio (salvo que elijas uno tú).' : ''}</p>`
      : t.text && t.text !== t.title ? `<label class="td-lab">Qué se pidió</label><div class="td-ask">${esc(t.text)}</div>` : ''}
      ${t.team?.members?.length ? `<label class="td-lab">Equipo</label><div class="td-ask">${esc([t.team.lead, ...t.team.members].map(id => agentOf(id)?.name || id).join(' · '))}${t.team.why ? ' — ' + esc(t.team.why) : ''}</div>` : ''}
      ${result ? `<label class="td-lab">${t.state === 'waiting' ? 'Borrador para tu visto bueno' : t.error ? 'Qué pasó' : 'Entregable'}</label><div class="td-res md${t.error ? ' err' : ''}">${mdToHtml(result)}</div>` : ''}
      ${t.state === 'waiting' ? `<label class="td-lab" for="tdFb">Si lo devuelves, ¿qué debe cambiar?</label><textarea id="tdFb" class="td-text" rows="2" placeholder="Ej.: más corto, sin el segundo párrafo, con el precio de Launch"></textarea>` : ''}
      <div class="td-acts">${actions(t, editable, live)}</div>
      ${t.state === 'done' ? `<label class="td-chk"><input type="checkbox" class="td-withnote"${t.note ? '' : ' disabled'}> también mover su nota del Cerebro a la papelera</label>` : ''}
      <div class="td-msg" aria-live="polite"></div>`;
  }
  function actions(t, editable, live) {
    const b = (a, txt, cls = '') => `<button type="button" class="td-btn ${cls}" data-a="${a}">${txt}</button>`;
    const out = [];
    if (editable) out.push(b('save', 'Guardar cambios', 'pri'));
    if (t.state === 'scheduled') out.push(b('unschedule', 'Ejecutar ahora'));
    if (editable) out.push(b('done', 'Marcar como hecha'));
    if (t.state === 'doing') out.push(b('stop', 'Detener al agente', 'warn'));
    if (t.state === 'waiting') { out.push(b('approve', 'Aprobar y enviar', 'pri')); out.push(b('reject', 'Devolver con la nota')); }
    if (t.state === 'done' && !t.piece) out.push(b('repeat', t.error ? 'Reintentar' : 'Repetir', t.error ? 'pri' : ''));
    out.push(b('chat', 'Abrir el chat del agente'));
    if (t.note && openNote) out.push(b('note', 'Ver su nota en el Cerebro'));
    if (t.dueAt && openCalendar) out.push(b('cal', 'Verla en el calendario'));
    out.push('<span class="sp"></span>');
    if (t.state === 'done' && !t.piece) out.push(b('archive', 'Archivar'));
    if (t.state !== 'doing' && !t.piece) out.push(b('delete', 'Eliminar', 'warn'));
    return out.join('');
  }
  const msg = (text, bad) => { const m = el.querySelector('.td-msg'); if (m) { m.textContent = text; m.className = 'td-msg' + (bad ? ' bad' : ''); } };
  async function run(name, payload, okText) {
    if (busy) return; busy = true;
    el.querySelectorAll('.td-btn').forEach(x => { x.disabled = true; });
    msg('Un momento…');
    const r = await act(cur, name, payload);
    busy = false;
    if (!r || !r.ok) { el.querySelectorAll('.td-btn').forEach(x => { x.disabled = false; }); msg((r && r.error) || 'No se pudo.', true); return false; }
    if (r.gone) { close(); return true; }
    render(); msg(okText || 'Hecho.'); return true;
  }
  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-a]'); if (!btn || !cur) return;
    const t = cur, a = btn.dataset.a;
    if (a === 'close') return close();
    if (a === 'chat') { close(); openAgent(t.agent); return; }
    if (a === 'note') { if (!openNote(t.note)) msg('Esa nota ya no está en el Cerebro.', true); return; }
    if (a === 'cal') { close(); openCalendar(t.dueAt); return; }
    if (a === 'save') {
      const text = el.querySelector('#tdText').value.trim(); if (!text) { el.querySelector('#tdText').focus(); return; }
      const agent = el.querySelector('.td-agent').value, date = el.querySelector('.td-date').value, time = el.querySelector('.td-time').value || '09:00', model = el.querySelector('.td-model').value;
      const p = {};
      if (text !== (t.text || t.title)) p.text = text;
      if (agent !== t.agent) p.agent = agent;
      if ((model || '') !== (t.model || '')) p.model = model;
      if (date) { const at = new Date(`${date}T${time}:00`).getTime(); if (at !== t.dueAt) { if (!(at > Date.now())) return msg('Esa hora ya pasó — elige una que aún esté por venir.', true); p.at = at; } }
      else if (t.state === 'scheduled') p.at = null;
      if (!Object.keys(p).length) return msg('No hay cambios.');
      return run('save', p, p.text && !p.agent && isLive() ? 'Guardado. El líder volvió a elegir el escritorio.' : 'Guardado.');
    }
    if (a === 'unschedule') return run('unschedule', {}, 'Pasó a pendientes: el agente la toma en cuanto se libere.');
    if (a === 'done') { if (!confirm(`¿Marcar «${t.title}» como hecha sin ejecutarla?`)) return; return run('done', {}, 'Marcada como hecha.'); }
    if (a === 'stop') { if (!confirm(`¿Detener a ${agentOf(t.agent)?.name || 'este agente'}? Lo que llevaba hecho se pierde.`)) return; return run('stop', {}, 'Detenido.'); }
    if (a === 'approve') return run('approve', {}, 'Aprobado: el agente lo está enviando.');
    if (a === 'reject') { const fb = el.querySelector('#tdFb').value.trim(); if (!fb) { el.querySelector('#tdFb').focus(); return msg('Escribe qué debe cambiar.', true); } return run('reject', { feedback: fb }, 'Devuelto: lo rehace con tu nota.'); }
    if (a === 'repeat') return run('repeat', {}, 'Listo: es una tarea nueva en pendientes.');
    if (a === 'archive') { const note = el.querySelector('.td-withnote')?.checked; return run('archive', { note }, 'Archivada.'); }
    if (a === 'delete') { const note = el.querySelector('.td-withnote')?.checked; if (!confirm(`¿Eliminar «${t.title}»${note ? ' y su nota del Cerebro' : ''}? No se puede deshacer${note ? ' (la nota va a la papelera)' : ''}.`)) return; return run('delete', { note }, 'Eliminada.'); }
  });
  el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
  function open(t) { if (!t) return; if (!cur) opener = document.activeElement; cur = t; el.hidden = false; render(); requestAnimationFrame(() => el.classList.add('on')); el.querySelector('.td-x').focus({ preventScroll: true }); }
  function close() { if (!cur) return; cur = null; el.classList.remove('on'); setTimeout(() => { if (!cur) el.hidden = true; }, 250); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  // the task changed underneath (a poll, the run finished): redraw, unless the owner is typing in it
  function refresh() { if (!cur || busy) return; if (el.contains(document.activeElement) && /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement.tagName)) return; render(); }
  return { open, close, refresh, isOpen: () => !!cur, current: () => cur };
}
