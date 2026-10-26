// Versión móvil (25 oct 2026) — NEGOCIO: «Cómo va el negocio». Una tarjeta por indicador con su valor, su tendencia dibujada, si va bien o mal
// (con palabras y flecha, no solo color) y su meta con la barra de avance. Tocar uno abre una hoja para anotar un valor a mano (teclado
// numérico) o quitarlo. «+» crea un indicador propio o sugerido. Debajo, las cifras de la propia oficina de esta semana.
// Sale de GET /api/business; los valores entran por POST /api/business/value (o solos: webhook, rutina).
import { esc, svg, esqueleto, falla, vacio } from '../ui.js';
import { conEstado } from '../../accion.js';
import { fmtKpi, trazo, idDe } from '../ajustes-core.mjs';

const tendencia = k => {
  if (k.change === null || k.change === undefined) return '';
  const sube = k.change >= 0, pct = Math.abs(Math.round(k.change * 100));
  return `<span class="mv-tend ${k.good ? 'bien' : 'mal'}"><b aria-hidden="true">${sube ? '▲' : '▼'}</b> ${pct} % <small>${k.good ? 'va bien' : 'va mal'}</small></span>`;
};
const spark = s => { const d = trazo(s, 120, 32); return d ? `<svg class="mv-spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>` : ''; };

export function registrar(shell) {
  shell.registrarVista({
    id: 'negocio', titulo: 'Cómo va el negocio', icono: 'negocio', grupo: 'mas', sec: 'negocio', texto: 'Tus indicadores',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo" aria-live="polite"></div></div>';
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll');
      let d = null, err = '';
      async function cargar() { try { d = await ctx.api('/api/business'); err = ''; } catch (e) { if (!d) err = e.message; } pintar(); }
      function tarjeta(k) {
        const meta = k.goal ? `<div class="mv-medidor ok" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((k.goalPct || 0) * 100)}" aria-label="Avance hacia la meta de ${esc(k.name)}"><i style="width:${Math.min(100, (k.goalPct || 0) * 100).toFixed(0)}%"></i></div><p class="mv-meta">Meta ${esc(fmtKpi(k.goal, k.unit))} · ${Math.round((k.goalPct || 0) * 100)} %</p>` : '';
        return `<li><button type="button" class="mv-kpi mv-card" data-kpi="${esc(k.id)}"><span class="mv-kpi-n">${esc(k.name)}</span><span class="mv-kpi-v">${esc(fmtKpi(k.value, k.unit))}</span>${spark(k.series)}<span class="mv-kpi-p">${tendencia(k)}<small>${k.at ? new Date(k.at).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }) + (k.from ? ', ' + esc(k.from) : '') : 'sin datos todavía'}</small></span>${meta}<span class="mv-kpi-a">Anotar un valor ${svg('der', 'mv-der')}</span></button></li>`;
      }
      function pintar() {
        if (!d) { cuerpo.innerHTML = err ? falla(err) : esqueleto(4); return; }
        cuerpo.innerHTML = `${d.kpis.length ? `<ul class="mv-kpis">${d.kpis.map(tarjeta).join('')}</ul>` : vacio('Todavía no hay indicadores', 'Añade los que miras cada semana: ventas, facturas vencidas, clientes nuevos…', { icono: 'negocio' })}
          <button type="button" class="mv-btn primario mv-ancho" data-nuevo>+ Añadir un indicador</button>
          ${d.suggested && d.suggested.length ? `<p class="mv-meta">O empieza con uno sugerido:</p><div class="mv-chips-w">${d.suggested.map(s => `<button type="button" class="mv-chip" data-sug="${esc(s.id)}">+ ${esc(s.name)}</button>`).join('')}</div>` : ''}
          <h3 class="mv-gh">La oficina esta semana</h3><div class="mv-dos-t">${d.office.map(o => `<div class="mv-card"><p class="mv-eti">${esc(o.name)}</p><p class="mv-med">${o.value === null ? '—' : esc(fmtKpi(o.value, o.unit))}</p><p class="mv-meta">${esc(o.hint || '')}</p></div>`).join('')}</div>
          <details class="mv-acord"><summary>Cómo llegan los números solos</summary><ul><li><b>Una rutina:</b> «cada lunes a las 8, cuenta las ventas de Stripe y escribe <code>KPI ventas_semana = …</code>».</li><li><b>Un webhook</b> (Zapier, Make, n8n): <code>POST /api/kpi/ventas_semana</code> con <code>{"value": 1250}</code>. ${d.hookToken ? 'La clave AO_HOOK_TOKEN ya está.' : 'Falta la clave AO_HOOK_TOKEN.'}</li><li><b>A mano:</b> toca el indicador y anota el valor.</li></ul></details>`;
      }
      const post = (ruta, body) => ctx.api(ruta, { method: 'POST', body });
      function anotar(k) {
        const h = ctx.hoja({ titulo: k.name, clase: 'mv-anotar', cuerpo: `<p class="mv-kpi-v grande">${esc(fmtKpi(k.value, k.unit))}</p><label class="mv-lab" for="mvVal">Nuevo valor${k.unit ? ' (' + esc(k.unit) + ')' : ''}</label><input id="mvVal" class="mv-campo" inputmode="decimal" autocomplete="off" placeholder="1250" autofocus><p class="mv-aviso" id="mvValMsg" role="status" hidden></p>`,
          acciones: [{ texto: 'Anotar', tipo: 'primario', alTocar: async (hh, b) => { const v = hh.cuerpo.querySelector('#mvVal').value.replace(',', '.').trim(); if (!v || !Number.isFinite(+v)) { const m = hh.cuerpo.querySelector('#mvValMsg'); m.hidden = false; m.className = 'mv-aviso malo'; m.textContent = 'Escribe un número, por ejemplo 1250.'; return; }
            const r = await conEstado(b, () => post('/api/business/value', { id: k.id, value: v }), { ocupado: 'Anotando…', hecho: 'Anotado ✓', ms: 700 }); if (r.ok) { hh.cerrar(); ctx.toast('Anotado.'); cargar(); } else { const m = hh.cuerpo.querySelector('#mvValMsg'); m.hidden = false; m.className = 'mv-aviso malo'; m.textContent = r.error; } } },
            { texto: 'Quitar este indicador', tipo: 'peligro', alTocar: async (hh) => { if (!(await ctx.confirmar({ titulo: `¿Quitar «${k.name}»?`, texto: 'Sus valores guardados se conservan.', ok: 'Quitar', peligro: true }))) return; try { await post('/api/business/kpi', { remove: k.id }); hh.cerrar(); ctx.toast('Indicador quitado.'); cargar(); } catch (e) { ctx.toast('No se pudo: ' + e.message); } } }] });
      }
      function nuevo() {
        const h = ctx.hoja({ titulo: 'Nuevo indicador', lleno: true, cuerpo: `<div class="mv-cm"><label class="mv-lab" for="nbN">Nombre</label><input id="nbN" autocomplete="off" placeholder="Ventas de la semana"></div>
          <div class="mv-cm"><label class="mv-lab" for="nbI">Id (para los agentes y los webhooks)</label><input id="nbI" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ventas_semana"></div>
          <div class="mv-dos"><div class="mv-cm"><label class="mv-lab" for="nbU">Unidad</label><input id="nbU" autocomplete="off" placeholder="US$"></div><div class="mv-cm"><label class="mv-lab" for="nbG">Meta (opcional)</label><input id="nbG" inputmode="decimal" autocomplete="off"></div></div>
          <div class="mv-cm"><label class="mv-lab" for="nbB">Va mejor si…</label><select id="nbB"><option value="up">sube</option><option value="down">baja</option></select></div><p class="mv-aviso" id="nbMsg" role="status" hidden></p>`,
          acciones: [{ texto: 'Crear el indicador', tipo: 'primario', alTocar: async (hh, b) => { const q = s => hh.cuerpo.querySelector(s);
            const r = await conEstado(b, () => post('/api/business/kpi', { name: q('#nbN').value, id: q('#nbI').value, unit: q('#nbU').value, goal: q('#nbG').value, better: q('#nbB').value }), { ocupado: 'Creando…', hecho: 'Creado ✓', ms: 700 });
            if (r.ok) { hh.cerrar(); ctx.toast('Indicador creado.'); cargar(); } else { const m = q('#nbMsg'); m.hidden = false; m.className = 'mv-aviso malo'; m.textContent = r.error; } } }] });
        const n = h.cuerpo.querySelector('#nbN'), i = h.cuerpo.querySelector('#nbI'); n.addEventListener('input', () => { if (!i.dataset.tocado) i.value = idDe(n.value); }); i.addEventListener('input', () => { i.dataset.tocado = '1'; });
      }
      cuerpo.addEventListener('click', async e => {
        if (e.target.closest('[data-reintentar]')) { err = ''; pintar(); return cargar(); }
        if (e.target.closest('[data-nuevo]')) return nuevo();
        const k = e.target.closest('[data-kpi]'); if (k) { const x = d.kpis.find(q => q.id === k.dataset.kpi); if (x) anotar(x); return; }
        const s = e.target.closest('[data-sug]'); if (s) { const x = d.suggested.find(q => q.id === s.dataset.sug); const r = await conEstado(s, () => post('/api/business/kpi', x), { ocupado: 'Añadiendo…', hecho: 'Añadido ✓', ms: 700 }); if (r.ok) setTimeout(cargar, 800); else ctx.toast('No se pudo: ' + r.error); }
      });
      ctx.cabecera({ acciones: [{ icono: 'mas1', etiqueta: 'Añadir un indicador', alTocar: () => nuevo() }] });
      ctx.tirar(sc, cargar); el._cargar = cargar; cuerpo.innerHTML = esqueleto(4);
    },
    alMostrar(el) { el._cargar(); },
  });
}
