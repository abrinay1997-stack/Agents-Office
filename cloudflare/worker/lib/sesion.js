// Sesión propia, portada de CALENDARIOS-MARKETING-APP (worker/lib/sesion.js).
//  1. PBKDF2-SHA256, 600.000 iteraciones EN VUELTAS DE 100.000: workerd en producción rechaza más de 100.000 por llamada
//     (ni `wrangler dev` ni Node lo aplican, así que solo falla publicado).
//  2. En `sessions` va el SHA-256 del testigo, nunca el testigo.
//  3. Cookie con prefijo `__Host-`: sin Domain, solo vale para este origen.
import { sha256, testigo, ahora, enHoras } from './ids.js';
import { leerDoc, guardarDoc } from './almacen.js';
import { revocarDe } from './mcp/tokens.js';

export const COOKIE = '__Host-sesion';
export const ITERACIONES = 600_000;
export const MAX_POR_LLAMADA = 100_000;
const HORAS_SESION = 24 * 30;

// SEG-05 · sesión deslizante, SOLO con el flag `sesion.deslizante` (config-local) encendido. Apagado, todo es como siempre (30 días fijos).
//  · una sesión NUEVA vive 7 días; al usarla, si le faltan menos de 24 h se renueva 7 días más y se reenvía la cookie en esa misma respuesta;
//  · un administrador o un editor que lleva 14 días sin usar la sesión la pierde (también las de 30 días de antes); `lectura` no tiene tope de inactividad;
//  · el «último uso» se apunta como mucho una vez al día (sesiones_uso). Las sesiones que ya existen siguen valiendo: nadie se desloguea al encender el flag.
export const HORAS_DESLIZANTE = 24 * 7;
export const RENOVAR_SI_FALTAN_MS = 24 * 3600_000;
export const INACTIVIDAD_MS = 14 * 24 * 3600_000;
const TTL_FLAG_MS = 10_000;
const cacheFlag = new WeakMap();
const DOC_ESTADO = 'sesion.estado'; // { activo, desde }: desde cuándo está encendido el flag SIN interrupción (lo apunta la primera petición que lo ve encendido; el reloj apunta cuándo se apaga)
/** { v: ¿encendido?, desde: ms desde que está encendido sin interrupción }. Con el flag apagado no lee nada más que `config-local`. */
export async function estadoDeslizante(db) {
  const c = cacheFlag.get(db), t = Date.now();
  if (c && t - c.t < TTL_FLAG_MS) return c.e;
  let e = { v: false, desde: 0 };
  try {
    if ((await leerDoc(db, 'config-local', {})).valor?.sesion?.deslizante === true) {
      const est = (await leerDoc(db, DOC_ESTADO, {})).valor || {};
      if (est.activo && Date.parse(est.desde)) e = { v: true, desde: Date.parse(est.desde) };
      else { const desde = new Date().toISOString(); await guardarDoc(db, DOC_ESTADO, { activo: true, desde }); e = { v: true, desde: Date.parse(desde) }; }
    }
  } catch { e = { v: false, desde: 0 }; }
  cacheFlag.set(db, { e, t });
  return e;
}
export const sesionDeslizante = async (db) => (await estadoDeslizante(db)).v;
export const olvidarFlagSesion = (db) => cacheFlag.delete(db);
/** Lo llama el reloj cada minuto: si el flag se apagó, lo apunta. Al volver a encenderlo, las filas de uso que quedaron viejas no cuentan (el «último uso» es max(fila, desde que se encendió)). */
export async function conciliarFlagSesion(db) {
  const cfg = (await leerDoc(db, 'config-local', {})).valor;
  if (cfg?.sesion?.deslizante === true) return;
  const est = (await leerDoc(db, DOC_ESTADO, {})).valor;
  if (est?.activo) await guardarDoc(db, DOC_ESTADO, { activo: false, desde: est.desde });
  olvidarFlagSesion(db);
}
const renovadas = new WeakMap(); // petición → cookie renovada (la pone `usuarioDeLaPeticion`, la lee `conCookieRenovada`)
/** Si la sesión de esta petición se renovó, la respuesta lleva la cookie nueva (misma respuesta, sin otra petición). */
export function conCookieRenovada(req, res) {
  const c = renovadas.get(req);
  if (!c || !res || res.status === 101 || res.headers.has('Set-Cookie')) return res;
  try { const h = new Headers(res.headers); h.append('Set-Cookie', c); return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h }); } catch { return res; }
}

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
  const hash = await sha256(bruto);
  const consulta = (conUso) => db.prepare(
    `select ${COLUMNAS_USUARIO}, s.created_at as s_creada, s.expires_at as s_expira${conUso ? ', su.last_used_at as s_uso' : ''}
       from sessions s join users u on u.id = s.user_id left join perfiles p on p.user_id = u.id${conUso ? ' left join sesiones_uso su on su.token_hash = s.token_hash' : ''}
      where s.token_hash = ? and s.expires_at > ? and p.baja_at is null`).bind(hash, ahora()).first();
  const estado = await estadoDeslizante(db); let desliza = estado.v, f;
  if (desliza) { try { f = await consulta(true); } catch (e) { console.warn('[sesión] sesiones_uso no está (¿migración 0300 sin aplicar?); sigo como con el flag apagado:', e?.message ?? e); desliza = false; } }
  if (!desliza) f = await consulta(false);
  if (!f) return null;
  if (desliza) {
    const t = Date.now(), faltan = (Date.parse(f.s_expira) || 0) - t;
    // Sin fila de uso (sesiones de antes de encender el flag, o filas viejas tras apagarlo y volver a encenderlo) NO se sabe cuándo se usó por última vez: cuenta como «ahora».
    // Contar desde su creación desconectaba a quien tenía una sesión de 30 días de hace más de 14 aunque la hubiera usado ayer. La fila se graba en esta misma petición.
    const ultimo = f.s_uso ? Math.max(Date.parse(f.s_uso) || t, estado.desde) : Math.max(estado.desde, Date.parse(f.s_creada) || 0); // y una fila anterior al último encendido (el flag estuvo apagado) no cuenta
    if (f.rol !== 'lectura' && t - ultimo > INACTIVIDAD_MS) { await db.prepare('delete from sessions where token_hash = ?').bind(hash).run(); return null; }
    const renovar = faltan < RENOVAR_SI_FALTAN_MS;
    if (!f.s_uso || renovar || t - ultimo > RENOVAR_SI_FALTAN_MS) { // una escritura por día y sesión
      try {
        let renovada = false;
        if (renovar) renovada = ((await db.prepare('update sessions set expires_at = ? where token_hash = ? and expires_at = ?').bind(enHoras(HORAS_DESLIZANTE), hash, f.s_expira).run()).meta?.changes ?? 1) > 0; // solo si nadie la renovó entre medias
        await db.prepare('insert into sesiones_uso (token_hash, last_used_at) values (?,?) on conflict (token_hash) do update set last_used_at = excluded.last_used_at').bind(hash, new Date(t).toISOString()).run();
        if (renovada) renovadas.set(req, cookieSesion(bruto, HORAS_DESLIZANTE * 3600));
      } catch (e) { console.warn('[sesión] renovar:', e?.message ?? e); } // renovar no puede tumbar la petición
    }
  }
  return comoUsuario(f);
}

/** Las sesiones de una persona, para «dónde tengo la sesión abierta». El id es un prefijo del hash (no sirve para entrar). */
export async function sesionesDe(db, userId, req) {
  const propia = await sha256(leerCookie(req) ?? '');
  const leer = async (conUso) => (await db.prepare(`select s.token_hash, s.created_at, s.expires_at, s.user_agent${conUso ? ', su.last_used_at' : ''} from sessions s${conUso ? ' left join sesiones_uso su on su.token_hash = s.token_hash' : ''}
      where s.user_id = ? and s.expires_at > ? order by s.created_at desc limit 50`).bind(userId, ahora()).all()).results ?? [];
  let filas;
  if (await sesionDeslizante(db)) { try { filas = await leer(true); } catch { filas = null; } }
  filas ??= await leer(false);
  return filas.map((f) => ({ id: f.token_hash.slice(0, 16), dispositivo: dispositivoDe(f.user_agent), creada: f.created_at, ultimoUso: f.last_used_at || f.created_at, expira: f.expires_at, actual: f.token_hash === propia }));
}
/** «Chrome en Windows», «Safari en iPhone»… sin guardar ni mostrar el texto crudo del navegador. */
export function dispositivoDe(ua = '') {
  const u = String(ua);
  const nav = /Edg\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\/|CriOS/.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /curl|node|undici/i.test(u) ? 'Programa' : 'Navegador';
  const so = /iPhone|iPad/.test(u) ? 'iPhone o iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X|Macintosh/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : '';
  return so ? `${nav} en ${so}` : nav;
}
/** Cierra UNA sesión de esa persona (por el prefijo que ve en la lista). La actual no: para eso está «Salir». → true si cerró algo. */
export async function cerrarSesionPorId(db, userId, id, req) {
  if (!/^[0-9a-f]{16}$/.test(String(id))) return false;
  const propia = await sha256(leerCookie(req) ?? '');
  const f = await db.prepare("select token_hash from sessions where user_id = ? and substr(token_hash, 1, 16) = ?").bind(userId, id).first();
  if (!f || f.token_hash === propia) return false;
  await db.prepare('delete from sessions where token_hash = ?').bind(f.token_hash).run();
  return true;
}
/** «Cerrar en todos los sitios»: todas las sesiones de la persona, la de ahora incluida. → cuántas. */
export async function cerrarTodas(db, userId) {
  const n = (await db.prepare('select count(*) n from sessions where user_id = ?').bind(userId).first())?.n ?? 0;
  await db.prepare('delete from sessions where user_id = ?').bind(userId).run();
  await revocarDe(db, userId); // las conexiones de Claude (MCP) de esa persona se cortan con sus sesiones
  return n;
}

/** Devuelve { testigo, usuario } o null. Deriva igual aunque el usuario no exista (mismo tiempo de respuesta). */
export async function iniciarSesion(db, email, contrasena, userAgent = '') {
  const u = await db.prepare(`select ${COLUMNAS_USUARIO}, u.password_hash, u.salt from users u left join perfiles p on p.user_id = u.id where u.email = ? and p.baja_at is null`)
    .bind(String(email ?? '').trim().toLowerCase()).first();
  const calculado = await derivar(String(contrasena ?? ''), u?.salt ?? '00000000000000000000000000000000');
  if (!u || calculado !== u.password_hash) return null;
  const t = testigo(), horas = (await sesionDeslizante(db)) ? HORAS_DESLIZANTE : HORAS_SESION;
  await db.prepare('insert into sessions (token_hash, user_id, created_at, expires_at, user_agent) values (?,?,?,?,?)')
    .bind(await sha256(t), u.id, ahora(), enHoras(horas), String(userAgent).slice(0, 200)).run();
  return { testigo: t, usuario: comoUsuario(u), segundos: horas * 3600 };
}

export async function cerrarSesion(db, req) {
  const bruto = leerCookie(req);
  if (bruto) await db.prepare('delete from sessions where token_hash = ?').bind(await sha256(bruto)).run();
}

/** Abre una sesión para alguien que acaba de crearse (al aceptar una invitación). */
export async function abrirSesion(db, userId, userAgent = '') {
  const t = testigo(), horas = (await sesionDeslizante(db)) ? HORAS_DESLIZANTE : HORAS_SESION;
  await db.prepare('insert into sessions (token_hash, user_id, created_at, expires_at, user_agent) values (?,?,?,?,?)')
    .bind(await sha256(t), userId, ahora(), enHoras(horas), String(userAgent).slice(0, 200)).run();
  return t;
}

export const MIN_CLAVE = 12;
/** Las reglas de una contraseña NUEVA (una sola vez: el alta, el restablecimiento y el cambio). → el motivo, o null. */
export function validarClave(clave, email = '', actual = null) {
  const c = String(clave ?? '');
  if (c.length < MIN_CLAVE) return `La contraseña debe tener ${MIN_CLAVE} caracteres como mínimo.`;
  if (c.length > 200) return 'La contraseña es demasiado larga.';
  if (email && c.toLowerCase() === String(email).toLowerCase()) return 'La contraseña no puede ser tu correo.';
  if (actual !== null && c === String(actual)) return 'La contraseña nueva no puede ser igual a la actual.';
  return null;
}

/** Cambia la contraseña: pide la actual y cierra todas las demás sesiones de esa persona (la que cambia sigue dentro). → null si todo bien, o { estado, error }. */
export async function cambiarContrasena(db, req, usuario, actual, nueva) {
  const mala = validarClave(nueva, usuario.email, actual);
  if (mala) return { estado: 422, error: mala };
  const u = await db.prepare('select salt, password_hash from users where id = ?').bind(usuario.id).first();
  const calculado = await derivar(String(actual ?? ''), u?.salt ?? '00000000000000000000000000000000');
  if (!u || calculado !== u.password_hash) return { estado: 403, error: 'La contraseña actual no es correcta.' };
  const { salt, password_hash } = await hashearContrasena(String(nueva));
  const propia = await sha256(leerCookie(req) ?? '');
  await db.prepare('update users set salt = ?, password_hash = ? where id = ?').bind(salt, password_hash, usuario.id).run();
  await db.prepare('delete from sessions where user_id = ? and token_hash != ?').bind(usuario.id, propia).run();
  await revocarDe(db, usuario.id); // y las conexiones de Claude (MCP): cambiar la contraseña las corta
  return null;
}
