// V4.8 — understanding video and audio with Meta Muse Spark (understand.mjs, and audio in the Estudio's gallery). Run: npm test
// A local stand-in for api.meta.ai/v1 (Files API + Responses API) checks what the office sends.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as U from '../understand.mjs';
import * as media from '../media.mjs';

const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(40)]);
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(40)]);
const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(40)]);

async function stand({ empty = false } = {}) {
  const seen = [];
  const srv = http.createServer((req, res) => {
    const chunks = []; req.on('data', d => chunks.push(d)); req.on('end', () => {
      const raw = Buffer.concat(chunks), type = req.headers['content-type'] || '';
      seen.push({ url: req.url, auth: req.headers.authorization, type, body: /json/.test(type) ? JSON.parse(raw.toString() || '{}') : raw.toString('latin1') });
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url === '/v1/files') return res.end(JSON.stringify({ id: 'file-abc', object: 'file', purpose: 'user_data' }));
      if (req.url === '/v1/responses') return res.end(JSON.stringify(empty ? { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }
        : { output: [{ type: 'message', content: [{ type: 'output_text', text: 'Una mujer canta frente a una vela.' }] }], usage: { input_tokens: 1200, output_tokens: 300 } }));
      res.end('{}');
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, seen, base: `http://127.0.0.1:${srv.address().port}/v1` };
}
const keys = ['META_API_KEY', 'MODEL_API_KEY', 'AO_META_BASE'];
const withEnv = async (env, fn) => { const keep = Object.fromEntries(keys.map(k => [k, process.env[k]])); for (const k of keys) delete process.env[k]; Object.assign(process.env, env); try { return await fn(); } finally { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } } };
const tmpFile = (name, buf) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-und-')), f = path.join(d, name); fs.writeFileSync(f, buf); return f; };

test('a video from the gallery goes up by the Files API and is asked about by file_id, on muse-spark-1.3', async () => {
  const { srv, seen, base } = await stand();
  try {
    await withEnv({ MODEL_API_KEY: 'k-spark', AO_META_BASE: base }, async () => {
      const out = await U.understand({ prompt: 'Describe qué pasa', kind: 'video', filePath: tmpFile('clip.mp4', mp4) });
      assert.equal(out.text, 'Una mujer canta frente a una vela.');
      assert.equal(out.model, 'muse-spark-1.3');
      assert.deepEqual(out.usage, { input_tokens: 1200, output_tokens: 300 });
      assert.equal(seen[0].url, '/v1/files'); assert.match(seen[0].type, /multipart\/form-data/); assert.match(seen[0].body, /name="purpose"\r\n\r\nuser_data/);
      assert.equal(seen[0].auth, 'Bearer k-spark');
      const r = seen[1];
      assert.equal(r.url, '/v1/responses');
      assert.equal(r.body.model, 'muse-spark-1.3'); assert.equal(r.body.max_output_tokens, 4000);
      assert.deepEqual(r.body.input[0].content, [{ type: 'input_text', text: 'Describe qué pasa' }, { type: 'input_file', file_id: 'file-abc' }]);
    });
  } finally { srv.close(); }
});

test('a public video URL goes as input_video with nothing uploaded; an audio goes inline on muse-spark-1.2', async () => {
  const { srv, seen, base } = await stand();
  try {
    await withEnv({ META_API_KEY: 'k-meta', AO_META_BASE: base }, async () => {
      await U.understand({ prompt: 'Resume', kind: 'video', url: 'https://ejemplo.com/clip.mp4' });
      assert.equal(seen.length, 1, 'no upload for a URL');
      assert.deepEqual(seen[0].body.input[0].content[1], { type: 'input_video', video_url: 'https://ejemplo.com/clip.mp4' });
      const out = await U.understand({ prompt: 'Transcribe', kind: 'audio', filePath: tmpFile('nota.wav', wav) });
      assert.equal(out.model, 'muse-spark-1.2');
      const c = seen[1].body.input[0].content[1];
      assert.equal(c.type, 'input_audio'); assert.equal(c.input_audio.format, 'wav'); assert.equal(Buffer.from(c.input_audio.data, 'base64').toString('ascii', 0, 4), 'RIFF');
    });
  } finally { srv.close(); }
});

test('it says what is wrong: no key, no prompt, a wrong format, an http URL, an empty answer', async () => {
  await withEnv({}, async () => { await assert.rejects(U.understand({ prompt: 'x', kind: 'video', url: 'https://a.com/v.mp4' }), /falta la key de Meta/); });
  const { srv, base } = await stand({ empty: true });
  try {
    await withEnv({ META_API_KEY: 'k', AO_META_BASE: base }, async () => {
      await assert.rejects(U.understand({ prompt: ' ', kind: 'video', url: 'https://a.com/v.mp4' }), /falta la instrucción/);
      await assert.rejects(U.understand({ prompt: 'x', kind: 'video', url: 'http://a.com/v.mp4' }), /https/);
      await assert.rejects(U.understand({ prompt: 'x', kind: 'audio', filePath: tmpFile('clip.mp4', mp4) }), /mp3 o wav/);
      await assert.rejects(U.understand({ prompt: 'x', kind: 'video', filePath: tmpFile('nota.mp3', mp3) }), /mp4/);
      await assert.rejects(U.understand({ prompt: 'x', kind: 'video', url: 'https://a.com/v.mp4' }), /no devolvió texto \(max_output_tokens\)/);
    });
  } finally { srv.close(); }
});

test('the gallery takes an mp3 or a wav as an audio, and never passes one to a model as an image', () => {
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-und-gal-'));
  media.configure({}, brain, path.join(brain, 'data'));
  const a = media.upload({ name: 'reunión.mp3', data: 'data:audio/mpeg;base64,' + mp3.toString('base64') });
  const w = media.upload({ name: 'nota.wav', data: 'data:audio/wav;base64,' + wav.toString('base64') });
  assert.equal(a.kind, 'audio'); assert.ok(a.file.endsWith('.mp3')); assert.equal(w.kind, 'audio');
  assert.ok(media.resolve(a.id));
  assert.throws(() => media.upload({ name: 'falso.mp3', data: 'data:audio/mpeg;base64,' + Buffer.from('hola mundo').toString('base64') }), /no es lo que dice ser/);
  assert.throws(() => media.submit({ model: 'prueba', prompt: 'x', media: { reference: [a.id] } }), /un audio no sirve de referencia/);
});
