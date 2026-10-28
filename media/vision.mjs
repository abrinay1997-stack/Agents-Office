// Agents Office (28 oct 2026) — la copia de una imagen de la galería que un agente MIRA (ver_imagen): un JPEG de lado largo ≤ 1568 px y ≤ 1,5 MB, sobre fondo blanco si era transparente.
// Solo en la oficina local (sharp). En el Worker no hay con qué reducir y se manda el original si pesa poco (ver-imagen-core.mjs).
import fs from 'node:fs';
import { LADO_MAX } from '../ver-imagen-core.mjs';

export const BYTES_MAX = 1.5 * 1024 * 1024;

/** Archivo de la galería → { media_type, data (base64), w, h, bytes, original: { w, h, bytes } }. Lanza Error en palabras si no se puede (sin sharp, un archivo roto). */
export async function copiaParaVer(archivo, { lado = LADO_MAX, limite = BYTES_MAX } = {}) {
  let sharp; try { sharp = (await import('sharp')).default; } catch { throw new Error('esta oficina no puede preparar imágenes (falta sharp: corre «npm install»)'); }
  const bytesOriginal = fs.statSync(archivo).size;
  let meta; try { meta = await sharp(archivo, { failOn: 'none' }).metadata(); } catch { throw new Error('el archivo no se pudo leer como imagen'); }
  const hacer = (ancho, q) => sharp(archivo, { failOn: 'none' }).rotate().resize({ width: ancho, height: ancho, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: q }).toBuffer({ resolveWithObject: true });
  let ancho = lado, q = 85, r = await hacer(ancho, q);
  for (let k = 0; r.data.length > limite && k < 14; k++) { if (q > 55) q -= 10; else { ancho = Math.max(64, Math.round(ancho * 0.8)); q = 85; } r = await hacer(ancho, q); }
  if (r.data.length > limite) throw new Error('no pude reducir la imagen lo bastante para mirarla');
  return { media_type: 'image/jpeg', data: r.data.toString('base64'), w: r.info.width, h: r.info.height, bytes: r.data.length, original: { w: meta.width || r.info.width, h: meta.height || r.info.height, bytes: bytesOriginal } };
}
