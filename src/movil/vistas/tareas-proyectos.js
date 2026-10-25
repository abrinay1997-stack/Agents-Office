// Versión móvil (25 oct 2026) — PROYECTOS: la lista (cada uno con su progreso, lo atrasado y lo bloqueado) y su detalle a pantalla
// completa: las tareas por estado, QUIÉN ESPERA A QUIÉN, «Añadir tarea», editar y borrar (con DESHACER). Un proyecto junta tareas de
// varios departamentos con una meta y una fecha. Los datos son /api/tareas/catalogo (el progreso lo calcula tareas/progreso.mjs).
import { esc, svg, vacio, falla, esqueleto, limiteTexto, ymd } from '../ui.js';
import { porEstado, bloqueos } from '../tareas-puro.js';
import { catalogo, olvidarCatalogo, hacer, hacerYa, recorte, ESTADO_AG, DEPTS, COLOR_PROY, filaMini } from './tareas-comun.js';

const COLORES = Object.keys(COLOR_PROY);
const NOMBRE_COLOR = { azul: 'Azul', verde: 'Verde', ambar: 'Ámbar', rojo: 'Rojo', violeta: 'Violeta', cian: 'Cian', rosa: 'Rosa', gris: 'Gris' };
const ESTADO_P = { activo: 'Activo', pausa: 'En pausa', terminado: 'Terminado', archivado: 'Archivado' };

function tarjeta(p) {
  const g = p.progreso || {}, lim = p.limite ? limiteTexto(p.limite) : '';
  return `<li><button type="button" class="mv-proy" data-proyecto="${esc(p.id)}" style="--pc:${COLOR_PROY[p.color] || COLOR_PROY.azul}">
    <span class="mv-proy-t"><b>${esc(p.nombre)}</b>${p.objetivo ? `<small>${esc(recorte(p.objetivo, 90))}</small>` : ''}</span>
    <span class="mv-barra" role="img" aria-label="${g.hechas || 0} de ${g.total || 0} tareas hechas"><i style="width:${g.pct || 0}%"></i></span>
    <span class="mv-chips-l"><span>${g.hechas || 0}/${g.total || 0} hechas</span>${g.enCurso ? `<span>${g.enCurso} en curso</span>` : ''}${g.bloqueadas ? `<span class="ambar">${g.bloqueadas} bloqueada${g.bloqueadas > 1 ? 's' : ''}</span>` : ''}${g.vencidas ? `<span class="rojo">${g.vencidas} vencida${g.vencidas > 1 ? 's' : ''}</span>` : ''}${lim ? `<span class="${lim.startsWith('vencida') ? 'rojo' : ''}">${esc(lim)}</span>` : ''}${g.atrasado ? '<span class="rojo">va atrasado</span>' : ''}${p.estado !== 'activo' ? `<span>${esc(ESTADO_P[p.estado] || p.estado)}</span>` : ''}</span></button></li>`;
}

export function montarProyectos(cont, ctx, { abrir, alCambiar }) {
  let verCerrados = false, cat = null, cargando = false, error = '';
  async function pintar(fresco = false) {
    if (!cat || fresco) { cargando = true; cont.innerHTML = esqueleto(3); try { cat = await catalogo(ctx, fresco); error = ''; } catch (e) { error = e.message; } cargando = false; }
    if (error) { cont.innerHTML = falla(error); return; }
    const lista = (cat.proyectos || []).filter(p => verCerrados || !['terminado', 'archivado'].includes(p.estado));
    cont.innerHTML = `<div class="mv-cab-sec"><button type="button" class="mv-btn primario" data-nuevo-proy>${svg('mas1')} Nuevo proyecto</button><button type="button" class="mv-chip" data-cerrados aria-pressed="${verCerrados}">Terminados y archivados</button></div>
      ${lista.length ? `<ul class="mv-proys">${lista.map(tarjeta).join('')}</ul>` : vacio('Todavía no hay proyectos', 'Un proyecto junta tareas de varios departamentos con una meta y una fecha: un lanzamiento, un cierre de mes, un cliente grande.', { icono: 'tareas' })}`;
  }
  cont.addEventListener('click', e => {
    if (e.target.closest('[data-reintentar]')) return pintar(true);
    if (e.target.closest('[data-nuevo-proy]')) return formulario(null);
    const c = e.target.closest('[data-cerrados]'); if (c) { verCerrados = !verCerrados; return pintar(); }
    const p = e.target.closest('[data-proyecto]'); if (p) detalle(p.dataset.proyecto);
  });

  async function detalle(id) {
    const h = ctx.hoja({ titulo: 'Proyecto', cuerpo: `<div class="mv-pdet">${esqueleto(3)}</div>`, clase: 'completa', alCerrar: () => pintar(true) });
    const raiz = h.cuerpo.querySelector('.mv-pdet');
    const pinta = async () => {
      let ags = []; try { cat = await catalogo(ctx, true); ags = await ctx.store.agentes(); } catch (e) { raiz.innerHTML = falla(e.message); return; }
      const p = (cat.proyectos || []).find(x => x.id === id); if (!p) { raiz.innerHTML = vacio('Ese proyecto ya no existe', '', { icono: 'alerta' }); return; }
      h.titulo(p.nombre);
      const porId = new Map(ctx.store.st.tareas.map(t => [t.id, t])), suyas = ctx.store.st.tareas.filter(t => t.proyecto === id && !t.archived), g = p.progreso || {}, lim = p.limite ? limiteTexto(p.limite) : '';
      const grupos = porEstado(suyas, porId), bl = bloqueos(suyas);
      raiz.innerHTML = `<div class="mv-pdet-c" style="--pc:${COLOR_PROY[p.color] || COLOR_PROY.azul}">
        ${p.objetivo ? `<p class="mv-texto">${esc(p.objetivo)}</p>` : ''}
        <div class="mv-barra grande" role="img" aria-label="${g.pct || 0} % hecho"><i style="width:${g.pct || 0}%"></i></div>
        <div class="mv-chips-l"><span><b>${g.pct || 0} %</b> · ${g.hechas || 0}/${g.total || 0} hechas</span>${g.pasos ? `<span>pasos ${g.pasosHechos}/${g.pasos}</span>` : ''}${g.bloqueadas ? `<span class="ambar">${g.bloqueadas} bloqueadas</span>` : ''}${g.vencidas ? `<span class="rojo">${g.vencidas} vencidas</span>` : ''}${lim ? `<span class="${lim.startsWith('vencida') ? 'rojo' : ''}">${esc(lim)}</span>` : ''}${g.costo ? `<span>costó US$ ${String(g.costo).replace('.', ',')}</span>` : ''}${g.atrasado ? '<span class="rojo">va atrasado</span>' : ''}<span>${esc(ESTADO_P[p.estado] || p.estado)}</span></div>
        <div class="mv-fila-btn"><button type="button" class="mv-btn primario" data-anadir-tarea>${svg('mas1')} Añadir tarea</button><button type="button" class="mv-btn" data-editar>Editar</button></div>
        ${bl.length ? `<section class="mv-sec"><h3>Quién espera a quién <span>${bl.length}</span></h3><ul class="mv-bloq">${bl.map(x => `<li><button type="button" class="mv-link mv-izq" data-abrir="${esc(x.id)}"><b>${esc(recorte(x.title, 50))}</b>${x.espera.length ? `<small>espera a: ${esc(x.espera.map(d => recorte(d.title, 32) + (d.state === 'done' ? ' (hecha)' : '')).join(', '))}</small>` : ''}${x.laEsperan.length ? `<small>la esperan: ${esc(x.laEsperan.map(d => recorte(d.title, 32)).join(', '))}</small>` : ''}</button></li>`).join('')}</ul></section>` : ''}
        ${suyas.length ? grupos.map(gr => `<h3 class="mv-gh${gr.k === 'espera_ok' || gr.k === 'fallida' ? ' rojo' : ''}">${esc(ESTADO_AG[gr.k] || gr.k)} <span>${gr.tareas.length}</span></h3><ul class="mv-lista">${gr.tareas.map(t => filaMini(t, { porId, ags })).join('')}</ul>`).join('') : vacio('Este proyecto no tiene tareas', 'Toca «Añadir tarea», o elige este proyecto en el detalle de cualquier tarea.', { icono: 'tareas' })}</div>`;
      raiz.querySelector('[data-anadir-tarea]')?.addEventListener('click', () => anadir(p, h, pinta));
      raiz.querySelector('[data-editar]')?.addEventListener('click', () => formulario(p, { alTerminar: async (borrado) => { if (borrado) h.cerrar(); else pinta(); } }));
    };
    raiz.addEventListener('click', e => { const a = e.target.closest('[data-abrir]'); if (a) abrir(a.dataset.abrir); if (e.target.closest('[data-reintentar]')) pinta(); });
    pinta();
    return h;
  }

  function anadir(p, hPadre, repintar) {
    const h = ctx.hoja({ titulo: 'Tarea para este proyecto', cuerpo: `<label class="mv-lab" for="mvPT">Qué hay que hacer</label><textarea id="mvPT" class="mv-campo" rows="2" placeholder="Diseñar las fotos del lanzamiento" autofocus></textarea>
      <label class="mv-lab" for="mvPQ">Quién la hace</label><select id="mvPQ" class="mv-campo"><option value="yo">Yo (queda en mi lista)</option>${Object.entries(DEPTS).map(([k, n]) => `<option value="${k}">Un agente de ${esc(n)}</option>`).join('')}</select><p class="mv-meta" id="mvPA">Queda en tu lista, dentro de «${esc(p.nombre)}».</p>`,
      acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: 'Añadir', tipo: 'primario', alTocar: async (x, b) => {
        const txt = x.cuerpo.querySelector('#mvPT').value.trim(), q = x.cuerpo.querySelector('#mvPQ').value; if (!txt) { x.cuerpo.querySelector('#mvPT').focus(); return; }
        const r = await hacer(ctx, b, () => (q === 'yo' ? ctx.api('/api/tareas/mias', { method: 'POST', body: { title: txt, proyecto: p.id } }) : ctx.api('/api/tasks', { method: 'POST', body: { dept: q, text: txt, proyecto: p.id } })), { ocupado: 'Añadiendo…', hecho: 'Añadida', ms: 400, aviso: `Añadida a «${recorte(p.nombre)}».` });
        if (r.ok) { await ctx.store.refrescar(); olvidarCatalogo(ctx); setTimeout(() => x.cerrar(), 350); repintar(); alCambiar(); }
      } }] });
    h.cuerpo.querySelector('#mvPQ').addEventListener('change', e => { h.cuerpo.querySelector('#mvPA').textContent = e.target.value === 'yo' ? `Queda en tu lista, dentro de «${p.nombre}».` : 'Un agente la hace; lo que envíe espera tu OK.'; });
  }

  function formulario(p, { alTerminar = () => {} } = {}) {
    const nuevo = !p;
    const h = ctx.hoja({ titulo: nuevo ? 'Nuevo proyecto' : 'Editar el proyecto', lleno: true, cuerpo: `<label class="mv-lab" for="mvFN">Nombre</label><input id="mvFN" type="text" class="mv-campo" maxlength="80" value="${esc(p?.nombre || '')}" placeholder="Lanzamiento de los lentes polarizados" autofocus>
      <label class="mv-lab" for="mvFO">Objetivo (opcional)</label><input id="mvFO" type="text" class="mv-campo" maxlength="500" value="${esc(p?.objetivo || '')}" placeholder="Vender 200 pares el primer mes">
      <label class="mv-lab" for="mvFL">Fecha límite (opcional)</label><input id="mvFL" type="date" class="mv-campo" value="${esc(p?.limite || '')}" min="${ymd(new Date())}">
      <span class="mv-lab" id="mvFCl">Color</span><div class="mv-pastillas" role="radiogroup" aria-labelledby="mvFCl">${COLORES.map(c => `<button type="button" class="mv-chip mv-color" role="radio" data-color="${c}" aria-checked="${(p?.color || 'azul') === c}" aria-pressed="${(p?.color || 'azul') === c}" style="--pc:${COLOR_PROY[c]}"><i></i>${NOMBRE_COLOR[c]}</button>`).join('')}</div>
      ${nuevo ? '' : `<label class="mv-lab" for="mvFE">Estado</label><select id="mvFE" class="mv-campo">${Object.entries(ESTADO_P).map(([k, n]) => `<option value="${k}"${p.estado === k ? ' selected' : ''}>${n}</option>`).join('')}</select>`}
      <p class="mv-err" role="alert" hidden></p>${nuevo ? '' : '<div class="mv-det-pie"><button type="button" class="mv-btn peligro" data-borrar-proy>Borrar el proyecto</button></div>'}`,
      acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: nuevo ? 'Crear el proyecto' : 'Guardar', tipo: 'primario', alTocar: async (x, b) => {
        const c = x.cuerpo, nombre = c.querySelector('#mvFN').value.trim(), err = c.querySelector('.mv-err'); err.hidden = true;
        if (!nombre) { err.hidden = false; err.textContent = 'Ponle un nombre al proyecto.'; c.querySelector('#mvFN').focus(); return; }
        const cuerpo = { nombre, objetivo: c.querySelector('#mvFO').value.trim(), limite: c.querySelector('#mvFL').value || '', color: c.querySelector('[data-color][aria-checked="true"]')?.dataset.color || 'azul', ...(nuevo ? {} : { estado: c.querySelector('#mvFE').value }) };
        const r = await hacer(ctx, b, () => (nuevo ? ctx.api('/api/tareas/proyectos', { method: 'POST', body: cuerpo }) : ctx.api(`/api/tareas/proyectos/${p.id}`, { method: 'PATCH', body: cuerpo })), { ocupado: 'Guardando…', hecho: nuevo ? 'Creado' : 'Guardado', ms: 400, aviso: nuevo ? `Proyecto creado: «${recorte(nombre)}». Añádele tareas.` : 'Proyecto guardado.' });
        if (r.ok) { olvidarCatalogo(ctx); setTimeout(() => x.cerrar(), 350); await pintar(true); alTerminar(false); if (nuevo) detalle(r.valor.proyecto.id); alCambiar(); }
      } }] });
    h.cuerpo.addEventListener('click', async e => {
      const col = e.target.closest('[data-color]'); if (col) { for (const b of h.cuerpo.querySelectorAll('[data-color]')) { const on = b === col; b.setAttribute('aria-checked', String(on)); b.setAttribute('aria-pressed', String(on)); } return; }
      if (e.target.closest('[data-borrar-proy]')) {
        if (!(await ctx.confirmar({ titulo: '¿Borrar el proyecto?', texto: `«${p.nombre}» se borra. Sus tareas se quedan, sin proyecto.`, ok: 'Borrar', peligro: true }))) return;
        h.cerrar();
        const antes = p, r = await hacerYa(ctx, () => ctx.api(`/api/tareas/proyectos/${p.id}`, { method: 'DELETE' }), {
          aviso: `Proyecto borrado: «${recorte(p.nombre)}».`, reintentar: true,
          deshacer: v => ctx.api('/api/tareas/proyectos/restaurar', { method: 'POST', body: { proyecto: v.proyecto || antes, tareas: v.tareas || [] } }),
          despues: async () => { olvidarCatalogo(ctx); await ctx.store.refrescar(); await pintar(true); alCambiar(); } });
        if (r.ok) alTerminar(true);
      }
    });
    return h;
  }
  return { pintar, nuevo: () => formulario(null), detalle };
}
