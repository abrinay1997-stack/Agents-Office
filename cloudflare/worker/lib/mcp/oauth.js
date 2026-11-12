// OAuth 2.1 del conector MCP (P2): metadatos (RFC 8414 y 9728), registro dinámico de clientes (RFC 7591) y el endpoint del token (código + PKCE S256, y renovación rotada).
// La pantalla de permiso (el único paso con una persona) vive en permiso.js. Todo lo de aquí se llama SIN cookie: por eso lleva CORS y no mira el Origin.
import { sha256, testigo, igualSeguro } from '../ids.js';
import { tasa, ipDe } from '../equipo.js';
import { origenMcp, urlMcp, ALCANCES, VIDA_CODIGO_MS, TOPE_CUERPO_OAUTH, MAX_REGISTROS_HORA, MAX_REGISTROS_MINUTO_IP, MAX_REGISTROS_HORA_IP, ahoraMs as reloj } from './config.js';
import { emitir, renovar, personaActual, revocarFamilia, nuevaFamilia } from './tokens.js';
import { auditar } from './auditoria.js';

const JSON_NOCACHE = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', pragma: 'no-cache', 'x-content-type-options': 'nosniff' };
export const jsonOAuth = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: JSON_NOCACHE });
const errOAuth = (error, descripcion, estado = 400) => jsonOAuth({ error, error_description: descripcion }, estado);

/* ---------- metadatos ---------- */
export const metadatosServidor = (env) => ({
  issuer: origenMcp(env),
  authorization_endpoint: `${origenMcp(env)}/oauth/authorize`,
  token_endpoint: `${origenMcp(env)}/oauth/token`,
  registration_endpoint: `${origenMcp(env)}/oauth/register`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'], // PKCE S256 OBLIGATORIO: no se admite `plain` ni su ausencia
  token_endpoint_auth_methods_supported: ['none'], // clientes públicos
  revocation_endpoint: `${origenMcp(env)}/oauth/revoke`,
  scopes_supported: [...ALCANCES],
});
export const metadatosRecurso = (env) => ({
  resource: urlMcp(env),
  authorization_servers: [origenMcp(env)],
  bearer_methods_supported: ['header'],
  scopes_supported: [...ALCANCES],
  resource_name: 'Agents Office',
});

/* ---------- redirect_uri: lista CERRADA ---------- */
const FIJAS = new Set(['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback']);
const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1)(:(\d{1,5}))?(\/[^\s#?]*)?(\?[^\s#]*)?$/; // Claude Code y Claude Desktop escuchan en un puerto local cualquiera
export function redirectUriPermitida(uri) {
  if (typeof uri !== 'string' || uri.length > 300) return false;
  if (FIJAS.has(uri)) return true;
  const m = LOOPBACK.exec(uri);
  if (!m) return false;
  if (m[3] !== undefined && (Number(m[3]) < 1 || Number(m[3]) > 65535)) return false;
  try { const u = new URL(uri); return !u.username && !u.password && !u.hash && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'); } catch { return false; }
}
/** El nombre que se enseña en la pantalla de permiso: una línea, sin controles, corto. Se escapa al pintarlo. */
export const nombreDeCliente = (n) => String(n ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Claude';

async function leerCuerpo(req) {
  const largo = Number(req.headers.get('content-length') || 0);
  if (largo > TOPE_CUERPO_OAUTH) return null;
  const t = await req.text();
  if (t.length > TOPE_CUERPO_OAUTH) return null;
  const tipo = req.headers.get('content-type') || '';
  if (/application\/x-www-form-urlencoded/i.test(tipo)) return Object.fromEntries(new URLSearchParams(t));
  try { const j = JSON.parse(t); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch { return null; }
}

/* ---------- registro dinámico (RFC 7591) ---------- */
export async function registrar(db, env, req) {
  const ms = reloj(env);
  if (!(await tasa(db, 'mcp:reg:' + ipDe(req), MAX_REGISTROS_MINUTO_IP, ms)).ok) return errOAuth('temporarily_unavailable', 'Demasiados registros desde aquí. Espera un minuto.', 429);
  const ip = await sha256('mcp-ip:' + ipDe(req));
  const porIp = (await db.prepare('select count(*) n from mcp_clientes where ip_huella = ? and creado_at > ?').bind(ip, ms - 3600_000).first())?.n ?? 0;
  if (porIp >= MAX_REGISTROS_HORA_IP) return errOAuth('temporarily_unavailable', 'Se registraron demasiadas aplicaciones desde aquí en la última hora.', 429);
  const recientes = (await db.prepare('select count(*) n from mcp_clientes where creado_at > ?').bind(ms - 3600_000).first())?.n ?? 0;
  if (recientes >= MAX_REGISTROS_HORA) return errOAuth('temporarily_unavailable', 'Se registraron demasiadas aplicaciones en la última hora. Vuelve a intentarlo más tarde.', 429);
  const b = await leerCuerpo(req);
  if (!b) return errOAuth('invalid_client_metadata', 'El registro debe ser un JSON pequeño.');
  const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
  if (!uris.length || uris.length > 5) return errOAuth('invalid_redirect_uri', 'Manda entre 1 y 5 redirect_uris.');
  const mala = uris.find((u) => !redirectUriPermitida(u));
  if (mala !== undefined) return errOAuth('invalid_redirect_uri', 'Esa dirección de vuelta no está permitida: solo claude.ai, claude.com o localhost.');
  const id = 'mcp_' + testigo(16), nombre = nombreDeCliente(b.client_name);
  await db.prepare('insert into mcp_clientes (client_id, nombre, redirect_uris, creado_at, ip_huella) values (?,?,?,?,?)').bind(id, nombre, JSON.stringify([...new Set(uris)]), ms, ip).run();
  return jsonOAuth({ client_id: id, client_name: nombre, redirect_uris: [...new Set(uris)], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', client_id_issued_at: Math.floor(ms / 1000) }, 201);
}
export async function clienteDe(db, clientId) {
  if (typeof clientId !== 'string' || !/^mcp_[0-9a-f]{32}$/.test(clientId)) return null;
  const f = await db.prepare('select client_id, nombre, redirect_uris from mcp_clientes where client_id = ?').bind(clientId).first();
  if (!f) return null;
  let uris = []; try { uris = JSON.parse(f.redirect_uris); } catch { /* fila rara: sin direcciones, no sirve */ }
  return { id: f.client_id, nombre: f.nombre, redirectUris: Array.isArray(uris) ? uris.filter(redirectUriPermitida) : [] };
}

/* ---------- PKCE ---------- */
export const RETO_VALIDO = /^[A-Za-z0-9_-]{43,128}$/;
const b64url = (buf) => { let s = ''; for (const x of new Uint8Array(buf)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
/** ¿El verificador corresponde al reto? (S256; comparación en tiempo constante). */
export async function pkceValido(verificador, reto) {
  if (typeof verificador !== 'string' || !RETO_VALIDO.test(verificador) || typeof reto !== 'string') return false;
  return igualSeguro(b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))), reto);
}

/* ---------- el código de autorización (lo emite la pantalla de permiso) ---------- */
export async function crearCodigo(db, { cliente, userId, redirectUri, reto, alcance, nombre, ms }) {
  const codigo = testigo(32);
  await db.prepare('insert into mcp_codigos (codigo_hash, client_id, user_id, redirect_uri, code_challenge, alcance, nombre, familia, caduca_at) values (?,?,?,?,?,?,?,?,?)')
    .bind(await sha256(codigo), cliente.id, userId, redirectUri, reto, alcance, String(nombre).slice(0, 60), nuevaFamilia(), ms + VIDA_CODIGO_MS).run();
  return codigo;
}

/* ---------- /oauth/token ---------- */
export async function token(db, env, req) {
  const ms = reloj(env);
  if (!(await tasa(db, 'mcp:tok:' + ipDe(req), 60, ms)).ok) return errOAuth('temporarily_unavailable', 'Demasiados intentos. Espera un minuto.', 429);
  const b = await leerCuerpo(req);
  if (!b) return errOAuth('invalid_request', 'La petición debe ser un formulario o un JSON pequeño.');
  const cliente = await clienteDe(db, b.client_id);
  if (!cliente) return errOAuth('invalid_client', 'Esa aplicación no está registrada.', 401);
  if (b.grant_type === 'authorization_code') return canjearCodigo(db, ms, cliente, b);
  if (b.grant_type === 'refresh_token') return renovarToken(db, ms, cliente, b);
  return errOAuth('unsupported_grant_type', 'Solo authorization_code y refresh_token.');
}

const respuestaToken = (t, alcance) => jsonOAuth({ access_token: t.access, token_type: 'Bearer', expires_in: t.expires_in, refresh_token: t.refresh, scope: alcance });

async function canjearCodigo(db, ms, cliente, b) {
  const MALO = (d = 'Ese código no sirve: ya se usó, caducó o no corresponde.') => errOAuth('invalid_grant', d);
  if (typeof b.code !== 'string' || !/^[0-9a-f]{64}$/.test(b.code)) return MALO();
  const hash = await sha256(b.code);
  const c = await db.prepare('select * from mcp_codigos where codigo_hash = ?').bind(hash).first();
  if (!c || c.client_id !== cliente.id) return MALO(); // el código de OTRA aplicación no se toca (ni se corta lo que nació de él)
  if (c.usado_at) { await revocarFamilia(db, c.familia, ms); return MALO(); } // un código reutilizado: lo que nació de él se corta
  // El código se gasta ANTES de comprobar nada más: de un solo uso aunque la comprobación falle (quien lo robó no lo prueba otra vez).
  const gasto = await db.prepare('update mcp_codigos set usado_at = ? where codigo_hash = ? and usado_at is null and caduca_at > ?').bind(ms, hash, ms).run();
  if (!(gasto.meta?.changes > 0)) return MALO();
  if (b.redirect_uri !== c.redirect_uri) return MALO();
  if (!(await pkceValido(b.code_verifier, c.code_challenge))) return MALO('El verificador PKCE no corresponde.');
  const usuario = await personaActual(db, c.user_id);
  if (!usuario || usuario.rol !== 'admin') { await auditar(db, ms, usuario?.email, { evento: 'token-negado', motivo: 'no-admin', cliente: cliente.nombre }); return errOAuth('access_denied', 'Solo un administrador puede conectar Claude con la oficina.', 403); }
  const t = await emitir(db, { familia: c.familia, familiaCreada: ms, clienteId: cliente.id, userId: usuario.id, rol: usuario.rol, alcance: c.alcance, nombre: c.nombre, ahoraMs: ms });
  if (!t) return MALO();
  await db.prepare('update mcp_clientes set ultimo_uso_at = ? where client_id = ?').bind(ms, cliente.id).run();
  await auditar(db, ms, usuario.email, { evento: 'token', conexion: c.familia, cliente: cliente.nombre, alcance: c.alcance });
  return respuestaToken(t, c.alcance);
}

async function renovarToken(db, ms, cliente, b) {
  const r = await renovar(db, b.refresh_token, cliente.id, ms);
  if (!r.ok) {
    if (r.reuso) await auditar(db, ms, 'desconocido', { evento: 'renovacion-reusada', cliente: cliente.nombre, corto: 'toda la conexión' });
    return errOAuth('invalid_grant', 'Ese testigo de renovación no sirve (ya se usó, caducó o la conexión se cortó). Vuelve a conectar.');
  }
  await db.prepare('update mcp_clientes set ultimo_uso_at = ? where client_id = ?').bind(ms, cliente.id).run();
  return respuestaToken(r, r.alcance);
}

/* ---------- /oauth/revoke (RFC 7009): quien conectó puede cortar su propia conexión con su testigo ---------- */
export async function revocar(db, env, req) {
  const ms = reloj(env);
  if (!(await tasa(db, 'mcp:rev:' + ipDe(req), 60, ms)).ok) return errOAuth('temporarily_unavailable', 'Demasiados intentos. Espera un minuto.', 429);
  const b = await leerCuerpo(req);
  if (!b) return errOAuth('invalid_request', 'La petición debe ser un formulario o un JSON pequeño.');
  const cliente = await clienteDe(db, b.client_id);
  if (!cliente) return errOAuth('invalid_client', 'Esa aplicación no está registrada.', 401);
  if (typeof b.token === 'string' && /^mcp[ar]_[0-9a-f]{64}$/.test(b.token)) {
    const h = await sha256(b.token);
    const f = await db.prepare('select familia, client_id from mcp_tokens where access_hash = ? or refresh_hash = ?').bind(h, h).first();
    if (f && f.client_id === cliente.id) { await revocarFamilia(db, f.familia, ms); await auditar(db, ms, 'cliente', { evento: 'revocado-por-el-cliente', conexion: f.familia, cliente: cliente.nombre }); }
  }
  return jsonOAuth({}); // RFC 7009: siempre 200, exista o no el testigo
}
