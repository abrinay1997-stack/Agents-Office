// UNA llamada al modelo con herramientas (Messages API de Anthropic, o la de Meta Muse sin herramientas). El bucle (llamar, ejecutar las herramientas
// que pide, volver a llamar) lo gobierna ejecutor.js, paso a paso, para poder cortar entre una vuelta y otra y seguir en la siguiente invocación.
import { errorDeApi } from '../agentes.js';
import { modelFor, modelId, normModel } from '../../../../src/models.js';

const API_ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const API_META = 'https://api.meta.ai/v1/messages';

/** Qué modelo corre una tarea: la precedencia de siempre (tarea > rutina > agente > oficina) y, si la nube tiene AI_MODELO, ese como «el de la oficina». */
export function elegirModelo({ task = {}, agent = {}, env = {}, cfgModelo = '' } = {}) {
  const pick = modelFor({ task: task.model, routine: task.routineModel, agent: agent.model, office: cfgModelo });
  const delaOficina = String(env.AI_MODELO || '').trim();
  const esMeta = /^muse-/i.test(delaOficina);
  if (esMeta) return { id: delaOficina, meta: true, pick };
  const id = pick.from === 'office' && /^claude-/i.test(delaOficina) ? delaOficina : modelId(normModel(pick.model));
  return { id, meta: false, pick };
}

/** El nombre que ve la API (a-z, 0-9, _ y -, hasta 64): `mcp__gmail__search.threads` → `mcp__gmail__search_threads`. Devuelve { alias, original }. */
export function aliasDeHerramienta(original, usados = new Set()) {
  let a = String(original).replace(/[^A-Za-z0-9_-]/g, '_');
  if (a.length > 64) a = a.slice(0, 55) + '_' + [...a].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36).slice(0, 8);
  let k = a, i = 2; while (usados.has(k)) k = a.slice(0, 60) + '_' + i++;
  usados.add(k); return k;
}

/** El cuerpo y las cabeceras de la petición (puro: se prueba sin red). `herramientas`: [{ alias, descripcion, esquema }]. */
export function armarLlamada({ env, modelo, sistema, mensajes, herramientas = [], maxTokens = 4000 }) {
  const cuerpo = { model: modelo.id, max_tokens: maxTokens, system: sistema, messages: mensajes };
  if (herramientas.length && !modelo.meta) cuerpo.tools = herramientas.map(h => ({ name: h.alias, description: String(h.descripcion || '').slice(0, 1000), input_schema: h.esquema || { type: 'object', properties: {} } }));
  const clave = modelo.meta ? (env.META_API_KEY || env.MODEL_API_KEY) : env.ANTHROPIC_API_KEY;
  const cab = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (modelo.meta) cab.authorization = `Bearer ${clave}`; else cab['x-api-key'] = clave;
  return { url: modelo.meta ? API_META : API_ANTHROPIC, cabeceras: cab, cuerpo, tieneClave: !!clave, secreto: modelo.meta ? 'META_API_KEY' : 'ANTHROPIC_API_KEY' };
}

/** → { content, stop_reason, usage, model }. Lanza Error con un mensaje en español (sin clave ni cuerpo crudo) y el estado HTTP entre corchetes, para que reliability lo clasifique. */
export async function llamarModelo({ env, modelo, sistema, mensajes, herramientas, maxTokens, fetchFn = (...a) => fetch(...a), presupuesto = null }) {
  const p = armarLlamada({ env, modelo, sistema, mensajes, herramientas, maxTokens });
  if (!p.tieneClave) throw Object.assign(new Error(`Falta el secreto ${p.secreto} en Cloudflare.`), { fatal: true });
  presupuesto?.externa();
  let r;
  try { r = await fetchFn(p.url, { method: 'POST', headers: p.cabeceras, body: JSON.stringify(p.cuerpo) }); }
  catch (e) { throw new Error(`No se pudo llamar al proveedor de IA (network): ${String(e?.message || '').replace(/sk-[\w-]+/g, '«clave»').slice(0, 120)}`); }
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${errorDeApi(r.status, datos)} [HTTP ${r.status}]`);
  if (datos?.stop_reason === 'refusal') throw new Error('Claude declined this request');
  return { content: Array.isArray(datos?.content) ? datos.content : [], stop_reason: datos?.stop_reason || 'end_turn', usage: datos?.usage || {}, model: datos?.model || modelo.id };
}

export const textoDe = content => (content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
export const usosDe = content => (content || []).filter(b => b.type === 'tool_use');
