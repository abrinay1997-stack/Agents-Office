// Auditoría 1 oct 2026 (A11-13) — a line of Ajustes → Atajos does what its key does: «K» opens Contenido, «Ctrl+K» the search. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { keyEventInit } from '../src/keys-run.js';

test('a plain key never carries Ctrl; only a line that names the modifier does', () => {
  assert.deepEqual(keyEventInit('k'), { key: 'k', ctrlKey: false, metaKey: false, bubbles: true });
  assert.deepEqual(keyEventInit('ctrl+k'), { key: 'k', ctrlKey: true, metaKey: false, bubbles: true });
  assert.equal(keyEventInit(',').key, ','); assert.equal(keyEventInit(',').ctrlKey, false);
  assert.equal(keyEventInit('0').key, '0');
});

test('in main.js the Ctrl+K line says «ctrl+k» and the K line says «k»: two lines, two different actions', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /\['Ctrl\+K', '[^']+', 'ctrl\+k'\]/);
  assert.match(src, /\['K', 'Contenido[^']*', 'k'\]/);
  assert.doesNotMatch(src, /ctrlKey: k === 'k'/, 'the old runKey that put Ctrl on every «k»');
});
