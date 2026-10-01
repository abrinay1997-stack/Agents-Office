// Banco de presets: los ICONOS. Cada uno es un solo trazo SVG (viewBox 0 0 24 24) en presets/iconos.json, dibujado con
// el estilo de los iconos del Estudio (I{} en src/studio.js): stroke="currentColor", sin relleno, trazo de 1,6 y extremos
// redondeados. Así toma el color del texto y pasa el contraste en claro y en oscuro sin colores propios. PURO.
//
//   iconoSVG(icono, { tam = 20, titulo = '', clase = '' }) → '<svg …><path d="…"/></svg>'
//      icono: { id, d } (el de un preset), un trazo «M…» o un id con `iconos` en las opciones
//   trazoDe(icono, iconos) → el `d`, o el del icono de reserva si no se conoce

export const RESERVA = 'M4 6h16v12H4zM8 10h8M8 14h5'; // una tarjeta con dos líneas: un preset sin icono propio
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PATH_RE = /^[Mm][MmLlHhVvCcSsQqTtAaZz0-9.,\s-]*$/;

export function trazoDe(icono, iconos = {}) {
  if (icono && typeof icono === 'object' && typeof icono.d === 'string') return PATH_RE.test(icono.d) ? icono.d : RESERVA;
  if (typeof icono === 'string' && PATH_RE.test(icono) && /\d/.test(icono)) return icono;
  if (typeof icono === 'string' && typeof iconos[icono] === 'string') return iconos[icono];
  if (icono && typeof icono === 'object' && typeof iconos[icono.id] === 'string') return iconos[icono.id];
  return RESERVA;
}

/** El SVG de un icono. Sin `titulo` es decorativo (aria-hidden): el nombre del preset va en el texto de la tarjeta. */
export function iconoSVG(icono, { tam = 20, titulo = '', clase = '', iconos = {} } = {}) {
  const d = trazoDe(icono, iconos), n = Math.max(8, Math.min(96, Number(tam) || 20));
  const a11y = titulo ? `role="img" aria-label="${esc(titulo)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg ${clase ? `class="${esc(clase)}" ` : ''}width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${titulo ? `<title>${esc(titulo)}</title>` : ''}<path d="${esc(d)}"/></svg>`;
}
