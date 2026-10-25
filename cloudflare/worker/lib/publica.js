// Lo común de las rutas PÚBLICAS (los webhooks de otros sistemas): el secreto se comprueba ANTES de abrir nada, el cuerpo tiene tope, y hay un tope de peticiones por minuto
// contado en D1 (el Worker no recuerda entre peticiones). Un token malo nunca toca D1 ni lee el cuerpo.
import { igualSeguro } from './ids.js';

export const TOPE_CUERPO = 1_000_000; // 1 MB, como serve.mjs → hookIn
/** El secreto debe ser de 16+ caracteres (si no, la oficina "no acepta webhooks") y coincidir en tiempo constante. */
export function tokenValido(dado, esperado) {
  const e = String(esperado ?? ''); if (e.length < 16) return false;
  return typeof dado === 'string' && dado.length > 0 && igualSeguro(dado, e);
}
/** El token como lo manda cada sistema: cabecera X-Office-Token, `Authorization: Bearer …` o `?token=` (esta última deja el secreto en los registros de quien envía: se acepta por compatibilidad). */
export function tokenDe(req, url) {
  return req.headers.get('x-office-token') || String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url?.searchParams?.get('token') || '';
}
/** Cuenta ESTA petición en el minuto actual de `clave`. → { ok, n } (ok = cabe en `max`). */
export async function tasaPublica(db, clave, max, ahora = Date.now()) {
  const ventana = Math.floor(ahora / 60e3);
  await db.prepare('delete from publica_tasa where ventana < ?').bind(ventana - 5).run();
  const f = await db.prepare('insert into publica_tasa (clave, ventana, n) values (?,?,1) on conflict (clave, ventana) do update set n = n + 1 returning n').bind(String(clave).slice(0, 80), ventana).first();
  const n = Number(f?.n ?? 1);
  return { ok: n <= max, n };
}
/** Lee el cuerpo con tope: devuelve el texto, o null si pasa de `tope` (se corta sin leer el resto). */
export async function leerConTope(req, tope = TOPE_CUERPO) {
  const largo = Number(req.headers.get('content-length') || 0);
  if (largo > tope) return null;
  if (!req.body) return '';
  const lector = req.body.getReader(), partes = []; let n = 0;
  for (;;) {
    const { done, value } = await lector.read(); if (done) break;
    n += value.length; if (n > tope) { try { await lector.cancel(); } catch { /* ya está */ } return null; }
    partes.push(value);
  }
  const todo = new Uint8Array(n); let o = 0; for (const p of partes) { todo.set(p, o); o += p.length; }
  return new TextDecoder().decode(todo);
}

/* ---------- firmas de quien llama (Stripe, WhatsApp): el secreto propio de cada sistema, nunca el token de la oficina ---------- */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmacHex(secreto, texto) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secreto)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto)));
}
export const TOLERANCIA_STRIPE_S = 300;
/** `Stripe-Signature: t=<segundos>,v1=<hex>[,v1=…]` — firma de `${t}.${cuerpo}` con el secreto del endpoint. Un timestamp fuera de 5 min se rechaza (un reenvío viejo). */
export async function firmaStripeValida(cuerpo, cabecera, secreto, ahora = Date.now()) {
  if (String(secreto || '').length < 16 || !cabecera) return false;
  const partes = String(cabecera).split(',').map((p) => p.trim().split('='));
  const t = Number((partes.find(([k]) => k === 't') || [])[1]);
  if (!Number.isFinite(t) || Math.abs(ahora / 1000 - t) > TOLERANCIA_STRIPE_S) return false;
  const esperada = await hmacHex(secreto, `${t}.${cuerpo}`);
  return partes.some(([k, v]) => k === 'v1' && typeof v === 'string' && igualSeguro(v, esperada));
}
/** `X-Hub-Signature-256: sha256=<hex>` — HMAC del cuerpo crudo con el secreto de la app de Meta. */
export async function firmaHubValida(cuerpo, cabecera, secreto) {
  if (String(secreto || '').length < 16 || !cabecera) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(String(cabecera).trim()); if (!m) return false;
  return igualSeguro(m[1].toLowerCase(), await hmacHex(secreto, cuerpo));
}
/** El token SOLO por cabecera (X-Office-Token o Bearer): una dirección con el token queda en los registros de quien envía. */
export const tokenDeCabecera = (req) => req.headers.get('x-office-token') || String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || '';
