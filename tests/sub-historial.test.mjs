// El historial de Dimitri en la oficina local: listar, ver, abrir y borrar conversaciones archivadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as sub from '../sub.mjs';

test('historial local: archivar guarda título; abrir intercambia; borrar quita', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sub-h-'));
  sub.save(dir, { messages: [{ id: 'a1', who: 'user', text: 'Hola Dimitri', at: 1 }, { id: 'a2', who: 'sub', text: 'Hola', at: 2 }] });
  const id1 = sub.archive(dir);
  sub.save(dir, { messages: [{ id: 'b1', who: 'user', text: 'Otra cosa', at: 3 }] });
  const l = sub.listar(dir);
  assert.equal(l.actual.titulo, 'Otra cosa'); assert.equal(l.lista.length, 1); assert.equal(l.lista[0].titulo, 'Hola Dimitri'); assert.equal(l.lista[0].n, 2);
  assert.equal(sub.ver(dir, id1).messages.length, 2); assert.equal(sub.ver(dir, 'nada'), null);
  const r = sub.abrir(dir, id1);
  assert.deepEqual(r.messages.map(m => m.id), ['a1', 'a2']);
  assert.equal(sub.listar(dir).lista[0].titulo, 'Otra cosa');
  assert.equal(sub.borrar(dir, r.archived), true); assert.equal(sub.listar(dir).lista.length, 0); assert.equal(sub.borrar(dir, r.archived), false);
  assert.equal(sub.abrir(dir, 'nada'), null);
  assert.equal(sub.tituloConversacion([]), 'Sin título');
  fs.rmSync(dir, { recursive: true, force: true });
});
