// La Biblioteca de habilidades en la nube (serve.mjs: /api/biblioteca). SOLO LEE: ver la lista y leer una habilidad o una de sus referencias. Las mismas rutas y la misma forma que la oficina local.
//   GET /api/biblioteca[?agente=<id>][&buscar=<palabras>]  → { habilidades: [...], total, problemas }
//   GET /api/biblioteca/<id>[?referencia=<nombre>]          → { ...resumen, referencia, texto }
// Cualquiera con sesión lee (un agente la lee con su rol de editor); nadie escribe por aquí: las del dueño llegan con la migración y las de fábrica con cada despliegue.
import { json, error } from '../lib/respuesta.js';
import { cargarBibliotecaNube, leerHabilidad, listarHabilidades } from '../lib/biblioteca.js';
import { cargarRoster } from '../lib/tareas/roster.js';

export const nombre = 'biblioteca';
export const grupos = ['biblioteca'];

export async function manejar(ctx) {
  const { req, env, db, ruta, url } = ctx;
  if (!ruta.startsWith('/api/biblioteca')) return null;
  if (req.method !== 'GET') return error('La Biblioteca solo se lee: las habilidades de fábrica llegan con cada despliegue y las tuyas con la migración.', 405);
  const roster = await cargarRoster(db), lib = await cargarBibliotecaNube({ env, db, agentes: roster.agents });
  if (ruta === '/api/biblioteca') {
    const a = roster.agents.find((x) => x.id === url.searchParams.get('agente')), q = String(url.searchParams.get('buscar') || '').slice(0, 200);
    const l = listarHabilidades(lib.b, a, q);
    return json({ habilidades: l.map(lib.b.resumen), total: lib.b.todas.length, problemas: lib.b.problemas });
  }
  const m = ruta.match(/^\/api\/biblioteca\/([a-z0-9-]+)$/); if (!m) return null;
  const r = await leerHabilidad(lib, m[1], url.searchParams.get('referencia'));
  return r.error ? json({ error: r.error }, 404) : json({ ...lib.b.resumen(r.habilidad), referencia: r.referencia || null, texto: r.texto });
}
