// GET /api/imagen-meta?u=<https://…fbcdn.net|cdninstagram.com|fbsbx.com/…> — las fotos de perfil, miniaturas y adjuntos que Meta entrega con su propia dirección, servidos desde el mismo origen
// (la CSP no admite hosts de terceros). Cualquier rol con sesión (es solo lectura). La lógica y sus límites: lib/imagen-meta.js. nube.js reescribe las <img> de Meta a esta ruta.
import { error } from '../lib/respuesta.js';
import { obtener, cabecerasDe, PEDIDOS_POR_MINUTO } from '../lib/imagen-meta.js';
import { tasa, relojDe } from '../lib/equipo.js';

export const nombre = 'imagen-meta';
export const grupos = ['imagen-meta'];

export async function manejar(ctx) {
  const { req, env, db, ruta, url, usuario } = ctx;
  if (ruta !== '/api/imagen-meta') return null;
  if (req.method !== 'GET') return error('Método no permitido', 405);
  const r = await obtener({
    crudo: url.searchParams.get('u'), bucket: env.MEDIA, fetchFn: env.FETCH_IMAGEN_META || fetch, ifNoneMatch: req.headers.get('if-none-match'),
    cupo: async () => (await tasa(db, `imgmeta:${usuario.id}`, PEDIDOS_POR_MINUTO, relojDe(env))).ok,
  });
  if (r.error) return error(r.error, r.estado);
  if (r.estado === 304) return new Response(null, { status: 304, headers: { etag: `"${r.etag}"`, 'cache-control': 'private, max-age=86400' } });
  return new Response(r.bytes ?? r.cuerpo, { status: 200, headers: cabecerasDe(r.tipo, r.etag) });
}
