// La pestaña RESUMEN (Fase A1): arriba, lo que pide atención (pago pendiente, rechazados, tope cerca, Meta que frena); cuatro cifras
// (gasto de hoy contra el tope diario, gasto del mes contra el mensual, resultados y costo por resultado de 7 días, cada una con su
// tendencia); y las campañas activas en tarjetas, con su interruptor y su «⋯» (Fase A2). Sin Meta conectada, cómo conectar.
import { controlesHTML } from './acciones.js';
import { esc, dinero, contraTope, tendenciaHTML, estadoDe, chip, resultados, presupuesto, tieneProblemas, esActiva, num, SIN } from './comun.js';
import { nombreRango } from './campanas.js';

const TONO = { bad: 'rojo', warn: 'ambar', info: 'azul' }, ROT = { bad: 'Atención', warn: 'Aviso', info: 'Para saber' };
export function avisosHTML(d) {
  const l = [...(d?.avisos || [])];
  if (d?.error) l.unshift({ nivel: 'bad', texto: `La última lectura de Meta falló: ${d.error}` });
  if (d?.uso?.frenadoHasta && Date.parse(d.uso.frenadoHasta) > Date.now()) l.push({ nivel: 'warn', texto: `Meta pidió ir más despacio: la oficina vuelve a leer después de las ${new Date(d.uso.frenadoHasta).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}${d.uso.motivo ? ` (${d.uso.motivo})` : ''}.` });
  if (!l.length) return '';
  const orden = { bad: 0, warn: 1, info: 2 };
  return `<ul class="anu-avisos" aria-label="Lo que pide atención">${l.sort((a, b) => (orden[a.nivel] ?? 3) - (orden[b.nivel] ?? 3)).map(a => `<li class="t-${TONO[a.nivel] || 'gris'}"><b>${ROT[a.nivel] || 'Aviso'}</b><span>${esc(a.texto)}</span></li>`).join('')}</ul>`;
}

function topeHTML(titulo, gastado, tope, moneda, cual, extra = '') {
  const t = contraTope(gastado, tope);
  const barra = t && t.pct != null ? `<div class="anu-barra-tope" role="img" aria-label="${Math.round(t.pct)} % del tope ${cual}"><i class="t-${t.tono}" style="width:${Math.min(100, t.pct).toFixed(1)}%"></i></div>` : '';
  const pie = t ? (t.pct == null ? `tope ${cual}: ${esc(dinero(tope, moneda))}` : `${Math.round(t.pct)} % del tope ${cual} de ${esc(dinero(tope, moneda))}`) : `sin tope ${cual}`;
  return `<div class="anu-kpi"><p class="anu-kt">${esc(titulo)}</p><p class="anu-kv">${esc(dinero(gastado, moneda))}</p>${barra}<p class="anu-kp${t && t.tono !== 'verde' && t.pct != null ? ' t-' + t.tono : ''}">${pie}</p>${extra}</div>`;
}

export function cifrasResumenHTML(d) {
  const m = d?.cuenta?.moneda || 'USD', g = d?.gasto || {}, tp = d?.topes || {}, r = d?.resumen || {}, td = r.tendencia || {};
  return `<div class="anu-kpis">
    ${topeHTML('Gasto de hoy', g.hoy, tp.diario, m, 'diario')}
    ${topeHTML('Gasto del mes', g.mes, tp.mensual, m, 'mensual', `<p class="anu-kp">${tendenciaHTML(td.gasto, false)} <span class="anu-sr">el gasto, contra el periodo anterior</span></p>`)}
    <div class="anu-kpi"><p class="anu-kt">Resultados · 7 días</p><p class="anu-kv">${esc(r.resultados7d == null ? SIN : num(r.resultados7d))}</p><p class="anu-kp">${tendenciaHTML(td.resultados, true)}</p></div>
    <div class="anu-kpi"><p class="anu-kt">Costo por resultado · 7 días</p><p class="anu-kv">${esc(dinero(r.costoPorResultado7d, m))}</p><p class="anu-kp">${tendenciaHTML(td.costo, false)}</p></div>
  </div>`;
}

export function tarjetaHTML(c, moneda, rango, ahora = Date.now()) {
  const e = estadoDe(c), k = c.cifras || {}, js = c.conjuntos || [], apr = js.filter(j => j.aprendizaje?.estado === 'LEARNING').length;
  return `<li class="anu-tarj"><h3><button type="button" class="anu-abrir" data-abrircamp="${esc(c.id)}">${esc(c.nombre || '(sin nombre)')}</button></h3>
    <p class="anu-tchips">${chip(e.texto, e.tono)}${apr ? chip(apr === js.length ? 'Aprendiendo' : `${apr} de ${js.length} aprendiendo`, 'ambar') : ''}${tieneProblemas(c) && e.tono !== 'rojo' ? chip('pide atención', 'rojo') : ''}${c.creadoFuera ? chip('creada fuera', 'gris') : ''}</p>
    <p class="anu-tobj">${esc(c.objetivoTexto || c.objetivo || '')}${c.presupuesto ? ` · ${esc(presupuesto(c.presupuesto, moneda))}` : ''}</p>
    <dl class="anu-tcif"><div><dt>Gasto · ${esc(nombreRango(rango).toLowerCase())}</dt><dd>${esc(dinero(k.gasto, moneda))}</dd></div><div><dt>Resultados</dt><dd>${esc(resultados(k))}</dd></div><div><dt>Costo por resultado</dt><dd>${esc(dinero(k.costoPorResultado, moneda))}</dd></div></dl>
    <div class="anu-tctl">${controlesHTML({ nivel: 'campana', id: c.id, nodo: c, campana: c }, ahora)}</div></li>`;
}

export function conexionHTML(d) {
  return `<section class="anu-card anu-conectar" aria-labelledby="anuConT"><h2 id="anuConT">Conecta tu cuenta publicitaria de Meta</h2>
    <p>${esc(d?.motivo || 'La oficina todavía no puede leer tus anuncios.')}</p>
    <ol><li>El token de Meta va en la variable de Windows <code>META_ACCESS_TOKEN</code> (el mismo de Analíticas y Contenido), con los permisos de anuncios (<code>ads_read</code>, y para la siguiente fase <code>ads_management</code>).</li>
      <li>En <b>Ajustes → Anuncios</b>, escribe la cuenta publicitaria (<code>act_…</code>) y tus topes de gasto.</li>
      <li>Reinicia la oficina y vuelve aquí. Paso a paso: <code>docs/conectar-meta.md</code>.</li></ol>
    <p class="anu-ayuda">Cuando esté conectada: pausar es de un clic; lo que gasta te pide un segundo clic que dice la cifra y nunca pasa de tus topes.</p>
    <div class="anu-acts"><button type="button" class="anu-btn pri" data-a="ajustes">Abrir Ajustes → Anuncios</button><button type="button" class="anu-btn" data-a="ejemplo">Ver con datos de ejemplo</button></div></section>`;
}

export function resumenHTML(d, { rango = '7d', ahora = Date.now() } = {}) {
  if (!d) return '<p class="anu-cargando">Cargando…</p>';
  if (!d.configurado) return conexionHTML(d);
  const m = d.cuenta?.moneda || 'USD', activas = (d.campanas || []).filter(c => esActiva(c) || tieneProblemas(c));
  const cuenta = d.cuenta ? `<p class="anu-cuenta-l">Cuenta <b>${esc(d.cuenta.nombre || d.cuenta.id)}</b> · ${chip(d.cuenta.estadoTexto || estadoDe(d.cuenta).texto, /activa|active/i.test(d.cuenta.estadoTexto || d.cuenta.estado || '') ? 'verde' : 'ambar')} · ${esc(m)}${d.cuenta.zona ? ' · ' + esc(d.cuenta.zona) : ''}${d.cuenta.saldo != null ? ` · saldo ${esc(dinero(d.cuenta.saldo, m))}` : ''}</p>` : '';
  return `${avisosHTML(d)}${cuenta}${cifrasResumenHTML(d)}
    <section class="anu-sec" aria-labelledby="anuActT"><h2 id="anuActT">Campañas activas <span class="anu-cuenta">${activas.length}</span></h2>
    ${activas.length ? `<ul class="anu-tarjs">${activas.map(c => tarjetaHTML(c, m, rango, ahora)).join('')}</ul>` : '<div class="anu-vacio"><b>No hay campañas activas</b><span>Las que estén en pausa o terminadas están en Campañas.</span></div>'}</section>`;
}
