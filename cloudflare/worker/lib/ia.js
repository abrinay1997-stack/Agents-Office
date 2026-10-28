// Una llamada de texto al modelo (sin herramientas): lo que en la oficina local hacía `claude -p` para redactar, mejorar o resumir.
// Los agentes con herramientas (conectores MCP, candados de envío) son la fase 4: worker/lib/agentes.js.
// Qué modelo la contesta lo decide Ajustes → Modelos según la `funcion` (redactar, resumen, enrutador…); sin ajustes, el de siempre (AI_MODELO o Sonnet).
import { errorDeApi, sistemaDe } from './agentes.js';
import { elegirModelo, armarLlamada, textoDe } from './agentes/llm.js';
import { leerModelos } from './modelos.js';
import * as costos from './agentes/costos.js';
import { sdkContent } from '../../../vision.mjs';

const MAX_TEXTO = 8000;

/** El modelo que contestaría una llamada de texto de esa función (Ajustes → Modelos): para saber ANTES si mira imágenes o no. */
export async function modeloDeTexto(env, { funcion = 'redactar', db = null } = {}) {
  return elegirModelo({ env, modelos: await leerModelos(db || env?.DB || null), funcion });
}
/** ¿Este modelo mira imágenes? (Meta Muse Spark no; un modelo propio, según lo que diga su ficha en Ajustes → Modelos.) */
export const miraImagenes = (modelo) => !!modelo && !modelo.meta && modelo.caps?.vision !== false;

/** { texto, tokens: { entrada, salida }, modelo }. Lanza Error con un mensaje en español (sin claves ni cuerpos crudos). `db`: por defecto env.DB (donde viven los ajustes y el libro de costos).
 *  `imagenes` (28 oct 2026): [{ media_type, data }] ya validadas (vision.mjs) que el modelo mira antes del texto; con un modelo que no mira imágenes se IGNORAN (quien llama lo comprueba antes con miraImagenes).
 *  `modelo`: el que ya se resolvió con modeloDeTexto (para no elegirlo dos veces). */
export async function texto(env, { sistema, usuario, maxTokens = 2048, fetchFn = fetch, funcion = 'redactar', db = null, imagenes = null, modelo: elegido = null }) {
  const base = db || env?.DB || null;
  const modelo = elegido || await modeloDeTexto(env, { funcion, db: base });
  const cuerpoUsuario = String(usuario).slice(0, MAX_TEXTO);
  const p = armarLlamada({ env, modelo, sistema: sistema || sistemaDe({ name: 'Asistente', role: '', does: '', department: 'ops' }), mensajes: [{ role: 'user', content: imagenes?.length && miraImagenes(modelo) ? sdkContent(cuerpoUsuario, imagenes) : cuerpoUsuario }], maxTokens });
  if (!p.tieneClave) throw new Error(`Falta el secreto ${p.secreto} en Cloudflare.`);
  const t0 = Date.now();
  const r = await fetchFn(p.url, { method: 'POST', headers: p.cabeceras, body: JSON.stringify(p.cuerpo) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(errorDeApi(r.status, d));
  const usage = d?.usage || {};
  if (base) { try { await costos.anotar(base, { tipo: funcion, modelo: d?.model || modelo.id, proveedor: modelo.proveedor, usage, ms: Date.now() - t0 }); } catch { /* el libro no tumba una respuesta */ } }
  return { texto: textoDe(Array.isArray(d?.content) ? d.content : []), tokens: { entrada: usage.input_tokens ?? null, salida: usage.output_tokens ?? null }, modelo: modelo.id };
}
