// V3.1 — the real connector list for the office. Served: GET /api/mcp (the MCP servers this
// machine's Claude Code is connected to) + /api/agents (the roster's tool preferences) become
// the `connectors` object initMcp() draws. Opened as a file: null → the demo list plays.
import { MCP_LOGOS } from './mcplogos.js';
import { DEPT_KEYS } from './data.js';

// brand inks for shared looms (a shared connector is wired to four or more pods)
const INK = { notion: '#151414', gmail: '#EA4335', slack: '#4A154B', zapier: '#FF4F00', claude_ai_Google_Drive: '#1FA463', googledrive: '#1FA463', chrome: '#4285F4' }; // V3.2 (16 Sep): Chrome is wired to every pod
const norm = s => String(s).toLowerCase().replace(/^plugin:[^:]+:/, '').replace(/^claude\.ai\s+/, '').replace(/[^a-z0-9]/g, '');
function hue(name) { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
export const inkOf = name => `hsl(${hue(name)} 52% 42%)`;

// a tile for a server we have no logo for: same white rounded square as the baked ones, the
// name's initials in a colour hashed from the name — stable across boots
export function tile(name) {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const x = c.getContext('2d');
  const r = 34;
  x.beginPath(); x.roundRect(1, 1, 158, 158, r); x.fillStyle = '#fff'; x.fill();
  x.lineWidth = 2; x.strokeStyle = 'rgba(28,26,23,0.10)'; x.stroke();
  name = String(name).replace(/^plugin:[^:]+:/i, '').replace(/^claude\.ai\s+/i, '') || String(name); // auditoría MCP-10: «plugin:small-business:gmail» was «PS»
  const words = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
  const ini = (words.length > 1 ? words[0][0] + words[1][0] : String(name).slice(0, 2)).toUpperCase();
  x.fillStyle = inkOf(name);
  x.font = `700 ${ini.length > 1 ? 64 : 76}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(ini, 80, 86);
  return c.toDataURL('image/png');
}

// auditoría MCP (1 oct 2026): the bar shows what is connected and what really fails; the servers that wait for a login,
// are still connecting or are switched off are a «+N» that opens the panel (MCP-10). Two servers of one brand share a tile
// and the better state wins (MCP-15): a local Gmail that fails no longer hides the plugin's Gmail that works.
const RANK = { connected: 4, denied: 3, failed: 2, pending: 1, 'needs-auth': 1, disabled: 0 };
const IN_BAR = new Set(['connected', 'failed', 'denied']);
export const stateOf = s => (s.denied || s.allowed === false ? 'denied' : s.status);
export function fromSummary(m, agents) {
  const byDept = Object.fromEntries(DEPT_KEYS.map(k => [k, []]));
  const logos = {}, status = {}, shared = {}, names = {}, off = [], win = {};
  const all = (m.servers || []).filter(s => s.status !== 'not-configured'); // an empty plugin slot is nothing to show
  for (const s of all) { const key = s.key || s.id; if (!win[key] || (RANK[stateOf(s)] ?? 0) > (RANK[stateOf(win[key])] ?? 0)) win[key] = s; }
  let hidden = 0;
  for (const [key, s] of Object.entries(win)) {
    const st = stateOf(s);
    if (!IN_BAR.has(st)) { hidden++; continue; }
    logos[key] = MCP_LOGOS[key] || { name: s.name, img: tile(s.name) };
    names[key] = s.name;
    status[key] = st;
    // only a usable server is wired to pods; the rest sit in the strip, grey, unwired — nothing flows
    if (st !== 'connected') { off.push(key); continue; }
    const depts = [...new Set(all.filter(x => (x.key || x.id) === key && stateOf(x) === 'connected').flatMap(x => x.depts || []))];
    for (const d of depts) if (byDept[d] && !byDept[d].includes(key)) byDept[d].push(key);
    if (depts.length >= 4) shared[key] = INK[key] || INK[norm(s.name)] || inkOf(s.name);
  }
  const agentTools = agents ? Object.fromEntries(agents.map(a => [a.id, (a.tools || []).map(t => {
    const n = norm(t); const hit = (m.servers || []).find(s => s.key === n || norm(s.name) === n || s.id === t); return hit ? (hit.key || hit.id) : n;
  })])) : null;
  return { live: true, byDept, logos, status, shared, names, off, hidden, agentTools, servers: m.servers || [], discovering: !!m.discovering, tools: !!m.tools, web: !!m.web };
}

// MCP-09: /api/mcp answers at once; while the first `claude mcp list` of a machine runs (1–2 min) the bar says so and asks
// again, instead of giving up at 25 s and drawing the demo's connectors as if they were real
export async function fetchSummary(refresh = false) {
  try { const r = await fetch('/api/mcp' + (refresh ? '?refresh=1' : ''), { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; }
}
export async function waitSummary({ refresh = false, every = 4000, max = 200000 } = {}) {
  let m = await fetchSummary(refresh);
  const t0 = Date.now();
  while (m && m.discovering && (refresh || !(m.servers || []).some(s => !s.browser)) && Date.now() - t0 < max) {
    await new Promise(r => setTimeout(r, every));
    m = (await fetchSummary()) || m;
  }
  return m;
}
export async function loadConnectors() {
  if (!location.protocol.startsWith('http')) return null; // opened as a file: the demo plays
  const bar = document.getElementById('topconn');
  const t = setTimeout(() => { if (bar && !bar.children.length) bar.innerHTML = '<span class="tc-none" role="status">comprobando conectores… (1–2 min la primera vez)</span>'; }, 600);
  const [m, a] = await Promise.all([waitSummary(), fetch('/api/agents').then(r => (r.ok ? r.json() : null)).catch(() => null)]);
  clearTimeout(t);
  return fromSummary(m || { servers: [] }, a && a.agents); // served: never the demo, even when the office could not answer
}
