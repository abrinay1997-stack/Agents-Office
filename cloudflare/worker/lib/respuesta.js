// Respuestas del Worker. Las cabeceras de _headers NO se aplican a lo que genera el Worker: las de /api/* viven aquí.
import { limpiarSecretos } from './secretos.js';
export const CABECERAS_API = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store, max-age=0',
});
/** SEG-08 / WEB-06: cabeceras de transporte y permisos para TODA respuesta (lo que genera el Worker no pasa por _headers). `microphone=(self)`: el dictado y la grabación de voz del Estudio lo usan; cámara, geolocalización y pagos, cerrados. */
export const CABECERAS_GLOBALES = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
});
/** Devuelve la respuesta con las cabeceras globales que le falten. Una respuesta de socket (101) se deja intacta. */
export function conCabecerasGlobales(resp) {
  if (!resp || resp.status === 101 || resp.webSocket) return resp;
  const faltan = Object.entries(CABECERAS_GLOBALES).filter(([k]) => !resp.headers.has(k));
  if (!faltan.length) return resp;
  const h = new Headers(resp.headers); for (const [k, v] of faltan) h.set(k, v);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}
export const json = (datos, estado = 200, extra = {}) =>
  new Response(estado >= 400 ? limpiarSecretos(JSON.stringify(datos)) : JSON.stringify(datos), { status: estado, headers: { ...CABECERAS_API, ...extra } }); // un error nunca lleva un secreto, ni aunque lo repita el proveedor
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
