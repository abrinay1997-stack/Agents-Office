// La vista ANUNCIOS en la página (Fase A1, 9 oct 2026): lo mínimo — la vista bajo la barra superior (views.js), su botón y su tecla (J),
// y la carga BAJO DEMANDA de dist/anuncios-vista.js (build-anuncios.mjs) la primera vez que se abre: quien no abre Anuncios no lo descarga.
// Si no llega, lo dice y ofrece «Reintentar». En file:// va junto a la página; servida, en /anuncios-vista.js. Calca src/tareas-carga.js.
import { views } from './views.js';
import { modal } from './modal.js';

/* global __AO_ANUNCIOS_VERSION__ */
export const VERSION = typeof __AO_ANUNCIOS_VERSION__ === 'string' ? __AO_ANUNCIOS_VERSION__ : '';
export const ARCHIVO = 'anuncios-vista.js';
const CARGANDO = '<p class="anu-cargando-fuera" role="status" style="padding:32px;font-size:14px">Cargando Anuncios…</p>';

export function initAnunciosCarga(ctx) {
  const ov = document.createElement('section');
  ov.id = 'anuOv'; ov.setAttribute('data-view', 'anuncios'); ov.setAttribute('aria-label', 'Anuncios'); ov.inert = true; ov.tabIndex = -1;
  ov.innerHTML = CARGANDO;
  document.body.appendChild(ov);
  let api = null, abierta = false, opener = null, pedida = null, intentos = 0;

  function cargar() {
    if (window.AO_ANUNCIOS?.init) return Promise.resolve(window.AO_ANUNCIOS);
    if (pedida) return pedida;
    intentos++;
    pedida = new Promise((res, rej) => {
      const s = document.createElement('script'); s.async = true;
      s.src = `${ARCHIVO}?v=${encodeURIComponent(VERSION || 'dev')}${intentos > 1 ? '&r=' + intentos : ''}`;
      const t = setTimeout(() => fallo('tiempo'), 30000);
      function fallo(causa) { clearTimeout(t); s.remove(); pedida = null; rej(new Error(causa === 'version' ? 'La página y la vista de Anuncios son de construcciones distintas: recarga la página (F5).' : location.protocol === 'file:' ? `No está ${ARCHIVO} junto a la página: vuelve a abrir la oficina con el iniciador (la reconstruye).` : 'No se pudo traer la vista de Anuncios: revisa que la oficina siga abierta y vuelve a intentarlo.')); }
      s.onerror = () => fallo('red');
      s.onload = () => { clearTimeout(t); const x = window.AO_ANUNCIOS; if (!x?.init) return fallo('red'); if (VERSION && x.version !== VERSION) { delete window.AO_ANUNCIOS; return fallo('version'); } res(x); };
      document.head.appendChild(s);
    });
    return pedida;
  }
  async function open(o = {}) {
    if (abierta) return;
    views.opening('anuncios'); abierta = true; opener = document.activeElement;
    ov.inert = false; modal.open(ov); ov.classList.add('on'); document.body.classList.add('anuOpen');
    try {
      const m = await cargar();
      if (!abierta) return;
      if (!api) api = m.init(ov, { ...ctx, modal, cerrar: () => close(), abrir: x => (abierta ? api?.open(x) : open(x)) }); // A2: la misma pila de ventanas que la página (la confirmación de lo que gasta es una) · A3: `abrir` vuelve del Estudio «para el anuncio»
      api.open(o);
    } catch (e) {
      ov.innerHTML = `<div role="alert" style="padding:32px;max-width:560px;font-size:14px"><p style="margin-bottom:12px">${String(e.message).replace(/</g, '&lt;')}</p><button type="button" data-reintentar style="min-height:34px;padding:0 14px;border-radius:10px;border:1px solid currentColor;background:none;color:inherit;font:inherit;cursor:pointer">Reintentar</button></div>`;
      ov.querySelector('[data-reintentar]').addEventListener('click', () => { ov.innerHTML = CARGANDO; abierta = false; open(o); });
    }
  }
  function close(o = {}) {
    if (!abierta) return; abierta = false; api?.close();
    modal.close(ov); ov.inert = true; ov.classList.remove('on'); document.body.classList.remove('anuOpen');
    if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
  }
  views.add('anuncios', { isOpen: () => abierta, close });
  return {
    open, close, toggle: () => (abierta ? close() : open()), isOpen: () => abierta,
    back: () => !!api?.back(), // Esc: el detalle de una campaña antes de cerrar la vista
    refresh: () => api?.refresh(),
    selection: () => (!abierta ? null : api ? api.selection() : { view: 'anuncios', label: 'Anuncios', kind: 'resumen' }),
  };
}
