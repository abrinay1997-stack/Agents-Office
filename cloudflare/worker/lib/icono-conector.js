// ICO (pendiente de la Fase 5): el favicon de un conector que añade el usuario (el que no tiene logo en el registro cae hoy en un monograma).
// GET /api/icono-conector?host=<dominio> — mismo patrón y mismas protecciones que lib/imagen-meta.js:
//  · SOLO hosts de conectores ya guardados (no es un proxy abierto: el dominio se busca en `conectores_extra`/`conectores`); además pasa `urlPermitida` (https público, sin IP ni .local).
//  · Se pide SOLO `https://<host>/favicon.ico` en SU PROPIO dominio (nada de servicios de terceros que sabrían qué conectores usas); las redirecciones se siguen a mano, máximo 2,
//    y cada una vuelve a validarse (mismo dominio o subdominio del dominio registrado: nunca otro).
//  · Salen sin cookies ni cabeceras de autenticación (nunca el token del conector). Se aceptan PNG, ICO, JPEG, WebP y GIF reconocidos por sus bytes; un SVG se rechaza (puede llevar scripts);
//    tope de 128 KB leyendo por flujo. Copia en R2 (clave = hash del host); si no hay favicon, 404 y la tarjeta se queda con su monograma.
import { urlPermitida } from './conectores.js';
import { tipoDe as tipoImagen } from './imagen-meta.js';
import { sha256 } from './ids.js';

export const MAX_BYTES = 128 * 1024;
export const MAX_REDIRECCIONES = 2;
export const RAIZ = 'contenido/icono-conector/';
export const PEDIDOS_POR_MINUTO = 30; // bajadas NUEVAS por persona y minuto
const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon' };

/** Un host candidato: dominio completo, en minúsculas, que `urlPermitida` acepta. → { host } | { error, estado } */
export function validarHost(crudo) {
  const h = String(crudo ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!h || h.length > 253 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h)) return { error: 'El dominio no es válido.', estado: 400 };
  const malo = urlPermitida(`https://${h}/`);
  if (malo) return { error: `El dominio no es público: ${malo}.`, estado: 400 };
  return { host: h };
}

/** El tipo de un favicon por sus primeros bytes: imágenes de siempre o ICO (00 00 01 00). Un SVG, un HTML…: null. */
export function tipoDe(b) {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  if (u.length > 22 && u[0] === 0 && u[1] === 0 && u[2] === 1 && u[3] === 0 && u[4] > 0 && u[4] <= 32 && u[5] === 0) return 'ico';
  return tipoImagen(u);
}

/** ¿`destino` es el mismo dominio registrado o uno de sus subdominios? (una redirección a otro dominio no se sigue) */
export const mismoDominio = (destino, registrado) => destino === registrado || destino.endsWith(`.${registrado}`);

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

/** Baja `https://host/favicon.ico` con las redirecciones a mano. → { bytes, tipo } | null */
export async function bajar(host, fetchFn = fetch) {
  let u = new URL(`https://${host}/favicon.ico`);
  for (let i = 0; i <= MAX_REDIRECCIONES; i++) {
    let res;
    try { res = await fetchFn(u.toString(), { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { accept: 'image/*' }, signal: AbortSignal.timeout(6000) }); } catch { return null; }
    if (res.status >= 300 && res.status < 400) {
      const dest = res.headers.get('location'); if (!dest) return null;
      let sig; try { sig = new URL(dest, u); } catch { return null; }
      const h = validarHost(sig.hostname); if (h.error || sig.protocol !== 'https:' || sig.port || sig.username || sig.password || !mismoDominio(h.host, host)) return null;
      u = sig; continue;
    }
    if (!res.ok) return null;
    const bytes = await leerConTope(res, MAX_BYTES); if (!bytes || !bytes.length) return null;
    const tipo = tipoDe(bytes); if (!tipo) return null;
    return { bytes, tipo };
  }
  return null;
}

export const cabecerasDe = (tipo, etag) => ({ 'content-type': MIME[tipo], 'cache-control': 'private, max-age=86400', etag: `"${etag}"`, 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", 'cross-origin-resource-policy': 'same-origin' });

/** Los dominios de los conectores guardados (la lista blanca). */
export async function hostsRegistrados(db) {
  const { results } = await db.prepare('select url from conectores').all();
  const hs = new Set();
  for (const f of results || []) { try { hs.add(new URL(f.url).hostname.toLowerCase().replace(/\.$/, '')); } catch { /* fila rara: se ignora */ } }
  return hs;
}

/** Sirve (o baja y guarda) el favicon de `crudo`. `registrados` = Set de hosts de conectores. → { estado, tipo, bytes|cuerpo, etag } | { estado, error } */
export async function obtener({ crudo, registrados, bucket, fetchFn, cupo, ifNoneMatch }) {
  const v = validarHost(crudo); if (v.error) return { estado: v.estado, error: v.error };
  if (!registrados.has(v.host)) return { estado: 403, error: 'Solo se sirve el icono de los conectores que ya están añadidos.' };
  const clave = (await sha256(v.host)).slice(0, 40);
  const EXT = Object.keys(MIME);
  if (ifNoneMatch && ifNoneMatch.replace(/^W\//, '').replace(/"/g, '') === clave && bucket) {
    for (const e of EXT) if (await bucket.head(`${RAIZ}${clave}.${e}`)) return { estado: 304, etag: clave };
  }
  if (bucket) for (const e of EXT) { const o = await bucket.get(`${RAIZ}${clave}.${e}`); if (o) return { estado: 200, tipo: e, cuerpo: o.body, etag: clave }; }
  if (cupo && !(await cupo())) return { estado: 429, error: 'Demasiados iconos nuevos en un minuto: espera un momento.' };
  const r = await bajar(v.host, fetchFn); if (!r) return { estado: 404, error: 'Ese sitio no tiene un icono que se pueda usar.' };
  if (bucket) { try { await bucket.put(`${RAIZ}${clave}.${r.tipo}`, r.bytes, { httpMetadata: { contentType: MIME[r.tipo] } }); } catch { /* sin copia: se sirve igual */ } }
  return { estado: 200, tipo: r.tipo, bytes: r.bytes, etag: clave };
}
