// El método de campañas en la oficina (11 nov 2026): los números del negocio, la revisión 3Q sobre lo que la oficina lee de Meta y sus
// rutas. Contra el Meta de mentira (tests/meta-stand.mjs): la lectura por ventanas es UN lote, baja de escalón si Meta rechaza un campo,
// sin lectura se sale de las cifras diarias, un agente solo lee, y NADA de esto escribe en Meta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from './meta-stand.mjs';
import { crearMeta, PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';
import { crearMetaAds } from '../anuncios/meta-ads.mjs';
import { crearSincronizador } from '../anuncios/sincronizar.mjs';
import { crearRutasAnuncios } from '../anuncios/rutas.mjs';
import { crearMetodo } from '../anuncios/metodo.mjs';
import { ventanasDe, filasDeDiarias, numerosDe, fichaNegocio, textoNegocio, cambiosDelHistorial } from '../anuncios/metodo-core.mjs';
import { fechaEn, sumarDias } from '../anuncios/modelo.mjs';

const MENSAJE = 'onsite_conversion.messaging_conversation_started_7d';
const NEGOCIO = { tipo: 'servicios', destino: 'whatsapp', cuenta: 'historial', ticket: { valor: 120, origen: 'cliente' }, invertir: { valor: 20, origen: 'agencia' },
  metaVentas: { valor: 6000, origen: 'agencia' }, costos: [{ nombre: 'Producción', pct: 40 }] }; // objetivo: 1,20 por conversación · equilibrio 3,36

const pedir = async (g, ruta, campos) => (await g.fetchFn(`https://graph.test/v26.0${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` },
  body: new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])) })).json();

async function campana(g, nombre, { anuncios = 1 } = {}) {
  const c = await pedir(g, `/${CUENTA_STAND}/campaigns`, { name: nombre, objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], status: 'PAUSED' });
  const s = await pedir(g, `/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: `${nombre} · conjunto`, optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP',
    targeting: { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } }, status: 'PAUSED', daily_budget: 1000 });
  const cr = await pedir(g, `/${CUENTA_STAND}/adcreatives`, { name: 'k', object_story_spec: { page_id: 'P1' } });
  const a = []; for (let i = 0; i < anuncios; i++) a.push((await pedir(g, `/${CUENTA_STAND}/ads`, { adset_id: s.id, name: `${nombre} · anuncio ${i + 1}`, creative: { creative_id: cr.id }, status: 'PAUSED' })).id);
  for (const id of [c.id, s.id, ...a]) await pedir(g, `/${id}`, { status: 'ACTIVE' });
  return { c: c.id, s: s.id, a };
}

async function montar(t) {
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] });
  const sana = await campana(g, 'PanaClaw · Evaluación · Combo'), cara = await campana(g, 'PanaClaw · Presentación · Frío', { anuncios: 2 });
  const hoy = fechaEn('America/Panama');
  const fila = (ids, i, dias, spend, conv, extra = {}) => ({ ad_id: ids.a[i], adset_id: ids.s, campaign_id: ids.c, date_start: sumarDias(hoy, -dias), date_stop: sumarDias(hoy, -dias), spend: String(spend),
    impressions: '2000', reach: '1500', clicks: '60', inline_link_clicks: '40', ...(conv ? { actions: [{ action_type: MENSAJE, value: String(conv) }] } : {}), ...extra });
  g.st.cifras = [];
  for (let d = 1; d <= 20; d++) {
    g.st.cifras.push(fila(sana, 0, d, 5, 5, { unicos_rango: 300, quality_ranking: 'ABOVE_AVERAGE_35', engagement_rate_ranking: 'AVERAGE', conversion_rate_ranking: 'AVERAGE' })); // 1,00 por conversación
    g.st.cifras.push(fila(cara, 0, d, 8, 1, { unicos_rango: 200 })); // 8,00 por conversación: pasa del equilibrio
    g.st.cifras.push(fila(cara, 1, d, 2, 0, { unicos_rango: 50 }));
  }
  g.st.cifras.push(fila(sana, 0, 0, 99, 1)); // HOY no entra en ninguna ventana (días completos)
  // creadas hace 40 días: recién creadas, la regla del aprendizaje las deja «esperando» (se prueba aparte)
  const hace40 = new Date(Date.now() - 40 * 864e5).toISOString();
  for (const k of ['campanas', 'conjuntos', 'anuncios']) for (const x of Object.values(g.st[k])) { x.created_time = hace40; x.updated_time = hace40; if (x.learning_stage_info) x.learning_stage_info = { status: 'SUCCESS' }; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-metodo-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ya no está */ } });
  const meta = crearMeta({ env: { META_ACCESS_TOKEN: TOKEN_STAND, META_GRAPH_HOST: 'https://graph.test' }, fetchFn: g.fetchFn, dir });
  const ads = crearMetaAds({ meta }), dirAn = path.join(dir, 'anuncios');
  const sync = crearSincronizador({ meta, ads, dir: dirAn, ajustes: () => ({ cuenta: CUENTA_STAND }) });
  assert.deepEqual(await sync.sincronizar({ cifras: true }), { ok: true });
  const reloj = { t: Date.now() };
  const metodo = crearMetodo({ dir: dirAn, sync, ads, meta, empresa: () => 'PanaClaw', ahora: () => reloj.t });
  const json = (res, status, cuerpo) => { res.status = status; res.cuerpo = cuerpo; };
  const rutas = crearRutasAnuncios({ sync, meta, json, body: async (req) => req.cuerpo || {}, metodo });
  const call = async (ruta, cuerpo, method = cuerpo ? 'PUT' : 'GET') => { const res = {}; const url = new URL('http://o' + ruta); assert.equal(await rutas({ method, cuerpo, headers: {} }, res, url), true); return res; };
  return { g, sana, cara, hoy, metodo, call, reloj, dirAn, sync, ads };
}

test('lo puro: ventanas de días completos, respaldo desde las cifras diarias y el número mágico', () => {
  assert.deepEqual(ventanasDe('2026-11-11'), { 30: ['2026-10-12', '2026-11-10'], 14: ['2026-10-28', '2026-11-10'], 7: ['2026-11-04', '2026-11-10'] });
  const d = (dia, spend, conv) => ({ ad_id: 'A1', adset_id: 'S1', campaign_id: 'C1', date_start: dia, spend: String(spend), impressions: '100', clicks: '5', inline_link_clicks: '4', actions: [{ action_type: MENSAJE, value: String(conv) }] });
  const f = filasDeDiarias([d('2026-11-10', 2, 1), d('2026-11-05', 3, 2), d('2026-10-20', 10, 4), d('2026-11-11', 50, 9)], ventanasDe('2026-11-11'));
  assert.equal(f.campaign[7][0].spend, '5'); assert.equal(f.campaign[30][0].spend, '15'); assert.equal(f.ad[7][0].ad_id, 'A1'); assert.equal(f.adset[14][0].adset_id, 'S1');
  assert.equal(f.campaign[7][0].actions[0].value, '3', 'las conversaciones se suman');
  assert.equal(f.campaign[7][0].reach, undefined, 'el alcance no se suma entre días: no se inventa');
  const n = numerosDe(NEGOCIO, {});
  assert.equal(n.numero.metrica, 'Costo por conversación'); assert.ok(Math.abs(n.numeros.conversacion.objetivo - 1.2) < 1e-9); assert.ok(Math.abs(n.numeros.conversacion.equilibrio - 3.36) < 0.01);
  const ficha = fichaNegocio(NEGOCIO, {}); assert.match(textoNegocio(ficha), /NÚMERO MÁGICO · Costo por conversación: objetivo 1,20/); assert.equal(ficha.ciclo.objetivoMeta, 'OUTCOME_ENGAGEMENT');
  assert.deepEqual(cambiosDelHistorial([{ at: '2026-11-08T10:00:00Z', objeto: { id: '1' } }, { at: '2026-11-09T10:00:00Z', objeto: { id: '1' } }, { at: 'x', objeto: { id: '2' } }]), { 1: '2026-11-09' });
});

test('los números del negocio: se guardan limpios, solo el dueño, y un guardado cruzado no pisa', async (t) => {
  const o = await montar(t);
  let r = await o.call('/api/anuncios/metodo');
  assert.equal(r.status, 200); assert.equal(r.cuerpo.negocio.tieneNumeros, false); assert.match(r.cuerpo.texto, /Todavía no hay números/);
  assert.equal(r.cuerpo.negocio.negocio.presupuesto?.origen, 'meta', 'sin presupuesto escrito, lo gastado en 30 días leído de Meta');
  assert.equal((await o.call('/api/anuncios/metodo/negocio', { negocio: NEGOCIO, por: 'agente' })).status, 403);
  assert.equal((await o.call('/api/anuncios/metodo/negocio', { negocio: NEGOCIO, por: 'dimitri' })).status, 403);
  assert.equal((await o.call('/api/anuncios/metodo/negocio', { negocio: NEGOCIO, por: 'hacker' })).status, 403);
  r = await o.call('/api/anuncios/metodo/negocio', { negocio: { ...NEGOCIO, ticket: { valor: '120', origen: 'inventado' }, basura: 1 }, antes: null });
  assert.equal(r.status, 200); const ficha = r.cuerpo.negocio;
  assert.ok(Math.abs(ficha.objetivo.costoConversacion - 1.2) < 1e-9); assert.equal(ficha.negocio.basura, undefined); assert.equal(ficha.magico.alarma, false);
  assert.equal(ficha.reparto.length, 4); assert.equal(ficha.ciclo.etapas[0].id, 'presentacion');
  assert.equal((await o.call('/api/anuncios/metodo/negocio', { negocio: NEGOCIO, antes: null })).status, 409, 'quien abrió la ficha vacía ya no puede pisar lo guardado');
  assert.equal((await o.call('/api/anuncios/metodo/negocio', { negocio: { ...NEGOCIO, invertir: { valor: 70, origen: 'agencia' } }, antes: ficha.negocio.actualizado })).cuerpo.negocio.magico.alarma, true, 'invertir más que el margen: alarma');
  const sim = await o.call('/api/anuncios/metodo/simular', { entradas: { gasto: 500, cpm: 4, frecuencia: 2, ctrUnico: 2, pctConversion: 50 } }, 'POST');
  assert.equal(sim.cuerpo.ok, true); assert.equal(sim.cuerpo.escenarios.length, 3); assert.match(sim.cuerpo.texto, /Esperado/);
  const ciclo = await o.call('/api/anuncios/metodo/ciclo?tipo=cursos&destino=whatsapp'); assert.equal(ciclo.cuerpo.ciclo.destino, 'web'); assert.match(ciclo.cuerpo.texto, /no se venden por WhatsApp/);
});

test('la revisión 3Q: UN lote a Meta, veredictos contra el número mágico, la etapa por el nombre, y no se escribe nada en Meta', async (t) => {
  const o = await montar(t);
  await o.call('/api/anuncios/metodo/negocio', { negocio: NEGOCIO });
  const n0 = o.g.llamadas.length;
  const r = (await o.call('/api/anuncios/metodo/revision')).cuerpo;
  const nuevas = o.g.llamadas.slice(n0);
  assert.equal(nuevas.filter((l) => l.metodo === 'POST' && l.ruta === '/').length, 1, 'las nueve lecturas viajan en UN lote');
  assert.equal(nuevas.filter((l) => l.metodo !== 'GET' && l.ruta !== '/').length, 0, 'la revisión no escribe nada en Meta');
  assert.equal(r.configurado, true); assert.equal(r.leidoCon, 'completo'); assert.equal(r.cuenta.moneda, 'USD');
  assert.equal(r.q1Cuenta.ventanas[7].gasto, 105, 'siete días COMPLETOS: lo de hoy no entra'); assert.equal(r.q1Cuenta.ventanas[30].gasto, 300);
  const sana = r.campanas.find((c) => c.id === o.sana.c), cara = r.campanas.find((c) => c.id === o.cara.c);
  assert.equal(sana.etapa, 'evaluacion'); assert.equal(sana.etapaDe, 'nombre'); assert.equal(sana.conjuntos[0].q1, 'sano');
  assert.equal(sana.anuncios[0].veredicto.id, 'sano', 'efecto desglose: con el conjunto sano, sus anuncios no se tocan');
  assert.equal(sana.conjuntos[0].ventanas[7].ctrUnico > 0, true, 'los clics únicos llegaron por la lectura por ventanas');
  assert.equal(cara.etapa, 'presentacion'); assert.equal(cara.conjuntos[0].q1, 'pierde', '8 por conversación pasa del equilibrio (3,36)');
  assert.ok(['apagar', 'mejorar'].includes(cara.conjuntos[0].veredicto.id), cara.conjuntos[0].veredicto.id);
  assert.match(r.texto, /Revisión 3Q de las campañas de PanaClaw/); assert.match(r.texto, /Número mágico: costo por conversación 1,20/);
  assert.ok(r.resumen.pendientes >= 1);
  // la segunda vez no vuelve a Meta (la lectura vale 3 h); «fresco» tampoco antes de 10 min
  const n1 = o.g.llamadas.length; await o.call('/api/anuncios/metodo/revision'); await o.call('/api/anuncios/metodo/revision?fresco=1');
  assert.equal(o.g.llamadas.length, n1);
  o.reloj.t += 11 * 60e3; await o.call('/api/anuncios/metodo/revision?fresco=1'); assert.equal(o.g.llamadas.slice(n1).filter((l) => l.metodo === 'POST' && l.ruta === '/').length, 1, 'pasados 10 minutos, «léelo ahora» sí (otro lote)');
  // la etapa a mano de una campaña cuyo nombre no la dice; un id raro se ignora
  const et = await o.call('/api/anuncios/metodo/etapas', { etapas: { 120330001: 'conversion', 'no-es-id': 'conversion', 120330002: 'inventada' }, por: 'dimitri' });
  assert.deepEqual(et.cuerpo.etapas, { 120330001: 'conversion' }, 'solo ids de Meta y etapas que existen');
  assert.equal((await o.call('/api/anuncios/metodo/etapas', { etapas: {}, por: 'agente' })).status, 403);
  // el Manual: umbrales fuera de rango vuelven al de partida
  const man = await o.call('/api/anuncios/metodo/manual', { umbrales: { ctrUnico: 3, frecuencia: 999 }, tasaCierre: '10' });
  assert.equal(man.cuerpo.umbrales.ctrUnico, 3); assert.equal(man.cuerpo.umbrales.frecuencia, 3); assert.equal(man.cuerpo.tasaCierre, 10);
  assert.equal((await o.call('/api/anuncios/metodo')).cuerpo.negocio.objetivo.costoConversacion.toFixed(2), '2.40', 'con 10 % de cierre, el doble por conversación');
});

test('si Meta rechaza los campos nuevos se baja de escalón; si no se puede leer, la revisión sale de las cifras diarias y lo dice', async (t) => {
  const o = await montar(t);
  o.g.st.fallar.sinRankings = true;
  let r = (await o.call('/api/anuncios/metodo/revision')).cuerpo;
  assert.equal(r.leidoCon, 'sin-rankings'); assert.match(r.avisoLectura, /rankings/);
  o.g.st.fallar.sinCamposNuevos = true; o.reloj.t += 4 * 3600e3;
  r = (await o.call('/api/anuncios/metodo/revision')).cuerpo;
  assert.equal(r.leidoCon, 'basico'); assert.equal(r.q1Cuenta.ventanas[7].gasto, 105);
  // Meta caído: la lectura de hoy se conserva; al día siguiente, sin lectura, salen las diarias
  fs.rmSync(path.join(o.dirAn, 'revision3q.json')); o.g.st.fallar.limite = 5;
  r = (await o.call('/api/anuncios/metodo/revision')).cuerpo;
  assert.equal(r.configurado, true); assert.equal(r.leidoCon, 'diario'); assert.match(r.avisoLectura, /cifras diarias/); assert.match(r.avisoLectura, /No se pudo leer de Meta/);
  assert.equal(r.q1Cuenta.ventanas[7].gasto, 105, 'las mismas cifras, sumadas de lo diario');
  assert.equal(r.campanas.find((c) => c.id === o.sana.c).conjuntos[0].ventanas[7].ctrUnico, null, 'sin lectura por ventanas no hay CTR único: no se inventa');
  const t2 = (await o.call('/api/anuncios/metodo/texto?que=revision&por=agente')).cuerpo.texto; assert.match(t2, /Revisión 3Q/);
});
