// Auditoría 1 oct 2026 (INF-02, INF-03) — the gallery's in-memory index (media.mjs): list() no longer reads every
// .json on each request, it still sees what changes on disk, and folder changes reach the whole gallery. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as md from '../media.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAADklEQVR4nGNgYGD4z4ADAAMFAAHiJVjLAAAAAElFTkSuQmCC';
function box() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-index-')); md.configure({ media: {} }, dir, path.join(dir, 'data')); return dir; }
/** n records written straight to disk, as if the gallery had grown over months (faster than n uploads). */
function seed(n, folder) {
  const root = md.dir();
  for (let i = 0; i < n; i++) {
    const sub = `2026-${String(1 + (i % 9)).padStart(2, '0')}`, d = path.join(root, sub); fs.mkdirSync(d, { recursive: true });
    const file = `${sub}/f${i}.png`; fs.writeFileSync(path.join(root, file), 'x');
    fs.writeFileSync(path.join(d, `f${i}.json`), JSON.stringify({ id: file, file, kind: 'image', at: 1e12 + i, prompt: 'p' + i, ...(folder && i === 0 ? { folder } : {}) }));
  }
}

test('650 files: the second list() is served from memory (fast) and returns copies', () => {
  const dir = box();
  try {
    seed(650);
    const l1 = md.list(); assert.equal(l1.length, 600); assert.equal(l1[0].prompt, 'p649', 'newest first');
    const t = performance.now(); for (let i = 0; i < 20; i++) md.list(); const per = (performance.now() - t) / 20;
    assert.ok(per < 50, `list() took ${per.toFixed(1)} ms from the index`);
    l1[0].prompt = 'cambiado'; assert.equal(md.list()[0].prompt, 'p649', 'the caller cannot change the index');
    assert.equal(md.list({ limit: 1000 }).length, 650);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the index follows the office\'s own changes: upload, favourite, trash, restore', () => {
  const dir = box();
  try {
    md.list(); // builds an (empty) index first
    const a = md.upload({ name: 'uno.png', data: PNG }), b = md.upload({ name: 'dos.png', data: PNG });
    assert.deepEqual(md.list().map(x => x.file).sort(), [a.file, b.file].sort());
    md.update(a.file, { fav: true }); assert.equal(md.list().find(x => x.file === a.file).fav, true);
    const t = md.trash(b.file); assert.deepEqual(md.list().map(x => x.file), [a.file]);
    assert.ok(md.restore(t)); assert.equal(md.list().length, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a file added or removed from outside the office (the Explorer) shows up on the next list()', () => {
  const dir = box();
  try {
    seed(3); assert.equal(md.list().length, 3);
    const root = md.dir(), sub = '2026-01', file = `${sub}/fuera.png`;
    fs.writeFileSync(path.join(root, file), 'x');
    fs.writeFileSync(path.join(root, sub, 'fuera.json'), JSON.stringify({ id: file, file, kind: 'image', at: 2e12, prompt: 'de fuera' }));
    assert.equal(md.list()[0].prompt, 'de fuera');
    fs.rmSync(path.join(root, file)); // the picture went, its record stayed: it is no longer in the gallery
    assert.ok(!md.list().some(x => x.file === file));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('folders count and clear the whole gallery, past the first 600 (INF-03)', () => {
  const dir = box();
  try {
    const f = md.addFolder('Vieja');
    seed(650, f.id); // f0 — the oldest, number 650 — is in the folder
    assert.ok(!md.list().some(x => x.file.endsWith('/f0.png')), 'the oldest is beyond the first page');
    assert.equal(md.folders()[0].n, 1, 'it still counts');
    assert.equal(md.removeFolder(f.id), 1);
    assert.equal(md.item('2026-01/f0.png').folder, null, 'and it is cleared, not left pointing at a folder that is gone');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
