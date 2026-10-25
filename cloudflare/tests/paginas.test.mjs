import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';

async function entrar(env, c) {
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: c.email, contrasena: c.clave } });
  return r.headers.get('set-cookie').split(';')[0];
}

test('sin sesión solo se ve el acceso; con sesión, la oficina real y sus paquetes', { skip: SALTAR }, async () => {
  const d1 = crearD1(); const c = await sembrar(d1); const env = envDePrueba(d1);
  const t = async (ruta, cookie) => { const r = await pedir(manejar, env, ruta, { cookie }); return { s: r.status, t: await r.text(), loc: r.headers.get('location') }; };
  assert.equal((await t('/')).t, 'ASSET:/login.html');
  assert.equal((await t('/login.js')).t, 'ASSET:/login.js');
  for (const ruta of ['/estudio-extra.js', '/tareas-vista.js', '/anuncios-vista.js', '/pieza-editor.js', '/movil.js', '/movil-d.js']) assert.equal((await t(ruta)).s, 401, ruta); // 25 oct 2026: la versión móvil es otro paquete que exige sesión
  const p = await t('/panel'); assert.equal(p.s, 302); assert.match(p.loc, /\/$/);
  assert.equal((await t('/oficina/index.html')).s, 404); // el archivo de la oficina no se pide directo

  const ck = await entrar(env, c);
  assert.equal((await t('/', ck)).t, 'ASSET:/oficina/index.html');
  assert.equal((await t('/estudio-extra.js', ck)).t, 'ASSET:/oficina/estudio-extra.js');
  assert.equal((await t('/movil.js', ck)).t, 'ASSET:/oficina/movil.js', 'la versión móvil sale del mismo sitio que los demás paquetes');
  assert.equal((await t('/movil-d.js', ck)).t, 'ASSET:/oficina/movil-d.js', 'y el paquete de Contenido, Analíticas y Anuncios de la versión móvil, también');
  assert.equal((await t('/panel', ck)).t, 'ASSET:/panel.html');
  assert.equal((await t('/app.js', ck)).t, 'ASSET:/app.js');
  assert.equal((await t('/no-existe', ck)).s, 404);
  assert.equal((await t('/../etc/passwd', ck)).s, 404);
});

test('las páginas solo se piden con GET', { skip: SALTAR }, async () => {
  const env = envDePrueba(crearD1());
  assert.equal((await pedir(manejar, env, '/', { metodo: 'POST', cuerpo: {} })).status, 405);
});

test('copiar-oficina lleva movil.js junto a la página y el Worker lo declara como paquete', async () => {
  const { ARCHIVOS } = await import('../scripts/copiar-oficina.mjs');
  assert.equal(ARCHIVOS['movil.js'], 'movil.js'); assert.equal(ARCHIVOS['movil-d.js'], 'movil-d.js');
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../worker/lib/paginas.js', import.meta.url), 'utf8'), /PAQUETES = new Set\(\[[^\]]*'\/movil\.js'[^\]]*'\/movil-d\.js'/);
});
