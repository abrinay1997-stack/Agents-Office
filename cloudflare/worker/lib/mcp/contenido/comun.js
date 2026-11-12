// Ayudas de los dominios CONTENIDO y BANDEJA del conector MCP (P5, carril 3). Nada de aquí toca el servidor del conector: solo arma el `office` en proceso con la persona del token (patrón de capa1),
// pagina el texto con un cursor y dice los fallos esperados en palabras.
import { limpiarSecretos } from '../../secretos.js';
import { conIdempotencia } from '../capa1/idempotencia.js';
import { restringir } from '../capa1/restringir.js';

export const ID_PIEZA = /^[a-z0-9-]{1,60}$/;
export const ID_MENSAJE = /^[A-Za-z0-9:_.-]{1,120}$/;
export const PAGINA = 15_000; // por debajo del tope de salida del servidor (20.000): deja sitio al aviso y al cursor

/** Un fallo esperado vuelve como texto claro (isError); lo inesperado, además, se registra. Nunca lleva un secreto. */
export function fallo(nombre, e) {
  console.error(`[mcp:${nombre}]`, e?.message ?? e);
  return { texto: `No se pudo: ${limpiarSecretos(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 300)}`, esError: true };
}
/** `permitidas`: lo que ESA llamada puede pedirle a la oficina (ver capa1/restringir.js: 'GET' o 'MÉTODO /ruta exacta'). */
export async function conOficina(ctx, permitidas) {
  const { crearOficinaMcp } = await import('../capa1/oficina.js');
  return restringir(await crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }), permitidas);
}
export const idem = (ctx, herramienta, fn) => conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta, clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn });

/** Parte un texto largo en páginas por líneas completas. cursor = el desplazamiento (un número en texto). → { texto, siguiente? } */
export function paginar(texto, cursor) {
  const t = String(texto ?? ''), ini = Math.max(0, Math.min(t.length, parseInt(cursor, 10) || 0));
  if (t.length - ini <= PAGINA) return { texto: t.slice(ini) };
  let fin = ini + PAGINA; const corte = t.lastIndexOf('\n', fin); if (corte > ini + PAGINA / 2) fin = corte + 1;
  return { texto: t.slice(ini, fin), siguiente: String(fin) };
}
/** Solo los campos con valor y dentro de la lista (lo demás no llega a la oficina). */
export function tomar(args, campos) { const o = {}; for (const c of campos) if (args[c] !== undefined && args[c] !== null && args[c] !== '') o[c] = args[c]; return o; }
