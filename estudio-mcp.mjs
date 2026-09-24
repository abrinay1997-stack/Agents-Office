// Agents Office — the ESTUDIO as an MCP server the agents call (stdio, JSON-RPC, no dependencies).
// serve.mjs starts it inside each agent run with --mcp-config, so an agent can generate the images or the video its
// task asks for and put them in its deliverable. The work itself happens in the office (POST /api/media/jobs, a job in the
// background): the keys, the daily budget and the files stay there. An image usually comes back within the call; a video
// takes minutes, so the tool hands back a «⏳ … (trabajo <id>)» line the agent leaves in its deliverable, and the office swaps
// it for the file when the job ends. Env from serve.mjs: AO_OFFICE (the office URL), AO_AGENT, AO_TASK (who is asking).
import readline from 'node:readline';

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';
const WAIT_IMAGE = 100000, WAIT_VIDEO = 40000; // under the agent's own clock: the rest of a video runs on its own

async function office(pathname, body) {
  const r = await fetch(OFFICE + pathname, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { signal: AbortSignal.timeout(130000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}
let catalog = null;
async function models() { if (!catalog) { try { catalog = await office('/api/media/models'); } catch { catalog = { models: [], engines: [], default: {} }; } } return catalog; }

async function tools() {
  const c = await models(), on = c.models.filter(m => m.on);
  const pick = kind => { const l = on.filter(m => m.kind === kind); return l.length ? { type: 'string', enum: l.map(m => m.id), description: `Opcional. ${l.map(m => `${m.id} = ${m.name}${m.note ? ' (' + m.note + ')' : ''}`).join(' · ')}. Sin él, el del dueño (${c.default?.[kind] || '—'}).` } : { type: 'string', description: 'Opcional: el id del modelo.' }; };
  return [
    { name: 'generar_imagen', description: 'Genera imágenes reales con el Estudio de la oficina y las guarda en el cerebro. Úsala cuando la tarea pida imágenes, visuales, fondos, portadas o piezas para redes. Escribe el prompt completo y concreto (sujeto, estilo, luz, encuadre, colores de la marca). Puedes darle imágenes de la galería como referencia (un producto, un logo, un estilo) por su id (buscar_en_galeria). Devuelve las líneas ![…](/media/…) que pones en tu entregable tal cual; si tarda, una línea ⏳ que también pones tal cual.',
      inputSchema: { type: 'object', properties: {
        prompt: { type: 'string', description: 'El prompt de la imagen, completo.' },
        cantidad: { type: 'integer', minimum: 1, maximum: 8, description: 'Cuántas variantes (1–8). Por defecto 1.' },
        formato: { type: 'string', description: 'Proporción: 1:1, 4:5 (feed de Instagram), 9:16 (stories/reels), 16:9 (web), 3:4, 4:3.' },
        modelo: pick('image'),
        referencias: { type: 'array', items: { type: 'string' }, description: 'Opcional: ids de la galería (como «2026-09/…png») que el modelo usa de referencia.' },
      }, required: ['prompt'] } },
    { name: 'generar_video', description: 'Genera un video corto real y lo guarda en el cerebro. Tarda minutos: devuelve una línea ⏳ que pones en tu entregable tal cual, y la oficina la cambia por el video cuando esté (no esperes). Úsala solo cuando la tarea pida un video o un reel generado. Para ANIMAR una imagen pasa su id en imagen_inicial (y opcionalmente imagen_final).',
      inputSchema: { type: 'object', properties: {
        prompt: { type: 'string', description: 'Qué pasa en el video: sujeto, acción, movimiento de cámara, luz, estilo.' },
        formato: { type: 'string', description: '9:16 (reels/stories), 16:9 (web), 1:1.' },
        segundos: { type: 'integer', minimum: 3, maximum: 30, description: 'Duración; cada modelo tiene su rango (se ajusta solo).' },
        modelo: pick('video'),
        imagen_inicial: { type: 'string', description: 'Opcional: id de la galería con la que empieza el video (animar una imagen).' },
        imagen_final: { type: 'string', description: 'Opcional: id de la galería con la que termina.' },
        referencias: { type: 'array', items: { type: 'string' }, description: 'Opcional: ids de referencia (personaje, producto) para los modelos que las aceptan.' },
      }, required: ['prompt'] } },
    { name: 'buscar_en_galeria', description: 'Busca en la galería del Estudio (lo generado y lo que subió el dueño: productos, logos, fotos) y devuelve ids para usar como referencia o para animar.',
      inputSchema: { type: 'object', properties: { buscar: { type: 'string', description: 'Palabras del prompt o del nombre del archivo. Vacío = lo más reciente.' }, solo_subidas: { type: 'boolean', description: 'Solo lo que subió el dueño.' }, cantidad: { type: 'integer', minimum: 1, maximum: 30 } } } },
    { name: 'estado_trabajo', description: 'Cómo va un trabajo del Estudio (el id que salió en una línea ⏳). Espera hasta un minuto a que termine.',
      inputSchema: { type: 'object', properties: { trabajo: { type: 'string' } }, required: ['trabajo'] } },
    { name: 'estado_estudio', description: 'Qué motores y modelos tiene listos el dueño, cuánto queda del tope diario y qué trabajos de esta tarea siguen en marcha. Consúltalo antes de un lote grande.',
      inputSchema: { type: 'object', properties: {} } },
  ];
}

const alt = t => String(t).slice(0, 60).replace(/[[\]()]/g, '');
const src = f => '/media/' + f.split('/').map(encodeURIComponent).join('/');
function answer(j, prompt) {
  if (j.state === 'failed') throw new Error(j.error || 'el Estudio no pudo generarlo');
  if (j.state === 'done') {
    const lines = j.items.map(f => /\.(mp4|webm)$/i.test(f) ? `[▶ ${f.split('/').pop()}](${src(f)})` : `![${alt(prompt)}](${src(f)})`);
    return `Listo: ${j.items.length} ${j.kind === 'video' ? (j.items.length === 1 ? 'video' : 'videos') : j.items.length === 1 ? 'imagen' : 'imágenes'} con ${j.modelName} (aprox. US$${j.cost}). Pon estas líneas en tu entregable, tal cual:\n${lines.join('\n')}${j.warning ? `\n(Aviso: ${j.warning})` : ''}`;
  }
  return `Sigue en proceso con ${j.modelName} (${j.note || j.state}). No esperes: pon esta línea en tu entregable, tal cual, y la oficina la cambia por el archivo cuando termine:\n⏳ Estudio: ${alt(prompt)} (trabajo ${j.id})`;
}
async function call(name, a = {}) {
  const who = { by: 'agent', agent: process.env.AO_AGENT || null, task: process.env.AO_TASK || null };
  if (name === 'estado_estudio') {
    const c = await office('/api/media/models'); catalog = c;
    const mine = who.task ? (await office('/api/media/jobs?active=1&task=' + encodeURIComponent(who.task))).jobs : [];
    const on = c.models.filter(m => m.on);
    return `Motores: ${c.engines.map(e => `${e.name} ${e.on ? 'LISTO' : 'sin key'}`).join(' · ')}.\nModelos de imagen: ${on.filter(m => m.kind === 'image').map(m => m.id).join(', ') || '—'}.\nModelos de video: ${on.filter(m => m.kind === 'video').map(m => m.id).join(', ') || '—'}.\nTope diario: quedan ${c.budget.left} de ${c.budget.limit} (un video cuenta 5). Máximo por pedido: ${c.budget.maxPerRequest}.` +
      (mine.length ? `\nEn marcha para esta tarea: ${mine.map(j => `${j.id} (${j.modelName}, ${j.note || j.state})`).join('; ')}.` : '');
  }
  if (name === 'buscar_en_galeria') {
    const { items } = await office('/api/media'); const q = String(a.buscar || '').toLowerCase().trim();
    const hits = items.filter(it => (!a.solo_subidas || it.upload) && (!q || `${it.prompt} ${it.file}`.toLowerCase().includes(q))).slice(0, Math.min(30, a.cantidad || 12));
    return hits.length ? hits.map(it => `${it.file} · ${it.kind === 'video' ? 'video' : 'imagen'}${it.upload ? ' · subida por el dueño' : ''} · «${String(it.prompt).slice(0, 90)}»${it.w ? ` · ${it.w}×${it.h}` : ''}`).join('\n') : 'Nada en la galería con eso.';
  }
  if (name === 'estado_trabajo') {
    const { job } = await office(`/api/media/jobs/${encodeURIComponent(String(a.trabajo || '').replace(/[^a-z0-9]/gi, ''))}?wait=60000`);
    return answer(job, job.prompt);
  }
  const video = name === 'generar_video';
  const media = video ? { start: a.imagen_inicial ? [a.imagen_inicial] : [], end: a.imagen_final ? [a.imagen_final] : [], reference: a.referencias || [] } : { reference: a.referencias || [] };
  const settings = { ...(a.formato ? { aspectRatio: a.formato } : {}), ...(a.segundos ? { duration: a.segundos } : {}) };
  const { job } = await office('/api/media/jobs', { prompt: a.prompt, n: a.cantidad, kind: video ? 'video' : 'image', model: a.modelo, settings, media, wait: video ? WAIT_VIDEO : WAIT_IMAGE, ...who });
  return answer(job, a.prompt);
}

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return; // notifications (initialized, cancelled…)
  try {
    if (m.method === 'initialize') return send({ jsonrpc: '2.0', id: m.id, result: { protocolVersion: m.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'estudio', version: '2.0.0' } } });
    if (m.method === 'tools/list') return send({ jsonrpc: '2.0', id: m.id, result: { tools: await tools() } });
    if (m.method === 'tools/call') {
      try { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: await call(m.params?.name, m.params?.arguments) }] } }); }
      catch (e) { return send({ jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text: 'No se pudo: ' + e.message }], isError: true } }); }
    }
    if (m.method === 'ping') return send({ jsonrpc: '2.0', id: m.id, result: {} });
    send({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'método desconocido: ' + m.method } });
  } catch (e) { send({ jsonrpc: '2.0', id: m.id, error: { code: -32603, message: e.message } }); }
});
