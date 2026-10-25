// Versión móvil (25 oct 2026) — APROBACIONES: lo que espera el visto bueno del dueño, una tarjeta por borrador. Cada una dice «Lo que saldrá»
// (canal, a quién, asunto, importes, adjuntos), cuán arriesgado es, y deja leer el borrador entero. Aprobar y Devolver piden confirmación
// en una hoja inferior (nunca un diálogo del navegador); aprobar se puede deshacer unos segundos. Es accesible desde la cabecera
// (⚠ N) en cualquier pantalla. Las reglas de seguridad son las del servidor: aquí solo se decide y se ve.
import { esc, svg, vacio, esqueleto, falla, hace } from '../ui.js';
import { esperanOk } from '../datos.js';

const RIESGO = { alto: ['Riesgo alto', 'alto'], medio: ['Riesgo medio', 'medio'], bajo: ['Riesgo bajo', 'bajo'] };
const dato = (k, v) => (v ? `<div class="mv-dato"><dt>${k}</dt><dd>${v}</dd></div>` : '');

export function registrar(shell) {
  shell.registrarVista({
    id: 'aprobaciones', titulo: 'Esperan tu OK', icono: 'alerta', grupo: 'oculta',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo" aria-live="polite"></div></div>';
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll'), st = ctx.store.st;
      let foco = null;
      function tarjeta(t) {
        const p = t.preview || {}, r = RIESGO[t.risk] || RIESGO.bajo, borrador = String(t.editedDraft || t.draft || t.result || '').trim();
        const montos = (p.amounts || []).map(n => '$' + n).join(', ');
        return `<article class="mv-aprob${t.id === foco ? ' foco' : ''}" data-id="${esc(t.id)}" tabindex="-1" aria-label="${esc(t.title)}">
          <header><span class="mv-riesgo ${r[1]}">${r[0]}</span><span class="mv-hace">${t.waitingAt ? hace(t.waitingAt) : ''}</span></header>
          <h3>${esc(t.title)}</h3><p class="mv-meta">${esc([t.agent, t.dept].filter(Boolean).join(' · '))}${t.routine ? ' · rutina' : ''}</p>
          <section aria-label="Lo que saldrá"><h4>Lo que saldrá</h4><dl class="mv-datos">
            ${dato('Canal', esc(p.channel || ''))}${dato('Para', esc([...(p.to || []), ...(p.phones || [])].join(', ')))}${dato('Asunto', esc(p.subject || ''))}${dato('Importes', esc(montos))}${dato('Adjuntos', esc((p.attachments || []).join(', ')))}
            ${!p.channel && !(p.to || []).length && !p.subject ? '<div class="mv-dato"><dd>Nada sale a otras personas: es un resultado para ti.</dd></div>' : ''}</dl></section>
          ${borrador ? `<details class="mv-borrador"><summary>Leer el borrador</summary><pre>${esc(borrador.slice(0, 6000))}</pre></details>` : ''}
          <footer><button type="button" class="mv-btn" data-devolver>Devolver</button><button type="button" class="mv-btn primario" data-aprobar>Aprobar</button></footer></article>`;
      }
      function pintar() {
        if (!st.cargado) { cuerpo.innerHTML = st.error ? falla(st.error) : esqueleto(3); return; }
        const l = esperanOk(st.tareas).sort((a, b) => (a.waitingAt || 0) - (b.waitingAt || 0));
        cuerpo.innerHTML = l.length ? `<p class="mv-intro">${l.length === 1 ? 'Una cosa espera' : l.length + ' cosas esperan'} tu visto bueno. Nada sale hasta que lo apruebes.</p>${l.map(tarjeta).join('')}` : vacio('Todo al día', 'No hay nada esperando tu visto bueno.', { icono: 'check', boton: 'Volver a Inicio', accion: 'data-inicio' });
        if (foco) { const n = cuerpo.querySelector(`[data-id="${CSS.escape(foco)}"]`); if (n) { n.scrollIntoView({ block: 'start' }); foco = null; } }
      }
      async function decidir(id, que, feedback) {
        const t = st.tareas.find(x => x.id === id); if (!t) return;
        try {
          await ctx.api(`/api/tasks/${id}/${que}`, { method: 'POST', body: que === 'reject' ? { feedback } : {} });
          if (que === 'approve') ctx.toast('Aprobada. Sale en unos segundos.', { accion: 'Deshacer', alAccion: async () => { try { await ctx.api(`/api/tasks/${id}/undo`, { method: 'POST', body: {} }); ctx.toast('Deshecho: no sale.'); } catch (e) { ctx.toast('Ya no se puede deshacer: ' + e.message); } ctx.store.refrescar(); }, ms: 9000 });
          else ctx.toast('Devuelta con tus comentarios.');
        } catch (e) { ctx.toast('No se pudo: ' + e.message); }
        await ctx.store.refrescar();
        if (!esperanOk(st.tareas).length && !el.hidden) ctx.volver?.();
      }
      cuerpo.addEventListener('click', async e => {
        if (e.target.closest('[data-inicio]')) return ctx.navegar('inicio');
        if (e.target.closest('[data-reintentar]')) return ctx.store.refrescar();
        const a = e.target.closest('.mv-aprob'); if (!a) return; const id = a.dataset.id, t = st.tareas.find(x => x.id === id); if (!t) return;
        if (e.target.closest('[data-aprobar]')) {
          const r = RIESGO[t.risk] || RIESGO.bajo, p = t.preview || {}, a2 = [...(p.to || []), ...(p.phones || [])];
          const ok = await ctx.confirmar({ titulo: '¿Aprobar y enviar?', texto: `${t.title}${a2.length ? `\nPara: ${a2.slice(0, 4).join(', ')}${a2.length > 4 ? ` y ${a2.length - 4} más` : ''}` : ''}${(p.amounts || []).length ? `\nImportes: ${p.amounts.map(n => '$' + n).join(', ')}` : ''}\n${r[0]}.`, ok: 'Aprobar', peligro: t.risk === 'alto' });
          if (ok) decidir(id, 'approve');
        } else if (e.target.closest('[data-devolver]')) {
          const h = ctx.hoja({ titulo: 'Devolver con comentarios', cuerpo: '<label class="mv-lab" for="mvFb">¿Qué debe cambiar?</label><textarea id="mvFb" class="mv-campo" rows="4" placeholder="Más corto, sin el descuento…" autofocus></textarea>', acciones: [{ texto: 'Cancelar', alTocar: x => x.cerrar() }, { texto: 'Devolver', tipo: 'primario', alTocar: x => { const v = x.cuerpo.querySelector('#mvFb').value.trim(); if (!v) { x.cuerpo.querySelector('#mvFb').focus(); return; } x.cerrar(); decidir(id, 'reject', v); } }] });
        }
      });
      ctx.tirar(sc, () => ctx.store.refrescar());
      ctx.store.alCambiar(() => { if (!el.hidden) pintar(); });
      el._foco = id => { foco = id; };
      pintar();
    },
    alMostrar(el, ctx, p) { if (p?.id) el._foco?.(p.id); ctx.store.refrescar().then(() => el.querySelector('.mv-aprob.foco')); },
  });
}
