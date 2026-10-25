// Agents Office (6 oct 2026, plan M1) — los CONDUCTORES: quién se lleva lo aprobado a las redes. La cola (contenido/programador.mjs) habla
// con una sola interfaz y no sabe cuál hay detrás:
//   { id, nombre, listo() → { ok, motivo }, programar(entrega) → { id, uuid, zona, redes }, retirar(remoto), estado(remoto) → { redes } | null }
//
//   · simulacro — no sale nada de esta máquina: «publica» a su hora en un archivo (data/contenido/simulacro.json). Es el modo por defecto,
//                 para probar todo el circuito sin arriesgar un perfil real (principio 7 de docs/propuesta-contenido-y-meta.md).
//   · metricool — sube los archivos a Metricool (Instagram solo acepta JPEG: las PNG y WebP se convierten antes) y programa la publicación con
//                 su fecha y su hora: Metricool la publica desde sus servidores, con esta computadora apagada.
//   · meta      — (8 oct 2026, F3) directo en Instagram y Facebook, sin Metricool: Facebook queda programado en Meta; Instagram (que no
//                 se programa por API) lo publica esta oficina a su hora. Vive en contenido/meta-publicar.mjs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { crearSimulacroNucleo, crearConductorMetricoolNucleo } from './conductores-core.mjs';

const leerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) ?? def; } catch { return def; } };
const escribirJSON = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(d, null, 1)); renombrar(f + '.tmp', f); };

/** El simulacro: todo el circuito, sin salir de esta máquina. */
export function crearSimulacro({ archivo, ahora = Date.now, fallan = () => [] } = {}) {
  return crearSimulacroNucleo({ almacen: { leer: () => leerJSON(archivo, { posts: {} }), guardar: d => escribirJSON(archivo, d) }, ahora, fallan, aleatorio: () => crypto.randomBytes(4).toString('hex') });
}

/**
 * Metricool. `rutaMedio(id)` da la ruta de un archivo del Estudio; `aJpeg(buffer)` lo convierte (sharp); `cache` es el archivo donde se
 * recuerda lo ya subido (por id y fecha de cambio), para no subir dos veces la misma imagen.
 */
export function crearConductorMetricool({ mc, rutaMedio, aJpeg, cache, cuentaValida = () => '' } = {}) {
  const medios = {
    info: async id => { const ruta = rutaMedio(id); if (!ruta || !fs.existsSync(ruta)) return null; return { version: fs.statSync(ruta).mtimeMs, nombre: path.basename(ruta) }; },
    datos: async id => fs.readFileSync(rutaMedio(id)),
  };
  return crearConductorMetricoolNucleo({ mc, medios, aJpeg, cache: { leer: () => leerJSON(cache, {}), guardar: d => escribirJSON(cache, d) }, cuentaValida });
}

/** Meta directo (F3, 8 oct 2026): contenido/meta-publicar.mjs. */
export { crearConductorMeta } from './meta-publicar.mjs';
