// Versión móvil (25 oct 2026) — CONECTORES a la vista: una tarjeta en Inicio con la fila de iconos (los mismos de escritorio, 36 px, con su punto de
// estado) y una hoja con la lista (icono, nombre, estado en palabras, a qué departamentos llega). Antes, en el teléfono, la barra de conectores se escondía
// y no había forma de verlos sin pasar por Ajustes. Los iconos se toman de los que la página ya dibujó en su barra (`#topconn img`, por nombre).
import { esc, svg } from './ui.js';

export const ESTADO = { connected: ['Conectado', 'ok'], 'needs-auth': ['Pide entrar', 'warn'], failed: ['Sin conexión', 'bad'], pending: ['Conectando…', 'warn'], denied: ['Bloqueado para los agentes', 'warn'] };
const DEPT = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas' };
const bonito = n => String(n || '').replace(/^plugin:[^:]+:/, '').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
const sinSistema = s => !!s.name; // todos: el panel de escritorio también lista los apagados

/** el <img src> del conector si la página ya lo dibujó */
export function iconoDe(nombre) {
  const n = String(nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const i of document.querySelectorAll('#topconn img')) if ((i.alt || '').toLowerCase().replace(/[^a-z0-9]/g, '') === n) return i.src;
  return '';
}
const tile = s => { const src = iconoDe(bonito(s.name)) || iconoDe(s.key); const [, tono] = ESTADO[s.status] || ESTADO.pending;
  return `<span class="mv-cx ${tono}">${src ? `<img src="${esc(src)}" alt="">` : `<b>${esc(bonito(s.name)[0] || '?')}</b>`}<i aria-hidden="true"></i></span>`; };

/** → HTML de la tarjeta de Inicio (o '' si aún no hay datos) */
export function tarjetaHTML(mcp) {
  const l = (mcp && mcp.servers || []).filter(sinSistema); if (!l.length) return `<section class="mv-card" aria-label="Conectores"><button type="button" class="mv-card-cab" data-conectores><span class="mv-card-t">${svg('conectores')} Conectores</span>${svg('der', 'mv-der')}</button><p class="mv-nada">Todavía no hay conectores. Conéctalos en Ajustes.</p></section>`;
  const ok = l.filter(s => s.status === 'connected').length, ver = l.slice().sort((a, b) => (b.status === 'connected') - (a.status === 'connected')).slice(0, 8);
  return `<section class="mv-card" aria-label="Conectores"><button type="button" class="mv-card-cab" data-conectores><span class="mv-card-t">${svg('conectores')} Conectores <b>${ok} de ${l.length}</b></span>${svg('der', 'mv-der')}</button>
    <div class="mv-cxs" role="list" aria-label="Estado de cada conector">${ver.map(s => `<span role="listitem" aria-label="${esc(bonito(s.name))}: ${esc((ESTADO[s.status] || ESTADO.pending)[0])}">${tile(s)}</span>`).join('')}${l.length > ver.length ? `<span class="mv-cx-mas">+${l.length - ver.length}</span>` : ''}</div></section>`;
}

/** la hoja con la lista y el detalle de cada uno */
export function abrirConectores(ctx, mcp) {
  const l = (mcp && mcp.servers || []).filter(sinSistema);
  const fila = s => { const [txt, tono] = ESTADO[s.status] || ESTADO.pending, d = (s.depts || []).map(k => DEPT[k] || k);
    return `<li class="mv-cxf">${tile(s)}<span class="mv-cxf-t"><b>${esc(bonito(s.name))}</b><small class="${tono}">${esc(txt)}${s.detail ? ' · ' + esc(String(s.detail).slice(0, 80)) : ''}</small><small>${d.length ? 'Llega a: ' + esc(d.join(', ')) : 'No llega a ningún departamento'}</small></span></li>`; };
  ctx.hoja({ titulo: 'Conectores', lleno: true, cuerpo: l.length ? `<ul class="mv-cxl">${l.map(fila).join('')}</ul><p class="mv-meta">Para añadir o quitar uno: Más → Ajustes → Conectores.</p>` : '<p class="mv-meta">Todavía no hay conectores. Conéctalos en Más → Ajustes.</p>' });
}
