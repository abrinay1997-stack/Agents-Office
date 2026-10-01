// Agents Office V4.6 (27 Sep 2026) — the Brain as a 3D neural network (the owner: «que pareciera una red neuronal y que rotara…
// como si fuese un cerebro conectado, muchas neuronas conectadas entre sí, de forma coherente»).
// Every note is a neuron, every [[wiki link]] a synapse. The shape is coherent, not decoration: the notes settle inside a brain
// (two hemispheres and the fissure between them), each FOLDER is a region of its own (a lobe), linked notes pull together and
// every note keeps its room. It turns slowly on its own, stops while you touch it, and a signal runs along a synapse when an
// agent reads a note. Picking is done on the screen with a tolerance of a finger (the 2D canvas missed by the 52 px of the bar).
//   initBrain3D(ctx) → { setData, setFocus, refresh, fly, reset, setInsets, pulseFrom, spin, zoomBy, pickAt, start, stop, resize, labels }
//   ctx: host (the element the canvas goes in) · colOf(group) · visible(n) · onPick(n) · onHover(n, x, y) · labelsFor() → [nodes]
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const R = { x: 1.08, y: 0.86, z: 1.34 }; // the brain's half sizes: wide, tall, long (front to back)
const POS_KEY = 'ao.bv.pos', LAYOUT_V = 2; // where each note sits, remembered in this browser; a new layout recipe bumps the version
const REDUCED = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }; // (node:test imports layout3D without a page)

/* ---------- a stable random per note, so the brain keeps its shape between openings ---------- */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- the layout: regions (lobes) on the brain, springs for the links, room for every note, the fissure ---------- */
// The lobes come from the notes themselves: the folders that link to each other most share a hemisphere and sit side by side
// (a balanced cut of the folder×folder links), each hemisphere laid from the front, over the top, to the back.
function regionAnchors(nodes, links) {
  const size = new Map(); for (const n of nodes) size.set(n.g, (size.get(n.g) || 0) + 1);
  const groups = [...size.keys()].sort((a, b) => size.get(b) - size.get(a) || a.localeCompare(b));
  const pair = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a), aff = new Map(), A = (a, b) => aff.get(pair(a, b)) || 0;
  for (const [i, j] of links) { const a = nodes[i]?.g, b = nodes[j]?.g; if (!a || !b || a === b) continue; aff.set(pair(a, b), A(a, b) + 1); }
  const side = { '-1': [], '1': [] }, load = { '-1': 0, '1': 0 }, total = nodes.length || 1;
  for (const g of groups) { // each folder to the hemisphere it is most linked with, the halves kept balanced
    const score = s => side[s].reduce((t, h) => t + A(g, h), 0) - 6 * (load[s] - load[-s]) / total;
    const s = score(-1) > score(1) || (score(-1) === score(1) && load[-1] <= load[1]) ? -1 : 1;
    side[s].push(g); load[s] += size.get(g);
  }
  const out = new Map();
  for (const s of [-1, 1]) {
    const l = side[s]; if (!l.length) continue;
    const chain = [l[0]], left = new Set(l.slice(1)); // a chain: the next lobe is the one most linked to the last one placed
    while (left.size) { const last = chain[chain.length - 1]; let best = null, bs = -1; for (const g of left) { const v = A(last, g) * 100 + size.get(g); if (v > bs) { bs = v; best = g; } } chain.push(best); left.delete(best); }
    chain.forEach((g, k) => {
      const th = Math.PI * (k + 0.5) / chain.length; // front → top → back
      const dx = 0.62, dy = Math.sin(th) * 0.72 - 0.12, dz = Math.cos(th) * 0.95, m = Math.hypot(dx, dy, dz);
      out.set(g, [s * dx / m, dy / m, dz / m]);
    });
  }
  return out;
}
/** Positions for the notes (Float32Array, 3 per note). prev: Map id → [x,y,z] keeps the notes that were already there: only
 *  the new notes and their neighbours move (a note an agent writes no longer shakes the whole brain). */
export function layout3D(nodes, links, prev = new Map(), soft = []) { // soft: mentions — weak springs (a third of a link)
  const N = nodes.length, P = new Float32Array(N * 3), V = new Float32Array(N * 3);
  const dirs = regionAnchors(nodes, links);
  const adj = nodes.map(() => []); for (const [a, b] of links) { if (adj[a] && adj[b]) { adj[a].push(b); adj[b].push(a); } }
  const deg = nodes.map(n => n.d || 0), maxD = Math.max(1, ...deg);
  // where a note wants to be: its lobe's direction, deeper the more it connects — the hubs (an index, a map of contents) sit
  // near the middle, the details out towards the cortex. Coherent, like a brain: what joins everything is central.
  const T = new Float32Array(N * 3);
  nodes.forEach((n, i) => { const d = dirs.get(n.g) || [1, 0, 0], rr = 0.98 - 0.66 * Math.min(1, Math.log1p(deg[i]) / Math.log1p(maxD)); T[i * 3] = d[0] * R.x * rr; T[i * 3 + 1] = d[1] * R.y * rr; T[i * 3 + 2] = d[2] * R.z * rr; });
  const move = new Uint8Array(N); let fresh = 0;
  nodes.forEach((n, i) => {
    const p = prev.get(n.id);
    if (p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])) { P[i * 3] = p[0]; P[i * 3 + 1] = p[1]; P[i * 3 + 2] = p[2]; return; } // a place that is not a number is no place: laid out again
    fresh++; move[i] = 1; for (const j of adj[i]) move[j] = 1; // a new note, and the notes it touches, find their place
    const r = rng(hash(n.id)), nb = adj[i].map(j => prev.get(nodes[j].id)).find(Boolean); // born beside a neighbour it already has
    const b = nb || [T[i * 3], T[i * 3 + 1], T[i * 3 + 2]];
    P[i * 3] = b[0] + (r() - 0.5) * 0.24; P[i * 3 + 1] = b[1] + (r() - 0.5) * 0.24; P[i * 3 + 2] = b[2] + (r() - 0.5) * 0.24;
  });
  if (!prev.size) move.fill(1);
  const iters = !fresh ? 0 : prev.size ? 120 : N > 800 ? 200 : 300;
  // the room each note keeps shrinks as the brain fills (a fixed cell made 2,000 notes take seconds)
  const cell = Math.min(0.36, 1.6 * Math.cbrt((4 / 3) * Math.PI * R.x * R.y * R.z / Math.max(1, N))), kr = 0.0036 * (cell / 0.36) ** 2, cell2 = cell * cell;
  const G = new Map(), K = (x, y, z) => ((Math.floor(x / cell) + 64) * 128 + (Math.floor(y / cell) + 64)) * 128 + (Math.floor(z / cell) + 64);
  for (let it = 0; it < iters; it++) {
    const step = 0.06 * (1 - it / iters) + 0.004;
    V.fill(0); G.clear();
    for (let i = 0; i < N; i++) { const k = K(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); const l = G.get(k); if (l) l.push(i); else G.set(k, [i]); }
    for (let i = 0; i < N; i++) { // room: a note pushes away the ones in its own and the next cells
      if (!move[i]) continue;
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], cx = Math.floor(x / cell) + 64, cy = Math.floor(y / cell) + 64, cz = Math.floor(z / cell) + 64;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const l = G.get(((cx + dx) * 128 + cy + dy) * 128 + cz + dz); if (!l) continue;
        for (const j of l) { if (j === i) continue;
          let ex = x - P[j * 3], ey = y - P[j * 3 + 1], ez = z - P[j * 3 + 2], d2 = ex * ex + ey * ey + ez * ez;
          if (d2 > cell2) continue; if (d2 < 1e-6) { ex = 0.01 * ((i % 3) - 1); ey = 0.01; ez = 0.01 * ((j % 3) - 1); d2 = 3e-4; }
          const f = kr / d2, d = Math.sqrt(d2); V[i * 3] += ex / d * f; V[i * 3 + 1] += ey / d * f; V[i * 3 + 2] += ez / d * f;
        }
      }
    }
    for (let li = 0; li < links.length + soft.length; li++) { // synapses: linked notes pull together, to a rest length
      const [a, b] = li < links.length ? links[li] : soft[li - links.length]; if (a == null || b == null || a >= N || b >= N) continue;
      if (!move[a] && !move[b]) continue;
      const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2], d = Math.hypot(ex, ey, ez) || 1e-3;
      const f = (d - 0.3) * 0.03 / (1 + Math.max(deg[a], deg[b]) / 4) * (li < links.length ? 1 : 0.35); // a hub's many links do not crush the brain into one ball
      V[a * 3] += ex / d * f; V[a * 3 + 1] += ey / d * f; V[a * 3 + 2] += ez / d * f;
      V[b * 3] -= ex / d * f; V[b * 3 + 1] -= ey / d * f; V[b * 3 + 2] -= ez / d * f;
    }
    for (let i = 0; i < N; i++) {
      if (!move[i]) continue;
      const o = i * 3, side = Math.sign((dirs.get(nodes[i].g) || [1])[0]) || 1;
      V[o] += (T[o] - P[o]) * 0.03; V[o + 1] += (T[o + 1] - P[o + 1]) * 0.03; V[o + 2] += (T[o + 2] - P[o + 2]) * 0.03; // its lobe, at its depth
      const q = Math.hypot(P[o] / R.x, P[o + 1] / R.y, P[o + 2] / R.z); // inside the skull
      if (q > 0.97) { const s = (q - 0.97) * 0.5; V[o] -= P[o] * s; V[o + 1] -= P[o + 1] * s; V[o + 2] -= P[o + 2] * s; }
      if (P[o] * side < 0.07) V[o] += side * (0.07 - P[o] * side) * 0.25; // the fissure between the hemispheres
      const vv = Math.hypot(V[o], V[o + 1], V[o + 2]), s = vv > step ? step / vv : 1;
      P[o] += V[o] * s; P[o + 1] += V[o + 1] * s; P[o + 2] += V[o + 2] * s;
    }
  }
  return P;
}

/* ---------- a round, soft sprite for the glow and the signals ---------- */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,.55)'); g.addColorStop(0.55, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function spriteMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float size; attribute vec4 tint; varying vec4 vT; uniform float uScale; void main(){ vT = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec4 vT; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vT.rgb, t.a * vT.a); }',
  });
}

export function initBrain3D(ctx) {
  const { host, colOf } = ctx;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const canvas = renderer.domElement; canvas.id = 'bvCv'; canvas.setAttribute('aria-hidden', 'true'); canvas.tabIndex = -1;
  host.prepend(canvas);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x0F1117, 0.16);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 60); camera.position.set(1.95, 0.8, 2.75);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, zoomSpeed: 0.8, panSpeed: 0.7, minDistance: 0.35, maxDistance: 9, minPolarAngle: 0.3, maxPolarAngle: Math.PI - 0.3, screenSpacePanning: true, autoRotate: !REDUCED.matches, autoRotateSpeed: 0.55 }); // never upside down
  controls.target.set(0, 0, 0);
  const brain = new THREE.Group(); scene.add(brain);
  const tex = glowTexture();

  // the skull's faint cortex: dots on the brain's surface, folded like gyri, with the fissure left open
  {
    const r = rng(7), pts = [], cols = [];
    for (let i = 0; i < 1500; i++) {
      const u = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); let x = s * Math.cos(t), y = u, z = s * Math.sin(t);
      if (Math.abs(x) < 0.06 && y > -0.35) continue; // the fissure
      const fold = 1 + 0.035 * Math.sin(9 * y + 5 * z) * Math.sin(7 * z - 3 * x); // gyri
      if (y < -0.55) y *= 0.8; // flatter underneath
      pts.push(x * R.x * fold, y * R.y * fold, z * R.z * fold); cols.push(0.55, 0.62, 0.9, 0.22);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('tint', new THREE.Float32BufferAttribute(cols, 4));
    g.setAttribute('size', new THREE.Float32BufferAttribute(new Array(pts.length / 3).fill(0.018), 1));
    const m = spriteMaterial(tex); m.userData.shell = true; brain.add(new THREE.Points(g, m));
  }

  let nodes = [], ids = [], links = [], P = new Float32Array(0), posById = new Map(), visibleMask = [], focus = null, sel = null, hi = null, match = null;
  let cores = null, glow = null, lines = null, hiLines = null, softLines = null, ment = [], learned = [], showMent = true, showLearn = true;
  const mentC = new THREE.Color(0x8FA8FF), goldC = new THREE.Color(0xFFC46B);
  const coreGeo = new THREE.IcosahedronGeometry(1, 3), coreMat = new THREE.MeshPhongMaterial({ shininess: 70, specular: 0x444a5a, fog: true });
  scene.add(new THREE.AmbientLight(0xffffff, 0.62)); const keyL = new THREE.DirectionalLight(0xffffff, 1.35); camera.add(keyL); keyL.position.set(-1, 1.2, 0.4); scene.add(camera); // lit from the viewer's side: every sphere shows its volume
  const tmpM = new THREE.Matrix4(), tmpC = new THREE.Color(), dimC = new THREE.Color(0x2A2F3E), white = new THREE.Color(0xFFFFFF), green = new THREE.Color(0x3DDC97);
  const radius = n => Math.min(0.056, 0.013 + 0.0062 * Math.sqrt(n.d || 0));

  function build() {
    for (const o of [cores, glow, lines, hiLines, softLines]) if (o) { brain.remove(o); o.geometry !== coreGeo && o.geometry.dispose(); }
    const N = nodes.length;
    cores = new THREE.InstancedMesh(coreGeo, coreMat, Math.max(1, N)); cores.count = N; cores.frustumCulled = false; brain.add(cores);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(P, 3));
    gg.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(N * 4), 4)); gg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1));
    glow = new THREE.Points(gg, spriteMaterial(tex)); glow.frustumCulled = false; brain.add(glow);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(links.length * 6), 3)); lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(links.length * 8), 4));
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true })); lines.frustumCulled = false; brain.add(lines);
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(6, links.length * 6)), 3));
    hiLines = new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); hiLines.frustumCulled = false; brain.add(hiLines);
    // the other synapses: mentions (a note names another without linking it — cool and faint) and the links learned from
    // approved work (warm gold, brighter the stronger they are)
    const sn = ment.length + learned.length, sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(6, sn * 6)), 3)); sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Math.max(8, sn * 8)), 4));
    softLines = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true })); softLines.frustumCulled = false; brain.add(softLines);
    paint();
  }
  // colours, sizes and what shows: called when the data, the filters, the search or the focus change (not every frame)
  function paint() {
    if (!cores) return;
    const N = nodes.length, tint = glow.geometry.attributes.tint, size = glow.geometry.attributes.size;
    visibleMask = nodes.map(n => ctx.visible(n));
    for (let i = 0; i < N; i++) {
      const n = nodes[i], vis = visibleMask[i], lit = !hi || hi.has(i), hit = !match || match.has(i);
      const base = tmpC.set(colOf(n.g)); if (n.fresh) base.lerp(green, 0.5);
      const on = lit && hit, r = vis ? radius(n) * (sel === n ? 1.5 : focus === n ? 1.3 : 1) : 0;
      tmpM.makeScale(r, r, r).setPosition(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); cores.setMatrixAt(i, tmpM);
      cores.setColorAt(i, sel === n ? white : on ? base : tmpC.clone().lerp(dimC, 0.82));
      const lw = n.w == null ? 1 : 0.7 + 0.6 * n.w; // what the Brain learned: a note cited in approved work glows a little more
      const c = on ? base : dimC; tint.setXYZW(i, c.r, c.g, c.b, !vis ? 0 : on ? Math.min(1, (sel === n ? 0.95 : 0.55) * lw) : 0.1);
      size.setX(i, !vis ? 0 : radius(n) * lw * (on ? (sel === n ? 7.5 : focus === n ? 6.5 : 4.6) : 2.6));
    }
    cores.instanceMatrix.needsUpdate = true; if (cores.instanceColor) cores.instanceColor.needsUpdate = true; tint.needsUpdate = true; size.needsUpdate = true;
    // synapses: only between two notes that show; the focus's own light up on their own layer
    const pos = lines.geometry.attributes.position, col = lines.geometry.attributes.color, hpos = hiLines.geometry.attributes.position;
    let k = 0, h = 0;
    for (const [a, b] of links) {
      if (!visibleMask[a] || !visibleMask[b]) continue;
      pos.setXYZ(k * 2, P[a * 3], P[a * 3 + 1], P[a * 3 + 2]); pos.setXYZ(k * 2 + 1, P[b * 3], P[b * 3 + 1], P[b * 3 + 2]);
      const on = (!hi || (hi.has(a) && hi.has(b))) && (!match || (match.has(a) && match.has(b))), al = hi || match ? (on ? 0.6 : 0.035) : 0.26;
      const ca = tmpC.set(colOf(nodes[a].g)); col.setXYZW(k * 2, ca.r, ca.g, ca.b, al);
      const cb = tmpC.set(colOf(nodes[b].g)); col.setXYZW(k * 2 + 1, cb.r, cb.g, cb.b, al);
      if (focus && (a === focus.i || b === focus.i)) { hpos.setXYZ(h * 2, P[a * 3], P[a * 3 + 1], P[a * 3 + 2]); hpos.setXYZ(h * 2 + 1, P[b * 3], P[b * 3 + 1], P[b * 3 + 2]); h++; }
      k++;
    }
    lines.geometry.setDrawRange(0, k * 2); pos.needsUpdate = true; col.needsUpdate = true;
    const sp = softLines.geometry.attributes.position, sc = softLines.geometry.attributes.color; let m = 0;
    const soft = (a, b, c, al) => { if (!visibleMask[a] || !visibleMask[b]) return; const on = (!hi || (hi.has(a) && hi.has(b))) && (!match || (match.has(a) && match.has(b))), x = hi || match ? (on ? al * 2.2 : 0.02) : al;
      sp.setXYZ(m * 2, P[a * 3], P[a * 3 + 1], P[a * 3 + 2]); sp.setXYZ(m * 2 + 1, P[b * 3], P[b * 3 + 1], P[b * 3 + 2]); sc.setXYZW(m * 2, c.r, c.g, c.b, x); sc.setXYZW(m * 2 + 1, c.r, c.g, c.b, x); m++; };
    if (showMent) for (const [a, b] of ment) soft(a, b, mentC, 0.12);
    if (showLearn) for (const [a, b, w] of learned) soft(a, b, goldC, 0.18 + 0.5 * w);
    softLines.geometry.setDrawRange(0, m * 2); sp.needsUpdate = true; sc.needsUpdate = true;
    hiLines.geometry.setDrawRange(0, h * 2); hpos.needsUpdate = true;
  }

  /* ---------- signals running along the synapses ---------- */
  const MAXP = 90, pulses = [], pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3)); pg.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(MAXP * 4), 4)); pg.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MAXP), 1));
  const pulsePts = new THREE.Points(pg, spriteMaterial(tex)); pulsePts.frustumCulled = false; brain.add(pulsePts);
  function spawn(a, b, strong) { if (pulses.length >= MAXP) pulses.shift(); pulses.push({ a, b, t: 0, v: strong ? 1.1 : 0.55 + Math.random() * 0.4, strong }); }
  let ambientAt = 0;
  const shown = ([a, b]) => visibleMask[a] && visibleMask[b];
  function tickPulses(dt, now) {
    if (!REDUCED.matches && links.length && now > ambientAt) {
      const f = focus, recent = ctx.recent ? ctx.recent() : [];
      if (f) { ambientAt = now + 420; const own = links.filter(l => (l[0] === f.i || l[1] === f.i) && shown(l)); const l = own[(Math.random() * own.length) | 0]; if (l) spawn(f.i, l[0] === f.i ? l[1] : l[0]); } // the focused note talks to its neighbours
      else if (recent.length) { ambientAt = now + 700 + Math.random() * 600; const i = recent[(Math.random() * recent.length) | 0], own = links.filter(l => (l[0] === i || l[1] === i) && shown(l)); const l = own[(Math.random() * own.length) | 0]; if (l) spawn(i, l[0] === i ? l[1] : l[0]); } // what the agents used today
      else { ambientAt = now + 1200 + Math.random() * 900; const l = links[(Math.random() * links.length) | 0]; if (l && shown(l)) spawn(l[0], l[1]); } // a rare spark: the brain is alive
    }
    const pos = pg.attributes.position, tint = pg.attributes.tint, size = pg.attributes.size;
    for (let i = pulses.length - 1; i >= 0; i--) { pulses[i].t += dt * pulses[i].v; if (pulses[i].t >= 1) pulses.splice(i, 1); }
    for (let i = 0; i < MAXP; i++) {
      const p = pulses[i]; if (!p) { size.setX(i, 0); continue; }
      const { a, b, t } = p, e = t * t * (3 - 2 * t);
      pos.setXYZ(i, P[a * 3] + (P[b * 3] - P[a * 3]) * e, P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * e, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * e);
      const c = tmpC.set(colOf(nodes[a].g)).lerp(white, p.strong ? 0.7 : 0.45); tint.setXYZW(i, c.r, c.g, c.b, Math.sin(Math.PI * t) * (p.strong ? 1 : 0.7));
      size.setX(i, p.strong ? 0.16 : 0.09);
    }
    pos.needsUpdate = true; tint.needsUpdate = true; size.needsUpdate = true;
  }

  /* ---------- the camera: turns by itself, stops while you touch it; a note pressed comes to the centre ---------- */
  let W = 1, H = 1, insetL = 0, insetR = 0, insetB = 0, idleAt = 0, flyTw = null, spinOn = !REDUCED.matches;
  function resize() {
    W = host.clientWidth || 1; H = host.clientHeight || 1; renderer.setSize(W, H, false); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    camera.aspect = W / H; applyInsets();
    const s = H * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    scene.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.uScale) o.material.uniforms.uScale.value = s; });
  }
  function applyInsets() { // the filters on the left and the reader on the right: the brain sits in the room between them
    const off = (insetR - insetL) / 2, offY = insetB / 2; // a sheet at the bottom (a phone): the brain rises into the room above it
    if (off || offY) camera.setViewOffset(W, H, off, offY, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function setInsets(l, r, b = 0) { if (l === insetL && r === insetR && b === insetB) return; insetL = l; insetR = r; insetB = b; applyInsets(); }
  controls.addEventListener('start', () => { controls.autoRotate = false; idleAt = Infinity; flyTw = null; });
  controls.addEventListener('end', () => { idleAt = performance.now() + 5000; });
  function fly(n, dist = 2.1) { // the note to the centre, from the side you are already looking from
    const i = n.i, to = new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(brain.matrixWorld);
    const dir = camera.position.clone().sub(controls.target).normalize();
    flyTw = { t0: performance.now(), d: REDUCED.matches ? 1 : 750, fT: controls.target.clone(), tT: to, fP: camera.position.clone(), tP: to.clone().add(dir.multiplyScalar(dist)) };
    controls.autoRotate = false; idleAt = Infinity;
  }
  function reset() { flyTw = { t0: performance.now(), d: REDUCED.matches ? 1 : 750, fT: controls.target.clone(), tT: new THREE.Vector3(), fP: camera.position.clone(), tP: new THREE.Vector3(1.95, 0.8, 2.75) }; idleAt = performance.now() + 900; }
  function zoomBy(f) { const d = camera.position.clone().sub(controls.target); d.multiplyScalar(f); if (d.length() > controls.minDistance && d.length() < controls.maxDistance) camera.position.copy(controls.target).add(d); idleAt = performance.now() + 5000; controls.autoRotate = false; }
  const sph = new THREE.Spherical();
  function rotateBy(dTheta, dPhi) { // the arrows turn the brain; never past the poles
    const off = camera.position.clone().sub(controls.target); sph.setFromVector3(off);
    sph.theta += dTheta; sph.phi = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle, sph.phi + dPhi));
    camera.position.copy(controls.target).add(off.setFromSpherical(sph)); controls.autoRotate = false; idleAt = performance.now() + 5000;
  }
  function spin(on) { spinOn = on === undefined ? !spinOn : !!on; controls.autoRotate = spinOn && !sel; idleAt = spinOn ? performance.now() + 400 : Infinity; return spinOn; }

  /* ---------- where every note is on the screen (canvas pixels), for the labels and the picking ---------- */
  let SX = new Float32Array(0), SY = new Float32Array(0), SZ = new Float32Array(0), screenAt = -1;
  const v = new THREE.Vector3();
  function project() {
    const N = nodes.length; if (SX.length !== N) { SX = new Float32Array(N); SY = new Float32Array(N); SZ = new Float32Array(N); }
    brain.updateMatrixWorld();
    for (let i = 0; i < N; i++) { v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(brain.matrixWorld).project(camera); SX[i] = (v.x * 0.5 + 0.5) * W; SY[i] = (-v.y * 0.5 + 0.5) * H; SZ[i] = v.z; }
    screenAt = frame;
  }
  /** The note under (x, y) — canvas pixels, not the page's: the view sits under the top bar. Near and big notes win a tie. */
  function pickAt(x, y, reach = 16) {
    if (screenAt !== frame) project();
    let best = null, bs = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (!visibleMask[i] || SZ[i] > 1) continue;
      const px = radius(nodes[i]) * (H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) / Math.max(0.05, camera.position.distanceTo(v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])));
      const d = Math.hypot(SX[i] - x, SY[i] - y) - px; if (d > reach) continue;
      const s = d + SZ[i] * 6; if (s < bs) { bs = s; best = nodes[i]; }
    }
    return best;
  }

  /* ---------- labels: HTML, crisp, and pressable (a name is a far bigger target than a dot) ---------- */
  const labelLayer = document.createElement('div'); labelLayer.className = 'bv3-labels'; host.appendChild(labelLayer);
  const pool = [];
  const placed = [];
  function drawLabels() {
    const want = ctx.labelsFor ? ctx.labelsFor() : [];
    while (pool.length < want.length) { const b = document.createElement('button'); b.type = 'button'; b.className = 'bv3-lab'; b.tabIndex = -1; labelLayer.appendChild(b); pool.push(b); }
    placed.length = 0;
    for (let k = 0; k < pool.length; k++) {
      const b = pool[k], n = want[k];
      let skip = !n || !visibleMask[n.i] || SZ[n.i] > 1;
      if (!skip) { // a label that would sit on another is left out; the first in the list (the focus, its neighbours) win
        const x0 = SX[n.i] + 9, y0 = SY[n.i] - 9, w = Math.min(240, 26 + n.id.length * 6.6), hgt = 24, must = n === sel || n === focus;
        if (!must && placed.some(r => x0 < r[2] && x0 + w > r[0] && y0 < r[3] && y0 + hgt > r[1])) skip = true; else placed.push([x0, y0, x0 + w, y0 + hgt]);
      }
      if (skip) { if (!b.hidden) b.hidden = true; continue; }
      if (b.hidden) b.hidden = false;
      if (b._n !== n) { b._n = n; b.dataset.i = n.i; b.textContent = n.id; b.style.setProperty('--c', colOf(n.g)); }
      const near = Math.max(0.35, Math.min(1, 1.6 - (SZ[n.i] - 0.9) * 12)); // far labels fade
      b.classList.toggle('sel', n === sel); b.classList.toggle('foc', n === focus);
      b.style.transform = `translate(${Math.round(SX[n.i] + 9)}px, ${Math.round(SY[n.i] - 9)}px)`; b.style.setProperty('--near', (n === sel || n === focus ? 100 : Math.round(near * 100)) + '%'); // Auditoría 1 oct 2026 (A11-21): far labels go greyer, not transparent (opacity took them under 4,5:1)
    }
  }
  labelLayer.addEventListener('click', e => { const b = e.target.closest('.bv3-lab'); if (b && b._n && ctx.onPick) ctx.onPick(b._n); });
  labelLayer.addEventListener('pointerover', e => { const b = e.target.closest('.bv3-lab'); if (b && b._n && ctx.onHover) { const r = b.getBoundingClientRect(), h = host.getBoundingClientRect(); ctx.onHover(b._n, r.left - h.left, r.top - h.top + r.height); } });
  labelLayer.addEventListener('pointerout', e => { if (e.target.closest('.bv3-lab') && ctx.onHover) ctx.onHover(null); });

  /* ---------- the pointer: a press that does not move is a click (a drag turns the brain) ---------- */
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let down = null;
  canvas.addEventListener('pointerdown', e => { const touch = e.pointerType !== 'mouse', [x, y] = local(e); down = { x: e.clientX, y: e.clientY, t: performance.now(), touch, n: pickAt(x, y, touch ? 26 : 16) }; controls.autoRotate = false; idleAt = Infinity; });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const [x, y] = local(e), n = pickAt(x, y, 14); canvas.style.cursor = n ? 'pointer' : 'grab';
    if (ctx.onHover) ctx.onHover(n, x, y);
  });
  canvas.addEventListener('pointerleave', () => { if (ctx.onHover) ctx.onHover(null); });
  canvas.addEventListener('pointerup', e => {
    const d = down; down = null; if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > (d.touch ? 10 : 5) || performance.now() - d.t > 700) return; // it turned the brain
    const [x, y] = local(e), n = pickAt(x, y, d.touch ? 26 : 16) || d.n;
    if (n && ctx.onPick) ctx.onPick(n); else if (!n && ctx.onEmpty) ctx.onEmpty();
    if (!n) idleAt = performance.now() + 5000;
  });
  canvas.addEventListener('dblclick', e => { const [x, y] = local(e); if (!pickAt(x, y, 16)) reset(); });

  /* ---------- the loop: only while the Brain is open and the tab shows ---------- */
  let raf = 0, last = 0, frame = 0, running = false;
  function loop(now) {
    raf = requestAnimationFrame(loop); if (document.hidden) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; frame++;
    if (flyTw) { const k = Math.min(1, Math.max(0, (now - flyTw.t0) / flyTw.d)), e = 1 - Math.pow(1 - k, 3); controls.target.lerpVectors(flyTw.fT, flyTw.tT, e); camera.position.lerpVectors(flyTw.fP, flyTw.tP, e); if (k >= 1) flyTw = null; }
    if (!controls.autoRotate && spinOn && !sel && now > idleAt && !flyTw) controls.autoRotate = true; // it starts turning again once you let go
    controls.update();
    tickPulses(dt, now);
    project(); drawLabels();
    renderer.render(scene, camera);
  }
  function start() { if (running) return; running = true; resize(); last = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  if (window.ResizeObserver) new ResizeObserver(() => { if (running) resize(); }).observe(host);

  return {
    setData(ns, ls, more = {}) { // new graph: the notes that were already there keep their place; more: { extra: mentions, learned: [[a, b, w]] }
      ment = (more.extra || []).filter(([a, b]) => ns[a] && ns[b]); learned = (more.learned || []).filter(([a, b]) => ns[a] && ns[b]);
      let prev = new Map(ids.map((id, i) => [id, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]])); // the ids laid out last time (the page's own list may already hold a newer note)
      if (!prev.size) try { const c = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); if (c && c.v === LAYOUT_V) prev = new Map(Object.entries(c.p)); } catch {} // the last opening's places
      nodes = ns.slice(); ids = nodes.map(n => n.id); links = ls.filter(([a, b]) => ns[a] && ns[b]); /* our own copy: a note the page adds is drawn only once it has a place */ P = layout3D(nodes, links, prev, ment); posById = new Map(nodes.map((n, i) => [n.id, i])); pulses.length = 0; build();
      try { const p = {}; nodes.forEach((n, i) => { p[n.id] = [+P[i * 3].toFixed(3), +P[i * 3 + 1].toFixed(3), +P[i * 3 + 2].toFixed(3)]; }); localStorage.setItem(POS_KEY, JSON.stringify({ v: LAYOUT_V, p })); } catch {}
    },
    setFocus(s, h, m) { sel = s; focus = h || s; match = m; hi = focus ? new Set([focus.i, ...[...links, ...(showMent ? ment : []), ...(showLearn ? learned : [])].filter(([a, b]) => a === focus.i || b === focus.i).map(([a, b]) => (a === focus.i ? b : a))]) : null; if (sel) controls.autoRotate = false; else if (idleAt === Infinity && spinOn) idleAt = performance.now() + 3000; paint(); }, // a card closed: it turns again a moment later
    refresh: paint, fly, reset, setInsets, zoomBy, rotateBy, spin, pickAt, start, stop, resize,
    pulseFrom(i, n = 5) { const out = links.filter(([a, b]) => a === i || b === i).slice(0, n); for (const [a, b] of out) spawn(i, a === i ? b : a, true); },
    setLayers(m, l) { showMent = !!m; showLearn = !!l; paint(); },
    get spinning() { return spinOn; }, get canvas() { return canvas; }, posOf: id => posById.get(id),
  };
}
