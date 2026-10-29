// SEG-06 · retroceso creciente por correo en el acceso, SOLO con el flag `acceso.retroceso` (config-local) encendido. Apagado, el acceso es el de siempre.
//  · cuenta los FALLOS por correo en total, de cualquier IP (ventanas de 15 min; la actual y la anterior). Lo guarda en `acceso_intentos` (efímera), una escritura por fallo;
//  · pasados 3 fallos, CADA intento de ese correo (bueno o malo) espera 1 s, 2 s, 4 s… hasta 30 s antes de contestar. Retrasa, NUNCA rechaza por este contador: quien tiene la contraseña correcta
//    entra siempre, aunque otros hayan fallado mil veces con su correo (el bloqueo por correo era justo lo que `rutas.js` evita: permitía dejar fuera a la víctima);
//  · esperar antes de contestar a todos por igual también esconde si la contraseña era buena. Los topes por IP de siempre siguen. Sin Turnstile (la CSP no admite hosts de terceros).
import { leerDoc } from './almacen.js';

export const VENTANA_MS = 15 * 60e3, GRATIS = 3, ESPERA_MAX_MS = 30_000;
const TTL_MS = 10_000, cache = new WeakMap();
export async function retrocesoActivo(db) {
  const c = cache.get(db), t = Date.now();
  if (c && t - c.t < TTL_MS) return c.v;
  let v = false;
  try { v = (await leerDoc(db, 'config-local', {})).valor?.acceso?.retroceso === true; } catch { v = false; }
  cache.set(db, { v, t });
  return v;
}
export const olvidarRetroceso = (db) => cache.delete(db);
const cubo = (ms) => (Math.floor(ms / VENTANA_MS) + 1) * (VENTANA_MS / 60e3); // el minuto en que acaba la ventana: la poda por minuto de `tasa` no la borra antes de tiempo
const clave = (email) => 'acc:mail:' + String(email ?? '').trim().toLowerCase().slice(0, 120);

/** Fallos recientes de este correo (ventana actual + anterior), sin contar el intento de ahora. Si la lectura falla: 0 (el acceso no depende de este contador). */
export async function fallosDe(db, email, ms) {
  try {
    const a = cubo(ms), r = await db.prepare('select coalesce(sum(n), 0) as n from acceso_intentos where clave = ? and ventana in (?, ?)').bind(clave(email), a, a - VENTANA_MS / 60e3).first();
    return Number(r?.n ?? 0);
  } catch { return 0; }
}
export async function anotarFallo(db, email, ms) {
  try { await db.prepare('insert into acceso_intentos (clave, ventana, n) values (?,?,1) on conflict (clave, ventana) do update set n = n + 1').bind(clave(email), cubo(ms)).run(); } catch { /* anotar no tumba el acceso */ }
}
/** Espera (ms) para quien llega con `fallos` previos: 0 hasta 3; después 1 s, 2 s, 4 s… con tope de 30 s. */
export const esperaMs = (fallos) => (fallos <= GRATIS ? 0 : Math.min(ESPERA_MAX_MS, 1000 * 2 ** (fallos - GRATIS - 1)));
export const dormir = (env, ms) => (ms > 0 ? (env?.__pruebas?.dormir ? env.__pruebas.dormir(ms) : new Promise((r) => setTimeout(r, ms))) : null);
