// Idempotencia de las escrituras del conector (plan MCP §14.11): los clientes MCP reintentan, y una tarea o un cambio no debe duplicarse.
// Con `clave_idempotencia` la PRIMERA llamada reclama la clave (insert-if-absent: `guardarDoc(..., { espera: 0 })`, atómico en D1), hace el trabajo y apunta su resultado; la misma clave después
// devuelve ese resultado sin repetir el efecto. Si el trabajo falla, la clave se suelta (se puede reintentar); si se cayó a medias (queda «corriendo»), NO se rehace sola: podría haberse hecho.
// Sin clave, no hay nada que recordar. Cada clave vive en `docs` bajo `mcp.idem:<conexión>:<herramienta>:<clave>` y se poda a los 2 días (aquí mismo, de paso).
import { guardarDoc, leerDoc } from '../../almacen.js';

export const PREFIJO_IDEM = 'mcp.idem:';
const DOS_DIAS = 2 * 864e5;
const CORRIENDO_MS = 120_000;

async function podar(db) {
  try { await db.prepare("delete from docs where clave >= 'mcp.idem:' and clave < 'mcp.idem;' and actualizado < ?").bind(new Date(Date.now() - DOS_DIAS).toISOString()).run(); } catch { /* la poda nunca tumba una llamada */ }
}

/** `fn()` → texto o { texto }. Devuelve siempre { texto }. */
export async function conIdempotencia(db, { conexionId, herramienta, clave, ms, fn }) {
  const normal = async () => { const r = await fn(); return typeof r === 'string' ? { texto: r } : r; };
  if (!clave) return normal();
  const k = `${PREFIJO_IDEM}${conexionId}:${herramienta}:${clave}`;
  try { await guardarDoc(db, k, { estado: 'corriendo', at: ms }, { espera: 0 }); }
  catch (e) {
    if (!e?.conflicto) throw e;
    const { valor } = await leerDoc(db, k);
    if (valor?.estado === 'hecho') return { texto: `${valor.texto}\n\n(Esta misma llamada ya se había hecho con la clave «${clave}»: no se repitió.)` };
    if (valor?.estado === 'corriendo' && ms - (valor.at || 0) < CORRIENDO_MS) return { texto: 'Esa misma llamada sigue en curso: espera un momento y pregunta otra vez, sin repetirla.' };
    return { texto: `Una llamada anterior con la clave «${clave}» se interrumpió a medias. No la repito por si ya se hizo: mira la oficina y, si hace falta, usa otra clave.` };
  }
  let r;
  try { r = await normal(); }
  catch (e) { try { await db.prepare('delete from docs where clave = ?').bind(k).run(); } catch { /* la clave caduca sola */ } throw e; }
  // el efecto YA ocurrió: si apuntar «hecho» falla, no se falla la llamada ni se suelta la clave (queda «corriendo» y un reintento no repite nada)
  try { await guardarDoc(db, k, { estado: 'hecho', at: ms, texto: String(r.texto ?? '').slice(0, 6000) }); } catch (e) { console.warn('[mcp] no se pudo apuntar la clave de idempotencia:', e?.message ?? e); }
  await podar(db);
  return r;
}
