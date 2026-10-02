// Agents Office — el Estudio: los MOTORES (F0 del banco de presets, 1 oct 2026: salió de media.mjs, que es la fachada).
// Hablar con cada servicio: la prueba gratis, Google (Nano Banana y Veo), Grok, OpenAI, Meta, fal.ai, MiniMax y Higgsfield.
// RUN[engine](model, job, ctx) genera y entrega cada archivo con ctx.add(buf, ext); friendly() dice el error en palabras.
import fs from 'node:fs';
import path from 'node:path';
import * as mmx from '../minimax.mjs';
import { S } from './estado.mjs';
import { secret } from './catalogo.mjs';
import { resolve, item, update, MAGIC, AUDIO_EXT } from './galeria.mjs';

const HF_BASE = () => (process.env.HF_API_BASE_URL || 'https://api.higgsfield.ai').replace(/\/$/, '');
// the fal.ai and Google addresses can point at a local stand-in (npm run check tests the queues with no key and no spend)
const FAL_RUN = () => process.env.AO_FAL_RUN || 'https://fal.run', FAL_QUEUE = () => process.env.AO_FAL_QUEUE || 'https://queue.fal.run', GEMINI_BASE = () => process.env.AO_GEMINI_BASE || 'https://generativelanguage.googleapis.com';
const META_BASE = () => (process.env.AO_META_BASE || 'https://api.meta.ai/v1').replace(/\/$/, '');
/* ---------- talking to the engines ---------- */
class EngineError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
async function http(url, opts, what) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 180000) });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = null; }
  if (!r.ok) {
    const d = j && (j.error?.message || (typeof j.error === 'string' && j.error) || (typeof j.detail === 'string' && j.detail) || (Array.isArray(j.detail) && j.detail.map(x => x.msg || x.message).filter(Boolean).join('; ')) || j.message);
    throw new EngineError(`${what}: ${r.status} ${d || text.slice(0, 200)}`, r.status);
  }
  return j;
}
const fromUrl = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(300000) }); if (!r.ok) throw new Error('no pude descargar el resultado: ' + r.status); return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') || '' }; };
const extOf = (mime, url, fallback = 'png') => { const s = (mime || '') + ' ' + (url || '').split('?')[0].slice(-6); return /jpe?g/.test(s) ? 'jpg' : /webp/.test(s) ? 'webp' : /webm/.test(s) ? 'webm' : /mp4|quicktime|\.mov/.test(s) ? 'mp4' : /png/.test(s) ? 'png' : fallback; };
export function friendly(msg, status) { // what the owner reads on the red tile
  const m = String(msg || '');
  if (status === 403 && /Higgsfield/.test(m)) return 'sin créditos en Higgsfield: recarga en cloud.higgsfield.ai (' + m.slice(0, 100) + ')'; // Higgsfield answers 403 for «Not enough credits» (its own client), not for a bad key
  if (status === 401 || status === 403 || /unauthori[sz]ed|invalid (api )?key|forbidden/i.test(m)) return 'la key no es válida o no tiene permiso (' + m.slice(0, 120) + ')';
  if (status === 402 || /insufficient|credits?|balance|quota|billing/i.test(m)) return 'sin saldo o créditos en el servicio (' + m.slice(0, 120) + ')';
  if (status === 429 || /rate.?limit|too many/i.test(m)) return 'el servicio pide esperar un poco (demasiadas peticiones); reintenta en un minuto';
  if (/nsfw|safety|blocked|moderation|policy/i.test(m)) return 'el motor lo bloqueó por su filtro de contenido; cambia el prompt';
  if (/timeout|timed out|aborted/i.test(m)) return 'el servicio no respondió a tiempo; reintenta';
  return m.slice(0, 300);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZE = { '1:1': [1024, 1024], '4:5': [1024, 1280], '3:4': [1024, 1365], '9:16': [1024, 1792], '16:9': [1792, 1024], '4:3': [1365, 1024], '3:2': [1536, 1024], '2:3': [1024, 1536], '21:9': [1792, 768] };

// the media a job uses (gallery ids) → what each engine takes: a data URI (fal), inline base64 (Gemini), a Blob (OpenAI), a public URL (Higgsfield)
function inputFiles(job) {
  const out = { start: [], end: [], reference: [], video: [], audio: [] };
  for (const role of Object.keys(out)) for (const id of (job.media?.[role] || [])) { const p = resolve(id); if (!p) throw new Error(`no encuentro el archivo «${id}» en el Estudio`); const ext = p.split('.').pop().toLowerCase(); out[role].push({ id, p, ext, mime: { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4' }[ext] }); }
  return out;
}
const asDataUri = f => `data:${f.mime};base64,${fs.readFileSync(f.p).toString('base64')}`;
async function hfUpload(f) { // Higgsfield's own storage (files/generate-upload-url → PUT), cached 12 h in the file's record
  const it = item(f.id); if (it?.hf?.url && Date.now() - it.hf.at < 12 * 3600e3) return it.hf.url;
  const up = await http(`${HF_BASE()}/files/generate-upload-url`, { method: 'POST', headers: { authorization: `Key ${secret('higgsfield')}`, 'content-type': 'application/json' }, body: JSON.stringify({ content_type: f.mime }) }, 'Higgsfield (subir)');
  const r = await fetch(up.upload_url, { method: 'PUT', headers: up.upload_headers || { 'content-type': f.mime }, body: fs.readFileSync(f.p), signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error('Higgsfield no aceptó el archivo de referencia: ' + r.status);
  try { update(f.id, { hf: { url: up.public_url, at: Date.now() } }); } catch {}
  return up.public_url;
}

// poll a queue until the engine says it finished. Higgsfield: completed/failed/nsfw/canceled; fal: COMPLETED (then the result)
async function pollUntil(job, check, { every = 4000, deadline = 20 * 60e3 } = {}) {
  const until = (job.pollFrom || job.startedAt || Date.now()) + deadline; let misses = 0; // a resumed job counts from the resume, not from its first start
  for (;;) {
    if (job.cancel) throw new Error('Cancelado por ti.');
    if (Date.now() > until) throw new Error('tardó más de ' + Math.round(deadline / 60e3) + ' minutos; mira en el panel del servicio si terminó');
    await sleep(+process.env.AO_POLL_MS || every);
    try { const r = await check(); misses = 0; if (r) return r; }
    catch (e) { if (e.final || [401, 403, 404].includes(e.status) || ++misses >= 3) throw e; } // Higgsfield: 401/404 are not worth asking again
  }
}
const final = e => Object.assign(e, { final: true });

/* Google Veo on the Gemini API (V4.4, 27 Sep 2026), as Google's own SDK sends it (googleapis/js-genai, _models_converters.ts):
   POST v1beta/models/<id>:predictLongRunning { instances: [{ prompt, image?, lastFrame?, referenceImages? }], parameters:
   { aspectRatio, resolution, durationSeconds } } → an operation; GET v1beta/<operation> until done →
   response.generateVideoResponse.generatedSamples[].video.uri, downloaded with the same key. Images go as { bytesBase64Encoded, mimeType }. */
export function veoRequest(m, job, files) {
  const img = f => ({ bytesBase64Encoded: fs.readFileSync(f.p).toString('base64'), mimeType: f.mime });
  const inst = { prompt: job.prompt }, refs = (files.reference || []).slice(0, m.roles.reference || 0);
  if (files.start?.[0]) inst.image = img(files.start[0]);
  if (files.end?.[0] && files.start?.[0]) inst.lastFrame = img(files.end[0]); // a last frame only goes with a first one
  if (refs.length && !inst.image) inst.referenceImages = refs.map(f => ({ image: img(f), referenceType: 'asset' }));
  const p = { aspectRatio: job.s.aspectRatio || '16:9', resolution: job.s.resolution || '720p', durationSeconds: Number(job.s.duration) || 8 };
  if (inst.referenceImages) Object.assign(p, { aspectRatio: '16:9', resolution: '720p' }); // references: 720p landscape only
  if (p.resolution === '1080p') p.durationSeconds = 8; // 1080p comes in 8 s
  return { instances: [inst], parameters: p };
}
async function veo(m, job, ctx) {
  const key = secret('gemini'), base = GEMINI_BASE(), head = { 'content-type': 'application/json', 'x-goog-api-key': key };
  if (!job.remote?.length) {
    const body = veoRequest(m, job, inputFiles(job)); job.remote = [];
    for (let i = 0; i < job.n; i++) {
      job.note = 'enviando a Google';
      const op = await http(`${base}/v1beta/models/${encodeURIComponent(m.gid)}:predictLongRunning`, { method: 'POST', headers: head, body: JSON.stringify(body) }, m.name);
      if (!op?.name) throw new Error(`${m.name}: Google no devolvió el número de la operación`);
      job.remote.push({ id: op.name }); ctx.save();
    }
  }
  for (const rq of job.remote) {
    if (rq.done) continue;
    const op = await pollUntil(job, async () => {
      const o = await http(`${base}/v1beta/${rq.id.split('/').map(encodeURIComponent).join('/')}`, { headers: head }, m.name);
      job.note = o.done ? 'descargando' : 'generando';
      if (o.error) throw final(new Error(`${m.name}: ${o.error.message || JSON.stringify(o.error).slice(0, 200)}`));
      return o.done ? o : null;
    }, { every: 8000, deadline: 15 * 60e3 });
    const res = op.response?.generateVideoResponse || op.response || {};
    const vids = (res.generatedSamples || res.generatedVideos || []).map(x => x.video).filter(Boolean);
    if (!vids.length) throw final(new Error(`${m.name} no devolvió video${res.raiMediaFilteredReasons?.length ? ': ' + res.raiMediaFilteredReasons.join(' ') : res.raiMediaFilteredCount ? ' (lo bloqueó el filtro de contenido de Google; cambia el prompt)' : ''}`));
    rq.got = rq.got || [];
    for (const v of vids) {
      const u = v.uri; if (u && rq.got.includes(u)) continue;
      let buf;
      if (v.videoBytes || v.bytesBase64Encoded) buf = Buffer.from(v.videoBytes || v.bytesBase64Encoded, 'base64');
      else { const r = await fetch(u, { headers: { 'x-goog-api-key': key }, redirect: 'follow', signal: AbortSignal.timeout(300000) }); if (!r.ok) throw new Error(`no pude descargar el video de Google: ${r.status}`); buf = Buffer.from(await r.arrayBuffer()); }
      ctx.add(buf, 'mp4'); if (u) rq.got.push(u); ctx.save();
    }
    rq.done = true; ctx.save();
  }
}

export const RUN = {
  async prueba(m, job, ctx) { // an SVG card: proves the pipeline for free (a video becomes a card too)
    const [w, h] = SIZE[job.s.aspectRatio] || SIZE['1:1'];
    const count = Object.entries(job.media || {}).filter(([, v]) => v?.length).map(([k, v]) => `${v.length} ${{ start: 'inicial', end: 'final', reference: 'ref.', video: 'video', audio: 'audio' }[k]}`).join(' · ');
    for (let i = 0; i < job.n; i++) {
      if (job.cancel) throw new Error('Cancelado por ti.');
      const text = (m.kind === 'video' ? '🎬 ' : '') + job.prompt + (job.n > 1 ? ` (${i + 1}/${job.n})` : '');
      const hue = [...text].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
      const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const lines = []; let cur = '';
      for (const wd of esc(text).split(/\s+/)) { if ((cur + ' ' + wd).length > 28) { lines.push(cur); cur = wd; } else cur = (cur ? cur + ' ' : '') + wd; } if (cur) lines.push(cur);
      const secs = Math.max(1, Number(job.s.duration) || 5), anim = m.kind === 'video' // V4.2 (audit A30): a test «video» is an animated card (a playhead, a moving light) — no encoder here to make an .mp4
        ? `<circle r="${w / 5}" cy="${h / 2}" fill="#fff" opacity=".12"><animate attributeName="cx" values="${-w / 5};${w * 1.2}" dur="${secs}s" repeatCount="indefinite"/></circle><rect x="0" y="${h - h / 40}" height="${h / 40}" fill="#fff" opacity=".85"><animate attributeName="width" values="0;${w}" dur="${secs}s" repeatCount="indefinite"/></rect><text x="96%" y="${h - h / 20}" fill="#fff" opacity=".8" font-family="Georgia,serif" font-size="${w / 34}" text-anchor="end">muestra animada · ${secs} s</text>` : '';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,22%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},80%,45%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="12%" fill="#fff" opacity=".6" font-family="Georgia,serif" font-size="${w / 22}" text-anchor="middle">PRUEBA · ${m.kind === 'video' ? 'VIDEO' : 'ESTUDIO'}</text>${lines.slice(0, 8).map((l, k) => `<text x="50%" y="${34 + k * 8}%" fill="#fff" font-family="Georgia,serif" font-size="${w / 17}" text-anchor="middle">${l}</text>`).join('')}${count ? `<text x="50%" y="92%" fill="#fff" opacity=".7" font-family="Georgia,serif" font-size="${w / 30}" text-anchor="middle">con ${esc(count)}</text>` : ''}${anim}</svg>`;
      ctx.add(Buffer.from(svg), 'svg', m.kind === 'video' ? { wanted: 'video' } : {});
    }
  },
  async gemini(m, job, ctx) { // Nano Banana: generateContent returns the image inline; the references go in as inline images
    if (m.kind === 'video') return veo(m, job, ctx);
    const refs = inputFiles(job).reference.map(f => ({ inlineData: { mimeType: f.mime, data: fs.readFileSync(f.p).toString('base64') } }));
    for (let i = 0; i < job.n; i++) {
      if (job.cancel) throw new Error('Cancelado por ti.');
      const j = await http(`${GEMINI_BASE()}/v1beta/models/${encodeURIComponent(m.gid || S.cfg.models.gemini)}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': secret('gemini') },
        body: JSON.stringify({ contents: [{ parts: [{ text: job.prompt }, ...refs] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: job.s.aspectRatio, ...(job.s.imageSize ? { imageSize: job.s.imageSize } : {}) } } }),
      }, m.name);
      const parts = (j.candidates || []).flatMap(c => c.content?.parts || []).filter(p => p.inlineData || p.inline_data);
      if (!parts.length) throw new Error('Nano Banana no devolvió imagen' + (j.promptFeedback?.blockReason ? ` (bloqueado: ${j.promptFeedback.blockReason})` : (j.candidates?.[0]?.finishReason ? ` (${j.candidates[0].finishReason})` : '')));
      for (const p of parts) { const d = p.inlineData || p.inline_data; ctx.add(Buffer.from(d.data, 'base64'), extOf(d.mimeType || d.mime_type)); }
    }
  },
  async grok(m, job, ctx) {
    const j = await http('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret('grok')}` }, body: JSON.stringify({ model: S.cfg.models.grok, prompt: job.prompt, n: job.n, response_format: 'b64_json' }) }, 'Grok');
    for (const d of j.data || []) ctx.add(Buffer.from(d.b64_json, 'base64'), 'jpg');
  },
  async openai(m, job, ctx) { // with references: /images/edits (multipart); without: /images/generations
    const size = { '1:1': '1024x1024', '3:2': '1536x1024', '2:3': '1024x1536' }[job.s.aspectRatio] || '1024x1024';
    const refs = inputFiles(job).reference, auth = { authorization: `Bearer ${secret('openai')}` };
    let j;
    if (refs.length) {
      const fd = new FormData(); fd.append('model', S.cfg.models.openai); fd.append('prompt', job.prompt); fd.append('n', String(job.n)); fd.append('size', size); fd.append('quality', job.s.quality);
      for (const f of refs) fd.append('image[]', new Blob([fs.readFileSync(f.p)], { type: f.mime }), path.basename(f.p));
      j = await http('https://api.openai.com/v1/images/edits', { method: 'POST', headers: auth, body: fd, timeout: 300000 }, 'OpenAI');
    } else j = await http('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ model: S.cfg.models.openai, prompt: job.prompt, n: job.n, size, quality: job.s.quality }), timeout: 300000 }, 'OpenAI');
    for (const d of j.data || []) { if (d.b64_json) ctx.add(Buffer.from(d.b64_json, 'base64'), 'png'); else { const r = await fromUrl(d.url); ctx.add(r.buf, extOf(r.mime, d.url)); } }
  },
  async meta(m, job, ctx) { // Muse Image (OpenAI-compatible): no references → /images/generations; with them → /images/edits with Meta's own JSON body (images: [{ image_url }]), no multipart
    const auth = { authorization: `Bearer ${secret('meta')}`, 'content-type': 'application/json' };
    const [w, h] = SIZE[job.s.aspectRatio] || SIZE['1:1'], fmt = job.s.outputFormat || 'webp'; // "WxH": Meta keeps the ratio, not the exact size
    const refs = inputFiles(job).reference;
    const base = { model: m.gid || S.cfg.models.meta, prompt: job.prompt, n: job.n, size: `${w}x${h}`, output_format: fmt, response_format: 'b64_json', ...(job.s.quality ? { reasoning_strength: job.s.quality } : {}) };
    const j = refs.length
      ? await http(`${META_BASE()}/images/edits`, { method: 'POST', headers: auth, body: JSON.stringify({ ...base, images: refs.map(f => ({ image_url: asDataUri(f) })) }), timeout: 300000 }, 'Meta')
      : await http(`${META_BASE()}/images/generations`, { method: 'POST', headers: auth, body: JSON.stringify(base), timeout: 300000 }, 'Meta');
    const out = j.output_format || fmt, ext = out === 'jpeg' ? 'jpg' : out;
    if (!(j.data || []).length) throw new Error('Muse Image no devolvió imagen');
    for (const d of j.data) { if (d.b64_json) ctx.add(Buffer.from(d.b64_json, 'base64'), ext); else if (d.url) { const r = await fromUrl(d.url); ctx.add(r.buf, extOf(r.mime, d.url, ext)); } }
  },
  async fal(m, job, ctx) {
    const f = inputFiles(job), auth = { authorization: `Key ${secret('fal')}`, 'content-type': 'application/json' };
    const urls = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.map(asDataUri)]));
    if (m.kind === 'image') {
      const { path: p, body } = m.fal({ prompt: job.prompt, n: job.n, s: job.s, m: urls });
      const j = await http(`${FAL_RUN()}/${p}`, { method: 'POST', headers: auth, body: JSON.stringify(body), timeout: 300000 }, 'fal.ai');
      for (const im of j.images || []) { const r = await fromUrl(im.url); ctx.add(r.buf, extOf(im.content_type || r.mime, im.url)); }
      return;
    }
    // video: one queued request per variant; the ids are kept in the job so a restart picks the poll up again
    if (!job.remote?.length) {
      job.remote = [];
      for (let i = 0; i < job.n; i++) {
        const { path: p, body } = m.fal({ prompt: job.prompt, n: 1, s: job.s, m: urls });
        const sub = await http(`${FAL_QUEUE()}/${p}`, { method: 'POST', headers: auth, body: JSON.stringify(body) }, 'fal.ai video');
        const base = `${FAL_QUEUE()}/${p.split('/').slice(0, 2).join('/')}/requests/${sub.request_id}`;
        job.remote.push({ id: sub.request_id, status: sub.status_url || base + '/status', result: sub.response_url || base, cancel: sub.cancel_url || base + '/cancel' }); ctx.save();
      }
    }
    for (const rq of job.remote) {
      if (rq.done) continue;
      await pollUntil(job, async () => { const st = await http(rq.status, { headers: auth }, 'fal.ai video'); job.note = st.status === 'IN_QUEUE' ? `en cola${st.queue_position != null ? ' (' + st.queue_position + ' delante)' : ''}` : 'generando'; if (st.status === 'COMPLETED') return true; if (st.status === 'FAILED' || st.status === 'ERROR') throw final(new Error('el video falló en fal.ai')); return false; }, { every: 5000 });
      let out; try { out = await http(rq.result, { headers: auth }, 'fal.ai video'); } catch (e) { throw final(e); }
      const url = out.video?.url || out.videos?.[0]?.url; if (!url) throw new Error('fal.ai no devolvió el video');
      job.note = 'descargando'; const r = await fromUrl(url); ctx.add(r.buf, extOf(r.mime, url, 'mp4')); rq.done = true; ctx.save();
    }
  },
  async minimax(m, job, ctx) { // V4.10: MiniMax direct (minimax.mjs). Image, voice and music answer at once; a video is a task polled by its id
    const s = job.s;
    if (m.kind === 'image') { // image-01: the reference is ONE face (subject_reference), JPG or PNG
      const [ref] = inputFiles(job).reference;
      if (ref && !['png', 'jpg', 'jpeg'].includes(ref.ext)) throw final(new Error('MiniMax Image-01 toma la cara de referencia en JPG o PNG (no WEBP): sube la foto en uno de esos formatos'));
      const bufs = await mmx.image({ prompt: job.prompt, model: m.gid, aspectRatio: s.aspectRatio, n: job.n, promptOptimizer: !!s.promptOptimizer, subjectRef: ref ? asDataUri(ref) : null });
      for (const b of bufs) ctx.add(b, MAGIC.png(b) ? 'png' : MAGIC.webp(b) ? 'webp' : 'jpg');
      return;
    }
    if (m.kind === 'audio' || m.kind === 'music') { // the audio comes back in HEX, already decoded by the client; one call per variant
      for (let i = 0; i < job.n; i++) {
        if (job.cancel) throw new Error('Cancelado por ti.');
        job.note = m.kind === 'music' ? 'componiendo' : 'grabando la voz'; ctx.save();
        const r = m.kind === 'audio'
          ? await mmx.tts({ text: job.prompt, model: m.gid, voiceId: s.voiceId, speed: s.speed, vol: s.vol, pitch: s.pitch, emotion: s.emotion || null, languageBoost: s.languageBoost, format: s.format })
          : await mmx.music({ model: m.gid, instrumental: !!s.instrumental, format: s.format, ...(s.instrumental ? { prompt: [job.prompt, s.style].filter(Boolean).join('. ') } : { lyrics: job.prompt, prompt: s.style || '' }) });
        if (!r.buf.length) throw new Error(`${m.name} devolvió un audio vacío`);
        ctx.add(r.buf, AUDIO_EXT.includes(r.ext) ? r.ext : 'mp3', { ...(m.kind === 'music' ? { wanted: 'music' } : { voiceId: s.voiceId }), ...(r.seconds ? { seconds: r.seconds } : {}) });
      }
      return;
    }
    // video: one task per variant; its id is kept in the job (job.remote) so a restart of the office picks the poll up again
    if (!job.remote?.length) {
      const f = inputFiles(job), content = mmx.videoContent({ prompt: job.prompt, start: f.start[0] ? asDataUri(f.start[0]) : null, end: f.end[0] ? asDataUri(f.end[0]) : null, references: f.reference.map(asDataUri), videos: f.video.map(asDataUri) });
      job.remote = [];
      for (let i = 0; i < job.n; i++) {
        job.note = 'enviando a MiniMax';
        let id;
        try { id = await mmx.createVideo({ model: m.gid, content, resolution: s.resolution, duration: s.duration, ratio: s.aspectRatio, promptExpansion: s.promptExpansion || null }); }
        catch (e) { // the tasks already created are paid for at MiniMax: they are still polled and downloaded; the job only fails when none was created
          if (!job.remote.length) throw e;
          job.warning = `se hicieron ${job.remote.length} de ${job.n}: ${friendly(e.message, e.status)}`; ctx.save(); break;
        }
        job.remote.push({ id }); ctx.save();
      }
    }
    for (const rq of job.remote) {
      if (rq.done) continue;
      const q = await pollUntil(job, async () => {
        const r = await mmx.queryVideo(rq.id);
        job.note = r.state === 'queued' ? 'en cola' : r.state === 'running' ? 'generando' : r.state === 'succeeded' ? 'descargando' : r.state;
        if (r.state === 'failed') throw final(new Error(`${m.name}: ${r.error || 'el video falló en MiniMax'}`));
        if (r.state === 'cancelled') throw final(new Error(`${m.name}: la tarea se canceló en MiniMax`));
        return r.state === 'succeeded' ? r : null;
      }, { every: 6000, deadline: 30 * 60e3 });
      if (!q.url) throw final(new Error(`${m.name} terminó sin enlace al video`));
      const r = await fromUrl(q.url); // the link expires: the file is saved at once
      ctx.add(r.buf, 'mp4'); rq.done = true; ctx.save();
    }
  },
  async higgsfield(m, job, ctx) { // submit → request_id → GET /requests/{id}/status until completed (images[].url · video.url)
    const auth = { authorization: `Key ${secret('higgsfield')}`, 'content-type': 'application/json' };
    if (!job.remote?.length) {
      const f = inputFiles(job), urls = {};
      for (const [role, list] of Object.entries(f)) { urls[role] = []; for (const x of list) { job.note = 'subiendo referencias'; urls[role].push(await hfUpload(x)); } }
      job.remote = [];
      for (let i = 0; i < job.n; i++) {
        const { path: p, body } = m.hf({ prompt: job.prompt, s: job.s, m: urls });
        if (!/^[a-z0-9][a-z0-9._/-]*$/i.test(p) || p.includes('..')) throw new Error('ruta de modelo inválida');
        const sub = await http(`${HF_BASE()}/${p}`, { method: 'POST', headers: auth, body: JSON.stringify(body) }, 'Higgsfield');
        if (!sub?.request_id) throw new Error('Higgsfield no devolvió el número de pedido');
        job.remote.push({ id: sub.request_id, status: sub.status_url || `${HF_BASE()}/requests/${encodeURIComponent(sub.request_id)}/status`, cancel: sub.cancel_url || `${HF_BASE()}/requests/${encodeURIComponent(sub.request_id)}/cancel` }); ctx.save();
      }
    }
    for (const rq of job.remote) {
      if (rq.done) continue;
      const st = await pollUntil(job, async () => {
        const s = await http(rq.status, { headers: auth }, 'Higgsfield');
        job.note = s.status === 'queued' ? 'en cola' : s.status === 'in_progress' ? 'generando' : s.status;
        if (s.status === 'completed') return s;
        if (s.status === 'nsfw') throw final(new Error('Higgsfield lo bloqueó por contenido (NSFW); cambia el prompt'));
        if (s.status === 'failed' || s.status === 'canceled') throw final(new Error('Higgsfield: ' + (typeof s.error === 'string' ? s.error : s.error ? JSON.stringify(s.error).slice(0, 200) : s.status)));
        return null;
      });
      const outs = [...(st.images || []).map(x => x.url), ...(st.video?.url ? [st.video.url] : []), ...((st.videos || []).map(x => x.url))].filter(Boolean);
      if (!outs.length) throw new Error('Higgsfield terminó sin archivo');
      job.note = 'descargando';
      rq.got = rq.got || []; // files already saved from this request: a restart mid-download never saves one twice
      for (const u of outs) { if (rq.got.includes(u)) continue; const r = await fromUrl(u); ctx.add(r.buf, extOf(r.mime, u, m.kind === 'video' ? 'mp4' : 'png')); rq.got.push(u); ctx.save(); }
      rq.done = true; ctx.save();
    }
  },
};
