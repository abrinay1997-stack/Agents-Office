// Versión móvil (25 oct 2026) — AVISOS: lo que la oficina quiere decirte (lo que espera tu OK primero, luego los avisos sin leer del estado de la oficina).
import { esc, svg, hace } from './ui.js';
import { esperanOk } from './datos.js';

export function contar(st) { return esperanOk(st.tareas).length + ((st.status && st.status.notices) || []).filter(n => !n.read).length; }
export function abrirAvisos(ctx) {
  const st = ctx.store.st, ap = esperanOk(st.tareas), ns = ((st.status && st.status.notices) || []).slice(0, 30);
  const h = ctx.hoja({ titulo: 'Avisos', lleno: true, cuerpo: `${ap.length ? `<button type="button" class="mv-banda warn" data-aprob>${svg('alerta')}<span><b>${ap.length === 1 ? '1 borrador espera' : ap.length + ' borradores esperan'} tu OK</b><small>Revisar y aprobar</small></span>${svg('der', 'mv-der')}</button>` : ''}
      ${ns.length ? `<ul class="mv-mini">${ns.map(n => `<li class="${esc(n.level || '')}${n.read ? '' : ' nuevo'}">${esc(String(n.text).replace(/`/g, ''))} <time>${n.t ? hace(n.t) : ''}</time></li>`).join('')}</ul>` : '<p class="mv-meta">Sin avisos. Todo en orden.</p>'}`,
    acciones: ns.some(n => !n.read) ? [{ texto: 'Marcar todos como leídos', alTocar: async x => { try { await ctx.api('/api/notices/read', { method: 'POST', body: {} }); } catch {} x.cerrar(); ctx.store.refrescar(); } }] : [] });
  h.cuerpo.addEventListener('click', e => { if (e.target.closest('[data-aprob]')) { h.cerrar(); setTimeout(() => ctx.navegar('aprobaciones'), 260); } });
}
