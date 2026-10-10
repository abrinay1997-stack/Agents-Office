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
import { DOW, MONTHS, DAY, ymd, startOfDay, fmtDay, rangeOf, stepAnchor, titleHTML, dowHTML, monthHTML, timeGridHTML, agendaHTML, fitMonth, DOW_LONG, dateOpts } from './calendar-core.js';
import { attachDnd } from './calendar-dnd.js';
import { crearDatos, DEMO_MEDIOS } from './contenido-datos.js';
import { ESTADO, FORMATO, RED, FICON, thumbHTML } from './pieza-base.js';
import { iconoRed } from './redes-iconos.js';
import { panelBajoDemanda } from './pieza-carga.js'; // C1 (8 oct 2026): el editor de la pieza llega en su propio paquete (dist/pieza-editor.js)
import { cuentaAtras, siguienteHueco, vencida, requiereAccion, colaPorDia, motivoPasado, deshacerMover, textoSalida, cuotaTxt } from './contenido-cola.js';
import { revisarPublicacion, postDePieza, revisarMomento, medidaDeItem, CON_HISTORIAS, formatoDe } from './contenido-reglas.js';
import { nivel as nivelHora, FUENTE as FUENTE_HORA } from './contenido-hora.js';
import { initBandeja } from './contenido-bandeja.js';
import { casillas, intercambio, perfilHTML } from './contenido-perfil.js';
import * as GF from './galeria-filtro.js';
import { cuentaCorta, saleEn, nombreCorto } from './contenido-cuentas.js'; // 9 oct 2026: a qué cuenta sale cada pieza
import { cifrasTxt, numeroCorto, sumaResultados } from './contenido-publicadas.js'; // C2 (8 oct 2026): lo ya publicado, con sus resultados // INF-03: el selector busca y pagina sobre TODA la galería del Estudio

const ORDEN = ['idea', 'borrador', 'revision', 'aprobada'];
const store = { get(k, d) { try { const v = localStorage.getItem('ao.ct.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('ao.ct.' + k, JSON.stringify(v)); } catch {} } };
// sin hora, la pieza se pinta al principio del día y dice «sin hora» (no se inventa un 09:00 ni un 23:59): no puede aprobarse así
const at = p => { if (!p.fecha) return 0; const [h, m] = (p.hora || '00:00').split(':').map(Number); return new Date(`${p.fecha}T00:00:00`).setHours(h, m, 0, 0); };
// C2 (8 oct 2026): una red que sale con OTRO formato (reel en Instagram, post en Facebook) lleva su icono al lado
const netBadges = (p, cls = '') => p.redes.map(r => `<b class="pz-nb ${r}${cls}" aria-hidden="true">${iconoRed(r)}</b>${p.formatos?.[r] ? `<span class="pz-nf" aria-hidden="true">${FICON[p.formatos[r]] || ''}</span>` : ''}`).join('');
const redesTxt = p => p.redes.map(r => `${RED[r]?.name || r}${p.formatos?.[r] ? ` (${(FORMATO[p.formatos[r]] || p.formatos[r]).toLowerCase()})` : ''}`).join(' y ');
/** C2 (8 oct 2026): lo ya publicado — una publicación de Meta (Analíticas) que no salió de ninguna pieza, y los resultados de las que sí. */
const TIPO_PUB = { imagen: 'post', carrusel: 'carrusel', reel: 'reel', video: 'reel', texto: 'post' };
const OJO = '<svg class="pz-ojo" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="2.1" fill="currentColor"/></svg>';
const resHTML = r => `<div class="pz-res"><span><b>${numeroCorto(r.alcance)}</b> de alcance</span><span><b>${numeroCorto(r.interacciones)}</b> ${r.interacciones === 1 ? 'interacción' : 'interacciones'}</span></div>`;
/** La zona horaria de las horas de Contenido (las del reloj de la máquina de la oficina; en la demo, las de este navegador). */
const zonaLocal = () => { const m = -new Date().getTimezoneOffset(); return { nombre: Intl.DateTimeFormat().resolvedOptions().timeZone || '', utc: `UTC${m < 0 ? '−' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}` }; };
const ciudadDe = z => (String(z?.nombre || '').includes('/') ? String(z.nombre).split('/').pop().replace(/_/g, ' ') : ''); // «America/Panama» → «Panama»; «UTC» no es un lugar
/** C2: el texto que sale, sin lo que ya dice la tarjeta en negrita (el título, o su primera línea). */
const resto = (p, titulo) => { const t = String(p.texto || '').replace(/\s+/g, ' ').trim(); if (!t) return ''; return p.titulo ? t : t.slice(titulo.length).replace(/^[\s.,:;—-]+/, ''); };
export function initContenido({ served, esc, agentName = id => id, openStudio = () => {}, business = () => '' }) {
  const datos = crearDatos({ served });
  const ov = document.createElement('div');
  ov.id = 'ctOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('data-view', ''); ov.setAttribute('aria-label', 'Contenido'); ov.inert = true;
  ov.innerHTML = `
    <div class="cv-band">
      <div class="cv-brand">CONTENIDO <small id="ctCo"></small></div>
      <div class="ct-create"><button type="button" class="ct-new" id="ctNew" aria-haspopup="true" aria-expanded="false" aria-label="Crear una pieza" title="Crear una pieza">+<span class="ct-newt"> Crear</span></button>
        <div class="ct-newmenu" role="menu" aria-label="Qué crear" hidden>${Object.entries(FORMATO).map(([k, l]) => `<button type="button" role="menuitem" data-newf="${k}">${FICON[k]}${l}</button>`).join('')}<p class="ct-newhint">Se abre con el siguiente hueco libre y las dos redes.</p><button type="button" role="menuitem" data-tplnew>Desde una plantilla…</button><button type="button" role="menuitem" data-llenar>Llenar la semana…</button></div></div>
      <div class="cv-seg ct-mode" role="group" aria-label="Qué ver"><button type="button" data-m="cal" aria-pressed="true">CALENDARIO</button><button type="button" data-m="prog" aria-pressed="false"><span class="ct-ml">PROGRAMACIÓN</span><span class="ct-ms">COLA</span><b class="ct-n" hidden></b></button><button type="button" data-m="bandeja" aria-pressed="false">BANDEJA<b class="ct-n ct-nbj" hidden></b></button></div>
      <div class="cv-seg ct-views" role="group" aria-label="Vista del calendario"><button type="button" data-v="agenda">AGENDA</button><button type="button" data-v="day">DÍA</button><button type="button" data-v="week">SEMANA</button><button type="button" data-v="month" class="on">MES</button><button type="button" data-v="perfil" title="Así queda tu perfil de Instagram">PERFIL</button></div>
      <div class="cv-nav"><button id="ctPrev" type="button" aria-label="Anterior" title="anterior (←)">‹</button><div id="ctTitle"></div><button id="ctNext" type="button" aria-label="Siguiente" title="siguiente (→)">›</button><button id="ctToday" type="button" title="hoy (T)">HOY</button><select class="ct-vsel" aria-label="Vista del calendario"><option value="agenda">Agenda</option><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option><option value="perfil">Perfil de Instagram</option></select></div>
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
      <div class="ct-bj" hidden></div>
      <aside class="ct-panel" hidden></aside>
      <div class="ct-hov" aria-hidden="true" hidden></div>
    </div>
    <div class="cv-toast" hidden role="status"><span></span><button type="button">DESHACER</button></div>
    <div id="ctPop" hidden></div>`;
  document.body.appendChild(ov);
  const $ = s => ov.querySelector(s);
  const E = { bj: $('.ct-bj'), title: $('#ctTitle'), dow: $('#ctDow'), grid: $('#ctGrid'), chips: $('#ctChips'), stats: $('#ctStats'), search: $('#ctSearch'), rail: $('.ct-rail'), railBox: $('.cv-rail'), prog: $('.ct-prog'), wrap: $('.cv-wrap'), panelHost: $('.ct-panel'), hov: $('.ct-hov'), pop: $('#ctPop'), toast: $('.cv-toast'), views: $('.ct-views'), mode: $('.ct-mode'), newBtn: $('#ctNew'), newMenu: $('.ct-newmenu') };
  const narrow = () => matchMedia('(max-width: 760px)').matches;
  let tgKey = '', tgScroll = 0; // which week or day the time grid shows, and where it was scrolled to (a re-render keeps it), as in the tasks calendar
  let colaInfo = null; // M1: el modo y el conductor (GET /api/contenido/cola)
  // C2 (8 oct 2026): lo ya publicado del rango (Analíticas) — resultados por pieza y las publicaciones que no salieron de ninguna
  let pubs = { porPieza: {}, sueltas: [], fuente: 'ninguna' }, pubsJSON = '', pubOn = store.get('pub', true), zona = null, lastStats = '';
  let horaRedSel = store.get('horaRed', ''); // las mejores horas de UNA red ('' = las tuyas, juntas); el editor recuerda la misma
  const pubsPorId = () => new Map(pubs.sueltas.map(m => [m.id, m]));
  const resOf = p => { const l = pubs.porPieza[p.id]; return l?.length ? sumaResultados(l) : null; };
  const setStats = h => { if (h !== lastStats) { E.stats.innerHTML = h; lastStats = h; } };
  let openNow = false, mode = 'cal', view = 'month', anchor = startOfDay(Date.now()), q = '', pieces = [], cola = [], resumen = null, loadedKey = '', errorMsg = '', timer = null, opener = null, dnd = null, lastGrid = '', lastProg = '';
  // plan M5 · U7: selección múltiple en Programación — aprobar, pasar a revisión, mover de día o a la papelera, varias de una vez
  const selP = new Set();
  const selBarHTML = () => { const ids = [...selP].filter(id => todasConocidas().some(p => p.id === id)); if (!ids.length) return '';
    return `<div class="ct-selbar" role="toolbar" aria-label="Con las seleccionadas"><b>${ids.length} ${ids.length === 1 ? 'seleccionada' : 'seleccionadas'}</b><button type="button" class="pz-btn" data-selacc="aprobar">Aprobar las que pueden salir</button><button type="button" class="pz-btn" data-selacc="revision">Pasar a revisión</button><label class="ct-selmv">Mover al <select class="pz-sel" data-selmover><option value="">elige un día…</option>${dateOpts('')}</select></label><button type="button" class="pz-btn warn" data-selacc="borrar">A la papelera</button><button type="button" class="pz-lk" data-selacc="ninguna">Ninguna</button></div>`; };
  let estadoOn = new Set(store.get('estados', ORDEN)), redOn = new Set(store.get('redes', Object.keys(RED)));
  // M2 (6 oct 2026): las redes que usa el negocio (Ajustes → Contenido), más las que ya tenga alguna pieza: solo esas salen en los filtros y en el resumen
  let redesNegocio = ['instagram', 'facebook'];
  // plan M3: la mejor hora de las redes a la vista (Metricool o lo ya publicado), para sombrear la semana y sugerir en el panel
  const horas = new Map(); let horaInfo = null;
  async function mejorHora(redes) {
    const k = [...redes].sort().join(','), c = horas.get(k);
    if (c && Date.now() - c.t < 10 * 60e3) return c.v;
    const v = await datos.mejorHora(redes).catch(() => null); horas.set(k, { t: Date.now(), v }); return v;
  }
  const redesHora = () => (horaRedSel && redesUsadas().includes(horaRedSel) ? [horaRedSel] : redesUsadas().filter(r => redOn.has(r)));
  async function loadHora() { const v = await mejorHora(redesHora()); if (JSON.stringify(v?.grid) !== JSON.stringify(horaInfo?.grid) || v?.fuente !== horaInfo?.fuente) { horaInfo = v; if (view !== 'month' && view !== 'agenda' && mode !== 'prog') render(); } }
  /** C2: lo publicado en los días pasados del rango; se repinta solo si cambió. */
  async function loadPubs(w) {
    if (!datos.publicadas) return;
    const hoy = ymd(new Date()), hasta = w.hasta < hoy ? w.hasta : hoy;
    if (w.desde > hasta) { if (pubsJSON) { pubsJSON = ''; pubs = { porPieza: {}, sueltas: [], fuente: pubs.fuente }; if (openNow) render(); } return; }
    try { const r = await datos.publicadas({ desde: w.desde, hasta }); const j = JSON.stringify(r); if (j !== pubsJSON) { pubsJSON = j; pubs = { porPieza: r.porPieza || {}, sueltas: r.sueltas || [], fuente: r.fuente || 'ninguna' }; if (openNow && mode === 'cal') render(); } } catch {}
  }
  const fuenteHora = v => (v?.fuente === 'ejemplo' ? 'de ejemplo' : FUENTE_HORA[v?.fuente] || 'según Metricool y lo ya publicado');
  const redesUsadas = () => { const u = new Set(redesNegocio); for (const p of todasConocidas()) for (const r of p.redes) u.add(r); return Object.keys(RED).filter(r => u.has(r)); };
  const gone = new Set(); let undoT = null, commitFn = null, undoFn = null, noteT = null;
  const medidas = { ...DEMO_MEDIOS }; // lo que se sabe de cada archivo del Estudio (de /api/media al elegir): la vista previa y las reglas lo usan
  let cuentas = { empresa: '' };
  let ctas = null, ctaSel = store.get('cuenta', ''); // 9 oct 2026: GET /api/contenido/cuentas y el filtro por cuenta (ao.ct.cuenta)
  const ctaTxt = p => cuentaCorta(p, ctas), ctaHTML = p => (ctaTxt(p) ? `<span class="pz-cta">${esc(ctaTxt(p))}</span>` : '');

  /* ---------- avisos y deshacer (el mismo gesto que el calendario de tareas: se va al momento, con 8 segundos para volver) ---------- */
  /** Con el panel de una pieza abierto, el aviso va sobre el PANEL y por encima de su pie: centrado en la vista tapaba «Aprobar»,
   *  «Pasar a revisión» y «Quitar el OK» (el cajón mide 840 px) los 8 s del DESHACER. Sin panel, vuelve a su sitio de siempre. */
  function placeToast() {
    const t = E.toast, foot = panel.isOpen() && !E.panelHost.hidden && E.panelHost.querySelector('.pz-foot');
    t.classList.toggle('sobrePanel', !!foot);
    if (!foot) { t.style.left = t.style.bottom = t.style.maxWidth = ''; return; }
    const o = ov.getBoundingClientRect(), pr = E.panelHost.getBoundingClientRect(), fr = foot.getBoundingClientRect();
    t.style.left = `${Math.round(pr.left - o.left + pr.width / 2)}px`; t.style.bottom = `${Math.round(o.bottom - fr.top + 10)}px`; t.style.maxWidth = `${Math.round(pr.width - 24)}px`;
  }
  function showToast() { E.toast.hidden = false; placeToast(); }
  function note(msg, bad) { if (commitFn || undoFn) return; E.toast.querySelector('span').textContent = msg; E.toast.querySelector('button').hidden = true; E.toast.classList.toggle('bad', !!bad); showToast(); clearTimeout(noteT); noteT = setTimeout(() => { if (!commitFn && !undoFn) E.toast.hidden = true; }, bad ? 7000 : 4500); }
  function flushUndo() { clearTimeout(undoT); undoT = null; E.toast.hidden = true; undoFn = null; const f = commitFn; commitFn = null; if (f) f(); }
  function later(key, label, commit) {
    flushUndo(); gone.add(key); render();
    commitFn = async () => { try { await commit(); } catch (e) { note('No se pudo: ' + e.message, true); } gone.delete(key); load(true); };
    E.toast.querySelector('span').textContent = label; E.toast.querySelector('button').hidden = false; E.toast.classList.remove('bad'); clearTimeout(noteT); showToast();
    E.toast.querySelector('button').onclick = () => { clearTimeout(undoT); commitFn = null; E.toast.hidden = true; gone.delete(key); render(); note('Deshecho.'); };
    undoT = setTimeout(flushUndo, 8000);
  }
  /** Ya hecho, con 8 segundos para volver atrás (mover una pieza aprobada le quita el OK: DESHACER la devuelve y la vuelve a aprobar). */
  function undoable(label, undo) {
    flushUndo(); undoFn = undo;
    E.toast.querySelector('span').textContent = label; E.toast.querySelector('button').hidden = false; E.toast.classList.remove('bad'); clearTimeout(noteT); showToast();
    E.toast.querySelector('button').onclick = async () => { clearTimeout(undoT); const f = undoFn; undoFn = null; E.toast.hidden = true; try { const r = await f(); if (r && r.aviso) note(r.aviso, r.mal); else note('Deshecho.'); } catch (e) { note('No se pudo deshacer: ' + e.message, true); } };
    undoT = setTimeout(() => { undoFn = null; E.toast.hidden = true; }, 8000);
  }

  /* ---------- cargar ---------- */
  const range = () => rangeOf(view, anchor, 1);
  function want() { if (view === 'perfil') { const h = Date.now(); return { desde: ymd(new Date(h - 120 * DAY)), hasta: ymd(new Date(h + 120 * DAY)) }; } const r = range(); const a = new Date(r.from - 7 * DAY), b = new Date(r.to + 7 * DAY); return { desde: ymd(a), hasta: ymd(b) }; }
  const conMedidas = list => { for (const p of list) { if (p.medidas) Object.assign(medidas, p.medidas); p.medidas = { ...Object.fromEntries((p.medios || []).concat(p.historias || []).filter(m => medidas[m]).map(m => [m, medidas[m]])), ...(p.medidas || {}) }; } return list; };
  async function load(force = false) {
    const w = want(), key = `${w.desde}|${w.hasta}`;
    if (!force && key === loadedKey && pieces.length) { if (mode === 'prog') loadCola(); return; }
    try { const r = await datos.list({ ...w, sinFecha: true }); pieces = conMedidas(r.piezas || []); resumen = r.resumen || resumen; if (r.ajustes?.redes?.length) redesNegocio = r.ajustes.redes; if (r.ajustes?.zona) zona = r.ajustes.zona; loadedKey = key; errorMsg = ''; loadHora(); loadPubs(w); if (!bjCargada || mode === 'bandeja') { bjCargada = true; bj.load(); } }
    catch (e) { errorMsg = e.message || 'No pude leer las piezas'; }
    if (mode === 'prog' || force) await loadCola();
    if (openNow) render(); paintDock();
  }
  /** La cola tiene su propia carga: de hace 14 días (para ver lo vencido) en adelante, sin tope, más las ideas sin día. */
  async function loadCola() { try { colaInfo = await datos.cola(); } catch {} try { const r = await datos.list({ desde: ymd(new Date(Date.now() - 14 * DAY)), sinFecha: true }); cola = conMedidas(r.piezas || []); resumen = r.resumen || resumen; if (r.ajustes?.redes?.length) redesNegocio = r.ajustes.redes; } catch (e) { errorMsg = e.message || 'No pude leer las piezas'; } }
  const todasConocidas = () => { const m = new Map(); for (const p of [...cola, ...pieces]) m.set(p.id, p); return [...m.values()]; };

  /* ---------- qué se ve ---------- */
  const visible = p => !gone.has('p:' + p.id) && estadoOn.has(p.estado) && p.redes.some(r => redOn.has(r)) && (!ctaSel || !ctas?.cuentas?.some(c => c.id === ctaSel) || saleEn(p, ctaSel, ctas)) && (!q || `${p.titulo} ${p.texto} ${p.hashtags} ${p.notas}`.toLowerCase().includes(q));
  const chipOf = p => (ESTADO[p.estado] || ESTADO.borrador).color;
  const titleOf = p => p.titulo || (p.texto || '').split('\n')[0].slice(0, 60) || 'Sin título';
  /** C2: la miniatura del primer archivo y, si hay más, «+N» encima (como en el feed: se ve que es un carrusel o un lote). */
  const miniatura = (p, cls) => (p.medios[0] ? thumbHTML(p.medios[0], esc, cls).replace(/<\/span>$/, p.medios.length > 1 ? `<b class="pz-mas">+${p.medios.length - 1}</b></span>` : '</span>') : `<span class="${cls} none" aria-hidden="true">${FICON[p.formato] || ''}</span>`);
  function eventsByDay() {
    const by = {};
    for (const p of pieces.filter(p => p.fecha && visible(p))) (by[p.fecha] ||= []).push({ kind: 'pz', at: at(p), p, title: titleOf(p) });
    if (pubOn) for (const m of pubs.sueltas) if (m.fecha && redOn.has(m.red) && !gone.has('m:' + m.id) && (!q || String(m.texto || '').toLowerCase().includes(q))) (by[m.fecha] ||= []).push({ kind: 'pub', at: new Date(`${m.fecha}T${m.hora || '00:00'}:00`).getTime(), m, title: pubTitulo(m) }); // C2
    for (const k in by) by[k].sort((a, b) => a.at - b.at);
    return by;
  }
  const pubTitulo = m => String(m.texto || '').split('\n')[0].trim().slice(0, 60) || 'Sin texto';
  const pubAria = m => `Publicada${pubs.fuente === 'ejemplo' ? ' (de ejemplo)' : ''} en ${RED[m.red]?.name || m.red}, ${fmtDay(new Date(`${m.fecha}T12:00:00`).getTime())} a las ${m.hora}: «${pubTitulo(m)}». ${cifrasTxt(m)}${m.enlace ? '. Abre la publicación' : ''}`;
  /** C2: una publicación que no salió de ninguna pieza (hecha a mano, o de antes de la oficina): solo lectura; con enlace, lleva a ella. */
  function pubCard(m, line) {
    const ej = pubs.fuente === 'ejemplo', f = TIPO_PUB[m.tipo] || 'post', tit = pubTitulo(m);
    const mini = typeof m.miniatura === 'string' && m.miniatura.startsWith('/api/contenido/miniatura/') ? `<span class="pz-ct"><img src="${esc(m.miniatura)}" alt="" loading="lazy" decoding="async"></span>` : `<span class="pz-ct none" aria-hidden="true">${FICON[f] || ''}</span>`;
    const tag = m.enlace ? ['a', `href="${esc(m.enlace)}" target="_blank" rel="noopener noreferrer" draggable="false"`] : ['div', 'role="button" tabindex="0"'];
    const attrs = `class="cv-ev pz pz-pub${line ? ' line pz2' : ''}" data-ev="m:${esc(m.id)}" style="--chip:#13705A;--chipd:#4FD1A5" aria-label="${esc(pubAria(m))}" title="${esc(pubAria(m))}" ${tag[1]}`;
    const st = `<b class="pz-tone pz-pubst" style="--c:#13705A;--cd:#4FD1A5"><i aria-hidden="true">●</i> PUBLICADA${ej ? ' · EJEMPLO' : ''}</b>`;
    if (line) return `<${tag[0]} ${attrs}>${mini}<span class="pz-l2"><span class="pz-l1"><b class="pz-h">${esc(m.hora)}</b>${netBadges({ redes: [m.red] })}<span class="pz-rs" aria-hidden="true">${OJO}${numeroCorto(m.alcance)}</span></span><span class="cv-ev-t">${esc(tit)}</span></span></${tag[0]}>`;
    return `<${tag[0]} ${attrs}><div class="pz-cardrow">${mini}<div class="pz-cardmain"><div class="pz-l1"><b class="pz-h">${esc(m.hora)}</b><span class="pz-f">${FICON[f] || ''}<span>${esc(FORMATO[f] || '')}</span></span>${netBadges({ redes: [m.red] })}</div><div class="cv-ev-t">${esc(tit)}</div><div class="pz-cardst">${st}</div>${resHTML(m)}</div></div></${tag[0]}>`;
  }
  const errN = p => (p.revision?.errores || []).length;
  const puedeSalir = p => !errN(p) && !!p.fecha && !!p.hora && !revisarMomento(p.fecha, p.hora).errores.length; // C3
  const falta = p => errN(p) && p.estado !== 'idea';
  /** Lo que un lector de pantalla oye de una tarjeta: todo lo que el ojo ve de un vistazo. */
  const ariaOf = p => `${titleOf(p)}, ${p.fecha ? fmtDay(at(p)) : 'sin día'}${p.hora ? ' ' + p.hora : ', sin hora'}, ${FORMATO[p.formato]}${p.medios.length > 1 ? ` de ${p.medios.length} archivos` : ''}, ${redesTxt(p)}${ctaTxt(p) ? ' en ' + ctaTxt(p) : ''}, ${(ESTADO[p.estado] || ESTADO.borrador).name.toLowerCase()}${textoSalida(p) ? ', ' + textoSalida(p).etiqueta.toLowerCase() : ''}${falta(p) ? ', le falta algo: ' + p.revision.errores[0] : ''}${p.cambiadaTrasAprobar ? ', cambió después de aprobarla' : ''}${vencida(p) && !resOf(p) ? ', la hora ya pasó' : ''}${resOf(p) ? `, publicada: ${cifrasTxt(resOf(p))}` : ''}`;
  function card(ev, line) {
    if (ev.kind === 'pub') return pubCard(ev.m, line);
    const p = ev.p, e = ESTADO[p.estado] || ESTADO.borrador, sel = panel.current()?.id === p.id, res = resOf(p);
    const cls = `cv-ev pz pz-${p.estado}${falta(p) ? ' pz-falta' : ''}${vencida(p) ? ' pz-venc' : ''}${sel ? ' sel' : ''}`;
    const attrs = `data-ev="p:${esc(p.id)}" style="--chip:${e.color};--chipd:${e.dark}" title="${esc(ariaOf(p))} · arrástrala a otro día (o Mayús + flechas)" aria-label="${esc(ariaOf(p))}" draggable="true" role="button" tabindex="0"`;
    const st = `<span class="pz-st pz-tone" style="--c:${e.color};--cd:${e.dark}" aria-hidden="true">${e.glyph}</span>${falta(p) ? '<span class="pz-warn" aria-hidden="true">!</span>' : ''}`;
    const thumb = miniatura(p, 'pz-ct'), tit = titleOf(p), snip = line ? '' : resto(p, tit);
    if (line) // el MES: dos filas — miniatura | hora · formato · redes · estado / título
      return `<div class="${cls} line pz2" ${attrs}>${thumb}<span class="pz-l2"><span class="pz-l1"><b class="pz-h">${esc(p.hora || 'sin hora')}</b><span class="pz-f" aria-hidden="true">${FICON[p.formato] || ''}<span class="pz-fw">${esc(FORMATO[p.formato] || '')}</span></span>${netBadges(p)}${ctaHTML(p)}${st}${res ? `<span class="pz-rs" aria-hidden="true">${OJO}${numeroCorto(res.alcance)}</span>` : ''}</span><span class="cv-ev-t">${esc(titleOf(p))}</span></span></div>`;
    return `<div class="${cls}" ${attrs}>
      <div class="pz-cardrow">${thumb}<div class="pz-cardmain"><div class="pz-l1"><b class="pz-h">${esc(p.hora || 'sin hora')}</b><span class="pz-f">${FICON[p.formato] || ''}<span>${esc(FORMATO[p.formato])}</span></span>${netBadges(p)}${ctaHTML(p)}</div><div class="cv-ev-t">${esc(tit)}</div>${snip ? `<div class="pz-snip">${esc(snip.slice(0, 220))}</div>` : ''}<div class="pz-cardst"><b class="pz-tone" style="--c:${e.color};--cd:${e.dark}"><i aria-hidden="true">${e.glyph}</i> ${e.name}${p.cambiadaTrasAprobar ? ' · CAMBIÓ' : ''}</b>${falta(p) ? '<span class="pz-fail">le falta algo</span>' : ''}${vencida(p) && !res ? '<span class="pz-fail">la hora ya pasó</span>' : ''}</div>${res ? resHTML(res) : ''}</div></div></div>`;
  }
  /* ---------- C2 (8 oct 2026): la vista previa al pasar el ratón (o llegar con el teclado) por una tarjeta ----------
     Como el ojo de Metricool, pero con lo que importa aquí: la imagen a su proporción, el texto entero, los hashtags, las redes con su formato
     y el estado (y lo que le falta). Es un vistazo: no se edita ahí; un clic sobre ella abre la pieza. Se queda abierta si el ratón pasa
     encima, y Esc la cierra sin cerrar Contenido (WCAG 1.4.13). En pantallas táctiles no sale: tocar ya abre la pieza. */
  let hovT = null, hovFuera = null, hovId = '';
  const puedeHov = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  function hovHTML(p) {
    const m = p.medios[0], red = p.redes.includes('instagram') ? 'instagram' : p.redes[0], md = (p.medidas || {})[m] || medidas[m] || {};
    const ratio = ['reel', 'historia'].includes(formatoDe(p, red)) ? '9 / 16' : md.ancho && md.alto ? String(Math.min(1.91, Math.max(0.8, md.ancho / md.alto))) : '4 / 5';
    const e = ESTADO[p.estado] || ESTADO.borrador, sal = textoSalida(p), falta = (p.revision?.errores || []).length && p.estado !== 'idea' ? p.revision.errores[0] : '';
    return `<div class="ct-hov-m" style="aspect-ratio:${ratio}">${m ? thumbHTML(m, esc, 'ct-hov-im') : '<span class="ct-hov-none">Sin imagen todavía</span>'}${p.medios.length > 1 ? `<b class="ct-hov-k">1/${p.medios.length}</b>` : ''}</div>
      <div class="ct-hov-b"><div class="ct-hov-h"><b>${p.fecha ? esc(fmtDay(at(p))) + (p.hora ? ' · ' + esc(p.hora) : ' · sin hora') : 'Sin día'}</b><span class="ct-hov-n">${netBadges(p)}${ctaHTML(p)}</span></div>
        ${p.titulo ? `<p class="ct-hov-t">${esc(p.titulo)}</p>` : ''}<p class="ct-hov-x">${esc(String(p.texto || '').trim() || 'Sin texto todavía')}</p>${p.hashtags ? `<p class="ct-hov-g">${esc(p.hashtags)}</p>` : ''}
        <p class="ct-hov-s pz-tone" style="--c:${e.color};--cd:${e.dark}">${e.glyph} ${e.name}${sal ? ' · ' + esc(sal.etiqueta) : ''}</p>${falta ? `<p class="ct-hov-f">Le falta: ${esc(falta)}</p>` : ''}${resOf(p) ? resHovHTML(pubs.porPieza[p.id]) : ''}</div>`;
  }
  /** C2: los resultados de lo publicado, red por red. */
  const resHovHTML = l => `<div class="ct-hov-r">${l.map(r => `<p>${netBadges({ redes: [r.red] })} <b>${numeroCorto(r.alcance)}</b> de alcance · <b>${numeroCorto(r.interacciones)}</b> ${r.interacciones === 1 ? 'interacción' : 'interacciones'}${r.comentarios ? ` · ${numeroCorto(r.comentarios)} ${r.comentarios === 1 ? 'comentario' : 'comentarios'}` : ''}</p>`).join('')}${pubs.fuente === 'ejemplo' ? '<p class="ct-hov-ej">Cifras de ejemplo</p>' : ''}</div>`;
  function pubHovHTML(m) {
    const f = TIPO_PUB[m.tipo] || 'post', img = typeof m.miniatura === 'string' && m.miniatura.startsWith('/api/contenido/miniatura/');
    return `<div class="ct-hov-m" style="aspect-ratio:${f === 'reel' ? '9 / 16' : '4 / 5'}">${img ? `<span class="ct-hov-im"><img src="${esc(m.miniatura)}" alt=""></span>` : '<span class="ct-hov-none">Sin miniatura</span>'}</div>
      <div class="ct-hov-b"><div class="ct-hov-h"><b>${esc(fmtDay(new Date(`${m.fecha}T12:00:00`).getTime()))} · ${esc(m.hora)}</b><span class="ct-hov-n">${netBadges({ redes: [m.red] })}</span></div>
        <p class="ct-hov-x">${esc(String(m.texto || '').trim() || 'Sin texto')}</p>
        <p class="ct-hov-s pz-tone" style="--c:#13705A;--cd:#4FD1A5">● PUBLICADA${pubs.fuente === 'ejemplo' ? ' · DE EJEMPLO' : ' · NO SALIÓ DE UNA PIEZA'}</p>${resHovHTML([m])}${m.enlace ? `<p class="ct-hov-g">Un clic la abre en ${esc(RED[m.red]?.name || m.red)}.</p>` : ''}</div>`;
  }
  function verHov(card) {
    const ev = card.dataset.ev || '', id = ev.slice(2);
    if (!card.isConnected) return;
    if (ev.startsWith('m:')) { const m = pubsPorId().get(id); if (!m) return; hovId = ev; E.hov.innerHTML = pubHovHTML(m); } // C2: lo publicado
    else { const p = todasConocidas().find(x => x.id === id); if (!p) return; hovId = ev; E.hov.innerHTML = hovHTML(p); }
    E.hov.hidden = false;
    const o = (E.hov.offsetParent || ov).getBoundingClientRect(), r = card.getBoundingClientRect(), w = E.hov.offsetWidth, h = E.hov.offsetHeight; // se coloca dentro de su caja (bajo la barra de Contenido, que en una pantalla mediana ocupa dos filas)
    const der = panel.isOpen() && !E.panelHost.hidden ? E.panelHost.getBoundingClientRect().left - o.left : o.width; // con la pieza abierta, no se le pone encima
    let x = r.right - o.left + 10; if (x + w > der - 8) x = r.left - o.left - w - 10; if (x < 8) x = Math.max(8, Math.min(der - w - 8, r.left - o.left));
    E.hov.style.left = x + 'px'; E.hov.style.top = Math.max(8, Math.min(o.height - h - 8, r.top - o.top)) + 'px';
  }
  function quitarHov() { clearTimeout(hovT); clearTimeout(hovFuera); hovT = hovFuera = null; hovId = ''; if (E.hov && !E.hov.hidden) E.hov.hidden = true; }
  const tarjeta = t => t?.closest?.('.cv-ev.pz, .pz-bk');
  for (const zona of [E.grid, E.rail]) {
    zona.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse' || !puedeHov()) return; const c = tarjeta(e.target); if (!c) return; clearTimeout(hovFuera); if ((c.dataset.ev || '') === hovId) return; clearTimeout(hovT); hovT = setTimeout(() => { if (!dnd?.dragging) verHov(c); }, 450); });
    zona.addEventListener('pointerout', e => { const c = tarjeta(e.target); if (!c || c.contains(e.relatedTarget)) return; clearTimeout(hovT); hovFuera = setTimeout(quitarHov, 180); });
    zona.addEventListener('focusin', e => { const c = tarjeta(e.target); if (!c || !puedeHov()) return; clearTimeout(hovT); hovT = setTimeout(() => verHov(c), 600); });
    zona.addEventListener('focusout', () => quitarHov());
  }
  E.hov.addEventListener('pointerenter', () => clearTimeout(hovFuera));
  E.hov.addEventListener('pointerleave', () => { hovFuera = setTimeout(quitarHov, 180); });
  E.hov.addEventListener('click', () => {
    const id = hovId; quitarHov(); if (!id) return;
    if (id.startsWith('m:')) { const m = pubsPorId().get(id.slice(2)); if (m?.enlace) window.open(m.enlace, '_blank', 'noopener'); return; } // C2: lo publicado se abre en su red
    openPiece(id.slice(2));
  });
  ov.addEventListener('pointerdown', e => { if (!E.hov.contains(e.target)) quitarHov(); }, true);
  ov.addEventListener('scroll', () => quitarHov(), true);
  ov.addEventListener('keydown', e => { if (e.key === 'Escape' && !E.hov.hidden) { quitarHov(); e.stopPropagation(); e.preventDefault(); } }, true);
  const addLabel = d => `Nueva pieza el ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;

  function render() {
    if (dnd && dnd.dragging) return;
    quitarHov(); // C2: la tarjeta de la vista previa se repinta: la ventanita se va con ella
    ov.classList.toggle('prog', mode === 'prog' || mode === 'bandeja'); ov.classList.toggle('bj', mode === 'bandeja'); ov.classList.toggle('perfilv', mode === 'cal' && view === 'perfil'); ov.classList.toggle('panelOpen', panel.isOpen()); if (!E.toast.hidden) placeToast();
    E.mode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
    E.views.hidden = mode !== 'cal'; E.wrap.hidden = mode !== 'cal'; E.prog.hidden = mode !== 'prog'; E.bj.hidden = mode !== 'bandeja';
    E.views.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.v === view); b.setAttribute('aria-pressed', b.dataset.v === view); }); $('.ct-vsel').value = view;
    $('.cv-nav').style.visibility = mode === 'cal' ? 'visible' : 'hidden';
    const nP = resumen ? resumen.revisar : 0, nb = E.mode.querySelector('.ct-n'); nb.hidden = !nP; nb.textContent = nP; nb.setAttribute('aria-label', `${nP} por revisar`);
    renderChips(); renderRail();
    if (mode === 'prog') { renderProg(); return; }
    if (mode === 'bandeja') { E.title.innerHTML = ''; return; } // plan M4: la bandeja se pinta sola (contenido-bandeja.js)
    const r = range(), by = eventsByDay(), grid = { from: r.from, days: r.days, by, card, addLabel };
    E.title.innerHTML = titleHTML(view, anchor, r);
    E.dow.hidden = view !== 'month'; E.dow.innerHTML = dowHTML(view, anchor, 1);
    E.grid.className = 'cv-grid ' + view; E.grid.style.setProperty('--rows', r.days / 7);
    let html;
    if (view === 'month') html = monthHTML({ ...grid, anchor });
    else if (view === 'perfil') { E.grid.className = 'cv-grid perfil'; E.title.innerHTML = '<b>Perfil de Instagram</b>'; html = perfilHTML(casillas(todasConocidas().filter(visible), { hoy: ymd(new Date()) }), { esc, mediaUrl: id => (typeof id === 'string' && !id.startsWith('demo/') ? '/media/' + id.split('/').map(encodeURIComponent).join('/') : null), color: e => (ESTADO[e] || ESTADO.borrador).color }); } // plan M5 · U2
    else if (view === 'agenda') { E.grid.className = 'cv-grid agenda'; html = agendaHTML({ ...grid, emptyDay: 'Nada programado. Un buen hueco para publicar.', emptyAll: 'Nada en estos 14 días.' }); }
    else { E.grid.className = 'cv-grid tg tg-' + view; E.grid.style.setProperty('--n', r.days); html = `<div class="cv-tg">${timeGridHTML({ ...grid, live: ev => ev.kind === 'pz' && !ev.p.hora, liveLabel: 'SIN HORA', slot: horaInfo?.grid ? (k, h) => ['', 'hb1', 'hb2'][nivelHora(horaInfo.grid, k, h)] : null })}</div>`; }
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
      tgKey = key; const prim = Object.values(by).flat().filter(ev => (ev.kind === 'pub' ? ev.m.hora : ev.p.hora)).sort((a, b) => new Date(a.at).getHours() - new Date(b.at).getHours())[0];
      const h = prim ? Math.max(0, new Date(prim.at).getHours() - 1) : 8;
      const row = E.grid.querySelector(`.cv-tg-h[data-h="${h}"]`), head = E.grid.querySelector('.cv-tg-d'), c0 = E.grid.querySelector('.cv-tg-c');
      E.grid.scrollTop = row && c0 ? row.offsetTop - (head ? head.offsetHeight : 0) - c0.offsetTop : 0;
    }
    let n = 0, np = 0; for (const k in by) for (const ev of by[k]) ev.kind === 'pub' ? np++ : n++;
    const dentro = p => p.fecha && p.fecha >= ymd(new Date(r.from)) && p.fecha < ymd(new Date(r.to));
    const cuenta = ORDEN.map(s => [s, pieces.filter(p => p.estado === s && dentro(p) && visible(p)).length]).filter(([, c]) => c);
    const conRes = pieces.filter(p => dentro(p) && visible(p) && resOf(p)).length + (view === 'perfil' ? 0 : np); // C2: lo que ya salió, con cifras
    // plan M3: la leyenda de las horas sombreadas va junto a las cifras (dentro de la cuadrícula se iba con el desplazamiento); C2: de qué red
    const leyenda = (horaInfo?.grid || horaRedSel) && view !== 'month' && view !== 'agenda' && view !== 'perfil'
      ? `<span class="ct-hbleg">${horaInfo?.grid ? '<i class="hb2" aria-hidden="true"></i>' : ''}<label class="ct-hbred">Mejores horas de <select class="pz-sel" data-horared aria-label="Mejores horas de qué red"><option value="">tus redes</option>${redesUsadas().map(k => `<option value="${k}"${horaRedSel === k ? ' selected' : ''}>${esc(RED[k]?.name || k)}</option>`).join('')}</select></label>${horaInfo?.grid ? `, ${esc(fuenteHora(horaInfo))} · <i class="hb1" aria-hidden="true"></i>buenas` : ': sin datos para esa red todavía'}</span>` : '';
    setStats(leyenda + `<span><b>${n}</b> ${n === 1 ? 'pieza' : 'piezas'}</span>` + cuenta.map(([s, c]) => `<span class="pz-tone" style="--c:${ESTADO[s].color};--cd:${ESTADO[s].dark}"><b>${c}</b> ${ESTADO[s].name.toLowerCase()}</span>`).join('')
      + (conRes ? `<span class="pz-tone" style="--c:#13705A;--cd:#4FD1A5"><b>${conRes}</b> ${conRes === 1 ? 'publicada' : 'publicadas'}${pubs.fuente === 'ejemplo' ? ' (ejemplo)' : ''}</span>` : '') + zonaHTML());
  }
  /** C2: la zona horaria a la vista — las horas de Contenido son las del reloj de la máquina de la oficina. */
  function zonaHTML() { const z = zona || zonaLocal(); return z.utc ? `<span class="ct-tz" title="Las horas de Contenido son las del reloj de esta computadora${z.nombre ? ' (' + esc(z.nombre) + ')' : ''}: así salen en las redes.">Horas de ${esc(ciudadDe(z) || 'esta computadora')} · ${esc(z.utc)}</span>` : ''; }
  function renderChips() {
    const usadas = redesUsadas(), lc = ctas?.cuentas || [], off = ORDEN.length - estadoOn.size + usadas.filter(r => !redOn.has(r)).length + (pubs.fuente !== 'ninguna' && !pubOn ? 1 : 0) + (ctaSel && lc.some(c => c.id === ctaSel) ? 1 : 0);
    $('[data-filters]').textContent = off ? `Filtros (${off})` : 'Filtros';
    E.chips.innerHTML = ORDEN.map(s => `<button type="button" class="cv-chip${estadoOn.has(s) ? ' on' : ''}" data-e="${s}" aria-pressed="${estadoOn.has(s)}" title="${esc(ESTADO[s].help)}"><i class="pz-cg pz-tone" style="--c:${ESTADO[s].color};--cd:${ESTADO[s].dark}" aria-hidden="true">${ESTADO[s].glyph}</i>${ESTADO[s].name}</button>`).join('')
      + (lc.length > 2 ? `<span class="cv-sep"></span><label class="ct-fcta">Cuenta <select class="pz-sel" data-fcta aria-label="Ver solo las piezas de una cuenta"><option value="">todas</option>${lc.map(c => `<option value="${esc(c.id)}"${c.id === ctaSel ? ' selected' : ''}>${esc(nombreCorto(c))} · ${esc(RED[c.red]?.name || c.red)}</option>`).join('')}</select></label>` : '') // 9 oct 2026: el filtro por cuenta
      + '<span class="cv-sep"></span>' + usadas.map(k => [k, RED[k]]).map(([k, r]) => `<button type="button" class="cv-chip${redOn.has(k) ? ' on' : ''}" data-r="${k}" aria-pressed="${redOn.has(k)}"><b class="pz-nb ${k}" aria-hidden="true">${iconoRed(k)}</b>${r.name}</button>`).join('')
      + (pubs.fuente !== 'ninguna' ? `<span class="cv-sep"></span><button type="button" class="cv-chip${pubOn ? ' on' : ''}" data-pub aria-pressed="${pubOn}" title="Lo que salió en tus redes sin pasar por una pieza (hecho a mano o antes de la oficina), con sus cifras de Analíticas"><i class="pz-cg pz-tone" style="--c:#13705A;--cd:#4FD1A5" aria-hidden="true">●</i>Publicado fuera${pubs.fuente === 'ejemplo' ? ' (ejemplo)' : ''}</button>` : ''); // C2
  }
  function renderRail() {
    const sin = todasConocidas().filter(p => !p.fecha && visible(p));
    const bk = p => `<div class="cv-bk pz-bk" draggable="true" data-ev="p:${esc(p.id)}" style="--chip:${chipOf(p)}" role="button" tabindex="0" aria-label="${esc(ariaOf(p))}" title="Arrástrala a un día para ponerle fecha">${miniatura(p, 'pz-bt')}<div class="pz-bkm"><div class="cv-r-t">${esc(titleOf(p))}</div><div class="cv-r-m"><span class="pz-f">${FICON[p.formato] || ''}${esc(FORMATO[p.formato])}</span> ${netBadges(p)} · ${esc(ESTADO[p.estado].name.toLowerCase())}</div></div></div>`;
    E.rail.innerHTML = `<div class="cv-rail-h">IDEAS SIN DÍA <b>${sin.length}</b>${sin.length ? '<span class="cv-rail-hint">arrástralas a un día</span>' : ''}</div>`
      + (sin.length ? sin.map(bk).join('') : '<div class="cv-empty">Ninguna idea suelta.<br>Las ideas que los agentes o tú dejen sin día esperan aquí.</div>')
      + `<button type="button" class="pz-newidea" data-new="idea">+ Nueva idea</button>`
      + `<div class="ct-legend">${Object.entries(FORMATO).map(([k, l]) => `<span>${FICON[k]}${l}</span>`).join('')}</div>`
      + `<div class="cv-rail-foot">Suelta aquí una pieza del calendario para quitarle el día. Lo que espera tu visto bueno está en PROGRAMACIÓN.</div>`;
    const rb = $('[data-rail]'); rb.innerHTML = `Ideas <b>${sin.length}</b>`; rb.setAttribute('aria-label', `Ideas sin día: ${sin.length}`);
  }

  /* ---------- Programación: la cola ---------- */
  /* M1 (6 oct 2026): lo que pasó al entregarla — en cola, programada, publicada (con sus enlaces), falló — y lo que se puede hacer */
  const SAL_COLOR = { espera: ['#2158CC', '#8FB0FF'], entregando: ['#2158CC', '#8FB0FF'], en_red: ['#13705A', '#4FD1A5'], publicada: ['#13705A', '#4FD1A5'], parcial: ['#B3261E', '#FFB4AB'], fallo: ['#B3261E', '#FFB4AB'] };
  const SAL_GLYPH = { espera: '◷', entregando: '↗', en_red: '✓', publicada: '●', parcial: '!', fallo: '!' };
  const SAL_BTN = { entregar: ['Entregar ya', 'Entregarla al conductor ahora (desde ese momento, cambiarla depende del conductor)'], quitar: ['Quitar de la cola', 'Le quita el OK y la retira del conductor si ya estaba allí'], reintentar: ['Reintentar', 'Volver a intentar entregarla'] };
  const salidaBox = (p, sal) => `<div class="ct-salbox${sal.malo ? ' bad' : ''}"><span class="ct-saltxt">${esc(sal.texto)}</span>${sal.enlaces.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(l.red)}</a>`).join('')}${sal.acciones.map(a => `<button type="button" class="pz-lk${a === 'quitar' ? ' warn' : ''}" data-sal="${a}" data-id="${esc(p.id)}" title="${esc(SAL_BTN[a][1])}">${SAL_BTN[a][0]}</button>`).join('')}</div>`;
  const bannerHTML = () => {
    const c = colaInfo; if (!c) return '';
    if (c.modo === 'demo') return '<div class="ct-banner" role="note"><span><b>Demo:</b> aquí no sale nada. En la oficina, lo que apruebas lo programa el simulacro o Metricool.</span></div>';
    if (c.modo === 'apagado') return '<div class="ct-banner bad" role="note"><span><b>Publicación apagada:</b> nada sale de la oficina. Cámbialo en Ajustes → Contenido.</span></div>';
    if (c.modo === 'simulacro') return '<div class="ct-banner" role="note"><span><b>Modo simulacro:</b> lo que apruebas «sale» de mentira, para probar todo el circuito sin tocar tus redes. Para publicar de verdad: Ajustes → Contenido → Real.</span><button type="button" class="pz-btn" data-comprobar>Comprobar conexión</button></div>';
    if (!c.conductor?.ok) return `<div class="ct-banner bad" role="alert"><span><b>No se puede publicar:</b> ${esc(c.conductor?.motivo || 'el conductor no está listo')}</span><button type="button" class="pz-btn" data-comprobar>Comprobar de nuevo</button></div>`;
    if (c.conductor.id === 'meta') return `<div class="ct-banner ok" role="note"><span><b>Publica Meta directo:</b> ${esc(c.conductor.nota || '')}${c.conductor.cuota ? ` <span class="ct-cuota${c.conductor.cuota.total && c.conductor.cuota.usadas >= c.conductor.cuota.total * 0.8 ? ' alta' : ''}">${esc(cuotaTxt(c.conductor.cuota))}</span>` : ''}${c.cuenta?.fallo ? ` <b>${c.cuenta.fallo} ${c.cuenta.fallo === 1 ? 'falló' : 'fallaron'}.</b>` : ''}</span><button type="button" class="pz-btn" data-comprobar>Comprobar conexión</button></div>`; // F3 (8 oct 2026): Instagram sale desde aquí
    return `<div class="ct-banner ok" role="note"><span><b>Publica ${esc(c.conductor.nombre)}</b>: lo que apruebas se le entrega ${c.horasAntes ? `${c.horasAntes} h antes de salir` : 'al aprobarlo'} y sale solo, con esta computadora apagada.${c.cuenta?.fallo ? ` <b>${c.cuenta.fallo} ${c.cuenta.fallo === 1 ? 'falló' : 'fallaron'}.</b>` : ''}</span><button type="button" class="pz-btn" data-comprobar>Comprobar conexión</button></div>`;
  };
  const filaCola = (p, { accion = true, motivo = '', borrador = false } = {}) => {
    const e = ESTADO[p.estado] || ESTADO.borrador, r = p.revision?.errores || [], m = p.fecha ? revisarMomento(p.fecha, p.hora) : null;
    const puede = !r.length && m && !m.errores.length;
    const cuando = p.fecha && p.hora ? `<span class="ct-cd${at(p) < Date.now() ? ' late' : ''}">${cuentaAtras(at(p))}</span>` : '';
    const sal = textoSalida(p);
    return `<div class="ct-row${sal ? ' con-salida' : ''}${selP.has(p.id) ? ' sel' : ''}" style="--chip:${e.color}">
      <label class="ct-ck" title="Seleccionar para hacer algo con varias"><input type="checkbox" data-selp="${esc(p.id)}"${selP.has(p.id) ? ' checked' : ''} aria-label="Seleccionar: ${esc(titleOf(p))}"></label>
      <span class="ct-hour">${p.hora ? esc(p.hora) : p.fecha ? '<small>sin hora</small>' : '<small>sin día</small>'}</span>
      <button type="button" class="ct-open" data-open="${esc(p.id)}" aria-label="Abrir la pieza: ${esc(ariaOf(p))}">
        ${miniatura(p, 'pz-rt')}
        <span class="ct-rm"><span class="ct-rt">${esc(titleOf(p))}</span><span class="ct-rs"><span class="pz-f">${FICON[p.formato] || ''}${esc(FORMATO[p.formato])}</span>${netBadges(p)}${ctaHTML(p)}${cuando}${p.origen.startsWith('agente:') ? ` · <em>${esc(agentName(p.origen.slice(7)) || 'un agente')}</em>` : ''}</span>
        ${motivo ? `<span class="ct-rf">${esc(motivo)}</span>` : r.length && p.estado !== 'idea' ? `<span class="ct-rf">Le falta: ${esc(r[0])}${r.length > 1 ? ` (+${r.length - 1})` : ''}</span>` : p.cambiadaTrasAprobar ? '<span class="ct-rf">Cambió después de aprobarla: vuelve a aprobarla.</span>' : ''}</span></button>
      ${sal ? `<span class="ct-st pz-tone ct-sst ${sal.clave}" style="--c:${SAL_COLOR[sal.clave][0]};--cd:${SAL_COLOR[sal.clave][1]}"><i aria-hidden="true">${SAL_GLYPH[sal.clave]}</i> ${sal.etiqueta}</span>` : `<span class="ct-st pz-tone" style="--c:${e.color};--cd:${e.dark}"><i aria-hidden="true">${e.glyph}</i> ${e.name}</span>`}
      ${sal ? salidaBox(p, sal) : ''}
      ${accion && (p.estado === 'revision' || (borrador && p.estado === 'borrador')) ? `<button type="button" class="pz-go sm${puede ? '' : ' locked'}" data-ok="${esc(p.id)}"${puede ? '' : ' aria-disabled="true"'} title="${puede ? 'Aprobarla' : 'Todavía no puede salir'}">${puede ? 'Aprobar' : '<span aria-hidden="true">🔒</span> Aprobar'}</button>` : ''}</div>`;
  };
  function renderProg() {
    E.title.innerHTML = '';
    const todas = todasConocidas().filter(visible), hoy = startOfDay(Date.now()), hoyK = ymd(new Date(hoy));
    // lo que pide una acción del dueño, con el porqué; y la cola por día: los próximos 14 siempre (los vacíos, como huecos), después solo los días con algo
    const pide = requiereAccion(todas).filter(a => !(vencida(a.pieza) && resOf(a.pieza))); // C2: si Analíticas la vio publicada, salió (aunque la cola no lo sepa)
    const accion = pide.map(a => [a.pieza, a.motivo]);
    const listasAprobar = pide.filter(a => a.puede).length;
    const futuras = todas.filter(p => p.fecha && p.fecha >= hoyK), dias = new Map(colaPorDia(todas));
    const rel = k => k === hoyK ? 'Hoy' : k === ymd(new Date(hoy + DAY + 3600e3)) ? 'Mañana' : '';
    const diaH = k => { const d = new Date(k + 'T00:00:00'); return `${rel(k) ? `<b>${rel(k)}</b> · ` : ''}${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`; };
    const colaHTML = [...dias.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, l]) => l.length
      ? `<section class="ct-day" aria-label="${esc(diaH(k).replace(/<[^>]+>/g, ''))}"><h4>${diaH(k)} <small>${l.length} ${l.length === 1 ? 'pieza' : 'piezas'}</small></h4>${l.map(p => filaCola(p, { accion: true })).join('')}</section>`
      : `<section class="ct-day gap"><h4>${diaH(k)}</h4><button type="button" class="ct-gap" data-gap="${k}">Hueco: nada programado · <b>+ Programar aquí</b></button></section>`).join('');
    // la frecuencia de la semana que empieza hoy, por red
    const sem = futuras.filter(p => at(p) < hoy + 7 * DAY && p.estado !== 'idea'), porRed = redesUsadas().map(r => [r, sem.filter(p => p.redes.includes(r)).length]);
    const sinDia = todas.filter(p => !p.fecha);
    // C3 (8 oct 2026): los borradores de los próximos 7 días (los de «Llenar la semana», los de los agentes): se aprueban uno a uno o todos
    const borr = todas.filter(p => p.estado === 'borrador' && p.fecha && p.fecha >= hoyK && at(p) < hoy + 8 * DAY).sort((a, b) => at(a) - at(b)), borrListos = borr.filter(puedeSalir);
    const html = `${bannerHTML()}${selBarHTML()}
      <div class="ct-cols">
        <div class="ct-main">
          <section class="ct-sec ct-need" aria-labelledby="ctp-acc"><div class="ct-sh"><h3 id="ctp-acc">Requiere tu acción <b>${accion.length}</b></h3>${listasAprobar > 1 ? `<button type="button" class="pz-btn" data-okall>Aprobar las ${listasAprobar} que pueden salir</button>` : ''}</div>
            ${accion.length ? accion.map(([p, m]) => filaCola(p, { motivo: m })).join('') : '<p class="ct-empty">Nada pendiente. Todo lo programado está aprobado o en trabajo.</p>'}</section>
          ${borr.length ? `<section class="ct-sec ct-borr" aria-labelledby="ctp-bor"><div class="ct-sh"><h3 id="ctp-bor">Borradores de la semana <b>${borr.length}</b></h3>${borrListos.length ? `<button type="button" class="pz-btn" data-okbor>Aprobar ${borrListos.length === 1 ? 'el que puede' : `los ${borrListos.length} que pueden`} salir</button>` : ''}</div>
            ${borr.map(p => filaCola(p, { borrador: true })).join('')}</section>` : ''}
          <section class="ct-sec" aria-labelledby="ctp-cola"><div class="ct-sh"><h3 id="ctp-cola">La cola · lo que sale</h3><button type="button" class="pz-btn" data-llenar title="Los días sin nada, con su mejor hora: borradores de Marketing o lo que ya funcionó">Llenar la semana</button><span class="ct-freq">Próximos 7 días: ${porRed.map(([r, n]) => `${netBadges({ redes: [r] })} ${n} ${n === 1 ? 'pieza' : 'piezas'}`).join(' · ')}</span></div>${colaHTML}</section>
        </div>
        <aside class="ct-aside" aria-label="Ideas sin día">
          <section class="ct-sec"><div class="ct-sh"><h3>Ideas sin día <b>${sinDia.length}</b></h3><button type="button" class="pz-btn" data-new="idea">+ Nueva idea</button></div>
          ${sinDia.length ? sinDia.map(p => filaCola(p, { accion: false })).join('') : '<p class="ct-empty">Ninguna idea suelta.</p>'}</section>
        </aside>
      </div>`;
    const focused = E.prog.contains(document.activeElement) ? (document.activeElement.dataset.open || document.activeElement.dataset.ok || document.activeElement.dataset.gap) : null;
    if (html !== lastProg) { E.prog.innerHTML = html; lastProg = html; if (focused) E.prog.querySelector(`[data-open="${CSS.escape(focused)}"], [data-ok="${CSS.escape(focused)}"], [data-gap="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true }); }
    setStats(`<span><b>${accion.length}</b> requieren acción</span><span><b>${futuras.filter(p => p.estado === 'aprobada').length}</b> aprobadas</span><span><b>${[...dias.values()].slice(0, 14).filter(l => !l.length).length}</b> huecos en 14 días</span>${zonaHTML()}`);
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
  const panel = panelBajoDemanda({ host: E.panelHost, modal, datos, esc, note, onChange: onPanel, redesUsadas: () => redesNegocio, mejorHora, fuenteHora, zona: () => zona || zonaLocal(), otras: () => todasConocidas(), cuenta: () => cuentas, cuentasMeta: () => ctas, medidaDe: id => medidas[id] || null,
    openEstudio: p => { const t = { id: p.id, titulo: titleOf(p) }; openStudio(t, ids => { open(); openPiece(p.id, ids); }); }, pickMedia: cur => pickMedia(cur) });
  // plan M4: la bandeja (mensajes, comentarios y reseñas); su número va en el botón BANDEJA
  let bjCargada = false;
  const bj = initBandeja({ host: E.bj, datos, esc, note, paquete: () => panel.herramientas(), onCount: n => { const b = E.mode.querySelector('.ct-nbj'); b.hidden = !n; b.textContent = n; b.setAttribute('aria-label', `${n} por responder`); } });
  /** plan M5 · U2: dos piezas de la cuadrícula del perfil se cambian el día y la hora; una aprobada vuelve a revisión, y DESHACER la reaprueba. */
  async function cambiarDeSitio(aId, bId) {
    const A = todasConocidas().find(p => p.id === aId), B = todasConocidas().find(p => p.id === bId); if (!A || !B || aId === bId) return;
    const [x, y] = intercambio(A, B), apr = [A, B].filter(p => p.estado === 'aprobada');
    try { await datos.patch(x.id, { fecha: x.fecha, hora: x.hora }); await datos.patch(y.id, { fecha: y.fecha, hora: y.hora }); } catch (e) { note('No se pudo: ' + e.message, true); return; }
    await load(true); render();
    undoable(`Cambiadas de sitio${apr.length ? ': ' + (apr.length === 1 ? 'la aprobada vuelve' : 'las aprobadas vuelven') + ' a revisión' : ''}.`, async () => {
      await datos.patch(A.id, { fecha: A.fecha, hora: A.hora }); await datos.patch(B.id, { fecha: B.fecha, hora: B.hora });
      for (const p of apr) await datos.approve(p.id).catch(() => {});
      await load(true); render(); return { aviso: apr.length ? 'Deshecho: vuelven a estar aprobadas.' : 'Deshecho.' };
    });
  }
  async function openPiece(id, addIds) {
    if (!openNow) open();
    let p = todasConocidas().find(x => x.id === id);
    if (!p) { await load(true); p = todasConocidas().find(x => x.id === id); }
    if (!p) { note('Esa pieza ya no está.', true); return; }
    await panel.flush(); await panel.open(p); if (addIds?.length) panel.addMedios(addIds); render();
  }
  async function openNew(extra) { flushUndo(); closeMenu(); await panel.flush(); await panel.open(extra); render(); }
  /** «+ Crear» con un formato: el siguiente hueco libre, a las 18:00, en las dos redes (una historia, solo Instagram). */
  function crear(formato) {
    const conH = redesNegocio.filter(r => CON_HISTORIAS.includes(r)), redes = formato === 'historia' ? (conH.length ? conH : ['instagram']) : [...redesNegocio]; // M2: las redes que usas (una historia, solo las que tienen)
    openNew({ formato, redes, fecha: siguienteHueco(redes, todasConocidas().filter(p => p.estado !== 'idea')), hora: '18:00' });
  }
  function closeMenu(focus) { if (E.newMenu.hidden) return; E.newMenu.hidden = true; E.newBtn.setAttribute('aria-expanded', 'false'); if (focus) E.newBtn.focus(); }

  /* ---------- elegir de la galería del Estudio ---------- */
  function pickMedia(actuales = []) {
    return new Promise(async resolve => {
      const dlg = document.createElement('div'); dlg.className = 'ct-pick'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'ctPickT'); dlg.setAttribute('data-modal-keep', '');
      dlg.innerHTML = `<div class="ct-pickbox"><div class="ct-pickh"><h3 id="ctPickT">Elegir de la galería del Estudio</h3><span class="sp"></span><button type="button" class="pz-x" data-a="x" aria-label="Cerrar">✕</button></div><div class="ct-pickq"><input type="search" class="ct-pickin" placeholder="Buscar en la galería…" aria-label="Buscar en la galería del Estudio" aria-controls="ctPickG"><span class="ct-pickn" aria-live="polite"></span></div><div class="ct-pickg" id="ctPickG" role="group" aria-label="Archivos"><p class="ct-empty">Cargando…</p></div><div class="ct-pickf"><span class="pz-state" role="status"></span><span class="sp"></span><button type="button" class="pz-go" data-a="ok" disabled>Usar</button></div></div>`;
      ov.appendChild(dlg); modal.open(dlg); const from = document.activeElement;
      const sel = new Set(); const grid = dlg.querySelector('.ct-pickg'), ok = dlg.querySelector('[data-a="ok"]'), st = dlg.querySelector('.pz-state'), qin = dlg.querySelector('.ct-pickin'), cnt = dlg.querySelector('.ct-pickn');
      // Auditoría 1 oct 2026 (INF-03): antes se pedía /api/media (los 600 más nuevos) y se cortaba en 200: lo viejo no se podía elegir.
      // Ahora el servidor busca en TODA la galería (solo imágenes y videos) y da páginas de 60, con «Cargar más».
      const PAGE = 60, demo = Object.entries(DEMO_MEDIOS).map(([file, m]) => ({ file, kind: /\.mp4$/.test(file) ? 'video' : 'image', w: m.ancho, h: m.alto, duration: m.duracion, prompt: 'Muestra ' + file.slice(5), at: 0 }));
      let items = [], next = null, total = 0, seq = 0, busy = false, q = '';
      const dim = it => { const m = medidas[it.file]; return m?.ancho ? (m.ancho > 30 ? `${m.ancho}×${m.alto}` : `${m.ancho}:${m.alto}`) + (m.duracion ? ` · ${Math.round(m.duracion)} s` : '') : ''; };
      const card = it => `<button type="button" class="ct-pk" data-f="${esc(it.file)}" aria-pressed="${sel.has(it.file)}" title="${esc(String(it.prompt || it.file).slice(0, 140))}">${thumbHTML(it.file, esc, 'pz-pt')}<span>${esc(String(it.prompt || it.file).slice(0, 48))}</span>${dim(it) ? `<small>${dim(it)}</small>` : ''}</button>`;
      const moreHTML = () => next ? `<div class="ct-pmore"><p>Ves ${GF.miles(items.length)} de ${GF.miles(total)}.</p><button type="button" class="ct-pmorebtn" data-a="more"${busy ? ' aria-busy="true"' : ''}>${busy ? 'Cargando…' : `Cargar ${GF.miles(Math.min(PAGE, total - items.length) || PAGE)} más`}</button></div>` : '';
      const paintCount = () => { cnt.textContent = total ? (next ? `${GF.miles(items.length)} de ${GF.miles(total)}` : `${GF.miles(total)} ${total === 1 ? 'archivo' : 'archivos'}`) : ''; };
      async function page(more) {
        const my = ++seq; busy = true; if (more) { const b = grid.querySelector('[data-a="more"]'); if (b) { b.textContent = 'Cargando…'; b.setAttribute('aria-busy', 'true'); } }
        let got = [];
        try {
          if (served) { const j = await (await fetch(`/api/media?kind=image,video&n=${PAGE}${q ? '&q=' + encodeURIComponent(q) : ''}${more && next ? '&before=' + encodeURIComponent(next) : ''}${actuales.slice(0, 50).map(f => '&not=' + encodeURIComponent(f)).join('')}`)).json(); if (my !== seq) return; got = j.items || []; next = j.next || null; total = j.total ?? got.length; }
          else { const all = demo.filter(GF.matcher({ q })).filter(it => !actuales.includes(it.file)); got = all; next = null; total = all.length; }
        } catch { if (my !== seq) return; got = []; next = null; if (!more) total = 0; }
        busy = false;
        for (const it of got) { const m = medidaDeItem(it); if (m) medidas[it.file] = m; }
        got = got.filter(it => !actuales.includes(it.file)); // lo que la pieza ya lleva no se ofrece otra vez (el servidor ya lo dejó fuera de las páginas y del total, ?not=: «Ves X de Y» cuadra)
        if (more) { const have = new Set(items.map(x => x.file)); got = got.filter(x => !have.has(x.file)); items = items.concat(got); const box = grid.querySelector('.ct-pmore'), tmp = document.createElement('div'); tmp.innerHTML = got.map(card).join('') + moreHTML(); const firstNew = tmp.firstElementChild; if (box) box.replaceWith(...tmp.childNodes); else grid.append(...tmp.childNodes); const b = grid.querySelector('[data-a="more"]'); if (document.activeElement === document.body || !dlg.contains(document.activeElement)) ((firstNew && firstNew.matches('.ct-pk') ? firstNew : null) || b)?.focus(); } // «Cargar más» se fue con su caja: el foco pasa a lo primero nuevo
        else { items = got; grid.innerHTML = items.length ? items.map(card).join('') + moreHTML() : `<p class="ct-empty">${q ? `Nada en la galería con «${esc(q)}».` : served ? 'La galería del Estudio está vacía. Crea algo con «Crear con el Estudio».' : 'Sin archivos en la demo.'}</p>`; }
        paintCount();
      }
      await page(false);
      let qT = 0; qin.addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => { q = qin.value.trim(); page(false); }, 250); });
      const done = v => { modal.close(dlg); dlg.remove(); if (from && document.contains(from)) from.focus({ preventScroll: true }); resolve(v); };
      dlg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.f) { const on = !sel.has(b.dataset.f); on ? sel.add(b.dataset.f) : sel.delete(b.dataset.f); b.setAttribute('aria-pressed', on); ok.disabled = !sel.size; ok.textContent = sel.size ? `Usar ${sel.size}` : 'Usar'; st.textContent = ''; return; }
        if (b.dataset.a === 'more') { if (!busy) page(true); return; }
        if (b.dataset.a === 'x') done(null); else if (b.dataset.a === 'ok' && sel.size) done([...sel]);
      });
      dlg.addEventListener('keydown', e => { if (e.key === 'Escape') { if (e.target === qin && qin.value) { e.stopPropagation(); qin.value = ''; q = ''; page(false); return; } e.stopPropagation(); done(null); } });
      (grid.querySelector('.ct-pk') || qin).focus();
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
      if (r.soltada || eraAprobada) undoable(`Movida ${donde}. Ya no está aprobada: el OK era para otra fecha.`, async () => { const r = await deshacerMover(datos, p.id, antes); put(r.pieza); render(); loadResumen(); return r; });
      else note(`Movida ${donde}.`);
    } catch (e) { render(); note('No se pudo mover: ' + e.message, true); }
  }
  async function dropOn(day, d) {
    if (d.kind !== 'p') return;
    const p = todasConocidas().find(x => x.id === d.id); if (!p) return;
    const fecha = day.dataset.day, hora = day.dataset.hour !== undefined ? `${String(day.dataset.hour).padStart(2, '0')}:${p.hora && +p.hora.slice(0, 2) === +day.dataset.hour ? p.hora.slice(3) : '00'}` : p.hora;
    const pasado = motivoPasado(fecha, hora); if (pasado) { render(); note(pasado, true); return; }
    await mover(p, fecha, hora);
  }
  dnd = attachDnd({ root: ov, grid: E.grid, onStart: () => {}, onDrop: (day, d) => dropOn(day, d), onCancel: () => render() });
  // el banco de ideas también es un destino: soltar ahí le quita el día (CON-18)
  E.railBox.addEventListener('dragover', e => { if (dnd.dragging?.kind === 'p') { e.preventDefault(); E.railBox.classList.add('drop'); } });
  E.railBox.addEventListener('dragleave', e => { if (!E.railBox.contains(e.relatedTarget)) E.railBox.classList.remove('drop'); });
  E.railBox.addEventListener('drop', e => { E.railBox.classList.remove('drop'); const d = dnd.dragging; if (d?.kind !== 'p') return; e.preventDefault(); const p = todasConocidas().find(x => x.id === d.id); if (p && p.fecha) mover(p, '', ''); });

  /* ---------- eventos ---------- */
  // plan M5 · U2: arrastrar una casilla del perfil sobre otra las cambia de sitio (con el teclado o el dedo: ‹ ›)
  let pfArr = null;
  E.grid.addEventListener('dragstart', e => { const li = e.target.closest?.('.pf-t[draggable="true"]'); if (!li) return; pfArr = li.dataset.pf; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', pfArr); } catch {} li.classList.add('arr'); e.stopPropagation(); }, true);
  E.grid.addEventListener('dragover', e => { if (!pfArr) return; const li = e.target.closest?.('.pf-t[draggable="true"]'); if (!li || li.dataset.pf === pfArr) return; e.preventDefault(); e.stopPropagation(); E.grid.querySelectorAll('.pf-t.sobre').forEach(x => x !== li && x.classList.remove('sobre')); li.classList.add('sobre'); }, true);
  E.grid.addEventListener('drop', async e => { if (!pfArr) return; const li = e.target.closest?.('.pf-t[draggable="true"]'); e.preventDefault(); e.stopPropagation(); const a = pfArr; pfArr = null; if (li && li.dataset.pf !== a) await cambiarDeSitio(a, li.dataset.pf); }, true);
  E.grid.addEventListener('dragend', () => { pfArr = null; E.grid.querySelectorAll('.pf-t.arr, .pf-t.sobre').forEach(x => x.classList.remove('arr', 'sobre')); }, true);
  ov.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('#ctNew')) { const on = E.newMenu.hidden; E.newMenu.hidden = !on; E.newBtn.setAttribute('aria-expanded', on); if (on) E.newMenu.querySelector('button').focus(); return; }
    const nf = t.closest('[data-newf]'); if (nf) { crear(nf.dataset.newf); return; }
    if (t.closest('[data-llenar]')) { await llenarSemana(); return; } // C3
    if (t.closest('[data-tplnew]')) { await desdePlantilla(); return; }
    if (t.closest('[data-okbor]')) { await aprobarBorradores(); return; }
    if (!E.newMenu.hidden && !t.closest('.ct-create')) closeMenu();
    const b = t.closest('.ct-mode button'); if (b) { mode = b.dataset.m; store.set('mode', mode); await panel.flush(); if (mode === 'prog') await loadCola(); if (mode === 'bandeja') bj.load(); render(); return; }
    const v = t.closest('.ct-views button'); if (v) { view = v.dataset.v; store.set('view', view); load(); render(); return; }
    if (t.closest('[data-filters]')) { const on = !ov.classList.contains('chipsOpen'); ov.classList.toggle('chipsOpen', on); t.closest('[data-filters]').setAttribute('aria-expanded', on); return; }
    const sb = t.closest('[data-sal]'); if (sb) { e.stopPropagation(); await accionSalida(sb); return; }
    if (t.closest('[data-comprobar]')) { const b = t.closest('[data-comprobar]'); b.disabled = true; try { const r = await datos.comprobar(); note(r.ok ? (r.texto || `Metricool responde: marca «${r.marca?.nombre || '—'}»${r.marca?.zona ? ' · ' + r.marca.zona : ''}.`) : r.error, !r.ok); if (r.ok) { await loadCola(); render(); } } catch (er) { note(er.message, true); } b.disabled = false; return; }
    const chip = t.closest('.cv-chip'); if (chip) {
      if (chip.dataset.e) { estadoOn.has(chip.dataset.e) ? estadoOn.delete(chip.dataset.e) : estadoOn.add(chip.dataset.e); if (!estadoOn.size) estadoOn = new Set(ORDEN); store.set('estados', [...estadoOn]); }
      else if (chip.dataset.r) { redOn.has(chip.dataset.r) ? redOn.delete(chip.dataset.r) : redOn.add(chip.dataset.r); if (!redOn.size) redOn = new Set(Object.keys(RED)); store.set('redes', [...redOn]); loadHora(); }
      else if (chip.hasAttribute('data-pub')) { pubOn = !pubOn; store.set('pub', pubOn); } // C2: lo publicado fuera de las piezas
      render(); E.chips.querySelector(chip.dataset.e ? `[data-e="${chip.dataset.e}"]` : chip.dataset.r ? `[data-r="${chip.dataset.r}"]` : '[data-pub]')?.focus(); return;
    }
    const ok = t.closest('[data-ok]'); if (ok) { e.stopPropagation(); await aprobar(ok.dataset.ok, ok); return; }
    if (t.closest('[data-okall]')) { await aprobarTodas(); return; }
    const sa = t.closest('[data-selacc]'); if (sa) { await accionVarias(sa.dataset.selacc); return; }
    const gap = t.closest('[data-gap]'); if (gap) { openNew({ fecha: gap.dataset.gap, hora: '18:00' }); return; }
    const open_ = t.closest('[data-open]'); if (open_) { openPiece(open_.dataset.open); return; }
    const nw = t.closest('[data-new]'); if (nw) { openNew({}); return; }
    const pc = t.closest('.pz-pub'); if (pc) { if (!pc.href) verHov(pc); return; } // C2: con enlace, el navegador la abre en su red; sin él, se enseña lo que se sabe
    const evc = t.closest('.cv-ev, .cv-bk'); if (evc) { openPiece(evc.dataset.ev.slice(2)); return; }
    const pfo = t.closest('[data-pfo]'); if (pfo) { openPiece(pfo.dataset.pfo); return; } // plan M5 · U2: la cuadrícula del perfil
    const pfm = t.closest('[data-pfm]'); if (pfm) { const [a, b] = pfm.dataset.pfm.split(':'); await cambiarDeSitio(a, b); E.grid.querySelector(`[data-pf="${CSS.escape(a)}"] .pf-open`)?.focus(); return; }
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
    if (card && card.classList.contains('pz-pub')) { // C2: lo publicado no se mueve ni se abre como pieza (con enlace, Intro lo abre en su red)
      if (!card.href && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); verHov(card); return; }
      if (e.key === 'Enter' || (e.shiftKey && /^Arrow/.test(e.key))) { if (e.key !== 'Enter') e.preventDefault(); return; }
    }
    if (card && card.dataset.ev && e.shiftKey && /^Arrow/.test(e.key)) {
      e.preventDefault(); e.stopPropagation(); const p = todasConocidas().find(x => x.id === card.dataset.ev.slice(2)); if (!p || !p.fecha) return;
      const d = new Date(`${p.fecha}T${p.hora || '09:00'}:00`);
      if (e.key === 'ArrowLeft') d.setDate(d.getDate() - 1); else if (e.key === 'ArrowRight') d.setDate(d.getDate() + 1); else if (e.key === 'ArrowUp') d.setMinutes(d.getMinutes() - 15); else d.setMinutes(d.getMinutes() + 15);
      const nh = (e.key === 'ArrowUp' || e.key === 'ArrowDown' || p.hora) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
      const pasado = motivoPasado(ymd(d), nh); if (pasado) { note(pasado, true); return; } // sin hora solo cuenta el día: no se compara con un 09:00 inventado
      mover(p, ymd(d), nh).then(() => E.grid.querySelector(`[data-ev="p:${CSS.escape(p.id)}"]`)?.focus());
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
  // plan M5 · U7: la selección múltiple de Programación
  ov.addEventListener('change', async e => {
    const ck = e.target.closest?.('[data-selp]'); if (ck) { ck.checked ? selP.add(ck.dataset.selp) : selP.delete(ck.dataset.selp); render(); ov.querySelector(`[data-selp="${CSS.escape(ck.dataset.selp)}"]`)?.focus(); return; }
    const mv = e.target.closest?.('[data-selmover]'); if (mv && mv.value) await accionVarias('mover', mv.value);
    if (e.target.matches?.('[data-fcta]')) { ctaSel = e.target.value; store.set('cuenta', ctaSel); render(); ov.querySelector('[data-fcta]')?.focus(); return; } // 9 oct 2026: solo una cuenta
    const hr = e.target.closest?.('[data-horared]'); if (hr) { horaRedSel = hr.value; store.set('horaRed', horaRedSel); await loadHora(); render(); ov.querySelector('[data-horared]')?.focus(); } // C2: las mejores horas de una red
  });
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
  /** plan M5 · U7: lo mismo a varias piezas. Mover y pasar a revisión se deshacen (las aprobadas se vuelven a aprobar); la papelera espera 8 s. */
  async function accionVarias(que, fecha) {
    const ps = [...selP].map(id => todasConocidas().find(p => p.id === id)).filter(Boolean);
    if (que === 'ninguna' || !ps.length) { selP.clear(); render(); return; }
    if (que === 'borrar') {
      const keys = ps.map(p => 'p:' + p.id); flushUndo(); keys.forEach(k => gone.add(k)); selP.clear(); render();
      commitFn = async () => { for (const p of ps) { try { await datos.remove(p.id); } catch (e) { note('No se pudo: ' + e.message, true); } } keys.forEach(k => gone.delete(k)); load(true); };
      E.toast.querySelector('span').textContent = `${ps.length} a la papelera.`; E.toast.querySelector('button').hidden = false; E.toast.classList.remove('bad'); clearTimeout(noteT); showToast();
      E.toast.querySelector('button').onclick = () => { clearTimeout(undoT); commitFn = null; E.toast.hidden = true; keys.forEach(k => gone.delete(k)); render(); note('Deshecho.'); };
      undoT = setTimeout(flushUndo, 8000); return;
    }
    let ok = 0, mal = 0; const antes = ps.map(p => ({ id: p.id, fecha: p.fecha, estado: p.estado }));
    for (const p of ps) {
      try {
        if (que === 'aprobar') { if (p.estado === 'aprobada') continue; const r = await datos.approve(p.id); put(r.pieza); }
        else if (que === 'revision') { if (p.estado === 'revision') continue; put(await datos.back(p.id, 'revision')); }
        else if (que === 'mover') { const r = await datos.patch(p.id, { fecha }); put(r.pieza); }
        ok++;
      } catch { mal++; }
    }
    selP.clear(); await load(true); render(); loadResumen();
    const hecho = que === 'aprobar' ? 'aprobadas' : que === 'revision' ? 'pasadas a revisión' : `movidas al ${fmtDay(new Date(fecha + 'T00:00:00').getTime())}`;
    const texto = `${ok} ${hecho}${mal ? ` · ${mal} no ${mal === 1 ? 'pudo' : 'pudieron'}${que === 'aprobar' ? ' (les falta algo para salir)' : ''}` : ''}.`;
    if (que === 'aprobar' || !ok) { note(texto, !!mal); return; }
    undoable(texto, async () => {
      for (const a of antes) { try { if (que === 'mover') await datos.patch(a.id, { fecha: a.fecha }); if (a.estado === 'aprobada') await datos.approve(a.id); else if (que === 'revision') await datos.back(a.id, a.estado); } catch {} }
      await load(true); render(); return { aviso: 'Deshecho.' };
    });
  }
  async function aprobarTodas() {
    const lista = todasConocidas().filter(p => p.estado === 'revision' && !errN(p) && p.fecha && p.hora && !revisarMomento(p.fecha, p.hora).errores.length && visible(p)); let ok = 0, mal = 0;
    for (const p of lista) { try { const r = await datos.approve(p.id); put(r.pieza); ok++; } catch { mal++; } }
    render(); loadResumen(); note(`${ok} ${ok === 1 ? 'aprobada' : 'aprobadas'}${mal ? ` · ${mal} no ${mal === 1 ? 'pudo' : 'pudieron'}` : ''}.`, !!mal);
  }
  /** C3: los borradores de la semana que ya pueden salir, aprobados de una vez (el dueño puede aprobar un borrador directamente). */
  async function aprobarBorradores() {
    const hoy = startOfDay(Date.now()), lista = todasConocidas().filter(p => p.estado === 'borrador' && p.fecha && at(p) >= hoy && at(p) < hoy + 8 * DAY && puedeSalir(p) && visible(p)); let ok = 0, mal = 0;
    for (const p of lista) { try { const r = await datos.approve(p.id); put(r.pieza); ok++; } catch { mal++; } }
    await loadCola(); render(); loadResumen(); note(`${ok} ${ok === 1 ? 'aprobado' : 'aprobados'}${mal ? ` · ${mal} no ${mal === 1 ? 'pudo' : 'pudieron'}` : ''}.`, !!mal);
  }
  /** C3: «Llenar la semana» y «Desde una plantilla» llegan con el paquete del editor (src/contenido-herramientas.js). */
  async function herramientas() { flushUndo(); closeMenu(); try { return await panel.herramientas(); } catch (e) { note(e.message, true); return null; } }
  async function llenarSemana() {
    const h = await herramientas(); if (!h?.llenar) return;
    await panel.close({ quiet: true });
    h.llenar({ host: ov, datos, esc, modal, redes: [...redesNegocio], onHecho: async () => { await load(true); render(); loadResumen(); }, onVer: async () => { mode = 'prog'; store.set('mode', mode); await loadCola(); render(); E.prog.querySelector('#ctp-bor, #ctp-acc')?.scrollIntoView({ block: 'start' }); } });
  }
  async function desdePlantilla() {
    const h = await herramientas(); if (!h?.plantillas) return;
    h.plantillas({ host: ov, datos, esc, modal, onUsar: t => {
      const redes = (t.redes || []).length ? [...t.redes] : [...redesNegocio];
      openNew({ formato: t.formato, redes, fecha: siguienteHueco(redes, todasConocidas().filter(p => p.estado !== 'idea')), hora: '18:00',
        extra: { titulo: t.nombre, formatos: { ...(t.formatos || {}) }, texto: t.texto || '', comentario: t.comentario || '', hashtags: t.hashtags || '', hashtagsEnComentario: !!t.hashtagsEnComentario, textoFacebook: t.textoFacebook || '', textos: { ...(t.textos || {}) }, notas: t.notas || '', historiaTambien: !!t.historiaTambien } });
      note(`Desde la plantilla «${t.nombre}»: cambia lo que toque y ponle la imagen.`);
    } });
  }
  /** M1: entregar ya, reintentar o quitar de la cola. Quitar pide un segundo clic (le quita el OK y la retira del conductor). */
  async function accionSalida(b) {
    const que = b.dataset.sal, id = b.dataset.id;
    if (que === 'quitar' && b.dataset.armed !== '1') { b.dataset.armed = '1'; const was = b.textContent; b.textContent = 'Pulsa otra vez para quitarla'; setTimeout(() => { if (document.contains(b)) { b.dataset.armed = ''; b.textContent = was; } }, 5000); return; }
    b.disabled = true;
    try { const r = await datos.salida(id, que); if (r.pieza) put(r.pieza); await loadCola(); render(); loadResumen(); note(que === 'quitar' ? 'Quitada de la cola: vuelve a revisión, y si ya estaba en el conductor se retira en un momento.' : que === 'entregar' ? 'Se entrega en un momento.' : 'Se vuelve a intentar en un momento.'); }
    catch (er) { note(er.message, true); b.disabled = false; }
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
    try { ctas = await datos.cuentas(); for (const c of ctas.cuentas || []) if (c.id === ctas.porDefecto?.[c.red]) cuentas[c.red] = { nombre: c.nombre, usuario: c.usuario || '', foto: c.foto || '' }; } catch {} // 9 oct 2026: GET /api/contenido/cuentas (ligera, sin llamar a Meta)
    const ig = cuentas.instagram?.usuario ? '@' + cuentas.instagram.usuario : '', fb = cuentas.facebook?.nombre || '';
    $('#ctCo').textContent = [ig, fb].filter(Boolean).join(' · ') || cuentas.empresa;
    if (panel.isOpen()) panel.repaintPreview();
    if (openNow) { lastGrid = ''; lastProg = ''; render(); }
  }

  /* ---------- abrir y cerrar ---------- */
  const isOn = () => openNow;
  function open() {
    if (openNow) return; views.opening('contenido'); openNow = true; opener = document.activeElement;
    mode = store.get('mode', 'cal'); view = store.get('view', 'month'); if (narrow() && (view === 'month' || view === 'week')) view = 'agenda';
    ov.inert = false; modal.open(ov); cuentas.empresa = empresa(); $('#ctCo').textContent = cuentas.empresa; ov.classList.add('on'); document.body.classList.add('ctOpen');
    lastGrid = ''; lastProg = ''; render(); load(true); loadResumen(); loadCuentas(); ov.tabIndex = -1; ov.focus();
    timer = setInterval(() => { if (!document.hidden && !panel.isOpen()) load(true); }, 20000); // lo que dejan los agentes aparece solo
    panel.precargar(); // C1: el editor de piezas se trae ya, mientras miras el calendario
  }
  async function close(o = {}) {
    if (!openNow) return; flushUndo(); closeMenu(); await panel.close({ quiet: true }); openNow = false; closePop(); modal.close(ov); ov.inert = true; ov.classList.remove('on'); document.body.classList.remove('ctOpen'); clearInterval(timer); timer = null;
    if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); loadResumen();
  }
  views.add('contenido', { isOpen: isOn, close });
  addEventListener('resize', () => { if (openNow && !E.toast.hidden) placeToast(); });
  addEventListener('resize', () => { if (openNow && mode === 'cal' && view === 'month') { clearTimeout(resizeT); resizeT = setTimeout(() => { if (!(dnd && dnd.dragging)) { lastGrid = ''; render(); } }, 150); } }); let resizeT = 0;
  return {
    open, close, toggle: () => (openNow ? close() : open()), isOpen: isOn, openPiece,
    selection() { if (!openNow) return null; const p = panel.isOpen() ? panel.current() : null; return p && p.id ? { view: 'contenido', label: `Pieza «${p.titulo || (p.texto || '').slice(0, 40) || 'sin título'}»${p.fecha ? ' · ' + p.fecha : ''}`, kind: 'pieza', id: p.id } : { view: 'contenido', label: `Contenido · ${E.title ? E.title.textContent.replace(/\s+/g, ' ').trim().split(' · ')[0] : ''}`.replace(/ · $/, ''), kind: 'range', id: ymd(new Date(anchor)) }; }, // V4.8: what Dimitri sees beside it
    refresh: () => { if (openNow && !panel.isOpen()) load(true); else loadResumen(); },
    panelOpen: () => panel.isOpen(), closePanel: () => panel.close(), popOpen: () => !E.pop.hidden, closePop,
    /** Lo que hay en un rango de días, para la capa del calendario de tareas (solo lectura). */
    async between(desde, hasta) { try { return (await datos.list({ desde, hasta })).piezas; } catch { return []; } },
    /** Desde el Estudio: una imagen o un video pasa a ser una pieza nueva (sin día, como idea) y se abre para terminarla. */
    async fromMedia(file, kind, prompt) {
      try { const p = await datos.create({ titulo: String(prompt || '').slice(0, 60), formato: kind === 'video' ? 'reel' : 'post', medios: [file], estado: 'idea', redes: [...redesNegocio] }); open(); pieces.push(p); cola.push(p); await openPiece(p.id); return p; }
      catch (e) { return { error: e.message }; }
    },
  };
}
