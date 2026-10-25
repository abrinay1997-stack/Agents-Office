// Agents Office (6 oct 2026, plan M3) — de DÓNDE sale la mejor hora: Metricool (su «best time», si está la key y la red lo tiene) o,
// si no, lo nuestro (las interacciones de lo ya publicado que guarda Analíticas). Lo de Metricool se recuerda 12 horas
// (data/contenido/mejores-horas.json) y, si Metricool falla, se usa lo último que dio. El cálculo es de src/contenido-hora.js (puro).
//   crearMejorHora({ metricool, metricas, archivo, ahora }) → { horas(redes) → { fuente, fuentes, grid, motivo } }
import fs from 'node:fs';
import path from 'node:path';
import { crearMejorHoraNucleo, CACHE_MS } from './mejor-hora-core.mjs';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
export { CACHE_MS };

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d)); renombrar(f + '.tmp', f); };

export function crearMejorHora({ metricool = null, metricas = null, archivo, ahora = Date.now } = {}) {
  return crearMejorHoraNucleo({ metricool, metricas, cache: { leer: () => leerJSON(archivo, {}), guardar: d => escribirJSON(archivo, d) }, ahora });
}
