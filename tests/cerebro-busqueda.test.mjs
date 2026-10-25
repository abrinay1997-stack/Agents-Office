// La búsqueda del Cerebro, ahora un módulo puro compartido con el Worker de Cloudflare.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarEnCerebro } from '../cerebro-busqueda.mjs';

const notas = new Map([
  ['oferta', '---\ntitulo: x\n---\n# Oferta\nEl combo de lentes cuesta poco. Garantía de un año.'],
  ['voz', 'Hablamos de tú, con calidez. Nada de promesas médicas.'],
  ['Garantía y devoluciones', 'Cambios en 30 días.'],
]);

test('busca por nombre y por texto, sin tildes ni mayúsculas', () => {
  const r = buscarEnCerebro(notas, 'garantia');
  assert.equal(r.total, 2);
  assert.equal(r.hits[0].name, 'Garantía y devoluciones'); // el nombre pesa más que el texto
  assert.equal(r.hits[0].inName, true);
  assert.match(r.hits[1].snippet, /Garantía de un año/);
});
test('todas las palabras tienen que aparecer; la cabecera YAML no cuenta', () => {
  assert.equal(buscarEnCerebro(notas, 'combo lentes').hits.length, 1);
  assert.equal(buscarEnCerebro(notas, 'combo promesas').hits.length, 0);
  assert.equal(buscarEnCerebro(notas, 'titulo').hits.length, 0);
});
test('menos de 2 letras no busca; tope de 40 aciertos', () => {
  assert.deepEqual(buscarEnCerebro(notas, 'a'), { q: 'a', hits: [] });
  const muchas = new Map(Array.from({ length: 60 }, (_, i) => ['n' + i, 'palabra común']));
  assert.equal(buscarEnCerebro(muchas, 'palabra').hits.length, 40);
  assert.equal(buscarEnCerebro(muchas, 'palabra').total, 60);
});
