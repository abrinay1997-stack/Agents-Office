// Agents Office — la BIBLIOTECA DE HABILIDADES como servidor MCP que los agentes llaman (stdio, JSON-RPC, sin dependencias; 7 oct 2026).
// serve.mjs lo arranca en cada ejecución de un agente que tiene habilidades, como Tareas o el Estudio. Solo LEE: ver la lista y leer
// una habilidad o una de sus referencias (plantillas, listas, ejemplos). Nada aquí escribe, envía ni cambia nada
// (tests/biblioteca.test.mjs lo comprueba). Variables que pone serve.mjs: AO_OFFICE y AO_AGENT.
import readline from 'node:readline';

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';
const AGENTE = process.env.AO_AGENT || '';

async function office(pathname) {
  const r = await fetch(OFFICE + pathname, { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}

export const TOOLS = [
  { name: 'ver_habilidades', description: 'La biblioteca de habilidades: métodos probados (plan de marketing, textos que venden, anuncios, SEO, correos, precios, lanzamientos…). Devuelve id, título y cuándo usar cada una. Sin filtros, las de tu puesto y tu departamento; con `buscar`, las que tratan de eso; con `todas`, las de toda la oficina.',
    inputSchema: { type: 'object', properties: { buscar: { type: 'string', description: 'Palabras del tema (p. ej. «anuncios de Meta», «precio», «correo de bienvenida»).' }, todas: { type: 'boolean', description: 'Toda la biblioteca, no solo la tuya.' } } } },
  { name: 'leer_habilidad', description: 'Lee una habilidad entera (sus pasos, su forma de entrega, sus reglas y la lista de sus referencias) o, con `referencia`, una de sus referencias (una plantilla, una lista de revisión, ejemplos). Léela ANTES de empezar el trabajo que cubre y síguela.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'El id de la habilidad (como redaccion-publicitaria).' }, referencia: { type: 'string', description: 'Opcional: el nombre de una de sus referencias.' } }, required: ['id'] } },
];

async function call(name, a = {}) {
  if (name === 'ver_habilidades') {
    const q = new URLSearchParams(); if (AGENTE && !a.todas) q.set('agente', AGENTE); if (a.buscar) q.set('buscar', String(a.buscar));
    const r = await office('/api/biblioteca?' + q);
    if (!r.habilidades.length) return a.buscar ? `No hay habilidades sobre «${a.buscar}»${AGENTE && !a.todas ? ' en tu puesto o departamento (prueba con todas: true)' : ''}.` : 'No hay habilidades para ti.';
    return `${r.habilidades.length} habilidad(es):\n${r.habilidades.map(h => `- ${h.id} — ${h.titulo} (${h.areaNombre}): ${h.description}`).join('\n')}`;
  }
  if (name === 'leer_habilidad') {
    const id = String(a.id || '').trim(); if (!/^[a-z0-9-]+$/.test(id)) throw new Error('el id es como redaccion-publicitaria (lo da ver_habilidades)');
    const r = await office(`/api/biblioteca/${id}${a.referencia ? '?referencia=' + encodeURIComponent(String(a.referencia)) : ''}`);
    return `<habilidad>\n${r.texto}\n</habilidad>`;
  }
  throw new Error('herramienta desconocida: ' + name);
}

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async line => {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.id === undefined) return;
    try {
      if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'habilidades', version: '1.0.0' } } });
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
