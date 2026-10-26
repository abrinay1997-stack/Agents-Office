// Equipo, invitaciones y perfil (fase 10). Lo que toca la base; las rutas viven en modulos/equipo.js.
// Reglas (cada una con su test que muerde, tests/equipo.test.mjs):
//  · una invitación es un enlace de UN solo uso; en la base solo va el SHA-256 del testigo; caduca (7 días) y se revoca;
//  · lo público (ver / aceptar) contesta lo mismo para «no existe», «ya se usó», «caducó» y «se revocó»: no se puede sondear;
//  · el rol y el correo salen SIEMPRE de la invitación, nunca de lo que mande quien la acepta;
//  · nunca se queda la oficina sin administrador y el fundador (la cuenta más antigua) no se quita ni se rebaja;
//  · quitar a alguien conserva su cuenta (las ejecuciones antiguas apuntan a ella): sin sesiones, sin contraseña, sin correo, fuera del equipo.
import { uuid, ahora, enHoras, sha256, testigo, igualSeguro } from './ids.js';
import { hashearContrasena, colorDeNombre, nombrePorCorreo, validarClave, MIN_CLAVE } from './sesion.js';
export { validarClave, MIN_CLAVE };

export const ROLES = ['admin', 'editor', 'lectura'];
export const HORAS_INVITACION = 24 * 7;
const MENSAJE_INVITACION = 'Esta invitación no sirve: puede que ya se usara, que caducara o que la revocaran. Pide una nueva a quien administra la oficina.';
const reCorreo = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;

/** Cuenta esta petición en el minuto de `clave` y dice si cabe. Un Worker no recuerda entre peticiones: se cuenta en D1. */
export async function tasa(db, clave, max, ms = Date.now()) {
  const ventana = Math.floor(ms / 60e3);
  await db.prepare('delete from acceso_intentos where ventana < ?').bind(ventana - 10).run();
  const f = await db.prepare('insert into acceso_intentos (clave, ventana, n) values (?,?,1) on conflict (clave, ventana) do update set n = n + 1 returning n').bind(clave, ventana).first();
  return { ok: Number(f?.n ?? 1) <= max, n: Number(f?.n ?? 1) };
}
/** Cuántos intentos lleva esta clave en el minuto, SIN contar este. */
export async function tasaVer(db, clave, ms = Date.now()) {
  const f = await db.prepare('select n from acceso_intentos where clave = ? and ventana = ?').bind(clave, Math.floor(ms / 60e3)).first();
  return Number(f?.n ?? 0);
}
/** El reloj de los topes: `env.RELOJ_MS` solo lo pone una prueba (para que el minuto no cambie a mitad); en producción es Date.now(). */
export const relojDe = (env) => (typeof env?.RELOJ_MS === 'function' ? env.RELOJ_MS() : Date.now());
export const ipDe = (req) => (req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'local').split(',')[0].trim().slice(0, 64);

/** El tipo de una imagen por sus primeros bytes (nunca por lo que diga el cliente). Un SVG, un HTML o cualquier otra cosa: null. */
export function tipoDeImagen(b) {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (u.length > 12 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return 'jpeg';
  if (u.length > 12 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47 && u[4] === 0x0d && u[5] === 0x0a && u[6] === 0x1a && u[7] === 0x0a) return 'png';
  if (u.length > 12 && u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50) return 'webp';
  return null;
}
export const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const MAX_FOTO = 1024 * 1024;

const ACTIVO = 'p.baja_at is null';
// Sin caracteres de control, sin las marcas bidi (U+202A–202E, U+2066–2069, U+200E/F, U+061C) ni de ancho cero que disfrazan un nombre, y con los espacios colapsados.
export const limpiarNombre = (n) => String(n ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f<>\u200b-\u200f\u202a-\u202e\u2060-\u2069\u061c\ufeff]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
/** Para comparar nombres: sin mayúsculas, acentos ni espacios de más. */
export const claveNombre = (n) => limpiarNombre(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** «Tú» es el dueño en las tareas (person: 'Tú'): ninguna cuenta puede llamarse así, o se quedaría con las tareas del dueño. */
export const nombreReservado = (n) => claveNombre(n) === 'tu';
const RESERVADO = 'Ese nombre está reservado para el dueño de la oficina: elige otro.';
/** ¿Hay otra persona activa que se vea con ese nombre? (nadie puede hacerse pasar por el fundador con un nombre idéntico). */
export async function nombreOcupado(db, nombre, exceptoId = null) {
  const k = claveNombre(nombre);
  const { results } = await db.prepare(`select u.id, u.email, p.nombre from users u left join perfiles p on p.user_id = u.id where ${ACTIVO}`).all();
  return results.some((f) => f.id !== exceptoId && claveNombre((f.nombre || '').trim() || nombrePorCorreo(f.email)) === k);
}

/** La cuenta más antigua: fundó la oficina. */
export async function fundador(db) { return (await db.prepare('select id from users order by created_at, rowid limit 1').first())?.id ?? null; }

export async function miembros(db, { admin = false, yo = null } = {}) {
  const fu = await fundador(db);
  const { results } = await db.prepare(
    `select u.id, u.email, u.rol, u.created_at, p.nombre, p.color, p.foto_clave, p.foto_at from users u left join perfiles p on p.user_id = u.id
      where ${ACTIVO} order by u.created_at, u.rowid`).all();
  return results.map((f) => {
    const nombre = (f.nombre || '').trim() || nombrePorCorreo(f.email);
    return { id: f.id, nombre, ...(admin || f.id === yo ? { email: f.email } : {}), rol: f.rol, color: f.color || colorDeNombre(nombre), foto: f.foto_clave && f.foto_at ? f.foto_at : null, fundador: f.id === fu, yo: f.id === yo, desde: f.created_at };
  });
}

export async function invitacionesPendientes(db) {
  const { results } = await db.prepare(
    `select i.id, i.email, i.nombre, i.rol, i.created_at, i.expires_at, pc.nombre as por from invitaciones i left join perfiles pc on pc.user_id = i.creada_por
      where i.aceptada_at is null and i.revocada_at is null and i.expires_at > ? order by i.created_at desc`).bind(ahora()).all();
  return results.map((f) => ({ id: f.id, email: f.email, nombre: f.nombre, rol: f.rol, creada: f.created_at, expira: f.expires_at, por: f.por || '' }));
}

/** Crea el enlace. El testigo se devuelve UNA vez (solo se guarda su huella). Una invitación pendiente al mismo correo se sustituye. */
export async function crearInvitacion(db, creador, { email, nombre, rol }) {
  const correo = String(email ?? '').trim().toLowerCase();
  if (!reCorreo.test(correo) || correo.length > 120) return { estado: 422, error: 'Ese correo no es válido.' };
  if (!ROLES.includes(rol)) return { estado: 422, error: 'El rol debe ser admin, editor o lectura.' };
  if (await db.prepare('select u.id from users u left join perfiles p on p.user_id = u.id where u.email = ? and ' + ACTIVO).bind(correo).first()) return { estado: 409, error: 'Ya hay una cuenta con ese correo.' };
  const { results: pend } = await db.prepare('select count(*) n from invitaciones where aceptada_at is null and revocada_at is null and expires_at > ?').bind(ahora()).all();
  if (Number(pend[0]?.n) >= 50) return { estado: 429, error: 'Hay demasiadas invitaciones pendientes: revoca algunas.' };
  const bruto = testigo(24), id = uuid(), t = ahora();
  await db.prepare('update invitaciones set revocada_at = ? where email = ? and aceptada_at is null and revocada_at is null').bind(t, correo).run();
  await db.prepare('insert into invitaciones (id, token_hash, email, nombre, rol, creada_por, created_at, expires_at) values (?,?,?,?,?,?,?,?)')
    .bind(id, await sha256(bruto), correo, limpiarNombre(nombre), rol, creador.id, t, enHoras(HORAS_INVITACION)).run();
  return { invitacion: { id, email: correo, nombre: limpiarNombre(nombre), rol, creada: t, expira: enHoras(HORAS_INVITACION) }, testigo: bruto };
}

export async function revocarInvitacion(db, id) {
  const r = await db.prepare('update invitaciones set revocada_at = ? where id = ? and aceptada_at is null and revocada_at is null').bind(ahora(), String(id)).run();
  return Boolean(r.meta?.changes);
}

const formatoTestigo = (t) => typeof t === 'string' && /^[0-9a-f]{48}$/.test(t);
/** La invitación SI SIRVE ahora (ni usada, ni caducada, ni revocada), o null — el mismo null para todo lo demás. */
export async function invitacionVigente(db, bruto) {
  if (!formatoTestigo(bruto)) return null;
  const huella = await sha256(bruto);
  const f = await db.prepare('select i.id, i.token_hash, i.email, i.nombre, i.rol, i.expires_at, i.aceptada_at, i.revocada_at, pc.nombre as por from invitaciones i left join perfiles pc on pc.user_id = i.creada_por where i.token_hash = ?').bind(huella).first();
  if (!f || !igualSeguro(f.token_hash, huella) || f.aceptada_at || f.revocada_at || f.expires_at <= ahora()) return null;
  return f;
}
/** Lo que enseña la página de la invitación (sin sesión): a quién va, con qué papel y quién invita. */
export async function verInvitacion(db, bruto) {
  const f = await invitacionVigente(db, bruto);
  return f ? { email: f.email, nombre: f.nombre, rol: f.rol, invita: f.por || 'quien administra la oficina', expira: f.expires_at } : null;
}

/** Acepta: crea la persona con el correo y el rol DE LA INVITACIÓN, gasta el enlace (una sola vez, aunque lleguen dos a la vez) y deja la sesión abierta. */
export async function aceptarInvitacion(db, bruto, { nombre, contrasena }) {
  const inv = await invitacionVigente(db, bruto);
  if (!inv) return { estado: 404, error: MENSAJE_INVITACION };
  const mala = validarClave(contrasena, inv.email);
  if (mala) return { estado: 422, error: mala };
  const visible0 = limpiarNombre(nombre) || inv.nombre || nombrePorCorreo(inv.email);
  if (nombreReservado(visible0)) return { estado: 422, error: RESERVADO };
  if (await nombreOcupado(db, visible0)) return { estado: 422, error: 'Ya hay alguien con ese nombre en la oficina: añade tu apellido o una inicial.' };
  // se gasta primero: solo una petición cambia la fila; la segunda ve 0 cambios
  const t = ahora();
  const gasto = await db.prepare('update invitaciones set aceptada_at = ? where id = ? and aceptada_at is null and revocada_at is null and expires_at > ?').bind(t, inv.id, t).run();
  if (!gasto.meta?.changes) return { estado: 404, error: MENSAJE_INVITACION };
  const id = uuid(), visible = limpiarNombre(nombre) || inv.nombre || nombrePorCorreo(inv.email);
  try {
    const { salt, password_hash } = await hashearContrasena(String(contrasena));
    await db.prepare('insert into users (id, email, rol, password_hash, salt, created_at) values (?,?,?,?,?,?)').bind(id, inv.email, inv.rol, password_hash, salt, t).run();
    await db.prepare('insert into perfiles (user_id, nombre, color, updated_at) values (?,?,?,?)').bind(id, visible, colorDeNombre(visible), t).run();
    await db.prepare('update invitaciones set aceptada_por = ? where id = ?').bind(id, inv.id).run();
  } catch (e) {
    // nunca se dice si el correo existe: el enlace se devuelve a su estado y la respuesta es genérica
    await db.prepare('delete from users where id = ?').bind(id).run().catch(() => {});
    await db.prepare('update invitaciones set aceptada_at = null where id = ?').bind(inv.id).run().catch(() => {});
    console.error('[invitación] no se pudo crear la cuenta:', e?.message ?? e);
    return { estado: 409, error: 'No se pudo crear la cuenta. Pide una invitación nueva.' };
  }
  return { id, email: inv.email, rol: inv.rol, nombre: visible };
}

const OTRO_ADMIN = `exists (select 1 from users u2 left join perfiles p2 on p2.user_id = u2.id where u2.rol = 'admin' and u2.id != users.id and p2.baja_at is null)`;

/** Cambia el rol. Nunca deja la oficina sin administrador (la guarda va DENTRO del UPDATE: dos administradores rebajándose a la vez no se cruzan) ni toca al fundador. */
export async function cambiarRol(db, id, rol) {
  if (!ROLES.includes(rol)) return { estado: 422, error: 'El rol debe ser admin, editor o lectura.' };
  const u = await db.prepare('select u.id, u.rol from users u left join perfiles p on p.user_id = u.id where u.id = ? and ' + ACTIVO).bind(String(id)).first();
  if (!u) return { estado: 404, error: 'Esa persona no está en el equipo.' };
  if (u.rol === rol) return { ok: true };
  if (u.id === await fundador(db) && rol !== 'admin') return { estado: 409, error: 'Quien fundó la oficina siempre es administrador.' };
  const r = await db.prepare(`update users set rol = ? where id = ? and (? = 'admin' or rol != 'admin' or ${OTRO_ADMIN})`).bind(rol, u.id, rol).run();
  if (!r.meta?.changes) return { estado: 409, error: 'La oficina no puede quedarse sin administrador: nombra antes a otro.' };
  return { ok: true };
}

/** Quita a alguien del equipo. Conserva la cuenta (la historia de ejecuciones la nombra) pero sin entrada posible ni correo. */
export async function quitarMiembro(db, id, { yo = null } = {}) {
  const u = await db.prepare('select u.id, u.rol from users u left join perfiles p on p.user_id = u.id where u.id = ? and ' + ACTIVO).bind(String(id)).first();
  if (!u) return { estado: 404, error: 'Esa persona no está en el equipo.' };
  if (u.id === yo) return { estado: 409, error: 'No puedes quitarte a ti mismo: pide que lo haga otro administrador.' };
  if (u.id === await fundador(db)) return { estado: 409, error: 'No se puede quitar a quien fundó la oficina.' };
  // la guarda del último administrador va en el mismo UPDATE que cierra la cuenta
  const r = await db.prepare(`update users set email = 'baja-' || id || '@baja.invalid', password_hash = '!', salt = '' where id = ? and (rol != 'admin' or ${OTRO_ADMIN})`).bind(u.id).run();
  if (!r.meta?.changes) return { estado: 409, error: 'La oficina no puede quedarse sin administrador: nombra antes a otro.' };
  const t = ahora();
  await db.prepare(`insert into perfiles (user_id, baja_at, updated_at) values (?,?,?) on conflict (user_id) do update set baja_at = excluded.baja_at, foto_clave = null, foto_tipo = null, foto_at = null, updated_at = excluded.updated_at`).bind(u.id, t, t).run();
  await db.prepare('delete from sessions where user_id = ?').bind(u.id).run();
  return { ok: true };
}

export async function guardarNombre(db, id, nombre) {
  const n = limpiarNombre(nombre);
  if (!n) return { estado: 422, error: 'Escribe tu nombre.' };
  if (nombreReservado(n)) return { estado: 422, error: RESERVADO };
  if (await nombreOcupado(db, n, id)) return { estado: 422, error: 'Ya hay alguien con ese nombre en la oficina: añade tu apellido o una inicial.' };
  const antes = await db.prepare('select u.email, p.nombre from users u left join perfiles p on p.user_id = u.id where u.id = ?').bind(String(id)).first();
  const viejo = ((antes?.nombre || '').trim()) || (antes ? nombrePorCorreo(antes.email) : '');
  const t = ahora();
  const lote = [db.prepare(`insert into perfiles (user_id, nombre, color, updated_at) values (?,?,?,?) on conflict (user_id) do update set nombre = excluded.nombre, color = excluded.color, updated_at = excluded.updated_at`).bind(id, n, colorDeNombre(n), t)];
  // Una tarea guarda el NOMBRE de quien la tiene (`person`), de quien la delegó (`delegada.por`) y de quien la pasó (`handoff.from`): al cambiar de nombre se cambian ahí
  // (con la versión subida: una petición que leyó la tarea antes choca y vuelve a empezar, no la pisa), o la cuenta dejaría de ver lo suyo en Mías y Delegadas.
  if (viejo && viejo !== n) for (const col of ['tareas', 'tareas-archivo']) for (const ruta of ['person', 'delegada.por', 'handoff.from'])
    lote.push(db.prepare(`update filas set json = json_set(json, '$.${ruta}', ?, '$.version', coalesce(json_extract(json,'$.version'),1) + 1) where coleccion = ? and json_extract(json,'$.${ruta}') = ?`).bind(n, col, viejo));
  await db.batch(lote);
  return { ok: true, nombre: n };
}
export async function guardarFoto(db, id, clave, tipo) {
  const t = ahora();
  await db.prepare(`insert into perfiles (user_id, foto_clave, foto_tipo, foto_at, updated_at) values (?,?,?,?,?) on conflict (user_id) do update set foto_clave = excluded.foto_clave, foto_tipo = excluded.foto_tipo, foto_at = excluded.foto_at, updated_at = excluded.updated_at`).bind(id, clave, tipo, t, t).run();
  return t;
}
export async function quitarFoto(db, id) {
  await db.prepare('update perfiles set foto_clave = null, foto_tipo = null, foto_at = null, updated_at = ? where user_id = ?').bind(ahora(), id).run();
}
export async function fotoDe(db, id) {
  return (await db.prepare('select p.foto_clave, p.foto_tipo, p.foto_at from perfiles p where p.user_id = ? and p.baja_at is null').bind(String(id)).first()) ?? null;
}

// ---- Restablecer la contraseña de alguien (admin): un enlace de un solo uso, como una invitación pero para una cuenta que ya existe ----
export async function crearReinicio(db, admin, userId) {
  const u = await db.prepare(`select u.id, u.email, p.nombre from users u left join perfiles p on p.user_id = u.id where u.id = ? and ${ACTIVO}`).bind(String(userId)).first();
  if (!u) return { estado: 404, error: 'Esa persona no está en el equipo.' };
  if (u.id === admin.id) return { estado: 409, error: 'Para tu propia contraseña usa «Mi perfil».' };
  if (u.id === await fundador(db)) return { estado: 409, error: 'La contraseña de quien fundó la oficina solo la cambia esa persona.' };
  const bruto = testigo(24), t = ahora();
  await db.prepare('update reinicios set usado_at = ? where user_id = ? and usado_at is null').bind(t, u.id).run();
  await db.prepare('insert into reinicios (id, token_hash, user_id, creado_por, created_at, expires_at) values (?,?,?,?,?,?)').bind(uuid(), await sha256(bruto), u.id, admin.id, t, enHoras(24)).run();
  return { testigo: bruto, para: (u.nombre || '').trim() || nombrePorCorreo(u.email) };
}
async function reinicioVigente(db, bruto) {
  if (!formatoTestigo(bruto)) return null;
  const huella = await sha256(bruto);
  const f = await db.prepare(`select r.id, r.token_hash, r.user_id, r.expires_at, r.usado_at, u.email, p.nombre, pc.nombre as por from reinicios r join users u on u.id = r.user_id left join perfiles p on p.user_id = u.id left join perfiles pc on pc.user_id = r.creado_por where r.token_hash = ? and ${ACTIVO}`).bind(huella).first();
  if (!f || !igualSeguro(f.token_hash, huella) || f.usado_at || f.expires_at <= ahora()) return null;
  return f;
}
export async function verReinicio(db, bruto) {
  const f = await reinicioVigente(db, bruto);
  return f ? { tipo: 'reinicio', email: f.email, nombre: (f.nombre || '').trim() || nombrePorCorreo(f.email), invita: f.por || 'quien administra la oficina', expira: f.expires_at } : null;
}
/** Pone la contraseña nueva, cierra TODAS las sesiones de esa persona y gasta el enlace (una sola vez). */
export async function aplicarReinicio(db, bruto, contrasena) {
  const r = await reinicioVigente(db, bruto);
  if (!r) return { estado: 404, error: MENSAJE_INVITACION };
  const mala = validarClave(contrasena, r.email);
  if (mala) return { estado: 422, error: mala };
  const t = ahora();
  const gasto = await db.prepare('update reinicios set usado_at = ? where id = ? and usado_at is null and expires_at > ?').bind(t, r.id, t).run();
  if (!gasto.meta?.changes) return { estado: 404, error: MENSAJE_INVITACION };
  const { salt, password_hash } = await hashearContrasena(String(contrasena));
  await db.prepare('update users set salt = ?, password_hash = ? where id = ?').bind(salt, password_hash, r.user_id).run();
  await db.prepare('delete from sessions where user_id = ?').bind(r.user_id).run();
  return { id: r.user_id, email: r.email };
}
