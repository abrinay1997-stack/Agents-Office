// Agents Office — las herramientas de las TAREAS para los agentes, sin transporte: el servidor MCP local (tareas-mcp.mjs, stdio) y el Worker de Cloudflare
// (cloudflare/worker/lib/agentes/herramientas.js, por función, sin HTTP a sí mismo) las comparten. `office(ruta, cuerpo, método)` es quien habla con la API de la oficina.
import { agendaTexto, rutinasTexto } from './oficina/lecturas.mjs';

const ESTADO = { idea: 'idea', scheduled: 'programada', next: 'en cola', doing: 'en curso', waiting: 'espera el OK del dueño', done: 'hecha' };
const quienTiene = t => (t.person === 'Tú' ? 'DEL DUEÑO (la hace él: no la toques)' : t.person ? `la tiene ${t.person} (persona)` : t.agent); // plan D
const linea = t => `${t.id} · «${t.title}» · ${ESTADO[t.state] || t.state}${t.error ? ' (falló)' : ''} · ${quienTiene(t)}${t.prioridad && t.prioridad !== 'media' ? ' · prioridad ' + t.prioridad : ''}${t.limite ? ' · límite ' + String(t.limite).replace('T', ' ') : ''}${t.pasos?.length ? ` · pasos ${t.pasos.filter(p => p.hecho).length}/${t.pasos.length}` : ''}`;

export const TOOLS = [
  { name: 'ver_mi_tarea', description: 'La tarea que estás haciendo ahora: el pedido, sus PASOS (con su id, para marcar_paso), la fecha límite, la prioridad, el proyecto, lo que la bloquea y los comentarios del dueño. Úsalo al empezar.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'ver_tareas', description: 'Las tareas de la oficina, resumidas, con su id. Para saber qué hay, no repetir trabajo o encontrar el id de la tarea que te bloquea. Nunca adivines un id: sácalo de aquí. Las marcadas «DEL DUEÑO» las hace el dueño en persona: no las ejecutes ni las cambies; si tu trabajo depende de una, pide_bloqueo con su id.',
    inputSchema: { type: 'object', properties: { dept: { type: 'string', enum: ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'], description: 'Solo las de ese departamento.' }, buscar: { type: 'string', description: 'Palabras del título o del pedido.' }, abiertas: { type: 'boolean', description: 'Solo las que no están hechas (por defecto, sí).' }, del_dueno: { type: 'boolean', description: 'Solo las que tiene el dueño en su lista (lo que está haciendo él).' } } } },
  { name: 'ver_agenda', description: 'La agenda de la oficina en palabras: lo vencido, lo de hoy, lo que está en curso, lo que espera el OK del dueño, lo bloqueado y los próximos días. Con `mia`, solo lo tuyo; con `dept`, solo ese departamento; con `dias`, hasta dónde mirar.',
    inputSchema: { type: 'object', properties: { mia: { type: 'boolean', description: 'Solo tus tareas.' }, dept: { type: 'string', enum: ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'], description: 'Solo ese departamento.' }, dias: { type: 'number', description: 'Cuántos días hacia delante (1 a 30; por defecto 7).' } } } },
  { name: 'ver_rutinas', description: 'Las rutinas de la oficina (el trabajo que se repite solo): qué pide cada una, cuándo corre, quién la tiene, si espera el OK del dueño, si está pausada y cuándo es la próxima. Úsalo para no duplicar con una tarea lo que ya hace una rutina, o para citar el horario. Solo lectura: cambiarlas es del dueño.',
    inputSchema: { type: 'object', properties: { dept: { type: 'string', enum: ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'] }, mias: { type: 'boolean', description: 'Solo las que tienes tú.' } } } },
  { name: 'marcar_paso', description: 'Marca como HECHO un paso de tu tarea en curso, en cuanto lo terminas (el dueño ve el avance en vivo). Usa el id del paso que da ver_mi_tarea. Con hecho:false lo desmarca. La nota opcional queda en la bitácora.',
    inputSchema: { type: 'object', properties: { paso: { type: 'string', description: 'El id del paso (como p3k9a1).' }, hecho: { type: 'boolean' }, nota: { type: 'string', description: 'Opcional: qué encontraste o decidiste en ese paso.' } }, required: ['paso'] } },
  { name: 'anotar_en_bitacora', description: 'Deja una línea en la bitácora de tu tarea: «encontré X», «usé la receta Y», «no pude Z porque…». El dueño la ve en el detalle de la tarea. Corta y concreta.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] } },
  { name: 'pedir_bloqueo', description: 'Cuando NO puedes seguir sin algo: un dato que no está en el cerebro, una decisión del dueño, o otra tarea que tiene que terminar antes. Con `tarea` (su id, de ver_tareas) tu tarea espera a esa; sin ella, le dejas al dueño una tarea «Para ti: …» con prioridad alta. Tu tarea se para aquí, con lo que llevas, y sigue sola cuando se resuelva. No inventes el dato que falta.',
    inputSchema: { type: 'object', properties: { porque: { type: 'string', description: 'Qué te falta, en una frase que el dueño entienda.' }, tarea: { type: 'string', description: 'Opcional: el id de la tarea que tiene que terminar antes.' } }, required: ['porque'] } },
  { name: 'crear_borrador_tarea', description: 'Propone trabajo para OTRO departamento (por ejemplo: Marketing pide a Emails el correo del lanzamiento). Nace como IDEA: no se ejecuta hasta que el dueño o el jefe la pidan. Escribe el pedido completo y por qué.',
    inputSchema: { type: 'object', properties: { dept: { type: 'string', enum: ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'] }, texto: { type: 'string', description: 'El pedido, como lo escribiría el dueño.' }, porque: { type: 'string', description: 'Por qué hace falta.' }, titulo: { type: 'string' } }, required: ['dept', 'texto', 'porque'] } },
  { name: 'sugerir_al_dueno', description: 'Le deja al DUEÑO una sugerencia en su lista personal (su Bandeja): algo que solo él puede hacer o decidir y que NO te bloquea (llamar a un cliente, firmar, revisar un precio, decidir entre dos opciones). Nace como sugerencia: él la acepta o la descarta. Si sin eso no puedes seguir, usa pedir_bloqueo. Como mucho 5 sin responder.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string', description: 'Qué debería hacer el dueño, en una o dos frases concretas.' }, porque: { type: 'string', description: 'Por qué se lo sugieres.' }, titulo: { type: 'string', description: 'Corto, en imperativo («Llamar a Óptica Sol»).' } }, required: ['texto', 'porque'] } },
  { name: 'registrar_trabajo', description: 'Anota como hecho algo que hiciste fuera de una tarea (un ajuste, una revisión, una respuesta), para que quede contado en la oficina. Uno por unidad de trabajo terminada.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string', description: 'Qué hiciste y el resultado.' }, titulo: { type: 'string' } }, required: ['texto'] } },
];

/** Las herramientas con quién pide (el agente y su tarea). → async (nombre, argumentos) => texto */
export function crearLlamador({ office, agente: AGENTE = null, tarea: TAREA = '' }) {
  return async function call(name, a = {}) {
    const quien = { por: 'agente', agente: AGENTE };
    const mia = () => { if (!TAREA) throw new Error('esta ejecución no tiene una tarea (es una charla): no hay pasos que marcar'); return TAREA; };
    if (name === 'ver_mi_tarea') {
      const r = await office('/api/tareas/' + encodeURIComponent(mia()));
      const t = r.tarea;
      const del = t.delegada?.a === 'agente:' + AGENTE ? `TE LA DELEGÓ EL DUEÑO (era de su lista personal)${t.delegada.nota ? ': ' + t.delegada.nota : ''}. Cuando termines, entrégala como siempre.` : '';
      return [`${linea(t)}`, `PEDIDO: ${t.text}`, del,
        t.pasos?.length ? `PASOS:\n${t.pasos.map((p, i) => `${i + 1}. [${p.hecho ? 'x' : ' '}] ${p.texto} (id ${p.id})`).join('\n')}` : 'PASOS: ninguno (si el trabajo tiene varias partes, dilo en tu entrega).',
        r.bloquean?.length ? `LA BLOQUEAN: ${r.bloquean.map(d => `«${d.title}» (${ESTADO[d.state] || d.state})`).join(', ')}` : '',
        t.comments?.length ? `COMENTARIOS:\n${t.comments.slice(-6).map(c => `- ${c.by}: ${c.text}`).join('\n')}` : '',
        t.notas?.length ? `TU BITÁCORA:\n${t.notas.slice(-8).map(n => `- ${n.texto}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
    }
    if (name === 'ver_tareas') {
      const l = await office('/api/tasks?light=1');
      const q = String(a.buscar || '').toLowerCase().trim();
      const sel = l.filter(t => !t.archived && (!a.dept || t.dept === a.dept) && (!a.del_dueno || t.person === 'Tú') && (a.abiertas === false || t.state !== 'done') && (!q || `${t.title} ${t.text || ''}`.toLowerCase().includes(q))).slice(-40);
      return sel.length ? `${sel.length} tarea(s):\n${sel.map(linea).join('\n')}` : 'No hay tareas con eso.';
    }
    if (name === 'ver_agenda') return agendaTexto(office, { agente: a.mia ? AGENTE || '' : null, dept: a.dept, dias: a.dias });
    if (name === 'ver_rutinas') return rutinasTexto(office, { dept: a.dept, agente: a.mias ? AGENTE : null }); // 9 oct 2026: solo leer
    if (name === 'marcar_paso') { const r = await office(`/api/tareas/${encodeURIComponent(mia())}/paso`, { paso: String(a.paso || ''), hecho: a.hecho !== false, nota: a.nota, ...quien }); const h = r.pasos.filter(p => p.hecho).length; return `Hecho. Pasos ${h}/${r.pasos.length}.${h === r.pasos.length ? ' Todos los pasos están marcados.' : ''}`; }
    if (name === 'anotar_en_bitacora') { await office(`/api/tareas/${encodeURIComponent(mia())}/nota`, { texto: String(a.texto || ''), ...quien }); return 'Anotado en la bitácora de la tarea.'; }
    if (name === 'pedir_bloqueo') { const r = await office(`/api/tareas/${encodeURIComponent(mia())}/bloqueo`, { porque: String(a.porque || ''), tarea: a.tarea || undefined, ...quien }); return `Tu tarea queda bloqueada (espera a ${r.para}). Termina tu respuesta con lo que llevas y qué falta: la oficina la retoma sola cuando se resuelva.`; }
    if (name === 'crear_borrador_tarea') { const r = await office('/api/tareas/borrador', { dept: a.dept, texto: a.texto, porque: a.porque, titulo: a.titulo, ...quien }); return `Propuesta creada como IDEA (${r.tarea.id}, «${r.tarea.title}»). No se ejecuta hasta que el dueño o el jefe la pidan. Menciónala en tu entrega.`; }
    if (name === 'sugerir_al_dueno') { const r = await office('/api/tareas/sugerir', { texto: a.texto, porque: a.porque, titulo: a.titulo, ...quien }); return `Sugerencia en la Bandeja del dueño (${r.tarea.id}, «${r.tarea.title}»). Él decide si la hace; menciónala en tu entrega.`; }
    if (name === 'registrar_trabajo') { const r = await office('/api/tareas/registro', { texto: a.texto, titulo: a.titulo, ...quien }); return `Registrado como hecho (${r.tarea.id}, «${r.tarea.title}»).`; }
    throw new Error('herramienta desconocida: ' + name);
  }
}
