// La RADIOGRAFÍA del negocio por el conector MCP (P5, carril «empresa»): «¿cómo está todo?» en UNA llamada (caja y cifras · pauta · contenido de la semana · tareas y aprobaciones · gasto de IA · salud).
// Solo lee y compone con lib/radiografia.js: cada sección falla sola y dice «no pude leerla: motivo»; nada gasta ni cambia nada. Las demás herramientas de la empresa están en ajustes.js, costos.js,
// conectores.js y equipo.js (un archivo por sub-dominio).
import { registrarHerramienta } from '../registro.js';
import { radiografia, lectoresPorOficina, SECCIONES } from '../../radiografia.js';
import { conOficina, fallo } from '../empresa/comun.js';

/** Las rutas /api/ que esta herramienta lee (para el test de cobertura de la P7). */
export const RUTAS = Object.freeze([
  'GET /api/business', 'GET /api/cifras', 'GET /api/anuncios', 'GET /api/anuncios/sugerencias', 'GET /api/contenido', 'GET /api/tasks', 'GET /api/costs', 'GET /api/status',
]);

registrarHerramienta({ dominio: 'empresa',
  nombre: 'radiografia',
  titulo: 'Radiografía del negocio',
  descripcion: '¿Cómo está TODO? Una lectura: 1 caja e indicadores · 2 pauta · 3 contenido de la semana · 4 tareas y aprobaciones · 5 gasto de IA · 6 salud. ' +
    'Empieza por aquí. `seccion` trae solo una; lo que no se pueda leer lo dice y las demás siguen.',
  esquema: { type: 'object', additionalProperties: false, properties: { seccion: { type: 'string', enum: SECCIONES, description: 'Solo esa parte: caja, pauta, contenido, tareas, ia o salud.' } } },
  alcance: 'lectura', soloLectura: true,
  ejecutar: async (ctx, args) => {
    try {
      const office = await conOficina(ctx, ['GET /api/business', 'GET /api/cifras', 'GET /api/anuncios', 'GET /api/anuncios/sugerencias', 'GET /api/contenido', 'GET /api/tasks', 'GET /api/costs', 'GET /api/status']);
      const r = await radiografia({ leer: lectoresPorOficina({ office, ahora: ctx.ahoraMs }), ahora: ctx.ahoraMs });
      if (!args.seccion) return { texto: r.texto };
      const s = r.secciones.find((x) => x.id === args.seccion);
      return { texto: s ? `${s.titulo}\n${s.texto}` : 'Esa sección no existe.' };
    } catch (e) { return fallo('radiografia', e); }
  },
});
