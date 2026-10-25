// Versión móvil (25 oct 2026) — CALENDARIO: la AGENDA es la vista principal (una lista de días con lo que pasa en cada uno, empezando en
// hoy); el MES compacto con puntos sirve para saltar a un día. Tocar algo abre una hoja con lo que se puede hacer (mover, saltar una
// rutina, abrir la tarea); «+» crea una tarea tuya o para un departamento. Junta las mismas fuentes que el calendario de escritorio
// (tareas programadas, fechas límite, lo tuyo y las rutinas) con la lógica pura de ../agenda.js.
import { eventos, agrupar, horaDe, mesGrid, cabeceraSemana, etiquetaDia } from '../agenda.js';
import { describe } from '../../when.js';
import { esc, svg, vacio, esqueleto, falla, ymd, hora } from '../ui.js';

const DIA = 864e5, DEPTS = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas' };
const TIPO = { rutina: 'Rutina', tarea: 'Tarea', limite: 'Vence', mia: 'Tuya' };

export function registrar(shell) {
  shell.registrarVista({
    id: 'calendario', titulo: 'Calendario', icono: 'calendario', grupo: 'tab',
    montar(el, ctx) {
      let modo = 'agenda', ancla = Date.now(), diaSel = ymd(new Date()), cargando = true; const st = ctx.store.st;
      el.innerHTML = `<div class="mv-scroll"><div class="mv-seg" role="group" aria-label="Cómo verlo"><button type="button" data-modo="agenda" aria-pressed="true">Agenda</button><button type="button" data-modo="tres" aria-pressed="false">3 días</button><button type="button" data-modo="mes" aria-pressed="false">Mes</button></div><div class="mv-cuerpo" aria-live="polite"></div></div>
        <button type="button" class="mv-fab" aria-label="Crear una tarea">${svg('mas1')}</button>`;
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll'), seg = el.querySelector('.mv-seg');
      const rangoAgenda = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return [d.getTime(), d.getTime() + (modo === 'tres' ? 3 : 30) * DIA]; };

      function item(e) {
        const clase = e.pausada || e.saltada ? ' pausada' : '', extra = e.saltada ? ' · saltada' : e.pausada ? ' · en pausa' : '';
        return `<li><button type="button" class="mv-ev t-${e.tipo}${clase}" data-at="${e.at}" data-tipo="${e.tipo}" data-id="${esc(e.id || '')}"><span class="mv-ev-h">${esc(horaDe(e))}</span><span class="mv-ev-c"><b>${esc(e.titulo)}</b><small>${TIPO[e.tipo]}${e.dept ? ' · ' + esc(DEPTS[e.dept] || e.dept) : ''}${extra}</small></span>${svg('der', 'mv-der')}</button></li>`;
      }
      function pintarAgenda() {
        const [d, h] = rangoAgenda(), evs = eventos({ tareas: st.tareas, rutinas: st.rutinas, desde: d, hasta: h });
        const g = agrupar(evs, { desde: d, hasta: h, rellenar: modo === 'tres' });
        cuerpo.innerHTML = g.map(x => `<section class="mv-dia${x.esHoy ? ' hoy' : ''}" data-dia="${x.dia}"><h3>${esc(x.titulo)}<small>${esc(new Date(x.dia + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }))}</small></h3>${x.items.length ? `<ul class="mv-evs">${x.items.map(item).join('')}</ul>` : '<p class="mv-nada">Nada programado.</p>'}</section>`).join('') + (evs.length ? '' : vacio(modo === 'tres' ? 'Nada en 3 días' : 'Nada en 30 días', 'Toca + para poner algo en tu calendario.', { icono: 'calendario' }));
      }
      function pintarMes() {
        const m0 = mesGrid(ancla), evs = eventos({ tareas: st.tareas, rutinas: st.rutinas, desde: m0.desde, hasta: m0.hasta });
        const m = mesGrid(ancla, evs), delDia = evs.filter(e => ymd(new Date(e.at)) === diaSel);
        cuerpo.innerHTML = `<div class="mv-mes-cab"><button type="button" class="mv-ic" data-mes="-1" aria-label="Mes anterior">${svg('izq')}</button><h3>${esc(m.titulo)}</h3><button type="button" class="mv-ic" data-mes="1" aria-label="Mes siguiente">${svg('der')}</button></div>
          <div class="mv-mes" role="grid" aria-label="${esc(m.titulo)}"><div class="mv-mes-sem" role="row">${cabeceraSemana.map(c => `<span role="columnheader">${c}</span>`).join('')}</div>
          ${m.semanas.map(w => `<div class="mv-mes-fila" role="row">${w.map(c => `<button type="button" role="gridcell" class="mv-celda${c.delMes ? '' : ' fuera'}${c.dia === diaSel ? ' sel' : ''}${c.dia === ymd(new Date()) ? ' hoy' : ''}" data-dia="${c.dia}" aria-label="${esc(etiquetaDia(c.dia))}${c.n ? ', ' + c.n + (c.n === 1 ? ' cosa' : ' cosas') : ''}" aria-pressed="${c.dia === diaSel}"><b>${c.num}</b><i>${c.n ? '<u></u>'.repeat(Math.min(3, c.n)) : ''}</i></button>`).join('')}</div>`).join('')}</div>
          <h3 class="mv-gh">${esc(etiquetaDia(diaSel))} <span>${delDia.length}</span></h3>${delDia.length ? `<ul class="mv-evs">${delDia.map(item).join('')}</ul>` : '<p class="mv-nada">Nada este día.</p>'}`;
      }
      function pintar() {
        seg.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === modo)));
        if (!st.cargado) { cuerpo.innerHTML = st.error ? falla(st.error) : esqueleto(5); return; }
        if (modo === 'mes') pintarMes(); else pintarAgenda();
      }

      // ---- lo que se puede hacer con algo ----
      async function abrir(b) {
        const at = +b.dataset.at, tipo = b.dataset.tipo, id = b.dataset.id;
        if (tipo === 'mia' || tipo === 'limite') return ctx.navegar('tareas', { t: id });
        if (tipo === 'rutina') {
          const r = st.rutinas.find(x => x.id === id); if (!r) return;
          const ags = await ctx.store.agentes(), a = ags.find(x => x.id === r.agent);
          const h = ctx.hoja({ titulo: r.title, cuerpo: `<p class="mv-meta">${esc(DEPTS[r.dept] || r.dept)}${a ? ' · ' + esc(a.name) : ''}</p><p class="mv-texto">${esc(describe(r.when))}</p><p class="mv-meta">Le toca: ${esc(etiquetaDia(ymd(new Date(at))))} ${esc(hora(at))}${r.paused ? ' · está en pausa' : ''}</p>${r.needsOk !== false ? '<p class="mv-meta">Antes de enviar algo espera tu OK.</p>' : ''}`,
            acciones: [{ texto: 'Saltar esta vez', alTocar: async x => { x.cerrar(); try { await ctx.api(`/api/routines/${id}/skip`, { method: 'POST', body: { at } }); ctx.toast('Saltada: no correrá esa vez.', { accion: 'Deshacer', alAccion: async () => { try { await ctx.api(`/api/routines/${id}/unskip`, { method: 'POST', body: { at } }); } catch {} ctx.store.refrescar(); } }); } catch (e) { ctx.toast('No se pudo: ' + e.message); } ctx.store.refrescar(); } },
              { texto: 'Ejecutar ahora', tipo: 'primario', alTocar: async x => { if (!(await ctx.confirmar({ titulo: '¿Ejecutar ahora?', texto: `«${r.title}» empieza en cuanto confirmes.`, ok: 'Ejecutar' }))) return; x.cerrar(); try { await ctx.api(`/api/routines/${id}/run`, { method: 'POST', body: {} }); ctx.toast('En marcha. La ves en Tareas → De los agentes.'); } catch (e) { ctx.toast('No se pudo: ' + e.message); } ctx.store.refrescar(); } }] });
          return h;
        }
        const t = st.tareas.find(x => x.id === id); if (!t) return;
        const f = new Date(t.dueAt), dstr = ymd(f), hstr = hora(t.dueAt);
        ctx.hoja({ titulo: t.title, cuerpo: `<p class="mv-meta">${esc(DEPTS[t.dept] || t.dept || '')}${t.agent ? ' · ' + esc(t.agent) : ''} · programada</p>
            <label class="mv-lab" for="mvCd">Día</label><input id="mvCd" type="date" class="mv-campo" value="${dstr}"><label class="mv-lab" for="mvCh">Hora</label><input id="mvCh" type="time" class="mv-campo" value="${hstr}">`,
          acciones: [{ texto: 'Cancelar tarea', tipo: 'peligro', alTocar: async x => { if (!(await ctx.confirmar({ titulo: '¿Cancelar la tarea?', texto: 'Ya no se ejecutará.', ok: 'Cancelar tarea', cancelar: 'No', peligro: true }))) return; x.cerrar(); try { await ctx.api(`/api/tasks/${id}`, { method: 'DELETE' }); ctx.toast('Cancelada.'); } catch (e) { ctx.toast('No se pudo: ' + e.message); } ctx.store.refrescar(); } },
            { texto: 'Mover', tipo: 'primario', alTocar: async x => { const d = x.cuerpo.querySelector('#mvCd').value, hh = x.cuerpo.querySelector('#mvCh').value; const ms = new Date(`${d}T${hh || '09:00'}`).getTime(); if (!(ms > Date.now())) { ctx.toast('Elige una hora que aún no pasó.'); return; } x.cerrar(); try { await ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { at: ms } }); ctx.toast(`Movida al ${etiquetaDia(d).toLowerCase()} a las ${hh || '09:00'}.`); } catch (e) { ctx.toast('No se pudo: ' + e.message); } ctx.store.refrescar(); } }] });
      }

      // ---- crear ----
      function crear(dia = diaSel) {
        const hoyS = ymd(new Date());
        const h = ctx.hoja({ titulo: 'Nueva tarea', cuerpo: `<label class="mv-lab" for="mvNt">Qué hay que hacer</label><textarea id="mvNt" class="mv-campo" rows="2" placeholder="Llamar al banco" autofocus></textarea>
            <label class="mv-lab" for="mvNd">Día</label><input id="mvNd" type="date" class="mv-campo" value="${dia < hoyS ? hoyS : dia}" min="${hoyS}"><label class="mv-lab" for="mvNh">Hora (opcional)</label><input id="mvNh" type="time" class="mv-campo">
            <label class="mv-lab" for="mvNq">Para</label><select id="mvNq" class="mv-campo"><option value="yo">Para mí</option>${Object.entries(DEPTS).map(([k, n]) => `<option value="${k}">Un agente de ${n}</option>`).join('')}</select><p class="mv-meta" id="mvNa">Queda en tu lista, con esa fecha.</p>`,
          acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: 'Crear', tipo: 'primario', alTocar: async x => {
            const c = x.cuerpo, texto = c.querySelector('#mvNt').value.trim(), d = c.querySelector('#mvNd').value, hh = c.querySelector('#mvNh').value, q = c.querySelector('#mvNq').value;
            if (!texto) { c.querySelector('#mvNt').focus(); ctx.toast('Escribe qué hay que hacer.'); return; }
            try {
              if (q === 'yo') await ctx.api('/api/tareas/mias', { method: 'POST', body: { title: texto, limite: hh ? `${d}T${hh}` : d } });
              else { const ms = new Date(`${d}T${hh || '09:00'}`).getTime(); if (!(ms > Date.now())) { ctx.toast('Elige una hora que aún no pasó.'); return; } await ctx.api('/api/tasks', { method: 'POST', body: { dept: q, text: texto, at: ms } }); }
              x.cerrar(); ctx.toast('Creada.'); diaSel = d; await ctx.store.refrescar();
            } catch (e) { ctx.toast('No se pudo: ' + e.message); }
          } }] });
        h.cuerpo.querySelector('#mvNq').addEventListener('change', e => { h.cuerpo.querySelector('#mvNa').textContent = e.target.value === 'yo' ? 'Queda en tu lista, con esa fecha.' : 'Un agente la hará a esa hora; lo que envíe espera tu OK.'; });
      }

      el.addEventListener('click', e => {
        const m = e.target.closest('[data-modo]'); if (m) { modo = m.dataset.modo; pintar(); sc.scrollTo({ top: 0 }); return; }
        if (e.target.closest('.mv-fab')) return crear();
        const c = e.target.closest('.mv-celda'); if (c) { diaSel = c.dataset.dia; pintar(); return; }
        const p = e.target.closest('[data-mes]'); if (p) { const d = new Date(ancla); d.setDate(1); d.setMonth(d.getMonth() + +p.dataset.mes); ancla = d.getTime(); diaSel = ymd(d); pintar(); return; }
        const ev = e.target.closest('.mv-ev'); if (ev) return abrir(ev);
        if (e.target.closest('[data-reintentar]')) ctx.store.refrescar();
      });
      ctx.cabecera({ acciones: [{ icono: 'calendario', etiqueta: 'Ir a hoy', alTocar: () => { ancla = Date.now(); diaSel = ymd(new Date()); modo !== 'mes' && sc.scrollTo({ top: 0, behavior: 'smooth' }); pintar(); } }] });
      ctx.tirar(sc, () => ctx.store.refrescar());
      ctx.store.alCambiar(() => { if (!el.hidden) pintar(); });
      pintar();
    },
    alMostrar(el, ctx) { ctx.store.refrescar(); },
  });
}
