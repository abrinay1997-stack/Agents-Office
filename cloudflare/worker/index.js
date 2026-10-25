// Agents Office en Cloudflare — un solo Worker sirve la página (Static Assets) y la API, en el MISMO origen.
// Fase 1: acceso, conectores MCP con secretos en Cloudflare y ejecución de agentes. Fase 2: Contenido y publicación en Meta.
// OJO: este módulo exporta el handler por defecto y, como ÚNICA excepción, la clase del Durable Object (`Hub`, fase 10): workerd exige que
// la clase del DO salga del módulo `main`. Una constante exportada, en cambio, hace fallar el despliegue («Incorrect type for map entry»);
// tests/despliegue.test.mjs vigila las dos cosas.
import { error } from './lib/respuesta.js';
import { manejar, correrReloj } from './lib/rutas.js';
export { Hub } from './hub.js';

export default {
  async fetch(req, env, ctx) {
    try { return await manejar(req, env, ctx); }
    catch (e) { return error('Error interno', 500, e); }
  },
  // Cada minuto: limpia sesiones caducadas y corre los relojes de cada módulo (lib/rutas.js → correrReloj).
  async scheduled(_evento, env) { await correrReloj(env); },
};
