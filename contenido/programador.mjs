// Agents Office (6 oct 2026, plan M1) — el PROGRAMADOR: lleva lo aprobado al conductor (simulacro, Metricool) con su fecha y su hora,
// y luego mira qué pasó. La oficina decide; el conductor publica. Un tick por minuto (serve.mjs).
//
// Los candados (los tres, siempre):
//   1. la pieza está APROBADA por el dueño y no cambió después (su huella es la aprobada);
//   2. el modo lo deja: `apagado` no entrega nada; `simulacro` entrega al simulacro; `real`, al conductor elegido;
//   3. el conductor está listo (en `real`, con su key).
// Y además: nunca antes de un minuto tras aprobarla (para deshacer), ni antes de `entregarHorasAntes` horas de su salida (hasta entonces se
// edita sin límites), ni si su hora ya pasó o falta tan poco que no da tiempo (eso es «Vencida», con aviso).
//
// DOBLE TESTIGO (principio 4 de la propuesta): lo entregado se apunta en la cola (data/contenido/cola.json) Y en la cabecera de la nota
// (`entregada`). Si la cola se pierde, la nota impide entregar otra vez lo mismo: se adopta lo que ya está en el conductor.
//
// Si una pieza entregada se cambia o se devuelve (pierde el OK), se RETIRA del conductor; cuando se vuelva a aprobar, se entrega la nueva.
//   planear(piezas, entradas, opts) → [{ tipo, id, pieza? }]          (puro, con tests)
//   crearProgramador({ almacen, archivo, conductor, porId, modo, horasAntes, avisar, auditar, ahora })
//     → { tick, estado, salidaDe, reintentar, cancelar, entregarYa, refrescar }
// (8 oct 2026, F3) `porId(id)` da el conductor que entregó una pieza (para mirarla aunque el elegido haya cambiado) y `refrescar(id)` mira
// YA lo de ese conductor (Meta avisa al publicar: la pieza dice PUBLICADA en el acto, no a los 10 minutos).
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { crearNucleoProgramador, publica, reintentarEntrada, entregarYaEntrada, estadoDeCola } from './programador-core.mjs';
// Lo que decide (planear, los plazos) y el motor de la vuelta salieron a programador-core.mjs, sin disco: el Worker de Cloudflare usa el mismo.
export { planear, GRACIA_MS, MARGEN_MS, COMPROBAR_CADA_MS, COMPROBAR_HASTA_MS } from './programador-core.mjs';

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); renombrar(f + '.tmp', f); };

export function crearProgramador({ almacen, archivo, conductor, porId = null, modo = () => 'simulacro', horasAntes = () => 24, avisar = () => {}, auditar = () => {}, ahora = Date.now }) {
  const leer = () => leerJSON(archivo, { entradas: {} });
  const guardar = d => escribirJSON(archivo, d);
  const nucleo = crearNucleoProgramador({ almacen, cola: { leer, guardar }, conductor, porId, modo, horasAntes, avisar, auditar, ahora });
  return {
    tick: nucleo.tick,
    salidaDe: id => publica(leer().entradas?.[id]) || null,
    estado: () => estadoDeCola({ d: leer(), c: conductor(), modo: modo(), horasAntes: horasAntes(), ultimo: nucleo.ultimo() }),
    /** Volver a intentar lo que falló (desde el principio de su espera). */
    reintentar(id) { const d = leer(), r = reintentarEntrada(d.entradas?.[id], ahora()); if (r.ok) guardar(d); return r; },
    /** Entregar ya, sin esperar a `entregarHorasAntes` (desde ese momento, cambiarla depende de lo que deje el conductor). */
    entregarYa(id) { const d = leer(), r = entregarYaEntrada(d.entradas?.[id]); if (r.ok) guardar(d); return r; },
    /** Un conductor avisa de que algo salió o falló: se mira ya (en un tick, en fila con los demás: nunca dos a la vez). */
    refrescar: nucleo.refrescar,
    /** Quitar una pieza de la cola: se le quita el OK (vuelve a revisión) y el próximo tick la retira del conductor. */
    cancelar(id) { const r = almacen.devolver(id, 'revision'); return r.error ? r : { ok: true, pieza: r.pieza }; },
  };
}
