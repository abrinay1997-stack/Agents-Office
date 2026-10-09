// La VISTA PREVIA de la oficina para un anuncio (Fase A3, 9 oct 2026; plan §5.A3 paso 5). La idea de src/contenido-preview.js, en
// pequeño y dentro del paquete de Anuncios (la página no la lleva): el feed (1:1 o 4:5) y la historia o el reel (9:16), con el texto
// principal cortado donde Meta pone «… Ver más», el titular, la descripción y el botón de la llamada a la acción. Puro y escapado: todo
// lo que escribe el dueño pasa por esc(). La vista previa de Meta es otra cosa (un <iframe> de facebook.com, ver borrador.iframeMeta).
import { esc } from './comun.js';
import { LLAMADA, LARGO } from './borrador.js';

const RATIO = { '1:1': '1 / 1', '4:5': '4 / 5', '9:16': '9 / 16' };
/** El texto como lo enseña Meta: hasta `max` letras y «… Ver más». → { corto, cortado } */
export function cortar(t, max = LARGO.texto) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return { corto: s, cortado: false };
  const c = s.slice(0, max), e = c.lastIndexOf(' ');
  return { corto: (e > max * 0.6 ? c.slice(0, e) : c).replace(/[\s.,;:]+$/, ''), cortado: true };
}
const dominio = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Un medio: imagen o video (sin reproducir solo), o un hueco que lo dice. */
function medioHTML(src, esVideo, alt) {
  if (!src) return '<span class="anu-pv-sin">Sin imagen todavía</span>';
  return esVideo ? `<video src="${esc(src)}#t=0.1" preload="metadata" muted playsinline aria-label="${esc(alt)}"></video>` : `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

/**
 * La vista previa de un creativo. `ubicacion`: 'feed' | 'historia'. `src`: la dirección de su imagen o video. `pagina`: el nombre que
 * firma. `enlace`: la web (para el dominio del pie). → HTML (un <figure>, sin botones de verdad: el CTA es un dibujo).
 */
export function previaHTML(cr = {}, { ubicacion = 'feed', src = null, esVideo = false, pagina = 'Tu página', enlace = '', n = 1 } = {}) {
  const llamada = LLAMADA[cr.llamada] || '', { corto, cortado } = cortar(cr.texto), alt = `Creativo ${n}`;
  if (ubicacion === 'historia') {
    const fuera = cr.formato && cr.formato !== '9:16';
    return `<figure class="anu-pv anu-pv-h" aria-label="Vista previa del creativo ${n} en historias y reels">
      <div class="anu-pv-hm">${medioHTML(src, esVideo, alt)}
        <div class="anu-pv-hcab"><span class="anu-pv-av" aria-hidden="true">${esc(String(pagina).slice(0, 1).toUpperCase())}</span><b>${esc(pagina)}</b><span>Publicidad</span></div>
        <div class="anu-pv-hpie">${corto ? `<p>${esc(cortar(cr.texto, 70).corto)}${cortar(cr.texto, 70).cortado ? '…' : ''}</p>` : ''}${llamada && cr.llamada !== 'NO_BUTTON' ? `<span class="anu-pv-hcta">↑ ${esc(llamada)}</span>` : ''}</div></div>
      ${fuera ? `<figcaption class="anu-pv-nota">Este creativo es ${esc(cr.formato)}: en historias Meta lo pone sobre un fondo o lo recorta. Para historias y reels, mejor uno 9:16.</figcaption>` : ''}</figure>`;
  }
  const ratio = RATIO[cr.formato === '9:16' ? '4:5' : cr.formato] || RATIO['1:1'];
  return `<figure class="anu-pv anu-pv-f" aria-label="Vista previa del creativo ${n} en el feed">
    <div class="anu-pv-cab"><span class="anu-pv-av" aria-hidden="true">${esc(String(pagina).slice(0, 1).toUpperCase())}</span><span><b>${esc(pagina)}</b><small>Publicidad</small></span></div>
    <p class="anu-pv-t">${corto ? esc(corto) : '<i>Aquí va tu texto principal.</i>'}${cortado ? '<span class="anu-pv-vm">… Ver más</span>' : ''}</p>
    <div class="anu-pv-m" style="aspect-ratio:${ratio}">${medioHTML(src, esVideo, alt)}</div>
    <div class="anu-pv-pie"><span class="anu-pv-pt">${dominio(enlace) ? `<small>${esc(dominio(enlace).toUpperCase())}</small>` : ''}<b>${esc(cr.titular || '')}</b>${cr.descripcion ? `<small>${esc(cr.descripcion)}</small>` : ''}</span>${llamada && cr.llamada !== 'NO_BUTTON' ? `<span class="anu-pv-cta">${esc(llamada)}</span>` : ''}</div>
    ${cr.formato === '9:16' ? '<figcaption class="anu-pv-nota">Este creativo es 9:16: en el feed Meta lo enseña recortado a 4:5.</figcaption>' : ''}</figure>`;
}
