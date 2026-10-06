// La vista TAREAS en la página (plan T2, 6 oct 2026): lo mínimo — la vista bajo la barra superior (views.js), su botón y su tecla (H),
// y la carga BAJO DEMANDA de dist/tareas-vista.js (build-tareas.mjs) la primera vez que se abre: quien no abre Tareas no lo descarga.
// Si no llega, lo dice y ofrece «Reintentar». En file:// va junto a la página; servida, en /tareas-vista.js.
import { views } from './views.js';
import { modal } from './modal.js';

/* global __AO_TAREAS_VERSION__ */
export const VERSION = typeof __AO_TAREAS_VERSION__ === 'string' ? __AO_TAREAS_VERSION__ : '';
export const ARCHIVO = 'tareas-vista.js';

export function initTareasCarga(ctx) {
  const ov = document.createElement('section');
  ov.id = 'tvOv'; ov.setAttribute('data-view', 'tareas'); ov.setAttribute('aria-label', 'Tareas'); ov.inert = true; ov.tabIndex = -1;
  ov.innerHTML = '<p class="tv-cargando-fuera" role="status">Cargando Tareas…</p>';
  document.body.appendChild(ov);
  let api = null, abierta = false, opener = null, pedida = null, intentos = 0;

  function cargar() {
    if (window.AO_TAREAS?.init) return Promise.resolve(window.AO_TAREAS);
    if (pedida) return pedida;
    intentos++;
    pedida = new Promise((res, rej) => {
      const s = document.createElement('script'); s.async = true;
      s.src = `${ARCHIVO}?v=${encodeURIComponent(VERSION || 'dev')}${intentos > 1 ? '&r=' + intentos : ''}`;
      const t = setTimeout(() => fallo('tiempo'), 30000);
      function fallo(causa) { clearTimeout(t); s.remove(); pedida = null; rej(new Error(causa === 'version' ? 'La página y la vista de Tareas son de construcciones distintas: recarga la página (F5).' : location.protocol === 'file:' ? `No está ${ARCHIVO} junto a la página: vuelve a abrir la oficina con el iniciador (la reconstruye).` : 'No se pudo traer la vista de Tareas: revisa que la oficina siga abierta y vuelve a intentarlo.')); }
      s.onerror = () => fallo('red');
      s.onload = () => { clearTimeout(t); const x = window.AO_TAREAS; if (!x?.init) return fallo('red'); if (VERSION && x.version !== VERSION) { delete window.AO_TAREAS; return fallo('version'); } res(x); };
      document.head.appendChild(s);
    });
    return pedida;
  }
  async function open(o = {}) {
    if (abierta) { if (api && o.tarea) api.abrirTarea(o.tarea); return; }
    views.opening('tareas'); abierta = true; opener = document.activeElement;
    ov.inert = false; modal.open(ov); ov.classList.add('on'); document.body.classList.add('tvOpen');
    try {
      const m = await cargar();
      if (!abierta) return;
      if (!api) api = m.init(ov, { ...ctx, cerrar: () => close() });
      api.open(o);
    } catch (e) {
      ov.innerHTML = `<div class="tv-cargando-fuera" role="alert" style="padding:32px;max-width:560px"><p style="margin-bottom:12px">${String(e.message).replace(/</g, '&lt;')}</p><button type="button" class="tv-btn" data-reintentar style="min-height:34px;padding:0 14px;border-radius:10px;border:1px solid currentColor;background:none;color:inherit;cursor:pointer">Reintentar</button></div>`;
      ov.querySelector('[data-reintentar]').addEventListener('click', () => { ov.innerHTML = '<p class="tv-cargando-fuera" role="status">Cargando Tareas…</p>'; abierta = false; open(o); });
    }
  }
  function close(o = {}) {
    if (!abierta) return; abierta = false; api?.close();
    modal.close(ov); ov.inert = true; ov.classList.remove('on'); document.body.classList.remove('tvOpen');
    if (!o.quiet && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
  }
  views.add('tareas', { isOpen: () => abierta, close });
  // #tareas=… en la dirección (un enlace a una tarea, o volver a la página): se abre sola
  if (new URLSearchParams(location.hash.slice(1)).has('tareas')) setTimeout(() => open(), 600);
  return {
    open, close, toggle: () => (abierta ? close() : open()), isOpen: () => abierta,
    back: () => !!api?.back(), // Esc: el detalle, el formulario, el proyecto, la cifra… antes de cerrar la vista
    refresh: () => api?.refresh(),
    openTask: id => open({ tarea: id }),
    selection: () => (!abierta ? null : api ? api.selection() : { view: 'tareas', label: 'Tareas', kind: null }),
  };
}
