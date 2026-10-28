// Agents Office — ANUNCIOS DE META como servidor MCP que los agentes llaman (stdio, JSON-RPC, sin dependencias). Fase A1 (8 oct 2026).
// serve.mjs lo arranca dentro de cada ejecución de un agente de los departamentos de `anuncios.departments` (por defecto Marketing: `ada`,
// el puesto de anuncios, y su jefe) con --mcp-config, igual que contenido-mcp.mjs, y solo si Meta y la cuenta publicitaria están puestas.
// LEE: la cuenta, las campañas con sus conjuntos y anuncios, sus cifras y lo que Meta rechazó. No hay herramienta que cree en Meta,
// active, pause, cambie presupuestos ni borre (plan §3.5), y la API de la oficina le da 403 a `por: 'agente'` en cualquier cambio.
// Fase A3 (9 oct 2026): deja BORRADORES DE CAMPAÑA EN LA OFICINA (crear_borrador_campana, mejorar_borrador_campana: solo los suyos y
// mientras siguen en borrador). Nunca en Meta: crearlos allí (en pausa) es un clic del dueño en Anuncios; activarlos, dos.
// Fase A5 (9 oct 2026): LEE las sugerencias del diagnóstico (ver_sugerencias_anuncios) y DEJA una (sugerir_mejora_anuncio): la deja,
// nunca la aplica (aplicar es del dueño; la API le da 403 a un agente). Pedir creativos al Estudio no es una herramienta de aquí: lo hace
// la tarea que nace al aplicar una sugerencia de fatiga (anuncios/sugerencias.mjs), y las imágenes las genera el dueño con su costo a la vista.
// Fase A7 (9 oct 2026): LEE el informe de anuncios de un mes (ver_informe_anuncios): lo que arma la oficina sin modelo, con «sin datos»
// donde no se sabe. Guardarlo en el Cerebro es del dueño.
// tests/anuncios-mcp.test.mjs falla si aparece una herramienta con un nombre así.
// Variables que pone serve.mjs: AO_OFFICE (la dirección de la oficina), AO_AGENT y AO_TASK (quién pide).
import readline from 'node:readline';
import { TOOLS, aBorrador, sugerenciasTexto, crearLlamador } from './anuncios-tools.mjs';
export { TOOLS, aBorrador, sugerenciasTexto }; // tests/anuncios-mcp.test.mjs los lee de aquí

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';
async function office(pathname, cuerpo, method) {
  const r = await fetch(OFFICE + pathname, { method: method || (cuerpo ? 'POST' : 'GET'), signal: AbortSignal.timeout(30000), ...(cuerpo ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) } : {}) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}
const call = crearLlamador({ office, agente: process.env.AO_AGENT || '', tarea: process.env.AO_TASK || '' });

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
if (process.argv[1] && /anuncios-mcp\.mjs$/.test(process.argv[1])) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async line => {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.id === undefined) return; // notificaciones (initialized, cancelled…)
    try {
      if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'anuncios', version: '1.0.0' } } });
      if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: TOOLS } });
      if (m.method === 'tools/call') {
        try { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: await call(m.params?.name, m.params?.arguments) }] } }); }
        catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'No se pudo: ' + e.message }], isError: true } }); }
      }
      if (m.method === 'ping') return send({ jsonrpc: '2.0', id: m.id, result: {} });
      send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'método desconocido: ' + m.method } });
    } catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }); }
  });
}
