// Ayudas comunes de los dominios de la EMPRESA del conector MCP (carril P5 «empresa», 12 nov 2026): la oficina en proceso con una lista blanca de rutas, los fallos esperados como texto,
// la idempotencia y, sobre todo, que NINGÚN secreto salga: una clave que suene a secreto se oculta, un correo ajeno se acorta y todo texto pasa por limpiarSecretos.
import { restringir } from '../capa1/restringir.js';
import { conIdempotencia } from '../capa1/idempotencia.js';
import { limpiarSecretos } from '../../secretos.js';
import { injectionIn } from '../../../../../safety.mjs';
import { emitirAviso } from '../../avisos.js';

/** `permitidas`: 'GET' o 'POST /api/ruta' (ver capa1/restringir.js). */
export async function conOficina(ctx, permitidas) {
  const { crearOficinaMcp } = await import('../capa1/oficina.js');
  return restringir(await crearOficinaMcp({ env: ctx.env, db: ctx.db, usuario: ctx.usuario, ahoraMs: ctx.ahoraMs }), permitidas);
}
/** Un fallo esperado vuelve como texto claro y marcado; lo inesperado, además, se registra. Nunca lleva un secreto. */
export function fallo(nombre, e) {
  console.error(`[mcp:empresa] ${nombre}:`, e?.message ?? e);
  return { texto: `No se pudo: ${limpiarSecretos(String(e?.message || e)).replace(/\s+/g, ' ').slice(0, 300)}`, esError: true };
}
export const rechazo = (texto) => ({ texto, esError: true });
/** Como capa1: la misma clave no repite el efecto. Un RECHAZO (`esError`) no se recuerda como «hecho»: la clave se suelta para poder reintentar con otros datos. */
export async function idem(ctx, herramienta, fn) {
  try {
    return await conIdempotencia(ctx.db, { conexionId: ctx.conexion.id, herramienta, clave: ctx.claveIdempotencia, ms: ctx.ahoraMs, fn: async () => { const r = await fn(); if (r?.esError) throw Object.assign(new Error(r.texto), { rechazo: true }); return r; } });
  } catch (e) { if (e?.rechazo) return rechazo(e.message); throw e; }
}

const SECRETO = /(token|secret|secreto|clave|password|contrasen|llave|api[_-]?key|authorization|cifrad|credencial|bearer)/i;
/** Una línea, sin controles, acotada y sin secretos. */
const ch = (n) => String.fromCharCode(n);
const INVISIBLES = new RegExp(`[${ch(0)}-${ch(31)}${ch(127)}${ch(0x2028)}${ch(0x2029)}${ch(0x200b)}-${ch(0x200f)}${ch(0x202a)}-${ch(0x202e)}${ch(0x2066)}-${ch(0x2069)}]+`, 'g');
export const limpio = (v, max = 120) => limpiarSecretos(String(v ?? '').replace(INVISIBLES, ' ').replace(/\s+/g, ' ').trim()).slice(0, max);
/** «an***@dominio.com»: de otra persona se ve quién es, no la dirección entera. */
export function correoCorto(email) {
  const [u, d] = String(email || '').split('@');
  return d ? `${(u || '').slice(0, 2)}***@${d}` : '';
}
/** Copia profunda sin secretos: una clave que suena a secreto con valor de texto se tapa; los booleanos (`tokenGuardado: true`) se dejan, dicen «está puesto» y no el valor. */
export function sinSecretos(x, prof = 0) {
  if (prof > 6) return '…';
  if (Array.isArray(x)) return x.slice(0, 200).map((v) => sinSecretos(v, prof + 1));
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, SECRETO.test(k) && typeof v !== 'boolean' && v != null ? '«oculto»' : sinSecretos(v, prof + 1)]));
  return typeof x === 'string' ? limpiarSecretos(x) : x;
}
export const num = (v) => (v != null && v !== '' && Number.isFinite(+v) ? +v : null);
export const cifra = (v) => { const n = num(v); return n == null ? 'sin dato' : String(Math.round(n * 100) / 100); };
export const usd = (v) => { const n = num(v); return n == null ? 'sin dato' : `US$${n.toFixed(2)}`; };
export const lineas = (xs, max) => (xs.length > max ? [...xs.slice(0, max), `… y ${xs.length - max} más`] : xs);

/** Texto de un tercero (un servidor externo, un conector, algo que escribió otra persona): una línea y, si trae órdenes escondidas, se omite. */
export const OMITIDO = '[texto omitido: parece contener órdenes]';
export const externo = (v, max = 120) => { const t = limpio(v, max); return t && injectionIn(t) ? OMITIDO : t; };
/** ¿Este texto que va a ESCRIBIRSE trae órdenes escondidas? (para rechazarlo, no para taparlo) */
export const traeOrdenes = (v) => !!injectionIn(String(v ?? ''));
/** Un aviso a la oficina (lo ve el dueño en los avisos y, si está configurado, por Telegram) cuando por MCP se SUBE o QUITA un tope, una cifra o un modelo más caro: antes → ahora y qué conexión. Nunca tumba la acción. */
export async function avisarCambio(ctx, que, antes, despues) {
  try {
    const quien = limpio(ctx.conexion?.nombre || 'una conexión', 60);
    await emitirAviso(ctx.db, { kind: 'mcp-cambio', level: 'warn', text: `Por el conector MCP (conexión «${quien}») se aflojó: ${que}: de ${limpio(antes, 60)} a ${limpio(despues, 60)}. Si no lo pediste tú, corta esa conexión en Ajustes → Conectar Claude.`,
      key: `mcp-cambio:${que}:${despues}:${Math.floor(ctx.ahoraMs / 60000)}` }, { ahora: ctx.ahoraMs });
    return true;
  } catch (e) { console.warn('[mcp:empresa] no se pudo dejar el aviso:', e?.message ?? e); return false; }
}
