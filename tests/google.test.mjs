// V4.4 — Google on the Gemini API: Nano Banana 2 / Lite / Pro and Veo 3.1 (media.mjs). Run: npm test
// A local stand-in for generativelanguage.googleapis.com checks what the office sends and answers as Google does.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as media from '../media.mjs';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(40)]);
const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(40)]);

async function stand() {
  const seen = []; let polls = 0;
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
      seen.push({ method: req.method, url: req.url, key: req.headers['x-goog-api-key'], body: b ? JSON.parse(b) : null });
      const j = o => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (/:generateContent$/.test(req.url)) return j({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] });
      if (/:predictLongRunning$/.test(req.url)) return j({ name: 'models/veo-3.1-generate-preview/operations/op123' });
      if (/operations\/op123$/.test(req.url)) { polls++; return j(polls < 2 ? { name: 'x', done: false } : { name: 'x', done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: `http://127.0.0.1:${srv.address().port}/files/v1:download?alt=media` } }] } } }); }
      if (/\/files\/v1:download/.test(req.url)) { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(mp4); }
      res.writeHead(404); res.end('{}');
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, seen, base: `http://127.0.0.1:${srv.address().port}` };
}

test('Google: Nano Banana 2 sends its own model id and the size; Veo 3.1 asks, waits for the operation and saves the video', async () => {
  const { srv, seen, base } = await stand();
  const keep = { k: process.env.GEMINI_API_KEY, b: process.env.AO_GEMINI_BASE, p: process.env.AO_POLL_MS };
  Object.assign(process.env, { GEMINI_API_KEY: 'prueba-key', AO_GEMINI_BASE: base, AO_POLL_MS: '20' });
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-google-'));
  try {
    media.configure({}, brain, path.join(brain, 'data'));
    const ids = media.models().filter(m => m.engine === 'gemini').map(m => m.id);
    for (const id of ['nano-banana', 'nano-banana-2', 'nano-banana-2-lite', 'nano-banana-pro', 'veo-3.1', 'veo-3.1-fast', 'veo-3.1-lite']) assert.ok(ids.includes(id), id);

    const img = media.submit({ model: 'nano-banana-2', prompt: 'un gato', settings: { aspectRatio: '16:9', imageSize: '2K' } });
    const di = await media.wait(img.id, 10000);
    assert.equal(di.state, 'done', di.error);
    const gc = seen.find(x => /:generateContent$/.test(x.url));
    assert.match(gc.url, /models\/gemini-3\.1-flash-image:generateContent$/);
    assert.equal(gc.key, 'prueba-key');
    assert.deepEqual(gc.body.generationConfig.imageConfig, { aspectRatio: '16:9', imageSize: '2K' });

    const vid = media.submit({ model: 'veo-3.1', prompt: 'olas al atardecer', settings: { aspectRatio: '9:16', resolution: '720p', duration: '6' } });
    const dv = await media.wait(vid.id, 15000);
    assert.equal(dv.state, 'done', dv.error);
    const post = seen.find(x => /:predictLongRunning$/.test(x.url));
    assert.match(post.url, /models\/veo-3\.1-generate-preview:predictLongRunning$/);
    assert.deepEqual(post.body, { instances: [{ prompt: 'olas al atardecer' }], parameters: { aspectRatio: '9:16', resolution: '720p', durationSeconds: 6 } });
    assert.ok(seen.some(x => /operations\/op123$/.test(x.url) && x.method === 'GET'), 'the operation is polled');
    const file = path.join(media.dir(), dv.items[0]); assert.ok(fs.existsSync(file) && file.endsWith('.mp4'));
  } finally {
    srv.close();
    for (const [k, v] of [['GEMINI_API_KEY', keep.k], ['AO_GEMINI_BASE', keep.b], ['AO_POLL_MS', keep.p]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('Veo: what Google allows — a first and last frame, references only at 720p landscape, 1080p in 8 s', () => {
  const m = media.model('veo-3.1'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-veo-')), f = path.join(dir, 'a.png'); fs.writeFileSync(f, png);
  const file = { p: f, mime: 'image/png' };
  const withFrames = media.veoRequest(m, { prompt: 'x', s: { aspectRatio: '9:16', resolution: '1080p', duration: '4' } }, { start: [file], end: [file], reference: [] });
  assert.ok(withFrames.instances[0].image.bytesBase64Encoded && withFrames.instances[0].lastFrame.mimeType === 'image/png');
  assert.equal(withFrames.parameters.durationSeconds, 8);
  const withRefs = media.veoRequest(m, { prompt: 'x', s: { aspectRatio: '9:16', resolution: '1080p', duration: '8' } }, { start: [], end: [], reference: [file, file, file, file] });
  assert.equal(withRefs.instances[0].referenceImages.length, 3);
  assert.equal(withRefs.instances[0].referenceImages[0].referenceType, 'asset');
  assert.deepEqual([withRefs.parameters.aspectRatio, withRefs.parameters.resolution], ['16:9', '720p']);
  const lastOnly = media.veoRequest(m, { prompt: 'x', s: {} }, { start: [], end: [file], reference: [] });
  assert.equal(lastOnly.instances[0].lastFrame, undefined, 'a last frame alone is not sent');
});
