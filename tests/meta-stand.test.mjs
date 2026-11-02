// Fase 0 de Anuncios (8 oct 2026): el Meta de mentira compartido se comporta como dice el plan (§5, Fase 0.2). Las fases de Anuncios
// y de la Bandeja se prueban contra él, así que sus reglas (todo nace en pausa, validate_only, presupuesto mínimo, la ventana de 24 h…)
// tienen que ser las de Meta. Cada regla que se le añada lleva su caso aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND, PRESUPUESTO_MINIMO_CENTAVOS, SPEND_CAP_MINIMO_CENTAVOS } from './meta-stand.mjs';

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

test('issues_info también sale en campañas y conjuntos, con el nivel que corresponde (punto 7)', async () => {
  const g = crearMetaStand();
  const c = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana());
  const s = await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: 's', optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', targeting: segmentacion, status: 'PAUSED' });
  g.st.campanas[c.id].revision = 'WITH_ISSUES'; g.st.conjuntos[s.id].revision = 'WITH_ISSUES';
  const rc = await pedir(g, 'GET', `/${c.id}`), rs = await pedir(g, 'GET', `/${s.id}`);
  assert.equal(rc.issues_info[0].level, 'CAMPAIGN'); assert.ok(rc.issues_info[0].error_message);
  assert.equal(rs.issues_info[0].level, 'ADSET');
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

test('la Bandeja (B2): la lista da id y updated_time, los mensajes van aparte (20 como mucho), lo enviado vuelve en el hilo, y el acceso avanzado', async () => {
  const ahora = Date.UTC(2026, 9, 8, 15);
  const g = crearMetaStand(); g.st.reloj = ahora;
  const msgs = Array.from({ length: 25 }, (_, i) => ({ id: `m${i}`, message: `hola ${i}`, from: { id: 'IGSID1', username: 'ana' }, to: { data: [{ id: 'IG1' }] }, created_time: new Date(ahora - (30 - i) * 60e3).toISOString(), attachments: { data: [{ image_data: { url: 'https://lookaside.fbsbx.com/x.jpg' } }] } }));
  g.st.conversaciones = [{ id: 't1', platform: 'instagram', messages: { data: msgs } }];
  const l = await pedir(g, 'GET', '/P1/conversations?platform=instagram&fields=id,updated_time');
  assert.deepEqual(Object.keys(l.data[0]).sort(), ['id', 'updated_time']); assert.equal(l.data[0].updated_time, msgs[24].created_time);
  const c = await pedir(g, 'GET', '/t1?fields=messages.limit(20){id,created_time,from,to,message,attachments}');
  assert.equal(c.messages.data.length, 20); assert.equal(c.messages.data[0].id, 'm24', 'los más recientes primero'); assert.ok(c.messages.data[0].attachments);
  assert.equal((await pedir(g, 'GET', '/t1?fields=messages{id,message}')).messages.data[0].attachments, undefined);
  assert.ok((await pedir(g, 'POST', '/P1/messages', { recipient: { id: 'IGSID1' }, messaging_type: 'RESPONSE', message: { text: 'Claro' } })).message_id, 'sin participants: el cliente sale de los mensajes');
  assert.equal(g.st.conversaciones[0].messages.data.at(-1).from.id, 'IG1', 'lo enviado vuelve en el hilo con el from de la cuenta');
  assert.equal((await pedir(g, 'POST', '/P1/messages', { recipient: { id: 'IGSID1' }, messaging_type: 'RESPONSE', message: { text: 'x'.repeat(1000) } })).error.code, 100, 'el texto, de menos de 1.000 caracteres');
  g.st.fallar.adjuntos = true; assert.equal((await pedir(g, 'GET', '/t1?fields=messages{id,attachments}')).error.code, 100);
  g.st.fallar.sinAccesoMensajes = true; assert.equal((await pedir(g, 'GET', '/P1/conversations?platform=instagram')).error.code, 10);
});

test('la Bandeja (B1): respuestas anidadas, lo propio con su from, no se responde a un oculto ni a una respuesta, Facebook con is_hidden', async () => {
  const g = crearMetaStand();
  g.st.comentarios.M1 = [{ id: 'c1', text: '¿Precio?', username: 'ana' }, { id: 'c2', text: 'spam', username: 'bot' }];
  assert.ok((await pedir(g, 'POST', '/c1/replies', { message: 'US$ 20' })).id);
  const l = await pedir(g, 'GET', '/M1/comments?fields=id,text,replies{id,text,from}');
  assert.equal(l.data[0].replies.data[0].from.id, 'IG1', 'la respuesta propia lleva el from de la cuenta');
  const respuesta = g.st.comentarios.c1[0].id;
  g.st.comentarios.c1.push({ id: 'r9', text: 'gracias', username: 'ana', parent_id: 'c1' });
  assert.equal((await pedir(g, 'POST', '/r9/replies', { message: 'x' })).error.code, 100, 'a una respuesta no se le responde en Instagram');
  assert.equal((await pedir(g, 'POST', '/c2', { hide: true })).success, true);
  assert.match((await pedir(g, 'POST', '/c2/replies', { message: 'x' })).error.message, /hidden/);
  assert.ok(respuesta);
  g.st.comentarios.P1_5 = [{ id: 'P1_5_1', message: 'Hola', from: { id: 'U1', name: 'Luis' } }];
  assert.equal((await pedir(g, 'POST', '/P1_5_1', { is_hidden: true })).success, true);
  assert.equal(g.st.comentarios.P1_5[0].is_hidden, true);
  assert.equal((await pedir(g, 'POST', '/P1_5_1', { is_hidden: false })).success, true); assert.deepEqual(g.st.mostrados, ['P1_5_1']);
  g.st.fallar.isHidden = true;
  assert.equal((await pedir(g, 'GET', '/P1_5/comments?fields=id,message,is_hidden')).error.code, 100, 'is_hidden como campo de lectura: POR VERIFICAR');
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

test('insights (auditoría 1 nov 2026): con clics al enlace, también inline_link_click_ctr y cost_per_inline_link_click, distintos de los de todos los clics', async () => {
  const g = crearMetaStand();
  g.st.cifras = [
    { ad_id: 'AD1', adset_id: 'S1', campaign_id: 'C1', date_start: '2026-10-01', spend: '10', impressions: '1000', clicks: '17', inline_link_clicks: '10' },
    { ad_id: 'AD1', adset_id: 'S1', campaign_id: 'C1', date_start: '2026-10-02', spend: '10', impressions: '1000', clicks: '13', inline_link_clicks: '10' },
    { ad_id: 'AD2', adset_id: 'S1', campaign_id: 'C1', date_start: '2026-10-02', spend: '5', impressions: '500', clicks: '4' }, // Meta omite el campo cuando fue 0
  ];
  const rango = encodeURIComponent(JSON.stringify({ since: '2026-10-01', until: '2026-10-02' }));
  const diario = await pedir(g, 'GET', `/${CUENTA_STAND}/insights?level=ad&time_increment=1&time_range=${rango}`);
  const d1 = diario.data.find(f => f.ad_id === 'AD1' && f.date_start === '2026-10-01');
  assert.equal(Number(d1.inline_link_click_ctr), 1); assert.equal(Number(d1.cost_per_inline_link_click), 1);
  assert.equal(diario.data.find(f => f.ad_id === 'AD2').inline_link_click_ctr, undefined);
  const rango2 = (await pedir(g, 'GET', `/${CUENTA_STAND}/insights?level=ad&time_range=${rango}`)).data.find(f => f.ad_id === 'AD1');
  assert.equal(Number(rango2.clicks), 30); assert.equal(Number(rango2.inline_link_clicks), 20); assert.equal(Number(rango2.inline_link_click_ctr), 1, '20 clics de enlace en 2.000 impresiones = 1 %, no el 1,5 % de los 30 clics');
});

test('A2: spend_cap por debajo de US$100 lo rechaza Meta; validate_only al cambiar no cambia nada; lo archivado no se vuelve a encender', async () => {
  const g = crearMetaStand();
  assert.match((await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana({ spend_cap: SPEND_CAP_MINIMO_CENTAVOS - 1 }))).error.error_user_msg, /10000 centavos/);
  const c = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana({ spend_cap: SPEND_CAP_MINIMO_CENTAVOS }));
  assert.ok(c.id, 'US$100 justos, sí');
  assert.equal((await pedir(g, 'POST', `/${c.id}`, { spend_cap: 5000 })).error.code, 100);
  const v = await pedir(g, 'POST', `/${c.id}`, { status: 'ACTIVE', execution_options: ['validate_only'] });
  assert.equal(v.success, true); assert.equal(g.st.campanas[c.id].status, 'PAUSED', 'validar no cambia'); assert.equal(g.st.validadas.length, 1); assert.equal(g.st.cambios.length, 0);
  const bajo = await pedir(g, 'POST', `/${c.id}`, { daily_budget: 50, execution_options: ['validate_only'] });
  assert.equal(bajo.error.error_subcode, 1885272); assert.match(bajo.error.error_user_msg, /100 centavos/);
  await pedir(g, 'POST', `/${c.id}`, { status: 'ARCHIVED' }); assert.deepEqual(g.st.cambios.map(x => x.campos.status), ['ARCHIVED']);
  assert.match((await pedir(g, 'POST', `/${c.id}`, { status: 'ACTIVE' })).error.message, /archived/);
});

test('A2: copies síncrono con más de 3 anuncios da error; por partes (campaña sola, conjunto, anuncio) sí; validate_only no copia', async () => {
  const g = crearMetaStand();
  const c = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana());
  const s = await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: 's', optimization_goal: 'LINK_CLICKS', billing_event: 'IMPRESSIONS', targeting: segmentacion, status: 'PAUSED' });
  const cr = await pedir(g, 'POST', `/${CUENTA_STAND}/adcreatives`, { object_story_spec: { page_id: 'P1' } });
  const ads = []; for (let i = 0; i < 4; i++) ads.push((await pedir(g, 'POST', `/${CUENTA_STAND}/ads`, { adset_id: s.id, name: `a${i}`, creative: { creative_id: cr.id }, status: 'PAUSED' })).id);
  const n = Object.keys(g.st.campanas).length;
  const mucho = await pedir(g, 'POST', `/${c.id}/copies`, { deep_copy: true, status_option: 'PAUSED' });
  assert.equal(mucho.error.code, 100); assert.match(mucho.error.message, /more than 3/); assert.equal(Object.keys(g.st.campanas).length, n, 'no copió nada');
  assert.equal((await pedir(g, 'POST', `/${c.id}/copies`, { deep_copy: false, status_option: 'PAUSED', execution_options: ['validate_only'] })).success, true);
  assert.equal(Object.keys(g.st.campanas).length, n, 'validar no copia');
  const sola = await pedir(g, 'POST', `/${c.id}/copies`, { deep_copy: false, status_option: 'PAUSED' });
  assert.equal(Object.values(g.st.conjuntos).filter(x => x.campaign_id === sola.copied_campaign_id).length, 0, 'sin deep_copy, la campaña sola');
  assert.equal((await pedir(g, 'POST', `/${s.id}/copies`, { campaign_id: sola.copied_campaign_id, deep_copy: true, status_option: 'PAUSED' })).error.code, 100, 'el conjunto con 4 anuncios tampoco va de una vez');
  const cs = await pedir(g, 'POST', `/${s.id}/copies`, { campaign_id: sola.copied_campaign_id, deep_copy: false, status_option: 'PAUSED', end_time: '2026-11-01T00:00:00+0000' });
  assert.equal(g.st.conjuntos[cs.copied_adset_id].campaign_id, sola.copied_campaign_id); assert.equal(g.st.conjuntos[cs.copied_adset_id].end_time, '2026-11-01T00:00:00+0000');
  for (const a of ads) { const ca = await pedir(g, 'POST', `/${a}/copies`, { adset_id: cs.copied_adset_id, status_option: 'PAUSED' }); assert.equal(g.st.anuncios[ca.copied_ad_id].status, 'PAUSED'); }
  assert.equal(Object.values(g.st.anuncios).filter(x => x.adset_id === cs.copied_adset_id).length, 4);
});

test('A3: buscar por nombre (filtering), imágenes por su contenido, y los fallos «se cae tras el conjunto» y «el anuncio falla»', async () => {
  const g = crearMetaStand({ fallar: { trasConjunto: true, crearAnuncio: 1 } });
  const c = await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana({ name: 'Combo · AO:b7' }));
  await pedir(g, 'POST', `/${CUENTA_STAND}/campaigns`, campana({ name: 'Otra · AO:b8' }));
  const lista = async filtro => (await (await g.fetchFn(`${G}/${CUENTA_STAND}/campaigns?access_token=${TOKEN_STAND}&fields=id,name&filtering=${encodeURIComponent(JSON.stringify(filtro))}`)).json()).data;
  assert.deepEqual((await lista([{ field: 'name', operator: 'CONTAIN', value: 'AO:b7' }])).map(x => x.id), [c.id]);
  assert.equal((await lista([{ field: 'name', operator: 'EQUAL', value: 'Otra · AO:b8' }])).length, 1);
  // imágenes: el hash es del contenido (subir dos veces la misma da el mismo); en `bytes` (base64) la clave de la respuesta es «bytes»
  const subir = async datos => (await pedir(g, 'POST', `/${CUENTA_STAND}/adimages`, { bytes: Buffer.from(datos).toString('base64') })).images.bytes.hash;
  const h1 = await subir('foto-1'), h2 = await subir('foto-1'), h3 = await subir('foto-2');
  assert.equal(h1, h2); assert.notEqual(h1, h3); assert.equal(g.st.imagenes[h1].subidas, 2);
  assert.equal((await pedir(g, 'POST', `/${CUENTA_STAND}/adimages`, {})).error.code, 100, 'sin bytes, error');
  // el conjunto se crea y la respuesta no llega nunca (una vez)
  const colgada = g.fetchFn(`${G}/${CUENTA_STAND}/adsets`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams({ campaign_id: c.id, name: 'PA · AO:b7', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', status: 'PAUSED', targeting: JSON.stringify(segmentacion) }) });
  const gano = await Promise.race([colgada.then(() => 'contestó'), new Promise(r => setTimeout(() => r('colgada'), 100))]);
  assert.equal(gano, 'colgada'); assert.equal(g.st.colgadas, 1); assert.equal(Object.keys(g.st.conjuntos).length, 1, 'Meta lo creó igual');
  const s2 = await pedir(g, 'POST', `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: 'Otro', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', status: 'PAUSED', targeting: segmentacion });
  assert.ok(s2.id, 'solo una vez');
  const cr = await pedir(g, 'POST', `/${CUENTA_STAND}/adcreatives`, { name: 'k · AO:b7', object_story_spec: { page_id: 'P1' } });
  const a1 = await pedir(g, 'POST', `/${CUENTA_STAND}/ads`, { adset_id: s2.id, name: 'a', creative: { creative_id: cr.id }, status: 'PAUSED' });
  assert.equal(a1.error.code, 100); assert.match(a1.error.error_user_title, /no es válido/);
  assert.ok((await pedir(g, 'POST', `/${CUENTA_STAND}/ads`, { adset_id: s2.id, name: 'a', creative: { creative_id: cr.id }, status: 'PAUSED' })).id, 'el siguiente, sí');
  const vid = await g.fetchFn(`${G}/${CUENTA_STAND}/advideos`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: (() => { const f = new FormData(); f.append('name', 'v'); f.append('source', new Blob([Buffer.alloc(10)]), 'v.mp4'); return f; })() }).then(r => r.json());
  const ver = await (await g.fetchFn(`${G}/${vid.id}?access_token=${TOKEN_STAND}&fields=status,picture`)).json();
  assert.equal(ver.status.video_status, 'ready'); assert.match(ver.picture, /miniatura/);
});

test('A4: impulsar — boost_eligibility_info (IG), is_instagram_eligible (FB) y el creativo de una publicación ya hecha', async () => {
  const g = crearMetaStand({ media: [{ id: 'M1', caption: 'Hola' }], fallar: { noImpulsable: { M9: 'MUSIC_COPYRIGHT' }, noIG: ['P1_9'] } });
  const leer = async (id, fields) => (await g.fetchFn(`${G}/${id}?access_token=${TOKEN_STAND}&fields=${fields}`)).json();
  assert.deepEqual((await leer('M1', 'boost_eligibility_info')).boost_eligibility_info, { eligible_to_boost: true });
  assert.deepEqual((await leer('M9', 'boost_eligibility_info')).boost_eligibility_info, { eligible_to_boost: false, boost_ineligible_reason: 'MUSIC_COPYRIGHT' }, 'el modo «no elegible»');
  assert.equal((await leer('P1_8', 'is_instagram_eligible')).is_instagram_eligible, true);
  assert.equal((await leer('P1_9', 'is_instagram_eligible')).is_instagram_eligible, false);
  assert.equal((await leer('M1', 'permalink')).permalink, 'https://www.instagram.com/p/M1/', 'sin ese campo, lo de siempre');
  const cr = b => pedir(g, 'POST', `/${CUENTA_STAND}/adcreatives`, { name: 'Impulsar · AO:b1', ...b });
  assert.ok((await cr({ object_id: 'P1', instagram_user_id: 'IG1', source_instagram_media_id: 'M1' })).id);
  assert.equal((await cr({ source_instagram_media_id: 'M1' })).error.code, 100, 'sin object_id ni instagram_user_id, error');
  assert.equal((await cr({ object_id: 'P1', instagram_user_id: 'IG1', source_instagram_media_id: 'M9' })).error.code, 100, 'lo no elegible no se crea');
  assert.ok((await cr({ object_story_id: 'P1_9' })).id, 'un post de FB sin Instagram, sí');
  assert.equal((await cr({ object_story_id: 'P1_9', instagram_user_id: 'IG1' })).error.code, 100, 'con instagram_user_id, no');
});

test('A6: la API de conversiones — /<conjunto>/events con las reglas de Meta (lote entero rechazado, 7 días, cifrado, action_source)', async () => {
  const g = crearMetaStand(), ahora = Math.floor(g.st.reloj / 1000), h = 'a'.repeat(64);
  const bueno = { event_name: 'Purchase', event_time: ahora, event_id: 'ao_1', action_source: 'system_generated', user_data: { em: [h] }, custom_data: { value: 40, currency: 'USD' } };
  const ok = await pedir(g, 'POST', '/123456789/events', { data: [bueno], test_event_code: 'TEST1' });
  assert.equal(ok.events_received, 1); assert.equal(g.st.eventos[0].prueba, 'TEST1'); assert.equal(g.st.eventos[0].conjunto, '123456789');
  // un correo en claro, uno viejo, uno futuro, una fuente que no existe, una web sin dirección, mensajes sin canal, una compra sin importe, milisegundos
  for (const malo of [{ user_data: { em: ['ana@x.com'] } }, { event_time: ahora - 8 * 86400 }, { event_time: ahora + 3600 }, { action_source: 'tienda' }, { action_source: 'website' }, { action_source: 'business_messaging' }, { custom_data: {} }, { event_time: ahora * 1000 }]) {
    const r = await pedir(g, 'POST', '/123456789/events', { data: [bueno, { ...bueno, event_id: 'ao_2', ...malo }] });
    assert.equal(r.status, 400, JSON.stringify(malo)); assert.equal(r.error.code, 100);
  }
  assert.equal(g.st.eventos.length, 1, 'un lote con uno malo no deja entrar ninguno');
  const msj = await pedir(g, 'POST', '/123456789/events', { data: [{ event_name: 'LeadSubmitted', event_time: ahora, action_source: 'business_messaging', messaging_channel: 'messenger', user_data: { page_id: 'P1', page_scoped_user_id: '998877' } }] });
  assert.equal(msj.events_received, 1);
  g.st.fallar.conversiones = 1;
  const caido = await pedir(g, 'POST', '/123456789/events', { data: [bueno] }); assert.equal(caido.status, 500); assert.equal(caido.error.is_transient, true);
});
