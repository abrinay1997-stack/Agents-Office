// Versión móvil (25 oct 2026) — el TABLERO de Tareas: una columna por estado, que se desliza de lado (cada una ocupa casi toda la
// pantalla y la siguiente asoma). No se arrastra: «Mover a…» abre una hoja con los pasos que de verdad se pueden dar con esa tarea
// (los mismos que el tablero de escritorio: src/tareas/tablero.js → movimiento) y cada uno se puede DESHACER.
import { ordenCola } from '../../../tareas/cola.mjs';
import { esDelDueno, agenteDeOrigen } from '../../../tareas/dueno.mjs';
import { visible } from '../../../tareas/estados.mjs';
import { COLUMNAS, columnaDe, destinos } from '../tareas-puro.js';
import { esc, svg, vacio, limiteTexto } from '../ui.js';
import { hacerYa, recorte, DEPTS } from './tareas-comun.js';

export function vivas(tareas, ahora = Date.now()) { return tareas.filter(t => !t.archived && !t.piece && !(t.state === 'done' && (t.doneAt || 0) < ahora - 48 * 3600e3)); }

export function tableroHTML(tareas, ctx, { col = '' } = {}) {
  const porId = new Map(ctx.store.st.tareas.map(t => [t.id, t])), v = vivas(tareas);
  const por = new Map(COLUMNAS.map(c => [c.k, []])); for (const t of v) por.get(columnaDe(t, porId))?.push(t);
  for (const [k, l] of por) l.sort(k === 'hecha' ? (a, b) => (b.doneAt || 0) - (a.doneAt || 0) : ordenCola);
  if (!v.length) return vacio('No hay tareas vivas', 'Lo que pidas, lo que programes y lo que haga la oficina aparece aquí por estado.', { icono: 'tareas' });
  const tarjeta = t => {
    const vis = visible(t, porId), lim = t.limite ? limiteTexto(t.limite) : '', quien = esDelDueno(t) ? 'Tuya' : t.person ? '👤 ' + t.person : (t.agent && ctx._ags?.find(a => a.id === t.agent)?.name) || DEPTS[t.dept] || '';
    return `<li class="mv-tj ${vis}"><button type="button" class="mv-tj-t" data-abrir="${esc(t.id)}"><span class="mv-fila-t">${esc(t.title)}</span><span class="mv-fila-m">${quien ? `<span>${esc(quien)}</span>` : ''}${t.prioridad === 'alta' ? '<span class="alta">Alta</span>' : ''}${lim ? `<span class="${lim.startsWith('vencida') ? 'rojo' : ''}">${esc(lim)}</span>` : ''}${vis === 'fallida' ? '<span class="rojo">Falló</span>' : ''}${(t.bloqueadaPor || []).length ? '<span>Bloqueada</span>' : ''}</span></button>
      <button type="button" class="mv-mover" data-mover="${esc(t.id)}" aria-label="Mover «${esc(recorte(t.title, 40))}» a otra columna">${svg('flecha')}<span>Mover</span></button></li>`;
  };
  return `<nav class="mv-chips mv-colchips" aria-label="Ir a una columna">${COLUMNAS.map(c => `<button type="button" class="mv-chip" data-col-ir="${c.k}">${esc(c.titulo)}<b>${por.get(c.k).length}</b></button>`).join('')}</nav>
    <div class="mv-tablero" role="region" aria-label="Tablero de tareas, desliza para ver las columnas" tabindex="0">${COLUMNAS.map(c => `<section class="mv-col" data-col="${c.k}" aria-label="${esc(c.titulo)}"><h3>${esc(c.titulo)} <span>${por.get(c.k).length}</span></h3>${por.get(c.k).length ? `<ul>${por.get(c.k).map(tarjeta).join('')}</ul>` : '<p class="mv-nada">Nada aquí.</p>'}</section>`).join('')}</div>`;
}

/** Monta el tablero en `cont`: un solo oyente; devuelve { pintar }. */
export function montarTablero(cont, ctx, { abrir, alCambiar }) {
  let inicial = false;
  const pintar = async () => {
    ctx._ags ||= await ctx.store.agentes();
    const sc = cont.querySelector('.mv-tablero')?.scrollLeft || 0;
    cont.innerHTML = tableroHTML(ctx.store.st.tareas, ctx); const t = cont.querySelector('.mv-tablero'); if (t) t.scrollLeft = sc;
    if (t && !inicial) { inicial = true; const c = [...t.querySelectorAll('.mv-col')].find(x => x.querySelector('li')); if (c && c !== t.firstElementChild) t.scrollLeft = c.offsetLeft - t.offsetLeft - 16; } // la primera vez, la primera columna que tiene algo
  };
  cont.addEventListener('click', e => {
    const ir = e.target.closest('[data-col-ir]'); if (ir) { const c = cont.querySelector(`.mv-col[data-col="${ir.dataset.colIr}"]`); c?.scrollIntoView({ inline: 'start', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
    const m = e.target.closest('[data-mover]'); if (m) return mover(m.dataset.mover);
    const a = e.target.closest('[data-abrir]'); if (a) abrir(a.dataset.abrir);
  });
  function mover(id) {
    const porId = new Map(ctx.store.st.tareas.map(t => [t.id, t])), t = porId.get(id); if (!t) return;
    const ds = destinos(t, porId), col = COLUMNAS.find(c => c.k === columnaDe(t, porId));
    const h = ctx.hoja({ titulo: 'Mover a…', cuerpo: `<p class="mv-meta">«${esc(recorte(t.title, 70))}» está en <b>${esc(col?.titulo || '')}</b>.</p>${ds.length ? `<ul class="mv-lista mv-destinos">${ds.map(d => `<li><button type="button" class="mv-lista-b" data-dest="${esc(d.accion)}" data-col="${esc(d.k)}"><span>${esc(d.titulo)}<small>${esc(d.texto[0].toUpperCase() + d.texto.slice(1))}</small></span>${svg('der', 'mv-lista-i')}</button></li>`).join('')}</ul>` : vacio('No se puede mover', 'Por su estado, esta tarea no puede pasar a otra columna. Ábrela para ver qué se puede hacer con ella.', { icono: 'alerta' })}` });
    h.cuerpo.addEventListener('click', async e => { const b = e.target.closest('[data-dest]'); if (!b) return; h.cerrar(); setTimeout(() => ejecutar(t, b.dataset.dest, porId), 260); });
  }
  const estado = (id, a) => ctx.api(`/api/tareas/${id}/estado`, { method: 'POST', body: { a } });
  async function ejecutar(t, acc, porId) {
    const n = `«${recorte(t.title, 40)}»`, id = t.id, fin = () => { alCambiar(); ctx.store.refrescar(); };
    const hy = (fn, o) => hacerYa(ctx, fn, { despues: fin, reintentar: true, ...o });
    switch (acc) {
      case 'pedir': return hy(() => estado(id, 'next'), { aviso: `Pedida: ${n}.`, deshacer: () => estado(id, 'idea') });
      case 'aparcar': return hy(() => estado(id, 'idea'), { aviso: `${n} vuelve a ideas.`, deshacer: () => estado(id, 'next') });
      case 'hecha': return hy(() => estado(id, 'done'), { aviso: esDelDueno(t) ? `Hecha: ${n}.` : `${n} marcada como hecha, sin ejecutarla.`, deshacer: () => estado(id, 'next') });
      case 'tomar': { const prev = { agente: t.agent, dept: t.dept, estado: t.state, dueAt: t.dueAt }; return hy(() => ctx.api(`/api/tareas/${id}/tomar`, { method: 'POST', body: {} }), { aviso: `Es tuya: ${n}. Está en tu lista.`, deshacer: () => ctx.api(`/api/tareas/${id}/delegar`, { method: 'POST', body: { a: 'agente', ...prev, deshacer: true } }) }); }
      case 'devolver': {
        if (!esDelDueno(t)) return hy(() => ctx.api(`/api/tasks/${id}/person`, { method: 'POST', body: { person: '' } }), { aviso: `${n} vuelve a los agentes.`, deshacer: () => ctx.api(`/api/tasks/${id}/person`, { method: 'POST', body: { person: t.person } }) });
        const o = ctx._ags?.find(a => a.id === agenteDeOrigen(t) || a.id === t.agent); if (!o) { ctx.toast('No sé a qué agente devolverla: delégala desde su detalle.'); return; }
        return hy(() => ctx.api(`/api/tareas/${id}/delegar`, { method: 'POST', body: { a: 'agente', dept: o.department, agente: o.id } }), { aviso: `${n} vuelve a ${o.name}.`, deshacer: () => ctx.api(`/api/tareas/${id}/tomar`, { method: 'POST', body: { deshacer: true, deAgente: o.id } }) });
      }
      case 'ya': { const prev = t.dueAt; return hy(() => ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { at: null } }), { aviso: `${n} arranca ya.`, deshacer: prev > Date.now() ? () => ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { at: prev } }) : null }); }
      case 'aprobar': return ctx.navegar('aprobaciones', { id });
      case 'repetir': return hy(() => ctx.api(`/api/tasks/${id}/repeat`, { method: 'POST', body: {} }), { aviso: x => `Otra vez: «${recorte(x.title)}».`, deshacer: x => ctx.api(`/api/tasks/${x.id}`, { method: 'DELETE' }) });
    }
  }
  return { pintar };
}
