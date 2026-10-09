// Fase A3 de Anuncios (9 oct 2026): el borrador de la oficina → los cuerpos EXACTOS que se mandan a Meta (anuncios/construir.mjs, puro).
// Lo que no se negocia: todo PAUSED, `special_ad_categories` siempre, sin ubicaciones a mano (ni «Explorar»), `advantage_audience`
// explícito, `spend_cap` solo si el tope llega al mínimo de Meta (US$100) y si no el aviso, `instagram_user_id` (no `instagram_actor_id`),
// `image_hash` (no `picture`), las mejoras una por una, y la etiqueta `· AO:<id>` en todos los nombres.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cuerpoCampana, cuerpoConjunto, cuerpoCreativo, cuerpoAnuncio, construir, nombres, segmentacion, mejorasDe } from '../anuncios/construir.mjs';
import { normalizarBorrador, validarBorrador, TODAS_LAS_COMBINACIONES, etiqueta } from '../anuncios/modelo.mjs';

const AHORA = Date.parse('2026-10-09T15:00:00Z');
const AJ = { whatsapp: '50760001111', pixel: '123456789', topeDiario: 20, topeMensual: 300, topeCampana: 150 };
const CTX = { ajustes: AJ, moneda: 'USD', pagina: '111222333', instagram: '444555666', pixel: '123456789', ahora: AHORA };
const borrador = (e = {}) => normalizarBorrador({ nombre: 'Combo 2x1', creativos: [{ id: 'k1', media: 'm1', formato: '1:1', texto: 'Pide tu combo por WhatsApp', titular: 'Combo 2x1', llamada: 'WHATSAPP_MESSAGE' }], ...e }, null, { ajustes: AJ, ahora: AHORA, id: 'b1' });

test('la campaña: PAUSED, special_ad_categories siempre, presupuesto Advantage+ en la campaña, menor costo sin tope y spend_cap en centavos', () => {
  assert.deepEqual(cuerpoCampana(borrador(), CTX), {
    name: 'Combo 2x1 · AO:b1', objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', special_ad_categories: [], daily_budget: 500, bid_strategy: 'LOWEST_COST_WITHOUT_CAP', spend_cap: 15000,
  });
  const total = cuerpoCampana(borrador({ presupuesto: { tipo: 'total', usd: 70 }, fin: '2026-10-20' }), CTX);
  assert.equal(total.lifetime_budget, 7000); assert.equal(total.daily_budget, undefined);
  const esp = cuerpoCampana(borrador({ categoriaEspecial: 'HOUSING' }), CTX);
  assert.deepEqual(esp.special_ad_categories, ['HOUSING']); assert.deepEqual(esp.special_ad_category_country, ['PA']);
});

test('spend_cap: solo con un tope por campaña de US$100 o más; si es menor se omite y la validación lo avisa', () => {
  const ctx = { ...CTX, ajustes: { ...AJ, topeCampana: 50 } };
  assert.equal('spend_cap' in cuerpoCampana(borrador(), ctx), false);
  const v = validarBorrador(borrador(), { ajustes: ctx.ajustes, cuentas: { pagina: 'P', instagram: 'I' }, medio: () => ({ kind: 'image' }), ahora: AHORA });
  assert.ok(v.problemas.some(p => p.nivel === 'aviso' && /menor que el mínimo de Meta \(US\$100\): solo la oficina lo vigila/.test(p.texto)));
  assert.equal(cuerpoCampana(borrador(), { ...CTX, ajustes: { ...AJ, topeCampana: 100 } }).spend_cap, 10000);
});

test('el conjunto: PAUSED, mensajes por WhatsApp con su destino, promoted_object, Advantage+ explícito y sin ubicaciones', () => {
  const c = cuerpoConjunto(borrador({ inicio: '2026-10-12T09:00:00-05:00', fin: '2026-10-19' }), CTX, 'CMP1');
  assert.deepEqual(c, {
    name: 'Combo 2x1 · AO:b1', campaign_id: 'CMP1', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS',
    targeting: { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } },
    status: 'PAUSED', destination_type: 'WHATSAPP', promoted_object: { page_id: '111222333' }, start_time: '2026-10-12T14:00:00+0000', end_time: new Date('2026-10-19T00:00:00').toISOString().replace(/\.\d{3}Z$/, '+0000'),
  });
  for (const k of ['publisher_platforms', 'instagram_positions', 'facebook_positions', 'device_platforms']) assert.equal(k in c.targeting, false, `sin ${k}: ubicaciones Advantage+`);
  assert.doesNotMatch(JSON.stringify(c), /explore/i);
  assert.equal('start_time' in cuerpoConjunto(borrador({ inicio: '2026-10-01' }), CTX, 'C'), false, 'un inicio que ya pasó se omite');
});

test('la segmentación: radio en km, edad, manual = advantage_audience 0, y en categorías especiales 18–65, radio mínimo y sin intereses', () => {
  const r = segmentacion(borrador({ publico: { modo: 'manual', radio: { lat: 8.98, lng: -79.52, km: 10 }, edadMin: 25, edadMax: 45, intereses: ['6003139266461:Fitness', 'gimnasio'] } }));
  assert.deepEqual(r, { geo_locations: { custom_locations: [{ latitude: 8.98, longitude: -79.52, radius: 10, distance_unit: 'kilometer' }] }, age_min: 25, age_max: 45, flexible_spec: [{ interests: [{ id: '6003139266461', name: 'Fitness' }] }], targeting_automation: { advantage_audience: 0 } });
  const e = segmentacion(borrador({ categoriaEspecial: 'EMPLOYMENT', publico: { modo: 'advantage', radio: { lat: 8.98, lng: -79.52, km: 10 }, edadMin: 30, intereses: ['6003139266461'] } }));
  assert.equal(e.age_min, 18); assert.equal(e.age_max, 65); assert.equal(e.geo_locations.custom_locations[0].radius, 25); assert.equal(e.flexible_spec, undefined);
  assert.equal(e.targeting_automation.advantage_audience, 1, 'explícito en categorías especiales (v26)');
});

test('el creativo: page_id + instagram_user_id, link_data con image_hash, el botón de WhatsApp con app_destination, y las mejoras una por una', () => {
  const b = borrador(), c = b.creativos[0];
  assert.deepEqual(cuerpoCreativo(b, c, CTX, { hash: 'H1' }), {
    name: 'Combo 2x1 · k1 · AO:b1',
    object_story_spec: { page_id: '111222333', instagram_user_id: '444555666', link_data: { image_hash: 'H1', link: 'https://api.whatsapp.com/send', message: 'Pide tu combo por WhatsApp', name: 'Combo 2x1', call_to_action: { type: 'WHATSAPP_MESSAGE', value: { link: 'https://api.whatsapp.com/send', app_destination: 'WHATSAPP' } } } },
    degrees_of_freedom_spec: { creative_features_spec: { text_optimizations: { enroll_status: 'OPT_OUT' }, image_touchups: { enroll_status: 'OPT_IN' }, image_template: { enroll_status: 'OPT_OUT' } } },
  });
  const s = JSON.stringify(cuerpoCreativo(b, c, CTX, { hash: 'H1' }));
  assert.doesNotMatch(s, /instagram_actor_id|"picture"|adlabels|standard_enhancements/);
  const v = cuerpoCreativo(b, c, CTX, { video: 'VID1', miniatura: 'https://x/m.jpg' });
  assert.deepEqual(v.object_story_spec.video_data, { video_id: 'VID1', message: 'Pide tu combo por WhatsApp', title: 'Combo 2x1', image_url: 'https://x/m.jpg', call_to_action: { type: 'WHATSAPP_MESSAGE', value: { link: 'https://api.whatsapp.com/send', app_destination: 'WHATSAPP' } } });
  assert.deepEqual(mejorasDe({ mejoras: { recorte: true, texto: true } }, 'video'), { creative_features_spec: { text_optimizations: { enroll_status: 'OPT_IN' }, video_auto_crop: { enroll_status: 'OPT_IN' } } });
  const sinIg = cuerpoCreativo(b, c, { ...CTX, instagram: null }, { hash: 'H1' });
  assert.equal('instagram_user_id' in sinIg.object_story_spec, false);
});

test('web y ventas: el link es la web y el botón lleva solo el link; ventas optimiza al píxel con PURCHASE', () => {
  const w = borrador({ objetivo: 'web', enlace: 'https://panaclaw.com/combo', creativos: [{ id: 'k1', media: 'm1', texto: 'Mira el combo', llamada: 'SHOP_NOW' }] });
  assert.deepEqual(cuerpoCreativo(w, w.creativos[0], CTX, { hash: 'H' }).object_story_spec.link_data.call_to_action, { type: 'SHOP_NOW', value: { link: 'https://panaclaw.com/combo' } });
  const cw = cuerpoConjunto(w, CTX, 'C');
  assert.equal(cw.optimization_goal, 'LINK_CLICKS'); assert.equal(cw.destination_type, 'WEBSITE'); assert.equal(cw.promoted_object, undefined);
  const v = borrador({ objetivo: 'ventas', enlace: 'https://panaclaw.com', creativos: [{ id: 'k1', media: 'm1', texto: 'x' }] });
  assert.deepEqual(cuerpoConjunto(v, CTX, 'C').promoted_object, { pixel_id: '123456789', custom_event_type: 'PURCHASE' });
  assert.equal(cuerpoCampana(v, CTX).objective, 'OUTCOME_SALES');
  assert.equal(cuerpoCreativo(v, v.creativos[0], CTX, { hash: 'H' }).object_story_spec.link_data.call_to_action.type, 'SHOP_NOW', 'sin botón elegido, el primero de la tabla');
});

test('el anuncio: PAUSED, su conjunto, su creativo y la etiqueta; construir() junta todo con marcadores', () => {
  const b = borrador();
  assert.deepEqual(cuerpoAnuncio(b, b.creativos[0], 'ADS1', 'CRE1'), { name: 'Combo 2x1 · k1 · AO:b1', adset_id: 'ADS1', creative: { creative_id: 'CRE1' }, status: 'PAUSED' });
  const t = construir(b, CTX, { hashes: { m1: 'H1' } });
  assert.equal(t.campana.status, 'PAUSED'); assert.equal(t.conjunto.status, 'PAUSED'); assert.ok(t.anuncios.every(a => a.cuerpo.status === 'PAUSED'));
  assert.equal(t.creativos[0].cuerpo.object_story_spec.link_data.image_hash, 'H1');
  const n = nombres(b); for (const x of [n.campana, n.conjunto, n.creativo(b.creativos[0]), n.anuncio(b.creativos[0])]) assert.equal(etiqueta(x).borrador, 'b1', x);
});

test('todas las combinaciones de la tabla dan cuerpos PAUSED, con special_ad_categories y advantage_audience', () => {
  for (const comb of TODAS_LAS_COMBINACIONES()) {
    const b = borrador({ objetivo: comb.objetivo, ...(comb.destino ? { destino: comb.destino } : {}), enlace: 'https://panaclaw.com', creativos: [{ id: 'k1', media: 'm1', texto: 'x' }] });
    const t = construir(b, CTX, { hashes: { m1: 'H' } }), dicho = `${comb.objetivo}/${comb.destino || '-'}`;
    assert.equal(t.campana.status, 'PAUSED', dicho); assert.ok(Array.isArray(t.campana.special_ad_categories), dicho);
    assert.ok([0, 1].includes(t.conjunto.targeting.targeting_automation.advantage_audience), dicho);
    assert.equal(t.campana.objective, comb.objective, dicho); assert.equal(t.conjunto.optimization_goal, comb.optimization_goal, dicho);
    assert.ok(comb.llamadas.includes(t.creativos[0].cuerpo.object_story_spec.link_data.call_to_action.type), dicho);
  }
});
