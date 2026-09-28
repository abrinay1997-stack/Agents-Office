// V4.6 — the Brain's 3D layout (src/brain3d.js → layout3D): coherent, not decoration. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { layout3D } from '../src/brain3d.js';

const R = { x: 1.08, y: 0.86, z: 1.34 };
// a small vault: one index that links every note, three folders with their own maps and details
function vault() {
  const nodes = [{ id: 'index', g: '00-Meta' }], links = [];
  for (const g of ['10-Business', '40-Marketing', '60-Sales']) {
    const moc = nodes.push({ id: 'MOC-' + g, g }) - 1; links.push([0, moc]);
    for (let k = 0; k < 8; k++) { const i = nodes.push({ id: `${g}-nota-${k}`, g }) - 1; links.push([moc, i]); if (k % 3 === 0) links.push([0, i]); if (k) links.push([i - 1, i]); }
  }
  const deg = nodes.map(() => 0); for (const [a, b] of links) { deg[a]++; deg[b]++; }
  return { nodes: nodes.map((n, i) => ({ ...n, i, d: deg[i] })), links };
}
const at = (P, i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('the same vault always gives the same brain (it does not jump between openings)', () => {
  const { nodes, links } = vault();
  assert.deepEqual([...layout3D(nodes, links)], [...layout3D(nodes, links)]);
});

test('every note is inside the brain, and each folder keeps to one hemisphere', () => {
  const { nodes, links } = vault(), P = layout3D(nodes, links);
  for (let i = 0; i < nodes.length; i++) { const [x, y, z] = at(P, i); assert.ok(Math.hypot(x / R.x, y / R.y, z / R.z) <= 1.05, `${nodes[i].id} is outside`); }
  for (const g of ['10-Business', '40-Marketing', '60-Sales']) {
    const xs = nodes.filter(n => n.g === g).map(n => Math.sign(at(P, n.i)[0]));
    const side = Math.sign(xs.reduce((a, b) => a + b, 0));
    assert.ok(xs.filter(s => s === side).length / xs.length >= 0.8, `${g} is split across the fissure`);
  }
});

test('linked notes sit closer than unlinked ones, and the hubs sit deeper than the details', () => {
  const { nodes, links } = vault(), P = layout3D(nodes, links);
  const linked = links.map(([a, b]) => dist(at(P, a), at(P, b))), key = new Set(links.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
  const unlinked = []; for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) if (!key.has(`${a}-${b}`)) unlinked.push(dist(at(P, a), at(P, b)));
  const mean = l => l.reduce((s, x) => s + x, 0) / l.length;
  assert.ok(mean(linked) < mean(unlinked) * 0.85, `linked ${mean(linked).toFixed(2)} vs unlinked ${mean(unlinked).toFixed(2)}`);
  const depth = i => { const [x, y, z] = at(P, i); return Math.hypot(x / R.x, y / R.y, z / R.z); };
  const hubs = nodes.filter(n => n.d >= 8).map(n => depth(n.i)), leaves = nodes.filter(n => n.d <= 2).map(n => depth(n.i));
  assert.ok(mean(hubs) < mean(leaves), `hubs ${mean(hubs).toFixed(2)} should be deeper than leaves ${mean(leaves).toFixed(2)}`);
});

test('a new note joins beside its neighbour and the others keep their place', () => {
  const { nodes, links } = vault(), P = layout3D(nodes, links);
  const prev = new Map(nodes.map((n, i) => [n.id, at(P, i)]));
  const moc = nodes.findIndex(n => n.id === 'MOC-40-Marketing');
  const more = [...nodes, { id: 'campaña-nueva', g: '40-Marketing', i: nodes.length, d: 1 }], moreLinks = [...links, [moc, nodes.length]];
  const Q = layout3D(more, moreLinks, prev);
  const moved = nodes.map((n, i) => dist(at(P, i), at(Q, i)));
  assert.ok(Math.max(...moved) < 0.35, `an old note moved ${Math.max(...moved).toFixed(2)}`);
  assert.ok(dist(at(Q, nodes.length), at(Q, moc)) < 0.6, 'the new note is far from the map it links to');
});

test('a place that is not a number (a note added before it was laid out) is laid out again, never drawn at NaN', () => {
  const { nodes, links } = vault(), P = layout3D(nodes, links);
  const prev = new Map(nodes.map((n, i) => [n.id, at(P, i)])); prev.set(nodes[5].id, [NaN, undefined, 0]);
  const Q = layout3D(nodes, links, prev);
  assert.ok([...Q].every(Number.isFinite), 'a NaN reached the drawing');
});
