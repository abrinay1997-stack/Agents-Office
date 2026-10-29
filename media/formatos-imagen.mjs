// Fase 2 (CON-02/03/13) — UNA lista de formatos de imagen para toda la oficina (la página, la galería local, la de la nube, el aviso al aprobar y la conversión).
// Puro: sin Buffer ni disco (lo usan el navegador y el Worker). Quién hace qué:
//   · la GALERÍA guarda png, jpg y webp (y svg, solo la tarjeta de prueba del propio Estudio);
//   · el NAVEGADOR convierte a JPEG, al subir, lo que la galería no guarda (gif, avif, bmp, tiff y, donde el navegador lo lea, heic/heif) — `src/imagen-jpeg.js`;
//   · el SERVIDOR lo repite como respaldo (sharp en local, Cloudflare Images en la nube) si le llega uno de esos, salvo HEIC/HEIF (no sabe abrirlo);
//   · AL ENTREGAR a Instagram (solo acepta JPEG), png y webp se convierten en el conductor (el original no se toca; el derivado no es una tarjeta de la galería).
export const EN_GALERIA = ['png', 'jpg', 'jpeg', 'webp'];
export const CONVERTIBLES_AL_ENTREGAR = ['png', 'webp'];
/** Lo que el servidor puede abrir y pasar a JPEG si le llega tal cual, por tipo declarado. */
export const SUBIDA_CONVERTIBLE = { 'image/gif': 'gif', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/x-ms-bmp': 'bmp', 'image/tiff': 'tiff' };
/** Lo que ningún servidor nuestro abre (HEVC): solo el navegador, donde el sistema lo lea. */
export const SUBIDA_SOLO_NAVEGADOR = { 'image/heic': 'HEIC', 'image/heif': 'HEIF', 'image/heic-sequence': 'HEIC', 'image/heif-sequence': 'HEIF' };
export const EXT_A_CONVERTIR = /\.(gif|avif|bmp|tiff?|heic|heif)$/i;
const ascii = (b, a, z) => String.fromCharCode(...b.slice(a, z));
/** Los primeros bytes de cada formato que el servidor convierte (nunca se cree lo que diga el nombre). */
export const MAGIC_CONV = {
  gif: b => b.length > 6 && ascii(b, 0, 3) === 'GIF',
  avif: b => b.length > 12 && ascii(b, 4, 8) === 'ftyp' && /^(avif|avis)$/.test(ascii(b, 8, 12)),
  bmp: b => b.length > 2 && b[0] === 0x42 && b[1] === 0x4D,
  tiff: b => b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0) || (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0 && b[3] === 0x2A)),
};
export const extDe = n => (/\.([a-z0-9]+)$/i.exec(String(n || ''))?.[1] || '').toLowerCase();
export const nombreDe = n => String(n || '').split('/').pop();
export const esJpeg = n => /^jpe?g$/.test(extDe(n));
const VIDEO = /^(mp4|mov|m4v)$/;

/** Por qué la galería no guarda tal cual un archivo con este tipo declarado (o '' si sí lo guarda). */
export function motivoSubida(mime) {
  const m = String(mime || '').toLowerCase();
  if (SUBIDA_SOLO_NAVEGADOR[m]) return `${SUBIDA_SOLO_NAVEGADOR[m]} no se guarda tal cual y este servidor no sabe abrirlo: ábrela en un navegador que la lea (Safari) o expórtala como JPG desde Fotos.`;
  return '';
}

/**
 * Los avisos AL APROBAR una pieza (uno por archivo, CON-13): qué pasará con cada imagen que no es JPEG cuando vaya a Instagram.
 * `puedeConvertir` = el conductor sabe pasar png/webp a JPEG (sharp en local; el binding IMAGES en la nube). No depende de ningún binding concreto.
 */
export function avisosDeFormato(medios = [], { redes = [], puedeConvertir = true } = {}) {
  if (!redes.includes('instagram')) return [];
  const out = [];
  for (const m of medios) {
    const e = extDe(m), n = nombreDe(m);
    if (!e || esJpeg(m) || VIDEO.test(e)) continue;
    if (e === 'webm') out.push(`«${n}» es un video WebM y Instagram solo acepta MP4 o MOV: expórtalo en uno de esos.`);
    else if (e === 'svg') out.push(`«${n}» es un dibujo vectorial (SVG): Instagram no lo acepta y no se puede convertir. Usa una imagen JPG o PNG.`);
    else if (CONVERTIBLES_AL_ENTREGAR.includes(e)) out.push(puedeConvertir
      ? `«${n}» se convertirá a JPEG al publicar en Instagram (tu archivo original no se toca).`
      : `«${n}» no es JPEG y Instagram solo acepta JPEG: esta nube no puede convertirla (falta el binding IMAGES de Cloudflare) y a su hora fallaría. Súbela en JPEG o pídele al administrador que active IMAGES.`);
    else out.push(`«${n}» (${e.toUpperCase()}) no es JPEG y no sé convertirla: súbela en JPEG, o publícala solo en Facebook.`);
  }
  return out;
}

/**
 * Respaldo del servidor al SUBIR: si llega un gif/avif/bmp/tiff (data URL), lo pasa a JPEG con `aJpeg(bytes)`; lo demás (png, jpeg, webp, video, audio) sigue igual.
 * HEIC/HEIF se rechaza con motivo. → el mismo objeto `{ name, data, ... }`, con `convertida: nombreOriginal` si se convirtió.
 */
export async function prepararSubida(b, aJpeg, { max = 12 * 1024 * 1024 } = {}) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(b?.data || ''));
  if (!m) return b;
  const mime = m[1].toLowerCase(), duro = motivoSubida(mime); if (duro) throw new Error(duro);
  const ext = SUBIDA_CONVERTIBLE[mime]; if (!ext) return b;
  const bin = atob(m[2].replace(/\s+/g, '')), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length > max) throw new Error('la imagen pasa de 12 MB');
  if (!MAGIC_CONV[ext](bytes)) throw new Error('el archivo no es lo que dice ser');
  if (!aJpeg) throw new Error(`${ext.toUpperCase()} no se guarda tal cual y aquí no hay con qué convertirlo: súbelo como JPG o PNG.`);
  let out; try { out = await aJpeg(bytes); } catch (e) { throw new Error(`no pude convertir el ${ext.toUpperCase()} a JPEG: ${String(e?.message || e).slice(0, 120)}`); }
  let s = ''; for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return { ...b, name: String(b.name || 'subida').replace(/\.[^.]+$/, '') + '.jpg', data: `data:image/jpeg;base64,${btoa(s)}`, convertida: String(b.name || ext) };
}
