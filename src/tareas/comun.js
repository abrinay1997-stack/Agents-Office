// La vista Tareas — lo COMÚN: la fila de una tarea (la misma en Inicio, Lista y Proyectos), las fechas en palabras, los chips y los
// iconos. Lo que hace que se vea ordenada es que todo se repite igual: una fila, un chip, un botón de campo.
import { visible, VISIBLES } from '../../tareas/estados.mjs';
import { limiteMs, NOMBRE_PRIORIDAD } from '../../tareas/modelo.mjs';
import { esDelDueno, delegadaPorMi, agenteDeOrigen } from '../../tareas/dueno.mjs';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoyYmd = () => ymd(new Date());
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dia0 = s => { const d = new Date(String(s).slice(0, 10) + 'T12:00'); return d; };
const diasEntre = (a, b) => Math.round((dia0(b) - dia0(a)) / 864e5);

// la fecha límite en palabras, y si apremia: { texto, tono: 'rojo'|'ambar'|'' }
export function limiteTexto(lim, ahora = Date.now()) {
  if (!lim) return null;
  const n = diasEntre(ymd(new Date(ahora)), lim), d = dia0(lim), hora = String(lim).length > 10 ? ' ' + String(lim).slice(11, 16) : '';
  if (limiteMs(lim) < ahora) return { texto: n === 0 ? `venció hoy${hora}` : n === -1 ? 'venció ayer' : `venció hace ${-n} días`, tono: 'rojo' };
  if (n === 0) return { texto: `vence hoy${hora}`, tono: 'ambar' };
  if (n === 1) return { texto: `vence mañana${hora}`, tono: 'ambar' };
  if (n < 7) return { texto: `vence el ${DOW[d.getDay()]}${hora}`, tono: '' };
  return { texto: `vence el ${d.getDate()} ${MES[d.getMonth()]}${hora}`, tono: '' };
}
export const fechaCorta = ms => { const d = new Date(ms); return `${DOW[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`; };
export const horaCorta = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export function haceTexto(ms, ahora = Date.now()) {
  const s = (ahora - ms) / 1000; if (s < 90) return 'hace un momento'; if (s < 3600) return `hace ${Math.round(s / 60)} min`; if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const n = Math.round(s / 86400); return n === 1 ? 'ayer' : `hace ${n} días`;
}
export const minutosTexto = m => (m == null ? '—' : m < 60 ? `${m} min` : m < 60 * 24 ? `${Math.round(m / 6) / 10} h`.replace('.', ',') : `${Math.round(m / 144) / 10} días`.replace('.', ','));

export const ICONO = {
  inicio: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  tablero: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
  proyectos: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  medidas: '<path d="M3 20.5h18"/><path d="M6 17V11M11 17V6M16 17v-4M20 17V9"/>',
  ok: '<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4M12 17h.01"/>',
  hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  curso: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bloq: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  prox: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>',
  hecha: '<path d="m4 12.5 5 5L20 6.5"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
  filtro: '<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  mapa: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.3 11 16.7 7M7.3 13l9.4 4"/>',
  mias: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>', // plan D: las tareas del dueño
  bandeja: '<path d="M3 13.5 5.5 5h13l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19Z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
  delegar: '<circle cx="8" cy="8" r="3.5"/><path d="M2.5 19.5a5.5 5.5 0 0 1 9.5-3.8"/><path d="M14 15h7.5M18.5 12l3 3-3 3"/>',
  empezar: '<path d="M8 5.5v13l10.5-6.5Z"/>',
  pausa: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
};
export const svg = (k, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICONO[k] || ''}</svg>`;

// la FILA: el título es el botón que la abre (un botón nunca dentro de otro); la casilla elige; los chips dicen lo justo
export function filaHTML(t, ctx, { elegir = false, elegida = false, arrastrar = false, mostrarDept = true, mia = false } = {}) {
  const v = visible(t, ctx.porId), V = VISIBLES[v] || {}, a = ctx.agente(t.agent);
  const deMi = esDelDueno(t), origen = agenteDeOrigen(t), del = delegadaPorMi(t); // plan D: de dónde vino, a quién la pasé
  const lim = t.state === 'done' ? null : limiteTexto(t.limite);
  const ps = t.pasos?.length ? { h: t.pasos.filter(p => p.hecho).length, n: t.pasos.length } : null;
  const pr = t.proyecto && ctx.proyecto(t.proyecto);
  const ets = (t.etiquetas || []).map(id => ctx.etiqueta(id)).filter(Boolean);
  const quien = deMi ? (mia ? '' : '<span class="tv-c tv-c-tuya" title="La haces tú">Tuya</span>') : t.person ? `<span class="tv-c tv-c-persona" title="La tiene ${esc(t.person)}">👤 ${esc(t.person)}</span>` : a ? `<span class="tv-c tv-c-agente">${del ? '→ ' : ''}${esc(a.name)}</span>` : '';
  const mias = [ // plan D: lo que solo dice una tarea del dueño (o una que él delegó)
    deMi && t.empezada && t.state !== 'done' ? '<span class="tv-c tv-c-haciendo">▶ Haciendo</span>' : '',
    deMi && t.sugeridaPor ? `<span class="tv-c tv-c-sug">Sugerida por ${esc(ctx.agente(t.sugeridaPor)?.name || t.sugeridaPor)}</span>` : deMi && origen && ctx.agente(origen) ? `<span class="tv-c tv-c-de" title="Vino de ${esc(ctx.agente(origen).name)}">de ${esc(ctx.agente(origen).name)}</span>` : '',
    del && mia ? `<span class="tv-c t-${V.tono || 'gris'}">${esc(V.etiqueta || '')}</span>` : '',
  ];
  const chips = [
    t.prioridad === 'alta' ? '<span class="tv-c tv-c-alta">Alta</span>' : t.prioridad === 'baja' ? '<span class="tv-c tv-c-baja">Baja</span>' : '',
    lim ? `<span class="tv-c tv-c-lim ${lim.tono}">${esc(lim.texto)}</span>` : '',
    t.state === 'scheduled' && t.dueAt ? `<span class="tv-c">arranca ${esc(fechaCorta(t.dueAt))} ${esc(horaCorta(t.dueAt))}</span>` : '',
    ps ? `<span class="tv-c tv-c-pasos" title="${ps.h} de ${ps.n} pasos"><i style="--p:${Math.round(100 * ps.h / ps.n)}%"></i>${ps.h}/${ps.n}</span>` : '',
    pr ? `<span class="tv-c tv-pr c-${esc(pr.color)}">${esc(pr.nombre)}</span>` : '',
    ...ets.slice(0, 2).map(e => `<span class="tv-c tv-et c-${esc(e.color)}">#${esc(e.nombre)}</span>`),
    ets.length > 2 ? `<span class="tv-c" title="${esc(ets.slice(2).map(e => '#' + e.nombre).join(' '))}">+${ets.length - 2}</span>` : '',
    ...mias,
    mostrarDept && ctx.depto(t.dept) ? `<span class="tv-c tv-c-dept"><i style="background:${ctx.depto(t.dept).chip}"></i>${esc(ctx.depto(t.dept).short || ctx.depto(t.dept).name)}</span>` : '',
    quien,
  ].filter(Boolean).join('');
  const hechaCk = mia && deMi && t.state !== 'idea'; // la casilla redonda de TaskView: hacerla (o reabrirla) con un clic
  return `<div class="tv-fila v-${v}${t.prioridad === 'alta' ? ' alta' : ''}${elegida ? ' sel' : ''}${deMi ? ' mia' : ''}" data-t="${esc(t.id)}" role="listitem"${arrastrar ? ' draggable="true"' : ''}>
    ${elegir ? `<input type="checkbox" class="tv-ck" data-sel="${esc(t.id)}" aria-label="Elegir «${esc(t.title)}»"${elegida ? ' checked' : ''}>` : ''}
    ${hechaCk ? `<input type="checkbox" class="tv-hck" data-hecha="${esc(t.id)}" aria-label="${t.state === 'done' ? 'Reabrir' : 'Marcar hecha'} «${esc(t.title)}»"${t.state === 'done' ? ' checked' : ''}>` : `<span class="tv-pt t-${V.tono || 'gris'}" title="${esc(V.etiqueta || '')}" aria-hidden="true"></span>`}
    <div class="tv-fc"><button type="button" class="tv-tit" data-abrir="${esc(t.id)}">${esc(t.title)}<span class="tv-sr"> — ${esc(V.etiqueta || '')}</span></button>
    <div class="tv-chips">${chips}</div></div>
    ${t.state === 'waiting' ? `<button type="button" class="tv-mini pri" data-ok="${esc(t.id)}">Aprobar</button>` : ''}
    ${deMi && t.state === 'idea' && t.sugeridaPor ? `<button type="button" class="tv-mini" data-aceptar="${esc(t.id)}" aria-label="Aceptar la sugerencia «${esc(t.title)}»">Aceptar</button>` : ''}
  </div>`;
}

export const vacioHTML = (titulo, linea) => `<div class="tv-vacio"><b>${esc(titulo)}</b><span>${esc(linea)}</span></div>`;
export { NOMBRE_PRIORIDAD, visible, VISIBLES };
