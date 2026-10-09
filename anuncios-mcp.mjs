// Agents Office — ANUNCIOS DE META como servidor MCP que los agentes llaman (stdio, JSON-RPC, sin dependencias). Fase A1 (8 oct 2026).
// serve.mjs lo arranca dentro de cada ejecución de un agente de los departamentos de `anuncios.departments` (por defecto Marketing: `ada`,
// el puesto de anuncios, y su jefe) con --mcp-config, igual que contenido-mcp.mjs, y solo si Meta y la cuenta publicitaria están puestas.
// SOLO LEE: la cuenta, las campañas con sus conjuntos y anuncios, sus cifras y lo que Meta rechazó. No hay herramienta que cree en Meta,
// active, pause, cambie presupuestos ni borre (plan §3.5), y la API de la oficina le da 403 a `por: 'agente'` en cualquier cambio.
// tests/anuncios-mcp.test.mjs falla si aparece una herramienta con un nombre así.
// Variables que pone serve.mjs: AO_OFFICE (la dirección de la oficina), AO_AGENT y AO_TASK (quién pide).
import readline from 'node:readline';
import { anunciosTexto } from './oficina/lecturas.mjs';

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';
async function office(pathname) {
  const r = await fetch(OFFICE + pathname, { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}

const RANGO = { type: 'string', enum: ['hoy', '7d', '30d', 'mes'], description: 'De qué días son las cifras: hoy, los últimos 7 días (por defecto), los últimos 30 o este mes. Días de la zona horaria de la cuenta.' };
export const TOOLS = [
  { name: 'ver_cuenta_anuncios', description: 'La cuenta publicitaria de Meta: su estado (activa, pago pendiente…), la moneda, el gasto de hoy, de 7 días y del mes contra los topes del dueño, los resultados de 7 días y su costo, y los avisos (anuncios rechazados, tope cerca). Úsalo primero cuando la tarea hable de publicidad.',
    inputSchema: { type: 'object', properties: { rango: RANGO } } },
  { name: 'ver_campanas', description: 'Las campañas con sus conjuntos: id, estado en palabras, objetivo, presupuesto, aprendizaje (aprendiendo, fuera, limitado), público y cifras (gasto, resultados y costo por resultado, CTR, frecuencia). Lo que no lleva «· AO:» en el nombre se creó fuera de la oficina.',
    inputSchema: { type: 'object', properties: { rango: RANGO, estado: { type: 'string', enum: ['todas', 'activas', 'pausadas', 'problemas'], description: 'Por defecto, todas.' } } } },
  { name: 'ver_resultados_anuncios', description: 'Las cifras de un rango por nivel: por campaña, por conjunto o por anuncio (con el texto de cada anuncio). Úsalo para comparar qué funciona; cita las cifras tal cual y nunca inventes una que no esté.',
    inputSchema: { type: 'object', properties: { rango: RANGO, nivel: { type: 'string', enum: ['campana', 'conjunto', 'anuncio'], description: 'Por defecto, anuncio.' } } } },
  { name: 'ver_anuncio', description: 'Una campaña, un conjunto o un anuncio entero por su id (el que sale en las otras herramientas): sus cifras, su creativo (texto, título, botón), su público y aprendizaje, y por qué Meta lo rechazó si lo rechazó.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'El id de Meta de la campaña, el conjunto o el anuncio.' }, rango: RANGO }, required: ['id'] } },
];

async function call(name, a = {}) {
  const base = { rango: a.rango, por: 'agente' };
  if (name === 'ver_cuenta_anuncios') return anunciosTexto(office, { ...base, que: 'cuenta' });
  if (name === 'ver_campanas') return anunciosTexto(office, { ...base, que: 'campanas', nivel: 'conjunto', estado: a.estado });
  if (name === 'ver_resultados_anuncios') return anunciosTexto(office, { ...base, que: 'resultados', nivel: a.nivel || 'anuncio' });
  if (name === 'ver_anuncio') { if (!a.id) throw new Error('falta el id'); return anunciosTexto(office, { ...base, id: String(a.id) }); }
  throw new Error('herramienta desconocida: ' + name);
}

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
