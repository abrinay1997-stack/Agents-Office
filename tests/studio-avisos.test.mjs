// IMG-03 (auditoría del Estudio de imagen, 6 oct 2026): lo que dice el Estudio cuando terminan trabajos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { terminados, plural } from '../src/studio-avisos.js';

test('plurales de verdad, nunca «archivo(s)»', () => {
  assert.equal(plural(1, 'archivo nuevo', 'archivos nuevos'), '1 archivo nuevo');
  assert.equal(terminados({ archivos: 1 }).texto, 'Listo: 1 archivo nuevo en la galería.');
  assert.equal(terminados({ archivos: 2 }).texto, 'Listo: 2 archivos nuevos en la galería.');
  assert.doesNotMatch(terminados({ archivos: 3 }).texto, /\(s\)/);
});

test('un «Listo» no esconde una ficha fallida que sigue a la vista', () => {
  const t = terminados({ archivos: 1, fallidasVisibles: 1 });
  assert.equal(t.malo, false);
  assert.match(t.texto, /^Listo: 1 archivo nuevo en la galería\. Sigue a la vista un pedido que falló: su ficha dice por qué\.$/);
  assert.match(terminados({ archivos: 1, fallidasVisibles: 2 }).texto, /Siguen a la vista 2 pedidos que fallaron/);
});

test('lo que falla ahora se dice con su motivo, junto a lo que salió bien', () => {
  const t = terminados({ archivos: 2, fallidos: 1, error: 'Nano Banana 2 no aceptó el pedido', fallidasVisibles: 1 });
  assert.equal(t.malo, true);
  assert.equal(t.texto, 'Listo: 2 archivos nuevos en la galería. Un pedido no se pudo: Nano Banana 2 no aceptó el pedido.');
  assert.equal(terminados({ fallidos: 2, error: 'x' }).texto, '2 pedidos no se pudieron: x.');
  assert.equal(terminados({}).texto, '');
});
