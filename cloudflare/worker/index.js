// Agents Office en Cloudflare — un solo Worker sirve la página (Static Assets) y la API, en el MISMO origen.
// Fase 1: acceso, conectores MCP con secretos en Cloudflare y ejecución de agentes. Fase 2: Contenido y publicación en Meta.
// OJO: este módulo SOLO exporta el handler por defecto (ver lib/rutas.js).
import { error } from './lib/respuesta.js';
import { manejar } from './lib/rutas.js';
import { ahora } from './lib/ids.js';
import { MODULOS } from './modulos/index.js';

export default {
  async fetch(req, env, ctx) {
    try { return await manejar(req, env, ctx); }
    catch (e) { return error('Error interno', 500, e); }
  },
  // Cada minuto. Fase 1: solo limpia sesiones caducadas. Fase 2: la cola de publicación de Contenido.
  async scheduled(_evento, env) {
    await env.DB.prepare('delete from sessions where expires_at < ?').bind(ahora()).run();
    // Los relojes de cada módulo (lo que en serve.mjs eran setInterval). Uno que falle no tumba a los demás.
    for (const mod of MODULOS) if (mod.cadaMinuto) { try { await mod.cadaMinuto(env); } catch (e) { console.error(`[cron] ${mod.nombre || 'módulo'}:`, e?.message ?? e); } }
  },
};
