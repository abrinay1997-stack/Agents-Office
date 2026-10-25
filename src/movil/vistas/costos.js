// Versión móvil (25 oct 2026) — COSTOS Y RETORNO: el mes en una tarjeta con su presupuesto y su barra (verde, ámbar desde el 75 %, rojo desde el
// 90 %: color Y texto), lo que cuesta cada tarea, las horas ahorradas, las sugerencias que se aplican con un toque, y el gasto por departamento,
// agente y modelo como barras. Todo sale de GET /api/costs (+ /api/quality): aquí solo se dibuja. El CSV del mes es un enlace de descarga.
import { esc, svg, esqueleto, falla } from '../ui.js';
import { conEstado } from '../../accion.js';
import { usd, nivelPresupuesto } from '../ajustes-core.mjs';

const DEPT = { emails: 'Correos', sales: 'Ventas', marketing: 'Marketing', ops: 'Operaciones', fin: 'Finanzas', delivery: 'Entregas', oficina: 'La oficina (enrutar, Dimitri)' };
const mes = m => { const [y, mo] = String(m).split('-'); return new Date(+y, +mo - 1, 1).toLocaleDateString('es-PA', { month: 'long', year: 'numeric' }); };

function barras(filas) { // [{ n, usd, extra }] → barras horizontales, la más larga = la que más gastó
  const max = Math.max(...filas.map(f => f.usd), 0.0001);
  return `<ul class="mv-barras">${filas.map(f => `<li><div class="mv-barra-t"><span>${esc(f.n)}</span><b>${usd(f.usd)}</b></div><div class="mv-barra" aria-hidden="true"><i style="width:${Math.max(f.usd > 0 ? 3 : 0, f.usd / max * 100).toFixed(1)}%"></i></div><small>${esc(f.extra)}</small></li>`).join('')}</ul>`;
}
function semanas(ws) { // las últimas 8 semanas: columnas que ocupan todo el ancho, con la cifra de cada una debajo
  const max = Math.max(...ws.map(w => w.usd), 0.0001);
  return `<div class="mv-sem" role="img" aria-label="Costo por semana: ${ws.map(w => usd(w.usd)).join(', ')}">${ws.map(w => `<div><i style="height:${Math.max(w.usd > 0 ? 4 : 0, w.usd / max * 100).toFixed(0)}%"></i><b>${usd(w.usd).replace('US$', '')}</b><small>${new Date(w.start).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }).replace('.', '')}</small></div>`).join('')}</div>`;
}

export function registrar(shell) {
  shell.registrarVista({
    id: 'costos', titulo: 'Costos y retorno', icono: 'costos', grupo: 'mas', sec: 'negocio', texto: 'Gasto, horas ahorradas, sugerencias',
    montar(el, ctx) {
      el.innerHTML = '<div class="mv-scroll"><div class="mv-cuerpo" aria-live="polite"></div></div>';
      const cuerpo = el.querySelector('.mv-cuerpo'), sc = el.querySelector('.mv-scroll');
      let d = null, err = '';
      async function cargar() {
        try { const [c, q] = await Promise.all([ctx.api('/api/costs'), ctx.api('/api/quality').catch(() => null)]); d = c; d.quality = q; err = ''; } catch (e) { if (!d) err = e.message; }
        pintar();
      }
      function pintar() {
        if (!d) { cuerpo.innerHTML = err ? falla(err) : esqueleto(5); return; }
        const b = d.budget || {}, ratio = b.ratio ?? (b.budget ? b.spent / b.budget : 0), nivel = b.level === 'over' ? 'bad' : nivelPresupuesto(ratio), niveles = { ok: 'Dentro del presupuesto', warn: 'Cerca del tope', bad: b.level === 'over' ? 'Presupuesto superado' : 'Casi en el tope' };
        const agentes = d.byAgent.filter(x => x.key !== '—').slice(0, 8).map(x => ({ n: x.name, usd: x.usd, extra: `${x.tasks} ${x.tasks === 1 ? 'tarea' : 'tareas'}` })); // fuera de la plantilla: barras() escapa el nombre
        const q = d.quality, ag = q ? q.agents.filter(a => a.tasks).sort((a, c) => (a.score ?? 101) - (c.score ?? 101)).slice(0, 8) : [];
        cuerpo.innerHTML = `<p class="mv-intro">${esc(mes(d.month))}${d.subscription ? '. Tu Claude es de tarifa fija: estas cifras son <b>lo que costaría en la API</b>.' : ''}</p>
          <section class="mv-card mv-costo" aria-label="Este mes"><p class="mv-eti">Este mes</p><p class="mv-gran">${usd(d.usd)}</p><p class="mv-meta">${d.runs} ejecuciones${d.overhead ? ` · ${usd(d.overhead)} de la oficina` : ''}</p>
            ${b.budget ? `<div class="mv-medidor ${nivel}" role="meter" aria-valuemin="0" aria-valuemax="${b.budget}" aria-valuenow="${(+b.spent).toFixed(2)}" aria-label="Presupuesto del mes"><i style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></i></div><p class="mv-medidor-t ${nivel}"><b>${Math.round(ratio * 100)} % de ${usd(b.budget)}</b> · ${niveles[nivel]}</p>` : '<p class="mv-meta">Sin presupuesto del mes. Ponlo en Ajustes → Presupuesto.</p>'}</section>
          <div class="mv-dos-t"><div class="mv-card"><p class="mv-eti">Por tarea</p><p class="mv-med">${usd(d.perTask)}</p><p class="mv-meta">${d.tasksDone} terminadas</p></div><div class="mv-card"><p class="mv-eti">Horas ahorradas</p><p class="mv-med">${(+d.hours).toFixed(1)} h</p><p class="mv-meta">${d.hourlyRate ? `valen ${usd(d.value)}${d.usd ? ` · rinde ${d.value > d.usd ? Math.round(d.value / d.usd) + '×' : 'aún no compensa'}` : ''}` : 'Pon lo que cuesta una hora en Ajustes'}</p></div></div>
          ${d.suggestions && d.suggestions.length ? `<h3 class="mv-gh">Sugerencias <span>${d.suggestions.length}</span></h3><ul class="mv-sug">${d.suggestions.map((s, i) => `<li class="mv-card"><p>${esc(s.text)}</p>${s.action ? `<button type="button" class="mv-btn ac" data-aplicar="${i}">${s.kind === 'routine-unread' ? 'Pausarla' : 'Cambiar el modelo'}</button>` : ''}</li>`).join('')}</ul>` : ''}
          <h3 class="mv-gh">Últimas 8 semanas</h3><div class="mv-card">${semanas(d.weeks)}</div>
          <h3 class="mv-gh">Por departamento</h3>${d.byDept.length ? barras(d.byDept.map(x => ({ n: DEPT[x.key] || x.key, usd: x.usd, extra: `${x.tasks} ${x.tasks === 1 ? 'tarea' : 'tareas'}` }))) : '<p class="mv-meta">Aún nada este mes.</p>'}
          <h3 class="mv-gh">Por agente</h3>${agentes.length ? barras(agentes) : '<p class="mv-meta">Aún nada este mes.</p>'}
          <h3 class="mv-gh">Por modelo</h3>${d.byModel.length ? barras(d.byModel.map(x => ({ n: x.key || '—', usd: x.usd, extra: `${x.runs} ${x.runs === 1 ? 'ejecución' : 'ejecuciones'}` }))) : '<p class="mv-meta">Aún nada este mes.</p>'}
          ${q ? `<h3 class="mv-gh">Calidad (28 días)</h3>${q.drops?.length ? `<ul class="mv-sug">${q.drops.map(x => `<li class="mv-card alerta"><p>⚠ ${esc(x.name)} bajó de ${x.before} a ${x.after} desde que cambió su skill o su brief. Puedes volver a la versión anterior desde su ficha.</p></li>`).join('')}</ul>` : ''}
            ${ag.length ? `<ul class="mv-calidad">${ag.map(a => `<li><span><b>${esc(a.name)}</b><small>${a.tasks} tareas · ${a.firstTry == null ? '—' : a.firstTry + ' %'} a la primera · ${a.revisions} devueltas · 👍 ${a.up} / 👎 ${a.down}</small></span><em class="${a.score != null && a.before != null && a.score < a.before ? 'rojo' : ''}">${a.score ?? '—'}${a.before != null && a.score != null && a.score !== a.before ? (a.score > a.before ? ' ▲' : ' ▼') : ''}</em></li>`).join('')}</ul><p class="mv-meta">Puntaje de 0 a 100: usada tal cual vale 100; cada devolución resta 30 y un 👎 resta 50.</p>` : '<p class="mv-meta">Aún no hay tareas terminadas para medir.</p>'}` : ''}
          <a class="mv-btn mv-ancho" href="/api/costs.csv?month=${esc(d.month)}" download>Descargar el CSV del mes</a>
          <details class="mv-acord"><summary>Precios que usa la oficina (al ${esc(d.pricesAsOf)})</summary><ul class="mv-calidad">${(d.prices || []).map(p => `<li><span><b>${esc(p.name)}</b><small>${esc(p.provider)}</small></span><em>$${p.in} / $${p.out}</em></li>`).join('')}</ul><p class="mv-meta">Entrada / salida por millón de tokens.</p></details>`;
      }
      cuerpo.addEventListener('click', async e => {
        if (e.target.closest('[data-reintentar]')) { err = ''; pintar(); return cargar(); }
        const b = e.target.closest('[data-aplicar]'); if (!b || !d) return;
        const s = d.suggestions[+b.dataset.aplicar];
        const r = await conEstado(b, () => ctx.api('/api/costs/apply', { method: 'POST', body: { action: s.action } }), { ocupado: 'Aplicando…', hecho: 'Hecho', ms: 3000 });
        if (r.ok) setTimeout(cargar, 800);
      });
      ctx.tirar(sc, cargar); el._cargar = cargar; cuerpo.innerHTML = esqueleto(5);
    },
    alMostrar(el) { el._cargar(); },
  });
}
