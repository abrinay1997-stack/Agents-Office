// El conector MCP remoto (P2): constantes, el host canónico, el interruptor general y el reloj.
// UN solo issuer: el host sale de la variable HOST_MCP (por defecto oficina.panaclaw.com). Una petición que llega por OTRO host (workers.dev) no ve nada del conector:
// los metadatos y las direcciones solo existen en el host canónico, así no hay dos issuers.
import { leerDoc } from '../almacen.js';

export const HOST_POR_DEFECTO = 'oficina.panaclaw.com';
export const DOC_CONFIG = 'mcp.config'; // { activo: true } — el interruptor general (funciones-core.mjs → «mcp»); APAGADO por defecto: solo `=== true` lo enciende
export const VERSION_SERVIDOR = '0.1.0';

export * from './constantes.js';

export const hostMcp = (env) => String(env?.HOST_MCP || HOST_POR_DEFECTO).trim().toLowerCase();
export const origenMcp = (env) => `https://${hostMcp(env)}`;
export const urlMcp = (env) => `${origenMcp(env)}/mcp`;
/** ¿La petición llegó por el host canónico? (con puerto si lo lleva: HOST_MCP puede ser «127.0.0.1:8787» en una prueba local). */
export const hostValido = (req, env) => new URL(req.url).host.toLowerCase() === hostMcp(env);

/** El reloj: `env.RELOJ_MS` solo lo pone una prueba (así ninguna prueba depende de la hora de verdad). */
export const ahoraMs = (env) => (typeof env?.RELOJ_MS === 'function' ? env.RELOJ_MS() : Date.now());

/** ¿Está encendido el conector? Una lectura de D1 por petición; solo `=== true` enciende. Si no se puede leer, APAGADO (falla cerrado). */
export async function mcpActivo(db) {
  try { return (await leerDoc(db, DOC_CONFIG, {})).valor?.activo === true; } catch { return false; }
}

/** Una respuesta de texto plano (404 mudo, 405…) con las cabeceras de siempre. */
export const plano = (texto, estado, extra = {}) => new Response(texto, { status: estado, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra } });

/** CORS: solo en lo que se llama SIN cookie (metadatos, registro, token, /mcp con su Bearer). Nunca en /conectar-claude (ese lleva la sesión). */
export const CORS = Object.freeze({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
  'access-control-expose-headers': 'WWW-Authenticate',
  'access-control-max-age': '600',
});
export const conCors = (resp) => { const h = new Headers(resp.headers); for (const [k, v] of Object.entries(CORS)) h.set(k, v); return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h }); };
