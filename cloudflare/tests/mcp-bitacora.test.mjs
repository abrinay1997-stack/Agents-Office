// La bitácora del descubrimiento y del OAuth (lib/mcp/bitacora.js): una línea JSON por petición, con lo justo para ver qué pide un cliente y qué se le contesta,
// y NINGÚN secreto: ni cabeceras de autorización, ni cookies, ni cuerpos, ni la consulta (state, code_challenge), ni testigos, ni códigos, ni la IP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { mundo, pkce, REDIRECT } from './mcp-ayudas.mjs';
import { lineaDe, direccionCorta, redirectsDeRegistro } from '../worker/lib/mcp/bitacora.js';

const opts = { skip: SALTAR };
const SENT = { bearer: 'mcpa_' + 'a1'.repeat(32), estado: 'ESTADO-SECRETO-777', cookie: 'sesion=COOKIE-SECRETA-888', ip: '203.0.113.77', secreto: 'CLIENT-SECRET-999', cuerpo: 'CUERPO-SECRETO-555' };

async function conBitacora(fn, extraEnv = {}) {
  const lineas = [];
  const m = await mundo({ extraEnv: { MCP_BITACORA_SINK: (l) => lineas.push(l), ...extraEnv } });
  lineas.length = 0; // el baile de la sesión de las cuentas no es del conector
  await fn(m, lineas);
}
const ultima = (lineas) => JSON.parse(lineas[lineas.length - 1]);

test('BITÁCORA: una línea JSON por petición pública, con los campos esperados', opts, async () => {
  await conBitacora(async (m, lineas) => {
    await m.crudo('/.well-known/oauth-protected-resource/mcp', { cabeceras: { 'user-agent': 'Claude-User', origin: 'https://claude.ai', 'cf-ipcountry': 'US' } });
    assert.equal(lineas.length, 1);
    const l = ultima(lineas);
    assert.equal(l.evento, 'mcp-peticion'); assert.equal(l.metodo, 'GET'); assert.equal(l.ruta, '/.well-known/oauth-protected-resource/mcp'); assert.equal(l.estado, 200);
    assert.equal(l.ua, 'Claude-User'); assert.equal(l.origin, 'https://claude.ai'); assert.equal(l.pais, 'US'); assert.ok(Number.isFinite(l.ms)); assert.ok(!Number.isNaN(Date.parse(l.ts)));
    assert.equal(l.motivo, undefined, 'un 200 no lleva motivo');
  });
});

test('BITÁCORA: lo que NO es del conector no deja línea (la oficina de siempre)', opts, async () => {
  await conBitacora(async (m, lineas) => {
    await m.crudo('/api/acceso', { metodo: 'POST', cuerpo: { email: 'x@y.z', contrasena: 'no' } });
    await m.crudo('/');
    assert.equal(lineas.length, 0);
  });
});

test('BITÁCORA: ningún secreto sale en ninguna línea (centinelas en cabeceras, consulta, cuerpo, cookie e IP)', opts, async () => {
  await conBitacora(async (m, lineas) => {
    const { verificador, reto } = await pkce();
    const cabs = { authorization: 'Bearer ' + SENT.bearer, cookie: SENT.cookie, 'cf-connecting-ip': SENT.ip, 'x-forwarded-for': SENT.ip, 'user-agent': 'node-undici', origin: 'https://claude.ai' };
    await m.crudo('/mcp', { metodo: 'POST', cuerpo: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: SENT.cuerpo } }, cabeceras: cabs });
    await m.crudo('/oauth/token', { metodo: 'POST', form: { grant_type: 'authorization_code', code: SENT.secreto, code_verifier: verificador, client_id: 'mcp_' + '0'.repeat(32), client_secret: SENT.secreto }, cabeceras: cabs });
    await m.crudo('/oauth/revoke', { metodo: 'POST', form: { token: SENT.bearer, client_id: 'mcp_' + '0'.repeat(32) }, cabeceras: cabs });
    await m.crudo('/oauth/authorize?' + new URLSearchParams({ response_type: 'code', client_id: 'x', state: SENT.estado, code_challenge: reto }), { cabeceras: cabs });
    await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { client_name: SENT.cuerpo, redirect_uris: ['https://evil.test/cb?token=' + SENT.secreto + '#' + SENT.estado] }, cabeceras: cabs });
    const cli = await m.registrar(); // un registro bueno
    const a = await m.aprobar('admin', cli, reto, { extra: { state: SENT.estado } });
    await m.token({ grant_type: 'authorization_code', code: a.codigo, code_verifier: verificador, redirect_uri: REDIRECT, client_id: cli });
    assert.ok(lineas.length >= 8, 'hubo líneas: ' + lineas.length);
    const todo = lineas.join('\n');
    for (const [k, v] of Object.entries(SENT)) assert.ok(!todo.includes(v), 'se coló «' + k + '» en la bitácora');
    assert.ok(!todo.includes(a.codigo), 'el código de autorización');
    assert.ok(!todo.includes(verificador), 'el verificador PKCE');
    assert.ok(!todo.includes(reto), 'el reto PKCE');
    assert.ok(!/mcp[ar]_[0-9a-f]{64}/.test(todo), 'ningún testigo');
    assert.ok(!/authorization|cookie|bearer/i.test(todo), 'ni los nombres de esas cabeceras');
    for (const l of lineas) assert.ok(!('query' in JSON.parse(l)) && !JSON.parse(l).ruta.includes('?'), 'la ruta va sin consulta');
  });
});

test('BITÁCORA: el motivo sale del CÓDIGO de error y dice qué pasó (sin token, apagado, otro host, método, registro rechazado)', opts, async () => {
  await conBitacora(async (m, lineas) => {
    await m.crudo('/mcp', { metodo: 'POST', cuerpo: { jsonrpc: '2.0', id: 1, method: 'initialize' } });
    assert.equal(ultima(lineas).motivo, 'sin-token'); assert.equal(ultima(lineas).estado, 401);
    await m.crudo('/mcp', { metodo: 'POST', cuerpo: { jsonrpc: '2.0', id: 1, method: 'ping' }, cabeceras: { authorization: 'Bearer mcpa_' + '0'.repeat(64) } });
    assert.equal(ultima(lineas).motivo, 'token-invalido');
    await m.crudo('/oauth/token', { metodo: 'GET' });
    assert.equal(ultima(lineas).motivo, 'metodo'); assert.equal(ultima(lineas).estado, 405);
    await m.crudo('/oauth/token', { metodo: 'POST', form: { grant_type: 'authorization_code', client_id: 'no' } });
    assert.equal(ultima(lineas).motivo, 'invalid_client');
    const r = await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { client_name: 'Claude', redirect_uris: ['claude://oauth/callback?x=1'] } });
    assert.equal(r.status, 400);
    const l = ultima(lineas);
    assert.equal(l.motivo, 'invalid_redirect_uri'); assert.deepEqual(l.redirects, ['claude://oauth/callback'], 'la dirección rechazada, sin consulta');
    await m.crudo('/mcp', { metodo: 'POST', host: 'otro.workers.dev', cuerpo: {} });
    assert.equal(ultima(lineas).motivo, 'otro-host'); assert.equal(ultima(lineas).estado, 404);
    await m.activar(false);
    await m.crudo('/.well-known/oauth-authorization-server');
    assert.equal(ultima(lineas).motivo, 'apagado'); assert.equal(ultima(lineas).estado, 404);
  });
});

test('BITÁCORA: lo ajeno se acota (ua a 60, origin raro, controles fuera) y una bitácora rota no rompe la petición', opts, async () => {
  const largo = 'U'.repeat(200) + '\u0001‮';
  const cab = { 'user-agent': largo, origin: 'javascript:alert(1)', 'cf-ipcountry': 'USA' }; // un Request real no admite controles en una cabecera: se simula lo que llegaría
  const req = { method: 'POST', headers: { get: (k) => cab[k.toLowerCase()] ?? null } };
  const l = lineaDe({ req, ruta: '/mcp', estado: 401, ms: 3, motivo: 'sin-token' });
  assert.equal(l.ua.length, 60); assert.ok(!/[\u0001‮]/.test(l.ua)); assert.equal(l.origin, '[raro]'); assert.equal(l.pais, 'US');
  assert.equal(direccionCorta('https://claude.ai/api/mcp/auth_callback?code=SECRETO#x'), 'https://claude.ai/api/mcp/auth_callback');
  assert.equal(direccionCorta('no es una dirección'), '[no es una dirección]');
  assert.deepEqual(redirectsDeRegistro('{no json'), []);
  assert.equal(redirectsDeRegistro(JSON.stringify({ redirect_uris: Array(9).fill('https://a.test/b') })).length, 5);
  await conBitacora(async (m) => { assert.equal((await m.crudo('/.well-known/oauth-protected-resource')).status, 200); }, { MCP_BITACORA_SINK: () => { throw new Error('el sumidero se cayó'); } });
});

test('DESCUBRIMIENTO: las variantes con la ruta del recurso y OIDC dan la misma ficha que la de siempre', opts, async () => {
  await conBitacora(async (m) => {
    const base = await (await m.crudo('/.well-known/oauth-authorization-server')).json();
    for (const ruta of ['/.well-known/oauth-authorization-server/mcp', '/.well-known/openid-configuration']) {
      const r = await m.crudo(ruta); assert.equal(r.status, 200, ruta); assert.deepEqual(await r.json(), base, ruta);
      assert.equal(r.headers.get('access-control-allow-origin'), '*');
      assert.equal((await m.crudo(ruta, { metodo: 'POST', cuerpo: {} })).status, 405, ruta);
    }
    const rec = await (await m.crudo('/.well-known/oauth-protected-resource/mcp')).json();
    assert.deepEqual(rec.authorization_servers, [base.issuer]); assert.deepEqual(rec.bearer_methods_supported, ['header']);
  });
});
