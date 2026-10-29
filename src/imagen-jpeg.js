// Fase 2 (CON-02/03/13): al SUBIR, lo que la galería no guarda (gif, avif, bmp, tiff, heic/heif) se pasa a JPEG en el navegador: orientación EXIF corregida,
// transparencia sobre blanco y lado largo ≤ 4096. Es una optimización para subidas manuales; el servidor lo repite si le llega uno (media/formatos-imagen.mjs).
// HEIC solo se abre donde el sistema lo lee (Safari); en los demás, un mensaje claro POR ARCHIVO.
import { EXT_A_CONVERTIR, SUBIDA_CONVERTIBLE, SUBIDA_SOLO_NAVEGADOR, nombreDe } from '../media/formatos-imagen.mjs';
export const necesitaJpeg = f => !!f && (!!SUBIDA_CONVERTIBLE[String(f.type || '').toLowerCase()] || !!SUBIDA_SOLO_NAVEGADOR[String(f.type || '').toLowerCase()] || EXT_A_CONVERTIR.test(String(f.name || '')));
export const nombreJpeg = n => (nombreDe(n).replace(/\.[^.]+$/, '') || 'foto') + '.jpg';
/** Lo que se dice cuando el navegador no puede abrir el archivo. */
export const noSePudo = (f, heic) => heic
  ? `«${f.name}» es HEIC y este navegador no lo abre: ábrela en Safari o expórtala como JPG desde Fotos.`
  : `«${f.name}» no se pudo abrir para pasarla a JPEG: el archivo parece dañado o no es una imagen.`;
const esHeic = f => /heic|heif/i.test(String(f.type || '')) || /\.(heic|heif)$/i.test(String(f.name || ''));
/** → un File JPEG (el original NO se toca) o lanza un Error con la causa real. `anchoMax` es el lado largo. */
export async function aJpegArchivo(f, { anchoMax = 4096, calidad = 0.92 } = {}) {
  let bmp; try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch { throw new Error(noSePudo(f, esHeic(f))); }
  const k = Math.min(1, anchoMax / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', calidad));
  if (!blob) throw new Error(noSePudo(f, false));
  return new File([blob], nombreJpeg(f.name), { type: 'image/jpeg', lastModified: f.lastModified });
}
