// LOS DOS PANELES DEL ESTUDIO, a tu medida (pedido del dueño, 6 oct 2026): «el compositor de la izquierda solo se oculta o se muestra,
// no se puede ensanchar; el banco y el escenario 3D de la derecha, igual. Que su tamaño de ahora sea el más angosto y que se puedan
// ensanchar; y poder abrir el de la derecha en toda la ventana».
//   · Cada lado tiene un borde que se arrastra (ratón o dedo) o se mueve con el teclado (← → de 24 en 24, Inicio el más angosto,
//     Fin el más ancho); doble clic vuelve al más angosto. El ancho se recuerda en este navegador (ao.st.izq, ao.st.der).
//     El borde es el de src/panel-ancho.js (el mismo que usa Dimitri).
//   · La izquierda sigue plegándose como siempre («Plegar»).
//   · La derecha (banco o escenario) se OCULTA sin cerrarse (una pestaña al borde la vuelve a mostrar) o se abre en TODA LA VENTANA.
// Fase 3 (29 oct 2026): «con sitio» se mide contra la VISTA (.st-body), no contra la ventana: Dimitri puede ocupar una parte. El banco va al
// lado de la galería solo si caben el compositor, el banco y una galería de GALERIA_MIN (DESDE = 1200); con menos, tapa la galería (hoja);
// con menos de PLEGAR_BAJO el compositor se pliega solo y vuelve a abrirse solo cuando hay sitio (lo que el dueño pliega o despliega a mano se respeta).
// `data-ancho` ("ancho" | "medio" | "estrecho") lo escribe un ResizeObserver sobre .st-body; no se usa container-type en #studioOv porque
// convertiría al overlay en el bloque contenedor de los menús `position:fixed` de src/studio.js (sus coordenadas son las de la ventana).
//   anchos(ancho de la vista, izq, der) → { izq, der }   (puro, con test: nunca deja la galería por debajo de su mínimo)
//   nivelAncho(ancho de la vista) → 'ancho' | 'medio' | 'estrecho'   (puro)
//   initPaneles({ el, store }) → { repintar() }

import { anchosN, bordeArrastrable } from './panel-ancho.js';

export const IZQ = { min: 420, max: 760 }; // el compositor: hoy mide 420 (su tamaño más angosto)
export const DER = { min: 460, max: 1100 }; // el banco y el escenario: hoy miden 460
export const GALERIA_MIN = 320, PASO = 24;
export const DESDE = IZQ.min + DER.min + GALERIA_MIN; // 1200
export const PLEGAR_BAJO = 740;

export const nivelAncho = w => (w >= DESDE ? 'ancho' : w >= PLEGAR_BAJO ? 'medio' : 'estrecho');

/** Los anchos que caben: cada lado entre su mínimo y su máximo, y la galería con al menos GALERIA_MIN. */
export function anchos(total, izq, der, { conDer = true } = {}) {
  // cede primero la derecha, que es la que se acaba de abrir, y luego el compositor
  const w = anchosN(total, [...(conDer ? [{ id: 'der', ...DER, val: der }] : []), { id: 'izq', ...IZQ, val: izq }], GALERIA_MIN);
  return { izq: w.izq, der: conDer ? w.der : 0 };
}

export function initPaneles({ el, store }) {
  const body = el.querySelector('.st-body'), gal = el.querySelector('.st-gal'), gen = el.querySelector('.st-gen');
  let izq = store.get('izq', IZQ.min), der = store.get('der', DER.min);
  const ancho = () => body.getBoundingClientRect().width || window.innerWidth;
  let nivel = null, plegadoSolo = false;
  const conSitio = () => nivel === 'ancho';
  const guardar = () => { store.set('izq', izq); store.set('der', der); };

  const borde = (lado, etiqueta, crece) => bordeArrastrable({
    clase: `st-rsz st-rsz-${lado}`, etiqueta, crece, paso: PASO, marca: { el, clase: 'st-rsz-on' },
    min: lado === 'izq' ? IZQ.min : DER.min, max: lado === 'izq' ? IZQ.max : DER.max,
    get: () => (lado === 'izq' ? izq : der), set: v => { if (lado === 'izq') izq = v; else der = v; repintar(); },
    alSoltar: () => { guardar(); window.dispatchEvent(new Event('resize')); },
  });
  const bi = borde('izq', 'Ancho del compositor', 1); gen.appendChild(bi);
  const bd = borde('der', 'Ancho del panel', -1); gal.appendChild(bd);
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
    bi.pintar(a.izq, IZQ.min, IZQ.max); bd.pintar(a.der || der, DER.min, DER.max);
    bi.hidden = nivel === 'estrecho' || el.classList.contains('st-folded'); // el compositor se ensancha mientras no esté plegado
    bd.hidden = !conSitio() || !hoja || oculta || max;
    mandos.hidden = !hoja || oculta;
    pestana.hidden = !hoja || !oculta;
    mandos.querySelector('[data-h="max"]').setAttribute('aria-pressed', String(max));
    const bm = mandos.querySelector('[data-h="max"]'); bm.textContent = max ? '⤡' : '⤢';
    bm.title = max ? 'Volver a ponerlo al lado de la galería' : 'Abrir en toda la ventana'; bm.setAttribute('aria-label', bm.title);
    ponerMandos();
  }
  // El nivel de ancho de la vista. Cruzar PLEGAR_BAJO hacia abajo pliega el compositor; hacia arriba lo despliega, si fue solo.
  function medir() {
    if (!body.getBoundingClientRect().width) return; // oculto: nada que medir
    const nuevo = nivelAncho(ancho()), estabaEstrecho = nivel === 'estrecho';
    nivel = nuevo; el.dataset.ancho = nuevo;
    if (nuevo === 'estrecho' && !estabaEstrecho && !el.classList.contains('st-folded')) { el.classList.add('st-folded'); plegadoSolo = true; }
    else if (nuevo !== 'estrecho' && estabaEstrecho && plegadoSolo) { el.classList.remove('st-folded'); plegadoSolo = false; }
    repintar();
  }
  // lo que se pliega o se despliega a mano deja de ser «solo»
  gen.addEventListener('click', e => { if (e.target.closest('.st-fold, .st-unfold')) plegadoSolo = false; }, true);
  new ResizeObserver(medir).observe(body);

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
  window.addEventListener('resize', () => { if (!el.hidden) medir(); });
  repintar();
  return { repintar };
}
