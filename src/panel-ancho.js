// BORDE QUE SE ARRASTRA y reparto del ancho entre N paneles (Fase 3, 29 oct 2026). Sale de src/studio-paneles.js para que lo compartan
// el Estudio (compositor y banco) y Dimitri (src/dimitri-ancho.js): una sola manera de arrastrar, de usar el teclado y de recordar.
//   · ratón o dedo (pointer capture); teclado ← → de `paso` en `paso` (Inicio el más angosto, Fin el más ancho); doble clic = el más angosto;
//   · role="separator" con aria-valuenow/min/max; las teclas que atiende no suben (los atajos de una letra de la oficina no lo oyen).
//   cerca(v, a, b) · anchosN(total, paneles, centroMin) → { id: ancho }  (puro, con test)
//   bordeArrastrable({ clase, etiqueta, crece, min, max, get, set, paso, marca, alSoltar }) → HTMLElement

export const cerca = (v, a, b) => Math.min(b, Math.max(a, Math.round(Number(v) || a)));

/**
 * Reparte `total` entre paneles y un centro que no baja de `centroMin`.
 * `paneles`: [{ id, min, max, val }] en el ORDEN EN QUE CEDEN (el primero cede primero). Cada uno parte de `val` acotado a [min, max]
 * y, si no cabe, se achica hasta su `min` antes de pasar al siguiente. Si ni así cabe, los paneles quedan en su mínimo.
 */
export function anchosN(total, paneles, centroMin = 0) {
  const w = {};
  for (const p of paneles) w[p.id] = cerca(p.val, p.min, p.max);
  let falta = paneles.reduce((s, p) => s + w[p.id], 0) + centroMin - total;
  for (const p of paneles) {
    if (falta <= 0) break;
    const baja = Math.min(falta, w[p.id] - p.min);
    w[p.id] -= baja; falta -= baja;
  }
  return w;
}

const num = x => (typeof x === 'function' ? x() : x);

/**
 * Crea el borde (no lo coloca: lo añade quien lo llama donde lo necesite).
 *  crece: +1 si arrastrar a la derecha ENSANCHA el panel (su borde está a la derecha), −1 si lo achica.
 *  min, max: número o función (el máximo de Dimitri depende de la ventana). get/set: el ancho de ahora y cómo fijarlo (set recibe el valor ya acotado).
 *  marca: { el, clase } se pone mientras se arrastra (cursor y selección). alSoltar: al terminar un arrastre (guardar).
 */
export function bordeArrastrable({ clase, etiqueta, crece = 1, min, max, get, set, paso = 24, marca, alSoltar, ayuda }) {
  const b = document.createElement('div');
  b.className = clase; b.tabIndex = 0;
  b.setAttribute('role', 'separator'); b.setAttribute('aria-orientation', 'vertical'); b.setAttribute('aria-label', etiqueta);
  b.title = ayuda || `${etiqueta}: arrastra para cambiarlo (← → con el teclado; doble clic, el más angosto)`;
  const fijar = v => set(cerca(v, num(min), num(max)));
  b.addEventListener('pointerdown', e => {
    if (e.button !== 0) return; e.preventDefault(); b.setPointerCapture?.(e.pointerId);
    marca?.el.classList.add(marca.clase);
    const x0 = e.clientX, v0 = get();
    const mover = ev => fijar(v0 + crece * (ev.clientX - x0));
    const soltar = () => { b.removeEventListener('pointermove', mover); marca?.el.classList.remove(marca.clase); alSoltar?.(); };
    b.addEventListener('pointermove', mover); b.addEventListener('pointerup', soltar, { once: true }); b.addEventListener('pointercancel', soltar, { once: true });
  });
  b.addEventListener('dblclick', () => { fijar(num(min)); alSoltar?.(); });
  b.addEventListener('keydown', e => {
    const mas = crece > 0 ? 'ArrowRight' : 'ArrowLeft', menos = crece > 0 ? 'ArrowLeft' : 'ArrowRight', v = get();
    const n = e.key === mas ? v + paso : e.key === menos ? v - paso : e.key === 'Home' ? num(min) : e.key === 'End' ? num(max) : null;
    if (n === null) return; e.preventDefault(); e.stopPropagation(); fijar(n); alSoltar?.();
  });
  /** Pone al día los atributos de accesibilidad con el ancho de ahora. */
  b.pintar = (v, mn = num(min), mx = num(max)) => {
    b.setAttribute('aria-valuenow', String(v)); b.setAttribute('aria-valuemin', String(mn)); b.setAttribute('aria-valuemax', String(mx)); b.setAttribute('aria-valuetext', `${v} píxeles`);
  };
  return b;
}
