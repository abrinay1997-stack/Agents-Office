// La VISTA ANUNCIOS (Fase A1, 9 oct 2026; docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §8). Entra en el paquete aparte
// dist/anuncios-vista.js (build-anuncios.mjs) y la página la trae al abrir Anuncios (src/anuncios-carga.js, tecla J). SOLO LECTURA:
// tres pestañas —RESUMEN (lo que pide atención, cuatro cifras, las campañas activas), CAMPAÑAS (la tabla que se despliega, con rango,
// filtros y orden, y el detalle al lado) e HISTORIAL— y ningún botón que cambie nada en Meta (pausar y presupuestos llegan en A2).
// Sin Meta conectada, cómo conectar y «Ver con datos de ejemplo»; en la demo, siempre ejemplo, rotulado en una franja.
import { crearDatos } from './datos.js';
import { esc, svg, haceCuanto } from './comun.js';
import { resumenHTML } from './resumen.js';
import { campanasHTML, buscar, RANGOS, FILTROS, ORDENES } from './campanas.js';
import { detalleHTML } from './detalle.js';
import { historialHTML } from './historial.js';

/* global __AO_ANUNCIOS_VERSION__ */
const VERSION = typeof __AO_ANUNCIOS_VERSION__ === 'string' ? __AO_ANUNCIOS_VERSION__ : '';
const TABS = [['resumen', 'Resumen'], ['campanas', 'Campañas'], ['historial', 'Historial']];
const NIVEL = { campana: 'Campaña', conjunto: 'Conjunto', anuncio: 'Anuncio' };
const guarda = { get: (k, d) => { try { const v = localStorage.getItem('ao.anu.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('ao.anu.' + k, JSON.stringify(v)); } catch {} } };
const vale = (lista, v, d) => (lista.some(([k]) => k === v) ? v : d);

function init(ov, ctx) {
  const datos = crearDatos({ servida: ctx.servida });
  const S = { tab: vale(TABS, guarda.get('tab', 'resumen'), 'resumen'), rango: vale(RANGOS, guarda.get('rango', '7d'), '7d'), filtro: vale(FILTROS, guarda.get('filtro', 'todas'), 'todas'), orden: vale(ORDENES, guarda.get('orden', 'gasto'), 'gasto'),
    abiertos: new Set(), sel: null, d: null, hist: null, error: '', ejemplo: false, abierta: false, leyendo: false };
  ov.innerHTML = `<div class="anu">
    <div class="anu-top"><h1 class="anu-h1">Anuncios</h1>
      <div class="anu-tabs" role="tablist" aria-label="Qué ver de los anuncios">${TABS.map(([k, n]) => `<button type="button" role="tab" id="anuTab-${k}" data-tab="${k}" aria-controls="anuMain">${svg(k)}<span>${n}</span></button>`).join('')}</div>
      <button type="button" class="anu-icb anu-x" data-cerrarvista aria-label="Cerrar Anuncios" title="Cerrar (Esc · J)">${svg('x')}</button></div>
    <p class="anu-ejemplo" role="status" hidden></p>
    <div class="anu-linea"><span class="anu-lectura" aria-live="polite"></span><button type="button" class="anu-btn" data-actualizar>${svg('recargar')}Actualizar</button></div>
    <div class="anu-cuerpo"><main class="anu-main" id="anuMain" role="tabpanel" tabindex="-1"></main><aside class="anu-det" aria-labelledby="anuDTit" hidden></aside></div>
    <div class="anu-live anu-sr" role="status" aria-live="polite"></div></div>`;
  const $ = s => ov.querySelector(s);
  const main = $('.anu-main'), det = $('.anu-det'), live = $('.anu-live'), cinta = $('.anu-ejemplo'), lectura = $('.anu-lectura'), bAct = $('[data-actualizar]');
  const decir = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  const enEjemplo = () => !ctx.servida || S.ejemplo || !!S.d?.ejemplo;
  const moneda = () => S.d?.cuenta?.moneda || 'USD';

  /* ---------- cargar ---------- */
  async function cargar() {
    try { S.d = await datos.leer(S.rango, { ejemplo: S.ejemplo }); S.error = ''; }
    catch (e) { S.error = e.message; }
    pintar();
  }
  async function cargarHistorial() { try { S.hist = await datos.historial({ ejemplo: S.ejemplo }); } catch (e) { S.hist = []; decir('No se pudo traer el historial: ' + e.message); } if (S.tab === 'historial') pintar(); }
  let reloj = 0;
  const vigilar = () => { clearInterval(reloj); reloj = setInterval(() => { const a = document.activeElement; if (document.hidden || !S.abierta || S.leyendo || (a && ov.contains(a) && a.tagName === 'SELECT')) return; cargar(); }, 60000); }; // lo que lee el servidor aparece solo

  /* ---------- pintar ---------- */
  function pintarCabecera() {
    for (const [k] of TABS) { const b = ov.querySelector(`[data-tab="${k}"]`); b.setAttribute('aria-selected', String(k === S.tab)); b.tabIndex = k === S.tab ? 0 : -1; }
    main.setAttribute('aria-labelledby', 'anuTab-' + S.tab);
    const ej = enEjemplo();
    cinta.hidden = !ej;
    if (ej) cinta.innerHTML = !ctx.servida ? '<b>EJEMPLO</b><span>Esta es la demo: las campañas y las cifras son de ejemplo. Con la oficina abierta (npm start) y Meta conectada ves las tuyas.</span>'
      : '<b>EJEMPLO</b><span>Datos de ejemplo: no son de ninguna cuenta; sirven para ver cómo queda esta pantalla.</span>' + (S.ejemplo ? '<button type="button" class="anu-btn" data-a="salir">Salir del ejemplo</button>' : '');
    const h = S.d?.sincronizadaAt ? haceCuanto(S.d.sincronizadaAt) : null;
    lectura.textContent = S.leyendo ? 'Leyendo Meta…' : !S.d ? '' : !S.d.configurado ? 'Meta no está conectada para anuncios.' : h ? `Última lectura de Meta: ${h}.` : 'Todavía no se ha leído Meta.';
    bAct.disabled = S.leyendo || (!!S.d && !S.d.configurado && !enEjemplo());
  }
  function pintar() {
    pintarCabecera();
    const foco = clavFoco(), scroll = main.scrollTop;
    if (!S.d) main.innerHTML = S.error ? `<div class="anu-vacio" role="alert"><b>No se pudieron traer los anuncios</b><span>${esc(S.error)}</span><button type="button" class="anu-btn" data-a="reintentar">Reintentar</button></div>` : '<p class="anu-cargando">Cargando…</p>';
    else if (S.tab === 'resumen') main.innerHTML = resumenHTML(S.d, { rango: S.rango });
    else if (S.tab === 'campanas') main.innerHTML = S.d.configurado ? campanasHTML(S.d, { rango: S.rango, filtro: S.filtro, orden: S.orden, abiertos: S.abiertos, sel: S.sel }) : resumenHTML(S.d);
    else main.innerHTML = historialHTML(S.hist);
    if (S.error && S.d) main.insertAdjacentHTML('afterbegin', `<p class="anu-aviso-error" role="alert">No se pudo actualizar: ${esc(S.error)}. Lo que ves es la lectura anterior.</p>`);
    main.scrollTop = scroll; volverFoco(foco);
    if (S.sel) pintarDetalle(false);
  }
  function clavFoco() {
    const a = document.activeElement; if (!a || !main.contains(a) || a === main) return null;
    const d = [...a.attributes].filter(x => x.name.startsWith('data-')).map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('');
    return d ? a.tagName.toLowerCase() + d : null;
  }
  function volverFoco(sel) { if (!sel) return; try { main.querySelector(sel)?.focus({ preventScroll: true }); } catch {} }

  /* ---------- el detalle, al lado ---------- */
  let origenDet = null;
  function pintarDetalle(enfocar) {
    const f = S.d && buscar(S.d.campanas || [], S.sel);
    if (!f) { cerrarDetalle(false); return; }
    det.innerHTML = detalleHTML(f, { moneda: moneda(), rango: S.rango }); det.hidden = false; ov.classList.add('conDet');
    if (enfocar) setTimeout(() => det.querySelector('[data-cerrardet]')?.focus({ preventScroll: true }), 20);
  }
  function abrirDetalle(id, desde) {
    S.sel = id; origenDet = desde ? `[${desde.dataset.abrir ? 'data-abrir' : 'data-abrircamp'}="${CSS.escape(desde.dataset.abrir || desde.dataset.abrircamp)}"]` : null;
    if (S.tab !== 'campanas') { S.tab = 'campanas'; guarda.set('tab', S.tab); const f = buscar(S.d?.campanas || [], id); if (f) S.abiertos.add(f.campana.id); }
    pintar(); pintarDetalle(true);
  }
  function cerrarDetalle(devolver = true) {
    if (!S.sel && det.hidden) return false;
    S.sel = null; det.hidden = true; det.innerHTML = ''; ov.classList.remove('conDet');
    main.querySelectorAll('.anu-fila.sel').forEach(n => n.classList.remove('sel')); main.querySelectorAll('[aria-current]').forEach(n => n.removeAttribute('aria-current'));
    if (devolver) { const o = origenDet && (main.querySelector(origenDet) || main.querySelector(origenDet.replace('data-abrircamp', 'data-abrir'))); (o || main).focus({ preventScroll: true }); }
    return true;
  }

  /* ---------- actualizar ---------- */
  async function actualizar() {
    if (S.leyendo) return;
    try {
      const r = await datos.sincronizar({ ejemplo: enEjemplo() });
      if (r === 'ejemplo') { await cargar(); decir('Datos de ejemplo: no hay nada que leer de Meta.'); return; }
      S.leyendo = true; pintarCabecera(); decir(r === 'ya' ? 'Ya estaba leyendo Meta: en cuanto termine, se ve aquí.' : 'Leyendo Meta…');
      const antes = S.d?.sincronizadaAt || '';
      for (let i = 0; i < 24 && S.abierta; i++) { await new Promise(res => setTimeout(res, 2500)); await cargar(); if ((S.d?.sincronizadaAt || '') !== antes) break; }
      S.leyendo = false; pintarCabecera(); decir((S.d?.sincronizadaAt || '') !== antes ? 'Listo: cifras al día.' : 'Meta tarda en contestar: las cifras se ponen solas cuando lleguen.');
    } catch (e) { S.leyendo = false; pintarCabecera(); decir('No se pudo actualizar: ' + e.message); }
  }

  /* ---------- eventos ---------- */
  ov.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !ov.contains(b)) return;
    if (b.dataset.tab) { S.tab = b.dataset.tab; guarda.set('tab', S.tab); if (S.tab === 'historial' && S.hist == null) cargarHistorial(); pintar(); return; }
    if (b.hasAttribute('data-cerrarvista')) return ctx.cerrar?.();
    if (b.hasAttribute('data-actualizar')) return actualizar();
    if (b.hasAttribute('data-cerrardet')) return cerrarDetalle();
    if (b.dataset.rango) { S.rango = b.dataset.rango; guarda.set('rango', S.rango); decir('Cifras de ' + b.textContent.trim().toLowerCase()); return cargar(); }
    if (b.dataset.filtro) { S.filtro = b.dataset.filtro; guarda.set('filtro', S.filtro); return pintar(); }
    if (b.dataset.tog) { const id = b.dataset.tog; if (S.abiertos.has(id)) S.abiertos.delete(id); else S.abiertos.add(id); return pintar(); }
    if (b.dataset.abrir) return abrirDetalle(b.dataset.abrir, b);
    if (b.dataset.abrircamp) return abrirDetalle(b.dataset.abrircamp, b);
    const a = b.dataset.a;
    if (a === 'ejemplo') { S.ejemplo = true; S.hist = null; cargar().then(() => decir('Viendo datos de ejemplo.')); return; }
    if (a === 'salir') { S.ejemplo = false; S.hist = null; cerrarDetalle(false); cargar().then(() => decir('De vuelta a tu cuenta.')); return; }
    if (a === 'ajustes') return ctx.abrirAjustes?.('anuncios');
    if (a === 'reintentar') return cargar();
  });
  ov.addEventListener('change', e => { if (e.target.matches('[data-orden]')) { S.orden = e.target.value; guarda.set('orden', S.orden); pintar(); } });
  ov.addEventListener('keydown', e => {
    const el = e.target;
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') && el.getAttribute?.('role') === 'tab') {
      e.preventDefault(); const i = TABS.findIndex(([k]) => k === el.dataset.tab);
      const n = TABS[e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      S.tab = n; guarda.set('tab', n); if (n === 'historial' && S.hist == null) cargarHistorial(); pintar(); ov.querySelector(`[data-tab="${n}"]`).focus();
    }
  });

  /* ---------- abrir y cerrar ---------- */
  return {
    version: VERSION,
    open(o = {}) {
      S.abierta = true; if (o.tab && TABS.some(([k]) => k === o.tab)) S.tab = o.tab;
      vigilar(); pintar(); cargar().then(() => { if (S.tab === 'historial' && S.hist == null) cargarHistorial(); });
      setTimeout(() => ov.querySelector(`[data-tab="${S.tab}"]`)?.focus(), 30);
    },
    close() { S.abierta = false; clearInterval(reloj); cerrarDetalle(false); },
    back() { return cerrarDetalle(); },
    refresh: () => cargar(),
    selection() {
      const f = S.sel && S.d && buscar(S.d.campanas || [], S.sel);
      if (f) return { view: 'anuncios', label: `${NIVEL[f.nivel]} «${String(f.nodo.nombre || '').slice(0, 60)}»${enEjemplo() ? ' (ejemplo)' : ''}`, kind: f.nivel, id: f.id };
      return { view: 'anuncios', label: `Anuncios · ${TABS.find(([k]) => k === S.tab)?.[1] || ''}${enEjemplo() ? ' (ejemplo)' : ''}`, kind: 'resumen' };
    },
  };
}

if (typeof window !== 'undefined') window.AO_ANUNCIOS = { version: VERSION, init };
export { init };
