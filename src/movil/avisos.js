// Versión móvil (25 oct 2026) — AVISOS: lo que la oficina quiere decirte (lo que espera tu OK primero, luego los avisos de la oficina).
// 1 nov 2026: sin repetir (el mismo aviso salía dos veces) y separados en «Hoy» y «Antes de hoy»; los de una tarea la abren con un toque.
import { esc, svg, hace } from './ui.js';
import { esperanOk } from './datos.js';
import { avisosSinRepetir } from './inicio-puro.js';

export function contar(st) { return esperanOk(st.tareas).length + avisosSinRepetir((st.status && st.status.notices) || []).total; }

const fila = n => `<li class="${esc(n.level || '')}${n.leido ? '' : ' nuevo'}">${n.task ? `<button type="button" class="mv-iav" data-tarea="${esc(n.task)}">` : '<div class="mv-iav">'}<span class="mv-iav-t">${esc(String(n.text).replace(/`/g, ''))}</span> <time>${n.t ? hace(n.t) : ''}</time>${n.veces > 1 ? `<span class="mv-iav-x" aria-hidden="true">×${n.veces}</span><span class="mv-sr"> (se repitió ${n.veces} veces)</span>` : ''}${n.task ? '</button>' : '</div>'}</li>`;
const grupo = (titulo, lista) => lista.length ? `<h3 class="mv-gh">${titulo}</h3><ul class="mv-mini mv-iavs">${lista.map(fila).join('')}</ul>` : '';

export function abrirAvisos(ctx) {
  const st = ctx.store.st, ap = esperanOk(st.tareas), av = avisosSinRepetir((st.status && st.status.notices) || [], { leidos: true }), hayNuevos = [...av.hoy, ...av.antes].some(n => !n.leido);
  const h = ctx.hoja({ titulo: 'Avisos', lleno: true, cuerpo: `${ap.length ? `<button type="button" class="mv-banda warn" data-aprob>${svg('alerta')}<span><b>${ap.length === 1 ? '1 borrador espera' : ap.length + ' borradores esperan'} tu OK</b><small>Revisar y aprobar</small></span>${svg('der', 'mv-der')}</button>` : ''}
      ${av.total ? grupo('Hoy', av.hoy) + grupo('Antes de hoy', av.antes) : '<p class="mv-meta">Sin avisos. Todo en orden.</p>'}`,
    acciones: hayNuevos ? [{ texto: 'Marcar todos como leídos', alTocar: async x => { try { await ctx.api('/api/notices/read', { method: 'POST', body: {} }); } catch {} x.cerrar(); ctx.store.refrescar(); } }] : [] });
  h.cuerpo.addEventListener('click', e => {
    if (e.target.closest('[data-aprob]')) { h.cerrar(); setTimeout(() => ctx.navegar('aprobaciones'), 260); return; }
    const t = e.target.closest('[data-tarea]'); if (t) { h.cerrar(); setTimeout(() => ctx.navegar('tareas', { t: t.dataset.tarea }), 260); }
  });
}
