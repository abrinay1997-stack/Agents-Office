// Dimitri habla con el modelo. En la oficina local es `ask()` (claude -p o el SDK); aquí es la API (Anthropic o Meta Muse).
//  · `preguntar`: UNA llamada, sin herramientas (el resumen del lunes, los informes, y el chat cuando el modelo no usa herramientas).
//  · `preguntarConHerramientas` (27 oct 2026): el chat con consultas de LECTURA. Un bucle corto —llamar, ejecutar lo que pide, volver a llamar— con tope de vueltas y de llamadas,
//    cada una avisando su paso (`alPaso`) para que el dueño VEA qué está leyendo, como en BRIAN. Dimitri sigue sin escribir nada por esta puerta: las herramientas solo leen, y lo
//    que cambia algo es siempre una tarjeta con el clic del dueño.
// Todo su gasto cae en la tabla de costos de la fase 4 (`tipo: 'dimitri'`, `'informe'`, `'arranque'`), una fila por llamada.
import { elegirModelo, llamarModelo, textoDe, usosDe } from '../agentes/llm.js';
import * as costos from '../agentes/costos.js';
import { leerModelos } from '../modelos.js';
import { delAjuste, buscar as buscarModelo } from '../../../../modelos-core.mjs';
import { sdkContent } from '../../../../vision.mjs';

export const MAX_VUELTAS = 6;     // llamadas al modelo en un turno (la última siempre sin herramientas: tiene que contestar)
export const MAX_LLAMADAS = 10;   // herramientas ejecutadas en un turno

/** Qué modelo corre esto, y de dónde salió (para decírselo al dueño). `model`: el de quien llama (el resumen pide Sonnet): lo que el dueño asignó en Ajustes → Modelos gana sobre eso. */
export async function resolverModelo({ env, db, cfg }, { tipo = 'dimitri', model = null } = {}) {
  const funcion = tipo === 'informe' ? 'resumen' : 'dimitri'; // el resumen del lunes y los informes tienen su propia casilla en Ajustes → Modelos
  const modelos = await leerModelos(db);
  const modelo = elegirModelo({ task: model && !delAjuste(modelos, { funcion }) ? { model } : {}, agent: {}, env, cfgModelo: cfg?.model, modelos, funcion });
  const ficha = buscarModelo(modelo.id, modelos);
  return { modelo, modelos, funcion, nombre: ficha?.nombre || modelo.id };
}

/** «Claude Sonnet 5.5 (claude-sonnet-5-5), elegido por … ; se cambia en Ajustes → Modelos» — la línea que Dimitri lee de sí mismo. */
export function descripcionModelo({ modelo, nombre }, { puedeCambiar = true } = {}) {
  const como = modelo.caps?.herramientas ? 'usa herramientas de consulta' : 'solo redacta (no usa herramientas)';
  return `${nombre}${nombre !== modelo.id ? ` (${modelo.id})` : ''} — ${como}; sale de ${modelo.de || 'el valor por defecto'}${puedeCambiar ? '. El dueño lo cambia en Ajustes → Modelos → «Dimitri (chat, plan, estudio)»' : ''}`;
}

/** El sistema que ve la API: con Anthropic, la parte FIJA lleva marca de caché (cada vuelta la relee a ~10 % del precio); con Meta, un solo texto. */
export function sistemaParaApi(sistema, modelo) {
  if (typeof sistema === 'string') return sistema;
  const { fijo, variable } = sistema;
  if (modelo.meta) return `${fijo}\n\n${variable}`;
  return [{ type: 'text', text: fijo, cache_control: { type: 'ephemeral' } }, { type: 'text', text: variable }];
}

const fetchDe = ({ env, fetchFn, signal }) => {
  const base = fetchFn || env.__pruebas?.fetch || ((...a) => fetch(...a));
  return signal ? (u, init = {}) => base(u, { ...init, signal }) : base;
};

async function anotarCosto({ db, cfg }, tipo, modelo, r, t0) {
  try { return await costos.anotar(db, { tipo, modelo: r.model || modelo.id, proveedor: modelo.meta ? 'meta' : 'anthropic', usage: r.usage, cfgPrices: cfg?.costs?.prices, ms: Date.now() - t0 }); }
  catch (e) { console.warn('[dimitri] costo:', e?.message ?? e); return 0; }
}

/** { text, usd, modelo, stop }. `imagenes`: [{ media_type, data }] ya validadas. `signal`: para «Detener». `resuelto`: lo que devolvió resolverModelo (para no elegirlo dos veces). Lanza Error con un mensaje en español (sin claves ni el cuerpo crudo del proveedor). */
export async function preguntar(ctx, sistema, usuario, { maxTokens = 6000, tipo = 'dimitri', imagenes = null, model = null, resuelto = null } = {}) {
  const { modelo } = resuelto || await resolverModelo(ctx, { tipo, model });
  const contenido = imagenes?.length && !modelo.meta ? sdkContent(usuario, imagenes) : usuario;
  const t0 = Date.now();
  const r = await llamarModelo({ env: ctx.env, modelo, sistema: sistemaParaApi(sistema, modelo), mensajes: [{ role: 'user', content: contenido }], herramientas: [], maxTokens, fetchFn: fetchDe(ctx) });
  const usd = await anotarCosto(ctx, tipo, modelo, r, t0);
  return { text: textoDe(r.content), usd, modelo: modelo.id, stop: r.stop_reason };
}

/**
 * El chat con consultas. `herramientas`: [{ alias, descripcion, esquema }] · `ejecutar(alias, entrada) → { texto, esError?, resumen?, titulo?, inyeccion? }` (nunca lanza: un fallo es un resultado con esError).
 * `alPaso({ n, tipo, nombre, titulo, estado, resumen, ms })` se llama al empezar (estado 'en_curso') y al acabar cada consulta ('ok' | 'error'), para enseñarlo en vivo.
 * Un modelo sin herramientas (Muse Spark) contesta de una vez, con lo que ya está en el prompt. Una consulta que trae órdenes escondidas (`inyeccion`) corta el bucle: no se sigue leyendo.
 * → { text, usd, modelo, stop, pasos, llamadas, inyeccion? }
 */
export async function preguntarConHerramientas(ctx, sistema, usuario, { maxTokens = 6000, tipo = 'dimitri', imagenes = null, model = null, resuelto = null, herramientas = [], ejecutar = null, alPaso = null, maxVueltas = MAX_VUELTAS, maxLlamadas = MAX_LLAMADAS } = {}) {
  const { modelo } = resuelto || await resolverModelo(ctx, { tipo, model });
  const sinHerramientas = !herramientas.length || !ejecutar || !modelo.caps?.herramientas || modelo.meta;
  if (sinHerramientas) { const r = await preguntar(ctx, sistema, usuario, { maxTokens, tipo, imagenes, resuelto: { modelo } }); return { ...r, pasos: [], llamadas: 0 }; }
  const ff = fetchDe(ctx), sis = sistemaParaApi(sistema, modelo);
  let mensajes = [{ role: 'user', content: imagenes?.length ? sdkContent(usuario, imagenes) : usuario }];
  const pasos = [];
  let usd = 0, llamadas = 0, texto = '', stop = 'end_turn', inyeccion = null;
  for (let vuelta = 0; vuelta < maxVueltas; vuelta++) {
    const conTools = vuelta < maxVueltas - 1 && llamadas < maxLlamadas && !inyeccion;
    const t0 = Date.now();
    const r = await llamarModelo({ env: ctx.env, modelo, sistema: sis, mensajes, herramientas, sinHerramientas: !conTools, maxTokens, fetchFn: ff }); // la lista de herramientas no cambia entre vueltas: ver armarLlamada
    usd += await anotarCosto(ctx, tipo, modelo, r, t0);
    stop = r.stop_reason;
    const usos = usosDe(r.content);
    if (!usos.length || r.stop_reason !== 'tool_use' || !conTools) { texto = textoDe(r.content); break; }
    mensajes = [...mensajes, { role: 'assistant', content: r.content }];
    const resultados = [];
    for (const u of usos) {
      if (ctx.signal?.aborted) throw new Error('Detenido por ti.');
      let res;
      if (inyeccion) res = { texto: 'No se sigue leyendo: lo anterior trae órdenes escondidas.', esError: true };
      else if (llamadas >= maxLlamadas) res = { texto: 'Ya hiciste las consultas que caben en un turno; contesta con lo que tienes.', esError: true };
      else {
        llamadas++;
        const n = pasos.length + 1, entrada = u.input && typeof u.input === 'object' ? u.input : {}, t1 = Date.now();
        const paso = { n, tipo: 'herramienta', nombre: u.name, titulo: u.name, estado: 'en_curso', resumen: '', ms: 0 };
        alPaso?.({ ...paso });
        try { res = await ejecutar(u.name, entrada); } catch (e) { res = { texto: `No pude hacer esa consulta: ${String(e?.message || e).slice(0, 200)}`, esError: true }; }
        Object.assign(paso, { titulo: res.titulo || u.name, estado: res.esError ? 'error' : 'ok', resumen: String(res.resumen || '').slice(0, 160), ms: Date.now() - t1 });
        pasos.push(paso); alPaso?.({ ...paso });
        if (res.inyeccion) inyeccion = res.inyeccion;
      }
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: String(res.texto ?? ''), ...(res.esError ? { is_error: true } : {}) });
    }
    mensajes = [...mensajes, { role: 'user', content: resultados }];
  }
  return { text: texto, usd, modelo: modelo.id, stop, pasos, llamadas, ...(inyeccion ? { inyeccion } : {}) };
}
