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

// Fase 10: el acceso y la invitación son nativos y con CSP estricta; lo de la nube (nube.js, dictado) pide sesión; el Hub no se alcanza desde fuera
const lg = await fetch(`${base}/login.html`);
ok(lg.status === 200 && !/unsafe-inline/.test(lg.headers.get('content-security-policy') || ''), 'el acceso lleva CSP sin unsafe-inline');
for (const r of ['/nube.js', '/nube.css', '/dictado.js']) ok((await fetch(base + r)).status === 401, `${r} sin sesión da 401`);
const inv = await fetch(`${base}/invitacion/${'0'.repeat(48)}`);
ok(inv.status === 200 && /invitacion\.js/.test(await inv.text()), 'la página de invitación se sirve sin sesión');
ok((await fetch(`${base}/api/invitacion/${'0'.repeat(48)}`)).status === 404, 'una invitación inventada contesta 404');
ok((await fetch(`${base}/api/live`, { headers: { Upgrade: 'websocket', Origin: base } })).status === 401, 'el socket en vivo exige sesión');

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
