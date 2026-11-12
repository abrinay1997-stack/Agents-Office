// Las rutas PÚBLICAS del conector MCP son excepciones EXPLÍCITAS a «nada sale sin sesión»; solo esas. Y la comprobación de Origen que protege a las rutas con cookie sigue intacta en todas las demás.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALTAR } from './d1-memoria.mjs';
import { mundo, REDIRECT } from './mcp-ayudas.mjs';
import { RUTAS_PUBLICAS_MCP } from '../worker/modulos/mcp.js';
import { RUTAS_PUBLICAS } from '../worker/lib/rutas.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const opts = { skip: SALTAR };

test('la lista de excepciones es exactamente esta (si cambia, que cambie aquí a propósito)', () => {
  assert.deepEqual([...RUTAS_PUBLICAS_MCP].sort(), ['/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp', '/conectar-claude', '/mcp', '/oauth/authorize', '/oauth/register', '/oauth/revoke', '/oauth/token'].sort());
  assert.deepEqual(RUTAS_PUBLICAS, ['/api/hook/', '/api/telegram/', '/api/kpi/'], 'los webhooks de siempre no cambiaron');
  const rutas = readFileSync(join(RAIZ, 'worker/lib/rutas.js'), 'utf8');
  assert.equal((rutas.match(/publicaMcp\(/g) || []).length, 1, 'rutas.js llama al conector en UN solo sitio');
  assert.ok(rutas.indexOf('publicaMcp(req, env)') < rutas.indexOf("if (!ruta.startsWith('/api/'))"), 'y antes de la regla «nada sale sin sesión»');
  assert.ok(rutas.indexOf('publicaMcp(req, env)') < rutas.indexOf('origenValido(req)) return error'), 'fuera de la comprobación de Origen de la API');
});

test('SIN sesión solo contestan esas rutas: todo lo demás sigue siendo 401 (la API) o 404 (la página)', opts, async () => {
  const m = await mundo();
  const ids = new Set(RUTAS_PUBLICAS_MCP);
  const otras = ['/api/yo', '/api/funciones', '/api/conectar-claude', '/api/brain', '/api/tasks', '/api/media/jobs', '/api/mcp', '/api/oficina/mapa'];
  for (const ruta of otras) for (const metodo of ['GET', 'POST']) assert.equal((await m.crudo(ruta, { metodo, ...(metodo === 'POST' ? { cuerpo: {} } : {}) })).status, 401, `${metodo} ${ruta}`);
  // parecidas pero NO listadas: no son del conector (las atiende la página: 404 mudo, jamás una respuesta OAuth ni de MCP)
  for (const ruta of ['/mcp/otra', '/mcp.json', '/oauth/otra', '/oauth', '/.well-known/otra', '/.well-known/oauth-authorization-server/x', '/conectar-claude/x', '/conectar', '/oauthx/token']) {
    assert.ok(!ids.has(ruta), ruta); const r = await m.crudo(ruta); assert.equal(r.status, 404, ruta); assert.ok(!r.headers.get('access-control-allow-origin'), ruta + ' no lleva CORS del conector');
  }
  // las listadas SÍ contestan sin cookie (cada una a su manera) y ninguna es el 401 de la API
  assert.equal((await m.crudo('/.well-known/oauth-authorization-server')).status, 200);
  assert.equal((await m.crudo('/.well-known/oauth-protected-resource')).status, 200);
  assert.equal((await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { redirect_uris: [REDIRECT] } })).status, 201);
  assert.equal((await m.crudo('/oauth/token', { metodo: 'POST', cuerpo: {} })).status, 401, 'invalid_client: la aplicación no está registrada');
  assert.equal((await m.crudo('/oauth/authorize')).status, 302);
  assert.equal((await m.crudo('/mcp', { metodo: 'POST', cuerpo: {} })).status, 401);
  assert.equal((await m.crudo('/conectar-claude')).status, 400, 'sin parámetros OAuth: una página de error, con o sin sesión');
  // una barra final no abre nada nuevo; otros métodos, 405
  assert.equal((await m.crudo('/mcp/', { metodo: 'POST', cuerpo: {} })).status, 401);
  assert.equal((await m.crudo('/oauth/token', { metodo: 'GET' })).status, 405); assert.equal((await m.crudo('/oauth/register', { metodo: 'GET' })).status, 405);
  assert.equal((await m.crudo('/.well-known/oauth-authorization-server', { metodo: 'POST', cuerpo: {} })).status, 405);
});

test('ORIGEN: las rutas que exigen sesión SIGUEN rechazando otro origen; las del conector (sin cookie) no lo miran', opts, async () => {
  const m = await mundo(); const ajeno = { origin: 'https://evil.example' };
  const r = await m.crudo('/api/funciones', { metodo: 'POST', cookie: m.cookies.admin, cabeceras: ajeno, cuerpo: { id: 'chat', activo: true } });
  assert.equal(r.status, 403); assert.equal((await r.json()).error, 'Origen no permitido');
  assert.equal((await m.crudo('/api/conectar-claude/cortar-todas', { metodo: 'POST', cookie: m.cookies.admin, cabeceras: ajeno, cuerpo: {} })).status, 403);
  assert.equal((await m.crudo('/oauth/register', { metodo: 'POST', cabeceras: ajeno, cuerpo: { redirect_uris: [REDIRECT] } })).status, 201, 'el registro lo llama el servidor de Claude, de otro origen');
  const c = await m.registrar(); const t = await m.crudo('/oauth/token', { metodo: 'POST', cabeceras: ajeno, form: { grant_type: 'authorization_code', code: 'a'.repeat(64), client_id: c } });
  assert.equal(t.status, 400, 'el token se procesa (y se rechaza por su código, no por el origen)');
  assert.equal((await m.rpc(null, 'ping')).status, 401);
  const con = await m.conectar(); const rr = await m.crudo('/mcp', { metodo: 'POST', cabeceras: { ...ajeno, authorization: 'Bearer ' + con.tokens.access_token }, cuerpo: { jsonrpc: '2.0', id: 1, method: 'ping' } });
  assert.equal(rr.status, 403, '/mcp rechaza un Origin ajeno aunque el Bearer sea bueno');
  const ping = (cabeceras) => m.crudo('/mcp', { metodo: 'POST', cabeceras: { authorization: 'Bearer ' + con.tokens.access_token, ...cabeceras }, cuerpo: { jsonrpc: '2.0', id: 1, method: 'ping' } });
  for (const o of ['https://claude.ai', 'https://claude.com', 'http://localhost:3000', 'http://127.0.0.1:8080']) assert.equal((await ping({ origin: o })).status, 200, o);
  for (const o of ['null', 'https://claude.ai.evil.example', 'http://localhost.evil.example', 'https://localhost:3000', 'http://evil.example']) assert.equal((await ping({ origin: o })).status, 403, o);
  assert.equal((await ping({})).status, 200, 'sin Origin (un programa) pasa con su Bearer');
  // …pero la pantalla de permiso (la que SÍ lleva la cookie) no: ya lo prueba mcp-oauth.test.mjs («otro origen» → 403)
});

test('la cookie de la oficina NO abre /mcp, y un Bearer del conector NO abre la API de la oficina', opts, async () => {
  const m = await mundo(); const con = await m.conectar({ alcance: 'gasto' });
  const sinBearer = await m.crudo('/mcp', { metodo: 'POST', cookie: m.cookies.admin, cuerpo: { jsonrpc: '2.0', id: 1, method: 'ping' } });
  assert.equal(sinBearer.status, 401, 'ser administrador en el navegador no sirve de token');
  for (const ruta of ['/api/yo', '/api/funciones', '/api/tasks']) assert.equal((await m.crudo(ruta, { cabeceras: { authorization: 'Bearer ' + con.tokens.access_token } })).status, 401, ruta);
});

test('la página de la oficina inyecta el panel «Conectar Claude» solo con sesión', opts, async () => {
  const m = await mundo();
  assert.equal((await m.crudo('/nube-conectar-claude.js')).status, 401);
  const r = await m.crudo('/nube-conectar-claude.js', { cookie: m.cookies.admin }); assert.equal(r.status, 200);
  assert.match(readFileSync(join(RAIZ, 'worker/lib/paginas.js'), 'utf8'), /<script src="\/nube-conectar-claude\.js" defer><\/script>/, 'la página real lo trae en su inyección (la oficina de mentira de esta prueba es un asset de texto)');
});
