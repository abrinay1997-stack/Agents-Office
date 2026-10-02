// Agents Office — images for Claude's own eyes (Dimitri's chat, V4.8). Pure: no file, no network.
//
// The page sends a reduced copy of each image (a canvas, ≤1568 px, JPEG): { file?: <gallery id>, media_type, data: <base64> }.
//   SDK  → messages: [{ role: 'user', content: sdkContent(text, images) }]
//   CLI  → `claude -p --input-format stream-json …` and cliInput(text, images) on stdin (Claude Code 2.1.286 takes exactly this line)
// The server never rescales (there is no sharp): what does not fit is refused with the reason.
export const VISION_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGES = 4;
export const MAX_B64 = Math.round(1.6 * 1024 * 1024); // 1.6 MB of base64 text per image (the page aims at ≤1.5 MB of JPEG before encoding)
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const MAGIC = { 'image/png': b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, 'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, 'image/webp': b => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' };

/** The images as Claude's content blocks, then the text (images first: Anthropic's advice for vision). */
export function sdkContent(text, images = []) {
  return [...images.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } })), { type: 'text', text: String(text ?? '') }];
}
/** One stream-json line for the CLI's stdin. */
export function cliInput(text, images = []) {
  return JSON.stringify({ type: 'user', message: { role: 'user', content: sdkContent(text, images) } }) + '\n';
}
/**
 * The list the page sent → { images: [{ file?, media_type, data }] } or { error } in plain Spanish.
 * Checked: at most 4, an allowed type, valid base64 (a data: URL prefix is taken off), ≤1.6 MB each, and bytes that are what the type says.
 */
export function validateVision(list) {
  if (list == null) return { images: [] };
  if (!Array.isArray(list)) return { error: 'las imágenes van como una lista' };
  if (list.length > MAX_IMAGES) return { error: `como mucho ${MAX_IMAGES} imágenes por mensaje` };
  const images = [];
  for (const [k, im] of list.entries()) {
    const n = k + 1;
    if (!im || typeof im !== 'object') return { error: `la imagen ${n} no tiene forma de imagen` };
    let data = typeof im.data === 'string' ? im.data.trim() : '', type = String(im.media_type || '');
    const du = data.match(/^data:([^;,]+);base64,/); if (du) { if (!type) type = du[1]; else if (du[1] !== type) return { error: `la imagen ${n} dice ser ${type} pero es ${du[1]}` }; data = data.slice(du[0].length); }
    if (!VISION_TYPES.includes(type)) return { error: `la imagen ${n} es ${type || 'de un tipo desconocido'}: solo JPEG, PNG o WebP` };
    if (!data) return { error: `la imagen ${n} viene vacía` };
    if (data.length > MAX_B64) return { error: `la imagen ${n} pesa demasiado (${(data.length / 1048576).toFixed(1)} MB; máx. 1,6 MB): redúcela antes de mandarla` };
    if (data.length % 4 !== 0 || !B64_RE.test(data)) return { error: `la imagen ${n} no es base64 válido` };
    if (!MAGIC[type](Buffer.from(data.slice(0, 24), 'base64'))) return { error: `la imagen ${n} no es un ${type.split('/')[1].toUpperCase()} de verdad` };
    const file = typeof im.file === 'string' && im.file ? im.file.slice(0, 300) : undefined;
    images.push({ ...(file ? { file } : {}), media_type: type, data });
  }
  return { images };
}
