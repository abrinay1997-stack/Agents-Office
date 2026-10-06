// La vista Tareas — MEDIDAS: cómo va el trabajo, de la bitácora (tareas/resumen.mjs). Cada cifra es un botón: abre las tareas que la
// forman. Lo que no se sabe dice «sin datos» (el tiempo en cada estado existe desde que hay bitácora, 6 oct 2026); nunca un cero inventado.
import { esc, filaHTML, minutosTexto, vacioHTML } from './comun.js';

const NOMBRE_ESTADO = { idea: 'Como idea', next: 'En cola', scheduled: 'Programada', doing: 'En curso', waiting: 'Esperando tu OK' };

export function medidasHTML(r, ctx, { dias = 30, abierta = null, webhooks = null } = {}) {
  if (!r) return '<p class="tv-cargando">Calculando…</p>';
  const cifra = (k, titulo, valor, pie, tono = '') => `<button type="button" class="tv-kpi ${tono}${abierta === k ? ' on' : ''}" data-kpi="${k}" aria-pressed="${abierta === k}"${r[k]?.ids?.length ? '' : ' disabled'}><small>${esc(titulo)}</small><b>${esc(valor)}</b><span>${esc(pie)}</span></button>`;
  const v = (x, unidad = '') => (x?.valor == null ? 'sin datos' : `${x.valor}${unidad}`);
  const kpis = [
    cifra('hechas', 'Hechas', v(r.hechas), `en ${dias} días`),
    cifra('aTiempo', 'A tiempo', r.aTiempo.de ? `${r.aTiempo.valor}/${r.aTiempo.de}` : 'sin datos', 'de las que tenían fecha límite', r.tarde.valor ? '' : 'bien'),
    cifra('tarde', 'Tarde', v(r.tarde), 'terminadas después de su límite', r.tarde.valor ? 'mal' : ''),
    cifra('cicloMin', 'Tiempo de pedido a hecha', r.cicloMin.valor == null ? 'sin datos' : minutosTexto(r.cicloMin.valor), `mediana de ${r.cicloMin.n || 0}`),
    cifra('esperaOkMin', 'Cuánto espera tu OK', r.esperaOkMin.valor == null ? 'sin datos' : minutosTexto(r.esperaOkMin.valor), `mediana de ${r.esperaOkMin.n || 0}`),
    cifra('esperanOk', 'Esperan tu OK ahora', v(r.esperanOk), 'borradores listos', r.esperanOk.valor ? 'aviso' : ''),
    cifra('bloqueadas', 'Bloqueadas ahora', v(r.bloqueadas), 'esperan otra tarea o algo tuyo', r.bloqueadas.valor ? 'aviso' : ''),
    cifra('vencidas', 'Vencidas ahora', v(r.vencidas), 'abiertas con el límite pasado', r.vencidas.valor ? 'mal' : 'bien'),
    cifra('fallidas', 'Fallaron', v(r.fallidas), `en ${dias} días`, r.fallidas.valor ? 'mal' : ''),
    cifra('devueltas', 'Devueltas', v(r.devueltas), `${r.devueltas.veces || 0} veces en total`),
  ].join('');
  const sel = abierta && r[abierta]?.ids ? r[abierta].ids.map(id => ctx.porId.get(id)).filter(Boolean) : [];
  const detalle = abierta ? `<section class="tv-kpid" aria-label="Las tareas de esa cifra"><h3>${esc(abierta === 'cicloMin' || abierta === 'esperaOkMin' ? 'Las tareas de esa medida' : 'Esas tareas')} <span>${sel.length}</span></h3>${sel.length ? `<div class="tv-filas" role="list">${sel.map(t => filaHTML(t, ctx)).join('')}</div>` : vacioHTML('Ninguna', '')}</section>` : '';
  const estados = Object.entries(r.tiempoEnEstado || {}).filter(([k]) => NOMBRE_ESTADO[k]);
  const enEstado = estados.length ? `<table class="tv-tabla"><caption>Cuánto pasa una tarea en cada estado (mediana)</caption><tbody>${estados.map(([k, x]) => `<tr><th scope="row">${esc(NOMBRE_ESTADO[k])}</th><td>${esc(minutosTexto(x.mediana))}</td><td>${x.n} veces</td></tr>`).join('')}</tbody></table>` : '<p class="tv-ayuda">El tiempo en cada estado sale de la bitácora: aparecerá con las próximas tareas.</p>';
  const carga = r.carga?.length ? `<table class="tv-tabla"><caption>Carga ahora (abiertas)</caption><tbody>${r.carga.slice(0, 10).map(c => `<tr><th scope="row">${c.persona ? '👤 ' : ''}${esc(c.quien)}</th><td>${c.abiertas}</td></tr>`).join('')}</tbody></table>` : '';
  const depts = r.porDept?.length ? `<table class="tv-tabla"><caption>Por departamento (${dias} días)</caption><thead><tr><th scope="col">Departamento</th><th scope="col">Hechas</th><th scope="col">Fallaron</th><th scope="col">Costo</th></tr></thead><tbody>${r.porDept.map(d => `<tr><th scope="row">${esc(d.nombre)}</th><td>${d.hechas}</td><td>${d.fallidas}</td><td>US$ ${String(d.costo).replace('.', ',')}</td></tr>`).join('')}</tbody></table>` : '';
  const wh = webhooks?.destinos?.length ? `<table class="tv-tabla"><caption>Webhooks (avisan a otros sistemas)</caption><tbody>${webhooks.destinos.map(w => { const off = webhooks.apagados?.[w.id], ult = (webhooks.historial || []).filter(h => h.id === w.id).at(-1); return `<tr><th scope="row">${esc(w.id)}<br><small>${esc(w.url)}${w.firma ? ' · firmado' : ' · sin firma'}</small></th><td>${off ? `apagado <button type="button" class="tv-btn" data-encender="${esc(w.id)}">Encender</button>` : ult ? (ult.ok ? 'último: bien' : `último: falló (${esc(ult.error || '')})`) : 'sin envíos todavía'}</td></tr>`; }).join('')}</tbody></table>` : '';
  return `<div class="tv-mhead"><label class="tv-sel"><span>Periodo</span><select data-dias>${[7, 30, 90].map(n => `<option value="${n}"${n === dias ? ' selected' : ''}>Últimos ${n} días</option>`).join('')}</select></label><span class="tv-ayuda">Pulsa una cifra para ver sus tareas.</span></div>
    <div class="tv-kpis">${kpis}</div>${detalle}<div class="tv-tablas">${enEstado}${carga}${depts}${wh}</div>`;
}
