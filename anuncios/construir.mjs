// ============================================================
// Agents Office — Anuncios de Meta, Fase A3 (9 oct 2026): el borrador de la oficina → los CUERPOS que se mandan a Meta. PURO: sin red, sin
// disco, sin reloj propio. docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §5 (A3), §4.1 y §13 (lo verificado).
//
//   cuerpoCampana(b, ctx)                         → POST /act_<id>/campaigns
//   cuerpoConjunto(b, ctx, campaignId)            → POST /act_<id>/adsets
//   cuerpoCreativo(b, c, ctx, { hash | video })   → POST /act_<id>/adcreatives
//   cuerpoAnuncio(b, c, adsetId, creativeId)      → POST /act_<id>/ads
//   nombres(b)                                    → el nombre EXACTO de cada objeto (con `· AO:<id>`): así se reconcilia tras un corte
//
// Reglas que no se negocian aquí:
//   · TODO nace `status: 'PAUSED'` (plan §3.3). Activar es la acción de gasto de la A2.
//   · `special_ad_categories` va SIEMPRE ([] si ninguna) y, en una categoría especial, `targeting_automation.advantage_audience` va
//     explícito (1 o 0) — v26 lo exige (plan §13.1).
//   · Ninguna ubicación a mano (ni «Explorar», que v26 rechaza): las ubicaciones Advantage+ son las de por defecto (plan §13.4).
//   · Advantage+ = presupuesto en la CAMPAÑA + `bid_strategy: LOWEST_COST_WITHOUT_CAP` + `advantage_audience: 1` (verificado, §13.4).
//   · `spend_cap` en centavos, solo si el tope por campaña es ≥ US$100 (el mínimo de Meta, §13.2); si no, se omite y validarBorrador lo dice.
//   · `object_story_spec` con `page_id` e `instagram_user_id` (no `instagram_actor_id`, §13.4); `link_data` con `image_hash` (no `picture`).
//   · `adlabels` NO se manda: no está verificado en v26 (§13.8). La etiqueta va en el NOMBRE.
//   · Las mejoras de Meta, una por una en `degrees_of_freedom_spec.creative_features_spec` (OPT_IN / OPT_OUT): el paquete «standard
//     enhancements» ya no existe. POR VERIFICAR los nombres exactos de las claves en v26 (se usan los del plan).
// ============================================================
import { combinacion, conEtiqueta, aMeta, spendCapDe, interesesConId, RADIO_MINIMO_ESPECIAL_KM } from './modelo.mjs';

export const ESTADO_INICIAL = 'PAUSED';
export const ESTRATEGIA = 'LOWEST_COST_WITHOUT_CAP';
/** Cada mejora de la oficina → su rasgo (feature) en creative_features_spec, y a qué medio se aplica. POR VERIFICAR los nombres en v26. */
export const MEJORAS_META = {
  texto: { rasgo: 'text_optimizations', medios: ['image', 'video'] },
  retoques: { rasgo: 'image_touchups', medios: ['image'] },
  plantilla: { rasgo: 'image_template', medios: ['image'] },
  recorte: { rasgo: 'video_auto_crop', medios: ['video'] },
};

/** Los nombres exactos (la etiqueta va al final: anuncios/modelo.mjs → etiqueta()). */
export function nombres(b) {
  const base = String(b.nombre || 'Campaña').trim();
  return {
    campana: conEtiqueta(base, b.id),
    conjunto: conEtiqueta(base, b.id),
    creativo: c => conEtiqueta(`${base} · ${c.id}`, b.id),
    anuncio: c => conEtiqueta(`${base} · ${c.id}`, b.id),
  };
}

const iso = s => { const t = Date.parse(s || ''); return Number.isFinite(t) ? new Date(t).toISOString().replace(/\.\d{3}Z$/, '+0000') : null; };

/**
 * @param {object} b   el borrador (anuncios/modelo.mjs)
 * @param {object} ctx { ajustes, defaults, moneda: 'USD', pagina, instagram, pixel, ahora }
 */
export function cuerpoCampana(b, ctx = {}) {
  const comb = combinacion(b.objetivo, b.destino); if (!comb) throw new Error('esa combinación de objetivo y destino no existe');
  const moneda = ctx.moneda || 'USD', cap = spendCapDe(ctx.ajustes || {}, ctx.defaults || {});
  const cuerpo = {
    name: nombres(b).campana,
    objective: comb.objective,
    status: ESTADO_INICIAL,
    special_ad_categories: b.categoriaEspecial ? [b.categoriaEspecial] : [],
    ...(b.presupuesto.tipo === 'diario' ? { daily_budget: aMeta(b.presupuesto.usd, moneda) } : { lifetime_budget: aMeta(b.presupuesto.usd, moneda) }),
    bid_strategy: ESTRATEGIA,
  };
  // POR VERIFICAR: Meta pide el país de la categoría especial (`special_ad_category_country`) cuando hay una.
  if (b.categoriaEspecial) cuerpo.special_ad_category_country = paisesDe(b).length ? paisesDe(b) : ['PA'];
  if (cap !== null) cuerpo.spend_cap = aMeta(cap, moneda);
  return cuerpo;
}
const paisesDe = b => (b.publico?.radio ? [] : b.publico?.paises || []);

/** La segmentación: países o un radio, la edad, y Advantage+ explícito (1 o 0). Sin ubicaciones: las Advantage+ de Meta. */
export function segmentacion(b) {
  const p = b.publico || {}, esp = Boolean(b.categoriaEspecial);
  const geo = p.radio
    ? { custom_locations: [{ latitude: p.radio.lat, longitude: p.radio.lng, radius: esp ? Math.max(RADIO_MINIMO_ESPECIAL_KM, p.radio.km) : p.radio.km, distance_unit: 'kilometer' }] }
    : { countries: [...(p.paises || [])] };
  const t = { geo_locations: geo, age_min: esp ? 18 : Math.max(18, p.edadMin ?? 18) };
  if (esp) t.age_max = 65; else if (p.edadMax !== null && p.edadMax !== undefined) t.age_max = p.edadMax;
  const intereses = esp ? [] : interesesConId(p.intereses);
  if (intereses.length) t.flexible_spec = [{ interests: intereses }];
  t.targeting_automation = { advantage_audience: p.modo === 'manual' ? 0 : 1 };
  return t;
}

export function cuerpoConjunto(b, ctx = {}, campaignId) {
  const comb = combinacion(b.objetivo, b.destino); if (!comb) throw new Error('esa combinación de objetivo y destino no existe');
  const cuerpo = {
    name: nombres(b).conjunto,
    campaign_id: String(campaignId),
    optimization_goal: comb.optimization_goal,
    billing_event: comb.billing_event,
    targeting: segmentacion(b),
    status: ESTADO_INICIAL,
  };
  if (comb.destination_type) cuerpo.destination_type = comb.destination_type;
  if (b.objetivo === 'mensajes') cuerpo.promoted_object = { page_id: String(ctx.pagina) }; // verificado (plan §13.13)
  else if (comb.evento) cuerpo.promoted_object = { pixel_id: String(ctx.pixel || ''), custom_event_type: comb.evento }; // POR VERIFICAR
  const ini = iso(b.inicio), fin = iso(b.fin), ahora = ctx.ahora ?? Date.now();
  if (ini && Date.parse(b.inicio) > ahora) cuerpo.start_time = ini; // un inicio que ya pasó se omite: empieza al activarla
  if (fin) cuerpo.end_time = fin;
  return cuerpo;
}

/** El botón: tipo y su `value` (el link y, en mensajes, `app_destination`). */
export function llamadaDe(b, c, ctx = {}) {
  const comb = combinacion(b.objetivo, b.destino);
  const tipo = c.llamada && comb.llamadas.includes(c.llamada) ? c.llamada : comb.llamadas[0];
  const link = enlaceDe(b, ctx);
  return { type: tipo, value: { link, ...(comb.app_destination ? { app_destination: comb.app_destination } : {}) } };
}
/** El link del anuncio: el de la web; en mensajes, el que Meta pide para abrir la conversación; en alcance sin web, la página. */
export function enlaceDe(b, ctx = {}) {
  const comb = combinacion(b.objetivo, b.destino);
  if (comb.link) return comb.link;
  return b.enlace || `https://www.facebook.com/${ctx.pagina}`; // POR VERIFICAR: el link de alcance sin web
}

/** Las mejoras de Meta, una por una, solo las que valen para ese medio. */
export function mejorasDe(b, medio) {
  const spec = {};
  for (const [k, m] of Object.entries(MEJORAS_META)) if (m.medios.includes(medio)) spec[m.rasgo] = { enroll_status: b.mejoras?.[k] ? 'OPT_IN' : 'OPT_OUT' };
  return { creative_features_spec: spec };
}

/**
 * @param {object} medio { hash } para una imagen (adimages) · { video, miniatura } para un video (advideos; Meta pide la miniatura en video_data)
 */
export function cuerpoCreativo(b, c, ctx = {}, medio = {}) {
  const historia = { page_id: String(ctx.pagina) };
  if (ctx.instagram) historia.instagram_user_id = String(ctx.instagram);
  const llamada = llamadaDe(b, c, ctx);
  if (medio.video) {
    historia.video_data = {
      video_id: String(medio.video), message: c.texto, ...(c.titular ? { title: c.titular } : {}), ...(c.descripcion ? { link_description: c.descripcion } : {}),
      ...(medio.miniatura ? { image_url: medio.miniatura } : {}), // POR VERIFICAR: la miniatura que Meta da en GET /<video>?fields=picture
      call_to_action: llamada,
    };
  } else {
    historia.link_data = {
      image_hash: String(medio.hash), link: llamada.value.link, message: c.texto,
      ...(c.titular ? { name: c.titular } : {}), ...(c.descripcion ? { description: c.descripcion } : {}),
      call_to_action: llamada,
    };
  }
  return { name: nombres(b).creativo(c), object_story_spec: historia, degrees_of_freedom_spec: mejorasDe(b, medio.video ? 'video' : 'image') };
}

export function cuerpoAnuncio(b, c, adsetId, creativeId) {
  return { name: nombres(b).anuncio(c), adset_id: String(adsetId), creative: { creative_id: String(creativeId) }, status: ESTADO_INICIAL };
}

/** Todo lo que se mandaría, con marcadores en lugar de los ids que Meta todavía no dio (para la vista previa, el check y los tests). */
export function construir(b, ctx = {}, { hashes = {}, videos = {} } = {}) {
  return {
    campana: cuerpoCampana(b, ctx),
    conjunto: cuerpoConjunto(b, ctx, '<campana>'),
    creativos: (b.creativos || []).map(c => ({ creativo: c.id, cuerpo: cuerpoCreativo(b, c, ctx, videos[c.media] ? { video: videos[c.media].id, miniatura: videos[c.media].miniatura } : { hash: hashes[c.media] || '<hash>' }) })),
    anuncios: (b.creativos || []).map(c => ({ creativo: c.id, cuerpo: cuerpoAnuncio(b, c, '<conjunto>', `<creativo:${c.id}>`) })),
  };
}
