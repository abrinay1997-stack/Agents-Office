// Agents Office V4.4 (25 Sep 2026) — «Costos y retorno» (audit C1–C7, C9, C10). Key U, or the plan's usage in the corner.
// What the month cost in dollars, per task, department, desk and model; the last eight weeks; the hours the finished work
// saved and what they are worth; the budget; suggestions (a cheaper model, a routine nobody reads) with one click to apply;
// and the month as CSV for the accountant. The server builds the figures (costs.mjs → /api/costs).
import { modal } from './modal.js';

export function initCosts({ served, esc }) {
  const el = document.createElement('div'); el.id = 'costsOv'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'costsT');
  el.innerHTML = `<div class="cs-box"><div class="cs-head"><h2 id="costsT">Costos y retorno</h2><span class="sp"></span>
    <a class="cs-btn" data-a="csv" href="/api/costs.csv" download>Descargar CSV del mes</a>
    <button type="button" class="cs-x" aria-label="Cerrar" title="Cerrar (Esc)">✕</button></div><div class="cs-body" aria-live="polite"></div></div>`;
  document.body.appendChild(el);
  let data = null, opener = null;
  const usd = n => n >= 100 ? 'US$' + Math.round(n).toLocaleString('es-PA') : n >= 1 ? 'US$' + n.toFixed(2) : n > 0 ? 'US$' + n.toFixed(3) : 'US$0';
  const DEPT = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas', oficina: 'La oficina (enrutar, Dimitri)' };
  const monthName = m => { const [y, mo] = m.split('-'); return new Date(+y, +mo - 1, 1).toLocaleDateString('es-PA', { month: 'long', year: 'numeric' }); };
  function chart(weeks) {
    const max = Math.max(...weeks.map(w => w.usd), 0.01), W = 560, H = 150, pad = 26, bw = (W - pad) / weeks.length;
    const bars = weeks.map((w, i) => { const h = Math.max(w.usd > 0 ? 3 : 0, (w.usd / max) * (H - 40)); const x = pad + i * bw + bw * 0.22, y = H - 22 - h, d = new Date(w.start).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' });
      return `<g class="cs-bar"><title>Semana del ${d}: ${usd(w.usd)} · ${w.tasks} tareas${w.failed ? ' · ' + w.failed + ' fallaron' : ''}</title><rect x="${pad + i * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/><path d="M${x},${H - 22} v${-h + 4} q0,-4 4,-4 h${bw * 0.56 - 8} q4,0 4,4 v${h - 4} z" class="cs-mark"/><text x="${x + bw * 0.28}" y="${H - 6}" text-anchor="middle">${esc(d)}</text>${w.usd > 0 && i === weeks.length - 1 ? `<text x="${x + bw * 0.28}" y="${y - 6}" text-anchor="middle" class="cs-val">${usd(w.usd)}</text>` : ''}</g>`; }).join('');
    return `<svg class="cs-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Costo por semana, últimas 8 semanas: ${weeks.map(w => usd(w.usd)).join(', ')}"><line x1="${pad}" x2="${W}" y1="${H - 22}" y2="${H - 22}" class="cs-axis"/><text x="0" y="12" class="cs-ax">${usd(max)}</text>${bars}</svg>`;
  }
  const table = (head, rows) => `<div class="cs-tw"><table class="cs-t"><thead><tr>${head.map((h, i) => `<th${i ? ' class="n"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  // V4.4 (D1, D10): how each desk is doing — used as it came, sent back, 👍/👎, and a drop after a skill change
  function qualityHTML(q) {
    if (!q) return '';
    const pct = v => v === null || v === undefined ? '—' : v + ' %';
    const rows = q.agents.filter(a => a.tasks).sort((a, b) => (a.score ?? 101) - (b.score ?? 101)).slice(0, 12);
    return `<h3>Calidad (28 días)</h3>
      ${q.drops.length ? `<ul class="cs-sug">${q.drops.map(d => `<li><span>⚠ ${esc(d.name)} bajó de ${d.before} a ${d.after} desde que cambió su skill o su brief (${new Date(d.since).toLocaleDateString('es-PA')}). Puedes volver a la versión anterior desde su ficha.</span></li>`).join('')}</ul>` : ''}
      ${rows.length ? table(['Agente', 'Tareas', 'Puntaje', 'A la primera', 'Devueltas', '👍 / 👎'], rows.map(a => [esc(a.name), a.tasks, (a.score ?? '—') + (a.before !== null && a.score !== null ? ` <small class="${a.score < a.before ? 'cs-down' : 'cs-up'}">${a.score >= a.before ? '▲' : '▼'} ${Math.abs(a.score - a.before)}</small>` : ''), pct(a.firstTry), a.revisions, `${a.up} / ${a.down}`])) : '<p class="cs-empty">Aún no hay tareas terminadas para medir.</p>'}
      <p class="cs-src">Puntaje de 0 a 100: una entrega usada tal cual vale 100; cada vez que la devuelves resta 30 y un 👎 resta 50. ${q.routing.rate !== null ? `Tareas que cambiaste de agente: ${q.routing.moved} de ${q.routing.routed} (${q.routing.rate} %); el enrutador aprende de esos cambios.` : ''}${q.reviews ? ` Segundas opiniones del jefe: ${q.reviews}.` : ''}</p>`;
  }
  function render() {
    const body = el.querySelector('.cs-body');
    if (!served) { body.innerHTML = '<p class="cs-lead">Esta es la demo: los costos reales aparecen cuando la oficina corre con <code>npm start</code>.</p>'; return; }
    if (!data) { body.innerHTML = '<p class="cs-lead">Sumando…</p>'; return; }
    const d = data, b = d.budget;
    el.querySelector('#costsT').textContent = 'Costos, calidad y retorno · ' + monthName(d.month);
    el.querySelector('[data-a="csv"]').href = '/api/costs.csv?month=' + d.month;
    body.innerHTML = `
      ${d.subscription ? '<p class="cs-note">Tu Claude es un plan de tarifa fija: estas cifras son <b>lo que costaría en la API</b>. Sirven para comparar agentes y decidir qué automatizar.</p>' : ''}
      <div class="cs-tiles">
        <div class="cs-tile"><span>Este mes</span><b>${usd(d.usd)}</b><small>${d.runs} ejecuciones${d.overhead ? ` · ${usd(d.overhead)} de la oficina` : ''}</small>${b.budget ? `<div class="cs-meter ${b.level}" role="meter" aria-valuemin="0" aria-valuemax="${b.budget}" aria-valuenow="${b.spent.toFixed(2)}" aria-label="Presupuesto del mes"><i style="width:${Math.min(100, b.ratio * 100)}%"></i></div><small>${Math.round(b.ratio * 100)} % de ${usd(b.budget)}${b.level === 'over' ? ' · <b>superado</b>' : ''}</small>` : '<small>Sin presupuesto: ponlo en <code>costs.monthlyBudget</code></small>'}</div>
        <div class="cs-tile"><span>Por tarea terminada</span><b>${usd(d.perTask)}</b><small>${d.tasksDone} tareas este mes</small></div>
        <div class="cs-tile"><span>Horas ahorradas</span><b>${d.hours.toFixed(1)} h</b><small>estimadas por departamento (<code>costs.minutesPerTask</code>)</small></div>
        <div class="cs-tile"><span>Lo que valen</span><b>${d.hourlyRate ? usd(d.value) : '—'}</b><small>${d.hourlyRate ? `a ${usd(d.hourlyRate)}/h de una persona · ${d.value > d.usd ? 'rinde ' + (d.usd ? Math.round(d.value / d.usd) + '×' : 'mucho') : 'aún no compensa'}` : 'pon lo que cuesta una hora de tu equipo en <code>costs.hourlyRate</code>'}</small></div>
      </div>
      ${d.suggestions.length ? `<h3>Sugerencias</h3><ul class="cs-sug">${d.suggestions.map((s, i) => `<li><span>${esc(s.text)}</span>${s.action ? `<button type="button" class="cs-btn" data-apply="${i}">${s.kind === 'routine-unread' ? 'Pausarla' : 'Cambiar el modelo'}</button>` : ''}</li>`).join('')}</ul>` : ''}
      <h3>Últimas 8 semanas</h3>${chart(d.weeks)}
      <details class="cs-more"><summary>Ver la tabla por semana</summary>${table(['Semana', 'Tareas', 'Fallos', 'Costo'], d.weeks.map(w => [new Date(w.start).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }), w.tasks, w.failed, usd(w.usd)]))}</details>
      <div class="cs-cols">
        <section><h3>Por departamento</h3>${d.byDept.length ? table(['Departamento', 'Tareas', 'Costo'], d.byDept.map(x => [esc(DEPT[x.key] || x.key), x.tasks, usd(x.usd)])) : '<p class="cs-empty">Aún nada este mes.</p>'}</section>
        <section><h3>Por agente</h3>${d.byAgent.filter(x => x.key !== '—').length ? table(['Agente', 'Tareas', 'Costo'], d.byAgent.filter(x => x.key !== '—').slice(0, 10).map(x => [esc(x.name), x.tasks, usd(x.usd)])) : '<p class="cs-empty">Aún nada este mes.</p>'}</section>
      </div>
      ${qualityHTML(d.quality)}
      <h3>Por modelo</h3>${d.byModel.length ? table(['Modelo', 'Ejecuciones', 'Costo'], d.byModel.map(x => [esc(x.key || '—'), x.runs, usd(x.usd)])) : '<p class="cs-empty">Aún nada este mes.</p>'}
      <details class="cs-more"><summary>Precios que usa la oficina (al ${esc(d.pricesAsOf)})</summary>${table(['Modelo', 'Proveedor', 'Entrada /1M', 'Salida /1M', 'Caché /1M'], d.prices.map(p => [esc(p.name), esc(p.provider), '$' + p.in, '$' + p.out, '$' + p.cacheRead]))}<p class="cs-src">${d.priceSources.map(esc).join('<br>')}<br>Con Claude Code, el costo de cada ejecución lo informa el propio Claude; la tabla se usa para otros proveedores. Precios propios: <code>costs.prices</code>.</p></details>`;
  }
  async function load() { if (!served) return; try { const [r, q] = await Promise.all([fetch('/api/costs'), fetch('/api/quality')]); if (r.ok) { data = await r.json(); data.quality = q.ok ? await q.json() : null; if (!el.hidden) render(); } } catch {} }
  function open() { if (!el.hidden) return; opener = document.activeElement; el.hidden = false; modal.open(el); render(); load(); requestAnimationFrame(() => el.classList.add('on')); el.querySelector('.cs-x').focus({ preventScroll: true }); }
  function close() { if (el.hidden) return; if (el.contains(document.activeElement)) document.activeElement.blur(); modal.close(el); el.classList.remove('on'); el.hidden = true; if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  el.addEventListener('click', async e => {
    if (e.target === el || e.target.closest('.cs-x')) return close();
    const b = e.target.closest('[data-apply]'); if (!b || !data) return;
    const s = data.suggestions[+b.dataset.apply]; b.disabled = true;
    try { const r = await fetch('/api/costs/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: s.action }) }); const j = await r.json(); b.textContent = r.ok ? 'Hecho ✓' : 'No se pudo'; b.title = j.text || j.error || ''; } catch { b.textContent = 'No se pudo'; }
    setTimeout(load, 800);
  });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  const dock = document.getElementById('usageDock');
  if (dock) { dock.setAttribute('role', 'button'); dock.tabIndex = 0; dock.title = 'Costos y retorno (U)'; dock.setAttribute('aria-label', 'Uso del plan — abrir costos y retorno'); dock.addEventListener('click', () => open()); dock.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }); }
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden };
}
