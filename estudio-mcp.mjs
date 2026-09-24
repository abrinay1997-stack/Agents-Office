// Agents Office — the ESTUDIO as an MCP server the agents call (stdio, JSON-RPC, no dependencies).
// serve.mjs starts it inside each agent run with --mcp-config, so an agent can generate the images or the video its
// task asks for and put them in its deliverable. The work itself happens in the office (POST /api/media/generate):
// the provider keys, the daily budget and the files stay there. Env from serve.mjs: AO_OFFICE (the office URL),
// AO_AGENT, AO_TASK (who is asking, for the file's record).
import readline from 'node:readline';

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';
const TOOLS = [
  { name: 'generar_imagen', description: 'Genera imágenes reales con el Estudio de la oficina (Nano Banana, Grok, OpenAI o fal.ai, según las keys que tenga el dueño) y las guarda en el cerebro. Úsala cuando la tarea pida imágenes, visuales, fondos, portadas o piezas para redes. Escribe el prompt completo y concreto (sujeto, estilo, luz, encuadre, colores de la marca); el texto sobre la imagen se compone aparte, no se lo pidas al motor salvo que la tarea lo exija. Devuelve los archivos: pon en tu entregable las líneas ![…](/media/…) que te devuelve, tal cual.',
    inputSchema: { type: 'object', properties: {
      prompt: { type: 'string', description: 'El prompt de la imagen, completo.' },
      cantidad: { type: 'integer', minimum: 1, maximum: 8, description: 'Cuántas variantes (1–8). Por defecto 1.' },
      formato: { type: 'string', enum: ['1:1', '4:5', '9:16', '16:9', '3:4'], description: 'Proporción. Feed de Instagram 4:5 o 1:1, stories/reels 9:16, web 16:9.' },
      proveedor: { type: 'string', enum: ['gemini', 'grok', 'openai', 'fal', 'prueba'], description: 'Opcional: el motor. Si no lo pones, el que el dueño tenga configurado.' },
    }, required: ['prompt'] } },
  { name: 'generar_video', description: 'Genera un video corto real (5–10 s) con fal.ai (Kling, Seedance, MiniMax…) y lo guarda en el cerebro. Tarda varios minutos. Úsala solo cuando la tarea pida explícitamente un video o un reel generado.',
    inputSchema: { type: 'object', properties: {
      prompt: { type: 'string', description: 'Qué pasa en el video: sujeto, acción, cámara, luz, estilo.' },
      formato: { type: 'string', enum: ['9:16', '16:9', '1:1'], description: 'Reels/stories 9:16, web 16:9.' },
      segundos: { type: 'integer', enum: [5, 10] },
    }, required: ['prompt'] } },
  { name: 'estado_estudio', description: 'Qué motores de imagen/video tiene configurados el dueño y cuánto queda del tope diario. Consúltalo antes de un lote grande.',
    inputSchema: { type: 'object', properties: {} } },
];

async function office(pathname, body) {
  const r = await fetch(OFFICE + pathname, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}
async function call(name, a = {}) {
  if (name === 'estado_estudio') {
    const j = await office('/api/media/providers');
    return `Motores: ${j.providers.map(p => `${p.id} (${p.name}) ${p.on ? 'LISTO' : 'sin key'}`).join(' · ')}. Tope diario: quedan ${j.budget.left} de ${j.budget.limit}. Máximo por pedido: ${j.budget.maxPerRequest}.`;
  }
  const video = name === 'generar_video';
  const j = await office('/api/media/generate', { prompt: a.prompt, n: a.cantidad, ratio: a.formato, provider: video ? (a.proveedor || 'fal') : a.proveedor, kind: video ? 'video' : 'image', seconds: a.segundos, by: 'agent', agent: process.env.AO_AGENT || null, task: process.env.AO_TASK || null });
  return `Listo: ${j.items.length} ${video ? 'video' : j.items.length === 1 ? 'imagen' : 'imágenes'} en el Estudio (costo aprox. US$${j.cost}). Pon estas líneas en tu entregable, tal cual:\n` +
    j.items.map(it => video ? `[▶ ${it.file}](/media/${encodeURI(it.file)})` : `![${String(a.prompt).slice(0, 60).replace(/[[\]]/g, '')}](/media/${encodeURI(it.file)})`).join('\n');
}

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return; // notifications (initialized, cancelled…)
  try {
    if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'estudio', version: '1.0.0' } } });
    if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: TOOLS } });
    if (m.method === 'tools/call') {
      try { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: await call(m.params?.name, m.params?.arguments) }] } }); }
      catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'No se pudo: ' + e.message }], isError: true } }); }
    }
    if (m.method === 'ping') return send({ jsonrpc: '2.0', id: m.id, result: {} });
    send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'método desconocido: ' + m.method } });
  } catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }); }
});
