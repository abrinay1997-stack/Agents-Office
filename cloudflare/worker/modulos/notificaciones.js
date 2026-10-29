// N0 (Fase 8): notificaciones por persona. Cada cuenta lee y marca SOLO las suyas; el flag y el supuesto SEG-04 los cambia un administrador.
//   GET  /api/notificaciones[?limite=&solo=noleidas] → { activo, noLeidas, items: [{ id, categoria, nivel, titulo, enlace, t, leida }] }  (con el flag apagado: vacío)
//   POST /api/notificaciones/leer { id } | { ids: [..] } | { todas: true } → { marcadas } (un id que no es tuyo: 404)
//   GET|POST /api/notificaciones/config → { activo, lecturaVeResultados } (solo un administrador)
// Sin interfaz aquí: la campanita y el push van en un paquete aparte (src/notificaciones/*), nunca en la página.
import { json, error, prohibido, noEncontrado } from '../lib/respuesta.js';
import { leerConfig, guardarConfig, listar, marcarLeidas } from '../lib/notificaciones.js';

export const nombre = 'notificaciones';
export const grupos = ['notificaciones'];

export async function manejar(ctx) {
  const { req, db, ruta, usuario, url } = ctx;
  if (ruta === '/api/notificaciones/config') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia las notificaciones.');
    if (req.method === 'GET') return json(await leerConfig(db));
    if (req.method === 'POST') {
      const b = (await ctx.cuerpo(req)) || {};
      const r = await guardarConfig(db, b);
      await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'notificaciones', usuario.email, JSON.stringify(r)).run();
      return json(r);
    }
    return error('GET o POST', 405);
  }
  if (ruta === '/api/notificaciones' && req.method === 'GET') {
    const cfg = await leerConfig(db);
    if (!cfg.activo) return json({ activo: false, noLeidas: 0, items: [] });
    return json({ activo: true, ...(await listar(db, usuario.id, { limite: url.searchParams.get('limite'), soloNoLeidas: url.searchParams.get('solo') === 'noleidas' })) });
  }
  if (ruta === '/api/notificaciones/leer' && req.method === 'POST') {
    const b = (await ctx.cuerpo(req)) || {};
    const r = await marcarLeidas(db, usuario.id, { id: b.id, ids: b.ids, todas: b.todas === true });
    return r ? json(r) : noEncontrado('Notificación');
  }
  return null;
}
