// Agents Office V4.4 (25 Sep 2026) — «Estado de la oficina» (audit B6, B7, B8): a traffic light in the dock and a window
// with every check (Claude's login, the connectors, the disk, the routines, the queue, approvals, failures, security,
// the daily copy) and the office's notices (a run done late, a retry, a connector that stopped). Key O.
// The server builds the checks (serve.mjs → officeStatus, /api/status); this file only shows them.
import { modal } from './modal.js';

const STATE = { ok: ['Bien', '●'], info: ['Aviso', '●'], warn: ['Revisar', '▲'], bad: ['Falla', '■'] };
export function initHealth({ served, esc }) {
  const btn = document.getElementById('topHealth');
  const el = document.createElement('div'); el.id = 'healthOv'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'healthT');
  el.innerHTML = `<div class="hl-box"><div class="hl-head"><h2 id="healthT">Estado de la oficina</h2><span class="sp"></span>
      <button type="button" class="hl-btn" data-a="probe">Probar conexiones ahora</button>
      <button type="button" class="hl-x" aria-label="Cerrar" title="Cerrar (Esc)">✕</button></div>
    <div class="hl-body" aria-live="polite"></div></div>`;
  document.body.appendChild(el);
  let data = null, opener = null, timer = null;

  const code = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');
  const dot = s => `<span class="hl-dot s-${s}" aria-hidden="true">${STATE[s][1]}</span>`;
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : new Date(t).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }); };
  function render() {
    const body = el.querySelector('.hl-body');
    if (!served) { body.innerHTML = '<p class="hl-lead">Esta es la demo: el estado real aparece cuando la oficina corre con <code>npm start</code>.</p>'; return; }
    if (!data) { body.innerHTML = '<p class="hl-lead">Leyendo el estado…</p>'; return; }
    const worst = data.checks.filter(c => c.state === 'bad' || c.state === 'warn');
    body.innerHTML = `<p class="hl-lead">${worst.length ? `${dot(data.overall)} <b>${worst.length === 1 ? 'Una cosa necesita' : worst.length + ' cosas necesitan'} atención.</b>` : `${dot('ok')} <b>Todo en orden.</b>`} Actualizado ${ago(data.at)}.</p>
      <ul class="hl-list">${data.checks.map(c => `<li class="hl-row s-${c.state}">${dot(c.state)}<div><b>${esc(c.label)}</b> <span class="hl-st">${STATE[c.state][0]}</span><p>${code(c.detail)}</p>${c.fix ? `<p class="hl-fix">${code(c.fix)}</p>` : ''}</div></li>`).join('')}</ul>
      <div class="hl-nh"><h3>Avisos</h3>${data.unread ? `<button type="button" class="hl-btn" data-a="read">Marcar como leídos (${data.unread})</button>` : ''}</div>
      ${data.notices.length ? `<ul class="hl-notes">${data.notices.map(n => `<li class="${n.read ? '' : 'new'} l-${n.level}"><time>${ago(n.t)}</time><span>${code(n.text)}</span></li>`).join('')}</ul>` : '<p class="hl-empty">Sin avisos.</p>'}`;
  }
  function paintDock() {
    if (!btn) return;
    const s = data ? data.overall : 'info';
    btn.dataset.state = s;
    const n = data ? data.checks.filter(c => c.state === 'bad' || c.state === 'warn').length : 0;
    btn.setAttribute('aria-label', data ? (n ? `Estado de la oficina: ${n} ${n === 1 ? 'cosa necesita' : 'cosas necesitan'} atención` : 'Estado de la oficina: todo en orden') : 'Estado de la oficina');
  }
  async function load() {
    if (!served) return;
    try { const r = await fetch('/api/status'); if (r.ok) { data = await r.json(); paintDock(); if (!el.hidden) render(); } } catch {}
  }
  function open() { if (!el.hidden) return; opener = document.activeElement; el.hidden = false; modal.open(el); btn?.setAttribute('aria-expanded', 'true'); render(); load(); requestAnimationFrame(() => el.classList.add('on')); el.querySelector('.hl-x').focus({ preventScroll: true }); }
  function close() { if (el.hidden) return; if (el.contains(document.activeElement)) document.activeElement.blur(); modal.close(el); el.classList.remove('on'); el.hidden = true; btn?.setAttribute('aria-expanded', 'false'); if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  el.addEventListener('click', async e => {
    if (e.target === el || e.target.closest('.hl-x')) return close();
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'read') { try { await fetch('/api/notices/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); } catch {} load(); }
    if (a === 'probe') { const b = e.target.closest('button'); b.disabled = true; b.textContent = 'Probando…'; try { await fetch('/api/mcp?refresh=1'); } catch {} b.disabled = false; b.textContent = 'Probar conexiones ahora'; load(); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  btn?.addEventListener('click', () => (el.hidden ? open() : close()));
  paintDock();
  if (served) { load(); timer = setInterval(() => { if (!document.hidden) load(); }, 60000); }
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden, refresh: load };
}
