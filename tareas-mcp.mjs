// Agents Office — las TAREAS como servidor MCP que los agentes llaman (stdio, JSON-RPC, sin dependencias). Plan T3 (6 oct 2026,
// docs/analisis-taskview-2026-10-06.md §7). serve.mjs lo arranca dentro de CADA ejecución de un agente con --mcp-config, como el
// Estudio y Contenido. Un agente puede: ver su tarea y las de su departamento, ver la agenda, MARCAR los pasos de la tarea que tiene,
// anotar en su bitácora, PEDIR un bloqueo cuando le falta algo, PROPONER trabajo a otro departamento (nace idea: lo pide el dueño o
// el jefe), SUGERIRLE algo al dueño para su lista personal (plan D, 7 oct 2026: nace idea en su Bandeja) y REGISTRAR algo que hizo
// fuera de una tarea; VER las rutinas (9 oct 2026, solo leer). Las tareas del dueño las ve rotuladas «DEL DUEÑO»: son suyas, no se tocan. Nunca aprueba, nunca cambia la prioridad, la fecha límite ni el estado de
// una tarea, y solo toca la que tiene en curso: esas herramientas no existen aquí y la API (tareas/rutas.mjs) se lo niega a quien
// llega como agente. tests/tareas-mcp.test.mjs lo comprueba.
// Variables que pone serve.mjs: AO_OFFICE (la dirección de la oficina), AO_AGENT y AO_TASK (quién pide y en qué tarea).
import readline from 'node:readline';
import { TOOLS, crearLlamador } from './tareas-tools.mjs';

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';
const AGENTE = process.env.AO_AGENT || null, TAREA = process.env.AO_TASK || '';

async function office(pathname, body, method) {
  const r = await fetch(OFFICE + pathname, body ? { method: method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}
const call = crearLlamador({ office, agente: AGENTE, tarea: TAREA });

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return;
  try {
    if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'tareas', version: '1.0.0' }, instructions: 'Resuelve los ids con ver_mi_tarea y ver_tareas: nunca los adivines. Marca cada paso con marcar_paso en cuanto lo termines. Si te falta algo, pide_bloqueo en vez de inventarlo. Las tareas «DEL DUEÑO» son del jefe: no las hagas ni las cambies; si algo solo lo puede hacer él, sugerir_al_dueno. Nada de aquí aprueba ni envía.' } });
    if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: TOOLS } });
    if (m.method === 'tools/call') {
      try { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: await call(m.params?.name, m.params?.arguments) }] } }); }
      catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'No se pudo: ' + e.message }], isError: true } }); }
    }
    if (m.method === 'ping') return send({ jsonrpc: '2.0', id: m.id, result: {} });
    send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'método desconocido: ' + m.method } });
  } catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }); }
});
