// EL registro ÚNICO de «deshacer» del conector (P6). Antes lo hacían a su manera la oficina (capa1), el Cerebro y la galería del Estudio; ahora todos apuntan y reclaman la clave por aquí.
// Una clave vive 10 minutos en `docs` (`mcp.undo:<clave>`, la poda diaria de mantenimiento.js los barre por rango de clave), es SOLO de quien hizo el cambio y se gasta al usarla.
// Cada clave lleva su DOMINIO: `est-…` es de la galería del Estudio, `cer-…` del Cerebro y las demás (sin prefijo) de la oficina (Dimitri/ops). Una clave NUNCA deshace lo de otro dominio, y probarla ahí NO la gasta:
// se dice a qué herramienta pertenece. El efecto de deshacer lo pone cada dominio; aquí solo está lo que no se debe repetir mal: dueño, vigencia, un solo uso atómico y reponer si falla.
import { guardarDoc, leerDoc } from '../almacen.js';
import { testigo } from '../ids.js';

export const PREFIJO_UNDO = 'mcp.undo:';
export const DESHACER_MS = 10 * 60e3;
const PREFIJOS = Object.freeze({ estudio: 'est-', cerebro: 'cer-', oficina: '' });
const HERRAMIENTA = Object.freeze({ estudio: 'galeria_cambiar con accion «deshacer»', cerebro: 'cerebro_cambiar con accion «deshacer»', oficina: 'la herramienta «deshacer»' });
const NOMBRE = Object.freeze({ estudio: 'la galería del Estudio', cerebro: 'el Cerebro', oficina: 'la oficina' });
export const DOMINIOS_DESHACER = Object.freeze(Object.keys(PREFIJOS));

/** El dominio al que pertenece una clave, por su prefijo. */
export const dominioDeClave = (k) => (k.startsWith('est-') ? 'estudio' : k.startsWith('cer-') ? 'cerebro' : 'oficina');
/** El dominio de lo guardado (las de antes de P6 no lo llevan: se deduce de su forma). */
const dominioDeValor = (v) => v.dominio || (v.cerebro ? 'cerebro' : v.t ? 'estudio' : 'oficina');
export const limpiarClave = (c) => String(c || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

/** Apunta cómo deshacer. → la clave, o null si no se pudo guardar (el efecto YA ocurrió: quien llama lo dice, pero no falla por eso). `ctx` = { db, ahoraMs, usuarioId }. */
export async function apuntar({ db, ahoraMs, usuarioId }, dominio, datos) {
  if (!(dominio in PREFIJOS)) throw new Error(`dominio de deshacer desconocido: ${dominio}`);
  const clave = PREFIJOS[dominio] + testigo(9);
  try { await guardarDoc(db, PREFIJO_UNDO + clave, { ...datos, dominio, at: ahoraMs, por: usuarioId }); return clave; }
  catch (e) { console.warn(`[mcp:${dominio}] no se pudo guardar la clave de deshacer:`, e?.message ?? e); return null; }
}

const VENCIDA = 'Esa clave ya no sirve: pasaron más de 10 minutos, ya se deshizo o no es tuya.';
/** Reclama una clave para deshacer. Lo hace atómico (borrar la fila): dos llamadas a la vez no deshacen dos veces.
 *  → { ok: true, valor, reponer } (si deshacer falla, `await reponer()` devuelve la clave: no se pierde la única forma de volver atrás) o { ok: false, texto } sin gastarla. */
export async function reclamar({ db, ahoraMs, usuarioId }, dominio, clave) {
  const k = limpiarClave(clave);
  if (!k) return { ok: false, texto: VENCIDA };
  const suyo = dominioDeClave(k);
  const cruce = (de) => ({ ok: false, texto: `Esa clave es de ${NOMBRE[de]}, no de ${NOMBRE[dominio]}: usa ${HERRAMIENTA[de]}.` });
  if (suyo !== dominio) return cruce(suyo);
  const { valor } = await leerDoc(db, PREFIJO_UNDO + k);
  if (!valor || ahoraMs - (valor.at || 0) > DESHACER_MS || valor.por !== usuarioId) return { ok: false, texto: VENCIDA };
  if (dominioDeValor(valor) !== dominio) return cruce(dominioDeValor(valor));
  const r = await db.prepare('delete from docs where clave = ?').bind(PREFIJO_UNDO + k).run();
  if (!r.meta?.changes) return { ok: false, texto: VENCIDA };
  const reponer = async () => { try { await guardarDoc(db, PREFIJO_UNDO + k, valor, { espera: 0 }); } catch { /* ya hay otra: no se pisa */ } };
  return { ok: true, valor, reponer };
}
