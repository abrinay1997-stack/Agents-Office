// Ajustes → «Funciones nuevas» (solo la nube, SOLO administradores): GET /api/funciones (los interruptores con su estado real) y POST /api/funciones { id, activo } (cambia UNO).
// El rol se comprueba ANTES de mirar nada (un agente, un editor o una cuenta de lectura reciben 403 sin que se lea ni el cuerpo). Lista cerrada, booleano estricto, auditoría de cada cambio.
import { json, error, prohibido } from '../lib/respuesta.js';
import { listar, cambiar } from '../lib/funciones.js';

export const nombre = 'funciones';
export const grupos = ['funciones'];

export async function manejar(ctx) {
  const { req, db, ruta, usuario } = ctx;
  if (ruta !== '/api/funciones') return null;
  if (usuario.rol !== 'admin' || usuario.agente) return prohibido('Solo un administrador cambia las funciones nuevas.');
  if (req.method === 'GET') return json(await listar(db));
  if (req.method === 'POST') {
    const c = (await ctx.cuerpo(req)) || {};
    const r = await cambiar(db, { id: c.id, activo: c.activo }, usuario);
    if (r.error) return error(r.error, r.status || 422);
    return json({ ...r, ...(await listar(db)) });
  }
  return error('GET o POST', 405);
}
