// El HISTORIAL: cada cambio hecho a los anuncios —quién (tú, Dimitri, tu asistente, el piloto automático), qué, antes y después,
// cuándo—, lo más nuevo primero. Fase A2 (9 oct 2026): la lista real (GET /api/anuncios/historial) y un filtro por quién.
import { esc } from './comun.js';

const QUIEN = { dueno: 'Tú', 'dueño': 'Tú', tu: 'Tú', 'tú': 'Tú', dimitri: 'Dimitri', piloto: 'El piloto automático', asistente: 'Tu asistente', agente: 'Un agente', oficina: 'La oficina' };
export const quienTexto = q => QUIEN[String(q || '').toLowerCase()] || String(q || 'La oficina');
export const QUIENES = [['todos', 'Todos'], ['dueno', 'Tú'], ['dimitri', 'Dimitri'], ['asistente', 'Tu asistente'], ['piloto', 'Piloto automático']];
const normal = q => { const k = String(q || '').toLowerCase(); return k === 'dueño' || k === 'tu' || k === 'tú' ? 'dueno' : k; };
const cuando = at => { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const iso = at => { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const val = v => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Filtra por quién ('todos' = sin filtro). */
export const filtrarHistorial = (items = [], quien = 'todos') => (quien === 'todos' ? items.slice() : items.filter(i => normal(i.quien) === quien));

export function historialHTML(items, { quien = 'todos' } = {}) {
  if (items == null) return '<p class="anu-cargando">Cargando el historial…</p>';
  if (!items.length) return '<div class="anu-vacio"><b>Todavía no hay cambios</b><span>Aquí aparecerá cada pausa, activación o cambio de presupuesto, con quién lo hizo.</span></div>';
  const cuentas = Object.fromEntries(QUIENES.map(([k]) => [k, filtrarHistorial(items, k).length]));
  const barra = `<div class="anu-barra"><div class="anu-seg" role="group" aria-label="Quién lo hizo">${QUIENES.filter(([k]) => k === 'todos' || cuentas[k] || k === quien).map(([k, n]) => `<button type="button" data-quien="${k}" aria-pressed="${k === quien}">${esc(n)} <b class="anu-cuenta">${cuentas[k]}</b></button>`).join('')}</div></div>`;
  const l = filtrarHistorial(items, quien).sort((a, b) => (Date.parse(b.at) || b.at || 0) - (Date.parse(a.at) || a.at || 0));
  if (!l.length) return `${barra}<div class="anu-vacio"><b>Nada de ${esc(quienTexto(quien))}</b><span>Prueba con «Todos».</span></div>`;
  return `${barra}<ol class="anu-hist">${l.map(i => `<li><time datetime="${esc(iso(i.at))}">${esc(cuando(i.at))}</time>
    <p><b>${esc(quienTexto(i.quien))}</b> ${esc(i.que || 'cambió algo')}${i.objeto ? ` · <span>${esc(typeof i.objeto === 'object' ? i.objeto.nombre || i.objeto.id : i.objeto)}</span>` : ''}${i.objeto?.cuenta ? ` · <span class="anu-cta-h" data-cuenta-hist>en ${esc(i.objeto.cuenta)}</span>` : ''}</p>
    ${i.antes != null || i.despues != null ? `<p class="anu-antes">Antes: ${esc(val(i.antes))} → Después: ${esc(val(i.despues))}</p>` : ''}</li>`).join('')}</ol>`;
}
