// La vista Tareas — INICIO: lo que importa hoy, en secciones que se pliegan (y se recuerda). Cada sección: icono con tinte, título,
// subtítulo, cuántas, barra de progreso cuando tiene sentido; debajo, las filas; al final, la fila punteada «+ Añadir tarea» que ya
// trae la fecha de esa sección; y, en Hoy, «HECHAS HOY · N». Lo que solo tiene esta oficina va arriba: lo que espera tu OK.
import { agenda } from '../../tareas/agenda.mjs';
import { esc, svg, filaHTML, vacioHTML, hoyYmd } from './comun.js';
import { textoDuracion } from '../../tareas/cronometro.mjs';

const localDia = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const SECCIONES = [
  { k: 'esperanOk', titulo: 'Esperan tu OK', sub: 'Borradores listos: apruébalos o devuélvelos', icono: 'ok', tono: 'ambar' },
  { k: 'hoy', titulo: 'Hoy', sub: 'Lo que vence o arranca hoy, y lo vencido', icono: 'hoy', tono: 'azul', anadir: () => ({ limite: hoyYmd() }) },
  { k: 'enCurso', titulo: 'En curso', sub: 'Lo que los agentes hacen ahora, paso a paso', icono: 'curso', tono: 'verde' },
  { k: 'bloqueadas', titulo: 'Bloqueadas', sub: 'Esperan otra tarea o algo tuyo', icono: 'bloq', tono: 'rojo' },
  { k: 'proximas', titulo: 'Próximos días', sub: 'Lo de los próximos 7 días', icono: 'prox', tono: 'violeta', anadir: () => { const d = new Date(); d.setDate(d.getDate() + 1); return { limite: localDia(d.getTime()) }; } },
  { k: 'ideas', titulo: 'Ideas', sub: 'Lo que propusieron los agentes o Dimitri: pídelas si te sirven', icono: 'idea', tono: 'gris' },
  { k: 'recientes', titulo: 'Recientes', sub: 'Lo terminado en las últimas 48 horas', icono: 'hecha', tono: 'verde' },
];

export function inicioHTML(tareas, ctx, plegadas, { crono = null } = {}) {
  const a = agenda(tareas, { ahora: Date.now() });
  a.ideas = tareas.filter(t => t.state === 'idea' && !t.archived).sort((x, y) => (y.addedAt || 0) - (x.addedAt || 0));
  a.hoy = [...a.vencidas, ...a.hoy];
  const hoy = hoyYmd(), hechasHoy = tareas.filter(t => t.state === 'done' && !t.error && t.doneAt && localDia(t.doneAt) === hoy && !t.archived);
  const out = [];
  if (crono) out.push(`<div class="tv-crono" role="status"><span>⏱ Llevas <b>${esc(textoDuracion(Date.now() - crono.desde))}</b> en <button type="button" class="tv-tit" data-abrir="${esc(crono.tarea.id)}">${esc(crono.tarea.title)}</button></span><button type="button" class="tv-btn" data-cronoid="${esc(crono.tarea.id)}">■ Parar</button></div>`); // plan T6
  for (const s of SECCIONES) {
    const l = a[s.k] || [];
    if (!l.length && ['bloqueadas', 'ideas', 'esperanOk'].includes(s.k)) continue; // lo que no hay, no ocupa sitio
    const cerrada = plegadas.has(s.k);
    let cuenta = String(l.length), barra = '';
    if (s.k === 'hoy') { const tot = l.length + hechasHoy.length; cuenta = `${hechasHoy.length}/${tot}`; barra = tot ? `<span class="tv-bar" aria-hidden="true"><i style="width:${Math.round(100 * hechasHoy.length / tot)}%"></i></span>` : ''; }
    if (s.k === 'enCurso') { const p = l.flatMap(t => t.pasos || []), h = p.filter(x => x.hecho).length; if (p.length) { cuenta = `${l.length} · pasos ${h}/${p.length}`; barra = `<span class="tv-bar" aria-hidden="true"><i style="width:${Math.round(100 * h / p.length)}%"></i></span>`; } }
    const filas = l.length ? `<div class="tv-filas" role="list">${l.map(t => filaHTML(t, ctx)).join('')}</div>` : vacioHTML(s.k === 'hoy' ? 'Nada para hoy' : 'Nada por aquí', s.k === 'hoy' ? 'Añade algo o mira los próximos días.' : 'Cuando haya algo, aparece aquí.');
    const pie = s.anadir ? `<button type="button" class="tv-anadir" data-anadir="${s.k}">${svg('mas')}Añadir tarea${s.k === 'hoy' ? ' para hoy' : ''}</button>` : '';
    const hechas = s.k === 'hoy' && hechasHoy.length ? `<details class="tv-hechas"><summary>HECHAS HOY · ${hechasHoy.length}</summary><div class="tv-filas" role="list">${hechasHoy.map(t => filaHTML(t, ctx)).join('')}</div></details>` : '';
    out.push(`<section class="tv-sec t-${s.tono}${cerrada ? ' cerrada' : ''}" data-sec="${s.k}" aria-labelledby="tvs-${s.k}">
      <header class="tv-sech"><span class="tv-ico">${svg(s.icono)}</span>
        <button type="button" class="tv-plegar" data-plegar="${s.k}" aria-expanded="${!cerrada}" id="tvs-${s.k}"><b>${esc(s.titulo)}</b><small>${esc(s.sub)}</small></button>
        <span class="tv-cuenta">${esc(cuenta)}</span>${barra}
        ${s.anadir ? `<button type="button" class="tv-icb" data-anadir="${s.k}" aria-label="Añadir tarea a ${esc(s.titulo)}" title="Añadir tarea">${svg('mas')}</button>` : ''}
      </header>
      <div class="tv-secb"${cerrada ? ' hidden' : ''}>${filas}${pie}${hechas}</div>
    </section>`);
  }
  return out.join('');
}
export const PRESET_SECCION = Object.fromEntries(SECCIONES.filter(s => s.anadir).map(s => [s.k, s.anadir]));
