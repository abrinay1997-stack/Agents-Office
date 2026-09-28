// V4.6 — how the Brain remembers (memory.mjs): mentions, summaries, a context budget, the neighbourhood, synapses that learn.
// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../memory.mjs';

const notes = new Map([
  ['plazos-entrega', '# Plazos de entrega\nUn sitio Start se entrega en 10 días hábiles.'],
  ['precios-webs', '---\nresumen: Lo que cuesta cada sitio\n---\n# Precios de sitios web\n\n## Start\nUn sitio de una página.\n\n| Plan | Precio |\n|---|---|\n| Start | $295 |\n\nLos plazos de entrega van aparte.'],
  ['voz', '# Voz\nHablamos de tú.'],
  ['index', '[[plazos-entrega]] [[precios-webs]] [[voz]] [[faq]]'],
  ['faq', 'Preguntas: la voz de la marca y los [[precios-webs]].'],
]);

test('a note that names another without linking it is connected to it; a short name like «voz» is not a mention', () => {
  const m = M.mentions(notes).map(p => p.join(' → '));
  assert.ok(m.includes('precios-webs → plazos-entrega'), m.join(' | '));
  assert.ok(!m.some(x => x.endsWith('→ voz')), 'voz is too short to count');
  assert.ok(!m.some(x => x.startsWith('index')), 'what is already a [[link]] is not counted again');
});

test('a summary keeps the title, its own «resumen», the first sentence of each section and the amounts, within the limit', () => {
  const s = M.summary(notes.get('precios-webs'), 320);
  assert.match(s, /Lo que cuesta cada sitio/); assert.match(s, /Precios de sitios web/); assert.match(s, /Start: Un sitio de una página\./); assert.match(s, /\$295/);
  assert.ok(!/---/.test(s), 'no table rules'); assert.ok(M.summary('x'.repeat(2000), 100).length <= 100);
  assert.equal(M.summary(notes.get('precios-webs')), M.summary(notes.get('precios-webs')));
});

test('the context budget keeps the best first, drops a near-copy and never goes over', () => {
  const same = 'El plan Start cuesta 295 dólares y se entrega en diez días hábiles con dominio incluido.';
  const out = M.pack([{ head: '--- a.md ---', body: same }, { head: '--- b.md ---', body: same + ' ' }, { head: '--- c.md ---', body: 'Otra cosa muy distinta: la voz de la marca es cercana.' }], 5000);
  assert.match(out, /a\.md/); assert.ok(!/b\.md/.test(out), 'the copy is left out'); assert.match(out, /c\.md/);
  const big = M.pack(Array.from({ length: 10 }, (_, i) => ({ head: `--- n${i}.md ---`, body: `Párrafo ${i} ` + 'palabra distinta '.repeat(20) + i + '\n\nOtro párrafo ' + 'z'.repeat(400) })), 1500);
  assert.ok(big.length <= 1500, 'over the budget: ' + big.length);
});

test('the best notes bring their neighbours; a hub linked to everything is damped; mentions and learned links count', () => {
  const adj = M.linkGraph(notes, { extra: [['voz', 'plazos-entrega', 0.9]] });
  assert.equal(adj.get('precios-webs').get('plazos-entrega'), 0.35, 'a mention weighs 0.35');
  assert.equal(adj.get('voz').get('plazos-entrega'), 0.9, 'a learned link keeps its weight');
  const got = M.expand([{ note: 'precios-webs', score: 2 }], adj, { max: 3 });
  assert.equal(got[0].note, 'faq', 'the closest real neighbour first'); assert.equal(got[0].via, 'precios-webs');
  const idx = got.find(x => x.note === 'index'), faq = got.find(x => x.note === 'faq');
  assert.ok(!idx || idx.score < faq.score, 'the hub scores less than a plain neighbour');
});

test('«Fuentes:» names the notes it used, among the ones it read', () => {
  const r = 'Texto del entregable.\n\nFuentes: precios webs, [[plazos-entrega]]\nUsed: Gmail';
  assert.deepEqual(M.cited(r, ['precios-webs', 'plazos-entrega', 'voz']).sort(), ['plazos-entrega', 'precios-webs']);
  assert.deepEqual(M.cited('sin fuentes', ['voz']), []);
});

test('synapses learn from approved work, weaken with 👎, never count a task twice and drift back when unused', () => {
  const t0 = Date.parse('2026-09-01T12:00:00Z'), mem = M.emptyMemory();
  M.reinforce(mem, { id: 't1', r: 1, cited: ['precios-webs', 'plazos-entrega'], read: ['precios-webs', 'plazos-entrega', 'voz'] }, t0);
  M.reinforce(mem, { id: 't2', r: 1, cited: ['precios-webs', 'plazos-entrega'], read: [] }, t0);
  const k = 'plazos-entrega\u0001precios-webs';
  assert.ok(mem.edges[k].w > 0.2, 'the link between notes cited together grows');
  assert.ok(mem.notes['precios-webs'].w > 0.5 && mem.notes.voz.w < 0.5, 'cited up, read-but-unused a little down');
  const before = JSON.stringify(mem.notes); M.reinforce(mem, { id: 't2', r: 1, cited: ['precios-webs', 'plazos-entrega'], read: [] }, t0);
  assert.equal(JSON.stringify(mem.notes), before, 'the same judgment again changes nothing');
  const up = mem.notes['precios-webs'].w; M.reinforce(mem, { id: 't2', r: 0, cited: ['precios-webs', 'plazos-entrega'], read: [] }, t0);
  assert.ok(mem.notes['precios-webs'].w < up, 'a 👎 on the same task replaces its approval');
  assert.ok(M.boostOf(mem, 'nunca-vista') === 1, 'a note never used is neutral');
  const later = t0 + 365 * 864e5; assert.ok(Math.abs(M.effective(mem.notes.voz, later) - 0.5) < 0.03, 'after a year unused it is back near neutral');
  const m2 = M.emptyMemory(); M.reinforce(m2, { id: 'x', r: 0.25, cited: ['a', 'b'], read: [] }, t0); assert.deepEqual(m2.edges, {}, 'poor work does not create a link');
});

test('the outcome of a task: approved 1, used as it came 0.75, a send-back costs 0.25, 👎 0', () => {
  assert.equal(M.outcome({ approved: true }), 1); assert.equal(M.outcome({}), 0.75); assert.equal(M.outcome({ revisions: 1 }), 0.5);
  assert.equal(M.outcome({ revisions: 9 }), 0.25); assert.equal(M.outcome({ approved: true, vote: 'down' }), 0); assert.equal(M.outcome({ revisions: 2, vote: 'up' }), 1);
});
