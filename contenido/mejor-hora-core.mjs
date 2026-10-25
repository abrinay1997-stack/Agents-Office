// (NÚCLEO de la mejor hora, sin disco: lo usa contenido/mejor-hora.mjs —un archivo— y el Worker de Cloudflare —D1—.)
// Agents Office (6 oct 2026, plan M3) — de DÓNDE sale la mejor hora: Metricool (su «best time», si está la key y la red lo tiene) o,
// si no, lo nuestro (las interacciones de lo ya publicado que guarda Analíticas). Lo de Metricool se recuerda 12 horas
// (data/contenido/mejores-horas.json) y, si Metricool falla, se usa lo último que dio. El cálculo es de src/contenido-hora.js (puro).
//   crearMejorHora({ metricool, metricas, archivo, ahora }) → { horas(redes) → { fuente, fuentes, grid, motivo } }
import { cuadricula, deLoPublicado } from '../src/contenido-hora.js';
import { CON_MEJOR_HORA } from './metricool.mjs';

export const CACHE_MS = 12 * 3600e3;
const ymd = d => d.toISOString().slice(0, 10);

export function crearMejorHoraNucleo({ metricool = null, metricas = null, cache: almacen, ahora = Date.now } = {}) {
  // `almacen` { leer() → { <red>: { cuando, lista } }, guardar(d) } (síncronos o promesas): un archivo en la oficina local, D1 en el Worker.
  async function deMetricool(red) {
    if (!metricool?.configurado?.() || !CON_MEJOR_HORA.includes(red)) return null;
    const cache = (await almacen.leer()) ?? {}, c = cache[red];
    if (c && ahora() - c.cuando < CACHE_MS) return c.lista;
    try {
      const hoy = new Date(ahora()), luego = new Date(ahora() + 7 * 86400e3);
      const lista = await metricool.mejoresHoras(red, ymd(hoy), ymd(luego));
      const d = (await almacen.leer()) ?? {}; d[red] = { cuando: ahora(), lista }; await almacen.guardar(d);
      return lista;
    } catch { return c?.lista ?? null; } // Metricool caído: lo último que dio, si lo hay
  }

  async function horas(redes = []) {
    const porRed = {}, fuentes = {};
    let pubs = null;
    for (const r of redes) {
      const m = await deMetricool(r);
      if (m?.length) { porRed[r] = m; fuentes[r] = 'metricool'; continue; }
      pubs ??= await (async () => { try { return (await metricas?.leer?.({ dias: 90 }))?.publicaciones || []; } catch { return []; } })();
      const p = deLoPublicado(pubs, { red: r });
      if (p.length) { porRed[r] = p; fuentes[r] = 'propia'; }
    }
    const grid = cuadricula(porRed), usadas = [...new Set(Object.values(fuentes))];
    const fuente = !grid ? 'ninguna' : usadas.length === 1 ? usadas[0] : 'mixta';
    const motivo = grid ? '' : metricool?.configurado?.() ? 'Metricool no tiene todavía la mejor hora de estas redes y aún no hay 8 publicaciones tuyas en Analíticas para sacarla.' : 'Aún no hay con qué sugerir una hora: conecta Metricool (su «mejor hora») o espera a tener 8 publicaciones en Analíticas.';
    return { fuente, fuentes, grid, motivo };
  }
  return { horas };
}
