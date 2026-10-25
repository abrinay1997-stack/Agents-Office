// El registro de módulos del Worker. Cada fase del puerto (tareas, contenido, anuncios, estudio…) es UN archivo en esta carpeta que exporta:
//   export const grupos = ['tasks', 'tareas'];            // los grupos /api/<grupo> que contesta (alimenta el inventario)
//   export async function manejar(ctx) { … }              // devuelve una Response, o null si la ruta no es suya
//   export async function cadaMinuto(env) { … }            // opcional: lo que en serve.mjs era un reloj (cron del Worker)
// y se añade con UNA línea a la lista de abajo (así las fases no se pisan entre sí). Ver cloudflare/PORTAR.md.
import * as tareas from './tareas.js';
export const MODULOS = [
  tareas,
];
