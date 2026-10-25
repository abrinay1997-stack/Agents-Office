// Versión móvil (25 oct 2026) — INICIO: el resumen de hoy en una pantalla. Lo que espera tu visto bueno, lo tuyo de hoy (con casilla), lo
// que viene en el calendario, los avisos de la oficina y cuatro atajos grandes. Todo sale del `store` compartido: el número de
// aprobaciones aquí y en la cabecera es el mismo.
import { deLista, esDelDueno } from '../../../tareas/dueno.mjs';
import { eventos, horaDe, etiquetaDia } from '../agenda.js';
import { esc, svg, esqueleto, falla, hace, limiteTexto } from '../ui.js';
import { tarjetaHTML, abrirConectores } from '../conectores.js';
import { abrirAvisos } from '../avisos.js';
import { ymd } from '../ui.js';

const saludo = () => { const h = new Date().getHours(); return h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
const fechaHoy = () => { const t = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }); return t[0].toUpperCase() + t.slice(1); };
const empresa = () => document.title.replace(/ — Agents Office$/, '').replace(/^Agents Office$/, '') || 'tu oficina';

export function registrar(shell) {
  shell.registrarVista({
    id: 'inicio', titulo: () => empresa() || 'Inicio', icono: 'inicio', grupo: 'tab',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo" aria-live="polite"></div></div>';
      let mcp = null; const cargaMcp = () => ctx.store.conectores().then(j => { mcp = j; pintar(); }).catch(() => {});
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll'), st = ctx.store.st;
      function pintar() {
        if (!st.cargado) { cuerpo.innerHTML = st.error ? falla(st.error) : `<h2 class="mv-saludo-t">${saludo()}</h2>${esqueleto(4)}`; return; }
        const aprob = ctx.store.aprobaciones, hoy = deLista(st.tareas, 'hoy').pendientes, d = new Date(); d.setHours(0, 0, 0, 0);
        const evs = eventos({ tareas: st.tareas, rutinas: st.rutinas, desde: Date.now() - 60e3, hasta: d.getTime() + 2 * 864e5 }).slice(0, 4);
        const avisos = (st.status?.notices || []).filter(n => !n.read).slice(0, 3), estado = st.status?.overall;
        cuerpo.innerHTML = `
          <h2 class="mv-saludo-t">${saludo()}</h2><p class="mv-fecha">${esc(fechaHoy())}</p>
          ${estado && estado !== 'ok' && estado !== 'info' ? `<button type="button" class="mv-banda ${estado}" data-estado>${svg('alerta')}<span><b>${estado === 'bad' ? 'Algo falla en la oficina' : 'Algo necesita atención'}</b><small>Ver el estado</small></span>${svg('der', 'mv-der')}</button>` : ''}
          ${aprob.length ? `<section class="mv-card alerta" aria-label="Esperan tu visto bueno"><button type="button" class="mv-card-cab" data-aprob><span class="mv-card-t">${svg('alerta')} Esperan tu OK <b>${aprob.length}</b></span>${svg('der', 'mv-der')}</button><ul class="mv-mini">${aprob.slice(0, 2).map(t => `<li>${esc(t.title)}</li>`).join('')}</ul></section>` : ''}
          <section class="mv-card" aria-label="Lo tuyo hoy"><button type="button" class="mv-card-cab" data-tareas><span class="mv-card-t">${svg('tareas')} Lo tuyo hoy <b>${hoy.length}</b></span>${svg('der', 'mv-der')}</button>
            ${hoy.length ? `<ul class="mv-filas">${hoy.slice(0, 4).map(t => `<li class="mv-fila" data-id="${esc(t.id)}"><button type="button" class="mv-check" data-hecha aria-label="Marcar como hecha: ${esc(t.title)}"><i>${svg('check')}</i></button><button type="button" class="mv-fila-cuerpo" data-abrir><span class="mv-fila-t">${esc(t.title)}</span>${t.limite ? `<span class="mv-fila-m"><span class="${limiteTexto(t.limite).startsWith('vencida') ? 'rojo' : ''}">${esc(limiteTexto(t.limite))}</span></span>` : ''}</button></li>`).join('')}</ul>${hoy.length > 4 ? `<button type="button" class="mv-mas-link" data-tareas>Ver las ${hoy.length}</button>` : ''}` : '<p class="mv-nada">Nada para hoy. Buen momento para adelantar algo.</p>'}</section>
          <section class="mv-card" aria-label="Lo que viene"><button type="button" class="mv-card-cab" data-agenda><span class="mv-card-t">${svg('calendario')} Lo que viene</span>${svg('der', 'mv-der')}</button>
            ${evs.length ? `<ul class="mv-mini ev">${evs.map(e => `<li><time>${esc(etiquetaDia(ymd(new Date(e.at))))} · ${esc(horaDe(e))}</time> ${esc(e.titulo)}</li>`).join('')}</ul>` : '<p class="mv-nada">Nada programado para hoy ni mañana.</p>'}</section>
          ${mcp ? tarjetaHTML(mcp) : ''}
          ${avisos.length ? `<section class="mv-card" aria-label="Avisos"><div class="mv-card-cab static"><span class="mv-card-t">${svg('nube')} Avisos</span><button type="button" class="mv-link" data-avisos>Ver todos</button><button type="button" class="mv-link" data-leidos>Marcar leídos</button></div><ul class="mv-mini">${avisos.map(n => `<li class="${esc(n.level || '')}">${esc(String(n.text).replace(/`/g, '').slice(0, 160))} <time>${n.t ? hace(n.t) : ''}</time></li>`).join('')}</ul></section>` : ''}
          <div class="mv-atajos" role="group" aria-label="Atajos"><button type="button" data-nueva>${svg('mas1')}<span>Añadir tarea</span></button><button type="button" data-dim>${svg('dimitri')}<span>Hablar con Dimitri</span></button><button type="button" data-agenda>${svg('calendario')}<span>Ver la agenda</span></button><button type="button" data-mas>${svg('mas')}<span>Más</span></button></div>`;
      }
      cuerpo.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        if ('estado' in b.dataset) return ctx.escritorio('estado');
        if ('aprob' in b.dataset) return ctx.navegar('aprobaciones');
        if ('tareas' in b.dataset) return ctx.navegar('tareas', { l: 'hoy' });
        if ('agenda' in b.dataset) return ctx.navegar('calendario');
        if ('nueva' in b.dataset) return ctx.navegar('tareas', { nueva: 1 });
        if ('dim' in b.dataset) return ctx.navegar('dimitri');
        if ('mas' in b.dataset) return document.querySelector('[data-tab="mas"]')?.click();
        if ('conectores' in b.dataset) { try { abrirConectores(ctx, await ctx.store.conectores(true)); } catch (er) { ctx.toast('No se pudieron leer los conectores: ' + er.message); } return; }
        if ('avisos' in b.dataset) return abrirAvisos(ctx);
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
      ctx.store.alCambiar(() => { if (!el.hidden) pintar(); });
      el._mcp = cargaMcp; pintar(); cargaMcp();
    },
    alMostrar(el, ctx) { ctx.store.refrescar(); el._mcp?.(); },
  });
}
