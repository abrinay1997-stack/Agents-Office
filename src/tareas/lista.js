// La vista Tareas — LISTA: todas, con filtros que se ven como chips (y viven en la dirección: #tareas=lista&dept=sales&prio=alta),
// orden (la cola, fecha límite, prioridad, recientes), agrupar (departamento, proyecto, estado, día) y selección de varias con una
// barra de acciones (prioridad, etiqueta, proyecto, fecha límite, pedir ideas, archivar) y DESHACER. filtrar/ordenar/agrupar son puras.
import { ordenCola } from '../../tareas/cola.mjs';
import { limiteMs, PESO_PRIORIDAD } from '../../tareas/modelo.mjs';
import { visible, VISIBLES, ORDEN_VISIBLE } from '../../tareas/estados.mjs';
import { fechaDe } from '../../tareas/agenda.mjs';
import { esc, svg, filaHTML, vacioHTML, fechaCorta } from './comun.js';
import { esDelDueno } from '../../tareas/dueno.mjs';

export const FILTROS = ['q', 'quien', 'dept', 'agente', 'prio', 'etiqueta', 'proyecto', 'estado', 'hechas'];
export const QUIEN = { yo: 'Tuyas', agentes: 'De los agentes', personas: 'De personas del equipo' }; // plan D
export const ORDENES = { cola: 'Como en la cola', limite: 'Fecha límite', prioridad: 'Prioridad', recientes: 'Recientes primero' };
export const GRUPOS = { nada: 'Sin agrupar', estado: 'Por estado', dept: 'Por departamento', proyecto: 'Por proyecto', dia: 'Por día' };
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filtrar(tareas, f, ctx) {
  const porId = ctx.porId, q = fold(f.q).trim();
  return tareas.filter(t => {
    if (t.archived) return false;
    const v = visible(t, porId);
    if (!f.hechas && (v === 'hecha' || v === 'fallida') && f.estado !== 'hecha' && f.estado !== 'fallida') return false;
    if (f.quien === 'yo' && !esDelDueno(t)) return false; // plan D
    if (f.quien === 'agentes' && t.person) return false;
    if (f.quien === 'personas' && (!t.person || esDelDueno(t))) return false;
    if (f.dept && t.dept !== f.dept) return false;
    if (f.agente && t.agent !== f.agente) return false;
    if (f.prio && (t.prioridad || 'media') !== f.prio) return false;
    if (f.etiqueta && !(t.etiquetas || []).includes(f.etiqueta)) return false;
    if (f.proyecto && (f.proyecto === '-' ? t.proyecto : t.proyecto !== f.proyecto)) return false;
    if (f.estado && v !== f.estado) return false;
    if (q && !fold(`${t.title} ${t.text || ''} ${t.person || ''} ${ctx.agente(t.agent)?.name || ''}`).includes(q)) return false;
    return true;
  });
}
export function ordenar(l, orden) {
  const c = [...l];
  if (orden === 'limite') c.sort((a, b) => (limiteMs(a.limite) ?? Infinity) - (limiteMs(b.limite) ?? Infinity) || ordenCola(a, b));
  else if (orden === 'prioridad') c.sort((a, b) => (PESO_PRIORIDAD[a.prioridad] ?? 1) - (PESO_PRIORIDAD[b.prioridad] ?? 1) || ordenCola(a, b));
  else if (orden === 'recientes') c.sort((a, b) => (b.doneAt || b.addedAt || 0) - (a.doneAt || a.addedAt || 0));
  else c.sort((a, b) => { const va = ORDEN_VISIBLE.indexOf(visible(a)), vb = ORDEN_VISIBLE.indexOf(visible(b)); return va - vb || ordenCola(a, b); });
  return c;
}
export function agrupar(l, como, ctx) {
  if (!como || como === 'nada') return [{ k: '', titulo: '', tareas: l }];
  const g = new Map();
  for (const t of l) {
    let k, titulo;
    if (como === 'estado') { k = visible(t, ctx.porId); titulo = VISIBLES[k]?.etiqueta || k; }
    else if (como === 'dept') { k = t.dept || '-'; titulo = ctx.depto(k)?.name || 'Sin departamento (tuyas)'; }
    else if (como === 'proyecto') { k = t.proyecto || '-'; titulo = t.proyecto ? ctx.proyecto(t.proyecto)?.nombre || 'Proyecto borrado' : 'Sin proyecto'; }
    else { k = fechaDe(t) || '~'; titulo = k === '~' ? 'Sin fecha' : fechaCorta(new Date(k + 'T12:00').getTime()); }
    if (!g.has(k)) g.set(k, { k, titulo, tareas: [] }); g.get(k).tareas.push(t);
  }
  const grupos = [...g.values()];
  if (como === 'estado') grupos.sort((a, b) => ORDEN_VISIBLE.indexOf(a.k) - ORDEN_VISIBLE.indexOf(b.k));
  else if (como === 'dia') grupos.sort((a, b) => a.k.localeCompare(b.k));
  else grupos.sort((a, b) => (a.k === '-') - (b.k === '-') || a.titulo.localeCompare(b.titulo));
  return grupos;
}

// los filtros activos como chips que se quitan
export function chipsFiltro(f, ctx) {
  const c = [];
  const nombre = { quien: v => QUIEN[v] || v, dept: v => ctx.depto(v)?.name || v, agente: v => ctx.agente(v)?.name || v, prio: v => `Prioridad ${v}`, etiqueta: v => '#' + (ctx.etiqueta(v)?.nombre || v), proyecto: v => (v === '-' ? 'Sin proyecto' : ctx.proyecto(v)?.nombre || v), estado: v => VISIBLES[v]?.etiqueta || v, q: v => `«${v}»`, hechas: () => 'Con las hechas' };
  for (const k of FILTROS) if (f[k]) c.push(`<button type="button" class="tv-fchip" data-quitar="${k}" aria-label="Quitar el filtro ${esc(nombre[k](f[k]))}">${esc(nombre[k](f[k]))}${svg('x')}</button>`);
  if (c.length > 1) c.push('<button type="button" class="tv-fchip limpiar" data-quitar="*">Quitar todos</button>');
  return c.join('');
}

export function barraFiltros(f, ctx, { orden, grupo }) {
  const opt = (v, t, sel) => `<option value="${esc(v)}"${sel === v ? ' selected' : ''}>${esc(t)}</option>`;
  return `<div class="tv-fbar" role="group" aria-label="Filtros">
    <label class="tv-sel"><span>Quién</span><select data-f="quien">${opt('', 'Todos', f.quien)}${Object.entries(QUIEN).map(([k, t]) => opt(k, t, f.quien)).join('')}</select></label>
    <label class="tv-sel"><span>Departamento</span><select data-f="dept">${opt('', 'Todos', f.dept)}${ctx.deptKeys.map(k => opt(k, ctx.depto(k).name, f.dept)).join('')}</select></label>
    <label class="tv-sel"><span>Prioridad</span><select data-f="prio">${opt('', 'Todas', f.prio)}${opt('alta', 'Alta', f.prio)}${opt('media', 'Media', f.prio)}${opt('baja', 'Baja', f.prio)}</select></label>
    <label class="tv-sel"><span>Estado</span><select data-f="estado">${opt('', 'Abiertas', f.estado)}${ORDEN_VISIBLE.map(k => opt(k, VISIBLES[k].etiqueta, f.estado)).join('')}</select></label>
    <label class="tv-sel"><span>Proyecto</span><select data-f="proyecto">${opt('', 'Todos', f.proyecto)}${opt('-', 'Sin proyecto', f.proyecto)}${ctx.proyectos().map(p => opt(p.id, p.nombre, f.proyecto)).join('')}</select></label>
    <label class="tv-sel"><span>Etiqueta</span><select data-f="etiqueta">${opt('', 'Todas', f.etiqueta)}${ctx.etiquetas().map(e => opt(e.id, '#' + e.nombre, f.etiqueta)).join('')}</select></label>
    <label class="tv-sel"><span>Ordenar</span><select data-orden>${Object.entries(ORDENES).map(([k, t]) => opt(k, t, orden)).join('')}</select></label>
    <label class="tv-sel"><span>Agrupar</span><select data-grupo>${Object.entries(GRUPOS).map(([k, t]) => opt(k, t, grupo)).join('')}</select></label>
    <label class="tv-tog"><input type="checkbox" data-f="hechas"${f.hechas ? ' checked' : ''}> Ver las hechas</label>
  </div>`;
}

export function listaHTML(tareas, f, ctx, { orden, grupo, sel }) {
  const l = ordenar(filtrar(tareas, f, ctx), orden), grupos = agrupar(l, grupo, ctx);
  const cuerpo = !l.length ? vacioHTML(Object.values(f).some(Boolean) ? 'Nada con esos filtros' : 'No hay tareas abiertas', Object.values(f).some(Boolean) ? 'Quita algún filtro para ver más.' : 'Escribe arriba para añadir una.')
    : grupos.map(g => `${g.titulo ? `<h3 class="tv-gh">${esc(g.titulo)} <span>${g.tareas.length}</span></h3>` : ''}<div class="tv-filas" role="list">${g.tareas.map(t => filaHTML(t, ctx, { elegir: true, elegida: sel.has(t.id), arrastrar: orden === 'cola' && grupo === 'nada' && t.state === 'next' })).join('')}</div>`).join('');
  return { html: cuerpo, ids: l.map(t => t.id), total: l.length };
}

export function barraSeleccion(n, ctx) {
  if (!n) return '';
  const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
  return `<div class="tv-selbar" role="region" aria-label="Acciones para las elegidas"><b>${n} ${n === 1 ? 'elegida' : 'elegidas'}</b>
    <label class="tv-sel"><span>Prioridad</span><select data-lote="prioridad">${opt('', '—')}${opt('alta', 'Alta')}${opt('media', 'Media')}${opt('baja', 'Baja')}</select></label>
    <label class="tv-sel"><span>Etiqueta</span><select data-lote="etiquetar">${opt('', '—')}${ctx.etiquetas().map(e => opt(e.id, '#' + e.nombre)).join('')}</select></label>
    <label class="tv-sel"><span>Proyecto</span><select data-lote="proyecto">${opt('', '—')}${opt('null', 'Quitar proyecto')}${ctx.proyectos().map(p => opt(p.id, p.nombre)).join('')}</select></label>
    <label class="tv-sel"><span>Fecha límite</span><input type="date" data-lote="limite"></label>
    <button type="button" class="tv-btn" data-lotebtn="pedir">Pedir las ideas</button>
    <button type="button" class="tv-btn" data-lotebtn="archivar">Archivar las hechas</button>
    <button type="button" class="tv-btn" data-lotebtn="ninguna">Quitar la selección</button></div>`;
}
