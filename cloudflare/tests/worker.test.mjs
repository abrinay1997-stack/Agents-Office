import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';

async function entrar(env, cuenta) {
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: cuenta.email, contrasena: cuenta.clave } });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('salud pública, sin secretos; el resto pide sesión', { skip: SALTAR }, async () => {
  const env = envDePrueba(crearD1(), { ANTHROPIC_API_KEY: 'sk-ant-nunca-visible' });
  const h = await pedir(manejar, env, '/api/health');
  const cuerpo = await h.text();
  assert.equal(h.status, 200); assert.ok(!cuerpo.includes('sk-ant')); assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
  for (const ruta of ['/api/yo', '/api/agentes', '/api/conectores', '/api/ejecuciones']) assert.equal((await pedir(manejar, env, ruta)).status, 401, ruta);
});

test('contraseña mala = 401 genérico; buena = cookie __Host- HttpOnly Secure', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const c = await sembrar(d1); const env = envDePrueba(d1);
  assert.equal((await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: 'incorrecta' } })).status, 401);
  assert.equal((await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: 'nadie@x.test', contrasena: 'incorrecta' } })).status, 401);
  const ok = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: c.clave } });
  const sc = ok.headers.get('set-cookie');
  assert.match(sc, /^__Host-sesion=/); assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.ok(!/Domain=/i.test(sc));
  assert.ok(!d1._db.prepare('select token_hash from sessions').all().some((s) => sc.includes(s.token_hash)), 'se guarda el hash, no el testigo');
});

test('conectores: el admin los crea, el token jamás sale, el editor no puede, salir cierra la sesión', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const admin = await sembrar(d1); const ed = await sembrar(d1, { email: 'ed@x.test', rol: 'editor' });
  const env = envDePrueba(d1, { MCP_GMAIL_TOKEN: 'token-super-secreto' });
  const ca = await entrar(env, admin), ce = await entrar(env, ed);
  const nuevo = { nombre: 'gmail', url: 'https://gmail.mcp.example.com/mcp', secreto: 'MCP_GMAIL_TOKEN', departamentos: ['emails'], herramientas_lectura: ['search_threads'] };
  assert.equal((await pedir(manejar, env, '/api/conectores', { metodo: 'POST', cuerpo: nuevo, cookie: ce })).status, 403);
  const c = await pedir(manejar, env, '/api/conectores', { metodo: 'POST', cuerpo: nuevo, cookie: ca });
  assert.equal(c.status, 201);
  const malo = await pedir(manejar, env, '/api/conectores', { metodo: 'POST', cuerpo: { ...nuevo, secreto: 'ANTHROPIC_API_KEY' }, cookie: ca });
  assert.equal(malo.status, 422);
  const lista = await (await pedir(manejar, env, '/api/conectores', { cookie: ce })).text();
  assert.ok(!lista.includes('token-super-secreto')); assert.match(lista, /"tokenPuesto":true/);
  assert.equal((await pedir(manejar, env, '/api/salir', { metodo: 'POST', cookie: ca })).status, 200);
  assert.equal((await pedir(manejar, env, '/api/yo', { cookie: ca })).status, 401);
});

test('un POST desde otro origen se rechaza', { skip: SALTAR }, async () => {
  const env = envDePrueba(crearD1());
  const r = await manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { Origin: 'https://malo.example', 'content-type': 'application/json' }, body: '{}' }), env);
  assert.equal(r.status, 403);
});

test('un lector no puede ejecutar agentes; el agente inexistente da 404', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const admin = await sembrar(d1); const le = await sembrar(d1, { email: 'le@x.test', rol: 'lectura' });
  const env = envDePrueba(d1, { ANTHROPIC_API_KEY: 'k' });
  assert.equal((await pedir(manejar, env, '/api/agentes/elead/ejecutar', { metodo: 'POST', cuerpo: { texto: 'x' }, cookie: await entrar(env, le) })).status, 403);
  assert.equal((await pedir(manejar, env, '/api/agentes/noexiste/ejecutar', { metodo: 'POST', cuerpo: { texto: 'x' }, cookie: await entrar(env, admin) })).status, 404);
});
