// Dimitri habla con el modelo. En la oficina local es `ask()` (claude -p o el SDK); aquí es UNA llamada a la API (Anthropic o Meta Muse) sin herramientas:
// Dimitri propone, nunca ejecuta — por eso no tiene herramientas. Todo su gasto cae en la tabla de costos de la fase 4 (`tipo: 'dimitri'`, `'informe'`, `'arranque'`).
import { elegirModelo, llamarModelo, textoDe } from '../agentes/llm.js';
import * as costos from '../agentes/costos.js';
import { leerModelos } from '../modelos.js';
import { delAjuste } from '../../../../modelos-core.mjs';
import { sdkContent } from '../../../../vision.mjs';

/** { text, usd, modelo }. `imagenes`: [{ media_type, data }] ya validadas. `signal`: para «Detener». Lanza Error con un mensaje en español (sin claves ni el cuerpo crudo del proveedor). */
export async function preguntar({ env, db, cfg, fetchFn, signal = null }, sistema, usuario, { maxTokens = 6000, tipo = 'dimitri', imagenes = null, model = null } = {}) {
  const funcion = tipo === 'informe' ? 'resumen' : 'dimitri'; // el resumen del lunes y los informes tienen su propia casilla en Ajustes → Modelos
  const modelos = await leerModelos(db); // `model` es el de quien llama (el resumen pide Sonnet): lo que el dueño asignó en Ajustes → Modelos gana sobre eso
  const modelo = elegirModelo({ task: model && !delAjuste(modelos, { funcion }) ? { model } : {}, agent: {}, env, cfgModelo: cfg?.model, modelos, funcion });
  const base = fetchFn || env.__pruebas?.fetch || ((...a) => fetch(...a));
  const ff = signal ? (u, init = {}) => base(u, { ...init, signal }) : base;
  const contenido = imagenes?.length && !modelo.meta ? sdkContent(usuario, imagenes) : usuario;
  const t0 = Date.now();
  const r = await llamarModelo({ env, modelo, sistema, mensajes: [{ role: 'user', content: contenido }], herramientas: [], maxTokens, fetchFn: ff });
  let usd = 0;
  try { usd = await costos.anotar(db, { tipo, modelo: r.model || modelo.id, proveedor: modelo.meta ? 'meta' : 'anthropic', usage: r.usage, cfgPrices: cfg?.costs?.prices, ms: Date.now() - t0 }); } catch (e) { console.warn('[dimitri] costo:', e?.message ?? e); }
  return { text: textoDe(r.content), usd, modelo: modelo.id, stop: r.stop_reason };
}
