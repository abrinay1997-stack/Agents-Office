// estudio-plan.mjs: every rule that keeps Dimitri's creatives honest before the owner presses GENERAR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studioPromptBlock, parseCreatives, estimatePlan, parseActions, approvedFromNote, cleanSettings, COMPACT_OVER, WEIGHT, weightOf, unitWord } from '../estudio-plan.mjs';

const RATIO = { type: 'enum', values: ['1:1', '9:16', '16:9'], default: '1:1' };
const MODELS = [
  { id: 'nano-banana-2', engine: 'gemini', kind: 'image', name: 'Nano Banana 2', on: true, cost: 0.04, per: 'item', roles: { reference: 3 }, needs: [], settings: { aspectRatio: RATIO, imageSize: { type: 'enum', values: ['1K', '2K'], default: '1K' } }, maker: 'Google', tier: 3, speed: 'rápido', uses: ['texto en la imagen'], edit: true },
  { id: 'gpt-image-1', engine: 'openai', kind: 'image', name: 'GPT Image', on: false, cost: 0.08, roles: { reference: 4 }, needs: [], settings: { aspectRatio: RATIO } },
  { id: 'kling-3-std', engine: 'higgsfield', kind: 'video', name: 'Kling 3', on: true, cost: 0.1, per: 's', roles: { start: 1, end: 1 }, needs: ['start'], settings: { aspectRatio: RATIO, duration: { type: 'range', min: 3, max: 10, default: 5 } }, maker: 'Kling', tier: 4, speed: 'lento' },
  { id: 'veo-lite', engine: 'gemini', kind: 'video', name: 'Veo Lite', on: true, cost: 0.05, per: 's', roles: { start: 1, reference: 3 }, needs: [], settings: { duration: { type: 'range', min: 4, max: 8, default: 8 } } },
  { id: 'prueba', engine: 'prueba', kind: 'image', name: 'Prueba', on: true, cost: 0, roles: { reference: 8 }, needs: [], settings: { aspectRatio: RATIO } },
  { id: 'old-flux', engine: 'higgsfield', kind: 'image', name: 'Flux viejo', on: true, legacy: true, cost: 0.05, roles: {}, needs: [], settings: {} },
];
const GALLERY = new Set(['2026-09/foto.png', '2026-09/otra.jpg', '2026-09/clip.mp4', '2026-09/voz.mp3']);
const OPTS = { models: MODELS, folders: [{ id: 'c1', name: 'Lanzamiento', n: 3 }], galleryHas: id => GALLERY.has(id), maxPerRequest: 4, defaultModel: k => (k === 'video' ? 'veo-lite' : 'nano-banana-2'), estimate: ({ model, n, settings }) => { const m = MODELS.find(x => x.id === model); return +((m.per === 's' ? m.cost * (settings.duration || 5) : m.cost) * n).toFixed(3); } };
const one = (c, o = OPTS) => parseCreatives({ creatives: [c] }, o)[0];

test('the prompt block lists only the models that are on (never a legacy one), with cost, roles, needs and the allowed settings', () => {
  const t = studioPromptBlock({ models: MODELS, budget: { left: 10, limit: 40, costLeftDay: 1.5, dailyBudget: 2, costLeftMonth: null, maxPerRequest: 4 }, folders: [{ id: 'c1', name: 'Lanzamiento', n: 3 }], attach: [{ id: '2026-09/foto.png', prompt: 'una foto' }], context: { view: 'studio', label: 'Galería', kind: 'image', id: '2026-09/foto.png' }, approved: [{ title: 'Reel de agosto', prompt: 'neon claw machine', model: 'kling-3-std', file: '2026-08/r.mp4' }] });
  assert.match(t, /nano-banana-2 · Nano Banana 2 · IMAGEN · Google · calidad alta · rápido · para: texto en la imagen · US\$0\.04 por imagen · toma: reference ≤3 · edita una imagen · ajustes: aspectRatio \[1:1\|9:16\|16:9\] \(def 1:1\); imageSize \[1K\|2K\]/);
  assert.match(t, /kling-3-std .*US\$0\.10 por segundo · toma: start ≤1, end ≤1 · NECESITA: start · ajustes: .*duration 3–10 \(def 5\)/);
  assert.match(t, /prueba .*gratis/);
  assert.doesNotMatch(t, /gpt-image-1|old-flux/);
  assert.match(t, /hoy quedan 10 de 40/); assert.match(t, /dinero del día: quedan US\$1\.50 de US\$2\.00/); assert.doesNotMatch(t, /dinero del mes/);
  assert.match(t, /«Lanzamiento» \(3\)/);
  assert.match(t, /IMÁGENES ADJUNTAS[^\n]*\n- 1\. id: 2026-09\/foto\.png · su prompt: una foto/);
  assert.doesNotMatch(t, /ESTÁ VIENDO/, 'what the owner looks at is <viendo> in the system prompt now (DIM-08), not under the Estudio');
  assert.match(t, /CREATIVOS APROBADOS PARECIDOS[^\n]*\n- «Reel de agosto» · kling-3-std · 2026-08\/r\.mp4 · prompt: neon claw machine/);
  assert.match(studioPromptBlock({ models: [MODELS[1]] }), /ninguno: el Estudio no tiene motores encendidos/);
});

test('a model that is on is kept, its kind wins, the cost is estimated and the creative is proposed', () => {
  const c = one({ title: 'Post', kind: 'video', model: 'nano-banana-2', prompt: 'a red "PANACLAW" sign', prompt_es: 'un letrero', n: 2, settings: { aspectRatio: '9:16' }, purpose: 'lanzamiento', why: 'pone bien el texto' });
  assert.equal(c.state, 'proposed'); assert.equal(c.kind, 'image'); assert.equal(c.model, 'nano-banana-2'); assert.equal(c.modelName, 'Nano Banana 2');
  assert.deepEqual(c.settings, { aspectRatio: '9:16', imageSize: '1K' }); assert.equal(c.cost, 0.08); assert.equal(c.i, 0);
  assert.deepEqual(c.media, { reference: [], start: [], end: [], video: [] });
});

test('a model that is off or unknown falls back to the default for its kind and says so in why', () => {
  const off = one({ model: 'gpt-image-1', prompt: 'x', why: 'me gusta' });
  assert.equal(off.model, 'nano-banana-2'); assert.match(off.why, /^me gusta \(Pediste «gpt-image-1», que no está encendido: uso Nano Banana 2\.\)$/);
  const none = one({ kind: 'video', model: 'sora-9', prompt: 'x' });
  assert.equal(none.model, 'veo-lite'); assert.match(none.why, /«sora-9», que no existe en el Estudio: uso Veo Lite/);
  const legacy = one({ model: 'old-flux', prompt: 'x' }); assert.equal(legacy.model, 'nano-banana-2');
  const nothing = one({ model: 'x', prompt: 'y' }, { ...OPTS, defaultModel: () => null });
  assert.equal(nothing.state, 'skipped'); assert.match(nothing.error, /ningún modelo de imagen encendido/);
});

test('settings off their list take the model\'s default; a range is clamped; unknown keys go', () => {
  const c = one({ model: 'nano-banana-2', prompt: 'x', settings: { aspectRatio: '21:9', imageSize: '8K', seed: 4 } });
  assert.deepEqual(c.settings, { aspectRatio: '1:1', imageSize: '1K' });
  const v = one({ model: 'veo-lite', prompt: 'x', settings: { duration: 30 } }); assert.deepEqual(v.settings, { duration: 8 });
  assert.deepEqual(cleanSettings(MODELS[3], { duration: 'abc' }), { duration: 8 });
  assert.deepEqual(cleanSettings(MODELS[3], {}), { duration: 8 });
  assert.deepEqual(cleanSettings(MODELS[3], { duration: 2 }), { duration: 4 });
});

test('media: only what the gallery has, in the roles the model takes, of the right kind, up to each role\'s maximum', () => {
  const c = one({ model: 'nano-banana-2', prompt: 'x', media: { reference: ['2026-09/foto.png', '2026-09/foto.png', 'no/existe.png', '2026-09/clip.mp4', '2026-09/voz.mp3', '2026-09/otra.jpg', 7], start: ['2026-09/foto.png'], video: ['2026-09/clip.mp4'] } });
  assert.deepEqual(c.media, { reference: ['2026-09/foto.png', '2026-09/otra.jpg'], start: [], end: [], video: [] });
  const k = one({ model: 'kling-3-std', prompt: 'x', media: { start: ['2026-09/otra.jpg', '2026-09/foto.png'], end: ['2026-09/clip.mp4'] } });
  assert.deepEqual(k.media.start, ['2026-09/otra.jpg']); assert.deepEqual(k.media.end, []);
});

test('a need left unmet skips the creative with a clear reason; an empty prompt too', () => {
  const k = one({ model: 'kling-3-std', prompt: 'make it move', media: { start: ['no/existe.png'] } });
  assert.equal(k.state, 'skipped'); assert.match(k.error, /Kling 3 necesita una imagen inicial y no la hay en la galería/);
  const e = one({ model: 'nano-banana-2', prompt: '   ' }); assert.equal(e.state, 'skipped'); assert.equal(e.error, 'falta el prompt');
});

test('n stays between 1 and maxPerRequest (video ≤4); the prompt ≤4000; at most 8 creatives; folder by name or id', () => {
  assert.equal(one({ model: 'nano-banana-2', prompt: 'x', n: 99 }).n, 4);
  assert.equal(one({ model: 'nano-banana-2', prompt: 'x', n: 0 }).n, 1);
  assert.equal(one({ model: 'veo-lite', prompt: 'x', n: 9 }, { ...OPTS, maxPerRequest: 8 }).n, 4);
  assert.equal(one({ model: 'nano-banana-2', prompt: 'p'.repeat(5000) }).prompt.length, 4000);
  assert.equal(parseCreatives(Array.from({ length: 12 }, () => ({ prompt: 'x' })), OPTS).length, 8);
  assert.equal(one({ prompt: 'x', folder: 'c1' }).folder, 'Lanzamiento');
  assert.equal(one({ prompt: 'x', folder: '  Nueva   <b>campaña ' }).folder, 'Nueva bcampaña');
  assert.deepEqual(parseCreatives(null, OPTS), []); assert.deepEqual(parseCreatives({ creatives: 'x' }, OPTS), []);
});

test('the plan\'s estimate: only proposed and included, the test engine free, and whether it fits the caps', () => {
  const cs = parseCreatives([{ model: 'nano-banana-2', prompt: 'a', n: 2 }, { model: 'veo-lite', prompt: 'b', settings: { duration: 4 } }, { model: 'kling-3-std', prompt: 'c' }, { model: 'prueba', prompt: 'd', n: 4 }], OPTS);
  const p = estimatePlan(cs, { estimate: OPTS.estimate, budget: { left: 40, costLeftDay: null, costLeftMonth: null }, models: MODELS });
  assert.deepEqual(p.perItem, [{ i: 0, cost: 0.08 }, { i: 1, cost: 0.2 }, { i: 3, cost: 0 }]); assert.equal(p.total, 0.28); assert.equal(p.fits, true); assert.match(p.why, /Cabe: aprox\. US\$0\.28/);
  cs[1].include = false;
  assert.equal(estimatePlan(cs, { estimate: OPTS.estimate, models: MODELS }).total, 0.08);
  const tight = estimatePlan(parseCreatives([{ model: 'veo-lite', prompt: 'b', n: 2 }], OPTS), { estimate: OPTS.estimate, budget: { left: 6, costLeftDay: 0.5, dailyBudget: 1, costLeftMonth: 10 }, models: MODELS });
  assert.equal(tight.fits, false); assert.match(tight.why, /el tope de hoy: esto son 10 y quedan 6 y en el dinero del día: quedan US\$0\.50/);
  assert.equal(estimatePlan(parseCreatives([{ model: 'prueba', prompt: 'x', n: 4 }], OPTS), { estimate: () => 9, budget: { left: 0 }, models: MODELS }).fits, true); // the test engine never counts
});

test('actions: only the four of the contract, cleaned; unknown ones (generar, publicar, aprobar…) are ignored', () => {
  const a = parseActions([
    { type: 'carpeta_crear', name: ' Reels  octubre ' }, { type: 'carpeta_crear', name: '' },
    { type: 'carpeta_renombrar', from: 'Lanzamiento', to: 'Lanzamiento 2026' }, { type: 'carpeta_renombrar', from: 'a', to: 'a' },
    { type: 'mover', files: ['2026-09/foto.png', 'fuera/x.png', '2026-09/foto.png'], folder: 'Reels octubre' }, { type: 'mover', files: ['fuera/x.png'], folder: 'X' },
    { type: 'enviar_contenido', file: '2026-09/otra.jpg', texto: 'Llega el lunes' }, { type: 'enviar_contenido', file: 'fuera/x.png' },
    { type: 'generar', model: 'nano-banana-2' }, { type: 'publicar', file: '2026-09/foto.png' }, { type: 'aprobar' }, { type: 'borrar', files: ['2026-09/foto.png'] }, null, 'x',
  ], { galleryHas: id => GALLERY.has(id) });
  assert.deepEqual(a, [
    { k: 0, type: 'carpeta_crear', name: 'Reels octubre', state: 'proposed' },
    { k: 1, type: 'carpeta_renombrar', from: 'Lanzamiento', to: 'Lanzamiento 2026', state: 'proposed' },
    { k: 2, type: 'mover', files: ['2026-09/foto.png'], folder: 'Reels octubre', state: 'proposed' },
    { k: 3, type: 'enviar_contenido', file: '2026-09/otra.jpg', texto: 'Llega el lunes', state: 'proposed' },
  ]);
  assert.deepEqual(parseActions('nada'), []);
});

test('an Estudio note in the Brain → title, prompt, model and file', () => {
  const n = approvedFromNote('2026-09-12 reel-neon', '---\ntitulo: Reel neón\nmodelo: kling-3-std\nprompt: "neon claw machine at night"\n---\n![](/media/2026-09/2026-09-12%20neon%20120000.mp4)\n[[voice]]');
  assert.deepEqual(n, { title: 'Reel neón', prompt: 'neon claw machine at night', model: 'kling-3-std', file: '2026-09/2026-09-12 neon 120000.mp4' });
  const b = approvedFromNote('2026-09-01 post-lunes', '# Post del lunes\n- **Prompt:** a claw machine\n- **Modelo:** nano-banana-2\n');
  assert.deepEqual(b, { title: 'Post del lunes', prompt: 'a claw machine', model: 'nano-banana-2', file: '' });
});

/* ---------- V4.11 ---------- */
test('with many models on, the block is compact: the default in full, two more in short, the rest by id (DIM-04)', () => {
  const many = Array.from({ length: COMPACT_OVER + 6 }, (_, i) => ({ id: `img-${i}`, engine: 'fal', kind: 'image', name: `Img ${i}`, on: true, cost: 0.01 * (i + 1), roles: {}, needs: [], tier: i === 5 ? 4 : 2, uses: i === 7 ? ['texto en la imagen'] : [], settings: { aspectRatio: RATIO, quality: { type: 'enum', values: ['a', 'b'], default: 'a' } } }));
  const t = studioPromptBlock({ models: many, ask: 'un post con texto en la imagen', defaults: () => 'img-3' });
  const lines = t.split('\n').filter(l => /^- img-/.test(l));
  assert.equal(lines.length, 3, 'three models in full or short lines');
  assert.match(lines[0], /^- img-3 .*ajustes: aspectRatio/, 'the default first, with its settings');
  assert.match(lines[1], /^- img-7 /, 'then what the request asks for (uses)'); assert.doesNotMatch(lines[1], /ajustes/);
  assert.match(t, /otros de imagen \(usa su id; sus ajustes van por defecto\): .*img-0/);
  assert.ok(t.length < 3000, `compact (${t.length} characters)`);
});

test('voices: the block lists the owner\'s and the system\'s by id; an invented voiceId falls back and says so (DIM-03)', () => {
  const VOZ = { id: 'speech-hd', engine: 'minimax', kind: 'audio', name: 'Speech HD', on: true, cost: 0.1, perChar: true, roles: {}, needs: [], settings: { voiceId: { type: 'text', default: 'Spanish_Narrator' } } };
  const voices = [{ voiceId: 'voz-abrinay-01', name: 'Abrinay', kind: 'clone', at: Date.parse('2026-09-30T12:00:00') }, { voiceId: 'Spanish_Narrator', name: 'Narrador', kind: 'system' }];
  const t = studioPromptBlock({ models: [VOZ], voices });
  assert.match(t, /del dueño: voz-abrinay-01 «Abrinay» \(clonada el/); assert.match(t, /del sistema: Spanish_Narrator «Narrador»/);
  assert.match(studioPromptBlock({ models: [VOZ], voices: [voices[1]] }), /ninguna todavía \(si pide «mi voz», dile que la clone/);
  const ok = parseCreatives([{ kind: 'audio', model: 'speech-hd', prompt: 'Hola', settings: { voiceId: 'voz-abrinay-01' } }], { models: [VOZ], voices: voices.map(v => v.voiceId) })[0];
  assert.equal(ok.settings.voiceId, 'voz-abrinay-01'); assert.doesNotMatch(ok.why, /no está/);
  const bad = parseCreatives([{ kind: 'audio', model: 'speech-hd', prompt: 'Hola', settings: { voiceId: 'voz-inventada' } }], { models: [VOZ], voices: voices.map(v => v.voiceId) })[0];
  assert.equal(bad.settings.voiceId, 'Spanish_Narrator'); assert.match(bad.why, /«voz-inventada» no está entre tus voces/);
});

test('a video or an audio attached is listed apart (Dimitri does not see it); the units say what came back (DIM-09, DIM-02)', () => {
  const t = studioPromptBlock({ models: MODELS, attach: [{ id: '2026-09/clip.mp4', prompt: 'un reel' }, { id: '2026-09/foto.png' }] });
  assert.match(t, /IMÁGENES ADJUNTAS[^\n]*\n- 1\. id: 2026-09\/foto\.png/); assert.match(t, /VIDEO O AUDIO ADJUNTO[^\n]*\n- video id: 2026-09\/clip\.mp4 · su prompt: un reel/);
  assert.equal(unitWord('audio', 1), 'locución'); assert.equal(unitWord('music', 2), 'piezas musicales'); assert.equal(unitWord('image', 2), 'imágenes');
  assert.equal(weightOf('music'), 3); assert.equal(weightOf('audio'), 1); assert.equal(WEIGHT.video, 5);
});

test('«enviar a Contenido» takes a title in Spanish and the day, hour, format and networks when given (DIM-17)', () => {
  const [a] = parseActions([{ type: 'enviar_contenido', file: '2026-09/foto.png', titulo: 'Combo del viernes', texto: 'Ven', fecha: '2026-10-09', hora: '18:00', formato: 'reel', redes: ['Instagram', 'tiktok'] }], { galleryHas: id => GALLERY.has(id) });
  assert.deepEqual(a, { k: 0, type: 'enviar_contenido', file: '2026-09/foto.png', titulo: 'Combo del viernes', texto: 'Ven', fecha: '2026-10-09', hora: '18:00', formato: 'reel', redes: ['instagram'], state: 'proposed' });
  const [b] = parseActions([{ type: 'enviar_contenido', file: '2026-09/foto.png', fecha: 'viernes', hora: '18:00', formato: 'tiktok' }], { galleryHas: id => GALLERY.has(id) });
  assert.equal(b.fecha, undefined); assert.equal(b.hora, undefined, 'no hour without a day'); assert.equal(b.formato, undefined);
});
