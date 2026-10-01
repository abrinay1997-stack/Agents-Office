// Auditoría 1 oct 2026 (INF-04) — http-json.mjs: the 6 s task poll gzipped, answered 304 when nothing changed, and light. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { encodeJson, lightTasks, GZIP_FROM } from '../http-json.mjs';

test('a large answer goes gzipped only when the client takes gzip; a small one never', () => {
  const big = JSON.stringify({ x: 'a'.repeat(GZIP_FROM * 4) });
  const gz = encodeJson(big, { 'accept-encoding': 'gzip, deflate, br' });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.ok(gz.body.length < big.length / 10);
  assert.equal(zlib.gunzipSync(gz.body).toString(), big);
  assert.equal(encodeJson(big, {}).headers['content-encoding'], undefined);
  assert.equal(encodeJson('{"a":1}', { 'accept-encoding': 'gzip' }).headers['content-encoding'], undefined);
});

test('with an ETag: the same body answers 304 with nothing in it; a different one does not', () => {
  const a = encodeJson('[1,2,3]', {}, { etag: true });
  assert.ok(a.headers.etag); assert.equal(a.status, null); assert.equal(a.headers['cache-control'], 'no-cache');
  const again = encodeJson('[1,2,3]', { 'if-none-match': a.headers.etag }, { etag: true });
  assert.equal(again.status, 304); assert.equal(again.body, null);
  assert.equal(encodeJson('[1,2,4]', { 'if-none-match': a.headers.etag }, { etag: true }).status, null);
  assert.equal(encodeJson('[1,2,3]', {}).headers.etag, undefined, 'no ETag unless asked');
});

test('the light list keeps an archived task\'s id and date, and leaves its work out; the others are untouched', () => {
  const live = { id: 'a', state: 'done', result: 'x'.repeat(5000), agent: 'piper' };
  const old = { id: 'b', state: 'done', archived: true, archivedAt: 5, result: 'y'.repeat(5000), preview: { to: 'z' }, agent: 'piper' };
  const l = lightTasks([live, old]);
  assert.equal(l[0], live);
  assert.deepEqual(l[1], { id: 'b', archived: true, archivedAt: 5, agent: 'piper', state: 'done' });
  assert.deepEqual(lightTasks(null), []);
});
