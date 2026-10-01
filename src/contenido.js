// Agents Office V4.7 (30 sep 2026) — CONTENIDO (K, o el calendario con una foto en la barra): lo que se va a publicar en Instagram y Facebook.
// Dos modos de una misma vista, que comparten el panel de la pieza:
//   CALENDARIO — cada pieza en su día y su hora, con el motor del calendario de tareas (calendar-core.js): mes, semana, día y agenda; se arrastra
//                una pieza a otro día, se hace clic en un día para escribir una nueva, y a un lado esperan las ideas sin día.
//   PROGRAMACIÓN — lo operativo, en listas: lo que espera tu visto bueno, los borradores, lo aprobado. (La entrega a Meta llega en la fase siguiente:
//                hoy lo aprobado queda listo aquí y no sale a ninguna parte.)
// Los agentes dejan borradores (contenido-mcp.mjs); solo el dueño aprueba, y solo lo aprobado puede salir.
//   initContenido({ served, esc, agentName, openStudio, business }) → { open, close, toggle, isOpen, openPiece(id), refresh, week(range) }
import { modal } from './modal.js';
import { views } from './views.js';
import { DOW, MONTHS, DAY, ymd, hm, startOfDay, fmtDay, rangeOf, stepAnchor, titleHTML, dowHTML, monthHTML, timeGridHTML, agendaHTML, fitMonth } from './calendar-core.js';
import { attachDnd } from './calendar-dnd.js';
import { crearDatos } from './contenido-datos.js';
import { initPieza, ESTADO, FORMATO, RED, thumbHTML } from './pieza.js';
import { revisarPublicacion, postDePieza } from './contenido-reglas.js';

const ORDEN = ['idea', 'borrador', 'revision', 'aprobada'];
const store = { get(k, d) { try { const v = localStorage.getItem('ao.ct.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('ao.ct.' + k, JSON.stringify(v)); } catch {} } };
const at = p => { if (!p.fecha) return 0; const [h, m] = (p.hora || '23:59').split(':').map(Number); return new Date(`${p.fecha}T00:00:00`).setHours(h, m, p.hora ? 0 : 59, 0); }; // sin hora, al final del día
const redes = p => p.redes.map(r => `<b class="pz-nb">${RED[r]?.short || r}</b>`).join('');

export function initContenido({ served, esc, agentName = id => id, openStudio = () => {}, business = () => '' }) {
  const datos = crearDatos({ served });
  const ov = document.createElement('div');
  ov.id = 'ctOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('data-view', ''); ov.setAttribute('aria-label', 'Contenido'); ov.inert = true;
  ov.innerHTML = `
    <div class="cv-band">
      <div class="cv-brand">CONTENIDO <small id="ctCo"></small></div>
      <div class="cv-seg ct-mode" role="group" aria-label="Qué ver"><button type="button" data-m="cal" aria-pressed="true">CALENDARIO</button><button type="button" data-m="prog" aria-pressed="false">PROGRAMACIÓN <b class="ct-n" hidden></b></button></div>
      <div class="cv-seg ct-views" role="group" aria-label="Vista del calendario"><button type="button" data-v="agenda">AGENDA</button><button type="button" data-v="day">DÍA</button><button type="button" data-v="week">SEMANA</button><button type="button" data-v="month" class="on">MES</button></div>
      <div class="cv-nav"><button id="ctPrev" type="button" aria-label="Anterior" title="anterior (←)">‹</button><div id="ctTitle"></div><button id="ctNext" type="button" aria-label="Siguiente" title="siguiente (→)">›</button><button id="ctToday" type="button" title="hoy (T)">HOY</button></div>
      <div class="cv-sp"></div>
      <button id="ctKeys" type="button" aria-label="Atajos" title="atajos (?)">?</button>
      <button id="ctClose" type="button" aria-label="Cerrar Contenido" title="cerrar (Esc · K)">✕</button>
    </div>
    <div class="cv-tools"><button type="button" class="cv-railbtn" data-rail aria-expanded="false">Ideas</button>
      <div class="cv-sw"><input id="ctSearch" type="search" placeholder="Buscar en las piezas…" autocomplete="off" spellcheck="false" aria-label="Buscar en las piezas de contenido"></div>
      <div id="ctChips" role="group" aria-label="Filtros"></div><div class="cv-sp"></div><div class="cv-stats" id="ctStats" role="status"></div></div>
    <div class="cv-body">
      <aside class="cv-rail" aria-label="Ideas y piezas por revisar"><div class="ct-rail"></div></aside>
      <div class="cv-wrap"><div class="cv-dow" id="ctDow"></div><div class="cv-grid month" id="ctGrid"></div></div>
      <div class="ct-prog" hidden></div>
      <aside class="ct-panel" hidden></aside>
    </div>
    <div class="cv-toast" hidden role="status"><span></span><button type="button">DESHACER</button></div>
    <div id="ctPop" hidden></div>`;
  document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  const E = { title: $('#ctTitle'), dow: $('#ctDow'), grid: $('#ctGrid'), chips: $('#ctChips'), stats: $('#ctStats'), search: $('#ctSearch'), rail: $('.ct-rail'), prog: $('.ct-prog'), wrap: $('.cv-wrap'), panelHost: $('.ct-panel'), pop: $('#ctPop'), toast: $('.cv-toast'), views: $('.ct-views'), mode: $('.ct-mode') };
  const narrow = () => matchMedia('(max-width: 760px)').matches;
  let tgKey = '', tgScroll = 0; // which week or day the time grid shows, and where it was scrolled to (a re-render keeps it), as in the tasks calendar
  let openNow = false, mode = 'cal', view = 'month', anchor = startOfDay(Date.now()), q = '', pieces = [], resumen = null, loadedKey = '', errorMsg = '', timer = null, opener = null, dnd = null;
  let estadoOn = new Set(store.get('estados', ORDEN)), redOn = new Set(store.get('redes', Object.keys(RED)));
  const gone = new Set(); let undoT = null, commitFn = null, noteT = null;

  /* ---------- avisos y deshacer (el mismo gesto que el calendario de tareas: se va al momento, con 8 segundos para volver) ---------- */
  function note(msg, bad) { if (commitFn) return; E.toast.querySelector('span').textContent = msg; E.toast.querySelector('button').hidden = true; E.toast.classList.toggle('bad', !!bad); E.toast.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { if (!commitFn) E.toast.hidden = true; }, bad ? 7000 : 4500); }
  function flushUndo() { clearTimeout(undoT); undoT = null; E.toast.hidden = true; const f = commitFn; commitFn = null; if (f) f(); }
  function later(key, label, commit) {
    flushUndo(); gone.add(key); render();
    commitFn = async () => { try { await commit(); } catch (e) { note('No se pudo: ' + e.message, true); } gone.delete(key); load(true); };
    E.toast.querySelector('span').textContent = label; E.toast.querySelector('button').hidden = false; E.toast.classList.remove('bad'); clearTimeout(noteT); E.toast.hidden = false;
    E.toast.querySelector('button').onclick = () => { clearTimeout(undoT); commitFn = null; E.toast.hidden = true; gone.delete(key); render(); note('Deshecho.'); };
    undoT = setTimeout(flushUndo, 8000);
  }

  /* ---------- cargar ---------- */
  const range = () => rangeOf(view, anchor, 1);
  function want() { const r = range(); const a = new Date(r.from - 7 * DAY), b = new Date(r.to + 7 * DAY); return { desde: ymd(a), hasta: ymd(b) }; }
  async function load(force = false) {
    const w = want(), key = `${w.desde}|${w.hasta}`;
    if (!force && key === loadedKey && pieces.length) return;
    try { const r = await datos.list({ ...w, sinFecha: true }); pieces = r.piezas || []; resumen = r.resumen || resumen; loadedKey = key; errorMsg = ''; }
    catch (e) { errorMsg = e.message || 'No pude leer las piezas'; }
    if (openNow) render(); paintDock();
  }

  /* ---------- qué se ve ---------- */
  const visible = p => !gone.has('p:' + p.id) && estadoOn.has(p.estado) && p.redes.some(r => redOn.has(r)) && (!q || `${p.titulo} ${p.texto} ${p.hashtags} ${p.notas}`.toLowerCase().includes(q));
  const chipOf = p => (ESTADO[p.estado] || ESTADO.borrador).color;
  const titleOf = p => p.titulo || (p.texto || '').split('\n')[0].slice(0, 60) || 'Sin título';
  function eventsByDay() {
    const by = {};
    for (const p of pieces.filter(p => p.fecha && visible(p))) (by[p.fecha] ||= []).push({ kind: 'pz', at: at(p), p, title: titleOf(p) });
    for (const k in by) by[k].sort((a, b) => a.at - b.at);
    return by;
  }
  const errN = p => (p.revision?.errores || []).length;
  function card(ev, line) {
    const p = ev.p, e = ESTADO[p.estado] || ESTADO.borrador, sel = panel.current()?.id === p.id;
    const meta = `${p.hora || 'sin hora'} · ${p.redes.map(r => RED[r]?.short).join('+')} · ${FORMATO[p.formato]}`;
    const tip = `${titleOf(p)} · ${e.name.toLowerCase()} · ${meta}${errN(p) ? ' · le falta: ' + p.revision.errores[0] : ''}${p.cambiadaTrasAprobar ? ' · cambió después de aprobarla' : ''} · arrástrala a otro día`;
    if (line) return `<div class="cv-ev line pz pz-${p.estado}${errN(p) && p.estado !== 'idea' ? ' pz-falta' : ''}${sel ? ' sel' : ''}" data-ev="p:${esc(p.id)}" style="--chip:${e.color}" title="${esc(tip)}" draggable="true" role="button" tabindex="0"><span class="cv-ev-h">${esc(p.hora || '—')}</span><span class="cv-ev-t"><span class="pz-g" aria-hidden="true">${e.glyph}</span>${errN(p) && p.estado !== 'idea' ? '<span class="pz-warn" title="Le falta algo para poder salir">!</span>' : ''}${esc(titleOf(p))}</span></div>`;
    return `<div class="cv-ev pz pz-${p.estado}${errN(p) && p.estado !== 'idea' ? ' pz-falta' : ''}${sel ? ' sel' : ''}" data-ev="p:${esc(p.id)}" style="--chip:${e.color}" title="${esc(tip)}" draggable="true" role="button" tabindex="0">
      <div class="pz-cardrow">${p.medios[0] ? thumbHTML(p.medios[0], esc, 'pz-ct') : ''}<div class="pz-cardmain"><div class="cv-ev-t">${esc(titleOf(p))}</div><div class="cv-ev-m"><span>${esc(meta)}</span></div><div class="pz-cardst"><b class="pz-tone" style="--c:${e.color};--cd:${e.dark}"><i aria-hidden="true">${e.glyph}</i> ${e.name}${p.cambiadaTrasAprobar ? ' · CAMBIÓ' : ''}</b>${errN(p) && p.estado !== 'idea' ? '<span class="pz-fail">le falta algo</span>' : ''}</div></div></div></div>`;
  }
  const addLabel = d => `Nueva pieza el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;

  function render() {
    if (dnd && dnd.dragging) return;
    ov.classList.toggle('prog', mode === 'prog');
    E.mode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
    E.views.hidden = mode !== 'cal'; E.wrap.hidden = mode !== 'cal'; E.prog.hidden = mode !== 'prog';
    E.views.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === view); b.setAttribute('aria-pressed', b.dataset.v === view); });
    $('.cv-nav').style.visibility = mode === 'cal' ? 'visible' : 'hidden';
    const nP = resumen ? resumen.revisar : 0, nb = E.mode.querySelector('.ct-n'); nb.hidden = !nP; nb.textContent = nP;
    renderChips(); renderRail();
    if (mode === 'prog') { renderProg(); return; }
    const r = range(), by = eventsByDay(), grid = { from: r.from, days: r.days, by, card, addLabel };
    E.title.innerHTML = titleHTML(view, anchor, r);
    E.dow.hidden = view !== 'month'; E.dow.innerHTML = dowHTML(view, anchor, 1);
    E.grid.className = 'cv-grid ' + view; E.grid.style.setProperty('--rows', r.days / 7);
    let html;
    if (view === 'month') html = monthHTML({ ...grid, anchor });
    else if (view === 'agenda') { E.grid.className = 'cv-grid agenda'; html = agendaHTML(grid); }
    else { E.grid.className = 'cv-grid tg tg-' + view; E.grid.style.setProperty('--n', r.days); html = `<div class="cv-tg">${timeGridHTML({ ...grid, live: ev => !ev.p.hora, liveLabel: 'SIN HORA' })}</div>`; }
    const key = view + ':' + r.from; if (view !== 'month' && key === tgKey) tgScroll = E.grid.scrollTop;
    E.grid.innerHTML = errorMsg ? `<div class="cv-empty">${esc(errorMsg)}</div>` : html;
    if (view === 'month') { tgKey = ''; if (!errorMsg) fitMonth(E.grid); }
    else if (view === 'agenda') { if (key !== tgKey) { tgKey = key; E.grid.scrollTop = 0; } else E.grid.scrollTop = tgScroll; }
    else if (key === tgKey) E.grid.scrollTop = tgScroll;
    else { // a new week or day opens on the working hours, or on «now» when today is on screen
      tgKey = key; const now = new Date(), onScreen = Date.now() >= r.from && Date.now() < r.from + r.days * DAY, h = onScreen ? Math.max(0, now.getHours() - 1) : 7;
      const row = E.grid.querySelector(`.cv-tg-h[data-h="${h}"]`), head = E.grid.querySelector('.cv-tg-d'), c0 = E.grid.querySelector('.cv-tg-c');
      E.grid.scrollTop = row && c0 ? row.offsetTop - (head ? head.offsetHeight : 0) - c0.offsetTop : 0;
    }
    let n = 0; for (const k in by) n += by[k].length;
    const cuenta = ORDEN.map(s => [s, pieces.filter(p => p.estado === s && p.fecha && p.fecha >= ymd(new Date(r.from)) && p.fecha < ymd(new Date(r.to)) && visible(p)).length]).filter(([, c]) => c);
    E.stats.innerHTML = `<span><b>${n}</b> ${n === 1 ? 'pieza' : 'piezas'}</span>` + cuenta.map(([s, c]) => `<span class="pz-tone" style="--c:${ESTADO[s].color};--cd:${ESTADO[s].dark}"><b>${c}</b> ${ESTADO[s].name.toLowerCase()}</span>`).join('');
  }
  function renderChips() {
    E.chips.innerHTML = ORDEN.map(s => `<button type="button" class="cv-chip${estadoOn.has(s) ? ' on' : ''}" data-e="${s}" aria-pressed="${estadoOn.has(s)}" title="${esc(ESTADO[s].help)}"><i class="pz-cg pz-tone" style="--c:${ESTADO[s].color};--cd:${ESTADO[s].dark}" aria-hidden="true">${ESTADO[s].glyph}</i>${ESTADO[s].name}</button>`).join('')
      + '<span class="cv-sep"></span>' + Object.entries(RED).map(([k, r]) => `<button type="button" class="cv-chip${redOn.has(k) ? ' on' : ''}" data-r="${k}" aria-pressed="${redOn.has(k)}">${r.short}</button>`).join('');
  }
  function renderRail() {
    const sin = pieces.filter(p => !p.fecha && visible(p)), rev = pieces.filter(p => p.estado === 'revision' && p.fecha && visible(p));
    const bk = p => `<div class="cv-bk pz-bk" draggable="true" data-ev="p:${esc(p.id)}" style="--chip:${chipOf(p)}" role="button" tabindex="0" title="Arrástrala a un día para ponerle fecha">${p.medios[0] ? thumbHTML(p.medios[0], esc, 'pz-bt') : ''}<div class="pz-bkm"><div class="cv-r-t">${esc(titleOf(p))}</div><div class="cv-r-m">${esc(ESTADO[p.estado].name.toLowerCase())} · ${p.redes.map(r => RED[r]?.short).join('+')} · ${esc(FORMATO[p.formato])}</div></div></div>`;
    E.rail.innerHTML = `<div class="cv-rail-h">IDEAS SIN DÍA <b>${sin.length}</b>${sin.length ? '<span class="cv-rail-hint">arrástralas a un día</span>' : ''}</div>`
      + (sin.length ? sin.map(bk).join('') : '<div class="cv-empty">Ninguna idea suelta.<br>Las ideas que los agentes o tú dejen sin día esperan aquí.</div>')
      + `<button type="button" class="pz-newidea" data-new="idea">+ Nueva idea</button>`
      + `<div class="cv-rail-h" style="margin-top:14px">POR REVISAR <b>${rev.length}</b></div>`
      + (rev.length ? rev.map(p => `<div class="cv-r pz-rail" data-open="${esc(p.id)}" style="--chip:${chipOf(p)}" role="button" tabindex="0"><div class="cv-r-t">${esc(titleOf(p))}</div><div class="cv-r-m">${esc(fmtDay(at(p)))}${p.hora ? ' · ' + p.hora : ''} · ${p.redes.map(r => RED[r]?.short).join('+')}</div><div class="cv-r-n">${errN(p) ? '<span class="cv-paused">le falta algo</span>' : 'lista para aprobar'}</div></div>`).join('') : '<div class="cv-empty">Nada esperando tu visto bueno.</div>')
      + `<div class="cv-rail-foot">Clic en un día para escribir una pieza nueva. Arrastra una tarjeta a otro día para moverla: si ya estaba aprobada, vuelve a revisión.</div>`;
  }

  /* ---------- Programación ---------- */
  function renderProg() {
    E.title.innerHTML = '';
    const todas = pieces.filter(visible), grupo = s => todas.filter(p => estadoOn.has(p.estado) && (Array.isArray(s) ? s : [s]).includes(p.estado));
    const revisar = grupo('revision'), listas = grupo('aprobada'), trabajo = grupo(['borrador', 'idea']);
    const puede = p => !errN(p) && p.fecha;
    // la fila NO es un botón: dentro lleva «Aprobar», y un botón nunca va dentro de otro. Lo que abre la pieza es su parte izquierda (un botón de verdad).
    const row = (p, extra = '') => { const e = ESTADO[p.estado], r = p.revision?.errores || []; return `<div class="ct-row" style="--chip:${e.color}">
        <button type="button" class="ct-open" data-open="${esc(p.id)}" aria-label="Abrir la pieza: ${esc(titleOf(p))}">
          ${p.medios[0] ? thumbHTML(p.medios[0], esc, 'pz-rt') : '<span class="pz-rt none" aria-hidden="true"></span>'}
          <span class="ct-rm"><span class="ct-rt">${esc(titleOf(p))}</span><span class="ct-rs">${p.fecha ? esc(fmtDay(at(p))) + (p.hora ? ' · ' + p.hora : '') : 'sin día'} · ${p.redes.map(x => RED[x]?.name).join(' y ')} · ${esc(FORMATO[p.formato])}${p.origen.startsWith('agente:') ? ` · <em>${esc(agentName(p.origen.slice(7)) || 'un agente')}</em>` : ''}</span>
          ${r.length ? `<span class="ct-rf">Le falta: ${esc(r[0])}${r.length > 1 ? ` (+${r.length - 1})` : ''}</span>` : p.cambiadaTrasAprobar ? '<span class="ct-rf">Cambió después de aprobarla: vuelve a aprobarla.</span>' : ''}</span></button>
        <span class="ct-st pz-tone" style="--c:${e.color};--cd:${e.dark}"><i aria-hidden="true">${e.glyph}</i> ${e.name}</span>${extra}</div>`; };
    const sec = (id, titulo, lista, ayuda, vacio, acc = '') => `<section class="ct-sec" aria-labelledby="ctp-${id}"><div class="ct-sh"><h3 id="ctp-${id}">${titulo} <b>${lista.length}</b></h3>${acc}</div>${ayuda ? `<p class="ct-help">${ayuda}</p>` : ''}${lista.length ? lista.map(p => row(p, id === 'rev' ? `<button type="button" class="pz-go sm" data-ok="${esc(p.id)}"${puede(p) ? '' : ' aria-disabled="true"'} title="${puede(p) ? 'Aprobarla' : 'Todavía no puede salir'}">Aprobar</button>` : '')).join('') : `<p class="ct-empty">${vacio}</p>`}</section>`;
    const listasAprobar = revisar.filter(puede).length;
    E.prog.innerHTML = `<div class="ct-banner" role="note"><b>Meta todavía no está conectada.</b> Lo que apruebes queda listo aquí; la entrega a Instagram y Facebook llega en la fase siguiente. Nada sale a ninguna red por ahora.</div>
      <div class="ct-cols">${sec('rev', 'Por revisar', revisar, 'Tus agentes y tú las dejaron listas para mirar. Al aprobarlas quedan como «aprobadas».', 'Nada esperando tu visto bueno.', listasAprobar > 1 ? `<button type="button" class="pz-btn" data-okall>Aprobar las ${listasAprobar} que pueden salir</button>` : '')}
      ${sec('apr', 'Aprobadas', listas, 'Listas para salir. Cambiar lo que sale de una pieza le quita el visto bueno.', 'Todavía no hay piezas aprobadas.')}
      ${sec('bor', 'Borradores e ideas', trabajo, 'Se están escribiendo. Pásalas a revisión cuando estén.', 'No hay borradores ni ideas.')}</div>`;
    E.stats.innerHTML = `<span><b>${revisar.length}</b> por revisar</span><span><b>${listas.length}</b> aprobadas</span><span><b>${trabajo.length}</b> en trabajo</span>`;
  }

  /* ---------- el panel de una pieza ---------- */
  function onPanel(p, info = {}) {
    if (!p) return;
    if (info.eliminar) { if (p.id) later('p:' + p.id, `Eliminada: «${titleOf(p).slice(0, 60)}».`, () => datos.remove(p.id)); return; } // se va al momento; a los 8 segundos llega a la papelera de las piezas
    if (p.id && !info.cerrada) { // lo que se está escribiendo llega a la lista al momento, con su revisión recalculada (la del servidor es de antes del cambio)
      const r = revisarPublicacion(postDePieza(p), p.redes), q = { ...p, revision: { errores: r.errores, avisos: r.avisos, arreglos: r.arreglos } };
      const i = pieces.findIndex(x => x.id === p.id); if (i >= 0) pieces[i] = { ...pieces[i], ...q }; else pieces.push(q); if (info.creada) note('Guardada como borrador.'); }
    if (info.cerrada) { load(true); return; }
    if (openNow) { render(); loadResumen(); }
  }
  const panel = initPieza({ host: E.panelHost, datos, esc, note, onChange: onPanel, openEstudio: p => { const t = { id: p.id, titulo: titleOf(p) }; openStudio(t, ids => { open(); openPiece(p.id, ids); }); }, pickMedia: cur => pickMedia(cur) });
  async function openPiece(id, addIds) {
    if (!openNow) open();
    let p = pieces.find(x => x.id === id);
    if (!p) { await load(true); p = pieces.find(x => x.id === id); }
    if (!p) { note('Esa pieza ya no está.', true); return; }
    await panel.flush(); panel.open(p); if (addIds?.length) panel.addMedios(addIds); render();
  }
  async function openNew(extra) { flushUndo(); await panel.flush(); panel.open(extra); render(); }

  /* ---------- elegir de la galería del Estudio ---------- */
  function pickMedia(actuales = []) {
    return new Promise(async resolve => {
      const dlg = document.createElement('div'); dlg.className = 'ct-pick'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'ctPickT'); dlg.setAttribute('data-modal-keep', '');
      dlg.innerHTML = `<div class="ct-pickbox"><div class="ct-pickh"><h3 id="ctPickT">Elegir de la galería del Estudio</h3><span class="sp"></span><button type="button" class="pz-x" data-a="x" aria-label="Cerrar">✕</button></div><div class="ct-pickg" role="group" aria-label="Archivos"><p class="ct-empty">Cargando…</p></div><div class="ct-pickf"><span class="pz-state" role="status"></span><span class="sp"></span><button type="button" class="pz-go" data-a="ok" disabled>Usar</button></div></div>`;
      ov.appendChild(dlg); modal.open(dlg); const from = document.activeElement;
      const sel = new Set(); const grid = dlg.querySelector('.ct-pickg'), ok = dlg.querySelector('[data-a="ok"]'), st = dlg.querySelector('.pz-state');
      let items = [];
      try { items = served ? (await (await fetch('/api/media')).json()).items || [] : ['demo/a.jpg', 'demo/b.jpg', 'demo/c.jpg', 'demo/d.jpg', 'demo/e.jpg', 'demo/f.jpg'].map(file => ({ file, kind: 'image', prompt: 'Imagen de muestra ' + file.slice(5, 6).toUpperCase() })); } catch { items = []; }
      items = items.filter(it => !actuales.includes(it.file));
      grid.innerHTML = items.length ? items.slice(0, 200).map(it => `<button type="button" class="ct-pk" data-f="${esc(it.file)}" aria-pressed="false" title="${esc(String(it.prompt || it.file).slice(0, 140))}">${thumbHTML(it.file, esc, 'pz-pt')}<span>${esc(String(it.prompt || it.file).slice(0, 48))}</span></button>`).join('') : `<p class="ct-empty">${served ? 'La galería del Estudio está vacía. Crea algo con «Crear con el Estudio».' : 'Sin archivos en la demo.'}</p>`;
      const done = v => { modal.close(dlg); dlg.remove(); if (from && document.contains(from)) from.focus({ preventScroll: true }); resolve(v); };
      dlg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.f) { const on = !sel.has(b.dataset.f); on ? sel.add(b.dataset.f) : sel.delete(b.dataset.f); b.setAttribute('aria-pressed', on); ok.disabled = !sel.size; ok.textContent = sel.size ? `Usar ${sel.size}` : 'Usar'; st.textContent = ''; return; }
        if (b.dataset.a === 'x') done(null); else if (b.dataset.a === 'ok' && sel.size) done([...sel]);
      });
      dlg.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
      (grid.querySelector('button') || dlg.querySelector('[data-a="x"]')).focus();
    });
  }

  /* ---------- arrastrar a otro día ---------- */
  async function dropOn(day, d) {
    if (d.kind !== 'p') return;
    const p = pieces.find(x => x.id === d.id); if (!p) return;
    const fecha = day.dataset.day, hora = day.dataset.hour !== undefined ? `${String(day.dataset.hour).padStart(2, '0')}:${p.hora && +p.hora.slice(0, 2) === +day.dataset.hour ? p.hora.slice(3) : '00'}` : p.hora;
    if (fecha === p.fecha && hora === p.hora) { render(); return; }
    note('Moviendo…');
    try { const r = await datos.patch(p.id, { fecha, ...(hora !== p.hora ? { hora } : {}) }); const i = pieces.findIndex(x => x.id === p.id); if (i >= 0) pieces[i] = r.pieza; if (panel.current()?.id === p.id) panel.refresh(r.pieza); render(); loadResumen(); note(r.soltada ? `Movida al ${fmtDay(at(r.pieza))}. Ya no está aprobada: vuelve a aprobarla.` : `Movida al ${fmtDay(at(r.pieza))}${r.pieza.hora ? ' · ' + r.pieza.hora : ''}.`); }
    catch (e) { render(); note('No se pudo mover: ' + e.message, true); }
  }
  dnd = attachDnd({ root: ov, grid: E.grid, onStart: () => {}, onDrop: (day, d) => dropOn(day, d), onCancel: () => render() });

  /* ---------- eventos ---------- */
  ov.addEventListener('click', async e => {
    const t = e.target;
    const b = t.closest('.ct-mode button'); if (b) { mode = b.dataset.m; store.set('mode', mode); await panel.flush(); render(); return; }
    const v = t.closest('.ct-views button'); if (v) { view = v.dataset.v; store.set('view', view); load(); render(); return; }
    const chip = t.closest('.cv-chip'); if (chip) {
      if (chip.dataset.e) { estadoOn.has(chip.dataset.e) ? estadoOn.delete(chip.dataset.e) : estadoOn.add(chip.dataset.e); if (!estadoOn.size) estadoOn = new Set(ORDEN); store.set('estados', [...estadoOn]); }
      else if (chip.dataset.r) { redOn.has(chip.dataset.r) ? redOn.delete(chip.dataset.r) : redOn.add(chip.dataset.r); if (!redOn.size) redOn = new Set(Object.keys(RED)); store.set('redes', [...redOn]); }
      render(); return;
    }
    const ok = t.closest('[data-ok]'); if (ok) { e.stopPropagation(); await aprobar(ok.dataset.ok, ok); return; }
    if (t.closest('[data-okall]')) { await aprobarTodas(); return; }
    const open_ = t.closest('[data-open]'); if (open_) { openPiece(open_.dataset.open); return; }
    const nw = t.closest('[data-new]'); if (nw) { openNew({}); return; }
    const evc = t.closest('.cv-ev, .cv-bk'); if (evc) { openPiece(evc.dataset.ev.slice(2)); return; }
    const more = t.closest('.cv-more'); if (more) { openMore(more.dataset.day, more.closest('.cv-day')); return; }
    const dh = t.closest('.cv-tg-d'); if (dh && view === 'week') { anchor = new Date(dh.dataset.day + 'T00:00:00').getTime(); view = 'day'; load(); render(); return; }
    const add = t.closest('.cv-add'); if (add) { const cell = add.closest('.cv-day'); openNew({ fecha: cell.dataset.day, hora: cell.dataset.hour !== undefined ? String(cell.dataset.hour).padStart(2, '0') + ':00' : '' }); return; }
    const vd = t.closest('[data-vday]'); if (vd) { anchor = new Date(vd.dataset.vday + 'T00:00:00').getTime(); view = 'day'; closePop(); load(); render(); return; }
    const rb = t.closest('[data-rail]'); if (rb) { ov.classList.toggle('railOpen'); rb.setAttribute('aria-expanded', ov.classList.contains('railOpen')); return; }
    if (t.closest('#ctClose')) { close(); return; }
    if (t.closest('#ctKeys')) { dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); return; }
    if (t.closest('#ctPrev')) { step(-1); return; } if (t.closest('#ctNext')) { step(1); return; }
    if (t.closest('#ctToday')) { anchor = startOfDay(Date.now()); tgKey = ''; load(); render(); return; }
    const day = t.closest('.cv-day'); if (day && mode === 'cal' && !E.pop.contains(t) && (t === day || t.classList.contains('cv-evs') || t.closest('.cv-num'))) { openNew({ fecha: day.dataset.day, hora: day.dataset.hour !== undefined ? String(day.dataset.hour).padStart(2, '0') + ':00' : '' }); return; }
    if (!E.pop.hidden && !E.pop.contains(t)) closePop();
    if (ov.classList.contains('railOpen') && !t.closest('.cv-rail') && !t.closest('[data-rail]')) ov.classList.remove('railOpen');
  });
  ov.addEventListener('keydown', e => {
    const card = e.target.closest && e.target.closest('.cv-ev, .cv-bk, [data-open]'); if (card && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('button:not(.cv-ev)')) { e.preventDefault(); e.stopPropagation(); openPiece((card.dataset.ev || 'p:' + card.dataset.open).slice(2)); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || mode !== 'cal') return;
    if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 't' || e.key === 'T') { anchor = startOfDay(Date.now()); load(); render(); }
    else if (e.key === 'w' || e.key === 'W') { view = 'week'; load(); render(); } else if (e.key === 'm' || e.key === 'M') { view = 'month'; load(); render(); }
    else if (e.key === 'a' || e.key === 'A') { view = 'agenda'; load(); render(); } else if (e.key === 'd' || e.key === 'D') { view = 'day'; load(); render(); }
  });
  ov.addEventListener('dblclick', e => { const day = e.target.closest('.cv-day[data-day]'); if (!day || view !== 'month' || e.target.closest('.cv-ev')) return; anchor = new Date(day.dataset.day + 'T00:00:00').getTime(); view = 'day'; load(); render(); });
  E.search.addEventListener('input', () => { q = E.search.value.trim().toLowerCase(); render(); });
  E.search.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { E.search.value = ''; q = ''; render(); E.search.blur(); } });
  function step(n) { anchor = stepAnchor(view, anchor, n); closePop(); load(); render(); }
  async function aprobar(id, btn) {
    if (btn?.getAttribute('aria-disabled') === 'true') { const p = pieces.find(x => x.id === id); note(!p?.fecha ? 'Ponle un día antes de aprobarla.' : (p.revision?.errores?.[0] || 'Todavía no puede salir.'), true); return; }
    try { const r = await datos.approve(id); const i = pieces.findIndex(x => x.id === id); if (i >= 0) pieces[i] = r.pieza; render(); loadResumen(); note('Aprobada. Queda lista en Programación.'); }
    catch (e) { note(e.message, true); }
  }
  async function aprobarTodas() {
    const lista = pieces.filter(p => p.estado === 'revision' && !errN(p) && p.fecha && visible(p)); let ok = 0, mal = 0;
    for (const p of lista) { try { const r = await datos.approve(p.id); const i = pieces.findIndex(x => x.id === p.id); if (i >= 0) pieces[i] = r.pieza; ok++; } catch { mal++; } }
    render(); loadResumen(); note(`${ok} ${ok === 1 ? 'aprobada' : 'aprobadas'}${mal ? ` · ${mal} no ${mal === 1 ? 'pudo' : 'pudieron'}` : ''}.`, !!mal);
  }
  function closePop() { E.pop.hidden = true; E.pop.innerHTML = ''; }
  function openMore(dayKey, cell) {
    const list = (eventsByDay()[dayKey] || []); const d = new Date(dayKey + 'T00:00:00');
    E.pop.innerHTML = `<div class="cv-pop-h"><span class="lab">${DOW[(d.getDay() + 6) % 7].toUpperCase()} ${d.getDate()} ${MONTHS[d.getMonth()].toUpperCase()}</span><b>${list.length}</b><span class="sp"></span><button type="button" class="cv-lk" data-vday="${dayKey}">Ver el día</button><button type="button" class="cv-x" aria-label="Cerrar" data-x>✕</button></div><div class="cv-pop-list">${list.map(ev => card(ev)).join('')}</div>`;
    E.pop.hidden = false; const r = cell.getBoundingClientRect(), W = E.pop.offsetWidth || 372;
    let x = r.right + 12; if (x + W > innerWidth - 12) x = Math.max(12, r.left - W - 12); E.pop.style.left = x + 'px'; E.pop.style.top = Math.max(12, Math.min(r.top, innerHeight - (E.pop.offsetHeight || 300) - 12)) + 'px';
    E.pop.querySelector('[data-x]').addEventListener('click', closePop);
  }

  /* ---------- el número del dock ---------- */
  const dock = document.getElementById('topContenido'), dockLabel = dock ? dock.getAttribute('aria-label') : '';
  function paintDock() {
    if (!dock) return; const n = resumen ? resumen.revisar : 0;
    dock.classList.toggle('ct-news', n > 0); if (n) { dock.dataset.n = n > 9 ? '9+' : n; dock.setAttribute('aria-label', `${dockLabel} · ${n} ${n === 1 ? 'espera' : 'esperan'} tu visto bueno`); } else { delete dock.dataset.n; dock.setAttribute('aria-label', dockLabel); }
  }
  async function loadResumen() { try { resumen = await datos.resumen(); paintDock(); if (openNow) { const nb = E.mode.querySelector('.ct-n'); nb.hidden = !resumen.revisar; nb.textContent = resumen.revisar; } } catch {} }
  let bg = null; const bgPoll = () => { clearTimeout(bg); bg = setTimeout(async () => { if (!openNow && !document.hidden && served && location.protocol.startsWith('http')) await loadResumen(); bgPoll(); }, 60000); };
  loadResumen(); bgPoll();

  /* ---------- abrir y cerrar ---------- */
  const isOn = () => openNow;
  function open() {
    if (openNow) return; views.opening('contenido'); openNow = true; opener = document.activeElement;
    mode = store.get('mode', 'cal'); view = store.get('view', 'month'); if (narrow() && (view === 'month' || view === 'week')) view = 'agenda';
    ov.inert = false; modal.open(ov); $('#ctCo').textContent = business(); ov.classList.add('on'); document.body.classList.add('ctOpen');
    render(); load(true); loadResumen(); ov.tabIndex = -1; ov.focus();
    timer = setInterval(() => { if (!document.hidden && !panel.isOpen()) load(true); }, 20000); // lo que dejan los agentes aparece solo
  }
  async function close(o = {}) {
    if (!openNow) return; flushUndo(); await panel.close({ quiet: true }); openNow = false; closePop(); modal.close(ov); ov.inert = true; ov.classList.remove('on'); document.body.classList.remove('ctOpen'); clearInterval(timer); timer = null;
    if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); loadResumen();
  }
  views.add('contenido', { isOpen: isOn, close });
  addEventListener('resize', () => { if (openNow && mode === 'cal' && view === 'month') { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!(dnd && dnd.dragging)) render(); }, 150); } }); let resizeT = 0;
  return {
    open, close, toggle: () => (openNow ? close() : open()), isOpen: isOn, openPiece,
    selection() { if (!openNow) return null; const p = panel.isOpen() ? panel.current() : null; return p && p.id ? { view: 'contenido', label: `Pieza «${p.titulo || (p.texto || '').slice(0, 40) || 'sin título'}»${p.fecha ? ' · ' + p.fecha : ''}`, kind: 'pieza', id: p.id } : { view: 'contenido', label: `Contenido · ${E.title ? E.title.textContent.replace(/\s+/g, ' ').trim().split(' · ')[0] : ''}`.replace(/ · $/, ''), kind: 'range', id: ymd(new Date(anchor)) }; }, // V4.8: what Dimitri sees beside it
    refresh: () => { if (openNow && !panel.isOpen()) load(true); else loadResumen(); },
    panelOpen: () => panel.isOpen(), closePanel: () => panel.close(), popOpen: () => !E.pop.hidden, closePop,
    /** Lo que hay en un rango de días, para la capa del calendario de tareas (solo lectura). */
    async between(desde, hasta) { try { return (await datos.list({ desde, hasta })).piezas; } catch { return []; } },
    /** Desde el Estudio: una imagen o un video pasa a ser una pieza nueva (sin día, como idea) y se abre para terminarla. */
    async fromMedia(file, kind, prompt) {
      try { const p = await datos.create({ titulo: String(prompt || '').slice(0, 60), formato: kind === 'video' ? 'reel' : 'post', medios: [file], estado: 'idea', redes: ['instagram', 'facebook'] }); open(); pieces.push(p); await openPiece(p.id); return p; }
      catch (e) { return { error: e.message }; }
    },
  };
}
