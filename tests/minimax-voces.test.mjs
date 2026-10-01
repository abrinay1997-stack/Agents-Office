// V4.10 — the owner's MiniMax voices (minimax-voices.mjs) and their routes (/api/voces/*). Run: npm test
// MiniMax is the local stand-in (tests/minimax-stand.mjs) through MINIMAX_API_BASE; the office runs from serve.mjs in a sandbox
// (its own data/, brain and port). No real key, no call to api.minimax.io.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as voces from '../minimax-voices.mjs';
import { standIn, env, KEY, BIG_FILE_ID, mp3 } from './minimax-stand.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-voces-'));
const on = base => env({ MINIMAX_API_KEY: KEY, MINIMAX_API_BASE: base, MINIMAX_GROUP_ID: undefined });

test('design: a voice from a description → its preview (decoded HEX), pinned with a short TTS, kept in data/minimax-voices.json', async () => {
  const st = await standIn(); const restore = on(st.base); const dir = tmp();
  try {
    voces.configureVoices(dir);
    const r = await voces.design({ name: 'Voz de PanaClaw', prompt: 'Mujer de 30 años, cálida, acento panameño, ritmo tranquilo', previewText: 'Hola, soy PanaClaw.' });
    assert.equal(r.voice.voiceId, 'ttv-voice-2026093012-abcd'); assert.equal(r.voice.kind, 'design'); assert.equal(r.voice.pinned, true);
    assert.deepEqual(r.preview, mp3);
    const d = st.seen.find(x => x.path === '/v1/voice_design');
    assert.deepEqual(d.body, { prompt: 'Mujer de 30 años, cálida, acento panameño, ritmo tranquilo', preview_text: 'Hola, soy PanaClaw.' });
    const pin = st.seen.find(x => x.path === '/v1/t2a_v2');
    assert.equal(pin.body.voice_setting.voice_id, 'ttv-voice-2026093012-abcd', 'the pin is a real synthesis with the new voice');
    const file = JSON.parse(fs.readFileSync(path.join(dir, 'minimax-voices.json'), 'utf8'));
    assert.equal(file.voices.length, 1); assert.equal(file.voices[0].name, 'Voz de PanaClaw');
    await assert.rejects(voces.design({ prompt: '  ' }), /describe la voz/);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('clone: upload (purpose voice_clone) → clone with the int64 file_id written back exactly → pin; then delete in MiniMax and in the register', async () => {
  const st = await standIn(); const restore = on(st.base); const dir = tmp();
  try {
    voces.configureVoices(dir);
    const { voice } = await voces.clone({ name: 'Abrinay', voiceId: 'AbrinayVoz01', audio: mp3, filename: 'muestra.mp3' });
    assert.equal(voice.voiceId, 'AbrinayVoz01'); assert.equal(voice.kind, 'clone'); assert.equal(voice.pinned, true); assert.equal(voice.demoAudio, 'https://example.invalid/demo.mp3');
    const up = st.seen.find(x => x.path === '/v1/files/upload');
    assert.match(up.type, /multipart\/form-data/); assert.match(up.raw, /name="purpose"\r\n\r\nvoice_clone/);
    const c = st.seen.find(x => x.path === '/v1/voice_clone');
    assert.match(c.raw, new RegExp(`"file_id":${BIG_FILE_ID}[,}]`), 'the int64 goes back unchanged, as a number');
    assert.equal(c.body.voice_id, 'AbrinayVoz01'); assert.equal(c.body.model, 'speech-2.8-hd'); assert.ok(c.body.text);
    assert.ok(st.seen.some(x => x.path === '/v1/t2a_v2' && x.body.voice_setting.voice_id === 'AbrinayVoz01'));
    assert.deepEqual(voces.list().map(v => v.voiceId), ['AbrinayVoz01']);
    await assert.rejects(voces.clone({ voiceId: 'AbrinayVoz01', audio: mp3 }), /ya tienes una voz con ese voiceId/);
    await assert.rejects(voces.clone({ voiceId: 'corto', audio: mp3 }), /de 8 a 256 caracteres/);
    await assert.rejects(voces.clone({ voiceId: 'OtraVoz0001', audio: mp3, filename: 'x.ogg' }), /mp3, m4a o wav/);
    const r = await voces.remove('AbrinayVoz01');
    assert.deepEqual(r, { ok: true, remote: true });
    assert.deepEqual(st.seen.find(x => x.path === '/v1/delete_voice').body, { voice_type: 'voice_cloning', voice_id: 'AbrinayVoz01' });
    assert.deepEqual(voces.list(), []); assert.equal(await voces.remove('AbrinayVoz01'), null);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('clone refused by MiniMax (2038, account not verified): the reason in words, nothing written', async () => {
  const st = await standIn({ fail: { '/v1/voice_clone': [2038, 'no cloning permission'] } }); const restore = on(st.base); const dir = tmp();
  try {
    voces.configureVoices(dir);
    await assert.rejects(voces.clone({ voiceId: 'SinPermiso01', audio: mp3 }), /no tiene permiso para clonar voces: verifica la cuenta/);
    assert.equal(fs.existsSync(path.join(dir, 'minimax-voices.json')), false);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('system voices: from get_voice (cached), or the curated list when MiniMax does not answer', async () => {
  const dir = tmp(); let restore = env({ MINIMAX_API_KEY: KEY, MINIMAX_API_BASE: 'http://127.0.0.1:9' }); // nothing listens there
  try {
    voces.configureVoices(dir);
    const fallback = await voces.systemVoices();
    assert.ok(fallback.some(v => v.voiceId === 'Spanish_Narrator')); assert.equal(fallback, voces.SYSTEM);
  } finally { restore(); }
  const st = await standIn(); restore = on(st.base);
  try {
    voces.configureVoices(dir);
    const l = await voces.systemVoices();
    assert.deepEqual(l.map(v => v.voiceId), ['Spanish_Narrator', 'English_radiant_girl']); assert.equal(l[0].lang, 'es');
    await voces.systemVoices(); assert.equal(st.seen.filter(x => x.path === '/v1/get_voice').length, 1, 'cached');
    assert.deepEqual(st.seen[0].body, { voice_type: 'system' });
    assert.equal(voces.summary().system, l);
  } finally { restore(); await st.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

/* ---------- the routes, through the real server ---------- */
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
async function office(extraEnv, local = null) {
  const sandbox = tmp(), port = await freePort();
  if (local) fs.writeFileSync(path.join(sandbox, 'office.config.local.json'), JSON.stringify(local));
  fs.mkdirSync(path.join(sandbox, 'brain'), { recursive: true }); fs.writeFileSync(path.join(sandbox, 'brain', 'inicio.md'), '# Inicio\n');
  const e = { ...process.env, PORT: String(port), AO_DATA: path.join(sandbox, 'data'), AO_BRAIN: path.join(sandbox, 'brain'), AO_LOCAL_CONFIG: path.join(sandbox, 'office.config.local.json'),
    AO_HOOK_TOKEN: 'h'.repeat(28), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', MINIMAX_GROUP_ID: '', ...extraEnv };
  for (const [k, v] of Object.entries(e)) if (v === undefined) delete e[k];
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env: e, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const call = async (method, p, b) => { const r = await fetch(base + p, { method, headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); const text = await r.text(); return { status: r.status, text, j: JSON.parse(text || 'null') }; };
  return { call, sandbox, log: () => log, stop: async () => { srv.kill(); await new Promise(r => srv.once('exit', r)); fs.rmSync(sandbox, { recursive: true, force: true }); } };
}

test('routes without MINIMAX_API_KEY: /api/voces answers 409 with how to set the key; /api/media has no voices', async () => {
  const o = await office({ MINIMAX_API_KEY: undefined, MINIMAX_API_BASE: undefined });
  try {
    for (const [m, p, b] of [['GET', '/api/voces'], ['POST', '/api/voces/design', { prompt: 'x' }], ['POST', '/api/voces/clone', {}], ['DELETE', '/api/voces/AbrinayVoz01']]) {
      const r = await o.call(m, p, b);
      assert.equal(r.status, 409, `${m} ${p}: ${r.text} · ${o.log().slice(-300)}`);
      assert.equal(r.j.how, 'setx MINIMAX_API_KEY "tu-key"'); assert.match(r.j.error, /MiniMax no tiene key/);
    }
    const mm = (await o.call('GET', '/api/media')).j;
    assert.equal(mm.voices, undefined); assert.ok(mm.models.some(x => x.id === 'mmx-voz-2.8-hd' && !x.on));
  } finally { await o.stop(); }
});

test('routes with the key: design → clone (a gallery mp3) → list → GET /api/media voices → delete; costs in the ledger; the key never in an answer', async () => {
  const st = await standIn();
  const o = await office({ MINIMAX_API_KEY: KEY, MINIMAX_API_BASE: st.base });
  try {
    const answers = [];
    const c = async (...a) => { const r = await o.call(...a); answers.push(r.text); return r; };
    const d = await c('POST', '/api/voces/design', { name: 'Voz de marca', prompt: 'Hombre joven, enérgico, español neutro', previewText: 'Bienvenidos.' });
    assert.equal(d.status, 200, d.text + ' · ' + o.log().slice(-300));
    assert.equal(d.j.voice.kind, 'design'); assert.equal(Buffer.from(d.j.preview, 'base64').toString('hex'), mp3.toString('hex'));
    const up = await c('POST', '/api/media/upload', { name: 'mi voz.mp3', data: 'data:audio/mpeg;base64,' + mp3.toString('base64') });
    assert.equal(up.status, 200, up.text);
    const cl = await c('POST', '/api/voces/clone', { name: 'Abrinay', voiceId: 'AbrinayVoz01', audio: up.j.item.id });
    assert.equal(cl.status, 200, cl.text); assert.equal(cl.j.voice.voiceId, 'AbrinayVoz01');
    const b64 = await c('POST', '/api/voces/clone', { name: 'Otra', voiceId: 'OtraVoz0001', audioBase64: mp3.toString('base64'), filename: 'otra.wav' });
    assert.equal(b64.status, 200, b64.text);
    const bad = await c('POST', '/api/voces/clone', { voiceId: 'Mala_', audioBase64: mp3.toString('base64') });
    assert.equal(bad.status, 400); assert.match(bad.j.error, /de 8 a 256 caracteres/);
    const l = await c('GET', '/api/voces');
    assert.deepEqual(l.j.voices.map(v => v.voiceId), ['OtraVoz0001', 'AbrinayVoz01', 'ttv-voice-2026093012-abcd']);
    assert.ok(l.j.system.some(v => v.voiceId === 'Spanish_Narrator'));
    const mm = await c('GET', '/api/media');
    assert.equal(mm.j.voices.voices.length, 3); assert.ok(mm.j.voices.system.length);
    assert.equal(mm.j.default.audio, 'mmx-voz-2.8-turbo'); assert.equal(mm.j.default.music, 'mmx-musica-3');
    const del = await c('DELETE', '/api/voces/AbrinayVoz01');
    assert.equal(del.status, 200); assert.equal(del.j.ok, true);
    assert.equal((await c('DELETE', '/api/voces/AbrinayVoz01')).status, 404);
    const ledger = fs.readFileSync(path.join(o.sandbox, 'data', 'costs.jsonl'), 'utf8').trim().split('\n').map(x => JSON.parse(x)).filter(x => x.provider === 'minimax');
    assert.deepEqual(ledger.map(x => [x.kind, x.model, x.source]), [['estudio', 'voice_design', 'estimado'], ['estudio', 'voice_clone', 'estimado'], ['estudio', 'voice_clone', 'estimado']]);
    assert.equal(ledger[1].usd, 1.5); assert.ok(ledger[0].usd >= 3);
    for (const t of answers) assert.ok(!t.includes(KEY), 'the key leaked in an answer');
  } finally { await o.stop(); await st.close(); }
});

test('design and clone respect the Estudio budget (Ajustes → Estudio): refused with 409 before any call to MiniMax, and what they cost counts', async () => {
  const st = await standIn();
  const o = await office({ MINIMAX_API_KEY: KEY, MINIMAX_API_BASE: st.base }, { media: { dailyBudget: 4 } });
  try {
    const b0 = (await o.call('GET', '/api/media')).j.budget;
    assert.equal(b0.dailyBudget, 4, JSON.stringify(b0) + ' · ' + o.log().slice(-300));
    const d = await o.call('POST', '/api/voces/design', { name: 'Voz', prompt: 'Mujer, cálida', previewText: 'Hola.' });
    assert.equal(d.status, 200, d.text);
    const b1 = (await o.call('GET', '/api/media')).j.budget;
    assert.ok(b1.cost >= 3 && b1.costLeftDay <= 1, 'the design counts in the Estudio: ' + JSON.stringify(b1));
    const seen = st.seen.length;
    const again = await o.call('POST', '/api/voces/design', { prompt: 'Otra voz' });
    assert.equal(again.status, 409); assert.match(again.j.error, /presupuesto del día del Estudio/);
    const cl = await o.call('POST', '/api/voces/clone', { voiceId: 'AbrinayVoz01', audioBase64: mp3.toString('base64') });
    assert.equal(cl.status, 409); assert.match(cl.j.error, /presupuesto del día del Estudio/);
    assert.equal(st.seen.length, seen, 'nothing reached MiniMax');
  } finally { await o.stop(); await st.close(); }
});
