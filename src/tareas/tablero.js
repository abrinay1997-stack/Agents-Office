// La vista Tareas — TABLERO: columnas = los estados de verdad (no se inventan: los agentes dependen de ellos); carriles por
// departamento si se quiere. Arrastrar una tarjeta hace lo que significa ese paso, siempre con DESHACER y nunca con confirm():
//   idea → en cola = pedirla · en cola → ideas = aparcarla · en cola/programada → hecha = cerrarla sin ejecutar ·
//   espera tu OK → hecha = aprobar · hecha → en cola = repetirla · dentro de «en cola» = cambiar el orden · a otro carril = otro departamento.
// En el teléfono, una columna a la vez (pestañas). movimiento() es puro y tiene test.
import { visible } from '../../tareas/estados.mjs';
import { ordenCola } from '../../tareas/cola.mjs';
import { esc, filaHTML } from './comun.js';

export const COLUMNAS = [
  { k: 'idea', titulo: 'Ideas', vis: ['idea'] },
  { k: 'cola', titulo: 'En cola', vis: ['en_cola', 'en_manos'] },
  { k: 'programada', titulo: 'Programadas', vis: ['programada'] },
  { k: 'bloqueada', titulo: 'Bloqueadas', vis: ['bloqueada'] },
  { k: 'curso', titulo: 'En curso', vis: ['en_curso'] },
  { k: 'ok', titulo: 'Esperan tu OK', vis: ['espera_ok'] },
  { k: 'hecha', titulo: 'Hechas · 48 h', vis: ['hecha', 'fallida'] },
];
export const columnaDe = (t, porId) => { const v = visible(t, porId); return COLUMNAS.find(c => c.vis.includes(v))?.k || 'cola'; };

// ¿qué significa soltar `t` en la columna `a` (y el carril `dept`)? → { accion, texto } o null (no se puede)
export function movimiento(t, de, a, { dept = null } = {}) {
  if (dept && dept !== t.dept) return ['idea', 'cola', 'programada'].includes(de) && de === a ? { accion: 'departamento', texto: 'pasarla a otro departamento' } : null;
  if (de === a) return de === 'cola' ? { accion: 'orden', texto: 'cambiar su turno' } : null;
  const k = `${de}>${a}`;
  return {
    'idea>cola': { accion: 'pedir', texto: 'pedirla: entra en la cola' },
    'cola>idea': { accion: 'aparcar', texto: 'devolverla a ideas' },
    'cola>hecha': { accion: 'hecha', texto: 'marcarla hecha sin ejecutarla' },
    'programada>hecha': { accion: 'hecha', texto: 'marcarla hecha sin ejecutarla' },
    'programada>cola': { accion: 'ya', texto: 'que arranque ya' },
    'ok>hecha': { accion: 'aprobar', texto: 'aprobarla: el agente la envía' },
    'hecha>cola': { accion: 'repetir', texto: 'repetirla (una tarea nueva)' },
  }[k] || null;
}

export function tableroHTML(tareas, ctx, { carriles = false, colMovil = 'cola', ahora = Date.now() } = {}) {
  const vivas = tareas.filter(t => !t.archived && !(t.state === 'done' && (t.doneAt || 0) < ahora - 48 * 3600e3));
  const por = new Map(COLUMNAS.map(c => [c.k, []])); for (const t of vivas) por.get(columnaDe(t, ctx.porId)).push(t);
  for (const [k, l] of por) l.sort(k === 'hecha' ? (a, b) => (b.doneAt || 0) - (a.doneAt || 0) : ordenCola);
  const tarjeta = t => filaHTML(t, ctx, { arrastrar: t.state !== 'doing', mostrarDept: !carriles });
  const tabs = `<div class="tv-coltabs" role="tablist" aria-label="Columna">${COLUMNAS.map(c => `<button type="button" role="tab" aria-selected="${c.k === colMovil}" data-colmovil="${c.k}">${esc(c.titulo)} <span>${por.get(c.k).length}</span></button>`).join('')}</div>`;
  if (!carriles) return `${tabs}<div class="tv-tablero" style="--cols:${COLUMNAS.length}">${COLUMNAS.map(c => `<section class="tv-col${c.k === colMovil ? ' movil' : ''}" data-col="${c.k}" aria-label="${esc(c.titulo)}"><h3>${esc(c.titulo)} <span>${por.get(c.k).length}</span></h3><div class="tv-drop" data-col="${c.k}"${por.get(c.k).length ? ' role="list"' : ''}>${por.get(c.k).map(tarjeta).join('') || '<p class="tv-nada">—</p>'}</div></section>`).join('')}</div>`;
  const depts = ctx.deptKeys.filter(d => vivas.some(t => t.dept === d));
  return `${tabs}<div class="tv-tablero carriles" style="--cols:${COLUMNAS.length}">
    <div class="tv-lh"></div>${COLUMNAS.map(c => `<div class="tv-lh${c.k === colMovil ? ' movil' : ''}" data-col="${c.k}">${esc(c.titulo)} <span>${por.get(c.k).length}</span></div>`).join('')}
    ${depts.map(d => `<div class="tv-ld"><i style="background:${ctx.depto(d).chip}"></i>${esc(ctx.depto(d).short || ctx.depto(d).name)}</div>` + COLUMNAS.map(c => { const l = por.get(c.k).filter(t => t.dept === d); return `<div class="tv-drop tv-celda${c.k === colMovil ? ' movil' : ''}" data-col="${c.k}" data-dept="${d}" role="${l.length ? 'list' : 'group'}" aria-label="${esc(ctx.depto(d).name)} · ${esc(c.titulo)}">${l.map(tarjeta).join('')}</div>`; }).join('')).join('') || '<p class="tv-nada">No hay tareas vivas.</p>'}
  </div>`;
}
