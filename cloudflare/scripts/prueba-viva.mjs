#!/usr/bin/env node
// Prueba contra el sitio YA publicado en Cloudflare (SITIO_URL). Comprueba que lo desplegado es lo que se cree:
// salud, cabeceras de seguridad, que /api pide sesión y, si hay credenciales, que el acceso y los conectores responden.
// Nunca escribe nada ni imprime secretos.
const base = (process.env.SITIO_URL || '').replace(/\/$/, '');
if (!base) { console.error('Falta SITIO_URL.'); process.exit(1); }
const fallos = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fallos.push(m); };

const h = await fetch(`${base}/api/health`);
const salud = await h.json().catch(() => ({}));
ok(h.status === 200 && salud.ok === true, '/api/health responde ok');
ok(h.headers.get('x-content-type-options') === 'nosniff', 'la API lleva X-Content-Type-Options');
ok(/no-store/.test(h.headers.get('cache-control') || ''), 'la API no se cachea');
ok(!JSON.stringify(salud).match(/sk-ant|Bearer|token/i), '/api/health no filtra secretos');
if (process.env.ESPERA_VERSION) ok(salud.version === process.env.ESPERA_VERSION, `versión desplegada = ${process.env.ESPERA_VERSION} (es ${salud.version})`);

const sin = await fetch(`${base}/api/conectores`);
ok(sin.status === 401, '/api/conectores sin sesión da 401');
const raiz = await fetch(base);
ok(raiz.status === 200 && /text\/html/.test(raiz.headers.get('content-type') || ''), 'la página se sirve');
ok(/default-src 'self'/.test(raiz.headers.get('content-security-policy') || ''), 'la página lleva CSP');

// Fase 0a (SEG-08, WEB-06, PER-01): cabeceras de transporte y permisos en lo que genera el Worker (la API) y en lo que sirve Static Assets (el acceso)
for (const [nombre, r] of [['la API', h], ['el acceso', await fetch(`${base}/login.html`)]]) {
  ok(/max-age=\d{7,}/.test(r.headers.get('strict-transport-security') || ''), `${nombre} lleva HSTS`);
  ok(/microphone=\(self\)/.test(r.headers.get('permissions-policy') || ''), `${nombre} lleva Permissions-Policy con microphone=(self)`);
  ok((r.headers.get('cross-origin-opener-policy') || '') === 'same-origin', `${nombre} lleva COOP same-origin`);
}
{ // la compresión: fetch() de Node pide gzip/br y la descomprime sola, pero la cabecera dice si Cloudflare la aplicó. Es un aviso, no un fallo (depende del tamaño y de la zona).
  const c = await fetch(`${base}/login.html`, { headers: { 'accept-encoding': 'br, gzip' } });
  const enc = c.headers.get('content-encoding') || '';
  if (!/br|gzip|zstd/.test(enc)) console.log('::warning::PER-01: /login.html no salió comprimido (content-encoding vacío). Revisa la compresión de la zona y que el Worker no la quite.');
  else console.log(`✓ el acceso sale comprimido (${enc})`);
}

// Fase 10: el acceso y la invitación son nativos y con CSP estricta; lo de la nube (nube.js, dictado) pide sesión; el Hub no se alcanza desde fuera
const lg = await fetch(`${base}/login.html`);
ok(lg.status === 200 && !/unsafe-inline/.test(lg.headers.get('content-security-policy') || ''), 'el acceso lleva CSP sin unsafe-inline');
for (const r of ['/nube.js', '/nube.css', '/nube-modelos.js', '/nube-conectores.js', '/nube-cerebro.js', '/nube-notas.js', '/nube-chat.js', '/dictado.js']) ok((await fetch(base + r)).status === 401, `${r} sin sesión da 401`);
const inv = await fetch(`${base}/invitacion/${'0'.repeat(48)}`);
ok(inv.status === 200 && /invitacion\.js/.test(await inv.text()), 'la página de invitación se sirve sin sesión');
const falsa = await fetch(`${base}/api/invitacion/ver`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ testigo: '0'.repeat(48) }) });
ok(falsa.status === 404, `una invitación inventada contesta 404 (contestó ${falsa.status})`);
ok((await fetch(`${base}/api/invitacion/${'0'.repeat(48)}`)).status !== 200, 'la invitación ya no se consulta con el testigo en la dirección');
// fetch() no deja poner la cabecera Upgrade (undici la rechaza): se pide con node:https, que sí
const estadoSocket = await new Promise((resolve) => {
  const u = new URL(`${base}/api/live`);
  const lib = u.protocol === 'http:' ? 'node:http' : 'node:https';
  import(lib).then(({ request }) => {
    const r = request(u, { headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', Origin: base } }, (res) => { res.resume(); resolve(res.statusCode); });
    r.on('upgrade', () => resolve(101)); r.on('error', () => resolve(0)); r.setTimeout(15000, () => { r.destroy(); resolve(0); }); r.end();
  });
});
ok(estadoSocket === 401, `el socket en vivo exige sesión (contestó ${estadoSocket})`);

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const a = await fetch(`${base}/api/acceso`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, contrasena: process.env.ADMIN_PASSWORD }) });
  const cookie = (a.headers.get('set-cookie') || '').split(';')[0];
  ok(a.status === 200 && cookie.startsWith('__Host-sesion='), 'el administrador puede entrar');
  if (cookie) {
    const c = await fetch(`${base}/api/conectores`, { headers: { cookie } });
    const d = await c.json().catch(() => ({}));
    ok(c.status === 200 && Array.isArray(d.conectores), 'la lista de conectores responde');
    ok(!/authorization_token|Bearer /.test(JSON.stringify(d)), 'los conectores no enseñan tokens');
    await fetch(`${base}/api/salir`, { method: 'POST', headers: { cookie } });
  }
}
if (fallos.length) { console.error(`\n${fallos.length} fallo(s).`); process.exit(1); }
console.log('\nTodo bien.');
