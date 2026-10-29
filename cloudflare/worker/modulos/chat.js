// C0 (Fase 8): el chat interno del equipo — modelo y rutas, SIN pantalla ni sockets (C1 y C2). Todo detrás de `chat.config.activo` (apagado). Plan: docs/plan-chat-interno.md.
//   GET  /api/chat/resumen                       → { activo, canales: [{ id, tipo, nombre, privado, miembros, noLeidos, menciones, silenciado, ultimo }], total }
//   GET  /api/chat/canales                       → { publicos: [{ id, nombre, miembros, yoSoy }] }
//   POST /api/chat/canales { nombre, privado?, miembros? } · POST /api/chat/directo { con }
//   GET  /api/chat/canales/<id>/mensajes?antes=&limite=      POST …/mensajes { cuerpo, respondeA? }
//   POST /api/chat/canales/<id>/leido { hasta } · …/silenciar { silenciado } · …/miembros { userId? } (unirse o añadir) · DELETE …/miembros { userId? } (salir o sacar)
//   PATCH|DELETE /api/chat/mensajes/<id> · GET /api/chat/novedades?desde=<id> · GET /api/chat/admin (metadatos) · GET|POST /api/chat/config (admin)
// Quien solo lee (rol `lectura`) lee los canales en que está y NO escribe. Un id ajeno da 404; los administradores no leen lo privado.
import { json, error, prohibido, noEncontrado } from '../lib/respuesta.js';
import * as C from '../lib/chat/chat.js';

export const nombre = 'chat';
export const grupos = ['chat'];
const resp = (r, ok = 200) => (r.error ? error(r.error, r.estado || 400) : json(r, ok));

export async function manejar(ctx) {
  const { req, db, ruta, usuario, url } = ctx;
  if (!ruta.startsWith('/api/chat')) return null;
  const resto = ruta.slice('/api/chat'.length), metodo = req.method, escribe = usuario.rol !== 'lectura';
  if (resto === '/config') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia el chat.');
    if (metodo === 'GET') return json(await C.leerConfig(db));
    if (metodo === 'POST') { const r = await C.guardarConfig(db, (await ctx.cuerpo(req)) || {}); await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'chat', usuario.email, JSON.stringify(r)).run(); return json(r); }
    return error('GET o POST', 405);
  }
  if (metodo !== 'GET' && !escribe && !/^\/canales\/[a-z0-9]{3,12}\/(leido|silenciar)$/.test(resto)) return prohibido('Con acceso de lectura no se escribe ni se cambia nada en el chat.'); // marcar leído y silenciar son personales
  if (!(await C.leerConfig(db)).activo) {
    if (metodo === 'GET' && resto === '/resumen') return json({ activo: false, canales: [], total: 0 });
    return metodo === 'GET' ? json({ activo: false }) : error('El chat todavía no está encendido en esta oficina.', 409);
  }
  if (metodo === 'GET' && resto === '/resumen') return json({ activo: true, ...(await C.resumen(db, usuario)) });
  if (metodo === 'GET' && resto === '/canales') return json({ publicos: await C.publicos(db, usuario) });
  if (metodo === 'GET' && resto === '/novedades') { await C.asegurarGeneral(db, usuario.id); return json(await C.novedades(db, usuario, url.searchParams.get('desde'))); }
  if (metodo === 'GET' && resto === '/admin') return usuario.rol === 'admin' ? json({ canales: await C.adminCanales(db) }) : prohibido('Solo un administrador ve el estado del chat.');
  if (metodo === 'POST' && resto === '/canales') { if (!escribe) return prohibido('Con acceso de lectura no se crean canales.'); const b = (await ctx.cuerpo(req)) || {}; return resp(await C.crearCanal(db, usuario, b), 201); }
  if (metodo === 'POST' && resto === '/directo') { if (!escribe) return prohibido('Con acceso de lectura no se abren chats directos.'); const b = (await ctx.cuerpo(req)) || {}; return resp(await C.abrirDirecto(db, usuario, b.con)); }
  let m = /^\/canales\/([a-z0-9]{3,12})\/(mensajes|leido|silenciar|miembros)$/.exec(resto);
  if (m) {
    const [, id, que] = m;
    if (que === 'mensajes' && metodo === 'GET') return resp(await C.mensajes(db, usuario, id, { antes: url.searchParams.get('antes'), limite: url.searchParams.get('limite') }));
    if (que === 'mensajes' && metodo === 'POST') { if (!escribe) return prohibido('Con acceso de lectura no se escribe en el chat.'); const b = (await ctx.cuerpo(req)) || {}; return resp(await C.escribir(db, usuario, id, b), 201); }
    if (que === 'leido' && metodo === 'POST') return resp(await C.marcarLeido(db, usuario, id, ((await ctx.cuerpo(req)) || {}).hasta));
    if (que === 'silenciar' && metodo === 'POST') return resp(await C.silenciar(db, usuario, id, ((await ctx.cuerpo(req)) || {}).silenciado === true));
    if (que === 'miembros' && metodo === 'POST') { if (!escribe) return prohibido('Con acceso de lectura no se cambian los canales.'); return resp(await C.anadirMiembro(db, usuario, id, (await ctx.cuerpo(req)) || {})); }
    if (que === 'miembros' && metodo === 'DELETE') return resp(await C.quitarMiembro(db, usuario, id, (await ctx.cuerpo(req).catch(() => null)) || {}));
  }
  m = /^\/mensajes\/(\d{1,12})$/.exec(resto);
  if (m) {
    if (!escribe) return metodo === 'PATCH' || metodo === 'DELETE' ? prohibido('Con acceso de lectura no se cambian los mensajes.') : null;
    if (metodo === 'PATCH') return resp(await C.editar(db, usuario, m[1], ((await ctx.cuerpo(req)) || {}).cuerpo));
    if (metodo === 'DELETE') return resp(await C.borrar(db, usuario, m[1]));
  }
  void noEncontrado;
  return null;
}
