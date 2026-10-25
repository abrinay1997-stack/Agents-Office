// Versión móvil (25 oct 2026) — CONTENIDO: lo que se publica en redes, hecho para el pulgar. Cuatro pestañas dentro de una sola pantalla:
//   · AGENDA   los días con sus piezas (tarjeta: miniatura, redes con sus iconos reales, estado y hora); semana y mes compactos con puntos;
//              «+» flotante abre «Crear publicación» (crear.js, a pantalla completa por pasos);
//   · COLA     la Programación: lo que pide tu atención, «Borradores de la semana» con Aprobar, y la cola por día con EN COLA · ENTREGANDO ·
//              PROGRAMADA · PUBLICADA · FALLÓ y sus botones; selección múltiple con una barra de acciones;
//   · BANDEJA  los comentarios y mensajes de Meta (bandeja.js);
//   · PERFIL   la cuadrícula de Instagram a 3:4, lo programado encima de lo publicado.
// NO duplica reglas: las de cada red son contenido-reglas.js, la cola es contenido-cola.js, y quién aprueba lo decide el servidor (solo el dueño;
// guardar no aprueba). Los botones que piden algo al servidor usan conEstado (ocupado → hecho ✓ | error con «Reintentar»).
import { colaPorDia, requiereAccion, textoSalida, momentoDe, cuentaAtras } from '../../contenido-cola.js';
import { ESTADO, FORMATO } from '../../pieza-base.js';
import { formatoDe, nombreFormato } from '../../contenido-reglas.js';
import { mesGrid, cabeceraSemana } from '../agenda.js';
import { esc, svg, vacio, esqueleto, falla } from '../ui.js';
import { redes, miniatura, con, diaTexto, diaLargo, hoyYmd, sumaDias, aprobarPieza, resumenSalida, motivo, NOMBRE_RED } from './d-comun.js';
import { montarBandeja } from './bandeja.js';

const TABS = [['agenda', 'Agenda'], ['cola', 'Cola'], ['bandeja', 'Bandeja'], ['perfil', 'Perfil']];
const titulo = p => (p.titulo || String(p.texto || '').split('\n')[0] || '').trim().slice(0, 90) || 'Sin título';
const chipEstado = p => {
  const sal = textoSalida(p), e = ESTADO[p.estado] || ESTADO.borrador;
  if (sal) return `<span class="md-chip ${sal.malo ? 'mal' : sal.clave === 'publicada' ? 'bien' : 'info'}">${esc(sal.etiqueta)}</span>`;
  return `<span class="md-chip e-${esc(p.estado)}">${esc(e.name)}</span>`;
};
const formatosTxt = p => { const set = new Set((p.redes || []).map(r => nombreFormato(r, formatoDe(p, r)))); return [...set].join(' · '); };

export function registrar(shell) {
  shell.registrarVista({
    id: 'contenido', titulo: 'Contenido', icono: 'contenido', grupo: 'mas', sec: 'trabajo', texto: 'Lo que publicas en redes',
    montar(el, ctx) {
      const E = { piezas: [], ajustes: {}, cargado: false, error: null, tab: 'agenda', modo: 'lista', ancla: Date.now(), diaSel: hoyYmd(), sel: new Set(), seleccionando: false, publicadas: [], pendBandeja: 0, vivo: true };
      el.innerHTML = `<div class="mv-chips md-tabs" role="group" aria-label="Secciones de Contenido">${TABS.map(([k, n]) => `<button type="button" class="mv-chip" data-tab="${k}" aria-pressed="false">${n}<b data-n="${k}" hidden></b></button>`).join('')}</div>
        <div class="mv-scroll" data-sc><div class="mv-cuerpo md-cuerpo" aria-live="polite"></div></div>
        <button type="button" class="mv-fab" data-nueva aria-label="Crear publicación">${svg('mas1')}</button>
        <div class="md-barra-sel" hidden role="toolbar" aria-label="Acciones para las piezas elegidas"></div>`;
      const cuerpo = el.querySelector('.md-cuerpo'), sc = el.querySelector('[data-sc]'), barraSel = el.querySelector('.md-barra-sel'), fab = el.querySelector('[data-nueva]');
      let panelBandeja = null;

      // ---------------------------------------------------------------- datos
      async function cargar({ silencioso = false } = {}) {
        if (!silencioso && !E.cargado) cuerpo.innerHTML = esqueleto(4);
        try {
          const d = hoyYmd();
          const r = await ctx.api(`/api/contenido?desde=${sumaDias(d, -60)}&hasta=${sumaDias(d, 90)}&sin_fecha=1`);
          E.piezas = r.piezas || []; E.ajustes = r.ajustes || {}; E.cargado = true; E.error = null;
          const sinOk = E.piezas.filter(p => p.estado === 'revision').length;
          const nC = el.querySelector('[data-n="cola"]'); nC.textContent = sinOk; nC.hidden = !sinOk;
        } catch (e) { E.error = motivo(e); }
        pintar();
      }
      const porId = id => E.piezas.find(p => p.id === id);

      // ---------------------------------------------------------------- tarjetas
      function tarjeta(p, { hora = true, sel = false } = {}) {
        const errores = (p.revision?.errores || []).length, avisos = (p.revision?.avisos || []).length;
        const extra = p.cambiadaTrasAprobar ? '<span class="md-chip mal">CAMBIÓ: vuelve a aprobarla</span>' : '';
        return `<li><button type="button" class="md-pz${sel ? ' sel' : ''}" data-pz="${esc(p.id)}" ${E.seleccionando ? `role="checkbox" aria-checked="${E.sel.has(p.id)}"` : ''}>
          ${E.seleccionando ? `<span class="md-check${E.sel.has(p.id) ? ' on' : ''}" aria-hidden="true">${E.sel.has(p.id) ? '✓' : ''}</span>` : ''}
          ${miniatura((p.medios || [])[0], { clase: 'md-mini' })}
          <span class="md-pz-c"><b>${esc(titulo(p))}</b>
            ${p.texto ? `<small>${esc(String(p.texto).replace(/\s+/g, ' ').slice(0, 90))}</small>` : '<small>Sin texto todavía</small>'}
            <span class="md-pz-m">${redes(p.redes, 18)}<span class="md-fmt">${esc(formatosTxt(p))}</span>${chipEstado(p)}${extra}${errores ? `<span class="md-chip mal">${errores} ${errores === 1 ? 'problema' : 'problemas'}</span>` : avisos ? `<span class="md-chip aviso">${avisos} ${avisos === 1 ? 'aviso' : 'avisos'}</span>` : ''}</span></span>
          ${hora ? `<span class="md-pz-h">${esc(p.hora || '—')}</span>` : ''}</button></li>`;
      }

      // ---------------------------------------------------------------- AGENDA
      function dias(rango) { const m = new Map(); for (const p of E.piezas.filter(rango)) { if (!m.has(p.fecha)) m.set(p.fecha, []); m.get(p.fecha).push(p); } for (const v of m.values()) v.sort((a, b) => (a.hora || '').localeCompare(b.hora || '')); return m; }
      function pintarAgenda() {
        const seg = `<div class="mv-seg" role="group" aria-label="Cómo verlo">${[['lista', 'Agenda'], ['semana', 'Semana'], ['mes', 'Mes']].map(([k, n]) => `<button type="button" data-modo="${k}" aria-pressed="${E.modo === k}">${n}</button>`).join('')}</div>`;
        const modoTxt = E.ajustes.modo === 'simulacro' ? '<p class="md-aviso">Modo simulacro: lo aprobado no se publica de verdad.</p>' : E.ajustes.modo === 'apagado' ? '<p class="md-aviso">La publicación está apagada: lo aprobado no sale.</p>' : '';
        if (E.modo === 'mes') return seg + modoTxt + pintarMes();
        if (E.modo === 'semana') return seg + modoTxt + pintarSemana();
        const hoy = hoyYmd(), fin = sumaDias(hoy, 45), m = dias(p => p.fecha && p.fecha >= hoy && p.fecha <= fin);
        const sinFecha = E.piezas.filter(p => !p.fecha);
        const lista = [...m.keys()].sort();
        if (!m.has(hoy)) lista.unshift(hoy);
        const html = lista.map(f => { const l = m.get(f) || []; return `<section class="mv-dia${f === hoy ? ' hoy' : ''}"><h3>${esc(diaTexto(f))}<small>${esc(diaLargo(f))}</small></h3>${l.length ? `<ul class="md-lista">${l.map(p => tarjeta(p)).join('')}</ul>` : `<p class="mv-nada">Nada programado. <button type="button" class="mv-link" data-nueva-dia="${f}">Crear una</button></p>`}</section>`; }).join('');
        const sf = sinFecha.length ? `<section class="mv-dia"><h3>Sin día<small>${sinFecha.length}</small></h3><ul class="md-lista">${sinFecha.map(p => tarjeta(p, { hora: false })).join('')}</ul></section>` : '';
        const atras = E.piezas.filter(p => p.fecha && p.fecha < hoy && !['publicada'].includes(p.salida?.estado) && (p.estado === 'aprobada' || p.estado === 'revision')).length;
        const vencidas = atras ? `<p class="md-aviso rojo">${atras} ${atras === 1 ? 'pieza ya pasó' : 'piezas ya pasaron'} de hora sin salir. <button type="button" class="mv-link" data-tab-ir="cola">Verlas</button></p>` : '';
        return seg + modoTxt + vencidas + (E.piezas.length ? html + sf : vacio('Todavía no hay piezas', 'Crea la primera publicación con el botón «+».', { icono: 'contenido', boton: 'Crear publicación', accion: 'data-nueva-dia=""' }));
      }
      function pintarSemana() {
        const lun = (() => { const d = new Date(`${E.diaSel}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
        const dd = [...Array(7)].map((_, i) => { const d = new Date(lun); d.setDate(lun.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
        const m = dias(p => p.fecha && dd.includes(p.fecha)), del = m.get(E.diaSel) || [];
        return `<div class="mv-mes-cab"><button type="button" class="mv-ic" data-sem="-1" aria-label="Semana anterior">${svg('izq')}</button><h3>${esc(diaLargo(dd[0]).replace(/^\w+ /, ''))} – ${esc(diaLargo(dd[6]).replace(/^\w+ /, ''))}</h3><button type="button" class="mv-ic" data-sem="1" aria-label="Semana siguiente">${svg('der')}</button></div>
          <div class="mv-chips md-semana" role="group" aria-label="Días de la semana">${dd.map((f, i) => { const n = (m.get(f) || []).length; return `<button type="button" class="mv-chip" data-dia="${f}" aria-pressed="${f === E.diaSel}" aria-label="${esc(diaLargo(f))}${n ? ', ' + n + ' piezas' : ''}"><span>${cabeceraSemana[i]} ${+f.slice(8)}</span>${n ? `<b>${n}</b>` : ''}</button>`; }).join('')}</div>
          <h3 class="mv-gh">${esc(diaTexto(E.diaSel))} <span>${del.length}</span></h3>${del.length ? `<ul class="md-lista">${del.map(p => tarjeta(p)).join('')}</ul>` : `<p class="mv-nada">Nada este día. <button type="button" class="mv-link" data-nueva-dia="${E.diaSel}">Crear una</button></p>`}`;
      }
      function pintarMes() {
        const evs = E.piezas.filter(p => p.fecha).map(p => ({ at: momentoDe(p) ?? new Date(`${p.fecha}T12:00`).getTime(), tipo: 'p' })), m = mesGrid(E.ancla, evs), del = E.piezas.filter(p => p.fecha === E.diaSel).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
        return `<div class="mv-mes-cab"><button type="button" class="mv-ic" data-mes="-1" aria-label="Mes anterior">${svg('izq')}</button><h3>${esc(m.titulo)}</h3><button type="button" class="mv-ic" data-mes="1" aria-label="Mes siguiente">${svg('der')}</button></div>
          <div class="mv-mes md-mes" role="grid" aria-label="${esc(m.titulo)}"><div class="mv-mes-sem" role="row">${cabeceraSemana.map(c => `<span role="columnheader">${c}</span>`).join('')}</div>
          ${m.semanas.map(w => `<div class="mv-mes-fila" role="row">${w.map(c => `<button type="button" role="gridcell" class="mv-celda${c.delMes ? '' : ' fuera'}${c.dia === E.diaSel ? ' sel' : ''}${c.dia === hoyYmd() ? ' hoy' : ''}" data-dia="${c.dia}" aria-label="${esc(diaLargo(c.dia))}${c.n ? ', ' + c.n + (c.n === 1 ? ' pieza' : ' piezas') : ''}" aria-pressed="${c.dia === E.diaSel}"><b>${c.num}</b><i>${c.n ? '<u></u>'.repeat(Math.min(3, c.n)) : ''}</i></button>`).join('')}</div>`).join('')}</div>
          <h3 class="mv-gh">${esc(diaTexto(E.diaSel))} <span>${del.length}</span></h3>${del.length ? `<ul class="md-lista">${del.map(p => tarjeta(p)).join('')}</ul>` : `<p class="mv-nada">Nada este día. <button type="button" class="mv-link" data-nueva-dia="${E.diaSel}">Crear una</button></p>`}`;
      }

      // ---------------------------------------------------------------- COLA (Programación)
      const puedeAprobar = p => !(p.revision?.errores || []).length && !!p.fecha && !!p.hora && momentoDe(p) > Date.now() + 5 * 60e3;
      function pintarCola() {
        const ahora = Date.now(), hoy = hoyYmd(), en7 = sumaDias(hoy, 7);
        const req = requiereAccion(E.piezas, ahora);
        const borradores = E.piezas.filter(p => (p.estado === 'borrador' || p.estado === 'idea') && p.fecha && p.fecha >= hoy && p.fecha <= en7).sort((a, b) => momentoDe(a) - momentoDe(b));
        const listos = borradores.filter(puedeAprobar);
        const cola = colaPorDia(E.piezas.filter(p => p.estado === 'aprobada' || p.estado === 'revision'), ahora, 14).filter(([, l]) => l.length);
        const fila = (p, motivoTxt = '') => {
          const sal = textoSalida(p, ahora);
          const botones = (sal?.acciones || []).map(a => `<button type="button" class="mv-btn ${a === 'quitar' ? '' : 'primario'}" data-sal="${a}" data-id="${esc(p.id)}">${{ entregar: 'Entregar ya', quitar: 'Quitar de la cola', reintentar: 'Reintentar' }[a]}</button>`).join('');
          const aprobar = p.estado === 'revision' ? `<button type="button" class="mv-btn primario" data-aprobar="${esc(p.id)}"${puedeAprobar(p) ? '' : ' aria-disabled="true"'}>Aprobar</button>` : '';
          return `${tarjeta(p, { hora: true })}${motivoTxt || sal ? `<li class="md-sal"><p class="${sal?.malo || motivoTxt && !sal ? 'rojo' : ''}">${esc(sal ? sal.texto : motivoTxt)}</p>${sal?.enlaces?.length ? sal.enlaces.map(e => `<a class="mv-link" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Ver en ${esc(e.red)}</a>`).join('') : ''}${botones || aprobar ? `<div class="md-sal-b">${botones}${aprobar}</div>` : ''}</li>` : ''}`;
        };
        let h = `<div class="md-cabsel"><button type="button" class="mv-btn" data-seleccionar>${E.seleccionando ? 'Cancelar selección' : 'Seleccionar varias'}</button></div>`;
        if (req.length) h += `<h3 class="mv-gh rojo">Necesita tu atención <span>${req.length}</span></h3><ul class="md-lista">${req.map(x => fila(x.pieza, x.motivo)).join('')}</ul>`;
        if (borradores.length) h += `<h3 class="mv-gh">Borradores de la semana <span>${borradores.length}</span></h3>
          ${listos.length > 1 ? `<button type="button" class="mv-btn primario md-ancho" data-aprobar-todos>Aprobar los ${listos.length} que pueden salir</button>` : ''}
          <ul class="md-lista">${borradores.map(p => `${tarjeta(p)}<li class="md-sal"><p>${puedeAprobar(p) ? 'Lista para tu visto bueno.' : esc((p.revision?.errores || [])[0] || (!p.hora ? 'Ponle una hora para poder aprobarla.' : 'Su hora está muy cerca o ya pasó.'))}</p><div class="md-sal-b"><button type="button" class="mv-btn primario" data-aprobar="${esc(p.id)}"${puedeAprobar(p) ? '' : ' aria-disabled="true"'}>Aprobar</button></div></li>`).join('')}</ul>`;
        const idsReq = new Set(req.map(x => x.pieza.id));
        h += cola.length ? cola.map(([f, l]) => `<section class="mv-dia"><h3>${esc(diaTexto(f))}<small>${esc(diaLargo(f))}</small></h3><ul class="md-lista">${l.filter(p => !idsReq.has(p.id)).map(p => fila(p)).join('') || '<li><p class="mv-nada">Lo de este día está arriba, en «Necesita tu atención».</p></li>'}</ul></section>`).join('') : (req.length || borradores.length ? '' : vacio('La cola está vacía', 'Cuando apruebes una pieza, aquí verás cuándo sale y si salió.', { icono: 'reloj' }));
        return h;
      }
      function barra() {
        const n = E.sel.size; barraSel.hidden = !(E.seleccionando && E.tab === 'cola'); fab.hidden = E.seleccionando && E.tab === 'cola';
        if (barraSel.hidden) return;
        barraSel.innerHTML = `<span class="md-sel-n">${n} ${n === 1 ? 'elegida' : 'elegidas'}</span><button type="button" class="mv-btn primario" data-lote="aprobar"${n ? '' : ' aria-disabled="true"'}>Aprobar</button><button type="button" class="mv-btn" data-lote="revision"${n ? '' : ' aria-disabled="true"'}>A revisión</button><button type="button" class="mv-btn" data-lote="mover"${n ? '' : ' aria-disabled="true"'}>Mover</button><button type="button" class="mv-btn peligro" data-lote="papelera"${n ? '' : ' aria-disabled="true"'}>Papelera</button>`;
      }

      // ---------------------------------------------------------------- PERFIL (3:4)
      function pintarPerfil() {
        const hoy = hoyYmd(), ig = E.piezas.filter(p => (p.redes || []).includes('instagram') && p.fecha && (p.medios || []).length);
        const prog = ig.filter(p => p.fecha >= hoy && p.estado !== 'idea').sort((a, b) => (momentoDe(b) || 0) - (momentoDe(a) || 0));
        const pub = ig.filter(p => p.fecha < hoy).sort((a, b) => (momentoDe(b) || 0) - (momentoDe(a) || 0));
        const sueltas = (E.publicadas || []).filter(x => x.red === 'instagram');
        const celda = (p, programada) => `<button type="button" class="md-cel${programada ? ' prog' : ''}" data-pz="${esc(p.id)}" aria-label="${esc(titulo(p))}, ${esc(programada ? 'programada para ' + diaTexto(p.fecha) : 'del ' + diaTexto(p.fecha))}">${miniatura(p.medios[0], { clase: 'md-cel-i' })}${programada ? `<i class="md-cel-p">${esc(diaTexto(p.fecha))}</i>` : ''}${p.medios.length > 1 ? '<i class="md-cel-t" aria-hidden="true">❐</i>' : ''}</button>`;
        const celdaFuera = x => `<a class="md-cel" href="${esc(x.enlace || '#')}" target="_blank" rel="noopener noreferrer" aria-label="Publicada fuera de la oficina">${miniatura(x.miniatura, { clase: 'md-cel-i' })}<i class="md-cel-t" aria-hidden="true">↗</i></a>`;
        if (!prog.length && !pub.length && !sueltas.length) return vacio('Tu cuadrícula está vacía', 'Aquí verás cómo se verá tu Instagram: lo programado encima de lo ya publicado. Crea una pieza con imagen o video.', { icono: 'contenido', boton: 'Crear publicación', accion: 'data-nueva-dia=""' });
        return `<p class="mv-intro">Así se ve tu Instagram. Lo programado va marcado con su día; toca una pieza para verla o cambiarla.</p>
          <div class="md-grid">${prog.map(p => celda(p, true)).join('')}${pub.map(p => celda(p, false)).join('')}${sueltas.slice(0, 18).map(celdaFuera).join('')}</div>`;
      }

      // ---------------------------------------------------------------- la hoja de una pieza
      function abrirPieza(p) {
        const sal = textoSalida(p), errores = p.revision?.errores || [], avisos = p.revision?.avisos || [];
        const medios = (p.medios || []).slice(0, 6).map(m => miniatura(m, { clase: 'md-mini grande' })).join('');
        const h = ctx.hoja({
          titulo: titulo(p), lleno: true, clase: 'md-hoja-pz',
          cuerpo: `<div class="md-pz-det">
            <p class="md-pz-quien">${redes(p.redes, 20)} <span>${esc(formatosTxt(p))}</span> ${chipEstado(p)}</p>
            <p class="mv-meta">${esc(resumenSalida(p))}</p>
            ${medios ? `<div class="md-tira">${medios}</div>` : ''}
            ${p.texto ? `<p class="mv-texto">${esc(String(p.texto).slice(0, 1500))}</p>` : '<p class="mv-nada">Sin texto todavía.</p>'}
            ${sal ? `<p class="md-aviso${sal.malo ? ' rojo' : ''}">${esc(sal.texto)}</p>` : ''}
            ${errores.length ? `<h4 class="md-h4 rojo">Antes de aprobar</h4><ul class="md-prob">${errores.map(t => `<li class="mal">${esc(t)}</li>`).join('')}</ul>` : ''}
            ${avisos.length ? `<h4 class="md-h4">Conviene saber</h4><ul class="md-prob">${avisos.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
            <div class="md-acciones">
              <button type="button" class="mv-btn primario" data-a="editar">Editar</button>
              ${['revision', 'borrador', 'idea'].includes(p.estado) ? `<button type="button" class="mv-btn ${errores.length ? '' : 'primario'}" data-a="aprobar"${errores.length ? ' aria-disabled="true"' : ''}>Aprobar</button>` : ''}
              ${p.estado === 'borrador' || p.estado === 'idea' ? '<button type="button" class="mv-btn" data-a="revision">Pedir mi revisión</button>' : ''}
              ${p.estado === 'aprobada' || p.estado === 'revision' ? '<button type="button" class="mv-btn" data-a="devolver">Devolver a borrador</button>' : ''}
              ${(sal?.acciones || []).map(a => `<button type="button" class="mv-btn" data-sal="${a}" data-id="${esc(p.id)}">${{ entregar: 'Entregar ya', quitar: 'Quitar de la cola', reintentar: 'Reintentar' }[a]}</button>`).join('')}
              <button type="button" class="mv-btn peligro" data-a="papelera">A la papelera</button>
            </div></div>`,
        });
        h.cuerpo.addEventListener('click', async e => {
          const b = e.target.closest('button'); if (!b || b.getAttribute('aria-disabled') === 'true' && b.dataset.a === 'aprobar') { if (b?.dataset.a === 'aprobar') ctx.toast(errores[0] || 'Todavía no se puede aprobar.'); return; }
          if (b.dataset.sal) { const r = await con(b, () => accionSalida(b.dataset.sal, b.dataset.id), { hecho: 'Hecho' }); if (r.ok) { h.cerrar(); await cargar({ silencioso: true }); } return; }
          const a = b.dataset.a; if (!a) return;
          if (a === 'editar') { h.cerrar(); setTimeout(() => ctx.navegar('crear', { id: p.id }), 200); return; }
          if (a === 'aprobar') { const r = await aprobarPieza(ctx, p); if (r.ok) { h.cerrar(); ctx.toast('Aprobada. ' + resumenSalida(r.pieza || p)); await cargar({ silencioso: true }); } else if (r.error) ctx.toast(r.error); return; }
          if (a === 'revision') { const r = await con(b, () => ctx.api(`/api/contenido/piezas/${p.id}`, { method: 'PATCH', body: { estado: 'revision' } }), { hecho: 'En revisión' }); if (r.ok) { h.cerrar(); await cargar({ silencioso: true }); } return; }
          if (a === 'devolver') { const r = await con(b, () => ctx.api(`/api/contenido/piezas/${p.id}/devolver`, { method: 'POST', body: {} }), { hecho: 'Devuelta' }); if (r.ok) { h.cerrar(); await cargar({ silencioso: true }); } return; }
          if (a === 'papelera') { if (!(await ctx.confirmar({ titulo: '¿Mandar a la papelera?', texto: titulo(p) + '\nNo sale en ninguna red.', ok: 'A la papelera', peligro: true }))) return; try { await ctx.api(`/api/contenido/piezas/${p.id}`, { method: 'DELETE', body: {} }); h.cerrar(); ctx.toast('Mandada a la papelera.'); await cargar({ silencioso: true }); } catch (err) { ctx.toast(motivo(err)); } }
        });
        return h;
      }
      const accionSalida = (a, id) => ctx.api(`/api/contenido/piezas/${encodeURIComponent(id)}/${a === 'entregar' ? 'entregar' : a === 'quitar' ? 'quitar' : 'reintentar'}`, { method: 'POST', body: {} });

      // ---------------------------------------------------------------- lote (selección múltiple)
      async function lote(tipo, b) {
        const ids = [...E.sel], ps = ids.map(porId).filter(Boolean);
        if (!ps.length) return;
        if (tipo === 'aprobar') {
          const ok = ps.filter(puedeAprobar); if (!ok.length) { ctx.toast('Ninguna de las elegidas se puede aprobar todavía: míralas una por una.'); return; }
          if (!(await ctx.confirmar({ titulo: `¿Aprobar ${ok.length} ${ok.length === 1 ? 'pieza' : 'piezas'}?`, texto: ok.slice(0, 5).map(p => `• ${titulo(p)} — ${resumenSalida(p)}`).join('\n') + (ok.length > 5 ? `\ny ${ok.length - 5} más` : '') + (ok.length < ps.length ? `\n${ps.length - ok.length} no se aprueban: tienen problemas.` : ''), ok: 'Aprobar' }))) return;
          const r = await con(b, async () => { let n = 0; for (const p of ok) { await ctx.api(`/api/contenido/piezas/${p.id}/aprobar`, { method: 'POST', body: {} }); n++; } return n; }, { hecho: 'Aprobadas' });
          if (r.ok) ctx.toast(`${r.valor} aprobadas.`);
        } else if (tipo === 'revision') {
          await con(b, async () => { for (const p of ps) await ctx.api(`/api/contenido/piezas/${p.id}`, { method: 'PATCH', body: { estado: 'revision' } }); }, { hecho: 'En revisión' });
        } else if (tipo === 'mover') {
          const h = ctx.hoja({ titulo: `Mover ${ps.length} ${ps.length === 1 ? 'pieza' : 'piezas'} de día`, cuerpo: `<label class="mv-lab" for="mdMov">Nuevo día</label><input id="mdMov" type="date" class="mv-campo" value="${hoyYmd()}" min="${hoyYmd()}"><p class="mv-meta">Una pieza aprobada pierde el OK al moverla: la vuelves a aprobar.</p>`, acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: 'Mover', tipo: 'primario', alTocar: async (x, bt) => { const f = x.cuerpo.querySelector('#mdMov').value; if (!f) return; const r = await con(bt, async () => { for (const p of ps) await ctx.api(`/api/contenido/piezas/${p.id}`, { method: 'PATCH', body: { fecha: f } }); }, { hecho: 'Movidas' }); if (r.ok) { x.cerrar(); E.sel.clear(); E.seleccionando = false; await cargar({ silencioso: true }); } } }] });
          return h;
        } else if (tipo === 'papelera') {
          if (!(await ctx.confirmar({ titulo: `¿Mandar ${ps.length} a la papelera?`, texto: 'No saldrán en ninguna red.', ok: 'A la papelera', peligro: true }))) return;
          await con(b, async () => { for (const p of ps) await ctx.api(`/api/contenido/piezas/${p.id}`, { method: 'DELETE', body: {} }); }, { hecho: 'Hecho' });
        }
        E.sel.clear(); E.seleccionando = false; await cargar({ silencioso: true });
      }

      // ---------------------------------------------------------------- pintar
      function pintar() {
        el.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === E.tab; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
        if (E.tab === 'bandeja') { sc.hidden = true; panelBandeja.el.hidden = false; barra(); return; }
        sc.hidden = false; if (panelBandeja) panelBandeja.el.hidden = true;
        if (!E.cargado) { cuerpo.innerHTML = E.error ? falla(E.error) : esqueleto(4); barra(); return; }
        cuerpo.innerHTML = E.tab === 'cola' ? pintarCola() : E.tab === 'perfil' ? pintarPerfil() : pintarAgenda();
        barra();
      }

      cuerpo.addEventListener('click', async e => {
        const t = e.target.closest('button, a'); if (!t) return;
        if (t.matches('[data-reintentar]')) return cargar();
        if (t.dataset.tabIr) { E.tab = t.dataset.tabIr; return pintar(); }
        if (t.dataset.modo) { E.modo = t.dataset.modo; return pintar(); }
        if (t.dataset.mes) { const d = new Date(E.ancla); d.setMonth(d.getMonth() + +t.dataset.mes, 1); E.ancla = d.getTime(); E.diaSel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; return pintar(); }
        if (t.dataset.sem) { E.diaSel = sumaDias(E.diaSel, 7 * +t.dataset.sem); return pintar(); }
        if (t.dataset.dia) { E.diaSel = t.dataset.dia; return pintar(); }
        if (t.hasAttribute('data-nueva-dia')) return ctx.navegar('crear', { fecha: t.dataset.nuevaDia || '' });
        if (t.hasAttribute('data-seleccionar')) { E.seleccionando = !E.seleccionando; E.sel.clear(); return pintar(); }
        if (t.dataset.sal) { const r = await con(t, () => (t.dataset.sal === 'quitar' ? ctx.confirmar({ titulo: '¿Quitarla de la cola?', texto: 'No saldrá en las redes. La pieza se queda como la dejaste.', ok: 'Quitar de la cola' }).then(si => { if (!si) throw new Error('Cancelado'); return accionSalida('quitar', t.dataset.id); }) : accionSalida(t.dataset.sal, t.dataset.id)), { hecho: 'Hecho' }); if (r.ok) await cargar({ silencioso: true }); return; }
        if (t.dataset.aprobar) { if (t.getAttribute('aria-disabled') === 'true') { const p = porId(t.dataset.aprobar); ctx.toast((p?.revision?.errores || [])[0] || (!p?.hora ? 'Ponle una hora para poder aprobarla.' : 'Su hora está muy cerca o ya pasó.')); return; } const p = porId(t.dataset.aprobar); const r = await aprobarPieza(ctx, p); if (r.ok) { ctx.toast('Aprobada. ' + resumenSalida(r.pieza || p)); await cargar({ silencioso: true }); } else if (r.error) ctx.toast(r.error); return; }
        if (t.hasAttribute('data-aprobar-todos')) { E.sel = new Set(E.piezas.filter(p => (p.estado === 'borrador' || p.estado === 'idea') && p.fecha >= hoyYmd() && p.fecha <= sumaDias(hoyYmd(), 7) && puedeAprobar(p)).map(p => p.id)); return lote('aprobar', t); }
        const pz = t.closest('[data-pz]'); if (pz) {
          const p = porId(pz.dataset.pz); if (!p) return;
          if (E.seleccionando) { E.sel.has(p.id) ? E.sel.delete(p.id) : E.sel.add(p.id); return pintar(); }
          return abrirPieza(p);
        }
      });
      barraSel.addEventListener('click', e => { const b = e.target.closest('[data-lote]'); if (!b) return; if (b.getAttribute('aria-disabled') === 'true') return ctx.toast('Elige al menos una pieza.'); lote(b.dataset.lote, b); });
      el.querySelector('.md-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; E.tab = b.dataset.tab; if (E.tab !== 'cola') { E.seleccionando = false; E.sel.clear(); } if (E.tab === 'bandeja') panelBandeja.mostrar(); if (E.tab === 'perfil') traerPublicadas(); sc.scrollTop = 0; pintar(); });
      fab.addEventListener('click', () => ctx.navegar('crear', { fecha: E.tab === 'agenda' && E.modo !== 'lista' ? E.diaSel : '' }));
      ctx.tirar(sc, () => cargar({ silencioso: true }));

      async function traerPublicadas() {
        try { const d = hoyYmd(); const r = await ctx.api(`/api/contenido/publicadas?desde=${sumaDias(d, -90)}&hasta=${d}`); E.publicadas = r.sueltas || []; if (E.tab === 'perfil') pintar(); } catch { /* sin Analíticas: la cuadrícula se arma con las piezas */ }
      }

      panelBandeja = montarBandeja(el.querySelector('[data-sc]').parentElement, ctx, { alContar: n => { E.pendBandeja = n; const b = el.querySelector('[data-n="bandeja"]'); b.textContent = n; b.hidden = !n; } });
      el.insertBefore(panelBandeja.el, el.querySelector('.mv-fab')); panelBandeja.el.hidden = true;

      el._cargar = cargar; el._estado = E; el._irA = (tab) => { E.tab = tab; if (tab === 'bandeja') panelBandeja.mostrar(); pintar(); };
      cargar(); panelBandeja.precargar();
    },
    alMostrar(el, ctx, p) {
      ctx.cabecera({ titulo: 'Contenido', acciones: [] });
      if (p?.tab) el._irA?.(p.tab);
      el._cargar?.({ silencioso: true });
    },
  });
}
