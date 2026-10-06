// CONFIRMAR UN GASTO con un segundo clic (auditoría del Estudio de imagen, IMG-11, 6 oct 2026). Antes era el confirm() del
// navegador: bloqueaba la página, no llevaba el estilo de la oficina y en algunos sistemas salía en inglés («OK / Cancel»).
// Ahora, desde US$0,50, el primer clic ARMA (el botón dice «Confirmar · US$0,64» unos segundos) y el segundo, dentro del plazo y
// para lo mismo, deja pasar. Puro, con test.
//   pedirOk(armado, clave, costo, ahora?, ventana?) → { ok, armado }
export const UMBRAL = 0.5;
export const VENTANA = 6000;
export function pedirOk(armado, clave, costo, ahora = Date.now(), ventana = VENTANA) {
  if (!(costo >= UMBRAL)) return { ok: true, armado: null };
  if (armado && armado.clave === clave && ahora - armado.at <= ventana) return { ok: true, armado: null };
  return { ok: false, armado: { clave, at: ahora } };
}
