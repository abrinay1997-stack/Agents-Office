// Versión móvil (25 oct 2026) — TAREAS: una sola columna, casilla grande a la izquierda, el campo de «añadir» siempre abajo (a mano del pulgar)
// y el detalle completo en una hoja a pantalla completa (tareas-detalle.js). Cuatro vistas: Lista (las listas del dueño de tareas/dueno.mjs:
// Hoy, Próximos 7 días, Todas, Bandeja, Delegadas, Hechas, más «De los agentes»), Tablero (columnas que se deslizan), Proyectos y Medidas.
// Filtros (prioridad, etiquetas, proyecto, texto) que se pueden guardar, el cronómetro siempre a la vista, deslizar una fila → derecha la
// completa, izquierda la pasa a mañana (con Deshacer). Reutiliza /api/tareas/* y la lógica pura de tareas/*.mjs; nada se inventa aquí.
import { deLista, cuentas, porDia, gruposHoy, porFecha, esDelDueno, dia } from '../../../tareas/dueno.mjs';
import { visible } from '../../../tareas/estados.mjs';
import { leerRapida } from '../../../tareas/rapida.mjs';
import { gestoFila } from '../nav.js';
import { esc, svg, vacio, esqueleto, falla, limiteTexto, ymd } from '../ui.js';
import { aplicarFiltro, filtroVacio, contarFiltro, filtroTexto, guardarFiltro, quitarFiltro, conCronometro, reloj } from '../tareas-puro.js';
import { ESTADO_AG, catalogo, hacerYa, hacer, recorte, pastilla, elegirPara, paraTexto, ayudaPara } from './tareas-comun.js';
import { abrirDetalle } from './tareas-detalle.js';
import { montarTablero } from './tareas-tablero.js';
import { montarProyectos } from './tareas-proyectos.js';
import { montarMedidas } from './tareas-medidas.js';
import { miNombre } from '../../../tareas/identidad.mjs';

const CHIPS = [['hoy', 'Hoy'], ['proximos', 'Próximos 7 días'], ['todas', 'Todas'], ['bandeja', 'Bandeja'], ['delegadas', 'Delegadas'], ['hechas', 'Hechas'], ['agentes', 'De los agentes']];
const VISTAS = [['lista', 'Lista'], ['tablero', 'Tablero'], ['proyectos', 'Proyectos'], ['medidas', 'Medidas']];
const VACIO = {
  hoy: ['Nada para hoy', 'Añade algo abajo, o mira los próximos días.'], proximos: ['Nada en los próximos 7 días', 'Ponle fecha a lo de tu bandeja para verlo aquí.'],
  todas: ['No tienes nada abierto', 'Escribe abajo para añadir tu primera tarea.'], bandeja: ['La bandeja está vacía', 'Lo que añadas sin fecha entra aquí.'],
  delegadas: ['No delegaste nada todavía', 'Desde el detalle de una tarea tuya puedes pasarla a un agente.'], hechas: ['Aún no terminas nada', 'Lo que completes estos 30 días aparece aquí.'], agentes: ['Los agentes no tienen nada abierto', 'Pídele algo a un agente desde Dimitri.'],
};
const ORDEN_AG = ['espera_ok', 'fallida', 'en_curso', 'en_cola', 'programada', 'bloqueada', 'en_manos', 'idea'];
const guardado = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guarda = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento: no se recuerda */ } };
const FILTRO0 = () => ({ prio: [], etiquetas: [], proyecto: '', texto: '' });

export function registrar(shell) {
  shell.registrarVista({
    id: 'tareas', titulo: 'Tareas', icono: 'tareas', grupo: 'tab',
    montar(el, ctx) {
      let lista = 'hoy', vista = 'lista', cargando = true, cat = null, filtro = FILTRO0(), guardados = guardado('ao.mv.filtros', []), tic = 0, para = 'yo'; // para: a quién va lo que escribo abajo ('yo' · 'p:Nombre' · un departamento)
      el.innerHTML = `<div class="mv-scroll" id="mvTareasSc"><div class="mv-crono" role="status" hidden></div><div class="mv-seg mv-seg-vistas" role="group" aria-label="Cómo ver las tareas">${VISTAS.map(([k, t]) => `<button type="button" data-tv="${k}" aria-pressed="${k === 'lista'}">${t}</button>`).join('')}</div>
        <div class="mv-sec-lista"><nav class="mv-chips" aria-label="Listas de tareas"></nav><div class="mv-filtros"></div></div>
        <div class="mv-cuerpo mv-cuerpo-l" aria-live="polite"></div><div class="mv-cuerpo mv-cuerpo-t" hidden></div><div class="mv-cuerpo mv-cuerpo-p" hidden></div><div class="mv-cuerpo mv-cuerpo-m" hidden></div></div>
        <form class="mv-anadir" autocomplete="off"><div class="mv-entiende" aria-live="polite"></div><div class="mv-anadir-fila"><button type="button" class="mv-para" data-para aria-haspopup="dialog" aria-label="¿Para quién es la tarea? Ahora: para mí"><span>Para mí</span><i aria-hidden="true">▾</i></button><label class="mv-sr" for="mvNueva">Añadir una tarea</label>
        <input id="mvNueva" type="text" enterkeyhint="send" autocapitalize="sentences" placeholder="Añadir tarea… (para el viernes #ventas !alta)"><button type="submit" class="mv-enviar" aria-label="Añadir tarea" disabled>${svg('mas1')}</button></div></form>`;
      const chips = el.querySelector('.mv-chips'), cuerpo = el.querySelector('.mv-cuerpo-l'), entrada = el.querySelector('#mvNueva'), forma = el.querySelector('.mv-anadir'), pista = el.querySelector('.mv-entiende'), sc = el.querySelector('.mv-scroll');
      const secLista = el.querySelector('.mv-sec-lista'), barraFiltros = el.querySelector('.mv-filtros'), crono = el.querySelector('.mv-crono'), segV = el.querySelector('.mv-seg-vistas');
      const cT = el.querySelector('.mv-cuerpo-t'), cP = el.querySelector('.mv-cuerpo-p'), cM = el.querySelector('.mv-cuerpo-m');
      const st = ctx.store.st;
      const alCambiar = () => { ctx.store.refrescar(); };
      const abrir = id => abrirDetalle(ctx, id, { alCambiar });
      const tablero = montarTablero(cT, ctx, { abrir, alCambiar }), proyectos = montarProyectos(cP, ctx, { abrir, alCambiar }), medidas = montarMedidas(cM, ctx, { abrir });

      const todas = () => aplicarFiltro(st.tareas, filtro);
      function pintarChips() {
        const n = cuentas(todas());
        const num = k => k === 'agentes' ? ctx.store.aprobaciones.length : k === 'hechas' ? n.hechasHoy : n[k];
        chips.innerHTML = CHIPS.map(([k, t]) => { const c = num(k); return `<button type="button" class="mv-chip${k === lista ? ' on' : ''}" data-lista="${k}" aria-pressed="${k === lista}">${esc(t)}${c ? `<b>${c}</b>` : ''}</button>`; }).join('');
      }
      function pintarFiltros() {
        const n = contarFiltro(filtro);
        barraFiltros.innerHTML = `<div class="mv-filtros-fila"><button type="button" class="mv-chip mv-filtrar${n ? ' on' : ''}" data-filtrar aria-haspopup="dialog">${svg('buscar')} Filtrar${n ? `<b>${n}</b>` : ''}</button>${guardados.map(g => `<button type="button" class="mv-chip" data-fg="${esc(g.id)}" aria-pressed="${JSON.stringify(g.filtro) === JSON.stringify(filtro)}">${esc(g.nombre)}</button>`).join('')}</div>
          ${n ? `<p class="mv-filtro-act"><span>${esc(filtroTexto(filtro, cat || {}))}</span><button type="button" class="mv-link" data-quitar-filtro>Quitar</button></p>` : ''}`;
      }
      function fila(t, { hecha = false } = {}) {
        const lim = limiteTexto(t.limite), vencida = lim.startsWith('vencida'), p = t.pasos?.length ? `${t.pasos.filter(x => x.hecho).length}/${t.pasos.length}` : '';
        const meta = [lim && `<span class="${vencida ? 'rojo' : ''}">${esc(lim)}</span>`, t.prioridad === 'alta' && '<span class="alta">Prioridad alta</span>', t.delegada && `<span>Delegada${t.error ? ' · falló' : ''}</span>`, t.empezada && !hecha && '<span>Haciendo</span>', t.sugeridaPor && '<span>Sugerida</span>', p && `<span>Pasos ${p}</span>`, (t.bloqueadaPor || []).length && !hecha && '<span>Bloqueada</span>'].filter(Boolean).join('');
        return `<li class="mv-fila${hecha ? ' hecha' : ''}" data-id="${esc(t.id)}"><button type="button" class="mv-check${hecha ? ' on' : ''}" data-hecha aria-label="${hecha ? 'Reabrir' : 'Marcar como hecha'}: ${esc(t.title)}"><i>${svg('check')}</i></button>
          <button type="button" class="mv-fila-cuerpo" data-abrir><span class="mv-fila-t">${esc(t.title)}</span>${meta ? `<span class="mv-fila-m">${meta}</span>` : ''}</button></li>`;
      }
      function grupos(gs) { return gs.map(g => `<h3 class="mv-gh${g.k === 'vencidas' ? ' rojo' : ''}">${esc(g.titulo)} <span>${g.tareas.length}</span></h3><ul class="mv-filas">${g.tareas.map(t => fila(t)).join('')}</ul>`).join(''); }
      function filaAgente(t) {
        const v = visible(t), quien = t.agent || t.person || '';
        return `<li class="mv-fila ag" data-id="${esc(t.id)}"><button type="button" class="mv-fila-cuerpo" data-abrir><span class="mv-fila-t">${esc(t.title)}</span><span class="mv-fila-m"><span>${esc(ESTADO_AG[v] || v)}</span>${quien ? `<span>${esc(quien)}</span>` : ''}${t.limite ? `<span>${esc(limiteTexto(t.limite))}</span>` : ''}</span></button>${svg('der', 'mv-der')}</li>`;
      }
      function pintarLista() {
        pintarChips(); pintarFiltros();
        if (cargando && !st.cargado) { cuerpo.innerHTML = esqueleto(5); return; }
        if (!st.cargado && st.error) { cuerpo.innerHTML = falla(st.error); return; }
        const base = todas();
        if (lista === 'agentes') {
          const ag = base.filter(t => !t.archived && !t.piece && !esDelDueno(t) && t.state !== 'done');
          if (!ag.length) { cuerpo.innerHTML = filtroVacio(filtro) ? vacio(...VACIO.agentes, { icono: 'dimitri' }) : vacio('Nada con ese filtro', 'Cambia o quita el filtro para ver más.', { icono: 'tareas', boton: 'Quitar el filtro', accion: 'data-quitar-filtro' }); return; }
          const por = new Map(); for (const t of ag) { const v = visible(t); (por.get(v) || por.set(v, []).get(v)).push(t); }
          cuerpo.innerHTML = ORDEN_AG.filter(v => por.has(v)).map(v => `<h3 class="mv-gh${v === 'espera_ok' || v === 'fallida' ? ' rojo' : ''}">${esc(ESTADO_AG[v])} <span>${por.get(v).length}</span></h3><ul class="mv-filas">${por.get(v).map(filaAgente).join('')}</ul>`).join('');
          return;
        }
        const ahora = Date.now(), { pendientes, hechas } = deLista(base, lista, { ahora });
        let h = '';
        if (!pendientes.length && !(lista === 'hechas' && hechas.length)) h = !filtroVacio(filtro) ? vacio('Nada con ese filtro', 'Cambia o quita el filtro para ver más.', { icono: 'tareas', boton: 'Quitar el filtro', accion: 'data-quitar-filtro' }) : vacio(...(VACIO[lista] || VACIO.hoy), { icono: 'tareas' });
        else if (lista !== 'hechas') {
          const gs = lista === 'proximos' ? porDia(pendientes, ahora) : lista === 'hoy' ? gruposHoy(pendientes, ahora) : lista === 'todas' ? porFecha(pendientes, ahora) : null;
          h = gs && (lista !== 'hoy' || gs.length > 1) ? grupos(gs) : `<ul class="mv-filas">${pendientes.map(t => fila(t)).join('')}</ul>`;
        }
        if (hechas.length) h += lista === 'hechas' ? `<ul class="mv-filas">${hechas.map(t => fila(t, { hecha: true })).join('')}</ul>` : `<details class="mv-hechas"><summary>Completadas · ${hechas.length}</summary><ul class="mv-filas">${hechas.map(t => fila(t, { hecha: true })).join('')}</ul></details>`;
        cuerpo.innerHTML = h;
      }
      function pintarCrono() {
        const c = conCronometro(st.tareas, miNombre()); clearInterval(tic);
        if (!c) { crono.hidden = true; return; }
        crono.hidden = false;
        crono.innerHTML = `<span class="mv-crono-t"><small>Contando tu tiempo</small><b>${esc(recorte(c.tarea.title, 48))}</b></span><time>${reloj(Date.now() - c.desde)}</time><button type="button" class="mv-btn" data-parar="${esc(c.tarea.id)}">Parar</button>`;
        const t = crono.querySelector('time'); tic = setInterval(() => { if (!el.hidden) t.textContent = reloj(Date.now() - c.desde); }, 1000);
      }
      function pintar() {
        pintarCrono();
        for (const b of segV.querySelectorAll('[data-tv]')) b.setAttribute('aria-pressed', String(b.dataset.tv === vista));
        secLista.hidden = cuerpo.hidden = vista !== 'lista'; cT.hidden = vista !== 'tablero'; cP.hidden = vista !== 'proyectos'; cM.hidden = vista !== 'medidas';
        const sinForma = vista !== 'lista' || ['delegadas', 'hechas', 'agentes'].includes(lista); forma.hidden = sinForma; el.classList.toggle('sin-anadir', sinForma);
        if (vista === 'lista') pintarLista(); else if (vista === 'tablero' && st.cargado) tablero.pintar();
      }
      const buscar = id => st.tareas.find(t => t.id === id);
      async function ver() { cargando = true; pintar(); try { await ctx.store.refrescar(); } finally { cargando = false; pintar(); } }

      // ---- acciones sobre una fila ----
      async function completar(id, hecha = true) {
        const t = buscar(id); if (!t) return; const antes = t.state, doneAntes = t.doneAt;
        t.state = hecha ? 'done' : 'next'; if (hecha) t.doneAt = Date.now(); pintar(); if (navigator.vibrate) navigator.vibrate(8);
        const r = await hacerYa(ctx, () => ctx.api(`/api/tareas/${id}/estado`, { method: 'POST', body: { a: hecha ? 'done' : 'next' } }), { aviso: hecha ? `Hecha: «${recorte(t.title)}»` : `Reabierta: «${recorte(t.title)}»`, deshacer: () => ctx.api(`/api/tareas/${id}/estado`, { method: 'POST', body: { a: hecha ? 'next' : 'done' } }), despues: () => ctx.store.refrescar() });
        if (!r.ok) { t.state = antes; t.doneAt = doneAntes; pintar(); }
      }
      async function posponer(id, a = ymd(new Date(Date.now() + 864e5))) {
        const t = buscar(id); if (!t) return;
        if (!esDelDueno(t)) { ctx.toast('Solo se pospone lo tuyo. Ábrela para verla.'); return; }
        const antes = t.limite || null; t.limite = a; pintar();
        const r = await hacerYa(ctx, () => ctx.api(`/api/tareas/${id}/organizar`, { method: 'POST', body: { limite: a } }), { aviso: `Pasada a ${limiteTexto(a)}: «${recorte(t.title)}»`, deshacer: () => ctx.api(`/api/tareas/${id}/organizar`, { method: 'POST', body: { limite: antes } }), despues: () => ctx.store.refrescar() });
        if (!r.ok) { t.limite = antes; pintar(); }
      }

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
        try { cat = await catalogo(ctx); } catch { return []; }
        for (const n of nombres) { const ya = (cat.etiquetas || []).find(e => e.nombre.toLowerCase() === n); if (ya) ids.push(ya.id); else { try { const e = (await ctx.api('/api/tareas/etiquetas', { method: 'POST', body: { nombre: n } })).etiqueta; (cat.etiquetas ||= []).push(e); ids.push(e.id); } catch { /* sin esa etiqueta */ } } }
        return ids;
      }
      async function anadir(raw) {
        const r = leerRapida(raw); if (!r.texto) { ctx.toast('Escribe qué tienes que hacer.'); return; }
        const etiquetas = await etiquetasDe(r.etiquetas);
        const cuerpoPost = { title: r.texto, ...preset(), ...(r.prioridad ? { prioridad: r.prioridad } : {}), ...(r.limite ? { limite: r.limite } : {}), ...(r.at ? { at: r.at } : {}), ...(etiquetas.length ? { etiquetas } : {}) };
        const aPersona = para.startsWith('p:'), aAgente = para !== 'yo' && !aPersona; // 26 oct 2026: también se asigna a una cuenta del equipo o a un agente
        const res = aAgente ? { tarea: await ctx.api('/api/tasks', { method: 'POST', body: { dept: para, text: r.texto, ...(cuerpoPost.prioridad ? { prioridad: cuerpoPost.prioridad } : {}), ...(cuerpoPost.limite ? { limite: cuerpoPost.limite } : {}), ...(cuerpoPost.at ? { at: cuerpoPost.at } : {}), ...(etiquetas.length ? { etiquetas } : {}) } }) }
          : await ctx.api('/api/tareas/mias', { method: 'POST', body: aPersona ? { ...cuerpoPost, persona: para.slice(2) } : cuerpoPost });
        const t = res.tarea; ctx.toast(aPersona ? `Asignada a ${t.person || para.slice(2)}: «${recorte(t.title)}»` : aAgente ? `Para ${paraTexto(para)}: «${recorte(t.title)}»` : `Añadida: «${recorte(t.title)}»`, { accion: 'Deshacer', alAccion: async () => { try { await ctx.api(`/api/tasks/${t.id}`, { method: 'DELETE' }); } catch { /* ya no estaba */ } ctx.store.refrescar(); } });
        await ctx.store.refrescar();
      }
      forma.addEventListener('submit', async e => {
        e.preventDefault(); const v = entrada.value.trim(); if (!v) return;
        const b = forma.querySelector('.mv-enviar'); b.disabled = true; entrada.value = ''; entiende();
        try { await anadir(v); } catch (err) { entrada.value = v; entiende(); ctx.toast('No se pudo añadir: ' + err.message, { accion: 'Reintentar', alAccion: () => forma.requestSubmit() }); }
      });
      entrada.addEventListener('input', entiende);
      forma.querySelector('[data-para]').addEventListener('click', async e => {
        const b = e.currentTarget, v = await elegirPara(ctx, para); if (!v) return;
        para = v; b.querySelector('span').textContent = paraTexto(v); b.setAttribute('aria-label', `¿Para quién es la tarea? Ahora: ${v === 'yo' ? 'para mí' : paraTexto(v)}`); b.classList.toggle('otro', v !== 'yo');
        pista.textContent = v === 'yo' ? '' : ayudaPara(v); entrada.focus();
      });

      // ---- filtros ----
      async function abrirFiltros() {
        try { cat = await catalogo(ctx); } catch { cat = cat || { proyectos: [], etiquetas: [] }; }
        let f = { prio: [...filtro.prio], etiquetas: [...filtro.etiquetas], proyecto: filtro.proyecto, texto: filtro.texto };
        const cuerpoF = () => `<label class="mv-lab" for="mvFq">Buscar en el título y las notas</label><input id="mvFq" type="text" class="mv-campo" value="${esc(f.texto)}" placeholder="Palabra o frase" enterkeyhint="done">
          <span class="mv-lab" id="mvFpL">Prioridad</span><div class="mv-pastillas" role="group" aria-labelledby="mvFpL">${['alta', 'media', 'baja'].map(p => pastilla(p[0].toUpperCase() + p.slice(1), `data-fp="${p}"`, f.prio.includes(p))).join('')}</div>
          <span class="mv-lab" id="mvFeL">Etiquetas</span><div class="mv-pastillas" role="group" aria-labelledby="mvFeL">${(cat.etiquetas || []).map(e => pastilla('#' + e.nombre, `data-fe="${esc(e.id)}"`, f.etiquetas.includes(e.id))).join('') || '<span class="mv-meta">Aún no hay etiquetas: créalas desde el detalle de una tarea.</span>'}</div>
          <label class="mv-lab" for="mvFy">Proyecto</label><select id="mvFy" class="mv-campo"><option value="">Cualquiera</option><option value="-"${f.proyecto === '-' ? ' selected' : ''}>Sin proyecto</option>${(cat.proyectos || []).map(p => `<option value="${esc(p.id)}"${f.proyecto === p.id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
          <label class="mv-lab" for="mvFn">Guardar este filtro como (opcional)</label><input id="mvFn" type="text" class="mv-campo" maxlength="30" placeholder="Ej.: Urgente de ventas">
          ${guardados.length ? `<span class="mv-lab">Guardados</span><ul class="mv-convs">${guardados.map(g => `<li class="mv-conv"><span class="mv-conv-b"><b>${esc(g.nombre)}</b><small>${esc(filtroTexto(g.filtro, cat))}</small></span><button type="button" class="mv-ic" data-borrar-fg="${esc(g.id)}" aria-label="Borrar el filtro guardado «${esc(g.nombre)}»">${svg('borrar')}</button></li>`).join('')}</ul>` : ''}`;
        const h = ctx.hoja({ titulo: 'Filtrar tareas', cuerpo: `<div class="mv-fq">${cuerpoF()}</div>`, acciones: [{ texto: 'Limpiar', alTocar: x => { f = FILTRO0(); x.cuerpo.firstElementChild.innerHTML = cuerpoF(); } }, { texto: 'Ver las tareas', tipo: 'primario', alTocar: x => {
          const c = x.cuerpo; f.texto = c.querySelector('#mvFq').value.trim(); f.proyecto = c.querySelector('#mvFy').value;
          const nom = c.querySelector('#mvFn').value.trim(); filtro = f; if (nom && !filtroVacio(f)) { guardados = guardarFiltro(guardados, nom, f); guarda('ao.mv.filtros', guardados); }
          x.cerrar(); pintar();
        } }] });
        h.cuerpo.addEventListener('click', e => {
          const p = e.target.closest('[data-fp]'), en = e.target.closest('[data-fe]'), bg = e.target.closest('[data-borrar-fg]');
          if (p) { const k = p.dataset.fp; f.prio = f.prio.includes(k) ? f.prio.filter(x => x !== k) : [...f.prio, k]; p.setAttribute('aria-pressed', String(f.prio.includes(k))); }
          else if (en) { const k = en.dataset.fe; f.etiquetas = f.etiquetas.includes(k) ? f.etiquetas.filter(x => x !== k) : [...f.etiquetas, k]; en.setAttribute('aria-pressed', String(f.etiquetas.includes(k))); }
          else if (bg) { guardados = quitarFiltro(guardados, bg.dataset.borrarFg); guarda('ao.mv.filtros', guardados); bg.closest('li').remove(); pintar(); }
        });
        h.cuerpo.addEventListener('input', e => { if (e.target.id === 'mvFq') f.texto = e.target.value; });
      }

      // ---- los gestos de una fila: derecha = hecha, izquierda = mañana ----
      let g = null;
      cuerpo.addEventListener('pointerdown', e => {
        const li = e.target.closest('.mv-fila:not(.hecha):not(.ag)'); if (!li || e.target.closest('[data-hecha]') || e.pointerType === 'mouse') return;
        g = { li, x: e.clientX, y: e.clientY, dx: 0, dy: 0, activo: false };
      });
      cuerpo.addEventListener('pointermove', e => {
        if (!g) return; g.dx = e.clientX - g.x; g.dy = e.clientY - g.y;
        if (!g.activo && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5) { g.activo = true; g.li.classList.add('desliza'); try { g.li.setPointerCapture(e.pointerId); } catch { /* sin captura */ } }
        if (g.activo) { g.li.style.setProperty('--mv-dx', g.dx + 'px'); g.li.dataset.lado = g.dx > 0 ? 'completar' : 'posponer'; g.li.classList.toggle('listo', !!gestoFila(g)); }
      });
      const suelta = () => {
        if (!g) return; const { li, activo } = g, que = activo ? gestoFila(g) : null; g = null;
        li.classList.remove('desliza', 'listo'); li.style.removeProperty('--mv-dx'); delete li.dataset.lado;
        if (que === 'completar') completar(li.dataset.id); else if (que === 'posponer') posponer(li.dataset.id);
      };
      cuerpo.addEventListener('pointerup', suelta); cuerpo.addEventListener('pointercancel', () => { if (g) { g.li.classList.remove('desliza', 'listo'); g.li.style.removeProperty('--mv-dx'); g = null; } });

      // ---- toques ----
      const irVista = k => { vista = k; try { sessionStorage.setItem('ao.mv.tvista', vista); } catch { /* no se recuerda */ } pintar(); sc.scrollTo({ top: 0 }); if (k === 'proyectos') proyectos.pintar(); else if (k === 'medidas') medidas.pintar(true); };
      segV.addEventListener('click', e => { const b = e.target.closest('[data-tv]'); if (b) irVista(b.dataset.tv); });
      chips.addEventListener('click', e => { const b = e.target.closest('[data-lista]'); if (!b) return; lista = b.dataset.lista; try { sessionStorage.setItem('ao.mv.lista', lista); } catch { /* no se recuerda */ } pintar(); sc.scrollTo({ top: 0 }); b.scrollIntoView({ inline: 'center', block: 'nearest' }); });
      barraFiltros.addEventListener('click', e => {
        if (e.target.closest('[data-filtrar]')) return abrirFiltros();
        if (e.target.closest('[data-quitar-filtro]')) { filtro = FILTRO0(); return pintar(); }
        const gf = e.target.closest('[data-fg]'); if (gf) { const x = guardados.find(y => y.id === gf.dataset.fg); if (x) { filtro = JSON.parse(JSON.stringify(x.filtro)); pintar(); } }
      });
      crono.addEventListener('click', e => { const b = e.target.closest('[data-parar]'); if (b) hacer(ctx, b, () => ctx.api(`/api/tareas/${b.dataset.parar}/cronometro`, { method: 'POST', body: { accion: 'parar' } }), { ocupado: 'Parando…', hecho: 'Parado', ms: 500, aviso: 'Tiempo parado.', despues: () => ctx.store.refrescar() }); });
      cuerpo.addEventListener('click', e => {
        if (e.target.closest('[data-quitar-filtro]')) { filtro = FILTRO0(); return pintar(); }
        const li = e.target.closest('.mv-fila'); if (li && e.target.closest('[data-hecha]')) { completar(li.dataset.id, !li.classList.contains('hecha')); return; }
        if (li && e.target.closest('[data-abrir]')) { if (li.classList.contains('ag')) { const t = buscar(li.dataset.id); if (t && visible(t) === 'espera_ok') return ctx.navegar('aprobaciones', { id: t.id }); } abrir(li.dataset.id); return; }
        if (e.target.closest('[data-reintentar]')) ver();
      });
      ctx.tirar(sc, () => ctx.store.refrescar());
      ctx.store.alCambiar(() => { if (el.hidden || g) return; pintarCrono(); if (vista === 'lista') pintarLista(); else if (vista === 'tablero') tablero.pintar(); });
      try { const l = sessionStorage.getItem('ao.mv.lista'); if (l && CHIPS.some(c => c[0] === l)) lista = l; const v = sessionStorage.getItem('ao.mv.tvista'); if (v && VISTAS.some(c => c[0] === v)) vista = v; } catch { /* sin memoria */ }
      el._abrirNueva = () => { if (vista !== 'lista') irVista('lista'); entrada.focus(); };
      el._elegir = k => { if (CHIPS.some(c => c[0] === k)) { lista = k; vista = 'lista'; pintar(); } };
      el._abrirTarea = abrir;
      el._vista = k => { if (VISTAS.some(c => c[0] === k)) irVista(k); };
      el._apagar = () => clearInterval(tic);
      ctx.contexto(() => ({ view: 'tareas', label: 'Tus tareas · ' + (vista === 'lista' ? CHIPS.find(c => c[0] === lista)?.[1] : VISTAS.find(c => c[0] === vista)?.[1]), kind: null })); // lo que Dimitri ve en «Viendo»
      pintar(); if (vista === 'proyectos') proyectos.pintar(); else if (vista === 'medidas') medidas.pintar();
    },
    alMostrar(el, ctx, p) {
      if (p?.l) el._elegir?.(p.l);
      if (p?.v) el._vista?.(p.v);
      if (p?.t) el._abrirTarea?.(p.t);
      if (p?.nueva) setTimeout(() => el._abrirNueva?.(), 120);
      ctx.store.refrescar();
    },
    alOcultar(el) { el._apagar?.(); },
  });
}
