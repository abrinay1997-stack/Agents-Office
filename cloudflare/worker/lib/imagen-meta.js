// El proxy de imágenes de Meta: la CSP de la oficina dice `img-src 'self' data: blob:` (la regla de oro: ningún host de terceros), así que una foto de perfil
// o una miniatura que Meta entrega como https://…fbcdn.net/… el navegador la bloquea. Aquí se baja UNA vez desde el Worker, se guarda en R2 y se sirve desde el mismo origen.
//  · SOLO hosts de la lista blanca de CDN de Meta (HOST_META), https, sin usuario ni clave ni puerto raro; cada redirección se vuelve a validar (no se sigue fuera de la lista).
//  · SOLO imágenes, reconocidas por sus primeros bytes (nunca por lo que diga Meta); un SVG, un HTML o cualquier otra cosa se rechaza; tope de 5 MB leyendo por flujo.
//  · La URL no se guarda ni se registra: una URL que lleve `access_token` se rechaza antes de salir a la red (nunca viajaría a Meta ni a un log), y las llamadas salen sin cabeceras ni cookies.
//  · Caché en R2 con clave = hash de host + ruta + los parámetros que NO son firma (la firma —oh, oe, _nc_*— caduca en días; la imagen no). Lo bajado se sirve aunque Meta ya no responda.
//    Límite honesto: la PRIMERA vez la URL tiene que seguir viva; si ya caducó y no hay copia, 404 (y el avatar vuelve a su inicial).
import { sha256 } from './ids.js';

export const HOST_META = /(^|\.)(fbcdn\.net|cdninstagram\.com|fbsbx\.com)$/i;
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECCIONES = 3;
export const RAIZ = 'contenido/imagen-meta/';
export const PEDIDOS_POR_MINUTO = 60; // bajadas NUEVAS por persona y minuto (servir lo ya guardado no cuenta)
const VOLATILES = new Set(['oh', 'oe', 'edm', 'ccb', '_nc_cat', '_nc_sid', '_nc_ohc', '_nc_ht', '_nc_gid', '_nc_zt', '_nc_oc', '_nc_eui2', '_nc_cid', '_nc_nc', 'bytestart', 'byteend', 'efg', 'se', 'sig', 'rl', 'vs']);
const PROHIBIDOS = /^(access_token|token|appsecret_proof|client_secret|code)$/i;

/** Valida una URL candidata. → { url: URL } | { error, estado } (nunca lanza). */
export function validarUrl(crudo) {
  const s = String(crudo ?? '').trim();
  if (!s || s.length > 2048) return { error: 'Falta la dirección de la imagen o es demasiado larga.', estado: 400 };
  let u; try { u = new URL(s); } catch { return { error: 'La dirección de la imagen no es válida.', estado: 400 }; }
  if (u.protocol !== 'https:') return { error: 'Solo se acepta https.', estado: 400 };
  if (u.username || u.password) return { error: 'La dirección no puede llevar usuario ni clave.', estado: 400 };
  if (u.port && u.port !== '443') return { error: 'Puerto no permitido.', estado: 400 };
  if (!HOST_META.test(u.hostname)) return { error: 'Solo se sirven imágenes de la red de Meta (fbcdn, cdninstagram, fbsbx).', estado: 403 };
  for (const k of u.searchParams.keys()) if (PROHIBIDOS.test(k)) return { error: 'La dirección lleva un token: no se usa.', estado: 400 };
  return { url: u };
}

/** La clave estable de una imagen: host + ruta + los parámetros que NO son firma. */
export async function claveDe(u) {
  const q = [...u.searchParams.entries()].filter(([k]) => !VOLATILES.has(k)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('&');
  return (await sha256(`${u.hostname.toLowerCase()}${u.pathname}?${q}`)).slice(0, 40);
}

/** El tipo de una imagen por sus primeros bytes. Un SVG, un HTML, un vídeo…: null. */
export function tipoDe(b) {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (u.length > 12 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return 'jpeg';
  if (u.length > 12 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return 'png';
  if (u.length > 12 && u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50) return 'webp';
  if (u.length > 10 && u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x38) return 'gif';
  return null;
}

async function leerConTope(res, max) {
  const decl = Number(res.headers.get('content-length')); if (decl > max) return null;
  if (!res.body) return null;
  const lector = res.body.getReader(), partes = []; let total = 0;
  for (;;) {
    const { done, value } = await lector.read(); if (done) break;
    total += value.length; if (total > max) { try { await lector.cancel(); } catch { /* ya cortado */ } return null; }
    partes.push(value);
  }
  const out = new Uint8Array(total); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}

/** Baja la imagen siguiendo a mano las redirecciones, cada una validada. → { bytes, tipo } | null */
export async function bajar(url, fetchFn = fetch) {
  let u = url;
  for (let i = 0; i <= MAX_REDIRECCIONES; i++) {
    let res;
    try { res = await fetchFn(u.toString(), { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { accept: 'image/*' }, signal: AbortSignal.timeout(8000) }); } catch { return null; }
    if (res.status >= 300 && res.status < 400) {
      const dest = res.headers.get('location'); if (!dest) return null;
      let sig; try { sig = new URL(dest, u); } catch { return null; }
      const v = validarUrl(sig.toString()); if (v.error) return null; // una redirección fuera de la lista blanca no se sigue
      u = v.url; continue;
    }
    if (!res.ok) return null;
    const bytes = await leerConTope(res, MAX_BYTES); if (!bytes || !bytes.length) return null;
    const tipo = tipoDe(bytes); if (!tipo) return null;
    return { bytes, tipo };
  }
  return null;
}

export const cabecerasDe = (tipo, etag) => ({ 'content-type': `image/${tipo}`, 'cache-control': 'private, max-age=86400', etag: `"${etag}"`, 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", 'cross-origin-resource-policy': 'same-origin' });
const EXT = ['jpeg', 'png', 'webp', 'gif'];

/** Sirve (o baja y guarda) la imagen de `crudo`. `cupo()` dice si cabe una bajada nueva. → { estado, tipo, bytes|cuerpo, etag } | { estado, error } */
export async function obtener({ crudo, bucket, fetchFn, cupo, ifNoneMatch }) {
  const v = validarUrl(crudo); if (v.error) return { estado: v.estado, error: v.error };
  const clave = await claveDe(v.url);
  if (ifNoneMatch && ifNoneMatch.replace(/^W\//, '').replace(/"/g, '') === clave && bucket) {
    for (const e of EXT) if (await bucket.head(`${RAIZ}${clave}.${e}`)) return { estado: 304, etag: clave };
  }
  if (bucket) for (const e of EXT) { const o = await bucket.get(`${RAIZ}${clave}.${e}`); if (o) return { estado: 200, tipo: e, cuerpo: o.body, etag: clave }; }
  if (cupo && !(await cupo())) return { estado: 429, error: 'Demasiadas imágenes nuevas en un minuto: espera un momento.' };
  const r = await bajar(v.url, fetchFn); if (!r) return { estado: 404, error: 'Imagen no disponible (Meta ya no la entrega, o no es una imagen).' };
  if (bucket) { try { await bucket.put(`${RAIZ}${clave}.${r.tipo}`, r.bytes, { httpMetadata: { contentType: `image/${r.tipo}` } }); } catch { /* sin copia: se sirve igual */ } }
  return { estado: 200, tipo: r.tipo, bytes: r.bytes, etag: clave };
}
