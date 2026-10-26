// Versión móvil (25 oct 2026) — lo que comparten las pantallas de Contenido, Bandeja, «Crear publicación», Analíticas y Anuncios: iconos de
// red reales (src/redes-iconos.js), miniaturas, números y fechas en español y los botones con estado (src/accion.js → conEstado: ocupado →
// hecho ✓ | error + Reintentar). Nada de reglas propias: las reglas de las redes son las de contenido-reglas.js y las de dinero, las del servidor.
import { esc } from '../ui.js';
import { iconoRed } from '../../redes-iconos.js';
import { conEstado } from '../../accion.js';
import { mediaUrl } from '../../pieza-base.js';

export { esc, iconoRed, conEstado, mediaUrl };
export const NOMBRE_RED = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', tiktok: 'TikTok', threads: 'Threads', bluesky: 'Bluesky', pinterest: 'Pinterest', youtube: 'YouTube', messenger: 'Messenger', whatsapp: 'WhatsApp' };
const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pad = n => String(n).padStart(2, '0');
export const hoyYmd = (ahora = Date.now()) => { const d = new Date(ahora); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const sumaDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** «Hoy», «Mañana» o «vie 30 oct» */
export function diaTexto(f, ahora = Date.now()) {
  if (!f) return 'Sin día';
  if (f === hoyYmd(ahora)) return 'Hoy';
  if (f === sumaDias(hoyYmd(ahora), 1)) return 'Mañana';
  const d = new Date(`${f}T12:00:00`); return `${DOW[d.getDay()].slice(0, 3)} ${d.getDate()} ${MES[d.getMonth()]}`;
}
export function diaLargo(f) { const d = new Date(`${f}T12:00:00`); return Number.isNaN(d.getTime()) ? '' : `${DOW[d.getDay()]} ${d.getDate()} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][d.getMonth()]}`; }
export const numero = v => (v == null || !Number.isFinite(+v) ? '—' : +v >= 10000 ? (+v / 1000).toLocaleString('es', { maximumFractionDigits: 1 }) + ' mil' : (+v).toLocaleString('es', { maximumFractionDigits: 0 }));
export const horaTexto = h => (h ? h : 'sin hora');

/** Los iconos de las redes de una pieza (los reales), con su nombre para el lector de pantalla. */
export const redes = (lista = [], tam = 18) => `<span class="md-redes" role="img" aria-label="${esc(lista.map(r => NOMBRE_RED[r] || r).join(', '))}">${lista.map(r => iconoRed(r, { tam })).join('')}</span>`;

/** Una miniatura cuadrada: la imagen de la galería, o la del video (un cuadro con ▶), o un hueco con el icono de la red. */
export function miniatura(src, { clase = 'md-mini', alt = '' } = {}) {
  if (!src) return `<span class="${clase} vacia" aria-hidden="true"></span>`;
  const u = /^(https?:)?\/\/|^\//.test(String(src)) ? String(src) : mediaUrl(src);
  if (!u) return `<span class="${clase} vacia" aria-hidden="true"></span>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return `<span class="${clase} video" aria-hidden="true"><video src="${esc(u)}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video><i>▶</i></span>`;
  return `<span class="${clase}"><img src="${esc(u)}" alt="${esc(alt)}" loading="lazy" decoding="async"></span>`;
}

/** Un botón con estado (src/accion.js): `await con(b, () => api(...), { hecho: 'Listo' })`. Devuelve { ok, valor } | { ok:false, error }. */
export const con = (b, fn, o = {}) => conEstado(b, fn, { ms: 900, ...o });

/** Sube una foto o un video del teléfono a la galería del Estudio. Una foto se reduce (≤ 2048 px, JPEG): las del teléfono pesan 5–12 MB. */
export async function subirArchivo(api, file) {
  let data;
  if (/^image\//.test(file.type) && file.type !== 'image/gif') data = await reducir(file).catch(() => leer(file));
  else data = await leer(file);
  if (data.length > 34e6) throw new Error('El archivo es muy grande: sube uno de menos de 25 MB.');
  const r = await api('/api/media/upload', { method: 'POST', body: { name: file.name || 'subida', data } });
  return r.item;
}
const leer = f => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => mal(new Error('No pude leer el archivo.')); r.readAsDataURL(f); });
async function reducir(file, max = 2048) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('imagen')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); if (k === 1 && file.size < 4e6 && /jpe?g|png|webp/.test(file.type)) return await leer(file);
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  } finally { URL.revokeObjectURL(url); }
}

/** Un error de la API en una frase (con el motivo que dio el servidor, si lo dio). */
export const motivo = e => (e && (e.datos?.motivo || e.datos?.error || e.message)) || 'No se pudo.';

/** El texto de lo que se va a aprobar: cuándo sale y en qué redes (lo mismo que dice la hoja de «Aprobar» en todas las pantallas). */
export function resumenSalida(p) {
  const r = (p.redes || []).map(x => NOMBRE_RED[x] || x).join(', ') || 'ninguna red';
  return `${p.fecha ? diaTexto(p.fecha) : 'Sin día'}${p.hora ? ' a las ' + p.hora : ''} · ${r}`;
}
/** Aprobar una pieza: SIEMPRE con la hoja de confirmación (nadie sale con un toque suelto). Solo el dueño aprueba: el servidor lo vuelve a comprobar.
 *  → { ok: true, pieza } | { ok: false, error } | { ok: false, cancelado: true } */
export async function aprobarPieza(ctx, p, { pronto = false } = {}) {
  const errores = p.revision?.errores || [];
  if (errores.length) return { ok: false, error: errores[0] };
  const si = await ctx.confirmar({ titulo: pronto ? '¿Publicar ya?' : '¿Aprobar y programar?', texto: `${p.titulo || (p.texto || '').slice(0, 60) || 'Sin título'}\n${resumenSalida(p)}\n${pronto ? 'Sale en unos minutos.' : 'Sale a su hora. Antes puedes quitarla de la cola.'}`, ok: pronto ? 'Publicar ya' : 'Aprobar' });
  if (!si) return { ok: false, cancelado: true };
  try { const r = await ctx.api(`/api/contenido/piezas/${encodeURIComponent(p.id)}/aprobar`, { method: 'POST', body: pronto ? { pronto: true } : {} }); return { ok: true, pieza: r.pieza, avisos: r.avisos || [] }; }
  catch (e) { return { ok: false, error: (e.datos?.errores?.[0]) || motivo(e) }; }
}
