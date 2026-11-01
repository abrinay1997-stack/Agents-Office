// Versión móvil (25 oct 2026) — INICIO: «¿qué necesito hacer ahora?» en los primeros 400 px.
// Rehecho el 1 nov 2026 (pedido del dueño desde su iPhone): las acciones rápidas arriba (a la altura del pulgar), lo urgente primero
// (qué falla y por qué, lo que espera tu OK), luego hoy, lo que viene (sin cosas dobles), avisos (sin repetir) y los conectores en una fila.
// Todo sale del `store` compartido: el número de aprobaciones aquí y en la cabecera es el mismo. Lo puro vive en ../inicio-puro.js (con test).
import { deLista } from '../../../tareas/dueno.mjs';
import { eventos, horaDe } from '../agenda.js';
import { esc, svg, esqueleto, falla, hace, limiteTexto } from '../ui.js';
import { lineaHTML, abrirConectores } from '../conectores.js';
import { abrirAvisos } from '../avisos.js';
import { avisosSinRepetir, proximosPorDia, motivoAtencion, saludoDe, resumenHoy } from '../inicio-puro.js';

const fechaHoy = () => new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' }).replace(/^./, c => c.toUpperCase());
const empresa = () => document.title.replace(/ — Agents Office$/, '').replace(/^Agents Office$/, '') || 'tu oficina';
const DIA = 864e5;

const acciones = () => `<div class="mv-acc-fila" role="group" aria-label="Acciones rápidas">
  <button type="button" class="mv-acc-p" data-nueva>${svg('mas1')}<span>Añadir tarea</span></button>
  <button type="button" data-dim aria-label="Hablar con Dimitri, tu asistente">${svg('dimitri')}<span>Dimitri</span></button>
  <button type="button" data-agenda aria-label="Ver la agenda">${svg('calendario')}<span>Agenda</span></button></div>`;

export function registrar(shell) {
  shell.registrarVista({
    id: 'inicio', titulo: () => empresa() || 'Inicio', icono: 'inicio', grupo: 'tab',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo mv-ini" aria-live="polite"></div></div>';
      let mcp = null, ult = 0, refrescando = false;
      const cargaMcp = () => ctx.store.conectores().then(j => { mcp = j; pintar(); }).catch(() => { if (!mcp) mcp = false; pintar(); });
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll'), st = ctx.store.st;
      const cabecera = () => `<div class="mv-ini-cab"><h2 class="mv-saludo-t">${saludoDe()}</h2><span class="mv-fecha">${esc(fechaHoy())}</span></div>${acciones()}`;
      function pintar() {
        if (!st.cargado) { cuerpo.innerHTML = st.error ? falla(st.error) : `${cabecera()}${esqueleto(3)}`; return; }
        const ahora = Date.now(), aprob = ctx.store.aprobaciones, lista = deLista(st.tareas, 'hoy'), hoy = lista.pendientes, hechas = lista.hechas.length;
        const d0 = new Date(ahora); d0.setHours(0, 0, 0, 0);
        const prox = proximosPorDia(eventos({ tareas: st.tareas, rutinas: st.rutinas, desde: ahora - 60e3, hasta: d0.getTime() + 4 * DIA }), { ahora, max: 4 });
        const av = avisosSinRepetir(st.status?.notices, { ahora }), avHoy = av.hoy.slice(0, 3), estado = st.status?.overall;
        const motivo = motivoAtencion(st.status, { excluir: aprob.length ? ['aprobaciones'] : [] });
        const hayEstado = estado && estado !== 'ok' && estado !== 'info';
        const banda = motivo
          ? `<button type="button" class="mv-banda ${motivo.tono}" data-estado data-ir="${esc(motivo.ir)}">${svg('alerta')}<span><b>${esc(motivo.texto)}</b><small>${motivo.mas ? `y ${motivo.mas} ${motivo.mas === 1 ? 'cosa más' : 'cosas más'} · Ver el estado` : 'Tocar para resolverlo'}</small></span>${svg('der', 'mv-der')}</button>`
          : hayEstado ? `<button type="button" class="mv-banda ${estado === 'bad' ? 'bad' : 'warn'}" data-estado data-ir="estado">${svg('alerta')}<span><b>${estado === 'bad' ? 'Algo falla en la oficina' : 'Algo necesita atención'}</b><small>Ver el estado</small></span>${svg('der', 'mv-der')}</button>` : '';
        const okCard = aprob.length ? `<section class="mv-card alerta" aria-label="Esperan tu visto bueno"><button type="button" class="mv-card-cab" data-aprob><span class="mv-card-t">${svg('alerta')} Esperan tu OK <b>${aprob.length}</b></span><span class="mv-card-ir">Revisar</span>${svg('der', 'mv-der')}</button><ul class="mv-mini">${aprob.slice(0, 2).map(t => `<li>${esc(t.title)}</li>`).join('')}${aprob.length > 2 ? `<li class="mv-mas-n">y ${aprob.length - 2} más</li>` : ''}</ul></section>` : '';
        const tuyo = hoy.length
          ? `<section class="mv-card" aria-label="Lo tuyo hoy"><button type="button" class="mv-card-cab" data-tareas><span class="mv-card-t">${svg('tareas')} Lo tuyo hoy <b>${hoy.length}</b></span><span class="mv-card-ir">${esc(resumenHoy(hoy.length, hechas))}</span>${svg('der', 'mv-der')}</button>
              <ul class="mv-filas">${hoy.slice(0, 3).map(t => `<li class="mv-fila" data-id="${esc(t.id)}"><button type="button" class="mv-check" data-hecha aria-label="Marcar como hecha: ${esc(t.title)}"><i>${svg('check')}</i></button><button type="button" class="mv-fila-cuerpo" data-abrir><span class="mv-fila-t">${esc(t.title)}</span>${t.limite ? `<span class="mv-fila-m"><span class="${limiteTexto(t.limite).startsWith('vencida') ? 'rojo' : ''}">${esc(limiteTexto(t.limite))}</span></span>` : ''}</button></li>`).join('')}</ul>${hoy.length > 3 ? `<button type="button" class="mv-mas-link" data-tareas>Ver las ${hoy.length}</button>` : ''}</section>`
          : `<button type="button" class="ini-linea" data-tareas aria-label="Lo tuyo hoy: ${esc(resumenHoy(0, hechas))}. Abrir tus tareas">${svg('tareas')}<span class="ini-linea-t">Lo tuyo hoy</span><span class="ini-linea-m ok">${hechas ? esc(resumenHoy(0, hechas)) : 'Nada pendiente ✓'}</span>${svg('der', 'mv-der')}</button>`;
        const viene = prox.total
          ? `<section class="mv-card" aria-label="Lo que viene"><button type="button" class="mv-card-cab" data-agenda><span class="mv-card-t">${svg('calendario')} Lo que viene</span>${svg('der', 'mv-der')}</button>
              ${prox.grupos.map(g => `<h3 class="ini-dia">${esc(g.titulo)}</h3><ul class="ini-evs">${g.items.map(e => `<li><button type="button" class="ini-ev" data-ev data-id="${esc(e.id || '')}" data-tipo="${esc(e.tipo)}"><time>${e.conHora ? esc(horaDe(e)) : 'Todo el día'}</time><span class="ini-ev-t">${esc(e.titulo)}</span>${e.vence ? '<em>vence</em>' : e.tipo === 'rutina' ? '<em class="rut">rutina</em>' : ''}</button></li>`).join('')}</ul>`).join('')}
              <button type="button" class="mv-mas-link" data-agenda>${prox.resto ? `Ver agenda · ${prox.resto} más` : 'Ver agenda'}</button></section>`
          : `<button type="button" class="ini-linea" data-agenda aria-label="Lo que viene: nada programado en los próximos días. Abrir la agenda">${svg('calendario')}<span class="ini-linea-t">Lo que viene</span><span class="ini-linea-m">Nada en 3 días</span>${svg('der', 'mv-der')}</button>`;
        const avisos = av.total
          ? `<section class="mv-card" aria-label="Avisos"><div class="mv-card-cab static"><span class="mv-card-t">${svg('nube')} Avisos <b>${av.total}</b></span><button type="button" class="mv-link" data-leidos>Marcar leídos</button></div>
              ${avHoy.length ? `<ul class="mv-mini mv-iavs">${avHoy.map(n => `<li class="${esc(n.level || '')}">${n.task ? `<button type="button" class="mv-iav" data-tarea="${esc(n.task)}">` : '<div class="mv-iav">'}<span class="mv-iav-t">${esc(String(n.text).replace(/`/g, '').slice(0, 160))}</span> <time>${n.t ? esc(hace(n.t)) : ''}</time>${n.task ? '</button>' : '</div>'}</li>`).join('')}</ul>` : '<p class="mv-nada">Nada nuevo hoy.</p>'}
              <button type="button" class="mv-mas-link" data-avisos>${av.antes.length ? `Antes de hoy · ${av.antes.length}${av.hoy.length > 3 ? ` · y ${av.hoy.length - 3} de hoy` : ''} · Ver todos` : av.hoy.length > 3 ? `Ver los ${av.hoy.length}` : 'Ver todos'}</button></section>`
          : `<button type="button" class="ini-linea" data-avisos aria-label="Avisos: todo al día. Abrir">${svg('nube')}<span class="ini-linea-t">Avisos</span><span class="ini-linea-m ok">Todo al día ✓</span>${svg('der', 'mv-der')}</button>`;
        const cx = mcp === false ? `<button type="button" class="ini-linea" data-conectores aria-label="Conectores: no se pudieron leer. Abrir">${svg('conectores')}<span class="ini-linea-t">Conectores</span><span class="ini-linea-m warn">No se pudieron leer</span>${svg('der', 'mv-der')}</button>` : mcp ? lineaHTML(mcp) : '<div class="ini-linea ini-linea-esq" aria-hidden="true"></div>';
        const pie = `<div class="mv-ini-pie"><button type="button" class="mv-link" data-refrescar ${refrescando ? 'aria-busy="true"' : ''}>${refrescando ? 'Actualizando…' : ult ? `Actualizado ${esc(hace(ult))} · Actualizar` : 'Actualizar'}</button></div>`;
        cuerpo.innerHTML = `${cabecera()}${banda}${okCard}${tuyo}${viene}${avisos}${cx}${pie}`;
      }
      cuerpo.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if ('estado' in b.dataset) { const ir = b.dataset.ir; return !ir || ir === 'estado' ? ctx.escritorio('estado') : ctx.navegar(ir); }
        if ('aprob' in b.dataset) return ctx.navegar('aprobaciones');
        if ('tareas' in b.dataset) return ctx.navegar('tareas', { l: 'hoy' });
        if ('agenda' in b.dataset) return ctx.navegar('calendario');
        if ('nueva' in b.dataset) return ctx.navegar('tareas', { nueva: 1 });
        if ('dim' in b.dataset) return ctx.navegar('dimitri');
        if ('ev' in b.dataset) return b.dataset.id && b.dataset.tipo !== 'rutina' ? ctx.navegar('tareas', { t: b.dataset.id }) : ctx.navegar('calendario');
        if ('conectores' in b.dataset) { try { abrirConectores(ctx, await ctx.store.conectores(true)); } catch (er) { ctx.toast('No se pudieron leer los conectores: ' + er.message); } return; }
        if ('tarea' in b.dataset) return ctx.navegar('tareas', { t: b.dataset.tarea });
        if ('avisos' in b.dataset) return abrirAvisos(ctx);
        if ('refrescar' in b.dataset) { refrescando = true; pintar(); try { await ctx.store.refrescar(); } catch {} refrescando = false; pintar(); return; }
        if ('leidos' in b.dataset) { try { await ctx.api('/api/notices/read', { method: 'POST', body: {} }); } catch {} return ctx.store.refrescar(); }
        if (b.hasAttribute('data-reintentar')) return ctx.store.refrescar();
        const li = b.closest('.mv-fila'); if (!li) return;
        if (b.hasAttribute('data-abrir')) return ctx.navegar('tareas', { t: li.dataset.id });
        if (b.hasAttribute('data-hecha')) {
          const t = st.tareas.find(x => x.id === li.dataset.id); if (!t) return; t.state = 'done'; t.doneAt = Date.now(); pintar();
          try { await ctx.api(`/api/tareas/${t.id}/estado`, { method: 'POST', body: { a: 'done' } }); ctx.toast(`Hecha: «${t.title.slice(0, 36)}»`, { accion: 'Deshacer', alAccion: async () => { try { await ctx.api(`/api/tareas/${t.id}/estado`, { method: 'POST', body: { a: 'next' } }); } catch {} ctx.store.refrescar(); } }); }
          catch (er) { t.state = 'next'; pintar(); ctx.toast('No se pudo: ' + er.message); }
          ctx.store.refrescar();
        }
      });
      ctx.tirar(sc, () => ctx.store.refrescar());
      ctx.store.alCambiar(() => { ult = Date.now(); if (!el.hidden) pintar(); });
      el._mcp = cargaMcp; pintar(); cargaMcp();
    },
    alMostrar(el, ctx) { ctx.store.refrescar(); el._mcp?.(); },
  });
}
