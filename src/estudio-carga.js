// CARGA BAJO DEMANDA de lo pesado del Estudio (1 oct 2026; auditoría INF-09: la página tiene su presupuesto en check.mjs).
// El banco de presets (con su compilador y su buscador), el escenario 3D y los lotes van en un paquete aparte,
// dist/estudio-extra.js (build.mjs; entrada src/estudio-extra.js), junto a la página como dist/presets-fabrica.js. Se carga con un
// <script src> la PRIMERA vez que hace falta: cuando el Estudio enseña el compositor de imagen (su paso «Presets» es del banco:
// preparar()), al abrir el banco (botón, B, «/»), el escenario 3D o los lotes (la pestaña, «Editar en lote…»), o al guardar un
// resultado como preset. Nunca con la oficina sola: quien no abre el Estudio no lo descarga. Funciona en file:// y servido
// (serve.mjs lo sirve en /estudio-extra.js).
//   bancoDiferido(ctx)          → la misma cara que initBanco(ctx) (src/studio-banco.js); hasta que llega, un paso pequeño en el
//                                 compositor y, si se pidió la hoja, la hoja con «Cargando…» (o el error con «Reintentar»).
//   lotesDiferidos(host, ctx)   → la misma cara que initLotes(host, ctx) (src/studio-lotes.js), igual.
// Lo que llega antes de que el paquete esté (abrir, nuevo, guardarDesde…) se hace en cuanto llega. three.js no viaja dos veces:
// el paquete usa window.AO_THREE (src/three-compartido.js).
import { threeCompartido } from './three-compartido.js';
import { qaResumen } from './studio-qa.js';

/* global __AO_EXTRA_VERSION__ */
/** La huella del paquete con el que se construyó esta página (build.mjs): uno de otra construcción no se usa. */
export const VERSION = typeof __AO_EXTRA_VERSION__ === 'string' ? __AO_EXTRA_VERSION__ : '';
export const ARCHIVO = 'estudio-extra.js';
export const LOTE_ACTIVO = ['muestra', 'corriendo']; // = ACTIVOS de src/studio-lotes.js (tests/estudio-extra.test.mjs lo comprueba)
const ESPERA_MAX = 30000; // un archivo que no contesta en 30 s se da por fallido (y se puede reintentar)

let pedida = null, intentos = 0;
const avisar = []; // las caras diferidas que esperan el paquete

const elExtra = () => (typeof window !== 'undefined' && window.AO_ESTUDIO_EXTRA && typeof window.AO_ESTUDIO_EXTRA.initBanco === 'function' ? window.AO_ESTUDIO_EXTRA : null);
/** El mensaje claro cuando no llega: qué pasó y qué hacer. */
export function motivoFallo(protocolo, causa) {
  if (causa === 'version') return 'La página y esta parte del Estudio son de construcciones distintas. Vuelve a abrir la oficina con el iniciador (la reconstruye) y recarga.';
  if (protocolo === 'file:') return `No está ${ARCHIVO} junto a la página. Construye la oficina otra vez (node build.mjs, o ábrela con el iniciador) y vuelve a intentarlo.`;
  return 'No se pudo traer esta parte del Estudio de la oficina. Revisa que la oficina siga abierta y vuelve a intentarlo.';
}

/** Cuando el paquete llega (o ya, si llegó): fn(extra). */
export function alLlegar(fn) { const x = elExtra(); if (x) fn(x); else avisar.push(fn); }

/** → Promise<extra>. Una sola petición a la vez; si falla, la siguiente llamada vuelve a pedirlo. */
export function cargarExtra() {
  const ya = elExtra(); if (ya) return Promise.resolve(ya);
  if (pedida) return pedida;
  if (!window.AO_THREE) window.AO_THREE = threeCompartido(); // antes del <script>: el paquete lo lee al empezar
  intentos++;
  pedida = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `${ARCHIVO}?v=${encodeURIComponent(VERSION || 'dev')}${intentos > 1 ? '&r=' + intentos : ''}`; // otra dirección al reintentar: nada de una copia vieja
    s.async = true;
    let t = 0;
    const fallo = causa => { clearTimeout(t); s.remove(); pedida = null; rej(new Error(motivoFallo(location.protocol, causa))); };
    t = setTimeout(() => fallo('tiempo'), ESPERA_MAX);
    s.onerror = () => fallo('red');
    s.onload = () => {
      clearTimeout(t);
      const x = window.AO_ESTUDIO_EXTRA;
      if (!x || typeof x.initBanco !== 'function' || typeof x.initLotes !== 'function') return fallo('red');
      if (VERSION && x.version !== VERSION) { delete window.AO_ESTUDIO_EXTRA; return fallo('version'); }
      for (const fn of avisar.splice(0)) { try { fn(x); } catch (e) { console.error(e); } }
      res(x);
    };
    document.head.appendChild(s);
  });
  return pedida;
}

/* ---------- lo que se ve mientras llega ---------- */
const ESTRELLA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg>';
const REJILLA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg>';
let uid = 0;
/** Una caja de estado: el texto vivo («Cargando…») y, si falló, el motivo con «Reintentar». */
function cajaEstado() {
  const box = document.createElement('div'); box.className = 'exc-caja';
  box.innerHTML = '<p class="exc" role="status" aria-live="polite"></p><div class="exc-mal" hidden><p role="alert"></p><button type="button" class="exc-re">Reintentar</button></div>';
  const vivo = box.querySelector('.exc'), mal = box.querySelector('.exc-mal');
  return {
    box,
    cargando(texto) { box.setAttribute('aria-busy', 'true'); mal.hidden = true; mal.querySelector('p').textContent = ''; vivo.hidden = false; vivo.textContent = texto; },
    error(texto, enfocar) { box.removeAttribute('aria-busy'); vivo.textContent = ''; vivo.hidden = true; mal.hidden = false; mal.querySelector('p').textContent = texto; if (enfocar) mal.querySelector('button').focus({ preventScroll: true }); },
    nada() { box.removeAttribute('aria-busy'); vivo.textContent = ''; vivo.hidden = true; mal.hidden = true; },
    alReintentar(fn) { mal.querySelector('button').addEventListener('click', fn); },
  };
}
const recetaGuardada = () => { try { const g = JSON.parse(localStorage.getItem('ao.studio.banco') || '{}') || {}; return (Array.isArray(g.pila) && g.pila.length > 0) || !!g.escena; } catch { return false; } };

/** El banco de presets, diferido: la misma cara que initBanco(ctx). */
export function bancoDiferido(ctx) {
  const U = 'bkd' + (++uid);
  let real = null, models = null, refrescado = false, pendiente = null, ultimo = '', preparado = false;
  const el = document.createElement('div'); el.className = 'st-step bk bk-dif'; el.setAttribute('role', 'group'); el.setAttribute('aria-labelledby', U + 'T');
  el.innerHTML = `<div class="st-h" id="${U}T"><b>${ESTRELLA}</b> Presets <span class="st-hn">opcional · combínalos</span></div>
    <div class="bk-pilah"><span class="bk-lbl">Lo que se hará</span><button type="button" class="bk-open" data-ir="banco" aria-expanded="false" title="Abrir el banco de presets (B)">${REJILLA}<span>Banco · B</span></button></div>
    <p class="bk-vacio">Ningún preset todavía: ábrelo con «Banco» o escribe <kbd>/</kbd> al principio de la idea.</p>
    <div class="bk-esc"><span class="bk-lbl">Escenario 3D <small>la cámara a una distancia, en cm o m</small></span><span class="bk-addrow"><button type="button" class="bk-add" data-ir="escena">Usar un escenario 3D</button></span></div>`; // como el paso de verdad (src/studio-banco.js), en el mismo orden
  const paso = cajaEstado(); el.appendChild(paso.box);
  const sheet = document.createElement('aside'); sheet.className = 'st-bank bk-dif'; sheet.hidden = true; sheet.setAttribute('role', 'region'); sheet.setAttribute('aria-label', 'Banco de presets');
  const hoja = cajaEstado();
  const mostrar = (estado, texto, enfocar) => {
    for (const c of [paso, hoja]) { if (estado === 'cargando') c.cargando(texto); else if (estado === 'error') c.error(texto, enfocar && (c === hoja ? !sheet.hidden : sheet.hidden)); else c.nada(); }
  };
  function abrirHoja(modo) {
    const titulo = modo === 'escena' ? 'Escenario 3D' : 'Banco de presets';
    sheet.setAttribute('aria-label', titulo); sheet.dataset.modo = modo;
    sheet.innerHTML = `<div class="bk-sh"><b>${titulo}</b><span class="sp"></span><button type="button" class="bk-x" data-cerrar aria-label="Cerrar" title="Cerrar (Esc)">✕</button></div>`;
    sheet.appendChild(hoja.box); sheet.hidden = false;
    el.querySelector('[data-ir="banco"]').setAttribute('aria-expanded', String(modo === 'banco'));
    ctx.mostrarGaleria?.();
    setTimeout(() => { if (!sheet.hidden && !real && !sheet.contains(document.activeElement)) sheet.querySelector('[data-cerrar]')?.focus({ preventScroll: true }); }, 30); // como el banco: el foco entra en la hoja
  }
  function cerrarHoja(devolver = true) {
    if (sheet.hidden) return;
    sheet.hidden = true; pendiente = null; el.querySelector('[data-ir="banco"]').setAttribute('aria-expanded', 'false');
    if (devolver) el.querySelector('[data-ir="banco"]')?.focus({ preventScroll: true });
  }
  function cargar(texto, enfocar) { // enfocar: lo pidió la persona (un clic, una tecla), así que el error con «Reintentar» recibe el foco
    ultimo = texto; mostrar('cargando', texto);
    cargarExtra().catch(e => { if (!real) mostrar('error', e.message, enfocar); });
  }
  /** Hazlo ya si el banco está; si no, en cuanto llegue (lo último pedido gana). */
  function pedir(accion, { modo = null, texto = 'Cargando el banco de presets…', enfocar = true } = {}) {
    if (real) return accion?.(real);
    if (accion || !pendiente) pendiente = accion; if (modo) abrirHoja(modo);
    cargar(modo === 'escena' ? 'Cargando el escenario 3D…' : texto, enfocar);
  }
  paso.alReintentar(() => cargar(ultimo || 'Cargando el banco de presets…', true));
  hoja.alReintentar(() => cargar(ultimo || 'Cargando el banco de presets…', true));
  el.addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) pedir(r => r.abrir(b.dataset.ir), { modo: b.dataset.ir }); });
  sheet.addEventListener('click', e => { if (e.target.closest('[data-cerrar]')) cerrarHoja(); });
  sheet.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) { e.preventDefault(); e.stopPropagation(); cerrarHoja(); } });

  alLlegar(x => { // el paquete llegó (por el banco o por los lotes): el banco de verdad ocupa el sitio del provisional
    if (real) return;
    const teniaFoco = el.contains(document.activeElement) || sheet.contains(document.activeElement);
    try { real = x.initBanco(ctx); } catch (e) { console.error(e); mostrar('error', 'El banco de presets no pudo empezar: ' + e.message, true); return; }
    real.el.hidden = el.hidden;
    if (el.parentNode) el.replaceWith(real.el);
    if (sheet.parentNode) sheet.replaceWith(real.sheet);
    if (models) real.setModels(models);
    if (refrescado && !(typeof location !== 'undefined' && location.protocol === 'file:')) real.refrescar(); // en file:// initBanco ya la pide
    ctx.onState?.();
    const p = pendiente; pendiente = null;
    if (p) p(real); else if (teniaFoco) real.el.querySelector('.bk-open')?.focus({ preventScroll: true });
  });

  return {
    get el() { return real ? real.el : el; },
    get sheet() { return real ? real.sheet : sheet; },
    activo: () => (real ? real.activo() : false),
    generar: () => real?.generar(),
    toggle: () => (real ? real.toggle() : sheet.hidden ? pedir(r => r.abrir('banco'), { modo: 'banco' }) : cerrarHoja()),
    abrir: (modo = 'banco') => pedir(r => r.abrir(modo), { modo }),
    cerrar: (devolver = true) => (real ? real.cerrar(devolver) : cerrarHoja(devolver)),
    abierto: () => (real ? real.abierto() : !sheet.hidden),
    refrescar: () => { if (real) return real.refrescar(); refrescado = true; },
    setModels(l) { if (real) real.setModels(l); else models = l; },
    replan: () => (real ? real.replan() : Promise.resolve(null)),
    estado: () => (real ? real.estado() : { puerta: 'foto', foto: null, refs: [], pila: [], canal: null, escena: null, modelo: null, idea: '', n: 1, plan: null }),
    costo: () => (real ? real.costo() : 'calculando…'),
    /** La galería lo usa siempre: no espera al banco. */
    qaHTML(it) { if (real) return real.qaHTML(it); const r = qaResumen(it?.qa); return r ? `<span class="bk-q bk-q-${r.estado}">${ctx.esc(r.texto)}</span>` : ''; },
    guardarDesde: it => pedir(r => r.guardarDesde(it), { texto: 'Cargando el banco de presets para guardar el preset…' }),
    barra: texto => (real ? real.barra(texto) : /^\/\S*$/.test(texto) ? (pedir(r => r.barra(texto), { modo: 'banco' }), true) : false),
    /** Cuando el Estudio enseña el compositor de imagen (una vez): su paso «Presets» es del banco, así que se trae ya. */
    preparar() { if (real || preparado) return; preparado = true; pedir(null, { texto: recetaGuardada() ? 'Cargando tu receta de presets…' : 'Cargando el banco de presets…', enfocar: false }); },
    cargado: () => !!real,
  };
}

/** Los lotes, diferidos: la misma cara que initLotes(host, ctx). */
export function lotesDiferidos(host, ctx = {}) {
  const U = 'ltd' + (++uid);
  let real = null, cola = [];
  const ph = document.createElement('section'); ph.className = 'lt lt-dif'; ph.setAttribute('aria-labelledby', U + 'T');
  ph.innerHTML = `<div class="lt-cuerpo"><header class="lt-hd"><h2 id="${U}T" tabindex="-1">Lotes</h2></header>
    <p class="lt-sub">Muchas fotos con la misma receta. Primero ves el plan y el costo; nada se gasta hasta que pulses PROBAR o GENERAR.</p></div>`;
  const caja = cajaEstado(); ph.querySelector('.lt-cuerpo').appendChild(caja.box);
  host.appendChild(ph);
  // la pestaña dice cuántos lotes van en marcha o esperan tu OK sin traer el paquete (una sola lectura, como hacía initLotes al
  // empezar); si hay alguno, el paquete se trae en silencio para seguirlos. Sin servidor (la demo) no hay lotes que contar.
  if (typeof ctx.live === 'function' && ctx.live() && ctx.api) {
    Promise.resolve().then(() => ctx.api('GET', '/api/media/lotes')).then(r => {
      if (real) return;
      const l = Array.isArray(r?.lotes) ? r.lotes : [], c = { activos: l.filter(x => LOTE_ACTIVO.includes(x?.estado)).length, espera: l.filter(x => x?.estado === 'espera_ok').length, revisar: 0 };
      ctx.onCambio?.(c);
      if (c.activos + c.espera) cargarExtra().catch(() => {});
    }).catch(() => {});
  }
  const cargar = () => { caja.cargando('Cargando los lotes…'); cargarExtra().catch(e => { if (!real) caja.error(e.message, ph.contains(document.activeElement) || document.activeElement === document.body); }); };
  caja.alReintentar(cargar);
  function pedir(f) { if (real) return f(real); cola.push(f); cargar(); }
  alLlegar(x => {
    if (real) return;
    try { real = x.initLotes(host, ctx); } catch (e) { console.error(e); caja.error('Los lotes no pudieron empezar: ' + e.message, true); return; }
    ph.remove();
    for (const f of cola.splice(0)) f(real);
  });
  return {
    get el() { return real ? real.el : ph; },
    abrir() { if (real) return real.abrir(); pedir(r => r.abrir()); setTimeout(() => { if (!real && !ph.contains(document.activeElement)) ph.querySelector('h2')?.focus({ preventScroll: true }); }, 0); },
    nuevo: origen => pedir(r => r.nuevo(origen)),
    seguir: (id, ya) => pedir(r => r.seguir(id, ya)),
    refrescar: () => (real ? real.refrescar() : Promise.resolve()),
    destruir: () => (real ? real.destruir() : ph.remove()),
    estado: () => (real ? real.estado() : { vista: 'lista', id: null, paso: null, lotes: 0 }),
    cargado: () => !!real,
  };
}
