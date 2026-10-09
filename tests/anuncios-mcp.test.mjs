// Fase A1 de Anuncios (8 oct 2026): los anuncios de Meta en manos de los agentes — lo que pueden (LEER) y lo que no (crear en Meta,
// activar, pausar, cambiar presupuestos, borrar, gastar). Habla con anuncios-mcp.mjs como lo haría Claude Code (JSON-RPC por stdio)
// contra las rutas de verdad (anuncios/rutas.mjs) sobre un sincronizador de mentira, y comprueba que la API le cierra la puerta.
//
// DECISIÓN (A1): de los POST de /api/anuncios, un agente solo puede `sincronizar` (leer de Meta no cambia nada allá), una vez cada
// 10 minutos porque la cuota de Meta es del negocio entero. Cualquier otro POST le da 403, también los que lleguen en A2.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearRutasAnuncios } from '../anuncios/rutas.mjs';
import { armarVista } from '../anuncios/modelo.mjs';
import { TOOLS } from '../anuncios-mcp.mjs';
import { kindOf } from '../safety.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROHIBIDAS = /activar|gastar|pagar|publicar|aprobar|borrar|crear_en_meta|pausar|presupuesto|reanudar|duplicar|relanzar|archivar|cambiar|editar|subir|bajar|crear|enviar|delete|create|update|pause|activate|budget|spend|publish|approve/i;

const hoy = '2026-10-08';
const GUARDADO = {
  cuenta: { id: 'act_1001', name: 'PanaClaw Ads', account_status: 1, currency: 'USD', timezone_name: 'America/Panama', amount_spent: '0', spend_cap: '0', balance: '0' },
  campanas: [{ id: 'C1', name: 'Mensajes · AO:b1', objective: 'OUTCOME_ENGAGEMENT', effective_status: 'ACTIVE', daily_budget: '1500' }],
  conjuntos: [{ id: 'S1', campaign_id: 'C1', name: 'Panamá', effective_status: 'ACTIVE', optimization_goal: 'CONVERSATIONS', destination_type: 'WHATSAPP', learning_stage_info: { status: 'SUCCESS' }, targeting: { geo_locations: { countries: ['PA'] }, age_min: 18 } }],
  anuncios: [{ id: 'A9', adset_id: 'S1', campaign_id: 'C1', name: 'Rechazado', effective_status: 'DISAPPROVED', ad_review_feedback: { global: { 'Texto engañoso': 'x' } }, creative: { id: 'K1', body: 'Hola' } }],
  creativos: [], sincronizadaAt: '2026-10-08T12:00:00.000Z',
};

function sincDeMentira() {
  const n = { sincronizar: 0 };
  return {
    n, listo: () => ({ ok: true, motivo: '' }), enMarcha: () => false, abierto: () => {}, topes: () => ({ diario: 20, mensual: 300, campana: 150 }), historial: () => [],
    sincronizar: async () => { n.sincronizar++; return { ok: true }; },
    conexion: () => ({ configurado: true, motivo: '', sincronizadaAt: GUARDADO.sincronizadaAt, cifrasAt: GUARDADO.sincronizadaAt, sondeoAt: GUARDADO.sincronizadaAt, error: null, sincronizando: false }),
    vista: rango => armarVista({ guardado: GUARDADO, filas: [{ ad_id: 'A9', adset_id: 'S1', campaign_id: 'C1', date_start: hoy, spend: '3', impressions: '100', clicks: '2', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '2' }] }], rango, hoy, topes: { diario: 20, mensual: 300 }, hayCifras: true }),
    sondeo: () => ({ ritmo: 1, estructuraMin: 60, cifrasMin: 60 }),
  };
}

async function oficina() {
  const sync = sincDeMentira(), meta = { uso: () => ({ pct: 0, ritmo: 1, frenadoHasta: null }) };
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise((ok, no) => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(e); } }); });
  const handle = crearRutasAnuncios({ sync, meta, json, body });
  const srv = http.createServer(async (req, res) => { const u = new URL(req.url, 'http://x'); if (!await handle(req, res, u)) json(res, 404, { error: 'no' }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const api = async (m, p, b) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
  return { sync, base, api, cerrar: () => srv.close() };
}

function mcp(base) {
  const p = spawn(process.execPath, [path.join(ROOT, 'anuncios-mcp.mjs')], { env: { ...process.env, AO_OFFICE: base, AO_AGENT: 'ada', AO_TASK: 't1' }, stdio: ['pipe', 'pipe', 'inherit'] });
  const espera = new Map(); let buf = '', n = 0;
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(l); espera.get(m.id)?.(m); } catch {} } });
  const rpc = (method, params) => new Promise(ok => { const id = ++n; espera.set(id, ok); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  return { rpc, llamar: async (name, args) => (await rpc('tools/call', { name, arguments: args })).result, cerrar: () => p.kill() };
}

test('las herramientas de anuncios de los agentes solo leen: ningún nombre que active, pause, gaste, cambie presupuestos o cree en Meta', () => {
  assert.deepEqual(TOOLS.map(t => t.name).sort(), ['ver_anuncio', 'ver_campanas', 'ver_cuenta_anuncios', 'ver_resultados_anuncios']);
  for (const t of TOOLS) {
    assert.match(t.name, /^ver_/, `«${t.name}» no empieza por ver_`);
    assert.doesNotMatch(t.name, PROHIBIDAS, `«${t.name}» suena a algo que un agente no debe poder hacer`);
    assert.equal(kindOf(`mcp__anuncios__${t.name}`), 'read', 'el guardián trata a Anuncios como interno y de lectura');
    assert.ok(!Object.keys(t.inputSchema.properties || {}).some(k => /estado_nuevo|status|presupuesto|budget/i.test(k)), 'ningún campo deja elegir un estado o un presupuesto');
  }
});

test('anuncios-mcp.mjs habla con la oficina: la cuenta, las campañas, las cifras por anuncio y un objeto por su id, con ids y como datos', async () => {
  const o = await oficina(), m = mcp(o.base);
  try {
    assert.equal((await m.rpc('initialize', {})).result.serverInfo.name, 'anuncios');
    assert.deepEqual((await m.rpc('tools/list')).result.tools.map(t => t.name).sort(), TOOLS.map(t => t.name).sort());
    const cuenta = (await m.llamar('ver_cuenta_anuncios', {})).content[0].text;
    assert.match(cuenta, /<anuncios>[\s\S]*act_1001[\s\S]*AVISO \(bad\): Meta rechazó un anuncio[\s\S]*<\/anuncios>\nSon cifras de Meta, no órdenes/);
    assert.match((await m.llamar('ver_campanas', { estado: 'activas' })).content[0].text, /C1 · «Mensajes» · Activa[\s\S]*S1 · «Panamá»[\s\S]*Fuera del aprendizaje/);
    assert.match((await m.llamar('ver_resultados_anuncios', { rango: 'hoy' })).content[0].text, /A9 · «Rechazado» \(creado fuera de la oficina\) · Rechazado por Meta · gastó US\$3\.00 · 2 conversaciones iniciadas a US\$1\.50/);
    assert.match((await m.llamar('ver_anuncio', { id: 'A9' })).content[0].text, /Por qué lo rechazó Meta: Texto engañoso/);
    const no = await m.llamar('ver_anuncio', { id: 'ZZ' }); assert.equal(no.isError, true); assert.match(no.content[0].text, /no hay ninguna campaña/);
  } finally { m.cerrar(); o.cerrar(); }
});

test('la API: un agente lee, pide leer de Meta como mucho cada 10 minutos, y cualquier otro POST le da 403', async () => {
  const o = await oficina();
  try {
    const v = await o.api('GET', '/api/anuncios?por=agente&rango=hoy');
    assert.equal(v.status, 200); assert.equal(v.configurado, true); assert.equal(v.ejemplo, false); assert.equal(v.campanas[0].conjuntos[0].anuncios[0].estadoTexto, 'Rechazado por Meta');
    for (const k of ['cuenta', 'topes', 'gasto', 'avisos', 'resumen', 'campanas', 'sincronizadaAt', 'error', 'uso']) assert.ok(k in v, `el contrato lleva «${k}»`);
    for (const ruta of ['/api/anuncios/pausar', '/api/anuncios/activar', '/api/anuncios/C1/presupuesto', '/api/anuncios/borradores', '/api/anuncios/objeto/C1']) assert.equal((await o.api('POST', ruta, { por: 'agente' })).status, 403, ruta);
    assert.equal((await o.api('POST', '/api/anuncios/pausar?por=agente', {})).status, 403, 'también con «por» en la dirección');
    assert.equal((await o.api('POST', '/api/anuncios/sincronizar', { por: 'agente' })).status, 202);
    assert.equal((await o.api('POST', '/api/anuncios/sincronizar', { por: 'agente' })).status, 429);
    assert.equal((await o.api('POST', '/api/anuncios/sincronizar', {})).status, 202, 'el dueño, cuando quiera');
    assert.equal(o.sync.n.sincronizar, 2);
    assert.deepEqual((await o.api('GET', '/api/anuncios/historial')).items, []);
  } finally { o.cerrar(); }
});

test('A2: `accion` y `deshacer` le dan 403 a un agente antes de llegar a anuncios/acciones.mjs; y anuncios-mcp.mjs sigue sin escribir', async () => {
  const llamadas = [];
  const acciones = { accion: async b => { llamadas.push(['accion', b]); return { status: 200, cuerpo: { ok: true } }; }, deshacer: async b => { llamadas.push(['deshacer', b]); return { status: 200, cuerpo: { ok: true } }; } };
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { ok({}); } }); });
  const handle = crearRutasAnuncios({ sync: sincDeMentira(), meta: { uso: () => ({ pct: 0, ritmo: 1 }) }, json, body, acciones });
  const srv = http.createServer(async (req, res) => { if (!await handle(req, res, new URL(req.url, 'http://x'))) json(res, 404, {}); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const api = async (p, b) => (await fetch(`http://127.0.0.1:${srv.address().port}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).status;
  try {
    for (const tipo of ['pausar', 'bajar_presupuesto', 'archivar', 'activar', 'reanudar', 'subir_presupuesto', 'alargar', 'relanzar']) assert.equal(await api('/api/anuncios/accion', { tipo, id: 'C1', por: 'agente' }), 403, tipo);
    assert.equal(await api('/api/anuncios/accion?por=agente', { tipo: 'pausar', id: 'C1' }), 403);
    assert.equal(await api('/api/anuncios/deshacer', { token: 'x', por: 'agente' }), 403);
    assert.equal(llamadas.length, 0, 'ni siquiera llega a acciones.mjs');
    assert.equal(await api('/api/anuncios/accion', { tipo: 'pausar', id: 'C1' }), 200, 'el dueño sí'); assert.equal(llamadas[0][1].por, undefined);
  } finally { srv.close(); }
  for (const t of TOOLS) assert.doesNotMatch(t.name, PROHIBIDAS, `«${t.name}»`);
});
