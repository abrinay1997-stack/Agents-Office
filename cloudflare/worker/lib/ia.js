// Una llamada de texto al modelo (sin herramientas): lo que en la oficina local hacía `claude -p` para redactar, mejorar o resumir.
// Los agentes con herramientas (conectores MCP, candados de envío) son la fase 4: worker/lib/agentes.js.
// Qué modelo la contesta lo decide Ajustes → Modelos según la `funcion` (redactar, resumen, enrutador…); sin ajustes, el de siempre (AI_MODELO o Sonnet).
import { errorDeApi, sistemaDe } from './agentes.js';
import { elegirModelo, armarLlamada, textoDe } from './agentes/llm.js';
import { leerModelos } from './modelos.js';
import * as costos from './agentes/costos.js';

const MAX_TEXTO = 8000;

/** { texto, tokens: { entrada, salida }, modelo }. Lanza Error con un mensaje en español (sin claves ni cuerpos crudos). `db`: por defecto env.DB (donde viven los ajustes y el libro de costos). */
export async function texto(env, { sistema, usuario, maxTokens = 2048, fetchFn = fetch, funcion = 'redactar', db = null }) {
  const base = db || env?.DB || null;
  const modelo = elegirModelo({ env, modelos: await leerModelos(base), funcion });
  const p = armarLlamada({ env, modelo, sistema: sistema || sistemaDe({ name: 'Asistente', role: '', does: '', department: 'ops' }), mensajes: [{ role: 'user', content: String(usuario).slice(0, MAX_TEXTO) }], maxTokens });
  if (!p.tieneClave) throw new Error(`Falta el secreto ${p.secreto} en Cloudflare.`);
  const t0 = Date.now();
  const r = await fetchFn(p.url, { method: 'POST', headers: p.cabeceras, body: JSON.stringify(p.cuerpo) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(errorDeApi(r.status, d));
  const usage = d?.usage || {};
  if (base) { try { await costos.anotar(base, { tipo: funcion, modelo: d?.model || modelo.id, proveedor: modelo.proveedor, usage, ms: Date.now() - t0 }); } catch { /* el libro no tumba una respuesta */ } }
  return { texto: textoDe(Array.isArray(d?.content) ? d.content : []), tokens: { entrada: usage.input_tokens ?? null, salida: usage.output_tokens ?? null }, modelo: modelo.id };
}
