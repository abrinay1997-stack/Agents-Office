// El HISTORIAL (Fase A1): cada cambio hecho a los anuncios —quién (tú, Dimitri, el piloto automático), qué, antes y después, cuándo—.
// En A1 no hay cambios todavía (el panel solo mira), así que casi siempre está vacío y lo dice.
import { esc } from './comun.js';

const QUIEN = { dueno: 'Tú', 'dueño': 'Tú', tu: 'Tú', 'tú': 'Tú', dimitri: 'Dimitri', piloto: 'El piloto automático', asistente: 'Tu asistente', agente: 'Un agente', oficina: 'La oficina' };
export const quienTexto = q => QUIEN[String(q || '').toLowerCase()] || String(q || 'La oficina');
const cuando = at => { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const iso = at => { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const val = v => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function historialHTML(items) {
  if (items == null) return '<p class="anu-cargando">Cargando el historial…</p>';
  if (!items.length) return '<div class="anu-vacio"><b>Todavía no hay cambios</b><span>Aquí aparecerá cada pausa, activación o cambio de presupuesto, con quién lo hizo.</span></div>';
  const l = items.slice().sort((a, b) => (Date.parse(b.at) || b.at || 0) - (Date.parse(a.at) || a.at || 0));
  return `<ol class="anu-hist">${l.map(i => `<li><time datetime="${esc(iso(i.at))}">${esc(cuando(i.at))}</time>
    <p><b>${esc(quienTexto(i.quien))}</b> ${esc(i.que || 'cambió algo')}${i.objeto ? ` · <span>${esc(typeof i.objeto === 'object' ? i.objeto.nombre || i.objeto.id : i.objeto)}</span>` : ''}</p>
    ${i.antes != null || i.despues != null ? `<p class="anu-antes">Antes: ${esc(val(i.antes))} → Después: ${esc(val(i.despues))}</p>` : ''}</li>`).join('')}</ol>`;
}
