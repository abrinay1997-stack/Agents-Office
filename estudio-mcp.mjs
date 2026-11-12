// Agents Office — the ESTUDIO as an MCP server the agents call (stdio, JSON-RPC, no dependencies).
// serve.mjs starts it inside each agent run with --mcp-config, so an agent can generate the images or the video its
// task asks for and put them in its deliverable. The work itself happens in the office (POST /api/media/jobs, a job in the
// background): the keys, the daily budget and the files stay there. An image usually comes back within the call; a video
// takes minutes, so the tool hands back a «⏳ … (trabajo <id>)» line the agent leaves in its deliverable, and the office swaps
// it for the file when the job ends. Env from serve.mjs: AO_OFFICE (the office URL), AO_AGENT, AO_TASK (who is asking).
// Banco de presets (E8, 1 oct 2026; docs/propuesta-banco-presets.md §8.4 y §15.5): buscar_presets, aplicar_preset, crear_lote y
// estado_lote. Un agente gasta sin el OK del dueño solo por debajo de sus umbrales (media.lotes.agenteSinOk fotos, agenteUsd US$);
// por encima, el lote nace «espera_ok» y va a ⚠ Aprobaciones. Ninguna herramienta de aquí aprueba ni autoriza nada.
// safety.mjs: aplicar_preset y crear_lote son «cost» (permitidos antes del OK, nunca con «nunca»); buscar y estado, lectura.
// 12 nov 2026: las definiciones y los ejecutores viven en estudio-tools.mjs (puro, sin transporte: lo comparte el conector remoto); este archivo es solo el stdio.
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearEstudio, publicas } from './estudio-tools.mjs';

export { escenaDeAgente, escenaEnPalabras, pilaDe, presetEnLinea, avisoFuera } from './estudio-tools.mjs'; // las funciones puras que prueban los tests

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';

async function office(pathname, body) {
  const r = await fetch(OFFICE + pathname, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { signal: AbortSignal.timeout(130000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}
async function patch(pathname, body) {
  const r = await fetch(OFFICE + pathname, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(130000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}
const quien = () => ({ by: 'agent', agent: process.env.AO_AGENT || null, task: process.env.AO_TASK || null }); // quién pide: lo pone serve.mjs
const estudio = crearEstudio({ office, patch, quien });
const tools = async () => publicas(await estudio.tools()), call = estudio.call;

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const principal = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url); // importado por un test: solo las funciones puras
if (principal) readline.createInterface({ input: process.stdin }).on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return; // notifications (initialized, cancelled…)
  try {
    if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'estudio', version: '2.0.0' } } });
    if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: await tools() } });
    if (m.method === 'tools/call') {
      try { const r = await call(m.params?.name, m.params?.arguments); return send({ jsonrpc: '2.0', id: m.id, result: { content: typeof r === 'string' ? [{ type: 'text', text: r }] : [{ type: 'text', text: r.text }, ...(r.images || []).map(i => ({ type: 'image', data: i.data, mimeType: i.mimeType }))] } }); }
      catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'No se pudo: ' + e.message }], isError: true } }); }
    }
    if (m.method === 'ping') return send({ jsonrpc: '2.0', id: m.id, result: {} });
    send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'método desconocido: ' + m.method } });
  } catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }); }
});
