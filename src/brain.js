// Agents Office — the Brain. V3.6 (AJ, 6 Sep 2026) drew the vault's wiki-link graph over the centre pod;
// V4.1 (24 Sep 2026) retires that drawing: the centre shows only the Brain's tag (an animated icon whose
// synapses fire when an agent reads or writes) and Dimitri. What lives here: the graph data (baked by
// graph-build.mjs into src/braingraph.js, replaced by the server's live one) and the full-screen
// Obsidian-style graph that G, the tag or a [[link]] opens.
import { BRAIN as BRAIN0 } from './braingraph.js';
import { PROFILE } from './profile.js';
const BRAIN = (PROFILE && PROFILE.graph && PROFILE.graph.nodes && PROFILE.graph.nodes.length) ? PROFILE.graph : BRAIN0; // INDUSTRY PROFILE: the demo company's own graph
import { AGENTS } from './data.js';
import { mdToHtml, escHTML } from './md.js';
import { modal } from './modal.js'; // V4.1: the page outside an open window is inert

const GROUP_COL = {
  '40-Marketing': '#E69393', '50-Products': '#98A5EF', '60-Sales': '#EADC8F', '70-Delivery': '#8FD3F4',
  '10-Business': '#BFA2E3', '00-Meta': '#F2B33D', '90-Skills': '#5ADEB7', '30-Customers': '#D1DECD',
  '95-Agents': '#B0ADA3', '80-Finance': '#A9B6F0', '05-Inbox': '#B0ADA3',
  '20-Brand': '#F0A868', '50-Emails': '#7FC8A9', '90-Operations': '#C7B8A1', 'Agents Office': '#5ADEB7',
};
const GROUP_NAME = g => g.replace(/^\d\d-/, '');
// which folders each department reads from (and writes into)
const DEPT_FOLDERS = {
  marketing: ['40-Marketing', '20-Brand'], sales: ['60-Sales', '50-Products', '30-Customers'],
  emails: ['60-Sales', '30-Customers', '10-Business'], ops: ['10-Business', '00-Meta', '95-Agents', '90-Skills'],
  fin: ['80-Finance', '10-Business'], delivery: ['70-Delivery', '50-Products'],
};
let INK = '21,20,20'; // dark mode swaps this for the cream ink (setTheme)
const GREEN = '#1E9070';
const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 42);
const timeStr = ts => new Date(ts).toLocaleTimeString('es-PA', { hour: 'numeric', minute: '2-digit' });
const agentOf = id => AGENTS.find(a => a.id === id);

export function initBrain({ esc }) {
  /* ---------- data ---------- */
  let nodes = BRAIN.nodes.map((n, i) => ({ ...n, i }));
  let links = BRAIN.links.map(([a, b]) => [a, b]);
  let adj = nodes.map(() => new Set());
  for (const [a, b] of links) { adj[a].add(b); adj[b].add(a); }
  let byId = new Map(nodes.map(n => [n.id, n.i]));
  const state = { notes: BRAIN.notes, lastRead: null, newToday: 0, reads: new Map(), written: new Map() };
  let hubs = nodes.slice(0, 8);
  const folderNodes = f => nodes.filter(n => n.g === f && n.d >= 2);
  function pickFor(dept) {
    const pool = (DEPT_FOLDERS[dept] || []).flatMap(folderNodes);
    const cands = pool.length ? pool : nodes.slice(0, 40);
    // weight by link count so hubs are read more often, like a real vault
    const tot = cands.reduce((s, n) => s + Math.sqrt(n.d), 0);
    let x = Math.random() * tot;
    for (const n of cands) { x -= Math.sqrt(n.d); if (x <= 0) return n; }
    return cands[0];
  }

  /* ---------- the Brain in the office (V4.1, 24 Sep 2026) ----------
     The centre of the office shows only the Brain's tag (its animated icon) and Dimitri. The ink
     graph that hovered over the pod, its glints and the dashed lines to the desks are gone (the
     owner: «the icon already says memory; the little lines were not pretty»). A read or a write now
     fires the icon's synapses; the full graph lives behind G. */
  function fire() {
    const ic = document.querySelector('.brainTag .brainIc'); if (!ic) return;
    ic.classList.remove('fire'); void ic.getBoundingClientRect(); ic.classList.add('fire');
  }
  let quiet = false; // V3.5: a live office shows only REAL reads and writes, never the demo's theatre
  function setQuiet(on) { quiet = !!on; }
  function read(agentId) {
    const a = agentOf(agentId); if (!a || quiet) return;
    const n = pickFor(a.dept);
    fire();
    state.lastRead = { note: n.id, agent: a.name, ts: Date.now() };
    state.reads.set(n.id, { agent: a.name, ts: Date.now() });
    updateStrip();
  }
  // writes: a finished task becomes a new note off its department's hub
  function write(agentId, title) {
    const a = agentOf(agentId); if (!a) return;
    const folder = (DEPT_FOLDERS[a.dept] || ['00-Meta'])[0];
    const hubPool = folderNodes(folder).slice(0, 5); const hub = hubPool.length ? hubPool[Math.floor(Math.random() * hubPool.length)] : hubs[0];
    const id = slug(title) || 'note';
    fire();
    if (byId.has(id)) return;
    const ang = Math.random() * Math.PI * 2, dist = 0.10 + Math.random() * 0.06;
    const n = { id, g: folder, d: 1, x: Math.max(-0.95, Math.min(0.95, hub.x + Math.cos(ang) * dist)), y: Math.max(-0.95, Math.min(0.95, hub.y + Math.sin(ang) * dist)), i: nodes.length, fresh: true };
    nodes.push(n); byId.set(id, n.i); adj.push(new Set([hub.i])); adj[hub.i].add(n.i); links.push([hub.i, n.i]); hub.d++;
    state.notes++; state.newToday++;
    state.written.set(id, { agent: a.name, task: title, ts: Date.now() });
    const tag = document.querySelector('.brainTag .bt-brain b'); if (tag) tag.textContent = state.notes.toLocaleString('es-PA');
    updateStrip(); if (openNow) dirty();
  }
  // LIVE: replace the graph with the server's (the user's real vault), keeping today's state
  function setGraph(g) {
    if (!g || !g.nodes || !g.nodes.length) return;
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const today = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`; // LOCAL day: the server names notes by the local date (was UTC: after 19:00 in Panamá nothing was «today»)
    nodes = g.nodes.map((n, i) => ({ ...n, i, fresh: n.g === 'Agents Office' && (n.id.startsWith(today) || (n.t || 0) * 1000 >= d0.getTime()) })); // notes the office wrote today glow green
    links = g.links.map(([a, b]) => [a, b]);
    adj = nodes.map(() => new Set()); for (const [a, b] of links) { adj[a].add(b); adj[b].add(a); }
    byId = new Map(nodes.map(n => [n.id, n.i])); hubs = nodes.slice(0, 8);
    state.notes = g.notes;
    const keepSel = sel && sel.id; sel = null; hover = null; // indices changed: the old objects point at other notes now
    refreshGroups();
    if (search.value.trim()) { const q = fold(search.value.trim()); match = new Set(nodes.filter(n => fold(n.id).includes(q) || hits.some(h => h.name === n.id)).map(n => n.i)); } // the indices changed: the search points at the right notes again
    if (openNow) { meta.textContent = metaText(); chips(); if (keepSel && byId.has(keepSel)) sel = nodes[byId.get(keepSel)]; else if (keepSel && !pane.querySelector('.bv-undo')) { pane.innerHTML = EMPTY; reading = false; pane.classList.remove('reading'); } } // the note being read stays as it is (it used to reload and jump to the top)
    const tag = document.querySelector('.brainTag .bt-brain b'); if (tag) tag.textContent = state.notes.toLocaleString('es-PA');
    updateStrip(); dirty();
  }
  // LIVE: an agent read a named note (the server tells us which) — the icon's synapses fire together
  function readNote(agentId, name) {
    const a = agentOf(agentId); if (!a) return;
    fire();
    state.lastRead = { note: name, agent: a.name, ts: Date.now() }; state.reads.set(name, { agent: a.name, ts: Date.now() });
    updateStrip();
  }

  /* ---------- the panel strip: the door ---------- */
  const strip = document.getElementById('tpBrain');
  const micro = strip && strip.querySelector('canvas');
  if (micro) {
    const r = 3, w = 160, h = 100; micro.width = w * r; micro.height = h * r;
    const x = micro.getContext('2d'); x.scale(r, r);
    const Q = n => [w / 2 + n.x * 44, h / 2 + n.y * 44];
    x.lineWidth = .6; x.strokeStyle = `rgba(${INK},.22)`;
    for (const [a, b] of links) { const [x1, y1] = Q(nodes[a]), [x2, y2] = Q(nodes[b]); x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); }
    for (const n of nodes) { const [px, py] = Q(n); x.fillStyle = GROUP_COL[n.g] || '#B0ADA3'; x.beginPath(); x.arc(px, py, .8 + Math.sqrt(n.d) * .32, 0, 7); x.fill(); }
    strip.addEventListener('click', open);
  }
  function updateStrip() {
    if (!strip) return;
    strip.querySelector('.tb-count').textContent = state.notes.toLocaleString('en-NZ');
    const lr = strip.querySelector('.tb-last');
    lr.innerHTML = state.lastRead ? `Última lectura <b>${esc(state.lastRead.note)}</b> por ${esc(state.lastRead.agent)} · ${timeStr(state.lastRead.ts)}` : `${links.length} enlaces wiki · nada leído aún`;
    strip.querySelector('.tb-new').textContent = state.newToday ? `+${state.newToday} nota${state.newToday > 1 ? 's' : ''} hoy` : '';
  }
  updateStrip();

  /* ---------- the full-screen graph (G / click the pod / the strip) ---------- */
  const ov = document.getElementById('brainOv');
  const bcv = document.getElementById('bvCv'); const bctx = bcv.getContext('2d');
  const search = document.getElementById('bvSearch'); const chipsEl = document.getElementById('bvChips');
  const pane = document.getElementById('bvPane'); const meta = document.getElementById('bvMeta');
  let openNow = false, k = 1.2, tx = 0, ty = 0, hover = null, sel = null, drag = null, match = null, freshOnly = false;
  /* ---------- V4 (24 Sep 2026) filters: folders (only these / all), when, who wrote it, department, no links; a real search ---------- */
  let groups = [];
  const F = (() => { try { return { inc: [], when: 'all', who: 'all', dept: '', lone: false, onlyHits: false, ...JSON.parse(localStorage.getItem('ao.bv.f') || '{}') }; } catch { return { inc: [], when: 'all', who: 'all', dept: '', lone: false, onlyHits: false }; } })();
  const saveF = () => { try { localStorage.setItem('ao.bv.f', JSON.stringify(F)); } catch {} };
  const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const colOf = g => GROUP_COL[g] || `hsl(${[...String(g)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 360} 55% 62%)`; // a folder the demo never knew gets its own stable colour
  function refreshGroups() { groups = [...new Set(nodes.map(n => n.g))].sort(); F.inc = F.inc.filter(g => groups.includes(g)); }
  refreshGroups();
  const DAY = 864e5, startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const since = () => F.when === 'today' ? startOfToday() : F.when === 'week' ? Date.now() - 7 * DAY : F.when === 'month' ? Date.now() - 30 * DAY : 0;
  const isOffice = n => n.g === 'Agents Office';
  const passes = (n, skip) => (skip === 'g' || !F.inc.length || F.inc.includes(n.g)) && (!since() || (n.t || 0) * 1000 >= since())
    && (F.who === 'all' || (F.who === 'office') === isOffice(n)) && (!F.dept || n.dep === F.dept) && (!F.lone || !n.d) && (!F.onlyHits || !match || match.has(n.i));
  const visible = n => passes(n);
  const deptsSeen = () => [...new Set(nodes.map(n => n.dep).filter(Boolean))].sort();
  // the second row of filters and the search results live under the search box
  const row2 = document.createElement('div'); row2.id = 'bvRow2'; chipsEl.after(row2);
  const res = document.createElement('div'); res.id = 'bvRes'; res.hidden = true; res.setAttribute('role', 'listbox'); search.after(res);
  search.setAttribute('aria-controls', 'bvRes'); search.setAttribute('aria-autocomplete', 'list'); search.placeholder = 'Buscar en nombres y en el texto…';
  const emptyEl = document.createElement('div'); emptyEl.className = 'bv-none'; emptyEl.hidden = true; emptyEl.innerHTML = 'Nada con estos filtros. <button type="button">Mostrar todo</button>'; ov.appendChild(emptyEl);
  emptyEl.querySelector('button').addEventListener('click', () => resetF());
  function resetF() { Object.assign(F, { inc: [], when: 'all', who: 'all', dept: '', lone: false, onlyHits: false }); saveF(); chips(); dirty(); }
  function chips() {
    const n = g => nodes.filter(x => x.g === g && passes(x, 'g')).length;
    chipsEl.innerHTML = `<button class="bv-chip all${F.inc.length ? '' : ' on'}" data-g="__all" aria-pressed="${!F.inc.length}">Todas</button>` +
      groups.map(g => { const on = F.inc.includes(g); return `<button class="bv-chip${on ? ' on' : ''}" data-g="${escHTML(g)}" aria-pressed="${on}" title="${on ? 'Quitar del filtro' : F.inc.length ? 'Añadir al filtro' : 'Ver solo esta carpeta'}"><i style="background:${colOf(g)}"></i>${escHTML(GROUP_NAME(g))} <b>${n(g)}</b></button>`; }).join('');
    const seg = (key, opts) => `<span class="bv-seg" role="group">${opts.map(([v, l]) => `<button type="button" data-k="${key}" data-v="${v}" class="${F[key] === v ? 'on' : ''}" aria-pressed="${F[key] === v}">${l}</button>`).join('')}</span>`;
    const ds = deptsSeen(), shown = nodes.filter(visible).length, active = F.inc.length || F.when !== 'all' || F.who !== 'all' || F.dept || F.lone || F.onlyHits;
    row2.innerHTML = seg('when', [['all', 'Siempre'], ['today', 'Hoy'], ['week', '7 días'], ['month', '30 días']]) + seg('who', [['all', 'Todo'], ['company', 'De la empresa'], ['office', 'De los agentes']]) +
      (ds.length ? `<select class="bv-dept" aria-label="Departamento"><option value="">Todos los departamentos</option>${ds.map(d => `<option${F.dept === d ? ' selected' : ''}>${escHTML(d)}</option>`).join('')}</select>` : '') +
      `<label class="bv-tg"><input type="checkbox" data-k="lone"${F.lone ? ' checked' : ''}> Sin enlaces · ${nodes.filter(x => !x.d).length}</label>` +
      (match ? `<label class="bv-tg"><input type="checkbox" data-k="onlyHits"${F.onlyHits ? ' checked' : ''}> Solo resultados</label>` : '') +
      `<span class="bv-cnt">${shown} de ${nodes.length} notas</span>${active ? '<button type="button" class="bv-reset">↺ Limpiar filtros</button>' : ''}`;
    emptyEl.hidden = !(openNow && shown === 0);
  }
  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('.bv-chip'); if (!b) return;
    const g = b.dataset.g;
    if (g === '__all') F.inc = []; else F.inc = F.inc.includes(g) ? F.inc.filter(x => x !== g) : [...F.inc, g]; // first click: only this folder; more clicks add; «Todas» resets
    saveF(); chips(); dirty();
  });
  row2.addEventListener('click', e => {
    if (e.target.closest('.bv-reset')) return resetF();
    const b = e.target.closest('button[data-k]'); if (b) { F[b.dataset.k] = b.dataset.v; saveF(); chips(); dirty(); }
  });
  row2.addEventListener('change', e => {
    if (e.target.classList.contains('bv-dept')) F.dept = e.target.value;
    else if (e.target.dataset.k) F[e.target.dataset.k] = e.target.checked;
    saveF(); chips(); dirty();
  });
  // search: names at once (accents ignored), the text of every note from the server a moment later; ↑ ↓ Enter open a hit
  let hits = [], hitAt = -1, qSeq = 0, qTimer = 0;
  function renderHits() {
    if (!search.value.trim()) { res.hidden = true; return; }
    res.hidden = false;
    res.innerHTML = hits.length ? hits.slice(0, 12).map((h, k) => { const n = nodes[byId.get(h.name)]; return `<button type="button" role="option" class="bv-hit${k === hitAt ? ' on' : ''}" data-name="${escHTML(h.name)}" aria-selected="${k === hitAt}">` +
      `<span class="bv-hn"><i style="background:${n ? colOf(n.g) : '#888'}"></i>${escHTML(h.name)}${n ? '' : ' <em>(fuera del grafo)</em>'}</span>${h.snippet ? `<span class="bv-hs">${escHTML(h.snippet)}</span>` : ''}</button>`; }).join('') +
      (hits.length > 12 ? `<div class="bv-hmore">+${hits.length - 12} más: afina la búsqueda</div>` : '') : '<div class="bv-hmore">Nada con eso.</div>';
  }
  function applySearch() {
    const q = fold(search.value.trim());
    if (!q) { match = null; hits = []; renderHits(); chips(); dirty(); return; }
    const local = nodes.filter(n => fold(n.id).includes(q));
    match = new Set(local.map(n => n.i)); hits = local.map(n => ({ name: n.id, snippet: '' })); hitAt = -1;
    renderHits(); chips(); dirty();
    clearTimeout(qTimer);
    if (!SERVED || q.length < 2) return;
    const seq = ++qSeq;
    qTimer = setTimeout(() => fetch('/api/brain/search?q=' + encodeURIComponent(search.value.trim())).then(r => r.json()).then(j => {
      if (seq !== qSeq) return;
      const seen = new Set(hits.map(h => h.name));
      hits = [...j.hits.filter(h => h.inName).map(h => ({ name: h.name, snippet: h.snippet })), ...hits.filter(h => !j.hits.some(x => x.name === h.name)), ...j.hits.filter(h => !h.inName && !seen.has(h.name)).map(h => ({ name: h.name, snippet: h.snippet }))];
      for (const h of hits) { const i = byId.get(h.name); if (i != null) match.add(i); }
      renderHits(); chips(); dirty();
    }).catch(() => {}), 220);
  }
  function openHit(name) {
    const i = byId.get(name); res.hidden = true;
    if (i != null) { const n = nodes[i]; if (!visible(n)) { resetF(); } select(n); centre(n); }
    else if (SERVED) { sel = null; reading = true; pane.classList.add('reading'); pane.innerHTML = `<h3>${esc(name)}</h3><div class="bv-path">fuera del grafo</div><div class="bv-note"><div class="bv-loading">Abriendo la nota…</div></div>`; // a note the graph does not draw: read it anyway
      fetch('/api/note?id=' + encodeURIComponent(name)).then(r => r.json()).then(j => { const box = pane.querySelector('.bv-note'); if (box) box.innerHTML = j.text ? frontFacts(j.text) + `<div class="bv-md md">${mdToHtml(j.text, { front: true })}</div>` : `<p class="bv-err">${esc(j.error || 'No pude abrirla.')}</p>`; }).catch(() => {}); }
  }
  search.addEventListener('input', applySearch);
  search.addEventListener('focus', () => { if (search.value.trim()) renderHits(); });
  res.addEventListener('mousedown', e => { const b = e.target.closest('.bv-hit'); if (b) { e.preventDefault(); openHit(b.dataset.name); } });
  search.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { if (search.value) { search.value = ''; applySearch(); } else search.blur(); res.hidden = true; return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = Math.min(12, hits.length); if (!n) return; hitAt = (hitAt + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; renderHits(); return; }
    if (e.key === 'Enter') { e.preventDefault(); const h = hits[Math.max(0, hitAt)]; if (h) openHit(h.name); }
  });
  search.addEventListener('blur', () => setTimeout(() => { res.hidden = true; }, 150));
  let CW = 1, CH = 1; // the canvas size, read once per frame (reading clientWidth per node forced thousands of layouts a frame)
  function measure() { CW = bcv.clientWidth || 1; CH = bcv.clientHeight || 1; }
  function S() { return Math.min(CW, CH) * 0.44 * k; }
  function sx(n) { return CW * (reading ? 0.34 : 0.42) + n.x * S() + tx; }
  function sy(n) { return CH * 0.5 + n.y * S() + ty; }
  bcv.addEventListener('mousemove', e => {
    if (drag) { tx += e.clientX - drag.x; ty += e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; drag.moved = true; dirty(); return; }
    let best = null, bd = 12; measure();
    for (const n of nodes) { if (!visible(n)) continue; const d = Math.hypot(sx(n) - e.clientX, sy(n) - e.clientY); if (d < bd) { bd = d; best = n; } }
    if (best !== hover) { hover = best; dirty(); } bcv.style.cursor = best ? 'pointer' : 'grab';
  });
  bcv.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, moved: false }; });
  addEventListener('mouseup', e => { if (!drag) return; const moved = drag.moved; drag = null; if (!moved && hover && openNow) select(hover); });
  bcv.addEventListener('wheel', e => {
    e.preventDefault(); e.stopPropagation();
    const f = Math.exp(-e.deltaY * 0.0025); const nk = Math.max(0.5, Math.min(7, k * f)); const r = nk / k;
    const cx = bcv.clientWidth * (reading ? 0.34 : 0.42), cy = bcv.clientHeight * 0.5; // the same centre the drawing uses (with a note open it moves left)
    tx = (tx + cx - e.clientX) * r + e.clientX - cx; ty = (ty + cy - e.clientY) * r + e.clientY - cy; k = nk; dirty();
  }, { passive: false });
  const SERVED = location.protocol.startsWith('http');
  const EMPTY = '<div class="bv-empty">Haz clic en una nota para leerla. Pasa el cursor para ver sus vecinas.</div>';
  let reading = false, readSeq = 0;
  // front matter → the little facts line (who wrote it, when, with what)
  function frontFacts(text) {
    const m = /^---\n([\s\S]*?)\n---/.exec(String(text).replace(/\r\n?/g, '\n')); if (!m) return '';
    const f = Object.fromEntries(m[1].split('\n').map(l => /^([\w-]+):\s*(.*)$/.exec(l)).filter(Boolean).map(x => [x[1], x[2].trim()])); // split at the FIRST colon: «done: 2026-…T05:15:54Z»
    const when = f.done ? new Date(f.done).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const bits = [f.agent && `Escrito por <b>${escHTML(f.agent)}</b>`, f.department && escHTML(f.department), when, f.model && `modelo ${escHTML(f.model)}`, f.tools && `usó ${escHTML(f.tools)}`, f.approved && 'aprobado por ti'].filter(Boolean);
    return bits.length ? `<div class="bv-facts">${bits.join(' · ')}</div>` : '';
  }
  function select(n) {
    sel = n; dirty();
    const out = [...adj[n.i]].map(i => nodes[i]).sort((a, b) => b.d - a.d);
    const rd = state.reads.get(n.id);
    const linksHTML = `<div class="bv-lab">Enlaces · ${out.length}</div>` + out.slice(0, 18).map(o => `<button type="button" class="bv-lk" data-i="${o.i}">${esc(o.id)}</button>`).join('') +
      (out.length > 18 ? `<div class="bv-more">+${out.length - 18} más</div>` : '');
    pane.classList.toggle('reading', SERVED); reading = SERVED;
    pane.innerHTML = `<h3>${esc(n.id)}</h3><div class="bv-path"><i style="background:${colOf(n.g)}"></i>${esc(GROUP_NAME(n.g))} · ${n.d} enlace${n.d === 1 ? '' : 's'}${n.fresh ? ' · <span class="bv-g">nueva hoy</span>' : ''}</div>` +
      (rd ? `<div class="bv-lab">Última lectura por</div><p>${esc(rd.agent)} · ${timeStr(rd.ts)}</p>` : '') +
      (SERVED ? '<div class="bv-note" aria-live="polite"><div class="bv-loading">Abriendo la nota…</div></div>' : '') + `<div class="bv-links">${linksHTML}</div>`;
    pane.scrollTop = 0;
    if (!SERVED) return; // the file-opened demo has no notes to read
    const seq = ++readSeq;
    fetch('/api/note?id=' + encodeURIComponent(n.id)).then(r => r.json().then(j => ({ ok: r.ok, j }))).then(({ ok, j }) => {
      if (seq !== readSeq || sel !== n) return; // another note was clicked meanwhile
      const box = pane.querySelector('.bv-note'); if (!box) return;
      if (!ok) { box.innerHTML = `<p class="bv-err">No pude abrir esta nota: ${esc(j.error || 'error')}.</p>`; return; }
      box.innerHTML = frontFacts(j.text) + `<div class="bv-md md">${mdToHtml(j.text, { front: true })}</div>` + (j.cut ? '<p class="bv-err">La nota es muy larga: se muestran los primeros 200.000 caracteres.</p>' : '') +
        `<div class="bv-actions">${j.deletable ? '<button type="button" class="bv-btn bv-trash">Mover a la papelera</button>' : ''}<button type="button" class="bv-btn bv-copy">Copiar texto</button></div>`;
      box.querySelector('.bv-copy').addEventListener('click', e => copyText(j.text.replace(/^---\n[\s\S]*?\n---\n?/, ''), e.currentTarget));
      const tr = box.querySelector('.bv-trash'); if (tr) tr.addEventListener('click', () => trash(n.id, tr));
    }).catch(() => { const box = pane.querySelector('.bv-note'); if (box && seq === readSeq) box.innerHTML = '<p class="bv-err">Sin conexión con la oficina: no pude abrir la nota.</p>'; });
  }
  function copyText(t, btn) {
    const done = () => { const o = btn.textContent; btn.textContent = 'Copiado ✓'; setTimeout(() => { btn.textContent = o; }, 1400); };
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(done, () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch {} a.remove(); });
  }
  async function trash(id, btn) {
    if (!confirm(`¿Mover «${id}» a la papelera?\n\nVa a «Agents Office/.papelera» dentro del cerebro: sale del grafo y los agentes dejan de leerla. Puedes deshacerlo.`)) return;
    btn.disabled = true; btn.textContent = 'Moviendo…';
    try {
      const r = await fetch('/api/note/trash', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'error');
      sel = null; reading = false; pane.classList.remove('reading');
      pane.innerHTML = `<div class="bv-undo"><p>«${esc(id)}» está en la papelera.</p><button type="button" class="bv-btn">Deshacer</button></div>`;
      pane.querySelector('.bv-undo button').addEventListener('click', async e => {
        e.currentTarget.disabled = true;
        try { const r2 = await fetch('/api/note/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: j.trashed }) }); const j2 = await r2.json(); if (!r2.ok) throw new Error(j2.error); pane.innerHTML = EMPTY; setGraph(j2.graph); const b = byId.get(j2.name); if (b != null) select(nodes[b]); }
        catch (err) { pane.innerHTML = `<p class="bv-err">No pude restaurarla: ${esc(err.message)}</p>`; }
      });
      setGraph(j.graph);
    } catch (e) { btn.disabled = false; btn.textContent = 'Mover a la papelera'; alert('No se pudo mover: ' + e.message); }
  }
  pane.addEventListener('click', e => { // links inside the pane: the neighbour list and the [[wiki]] links in the text
    const lk = e.target.closest('.bv-lk'); if (lk) { const t = nodes[+lk.dataset.i]; if (t) { select(t); centre(t); } return; }
    const w = e.target.closest('.md-wiki'); if (w) { const i = byId.get(w.dataset.note); if (i != null) { select(nodes[i]); centre(nodes[i]); } else w.classList.add('missing'); }
  });
  pane.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.md-wiki')) { e.preventDefault(); e.target.click(); } });
  function centre(n) { measure(); tx = -n.x * S(); ty = -n.y * S(); dirty(); }
  let raf = 0;
  function dirty() { if (openNow && !raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); } // one frame, only when something changed
  function draw() {
    if (!openNow) return;
    measure();
    const dpr = devicePixelRatio || 1, Wd = CW, Hd = CH;
    if (bcv.width !== Math.round(Wd * dpr)) { bcv.width = Math.round(Wd * dpr); bcv.height = Math.round(Hd * dpr); }
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0); bctx.clearRect(0, 0, Wd, Hd);
    const focus = hover || sel; const hi = focus ? new Set([focus.i, ...adj[focus.i]]) : null;
    bctx.lineWidth = Math.max(.5, .8 * Math.sqrt(k));
    for (const [a, b] of links) {
      const A = nodes[a], B = nodes[b]; if (!visible(A) || !visible(B)) continue;
      const lit = hi && hi.has(a) && hi.has(b);
      bctx.strokeStyle = lit ? 'rgba(232,230,223,.85)' : `rgba(232,230,223,${hi || match ? .05 : .15})`;
      bctx.beginPath(); bctx.moveTo(sx(A), sy(A)); bctx.lineTo(sx(B), sy(B)); bctx.stroke();
    }
    bctx.font = `${Math.max(9, 10 * Math.sqrt(k))}px Inter, -apple-system, sans-serif`; bctx.textBaseline = 'middle';
    for (const n of nodes) {
      if (!visible(n)) continue;
      const x = sx(n), y = sy(n); const r = (1.6 + Math.sqrt(n.d) * .75) * Math.sqrt(k);
      const dim = (hi && !hi.has(n.i)) || (match && !match.has(n.i));
      bctx.globalAlpha = dim ? .2 : 1;
      bctx.fillStyle = colOf(n.g); bctx.beginPath(); bctx.arc(x, y, r, 0, 7); bctx.fill();
      if (n.fresh) { bctx.strokeStyle = GREEN; bctx.lineWidth = 1.5; bctx.beginPath(); bctx.arc(x, y, r + 3, 0, 7); bctx.stroke(); }
      if (sel === n) { bctx.strokeStyle = '#E8E6DF'; bctx.lineWidth = 1.5; bctx.beginPath(); bctx.arc(x, y, r + 4, 0, 7); bctx.stroke(); }
      const label = n.d >= 18 || k > 2.2 || (hi && hi.has(n.i)) || (match && match.has(n.i)) || n.fresh;
      if (label) { bctx.fillStyle = dim ? 'rgba(232,230,223,.35)' : '#E8E6DF'; bctx.fillText(n.id, x + r + 4, y); }
      bctx.globalAlpha = 1;
    }
  }
  let owner = PROFILE && PROFILE.company ? String(PROFILE.company).toUpperCase() : 'TUS NOTAS'; // V3.1: the business name when served (was hard-coded to one company); INDUSTRY PROFILE: the demo company
  const metaText = () => `${owner} · ${state.notes.toLocaleString('es-PA')} NOTAS · ${links.length} ENLACES`;
  function setOwner(name) { owner = String(name || 'TUS NOTAS').toUpperCase(); if (openNow) meta.textContent = metaText(); }
  let opener = null;
  function open() {
    if (openNow) return;
    openNow = true; opener = document.activeElement; ov.inert = false; modal.open(ov); ov.classList.add('on'); document.body.classList.add('brainOpen');
    meta.textContent = metaText();
    chips(); if (!sel) { pane.innerHTML = EMPTY; reading = false; pane.classList.remove('reading'); }
    dirty(); setTimeout(() => document.getElementById('bvClose').focus({ preventScroll: true }), 50); // focus inside the dialog, but not the search box: G/Esc must still close it
  }
  function close() { if (!openNow) return; openNow = false; modal.close(ov); ov.inert = true; emptyEl.hidden = true; res.hidden = true; ov.classList.remove('on'); document.body.classList.remove('brainOpen'); if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  function toggle() { openNow ? close() : open(); }
  document.getElementById('bvClose').addEventListener('click', close);
  ov.inert = true; // closed: out of Tab's reach and of screen readers (it stays in the page, faded out)
  addEventListener('resize', dirty);

  function setTheme(dark) { INK = dark ? '236,234,227' : '21,20,20'; }
  function show(id) { const i = byId.get(id); if (i == null) return false; open(); select(nodes[i]); centre(nodes[i]); return true; } // open the Brain on one note (a [[link]] in the chat)
  return { show, read, readNote, write, setGraph, setTheme, setOwner, setQuiet, open, close, toggle, isOpen: () => openNow, state, get nodes() { return nodes; }, get links() { return links; } };
}
