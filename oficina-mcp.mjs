// Agents Office (9 oct 2026) — la OFICINA como servidor MCP para el asistente del dueño: Claude Desktop, Claude Code, Cursor, LM Studio
// o cualquier cliente MCP que corra en ESTA computadora (stdio, JSON-RPC, sin dependencias). Guía: docs/conectar-ia.md.
// Puede LEER todo (el estado como lo ve Dimitri, tareas, agenda, lo del dueño, rutinas, calendario, Contenido, lo publicado, los huecos,
// Analíticas), HABLAR con Dimitri, CREAR trabajo (una tarea para un departamento, que siempre espera el OK antes de enviar nada; una tarea
// para la lista del dueño) y HACER los cambios que Dimitri propone (rutinas, fechas, prioridades, delegar, borradores, llenar la semana),
// cada uno con su clave para deshacer. NO puede aprobar, enviar, publicar, pagar ni borrar: esas herramientas no existen aquí y la API
// (/api/oficina/accion → sub.parseOps) tampoco las conoce. tests/oficina-mcp.test.mjs falla si aparece una.
// Variables: AO_OFFICE (la dirección de la oficina; por defecto http://127.0.0.1:4520). La oficina tiene que estar abierta.
// 12 nov 2026: las definiciones y los ejecutores viven en oficina-tools.mjs (puro, sin transporte: lo comparte el conector remoto); este archivo es solo el stdio.
import readline from 'node:readline';
import { TOOLS, publicas, crearLlamador, INSTRUCCIONES } from './oficina-tools.mjs';

const OFFICE = (process.env.AO_OFFICE || 'http://127.0.0.1:4520').replace(/\/+$/, '');

async function office(pathname, body, method) {
  let r;
  try { r = await fetch(OFFICE + pathname, body ? { method: method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) } : { signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error(`la oficina no responde en ${OFFICE}: ábrela (Agents-Office.bat o npm start) y vuelve a intentarlo`); }
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}

const call = crearLlamador({ office });

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return;
  try {
    if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'agents-office', version: '1.0.0' }, instructions: INSTRUCCIONES } });
    if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: publicas(TOOLS) } });
    if (m.method === 'tools/call') {
      try { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: await call(m.params?.name, m.params?.arguments || {}) }] } }); }
      catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'No se pudo: ' + e.message }], isError: true } }); }
    }
    if (m.method === 'ping') return send({ jsonrpc: '2.0', id: m.id, result: {} });
    send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'método desconocido: ' + m.method } });
  } catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }); }
});
