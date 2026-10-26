// Versión móvil (25 oct 2026) — lo que comparten las pantallas del equipo B (Cerebro, Estudio, Buscar, Dimitri con imágenes): unos iconos más,
// la dirección de un archivo de la galería, el día en palabras y el aviso de «este teléfono es modesto». Puro salvo `modesto`.
import { svg, esc, ymd } from './ui.js';

const P = {
  clip: '<path d="m19 11.5-7 7a4.5 4.5 0 0 1-6.4-6.4l7.4-7.4a3 3 0 0 1 4.2 4.2l-7.3 7.3a1.5 1.5 0 0 1-2.1-2.1l6.6-6.6"/>',
  foto: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.3-2h5.4L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.3"/>',
  estrella: '<path d="m12 4.2 2.3 4.8 5.2.7-3.8 3.7.9 5.2L12 16l-4.6 2.6.9-5.2L4.5 9.7l5.2-.7z"/>',
  bajar: '<path d="M12 4.5v11M7 11l5 5 5-5M5 19.5h14"/>', subir: '<path d="M12 16.5v-11M7 10l5-5 5 5M5 19.5h14"/>',
  mapa: '<circle cx="6.5" cy="7" r="2"/><circle cx="17.5" cy="6.5" r="2"/><circle cx="12" cy="17" r="2"/><path d="m8.2 8.2 2.6 6.9M15.9 8.2l-2.7 6.9M8.5 7l7 -.3"/>',
  lista: '<path d="M8.5 7H20M8.5 12H20M8.5 17H20"/><circle cx="4.5" cy="7" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="17" r=".8"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>', nota: '<path d="M7 3.5h7.5L19 8v12a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h5M9.5 12h6M9.5 15.5h6"/>',
  nota_s: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>', varias: '<rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M5 15.5V7A2.5 2.5 0 0 1 7.5 4.5H16"/>',
  varita: '<path d="m5 19 9.5-9.5M14 6.5l.8-2 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8zM17.5 14l.6-1.5.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6z"/>',
  anim: '<rect x="3.5" y="9" width="17" height="10.5" rx="2"/><path d="m10.5 12.2 3.6 2.1-3.6 2.1z"/><path d="m3.8 9 15.4-4.2"/>',
  mas_c: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  carpeta: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/>',
};
/** svg de ui.js, o uno de aquí */
export const ic = (n, cls = '') => P[n] ? `<svg class="mv-i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n]}</svg>` : svg(n, cls);

/** La dirección de un archivo de la galería (id «2026-10/…svg»); `at` evita la caché de uno con el mismo nombre. */
export const mediaSrc = (f, at) => '/media/' + String(f).split('/').map(encodeURIComponent).join('/') + (at ? '?v=' + at : '');
export const esVideo = f => /\.(mp4|webm|mov)$/i.test(f || '');
export const esAudio = f => /\.(mp3|wav|flac|m4a|ogg)$/i.test(f || '');
export const esImagen = f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f || '');

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** «Hoy», «Ayer», «lunes 12 oct» */
export function diaTexto(ms, ahora = Date.now()) {
  const d = new Date(ms), k = ymd(d);
  if (k === ymd(new Date(ahora))) return 'Hoy'; if (k === ymd(new Date(ahora - 864e5))) return 'Ayer';
  return `${DIA[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}${d.getFullYear() !== new Date(ahora).getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
/** ¿Es un teléfono modesto para dibujar un mapa? (poca memoria o pocos núcleos, o «ahorro de datos») */
export function modesto(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  return (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) || !!(nav.connection && nav.connection.saveData);
}
export const sinTildes = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Un archivo del teléfono → data URL */
export const leerDataURL = f => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('No pude leer el archivo.')); fr.readAsDataURL(f); });
export { esc };
