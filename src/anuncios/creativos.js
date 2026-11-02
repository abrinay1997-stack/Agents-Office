// La pestaña CREATIVOS (Fase A5, 9 oct 2026; plan §8.4). Puro: lo usan la vista y tests/anuncios-vista.test.mjs. Junta los anuncios de
// GET /api/anuncios por su creativo (creativo.id, o su miniatura y su texto si no trae id) y pone sus cifras juntas: CTR, costo por
// resultado y frecuencia RECALCULADOS (nunca un promedio de promedios: CTR = clics / impresiones; costo = gasto / resultados), y su estado
// escrito: «funciona», «se está cansando», «sin costo objetivo», «pocos resultados», «sin datos» (y, si no es ninguna, «todavía no destaca»
// o «gasta sin resultados»). «funciona» SOLO se dice con costo objetivo y por el costo, nunca por el CTR.
// OJO: estos umbrales son SOLO para pintar la etiqueta. El diagnóstico de verdad es del servidor (anuncios/diagnostico.mjs → las
// sugerencias); si GET /api/anuncios/sugerencias trae `umbrales`, se usan esos. Si no, los del plan §7 y de la auditoría del 1 nov 2026:
// frecuencia por encima de 3 y el CTR (de enlace) cayendo un 30 % contra sus primeros días (§7.4; sin serie diaria, solo la frecuencia),
// 500 impresiones para juzgar, haber gastado el costo objetivo (§7.2) y 10 resultados para juzgar el costo.
// «Pedir variaciones» aplica la sugerencia de `creativos` de ese creativo si la hay; si no, «Nueva campaña con este creativo» abre el
// asistente de la A3 con el texto puesto (el servidor no tiene una ruta para pedir variaciones sin sugerencia).
import { esc, dinero, pct, frec, num, chip, estadoDe, leyendaRango } from './comun.js';
import { nombreRango } from './campanas.js';
import { OBJETIVOS, DESTINOS, LLAMADA, llamadasDe } from './borrador.js';

// AUDITORÍA 1 nov 2026: se juzga por IMPRESIONES (500) y, para el costo, por RESULTADOS (10), no por «5 dólares de gasto»; y sin costo
// objetivo nunca se dice «funciona» (antes caía al CTR y marcaba bueno lo que costaba más).
export const UMBRALES_DEF = { frecuencia: 3, caidaCtr: 30, impresionesMin: 500, resultadosMin: 10 };
const n0 = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const nn = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = v => Math.round(v * 100) / 100;

/**
 * Los umbrales para la etiqueta: los de la página (UMBRALES_DEF) con los del servidor encima. Acepta los nombres de la página y los de
 * biblioteca/…/campanas-pagadas/umbrales.json (fatigaFrecuencia, fatigaCaidaCtr en fracción, fatigaMinImpresiones, esperarGastoCpa,
 * cortarSinResultadoCpa), cada uno como número o como { valor }.
 */
export function normalizarUmbrales(x = {}) {
  const v = k => { const y = x?.[k]; const n = y && typeof y === 'object' ? y.valor : y; return Number.isFinite(Number(n)) && n !== null && n !== '' ? Number(n) : undefined; };
  const caida = v('caidaCtr') ?? (v('fatigaCaidaCtr') != null ? (v('fatigaCaidaCtr') <= 1 ? v('fatigaCaidaCtr') * 100 : v('fatigaCaidaCtr')) : undefined);
  const u = { ...UMBRALES_DEF, cortarVeces: 2, gastoMinVeces: 1 };
  for (const [k, val] of Object.entries({ frecuencia: v('frecuencia') ?? v('fatigaFrecuencia'), caidaCtr: caida, resultadosMin: v('resultadosMin') ?? v('creativoMinResultados'), impresionesMin: v('impresionesMin') ?? v('creativoMinImpresiones') ?? v('fatigaMinImpresiones'), gastoMinVeces: v('gastoMinVeces') ?? v('esperarGastoCpa'), cortarVeces: v('cortarVeces') ?? v('cortarSinResultadoCpa') })) if (val != null) u[k] = val;
  return u;
}

/** El costo objetivo de esta campaña: un número, o un objeto por objetivo (`{ OUTCOME_ENGAGEMENT: 2 }`) o por resultado. */
export function cpaDe(cpaObjetivo, campana) {
  if (cpaObjetivo == null) return null;
  if (typeof cpaObjetivo === 'number' || typeof cpaObjetivo === 'string') return nn(cpaObjetivo);
  return nn(cpaObjetivo[campana?.objetivo]) ?? nn(cpaObjetivo[campana?.cifras?.resultadoTexto]) ?? nn(cpaObjetivo.todas) ?? null;
}
const clave = (cr = {}) => cr.id ? 'id:' + cr.id : 'k:' + [cr.miniatura, cr.titulo, cr.texto].map(x => String(x || '')).join('|');

/** campañas → [{ clave, creativo, anuncios: [{ id, nombre, estado, campana, conjunto, cifras, serie }], campana, cifras }] */
export function agruparCreativos(campanas = []) {
  const m = new Map();
  for (const c of campanas) for (const j of c.conjuntos || []) for (const a of j.anuncios || []) {
    if (!a.creativo) continue;
    const k = clave(a.creativo);
    if (!m.has(k)) m.set(k, { clave: k, creativo: a.creativo, anuncios: [], campana: c });
    m.get(k).anuncios.push({ id: a.id, cuentaTexto: a.cuentaTexto || '', nombre: a.nombre, estado: a.estado, estadoTexto: a.estadoTexto, campana: c, conjunto: j, cifras: a.cifras || {}, serie: a.serie || a.diario || null, revision: a.revision || [], problemas: a.problemas || [] });
  }
  return [...m.values()].map(g => ({ ...g, cifras: sumar(g.anuncios) }));
}
/** Las cifras juntas. La frecuencia es la MAYOR de sus anuncios (el alcance no se suma entre anuncios: se solapan); lo demás, recalculado. */
export function sumar(anuncios = []) {
  const s = k => anuncios.reduce((t, a) => t + n0(a.cifras?.[k]), 0);
  // CTR de ENLACE (clicsEnlace / impresiones), el mismo que el del servidor; `clics` (todos) se guarda aparte como ctrTodos.
  const gasto = r2(s('gasto')), impresiones = s('impresiones'), clics = s('clicsEnlace'), clicsTodos = s('clics'), conRes = anuncios.some(a => nn(a.cifras?.resultados) != null), resultados = conRes ? s('resultados') : null;
  const fr = anuncios.map(a => nn(a.cifras?.frecuencia)).filter(v => v != null);
  return { gasto, impresiones, clics: clicsTodos, clicsEnlace: clics, resultados, resultadoTexto: anuncios.find(a => a.cifras?.resultadoTexto)?.cifras.resultadoTexto || '',
    ctr: impresiones ? r2(clics / impresiones * 100) : null, ctrTodos: impresiones ? r2(clicsTodos / impresiones * 100) : null, costoPorResultado: resultados ? r2(gasto / resultados) : null, frecuencia: fr.length ? Math.max(...fr) : null };
}
/** ¿Cuánto cayó el CTR? (%, positivo = cae) de los 3 primeros días a los 3 últimos; sin serie de 6 días o más, null. */
export function caidaCtr(anuncios = []) {
  const series = anuncios.map(a => (Array.isArray(a.serie) ? a.serie : [])).filter(x => x.length >= 6);
  if (!series.length) return null;
  const ctrDe = l => { const i = l.reduce((t, d) => t + n0(d.impresiones), 0), c = l.reduce((t, d) => t + n0(d.clicsEnlace ?? d.clics), 0); return i ? c / i * 100 : (l.map(d => nn(d.ctr)).filter(v => v != null).reduce((t, v, _, x) => t + v / x.length, 0) || null); };
  const ini = ctrDe(series.flatMap(x => x.slice(0, 3))), fin = ctrDe(series.flatMap(x => x.slice(-3)));
  if (!(ini > 0) || fin == null) return null;
  return r2((ini - fin) / ini * 100);
}

/**
 * El estado de un creativo para la etiqueta → { codigo: 'funciona'|'cansando'|'sin-datos'|'sin-resultados'|'no-destaca', texto, tono, porque }.
 * `cpa`: el costo por resultado que al dueño le parece bueno (o null). `umbrales`: los del servidor, si los da.
 */
export function estadoCreativo(g, { cpa = null, umbrales = {}, moneda = 'USD' } = {}) {
  const u = normalizarUmbrales(umbrales), c = g?.cifras || sumar(g?.anuncios || []);
  const sinDatos = (texto, porque) => ({ codigo: 'sin-datos', texto, tono: 'gris', porque });
  if (n0(c.impresiones) < u.impresionesMin)
    return sinDatos('sin datos', `Todavía es pronto: lleva ${num(c.impresiones || 0)} impresiones y hacen falta ${num(u.impresionesMin)} para juzgarlo.`);
  const caida = caidaCtr(g?.anuncios || []);
  if (nn(c.frecuencia) != null && c.frecuencia > u.frecuencia && (caida == null || caida >= u.caidaCtr))
    return { codigo: 'cansando', texto: 'se está cansando', tono: 'ambar', porque: `Frecuencia ${frec(c.frecuencia)} (más de ${frec(u.frecuencia).replace(/,00$/, '')})${caida != null ? ` y el CTR bajó un ${Math.round(caida)} % contra sus primeros días` : '; sin serie diaria no sé si el CTR cae'}: la gente ya lo vio muchas veces.` };
  // Sin costo objetivo no hay con qué juzgar el costo: nunca «funciona» por el CTR (la auditoría del 1 nov 2026 lo vio marcar bueno lo caro).
  if (!(cpa > 0))
    return { codigo: 'sin-objetivo', texto: 'sin costo objetivo', tono: 'gris', porque: `No puedo decir si funciona: no hay un costo por resultado objetivo con qué compararlo. Ponlo en Ajustes → Anuncios. (CTR de enlace: ${pct(c.ctr)}; el CTR solo no dice si el anuncio rinde.)` };
  const gastoMin = cpa * (u.gastoMinVeces || 1);
  if (n0(c.gasto) < gastoMin)
    return sinDatos('sin datos', `Todavía es pronto: gastó ${dinero(c.gasto || 0, moneda)} y hace falta llegar a ${dinero(gastoMin, moneda)} (tu costo objetivo) para juzgarlo.`);
  if (!n0(c.resultados) && n0(c.gasto) >= u.cortarVeces * cpa)
    return { codigo: 'sin-resultados', texto: 'gasta sin resultados', tono: 'rojo', porque: `Gastó ${dinero(c.gasto, moneda)} (${u.cortarVeces === 2 ? 'más del doble' : `${u.cortarVeces} veces o más`} de tu objetivo de ${dinero(cpa, moneda)}) sin ningún resultado.` };
  if (n0(c.resultados) < u.resultadosMin)
    return sinDatos('pocos resultados', `Lleva ${num(n0(c.resultados))} ${c.resultadoTexto || 'resultados'} y hacen falta ${num(u.resultadosMin)} para juzgar su costo: con menos, un solo resultado más o menos lo cambia todo (hoy ${dinero(c.costoPorResultado, moneda)} cada uno).`);
  if (nn(c.costoPorResultado) != null && c.costoPorResultado <= cpa)
    return { codigo: 'funciona', texto: 'funciona', tono: 'verde', porque: `Cada resultado cuesta ${dinero(c.costoPorResultado, moneda)}, por debajo de tu objetivo de ${dinero(cpa, moneda)} (con ${num(n0(c.resultados))} ${c.resultadoTexto || 'resultados'}).` };
  return { codigo: 'no-destaca', texto: 'todavía no destaca', tono: 'gris', porque: `Cada resultado cuesta ${dinero(c.costoPorResultado, moneda)}, por encima de tu objetivo de ${dinero(cpa, moneda)}.` };
}

/** La sugerencia viva de `creativos` para este creativo (por el id de alguno de sus anuncios), o null. */
export function sugerenciaDe(g, sugerencias = []) {
  const ids = new Set((g?.anuncios || []).map(a => a.id));
  return sugerencias.find(s => (s.estado || 'viva') === 'viva' && s.cambio?.tipo === 'creativos' && (ids.has(s.cambio.id) || ids.has(s.objeto?.id))) || null;
}

const ORDEN = { cansando: 0, 'sin-resultados': 1, funciona: 2, 'no-destaca': 3, 'sin-objetivo': 4, 'sin-datos': 5 };
/** Los creativos con su estado, ordenados: lo que pide algo (cansándose, sin resultados) primero, luego lo que funciona, por gasto. */
export function creativosConEstado(campanas = [], { cpaObjetivo = null, umbrales = {}, moneda = 'USD' } = {}) {
  return agruparCreativos(campanas).map(g => ({ ...g, estado: estadoCreativo(g, { cpa: cpaDe(cpaObjetivo, g.campana), umbrales, moneda }) }))
    .sort((a, b) => ORDEN[a.estado.codigo] - ORDEN[b.estado.codigo] || n0(b.cifras.gasto) - n0(a.cifras.gasto));
}

function miniHTML(cr) {
  const s = cr?.miniatura;
  return s ? `<span class="anu-crmini" aria-hidden="true"><img src="${esc(s)}" alt="" loading="lazy" decoding="async"></span>` : '<span class="anu-crmini vacio" aria-hidden="true">Sin imagen</span>';
}
export function creativoHTML(g, { moneda = 'USD', rango = '7d', sugerencias = [], i = 0 } = {}) {
  const cr = g.creativo || {}, c = g.cifras, e = g.estado, sug = sugerenciaDe(g, sugerencias), a0 = g.anuncios[0];
  const titulo = cr.titulo || a0?.nombre || '(sin titular)';
  const marcas = [chip(e.texto, e.tono), ...g.anuncios.filter(a => /DISAPPROVED/.test(String(a.estado))).slice(0, 1).map(() => chip('rechazado', 'rojo')), ...g.anuncios.filter(a => /WITH_ISSUES/.test(String(a.estado))).slice(0, 1).map(() => chip('con problemas', 'rojo'))];
  const usos = g.anuncios.map(a => `<li><button type="button" class="anu-abrir" data-sobj="${esc(a.id)}">${esc(a.nombre || a.id)}</button> <span>· ${esc(estadoDe(a).texto)}</span>${a.cuentaTexto ? ` <span class="anu-cta-h" data-cuenta-creativo>· en ${esc(a.cuentaTexto)}</span>` : ''}</li>`).join('');
  const accion = sug ? `<button type="button" class="anu-btn pri" data-crvar="${esc(sug.id)}" aria-label="Pedir variaciones del creativo «${esc(titulo)}»">Pedir variaciones</button>`
    : `<button type="button" class="anu-btn" data-crnueva="${esc(a0?.id || '')}" aria-label="Nueva campaña con el creativo «${esc(titulo)}»">Nueva campaña con este creativo</button>`;
  return `<li class="anu-cr" data-cr="${i}">${miniHTML(cr)}
    <div class="anu-crc"><h3 id="anuCr${i}">${esc(titulo)}</h3><p class="anu-tchips">${marcas.join('')}</p>
      ${cr.texto ? `<p class="anu-crtexto">${esc(cr.texto)}</p>` : ''}${cr.llamada ? `<p class="anu-tobj">Botón: ${esc(cr.llamada)}</p>` : ''}
      <dl class="anu-tcif"><div><dt>CTR de enlace</dt><dd>${esc(pct(c.ctr))}</dd></div><div><dt>Costo por resultado</dt><dd>${esc(dinero(c.costoPorResultado, moneda))}</dd></div><div><dt>Frecuencia</dt><dd>${esc(frec(c.frecuencia))}</dd></div><div><dt>Gasto · ${esc(nombreRango(rango).toLowerCase())}</dt><dd>${esc(dinero(c.gasto, moneda))}</dd></div></dl>
      <p class="anu-crpq">${esc(e.porque)}</p>
      <details class="anu-crusos"><summary>En ${g.anuncios.length} ${g.anuncios.length === 1 ? 'anuncio' : 'anuncios'}</summary><ul>${usos}</ul></details>
      <div class="anu-acts">${accion}</div></div></li>`;
}

/** La pestaña. `d`: GET /api/anuncios; `sug`: GET /api/anuncios/sugerencias (para el costo objetivo, los umbrales y las variaciones). */
export function creativosHTML(d, sug, { rango = '7d', rangos = [] } = {}) {
  const moneda = d?.cuenta?.moneda || 'USD';
  const l = creativosConEstado(d?.campanas || [], { cpaObjetivo: sug?.cpaObjetivo ?? null, umbrales: sug?.umbrales || {}, moneda });
  const n = k => l.filter(g => g.estado.codigo === k).length;
  const seg = rangos.length ? `<div class="anu-barra"><div class="anu-seg" role="group" aria-label="Cifras de">${rangos.map(([k, t]) => `<button type="button" data-rango="${k}" aria-pressed="${k === rango}">${esc(t)}</button>`).join('')}</div></div>` : '';
  const cab = `<div class="anu-bcab"><h2 id="anuCrT">Creativos <span class="anu-cuenta">${l.length}</span></h2></div>
    <p class="anu-ayuda">Cada imagen o video con sus cifras juntas, de todos los anuncios que lo usan. La etiqueta es una guía de la página${sug?.umbrales ? ' con los umbrales de la oficina' : ''}; lo que conviene hacer lo dice la pestaña Sugerencias. ${n('funciona')} funcionan, ${n('cansando')} se están cansando y ${n('sin-datos')} todavía no tienen datos. «Pedir variaciones» sale cuando la oficina las sugiere; si no, «Nueva campaña con este creativo» empieza un borrador con su texto.</p>
    ${sug?.sinObjetivo ? `<p class="anu-ayuda">${esc(sug.sinObjetivo)} Sin ese dato ningún creativo se marca «funciona»: dirá «sin costo objetivo».</p>` : ''}${leyendaRango(d)}`;
  if (!l.length) return `${cab}${seg}<div class="anu-vacio"><b>Todavía no hay creativos con cifras</b><span>Cuando tus anuncios empiecen a salir, aquí ves cuál funciona y cuál se cansa.</span></div>`;
  return `${cab}${seg}<ul class="anu-crs" aria-labelledby="anuCrT">${l.map((g, i) => creativoHTML(g, { moneda, rango, sugerencias: sug?.items || [], i })).join('')}</ul>`;
}

/** El creativo (con sus cifras y su estado) de un anuncio, por el id del anuncio → el grupo, o null. */
export function grupoDeAnuncio(campanas = [], adId, o = {}) {
  return creativosConEstado(campanas, o).find(g => g.anuncios.some(a => a.id === adId)) || null;
}
/**
 * «Nueva campaña con este creativo» → el cuerpo de POST /api/anuncios/borradores: el objetivo y el destino de su campaña, y el creativo con
 * su texto, su titular y su llamada (la de Meta si vale para ese objetivo; si no, la primera que vale). La imagen se elige en el paso 4:
 * la miniatura de Meta no es un archivo de la galería (salvo que el creativo traiga `media`, si lo hizo la oficina).
 */
export function borradorDeCreativo(g, { ahora = Date.now() } = {}) {
  const cr = g?.creativo || {}, c = g?.campana || {}, j = g?.anuncios?.[0]?.conjunto || {};
  const objetivo = OBJETIVOS.find(o => o.meta === c.objetivo)?.k || 'mensajes';
  const destino = objetivo === 'mensajes' ? (DESTINOS.find(d => d.k === String(j.destino || '').toLowerCase() || d.n.toLowerCase() === String(j.destino || '').toLowerCase())?.k || 'whatsapp') : undefined;
  const ok = llamadasDe(objetivo, destino), lab = String(cr.llamada || '').toLowerCase();
  const cod = LLAMADA[cr.llamada] ? cr.llamada : Object.keys(LLAMADA).find(k => LLAMADA[k].toLowerCase() === lab) || null;
  const titulo = cr.titulo || g?.anuncios?.[0]?.nombre || 'creativo';
  return { nombre: `Con el creativo «${String(titulo).slice(0, 60)}»`, objetivo, ...(destino ? { destino } : {}),
    creativos: [{ id: 'cr-' + Number(ahora).toString(36), media: cr.media || null, formato: '1:1', texto: cr.texto || '', titular: cr.titulo || '', descripcion: '', llamada: cod && ok.includes(cod) ? cod : ok[0] }] };
}
