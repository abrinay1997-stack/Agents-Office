// vision.mjs: the exact shape Claude gets (SDK content, the CLI's stream-json line) and what is refused before it is sent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sdkContent, cliInput, validateVision, MAX_B64 } from '../vision.mjs';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]).toString('base64');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString('base64');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 ')]).toString('base64');

test('SDK content: the images first, as base64 blocks, then the text', () => {
  const c = sdkContent('¿de qué color es?', [{ media_type: 'image/png', data: PNG, file: '2026-09/x.png' }]);
  assert.deepEqual(c, [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } }, { type: 'text', text: '¿de qué color es?' }]);
  assert.deepEqual(sdkContent('solo texto'), [{ type: 'text', text: 'solo texto' }]);
});

test('CLI: one stream-json user line, ended by a newline', () => {
  const line = cliInput('hola', [{ media_type: 'image/jpeg', data: JPG }, { media_type: 'image/png', data: PNG }]);
  assert.ok(line.endsWith('\n') && !line.slice(0, -1).includes('\n'));
  assert.deepEqual(JSON.parse(line), { type: 'user', message: { role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: JPG } },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } },
    { type: 'text', text: 'hola' }] } });
});

test('valid images pass, a data: URL is taken apart, the gallery id is kept', () => {
  const r = validateVision([{ file: '2026-09/a.png', media_type: 'image/png', data: PNG }, { media_type: 'image/jpeg', data: 'data:image/jpeg;base64,' + JPG }, { data: 'data:image/webp;base64,' + WEBP }]);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.images, [{ file: '2026-09/a.png', media_type: 'image/png', data: PNG }, { media_type: 'image/jpeg', data: JPG }, { media_type: 'image/webp', data: WEBP }]);
  assert.deepEqual(validateVision(undefined), { images: [] });
  assert.deepEqual(validateVision([]), { images: [] });
});

test('refused: more than 4, a wrong type, bad base64, too heavy, bytes that lie, a type that disagrees with its data URL', () => {
  const one = { media_type: 'image/png', data: PNG };
  assert.match(validateVision([one, one, one, one, one]).error, /como mucho 4/);
  assert.match(validateVision({}).error, /lista/);
  assert.match(validateVision([{ media_type: 'image/gif', data: PNG }]).error, /solo JPEG, PNG o WebP/);
  assert.match(validateVision([{ media_type: 'image/svg+xml', data: PNG }]).error, /solo JPEG/);
  assert.match(validateVision([{ media_type: 'image/png', data: '' }]).error, /vacía/);
  assert.match(validateVision([{ media_type: 'image/png', data: 'no es base64!' }]).error, /base64 válido/);
  assert.match(validateVision([{ media_type: 'image/png', data: 'A'.repeat(MAX_B64 + 4) }]).error, /pesa demasiado/);
  assert.match(validateVision([{ media_type: 'image/png', data: JPG }]).error, /no es un PNG/);
  assert.match(validateVision([{ media_type: 'image/png', data: 'data:image/jpeg;base64,' + JPG }]).error, /dice ser image\/png/);
  assert.match(validateVision([null]).error, /forma de imagen/);
});
