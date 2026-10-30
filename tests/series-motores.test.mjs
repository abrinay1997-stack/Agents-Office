// Fase 11.5 (ronda 4 de #108): CADA motor síncrono de imagen/voz/música con el media/trabajos.mjs y el motores-core REALES contra un servicio local de mentira.
// Dos preguntas por motor: (1) el servicio ACEPTA el pedido (y puede cobrarlo) y después algo falla → `aceptado`, y la causa NO es «previo»; (2) el servicio RECHAZA el POST (4xx o código de
// rechazo) → «previo» y sin `aceptado`. Los anfitriones fijos (api.x.ai, api.openai.com, fal.run, MiniMax…) se redirigen con un `fetch` de prueba. Sin keys reales, sin hora del día.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import * as media from '../media.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-motores-')), DATA = path.join(dir, 'data'), BRAIN = path.join(dir, 'brain');
fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(BRAIN, { recursive: true });
for (const k of ['GEMINI_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY', 'FAL_KEY', 'META_API_KEY', 'MINIMAX_API_KEY']) process.env[k] = 'no-es-una-key';
media.configure({}, BRAIN, DATA, { warm: false });
const espera = ms => new Promise(r => setTimeout(r, ms));
const HOSTS = new Set(['api.x.ai', 'api.openai.com', 'fal.run', 'generativelanguage.googleapis.com', 'api.minimax.io', 'api.meta.ai']);
let puerto = 0, modo = 'acepta'; const orig = globalThis.fetch;
const dl = () => `http://127.0.0.1:${puerto}/dl/x.png`;
/** Lo que contesta cada servicio cuando ACEPTA el pedido y lo que contesta cuando lo rechaza. */
function contestar(host, ruta) {
  if (modo === 'rechaza-401') return [401, { error: { message: 'invalid api key' } }];
  if (modo === 'rechaza-codigo') return [200, { base_resp: { status_code: ruta.includes('1004') ? 1004 : 1008, status_msg: 'rechazado' } }];
  if (modo === 'rechaza-1008') return [200, { base_resp: { status_code: 1008, status_msg: 'sin saldo' } }];
  if (modo === 'servidor-500') return [500, { error: 'boom' }];
  if (modo === 'modera-400') return [400, { error: { message: 'Your request was rejected by the content moderation system' } }];
  if (modo === 'espera-429') return [429, { error: { message: 'rate limit' } }];
  if (modo === 'plano-400') return [400, { error: { message: 'invalid parameter: size' } }];
  const ok = { base_resp: { status_code: 0 } };
  switch (host) { // aceptado: el servicio contesta bien y de ahí en adelante falla algo (una descarga 403 o una forma que no sirve)
    case 'api.x.ai': return [200, { data: [{}] }];
    case 'api.openai.com': case 'api.meta.ai': return [200, { data: [{ url: dl() }] }];
    case 'fal.run': return [200, { images: [{ url: dl() }] }];
    case 'generativelanguage.googleapis.com': return [200, { candidates: [] }];
    default: return [200, { ...ok, data: {} }]; // MiniMax: sin imagen ni audio
  }
}
const servidor = http.createServer((rq, rs) => {
  rq.resume(); rq.on('end', () => {
    if (rq.url.startsWith('/dl')) { rs.writeHead(403); return rs.end('firma vencida'); }
    const host = rq.url.split('/')[1], [st, cuerpo] = contestar(host, rq.url); rs.writeHead(st, { 'content-type': 'application/json' }); rs.end(JSON.stringify(cuerpo));
  });
});
await new Promise(r => servidor.listen(0, '127.0.0.1', r)); puerto = servidor.address().port;
globalThis.fetch = (u, o) => { const url = new URL(typeof u === 'string' ? u : u.url); return HOSTS.has(url.host) ? orig(`http://127.0.0.1:${puerto}/${url.host}${url.pathname}${url.search}`, o) : orig(u, o); };
test.after(() => { globalThis.fetch = orig; servidor.close(); fs.rmSync(dir, { recursive: true, force: true }); });
const terminar = async id => { for (let i = 0; i < 200; i++) { const j = media.job(id); if (j && (j.state === 'done' || j.state === 'failed')) return j; await espera(25); } throw new Error('el trabajo no terminó'); };
const lanzar = (model, kind, extra = {}) => terminar(media.submit({ prompt: 'una tarjeta para probar', model, kind, n: 1, by: 'dimitri', ...extra }).id);

const MOTORES = [['gemini', 'nano-banana', 'image'], ['grok', 'grok-image', 'image'], ['openai', 'gpt-image-1', 'image'], ['meta', 'muse-image', 'image'], ['fal imagen', 'nano-banana-fal', 'image'],
  ['minimax imagen', 'mmx-image-01', 'image'], ['minimax voz', 'mmx-voz-2.8-hd', 'audio'], ['minimax música', 'mmx-musica-3', 'music']];

for (const [nombre, id, kind] of MOTORES) {
  test(`${nombre}: el servicio ACEPTA el pedido y después algo falla → aceptado, y la causa NO es «previo» (en pago sería incierto, nunca se regenera)`, async () => {
    modo = 'acepta'; const j = await lanzar(id, kind);
    assert.equal(j.state, 'failed', j.error); assert.equal(j.aceptado, true, `${nombre} debe marcar aceptado justo tras el POST aceptado`); assert.notEqual(j.causa, 'previo'); assert.equal(j.remote, 0);
  });
  test(`${nombre}: el servicio RECHAZA el POST (401) → «previo» y sin aceptado; con 500 → no es previo`, async () => {
    modo = 'rechaza-401'; let j = await lanzar(id, kind); assert.equal(j.state, 'failed'); assert.equal(j.aceptado, undefined); assert.equal(j.causa, 'previo');
    modo = 'servidor-500'; j = await lanzar(id, kind); assert.equal(j.state, 'failed'); assert.notEqual(j.causa, 'previo', 'un 5xx pudo haberse procesado');
  });
}

test('MiniMax: un código de rechazo del proveedor (1004 llave, 1008 sin saldo) con HTTP 200 es «previo»; aceptado y luego «sin audio» no', async () => {
  for (const [id, kind] of [['mmx-image-01', 'image'], ['mmx-voz-2.8-hd', 'audio'], ['mmx-musica-3', 'music']]) {
    modo = 'rechaza-1008'; const j = await lanzar(id, kind); assert.equal(j.causa, 'previo', id); assert.equal(j.aceptado, undefined);
    modo = 'acepta'; const k = await lanzar(id, kind); assert.equal(k.aceptado, true, id); assert.notEqual(k.causa, 'previo');
  }
});

test('un fallo LOCAL tras la respuesta cobrada (disco/almacén: EACCES, EINVAL) nunca es previo, aunque el texto diga «permission denied» o «invalid»', async () => {
  modo = 'acepta'; const { RUN } = await import('../media/motores.mjs'), original = RUN.grok;
  RUN.grok = async (_m, job) => { job.aceptado = true; throw Object.assign(new Error('EACCES: permission denied, open galeria'), { code: 'EACCES' }); };
  try { const j = await lanzar('grok-image', 'image'); assert.equal(j.aceptado, true); assert.notEqual(j.causa, 'previo'); } finally { RUN.grok = original; }
  RUN.grok = async () => { throw Object.assign(new Error('EINVAL: invalid argument'), { code: 'EINVAL' }); };
  try { const j = await lanzar('grok-image', 'image'); assert.notEqual(j.causa, 'previo', 'sin señal positiva de rechazo no es previo'); } finally { RUN.grok = original; }
});

test('los campos internos de un trabajo (aceptado, causa, serie) no llegan a los agentes: el MCP del Estudio nunca los lee ni los repite', () => {
  const mcp = fs.readFileSync(new URL('../estudio-mcp.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(mcp, /\.aceptado|\.causa\b|\.serie\b|\bserie:/, 'estudio-mcp.mjs arma sus respuestas con campos elegidos, nunca con el trabajo entero');
});

for (const [nombre, id, kind] of MOTORES) {
  test(`${nombre}: 400 con «moderation» y 429 son INCIERTOS en pago (pudieron facturar el intento); un 400 de parámetros sí es previo`, async () => {
    modo = 'modera-400'; let j = await lanzar(id, kind); assert.equal(j.state, 'failed'); assert.notEqual(j.causa, 'previo', 'moderación: el intento pudo facturarse');
    modo = 'espera-429'; j = await lanzar(id, kind); assert.notEqual(j.causa, 'previo', '429');
    modo = 'plano-400'; j = await lanzar(id, kind); assert.equal(j.causa, 'previo', 'un 400 de parámetros sin palabras de moderación: rechazo limpio'); assert.equal(j.aceptado, undefined);
  });
}

test('el MCP del Estudio no devuelve jamás el trabajo entero: ni JSON.stringify(job), ni ...job, ni lo reenvía tal cual', () => {
  const mcp = fs.readFileSync(new URL('../estudio-mcp.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(mcp, /JSON\.stringify\(\s*(j|job|r|out)\s*[,)]/, 'nada de volcar el trabajo (ni la respuesta de la oficina) como JSON'); assert.doesNotMatch(mcp, /\.\.\.\s*(j|job)\b/, 'nada de esparcir el trabajo');
  assert.doesNotMatch(mcp, /text:\s*(j|job)\s*[,}]|content:\s*(j|job)\s*[,}]/, 'ninguna respuesta al agente es el trabajo tal cual'); assert.match(mcp, /function answer\(j, prompt\)/, 'las respuestas pasan por answer(), que elige sus campos');
});
