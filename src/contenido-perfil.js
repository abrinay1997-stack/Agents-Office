// Agents Office (6 oct 2026, plan M5 · U2) — la CUADRÍCULA DEL PERFIL de Instagram: así queda tu perfil con lo programado encima de lo
// ya publicado, a 3:4 (como lo enseña Instagram desde 2025), de lo más nuevo a lo más viejo. Se REORDENA arrastrando una casilla sobre
// otra (o con ‹ › desde el teclado): las dos piezas se cambian el día y la hora. Una aprobada que cambia de hora pierde el OK (la huella),
// y DESHACER lo devuelve. Solo piezas de Instagram que salen al feed (no las historias) y con imagen o video.
//   casillas(piezas, { hoy }) → [{ id, src, formato, fecha, hora, estado, pasada, etiqueta }]   (puro, con test)
//   intercambio(a, b) → [{ id, fecha, hora }, { id, fecha, hora }]                             (puro)
//   perfilHTML(casillas, { esc, mediaUrl, estados }) → el HTML

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corta = f => { const [, m, d] = String(f).split('-').map(Number); return `${d} ${MESES[m - 1]}`; };

export function casillas(piezas = [], { hoy = '' } = {}) {
  return piezas
    .filter(p => p && (p.redes || []).includes('instagram') && p.formato !== 'historia' && (p.medios || []).length && p.fecha && p.estado !== 'idea')
    .sort((a, b) => `${b.fecha} ${b.hora || '99:99'}`.localeCompare(`${a.fecha} ${a.hora || '99:99'}`))
    .map(p => {
      const pasada = !!hoy && p.fecha < hoy;
      const sal = p.salida?.estado;
      const etiqueta = sal === 'publicada' ? 'PUBLICADA' : pasada ? 'PASADA' : p.estado === 'aprobada' ? `SALE ${corta(p.fecha).toUpperCase()}` : `${(p.estado === 'revision' ? 'A REVISAR' : 'BORRADOR')} · ${corta(p.fecha).toUpperCase()}`;
      return { id: p.id, src: p.medios[0], formato: p.formato, fecha: p.fecha, hora: p.hora || '', estado: p.estado, pasada: pasada || sal === 'publicada', etiqueta, titulo: p.titulo || '' };
    });
}

/** Cambiar dos de sitio: cada una se queda con el día y la hora de la otra. */
export const intercambio = (a, b) => [{ id: a.id, fecha: b.fecha, hora: b.hora }, { id: b.id, fecha: a.fecha, hora: a.hora }];

export function perfilHTML(cs = [], { esc = s => String(s), mediaUrl = () => null, color = () => '#5A5A5A' } = {}) {
  if (!cs.length) return '<div class="cv-empty">Todavía no hay nada para el feed de Instagram con imagen y día. Crea una pieza o ponle día a una idea.</div>';
  const tile = (c, i) => {
    const u = mediaUrl(c.src), vid = /\.(mp4|webm|mov)$/i.test(c.src), mueve = !c.pasada;
    const antes = cs[i - 1], despues = cs[i + 1];
    const media = u ? (vid ? `<video src="${esc(u)}#t=0.1" muted playsinline preload="metadata"></video>` : `<img src="${esc(u)}" alt="" loading="lazy" decoding="async">`) : `<span class="pf-ph" style="--h:${[...String(c.src)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360}"></span>`;
    return `<li class="pf-t${c.pasada ? ' pasada' : ''}" data-pf="${esc(c.id)}"${mueve ? ' draggable="true"' : ''}>
      <button type="button" class="pf-open" data-pfo="${esc(c.id)}" aria-label="${esc(`${c.titulo || 'Pieza'}, ${c.etiqueta.toLowerCase()}${c.hora ? ' a las ' + c.hora : ''}`)}">${media}${c.formato === 'carrusel' ? '<i class="pf-gi" aria-hidden="true">❐</i>' : c.formato === 'reel' ? '<i class="pf-gi" aria-hidden="true">▶</i>' : ''}<small class="pf-lab" style="--c:${color(c.estado)}">${esc(c.etiqueta)}</small></button>
      ${mueve ? `<span class="pf-mv">${antes && !antes.pasada ? `<button type="button" data-pfm="${esc(c.id)}:${esc(antes.id)}" aria-label="Mover antes (más nueva)" title="Cambiarla con la de antes">‹</button>` : ''}${despues && !despues.pasada ? `<button type="button" data-pfm="${esc(c.id)}:${esc(despues.id)}" aria-label="Mover después (más vieja)" title="Cambiarla con la de después">›</button>` : ''}</span>` : ''}
    </li>`;
  };
  return `<div class="pf-wrap"><p class="pf-help">Así queda tu perfil: lo programado encima de lo que ya salió, a 3:4. Arrastra una sobre otra (o usa ‹ ›) para cambiarlas de día y hora.</p><ol class="pf-grid">${cs.map(tile).join('')}</ol></div>`;
}
