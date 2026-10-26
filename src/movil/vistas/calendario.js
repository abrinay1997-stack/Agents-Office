// Versión móvil (25 oct 2026) — CALENDARIO: Agenda (30 días), Día (24 horas con la línea de «ahora»), 3 días y Mes (puntos). Sobre la
// vista: ‹ fecha › Hoy, Capas (TUYAS, rutinas, tareas de los agentes, vencimientos, contenido, hechas, y «suscribirme» con el .ics) y
// Buscar. Tocar algo abre una hoja con lo que se puede hacer; «+» crea una tarea (para ti o para un departamento) o una RUTINA
// completa (días L M X J V S D, hora, desde/hasta, OK, equipo). Nada se arrastra: mover es elegir día y hora. Junta las mismas fuentes que
// el calendario de escritorio (tareas programadas, fechas límite, lo tuyo, rutinas y las piezas de Contenido) con la lógica pura de ../agenda.js.
import { eventos, agrupar, horaDe, mesGrid, cabeceraSemana, etiquetaDia } from '../agenda.js';
import { describe } from '../../when.js';
import { esc, svg, vacio, esqueleto, falla, ymd, hora } from '../ui.js';
import { scrollInicial, horaDeToque, PX_HORA } from '../dia-puro.js';
import { diaHTML, DEPTS_C as DEPTS } from './calendario-dia.js';
import { abrirRutina, abrirFormulario } from './calendario-rutinas.js';
import { abrirDetalle } from './tareas-detalle.js';
import { hacer, interruptor, alternar, recorte, gente, opcionesPara, ayudaPara } from './tareas-comun.js';

const DIA = 864e5;
const TIPO = { rutina: 'Rutina', tarea: 'Tarea', limite: 'Vence', mia: 'Tuya', contenido: 'Contenido' };
const MODOS = [['agenda', 'Agenda'], ['dia', 'Día'], ['tres', '3 días'], ['mes', 'Mes']];
const CAPAS = [['mias', 'Lo tuyo', 'Tus tareas con fecha'], ['rutinas', 'Rutinas', 'Lo que la oficina hace sola'], ['tareas', 'Tareas de los agentes', 'Programadas para una hora'], ['vencimientos', 'Vencimientos', 'Fechas límite de las tareas de los agentes'], ['contenido', 'Contenido', 'Lo que se publica en redes'], ['hechas', 'Hechas', 'Lo que ya se terminó']];
const CAPA_DE = { mia: 'mias', rutina: 'rutinas', tarea: 'tareas', limite: 'vencimientos', contenido: 'contenido' };
const ico = d => `<svg class="mv-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const IC_CAPAS = ico('<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>');
const guardado = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* no se recuerda */ } };
const iniDia = s => new Date(s + 'T00:00').getTime();
const sumaDias = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };
const sumaMes = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(1); d.setMonth(d.getMonth() + n); return ymd(d); };
const largo = s => new Date(s + 'T12:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });

export function registrar(shell) {
  shell.registrarVista({
    id: 'calendario', titulo: 'Calendario', icono: 'calendario', grupo: 'tab',
    montar(el, ctx) {
      let modo = guardado('ao.mv.cal.modo', 'agenda'), diaSel = ymd(new Date()), capas = { mias: true, rutinas: true, tareas: true, vencimientos: true, contenido: false, hechas: false, ...guardado('ao.mv.cal.capas', {}) };
      if (!MODOS.some(m => m[0] === modo)) modo = 'agenda';
      const piezas = new Map(); let tic = 0, scrollKey = ''; const st = ctx.store.st;
      el.innerHTML = `<div class="mv-scroll"><div class="mv-seg mv-seg-cal" role="group" aria-label="Cómo verlo">${MODOS.map(([k, n]) => `<button type="button" data-modo="${k}" aria-pressed="${k === modo}">${n}</button>`).join('')}</div>
        <div class="mv-tb" role="toolbar" aria-label="Moverse por el calendario"><button type="button" class="mv-ic" data-nav="-1" aria-label="Anterior">${svg('izq')}</button><button type="button" class="mv-tb-t" data-saltar aria-label="Elegir una fecha"></button><button type="button" class="mv-ic" data-nav="1" aria-label="Siguiente">${svg('der')}</button><button type="button" class="mv-tb-hoy" data-hoy>Hoy</button><button type="button" class="mv-ic" data-capas aria-label="Capas y suscripción">${IC_CAPAS}</button><button type="button" class="mv-ic" data-buscar aria-label="Buscar en el calendario">${svg('buscar')}</button></div>
        <div class="mv-cuerpo" aria-live="polite"></div></div>
        <button type="button" class="mv-fab" aria-label="Crear una tarea o una rutina">${svg('mas1')}</button>`;
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll'), seg = el.querySelector('.mv-seg'), tbT = el.querySelector('.mv-tb-t');
      const hoyS = () => ymd(new Date());

      // ---- de dónde a dónde mira cada modo ----
      function rango() {
        if (modo === 'dia') { const d = iniDia(diaSel); return [d, d + DIA]; }
        if (modo === 'tres') { const d = iniDia(diaSel); return [d, d + 3 * DIA]; }
        if (modo === 'mes') { const m = mesGrid(iniDia(diaSel)); return [m.desde, m.hasta]; }
        const d = iniDia(diaSel); return [d, d + 30 * DIA];
      }
      function etiquetaRango() {
        if (modo === 'dia') return diaSel === hoyS() ? 'Hoy · ' + largo(diaSel) : largo(diaSel);
        if (modo === 'tres') return `${largo(diaSel)} – ${largo(sumaDias(diaSel, 2))}`;
        if (modo === 'mes') return mesGrid(iniDia(diaSel)).titulo;
        return diaSel === hoyS() ? 'Próximos 30 días' : 'Desde ' + largo(diaSel);
      }
      async function traerContenido(desde, hasta) {
        const k = `${ymd(new Date(desde))}_${ymd(new Date(hasta))}`; if (piezas.has(k)) return; piezas.set(k, []);
        try { const j = await ctx.api(`/api/contenido?desde=${ymd(new Date(desde))}&hasta=${ymd(new Date(hasta - 1))}`); piezas.set(k, j.piezas || []); if (!el.hidden) pintar(); } catch { piezas.delete(k); }
      }
      function eventosDe(desde, hasta) {
        const evs = eventos({ tareas: st.tareas, rutinas: st.rutinas, desde, hasta, hechas: capas.hechas });
        const out = evs.filter(e => capas[CAPA_DE[e.tipo]] !== false && (!e.hecha || capas.hechas));
        if (capas.contenido) {
          traerContenido(desde, hasta);
          for (const [k, l] of piezas) { const [a, b] = k.split('_'); if (iniDia(a) > hasta || iniDia(b) + DIA < desde) continue; for (const p of l) { if (!p.dia) continue; const at = new Date(`${p.dia}T${p.hora || '00:00'}`).getTime(); if (at >= desde && at < hasta && !out.some(x => x.tipo === 'contenido' && x.id === p.id)) out.push({ tipo: 'contenido', at, titulo: p.titulo || p.texto?.slice(0, 60) || 'Pieza', id: p.id, conHora: !!p.hora, estado: p.estado, dept: null, redes: p.redes }); } }
          out.sort((a, b) => a.at - b.at);
        }
        return out;
      }

      // ---- pintar ----
      function item(e) {
        const clase = e.pausada || e.saltada ? ' pausada' : '', extra = e.saltada ? ' · saltada' : e.pausada ? ' · en pausa' : e.hecha ? ' · hecha' : '';
        return `<li><button type="button" class="mv-ev t-${e.tipo}${clase}" data-at="${e.at}" data-tipo="${e.tipo}" data-id="${esc(e.id || '')}"><span class="mv-ev-h">${esc(horaDe(e))}</span><span class="mv-ev-c"><b>${esc(e.titulo)}</b><small>${TIPO[e.tipo]}${e.dept ? ' · ' + esc(DEPTS[e.dept] || e.dept) : ''}${extra}</small></span>${svg('der', 'mv-der')}</button></li>`;
      }
      function pintarLista() {
        const [d, h] = rango(), evs = eventosDe(d, h);
        const g = agrupar(evs, { desde: d, hasta: h, rellenar: modo === 'tres' });
        cuerpo.innerHTML = g.map(x => `<section class="mv-dia${x.esHoy ? ' hoy' : ''}" data-dia="${x.dia}"><h3>${esc(x.titulo)}<small>${esc(new Date(x.dia + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }))}</small></h3>${x.items.length ? `<ul class="mv-evs">${x.items.map(item).join('')}</ul>` : '<p class="mv-nada">Nada programado.</p>'}</section>`).join('') + (evs.length ? '' : vacio(modo === 'tres' ? 'Nada en estos 3 días' : 'Nada en 30 días', 'Toca + para poner algo en tu calendario.', { icono: 'calendario' }));
      }
      function pintarDia() {
        const d = iniDia(diaSel), evs = eventosDe(d, d + DIA);
        cuerpo.innerHTML = diaHTML(evs, d) + (evs.length ? '' : `<p class="mv-nada mv-nada-dia">Nada este día. Toca una hora para crear algo.</p>`);
        const k = `dia|${diaSel}`; if (scrollKey !== k) { scrollKey = k; const t = cuerpo.querySelector('.mv-linea-dia'); if (t) sc.scrollTop = t.offsetTop + scrollInicial(d, Date.now(), sc.clientHeight) - 0; }
      }
      function pintarMes() {
        const m0 = mesGrid(iniDia(diaSel)), evs = eventosDe(m0.desde, m0.hasta);
        const m = mesGrid(iniDia(diaSel), evs), delDia = evs.filter(e => ymd(new Date(e.at)) === diaSel);
        cuerpo.innerHTML = `<div class="mv-mes" role="grid" aria-label="${esc(m.titulo)}"><div class="mv-mes-sem" role="row">${cabeceraSemana.map(c => `<span role="columnheader">${c}</span>`).join('')}</div>
          ${m.semanas.map(w => `<div class="mv-mes-fila" role="row">${w.map(c => `<button type="button" role="gridcell" class="mv-celda${c.delMes ? '' : ' fuera'}${c.dia === diaSel ? ' sel' : ''}${c.dia === hoyS() ? ' hoy' : ''}" data-dia="${c.dia}" aria-label="${esc(etiquetaDia(c.dia))}${c.n ? ', ' + c.n + (c.n === 1 ? ' cosa' : ' cosas') : ''}" aria-selected="${c.dia === diaSel}"><b>${c.num}</b><i>${c.n ? '<u></u>'.repeat(Math.min(3, c.n)) : ''}</i></button>`).join('')}</div>`).join('')}</div>
          <h3 class="mv-gh">${esc(etiquetaDia(diaSel))} <span>${delDia.length}</span></h3>${delDia.length ? `<ul class="mv-evs">${delDia.map(item).join('')}</ul>` : '<p class="mv-nada">Nada este día.</p>'}`;
      }
      function pintar() {
        for (const b of seg.querySelectorAll('[data-modo]')) b.setAttribute('aria-pressed', String(b.dataset.modo === modo));
        tbT.textContent = etiquetaRango();
        if (!st.cargado) { cuerpo.innerHTML = st.error ? falla(st.error) : esqueleto(5); return; }
        if (modo === 'mes') pintarMes(); else if (modo === 'dia') pintarDia(); else pintarLista();
        clearInterval(tic); if (modo === 'dia') tic = setInterval(() => { if (!el.hidden && cuerpo.querySelector('.mv-ahora')) pintarDia(); }, 60000);
      }

      // ---- lo que se puede hacer con algo ----
      const alCambiar = () => { ctx.store.refrescar(); };
      async function abrir(b) {
        const at = +b.dataset.at, tipo = b.dataset.tipo, id = b.dataset.id;
        if (tipo === 'mia' || tipo === 'limite') return abrirDetalle(ctx, id, { alCambiar });
        if (tipo === 'rutina') return abrirRutina(ctx, id, at, { alCambiar });
        if (tipo === 'contenido') return abrirPieza(id, at);
        const t = st.tareas.find(x => x.id === id); if (!t) return;
        if (t.state !== 'scheduled') return abrirDetalle(ctx, id, { alCambiar });
        const dstr = ymd(new Date(t.dueAt)), hstr = hora(t.dueAt);
        const h = ctx.hoja({ titulo: t.title, cuerpo: `<p class="mv-meta">${esc(DEPTS[t.dept] || t.dept || '')}${t.agent ? ' · ' + esc(t.agent) : ''} · programada</p>
            <label class="mv-lab" for="mvCd">Día</label><input id="mvCd" type="date" class="mv-campo" value="${dstr}" min="${hoyS()}"><label class="mv-lab" for="mvCh">Hora</label><input id="mvCh" type="time" class="mv-campo" value="${hstr}">
            <button type="button" class="mv-link mv-izq" data-ver>Ver la tarea completa →</button>`,
          acciones: [{ texto: 'Cancelar tarea', tipo: 'peligro', alTocar: async x => { if (!(await ctx.confirmar({ titulo: '¿Cancelar la tarea?', texto: 'Ya no se ejecutará.', ok: 'Cancelar tarea', cancelar: 'No', peligro: true }))) return; x.cerrar(); setTimeout(() => hacerCancel(t), 280); } },
            { texto: 'Mover', tipo: 'primario', alTocar: async (x, bt) => {
              const d = x.cuerpo.querySelector('#mvCd').value, hh = x.cuerpo.querySelector('#mvCh').value, ms = new Date(`${d}T${hh || '09:00'}`).getTime(); if (!(ms > Date.now())) { ctx.toast('Elige una hora que aún no pasó.'); return; }
              const prev = t.dueAt, r = await hacer(ctx, bt, () => ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { at: ms } }), { ocupado: 'Moviendo…', hecho: 'Movida', ms: 500, aviso: `Movida al ${etiquetaDia(d).toLowerCase()} a las ${hh || '09:00'}.`, deshacer: () => ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { at: prev } }), despues: alCambiar });
              if (r.ok) setTimeout(() => x.cerrar(), 450);
            } }] });
        h.cuerpo.querySelector('[data-ver]').addEventListener('click', () => { h.cerrar(); setTimeout(() => abrirDetalle(ctx, id, { alCambiar }), 280); });
      }
      async function hacerCancel(t) {
        try { await ctx.api(`/api/tasks/${t.id}`, { method: 'DELETE' }); ctx.toast('Cancelada.'); } catch (e) { ctx.toast('No se pudo: ' + e.message); } alCambiar();
      }
      function abrirPieza(id, at) {
        const p = [...piezas.values()].flat().find(x => x.id === id); if (!p) return;
        const h = ctx.hoja({ titulo: p.titulo || 'Pieza de contenido', cuerpo: `<p class="mv-meta">${esc(etiquetaDia(ymd(new Date(at))))}${p.hora ? ' · ' + esc(p.hora) : ''} · ${esc(p.estado || 'borrador')}${p.formato ? ' · ' + esc(p.formato) : ''}${(p.redes || []).length ? ' · ' + esc(p.redes.join(', ')) : ''}</p>${p.texto ? `<p class="mv-notas">${esc(String(p.texto).slice(0, 500))}</p>` : ''}<p class="mv-meta">Se edita y se aprueba en Contenido.</p>`, acciones: [{ texto: 'Cerrar', alTocar: x => x.cerrar() }, { texto: 'Abrir en Contenido', tipo: 'primario', alTocar: x => { x.cerrar(); setTimeout(() => (shell.vistas().some(v => v.id === 'contenido') ? ctx.navegar('contenido', { id }) : ctx.escritorio('contenido')), 280); } }] });
        return h;
      }

      // ---- crear: una tarea o una rutina ----
      function elegirCrear(dia = diaSel, horaS = '') {
        const h = ctx.hoja({ titulo: 'Crear', cuerpo: `<div class="mv-det-acc"><button type="button" class="mv-btn primario" data-k="tarea">Una tarea<br><small>Para ti o para un agente, en un día y una hora</small></button><button type="button" class="mv-btn" data-k="rutina">Una rutina<br><small>Algo que la oficina hace sola, cada cierto tiempo</small></button></div>` });
        h.cuerpo.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; h.cerrar(); setTimeout(() => (b.dataset.k === 'tarea' ? crearTarea(dia, horaS) : abrirFormulario(ctx, null, { dia, hora: horaS, alTerminar: alCambiar })), 280); });
      }
      async function crearTarea(dia = diaSel, horaS = '') {
        const hoy = hoyS(), g = await gente(ctx); // 26 oct 2026: «Para» también elige a una persona del equipo
        const h = ctx.hoja({ titulo: 'Nueva tarea', cuerpo: `<label class="mv-lab" for="mvNt">Qué hay que hacer</label><textarea id="mvNt" class="mv-campo" rows="2" placeholder="Llamar al banco" autofocus></textarea>
            <label class="mv-lab" for="mvNd">Día</label><input id="mvNd" type="date" class="mv-campo" value="${dia < hoy ? hoy : dia}" min="${hoy}"><label class="mv-lab" for="mvNh">Hora (opcional)</label><input id="mvNh" type="time" class="mv-campo" value="${horaS}">
            <label class="mv-lab" for="mvNq">Para</label><select id="mvNq" class="mv-campo">${opcionesPara(g)}</select><p class="mv-meta" id="mvNa">Queda en tu lista, con esa fecha.</p>`,
          acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: 'Crear', tipo: 'primario', alTocar: async (x, bt) => {
            const c = x.cuerpo, texto = c.querySelector('#mvNt').value.trim(), d = c.querySelector('#mvNd').value, hh = c.querySelector('#mvNh').value, q = c.querySelector('#mvNq').value;
            if (!texto) { c.querySelector('#mvNt').focus(); ctx.toast('Escribe qué hay que hacer.'); return; }
            const ms = new Date(`${d}T${hh || '09:00'}`).getTime(), aPersona = q.startsWith('p:'); if (q !== 'yo' && !aPersona && !(ms > Date.now())) { ctx.toast('Elige una hora que aún no pasó.'); return; }
            const r = await hacer(ctx, bt, () => (q === 'yo' || aPersona ? ctx.api('/api/tareas/mias', { method: 'POST', body: { title: texto, limite: hh ? `${d}T${hh}` : d, ...(aPersona ? { persona: q.slice(2) } : {}) } }) : ctx.api('/api/tasks', { method: 'POST', body: { dept: q, text: texto, at: ms } })), { ocupado: 'Creando…', hecho: 'Creada', ms: 500, aviso: 'Creada.', deshacer: j => ctx.api(`/api/tasks/${(j.tarea || j).id}`, { method: 'DELETE' }), despues: () => { diaSel = d; ctx.store.refrescar(); } });
            if (r.ok) setTimeout(() => x.cerrar(), 450);
          } }] });
        h.cuerpo.querySelector('#mvNq').addEventListener('change', e => { h.cuerpo.querySelector('#mvNa').textContent = e.target.value === 'yo' ? 'Queda en tu lista, con esa fecha.' : e.target.value.startsWith('p:') ? ayudaPara(e.target.value) : 'Un agente la hará a esa hora; lo que envíe espera tu OK.'; });
      }

      // ---- capas, suscribirse y buscar ----
      function abrirCapas() {
        const url = location.origin + '/api/calendar.ics';
        const h = ctx.hoja({ titulo: 'Capas y suscripción', lleno: true, cuerpo: `<p class="mv-meta">Elige qué ver en el calendario.</p><div class="mv-capas">${CAPAS.map(([k, n, a]) => interruptor('mvCp_' + k, n, capas[k] !== false && !!capas[k], a)).join('')}</div>
          <h3 class="mv-gh">Suscribirme a mi calendario</h3><p class="mv-meta">Lleva las rutinas, las tareas programadas y tus fechas al calendario de tu teléfono (Google, Apple…). Es de solo lectura.</p>
          <div class="mv-det-acc"><button type="button" class="mv-btn primario" data-copiar>Copiar el enlace</button><a class="mv-btn mv-a" href="${esc(url.replace(/^https?:/, 'webcal:'))}">Abrir en mi app de calendario</a><a class="mv-btn mv-a" href="/api/calendar.ics" download="oficina.ics">Descargar el archivo .ics</a></div>
          <p class="mv-meta">${/^https:/.test(url) ? 'Si tu app de calendario te pide iniciar sesión, usa «Descargar el archivo»: así entra con la sesión que ya tienes abierta aquí.' : 'Solo funciona mientras la oficina está encendida.'}</p>` });
        h.cuerpo.addEventListener('click', e => {
          const sw = e.target.closest('[role="switch"]'); if (sw) { capas[sw.id.slice(5)] = alternar(sw); guarda('ao.mv.cal.capas', capas); pintar(); return; }
          const c = e.target.closest('[data-copiar]'); if (c) hacer(ctx, c, async () => { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url); else throw new Error('Tu navegador no deja copiar. Mantén pulsado este enlace: ' + url); }, { ocupado: 'Copiando…', hecho: 'Copiado', ms: 1500, aviso: 'Enlace copiado: pégalo en «Agregar calendario → Desde URL».' });
        });
      }
      function abrirBuscar() {
        const h = ctx.hoja({ titulo: 'Buscar en el calendario', lleno: true, cuerpo: `<label class="mv-sr" for="mvBc">Buscar</label><input id="mvBc" type="text" class="mv-campo" placeholder="Una tarea, una rutina…" autofocus enterkeyhint="search"><div class="mv-bres" role="status" aria-live="polite"></div>` });
        const q = h.cuerpo.querySelector('#mvBc'), res = h.cuerpo.querySelector('.mv-bres');
        const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        function busca() {
          const s = norm(q.value).trim(); if (!s) { res.innerHTML = '<p class="mv-meta">Escribe para buscar entre tus tareas y rutinas.</p>'; return; }
          const ahora = Date.now(), evs = eventos({ tareas: st.tareas, rutinas: st.rutinas, desde: ahora - 30 * DIA, hasta: ahora + 120 * DIA, hechas: true }).filter(e => norm(e.titulo).includes(s));
          const vistos = new Set(), l = [];
          for (const e of evs) { const k = e.tipo + e.id; if (e.tipo === 'rutina' && vistos.has(k)) continue; vistos.add(k); l.push(e); }
          const sinFecha = st.tareas.filter(t => !t.archived && !t.piece && t.state !== 'done' && !t.limite && !t.dueAt && norm(t.title + ' ' + (t.text || '')).includes(s) && !vistos.has((t.person === 'Tú' ? 'mia' : 'tarea') + t.id)).slice(0, 15);
          res.innerHTML = (l.length ? `<ul class="mv-lista">${l.slice(0, 60).map(e => `<li><button type="button" class="mv-lista-b" data-at="${e.at}" data-tipo="${e.tipo}" data-id="${esc(e.id || '')}"><span><b>${esc(e.titulo)}</b><small>${TIPO[e.tipo]} · ${esc(etiquetaDia(ymd(new Date(e.at))))}${e.conHora ? ' ' + esc(horaDe(e)) : ''}${e.hecha ? ' · hecha' : ''}</small></span>${svg('der', 'mv-lista-i')}</button></li>`).join('')}</ul>` : '') +
            (sinFecha.length ? `<h3 class="mv-gh">Sin fecha <span>${sinFecha.length}</span></h3><ul class="mv-lista">${sinFecha.map(t => `<li><button type="button" class="mv-lista-b" data-at="0" data-tipo="mia" data-id="${esc(t.id)}"><span><b>${esc(t.title)}</b><small>${t.person === 'Tú' ? 'Tuya' : 'Tarea'} · sin fecha</small></span>${svg('der', 'mv-lista-i')}</button></li>`).join('')}</ul>` : '') || vacio('No encontré nada', 'Prueba con otra palabra.', { icono: 'buscar' });
        }
        q.addEventListener('input', busca); busca();
        res.addEventListener('click', e => { const b = e.target.closest('[data-tipo]'); if (!b) return; h.cerrar(); setTimeout(() => abrir(b), 280); });
      }
      function abrirSalto() {
        const h = ctx.hoja({ titulo: 'Ir a una fecha', cuerpo: `<label class="mv-lab" for="mvSd">Fecha</label><input id="mvSd" type="date" class="mv-campo" value="${diaSel}">`, acciones: [{ texto: 'Hoy', alTocar: x => { diaSel = hoyS(); x.cerrar(); pintar(); } }, { texto: 'Ir', tipo: 'primario', alTocar: x => { const v = x.cuerpo.querySelector('#mvSd').value; if (v) { diaSel = v; x.cerrar(); pintar(); sc.scrollTo({ top: 0 }); } } }] });
        return h;
      }

      // ---- toques ----
      const paso = n => (modo === 'dia' ? sumaDias(diaSel, n) : modo === 'tres' ? sumaDias(diaSel, 3 * n) : modo === 'mes' ? sumaMes(diaSel, n) : sumaDias(diaSel, 7 * n));
      el.addEventListener('click', e => {
        const m = e.target.closest('[data-modo]'); if (m) { modo = m.dataset.modo; guarda('ao.mv.cal.modo', modo); scrollKey = ''; pintar(); if (modo !== 'dia') sc.scrollTo({ top: 0 }); return; }
        if (e.target.closest('.mv-fab')) return elegirCrear();
        const nav = e.target.closest('[data-nav]'); if (nav) { diaSel = paso(+nav.dataset.nav); scrollKey = ''; pintar(); return; }
        if (e.target.closest('[data-hoy]')) { diaSel = hoyS(); scrollKey = ''; pintar(); if (modo !== 'dia') sc.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        if (e.target.closest('[data-saltar]')) return abrirSalto();
        if (e.target.closest('[data-capas]')) return abrirCapas();
        if (e.target.closest('[data-buscar]')) return abrirBuscar();
        const c = e.target.closest('.mv-celda'); if (c) { diaSel = c.dataset.dia; pintar(); return; }
        const ev = e.target.closest('.mv-ev, .mv-evb'); if (ev) return abrir(ev);
        const hr = e.target.closest('.mv-hr'); if (hr && modo === 'dia') { const y = e.clientY - hr.parentElement.getBoundingClientRect().top; return elegirCrear(diaSel, horaDeToque(y)); }
        if (e.target.closest('[data-reintentar]')) ctx.store.refrescar();
      });
      ctx.tirar(sc, () => ctx.store.refrescar());
      ctx.store.alCambiar(() => { if (!el.hidden) pintar(); });
      el._apagar = () => clearInterval(tic);
      ctx.contexto(() => ({ view: 'cal', label: 'El calendario · ' + etiquetaRango(), kind: 'range', id: diaSel })); // lo que Dimitri ve en «Viendo»
      el._abrirRutina = () => elegirCrear();
      pintar();
    },
    alMostrar(el, ctx, p) { ctx.store.refrescar(); if (p?.nueva) setTimeout(() => el._abrirRutina?.(), 120); },
    alOcultar(el) { el._apagar?.(); },
  });
}
