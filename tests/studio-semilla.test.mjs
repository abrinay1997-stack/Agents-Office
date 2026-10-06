// IMG-45 (auditoría del Estudio de imagen, Fase 6, 6 oct 2026): la semilla, solo en los modelos que la documentan.
// Vacía = una nueva cada vez (no viaja); un número repite el resultado; «Variar» nunca reusa la del original.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, hfBody } from '../media/catalogo.mjs';
import * as BR from '../src/studio-borrador.js';

const soul = CATALOG.find(m => m.id === 'soul-2');
const eid = Object.values(soul.routes)[0];
const j = s => ({ prompt: 'una taza', s, m: { start: [], end: [], reference: [], video: [] } });

test('la semilla es un campo de texto vacío, nunca una barra', () => {
  assert.deepEqual({ type: soul.settings.seed.type, def: soul.settings.seed.default }, { type: 'text', def: '' });
  assert.ok(CATALOG.filter(m => m.settings?.seed).every(m => m.engine === 'higgsfield'), 'solo donde Higgsfield la documenta');
  assert.ok(!CATALOG.find(m => m.id === 'nano-banana-2').settings.seed, 'un modelo que no la acepta no la muestra');
});

test('vacía no viaja; un número viaja como número; basura no viaja', () => {
  assert.equal('seed' in hfBody(soul, eid, j({ seed: '' })).body, false);
  assert.equal(hfBody(soul, eid, j({ seed: '42' })).body.seed, 42);
  assert.equal('seed' in hfBody(soul, eid, j({ seed: 'abc' })).body, false);
});

test('Variar no copia la semilla del original; el resto de sus ajustes sí', () => {
  const models = [{ id: 'soul-2', name: 'Soul 2', kind: 'image', on: true, roles: { reference: 4 }, settings: soul.settings }];
  const p = BR.pedidoVariar({ file: 'a.png', prompt: 'taza', model: 'soul-2', settings: { seed: '42', aspectRatio: soul.settings.aspectRatio.values[1] } }, models, {});
  assert.equal(p.req.settings.seed, undefined);
  assert.equal(p.req.settings.aspectRatio, soul.settings.aspectRatio.values[1]);
});
