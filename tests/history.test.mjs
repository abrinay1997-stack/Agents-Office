// V4.4 — the history of skills and briefs (history.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as H from '../history.mjs';

test('the first sight is the starting version; a change is kept and dated; nothing changes, nothing is stored', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-hist-'));
  try {
    assert.deepEqual(H.snapshot(dir, [{ kind: 'skill', name: 'propuesta', text: 'v1', agents: ['piper'] }], 1000), []);
    assert.deepEqual(H.snapshot(dir, [{ kind: 'skill', name: 'propuesta', text: 'v1', agents: ['piper'] }], 2000), []);
    const c = H.snapshot(dir, [{ kind: 'skill', name: 'propuesta', text: 'v2', agents: ['piper'] }], 3000);
    assert.equal(c.length, 1);
    const v = H.versions(dir, 'skill', 'propuesta');
    assert.deepEqual(v.map(x => x.at), [3000, 1000]);
    assert.equal(H.read(dir, 'skill', 'propuesta', 1000), 'v1');
    assert.deepEqual(H.changesByAgent(dir), { piper: 3000 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
