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

/** El usuario de la sesión, o null. La caducidad se comprueba en SQL. */
export async function usuarioDeLaPeticion(db, req) {
  const bruto = leerCookie(req);
  if (!bruto) return null;
  return (await db.prepare(
    `select u.id, u.email, u.rol from sessions s join users u on u.id = s.user_id
      where s.token_hash = ? and s.expires_at > ?`).bind(await sha256(bruto), ahora()).first()) ?? null;
}

/** Devuelve { testigo, usuario } o null. Deriva igual aunque el usuario no exista (mismo tiempo de respuesta). */
export async function iniciarSesion(db, email, contrasena, userAgent = '') {
  const u = await db.prepare('select id, email, rol, password_hash, salt from users where email = ?')
    .bind(String(email ?? '').trim().toLowerCase()).first();
  const calculado = await derivar(String(contrasena ?? ''), u?.salt ?? '00000000000000000000000000000000');
  if (!u || calculado !== u.password_hash) return null;
  const t = testigo();
  await db.prepare('insert into sessions (token_hash, user_id, created_at, expires_at, user_agent) values (?,?,?,?,?)')
    .bind(await sha256(t), u.id, ahora(), enHoras(HORAS_SESION), String(userAgent).slice(0, 200)).run();
  return { testigo: t, usuario: { id: u.id, email: u.email, rol: u.rol } };
}

export async function cerrarSesion(db, req) {
  const bruto = leerCookie(req);
  if (bruto) await db.prepare('delete from sessions where token_hash = ?').bind(await sha256(bruto)).run();
}
