// Agents Office — lo que un guardado de tareas CUENTA: la bitácora (una línea por cambio) y los eventos del bus. Puro: lo comparten el almacén
// de archivos (almacen.mjs) y el de memoria que usa el Worker de Cloudflare (almacen-memoria.mjs), así las dos puertas cuentan igual.
import { normalizar } from './modelo.mjs';
import { diferencias, quienPorDefecto } from './cambios.mjs';

export const mesDe = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** antes: la lista guardada (cruda o normalizada) · list: la lista nueva · → { lineas, eventos }.
 *  Pone `version` en las tareas que cambiaron y borra la marca `_por` (quién guardó) de la lista. */
export function calcularGuardado(antesCrudo, list, { por = null, motivo = null, t0 = Date.now() } = {}) {
  const antes = (antesCrudo || []).map(normalizar); // normalizadas: la migración v1→v2 no cuenta como cambio
  const viejas = new Map(antes.map(t => [t.id, t])), lineas = [], eventos = [];
  for (const t of list) {
    const a = viejas.get(t.id); viejas.delete(t.id);
    const d = diferencias(a, t); if (!d.length) continue;
    if (a) t.version = Math.max(t.version || 1, (a.version || 1) + 1);
    const quien = por || t._por || quienPorDefecto(a, t);
    for (const x of d) lineas.push({ t: t0, tarea: t.id, por: quien, ...(motivo ? { motivo } : {}), ...x });
    if (!a) eventos.push(['tarea.creada', { tarea: t, por: quien }]);
    else {
      const est = d.find(x => x.tipo === 'estado'); if (est) eventos.push(['tarea.estado', { tarea: t, de: est.de, a: est.a, por: quien }]);
      eventos.push(['tarea.cambio', { tarea: t, antes: a, cambios: d, por: quien }]);
    }
  }
  for (const a of viejas.values()) { const quien = por || 'dueno'; lineas.push({ t: t0, tarea: a.id, por: quien, ...(motivo ? { motivo } : {}), tipo: 'borrada', titulo: String(a.title || '').slice(0, 200) }); eventos.push(['tarea.borrada', { tarea: a, por: quien }]); }
  for (const t of list) delete t._por;
  return { lineas, eventos };
}
