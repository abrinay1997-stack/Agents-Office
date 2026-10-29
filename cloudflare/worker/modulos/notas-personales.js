// N1 (Fase 8): notas para cuando entres, «mientras no estabas» y la última visita por cuenta. TODO detrás del flag `notas.config.activo` (apagado).
//   GET  /api/notas-personales            → { activo, notas: [{ id, de, cuerpo, color, enlace, grupal, t, vence, leida }] }   (las mías sin cerrar; apagado: vacío)
//   GET  /api/notas-personales/entrada    → { activo, desde, notas, notificaciones: { noLeidas, items }, hay }                  («mientras no estabas»; marca la visita)
//   GET  /api/notas-personales/personas   → [{ id, nombre, color, rol }]                                                         (a quién puedo dejarle una nota)
//   GET  /api/notas-personales/enviadas   → las que yo dejé y si se vieron / cerraron
//   POST /api/notas-personales { para: 'persona:<id>'|'rol:<rol>'|'todos', cuerpo, color?, enlace?, venceDias? } → { id }       (cualquier rol; `lectura` solo a personas)
//   POST /api/notas-personales/<id>/(leer|cerrar|reportar) → { ok }   (una nota que no es tuya: 404)      DELETE /api/notas-personales/<id> → la retira quien la dejó
//   GET  /api/notas-personales/admin      → existencia y estado SIN el texto (solo administradores; el texto solo de las reportadas)
//   GET|POST /api/notas-personales/config → { activo } (solo administradores)
// La interfaz (campanita y hoja) va en paquetes aparte: public/nube-notas.js (diminuto) y public/nube-notas-hoja.js (bajo demanda). Nunca en la página.
import { json, error, prohibido, noEncontrado } from '../lib/respuesta.js';
import { leerConfig, guardarConfig, crear, listarMias, marcar, retirar, listarEnviadas, listarParaAdmin, personas, tocarPresencia, parsePara } from '../lib/notas-personales.js';
import { leerConfig as leerConfigNotif, listar as listarNotif } from '../lib/notificaciones.js';
import { avisarNotaNueva } from '../lib/notas-avisos.js';
import { leerCfg } from '../lib/ajustes.js';
import { avisarConexion, leerPref, guardarPref, TEXTO_TRANSPARENCIA } from '../lib/presencia-aviso.js';

export const nombre = 'notas-personales';
export const grupos = ['notas-personales'];

export async function manejar(ctx) {
  const { req, db, env, ruta, usuario } = ctx;
  if (!ruta.startsWith('/api/notas-personales')) return null;
  const resto = ruta.slice('/api/notas-personales'.length);
  if (resto === '/config') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia las notas.');
    if (req.method === 'GET') return json(await leerConfig(db));
    if (req.method === 'POST') {
      const r = await guardarConfig(db, (await ctx.cuerpo(req)) || {});
      await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'notas', usuario.email, JSON.stringify(r)).run();
      return json(r);
    }
    return error('GET o POST', 405);
  }
  const cfg = await leerConfig(db);
  const notifActiva = (await leerConfigNotif(db)).activo === true;
  const conPresencia = cfg.activo || notifActiva; // la campanita y la presencia viven con cualquiera de los dos flags
  const latido = async () => { const v = await tocarPresencia(db, usuario.id); await avisarConexion(db, env, usuario, v); return v; };
  if (resto === '/preferencias-conexion') {
    if (!conPresencia) return json({ activo: false });
    if (req.method === 'GET') return json({ activo: true, esAdmin: usuario.rol === 'admin', pref: await leerPref(db, usuario.id), transparencia: TEXTO_TRANSPARENCIA });
    if (req.method === 'POST') return json({ activo: true, esAdmin: usuario.rol === 'admin', pref: await guardarPref(db, usuario, (await ctx.cuerpo(req)) || {}), transparencia: TEXTO_TRANSPARENCIA });
    return error('GET o POST', 405);
  }
  if (req.method === 'GET' && (resto === '' || resto === '/')) {
    if (!conPresencia) return json({ activo: false, notas: [] });
    await latido();
    return json({ activo: true, notasActivas: cfg.activo, notas: cfg.activo ? await listarMias(db, usuario) : [] });
  }
  if (req.method === 'GET' && resto === '/entrada') {
    if (!conPresencia) return json({ activo: false, notas: [], notificaciones: { noLeidas: 0, items: [] }, hay: false });
    const v = await latido();
    const notas = cfg.activo ? await listarMias(db, usuario) : [];
    const nf = notifActiva ? await listarNotif(db, usuario.id, { limite: 20, soloNoLeidas: true }) : { noLeidas: 0, items: [] };
    return json({ activo: true, notasActivas: cfg.activo, desde: v.anterior, entro: v.entro, notas, notificaciones: nf, hay: notas.length > 0 || nf.noLeidas > 0 });
  }
  if (req.method === 'GET' && resto === '/personas') return json({ personas: cfg.activo ? await personas(db, usuario) : [] });
  if (req.method === 'GET' && resto === '/enviadas') return json({ notas: cfg.activo ? await listarEnviadas(db, usuario) : [] });
  if (req.method === 'GET' && resto === '/admin') {
    if (usuario.rol !== 'admin') return prohibido('Solo un administrador ve el estado de las notas.');
    return json({ notas: await listarParaAdmin(db) });
  }
  if (req.method === 'POST' && (resto === '' || resto === '/')) {
    if (!cfg.activo) return error('Las notas todavía no están encendidas en esta oficina.', 409);
    const b = (await ctx.cuerpo(req)) || {};
    if (!parsePara(b.para)) return error('No entendí a quién va la nota.', 400);
    const r = await crear(db, usuario, b);
    if (r.error) return error(r.error, r.estado);
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'notas', usuario.email, JSON.stringify({ id: r.id, para: String(b.para).slice(0, 90) })).run(); // el texto no entra en la auditoría
    await avisarNotaNueva(env, db, await leerCfg(db), usuario, r); // el aviso en vivo lleva solo ids; el de Telegram, «te dejó una nota» sin el texto
    return json({ id: r.id }, 201);
  }
  const m = /^\/([0-9a-f-]{8,40})(?:\/(leer|cerrar|reportar))?$/.exec(resto);
  if (m) {
    if (req.method === 'POST' && m[2]) return (await marcar(db, usuario, m[1], m[2])) ? json({ ok: true }) : noEncontrado('Nota');
    if (req.method === 'DELETE' && !m[2]) return (await retirar(db, usuario, m[1])) ? json({ ok: true }) : noEncontrado('Nota');
  }
  return null;
}
