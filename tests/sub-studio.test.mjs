// Dimitri's «Plan de creativos» on the page (src/sub-studio.js): the pure parts — the total, the budget check, the body that
// GENERAR posts to /api/sub/studio, and the reducer that makes the copy of an image Claude's vision sees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTotal, unitCost, fitsBudget, studioBody, fitWithin, shrinkStep, b64Bytes, usd, creativesHTML, actionsHTML, stripHTML, VISION_SIDE, VISION_BYTES } from '../src/sub-studio.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MODELS = [
  { id: 'nano-banana-2', name: 'Nano Banana 2', kind: 'image', on: true, cost: 0.04, per: 'image', settings: { aspectRatio: { type: 'enum', values: ['1:1', '4:5', '9:16'], default: '1:1' } } },
  { id: 'gpt-image-1', name: 'GPT Image', kind: 'image', on: true, cost: 0.08, per: 'image' },
  { id: 'veo-3.1-fast', name: 'Veo 3.1 Fast', kind: 'video', on: true, cost: 0.15, per: 'second', settings: { duration: { type: 'enum', values: [4, 6, 8], default: 8 } } },
];
const CREATIVES = [
  { i: 0, title: 'Portada', kind: 'image', model: 'nano-banana-2', n: 2, cost: 0.08, settings: { aspectRatio: '4:5' }, prompt: 'a cat', state: 'proposed' },
  { i: 1, title: 'Reel', kind: 'video', model: 'veo-3.1-fast', n: 1, cost: 1.2, settings: { duration: 8 }, prompt: 'a dog', state: 'proposed' },
  { i: 2, title: 'Ya enviado', kind: 'image', model: 'gpt-image-1', n: 1, cost: 0.08, state: 'sent', jobId: 'j1' },
];

test('el total suma lo que queda por enviar, con la cantidad y el modelo que dejó el dueño', () => {
  const t = planTotal(CREATIVES, new Map(), MODELS);
  assert.equal(t.count, 2); assert.equal(t.units, 3); assert.equal(t.total, 1.28); // 2 × 0,04 + 1,20; lo enviado no cuenta
  const ed = new Map([[0, { n: 4 }], [1, { include: false }]]);
  assert.deepEqual(planTotal(CREATIVES, ed, MODELS), { count: 1, units: 4, total: 0.16, items: [{ i: 0, n: 4, cost: 0.16 }] });
  assert.equal(planTotal(CREATIVES, new Map([[0, { model: 'gpt-image-1' }]]), MODELS).items[0].cost, 0.16); // otro modelo: el precio del catálogo
});

test('un video cobra por segundo: cambiar la duración cambia el costo', () => {
  assert.equal(unitCost(CREATIVES[1], MODELS[2], { duration: 8 }), 1.2); // lo que estimó Dimitri
  assert.equal(+unitCost(CREATIVES[1], MODELS[2], { duration: 4 }).toFixed(2), 0.6);
  assert.equal(unitCost({ model: 'x', n: 1 }, null), 0); // sin modelo ni estimación: 0, nunca NaN
});

test('cabe o no cabe en lo que queda del día y del mes', () => {
  assert.equal(fitsBudget(1, { costLeftDay: 5, costLeftMonth: 20 }).fits, true);
  const no = fitsBudget(6, { costLeftDay: 5, costLeftMonth: 20 });
  assert.equal(no.fits, false); assert.match(no.why, /quedan US\$5,00 hoy/);
  assert.match(fitsBudget(3, { costLeftDay: null, costLeftMonth: 2 }).why, /este mes/);
  assert.equal(fitsBudget(9, { costLeftDay: null, costLeftMonth: null }).why, 'sin tope de gasto');
  assert.deepEqual(fitsBudget(9, null, { fits: false, why: 'lo dice el servidor' }), { fits: false, why: 'lo dice el servidor' }); // sin presupuesto en la página: manda el servidor
});

test('GENERAR envía solo lo propuesto y solo lo que el dueño cambió', () => {
  const ed = new Map([[0, { prompt: 'a black cat', n: 3, settings: { aspectRatio: '9:16' }, folder: 'Lanzamiento' }], [1, { include: false }]]);
  const b = studioBody('m9', { creatives: CREATIVES }, ed);
  assert.deepEqual(b, { msg: 'm9', items: [
    { i: 0, include: true, prompt: 'a black cat', n: 3, settings: { aspectRatio: '9:16' }, folder: 'Lanzamiento' },
    { i: 1, include: false },
  ] });
  assert.deepEqual(studioBody('m9', { creatives: CREATIVES }, new Map([[0, { prompt: 'a cat', n: 2 }]])).items[0], { i: 0, include: true }); // lo mismo que propuso: nada que mandar
  const withActs = studioBody('m9', { creatives: [], actions: [{ type: 'carpeta_crear', name: 'A' }, { type: 'mover', files: ['x'], folder: 'A', state: 'done' }, { type: 'carpeta_crear', name: 'B' }] }, new Map(), new Map([[2, false]]));
  assert.deepEqual(withActs.actions, [{ k: 0, include: true }, { k: 2, include: false }]); // la ya hecha no vuelve
});

test('la copia para la visión: lado largo ≤1568 px, nunca se agranda', () => {
  assert.deepEqual(fitWithin(3840, 2160), { w: VISION_SIDE, h: 882, scaled: true });
  assert.deepEqual(fitWithin(2160, 3840), { w: 882, h: VISION_SIDE, scaled: true });
  assert.deepEqual(fitWithin(800, 600), { w: 800, h: 600, scaled: false });
  assert.deepEqual(fitWithin(0, 0), { w: 1, h: 1, scaled: false });
});

test('si la copia pesa más de 1,5 MB baja la calidad, y luego el tamaño, hasta caber', () => {
  assert.equal(shrinkStep({ w: 100, h: 100, q: 0.85 }, VISION_BYTES), null);
  assert.deepEqual(shrinkStep({ w: 1568, h: 882, q: 0.85 }, VISION_BYTES + 1), { w: 1568, h: 882, q: 0.75 });
  assert.deepEqual(shrinkStep({ w: 1568, h: 882, q: 0.55 }, VISION_BYTES + 1), { w: 1254, h: 706, q: 0.85 });
  let t = { w: 1568, h: 1568, q: 0.85 }, k = 0; // a model where the bytes follow the pixels and the quality: it always ends
  for (const bytes = s => s.w * s.h * s.q * 1.2; shrinkStep(t, bytes(t)) && k < 30; k++) t = shrinkStep(t, bytes(t));
  assert.ok(k < 30 && t.w * t.h * t.q * 1.2 <= VISION_BYTES);
  assert.equal(b64Bytes('data:image/jpeg;base64,QUJD'), 3); assert.equal(b64Bytes('QUI='), 2); assert.equal(b64Bytes('QQ=='), 1);
});

test('las tarjetas: GENERAR con la cuenta, «no se incluye» con texto y nada sin escapar', () => {
  const m = { id: 'm1', studio: { creatives: [{ ...CREATIVES[0], title: '<b>Portada</b>', prompt_es: 'un gato' }], actions: [{ type: 'carpeta_crear', name: 'Lanzamiento' }], estimate: { total: 0.08, fits: true } } };
  const h = creativesHTML(m, { esc, models: MODELS, budget: { costLeftDay: 1, costLeftMonth: 10, maxPerRequest: 4 } });
  assert.match(h, /GENERAR \(2\) — US\$0,080/);
  assert.match(h, /&lt;b&gt;Portada&lt;\/b&gt;/); assert.doesNotMatch(h, /<b>Portada/);
  assert.match(h, /Crear la carpeta «Lanzamiento»/);
  assert.match(h, /<option value="4:5" selected>/);
  const off = creativesHTML(m, { esc, models: MODELS, edits: new Map([[0, { include: false }]]) });
  assert.match(off, /no se incluye/); assert.match(off, /HACER \(1\)/); // queda la acción
  const done = creativesHTML({ id: 'm2', studio: { creatives: [{ ...CREATIVES[0], state: 'done', files: ['2026-09/a.png'] }] } }, { esc, models: MODELS });
  assert.match(done, /listo/); assert.match(done, /data-open="2026-09\/a.png"/); assert.doesNotMatch(done, /sc-go/);
  assert.equal(actionsHTML({ studio: { actions: [{ type: 'borrar_todo' }] } }, { esc }), ''); // una acción fuera de la lista no se pinta
  assert.match(stripHTML(['v/clip.mp4'], esc), /<video/);
  assert.equal(usd(0.004), 'US$0,004'); assert.equal(usd(12), 'US$12,00');
});
