// Fase 0 de Anuncios (8 oct 2026): el Meta de mentira compartido se comporta como dice el plan (§5, Fase 0.2). Las fases de Anuncios
// y de la Bandeja se prueban contra él, así que sus reglas (todo nace en pausa, validate_only, presupuesto mínimo, la ventana de 24 h…)
// tienen que ser las de Meta. Cada regla que se le añada lleva su caso aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND, PRESUPUESTO_MINIMO_CENTAVOS } from './meta-stand.mjs';

const G = 'https://graph.test/v26.0';
const pedir = async (g, metodo, ruta, campos) => {
  const init = { method: metodo, headers: { authorization: `Bearer ${TOKEN_STAND}` } };
  if (campos) init.body = new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]));
  const r = await g.fetchFn(`${G}${ruta}`, init);
  return { status: r.status, ...(await r.json()) };
};
const campana = (extra = {}) => ({ name: 'Mensajes · AO:b1', objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], status: 'PAUSED', daily_budget: 1500, ...extra });
const segmentacion = { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } };

test('un token que no es el suyo da 190; sin token, las cuentas no se leen', async () => {
  const g = crearMetaStand();
  const r = await g.fetchFn(`${G}/me/accounts?access_token=CADUCADO`); assert.equal((await r.json()).error.code, 190);
  const ok = await g.fetchFn(`${G}/me/accounts?access_token=${TOKEN_STAND}`); assert.equal((await ok.json()).data[0].id, 'P1');
});

test('Marketing API: crear en orden, en pausa, y leerlo con su estado efectivo', async () => {
  const g = crearMetaStand();
  const c = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana());
  const s = await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: 'Panamá', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'MESSENGER', targeting: segmentacion, status: 'PAUSED' });
  const cr = await pedir(g, 'POST', `/${CUENTA_STAND}/adcreatives`, { name: 'Creativo', object_story_spec: { page_id: 'P1', instagram_user_id: 'IG1', link_data: { message: 'Escríbenos', image_hash: 'h' } } });
  const a = await pedir(g, 'POST', `/${CUENTA_STAND}/ads`, { adset_id: s.id, name: 'Anuncio', creative: { creative_id: cr.id }, status: 'PAUSED' });
  assert.ok(c.id && s.id && cr.id && a.id);
  const leido = await pedir(g, 'GET', `/${a.id}`);
  assert.equal(leido.configured_status, 'PAUSED'); assert.equal(leido.effective_status, 'PAUSED');
  const lista = await pedir(g, 'GET', `/${CUENTA_STAND}/campaigns`);
  assert.equal(lista.data.length, 1); assert.equal(lista.data[0].effective_status, 'PAUSED');
  const cuenta = await pedir(g, 'GET', `/${CUENTA_STAND}`);
  assert.equal(cuenta.currency, 'USD'); assert.equal(cuenta.timezone_name, 'America/Panama'); assert.equal(cuenta.account_status, 1);
});

test('validate_only valida y no crea nada', async () => {
  const g = crearMetaStand();
  const r = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana({ execution_options: ['validate_only'] }));
  assert.equal(r.success, true); assert.equal(Object.keys(g.st.campanas).length, 0); assert.equal(g.st.validaciones, 1);
});

test('las reglas de Meta que la oficina debe respetar: presupuesto mínimo, Explorar (v26), advantage_audience en categorías especiales (v26)', async () => {
  const g = crearMetaStand();
  const bajo = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana({ daily_budget: PRESUPUESTO_MINIMO_CENTAVOS - 1 }));
  assert.equal(bajo.error.code, 100); assert.equal(bajo.error.error_subcode, 1885272);
  const c = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana({ special_ad_categories: ['HOUSING'] }));
  const base = { campaign_id: c.id, name: 'x', optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', status: 'PAUSED' };
  const explorar = await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { ...base, targeting: { ...segmentacion, instagram_positions: ['stream', 'explore'] } });
  assert.match(explorar.error.message, /Explore/);
  const sinAdv = await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { ...base, targeting: { geo_locations: { countries: ['PA'] } } });
  assert.match(sinAdv.error.message, /advantage_audience/);
  const ok = await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { ...base, targeting: { geo_locations: { countries: ['PA'] }, targeting_automation: { advantage_audience: 0 } } });
  assert.ok(ok.id);
});

test('activar: pasa por revisión; un rechazado y uno con problemas se leen con su motivo', async () => {
  const g = crearMetaStand();
  const c = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana());
  const s = await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: 's', optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', targeting: segmentacion, status: 'PAUSED' });
  const cr = await pedir(g, 'POST', `/${CUENTA_STAND}/adcreatives`, { object_story_spec: { page_id: 'P1' } });
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await pedir(g, 'POST', `/${CUENTA_STAND}/ads`, { adset_id: s.id, name: `a${i}`, creative: { creative_id: cr.id }, status: 'PAUSED' })).id);
  g.st.fallar.rechazar = [ids[1]]; g.st.fallar.conProblemas = [ids[2]];
  for (const id of [c.id, s.id, ...ids]) await pedir(g, 'POST', `/${id}`, { status: 'ACTIVE' });
  assert.equal((await pedir(g, 'GET', `/${ids[0]}`)).effective_status, 'ACTIVE');
  const rech = await pedir(g, 'GET', `/${ids[1]}`); assert.equal(rech.effective_status, 'DISAPPROVED'); assert.ok(rech.ad_review_feedback);
  const prob = await pedir(g, 'GET', `/${ids[2]}`); assert.equal(prob.effective_status, 'WITH_ISSUES'); assert.ok(prob.issues_info[0].error_message);
  await pedir(g, 'POST', `/${c.id}`, { status: 'PAUSED' });
  assert.equal((await pedir(g, 'GET', `/${ids[0]}`)).effective_status, 'CAMPAIGN_PAUSED');
});

test('copies (deep_copy) duplica todo en pausa; la cuenta con pago pendiente no deja crear', async () => {
  const g = crearMetaStand();
  const c = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana());
  await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: 's', optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', targeting: segmentacion, status: 'PAUSED' });
  const cp = await pedir(g, 'POST', `/${c.id}/copies`, { deep_copy: true, status_option: 'PAUSED' });
  assert.ok(cp.copied_campaign_id); assert.equal(g.st.campanas[cp.copied_campaign_id].status, 'PAUSED');
  assert.equal(Object.values(g.st.conjuntos).filter(x => x.campaign_id === cp.copied_campaign_id).length, 1);
  const p = crearMetaStand({ fallar: { pagoPendiente: true } });
  assert.equal((await pedir(p, 'GET', `/${CUENTA_STAND}`)).account_status, 3);
  assert.equal((await pedir(p, 'POST', `/${CUENTA_STAND}/campaigns`, campana())).error.code, 2635);
});

test('el lote: hasta 50 peticiones en una, cada una con su respuesta', async () => {
  const g = crearMetaStand();
  const r = await g.fetchFn(`${G}/`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams({ batch: JSON.stringify([{ method: 'GET', relative_url: CUENTA_STAND }, { method: 'GET', relative_url: `${CUENTA_STAND}/campaigns` }]) }) });
  const salida = await r.json();
  assert.equal(salida.length, 2); assert.equal(salida[0].code, 200); assert.equal(JSON.parse(salida[0].body).currency, 'USD');
  const mucho = await g.fetchFn(`${G}/`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams({ batch: JSON.stringify(Array(51).fill({ method: 'GET', relative_url: 'me' })) }) });
  assert.equal(mucho.status, 400);
});

test('la Bandeja: comentar, ocultar, y la ventana de 24 h de los mensajes', async () => {
  const ahora = Date.UTC(2026, 9, 8, 15);
  const g = crearMetaStand();
  g.st.reloj = ahora;
  g.st.comentarios.M1 = [{ id: 'c1', text: 'Hola, ¿precio?', username: 'cliente', timestamp: new Date(ahora - 3600e3).toISOString() }];
  assert.equal((await pedir(g, 'GET', '/M1/comments')).data.length, 1);
  assert.ok((await pedir(g, 'POST', '/c1/replies', { message: 'Te escribimos por DM' })).id);
  assert.equal((await pedir(g, 'POST', '/c1', { hide: true })).success, true); assert.deepEqual(g.st.ocultos, ['c1']);
  g.st.conversaciones = [
    { id: 't1', platform: 'instagram', participants: { data: [{ id: 'IGSID1' }, { id: 'IG1' }] }, messages: { data: [{ id: 'm1', message: 'Hola', from: { id: 'IGSID1' }, created_time: new Date(ahora - 2 * 3600e3).toISOString() }] } },
    { id: 't2', platform: 'messenger', participants: { data: [{ id: 'PSID2' }, { id: 'P1' }] }, messages: { data: [{ id: 'm2', message: 'Viejo', from: { id: 'PSID2' }, created_time: new Date(ahora - 30 * 3600e3).toISOString() }] } },
  ];
  assert.equal((await pedir(g, 'GET', '/P1/conversations?platform=instagram')).data.length, 1);
  const dentro = await pedir(g, 'POST', '/P1/messages', { recipient: { id: 'IGSID1' }, messaging_type: 'RESPONSE', message: { text: 'Claro' } });
  assert.ok(dentro.message_id);
  const fuera = await pedir(g, 'POST', '/P1/messages', { recipient: { id: 'PSID2' }, messaging_type: 'RESPONSE', message: { text: 'Tarde' } });
  assert.equal(fuera.error.error_subcode, 2018278);
});

test('las cabeceras de uso salen en cada respuesta cuando se piden; escuchar() lo sirve por HTTP', async () => {
  const g = crearMetaStand({ uso: { app: 50, negocio: 80, cuenta: 10 } });
  const r = await g.fetchFn(`${G}/me/accounts?access_token=${TOKEN_STAND}`);
  assert.equal(JSON.parse(r.headers.get('x-app-usage')).call_count, 50);
  const srv = await g.escuchar();
  try {
    const h = await fetch(`${srv.url}/v26.0/${CUENTA_STAND}?access_token=${TOKEN_STAND}`);
    assert.equal((await h.json()).currency, 'USD'); assert.ok(h.headers.get('x-business-use-case-usage'));
    const p = await fetch(`${srv.url}/v26.0/${CUENTA_STAND}/campaigns`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}`, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'x', objective: 'OUTCOME_TRAFFIC', special_ad_categories: '[]', status: 'PAUSED' }) });
    assert.ok((await p.json()).id);
  } finally { await srv.cerrar(); }
});

test('insights: con time_increment, una fila por día; sin él, una por objeto del rango, con el alcance como personas únicas (no la suma)', async () => {
  const g = crearMetaStand();
  g.st.cifras = [
    { ad_id: 'AD1', adset_id: 'S1', campaign_id: 'C1', date_start: '2026-10-01', spend: '2.50', impressions: '100', reach: '80', clicks: '5' },
    { ad_id: 'AD1', adset_id: 'S1', campaign_id: 'C1', date_start: '2026-10-02', spend: '3.50', impressions: '150', reach: '90', clicks: '7' },
    { ad_id: 'AD2', adset_id: 'S1', campaign_id: 'C1', date_start: '2026-10-02', spend: '1', impressions: '50', reach: '40', clicks: '1' },
  ];
  const rango = encodeURIComponent(JSON.stringify({ since: '2026-10-01', until: '2026-10-02' }));
  const diario = await pedir(g, 'GET', `/${CUENTA_STAND}/insights?level=ad&time_increment=1&time_range=${rango}`);
  assert.equal(diario.data.length, 3);
  const porAnuncio = await pedir(g, 'GET', `/${CUENTA_STAND}/insights?level=ad&time_range=${rango}`);
  assert.equal(porAnuncio.data.length, 2);
  const ad1 = porAnuncio.data.find(f => f.ad_id === 'AD1'); assert.equal(ad1.spend, '6'); assert.equal(ad1.reach, '90', 'el alcance del rango no es 80 + 90');
  const cuenta = await pedir(g, 'GET', `/${CUENTA_STAND}/insights?level=account&time_range=${rango}`);
  assert.equal(cuenta.data.length, 1); assert.equal(cuenta.data[0].impressions, '300');
});
