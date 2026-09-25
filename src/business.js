// Agents Office V4.4 (25 Sep 2026) — «Cómo va el negocio» (audit J1). Key N, or the chart in the dock.
// The owner's own indicators (sales of the week, overdue invoices, new leads…) with their trend and goal, and the office's
// own figures. A number arrives by hand here, by webhook (POST /api/kpi/<id>) or from a deliverable («KPI id = 1.250»).
import { modal } from './modal.js';

export function initBusiness({ served, esc }) {
  const btn = document.getElementById('topBiz');
  const el = document.createElement('div'); el.id = 'bizOv'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'bizT');
  el.innerHTML = `<div class="bz-box"><div class="bz-head"><h2 id="bizT">Cómo va el negocio</h2><span class="sp"></span><button type="button" class="bz-x" aria-label="Cerrar" title="Cerrar (Esc)">✕</button></div><div class="bz-body" aria-live="polite"></div></div>`;
  document.body.appendChild(el);
  let data = null, opener = null, adding = false;
  const fmt = (v, unit) => v === null || v === undefined ? '—' : (unit === 'US$' || unit === '$' ? 'US$' : '') + (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('es-PA') : (+v.toFixed(2)).toLocaleString('es-PA')) + (unit && unit !== 'US$' && unit !== '$' ? ' ' + unit : '');
  function spark(series) {
    if (!series || series.length < 2) return '';
    const W = 120, H = 32, min = Math.min(...series), max = Math.max(...series), r = max - min || 1, x = i => 2 + i * (W - 4) / (series.length - 1), y = v => H - 4 - (v - min) / r * (H - 8);
    const d = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    return `<svg class="bz-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" class="bz-line"/><circle cx="${x(series.length - 1)}" cy="${y(series.at(-1))}" r="2.8" class="bz-dot"/></svg>`;
  }
  function tile(k) {
    const ch = k.change === null ? '' : `<span class="bz-ch ${k.good ? 'good' : 'bad'}">${k.change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(k.change * 100))} %<span class="sr"> ${k.good ? '(bien)' : '(mal)'}</span></span>`;
    return `<div class="bz-tile"><span class="bz-n">${esc(k.name)}</span><b>${fmt(k.value, k.unit)}</b>${spark(k.series)}
      <small>${ch}${k.goal ? ` · meta ${fmt(k.goal, k.unit)} (${Math.round((k.goalPct || 0) * 100)} %)` : ''}${k.at ? ` · ${new Date(k.at).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' })}${k.from ? ', ' + esc(k.from) : ''}` : ' · sin datos todavía'}</small>
      <form class="bz-set" data-id="${esc(k.id)}"><label class="sr" for="bz-${esc(k.id)}">Nuevo valor de ${esc(k.name)}</label><input id="bz-${esc(k.id)}" inputmode="decimal" placeholder="nuevo valor"><button type="submit" class="bz-btn">Anotar</button><button type="button" class="bz-btn ghost" data-rm="${esc(k.id)}" aria-label="Quitar el indicador ${esc(k.name)}">Quitar</button></form></div>`;
  }
  function render() {
    const body = el.querySelector('.bz-body');
    if (!served) { body.innerHTML = '<p class="bz-lead">Esta es la demo: tus indicadores aparecen en la oficina real (<code>npm start</code>).</p>'; return; }
    if (!data) { body.innerHTML = '<p class="bz-lead">Leyendo…</p>'; return; }
    body.innerHTML = `
      ${data.kpis.length ? `<div class="bz-grid">${data.kpis.map(tile).join('')}</div>` : '<p class="bz-lead">Todavía no hay indicadores. Añade los que miras cada semana: ventas, facturas vencidas, clientes nuevos…</p>'}
      ${adding ? `<form class="bz-add"><div><label for="bzName">Nombre</label><input id="bzName" required placeholder="Ventas de la semana"></div><div><label for="bzId">Id (para los agentes y los webhooks)</label><input id="bzId" required pattern="[a-z][a-z0-9_]{1,40}" placeholder="ventas_semana"></div><div><label for="bzUnit">Unidad</label><input id="bzUnit" placeholder="US$"></div><div><label for="bzGoal">Meta (opcional)</label><input id="bzGoal" inputmode="decimal"></div><div><label for="bzBetter">Mejor si…</label><select id="bzBetter"><option value="up">sube</option><option value="down">baja</option></select></div><button type="submit" class="bz-btn pri">Crear</button><button type="button" class="bz-btn" data-a="cancel">Cancelar</button></form>`
        : `<div class="bz-actions"><button type="button" class="bz-btn pri" data-a="add">+ Añadir un indicador</button>${data.suggested.map(s => `<button type="button" class="bz-btn" data-sug="${esc(s.id)}">+ ${esc(s.name)}</button>`).join('')}</div>`}
      <h3>La oficina esta semana</h3><div class="bz-grid small">${data.office.map(o => `<div class="bz-tile"><span class="bz-n">${esc(o.name)}</span><b>${o.value === null ? '—' : fmt(o.value, o.unit)}</b><small>${esc(o.hint || '')}</small></div>`).join('')}</div>
      <details class="bz-how"><summary>Cómo llegan los números solos</summary><ul>
        <li><b>Una rutina:</b> «cada lunes a las 8, cuenta las ventas de la semana en Stripe y escribe <code>KPI ventas_semana = …</code>». La línea se anota sola.</li>
        <li><b>Un webhook</b> (Zapier, Make, n8n, una hoja): <code>POST /api/kpi/ventas_semana?token=…</code> con <code>{"value": 1250}</code>. ${data.hookToken ? 'La clave AO_HOOK_TOKEN ya está.' : 'Falta la clave AO_HOOK_TOKEN (docs/disparadores.md).'}</li>
        <li><b>A mano:</b> escribe el valor en su tarjeta y pulsa «Anotar».</li></ul></details>`;
  }
  async function load() { if (!served) return render(); try { const r = await fetch('/api/business'); data = await r.json(); } catch {} render(); }
  const post = (p, b) => fetch('/api' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ ok: r.ok, ...(await r.json().catch(() => ({}))) }));
  function open() { if (!el.hidden) return; opener = document.activeElement; el.hidden = false; modal.open(el); btn?.setAttribute('aria-expanded', 'true'); render(); load(); requestAnimationFrame(() => el.classList.add('on')); el.querySelector('.bz-x').focus({ preventScroll: true }); }
  function close() { if (el.hidden) return; if (el.contains(document.activeElement)) document.activeElement.blur(); modal.close(el); el.classList.remove('on'); el.hidden = true; adding = false; btn?.setAttribute('aria-expanded', 'false'); if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  el.addEventListener('click', async e => {
    if (e.target === el || e.target.closest('.bz-x')) return close();
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'add') { adding = true; render(); el.querySelector('#bzName').focus(); return; }
    if (a === 'cancel') { adding = false; render(); return; }
    const sg = e.target.closest('[data-sug]'); if (sg) { const s = data.suggested.find(x => x.id === sg.dataset.sug); await post('/business/kpi', s); return load(); }
    const rm = e.target.closest('[data-rm]'); if (rm) { if (!confirm('¿Quitar este indicador? Sus valores guardados se conservan.')) return; await post('/business/kpi', { remove: rm.dataset.rm }); return load(); }
  });
  el.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.classList.contains('bz-add')) { const r = await post('/business/kpi', { name: f.querySelector('#bzName').value, id: f.querySelector('#bzId').value, unit: f.querySelector('#bzUnit').value, goal: f.querySelector('#bzGoal').value, better: f.querySelector('#bzBetter').value }); if (!r.ok) return alert(r.error); adding = false; return load(); }
    if (f.classList.contains('bz-set')) { const v = f.querySelector('input').value; if (!v.trim()) return; const r = await post('/business/value', { id: f.dataset.id, value: v }); if (!r.ok) return alert(r.error); return load(); }
  });
  el.addEventListener('input', e => { if (e.target.id === 'bzName') { const id = el.querySelector('#bzId'); if (!id.dataset.touched) id.value = e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40); } if (e.target.id === 'bzId') e.target.dataset.touched = '1'; });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  btn?.addEventListener('click', () => (el.hidden ? open() : close()));
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden };
}
