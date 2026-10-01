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
import { views } from './views.js'; // V4.5: the Estudio, the calendar and the Brain take turns under the top bar
import { initBrain3D } from './brain3d.js'; // V4.6: the Brain as a 3D neural network

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
  let extra = (BRAIN.extra || []).map(([a, b]) => [a, b]), learnedLinks = []; // V4.6: mentions (a note names another without linking it) · links learned from approved work
  let adjM = nodes.map(() => new Set()); for (const [a, b] of extra) { if (adjM[a] && adjM[b]) { adjM[a].add(b); adjM[b].add(a); } }
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
    updateStrip(); if (g3 && openNow) g3.pulseFrom(n.i);
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
    updateStrip(); graphChanged(); if (g3) g3.pulseFrom(n.i, 1);
  }
  // LIVE: replace the graph with the server's (the user's real vault), keeping today's state
  function setGraph(g) {
    if (!g || !g.nodes || !g.nodes.length) return;
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const today = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`; // LOCAL day: the server names notes by the local date (was UTC: after 19:00 in Panamá nothing was «today»)
    nodes = g.nodes.map((n, i) => ({ ...n, i, fresh: n.g === 'Agents Office' && (n.id.startsWith(today) || (n.t || 0) * 1000 >= d0.getTime()) })); // notes the office wrote today glow green
    links = g.links.map(([a, b]) => [a, b]);
    adj = nodes.map(() => new Set()); for (const [a, b] of links) { adj[a].add(b); adj[b].add(a); }
    extra = (g.extra || []).map(([a, b]) => [a, b]); adjM = nodes.map(() => new Set()); for (const [a, b] of extra) { if (adjM[a] && adjM[b]) { adjM[a].add(b); adjM[b].add(a); } }
    learnedLinks = (g.learned?.links || []).filter(([a, b]) => nodes[a] && nodes[b]); for (const [i, w] of Object.entries(g.learned?.w || {})) if (nodes[+i]) nodes[+i].w = w; // what the Brain learned from the owner's approvals
    byId = new Map(nodes.map(n => [n.id, n.i])); hubs = nodes.slice(0, 8);
    state.notes = g.notes;
    const keepSel = sel && sel.id; sel = null; hover = null; // indices changed: the old objects point at other notes now
    refreshGroups();
    if (search.value.trim()) { const q = fold(search.value.trim()); match = new Set(nodes.filter(n => fold(n.id).includes(q) || hits.some(h => h.name === n.id)).map(n => n.i)); } // the indices changed: the search points at the right notes again
    if (keepSel && byId.has(keepSel)) sel = nodes[byId.get(keepSel)]; else if (keepSel && !pane.querySelector('.bv-undo')) closePane(); // the note being read stays as it is (it used to reload and jump to the top)
    if (openNow) { meta.textContent = metaText(); chips(); }
    const tag = document.querySelector('.brainTag .bt-brain b'); if (tag) tag.textContent = state.notes.toLocaleString('es-PA');
    updateStrip(); graphChanged();
  }
  // LIVE: an agent read a named note (the server tells us which) — the icon's synapses fire together
  function readNote(agentId, name) {
    const a = agentOf(agentId); if (!a) return;
    fire();
    state.lastRead = { note: name, agent: a.name, ts: Date.now() }; state.reads.set(name, { agent: a.name, ts: Date.now() });
    updateStrip();
    const i = byId.get(name); if (g3 && openNow && i != null) g3.pulseFrom(i); // V4.6: the signal runs out along its synapses
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

  /* ---------- the full-screen Brain (G · the dock · the centre's tag) — V4.6 (27 Sep 2026): a 3D neural network ----------
     The notes are neurons and the links synapses (src/brain3d.js draws them); here live the data, the filters on the left
     («Explorar»), the search, the reading card on the right (it hides or closes on its own now, the Brain stays open), the
     preview under the cursor and the view's buttons. */
  const ov = document.getElementById('brainOv');
  const SERVED = location.protocol.startsWith('http');
  const stage = document.getElementById('bvStage'), side = document.getElementById('bvSide'), sideBtn = document.getElementById('bvOpenSide');
  const search = document.getElementById('bvSearch'); const chipsEl = document.getElementById('bvChips');
  const pane = document.getElementById('bvPane'); const meta = document.getElementById('bvMeta');
  const tip = document.getElementById('bvTip'), tab = document.getElementById('bvTab'), cnt = document.getElementById('bvCnt');
  let openNow = false, hover = null, sel = null, match = null, regionHi = null, g3 = null, labelsCache = [];
  /* ---------- V4 (24 Sep 2026) filters: folders (only these / all), when, who wrote it, department, no links; a real search ---------- */
  let groups = [];
  const F = (() => { const d = { inc: [], when: 'all', who: 'all', dept: '', conn: 'all', onlyHits: false }; try { const f = { ...d, ...JSON.parse(localStorage.getItem('ao.bv.f') || '{}') }; if (f.lone) f.conn = 'lone'; delete f.lone; return f; } catch { return d; } })();
  let hood = null; // V4.6: { id, depth, set } — only what is near one note (not remembered: it belongs to this visit)
  const saveF = () => { try { localStorage.setItem('ao.bv.f', JSON.stringify(F)); } catch {} };
  const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const colOf = g => GROUP_COL[g] || `hsl(${[...String(g)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 360} 55% 62%)`; // a folder the demo never knew gets its own stable colour
  function refreshGroups() { groups = [...new Set(nodes.map(n => n.g))].sort(); F.inc = F.inc.filter(g => groups.includes(g)); }
  refreshGroups();
  const DAY = 864e5, startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const since = () => F.when === 'today' ? startOfToday() : F.when === 'week' ? Date.now() - 7 * DAY : F.when === 'month' ? Date.now() - 30 * DAY : 0;
  const isOffice = n => n.g === 'Agents Office';
  const passes = (n, skip) => (skip === 'g' || !F.inc.length || F.inc.includes(n.g)) && (!since() || (n.t || 0) * 1000 >= since())
    && (F.who === 'all' || (F.who === 'office') === isOffice(n)) && (!F.dept || n.dep === F.dept) && (F.conn !== 'lone' || !n.d) && (F.conn !== 'hubs' || n.d >= HUB) && (!F.onlyHits || !match || match.has(n.i)) && (!hood || hood.set.has(n.i));
  const HUB = 5; // «centrales»: five links or more
  function setHood(n, depth) { // the notes within `depth` links of n (breadth first)
    if (!n) { hood = null; chips(); dirty(); return; }
    const set = new Set([n.i]); let edge = [n.i];
    for (let d = 0; d < depth; d++) { const next = []; for (const i of edge) for (const j of adj[i]) if (!set.has(j)) { set.add(j); next.push(j); } edge = next; }
    hood = { id: n.id, depth, set }; chips(); dirty(); if (g3) g3.fly(n, depth > 1 ? 2.6 : 2.1);
  }
  const visible = n => passes(n);
  const deptsSeen = () => [...new Set(nodes.map(n => n.dep).filter(Boolean))].sort();
  const row2 = document.getElementById('bvRow2');
  const res = document.createElement('div'); res.id = 'bvRes'; res.hidden = true; res.setAttribute('role', 'listbox'); search.after(res);
  search.setAttribute('aria-controls', 'bvRes'); search.setAttribute('aria-autocomplete', 'list');
  const emptyEl = document.createElement('div'); emptyEl.className = 'bv-none'; emptyEl.hidden = true; emptyEl.innerHTML = 'Nada con estos filtros. <button type="button">Mostrar todo</button>'; ov.appendChild(emptyEl);
  emptyEl.querySelector('button').addEventListener('click', () => resetF());
  function resetF() { Object.assign(F, { inc: [], when: 'all', who: 'all', dept: '', conn: 'all', onlyHits: false }); hood = null; saveF(); chips(); dirty(); }
  let listOpen = false;
  function chips() {
    const n = g => nodes.filter(x => x.g === g && passes(x, 'g')).length;
    // regions: one folder, one lobe of the brain; the first click shows only it, more clicks add, «Todas» brings every one back
    chipsEl.innerHTML = `<button type="button" class="bv-reg all${F.inc.length ? '' : ' on'}" data-g="__all" aria-pressed="${!F.inc.length}"><i class="bv-all"></i><span>Todas las regiones</span><b>${nodes.length}</b></button>` +
      groups.map(g => { const on = F.inc.includes(g); return `<button type="button" class="bv-reg${on ? ' on' : ''}" data-g="${escHTML(g)}" aria-pressed="${on}" title="${on ? 'Quitar del filtro' : F.inc.length ? 'Añadir al filtro' : 'Ver solo esta región'}"><i style="background:${colOf(g)}"></i><span>${escHTML(GROUP_NAME(g))}</span><b>${n(g)}</b></button>`; }).join('');
    const cur = key => (key === 'hd' ? String(hood ? hood.depth : '') : F[key]);
    const seg = (key, opts) => `<span class="bv-seg" role="group">${opts.map(([v, l]) => `<button type="button" data-k="${key}" data-v="${v}" class="${cur(key) === v ? 'on' : ''}" aria-pressed="${cur(key) === v}">${l}</button>`).join('')}</span>`;
    const ds = deptsSeen(), shown = nodes.filter(visible).length, active = F.inc.length || F.when !== 'all' || F.who !== 'all' || F.dept || F.conn !== 'all' || F.onlyHits || hood;
    row2.innerHTML = `<section class="bv-sec"><h3>Cuándo</h3>${seg('when', [['all', 'Siempre'], ['today', 'Hoy'], ['week', '7 días'], ['month', '30 días']])}</section>` +
      `<section class="bv-sec"><h3>De quién</h3>${seg('who', [['all', 'Todo'], ['company', 'Empresa'], ['office', 'Agentes']])}</section>` +
      (ds.length ? `<section class="bv-sec"><h3>Departamento</h3><select class="bv-dept" aria-label="Departamento"><option value="">Todos los departamentos</option>${ds.map(d => `<option${F.dept === d ? ' selected' : ''}>${escHTML(d)}</option>`).join('')}</select></section>` : '') +
      `<section class="bv-sec bv-syn"><h3>Sinapsis</h3><div class="bv-leg"><i class="wiki"></i>Enlaces [[…]] <b>${links.length}</b></div>` +
      `<label class="bv-leg"><input type="checkbox" data-k="ment"${F.ment !== false ? ' checked' : ''}><i class="ment"></i>Menciones sin enlace <b>${extra.length}</b></label>` +
      `<label class="bv-leg" title="Notas que los agentes citaron juntas en trabajo que aprobaste: se refuerzan; lo devuelto las debilita; sin uso, se apagan en unos meses"><input type="checkbox" data-k="learn"${F.learn !== false ? ' checked' : ''}><i class="learn"></i>Reforzadas por tu trabajo aprobado <b>${learnedLinks.length}</b></label></section>` +
      `<section class="bv-sec"><h3>Conexiones</h3>${seg('conn', [['all', 'Todas'], ['hubs', `Centrales ${nodes.filter(x => x.d >= HUB).length}`], ['lone', `Sueltas ${nodes.filter(x => !x.d).length}`]])}</section>` +
      (hood ? `<section class="bv-sec bv-hood"><h3>Vecindario</h3><div class="bv-hoodc"><span>Lo que está a ${hood.depth} ${hood.depth === 1 ? 'salto' : 'saltos'} de <b>${escHTML(hood.id)}</b></span><button type="button" class="bv-hoodx" aria-label="Quitar el vecindario" title="Quitar el vecindario">✕</button></div>${seg('hd', [['1', '1 salto'], ['2', '2 saltos'], ['3', '3 saltos']])}</section>` : '') +
      (match ? `<section class="bv-sec bv-tgs"><label class="bv-tg"><input type="checkbox" data-k="onlyHits"${F.onlyHits ? ' checked' : ''}> Solo lo que encontré</label></section>` : '') +
      (active ? '<button type="button" class="bv-reset">↺ Limpiar filtros</button>' : '') +
      (SERVED ? '<section class="bv-sec bv-tools"><h3>Herramientas</h3><button type="button" class="bv-tool bv-up" title="Un PDF, un Word, un Excel o un CSV se vuelve una nota que todos los agentes leen (también puedes soltarlo encima del Cerebro)">⬆ Subir documento</button><button type="button" class="bv-tool bv-stale" title="Las notas que pueden estar viejas: los agentes las leen con un aviso">⏳ Notas por revisar</button><button type="button" class="bv-tool bv-bin" title="Las notas que mandaste a la papelera: vuelven con un clic durante 30 días">🗑 Papelera</button></section>' : '') +
      `<details class="bv-sec bv-list"${listOpen ? ' open' : ''}><summary>Lista de notas <b>${shown}</b></summary><div class="bv-lst">${listOpen ? listHTML() : ''}</div></details>`;
    cnt.textContent = `${shown} de ${nodes.length}`;
    emptyEl.hidden = !(openNow && shown === 0);
  }
  // the notes as a list: the same brain for the keyboard and for screen readers (the 3D canvas is a picture to them)
  function listHTML() { const l = nodes.filter(visible).sort((a, b) => a.id.localeCompare(b.id, 'es')); return l.slice(0, 400).map(n => `<button type="button" class="bv-li${n === sel ? ' on' : ''}" data-i="${n.i}"><i style="background:${colOf(n.g)}"></i>${escHTML(n.id)}</button>`).join('') + (l.length > 400 ? `<p class="bv-hmore">+${l.length - 400} más: busca o filtra</p>` : ''); }
  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('.bv-reg'); if (!b) return;
    const g = b.dataset.g;
    if (g === '__all') F.inc = []; else F.inc = F.inc.includes(g) ? F.inc.filter(x => x !== g) : [...F.inc, g];
    saveF(); regionHi = null; chips(); dirty();
  });
  // a region under the pointer lights up in the brain
  chipsEl.addEventListener('pointerover', e => { const b = e.target.closest('.bv-reg'); const g = b && b.dataset.g !== '__all' ? b.dataset.g : null; if (g !== regionHi) { regionHi = g; dirty(); } });
  chipsEl.addEventListener('pointerleave', () => { if (regionHi) { regionHi = null; dirty(); } });
  row2.addEventListener('click', e => {
    if (e.target.closest('.bv-bin')) return showBin();
    if (e.target.closest('.bv-up')) return showUpload();
    if (e.target.closest('.bv-stale')) return showStale();
    if (e.target.closest('.bv-reset')) return resetF();
    const li = e.target.closest('.bv-li'); if (li) { const n = nodes[+li.dataset.i]; if (n) { select(n); centre(n); } return; }
    if (e.target.closest('.bv-hoodx')) return setHood(null);
    const b = e.target.closest('button[data-k]'); if (!b) return;
    if (b.dataset.k === 'hd') { const n = hood && nodes[byId.get(hood.id)]; if (n) setHood(n, +b.dataset.v); return; }
    F[b.dataset.k] = b.dataset.v; saveF(); chips(); dirty();
  });
  row2.addEventListener('toggle', e => { if (!e.target.classList.contains('bv-list')) return; listOpen = e.target.open; if (listOpen) e.target.querySelector('.bv-lst').innerHTML = listHTML(); }, true);
  row2.addEventListener('change', e => {
    if (e.target.classList.contains('bv-dept')) F.dept = e.target.value;
    else if (e.target.dataset.k) F[e.target.dataset.k] = e.target.checked;
    if (g3 && (e.target.dataset.k === 'ment' || e.target.dataset.k === 'learn')) g3.setLayers(F.ment !== false, F.learn !== false);
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
    else if (SERVED) { sel = null; dirty(); setPane(`<h3>${esc(name)}</h3><div class="bv-path">fuera del grafo</div><div class="bv-note"><div class="bv-loading">Abriendo la nota…</div></div>`, { reading: true }); // a note the graph does not draw: read it anyway
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

  /* ---------- the 3D view: made the first time the Brain opens, fed by the data and the focus kept here ---------- */
  const phone = () => innerWidth <= 760;
  function computeLabels() { // which names show: the focus and its neighbours, the search's hits, a region under the pointer, else the hubs
    const out = new Set(), vis = n => n && visible(n), f = hover || sel;
    if (sel) out.add(sel); if (hover) out.add(hover);
    if (f) [...adj[f.i]].map(i => nodes[i]).filter(vis).sort((a, b) => b.d - a.d).slice(0, 12).forEach(n => out.add(n));
    if (regionHi) nodes.filter(n => n.g === regionHi && vis(n)).sort((a, b) => b.d - a.d).slice(0, 10).forEach(n => out.add(n));
    if (match) [...match].map(i => nodes[i]).filter(vis).sort((a, b) => b.d - a.d).slice(0, 24).forEach(n => out.add(n));
    if (!f && !match && !regionHi) { nodes.filter(vis).sort((a, b) => b.d - a.d).slice(0, phone() ? 6 : 12).forEach(n => out.add(n)); nodes.filter(n => n.fresh && vis(n)).slice(0, 6).forEach(n => out.add(n)); }
    return [...out].filter(vis);
  }
  function dirty() { // the filters, the search or the focus changed: repaint the brain (not every frame)
    if (!g3) return;
    labelsCache = computeLabels();
    g3.setFocus(sel, hover, regionHi ? new Set(nodes.filter(n => n.g === regionHi).map(n => n.i)) : match);
  }
  function make3D() {
    if (g3) return g3;
    try {
      g3 = initBrain3D({ host: stage, colOf, visible, labelsFor: () => labelsCache, recent: recentIdx,
        onPick: n => { select(n); centre(n); },
        onHover: (n, x, y) => showTip(n, x, y) });
      g3.setData(nodes, links, { extra, learned: learnedLinks }); g3.setLayers(F.ment !== false, F.learn !== false);
    } catch (e) { stage.innerHTML = `<p class="bv-err bv-nogl">No pude dibujar el Cerebro en 3D en este navegador (${esc(e.message)}). La búsqueda y la lista de notas de la izquierda siguen funcionando.</p>`; g3 = null; }
    return g3;
  }
  function recentIdx() { // the notes the agents read or wrote in the last 24 hours
    const since = Date.now() - DAY, out = [];
    for (const m of [state.reads, state.written]) for (const [id, r] of m) if (r.ts >= since && byId.has(id)) out.push(byId.get(id));
    return out;
  }
  function graphChanged() { if (g3) { g3.setData(nodes, links, { extra, learned: learnedLinks }); dirty(); } }
  function insets() { // the filters on the left and the card on the right: the brain sits in the room between them
    if (!g3) return;
    const l = !phone() && !side.classList.contains('folded') ? side.offsetWidth + 16 : 0, r = !phone() && !pane.hidden ? pane.offsetWidth + 22 : 0, b = phone() && !pane.hidden ? pane.offsetHeight : 0;
    g3.setInsets(l, r, b);
  }
  function centre(n) { if (g3) g3.fly(n); }
  // the preview under the pointer: its region, links, date and its first lines (asked once, then remembered)
  const peeks = new Map(); let peekT = 0;
  const dateOf = t => t ? new Date(t * 1000).toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  function showTip(n, x, y) {
    if (n !== hover) { hover = n; dirty(); }
    if (!n) { tip.hidden = true; return; }
    const pk = peeks.get(n.id);
    tip.innerHTML = `<b>${esc(n.id)}</b><span class="bv-tp"><i style="background:${colOf(n.g)}"></i>${esc(GROUP_NAME(n.g))} · ${n.d} enlace${n.d === 1 ? '' : 's'}${n.t ? ' · ' + dateOf(n.t) : ''}${n.fresh ? ' · <em>nueva hoy</em>' : ''}</span>` +
      (SERVED ? `<span class="bv-tx">${pk === undefined ? 'Leyendo…' : pk ? esc(pk) : '<em>(vacía)</em>'}</span>` : '') + '<span class="bv-th">Clic para leerla</span>';
    tip.hidden = false;
    const W = ov.clientWidth, H = ov.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(x + 18, W - tw - 8)) + 'px'; tip.style.top = Math.max(8, Math.min(y + 18, H - th - 8)) + 'px';
    if (SERVED && pk === undefined) { clearTimeout(peekT); peekT = setTimeout(() => fetch('/api/note?peek=1&id=' + encodeURIComponent(n.id)).then(r => r.json()).then(j => { peeks.set(n.id, j.peek || ''); if (hover === n) showTip(n, x, y); }).catch(() => peeks.set(n.id, '')), 140); }
  }
  // the view's buttons: centre, turn by itself, closer, farther
  ov.querySelector('.bv-ctl').addEventListener('click', e => {
    const b = e.target.closest('button[data-c]'); if (!b || !g3) return;
    const c = b.dataset.c;
    if (c === 'reset') g3.reset(); else if (c === 'in') g3.zoomBy(0.78); else if (c === 'out') g3.zoomBy(1.28);
    else if (c === 'spin') { const on = g3.spin(); b.setAttribute('aria-pressed', on); b.title = on ? 'Dejar de girar' : 'Girar solo'; b.innerHTML = on ? PAUSE : PLAY; try { localStorage.setItem('ao.bv.spin', on ? '1' : '0'); } catch {} }
  });
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z"/></svg>';
  // the panel on the left folds away (remembered); on a phone it opens over the brain
  function setSide(open) { side.classList.toggle('folded', !open); sideBtn.setAttribute('aria-expanded', open); try { if (!phone()) localStorage.setItem('ao.bv.side', open ? '1' : '0'); } catch {} requestAnimationFrame(insets); }
  side.querySelector('.bv-fold').addEventListener('click', () => { setSide(false); sideBtn.focus(); });
  sideBtn.addEventListener('click', () => { setSide(true); search.focus({ preventScroll: true }); });

  /* ---------- the reading card on the right: it hides (the note stays marked, a tab brings it back) or closes, and the Brain stays ---------- */
  let reading = false, readSeq = 0, paneOn = 'closed';
  const PANE_HEAD = '<div class="bv-ph"><span class="sp"></span><button type="button" class="bv-pfold" aria-label="Ocultar la ficha" title="Ocultar la ficha: la nota sigue marcada; vuelve con la pestaña del borde">⟩</button><button type="button" class="bv-pclose" aria-label="Cerrar la ficha" title="Cerrar la ficha (Esc)">✕</button></div>';
  function setPane(html, { reading: r = false } = {}) { pane.innerHTML = PANE_HEAD + `<div class="bv-pb">${html}</div>`; reading = r; pane.classList.toggle('reading', r); pane.hidden = false; tab.hidden = true; paneOn = 'open'; pane.scrollTop = 0; requestAnimationFrame(insets); }
  function closePane() { const had = sel; pane.hidden = true; tab.hidden = true; paneOn = 'closed'; reading = false; pane.classList.remove('reading'); sel = null; if (had) { dirty(); if (listOpen) chips(); } requestAnimationFrame(insets); }
  function foldPane() { if (paneOn !== 'open') return; const t = pane.querySelector('h3'); pane.hidden = true; paneOn = 'folded'; tab.hidden = false; tab.innerHTML = `<span>${esc(t ? t.textContent : 'La ficha')}</span>`; tab.title = 'Volver a la ficha'; requestAnimationFrame(insets); tab.focus({ preventScroll: true }); }
  function unfoldPane() { pane.hidden = false; tab.hidden = true; paneOn = 'open'; requestAnimationFrame(insets); pane.querySelector('.bv-pfold')?.focus({ preventScroll: true }); }
  tab.addEventListener('click', unfoldPane);
  pane.addEventListener('click', e => { if (e.target.closest('.bv-pclose')) closePane(); else if (e.target.closest('.bv-pfold')) foldPane(); else if (e.target.closest('.bv-near') && sel) setHood(sel, 2); });
  // front matter → the little facts line (who wrote it, when, with what)
  function frontFacts(text) {
    const m = /^---\n([\s\S]*?)\n---/.exec(String(text).replace(/\r\n?/g, '\n')); if (!m) return '';
    const f = Object.fromEntries(m[1].split('\n').map(l => /^([\w-]+):\s*(.*)$/.exec(l)).filter(Boolean).map(x => [x[1], x[2].trim()])); // split at the FIRST colon: «done: 2026-…T05:15:54Z»
    const when = f.done ? new Date(f.done).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const bits = [f.agent && `Escrito por <b>${escHTML(f.agent)}</b>`, f.department && escHTML(f.department), when, f.model && `modelo ${escHTML(f.model)}`, f.tools && `usó ${escHTML(f.tools)}`, f.approved && 'aprobado por ti'].filter(Boolean);
    return bits.length ? `<div class="bv-facts">${bits.join(' · ')}</div>` : '';
  }
  function select(n) {
    sel = n; tip.hidden = true; dirty(); if (listOpen) chips();
    const out = [...adj[n.i]].map(i => nodes[i]).sort((a, b) => b.d - a.d);
    const rd = state.reads.get(n.id);
    const linksHTML = `<div class="bv-lab">Conectada con · ${out.length}</div>` + out.slice(0, 18).map(o => `<button type="button" class="bv-lk" data-i="${o.i}"><i style="background:${colOf(o.g)}"></i>${esc(o.id)}</button>`).join('') +
      (out.length > 18 ? `<button type="button" class="bv-more" data-all="1">+${out.length - 18} más: verlas todas</button>` : ''); // V4.1 (audit 64): it opens the rest
    const men = [...(adjM[n.i] || [])].map(i => nodes[i]).filter(Boolean);
    const learnt = n.w == null ? '' : n.w > 0.56 ? '<div class="bv-learn up">Sinapsis reforzada: los agentes la citaron en trabajo que aprobaste.</div>' : n.w < 0.44 ? '<div class="bv-learn down">Sinapsis debilitada: salió en trabajo devuelto o leído sin usar.</div>' : '';
    setPane(`<h3>${esc(n.id)}</h3><div class="bv-path"><i style="background:${colOf(n.g)}"></i>${esc(GROUP_NAME(n.g))} · ${n.d} enlace${n.d === 1 ? '' : 's'}${men.length ? ` · ${men.length} mención${men.length === 1 ? '' : 'es'}` : ''}${n.fresh ? ' · <span class="bv-g">nueva hoy</span>' : ''}</div>` + learnt +
      (rd ? `<div class="bv-lab">Última lectura por</div><p>${esc(rd.agent)} · ${timeStr(rd.ts)}</p>` : '') +
      `<div class="bv-pacts"><button type="button" class="bv-btn bv-near" title="Deja a la vista solo esta nota y lo que está a uno o dos enlaces">◎ Solo su vecindario</button></div>` +
      (SERVED ? '<div class="bv-note" aria-live="polite"><div class="bv-loading">Abriendo la nota…</div></div>' : '') + `<div class="bv-links">${linksHTML}${men.length ? `<div class="bv-lab">Menciones sin enlace · ${men.length}</div>` + men.slice(0, 12).map(o => `<button type="button" class="bv-lk ment" data-i="${o.i}"><i style="background:${colOf(o.g)}"></i>${esc(o.id)}</button>`).join('') : ''}</div>`, { reading: SERVED });
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
  // V4.4 (audit E9, H3): documents into the Brain — a PDF, Word, Excel, CSV or text file becomes a note in Documentos/,
  // converted on this machine; and the notes that may be out of date, to check
  async function showUpload(files) {
    sel = null; dirty();
    setPane(`<h3>Subir documentos</h3><div class="bv-path">PDF, Word (.docx), Excel (.xlsx), CSV o texto · hasta 15 MB · se convierte aquí, nada sale de tu máquina</div>
      <label class="bv-drop"><input type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,.html" class="sr"><b>Elige archivos</b> o suéltalos aquí</label>
      <ul class="bv-ups" aria-live="polite"></ul>`);
    const inp = pane.querySelector('input[type=file]'); inp.addEventListener('change', () => upload([...inp.files]));
    if (files && files.length) upload(files);
  }
  async function showStale() {
    sel = null; dirty();
    setPane('<h3>Notas por revisar</h3><div class="bv-loading">Buscando…</div>');
    try {
      const j = await (await fetch('/api/brain/stale')).json(), l = j.notes || [];
      setPane(`<h3>Notas por revisar</h3><div class="bv-path">${l.length} ${l.length === 1 ? 'nota' : 'notas'} · los agentes las leen con un aviso de que pueden estar viejas</div>` +
        (l.length ? `<ul class="bv-stl">${l.slice(0, 40).map(n => `<li><button type="button" class="bv-link" data-n="${esc(n.name)}">${esc(n.name)}</button> <small>${esc(n.why)}</small></li>`).join('')}</ul>` : '<div class="bv-empty">Todo al día.</div>'));
    } catch (e) { setPane(`<h3>Notas por revisar</h3><p class="bv-err">No pude leerlas: ${esc(e.message)}</p>`); }
  }
  async function upload(files) {
    const list = pane.querySelector('.bv-ups'); if (!list) return;
    for (const f of files) {
      const li = document.createElement('li'); li.textContent = `${f.name} · leyendo…`; list.appendChild(li);
      if (f.size > 15 * 1024 * 1024) { li.textContent = `${f.name} · pasa de 15 MB`; li.className = 'bad'; continue; }
      try {
        const data = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => ko(new Error('no se pudo leer')); r.readAsDataURL(f); });
        const r = await fetch('/api/brain/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: f.name, data }) }); const j = await r.json();
        if (!r.ok) throw new Error(j.error || r.statusText);
        li.innerHTML = `✓ ${esc(f.name)} → <button type="button" class="bv-link" data-n="${esc(j.note)}">${esc(j.note)}</button> <small>${Math.round(j.chars / 1000)} mil caracteres</small>`; li.className = 'good';
      } catch (e) { li.textContent = `${f.name} · ${e.message}`; li.className = 'bad'; }
    }
  }
  pane.addEventListener('click', e => { const b = e.target.closest('.bv-link[data-n]'); if (b) openHit(b.dataset.n); });
  ov.addEventListener('dragover', e => { if (SERVED && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); ov.classList.add('dropping'); } });
  ov.addEventListener('dragleave', e => { if (e.target === ov || !ov.contains(e.relatedTarget)) ov.classList.remove('dropping'); });
  ov.addEventListener('drop', e => { if (!SERVED || !e.dataTransfer?.files?.length) return; e.preventDefault(); ov.classList.remove('dropping'); showUpload([...e.dataTransfer.files]); });
  // V4.1 (audit 63): the bin has its own view — «Deshacer» no longer vanishes with the next click: every note thrown away stays here 30 days
  async function showBin() {
    sel = null; dirty();
    setPane('<h3>Papelera</h3><div class="bv-loading">Abriendo la papelera…</div>');
    try {
      const r = await fetch('/api/note/trash'); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      const day = ts => new Date(ts).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      setPane(`<h3>Papelera</h3><div class="bv-path">${j.items.length} ${j.items.length === 1 ? 'nota' : 'notas'} · se quedan ${j.keepDays} días y luego se borran solas</div>` +
        (j.items.length ? `<div class="bv-bins">${j.items.map(it => `<div class="bv-binrow"><div><b>${esc(it.name)}</b><small>a la papelera el ${esc(day(it.at))}</small></div><button type="button" class="bv-btn bv-restore" data-file="${esc(it.file)}">Restaurar</button></div>`).join('')}</div>`
          : '<div class="bv-empty">La papelera está vacía.</div>'));
    } catch (e) { setPane(`<h3>Papelera</h3><p class="bv-err">No pude abrirla: ${esc(e.message)}</p>`); }
  }
  pane.addEventListener('click', async e => {
    const b = e.target.closest('.bv-restore'); if (!b) return;
    b.disabled = true; b.textContent = 'Restaurando…';
    try {
      const r = await fetch('/api/note/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: b.dataset.file }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      setGraph(j.graph); const i = byId.get(j.name); if (i != null) { select(nodes[i]); centre(nodes[i]); } else showBin();
    } catch (err) { b.disabled = false; b.textContent = 'Restaurar'; b.insertAdjacentHTML('afterend', `<small class="bv-err"> ${esc(err.message)}</small>`); }
  });
  async function trash(id, btn) {
    if (!confirm(`¿Mover «${id}» a la papelera?\n\nVa a «Agents Office/.papelera» dentro del cerebro: sale del grafo y los agentes dejan de leerla. Puedes deshacerlo.`)) return;
    btn.disabled = true; btn.textContent = 'Moviendo…';
    try {
      const r = await fetch('/api/note/trash', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'error');
      sel = null;
      setPane(`<div class="bv-undo"><h3>En la papelera</h3><p>«${esc(id)}» está en la papelera.</p><button type="button" class="bv-btn">Deshacer</button></div>`);
      pane.querySelector('.bv-undo button').addEventListener('click', async e => {
        e.currentTarget.disabled = true;
        try { const r2 = await fetch('/api/note/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: j.trashed }) }); const j2 = await r2.json(); if (!r2.ok) throw new Error(j2.error); closePane(); setGraph(j2.graph); const b = byId.get(j2.name); if (b != null) select(nodes[b]); }
        catch (err) { setPane(`<p class="bv-err">No pude restaurarla: ${esc(err.message)}</p>`); }
      });
      setGraph(j.graph);
    } catch (e) { btn.disabled = false; btn.textContent = 'Mover a la papelera'; alert('No se pudo mover: ' + e.message); }
  }
  pane.addEventListener('click', e => { // links inside the pane: the neighbour list and the [[wiki]] links in the text
    const lk = e.target.closest('.bv-lk'); if (lk) { const t = nodes[+lk.dataset.i]; if (t) { select(t); centre(t); } return; }
    const more = e.target.closest('.bv-more[data-all]'); if (more && sel) { const rest = [...adj[sel.i]].map(i => nodes[i]).sort((a, b) => b.d - a.d).slice(18); more.insertAdjacentHTML('beforebegin', rest.map(o => `<button type="button" class="bv-lk" data-i="${o.i}"><i style="background:${colOf(o.g)}"></i>${esc(o.id)}</button>`).join('')); const next = more.previousElementSibling; more.remove(); if (next) next.focus({ preventScroll: true }); return; }
    const w = e.target.closest('.md-wiki'); if (w) { const i = byId.get(w.dataset.note); if (i != null) { select(nodes[i]); centre(nodes[i]); } else { w.classList.add('missing'); w.setAttribute('aria-disabled', 'true'); w.title = 'Esa nota no está en el Cerebro: se borró, se renombró o está fuera de las carpetas que lee la oficina'; if (!w.nextElementSibling || !w.nextElementSibling.classList.contains('md-miss')) w.insertAdjacentHTML('afterend', '<span class="md-miss" role="note"> (no está en el grafo)</span>'); } }
  });
  pane.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.md-wiki')) { e.preventDefault(); e.target.click(); } });
  let owner = PROFILE && PROFILE.company ? String(PROFILE.company).toUpperCase() : 'TUS NOTAS'; // V3.1: the business name when served (was hard-coded to one company); INDUSTRY PROFILE: the demo company
  const metaText = () => `${owner} · ${state.notes.toLocaleString('es-PA')} NOTAS · ${links.length} ENLACES`;
  function setOwner(name) { owner = String(name || 'TUS NOTAS').toUpperCase(); if (openNow) meta.textContent = metaText(); }
  let opener = null;
  function open() {
    if (openNow) return;
    views.opening('brain'); openNow = true; opener = document.activeElement; ov.inert = false; modal.open(ov); ov.classList.add('on'); document.body.classList.add('brainOpen');
    meta.textContent = metaText();
    let sideOpen = !phone(); try { const v = localStorage.getItem('ao.bv.side'); if (!phone() && v) sideOpen = v === '1'; } catch {}
    setSide(sideOpen);
    chips();
    if (make3D()) {
      let spin = true; try { spin = localStorage.getItem('ao.bv.spin') !== '0'; } catch {}
      const on = g3.spin(spin), b = ov.querySelector('.bv-ctl [data-c="spin"]'); b.setAttribute('aria-pressed', on); b.innerHTML = on ? PAUSE : PLAY; b.title = on ? 'Dejar de girar' : 'Girar solo';
      g3.start(); dirty(); insets();
    }
    setTimeout(() => { if (openNow) document.getElementById('bvClose').focus({ preventScroll: true }); }, 50); // focus inside the view, but not the search box: G/Esc must still close it
  }
  function close(o = {}) { if (!openNow) return; openNow = false; if (g3) g3.stop(); hover = null; tip.hidden = true; modal.close(ov); ov.inert = true; emptyEl.hidden = true; res.hidden = true; ov.classList.remove('on'); document.body.classList.remove('brainOpen'); if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  views.add('brain', { isOpen: () => openNow, close });
  function toggle() { openNow ? close() : open(); }
  // Esc, one step at a time: the search's list, the card, the panel over a phone — and only then the Brain
  function back() {
    if (!res.hidden) { res.hidden = true; return true; }
    if (paneOn !== 'closed') { closePane(); return true; }
    if (phone() && !side.classList.contains('folded')) { setSide(false); return true; }
    return false;
  }
  document.getElementById('bvClose').addEventListener('click', () => close());
  ov.addEventListener('keydown', e => {
    if (!g3 || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.closest('.bv-pane, .bv-side')) return;
    const k = e.key, step = e.shiftKey ? 0.35 : 0.12;
    if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); g3.rotateBy(k === 'ArrowLeft' ? -step : step, 0); }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); g3.rotateBy(0, k === 'ArrowUp' ? -step : step); }
    else if (k === '+' || k === '=') g3.zoomBy(0.8); else if (k === '-' || k === '_') g3.zoomBy(1.25); else if (k === '0') g3.reset();
    else if (k === ' ' && !/^(BUTTON|SUMMARY|A)$/.test(e.target.tagName)) { e.preventDefault(); ov.querySelector('.bv-ctl [data-c="spin"]').click(); }
  });
  ov.inert = true; // closed: out of Tab's reach and of screen readers (it stays in the page, faded out)
  addEventListener('resize', () => { if (openNow) requestAnimationFrame(insets); });

  function setTheme(dark) { INK = dark ? '236,234,227' : '21,20,20'; }
  function show(id) { const i = byId.get(id); if (i == null) return false; open(); select(nodes[i]); centre(nodes[i]); return true; } // open the Brain on one note (a [[link]] in the chat)
  return { show, read, readNote, write, setGraph, setTheme, setOwner, setQuiet, open, close, back, toggle, isOpen: () => openNow, state,
    selection: () => (openNow ? { view: 'brain', label: sel ? `Nota «${sel.id}»` : 'El Cerebro', kind: sel ? 'note' : null, ...(sel ? { id: sel.id } : {}) } : null), // V4.8: what Dimitri sees beside it
    get nodes() { return nodes; }, get links() { return links; } };
}
