// Agents Office (28 oct 2026) — las COPIAS que Claude puede ver de lo que lleva una publicación: la foto, o unos fotogramas de un video.
// El servidor no reduce nada (en la nube no hay sharp): el navegador dibuja cada imagen a lo más a 1568 px de lado largo, en JPEG, y por debajo de
// 1,5 MB (el servidor rechaza más de 1,6 MB: vision.mjs). Dimitri las usa con lo que adjuntas; «✨ Mejorar con Marketing» con lo que lleva la pieza.
//   Puro (se prueba sin navegador): fitWithin · shrinkStep · b64Bytes · tipoDeMedio · repartirFotogramas · tiemposDeFotogramas
//   Del navegador (canvas y <video>): copiaDeImagen · fotogramasDeVideo · copiasDeMedios
// Un video se «lee» por unos fotogramas repartidos por el clip: Claude ve imágenes, no oye el audio.
export const VISION_SIDE = 1568;                // Claude's vision gains nothing past this long side
export const VISION_BYTES = 1.5 * 1024 * 1024;  // each copy for the vision stays under 1.5 MB (the server refuses > 1.6 MB)
export const MAX_COPIAS = 4;                    // lo mismo que vision.mjs → MAX_IMAGES: como mucho 4 imágenes por petición
export const MAX_POR_VIDEO = 4;

/* ---------- pure: the size of a copy ---------- */
/** The size to draw an image at: its long side at most `max`, never upscaled. */
export function fitWithin(w, h, max = VISION_SIDE) {
  w = Math.max(1, Math.round(+w || 1)); h = Math.max(1, Math.round(+h || 1));
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: k < 1 };
}
/** One step of the reducer: null when `bytes` fits; else a lower JPEG quality, and once that is at its floor, a smaller picture. */
export function shrinkStep(t, bytes, limit = VISION_BYTES) {
  if (bytes <= limit) return null;
  if (t.q > 0.55) return { w: t.w, h: t.h, q: Math.round((t.q - 0.1) * 100) / 100 };
  return { w: Math.max(1, Math.round(t.w * 0.8)), h: Math.max(1, Math.round(t.h * 0.8)), q: 0.85 };
}
/** The bytes a base64 string carries (a data-URL's header is ignored). */
export const b64Bytes = s => { s = String(s || ''); const i = s.indexOf(','); if (s.startsWith('data:') && i > 0) s = s.slice(i + 1); const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0; return Math.max(0, Math.floor(s.length * 3 / 4) - pad); };

/* ---------- pure: qué se mira de una publicación ---------- */
/** 'imagen' (JPEG, PNG, WebP: lo que Claude acepta), 'video' (se lee por fotogramas) o null (un GIF, un audio, otra cosa). */
export const tipoDeMedio = id => { const x = String(id || '').split('?')[0].toLowerCase(); return /\.(jpe?g|png|webp)$/.test(x) ? 'imagen' : /\.(mp4|m4v|mov|webm)$/.test(x) ? 'video' : null; };

/**
 * Cómo se reparten las `max` imágenes que Claude puede ver entre los archivos de la pieza, EN ORDEN: cada uno de los primeros `max` aporta una (la foto,
 * o un fotograma del video) y lo que sobra son más fotogramas de los videos, de a uno por vuelta, hasta MAX_POR_VIDEO cada uno.
 * Un solo reel → 4 fotogramas; una foto y un video → la foto y 3 fotogramas; cinco fotos → las 4 primeras (`omitidos: 1`).
 * → { plan: [{ file, tipo, copias }], sinLeer: [{ file, motivo }], omitidos }
 */
export function repartirFotogramas(medios, max = MAX_COPIAS) {
  const items = [], sinLeer = [];
  for (const f of Array.isArray(medios) ? medios : []) {
    if (typeof f !== 'string' || !f) continue;
    const t = tipoDeMedio(f);
    if (t) items.push({ file: f, tipo: t }); else sinLeer.push({ file: f, motivo: 'no es una foto (JPEG, PNG o WebP) ni un video: Claude no puede mirarlo' });
  }
  const plan = items.slice(0, max).map(i => ({ ...i, copias: 1 }));
  const omitidos = Math.max(0, items.length - plan.length);
  let libres = max - plan.length;
  const videos = plan.filter(p => p.tipo === 'video');
  while (libres > 0 && videos.some(v => v.copias < MAX_POR_VIDEO)) for (const v of videos) if (libres > 0 && v.copias < MAX_POR_VIDEO) { v.copias++; libres--; }
  return { plan, sinLeer, omitidos };
}
/** Los segundos donde se toman `n` fotogramas de un clip de `duracion`: repartidos por el medio de n tramos iguales (nunca el primer ni el último instante, que suelen ser negros). */
export function tiemposDeFotogramas(duracion, n) {
  const d = Math.max(0, +duracion || 0), k = Math.max(1, Math.round(+n || 1));
  if (!d) return [0];
  const fin = Math.max(0, d - 0.1);
  return Array.from({ length: k }, (_, i) => Math.round(Math.min(fin, Math.max(Math.min(0.05, fin), d * (i + 0.5) / k)) * 1000) / 1000);
}

/* ---------- el navegador ---------- */
const sacar = d => ({ media_type: 'image/jpeg', data: d.slice(d.indexOf(',') + 1) });
/** Dibuja `fuente` (una imagen o un video con su tamaño) reducida a lo que cabe: JPEG ≤ 1568 px y ≤ 1,5 MB. Un PNG con transparencia queda sobre fondo blanco, no negro. */
function reducir(fuente, ancho, alto) {
  let t = { ...fitWithin(ancho, alto), q: 0.85 };
  for (let k = 0; k < 14; k++) {
    const c = document.createElement('canvas'); c.width = t.w; c.height = t.h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, t.w, t.h); g.drawImage(fuente, 0, 0, t.w, t.h);
    const d = c.toDataURL('image/jpeg', t.q), nx = shrinkStep(t, b64Bytes(d));
    if (!nx) return sacar(d);
    t = nx;
  }
  throw new Error('no pude reducirla para que Claude la vea');
}
const esperar = (el, ok, ms, motivo) => new Promise((res, rej) => {
  const fin = f => { clearTimeout(tm); el.removeEventListener(ok, onOk); el.removeEventListener('error', onErr); f(); };
  const onOk = () => fin(res), onErr = () => fin(() => rej(new Error(motivo))), tm = setTimeout(() => fin(() => rej(new Error(motivo))), ms);
  el.addEventListener(ok, onOk); el.addEventListener('error', onErr);
});

/** La copia de una imagen (su dirección) para Claude. */
export async function copiaDeImagen(url) {
  const img = new Image();
  const lista = new Promise((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('no pude abrir la imagen')); });
  img.src = url; await lista;
  return reducir(img, img.naturalWidth, img.naturalHeight);
}
/** `n` fotogramas de un video (su dirección), repartidos por el clip. Sin sonido: Claude ve los cuadros, no oye el audio. */
export async function fotogramasDeVideo(url, n = 1, { espera = 12000 } = {}) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
  try {
    v.src = url;
    await esperar(v, 'loadedmetadata', espera, 'no pude abrir el video');
    if (!(v.videoWidth > 0)) await esperar(v, 'loadeddata', espera, 'no pude abrir el video');
    // Safari del teléfono no baja datos de un video que no ha empezado: un play() mudo y breve (el toque del dueño lo permite) los pide. Si no deja, se sigue igual.
    try { await Promise.race([v.play(), new Promise(r => setTimeout(r, 1500))]); v.pause(); } catch { /* sin permiso: se intenta igual */ }
    const out = [];
    for (const t of tiemposDeFotogramas(v.duration, n)) {
      const visto = esperar(v, 'seeked', espera, 'no pude llegar a un cuadro del video');
      v.currentTime = t; await visto;
      out.push({ ...reducir(v, v.videoWidth, v.videoHeight), cuadro: t });
    }
    return out;
  } finally { try { v.removeAttribute('src'); v.load(); } catch { /* el elemento ya no se usa */ } }
}
/**
 * Lo que Claude va a ver de una pieza: de sus `medios` (ids de la galería), hasta `max` imágenes — fotos y fotogramas de sus videos.
 * `urlDe(id)` es la dirección del archivo; `cache` (un Map) guarda lo ya leído para no repetirlo en «Otra versión».
 * → { imagenes: [{ file, media_type, data, cuadro? }], fotos, fotogramas, videos, sinLeer: [{ file, motivo }], omitidos }
 */
export async function copiasDeMedios(medios, { max = MAX_COPIAS, urlDe, cache = new Map() } = {}) {
  const { plan, sinLeer, omitidos } = repartirFotogramas(medios, max);
  const imagenes = [], fallos = [...sinLeer]; let fotos = 0, fotogramas = 0, videos = 0;
  for (const p of plan) {
    const k = `${p.file}|${p.copias}`;
    try {
      let c = cache.get(k);
      if (!c) { const u = urlDe(p.file); if (!u) throw new Error('es un archivo de ejemplo: no se puede abrir aquí'); c = p.tipo === 'imagen' ? [await copiaDeImagen(u)] : await fotogramasDeVideo(u, p.copias); cache.set(k, c); }
      for (const x of c) imagenes.push({ file: p.file, ...x });
      if (p.tipo === 'imagen') fotos++; else { videos++; fotogramas += c.length; }
    } catch (e) { fallos.push({ file: p.file, motivo: e?.message || 'no pude leerlo' }); }
  }
  return { imagenes, fotos, fotogramas, videos, sinLeer: fallos, omitidos };
}
/** Una línea para el dueño: qué miró el agente («2 fotos y 3 cuadros de un video»). */
export function resumenDeLecturas(r, { vio = r?.imagenes?.length || 0 } = {}) {
  if (!vio) return '';
  const p = [];
  if (r.fotos) p.push(`${r.fotos} ${r.fotos === 1 ? 'foto' : 'fotos'}`);
  if (r.fotogramas) p.push(`${r.fotogramas} ${r.fotogramas === 1 ? 'cuadro' : 'cuadros'} de ${r.videos === 1 ? 'un video' : `${r.videos} videos`}`);
  return p.join(' y ');
}
/** El texto que se le pide al agente cuando el dueño pulsa «A partir de la foto» (o no escribió nada y la pieza solo tiene imagen). */
export const PIDE_DESDE_IMAGEN = 'Escríbelo a partir de lo que se ve: mira lo que lleva la publicación y cuéntalo con la voz de la marca, sin inventar nada que no se vea ni esté escrito.';
/**
 * Lo que se le cuenta al dueño después de una propuesta: qué miró de verdad el agente (lo dice el servidor) y lo que NO pudo mirar, sin disimular.
 * `prop`: la respuesta de /api/contenido/mejorar ({ vio, miro, vi, sinVer }); `sinLeer` y `omitidos`: lo que el navegador no pudo preparar; `que`: cómo llamar a lo que lleva la pieza.
 * → [{ tipo: 'vio' | 'aviso' | 'nota', texto }]
 */
export function avisosDeLectura(prop, { sinLeer = [], omitidos = 0, que = 'lo que lleva la publicación' } = {}) {
  const out = [];
  if (prop?.vio) out.push({ tipo: 'vio', texto: `Miró ${prop.miro || (prop.vio === 1 ? 'una imagen' : prop.vio + ' imágenes')}${prop.vi ? ': ' + prop.vi : '.'}` });
  if (prop?.sinVer) out.push({ tipo: 'aviso', texto: `No pudo mirar ${que}: ${prop.sinVer}. Esta propuesta sale solo del texto.` });
  for (const x of Array.isArray(sinLeer) ? sinLeer : []) out.push({ tipo: 'aviso', texto: `No pude leer «${String(x?.file || '').split('/').pop()}» para el agente: ${x?.motivo || 'no se pudo abrir'}.` });
  if (omitidos > 0) out.push({ tipo: 'nota', texto: `Solo caben ${MAX_COPIAS} imágenes: ${omitidos === 1 ? 'un archivo no se miró' : omitidos + ' archivos no se miraron'}.` });
  return out;
}
