// A local stand-in for api.minimax.io (V4.10) — shared by tests/minimax.test.mjs and tests/minimax-voces.test.mjs.
// It answers as MiniMax's documentation says (docs/minimax/api-verificada.md): base_resp on every JSON answer, audio in HEX,
// the video as a task polled by its id, file_id as an int64 too big for a JavaScript number. It records every request.
// Not a test file itself (node --test only runs *.test.mjs). No real key and no call to api.minimax.io, ever.
import http from 'node:http';

export const KEY = 'mmx-prueba-0123456789abcdef'; // a fake key: never a real one
export const BIG_FILE_ID = '123456789012345680123'; // > 2^53: a JavaScript number would change it
export const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 2, 0, 0, 0, 1, 0]), Buffer.alloc(30)]);
export const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.from([4, 0, 0, 0, 0, 0, 0]), Buffer.alloc(64, 0x55)]);
export const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom'), Buffer.alloc(64, 7)]);
const ok = { status_code: 0, status_msg: 'success' };

/** opts.video: the states a task goes through before «succeeded» (default queued → running). opts.fail: { '<path>': [code, msg] } */
export async function standIn(opts = {}) {
  const seen = [], tasks = new Map(); let n = 0;
  const srv = http.createServer((req, res) => {
    const chunks = []; req.on('data', d => chunks.push(d)); req.on('end', () => {
      const raw = Buffer.concat(chunks), u = new URL(req.url, 'http://x'), p = u.pathname;
      const isJson = /json/.test(req.headers['content-type'] || '');
      let body = null; try { body = isJson ? JSON.parse(raw.toString('utf8') || '{}') : null; } catch {}
      seen.push({ method: req.method, path: p, query: u.search, auth: req.headers.authorization, type: req.headers['content-type'] || '', body, raw: raw.toString('utf8').slice(0, 4000) });
      const out = (code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(typeof b === 'string' ? b : JSON.stringify(b)); };
      if (req.headers.authorization !== `Bearer ${KEY}` && !p.startsWith('/files/')) return out(200, { base_resp: { status_code: 2049, status_msg: 'invalid api key' } });
      const f = opts.fail?.[p]; if (f) return out(f[2] || 200, { base_resp: { status_code: f[0], status_msg: f[1] } });
      if (req.method === 'POST' && p === '/v1/image_generation') return out(200, { id: 't1', data: { image_base64: Array.from({ length: body.n || 1 }, () => png.toString('base64')) }, metadata: { success_count: body.n || 1, failed_count: 0 }, base_resp: ok });
      if (req.method === 'POST' && p === '/v2/video_generation') { const id = String(424010985738629 + (++n)); tasks.set(id, { i: 0 }); return out(200, `{"task_id":"${id}"}`); }
      const q = p.match(/^\/v2\/query\/video_generation\/(\d+)$/);
      if (req.method === 'GET' && q) {
        const t = tasks.get(q[1]) || { i: 0 }; tasks.set(q[1], t);
        const steps = opts.video || ['queued', 'running'], st = t.i < steps.length ? steps[t.i] : 'succeeded'; t.i++;
        return out(200, { task: { id: q[1], model: 'MiniMax-H3', status: st, ...(st === 'failed' ? { error: { code: 1027, message: 'output new_sensitive' } } : {}), ...(st === 'succeeded' ? { content: { url: `http://127.0.0.1:${srv.address().port}/files/video-${q[1]}.mp4` } } : {}) } });
      }
      if (req.method === 'DELETE' && /^\/v2\/video_generation\/\d+$/.test(p)) return out(200, { task_id: p.split('/').pop(), action: 'cancelled', status: 'cancelled' });
      if (req.method === 'GET' && p.startsWith('/files/video-')) { res.writeHead(200, { 'content-type': 'video/mp4' }); return res.end(mp4); }
      if (req.method === 'POST' && p === '/v1/t2a_v2') return out(200, { data: { audio: mp3.toString('hex'), status: 2 }, extra_info: { audio_length: 2500, audio_format: body.audio_setting.format, usage_characters: body.text.length }, trace_id: 'x', base_resp: ok });
      if (req.method === 'POST' && p === '/v1/music_generation') return out(200, { data: { audio: mp3.toString('hex'), status: 2 }, extra_info: { music_duration: 61000 }, base_resp: ok });
      if (req.method === 'POST' && p === '/v1/files/upload') return out(200, `{"file":{"file_id":${BIG_FILE_ID},"bytes":${raw.length},"created_at":1700469398,"filename":"muestra.mp3","purpose":"voice_clone"},"base_resp":{"status_code":0,"status_msg":"success"}}`);
      if (req.method === 'POST' && p === '/v1/voice_clone') return out(200, { demo_audio: 'https://example.invalid/demo.mp3', input_sensitive: { type: 0 }, base_resp: ok });
      if (req.method === 'POST' && p === '/v1/voice_design') return out(200, { voice_id: 'ttv-voice-2026093012-abcd', trial_audio: mp3.toString('hex'), base_resp: ok });
      if (req.method === 'POST' && p === '/v1/get_voice') return out(200, { system_voice: [{ voice_id: 'Spanish_Narrator', voice_name: 'Narrador', description: ['voz de narrador'], created_time: '1970-01-01' }, { voice_id: 'English_radiant_girl', voice_name: 'Radiant Girl', description: [] }], base_resp: ok });
      if (req.method === 'POST' && p === '/v1/delete_voice') return out(200, { voice_id: body.voice_id, created_time: '2026-09-30', base_resp: ok });
      out(404, { base_resp: { status_code: 2013, status_msg: 'ruta no simulada: ' + p } });
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, seen, tasks, base: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise(r => srv.close(r)) };
}
/** Sets the env for a test (MINIMAX_API_KEY, MINIMAX_API_BASE…) and gives back a function that restores it. */
export function env(vars) {
  const keep = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  return () => { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
}
