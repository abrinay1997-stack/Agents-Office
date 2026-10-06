// LOS DOS PANELES DEL ESTUDIO, a tu medida (pedido del dueño, 6 oct 2026): «el compositor de la izquierda solo se oculta o se muestra,
// no se puede ensanchar; el banco y el escenario 3D de la derecha, igual. Que su tamaño de ahora sea el más angosto y que se puedan
// ensanchar; y poder abrir el de la derecha en toda la ventana».
//   · Cada lado tiene un borde que se arrastra (ratón o dedo) o se mueve con el teclado (← → de 24 en 24, Inicio el más angosto,
//     Fin el más ancho); doble clic vuelve al más angosto. El ancho se recuerda en este navegador (ao.st.izq, ao.st.der).
//   · La izquierda sigue plegándose como siempre («Plegar»).
//   · La derecha (banco o escenario) se OCULTA sin cerrarse (una pestaña al borde la vuelve a mostrar) o se abre en TODA LA VENTANA.
// Solo con sitio (≥ 1100 px, como el panel al lado de la galería); más estrecho, el panel tapa la galería y no hay nada que arrastrar.
//   anchos(ancho de la vista, izq, der) → { izq, der }   (puro, con test: nunca deja la galería por debajo de su mínimo)
//   initPaneles({ el, store }) → { repintar() }

export const IZQ = { min: 420, max: 760 }; // el compositor: hoy mide 420 (su tamaño más angosto)
export const DER = { min: 460, max: 1100 }; // el banco y el escenario: hoy miden 460
export const GALERIA_MIN = 320, PASO = 24, DESDE = 1100;

const cerca = (v, a, b) => Math.min(b, Math.max(a, Math.round(Number(v) || a)));

/** Los anchos que caben: cada lado entre su mínimo y su máximo, y la galería con al menos GALERIA_MIN. */
export function anchos(total, izq, der, { conDer = true } = {}) {
  let i = cerca(izq, IZQ.min, IZQ.max), d = conDer ? cerca(der, DER.min, DER.max) : 0;
  const sobra = total - i - d - GALERIA_MIN;
  if (sobra < 0 && conDer) d = Math.max(DER.min, d + sobra); // primero cede la derecha, que es la que se acaba de abrir
  const sobra2 = total - i - d - GALERIA_MIN;
  if (sobra2 < 0) i = Math.max(IZQ.min, i + sobra2);
  return { izq: i, der: d };
}

export function initPaneles({ el, store }) {
  const body = el.querySelector('.st-body'), gal = el.querySelector('.st-gal'), gen = el.querySelector('.st-gen');
  let izq = store.get('izq', IZQ.min), der = store.get('der', DER.min);
  const ancho = () => body.getBoundingClientRect().width || window.innerWidth;
  const conSitio = () => window.innerWidth >= DESDE;

  const borde = (lado, etiqueta) => {
    const b = document.createElement('div');
    b.className = `st-rsz st-rsz-${lado}`; b.tabIndex = 0;
    b.setAttribute('role', 'separator'); b.setAttribute('aria-orientation', 'vertical'); b.setAttribute('aria-label', etiqueta);
    b.title = `${etiqueta}: arrastra para ensancharlo (← → con el teclado; doble clic, el más angosto)`;
    return b;
  };
  const bi = borde('izq', 'Ancho del compositor'); gen.appendChild(bi);
  const bd = borde('der', 'Ancho del panel'); gal.appendChild(bd);
  // los mandos del panel derecho van fuera de la hoja (el banco reescribe su contenido): ocultar y toda la ventana
  const mandos = document.createElement('div'); mandos.className = 'st-hmandos'; mandos.setAttribute('role', 'group'); mandos.setAttribute('aria-label', 'El panel');
  mandos.innerHTML = '<button type="button" data-h="max" aria-pressed="false" aria-label="Abrir en toda la ventana" title="Abrir en toda la ventana">⤢</button><button type="button" data-h="ocultar" aria-label="Ocultar el panel" title="Ocultar el panel (no se cierra: lo que tienes sigue)">⟩</button>';
  // van en la cabecera del panel, junto a su ✕; el banco reescribe su contenido, así que se vuelven a poner cada vez
  const ponerMandos = () => { const sh = gal.querySelector('.st-bank .bk-sh'); if (!sh || sh.contains(mandos)) return; sh.insertBefore(mandos, sh.querySelector('.bk-pri, .bk-x:last-child') || null); };
  const pestana = document.createElement('button'); pestana.type = 'button'; pestana.className = 'st-hver'; pestana.hidden = true;
  pestana.innerHTML = '⟨<span>Mostrar el panel</span>'; gal.appendChild(pestana);

  function repintar() {
    const hoja = el.classList.contains('st-hoja'), oculta = el.classList.contains('st-hoja-oculta'), max = el.classList.contains('st-hoja-max');
    const a = anchos(ancho(), izq, der, { conDer: hoja && !oculta && !max });
    el.style.setProperty('--st-izq', a.izq + 'px'); el.style.setProperty('--st-der', (a.der || der) + 'px');
    for (const [b, v, L] of [[bi, a.izq, IZQ], [bd, a.der || der, DER]]) { b.setAttribute('aria-valuenow', String(v)); b.setAttribute('aria-valuemin', String(L.min)); b.setAttribute('aria-valuemax', String(L.max)); b.setAttribute('aria-valuetext', `${v} píxeles`); }
    bi.hidden = !conSitio() || el.classList.contains('st-folded');
    bd.hidden = !conSitio() || !hoja || oculta || max;
    mandos.hidden = !hoja || oculta;
    pestana.hidden = !hoja || !oculta;
    mandos.querySelector('[data-h="max"]').setAttribute('aria-pressed', String(max));
    const bm = mandos.querySelector('[data-h="max"]'); bm.textContent = max ? '⤡' : '⤢';
    bm.title = max ? 'Volver a ponerlo al lado de la galería' : 'Abrir en toda la ventana'; bm.setAttribute('aria-label', bm.title);
    ponerMandos();
  }
  const guardar = () => { store.set('izq', izq); store.set('der', der); };
  const fijar = (lado, v) => { if (lado === 'izq') izq = cerca(v, IZQ.min, IZQ.max); else der = cerca(v, DER.min, DER.max); repintar(); guardar(); };

  function arrastre(b, lado) {
    b.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; e.preventDefault(); b.setPointerCapture?.(e.pointerId); el.classList.add('st-rsz-on');
      const x0 = e.clientX, v0 = lado === 'izq' ? izq : der;
      const mover = ev => { const dx = ev.clientX - x0; if (lado === 'izq') izq = cerca(v0 + dx, IZQ.min, IZQ.max); else der = cerca(v0 - dx, DER.min, DER.max); repintar(); };
      const soltar = () => { b.removeEventListener('pointermove', mover); el.classList.remove('st-rsz-on'); guardar(); window.dispatchEvent(new Event('resize')); };
      b.addEventListener('pointermove', mover); b.addEventListener('pointerup', soltar, { once: true }); b.addEventListener('pointercancel', soltar, { once: true });
    });
    b.addEventListener('dblclick', () => fijar(lado, lado === 'izq' ? IZQ.min : DER.min));
    b.addEventListener('keydown', e => {
      const L = lado === 'izq' ? IZQ : DER, v = lado === 'izq' ? izq : der, mas = lado === 'izq' ? 'ArrowRight' : 'ArrowLeft', menos = lado === 'izq' ? 'ArrowLeft' : 'ArrowRight';
      const n = e.key === mas ? v + PASO : e.key === menos ? v - PASO : e.key === 'Home' ? L.min : e.key === 'End' ? L.max : null;
      if (n === null) return; e.preventDefault(); e.stopPropagation(); fijar(lado, n);
    });
  }
  arrastre(bi, 'izq'); arrastre(bd, 'der');
  mandos.addEventListener('click', e => {
    const h = e.target.closest('[data-h]')?.dataset.h; if (!h) return;
    if (h === 'max') { el.classList.toggle('st-hoja-max'); repintar(); mandos.querySelector('[data-h="max"]').focus(); }
    if (h === 'ocultar') { el.classList.add('st-hoja-oculta'); el.classList.remove('st-hoja-max'); repintar(); pestana.focus(); }
    window.dispatchEvent(new Event('resize'));
  });
  pestana.addEventListener('click', () => { el.classList.remove('st-hoja-oculta'); repintar(); mandos.querySelector('[data-h="ocultar"]').focus(); window.dispatchEvent(new Event('resize')); });
  // al cerrar el panel (Listo, ✕, Esc), vuelve a su sitio: la próxima vez se abre al lado y a la vista
  new MutationObserver(() => { if (!el.classList.contains('st-hoja') && (el.classList.contains('st-hoja-oculta') || el.classList.contains('st-hoja-max'))) el.classList.remove('st-hoja-oculta', 'st-hoja-max'); repintar(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(ponerMandos).observe(gal, { childList: true, subtree: true });
  window.addEventListener('resize', () => { if (!el.hidden) repintar(); });
  repintar();
  return { repintar };
}
