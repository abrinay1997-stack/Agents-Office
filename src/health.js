// Agents Office V4.4 (25 Sep 2026) — «Estado de la oficina» (audit B6, B7, B8): every check (Claude's login, the connectors, the disk,
// the routines, the queue, approvals, failures, security, the daily copy) and the office's notices (a run done late, a retry, a
// connector that stopped). The server builds the checks (serve.mjs → officeStatus, /api/status); this file only shows them.
// 8 oct 2026 (the owner: «¿el botón de estado debería estar en Negocio o en Ajustes?»): it is no longer a button and a window of its
// own but the first tab of Ajustes, «Estado». The traffic light moved to the gear (#topSettings): amber or red when something needs
// attention, and the gear then opens Ajustes on Estado. Key O still opens it straight away.
const STATE = { ok: ['Bien', '●'], info: ['Aviso', '●'], warn: ['Revisar', '▲'], bad: ['Falla', '■'] };
export function initHealth({ served, esc }) {
  const light = () => document.getElementById('topSettings'); // the gear carries the light (the «⋯» copies it on a phone, src/dock.js)
  let data = null, onData = () => {};

  const code = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');
  const dot = s => `<span class="hl-dot s-${s}" aria-hidden="true">${STATE[s][1]}</span>`;
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : new Date(t).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }); };
  // the Estado tab of Ajustes
  function html() {
    const probe = served ? '<div class="hl-tools"><button type="button" class="hl-btn" data-a="probe">Probar conexiones ahora</button></div>' : '';
    if (!served) return '<p class="hl-lead">Esta es la demo: el estado real aparece cuando la oficina corre con <code>npm start</code>.</p>';
    if (!data) return probe + '<p class="hl-lead">Leyendo el estado…</p>';
    const worst = data.checks.filter(c => c.state === 'bad' || c.state === 'warn');
    return `${probe}<p class="hl-lead">${worst.length ? `${dot(data.overall)} <b>${worst.length === 1 ? 'Una cosa necesita' : worst.length + ' cosas necesitan'} atención.</b>` : `${dot('ok')} <b>Todo en orden.</b>`} Actualizado ${ago(data.at)}.</p>
      <ul class="hl-list">${data.checks.map(c => `<li class="hl-row s-${c.state}">${dot(c.state)}<div><b>${esc(c.label)}</b> <span class="hl-st">${STATE[c.state][0]}</span><p>${code(c.detail)}</p>${c.fix ? `<p class="hl-fix">${code(c.fix)}</p>` : ''}</div></li>`).join('')}</ul>
      <div class="hl-nh"><h3>Avisos</h3>${data.unread ? `<button type="button" class="hl-btn" data-a="read">Marcar como leídos (${data.unread})</button>` : ''}</div>
      ${data.notices.length ? `<ul class="hl-notes">${data.notices.map(n => `<li class="${n.read ? '' : 'new'} l-${n.level}"><time>${ago(n.t)}</time><span>${code(n.text)}</span></li>`).join('')}</ul>` : '<p class="hl-empty">Sin avisos.</p>'}`;
  }
  const needs = () => (data ? data.checks.filter(c => c.state === 'bad' || c.state === 'warn').length : 0);
  function paintLight() {
    const btn = light(); if (!btn) return;
    btn.dataset.state = data ? data.overall : 'info';
    const n = needs();
    btn.setAttribute('aria-label', n ? `Ajustes · estado de la oficina: ${n} ${n === 1 ? 'cosa necesita' : 'cosas necesitan'} atención` : 'Ajustes');
    btn.title = n ? `Ajustes — el estado de la oficina: ${n === 1 ? 'una cosa necesita' : n + ' cosas necesitan'} atención (O)` : 'Ajustes de la oficina: estado, apariencia, atajos de teclado, Estudio… (,)';
  }
  async function load() {
    if (!served) return;
    try { const r = await fetch('/api/status'); if (r.ok) { data = await r.json(); paintLight(); onData(); } } catch {}
  }
  // the two buttons of the tab; resolves once the new state is in (Ajustes repaints the tab)
  async function act(a, b) {
    if (a === 'read') { try { await fetch('/api/notices/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); } catch {} return load(); }
    if (a === 'probe') { if (b) { b.disabled = true; b.textContent = 'Probando…'; } try { await fetch('/api/mcp?refresh=1'); } catch {} return load(); }
  }
  paintLight();
  if (served) { load(); setInterval(() => { if (!document.hidden) load(); }, 60000); }
  return { html, act, refresh: load, needsAttention: () => needs() > 0, onData: f => { onData = f || (() => {}); } };
}
