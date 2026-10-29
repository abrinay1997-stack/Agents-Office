// La escala de la vista previa de la ventana de una pieza, como aritmética pura (sin DOM): la página mide, esto decide (CON-06, 29 oct 2026).
// Solo se escala la MAQUETA (`.pv-stage`); las pestañas Feed/Perfil/Facebook y el rótulo quedan a tamaño real. Piso de 0,75: si con eso no cabe,
// la columna hace scroll (antes bajaba hasta 0,4 y las pestañas de 13 px se quedaban en ~5 px). Tests: tests/ventana-escala.test.mjs.
export const MIN_ESCALA = 0.75, UMBRAL_PX = 8;

/**
 * @param {{ natural:number, cabecera:number, libre:number, actual?:number }} m
 *   natural: alto de la vista previa entera sin escalar · cabecera: lo que mide sin la maqueta (pestañas) · libre: lo que deja la columna ·
 *   actual: la escala que tiene ahora.
 * @returns {number} la escala nueva (1 = sin escalar). Un cambio de menos de UMBRAL_PX de alto se ignora (no hay temblor al repintar).
 */
export function escalaVista({ natural, cabecera = 0, libre, actual = 1 }) {
  const maqueta = natural - cabecera;
  if (!(maqueta > 0) || !(libre > 0) || natural <= libre) return snap(1, maqueta, actual);
  const z = Math.max(MIN_ESCALA, Math.min(1, +((libre - cabecera) / maqueta).toFixed(3)));
  return snap(z, maqueta, actual);
}
function snap(z, maqueta, actual) { return z === 1 || Math.abs(z - actual) * maqueta >= UMBRAL_PX ? z : actual; }
