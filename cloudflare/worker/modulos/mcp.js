// El conector MCP remoto (P2 del plan docs/plan-mcp-oficina-panaclaw.md). Dos mitades:
//  · `publicaMcp(req, env)`: lo que se contesta SIN la cookie de la oficina — /mcp, /oauth/*, /.well-known/oauth-* y /conectar-claude (que pide la sesión él mismo). Lo llama lib/rutas.js ANTES de la regla
//    «nada sale sin sesión»: son excepciones EXPLÍCITAS y una prueba (mcp-rutas-publicas.test.mjs) comprueba que solo son estas. Con el interruptor `mcp.activo` apagado, o por otro host que HOST_MCP, todas dan 404.
//  · `manejar(ctx)`: /api/conectar-claude/* — la lista de conexiones y el botón de cortarlas (Ajustes → «Conectar Claude»). SOLO administradores; el rol se mira antes que la ruta.
// Las herramientas de dominio NO van aquí: cada carril añade su archivo en lib/mcp/dominios/.
import { json, error, prohibido } from '../lib/respuesta.js';
import { hostValido, mcpActivo, plano, conCors, urlMcp, hostMcp, ALCANCES, ahoraMs as reloj } from '../lib/mcp/config.js';
import { metadatosServidor, metadatosRecurso, registrar, token, jsonOAuth } from '../lib/mcp/oauth.js';
import { permiso } from '../lib/mcp/permiso.js';
import { manejarMcp } from '../lib/mcp/servidor.js';
import { listar, revocarFamilia, revocarTodas } from '../lib/mcp/tokens.js';
import { auditar } from '../lib/mcp/auditoria.js';

export const nombre = 'mcp';
export const grupos = ['conectar-claude'];

/** ¿Esta ruta es de las públicas del conector? (lib/rutas.js la llama antes de nada; un test la compara con la lista de excepciones). */
export const RUTAS_PUBLICAS_MCP = Object.freeze(['/mcp', '/oauth/register', '/oauth/authorize', '/oauth/token', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp', '/conectar-claude']);
const esPublica = (p) => RUTAS_PUBLICAS_MCP.includes(p.replace(/\/+$/, '') || '/');

export async function publicaMcp(req, env) {
  const url = new URL(req.url), p = url.pathname.replace(/\/+$/, '') || '/';
  if (!esPublica(p)) return null;
  if (!hostValido(req, env)) return plano('No encontrado', 404); // ni un segundo issuer desde workers.dev
  const db = env.DB;
  if (!(await mcpActivo(db))) return plano('No encontrado', 404); // apagado, el conector no existe
  if (p === '/conectar-claude') return permiso(req, env, db);
  if (req.method === 'OPTIONS') return conCors(new Response(null, { status: 204 }));
  if (p === '/mcp') return manejarMcp(req, env, db);
  const solo = (metodo, hacer) => (req.method === metodo ? hacer() : conCors(plano('Método no permitido', 405, { allow: `${metodo}, OPTIONS` })));
  if (p === '/.well-known/oauth-authorization-server') return solo('GET', () => conCors(jsonOAuth(metadatosServidor(env))));
  if (p === '/.well-known/oauth-protected-resource' || p === '/.well-known/oauth-protected-resource/mcp') return solo('GET', () => conCors(jsonOAuth(metadatosRecurso(env))));
  if (p === '/oauth/register') return solo('POST', async () => conCors(await registrar(db, env, req)));
  if (p === '/oauth/token') return solo('POST', async () => conCors(await token(db, env, req)));
  if (p === '/oauth/authorize') return solo('GET', () => new Response(null, { status: 302, headers: { location: '/conectar-claude' + url.search, 'cache-control': 'no-store' } }));
  return null;
}

/** Ajustes → «Conectar Claude»: lista de conexiones y cortarlas. */
export async function manejar(ctx) {
  const { req, db, env, ruta, usuario } = ctx;
  if (ruta !== '/api/conectar-claude' && !ruta.startsWith('/api/conectar-claude/')) return null;
  if (usuario.rol !== 'admin' || usuario.agente) return prohibido('Solo un administrador ve y corta las conexiones de Claude.'); // el rol, ANTES que la ruta o el cuerpo
  const ms = reloj(env);
  if (ruta === '/api/conectar-claude' && req.method === 'GET') return json({ activo: await mcpActivo(db), url: urlMcp(env), host: hostMcp(env), alcances: ALCANCES, conexiones: await listar(db, ms) });
  if (ruta === '/api/conectar-claude/cortar-todas' && req.method === 'POST') {
    const n = await revocarTodas(db, ms);
    await auditar(db, ms, usuario.email, { evento: 'cortar-todas', testigos: n });
    return json({ ok: true, cortadas: n, conexiones: await listar(db, ms) });
  }
  const m = ruta.match(/^\/api\/conectar-claude\/([0-9a-f]{32})$/);
  if (m && req.method === 'DELETE') {
    const n = await revocarFamilia(db, m[1], ms);
    if (!n) return error('Esa conexión no existe o ya estaba cortada.', 404);
    await auditar(db, ms, usuario.email, { evento: 'cortar', conexion: m[1] });
    return json({ ok: true, conexiones: await listar(db, ms) });
  }
  return error('Método no permitido', 405);
}
