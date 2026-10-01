// Agents Office — the zoom of the Estudio's viewer, as plain arithmetic (no DOM): the page measures, this decides, the page paints
// `transform: translate(x px, y px) scale(scale)` on the picture (transform-origin: its centre). Tested in tests/viewer-zoom.test.mjs.
// V4.9 (30 Sep 2026, the owner: «las fotos grandes no caben en el visor»): the picture always fits first; then Ajustar / 100 %,
// the wheel and a pinch around the pointer, dragging to move, a double click to switch between the two.
//   dims  = { nw, nh, bw, bh }  the picture's own size (px) and the box it is drawn in (px)
//   state = { scale, x, y }     scale 1 = fitted; x, y = how far the picture's centre sits from the box's centre (px on screen)
// A point (px, py) is always measured from the box's centre, in screen px.

/** How the picture is drawn when it fits: never cut, never blown up past its own size (like object-fit: scale-down). */
export function fit(nw, nh, bw, bh) {
  if (!(nw > 0 && nh > 0 && bw > 0 && bh > 0)) return { k: 1, w: Math.max(0, nw || 0), h: Math.max(0, nh || 0) };
  const k = Math.min(1, bw / nw, bh / nh);
  return { k, w: nw * k, h: nh * k };
}
export const fitted = () => ({ scale: 1, x: 0, y: 0 });
/** The zoom it can reach: 1× (fitted) up to 8× the fitted size — and always as far as 100 % of the real picture, if that is further. */
export function limits(d) { const { k } = fit(d.nw, d.nh, d.bw, d.bh); return { min: 1, max: Math.max(8, 1 / k), real: 1 / k }; }
/** The scale at which one pixel of the picture is one pixel of the screen (100 %). */
export const realScale = d => limits(d).real;
/** What the page prints: the size of the picture on screen as a % of its real size. */
export function percent(s, d) { return Math.round(fit(d.nw, d.nh, d.bw, d.bh).k * s.scale * 100); }
export const isZoomed = s => s.scale > 1.001;
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));

/** Keeps the picture in sight: smaller than the box → centred on that axis; larger → its edges never come inside the box. */
export function clampPan(s, d) {
  const { min, max } = limits(d), scale = clampN(s.scale, min, max), f = fit(d.nw, d.nh, d.bw, d.bh);
  const W = f.w * scale, H = f.h * scale, lx = Math.max(0, (W - d.bw) / 2), ly = Math.max(0, (H - d.bh) / 2);
  return { scale, x: lx ? clampN(s.x, -lx, lx) : 0, y: ly ? clampN(s.y, -ly, ly) : 0 };
}
/** Zoom by `factor` keeping the point (px, py) of the picture under the pointer where it is. */
export function zoomAt(s, factor, px, py, d) { return zoomTo(s, s.scale * factor, px, py, d); }
/** Zoom to an absolute scale around (px, py). */
export function zoomTo(s, scale, px = 0, py = 0, d) {
  const { min, max } = limits(d), next = clampN(scale, min, max), r = next / s.scale;
  return clampPan({ scale: next, x: px - (px - s.x) * r, y: py - (py - s.y) * r }, d);
}
/** Drag: the picture follows the pointer, bounded. */
export function pan(s, dx, dy, d) { return clampPan({ scale: s.scale, x: s.x + dx, y: s.y + dy }, d); }
/** Double click (and the «100 %» button with a point): zoomed → fitted; fitted → 100 % around the point (2× if 100 % is the fitted size). */
export function toggle(s, px, py, d) {
  if (isZoomed(s)) return fitted();
  const real = realScale(d);
  return zoomTo(s, real > 1.001 ? real : 2, px, py, d);
}
/** A pinch: `start` is { s, p1, p2 } when the second finger lands; the picture point under the first midpoint follows the midpoint, and the scale follows the spread. */
export function pinch(start, p1, p2, d) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const m0 = { x: (start.p1.x + start.p2.x) / 2, y: (start.p1.y + start.p2.y) / 2 }, m1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const { min, max } = limits(d), s0 = start.s, scale = clampN(s0.scale * dist(p1, p2) / dist(start.p1, start.p2), min, max);
  const ux = (m0.x - s0.x) / s0.scale, uy = (m0.y - s0.y) / s0.scale; // the picture point (unscaled, from its centre) that was under the midpoint
  return clampPan({ scale, x: m1.x - ux * scale, y: m1.y - uy * scale }, d);
}
/** The wheel: one notch (deltaY ≈ 100) is about ×1.16; a trackpad's small deltas zoom smoothly. */
export const wheelFactor = deltaY => Math.exp(-clampN(deltaY, -400, 400) * 0.0015);
export const css = s => `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) scale(${s.scale.toFixed(4)})`;
