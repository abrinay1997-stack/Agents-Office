// SEG-06 — retroceso creciente por correo en el acceso. Lo esencial: retrasa, NUNCA rechaza por intentos ajenos; apagado, nada cambia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR, crearD1, sembrar, envDePrueba } from './d1-memoria.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { guardarDoc } from '../worker/lib/almacen.js';
import { olvidarRetroceso, esperaMs, GRATIS, ESPERA_MAX_MS } from '../worker/lib/retroceso.js';

async function mundo({ flag = false } = {}) {
  const d1 = crearD1(), c = await sembrar(d1, { email: 'ana@panaclaw.test' }), esperas = [];
  let reloj = Date.now();
  const env = envDePrueba(d1, { RELOJ_MS: () => reloj, __pruebas: { dormir: async (ms) => { esperas.push(ms); } } });
  if (flag) { await guardarDoc(d1, 'config-local', { acceso: { retroceso: true } }); olvidarRetroceso(d1); }
  let n = 0;
  const entrar = (email, contrasena, ip) => manejar(new Request('https://oficina.test/api/acceso', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip ?? `10.0.${Math.floor(++n / 250)}.${n % 250}` }, body: JSON.stringify({ email, contrasena }) }), env);
  return { d1, db: d1._db, c, env, esperas, entrar, avanzar: (ms) => { reloj += ms; } };
}
const MALA = 'contraseña-equivocada-1';

test('puro: gratis hasta 3 fallos, luego 1, 2, 4… s con tope de 30 s', () => {
  assert.deepEqual([0, 1, 2, 3].map(esperaMs), [0, 0, 0, 0]);
  assert.deepEqual([4, 5, 6, 7].map(esperaMs), [1000, 2000, 4000, 8000]);
  assert.equal(esperaMs(99), ESPERA_MAX_MS); assert.equal(GRATIS, 3);
});

test('flag APAGADO: nada cambia (ni espera ni contador) aunque lluevan fallos de otras IP', { skip: SALTAR }, async () => {
  const m = await mundo();
  for (let i = 0; i < 6; i++) assert.equal((await m.entrar(m.c.email, MALA)).status, 401);
  const r = await m.entrar(m.c.email, m.c.clave); assert.equal(r.status, 200);
  assert.deepEqual(m.esperas, []); assert.equal(m.db.prepare("select count(*) n from acceso_intentos where clave like 'acc:mail:%'").get().n, 0);
});

test('flag ENCENDIDO: del 4.º fallo en adelante cada intento espera 1, 2, 4 s… y los fallos se cuentan por correo, de cualquier IP', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  for (let i = 0; i < 7; i++) assert.equal((await m.entrar(m.c.email, MALA)).status, 401, 'siempre 401 con la contraseña mala, nunca 429 por este contador');
  assert.deepEqual(m.esperas.filter((x) => x > 0), [1000, 2000, 4000], 'el 5.º, 6.º y 7.º intento esperaron lo que tocaba');
  assert.equal(Number(m.db.prepare("select sum(n) n from acceso_intentos where clave = ?").get('acc:mail:' + m.c.email).n), 7);
  assert.equal(m.esperas.length, 3, 'los 4 primeros intentos no esperaron');
});

test('flag ENCENDIDO: quien tiene la contraseña correcta ENTRA aunque otros hayan fallado decenas de veces con su correo', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  for (let i = 0; i < 14; i++) await m.entrar(m.c.email, MALA);
  const r = await m.entrar(m.c.email, m.c.clave, '203.0.113.9');
  assert.equal(r.status, 200, 'nunca se queda fuera'); assert.match(r.headers.get('set-cookie'), /__Host-sesion=/);
  assert.equal(m.esperas.at(-1), ESPERA_MAX_MS, 'solo se retrasa, con tope');
  // y un correo sin cuenta cuenta igual (no revela si existe) y también espera
  for (let i = 0; i < 6; i++) await m.entrar('nadie@panaclaw.test', MALA);
  assert.ok(m.esperas.at(-1) > 0);
});

test('flag ENCENDIDO: los fallos caducan (ventana de 15 min, la actual y la anterior)', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  for (let i = 0; i < 8; i++) await m.entrar(m.c.email, MALA);
  m.avanzar(35 * 60e3); m.esperas.length = 0;
  assert.equal((await m.entrar(m.c.email, m.c.clave)).status, 200); assert.deepEqual(m.esperas.filter((x) => x > 0), [], 'pasada la ventana, sin espera');
});

test('el tope por IP de siempre sigue (20 intentos por minuto): no depende del flag', { skip: SALTAR }, async () => {
  const m = await mundo({ flag: true });
  let ultimo; for (let i = 0; i < 22; i++) ultimo = (await m.entrar('x' + i + '@panaclaw.test', MALA, '198.51.100.7')).status;
  assert.equal(ultimo, 429);
});
