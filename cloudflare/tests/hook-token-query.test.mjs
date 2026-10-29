// SEG-08 (D14): el secreto en la dirección (?token=) se acepta por compatibilidad, se cuenta, avisa en la respuesta y se puede apagar con `hooks.tokenEnQuery: false`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oficina6, filas, HOOK } from './fase6-ayudas.mjs';
import { SALTAR } from './d1-memoria.mjs';

const DEF = [{ id: 'formulario-web', dept: 'sales', source: 'form', text: 'Atiende al contacto nuevo.', perHour: 50 }];
async function con(ajustes = null) { const o = await oficina6({ ajustes }); assert.equal((await o.admin('PUT', '/api/triggers', { triggers: DEF })).status, 200); return o; }
const H = { 'x-office-token': HOOK };

test('por defecto ?token= sigue valiendo: se cuenta, avisa (Deprecation) y no deja el token en D1', { skip: SALTAR }, async () => {
  const o = await con();
  const r = await o.anon('POST', `/api/hook/formulario-web?token=${HOOK}`, { name: 'Ana', message: 'hola', id: 'q1' });
  assert.equal(r.status, 200, r.texto);
  assert.equal(r.cabeceras.get('deprecation'), 'true'); assert.match(r.cabeceras.get('x-ao-aviso'), /X-Office-Token/);
  assert.ok(!r.texto.includes(HOOK), 'la respuesta no repite el token');
  await o.anon('POST', `/api/hook/formulario-web?token=${HOOK}`, { name: 'B', message: 'hola', id: 'q2' });
  const f = filas(o.d1, "select clave, n from hook_token_query"); assert.equal(f.length, 1); assert.equal(f[0].clave, 'hook'); assert.equal(f[0].n, 2);
  assert.ok(!JSON.stringify(filas(o.d1, 'select * from hook_token_query')).includes(HOOK));
  const t = (await o.admin('GET', '/api/triggers')).j; assert.deepEqual(t.tokenEnQuery, { permitido: true, usos30d: 2 });
});

test('por cabecera: sin aviso y sin contar; si mandas las dos, gana la cabecera', { skip: SALTAR }, async () => {
  const o = await con();
  const r = await o.anon('POST', '/api/hook/formulario-web', { name: 'Ana', message: 'hola', id: 'c1' }, H);
  assert.equal(r.status, 200); assert.equal(r.cabeceras.get('deprecation'), null);
  const r2 = await o.anon('POST', `/api/hook/formulario-web?token=${HOOK}`, { name: 'B', message: 'hola', id: 'c2' }, H);
  assert.equal(r2.status, 200); assert.equal(r2.cabeceras.get('deprecation'), null);
  assert.equal(filas(o.d1, 'select * from hook_token_query').length, 0);
});

test('con hooks.tokenEnQuery apagado: ?token= da 401 explicando la cabecera; la cabecera sigue valiendo; un token malo sigue siendo "incorrecto"', { skip: SALTAR }, async () => {
  const o = await con({ hooks: { tokenEnQuery: false } });
  const r = await o.anon('POST', `/api/hook/formulario-web?token=${HOOK}`, { name: 'Ana', message: 'hola', id: 'a1' });
  assert.equal(r.status, 401); assert.match(r.j.error, /X-Office-Token/); assert.ok(!r.texto.includes(HOOK));
  assert.equal(filas(o.d1, 'select * from hook_token_query').length, 0, 'lo rechazado no se cuenta como uso');
  assert.equal((await o.anon('POST', '/api/hook/formulario-web', { name: 'Ana', message: 'hola', id: 'a2' }, H)).status, 200);
  const mal = await o.anon('POST', '/api/hook/formulario-web?token=otro-token-equivocado-123', { id: 'a3' }); // secrets-ok: de mentira
  assert.equal(mal.status, 401); assert.match(mal.j.error, /token incorrecto/);
});

test('la ruta de indicadores (/api/kpi) hace lo mismo', { skip: SALTAR }, async () => {
  const o = await con();
  assert.equal((await o.admin('POST', '/api/business/kpi', { id: 'ventas_semana', name: 'Ventas', unit: '$' })).status, 200);
  const r = await o.anon('POST', `/api/kpi/ventas_semana?token=${HOOK}`, { value: 5 });
  assert.equal(r.status, 200); assert.equal(r.cabeceras.get('deprecation'), 'true');
  assert.equal(filas(o.d1, "select n from hook_token_query where clave = 'kpi'")[0].n, 1);
  const o2 = await con({ hooks: { tokenEnQuery: false } });
  assert.equal((await o2.anon('POST', `/api/kpi/ventas_semana?token=${HOOK}`, { value: 5 })).status, 401);
});
