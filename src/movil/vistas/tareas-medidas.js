// Versión móvil (25 oct 2026) — MEDIDAS: cómo va el trabajo (tareas/resumen.mjs, de la bitácora). Dos cifras por fila de pantalla; cada
// cifra es un botón que abre las tareas que la forman. Lo que no se sabe dice «sin datos»: nunca un cero inventado. Las tablas de
// escritorio pasan a listas de «nombre … valor» que no necesitan desplazarse de lado.
import { esc, vacio, falla, esqueleto } from '../ui.js';
import { idsDeCifra } from '../tareas-puro.js';
import { filaMini } from './tareas-comun.js';

const minutosTexto = m => (m == null ? '—' : m < 60 ? `${m} min` : m < 60 * 24 ? `${Math.round(m / 6) / 10} h`.replace('.', ',') : `${Math.round(m / 144) / 10} días`.replace('.', ','));
const NOMBRE_ESTADO = { idea: 'Como idea', next: 'En cola', scheduled: 'Programada', doing: 'En curso', waiting: 'Esperando tu OK' };

export function cifrasDe(r, dias) {
  const v = (x, u = '') => (x?.valor == null ? 'sin datos' : `${x.valor}${u}`);
  return [
    ['hechas', 'Hechas', v(r.hechas), `en ${dias} días`, ''],
    ['aTiempo', 'A tiempo', r.aTiempo.de ? `${r.aTiempo.valor}/${r.aTiempo.de}` : 'sin datos', 'de las que tenían límite', r.tarde.valor ? '' : 'bien'],
    ['tarde', 'Tarde', v(r.tarde), 'terminadas pasado su límite', r.tarde.valor ? 'mal' : ''],
    ['cicloMin', 'De pedido a hecha', r.cicloMin.valor == null ? 'sin datos' : minutosTexto(r.cicloMin.valor), `mediana de ${r.cicloMin.n || 0}`, ''],
    ['esperaOkMin', 'Espera de tu OK', r.esperaOkMin.valor == null ? 'sin datos' : minutosTexto(r.esperaOkMin.valor), `mediana de ${r.esperaOkMin.n || 0}`, ''],
    ['esperanOk', 'Esperan tu OK', v(r.esperanOk), 'borradores listos', r.esperanOk.valor ? 'aviso' : ''],
    ['bloqueadas', 'Bloqueadas', v(r.bloqueadas), 'esperan otra tarea', r.bloqueadas.valor ? 'aviso' : ''],
    ['vencidas', 'Vencidas', v(r.vencidas), 'abiertas pasado su límite', r.vencidas.valor ? 'mal' : 'bien'],
    ['fallidas', 'Fallaron', v(r.fallidas), `en ${dias} días`, r.fallidas.valor ? 'mal' : ''],
    ['devueltas', 'Devueltas', v(r.devueltas), `${r.devueltas.veces || 0} veces en total`, ''],
  ];
}

export function montarMedidas(cont, ctx, { abrir }) {
  let dias = 30, r = null, error = '';
  async function pintar(fresco = false) {
    if (!r || fresco) { cont.innerHTML = esqueleto(4); try { r = await ctx.api(`/api/tareas/resumen?dias=${dias}`); error = ''; } catch (e) { error = e.message; } }
    if (error) { cont.innerHTML = falla(error); return; }
    const ags = await ctx.store.agentes().catch(() => []);
    const en = Object.entries(r.tiempoEnEstado || {}).filter(([k]) => NOMBRE_ESTADO[k]);
    const fila = (a, b, c = '') => `<li><span>${a}</span><b>${b}</b>${c ? `<small>${c}</small>` : ''}</li>`;
    cont.innerHTML = `<div class="mv-seg mv-seg-in" role="group" aria-label="Periodo">${[7, 30, 90].map(n => `<button type="button" data-dias="${n}" aria-pressed="${n === dias}">${n} días</button>`).join('')}</div>
      <p class="mv-meta mv-px">Toca una cifra para ver sus tareas.</p>
      <div class="mv-kpis">${cifrasDe(r, dias).map(([k, t, valor, pie, tono]) => `<button type="button" class="mv-kpi ${tono}" data-kpi="${k}"${idsDeCifra(r, k).length ? '' : ' disabled'}><small>${esc(t)}</small><b>${esc(valor)}</b><span>${esc(pie)}</span></button>`).join('')}</div>
      ${en.length ? `<section class="mv-sec"><h3>Cuánto pasa en cada estado <small>mediana</small></h3><ul class="mv-dl">${en.map(([k, x]) => fila(esc(NOMBRE_ESTADO[k]), esc(minutosTexto(x.mediana)), `${x.n} veces`)).join('')}</ul></section>` : '<p class="mv-meta">El tiempo en cada estado sale de la bitácora: aparecerá con las próximas tareas.</p>'}
      ${r.carga?.length ? `<section class="mv-sec"><h3>Carga ahora <small>tareas abiertas</small></h3><ul class="mv-dl">${r.carga.slice(0, 10).map(c => fila(`${c.persona ? '👤 ' : ''}${esc(c.quien)}`, String(c.abiertas))).join('')}</ul></section>` : ''}
      ${r.porDept?.length ? `<section class="mv-sec"><h3>Por departamento <small>${dias} días</small></h3><ul class="mv-dl">${r.porDept.map(d => fila(esc(d.nombre), `${d.hechas} hechas`, `${d.fallidas ? d.fallidas + ' fallaron · ' : ''}US$ ${String(d.costo).replace('.', ',')}`)).join('')}</ul></section>` : ''}`;
    cont._ags = ags;
  }
  cont.addEventListener('click', e => {
    if (e.target.closest('[data-reintentar]')) return pintar(true);
    const d = e.target.closest('[data-dias]'); if (d) { dias = +d.dataset.dias; r = null; return pintar(true); }
    const k = e.target.closest('[data-kpi]'); if (!k || k.disabled) return;
    const ids = idsDeCifra(r, k.dataset.kpi), porId = new Map(ctx.store.st.tareas.map(t => [t.id, t])), ts = ids.map(i => porId.get(i)).filter(Boolean);
    const h = ctx.hoja({ titulo: k.querySelector('small').textContent, lleno: true, cuerpo: ts.length ? `<ul class="mv-lista">${ts.map(t => filaMini(t, { porId, ags: cont._ags })).join('')}</ul>${ts.length < ids.length ? `<p class="mv-meta">${ids.length - ts.length} más ya están archivadas.</p>` : ''}` : vacio('Ninguna a la vista', 'Esas tareas ya están archivadas.', { icono: 'tareas' }) });
    h.cuerpo.addEventListener('click', ev => { const a = ev.target.closest('[data-abrir]'); if (a) { h.cerrar(); setTimeout(() => abrir(a.dataset.abrir), 280); } });
  });
  return { pintar };
}
