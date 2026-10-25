// Fase 6 — Disparadores en la nube: POST /api/hook/<id> (público, con AO_HOOK_TOKEN) y GET|PUT /api/triggers. Mismas rutas y formas que serve.mjs. Guía: docs/disparadores.md.
//
// El webhook es PÚBLICO (lo llama Zapier, tu tienda, WhatsApp…), por eso, en este orden y sin saltarse nada:
//   1. el secreto AO_HOOK_TOKEN, en tiempo constante, ANTES de abrir el cuerpo o tocar D1 (sin él: 401);   2. el tope de peticiones por minuto;
//   3. el disparador existe y no está pausado;   4. el cuerpo, con tope de 1 MB;   5. el mismo evento una sola vez y el tope `perHour`;   6. lo recibido va al agente como DATOS, no como órdenes.
import { json, error, prohibido } from '../lib/respuesta.js';
import * as T from '../../../triggers-core.mjs';
import { tokenValido, tokenDe, tasaPublica, leerConTope, TOPE_CUERPO } from '../lib/publica.js';
import { leerContexto } from '../lib/tareas/contexto.js';
import { leerDisparadores, guardarDisparadores, admitir, olvidarEvento, limpiarEventos, crearTareaDeEvento, avisar } from '../lib/disparadores.js';
import { conAnuncios, ESPEJO_WEBHOOK } from '../lib/anuncios-nube.js';
import { deDisparador } from '../../../anuncios/conversiones.mjs';

export const nombre = 'disparadores';
export const grupos = ['triggers', 'hook'];
const MAX_POR_MINUTO = 120;

export async function publica({ req, env, db, url, ruta }) {
  const m = /^\/api\/hook\/([a-z0-9-]+)$/.exec(ruta);
  if (!m) return null;
  const id = m[1];
  if (req.method === 'GET') { // WhatsApp Cloud API prueba la dirección con un GET antes de mandar nada
    if (url.searchParams.get('hub.mode') === 'subscribe' && tokenValido(url.searchParams.get('hub.verify_token') || '', env.AO_HOOK_TOKEN)) return new Response(String(url.searchParams.get('hub.challenge') || ''), { status: 200, headers: { 'content-type': 'text/plain', 'x-content-type-options': 'nosniff' } });
    return json({ error: 'refused' }, 403);
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  // 1) el secreto, antes que nada
  if (!tokenValido(tokenDe(req, url), env.AO_HOOK_TOKEN)) return json({ error: String(env.AO_HOOK_TOKEN || '').length >= 16 ? 'token incorrecto' : 'esta oficina no acepta webhooks: falta el secreto AO_HOOK_TOKEN' }, 401);
  // 2) un tope por minuto para todos los disparadores juntos
  if (!(await tasaPublica(db, 'hook', MAX_POR_MINUTO)).ok) return json({ error: `demasiados eventos por minuto (${MAX_POR_MINUTO})` }, 429);
  // 3) el disparador
  const C = await leerContexto(db), { triggers: lista, problems } = await leerDisparadores(db, C.agents), tr = lista.find((t) => t.id === id);
  if (!tr) { const p = problems.find((x) => x.startsWith(id + ':') || x.includes(`«${id}»`)); return json({ error: p || `no hay un disparador «${id}»` }, 404); }
  if (tr.paused) return json({ ok: true, skipped: 'pausado' }, 202);
  // 4) el cuerpo, con tope
  const raw = await leerConTope(req, TOPE_CUERPO);
  if (raw === null) return json({ error: 'demasiado grande' }, 413);
  let data = {};
  try { data = /json/.test(req.headers.get('content-type') || '') || /^\s*[{[]/.test(raw) ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw)); } catch { return json({ error: 'el cuerpo no es JSON ni un formulario' }, 400); }
  const a = T.adapt(tr.source, data);
  if (a.skip) return json({ ok: true, skipped: a.skip }, 200);
  // 5) una sola vez, y sin pasar del tope por hora
  const adm = await admitir(db, tr, a.eventId);
  if (!adm.ok) {
    if (!adm.dup) await avisar(db, { kind: 'trigger', level: 'warn', text: `El disparador «${id}» se frenó: ${adm.why}.`, key: 'trig-' + id });
    return json({ ok: adm.dup, skipped: adm.why }, adm.dup ? 200 : 429);
  }
  // una conversión para Meta (un pago o un formulario), si la API de conversiones está encendida; apunta y sigue (la manda el reloj del minuto siguiente)
  try { await conAnuncios({ db, env, espejo: ESPEJO_WEBHOOK }, async (an) => { if (an.conv.encendida()) { const ce = deDisparador(tr, a, data); if (ce) an.conv.registrar(ce, { quien: 'disparador' }); } }); } catch (e) { console.warn(`[hook ${id}] conversiones:`, e?.message ?? e); }
  // 6) la tarea (los datos como DATOS; órdenes escondidas → espera el OK del dueño)
  try {
    const { task } = await crearTareaDeEvento({ env, db, tr, a, fetchFn: env.__pruebas?.fetchIA });
    return json({ ok: true, task: task.id, title: task.title }, 200);
  } catch (e) {
    await olvidarEvento(db, tr, adm.evento); // no se pudo crear: que el reintento del que llama no sea «repetido»
    console.error(`[hook ${id}]`, e?.message ?? e);
    return json({ error: 'no se pudo crear la tarea; vuelve a intentarlo' }, 500);
  }
}

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (ruta !== '/api/triggers') return null;
  const C = await leerContexto(db);
  if (req.method === 'GET') {
    const t = await leerDisparadores(db, C.agents);
    return json({ ...t, path: 'disparadores (en la nube)', token: String(env.AO_HOOK_TOKEN || '').length >= 16, url: '/api/hook/<id>' });
  }
  if (req.method === 'PUT') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia los disparadores.');
    const b = (await ctx.cuerpo(req)) || {};
    if (!Array.isArray(b.triggers)) return error('manda { triggers: [...] }', 400);
    const r = await guardarDisparadores(db, b.triggers, C.agents);
    if (!r.ok) return json({ error: r.problems.join(' · '), problems: r.problems }, 422);
    return json({ ok: true, triggers: r.triggers });
  }
  return null;
}

export async function cadaMinuto(env) {
  if (new Date().getMinutes() === 7) await limpiarEventos(env.DB).catch(() => {}); // una vez por hora
}
