// Auditoría 1 oct 2026 (A11-16) — src/labels.js: the department cards never sit on each other on a phone. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { spread } from '../src/labels.js';

const rect = (it, dy) => ({ x0: it.cx - it.w / 2, x1: it.cx + it.w / 2, y0: it.cy + dy - it.h / 2, y1: it.cy + dy + it.h / 2 });
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test('cards that do not touch stay where they are', () => {
  assert.deepEqual(spread([{ cx: 50, cy: 50, w: 80, h: 30 }, { cx: 300, cy: 50, w: 80, h: 30 }, { cx: 50, cy: 200, w: 80, h: 30, fixed: true }]), [0, 0, 0]);
});

test('the centre tag (Dimitri) never moves; a card under it moves the short way, and nothing overlaps after', () => {
  // 390 px: the Brain + Dimitri tag over «VENTAS 6», and CORREOS touching ENTREGAS
  const items = [
    { cx: 195, cy: 272, w: 280, h: 40, fixed: true }, // el Cerebro + Dimitri
    { cx: 320, cy: 256, w: 120, h: 32 }, // ventas
    { cx: 200, cy: 163, w: 120, h: 32 }, // correos
    { cx: 300, cy: 165, w: 130, h: 32 }, // entregas
    { cx: 300, cy: 338, w: 120, h: 32 }, // finanzas
  ];
  const dy = spread(items, { top: 60, bottom: 420, gap: 3 });
  assert.equal(dy[0], 0);
  const r = items.map((it, i) => rect(it, dy[i]));
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) assert.ok(!overlap(r[i], r[j]), `cards ${i} and ${j} still overlap`);
  for (const x of r) { assert.ok(x.y0 >= 60 - 0.01, 'off the top'); assert.ok(x.y1 <= 420 + 0.01, 'off the bottom'); }
});

test('a card that cannot go down (the bottom edge) goes up instead', () => {
  const dy = spread([{ cx: 100, cy: 380, w: 200, h: 40, fixed: true }, { cx: 100, cy: 395, w: 100, h: 30 }], { top: 0, bottom: 420 });
  assert.ok(dy[1] < 0, 'it went up: ' + dy[1]);
});
