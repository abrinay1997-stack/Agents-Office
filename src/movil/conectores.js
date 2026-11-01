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
const tile = s => { const src = s.iconUri || iconoDe(bonito(s.name)) || iconoDe(s.key); const [, tono] = ESTADO[s.status] || ESTADO.pending;
  return `<span class="mv-cx ${tono}">${src ? `<img src="${esc(src)}" alt="">` : `<b>${esc(bonito(s.name)[0] || '?')}</b>`}<i aria-hidden="true"></i></span>`; };

/** → HTML de la tarjeta de Inicio (o '' si aún no hay datos) */
export function tarjetaHTML(mcp) {
  const l = (mcp && mcp.servers || []).filter(sinSistema); if (!l.length) return `<section class="mv-card" aria-label="Conectores"><button type="button" class="mv-card-cab" data-conectores><span class="mv-card-t">${svg('conectores')} Conectores</span>${svg('der', 'mv-der')}</button><p class="mv-nada">Todavía no hay conectores. Conéctalos en Ajustes.</p></section>`;
  const ok = l.filter(s => s.status === 'connected').length, ver = l.slice().sort((a, b) => (b.status === 'connected') - (a.status === 'connected')).slice(0, 8);
  return `<section class="mv-card" aria-label="Conectores"><button type="button" class="mv-card-cab" data-conectores><span class="mv-card-t">${svg('conectores')} Conectores <b>${ok} de ${l.length}</b></span>${svg('der', 'mv-der')}</button>
    <div class="mv-cxs" role="list" aria-label="Estado de cada conector">${ver.map(s => `<span role="listitem" aria-label="${esc(bonito(s.name))}: ${esc((ESTADO[s.status] || ESTADO.pending)[0])}">${tile(s)}</span>`).join('')}${l.length > ver.length ? `<span class="mv-cx-mas">+${l.length - ver.length}</span>` : ''}</div></section>`;
}

/** Inicio (1 nov 2026): los conectores en UNA fila compacta (nombre, hasta 5 iconos con su estado y «1 de 1»); el detalle sigue en su pantalla. */
export function lineaHTML(mcp) {
  const l = (mcp && mcp.servers || []).filter(sinSistema);
  if (!l.length) return `<button type="button" class="ini-linea" data-conectores aria-label="Conectores: ninguno conectado. Abrir">${svg('conectores')}<span class="ini-linea-t">Conectores</span><span class="ini-linea-m">Ninguno conectado</span>${svg('der', 'mv-der')}</button>`;
  const ok = l.filter(s => s.status === 'connected').length, mal = l.length - ok, ver = l.slice().sort((a, b) => (a.status === 'connected') - (b.status === 'connected')).slice(0, 5);
  return `<button type="button" class="ini-linea" data-conectores aria-label="Conectores: ${ok} de ${l.length} conectados${mal ? ', ' + mal + (mal === 1 ? ' con problema' : ' con problemas') : ''}. Abrir">${svg('conectores')}<span class="ini-linea-t">Conectores</span><span class="mv-cxs mv-cxs-mini" aria-hidden="true">${ver.map(tile).join('')}</span><span class="ini-linea-m ${mal ? 'warn' : ''}">${ok} de ${l.length}</span>${svg('der', 'mv-der')}</button>`;
}

/** El panel de conectores es una pantalla propia (vistas/conectores.js): la lista, el detalle de cada uno, «Probar conexión» y «+ Añadir». */
export function abrirConectores(ctx) { ctx.navegar('conectores'); }
