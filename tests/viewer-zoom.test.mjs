// El zoom del visor del Estudio (src/viewer-zoom.js): la imagen cabe entera al abrirla, el zoom mantiene el punto bajo el cursor,
// no pasa de sus límites y el arrastre nunca pierde la imagen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fit, fitted, limits, percent, clampPan, zoomAt, zoomTo, pan, toggle, pinch, wheelFactor, isZoomed, css } from '../src/viewer-zoom.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
// the photos of scripts/estudio-capturas.mjs, in the boxes the viewer has at 1512, 1366, 1024 and 390 px
const PHOTOS = { '4k': [3840, 2160], vertical: [2160, 3840], panoramica: [5040, 2160] };
const BOXES = [[1060, 796], [919, 675], [736, 380], [350, 300], [350, 600]];
const dims = (p, b) => ({ nw: PHOTOS[p][0], nh: PHOTOS[p][1], bw: b[0], bh: b[1] });

test('fit: una foto 4K, 9:16 y 21:9 cabe entera en cada caja, sin deformarse', () => {
  for (const p of Object.keys(PHOTOS)) for (const b of BOXES) {
    const [nw, nh] = PHOTOS[p], f = fit(nw, nh, b[0], b[1]);
    assert.ok(f.w <= b[0] + 1e-9 && f.h <= b[1] + 1e-9, `${p} en ${b}: ${f.w}×${f.h}`);
    near(f.w / f.h, nw / nh, 1e-9);
    assert.ok(Math.abs(f.w - b[0]) < 1e-9 || Math.abs(f.h - b[1]) < 1e-9, 'toca un borde de la caja'); // as big as it can be
  }
  const v = fit(2160, 3840, 1060, 796); near(v.h, 796); near(v.w, 796 * 2160 / 3840); // the 9:16 that used to be cut at 43 %: now the height rules
});

test('fit: una imagen pequeña no se agranda (como object-fit: scale-down)', () => {
  const f = fit(400, 300, 1060, 796); assert.equal(f.k, 1); assert.equal(f.w, 400); assert.equal(f.h, 300);
  assert.deepEqual(fit(0, 0, 100, 100).k, 1); // no picture yet: nothing breaks
});

test('limits: de 1× (ajustada) a 8× del tamaño ajustado, y siempre hasta el 100 % real', () => {
  const d = dims('4k', [1060, 796]), l = limits(d);
  assert.equal(l.min, 1); assert.equal(l.max, 8); near(l.real, 3840 / 1060);
  const huge = { nw: 20000, nh: 10000, bw: 1000, bh: 800 }; assert.equal(limits(huge).max, 20); // 100 % is 20× the fitted size: still reachable
  assert.equal(zoomTo(fitted(), 50, 0, 0, d).scale, 8);
  assert.equal(zoomTo(fitted(), 0.2, 0, 0, d).scale, 1);
});

test('percent: ajustada dice su tamaño real; a 100 % dice 100', () => {
  const d = dims('4k', [1060, 796]);
  assert.equal(percent(fitted(), d), Math.round(1060 / 3840 * 100));
  assert.equal(percent(zoomTo(fitted(), limits(d).real, 0, 0, d), d), 100);
});

test('zoomAt mantiene el punto de la imagen que está bajo el cursor', () => {
  for (const p of Object.keys(PHOTOS)) {
    const d = dims(p, [1060, 796]);
    let s = fitted();
    const px = 120, py = -80; // the cursor, from the box's centre
    const before = { u: (px - s.x) / s.scale, v: (py - s.y) / s.scale };
    s = zoomAt(s, 4, px, py, d); // ×4: the picture overflows the box on both axes, so the pan bound does not pull it back
    const after = { u: (px - s.x) / s.scale, v: (py - s.y) / s.scale };
    near(after.u, before.u, 1e-6); near(after.v, before.v, 1e-6);
  }
});

test('zoomAt de ida y vuelta vuelve al mismo sitio', () => {
  const d = dims('vertical', [1060, 796]);
  const a = zoomAt(fitted(), 3, 50, 40, d), b = zoomAt(a, 2, -30, 10, d), c = zoomAt(b, 1 / 2, -30, 10, d);
  near(c.scale, a.scale); near(c.x, a.x, 1e-6); near(c.y, a.y, 1e-6);
});

test('el arrastre nunca pierde la imagen: sus bordes no entran en la caja', () => {
  const d = dims('panoramica', [919, 675]), f = fit(d.nw, d.nh, d.bw, d.bh);
  let s = zoomTo(fitted(), 4, 0, 0, d);
  s = pan(s, 1e6, -1e6, d);
  const W = f.w * s.scale, H = f.h * s.scale;
  near(s.x, (W - d.bw) / 2); near(s.y, -(H - d.bh) / 2);
  assert.ok(s.x - W / 2 <= -d.bw / 2 + 1e-9 && s.x + W / 2 >= d.bw / 2 - 1e-9); // the box is still full of picture
  // fitted, the picture does not move at all
  assert.deepEqual(pan(fitted(), 300, 300, d), { scale: 1, x: 0, y: 0 });
  // on an axis the zoomed picture does not fill, it stays centred
  const t = pan(zoomTo(fitted(), 1.5, 0, 0, d), 0, 500, d); assert.equal(t.y, 0);
});

test('toggle (doble clic): ajustada ↔ 100 %', () => {
  const d = dims('4k', [1060, 796]);
  const z = toggle(fitted(), 200, 100, d); near(z.scale, 3840 / 1060); assert.ok(isZoomed(z));
  assert.deepEqual(toggle(z, 0, 0, d), fitted());
  const small = { nw: 400, nh: 300, bw: 1060, bh: 796 }; // already at 100 % when fitted: the double click doubles it
  assert.equal(toggle(fitted(), 0, 0, small).scale, 2);
});

test('pinch: separar los dedos acerca alrededor de su punto medio; juntarlos no baja de ajustada', () => {
  const d = dims('vertical', [350, 600]);
  const start = { s: fitted(), p1: { x: -40, y: 0 }, p2: { x: 40, y: 0 } };
  const s = pinch(start, { x: -120, y: 0 }, { x: 120, y: 0 }, d); near(s.scale, 3);
  const f = fit(d.nw, d.nh, d.bw, d.bh); assert.ok(f.h * s.scale > d.bh); near(s.y, 0); // the midpoint (the centre) stays the centre
  assert.equal(pinch(start, { x: -5, y: 0 }, { x: 5, y: 0 }, d).scale, 1);
  // moving both fingers together pans (bounded)
  const z = zoomTo(fitted(), 3, 0, 0, d), p = pinch({ s: z, p1: { x: -40, y: 0 }, p2: { x: 40, y: 0 } }, { x: -40, y: 30 }, { x: 40, y: 30 }, d);
  near(p.scale, 3); near(p.y, 30);
});

test('wheelFactor: hacia arriba acerca, hacia abajo aleja, y un golpe enorme no se dispara', () => {
  assert.ok(wheelFactor(-100) > 1 && wheelFactor(100) < 1);
  near(wheelFactor(100) * wheelFactor(-100), 1);
  near(wheelFactor(1e5), wheelFactor(400));
});

test('clampPan corrige un estado fuera de límites, y css lo escribe', () => {
  const d = dims('4k', [736, 380]);
  const s = clampPan({ scale: 99, x: 1e5, y: -1e5 }, d); assert.equal(s.scale, 8);
  assert.match(css(s), /^translate\(-?\d+\.\d{2}px, -?\d+\.\d{2}px\) scale\(8\.0000\)$/);
});
