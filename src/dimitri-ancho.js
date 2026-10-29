// DIMITRI A TU MEDIDA (Fase 3, 29 oct 2026; DIM-05, DIM-07, DIM-08): el panel de la izquierda se ensancha arrastrando su borde, se PLIEGA
// a una pestaña sin cerrarse (el reloj y el chip «Viendo» siguen vivos) y se AMPLÍA a toda la pantalla.
//   · Fuente única del ancho: la variable CSS `--sub-w` (la escribe este módulo) → `body{--subW}` en src/css/dimitri.css. Las vistas se
//     corren con `--subW`; la oficina 3D (main.js → chatLeft) lee la medida real del evento `ao:sub-ancho` {w, plegado, ampliado}, nunca
//     el DOM en cada fotograma.
//   · Rango 340 – min(760, ventana − 480) (con una tableta, a la vista le quedan 480 px como mínimo). Se recuerda en `ao.sub.w`.
//   · El borde es el de src/panel-ancho.js (arrastrar, ← → de 24 en 24, Inicio, Fin, doble clic = el más angosto) y solo existe desde 900 px.
//   · Plegado: `body.subFold` (sigue siendo `subOpen`); ampliado: `body.subMax` + modal.open. Esc sigue cerrando. Al cerrar, todo vuelve a lo normal.
//   · En el teléfono (< 900 px o la versión móvil) Dimitri ya es pantalla completa: aquí no hay nada que hacer.
//   limitesAncho(ventana) → { min, max, def }   ·   initDimitriAncho({ el, modal }) → { alAbrir, alCerrar, desplegar, plegado, ampliado }

import { cerca, bordeArrastrable } from './panel-ancho.js';

export const SUB_MIN = 340, SUB_MAX = 760, SUB_VISTA_MIN = 480, SUB_PLEGADO = 44, SUB_CLAVE = 'ao.sub.w';

/** Lo que cabe según la ventana: mínimo, máximo (deja ≥ 480 px a la vista) y el de siempre (34 % de la ventana entre 340 y 440). */
export function limitesAncho(ventana) {
  const max = Math.max(SUB_MIN, Math.min(SUB_MAX, ventana - SUB_VISTA_MIN));
  return { min: SUB_MIN, max, def: cerca(ventana * 0.34, SUB_MIN, 440) };
}

const leer = () => { try { const v = Number(localStorage.getItem(SUB_CLAVE)); return v >= SUB_MIN ? v : null; } catch { return null; } };
const guardar = v => { try { if (v == null) localStorage.removeItem(SUB_CLAVE); else localStorage.setItem(SUB_CLAVE, String(v)); } catch {} };

export function initDimitriAncho({ el, modal }) {
  const body = document.body, root = document.documentElement;
  const mQ = matchMedia('(max-width: 899px)');
  let w = leer(); // null = el de siempre
  const util = () => !mQ.matches && !body.classList.contains('movil');
  const lim = () => limitesAncho(innerWidth);
  const efectivo = () => cerca(w ?? lim().def, lim().min, lim().max);
  const plegado = () => body.classList.contains('subFold'), ampliado = () => body.classList.contains('subMax');

  let ultima = -1;
  const emitir = () => {
    const medida = !body.classList.contains('subOpen') ? 0 : ampliado() ? innerWidth : plegado() ? SUB_PLEGADO : efectivo();
    ultima = medida;
    dispatchEvent(new CustomEvent('ao:sub-ancho', { detail: { w: medida, plegado: plegado(), ampliado: ampliado() } }));
  };
  const aviso = () => {
    emitir();
    for (const t of [30, 300]) setTimeout(() => dispatchEvent(new Event('resize')), t); // las vistas y el lienzo del Cerebro se ajustan al hueco
  };
  const pintar = () => {
    if (w == null) root.style.removeProperty('--sub-w'); else root.style.setProperty('--sub-w', efectivo() + 'px');
    borde.pintar(efectivo(), lim().min, lim().max);
  };

  const borde = bordeArrastrable({
    clase: 'sb-rsz', etiqueta: 'Ancho de Dimitri', crece: 1, min: () => lim().min, max: () => lim().max,
    get: efectivo, set: v => { w = v; pintar(); },
    alSoltar: () => { guardar(w); aviso(); },
    marca: { el: body, clase: 'sub-rsz-on' },
  });
  el.appendChild(borde);

  // plegar y ampliar: dos botones junto al ✕ y una pestaña vertical al borde cuando está plegado
  const x = el.querySelector('.sb-x');
  const bF = document.createElement('button'); bF.type = 'button'; bF.className = 'sb-fold'; bF.textContent = '⟨'; bF.setAttribute('aria-label', 'Plegar a una pestaña'); bF.title = 'Plegar a una pestaña (sigue abierto: lo que escribes no se pierde)';
  const bM = document.createElement('button'); bM.type = 'button'; bM.className = 'sb-max'; bM.textContent = '⤢'; bM.setAttribute('aria-pressed', 'false'); bM.setAttribute('aria-label', 'Ampliar a toda la pantalla'); bM.title = 'Ampliar a toda la pantalla';
  x?.before(bM, bF);
  const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'sb-ftab'; tab.innerHTML = '⟩<span>Dimitri</span>'; tab.setAttribute('aria-label', 'Desplegar a Dimitri'); tab.title = 'Desplegar a Dimitri';
  el.appendChild(tab);

  function plegar() {
    if (!util() || plegado()) return;
    if (ampliado()) reducir();
    const dentro = el.contains(document.activeElement);
    body.classList.add('subFold'); if (dentro) tab.focus(); aviso();
  }
  function desplegar(foco = true) {
    if (!plegado()) return;
    body.classList.remove('subFold'); aviso();
    if (foco) setTimeout(() => (el.querySelector('.sb-in textarea') || bF).focus(), 0);
  }
  function ampliar() {
    if (!util() || ampliado()) return;
    if (plegado()) body.classList.remove('subFold');
    body.classList.add('subMax'); bM.setAttribute('aria-pressed', 'true');
    bM.textContent = '⤡'; bM.setAttribute('aria-label', 'Volver al lado de la vista'); bM.title = 'Volver al lado de la vista';
    modal.open(el); el.setAttribute('aria-modal', 'true'); aviso();
  }
  function reducir() {
    if (!ampliado()) return;
    body.classList.remove('subMax'); bM.setAttribute('aria-pressed', 'false'); bM.textContent = '⤢'; bM.setAttribute('aria-label', 'Ampliar a toda la pantalla'); bM.title = 'Ampliar a toda la pantalla';
    if (!mQ.matches) { modal.close(el); el.removeAttribute('aria-modal'); }
    aviso();
  }
  bF.addEventListener('click', plegar);
  tab.addEventListener('click', () => desplegar());
  bM.addEventListener('click', () => { if (ampliado()) reducir(); else ampliar(); bM.focus(); });

  // abrir otra vista desde la barra mientras está ampliado: la vista nueva no puede quedar tapada
  const vistas = () => [...body.classList].filter(c => /Open$/.test(c) && c !== 'subOpen').sort().join(',');
  let firma = vistas();
  new MutationObserver(() => { const f = vistas(); if (f !== firma) { const nueva = f && f !== firma; firma = f; if (nueva && ampliado()) reducir(); } }).observe(body, { attributes: true, attributeFilter: ['class'] });

  let raf = 0;
  addEventListener('resize', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (!body.classList.contains('subOpen')) return; if (w != null) pintar(); if (!ampliado() && !plegado() && ultima !== efectivo()) emitir(); if (!util() && (plegado() || ampliado())) { reducir(); desplegar(false); } }); });
  mQ.addEventListener?.('change', () => { if (!util()) { if (ampliado()) reducir(); desplegar(false); } });
  pintar();

  return {
    alAbrir() { pintar(); aviso(); },
    alCerrar() { const m = ampliado(); body.classList.remove('subFold'); if (m) reducir(); else aviso(); },
    desplegar, plegado, ampliado,
  };
}
