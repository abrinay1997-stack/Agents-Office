// @ts-check
// Entrada validada (plan §3.12, Fase 10.1): UN helper sin dependencias para leer el cuerpo de una petición con tope de tamaño y
// un 400/413 uniforme en español. Puro: sirve igual en la oficina local y en el Worker (que le pasan el texto ya leído, o una
// Request estándar a `leerCuerpoWeb`). Aún NO está enganchado a ninguna ruta: se empieza por las que gastan o envían
// (anuncios/accion, contenido/aprobar, sub/studio) en su propio cambio, con el test de cuerpos basura.
export const TOPE_CUERPO = 1_000_000; // bytes por defecto

/**
 * @typedef {{ tipo: 'string'|'number'|'boolean'|'array'|'object', requerido?: boolean, max?: number, min?: number, valores?: any[], largo?: number }} Campo
 * @typedef {{ ok: true, valor: Record<string, any> } | { ok: false, status: 400|413, error: string }} Resultado
 */

/** @param {string} texto  @param {Record<string, Campo>} [esquema]  @param {{ tope?: number }} [opts]  @returns {Resultado} */
export function validarCuerpo(texto, esquema = {}, opts = {}) {
  const tope = opts.tope ?? TOPE_CUERPO;
  if (typeof texto !== 'string') return { ok: false, status: 400, error: 'El cuerpo no es texto.' };
  if (Buffer.byteLength(texto) > tope) return { ok: false, status: 413, error: `El cuerpo es demasiado grande (máximo ${Math.round(tope / 1024)} KB).` };
  /** @type {any} */ let v;
  try { v = texto.trim() ? JSON.parse(texto) : {}; } catch { return { ok: false, status: 400, error: 'El cuerpo no es un JSON válido.' }; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, status: 400, error: 'El cuerpo debe ser un objeto JSON.' };
  for (const [nombre, c] of Object.entries(esquema)) {
    const x = v[nombre];
    if (x === undefined || x === null) { if (c.requerido) return { ok: false, status: 400, error: `Falta «${nombre}».` }; continue; }
    const tipo = Array.isArray(x) ? 'array' : typeof x;
    if (tipo !== c.tipo) return { ok: false, status: 400, error: `«${nombre}» debe ser ${ARTICULO[c.tipo]}.` };
    if (c.tipo === 'number' && !Number.isFinite(x)) return { ok: false, status: 400, error: `«${nombre}» debe ser un número finito.` };
    if (c.valores && !c.valores.includes(x)) return { ok: false, status: 400, error: `«${nombre}» no es un valor permitido.` };
    const medida = c.tipo === 'string' || c.tipo === 'array' ? x.length : c.tipo === 'number' ? x : null;
    if (medida !== null && c.max !== undefined && medida > c.max) return { ok: false, status: 400, error: `«${nombre}» es demasiado ${c.tipo === 'number' ? 'grande' : 'largo'} (máximo ${c.max}).` };
    if (medida !== null && c.min !== undefined && medida < c.min) return { ok: false, status: 400, error: `«${nombre}» es demasiado ${c.tipo === 'number' ? 'pequeño' : 'corto'} (mínimo ${c.min}).` };
  }
  return { ok: true, valor: v };
}
/** @param {number} tope @returns {Resultado} */
const DEMASIADO = tope => ({ ok: false, status: 413, error: `El cuerpo es demasiado grande (máximo ${Math.round(tope / 1024)} KB).` });
const ARTICULO = { string: 'un texto', number: 'un número', boolean: 'verdadero o falso', array: 'una lista', object: 'un objeto' };

/** Lee una Request estándar (Worker o fetch) con tope: corta en cuanto el cuerpo pasa del límite, sin cargarlo entero. */
export async function leerCuerpoWeb(/** @type {Request} */ req, /** @type {Record<string, Campo>} */ esquema = {}, opts = {}) {
  const tope = opts.tope ?? TOPE_CUERPO, declarado = Number(req.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > tope) return DEMASIADO(tope);
  const lector = req.body?.getReader(); if (!lector) return validarCuerpo('', esquema, opts);
  const trozos = []; let n = 0;
  for (;;) {
    const { done, value } = await lector.read(); if (done) break;
    n += value.byteLength; if (n > tope) { await lector.cancel().catch(() => {}); return DEMASIADO(tope); }
    trozos.push(value);
  }
  return validarCuerpo(new TextDecoder().decode(Buffer.concat(trozos)), esquema, opts);
}
