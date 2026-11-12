// Las pestañas MÉTODO y COMPETENCIA de Anuncios (11 nov 2026). Todo es lectura y cálculo: aquí no hay ningún botón que pause, active o cambie un presupuesto
// (eso sigue en Campañas, con sus dos clics). Lo único que se guarda son TUS números del negocio, la etapa de una campaña y los competidores que sigues.
//   Método      → GET /api/anuncios/metodo · …/revision[?fresco=1] · PUT …/negocio { negocio, antes } · PUT …/etapas { id: etapa }
//   Competencia → GET /api/anuncios/competencia · …/empresas?q= · …/anuncios?pageId|empresa|q · POST|DELETE …/competidores
// `crearMetodoVista` es un controlador como el de Borradores: html(tab) · cargar(tab) · click(boton) · change(evento) · submit(evento).
import { esc, chip, dinero, pct, num, SIN, haceCuanto } from './comun.js';
import { TIPOS_NEGOCIO, DESTINOS_NEGOCIO, CUENTA_NEGOCIO } from '../../metodo/ciclo-ventas.mjs';

export const TABS_METODO = [['metodo', 'Método'], ['competencia', 'Competencia']];
const PARTES = [['revision', 'Revisión 3Q'], ['numeros', 'Números del negocio'], ['ciclo', 'Ciclo de ventas']];
const TONO = { bien: 'verde', mal: 'rojo', aviso: 'ambar', espera: 'gris', neutro: 'gris' };
const Q1 = { bien: ['Dentro del número', 'verde'], caro: ['Más caro que el objetivo', 'ambar'], pierde: ['Pasa del equilibrio', 'rojo'], 'sin-datos': ['Sin datos', 'gris'], 'sin-numero': ['Sin número mágico', 'gris'] };
const VENTANAS = [[7, '7 días'], [14, '14 días'], [30, '30 días']];

const plata = (v, m) => (v == null ? SIN : dinero(v, m, { decimales: 2 }));
const tono = t => TONO[t] || 'gris';
const q1Chip = e => { const [t, c] = Q1[e] || [e || 'Sin datos', 'gris']; return chip(t, c); };
const opciones = (lista, actual, vacio) => `<option value="">${esc(vacio)}</option>` + lista.map(o => `<option value="${esc(o.id)}"${o.id === actual ? ' selected' : ''}>${esc(o.nombre)}</option>`).join('');
const valorDe = (m, c) => (m.unidad === 'dinero' ? plata(m.valor, c) : m.unidad === '%' ? pct(m.valor, 1) : m.valor == null ? SIN : `${num(m.valor)}${m.unidad ? ' ' + m.unidad : ''}`);

// ───────────────────────────── Método: la revisión 3Q ─────────────────────────────
function numeroHTML(r) {
  const n = r.numero || {}, m = r.cuenta?.moneda, q = r.q1Cuenta;
  if (n.objetivo == null && n.equilibrio == null) {
    return `<div class="anu-vacio"><b>Todavía no hay número mágico</b><span>Escribe tu ticket, tus costos y cuánto de la venta inviertes en «Números del negocio»: con eso la oficina sabe cuánto puede costar un resultado. Mientras tanto, cada campaña se compara solo con su propio mes.</span>
      <button type="button" class="anu-btn pri" data-mparte="numeros">Escribir mis números</button></div>`;
  }
  const filas = q ? VENTANAS.map(([d, t]) => { const v = q.ventanas?.[d] || {}; return `<tr><th scope="row">${t}</th><td class="anu-n">${plata(v.gasto, m)}</td><td class="anu-n">${num(v.conversaciones || v.compras)}</td><td class="anu-n">${plata(v.real, m)}</td><td>${q1Chip(v.estado)}</td></tr>`; }).join('') : '';
  return `<section class="anu-met-num" aria-label="El número mágico">
    <div class="anu-kpis">
      <div class="anu-kpi"><span>${esc(n.metrica || 'Costo por resultado')} · objetivo</span><b>${plata(n.objetivo, m)}</b><small>lo que estás dispuesto a pagar</small></div>
      <div class="anu-kpi"><span>Equilibrio</span><b>${plata(n.equilibrio, m)}</b><small>de aquí en adelante se pierde dinero</small></div>
      <div class="anu-kpi"><span>Tasa de cierre</span><b>${pct(n.tasaCierre, 0)}</b><small>de cada 100 conversaciones, las que compran</small></div>
      <div class="anu-kpi"><span>La cuenta, últimos 7 días</span><b>${plata(q?.ventanas?.[7]?.real, m)}</b><small>${q ? q1Chip(q.estado) : ''}</small></div>
    </div>
    ${n.alarma ? `<p class="anu-aviso-error" role="alert">${esc(n.textoAlarma)}</p>` : ''}
    ${filas ? `<details class="anu-met-det"><summary>Q1 · ¿la cuenta está dentro del número? (30, 14 y 7 días completos)</summary><div class="anu-tabla-caja"><table class="anu-tabla"><thead><tr><th>Ventana</th><th class="anu-n">Gasto</th><th class="anu-n">Resultados</th><th class="anu-n">${esc(q.metrica || 'Costo')}</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table></div></details>` : ''}
  </section>`;
}

function q2HTML(q2, m) {
  const l = (q2?.metricas || []).filter(x => x.valor != null);
  if (!l.length) return '';
  return `<ul class="anu-met-q2" aria-label="Q2 · qué métrica falla (últimos ${esc(q2.ventana)} días)">${l.map(x => `<li class="${x.mal ? 'mal' : ''}"><span>${esc(x.nombre)}</span><b>${valorDe(x, m)}</b>${x.mal ? chip('revisar', 'ambar') : chip('bien', 'verde')}${x.texto ? `<small>${esc(x.texto)}</small>` : ''}</li>`).join('')}</ul>`;
}

function hijoHTML(x, m, tipo) {
  const v = x.veredicto || {}, c = x.ventanas?.[7] || {};
  return `<li><div class="anu-met-hl"><b>${esc(x.nombre)}</b>${chip(v.nombre || 'Sin veredicto', tono(v.tono))}<span class="anu-met-cifra">${tipo} · 7 días: ${plata(c.gasto, m)} · ${num(c.resultados)} resultados · ${plata(c.costoPorResultado, m)} c/u</span></div>
    ${v.motivo ? `<p>${esc(v.motivo)}</p>` : ''}</li>`;
}

function campanaHTML(c, r, { puedeEtapa }) {
  const m = r.cuenta?.moneda, v = c.veredicto || {}, w = c.ventanas?.[7] || {}, ref = c.referencia || {};
  const etapa = puedeEtapa && /^\d+$/.test(String(c.id))
    ? `<label class="anu-met-etapa">Etapa <select data-metapa="${esc(c.id)}">${(r.etapas || []).map(e => `<option value="${esc(e.id)}"${e.id === c.etapa ? ' selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label>`
    : chip(c.nombreEtapa || 'Sin etapa', 'gris');
  const acciones = (v.acciones || []).map(a => `<li><b>${esc(a.titulo)}</b><span>${esc(a.texto)}</span></li>`).join('');
  const conj = (c.conjuntos || []).map(x => hijoHTML(x, m, 'Conjunto')).join(''), anu = (c.anuncios || []).map(x => hijoHTML(x, m, 'Anuncio')).join('');
  return `<li class="anu-tarj anu-met-camp t-${esc(v.tono || 'neutro')}">
    <div class="anu-met-cab"><h3>${esc(c.nombre)}</h3>${chip(v.nombre || 'Sin veredicto', tono(v.tono))}${etapa}</div>
    ${v.motivo ? `<p class="anu-met-motivo">${esc(v.motivo)}</p>` : ''}
    <p class="anu-met-cifra">7 días: ${plata(w.gasto, m)} · ${num(w.resultados)} ${esc(c.nombreResultado || 'resultados')} · ${plata(w.costoPorResultado, m)} c/u${ref.ref != null ? ` · aguanta hasta ${plata(ref.ref, m)}` : ''}${w.frecuencia != null ? ` · frecuencia ${num(w.frecuencia)}` : ''}</p>
    ${c.exigencia ? `<p class="anu-ayuda">${esc(c.exigencia)}</p>` : ''}
    ${q2HTML(c.q2, m)}
    ${acciones ? `<div class="anu-met-q3"><h4>Q3 · qué hacer</h4><ul>${acciones}</ul></div>` : ''}
    ${conj || anu ? `<details class="anu-met-det"><summary>Sus conjuntos y anuncios (${(c.conjuntos || []).length + (c.anuncios || []).length})</summary><ul class="anu-met-hijos">${conj}${anu}</ul></details>` : ''}
    <p class="anu-met-pie"><button type="button" class="anu-btn" data-vercamp="${esc(c.id)}">Ver en Campañas</button>${c.enlace ? ` <a class="anu-btn" href="${esc(c.enlace)}" target="_blank" rel="noopener noreferrer">Abrir en Ads Manager</a>` : ''}</p>
  </li>`;
}

function revisionHTML(S, ctx) {
  const r = S.rev;
  if (S.errRev) return `<div class="anu-vacio" role="alert"><b>No se pudo traer la revisión</b><span>${esc(S.errRev)}</span><button type="button" class="anu-btn" data-ma="recargar">Reintentar</button></div>`;
  if (!r) return '<p class="anu-cargando">Leyendo la revisión…</p>';
  if (!r.configurado) return `<div class="anu-vacio"><b>La revisión necesita tu cuenta publicitaria</b><span>${esc(r.motivo || 'Conecta Meta y pon la cuenta en Ajustes → Anuncios.')}</span></div>`;
  const res = r.resumen || {}, pv = res.porVeredicto || {};
  const leido = r.leidoCon === 'diario' ? 'Sale de las cifras diarias ya guardadas (sin clics únicos ni rankings). «Leer de Meta ahora» trae la lectura completa.'
    : r.leidoCon && r.leidoCon !== 'completo' ? `Meta no entregó todos los campos (lectura «${r.leidoCon}»): lo que falta sale como «${SIN}».` : '';
  const cab = `<div class="anu-barra"><p class="anu-ayuda">Días completos, hasta ayer${r.leidoAt ? ` · leído ${esc(haceCuanto(r.leidoAt, ctx.ahora()))}` : ''}. ${res.campanas || 0} ${res.campanas === 1 ? 'campaña' : 'campañas'}${res.pendientes ? ` · ${res.pendientes} cosas por mirar` : ''}${pv.sano ? ` · ${pv.sano} sanas` : ''}.</p>
    <button type="button" class="anu-btn" data-ma="fresco"${S.leyendo ? ' disabled aria-busy="true"' : ''}>${S.leyendo ? 'Leyendo de Meta…' : 'Leer de Meta ahora'}</button></div>`;
  const lista = (r.campanas || []).length ? `<ul class="anu-tarjs anu-met-lista">${r.campanas.map(c => campanaHTML(c, r, { puedeEtapa: ctx.servida })).join('')}</ul>`
    : '<div class="anu-vacio"><b>No hay campañas encendidas que revisar</b><span>La revisión mira lo que está activo en tu cuenta. Cuando enciendas una campaña, aparecerá aquí con su veredicto.</span></div>';
  return `${numeroHTML(r)}${cab}${leido || r.avisoLectura ? `<p class="anu-ayuda" data-mlectura>${esc(leido || r.avisoLectura)}</p>` : ''}${lista}`;
}

// ───────────────────────────── Método: los números del negocio ─────────────────────────────
function numerosHTML(S) {
  const f = S.met?.negocio;
  if (S.errMet) return `<div class="anu-vacio" role="alert"><b>No se pudieron traer tus números</b><span>${esc(S.errMet)}</span><button type="button" class="anu-btn" data-ma="recargar">Reintentar</button></div>`;
  if (!f) return '<p class="anu-cargando">Leyendo tus números…</p>';
  const n = f.negocio || {}, m = f.moneda, o = f.objetivo || {}, e = f.equilibrio || {}, g = f.magico || {};
  const campos = (f.campos || []).map(c => {
    const propio = c.valor != null && !['meta', 'defecto'].includes(c.origen);
    return `<label class="anu-met-campo"><span>${esc(c.nombre)} <small>${c.unidad === 'dinero' ? esc(m) : '%'}</small></span>
      <input type="number" inputmode="decimal" step="any" min="0" name="c:${esc(c.id)}" value="${propio ? esc(c.valor) : ''}" placeholder="${c.valor != null && !propio ? esc(c.valor) + ' · ' + esc(c.origenTexto.toLowerCase()) : ''}" data-origen="${esc(propio ? c.origen : '')}">
      <small>${esc(c.ayuda || '')}</small></label>`;
  }).join('');
  const costos = [...(n.costos || []), { nombre: '', pct: '' }, { nombre: '', pct: '' }].slice(0, 8).map((c, i) => `<div class="anu-met-costo"><input type="text" name="cn:${i}" value="${esc(c.nombre)}" maxlength="60" placeholder="Producción, envío, comisión…" aria-label="Costo ${i + 1}: nombre">
    <input type="number" inputmode="decimal" step="any" min="0" max="100" name="cp:${i}" value="${esc(c.pct)}" placeholder="%" aria-label="Costo ${i + 1}: porcentaje de cada venta"></div>`).join('');
  const salida = `<div class="anu-kpis">
      <div class="anu-kpi"><span>Objetivo · por venta</span><b>${plata(o.costoCompra, m)}</b><small>${o.costoConversacion != null ? `${plata(o.costoConversacion, m)} por conversación` : 'falta el ticket y cuánto inviertes'}</small></div>
      <div class="anu-kpi"><span>Equilibrio · por venta</span><b>${plata(e.cac, m)}</b><small>${e.costoConversacion != null ? `${plata(e.costoConversacion, m)} por conversación · ROAS ${e.roas != null ? e.roas.toLocaleString('es', { maximumFractionDigits: 2 }) : SIN}` : 'faltan los costos'}</small></div>
      <div class="anu-kpi"><span>Inversión del mes</span><b>${plata(o.inversion, m)}</b><small>${o.ventasNecesarias != null ? `para ${num(o.ventasNecesarias)} ventas` : 'con tu meta de ventas'}</small></div>
      <div class="anu-kpi"><span>${esc(g.metrica || 'Número mágico')} · real</span><b>${plata(g.real, m)}</b><small>últimos 30 días en Meta</small></div>
    </div>
    ${(f.reparto || []).some(x => x.monto) ? `<p class="anu-ayuda">Reparto por etapa: ${f.reparto.map(x => `${esc(x.nombre)} ${num(x.pct)} % (${plata(x.monto, m)})`).join(' · ')}.</p>` : ''}
    ${(f.faltan || []).length ? `<p class="anu-ayuda">Falta: ${esc(f.faltan.join(', '))}.</p>` : ''}`;
  return `${salida}<form class="anu-met-form" data-mform="negocio" novalidate>
    <fieldset><legend>Tu negocio</legend><div class="anu-met-fila">
      <label class="anu-met-campo"><span>Qué vendes</span><select name="tipo">${opciones(TIPOS_NEGOCIO, n.tipo, 'Elige…')}</select></label>
      <label class="anu-met-campo"><span>Dónde se cierra la venta</span><select name="destino">${opciones(DESTINOS_NEGOCIO, n.destino, 'Elige…')}</select></label>
      <label class="anu-met-campo"><span>Tu cuenta publicitaria</span><select name="cuenta">${opciones(CUENTA_NEGOCIO, n.cuenta, 'Elige…')}</select></label>
    </div></fieldset>
    <fieldset><legend>Tus números</legend><p class="anu-ayuda">Deja vacío lo que no sepas: la oficina usa lo de Meta o su valor por defecto, y lo dice.</p><div class="anu-met-fila">${campos}</div></fieldset>
    <fieldset><legend>Costos variables (% de cada venta)</legend><div class="anu-met-costos">${costos}</div></fieldset>
    <p class="anu-aviso-error" role="alert" data-merr${S.errForm ? '' : ' hidden'}>${esc(S.errForm)}</p>
    <p class="anu-met-pie"><button type="submit" class="anu-btn pri">Guardar mis números</button>
      ${n.actualizado ? `<span class="anu-ayuda">Guardados ${esc(haceCuanto(n.actualizado, Date.now()))}${n.por ? ` por ${esc(n.por)}` : ''}.</span>` : ''}</p>
  </form>`;
}

/** Lo que se manda al guardar: todo el negocio (la ruta lo reemplaza entero). Un número que no cambió conserva su origen; el que escribes ahora es «del cliente». */
export function negocioDelFormulario(form, anterior = {}) {
  const d = new FormData(form), out = { tipo: String(d.get('tipo') || ''), destino: String(d.get('destino') || ''), cuenta: String(d.get('cuenta') || ''), modo: anterior.modo || '', costos: [] };
  for (const [k, v] of d.entries()) {
    if (!k.startsWith('c:') || String(v).trim() === '') continue;
    const id = k.slice(2), valor = Number(String(v).replace(',', '.')); if (!Number.isFinite(valor) || valor < 0) continue;
    const antes = anterior[id]; out[id] = { valor, origen: antes && Number(antes.valor) === valor && antes.origen ? antes.origen : 'cliente' };
  }
  for (let i = 0; i < 8; i++) {
    const nombre = String(d.get('cn:' + i) || '').trim(), p = Number(String(d.get('cp:' + i) || '').replace(',', '.'));
    if (nombre && Number.isFinite(p) && p > 0) out.costos.push({ nombre, pct: p });
  }
  return out;
}

// ───────────────────────────── Método: el ciclo de ventas ─────────────────────────────
function cicloHTML(S) {
  const f = S.met?.negocio, c = f?.ciclo;
  if (!f) return '<p class="anu-cargando">Leyendo el ciclo…</p>';
  if (!c?.etapas?.length) return '<div class="anu-vacio"><b>Falta decir qué vendes y dónde cierras la venta</b><span>Con eso la oficina sabe qué pieza va en cada etapa.</span><button type="button" class="anu-btn pri" data-mparte="numeros">Completar mi negocio</button></div>';
  const monto = Object.fromEntries((f.reparto || []).map(x => [x.id, x.monto]));
  return `<p class="anu-ayuda">Objetivo de campaña en Meta: <b>${esc(c.nombreObjetivo || '')}</b>${c.nota ? ` · ${esc(c.nota)}` : ''}${c.deducido ? ' · deducido por la oficina (el curso no trae esta combinación)' : ''}.</p>
    <ol class="anu-tarjs anu-met-ciclo">${c.etapas.map(e => `<li class="anu-tarj"><div class="anu-met-cab"><h3>${esc(e.nombre)}</h3>${chip(`${num(e.reparto)} % del presupuesto`, 'gris')}${e.ahora ? chip('empieza aquí', 'verde') : ''}</div>
      ${monto[e.id] ? `<p class="anu-met-cifra">${plata(monto[e.id], f.moneda)} al mes</p>` : ''}
      <p>${esc(e.contenido || '')}</p>
      ${(e.artes || []).length ? `<p class="anu-ayuda">Tipos de arte: ${esc(e.artes.join(', '))}.</p>` : ''}
      ${e.lleva ? `<p class="anu-ayuda">Lleva ${esc(e.lleva)}.</p>` : ''}</li>`).join('')}</ol>`;
}

// ───────────────────────────── Competencia ─────────────────────────────
const NOMBRE_DESTINO = { whatsapp: 'WhatsApp', mensajes: 'Mensajes', instagram: 'Instagram', web: 'Web' };
function anuncioHTML(a) {
  return `<li class="anu-tarj anu-comp-anuncio"><div class="anu-met-cab"><h3>${esc(a.pagina || 'Anunciante')}</h3>${chip(a.activo ? 'Activo' : 'Ya no corre', a.activo ? 'verde' : 'gris')}${chip(`${num(a.dias)} días`, a.dias >= 30 ? 'verde' : 'gris')}${a.versiones > 1 ? chip(`${a.versiones} versiones`, 'ambar') : ''}</div>
    <p class="anu-met-cifra">${esc(a.formato || 'anuncio')}${a.cta ? ` · botón «${esc(a.cta)}»` : ''}${a.destinoTipo ? ` · lleva a ${esc(NOMBRE_DESTINO[a.destinoTipo] || a.destinoTipo)}` : ''}${(a.plataformas || []).length ? ` · ${esc(a.plataformas.join(', ').toLowerCase())}` : ''}${a.inicio ? ` · desde ${esc(a.inicio)}` : ''}</p>
    ${a.titulo ? `<p><b>${esc(a.titulo)}</b></p>` : ''}${a.texto ? `<p class="anu-comp-texto">${esc(a.texto)}</p>` : ''}
    ${a.enlace ? `<p class="anu-met-pie"><a class="anu-btn" href="${esc(a.enlace)}" target="_blank" rel="noopener noreferrer">Verlo en la Biblioteca de Meta</a></p>` : ''}</li>`;
}

function lecturaHTML(b) {
  const l = b.lectura || {}, pares = x => (x || []).map(([k, n]) => `${esc(NOMBRE_DESTINO[k] || k || 'sin dato')} ${num(n)}`).join(' · ');
  const orden = [...(b.anuncios || [])].sort((x, y) => (y.senal || 0) - (x.senal || 0));
  return `<section class="anu-comp-res" aria-label="Resultado de la búsqueda"><h3>${esc(b.de || 'Resultado')}</h3>
    <p class="anu-ayuda">${b.vieja ? 'Sin créditos esta semana: es la última lectura guardada. ' : ''}${b.cache ? `Leído ${esc(haceCuanto(b.at, Date.now()))} (no gastó crédito).` : 'Recién leído (1 crédito).'}</p>
    <div class="anu-kpis"><div class="anu-kpi"><span>Anuncios</span><b>${num(l.total)}</b><small>${num(l.activos)} activos</small></div>
      <div class="anu-kpi"><span>Llevan corriendo</span><b>${num(l.diasMediana)} días</b><small>la mitad, más que esto</small></div>
      <div class="anu-kpi"><span>Formatos</span><b>${esc((l.formatos || [])[0]?.[0] || SIN)}</b><small>${pares(l.formatos)}</small></div>
      <div class="anu-kpi"><span>A dónde llevan</span><b>${esc(NOMBRE_DESTINO[(l.destinos || [])[0]?.[0]] || (l.destinos || [])[0]?.[0] || SIN)}</b><small>${pares(l.destinos)}</small></div></div>
    ${(l.ganchos || []).length ? `<details class="anu-met-det" open><summary>Cómo empiezan sus anuncios (los ganchos)</summary><ul class="anu-comp-ganchos">${l.ganchos.map(g => `<li>${esc(g)}</li>`).join('')}</ul></details>` : ''}
    <p class="anu-ayuda">Ordenados por señal: los que más tiempo llevan activos y más versiones tienen son los que le están funcionando. Pídele a Dimitri «analiza los anuncios de ${esc(b.de || 'este competidor')}» para leerlos con el método.</p>
    ${orden.length ? `<ul class="anu-tarjs">${orden.map(anuncioHTML).join('')}</ul>` : '<div class="anu-vacio"><b>No tiene anuncios en ese país</b><span>Prueba con otro país o con «activos y ya terminados».</span></div>'}</section>`;
}

function competenciaHTML(S, ctx) {
  const r = S.comp;
  if (S.errComp) return `<div class="anu-vacio" role="alert"><b>No se pudo abrir la competencia</b><span>${esc(S.errComp)}</span><button type="button" class="anu-btn" data-ma="recargar">Reintentar</button></div>`;
  if (!r) return '<p class="anu-cargando">Leyendo…</p>';
  const s = r.semana || {}, sin = !r.configurado, agotado = s.tope != null && s.usados >= s.tope;
  const estado = sin ? `<div class="anu-vacio"><b>Falta conectar la Biblioteca de anuncios</b><span>${esc(r.motivo || '')} La llave se pone como variable de entorno (SCRAPECREATORS_API_KEY); nunca en un archivo.</span></div>`
    : `<p class="anu-ayuda" data-creditos>Créditos de esta semana: <b>${num(s.usados)} de ${num(s.tope)}</b>. Cada búsqueda nueva gasta uno; repetirla en 12 horas no gasta. El tope se cambia en Ajustes → Anuncios.</p>`;
  const guardados = (r.competidores || []).length ? `<div class="anu-comp-guard" role="group" aria-label="Competidores que sigues">${r.competidores.map(c => `<span class="anu-comp-g"><button type="button" class="anu-btn" data-cver="${esc(c.pageId || '')}" data-cnombre="${esc(c.nombre)}">${esc(c.nombre)}</button>
      ${ctx.servida ? `<button type="button" class="anu-btn anu-comp-x" data-cquitar="${esc(c.pageId ? 'p:' + c.pageId : 'n:' + c.nombre.toLowerCase())}" aria-label="Dejar de seguir a ${esc(c.nombre)}">×</button>` : ''}</span>`).join('')}</div>`
    : '<p class="anu-ayuda">Todavía no sigues a ningún competidor: busca una empresa y guárdala.</p>';
  const form = `<form class="anu-comp-form" data-mform="buscar" novalidate>
      <label class="anu-met-campo"><span>Buscar</span><input type="search" name="q" maxlength="100" value="${esc(S.q || '')}" placeholder="Nombre de la empresa, o una palabra del rubro" enterkeyhint="search"></label>
      <label class="anu-met-campo"><span>Qué es</span><select name="modo"><option value="empresa"${S.modo !== 'palabra' ? ' selected' : ''}>Una empresa</option><option value="palabra"${S.modo === 'palabra' ? ' selected' : ''}>Una palabra clave</option></select></label>
      <button type="submit" class="anu-btn pri"${sin || S.buscando ? ' disabled' : ''}${S.buscando ? ' aria-busy="true"' : ''}>${S.buscando ? 'Buscando…' : agotado ? 'Buscar (solo lo ya leído)' : 'Buscar · 1 crédito'}</button>
    </form>${S.errBusca ? `<p class="anu-aviso-error" role="alert">${esc(S.errBusca)}</p>` : ''}`;
  const empresas = S.empresas ? (S.empresas.length ? `<section aria-label="Empresas encontradas"><h3>¿Cuál es?</h3><ul class="anu-comp-emp">${S.empresas.map(e => `<li><span><b>${esc(e.nombre)}</b>${e.verificada ? ' ' + chip('verificada', 'verde') : ''}
        <small>${esc([e.categoria, e.pais, e.seguidores != null ? num(e.seguidores) + ' seguidores' : ''].filter(Boolean).join(' · '))}</small></span>
        <span><button type="button" class="anu-btn pri" data-cver="${esc(e.pageId)}" data-cnombre="${esc(e.nombre)}">Ver sus anuncios · 1 crédito</button>
        ${ctx.servida ? `<button type="button" class="anu-btn" data-cguardar="${esc(e.pageId)}" data-cnombre="${esc(e.nombre)}">Seguir</button>` : ''}</span></li>`).join('')}</ul></section>`
    : '<div class="anu-vacio"><b>Ninguna empresa con ese nombre</b><span>Prueba con el nombre de su página de Facebook, o busca por palabra clave.</span></div>') : '';
  const recientes = !S.busca && (r.recientes || []).length ? `<p class="anu-ayuda">Ya leído (volver a mirarlo no gasta): ${r.recientes.map(x => `${esc(x.de || 'búsqueda')} · ${num(x.total)} anuncios`).join('; ')}.</p>` : '';
  return `${estado}${guardados}${form}${empresas}${S.busca ? lecturaHTML(S.busca) : recientes}`;
}

// ───────────────────────────── El controlador ─────────────────────────────
export function crearMetodoVista({ servida, decir = () => {}, repintar = () => {}, ahora = () => Date.now() }) {
  const S = { parte: 'revision', met: null, rev: null, comp: null, errMet: '', errRev: '', errComp: '', errForm: '', errBusca: '', leyendo: false, buscando: false, q: '', modo: 'empresa', empresas: null, busca: null };
  const ctx = { servida, ahora };
  const pedir = async (ruta, metodo = 'GET', cuerpo) => {
    const r = await fetch(ruta, metodo === 'GET' ? undefined : { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.motivo && j.motivo !== 'conflicto' ? j.motivo : j.error || `La oficina contestó ${r.status}.`), { status: r.status });
    return j;
  };
  const sinOficina = () => `<div class="anu-vacio"><b>Esto se ve con la oficina abierta y tu cuenta</b><span>El método y la competencia trabajan con tus números y tus campañas de verdad: no tienen datos de ejemplo.</span></div>`;

  async function cargarMetodo({ fresco = false } = {}) {
    if (!servida) return;
    try { S.met = await pedir('/api/anuncios/metodo'); S.errMet = ''; } catch (e) { S.errMet = e.message; }
    repintar();
    S.leyendo = fresco; if (fresco) repintar();
    try { S.rev = await pedir('/api/anuncios/metodo/revision?marcar=1' + (fresco ? '&fresco=1' : '')); S.errRev = ''; } catch (e) { S.errRev = e.message; }
    S.leyendo = false; repintar();
  }
  async function cargarCompetencia() {
    if (!servida) return;
    try { S.comp = await pedir('/api/anuncios/competencia'); S.errComp = ''; } catch (e) { S.errComp = e.message; }
    repintar();
  }
  async function verAnuncios(params, nombre) {
    S.buscando = true; S.errBusca = ''; repintar();
    try { S.busca = await pedir('/api/anuncios/competencia/anuncios?' + new URLSearchParams(params)); S.empresas = null; decir(`${S.busca.anuncios?.length || 0} anuncios de ${nombre || 'esa búsqueda'}.`); }
    catch (e) { S.errBusca = e.message; decir('No se pudo buscar: ' + e.message); }
    S.buscando = false; await cargarCompetencia();
  }

  return {
    estado: S,
    html(tab, { ejemplo = false } = {}) {
      if (!servida || ejemplo) return sinOficina();
      if (tab === 'competencia') return `<div class="anu-met" data-mvista="competencia">${competenciaHTML(S, ctx)}</div>`;
      const nav = `<div class="anu-barra"><div class="anu-seg" role="group" aria-label="Qué ver del método">${PARTES.map(([k, n]) => `<button type="button" data-mparte="${k}" aria-pressed="${k === S.parte}">${n}</button>`).join('')}</div></div>`;
      return `<div class="anu-met" data-mvista="${esc(S.parte)}">${nav}${S.parte === 'numeros' ? numerosHTML(S) : S.parte === 'ciclo' ? cicloHTML(S) : revisionHTML(S, ctx)}</div>`;
    },
    cargar(tab) { return tab === 'competencia' ? cargarCompetencia() : cargarMetodo(); },
    /** → true si el clic era de estas pestañas. */
    click(b) {
      const d = b.dataset;
      if (d.mparte) { S.parte = d.mparte; S.errForm = ''; repintar(); return true; }
      if (d.ma === 'fresco') { cargarMetodo({ fresco: true }).then(() => decir('Revisión leída de Meta.')); return true; }
      if (d.ma === 'recargar') { cargarMetodo(); cargarCompetencia(); return true; }
      if (d.cver !== undefined) { verAnuncios(d.cver ? { pageId: d.cver } : { empresa: d.cnombre }, d.cnombre); return true; }
      if (d.cguardar) {
        pedir('/api/anuncios/competencia/competidores', 'POST', { nombre: d.cnombre, pageId: d.cguardar }).then(() => { decir(`Ahora sigues a ${d.cnombre}.`); return cargarCompetencia(); }).catch(e => { S.errBusca = e.message; repintar(); });
        return true;
      }
      if (d.cquitar) {
        pedir('/api/anuncios/competencia/competidores?clave=' + encodeURIComponent(d.cquitar), 'DELETE').then(() => { decir('Competidor quitado.'); return cargarCompetencia(); }).catch(e => { S.errBusca = e.message; repintar(); });
        return true;
      }
      return false;
    },
    change(e) {
      const s = e.target.closest?.('[data-metapa]'); if (!s) return false;
      pedir('/api/anuncios/metodo/etapas', 'PUT', { etapas: { [s.dataset.metapa]: s.value } }).then(() => { decir('Etapa cambiada: la revisión se vuelve a calcular.'); return cargarMetodo(); }).catch(err => { S.errRev = err.message; repintar(); });
      return true;
    },
    submit(e) {
      const f = e.target.closest?.('[data-mform]'); if (!f) return false;
      e.preventDefault();
      if (f.dataset.mform === 'buscar') {
        const d = new FormData(f); S.q = String(d.get('q') || '').trim(); S.modo = String(d.get('modo') || 'empresa'); S.busca = null; S.empresas = null;
        if (!S.q) { S.errBusca = 'Escribe a quién buscar.'; repintar(); return true; }
        if (S.modo === 'palabra') { verAnuncios({ q: S.q }, `«${S.q}»`); return true; }
        S.buscando = true; S.errBusca = ''; repintar();
        pedir('/api/anuncios/competencia/empresas?q=' + encodeURIComponent(S.q)).then(r => { S.empresas = r.empresas || []; decir(`${S.empresas.length} empresas encontradas.`); }).catch(err => { S.errBusca = err.message; })
          .finally(() => { S.buscando = false; cargarCompetencia(); });
        return true;
      }
      const anterior = S.met?.negocio?.negocio || {}, boton = f.querySelector('[type=submit]'), aviso = f.querySelector('[data-merr]');
      const negocio = negocioDelFormulario(f, anterior); // sin repintar mientras guarda: lo escrito se queda en sus campos si falla
      S.errForm = ''; if (aviso) aviso.hidden = true; if (boton) { boton.disabled = true; boton.setAttribute('aria-busy', 'true'); boton.textContent = 'Guardando…'; }
      pedir('/api/anuncios/metodo/negocio', 'PUT', { negocio, antes: anterior.actualizado || null }).then(() => { decir('Números guardados.'); return cargarMetodo(); }).catch(err => {
        if (err.status === 409) { S.errForm = 'Otra persona guardó los números mientras los editabas. Se volvieron a leer: revisa y guarda otra vez.'; return cargarMetodo(); }
        if (boton) { boton.disabled = false; boton.removeAttribute('aria-busy'); boton.textContent = 'Guardar mis números'; }
        if (aviso) { aviso.textContent = err.message; aviso.hidden = false; } decir('No se guardó: ' + err.message);
      });
      return true;
    },
  };
}
