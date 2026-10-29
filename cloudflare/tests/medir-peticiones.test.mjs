// CON-09 / CON-11 (Fase 6, ola 3): MEDIR antes de cambiar nada. Cuenta las consultas a D1 de cada petición del sondeo de Contenido y de un GET de la Bandeja,
// y comprueba lo que ya se cumple (techos = lo medido, para que no empeore). La línea base se imprime con `AO_MEDIR=1 node --test cloudflare/tests/medir-peticiones.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { conBandeja, almacenEnMemoria } from '../worker/lib/anuncios-nube.js';
import { SALTAR } from './d1-memoria.mjs';
import { nube } from './ayuda-meta.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Envuelve `prepare` de la D1 de memoria y cuenta las sentencias (lecturas y escrituras aparte) hasta `parar()`. */
function contar(d1) {
  const orig = d1.prepare, v = { lecturas: 0, escrituras: 0, sql: [] };
  d1.prepare = (sql) => { const esc = /^\s*(insert|update|delete|replace)/i.test(sql); v[esc ? 'escrituras' : 'lecturas']++; v.sql.push(sql.replace(/\s+/g, ' ').slice(0, 90)); return orig(sql); };
  return { v, parar: () => { d1.prepare = orig; return v; } };
}
const mostrar = (t, v) => { if (process.env.AO_MEDIR) console.log(`[medir] ${t}: ${v.lecturas} lecturas, ${v.escrituras} escrituras D1`); };

test('CON-11: un GET de la Bandeja (espejo caliente) lee D1 a lo más 3 veces y no escribe nada', { skip: SALTAR }, async () => {
  const o = await nube({ preparar: false, config: { anuncios: { cuenta: 'act_1001' }, contenido: { modo: 'simulacro' } } });
  await conBandeja({ db: o.d1, env: o.env }, async ({ bandeja }) => bandeja.listar({})); // caliente la caché del isolate
  const c = contar(o.d1);
  await conBandeja({ db: o.d1, env: o.env }, async ({ bandeja }) => bandeja.listar({}));
  const v = c.parar(); mostrar('GET Bandeja (conBandeja en caliente)', v);
  assert.ok(v.lecturas <= 3, `lecturas D1: ${v.lecturas} → ${v.sql.join(' | ')}`);
  assert.equal(v.escrituras, 0, `un GET no escribe: ${v.sql.join(' | ')}`);
});

test('CON-11 paso 2: el almacén en memoria lee el archivo una vez por petición y escribe en el archivo en el acto', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-alm-')), f = path.join(dir, 'x', 'bandeja.json');
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ items: { a: { id: 'a' } } }));
  const a = almacenEnMemoria(f);
  for (let i = 0; i < 5; i++) assert.deepEqual(a.leer().items.a, { id: 'a' });
  assert.equal(a.cuenta.lecturas, 1, 'una sola lectura del archivo');
  const d = a.leer(); d.items.b = { id: 'b' }; assert.equal(a.leer().items.b, undefined, 'una copia: cambiarla no escribe');
  a.escribir(d);
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')).items.b, { id: 'b' }, 'el archivo del espejo ya lo tiene (el volcado previo a Meta lo verá)');
  assert.ok(a.leer().items.b); assert.equal(a.cuenta.lecturas, 1);
  assert.deepEqual(almacenEnMemoria(path.join(dir, 'no-existe.json')).leer(), {}, 'sin archivo, vacío');
});

test('CON-09: lo que cuesta cada petición del sondeo de Contenido (línea base medida)', { skip: SALTAR }, async () => {
  const o = await nube({ preparar: false });
  const hoy = new Date().toISOString().slice(0, 10);
  // techos = la línea base medida el 29 oct 2026 (incluyen las consultas de la sesión, que `/api/yo` mide aparte): que no empeore
  const rutas = [['/api/yo', 1], [`/api/contenido?desde=${hoy}&hasta=${hoy}`, 9], ['/api/contenido/cola', 7], ['/api/contenido/bandeja', 4]];
  for (const [r, techo] of rutas) {
    await o.api('admin', 'GET', r); // caliente
    const c = contar(o.d1); const x = await o.api('admin', 'GET', r); const v = c.parar();
    mostrar(r, v); assert.equal(x.status, 200, r); assert.ok(v.lecturas <= techo, `${r}: ${v.lecturas} lecturas (techo ${techo}) → ${v.sql.join(' | ')}`);
    assert.equal(v.escrituras, 0, `${r} no debería escribir al leer: ${v.sql.join(' | ')}`);
  }
});
