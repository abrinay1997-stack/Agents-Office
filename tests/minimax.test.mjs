// V4.10 — MiniMax direct in the Estudio (minimax.mjs + media.mjs): image, video, voice, music. Run: npm test
// Everything talks to a local stand-in (tests/minimax-stand.mjs) through MINIMAX_API_BASE: no real key, no call to api.minimax.io.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as media from '../media.mjs';
import * as mmx from '../minimax.mjs';
import { standIn, env, KEY, png, mp3 } from './minimax-stand.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const box = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mmx-')); return { dir, data: path.join(dir, 'data') }; };
const on = base => env({ MINIMAX_API_KEY: KEY, MINIMAX_API_BASE: base, MINIMAX_GROUP_ID: undefined, AO_POLL_MS: '15' });
const jpg = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(40)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(30)]);

test('the engine is off without MINIMAX_API_KEY and on with it; the catalog has image, video, voice and music', () => {
  const restore = env({ MINIMAX_API_KEY: undefined });
  try {
    const mm = () => media.models().filter(m => m.engine === 'minimax');
    assert.ok(mm().length >= 9 && mm().every(m => !m.on));
    const e = media.engines().find(x => x.id === 'minimax');
    assert.deepEqual([e.name, e.env, e.site, e.how], ['MiniMax', 'MINIMAX_API_KEY', 'platform.minimax.io', 'setx MINIMAX_API_KEY "tu-key"']);
    process.env.MINIMAX_API_KEY = KEY;
    assert.ok(mm().every(m => m.on));
    const by = Object.fromEntries(mm().map(m => [m.id, m]));
    for (const [id, kind] of [['mmx-image-01', 'image'], ['mmx-h3', 'video'], ['mmx-h3-max', 'video'], ['mmx-voz-2.8-hd', 'audio'], ['mmx-voz-2.8-turbo', 'audio'], ['mmx-voz-2.6-hd', 'audio'], ['mmx-voz-2.6-turbo', 'audio'], ['mmx-musica-3', 'music']]) assert.equal(by[id]?.kind, kind, id);
    assert.deepEqual(by['mmx-voz-2.8-hd'].settings.voiceId, { type: 'text', default: 'Spanish_Narrator', max: 256, placeholder: 'Spanish_Narrator o una voz tuya' });
    assert.equal(by['mmx-musica-3'].settings.instrumental.type, 'boolean');
    assert.equal(by['mmx-h3'].maker, 'MiniMax');
    assert.ok(!by['mmx-voz-2.8-hd'].settings.emotion.values.includes('neutral'), 'MiniMax has no «neutral» emotion');
  } finally { restore(); }
});

test('image-01: text → base64 images in the gallery; one face as subject_reference (JPG/PNG), WEBP refused in words', async () => {
  const st = await standIn(); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const a = media.submit({ model: 'mmx-image-01', prompt: 'una taza de café en la mañana', n: 2, settings: { aspectRatio: '16:9' } });
    const da = await media.wait(a.id, 30000);
    assert.equal(da.state, 'done', da.error);
    assert.equal(da.items.length, 2); assert.ok(da.items.every(f => f.endsWith('.png')));
    const g = st.seen.find(x => x.path === '/v1/image_generation');
    assert.equal(g.auth, `Bearer ${KEY}`);
    assert.deepEqual(g.body, { model: 'image-01', prompt: 'una taza de café en la mañana', aspect_ratio: '16:9', response_format: 'base64', n: 2, prompt_optimizer: false });
    assert.equal(media.item(da.items[0]).kind, 'image');

    const face = media.upload({ name: 'cara.jpg', data: 'data:image/jpeg;base64,' + jpg.toString('base64') });
    const b = await media.wait(media.submit({ model: 'mmx-image-01', prompt: 'la misma persona en una playa', media: { reference: [face.id] } }).id, 30000);
    assert.equal(b.state, 'done', b.error);
    const r = st.seen.filter(x => x.path === '/v1/image_generation')[1];
    assert.equal(r.body.subject_reference.length, 1);
    assert.equal(r.body.subject_reference[0].type, 'character');
    assert.match(r.body.subject_reference[0].image_file, /^data:image\/jpeg;base64,/);

    const w = media.upload({ name: 'cara.webp', data: 'data:image/webp;base64,' + webp.toString('base64') });
    const c = await media.wait(media.submit({ model: 'mmx-image-01', prompt: 'otra', media: { reference: [w.id] } }).id, 30000);
    assert.equal(c.state, 'failed'); assert.match(c.error, /JPG o PNG/);
    assert.throws(() => media.submit({ model: 'mmx-image-01', prompt: 'x'.repeat(1501) }), /máx\. 1500/);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('video H3: queued → running → succeeded → the mp4 is downloaded; first/last frame as first_frame/last_frame, references never with them', async () => {
  const st = await standIn(); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const s0 = media.upload({ name: 'inicio.png', data: 'data:image/png;base64,' + png.toString('base64') });
    const j = media.submit({ model: 'mmx-h3', prompt: 'el café humea, cámara lenta', settings: { resolution: '2K', duration: 6, aspectRatio: '9:16' }, media: { start: [s0.id], end: [s0.id], reference: [s0.id] } });
    assert.equal(j.unit, 0.78, 'H3 at 2K: US$0.13 a second × 6');
    const d = await media.wait(j.id, 30000);
    assert.equal(d.state, 'done', d.error);
    assert.ok(d.items[0].endsWith('.mp4')); assert.equal(media.item(d.items[0]).kind, 'video');
    const c = st.seen.find(x => x.path === '/v2/video_generation');
    assert.equal(c.body.model, 'MiniMax-H3'); assert.equal(c.body.resolution, '2K'); assert.equal(c.body.duration, 6); assert.equal(c.body.ratio, '9:16');
    assert.deepEqual(c.body.content.map(x => x.role || x.type), ['text', 'first_frame', 'last_frame'], 'a reference never goes with a frame');
    assert.match(c.body.content[1].image_url.url, /^data:image\/png;base64,/);
    const polls = st.seen.filter(x => x.path.startsWith('/v2/query/video_generation/'));
    assert.ok(polls.length >= 3, 'polled until succeeded');

    const r = await media.wait(media.submit({ model: 'mmx-h3-max', prompt: 'sigue a esta persona', media: { reference: [s0.id] } }).id, 30000);
    assert.equal(r.state, 'done', r.error);
    const c2 = st.seen.filter(x => x.path === '/v2/video_generation')[1];
    assert.deepEqual(c2.body.content.map(x => x.role || x.type), ['text', 'reference_image']);
    assert.equal(c2.body.model, 'MiniMax-H3-Max'); assert.equal(c2.body.resolution, '768P'); assert.equal(c2.body.duration, 5);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('video: the task_id is kept in the job, so a restart of the office resumes the poll and downloads it', async () => {
  const st = await standIn({ video: ['queued', 'running', 'running', 'running', 'running', 'running', 'running', 'running'] }); const restore = on(st.base);
  const one = box(), two = box();
  try {
    media.configure({}, one.dir, one.data);
    const j = media.submit({ model: 'mmx-h3', prompt: 'un perro en la playa' });
    for (let i = 0; i < 1500 && !st.seen.some(x => x.path.startsWith('/v2/query/')); i++) await new Promise(r => setTimeout(r, 10));
    const saved = JSON.parse(fs.readFileSync(path.join(one.data, 'media-jobs.json'), 'utf8')).find(x => x.id === j.id);
    assert.equal(saved.state, 'running'); assert.equal(saved.remote.length, 1);
    const taskId = saved.remote[0].id; assert.match(taskId, /^\d+$/);
    // the office «restarts» with that jobs file: the job is queued again with the same task id, and nothing new is created at MiniMax
    fs.mkdirSync(two.data, { recursive: true }); fs.writeFileSync(path.join(two.data, 'media-jobs.json'), JSON.stringify([saved]));
    const creates = st.seen.filter(x => x.path === '/v2/video_generation').length;
    media.configure({}, two.dir, two.data);
    const back = media.job(j.id); assert.equal(back.resumed, 1);
    const d = await media.wait(j.id, 30000);
    assert.equal(d.state, 'done', d.error);
    assert.equal(st.seen.filter(x => x.path === '/v2/video_generation').length, creates, 'no second task at MiniMax');
    assert.ok(st.seen.some(x => x.path === `/v2/query/video_generation/${taskId}`));
    assert.ok(fs.existsSync(path.join(two.dir, 'Agents Office', 'media', d.items[0])));
  } finally { restore(); await new Promise(r => setTimeout(r, 300)); await st.close(); for (const b of [one, two]) fs.rmSync(b.dir, { recursive: true, force: true }); }
});

test('video: a cancel asks MiniMax to cancel the queued task (DELETE) and the job ends «Cancelado por ti»; a failed task says why', async () => {
  const st = await standIn({ video: Array(400).fill('queued') }); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const j = media.submit({ model: 'mmx-h3', prompt: 'nunca termina' });
    for (let i = 0; i < 1500 && !st.seen.some(x => x.path.startsWith('/v2/query/')); i++) await new Promise(r => setTimeout(r, 10));
    media.cancel(j.id);
    const d = await media.wait(j.id, 30000);
    assert.equal(d.state, 'failed'); assert.equal(d.error, 'Cancelado por ti.');
    const del = () => st.seen.some(x => x.method === 'DELETE' && /^\/v2\/video_generation\/\d+$/.test(x.path));
    for (let i = 0; i < 200 && !del(); i++) await new Promise(r => setTimeout(r, 10)); // the DELETE is sent without waiting for it: it may land just after the job ends
    assert.ok(st.seen.some(x => x.method === 'DELETE' && /^\/v2\/video_generation\/\d+$/.test(x.path)));
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  const st2 = await standIn({ video: ['queued', 'failed'] }); const restore2 = on(st2.base); const b = box();
  try {
    media.configure({}, b.dir, b.data);
    const d = await media.wait(media.submit({ model: 'mmx-h3', prompt: 'algo' }).id, 30000);
    assert.equal(d.state, 'failed'); assert.match(d.error, /filtro de contenido/);
  } finally { restore2(); await st2.close(); fs.rmSync(b.dir, { recursive: true, force: true }); }
});

test('voice: the HEX audio becomes an mp3 in the gallery (kind audio), with the voice, emotion and speed sent as MiniMax wants them', async () => {
  const st = await standIn(); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const j = media.submit({ kind: 'audio', prompt: 'Hola, bienvenidos a PanaClaw.', settings: { voiceId: 'Spanish_SereneWoman', emotion: 'happy', speed: 1.2, pitch: 2 } });
    assert.equal(j.model, 'mmx-voz-2.8-turbo', 'the default voice model');
    const d = await media.wait(j.id, 30000);
    assert.equal(d.state, 'done', d.error);
    const it = media.item(d.items[0]);
    assert.equal(it.kind, 'audio'); assert.equal(it.ext, 'mp3'); assert.equal(it.seconds, 2.5); assert.equal(it.voiceId, 'Spanish_SereneWoman');
    assert.deepEqual(fs.readFileSync(path.join(dir, 'Agents Office', 'media', d.items[0])), mp3, 'hex decoded byte for byte');
    const t = st.seen.find(x => x.path === '/v1/t2a_v2');
    assert.equal(t.body.model, 'speech-2.8-turbo'); assert.equal(t.body.output_format, 'hex'); assert.equal(t.body.stream, false);
    assert.deepEqual(t.body.voice_setting, { voice_id: 'Spanish_SereneWoman', speed: 1.2, vol: 1, pitch: 2, emotion: 'happy' });
    assert.equal(t.body.audio_setting.format, 'mp3');
    // no emotion → the field is left out (MiniMax has no «neutral»); wav comes back as a .wav
    const w = await media.wait(media.submit({ model: 'mmx-voz-2.8-hd', prompt: 'Otra frase.', settings: { format: 'wav' } }).id, 30000);
    assert.equal(w.state, 'done', w.error); assert.ok(w.items[0].endsWith('.wav'));
    const t2 = st.seen.filter(x => x.path === '/v1/t2a_v2')[1];
    assert.equal(t2.body.voice_setting.emotion, undefined); assert.equal(t2.body.voice_setting.voice_id, 'Spanish_Narrator');
    assert.equal(media.estimate({ model: 'mmx-voz-2.8-hd', prompt: 'x'.repeat(2000) }), 0.2, 'US$100 a million characters');
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('voice: fluent and whisper only on speech-2.6 (MiniMax T2A doc) — the 2.8 models neither offer nor send them', async () => {
  const opts = id => media.models().find(x => x.id === id).settings.emotion.values;
  for (const id of ['mmx-voz-2.8-hd', 'mmx-voz-2.8-turbo']) { assert.ok(!opts(id).includes('whisper') && !opts(id).includes('fluent'), id); assert.ok(opts(id).includes('calm')); }
  for (const id of ['mmx-voz-2.6-hd', 'mmx-voz-2.6-turbo']) assert.ok(opts(id).includes('whisper') && opts(id).includes('fluent'), id);
  assert.deepEqual(mmx.emotionsFor('speech-2.6-hd'), mmx.EMOTIONS); assert.ok(!mmx.emotionsFor('speech-2.8-hd').includes('fluent'));
  const st = await standIn(); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const a = await media.wait(media.submit({ model: 'mmx-voz-2.8-hd', prompt: 'En voz baja.', settings: { emotion: 'whisper' } }).id, 30000);
    assert.equal(a.state, 'done', a.error);
    await mmx.tts({ text: 'Directo.', model: 'speech-2.8-turbo', emotion: 'fluent' });
    const b = await media.wait(media.submit({ model: 'mmx-voz-2.6-hd', prompt: 'En voz baja.', settings: { emotion: 'whisper' } }).id, 30000);
    assert.equal(b.state, 'done', b.error);
    const sent = st.seen.filter(x => x.path === '/v1/t2a_v2').map(x => [x.body.model, x.body.voice_setting.emotion]);
    assert.deepEqual(sent, [['speech-2.8-hd', undefined], ['speech-2.8-turbo', undefined], ['speech-2.6-hd', 'whisper']]);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('video: a job resumed hours after it started is still asked at MiniMax (the 30-minute limit counts from the resume) and downloaded', async () => {
  const st = await standIn({ video: [] }); const restore = on(st.base); const { dir, data } = box();
  try {
    const twoHours = Date.now() - 2 * 3600e3;
    const saved = { id: 'jold1', state: 'running', kind: 'video', model: 'mmx-h3', engine: 'minimax', prompt: 'un perro en la playa', n: 1, s: { resolution: '768P', duration: 5 }, media: {}, weight: 5, by: 'owner', at: twoHours, startedAt: twoHours, items: [], unit: 0.4, remote: [{ id: '424010985799999' }] };
    fs.mkdirSync(data, { recursive: true }); fs.writeFileSync(path.join(data, 'media-jobs.json'), JSON.stringify([saved]));
    media.configure({}, dir, data);
    const d = await media.wait('jold1', 30000);
    assert.equal(d.state, 'done', d.error);
    assert.ok(st.seen.some(x => x.path === '/v2/query/video_generation/424010985799999'), 'asked at least once');
    assert.equal(st.seen.filter(x => x.path === '/v2/video_generation').length, 0, 'no new task');
    assert.equal(d.startedAt, twoHours, 'its first start is kept');
  } finally { restore(); await new Promise(r => setTimeout(r, 200)); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('video n=2: the second task refused (1008, no balance) — the first, already paid, is still polled and downloaded, with a warning', async () => {
  const st = await standIn({ video: [], failFrom: { '/v2/video_generation': [2, 1008, 'insufficient balance'] } }); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const d = await media.wait(media.submit({ model: 'mmx-h3', prompt: 'dos tomas', n: 2 }).id, 30000);
    assert.equal(d.state, 'done', d.error); assert.equal(d.items.length, 1);
    assert.match(d.warning, /se hicieron 1 de 2/);
    assert.equal(st.seen.filter(x => x.path.startsWith('/v2/query/')).length, 1);
    // none created → the job fails with the reason
    const st2 = await standIn({ fail: { '/v2/video_generation': [1008, 'insufficient balance'] } }); const r2 = on(st2.base);
    try { const f = await media.wait(media.submit({ model: 'mmx-h3', prompt: 'sin saldo', n: 2 }).id, 30000); assert.equal(f.state, 'failed'); assert.ok(f.error); }
    finally { r2(); await st2.close(); }
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('music: instrumental goes as prompt + is_instrumental; a song as lyrics with its style; the record says wanted: music', async () => {
  const st = await standIn(); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const a = await media.wait(media.submit({ kind: 'music', prompt: 'lo-fi suave para un reel de café', settings: { instrumental: true } }).id, 30000);
    assert.equal(a.state, 'done', a.error);
    const ia = media.item(a.items[0]); assert.equal(ia.kind, 'audio'); assert.equal(ia.wanted, 'music'); assert.equal(ia.seconds, 61);
    const m1 = st.seen.find(x => x.path === '/v1/music_generation');
    assert.equal(m1.body.model, 'music-3.0'); assert.equal(m1.body.is_instrumental, true); assert.equal(m1.body.prompt, 'lo-fi suave para un reel de café'); assert.equal(m1.body.lyrics, undefined);
    const song = '[Verse]\nOficina de agentes\n[Chorus]\nTodo sucede';
    const b = await media.wait(media.submit({ model: 'mmx-musica-3-gratis', prompt: song, settings: { style: 'pop latino alegre' } }).id, 30000);
    assert.equal(b.state, 'done', b.error);
    const m2 = st.seen.filter(x => x.path === '/v1/music_generation')[1];
    assert.equal(m2.body.model, 'music-3.0-free'); assert.equal(m2.body.is_instrumental, false); assert.equal(m2.body.lyrics, song); assert.equal(m2.body.prompt, 'pop latino alegre');
    assert.throws(() => media.submit({ kind: 'music', prompt: 'x'.repeat(2001), settings: { instrumental: true } }), /máx\. 2000/);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('HTTP 200 with base_resp ≠ 0 is an error in plain words (no balance, bad key, sensitive content)', async () => {
  const st = await standIn({ fail: { '/v1/t2a_v2': [1008, 'insufficient balance'], '/v1/music_generation': [1026, 'input new_sensitive'] } }); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const a = await media.wait(media.submit({ kind: 'audio', prompt: 'hola' }).id, 30000);
    assert.equal(a.state, 'failed'); assert.match(a.error, /no tiene saldo/); assert.match(a.error, /platform\.minimax\.io/);
    const b = await media.wait(media.submit({ kind: 'music', prompt: 'algo', settings: { instrumental: true } }).id, 30000);
    assert.equal(b.state, 'failed'); assert.match(b.error, /filtro de contenido sensible/);
    process.env.MINIMAX_API_KEY = 'otra-key-que-no-es';
    await assert.rejects(mmx.tts({ text: 'hola' }), /la key de MiniMax no es válida/);
    assert.equal(mmx.explain(2038), 'tu cuenta de MiniMax no tiene permiso para clonar voces: verifica la cuenta en platform.minimax.io');
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('budget: a video weighs 5, music 3, a voice-over 1 — and the day\'s count keeps the audios', async () => {
  const st = await standIn(); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({ media: { dailyLimit: 9 } }, dir, data);
    assert.equal((await media.wait(media.submit({ kind: 'music', prompt: 'jingle', settings: { instrumental: true } }).id, 30000)).state, 'done');
    assert.equal((await media.wait(media.submit({ kind: 'audio', prompt: 'hola' }).id, 30000)).state, 'done');
    const b = media.budget();
    assert.equal(b.audios, 2); assert.equal(b.music, 1); assert.equal(b.used, 4); assert.equal(b.left, 5);
    assert.equal(media.submit({ model: 'mmx-h3', prompt: 'un video' }).weight, 5, 'a video still fits: 4 + 5 = 9');
    assert.throws(() => media.submit({ kind: 'audio', prompt: 'una más' }), /tope diario alcanzado/);
  } finally { restore(); await new Promise(r => setTimeout(r, 300)); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the key never travels: not in models(), engines(), a job, a gallery record or an error', async () => {
  const st = await standIn({ fail: { '/v1/t2a_v2': [2049, 'invalid api key'] } }); const restore = on(st.base); const { dir, data } = box();
  try {
    media.configure({}, dir, data);
    const a = await media.wait(media.submit({ kind: 'audio', prompt: 'hola' }).id, 30000);
    const i = await media.wait(media.submit({ model: 'mmx-image-01', prompt: 'una taza' }).id, 30000);
    const all = JSON.stringify([media.models(), media.engines(), media.jobs(), media.list(), media.budget(), a, i]) + fs.readFileSync(path.join(data, 'media-jobs.json'), 'utf8');
    assert.ok(!all.includes(KEY), 'the key leaked');
    assert.match(a.error, /key de MiniMax no es válida/);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

/* ---------- the agents' tools (estudio-mcp.mjs): generar_voz and generar_musica only with a model of that kind on ---------- */
async function fakeOffice(models) {
  const posted = [];
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
    res.writeHead(200, { 'content-type': 'application/json' });
    if (req.url.startsWith('/api/media/models')) return res.end(JSON.stringify({ models, engines: [{ id: 'minimax', name: 'MiniMax', on: true }], default: { audio: 'mmx-voz-2.8-turbo', music: 'mmx-musica-3' }, voices: { voices: [{ voiceId: 'AbrinayVoz01', name: 'Abrinay' }], system: [] }, budget: { left: null, maxPerRequest: 8 } }));
    if (req.url === '/api/media/jobs' && req.method === 'POST') { const j = JSON.parse(b); posted.push(j); return res.end(JSON.stringify({ job: { id: 'jx1', state: 'done', kind: j.kind, items: [`2026-09/2026-09-30 voz 101010.mp3`], modelName: 'MiniMax Voz', cost: 0.01 } })); }
    res.end('{}');
  }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, posted, url: `http://127.0.0.1:${srv.address().port}` };
}
async function mcp(officeUrl, msgs) {
  const p = spawn(process.execPath, ['estudio-mcp.mjs'], { cwd: ROOT, env: { ...process.env, AO_OFFICE: officeUrl, AO_AGENT: '', AO_TASK: '' }, stdio: ['pipe', 'pipe', 'ignore'] });
  let out = ''; p.stdout.on('data', d => { out += d; });
  const got = [];
  for (const m of msgs) {
    p.stdin.write(JSON.stringify(m) + '\n');
    for (let i = 0; i < 300 && !out.includes('\n'); i++) await new Promise(r => setTimeout(r, 10));
    const k = out.indexOf('\n'); got.push(JSON.parse(out.slice(0, k))); out = out.slice(k + 1);
  }
  p.kill(); return got;
}
const M = (id, kind, on) => ({ id, kind, on, engine: 'minimax', name: id, note: '', settings: {}, roles: {} });

test('estudio-mcp: generar_voz and generar_musica are listed only when a voice or music model is on, and they queue kind audio/music', async () => {
  const off = await fakeOffice([M('mmx-voz-2.8-hd', 'audio', false), M('mmx-musica-3', 'music', false), M('nano-banana-2', 'image', true)]);
  try {
    const [l] = await mcp(off.url, [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }]);
    const names = l.result.tools.map(t => t.name);
    assert.ok(names.includes('generar_imagen')); assert.ok(!names.includes('generar_voz')); assert.ok(!names.includes('generar_musica'));
  } finally { off.srv.close(); }
  const o = await fakeOffice([M('mmx-voz-2.8-hd', 'audio', true), M('mmx-musica-3', 'music', true)]);
  try {
    const [l, v, m] = await mcp(o.url, [{ jsonrpc: '2.0', id: 1, method: 'tools/list' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'generar_voz', arguments: { texto: 'Bienvenidos a PanaClaw.', voz: 'AbrinayVoz01' } } },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'generar_musica', arguments: { letra: '[Verse]\nHola', descripcion: 'salsa alegre' } } }]);
    const tools = Object.fromEntries(l.result.tools.map(t => [t.name, t]));
    assert.ok(tools.generar_voz && tools.generar_musica);
    assert.match(tools.generar_voz.inputSchema.properties.voz.description, /AbrinayVoz01 \(Abrinay\)/);
    assert.match(v.result.content[0].text, /\[🔊 2026-09-30 voz 101010\.mp3\]\(\/media\/2026-09\/2026-09-30%20voz%20101010\.mp3\)/);
    assert.deepEqual([o.posted[0].kind, o.posted[0].prompt, o.posted[0].settings], ['audio', 'Bienvenidos a PanaClaw.', { voiceId: 'AbrinayVoz01' }]);
    assert.deepEqual([o.posted[1].kind, o.posted[1].prompt, o.posted[1].settings], ['music', '[Verse]\nHola', { instrumental: false, style: 'salsa alegre' }]);
    assert.equal(o.posted[0].by, 'agent');
  } finally { o.srv.close(); }
});
