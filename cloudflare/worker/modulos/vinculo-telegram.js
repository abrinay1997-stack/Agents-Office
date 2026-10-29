// N2 (Fase 8): «Conectar mi Telegram». Cada cuenta ve y maneja SOLO su vínculo. Todo detrás de `notificaciones.config.activo` (apagado).
//   GET  /api/vinculo-telegram            → { activo, disponible, rol, estado: ninguna|codigo|pendiente|activa|admin, username?, vence?, silencioHasta? }
//   POST /api/vinculo-telegram/codigo     → { codigo, vence }   (se enseña UNA vez; un administrador: 403, usa Ajustes → Telegram)
//   POST /api/vinculo-telegram/confirmar  { aceptar: true|false } → confirma o rechaza el Telegram que canjeó el código en el bot
//   POST /api/vinculo-telegram/desvincular → { ok }
import { json, error, prohibido } from '../lib/respuesta.js';
import { leerConfig } from '../lib/notificaciones.js';
import { leerCfg } from '../lib/ajustes.js';
import { estadoVinculo, pedirCodigo, resolverPendiente, desvincular, hayVinculacion, telegramDeAdmin, enviarTelegram, escHtml } from '../lib/telegram-cuentas.js';

export const nombre = 'vinculo-telegram';
export const grupos = ['vinculo-telegram'];

export async function manejar(ctx) {
  const { req, db, env, ruta, usuario } = ctx;
  if (!ruta.startsWith('/api/vinculo-telegram')) return null;
  const resto = ruta.slice('/api/vinculo-telegram'.length);
  const activo = (await leerConfig(db)).activo === true, disponible = hayVinculacion(env);
  if (req.method === 'GET' && (resto === '' || resto === '/')) {
    if (!activo) return json({ activo: false, disponible, rol: usuario.rol, estado: 'ninguna' });
    if (usuario.rol === 'admin') return json({ activo: true, disponible, rol: 'admin', estado: telegramDeAdmin(await leerCfg(db), usuario.email) ? 'admin' : 'ninguna' });
    return json({ activo: true, disponible, rol: usuario.rol, ...(await estadoVinculo(db, usuario.id)) });
  }
  if (req.method !== 'POST') return null;
  if (!activo) return error('Las notificaciones todavía no están encendidas en esta oficina.', 409);
  if (resto === '/codigo') {
    const r = await pedirCodigo(db, env, usuario);
    return r.error ? error(r.error, r.estado) : json({ codigo: r.codigo, vence: r.vence });
  }
  if (resto === '/confirmar') {
    if (usuario.rol === 'admin') return prohibido('Un administrador usa Ajustes → Telegram.');
    const b = (await ctx.cuerpo(req)) || {};
    const r = await resolverPendiente(db, usuario.id, b.aceptar === true);
    if (r.error) return error(r.error, r.estado);
    if (r.telegramId) await enviarTelegram(env, r.telegramId, `Listo, <b>${escHtml(usuario.nombre || 'tu cuenta')}</b>: este Telegram ya recibe tus avisos. Escribe /ayuda para ver lo que puedes hacer desde aquí.`);
    return json({ ok: true, rechazada: r.rechazada === true });
  }
  if (resto === '/desvincular') { await desvincular(db, usuario.id); return json({ ok: true }); }
  return null;
}
