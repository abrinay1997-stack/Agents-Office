// V4.4 — every request the Estudio can send to Higgsfield, checked against Higgsfield's own schemas (media.mjs,
// higgsfield-schemas.json). Run: npm test
// Each model, with every combination of media it takes and every value of every setting, must build a body whose fields
// all exist on its route, whose values are all allowed there, and that carries every required field; and every route
// Higgsfield documents must be reachable from some model.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../media.mjs';

const S = M.hfSchemas();
const u = 'https://x/a.png', v = 'https://x/a.mp4';
const combos = [{}, { start: [u] }, { start: [u], end: [u] }, { end: [u] }, { reference: [u] }, { reference: [u, u, u] }, { video: [v] }, { video: [v], reference: [u] }, { start: [u], video: [v] }, { start: [u], reference: [u] }];
const docModels = () => M.models().map(x => M.model(x.id)).filter(m => m.engine === 'higgsfield' && !m.legacy);

test('the schemas are there: every route Higgsfield documents', () => {
  assert.ok(Object.keys(S).length >= 81, 'rutas: ' + Object.keys(S).length);
});

test('every body a model can send fits its route: known fields, allowed values, required fields present', () => {
  const bad = []; let sent = 0;
  for (const m of docModels()) {
    const variants = [{}];
    for (const [k, d] of Object.entries(m.settings)) {
      if (d.type === 'enum') for (const val of d.values) variants.push({ [k]: val });
      if (d.type === 'range') variants.push({ [k]: d.min }, { [k]: d.max });
      if (d.type === 'boolean') variants.push({ [k]: !d.default });
    }
    for (const c of combos) {
      if (Object.keys(c).some(r => !m.roles[r])) continue;
      const counts = Object.fromEntries(Object.entries(c).map(([r, l]) => [r, l.length]));
      let eid; try { eid = M.hfRoute(m, counts); } catch { continue; } // a combination the model does not take is refused in words, before anything is sent
      for (const vs of variants) {
        const s = {}; for (const [k, d] of Object.entries(m.settings)) s[k] = d.default; Object.assign(s, vs);
        const { path, body } = m.hf({ prompt: 'una prueba', s, m: { start: [], end: [], reference: [], video: [], ...c } }); sent++;
        assert.equal(path, eid);
        const sc = S[path], why = t => bad.push(`${m.id} → ${path} ${JSON.stringify(vs)} ${JSON.stringify(counts)}: ${t}`);
        for (const [k, val] of Object.entries(body)) {
          const f = sc.p[k]; if (!f) { why(`campo desconocido ${k}`); continue; }
          if (f.e && !f.e.includes(val)) why(`${k}=${JSON.stringify(val)} no permitido`);
          if (typeof val === 'number' && ((f.min !== undefined && val < f.min) || (f.max !== undefined && val > f.max))) why(`${k}=${val} fuera de rango`);
          if (Array.isArray(val) && f.maxItems && val.length > f.maxItems) why(`${k}: más de ${f.maxItems}`);
        }
        for (const r of sc.req) if (body[r] === undefined) why(`falta ${r}`);
      }
    }
  }
  assert.ok(sent > 1000, 'peticiones: ' + sent);
  assert.deepEqual(bad.slice(0, 10), []);
});

test('every documented route is reachable from a model', () => {
  const used = new Set(docModels().flatMap(m => Object.values(m.routes)));
  const missing = Object.keys(S).filter(eid => !used.has(eid));
  assert.deepEqual(missing, []);
});

test('the route follows the media: a first frame animates it, references go to the reference route, nothing is text', () => {
  const k = M.model('kling-3-std'), sd = M.model('seedance-2.5'), o3 = M.model('kling-o3');
  assert.equal(M.hfRoute(k, {}), 'kling-video/v3.0/std/text-to-video');
  assert.equal(M.hfRoute(k, { start: 1 }), 'kling-video/v3.0/std/image-to-video');
  assert.equal(M.hfRoute(sd, { reference: 2 }), 'bytedance/seedance-2.5/reference-to-video');
  assert.equal(M.hfRoute(o3, { start: 1, end: 1 }), 'kling-video/o3/first-last-frame');
  assert.equal(M.hfRoute(o3, { video: 1 }), 'kling-video/o3/video-reference');
  assert.throws(() => M.hfRoute(M.model('kling-3-motion'), { start: 1 }), /necesita/);
  assert.deepEqual(M.model('kling-3-motion').needs.sort(), ['start', 'video']);
});

test('values a route does not have are left out or moved to the nearest one it takes', () => {
  const h = M.model('minimax-hailuo-2.3'), l = M.model('ltx-2.5-pro');
  assert.equal(h.hf({ prompt: 'x', s: { duration: 7 }, m: { start: [], end: [], reference: [], video: [] } }).body.duration, 6);
  const b = l.hf({ prompt: 'x', s: { aspectRatio: '9:16' }, m: { start: [], end: [], reference: [], video: [] } }).body;
  assert.equal(b.aspect_ratio, '9:16'); assert.ok([6, 8, 10].includes(b.duration), 'LTX requires a duration');
  const k = M.model('kling-3-std').hf({ prompt: 'x', s: { sound: false }, m: { start: [], end: [], reference: [], video: [] } }).body;
  assert.equal(k.sound, 'off');
});
