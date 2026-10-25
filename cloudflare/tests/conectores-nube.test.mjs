// Conectores MCP desde la página (25 oct 2026): añadir con plantilla e icono, token cifrado en D1 (o secreto del Worker), probar conexión con SSRF controlado, y que
// NINGÚN token salga en una respuesta, un registro, la auditoría ni D1 en claro (barrido de centinelas, como la revisión transversal).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, tareaEnDisco, crearFetch, texto, usar, minutos, filas, pagina, todoD1, URL_MCP } from './agentes-ayudas.mjs';
import { cifrar, descifrar, hayClave } from '../worker/lib/cifrado.js';
import { validarConector, urlPermitida, urlVisible, publico } from '../worker/lib/conectores.js';
import { PLANTILLAS, iconoUri, svgDe, colorDeNombre } from '../worker/lib/iconos-conectores.js';
import { resumenMcp } from '../worker/lib/mcp-estado.js';

const CLAVE = 'una-clave-de-cifrado-muy-larga-de-prueba-0123456789'; // secrets-ok
const CENT = 'CENTINELA-token-conector-9f8e7d6c5b4a'; // secrets-ok
const GRANDE = { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' };
const URL_N = 'https://mcp.zapier.example.com/api/mcp';
const MCP = () => ({ search_threads: { salida: 'Hilo con Ana: pide el precio.' }, create_draft: { salida: 'borrador' }, send_email: { salida: 'enviado' } });
const NUEVO = (o = {}) => ({ nombre: 'zapier', etiqueta: 'Zapier de Ana', plantilla: 'zapier', url: URL_N, auth_tipo: 'bearer', token: CENT, departamentos: ['emails'], herramientas_lectura: ['search_threads', 'create_draft'], herramientas_envio: ['send_email'], ...o });

test('cifrado: ida y vuelta; otro nombre, otra clave o datos tocados NO abren; cada cifrado lleva su IV; sin clave no hay «cifrado de adorno»', async () => {
  const env = { AO_CLAVE_CIFRADO: CLAVE };
  const c = await cifrar(env, CENT, 'zapier');
  assert.match(c, /^v1\.[\w-]+\.[\w-]+$/); assert.equal(c.includes(CENT), false);
  assert.equal(await descifrar(env, c, 'zapier'), CENT);
  assert.equal(await descifrar(env, c, 'otro'), null, 'copiado a otro conector no abre');
  assert.equal(await descifrar({ AO_CLAVE_CIFRADO: CLAVE + 'x' }, c, 'zapier'), null, 'otra clave');
  assert.equal(await descifrar(env, c.slice(0, -3) + 'AAA', 'zapier'), null, 'datos tocados');
  assert.notEqual(await cifrar(env, CENT, 'zapier'), c, 'IV distinto cada vez');
  assert.equal(hayClave({ AO_CLAVE_CIFRADO: 'corta' }), false);
  await assert.rejects(() => cifrar({}, CENT, 'zapier'), /AO_CLAVE_CIFRADO/);
  await assert.rejects(() => cifrar({ AO_CLAVE_CIFRADO: 'corta' }, CENT, 'zapier'), /AO_CLAVE_CIFRADO/);
});

test('validar: autenticación, cabecera propia, token pegado con «Bearer» o con salto de línea, y las combinaciones que no valen', () => {
  const ok = (o) => validarConector({ nombre: 'zapier', url: URL_N, ...o });
  assert.equal(ok({ auth_tipo: 'ninguna' }).ok, true);
  assert.equal(ok({ auth_tipo: 'bearer', token: CENT }).ok, true);
  const h = ok({ auth_tipo: 'cabecera', cabecera: 'X-API-Key', token: CENT }); assert.equal(h.ok, true); assert.equal(h.valor.cabecera, 'X-API-Key'); assert.equal(JSON.stringify(h.valor).includes(CENT), false, 'el token va aparte del valor');
  for (const mala of ['Authorization', 'Cookie', 'Host', 'mcp-session-id', 'Content-Length', 'X-Forwarded-For', 'Sec-Fetch-Mode', 'x y', '']) assert.equal(ok({ auth_tipo: 'cabecera', cabecera: mala, token: CENT }).ok, false, mala);
  assert.equal(ok({ auth_tipo: 'bearer', token: 'Bearer ' + CENT }).ok, false);
  assert.equal(ok({ auth_tipo: 'bearer', token: CENT + '\nX-Otra: 1' }).ok, false, 'un salto de línea en el token es inyectar una cabecera');
  assert.equal(ok({ auth_tipo: 'bearer', token: 'corto' }).ok, false);
  assert.equal(ok({ auth_tipo: 'ninguna', token: CENT }).ok, false);
  assert.equal(ok({ auth_tipo: 'bearer', token: CENT, secreto: 'MCP_ZAPIER_TOKEN' }).ok, false, 'o el token aquí o un secreto, no los dos');
  assert.equal(ok({ auth_tipo: 'otra' }).ok, false);
  assert.equal(ok({ plantilla: 'inventada' }).ok, false);
  assert.equal(ok({ herramientas_lectura: ['send_email'] }).ok, false, 'el candado de lectura sigue igual');
  assert.equal(validarConector({ nombre: 'gmail', url: 'https://x.example.com/mcp', secreto: 'MCP_GMAIL_TOKEN' }).valor.auth_tipo, 'bearer', 'lo de antes (con secreto) sigue siendo Bearer');
});

test('SSRF: solo https públicos; ni localhost, ni IP (ni en decimal o hex), ni .lan/.internal/.local, ni puertos de servicios internos', () => {
  assert.equal(urlPermitida('https://mcp.zapier.example.com/api'), null);
  assert.equal(urlPermitida('https://mcp.example.com:8443/x'), null);
  for (const mala of ['http://x.example.com', 'https://localhost/x', 'https://localhost./x', 'https://app.localhost/x', 'https://127.0.0.1/x', 'https://2130706433/x', 'https://0x7f.0.0.1/x', 'https://169.254.169.254/latest', 'https://10.0.0.5/x',
    'https://[::1]/x', 'https://[::ffff:127.0.0.1]/x', 'https://metadata.google.internal/x', 'https://nas.lan/x', 'https://wiki.intranet/x', 'https://router.home.arpa/x', 'https://srv.corp/x',
    'https://db.example.com:5432/x', 'https://redis.example.com:6379/', 'https://u:p@x.example.com/', 'ftp://x.example.com', 'javascript:alert(1)', 'https://sinpunto/x'])
    assert.ok(urlPermitida(mala), mala);
});

test('iconos: cada plantilla tiene el suyo, todos son data: URI sin hosts externos; el monograma es estable y distinto por nombre', () => {
  for (const id of ['zapier', 'n8n', 'make', 'gmail', 'google-calendar', 'google-drive', 'slack', 'notion', 'github', 'stripe', 'hubspot', 'airtable', 'canva', 'cloudflare', 'linear', 'asana', 'meta-ads', 'otro']) assert.ok(PLANTILLAS.some((p) => p.id === id), id);
  const vistos = new Set();
  for (const p of PLANTILLAS) {
    const svg = svgDe({ plantilla: p.id, nombre: p.nombre });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); assert.equal((svg.match(/https?:\/\//g) || []).length, 1, `${p.id}: nada se carga de fuera (solo el xmlns)`); assert.doesNotMatch(svg, /<image|href=|<script|onload/i);
    assert.match(iconoUri({ plantilla: p.id }), /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
    if (p.id !== 'otro') vistos.add(svg);
  }
  assert.equal(vistos.size, PLANTILLAS.length - 1, 'dos plantillas no comparten pictograma y color');
  assert.equal(svgDe({ nombre: 'Mi CRM' }), svgDe({ nombre: 'Mi CRM' })); assert.notEqual(colorDeNombre('Mi CRM'), colorDeNombre('Otro'));
  assert.match(svgDe({ nombre: 'Mi CRM' }), />MC</);
  assert.doesNotMatch(svgDe({ nombre: '<b>x</b>' }), /<b>/, 'un nombre con HTML no se cuela en el SVG');
});

test('publico(): la dirección con un token dentro se enseña tapada; nunca sale el token ni el texto cifrado', () => {
  assert.equal(urlVisible('https://mcp.zapier.com/api/mcp/s/abcdefghij0123456789KLMN/mcp?key=1'), 'https://mcp.zapier.com/api/mcp/s/…/mcp?…');
  assert.equal(urlVisible(URL_N), URL_N);
  const p = publico({ id: '1', nombre: 'zapier', url: 'https://mcp.zapier.com/s/abcdefghij0123456789KLMN', secreto: null, auth_tipo: 'bearer', token_cifrado: 'v1.aaaa.bbbb', activo: 1, departamentos: '[]', herramientas_lectura: '[]', herramientas_envio: '[]' }, {});
  assert.equal(p.tokenGuardado, true); assert.equal(p.tokenPuesto, true); assert.equal(JSON.stringify(p).includes('v1.aaaa'), false); assert.equal(JSON.stringify(p).includes('abcdefghij0123456789KLMN'), false);
  assert.equal(publico({ id: '1', nombre: 'x', url: URL_N, auth_tipo: 'bearer', activo: 1 }, {}).tokenPuesto, false);
});

test('API: solo un administrador cambia o prueba; todos ven la lista y las plantillas; añadir con token cifrado; el centinela no sale en NINGÚN sitio', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { ...GRANDE, AO_CLAVE_CIFRADO: CLAVE }, conector: false });
  const p = await pagina({ d1, env });
  for (const quien of ['editor', 'lectura']) {
    assert.equal((await p[quien]('POST', '/api/conectores', NUEVO())).status, 403, quien);
    assert.equal((await p[quien]('POST', '/api/conectores/probar', { url: URL_N })).status, 403, quien);
    assert.equal((await p[quien]('PUT', '/api/conectores/zapier/token', { token: CENT })).status, 403, quien);
    assert.equal((await p[quien]('PATCH', '/api/conectores/zapier', { activo: false })).status, 403, quien);
    assert.equal((await p[quien]('DELETE', '/api/conectores/zapier')).status, 403, quien);
    assert.equal((await p[quien]('GET', '/api/conectores')).status, 200, quien); assert.equal((await p[quien]('GET', '/api/conectores/plantillas')).status, 200, quien);
  }
  const mal = await p.admin('POST', '/api/conectores', NUEVO({ url: 'https://127.0.0.1/mcp' })); assert.equal(mal.status, 422);
  const r = await p.admin('POST', '/api/conectores', NUEVO()); assert.equal(r.status, 201);
  assert.equal(r.j.conector.tokenGuardado, true); assert.equal(r.j.conector.tokenPuesto, true); assert.match(r.j.conector.iconUri, /^data:image\/svg\+xml/);
  const fila = filas(d1, 'select * from conectores_extra')[0];
  assert.match(fila.token_cifrado, /^v1\./); assert.equal(fila.token_cifrado.includes(CENT), false);
  // el barrido: ninguna respuesta, ninguna fila de D1 (ni auditoría) lleva el centinela
  const respuestas = [r.texto];
  for (const ruta of ['/api/conectores', '/api/conectores/plantillas', '/api/mcp', '/api/status', '/api/ejecuciones', '/api/health']) for (const quien of ['admin', 'editor', 'lectura']) respuestas.push((await p[quien]('GET', ruta)).texto);
  for (const t of respuestas) { assert.equal(t.includes(CENT), false, 'centinela en una respuesta'); assert.equal(t.includes(fila.token_cifrado), false, 'el texto cifrado tampoco sale'); }
  const todo = todoD1(d1); assert.equal(todo.includes(CENT), false, 'centinela en D1');
  assert.ok(filas(d1, "select detalle from auditoria where tipo = 'conector'").length >= 1);
  // reemplazar y borrar el token
  const rep = await p.admin('PUT', '/api/conectores/zapier/token', { token: CENT + '-2' }); assert.equal(rep.status, 200); assert.equal(rep.texto.includes(CENT), false);
  assert.notEqual(filas(d1, 'select token_cifrado t from conectores_extra')[0].t, fila.token_cifrado);
  assert.equal((await p.admin('PUT', '/api/conectores/zapier/token', { token: 'Bearer ' + CENT })).status, 422);
  const sin = await p.admin('DELETE', '/api/conectores/zapier/token'); assert.equal(sin.j.conector.tokenGuardado, false); assert.equal(sin.j.conector.tokenPuesto, false);
  const aud = filas(d1, "select detalle from auditoria where tipo like 'conector%'").map((a) => a.detalle).join('\n'); assert.equal(aud.includes(CENT), false); assert.match(aud, /"accion":"guardado"/); assert.match(aud, /"accion":"quitado"/);
  assert.equal(todoD1(d1).includes(CENT), false);
  // apagar y quitar
  assert.equal((await p.admin('PATCH', '/api/conectores/zapier', { activo: false })).j.conector.activo, false);
  assert.equal((await p.admin('DELETE', '/api/conectores/zapier')).status, 200);
  assert.equal(filas(d1, 'select count(*) n from conectores_extra')[0].n, 0, 'no queda ni el token');
});

test('sin AO_CLAVE_CIFRADO el token NO se guarda (409 con el motivo) y un secreto del Worker sigue siendo el camino', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, conector: false });
  const p = await pagina({ d1, env });
  const r = await p.admin('POST', '/api/conectores', NUEVO()); assert.equal(r.status, 409); assert.match(r.j.error, /AO_CLAVE_CIFRADO/);
  assert.equal(filas(d1, 'select count(*) n from conectores_extra')[0].n, 0);
  const s = await p.admin('POST', '/api/conectores', NUEVO({ token: undefined, secreto: 'MCP_ZAPIER_TOKEN' })); assert.equal(s.status, 201); assert.equal(s.j.conector.tokenPuesto, false, 'el secreto aún no está en el Worker');
  assert.equal((await p.admin('GET', '/api/mcp')).j.servers[0].status, 'needs-auth');
  env.MCP_ZAPIER_TOKEN = 'tok-del-worker-xyz'; assert.equal((await p.admin('GET', '/api/mcp')).j.servers[0].status, 'connected');
});

test('un token guardado trabaja de verdad: llega al servidor MCP como Bearer (o en SU cabecera), en las tareas, y no sale de ahí', { skip: SALTAR }, async () => {
  for (const modo of ['bearer', 'cabecera']) {
    const { d1, env } = await oficina({ env: { ...GRANDE, AO_CLAVE_CIFRADO: CLAVE }, conector: false });
    const p = await pagina({ d1, env });
    d1._db.prepare("insert into conectores (id,nombre,url,secreto,departamentos,herramientas_lectura,herramientas_envio,activo,created_at) values ('1','gmail',?,NULL,'[]','[]','[]',1,'x')").run(URL_MCP); // el nombre «gmail» ya lo usa el stand del servidor
    const r = await p.admin('POST', '/api/conectores', NUEVO({ nombre: 'gmail', url: URL_MCP, auth_tipo: modo, cabecera: modo === 'cabecera' ? 'X-API-Key' : undefined }));
    assert.equal(r.status, 200, r.texto);
    const t = await tarea(env, { text: 'Revisa el hilo de Ana.' });
    const mcp = MCP();
    const f = crearFetch({ herramientasMcp: mcp, tokenMcp: CENT, guion: [usar(['mcp__gmail__search_threads', { query: 'Ana' }]), texto('Listo.\nFuentes: hilo.')] });
    // el stand compara `authorization`; para la cabecera propia se traduce, sin dejar de comprobar que es ESA cabecera la que lleva el token
    const vistas = [];
    const ff = async (url, init = {}) => { if (String(url) === URL_MCP) { vistas.push(init.headers); if (modo === 'cabecera') { assert.equal(init.headers['x-api-key'], CENT); assert.equal(init.headers.authorization, undefined); init = { ...init, headers: { ...init.headers, authorization: `Bearer ${CENT}` } }; } } return f.fetchFn(url, init); };
    await minutos(env, ff);
    const d = await tareaEnDisco(d1, t.id);
    assert.equal(d.state, 'done'); assert.equal(d.error, false, modo); assert.equal(mcp.search_threads.llamadas, 1, modo);
    if (modo === 'bearer') assert.ok(vistas.every((h) => h.authorization === `Bearer ${CENT}`));
    assert.equal(todoD1(d1).includes(CENT), false, 'el token no quedó en D1 tras correr la tarea');
    assert.equal(JSON.stringify(f.registro.anthropic.map((x) => x.cuerpo)).includes(CENT), false, 'ni en lo que se le mandó al modelo');
    // el candado de envío es el de siempre: send_email no se ofrece antes del OK
    assert.ok(!f.registro.anthropic[0].cuerpo.tools.some((h) => h.name === 'mcp__gmail__send_email'));
  }
});

test('cambiar el conector de servidor suelta su token guardado (no viaja a otra dirección); la clave de cifrado perdida se dice en palabras', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { ...GRANDE, AO_CLAVE_CIFRADO: CLAVE }, conector: false });
  const p = await pagina({ d1, env });
  await p.admin('POST', '/api/conectores', NUEVO());
  const mismo = await p.admin('POST', '/api/conectores', NUEVO({ token: undefined, etiqueta: 'Otro nombre' })); assert.equal(mismo.j.conector.tokenGuardado, true, 'misma dirección: el token se conserva');
  const otro = await p.admin('POST', '/api/conectores', NUEVO({ token: undefined, url: 'https://otro-servidor.example.net/mcp' })); assert.equal(otro.j.conector.tokenGuardado, false, 'otra dirección: el token se va');
  // el secreto de cifrado cambió: el token ya no abre, el conector «pide el token» y la tarea lo dice
  await p.admin('POST', '/api/conectores', NUEVO({ nombre: 'gmail', url: URL_MCP }));
  env.AO_CLAVE_CIFRADO = CLAVE + '-nueva';
  const t = await tarea(env, { text: 'Revisa el hilo de Ana.' });
  const f = crearFetch({ herramientasMcp: MCP(), tokenMcp: CENT, guion: [texto('Hecho.\nFuentes: —')] });
  await minutos(env, f.fetchFn);
  assert.equal(f.registro.mcp.length, 0, 'sin token abrible no se llama al servidor');
  assert.equal(f.registro.anthropic[0].cuerpo.tools.some((h) => /^mcp__gmail__/.test(h.name)), false);
});

test('probar conexión: lista las herramientas con lectura/envío; el error sale en palabras; las direcciones peligrosas ni se llaman', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { ...GRANDE, AO_CLAVE_CIFRADO: CLAVE }, conector: false });
  const p = await pagina({ d1, env });
  const f = crearFetch({ herramientasMcp: MCP(), tokenMcp: CENT }); const llamadas = []; env.__pruebas = { fetch: async (u, i) => { llamadas.push(String(u)); return f.fetchFn(u, i); } };
  const ok = await p.admin('POST', '/api/conectores/probar', { url: URL_MCP, auth_tipo: 'bearer', token: CENT });
  assert.equal(ok.j.ok, true); assert.deepEqual(ok.j.herramientas.map((h) => [h.name, h.tipo]).sort(), [['create_draft', 'lectura'], ['search_threads', 'lectura'], ['send_email', 'envio']]);
  assert.equal(ok.j.lectura, 2); assert.equal(ok.j.envio, 1); assert.equal(ok.texto.includes(CENT), false); assert.equal(filas(d1, 'select count(*) n from conectores_extra')[0].n, 0, 'probar no guarda nada');
  const mal = await p.admin('POST', '/api/conectores/probar', { url: URL_MCP, auth_tipo: 'bearer', token: 'otro-token-equivocado-123' }); assert.equal(mal.j.ok, false); assert.match(mal.j.error, /rechazó el acceso.*401\/403/); // secrets-ok
  const sinTok = await p.admin('POST', '/api/conectores/probar', { url: URL_MCP, auth_tipo: 'bearer' }); assert.equal(sinTok.j.ok, false); assert.match(sinTok.j.error, /Falta el token/);
  llamadas.length = 0;
  for (const peligrosa of ['https://127.0.0.1/mcp', 'https://localhost/mcp', 'http://x.example.com/mcp', 'https://nas.lan/mcp', 'https://169.254.169.254/latest/meta-data']) { const r = await p.admin('POST', '/api/conectores/probar', { url: peligrosa, auth_tipo: 'ninguna' }); assert.equal(r.status, 422, peligrosa); }
  assert.deepEqual(llamadas, [], 'las peligrosas ni se intentaron');
  env.__pruebas = { fetch: async (u) => (String(u).includes('/web') ? new Response('<html>hola</html>', { status: 200, headers: { 'content-type': 'text/html' } }) : String(u).includes('/falta') ? new Response('no', { status: 404 }) : String(u).includes('/lento') ? Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })) : String(u).includes('/redir') ? new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/' } }) : Promise.reject(new Error('fetch failed'))) };
  for (const [ruta, re] of [['/web', /no habla MCP/], ['/falta', /no existe \(404\)/], ['/lento', /tardó demasiado/], ['/redir', /redirige a otra/], ['/caido', /No se pudo conectar/]]) {
    const r = await p.admin('POST', '/api/conectores/probar', { url: 'https://servidor.example.org' + ruta, auth_tipo: 'ninguna' }); assert.equal(r.j.ok, false, ruta); assert.match(r.j.error, re, ruta);
  }
  // con un conector ya guardado, probar sin volver a pegar el token usa el suyo
  await p.admin('POST', '/api/conectores', NUEVO({ nombre: 'gmail', url: URL_MCP }));
  env.__pruebas = { fetch: f.fetchFn };
  const guardado = await p.admin('POST', '/api/conectores/probar', { nombre: 'gmail', url: URL_MCP, auth_tipo: 'bearer' }); assert.equal(guardado.j.ok, true);
  const otraUrl = await p.admin('POST', '/api/conectores/probar', { nombre: 'gmail', url: 'https://otro.example.net/mcp', auth_tipo: 'bearer' }); assert.equal(otraUrl.j.ok, false, 'el token guardado no se manda a otra dirección');
});

test('/api/mcp: cada conector con su icono y su estado; sin token pide autorización y dice dónde ponerlo', () => {
  const fila = (o) => ({ nombre: 'zapier', url: URL_N, secreto: null, departamentos: '["emails"]', herramientas_lectura: '["a"]', herramientas_envio: '[]', activo: 1, auth_tipo: 'bearer', plantilla: 'zapier', etiqueta: 'Zapier de Ana', ...o });
  const r = (o, env) => resumenMcp({ filas: [fila(o)], env: env || {}, cfg: {} }).servers[0];
  assert.equal(r({}).status, 'needs-auth'); assert.match(r({}).detail, /Ajustes → Conectores/); assert.equal(r({ token_cifrado: 'v1.a.b' }).status, 'connected'); assert.equal(r({ auth_tipo: 'ninguna' }).status, 'connected');
  assert.equal(r({ activo: 0 }).status, 'disabled'); assert.match(r({}).iconUri, /^data:image\/svg\+xml/); assert.equal(r({}).name, 'Zapier de Ana');
  assert.equal(r({ plantilla: null, etiqueta: null, nombre: 'mi-crm' }).iconUri === r({ plantilla: null, etiqueta: null, nombre: 'otro-crm' }).iconUri, false);
});
