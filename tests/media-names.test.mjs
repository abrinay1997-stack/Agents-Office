// V4.4 — a picture in the Estudio never takes the name of another one (media.mjs). Run: npm test
// The bug: «date + prompt» came back free when a file went to the bin, the next picture with the same prompt took it, and the
// browser (which keeps each /media file a day) showed the old picture while the download brought the new one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as media from '../media.mjs';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(40)]);
const up = () => media.upload({ name: 'logo.png', data: 'data:image/png;base64,' + png.toString('base64') });

test('the same prompt twice, then the first to the bin: every new picture gets a name never used before', () => {
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-media-names-'));
  media.configure({}, brain, path.join(brain, 'data'));
  const a = up(), b = up();
  assert.notEqual(a.id, b.id);
  assert.ok(media.trash(a.id));
  const c = up(), d = up();
  const ids = [a.id, b.id, c.id, d.id];
  assert.equal(new Set(ids).size, 4, 'a name came back: ' + ids.join(' | '));
  assert.equal(media.item(c.id).at >= a.at, true);
});

test('a picture restored from the bin comes back to its own name, beside the ones made since', () => {
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-media-restore-'));
  media.configure({}, brain, path.join(brain, 'data'));
  const a = up(); const bin = media.trash(a.id); const b = up();
  assert.notEqual(b.id, a.id);
  assert.equal(media.restore(bin), true);
  assert.ok(media.resolve(a.id) && media.resolve(b.id));
});
