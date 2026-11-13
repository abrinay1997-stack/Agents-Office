// Ayudas de las pruebas del conector MCP (P2): una oficina de mentira (D1 en memoria con las migraciones reales), un reloj que SOLO avanza cuando la prueba lo dice (ninguna depende de la hora de verdad),
// el baile OAuth completo y llamadas JSON-RPC. Ningún testigo se imprime.
import { crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { guardarDoc } from '../worker/lib/almacen.js';

export const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
export const b64url = (buf) => { let s = ''; for (const x of new Uint8Array(buf)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export async function pkce() {
  const verificador = b64url(crypto.getRandomValues(new Uint8Array(48)));
  return { verificador, reto: b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))) };
}

export async function mundo({ activo = true, extraEnv = {} } = {}) {
  const d1 = crearD1(); let t = Date.UTC(2031, 0, 1, 12, 0, 0);
  const env = envDePrueba(d1, { HOST_MCP: 'oficina.test', RELOJ_MS: () => t, ...extraEnv });
  const cuentas = { admin: await sembrar(d1), editor: await sembrar(d1, { email: 'ed@panaclaw.test', rol: 'editor' }), lectura: await sembrar(d1, { email: 'le@panaclaw.test', rol: 'lectura' }) };
  const db = d1._db;
  const cookies = {};
  const crudo = (ruta, { metodo = 'GET', cuerpo, cookie, cabeceras = {}, form, host = 'oficina.test' } = {}) => {
    const h = { ...cabeceras };
    let body;
    if (form) { h['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
    else if (cuerpo !== undefined) { h['content-type'] = 'application/json'; body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo); }
    if (cookie) h.cookie = cookie;
    return manejar(new Request(`https://${host}${ruta}`, { method: metodo, headers: h, body }), env, { waitUntil() {} });
  };
  for (const [q, c] of Object.entries(cuentas)) {
    const r = await crudo('/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: c.clave } });
    cookies[q] = r.headers.get('set-cookie').split(';')[0];
  }
  if (activo) await guardarDoc(d1, 'mcp.config', { activo: true });
  const m = {
    d1, db, env, cuentas, cookies, crudo,
    activar: (v = true) => guardarDoc(d1, 'mcp.config', { activo: v }),
    avanzar: (ms) => { t += ms; }, ahora: () => t,
    /** Una petición con la cookie de una cuenta, ya leída: { status, j|texto, headers }. */
    como: (q) => async (metodo, ruta, cuerpo) => { const r = await crudo(ruta, { metodo, cuerpo, cookie: cookies[q] }); const x = await r.text(); let j; try { j = JSON.parse(x); } catch { j = x; } return { status: r.status, j }; },
  };
  m.admin = m.como('admin'); m.editor = m.como('editor'); m.lectura = m.como('lectura');

  /** Registra un cliente y devuelve su client_id. */
  m.registrar = async (redirect = REDIRECT, nombre = 'Claude de prueba') => {
    const r = await crudo('/oauth/register', { metodo: 'POST', cuerpo: { client_name: nombre, redirect_uris: [redirect], token_endpoint_auth_method: 'none' } });
    const j = await r.json(); if (r.status !== 201) throw new Error('registro: ' + JSON.stringify(j));
    return j.client_id;
  };
  const paramsAut = (cli, reto, extra = {}) => ({ response_type: 'code', client_id: cli, redirect_uri: REDIRECT, code_challenge: reto, code_challenge_method: 'S256', state: 'estado-xyz', ...extra });
  m.paramsAut = paramsAut;
  /** Abre la pantalla de permiso con una cuenta y devuelve { status, html, csrf }. */
  m.pantalla = async (q, cli, reto, extra = {}) => {
    const r = await crudo('/conectar-claude?' + new URLSearchParams(paramsAut(cli, reto, extra)), { cookie: cookies[q] });
    const html = await r.text();
    return { status: r.status, html, headers: r.headers, csrf: /name="csrf" value="([0-9a-f]{64})"/.exec(html)?.[1] ?? null };
  };
  /** Aprueba con una cuenta → { status, ubicacion, codigo, estado }. */
  m.aprobar = async (q, cli, reto, { alcance = 'lectura', nombre, extra = {}, decision = 'aprobar', cabeceras = {} } = {}) => {
    const p = await m.pantalla(q, cli, reto, extra);
    if (!p.csrf) return { ...p, sinPantalla: true };
    const r = await crudo('/conectar-claude', { metodo: 'POST', cookie: cookies[q], cabeceras, form: { ...paramsAut(cli, reto, extra), csrf: p.csrf, alcance, decision, ...(alcance !== 'lectura' ? { confirmo: 'si' } : {}), ...(nombre ? { nombre } : {}) } });
    const ubicacion = r.headers.get('location'); const u = ubicacion ? new URL(ubicacion) : null;
    return { status: r.status, ubicacion, codigo: u?.searchParams.get('code') ?? null, error: u?.searchParams.get('error') ?? null, estado: u?.searchParams.get('state') ?? null };
  };
  m.token = async (form) => { const r = await crudo('/oauth/token', { metodo: 'POST', form }); const j = await r.json(); return { status: r.status, j }; };
  /** El baile completo: registrar → permiso → código → token. → { cli, tokens (access_token, refresh_token…), verificador }. */
  m.conectar = async ({ q = 'admin', alcance = 'lectura', nombre } = {}) => {
    const cli = await m.registrar(); const { verificador, reto } = await pkce();
    const a = await m.aprobar(q, cli, reto, { alcance, nombre });
    if (!a.codigo) throw new Error('no hubo código: ' + JSON.stringify(a).slice(0, 200));
    const t = await m.token({ grant_type: 'authorization_code', code: a.codigo, code_verifier: verificador, redirect_uri: REDIRECT, client_id: cli });
    if (t.status !== 200) throw new Error('token: ' + JSON.stringify(t.j));
    return { cli, tokens: t.j, verificador, codigo: a.codigo };
  };
  /** Una llamada JSON-RPC a /mcp con un Bearer. */
  let n = 0;
  m.rpc = async (bearer, metodo, params, { id = ++n, host = 'oficina.test' } = {}) => {
    const r = await crudo('/mcp', { metodo: 'POST', host, cuerpo: { jsonrpc: '2.0', id, method: metodo, ...(params !== undefined ? { params } : {}) }, cabeceras: bearer ? { authorization: 'Bearer ' + bearer } : {} });
    const x = await r.text(); let j = null; try { j = JSON.parse(x); } catch { /* sin cuerpo */ }
    return { status: r.status, j, headers: r.headers, texto: x };
  };
  m.llamar = (bearer, nombre, args = {}) => m.rpc(bearer, 'tools/call', { name: nombre, arguments: args });
  return m;
}

/** Todo el texto de las tres tablas (para buscar un testigo en claro). */
export function volcarMcp(db) {
  return JSON.stringify(['mcp_clientes', 'mcp_codigos', 'mcp_tokens'].map((t) => db.prepare(`select * from ${t}`).all()));
}

// Las herramientas de la Capa 1, SACADAS DEL REGISTRO por su `dominio` (capa1 y base): un carril nuevo no edita ninguna lista. Que la Capa 1 sea exactamente la esperada lo comprueba mcp-capa1.test.mjs.
import '../worker/lib/mcp/base/index.js';
import '../worker/lib/mcp/dominios/index.js';
import { herramientasDe } from '../worker/lib/mcp/registro.js';
export const CAPA1 = new Set(herramientasDe('capa1', 'base').map((h) => h.nombre));
