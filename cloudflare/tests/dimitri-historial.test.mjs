// El historial de Dimitri en la nube: listar, ver, abrir y borrar conversaciones guardadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearD1, SALTAR } from './d1-memoria.mjs';
import * as chat from '../worker/lib/dimitri/chat.js';

const msg = (id, who, text, at) => ({ id, who, text, at });
test('historial: una conversación archivada se lista con su título, se lee, se abre (la de ahora se guarda) y se borra', { skip: SALTAR }, async () => {
  const db = crearD1(), s = chat.sala(db, 'ana');
  await s.anexar(msg('a1', 'user', '  ¿Cómo   vamos con las ventas?  ', 1000), msg('a2', 'sub', 'Bien', 1001));
  assert.equal((await s.listar()).actual.titulo, '¿Cómo vamos con las ventas?');
  const id1 = await s.archivar();
  await s.anexar(msg('b1', 'user', 'Prepara la semana', 2000), msg('b2', 'sub', 'Listo', 2001));
  const l = await s.listar();
  assert.equal(l.lista.length, 1); assert.equal(l.lista[0].titulo, '¿Cómo vamos con las ventas?'); assert.equal(l.lista[0].n, 2); assert.equal(l.actual.titulo, 'Prepara la semana');
  assert.deepEqual((await s.ver(id1)).messages.map((m) => m.id), ['a1', 'a2']);
  assert.equal(await s.ver('zzzz'), null); assert.equal(await s.ver("x'; drop table filas;--"), null);
  const r = await s.abrir(id1);
  assert.deepEqual(r.messages.map((m) => m.id), ['a1', 'a2'], 'la elegida es ahora el chat');
  const l2 = await s.listar();
  assert.equal(l2.lista.length, 1, 'la que estaba abierta quedó guardada'); assert.equal(l2.lista[0].titulo, 'Prepara la semana'); assert.equal(l2.lista[0].id, r.archived);
  assert.equal(await s.abrir('noexiste'), null);
  assert.equal(await s.borrar(r.archived), true); assert.equal((await s.listar()).lista.length, 0);
  assert.equal((await db.prepare("select count(*) n from filas where coleccion like 'subgerente-arch:%'").first()).n, 0, 'borrar quita también los mensajes');
  assert.equal(await s.borrar(r.archived), false);
});
test('historial: se conservan las últimas 50', { skip: SALTAR }, async () => {
  const db = crearD1(), s = chat.sala(db, 'ana');
  for (let i = 0; i < 53; i++) { await s.anexar(msg('m' + i, 'user', 'tema ' + i, 1000 + i)); await s.archivar(); }
  const l = await s.listar(); assert.equal(l.lista.length, 50); assert.equal(l.lista[0].titulo, 'tema 52');
});
