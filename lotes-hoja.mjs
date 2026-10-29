// Agents Office — el lote del Estudio: LEER LA ENTRADA (banco de presets F2). Lo puro vive en lotes-hoja-core.mjs (compartido con la nube); aquí se le suman el Excel (.xlsx, con exceljs)
// y el ZIP de fotos (zlib), que un Worker no tiene. La API de siempre: lotes.mjs y los tests importan este archivo.
import fs from 'node:fs';
import zlib from 'node:zlib';
import * as core from './lotes-hoja-core.mjs';
import { celda, extDe, error400, IMG_EXT } from './lotes-hoja-core.mjs';
export * from './lotes-hoja-core.mjs';

// los sinónimos de columnas (presets/columnas.json), leídos de la carpeta
try { core.usarColumnas(JSON.parse(fs.readFileSync(new URL('./presets/columnas.json', import.meta.url), 'utf8'))); } catch { core.usarColumnas({}); }

/** Las filas crudas de un .xlsx (exceljs), con las imágenes incrustadas por número de fila. */
async function leerXlsx(buf) {
  const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch (e) { throw error400(`el Excel no se pudo abrir (${String(e.message).slice(0, 80)})`); }
  const ws = wb.worksheets.find(w => w.actualRowCount > 0 || (w.getImages?.() || []).length) || wb.worksheets[0];
  if (!ws) throw error400('el Excel no tiene hojas');
  const rows = []; ws.eachRow({ includeEmpty: false }, (r, n) => { rows.push({ n, cells: (Array.isArray(r.values) ? r.values : []).slice(1).map(celda) }); });
  const imagenes = new Map();
  for (const im of ws.getImages?.() || []) {
    const tl = im.range?.tl || {}, fila = Math.floor(+(tl.nativeRow ?? tl.row ?? -1)) + 1;
    if (fila < 1 || imagenes.has(fila)) continue;
    const media = wb.getImage(+im.imageId); if (!media?.buffer) continue;
    const e = String(media.extension || '').toLowerCase().replace('jpeg', 'jpg');
    if (!['png', 'jpg', 'webp'].includes(e)) continue;
    imagenes.set(fila, { ext: e, data: Buffer.from(media.buffer) });
  }
  return { rows, imagenes };
}

/** Un Excel o un CSV → filas (ver lotes-hoja-core.mjs). */
export const leerHoja = (nombre, buf, opts = {}) => core.leerHoja(nombre, buf, { ...opts, leerXlsx });

/* ---------- un ZIP de fotos (y quizá su hoja) ---------- */
/**
 * buf → [{ nombre, data }] de las imágenes y hojas que trae, sin carpetas ni archivos ocultos ni __MACOSX.
 * Topes: maxArchivos (200), maxArchivo (12 MB, el de una subida de imagen), maxTotal (400 MB). Lanza un 400 en palabras.
 */
export function leerZip(buf, { maxArchivos = 200, maxArchivo = 12 * 1024 * 1024, maxTotal = 400 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw error400('el ZIP llegó vacío');
  let eocd = -1; for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw error400('el archivo no es un ZIP');
  const total = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16);
  if (total > 2000) throw error400('el ZIP trae demasiados archivos');
  const out = []; let p = cdOff, suma = 0;
  for (let k = 0; k < total; k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw error400('el ZIP está dañado');
    const metodo = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + nl); p += 46 + nl + el + cl;
    const base = nombre.split('/').pop();
    if (!base || nombre.endsWith('/') || /(^|\/)__MACOSX\//.test(nombre) || base.startsWith('.')) continue;
    const ext = extDe(base);
    if (![...IMG_EXT, 'xlsx', 'csv'].includes(ext)) continue;
    if (out.length >= maxArchivos) throw error400(`el ZIP trae más de ${maxArchivos} fotos`);
    if (usize > maxArchivo) throw error400(`«${base}» pasa de ${Math.round(maxArchivo / 1048576)} MB`);
    suma += usize; if (suma > maxTotal) throw error400('el ZIP abierto pasa de 400 MB');
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw error400('el ZIP está dañado');
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), raw = buf.subarray(ini, ini + csize);
    let data;
    if (metodo === 0) data = Buffer.from(raw);
    else if (metodo === 8) { try { data = zlib.inflateRawSync(raw, { maxOutputLength: maxArchivo + 1 }); } catch { throw error400(`no pude abrir «${base}» dentro del ZIP`); } }
    else throw error400(`«${base}» va comprimido de una forma que no sé abrir`);
    if (data.length > maxArchivo) throw error400(`«${base}» pasa de ${Math.round(maxArchivo / 1048576)} MB`);
    out.push({ nombre: base, data });
  }
  return out;
}
