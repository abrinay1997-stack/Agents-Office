// V4.8 — Meta Muse Image in the Estudio (media.mjs). Run: npm test
// A local stand-in for api.meta.ai/v1 checks what the office sends and answers as Meta's images API does.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as media from '../media.mjs';

const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(30)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(40)]);

async function stand() {
  const seen = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, type: req.headers['content-type'], body: JSON.parse(b || '{}') });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ b64_json: webp.toString('base64') }], output_format: 'webp', usage: { images: 1 } }));
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, seen, base: `http://127.0.0.1:${srv.address().port}/v1` };
}
const envKeys = ['META_API_KEY', 'MODEL_API_KEY', 'AO_META_BASE'];

test('Muse Image: off without a key, on with META_API_KEY or with MODEL_API_KEY', () => {
  const keep = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  try {
    for (const k of envKeys) delete process.env[k];
    const on = () => media.models().find(m => m.id === 'muse-image').on;
    assert.equal(on(), false);
    process.env.MODEL_API_KEY = 'la-de-muse-spark'; assert.equal(on(), true);
    delete process.env.MODEL_API_KEY; process.env.META_API_KEY = 'la-de-meta'; assert.equal(on(), true);
    const m = media.models().find(x => x.id === 'muse-image');
    assert.equal(m.cost, 0.01); assert.equal(m.maker, 'Meta'); assert.equal(m.roles.reference, 10);
  } finally { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
});

test('Muse Image: text → /images/generations; with references → /images/edits with images: [{ image_url }]; the file keeps its format', async () => {
  const { srv, seen, base } = await stand();
  const keep = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { META_API_KEY: 'prueba-meta', AO_META_BASE: base }); delete process.env.MODEL_API_KEY;
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-meta-'));
  try {
    media.configure({}, brain, path.join(brain, 'data'));
    const a = media.submit({ model: 'muse-image', prompt: 'tabla de LaLiga hoy, con escudos', settings: { aspectRatio: '16:9', quality: 'low', outputFormat: 'webp' } });
    const da = await media.wait(a.id, 10000);
    assert.equal(da.state, 'done', da.error);
    const g = seen[0];
    assert.equal(g.url, '/v1/images/generations');
    assert.equal(g.auth, 'Bearer prueba-meta');
    assert.deepEqual(g.body, { model: 'muse-image-1.0', prompt: 'tabla de LaLiga hoy, con escudos', n: 1, size: '1792x1024', output_format: 'webp', response_format: 'b64_json', reasoning_strength: 'low' });
    assert.ok(da.items[0].endsWith('.webp'), da.items[0]);

    const ref = media.upload({ name: 'producto.png', data: 'data:image/png;base64,' + png.toString('base64') });
    const b = media.submit({ model: 'muse-image', prompt: 'ponlo en una mesa de café', media: { reference: [ref.id] } });
    const db = await media.wait(b.id, 10000);
    assert.equal(db.state, 'done', db.error);
    const e = seen[1];
    assert.equal(e.url, '/v1/images/edits');
    assert.match(e.type, /application\/json/, 'a JSON body, never multipart');
    assert.equal(e.body.images.length, 1);
    assert.match(e.body.images[0].image_url, /^data:image\/png;base64,/);
    assert.equal(e.body.size, '1024x1024');
    assert.equal(e.body.reasoning_strength, 'high');
  } finally {
    srv.close();
    for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
