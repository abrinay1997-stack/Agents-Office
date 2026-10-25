// Versión móvil (25 oct 2026) — la vista de DÍA: 24 horas en una columna, lo de ese día colocado en su hora, lo que se pisa lado a lado,
// y una línea roja en «ahora». Tocar un hueco vacío crea algo a esa hora; tocar un evento lo abre. (La parte de cuentas está en dia-puro.js.)
import { esc } from '../ui.js';
import { distribuir, lineaAhora, PX_HORA } from '../dia-puro.js';
import { horaDe } from '../agenda.js';

const TIPO = { rutina: 'Rutina', tarea: 'Tarea', limite: 'Vence', mia: 'Tuya', contenido: 'Contenido' };
export const DEPTS_C = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas' };

export function diaHTML(evs, ini, ahora = Date.now()) {
  const { arriba, cajas } = distribuir(evs, ini), l = lineaAhora(ini, ahora);
  const chip = e => `<button type="button" class="mv-ev t-${e.tipo}" data-at="${e.at}" data-tipo="${e.tipo}" data-id="${esc(e.id || '')}"><span class="mv-ev-c"><b>${esc(e.titulo)}</b><small>${TIPO[e.tipo]} · todo el día</small></span></button>`;
  const horas = Array.from({ length: 24 }, (_, h) => `<div class="mv-hr" data-hora="${String(h).padStart(2, '0')}:00" style="top:${h * PX_HORA}px"><span>${String(h).padStart(2, '0')}:00</span></div>`).join('');
  const bloques = cajas.map(c => {
    const e = c.ev, ancho = 100 / c.cols, extra = e.saltada ? ' · saltada' : e.pausada ? ' · en pausa' : '';
    return `<button type="button" class="mv-evb t-${e.tipo}${e.pausada || e.saltada ? ' pausada' : ''}" style="top:${c.top}px;min-height:${c.alto}px;left:calc(${c.col * ancho}% + 2px);width:calc(${ancho}% - 4px)" data-at="${e.at}" data-tipo="${e.tipo}" data-id="${esc(e.id || '')}"><b>${esc(horaDe(e))}</b> ${esc(e.titulo)}<small>${TIPO[e.tipo]}${e.dept ? ' · ' + esc(DEPTS_C[e.dept] || e.dept) : ''}${extra}</small></button>`;
  }).join('');
  return `${arriba.length ? `<ul class="mv-evs mv-todoeldia" aria-label="Todo el día">${arriba.map(e => `<li>${chip(e)}</li>`).join('')}</ul>` : ''}
    <div class="mv-linea-dia" role="group" aria-label="Horas del día" style="height:${24 * PX_HORA}px">${horas}<div class="mv-evcol">${bloques}</div>${l != null ? `<div class="mv-ahora" style="top:${l}px" role="img" aria-label="Ahora"><i></i></div>` : ''}</div>`;
}
