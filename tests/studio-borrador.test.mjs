// IMG-01 · IMG-02 (auditoría del Estudio de imagen, 6 oct 2026): el borrador con DESHACER y Variar como pedido propio.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as BR from '../src/studio-borrador.js';

const E = (o = {}) => ({ enum: true, type: 'enum', values: o.values || ['1:1', '4:5', '16:9'], default: o.default || '1:1' });
const M = (id, o = {}) => ({ id, name: id.toUpperCase(), kind: 'image', on: o.on !== false, roles: { reference: o.ref ?? 4 }, settings: { aspectRatio: E(o), ...(o.extra || {}) } });

test('la pila guarda copias, deshace en orden y no repite dos fotos iguales seguidas', () => {
  const p = BR.pila(3);
  const e = { prompt: 'taza', media: { reference: ['a.png'] } };
  assert.equal(p.guardar(e), true); assert.equal(p.guardar({ ...e }), false, 'la misma foto seguida no ocupa otro hueco');
  e.media.reference.push('b.png'); // lo guardado no cambia si el original cambia después
  p.guardar({ prompt: 'zapato', media: {} }); p.guardar({ prompt: '3', media: {} }); p.guardar({ prompt: '4', media: {} });
  assert.equal(p.n, 3, 'como mucho `max`');
  assert.equal(p.deshacer().prompt, '4'); assert.equal(p.deshacer().prompt, '3'); assert.equal(p.deshacer().prompt, 'zapato');
  assert.equal(p.deshacer(), null); assert.equal(p.hay(), false);
  const q = BR.pila(); q.guardar(e); e.prompt = 'otra'; assert.equal(q.deshacer().prompt, 'taza');
});

test('un borrador vacío no tiene nada que perder', () => {
  assert.equal(BR.vacio({ prompt: '  ', media: { reference: [] } }), true);
  assert.equal(BR.vacio({ prompt: 'x', media: {} }), false);
  assert.equal(BR.vacio({ prompt: '', media: { start: ['f.png'] } }), false);
});

test('Variar: su prompt, su modelo y sus ajustes, ella como ÚNICA referencia, 1 archivo; no lee el compositor', () => {
  const models = [M('nb2', { values: ['1:1', '4:5', '16:9', '9:16'] }), M('otro')];
  const it = { file: '2026-10/taza.png', prompt: 'taza humeante', model: 'nb2', settings: { aspectRatio: '9:16', imageSize: '2K' }, kind: 'image' };
  const p = BR.pedidoVariar(it, models, { settingsDe: () => ({ aspectRatio: '1:1' }) });
  assert.equal(p.modelo.id, 'nb2'); assert.equal(p.cambio, false);
  assert.deepEqual(p.req.media, { reference: ['2026-10/taza.png'] });
  assert.equal(p.req.n, 1); assert.equal(p.req.prompt, 'taza humeante'); assert.equal(p.req.kind, 'image'); assert.equal(p.req.by, 'you');
  assert.equal(p.req.settings.aspectRatio, '9:16', 'el formato de esa imagen, no el del compositor');
  assert.equal(p.req.settings.imageSize, undefined, 'un ajuste que el modelo no tiene no viaja');
});

test('Variar: si su modelo está apagado o no acepta referencias, va el respaldo y lo dice; conserva el formato si puede', () => {
  const models = [M('viejo', { on: false }), M('sinref', { ref: 0 }), M('nb2', { values: ['1:1', '16:9'] })];
  const it = { file: 'x.png', prompt: '', model: 'viejo', settings: { aspectRatio: '16:9' } };
  const p = BR.pedidoVariar(it, models, { respaldo: models[2], settingsDe: m => ({ aspectRatio: m.settings.aspectRatio.default }) });
  assert.equal(p.modelo.id, 'nb2'); assert.equal(p.cambio, true);
  assert.equal(p.req.settings.aspectRatio, '16:9');
  assert.equal(p.req.prompt, 'una variación de esta imagen');
  assert.match(BR.pedidoVariar({ ...it, model: 'sinref' }, models, {}).error, /Ningún modelo/);
  assert.match(BR.pedidoVariar({ file: 'v.mp4', kind: 'video' }, models, {}).error, /imágenes/);
  assert.deepEqual(BR.pedidoVariar({ ...it, model: 'nb2', folder: 'f1' }, models, {}).req.folder, 'f1');
});
