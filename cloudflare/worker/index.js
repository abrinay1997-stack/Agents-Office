// Agents Office en Cloudflare — un solo Worker sirve la página (Static Assets) y la API, en el MISMO origen.
// Fase 1: acceso, conectores MCP con secretos en Cloudflare y ejecución de agentes. Fase 2: Contenido y publicación en Meta.
// OJO: este módulo SOLO exporta el handler por defecto (ver lib/rutas.js).
import { error } from './lib/respuesta.js';
import { manejar, correrReloj } from './lib/rutas.js';

export default {
  async fetch(req, env, ctx) {
    try { return await manejar(req, env, ctx); }
    catch (e) { return error('Error interno', 500, e); }
  },
  // Cada minuto: limpia sesiones caducadas y corre los relojes de cada módulo (lib/rutas.js → correrReloj).
  async scheduled(_evento, env) { await correrReloj(env); },
};
