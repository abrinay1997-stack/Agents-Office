// Auditoría 1 oct 2026 (INF-05) — vault-cache.mjs: the Brain's index is built once and again only when a note changes. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCache, touchesNotes } from '../vault-cache.mjs';

test('only notes and folders count as a change; a picture or a JSON record does not', () => {
  assert.ok(touchesNotes('00-Empresa/perfil.md')); assert.ok(touchesNotes('Documentos')); assert.ok(touchesNotes(null));
  assert.ok(!touchesNotes('Agents Office/media/2026-10/x.webp')); assert.ok(!touchesNotes('Agents Office/media/2026-10/x.json'));
});

test('with a watch: built once, again only after a note changes (or the long safety interval)', () => {
  let cb = null, t = 0, n = 0;
  const fakeWatch = (_dir, _o, f) => { cb = f; return { on() {}, unref() {} }; };
  const c = createCache({ build: () => ++n, watchDir: '/brain', watch: fakeWatch, now: () => t, ttlWatching: 1000 });
  assert.equal(c.watching, true);
  assert.equal(c.get(), 1); assert.equal(c.get(), 1); assert.equal(c.get(), 1);
  cb('change', 'media/x.webp'); assert.equal(c.get(), 1, 'a picture does not rebuild it');
  cb('change', 'notas/oferta.md'); assert.equal(c.get(), 2);
  c.invalidate(); assert.equal(c.get(), 3);
  t = 2000; assert.equal(c.get(), 4, 'the safety interval');
});

test('without a watch it falls back to a short interval', () => {
  let t = 0, n = 0;
  const c = createCache({ build: () => ++n, watchDir: '/nope', watch: () => { throw new Error('no recursive watch'); }, now: () => t, ttlPolling: 15 });
  assert.equal(c.watching, false);
  assert.equal(c.get(), 1); t = 10; assert.equal(c.get(), 1); t = 20; assert.equal(c.get(), 2);
});

test('a real watch on a folder sees a new note', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-vault-'));
  let n = 0; const c = createCache({ build: () => ++n, watchDir: dir });
  try {
    if (!c.watching) return; // this machine has no recursive watch: the interval covers it (tested above)
    assert.equal(c.get(), 1);
    fs.writeFileSync(path.join(dir, 'nueva.md'), '# hola');
    for (let i = 0; i < 40 && c.get() === 1; i++) await new Promise(r => setTimeout(r, 50));
    assert.equal(c.get(), 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
