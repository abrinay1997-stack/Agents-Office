// El enrutador: dado un departamento y lo que pidió el dueño, elige al agente, el título y el plan (serve.mjs → route()). En la nube lo decide el mismo
// modelo con la misma pregunta (worker/lib/ia.js); si no hay llave de IA o el modelo no contesta algo usable, la tarea la toma el jefe del departamento
// (igual que en la oficina local cuando el enrutador falla) y el título sale del propio pedido. Nunca inventa un agente: lo que no esté en el roster se descarta.
import { texto } from '../ia.js';
import { guessNeedsOk } from '../../../../routines-core.mjs';

/** Saca el primer objeto JSON de una respuesta de modelo (con texto alrededor, o dentro de un bloque de código). */
export function sacarJSON(t) {
  const s = String(t || ''); const i = s.indexOf('{'); if (i < 0) return null;
  for (let j = s.lastIndexOf('}'); j > i; j = s.lastIndexOf('}', j - 1)) { try { return JSON.parse(s.slice(i, j + 1)); } catch { /* prueba con un cierre más corto */ } }
  return null;
}

export function crearEnrutador({ env, agents, depts, nombre = 'la empresa', fetchFn = undefined }) {
  const lider = dept => agents.find(a => a.department === dept && a.lead) || agents.find(a => a.department === dept);
  const hayIA = !!(env?.ANTHROPIC_API_KEY || env?.META_API_KEY || env?.MODEL_API_KEY);
  const lista = dept => agents.filter(a => a.department === dept).map(a => `- ${a.id} · ${a.name}${a.lead ? ' (lead)' : ''} · ${a.role} · ${a.does}`).join('\n');
  return async function enrutar(dept, texto0) {
    const text = String(texto0 || '').trim(); const d = depts[dept];
    let j = {};
    if (hayIA && d) {
      const sistema = `You are the router for ${nombre}, a business whose departments are run by AI agents. Pick the single best agent for the owner's request — an agent whose skills match the request is the right one — and return ONLY a JSON object — no prose, no code fences.`;
      const usuario = `Department: ${d.name}\nAgents (id · name · role · what they do):\n${lista(dept)}\nOwner's request: "${text}"\n\n` +
        'Return: {"agent":"<id from the list>","title":"<clean imperative task title, max 70 characters>","plan":["<step>","<step>","<step>"],"eta_minutes":<integer>,"why":"<one short sentence>","needs_ok":<true if doing this involves sending, posting, paying, deleting or changing anything outside this machine; false if it only reads and reports>}';
      try { j = sacarJSON((await texto(env, { sistema, usuario, maxTokens: 800, funcion: 'enrutador', ...(fetchFn ? { fetchFn } : {}) })).texto) || {}; }
      catch (e) { console.warn('enrutador: sin respuesta usable, lo toma el jefe:', e?.message); j = {}; }
      if (!Object.keys(j).length) j = { why: 'El enrutador no dio una respuesta clara: la tiene el jefe del departamento.' };
    } else j = { why: hayIA ? '' : 'El enrutador (la IA) no está conectado en la nube: la tiene el jefe del departamento.' };
    const valido = agents.find(a => a.id === j.agent && a.department === dept);
    const agent = (valido || lider(dept))?.id;
    return { agent, title: String(j.title || text.split('\n')[0] || text).slice(0, 90), plan: Array.isArray(j.plan) ? j.plan.slice(0, 4).map(String) : [],
      eta: Number.isFinite(j.eta_minutes) ? j.eta_minutes : 30, why: String(j.why || ''), needsOk: typeof j.needs_ok === 'boolean' ? j.needs_ok : guessNeedsOk(text) };
  };
}
