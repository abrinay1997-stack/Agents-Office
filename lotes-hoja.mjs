// Agents Office — el lote del Estudio: LEER LA ENTRADA (banco de presets F2, 1 oct 2026; docs/propuesta-banco-presets.md §6.1
// y §9). Un Excel o un CSV → filas; un ZIP → archivos. PURO salvo exceljs (y zlib para el ZIP): no toca la galería ni el disco.
// lotes.mjs junta lo que sale de aquí con la galería (subir las fotos incrustadas, buscar un nombre de archivo o un id).
//
// Las reglas que este archivo garantiza (tests/lotes-hoja.test.mjs):
//   · las columnas se emparejan solas por sinónimos (presets/columnas.json), sin mayúsculas ni tildes, y se pueden corregir;
//   · la foto de una fila se busca en este orden: una imagen INCRUSTADA en la fila, un nombre de archivo, un id de la galería,
//     una URL https (apagada por defecto: aquí solo se marca; lotes.mjs la baja si el dueño la encendió);
//   · NUNCA una ruta del disco (C:\…, \\servidor, /…, file:, ..): el Excel entero se rechaza con un 400 que nombra las filas;
//   · las notas entran como DATOS: pasan por safety.injectionIn y una nota con órdenes escondidas queda marcada (la fila no gasta);
//   · un ZIP se lee con topes (archivos, tamaño de cada uno y del total) para que no sea una bomba.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parseCSV, MAX_BYTES } from './documents.mjs';
import { injectionIn } from './safety.mjs';

export const CAMPOS = ['foto', 'sku', 'nombre', 'preset', 'canal', 'encuadre', 'medidas', 'notas'];
const IMG_EXT = ['png', 'jpg', 'jpeg', 'webp'];

let COLS = null;
/** Los sinónimos de presets/columnas.json: { campo: { es, sinonimos[] } }. */
export function columnas() {
  if (!COLS) { try { COLS = JSON.parse(fs.readFileSync(new URL('./presets/columnas.json', import.meta.url), 'utf8')).campos || {}; } catch { COLS = {}; } }
  return COLS;
}
/** minúsculas, sin tildes, solo letras y números separados por un espacio. */
export const normalizar = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Empareja las cabeceras con los campos. Cada pareja (campo, columna) puntúa: igual al sinónimo 100, empieza por él 50, lo
 *  contiene como palabra 20 («Notas de retoque» es de notas, no de preset). Gana lo más alto; cada columna sirve a un solo campo.
 *  → { foto: 0, sku: 2, nombre: null, … } */
export function emparejar(cabeceras, cols = columnas()) {
  const H = (cabeceras || []).map(normalizar), out = Object.fromEntries(CAMPOS.map(c => [c, null]));
  const sin = c => (cols[c]?.sinonimos || [c]).map(normalizar).filter(Boolean);
  const pares = [];
  CAMPOS.forEach((c, ci) => H.forEach((h, k) => {
    if (!h) return; let best = 0;
    for (const s of sin(c)) { const v = h === s ? 100 : (h + ' ').startsWith(s + ' ') ? 50 : (' ' + h + ' ').includes(' ' + s + ' ') ? 20 : 0; if (v > best) best = v; }
    if (best) pares.push({ c, k, v: best, ci });
  }));
  pares.sort((a, b) => b.v - a.v || a.k - b.k || a.ci - b.ci);
  const usadas = new Set();
  for (const p of pares) if (out[p.c] == null && !usadas.has(p.k)) { out[p.c] = p.k; usadas.add(p.k); }
  return out;
}
/** Las correcciones del dueño (el desplegable): { campo: índice | nombre de cabecera | null } encima de lo emparejado. */
export function corregir(auto, cabeceras, cambios = {}) {
  const out = { ...auto };
  for (const [c, v] of Object.entries(cambios || {})) {
    if (!CAMPOS.includes(c)) continue;
    if (v == null || v === '') { out[c] = null; continue; }
    const i = Number.isInteger(+v) && String(v).trim() !== '' && +v >= 0 && +v < cabeceras.length ? +v : cabeceras.map(normalizar).indexOf(normalizar(v));
    if (i < 0) continue;
    for (const k of CAMPOS) if (k !== c && out[k] === i) out[k] = null; // una columna, un campo
    out[c] = i;
  }
  return out;
}

/** ¿Es una ruta del disco? Nunca se aceptan (§6.1): C:\…, C:/…, \\servidor\…, /algo, ~/algo, file:…, o con «..». */
export const esRutaDisco = s => { const t = String(s ?? '').trim(); return /^[a-z]:[\\/]/i.test(t) || /^[\\/]{2}/.test(t) || /^\//.test(t) || /^~[\\/]/.test(t) || /^file:/i.test(t) || /(^|[\\/])\.\.([\\/]|$)/.test(t); };
const GALERIA_RE = /^\d{4}-\d{2}\/[^/\\]+\.(png|jpe?g|webp)$/i;
/** Qué trae la celda de la foto: { tipo: 'galeria'|'url'|'archivo'|'disco', valor } o null si está vacía. */
export function clasificarFoto(v) {
  const t = String(v ?? '').trim(); if (!t) return null;
  if (/^https?:\/\//i.test(t)) return { tipo: 'url', valor: t };
  if (esRutaDisco(t)) return { tipo: 'disco', valor: t };
  if (GALERIA_RE.test(t.replace(/\\/g, '/'))) return { tipo: 'galeria', valor: t.replace(/\\/g, '/') };
  const base = t.split(/[\\/]/).pop(); // «fotos/cama.jpg» → «cama.jpg»: solo se busca entre lo que el dueño subió
  return base ? { tipo: 'archivo', valor: base } : null;
}
/** La clave con la que se empareja un nombre de archivo: sin carpeta, sin extensión de imagen, normalizado. */
export const claveArchivo = s => normalizar(String(s ?? '').split(/[\\/]/).pop().replace(/\.(png|jpe?g|webp)$/i, ''));

/** ¿IP privada, de esta máquina o reservada? (contra el SSRF de una URL de Excel) */
export function ipPrivada(ip) {
  const s = String(ip || '').toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (v4) {
    const [a, b] = [+v4[1], +v4[2]];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (s.includes(':')) return s === '::' || s === '::1' || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s) || /^::ffff:/.test(s) || /^64:ff9b:/.test(s);
  return true; // lo que no se entiende, no pasa
}

/** «160x200x50», «160 × 50 × 200 cm», «1,6 x 0,5 x 2 m» → { ancho, alto, fondo } en cm (ancho × alto × fondo), o null. */
export function medidasDe(texto) {
  const t = String(texto ?? '').toLowerCase().replace(/,/g, '.');
  const m = /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)(?:\s*[x×*]\s*(\d+(?:\.\d+)?))?\s*(cm|m|mm)?/.exec(t);
  if (!m) return null;
  const k = m[4] === 'm' ? 100 : m[4] === 'mm' ? 0.1 : 1, n = x => (x == null ? null : Math.round(+x * k * 10) / 10);
  const [ancho, alto, fondo] = [n(m[1]), n(m[2]), n(m[3])];
  if (!(ancho > 0 && alto > 0) || ancho > 5000 || alto > 5000 || (fondo != null && !(fondo > 0 && fondo <= 5000))) return null;
  return { ancho, alto, ...(fondo ? { fondo } : {}) };
}

/** La columna «preset» de una fila: ids o nombres separados por «+», resueltos con el buscador. Nunca inventa: lo que no
 *  encuentra con claridad es un problema de la fila. → { pila: [{ id }], avisos: [], problemas: [] } */
export function resolverPresets(texto, presets = [], buscar = null) {
  const out = { pila: [], avisos: [], problemas: [] };
  const byId = new Map(presets.map(p => [p.id, p])), byNombre = new Map(presets.map(p => [normalizar(p.nombre), p]));
  for (const parte of String(texto ?? '').split('+').map(s => s.trim()).filter(Boolean).slice(0, 8)) {
    const p = byId.get(parte.toLowerCase()) || byNombre.get(normalizar(parte));
    if (p) { out.pila.push({ id: p.id }); continue; }
    const hits = typeof buscar === 'function' ? buscar(parte, presets, { max: 2 }) : [];
    const h = hits[0];
    if (h && h.score >= 4 && (!hits[1] || hits[1].score < h.score * 0.8)) { const q = byId.get(h.id); out.pila.push({ id: h.id }); out.avisos.push(`«${parte}» lo entendí como «${q?.nombre || h.id}»`); }
    else out.problemas.push(`no sé qué preset es «${parte}»${hits.length > 1 ? ` (¿${hits.slice(0, 2).map(x => byId.get(x.id)?.nombre || x.id).join('» o «')}?)` : ''}`);
  }
  return out;
}

/* ---------- leer la hoja ---------- */
const celda = v => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.hyperlink && /^https?:/i.test(v.hyperlink)) return String(v.hyperlink);
    if (v.text != null) return typeof v.text === 'object' && v.text.richText ? v.text.richText.map(r => r.text).join('') : String(v.text);
    if (v.result !== undefined) return String(v.result);
    if (v.richText) return v.richText.map(r => r.text).join('');
    return '';
  }
  return String(v);
};
const extDe = n => String(n || '').split('.').pop().toLowerCase();
const limpio = (s, n) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n);
const error400 = msg => Object.assign(new Error(msg), { status: 400 });

/** Las filas crudas de un .xlsx (exceljs) o un .csv, con las imágenes incrustadas por número de fila. */
async function crudo(nombre, buf) {
  const ext = extDe(nombre);
  if (ext === 'csv' || ext === 'txt') return { rows: parseCSV(buf.toString('utf8')).map((r, i) => ({ n: i + 1, cells: r })), imagenes: new Map() };
  if (ext !== 'xlsx') throw error400('el lote lee Excel (.xlsx) o CSV: guarda la hoja en uno de esos formatos');
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

/**
 * Un Excel o un CSV → filas. No crea nada.
 * opts: { columnas: correcciones { campo: índice|cabecera }, maxFilas (100), inyeccion (safety.injectionIn) }
 * → { cabeceras, columnas: { campo: índice|null }, filas: [{ n, foto, sku, nombre, preset, canal, encuadre, medidas, notas,
 *     inyeccion, problemas }], avisos }   foto: { tipo: 'incrustada'|'galeria'|'archivo'|'url', valor, ext?, data? } | null
 * Lanza un 400 si no hay cabeceras, si pasa del tope de filas o si alguna foto es una ruta del disco.
 */
export async function leerHoja(nombre, buf, opts = {}) {
  if (!Buffer.isBuffer(buf) || !buf.length) throw error400('la hoja llegó vacía');
  if (buf.length > MAX_BYTES) throw error400('la hoja pasa de 15 MB');
  const maxFilas = Math.max(1, +opts.maxFilas || 100), inyeccion = opts.inyeccion || injectionIn;
  const { rows, imagenes } = await crudo(nombre, buf);
  // la cabecera: de las 10 primeras filas, la que más columnas reconoce
  let cab = null, mejor = 0;
  for (const r of rows.slice(0, 10)) { const e = emparejar(r.cells); const k = Object.values(e).filter(v => v != null).length; if (k > mejor) { mejor = k; cab = r; } }
  if (!cab) throw error400('no encuentro la fila de cabeceras: pon arriba columnas como «foto», «sku», «nombre», «preset» o «notas»');
  const cabeceras = cab.cells.map(c => limpio(c, 60));
  const cols = corregir(emparejar(cabeceras), cabeceras, opts.columnas);
  const avisos = [];
  if (cols.foto == null && !imagenes.size) avisos.push('no hay columna de fotos ni imágenes en la hoja: las filas quedan sin foto');
  const val = (r, c) => (cols[c] == null ? '' : limpio(r.cells[cols[c]], c === 'notas' ? 1000 : 200));
  const datos = rows.filter(r => r.n > cab.n);
  const conImagen = [...imagenes.keys()].filter(n => n > cab.n && !datos.some(r => r.n === n)); // una fila con solo la foto pegada
  const todas = [...datos, ...conImagen.map(n => ({ n, cells: [] }))].sort((a, b) => a.n - b.n);
  const filas = [], disco = [];
  for (const r of todas) {
    const vacia = !r.cells.some(c => String(c).trim()) && !imagenes.has(r.n);
    if (vacia) continue;
    const f = { n: r.n, foto: null, sku: val(r, 'sku'), nombre: val(r, 'nombre'), preset: val(r, 'preset'), canal: val(r, 'canal'), encuadre: val(r, 'encuadre'), medidas: medidasDe(val(r, 'medidas')), notas: val(r, 'notas'), inyeccion: null, problemas: [] };
    const img = imagenes.get(r.n);
    const cel = clasificarFoto(val(r, 'foto'));
    if (cel?.tipo === 'disco') disco.push(r.n);
    if (img) f.foto = { tipo: 'incrustada', valor: `imagen de la fila ${r.n}`, ext: img.ext, data: img.data };
    else if (cel && cel.tipo !== 'disco') f.foto = cel;
    if (cel?.tipo === 'url' && !/^https:/i.test(cel.valor)) { f.foto = null; f.problemas.push('la URL no es https: no se baja'); }
    if (!f.foto && !f.problemas.length) f.problemas.push('sin foto');
    if (val(r, 'medidas') && !f.medidas) f.problemas.push(`no entiendo las medidas «${val(r, 'medidas')}» (escríbelas como ancho x alto x fondo en cm)`);
    if (f.notas) { const why = inyeccion(f.notas); if (why) f.inyeccion = why; }
    filas.push(f);
  }
  if (disco.length) throw error400(`${disco.length === 1 ? 'la fila' : 'las filas'} ${disco.slice(0, 8).join(', ')}${disco.length > 8 ? '…' : ''} ${disco.length === 1 ? 'trae' : 'traen'} una ruta del disco (C:\\…): nunca se aceptan. Pega la foto en la celda, pon solo el nombre del archivo y súbelo junto a la hoja, o usa el id de la galería`);
  if (filas.length > maxFilas) throw error400(`la hoja trae ${filas.length} filas y el tope del lote es ${maxFilas} (cámbialo en Ajustes → Estudio)`);
  if (!filas.length) throw error400('la hoja no trae ninguna fila debajo de las cabeceras');
  const iny = filas.filter(f => f.inyeccion).length; if (iny) avisos.push(`${iny} nota${iny === 1 ? '' : 's'} trae${iny === 1 ? '' : 'n'} órdenes escondidas: esas filas quedan para revisar y su nota no se usa`);
  return { cabeceras, columnas: cols, filas, avisos };
}

/** Lo que Dimitri recibe de una hoja (dentro de <datos>, nunca como órdenes): cabeceras, cuántas filas, 5 de muestra y las sin foto. */
export function resumenHoja(h) {
  const sinFoto = h.filas.filter(f => !f.foto).map(f => f.n);
  return {
    cabeceras: h.cabeceras, columnas: h.columnas, filas: h.filas.length,
    muestra: h.filas.slice(0, 5).map(f => ({ n: f.n, foto: f.foto ? { tipo: f.foto.tipo, valor: f.foto.valor } : null, sku: f.sku, nombre: f.nombre, preset: f.preset, canal: f.canal, encuadre: f.encuadre, notas: f.inyeccion ? '(nota con órdenes escondidas: no se usa)' : f.notas.slice(0, 160) })),
    sinFoto, avisos: h.avisos,
  };
}
/** La hoja sin los bytes de las imágenes (para mandarla a la página). */
export const sinBytes = h => ({ ...h, filas: h.filas.map(f => ({ ...f, foto: f.foto ? { tipo: f.foto.tipo, valor: f.foto.valor, ...(f.foto.ext ? { ext: f.foto.ext } : {}) } : null })) });

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
