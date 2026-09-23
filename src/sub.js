// Agents Office — the SUBGERENTE's chat (the page side of sub.mjs). A drawer on the left, above the whole office:
// the owner writes what needs doing, the Subgerente answers with a distribution plan as editable cards (department,
// instructions for the lead, include or skip, a date, the whole team or one desk), and SEND hands each piece to its
// department. Sent pieces follow their task live: pending, running, waiting for the OK, done — a click opens it.
//
//   initSub(ctx) → { open, close, toggle, isOpen }
//   ctx: isLive() · esc · DEPTS · DEPT_KEYS · findBySid(id) · openTask(t) · afterSend() (poll the office now)
import { mdToHtml } from './md.js';

const STATE = { next: 'pendiente', doing: 'en curso', waiting: 'espera tu visto bueno', done: 'lista', scheduled: 'programada' };
const when = ts => new Date(ts).toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function initSub(ctx) {
  const { isLive, esc, DEPTS, DEPT_KEYS, findBySid, openTask, afterSend } = ctx;
  const el = document.createElement('aside'); el.id = 'subOv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Chat con el Subgerente'); el.hidden = true;
  el.innerHTML = `<div class="sb-head"><div><div class="sb-name">◆ SUBGERENTE</div><div class="sb-sub">Escríbeme todo lo que hay que hacer. Yo lo reparto entre los jefes de departamento; nada sale sin tu OK.</div></div>
      <span class="sp"></span><button type="button" class="sb-clear" title="Borrar la conversación">Nueva conversación</button><button type="button" class="sb-x" aria-label="Cerrar">✕</button></div>
    <div class="sb-msgs" aria-live="polite"></div>
    <div class="sb-chips"><button type="button" data-q="¿Cómo vamos? Dame el estado de la oficina.">¿Cómo vamos?</button><button type="button" data-q="¿Qué está esperando mi visto bueno?">¿Qué espera mi OK?</button><button type="button" data-q="¿Qué falló hoy y qué hago?">¿Qué falló?</button></div>
    <div class="sb-in"><textarea rows="2" placeholder="Ej.: prepara la propuesta para la panadería Sol, el viernes a las 10 publica el post del blog y revisa qué cobros están pendientes" aria-label="Mensaje al Subgerente (Enter envía, Shift+Enter salto de línea)"></textarea><button type="button" class="sb-send">ENVIAR</button></div>`;
  document.body.appendChild(el);
  const $ = s => el.querySelector(s);
  const box = $('.sb-msgs'), input = $('.sb-in textarea'), sendBtn = $('.sb-send');
  let messages = [], loaded = false, busy = false, timer = null, opener = null;
  const drafts = new Map(); // msg id → the owner's edits to a plan before SEND: i → { include, dept, instruction, team, at }

  function planHTML(m) {
    const p = m.plan; if (!p) return '';
    const open = p.tasks.some(t => t.state === 'proposed');
    const ed = drafts.get(m.id) || new Map();
    const items = p.tasks.map(t => {
      const e = ed.get(t.i) || {};
      const dept = e.dept || t.dept, include = e.include !== false, team = e.team ?? t.team;
      if (t.state === 'proposed') return `<div class="sb-item${include ? '' : ' off'}" data-msg="${m.id}" data-i="${t.i}">
          <label class="sb-inc"><input type="checkbox" class="sb-on"${include ? ' checked' : ''} aria-label="Incluir esta tarea"></label>
          <div class="sb-body">
            <div class="sb-t">${esc(t.title)}</div>
            <div class="sb-row"><select class="sb-dept" aria-label="Departamento">${DEPT_KEYS.map(k => `<option value="${k}"${k === dept ? ' selected' : ''}>${esc(DEPTS[k].name)}</option>`).join('')}</select>
              <label class="sb-team"><input type="checkbox" class="sb-teamc"${team ? ' checked' : ''}> todo el equipo</label>
              ${t.at ? `<span class="sb-at">◷ ${esc(when(t.at))}</span>` : '<span class="sb-at now">ya</span>'}</div>
            ${t.ownerSaid ? `<div class="sb-moved">La moví de ${esc(DEPTS[t.ownerSaid].name)} a ${esc(DEPTS[t.dept].name)}.</div>` : ''}
            ${t.why ? `<div class="sb-why">${esc(t.why)}</div>` : ''}
            <details class="sb-det"><summary>Instrucciones para el jefe</summary><textarea class="sb-ins" rows="4">${esc(e.instruction ?? t.instruction)}</textarea></details>
          </div></div>`;
      const task = t.taskId ? findBySid(t.taskId) : null;
      const st = task ? (task.state === 'done' && task.error ? 'con error' : STATE[task.state] || task.state) : t.state === 'sent' ? 'enviada' : t.state === 'skipped' ? 'descartada' : t.state === 'failed' ? 'no se pudo enviar' : '';
      return `<div class="sb-item sent ${t.state}${task ? ' st-' + task.state + (task.error ? ' err' : '') : ''}"${task ? ` data-sid="${esc(t.taskId)}" role="button" tabindex="0"` : ''}>
          <span class="sb-dot" style="background:${DEPTS[t.dept].chip}"></span>
          <div class="sb-body"><div class="sb-t">${esc(t.title)}</div><div class="sb-meta">${esc(DEPTS[t.dept].name)}${task ? ' · ' + esc(ctx.agentName(task.agent)) : ''} · <b>${esc(st)}</b>${t.error ? ' — ' + esc(t.error) : ''}</div></div></div>`;
    }).join('');
    const n = p.tasks.filter(t => t.state === 'proposed' && (ed.get(t.i)?.include !== false)).length;
    return `<div class="sb-plan">${items}${p.questions?.length ? `<div class="sb-q">${p.questions.map(q => `<div>¿${esc(q.replace(/^¿|\?$/g, ''))}?</div>`).join('')}</div>` : ''}
      ${open ? `<div class="sb-acts"><button type="button" class="sb-go" data-msg="${m.id}"${n ? '' : ' disabled'}>ENVIAR A LOS JEFES (${n})</button><button type="button" class="sb-skip" data-msg="${m.id}">Descartar el plan</button></div>` : ''}</div>`;
  }
  function render(stick) {
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = !isLive() ? '<div class="sb-empty">El Subgerente trabaja con la oficina real: abre la oficina desde el iniciador (.bat).</div>'
      : !messages.length ? '<div class="sb-empty">Cuéntame qué hay que hacer — una cosa o diez, como te salgan. Te propongo a qué departamento va cada una y con qué instrucciones, y tú decides.</div>'
      : messages.map(m => m.who === 'user' ? `<div class="sb-u">${esc(m.text)}</div>` : `<div class="sb-a"><div class="md">${mdToHtml(m.text)}</div>${planHTML(m)}</div>`).join('') + (busy ? '<div class="sb-busy">El Subgerente está repartiendo…</div>' : '');
    if (stick || atBottom) box.scrollTop = box.scrollHeight;
  }
  async function load() {
    try { const j = await (await fetch('/api/sub')).json(); messages = j.messages || []; loaded = true; } catch { messages = []; }
    render(true);
  }
  async function send(text) {
    text = String(text || '').trim(); if (!text || busy || !isLive()) return;
    busy = true; input.value = ''; sendBtn.disabled = true;
    messages.push({ id: 'tmp', who: 'user', text }); render(true);
    try {
      const r = await fetch('/api/sub/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      messages = messages.filter(m => m.id !== 'tmp').concat(j.messages);
    } catch (e) { messages = messages.filter(m => m.id !== 'tmp'); messages.push({ id: 'err' + Date.now(), who: 'sub', text: `No pude pensar eso ahora (${e.message}). Tu mensaje: «${text}»` }); input.value = text; }
    busy = false; sendBtn.disabled = false; render(true); input.focus();
  }
  function edit(msgId, i) { if (!drafts.has(msgId)) drafts.set(msgId, new Map()); const d = drafts.get(msgId); if (!d.has(i)) d.set(i, {}); return d.get(i); }
  async function dispatch(msgId, btn) {
    const m = messages.find(x => x.id === msgId); if (!m || !m.plan) return;
    const ed = drafts.get(msgId) || new Map();
    const items = m.plan.tasks.filter(t => t.state === 'proposed').map(t => ({ i: t.i, ...ed.get(t.i) }));
    btn.disabled = true; btn.textContent = 'Enviando a los jefes…';
    try {
      const r = await fetch('/api/sub/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ msg: msgId, items }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      const k = messages.findIndex(x => x.id === msgId); if (k >= 0) messages[k] = j.message;
      if (j.messages) for (const x of j.messages) if (!messages.some(y => y.id === x.id)) messages.push(x);
      drafts.delete(msgId);
      if (afterSend) await afterSend();
    } catch (e) { btn.disabled = false; btn.textContent = 'ENVIAR A LOS JEFES'; alert('No se pudo enviar: ' + e.message); }
    render(true);
  }
  el.addEventListener('click', e => {
    if (e.target.closest('.sb-x')) return close();
    if (e.target.closest('.sb-clear')) { if (!confirm('¿Empezar una conversación nueva? Las tareas ya enviadas siguen en la oficina.')) return; fetch('/api/sub/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(() => { messages = []; drafts.clear(); render(); }); return; }
    const q = e.target.closest('.sb-chips [data-q]'); if (q) return send(q.dataset.q);
    if (e.target.closest('.sb-send')) return send(input.value);
    const go = e.target.closest('.sb-go'); if (go) return dispatch(go.dataset.msg, go);
    const skip = e.target.closest('.sb-skip'); if (skip) { const m = messages.find(x => x.id === skip.dataset.msg); if (m) { for (const t of m.plan.tasks) if (t.state === 'proposed') edit(m.id, t.i).include = false; dispatch(m.id, skip); } return; }
    const sent = e.target.closest('.sb-item[data-sid]'); if (sent) { const t = findBySid(sent.dataset.sid); if (t) openTask(t); }
  });
  el.addEventListener('change', e => {
    const it = e.target.closest('.sb-item[data-msg]'); if (!it) return;
    const d = edit(it.dataset.msg, +it.dataset.i);
    if (e.target.classList.contains('sb-on')) d.include = e.target.checked;
    if (e.target.classList.contains('sb-dept')) d.dept = e.target.value;
    if (e.target.classList.contains('sb-teamc')) d.team = e.target.checked;
    render();
  });
  el.addEventListener('input', e => { if (!e.target.classList.contains('sb-ins')) return; const it = e.target.closest('.sb-item[data-msg]'); edit(it.dataset.msg, +it.dataset.i).instruction = e.target.value; });
  el.addEventListener('keydown', e => {
    e.stopPropagation(); // the office's one-letter shortcuts stay out of this chat
    if (e.target === input && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
    else if (e.key === 'Escape') close();
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.sb-item[data-sid]')) { e.preventDefault(); e.target.click(); }
  });
  function open() {
    if (!el.hidden) return; opener = document.activeElement; el.hidden = false; document.body.classList.add('subOpen');
    requestAnimationFrame(() => el.classList.add('on'));
    if (!loaded) load(); else render(true);
    timer = setInterval(() => { if (!el.contains(document.activeElement) || document.activeElement === input) render(); }, 3000); // sent pieces follow their tasks
    setTimeout(() => input.focus(), 80);
  }
  function close() { if (el.hidden) return; el.classList.remove('on'); document.body.classList.remove('subOpen'); clearInterval(timer); setTimeout(() => { el.hidden = true; }, 250); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden };
}
