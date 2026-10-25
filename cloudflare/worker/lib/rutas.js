// Rutas de la API. Viven aparte de index.js porque un Worker solo puede exportar handlers desde su módulo de entrada
// (workerd rechaza una constante exportada: «Incorrect type for map entry»).
import { json, error, noAutenticado, prohibido, noEncontrado, cuerpo } from './respuesta.js';
import { usuarioDeLaPeticion, iniciarSesion, cerrarSesion, cookieSesion, cookieBorrada } from './sesion.js';
import { validarConector, publico } from './conectores.js';
import { agentes, ejecutar } from './agentes.js';
import { uuid, ahora } from './ids.js';

export const VERSION = '0.1.0';

/** Una escritura solo vale si viene de esta misma página (defensa extra sobre SameSite=Lax). */
function origenValido(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const o = req.headers.get('Origin');
  return !o || o === new URL(req.url).origin;
}

export async function manejar(req, env) {
  const url = new URL(req.url);
  const ruta = url.pathname;
  const db = env.DB;
  if (!ruta.startsWith('/api/')) return env.ASSETS.fetch(req);
  if (!origenValido(req)) return error('Origen no permitido', 403);

  if (ruta === '/api/health' && req.method === 'GET')
    return json({ ok: true, version: VERSION, ia: !!env.ANTHROPIC_API_KEY || !!(env.META_API_KEY || env.MODEL_API_KEY) });

  if (ruta === '/api/acceso' && req.method === 'POST') {
    const b = await cuerpo(req);
    const s = await iniciarSesion(db, b?.email, b?.contrasena, req.headers.get('User-Agent') ?? '');
    if (!s) return error('Usuario o contraseña incorrectos.', 401);
    return json({ usuario: s.usuario }, 200, { 'Set-Cookie': cookieSesion(s.testigo) });
  }

  const usuario = await usuarioDeLaPeticion(db, req);
  if (!usuario) return noAutenticado();

  if (ruta === '/api/salir' && req.method === 'POST') { await cerrarSesion(db, req); return json({ ok: true }, 200, { 'Set-Cookie': cookieBorrada() }); }
  if (ruta === '/api/yo' && req.method === 'GET') return json({ usuario });
  if (ruta === '/api/agentes' && req.method === 'GET') return json({ agentes: agentes() });

  let m;
  if ((m = ruta.match(/^\/api\/agentes\/([a-z0-9-]{2,30})\/ejecutar$/)) && req.method === 'POST') {
    if (usuario.rol === 'lectura') return prohibido();
    const b = await cuerpo(req);
    const r = await ejecutar({ env, db, usuario, agenteId: m[1], texto: b?.texto, aprobada: b?.aprobada === true });
    return r.error ? error(r.error, r.estado) : json(r.ejecucion);
  }

  if (ruta === '/api/ejecuciones' && req.method === 'GET') {
    const { results } = await db.prepare('select id, agente, modo, estado, texto, resultado, error, modelo, created_at from ejecuciones order by created_at desc limit 50').all();
    return json({ ejecuciones: results });
  }

  if (ruta === '/api/conectores' && req.method === 'GET') {
    const { results } = await db.prepare('select * from conectores order by nombre').all();
    return json({ conectores: results.map((c) => publico(c, env)) });
  }
  if (ruta === '/api/conectores' && req.method === 'POST') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia los conectores.');
    const v = validarConector(await cuerpo(req));
    if (!v.ok) return json({ error: v.errores.join(' '), errores: v.errores }, 422);
    const c = v.valor;
    await db.prepare(
      `insert into conectores (id, nombre, url, secreto, departamentos, herramientas_lectura, herramientas_envio, activo, created_at)
       values (?,?,?,?,?,?,?,1,?)
       on conflict (nombre) do update set url=excluded.url, secreto=excluded.secreto, departamentos=excluded.departamentos,
         herramientas_lectura=excluded.herramientas_lectura, herramientas_envio=excluded.herramientas_envio`)
      .bind(uuid(), c.nombre, c.url, c.secreto, JSON.stringify(c.departamentos), JSON.stringify(c.herramientas_lectura), JSON.stringify(c.herramientas_envio), ahora()).run();
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'conector', usuario.email, JSON.stringify({ nombre: c.nombre })).run();
    const fila = await db.prepare('select * from conectores where nombre = ?').bind(c.nombre).first();
    return json({ conector: publico(fila, env) }, 201);
  }
  if ((m = ruta.match(/^\/api\/conectores\/([a-z][a-z0-9-]{1,39})$/)) && req.method === 'DELETE') {
    if (usuario.rol !== 'admin') return prohibido();
    await db.prepare('delete from conectores where nombre = ?').bind(m[1]).run();
    return json({ ok: true });
  }
  return noEncontrado('Ruta');
}

