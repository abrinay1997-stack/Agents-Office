// IMG-36 (auditoría del Estudio de imagen, 6 oct 2026): el modelo «Automático» del modo Básico.
import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirAuto } from '../src/studio-auto.js';

const M = (id, o = {}) => ({ id, kind: 'image', on: o.on !== false, engine: o.engine || 'gemini', roles: { reference: o.ref ?? 0 } });
const models = [M('prueba', { engine: 'prueba', ref: 8 }), M('nano-banana-2', { ref: 14 }), M('ideogram-4', { engine: 'higgsfield' }), M('z-image-turbo', { engine: 'higgsfield' })];

test('sin nada especial, el de uso general (el de la oficina)', () => {
  assert.deepEqual(elegirAuto(models, { def: 'z-image-turbo' }), { id: 'z-image-turbo', porque: 'el de uso general' });
  assert.equal(elegirAuto(models, { def: 'no-existe' }).id, 'nano-banana-2', 'si el de la oficina no está, el primero real');
});
test('con referencias, uno que las acepta todas', () => {
  const r = elegirAuto(models, { refs: 2, def: 'z-image-turbo' });
  assert.equal(r.id, 'nano-banana-2'); assert.match(r.porque, /edita/);
});
test('con texto que se lee, un modelo de texto legible', () => {
  for (const p of ['Un logo para la panadería', 'cartel con el texto "GRAN APERTURA"', 'póster que diga «oferta»']) assert.equal(elegirAuto(models, { prompt: p, def: 'z-image-turbo' }).id, 'ideogram-4', p);
  assert.equal(elegirAuto(models, { prompt: 'una taza de café', def: 'z-image-turbo' }).id, 'z-image-turbo');
});
test('la prueba solo si no hay otro; nada encendido, null', () => {
  assert.match(elegirAuto([M('prueba', { engine: 'prueba' })]).porque, /prueba/);
  assert.equal(elegirAuto([M('x', { on: false })]), null);
  assert.equal(elegirAuto(models.map(m => ({ ...m, on: false }))), null);
});
