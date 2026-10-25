// Agents Office (8 oct 2026, C1) — lo PEQUEÑO de una pieza de Contenido que necesita la página entera: sus estados, formatos, redes, los
// iconos de formato y la miniatura. El editor (src/pieza.js, con su vista previa) va en un paquete aparte, dist/pieza-editor.js, que se trae la
// primera vez que se abre una pieza (src/pieza-carga.js): la página tiene su presupuesto (check.mjs) y el editor pesa lo suyo.
import { iconoRed } from './redes-iconos.js';
export const ESTADO = {
  idea: { name: 'IDEA', glyph: '◌', color: '#5A5A5A', dark: '#B9B6AE', help: 'Una idea suelta: todavía no es una publicación.' },
  borrador: { name: 'BORRADOR', glyph: '✎', color: '#8A6414', dark: '#E8B44A', help: 'Se está escribiendo.' },
  revision: { name: 'A REVISAR', glyph: '●', color: '#2158CC', dark: '#8FB0FF', help: 'Lista para que la mires y la apruebes.' },
  aprobada: { name: 'APROBADA', glyph: '✓', color: '#13705A', dark: '#4FD1A5', help: 'Aprobada por ti: puede salir.' },
};

export const FORMATO = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };

export const RED = { instagram: { name: 'Instagram' }, facebook: { name: 'Facebook' }, linkedin: { name: 'LinkedIn' }, x: { name: 'X' }, threads: { name: 'Threads' }, bluesky: { name: 'Bluesky' }, tiktok: { name: 'TikTok' }, pinterest: { name: 'Pinterest' }, youtube: { name: 'YouTube' } };
/** El LOGO de una red (nunca sus siglas) en su cajita de 16 px. Con `solo` (no hay su nombre escrito al lado) el logo lleva el nombre para el lector de pantalla; si no, es decorativo. */
export const nbRed = (red, { solo = false, clase = 'pz-nb' } = {}) => `<b class="${clase} ${red}"${solo ? '' : ' aria-hidden="true"'}>${iconoRed(red, solo ? { titulo: RED[red]?.name || String(red) } : {})}</b>`;

/** El icono de cada formato (trazos, el color del texto): en las tarjetas del calendario, la programación y el panel. */
export const FICON = {
  post: '<svg class="pz-fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>',
  carrusel: '<svg class="pz-fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3" width="9.5" height="10" rx="1.6"/><path d="M13 4.5v7M15 5.8v4.4"/></svg>',
  reel: '<svg class="pz-fi" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="1.5" width="10" height="13" rx="2.4"/><path d="M6.6 5.6v4.8l3.8-2.4z" class="fill"/></svg>',
  historia: '<svg class="pz-fi" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.8" stroke-dasharray="3.2 1.6"/><circle cx="8" cy="8" r="2.2"/></svg>',
};

export const HORAS_RAPIDAS = ['09:00', '12:30', '18:00', '20:00'];

export const mediaUrl = id => (typeof id === 'string' && !id.startsWith('demo/') ? '/media/' + id.split('/').map(encodeURIComponent).join('/') : null);

const esVideo = id => /\.(mp4|webm|mov)$/i.test(id || '');

export function thumbHTML(src, esc, cls = 'pz-th') {
  const u = mediaUrl(src);
  if (!u) return `<span class="${cls} ph" aria-hidden="true" style="--h:${[...String(src)].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}">${esVideo(src) ? '<i>▶</i>' : ''}</span>`;
  return esVideo(src) ? `<span class="${cls} vid" aria-hidden="true"><video src="${esc(u)}#t=0.1" preload="metadata" muted playsinline></video><i>▶</i></span>` : `<span class="${cls}" aria-hidden="true"><img src="${esc(u)}" alt="" loading="lazy" decoding="async" draggable="false"></span>`;
}
