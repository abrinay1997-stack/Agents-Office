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
  // A2 (9 oct 2026): de un presupuesto total, lo que le queda por gastar (`budget_remaining`), para los topes (anuncios/topes.mjs)
  return d !== null ? { tipo: 'diario', usd: d } : l !== null ? { tipo: 'total', usd: l, restante: deMeta(x?.budget_remaining, moneda) } : { tipo: null, usd: null };
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
/**
 * El crédito que queda de verdad, solo si se sabe: el tope de gasto de la cuenta (spend_cap) menos lo ya gastado. Sin tope de cuenta
 * no hay dato (el `balance` de Meta es lo que se DEBE, no lo que queda) y devuelve null: nunca se inventa.
 */
export function creditoDisponible(gastado, spendCap) { return gastado === null || gastado === undefined || spendCap === null || spendCap === undefined ? null : Math.max(0, r2(spendCap - gastado)); }
/** El aviso (solo aviso: nunca cambia ni gasta nada) de que lo que queda no alcanza para un día del tope diario; null si no se sabe o alcanza. */
export function avisoCredito(disponible, topeDiario, moneda = 'USD') {
  if (disponible === null || disponible === undefined || !(topeDiario > 0) || disponible >= topeDiario) return null;
  const m = moneda === 'USD' ? 'US$' : moneda + ' ';
  return `Al tope de gasto de la cuenta le quedan ${m}${disponible.toFixed(2)}, menos que un día del tope diario (${m}${topeDiario.toFixed(2)}): Meta puede dejar de entregar. Súbelo o revisa la facturación en el Administrador de anuncios.`;
}
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
    return { id: camp.id, nombre: e.nombre, objetivo: camp.objective || null, objetivoTexto: objetivoTexto(camp.objective), estado: camp.effective_status || camp.status || null, estadoTexto: estadoTexto(camp.effective_status || camp.status), creadoFuera: e.creadoFuera, presupuesto: presupuesto(camp, moneda), spendCap: deMeta(camp.spend_cap, moneda, { ceroEsNada: true }), estrategia: camp.bid_strategy || null, inicio: camp.start_time || null, fin: camp.stop_time || null, problemas: problemas(camp.issues_info), resultado: tc, cifras: cifras(delRango.filter(f => f.campaign_id === camp.id), tc, { alcance: alc('campaign', camp.id), hayDatos: hayCifras }), conjuntos };
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
    const ac = avisoCredito(creditoDisponible(deMeta(cta.amount_spent, moneda), deMeta(cta.spend_cap, moneda, { ceroEsNada: true })), topes.diario, moneda); if (ac) avisos.push({ nivel: 'warn', texto: ac });
    if (cta.currency && cta.currency !== 'USD') avisos.push({ nivel: 'info', texto: `La cuenta va en ${cta.currency}, no en USD: los topes de la oficina se leen en esa moneda.` });
  }
  const todos = campanas.flatMap(c => c.conjuntos.flatMap(s => s.anuncios));
  const rech = todos.filter(a => a.estado === 'DISAPPROVED'), prob = todos.filter(a => a.estado === 'WITH_ISSUES');
  if (rech.length) avisos.push({ nivel: 'bad', texto: `Meta rechazó ${rech.length === 1 ? 'un anuncio' : rech.length + ' anuncios'}: ${rech.slice(0, 3).map(a => `«${a.nombre}»${a.revision[0] ? ` (${a.revision[0]})` : ''}`).join(', ')}.` });
  if (prob.length) avisos.push({ nivel: 'warn', texto: `${prob.length === 1 ? 'Un anuncio tiene' : prob.length + ' anuncios tienen'} problemas: ${prob.slice(0, 3).map(a => `«${a.nombre}»${a.problemas[0] ? ` (${a.problemas[0]})` : ''}`).join(', ')}.` });
  const tope = (v, t, que) => { if (v === null || t == null) return; if (t > 0 ? v >= 0.9 * t : v > 0) avisos.push({ nivel: v >= t ? 'bad' : 'warn', texto: `El gasto ${que} va en ${moneda === 'USD' ? 'US$' : moneda + ' '}${v.toFixed(2)} de un tope de ${t.toFixed(2)} (${t > 0 ? Math.round((v / t) * 100) : '∞'} %).` }); };
  tope(gasto.hoy, topes.diario, 'de hoy'); tope(gasto.mes, topes.mensual, 'del mes');

  return {
    cuenta: cta ? { id: cta.id || null, nombre: cta.name || null, estado: num(cta.account_status), estadoTexto: cuentaEstado(cta.account_status).texto, moneda, zona: cta.timezone_name || null, gastado: deMeta(cta.amount_spent, moneda), spendCap: deMeta(cta.spend_cap, moneda, { ceroEsNada: true }), saldo: deMeta(cta.balance, moneda), porPagar: deMeta(cta.balance, moneda), disponible: creditoDisponible(deMeta(cta.amount_spent, moneda), deMeta(cta.spend_cap, moneda, { ceroEsNada: true })) } : null,
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

// ================================================================ Fase A3 (9 oct 2026): EL BORRADOR DE CAMPAÑA
// Lo que el dueño (el asistente de 5 pasos del panel), `ada` (anuncios-mcp.mjs) o Dimitri (op `anuncio_borrador`) preparan EN LA OFICINA.
// Nada de esto toca Meta: crearlo allí, EN PAUSA, es anuncios/crear.mjs, con el clic del dueño; activarlo es la acción de gasto de la A2.
// La forma (el contrato con la página, plan §5 A3):
//   { id, nombre, de: 'dueno'|'dimitri'|'asistente'|'agente:<id>', creadoAt, actualizadoAt, estado: 'borrador'|'creando'|'creado'|'fallo',
//     objetivo: 'mensajes'|'web'|'ventas'|'contactos'|'conocer', destino: 'whatsapp'|'instagram'|'messenger'|null,
//     publico: { modo: 'advantage'|'manual', paises: ['PA'], radio: { lat, lng, km }|null, edadMin: 18, edadMax: null|n, intereses: [] },
//     categoriaEspecial: null|'HOUSING'|'EMPLOYMENT'|'FINANCIAL_PRODUCTS_SERVICES'|'ISSUES_ELECTIONS_POLITICS',
//     presupuesto: { tipo: 'diario'|'total', usd }, inicio: ISO|null, fin: ISO|null, enlace: string|null,
//     creativos: [{ id, media, formato: '1:1'|'4:5'|'9:16'|null, texto, titular, descripcion, llamada }],
//     mejoras: { texto: false, retoques: true, recorte: true, plantilla: false },
//     validacion: { ok, problemas: [{ campo (la ruta: 'publico.paises', 'presupuesto.usd', 'creativos.2.media', 'meta'…), texto, nivel: 'error'|'aviso' }], at, costoMax: { dia, total, campana, sinLimite }, meta: { ok, texto }|null } | null,
//     meta: { campana, conjunto, creativos: [], anuncios: [] } | null, error: string|null, progreso: { paso, texto }|null,
//     origen: null | { tipo: 'publicacion', red: 'instagram'|'facebook', id: <id de Meta>, ref?, enlace, texto, miniatura, publicadaAt, pieza? } }
// Fase A4 (9 oct 2026): con `origen`, el borrador IMPULSA esa publicación: un solo creativo, que es la publicación misma (sin medios ni
// texto propios: solo se elige la llamada a la acción y el destino). anuncios/construir.mjs → cuerpoCreativo hace el creativo de Meta.

export const OBJETIVOS_BORRADOR = ['mensajes', 'web', 'ventas', 'contactos', 'conocer'];
export const OBJETIVO_BORRADOR_TEXTO = { mensajes: 'Que me escriban', web: 'Visitas a mi web', ventas: 'Ventas en mi web', contactos: 'Contactos', conocer: 'Que me conozcan' };
export const DESTINOS_BORRADOR = ['whatsapp', 'instagram', 'messenger'];
export const DESTINO_TEXTO = { whatsapp: 'WhatsApp', instagram: 'Instagram Direct', messenger: 'Messenger' };
export const CATEGORIAS_ESPECIALES = ['HOUSING', 'EMPLOYMENT', 'FINANCIAL_PRODUCTS_SERVICES', 'ISSUES_ELECTIONS_POLITICS'];
export const ESTADOS_BORRADOR = ['borrador', 'creando', 'creado', 'fallo'];
export const FORMATOS_CREATIVO = ['1:1', '4:5', '9:16'];
export const MEJORAS_DEFECTO = { texto: false, retoques: true, recorte: true, plantilla: false }; // plan §12: solo lo que no toca el texto de la marca
export const MAX_CREATIVOS = 10, CREATIVOS_RECOMENDADOS = [3, 6]; // buena práctica de Meta: 3 a 6 por conjunto
export const PRESUPUESTO_MINIMO_USD = 1; // el mínimo habitual al día (POR VERIFICAR por optimización, plan §13.14)
export const SPEND_CAP_MINIMO_USD = 100; // verificado el 9 oct 2026 (plan §13.2): Meta no acepta un spend_cap de campaña menor
export const RADIO_MINIMO_ESPECIAL_KM = 25; // POR VERIFICAR: el radio mínimo en categorías especiales
export const LINK_MENSAJES = 'https://fb.com/messenger_doc/'; // POR VERIFICAR: el `link` que Meta pide en link_data para Click to Messenger / Instagram Direct
export const LINK_WHATSAPP = 'https://api.whatsapp.com/send'; // plan §13.13 (búsquedas del 9 oct 2026): el link de un anuncio que abre WhatsApp
export const REDES_IMPULSAR = ['instagram', 'facebook']; // Fase A4: lo que se puede impulsar (plan §5 A4, verificado el 9 oct 2026)

/**
 * LA TABLA: objetivo de la oficina ↔ lo que Meta espera. `verificado` dice si la combinación está en el §13 del plan (lo demás, POR VERIFICAR
 * con `node scripts/check-meta-anuncios.mjs --crear-pausada`, que la prueba con validate_only). `llamadas`: los botones que la oficina
 * deja elegir (el primero es el de por defecto); `pide`: lo que hace falta en Ajustes o en el borrador.
 */
export const COMBINACIONES = {
  mensajes: {
    objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', resultado: 'mensajes', pide: [],
    porDestino: {
      // verificado (plan §13.13): destination_type, optimization_goal CONVERSATIONS, promoted_object {page_id} y call_to_action.value.app_destination.
      // POR VERIFICAR: los tipos de botón WHATSAPP_MESSAGE, INSTAGRAM_MESSAGE y MESSAGE_PAGE en v26 (el ejemplo oficial usa LEARN_MORE).
      whatsapp: { destination_type: 'WHATSAPP', app_destination: 'WHATSAPP', link: LINK_WHATSAPP, llamadas: ['WHATSAPP_MESSAGE', 'LEARN_MORE'], pide: ['whatsapp'], verificado: 'en parte' },
      instagram: { destination_type: 'INSTAGRAM_DIRECT', app_destination: 'INSTAGRAM_DIRECT', link: LINK_MENSAJES, llamadas: ['LEARN_MORE', 'INSTAGRAM_MESSAGE'], pide: ['instagram'], verificado: 'en parte' },
      messenger: { destination_type: 'MESSENGER', app_destination: 'MESSENGER', link: LINK_MENSAJES, llamadas: ['LEARN_MORE', 'MESSAGE_PAGE'], pide: [], verificado: 'en parte' },
    },
  },
  // POR VERIFICAR (las de abajo): optimization_goal, destination_type y promoted_object de tráfico, ventas, contactos y alcance en v26.
  web: { objective: 'OUTCOME_TRAFFIC', optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', destination_type: 'WEBSITE', resultado: 'clics', llamadas: ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'CONTACT_US', 'ORDER_NOW', 'GET_OFFER', 'BOOK_NOW'], pide: ['enlace'], verificado: false },
  ventas: { objective: 'OUTCOME_SALES', optimization_goal: 'OFFSITE_CONVERSIONS', billing_event: 'IMPRESSIONS', destination_type: 'WEBSITE', evento: 'PURCHASE', resultado: 'compras', llamadas: ['SHOP_NOW', 'ORDER_NOW', 'GET_OFFER', 'LEARN_MORE', 'BUY_NOW'], pide: ['pixel', 'enlace'], verificado: false },
  // «Contactos» con el formulario instantáneo de Meta necesita un formulario (leadgen) que la oficina todavía no crea: aquí, los contactos
  // que deja la web (el evento LEAD del píxel).
  contactos: { objective: 'OUTCOME_LEADS', optimization_goal: 'OFFSITE_CONVERSIONS', billing_event: 'IMPRESSIONS', destination_type: 'WEBSITE', evento: 'LEAD', resultado: 'contactos', llamadas: ['SIGN_UP', 'CONTACT_US', 'LEARN_MORE', 'GET_QUOTE', 'SUBSCRIBE'], pide: ['pixel', 'enlace'], verificado: false },
  conocer: { objective: 'OUTCOME_AWARENESS', optimization_goal: 'REACH', billing_event: 'IMPRESSIONS', destination_type: null, resultado: 'alcance', llamadas: ['LEARN_MORE', 'CONTACT_US', 'SHOP_NOW'], pide: [], verificado: false },
};
/** Lo que Meta espera para un objetivo (y su destino, si es de mensajes). null = esa combinación no existe en la oficina. */
export function combinacion(objetivo, destino = null) {
  const c = COMBINACIONES[objetivo]; if (!c) return null;
  if (!c.porDestino) return { objetivo, ...c };
  const d = c.porDestino[destino]; if (!d) return null;
  const { porDestino, ...base } = c;
  return { objetivo, destino, ...base, ...d, pide: [...base.pide, ...d.pide] };
}
/** Todas las combinaciones (para el check con validate_only y los tests). */
export const TODAS_LAS_COMBINACIONES = () => OBJETIVOS_BORRADOR.flatMap(o => (COMBINACIONES[o].porDestino ? DESTINOS_BORRADOR.map(d => combinacion(o, d)) : [combinacion(o)]));
export const LLAMADA_TEXTO = { WHATSAPP_MESSAGE: 'Enviar WhatsApp', INSTAGRAM_MESSAGE: 'Enviar mensaje', MESSAGE_PAGE: 'Enviar mensaje', LEARN_MORE: 'Más información', SHOP_NOW: 'Comprar', SIGN_UP: 'Registrarte', CONTACT_US: 'Contáctanos', ORDER_NOW: 'Pedir ahora', GET_OFFER: 'Obtener oferta', BOOK_NOW: 'Reservar', BUY_NOW: 'Comprar ya', GET_QUOTE: 'Pedir cotización', SUBSCRIBE: 'Suscribirte' };

// ---------------------------------------------------------------- normalizar (lo que llega de la página, de un agente o de Dimitri)

const texto = (v, n) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, n);
const entero = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };
const usdDe = v => { const n = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
const isoDe = v => { if (v === null || v === undefined || v === '') return null; const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${v}T00:00:00` : String(v)); return Number.isFinite(t) ? new Date(t).toISOString() : undefined; };
/** Un borrador que no se entiende (un objetivo que no existe…): 400, en palabras. */
export class ErrorBorrador extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const malo = msg => { throw new ErrorBorrador(msg); };
const nuevoId = (p, ahora) => `${p}${Math.round(ahora).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Un borrador nuevo con los valores por defecto del plan (§12): «que me escriban» por WhatsApp si hay número, si no por Instagram; Advantage+ en Panamá, 18+. */
export function borradorPorDefecto({ ajustes = {}, ahora = Date.now(), id = null, de = 'dueno' } = {}) {
  const at = new Date(ahora).toISOString();
  return { id: id || nuevoId('b', ahora), nombre: 'Campaña nueva', de, creadoAt: at, actualizadoAt: at, estado: 'borrador', objetivo: 'mensajes', destino: String(ajustes.whatsapp || '').trim() ? 'whatsapp' : 'instagram',
    publico: { modo: 'advantage', paises: ['PA'], radio: null, edadMin: 18, edadMax: null, intereses: [] }, categoriaEspecial: null,
    presupuesto: { tipo: 'diario', usd: 5 }, inicio: null, fin: null, enlace: null, creativos: [], mejoras: { ...MEJORAS_DEFECTO }, validacion: null, meta: null, error: null, progreso: null, origen: null };
}

/** Fase A4: la publicación que se impulsa, limpia. El id es el de Meta (IG: el del medio; FB: `<página>_<post>` o el del post). */
export function normOrigen(o) {
  if (!o || typeof o !== 'object') malo('La publicación que se impulsa no se entiende.');
  const red = String(o.red || '').toLowerCase();
  if (!REDES_IMPULSAR.includes(red)) malo('Solo se impulsan publicaciones de Instagram o de Facebook.');
  const id = String(o.id || '').trim();
  if (!/^[A-Za-z0-9]{1,30}(_[A-Za-z0-9]{1,30})?$/.test(id)) malo('Falta el id de Meta de la publicación (o no es un id de Meta).');
  const enlace = texto(o.enlace, 500), mini = texto(o.miniatura, 500), t = Date.parse(o.publicadaAt || '');
  return { tipo: 'publicacion', red, id, ...(o.ref ? { ref: texto(o.ref, 120) } : {}), enlace: /^https:\/\//.test(enlace) ? enlace : '', texto: texto(o.texto, 2200),
    miniatura: /^(https:\/\/|\/api\/contenido\/miniatura\/|\/media\/|data:image\/)/.test(mini) ? mini : '', publicadaAt: Number.isFinite(t) ? new Date(t).toISOString() : null,
    ...(/^[A-Za-z0-9_-]{1,60}$/.test(String(o.pieza || '')) ? { pieza: String(o.pieza) } : {}) };
}
/** Con origen, el único creativo: la publicación (su texto, para leerlo; Meta usa el de la publicación) y la llamada a la acción elegida. */
const creativoDeOrigen = (origen, llamada) => ({ id: 'pub', media: null, formato: null, texto: origen.texto || '', titular: '', descripcion: '', llamada: llamada ? String(llamada).toUpperCase().replace(/[^A-Z_]/g, '').slice(0, 30) || null : null });

function normCreativo(c, i, ahora, usados) {
  if (!c || typeof c !== 'object') malo(`El creativo ${i + 1} no se entiende.`);
  const formato = c.formato === null || c.formato === undefined || c.formato === '' ? null : FORMATOS_CREATIVO.includes(c.formato) ? c.formato : malo(`El formato del creativo ${i + 1} es 1:1, 4:5 o 9:16.`);
  const llamada = c.llamada ? String(c.llamada).toUpperCase().replace(/[^A-Z_]/g, '').slice(0, 30) || null : null;
  let id = /^[A-Za-z0-9_-]{1,20}$/.test(String(c.id || '')) && !usados.has(String(c.id)) ? String(c.id) : `k${i + 1}`;
  for (let n = i + 1; usados.has(id); n++) id = `k${n + 1}`;
  usados.add(id);
  return { id, media: texto(c.media, 300) || null, formato, texto: texto(c.texto, 2200), titular: texto(c.titular, 255), descripcion: texto(c.descripcion, 255), llamada };
}

/**
 * Lo que llega (la página, un agente, Dimitri) sobre lo que había → el borrador limpio. Solo cambia lo que viene; los campos que pone el
 * servidor (id, de, creadoAt, estado, validacion, meta, error, progreso) no se tocan desde fuera. Un valor que no existe (otro objetivo,
 * otra categoría…) da ErrorBorrador (400) en palabras: nunca se cambia por otro en silencio.
 */
export function normalizarBorrador(entrada = {}, previo = null, { ajustes = {}, ahora = Date.now(), de = 'dueno', id = null } = {}) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const b = previo ? structuredClone(previo) : borradorPorDefecto({ ajustes, ahora, de, id });
  if ('nombre' in e) b.nombre = texto(e.nombre, 80).replace(/\s*·\s*AO:[A-Za-z0-9_-]*\s*$/, '').trim() || 'Campaña nueva';
  if ('objetivo' in e) { if (!OBJETIVOS_BORRADOR.includes(e.objetivo)) malo(`El objetivo es uno de: ${OBJETIVOS_BORRADOR.join(', ')}.`); b.objetivo = e.objetivo; }
  if ('destino' in e) { if (e.destino !== null && e.destino !== '' && !DESTINOS_BORRADOR.includes(e.destino)) malo('El destino de los mensajes es whatsapp, instagram o messenger.'); b.destino = e.destino || null; }
  if (b.objetivo !== 'mensajes') b.destino = null;
  else if (!b.destino) b.destino = String(ajustes.whatsapp || '').trim() ? 'whatsapp' : 'instagram';
  if ('publico' in e && e.publico && typeof e.publico === 'object') {
    const p = e.publico, q = b.publico;
    if ('modo' in p) { if (!['advantage', 'manual'].includes(p.modo)) malo('El público es «advantage» (lo que Meta recomienda) o «manual».'); q.modo = p.modo; }
    if ('paises' in p) q.paises = [...new Set((Array.isArray(p.paises) ? p.paises : [p.paises]).map(x => String(x || '').trim().toUpperCase()).filter(x => /^[A-Z]{2}$/.test(x)))].slice(0, 25);
    if ('radio' in p) {
      if (!p.radio) q.radio = null;
      else { const lat = Number(p.radio.lat), lng = Number(p.radio.lng), km = Number(p.radio.km); if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && km > 0)) malo('El radio necesita latitud, longitud y kilómetros.'); q.radio = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, km: Math.min(80, Math.max(1, Math.round(km))) }; }
    }
    if ('edadMin' in p) q.edadMin = entero(p.edadMin, 13, 65) ?? 18;
    if ('edadMax' in p) q.edadMax = p.edadMax === null || p.edadMax === '' ? null : entero(p.edadMax, 13, 65);
    if ('intereses' in p) q.intereses = (Array.isArray(p.intereses) ? p.intereses : []).map(x => texto(x, 80)).filter(Boolean).slice(0, 25);
  }
  if ('categoriaEspecial' in e) { const c = e.categoriaEspecial || null; if (c !== null && !CATEGORIAS_ESPECIALES.includes(c)) malo(`La categoría especial es una de: ${CATEGORIAS_ESPECIALES.join(', ')} (o ninguna).`); b.categoriaEspecial = c; }
  if ('presupuesto' in e && e.presupuesto && typeof e.presupuesto === 'object') {
    if ('tipo' in e.presupuesto) { if (!['diario', 'total'].includes(e.presupuesto.tipo)) malo('El presupuesto es «diario» o «total».'); b.presupuesto.tipo = e.presupuesto.tipo; }
    if ('usd' in e.presupuesto) b.presupuesto.usd = usdDe(e.presupuesto.usd);
  }
  for (const k of ['inicio', 'fin']) if (k in e) { const v = isoDe(e[k]); if (v === undefined) malo(`La fecha de ${k} no se entiende (AAAA-MM-DD o con hora).`); b[k] = v; }
  if ('enlace' in e) b.enlace = texto(e.enlace, 1000) || null;
  if ('creativos' in e) {
    if (!Array.isArray(e.creativos)) malo('Los creativos van en una lista.');
    if (e.creativos.length > MAX_CREATIVOS) malo(`Como mucho ${MAX_CREATIVOS} creativos (Meta recomienda 3 a 6).`);
    const usados = new Set(); b.creativos = e.creativos.map((c, i) => normCreativo(c, i, ahora, usados));
  }
  if ('mejoras' in e && e.mejoras && typeof e.mejoras === 'object') for (const k of Object.keys(MEJORAS_DEFECTO)) if (k in e.mejoras) b.mejoras[k] = Boolean(e.mejoras[k]);
  if ('origen' in e) b.origen = e.origen ? normOrigen(e.origen) : null;
  if (b.origen) b.creativos = [creativoDeOrigen(b.origen, b.creativos?.[0]?.llamada)]; // A4: la publicación es el creativo (se queda la llamada elegida)
  else if (previo?.origen && 'origen' in e) b.creativos = []; // dejar de impulsar: los creativos se eligen de nuevo
  b.actualizadoAt = new Date(ahora).toISOString();
  if (previo && b.estado === 'fallo') { b.estado = 'borrador'; b.error = null; } // cambiarlo tras un fallo lo deja otra vez listo para crear
  b.validacion = null; // otro borrador: la validación de antes ya no vale
  return b;
}

// ---------------------------------------------------------------- validar (local; lo de Meta, validate_only, lo añade anuncios/crear.mjs)

const DIA_MS = 864e5;
/** Los días que dura (desde ahora o su inicio; el día de fin incluido). Sin fin: null. */
export function diasDe(b, ahora = Date.now()) {
  const i = Math.max(Date.parse(b.inicio || '') || ahora, ahora), f = Date.parse(b.fin || '');
  return Number.isFinite(f) && f > i ? Math.max(1, Math.ceil((f - i) / DIA_MS)) : null;
}
/** El spend_cap de la campaña, del tope por campaña de Ajustes: en la moneda; null si es menor que el mínimo de Meta (US$100). */
export function spendCapDe(ajustes = {}, defaults = {}) {
  const t = Number(ajustes.topeCampana ?? defaults.topeCampana);
  return Number.isFinite(t) && t >= SPEND_CAP_MINIMO_USD ? Math.round(t * 100) / 100 : null;
}
/** Lo máximo que podría gastar: al día, en total (con su fin) y la campaña (con el spend_cap como techo). Infinity = sin límite. */
export function costoMaximo(b, { ajustes = {}, defaults = {}, ahora = Date.now() } = {}) {
  const usd = b.presupuesto?.usd, dias = diasDe(b, ahora), cap = spendCapDe(ajustes, defaults);
  if (!usd) return { dia: null, total: null, campana: null };
  const dia = b.presupuesto.tipo === 'diario' ? usd : dias ? Math.ceil((usd / dias) * 100) / 100 : usd;
  const total = b.presupuesto.tipo === 'total' ? usd : dias ? Math.round(usd * dias * 100) / 100 : Infinity;
  return { dia, total, campana: cap !== null ? Math.min(cap, total) : total };
}
const esHttps = s => { try { const u = new URL(String(s)); return u.protocol === 'https:' && !!u.hostname; } catch { return false; } };
/** Los intereses que se pueden mandar a Meta: los que llevan su id («6003139266461» o «6003139266461:Fitness»). */
export const interesesConId = l => (l || []).map(x => /^(\d{6,20})(?::(.*))?$/.exec(String(x))).filter(Boolean).map(m => ({ id: m[1], ...(m[2] ? { name: m[2].trim() } : {}) }));

/**
 * Los problemas de un borrador, en palabras y por campo. `nivel: 'error'` impide crearlo; `'aviso'` se dice y no frena.
 * @param {object} o
 * @param {object} o.ajustes   cfg.anuncios (whatsapp, pixel, topes…)
 * @param {object} o.defaults  los topes de settings.mjs → FIELDS
 * @param {Function} o.medio   (id) → { kind: 'image'|'video'|… } | null (la galería del Estudio)
 * @param {object} o.cuentas   { pagina, instagram } ya resueltos (la de Ajustes o la de Contenido)
 */
export function validarBorrador(b, { ajustes = {}, defaults = {}, medio = () => null, cuentas = {}, ahora = Date.now() } = {}) {
  const problemas = [], err = (campo, t) => problemas.push({ campo, texto: t, nivel: 'error' }), aviso = (campo, t) => problemas.push({ campo, texto: t, nivel: 'aviso' });
  const comb = combinacion(b.objetivo, b.destino);
  if (!String(b.nombre || '').trim()) err('nombre', 'Ponle un nombre a la campaña.');
  if (!comb) err('objetivo', b.objetivo === 'mensajes' ? 'Elige por dónde te escriben: WhatsApp, Instagram o Messenger.' : 'Elige el objetivo de la campaña.');
  const pide = comb?.pide || [];
  if (pide.includes('whatsapp') && !String(ajustes.whatsapp || '').trim()) err('destino', 'Para anuncios que abren WhatsApp, pon el número de WhatsApp Business en Ajustes → Anuncios (vinculado a la página).');
  if (pide.includes('pixel') && !String(ajustes.pixel || '').trim()) err('objetivo', `«${OBJETIVO_BORRADOR_TEXTO[b.objetivo]}» necesita el píxel de tu web (Ajustes → Anuncios). Sin web, usa «Que me escriban».`);
  if (pide.includes('enlace') && !b.enlace) err('enlace', 'Falta la dirección de tu web a la que lleva el anuncio.');
  if (b.enlace && !esHttps(b.enlace)) err('enlace', 'La dirección de la web tiene que empezar por https://.');
  if (!cuentas.pagina) err('pagina', 'Falta la página de Facebook: ponla en Ajustes → Anuncios o conecta la de Contenido.');
  if (pide.includes('instagram') && !cuentas.instagram) err('destino', 'Para anuncios que abren Instagram Direct, la página necesita su cuenta de Instagram de empresa (Ajustes → Anuncios).');
  else if (cuentas.pagina && !cuentas.instagram) aviso('instagram', 'La página no tiene Instagram unido: en Instagram el anuncio saldrá con el nombre de la página.');

  const p = b.publico || {};
  if (!p.radio && !(p.paises || []).length) err('publico.paises', 'Elige al menos un país o un radio alrededor de tu local.');
  if (p.edadMin < 18) err('publico.edadMin', 'La edad mínima es 18 años.');
  if (p.edadMax !== null && p.edadMax !== undefined && p.edadMax < p.edadMin) err('publico.edadMax', 'La edad máxima es menor que la mínima.');
  if (b.categoriaEspecial && (p.edadMin !== 18 || (p.edadMax !== null && p.edadMax !== 65))) aviso('publico.edadMin', 'En vivienda, empleo, crédito o política Meta no deja elegir la edad: se manda 18–65.');
  if (b.categoriaEspecial && p.radio && p.radio.km < RADIO_MINIMO_ESPECIAL_KM) aviso('publico.radio', `En vivienda, empleo, crédito o política Meta pide un radio de al menos ${RADIO_MINIMO_ESPECIAL_KM} km: se manda ${RADIO_MINIMO_ESPECIAL_KM}.`);
  const sinId = (p.intereses || []).filter(x => !/^\d{6,20}(:.*)?$/.test(x));
  if (sinId.length) aviso('publico.intereses', `Los intereses van con su id de Meta («6003…:Nombre»): ${sinId.slice(0, 3).join(', ')} no se mandan.`);
  if (b.categoriaEspecial && (p.intereses || []).length) aviso('publico.intereses', 'En vivienda, empleo, crédito o política no se usan intereses: no se mandan.');
  else if (p.modo === 'advantage' && interesesConId(p.intereses).length) aviso('publico.intereses', 'Con Advantage+ los intereses son solo una sugerencia: Meta busca el público.');

  const usd = b.presupuesto?.usd;
  if (!usd) err('presupuesto.usd', 'Falta el presupuesto en US$.');
  else if (b.presupuesto.tipo === 'diario' && usd < PRESUPUESTO_MINIMO_USD) err('presupuesto.usd', `El presupuesto diario mínimo es US$${PRESUPUESTO_MINIMO_USD}.`);
  const ini = Date.parse(b.inicio || ''), fin = Date.parse(b.fin || '');
  if (b.fin && Number.isFinite(ini) && fin <= ini) err('fin', 'La fecha de fin es anterior al inicio.');
  else if (b.fin && fin <= ahora) err('fin', 'La fecha de fin ya pasó.');
  if (b.presupuesto?.tipo === 'total' && !b.fin) err('fin', 'Un presupuesto total necesita fecha de fin.');
  const dias = diasDe(b, ahora);
  if (usd && b.presupuesto.tipo === 'total' && dias && usd / dias < PRESUPUESTO_MINIMO_USD) err('presupuesto.usd', `Con ${dias} días, el total da menos de US$${PRESUPUESTO_MINIMO_USD} al día: súbelo o acorta las fechas.`);
  if (b.inicio && Number.isFinite(ini) && ini < ahora - 5 * 60e3) aviso('inicio', 'La fecha de inicio ya pasó: empezará en cuanto la actives.');

  const cm = costoMaximo(b, { ajustes, defaults, ahora });
  const tope = k => { const v = Number(ajustes[k] ?? defaults[k]); return Number.isFinite(v) && (ajustes[k] ?? defaults[k]) !== undefined && (ajustes[k] ?? defaults[k]) !== null ? v : null; };
  const cap = spendCapDe(ajustes, defaults), tc = tope('topeCampana');
  if (tc !== null && cap === null) aviso('presupuesto.usd', `Tu tope por campaña es menor que el mínimo de Meta (US$${SPEND_CAP_MINIMO_USD}): solo la oficina lo vigila.`);
  if (cm.dia !== null && tope('topeDiario') !== null && cm.dia > tope('topeDiario')) aviso('presupuesto.usd', `Gasta hasta US$${cm.dia} al día y tu tope diario es US$${tope('topeDiario')}: se crea en pausa, pero no se podrá activar así.`);
  if (tc !== null && cm.total !== null && cm.total > tc && cap === null) aviso(cm.total === Infinity ? 'fin' : 'presupuesto.usd', cm.total === Infinity ? 'Sin fecha de fin gastaría sin límite y no hay tope en Meta: ponle fecha de fin, o no cabrá en tu tope por campaña al activarla.' : `En total gastaría hasta US$${cm.total}, más que tu tope por campaña (US$${tc}).`);

  const cs = b.creativos || [];
  if (b.origen) { validarOrigen(b, comb, cuentas, err, aviso); return cierre(); }
  if (!cs.length) err('creativos', `Faltan creativos: Meta recomienda ${CREATIVOS_RECOMENDADOS[0]} a ${CREATIVOS_RECOMENDADOS[1]}.`);
  else if (cs.length < CREATIVOS_RECOMENDADOS[0]) aviso('creativos', `Con ${cs.length} creativo${cs.length === 1 ? '' : 's'} Meta tiene poco que probar: recomienda ${CREATIVOS_RECOMENDADOS[0]} a ${CREATIVOS_RECOMENDADOS[1]}.`);
  else if (cs.length > CREATIVOS_RECOMENDADOS[1]) aviso('creativos', `Más de ${CREATIVOS_RECOMENDADOS[1]} creativos reparten el aprendizaje: Meta recomienda ${CREATIVOS_RECOMENDADOS[0]} a ${CREATIVOS_RECOMENDADOS[1]}.`);
  const formatos = new Set();
  cs.forEach((c, i) => {
    const n = `creativos.${i}`, m = c.media ? medio(c.media) : null;
    if (!c.media) err(n + '.media', `El creativo ${i + 1} no tiene imagen ni video del Estudio.`);
    else if (!m) err(n + '.media', `La imagen o el video del creativo ${i + 1} ya no está en la galería del Estudio.`);
    else if (m.kind !== 'image' && m.kind !== 'video') err(n + '.media', `El creativo ${i + 1} es ${m.kind === 'audio' ? 'un audio' : 'un archivo'}: un anuncio lleva una imagen o un video.`);
    if (!c.texto) err(n + '.texto', `Falta el texto principal del creativo ${i + 1}.`);
    else if (c.texto.length > 125) aviso(n + '.texto', `El texto del creativo ${i + 1} pasa de 125 caracteres: en el teléfono se corta con «Ver más».`);
    if (c.titular && c.titular.length > 40) aviso(n + '.titular', `El titular del creativo ${i + 1} pasa de 40 caracteres: puede cortarse.`);
    if (c.llamada && comb && !(comb.llamadas || []).includes(c.llamada)) err(n + '.llamada', `El botón «${LLAMADA_TEXTO[c.llamada] || c.llamada}» no vale para «${OBJETIVO_BORRADOR_TEXTO[b.objetivo]}»: usa ${(comb.llamadas || []).map(l => LLAMADA_TEXTO[l] || l).join(', ')}.`);
    if (c.formato) formatos.add(c.formato);
  });
  if (cs.length && formatos.size === 1 && formatos.has('9:16')) aviso('creativos', 'Todo es 9:16: en el feed Meta lo recorta. Añade uno 1:1 o 4:5.');
  else if (cs.length && formatos.size && !formatos.has('9:16')) aviso('creativos', 'Sin un 9:16, en historias y reels Meta recorta o rellena (Advantage+ lo hace solo).');
  return cierre();
  function cierre() {
    if (comb && comb.verificado !== true) aviso('objetivo', 'Esta combinación todavía no se probó contra Meta de verdad: la validación de Meta dirá si la acepta.');
    return { ok: !problemas.some(x => x.nivel === 'error'), problemas, at: new Date(ahora).toISOString(), costoMax: { dia: cm.dia, total: cm.total === Infinity ? null : cm.total, campana: cm.campana === Infinity ? null : cm.campana, sinLimite: cm.total === Infinity && cap === null }, meta: null };
  }
}
/** A4: lo que se mira de una publicación impulsada (lo de Meta —si deja impulsarla— lo añade anuncios/crear.mjs → validar). */
function validarOrigen(b, comb, cuentas, err, aviso) {
  const o = b.origen, c = (b.creativos || [])[0];
  if (!REDES_IMPULSAR.includes(o.red) || !o.id) err('origen', 'Falta la publicación que se impulsa (su red y su id de Meta).');
  if (o.red === 'instagram' && !cuentas.instagram) err('origen', 'Para impulsar una publicación de Instagram, la página necesita su cuenta de Instagram de empresa unida (Ajustes → Anuncios).');
  if (c?.llamada && comb && !(comb.llamadas || []).includes(c.llamada)) err('creativos.0.llamada', `El botón «${LLAMADA_TEXTO[c.llamada] || c.llamada}» no vale para «${OBJETIVO_BORRADOR_TEXTO[b.objetivo]}»: usa ${(comb.llamadas || []).map(l => LLAMADA_TEXTO[l] || l).join(', ')}.`);
  if (!o.texto) aviso('origen', 'La publicación no tiene texto: el anuncio sale con la imagen o el video solos.');
}
/** «Combo (mensajes por WhatsApp) · US$5 al día · 3 creativos · borrador», con su id: para Dimitri, los agentes y el asistente. */
export function lineaBorrador(b) {
  const q = b.presupuesto?.usd ? `US$${b.presupuesto.usd} ${b.presupuesto.tipo === 'diario' ? 'al día' : 'en total'}` : 'sin presupuesto';
  const est = { borrador: 'borrador', creando: 'creándose en Meta', creado: `creado EN PAUSA en Meta${b.meta?.campana ? ` (campaña ${b.meta.campana})` : ''}`, fallo: `falló al crearse: ${b.error || ''}` }[b.estado] || b.estado;
  return `${b.id} · «${b.nombre}» (${OBJETIVO_BORRADOR_TEXTO[b.objetivo] || b.objetivo}${b.destino ? ' por ' + DESTINO_TEXTO[b.destino] : ''}) · ${q} · ${b.origen ? `impulsa la publicación de ${b.origen.red === 'instagram' ? 'Instagram' : 'Facebook'} ${b.origen.id}` : `${(b.creativos || []).length} creativo(s)`} · de ${b.de} · ${est}${b.validacion ? ` · ${b.validacion.ok ? 'valida' : 'NO valida: ' + b.validacion.problemas.filter(x => x.nivel === 'error').map(x => x.texto).slice(0, 2).join(' ')}` : ''}`;
}
