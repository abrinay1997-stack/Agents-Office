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
import { esc, svg, haceCuanto, opcionesCuenta } from './comun.js';
import { filtrarVista } from '../../anuncios/cuentas.mjs';
import { resumenHTML } from './resumen.js';
import { campanasHTML, buscar, RANGOS, FILTROS, ORDENES } from './campanas.js';
import { detalleHTML } from './detalle.js';
import { historialHTML, QUIENES } from './historial.js';
import { GASTO, LIBRES, TEXTO, pideDatos, menuHTML, formularioHTML, confirmarHTML, errorHTML, errorImporte, importe, presupuestoDe } from './acciones.js';
import { crearAsistente } from './asistente.js';
import { sugerenciasHTML, FILTROS_SUG, reglaTexto } from './sugerencias.js';
import { creativosHTML, grupoDeAnuncio, borradorDeCreativo } from './creativos.js';
import { crearVentanaInforme } from './informe.js';
import { crearMetodoVista } from './metodo.js'; // 11 nov 2026: las pestañas Método (revisión 3Q, números, ciclo) y Competencia
// Fase A3 (9 oct 2026): CREAR. La pestaña BORRADORES (antes de Historial) con la lista y el asistente de 5 pasos (src/anuncios/asistente.js);
// «+ Nueva campaña» también en el Resumen. Lo creado nace EN PAUSA en Meta y se enlaza a su campaña; activarlo es la A2 (dos clics).
// Fase A5 (9 oct 2026): SUGERENCIAS (tras Campañas: src/anuncios/sugerencias.js) y CREATIVOS (tras Borradores: src/anuncios/creativos.js),
// y las 3 sugerencias más importantes en el Resumen. «Aplicar» de lo que baja el gasto es un clic con DESHACER; de lo que gasta, la MISMA
// ventana del segundo clic de la A2 (con `sugerencia` en el «Sí»); «borrador» abre el borrador en Borradores; «creativos» se lo pide a tu
// agente de anuncios. «Descartar» y «Recordármelo en 3 días» son de un clic. El foco, tras cada una, va a la siguiente tarjeta.
// Fases A6 y A7 (9 oct 2026): MEDIR, al final del Resumen. «Informe del mes» abre su ventana (src/anuncios/informe.js) y «Crear
// indicadores» los lleva a «Cómo va el negocio» (el servidor dice si el ROAS se puede, y si no, por qué).

/* global __AO_ANUNCIOS_VERSION__ */
const VERSION = typeof __AO_ANUNCIOS_VERSION__ === 'string' ? __AO_ANUNCIOS_VERSION__ : '';
const TABS = [['resumen', 'Resumen'], ['campanas', 'Campañas'], ['sugerencias', 'Sugerencias'], ['metodo', 'Método'], ['competencia', 'Competencia'], ['borradores', 'Borradores'], ['creativos', 'Creativos'], ['historial', 'Historial']];
const NIVEL = { campana: 'Campaña', conjunto: 'Conjunto', anuncio: 'Anuncio' };
const guarda = { get: (k, d) => { try { const v = localStorage.getItem('ao.anu.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('ao.anu.' + k, JSON.stringify(v)); } catch {} } };
const vale = (lista, v, d) => (lista.some(([k]) => k === v) ? v : d);
const sinModal = { open() {}, close() {} };

function init(ov, ctx) {
  const datos = crearDatos({ servida: ctx.servida }), modal = ctx.modal || sinModal;
  const S = { cuenta: String(guarda.get('cuenta', 'todas') || 'todas'), tab: vale(TABS, guarda.get('tab', 'resumen'), 'resumen'), rango: vale(RANGOS, guarda.get('rango', '7d'), '7d'), filtro: vale(FILTROS, guarda.get('filtro', 'todas'), 'todas'), orden: vale(ORDENES, guarda.get('orden', 'gasto'), 'gasto'),
    quien: vale(QUIENES, guarda.get('quien', 'todos'), 'todos'), sfiltro: vale(FILTROS_SUG, guarda.get('sfiltro', 'viva'), 'viva'), sug: null, sugErr: '', ordenSug: [], abiertos: new Set(), sel: null, d: null, hist: null, error: '', ejemplo: false, abierta: false, leyendo: false, dlg: null };
  ov.innerHTML = `<div class="anu">
    <div class="anu-top"><h1 class="anu-h1">Anuncios</h1>
      <div class="anu-tabs" role="tablist" aria-label="Qué ver de los anuncios">${TABS.map(([k, n]) => `<button type="button" role="tab" id="anuTab-${k}" data-tab="${k}" aria-controls="anuMain">${svg(k)}<span>${n}</span>${k === 'sugerencias' ? '<b class="anu-tcuenta" data-tcuenta hidden></b>' : ''}</button>`).join('')}</div>
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
  const ctl = crearAsistente({ ov, datos, ctx, modal, decir, enEjemplo, moneda, aviso: t => mostrarAviso(t, null),
    repintar: () => { if (S.tab === 'borradores' && S.abierta) pintar(); },
    irACampana: async id => { await cargar(); if (S.d && buscar(S.d.campanas || [], id)) abrirDetalle(id, null); else { S.tab = 'campanas'; guarda.set('tab', S.tab); pintar(); decir('La campaña aparecerá en Campañas en la próxima lectura de Meta.'); } },
    alCrear: () => { cargar(); cargarHistorial(); } });
  const esMet = t => t === 'metodo' || t === 'competencia'; // solo lectura y cálculo: ningún botón de estas dos pestañas gasta
  const met = crearMetodoVista({ servida: ctx.servida, decir, repintar: () => { if (esMet(S.tab) && S.abierta) pintar(); } });
  const inf = crearVentanaInforme({ ov, datos, modal, decir, enEjemplo });

  /* ---------- cargar ---------- */
  async function cargar() {
    const ps = cargarSug(false);
    try { S.d = await datos.leer(S.rango, { ejemplo: S.ejemplo }); S.error = ''; }
    catch (e) { S.error = e.message; }
    await ps; pintar();
  }
  /** A5: las sugerencias (también para el Resumen, la cuenta de la pestaña y Creativos). */
  async function cargarSug(repintar = true) {
    const r = await datos.sugerencias({ ejemplo: S.ejemplo });
    if (r.status === 200) { S.sug = { items: r.items || [], cpaObjetivo: r.cpaObjetivo ?? null, sinObjetivo: r.sinObjetivo || null, umbrales: r.umbrales || null }; S.sugErr = ''; }
    else S.sugErr = r.status === 404 ? 'la oficina todavía no da sugerencias (falta la Fase A5 en el servidor)' : r.motivo || 'la oficina no contestó';
    if (repintar) pintar();
  }
  async function cargarHistorial() { try { S.hist = await datos.historial({ ejemplo: S.ejemplo }); } catch (e) { S.hist = []; decir('No se pudo traer el historial: ' + e.message); } if (S.tab === 'historial') pintar(); }
  let reloj = 0;
  const vigilar = () => { clearInterval(reloj); reloj = setInterval(() => { const a = document.activeElement; if (document.hidden || !S.abierta || S.leyendo || S.dlg || inf.abierto() || !caja.hidden || S.tab === 'borradores' || esMet(S.tab) || (a && ov.contains(a) && a.tagName === 'SELECT')) return; cargar(); }, 60000); }; // lo que lee el servidor aparece solo

  /* ---------- pintar ---------- */
  function pintarCabecera() {
    for (const [k] of TABS) { const b = ov.querySelector(`[data-tab="${k}"]`); b.setAttribute('aria-selected', String(k === S.tab)); b.tabIndex = k === S.tab ? 0 : -1; }
    main.setAttribute('aria-labelledby', 'anuTab-' + S.tab);
    const tc = ov.querySelector('[data-tcuenta]'), nv = (S.sug?.items || []).filter(x => (x.estado || 'viva') === 'viva').length;
    if (tc) { tc.hidden = !nv; tc.textContent = nv ? String(nv) : ''; tc.closest('button').setAttribute('aria-label', nv ? `Sugerencias, ${nv} ${nv === 1 ? 'viva' : 'vivas'}` : 'Sugerencias'); }
    const ej = enEjemplo();
    cinta.hidden = !ej;
    if (ej) cinta.innerHTML = !ctx.servida ? '<b>EJEMPLO</b><span>Esta es la demo: las campañas y las cifras son de ejemplo, y lo que pauses o actives aquí solo cambia en esta página. Con la oficina abierta (npm start) y Meta conectada ves las tuyas.</span>'
      : '<b>EJEMPLO</b><span>Datos de ejemplo: no son de ninguna cuenta; lo que cambies aquí no toca Meta.</span>' + (S.ejemplo ? '<button type="button" class="anu-btn" data-a="salir">Salir del ejemplo</button>' : '');
    const h = S.d?.sincronizadaAt ? haceCuanto(S.d.sincronizadaAt) : null;
    lectura.textContent = S.leyendo ? 'Leyendo Meta…' : !S.d ? '' : !S.d.configurado ? 'Meta no está conectada para anuncios.' : h ? `Última lectura de Meta: ${h}.` : 'Todavía no se ha leído Meta.';
    bAct.disabled = S.leyendo || (!!S.d && !S.d.configurado && !enEjemplo());
  }
  /** La cuenta elegida, si todavía existe entre las que tienen anuncios (si no, todas). */
  const cuentaSel = () => (S.cuenta !== 'todas' && S.d && opcionesCuenta(S.d).some(([k]) => k === S.cuenta) ? S.cuenta : 'todas');
  function pintar() {
    pintarCabecera();
    const foco = clavFoco(), scroll = main.scrollTop, ahora = Date.now();
    if (S.tab === 'borradores') main.innerHTML = ctl.html();
    else if (esMet(S.tab)) main.innerHTML = met.html(S.tab, { ejemplo: S.ejemplo });
    else if (!S.d) main.innerHTML = S.error ? `<div class="anu-vacio" role="alert"><b>No se pudieron traer los anuncios</b><span>${esc(S.error)}</span><button type="button" class="anu-btn" data-a="reintentar">Reintentar</button></div>` : '<p class="anu-cargando">Cargando…</p>';
    else if (S.tab === 'resumen') main.innerHTML = resumenHTML(filtrarVista(S.d, cuentaSel()), { rango: S.rango, ahora, sug: S.sug, cuenta: cuentaSel() });
    else if (S.tab === 'sugerencias') main.innerHTML = S.d.configurado ? sugerenciasHTML(S.sug, { filtro: S.sfiltro, moneda: moneda(), buscarFila: id => buscar(S.d.campanas || [], id), error: S.sug ? '' : S.sugErr, ahora }) : resumenHTML(S.d);
    else if (S.tab === 'creativos') main.innerHTML = S.d.configurado ? creativosHTML(filtrarVista(S.d, cuentaSel()), S.sug, { rango: S.rango, rangos: RANGOS }) : resumenHTML(S.d);
    else if (S.tab === 'campanas') main.innerHTML = S.d.configurado ? campanasHTML(S.d, { rango: S.rango, filtro: S.filtro, orden: S.orden, abiertos: S.abiertos, sel: S.sel, ahora, cuenta: cuentaSel() }) : resumenHTML(S.d);
    else main.innerHTML = historialHTML(S.hist, { quien: S.quien });
    ov.classList.toggle('conAsis', S.tab === 'borradores' && !!ctl.abierto);
    if (S.error && S.d && S.tab !== 'borradores') main.insertAdjacentHTML('afterbegin', `<p class="anu-aviso-error" role="alert">No se pudo actualizar: ${esc(S.error)}. Lo que ves es la lectura anterior.</p>`);
    main.scrollTop = scroll; volverFoco(foco);
    if (S.sel && S.tab !== 'borradores') pintarDetalle(false);
  }
  function clavFoco() {
    const a = document.activeElement; if (!a || (!main.contains(a) && !det.contains(a)) || a === main) return null;
    const d = [...a.attributes].filter(x => x.name.startsWith('data-')).map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('') + (a.type === 'radio' ? `[value="${CSS.escape(a.value)}"]` : '');
    let pos = null; try { if (typeof a.selectionStart === 'number') pos = [a.selectionStart, a.selectionEnd]; } catch {}
    return d ? { sel: a.tagName.toLowerCase() + d, en: det.contains(a) ? 'det' : 'main', pos } : null;
  }
  function volverFoco(f) { if (!f) return; try { const n = (f.en === 'det' ? det : main).querySelector(f.sel); n?.focus({ preventScroll: true }); if (n && f.pos) try { n.setSelectionRange(f.pos[0], f.pos[1]); } catch {} } catch {} }

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
    if (devolver) setTimeout(() => (g.sug ? volverASug(g.sug, g.ordenSug) : volverAFila(g.id, g.desdeDet)), 0);
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
  const cuerpoDe = g => ({ tipo: g.tipo, id: g.id, valor: g.valor === '' || g.valor == null ? undefined : importe(g.valor), fin: g.fin || undefined, inicio: g.inicio || undefined, sugerencia: g.sug || undefined });
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
    if (g?.sug) volverASug(g.sug, g.ordenSug); else volverAFila(g?.id, g?.desdeDet);
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

  /* ---------- A5: las sugerencias y los creativos ---------- */
  function irTab(n) {
    S.tab = n; guarda.set('tab', n);
    if (n === 'historial' && S.hist == null) cargarHistorial();
    if (n === 'borradores') { cerrarDetalle(false); ctl.cargar(); }
    if (esMet(n)) { cerrarDetalle(false); met.cargar(n); }
    if ((n === 'sugerencias' || n === 'creativos') && !S.sug) cargarSug();
    pintar();
  }
  const opc = () => ({ ejemplo: S.ejemplo });
  const ordenVisible = () => [...main.querySelectorAll('[data-sug]')].map(n => n.dataset.sug);
  /** Tras aplicar, descartar o posponer, el foco va a la tarjeta que ocupa su lugar (la siguiente; si no, la anterior; si no, el filtro). */
  function volverASug(id, orden = S.ordenSug || []) {
    const q = x => main.querySelector(`[data-sug="${CSS.escape(x)}"] button`);
    let n = q(id);
    if (!n) { const i = orden.indexOf(id); for (const x of [...orden.slice(i + 1), ...orden.slice(0, Math.max(0, i)).reverse()]) { n = q(x); if (n) break; } }
    (n || main.querySelector('[data-sfiltro][aria-pressed="true"]') || main.querySelector('[data-ir]') || main).focus({ preventScroll: false });
  }
  /** «Aplicar». Lo que baja el gasto: un clic con DESHACER. Lo que gasta: la ventana del segundo clic de la A2 con la cifra. */
  async function aplicarSug(id, btn) {
    const s = (S.sug?.items || []).find(x => x.id === id); if (!s) return;
    const c = s.cambio || {};
    if (c.tipo === 'revisar') return abrirObjeto(c.id || s.objeto?.id, btn);
    S.ordenSug = ordenVisible();
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); decir('Aplicando…');
    const r = await datos.aplicarSugerencia(id, opc());
    if (btn.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
    const f = S.d && buscar(S.d.campanas || [], c.id);
    if (r.confirmar) { // gasta: la misma ventana del segundo clic que la A2; el «Sí» va por /api/anuncios/accion con `sugerencia`
      S.dlg = null;
      abrirDlg({ tipo: c.tipo, id: c.id, f, desdeDet: false, valor: c.valor ?? '', fin: c.fin || '', inicio: c.inicio || '', sug: s.id, ordenSug: S.ordenSug, fase: 'confirm', confirmar: r.confirmar, aviso: r.aviso || '' });
      decir(`${r.aviso ? 'Ojo: ' + r.aviso + ' ' : ''}${r.confirmar.texto}. ¿Sí?`); return;
    }
    if (r.ok && r.borrador) {
      await cargarSug(false);
      irTab('borradores');
      mostrarAviso(r.hecho?.texto || 'Te dejé un borrador: revísalo. No se crea nada en Meta hasta que pulses «Crear en Meta (en pausa)».', null);
      await ctl.abrir(r.borrador.id, { paso: 3 }); return;
    }
    if (r.ok) {
      const ag = r.tarea ? (ctx.agentName?.(r.tarea.agent || 'ada') || 'tu agente de anuncios') : '';
      mostrarAviso(r.hecho?.texto || (r.tarea ? `Le pedí a ${ag} variaciones: te llegará la tarjeta de costo del Estudio.` : 'Hecho.'), r.deshacer, r.aviso);
      await refrescar(); volverASug(id); return;
    }
    S.dlg = null; abrirDlg({ tipo: c.tipo, id: c.id, f, desdeDet: false, sug: s.id, ordenSug: S.ordenSug, fase: 'error', r });
    decir(r.motivo || 'No se pudo.');
  }
  /** «Descartar» (no vuelve en 7 días) y «Recordármelo en 3 días»: un clic. */
  async function marcarSug(id, que, btn) {
    const s = (S.sug?.items || []).find(x => x.id === id); if (!s) return;
    S.ordenSug = ordenVisible(); btn.disabled = true;
    const r = que === 'descartar' ? await datos.descartarSugerencia(id, opc()) : await datos.posponerSugerencia(id, 3, opc());
    if (!r.ok) { if (btn.isConnected) btn.disabled = false; mostrarAviso(`No se pudo: ${r.motivo || 'la oficina no contestó'}`, null); return; }
    await cargarSug();
    mostrarAviso(que === 'descartar' ? `Descartada: «${reglaTexto(s.regla)}» sobre «${s.objeto?.nombre || ''}» no vuelve en 7 días.` : `Te la recuerdo en 3 días: «${reglaTexto(s.regla)}» sobre «${s.objeto?.nombre || ''}».`, null);
    volverASug(id);
  }
  /** El nombre del objeto de una sugerencia o de un creativo: su detalle en Campañas (con su campaña y su conjunto desplegados). */
  function abrirObjeto(id, desde) {
    const f = S.d && buscar(S.d.campanas || [], id);
    if (!f) { decir('Eso ya no está en la cuenta.'); return; }
    S.abiertos.add(f.campana.id); if (f.conjunto) S.abiertos.add(f.conjunto.id);
    abrirDetalle(id, null); origenDet = `[data-abrir="${CSS.escape(id)}"]`;
    if (desde) decir(`${f.nodo.nombre}: su detalle, en Campañas.`);
  }
  /** Sin sugerencia de variaciones: una campaña nueva (borrador) con el texto de ese creativo, en el paso 4 para elegir la imagen. */
  async function nuevaConCreativo(adId, btn) {
    const g = S.d && grupoDeAnuncio(S.d.campanas || [], adId, { cpaObjetivo: S.sug?.cpaObjetivo ?? null, umbrales: S.sug?.umbrales || {}, moneda: moneda() });
    if (!g) { decir('Ese creativo ya no está.'); return; }
    btn.disabled = true;
    const r = await datos.nuevoBorrador(borradorDeCreativo(g), opc());
    if (btn.isConnected) btn.disabled = false;
    if (r.status !== 200 || !r.borrador) { mostrarAviso(`No se pudo empezar la campaña: ${r.motivo || 'la oficina no contestó'}`, null); return; }
    irTab('borradores');
    mostrarAviso(`Empecé una campaña nueva con el texto de ese creativo${g.creativo?.media ? ' y su imagen' : ': elige su imagen aquí (la de Meta no está en tu galería)'}. Es un borrador: no se crea nada en Meta hasta que lo pidas.`, null);
    await ctl.abrir(r.borrador.id, { paso: 3 });
  }

  /* ---------- A6: los indicadores de «Cómo va el negocio» ---------- */
  async function crearIndicadores(btn) {
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    const r = await datos.crearIndicadores({ ejemplo: S.ejemplo });
    if (btn.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
    if (!r.ok) { mostrarAviso(`No se crearon: ${r.motivo || 'la oficina no contestó'}`, null); return; }
    const n = (r.creados || []).length;
    mostrarAviso(`${n ? `Listo: ${n === 1 ? 'un indicador nuevo' : n + ' indicadores nuevos'} en «Cómo va el negocio» (N).` : 'Ya estaban en «Cómo va el negocio» (N).'}${r.motivo ? ' ' + r.motivo : ''}${r.ejemplo ? ' (En el ejemplo, solo en esta página.)' : ''}`, null);
    await cargar(); (main.querySelector('[data-a="indicadores"]') || main.querySelector('[data-a="informe"]') || main).focus({ preventScroll: true });
  }

  /* ---------- A6 (10 oct 2026): la API de conversiones — «Mandar un evento de prueba» ---------- */
  async function probarConversiones(btn) {
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    const r = await datos.probarConversiones({ ejemplo: S.ejemplo });
    if (btn.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
    mostrarAviso(r.ok ? r.texto : `No salió: ${r.motivo || 'la oficina no contestó'}`, null);
    await cargar(); (main.querySelector('[data-a="conv-probar"]') || main.querySelector('[data-conv]') || main).focus?.({ preventScroll: true });
  }

  /* ---------- eventos ---------- */
  ov.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !ov.contains(b)) return;
    if (dlg.contains(b)) {
      const a = b.dataset.dlg, g = S.dlg; if (!g) return;
      if (a === 'cancelar') { cerrarDlg(); decir('Cancelado: no cambió nada.'); return; }
      if (a === 'si') return confirmar();
      if (a === 'otra') { const { tipo, id, f, desdeDet, valor, fin, inicio, sug, ordenSug } = g; S.dlg = { tipo, id, f, desdeDet, valor, fin, inicio, sug, ordenSug }; return primerClic(S.dlg); }
      if (a === 'minimo') { abrirDlg({ fase: 'form', valor: b.dataset.minimo, err: '' }); return; }
      return;
    }
    if (b.closest('.anu-fondo-gal') || b.closest('.anu-fondo-inf')) return; // la galería del asistente y la ventana del informe escuchan solas
    if (b.dataset.a === 'nueva' && S.tab !== 'borradores') { S.tab = 'borradores'; guarda.set('tab', S.tab); cerrarDetalle(false); }
    if ((S.tab === 'borradores' || b.dataset.vercamp) && main.contains(b) && ctl.click(b)) return;
    if (esMet(S.tab) && main.contains(b) && met.click(b)) return;
    if (caja.contains(b) && b.dataset.acc) return pedir(b.dataset.acc, b.dataset.id, menuDe);
    if (b.dataset.menu) return caja.hidden || menuDe !== b ? abrirMenu(b) : cerrarMenu();
    if (b.dataset.acc) return pedir(b.dataset.acc, b.dataset.id, b);
    if (b.dataset.deshacer) return deshacer(b);
    if (b.hasAttribute('data-cerrartoast')) { clearInterval(relojToast); toast.hidden = true; toast.innerHTML = ''; main.focus({ preventScroll: true }); return; }
    if (b.dataset.tab) return irTab(b.dataset.tab);
    if (b.dataset.ir) { irTab(b.dataset.ir); setTimeout(() => ov.querySelector(`[data-tab="${b.dataset.ir}"]`)?.focus(), 20); return; }
    if (b.dataset.sapl) return aplicarSug(b.dataset.sapl, b);
    if (b.dataset.crvar) return aplicarSug(b.dataset.crvar, b);
    if (b.dataset.sdesc) return marcarSug(b.dataset.sdesc, 'descartar', b);
    if (b.dataset.spos) return marcarSug(b.dataset.spos, 'posponer', b);
    if (b.dataset.sobj) return abrirObjeto(b.dataset.sobj, b);
    if (b.dataset.crnueva != null) return nuevaConCreativo(b.dataset.crnueva, b);
    if (b.dataset.sfiltro) { S.sfiltro = b.dataset.sfiltro; guarda.set('sfiltro', S.sfiltro); pintar(); return; }
    if (b.hasAttribute('data-cerrarvista')) return ctx.cerrar?.();
    if (b.hasAttribute('data-actualizar')) return actualizar();
    if (b.hasAttribute('data-cerrardet')) return cerrarDetalle();
    if (b.dataset.rango) { S.rango = b.dataset.rango; guarda.set('rango', S.rango); decir('Cifras de ' + b.textContent.trim().toLowerCase()); return cargar(); }
    if (b.dataset.filtro) { S.filtro = b.dataset.filtro; guarda.set('filtro', S.filtro); return pintar(); }
    if (b.dataset.quien) { S.quien = b.dataset.quien; guarda.set('quien', S.quien); return pintar(); }
    if (b.dataset.tog) { const id = b.dataset.tog; if (S.abiertos.has(id)) S.abiertos.delete(id); else S.abiertos.add(id); return pintar(); }
    if (b.dataset.vercuenta) { S.cuenta = b.dataset.vercuenta; guarda.set('cuenta', S.cuenta); S.tab = 'campanas'; guarda.set('tab', S.tab); pintar(); decir('Campañas de esa cuenta.'); return; }
    if (b.dataset.abrir) return abrirDetalle(b.dataset.abrir, b);
    if (b.dataset.abrircamp) return abrirDetalle(b.dataset.abrircamp, b);
    const a = b.dataset.a;
    if (a === 'ejemplo') { S.ejemplo = true; S.hist = null; ctl.reiniciar(); if (S.tab === 'borradores') ctl.cargar(); cargar().then(() => decir('Viendo datos de ejemplo.')); return; }
    if (a === 'salir') { S.ejemplo = false; S.hist = null; ctl.reiniciar(); if (S.tab === 'borradores') ctl.cargar(); cerrarDetalle(false); cargar().then(() => decir('De vuelta a tu cuenta.')); return; }
    if (a === 'ajustes') return ctx.abrirAjustes?.('anuncios');
    if (a === 'reintentar') return cargar();
    if (a === 'recargar-s') return cargarSug();
    if (a === 'informe') return inf.abrir(b);
    if (a === 'indicadores') return crearIndicadores(b);
    if (a === 'conv-probar') return probarConversiones(b);
  });
  ov.addEventListener('submit', e => {
    if (esMet(S.tab) && main.contains(e.target) && met.submit(e)) return;
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
  ov.addEventListener('input', e => { if (S.tab === 'borradores' && main.contains(e.target)) ctl.input(e); });
  ov.addEventListener('change', e => { if (S.tab === 'borradores' && main.contains(e.target) && ctl.change(e)) return; if (esMet(S.tab) && main.contains(e.target) && met.change(e)) return; if (e.target.matches('[data-cuenta]')) { S.cuenta = e.target.value; guarda.set('cuenta', S.cuenta); pintar(); return; } if (e.target.matches('[data-orden]')) { S.orden = e.target.value; guarda.set('orden', S.orden); pintar(); } });
  ov.addEventListener('keydown', e => {
    const el = e.target;
    if (S.tab === 'borradores' && main.contains(el) && ctl.keydown(e)) return;
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') && el.getAttribute?.('role') === 'tab') {
      e.preventDefault(); const i = TABS.findIndex(([k]) => k === el.dataset.tab);
      const n = TABS[e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      irTab(n); ov.querySelector(`[data-tab="${n}"]`).focus();
    }
    if (e.key === 'ArrowDown' && el.dataset?.menu) { e.preventDefault(); abrirMenu(el); }
  });

  /* ---------- abrir y cerrar ---------- */
  return {
    version: VERSION,
    open(o = {}) {
      S.abierta = true; if (o.tab && TABS.some(([k]) => k === o.tab)) S.tab = o.tab;
      if (o.impulsar) { S.tab = 'borradores'; if (o.impulsar.ejemplo && ctx.servida && !S.ejemplo) { S.ejemplo = true; S.hist = null; ctl.reiniciar(); } } /* A4: «Impulsar» desde Contenido o Analíticas (en su ejemplo, aquí también) */
      if (o.objeto) S.tab = 'campanas'; /* B1: desde la Bandeja, «Ver la campaña en Anuncios» */
      vigilar(); pintar(); cargar().then(() => { if (S.tab === 'historial' && S.hist == null) cargarHistorial(); if (o.objeto) { pintar(); abrirObjeto(o.objeto, null); } });
      if (o.impulsar) { ctl.impulsar(o.impulsar); return; }
      if (S.tab === 'borradores' && o.borrador) { ctl.abrir(o.borrador, { paso: o.paso ?? 0, medios: o.medios || [] }); return; } // A3: de vuelta del Estudio «para el anuncio»
      if (S.tab === 'borradores') ctl.cargar();
      if (esMet(S.tab)) met.cargar(S.tab);
      setTimeout(() => ov.querySelector(`[data-tab="${S.tab}"]`)?.focus(), 30);
    },
    close() { S.abierta = false; clearInterval(reloj); ctl.cerrar(); cerrarMenu(false); cerrarDlg(false); inf.cerrar(false); cerrarDetalle(false); },
    back() { return cerrarMenu() || cerrarDlg() || inf.cerrar() || (S.tab === 'borradores' && ctl.back()) || cerrarDetalle(); },
    refresh: () => cargar(),
    selection() {
      const sb = S.tab === 'borradores' && ctl.selection(); if (sb) return sb;
      const f = S.sel && S.d && buscar(S.d.campanas || [], S.sel);
      if (f) return { view: 'anuncios', label: `${NIVEL[f.nivel]} «${String(f.nodo.nombre || '').slice(0, 60)}»${enEjemplo() ? ' (ejemplo)' : ''}`, kind: f.nivel, id: f.id };
      return { view: 'anuncios', label: `Anuncios · ${TABS.find(([k]) => k === S.tab)?.[1] || ''}${enEjemplo() ? ' (ejemplo)' : ''}`, kind: 'resumen' };
    },
  };
}

if (typeof window !== 'undefined') window.AO_ANUNCIOS = { version: VERSION, init };
export { init };
