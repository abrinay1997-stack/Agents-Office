// Fase A5 de Anuncios (9 oct 2026): LAS SUGERENCIAS contra el serve.mjs REAL (carpeta temporal) y el Meta de mentira. El sondeo de cifras
// crea sugerencias (cortar, escalar, rechazado); aplicar una que baja el gasto pausa en Meta; aplicar una de gasto devuelve `confirmar` y
// NO cambia nada hasta el segundo clic (que la deja aplicada); lo descartado no vuelve; un agente no aplica ni descarta (sí deja una);
// el piloto automático pausa lo que cruza el umbral de cortar y NUNCA activa ni sube. Y el piloto puro, con unas acciones de mentira:
// solo sabe pedir «pausar». Se espera AL HECHO (bucles con tope), nunca un tiempo fijo corto.
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
import { crearPiloto, PUEDE } from '../anuncios/piloto.mjs';
import { crearSugerencias } from '../anuncios/sugerencias.mjs';
import { DE_GASTO } from '../anuncios/acciones.mjs';
import { fechaEn, sumarDias } from '../anuncios/modelo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const esperar = async (fn, { max = 60000, cada = 250, que = 'algo' } = {}) => { const t0 = Date.now(); for (;;) { const r = await fn(); if (r) return r; if (Date.now() - t0 > max) throw new Error(`no llegó a tiempo: ${que}`); await new Promise(x => setTimeout(x, cada)); } };
const SEG = { geo_locations: { countries: ['PA'] }, age_min: 18, targeting_automation: { advantage_audience: 1 } };
const MSG = 'onsite_conversion.messaging_conversation_started_7d';

test('el piloto (puro): apagado no hace nada; encendido SOLO pausa —lo que cruza «cortar» o todo si se pasa el tope— y nunca pide un gasto', async () => {
  const pedidos = [], avisos = [];
  const acciones = { accion: async b => { pedidos.push(b); return { status: 200, cuerpo: { ok: true, hecho: { texto: 'En pausa.' } } }; } };
  let on = false;
  const p = crearPiloto({ acciones, ajustes: () => ({ pilotoAutomatico: on }), avisar: (t, o) => avisos.push({ t, ...o }) });
  const sugerencias = [
    { id: 'cortar-A1', regla: 'cortar', objeto: { id: 'A1', nombre: 'Malo' }, dato: 'gastó US$10', cambio: { tipo: 'pausar', id: 'A1' } },
    { id: 'escalar-S1', regla: 'escalar', objeto: { id: 'S1', nombre: 'Bueno' }, cambio: { tipo: 'subir_presupuesto', id: 'S1', valor: 12 } },
    ...DE_GASTO.map(t => ({ id: `x-${t}`, regla: 'cortar', objeto: { id: 'Z' + t, nombre: t }, cambio: { tipo: t, id: 'Z' + t } })), // aunque alguien las disfrace de «cortar»
  ];
  assert.deepEqual((await p.correr({ sugerencias })).hechas, []); assert.equal(pedidos.length, 0, 'apagado: nada');
  on = true;
  const r = await p.correr({ sugerencias, vista: { gasto: { hoy: 5 }, campanas: [] }, topes: { diario: 20 } });
  assert.deepEqual(pedidos, [{ tipo: 'pausar', id: 'A1', por: 'piloto' }]);
  assert.equal(r.hechas[0].sugerencia, 'cortar-A1'); assert.equal(avisos[0].key, 'anuncios-piloto:A1'); assert.match(avisos[0].t, /Deshacerlo vuelve a gastar/);
  pedidos.length = 0;
  await p.correr({ sugerencias, vista: { gasto: { hoy: 21 }, campanas: [{ id: 'C1', nombre: 'Uno', estado: 'ACTIVE' }, { id: 'C2', nombre: 'Dos', estado: 'PAUSED' }, { id: 'C3', nombre: 'Tres', estado: 'ACTIVE' }] }, topes: { diario: 20 } });
  assert.deepEqual(pedidos.map(x => [x.tipo, x.id]), [['pausar', 'C1'], ['pausar', 'C3']], 'pasó el tope diario: todo lo activo, en pausa');
  assert.deepEqual([...PUEDE], ['pausar']);
  // y en su código no hay ni una palabra de gasto: aunque alguien lo configure, no sabe pedirlo
  const fuente = fs.readFileSync(path.join(ROOT, 'anuncios', 'piloto.mjs'), 'utf8');
  for (const t of DE_GASTO) assert.ok(!fuente.includes(t), `piloto.mjs nombra «${t}»`);
});

test('sugerencias (almacén): descartada no vuelve en 7 días; pospuesta vuelve a los 3 con `hasta`; aplicada no se repite enseguida; lo que ya no se ve se quita', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-sug-'));
  let t = Date.parse('2026-10-09T15:00:00Z');
  const S = crearSugerencias({ dir, ahora: () => t, umbrales: () => ({ descartarDias: 7, posponerDias: 3, esperarDias: 3, resultadoDias: 7 }) });
  const s = (id, extra = {}) => ({ id, regla: 'cortar', objeto: { id: 'A1', nivel: 'anuncio', nombre: 'x' }, dato: 'd', porque: 'p', cambio: { tipo: 'pausar', id: 'A1' }, efecto: 'e', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: '' }, prioridad: 1, gasto: false, ...extra });
  S.actualizar({ sugerencias: [s('cortar-A1'), s('fatiga-A2', { regla: 'fatiga' }), s('escalar-S1', { regla: 'escalar' })] });
  assert.equal(S.lista().filter(x => x.estado === 'viva').length, 3);
  S.descartar('cortar-A1'); S.posponer('fatiga-A2');
  assert.equal(S.leer('fatiga-A2').estado, 'pospuesta'); assert.equal(S.leer('fatiga-A2').hasta, new Date(t + 3 * 864e5).toISOString());
  const h = S.marcarAplicada('escalar-S1', { quien: 'dueno', hecho: { texto: 'Subido.' } });
  assert.match(h.id, /^escalar-S1~/); assert.equal(h.estado, 'aplicada');
  t += 864e5; S.actualizar({ sugerencias: [s('cortar-A1'), s('fatiga-A2', { regla: 'fatiga' }), s('escalar-S1', { regla: 'escalar' })] });
  assert.equal(S.leer('cortar-A1').estado, 'descartada', 'al día siguiente sigue descartada'); assert.equal(S.leer('fatiga-A2').estado, 'pospuesta');
  assert.equal(S.leer('escalar-S1')?.estado, 'aplicada', 'recién aplicada: no vuelve como viva');
  t += 3 * 864e5; S.actualizar({ sugerencias: [s('cortar-A1'), s('fatiga-A2', { regla: 'fatiga' })] });
  assert.equal(S.leer('fatiga-A2').estado, 'viva', 'a los 3 días vuelve'); assert.equal(S.leer('cortar-A1').estado, 'descartada');
  t += 4 * 864e5; S.actualizar({ sugerencias: [s('cortar-A1')] });
  assert.equal(S.leer('cortar-A1').estado, 'viva', 'a los 7 días puede volver'); assert.equal(S.leer('fatiga-A2'), null, 'la que ya no se ve se quita');
  // lo que pasó después, y la memoria solo si vino de una tarea
  S.deAgente({ agente: 'ada', tarea: 't9', regla: 'fatiga', objeto: { id: 'A7', nivel: 'anuncio', nombre: 'y' }, dato: 'd', porque: 'p', efecto: '', cambio: { tipo: 'creativos', id: 'A7' } });
  S.marcarAplicada('agente-fatiga-A7');
  t += 9 * 864e5; const aprendidas = [];
  assert.ok(S.cerrarResultados({ medir: () => ({ r: 1, mejoro: true, texto: 'mejor' }), aprender: (x, r) => aprendidas.push([x.tarea, r.r]) }) >= 1);
  assert.deepEqual(aprendidas, [['t9', 1]], 'solo la que vino de una tarea enseña a la memoria');
  fs.rmSync(dir, { recursive: true, force: true });
});

async function oficina(t, g, local) {
  const graph = await g.escuchar();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-anuncios-a5-')), brain = path.join(dir, 'brain'), localF = path.join(dir, 'office.config.local.json');
  fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true }); fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana.\n');
  fs.writeFileSync(localF, JSON.stringify(local));
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: localF,
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

test('Anuncios A5: el sondeo crea sugerencias; aplicar baja (pausa en Meta) o pide la cifra (y nada cambia hasta el segundo clic); descartar; agentes; el piloto solo pausa', { timeout: 240000 }, async t => {
  const g = crearMetaStand({ permisos: [...PERMISOS_LECTURA, ...PERMISOS_ANUNCIOS] });
  const pedir = async (ruta, campos) => (await g.fetchFn(`https://graph.test/v26.0${ruta}`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN_STAND}` }, body: new URLSearchParams(Object.entries(campos).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])) })).json();
  const campana = async (nombre, anuncios) => {
    const c = await pedir(`/${CUENTA_STAND}/campaigns`, { name: `${nombre} · AO:b1`, objective: 'OUTCOME_ENGAGEMENT', special_ad_categories: [], status: 'PAUSED', spend_cap: 15000 });
    const s = await pedir(`/${CUENTA_STAND}/adsets`, { campaign_id: c.id, name: `${nombre} PA`, optimization_goal: 'CONVERSATIONS', billing_event: 'IMPRESSIONS', destination_type: 'WHATSAPP', targeting: SEG, status: 'PAUSED', daily_budget: 1000 });
    const cr = await pedir(`/${CUENTA_STAND}/adcreatives`, { name: 'k', object_story_spec: { page_id: 'P1' } });
    const ads = [];
    for (const n of anuncios) { const a = await pedir(`/${CUENTA_STAND}/ads`, { adset_id: s.id, name: `${nombre} ${n}`, creative: { creative_id: cr.id }, status: 'PAUSED' }); await pedir(`/${a.id}`, { status: 'ACTIVE' }); ads.push(a.id); }
    await pedir(`/${s.id}`, { status: 'ACTIVE' }); await pedir(`/${c.id}`, { status: 'ACTIVE' });
    g.st.conjuntos[s.id].learning_stage_info = { status: 'SUCCESS', conversions: 60 };
    return { c: c.id, s: s.id, ads };
  };
  const M = await campana('Mensajes', ['malo', 'bueno', 'rechazado']), E = await campana('Escala', ['uno']), T = await campana('Tercera', ['malo2', 'bueno2']);
  g.st.anuncios[M.ads[2]].revision = 'DISAPPROVED';
  const hoy = fechaEn('America/Panama', Date.now()), ayer = sumarDias(hoy, -1), dias = n => Array.from({ length: n }, (_, i) => sumarDias(ayer, -(n - 1 - i)));
  const fila = (o, ad, fecha, gasto, impr, clics, res) => ({ campaign_id: o.c, adset_id: o.s, ad_id: ad, date_start: fecha, spend: String(gasto), impressions: String(impr), clicks: String(clics), reach: String(Math.round(impr / 1.3)), ...(res ? { actions: [{ action_type: MSG, value: String(res) }] } : {}) });
  g.st.cifras = [
    ...dias(5).map(f => fila(M, M.ads[0], f, 2, 500, 6, 0)), ...dias(5).map(f => fila(M, M.ads[1], f, 3, 800, 16, 2)), // el malo: US$10 sin resultados (5× el objetivo de US$2)
    ...dias(3).map((f, i) => fila(E, E.ads[0], f, 10, 3000, 60, [8, 10, 7][i])), // escala: US$1,25 · US$1 · US$1,43 (bajo los US$1,60)
    ...dias(5).map(f => fila(T, T.ads[0], f, 2, 500, 6, 0)), ...dias(5).map(f => fila(T, T.ads[1], f, 3, 800, 16, 2)),
  ];
  const o = await oficina(t, g, { anuncios: { cuenta: CUENTA_STAND, topeDiario: 40, topeMensual: 3000, topeCampana: 150, cpaObjetivo: 2 } });
  await esperar(async () => [202, 409].includes((await o.call('/api/anuncios/sincronizar', {})).status), { que: 'pedir la lectura' });
  const sug = async () => (await o.call('/api/anuncios/sugerencias')).j;
  let S = await esperar(async () => { const x = await sug(); return x.items?.some(s => s.id === `cortar-${M.ads[0]}`) && x.items.some(s => s.id === `escalar-${E.s}`) ? x : null; }, { que: 'el diagnóstico tras la lectura: ' + o.log().slice(-400) });
  assert.equal(S.cpaObjetivo, 2); assert.equal(S.sinObjetivo, null); assert.equal(S.umbrales.fatigaFrecuencia, 3, 'los umbrales con sus nombres'); assert.equal(S.umbrales.fatigaCaidaCtr, 0.3);
  const porId = id => S.items.find(s => s.id === id);
  assert.equal(porId(`rechazado-${M.ads[2]}`)?.cambio.tipo, 'borrador');
  const esc = porId(`escalar-${E.s}`); assert.equal(esc.cambio.valor, 12); assert.equal(esc.gasto, true); assert.equal(esc.estado, 'viva');
  assert.ok(!S.items.some(s => s.objeto.id === M.ads[1]), 'el que funciona no se toca');

  // un agente no aplica ni descarta (403); sí deja una sugerencia (que nunca se aplica sola)
  assert.equal((await o.call(`/api/anuncios/sugerencias/cortar-${M.ads[0]}/aplicar`, { por: 'agente' })).status, 403);
  assert.equal((await o.call(`/api/anuncios/sugerencias/cortar-${M.ads[0]}/descartar`, { por: 'agente' })).status, 403);
  const deAda = await o.call('/api/anuncios/sugerencias', { por: 'agente', agente: 'ada', id: E.ads[0], regla: 'fatiga', tipo: 'creativos', dato: 'CTR 2 % → 1 %', porque: 'se cansa' });
  assert.equal(deAda.status, 200, JSON.stringify(deAda.j)); assert.equal(deAda.j.sugerencia.estado, 'viva'); assert.equal(deAda.j.sugerencia.origen, 'agente');
  assert.equal((await o.call('/api/anuncios/sugerencias', { por: 'agente', agente: 'ada', id: 'NOEXISTE', regla: 'fatiga', tipo: 'creativos', dato: 'x', porque: 'y' })).status, 404);
  assert.equal((await o.call(`/api/anuncios/creativos/${E.ads[0]}/variaciones`, { por: 'agente' })).status, 403, 'pedir variaciones es del dueño');

  // aplicar una que BAJA el gasto: pausa en Meta, un clic
  let r = await o.call(`/api/anuncios/sugerencias/cortar-${M.ads[0]}/aplicar`, {});
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.ok, true); assert.equal(g.st.anuncios[M.ads[0]].status, 'PAUSED'); assert.equal(r.j.sugerencia.estado, 'aplicada');
  // aplicar una que GASTA: la cifra y nada cambia; el segundo clic (con `sugerencia`) la sube y la deja aplicada
  const n = g.st.cambios.length;
  r = await o.call(`/api/anuncios/sugerencias/escalar-${E.s}/aplicar`, {});
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.ok(r.j.confirmar?.token); assert.match(r.j.confirmar.texto, /de US\$10 a US\$12 al día/);
  assert.equal(g.st.cambios.length, n, 'nada cambió en Meta'); assert.equal(g.st.conjuntos[E.s].daily_budget, '1000');
  assert.equal((await sug()).items.find(s => s.id === `escalar-${E.s}`).estado, 'viva', 'sigue viva hasta el segundo clic');
  const ok = await o.call('/api/anuncios/accion', { tipo: 'subir_presupuesto', id: E.s, valor: 12, confirmacion: r.j.confirmar.token, sugerencia: `escalar-${E.s}` });
  assert.equal(ok.status, 200, JSON.stringify(ok.j)); assert.equal(g.st.conjuntos[E.s].daily_budget, '1200');
  S = await sug(); assert.ok(!S.items.some(s => s.id === `escalar-${E.s}`)); assert.ok(S.items.some(s => s.sugerencia === `escalar-${E.s}` && s.estado === 'aplicada'));
  // descartar: no vuelve tras otra lectura
  assert.equal((await o.call(`/api/anuncios/sugerencias/rechazado-${M.ads[2]}/descartar`, {})).status, 200);
  // pospuesta: con `hasta`
  const pos = await o.call(`/api/anuncios/sugerencias/cortar-${T.ads[0]}/posponer`, { dias: 3 });
  assert.equal(pos.status, 200); assert.ok(Date.parse(pos.j.sugerencia.hasta) > Date.now() + 2 * 864e5);
  // el piloto automático, encendido: pausa lo que cruza «cortar» (el pospuesto también: es un freno) y NUNCA activa ni sube
  assert.equal((await o.call('/api/settings', { changes: { 'anuncios.pilotoAutomatico': true } })).status, 200);
  const antes = g.st.cambios.length;
  await esperar(async () => [202, 409].includes((await o.call('/api/anuncios/sincronizar', {})).status), { que: 'otra lectura' });
  await esperar(async () => g.st.anuncios[T.ads[0]].status === 'PAUSED', { que: 'el piloto pausa el segundo anuncio malo: ' + o.log().slice(-400) });
  const delPiloto = g.st.cambios.slice(antes);
  assert.ok(delPiloto.length >= 1); for (const c of delPiloto) { assert.equal(c.campos.status, 'PAUSED', 'el piloto solo pausa'); assert.ok(!Object.keys(c.campos).some(k => /budget|end_time|stop_time/.test(k)), 'y no toca presupuestos ni fechas'); }
  assert.equal(g.st.anuncios[T.ads[1]].status, 'ACTIVE', 'el bueno sigue');
  const avisos = await esperar(() => { try { const l = JSON.parse(fs.readFileSync(path.join(o.dir, 'data', 'notices.json'), 'utf8')); return l.some(x => x.key === `anuncios-piloto:${T.ads[0]}`) ? l : null; } catch { return null; } }, { que: 'el aviso del piloto' });
  assert.match(avisos.find(x => x.key === `anuncios-piloto:${T.ads[0]}`).text, /Piloto automático: pausé/);
  S = await esperar(async () => { const x = await sug(); return x.items.some(s => s.sugerencia === `cortar-${T.ads[0]}` && s.aplicadaPor === 'piloto') ? x : null; }, { que: 'la sugerencia queda aplicada por el piloto' });
  assert.equal(S.items.find(s => s.id === `rechazado-${M.ads[2]}`)?.estado, 'descartada', 'lo descartado no volvió');
  // el historial lo dice
  const h = (await o.call('/api/anuncios/historial')).j.items;
  assert.ok(h.some(e => e.quien === 'piloto' && e.que === 'pausar' && e.objeto.id === T.ads[0]));
  assert.ok(!h.some(e => e.quien === 'piloto' && e.que !== 'pausar'));
});
