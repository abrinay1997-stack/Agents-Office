// IMG-14 (auditoría del Estudio de imagen, Fase 6, 6 oct 2026): comparar 2–4 imágenes y una versión con su original.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as CMP from '../src/studio-comparar.js';

const I = (file, o = {}) => ({ file, kind: 'image', prompt: file, ...o });

test('de 2 a 4 imágenes; videos y audios fuera, con el motivo', () => {
  assert.match(CMP.queComparar([I('a.png')]).error, /al menos 2/);
  assert.equal(CMP.queComparar([I('a.png'), I('b.png')]).items.length, 2);
  assert.equal(CMP.queComparar([1, 2, 3, 4].map(n => I(`${n}.png`))).items.length, 4);
  assert.match(CMP.queComparar([1, 2, 3, 4, 5].map(n => I(`${n}.png`))).error, /hasta 4.*5/);
  assert.match(CMP.queComparar([I('a.png'), { file: 'v.mp4', kind: 'video' }]).error, /videos y los audios/);
});

test('una versión se compara con su original; una original con su última versión; sola, con nada', () => {
  const lib = new Map([['o.png', I('o.png', { versions: ['v1.png', 'v2.png'] })], ['v1.png', I('v1.png', { versionOf: 'o.png' })], ['v2.png', I('v2.png', { versionOf: 'o.png' })]]);
  const of = f => lib.get(f);
  assert.deepEqual(CMP.conSuPareja(of('v1.png'), of).items.map(x => x.file), ['o.png', 'v1.png']);
  assert.deepEqual(CMP.conSuPareja(of('o.png'), of).items.map(x => x.file), ['o.png', 'v2.png']);
  assert.equal(CMP.conSuPareja(I('suelta.png'), of), null);
  assert.equal(CMP.conSuPareja(I('h.png', { versionOf: 'borrada.png' }), of), null, 'si la original ya no está, no hay pareja');
});

test('la cortina se mueve con el teclado y no se sale de 0–100', () => {
  assert.equal(CMP.cortina(50, 'ArrowLeft'), 45); assert.equal(CMP.cortina(98, 'ArrowRight'), 100);
  assert.equal(CMP.cortina(10, 'PageDown'), 0); assert.equal(CMP.cortina(40, 'Home'), 0); assert.equal(CMP.cortina(40, 'End'), 100);
  assert.equal(CMP.cortina(40, 'a'), null);
});
