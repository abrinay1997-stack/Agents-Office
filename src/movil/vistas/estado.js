// Versión móvil (25 oct 2026) — ESTADO DE LA OFICINA: un semáforo en palabras («Todo en orden» / «2 cosas necesitan atención») y debajo cada
// comprobación con su estado escrito (nunca solo color), lo que pasa y cómo arreglarlo, con el botón que lleva a donde se arregla. Los avisos
// de la oficina van al final, con «Marcar como leídos». Sale de GET /api/status (el mismo semáforo que el engranaje de escritorio).
import { esc, svg, esqueleto, falla, hace } from '../ui.js';
import { conEstado } from '../../accion.js';
import { nAtencion } from '../ajustes-core.mjs';

const ESTADO = { ok: ['Bien', '●'], info: ['Aviso', '●'], warn: ['Revisar', '▲'], bad: ['Falla', '■'] };
// qué toca hacer según la comprobación: a dónde lleva el botón
const IR = { conectores: ['Ver los conectores', 'conectores'], aprobaciones: ['Ver lo que espera tu OK', 'aprobaciones'], rutinas: ['Ver el calendario', 'calendario'], cola: ['Ver las tareas', 'tareas'], errores: ['Ver las tareas', 'tareas'], seguridad: ['Ver las tareas', 'tareas'] };
const codigo = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>');

export function registrar(shell) {
  shell.registrarVista({
    id: 'estado', titulo: 'Estado de la oficina', icono: 'estado', grupo: 'mas', sec: 'oficina', texto: 'Que todo funcione',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo" aria-live="polite"></div></div>';
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll');
      let d = null, err = '';
      async function cargar() {
        try { d = await ctx.api('/api/status'); err = ''; ctx.store.st.status = d; } catch (e) { if (!d) err = e.message; }
        pintar();
      }
      function pintar() {
        if (!d) { cuerpo.innerHTML = err ? falla(err) : esqueleto(6); return; }
        const n = nAtencion(d), tono = n ? (d.overall === 'bad' ? 'bad' : 'warn') : 'ok';
        cuerpo.innerHTML = `<section class="mv-semaforo ${tono}" aria-label="Estado general"><span class="mv-luz" aria-hidden="true">${tono === 'ok' ? '●' : tono === 'warn' ? '▲' : '■'}</span><div><b>${n ? `${n === 1 ? 'Una cosa necesita' : n + ' cosas necesitan'} atención` : 'Todo en orden'}</b><small>Actualizado ${esc(hace(d.at))}</small></div></section>
          <div class="mv-botones"><button type="button" class="mv-btn ac" data-probar>Probar las conexiones</button></div>
          <ul class="mv-checks-l">${d.checks.map(c => { const ir = IR[c.id], e = ESTADO[c.state] || ESTADO.info; return `<li class="mv-card chk ${c.state}"><p class="mv-chk-t"><span class="mv-luz ${c.state}" aria-hidden="true">${e[1]}</span><b>${esc(c.label)}</b><em class="${c.state}">${e[0]}</em></p><p class="mv-texto">${codigo(c.detail)}</p>${c.fix ? `<p class="mv-arreglo"><b>Cómo arreglarlo:</b> ${codigo(c.fix)}</p>` : ''}${ir && c.state !== 'ok' ? `<button type="button" class="mv-btn" data-ir="${ir[1]}">${ir[0]}</button>` : ''}</li>`; }).join('')}</ul>
          <h3 class="mv-gh">Avisos${d.unread ? `<span>${d.unread} sin leer</span>` : ''}</h3>
          ${d.notices && d.notices.length ? `<ul class="mv-mini">${d.notices.slice(0, 40).map(a => `<li class="${esc(a.level || '')}${a.read ? '' : ' nuevo'}">${codigo(a.text)} <time>${a.t ? esc(hace(a.t)) : ''}</time></li>`).join('')}</ul>` : '<p class="mv-meta">Sin avisos.</p>'}
          ${d.unread ? '<button type="button" class="mv-btn ac mv-ancho" data-leidos>Marcar como leídos</button>' : ''}`;
      }
      cuerpo.addEventListener('click', async e => {
        if (e.target.closest('[data-reintentar]')) { err = ''; pintar(); return cargar(); }
        const ir = e.target.closest('[data-ir]'); if (ir) return ctx.navegar(ir.dataset.ir);
        const p = e.target.closest('[data-probar]'), l = e.target.closest('[data-leidos]');
        if (p) { const r = await conEstado(p, async () => { await ctx.api('/api/mcp?refresh=1'); await new Promise(r => setTimeout(r, 1500)); d = await ctx.api('/api/status'); ctx.store.st.status = d; }, { ocupado: 'Probando…', hecho: 'Probadas ✓', ms: 2200 }); if (r.ok) setTimeout(pintar, 2300); return; }
        if (l) { const r = await conEstado(l, async () => { await ctx.api('/api/notices/read', { method: 'POST', body: {} }); }, { ocupado: 'Marcando…', hecho: 'Leídos ✓', ms: 1200 }); if (r.ok) setTimeout(cargar, 1400); }
      });
      ctx.tirar(sc, cargar); el._cargar = cargar; cuerpo.innerHTML = esqueleto(6);
    },
    alMostrar(el) { el._cargar(); },
  });
}
