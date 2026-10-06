// La VISTA TAREAS (plan T2, 6 oct 2026; docs/analisis-taskview-2026-10-06.md §6). Entra en el paquete aparte dist/tareas-vista.js
// (build-tareas.mjs) y la página la trae al abrir Tareas (src/tareas-carga.js). Cinco pestañas: INICIO (lo de hoy), LISTA (todo, con
// filtros, orden, agrupar y varias a la vez), TABLERO (por estado, con carriles por departamento), PROYECTOS (con su mapa) y MEDIDAS.
// Arriba, un solo campo que AÑADE o BUSCA. Al lado, el DETALLE de la tarea abierta. La dirección guarda dónde estás
// (#tareas=lista&prio=alta&t=<id>): volver atrás funciona y una tarea se puede enlazar.
import { crearDatos } from './datos.js';
import { esc, svg, ymd } from './comun.js';
import { inicioHTML, PRESET_SECCION } from './inicio.js';
import { listaHTML, barraFiltros, chipsFiltro, barraSeleccion, FILTROS } from './lista.js';
import { tableroHTML, movimiento, columnaDe } from './tablero.js';
import { proyectosHTML, proyectoHTML, formProyectoHTML } from './proyectos.js';
import { medidasHTML } from './medidas.js';
import { detalleHTML, ORDEN_CAMPOS } from './detalle.js';
import { leerRapida } from '../../tareas/rapida.mjs';
import { activo as activoCrono } from '../../tareas/cronometro.mjs';

/* global __AO_TAREAS_VERSION__ */
const VERSION = typeof __AO_TAREAS_VERSION__ === 'string' ? __AO_TAREAS_VERSION__ : '';
const TABS = [['inicio', 'Inicio'], ['lista', 'Lista'], ['tablero', 'Tablero'], ['proyectos', 'Proyectos'], ['medidas', 'Medidas']];
const guarda = { get: (k, d) => { try { const v = localStorage.getItem('ao.tv.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('ao.tv.' + k, JSON.stringify(v)); } catch {} } };

function init(ov, ctx) {
  const datos = crearDatos({ servida: ctx.servida, agentes: ctx.AGENTS });
  const S = { tab: guarda.get('tab', 'inicio'), tareas: [], cat: { proyectos: [], etiquetas: [] }, f: {}, orden: guarda.get('orden', 'cola'), grupo: guarda.get('grupo', 'nada'), sel: new Set(), plegadas: new Set(guarda.get('plegadas', [])),
    carriles: guarda.get('carriles', false), colMovil: 'cola', proyecto: null, mapa: false, cerrados: false, dias: 30, kpi: null, resumen: null, detalle: null, modo: 'anadir', dept: guarda.get('dept', ctx.DEPT_KEYS[0]), personas: [], abierta: false, cargado: false, error: '' };
  const agentes = new Map(ctx.AGENTS.map(a => [a.id, a]));
  const c = {
    porId: new Map(), agente: id => agentes.get(id), depto: k => ctx.DEPTS[k], deptKeys: ctx.DEPT_KEYS,
    proyecto: id => S.cat.proyectos.find(p => p.id === id), etiqueta: id => S.cat.etiquetas.find(e => e.id === id),
    proyectos: () => S.cat.proyectos.filter(p => p.estado !== 'archivado'), etiquetas: () => S.cat.etiquetas, tareas: () => S.tareas,
    agentesDe: d => ctx.AGENTS.filter(a => a.dept === d), personas: () => S.personas, enOficina: !!ctx.abrirEnOficina,
    prefCampos: () => guarda.get('campos', { orden: [], ocultos: [] }), quienSoy: () => 'Tú', // plan T6
  };
  ov.innerHTML = `<div class="tv">
    <div class="tv-top"><h1 class="tv-h1">Tareas</h1>
      <div class="tv-tabs" role="tablist" aria-label="Cómo ver las tareas">${TABS.map(([k, n]) => `<button type="button" role="tab" id="tvTab-${k}" data-tab="${k}" aria-controls="tvMain">${svg(k)}<span>${n}</span><b class="tv-n" hidden></b></button>`).join('')}</div>
      <button type="button" class="tv-icb tv-x" data-cerrarvista aria-label="Cerrar Tareas" title="Cerrar (Esc)">${svg('x')}</button></div>
    <form class="tv-rapida" autocomplete="off">
      <div class="tv-modo" role="group" aria-label="El campo de arriba"><button type="button" data-modo="anadir" aria-pressed="true">${svg('mas')}Añadir</button><button type="button" data-modo="buscar" aria-pressed="false">${svg('buscar')}Buscar</button></div>
      <label class="tv-sel tv-rdept"><span class="tv-sr">Departamento</span><select data-rdept>${ctx.DEPT_KEYS.map(k => `<option value="${k}">${esc(ctx.DEPTS[k].name)}</option>`).join('')}</select></label>
      <input class="tv-rin" data-rin placeholder="Qué hay que hacer… (#etiqueta, !alta, «para el viernes»)" aria-label="Añadir una tarea" maxlength="4000">
      <label class="tv-tog tv-ridea"><input type="checkbox" data-ridea> Como idea</label>
      <button type="submit" class="tv-btn pri" data-rok>Añadir</button>
      <p class="tv-rhint" aria-live="polite"></p></form>
    <p class="tv-demo" hidden>Ejemplo: esta es la demo. Con la oficina abierta (npm start) ves tus tareas de verdad.</p>
    <div class="tv-cuerpo"><main class="tv-main" id="tvMain" role="tabpanel" tabindex="-1"></main><aside class="tv-det" aria-label="Detalle de la tarea" hidden></aside></div>
    <div class="tv-toast" role="status" hidden><span></span><button type="button" data-deshacer>DESHACER</button><button type="button" class="tv-icb" data-cerrartoast aria-label="Cerrar el aviso">${svg('x')}</button></div></div>`;
  const $ = s => ov.querySelector(s);
  const main = $('.tv-main'), det = $('.tv-det'), rin = $('[data-rin]'), rdept = $('[data-rdept]'), toast = $('.tv-toast'), hint = $('.tv-rhint');
  rdept.value = S.dept; $('.tv-demo').hidden = !datos.demo;

  /* ---------- la dirección ---------- */
  function leerHash() {
    const h = new URLSearchParams(location.hash.slice(1)); if (!h.has('tareas')) return null;
    const tab = h.get('tareas'); if (TABS.some(([k]) => k === tab)) S.tab = tab;
    S.f = {}; for (const k of FILTROS) if (h.get(k)) S.f[k] = k === 'hechas' ? true : h.get(k);
    if (h.get('p')) S.proyecto = h.get('p');
    return h.get('t');
  }
  function escribirHash() {
    if (!S.abierta) return;
    const h = new URLSearchParams(location.hash.slice(1)); for (const k of ['tareas', 't', 'p', ...FILTROS]) h.delete(k);
    h.set('tareas', S.tab); if (S.tab === 'lista') for (const k of FILTROS) if (S.f[k]) h.set(k, S.f[k] === true ? '1' : S.f[k]);
    if (S.tab === 'proyectos' && S.proyecto) h.set('p', S.proyecto); if (S.detalle) h.set('t', S.detalle);
    const nuevo = '#' + h.toString().replace(/=(?=&|$)/g, ''); if (nuevo !== location.hash) history.replaceState(null, '', nuevo);
  }
  function limpiarHash() { const h = new URLSearchParams(location.hash.slice(1)); for (const k of ['tareas', 't', 'p', ...FILTROS]) h.delete(k); const s = h.toString(); history.replaceState(null, '', s ? '#' + s : location.pathname + location.search); }

  /* ---------- cargar ---------- */
  async function cargar() {
    try {
      const [l, cat] = await Promise.all([datos.lista(), datos.catalogo()]);
      S.tareas = l; S.cat = cat; c.porId = new Map(l.map(t => [t.id, t])); S.cargado = true; S.error = '';
      for (const id of [...S.sel]) if (!c.porId.has(id)) S.sel.delete(id);
    } catch (e) { S.error = e.message; }
    if (!S.personas.length && ctx.servida) { try { S.personas = ((await (await fetch('/api/team')).json()).people || []).map(p => p.name); } catch {} }
    pintar();
  }
  let reloj = 0; const escribiendo = () => { const a = document.activeElement; return !!a && ov.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName); };
  const vigilar = () => { clearInterval(reloj); reloj = setInterval(() => { if (!document.hidden && !escribiendo() && !arr) cargar().then(() => S.detalle && refrescarDetalle(false)); }, 8000); }; // lo que hacen los agentes aparece solo

  /* ---------- pintar ---------- */
  function contar() {
    const n = { inicio: S.tareas.filter(t => t.state === 'waiting').length };
    for (const [k] of TABS) { const b = ov.querySelector(`[data-tab="${k}"]`), x = b.querySelector('.tv-n'); b.setAttribute('aria-selected', String(k === S.tab)); b.tabIndex = k === S.tab ? 0 : -1; x.hidden = !n[k]; x.textContent = n[k] || ''; if (n[k]) b.setAttribute('aria-label', `${b.textContent.replace(/\d+$/, '').trim()}: ${n[k]} esperan tu OK`); else b.removeAttribute('aria-label'); }
    main.setAttribute('aria-labelledby', 'tvTab-' + S.tab);
  }
  function pintar() {
    contar(); escribirHash();
    if (!S.cargado) { main.innerHTML = S.error ? `<div class="tv-vacio"><b>No se pudieron traer las tareas</b><span>${esc(S.error)}</span><button type="button" class="tv-btn" data-reintentar>Reintentar</button></div>` : '<p class="tv-cargando">Cargando…</p>'; return; }
    const scroll = main.scrollTop;
    if (S.tab === 'inicio') main.innerHTML = inicioHTML(S.tareas, c, S.plegadas, { crono: activoCrono(S.tareas, 'Tú') });
    else if (S.tab === 'lista') { const r = listaHTML(S.tareas, S.f, c, { orden: S.orden, grupo: S.grupo, sel: S.sel }); S.idsLista = r.ids; main.innerHTML = `${barraFiltros(S.f, c, { orden: S.orden, grupo: S.grupo })}<div class="tv-fchips">${chipsFiltro(S.f, c)}<span class="tv-total">${r.total} ${r.total === 1 ? 'tarea' : 'tareas'}</span></div>${barraSeleccion(S.sel.size, c)}<div class="tv-lista">${r.html}</div>`; }
    else if (S.tab === 'tablero') main.innerHTML = `<div class="tv-tbh"><label class="tv-tog"><input type="checkbox" data-carriles${S.carriles ? ' checked' : ''}> Un carril por departamento</label><span class="tv-ayuda">Arrastra una tarjeta para cambiarla de estado, de turno o de departamento; todo se puede deshacer.</span></div>${tableroHTML(S.tareas, c, { carriles: S.carriles, colMovil: S.colMovil })}`;
    else if (S.tab === 'proyectos') { const p = S.proyecto && c.proyecto(S.proyecto) || (S.proyecto && S.cat.proyectos.find(x => x.id === S.proyecto)); main.innerHTML = S.formP ? formProyectoHTML(S.formP) : p ? proyectoHTML(p, S.tareas, c, { mapa: S.mapa }) : proyectosHTML(S.cat, c, { mostrarCerrados: S.cerrados }); }
    else if (S.tab === 'medidas') { main.innerHTML = medidasHTML(S.resumen, c, { dias: S.dias, abierta: S.kpi, webhooks: S.webhooks }); if (!S.resumen) cargarResumen(); }
    main.scrollTop = scroll;
  }
  async function cargarResumen() { try { S.webhooks = await datos.webhooks().catch(() => null); S.resumen = await datos.resumen(S.dias); } catch (e) { S.resumen = null; aviso('No pude calcular las medidas: ' + e.message); return; } if (S.tab === 'medidas') pintar(); }

  /* ---------- avisos con DESHACER ---------- */
  let deshacer = null, tt = 0;
  function aviso(texto, fnDeshacer = null) {
    deshacer = fnDeshacer; toast.querySelector('span').textContent = texto; toast.querySelector('[data-deshacer]').hidden = !fnDeshacer; toast.hidden = false;
    clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; deshacer = null; }, fnDeshacer ? 8000 : 5000);
  }
  toast.addEventListener('pointerenter', () => clearTimeout(tt)); toast.addEventListener('focusin', () => clearTimeout(tt));
  toast.addEventListener('click', async e => {
    if (e.target.closest('[data-cerrartoast]')) { toast.hidden = true; deshacer = null; return; }
    if (!e.target.closest('[data-deshacer]') || !deshacer) return;
    const fn = deshacer; deshacer = null; toast.hidden = true;
    try { await fn(); aviso('Deshecho.'); } catch (er) { aviso(/En curso|ya empezó|está en curso/.test(er.message) ? 'Ya la empezó el agente: si no la quieres, detenla en su detalle.' : 'No se pudo deshacer: ' + er.message); }
    await cargar(); if (S.detalle) refrescarDetalle(false); ctx.alCambiar?.();
  });
  async function hacer(fn, ok, fnDeshacer) { try { const r = await fn(); if (ok) aviso(typeof ok === 'function' ? ok(r) : ok, fnDeshacer ? () => fnDeshacer(r) : null); await cargar(); if (S.detalle) refrescarDetalle(false); ctx.alCambiar?.(); return r; } catch (e) { aviso('No se pudo: ' + e.message); return null; } }

  /* ---------- añadir / buscar ---------- */
  function pista() {
    if (S.modo === 'buscar') { hint.textContent = ''; return; }
    const r = leerRapida(rin.value); const bits = [];
    if (r.prioridad) bits.push(`prioridad ${r.prioridad}`); if (r.limite) bits.push(`fecha límite ${r.limite}`); if (r.at) bits.push(`arranca ${new Date(r.at).toLocaleString('es', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`); if (r.etiquetas) bits.push(r.etiquetas.map(e => '#' + e).join(' '));
    hint.textContent = rin.value.trim() && bits.length ? 'Entendí: ' + bits.join(' · ') : '';
  }
  async function etiquetasDe(nombres = []) { const ids = []; for (const n of nombres) { const ya = S.cat.etiquetas.find(e => e.nombre.toLowerCase() === n); if (ya) ids.push(ya.id); else { try { ids.push((await datos.etiqueta.crear({ nombre: n })).etiqueta.id); } catch {} } } return ids; }
  async function anadir(extra = {}) {
    const raw = rin.value.trim(); if (!raw) { rin.focus(); return; }
    const r = leerRapida(raw); if (!r.texto) { aviso('Escribe qué hay que hacer.'); return; }
    const etiquetas = await etiquetasDe(r.etiquetas), idea = $('[data-ridea]').checked;
    const cuerpo = { dept: rdept.value, text: r.texto, ...(r.prioridad ? { prioridad: r.prioridad } : {}), ...(r.limite ? { limite: r.limite } : {}), ...(r.at ? { at: r.at } : {}), ...(etiquetas.length ? { etiquetas } : {}), ...(idea ? { idea: true } : {}), ...extra };
    rin.value = ''; pista(); $('[data-rok]').disabled = true;
    const t = await hacer(() => datos.crear(cuerpo), x => `${idea ? 'Idea guardada' : 'Añadida'}: «${x.title}»${x.agent ? ' — la tiene ' + (c.agente(x.agent)?.name || x.agent) : ''}.`, x => datos.accion.borrar(x.id));
    $('[data-rok]').disabled = false; if (!t) rin.value = raw;
    S.dept = rdept.value; guarda.set('dept', S.dept); S.preset = null;
  }
  ov.querySelector('.tv-rapida').addEventListener('submit', e => { e.preventDefault(); if (S.modo === 'buscar') return; anadir(S.preset || {}); });
  rin.addEventListener('input', () => { if (S.modo === 'buscar') { S.f.q = rin.value.trim() || undefined; if (S.tab !== 'lista') S.tab = 'lista'; pintar(); } else pista(); });

  /* ---------- el detalle ---------- */
  async function abrirDetalle(id, foco = true) {
    S.detalle = id; det.hidden = false; ov.classList.add('con-det'); det.innerHTML = '<p class="tv-cargando">Cargando…</p>'; escribirHash();
    await refrescarDetalle(foco);
  }
  async function refrescarDetalle(foco) {
    const id = S.detalle; if (!id) return;
    let r; try { r = await datos.detalle(id); } catch (e) { det.innerHTML = `<div class="tv-vacio"><b>Esa tarea ya no está</b><span>${esc(e.message)}</span><button type="button" class="tv-btn" data-cerrar>Cerrar</button></div>`; return; }
    if (S.detalle !== id) return;
    const t0 = c.porId.get(id); if (t0?.queue) r.tarea.queue = t0.queue;
    const activo = document.activeElement, sel = activo && det.contains(activo) ? (activo.dataset.c ? `[data-c="${activo.dataset.c}"]` : activo.hasAttribute('data-addpaso') ? '[data-addpaso]' : activo.hasAttribute('data-comentar') ? '[data-comentar]' : null) : null;
    if (sel && /INPUT|TEXTAREA/.test(activo.tagName) && !foco) return; // escribiendo: no se pinta encima
    const sc = det.scrollTop; det.innerHTML = detalleHTML(r, c); det.scrollTop = sc;
    if (foco) (det.querySelector('.tv-titin') || det.querySelector('h2') || det).focus?.(); else if (sel) det.querySelector(sel)?.focus();
  }
  function cerrarDetalle(volver = true) { if (!S.detalle) return false; const id = S.detalle; S.detalle = null; det.hidden = true; det.innerHTML = ''; ov.classList.remove('con-det'); escribirHash(); if (volver) main.querySelector(`[data-abrir="${CSS.escape(id)}"]`)?.focus(); return true; }
  // guardar solo: medio segundo después de dejar de escribir (y al salir del campo)
  let espera = 0, pend = null;
  const programar = (id, campos) => { pend = { id, campos: { ...(pend?.id === id ? pend.campos : {}), ...campos } }; clearTimeout(espera); espera = setTimeout(guardarYa, 500); estadoGuardado('Guardando…'); };
  async function guardarYa() {
    clearTimeout(espera); const p = pend; pend = null; if (!p) return;
    const trabajo = {}, org = {};
    for (const [k, v] of Object.entries(p.campos)) (['text', 'title', 'agent', 'at'].includes(k) ? trabajo : org)[k] = v;
    try {
      if (Object.keys(trabajo).length) await datos.editar(p.id, { ...trabajo, reroute: false });
      if (Object.keys(org).length) await datos.organizar(p.id, org);
      estadoGuardado('Guardado'); await cargar(); ctx.alCambiar?.(); if (S.detalle === p.id) refrescarDetalle(false);
    } catch (e) { estadoGuardado('No se guardó: ' + e.message, true); }
  }
  const estadoGuardado = (txt, mal) => { const el = det.querySelector('.tv-guardado'); if (el) { el.textContent = txt; el.classList.toggle('mal', !!mal); } };
  async function accion(k) {
    const id = S.detalle, t = c.porId.get(id) || {};
    const nombre = `«${(t.title || '').slice(0, 50)}»`;
    if (k === 'pedir') return hacer(() => datos.estado(id, 'next'), `Pedida: ${nombre} entra en la cola.`, () => datos.estado(id, 'idea'));
    if (k === 'aparcar') return hacer(() => datos.estado(id, 'idea'), `${nombre} vuelve a ideas.`, () => datos.estado(id, 'next'));
    if (k === 'hecha') return hacer(() => datos.estado(id, 'done'), `${nombre} marcada como hecha, sin ejecutarla.`, () => datos.estado(id, 'next'));
    if (k === 'ejecutar') return hacer(() => datos.accion.ejecutar(id), `${nombre}: el agente la empieza en cuanto tenga turno.`);
    if (k === 'ya') { const prev = t.dueAt; return hacer(() => datos.editar(id, { at: null }), `${nombre} arranca ya.`, prev && prev > Date.now() ? () => datos.editar(id, { at: prev }) : null); }
    if (k === 'aprobar') return hacer(() => datos.accion.aprobar(id), `Aprobada: ${nombre}. El agente la envía.`, () => datos.accion.deshacerAprobar(id));
    if (k === 'devolver') { const b = det.querySelector('.tv-devolver'); b.hidden = false; b.querySelector('textarea').focus(); return; }
    if (k === 'devolver-no') { det.querySelector('.tv-devolver').hidden = true; return; }
    if (k === 'devolver-ok') { const n = det.querySelector('#tvdNota').value.trim(); if (!n) { det.querySelector('#tvdNota').focus(); return; } return hacer(() => datos.accion.devolver(id, n), `Devuelta: ${nombre} se rehace con tu nota.`); }
    if (k === 'detener') return hacer(() => datos.accion.detener(id), `Detenida: ${nombre}.`);
    if (k === 'repetir') return hacer(() => datos.accion.repetir(id), r => `Otra vez: «${r.title}» entra en la cola.`, r => datos.accion.borrar(r.id));
    if (k === 'archivar') { const r = await hacer(() => datos.accion.archivar(id, true), `Archivada: ${nombre}.`, () => datos.accion.archivar(id, false)); if (r) cerrarDetalle(); return; }
    if (k === 'comentar') { const i = det.querySelector('[data-comentar]'); const txt = i.value.trim(); if (!txt) return i.focus(); i.value = ''; return hacer(() => datos.accion.comentar(id, txt)); }
    if (k === 'oficina') return ctx.abrirEnOficina?.(id);
    if (k === 'borrar') { // se va al cerrar el aviso; DESHACER la deja
      const t1 = c.porId.get(id); cerrarDetalle(false); S.tareas = S.tareas.filter(x => x.id !== id); c.porId.delete(id); pintar();
      let vuelve = false; aviso(`Eliminada: ${nombre}.`, async () => { vuelve = true; });
      setTimeout(async () => { if (vuelve) { await cargar(); return; } try { await datos.accion.borrar(id); } catch (e) { aviso('No se pudo eliminar: ' + e.message); } await cargar(); ctx.alCambiar?.(); }, 8200);
      return t1;
    }
  }

  /* ---------- clics ---------- */
  ov.addEventListener('click', async e => {
    const b = e.target.closest('button, [data-abrir]'); if (!b || !ov.contains(b)) return;
    const d = b.dataset;
    if (d.cerrarvista !== undefined) return ctx.cerrar();
    if (d.tab) { S.tab = d.tab; guarda.set('tab', S.tab); S.kpi = null; if (d.tab !== 'proyectos') { S.proyecto = null; S.formP = null; } pintar(); return; }
    if (d.modo) { S.modo = d.modo; for (const x of ov.querySelectorAll('[data-modo]')) x.setAttribute('aria-pressed', String(x.dataset.modo === S.modo)); ov.querySelector('.tv-rapida').classList.toggle('buscar', S.modo === 'buscar'); rin.placeholder = S.modo === 'buscar' ? 'Buscar en las tareas…' : 'Qué hay que hacer… (#etiqueta, !alta, «para el viernes»)'; rin.setAttribute('aria-label', S.modo === 'buscar' ? 'Buscar en las tareas' : 'Añadir una tarea'); if (S.modo === 'anadir') { delete S.f.q; } else if (rin.value.trim()) { S.f.q = rin.value.trim(); S.tab = 'lista'; } pintar(); pista(); rin.focus(); return; }
    if (d.reintentar !== undefined) return cargar();
    if (d.abrir) return abrirDetalle(d.abrir);
    if (d.cerrar !== undefined) return cerrarDetalle();
    if (d.ok) return hacer(() => datos.accion.aprobar(d.ok), 'Aprobada: el agente la envía.', () => datos.accion.deshacerAprobar(d.ok));
    if (d.plegar) { const k = d.plegar; S.plegadas.has(k) ? S.plegadas.delete(k) : S.plegadas.add(k); guarda.set('plegadas', [...S.plegadas]); pintar(); main.querySelector(`[data-plegar="${k}"]`)?.focus(); return; }
    if (d.anadir) { S.preset = PRESET_SECCION[d.anadir]?.() || null; S.modo = 'anadir'; rin.focus(); hint.textContent = S.preset?.limite ? `Con fecha límite ${S.preset.limite}.` : ''; return; }
    if (d.quitar) { if (d.quitar === '*') S.f = {}; else delete S.f[d.quitar]; if (d.quitar === 'q' || d.quitar === '*') rin.value = ''; pintar(); return; }
    if (d.lotebtn) {
      if (d.lotebtn === 'ninguna') { S.sel.clear(); pintar(); return; }
      const ids = [...S.sel]; const r = await hacer(() => datos.lote(ids, d.lotebtn), x => `${x.hechas.length} ${d.lotebtn === 'pedir' ? 'pedidas' : 'archivadas'}${x.saltadas.length ? ` · ${x.saltadas.length} no se podían` : ''}.`, x => datos.deshacerLote(x.antes)); if (r) S.sel.clear(); pintar(); return;
    }
    if (d.colmovil) { S.colMovil = d.colmovil; pintar(); return; }
    if (d.nuevop !== undefined) { S.formP = {}; pintar(); main.querySelector('[name="nombre"]')?.focus(); return; }
    if (d.editarp) { S.formP = { ...c.proyecto(d.editarp) || S.cat.proyectos.find(p => p.id === d.editarp) }; pintar(); main.querySelector('[name="nombre"]')?.focus(); return; }
    if (d.cancelarp !== undefined) { S.formP = null; pintar(); return; }
    if (d.borrarp !== undefined) { const id = S.formP.id; S.formP = null; S.proyecto = null; await hacer(() => datos.proyecto.borrar(id), r => `Proyecto borrado: «${r.proyecto.nombre}». Sus ${r.tareas.length} tareas se quedan, sin proyecto.`, r => datos.proyecto.restaurar(r.proyecto, r.tareas)); return; }
    if (d.abrirp) { S.proyecto = d.abrirp; S.mapa = false; pintar(); main.focus(); return; }
    if (d.volverp !== undefined) { const id = S.proyecto; S.proyecto = null; pintar(); main.querySelector(`[data-abrirp="${CSS.escape(id)}"]`)?.focus(); return; }
    if (d.pmodo) { S.mapa = d.pmodo === 'mapa'; pintar(); return; }
    if (d.anadirp) { S.preset = { proyecto: d.anadirp }; S.modo = 'anadir'; hint.textContent = `Va al proyecto «${c.proyecto(d.anadirp)?.nombre || ''}».`; rin.focus(); return; }
    if (d.siguiente) { const t = c.porId.get(d.siguiente); S.preset = { bloqueadaPor: [d.siguiente], ...(t?.proyecto ? { proyecto: t.proyecto } : {}) }; rdept.value = t?.dept || rdept.value; S.modo = 'anadir'; hint.textContent = `Esperará a «${t?.title || ''}».`; rin.focus(); return; }
    if (d.encender) return hacer(() => datos.encenderWebhook(d.encender), 'Webhook encendido de nuevo.').then(() => { S.resumen = null; pintar(); });
    if (d.kpi) { S.kpi = S.kpi === d.kpi ? null : d.kpi; pintar(); return; }
    // dentro del detalle
    if (!S.detalle) return;
    if (d.acc) return accion(d.acc);
    if (d.prio) return programar(S.detalle, { prioridad: d.prio }), guardarYa();
    if (d.lim !== undefined) return programar(S.detalle, { limite: d.lim || null }), guardarYa();
    if (d.quitaret) { const t = c.porId.get(S.detalle); return programar(S.detalle, { etiquetas: (t.etiquetas || []).filter(x => x !== d.quitaret) }), guardarYa(); }
    if (d.quitarpaso) { const t = c.porId.get(S.detalle); return programar(S.detalle, { pasos: (t.pasos || []).filter(p => p.id !== d.quitarpaso) }), guardarYa(); }
    if (d.quitarbl) { const t = c.porId.get(S.detalle); return programar(S.detalle, { bloqueadaPor: (t.bloqueadaPor || []).filter(x => x !== d.quitarbl) }), guardarYa(); }
    if (d.cronoid) return hacer(() => datos.cronometro(d.cronoid, 'parar'), 'Cronómetro parado.'); // plan T6: from Inicio
    if (d.crono) { const id = S.detalle; return hacer(() => datos.cronometro(id, d.crono), d.crono === 'iniciar' ? 'Cronómetro en marcha.' : 'Cronómetro parado.'); } // plan T6
    if (d.campomover) { const [k, dir] = d.campomover.split(':'), p = c.prefCampos(), orden = [...ORDEN_CAMPOS].sort((a, b) => { const i = x => { const j = (p.orden || []).indexOf(x); return j < 0 ? 99 + ORDEN_CAMPOS.indexOf(x) : j; }; return i(a) - i(b); }); const i = orden.indexOf(k), j = i + +dir; if (j < 0 || j >= orden.length) return; [orden[i], orden[j]] = [orden[j], orden[i]]; guarda.set('campos', { ...p, orden }); await refrescarDetalle(false); const det2 = det.querySelector('.tv-pers'); if (det2) det2.open = true; det.querySelector(`[data-campomover="${k}:${dir}"]`)?.focus(); return; }
    if (d.copiar !== undefined) { const url = `${location.origin}${location.pathname}#tareas=${S.tab}&t=${S.detalle}`; try { await navigator.clipboard.writeText(url); aviso('Enlace copiado.'); } catch { aviso(url); } }
  });

  /* ---------- cambios en los campos ---------- */
  ov.addEventListener('change', async e => {
    const el = e.target, d = el.dataset;
    if (d.f !== undefined) { const v = el.type === 'checkbox' ? el.checked || undefined : el.value || undefined; if (v === undefined) delete S.f[d.f]; else S.f[d.f] = v; pintar(); return; }
    if (d.orden !== undefined) { S.orden = el.value; guarda.set('orden', S.orden); pintar(); return; }
    if (d.grupo !== undefined) { S.grupo = el.value; guarda.set('grupo', S.grupo); pintar(); return; }
    if (d.carriles !== undefined) { S.carriles = el.checked; guarda.set('carriles', S.carriles); pintar(); return; }
    if (d.cerrados !== undefined) { S.cerrados = el.checked; pintar(); return; }
    if (d.dias !== undefined) { S.dias = +el.value; S.resumen = null; S.kpi = null; pintar(); return; }
    if (d.rdept !== undefined) { S.dept = el.value; guarda.set('dept', S.dept); return; }
    if (d.sel) { el.checked ? S.sel.add(d.sel) : S.sel.delete(d.sel); const bar = main.querySelector('.tv-selbar'); const nueva = barraSeleccion(S.sel.size, c); if (bar) bar.outerHTML = nueva || ''; else if (nueva) main.querySelector('.tv-lista')?.insertAdjacentHTML('beforebegin', nueva); el.closest('.tv-fila')?.classList.toggle('sel', el.checked); return; }
    if (d.lote) { const v = el.value; if (!v && d.lote !== 'limite') return; const ids = [...S.sel]; const valor = v === 'null' ? null : v || null; await hacer(() => datos.lote(ids, d.lote, valor), x => `${x.hechas.length} ${x.hechas.length === 1 ? 'cambiada' : 'cambiadas'}${x.saltadas.length ? ` · ${x.saltadas.length} no se podían (hechas o en curso)` : ''}.`, x => datos.deshacerLote(x.antes)); return; }
    if (!S.detalle) return;
    if (d.c) {
      if (d.c === 'proyecto' && el.value === '+') { el.value = c.porId.get(S.detalle)?.proyecto || ''; S.tab = 'proyectos'; S.formP = {}; pintar(); main.querySelector('[name="nombre"]')?.focus(); return; }
      const v = d.c === 'at' ? (el.value ? new Date(el.value).getTime() : null) : d.c === 'estimacion' ? (el.value ? +el.value : null) : el.value || null;
      programar(S.detalle, { [d.c]: v }); if (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'datetime-local') guardarYa(); return;
    }
    if (d.campover) { const p = c.prefCampos(), oc = new Set(p.ocultos || []); el.checked ? oc.delete(d.campover) : oc.add(d.campover); guarda.set('campos', { ...p, ocultos: [...oc] }); await refrescarDetalle(false); const det2 = det.querySelector('.tv-pers'); if (det2) det2.open = true; det.querySelector(`[data-campover="${d.campover}"]`)?.focus(); return; } // plan T6
    if (d.rep) { const t = c.porId.get(S.detalle), cada = d.rep === 'cada' ? el.value : t.repetir?.cada; programar(S.detalle, { repetir: cada ? { cada, modo: d.rep === 'modo' ? el.value : t.repetir?.modo || 'fijo', ...(t.repetir?.hasta ? { hasta: t.repetir.hasta } : {}) } : null }); return guardarYa(); } // plan T5
    if (d.paso) { const id = S.detalle; return hacer(() => datos.paso(id, d.paso, el.checked)); }
    if (d.addbl !== undefined && el.value) { const t = c.porId.get(S.detalle); programar(S.detalle, { bloqueadaPor: [...(t.bloqueadaPor || []), el.value] }); return guardarYa(); }
    if (d.persona !== undefined) { const id = S.detalle; return hacer(() => datos.accion.persona(id, el.value || null), el.value ? `La tiene ${el.value}: los agentes no la tocan.` : 'Vuelve a los agentes.'); }
  });
  ov.addEventListener('input', e => { const d = e.target.dataset; if (S.detalle && (d.c === 'text' || d.c === 'title')) programar(S.detalle, { [d.c]: e.target.value }); });
  ov.addEventListener('focusout', e => { if (pend && det.contains(e.target)) guardarYa(); });
  ov.addEventListener('submit', async e => {
    const f = e.target.closest('[data-formp]'); if (!f) return; e.preventDefault();
    const datosP = Object.fromEntries(new FormData(f)); const id = f.dataset.formp;
    try { const r = id ? await datos.proyecto.cambiar(id, datosP) : await datos.proyecto.crear(datosP); S.formP = null; S.proyecto = r.proyecto.id; aviso(id ? 'Proyecto guardado.' : `Proyecto creado: «${r.proyecto.nombre}». Añádele tareas arriba.`); if (!id) S.preset = { proyecto: r.proyecto.id }; await cargar(); }
    catch (er) { const p = f.querySelector('.tv-err'); p.hidden = false; p.textContent = er.message; }
  });
  ov.addEventListener('keydown', async e => {
    const el = e.target, d = el.dataset;
    if (e.key === 'Enter' && d.addpaso !== undefined) { e.preventDefault(); const txt = el.value.trim(); if (!txt) return; const t = c.porId.get(S.detalle); el.value = ''; programar(S.detalle, { pasos: [...(t.pasos || []), txt] }); await guardarYa(); det.querySelector('[data-addpaso]')?.focus(); return; }
    if (e.key === 'Enter' && d.addet !== undefined) { e.preventDefault(); const n = el.value.trim().replace(/^#/, '').toLowerCase(); if (!n) return; const [id] = await etiquetasDe([n]); if (!id) return; const t = c.porId.get(S.detalle); el.value = ''; programar(S.detalle, { etiquetas: [...new Set([...(t.etiquetas || []), id])] }); await guardarYa(); return; }
    if (e.key === 'Enter' && d.comentar !== undefined) { e.preventDefault(); accion('comentar'); return; }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && el.getAttribute('role') === 'tab' && el.dataset.tab) { e.preventDefault(); const i = TABS.findIndex(([k]) => k === el.dataset.tab), n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0]; S.tab = n; guarda.set('tab', n); pintar(); ov.querySelector(`[data-tab="${n}"]`).focus(); return; }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(el.tagName)) { e.preventDefault(); rin.focus(); }
    if (e.key === 'Escape' && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) { // desde un campo, Esc también cierra el detalle (la oficina no escucha teclas en un campo); sin detalle, suelta el campo
      e.preventDefault(); e.stopPropagation();
      if (el.closest('.tv-devolver')) { det.querySelector('.tv-devolver').hidden = true; det.querySelector('[data-acc="devolver"]')?.focus(); return; }
      if (S.detalle) { if (pend) await guardarYa(); cerrarDetalle(); } else el.blur();
    }
  });

  /* ---------- arrastrar (ratón): tablero y el turno de la lista ---------- */
  let arr = null;
  ov.addEventListener('dragstart', e => { const f = e.target.closest('.tv-fila[draggable="true"]'); if (!f) return; arr = c.porId.get(f.dataset.t); if (!arr) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', arr.id); f.classList.add('arrastrando'); });
  ov.addEventListener('dragend', () => { arr = null; ov.querySelectorAll('.arrastrando, .si, .no').forEach(n => n.classList.remove('arrastrando', 'si', 'no')); });
  const destino = e => e.target.closest('.tv-drop, .tv-lista .tv-filas');
  ov.addEventListener('dragover', e => {
    if (!arr) return; const z = destino(e); if (!z) return;
    const ok = z.classList.contains('tv-drop') ? !!movimiento(arr, columnaDe(arr, c.porId), z.dataset.col, { dept: z.dataset.dept || null }) : arr.state === 'next';
    z.classList.toggle('si', ok); z.classList.toggle('no', !ok); if (ok) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  });
  ov.addEventListener('dragleave', e => { const z = destino(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove('si', 'no'); });
  ov.addEventListener('drop', async e => {
    const z = destino(e), t = arr; if (!z || !t) return; e.preventDefault(); arr = null;
    const despues = [...z.querySelectorAll('.tv-fila')].find(n => { const r = n.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
    const ordenIds = () => { const ids = [...z.querySelectorAll('.tv-fila')].map(n => n.dataset.t).filter(x => x !== t.id); const i = despues ? ids.indexOf(despues.dataset.t) : ids.length; ids.splice(i < 0 ? ids.length : i, 0, t.id); return ids; };
    if (!z.classList.contains('tv-drop')) { if (t.state === 'next') await hacer(() => datos.orden(t.id, ordenIds()), 'Turno cambiado.'); return; }
    const de = columnaDe(t, c.porId), m = movimiento(t, de, z.dataset.col, { dept: z.dataset.dept || null }); if (!m) return;
    const n = `«${t.title.slice(0, 50)}»`;
    if (m.accion === 'orden') return hacer(() => datos.orden(t.id, ordenIds()), 'Turno cambiado.');
    if (m.accion === 'pedir') return hacer(() => datos.estado(t.id, 'next'), `Pedida: ${n}.`, () => datos.estado(t.id, 'idea'));
    if (m.accion === 'aparcar') return hacer(() => datos.estado(t.id, 'idea'), `${n} vuelve a ideas.`, () => datos.estado(t.id, 'next'));
    if (m.accion === 'hecha') return hacer(() => datos.estado(t.id, 'done'), `${n} marcada como hecha, sin ejecutarla.`, () => datos.estado(t.id, 'next'));
    if (m.accion === 'ya') { const prev = t.dueAt; return hacer(() => datos.editar(t.id, { at: null }), `${n} arranca ya.`, prev > Date.now() ? () => datos.editar(t.id, { at: prev }) : null); }
    if (m.accion === 'aprobar') return hacer(() => datos.accion.aprobar(t.id), `Aprobada: ${n}. El agente la envía.`, () => datos.accion.deshacerAprobar(t.id));
    if (m.accion === 'repetir') return hacer(() => datos.accion.repetir(t.id), r => `Otra vez: «${r.title}».`, r => datos.accion.borrar(r.id));
    if (m.accion === 'departamento') { const lead = ctx.AGENTS.find(a => a.dept === z.dataset.dept && a.lead), prev = t.agent; return hacer(() => datos.editar(t.id, { agent: lead.id, reroute: false }), `${n} pasa a ${ctx.DEPTS[z.dataset.dept].name}: la toma ${lead.name}.`, () => datos.editar(t.id, { agent: prev, reroute: false })); }
  });

  /* ---------- abrir y cerrar ---------- */
  return {
    version: VERSION,
    open(o = {}) {
      S.abierta = true; const t = leerHash();
      if (o.tab) S.tab = o.tab; if (o.filtros) S.f = { ...o.filtros };
      vigilar(); pintar(); cargar().then(() => { const id = o.tarea || t; if (id) abrirDetalle(id); });
      setTimeout(() => (o.tarea || t ? null : ov.querySelector(`[data-tab="${S.tab}"]`)?.focus()), 30);
    },
    close() { if (pend) guardarYa(); S.abierta = false; clearInterval(reloj); cerrarDetalle(false); limpiarHash(); },
    back() { if (S.detalle) return cerrarDetalle(); if (S.formP) { S.formP = null; pintar(); return true; } if (S.proyecto) { S.proyecto = null; pintar(); return true; } if (S.kpi) { S.kpi = null; pintar(); return true; } return false; },
    refresh: () => cargar(),
    selection() {
      if (S.detalle) { const t = c.porId.get(S.detalle); return { view: 'tareas', label: `Tarea «${(t?.title || '').slice(0, 50)}»`, kind: 'task', id: S.detalle }; }
      if (S.tab === 'proyectos' && S.proyecto) { const p = c.proyecto(S.proyecto); return { view: 'tareas', label: `Proyecto «${p?.nombre || ''}»`, kind: 'proyecto', id: S.proyecto }; }
      return { view: 'tareas', label: `Tareas · ${TABS.find(([k]) => k === S.tab)?.[1] || ''}`, kind: null };
    },
    abrirTarea: id => { S.abierta = true; abrirDetalle(id); },
  };
}

if (typeof window !== 'undefined') window.AO_TAREAS = { version: VERSION, init };
export { init, ymd };
