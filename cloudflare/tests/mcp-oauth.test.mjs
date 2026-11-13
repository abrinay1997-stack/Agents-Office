// El conector MCP remoto (P2): el baile OAuth 2.1 completo + PKCE, el registro dinámico, la pantalla de permiso (solo un administrador), la rotación de testigos y el servidor JSON-RPC.
// Corre contra el Worker real (lib/rutas.js → manejar) con una D1 en memoria que lleva las migraciones REALES y un reloj inyectado. Ningún testigo se imprime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { mundo, pkce, volcarMcp, REDIRECT } from './mcp-ayudas.mjs';
import { redirectUriPermitida, metadatosServidor } from '../worker/lib/mcp/oauth.js';

const opts = { skip: SALTAR };

test('los metadatos: UN solo issuer (HOST_MCP), PKCE S256 y nada más, protected-resource apunta al mismo issuer', opts, async () => {
  const m = await mundo();
  const a = await (await m.crudo('/.well-known/oauth-authorization-server')).json();
  assert.equal(a.issuer, 'https://oficina.test');
  assert.deepEqual(a.code_challenge_methods_supported, ['S256']);
  assert.equal(a.authorization_endpoint, 'https://oficina.test/oauth/authorize');
  assert.equal(a.token_endpoint, 'https://oficina.test/oauth/token');
  assert.equal(a.registration_endpoint, 'https://oficina.test/oauth/register');
  assert.deepEqual(a.scopes_supported, ['lectura', 'oficina', 'gasto']);
  for (const ruta of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
    const r = await (await m.crudo(ruta)).json();
    assert.equal(r.resource, 'https://oficina.test/mcp'); assert.deepEqual(r.authorization_servers, ['https://oficina.test']);
  }
  assert.equal(metadatosServidor({}).issuer, 'https://oficina.panaclaw.com', 'sin HOST_MCP, el host por defecto');
});

test('APAGADO (mcp.activo sin encender): ni /mcp, ni /oauth, ni los metadatos, ni la pantalla existen (404); ENCENDIDO: sí', opts, async () => {
  const m = await mundo({ activo: false });
  for (const [metodo, ruta] of [['POST', '/mcp'], ['POST', '/oauth/register'], ['POST', '/oauth/token'], ['GET', '/oauth/authorize'], ['GET', '/.well-known/oauth-authorization-server'], ['GET', '/.well-known/oauth-protected-resource'], ['GET', '/conectar-claude']]) {
    assert.equal((await m.crudo(ruta, { metodo, cookie: m.cookies.admin })).status, 404, `${metodo} ${ruta} apagado`);
  }
  await m.activar(true);
  assert.equal((await m.crudo('/.well-known/oauth-authorization-server')).status, 200);
  await m.activar(false); // y vuelve a apagarse
  assert.equal((await m.crudo('/.well-known/oauth-authorization-server')).status, 404);
});

test('OTRO HOST (workers.dev): no hay segundo issuer, todo 404', opts, async () => {
  const m = await mundo();
  for (const ruta of ['/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/conectar-claude', '/oauth/authorize']) assert.equal((await m.crudo(ruta, { host: 'agents-office.algo.workers.dev', cookie: m.cookies.admin })).status, 404, ruta);
  assert.equal((await m.rpc('x', 'ping', undefined, { host: 'agents-office.algo.workers.dev' })).status, 404);
});

test('/mcp sin token: 401 con WWW-Authenticate y resource_metadata; con un token que no existe, invalid_token', opts, async () => {
  const m = await mundo();
  const r = await m.rpc(null, 'ping');
  assert.equal(r.status, 401);
  assert.match(r.headers.get('www-authenticate'), /^Bearer resource_metadata="https:\/\/oficina\.test\/\.well-known\/oauth-protected-resource"$/);
  const r2 = await m.rpc('mcpa_' + '0'.repeat(64), 'ping');
  assert.equal(r2.status, 401); assert.match(r2.headers.get('www-authenticate'), /error="invalid_token"/);
  assert.equal((await m.rpc('basura', 'ping')).status, 401);
});

test('registro dinámico: lista CERRADA de redirect_uri', opts, async () => {
  const m = await mundo();
  const reg = async (uris, extra = {}) => { m.avanzar(7000); /* el tope por IP es de 10 por minuto */ const r = await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { client_name: 'X', redirect_uris: uris, ...extra } }); return { status: r.status, j: await r.json() }; };
  for (const ok of [REDIRECT, 'https://claude.com/api/mcp/auth_callback', 'http://localhost:54321/callback', 'http://127.0.0.1:8080/cb', 'http://localhost/cb']) assert.equal((await reg([ok])).status, 201, ok);
  const malas = ['https://evil.example/cb', 'http://claude.ai/api/mcp/auth_callback', 'https://claude.ai/api/mcp/otra', 'http://localhost.evil.com/cb', 'http://localhost@evil.com/cb', 'http://localhost:99999/cb',
    'http://127.0.0.1.evil.com/', 'javascript:alert(1)', 'https://claude.ai.evil.com/api/mcp/auth_callback', 'http://localhost:80/cb#frag', 'http://user:pw@localhost/cb', 'https://localhost/cb', ''];
  for (const mal of malas) {
    const r = await reg([mal]); assert.equal(r.status, 400, mal); assert.equal(r.j.error, 'invalid_redirect_uri');
  }
  assert.equal((await reg([])).status, 400); assert.equal((await reg([REDIRECT, 'https://evil.example/x'])).status, 400, 'una mala entre buenas, todo se rechaza'); assert.equal((await reg(Array(6).fill(REDIRECT))).status, 400);
  assert.equal((await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: '{no es json' })).status, 400);
  const r = await reg([REDIRECT], { client_name: '<script>alert(1)</script>\n  evil  ' + 'x'.repeat(200) }); assert.equal(r.status, 201); assert.ok(r.j.client_name.length <= 60 && !/\n/.test(r.j.client_name));
  assert.ok(redirectUriPermitida('http://localhost:3000/cb?x=1') && !redirectUriPermitida(null));
});

test('registro dinámico: tope por hora (en total) y por minuto (por IP); y la poda de clientes sin uso', opts, async () => {
  const m = await mundo();
  const ins = m.db.prepare('insert into mcp_clientes (client_id, nombre, redirect_uris, creado_at) values (?,?,?,?)');
  for (let i = 0; i < 60; i++) ins.run('mcp_' + String(i).padStart(32, '0'), 'c', JSON.stringify([REDIRECT]), m.ahora() - 1000);
  const r = await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { redirect_uris: [REDIRECT] } });
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'temporarily_unavailable');
  m.avanzar(3601_000); // una hora después ya caben
  assert.equal((await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { redirect_uris: [REDIRECT] } })).status, 201);
  const m2 = await mundo(); // por IP, por minuto: 10
  for (let i = 0; i < 10; i++) assert.equal((await m2.crudo('/oauth/register', { metodo: 'POST', cuerpo: { redirect_uris: [REDIRECT] } })).status, 201);
  assert.equal((await m2.crudo('/oauth/register', { metodo: 'POST', cuerpo: { redirect_uris: [REDIRECT] } })).status, 429);
});

test('la pantalla de permiso: parámetros malos NO redirigen; sin sesión, 401; un editor y una cuenta de lectura reciben un «no» y no se emite NADA; el administrador ve el formulario con CSP estricta', opts, async () => {
  const m = await mundo(); const cli = await m.registrar(); const { reto } = await pkce();
  // parámetros malos (con sesión de administrador): página de error, jamás una redirección
  const casos = [['sin PKCE', { code_challenge_method: 'plain' }], ['reto corto', { code_challenge: 'abc' }], ['redirect_uri no registrada', { redirect_uri: 'https://evil.example/cb' }],
    ['otro response_type', { response_type: 'token' }], ['client_id raro', { client_id: 'mcp_x' }], ['otro recurso', { resource: 'https://otro.example/mcp' }]];
  for (const [que, extra] of casos) {
    const p = await m.pantalla('admin', cli, reto, extra);
    assert.equal(p.status, 400, que); assert.equal(p.headers.get('location'), null, que + ': no redirige'); assert.equal(p.csrf, null);
  }
  const sinMetodo = new URLSearchParams(m.paramsAut(cli, reto)); sinMetodo.delete('code_challenge_method');
  assert.equal((await m.crudo('/conectar-claude?' + sinMetodo, { cookie: m.cookies.admin })).status, 400, 'sin code_challenge_method tampoco');
  // sin sesión
  const anon = await m.crudo('/conectar-claude?' + new URLSearchParams(m.paramsAut(cli, reto)));
  assert.equal(anon.status, 401); assert.match(await anon.text(), /Entra primero/);
  // editor y lectura: «no» en palabras; ni pantalla ni código
  for (const q of ['editor', 'lectura']) {
    const p = await m.pantalla(q, cli, reto);
    assert.equal(p.status, 403, q); assert.match(p.html, /Solo un administrador puede conectar/); assert.equal(p.csrf, null); assert.ok(!/name="alcance"/.test(p.html));
    const a = await m.aprobar(q, cli, reto); assert.equal(a.sinPantalla, true);
  }
  assert.equal(m.db.prepare('select count(*) n from mcp_codigos').get().n, 0, 'a un editor o a lectura no se le emitió ningún código');
  // el administrador
  const ok = await m.pantalla('admin', cli, reto);
  assert.equal(ok.status, 200); assert.match(ok.html, /name="alcance" value="lectura" checked/); assert.match(ok.html, /Claude de prueba/); assert.match(ok.html, /dueno@panaclaw\.test/);
  for (const a of ['lectura', 'oficina', 'gasto']) assert.match(ok.html, new RegExp(`name="alcance" value="${a}"`));
  const csp = ok.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/); assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /style-src 'nonce-[0-9a-f]+'/); assert.ok(!/unsafe-inline|unsafe-eval|script-src/.test(csp));
  assert.equal(ok.headers.get('x-frame-options'), 'DENY'); assert.equal(ok.headers.get('cache-control'), 'no-store'); assert.ok(!/<script/i.test(ok.html), 'sin JavaScript');
  assert.ok(!ok.headers.get('access-control-allow-origin'), 'la pantalla con cookie no lleva CORS');
  const nonce = /style-src 'nonce-([0-9a-f]+)'/.exec(csp)[1]; assert.match(ok.html, new RegExp(`<style nonce="${nonce}">`));
});

test('el nombre del cliente se escapa en la pantalla de permiso', opts, async () => {
  const m = await mundo();
  const cli = await m.registrar(REDIRECT, '<img src=x onerror=alert(1)>"\'&'); const { reto } = await pkce();
  const p = await m.pantalla('admin', cli, reto);
  assert.ok(!p.html.includes('<img src=x'), 'sin HTML sin escapar'); assert.match(p.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('/oauth/authorize lleva a la pantalla de permiso con los mismos parámetros', opts, async () => {
  const m = await mundo(); const cli = await m.registrar(); const { reto } = await pkce();
  const r = await m.crudo('/oauth/authorize?' + new URLSearchParams(m.paramsAut(cli, reto)));
  assert.equal(r.status, 302); const u = new URL(r.headers.get('location'), 'https://oficina.test');
  assert.equal(u.pathname, '/conectar-claude'); assert.equal(u.searchParams.get('client_id'), cli); assert.equal(u.searchParams.get('code_challenge'), reto);
});

test('aprobar: exige CSRF y mismo origen; cancelar vuelve con access_denied; sin alcance vale «lectura»; un alcance raro se rechaza', opts, async () => {
  const m = await mundo(); const cli = await m.registrar(); const { reto } = await pkce();
  const p = await m.pantalla('admin', cli, reto);
  const campos = { ...m.paramsAut(cli, reto), decision: 'aprobar', alcance: 'oficina' };
  const post = (form, cabeceras = {}, q = 'admin') => m.crudo('/conectar-claude', { metodo: 'POST', cookie: m.cookies[q], cabeceras, form });
  assert.equal((await post({ ...campos })).status, 403, 'sin csrf');
  assert.equal((await post({ ...campos, csrf: 'a'.repeat(64) })).status, 403, 'csrf falso');
  assert.equal((await post({ ...campos, csrf: p.csrf }, { origin: 'https://evil.example' })).status, 403, 'otro origen');
  assert.equal((await post({ ...campos, csrf: p.csrf, alcance: 'root' })).status, 400, 'alcance raro');
  assert.equal(m.db.prepare('select count(*) n from mcp_codigos').get().n, 0, 'nada de eso emitió un código');
  // el csrf de OTRA cuenta no sirve en esta sesión
  const otro = await m.pantalla('editor', cli, reto); assert.equal(otro.csrf, null);
  const csrfEditor = (await m.crudo('/conectar-claude?' + new URLSearchParams(m.paramsAut(cli, reto)), { cookie: m.cookies.editor }));
  assert.equal(csrfEditor.status, 403);
  // un editor no puede aprobar aunque mande el formulario a mano (aun con un csrf cualquiera)
  assert.equal((await post({ ...campos, csrf: p.csrf }, {}, 'editor')).status, 403);
  assert.equal((await post({ ...campos, csrf: p.csrf }, {}, 'lectura')).status, 403);
  assert.equal(m.db.prepare('select count(*) n from mcp_codigos').get().n, 0);
  const cancel = await post({ ...campos, csrf: p.csrf, decision: 'cancelar' });
  assert.equal(cancel.status, 303); const u = new URL(cancel.headers.get('location')); assert.equal(u.origin + u.pathname, REDIRECT); assert.equal(u.searchParams.get('error'), 'access_denied'); assert.equal(u.searchParams.get('state'), 'estado-xyz');
  const { alcance: _quitado, ...sinAlcance } = campos; const sin = await post({ ...sinAlcance, csrf: p.csrf }); // sin alcance → lectura
  assert.equal(sin.status, 303); assert.ok(new URL(sin.headers.get('location')).searchParams.get('code'));
  assert.equal(m.db.prepare('select alcance from mcp_codigos').get().alcance, 'lectura');
});

test('EL BAILE COMPLETO: registro → permiso → código → token → /mcp; el testigo nunca está en claro en D1', opts, async () => {
  const m = await mundo();
  const { tokens, cli } = await m.conectar({ alcance: 'oficina', nombre: 'Mi Claude' });
  assert.equal(tokens.token_type, 'Bearer'); assert.equal(tokens.scope, 'oficina'); assert.equal(tokens.expires_in, 3600); assert.match(tokens.access_token, /^mcpa_[0-9a-f]{64}$/); assert.match(tokens.refresh_token, /^mcpr_[0-9a-f]{64}$/);
  const volcado = volcarMcp(m.db);
  assert.ok(!volcado.includes(tokens.access_token.slice(5)) && !volcado.includes(tokens.refresh_token.slice(5)), 'ni el de acceso ni el de renovación están en claro');
  const f = m.db.prepare('select * from mcp_tokens').get();
  assert.match(f.access_hash, /^[0-9a-f]{64}$/); assert.match(f.refresh_hash, /^[0-9a-f]{64}$/); assert.equal(f.nombre, 'Mi Claude'); assert.equal(f.alcance, 'oficina'); assert.equal(f.rol, 'admin'); assert.equal(f.client_id, cli);
  const i = await m.rpc(tokens.access_token, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  assert.equal(i.status, 200); assert.equal(i.j.result.protocolVersion, '2025-06-18'); assert.equal(i.j.result.serverInfo.name, 'agents-office'); assert.ok(i.j.result.capabilities.tools);
  assert.equal((await m.rpc(tokens.access_token, 'initialize', { protocolVersion: '1999-01-01' })).j.result.protocolVersion, '2025-06-18', 'una versión que no conoce: propone la suya');
  assert.deepEqual((await m.rpc(tokens.access_token, 'ping')).j.result, {});
  const lista = (await m.rpc(tokens.access_token, 'tools/list')).j.result.tools;
  assert.ok(lista.some((t) => t.name === 'como_funciona'), 'como_funciona sigue ahí'); // desde la P3b hay más; un token de «oficina» no ve las que preparan gastos
  assert.ok(!lista.some((t) => /^(generar_|aplicar_preset$|crear_lote$)/.test(t.name)), 'un token de «oficina» no ve las herramientas de alcance «gasto»');
  assert.equal(lista[0].annotations.readOnlyHint, true); assert.equal(lista[0].inputSchema.type, 'object');
  const c = await m.llamar(tokens.access_token, 'como_funciona', {});
  assert.equal(c.j.result.isError, false); assert.match(c.j.result.content[0].text, /MAPA DE LA OFICINA/); assert.match(c.j.result.content[0].text, /NUNCA por aquí/);
  const t = await m.llamar(tokens.access_token, 'como_funciona', { tema: 'anuncios' }); assert.match(t.j.result.content[0].text, /nuncios/);
  // el rastro: una fila por llamada, sin testigos
  const filas = m.db.prepare("select detalle, quien from auditoria where tipo = 'mcp'").all().map((x) => x.detalle).join('\n');
  assert.match(filas, /"herramienta":"como_funciona"/); assert.match(filas, /"evento":"conectar-aprobado"/); assert.match(filas, /"conector":"Mi Claude"/);
  assert.ok(!filas.includes(tokens.access_token) && !filas.includes(tokens.refresh_token) && !filas.includes(m.cookies.admin.split('=')[1]), 'la auditoría no lleva testigos');
});

test('JSON-RPC: notificación → 202; JSON roto → -32700; método y herramienta desconocidos; GET no vale; lote; argumentos que sobran o faltan', opts, async () => {
  const m = await mundo(); const { tokens } = await m.conectar(); const b = tokens.access_token;
  const n = await m.crudo('/mcp', { metodo: 'POST', cuerpo: { jsonrpc: '2.0', method: 'notifications/initialized' }, cabeceras: { authorization: 'Bearer ' + b } });
  assert.equal(n.status, 202); assert.equal(await n.text(), '');
  const roto = await m.crudo('/mcp', { metodo: 'POST', cuerpo: '{no', cabeceras: { authorization: 'Bearer ' + b } });
  assert.equal(roto.status, 400); assert.equal((await roto.json()).error.code, -32700);
  assert.equal((await m.rpc(b, 'resources/list')).j.error.code, -32601);
  assert.equal((await m.llamar(b, 'no_existe')).j.error.code, -32602);
  const g = await m.crudo('/mcp', { metodo: 'GET', cabeceras: { authorization: 'Bearer ' + b } }); assert.equal(g.status, 405); assert.match(g.headers.get('allow'), /POST/);
  const gSin = await m.crudo('/mcp', { metodo: 'GET' }); assert.equal(gSin.status, 401, 'un GET sin testigo: 401 (así el cliente descubre el OAuth), no 405'); assert.match(gSin.headers.get('www-authenticate'), /resource_metadata=/);
  assert.equal((await m.crudo('/mcp', { metodo: 'DELETE' })).status, 401);
  const lote = await m.crudo('/mcp', { metodo: 'POST', cuerpo: [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }], cabeceras: { authorization: 'Bearer ' + b } });
  assert.equal((await lote.json()).length, 2);
  const sobra = await m.llamar(b, 'como_funciona', { otra: 1 }); assert.equal(sobra.j.result.isError, true); assert.match(sobra.j.result.content[0].text, /no existe en esta herramienta/);
  const larga = await m.llamar(b, 'como_funciona', { tema: 'x'.repeat(500) }); assert.equal(larga.j.result.isError, true);
  assert.equal((await m.crudo('/mcp', { metodo: 'POST', cuerpo: { id: 1, method: 'ping' }, cabeceras: { authorization: 'Bearer ' + b } })).status, 200, 'sin jsonrpc: error JSON-RPC, no una caída');
  const enorme = await m.crudo('/mcp', { metodo: 'POST', cuerpo: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { x: 'y'.repeat(70_000) } }), cabeceras: { authorization: 'Bearer ' + b } });
  assert.equal(enorme.status, 413);
});

test('CORS: los metadatos, el registro, el token y /mcp lo llevan (se llaman sin cookie); la preflight contesta 204', opts, async () => {
  const m = await mundo();
  for (const [metodo, ruta] of [['GET', '/.well-known/oauth-authorization-server'], ['POST', '/oauth/token'], ['POST', '/oauth/register'], ['POST', '/mcp']]) {
    const r = await m.crudo(ruta, { metodo, ...(metodo === 'POST' ? { cuerpo: {} } : {}) }); assert.equal(r.headers.get('access-control-allow-origin'), '*', ruta);
    const o = await m.crudo(ruta, { metodo: 'OPTIONS' }); assert.equal(o.status, 204, ruta); assert.match(o.headers.get('access-control-allow-headers'), /authorization/);
  }
  assert.match((await m.rpc(null, 'ping')).headers.get('access-control-expose-headers'), /WWW-Authenticate/);
});

test('PKCE: un verificador malo se rechaza Y quema el código (no se puede reintentar con el bueno); sin verificador, también', opts, async () => {
  const m = await mundo();
  const cli = await m.registrar(); const { verificador, reto } = await pkce();
  const a = await m.aprobar('admin', cli, reto);
  const otro = (await pkce()).verificador;
  const mal = await m.token({ grant_type: 'authorization_code', code: a.codigo, code_verifier: otro, redirect_uri: REDIRECT, client_id: cli });
  assert.equal(mal.status, 400); assert.equal(mal.j.error, 'invalid_grant');
  const bien = await m.token({ grant_type: 'authorization_code', code: a.codigo, code_verifier: verificador, redirect_uri: REDIRECT, client_id: cli });
  assert.equal(bien.status, 400, 'el código ya se gastó'); assert.equal(m.db.prepare('select count(*) n from mcp_tokens').get().n, 0);
  const b2 = await m.aprobar('admin', cli, reto);
  assert.equal((await m.token({ grant_type: 'authorization_code', code: b2.codigo, redirect_uri: REDIRECT, client_id: cli })).j.error, 'invalid_grant', 'sin verificador');
  const b3 = await m.aprobar('admin', cli, reto);
  assert.equal((await m.token({ grant_type: 'authorization_code', code: b3.codigo, code_verifier: 'corto', redirect_uri: REDIRECT, client_id: cli })).j.error, 'invalid_grant', 'verificador de largo raro');
});

test('el código es de UN solo uso: reutilizarlo se rechaza y CORTA lo que nació de él; y caduca al minuto', opts, async () => {
  const m = await mundo();
  const cli = await m.registrar(); const { verificador, reto } = await pkce();
  const a = await m.aprobar('admin', cli, reto);
  const form = { grant_type: 'authorization_code', code: a.codigo, code_verifier: verificador, redirect_uri: REDIRECT, client_id: cli };
  const t1 = await m.token(form); assert.equal(t1.status, 200);
  assert.equal((await m.llamar(t1.j.access_token, 'como_funciona')).status, 200);
  const t2 = await m.token(form); assert.equal(t2.status, 400); assert.equal(t2.j.error, 'invalid_grant');
  assert.equal((await m.rpc(t1.j.access_token, 'ping')).status, 401, 'el código se reutilizó: la conexión que nació de él quedó cortada');
  assert.equal((await m.token({ ...form, code: 'a'.repeat(64) })).status, 400);
  // caducidad: 60 s
  const b = await m.aprobar('admin', cli, reto); m.avanzar(61_000);
  assert.equal((await m.token({ ...form, code: b.codigo })).j.error, 'invalid_grant');
  const c = await m.aprobar('admin', cli, reto); m.avanzar(59_000);
  assert.equal((await m.token({ ...form, code: c.codigo })).status, 200, 'a los 59 s todavía vale');
});

test('el código va atado a su cliente y a su redirect_uri', opts, async () => {
  const m = await mundo();
  const cli = await m.registrar(); const cli2 = await m.registrar(); const { verificador, reto } = await pkce();
  const a = await m.aprobar('admin', cli, reto);
  assert.equal((await m.token({ grant_type: 'authorization_code', code: a.codigo, code_verifier: verificador, redirect_uri: REDIRECT, client_id: cli2 })).status, 400, 'otro cliente');
  const b = await m.aprobar('admin', cli, reto);
  assert.equal((await m.token({ grant_type: 'authorization_code', code: b.codigo, code_verifier: verificador, redirect_uri: 'https://claude.com/api/mcp/auth_callback', client_id: cli })).status, 400, 'otra dirección de vuelta');
  assert.equal((await m.token({ grant_type: 'authorization_code', code: b.codigo, code_verifier: verificador, redirect_uri: REDIRECT, client_id: 'mcp_' + '0'.repeat(32) })).status, 401, 'cliente que no existe');
  assert.equal((await m.token({ grant_type: 'password', client_id: cli })).j.error, 'unsupported_grant_type');
});

test('un editor NO obtiene token aunque llegue a tener un código (defensa en profundidad en /oauth/token)', opts, async () => {
  const m = await mundo();
  const cli = await m.registrar(); const { verificador, reto } = await pkce();
  const uid = m.db.prepare("select id from users where email = 'ed@panaclaw.test'").get().id;
  const codigo = 'c'.repeat(64);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codigo)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  m.db.prepare('insert into mcp_codigos (codigo_hash, client_id, user_id, redirect_uri, code_challenge, alcance, nombre, familia, caduca_at) values (?,?,?,?,?,?,?,?,?)').run(hash, cli, uid, REDIRECT, reto, 'lectura', 'x', 'f'.repeat(32), m.ahora() + 60_000);
  const r = await m.token({ grant_type: 'authorization_code', code: codigo, code_verifier: verificador, redirect_uri: REDIRECT, client_id: cli });
  assert.equal(r.status, 403); assert.equal(r.j.error, 'access_denied'); assert.equal(m.db.prepare('select count(*) n from mcp_tokens').get().n, 0);
});

test('RENOVAR: el testigo de renovación se ROTA en cada uso; reusar uno ya rotado CORTA toda la conexión', opts, async () => {
  const m = await mundo();
  const { cli, tokens: t0 } = await m.conectar({ alcance: 'oficina' });
  const r1 = await m.token({ grant_type: 'refresh_token', refresh_token: t0.refresh_token, client_id: cli });
  assert.equal(r1.status, 200); assert.notEqual(r1.j.refresh_token, t0.refresh_token); assert.notEqual(r1.j.access_token, t0.access_token); assert.equal(r1.j.scope, 'oficina');
  assert.equal((await m.rpc(r1.j.access_token, 'ping')).status, 200);
  assert.equal((await m.rpc(t0.access_token, 'ping')).status, 401, 'el de acceso viejo ya no vale');
  const r2 = await m.token({ grant_type: 'refresh_token', refresh_token: r1.j.refresh_token, client_id: cli });
  assert.equal(r2.status, 200);
  // alguien presenta el primero (ya rotado): se rechaza y se corta TODO, también lo vigente
  const reuso = await m.token({ grant_type: 'refresh_token', refresh_token: t0.refresh_token, client_id: cli });
  assert.equal(reuso.status, 400); assert.equal(reuso.j.error, 'invalid_grant');
  assert.equal((await m.rpc(r2.j.access_token, 'ping')).status, 401, 'la conexión entera quedó cortada');
  assert.equal((await m.token({ grant_type: 'refresh_token', refresh_token: r2.j.refresh_token, client_id: cli })).status, 400, 'y el vigente tampoco renueva');
  assert.equal(m.db.prepare('select count(*) n from mcp_tokens where revocado_at is null').get().n, 0);
  assert.match(m.db.prepare("select group_concat(detalle) d from auditoria where tipo = 'mcp'").get().d, /renovacion-reusada/);
});

test('RENOVAR: otro cliente no puede usar el testigo; y dos renovaciones a la vez con el mismo testigo cortan la conexión', opts, async () => {
  const m = await mundo();
  const { cli, tokens } = await m.conectar(); const otro = await m.registrar();
  assert.equal((await m.token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: otro })).status, 400);
  assert.equal((await m.rpc(tokens.access_token, 'ping')).status, 200, 'un intento ajeno no corta la conexión');
  const dos = await Promise.all([1, 2].map(() => m.token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: cli })));
  assert.equal(dos.filter((x) => x.status === 200).length <= 1, true, 'como mucho una gana');
  if (dos.some((x) => x.status !== 200)) { const ok = dos.find((x) => x.status === 200); if (ok) assert.equal((await m.rpc(ok.j.access_token, 'ping')).status, 401, 'la otra fue un reuso: se cortó todo'); }
});

test('CADUCIDAD: el de acceso vale 1 hora; el de renovación 30 días desde la última rotación; una conexión no pasa de 180 días', opts, async () => {
  const m = await mundo();
  const { cli, tokens } = await m.conectar();
  m.avanzar(59 * 60_000); assert.equal((await m.rpc(tokens.access_token, 'ping')).status, 200);
  m.avanzar(2 * 60_000); assert.equal((await m.rpc(tokens.access_token, 'ping')).status, 401, 'a la hora y un minuto, caducó');
  const r = await m.token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: cli }); assert.equal(r.status, 200);
  m.avanzar(29 * 864e5); const r2 = await m.token({ grant_type: 'refresh_token', refresh_token: r.j.refresh_token, client_id: cli }); assert.equal(r2.status, 200, 'rotar renueva los 30 días');
  m.avanzar(31 * 864e5); assert.equal((await m.token({ grant_type: 'refresh_token', refresh_token: r2.j.refresh_token, client_id: cli })).status, 400, 'a los 31 días sin usar, caducó');
  const m2 = await mundo(); const c = await m2.conectar(); let rt = c.tokens.refresh_token, ok = true, vueltas = 0;
  for (; ok && vueltas < 10; vueltas++) { m2.avanzar(29 * 864e5); const x = await m2.token({ grant_type: 'refresh_token', refresh_token: rt, client_id: c.cli }); ok = x.status === 200; if (ok) rt = x.j.refresh_token; }
  assert.ok(vueltas <= 7 && !ok, `la familia no pasa de 180 días (paró en la vuelta ${vueltas})`);
});

test('quien deja de ser administrador pierde la conexión AUNQUE nadie corte el testigo (el rol se relee de D1)', opts, async () => {
  const m = await mundo();
  const { tokens } = await m.conectar({ alcance: 'oficina' });
  m.db.prepare("update users set rol = 'editor' where email = 'dueno@panaclaw.test'").run();
  assert.equal((await m.rpc(tokens.access_token, 'ping')).status, 401);
  assert.equal(m.db.prepare('select count(*) n from mcp_tokens where revocado_at is null').get().n, 0, 'y quedó cortada para siempre');
  m.db.prepare("update users set rol = 'admin' where email = 'dueno@panaclaw.test'").run();
  assert.equal((await m.rpc(tokens.access_token, 'ping')).status, 401, 'volver a ser administrador no la resucita');
});

test('la pantalla de permiso sigue siendo SOLO del administrador aunque el interruptor se apague y se encienda', opts, async () => {
  const m = await mundo(); const cli = await m.registrar(); const { reto } = await pkce();
  await m.activar(false); assert.equal((await m.pantalla('admin', cli, reto)).status, 404);
  await m.activar(true); assert.equal((await m.pantalla('admin', cli, reto)).status, 200); assert.equal((await m.pantalla('editor', cli, reto)).status, 403);
});

test('con el interruptor APAGADO, una conexión que ya existía deja de valer (404) y al encenderlo vuelve', opts, async () => {
  const m = await mundo(); const { tokens } = await m.conectar();
  await m.activar(false); assert.equal((await m.rpc(tokens.access_token, 'ping')).status, 404);
  await m.activar(true); assert.equal((await m.rpc(tokens.access_token, 'ping')).status, 200);
});

test('ANTI-PHISHING: la pantalla avisa en grande, rotula el nombre como «declarado», enseña el origen verificado y pide confirmación reforzada para oficina y gasto', opts, async () => {
  const m = await mundo(); const cli = await m.registrar(REDIRECT, 'Soy Anthropic oficial'); const { reto } = await pkce();
  const p = await m.pantalla('admin', cli, reto);
  assert.match(p.html, /Aprueba solo si acabas de pulsar «Conectar» en Claude/); assert.match(p.html, /Si alguien te mandó este enlace, cancela/);
  assert.match(p.html, /lo declara ella, no está verificado/); assert.match(p.html, /Origen verificado al que volverá: <span class="c">https:\/\/claude\.ai\/api\/mcp\/auth_callback/); assert.match(p.html, /name="confirmo"/);
  assert.match(p.html, /name="alcance" value="lectura" checked/, 'por defecto sigue «lectura»');
  const campos = { ...m.paramsAut(cli, reto), csrf: p.csrf, decision: 'aprobar' };
  const post = (extra) => m.crudo('/conectar-claude', { metodo: 'POST', cookie: m.cookies.admin, form: { ...campos, ...extra } });
  for (const alcance of ['oficina', 'gasto']) {
    const sin = await post({ alcance }); assert.equal(sin.status, 400, alcance + ' sin confirmar'); assert.equal(sin.headers.get('location'), null);
    assert.equal((await post({ alcance, confirmo: 'quizas' })).status, 400, alcance + ' con una confirmación que no es «si»');
  }
  assert.equal(m.db.prepare('select count(*) n from mcp_codigos').get().n, 0, 'nada emitido sin la confirmación');
  assert.equal((await post({ alcance: 'lectura' })).status, 303, 'lectura no pide la casilla');
  assert.equal((await post({ alcance: 'oficina', confirmo: 'si' })).status, 303);
});

test('REGISTRO: ninguna IP gasta más de 10 por hora y un solo origen no agota el cupo global', opts, async () => {
  const m = await mundo();
  for (let i = 0; i < 10; i++) { m.avanzar(7000); assert.equal((await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { redirect_uris: [REDIRECT] } })).status, 201); }
  m.avanzar(7000); const r = await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { redirect_uris: [REDIRECT] } });
  assert.equal(r.status, 429); assert.match((await r.json()).error_description, /desde aquí/);
  assert.ok(m.db.prepare('select count(*) n from mcp_clientes').get().n < 60, 'el cupo global quedó casi entero');
  assert.ok(!m.db.prepare('select ip_huella h from mcp_clientes').all().some((f) => /\d+\.\d+/.test(f.h || '')), 'se guarda la huella, no la IP');
  m.avanzar(3600_000); assert.equal((await m.crudo('/oauth/register', { metodo: 'POST', cuerpo: { redirect_uris: [REDIRECT] } })).status, 201, 'una hora después, otra vez');
});

test('un código gastado NO corta la conexión si lo presenta OTRA aplicación', opts, async () => {
  const m = await mundo(); const a = await m.conectar(); const otra = await m.registrar();
  const r = await m.token({ grant_type: 'authorization_code', code: a.codigo, code_verifier: a.verificador, redirect_uri: REDIRECT, client_id: otra });
  assert.equal(r.status, 400);
  assert.equal((await m.rpc(a.tokens.access_token, 'ping')).status, 200, 'la conexión de la aplicación legítima sigue viva');
  const mismo = await m.token({ grant_type: 'authorization_code', code: a.codigo, code_verifier: a.verificador, redirect_uri: REDIRECT, client_id: a.cli });
  assert.equal(mismo.status, 400); assert.equal((await m.rpc(a.tokens.access_token, 'ping')).status, 401, 'pero la reutilización por su propio cliente sí la corta');
});

test('REVOCAR (RFC 7009): el cliente corta su propia conexión con su testigo; el de otro cliente no hace nada; siempre 200', opts, async () => {
  const m = await mundo();
  assert.equal((await (await m.crudo('/.well-known/oauth-authorization-server')).json()).revocation_endpoint, 'https://oficina.test/oauth/revoke');
  const a = await m.conectar(); const otra = await m.registrar();
  const rev = (token, client_id) => m.crudo('/oauth/revoke', { metodo: 'POST', form: { token, client_id } });
  assert.equal((await rev(a.tokens.refresh_token, otra)).status, 200); assert.equal((await m.rpc(a.tokens.access_token, 'ping')).status, 200, 'otro cliente no corta');
  assert.equal((await rev('basura', a.cli)).status, 200);
  assert.equal((await rev(a.tokens.access_token, a.cli)).status, 200); assert.equal((await m.rpc(a.tokens.access_token, 'ping')).status, 401);
  assert.equal((await m.token({ grant_type: 'refresh_token', refresh_token: a.tokens.refresh_token, client_id: a.cli })).status, 400, 'la renovación también murió');
  assert.equal((await rev('x', 'mcp_' + '0'.repeat(32))).status, 401);
  assert.equal((await m.crudo('/oauth/revoke', { metodo: 'GET' })).status, 405);
});
