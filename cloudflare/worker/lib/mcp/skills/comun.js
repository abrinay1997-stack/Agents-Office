// Ayudas comunes del dominio SKILLS (carril propio: no depende de las de otros carriles). El `office` de cada llamada es en proceso con la persona del token y una LISTA BLANCA de rutas (capa1/restringir.js).
import { limpiarSecretos } from '../../secretos.js';
import { conIdempotencia } from '../capa1/idempotencia.js';
import { restringir } from '../capa1/restringir.js';

export const PAGINA = 15_000; // por debajo del tope de salida del servidor (20.000)

/** Un fallo esperado vuelve como texto claro (isError); nunca lleva un secreto. */
export function fallo(nombre, e) {
  console.error(`[mcp:${nombre}]`, e?.message ?? e);
  return { texto: `No se pudo: ${limpiarSecretos(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 600)}`, esError: true };
}
export async function conOficina(ctx, permitidas) {
  const { crearOficinaMcp } = await import('../capa1/oficina.js');
  return restringir(await crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }), permitidas);
}
export const idem = (ctx, herramienta, fn) => conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta, clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn });

/** Parte un texto largo en páginas por líneas completas. cursor = el desplazamiento. → { texto, siguiente? } */
export function paginar(texto, cursor) {
  const t = String(texto ?? ''), ini = Math.max(0, Math.min(t.length, parseInt(cursor, 10) || 0));
  if (t.length - ini <= PAGINA) return { texto: t.slice(ini) };
  let fin = ini + PAGINA; const corte = t.lastIndexOf('\n', fin); if (corte > ini + PAGINA / 2) fin = corte + 1;
  return { texto: t.slice(ini, fin), siguiente: String(fin) };
}
