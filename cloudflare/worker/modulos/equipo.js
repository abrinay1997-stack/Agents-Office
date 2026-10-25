// Fase 10 — Equipo, invitaciones, perfil y presencia en vivo.
//   /api/equipo            quién está en la oficina (todos) · invitaciones y roles (solo admin)
//   /api/yo/*              mi nombre, mi foto, mi contraseña
//   /api/live              WebSocket: presencia y cambios (lo atiende el Durable Object `Hub`, worker/hub.js)
//   /api/invitacion/<t>    PÚBLICO (sin sesión): ver y aceptar una invitación (lo llama lib/rutas.js antes de pedir sesión)
import { json, error, prohibido, cuerpo, noEncontrado } from '../lib/respuesta.js';
import * as eq from '../lib/equipo.js';
import { cambiarContrasena, abrirSesion, cookieSesion } from '../lib/sesion.js';
import { cerrarDe, difundir } from '../lib/vivo.js';

export const nombre = 'equipo';
export const grupos = ['equipo', 'live', 'yo'];

const admin = (u) => u.rol === 'admin';
const soloAdmin = () => prohibido('Solo un administrador gestiona el equipo.');
const CABECERA_FOTO = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cross-Origin-Resource-Policy': 'same-origin' };

/** Lee el cuerpo con tope, sin fiarse de Content-Length (puede mentir o faltar). → { bytes } | { grande: true } */
async function leerConTope(req, max) {
  const declarado = Number(req.headers.get('content-length'));
  if (declarado > max) return { grande: true };
  if (!req.body) return { bytes: new Uint8Array(0) };
  const lector = req.body.getReader(), partes = []; let total = 0;
  for (;;) {
    const { done, value } = await lector.read(); if (done) break;
    total += value.length;
    if (total > max) { try { await lector.cancel(); } catch { /* ya cortado */ } return { grande: true }; }
    partes.push(value);
  }
  const bytes = new Uint8Array(total); let o = 0; for (const p of partes) { bytes.set(p, o); o += p.length; }
  return { bytes };
}

const publicoDe = (u) => ({ id: u.id, email: u.email, rol: u.rol, nombre: u.nombre, color: u.color, foto: u.foto });

async function servirFoto(env, db, id) {
  const f = await eq.fotoDe(db, id);
  if (!f?.foto_clave || !env.MEDIA) return noEncontrado('Foto');
  const o = await env.MEDIA.get(f.foto_clave);
  if (!o) return noEncontrado('Foto');
  return new Response(o.body, { status: 200, headers: { 'Content-Type': eq.MIME[f.foto_tipo] ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=86400', ...CABECERA_FOTO } });
}

export async function manejar(ctx) {
  const { req, env, db, usuario, ruta, url } = ctx;
  const m = req.method;
  let r;

  // ---- presencia: el WebSocket ----
  if (ruta === '/api/live') {
    if (m !== 'GET' || req.headers.get('Upgrade') !== 'websocket') return error('Se esperaba una conexión WebSocket.', 426);
    // Un navegador manda siempre Origin en un WebSocket: sin él, o de otro sitio, no entra (defensa extra sobre SameSite=Lax).
    if (req.headers.get('Origin') !== url.origin) return prohibido('Origen no permitido.');
    if (!env.HUB) return error('La presencia en vivo no está disponible.', 503);
    const q = new URLSearchParams({ userId: usuario.id, nombre: usuario.nombre, color: usuario.color, foto: usuario.foto ?? '', rol: usuario.rol });
    return env.HUB.get(env.HUB.idFromName('oficina')).fetch(new Request(`https://hub/conectar?${q}`, { headers: { Upgrade: 'websocket' } }));
  }

  // ---- mi perfil ----
  if (ruta === '/api/yo' && m === 'PATCH') {
    const b = await cuerpo(req);
    const g = await eq.guardarNombre(db, usuario.id, b?.nombre);
    if (g.error) return error(g.error, g.estado);
    return json({ usuario: { ...publicoDe(usuario), nombre: g.nombre } });
  }
  if (ruta === '/api/yo/foto') {
    if (m === 'GET') return servirFoto(env, db, usuario.id);
    if (m === 'PUT') {
      if (!env.MEDIA) return error('No hay dónde guardar la foto.', 503);
      const l = await leerConTope(req, eq.MAX_FOTO);
      if (l.grande) return error('La foto pesa más de 1 MB: usa una más pequeña.', 413);
      const tipo = eq.tipoDeImagen(l.bytes);
      if (!tipo) return error('Solo se admite JPEG, PNG o WebP.', 415);
      const clave = `perfiles/${usuario.id}`;
      await env.MEDIA.put(clave, l.bytes, { httpMetadata: { contentType: eq.MIME[tipo] } });
      const v = await eq.guardarFoto(db, usuario.id, clave, tipo);
        return json({ foto: v }, 200);
    }
    if (m === 'DELETE') {
      const f = await eq.fotoDe(db, usuario.id);
      await eq.quitarFoto(db, usuario.id);
      if (f?.foto_clave) await env.MEDIA?.delete(f.foto_clave).catch(() => {});
        return json({ ok: true });
    }
  }
  if (ruta === '/api/yo/contrasena' && m === 'POST') {
    const b = await cuerpo(req);
    const t = await eq.tasa(db, 'clave:' + usuario.id, 5);
    if (!t.ok) return error('Demasiados intentos. Espera un minuto.', 429);
    const f = await cambiarContrasena(db, req, usuario, b?.actual, b?.nueva);
    if (f) return error(f.error, f.estado);
    await cerrarDe(env, usuario.id, 'contraseña cambiada'); // sus otras pestañas reconectan: si ya no tienen sesión, no entran
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ctx.ahora(), 'contrasena', usuario.email, '{}').run();
    return json({ ok: true });
  }

  // ---- el equipo ----
  if (ruta === '/api/equipo' && m === 'GET') {
    return json({ yo: usuario.id, roles: eq.ROLES, miembros: await eq.miembros(db, { admin: admin(usuario), yo: usuario.id }), ...(admin(usuario) ? { invitaciones: await eq.invitacionesPendientes(db) } : {}) });
  }
  if (ruta === '/api/equipo/invitaciones' && m === 'POST') {
    if (!admin(usuario)) return soloAdmin();
    const b = await cuerpo(req);
    const c = await eq.crearInvitacion(db, usuario, { email: b?.email, nombre: b?.nombre, rol: b?.rol });
    if (c.error) return error(c.error, c.estado);
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ctx.ahora(), 'invitacion', usuario.email, JSON.stringify({ para: c.invitacion.email, rol: c.invitacion.rol })).run();
    // NO hay servicio de correo: el enlace se entrega para copiar y pegar. (Puerta abierta: Cloudflare Email Service; ver docs/cloudflare.md.)
    return json({ invitacion: c.invitacion, enlace: `${url.origin}/invitacion/${c.testigo}` }, 201);
  }
  if ((r = ruta.match(/^\/api\/equipo\/invitaciones\/([0-9a-f-]{36})$/)) && m === 'DELETE') {
    if (!admin(usuario)) return soloAdmin();
    return (await eq.revocarInvitacion(db, r[1])) ? json({ ok: true }) : noEncontrado('Invitación');
  }
  if ((r = ruta.match(/^\/api\/equipo\/([0-9a-f-]{36})\/reinicio$/)) && m === 'POST') {
    if (!admin(usuario)) return soloAdmin();
    const c = await eq.crearReinicio(db, usuario, r[1]);
    if (c.error) return error(c.error, c.estado);
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ctx.ahora(), 'reinicio', usuario.email, JSON.stringify({ id: r[1] })).run();
    return json({ para: c.para, enlace: `${url.origin}/invitacion/${c.testigo}`, expira: '24 horas' }, 201);
  }
  if ((r = ruta.match(/^\/api\/equipo\/([0-9a-f-]{36})\/foto$/)) && m === 'GET') return servirFoto(env, db, r[1]);
  if ((r = ruta.match(/^\/api\/equipo\/([0-9a-f-]{36})$/))) {
    if (m === 'PATCH') {
      if (!admin(usuario)) return soloAdmin();
      const b = await cuerpo(req);
      const c = await eq.cambiarRol(db, r[1], b?.rol);
      if (c.error) return error(c.error, c.estado);
      await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ctx.ahora(), 'rol', usuario.email, JSON.stringify({ id: r[1], rol: b.rol })).run();
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      if (!admin(usuario)) return soloAdmin();
      const f = await eq.fotoDe(db, r[1]);
      const c = await eq.quitarMiembro(db, r[1], { yo: usuario.id });
      if (c.error) return error(c.error, c.estado);
      if (f?.foto_clave) await env.MEDIA?.delete(f.foto_clave).catch(() => {});
      await cerrarDe(env, r[1], 'quitado del equipo');
      await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ctx.ahora(), 'baja', usuario.email, JSON.stringify({ id: r[1] })).run();
      return json({ ok: true });
    }
  }
  return null;
}

/**
 * Lo público (sin sesión): ver y aceptar una invitación (o un restablecimiento de contraseña). El testigo viaja en el CUERPO de un POST, nunca en la
 * ruta de la API: así no queda en los registros de peticiones ni en el historial. (Lo que queda es la página /invitacion/<testigo>, que la propia
 * página borra de la barra de direcciones al leerlo.) Con tope de intentos por IP; nunca dice si un correo existe. → Response | null
 */
export async function publicaInvitacion(req, env) {
  const url = new URL(req.url), db = env.DB;
  const r = url.pathname.match(/^\/api\/invitacion\/(ver|aceptar)$/);
  if (!r) return null;
  if (req.method !== 'POST') return error('Método no permitido', 405);
  const aceptar = r[1] === 'aceptar';
  const t = await eq.tasa(db, `inv:${aceptar ? 'a' : 'v'}:${eq.ipDe(req)}`, aceptar ? 10 : 30, eq.relojDe(env));
  if (!t.ok) return error('Demasiados intentos. Espera un minuto.', 429);
  const b = await cuerpo(req, 16_000); // sin sesión: un testigo, un nombre y una contraseña
  const testigo = typeof b?.testigo === 'string' ? b.testigo : '';
  const MALA = 'Esta invitación no sirve: puede que ya se usara, que caducara o que la revocaran. Pide una nueva a quien administra la oficina.';
  if (!aceptar) {
    const v = (await eq.verInvitacion(db, testigo)) ?? (await eq.verReinicio(db, testigo));
    return v ? json({ invitacion: { tipo: 'invitacion', ...v } }) : error(MALA, 404);
  }
  if (await eq.invitacionVigente(db, testigo)) {
    const a = await eq.aceptarInvitacion(db, testigo, { nombre: b?.nombre, contrasena: b?.contrasena });
    if (a.error) return error(a.error, a.estado);
    const cookie = await abrirSesion(db, a.id, req.headers.get('User-Agent') ?? '');
    await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'alta', a.email, JSON.stringify({ rol: a.rol })).run();
    difundir(env, { tipo: 'cambio', area: 'equipo', nombre: '', por: { id: a.id, nombre: a.nombre, tab: null }, at: Date.now() });
    return json({ ok: true }, 200, { 'Set-Cookie': cookieSesion(cookie) });
  }
  const x = await eq.aplicarReinicio(db, testigo, b?.contrasena);
  if (x.error) return error(x.error, x.estado);
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'reinicio-aplicado', x.email, '{}').run();
  await cerrarDe(env, x.id, 'contraseña restablecida');
  return json({ ok: true, reinicio: true }); // sin sesión: entra con la contraseña nueva
}
