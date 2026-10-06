// La vista Tareas — PROYECTOS: cada uno con su objetivo, fecha límite y progreso (hechas, en curso, bloqueadas, vencidas, costo);
// al abrirlo, sus tareas por estado y el MAPA de dependencias (quién espera a quién), por capas: a la izquierda lo que no espera a
// nadie, a la derecha lo que espera a todo lo anterior. Cada tarea del mapa es un botón; «+ siguiente» crea una tarea que espera a esa.
// capas() es pura y tiene test.
import { visible, VISIBLES } from '../../tareas/estados.mjs';
import { esc, svg, filaHTML, vacioHTML, limiteTexto, ymd } from './comun.js';

export const COLORES = ['azul', 'verde', 'ambar', 'rojo', 'violeta', 'cian', 'rosa', 'gris'];
export const NOMBRE_COLOR = { azul: 'Azul', verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo', violeta: 'Violeta', cian: 'Cian', rosa: 'Rosa', gris: 'Gris' };

// el mapa: capa = el camino más largo desde algo que no espera a nadie (dentro del conjunto); fila = orden dentro de la capa
export function capas(tareas) {
  const ids = new Set(tareas.map(t => t.id)), deps = new Map(tareas.map(t => [t.id, (t.bloqueadaPor || []).filter(x => ids.has(x))]));
  const capa = new Map(), visitando = new Set();
  const de = id => { if (capa.has(id)) return capa.get(id); if (visitando.has(id)) return 0; visitando.add(id); const c = Math.max(-1, ...deps.get(id).map(de)) + 1; visitando.delete(id); capa.set(id, c); return c; };
  for (const t of tareas) de(t.id);
  const filas = new Map(); const nodos = tareas.map(t => { const c = capa.get(t.id); const f = filas.get(c) || 0; filas.set(c, f + 1); return { id: t.id, capa: c, fila: f }; });
  const aristas = tareas.flatMap(t => deps.get(t.id).map(d => ({ de: d, a: t.id })));
  return { nodos, aristas, ancho: Math.max(0, ...nodos.map(n => n.capa)) + 1, alto: Math.max(0, ...[...filas.values()]) };
}

export function proyectosHTML(cat, ctx, { mostrarCerrados = false } = {}) {
  const lista = cat.proyectos.filter(p => mostrarCerrados || !['terminado', 'archivado'].includes(p.estado));
  const tarjeta = p => {
    const g = p.progreso || {}, lim = limiteTexto(p.limite);
    return `<article class="tv-pcard c-${esc(p.color)}${g.atrasado ? ' atrasado' : ''}" data-proyecto="${esc(p.id)}">
      <button type="button" class="tv-ptit" data-abrirp="${esc(p.id)}"><b>${esc(p.nombre)}</b>${p.objetivo ? `<small>${esc(p.objetivo)}</small>` : ''}</button>
      <div class="tv-pbar" role="img" aria-label="${g.hechas || 0} de ${g.total || 0} tareas hechas"><i style="width:${g.pct || 0}%"></i></div>
      <div class="tv-chips"><span class="tv-c">${g.hechas || 0}/${g.total || 0} hechas</span>${g.enCurso ? `<span class="tv-c">${g.enCurso} en curso</span>` : ''}${g.bloqueadas ? `<span class="tv-c tv-c-lim ambar">${g.bloqueadas} bloqueada${g.bloqueadas > 1 ? 's' : ''}</span>` : ''}${g.vencidas ? `<span class="tv-c tv-c-lim rojo">${g.vencidas} vencida${g.vencidas > 1 ? 's' : ''}</span>` : ''}${lim ? `<span class="tv-c tv-c-lim ${lim.tono}">${esc(lim.texto)}</span>` : ''}${g.costo ? `<span class="tv-c">US$ ${String(g.costo).replace('.', ',')}</span>` : ''}${p.estado !== 'activo' ? `<span class="tv-c">${esc(p.estado)}</span>` : ''}</div>
    </article>`;
  };
  return `<div class="tv-phead"><button type="button" class="tv-btn pri" data-nuevop>${svg('mas')}Nuevo proyecto</button>
    <label class="tv-tog"><input type="checkbox" data-cerrados${mostrarCerrados ? ' checked' : ''}> Ver terminados y archivados</label></div>
    ${lista.length ? `<div class="tv-pgrid">${lista.map(tarjeta).join('')}</div>` : vacioHTML('Todavía no hay proyectos', 'Un proyecto junta tareas de varios departamentos con una meta y una fecha: un lanzamiento, un cierre de mes, un cliente grande.')}`;
}

export function formProyectoHTML(p = {}) {
  return `<form class="tv-pform" data-formp="${esc(p.id || '')}"><h3>${p.id ? 'Editar el proyecto' : 'Nuevo proyecto'}</h3>
    <label>Nombre<input name="nombre" required maxlength="80" value="${esc(p.nombre || '')}" placeholder="Lanzamiento de los lentes polarizados"></label>
    <label>Objetivo <small>(opcional)</small><input name="objetivo" maxlength="500" value="${esc(p.objetivo || '')}" placeholder="Vender 200 pares el primer mes"></label>
    <div class="tv-dos"><label>Fecha límite <small>(opcional)</small><input type="date" name="limite" value="${esc(p.limite || '')}" min="${ymd(new Date())}"></label>
    <label>Color<select name="color">${COLORES.map(c => `<option value="${c}"${(p.color || 'azul') === c ? ' selected' : ''}>${NOMBRE_COLOR[c]}</option>`).join('')}</select></label></div>
    ${p.id ? `<label>Estado<select name="estado">${['activo', 'pausa', 'terminado', 'archivado'].map(e => `<option value="${e}"${p.estado === e ? ' selected' : ''}>${{ activo: 'Activo', pausa: 'En pausa', terminado: 'Terminado', archivado: 'Archivado' }[e]}</option>`).join('')}</select></label>` : ''}
    <p class="tv-err" role="alert" hidden></p>
    <div class="tv-acc"><button type="submit" class="tv-btn pri">${p.id ? 'Guardar' : 'Crear el proyecto'}</button><button type="button" class="tv-btn" data-cancelarp>Cancelar</button>${p.id ? '<button type="button" class="tv-btn peligro" data-borrarp>Borrar el proyecto</button>' : ''}</div></form>`;
}

export function proyectoHTML(p, tareas, ctx, { mapa = false } = {}) {
  const suyas = tareas.filter(t => t.proyecto === p.id && !t.archived), g = p.progreso || {};
  const orden = ['espera_ok', 'en_curso', 'bloqueada', 'en_manos', 'en_cola', 'programada', 'idea', 'hecha', 'fallida'];
  const grupos = orden.map(k => ({ k, l: suyas.filter(t => visible(t, ctx.porId) === k) })).filter(x => x.l.length);
  let cuerpo;
  if (!suyas.length) cuerpo = vacioHTML('Este proyecto no tiene tareas', 'Añade una arriba, o elige este proyecto en el detalle de cualquier tarea.');
  else if (mapa) cuerpo = mapaHTML(suyas, ctx);
  else cuerpo = grupos.map(x => `<h3 class="tv-gh">${esc(VISIBLES[x.k].etiqueta)} <span>${x.l.length}</span></h3><div class="tv-filas" role="list">${x.l.map(t => filaHTML(t, ctx)).join('')}</div>`).join('');
  const lim = limiteTexto(p.limite);
  return `<div class="tv-pdet c-${esc(p.color)}"><div class="tv-pdh"><button type="button" class="tv-btn" data-volverp>← Proyectos</button>
      <h2>${esc(p.nombre)}</h2><button type="button" class="tv-btn" data-editarp="${esc(p.id)}">Editar</button></div>
    ${p.objetivo ? `<p class="tv-pobj">${esc(p.objetivo)}</p>` : ''}
    <div class="tv-pbar grande" role="img" aria-label="${g.pct || 0} % hecho"><i style="width:${g.pct || 0}%"></i></div>
    <div class="tv-chips"><span class="tv-c">${g.pct || 0} % · ${g.hechas || 0}/${g.total || 0} hechas</span>${g.pasos ? `<span class="tv-c">pasos ${g.pasosHechos}/${g.pasos}</span>` : ''}${g.bloqueadas ? `<span class="tv-c tv-c-lim ambar">${g.bloqueadas} bloqueadas</span>` : ''}${g.vencidas ? `<span class="tv-c tv-c-lim rojo">${g.vencidas} vencidas</span>` : ''}${lim ? `<span class="tv-c tv-c-lim ${lim.tono}">${esc(lim.texto)}</span>` : ''}${g.costo ? `<span class="tv-c">costó US$ ${String(g.costo).replace('.', ',')}</span>` : ''}${g.atrasado ? '<span class="tv-c tv-c-lim rojo">va atrasado</span>' : ''}</div>
    <div class="tv-pseg" role="group" aria-label="Cómo verlo"><button type="button" aria-pressed="${!mapa}" data-pmodo="lista">Por estado</button><button type="button" aria-pressed="${mapa}" data-pmodo="mapa">${svg('mapa')}Mapa</button>
      <button type="button" class="tv-btn" data-anadirp="${esc(p.id)}">${svg('mas')}Añadir tarea al proyecto</button></div>
    ${cuerpo}</div>`;
}

function mapaHTML(tareas, ctx) {
  const { nodos, aristas, ancho, alto } = capas(tareas), W = 236, H = 92, GX = 60, GY = 16;
  const pos = new Map(nodos.map(n => [n.id, { x: n.capa * (W + GX), y: n.fila * (H + GY) }]));
  const anchoPx = ancho * (W + GX) - GX, altoPx = Math.max(1, alto) * (H + GY) - GY;
  const lineas = aristas.map(e => { const a = pos.get(e.de), b = pos.get(e.a); const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, m = (x1 + x2) / 2; const hecha = ctx.porId.get(e.de)?.state === 'done'; return `<path d="M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2 - 6} ${y2}" class="${hecha ? 'hecha' : ''}" marker-end="url(#tvFlecha)"/>`; }).join('');
  const caja = t => { const p = pos.get(t.id), v = visible(t, ctx.porId), a = ctx.agente(t.agent); return `<div class="tv-nodo v-${v}" style="left:${p.x}px;top:${p.y}px;width:${W}px;height:${H}px"><button type="button" class="tv-tit" data-abrir="${esc(t.id)}">${esc(t.title)}</button><small>${esc(VISIBLES[v].etiqueta)}${a ? ' · ' + esc(a.name) : ''}</small><button type="button" class="tv-sig" data-siguiente="${esc(t.id)}" aria-label="Añadir una tarea que espere a «${esc(t.title)}»" title="Añadir una tarea que espere a esta">+ siguiente</button></div>`; };
  return `<p class="tv-ayuda">De izquierda a derecha: cada flecha va de lo que hay que terminar antes a lo que lo espera.</p><div class="tv-mapa" role="region" aria-label="Mapa de dependencias" tabindex="0"><div class="tv-mapai" style="width:${anchoPx}px;height:${altoPx}px">
    <svg width="${anchoPx}" height="${altoPx}" aria-hidden="true"><defs><marker id="tvFlecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10Z"/></marker></defs>${lineas}</svg>
    ${tareas.map(caja).join('')}</div></div>`;
}
