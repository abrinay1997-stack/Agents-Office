// Rutas de la API. Viven aparte de index.js porque un Worker solo puede exportar handlers desde su módulo de entrada
// (workerd rechaza una constante exportada: «Incorrect type for map entry»).
import { json, error, noAutenticado, prohibido, cuerpo } from './respuesta.js';
import { usuarioDeLaPeticion, iniciarSesion, cerrarSesion, cookieSesion, cookieBorrada } from './sesion.js';
import { validarConector, publico } from './conectores.js';
import { agentes, ejecutar } from './agentes.js';
import { uuid, ahora } from './ids.js';
import * as cerebro from './cerebro.js';
import * as almacen from './almacen.js';
import { servirPagina } from './paginas.js';
import { MODULOS } from '../modulos/index.js';

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
  if (!ruta.startsWith('/api/')) {
    const u = await usuarioDeLaPeticion(db, req);
    // /media/<archivo> (el Estudio: lo que la página pide para ver cada imagen) lo sirve el módulo que lo posee, solo con sesión
    if (u && ruta.startsWith('/media/')) { const m = { req, env, db, usuario: u, url, ruta, json, error, prohibido, cuerpo, uuid, ahora }; for (const mod of MODULOS) { const r = await mod.manejar(m); if (r) return r; } }
    return servirPagina(req, env, u);
  }
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

  // ---- El Cerebro (fase 2): las mismas rutas y la misma forma que la oficina local ----
  if (ruta === '/api/brain' && req.method === 'GET') return json(await cerebro.leerGrafo(db));
  if (ruta === '/api/brain/search' && req.method === 'GET') return json(await cerebro.buscar(db, url.searchParams.get('q')));
  if (ruta === '/api/note' && req.method === 'GET') {
    const n = await cerebro.leerNota(db, url.searchParams.get('id') || '', { peek: url.searchParams.get('peek') === '1' });
    return n ? json(n) : error('esa nota no existe', 404);
  }
  if (ruta === '/api/migrar/notas' && req.method === 'POST') { // la herramienta de migración de la computadora del dueño
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador sube el Cerebro.');
    const b = await cuerpo(req);
    const v = b?.notas === undefined && b?.grafo ? { ok: true, notas: [] } : cerebro.validarNotas(b?.notas);
    if (!v.ok) return error(v.error, 422);
    const subidas = v.notas.length ? await cerebro.guardarNotas(db, v.notas) : 0;
    const grafo = b?.grafo ? await cerebro.guardarGrafo(db, b.grafo) : false;
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'migracion', usuario.email, JSON.stringify({ notas: subidas, grafo })).run();
    return json({ subidas, grafo, ...(await cerebro.contar(db)) });
  }
  // Importación genérica para los datos de cada módulo (tareas, rutinas, piezas…): los exporta scripts/migrar/<módulo>.mjs desde la computadora del dueño.
  if (ruta === '/api/migrar/filas' && req.method === 'POST') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador sube datos.');
    const b = await cuerpo(req);
    if (!/^[a-z][a-z0-9_-]{1,40}$/.test(String(b?.coleccion ?? ''))) return error('Colección no válida.', 422);
    const filas = Array.isArray(b?.filas) ? b.filas : [];
    if (!filas.length || filas.length > 200 || filas.some((f) => !f || typeof f.id !== 'string' || !f.id || f.id.length > 200 || typeof f.valor !== 'object' || f.valor === null)) return error('Filas no válidas (1 a 200, cada una con id y valor).', 422);
    const n = await almacen.guardarFilas(db, b.coleccion, filas);
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'migracion', usuario.email, JSON.stringify({ coleccion: b.coleccion, filas: n })).run();
    return json({ subidas: n, coleccion: b.coleccion, total: await almacen.contarFilas(db, b.coleccion) });
  }
  if (ruta === '/api/migrar/docs' && req.method === 'POST') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador sube datos.');
    const b = await cuerpo(req);
    if (!/^[a-z][a-z0-9_.-]{1,60}$/.test(String(b?.clave ?? '')) || typeof b?.valor !== 'object' || b.valor === null) return error('Documento no válido.', 422);
    const version = await almacen.guardarDoc(db, b.clave, b.valor);
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'migracion', usuario.email, JSON.stringify({ doc: b.clave })).run();
    return json({ clave: b.clave, version });
  }
  if (ruta === '/api/migrar/estado' && req.method === 'GET') return json(await cerebro.contar(db));

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
  // ---- Los módulos de cada fase del puerto (worker/modulos/): el primero que reconoce la ruta la contesta ----
  const ctx = { req, env, db, usuario, url, ruta, json, error, prohibido, cuerpo, uuid, ahora };
  for (const mod of MODULOS) { const r = await mod.manejar(ctx); if (r) return r; }

  // Lo que la oficina local hace y la nube todavía no: un aviso claro en español, nunca un error mudo (docs/plan-cloudflare-completo.md).
  return json({ error: 'Esto todavía no está en la nube: sigue en la oficina de tu computadora.', pendiente: true }, 501);
}

