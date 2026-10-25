// Agents Office — the roster (Beta). Who sits where is fixed (six pods, 35 seats); what each
// agent is called, does and uses is yours to change in office.agents.json.
//   built-in defaults  ← office.agents.json  ← <brain>/Agents Office/agents.json  ← office.agents.local.json (gitignored)
// Departments, leads and seats cannot be changed from these files; the office ignores such
// edits and says so. `brief` is the owner's standing instructions to that agent (multi-line),
// read before every task. Skills — how a kind of work is done — live beside the agents in
// skills.mjs. See CLAUDE.md for how to change agents with Claude Code.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig } from './config.mjs';
import { renombrar } from './fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

export const FILE = path.join(ROOT, 'office.agents.json');
export const LOCAL = path.join(ROOT, 'office.agents.local.json');
export const brainFile = brainPath => path.join(brainPath, 'Agents Office', 'agents.json');
import { EDITABLE, defaults, validate, fusionar } from './roster-core.mjs';
export { defaults, validate, deptName } from './roster-core.mjs'; // la parte pura (sin fs) vive en roster-core.mjs
function read(p) { if (!fs.existsSync(p)) return null; try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { __error: e.message }; } }
export function loadRoster(brainPath = loadConfig().brainPath) {
  const sources = [FILE, brainFile(brainPath), LOCAL];
  const label = p => p === FILE || p === LOCAL ? path.basename(p) : 'brain/Agents Office/agents.json';
  const { agents, problems, customised, briefed } = fusionar(sources.map(p => ({ etiqueta: label(p), doc: read(p) })));
  return { agents, problems, customised, briefed, files: sources.filter(p => fs.existsSync(p)).map(label) };
}

/** Save the owner's edits to one agent (from the office's agent sheet). Written to the roster file that already carries
 *  this agent with the highest precedence (office.agents.local.json, else <brain>/Agents Office/agents.json, created if
 *  needed); only the editable fields; validated with the same rules as a hand edit. → { agent, problems, file } */
export function saveAgent(brainPath, id, patch) {
  const base = defaults(); if (!base.some(a => a.id === id)) return { problems: [`"${id}" is not one of the 35 seats`] };
  const has = p => { const d = read(p); return d && !d.__error && Array.isArray(d.agents) && d.agents.some(a => a && a.id === id); };
  const target = has(LOCAL) ? LOCAL : brainFile(brainPath);
  const doc = read(target); if (doc && doc.__error) return { problems: [`${path.basename(target)} is not valid JSON — fix it before editing here`] };
  const d = doc && Array.isArray(doc.agents) ? doc : { agents: [] };
  let e = d.agents.find(a => a && a.id === id); if (!e) { e = { id }; d.agents.push(e); }
  for (const k of EDITABLE) if (patch[k] !== undefined) e[k] = patch[k];
  const check = validate({ agents: [e] }, base).problems;
  if (check.length) return { problems: check };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d, null, 2) + '\n'); renombrar(tmp, target);
  const r = loadRoster(brainPath);
  return { agent: r.agents.find(a => a.id === id), problems: [], file: target };
}
