// Agents Office (9 oct 2026) — LOS ICONOS DE LAS REDES SOCIALES: el logo real de cada red, en un solo sitio. Pedido del dueño: «que los
// iconos de las redes sean tal cual como son originalmente». Ningún otro archivo dibuja un logo de red: todos llaman a iconoRed().
// Procedencia: los trazados (24×24) son de Simple Icons (https://simpleicons.org, paquete simple-icons@15.0.0; LinkedIn de simple-icons@9.0.0,
// que la retiró después a petición de la marca), licencia CC0 1.0 (dominio público). Los colores son los de marca que publica Simple Icons;
// Instagram lleva su degradado (definido UNA vez en la página, #ao-ig) con su magenta de respaldo. X, Threads y TikTok son negros: van con
// currentColor, así en modo oscuro salen claros. Las marcas son de sus dueños; aquí solo dicen en qué red sale algo.
//   iconoRed(red, { tam = 16, titulo, monocromo } = {}) → '<svg …>' (decorativo, aria-hidden, salvo que se pida titulo: role="img" + <title>)
// (29 oct 2026: los trazados salieron al registro único src/iconos-registro.mjs; este archivo solo dibuja el <svg> de una red.)
//   REDES_CON_ICONO: las redes que tienen su logo; una desconocida recibe un globo genérico.

import { ICONOS } from './iconos-registro.mjs';

/* Los trazados viven en el registro único (src/iconos-registro.mjs): aquí solo se dibujan. */
const REDES = ['instagram', 'facebook', 'linkedin', 'x', 'threads', 'bluesky', 'tiktok', 'pinterest', 'youtube', 'whatsapp', 'messenger'];
/* Una red sin logo (o desconocida): un globo, del color del texto. */
const GENERICO = ['', 'M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm0 2c.9 0 2.3 2 2.9 6H9.1C9.7 5 11.1 3 12 3Zm-2.9.6C8.4 5 7.9 6.9 7.6 9H3.5a9 9 0 0 1 5.6-5.4Zm5.8 0A9 9 0 0 1 20.5 9h-4.1c-.3-2.1-.8-4-1.5-5.4ZM3.1 11h4.4a20 20 0 0 0 0 2H3.1a9 9 0 0 1 0-2Zm6.4 0h5a18 18 0 0 1 0 2h-5a18 18 0 0 1 0-2Zm7 0h4.4a9 9 0 0 1 0 2h-4.4a20 20 0 0 0 0-2Zm-13 4h4.1c.3 2.1.8 4 1.5 5.4A9 9 0 0 1 3.5 15Zm5.6 0h5.8c-.6 4-2 6-2.9 6s-2.3-2-2.9-6Zm7.3 0h4.1a9 9 0 0 1-5.6 5.4c.7-1.4 1.2-3.3 1.5-5.4Z'];

export const REDES_CON_ICONO = REDES.filter(r => ICONOS[r]);

/* El degradado de Instagram, una sola vez en la página (no display:none: un degradado escondido así no pinta en Chrome). */
const DEFS = '<svg id="ao-red-defs" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><radialGradient id="ao-ig" cx=".28" cy="1.05" r="1.2"><stop offset="0" stop-color="#FFD600"/><stop offset=".25" stop-color="#FF7A00"/><stop offset=".55" stop-color="#FF0069"/><stop offset=".8" stop-color="#D300C5"/><stop offset="1" stop-color="#7638FA"/></radialGradient></svg>';
const ponDefs = () => { try { if (typeof document !== 'undefined' && document.body && !document.getElementById('ao-red-defs')) document.body.insertAdjacentHTML('beforeend', DEFS); } catch { /* sin página: no hace falta */ } };

const escTitulo = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function iconoRed(red, { tam = 16, titulo, monocromo = false } = {}) {
  const id = String(red || '').toLowerCase(), e = REDES.includes(id) && ICONOS[id], [c0, c1] = e ? e.capas : [{ d: GENERICO[1], fill: '' }];
  if (e && e.placa) { const a = titulo ? `role="img" aria-label="${escTitulo(titulo)}"><title>${escTitulo(titulo)}</title>` : 'aria-hidden="true">'; return `<svg class="ao-red" width="${Math.max(14, Number(tam) || 16)}" height="${Math.max(14, Number(tam) || 16)}" viewBox="0 0 24 24" focusable="false" ${a}<rect width="24" height="24" rx="5" fill="${monocromo ? 'currentColor' : e.placa}"/><g transform="translate(4 4) scale(.67)" fill="none" stroke="${monocromo ? 'var(--bg,#fff)' : '#fff'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${c0.d}"/></g></svg>`; }
  const color = c0.degradado ? `url(#ao-ig) ${c0.fill}` : c0.fill, d = c0.d, encima = c1 && c1.d;
  if (c0.degradado && !monocromo) ponDefs();
  const fill = monocromo || !color ? 'currentColor' : color, n = Math.max(14, Number(tam) || 16);
  const a11y = titulo ? `role="img" aria-label="${escTitulo(titulo)}"><title>${escTitulo(titulo)}</title>` : 'aria-hidden="true">';
  return `<svg class="ao-red" width="${n}" height="${n}" viewBox="0 0 24 24" focusable="false" fill="${fill}" ${a11y}<path d="${d}"/>${encima && !monocromo ? `<path fill="#fff" d="${encima}"/>` : ''}</svg>`;
}
