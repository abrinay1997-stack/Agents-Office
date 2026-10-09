// ============================================================
// Agents Office — Anuncios de Meta, Fase A1 (8 oct 2026): el MODELO. Puro: sin red, sin disco, sin reloj propio (la hora entra).
// docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §5 (Fase A1), §7 y §13.
//
// Lo que sabe:
//   · qué es «un resultado» según el objetivo y el destino de un conjunto (conversaciones iniciadas, clics al enlace, compras…),
//     para que el panel diga «12 conversaciones a US$1,40» y no «actions: [...]»;
//   · los estados de Meta en palabras (efectivo, aprendizaje, estado de la cuenta);
//   · el dinero: los presupuestos y saldos de Meta van en la unidad menor de la moneda de la cuenta (centavos en USD); `spend` de
//     las cifras, en cambio, viene ya en la moneda (US$ con decimales);
//   · la etiqueta de la oficina (`· AO:<id>` al final del nombre): lo que no la lleva se creó fuera, en el Administrador de anuncios;
//   · las cifras de un objeto a partir de las filas diarias de insights (sumas, y CTR, CPC, CPM y frecuencia RECALCULADOS: un
//     promedio de porcentajes diarios miente);
//   · la VISTA que contesta GET /api/anuncios (armarVista) y los textos para Dimitri, los agentes y el asistente.
//
// Lo que no se sabe no se inventa: una cifra sin datos es null.
// ============================================================

// ---------------------------------------------------------------- fechas (en la zona de la cuenta)

/** 'AAAA-MM-DD' de un instante en una zona horaria IANA (la de la cuenta publicitaria: Meta cuenta los días en ella). */
export function fechaEn(zona, ms = Date.now()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: zona || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
  catch { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
}
/** La hora (0–23) de un instante en esa zona. */
export function horaEn(zona, ms = Date.now()) {
  try { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: zona || undefined, hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms))); }
  catch { return new Date(ms).getHours(); }
}
export function sumarDias(fecha, n) { const [y, m, d] = fecha.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); }
export function diasEntre(desde, hasta) { const out = []; for (let f = desde; f <= hasta && out.length < 400; f = sumarDias(f, 1)) out.push(f); return out; }

export const RANGOS = ['hoy', '7d', '30d', 'mes'];
/** Los rangos del panel, desde «hoy» en la zona de la cuenta. `previo7` es la semana anterior a los últimos 7 días (para la tendencia). */
export function rangos(hoy) {
  return { hoy: [hoy, hoy], '7d': [sumarDias(hoy, -6), hoy], '30d': [sumarDias(hoy, -29), hoy], mes: [hoy.slice(0, 8) + '01', hoy], previo7: [sumarDias(hoy, -13), sumarDias(hoy, -7)] };
}

// ---------------------------------------------------------------- dinero

// Meta guarda los importes en la unidad menor de la moneda («offset» 100 en USD). Estas monedas no tienen decimales en Meta (offset 1).
// POR VERIFICAR la lista contra developers.facebook.com/docs/marketing-api/currencies: la cuenta de PanaClaw es USD (plan §2.2).
const SIN_DECIMALES = new Set(['CLP', 'COP', 'CRC', 'HUF', 'ISK', 'IDR', 'JPY', 'KRW', 'PYG', 'TWD', 'VND']);
export const offsetDe = moneda => (SIN_DECIMALES.has(String(moneda || '').toUpperCase()) ? 1 : 100);
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = v => (v === null ? null : Math.round(v * 100) / 100);
/** Un importe de Meta (centavos, en texto) → en la moneda. 0 o vacío en un presupuesto/tope = «no tiene» (null) si `ceroEsNada`. */
export function deMeta(v, moneda = 'USD', { ceroEsNada = false } = {}) { const n = num(v); if (n === null || (ceroEsNada && n === 0)) return null; return r2(n / offsetDe(moneda)); }
/** En la moneda → lo que Meta espera (entero, unidad menor). */
export const aMeta = (usd, moneda = 'USD') => Math.round(Number(usd) * offsetDe(moneda));

// ---------------------------------------------------------------- estados en palabras

export const ESTADO_TEXTO = {
  ACTIVE: 'Activa', PAUSED: 'En pausa', CAMPAIGN_PAUSED: 'Pausada por su campaña', ADSET_PAUSED: 'Pausada por su conjunto',
  PENDING_REVIEW: 'En revisión de Meta', DISAPPROVED: 'Rechazado por Meta', WITH_ISSUES: 'Con problemas', IN_PROCESS: 'Procesando',
  ARCHIVED: 'Archivada', DELETED: 'Borrada', PREAPPROVED: 'Aprobado, espera a su campaña', PENDING_BILLING_INFO: 'Falta el método de pago',
};
export const estadoTexto = e => ESTADO_TEXTO[e] || (e ? String(e) : 'Sin estado');
/** Lo que está entregando (o va a entregar en cuanto Meta lo apruebe). */
export const estaActivo = e => e === 'ACTIVE';
export const conProblema = e => e === 'DISAPPROVED' || e === 'WITH_ISSUES';

// Verificado el 8 oct 2026 (plan §13.5, referencia AdCampaignLearningStageInfo): LEARNING · SUCCESS · FAIL.
export const APRENDIZAJE_TEXTO = { LEARNING: 'Aprendiendo', SUCCESS: 'Fuera del aprendizaje', FAIL: 'Aprendizaje limitado' };
export function aprendizaje(info) {
  const estado = ['LEARNING', 'SUCCESS', 'FAIL'].includes(info?.status) ? info.status : null;
  return { estado, texto: estado ? APRENDIZAJE_TEXTO[estado] : 'Sin dato', conversiones: num(info?.conversions) };
}

// account_status de la cuenta publicitaria (referencia AdAccount). nivel: lo que pinta la franja de arriba.
export const CUENTA_ESTADO = {
  1: { texto: 'Activa', nivel: 'ok' }, 2: { texto: 'Desactivada', nivel: 'bad' }, 3: { texto: 'Con un pago pendiente', nivel: 'bad' },
  7: { texto: 'En revisión de riesgo de Meta', nivel: 'warn' }, 8: { texto: 'Pendiente de liquidar', nivel: 'bad' }, 9: { texto: 'En período de gracia', nivel: 'warn' },
  100: { texto: 'Cierre pendiente', nivel: 'bad' }, 101: { texto: 'Cerrada', nivel: 'bad' }, 201: { texto: 'Activa', nivel: 'ok' }, 202: { texto: 'Cerrada', nivel: 'bad' },
};
export const cuentaEstado = n => CUENTA_ESTADO[Number(n)] || { texto: n == null ? 'Sin dato' : `Estado ${n}`, nivel: n == null ? 'info' : 'warn' };

// ---------------------------------------------------------------- la etiqueta de la oficina

const ETIQUETA = /\s*·\s*AO:([A-Za-z0-9_-]{1,40})\s*$/;
/** «Mensajes Panamá · AO:b12» → { nombre: 'Mensajes Panamá', borrador: 'b12', creadoFuera: false }. Sin la etiqueta, se creó fuera. */
export function etiqueta(nombre) {
  const m = ETIQUETA.exec(String(nombre || ''));
  return m ? { nombre: String(nombre).replace(ETIQUETA, '').trim(), borrador: m[1], creadoFuera: false } : { nombre: String(nombre || ''), borrador: null, creadoFuera: true };
}
export const conEtiqueta = (nombre, borrador) => `${String(nombre || '').replace(ETIQUETA, '').trim()} · AO:${borrador}`;

// ---------------------------------------------------------------- qué es un resultado

// Los tipos de acción que Meta da en `actions` de las cifras. Dentro de un tipo, la lista va por prioridad y se toma el PRIMERO que
// aparezca (no se suman: `purchase`, `omni_purchase` y `offsite_conversion.fb_pixel_purchase` cuentan las mismas compras).
export const RESULTADOS = {
  mensajes: { texto: 'conversaciones iniciadas', acciones: ['onsite_conversion.messaging_conversation_started_7d'] },
  clics: { texto: 'clics al enlace', campo: 'inline_link_clicks', acciones: ['link_click'] },
  compras: { texto: 'compras', acciones: ['offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase'] },
  contactos: { texto: 'contactos', acciones: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'] },
  alcance: { texto: 'personas alcanzadas', campo: 'reach', porMil: true },
  // POR VERIFICAR: el tipo de acción de «visitas al perfil de Instagram» en las cifras de v26. Sin él, el resultado queda null.
  perfil: { texto: 'visitas al perfil', acciones: ['onsite_conversion.ig_profile_visit', 'instagram_profile_visit'], dudoso: true },
  interacciones: { texto: 'interacciones', acciones: ['post_engagement'] },
  instalaciones: { texto: 'instalaciones de la app', acciones: ['mobile_app_install', 'app_install'] },
};
const DESTINOS_MENSAJES = new Set(['MESSENGER', 'WHATSAPP', 'INSTAGRAM_DIRECT', 'MESSAGING_MESSENGER_WHATSAPP', 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER', 'MESSAGING_INSTAGRAM_DIRECT_WHATSAPP', 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP']);
export const OBJETIVO_TEXTO = {
  OUTCOME_ENGAGEMENT: 'Interacción', OUTCOME_TRAFFIC: 'Tráfico', OUTCOME_SALES: 'Ventas', OUTCOME_LEADS: 'Clientes potenciales',
  OUTCOME_AWARENESS: 'Reconocimiento', OUTCOME_APP_PROMOTION: 'Promoción de la app',
};
export const objetivoTexto = o => OBJETIVO_TEXTO[o] || (o ? String(o) : 'Sin objetivo');

/** La clave de RESULTADOS para un objetivo de campaña y (si se sabe) la optimización y el destino del conjunto. null = no se sabe. */
export function resultadoDe(objetivo, { optimizacion = '', destino = '' } = {}) {
  if (objetivo === 'OUTCOME_SALES') return 'compras';
  if (objetivo === 'OUTCOME_LEADS') return 'contactos';
  if (objetivo === 'OUTCOME_APP_PROMOTION') return 'instalaciones';
  if (objetivo === 'OUTCOME_AWARENESS') return 'alcance';
  if (DESTINOS_MENSAJES.has(destino) || optimizacion === 'CONVERSATIONS') return 'mensajes';
  if (destino === 'INSTAGRAM_PROFILE' || optimizacion === 'VISIT_INSTAGRAM_PROFILE') return 'perfil';
  if (objetivo === 'OUTCOME_TRAFFIC') return 'clics';
  if (objetivo === 'OUTCOME_ENGAGEMENT') return 'interacciones';
  return null;
}

// ---------------------------------------------------------------- las cifras

/** Las acciones de un conjunto de filas, sumadas por tipo. */
function sumaAcciones(filas) {
  const t = {};
  for (const f of filas) for (const a of Array.isArray(f.actions) ? f.actions : []) { const v = num(a?.value); if (a?.action_type && v !== null) t[a.action_type] = (t[a.action_type] || 0) + v; }
  return t;
}

/**
 * Las cifras de un objeto (o de la cuenta) a partir de sus filas diarias de insights.
 * @param {Array} filas   filas de `GET /act_…/insights?level=ad&time_increment=1` de ese objeto y rango
 * @param {string|null} clave  la de RESULTADOS (resultadoDe)
 * @param {object} o  { alcance: número de personas únicas del rango si se leyó aparte (Meta no deja sumar el alcance de varios días),
 *                      hayDatos: si las cifras se llegaron a leer (sin eso, todo null; con eso y sin filas, ceros: no entregó) }
 */
export function cifras(filas = [], clave = null, { alcance = null, hayDatos = true } = {}) {
  const tipo = clave ? RESULTADOS[clave] : null;
  const vacio = { gasto: null, impresiones: null, alcance: null, frecuencia: null, clics: null, clicsEnlace: null, ctr: null, cpc: null, cpm: null, resultados: null, resultadoTexto: tipo?.texto || 'resultados', costoPorResultado: null, costoPor: tipo?.porMil ? 'mil' : 'resultado' };
  if (!hayDatos) return vacio;
  const suma = k => filas.reduce((s, f) => s + (num(f[k]) || 0), 0);
  const gasto = r2(suma('spend')), impresiones = suma('impressions'), clics = suma('clicks');
  const acc = sumaAcciones(filas);
  const clicsEnlace = filas.some(f => num(f.inline_link_clicks) !== null) ? suma('inline_link_clicks') : (acc.link_click ?? 0);
  // El alcance no se suma entre días (la misma persona cuenta una vez): se usa el leído aparte; con una sola fila, el suyo; sin filas, 0.
  const alc = num(alcance) !== null ? num(alcance) : filas.length === 1 ? num(filas[0].reach) : filas.length === 0 ? 0 : null;
  let resultados = null;
  if (tipo?.campo === 'reach') resultados = alc;
  else if (tipo?.campo === 'inline_link_clicks' && filas.some(f => num(f.inline_link_clicks) !== null)) resultados = clicsEnlace; // el campo propio manda sobre la acción
  else if (tipo) {
    const hallado = (tipo.acciones || []).find(a => acc[a] !== undefined);
    if (hallado) resultados = acc[hallado];
    else if (tipo.campo) resultados = tipo.campo === 'inline_link_clicks' ? clicsEnlace : null;
    else resultados = tipo.dudoso ? null : 0; // Meta no manda las acciones en cero: sin la acción, fueron 0 (salvo un tipo sin verificar)
  }
  const div = (a, b, k = 1) => (a === null || !b ? null : r2((a / b) * k));
  return {
    gasto, impresiones, alcance: alc, frecuencia: alc ? Math.round((impresiones / alc) * 100) / 100 : null, clics, clicsEnlace,
    ctr: div(clics, impresiones, 100), cpc: div(gasto, clics), cpm: div(gasto, impresiones, 1000),
    resultados, resultadoTexto: tipo?.texto || 'resultados', costoPorResultado: resultados ? div(gasto, resultados, tipo?.porMil ? 1000 : 1) : null, costoPor: tipo?.porMil ? 'mil' : 'resultado',
  };
}

// ---------------------------------------------------------------- el público en palabras

const PAISES = { PA: 'Panamá', CR: 'Costa Rica', CO: 'Colombia', US: 'Estados Unidos', MX: 'México', VE: 'Venezuela', ES: 'España', DO: 'República Dominicana', GT: 'Guatemala', SV: 'El Salvador', HN: 'Honduras', NI: 'Nicaragua', EC: 'Ecuador', PE: 'Perú', CL: 'Chile', AR: 'Argentina' };
/** «Panamá · 18+ · Advantage+», o lo que se pueda decir de la segmentación. */
export function publicoTexto(t) {
  if (!t || typeof t !== 'object') return 'Sin datos del público';
  const out = [], g = t.geo_locations || {};
  const lugares = [...(g.countries || []).map(c => PAISES[c] || c), ...(g.cities || []).slice(0, 3).map(c => c.name || c.key), ...(g.regions || []).slice(0, 3).map(r => r.name || r.key)];
  if (lugares.length) out.push(lugares.slice(0, 4).join(', ') + (lugares.length > 4 ? ` y ${lugares.length - 4} más` : ''));
  for (const c of (g.custom_locations || []).slice(0, 2)) out.push(`radio de ${c.radius ?? '?'} ${c.distance_unit === 'mile' ? 'mi' : 'km'}`);
  const min = num(t.age_min), max = num(t.age_max);
  if (min !== null || max !== null) out.push(max !== null && max < 65 ? `${min ?? 18}–${max}` : `${min ?? 18}+`);
  const gen = t.genders || []; if (gen.length === 1) out.push(gen[0] === 1 ? 'hombres' : 'mujeres');
  const intereses = (t.flexible_spec || []).reduce((s, x) => s + (x.interests?.length || 0) + (x.behaviors?.length || 0), 0) + (t.interests?.length || 0);
  if (intereses) out.push(`${intereses} interés(es)`);
  if (t.custom_audiences?.length) out.push(`${t.custom_audiences.length} público(s) propio(s)`);
  if (t.targeting_automation?.advantage_audience === 1) out.push('Advantage+');
  return out.length ? out.join(' · ') : 'Sin datos del público';
}

const presupuesto = (x, moneda) => {
  const d = deMeta(x?.daily_budget, moneda, { ceroEsNada: true }), l = deMeta(x?.lifetime_budget, moneda, { ceroEsNada: true });
  return d !== null ? { tipo: 'diario', usd: d } : l !== null ? { tipo: 'total', usd: l } : { tipo: null, usd: null };
};
const motivosRevision = fb => { // ad_review_feedback: { global: { 'Título de la política': 'por qué' }, placement_specific: {…} }
  const out = []; for (const grupo of Object.values(fb || {})) if (grupo && typeof grupo === 'object') for (const [k, v] of Object.entries(grupo)) out.push(typeof v === 'string' && v ? `${k}: ${v}` : k);
  return out.slice(0, 6);
};
const problemas = info => (Array.isArray(info) ? info : []).map(i => i?.error_message || i?.error_summary || '').filter(Boolean).slice(0, 6);
function creativoDe(c) {
  const s = c?.object_story_spec || {}, ld = s.link_data || {}, vd = s.video_data || {};
  return { id: c?.id || null, miniatura: c?.thumbnail_url || c?.image_url || ld.picture || vd.image_url || null, texto: c?.body || ld.message || vd.message || null, titulo: c?.title || ld.name || vd.title || null, llamada: c?.call_to_action_type || ld.call_to_action?.type || vd.call_to_action?.type || null };
}

// ---------------------------------------------------------------- la vista que contesta GET /api/anuncios

/**
 * Junta la estructura guardada, las filas diarias y los alcances en lo que pinta el panel (el contrato de /api/anuncios).
 * @param {object} o
 * @param {object|null} o.guardado  data/anuncios/cuenta.json → { cuenta, campanas, conjuntos, anuncios, creativos, sincronizadaAt }
 * @param {Array}  o.filas          filas diarias (level=ad) de los días que hacen falta
 * @param {object} o.alcances       data/anuncios/alcance.json → { rangos: { hoy: { desde, hasta, account, campaign: {id: n}, adset, ad } } }
 * @param {string} o.rango          hoy · 7d · 30d · mes
 * @param {string} o.hoy            'AAAA-MM-DD' en la zona de la cuenta
 * @param {object} o.topes          { diario, mensual, campana } en la moneda
 * @param {boolean} o.hayCifras     si alguna vez se leyeron las cifras
 */
export function armarVista({ guardado = null, filas = [], alcances = {}, rango = '7d', hoy, topes = {}, hayCifras = false } = {}) {
  const R = rangos(hoy), [desde, hasta] = R[rango] || R['7d'];
  const g = guardado || {}, cta = g.cuenta || null, moneda = cta?.currency || 'USD';
  const entre = (a, b) => filas.filter(f => f.date_start >= a && f.date_start <= b);
  const delRango = entre(desde, hasta);
  const alc = (nivel, id) => { const a = alcances?.rangos?.[rango]; return a && a.desde === desde && a.hasta === hasta ? (nivel === 'account' ? a.account : a[nivel]?.[id]) ?? null : null; };
  const conjuntosDe = id => (g.conjuntos || []).filter(s => s.campaign_id === id);
  const creativos = new Map((g.creativos || []).map(c => [c.id, c]));
  const tipoConjunto = (s, camp) => resultadoDe(camp?.objective, { optimizacion: s.optimization_goal, destino: s.destination_type });
  const tipoCampana = camp => { const ts = [...new Set(conjuntosDe(camp.id).map(s => tipoConjunto(s, camp)))]; return ts.length === 1 ? ts[0] : resultadoDe(camp.objective); };

  const campanas = (g.campanas || []).map(camp => {
    const e = etiqueta(camp.name), tc = tipoCampana(camp);
    const conjuntos = conjuntosDe(camp.id).map(s => {
      const ts = tipoConjunto(s, camp), es = etiqueta(s.name);
      const anuncios = (g.anuncios || []).filter(a => a.adset_id === s.id).map(a => {
        const ea = etiqueta(a.name), cre = a.creative?.id ? { ...creativos.get(a.creative.id), ...a.creative } : null;
        return { id: a.id, nombre: ea.nombre, creadoFuera: ea.creadoFuera, estado: a.effective_status || a.status || null, estadoTexto: estadoTexto(a.effective_status || a.status), revision: motivosRevision(a.ad_review_feedback), problemas: problemas(a.issues_info), creativo: creativoDe(cre), cifras: cifras(delRango.filter(f => f.ad_id === a.id), ts, { alcance: alc('ad', a.id), hayDatos: hayCifras }) };
      });
      return { id: s.id, nombre: es.nombre, creadoFuera: es.creadoFuera, optimizacion: s.optimization_goal || null, destino: s.destination_type || null, estado: s.effective_status || s.status || null, estadoTexto: estadoTexto(s.effective_status || s.status), aprendizaje: aprendizaje(s.learning_stage_info), presupuesto: presupuesto(s, moneda), publico: publicoTexto(s.targeting), inicio: s.start_time || null, fin: s.end_time || null, problemas: problemas(s.issues_info), cifras: cifras(delRango.filter(f => f.adset_id === s.id), ts, { alcance: alc('adset', s.id), hayDatos: hayCifras }), anuncios };
    });
    return { id: camp.id, nombre: e.nombre, objetivo: camp.objective || null, objetivoTexto: objetivoTexto(camp.objective), estado: camp.effective_status || camp.status || null, estadoTexto: estadoTexto(camp.effective_status || camp.status), creadoFuera: e.creadoFuera, presupuesto: presupuesto(camp, moneda), spendCap: deMeta(camp.spend_cap, moneda, { ceroEsNada: true }), estrategia: camp.bid_strategy || null, inicio: camp.start_time || null, fin: camp.stop_time || null, resultado: tc, cifras: cifras(delRango.filter(f => f.campaign_id === camp.id), tc, { alcance: alc('campaign', camp.id), hayDatos: hayCifras }), conjuntos };
  });

  // lo gastado (de las filas, que ya vienen en la moneda)
  const gastoDe = ([a, b]) => (hayCifras ? r2(entre(a, b).reduce((s, f) => s + (num(f.spend) || 0), 0)) : null);
  const gasto = { hoy: gastoDe(R.hoy), semana: gastoDe(R['7d']), mes: gastoDe(R.mes) };

  // el resumen de 7 días: los resultados del tipo con más gasto (sumar conversaciones con clics no dice nada)
  const porTipo = filasR => {
    const t = {};
    for (const camp of g.campanas || []) { const k = tipoCampana(camp); if (!k) continue; const fs = filasR.filter(f => f.campaign_id === camp.id); (t[k] ||= []).push(...fs); }
    return t;
  };
  const t7 = porTipo(entre(...R['7d'])), tPrev = porTipo(entre(...R.previo7));
  const dominante = Object.entries(t7).sort((a, b) => b[1].reduce((s, f) => s + (num(f.spend) || 0), 0) - a[1].reduce((s, f) => s + (num(f.spend) || 0), 0))[0]?.[0] || null;
  const c7 = dominante && hayCifras ? cifras(t7[dominante], dominante, { alcance: dominante === 'alcance' ? alc('account') : null }) : null;
  const cPrev = dominante && hayCifras ? cifras(tPrev[dominante] || [], dominante) : null;
  const hayPrevio = entre(...R.previo7).length > 0;
  const gPrev = gastoDe(R.previo7);
  const pct = (a, b) => (a === null || b === null || !b ? null : Math.round(((a - b) / b) * 1000) / 10);
  const resumen = {
    resultados7d: c7?.resultados ?? null, costoPorResultado7d: c7?.costoPorResultado ?? null, resultadoTexto: c7?.resultadoTexto || (dominante ? RESULTADOS[dominante].texto : 'resultados'),
    tendencia: { gasto: hayPrevio ? pct(gasto.semana, gPrev) : null, resultados: hayPrevio && dominante !== 'alcance' ? pct(c7?.resultados ?? null, cPrev?.resultados ?? null) : null },
  };

  // la franja de arriba
  const avisos = [];
  if (cta) {
    const ce = cuentaEstado(cta.account_status);
    if (ce.nivel !== 'ok') avisos.push({ nivel: ce.nivel, texto: `La cuenta publicitaria está: ${ce.texto.toLowerCase()}. Mientras tanto Meta no entrega anuncios: revísala en el Administrador de anuncios → Facturación.` });
    if (cta.currency && cta.currency !== 'USD') avisos.push({ nivel: 'info', texto: `La cuenta va en ${cta.currency}, no en USD: los topes de la oficina se leen en esa moneda.` });
  }
  const todos = campanas.flatMap(c => c.conjuntos.flatMap(s => s.anuncios));
  const rech = todos.filter(a => a.estado === 'DISAPPROVED'), prob = todos.filter(a => a.estado === 'WITH_ISSUES');
  if (rech.length) avisos.push({ nivel: 'bad', texto: `Meta rechazó ${rech.length === 1 ? 'un anuncio' : rech.length + ' anuncios'}: ${rech.slice(0, 3).map(a => `«${a.nombre}»${a.revision[0] ? ` (${a.revision[0]})` : ''}`).join(', ')}.` });
  if (prob.length) avisos.push({ nivel: 'warn', texto: `${prob.length === 1 ? 'Un anuncio tiene' : prob.length + ' anuncios tienen'} problemas: ${prob.slice(0, 3).map(a => `«${a.nombre}»${a.problemas[0] ? ` (${a.problemas[0]})` : ''}`).join(', ')}.` });
  const tope = (v, t, que) => { if (v === null || t == null) return; if (t > 0 ? v >= 0.9 * t : v > 0) avisos.push({ nivel: v >= t ? 'bad' : 'warn', texto: `El gasto ${que} va en ${moneda === 'USD' ? 'US$' : moneda + ' '}${v.toFixed(2)} de un tope de ${t.toFixed(2)} (${t > 0 ? Math.round((v / t) * 100) : '∞'} %).` }); };
  tope(gasto.hoy, topes.diario, 'de hoy'); tope(gasto.mes, topes.mensual, 'del mes');

  return {
    cuenta: cta ? { id: cta.id || null, nombre: cta.name || null, estado: num(cta.account_status), estadoTexto: cuentaEstado(cta.account_status).texto, moneda, zona: cta.timezone_name || null, gastado: deMeta(cta.amount_spent, moneda), spendCap: deMeta(cta.spend_cap, moneda, { ceroEsNada: true }), saldo: deMeta(cta.balance, moneda) } : null,
    rango, desde, hasta, gasto, avisos, resumen, campanas,
  };
}

/** Un objeto de la vista por su id: { tipo: 'campana'|'conjunto'|'anuncio', objeto, campana?, conjunto? } o null. */
export function buscar(vista, id) {
  for (const c of vista?.campanas || []) {
    if (c.id === id) return { tipo: 'campana', objeto: c };
    for (const s of c.conjuntos) {
      if (s.id === id) return { tipo: 'conjunto', objeto: s, campana: c };
      for (const a of s.anuncios) if (a.id === id) return { tipo: 'anuncio', objeto: a, conjunto: s, campana: c };
    }
  }
  return null;
}

// ---------------------------------------------------------------- en palabras (Dimitri, los agentes, el asistente)

const usd = (v, moneda = 'USD') => (v === null || v === undefined ? 'sin dato' : `${moneda === 'USD' ? 'US$' : moneda + ' '}${Number(v).toFixed(2)}`);
const n0 = v => (v === null || v === undefined ? 'sin dato' : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
export const RANGO_TEXTO = { hoy: 'hoy', '7d': 'los últimos 7 días', '30d': 'los últimos 30 días', mes: 'este mes' };
/** «12 conversaciones iniciadas a US$1,40» — o por qué no hay cifra. */
export function resultadoTexto(c, moneda = 'USD') {
  if (!c || c.gasto === null) return 'sin cifras todavía';
  const res = c.resultados === null ? `${c.resultadoTexto}: sin dato` : `${n0(c.resultados)} ${c.resultadoTexto}${c.costoPorResultado !== null ? ` a ${usd(c.costoPorResultado, moneda)}${c.costoPor === 'mil' ? ' cada mil' : ''}` : ''}`;
  return `gastó ${usd(c.gasto, moneda)} · ${res}${c.ctr !== null ? ` · CTR ${c.ctr} %` : ''}${c.frecuencia !== null ? ` · frecuencia ${c.frecuencia}` : ''}`;
}
/** Una línea por objeto, con su id (nunca se adivina un id). */
export function lineaObjeto(tipo, o, moneda = 'USD') {
  const pres = o.presupuesto?.usd != null ? ` · presupuesto ${o.presupuesto.tipo} ${usd(o.presupuesto.usd, moneda)}` : '';
  const extra = tipo === 'conjunto' ? ` · ${o.aprendizaje?.texto || 'sin dato de aprendizaje'}${o.aprendizaje?.conversiones != null ? ` (${o.aprendizaje.conversiones} conversiones)` : ''} · público: ${o.publico}` : tipo === 'campana' ? ` · objetivo ${o.objetivoTexto}${o.spendCap != null ? ` · tope en Meta ${usd(o.spendCap, moneda)}` : ''}` : '';
  const prob = [...(o.revision || []), ...(o.problemas || [])];
  return `${o.id} · «${o.nombre}»${o.creadoFuera ? ' (creado fuera de la oficina)' : ''} · ${o.estadoTexto}${pres}${extra} · ${resultadoTexto(o.cifras, moneda)}${prob.length ? ` · PROBLEMA: ${prob.slice(0, 2).join('; ')}` : ''}`;
}
/** La cuenta, el gasto contra los topes y el resumen. */
export function textoCuenta(v, { topes = {} } = {}) {
  const c = v?.cuenta; if (!c) return 'Anuncios: todavía no se leyó la cuenta publicitaria.';
  const m = c.moneda;
  return [`Cuenta publicitaria ${c.id} «${c.nombre || ''}»: ${c.estadoTexto} · ${m} · ${c.zona || 'zona sin dato'}${c.spendCap != null ? ` · límite de gasto en Meta ${usd(c.spendCap, m)}` : ''}`,
    `Gasto: hoy ${usd(v.gasto?.hoy, m)}${topes.diario != null ? ` (tope ${usd(topes.diario, m)})` : ''} · 7 días ${usd(v.gasto?.semana, m)} · este mes ${usd(v.gasto?.mes, m)}${topes.mensual != null ? ` (tope ${usd(topes.mensual, m)})` : ''}`,
    `Últimos 7 días: ${v.resumen?.resultados7d == null ? `${v.resumen?.resultadoTexto || 'resultados'}: sin dato` : `${n0(v.resumen.resultados7d)} ${v.resumen.resultadoTexto}${v.resumen.costoPorResultado7d != null ? ` a ${usd(v.resumen.costoPorResultado7d, m)}` : ''}`}${v.resumen?.tendencia?.gasto != null ? ` · gasto ${v.resumen.tendencia.gasto > 0 ? '+' : ''}${v.resumen.tendencia.gasto} % frente a la semana anterior` : ''}`,
    ...(v.avisos || []).map(a => `AVISO (${a.nivel}): ${a.texto}`)].join('\n');
}
/** Las campañas (con sus conjuntos y anuncios hasta `nivel`), filtradas por estado: activas · pausadas · problemas · todas. */
export function textoCampanas(v, { nivel = 'conjunto', estado = 'todas' } = {}) {
  const m = v?.cuenta?.moneda || 'USD';
  const pasa = c => estado === 'todas' || (estado === 'activas' ? c.estado === 'ACTIVE' : estado === 'pausadas' ? c.estado !== 'ACTIVE' : c.conjuntos.some(s => s.anuncios.some(a => conProblema(a.estado))));
  const sel = (v?.campanas || []).filter(pasa);
  if (!sel.length) return `No hay campañas${estado !== 'todas' ? ` ${estado}` : ''}.`;
  const out = [`Campañas (${sel.length}), cifras de ${RANGO_TEXTO[v.rango] || v.rango} (${v.desde} a ${v.hasta}):`];
  for (const c of sel.slice(0, 30)) {
    out.push('- CAMPAÑA ' + lineaObjeto('campana', c, m));
    if (nivel === 'campana') continue;
    for (const s of c.conjuntos) {
      out.push('  - CONJUNTO ' + lineaObjeto('conjunto', s, m));
      if (nivel === 'anuncio') for (const a of s.anuncios) out.push('    - ANUNCIO ' + lineaObjeto('anuncio', a, m) + (a.creativo?.texto ? ` · texto: «${String(a.creativo.texto).replace(/\s+/g, ' ').slice(0, 120)}»` : ''));
    }
  }
  return out.join('\n');
}
/** Un objeto entero, con lo de arriba y lo de abajo. */
export function textoObjeto(v, id) {
  const r = buscar(v, id); if (!r) return `No hay ninguna campaña, conjunto ni anuncio con el id ${id}.`;
  const m = v?.cuenta?.moneda || 'USD', o = r.objeto, c = o.cifras;
  const out = [`${r.tipo.toUpperCase()} ${lineaObjeto(r.tipo, o, m)}`];
  if (r.campana && r.tipo !== 'campana') out.push(`En la campaña ${r.campana.id} «${r.campana.nombre}» (${r.campana.objetivoTexto}, ${r.campana.estadoTexto})`);
  if (r.conjunto) out.push(`En el conjunto ${r.conjunto.id} «${r.conjunto.nombre}» (${r.conjunto.aprendizaje.texto}, ${r.conjunto.publico})`);
  if (c && c.gasto !== null) out.push(`Cifras de ${RANGO_TEXTO[v.rango] || v.rango}: gasto ${usd(c.gasto, m)} · impresiones ${n0(c.impresiones)} · alcance ${n0(c.alcance)} · clics ${n0(c.clics)} (al enlace ${n0(c.clicsEnlace)}) · CTR ${c.ctr ?? 'sin dato'} % · CPC ${usd(c.cpc, m)} · CPM ${usd(c.cpm, m)} · ${c.resultados === null ? 'resultados sin dato' : `${n0(c.resultados)} ${c.resultadoTexto}`}${c.costoPorResultado !== null ? ` a ${usd(c.costoPorResultado, m)}` : ''}`);
  if (r.tipo === 'anuncio') { const k = o.creativo || {}; out.push(`Creativo: ${k.titulo ? `«${k.titulo}» · ` : ''}${k.texto ? `texto «${String(k.texto).slice(0, 400)}»` : 'sin texto leído'}${k.llamada ? ` · botón ${k.llamada}` : ''}`); if (o.revision.length) out.push(`Por qué lo rechazó Meta: ${o.revision.join('; ')}`); if (o.problemas.length) out.push(`Problemas: ${o.problemas.join('; ')}`); }
  if (r.tipo === 'campana') for (const s of o.conjuntos) out.push('- CONJUNTO ' + lineaObjeto('conjunto', s, m));
  if (r.tipo === 'conjunto') for (const a of o.anuncios) out.push('- ANUNCIO ' + lineaObjeto('anuncio', a, m));
  return out.join('\n');
}
