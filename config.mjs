// Agents Office — configuration (Beta).
// office.config.json is the shipped default; office.config.equipo.json (in the repo: the TEAM's office — PanaClaw's name,
// brain and connector wiring, so a teammate who clones sees the same office) overrides it; office.config.local.json
// (gitignored: this machine only) overrides both; environment variables override everything: AO_NAME, AO_BRAIN, PORT, AO_MODEL.
// V3.1 keys: mcp { allow, deny, departments } · tools { web } · timeout (seconds per agent run) — see mcp.mjs.
// V3.2 (16 Sep) keys: tools { browser } (Claude in Chrome for the agents, default on) · teams { enabled, max } (Agent Teams, default on, up to 4 desks) — see teams.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error(`config: ${path.basename(p)} is not valid JSON and was IGNORED — ${e.message}`); return {}; } // silent, the office would open the wrong brain
}

export function loadConfig() {
  const shipped = readJSON(path.join(ROOT, 'office.config.json'));
  const team = readJSON(path.join(ROOT, 'office.config.equipo.json'));
  const local = readJSON(path.join(ROOT, 'office.config.local.json'));
  const base = { ...shipped, ...team, mcp: { ...(shipped.mcp || {}), ...(team.mcp || {}) }, tools: { ...(shipped.tools || {}), ...(team.tools || {}) }, teams: { ...(shipped.teams || {}), ...(team.teams || {}) }, media: { ...(shipped.media || {}), ...(team.media || {}) } };
  const c = { name: 'Agents Office', brain: './brain', port: 4520, model: 'sonnet', ...base, ...local }; // V3.6: model = sonnet · opus · fable
  c.mcp = { allow: [], deny: [], departments: {}, ...(base.mcp || {}), ...(local.mcp || {}) };
  c.tools = { web: true, browser: true, ...(base.tools || {}), ...(local.tools || {}) }; // V3.2 (16 Sep): browser = Claude in Chrome
  c.teams = { enabled: true, max: 4, ...(base.teams || {}), ...(local.teams || {}) }; // V3.2 (16 Sep): Agent Teams
  c.media = { ...(base.media || {}), ...(local.media || {}) }; // the Estudio's budget and departments
  if (process.env.AO_NAME) c.name = process.env.AO_NAME;
  if (process.env.AO_BRAIN) c.brain = process.env.AO_BRAIN;
  if (process.env.PORT) c.port = +process.env.PORT;
  if (process.env.AO_MODEL) c.model = process.env.AO_MODEL;
  c.port = +c.port || 4520;
  c.brainPath = path.resolve(ROOT, c.brain);
  return c;
}
