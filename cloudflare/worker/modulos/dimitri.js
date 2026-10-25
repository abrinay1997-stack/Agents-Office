// Fase 6 — Dimitri, la mano derecha del dueño, en la nube. Contesta /api/sub/* con las MISMAS rutas y formas que serve.mjs:
//   GET /api/sub · POST chat (JSON o NDJSON con `stream:true`) · stop · estado · ops · ops/undo · restore · studio · send · clear · weekly
// El prompt y los lectores de su respuesta son los de sub-core.mjs (el mismo código de la oficina local); la conversación vive en D1 (lib/dimitri/chat.js); sus cambios entran por
// las rutas de los módulos ya portados con la sesión del dueño (lib/dimitri/ops.js), y su gasto va a la tabla de costos de la fase 4 (`tipo: 'dimitri'`).
//
// REGLAS (los tests las muerden):
//  · Dimitri es del DUEÑO: todo lo que escribe o gasta (chat, ops, enviar, GENERAR, archivar) es de un administrador. Un editor o un lector no lo usan (403).
//  · Dimitri propone y espera el clic; NUNCA aprueba, envía, publica, paga ni borra, y NUNCA confirma un gasto de anuncios (solo pide la cifra; el segundo clic es del dueño en Anuncios).
//  · Lo que lee de afuera (una imagen, una nota, el resultado de un correo) con órdenes escondidas marca el mensaje y esa respuesta no trae cambios.
import { json, error, prohibido } from '../lib/respuesta.js';
import * as chat from '../lib/dimitri/chat.js';
import { leerPeticion, conversar, estadoRapido, generar, trabajosTerminados, MAX_TEXTO } from '../lib/dimitri/conversar.js';
import { hacerOps, deshacerOp, enviarPlan } from '../lib/dimitri/ops.js';
import { informeSemanal } from '../lib/dimitri/semanal.js';
import { leerContexto } from '../lib/tareas/contexto.js';
import { leerCfg } from '../lib/ajustes.js';
import { nameOf } from '../../../sub-core.mjs';
import * as tareas from './tareas.js';
import * as contenido from './contenido.js';
import * as anuncios from './anuncios.js';
import * as estudio from './estudio.js';

export const nombre = 'dimitri';
export const grupos = ['sub'];

/** Los módulos por los que pasan sus cambios (cada uno con SUS reglas). La Bandeja no: Dimitri no responde mensajes. */
const MODULOS_DIMITRI = [tareas, contenido, anuncios, estudio];
const MAX_CUERPO = 8 * 1024 * 1024; // las imágenes reducidas que ve su visión (el resto de las rutas son unos KB)

/** «Detener»: cada chat en curso tiene su id de corrida y un AbortController (en esta instancia del Worker). */
const corridas = new Map();

async function leerCuerpo(req, tope = 1 << 20) {
  const largo = Number(req.headers.get('content-length') || 0);
  if (largo > tope) return { grande: true };
  const t = await req.text();
  if (t.length > tope) return { grande: true };
  if (!t) return {};
  try { const j = JSON.parse(t); return j && typeof j === 'object' ? j : {}; } catch { return { malo: true }; }
}

export async function manejar(ctx) {
  const { req, env, db, usuario, ruta } = ctx;
  if (ruta !== '/api/sub' && !ruta.startsWith('/api/sub/')) return null;
  if (usuario.rol !== 'admin') return prohibido('Dimitri es la mano derecha del dueño: solo un administrador habla con él.');
  const metodo = req.method, fetchFn = env.__pruebas?.fetch || null;
  const deps = { env, db, usuario, modulos: MODULOS_DIMITRI };

  if (ruta === '/api/sub' && metodo === 'GET') return json({ ...(await chat.cargar(db)), name: nameOf(await leerCfg(db)) });
  if (metodo !== 'POST') return null;
  const b = await leerCuerpo(req, ruta === '/api/sub/chat' ? MAX_CUERPO : 1 << 20);
  if (b.grande) return error(ruta === '/api/sub/chat' ? 'las imágenes pesan demasiado (máx. 8 MB en total)' : 'el cuerpo es demasiado grande', 413);
  if (b.malo) return error('el cuerpo no es JSON', 400);

  if (ruta === '/api/sub/chat') {
    const p = leerPeticion(b); if (p.error) return error(p.error, p.estado || 400);
    if (b.stream !== true) { // Telegram y las páginas viejas: un solo JSON al final
      try { return json(await conversar({ ...deps, req: p, fetchFn })); } catch (e) { return error(String(e?.message || e).slice(0, 300), 500, e); }
    }
    // NDJSON: {type:'start', run} · {type:'done', messages…} | {type:'error', error} (el texto no se va escribiendo: la respuesta llega entera)
    const run = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ac = new AbortController();
    corridas.set(run, ac);
    const enc = new TextEncoder();
    const cuerpo = new ReadableStream({
      async start(c) {
        const linea = (o) => { try { c.enqueue(enc.encode(JSON.stringify(o) + '\n')); } catch { /* el navegador se fue */ } };
        linea({ type: 'start', run });
        try { linea({ type: 'done', ...(await conversar({ ...deps, req: p, signal: ac.signal, fetchFn })) }); }
        catch (e) { linea({ type: 'error', error: ac.signal.aborted ? 'Detenido por ti.' : String(e?.message || e).slice(0, 300) }); }
        finally { corridas.delete(run); try { c.close(); } catch { /* ya cerrado */ } }
      },
    });
    return new Response(cuerpo, { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-content-type-options': 'nosniff', 'x-accel-buffering': 'no' } });
  }
  if (ruta === '/api/sub/stop') {
    const ac = corridas.get(String(b.run || ''));
    if (!ac) return error('esa respuesta ya terminó', 404);
    ac.abort(); return json({ ok: true });
  }
  if (ruta === '/api/sub/estado') return json(await estadoRapido({ ...deps, texto: b.text }));
  if (ruta === '/api/sub/ops') {
    const C = await leerContexto(db);
    const r = await hacerOps({ ...deps, C, msgId: String(b.msg || ''), items: b.items });
    return json(r, r.busy ? 409 : r.error ? 404 : 200);
  }
  if (ruta === '/api/sub/ops/undo') { const r = await deshacerOp({ ...deps, msgId: String(b.msg || ''), k: +b.k }); return json(r, r.error ? 409 : 200); }
  if (ruta === '/api/sub/restore') return (await chat.restaurar(db, String(b.id || ''))) ? json(await chat.cargar(db)) : error('esa conversación ya no se puede recuperar', 404);
  if (ruta === '/api/sub/clear') return json({ ok: true, archived: await chat.archivar(db) }); // se archiva, no se borra
  if (ruta === '/api/sub/send') {
    const C = await leerContexto(db);
    const r = await enviarPlan({ env, db, C, msgId: String(b.msg || ''), edits: b.items, fetchIA: env.__pruebas?.fetchIA });
    return json(r, r.error ? 404 : 200);
  }
  if (ruta === '/api/sub/studio') {
    if (b.lote) return json({ error: 'Los lotes de fotos del Estudio todavía no están en la nube: siguen en la oficina de tu computadora.', pendiente: true }, 501);
    const r = await generar({ ...deps, msgId: String(b.msg || ''), items: b.items, actions: b.actions });
    return json(r, r.busy || r.conflict ? 409 : r.error ? 404 : 200);
  }
  if (ruta === '/api/sub/weekly') {
    try { const t = await informeSemanal({ env, db, force: true, fetchFn }); return json({ ok: true, text: t }); } catch (e) { return error(String(e?.message || e).slice(0, 300), 500, e); }
  }
  return null;
}

/** Cada minuto: los creativos que ya terminaron lo dicen en el chat, y el lunes desde las 8 sale el informe de la semana. */
export async function cadaMinuto(env) {
  const db = env.DB, fetchFn = env.__pruebas?.fetch || null;
  const hayEnviados = await db.prepare("select 1 x from filas where coleccion = 'subgerente' and json like '%\"state\":\"sent\"%' limit 1").first();
  if (hayEnviados) await trabajosTerminados({ env, db, usuario: { id: 'oficina', email: 'oficina', rol: 'editor' }, modulos: MODULOS_DIMITRI }).catch((e) => console.warn('[dimitri] trabajos:', e?.message ?? e));
  const ahora = new Date();
  const hayLlave = !!(env.ANTHROPIC_API_KEY || env.META_API_KEY || env.MODEL_API_KEY);
  if (ahora.getDay() === 1 && ahora.getHours() >= 8 && hayLlave) {
    try { await informeSemanal({ env, db, fetchFn }); } catch (e) { console.warn('[dimitri] informe semanal:', e?.message ?? e); }
  }
}

export { MAX_TEXTO };
