// «Restablecer oficina» (Ajustes). SOLO un administrador, también para mirar (la lista de respaldos y lo que hay ahora es de quien manda en la oficina). Las mismas rutas que la oficina local (serve.mjs):
//   GET  /api/restablecer                       → { modos, ambitos (con lo que hay ahora), porDefecto, conserva, respaldos, semilla }
//   POST /api/restablecer {modo, ambitos}       → paso 1: { pendiente: { token, resumen, vence } } — no cambia nada
//   POST /api/restablecer/confirmar {token, escribio:'RESTABLECER'} → paso 2: respalda y restablece
//   POST /api/restablecer/deshacer {id}         → restaura un respaldo (guardando antes el estado de ahora)
// Qué se restablece y qué no, y por qué: restablecer-core.mjs y lib/restablecer.js.
import { json, prohibido } from '../lib/respuesta.js';
import { podarRespaldosDeNotas } from '../lib/arranque.js';
import { estado, pedirRestablecer, confirmarRestablecer, restaurarRespaldo, purgarVencidos } from '../lib/restablecer.js';

export const nombre = 'restablecer';
export const grupos = ['restablecer'];

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (ruta !== '/api/restablecer' && !ruta.startsWith('/api/restablecer/')) return null;
  if (usuario.rol !== 'admin') return prohibido('Solo un administrador puede restablecer la oficina.');
  if (ruta === '/api/restablecer' && req.method === 'GET') return json(await estado(env, db));
  if (req.method !== 'POST') return null;
  const b = (await ctx.cuerpo(req)) || {};
  let r;
  if (ruta === '/api/restablecer') r = await pedirRestablecer(env, db, b);
  else if (ruta === '/api/restablecer/confirmar') r = await confirmarRestablecer(env, db, { token: String(b.token || ''), escribio: String(b.escribio || '') }, { quien: usuario.email });
  else if (ruta === '/api/restablecer/deshacer') r = await restaurarRespaldo(env, db, { id: String(b.id || '') }, { quien: usuario.email });
  else return null;
  return r.error ? json({ error: r.error }, r.status || 400) : json(r);
}

/** Cada hora, en el minuto 7: los respaldos vencidos se borran (y con ellos los archivos del Estudio que nadie usa). */
export async function cadaMinuto(env) {
  if (new Date().getMinutes() !== 7) return;
  await purgarVencidos(env, env.DB);
  await podarRespaldosDeNotas(env.DB); // y las notas reemplazadas por «Preparar desde mi web» hace más de 30 días
}
