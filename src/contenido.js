// Agents Office V4.7 (30 sep 2026) — CONTENIDO (K, o el calendario con una foto en la barra): lo que se va a publicar en Instagram y Facebook.
// Dos modos de una misma vista, que comparten el panel de la pieza:
//   CALENDARIO — cada pieza en su día y su hora, con el motor del calendario de tareas (calendar-core.js): mes, semana, día y agenda; se arrastra
//                una pieza a otro día (o al banco de ideas, para quitarle el día), se hace clic en un día para escribir una nueva, y a un lado
//                esperan las ideas sin día.
//   PROGRAMACIÓN — la COLA: lo que sale, en orden, por día («Hoy», «Mañana», «vie 9 oct»), con la cuenta atrás, los huecos de los próximos 14
//                días y arriba lo que pide una acción (por revisar, le falta algo, vencidas, cambiadas tras aprobarlas). Tiene su propia carga:
//                no depende del mes que mire el calendario. (La entrega a Meta llega en F3: hoy lo aprobado queda listo aquí.)
// V4.10 (1 oct 2026, auditoría CON-01…21): la tarjeta del mes dice de un vistazo QUÉ sale (miniatura, formato, red, hora, estado), el panel
// es un cajón que no estruja el calendario, «+ Crear» con el formato, huecos, choques y la vista previa por red (contenido-preview.js).
// Los agentes dejan borradores (contenido-mcp.mjs); solo el dueño aprueba, y solo lo aprobado puede salir.
//   initContenido({ served, esc, agentName, openStudio, business }) → { open, close, toggle, isOpen, openPiece(id), refresh, week(range) }
import { modal } from './modal.js';
import { views } from './views.js';
import { DOW, MONTHS, DAY, ymd, startOfDay, fmtDay, rangeOf, stepAnchor, titleHTML, dowHTML, monthHTML, timeGridHTML, agendaHTML, fitMonth, DOW_LONG } from './calendar-core.js';
import { attachDnd } from './calendar-dnd.js';
import { crearDatos, DEMO_MEDIOS } from './contenido-datos.js';
import { initPieza, ESTADO, FORMATO, RED, FICON, thumbHTML } from './pieza.js';
import { cuentaAtras, siguienteHueco, vencida, requiereAccion, colaPorDia } from './contenido-cola.js';
import { revisarPublicacion, postDePieza, revisarMomento, medidaDeItem } from './contenido-reglas.js';

const ORDEN = ['idea', 'borrador', 'revision', 'aprobada'];
const store = { get(k, d) { try { const v = localStorage.getItem('ao.ct.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('ao.ct.' + k, JSON.stringify(v)); } catch {} } };
// sin hora, la pieza se pinta al principio del día y dice «sin hora» (no se inventa un 09:00 ni un 23:59): no puede aprobarse así
const at = p => { if (!p.fecha) return 0; const [h, m] = (p.hora || '00:00').split(':').map(Number); return new Date(`${p.fecha}T00:00:00`).setHours(h, m, 0, 0); };
const netBadges = (p, cls = '') => p.redes.map(r => `<b class="pz-nb ${r}${cls}" aria-hidden="true">${RED[r]?.short || r}</b>`).join('');
const redesTxt = p => p.redes.map(r => RED[r]?.name || r).join(' y ');
export function initContenido({ served, esc, agentName = id => id, openStudio = () => {}, business = () => '' }) {
  const datos = crearDatos({ served });
  const ov = document.createElement('div');
  ov.id = 'ctOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('data-view', ''); ov.setAttribute('aria-label', 'Contenido'); ov.inert = true;
  ov.innerHTML = `
    <div class="cv-band">
      <div class="cv-brand">CONTENIDO <small id="ctCo"></small></div>
      <div class="ct-create"><button type="button" class="ct-new" id="ctNew" aria-haspopup="true" aria-expanded="false" aria-label="Crear una pieza" title="Crear una pieza">+<span class="ct-newt"> Crear</span></button>
        <div class="ct-newmenu" role="menu" aria-label="Qué crear" hidden>${Object.entries(FORMATO).map(([k, l]) => `<button type="button" role="menuitem" data-newf="${k}">${FICON[k]}${l}</button>`).join('')}<p class="ct-newhint">Se abre con el siguiente hueco libre y las dos redes.</p></div></div>
      <div class="cv-seg ct-mode" role="group" aria-label="Qué ver"><button type="button" data-m="cal" aria-pressed="true">CALENDARIO</button><button type="button" data-m="prog" aria-pressed="false">PROGRAMACIÓN<b class="ct-n" hidden></b></button></div>
      <div class="cv-seg ct-views" role="group" aria-label="Vista del calendario"><button type="button" data-v="agenda">AGENDA</button><button type="button" data-v="day">DÍA</button><button type="button" data-v="week">SEMANA</button><button type="button" data-v="month" class="on">MES</button></div>
      <div class="cv-nav"><button id="ctPrev" type="button" aria-label="Anterior" title="anterior (←)">‹</button><div id="ctTitle"></div><button id="ctNext" type="button" aria-label="Siguiente" title="siguiente (→)">›</button><button id="ctToday" type="button" title="hoy (T)">HOY</button><select class="ct-vsel" aria-label="Vista del calendario"><option value="agenda">Agenda</option><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option></select></div>
      <div class="cv-sp"></div>
      <button id="ctKeys" type="button" aria-label="Atajos" title="atajos (?)">?</button>
      <button id="ctClose" type="button" aria-label="Cerrar Contenido" title="cerrar (Esc · K)">✕</button>
    </div>
    <div class="cv-tools"><button type="button" class="cv-railbtn" data-rail aria-expanded="false">Ideas</button>
      <div class="cv-sw"><input id="ctSearch" type="search" placeholder="Buscar en las piezas…" autocomplete="off" spellcheck="false" aria-label="Buscar en las piezas de contenido"></div>
      <button type="button" class="ct-fbtn" data-filters aria-expanded="false" aria-controls="ctChips">Filtros</button>
      <div id="ctChips" role="group" aria-label="Filtros"></div><div class="cv-sp"></div><div class="cv-stats" id="ctStats" role="status"></div></div>
    <div class="cv-body">
      <aside class="cv-rail" aria-label="Ideas sin día"><div class="ct-rail"></div></aside>
      <div class="cv-wrap"><div class="cv-dow" id="ctDow"></div><div class="cv-grid month" id="ctGrid"></div></div>
      <div class="ct-prog" hidden></div>
      <aside class="ct-panel" hidden></aside>
    </div>
    <div class="cv-toast" hidden role="status"><span></span><button type="button">DESHACER</button></div>
    <div id="ctPop" hidden></div>`;
  document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  const E = { title: $('#ctTitle'), dow: $('#ctDow'), grid: $('#ctGrid'), chips: $('#ctChips'), stats: $('#ctStats'), search: $('#ctSearch'), rail: $('.ct-rail'), railBox: $('.cv-rail'), prog: $('.ct-prog'), wrap: $('.cv-wrap'), panelHost: $('.ct-panel'), pop: $('#ctPop'), toast: $('.cv-toast'), views: $('.ct-views'), mode: $('.ct-mode'), newBtn: $('#ctNew'), newMenu: $('.ct-newmenu') };
  const narrow = () => matchMedia('(max-width: 760px)').matches;
  let tgKey = '', tgScroll = 0; // which week or day the time grid shows, and where it was scrolled to (a re-render keeps it), as in the tasks calendar
  let openNow = false, mode = 'cal', view = 'month', anchor = startOfDay(Date.now()), q = '', pieces = [], cola = [], resumen = null, loadedKey = '', errorMsg = '', timer = null, opener = null, dnd = null, lastGrid = '', lastProg = '';
  let estadoOn = new Set(store.get('estados', ORDEN)), redOn = new Set(store.get('redes', Object.keys(RED)));
  const gone = new Set(); let undoT = null, commitFn = null, undoFn = null, noteT = null;
  const medidas = { ...DEMO_MEDIOS }; // lo que se sabe de cada archivo del Estudio (de /api/media al elegir): la vista previa y las reglas lo usan
  let cuentas = { empresa: '' };

  /* ---------- avisos y deshacer (el mismo gesto que el calendario de tareas: se va al momento, con 8 segundos para volver) ---------- */
  function note(msg, bad) { if (commitFn || undoFn) return; E.toast.querySelector('span').textContent = msg; E.toast.querySelector('button').hidden = true; E.toast.classList.toggle('bad', !!bad); E.toast.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { if (!commitFn && !undoFn) E.toast.hidden = true; }, bad ? 7000 : 4500); }
  function flushUndo() { clearTimeout(undoT); undoT = null; E.toast.hidden = true; undoFn = null; const f = commitFn; commitFn = null; if (f) f(); }
  function later(key, label, commit) {
    flushUndo(); gone.add(key); render();
    commitFn = async () => { try { await commit(); } catch (e) { note('No se pudo: ' + e.message, true); } gone.delete(key); load(true); };
    E.toast.querySelector('span').textContent = label; E.toast.querySelector('button').hidden = false; E.toast.classList.remove('bad'); clearTimeout(noteT); E.toast.hidden = false;
    E.toast.querySelector('button').onclick = () => { clearTimeout(undoT); commitFn = null; E.toast.hidden = true; gone.delete(key); render(); note('Deshecho.'); };
    undoT = setTimeout(flushUndo, 8000);
  }
  /** Ya hecho, con 8 segundos para volver atrás (mover una pieza aprobada le quita el OK: DESHACER la devuelve y la vuelve a aprobar). */
  function undoable(label, undo) {
    flushUndo(); undoFn = undo;
    E.toast.querySelector('span').textContent = label; E.toast.querySelector('button').hidden = false; E.toast.classList.remove('bad'); clearTimeout(noteT); E.toast.hidden = false;
    E.toast.querySelector('button').onclick = async () => { clearTimeout(undoT); const f = undoFn; undoFn = null; E.toast.hidden = true; try { await f(); note('Deshecho.'); } catch (e) { note('No se pudo deshacer: ' + e.message, true); } };
    undoT = setTimeout(() => { undoFn = null; E.toast.hidden = true; }, 8000);
  }

  /* ---------- cargar ---------- */
  const range = () => rangeOf(view, anchor, 1);
  function want() { const r = range(); const a = new Date(r.from - 7 * DAY), b = new Date(r.to + 7 * DAY); return { desde: ymd(a), hasta: ymd(b) }; }
  const conMedidas = list => { for (const p of list) { if (p.medidas) Object.assign(medidas, p.medidas); p.medidas = { ...Object.fromEntries((p.medios || []).concat(p.historias || []).filter(m => medidas[m]).map(m => [m, medidas[m]])), ...(p.medidas || {}) }; } return list; };
  async function load(force = false) {
    const w = want(), key = `${w.desde}|${w.hasta}`;
    if (!force && key === loadedKey && pieces.length) { if (mode === 'prog') loadCola(); return; }
    try { const r = await datos.list({ ...w, sinFecha: true }); pieces = conMedidas(r.piezas || []); resumen = r.resumen || resumen; loadedKey = key; errorMsg = ''; }
    catch (e) { errorMsg = e.message || 'No pude leer las piezas'; }
    if (mode === 'prog' || force) await loadCola();
    if (openNow) render(); paintDock();
  }
  /** La cola tiene su propia carga: de hace 14 días (para ver lo vencido) en adelante, sin tope, más las ideas sin día. */
  async function loadCola() { try { const r = await datos.list({ desde: ymd(new Date(Date.now() - 14 * DAY)), sinFecha: true }); cola = conMedidas(r.piezas || []); resumen = r.resumen || resumen; } catch (e) { errorMsg = e.message || 'No pude leer las piezas'; } }
  const todasConocidas = () => { const m = new Map(); for (const p of [...cola, ...pieces]) m.set(p.id, p); return [...m.values()]; };

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
  const falta = p => errN(p) && p.estado !== 'idea';
  /** Lo que un lector de pantalla oye de una tarjeta: todo lo que el ojo ve de un vistazo. */
  const ariaOf = p => `${titleOf(p)}, ${p.fecha ? fmtDay(at(p)) : 'sin día'}${p.hora ? ' ' + p.hora : ', sin hora'}, ${FORMATO[p.formato]}, ${redesTxt(p)}, ${(ESTADO[p.estado] || ESTADO.borrador).name.toLowerCase()}${falta(p) ? ', le falta algo: ' + p.revision.errores[0] : ''}${p.cambiadaTrasAprobar ? ', cambió después de aprobarla' : ''}${vencida(p) ? ', la hora ya pasó' : ''}`;
  function card(ev, line) {
    const p = ev.p, e = ESTADO[p.estado] || ESTADO.borrador, sel = panel.current()?.id === p.id;
    const cls = `cv-ev pz pz-${p.estado}${falta(p) ? ' pz-falta' : ''}${vencida(p) ? ' pz-venc' : ''}${sel ? ' sel' : ''}`;
    const attrs = `data-ev="p:${esc(p.id)}" style="--chip:${e.color};--chipd:${e.dark}" title="${esc(ariaOf(p))} · arrástrala a otro día (o Mayús + flechas)" aria-label="${esc(ariaOf(p))}" draggable="true" role="button" tabindex="0"`;
    const st = `<span class="pz-st pz-tone" style="--c:${e.color};--cd:${e.dark}" aria-hidden="true">${e.glyph}</span>${falta(p) ? '<span class="pz-warn" aria-hidden="true">!</span>' : ''}`;
    const thumb = p.medios[0] ? thumbHTML(p.medios[0], esc, 'pz-ct') : `<span class="pz-ct none" aria-hidden="true">${FICON[p.formato] || ''}</span>`;
    if (line) // el MES: dos filas — miniatura | hora · formato · redes · estado / título
      return `<div class="${cls} line pz2" ${attrs}>${thumb}<span class="pz-l2"><span class="pz-l1"><b class="pz-h">${esc(p.hora || 'sin hora')}</b><span class="pz-f" aria-hidden="true">${FICON[p.formato] || ''}</span>${netBadges(p)}${st}</span><span class="cv-ev-t">${esc(titleOf(p))}</span></span></div>`;
    return `<div class="${cls}" ${attrs}>
      <div class="pz-cardrow">${thumb}<div class="pz-cardmain"><div class="pz-l1"><b class="pz-h">${esc(p.hora || 'sin hora')}</b><span class="pz-f">${FICON[p.formato] || ''}<span>${esc(FORMATO[p.formato])}</span></span>${netBadges(p)}</div><div class="cv-ev-t">${esc(titleOf(p))}</div><div class="pz-cardst"><b class="pz-tone" style="--c:${e.color};--cd:${e.dark}"><i aria-hidden="true">${e.glyph}</i> ${e.name}${p.cambiadaTrasAprobar ? ' · CAMBIÓ' : ''}</b>${falta(p) ? '<span class="pz-fail">le falta algo</span>' : ''}${vencida(p) ? '<span class="pz-fail">la hora ya pasó</span>' : ''}</div></div></div></div>`;
  }
  const addLabel = d => `Nueva pieza el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;

  function render() {
    if (dnd && dnd.dragging) return;
    ov.classList.toggle('prog', mode === 'prog'); ov.classList.toggle('panelOpen', panel.isOpen());
    E.mode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
    E.views.hidden = mode !== 'cal'; E.wrap.hidden = mode !== 'cal'; E.prog.hidden = mode !== 'prog';
    E.views.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === view); b.setAttribute('aria-pressed', b.dataset.v === view); }); $('.ct-vsel').value = view;
    $('.cv-nav').style.visibility = mode === 'cal' ? 'visible' : 'hidden';
    const nP = resumen ? resumen.revisar : 0, nb = E.mode.querySelector('.ct-n'); nb.hidden = !nP; nb.textContent = nP; nb.setAttribute('aria-label', `${nP} por revisar`);
    renderChips(); renderRail();
    if (mode === 'prog') { renderProg(); return; }
    const r = range(), by = eventsByDay(), grid = { from: r.from, days: r.days, by, card, addLabel };
    E.title.innerHTML = titleHTML(view, anchor, r);
    E.dow.hidden = view !== 'month'; E.dow.innerHTML = dowHTML(view, anchor, 1);
    E.grid.className = 'cv-grid ' + view; E.grid.style.setProperty('--rows', r.days / 7);
    let html;
    if (view === 'month') html = monthHTML({ ...grid, anchor });
    else if (view === 'agenda') { E.grid.className = 'cv-grid agenda'; html = agendaHTML({ ...grid, emptyDay: 'Nada programado. Un buen hueco para publicar.', emptyAll: 'Nada en estos 14 días.' }); }
    else { E.grid.className = 'cv-grid tg tg-' + view; E.grid.style.setProperty('--n', r.days); html = `<div class="cv-tg">${timeGridHTML({ ...grid, live: ev => !ev.p.hora, liveLabel: 'SIN HORA' })}</div>`; }
    const key = view + ':' + r.from; if (view !== 'month' && key === tgKey) tgScroll = E.grid.scrollTop;
    const out = errorMsg ? `<div class="cv-empty">${esc(errorMsg)}</div>` : html;
    // el sondeo cada 20 s repinta: si nada cambió no se toca la cuadrícula, y si cambió el foco vuelve a la misma tarjeta (CON-12)
    const same = out === lastGrid && E.grid.firstChild && view !== 'month';
    const focused = E.grid.contains(document.activeElement) ? document.activeElement.closest('[data-ev]')?.dataset.ev : null;
    if (!same) { E.grid.innerHTML = out; lastGrid = out; }
    if (focused && !same) E.grid.querySelector(`[data-ev="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    if (view === 'month') { tgKey = ''; if (!errorMsg) fitMonth(E.grid); }
    else if (view === 'agenda') { if (key !== tgKey) { tgKey = key; E.grid.scrollTop = 0; } else E.grid.scrollTop = tgScroll; }
    else if (key === tgKey) E.grid.scrollTop = tgScroll;
    else { // una semana o un día nuevos abren en la primera pieza (o a las 8:00), no a la hora de ahora: de noche se veía la madrugada vacía (CON-14)
      tgKey = key; const prim = Object.values(by).flat().filter(ev => ev.p.hora).sort((a, b) => new Date(a.at).getHours() - new Date(b.at).getHours())[0];
      const h = prim ? Math.max(0, new Date(prim.at).getHours() - 1) : 8;
      const row = E.grid.querySelector(`.cv-tg-h[data-h="${h}"]`), head = E.grid.querySelector('.cv-tg-d'), c0 = E.grid.querySelector('.cv-tg-c');
      E.grid.scrollTop = row && c0 ? row.offsetTop - (head ? head.offsetHeight : 0) - c0.offsetTop : 0;
    }
    let n = 0; for (const k in by) n += by[k].length;
    const cuenta = ORDEN.map(s => [s, pieces.filter(p => p.estado === s && p.fecha && p.fecha >= ymd(new Date(r.from)) && p.fecha < ymd(new Date(r.to)) && visible(p)).length]).filter(([, c]) => c);
    E.stats.innerHTML = `<span><b>${n}</b> ${n === 1 ? 'pieza' : 'piezas'}</span>` + cuenta.map(([s, c]) => `<span class="pz-tone" style="--c:${ESTADO[s].color};--cd:${ESTADO[s].dark}"><b>${c}</b> ${ESTADO[s].name.toLowerCase()}</span>`).join('');
  }
  function renderChips() {
    const off = ORDEN.length - estadoOn.size + Object.keys(RED).length - redOn.size;
    $('[data-filters]').textContent = off ? `Filtros (${off})` : 'Filtros';
    E.chips.innerHTML = ORDEN.map(s => `<button type="button" class="cv-chip${estadoOn.has(s) ? ' on' : ''}" data-e="${s}" aria-pressed="${estadoOn.has(s)}" title="${esc(ESTADO[s].help)}"><i class="pz-cg pz-tone" style="--c:${ESTADO[s].color};--cd:${ESTADO[s].dark}" aria-hidden="true">${ESTADO[s].glyph}</i>${ESTADO[s].name}</button>`).join('')
      + '<span class="cv-sep"></span>' + Object.entries(RED).map(([k, r]) => `<button type="button" class="cv-chip${redOn.has(k) ? ' on' : ''}" data-r="${k}" aria-pressed="${redOn.has(k)}"><b class="pz-nb ${k}" aria-hidden="true">${r.short}</b>${r.name}</button>`).join('');
  }
  function renderRail() {
    const sin = todasConocidas().filter(p => !p.fecha && visible(p));
    const bk = p => `<div class="cv-bk pz-bk" draggable="true" data-ev="p:${esc(p.id)}" style="--chip:${chipOf(p)}" role="button" tabindex="0" aria-label="${esc(ariaOf(p))}" title="Arrástrala a un día para ponerle fecha">${p.medios[0] ? thumbHTML(p.medios[0], esc, 'pz-bt') : `<span class="pz-bt none" aria-hidden="true">${FICON[p.formato] || ''}</span>`}<div class="pz-bkm"><div class="cv-r-t">${esc(titleOf(p))}</div><div class="cv-r-m"><span class="pz-f">${FICON[p.formato] || ''}${esc(FORMATO[p.formato])}</span> ${netBadges(p)} · ${esc(ESTADO[p.estado].name.toLowerCase())}</div></div></div>`;
    E.rail.innerHTML = `<div class="cv-rail-h">IDEAS SIN DÍA <b>${sin.length}</b>${sin.length ? '<span class="cv-rail-hint">arrástralas a un día</span>' : ''}</div>`
      + (sin.length ? sin.map(bk).join('') : '<div class="cv-empty">Ninguna idea suelta.<br>Las ideas que los agentes o tú dejen sin día esperan aquí.</div>')
      + `<button type="button" class="pz-newidea" data-new="idea">+ Nueva idea</button>`
      + `<div class="cv-rail-foot">Suelta aquí una pieza del calendario para quitarle el día. Lo que espera tu visto bueno está en PROGRAMACIÓN.</div>`;
  }

  /* ---------- Programación: la cola ---------- */
  const filaCola = (p, { accion = true, motivo = '' } = {}) => {
    const e = ESTADO[p.estado] || ESTADO.borrador, r = p.revision?.errores || [], m = p.fecha ? revisarMomento(p.fecha, p.hora) : null;
    const puede = !r.length && m && !m.errores.length;
    const cuando = p.fecha && p.hora ? `<span class="ct-cd${at(p) < Date.now() ? ' late' : ''}">${cuentaAtras(at(p))}</span>` : '';
    return `<div class="ct-row" style="--chip:${e.color}">
      <span class="ct-hour">${p.hora ? esc(p.hora) : p.fecha ? '<small>sin hora</small>' : '<small>sin día</small>'}</span>
      <button type="button" class="ct-open" data-open="${esc(p.id)}" aria-label="Abrir la pieza: ${esc(ariaOf(p))}">
        ${p.medios[0] ? thumbHTML(p.medios[0], esc, 'pz-rt') : `<span class="pz-rt none" aria-hidden="true">${FICON[p.formato] || ''}</span>`}
        <span class="ct-rm"><span class="ct-rt">${esc(titleOf(p))}</span><span class="ct-rs"><span class="pz-f">${FICON[p.formato] || ''}${esc(FORMATO[p.formato])}</span>${netBadges(p)}${cuando}${p.origen.startsWith('agente:') ? ` · <em>${esc(agentName(p.origen.slice(7)) || 'un agente')}</em>` : ''}</span>
        ${motivo ? `<span class="ct-rf">${esc(motivo)}</span>` : r.length && p.estado !== 'idea' ? `<span class="ct-rf">Le falta: ${esc(r[0])}${r.length > 1 ? ` (+${r.length - 1})` : ''}</span>` : p.cambiadaTrasAprobar ? '<span class="ct-rf">Cambió después de aprobarla: vuelve a aprobarla.</span>' : ''}</span></button>
      <span class="ct-st pz-tone" style="--c:${e.color};--cd:${e.dark}"><i aria-hidden="true">${e.glyph}</i> ${e.name}</span>
      ${accion && p.estado === 'revision' ? `<button type="button" class="pz-go sm${puede ? '' : ' locked'}" data-ok="${esc(p.id)}"${puede ? '' : ' aria-disabled="true"'} title="${puede ? 'Aprobarla' : 'Todavía no puede salir'}">${puede ? 'Aprobar' : '<span aria-hidden="true">🔒</span> Aprobar'}</button>` : ''}</div>`;
  };
  function renderProg() {
    E.title.innerHTML = '';
    const todas = todasConocidas().filter(visible), hoy = startOfDay(Date.now()), hoyK = ymd(new Date(hoy));
    // lo que pide una acción del dueño, con el porqué; y la cola por día: los próximos 14 siempre (los vacíos, como huecos), después solo los días con algo
    const accion = requiereAccion(todas).map(a => [a.pieza, a.motivo]);
    const listasAprobar = requiereAccion(todas).filter(a => a.puede).length;
    const futuras = todas.filter(p => p.fecha && p.fecha >= hoyK), dias = new Map(colaPorDia(todas));
    const rel = k => k === hoyK ? 'Hoy' : k === ymd(new Date(hoy + DAY + 3600e3)) ? 'Mañana' : '';
    const diaH = k => { const d = new Date(k + 'T00:00:00'); return `${rel(k) ? `<b>${rel(k)}</b> · ` : ''}${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`; };
    const colaHTML = [...dias.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, l]) => l.length
      ? `<section class="ct-day" aria-label="${esc(diaH(k).replace(/<[^>]+>/g, ''))}"><h4>${diaH(k)} <small>${l.length} ${l.length === 1 ? 'pieza' : 'piezas'}</small></h4>${l.map(p => filaCola(p, { accion: true })).join('')}</section>`
      : `<section class="ct-day gap"><h4>${diaH(k)}</h4><button type="button" class="ct-gap" data-gap="${k}">Hueco: nada programado · <b>+ Programar aquí</b></button></section>`).join('');
    // la frecuencia de la semana que empieza hoy, por red
    const sem = futuras.filter(p => at(p) < hoy + 7 * DAY && p.estado !== 'idea'), porRed = Object.keys(RED).map(r => [r, sem.filter(p => p.redes.includes(r)).length]);
    const sinDia = todas.filter(p => !p.fecha);
    let metaOff = false; try { metaOff = localStorage.getItem('ao.ct.metaBanner') === '0'; } catch {}
    const html = `${metaOff ? '' : `<div class="ct-banner" role="note"><span><b>Meta todavía no está conectada:</b> nada sale solo. Lo aprobado queda listo aquí; la entrega a Instagram y Facebook llega en la fase siguiente.</span><button type="button" class="ct-bx" data-banner aria-label="Entendido, ocultar este aviso">Entendido</button></div>`}
      <div class="ct-cols">
        <div class="ct-main">
          <section class="ct-sec ct-need" aria-labelledby="ctp-acc"><div class="ct-sh"><h3 id="ctp-acc">Requiere tu acción <b>${accion.length}</b></h3>${listasAprobar > 1 ? `<button type="button" class="pz-btn" data-okall>Aprobar las ${listasAprobar} que pueden salir</button>` : ''}</div>
            ${accion.length ? accion.map(([p, m]) => filaCola(p, { motivo: m })).join('') : '<p class="ct-empty">Nada pendiente. Todo lo programado está aprobado o en trabajo.</p>'}</section>
          <section class="ct-sec" aria-labelledby="ctp-cola"><div class="ct-sh"><h3 id="ctp-cola">La cola · lo que sale</h3><span class="ct-freq">Próximos 7 días: ${porRed.map(([r, n]) => `${netBadges({ redes: [r] })} ${n} ${n === 1 ? 'pieza' : 'piezas'}`).join(' · ')}</span></div>${colaHTML}</section>
        </div>
        <aside class="ct-aside" aria-label="Ideas sin día">
          <section class="ct-sec"><div class="ct-sh"><h3>Ideas sin día <b>${sinDia.length}</b></h3><button type="button" class="pz-btn" data-new="idea">+ Nueva idea</button></div>
          ${sinDia.length ? sinDia.map(p => filaCola(p, { accion: false })).join('') : '<p class="ct-empty">Ninguna idea suelta.</p>'}</section>
        </aside>
      </div>`;
    const focused = E.prog.contains(document.activeElement) ? (document.activeElement.dataset.open || document.activeElement.dataset.ok || document.activeElement.dataset.gap) : null;
    if (html !== lastProg) { E.prog.innerHTML = html; lastProg = html; if (focused) E.prog.querySelector(`[data-open="${CSS.escape(focused)}"], [data-ok="${CSS.escape(focused)}"], [data-gap="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true }); }
    E.stats.innerHTML = `<span><b>${accion.length}</b> requieren acción</span><span><b>${futuras.filter(p => p.estado === 'aprobada').length}</b> aprobadas</span><span><b>${[...dias.values()].slice(0, 14).filter(l => !l.length).length}</b> huecos en 14 días</span>`;
  }

  /* ---------- el panel de una pieza ---------- */
  function onPanel(p, info = {}) {
    if (!p) return;
    if (info.eliminar) { if (p.id) later('p:' + p.id, `Eliminada: «${titleOf(p).slice(0, 60)}».`, () => datos.remove(p.id)); return; } // se va al momento; a los 8 segundos llega a la papelera de las piezas
    if (p.id && !info.cerrada) { // lo que se está escribiendo llega a la lista al momento, con su revisión recalculada (la del servidor es de antes del cambio)
      const r = revisarPublicacion(postDePieza(p), p.redes), q = { ...p, revision: { errores: r.errores, avisos: r.avisos, arreglos: r.arreglos } };
      for (const list of [pieces, cola]) { const i = list.findIndex(x => x.id === p.id); if (i >= 0) list[i] = { ...list[i], ...q }; else list.push(q); }
      if (info.creada) note('Guardada como borrador.'); }
    if (info.cerrada) { ov.classList.remove('panelOpen'); load(true); return; }
    if (openNow) { render(); loadResumen(); }
  }
  const empresa = () => { const b = String(business() || '').trim(); return /agents office/i.test(b) ? '' : b; };
  const panel = initPieza({ host: E.panelHost, datos, esc, note, onChange: onPanel, otras: () => todasConocidas(), cuenta: () => cuentas, medidaDe: id => medidas[id] || null,
    openEstudio: p => { const t = { id: p.id, titulo: titleOf(p) }; openStudio(t, ids => { open(); openPiece(p.id, ids); }); }, pickMedia: cur => pickMedia(cur) });
  async function openPiece(id, addIds) {
    if (!openNow) open();
    let p = todasConocidas().find(x => x.id === id);
    if (!p) { await load(true); p = todasConocidas().find(x => x.id === id); }
    if (!p) { note('Esa pieza ya no está.', true); return; }
    await panel.flush(); panel.open(p); if (addIds?.length) panel.addMedios(addIds); render();
  }
  async function openNew(extra) { flushUndo(); closeMenu(); await panel.flush(); panel.open(extra); render(); }
  /** «+ Crear» con un formato: el siguiente hueco libre, a las 18:00, en las dos redes (una historia, solo Instagram). */
  function crear(formato) {
    const redes = formato === 'historia' ? ['instagram'] : ['instagram', 'facebook'];
    openNew({ formato, redes, fecha: siguienteHueco(redes, todasConocidas().filter(p => p.estado !== 'idea')), hora: '18:00' });
  }
  function closeMenu(focus) { if (E.newMenu.hidden) return; E.newMenu.hidden = true; E.newBtn.setAttribute('aria-expanded', 'false'); if (focus) E.newBtn.focus(); }

  /* ---------- elegir de la galería del Estudio ---------- */
  function pickMedia(actuales = []) {
    return new Promise(async resolve => {
      const dlg = document.createElement('div'); dlg.className = 'ct-pick'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'ctPickT'); dlg.setAttribute('data-modal-keep', '');
      dlg.innerHTML = `<div class="ct-pickbox"><div class="ct-pickh"><h3 id="ctPickT">Elegir de la galería del Estudio</h3><span class="sp"></span><button type="button" class="pz-x" data-a="x" aria-label="Cerrar">✕</button></div><div class="ct-pickg" role="group" aria-label="Archivos"><p class="ct-empty">Cargando…</p></div><div class="ct-pickf"><span class="pz-state" role="status"></span><span class="sp"></span><button type="button" class="pz-go" data-a="ok" disabled>Usar</button></div></div>`;
      ov.appendChild(dlg); modal.open(dlg); const from = document.activeElement;
      const sel = new Set(); const grid = dlg.querySelector('.ct-pickg'), ok = dlg.querySelector('[data-a="ok"]'), st = dlg.querySelector('.pz-state');
      let items = [];
      try { items = served ? (await (await fetch('/api/media')).json()).items || [] : Object.entries(DEMO_MEDIOS).map(([file, m]) => ({ file, kind: /\.mp4$/.test(file) ? 'video' : 'image', w: m.ancho, h: m.alto, duration: m.duracion, prompt: 'Muestra ' + file.slice(5) })); } catch { items = []; }
      items = items.filter(it => it.kind !== 'audio');
      for (const it of items) { const m = medidaDeItem(it); if (m) medidas[it.file] = m; }
      items = items.filter(it => !actuales.includes(it.file));
      const dim = it => { const m = medidas[it.file]; return m?.ancho ? (m.ancho > 30 ? `${m.ancho}×${m.alto}` : `${m.ancho}:${m.alto}`) + (m.duracion ? ` · ${Math.round(m.duracion)} s` : '') : ''; };
      grid.innerHTML = items.length ? items.slice(0, 200).map(it => `<button type="button" class="ct-pk" data-f="${esc(it.file)}" aria-pressed="false" title="${esc(String(it.prompt || it.file).slice(0, 140))}">${thumbHTML(it.file, esc, 'pz-pt')}<span>${esc(String(it.prompt || it.file).slice(0, 48))}</span>${dim(it) ? `<small>${dim(it)}</small>` : ''}</button>`).join('') : `<p class="ct-empty">${served ? 'La galería del Estudio está vacía. Crea algo con «Crear con el Estudio».' : 'Sin archivos en la demo.'}</p>`;
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

  /* ---------- mover: arrastrar a otro día, al banco de ideas, o con el teclado ---------- */
  async function mover(p, fecha, hora) {
    if (fecha === p.fecha && hora === p.hora) { render(); return; }
    const antes = { fecha: p.fecha, hora: p.hora }, eraAprobada = p.estado === 'aprobada';
    note('Moviendo…');
    try {
      const r = await datos.patch(p.id, { fecha, hora });
      const put = x => { for (const list of [pieces, cola]) { const i = list.findIndex(y => y.id === x.id); if (i >= 0) list[i] = { ...x, medidas: list[i].medidas }; } };
      put(r.pieza); if (panel.current()?.id === p.id) panel.refresh(r.pieza); render(); loadResumen();
      const donde = r.pieza.fecha ? `al ${fmtDay(at(r.pieza))}${r.pieza.hora ? ' · ' + r.pieza.hora : ''}` : 'al banco de ideas (sin día)';
      if (r.soltada || eraAprobada) undoable(`Movida ${donde}. Ya no está aprobada: el OK era para otra fecha.`, async () => { const b = await datos.patch(p.id, antes); put(b.pieza); try { const a = await datos.approve(p.id); put(a.pieza); } catch {} render(); loadResumen(); });
      else note(`Movida ${donde}.`);
    } catch (e) { render(); note('No se pudo mover: ' + e.message, true); }
  }
  async function dropOn(day, d) {
    if (d.kind !== 'p') return;
    const p = todasConocidas().find(x => x.id === d.id); if (!p) return;
    const fecha = day.dataset.day, hora = day.dataset.hour !== undefined ? `${String(day.dataset.hour).padStart(2, '0')}:${p.hora && +p.hora.slice(0, 2) === +day.dataset.hour ? p.hora.slice(3) : '00'}` : p.hora;
    if (hora && fecha && new Date(`${fecha}T${hora}:00`).getTime() < Date.now()) { render(); note('Esa hora de hoy ya pasó: suéltala más tarde.', true); return; }
    await mover(p, fecha, hora);
  }
  dnd = attachDnd({ root: ov, grid: E.grid, onStart: () => {}, onDrop: (day, d) => dropOn(day, d), onCancel: () => render() });
  // el banco de ideas también es un destino: soltar ahí le quita el día (CON-18)
  E.railBox.addEventListener('dragover', e => { if (dnd.dragging?.kind === 'p') { e.preventDefault(); E.railBox.classList.add('drop'); } });
  E.railBox.addEventListener('dragleave', e => { if (!E.railBox.contains(e.relatedTarget)) E.railBox.classList.remove('drop'); });
  E.railBox.addEventListener('drop', e => { E.railBox.classList.remove('drop'); const d = dnd.dragging; if (d?.kind !== 'p') return; e.preventDefault(); const p = todasConocidas().find(x => x.id === d.id); if (p && p.fecha) mover(p, '', ''); });

  /* ---------- eventos ---------- */
  ov.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('#ctNew')) { const on = E.newMenu.hidden; E.newMenu.hidden = !on; E.newBtn.setAttribute('aria-expanded', on); if (on) E.newMenu.querySelector('button').focus(); return; }
    const nf = t.closest('[data-newf]'); if (nf) { crear(nf.dataset.newf); return; }
    if (!E.newMenu.hidden && !t.closest('.ct-create')) closeMenu();
    const b = t.closest('.ct-mode button'); if (b) { mode = b.dataset.m; store.set('mode', mode); await panel.flush(); if (mode === 'prog') await loadCola(); render(); return; }
    const v = t.closest('.ct-views button'); if (v) { view = v.dataset.v; store.set('view', view); load(); render(); return; }
    if (t.closest('[data-filters]')) { const on = !ov.classList.contains('chipsOpen'); ov.classList.toggle('chipsOpen', on); t.closest('[data-filters]').setAttribute('aria-expanded', on); return; }
    if (t.closest('[data-banner]')) { try { localStorage.setItem('ao.ct.metaBanner', '0'); } catch {} render(); E.prog.querySelector('h3')?.setAttribute('tabindex', '-1'); E.prog.querySelector('h3')?.focus(); return; }
    const chip = t.closest('.cv-chip'); if (chip) {
      if (chip.dataset.e) { estadoOn.has(chip.dataset.e) ? estadoOn.delete(chip.dataset.e) : estadoOn.add(chip.dataset.e); if (!estadoOn.size) estadoOn = new Set(ORDEN); store.set('estados', [...estadoOn]); }
      else if (chip.dataset.r) { redOn.has(chip.dataset.r) ? redOn.delete(chip.dataset.r) : redOn.add(chip.dataset.r); if (!redOn.size) redOn = new Set(Object.keys(RED)); store.set('redes', [...redOn]); }
      render(); E.chips.querySelector(chip.dataset.e ? `[data-e="${chip.dataset.e}"]` : `[data-r="${chip.dataset.r}"]`)?.focus(); return;
    }
    const ok = t.closest('[data-ok]'); if (ok) { e.stopPropagation(); await aprobar(ok.dataset.ok, ok); return; }
    if (t.closest('[data-okall]')) { await aprobarTodas(); return; }
    const gap = t.closest('[data-gap]'); if (gap) { openNew({ fecha: gap.dataset.gap, hora: '18:00' }); return; }
    const open_ = t.closest('[data-open]'); if (open_) { openPiece(open_.dataset.open); return; }
    const nw = t.closest('[data-new]'); if (nw) { openNew({}); return; }
    const evc = t.closest('.cv-ev, .cv-bk'); if (evc) { openPiece(evc.dataset.ev.slice(2)); return; }
    const more = t.closest('.cv-more'); if (more) { openMore(more.dataset.day, more.closest('.cv-day')); return; }
    const dh = t.closest('.cv-tg-d'); if (dh && view === 'week') { anchor = new Date(dh.dataset.day + 'T00:00:00').getTime(); view = 'day'; load(); render(); return; }
    const add = t.closest('.cv-add'); if (add) { const cell = add.closest('.cv-day'); if (cell.classList.contains('past')) { note('Ese día ya pasó: elige uno que venga.', true); return; } openNew({ fecha: cell.dataset.day, hora: cell.dataset.hour !== undefined ? String(cell.dataset.hour).padStart(2, '0') + ':00' : '' }); return; }
    const vd = t.closest('[data-vday]'); if (vd) { anchor = new Date(vd.dataset.vday + 'T00:00:00').getTime(); view = 'day'; closePop(); load(); render(); return; }
    const rb = t.closest('[data-rail]'); if (rb) { ov.classList.toggle('railOpen'); rb.setAttribute('aria-expanded', ov.classList.contains('railOpen')); return; }
    if (t.closest('#ctClose')) { close(); return; }
    if (t.closest('#ctKeys')) { dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); return; }
    if (t.closest('#ctPrev')) { step(-1); return; } if (t.closest('#ctNext')) { step(1); return; }
    if (t.closest('#ctToday')) { anchor = startOfDay(Date.now()); tgKey = ''; load(); render(); return; }
    const day = t.closest('.cv-day'); if (day && mode === 'cal' && !E.pop.contains(t) && (t === day || t.classList.contains('cv-evs') || t.closest('.cv-num'))) {
      if (day.classList.contains('past')) { if (view === 'month') note('Ese día ya pasó: no se programa hacia atrás.'); return; } // CON-06: un día que pasó no abre una pieza nueva
      openNew({ fecha: day.dataset.day, hora: day.dataset.hour !== undefined ? String(day.dataset.hour).padStart(2, '0') + ':00' : '' }); return;
    }
    if (!E.pop.hidden && !E.pop.contains(t)) closePop();
    if (ov.classList.contains('railOpen') && !t.closest('.cv-rail') && !t.closest('[data-rail]')) ov.classList.remove('railOpen');
  });
  ov.addEventListener('keydown', e => {
    if (!E.newMenu.hidden && e.target.closest('.ct-newmenu')) {
      const its = [...E.newMenu.querySelectorAll('button')], i = its.indexOf(e.target);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length].focus(); return; }
      if (e.key === 'Tab') closeMenu();
    }
    const card = e.target.closest && e.target.closest('.cv-ev, .cv-bk, [data-open]');
    // mover con el teclado (CON-18): Mayús + ←/→ un día, Mayús + ↑/↓ un cuarto de hora
    if (card && card.dataset.ev && e.shiftKey && /^Arrow/.test(e.key)) {
      e.preventDefault(); e.stopPropagation(); const p = todasConocidas().find(x => x.id === card.dataset.ev.slice(2)); if (!p || !p.fecha) return;
      const d = new Date(`${p.fecha}T${p.hora || '09:00'}:00`);
      if (e.key === 'ArrowLeft') d.setDate(d.getDate() - 1); else if (e.key === 'ArrowRight') d.setDate(d.getDate() + 1); else if (e.key === 'ArrowUp') d.setMinutes(d.getMinutes() - 15); else d.setMinutes(d.getMinutes() + 15);
      if (d.getTime() < Date.now()) { note('Eso ya pasó.', true); return; }
      mover(p, ymd(d), (e.key === 'ArrowUp' || e.key === 'ArrowDown' || p.hora) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '').then(() => E.grid.querySelector(`[data-ev="p:${CSS.escape(p.id)}"]`)?.focus());
      return;
    }
    if (card && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('button:not(.cv-ev)')) { e.preventDefault(); e.stopPropagation(); openPiece((card.dataset.ev || 'p:' + card.dataset.open).slice(2)); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || mode !== 'cal' || e.target.closest('.ct-panel')) return;
    if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 't' || e.key === 'T') { anchor = startOfDay(Date.now()); load(); render(); }
    else if (e.key === 'w' || e.key === 'W') { view = 'week'; load(); render(); } else if (e.key === 'm' || e.key === 'M') { view = 'month'; load(); render(); }
    else if (e.key === 'a' || e.key === 'A') { view = 'agenda'; load(); render(); } else if (e.key === 'd' || e.key === 'D') { view = 'day'; load(); render(); }
  });
  ov.addEventListener('dblclick', e => { const day = e.target.closest('.cv-day[data-day]'); if (!day || view !== 'month' || e.target.closest('.cv-ev')) return; anchor = new Date(day.dataset.day + 'T00:00:00').getTime(); view = 'day'; load(); render(); });
  $('.ct-vsel').addEventListener('change', e => { view = e.target.value; store.set('view', view); load(); render(); });
  E.search.addEventListener('input', () => { q = E.search.value.trim().toLowerCase(); render(); });
  E.search.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { E.search.value = ''; q = ''; render(); E.search.blur(); } });
  function step(n) { anchor = stepAnchor(view, anchor, n); closePop(); load(); render(); }
  const put = x => { for (const list of [pieces, cola]) { const i = list.findIndex(y => y.id === x.id); if (i >= 0) list[i] = { ...x, medidas: list[i].medidas }; } };
  async function aprobar(id, btn) {
    const p = todasConocidas().find(x => x.id === id);
    if (btn?.getAttribute('aria-disabled') === 'true') { const m = p?.fecha ? revisarMomento(p.fecha, p.hora) : null; note(!p?.fecha ? 'Ponle un día antes de aprobarla.' : m?.errores[0] || p.revision?.errores?.[0] || 'Todavía no puede salir.', true); return; }
    try { const r = await datos.approve(id); put(r.pieza); render(); loadResumen(); note('Aprobada. Queda lista en la cola.'); }
    catch (e) { note(e.message, true); }
  }
  async function aprobarTodas() {
    const lista = todasConocidas().filter(p => p.estado === 'revision' && !errN(p) && p.fecha && p.hora && !revisarMomento(p.fecha, p.hora).errores.length && visible(p)); let ok = 0, mal = 0;
    for (const p of lista) { try { const r = await datos.approve(p.id); put(r.pieza); ok++; } catch { mal++; } }
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
  /** Con qué cuenta sale: la de Meta si Analíticas ya la conoce; si no, el nombre de la empresa (CON-19, PRE-08). */
  async function loadCuentas() {
    cuentas = { ...cuentas, empresa: empresa() };
    if (!served) return;
    try { const j = await (await fetch('/api/contenido/analiticas?dias=7')).json(); for (const c of j.meta?.cuentas || []) if (!cuentas[c.red]) cuentas[c.red] = { nombre: c.nombre, usuario: c.usuario || '' }; } catch {}
    const ig = cuentas.instagram?.usuario ? '@' + cuentas.instagram.usuario : '', fb = cuentas.facebook?.nombre || '';
    $('#ctCo').textContent = [ig, fb].filter(Boolean).join(' · ') || cuentas.empresa;
    if (panel.isOpen()) panel.repaintPreview();
  }

  /* ---------- abrir y cerrar ---------- */
  const isOn = () => openNow;
  function open() {
    if (openNow) return; views.opening('contenido'); openNow = true; opener = document.activeElement;
    mode = store.get('mode', 'cal'); view = store.get('view', 'month'); if (narrow() && (view === 'month' || view === 'week')) view = 'agenda';
    ov.inert = false; modal.open(ov); cuentas.empresa = empresa(); $('#ctCo').textContent = cuentas.empresa; ov.classList.add('on'); document.body.classList.add('ctOpen');
    lastGrid = ''; lastProg = ''; render(); load(true); loadResumen(); loadCuentas(); ov.tabIndex = -1; ov.focus();
    timer = setInterval(() => { if (!document.hidden && !panel.isOpen()) load(true); }, 20000); // lo que dejan los agentes aparece solo
  }
  async function close(o = {}) {
    if (!openNow) return; flushUndo(); closeMenu(); await panel.close({ quiet: true }); openNow = false; closePop(); modal.close(ov); ov.inert = true; ov.classList.remove('on'); document.body.classList.remove('ctOpen'); clearInterval(timer); timer = null;
    if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); loadResumen();
  }
  views.add('contenido', { isOpen: isOn, close });
  addEventListener('resize', () => { if (openNow && mode === 'cal' && view === 'month') { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!(dnd && dnd.dragging)) { lastGrid = ''; render(); } }, 150); } }); let resizeT = 0;
  return {
    open, close, toggle: () => (openNow ? close() : open()), isOpen: isOn, openPiece,
    refresh: () => { if (openNow && !panel.isOpen()) load(true); else loadResumen(); },
    panelOpen: () => panel.isOpen(), closePanel: () => panel.close(), popOpen: () => !E.pop.hidden, closePop,
    /** Lo que hay en un rango de días, para la capa del calendario de tareas (solo lectura). */
    async between(desde, hasta) { try { return (await datos.list({ desde, hasta })).piezas; } catch { return []; } },
    /** Desde el Estudio: una imagen o un video pasa a ser una pieza nueva (sin día, como idea) y se abre para terminarla. */
    async fromMedia(file, kind, prompt) {
      try { const p = await datos.create({ titulo: String(prompt || '').slice(0, 60), formato: kind === 'video' ? 'reel' : 'post', medios: [file], estado: 'idea', redes: ['instagram', 'facebook'] }); open(); pieces.push(p); cola.push(p); await openPiece(p.id); return p; }
      catch (e) { return { error: e.message }; }
    },
  };
}
