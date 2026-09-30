// Agents Office — CONTENIDO como servidor MCP que los agentes llaman (stdio, JSON-RPC, sin dependencias).
// serve.mjs lo arranca dentro de cada ejecución de un agente con --mcp-config, igual que el Estudio (estudio-mcp.mjs). Un agente puede VER
// el calendario de contenido y DEJAR BORRADORES; nunca aprobar, programar ni publicar: esas herramientas no existen aquí, y la API de la
// oficina tampoco se las deja a quien llega como agente. Aprobar es del dueño, en la vista Contenido; publicar, de la oficina, después del OK.
// Variables que pone serve.mjs: AO_OFFICE (la dirección de la oficina), AO_AGENT y AO_TASK (quién pide).
import readline from 'node:readline';

const OFFICE = process.env.AO_OFFICE || 'http://127.0.0.1:4520';

async function office(pathname, body, method) {
  const r = await fetch(OFFICE + pathname, body ? { method: method || 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `la oficina respondió ${r.status}`); return j;
}
const ESTADO = { idea: 'idea', borrador: 'borrador', revision: 'en revisión', aprobada: 'APROBADA' };
const linea = p => `${p.id} · ${p.fecha || 'sin día'}${p.hora ? ' ' + p.hora : ''} · ${p.formato} · ${p.redes.join('+')} · ${ESTADO[p.estado] || p.estado} · «${p.titulo || p.texto.slice(0, 50) || 'sin título'}»${p.medios.length ? ` · ${p.medios.length} medio(s)` : ' · sin imagen'}${p.revision?.errores?.length ? ' · le falta: ' + p.revision.errores[0] : ''}`;

const CAMPOS = {
  titulo: { type: 'string', description: 'Título corto para el calendario (no se publica).' },
  fecha: { type: 'string', description: 'El día que debe salir, AAAA-MM-DD. Sin él, queda en el banco de ideas.' },
  hora: { type: 'string', description: 'HH:MM, de 00:00 a 23:59. Si dudas, déjala vacía: el dueño decide.' },
  formato: { type: 'string', enum: ['post', 'reel', 'carrusel', 'historia'], description: 'post = una imagen; carrusel = 2 a 10; reel = un video; historia = 9:16.' },
  redes: { type: 'array', items: { type: 'string', enum: ['instagram', 'facebook'] }, description: 'Dónde sale. Por defecto, instagram.' },
  texto: { type: 'string', description: 'El texto de la publicación (el caption), listo para salir. Instagram: hasta 2.200 caracteres.' },
  comentario: { type: 'string', description: 'Opcional: el primer comentario que se publica después.' },
  hashtags: { type: 'string', description: 'Opcional: los hashtags, separados por espacios (Instagram admite 30).' },
  textoFacebook: { type: 'string', description: 'Opcional: si en Facebook debe decir otra cosa.' },
  medios: { type: 'array', items: { type: 'string' }, description: 'Los archivos de la galería del Estudio, por su id (como «2026-10/…png»): los que devolvió generar_imagen o buscar_en_galeria. Nunca inventes uno.' },
  historias: { type: 'array', items: { type: 'string' }, description: 'Opcional: ids de la galería para la historia que acompaña al post.' },
  notas: { type: 'string', description: 'Notas para el dueño (por qué esta idea, qué falta, qué dato confirmar). No se publican.' },
};

const TOOLS = [
  { name: 'ver_calendario_contenido', description: 'Lo que hay en el calendario de contenido entre dos fechas: cada pieza con su día, formato, redes, estado y lo que le falta. Úsalo ANTES de proponer nada, para no repetir ni pisar lo que ya está.',
    inputSchema: { type: 'object', properties: { desde: { type: 'string', description: 'AAAA-MM-DD. Por defecto, hoy.' }, hasta: { type: 'string', description: 'AAAA-MM-DD. Por defecto, 30 días después.' }, incluir_ideas_sin_dia: { type: 'boolean', description: 'También el banco de ideas (piezas sin día).' } } } },
  { name: 'ver_pieza', description: 'Una pieza completa: su texto, hashtags, primer comentario, medios y lo que le falta para poder salir.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'El id que sale en ver_calendario_contenido (como p-20261005-a1b2).' } }, required: ['id'] } },
  { name: 'crear_borrador', description: 'Deja una pieza como BORRADOR en el calendario de contenido. No se publica ni se programa: el dueño la revisa, la corrige y la aprueba. Escribe el texto completo y listo para salir, con la voz de la marca. Para la imagen, genérala antes con el Estudio (generar_imagen) y pasa su id en `medios`.',
    inputSchema: { type: 'object', properties: CAMPOS, required: ['texto'] } },
  { name: 'mejorar_borrador', description: 'Cambia un borrador tuyo que aún no está aprobado (por ejemplo, para añadirle la imagen que acabas de generar o arreglar lo que le faltaba). Lo ya aprobado por el dueño no se toca.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, ...CAMPOS }, required: ['id'] } },
];

async function call(name, a = {}) {
  const quien = { por: 'agente', agente: process.env.AO_AGENT || null };
  if (name === 'ver_calendario_contenido') {
    const hoy = new Date(), ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fin = new Date(hoy); fin.setDate(fin.getDate() + 30);
    const q = new URLSearchParams({ desde: a.desde || ymd(hoy), hasta: a.hasta || ymd(fin) }); if (a.incluir_ideas_sin_dia) q.set('sin_fecha', '1');
    const { piezas } = await office('/api/contenido?' + q);
    return piezas.length ? `${piezas.length} pieza(s):\n${piezas.map(linea).join('\n')}` : 'No hay nada en ese rango: el calendario de contenido está libre.';
  }
  if (name === 'ver_pieza') {
    const { pieza: p } = await office('/api/contenido/piezas/' + encodeURIComponent(String(a.id || '')));
    return `${linea(p)}\n\nTEXTO:\n${p.texto || '(vacío)'}${p.comentario ? `\n\nPRIMER COMENTARIO:\n${p.comentario}` : ''}${p.hashtags ? `\n\nHASHTAGS: ${p.hashtags}` : ''}${p.notas ? `\n\nNOTAS: ${p.notas}` : ''}${p.medios.length ? `\n\nMEDIOS: ${p.medios.join(', ')}` : ''}${p.revision.errores.length ? `\n\nLE FALTA: ${p.revision.errores.join(' · ')}` : '\n\nPuede salir (cuando el dueño la apruebe).'}${p.revision.avisos.length ? `\nAVISOS: ${p.revision.avisos.join(' · ')}` : ''}`;
  }
  const datos = { ...a }; delete datos.id;
  if (name === 'crear_borrador') {
    const { pieza: p } = await office('/api/contenido/piezas', { ...datos, ...quien, tarea: process.env.AO_TASK || '', estado: 'borrador' });
    return `Borrador creado: ${linea(p)}\n${p.revision.errores.length ? `Todavía le falta: ${p.revision.errores.join(' · ')}. Puedes arreglarlo con mejorar_borrador (id ${p.id}).` : 'Ya cumple las reglas de cada red. El dueño lo revisa y lo aprueba en Contenido.'}${p.revision.avisos.length ? `\nAvisos: ${p.revision.avisos.join(' · ')}` : ''}\nAcuérdate de decirle al dueño, en tu entregable, que lo dejaste en Contenido.`;
  }
  if (name === 'mejorar_borrador') {
    const { pieza: p } = await office('/api/contenido/piezas/' + encodeURIComponent(String(a.id || '')), { ...datos, ...quien }, 'PATCH');
    return `Borrador actualizado: ${linea(p)}${p.revision.errores.length ? `\nTodavía le falta: ${p.revision.errores.join(' · ')}` : '\nYa cumple las reglas de cada red.'}`;
  }
  throw new Error('herramienta desconocida: ' + name);
}

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
