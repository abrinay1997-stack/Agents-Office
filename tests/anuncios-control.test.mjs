// Fase A2 de Anuncios (9 oct 2026): CONTROLAR contra el serve.mjs REAL (carpeta temporal) y el Meta de mentira como Graph. La regla del
// dinero en el SERVIDOR (plan §3): pausar y deshacer; bajar un presupuesto; activar sin confirmación no cambia nada y dice la cifra; con
// ella, sí, una vez; por encima del tope, 409 con la cifra; Meta rechaza un presupuesto bajo (422); relanzar una terminada = copia en
// pausa; un agente y el asistente no gastan; Dimitri pide la cifra y el dueño da el segundo clic; todo en el historial y en data/audit.
// Se espera AL HECHO (bucles con tope), nunca un tiempo fijo corto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearMetaStand, TOKEN_STAND, CUENTA_STAND } from './meta-stand.mjs';
import { PERMISOS_LECTURA, PERMISOS_ANUNCIOS } from '../contenido/meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const esperar = async (fn, { max = 60000, cada = 250, que = 'algo' } = {}) => { const t0 = Date.now(); for (;;) { const r = await fn(); if (r) return r; if (Date.now() - t0 > max) throw new Error(`no llegó a tiempo: ${que}`); await new Promise(x => setTimeout(x, cada)); } };
const SEG = { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } };

async function prepararMeta(g) {
  const pedir = async (ruta, campos) => (await g.fetchFn(`https://graph.test/v26.0${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])) })).json();
  const campana = async (nombre, { activa = false, diario, cap, anuncios = 1, fin } = {}) => {
    const c = await pedir(`/${CUENTA_STAND}/campaigns`, { name: `${nombre} · AO:b1`, objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], status: 'PAUSED', daily_budget: diario, spend_cap: cap, ...(fin ? { start_time: '2026-01-01T00:00:00+0000', stop_time: fin } : {}) });
    const s = await pedir(`/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: `${nombre} PA`, optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', targeting: SEG, status: 'PAUSED', ...(fin ? { end_time: fin } : {}) });
    const cr = await pedir(`/${CUENTA_STAND}/adcreatives`, { name: 'k', object_story_spec: { page_id: 'P1' } });
    for (let i = 0; i < anuncios; i++) { const a = await pedir(`/${CUENTA_STAND}/ads`, { adset_id: s.id, name: `${nombre} ${i}`, creative: { creative_id: cr.id }, status: 'PAUSED' }); await pedir(`/${a.id}`, { status: 'ACTIVE' }); }
    await pedir(`/${s.id}`, { status: 'ACTIVE' }); if (activa) await pedir(`/${c.id}`, { status: 'ACTIVE' });
    return c.id;
  };
  return { activa: await campana('Mensajes', { activa: true, diario: 1000, cap: 10000 }), combo: await campana('Combo', { diario: 1500, cap: 15000 }), grande: await campana('Grande', { diario: 2500, cap: 20000 }), vieja: await campana('Vieja', { diario: 500, cap: 10000, fin: '2026-01-11T00:00:00+0000' }) };
}

async function oficina(t, g) {
  const graph = await g.escuchar();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-anuncios-a2-')), brain = path.join(dir, 'brain'), local = path.join(dir, 'office.config.local.json');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  fs.writeFileSync(local, JSON.stringify({ anuncios: { cuenta: CUENTA_STAND, topeDiario: 30, topeMensual: 300, topeCampana: 150 } }));
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
  const call = async (p, b) => { const r = await fetch(base + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); let j = {}; try { j = await r.json(); } catch {} return { status: r.status, j }; };
  return { base, call, dir, log: () => log };
}

test('Anuncios A2: pausar y deshacer, presupuestos, los dos clics del dinero, los topes, Meta que rechaza, relanzar, y quién puede qué', { timeout: 240000 }, async t => {
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] });
  const ids = await prepararMeta(g);
  const o = await oficina(t, g);
  await esperar(async () => [202, 409].includes((await o.call('/api/anuncios/sincronizar', {})).status), { que: 'pedir la lectura' });
  await esperar(async () => { const x = (await o.call('/api/anuncios')).j; return x.sincronizadaAt && x.cifrasAt && !x.sincronizando && x.campanas?.length === 4; }, { que: 'la primera lectura de Meta' });
  const estado = id => g.st.campanas[id].status;

  // 1) pausar es un clic y se deshace
  let r = await o.call('/api/anuncios/accion', { tipo: 'pausar', id: ids.activa });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.ok, true); assert.equal(estado(ids.activa), 'PAUSED'); assert.ok(r.j.deshacer?.token && Date.parse(r.j.deshacer.hasta));
  assert.equal((await o.call('/api/anuncios/deshacer', { token: r.j.deshacer.token, por: 'agente' })).status, 403);
  const d = await o.call('/api/anuncios/deshacer', { token: r.j.deshacer.token });
  assert.equal(d.status, 200, JSON.stringify(d.j)); assert.equal(estado(ids.activa), 'ACTIVE');

  // 2) bajar el presupuesto, y Meta que rechaza uno demasiado bajo (validate_only)
  r = await o.call('/api/anuncios/accion', { tipo: 'bajar_presupuesto', id: ids.activa, valor: 8 });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(g.st.campanas[ids.activa].daily_budget, '800');
  r = await o.call('/api/anuncios/accion', { tipo: 'bajar_presupuesto', id: ids.activa, valor: 0.5 });
  assert.equal(r.status, 422); assert.equal(r.j.error, 'meta'); assert.match(r.j.motivo, /demasiado bajo/); assert.equal(r.j.minimo, 1); assert.equal(g.st.campanas[ids.activa].daily_budget, '800');

  // 3) activar: sin confirmación nada cambia; con ella, sí, una vez
  const n = g.st.cambios.length;
  r = await o.call('/api/anuncios/accion', { tipo: 'activar', id: ids.combo });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.match(r.j.confirmar.texto, /^Activar «Combo» — gasta hasta US\$15 al día, US\$\d+ esta semana$/);
  assert.equal(r.j.confirmar.cifras.dia, 15); assert.ok(Date.parse(r.j.confirmar.vence) > Date.now());
  assert.equal(g.st.cambios.length, n, 'nada cambió en Meta'); assert.equal(estado(ids.combo), 'PAUSED');
  const ok = await o.call('/api/anuncios/accion', { tipo: 'activar', id: ids.combo, confirmacion: r.j.confirmar.token });
  assert.equal(ok.status, 200, JSON.stringify(ok.j)); assert.equal(estado(ids.combo), 'ACTIVE');
  const otra = await o.call('/api/anuncios/accion', { tipo: 'activar', id: ids.combo, confirmacion: r.j.confirmar.token });
  assert.equal(otra.status, 409); assert.equal(otra.j.error, 'confirmacion');

  // 4) por encima del tope diario (8 + 15 ya activos + 25 = 48 > 30): 409 con la cifra, y nada cambia
  r = await o.call('/api/anuncios/accion', { tipo: 'activar', id: ids.grande });
  assert.equal(r.status, 409); assert.equal(r.j.error, 'tope'); assert.equal(r.j.tope, 30); assert.equal(r.j.quedaria, 48); assert.match(r.j.motivo, /US\$48 al día contra US\$30/);
  assert.equal(estado(ids.grande), 'PAUSED'); assert.equal(g.st.validadas.filter(x => x.id === ids.grande).length, 0);

  // 5) relanzar una terminada: una copia EN PAUSA
  r = await o.call('/api/anuncios/accion', { tipo: 'relanzar', id: ids.vieja });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.match(r.j.confirmar.texto, /como copia EN PAUSA/);
  r = await o.call('/api/anuncios/accion', { tipo: 'relanzar', id: ids.vieja, confirmacion: r.j.confirmar.token });
  assert.equal(r.status, 200, JSON.stringify(r.j)); const copia = r.j.hecho.despues.copia;
  assert.equal(estado(copia), 'PAUSED'); assert.match(g.st.campanas[copia].name, / · AO:r/);

  // 6) un agente: 403 en todo; el asistente: pausar sí, gastar no (403 con el porqué)
  assert.equal((await o.call('/api/anuncios/accion', { tipo: 'pausar', id: ids.combo, por: 'agente' })).status, 403);
  assert.equal((await o.call('/api/anuncios/accion?por=agente', { tipo: 'activar', id: ids.grande })).status, 403);
  const asG = await o.call('/api/oficina/accion', { op: { type: 'anuncio_activar', id: ids.grande } });
  assert.equal(asG.status, 403); assert.match(asG.j.error, /gasta dinero/);
  assert.equal((await o.call('/api/anuncios/accion', { tipo: 'activar', id: ids.grande, por: 'asistente' })).status, 403, 'tampoco por la puerta de Anuncios');
  const asP = await o.call('/api/oficina/accion', { op: { type: 'anuncio_pausar', id: ids.combo } });
  assert.equal(asP.status, 200, JSON.stringify(asP.j)); assert.equal(estado(ids.combo), 'PAUSED'); assert.ok(!asP.j.deshacer, 'el asistente no deshace: vuelve a gastar');

  // 7) Dimitri: su op de gasto devuelve la cifra y NO cambia nada; el segundo clic del dueño lo hace y deja la tarjeta hecha
  const msg = 'm-dimitri-a2', subFile = path.join(o.dir, 'data', 'subgerente.json');
  fs.writeFileSync(subFile, JSON.stringify({ messages: [{ id: msg, who: 'sub', text: 'Reanudo «Combo».', at: Date.now(), mode: 'plan', ops: [{ k: 0, type: 'anuncio_reanudar', id: ids.combo, state: 'proposed', title: 'Combo' }, { k: 1, type: 'anuncio_bajar_presupuesto', id: ids.activa, valor: 7, state: 'proposed', title: 'Mensajes' }] }] }));
  const ops = await o.call('/api/sub/ops', { msg, items: [{ k: 0 }, { k: 1 }] });
  assert.equal(ops.status, 200, JSON.stringify(ops.j));
  const [op0, op1] = ops.j.message.ops;
  assert.equal(op0.state, 'confirmar', JSON.stringify(op0)); assert.match(op0.confirmar.texto, /^Reanudar «Combo» — gasta hasta US\$15 al día/); assert.equal(op0.nombre, 'Combo'); assert.equal(op0.moneda, 'USD');
  assert.equal(estado(ids.combo), 'PAUSED', 'nada hasta el segundo clic');
  assert.equal(op1.state, 'done', JSON.stringify(op1)); assert.equal(g.st.campanas[ids.activa].daily_budget, '700', 'bajar es libre: lo hace el clic de la tarjeta');
  assert.equal(ops.j.confirmar[0].token, op0.confirmar.token);
  assert.equal((await o.call('/api/anuncios/accion', { tipo: 'reanudar', id: ids.combo, por: 'dimitri', confirmacion: op0.confirmar.token })).status, 403, 'Dimitri no confirma');
  const segundo = await o.call('/api/anuncios/accion', { tipo: 'reanudar', id: ids.combo, confirmacion: op0.confirmar.token });
  assert.equal(segundo.status, 200, JSON.stringify(segundo.j)); assert.equal(estado(ids.combo), 'ACTIVE');
  const guardado = JSON.parse(fs.readFileSync(subFile, 'utf8')).messages.find(m => m.id === msg).ops[0];
  assert.equal(guardado.state, 'done'); assert.ok(guardado.desc); assert.equal(guardado.confirmar, undefined);
  const undo1 = await o.call('/api/sub/ops/undo', { msg, k: 1 });
  assert.equal(undo1.status, 200, JSON.stringify(undo1.j)); assert.equal(g.st.campanas[ids.activa].daily_budget, '800', 'DESHACER de la tarjeta (el clic del dueño) vuelve a como estaba');

  // 8) el historial (lo más nuevo primero) y data/audit
  const h = (await o.call('/api/anuncios/historial')).j.items;
  assert.equal(h[0].que, 'deshacer:bajar_presupuesto');
  for (const que of ['pausar', 'deshacer:pausar', 'bajar_presupuesto', 'activar', 'relanzar', 'reanudar']) assert.ok(h.some(x => x.que === que), que);
  assert.ok(h.some(x => x.quien === 'asistente' && x.que === 'pausar')); assert.ok(h.some(x => x.quien === 'dimitri')); assert.ok(h.some(x => x.quien === 'dueno' && x.propuso === 'dimitri'));
  const aud = fs.readdirSync(path.join(o.dir, 'data', 'audit')).map(f => fs.readFileSync(path.join(o.dir, 'data', 'audit', f), 'utf8')).join('').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(x => x.kind === 'anuncios');
  assert.ok(aud.filter(x => x.ok).length >= 7, JSON.stringify(aud.length)); assert.ok(aud.some(x => x.ok === false && x.que === 'activar'), 'el intento por encima del tope también');
  for (const f of fs.readdirSync(path.join(o.dir, 'data', 'anuncios'))) if (f.endsWith('.json') || f.endsWith('.jsonl')) assert.ok(!fs.readFileSync(path.join(o.dir, 'data', 'anuncios', f), 'utf8').includes(TOKEN_STAND), `el token en ${f}`);
});
