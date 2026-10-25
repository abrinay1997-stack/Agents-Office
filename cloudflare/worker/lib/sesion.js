// Sesión propia, portada de CALENDARIOS-MARKETING-APP (worker/lib/sesion.js).
//  1. PBKDF2-SHA256, 600.000 iteraciones EN VUELTAS DE 100.000: workerd en producción rechaza más de 100.000 por llamada
//     (ni `wrangler dev` ni Node lo aplican, así que solo falla publicado).
//  2. En `sessions` va el SHA-256 del testigo, nunca el testigo.
//  3. Cookie con prefijo `__Host-`: sin Domain, solo vale para este origen.
import { sha256, testigo, ahora, enHoras } from './ids.js';

export const COOKIE = '__Host-sesion';
export const ITERACIONES = 600_000;
export const MAX_POR_LLAMADA = 100_000;
const HORAS_SESION = 24 * 30;

const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const deHex = (s) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));

export async function derivar(contrasena, salHex, total = ITERACIONES) {
  const salt = deHex(salHex);
  let material = new TextEncoder().encode(contrasena);
  for (let restantes = total; restantes > 0; ) {
    const vuelta = Math.min(restantes, MAX_POR_LLAMADA);
    const clave = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
    material = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: vuelta }, clave, 256));
    restantes -= vuelta;
  }
  return hex(material);
}

export async function hashearContrasena(contrasena) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, password_hash: await derivar(contrasena, salt) };
}

export function leerCookie(req, nombre = COOKIE) {
  for (const parte of (req.headers.get('Cookie') ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i >= 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}
export const cookieSesion = (valor, segundos = HORAS_SESION * 3600) =>
  `${COOKIE}=${valor}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${segundos}`;
export const cookieBorrada = () => cookieSesion('', 0);

// Un color estable por nombre: la misma persona tiene siempre el mismo punto de color en la presencia.
export function colorDeNombre(nombre) {
  const paleta = ['#1E6FD9', '#B45309', '#15803D', '#7E3AF2', '#C81E1E', '#0F766E', '#BE185D', '#A16207'];
  let suma = 0;
  for (const c of String(nombre)) suma = (suma + c.codePointAt(0)) % 4096;
  return paleta[suma % paleta.length];
}
export function nombrePorCorreo(email) {
  const local = String(email ?? '').split('@')[0].replace(/[._+-]+/g, ' ').trim();
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Persona';
}
/** Lo que la interfaz y los módulos ven de una persona (sin la sal ni el hash). `foto` es la versión (para ?v=) o null. */
export function comoUsuario(f) {
  const nombre = (f.nombre || '').trim() || nombrePorCorreo(f.email);
  return { id: f.id, email: f.email, rol: f.rol, nombre, color: f.color || colorDeNombre(nombre), foto: f.foto_at && f.foto_clave ? f.foto_at : null };
}
const COLUMNAS_USUARIO = 'u.id, u.email, u.rol, p.nombre, p.color, p.foto_clave, p.foto_at';

/** El usuario de la sesión, o null. La caducidad se comprueba en SQL; quien fue quitado del equipo (baja) no pasa aunque conserve una cookie. */
export async function usuarioDeLaPeticion(db, req) {
  const bruto = leerCookie(req);
  if (!bruto) return null;
  const f = await db.prepare(
    `select ${COLUMNAS_USUARIO} from sessions s join users u on u.id = s.user_id left join perfiles p on p.user_id = u.id
      where s.token_hash = ? and s.expires_at > ? and p.baja_at is null`).bind(await sha256(bruto), ahora()).first();
  return f ? comoUsuario(f) : null;
}

/** Devuelve { testigo, usuario } o null. Deriva igual aunque el usuario no exista (mismo tiempo de respuesta). */
export async function iniciarSesion(db, email, contrasena, userAgent = '') {
  const u = await db.prepare(`select ${COLUMNAS_USUARIO}, u.password_hash, u.salt from users u left join perfiles p on p.user_id = u.id where u.email = ? and p.baja_at is null`)
    .bind(String(email ?? '').trim().toLowerCase()).first();
  const calculado = await derivar(String(contrasena ?? ''), u?.salt ?? '00000000000000000000000000000000');
  if (!u || calculado !== u.password_hash) return null;
  const t = testigo();
  await db.prepare('insert into sessions (token_hash, user_id, created_at, expires_at, user_agent) values (?,?,?,?,?)')
    .bind(await sha256(t), u.id, ahora(), enHoras(HORAS_SESION), String(userAgent).slice(0, 200)).run();
  return { testigo: t, usuario: comoUsuario(u) };
}

export async function cerrarSesion(db, req) {
  const bruto = leerCookie(req);
  if (bruto) await db.prepare('delete from sessions where token_hash = ?').bind(await sha256(bruto)).run();
}

/** Abre una sesión para alguien que acaba de crearse (al aceptar una invitación). */
export async function abrirSesion(db, userId, userAgent = '') {
  const t = testigo();
  await db.prepare('insert into sessions (token_hash, user_id, created_at, expires_at, user_agent) values (?,?,?,?,?)')
    .bind(await sha256(t), userId, ahora(), enHoras(HORAS_SESION), String(userAgent).slice(0, 200)).run();
  return t;
}

/** Cambia la contraseña: pide la actual y cierra todas las demás sesiones de esa persona (la que cambia sigue dentro). → null si todo bien, o { estado, error }. */
export async function cambiarContrasena(db, req, usuario, actual, nueva) {
  if (String(nueva ?? '').length < 12) return { estado: 422, error: 'La contraseña nueva debe tener 12 caracteres como mínimo.' };
  if (String(nueva).length > 200) return { estado: 422, error: 'La contraseña es demasiado larga.' };
  const u = await db.prepare('select salt, password_hash from users where id = ?').bind(usuario.id).first();
  const calculado = await derivar(String(actual ?? ''), u?.salt ?? '00000000000000000000000000000000');
  if (!u || calculado !== u.password_hash) return { estado: 403, error: 'La contraseña actual no es correcta.' };
  const { salt, password_hash } = await hashearContrasena(String(nueva));
  const propia = await sha256(leerCookie(req) ?? '');
  await db.prepare('update users set salt = ?, password_hash = ? where id = ?').bind(salt, password_hash, usuario.id).run();
  await db.prepare('delete from sessions where user_id = ? and token_hash != ?').bind(usuario.id, propia).run();
  return null;
}
