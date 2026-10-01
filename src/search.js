// Agents Office V4.4 (25 Sep 2026) — search everything at once (audit J7). Ctrl+K (⌘K on a Mac).
// Tasks (titles, requests and deliverables), agents, routines, the Brain's notes (the server's search) and the Estudio's
// gallery, in one list; ↑ ↓ to move, Enter to open, Esc to close.
import { modal } from './modal.js';
import { miles } from './galeria-filtro.js'; // the same «5.000» as the Estudio and the picker (toLocaleString('es') leaves 4 digits ungrouped)

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function initSearch({ served, esc, getTasks, agents, getRoutines, openTask, openAgent, openNote, openRoutine, openStudio }) {
  const el = document.createElement('div'); el.id = 'findOv'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Buscar en toda la oficina');
  el.innerHTML = `<div class="fd-box"><div class="fd-bar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input id="fdQ" type="search" role="combobox" aria-expanded="true" aria-controls="fdList" aria-autocomplete="list" autocomplete="off" placeholder="Buscar tareas, notas, agentes, rutinas, imágenes…" aria-label="Buscar en toda la oficina"><kbd>Esc</kbd></div>
    <ul id="fdList" role="listbox" aria-label="Resultados"></ul><p class="fd-foot">↑ ↓ para moverte · Enter para abrir · también por lo que hizo un agente o por el nombre de un cliente</p></div>`;
  document.body.appendChild(el);
  const input = el.querySelector('#fdQ'), list = el.querySelector('#fdList');
  let items = [], sel = 0, opener = null, seq = 0;
  // the Estudio opens on that file (or with that search) if it is listening; otherwise it just opens (INF-03)
  const studioShow = detail => { if (dispatchEvent(new CustomEvent('ao:studio-show', { detail, cancelable: true }))) openStudio(); };
  const snip = (text, words) => { const t = String(text || '').replace(/\s+/g, ' '), f = fold(t); let i = -1; for (const w of words) { i = f.indexOf(w); if (i >= 0) break; } return i < 0 ? t.slice(0, 90) : (i > 30 ? '…' : '') + t.slice(Math.max(0, i - 30), i + 70) + '…'; };
  async function run(q) {
    const my = ++seq, words = fold(q).split(/\s+/).filter(w => w.length > 1); if (!words.length) { items = []; return draw(); }
    const hit = s => { const f = fold(s); return words.every(w => f.includes(w)); };
    const out = [];
    for (const t of getTasks().filter(t => !t.piece).slice().reverse()) { const all = `${t.title} ${t.text || ''} ${t.result || ''} ${t.person || ''}`; if (hit(all)) out.push({ kind: 'Tarea', title: t.title, sub: `${agents.find(a => a.id === t.agent)?.name || ''} · ${snip(`${t.text || ''} ${t.result || ''}`, words)}`, go: () => openTask(t) }); if (out.length > 30) break; }
    for (const a of agents) if (hit(`${a.name} ${a.role || ''} ${a.does || ''}`)) out.push({ kind: 'Agente', title: a.name, sub: a.role || a.does || '', go: () => openAgent(a.id) });
    for (const r of getRoutines()) if (hit(`${r.title} ${r.text || ''}`)) out.push({ kind: 'Rutina', title: r.title, sub: r.desc || '', go: () => openRoutine(r.id) });
    items = out; sel = 0; draw();
    if (!served) return;
    try { const j = await (await fetch('/api/brain/search?q=' + encodeURIComponent(q))).json(); if (my !== seq) return; for (const h of (j.hits || []).slice(0, 12)) items.push({ kind: 'Nota', title: h.name, sub: h.snippet || h.group || '', go: () => openNote(h.name) }); } catch {}
    // Auditoría 1 oct 2026 (INF-03): the server searches the WHOLE gallery (it used to be the 600 newest, filtered here), and
    // a result opens that very file in the Estudio's viewer, not just the Estudio
    try { const j = await (await fetch('/api/media?n=6&q=' + encodeURIComponent(q))).json(); if (my !== seq) return; const n = j.total || 0;
      for (const m of j.items || []) items.push({ kind: m.kind === 'video' ? 'Video' : m.kind === 'audio' ? 'Audio' : 'Imagen', title: String(m.prompt || m.name || m.file).slice(0, 80), sub: [m.modelName || m.model || '', n > 6 && m === j.items[0] ? `${miles(n)} en el Estudio` : ''].filter(Boolean).join(' · '), go: () => studioShow({ file: m.file }) });
      if (n > 6) items.push({ kind: 'Estudio', title: `Ver los ${miles(n)} del Estudio con «${q.trim().slice(0, 40)}»`, sub: 'Abre la galería con esta búsqueda', go: () => studioShow({ q: q.trim() }) });
    } catch {}
    draw();
  }
  function draw() {
    list.innerHTML = items.length ? items.map((it, i) => `<li role="option" id="fd-${i}" aria-selected="${i === sel}" data-i="${i}"><span class="fd-k">${it.kind}</span><span class="fd-t">${esc(it.title)}</span><span class="fd-s">${esc(it.sub)}</span></li>`).join('') : input.value.trim().length > 1 ? '<li class="fd-none" role="presentation">Nada con eso.</li>' : '';
    input.setAttribute('aria-activedescendant', items.length ? 'fd-' + sel : '');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  let tmr = 0;
  input.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => run(input.value), 140); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { sel = (sel + 1) % items.length; draw(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { sel = (sel - 1 + items.length) % items.length; draw(); } }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[sel]; if (it) { close(); setTimeout(() => it.go(), 0); } }
  });
  list.addEventListener('click', e => { const li = e.target.closest('[data-i]'); if (!li) return; const it = items[+li.dataset.i]; close(); setTimeout(() => it.go(), 0); });
  el.addEventListener('click', e => { if (e.target === el) close(); });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  function open() { if (!el.hidden) return; opener = document.activeElement; el.hidden = false; modal.open(el); requestAnimationFrame(() => el.classList.add('on')); input.value = ''; items = []; draw(); input.focus(); }
  function close() { if (el.hidden) return; modal.close(el); el.classList.remove('on'); el.hidden = true; if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); el.hidden ? open() : close(); } }, true);
  return { open, close, isOpen: () => !el.hidden };
}
