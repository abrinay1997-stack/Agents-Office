// N2 (Fase 8, D01–D05): Telegram por CUENTA. Dos niveles de identidad que NO se mezclan:
//   (a) `who` (el dueño por TELEGRAM_OWNER_ID y los administradores de `telegram.admins`) y los aprobadores delegados: NO cambian (lib/telegram.js);
//   (b) una cuenta vinculada aquí (cuenta_telegram) NUNCA entra en `who`: tiene su propio manejador con comandos por rol y sin ningún poder de aprobar, enviar ni gastar.
// Vincular: la app pide un código (HMAC en D1, 10 min, un solo uso) → la persona escribe `/vincular CÓDIGO` al bot → el bot responde SIEMPRE lo mismo (código bueno, malo, vencido o ajeno) →
// la app muestra «El Telegram @x quiere vincularse» → la persona confirma. Un administrador no se vincula por aquí (usa `telegram.admins`).
// Todo es opt-in y vive detrás de `notificaciones.config.activo` (apagado). Los avisos por Telegram no llevan texto privado de terceros: «Ana te dejó una nota», nunca la nota.
import { leerConfig as leerConfigNotif } from './notificaciones.js';
import { claveNombre } from './equipo.js';
import { nombrePorCorreo } from './sesion.js';
import { componentes, zonaActual } from './zona.js';
import { estadoDelHub } from './vivo.js';

export const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 sin 0 O 1 I L: 10 caracteres ≈ 49 bits
export const LARGO_CODIGO = 10, VIDA_CODIGO_MS = 10 * 60_000, VIDA_PENDIENTE_MS = 10 * 60_000;
export const MAX_FALLOS_POR_ID = 5, MAX_FALLOS_GLOBAL = 30; // por minuto (publica_tasa)
export const RESPUESTA_UNIFORME = 'Si el código es válido, confirma la vinculación en la app de la oficina (Notas y avisos → Tu Telegram). Si no ves nada allí en un minuto, pide un código nuevo.';
const API = 'https://api.telegram.org';

const secreto = (env) => String(env.TELEGRAM_VINCULO_SECRET || env.TELEGRAM_WEBHOOK_SECRET || '');
export const hayVinculacion = (env) => !!secreto(env) && !!String(env.TELEGRAM_BOT_TOKEN || '').trim();

export async function hmacCodigo(env, codigo) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('vinculo-telegram:' + secreto(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(codigo)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function generarCodigo() {
  const bytes = crypto.getRandomValues(new Uint8Array(LARGO_CODIGO));
  return [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join(''); // 256 % 31 ≠ 0: sesgo ínfimo, irrelevante frente a 49 bits + topes de intentos
}
export const limpiarCodigo = (t) => { const c = String(t ?? '').trim().toUpperCase().replace(/[\s-]/g, ''); return new RegExp(`^[${ALFABETO}]{${LARGO_CODIGO}}$`).test(c) ? c : null; };

const nombreDe = (f) => (f.nombre || '').trim() || nombrePorCorreo(f.email);

/** Estado del vínculo de UNA cuenta, para la app. Nunca devuelve el código ni su huella. */
export async function estadoVinculo(db, userId, ahora = Date.now()) {
  const f = await db.prepare('select telegram_id, telegram_username, vinculada_at, codigo_vence_at, codigo_hmac, pend_telegram_id, pend_username, pend_vence_at, silencio_hasta from cuenta_telegram where user_id = ?').bind(userId).first();
  if (!f) return { estado: 'ninguna' };
  if (f.telegram_id) return { estado: 'activa', username: f.telegram_username || null, desde: f.vinculada_at, silencioHasta: f.silencio_hasta > ahora ? f.silencio_hasta : null };
  if (f.pend_telegram_id && f.pend_vence_at > ahora) return { estado: 'pendiente', username: f.pend_username || null, vence: f.pend_vence_at };
  if (f.codigo_hmac && f.codigo_vence_at > ahora) return { estado: 'codigo', vence: f.codigo_vence_at };
  return { estado: 'ninguna' };
}

/** La app pide un código. → { codigo, vence } (se enseña UNA vez) o { error, estado }. Un administrador se vincula con `telegram.admins`, no por aquí. */
export async function pedirCodigo(db, env, usuario, ahora = Date.now()) {
  if (usuario.rol === 'admin') return { error: 'Un administrador usa Ajustes → Telegram (su id va en la lista de administradores).', estado: 403 };
  if (!hayVinculacion(env)) return { error: 'El bot de Telegram todavía no está configurado en esta oficina.', estado: 409 };
  const cur = await estadoVinculo(db, usuario.id, ahora);
  if (cur.estado === 'activa') return { error: 'Tu Telegram ya está conectado. Desvincúlalo primero si quieres cambiarlo.', estado: 409 };
  const codigo = generarCodigo(), h = await hmacCodigo(env, codigo), vence = ahora + VIDA_CODIGO_MS;
  await db.prepare('insert into cuenta_telegram (user_id, codigo_hmac, codigo_vence_at, pend_telegram_id, pend_username, pend_vence_at) values (?,?,?,null,null,null) on conflict (user_id) do update set codigo_hmac = excluded.codigo_hmac, codigo_vence_at = excluded.codigo_vence_at, pend_telegram_id = null, pend_username = null, pend_vence_at = null').bind(usuario.id, h, vence).run();
  return { codigo, vence };
}

/** El bot recibe `/vincular CÓDIGO`. Devuelve true si dejó una vinculación PENDIENTE; el bot contesta lo mismo en todos los casos. Un id de Telegram ya ligado a otra cuenta falla en silencio. */
export async function canjearCodigo(db, env, { telegramId, username, codigo }, ahora = Date.now()) {
  const c = limpiarCodigo(codigo), id = String(telegramId || '');
  if (!c || !/^\d{4,15}$/.test(id) || !hayVinculacion(env)) return false;
  const h = await hmacCodigo(env, c);
  const f = await db.prepare('select c.user_id, u.rol from cuenta_telegram c join users u on u.id = c.user_id left join perfiles p on p.user_id = u.id where c.codigo_hmac = ? and c.codigo_vence_at > ? and c.telegram_id is null and p.baja_at is null').bind(h, ahora).first();
  if (!f || f.rol === 'admin') return false;
  const ocupado = await db.prepare('select 1 x from cuenta_telegram where (telegram_id = ? or (pend_telegram_id = ? and pend_vence_at > ? and user_id != ?))').bind(id, id, ahora, f.user_id).first();
  if (ocupado) return false;
  await db.prepare('update cuenta_telegram set pend_telegram_id = ?, pend_username = ?, pend_vence_at = ?, codigo_hmac = null, codigo_vence_at = null where user_id = ?').bind(id, String(username || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) || null, ahora + VIDA_PENDIENTE_MS, f.user_id).run();
  return true;
}

/** La app confirma o rechaza lo que canjeó el bot. → { ok, telegramId } | { error, estado } */
export async function resolverPendiente(db, userId, aceptar, ahora = Date.now()) {
  const f = await db.prepare('select pend_telegram_id, pend_username, pend_vence_at from cuenta_telegram where user_id = ?').bind(userId).first();
  if (!f?.pend_telegram_id || f.pend_vence_at <= ahora) return { error: 'No hay ninguna vinculación esperando. Pide un código nuevo.', estado: 404 };
  if (!aceptar) { await db.prepare('update cuenta_telegram set pend_telegram_id = null, pend_username = null, pend_vence_at = null where user_id = ?').bind(userId).run(); return { ok: true, rechazada: true }; }
  try {
    await db.prepare('update cuenta_telegram set telegram_id = pend_telegram_id, telegram_username = pend_username, vinculada_at = ?, pend_telegram_id = null, pend_username = null, pend_vence_at = null where user_id = ?').bind(ahora, userId).run();
  } catch { return { error: 'Ese Telegram ya está conectado a otra cuenta.', estado: 409 }; }
  return { ok: true, telegramId: f.pend_telegram_id };
}

/** Desvincula (la app, `/desvincular`, o al quitar a la persona). Conserva la fila vacía: una por cuenta. */
export async function desvincular(db, userId) {
  await db.prepare('update cuenta_telegram set telegram_id = null, telegram_username = null, vinculada_at = null, codigo_hmac = null, codigo_vence_at = null, pend_telegram_id = null, pend_username = null, pend_vence_at = null, silencio_hasta = null, silencio_desde_h = null, silencio_hasta_h = null where user_id = ?').bind(userId).run();
}

/** Quién es ESTE id de Telegram entre las cuentas vinculadas (y activas en la oficina). → { id, rol, nombre, email } | null */
export async function cuentaPorTelegram(db, telegramId) {
  const id = String(telegramId || ''); if (!/^\d{4,15}$/.test(id)) return null;
  const f = await db.prepare('select u.id, u.email, u.rol, p.nombre from cuenta_telegram c join users u on u.id = c.user_id left join perfiles p on p.user_id = u.id where c.telegram_id = ? and p.baja_at is null').bind(id).first();
  return f ? { id: f.id, rol: f.rol, nombre: nombreDe(f), email: f.email, telegramId: id } : null;
}

/** Ajustes → Telegram: `telegram.admins` { idTelegram: correo } → el id de Telegram de ESTE administrador (o null). */
export function telegramDeAdmin(cfg, email) {
  const reg = cfg?.telegram?.admins && typeof cfg.telegram.admins === 'object' ? Object.entries(cfg.telegram.admins) : [];
  const e = String(email || '').toLowerCase();
  const f = reg.find(([id, c]) => /^\d{4,15}$/.test(id) && typeof c === 'string' && c.toLowerCase() === e);
  return f ? f[0] : null;
}

/** El chat de Telegram de una cuenta: vinculada (activa) o, si es administrador, la de `telegram.admins`. → { chat, silencio } | null */
export async function chatDe(db, cfg, userId) {
  const f = await db.prepare('select u.email, u.rol, c.telegram_id, c.silencio_hasta, c.silencio_desde_h, c.silencio_hasta_h from users u left join cuenta_telegram c on c.user_id = u.id left join perfiles p on p.user_id = u.id where u.id = ? and p.baja_at is null').bind(userId).first();
  if (!f) return null;
  if (f.telegram_id) return { chat: f.telegram_id, silencio: { hasta: f.silencio_hasta, desde_h: f.silencio_desde_h, hasta_h: f.silencio_hasta_h } };
  if (f.rol === 'admin') { const id = telegramDeAdmin(cfg, f.email); if (id) return { chat: id, silencio: null }; }
  return null;
}

/** «No molestar» de la persona: un `/silencio N` en curso o su ventana diaria (horas de la oficina). */
export function enSilencio(silencio, ahora = Date.now(), zona = zonaActual()) {
  if (!silencio) return false;
  if (silencio.hasta && silencio.hasta > ahora) return true;
  const { desde_h: d, hasta_h: h } = silencio;
  if (d == null || h == null || d === h) return false;
  const hora = componentes(zona, ahora).h;
  return d < h ? hora >= d && hora < h : hora >= d || hora < h;
}

/** La API de Telegram. El token solo va en la URL; un error nunca lo repite. → true si salió. */
export async function enviarTelegram(env, chat, texto, extra = {}) {
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim(); if (!token || !chat) return false;
  const f = env.__pruebas?.fetch || ((...a) => fetch(...a));
  try {
    const r = await f(`${API}/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: String(chat), text: String(texto).slice(0, 3900), parse_mode: 'HTML', disable_web_page_preview: true, ...extra }) });
    return (await r.json().catch(() => ({}))).ok === true;
  } catch { return false; }
}
export const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Un aviso PERSONAL por Telegram. Solo con el flag de notificaciones encendido, respetando el «no molestar» de la persona, y nunca a quien lo causó (lo decide quien llama).
 * `soloSiFuera`: si la persona tiene un socket vivo (está dentro de la oficina) no se manda: le basta el aviso de dentro. → 'enviado' | 'omitido:<motivo>'
 */
export async function avisarPorTelegram(env, db, cfg, userId, texto, { botones = null, conectados = null, ahora = Date.now() } = {}) {
  try {
    if (!(await leerConfigNotif(db)).activo) return 'omitido:apagado';
    if (conectados && conectados.has(userId)) return 'omitido:conectado';
    const c = await chatDe(db, cfg, userId); if (!c) return 'omitido:sin-telegram';
    if (enSilencio(c.silencio, ahora)) return 'omitido:silencio';
    return (await enviarTelegram(env, c.chat, texto, botones ? { reply_markup: botones } : {})) ? 'enviado' : 'omitido:falló';
  } catch { return 'omitido:error'; }
}

export { claveNombre };

/** Cualquier método de la API de Telegram (answerCallbackQuery, editMessageText…). → el resultado o null. */
export async function llamarTelegram(env, metodo, cuerpo) {
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim(); if (!token) return null;
  const f = env.__pruebas?.fetch || ((...a) => fetch(...a));
  try { const r = await f(`${API}/bot${token}/${metodo}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo || {}) }); const j = await r.json().catch(() => ({})); return j.ok ? (j.result ?? true) : null; } catch { return null; }
}

/** La cuenta cuyo nombre (sin tildes ni mayúsculas) es `nombre`; null si no hay una sola. */
export async function usuarioPorNombre(db, nombre) {
  const k = claveNombre(nombre); if (!k) return null;
  const { results } = await db.prepare('select u.id, u.email, u.rol, p.nombre from users u left join perfiles p on p.user_id = u.id where p.baja_at is null').all();
  const m = results.filter((r) => claveNombre(nombreDe(r)) === k);
  return m.length === 1 ? { id: m[0].id, rol: m[0].rol, nombre: nombreDe(m[0]), email: m[0].email } : null;
}

/** Los ids de cuenta que tienen un socket vivo ahora (para no duplicar un aviso a quien ya está dentro). Sin Hub, nadie. */
export async function conectadosAhora(env) {
  try { const h = await estadoDelHub(env); return new Set((h?.presentes || []).map((p) => p.userId)); } catch { return new Set(); }
}
