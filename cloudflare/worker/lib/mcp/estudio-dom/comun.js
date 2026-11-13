// Ayudas comunes de los dominios del Estudio y de las Series por MCP (P5, carril del Estudio): la oficina en proceso con una lista blanca de rutas, los fallos esperados y la salida corta.
// Puro salvo `conOficina` (que importa perezosamente la oficina en proceso: el módulo de entrada importa al conector y un import estático haría un círculo).
import { limpiarSecretos } from '../../secretos.js';
import { restringir } from '../capa1/restringir.js';

export const clip = (t, n = 200) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
/** Un fallo esperado se vuelve texto claro («No se pudo: …»); lo inesperado, además, se registra. Nunca lleva un secreto. */
export function fallo(nombre, e) {
  console.error(`[mcp:estudio] ${nombre}:`, e?.message ?? e);
  return { texto: `No se pudo: ${limpiarSecretos(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 300)}`, esError: true };
}
/** Un rechazo de ENTRADA (argumento que falta o que no vale): sin registro de error, solo el texto. */
export const pide = (texto) => ({ texto, esError: true });
/** `permitidas`: lo que ESA llamada puede pedirle a la oficina (ver capa1/restringir.js: 'GET' o 'MÉTODO /ruta exacta'). */
export async function conOficina(ctx, permitidas) {
  const { crearOficinaMcp } = await import('../capa1/oficina.js');
  return restringir(await crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }), permitidas);
}
/** El id de un archivo de la galería («2031-01/nombre.png») → su ruta en la API, con cada tramo codificado y la barra literal (restringir veta `%2f`). null si no vale. */
export function rutaDeArchivo(id) {
  const s = String(id ?? '').trim();
  if (!s || s.length > 300 || s.startsWith('/') || /[\\\u0000-\u001f\u007f]|(^|\/)\.\.?(\/|$)|\/\//.test(s)) return null;
  return s.split('/').map(encodeURIComponent).join('/');
}
export const ID_CARPETA = /^c[a-z0-9]{4,20}$/;
export const ID_LOTE = /^L[a-z0-9]{4,30}$/;
export const ID_TRABAJO = /^[a-z0-9]{3,40}$/;
export const ID_PRESET = /^[a-z0-9-]{2,40}$/;
export const ID_SERIE = /^[\w-]{1,60}$/;
