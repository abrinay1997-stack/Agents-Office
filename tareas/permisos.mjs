// Agents Office (6 oct 2026, plan T3 · §5.F) — quién puede cambiar QUÉ campo de una tarea. Un mapa puro que la API aplica a cualquier
// puerta (la página, Telegram, Dimitri, un agente por su MCP), en vez de reglas sueltas en cada ruta. Con test.
// Quién: 'dueno' · 'persona' · 'jefe' · 'dimitri' · 'agente' · 'telegram'.
// Cuándo: los campos de TRABAJO (texto, agente, modelo, esfuerzo, hora de arranque, «necesita OK») solo antes de empezar; los de
// ORGANIZACIÓN (prioridad, etiquetas, fecha límite, proyecto, estimación, bloqueos, orden, pasos) en cualquier momento salvo hecha.

export const TRABAJO = ['text', 'title', 'agent', 'model', 'effort', 'at', 'needsOk'];
export const ORGANIZACION = ['prioridad', 'etiquetas', 'limite', 'proyecto', 'estimacion', 'bloqueadaPor', 'orden', 'pasos', 'repetir'];

const PUEDE = {
  dueno: new Set([...TRABAJO, ...ORGANIZACION]),
  persona: new Set(['pasos', 'etiquetas', 'estimacion', 'repetir']),
  jefe: new Set(['agent', 'prioridad', 'etiquetas', 'limite', 'pasos', 'estimacion', 'bloqueadaPor', 'orden', 'repetir']),
  dimitri: new Set(['text', 'title', 'at', 'prioridad', 'etiquetas', 'limite', 'proyecto', 'estimacion', 'bloqueadaPor', 'repetir']),
  agente: new Set(['pasos']), // y solo marcar los de SU tarea en curso: ver puedeMarcarPaso
  telegram: new Set([]),
};
const NOMBRE = { text: 'el texto', title: 'el título', agent: 'el agente', model: 'el modelo', effort: 'el esfuerzo', at: 'la hora', needsOk: '«necesita tu OK»', prioridad: 'la prioridad', etiquetas: 'las etiquetas', limite: 'la fecha límite', proyecto: 'el proyecto', estimacion: 'la estimación', bloqueadaPor: 'los bloqueos', orden: 'el orden', pasos: 'los pasos', repetir: 'cómo se repite' };

// → { ok } | { ok: false, campo, motivo }
export function revisar(t, campos, quien = 'dueno') {
  const lista = PUEDE[quien] || new Set();
  const empezada = !['next', 'scheduled', 'idea'].includes(t.state);
  for (const k of campos) {
    if (!(k in NOMBRE)) continue;
    if (!lista.has(k)) return { ok: false, campo: k, motivo: `${quien === 'agente' ? 'un agente' : quien === 'persona' ? 'una persona del equipo' : quien === 'jefe' ? 'el jefe' : quien} no puede cambiar ${NOMBRE[k]}` };
    if (TRABAJO.includes(k) && empezada) return { ok: false, campo: k, motivo: `${NOMBRE[k]} solo se cambia antes de que empiece` };
    if (ORGANIZACION.includes(k) && t.state === 'done' && !t.error && !['etiquetas', 'proyecto', 'repetir'].includes(k)) return { ok: false, campo: k, motivo: `ya está hecha: ${NOMBRE[k]} no cambia` };
  }
  return { ok: true };
}

// un agente solo marca los pasos de la tarea que TIENE (en curso y tomada por él)
export const puedeMarcarPaso = (t, agente) => !!t && t.state === 'doing' && (t.agent === agente || (t.team?.pieces || []).some(p => p.agent === agente && p.state === 'doing'));
