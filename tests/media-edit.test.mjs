// V4.9 — «Editar» una imagen del Estudio (media.editRequest + submit con versionOf). Run: npm test
// Google y Meta de mentira (servidores locales): la original queda intacta (mismos bytes), la nueva es una versión de ella y la ficha
// de la original la lista. Sin ningún motor que edite, el error dice cuáles editarían y cómo encenderlos (la ruta lo da como 409).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as media from '../media.mjs';

const KEYS = ['HF_KEY', 'HF_API_KEY', 'HF_API_SECRET', 'GEMINI_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'FAL_KEY', 'AO_GEMINI_BASE', 'AO_META_BASE'];
async function withEnv(set, fn) { // only the engines the test names are on: a key on the owner's machine never leaks in
  const keep = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k]; Object.assign(process.env, set);
  try { return await fn(); } finally { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
const pngOf = (w, h) => { const b = Buffer.alloc(64); Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(30)]);

async function stand(answer) {
  const seen = [];
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', d => { b += d; }); req.on('end', () => { seen.push({ url: req.url, body: b ? JSON.parse(b) : null }); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(answer(req.url))); }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, seen, base: `http://127.0.0.1:${srv.address().port}` };
}
const brainDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-edit-'));

test('Nano Banana 2 edita: la original va de referencia, con su proporción y su carpeta; queda intacta y lista su versión', async () => {
  const g = await stand(() => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: pngOf(1080, 1920).toString('base64') } }] } }] }));
  try {
    await withEnv({ GEMINI_API_KEY: 'prueba-google', AO_GEMINI_BASE: g.base }, async () => {
      const brain = brainDir(); media.configure({}, brain, path.join(brain, 'data'));
      const f = media.addFolder('Lanzamiento');
      const orig = media.upload({ name: 'producto.png', data: 'data:image/png;base64,' + pngOf(1080, 1920).toString('base64'), folder: f.id });
      assert.equal(orig.w, 1080); assert.equal(media.ratioOf(orig), '9:16');
      const before = fs.readFileSync(path.join(media.dir(), orig.file));

      const req = media.editRequest({ file: orig.file, instruction: 'ponle un fondo de playa' });
      assert.deepEqual(req, { kind: 'image', model: 'nano-banana-2', prompt: 'ponle un fondo de playa', n: 1, settings: { aspectRatio: '9:16' }, media: { reference: [orig.file] }, versionOf: orig.file, by: 'you', folder: f.id });
      const j = media.submit(req);
      assert.equal(j.versionOf, orig.file);
      const done = await media.wait(j.id, 10000);
      assert.equal(done.state, 'done', done.error);

      const sent = g.seen.find(x => /:generateContent$/.test(x.url));
      assert.match(sent.url, /gemini-3\.1-flash-image:generateContent$/);
      const parts = sent.body.contents[0].parts;
      assert.equal(parts[0].text, 'ponle un fondo de playa');
      assert.equal(parts[1].inlineData.data, before.toString('base64'), 'the original goes in as the reference');
      assert.equal(sent.body.generationConfig.imageConfig.aspectRatio, '9:16');

      assert.ok(before.equals(fs.readFileSync(path.join(media.dir(), orig.file))), 'the original file keeps its bytes');
      const nu = media.item(done.items[0]);
      assert.equal(nu.versionOf, orig.file); assert.equal(nu.folder, f.id); assert.equal(nu.by, 'you');
      assert.notEqual(nu.file, orig.file);
      assert.deepEqual(media.item(orig.file).versions, [nu.file], 'the original record lists its version');
      assert.equal(media.item(orig.file).prompt, 'producto', 'and nothing else of it changed');
    });
  } finally { g.srv.close(); }
});

test('Muse Image edita por /images/edits (con la original en images[]); el modelo pedido gana si edita', async () => {
  const m = await stand(() => ({ data: [{ b64_json: webp.toString('base64') }], output_format: 'webp' }));
  try {
    await withEnv({ META_API_KEY: 'prueba-meta', AO_META_BASE: m.base + '/v1', GEMINI_API_KEY: 'prueba-google', AO_GEMINI_BASE: 'http://127.0.0.1:9' }, async () => {
      const brain = brainDir(); media.configure({}, brain, path.join(brain, 'data'));
      const orig = media.upload({ name: 'logo.png', data: 'data:image/png;base64,' + pngOf(1000, 1000).toString('base64') });
      const before = fs.readFileSync(path.join(media.dir(), orig.file));
      assert.equal(media.editRequest({ file: orig.file, instruction: 'x' }).model, 'nano-banana-2', 'without a choice, the best one on');
      assert.equal(media.editRequest({ file: orig.file, instruction: 'x', model: 'soul-2' }).model, 'nano-banana-2', 'a model that does not edit is not used');
      const req = media.editRequest({ file: orig.file, instruction: 'en dorado', model: 'muse-image' });
      assert.equal(req.model, 'muse-image'); assert.deepEqual(req.settings, { aspectRatio: '1:1' }); assert.equal(req.folder, undefined);
      const done = await media.wait(media.submit(req).id, 10000);
      assert.equal(done.state, 'done', done.error);
      const e = m.seen[0];
      assert.equal(e.url, '/v1/images/edits');
      assert.equal(e.body.images.length, 1);
      assert.equal(e.body.images[0].image_url, 'data:image/png;base64,' + before.toString('base64'));
      assert.ok(before.equals(fs.readFileSync(path.join(media.dir(), orig.file))));
      assert.equal(media.item(done.items[0]).versionOf, orig.file);
      assert.deepEqual(media.item(orig.file).versions, done.items);
    });
  } finally { m.srv.close(); }
});

test('sin ningún motor que edite: error no-edit-engine con los motores que editarían y cómo encenderlos', async () => {
  await withEnv({}, async () => {
    const brain = brainDir(); media.configure({}, brain, path.join(brain, 'data'));
    const orig = media.upload({ name: 'foto.png', data: 'data:image/png;base64,' + pngOf(800, 600).toString('base64') });
    assert.deepEqual(media.editModels(), []);
    let err; try { media.editRequest({ file: orig.file, instruction: 'más luz' }); } catch (e) { err = e; }
    assert.ok(err); assert.equal(err.code, 'no-edit-engine');
    const ids = err.engines.map(e => e.id).sort();
    assert.deepEqual(ids, ['fal', 'gemini', 'higgsfield', 'meta', 'openai']);
    for (const e of err.engines) { assert.ok(e.name); assert.match(e.how, /^setx [A-Z_]+ "/); }
  });
});

test('editar pide una imagen que exista y qué cambiar; una versión de algo que no está se rechaza', async () => {
  await withEnv({ GEMINI_API_KEY: 'k', AO_GEMINI_BASE: 'http://127.0.0.1:9' }, async () => {
    const brain = brainDir(); media.configure({}, brain, path.join(brain, 'data'));
    const orig = media.upload({ name: 'foto.png', data: 'data:image/png;base64,' + pngOf(800, 600).toString('base64') });
    const vid = media.upload({ name: 'clip.mp4', data: 'data:video/mp4;base64,' + Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(20)]).toString('base64') });
    assert.throws(() => media.editRequest({ file: '2026-01/no-esta.png', instruction: 'x' }), /no encuentro/);
    assert.throws(() => media.editRequest({ file: '../../etc/passwd', instruction: 'x' }), /no encuentro/);
    assert.throws(() => media.editRequest({ file: vid.file, instruction: 'x' }), /solo se puede editar una imagen/);
    assert.throws(() => media.editRequest({ file: orig.file, instruction: '   ' }), /qué quieres cambiar/);
    assert.equal(media.editRequest({ file: orig.file, instruction: 'x' }).settings.aspectRatio, '4:3');
    assert.throws(() => media.submit({ model: 'prueba', prompt: 'x', versionOf: '2026-01/no-esta.png' }), /no encuentro/);
  });
});
