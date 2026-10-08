// El panel de una pieza de Contenido en la página (C1, 8 oct 2026): lo mínimo — un objeto con la misma forma que el editor de verdad
// (open, close, isOpen, current, flush, addMedios, refresh, repaintPreview) que trae dist/pieza-editor.js (build-pieza.mjs) la primera
// vez que hace falta, como la vista Tareas (src/tareas-carga.js). Contenido lo pide al abrirse (precargar), así que al hacer clic en una
// pieza suele estar ya aquí. Si no llega, el panel lo dice y ofrece «Reintentar». En file:// va junto a la página; servido, en /pieza-editor.js.
/* global __AO_PIEZA_VERSION__ */
export const VERSION = typeof __AO_PIEZA_VERSION__ === 'string' ? __AO_PIEZA_VERSION__ : '';
export const ARCHIVO = 'pieza-editor.js';

export function panelBajoDemanda(opts) {
  const { host } = opts;
  let real = null, pedida = null, intentos = 0, ultima = null;
  function cargar() {
    if (real) return Promise.resolve(real);
    if (window.AO_PIEZA?.init && (!VERSION || window.AO_PIEZA.version === VERSION)) { real = window.AO_PIEZA.init(opts); return Promise.resolve(real); }
    if (pedida) return pedida;
    intentos++;
    pedida = new Promise((res, rej) => {
      const s = document.createElement('script'); s.async = true;
      s.src = `${ARCHIVO}?v=${encodeURIComponent(VERSION || 'dev')}${intentos > 1 ? '&r=' + intentos : ''}`;
      const t = setTimeout(() => fallo('tiempo'), 30000);
      function fallo(causa) { clearTimeout(t); s.remove(); pedida = null; rej(new Error(causa === 'version' ? 'La página y el editor de piezas son de construcciones distintas: recarga la página (F5).' : location.protocol === 'file:' ? `No está ${ARCHIVO} junto a la página: vuelve a abrir la oficina con el iniciador (la reconstruye).` : 'No se pudo traer el editor de piezas: revisa que la oficina siga abierta y vuelve a intentarlo.')); }
      s.onerror = () => fallo('red');
      s.onload = () => { clearTimeout(t); const x = window.AO_PIEZA; if (!x?.init) return fallo('red'); if (VERSION && x.version !== VERSION) { delete window.AO_PIEZA; return fallo('version'); } real = x.init(opts); res(real); };
      document.head.appendChild(s);
    });
    return pedida;
  }
  async function open(p) {
    if (real) return real.open(p);
    ultima = p; host.hidden = false; host.classList.add('on'); host.innerHTML = '<p class="pz-cargando" role="status">Cargando la pieza…</p>';
    try { const r = await cargar(); if (ultima !== p) return; host.innerHTML = ''; return r.open(p); }
    catch (e) {
      if (ultima !== p) return;
      host.innerHTML = `<div class="pz-cargando" role="alert"><p>${String(e.message).replace(/</g, '&lt;')}</p><button type="button" class="pz-btn" data-reintentar>Reintentar</button> <button type="button" class="pz-lk" data-cerrar>Cerrar</button></div>`;
      host.querySelector('[data-reintentar]').addEventListener('click', () => open(p));
      host.querySelector('[data-cerrar]').addEventListener('click', () => close());
      host.querySelector('[data-reintentar]').focus();
    }
  }
  function close(o = {}) { if (real) return real.close(o); ultima = null; host.hidden = true; host.classList.remove('on'); host.innerHTML = ''; return Promise.resolve(); }
  return {
    open, close,
    isOpen: () => (real ? real.isOpen() : !host.hidden),
    current: () => real?.current() || null,
    flush: () => (real ? real.flush() : Promise.resolve()),
    addMedios: ids => real?.addMedios(ids),
    refresh: p => real?.refresh(p),
    repaintPreview: () => real?.repaintPreview(),
    precargar: () => cargar().catch(() => {}), // al abrir Contenido: cuando hagas clic en una pieza, ya estará
  };
}
