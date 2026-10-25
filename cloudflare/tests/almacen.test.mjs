import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../worker/lib/almacen.js';
import { texto } from '../worker/lib/ia.js';
import { SALTAR, crearD1 } from './d1-memoria.mjs';

test('docs: leer con valor por defecto, guardar con versión y detectar conflictos', { skip: SALTAR }, async () => {
  const db = crearD1();
  assert.deepEqual(await A.leerDoc(db, 'kpis', { x: 1 }), { valor: { x: 1 }, version: 0 });
  assert.equal(await A.guardarDoc(db, 'kpis', { a: 1 }, { espera: 0 }), 1);
  await assert.rejects(() => A.guardarDoc(db, 'kpis', { a: 2 }, { espera: 0 }), (e) => e.conflicto); // ya existe
  assert.equal(await A.guardarDoc(db, 'kpis', { a: 2 }, { espera: 1 }), 2);
  await assert.rejects(() => A.guardarDoc(db, 'kpis', { a: 3 }, { espera: 1 }), (e) => e.conflicto); // versión vieja
  assert.deepEqual((await A.leerDoc(db, 'kpis')).valor, { a: 2 });
  assert.equal(await A.guardarDoc(db, 'kpis', { a: 9 }), 3); // sin `espera` pisa
});

test('mutarDoc repite si otro guardó entre medias, y no pierde los dos cambios', { skip: SALTAR }, async () => {
  const db = crearD1(); let vez = 0;
  const r = await A.mutarDoc(db, 'cuenta', { n: 0 }, async (v) => { if (vez++ === 0) await A.guardarDoc(db, 'cuenta', { n: 10 }); v.n += 1; return v; });
  assert.deepEqual(r, { n: 11 }); assert.equal(vez, 2);
});

test('filas: guardar, listar en orden, actualizar una sin tocar las demás, borrar y contar', { skip: SALTAR }, async () => {
  const db = crearD1();
  await A.guardarFilas(db, 'tareas', [{ id: 'b', valor: { t: 'B' }, orden: 2 }, { id: 'a', valor: { t: 'A' }, orden: 1 }]);
  await A.guardarFila(db, 'rutinas', 'a', { r: 1 });
  assert.deepEqual((await A.listarFilas(db, 'tareas')).map((x) => x.t), ['A', 'B']);
  await A.guardarFila(db, 'tareas', 'b', { t: 'B2' }, 0);
  assert.deepEqual((await A.listarFilas(db, 'tareas')).map((x) => x.t), ['B2', 'A']);
  assert.deepEqual(await A.leerFila(db, 'rutinas', 'a'), { r: 1 });
  assert.equal(await A.leerFila(db, 'tareas', 'zz'), null);
  assert.equal(await A.borrarFila(db, 'tareas', 'a'), true);
  assert.equal(await A.borrarFila(db, 'tareas', 'a'), false);
  assert.equal(await A.contarFilas(db, 'tareas'), 1);
});

test('ia.texto: usa la llave del Worker, devuelve solo el texto, y los errores salen en español sin la llave', async () => {
  let visto;
  const ok = await texto({ ANTHROPIC_API_KEY: 'k' }, { sistema: 'Sé breve', usuario: 'hola', fetchFn: async (u, i) => { visto = JSON.parse(i.body); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }, { type: 'raro' }], usage: { input_tokens: 3, output_tokens: 1 } }), { status: 200 }); } });
  assert.deepEqual(ok, { texto: 'ok', tokens: { entrada: 3, salida: 1 } });
  assert.equal(visto.system, 'Sé breve'); assert.ok(!visto.mcp_servers);
  await assert.rejects(() => texto({}, { usuario: 'x' }), /Falta el secreto ANTHROPIC_API_KEY/);
  await assert.rejects(() => texto({ ANTHROPIC_API_KEY: 'sk-ant-secreta' }, { usuario: 'x', fetchFn: async () => new Response('{}', { status: 401 }) }), (e) => /rechazó la clave/.test(e.message) && !/secreta/.test(e.message));
});
