// SEG-06 · retroceso creciente por correo en el acceso, SOLO con el flag `acceso.retroceso` (config-local) encendido. Apagado, el acceso es el de siempre.
//  · cuenta los FALLOS por correo en total, de cualquier IP (ventanas de 15 min; la actual y la anterior). Lo guarda en `acceso_intentos` (efímera), una escritura por fallo;
//  · la contraseña se VERIFICA PRIMERO: si es correcta, se entra sin esperar nada. Solo el 401 de un intento fallido espera, 1 s, 2 s, 4 s… hasta 5 s (siempre bajo los 20 s tras los que el
//    cliente de la oficina aborta), pasados 3 fallos del correo. Retrasa al que falla, NUNCA rechaza por este contador y nunca retrasa al que acierta: nadie puede dejar fuera al dueño
//    fallando con su correo (el bloqueo por correo era justo lo que `rutas.js` evita). Los topes por IP de siempre siguen. Sin Turnstile (la CSP no admite hosts de terceros).
//  · el correo no se guarda en claro: la clave lleva su huella (SHA-256 con un prefijo fijo, truncada).
import { leerDoc } from './almacen.js';

export const VENTANA_MS = 15 * 60e3, GRATIS = 3, ESPERA_MAX_MS = 5_000;
let cache = null; // una sola lectura cada 10 s por isolate, venga el `db` que venga
export async function retrocesoActivo(db) {
  const c = cache, t = Date.now();
  if (c && t - c.t < TTL_MS) return c.v;
  let v = false;
  try { v = (await leerDoc(db, 'config-local', {})).valor?.acceso?.retroceso === true; } catch { v = false; }
  cache = { v, t };
  return v;
}
export const olvidarRetroceso = () => { cache = null; };
const TTL_MS = 10_000;
// «ventana» = el minuto en que acaba el cubo de 15 min. La poda por minuto de `tasa` borra lo anterior a (ahora − 10 min), así que el cubo ANTERIOR deja de contar en los últimos ~5 min del actual:
// la ventana efectiva es de 10 a 25 minutos, no exactamente 30.
const cubo = (ms) => (Math.floor(ms / VENTANA_MS) + 1) * (VENTANA_MS / 60e3);
async function clave(email) { // la huella del correo, no el correo (es un dato ajeno aunque efímero)
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ao-acceso-v1:' + String(email ?? '').trim().toLowerCase().slice(0, 120)));
  return 'acc:mail:' + [...new Uint8Array(h)].slice(0, 16).map((x) => x.toString(16).padStart(2, '0')).join('');
}
export const claveDeCorreo = clave;

/** Fallos recientes de este correo (ventana actual + anterior), sin contar el intento de ahora. Si la lectura falla: 0 (el acceso no depende de este contador). */
export async function fallosDe(db, email, ms) {
  try {
    const a = cubo(ms), r = await db.prepare('select coalesce(sum(n), 0) as n from acceso_intentos where clave = ? and ventana in (?, ?)').bind(await clave(email), a, a - VENTANA_MS / 60e3).first();
    return Number(r?.n ?? 0);
  } catch { return 0; }
}
export async function anotarFallo(db, email, ms) {
  try { await db.prepare('insert into acceso_intentos (clave, ventana, n) values (?,?,1) on conflict (clave, ventana) do update set n = n + 1').bind(await clave(email), cubo(ms)).run(); } catch { /* anotar no tumba el acceso */ }
}
/** Espera (ms) del 401 de quien falla con `fallos` previos: 0 hasta 3; después 1 s, 2 s, 4 s… con tope de 5 s. */
export const esperaMs = (fallos) => (fallos <= GRATIS ? 0 : Math.min(ESPERA_MAX_MS, 1000 * 2 ** (fallos - GRATIS - 1)));
export const dormir = (env, ms) => (ms > 0 ? (env?.__pruebas?.dormir ? env.__pruebas.dormir(ms) : new Promise((r) => setTimeout(r, ms))) : null);
