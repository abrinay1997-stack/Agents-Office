// V4.9 — el rastro de un trabajo del Estudio: quién lo pidió (Dimitri también), para qué, qué notas leyó, de qué mensaje salió. Run: npm test
// Se guarda en el trabajo y en la ficha .json de cada archivo; lo que no tiene forma válida se descarta en vez de romper el pedido.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as media from '../media.mjs';

const fresh = () => { const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-dimitri-')); media.configure({}, brain, path.join(brain, 'data')); return brain; };

test('un pedido de Dimitri guarda by, sub, purpose y read en el trabajo y en la ficha de cada archivo', async () => {
  fresh();
  const f = media.addFolder('Campaña octubre');
  const j = media.submit({ model: 'prueba', prompt: 'una taza en la playa', n: 2, by: 'dimitri', sub: { msg: 'm123abc', i: 1 }, purpose: '  Post del lanzamiento\n de octubre ', read: ['00-Empresa/oferta', 'voice', 'voice', '', 42, '[[x]]'], folder: f.id });
  assert.equal(j.by, 'dimitri'); assert.deepEqual(j.sub, { msg: 'm123abc', i: 1 });
  assert.equal(j.purpose, 'Post del lanzamiento  de octubre'); assert.deepEqual(j.read, ['00-Empresa/oferta', 'voice', 'x']);
  const done = await media.wait(j.id, 10000);
  assert.equal(done.state, 'done', done.error); assert.equal(done.items.length, 2);
  for (const file of done.items) {
    const it = media.item(file);
    assert.equal(it.by, 'dimitri'); assert.deepEqual(it.sub, { msg: 'm123abc', i: 1 }); assert.equal(it.purpose, 'Post del lanzamiento  de octubre');
    assert.deepEqual(it.read, ['00-Empresa/oferta', 'voice', 'x']); assert.equal(it.folder, f.id);
  }
});

test('by desconocido es «you»; un sub mal formado, un purpose vacío y un read que no es lista no se guardan', () => {
  fresh();
  const j = media.submit({ model: 'prueba', prompt: 'x', by: 'root', sub: { msg: '../../x', i: -1 }, purpose: '   ', read: 'voice' });
  assert.equal(j.by, 'you'); assert.equal(j.sub, undefined); assert.equal(j.purpose, undefined); assert.equal(j.read, undefined);
  assert.equal(media.submit({ model: 'prueba', prompt: 'x', by: 'agent' }).by, 'agent');
  assert.equal(media.submit({ model: 'prueba', prompt: 'x', purpose: 'p'.repeat(500) }).purpose.length, 200);
  assert.equal(media.submit({ model: 'prueba', prompt: 'x', read: Array.from({ length: 40 }, (_, i) => 'n' + i) }).read.length, 20);
});

test('versionOf se valida contra la galería; reintentar conserva el rastro', async () => {
  fresh();
  const a = await media.wait(media.submit({ model: 'prueba', prompt: 'original' }).id, 10000);
  assert.throws(() => media.submit({ model: 'prueba', prompt: 'x', versionOf: '../fuera.png' }), /no encuentro/);
  const v = media.submit({ model: 'prueba', prompt: 'versión', versionOf: a.items[0], by: 'dimitri', sub: { msg: 'm1', i: 0 }, purpose: 'para el feed', read: ['voice'] });
  await media.wait(v.id, 10000);
  assert.deepEqual(media.item(a.items[0]).versions, media.job(v.id).items, 'the original lists its new version');
  const r = media.retry(v.id);
  assert.equal(r.by, 'dimitri'); assert.equal(r.versionOf, a.items[0]); assert.deepEqual(r.sub, { msg: 'm1', i: 0 }); assert.equal(r.purpose, 'para el feed'); assert.deepEqual(r.read, ['voice']);
  await media.wait(r.id, 10000);
  assert.equal(media.item(a.items[0]).versions.length, 2);
});

test('el catálogo marca los modelos que editan, y editModels los da en el orden preferido y solo encendidos', () => {
  const keep = { k: process.env.GEMINI_API_KEY, m: process.env.META_API_KEY, mk: process.env.MODEL_API_KEY };
  try {
    process.env.GEMINI_API_KEY = 'k'; process.env.META_API_KEY = 'k';
    const edit = media.models().filter(m => m.edit).map(m => m.id);
    assert.deepEqual(edit.sort(), ['flux-kontext', 'gpt-image-1', 'grok-imagine-2', 'muse-image', 'nano-banana', 'nano-banana-2', 'nano-banana-fal', 'nano-banana-pro', 'qwen-image-3', 'seedream-4']);
    const on = media.editModels().map(m => m.id);
    assert.deepEqual(on.slice(0, 4), ['nano-banana-2', 'nano-banana-pro', 'nano-banana', 'muse-image']);
    assert.ok(media.editModels().every(m => m.on && m.edit));
  } finally { for (const [k, v] of [['GEMINI_API_KEY', keep.k], ['META_API_KEY', keep.m], ['MODEL_API_KEY', keep.mk]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});
