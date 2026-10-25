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
/** Tope del cuerpo JSON de cualquier ruta (los archivos grandes van por sus rutas de binario, con su propio tope). Sin tope, un cuerpo de 100 MB agotaba la memoria del Worker. */
export const TOPE_JSON = 12_000_000;
/** El cuerpo JSON, o null si no es JSON o pasa de `tope` bytes (se corta sin leer el resto). Las rutas SIN sesión (acceso, invitaciones) piden un tope corto. */
export async function cuerpo(req, tope = TOPE_JSON) {
  try {
    if (Number(req.headers.get('content-length') || 0) > tope) return null;
    if (!req.body) return JSON.parse(await req.text());
    const lector = req.body.getReader(), partes = []; let n = 0;
    for (;;) {
      const { done, value } = await lector.read(); if (done) break;
      n += value.length; if (n > tope) { try { await lector.cancel(); } catch { /* ya está */ } return null; }
      partes.push(value);
    }
    const todo = new Uint8Array(n); let o = 0; for (const p of partes) { todo.set(p, o); o += p.length; }
    return JSON.parse(new TextDecoder().decode(todo));
  } catch { return null; }
}
