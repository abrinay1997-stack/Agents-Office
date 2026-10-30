// GET /api/icono-conector?host=<dominio> — el favicon de un conector añadido por el usuario, servido desde el mismo origen (la CSP no admite hosts de terceros).
// Cualquier rol con sesión (solo lectura). La lógica y sus límites: lib/icono-conector.js. Sin favicon, 404: la tarjeta se queda con su monograma.
import { error } from '../lib/respuesta.js';
import { obtener, hostsRegistrados, cabecerasDe, PEDIDOS_POR_MINUTO } from '../lib/icono-conector.js';
import { tasa, relojDe } from '../lib/equipo.js';

export const nombre = 'icono-conector';
export const grupos = ['icono-conector'];

export async function manejar(ctx) {
  const { req, env, db, ruta, url, usuario } = ctx;
  if (ruta !== '/api/icono-conector') return null;
  if (req.method !== 'GET') return error('Método no permitido', 405);
  const r = await obtener({
    crudo: url.searchParams.get('host'), registrados: await hostsRegistrados(env.DB), bucket: env.MEDIA, fetchFn: env.FETCH_ICONO_CONECTOR || fetch,
    ifNoneMatch: req.headers.get('if-none-match'), cupo: async () => (await tasa(db, `iconoc:${usuario.id}`, PEDIDOS_POR_MINUTO, relojDe(env))).ok,
  });
  if (r.error) return error(r.error, r.estado);
  if (r.estado === 304) return new Response(null, { status: 304, headers: { etag: `"${r.etag}"`, 'cache-control': 'private, max-age=86400' } });
  return new Response(r.bytes ?? r.cuerpo, { status: 200, headers: cabecerasDe(r.tipo, r.etag) });
}
