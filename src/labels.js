// Auditoría 1 oct 2026 (A11-16): the department cards never sit on each other. At 390 px the Brain + Dimitri tag covered
// «VENTAS 6», and «CORREOS» touched «ENTREGAS». Each card keeps its x; one that overlaps a card already placed moves up or
// down (whichever is shorter and still on screen) by just enough. The centre tag (fixed) is placed first and never moves.
// items: [{ cx, cy, w, h, fixed }] (visual centre and size in px) → the same order, each with the dy to add to its y.
export function spread(items, { top = 0, bottom = Infinity, gap = 4 } = {}) {
  const out = items.map(it => ({ ...it, dy: 0 }));
  const order = out.map((it, i) => i).sort((a, b) => (out[b].fixed ? 1 : 0) - (out[a].fixed ? 1 : 0) || out[a].cy - out[b].cy);
  const placed = [];
  const hit = (a, b) => Math.abs(a.cx - b.cx) * 2 < a.w + b.w + gap * 2 && Math.abs(a.cy + a.dy - (b.cy + b.dy)) * 2 < a.h + b.h + gap * 2;
  for (const i of order) {
    const it = out[i];
    if (!it.fixed) {
      for (let pass = 0; pass < 6; pass++) {
        const other = placed.find(p => hit(it, p)); if (!other) break;
        const oy = other.cy + other.dy, half = (it.h + other.h) / 2 + gap;
        const down = oy + half - (it.cy + it.dy), up = oy - half - (it.cy + it.dy); // the moves that clear it, below and above
        const canDown = it.cy + it.dy + down + it.h / 2 <= bottom, canUp = it.cy + it.dy + up - it.h / 2 >= top;
        const mv = canDown && canUp ? (Math.abs(down) <= Math.abs(up) ? down : up) : canDown ? down : canUp ? up : (Math.abs(down) <= Math.abs(up) ? down : up);
        it.dy += mv;
      }
    }
    placed.push(it);
  }
  return out.map(({ dy }) => dy);
}
