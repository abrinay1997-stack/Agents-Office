// Respuestas del Worker. Las cabeceras de _headers NO se aplican a lo que genera el Worker: las de /api/* viven aquí.
export const CABECERAS_API = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store, max-age=0',
});
export const json = (datos, estado = 200, extra = {}) =>
  new Response(JSON.stringify(datos), { status: estado, headers: { ...CABECERAS_API, ...extra } });
/** El detalle técnico va al registro, no al cuerpo. */
export function error(mensaje, estado = 400, causa = null) {
  if (causa) console.error(`[${estado}] ${mensaje}:`, causa?.message ?? causa);
  return json({ error: mensaje }, estado);
}
export const noAutenticado = () => error('No autenticado', 401);
export const prohibido = (m = 'No tienes permiso para esto') => error(m, 403);
export const noEncontrado = (que = 'Recurso') => error(`${que} no encontrado`, 404);
export async function cuerpo(req) { try { return await req.json(); } catch { return null; } }
