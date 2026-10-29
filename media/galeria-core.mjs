// Agents Office — el Estudio: lo PURO de la galería (25 oct 2026, fase 8a del puerto a Cloudflare).
// Sin archivos ni red: lo que la galería local (media/galeria.mjs, con fs) y la galería de la nube (cloudflare/worker/lib/estudio/,
// con R2 y D1) necesitan IGUAL — cómo se llama un archivo, qué es por sus primeros bytes, qué medidas tiene, qué subidas se aceptan,
// cómo se arma un .zip. tests/media-*.test.mjs y la foto de tests/media-fachada.test.mjs vigilan que lo local no cambió.
export const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'imagen';
/** width × height from the file header (png, jpg, webp, our svg) — the gallery lays out at the true ratio */
export function dims(b, ext) {
  try {
    if (ext === 'png' && b.readUInt32BE(12) === 0x49484452) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (ext === 'jpg') { let i = 2; while (i + 9 < b.length) { if (b[i] !== 0xFF) return null; const mk = b[i + 1]; if (mk >= 0xC0 && mk <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(mk)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } }
    if (ext === 'webp' && b.toString('ascii', 8, 12) === 'WEBP') { const t = b.toString('ascii', 12, 16); if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)]; if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; if (t === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; } }
    if (ext === 'svg') { const m = /width="(\d+)" height="(\d+)"/.exec(b.toString('utf8', 0, 400)); if (m) return [+m[1], +m[2]]; }
  } catch {}
  return null;
}
export const AUDIO_EXT = ['mp3', 'wav', 'flac', 'm4a', 'ogg']; // V4.10: MiniMax answers flac too; a voice to clone may come as m4a
export const kindOfExt = ext => (ext === 'mp4' || ext === 'webm' ? 'video' : AUDIO_EXT.includes(ext) ? 'audio' : 'image');
export const MONTH_RE = /^\d{4}-\d{2}$/;
export const FILE_RE = /^\d{4}-\d{2}\/[^/\\]+\.(png|jpe?g|webp|svg|mp4|webm|mp3|wav|flac|m4a|ogg)$/i; // V4.8: audio too, for Muse Spark to transcribe; V4.10: flac, m4a, ogg
export const cleanName = n => String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
/** The name of a new file: «AAAA-MM-DD <prompt> HHMMSS» (the caller adds «-2», «-3»… while a name is taken). The parts are those of the owner's day. */
export function nombreBase({ y, mo, d, h, mi, s }, prompt) {
  const p2 = x => String(x).padStart(2, '0'), sub = `${y}-${p2(mo)}`;
  return { sub, base: `${sub}-${p2(d)} ${slug(prompt)} ${p2(h)}${p2(mi)}${p2(s)}` };
}
export const BIN_RE = /^(\d{12,})-([^/\\]+)$/;
export const BIN_DAYS = 30;
/* uploads: the owner's own photos and videos, to use as a reference or a first frame (never svg: it could carry script) */
export const UPLOAD = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/flac': 'flac', 'audio/x-flac': 'flac', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a' }; // V4.8: mp3/wav, for transcribing; V4.10: flac, m4a (a voice to clone)
export const MAGIC = { png: b => b.length > 8 && b.readUInt32BE(0) === 0x89504E47, jpg: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF, webp: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP', mp4: b => b.toString('ascii', 4, 8) === 'ftyp', webm: b => b.length > 4 && b.readUInt32BE(0) === 0x1A45DFA3 , mp3: b => b.length > 3 && (b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)), wav: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE', flac: b => b.length > 4 && b.toString('ascii', 0, 4) === 'fLaC', m4a: b => b.length > 8 && b.toString('ascii', 4, 8) === 'ftyp' };
/** Qué es un archivo por sus PRIMEROS BYTES (no por lo que declare quien lo manda), o null. Un SVG solo si `svg` (la tarjeta de prueba). */
export function sniffExt(b, { svg = false } = {}) {
  if (!b || !b.length) return null;
  for (const e of ['png', 'jpg', 'webp', 'webm', 'wav', 'flac']) if (MAGIC[e](b)) return e;
  if (MAGIC.mp4(b)) return /M4A|M4B/.test(b.toString('ascii', 8, 12)) ? 'm4a' : 'mp4';
  if (MAGIC.mp3(b)) return 'mp3';
  if (svg && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(b.toString('utf8', 0, 300))) return 'svg';
  return null;
}
export const MEDIA_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', ogg: 'audio/ogg' };
/** Several files in one .zip (stored, not compressed: images and video are already compressed). files: [{ name, data: Buffer }] */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zipFiles(files, d = new Date()) {
  const dt = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dd = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const nm = Buffer.from(f.name, 'utf8'), crc = crc32(f.data), sz = f.data.length;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8); h.writeUInt16LE(dt, 10); h.writeUInt16LE(dd, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(sz, 18); h.writeUInt32LE(sz, 22); h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, nm, f.data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(dt, 12); c.writeUInt16LE(dd, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(sz, 20); c.writeUInt32LE(sz, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nm); off += 30 + nm.length + sz;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return { buf: Buffer.concat([...parts, cd, e]), count: files.length };
}

/* ---------- Carpetas en árbol (Fase 1.a, 29 oct 2026; plan §3.1) ----------
   Lo PURO, igual en la oficina local y en la nube: ninguna función toca disco ni base. Una carpeta es
   { id, name, parentId|null, orden, tipo?, color?, creadaPor?, creada?, loteId? }. La ruta se CALCULA al leer, nunca se guarda.
   Un archivo conserva su campo `folder` (el id de la carpeta hoja): ningún archivo se mueve en disco ni en R2.
   Un folders.json viejo ({id,name,at}) es válido: todas raíces, orden = su posición (migración perezosa). */
export const MAX_PROFUNDIDAD = 8;
export const MAX_CARPETAS = 500;        // con el árbol encendido
export const MAX_CARPETAS_PLANO = 200;  // el tope de siempre (flag apagado)
export const AVISO_CARPETAS = 490;
export const TIPOS_CARPETA = ['proyecto', 'carpeta', 'lote', 'carrusel'];
export const CREADA_POR = ['you', 'agent', 'dimitri', 'lote'];
/** Para comparar nombres: sin mayúsculas ni acentos. */
export const nombreClave = n => cleanName(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ORD = (a, b) => (a.orden - b.orden) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.id < b.id ? -1 : 1);

/** Completa lo que falta (padre, orden) y corrige lo imposible: un padre que no existe, que es ella misma o que forma un ciclo pasa a raíz. */
export function normalizarCarpetas(lista) {
  const l = (Array.isArray(lista) ? lista : []).map((f, i) => ({ ...f, parentId: f.parentId ?? null, orden: Number.isFinite(+f.orden) ? +f.orden : i }));
  const por = new Map(l.map(f => [f.id, f]));
  for (const f of l) if (f.parentId && (f.parentId === f.id || !por.has(f.parentId))) f.parentId = null;
  for (const f of l) { // un ciclo: se rompe en la carpeta donde se detecta
    let p = f.parentId, pasos = 0;
    while (p && pasos++ <= l.length) { if (p === f.id) { f.parentId = null; break; } p = por.get(p)?.parentId ?? null; }
  }
  return l;
}
/** Los hijos directos de una carpeta (null = raíz), en su orden. */
export const hijosDe = (lista, parentId = null) => lista.filter(f => (f.parentId ?? null) === (parentId ?? null)).sort(ORD);
/** La carpeta y todas las que cuelgan de ella. → Set de ids (vacío si no existe) */
export function descendientes(lista, id) {
  const out = new Set(); if (!lista.some(f => f.id === id)) return out;
  const hij = new Map(); for (const f of lista) { const p = f.parentId ?? null; if (!hij.has(p)) hij.set(p, []); hij.get(p).push(f.id); }
  const pila = [id]; while (pila.length) { const x = pila.pop(); if (out.has(x)) continue; out.add(x); for (const h of hij.get(x) || []) pila.push(h); }
  return out;
}
/** Los ids desde la raíz hasta la carpeta (ella incluida); [] si no existe. */
export function rutaIds(lista, id) {
  const por = new Map(lista.map(f => [f.id, f])), out = [];
  for (let x = id, n = 0; x && por.has(x) && n <= lista.length; x = por.get(x).parentId ?? null, n++) out.unshift(x);
  return por.has(id) ? out : [];
}
/** Cuántos niveles tiene el subárbol de una carpeta (ella sola = 1). */
export function alturaSubarbol(lista, id) {
  const hij = new Map(); for (const f of lista) { const p = f.parentId ?? null; if (!hij.has(p)) hij.set(p, []); hij.get(p).push(f.id); }
  const h = (x, vistos) => { if (vistos.has(x)) return 0; vistos.add(x); let m = 0; for (const c of hij.get(x) || []) m = Math.max(m, h(c, vistos)); return m + 1; };
  return h(id, new Set());
}
/** ¿Se puede poner `id` dentro de `nuevoPadre` (null = raíz)? → { ok:true } o { ok:false, codigo, error } */
export function validarMover(lista, id, nuevoPadre, max = MAX_PROFUNDIDAD) {
  const f = lista.find(x => x.id === id); if (!f) return { ok: false, codigo: 'no-existe', error: 'esa carpeta ya no existe' };
  const np = nuevoPadre || null;
  if (np && !lista.some(x => x.id === np)) return { ok: false, codigo: 'padre', error: 'la carpeta de destino ya no existe' };
  if (np && descendientes(lista, id).has(np)) return { ok: false, codigo: 'ciclo', error: 'no puedes meter una carpeta dentro de sí misma' };
  const base = np ? rutaIds(lista, np).length : 0;
  if (base + alturaSubarbol(lista, id) > max) return { ok: false, codigo: 'profundidad', error: `las carpetas llegan como mucho a ${max} niveles` };
  return { ok: true };
}
/** El nombre entre hermanos: único sin mayúsculas ni acentos. Con `auto`, uno repetido recibe « (2)», « (3)»… (lotes y agentes); si no, lanza. */
export function nombreEntreHermanos(lista, parentId, nombre, { excluir = null, auto = false } = {}) {
  const nm = cleanName(nombre); if (!nm) throw new Error('ponle un nombre a la carpeta');
  const usados = new Set(lista.filter(f => f.id !== excluir && (f.parentId ?? null) === (parentId ?? null)).map(f => nombreClave(f.name)));
  if (!usados.has(nombreClave(nm))) return nm;
  if (!auto) throw new Error(`ya hay una carpeta «${nm}»${parentId ? ' ahí dentro' : ''}`);
  for (let n = 2; n < 1000; n++) { const c = cleanName(`${nm.slice(0, 60 - String(n).length - 3).trim()} (${n})`); if (!usados.has(nombreClave(c))) return c; }
  throw new Error('no encontré un nombre libre para la carpeta');
}
/** El tope de carpetas: { ok, n, max, aviso? } */
export function topeCarpetas(n, arbol = true) {
  const max = arbol ? MAX_CARPETAS : MAX_CARPETAS_PLANO;
  return { ok: n < max, n, max, ...(arbol && n >= AVISO_CARPETAS && n < max ? { aviso: `ya hay ${n} de ${max} carpetas` } : {}) };
}
/** Una carpeta nueva con todos sus campos (los de lotes y agentes pasan por las opciones). */
export function carpetaNueva(lista, { id, name, parentId = null, tipo, color, creadaPor = 'you', loteId, ahora = Date.now(), auto = false } = {}) {
  const padre = parentId && lista.some(f => f.id === parentId) ? parentId : null; // un padre que no existe se trata como raíz
  if (padre && rutaIds(lista, padre).length >= MAX_PROFUNDIDAD) throw new Error(`las carpetas llegan como mucho a ${MAX_PROFUNDIDAD} niveles`);
  const nm = nombreEntreHermanos(lista, padre, name, { auto });
  const hermanos = hijosDe(lista, padre), orden = hermanos.length ? Math.max(...hermanos.map(h => h.orden)) + 1 : 0;
  return { id, name: nm, parentId: padre, orden, at: ahora, ...(TIPOS_CARPETA.includes(tipo) ? { tipo } : {}), ...(typeof color === 'string' && /^#[0-9a-f]{3,8}$/i.test(color) ? { color } : {}), creadaPor: CREADA_POR.includes(creadaPor) ? creadaPor : 'you', ...(loteId ? { loteId: String(loteId).slice(0, 60) } : {}) };
}
/** Pone `ids` (hijos de `parentId`) en ese orden; los demás hijos siguen detrás. → la lista nueva */
export function reordenar(lista, parentId, ids) {
  const hij = hijosDe(lista, parentId), ok = new Set(hij.map(h => h.id));
  const pedidos = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  if (pedidos.some(i => !ok.has(i))) throw new Error('una de las carpetas no está en ese nivel');
  const resto = hij.filter(h => !pedidos.includes(h.id)).map(h => h.id), orden = new Map([...pedidos, ...resto].map((i, k) => [i, k]));
  return lista.map(f => orden.has(f.id) && (f.parentId ?? null) === (parentId ?? null) ? { ...f, orden: orden.get(f.id) } : f);
}
/**
 * El árbol con sus recuentos, en UNA pasada O(archivos + carpetas). Devuelve las carpetas en orden de recorrido (cada una detrás de su padre):
 * { id, name, parentId, orden, tipo?, color?, creadaPor?, path:[ids], ruta:'A / B', profundidad, n (directo), nTotal (con las subcarpetas), hijos:[ids] }.
 * `n` es el de siempre (solo lo que está en esa carpeta). Un archivo cuya carpeta ya no existe no cuenta en ninguna.
 * `conteos` (Map id→n) sustituye a `items` cuando el recuento ya viene hecho (la nube lo saca con un group by).
 */
export function arbol(items, lista, { conteos = null } = {}) {
  const l = normalizarCarpetas(lista), por = new Map(l.map(f => [f.id, f]));
  const n = new Map(); if (conteos) { for (const [k, v] of conteos) if (por.has(k)) n.set(k, v); } else for (const it of items || []) if (it.folder && por.has(it.folder)) n.set(it.folder, (n.get(it.folder) || 0) + 1);
  const hij = new Map(); for (const f of l) { if (!hij.has(f.parentId)) hij.set(f.parentId, []); hij.get(f.parentId).push(f); }
  for (const v of hij.values()) v.sort(ORD);
  const out = [];
  const visita = (f, path, nombres) => {
    const p = [...path, f.id], nm = [...nombres, f.name], pos = out.length;
    out.push({ ...f, path: p, ruta: nm.join(' / '), profundidad: p.length, n: n.get(f.id) || 0, nTotal: 0, hijos: (hij.get(f.id) || []).map(h => h.id) });
    let t = out[pos].n; for (const h of hij.get(f.id) || []) t += visita(h, p, nm);
    out[pos].nTotal = t; return t;
  };
  for (const r of hij.get(null) || []) visita(r, [], []);
  return out;
}
/** Qué se llevaría borrar una carpeta con todo lo que tiene. → { carpetas:[ids], archivos:[file], subcarpetas, nArchivos } (lo que ya está en la papelera no cuenta) */
export function planBorrado(lista, items, id) {
  const set = descendientes(normalizarCarpetas(lista), id);
  const archivos = (items || []).filter(it => it.folder && set.has(it.folder)).map(it => it.file);
  return { carpetas: [...set], archivos, subcarpetas: Math.max(0, set.size - 1), nArchivos: archivos.length };
}
/** ¿Coincide lo que el dueño vio con lo que hay ahora? (así un cambio entre medias no borra de más) */
export const confirmaBorrado = (plan, c) => !!c && Number.isInteger(c.archivos) && Number.isInteger(c.subcarpetas) && c.archivos === plan.nArchivos && c.subcarpetas === plan.subcarpetas;
/** El mensaje que ve el dueño en el segundo toque. */
export const textoBorrado = (nombre, plan) => `Se borrará «${nombre}»${plan.subcarpetas ? ` con ${plan.subcarpetas} ${plan.subcarpetas === 1 ? 'subcarpeta' : 'subcarpetas'}` : ''}${plan.nArchivos ? `${plan.subcarpetas ? ' y' : ' con'} ${plan.nArchivos} ${plan.nArchivos === 1 ? 'archivo' : 'archivos'} (van a la papelera 30 días)` : ''}.`;
export const UNDO_CARPETA_MS = 30_000, UNDO_GRACIA_MS = 5_000;
