// Fase 6 — Telegram en la nube: el webhook público POST /api/telegram/webhook y los avisos que salen cada minuto. Guía: docs/cloudflare.md → Fase 6 y docs/telegram.md.
// Dimitri en el teléfono: las aprobaciones llegan con ✅ / ↩, los fallos con ↻, los avisos de la oficina como mensajes (con el horario de no molestar), y cualquier otro texto va a Dimitri.
//
// El webhook es PÚBLICO (lo llama Telegram), por eso, en este orden y sin saltarse nada:
//   1. el secreto X-Telegram-Bot-Api-Secret-Token contra TELEGRAM_WEBHOOK_SECRET (tiempo constante), ANTES de abrir el cuerpo o tocar D1 (sin él: 401, D1 intacta);
//   2. el tope de peticiones por minuto;   3. el cuerpo, con tope;   4. el número del update (Telegram reintenta: un botón no se pulsa dos veces);
//   5. QUIÉN escribe: solo los ids de TELEGRAM_OWNER_ID usan el bot (un extraño recibe su id y nada más); un aprobador delegado (telegram.approvers) solo aprueba o devuelve lo de SUS departamentos.
// Todo lo que el bot hace entra por las MISMAS rutas que la página, con la sesión del dueño: solo el dueño aprueba, el gasto de anuncios pide dos toques y la cifra.
import { json } from '../lib/respuesta.js';
import { tokenValido, tasaPublica, leerConTope } from '../lib/publica.js';
import { armar, atenderUpdate, salientes } from '../lib/telegram.js';
import { configured } from '../../../telegram-core.mjs';
import * as tareas from './tareas.js';
import * as agentes from './agentes.js';
import * as contenido from './contenido.js';
import * as anuncios from './anuncios.js';
import * as estudio from './estudio.js';
import * as dimitri from './dimitri.js';

export const nombre = 'telegram';
export const grupos = ['telegram'];

/** Por dónde entran los comandos del bot (cada ruta, por el módulo que la posee). */
export const MODULOS_BOT = [tareas, agentes, contenido, anuncios, estudio, dimitri];
const MAX_UPDATE = 256 * 1024, MAX_POR_MINUTO = 120;

export async function publica({ req, env, db, url, ruta, exec }) {
  if (ruta !== '/api/telegram/webhook') return null;
  if (req.method !== 'POST') return json({ error: 'POST' }, 405);
  // 1) el secreto, antes que nada (sin secreto configurado, la oficina no acepta a Telegram)
  if (!tokenValido(req.headers.get('x-telegram-bot-api-secret-token') || '', env.TELEGRAM_WEBHOOK_SECRET)) return json({ error: 'no autorizado' }, 401);
  if (!configured(env)) return json({ error: 'Telegram no está configurado en esta oficina (faltan TELEGRAM_BOT_TOKEN y TELEGRAM_OWNER_ID).' }, 503);
  // 2) tope por minuto
  if (!(await tasaPublica(db, 'telegram', MAX_POR_MINUTO)).ok) return json({ error: 'demasiadas peticiones' }, 429);
  // 3) el cuerpo
  const txt = await leerConTope(req, MAX_UPDATE);
  if (txt === null) return json({ error: 'demasiado grande' }, 413);
  let update; try { update = JSON.parse(txt); } catch { return json({ error: 'el cuerpo no es JSON' }, 400); }
  if (!update || typeof update !== 'object' || !Number.isInteger(update.update_id)) return json({ ok: true, ignorado: true }, 200);
  // 4–5) el update se atiende detrás (Telegram quiere un 200 rápido; una charla con Dimitri tarda), o aquí mismo si no hay ctx.waitUntil (pruebas)
  const trabajo = (async () => {
    const t = await armar({ env, db, modulos: MODULOS_BOT });
    return t ? atenderUpdate(t, update) : null;
  })().catch((e) => console.warn('[telegram]', String(e?.message || e).slice(0, 200)));
  if (exec?.waitUntil) { exec.waitUntil(trabajo); return json({ ok: true }, 200); }
  await trabajo;
  return json({ ok: true }, 200);
}

/** No hay rutas con sesión aquí: la configuración vive en Ajustes (/api/settings/telegram). */
export async function manejar() { return null; }

/** Cada minuto: lo que sale hacia el teléfono (con el no molestar). Sin Telegram configurado no hace nada. */
export async function cadaMinuto(env) {
  if (!configured(env)) return null;
  const t = await armar({ env, db: env.DB, modulos: MODULOS_BOT });
  if (!t) return null;
  await salientes(t);
  return true;
}
