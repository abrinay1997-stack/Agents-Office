// Agents Office — CONTENIDO como servidor MCP que los agentes llaman (stdio, JSON-RPC, sin dependencias).
// serve.mjs lo arranca dentro de cada ejecución de un agente con --mcp-config, igual que el Estudio (estudio-mcp.mjs). Un agente puede VER
// el calendario de contenido, lo publicado con sus cifras y los huecos (9 oct 2026), y DEJAR BORRADORES; nunca aprobar, programar ni publicar: esas herramientas no existen aquí, y la API de la
// oficina tampoco se las deja a quien llega como agente. Aprobar es del dueño, en la vista Contenido; publicar, de la oficina, después del OK.
// Variables que pone serve.mjs: AO_OFFICE (la dirección de la oficina), AO_AGENT y AO_TASK (quién pide).
import readline from 'node:readline';
import { TOOLS, crearLlamador } from './contenido-tools.mjs';

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';

async function office(pathname, body, method) {
  const r = await fetch(OFFICE + pathname, body ? { method: method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}
const call = crearLlamador({ office, agente: process.env.AO_AGENT || null, tarea: process.env.AO_TASK || '' });

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return; // notificaciones (initialized, cancelled…)
  try {
    if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'contenido', version: '1.0.0' } } });
    if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: TOOLS } });
    if (m.method === 'tools/call') {
      try { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: await call(m.params?.name, m.params?.arguments) }] } }); }
      catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'No se pudo: ' + e.message }], isError: true } }); }
    }
    if (m.method === 'ping') return send({ jsonrpc: '2.0', id: m.id, result: {} });
    send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'método desconocido: ' + m.method } });
  } catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }); }
});
