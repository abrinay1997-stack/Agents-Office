// Agents Office — la BIBLIOTECA DE HABILIDADES como servidor MCP que los agentes llaman (stdio, JSON-RPC, sin dependencias; 7 oct 2026).
// serve.mjs lo arranca en cada ejecución de un agente que tiene habilidades, como Tareas o el Estudio. Solo LEE: ver la lista y leer
// una habilidad o una de sus referencias (plantillas, listas, ejemplos). Nada aquí escribe, envía ni cambia nada
// (tests/biblioteca.test.mjs lo comprueba). Variables que pone serve.mjs: AO_OFFICE y AO_AGENT.
import readline from 'node:readline';
import { TOOLS as TOOLS_DEFS, crearLlamador } from './habilidades-tools.mjs';

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';
const AGENTE = process.env.AO_AGENT || '';

async function office(pathname) {
  const r = await fetch(OFFICE + pathname, { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}

export { TOOLS } from './habilidades-tools.mjs'; // las definiciones y lo que hacen son las mismas que usa la nube (habilidades-tools.mjs)
const call = crearLlamador({ office, agente: AGENTE });

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async line => {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.id === undefined) return;
    try {
      if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'habilidades', version: '1.0.0' } } });
      if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: TOOLS_DEFS } });
      if (m.method === 'tools/call') {
        try { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: await call(m.params?.name, m.params?.arguments) }] } }); }
        catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'No se pudo: ' + e.message }], isError: true } }); }
      }
      if (m.method === 'ping') return send({ jsonrpc: '2.0', id: m.id, result: {} });
      send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'método desconocido: ' + m.method } });
    } catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }); }
  });
}
