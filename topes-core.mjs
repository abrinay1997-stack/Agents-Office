// @ts-check
// Topes para el código NUEVO (plan §3.12, Fase 10.1). Puro: recibe el diff ya leído y dice qué rompe los topes.
// No toca lo que ya existe (serve.mjs, studio.js…): solo lo que un cambio añade.
export const TOPE_LINEA = 300;          // caracteres por línea añadida
export const TOPE_LINEAS_ARCHIVO = 800; // líneas de un archivo NUEVO de código
export const HOLGURA_RETOQUE = 40;     // cuánto puede crecer una línea larga ya existente al retocarla
export const TOPE_BYTES_ARCHIVO = 120 * 1024; // bytes de un archivo NUEVO de código

const CODIGO = /\.(m?js|cjs|css|html)$/;
const DATOS = /(^|\/)(dist|node_modules|fixtures|datos|data)\/|\.min\.|package-lock\.json$|(^|\/)src\/braingraph\.js$|higgsfield-schemas\.json$/;

export const esCodigo = ruta => CODIGO.test(ruta) && !DATOS.test(ruta);

/**
 * @param {{ruta:string, nuevo:boolean, lineasAnadidas:string[], lineasQuitadas?:string[], lineas?:number, bytes?:number}[]} archivos
 * @param {Record<string,string>} [excepciones] ruta → motivo
 * @returns {{ruta:string, motivo:string}[]}
 */
export function revisarTopes(archivos, excepciones = {}) {
  const fallos = [];
  for (const a of archivos) {
    if (!esCodigo(a.ruta) || excepciones[a.ruta]) continue;
    // Una línea larga que ya existía y solo se retoca (la quitada mide casi lo mismo) no cuenta: el tope es para lo que se AÑADE.
    const quitadas = a.lineasQuitadas || [];
    const largas = a.lineasAnadidas.filter(l => l.length > TOPE_LINEA && !(!a.nuevo && quitadas.some(q => q.length > TOPE_LINEA && l.length <= q.length + HOLGURA_RETOQUE))).length;
    if (largas) fallos.push({ ruta: a.ruta, motivo: `${largas} línea(s) añadida(s) de más de ${TOPE_LINEA} caracteres: pártelas` });
    if (a.nuevo && (a.lineas || 0) > TOPE_LINEAS_ARCHIVO) fallos.push({ ruta: a.ruta, motivo: `archivo nuevo de ${a.lineas} líneas (tope ${TOPE_LINEAS_ARCHIVO}): divídelo en módulos` });
    if (a.nuevo && (a.bytes || 0) > TOPE_BYTES_ARCHIVO) fallos.push({ ruta: a.ruta, motivo: `archivo nuevo de ${Math.round(a.bytes / 1024)} KB (tope ${TOPE_BYTES_ARCHIVO / 1024} KB)` });
  }
  return fallos;
}

/** Lee la salida de `git diff -U0 --no-color` y devuelve los archivos con sus líneas añadidas. */
export function leerDiff(texto) {
  const out = []; let cur = null;
  for (const l of texto.split('\n')) {
    if (l.startsWith('diff --git ')) { cur = { ruta: l.split(' b/').pop(), nuevo: false, lineasAnadidas: [], lineasQuitadas: [] }; out.push(cur); }
    else if (!cur) continue;
    else if (l.startsWith('new file mode')) cur.nuevo = true;
    else if (l.startsWith('+') && !l.startsWith('+++')) cur.lineasAnadidas.push(l.slice(1));
    else if (l.startsWith('-') && !l.startsWith('---')) cur.lineasQuitadas.push(l.slice(1));
  }
  return out;
}
