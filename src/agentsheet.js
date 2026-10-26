// Agents Office — the AGENT SHEET (✎ in an agent's chat): who the agent is and how it works, edited in the office
// instead of in JSON files. Sections fold (the owner opens what they need): Quién es (name, role, what it does, the
// standing brief, model, effort, usual connectors) · Skills bound to it · Lessons it learnt (✕ forgets one) · Record
// (done, failed, average time, last tasks — a click opens the task).
//   initSheet(ctx) → { open(id), close(), isOpen() }
//   ctx: host (element the sheet lives in) · esc · isLive() · onSaved(agent) · openTask(sid) · MODEL_KEYS · modelName · EFFORT_KEYS
import { mdToHtml } from './md.js';
import { conEstado, enviar } from './accion.js';

const STATE = { next: 'pendiente', scheduled: 'programada', doing: 'en curso', waiting: 'espera tu OK', done: 'lista' };

export function initSheet(ctx) {
  const { host, esc, isLive, onSaved, openTask, MODEL_KEYS, modelName, EFFORT_KEYS } = ctx;
  const el = document.createElement('section'); el.className = 'ag-sheet'; el.hidden = true; el.setAttribute('aria-label', 'Ficha del agente');
  host.appendChild(el);
  let cur = null, data = null, busy = false; const bibText = {}; // el texto de cada habilidad, traído al abrirla
  const open = {}; // which sections are unfolded, remembered while the page lives
  const sec = (key, title, body, count) => `<details class="ag-sec" data-k="${key}"${open[key] ?? key === 'who' ? ' open' : ''}><summary>${title}${count !== undefined ? ` <b>${count}</b>` : ''}</summary><div class="ag-body">${body}</div></details>`;
  function render() {
    const d = data, a = d.agent;
    const who = `
      <label>Nombre (el cartel del escritorio)<input class="ag-name" maxlength="32" value="${esc(a.name)}"></label>
      <label>Rol<input class="ag-role" maxlength="80" value="${esc(a.role || '')}"></label>
      <label>Qué hace <small>(lo lee antes de cada tarea; el Subgerente y el líder reparten por esto)</small><textarea class="ag-does" rows="3" maxlength="400">${esc(a.does || '')}</textarea></label>
      <label>Instrucciones permanentes (brief) <small class="ag-cnt"></small><textarea class="ag-brief" rows="7" maxlength="2000" placeholder="Lo que siempre debe tener en cuenta. Si tiene pasos o una plantilla, mejor una skill.">${esc(a.brief || '')}</textarea></label>
      <div class="ag-grid">
        <label>Modelo<select class="ag-model"><option value="">El de la oficina</option>${MODEL_KEYS.map(k => `<option value="${k}"${a.model === k ? ' selected' : ''}>${esc(modelName(k))}</option>`).join('')}</select></label>
        <label>Esfuerzo<select class="ag-effort"><option value="">El de la oficina</option>${EFFORT_KEYS.map(k => `<option value="${k}"${a.effort === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
      </div>
      <label>Conectores habituales <small>(separados por coma; los que usa primero)</small><input class="ag-tools" value="${esc((a.tools || []).join(', '))}"></label>
      <p class="ag-note">Tiene acceso a: ${d.connectors.length ? esc(d.connectors.join(', ')) : 'ningún conector conectado'}${d.studio ? ' · ✦ Estudio (imágenes y video)' : ''}${d.contenido ? ' · ✦ Contenido (deja borradores; tú los apruebas)' : ''}. Los cambios valen desde la próxima tarea.</p>
      <div class="ag-acts"><button type="button" class="ag-save">GUARDAR</button><span class="ag-msg" aria-live="polite"></span></div>`;
    const skills = d.skills.length ? d.skills.map(s => `<details class="ag-skill"><summary><b>${esc(s.name)}</b>${s.description ? ' — ' + esc(s.description) : ''}${s.everyone ? ' <i>(toda la oficina)</i>' : ''}</summary><div class="md ag-skilltext">${mdToHtml(s.text || '')}</div>${s.files.length ? `<p class="ag-note">Archivos: ${s.files.map(esc).join(', ')}</p>` : ''}</details>`).join('') + '<p class="ag-note">Para enseñarle un proceso nuevo, escribe «configurar» al líder del departamento, o pídeselo a Claude Code («así hacemos X»).</p>'
      : '<p class="ag-note">Sin skills todavía. Escribe «configurar» al líder del departamento para crear una.</p>';
    // 7 oct 2026: la BIBLIOTECA — métodos que el agente lee cuando la tarea lo pide (biblioteca.mjs); el texto se trae al abrir uno
    const bib = d.biblioteca || [], hab = h => `<details class="ag-skill ag-hab" data-hab="${esc(h.id)}"><summary><b>${esc(h.titulo)}</b> — ${esc(h.description.replace(/^Úsala cuando\s*/i, 'cuando '))}${h.fuente === 'cerebro' ? ' <i>(tu versión)</i>' : ''}</summary><div class="md ag-skilltext">${bibText[h.id] ? mdToHtml(bibText[h.id]) : '<p class="ag-note">Cargando…</p>'}</div>${h.referencias.length ? `<p class="ag-note">Referencias que pide cuando le hacen falta: ${h.referencias.map(esc).join(', ')}</p>` : ''}</details>`;
    const suyas = bib.filter(h => h.suya), depto = bib.filter(h => !h.suya);
    const biblioteca = bib.length ? `${suyas.length ? `<p class="ag-lab">De su puesto</p>${suyas.map(hab).join('')}` : ''}${depto.length ? `<p class="ag-lab">De su departamento</p>${depto.map(hab).join('')}` : ''}<p class="ag-note">No las lee todas en cada tarea: ve la lista, la que encaja con el pedido se le adelanta entera y el resto lo pide cuando le hace falta. Lo de tu empresa (posicionamiento, clientes, voz, precios) lo saca del Cerebro. Para cambiar cómo hace algo, pídeselo a Claude Code («adapta la habilidad X a nuestro negocio»): tu versión va a tu Cerebro y gana a la de la oficina.</p>`
      : '<p class="ag-note">Su departamento todavía no tiene habilidades en la biblioteca.</p>';
    const L = d.lessons, line = (t, k) => `<li><span>${esc(t)}</span><button type="button" class="ag-forget" data-line="${esc(t)}" aria-label="Olvidar esta lección" title="Olvidar">✕</button></li>`;
    const lessons = (L.rules.length || L.oneOffs.length) ? `${L.rules.length ? `<p class="ag-lab">Reglas que sigue siempre</p><ul class="ag-ls">${L.rules.map(t => line(t)).join('')}</ul>` : ''}${L.oneOffs.length ? `<p class="ag-lab">Correcciones puntuales</p><ul class="ag-ls">${L.oneOffs.map(t => line(t)).join('')}</ul>` : ''}`
      : '<p class="ag-note">Aún no aprendió nada. Cada vez que devuelves un trabajo con «revise: …» o con una nota, la corrección queda aquí.</p>';
    const st = d.stats;
    const record = `<div class="ag-stats"><span><b>${st.done}</b> listas</span><span><b>${st.failed}</b> con error</span><span><b>${st.running}</b> en curso</span><span><b>${st.waiting}</b> esperan tu OK</span><span><b>${st.pending}</b> en cola</span>${st.avgMinutes !== null ? `<span><b>${st.avgMinutes}</b> min de promedio</span>` : ''}</div>` +
      (d.recent.length ? `<ul class="ag-recent">${d.recent.map(t => `<li><button type="button" data-sid="${esc(t.id)}"><span class="ag-st ${t.error ? 'err' : t.state}">${t.error ? 'error' : STATE[t.state] || t.state}</span>${esc(t.title)}</button></li>`).join('')}</ul>` : '<p class="ag-note">Sin tareas todavía.</p>');
    el.innerHTML = `<div class="ag-head"><div><div class="ag-title">${esc(a.name)}${a.lead ? ' <span class="star">★</span>' : ''}</div><div class="ag-sub">${esc(a.role || '')}</div></div><span class="sp"></span><button type="button" class="ag-x" aria-label="Volver al chat">✕</button></div>
      <div class="ag-scroll">${sec('who', 'Quién es', who)}${sec('skills', 'Skills', skills, d.skills.length)}${sec('biblioteca', 'Biblioteca de habilidades', biblioteca, bib.length || undefined)}${sec('lessons', 'Lecciones aprendidas', lessons, L.rules.length + L.oneOffs.length)}${sec('record', 'Historial', record, st.done + st.failed)}${sec('versions', 'Versiones de sus skills y brief', versionsHTML(), (data.versions || []).reduce((n, x) => n + x.versions.length, 0) || undefined)}</div>`;
    count(); snap = formNow();
  }
  // V4.1 (audit 25): closing with unsaved changes asks first — it used to throw them away without a word
  const FIELDS = ['.ag-name', '.ag-role', '.ag-does', '.ag-brief', '.ag-model', '.ag-effort', '.ag-tools'];
  let snap = '';
  const formNow = () => FIELDS.map(f => { const x = el.querySelector(f); return x ? x.value : ''; }).join('\u0001');
  const unsaved = () => !el.hidden && !!data && !!el.querySelector('.ag-name') && formNow() !== snap;
  const count = () => { const b = el.querySelector('.ag-brief'), c = el.querySelector('.ag-cnt'); if (b && c) c.textContent = `${b.value.length} / 2000`; };
  const msg = (t, bad) => { const m = el.querySelector('.ag-msg'); if (m) { m.textContent = t; m.className = 'ag-msg' + (bad ? ' bad' : ''); } };
  async function load(id) {
    el.innerHTML = '<div class="ag-loading">Abriendo la ficha…</div>';
    try { const r = await fetch('/api/agents/' + encodeURIComponent(id)); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); data = j; if (cur === id) render(); loadVersions(id); }
    catch (e) { el.innerHTML = `<div class="ag-loading bad">No pude abrir la ficha: ${esc(e.message)}</div>`; }
  }
  // V4.4 (D7): every version of this desk's skills and brief, with «Volver a esta versión»
  async function loadVersions(id) {
    const items = [...(data.skills || []).filter(k => k.source !== 'shipped').map(k => ({ kind: 'skill', name: k.name })), { kind: 'brief', name: id }];
    const got = await Promise.all(items.map(it => fetch(`/api/history?kind=${it.kind}&name=${encodeURIComponent(it.name)}`).then(r => r.json()).then(j => ({ ...it, versions: j.versions || [] })).catch(() => ({ ...it, versions: [] }))));
    if (cur !== id || !data) return; data.versions = got.filter(x => x.versions.length); render();
  }
  const when = at => new Date(at).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const versionsHTML = () => { const v = data.versions || []; if (!v.length) return '<p class="ag-note">La oficina guarda cada versión de sus skills y de su brief desde que empieza a verlas; aquí aparecen cuando cambien.</p>';
    return v.map(x => `<p class="ag-lab">${x.kind === 'skill' ? 'Skill «' + esc(x.name) + '»' : 'Su brief'}</p><ul class="ag-vers">${x.versions.map((ver, i) => `<li><span><b>${when(ver.at)}</b>${i === 0 ? ' · la actual' : ''}<br><small>${esc(ver.preview)}…</small></span>${i ? `<button type="button" class="ag-restore" data-kind="${x.kind}" data-name="${esc(x.name)}" data-at="${ver.at}">Volver a esta</button>` : ''}</li>`).join('')}</ul>`).join(''); };
  async function save() {
    if (busy) return; busy = true;
    const v = s => el.querySelector(s).value;
    const patch = { name: v('.ag-name').trim(), role: v('.ag-role').trim(), does: v('.ag-does').trim(), brief: v('.ag-brief').trim(), model: v('.ag-model'), effort: v('.ag-effort'), tools: v('.ag-tools').split(',').map(x => x.trim().toLowerCase()).filter(Boolean) };
    if (!patch.name) { busy = false; return msg('El nombre no puede quedar vacío.', true); }
    msg('');
    const c = await conEstado(el.querySelector('.ag-save'), () => enviar('/api/agents/' + encodeURIComponent(cur), patch, 'PATCH'), { ocupado: 'Guardando…', hecho: 'Guardado' });
    if (c.ok) { data.agent = c.valor.agent; if (onSaved) onSaved(c.valor.agent); render(); msg('Guardado. Vale desde la próxima tarea.'); } else msg('No se guardó: ' + c.error, true);
    busy = false;
  }
  el.addEventListener('toggle', e => { const d = e.target.closest('.ag-sec'); if (d && e.target === d) open[d.dataset.k] = d.open;
    const h = e.target.closest?.('.ag-hab'); if (h && e.target === h && h.open && !bibText[h.dataset.hab]) { const id = h.dataset.hab; // se trae una vez, al abrirla
      fetch('/api/biblioteca/' + encodeURIComponent(id)).then(r => r.json()).then(j => { bibText[id] = j.texto || j.error || ''; const box = el.querySelector(`.ag-hab[data-hab="${CSS.escape(id)}"] .ag-skilltext`); if (box) box.innerHTML = mdToHtml(bibText[id]); }).catch(() => {}); } }, true);
  el.addEventListener('input', e => { if (e.target.classList.contains('ag-brief')) count(); });
  el.addEventListener('click', async e => {
    if (e.target.closest('.ag-x')) return close();
    if (e.target.closest('.ag-save')) return save();
    const f = e.target.closest('.ag-forget');
    if (f) { if (!confirm('¿Olvidar esta lección? El agente dejará de tenerla en cuenta.')) return;
      const c = await conEstado(f, () => enviar(`/api/agents/${encodeURIComponent(cur)}/forget`, { line: f.dataset.line }), { ocupado: 'Olvidando…', hecho: 'Olvidada', ms: 600 }); if (c.ok) { data.lessons = c.valor.lessons; render(); } return; }
    const rs = e.target.closest('.ag-restore');
    if (rs) { if (!confirm(`¿Volver a la versión del ${when(+rs.dataset.at)}? La actual queda guardada en el historial.`)) return;
      const c = await conEstado(rs, () => enviar('/api/history/restore', { kind: rs.dataset.kind, name: rs.dataset.name, at: +rs.dataset.at }), { ocupado: 'Restaurando…', hecho: 'Restaurada', ms: 600 }); if (c.ok) { msg(c.valor.text || 'Restaurada.'); load(cur); } return; }
    const t = e.target.closest('[data-sid]'); if (t && openTask) openTask(t.dataset.sid);
  });
  el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });
  function openSheet(id) {
    if (!isLive()) { alert('La ficha edita la oficina real: ábrela con el iniciador.'); return; }
    cur = id; el.hidden = false; host.classList.add('sheetOpen'); load(id);
  }
  function close(force) { // → false when the owner chose to stay and keep the changes
    if (!force && unsaved() && !confirm(`Hay cambios sin guardar en la ficha de ${data.agent.name}. ¿Cerrar sin guardarlos?`)) { el.querySelector('.ag-save')?.focus(); return false; }
    cur = null; el.hidden = true; host.classList.remove('sheetOpen'); return true;
  }
  addEventListener('beforeunload', e => { if (unsaved()) { e.preventDefault(); e.returnValue = ''; } }); // closing the page warns too
  return { open: openSheet, close, isOpen: () => !el.hidden, current: () => cur, unsaved };
}
