// Agents Office — the ESTUDIO: images and video the agents (and the owner) generate for real.
//
// Providers are adapters behind one call. A provider is ON when its key is in the environment (set it once in Windows,
// like the Meta key: `setx GEMINI_API_KEY "…"`), so no key ever lives in a file of this repo:
//   gemini  — Google «Nano Banana» (gemini-2.5-flash-image)        GEMINI_API_KEY
//   grok    — xAI Grok image                                         XAI_API_KEY
//   openai  — OpenAI gpt-image-1                                     OPENAI_API_KEY
//   fal     — fal.ai: Flux, Recraft, Ideogram… and VIDEO (Kling, Seedance, MiniMax, Wan, LTX — the models open-higgsfield uses)   FAL_KEY
//   prueba  — a free local test image (an SVG card with the prompt): the whole pipeline without spending anything
// Model ids can be changed in office.config.json → "media": { "models": { "gemini": "…", "fal": "…", "falVideo": "…" } }.
//
// Every file goes to <brain>/Agents Office/media/YYYY-MM/<name>.<ext> with <name>.json beside it (prompt, provider,
// model, cost estimate, who asked, task). Budget: office.config.json → "media": { "dailyLimit": 40, "maxPerRequest": 8 }.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash-image',
  grok: 'grok-2-image',
  openai: 'gpt-image-1',
  fal: 'fal-ai/flux/schnell',
  falVideo: 'fal-ai/kling-video/v2.1/standard/text-to-video',
};
// rough cost per image / per video in USD, only to warn before a batch (the providers' own bill is the truth)
const COST = { gemini: 0.039, grok: 0.07, openai: 0.04, fal: 0.003, falVideo: 0.3, prueba: 0 };
const KEYS = { gemini: 'GEMINI_API_KEY', grok: 'XAI_API_KEY', openai: 'OPENAI_API_KEY', fal: 'FAL_KEY' };
export const NAMES = { gemini: 'Nano Banana (Google)', grok: 'Grok (xAI)', openai: 'OpenAI', fal: 'fal.ai', prueba: 'Prueba (gratis)' };

let cfg = { dailyLimit: 40, maxPerRequest: 8, models: {} }, root = '', usageFile = '';
export function configure(officeCfg, brainPath, dataDir) {
  cfg = { dailyLimit: 40, maxPerRequest: 8, ...(officeCfg.media || {}), models: { ...DEFAULT_MODELS, ...((officeCfg.media || {}).models || {}) } };
  root = path.join(brainPath, 'Agents Office', 'media');
  usageFile = path.join(dataDir, 'media-usage.json');
}
export const dir = () => root;
const key = p => process.env[KEYS[p]] || '';
export function providers() {
  return ['gemini', 'grok', 'openai', 'fal', 'prueba'].map(id => ({ id, name: NAMES[id], on: id === 'prueba' || !!key(id), env: KEYS[id] || null, model: id === 'prueba' ? 'local' : cfg.models[id], video: id === 'fal' ? cfg.models.falVideo : null, cost: COST[id] }));
}
export const defaultProvider = () => (providers().find(p => p.on && p.id !== 'prueba') || { id: 'prueba' }).id;

/* ---------- budget: a count per day, kept in data/ ---------- */
const today = () => new Date().toISOString().slice(0, 10);
function usage() { try { const u = JSON.parse(fs.readFileSync(usageFile, 'utf8')); return u.day === today() ? u : { day: today(), images: 0, videos: 0, cost: 0 }; } catch { return { day: today(), images: 0, videos: 0, cost: 0 }; } }
function spend(kind, n, cost) { const u = usage(); u[kind] += n; u.cost = +(u.cost + cost).toFixed(3); fs.mkdirSync(path.dirname(usageFile), { recursive: true }); fs.writeFileSync(usageFile, JSON.stringify(u)); return u; }
export function budget() { const u = usage(); return { ...u, limit: cfg.dailyLimit, left: Math.max(0, cfg.dailyLimit - u.images - u.videos * 5), maxPerRequest: cfg.maxPerRequest }; }

/* ---------- storage ---------- */
const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'imagen';
function store(buf, ext, meta) {
  const d = new Date(), sub = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const folder = path.join(root, sub); fs.mkdirSync(folder, { recursive: true });
  let base = `${sub}-${String(d.getDate()).padStart(2, '0')} ${slug(meta.prompt)}`, name = base;
  for (let n = 2; fs.existsSync(path.join(folder, name + '.' + ext)); n++) name = `${base}-${n}`;
  fs.writeFileSync(path.join(folder, name + '.' + ext), buf);
  const rel = `${sub}/${name}.${ext}`;
  const item = { id: rel, file: rel, kind: ext === 'mp4' || ext === 'webm' ? 'video' : 'image', ext, at: Date.now(), ...meta };
  fs.writeFileSync(path.join(folder, name + '.json'), JSON.stringify(item, null, 2));
  return item;
}
/** Everything in the studio, newest first (reads the .json sidecars). */
export function list({ limit = 400 } = {}) {
  const out = [];
  if (!root || !fs.existsSync(root)) return out;
  for (const sub of fs.readdirSync(root).filter(x => /^\d{4}-\d{2}$/.test(x)).sort().reverse()) {
    for (const f of fs.readdirSync(path.join(root, sub)).filter(x => x.endsWith('.json'))) {
      try { const it = JSON.parse(fs.readFileSync(path.join(root, sub, f), 'utf8')); if (fs.existsSync(path.join(root, it.file))) out.push(it); } catch {}
    }
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}
/** A path inside the studio, or null (never outside it: the id comes from the request). */
export function resolve(id) {
  const rel = String(id || '').replace(/\\/g, '/');
  if (!/^\d{4}-\d{2}\/[^/]+\.(png|jpe?g|webp|svg|mp4|webm)$/i.test(rel) || rel.includes('..')) return null;
  const p = path.join(root, rel); return fs.existsSync(p) ? p : null;
}
export function update(id, patch) { const p = resolve(id); if (!p) return null; const j = p.replace(/\.[^.]+$/, '.json'); const it = JSON.parse(fs.readFileSync(j, 'utf8')); Object.assign(it, patch); fs.writeFileSync(j, JSON.stringify(it, null, 2)); return it; }
export function trash(id) { // to <media>/.papelera — reversible by hand
  const p = resolve(id); if (!p) return false;
  const bin = path.join(root, '.papelera'); fs.mkdirSync(bin, { recursive: true });
  const stamp = Date.now();
  for (const f of [p, p.replace(/\.[^.]+$/, '.json')]) if (fs.existsSync(f)) fs.renameSync(f, path.join(bin, `${stamp}-${path.basename(f)}`));
  return true;
}

/* ---------- providers ---------- */
const ratioSize = { '1:1': [1024, 1024], '4:5': [1024, 1280], '9:16': [1024, 1792], '16:9': [1792, 1024], '3:4': [1024, 1365] };
async function http(url, opts, what) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 180000) });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = null; }
  if (!r.ok) throw new Error(`${what}: ${r.status} ${(j && (j.error?.message || j.error || j.detail || j.message)) || text.slice(0, 200)}`);
  return j;
}
const fromUrl = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('no pude descargar el resultado: ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const extOf = (mime, fallback = 'png') => /jpeg|jpg/.test(mime || '') ? 'jpg' : /webp/.test(mime || '') ? 'webp' : /mp4/.test(mime || '') ? 'mp4' : fallback;

const ADAPTERS = {
  async prueba({ prompt, ratio }) { // an SVG card: proves the pipeline for free
    const [w, h] = ratioSize[ratio] || ratioSize['1:1'];
    const hue = [...prompt].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const words = esc(prompt).split(/\s+/); const lines = []; let cur = '';
    for (const wd of words) { if ((cur + ' ' + wd).length > 28) { lines.push(cur); cur = wd; } else cur = (cur ? cur + ' ' : '') + wd; } if (cur) lines.push(cur);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,22%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},80%,45%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="12%" fill="#fff" opacity=".6" font-family="Georgia,serif" font-size="${w / 22}" text-anchor="middle">PRUEBA · ESTUDIO</text>${lines.slice(0, 8).map((l, i) => `<text x="50%" y="${38 + i * 8}%" fill="#fff" font-family="Georgia,serif" font-size="${w / 17}" text-anchor="middle">${l}</text>`).join('')}</svg>`;
    return [{ buf: Buffer.from(svg), ext: 'svg' }];
  },
  async gemini({ prompt, ratio }) { // Nano Banana: generateContent returns the image inline
    const model = cfg.models.gemini;
    const j = await http(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key('gemini') },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt + (ratio && ratio !== '1:1' ? `\nFormato: ${ratio}.` : '') }] }], generationConfig: { responseModalities: ['IMAGE'], ...(ratio ? { imageConfig: { aspectRatio: ratio } } : {}) } }),
    }, 'Nano Banana');
    const parts = (j.candidates || []).flatMap(c => c.content?.parts || []).filter(p => p.inlineData || p.inline_data);
    if (!parts.length) throw new Error('Nano Banana no devolvió imagen' + (j.promptFeedback?.blockReason ? ` (bloqueado: ${j.promptFeedback.blockReason})` : ''));
    return parts.map(p => { const d = p.inlineData || p.inline_data; return { buf: Buffer.from(d.data, 'base64'), ext: extOf(d.mimeType || d.mime_type) }; });
  },
  async grok({ prompt, n }) {
    const j = await http('https://api.x.ai/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key('grok')}` },
      body: JSON.stringify({ model: cfg.models.grok, prompt, n, response_format: 'b64_json' }) }, 'Grok');
    return (j.data || []).map(d => ({ buf: Buffer.from(d.b64_json, 'base64'), ext: 'jpg' }));
  },
  async openai({ prompt, n, ratio }) {
    const [w, h] = ratio === '16:9' ? [1536, 1024] : ratio === '9:16' || ratio === '4:5' || ratio === '3:4' ? [1024, 1536] : [1024, 1024];
    const j = await http('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key('openai')}` },
      body: JSON.stringify({ model: cfg.models.openai, prompt, n, size: `${w}x${h}` }) }, 'OpenAI');
    return Promise.all((j.data || []).map(async d => ({ buf: d.b64_json ? Buffer.from(d.b64_json, 'base64') : await fromUrl(d.url), ext: 'png' })));
  },
  async fal({ prompt, n, ratio }) {
    const size = { '1:1': 'square_hd', '4:5': 'portrait_4_3', '3:4': 'portrait_4_3', '9:16': 'portrait_16_9', '16:9': 'landscape_16_9' }[ratio] || 'square_hd';
    const j = await http(`https://fal.run/${cfg.models.fal}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Key ${key('fal')}` },
      body: JSON.stringify({ prompt, num_images: n, image_size: size }) }, 'fal.ai');
    return Promise.all((j.images || []).map(async im => ({ buf: await fromUrl(im.url), ext: extOf(im.content_type) })));
  },
};
// video: fal.ai's queue (the models open-higgsfield offers: Kling, Seedance, MiniMax, Wan, LTX…)
async function falVideo({ prompt, ratio, seconds }) {
  const model = cfg.models.falVideo, auth = { authorization: `Key ${key('fal')}`, 'content-type': 'application/json' };
  const sub = await http(`https://queue.fal.run/${model}`, { method: 'POST', headers: auth, body: JSON.stringify({ prompt, aspect_ratio: ratio || '16:9', duration: String(seconds || 5) }) }, 'fal.ai video');
  const statusUrl = sub.status_url || `https://queue.fal.run/${model}/requests/${sub.request_id}/status`;
  const resultUrl = sub.response_url || `https://queue.fal.run/${model}/requests/${sub.request_id}`;
  for (let i = 0; i < 120; i++) { // up to 10 minutes
    await new Promise(r => setTimeout(r, 5000));
    const st = await http(statusUrl, { headers: auth }, 'fal.ai video');
    if (st.status === 'COMPLETED') break;
    if (st.status === 'FAILED' || st.status === 'ERROR') throw new Error('el video falló en fal.ai');
    if (i === 119) throw new Error('el video tardó más de 10 minutos');
  }
  const out = await http(resultUrl, { headers: auth }, 'fal.ai video');
  const url = out.video?.url || out.videos?.[0]?.url; if (!url) throw new Error('fal.ai no devolvió el video');
  return [{ buf: await fromUrl(url), ext: 'mp4' }];
}

/** Generate. { prompt, n, ratio, provider, kind: 'image'|'video', seconds, by, agent, task } → { items, cost, budget } */
export async function generate(req) {
  const kind = req.kind === 'video' ? 'video' : 'image';
  const provider = req.provider || defaultProvider();
  const p = providers().find(x => x.id === provider);
  if (!p) throw new Error(`no conozco el proveedor «${provider}»`);
  if (!p.on) throw new Error(`${p.name} no tiene key: guárdala en Windows con  setx ${p.env} "tu-key"  y reinicia la oficina`);
  if (kind === 'video' && provider !== 'fal' && provider !== 'prueba') throw new Error('por ahora el video sale por fal.ai (Kling, Seedance, MiniMax, Wan, LTX)');
  const prompt = String(req.prompt || '').trim(); if (!prompt) throw new Error('falta el prompt');
  if (prompt.length > 4000) throw new Error('el prompt es muy largo (máx. 4000)');
  const n = kind === 'video' ? 1 : Math.max(1, Math.min(cfg.maxPerRequest, +req.n || 1));
  const b = budget(), weight = kind === 'video' ? 5 : n;
  if (provider !== 'prueba' && weight > b.left) throw new Error(`tope diario alcanzado: quedan ${b.left} de ${b.limit} (office.config.json → media.dailyLimit)`);
  const model = kind === 'video' ? cfg.models.falVideo : p.model;
  let outs;
  if (kind === 'video') outs = provider === 'prueba' ? await ADAPTERS.prueba({ prompt: '🎬 ' + prompt, ratio: req.ratio || '16:9' }) : await falVideo({ prompt, ratio: req.ratio, seconds: req.seconds });
  else if (provider === 'gemini' || provider === 'prueba') { outs = []; for (let i = 0; i < n; i++) outs.push(...await ADAPTERS[provider]({ prompt: n > 1 && provider === 'prueba' ? `${prompt} (${i + 1}/${n})` : prompt, ratio: req.ratio, n: 1 })); } // Nano Banana: one image per call
  else outs = await ADAPTERS[provider]({ prompt, n, ratio: req.ratio });
  const unit = kind === 'video' ? COST.falVideo : COST[provider] || 0, cost = +(unit * outs.length).toFixed(3);
  const items = outs.map(o => store(o.buf, o.ext, { prompt, provider, model, ratio: req.ratio || '1:1', cost: unit, by: req.by || 'you', agent: req.agent || null, task: req.task || null }));
  const after = provider === 'prueba' ? budget() : spend(kind === 'video' ? 'videos' : 'images', outs.length, cost);
  return { items, cost, budget: after };
}
