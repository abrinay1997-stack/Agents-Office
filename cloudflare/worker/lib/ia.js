// Una llamada de texto al modelo (sin herramientas): lo que en la oficina local hacía `claude -p` para redactar, mejorar o resumir.
// Los agentes con herramientas (conectores MCP, candados de envío) son la fase 4: worker/lib/agentes.js.
import { armarPeticion, errorDeApi } from './agentes.js';

/** { texto, tokens: { entrada, salida } }. Lanza Error con un mensaje en español (sin claves ni cuerpos crudos). */
export async function texto(env, { sistema, usuario, maxTokens = 2048, fetchFn = fetch }) {
  const p = armarPeticion({ agente: { name: 'Asistente', role: '', does: '', department: 'ops' }, texto: usuario, conectores: [], env });
  if (!p.tieneClave) throw new Error(`Falta el secreto ${p.esMeta ? 'META_API_KEY' : 'ANTHROPIC_API_KEY'} en Cloudflare.`);
  const cuerpo = { ...p.cuerpo, max_tokens: maxTokens, ...(sistema ? { system: sistema } : {}) };
  const r = await fetchFn(p.url, { method: 'POST', headers: p.cabeceras, body: JSON.stringify(cuerpo) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(errorDeApi(r.status, d));
  const bloques = Array.isArray(d?.content) ? d.content : [];
  return { texto: bloques.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(), tokens: { entrada: d?.usage?.input_tokens ?? null, salida: d?.usage?.output_tokens ?? null } };
}
