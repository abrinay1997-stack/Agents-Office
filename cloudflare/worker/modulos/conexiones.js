// «Actualizar conexiones» del Cerebro (27 oct 2026): un botón que se pulsa a mano (nada corre en vivo) y limpia el mapa de lo que dejó una nota borrada y conecta con IA las notas nuevas.
//   GET  /api/brain/actualizar                                     → qué hay que limpiar, qué notas se podrían conectar, con qué modelo y cuánto costaría (no llama a la IA ni escribe)
//   POST /api/brain/actualizar { paso: 'proponer', notas: [nombre] }  → los enlaces que la IA propone para esas notas (como mucho 3 por llamada; no escribe)
//   POST /api/brain/actualizar { paso: 'aplicar', conexiones: [{ nota, enlaces: [{ a, porque }] }], revisadas: [nombre] } → escribe lo aceptado («## Relacionadas» al final de la nota nueva), limpia el mapa y la memoria
//   POST /api/brain/actualizar { paso: 'deshacer', cambios: [...] } → quita lo que acaba de añadir «aplicar» (nota por nota, solo si nadie la editó después)
// SOLO un administrador (gasta en la IA y escribe en las notas). Las notas de fábrica y las clave nunca se escriben. Todo en lib/conexiones.js.
import { json, error, prohibido } from '../lib/respuesta.js';
import { estadoConexiones, proponerConexiones, aplicarConexiones, deshacerConexiones } from '../lib/conexiones.js';
import { leerGrafo } from '../lib/cerebro.js';
import { tasa, relojDe } from '../lib/equipo.js';

export const nombre = 'conexiones';
export const grupos = [];
export const rutasExtra = ['/api/brain/actualizar'];

const quien = (u) => String(u?.nombre || u?.email || 'alguien').slice(0, 80);

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (ruta !== '/api/brain/actualizar') return null;
  if (usuario.rol !== 'admin') return prohibido('Actualizar las conexiones del Cerebro es de un administrador.');
  if (req.method === 'GET') return json(await estadoConexiones({ env, db }));
  if (req.method !== 'POST') return json({ error: 'GET o POST' }, 405);
  const b = (await ctx.cuerpo(req)) || {};
  if (b.paso === 'proponer') {
    if (!(await tasa(db, 'cx:ia:' + usuario.id, 12, relojDe(env))).ok) return error('Vas muy rápido: espera un minuto y sigue.', 429);
    const r = await proponerConexiones({ env, db, nombres: b.notas, fetchFn: env.__pruebas?.fetch });
    return r.error ? error(r.error, r.estado || 400) : json(r);
  }
  if (b.paso === 'aplicar') { const r = await aplicarConexiones({ env, db, conexiones: b.conexiones, revisadas: b.revisadas, por: quien(usuario) }); return json({ ...r, graph: await leerGrafo(db) }); }
  if (b.paso === 'deshacer') { const r = await deshacerConexiones({ db, cambios: b.cambios, por: quien(usuario) }); return json({ ...r, graph: await leerGrafo(db) }); }
  return error('Dime el paso: proponer, aplicar o deshacer.', 400);
}
