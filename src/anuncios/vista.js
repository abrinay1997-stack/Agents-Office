// La VISTA ANUNCIOS (Fase A1, 9 oct 2026; docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §8). Entra en el paquete aparte
// dist/anuncios-vista.js (build-anuncios.mjs) y la página la trae al abrir Anuncios (src/anuncios-carga.js, tecla J). Tres pestañas
// —RESUMEN (lo que pide atención, cuatro cifras, las campañas activas), CAMPAÑAS (la tabla que se despliega, con rango, filtros y orden,
// y el detalle al lado) e HISTORIAL (quién, qué, antes → después, con filtro por quién)—. Sin Meta conectada, cómo conectar y «Ver con
// datos de ejemplo»; en la demo, siempre ejemplo, rotulado en una franja.
// Fase A2 (9 oct 2026): CONTROLAR. El interruptor de cada fila y tarjeta y el menú «⋯» (src/anuncios/acciones.js). LA REGLA DEL DINERO
// (§3): pausar, bajar un presupuesto y archivar son de UN clic (con DESHACER 30 s cuando el servidor lo da); activar, reanudar, subir un
// presupuesto, alargar y relanzar piden DOS: el primero trae del servidor { confirmar } y una ventana (role="dialog", modal.open) dice la
// cifra, las cifras del día, la semana, el mes y la campaña, y el aviso (aprendizaje) ANTES del «Sí, activar — hasta 15,00 US$ al día»;
// la confirmación vence a los 2 min. Un tope que no cabe o un rechazo de Meta se dicen con su cifra, y no hay atajo.
import { crearDatos } from './datos.js';
import { esc, svg, haceCuanto } from './comun.js';
import { resumenHTML } from './resumen.js';
import { campanasHTML, buscar, RANGOS, FILTROS, ORDENES } from './campanas.js';
import { detalleHTML } from './detalle.js';
import { historialHTML, QUIENES } from './historial.js';
import { GASTO, LIBRES, TEXTO, pideDatos, menuHTML, formularioHTML, confirmarHTML, errorHTML, errorImporte, importe, presupuestoDe } from './acciones.js';

/* global __AO_ANUNCIOS_VERSION__ */
const VERSION = typeof __AO_ANUNCIOS_VERSION__ === 'string' ? __AO_ANUNCIOS_VERSION__ : '';
const TABS = [['resumen', 'Resumen'], ['campanas', 'Campañas'], ['historial', 'Historial']];
const NIVEL = { campana: 'Campaña', conjunto: 'Conjunto', anuncio: 'Anuncio' };
const guarda = { get: (k, d) => { try { const v = localStorage.getItem('ao.anu.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('ao.anu.' + k, JSON.stringify(v)); } catch {} } };
const vale = (lista, v, d) => (lista.some(([k]) => k === v) ? v : d);
const sinModal = { open() {}, close() {} };

function init(ov, ctx) {
  const datos = crearDatos({ servida: ctx.servida }), modal = ctx.modal || sinModal;
  const S = { tab: vale(TABS, guarda.get('tab', 'resumen'), 'resumen'), rango: vale(RANGOS, guarda.get('rango', '7d'), '7d'), filtro: vale(FILTROS, guarda.get('filtro', 'todas'), 'todas'), orden: vale(ORDENES, guarda.get('orden', 'gasto'), 'gasto'),
    quien: vale(QUIENES, guarda.get('quien', 'todos'), 'todos'), abiertos: new Set(), sel: null, d: null, hist: null, error: '', ejemplo: false, abierta: false, leyendo: false, dlg: null };
  ov.innerHTML = `<div class="anu">
    <div class="anu-top"><h1 class="anu-h1">Anuncios</h1>
      <div class="anu-tabs" role="tablist" aria-label="Qué ver de los anuncios">${TABS.map(([k, n]) => `<button type="button" role="tab" id="anuTab-${k}" data-tab="${k}" aria-controls="anuMain">${svg(k)}<span>${n}</span></button>`).join('')}</div>
      <button type="button" class="anu-icb anu-x" data-cerrarvista aria-label="Cerrar Anuncios" title="Cerrar (Esc · J)">${svg('x')}</button></div>
    <p class="anu-ejemplo" role="status" hidden></p>
    <div class="anu-linea"><span class="anu-lectura" aria-live="polite"></span><button type="button" class="anu-btn" data-actualizar>${svg('recargar')}Actualizar</button></div>
    <div class="anu-cuerpo"><main class="anu-main" id="anuMain" role="tabpanel" tabindex="-1"></main><aside class="anu-det" aria-labelledby="anuDTit" hidden></aside></div>
    <div class="anu-toast" role="status" aria-live="polite" hidden></div>
    <div class="anu-live anu-sr" role="status" aria-live="polite"></div></div>
    <div class="anu-menu-caja" hidden></div>
    <div class="anu-fondo" hidden><div class="anu-dlg" role="dialog" aria-modal="true" aria-labelledby="anuDlgT" tabindex="-1"><div class="anu-dlg-in"></div></div></div>`;
  const $ = s => ov.querySelector(s);
  const main = $('.anu-main'), det = $('.anu-det'), live = $('.anu-live'), cinta = $('.anu-ejemplo'), lectura = $('.anu-lectura'), bAct = $('[data-actualizar]');
  const caja = $('.anu-menu-caja'), fondo = $('.anu-fondo'), dlg = $('.anu-dlg'), dlgIn = $('.anu-dlg-in'), toast = $('.anu-toast');
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
  const vigilar = () => { clearInterval(reloj); reloj = setInterval(() => { const a = document.activeElement; if (document.hidden || !S.abierta || S.leyendo || S.dlg || !caja.hidden || (a && ov.contains(a) && a.tagName === 'SELECT')) return; cargar(); }, 60000); }; // lo que lee el servidor aparece solo

  /* ---------- pintar ---------- */
  function pintarCabecera() {
    for (const [k] of TABS) { const b = ov.querySelector(`[data-tab="${k}"]`); b.setAttribute('aria-selected', String(k === S.tab)); b.tabIndex = k === S.tab ? 0 : -1; }
    main.setAttribute('aria-labelledby', 'anuTab-' + S.tab);
    const ej = enEjemplo();
    cinta.hidden = !ej;
    if (ej) cinta.innerHTML = !ctx.servida ? '<b>EJEMPLO</b><span>Esta es la demo: las campañas y las cifras son de ejemplo, y lo que pauses o actives aquí solo cambia en esta página. Con la oficina abierta (npm start) y Meta conectada ves las tuyas.</span>'
      : '<b>EJEMPLO</b><span>Datos de ejemplo: no son de ninguna cuenta; lo que cambies aquí no toca Meta.</span>' + (S.ejemplo ? '<button type="button" class="anu-btn" data-a="salir">Salir del ejemplo</button>' : '');
    const h = S.d?.sincronizadaAt ? haceCuanto(S.d.sincronizadaAt) : null;
    lectura.textContent = S.leyendo ? 'Leyendo Meta…' : !S.d ? '' : !S.d.configurado ? 'Meta no está conectada para anuncios.' : h ? `Última lectura de Meta: ${h}.` : 'Todavía no se ha leído Meta.';
    bAct.disabled = S.leyendo || (!!S.d && !S.d.configurado && !enEjemplo());
  }
  function pintar() {
    pintarCabecera();
    const foco = clavFoco(), scroll = main.scrollTop, ahora = Date.now();
    if (!S.d) main.innerHTML = S.error ? `<div class="anu-vacio" role="alert"><b>No se pudieron traer los anuncios</b><span>${esc(S.error)}</span><button type="button" class="anu-btn" data-a="reintentar">Reintentar</button></div>` : '<p class="anu-cargando">Cargando…</p>';
    else if (S.tab === 'resumen') main.innerHTML = resumenHTML(S.d, { rango: S.rango, ahora });
    else if (S.tab === 'campanas') main.innerHTML = S.d.configurado ? campanasHTML(S.d, { rango: S.rango, filtro: S.filtro, orden: S.orden, abiertos: S.abiertos, sel: S.sel, ahora }) : resumenHTML(S.d);
    else main.innerHTML = historialHTML(S.hist, { quien: S.quien });
    if (S.error && S.d) main.insertAdjacentHTML('afterbegin', `<p class="anu-aviso-error" role="alert">No se pudo actualizar: ${esc(S.error)}. Lo que ves es la lectura anterior.</p>`);
    main.scrollTop = scroll; volverFoco(foco);
    if (S.sel) pintarDetalle(false);
  }
  function clavFoco() {
    const a = document.activeElement; if (!a || (!main.contains(a) && !det.contains(a)) || a === main) return null;
    const d = [...a.attributes].filter(x => x.name.startsWith('data-')).map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('');
    return d ? { sel: a.tagName.toLowerCase() + d, en: det.contains(a) ? 'det' : 'main' } : null;
  }
  function volverFoco(f) { if (!f) return; try { (f.en === 'det' ? det : main).querySelector(f.sel)?.focus({ preventScroll: true }); } catch {} }

  /* ---------- el detalle, al lado ---------- */
  let origenDet = null;
  function pintarDetalle(enfocar) {
    const f = S.d && buscar(S.d.campanas || [], S.sel);
    if (!f) { cerrarDetalle(false); return; }
    const foco = det.contains(document.activeElement) ? clavFoco() : null;
    det.innerHTML = detalleHTML(f, { moneda: moneda(), rango: S.rango }); det.hidden = false; ov.classList.add('conDet');
    if (foco) volverFoco(foco);
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

  /* ---------- el menú «⋯» de una fila (teclado completo, como el «⋯» del dock) ---------- */
  let menuDe = null, abiertoAt = 0;
  const items = () => [...caja.querySelectorAll('[role="menuitem"]')];
  function abrirMenu(btn) {
    const f = S.d && buscar(S.d.campanas || [], btn.dataset.menu); if (!f) return;
    cerrarMenu(false);
    caja.innerHTML = menuHTML(f); caja.hidden = false; menuDe = btn; abiertoAt = Date.now(); btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect(), o = ov.getBoundingClientRect(), w = caja.offsetWidth, h = caja.offsetHeight;
    const left = Math.max(8, Math.min(r.right - o.left - w, o.width - w - 8)), arriba = r.bottom + h + 8 > o.bottom && r.top - h - 6 > o.top;
    caja.style.left = left + 'px'; caja.style.top = (arriba ? r.top - o.top - h - 6 : r.bottom - o.top + 6) + 'px';
    items()[0]?.focus();
  }
  function cerrarMenu(devolver = true) {
    if (caja.hidden) return false;
    caja.hidden = true; caja.innerHTML = '';
    const b = menuDe; menuDe = null;
    if (b && b.isConnected) { b.setAttribute('aria-expanded', 'false'); if (devolver) b.focus({ preventScroll: true }); }
    else if (devolver && b) volverAFila(b.dataset.menu);
    return true;
  }
  caja.addEventListener('keydown', e => {
    const l = items(), i = l.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarMenu(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); l[(i + 1) % l.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); l[(i - 1 + l.length) % l.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); l[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); l.at(-1)?.focus(); }
    else if (e.key === 'Tab') cerrarMenu(false);
  });
  document.addEventListener('pointerdown', e => { if (!caja.hidden && !caja.contains(e.target) && !(menuDe && menuDe.contains(e.target))) cerrarMenu(false); });
  main.addEventListener('scroll', () => { if (Date.now() - abiertoAt > 400) cerrarMenu(false); }, { passive: true }); // el desplazamiento que trae el foco al botón no lo cierra
  addEventListener('resize', () => cerrarMenu(false));

  /** Tras un cambio, el foco vuelve a la misma fila: su interruptor (que ahora dice otra cosa), su «⋯» o su nombre. */
  function volverAFila(id, enDet = false) {
    const q = CSS.escape(id || '');
    const n = (enDet && det.querySelector(`[data-id="${q}"]`)) || main.querySelector(`.anu-int[data-id="${q}"]`) || main.querySelector(`[data-menu="${q}"]`) || main.querySelector(`[data-abrir="${q}"], [data-abrircamp="${q}"]`) || det.querySelector(`[data-id="${q}"]`);
    (n || main).focus({ preventScroll: true });
  }

  /* ---------- la ventana: el formulario, la confirmación con la cifra, los errores ---------- */
  let relojDlg = 0;
  function abrirDlg(g) {
    S.dlg = { ...S.dlg, ...g };
    if (fondo.hidden) { fondo.hidden = false; modal.open(fondo); }
    pintarDlg(true);
  }
  function cerrarDlg(devolver = true) {
    if (!S.dlg) return false;
    const g = S.dlg; S.dlg = null; clearInterval(relojDlg);
    modal.close(fondo); fondo.hidden = true; dlgIn.innerHTML = '';
    if (devolver) setTimeout(() => volverAFila(g.id, g.desdeDet), 0);
    return true;
  }
  function filaDe(g) { return (S.d && buscar(S.d.campanas || [], g.id)) || g.f; }
  function pintarDlg(enfocar) {
    const g = S.dlg; if (!g) return; const f = filaDe(g), m = moneda();
    clearInterval(relojDlg);
    if (g.fase === 'form') dlgIn.innerHTML = formularioHTML(f, g.tipo, { moneda: m, valor: g.valor ?? '', fin: g.fin ?? '', inicio: g.inicio ?? '', error: g.err || '' });
    else if (g.fase === 'pidiendo') dlgIn.innerHTML = `<h2 id="anuDlgT">${esc(TEXTO[g.tipo])}</h2><p class="anu-dtexto" role="status">${GASTO.has(g.tipo) ? 'Calculando lo que gasta y mirando tus topes…' : 'Haciéndolo…'}</p>`;
    else if (g.fase === 'confirm') {
      dlgIn.innerHTML = confirmarHTML(f, g.tipo, g.confirmar, { moneda: m, aviso: g.aviso || '' });
      const v = Date.parse(g.confirmar?.vence);
      if (!Number.isNaN(v)) relojDlg = setInterval(() => {
        if (!S.dlg || S.dlg.fase !== 'confirm') return clearInterval(relojDlg);
        if (Date.now() >= v) { clearInterval(relojDlg); pintarDlg(false); dlgIn.querySelector('[data-dlg="otra"]')?.focus(); decir('Venció: vuelve a pedirlo.'); return; }
        const t = dlgIn.querySelector('.anu-vence'), q = Math.round((v - Date.now()) / 1000);
        if (t) t.textContent = `Esta confirmación vale ${q >= 60 ? `${Math.floor(q / 60)} min ${String(q % 60).padStart(2, '0')} s` : `${q} s`}; luego hay que volver a pedirla.`;
      }, 1000);
    } else dlgIn.innerHTML = errorHTML(f, g.tipo, g.r || {}, { moneda: m });
    if (!enfocar) return;
    setTimeout(() => {
      const n = g.fase === 'form' ? dlgIn.querySelector('input') || dlgIn.querySelector('[type="submit"]') : g.fase === 'confirm' ? dlg : dlgIn.querySelector('[data-dlg="minimo"], [data-dlg="otra"], [data-dlg="cancelar"]') || dlg;
      n?.focus({ preventScroll: true });
    }, 20);
  }
  const ocupado = on => dlgIn.querySelectorAll('button, input').forEach(b => { b.disabled = on; });
  fondo.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarDlg(); } });
  fondo.addEventListener('pointerdown', e => { if (e.target === fondo) cerrarDlg(); });

  /* ---------- hacer: un clic (lo que baja el gasto) o dos (lo que gasta) ---------- */
  const cuerpoDe = g => ({ tipo: g.tipo, id: g.id, valor: g.valor === '' || g.valor == null ? undefined : importe(g.valor), fin: g.fin || undefined, inicio: g.inicio || undefined });
  async function pedir(tipo, id, desde) {
    const f = S.d && buscar(S.d.campanas || [], id); if (!f) return;
    cerrarMenu(false);
    const desdeDet = !!desde && det.contains(desde), p = presupuestoDe(f);
    const g = { tipo, id, f, desdeDet, fase: 'form', valor: '', fin: '', inicio: '', err: '' };
    if (tipo === 'subir_presupuesto' && p) g.valor = String(Math.round(p.usd * 1.2 * 100) / 100);
    if (tipo === 'bajar_presupuesto' && p) g.valor = String(Math.max(1, Math.round(p.usd * 0.8 * 100) / 100));
    if (pideDatos(tipo)) return abrirDlg(g);
    if (GASTO.has(tipo)) return primerClic(g);
    return hacer(g, false);
  }
  async function primerClic(g) {
    abrirDlg({ ...g, fase: 'pidiendo' });
    const r = await datos.accion(cuerpoDe(g), { ejemplo: S.ejemplo });
    if (!S.dlg) return;
    if (r.confirmar) { abrirDlg({ fase: 'confirm', confirmar: r.confirmar, aviso: r.aviso || '' }); decir(`${r.aviso ? 'Ojo: ' + r.aviso + ' ' : ''}${r.confirmar.texto}. ¿Sí?`); return; }
    if (r.ok) return listo(S.dlg, r); // el servidor lo hizo sin pedir el segundo clic (no debería: lo que gasta siempre lo pide)
    abrirDlg({ fase: 'error', r }); decir(r.motivo || 'No se pudo.');
  }
  async function hacer(g, enDlg) {
    if (enDlg) ocupado(true);
    const r = await datos.accion(cuerpoDe(g), { ejemplo: S.ejemplo });
    if (r.ok) return listo(enDlg ? S.dlg : g, r);
    if (enDlg && S.dlg) { abrirDlg({ fase: 'error', r }); }
    else { S.dlg = null; abrirDlg({ ...g, fase: 'error', r }); }
    decir(r.motivo || 'No se pudo.');
  }
  async function confirmar() {
    const g = S.dlg; if (!g || g.fase !== 'confirm') return;
    ocupado(true);
    const r = await datos.accion({ ...cuerpoDe(g), confirmacion: g.confirmar.token }, { ejemplo: S.ejemplo });
    if (!S.dlg) return;
    if (r.ok) return listo(g, r);
    abrirDlg({ fase: 'error', r }); decir(r.motivo || 'No se pudo.');
  }
  async function listo(g, r) {
    if (S.dlg) cerrarDlg(false);
    mostrarAviso(r.hecho?.texto || 'Hecho.', r.deshacer, r.aviso);
    await refrescar();
    volverAFila(g?.id, g?.desdeDet);
  }
  async function refrescar() { await cargar(); await cargarHistorial(); }

  /* ---------- el aviso de lo hecho, con DESHACER y su cuenta atrás ---------- */
  let relojToast = 0, quitaToast = 0;
  function mostrarAviso(texto, deshacer, aviso) {
    clearInterval(relojToast); clearTimeout(quitaToast);
    const hasta = deshacer?.hasta ? Date.parse(deshacer.hasta) : NaN, puede = deshacer?.token && !Number.isNaN(hasta) && hasta > Date.now();
    toast.innerHTML = `<span class="anu-tt">${esc(texto)}${aviso ? ` <em>${esc(aviso)}</em>` : ''}</span>${puede ? `<button type="button" class="anu-btn pri" data-deshacer="${esc(deshacer.token)}">DESHACER <span class="anu-cta-t">${Math.round((hasta - Date.now()) / 1000)} s</span></button>` : ''}<button type="button" class="anu-icb" data-cerrartoast aria-label="Cerrar el aviso">${svg('x')}</button>`;
    toast.hidden = false; decir(texto + (puede ? ' Puedes deshacerlo durante 30 segundos.' : ''));
    const fuera = () => { if (toast.contains(document.activeElement)) { quitaToast = setTimeout(fuera, 3000); return; } toast.hidden = true; toast.innerHTML = ''; };
    if (puede) relojToast = setInterval(() => {
      const q = Math.round((hasta - Date.now()) / 1000), b = toast.querySelector('[data-deshacer]');
      if (!b) return clearInterval(relojToast);
      if (q <= 0) { clearInterval(relojToast); b.remove(); quitaToast = setTimeout(fuera, 4000); return; }
      b.querySelector('.anu-cta-t').textContent = q + ' s';
    }, 1000);
    else quitaToast = setTimeout(fuera, 9000);
  }
  async function deshacer(btn) {
    btn.disabled = true;
    const r = await datos.deshacer(btn.dataset.deshacer, { ejemplo: S.ejemplo });
    clearInterval(relojToast);
    if (r.ok) { mostrarAviso(r.hecho?.texto || 'Deshecho.', null); await refrescar(); toast.querySelector('[data-cerrartoast]')?.focus({ preventScroll: true }); }
    else { mostrarAviso(`No se pudo deshacer: ${r.motivo || 'la oficina no contestó'}`, null); }
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
    if (dlg.contains(b)) {
      const a = b.dataset.dlg, g = S.dlg; if (!g) return;
      if (a === 'cancelar') { cerrarDlg(); decir('Cancelado: no cambió nada.'); return; }
      if (a === 'si') return confirmar();
      if (a === 'otra') { const { tipo, id, f, desdeDet, valor, fin, inicio } = g; S.dlg = { tipo, id, f, desdeDet, valor, fin, inicio }; return primerClic(S.dlg); }
      if (a === 'minimo') { abrirDlg({ fase: 'form', valor: b.dataset.minimo, err: '' }); return; }
      return;
    }
    if (caja.contains(b) && b.dataset.acc) return pedir(b.dataset.acc, b.dataset.id, menuDe);
    if (b.dataset.menu) return caja.hidden || menuDe !== b ? abrirMenu(b) : cerrarMenu();
    if (b.dataset.acc) return pedir(b.dataset.acc, b.dataset.id, b);
    if (b.dataset.deshacer) return deshacer(b);
    if (b.hasAttribute('data-cerrartoast')) { clearInterval(relojToast); toast.hidden = true; toast.innerHTML = ''; main.focus({ preventScroll: true }); return; }
    if (b.dataset.tab) { S.tab = b.dataset.tab; guarda.set('tab', S.tab); if (S.tab === 'historial' && S.hist == null) cargarHistorial(); pintar(); return; }
    if (b.hasAttribute('data-cerrarvista')) return ctx.cerrar?.();
    if (b.hasAttribute('data-actualizar')) return actualizar();
    if (b.hasAttribute('data-cerrardet')) return cerrarDetalle();
    if (b.dataset.rango) { S.rango = b.dataset.rango; guarda.set('rango', S.rango); decir('Cifras de ' + b.textContent.trim().toLowerCase()); return cargar(); }
    if (b.dataset.filtro) { S.filtro = b.dataset.filtro; guarda.set('filtro', S.filtro); return pintar(); }
    if (b.dataset.quien) { S.quien = b.dataset.quien; guarda.set('quien', S.quien); return pintar(); }
    if (b.dataset.tog) { const id = b.dataset.tog; if (S.abiertos.has(id)) S.abiertos.delete(id); else S.abiertos.add(id); return pintar(); }
    if (b.dataset.abrir) return abrirDetalle(b.dataset.abrir, b);
    if (b.dataset.abrircamp) return abrirDetalle(b.dataset.abrircamp, b);
    const a = b.dataset.a;
    if (a === 'ejemplo') { S.ejemplo = true; S.hist = null; cargar().then(() => decir('Viendo datos de ejemplo.')); return; }
    if (a === 'salir') { S.ejemplo = false; S.hist = null; cerrarDetalle(false); cargar().then(() => decir('De vuelta a tu cuenta.')); return; }
    if (a === 'ajustes') return ctx.abrirAjustes?.('anuncios');
    if (a === 'reintentar') return cargar();
  });
  ov.addEventListener('submit', e => {
    const form = e.target.closest('[data-form]'); if (!form || !S.dlg) return;
    e.preventDefault();
    const g = S.dlg, val = n => form.querySelector(`[data-campo="${n}"]`)?.value ?? '';
    const v = { valor: val('valor'), fin: val('fin'), inicio: val('inicio') };
    let err = '';
    if (g.tipo === 'subir_presupuesto' || g.tipo === 'bajar_presupuesto') err = errorImporte(g.tipo, v.valor, presupuestoDe(filaDe(g))?.usd);
    if (g.tipo === 'alargar' && !v.fin) err = 'Elige la fecha nueva.';
    if (err) { abrirDlg({ ...v, err }); form.querySelector('input')?.focus(); decir(err); return; }
    Object.assign(S.dlg, v, { err: '' });
    if (LIBRES.has(g.tipo)) return hacer(S.dlg, true);
    return primerClic(S.dlg);
  });
  ov.addEventListener('change', e => { if (e.target.matches('[data-orden]')) { S.orden = e.target.value; guarda.set('orden', S.orden); pintar(); } });
  ov.addEventListener('keydown', e => {
    const el = e.target;
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') && el.getAttribute?.('role') === 'tab') {
      e.preventDefault(); const i = TABS.findIndex(([k]) => k === el.dataset.tab);
      const n = TABS[e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      S.tab = n; guarda.set('tab', n); if (n === 'historial' && S.hist == null) cargarHistorial(); pintar(); ov.querySelector(`[data-tab="${n}"]`).focus();
    }
    if (e.key === 'ArrowDown' && el.dataset?.menu) { e.preventDefault(); abrirMenu(el); }
  });

  /* ---------- abrir y cerrar ---------- */
  return {
    version: VERSION,
    open(o = {}) {
      S.abierta = true; if (o.tab && TABS.some(([k]) => k === o.tab)) S.tab = o.tab;
      vigilar(); pintar(); cargar().then(() => { if (S.tab === 'historial' && S.hist == null) cargarHistorial(); });
      setTimeout(() => ov.querySelector(`[data-tab="${S.tab}"]`)?.focus(), 30);
    },
    close() { S.abierta = false; clearInterval(reloj); cerrarMenu(false); cerrarDlg(false); cerrarDetalle(false); },
    back() { return cerrarMenu() || cerrarDlg() || cerrarDetalle(); },
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
