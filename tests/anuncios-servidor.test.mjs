// Fase A1 de Anuncios (8 oct 2026), contra el serve.mjs REAL (carpeta temporal) y el Meta de mentira (tests/meta-stand.mjs) como Graph:
// sin cuenta no se lee; con cuenta, la estructura con sus estados en palabras, el aprendizaje, un rechazado con su motivo y UN aviso,
// las cifras y el costo por resultado, el freno de Meta (uso al 80 % → todo más espaciado), el token nunca en disco ni en una respuesta,
// y un agente que lee pero no cambia nada. Se espera AL HECHO (bucles con tope), nunca un tiempo fijo corto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearMetaStand, TOKEN_STAND, TOKEN_PAGINA_STAND, CUENTA_STAND } from './meta-stand.mjs';
import { PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';
import { fechaEn, sumarDias } from '../anuncios/modelo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const esperar = async (fn, { max = 60000, cada = 250, que = 'algo' } = {}) => { const t0 = Date.now(); for (;;) { const r = await fn(); if (r) return r; if (Date.now() - t0 > max) throw new Error(`no llegó a tiempo: ${que}`); await new Promise(x => setTimeout(x, cada)); } };

/** Lo que hay en Meta: una campaña de la oficina (mensajes por WhatsApp) con un anuncio activo, uno rechazado y uno en pausa; otra campaña creada fuera. */
async function prepararMeta(g) {
  const pedir = async (ruta, campos) => { const r = await g.fetchFn(`https://graph.test/v26.0${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])) }); return r.json(); };
  const c1 = await pedir(`/${CUENTA_STAND}/campaigns`, { name: 'Mensajes Panamá · AO:b1', objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], status: 'PAUSED', daily_budget: 1500, spend_cap: 15000 });
  const s1 = await pedir(`/${CUENTA_STAND}/adsets`, { campaign_id: c1.id, name: 'Panamá 18+ · AO:b1', optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', targeting: { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } }, status: 'PAUSED' });
  const cr = await pedir(`/${CUENTA_STAND}/adcreatives`, { name: 'Combo', object_story_spec: { page_id: 'P1', instagram_user_id: 'IG1', link_data: { message: 'Escríbenos por WhatsApp', name: 'Combo del mes', call_to_action: { type: 'WHATSAPP_MESSAGE' } } } });
  const ad = async n => (await pedir(`/${CUENTA_STAND}/ads`, { adset_id: s1.id, name: n, creative: { creative_id: cr.id }, status: 'PAUSED' })).id;
  const a1 = await ad('Combo foto · AO:b1'), a2 = await ad('Combo promesa · AO:b1'), a3 = await ad('Combo video · AO:b1');
  g.st.fallar.rechazar = [a2];
  for (const id of [c1.id, s1.id, a1, a2]) await pedir(`/${id}`, { status: 'ACTIVE' });
  const c2 = await pedir(`/${CUENTA_STAND}/campaigns`, { name: 'Del Administrador de anuncios', objective: 'OUTCOME_TRAFFIC', special_ad_categories: [], status: 'PAUSED' });
  const hoy = fechaEn('America/Panama'), ayer = sumarDias(hoy, -1);
  const fila = (fecha, spend, conv, reach) => ({ ad_id: a1, adset_id: s1.id, campaign_id: c1.id, date_start: fecha, date_stop: fecha, spend: String(spend), impressions: '1000', reach: String(reach), clicks: '20', inline_link_clicks: '15', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: String(conv) }, { action_type: 'link_click', value: '15' }] });
  g.st.cifras = [fila(hoy, 4.8, 3, 700), fila(ayer, 2, 1, 600)];
  return { c1: c1.id, s1: s1.id, a1, a2, a3, c2: c2.id };
}

async function oficina(t, g) {
  const graph = await g.escuchar();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-anuncios-')), brain = path.join(dir, 'brain'), local = path.join(dir, 'office.config.local.json');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: local,
    ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', CLAUDE_BIN: path.join(dir, 'no-claude.exe'),
    META_ACCESS_TOKEN: TOKEN_STAND, META_APP_SECRET: '', META_GRAPH_HOST: graph.url, META_GRAPH_VERSION: '',
    TELEGRAM_BOT_TOKEN: '', METRICOOL_USER_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(async () => { srv.kill(); await graph.cerrar(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  await esperar(async () => { try { return (await fetch(base + '/api/health')).ok; } catch { return false; } }, { max: 30000, que: 'la oficina arranca: ' + log.slice(-300) });
  const crudo = [];
  const call = async (p, b, method = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); const texto = await r.text(); crudo.push(texto); let j = {}; try { j = JSON.parse(texto); } catch {} return { status: r.status, j }; };
  return { base, call, dir, local, crudo, log: () => log };
}

test('Anuncios A1: sin cuenta no se lee; con cuenta, estructura, estados, aprendizaje, un rechazado avisado una vez, cifras, el freno, y nada del token fuera', { timeout: 180000 }, async t => {
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] });
  const ids = await prepararMeta(g), n0 = g.llamadas.length; // lo de preparar no cuenta
  const o = await oficina(t, g);

  // 1) sin cuenta publicitaria: el panel lo dice y no se llama a Meta
  let v = (await o.call('/api/anuncios')).j;
  assert.equal(v.configurado, false); assert.match(v.motivo, /cuenta publicitaria/); assert.equal(v.ejemplo, false); assert.deepEqual(v.campanas, []); assert.equal(v.cuenta, null);
  assert.equal((await o.call('/api/anuncios/sincronizar', {})).status, 409);
  assert.equal(g.llamadas.slice(n0).filter(l => l.ruta.startsWith('/act_') || l.ruta === '/').length, 0, 'sin cuenta, la oficina no pregunta a la Marketing API');

  // 2) la cuenta en el archivo local (act_1001 tiene 4 cifras: Ajustes no la aceptaría, así que va a mano) y un cambio por Ajustes la recarga
  fs.writeFileSync(o.local, JSON.stringify({ anuncios: { cuenta: CUENTA_STAND } }));
  const aj = await o.call('/api/settings', { changes: { 'anuncios.topeDiario': 5 } }); assert.deepEqual(aj.j.errors, []);
  v = (await o.call('/api/anuncios')).j; assert.equal(v.configurado, true, JSON.stringify(v.motivo)); assert.equal(v.motivo, ''); assert.equal(v.topes.diario, 5); assert.equal(v.topes.mensual, 300, 'el tope mensual por defecto de Ajustes');

  // 3) leer de Meta (puede que el reloj de la oficina ya haya empezado: un 409 vale) y esperar a que termine
  const s = await o.call('/api/anuncios/sincronizar', {}); assert.ok([202, 409].includes(s.status), JSON.stringify(s.j));
  v = await esperar(async () => { const x = (await o.call('/api/anuncios')).j; return x.sincronizadaAt && x.cifrasAt && !x.sincronizando ? x : null; }, { que: 'la primera lectura de Meta' });
  assert.equal(v.error, null, v.error);
  assert.equal(v.cuenta.id, CUENTA_STAND); assert.equal(v.cuenta.moneda, 'USD'); assert.equal(v.cuenta.zona, 'America/Panama'); assert.equal(v.cuenta.estadoTexto, 'Activa');
  const c1 = v.campanas.find(c => c.id === ids.c1), c2 = v.campanas.find(c => c.id === ids.c2);
  assert.equal(c1.nombre, 'Mensajes Panamá'); assert.equal(c1.creadoFuera, false); assert.equal(c1.estadoTexto, 'Activa'); assert.deepEqual(c1.presupuesto, { tipo: 'diario', usd: 15 }); assert.equal(c1.spendCap, 150);
  assert.equal(c2.creadoFuera, true, 'lo que no lleva la etiqueta se creó fuera'); assert.equal(c2.estadoTexto, 'En pausa');
  const s1 = c1.conjuntos[0];
  assert.equal(s1.aprendizaje.estado, 'LEARNING'); assert.equal(s1.aprendizaje.texto, 'Aprendiendo'); assert.equal(s1.publico, 'Panamá · 18+ · Advantage+'); assert.equal(s1.destino, 'WHATSAPP');
  const a1 = s1.anuncios.find(a => a.id === ids.a1), a2 = s1.anuncios.find(a => a.id === ids.a2), a3 = s1.anuncios.find(a => a.id === ids.a3);
  assert.equal(a1.estadoTexto, 'Activa'); assert.equal(a3.estadoTexto, 'En pausa');
  assert.equal(a2.estadoTexto, 'Rechazado por Meta'); assert.match(a2.revision[0], /Texto engañoso/);
  assert.equal(a1.creativo.texto, 'Escríbenos por WhatsApp'); assert.equal(a1.creativo.titulo, 'Combo del mes'); assert.equal(a1.creativo.llamada, 'WHATSAPP_MESSAGE');
  assert.equal(a1.cifras.gasto, 6.8); assert.equal(a1.cifras.resultados, 4); assert.equal(a1.cifras.resultadoTexto, 'conversaciones iniciadas'); assert.equal(a1.cifras.costoPorResultado, 1.7);
  assert.equal(a1.cifras.alcance, 700, 'el alcance del rango llega aparte (personas únicas), no 700 + 600'); assert.equal(a1.cifras.ctr, 2);
  assert.deepEqual(v.gasto, { hoy: 4.8, semana: 6.8, mes: v.gasto.mes }); assert.ok(v.gasto.mes >= 4.8);
  assert.equal(v.resumen.resultados7d, 4); assert.equal(v.resumen.costoPorResultado7d, 1.7);
  assert.ok(v.avisos.some(a => a.nivel === 'bad' && /rechazó un anuncio/.test(a.texto)), JSON.stringify(v.avisos));
  assert.ok(v.avisos.some(a => /de hoy va en US\$4\.80 de un tope de 5\.00/.test(a.texto)), 'más del 90 % del tope diario');
  const hoy = (await o.call('/api/anuncios?rango=hoy')).j; assert.equal(hoy.campanas.find(c => c.id === ids.c1).conjuntos[0].anuncios.find(a => a.id === ids.a1).cifras.gasto, 4.8);
  assert.ok(g.llamadas.some(l => l.metodo === 'POST' && l.ruta === '/' && !l.enLote), 'la estructura va en un lote');
  assert.ok(g.llamadas.slice(n0).every(l => l.metodo === 'GET' || (l.metodo === 'POST' && l.ruta === '/')), 'en A1 nada escribe en Meta: solo GET y lotes de GET');

  // 4) los avisos: el rechazado y el tope, UNA vez aunque se vuelva a leer
  const avisosDe = async () => (await o.call('/api/status')).j.notices.filter(n => n.kind === 'anuncios');
  const antes = await avisosDe();
  assert.equal(antes.filter(n => n.text.includes(ids.a2)).length, 1, JSON.stringify(antes)); assert.equal(antes.filter(n => /90 %/.test(n.text)).length, 1);
  const prev = v.sondeoAt;
  await esperar(async () => (await o.call('/api/anuncios/sincronizar', {})).status === 202, { que: 'una segunda lectura' });
  await esperar(async () => { const x = (await o.call('/api/anuncios')).j; return x.sondeoAt !== prev && !x.sincronizando; }, { que: 'que termine la segunda lectura' });
  assert.equal((await avisosDe()).filter(n => n.text.includes(ids.a2)).length, 1, 'el mismo rechazo no se avisa dos veces');

  // 5) el freno: Meta dice que va al 80 % de su cuota → el sondeo se espacia (×2)
  g.st.uso = { app: 80, negocio: 10, cuenta: 5 };
  const prev2 = (await o.call('/api/anuncios')).j.sondeoAt;
  await esperar(async () => (await o.call('/api/anuncios/sincronizar', {})).status === 202, { que: 'leer con el uso alto' });
  v = await esperar(async () => { const x = (await o.call('/api/anuncios')).j; return x.sondeoAt !== prev2 && !x.sincronizando ? x : null; }, { que: 'que termine la lectura con el uso alto' });
  assert.equal(v.uso.pct, 80); assert.equal(v.uso.ritmo, 2); assert.equal(v.sondeo.ritmo, 2); assert.equal(v.sondeo.estructuraMin, 120, '60 min con el panel cerrado, por 2'); assert.equal(v.sondeo.cifrasMin, 120);
  await o.call('/api/anuncios?abierto=1'); assert.equal((await o.call('/api/anuncios')).j.sondeo.estructuraMin, 30, 'con el panel abierto, 15 min por 2');
  g.st.uso = null;

  // 6) un agente lee, pero no cambia nada; el dueño tampoco tiene cambios en A1
  assert.equal((await o.call('/api/anuncios?por=agente')).j.campanas.length, 2);
  assert.equal((await o.call('/api/anuncios/pausar', { por: 'agente', id: ids.c1 })).status, 403);
  assert.equal((await o.call(`/api/anuncios/objeto/${ids.c1}`, { por: 'agente', status: 'PAUSED' })).status, 403);
  assert.equal((await o.call('/api/anuncios/pausar', { id: ids.c1 })).status, 404, 'en A1 no hay cambios, ni para el dueño');
  const ag = await esperar(async () => { const r = await o.call('/api/anuncios/sincronizar', { por: 'agente' }); return r.status === 409 && /ya se está leyendo/.test(r.j.error) ? null : r; }, { que: 'la lectura que pide un agente' });
  assert.equal(ag.status, 202);
  await esperar(async () => !(await o.call('/api/anuncios')).j.sincronizando, { que: 'que termine la lectura del agente' });
  assert.equal((await o.call('/api/anuncios/sincronizar', { por: 'agente' })).status, 429, 'un agente, una vez cada 10 minutos');
  assert.ok(g.llamadas.slice(n0).every(l => l.metodo === 'GET' || (l.metodo === 'POST' && l.ruta === '/')), 'tampoco después: nada escribe en Meta');

  // 7) lo que leen Dimitri, los agentes, el asistente y Estado
  assert.deepEqual((await o.call('/api/anuncios/historial')).j, { items: [] });
  const txt = (await o.call('/api/anuncios/texto?que=resultados&nivel=anuncio&rango=7d')).j.texto;
  assert.match(txt, new RegExp(`${ids.a2} · «Combo promesa» · Rechazado por Meta[\\s\\S]*PROBLEMA: Texto engañoso`));
  assert.match((await o.call(`/api/anuncios/objeto/${ids.s1}`)).j.texto, /Aprendiendo/);
  assert.equal((await o.call('/api/anuncios/objeto/NOEXISTE')).status, 404);
  const estado = (await o.call('/api/oficina/estado')).j.texto;
  assert.match(estado, /Anuncios de Meta \(cifras de los últimos 7 días/); assert.match(estado, new RegExp(ids.c1)); assert.match(estado, /4 conversaciones iniciadas a US\$1\.70/);
  const fila = (await o.call('/api/status')).j.checks.find(c => c.id === 'anuncios');
  assert.equal(fila.state, 'ok', JSON.stringify(fila)); assert.match(JSON.stringify(fila), /Última lectura/);
  const pub = (await o.call('/api/costs')).j.publicidad;
  assert.equal(pub.semana.gasto, 6.8); assert.equal(pub.semana.resultados, 4); assert.match(pub.texto, /aparte del costo de los modelos/);
  const costos = fs.existsSync(path.join(o.dir, 'data', 'costs.jsonl')) ? fs.readFileSync(path.join(o.dir, 'data', 'costs.jsonl'), 'utf8') : '';
  assert.doesNotMatch(costos, /anuncio|publicidad/i, 'el dinero de Meta nunca entra en el registro del costo de los modelos');
  assert.ok([200, 404].includes((await fetch(o.base + '/anuncios-vista.js')).status), 'el paquete del panel se sirve, o se dice que falta, sin romper');

  // 8) el token: ni en disco ni en ninguna respuesta
  const archivos = []; const recorrer = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) recorrer(p); else archivos.push(p); } };
  recorrer(path.join(o.dir, 'data'));
  assert.ok(archivos.some(f => f.endsWith(path.join('anuncios', 'cuenta.json'))) && archivos.some(f => f.includes(path.join('anuncios', 'cifras'))), 'lo leído vive en data/anuncios/');
  for (const f of archivos) { const c = fs.readFileSync(f, 'utf8'); assert.ok(!c.includes(TOKEN_STAND) && !c.includes(TOKEN_PAGINA_STAND), `el token está en ${f}`); }
  for (const r of o.crudo) assert.ok(!r.includes(TOKEN_STAND) && !r.includes(TOKEN_PAGINA_STAND), 'el token salió en una respuesta');
});
