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
