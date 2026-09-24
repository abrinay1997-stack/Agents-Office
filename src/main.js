// Agents Office v2 — Three.js isometric office with zoom-driven LOD
// Far: clean pods + agent counts (Image 1 read). Near: diorama with 3D people + holo screens (Image 2 read).
import { initSheet } from './agentsheet.js'; // the agent sheet: edit who an agent is from the office
import { MODEL_KEYS as SHEET_MODELS, modelName as sheetModelName, EFFORT_KEYS as SHEET_EFFORTS } from './models.js';
import { initStudio } from './studio.js'; // the Estudio: images and video, by hand and by the agents
import { modal } from './modal.js'; // V4.1: the page outside an open window is inert
import { initSub } from './sub.js'; // the Subgerente: one chat above the six departments
import { mdToHtml } from './md.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import './i18n.js'; // FASE 1 (20 Sep 2026): sistema i18n central (es por defecto); los textos visibles ya están traducidos directo al español, el wiring total a t() queda para fase 2
import { TOKENS, DEPTS, DEPT_KEYS, AGENTS, LAYOUT, WORKLINES, APPROVAL_ASKS, APPROVAL_BY_AGENT } from './data.js';
import { hasScreens, makeScreen } from './screens.js'; // live screens (14 Sep): no-op without window.SCREENS
import { V1, FILE_GEN, STATS, KPIS, P, rnd, ri, person, money } from './v1data.js';
import { PROFILE, profileRows, profileTickKpi, profileMockup, applyTopbar } from './profile.js';
import {
  PLINTH_H, mat, rbox, makePlinth, makeFloorTitle, makeDesk, makeChair,
  makePerson, posePerson, poseWork, makePlant, makeServerRack, makeMeetingTable, makeWalkway, makeWarnSprite,
} from './builders.js';
import { initMcp } from './mcp.js';
import { loadConnectors } from './connectors.js';
import { initTasks } from './tasks.js';
import { initBrain } from './brain.js';
import { initHero, HERO } from './hero.js';
if (HERO) document.body.classList.add('hero'); // the website hero: no Sahni.ai mark or licence line on top of the page that already carries them // sahni.ai/custom hero mode (16 Sep 2026): opt-in via window.HERO, no-op otherwise
let tasks = null; // V3 task boards — initialised after the rail constants exist
const SERVED = location.protocol.startsWith('http'); // opened as a file = the demo showcase; served = the owner's real office

/* ---------- renderer / scene / camera ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth * devicePixelRatio > 2600 ? 1.5 : 2)); // 4K: antialias on 2× pixels costs more than it shows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.shadowMap.autoUpdate = false; // the shadow pass (2048 VSM + blur over ~700 meshes) is redrawn every 3rd frame, not every frame (see loop)

const scene = new THREE.Scene();

const FR = 42; // frustum half-height at zoom 1
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);
const ISO = new THREE.Vector3(1, 0.92, 1).normalize();
const CAM_DIST = 220;
// V3.2 overview (AJ, 5 Sep late): every dept card sits ON its own pod, over the wiring. With six
// pods the scene is pulled back to 0.86 and shifted down so the EMAILS and DELIVERY cards can
// float above their back rows instead of being shoved out to the screen edges.
// V3.3: the Task Status panel owns the right ~430px at every zoom, so the overview target slides
// along screen-right by half the panel width — the scene sits centred in what is left.
const OVERVIEW = { base: [-9, 0, -9], zoom: 0.8 }; // (-9,-9) shifts the scene straight DOWN the screen, no sideways drift
const SR_ = new THREE.Vector3(1, 0, -1).normalize();
function overviewPos() {
  const pw = (tasks ? tasks.panelWidth() : 400) + 30;
  const ppw = OVERVIEW.zoom * innerHeight / (2 * FR);
  const sh = (pw / 2) / ppw;
  return [OVERVIEW.base[0] + SR_.x * sh, 0, OVERVIEW.base[2] + SR_.z * sh];
}
const view = { target: new THREE.Vector3(...overviewPos()), zoom: OVERVIEW.zoom, arc: 0 };
let tween = null;
const UPV = new THREE.Vector3(0, 1, 0);
const isoWork = new THREE.Vector3();

function applyCamera() {
  const aspect = innerWidth / innerHeight;
  camera.left = -FR * aspect; camera.right = FR * aspect;
  camera.top = FR; camera.bottom = -FR;
  camera.zoom = view.zoom;
  isoWork.copy(ISO);
  if (view.arc) isoWork.applyAxisAngle(UPV, view.arc); // cinematic swing-in, settles back to locked iso
  camera.position.copy(view.target).addScaledVector(isoWork, CAM_DIST);
  camera.lookAt(view.target);
  camera.updateProjectionMatrix();
}

// house easing cubic-bezier(0.2, 0.8, 0.2, 1)
function bezier(t) {
  const cx = 3 * 0.2, bx = 3 * (0.2 - 0.2) - cx, ax = 1 - cx - bx;
  const cy = 3 * 0.8, by = 3 * (1 - 0.8) - cy, ay = 1 - cy - by;
  let u = t;
  for (let i = 0; i < 5; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t;
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
  }
  return ((ay * u + by) * u + cy) * u;
}

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
function flyTo(targetPos, zoom, dur = 800, opts = {}) {
  if (REDUCED.matches) { dur = 1; opts = { ...opts, arc: 0 }; } // «less motion»: cut, don't fly
  tween = {
    t0: performance.now(), dur,
    fromT: view.target.clone(), toT: new THREE.Vector3(...targetPos),
    fromZ: view.zoom, toZ: zoom,
    arc: opts.arc || 0, onDone: opts.onDone,
  };
}
function tickTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.dur);
  const e = bezier(k);
  view.target.lerpVectors(tween.fromT, tween.toT, e);
  view.zoom = tween.fromZ + (tween.toZ - tween.fromZ) * e;
  view.arc = Math.sin(e * Math.PI) * tween.arc;
  if (k >= 1) {
    const cb = tween.onDone;
    view.arc = 0; tween = null;
    if (cb) cb();
  }
}

/* ---------- lights: one warm key top-left + soft fill ---------- */
const hemi = new THREE.HemisphereLight(0xfdfff8, 0xd8d4c8, 0.85);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1dd, 2.2);
key.position.set(-60, 90, 20);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -95; key.shadow.camera.right = 95;
key.shadow.camera.top = 95; key.shadow.camera.bottom = -95;
key.shadow.camera.far = 400;
key.shadow.radius = 7; key.shadow.blurSamples = 12;
key.shadow.bias = -0.0004;
scene.add(key);

// shadow catcher — makes the pods float over the cream page
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.ShadowMaterial({ opacity: 0.13 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -7;
ground.receiveShadow = true;
scene.add(ground);

/* ---------- build the office ---------- */
const hud = document.getElementById('hud');
const clickTargets = [];   // plinth meshes -> dept key
const personTargets = [];  // person meshes -> agent id
const R = {};              // runtime per agent
const deptRT = {};         // runtime per dept
const screenSets = [];

for (const [key_, L] of Object.entries(LAYOUT)) {
  const dept = DEPTS[key_];
  const g = new THREE.Group();
  g.position.set(L.pos[0], 0, L.pos[1]);
  const plinth = makePlinth(L.w, L.d, dept.floor);
  g.add(plinth);
  plinth.traverse(o => { if (o.isMesh) { o.userData.dept = key_; clickTargets.push(o); } });
  plinth.children[0].userData.part = 'plinth'; plinth.children[1].userData.part = 'floor'; plinth.children[1].userData.chip = dept.chip; // dark mode re-tints these

  // no floor titles — the billboards name each department (AJ's call, M2.3)
  scene.add(g);
  deptRT[key_] = { group: g, L };
}

// brain centre (V4.1, 24 Sep 2026): no drawing over the pod any more — the Brain's tag and Dimitri stand
// there alone; reads and writes fire the tag's icon, G opens the full graph (src/brain.js).
let brain;
{
  const bg = deptRT.brain.group;
  brain = initBrain({ esc: (t) => esc(t) });
  const plant = makePlant(); plant.position.set(6.2, 0.12, -5.8); bg.add(plant);
}

/* the thinking sweep (M4, D): as an invisible hand passes each dept's azimuth that dept's
   billboard gets a chip-coloured glow — departments highlighted one at a time. */
const SWEEP_PERIOD = 16000; // ms per full orbit
const DEPT_AZ = {};
for (const k of DEPT_KEYS)
  DEPT_AZ[k] = Math.atan2(LAYOUT[k].pos[1], LAYOUT[k].pos[0]);
function tickSweep(now) {
  // the sweep is overview theatre — it bows out while a dept is focused
  const on = (!focused || focused === 'brain') ? 1 : 1 - focusDim;
  const theta = (now % SWEEP_PERIOD) / SWEEP_PERIOD * Math.PI * 2;
  let domDept = null, domS = 0;
  for (const [k, az] of Object.entries(DEPT_AZ)) {
    const d = Math.atan2(Math.sin(theta - az), Math.cos(theta - az));
    let s = Math.max(0, 1 - Math.abs(d) / 0.7);
    s = s * s * (3 - 2 * s) * on;
    if (s > domS) { domS = s; domDept = k; }
    const b = deptRT[k].badge;
    if (s > 0.55 && !b.classList.contains('sweepglow')) {
      b.style.setProperty('--sw', DEPTS[k].chip);
      b.classList.add('sweepglow');
    } else if (s <= 0.35 && b.classList.contains('sweepglow')) b.classList.remove('sweepglow');
  }
  // (the M4 orbiting comet is retired per AJ — the sweep now shows only as the badge glow
  //  + the brain particles leaning toward the visiting dept's colour)
  return { theta, strength: domS, col: domDept ? DEPTS[domDept].chip : '#FFFFFF' };
}

// walkways dept -> brain
for (const k of DEPT_KEYS) {
  const L = LAYOUT[k];
  const sx = Math.sign(L.pos[0]), sz = Math.sign(L.pos[1]);
  const from = [L.pos[0] - sx * (L.w / 2 - 1), L.pos[1] - sz * (L.d / 2 - 1)];
  const to = [sx * 6.5, sz * 6.5];
  const walk = makeWalkway(from, to);
  walk.userData.dept = k; walk.userData.part = 'walkway';
  scene.add(walk);
  deptRT[k].gate = new THREE.Vector3(from[0], 0, from[1]);
  deptRT[k].brainGate = new THREE.Vector3(to[0], 0, to[1]);
}
// tag remaining brain furnishings (plinth, plant) for the focus-dim pass — these DO go
// dark in galaxy mode, unlike the 'brainCore' nebula tagged above
deptRT.brain.group.traverse(o => { if ((o.isMesh || o.isSprite) && !o.userData.dept) o.userData.dept = 'brain'; });

/* (M5.3 per AJ: the bridge cables are gone — the walkways alone carry the connection;
   the brain↔dept relationship shows through the badge sweep + meetings.) */

/* desks + people per dept */
const COLS = { emails: 2, sales: 2, marketing: 2, ops: 2, fin: 2, delivery: 2 };
for (const a of AGENTS) {
  const dRT = deptRT[a.dept];
  const dept = DEPTS[a.dept];
  const L = dRT.L;
  const cols = COLS[a.dept];
  const gx = (a.grid[0] - (cols - 1) / 2) * 8.6;
  const gz = (a.grid[1] - 1) * 6.4 - 1;
  const base = new THREE.Vector3(L.pos[0] + gx, 0.12, L.pos[1] + gz);

  // whole station rotated 45° so monitor screens face the camera square-on
  const ANG = Math.PI / 4;
  const rot = (v) => v.applyAxisAngle(new THREE.Vector3(0, 1, 0), ANG);

  const station = new THREE.Group();
  station.position.copy(base);
  station.rotation.y = ANG;
  const live = hasScreens() ? makeScreen(a.id, a.name) : null;
  const { group: desk, screenSet } = makeDesk(dept.chip, live);
  station.add(desk);
  screenSets.push({ screenSet, dept: a.dept, live });
  const chair = makeChair();
  chair.position.set(0, 0, 1.75);
  station.add(chair);
  station.traverse(o => { if (o.isMesh) o.userData.dept = a.dept; }); // focus-dim tagging
  scene.add(station);

  const person = makePerson({ hair: a.hair, skin: a.skin, chip: dept.chip, lead: a.lead });
  person.position.copy(base).add(rot(new THREE.Vector3(0, 0, 1.7)));
  person.rotation.y = ANG + Math.PI; // face the monitor
  person.traverse(o => { if (o.isMesh) { o.userData.agentId = a.id; o.userData.dept = a.dept; personTargets.push(o); } });
  scene.add(person);

  const warn = makeWarnSprite();
  warn.visible = false;
  scene.add(warn);

  // name pill (HTML) — clickable, same as clicking the agent
  const pill = document.createElement('div');
  pill.className = 'pill';
  pill.innerHTML = (a.lead ? '<span class="star">★</span>' : '') + a.name;
  pill.addEventListener('click', () => openAgent(a.id, 'chat'));
  // V4.1 (audit 88): a pill is a button for the keyboard too — reachable with Tab inside its department (35 more stops at the overview would bury the rest)
  pill.setAttribute('role', 'button'); pill.tabIndex = -1; pill.setAttribute('aria-label', `${a.name}${a.lead ? ', jefe' : ''}: abrir su chat`);
  pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openAgent(a.id, 'chat'); } });
  hud.appendChild(pill);

  R[a.id] = {
    a, person, warn, pill, seat: person.position.clone(), seatRot: ANG + Math.PI,
    stand: person.position.clone().add(rot(new THREE.Vector3(1.5, 0, 0.15))),
    state: 'working', bob: Math.random() * 10, path: null, pathI: 0, speed: 9.5, ask: null,
    v1: V1.find(x => x.id === a.id), feed: [],
    station, desk, screenSet, // hero mode reaches the monitor and the desk through these
  };
}

/* PERFORMANCE: the furniture never moves, so it is drawn as ONE mesh per department and material instead of ~12 per
   desk (~420 draw calls, twice over with shadows, → ~60). Screens stay their own meshes (each has its live texture);
   people stay separate (they animate). The merged meshes keep userData.dept, so the focus dim still greys a whole
   department. Hero mode moves and scales single desks, so it keeps the unmerged stations. */
if (!HERO) mergeStations();
function mergeStations() {
  const groups = new Map(); // dept|material|shadow → { material, dept, cast, geos: [] }
  const drop = [];
  for (const r of Object.values(R)) {
    r.station.updateMatrixWorld(true);
    r.station.traverse(o => {
      if (!o.isMesh || o.name === 'screen' || Array.isArray(o.material)) return;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.clearGroups(); g.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
      const key = `${r.a.dept}|${o.material.uuid}|${o.castShadow}`;
      if (!groups.has(key)) groups.set(key, { material: o.material, dept: r.a.dept, cast: o.castShadow, geos: [] });
      groups.get(key).geos.push(g); drop.push(o);
    });
  }
  let made = 0;
  for (const { material, dept, cast, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = cast; m.receiveShadow = true; m.userData.dept = dept; m.userData.merged = true;
    m.matrixAutoUpdate = false; // world-space already
    scene.add(m); made++;
  }
  for (const o of drop) o.parent.remove(o); // the originals leave the scene; the shared geometries stay cached
  return made;
}

/* CONNECTORS — per-dept dock of MCP logos with back-and-forth traffic (AJ's spec, 2 Aug rev 2)
   V3.1: served, the list is the user's REAL MCP servers (GET /api/mcp) — the strip waits for it.
   Opened as a file the demo list plays at once. `mcp` is a thin proxy so the rest of the office
   never cares which it got. */
let mcpImpl = null, mcpDark = false;
const mcp = {
  sprites: [],
  tick: (...a) => mcpImpl && mcpImpl.tick(...a),
  onAgentEvent: (...a) => mcpImpl && mcpImpl.onAgentEvent(...a),
  onToolsUsed: (...a) => mcpImpl && mcpImpl.onToolsUsed(...a),
  showTip: (...a) => mcpImpl && mcpImpl.showTip(...a),
  startReveal: (...a) => mcpImpl && mcpImpl.startReveal(...a),
  setDark: on => { mcpDark = on; if (mcpImpl) mcpImpl.setDark(on); },
  setUsage: u => { mcpUsage = u; if (mcpImpl) mcpImpl.setUsage(u); }, // V3.6: the plan's gauge; kept until the strip exists
  isLive: () => !!(mcpImpl && mcpImpl.live),
};
let mcpUsage = null;
loadConnectors().then(c => { mcpImpl = initMcp({ scene, hud, LAYOUT, DEPTS, FR, R, connectors: c }); if (mcpDark) mcpImpl.setDark(true); if (mcpUsage) mcpImpl.setUsage(mcpUsage); });
applyTopbar(); // INDUSTRY PROFILE (12 Sep 2026): the demo company's name beside the brand

// plants on outer corners
for (const k of ['emails', 'sales', 'marketing', 'ops', 'delivery']) {
  const L = LAYOUT[k];
  const sx = Math.sign(L.pos[0]), sz = Math.sign(L.pos[1]);
  const p = makePlant();
  p.position.set(L.pos[0] + sx * (L.w / 2 - 1.6), 0.12, L.pos[1] + sz * (L.d / 2 - 1.6));
  p.traverse(o => { if (o.isMesh) o.userData.dept = k; });
  scene.add(p);
}

/* ---------- focus dim: unfocused depts genuinely darken/desaturate in-scene ---------- */
let focusDimTarget = 0, focusDim = 0;
const dimSwapped = [];
const dimCache = new Map();
function dimTwin(m) {
  if (!dimCache.has(m.uuid)) {
    const d = m.clone();
    d.userData.baseColor = m.color.clone();
    const l = (m.color.r + m.color.g + m.color.b) / 3;
    d.userData.dimColor = new THREE.Color(l * 0.40 + 0.10, l * 0.40 + 0.10, l * 0.38 + 0.09);
    dimCache.set(m.uuid, d);
  }
  return dimCache.get(m.uuid);
}
function applySceneDim(deptKey) {
  restoreSceneDim();
  scene.traverse(o => {
    if (!(o.isMesh || o.isLine || o.isSprite) || !o.material || o.material.isShadowMaterial || !o.userData.dept) return;
    if (o.userData.dept === deptKey) return;
    if (deptKey === 'brain' && o.userData.dept === 'brainCore') return; // brain focus keeps its nebula lit
    dimSwapped.push({ mesh: o, orig: o.material });
    o.material = dimTwin(o.material);
  });
}
function restoreSceneDim() {
  for (const s of dimSwapped) s.mesh.material = s.orig;
  dimSwapped.length = 0;
}
function tickDim(dt) {
  focusDim += (focusDimTarget - focusDim) * (1 - Math.exp(-dt * 5));
  if (focusDimTarget === 0 && focusDim < 0.02 && dimSwapped.length) restoreSceneDim();
  if (Math.abs(focusDim - dimApplied) < 1e-4 && dimCache.size === dimCount) return; // settled: nothing to recolour this frame
  dimApplied = focusDim; dimCount = dimCache.size;
  for (const m of dimCache.values())
    m.color.copy(m.userData.baseColor).lerp(m.userData.dimColor, focusDim);
}
let dimApplied = -1, dimCount = -1;

/* ---------- department billboards — v1's exact agreed metric rows + amber approval row ---------- */
const kv = id => KPIS.find(k => k.id === id).val;
let brainNotes = brain.state.notes;
const BB_ROWS = profileRows() || {
  emails: [
    ['CORREOS ENVIADOS', () => STATS.emailsSent],
    ['RESPUESTAS REDACTADAS', () => STATS.drafts]],
  delivery: [
    ['INFORMES ENVIADOS', () => STATS.reports],
    ['EN CURSO', () => STATS.onTrack + ' / ' + STATS.projects]],
  sales: [
    ['LLAMADAS S·A·J', () => STATS.spencer + '·' + STATS.arwin + '·' + STATS.jack],
    ['NUEVOS GERENTES', () => STATS.managers],
    ['INCORPORADOS AUTO.', () => STATS.autoOnb]],
  marketing: [
    ['NUEVAS IDEAS', () => STATS.insMkt],
    ['COSTO POR USUARIO', () => '$' + Math.round(STATS.cpa)]],
  ops: [
    ['PROPUESTAS HECHAS', () => Math.round(kv('proposals'))],
    ['NUEVAS IDEAS', () => STATS.insOps]],
  fin: [
    ['FACTURAS EMITIDAS', () => Math.round(kv('invoices'))],
    ['CUENTAS PAGADAS', () => STATS.billsPaid]],
  brain: [
    ['NOTAS INDEXADAS', () => brainNotes.toLocaleString('es-PA')]],
};
if (PROFILE && !BB_ROWS.brain) BB_ROWS.brain = [['NOTAS INDEXADAS', () => brainNotes.toLocaleString('es-PA')]];
if (SERVED) { // a real office shows real counts, never the demo's invented metrics
  const realCount = (k, state) => { try { return tasks ? tasks.tasks.filter(t => t.live && !t.piece && t.state === state && (AGENTS.find(a => a.id === t.agent) || {}).dept === k).length : 0; } catch { return 0; } }; // a team's pieces are not deliveries of their own
  for (const k of DEPT_KEYS) BB_ROWS[k] = [['ENTREGAS REALES', () => realCount(k, 'done')], ['ESPERAN TU OK', () => realCount(k, 'waiting')]];
}
// the Brain's icon: two hemispheres drawn in line, with synapses that fire in turn (and all at once when an agent reads a note)
const BRAIN_ICON = `<svg class="brainIc" viewBox="0 0 24 24" aria-hidden="true"><g class="bi-l"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.6 6.5a3 3 0 0 0 .4-1.4M6 5.1a3 3 0 0 0 .4 1.4M6 18a4 4 0 0 1-2-.5M20 17.5A4 4 0 0 1 18 18"/></g><g class="bi-s"><circle cx="7.5" cy="9" r="1.1"/><circle cx="16.5" cy="9" r="1.1"/><circle cx="8.5" cy="15" r="1.1"/><circle cx="15.5" cy="15" r="1.1"/><circle cx="12" cy="12" r="1.1"/></g></svg>`;
for (const k of [...DEPT_KEYS, 'brain']) {
  const dept = DEPTS[k];
  const n = AGENTS.filter(a => a.dept === k).length;
  const b = document.createElement('div');
  b.className = 'badge';
  b.innerHTML = `
    <div class="b-name"><span class="dot" style="background:${dept.chip}"></span>${dept.short}<span class="live"></span></div>
    <div class="b-count">${k === 'brain' ? '<span class="b-num">∞</span><span class="b-lab">CONOCIMIENTO</span>' : `<span class="b-num">${n}</span><span class="b-lab">AGENTES</span>`}</div>
    <div class="b-metrics">${BB_ROWS[k].map((row, i) => `
      <div class="m-row"><span class="m-lab">${row[0]}</span><span class="m-val" data-m="${k}-${i}">${row[1]()}</span></div>`).join('')}
    </div>
    <div class="b-appr" style="display:none">⚠ <span class="ap-n">1</span> EN ESPERA DE APROBACIÓN</div>`;
  if (k !== 'brain') { b.setAttribute('role', 'button'); b.tabIndex = 0; b.setAttribute('aria-label', `${dept.name}: abrir el departamento`); b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomToDept(k); } }); }
  b.addEventListener('click', (e) => {
    if (e.target.closest('.b-appr')) { zoomToApproval(k); e.stopPropagation(); }
    else if (e.target.closest('.b-tasks') && tasks) { tasks.showDept(k); e.stopPropagation(); }
    else zoomToDept(k);
  });
  if (k === 'brain') { // V4 (24 Sep 2026): the centre of the office — the Brain (an animated brain) and, beside it, Dimitri, the owner's right hand
    b.className = 'badge brainTag';
    b.innerHTML = `<button type="button" class="bt-brain" title="Abrir el Cerebro: tus notas (G)" aria-label="Abrir el Cerebro">${BRAIN_ICON}<span class="bt-tx"><span class="bt-t">EL CEREBRO</span><span class="bt-s"><b>${brain.state.notes.toLocaleString('es-PA')}</b> notas</span></span></button>` +
      `<button type="button" class="bt-dim" title="Hablar con Dimitri, tu mano derecha (S)" aria-label="Abrir el chat con Dimitri"><span class="bt-av" aria-hidden="true">D</span><span class="bt-tx"><span class="bt-t">DIMITRI</span><span class="bt-s">tu mano derecha</span></span></button>`;
    b.onclick = (e) => { e.stopPropagation(); if (e.target.closest('.bt-dim')) subger.toggle(); else if (e.target.closest('.bt-brain')) brain.open(); };
  }
  hud.appendChild(b);
  deptRT[k].badge = b;
  deptRT[k].vals = BB_ROWS[k].map(row => String(row[1]()));
  deptRT[k].apprRow = b.querySelector('.b-appr');
  deptRT[k].apprN = b.querySelector('.ap-n');
  // anchor just above the FIRST DESK ROW (z-9.6), not the pod edge — keeps the card-to-agents
  // gap consistent across pods of different depths. Support docks to the side instead: its
  // natural spot is off-screen at overview and the clamp used to shove it onto its agents.
  // V3.2 (AJ): every card sits ON its own pod, over the wiring — screen-tuned per pod at the
  // 0.84 overview. Standard = centred above the anchor (back corner, y clears the pills);
  // side = hangs off the pod's edge, vertically centred (fin: its back corner is the Brain;
  // ops: its back corner is the marketing pod's front row).
  const ANCHOR = {
    marketing: [-36, 8.6, 13.4],
    emails:    [-30, 8.6, -32.6],
    delivery:  [0, 10.6, -57.6],   // y 10.6: the top-bar clamp otherwise lands it on the back-row pills
    sales:     [48, 8.6, -32],     // over the pod's right corner — past the DELIVERY pod's desks and the Sales Lead pill
    ops:       [-13.5, 4, 54],     // side LEFT
    fin:       [43.5, 4, 17],      // side RIGHT
    brain:     [0, 0.6, 0],        // V4.1: centred ON the centre pod — the graph that stood there is gone
  };
  deptRT[k].badgeAnchor = new THREE.Vector3(...ANCHOR[k]);
  if (k === 'fin') deptRT[k].sideBadge = true;
  if (k === 'ops') { deptRT[k].sideBadge = true; deptRT[k].sideLeft = true; }
}
function updateBillboards() {
  for (const k of Object.keys(BB_ROWS)) {
    BB_ROWS[k].forEach((row, i) => {
      const nv = String(row[1]());
      if (nv !== deptRT[k].vals[i]) {
        deptRT[k].vals[i] = nv;
        const el = deptRT[k].badge.querySelector(`[data-m="${k}-${i}"]`);
        if (!el) return; // the brain tag carries no metric rows
        el.textContent = nv;
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
        const rel = document.querySelector(`[data-rm="${k}-${i}"]`); // docked rail copy
        if (rel) {
          rel.textContent = nv;
          rel.classList.remove('flash'); void rel.offsetWidth; rel.classList.add('flash');
        }
      }
    });
  }
}

/* ---------- meeting bubble ---------- */
const bubble = makeBubbleSprite();
bubble.position.set(2, 5.4, 2); // meetings happen beneath the floating brain
bubble.visible = false;
scene.add(bubble);
function makeBubbleSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('💬', 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(4, 4, 1);
  return s;
}

/* ---------- controls: wheel zoom-to-cursor, drag pan, click to fly ---------- */
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function worldAt(nx, ny) {
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const p = new THREE.Vector3();
  ray.ray.intersectPlane(groundPlane, p);
  return p;
}
let focused = null; // dept key when zoomed into a dept

addEventListener('wheel', (e) => {
  // the wheel zooms the office only over the office itself (the canvas, the cards and name pills floating on it);
  // over any panel, list, chat or window it scrolls that, like everywhere else (24 Sep 2026: it used to zoom everywhere)
  const t = e.target;
  if (!(t === renderer.domElement || (t.closest && t.closest('#hud')))) return;
  e.preventDefault();
  tween = null;
  view.arc = 0;
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  const before = worldAt(nx, ny);
  view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.0032), 0.72, 5.2);
  applyCamera();
  const after = worldAt(nx, ny);
  if (before && after) view.target.add(before.sub(after));
  if (view.zoom < 1.6 && focused === 'brain') focused = null; // a department stays open while you zoom out (it used to close its chat mid-conversation); VISTA GENERAL, ✕ or Esc close it
  syncOverviewBtn();
}, { passive: false });

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, moved: false };
});
addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.moved) {
    tween = null;
    const a = worldAt((drag.x / innerWidth) * 2 - 1, -(drag.y / innerHeight) * 2 + 1);
    const b = worldAt((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    if (a && b) view.target.add(a.sub(b));
    drag.x = e.clientX; drag.y = e.clientY;
  }
});
addEventListener('pointerup', (e) => {
  const wasDrag = drag && drag.moved;
  drag = null;
  if (wasDrag) return;
  if (e.target !== canvas) return; // HTML chrome handles its own clicks
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const mHits = ray.intersectObjects(mcp.sprites, false);
  if (mHits.length) { // MCP logo tile → pulse + connection tooltip
    mcp.showTip(mHits[0].object, e.clientX, e.clientY, performance.now());
    return;
  }
  const pHits = ray.intersectObjects(personTargets, false);
  if (pHits.length) {
    // clicking an agent opens its rail — a stuck agent opens straight to Chat (v1 rule)
    openAgent(pHits[0].object.userData.agentId, 'chat');
    return;
  }
  const hits = ray.intersectObjects(clickTargets, false);
  if (hits.length) {
    const dk = hits[0].object.userData.dept;
    if (dk === 'brain') { brain.open(); return; } // V3.6: the Brain opens as the graph
    if (dk !== focused) enterFocus(dk);
  }
});
addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; // typing in the bar, the big editor or a menu never fires a hotkey
  if (e.target.isContentEditable || ((e.ctrlKey || e.metaKey || e.altKey) && e.key !== 'Escape')) return; // Ctrl+C, Alt+… belong to the browser and to screen readers
  // Esc closes the window on top, one at a time, newest first; only with nothing open does it leave the department
  if (e.key === 'Escape') {
    if (keysSheet.isOpen()) { keysSheet.close(); return; }
    const cp = document.getElementById('connPanel'); if (cp) { cp.querySelector('.cp-x').click(); return; }
    if (tasks && tasks.detail && tasks.detail.isOpen()) { tasks.detail.close(); return; }
    if (agentSheet && agentSheet.isOpen && agentSheet.isOpen()) { agentSheet.close(); return; }
    if (subger.isOpen()) { subger.close(); return; }
    if (studio.isOpen()) { studio.close(); return; }
    if (tasks && tasks.calendar && tasks.calendar.isOpen()) { if (tasks.calendar.popOpen()) tasks.calendar.closePop(); else tasks.calendar.close(); return; }
    if (brain.isOpen()) { brain.close(); return; }
    if (tasks && tasks.isOpen()) { tasks.close(); return; }
    zoomOut(); return;
  }
  // with a full-screen window open, the one-letter keys stay out (they used to open more windows invisibly behind it) — except that window's own key, which closes it
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) { keysSheet.toggle(); return; } // V4.1 (audit 27): every key, in one sheet
  if (keysSheet.isOpen()) { if (e.key === 'd' || e.key === 'D') { setDark(!darkOn); keysSheet.sync(); } return; }
  const topWin = studio.isOpen() ? 'e' : subger.isOpen() ? 's' : brain.isOpen() ? 'g' : (tasks && tasks.detail && tasks.detail.isOpen()) ? '·' : (agentSheet && agentSheet.isOpen && agentSheet.isOpen()) ? '·' : '';
  if (topWin && e.key.toLowerCase() !== topWin) return;
  if (e.key === 'p' || e.key === 'P') { if (tasks && tasks.calendar) tasks.calendar.toggle(); } // V3.2.1 (16 Sep 2026): the calendar
  else if (tasks && tasks.calendar && tasks.calendar.isOpen()) return; // the calendar has its own keys (← → W M T)
  else if (e.key === 'g' || e.key === 'G') brain.toggle(); // V3.6: the full-screen Brain graph
  else if (e.key === 'b' || e.key === 'B') { if (tasks) tasks.toggle(); } // V3: the company-wide board
  else if (e.key === '+' || e.key === '=') zoomStep(1.5);
  else if (e.key === '-' || e.key === '_') zoomStep(1 / 1.5);
  else if (e.key === '0') zoomOut();
  else if ((e.key === 'x' || e.key === 'X') && !SERVED) { if (!meeting) planMeeting(performance.now()); } // demo theatre: two agents walk to a meeting — never in the owner's real office
  else if (e.key >= '1' && e.key <= '6') { // jump straight to a department
    const dept = ['marketing', 'emails', 'sales', 'ops', 'fin', 'delivery'][+e.key - 1];
    if (focused !== dept) enterFocus(dept);
  }
  else if (e.key === 'c' || e.key === 'C') { // in a department: open its (lead) agent's chat
    if (focused && focused !== 'brain') {
      const a = AGENTS.find(x => x.dept === focused && x.lead) || AGENTS.find(x => x.dept === focused);
      if (a) openAgentRail(a.id, 'chat');
    }
  }
  else if (e.key === 'v' || e.key === 'V') setCam(!document.body.classList.contains('cam'));
  else if (e.key === 'd' || e.key === 'D') setDark(!darkOn);
  else if (e.key === 's' || e.key === 'S') subger.toggle(); // Dimitri's chat
  else if (e.key === 't' || e.key === 'T') document.getElementById('topPanel').click(); // show / hide the task panel
  else if (e.key === 'e' || e.key === 'E') studio.toggle(); // the Estudio
  else if ((e.key === 'w' || e.key === 'W') && !SERVED) requestApproval('apay'); // demo cue only: the owner's real office never shows an invented approval
});

/* ---------- V4.1 (24 Sep 2026, audit 27): the shortcuts sheet — «?» or the keyboard in the dock. B, D, 1–6 and the rest
   used to exist only as keys nobody could discover. Each line is also a button that does it; dark mode is a switch. ---------- */
const keysSheet = (() => {
  const DEPT_NAMES = ['marketing', 'emails', 'sales', 'ops', 'fin', 'delivery'].map((k, i) => `${i + 1} ${DEPTS[k].name}`).join(' · ');
  const G = [
    ['Ventanas', [['E', 'El Estudio: imágenes y video', 'e'], ['P', 'El calendario', 'p'], ['G', 'El Cerebro: tus notas', 'g'], ['S', 'Dimitri, tu mano derecha', 's'], ['B', 'El tablero de toda la empresa', 'b'], ['T', 'Mostrar u ocultar el panel de tareas', 't'], ['Esc', 'Cerrar la ventana de arriba; sin ventanas, volver a la vista general']]],
    ['La oficina', [['1–6', 'Ir a un departamento: ' + DEPT_NAMES], ['C', 'Dentro de un departamento: el chat de su jefe'], ['+  −', 'Acercar y alejar (también la rueda sobre la oficina)'], ['0', 'Vista general', '0']]],
    ['Escribir tareas', [['Enter', 'Agregar la tarea'], ['Mayús + Enter', 'Nueva línea'], ['Ctrl + Mayús + E', 'El editor grande']]],
    ['Calendario abierto', [['← →', 'Mes, semana o día anterior y siguiente'], ['T', 'Hoy'], ['W · M', 'Vista de semana o de mes']]],
    ['Vista', [['D', 'Modo oscuro (se recuerda en este navegador)'], ['V', 'Modo cámara: fondo neutro para grabar la pantalla', 'v']]],
  ];
  if (!SERVED) G.push(['Solo en la demo', [['X', 'Dos agentes se reúnen en el Cerebro', 'x'], ['W', 'Una aprobación de ejemplo', 'w']]]);
  const el = document.createElement('div'); el.id = 'keysOv'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'keysT');
  el.innerHTML = `<div class="ks-box"><div class="ks-head"><h2 id="keysT">Atajos de teclado</h2><span class="sp"></span>
      <label class="ks-dark"><input type="checkbox" role="switch" class="ks-dk"> Modo oscuro <kbd>D</kbd></label>
      <button type="button" class="ks-x" aria-label="Cerrar" title="Cerrar (Esc)">✕</button></div>
    <p class="ks-lead">Funcionan cuando no estás escribiendo. Pulsa una línea para hacerlo ahora.</p>
    <div class="ks-grid">${G.map(([h, rows]) => `<section><h3>${h}</h3>${rows.map(([k, t, key]) => key
      ? `<button type="button" class="ks-row" data-key="${key}"><kbd>${k}</kbd><span>${t}</span></button>`
      : `<div class="ks-row"><kbd>${k}</kbd><span>${t}</span></div>`).join('')}</section>`).join('')}</div></div>`;
  document.body.appendChild(el);
  let opener = null;
  const sync = () => { el.querySelector('.ks-dk').checked = darkOn; };
  function open() { if (!el.hidden) return; opener = document.activeElement; sync(); el.hidden = false; modal.open(el); document.getElementById('topKeys')?.setAttribute('aria-expanded', 'true'); requestAnimationFrame(() => el.classList.add('on')); el.querySelector('.ks-x').focus({ preventScroll: true }); }
  function close() { if (el.hidden) return; if (el.contains(document.activeElement)) document.activeElement.blur(); modal.close(el); el.classList.remove('on'); el.hidden = true; document.getElementById('topKeys')?.setAttribute('aria-expanded', 'false'); if (opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true }); }
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('.ks-x')) return close();
    const b = e.target.closest('.ks-row[data-key]'); if (!b) return;
    close(); setTimeout(() => dispatchEvent(new KeyboardEvent('keydown', { key: b.dataset.key })), 0); // the same path as the key itself, after this click has finished (a click-outside would close what it opens)
  });
  el.querySelector('.ks-dk').addEventListener('change', e => setDark(e.target.checked));
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  return { open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden, sync };
})();
document.getElementById('topKeys').addEventListener('click', () => keysSheet.toggle());

// camera mode: mid-tone backdrop for filming the screen (#cam=1 / V toggles)
function setCam(on) { document.body.classList.toggle('cam', !!on); }
// DARK MODE (AJ, 6 Sep 2026: "make another one in dark mode as I will show both"): D toggles, #dark=1
// forces it, /dark on the server opens in it. The chrome follows the CSS tokens; the scene
// re-tints its shared materials (plinths, floors, walkways), relights, and the Brain/wires swap ink.
let darkOn = false;
const DARK = { plinth: 0x2c2d2b, walkway: 0x303230, ground: 0x1b1c1a };
function mix(hex, base, k) { const a = new THREE.Color(hex), b = new THREE.Color(base); return b.lerp(a, k); }
function setDark(on, remember = true) {
  darkOn = !!on;
  if (remember) try { localStorage.setItem('ao.dark', darkOn ? '1' : '0'); } catch {} // V4.1: remembered on this browser (audit 27)
  document.body.classList.toggle('dark', darkOn);
  restoreSceneDim(); for (const m of dimCache.values()) if (m && m.dispose) m.dispose(); dimCache.clear(); // the dim twins cache base colours — rebuild them for the new palette
  scene.traverse(o => {
    if (!o.isMesh || !o.userData.part) return;
    const m = o.material; if (!m.userData.base) m.userData.base = m.color.clone();
    if (o.userData.part === 'plinth') m.color.set(darkOn ? DARK.plinth : m.userData.base);
    else if (o.userData.part === 'walkway') m.color.set(darkOn ? DARK.walkway : m.userData.base);
    else if (o.userData.part === 'floor') m.color.copy(darkOn ? mix(o.userData.chip, '#1b1c1a', o.userData.dept === 'brain' ? 0.07 : 0.22) : m.userData.base); // the Brain's pale sage needs a lighter touch
  });
  hemi.color.set(darkOn ? 0x8e95a3 : 0xfdfff8); hemi.groundColor.set(darkOn ? 0x14151a : 0xd8d4c8); hemi.intensity = darkOn ? 0.75 : 0.85;
  key.color.set(darkOn ? 0xe4e9f2 : 0xfff1dd); key.intensity = darkOn ? 1.5 : 2.2;
  ground.material.opacity = darkOn ? 0.35 : 0.13;
  if (focused && focused !== 'brain') applySceneDim(focused);
  if (brain) brain.setTheme(darkOn);
  mcp.setDark(darkOn);
}

// double-click empty space → straight back to overview
canvas.addEventListener('dblclick', (e) => {
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  if (!ray.intersectObjects(clickTargets, false).length) zoomOut();
});

// on-screen zoom controls
function zoomStep(f) {
  flyTo([view.target.x, 0, view.target.z], clamp(view.zoom * f, 0.72, 5.2), 350);
  if (view.zoom * f < 1.6 && focused) {
    if (focused === 'brain') focused = null; else exitFocus(false);
  }
  syncOverviewBtn();
}
document.getElementById('zIn').addEventListener('click', () => zoomStep(1.5));
document.getElementById('zOut').addEventListener('click', () => zoomStep(1 / 1.5));
document.getElementById('zHome').addEventListener('click', zoomOut);

function zoomToDept(k) { enterFocus(k); }
function zoomOut() {
  if (focused && focused !== 'brain') { exitFocus(true); return; }
  focused = null;
  flyTo(overviewPos(), OVERVIEW.zoom, 550);
  syncOverviewBtn();
}
document.getElementById('overviewBtn').addEventListener('click', zoomOut);
function syncOverviewBtn() {
  document.getElementById('overviewBtn').classList.toggle('show',
    (view.zoom > 1.45 && !(tween && tween.toZ <= OVERVIEW.zoom + 0.05)) || !!focused);
}

/* ---------- focus rail: dept billboard + activity rows; agent CHAT & ACTIVITY slide-over ---------- */
const chatHist = {};
const rail = document.getElementById('rail');
const vignette = document.getElementById('vignette');
const mMsgs = document.getElementById('mMsgs');
let modalOpen = null, modalTab = 'chat', agentSheet = null; // modalOpen = agent id open in the rail slide-over
// V3.3: the rail docks LEFT for every department — the task panel has the right side
const RAIL_SIDE = { marketing: 'left', emails: 'left', sales: 'left', ops: 'left', fin: 'left', delivery: 'left' };
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();

function ensureChat(id) {
  if (chatHist[id]) return;
  const v = R[id].v1;
  chatHist[id] = [
    { who: 'agent', text: v.greeting },
    { who: 'work', i: '⏺', text: 'sesión conectada — trabajo en vivo aquí abajo' },
  ];
  if (FILE_GEN[id] && !(tasks && tasks.isLive())) chatHist[id].push({ who: 'file', ...FILE_GEN[id]() }); // demo-only sample file; a live office shows real deliverables
}
function chatPush(id, msg) {
  ensureChat(id);
  chatHist[id].push(msg);
  if (chatHist[id].length > 80) chatHist[id].splice(2, 1);
  if (modalOpen === id && modalTab === 'chat') renderChat(id);
}
function renderChat(id) {
  const r = R[id];
  document.getElementById('mChips').hidden = chatHist[id].some(m => m.who === 'user'); // suggestions help an empty chat, then give the room back
  // stay where the owner is reading: follow new messages only if already at the bottom (or the owner just wrote)
  const last = chatHist[id][chatHist[id].length - 1];
  const follow = mMsgs.dataset.for !== id || mMsgs.scrollHeight - mMsgs.scrollTop - mMsgs.clientHeight < 60 || (last && last.who === 'user');
  const keepTop = mMsgs.scrollTop; mMsgs.dataset.for = id;
  mMsgs.innerHTML = chatHist[id].map((m, i) => {
    if (m.who === 'agent') return `<div class="m-agent"><div class="md">${mdToHtml(m.text)}</div>${m.text && m.text.length > 80 ? `<button type="button" class="m-copy" data-i="${i}" aria-label="Copiar la respuesta">Copiar</button>` : ''}</div>`;
    if (m.who === 'user') return `<div class="m-user">${esc(m.text)}</div>`;
    if (m.who === 'work') return `<div class="m-work"><span class="wi">${m.i || '▸'}</span>${esc(m.text)}</div>`;
    if (m.who === 'file') return `
      <div class="m-file${m.exp ? ' exp' : ''}" data-i="${i}">
        <button type="button" class="f-head" aria-expanded="${!!m.exp}"><span aria-hidden="true">${m.icon}</span><div><div class="f-name">${esc(m.name)}</div><div class="f-meta">${esc(m.meta)} · ${m.exp ? 'clic para cerrar' : 'clic para leer'}</div></div></button>
        ${m.exp ? `<div class="f-body md">${mdToHtml(m.content)}</div><div class="f-acts"><button type="button" class="m-copy" data-i="${i}">Copiar</button></div>` : ''}
      </div>`;
    if (m.who === 'appr') return `
      <div class="m-appr${m.pending ? '' : ' closed'}" data-i="${i}">
        <div class="a-who">${m.pending ? 'necesita tu visto bueno' : 'visto bueno'}</div>
        <div class="a-ask">${esc(m.text)}</div>
        ${m.mock ? `<div class="a-mock">${m.mock}</div>` : ''}
        ${!m.pending ? `<div class="a-done">${m.settled ? 'Ya no espera: se resolvió desde el tablero, el detalle u otra ventana' : m.approved ? '✓ Aprobado por ti' : '✗ Devuelto por ti con una nota'}</div>`
          : m.rejecting ? `<div class="a-rej"><label class="a-rl" for="aRej${i}">¿Qué debe cambiar? El agente lo rehace con tu nota y vuelve a pedirte el visto bueno.</label>
              <textarea id="aRej${i}" class="a-note" rows="2" placeholder="p. ej.: más corto, sin precios, tono más cercano">${esc(m.note || '')}</textarea>
              <div class="a-btns"><button type="button" class="a-send">DEVOLVER CON ESTA NOTA</button><button type="button" class="a-cancel">CANCELAR</button></div></div>`
          : '<div class="a-btns"><button type="button" class="a-yes">APROBAR</button><button type="button" class="a-no">RECHAZAR</button></div>'}
      </div>`;
    return '';
  }).join('');
  mMsgs.querySelectorAll('.m-file .f-head').forEach(el =>
    el.addEventListener('click', () => { const m = chatHist[id][+el.parentElement.dataset.i]; m.exp = !m.exp; renderChat(id); })); // the open state lives on the message: a new message no longer folds it
  const cardOf = el => chatHist[id][+el.closest('.m-appr').dataset.i];
  mMsgs.querySelectorAll('.m-appr .a-yes').forEach(el =>
    el.addEventListener('click', () => resolveApproval(id, true, cardOf(el).sid)));
  mMsgs.querySelectorAll('.m-appr .a-no').forEach(el =>
    el.addEventListener('click', () => resolveApproval(id, false, cardOf(el).sid)));
  mMsgs.querySelectorAll('.m-appr .a-note').forEach(el => {
    el.addEventListener('input', () => { cardOf(el).note = el.value; });
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendRejectNote(id, cardOf(el)); } else if (e.key === 'Escape') { cardOf(el).rejecting = false; renderChat(id); } });
  });
  mMsgs.querySelectorAll('.m-appr .a-send').forEach(el => el.addEventListener('click', () => sendRejectNote(id, cardOf(el))));
  mMsgs.querySelectorAll('.m-appr .a-cancel').forEach(el => el.addEventListener('click', () => { cardOf(el).rejecting = false; renderChat(id); }));
  mMsgs.scrollTop = follow ? mMsgs.scrollHeight : keepTop;
  if (noteFocus && noteFocus.id === id) { // a re-render (a new message) keeps the note being typed, and the caret in it
    const ta = mMsgs.querySelector(`.m-appr[data-i="${noteFocus.i}"] .a-note`);
    if (ta) { ta.focus(); try { ta.setSelectionRange(noteFocus.a, noteFocus.b); } catch {} }
  }
}
let noteFocus = null;
mMsgs.addEventListener('focusin', e => { if (e.target.classList.contains('a-note')) noteFocus = { id: modalOpen, i: +e.target.closest('.m-appr').dataset.i, a: e.target.selectionStart, b: e.target.selectionEnd }; });
mMsgs.addEventListener('focusout', e => { if (e.target.classList.contains('a-note') && !e.relatedTarget?.closest?.('.m-appr')) setTimeout(() => { if (!mMsgs.contains(document.activeElement)) noteFocus = null; }, 0); });
mMsgs.addEventListener('keyup', e => { if (noteFocus && e.target.classList.contains('a-note')) { noteFocus.a = e.target.selectionStart; noteFocus.b = e.target.selectionEnd; } });
function sendRejectNote(id, m) {
  const note = String(m.note || '').trim();
  if (!note) { const ta = mMsgs.querySelector(`.m-appr[data-i="${chatHist[id].indexOf(m)}"] .a-note`); if (ta) { ta.focus(); ta.classList.add('need'); } return; }
  noteFocus = null;
  if (tasks && tasks.rejectLive(id, m.sid, note)) return;
  settleLive(id);
}
mMsgs.addEventListener('click', e => {
  const c = e.target.closest('.m-copy');
  if (c) { const m = chatHist[modalOpen] && chatHist[modalOpen][+c.dataset.i]; if (m) copyText(m.content || m.text, c); return; }
  const w = e.target.closest('.md-wiki'); if (w && brain) { if (!brain.show(w.dataset.note)) markMissing(w); } // [[a note]] in a reply opens it in the Brain
});
// V4.1 (audit 94, 65): a [[link]] anywhere (the task detail, Dimitri, a card) opens its note, with the keyboard too; one that
// points at no note says why instead of only turning grey
function markMissing(w) { w.classList.add('missing'); w.setAttribute('aria-disabled', 'true'); w.title = 'Esa nota no está en el Cerebro: se borró, se renombró o está fuera de las carpetas que lee la oficina'; if (!w.nextElementSibling || !w.nextElementSibling.classList.contains('md-miss')) w.insertAdjacentHTML('afterend', '<span class="md-miss" role="note"> (no está en el Cerebro)</span>'); }
document.addEventListener('click', e => {
  const w = e.target.closest && e.target.closest('.md-wiki'); if (!w || w.closest('#mMsgs, #bvPane') || !brain) return;
  if (w.classList.contains('missing')) return;
  if (tasks && tasks.detail && tasks.detail.isOpen()) tasks.detail.close();
  if (subger.isOpen()) subger.close();
  if (!brain.show(w.dataset.note)) markMissing(w);
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('md-wiki') && !e.target.closest('#bvPane')) { e.preventDefault(); e.target.click(); } });
function copyText(t, btn) {
  const done = () => { const o = btn.textContent; btn.textContent = 'Copiado ✓'; setTimeout(() => { btn.textContent = o; }, 1400); };
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(done, () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch {} a.remove(); });
}
// ⤢ widens the chat for long answers; remembered on this browser
const railEl = document.getElementById('rail');
try { if (localStorage.getItem('ao.railWide') === '1') document.body.classList.add('railWide'); } catch {}
document.getElementById('railWide').addEventListener('click', () => {
  const on = document.body.classList.toggle('railWide');
  try { localStorage.setItem('ao.railWide', on ? '1' : '0'); } catch {}
  document.getElementById('railWide').setAttribute('aria-pressed', on);
  if (focused && focused !== 'brain') { const t = focusTarget(focused); flyTo(t.pos, t.zoom, 500); }
});
function renderActivity(id) {
  const r = R[id], v = r.v1;
  const task = rnd(v.tasks || ['Revisando la cola de trabajo'])
    .replace('{co}', rnd(P.co)).replace('{person}', person()).replace('{count}', ri(3, 9));
  document.getElementById('mNow').innerHTML = `AHORA &nbsp;<b>${esc(task)}</b>`;
  document.getElementById('mStats').innerHTML = (v.stats || []).map(([l, val]) => `
    <div class="st"><div class="st-l">${esc(l)}</div><div class="st-v">${esc(String(typeof val === 'function' ? val() : val))}</div></div>`).join('');
  const chip = DEPTS[r.a.dept].chip;
  const mx = Math.max(...(v.chart || [1]));
  document.querySelector('#mChart .ch-lbl').textContent = v.chartLbl || '';
  document.querySelector('#mChart .ch-bars').innerHTML = (v.chart || []).map(n =>
    `<i style="height:${Math.round(n / mx * 100)}%;background:${chip}"></i>`).join('');
  document.getElementById('mFeed').innerHTML = r.feed.map(f => `
    <div class="fe"><span class="fi">${f.i}</span><span>${esc(f.text)}</span><span class="ft">${ago(f.ts)}</span></div>`).join('');
}
/* camera target offset so the pod sits beside the rail, not behind it */
function focusTarget(k, atPos) {
  const base = atPos ? [atPos.x, 0, atPos.z] : [LAYOUT[k].pos[0], 0, LAYOUT[k].pos[1] + 1];
  const boardW = (tasks ? tasks.panelWidth() : 400) + 30; // V3.3: the task panel is always on the right
  const zoom = atPos ? 3.3 : 2.5;
  const pxPerWorld = zoom * innerHeight / (2 * FR);
  const railW = railEl.offsetWidth || Math.min(400, innerWidth * 0.92);
  // pod sits in the middle of whatever screen is left: rail on one side, board (if open) on the other
  const shift = ((railW - boardW) / 2 + (boardW ? 0 : 30)) / pxPerWorld;
  const dir = RAIL_SIDE[k] === 'left' ? -shift : shift;
  return { pos: [base[0] + SCREEN_RIGHT.x * dir, 0, base[2] + SCREEN_RIGHT.z * dir], zoom };
}
function enterFocus(k, pendingAgentId) {
  pillTabs(k === 'brain' ? null : k);
  if (k === 'brain') { // the Brain keeps its plain fly-in (AJ's call)
    focused = 'brain';
    if (tasks) tasks.onFocusChange('brain');
    flyTo([LAYOUT.brain.pos[0], 0, LAYOUT.brain.pos[1] + 1.5], 3.1, 700);
    syncOverviewBtn();
    return;
  }
  if (focused === k && !pendingAgentId) return;
  if (focused && focused !== k) {
    rail.classList.remove('open', 'agentOpen'); modalOpen = null;
    // dept → dept without passing through overview: the old billboard was hidden when it flew into the
    // rail (flyBillboardIntoRail) and only exitFocus restores it — bring it back or it stays gone (AJ, 15 Sep)
    if (focused !== 'brain' && deptRT[focused] && deptRT[focused].badge) deptRT[focused].badge.style.display = '';
  }
  focused = k;
  if (tasks) tasks.onFocusChange(k);
  focusDimTarget = 1;
  applySceneDim(k);
  vignette.classList.add('on');
  const t = focusTarget(k);
  flyTo(t.pos, t.zoom, 950, {
    arc: RAIL_SIDE[k] === 'left' ? 0.10 : -0.10,
    onDone: () => { if (pendingAgentId) openAgentRail(pendingAgentId, pendingTab, true); pendingTab = 'chat'; },
  });
  buildDeptRail(k);
  rail.className = RAIL_SIDE[k];
  rail.style.display = 'block';
  document.body.classList.toggle('railLeft', RAIL_SIDE[k] === 'left'); // the Sahni.ai mark steps right of a docked-left rail
  // V3.4: the rail IS the chat — it opens on the department lead (or first agent) at once
  // (after the className reset above, which would otherwise drop the agentOpen state)
  const first = pendingAgentId || (AGENTS.find(x => x.dept === k && x.lead) || AGENTS.find(x => x.dept === k)).id;
  openAgentRail(first, pendingAgentId ? pendingTab : 'chat', false);
  document.getElementById('overviewBtn').classList.toggle('right', RAIL_SIDE[k] === 'left');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    rail.classList.add('open');
    flyBillboardIntoRail(k);
    cascadeRows();
  }));
  syncOverviewBtn();
}
function pillTabs(k) { for (const r of Object.values(R)) r.pill.tabIndex = k && r.a.dept === k ? 0 : -1; } // only the open department's agents are Tab stops
function exitFocus(flyOut = true) {
  if (!focused) return;
  const k = focused;
  focused = null; pillTabs(null);
  modalOpen = null;
  if (tasks) tasks.onFocusChange(null);
  focusDimTarget = 0;
  vignette.classList.remove('on');
  rail.classList.remove('open', 'agentOpen');
  document.body.classList.remove('railLeft');
  setTimeout(() => { if (!focused) rail.style.display = 'none'; }, 650);
  document.getElementById('overviewBtn').classList.remove('right');
  if (k !== 'brain' && deptRT[k] && deptRT[k].badge) deptRT[k].badge.style.display = '';
  if (flyOut) flyTo(overviewPos(), OVERVIEW.zoom, 700);
  syncOverviewBtn();
}
function buildDeptRail(k) {
  const dept = DEPTS[k];
  const n = AGENTS.filter(a => a.dept === k).length;
  const rh = document.getElementById('railHeader');
  rh.classList.remove('show');
  rh.innerHTML = `
    <div class="b-name"><span class="dot" style="background:${dept.chip}"></span>${dept.name}<span class="live"></span><span class="rh-sum">${n} agentes</span><button type="button" class="rh-tog" aria-expanded="false" aria-label="Mostrar u ocultar el resumen del departamento" title="Resumen del departamento">▾</button><button type="button" class="rh-x" aria-label="Cerrar ${dept.name} y volver a la vista general" title="Cerrar (Esc)">✕</button></div>
    <div class="b-count"><span class="b-num">${n}</span><span class="b-lab">AGENTES</span></div>
    <div class="b-metrics">${BB_ROWS[k].map((row, i) => `
      <div class="m-row"><span class="m-lab">${row[0]}</span><span class="m-val" data-rm="${k}-${i}">${row[1]()}</span></div>`).join('')}</div>
    ${tasks ? tasks.rowHTML(k) : ''}
    <div class="b-appr" style="display:${stuckIn(k).length ? 'flex' : 'none'}">⚠ <span class="ap-n">${stuckIn(k).length}</span> EN ESPERA DE APROBACIÓN</div>`;
  const trow = rh.querySelector('.b-tasks');
  if (trow) trow.addEventListener('click', () => tasks.showDept(k)); // the same as on the pod's card (audit 30)
  const tog = rh.querySelector('.rh-tog'); // the card folds to one line in the chat; the choice is remembered
  try { rh.classList.toggle('expanded', localStorage.getItem('ao.rhOpen') === '1'); } catch {}
  tog.setAttribute('aria-expanded', rh.classList.contains('expanded'));
  tog.addEventListener('click', e => { e.stopPropagation(); const on = rh.classList.toggle('expanded'); tog.setAttribute('aria-expanded', on); try { localStorage.setItem('ao.rhOpen', on ? '1' : '0'); } catch {} });
  rh.querySelector('.rh-x').addEventListener('click', e => { e.stopPropagation(); zoomOut(); }); // close the department: back to the whole office
  rh.querySelector('.b-appr').addEventListener('click', () => {
    const s = oldestFirst(stuckIn(k))[0];
    if (s) openAgentRail(s.a.id);
  });
  // V3.7 (AJ, 6 Sep): the agent-chip strip is gone — click an agent in the scene to talk to them
}
function cascadeRows() {
  document.querySelectorAll('#railRows .arow').forEach((el, i) => {
    el.style.transitionDelay = (280 + i * 85) + 'ms';
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.style.transitionDelay = '0ms'; }, 1600);
  });
}
/* the floating billboard physically FLIES and docks as the rail header (the hero beat) */
function flyBillboardIntoRail(k) {
  const badge = deptRT[k].badge;
  const from = badge.getBoundingClientRect();
  badge.style.display = 'none';
  const side = RAIL_SIDE[k];
  const railW = rail.offsetWidth;
  const tLeft = side === 'left' ? 18 : innerWidth - railW + 18;
  const clone = badge.cloneNode(true);
  clone.style.cssText = `position:fixed;box-sizing:border-box;left:${from.left}px;top:${from.top}px;` +
    `width:${from.width}px;margin:0;transform:none;transition:all .72s var(--ease);z-index:40;pointer-events:none;opacity:1;`;
  document.body.appendChild(clone);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    clone.style.left = tLeft + 'px';
    clone.style.top = (52 + 18) + 'px';
    clone.style.width = (railW - 36) + 'px';
  }));
  setTimeout(() => {
    clone.remove();
    document.getElementById('railHeader').classList.add('show');
  }, 740);
}
function openAgentRail(id, tab = 'chat', fly = true) {
  if (agentSheet && agentSheet.isOpen() && agentSheet.current() !== id && !agentSheet.close()) return; // another agent: back to its chat — unless the owner stays to save the sheet
  const r = R[id];
  ensureChat(id);
  modalOpen = id;
  const dept = DEPTS[r.a.dept];
  document.querySelector('#railAgent .mh-dot').style.background = dept.chip;
  document.querySelector('#railAgent .mh-name').innerHTML =
    (r.a.lead ? '<span class="star">★ </span>' : '') + r.a.name;
  document.querySelector('#railAgent .mh-role').textContent = `${r.v1.role} · ${dept.name}`;
  { const tag = document.querySelector('#railAgent .mh-tag'); tag.textContent = r.v1.tagline; tag.classList.remove('open'); tag.title = 'clic para ver completo'; tag.onclick = () => tag.classList.toggle('open'); }
  document.getElementById('mChips').innerHTML = (r.v1.chips || []).map(c =>
    `<button>${esc(c)}</button>`).join('');
  document.getElementById('mChips').querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => sendChat(b.textContent)));
  rail.classList.add('agentOpen');
  setTab(tab);
  if (tasks && tasks.railFor) tasks.railFor(id); // V3.5: the agent's routines strip
  if (fly) { const t = focusTarget(r.a.dept, r.seat); flyTo(t.pos, t.zoom, 500); }
}
// V3: the board opening/closing re-centres the pod without leaving focus
function reframe() {
  if (!focused || focused === 'brain' || modalOpen) return;
  const t = focusTarget(focused);
  flyTo(t.pos, t.zoom, 600);
}
function railBack() { // V3.4: "back" = back to the pod view, chat stays on the lead
  if (!focused || focused === 'brain') return;
  const lead = AGENTS.find(x => x.dept === focused && x.lead) || AGENTS.find(x => x.dept === focused);
  openAgentRail(lead.id, 'chat', false);
  const t = focusTarget(focused);
  flyTo(t.pos, t.zoom, 500);
}
document.getElementById('railBack').addEventListener('click', railBack);
let pendingTab = 'chat';
// compat entry point (person clicks, pills, CC export): route through focus mode
function openAgent(id, tab = 'chat') {
  const dept = R[id].a.dept;
  if (focused === dept) { openAgentRail(id, tab); return; }
  pendingTab = tab;
  enterFocus(dept, id);
}
function setTab(tab) {
  modalTab = tab;
  document.querySelectorAll('#rail .mtabs button').forEach(b =>
    b.classList.toggle('on', b.dataset.tab === tab));
  document.getElementById('mChat').style.display = tab === 'chat' ? 'flex' : 'none';
  document.getElementById('mAct').style.display = tab === 'activity' ? 'flex' : 'none';
  if (tab === 'chat') renderChat(modalOpen); else renderActivity(modalOpen);
}
document.querySelectorAll('#rail .mtabs button').forEach(b =>
  b.addEventListener('click', () => setTab(b.dataset.tab)));
function sendChat(text) {
  const id = modalOpen;
  if (!id || !text.trim()) return;
  const r = R[id];
  chatPush(id, { who: 'user', text });
  const mInEl = document.getElementById('mIn'); mInEl.value = ''; growInput(mInEl);
  const low = text.toLowerCase();
  setTimeout(() => {
    if (r.state === 'stuck' && /\b(approve|reject|aprobar|aprobado|apruebo|rechazar|rechazo)\b/.test(low)) { // the newest card still waiting, never an older one
      const card = [...chatHist[id]].reverse().find(m => m.who === 'appr' && m.pending);
      resolveApproval(id, /(approve|aprobar|aprobado|apruebo)/.test(low), card && card.sid);
      return;
    }
    const rv = tasks && tasks.isLive() && text.match(/^\s*(?:revise|revisa|revisar|corrige|corregir|cambia)\s*[:\-–]\s*(.+)$/i); // LIVE: "revisa: …" (or "revise:", "corrige:") re-runs the last deliverable
    if (rv && tasks.revise(id, rv[1].trim())) { chatPush(id, { who: 'agent', text: 'En eso — revisando ahora. Caerá aquí cuando esté listo.' }); return; }
    const tr = tasks && tasks.handleChat(id, text); // "add task: …" / "what's on the board"
    if (tr) { chatPush(id, { who: 'agent', text: tr }); return; }
    if (tasks && tasks.isLive()) { // LIVE: a real conversation with the agent, grounded in the brain
      chatPush(id, { who: 'work', i: '…', text: `${r.a.name} está pensando` });
      fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent: id, text, history: chatHist[id].filter(m => m.who === 'user' || m.who === 'agent').slice(-8) }) })
        .then(async res => { if (!res.ok) throw new Error((await res.json()).error || res.statusText); return res.json(); })
        .then(j => {
          const h = chatHist[id]; const k = h.findIndex(m => m.who === 'work' && m.text === `${r.a.name} está pensando`); if (k >= 0) h.splice(k, 1);
          chatPush(id, { who: 'agent', text: j.reply });
          if (j.routines && tasks.refresh) tasks.refresh(); // a routine was set, paused, run or deleted in chat
          if (j.read) for (const n of j.read.slice(0, 2)) brain.readNote(id, n);
          if (j.tools && j.tools.length) mcp.onToolsUsed(id, j.tools);
        })
        .catch(e => chatPush(id, { who: 'agent', text: `No pude contactar a Claude (${e.message}).` }));
      return;
    }
    const hit = (r.v1.chat || []).find(c => c.k.some(k => low.includes(k)));
    const reply = hit ? rnd(hit.r) : rnd(r.v1.fallback || ['En eso.']);
    chatPush(id, { who: 'agent', text: reply });
  }, tasks && tasks.isLive() ? 0 : 450 + Math.random() * 500); // the demo's canned reply «types» for a moment; a real message goes at once
}
document.getElementById('mSend').addEventListener('click', () =>
  sendChat(document.getElementById('mIn').value));
document.getElementById('mIn').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(e.target.value); } // Shift+Enter: a new line
  e.stopPropagation();
});
function growInput(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
document.getElementById('mIn').addEventListener('input', e => growInput(e.target));
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); } // quotes too: esc() is used inside attributes
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'ahora' : m < 60 ? 'hace ' + m + ' min' : 'hace ' + Math.round(m / 60) + ' h';
}

/* ---------- approval mockups — show AJ exactly what he's approving ---------- */
function mockupFor(id) {
  const chip = DEPTS[R[id].a.dept].chip;
  const pm = profileMockup(R[id].a.dept, R[id].ask, R[id].a.name, esc); if (pm) return pm; // INDUSTRY PROFILE: the trade's own document, or a cover sheet for this ask
  switch (id) {
    case 'apay': return `<div class="mk mk-doc">
      <div class="d-brand">AUDITORÍA DE FACTURA — #218</div>
      <div class="d-title">Contratista de diseño</div>
      <div class="d-line"><span>Facturado</span><b>14 hrs × $110 = $1,540</b></div>
      <div class="d-line"><span>Tarifa de contrato</span><b>$85/hora (firmado 12 mar)</b></div>
      <div class="d-line"><span>Diferencia</span><b>+$350 ⚠</b></div>
      <div class="d-line"><span>Alcance</span><b>coincide con el brief ✓</b></div>
      <div class="d-p">Las horas y el alcance cuadran — solo la tarifa está mal, y no hay variación firmada que la cubra. Recomiendo retener el pago y aclarar la tarifa antes de pagar.</div></div>`;
    case 'piper': return `<div class="mk mk-doc">
      <div class="d-brand">AGENTS OFFICE — PROPUESTA</div>
      <div class="d-title">Ridgeline Property Group</div>
      <div class="d-line"><span>Puestos</span><b>12</b></div>
      <div class="d-line"><span>Plan</span><b>Growth</b></div>
      <div class="d-line"><span>Precio</span><b>$1,080/mes con bloqueo 12 meses</b></div>
      <div class="d-p">Prueba: roofing en Auckland — 0 → 40 llamadas rastreadas/semana en 14 días. Enlace de firma en línea incluido.</div></div>`;
    case 'bill': return `<div class="mk mk-doc">
      <div class="d-brand">VERIFICACIÓN DE REEMBOLSO</div>
      <div class="d-title">Harbour City Roofing — $680</div>
      <div class="d-line"><span>Motivo</span><b>pago doble, dos tarjetas</b></div>
      <div class="d-line"><span>Txn #1 / #2</span><b>verificada ✓ / duplicada ✓</b></div>
      <div class="d-line"><span>Cuenta</span><b>14 meses, en regla</b></div>
      <div class="d-p">Caso legítimo. Supera mi límite de $500 — se libera en cuanto apruebes.</div></div>`;
    case 'iggy': return `<div class="mk-phone">
      <div class="ph-handle"></div>
      <div class="ph-hook">"llamar antes de las 10am es una trampa"</div>
      <div class="ph-sub">la conexión casi se duplica 10:00—11:30am — en 40,000 llamadas</div>
      <div class="ph-ui"><span>♥ 2.4k</span><span>💬 118</span><span>↗ compartir</span></div></div>`;
    case 'ada': return `<div class="mk mk-ad">
      <div class="ad-head"><div class="ad-av"></div><div><div class="ad-who">sahni.ai</div><div class="ad-sp">Patrocinado</div></div></div>
      <div class="ad-text">¿Ansiedad al llamar en frío? Tus primeras 5 llamadas deciden tu día…</div>
      <div class="ad-media" style="background:linear-gradient(135deg, ${chip}55, ${chip}22)">"la regla de las 10am — llama cuando contestan"</div>
      <div class="ad-foot"><span class="ad-hl">Empieza tu prueba gratis</span><span class="ad-cta">REGÍSTRATE</span></div>
      <div class="ad-stat">CPA $29 · mejor rendimiento · escalando a $180/día</div></div>`;
    case 'newt': return `<div class="mk mk-mail">
      <div class="ml-lab">ASUNTO A</div><div class="ml-sub">llamar antes de las 10am es una trampa</div>
      <div class="ml-lab">ASUNTO B</div><div class="ml-sub">analizamos 40,000 llamadas — llama a esta hora</div>
      <div class="ml-body">  antes de las 10am ...... 11% conecta
  10:00—11:30 ...... 21% conecta
  después de las 4pm ........ 9% conecta

→ 3,400 suscriptores · CTA: responde "10AM"</div></div>`;
    case 'scout': return `<div class="mk mk-doc">
      <div class="d-brand">MEMO DE OPORTUNIDAD</div>
      <div class="d-title">CallForge sube precios +8%</div>
      <div class="d-line"><span>Ventana</span><b>2—3 semanas</b></div>
      <div class="d-line"><span>Jugada</span><b>página comparativa + retargeting</b></div>
      <div class="d-line"><span>Informados</span><b>META ADS · PROPUESTAS</b></div>
      <div class="d-p">Sus reseñas en G2 ya marcan el precio. Argumento: bloqueo de precio 12 meses.</div></div>`;
    case 'enzo': return `<div class="mk mk-doc">
      <div class="d-brand">ORDEN DE COMPRA</div>
      <div class="d-title">FullEnrich — 500 créditos</div>
      <div class="d-line"><span>Costo</span><b>$250 ($0.50/crédito)</b></div>
      <div class="d-line"><span>Saldo actual</span><b>38 créditos — se acaban mañana</b></div>
      <div class="d-line"><span>Consumo</span><b>~90/semana</b></div>
      <div class="d-p">Misma tarjeta del mes pasado. Sin créditos, el enriquecimiento se detiene y el Sales Lead se queda seco.</div></div>`;
    default: {
      // generic: render the agent's own deliverable in a document frame
      if (!FILE_GEN[id]) return '';
      const f = FILE_GEN[id]();
      return `<div class="mk mk-doc">
        <div class="d-brand">${esc(f.name)}</div>
        <div class="ml-body" style="border:0;margin:0;padding:6px 0 0">${esc(f.content.split('\n').slice(0, 9).join('\n'))}</div></div>`;
    }
  }
}

/* ---------- approvals: agent STUCK → amber billboard row → chat approval message ---------- */
function requestApproval(id, ask) {
  const r = R[id];
  if (!r || r.state !== 'working') return;
  r.state = 'stuck'; r.stuckAt = Date.now();
  r.ask = ask || APPROVAL_BY_AGENT[id] || sample(APPROVAL_ASKS[r.a.dept], 1)[0];
  r.warn.visible = true;
  const hadChat = !!chatHist[id]; // fresh chats already seed the deliverable card
  chatPush(id, { who: 'appr', text: r.ask, pending: true, mock: mockupFor(id) });
  if (FILE_GEN[id] && hadChat) chatPush(id, { who: 'file', ...FILE_GEN[id]() });
  if (tasks) tasks.onStuck(id, r.ask);
  syncApprovals();
}
// V3.5: a routine's draft is waiting for the owner's OK — the agent stands and waves like any approval; the chat already holds the draft card
// V4.1 (24 Sep 2026): a live draft is known by its task (sid). The ⚠, the counters and the chat cards follow the drafts
// that are really waiting, so two drafts from one agent never get mixed up and a decision taken anywhere
// (the chat card, the detail, the board, another window) clears the same things.
function setStuckLive(id, ask, sid) {
  const r = R[id]; if (!r) return;
  r.state = 'stuck'; r.ask = ask; r.liveAppr = true; r.warn.visible = true;
  syncApprovals();
}
const liveWaiting = id => tasks ? tasks.tasks.filter(t => t.live && !t.piece && t.agent === id && t.state === 'waiting') : [];
function settleLive(id) {
  const r = R[id]; if (!r || !r.liveAppr) return;
  const w = liveWaiting(id), open = new Set(w.map(t => t.sid));
  let changed = false;
  for (const m of chatHist[id] || []) if (m.who === 'appr' && m.pending && m.sid && !open.has(m.sid)) { m.pending = false; m.rejecting = false; m.settled = true; changed = true; }
  if (w.length) { r.ask = w[0].ask; if (r.state !== 'stuck') { r.state = 'stuck'; r.warn.visible = true; } }
  else { r.liveAppr = false; r.ask = null; r.warn.visible = false; if (r.state === 'stuck') r.state = 'working'; }
  if (changed && modalOpen === id && modalTab === 'chat') renderChat(id);
  syncApprovals();
}
function decidedLive(id, sid, approved) { // the owner decided on one draft, wherever: its card shows the decision, the agent reacts
  const m = (chatHist[id] || []).find(x => x.who === 'appr' && x.sid === sid && x.pending);
  if (m) { m.pending = false; m.rejecting = false; m.approved = approved; }
  const r = R[id];
  if (r) { const now = performance.now(); if (approved) r.cheerUntil = now + 2400; else r.slumpUntil = now + 2600; spawnEmote(r, approved ? '✅' : '❌'); }
  settleLive(id);
  if (m && modalOpen === id && modalTab === 'chat') renderChat(id);
}
setInterval(() => { for (const id in R) if (R[id].liveAppr) settleLive(id); }, 1500); // a draft approved from another window, archived, or finished on the server
function resolveApproval(id, approved, sid) {
  const r = R[id];
  if (!r || r.state !== 'stuck') return;
  if (r.liveAppr) { // live: APPROVE sends that draft; REJECT opens the note on its card (the ⚠ stays until the note goes)
    const t = tasks && tasks.waitingFor(id, sid);
    if (!t) { settleLive(id); return; }
    if (approved) { tasks.resolveLive(id, true, t.sid); return; }
    const card = (chatHist[id] || []).find(m => m.who === 'appr' && m.pending && m.sid === t.sid);
    if (card) { card.rejecting = true; if (modalOpen === id && modalTab === 'chat') { renderChat(id); const ta = mMsgs.querySelector(`.m-appr[data-i="${chatHist[id].indexOf(card)}"] .a-note`); if (ta) ta.focus(); } }
    return;
  }
  r.state = 'working';
  r.ask = null;
  r.warn.visible = false;
  const msg = chatHist[id] && [...chatHist[id]].reverse().find(m => m.who === 'appr' && m.pending);
  if (msg) { msg.pending = false; msg.approved = approved; }
  // visible reaction in the scene: cheer + ✅, or slump + ❌
  const now = performance.now();
  if (approved) r.cheerUntil = now + 2400; else r.slumpUntil = now + 2600;
  spawnEmote(r, approved ? '✅' : '❌');
  if (tasks) tasks.onResolve(id, approved);
  chatPush(id, {
    who: 'agent',
    text: approved ? '✓ Aprobado — manos a la obra. Registraré el resultado en mi actividad.'
                   : '✗ Entendido — en pausa. Lo ajustaré y volveré con una mejor versión.',
  });
  syncApprovals();
}
function stuckIn(dept) { return Object.values(R).filter(r => r.state === 'stuck' && r.a.dept === dept); }
const draftsOf = r => r.liveAppr ? Math.max(1, liveWaiting(r.a.id).length) : 1; // live: each waiting draft counts; demo: one ask per agent
const draftsIn = dept => stuckIn(dept).reduce((n, r) => n + draftsOf(r), 0);
function syncApprovals() {
  let total = 0;
  for (const k of DEPT_KEYS) {
    const n = draftsIn(k); total += n;
    setS(deptRT[k].apprRow, 'display', n ? 'flex' : 'none');
    if (deptRT[k].apprN.textContent !== String(n)) deptRT[k].apprN.textContent = n;
  }
  const top = document.getElementById('topAppr');
  setS(top, 'display', total ? 'inline-flex' : 'none');
  if (top.querySelector('span').textContent !== String(total)) {
    top.querySelector('span').textContent = total;
    const lab = `${total} ${total === 1 ? 'borrador espera' : 'borradores esperan'} tu visto bueno${total > 1 ? ' — clic para ir al siguiente' : ''}`;
    top.title = lab; top.setAttribute('aria-label', lab);
  }
  // mirror into the docked rail header + row status tags
  if (focused && focused !== 'brain') {
    const n = draftsIn(focused);
    const rh = document.getElementById('railHeader');
    const ap = rh.querySelector('.b-appr');
    if (ap) { ap.style.display = n ? 'flex' : 'none'; ap.querySelector('.ap-n').textContent = n; }
  }
}
function oldestFirst(list) { // the draft that has waited longest goes first
  const since = r => { const w = r.liveAppr ? liveWaiting(r.a.id) : []; return w.length ? Math.min(...w.map(t => t.changedAt || 0)) : (r.stuckAt || 0); };
  return list.slice().sort((a, b) => since(a) - since(b));
}
function zoomToApproval(dept) {
  const s = oldestFirst(stuckIn(dept))[0];
  if (!s) { enterFocus(dept); return; }
  if (focused === dept) openAgentRail(s.a.id);
  else enterFocus(dept, s.a.id);
}
document.getElementById('topCal').addEventListener('click', () => { if (tasks && tasks.calendar) tasks.calendar.toggle(); }); // V3.2.1: the top-bar calendar button (same as P)
let apprTurn = 0; // the ⚠ in the bar: the oldest draft first, then each click the next one
document.getElementById('topAppr').addEventListener('click', () => {
  const all = oldestFirst(Object.values(R).filter(r => r.state === 'stuck'));
  if (!all.length) return;
  const s = all[apprTurn++ % all.length];
  if (focused === s.a.dept) openAgentRail(s.a.id); else enterFocus(s.a.dept, s.a.id);
});

/* ---------- event engine: weighted v1 templates → feed + chat + billboards ---------- */
function weightedEv(evs) {
  const tot = evs.reduce((s, e) => s + (e.p || 1), 0);
  let x = Math.random() * tot;
  for (const e of evs) { x -= (e.p || 1); if (x <= 0) return e; }
  return evs[0];
}
function fireAgentEvent(seedTs) {
  if (SERVED) return; // served by the owner's server = a real office: no invented activity in feeds or chats
  const ids = Object.keys(R).filter(id => R[id].v1 && R[id].v1.ev && R[id].state !== 'stuck');
  const r = R[ids[Math.floor(Math.random() * ids.length)]];
  const ev = weightedEv(r.v1.ev);
  const text = ev.t();
  r.feed.unshift({ i: ev.i, text, ts: seedTs || Date.now() });
  if (r.feed.length > 30) r.feed.pop();
  if (!seedTs) {
    spawnEmote(r, ev.i); // real work events pop their icon over the desk
    mcp.onAgentEvent(r.a.id, r.a.dept, r.seat, performance.now()); // tool tile pulses + packet beam
    if (focused === r.a.dept) { // live-update the rail activity row
      const line = document.querySelector(`[data-line="${r.a.id}"]`);
      if (line) line.textContent = ev.i + ' ' + text;
    }
    if (chatHist[r.a.id]) chatPush(r.a.id, { who: 'work', i: ev.i, text });
    if (ev.kpi) { const k = KPIS.find(x => x.id === ev.kpi.id); if (k) k.val += ev.kpi.n; }
    const d = r.a.dept, roll = Math.random();
    profileTickKpi(d, roll); // INDUSTRY PROFILE: the pod's first number ticks up
    if (d === 'emails') { if (roll < 0.45) STATS.emailsSent++; else if (roll < 0.7) STATS.drafts++; }
    else if (d === 'delivery' && roll < 0.2) STATS.reports++;
    else if (d === 'sales') {
      if (roll < 0.4) STATS[rnd(['spencer', 'arwin', 'jack'])]++;
      else if (roll < 0.5) STATS.autoOnb++;
      else if (roll < 0.56) STATS.managers++;
    }
    else if (d === 'marketing') {
      if (roll < 0.18) STATS.insMkt++;
      else if (roll < 0.5) STATS.cpa = Math.max(25, STATS.cpa + (Math.random() - 0.55) * 1.2);
    }
    else if (d === 'ops' && roll < 0.22) STATS.insOps++;
    else if (d === 'fin' && roll < 0.3) STATS.billsPaid++;
    if (ev.brain || Math.random() < 0.12) { brainNotes++; brain.read(r.a.id); } // the Brain shows the read
    updateBillboards();
    if (modalOpen === r.a.id && modalTab === 'activity') renderActivity(r.a.id);
  }
}
// seed a believable history so Activity isn't empty at boot
for (let i = 0; i < 170; i++) fireAgentEvent(Date.now() - ri(2, 200) * 60000);
for (const r of Object.values(R)) r.feed.sort((a, b) => b.ts - a.ts);

/* ---------- minimal sim: work bobs, screen updates, brain meetings ---------- */
let meeting = null; // Brain meetings fire ONLY on the X hotkey (AJ's call — demo cue, not ambient)
let nextApprovalAt = performance.now() + 20000;
let nextMetricAt = performance.now() + 3000;
let nextEmoteAt = performance.now() + 2000;

function planMeeting(now) {
  const ids = Object.keys(R).filter(id => R[id].state === 'working');
  const a = R[ids[Math.floor(Math.random() * ids.length)]];
  let b = a;
  while (b.a.dept === a.a.dept) b = R[ids[Math.floor(Math.random() * ids.length)]];
  for (const [i, r] of [a, b].entries()) {
    const d = deptRT[r.a.dept];
    const stand = new THREE.Vector3(2 + (i ? 3.4 : -3.4), 0.12, 2 + 2.6);
    r.path = [r.seat.clone(), d.gate.clone().setY(0.12), d.brainGate.clone().setY(0.12), stand];
    r.pathI = 0; r.state = 'walking';
  }
  meeting = { a, b, phase: 'gather', endAt: 0 };
}

function walkStep(r, dt) {
  const cur = r.person.position, tgt = r.path[r.pathI];
  const d = new THREE.Vector3().subVectors(tgt, cur); d.y = 0;
  const dist = d.length();
  const step = r.speed * dt;
  if (dist <= step) {
    cur.copy(tgt);
    r.pathI++;
    if (r.pathI >= r.path.length) return true;
  } else {
    d.normalize();
    cur.addScaledVector(d, step);
    r.person.rotation.y = Math.atan2(d.x, d.z);
  }
  return false;
}

// desk-life variety: each agent cycles through work modes on its own clock
// no 'stretch' — AJ found the stand-up stretches annoying (1 Aug). Last entry = pick fallback.
const WORK_MODES = [
  ['type', 0.30, 4000, 7500], ['read', 0.18, 3500, 6500], ['phone', 0.16, 4000, 8000],
  ['glance', 0.17, 2000, 3500], ['sip', 0.11, 2500, 4000], ['spin', 0.08, 1400, 2000],
];
function pickWorkMode(r, now) {
  let x = Math.random();
  for (const [mode, w, dMin, dMax] of WORK_MODES) {
    x -= w;
    if (x <= 0 || mode === WORK_MODES[WORK_MODES.length - 1][0]) {
      r.workMode = mode;
      r.modeStart = now;
      r.modeUntil = now + dMin + Math.random() * (dMax - dMin);
      if (mode === 'glance')
        r.person.userData.glanceDir = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.25);
      return;
    }
  }
}
// standing modes drift the agent from the chair to a spot beside the desk, and can re-face the camera
const FACE_CAM = Math.PI / 4;
function applyStandAndFacing(r, mode, now, dt) {
  const u = r.person.userData;
  const sk = (u.cur && u.cur.standK) || 0;
  r.person.position.x = r.seat.x + (r.stand.x - r.seat.x) * sk;
  r.person.position.z = r.seat.z + (r.stand.z - r.seat.z) * sk;
  if (mode === 'spin') {
    const span = Math.max(400, (r.modeUntil - r.modeStart) || 1500);
    r.person.rotation.y = r.seatRot + ((now - r.modeStart) / span) * Math.PI * 2;
    return;
  }
  const target = (mode === 'stretch' || mode === 'cheer' || mode === 'wave') ? FACE_CAM : r.seatRot;
  let d = target - r.person.rotation.y;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  r.person.rotation.y += d * (1 - Math.exp(-dt * 6));
}
// floating emoji work-bubbles — constant visible "something is happening" at any zoom
const emoteTex = {};
function getEmoteTex(icon) {
  if (!emoteTex[icon]) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    // cream bubble disc so the icon reads at any zoom
    x.beginPath(); x.arc(64, 60, 52, 0, 7);
    x.fillStyle = 'rgba(253,255,248,0.97)'; x.fill();
    x.lineWidth = 3; x.strokeStyle = 'rgba(21,20,20,0.25)'; x.stroke();
    x.beginPath(); x.moveTo(50, 106); x.lineTo(64, 124); x.lineTo(74, 104); x.closePath();
    x.fillStyle = 'rgba(253,255,248,0.97)'; x.fill();
    x.font = '58px "Apple Color Emoji", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#151414';
    x.fillText(icon, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    emoteTex[icon] = t;
  }
  return emoteTex[icon];
}
const emotes = [];
function spawnEmote(r, icon) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getEmoteTex(icon), depthTest: false, transparent: true }));
  const p = r.person.position;
  s.position.set(p.x + 0.7, p.y + 5.6, p.z);
  s.scale.set(2.9, 2.9, 1);
  scene.add(s);
  emotes.push({ s, born: performance.now() });
}
function tickEmotes(now, dt) {
  for (let i = emotes.length - 1; i >= 0; i--) {
    const e = emotes[i], age = (now - e.born) / 1700;
    if (age >= 1) {
      scene.remove(e.s); e.s.material.dispose(); emotes.splice(i, 1);
    } else {
      e.s.position.y += dt * 1.7;
      e.s.material.opacity = age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85;
    }
  }
}
function tickSim(now, dt) {
  for (const r of Object.values(R)) {
    if (r.state === 'working') {
      let mode;
      if (r.cheerUntil && now < r.cheerUntil) mode = 'cheer';
      else if (r.slumpUntil && now < r.slumpUntil) mode = 'slump';
      else {
        if (!r.modeUntil) { // first pick: desync everyone so the room never moves in lockstep
          pickWorkMode(r, now);
          r.modeUntil = now + 400 + Math.random() * 4000;
        } else if (now > r.modeUntil) pickWorkMode(r, now);
        mode = r.workMode;
      }
      poseWork(r.person, mode, now + r.bob * 500, dt);
      applyStandAndFacing(r, mode, now, dt);
    } else if (r.state === 'walking' || r.state === 'returning') {
      posePerson(r.person, 'walk', now);
      if (walkStep(r, dt)) {
        if (r.state === 'walking') {
          r.state = 'atBrain';
          r.person.rotation.y = r.person.position.x < 2 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          r.state = 'working';
          r.person.position.copy(r.seat);
          r.person.rotation.y = r.seatRot;
        }
      }
    } else if (r.state === 'atBrain') {
      posePerson(r.person, 'stand', now);
    }
  }
  if (meeting) {
    const { a, b } = meeting;
    if (meeting.phase === 'gather' && a.state === 'atBrain' && b.state === 'atBrain') {
      meeting.phase = 'talk';
      meeting.endAt = now + 8000 + Math.random() * 6000;
      bubble.visible = true;
    }
    if (meeting.phase === 'talk') {
      bubble.scale.setScalar(4 + Math.sin(now / 300) * 0.3);
      if (now > meeting.endAt) {
        bubble.visible = false;
        for (const r of [a, b]) {
          r.path = [...r.path].reverse(); r.path[r.path.length - 1] = r.seat.clone();
          r.pathI = 0; r.state = 'returning';
        }
        meeting = null;
      }
    }
  }
  // stuck agents STAND, face the camera and WAVE under their pulsing ⚠ (AJ's spec)
  for (const r of Object.values(R)) {
    if (r.state === 'stuck') {
      poseWork(r.person, 'wave', now + r.bob * 500, dt);
      applyStandAndFacing(r, 'wave', now, dt);
      const p = r.person.position;
      r.warn.position.set(p.x, p.y + 5.9, p.z);
      const k = 2.6 + Math.sin(now / 240) * 0.5;
      r.warn.scale.set(k, k, 1);
    }
  }
  // ambient emoji work-bubbles pop over random desks every beat or two
  if (now > nextEmoteAt) {
    const ids = Object.keys(R).filter(id => R[id].state === 'working');
    if (ids.length) spawnEmote(R[ids[Math.floor(Math.random() * ids.length)]],
      rnd(['💬', '✉️', '📈', '💡', '✓', '📞', '🔍', '📎']));
    nextEmoteAt = now + 1200 + Math.random() * 1800;
  }
  tickEmotes(now, dt);
  tickSweep(now);
  // schedule a new approval request now and then — capped so a long unattended demo
  // never ends up with half the office stuck waving (v1 demo-safety rule)
  if (now > nextApprovalAt && !(tasks && tasks.isLive())) { // V3.5: a live office's approvals are real (routine drafts) — no theatre ones
    const pending = Object.values(R).filter(r => r.state === 'stuck').length;
    if (pending < 2) {
      const ids = Object.keys(R).filter(id => R[id].state === 'working' && !R[id].a.lead);
      if (ids.length) requestApproval(ids[Math.floor(Math.random() * ids.length)]);
    }
    nextApprovalAt = now + 50000 + Math.random() * 40000;
  }
  // agent events drive everything — feed, chat streams, billboard metrics (nothing is static)
  if (now > nextMetricAt) {
    fireAgentEvent();
    nextMetricAt = now + 2600 + Math.random() * 3800;
  }
  // live screens: every monitor plays its own session; slower cadence when the camera is far away
  if (hasScreens()) {
    const slow = view.zoom < 1.4;
    for (const ss of screenSets) if (ss.live) ss.live.tick(now, slow);
  }
  // rotate desk screen content — a couple of screens refresh every beat so the room reads busy
  else if (Math.floor(now / 1800) !== Math.floor((now - dt * 1000) / 1800)) {
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const ss = screenSets[Math.floor(Math.random() * screenSets.length)];
      ss.screenSet.draw(sample(WORKLINES[ss.dept], 3).map(l => l.slice(0, 28)));
      ss.screenSet.tex.needsUpdate = true;
    }
  }
}

/* ---------- zoom LOD + HTML overlay projection ---------- */
const v3 = new THREE.Vector3();
function toScreen(p) {
  v3.copy(p).project(camera);
  return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
}
function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

// sizes are read once and then only when an element actually resizes (ResizeObserver): reading offsetWidth right after
// writing a transform forced a layout per billboard per frame. Styles are written only when their value changes.
const sizeOf = new WeakMap();
const sizeRO = new ResizeObserver(es => { for (const e of es) sizeOf.set(e.target, [e.target.offsetWidth, e.target.offsetHeight]); });
function box(el) { let s = sizeOf.get(el); if (!s) { s = [el.offsetWidth, el.offsetHeight]; sizeOf.set(el, s); sizeRO.observe(el); } return s; }
function setS(el, k, v) { const c = el._st || (el._st = {}); if (c[k] !== v) { c[k] = v; el.style[k] = v; } }
const px = n => Math.round(n * 2) / 2;
function tickLOD() {
  const z = view.zoom;
  const panelW = tasks ? tasks.panelWidth() : 400; // one read per frame, before any write
  const detail = smooth(1.75, 2.5, z);
  const pillA = smooth(1.45, 1.85, z); // pills stay on at near — they name the agents
  // billboards persist at every zoom (v1 rule) — slightly larger when far, compact when near
  const badgeScale = 1.02 - 0.3 * smooth(1.2, 2.6, z);
  for (const [k, d] of Object.entries(deptRT)) {
    if (focused === k && k !== 'brain') continue; // this billboard is docked in the rail
    let [sx, sy] = toScreen(d.badgeAnchor);
    // keep billboards fully on screen (camera-readability rule)
    const [bw0, bh0] = box(d.badge); const bh = bh0 * badgeScale, bw = bw0 * badgeScale;
    let xf;
    if (d.sideBadge) { // anchored by an edge, vertically centred (emails/sales/fin/delivery)
      const rightEdge = innerWidth - (panelW + 26); // V3.3: never under the panel
      sy = clamp(sy, 64 + bh / 2, innerHeight - bh / 2 - 8);
      if (d.sideLeft) { sx = clamp(sx, bw + 8, rightEdge); xf = 'translate(-100%,-50%)'; }
      else { sx = clamp(sx, 8, rightEdge - bw); xf = 'translate(0,-50%)'; }
    } else if (k === 'brain') { // the Brain and Dimitri sit centred on the centre pod
      const rightEdge = innerWidth - (panelW + 26);
      sy = clamp(sy, bh / 2 + 64, innerHeight - bh / 2 - 12);
      sx = clamp(sx, bw / 2 + 8, rightEdge - bw / 2);
      xf = 'translate(-50%,-50%)';
    } else {
      const rightEdge = innerWidth - (panelW + 26);
      sy = clamp(sy, bh + 64, innerHeight - 12);
      sx = clamp(sx, bw / 2 + 8, rightEdge - bw / 2);
      xf = 'translate(-50%,-100%)';
    }
    setS(d.badge, 'transform', `translate(${px(sx)}px,${px(sy)}px) ${xf} scale(${badgeScale.toFixed(3)})`);
    setS(d.badge, 'opacity', (1 - 0.75 * focusDim).toFixed(3)); // unfocused boards recede with the scene
    setS(d.badge, 'pointerEvents', 'auto');
  }
  // name pills stay on at EVERY zoom (AJ's call) — smaller when far, full-size when near
  const pillScale = 0.62 + 0.38 * smooth(1.2, 2.4, z);
  for (const r of Object.values(R)) {
    const p = r.person.position;
    const [sx, sy] = toScreen(v3.set(p.x, p.y + 5.9 * (r.a.lead ? 1.12 : 1), p.z));
    setS(r.pill, 'display', 'block');
    setS(r.pill, 'transform', `translate(${px(sx)}px,${px(sy)}px) translate(-50%,-100%) scale(${pillScale.toFixed(3)})`);
    const dimmed = focused && focused !== 'brain' && r.a.dept !== focused;
    setS(r.pill, 'opacity', dimmed ? (1 - 0.85 * focusDim).toFixed(3) : '1');
  }
}

/* the clock left the top bar (24 Sep 2026): the seconds made the bar twitch, and the time is on the owner's taskbar */

/* ---------- helpers ---------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function sample(arr, n) {
  const out = [...arr].sort(() => Math.random() - 0.5).slice(0, n);
  return out;
}

/* ---------- V3 task boards ---------- */
function feedPush(r, i, text) {
  r.feed.unshift({ i, text, ts: Date.now() });
  if (r.feed.length > 30) r.feed.pop();
  if (focused === r.a.dept) {
    const line = document.querySelector(`[data-line="${r.a.id}"]`);
    if (line) line.textContent = i + ' ' + text;
  }
  if (modalOpen === r.a.id && modalTab === 'activity') renderActivity(r.a.id);
}
// V3.1 LIVE: the served roster (office.agents.json) renames the seats and rewrites what each
// agent says about itself; the demo's fake greetings and stat chips are wrong in a real office
function applyRoster(agents) {
  if (!Array.isArray(agents)) return;
  for (const a of agents) {
    const r = R[a.id]; if (!r) continue;
    r.a.name = a.name;
    r.pill.innerHTML = (r.a.lead ? '<span class="star">★</span>' : '') + esc(a.name); r.pill.setAttribute('aria-label', `${a.name}${r.a.lead ? ', jefe' : ''}: abrir su chat`);
    r.v1 = r.v1 || {};
    r.v1.role = a.role || r.v1.role || ''; r.v1.tagline = a.does || r.v1.tagline || '';
    r.v1.greeting = `${a.does || 'Soy ' + a.name + '.'} Dame una tarea en la barra de la derecha, o pregúntame algo aquí.` +
      (a.interviewer && a.setUp === false ? ` Aún nada de este departamento es tuyo: escribe "configurar" y te haré cinco preguntas sobre cómo funciona aquí, luego lo anotaré para el equipo.` : '');
    r.v1.chips = a.interviewer && a.setUp === false ? ['configurar','¿Qué puedes hacer por mí?', '¿Qué herramientas puedes usar?'] : ['¿En qué estás trabajando?', '¿Qué puedes hacer por mí?', '¿Qué herramientas puedes usar?'];
    if (chatHist[a.id] && chatHist[a.id][0] && chatHist[a.id][0].who === 'agent') chatHist[a.id][0].text = r.v1.greeting;
    if (modalOpen === a.id) openAgentRail(a.id, modalTab, false);
  }
  if (tasks && tasks.syncPills) tasks.syncPills(); // the pills were rebuilt — put the clock chips back
}
tasks = initTasks({
  hud, R, deptRT, RAIL_SIDE, spawnEmote, chatPush, chatHist, feedPush, zoomToApproval, enterFocus, openAgent, esc,
  brainWrite: (id, title) => brain.write(id, title), brain,
  onLive: (h) => {
    if (mcp && mcp.setProvider) mcp.setProvider(h.provider); // the brain the agents run on: Claude's logo, or Meta's (option 2 of the .bat) — the logo alone says it
    { const br = document.querySelector('#topbar .brand'); br.innerHTML = `<span class="bn">${esc(h.name)}</span><span class="bs">OFICINA</span>`; br.title = `Agents Office ${h.version || ''} · la oficina de ${h.name}`; }
    if (h.deputy) { const t = document.querySelector('.brainTag .bt-dim'); if (t) { t.querySelector('.bt-t').textContent = String(h.deputy).toUpperCase(); t.querySelector('.bt-av').textContent = String(h.deputy).charAt(0).toUpperCase(); t.title = `Hablar con ${h.deputy}, tu mano derecha (S)`; t.setAttribute('aria-label', `Abrir el chat con ${h.deputy}`); } }
    document.title = `${h.name} — Agents Office`; brain.setOwner(h.name); brain.setQuiet(true); applyRoster(h.agents); },
  onTools: (agentId, keys) => mcp.onToolsUsed(agentId, keys),
  requestApproval, setStuck: setStuckLive, resolveApproval: (id, ok) => resolveApproval(id, ok), decided: (id, sid, ok) => decidedLive(id, sid, ok), settle: id => settleLive(id),
  onUsage: (u) => { if (mcp && mcp.setUsage) mcp.setUsage(u); }, // V3.6: the plan's gauge in the top bar
  getFocused: () => focused, getZoom: () => view.zoom, getFocusDim: () => focusDim,
  toScreen: (p) => toScreen(p), reframe,
});
view.target.set(...overviewPos());
addEventListener('resize', () => { if (!focused && !tween && !HERO) view.target.set(...overviewPos()); });
const subger = initSub({ isLive: () => tasks.isLive(), esc, DEPTS, DEPT_KEYS, findBySid: sid => tasks.findBySid(sid), openTask: t => tasks.openTask(t),
  agentName: id => (AGENTS.find(a => a.id === id) || {}).name || id, afterSend: () => tasks.refresh() });
{ // the task panel's switch in the dock (and T): the panel hides to give the office the whole width
  const btn = document.getElementById('topPanel');
  const sync = () => { const shown = !document.body.classList.contains('tpMin'); btn.setAttribute('aria-pressed', shown); btn.classList.toggle('on', shown); };
  btn.addEventListener('click', () => { if (tasks && tasks.setPanel) tasks.setPanel(document.body.classList.contains('tpMin')); sync(); });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] }); sync();
}
agentSheet = initSheet({ host: document.getElementById('railAgent'), esc, isLive: () => tasks.isLive(), MODEL_KEYS: SHEET_MODELS, modelName: sheetModelName, EFFORT_KEYS: SHEET_EFFORTS,
  onSaved: a => { applyRoster([a]); const n = document.querySelector('#railAgent .mh-name'); if (n) n.innerHTML = (a.lead ? '<span class="star">★</span> ' : '') + esc(a.name); },
  openTask: sid => { const t = tasks.findBySid(sid); if (t) tasks.openTask(t); } });
document.getElementById('railSheet').addEventListener('click', () => { if (!modalOpen) return; agentSheet.isOpen() ? agentSheet.close() : agentSheet.open(modalOpen); });
{ // the connector strip folds behind «CONECTADO A · N ▾» (it filled half the bar and ran into the rest on a laptop screen)
  const tc = document.getElementById('topconn');
  let pref = null; try { pref = localStorage.getItem('ao.connFold'); } catch {}
  document.body.classList.toggle('connFold', pref === null ? innerWidth < 1600 : pref === '1');
  const count = () => { const n = tc.querySelectorAll('img').length; tc.dataset.n = n; const l = tc.querySelector('.tc-lab'); if (l) l.dataset.n = n; };
  new MutationObserver(count).observe(tc, { childList: true }); count();
  // V4: the label opens the connectors' panel (src/mcp.js); the icons share the lane between the brand and the dock:
  // they shrink to fit (27 → 16 px) instead of pushing the tools to the right
  const fit = () => {
    const bar = document.getElementById('topbar'), dock = document.getElementById('topdock'), brand = bar.querySelector('.brand'), lab = tc.querySelector('.tc-lab');
    const n = tc.querySelectorAll('img').length; if (!n || !lab) return;
    const room = bar.clientWidth - brand.offsetWidth - dock.offsetWidth - lab.offsetWidth - 90;
    tc.style.setProperty('--tcs', Math.max(16, Math.min(27, Math.floor(room / n) - 6)) + 'px');
  };
  addEventListener('resize', fit); new MutationObserver(fit).observe(tc, { childList: true }); setTimeout(fit, 400); setTimeout(fit, 3000);
}
const studio = initStudio({ isLive: () => tasks.isLive(), esc, agentName: id => (AGENTS.find(a => a.id === id) || {}).name || '', openTask: sid => { const t = tasks.findBySid(sid); if (t) tasks.openTask(t); } });
document.getElementById('topStudio').addEventListener('click', () => studio.toggle());
const hero = HERO ? initHero({ scene, R, AGENTS, deptRT, LAYOUT, DEPTS, DEPT_KEYS, view, camera, spawnEmote, isBusy: () => !!focused || !!tween || !!drag }) : null;
if (HERO && HERO.target) { view.target.set(...HERO.target); view.zoom = HERO.zoom || view.zoom; }

/* ---------- boot ---------- */
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  applyCamera();
}
addEventListener('resize', resize);
resize();

// deterministic view hooks for headless screenshots: #view=sales | #zoom=2.2
{
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('zoom')) view.zoom = parseFloat(h.get('zoom')) || 1;
  if (h.get('appr')) requestApproval(h.get('appr') === '1' ? 'apay' : h.get('appr'));
  if (h.get('view') && LAYOUT[h.get('view')]) enterFocus(h.get('view'));
  if (h.get('cam')) setCam(h.get('cam') === '1');
  let savedDark = null; try { savedDark = localStorage.getItem('ao.dark'); } catch {}
  if (h.get('dark') === '1' || document.body.classList.contains('dark')) setDark(true, false);
  else if (h.get('dark') !== '0' && savedDark === '1') setDark(true, false);
  // typing #dark=1 into an OPEN tab is a same-document hash change (no reload) — react to it live
  addEventListener('hashchange', () => { const d = new URLSearchParams(location.hash.slice(1)).get('dark'); if (d === '1') setDark(true); else if (d === '0') setDark(false); });
  if (h.get('board')) { // #board=1 → company board · #board=marketing → that dept's board
    const b = h.get('board');
    if (LAYOUT[b] && b !== 'brain') tasks.openFor(b); else tasks.open();
  }
  syncOverviewBtn();
}
window.CC = { hero, flyTo, zoomToDept, zoomOut, zoomToApproval, requestApproval, openAgent, view, applyCamera, R, emotes,
  setCam, setDark, brain, chatPush, renderer, connectorReveal: () => mcp.startReveal(performance.now()),
  toggleBoard: () => tasks.toggle(), addTask: (agentId, title) => tasks.addTask(agentId, title), tasks, routines: () => tasks.routines };

let last = performance.now(), lastFrame = 0, frameN = 0, lastInput = performance.now();
for (const ev of ['pointermove', 'pointerdown', 'wheel', 'keydown']) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
const covered = () => (brain && brain.isOpen()) || (tasks && tasks.calendar && tasks.calendar.isOpen()) || document.body.classList.contains('studioOpen'); // a full-screen view hides the office
// Frame budget: full rate while the camera flies or the owner is moving the pointer; 30 fps when the office just lives;
// 5 fps of simulation and NO drawing while the Brain or the calendar covers it. The tab hidden → the browser stops rAF.
function loop(now) {
  requestAnimationFrame(loop);
  const gap = covered() ? 200 : (tween || now - lastInput < 1500) ? 0 : 1000 / 30 - 3;
  if (now - lastFrame < gap) return;
  lastFrame = now;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  tickTween(now);
  applyCamera();
  tickDim(dt);
  tickSim(now, dt);
  if (hero) hero.tick(now, dt);
  tickLOD();
  tasks.tick(now);
  mcp.tick(now, dt, view, camera, focused, focusDim);
  syncOverviewBtn();
  if (covered()) return;
  if (++frameN % 3 === 0 || tween) renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
