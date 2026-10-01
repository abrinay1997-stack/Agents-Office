// F0 del banco de presets (1 oct 2026): media.mjs se partió en media/*.mjs detrás de una fachada. Este test es la red:
// toma una «foto» de todo lo que la fachada responde (las exportaciones, models(), engines(), los precios de cada modelo,
// los cuerpos que cada modelo manda a su motor, submit/wait/budget/query/editRequest, los errores en palabras y lo que
// llega a cuatro motores de mentira) y la compara con la que se tomó con el media.mjs de antes de partirlo
// (tests/fixtures/media-fachada.json). Run: npm test
//
// Si un cambio del catálogo o del motor es A PROPÓSITO (un modelo nuevo, un ajuste nuevo), regenera la foto y revisa el diff:
//   AO_FOTO=1 node --test tests/media-fachada.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as media from '../media.mjs';

const FIXTURE = new URL('./fixtures/media-fachada.json', import.meta.url);
const NEW_EXPORTS = ['capsOf']; // lo que F0 añade a la API; nada de antes se quita ni cambia de tipo
const KEYS = ['HF_KEY', 'HF_API_KEY', 'HF_API_SECRET', 'HF_API_BASE_URL', 'GEMINI_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'FAL_KEY', 'MINIMAX_API_KEY', 'AO_GEMINI_BASE', 'AO_META_BASE', 'AO_FAL_RUN', 'AO_FAL_QUEUE', 'AO_POLL_MS'];
const ALL_ON = { HF_KEY: 'id:secreto', GEMINI_API_KEY: 'g', XAI_API_KEY: 'x', OPENAI_API_KEY: 'o', META_API_KEY: 'm', FAL_KEY: 'f', MINIMAX_API_KEY: 'mm' };
async function withEnv(set, fn) { // solo las keys que el test nombra: una key del dueño nunca se cuela
  const keep = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k]; Object.assign(process.env, set);
  try { return await fn(); } finally { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
const pngOf = (w, h) => { const b = Buffer.alloc(64); Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const dataPng = (w, h) => 'data:image/png;base64,' + pngOf(w, h).toString('base64');
const err = fn => { try { const v = fn(); return { ok: v }; } catch (e) { return { error: e.message, ...(e.code ? { code: e.code } : {}), ...(e.engines ? { engines: e.engines } : {}) }; } };

/** Lo que cambia en cada corrida (horas, ids, nombres con la fecha, el puerto del stand) se vuelve un marcador estable. */
function normalizer() {
  const files = new Map(), names = new Map(), jobs = new Map(), folders = new Map();
  const tag = (map, pre, v) => { if (!map.has(v)) map.set(v, `<${pre}${map.size + 1}>`); return map.get(v); };
  const str = s => s
    .replace(/^\d{12,}\|/, '<hora>|') // el cursor de query(): «hora|archivo»
    .replace(/http:\/\/127\.0\.0\.1:\d+/g, '<stand>')
    .replace(/\d{4}-\d{2}\/\d{4}-\d{2}-\d{2} [^"/\\]*? \d{6}(?:-\d+)?\.[a-z0-9]+/g, f => tag(files, 'archivo', f))
    .replace(/^\d{12,}-/, '<hora>-') // un nombre en la papelera: «hora-nombre»
    .replace(/\d{4}-\d{2}-\d{2} [^"/\\]*? \d{6}(?:-\d+)?\.[a-z0-9]+/g, f => tag(names, 'nombre', f))
    .replace(/\bj[a-z0-9]{10,}\b/g, j => tag(jobs, 'trabajo', j))
    .replace(/\bc[a-z0-9]{10,}\b/g, c => tag(folders, 'carpeta', c));
  const walk = v => Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ['at', 'doneAt', 'startedAt', 'pollFrom', 'trashedAt'].includes(k) && typeof x === 'number' ? '<hora>' : k === 'day' || k === 'month' ? '<fecha>' : walk(x)])) : typeof v === 'string' ? str(v) : v;
  return walk;
}

async function stand(answer) { // un motor de mentira: guarda lo que le llega y contesta lo que el test diga
  const seen = [];
  const srv = http.createServer((req, res) => { const ch = []; req.on('data', d => ch.push(d)); req.on('end', () => {
    const b = Buffer.concat(ch).toString('utf8'); let body = null; try { body = b ? JSON.parse(b) : null; } catch { body = b.slice(0, 80); }
    seen.push({ method: req.method, url: req.url, body });
    const a = answer(req, `http://127.0.0.1:${srv.address().port}`);
    if (Buffer.isBuffer(a)) { res.writeHead(200, { 'content-type': 'image/png' }); res.end(a); } else { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(a)); }
  }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, seen, base: `http://127.0.0.1:${srv.address().port}` };
}

const EMPTY = () => ({ start: [], end: [], reference: [], video: [], audio: [] });
function defaults(m) { const s = {}; for (const [k, f] of Object.entries(m.settings || {})) s[k] = f.default; return s; }
function variant(m) { // el otro extremo de cada ajuste: el último valor, el máximo, el contrario
  const s = {}; for (const [k, f] of Object.entries(m.settings || {})) s[k] = f.type === 'enum' ? f.values[f.values.length - 1] : f.type === 'range' ? f.max : f.type === 'boolean' ? !f.default : f.type === 'text' ? 'otra' : f.default; return s;
}
/** Los cuerpos que cada modelo con función propia (hf, fal) arma, con las combinaciones de medios que toma. */
function bodies(models) {
  const out = {};
  for (const m of models) {
    const raw = media.model(m.id); if (!raw || !(raw.hf || raw.fal)) continue;
    const fn = raw.hf || raw.fal, row = {};
    const combos = { nada: {}, inicial: { start: ['u-ini'] }, inicialFinal: { start: ['u-ini'], end: ['u-fin'] }, refs: { reference: ['u-r1', 'u-r2'] }, video: { video: ['u-v1'] }, videoRefs: { video: ['u-v1'], reference: ['u-r1'] } };
    for (const [name, mm] of Object.entries(combos)) for (const [sn, s] of [['def', defaults(m)], ['var', variant(m)]]) row[name + ':' + sn] = err(() => fn({ prompt: 'una taza roja', n: 2, s, m: { ...EMPTY(), ...mm } }));
    out[m.id] = row;
  }
  return out;
}

async function photo() {
  const N = normalizer(), F = {};
  F.exports = Object.fromEntries(Object.keys(media).sort().filter(k => !NEW_EXPORTS.includes(k)).map(k => [k, typeof media[k]]));
  F.constants = { ENGINES: media.ENGINES, NAMES: media.NAMES, DEFAULT_MODELS: media.DEFAULT_MODELS, KINDS: media.KINDS, TIER_NAME: media.TIER_NAME, PAGE_MAX: media.PAGE_MAX, BIN_DAYS: media.BIN_DAYS };
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-fachada-')), data = path.join(brain, 'data');
  const custom = [{ id: 'mio-fal', name: 'Mío fal', engine: 'fal', kind: 'image', path: 'fal-ai/mio', cost: 0.02 }, { id: 'mio-hf', name: 'Mío HF', engine: 'higgsfield', kind: 'video', path: 'mio/text-to-video', cost: 0.05 }, { id: 'malo', engine: 'otro', kind: 'image', path: 'x' }];
  media.configure({ media: { dailyLimit: 30, dailyBudget: 2, monthlyBudget: 10, custom } }, brain, data, { warm: false });
  F.dir = path.relative(brain, media.dir()).replace(/\\/g, '/');

  await withEnv({}, async () => {
    F.offModels = media.models(); F.offEngines = media.engines(); F.offProviders = media.providers();
    F.offDefaults = Object.fromEntries(['image', 'video', 'audio', 'music'].map(k => [k, media.defaultModel(k)])); F.offDefaultProvider = media.defaultProvider();
    F.offEdit = err(() => media.editModels().map(m => m.id));
  });
  await withEnv(ALL_ON, async () => {
    const ms = media.models();
    F.onModels = ms; F.onEngines = media.engines(); F.onProviders = media.providers();
    F.onDefaults = Object.fromEntries(['image', 'video', 'audio', 'music'].map(k => [k, media.defaultModel(k)]));
    F.onDefaultsBy = Object.fromEntries(Object.keys(media.ENGINES).flatMap(e => ['image', 'video'].map(k => [e + ':' + k, media.defaultModel(k, e)])));
    F.onEdit = media.editModels().map(m => m.id);
    F.estimates = Object.fromEntries(ms.map(m => [m.id, [media.estimate({ model: m.id }), media.estimate({ model: m.id, n: 3, settings: variant(m), prompt: 'x'.repeat(57) }), media.estimate({ model: m.id, settings: { duration: 99, aspectRatio: 'nada' } })]]));
    F.estimateUnknown = media.estimate({ model: 'no-existe' });
    F.bodies = bodies(ms);
    F.hfRoutes = Object.fromEntries(ms.filter(m => media.model(m.id).routes).map(m => [m.id, ['nada', 'start', 'ref', 'video', 'startEnd'].map(c => err(() => media.hfRoute(media.model(m.id), { nada: {}, start: { start: 1 }, ref: { reference: 2 }, video: { video: 1 }, startEnd: { start: 1, end: 1 } }[c])))]));
    F.schemaCount = Object.keys(media.hfSchemas()).length;
  });

  // la galería, los trabajos y el presupuesto con la tarjeta de prueba (gratis) y errores en palabras
  await withEnv({}, async () => {
    const fol = media.addFolder('Lanzamiento');
    const a = media.upload({ name: 'producto.png', data: dataPng(1080, 1350), folder: fol.id });
    const b = media.upload({ name: 'logo.png', data: dataPng(800, 800) });
    F.uploadErrors = [err(() => media.upload({ data: 'nada' })), err(() => media.upload({ data: 'data:image/gif;base64,AAAA' })), err(() => media.upload({ data: 'data:image/png;base64,AAAA' }))];
    F.ratio = [media.ratioOf(a), media.ratioOf(b), media.ratioOf({ w: 1000, h: 777 }), media.ratioOf({ ratio: '4:5' })];
    F.submitErrors = [
      err(() => media.submit({ model: 'no-existe', prompt: 'x' })),
      err(() => media.submit({ model: 'nano-banana-2', prompt: 'x' })),
      err(() => media.submit({ model: 'prueba', prompt: '' })),
      err(() => media.submit({ model: 'prueba', prompt: 'x'.repeat(4001) })),
      err(() => media.submit({ model: 'prueba', prompt: 'x', media: { reference: ['2020-01/nada.png'] } })),
      err(() => media.submit({ model: 'prueba-video', prompt: 'x', media: { video: [a.file] } })),
      err(() => media.submit({ model: 'prueba', prompt: 'x', versionOf: '2020-01/nada.png' })),
    ];
    F.budget0 = media.budget();
    const j = media.submit({ model: 'prueba', prompt: 'Una taza roja sobre mármol', n: 2, settings: { aspectRatio: '4:5' }, media: { reference: [a.file] }, by: 'dimitri', purpose: 'post', read: ['marca', 'marca', 'voz'], sub: { msg: 'm1', i: 0 }, folder: fol.id, versionOf: a.file, agent: 'piper', task: 't1' });
    F.submitted = j;
    F.jobsQueued = media.jobs({ active: true });
    const done = await media.wait(j.id, 10000);
    F.done = done; F.job = media.job(j.id); F.jobsByTask = media.jobs({ task: 't1' });
    F.items = done.items.map(f => media.item(f));
    F.original = media.item(a.file);
    F.list = media.list({ limit: 10 });
    F.query = [media.query({}), media.query({ n: 1 }), media.query({ folder: fol.id }), media.query({ q: 'logo' }), media.query({ kind: 'image', n: 2, offset: 1 })];
    F.folders = media.folders();
    F.budget1 = media.budget();
    F.checkBudget = [err(() => media.checkBudget(5)), err(() => media.checkBudget(0.5)), err(() => media.checkBudget(1, { costLeftDay: null, costLeftMonth: 0.2, monthlyBudget: 10 }))];
    F.charge = media.charge(0.25);
    F.edit = [err(() => media.editRequest({ file: a.file, instruction: 'fondo de playa' })), err(() => media.editRequest({ file: 'no', instruction: 'x' })), err(() => media.editRequest({ file: a.file, instruction: ' ' }))];
    F.notes = { needs: media.needsNote(done), name: media.writeStudioNote(done, new Date(2026, 9, 1, 12, 0, 0)) };
    F.learn = [media.learnId(F.items[0]), media.learnArgs(done.items[0], 1), media.learnArgs(done.items[0], 0)];
    F.used = [media.markUsed(b.file, 'ref')?.used, media.markUsed(b.file, 'otro'), media.wasUsed(media.item(b.file))];
    F.refs = media.refsLine({ refs: [a.file, b.file] });
    F.retry = media.retry(j.id); await media.wait(F.retry.id, 10000);
    F.cancel = [media.cancel('no'), media.forget('no')];
    F.vid = await media.wait(media.submit({ model: 'prueba-video', prompt: 'olas', settings: { duration: 3 } }).id, 10000);
    F.generate = await media.generate({ prompt: 'un gato', ratio: '16:9' });
    const t = media.trash(b.file); F.trash = t; F.trashList = media.trashList(); F.restore = media.restore(t); F.after = media.item(b.file);
    F.zip = media.zip([a.file, b.file]).count;
    F.moved = [media.moveTo([b.file], fol.id), err(() => media.moveTo([b.file], 'cnoexiste12345'))];
    F.renamed = media.renameFolder(fol.id, 'Campaña'); F.removed = media.removeFolder(fol.id); F.folders2 = media.folders();
    media.setLimits({ dailyLimit: 1 }); F.limited = err(() => media.submit({ model: 'prueba', prompt: 'x', n: 3 })).error || 'prueba no cuenta'; F.limited2 = err(() => media.submit({ model: 'nano-banana-2', prompt: 'x' })).error; media.setLimits({ dailyLimit: 30 });
  });

  // lo que llega de verdad a los motores (de mentira): Google, Meta, fal y Higgsfield
  const png = pngOf(1024, 1280), dl = { at: 0 };
  const g = await stand(() => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }));
  const mt = await stand(() => ({ data: [{ b64_json: png.toString('base64') }], output_format: 'png' }));
  const fl = await stand((req, base) => req.url.startsWith('/img') ? png : { images: [{ url: base + '/img.png', content_type: 'image/png' }] });
  const hf = await stand((req, base) => req.url.startsWith('/img') ? png : /\/status$/.test(req.url) ? { status: dl.at++ ? 'completed' : 'in_progress', images: [{ url: base + '/img.png' }] } : { request_id: 'r1' });
  try {
    await withEnv({ GEMINI_API_KEY: 'g', AO_GEMINI_BASE: g.base, META_API_KEY: 'm', AO_META_BASE: mt.base, FAL_KEY: 'f', AO_FAL_RUN: fl.base, HF_KEY: 'id:s', HF_API_BASE_URL: hf.base, AO_POLL_MS: '5' }, async () => {
      const ref = media.upload({ name: 'ref.png', data: dataPng(600, 750) });
      F.engines = {};
      for (const [k, req] of Object.entries({ gemini: { model: 'nano-banana-2', prompt: 'taza', settings: { aspectRatio: '4:5', imageSize: '2K' }, media: { reference: [ref.file] } }, meta: { model: 'muse-image', prompt: 'taza', settings: { aspectRatio: '9:16', quality: 'low' } }, fal: { model: 'seedream-4', prompt: 'taza', n: 2, settings: { aspectRatio: '3:4' } }, higgsfield: { model: 'soul-2', prompt: 'taza', settings: { aspectRatio: '3:4' } } })) {
        const d = await media.wait(media.submit(req).id, 15000);
        F.engines[k] = { state: d.state, error: d.error || null, cost: d.cost, items: d.items.length, record: media.item(d.items[0]) };
      }
      F.engines.seen = { gemini: g.seen.map(x => ({ ...x, body: x.body && { ...x.body, contents: x.body.contents?.map(c => ({ parts: c.parts.map(p => p.text ?? { mime: p.inlineData?.mimeType, len: p.inlineData?.data.length }) })) } })), meta: mt.seen, fal: fl.seen, higgsfield: hf.seen };
    });
  } finally { for (const s of [g, mt, fl, hf]) s.srv.close(); }
  F.budgetEnd = media.budget();
  fs.rmSync(brain, { recursive: true, force: true });
  return JSON.parse(JSON.stringify(N(F)));
}

test('la fachada media.mjs responde exactamente lo mismo que el media.mjs de antes de partirlo', async () => {
  const now = await photo();
  if (process.env.AO_FOTO === '1') { fs.writeFileSync(FIXTURE, JSON.stringify(now, null, 1) + '\n'); return; }
  const before = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  for (const k of Object.keys(before)) assert.deepEqual(now[k], before[k], `«${k}» cambió respecto de la foto (si es a propósito: AO_FOTO=1 node --test tests/media-fachada.test.mjs)`);
  assert.deepEqual(Object.keys(now).sort(), Object.keys(before).sort());
});

test('la fachada exporta lo de antes y solo añade lo nuevo de F0', () => {
  const before = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).exports;
  for (const [k, t] of Object.entries(before)) assert.equal(typeof media[k], t, `falta o cambió «${k}»`);
  const extra = Object.keys(media).filter(k => !(k in before));
  assert.deepEqual(extra.sort(), [...NEW_EXPORTS].sort());
});

/* ---------- capsOf: lo que un modelo puede hacer, derivado del catálogo ---------- */
test('capsOf: un modelo que edita con referencias, sus proporciones y tamaños, su familia y su precio', () => {
  const c = media.capsOf('nano-banana-2');
  assert.equal(c.familia, 'conversacional'); assert.equal(c.editar, true); assert.equal(c.maxRefs, 14);
  assert.ok(c.proporciones.includes('4:5') && c.proporciones.includes('21:9'));
  assert.deepEqual(c.tamanos, ['1K', '2K', '4K']);
  assert.equal(c.start, false); assert.equal(c.video, false); assert.equal(c.transparencia, false);
  assert.equal(c.calidad, 3); assert.equal(c.costo, media.estimate({ model: 'nano-banana-2' }));
  const g = media.capsOf('gpt-image-1');
  assert.equal(g.familia, 'instrucciones'); assert.deepEqual(g.proporciones, ['1:1', '3:2', '2:3']);
});

test('capsOf: la familia va primero por nombre exacto (nano-banana-fal edita corto aunque empiece por nano-banana*)', () => {
  assert.equal(media.capsOf('nano-banana-fal').familia, 'edicion-corta');
  assert.equal(media.capsOf('nano-banana').familia, 'conversacional');
  assert.equal(media.capsOf('qwen-image-3').familia, 'edicion-corta');
  assert.equal(media.capsOf('soul-cinema').familia, 'descriptiva');
  assert.equal(media.capsOf('veo-3.1-lite').familia, 'veo');
  assert.equal(media.capsOf('mmx-h3-max').familia, 'minimax-video');
  assert.equal(media.capsOf('minimax-hailuo-2.3').familia, 'minimax-video');
  assert.equal(media.capsOf('mmx-voz-2.8-hd').familia, 'voz-minimax');
  assert.equal(media.capsOf('mmx-musica-3').familia, 'musica-minimax');
  assert.equal(media.capsOf('prueba-video').familia, 'video-generico');
  // presets/familias.json manda cuando se lo pasan (la forma { nombre: { modelos } })
  assert.equal(media.capsOf('nano-banana-2', { familias: { mia: { modelos: ['nano-banana-2'] } } }).familia, 'mia');
  assert.equal(media.capsOf('soul', { familias: { otra: ['kling-*'] } }).familia, null);
});

test('capsOf: video — fotogramas, video de origen y si referencias y fotogramas van juntos', () => {
  const veo = media.capsOf('veo-3.1');
  assert.equal(veo.kind, 'video'); assert.equal(veo.start, true); assert.equal(veo.end, true); assert.equal(veo.maxRefs, 3);
  assert.deepEqual(veo.proporciones, ['16:9', '9:16'], 'Veo nunca 1:1');
  assert.equal(veo.refYFotogramas, false, 'Veo elige: con imagen inicial, las referencias no van');
  assert.equal(media.capsOf('mmx-h3').refYFotogramas, false, 'MiniMax H3: una cosa o la otra');
  assert.equal(media.capsOf('seedance-2').refYFotogramas, false, 'Seedance: start/end y reference no van juntos');
  assert.equal(media.capsOf('prueba-video').refYFotogramas, true);
  const ed = media.capsOf('seedance-2.5-edit'); assert.equal(ed.video, true); assert.ok(ed.necesita.includes('video'));
  assert.equal(media.capsOf('mmx-voz-2.8-hd').maxPrompt, 9999);
  assert.ok(media.capsOf('mmx-voz-2.8-hd').perChar > 0);
  assert.equal(media.capsOf('flux-2').legacy, true);
});

test('capsOf: acepta el id, la fila de models() o el objeto; un modelo que no existe es null; todos tienen las suyas', () => {
  const row = media.models().find(m => m.id === 'muse-image');
  assert.deepEqual(media.capsOf(row), media.capsOf('muse-image'));
  assert.deepEqual(media.capsOf(media.model('muse-image')), media.capsOf('muse-image'));
  assert.equal(media.capsOf('no-existe'), null); assert.equal(media.capsOf(null), null);
  for (const m of media.models()) {
    const c = media.capsOf(m.id);
    assert.equal(c.maxRefs, m.roles.reference || 0, m.id);
    for (const r of c.proporciones) assert.ok(m.settings.aspectRatio.values.includes(r), `${m.id}: ${r}`);
    assert.equal(c.editar, !!m.edit, m.id);
    assert.equal(typeof c.costo, 'number', m.id);
    if (!m.legacy && !/^Modelo tuyo/.test(m.note)) assert.ok(c.familia, `${m.id} no tiene familia de prompt`); // uno propio (media.custom) no tiene: el compilador decide
  }
});
