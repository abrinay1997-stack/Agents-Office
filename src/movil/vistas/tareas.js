// Versión móvil (25 oct 2026) — TAREAS: una sola columna, casilla grande a la izquierda, el campo de «añadir» siempre abajo (a mano del pulgar)
// y el detalle en una hoja inferior. Las listas son las del dueño (tareas/dueno.mjs: Hoy, Próximos 7 días, Todas, Bandeja, Delegadas,
// Hechas) más «De los agentes» (lo que ellos hacen: aprobar, devolver, ver). Deslizar una fila → derecha la completa, izquierda la pasa
// a mañana (ambos con Deshacer). Reutiliza /api/tareas/* y la lógica pura de tareas/*.mjs; nada se inventa aquí.
import { LISTAS, deLista, cuentas, porDia, gruposHoy, porFecha, esDelDueno, dia } from '../../../tareas/dueno.mjs';
import { visible } from '../../../tareas/estados.mjs';
import { leerRapida } from '../../../tareas/rapida.mjs';
import { gestoFila } from '../nav.js';
import { esc, svg, vacio, esqueleto, falla, limiteTexto, ymd, hace } from '../ui.js';

const CHIPS = [['hoy', 'Hoy'], ['proximos', 'Próximos 7 días'], ['todas', 'Todas'], ['bandeja', 'Bandeja'], ['delegadas', 'Delegadas'], ['hechas', 'Hechas'], ['agentes', 'De los agentes']];
const VACIO = {
  hoy: ['Nada para hoy', 'Añade algo abajo, o mira los próximos días.'], proximos: ['Nada en los próximos 7 días', 'Ponle fecha a lo de tu bandeja para verlo aquí.'],
  todas: ['No tienes nada abierto', 'Escribe abajo para añadir tu primera tarea.'], bandeja: ['La bandeja está vacía', 'Lo que añadas sin fecha entra aquí.'],
  delegadas: ['No delegaste nada todavía', 'Desde el detalle de una tarea tuya puedes pasarla a un agente.'], hechas: ['Aún no terminas nada', 'Lo que completes estos 30 días aparece aquí.'], agentes: ['Los agentes no tienen nada abierto', 'Pídele algo a un agente desde Dimitri.'],
};
const ESTADO_AG = { espera_ok: 'Esperan tu OK', en_curso: 'En curso', en_cola: 'En cola', programada: 'Programadas', bloqueada: 'Bloqueadas', idea: 'Ideas', en_manos: 'En manos de una persona', fallida: 'Fallaron', tuya: 'Tuyas' };
const ORDEN_AG = ['espera_ok', 'fallida', 'en_curso', 'en_cola', 'programada', 'bloqueada', 'en_manos', 'idea'];
const PRIO = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

export function registrar(shell) {
  shell.registrarVista({
    id: 'tareas', titulo: 'Tareas', icono: 'tareas', grupo: 'tab',
    montar(el, ctx) {
      let lista = 'hoy', cargando = true, cat = null;
      el.innerHTML = `<div class="mv-scroll" id="mvTareasSc"><nav class="mv-chips" aria-label="Listas de tareas"></nav><div class="mv-cuerpo" aria-live="polite"></div></div>
        <form class="mv-anadir" autocomplete="off"><div class="mv-entiende" aria-live="polite"></div><div class="mv-anadir-fila"><label class="mv-sr" for="mvNueva">Añadir una tarea</label>
        <input id="mvNueva" type="text" enterkeyhint="send" autocapitalize="sentences" placeholder="Añadir tarea… (para el viernes #ventas !alta)"><button type="submit" class="mv-enviar" aria-label="Añadir tarea" disabled>${svg('mas1')}</button></div></form>`;
      const chips = el.querySelector('.mv-chips'), cuerpo = el.querySelector('.mv-cuerpo'), entrada = el.querySelector('#mvNueva'), forma = el.querySelector('.mv-anadir'), pista = el.querySelector('.mv-entiende'), sc = el.querySelector('.mv-scroll');
      const st = ctx.store.st;

      const mias = () => st.tareas.filter(esDelDueno);
      function pintarChips() {
        const n = cuentas(st.tareas);
        const num = k => k === 'agentes' ? ctx.store.aprobaciones.length : k === 'hechas' ? n.hechasHoy : n[k];
        chips.innerHTML = CHIPS.map(([k, t]) => { const c = num(k); return `<button type="button" class="mv-chip${k === lista ? ' on' : ''}" data-lista="${k}" aria-pressed="${k === lista}">${esc(t)}${c ? `<b>${c}</b>` : ''}</button>`; }).join('');
      }
      function fila(t, { hecha = false } = {}) {
        const lim = limiteTexto(t.limite), vencida = lim.startsWith('vencida');
        const meta = [lim && `<span class="${vencida ? 'rojo' : ''}">${esc(lim)}</span>`, t.prioridad === 'alta' && '<span class="alta">Prioridad alta</span>', t.delegada && `<span>Delegada${t.error ? ' · falló' : ''}</span>`, t.empezada && !hecha && '<span>Haciendo</span>', t.sugeridaPor && '<span>Sugerida</span>'].filter(Boolean).join('');
        return `<li class="mv-fila${hecha ? ' hecha' : ''}" data-id="${esc(t.id)}"><button type="button" class="mv-check${hecha ? ' on' : ''}" data-hecha aria-label="${hecha ? 'Reabrir' : 'Marcar como hecha'}: ${esc(t.title)}"><i>${svg('check')}</i></button>
          <button type="button" class="mv-fila-cuerpo" data-abrir><span class="mv-fila-t">${esc(t.title)}</span>${meta ? `<span class="mv-fila-m">${meta}</span>` : ''}</button></li>`;
      }
      function grupos(gs) { return gs.map(g => `<h3 class="mv-gh${g.k === 'vencidas' ? ' rojo' : ''}">${esc(g.titulo)} <span>${g.tareas.length}</span></h3><ul class="mv-filas">${g.tareas.map(t => fila(t)).join('')}</ul>`).join(''); }
      function filaAgente(t) {
        const v = visible(t), quien = t.agent || t.person || '';
        return `<li class="mv-fila ag" data-id="${esc(t.id)}"><button type="button" class="mv-fila-cuerpo" data-abrir><span class="mv-fila-t">${esc(t.title)}</span><span class="mv-fila-m"><span>${esc(ESTADO_AG[v] || v)}</span>${quien ? `<span>${esc(quien)}</span>` : ''}${t.limite ? `<span>${esc(limiteTexto(t.limite))}</span>` : ''}</span></button>${svg('der', 'mv-der')}</li>`;
      }
      function pintar() {
        pintarChips();
        const sinForma = ['delegadas', 'hechas', 'agentes'].includes(lista); forma.hidden = sinForma; el.classList.toggle('sin-anadir', sinForma);
        if (cargando && !st.cargado) { cuerpo.innerHTML = esqueleto(5); return; }
        if (!st.cargado && st.error) { cuerpo.innerHTML = falla(st.error); return; }
        if (lista === 'agentes') {
          const ag = st.tareas.filter(t => !t.archived && !t.piece && !esDelDueno(t) && !['done'].includes(t.state));
          if (!ag.length) { cuerpo.innerHTML = vacio(...VACIO.agentes, { icono: 'dimitri' }); return; }
          const por = new Map(); for (const t of ag) { const v = visible(t); (por.get(v) || por.set(v, []).get(v)).push(t); }
          cuerpo.innerHTML = ORDEN_AG.filter(v => por.has(v)).map(v => `<h3 class="mv-gh${v === 'espera_ok' || v === 'fallida' ? ' rojo' : ''}">${esc(ESTADO_AG[v])} <span>${por.get(v).length}</span></h3><ul class="mv-filas">${por.get(v).map(filaAgente).join('')}</ul>`).join('');
          return;
        }
        const ahora = Date.now(), { pendientes, hechas } = deLista(st.tareas, lista, { ahora });
        let h = '';
        if (!pendientes.length && !(lista === 'hechas' && hechas.length)) h = vacio(...(VACIO[lista] || VACIO.hoy), { icono: 'tareas' });
        else if (lista !== 'hechas') {
          const gs = lista === 'proximos' ? porDia(pendientes, ahora) : lista === 'hoy' ? gruposHoy(pendientes, ahora) : lista === 'todas' ? porFecha(pendientes, ahora) : null;
          h = gs && (lista !== 'hoy' || gs.length > 1) ? grupos(gs) : `<ul class="mv-filas">${pendientes.map(t => fila(t)).join('')}</ul>`;
        }
        if (hechas.length) h += lista === 'hechas' ? `<ul class="mv-filas">${hechas.map(t => fila(t, { hecha: true })).join('')}</ul>` : `<details class="mv-hechas"><summary>Completadas · ${hechas.length}</summary><ul class="mv-filas">${hechas.map(t => fila(t, { hecha: true })).join('')}</ul></details>`;
        cuerpo.innerHTML = h;
      }
      const buscar = id => st.tareas.find(t => t.id === id);
      async function ver() { cargando = true; pintar(); try { await ctx.store.refrescar(); } finally { cargando = false; pintar(); } }

      // ---- acciones sobre una tarea ----
      async function completar(id, hecha = true) {
        const t = buscar(id); if (!t) return; const antes = t.state;
        t.state = hecha ? 'done' : 'next'; if (hecha) t.doneAt = Date.now(); pintar(); if (navigator.vibrate) navigator.vibrate(8);
        try {
          await ctx.api(`/api/tareas/${id}/estado`, { method: 'POST', body: { a: hecha ? 'done' : 'next' } });
          ctx.toast(hecha ? `Hecha: «${recorte(t.title)}»` : `Reabierta: «${recorte(t.title)}»`, { accion: 'Deshacer', alAccion: () => completar(id, !hecha) });
        } catch (e) { t.state = antes; pintar(); ctx.toast('No se pudo: ' + e.message); }
        ctx.store.refrescar();
      }
      async function posponer(id, a = ymd(new Date(Date.now() + 864e5))) {
        const t = buscar(id); if (!t) return; const antes = t.limite || null;
        if (!esDelDueno(t)) { ctx.toast('Solo se pospone lo tuyo. Abre la tarea para verla.'); return; }
        t.limite = a; pintar();
        try { await ctx.api(`/api/tareas/${id}/organizar`, { method: 'POST', body: { limite: a } }); ctx.toast(`Pasada a ${limiteTexto(a)}: «${recorte(t.title)}»`, { accion: 'Deshacer', alAccion: () => cambiarLimite(id, antes) }); }
        catch (e) { t.limite = antes; pintar(); ctx.toast('No se pudo: ' + e.message); }
        ctx.store.refrescar();
      }
      async function cambiarLimite(id, v) { const t = buscar(id); if (t) { t.limite = v; pintar(); } try { await ctx.api(`/api/tareas/${id}/organizar`, { method: 'POST', body: { limite: v } }); } catch (e) { ctx.toast('No se pudo: ' + e.message); } ctx.store.refrescar(); }

      // ---- añadir rápido ----
      const preset = () => lista === 'hoy' ? { limite: dia(Date.now()) } : lista === 'proximos' ? { limite: dia(Date.now() + 864e5) } : {};
      function entiende() {
        const v = entrada.value.trim(); forma.querySelector('.mv-enviar').disabled = !v;
        if (!v) { pista.textContent = ''; return; }
        const r = leerRapida(v), b = [];
        if (r.limite) b.push('vence ' + limiteTexto(r.limite)); if (r.at) b.push('a las ' + new Date(r.at).toTimeString().slice(0, 5)); if (r.prioridad) b.push('prioridad ' + r.prioridad); if (r.etiquetas?.length) b.push(r.etiquetas.map(e => '#' + e).join(' '));
        pista.textContent = b.length ? 'Entendí: ' + b.join(' · ') : '';
      }
      async function etiquetasDe(nombres = []) {
        if (!nombres.length) return []; const ids = [];
        try { cat ||= await ctx.api('/api/tareas/catalogo'); } catch { return []; }
        for (const n of nombres) { const ya = (cat.etiquetas || []).find(e => e.nombre.toLowerCase() === n); if (ya) ids.push(ya.id); else { try { const e = (await ctx.api('/api/tareas/etiquetas', { method: 'POST', body: { nombre: n } })).etiqueta; (cat.etiquetas ||= []).push(e); ids.push(e.id); } catch {} } }
        return ids;
      }
      async function anadir(raw) {
        const r = leerRapida(raw); if (!r.texto) { ctx.toast('Escribe qué tienes que hacer.'); return; }
        const etiquetas = await etiquetasDe(r.etiquetas);
        const cuerpoPost = { title: r.texto, ...preset(), ...(r.prioridad ? { prioridad: r.prioridad } : {}), ...(r.limite ? { limite: r.limite } : {}), ...(r.at ? { at: r.at } : {}), ...(etiquetas.length ? { etiquetas } : {}) };
        const res = await ctx.api('/api/tareas/mias', { method: 'POST', body: cuerpoPost });
        const t = res.tarea; ctx.toast(`Añadida: «${recorte(t.title)}»`, { accion: 'Deshacer', alAccion: async () => { try { await ctx.api(`/api/tasks/${t.id}`, { method: 'DELETE' }); } catch {} ctx.store.refrescar(); } });
        await ctx.store.refrescar();
      }
      forma.addEventListener('submit', async e => {
        e.preventDefault(); const v = entrada.value.trim(); if (!v) return;
        const b = forma.querySelector('.mv-enviar'); b.disabled = true; entrada.value = ''; entiende();
        try { await anadir(v); } catch (err) { entrada.value = v; entiende(); ctx.toast('No se pudo añadir: ' + err.message); }
      });
      entrada.addEventListener('input', entiende);

      // ---- el detalle, en una hoja ----
      function detalle(id) {
        const t = buscar(id); if (!t) return; const m = esDelDueno(t);
        const h = ctx.hoja({ titulo: m ? 'Tu tarea' : 'Tarea', cuerpo: '<div class="mv-det"></div>', lleno: false });
        const cont = h.cuerpo.querySelector('.mv-det');
        let full = null;
        const dibuja = () => {
          const x = { ...t, ...(full || {}) }, v = visible(x), hecha = x.state === 'done';
          const hoy = ymd(new Date()), man = ymd(new Date(Date.now() + 864e5));
          const lun = (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return ymd(d); })();
          cont.innerHTML = `
            <label class="mv-lab" for="mvDT">Qué hay que hacer</label><textarea id="mvDT" class="mv-campo" rows="2" ${m || ['next', 'scheduled', 'idea'].includes(x.state) ? '' : 'readonly'}>${esc(x.title)}</textarea>
            <p class="mv-meta">${m ? 'Tuya' : esc(ESTADO_AG[v] || v)}${x.agent ? ' · ' + esc(x.agent) : ''}${x.dept ? ' · ' + esc(x.dept) : ''}${x.changedAt ? ' · ' + hace(x.changedAt) : ''}</p>
            ${x.text && x.text !== x.title ? `<p class="mv-notas">${esc(x.text).slice(0, 600)}</p>` : ''}
            ${m ? `<div class="mv-grupo"><span class="mv-lab" id="mvLimL">Para cuándo</span><div class="mv-pastillas" role="group" aria-labelledby="mvLimL">
                ${[['hoy', hoy, 'Hoy'], ['man', man, 'Mañana'], ['lun', lun, 'Lunes']].map(([k, d, n]) => `<button type="button" class="mv-chip${String(x.limite || '').slice(0, 10) === d ? ' on' : ''}" data-lim="${d}" aria-pressed="${String(x.limite || '').slice(0, 10) === d}">${n}</button>`).join('')}
                <button type="button" class="mv-chip" data-lim="" aria-pressed="${!x.limite}">Sin fecha</button></div>
              <label class="mv-lab" for="mvDF">Otra fecha</label><input id="mvDF" type="date" class="mv-campo" value="${esc(String(x.limite || '').slice(0, 10))}"></div>
              <div class="mv-grupo"><span class="mv-lab" id="mvPrL">Prioridad</span><div class="mv-pastillas" role="group" aria-labelledby="mvPrL">${['alta', 'media', 'baja'].map(p => `<button type="button" class="mv-chip${x.prioridad === p ? ' on' : ''}" data-prio="${p}" aria-pressed="${x.prioridad === p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div></div>` : x.limite ? `<p class="mv-meta">Para: ${esc(limiteTexto(x.limite))}</p>` : ''}
            <div class="mv-det-acc">
              ${!m && v === 'espera_ok' ? '<button type="button" class="mv-btn primario" data-ir-aprob>Revisar y aprobar</button>' : ''}
              ${m || ['next', 'scheduled'].includes(x.state) ? `<button type="button" class="mv-btn ${hecha ? '' : 'primario'}" data-fin>${hecha ? 'Reabrir' : 'Marcar como hecha'}</button>` : ''}
              ${m && !hecha ? '<button type="button" class="mv-btn" data-manana>Pasar a mañana</button>' : ''}
              ${m ? '<button type="button" class="mv-btn peligro" data-borrar>Eliminar</button>' : ''}
            </div>`;
        };
        dibuja();
        ctx.api(`/api/tareas/${id}`).then(j => { full = j.tarea; dibuja(); }).catch(() => {});
        cont.addEventListener('click', async e => {
          const b = e.target.closest('button'); if (!b) return;
          if ('lim' in b.dataset) { await cambiarLimite(id, b.dataset.lim || null); dibuja(); }
          else if (b.dataset.prio) { try { await ctx.api(`/api/tareas/${id}/organizar`, { method: 'POST', body: { prioridad: b.dataset.prio } }); t.prioridad = b.dataset.prio; dibuja(); pintar(); } catch (err) { ctx.toast('No se pudo: ' + err.message); } }
          else if (b.hasAttribute('data-fin')) { h.cerrar(); completar(id, t.state !== 'done'); }
          else if (b.hasAttribute('data-manana')) { h.cerrar(); posponer(id); }
          else if (b.hasAttribute('data-ir-aprob')) { h.cerrar(); ctx.navegar('aprobaciones', { id }); }
          else if (b.hasAttribute('data-borrar')) {
            if (!(await ctx.confirmar({ titulo: '¿Eliminar esta tarea?', texto: `«${t.title}» se borra de tu lista.`, ok: 'Eliminar', peligro: true }))) return;
            h.cerrar(); try { await ctx.api(`/api/tasks/${id}`, { method: 'DELETE' }); ctx.toast('Eliminada.'); } catch (err) { ctx.toast('No se pudo: ' + err.message); } ctx.store.refrescar();
          }
        });
        cont.addEventListener('change', async e => { if (e.target.id === 'mvDF') { await cambiarLimite(id, e.target.value || null); dibuja(); } });
        cont.addEventListener('focusout', async e => {
          if (e.target.id !== 'mvDT') return; const v = e.target.value.trim(); if (!v || v === t.title || e.target.readOnly) return;
          try { await ctx.api(`/api/tasks/${id}`, { method: 'PATCH', body: { title: v } }); t.title = v.slice(0, 90); pintar(); } catch (err) { ctx.toast('No se pudo guardar: ' + err.message); }
        });
      }

      // ---- los gestos de una fila: derecha = hecha, izquierda = mañana ----
      let g = null;
      cuerpo.addEventListener('pointerdown', e => {
        const li = e.target.closest('.mv-fila:not(.hecha):not(.ag)'); if (!li || e.target.closest('[data-hecha]') || e.pointerType === 'mouse') return;
        g = { li, x: e.clientX, y: e.clientY, dx: 0, dy: 0, activo: false };
      });
      cuerpo.addEventListener('pointermove', e => {
        if (!g) return; g.dx = e.clientX - g.x; g.dy = e.clientY - g.y;
        if (!g.activo && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5) { g.activo = true; g.li.classList.add('desliza'); try { g.li.setPointerCapture(e.pointerId); } catch {} }
        if (g.activo) { g.li.style.setProperty('--mv-dx', g.dx + 'px'); g.li.dataset.lado = g.dx > 0 ? 'completar' : 'posponer'; g.li.classList.toggle('listo', !!gestoFila(g)); }
      });
      const suelta = () => {
        if (!g) return; const { li, activo } = g, que = activo ? gestoFila(g) : null; g = null;
        li.classList.remove('desliza', 'listo'); li.style.removeProperty('--mv-dx'); delete li.dataset.lado;
        if (que === 'completar') completar(li.dataset.id); else if (que === 'posponer') posponer(li.dataset.id);
      };
      cuerpo.addEventListener('pointerup', suelta); cuerpo.addEventListener('pointercancel', () => { if (g) { g.li.classList.remove('desliza', 'listo'); g.li.style.removeProperty('--mv-dx'); g = null; } });

      // ---- toques ----
      chips.addEventListener('click', e => { const b = e.target.closest('[data-lista]'); if (!b) return; lista = b.dataset.lista; try { sessionStorage.setItem('ao.mv.lista', lista); } catch {} pintar(); sc.scrollTo({ top: 0 }); b.scrollIntoView({ inline: 'center', block: 'nearest' }); });
      cuerpo.addEventListener('click', e => {
        const li = e.target.closest('.mv-fila'); if (li && e.target.closest('[data-hecha]')) { completar(li.dataset.id, !li.classList.contains('hecha')); return; }
        if (li && e.target.closest('[data-abrir]')) { if (li.classList.contains('ag')) { const t = buscar(li.dataset.id); if (t && visible(t) === 'espera_ok') return ctx.navegar('aprobaciones', { id: t.id }); } detalle(li.dataset.id); return; }
        if (e.target.closest('[data-reintentar]')) ver();
      });
      ctx.tirar(sc, () => ctx.store.refrescar());
      ctx.store.alCambiar(() => { if (!el.hidden && !g) pintar(); });
      try { const l = sessionStorage.getItem('ao.mv.lista'); if (l && CHIPS.some(c => c[0] === l)) lista = l; } catch {}
      el._abrirNueva = () => entrada.focus();
      el._elegir = k => { if (CHIPS.some(c => c[0] === k)) { lista = k; pintar(); } };
      el._abrirTarea = detalle;
      pintar();
    },
    alMostrar(el, ctx, p) {
      if (p?.l) el._elegir?.(p.l);
      if (p?.t) el._abrirTarea?.(p.t);
      if (p?.nueva) setTimeout(() => el._abrirNueva?.(), 120);
      ctx.store.refrescar();
    },
  });
}
const recorte = s => (s.length > 38 ? s.slice(0, 37) + '…' : s);
