// Agents Office — the local server (Beta).
// Serves the office and makes it real on your own Claude login:
//   · the command bar routes a typed task through Claude to the right agent in the department
//   · the agent produces the deliverable, which is saved as a note in your brain folder
//   · the Brain is your vault's real wiki-link graph, rebuilt live as notes are written
//   · chat with any agent is a real conversation in that agent's persona, grounded in your notes
// Everything stays on this machine: data/tasks.json and <brain>/Agents Office/*.md.
//
//   npm start                 → http://localhost:4520
//   PORT=4600 npm start       → another port
//
// Claude backend: the Claude Code CLI (`claude -p`, your existing login) — or the official SDK
// if ANTHROPIC_API_KEY is set. AO_MODEL=<model> overrides the model.
//
// V3.1: the connectors are real — the MCP servers your Claude Code is connected to are what the
// top bar shows and what the agents can call (mcp.mjs); the roster is yours (office.agents.json,
// roster.mjs). Tool calls only happen on the CLI backend: the SDK path has no MCP servers.
// V3.2: how the work is done is yours too — each agent's `brief` (roster.mjs) and the skills
// bound to it (skills.mjs: skills/ + <brain>/Agents Office/skills/) go into every task and chat.
// V3.3: the agents learn — every "revise: …" is recorded and standing rules come back into the
// prompt (learn.mjs); a department lead interviews the owner in chat and writes the briefs and a
// skill for its team (onboard.mjs). Roster, skills and lessons are re-read before every task.
// V3.5: routines — the office keeps its own clock (routines.mjs + src/when.js). A routine in
// <brain>/Agents Office/routines.json fires at its minute whether or not the page is open; the
// server creates the task, runs it here, and a result that needs the owner's OK waits in
// WAITING ON APPROVAL until /approve (the agent then does the outbound step) or /reject (with a
// note, which the agent learns from). Emails, Accounting and Sales only in this release.
// V3.2 (16 Sep): AGENT TEAMS + CLAUDE IN CHROME. A team task (TEAM in the bar, "as a team" in the sentence,
// `team: true` on a routine) goes to the department lead, who plans the pieces; the office runs one
// Claude process per teammate at the same time (teams.mjs, pool of `teams.max`), keeps the shared
// piece list and the notes they leave each other on the task (`task.team`, polled by the page), and
// the lead writes the finished deliverable from the pieces. Every `claude -p` gets --chrome when
// `tools.browser` is on: the agents can drive the owner's own Chrome (mcp.mjs).
// V3.2.1: the CALENDAR (P). A task can be scheduled for a date (`at` on POST /api/tasks → state
// 'scheduled', `dueAt`; the clock below fires it, marked LATE if the office was off) and a routine
// can start from a date (`when.start`, src/when.js). Cancel = DELETE /api/tasks/:id.
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { loadConfig, ROOT } from './config.mjs';
import { layoutGraph, readVault, readOfficeNotes } from './graph-build.mjs';
import { DEPTS, DEPT_KEYS } from './src/data.js';
import * as mcp from './mcp.mjs';
import { loadRoster } from './roster.mjs';
import { loadSkills } from './skills.mjs';
import * as learn from './learn.mjs';
import * as onboard from './onboard.mjs';
import * as routines from './routines.mjs';
import * as usage from './usage.mjs';
import * as teams from './teams.mjs';
import * as sub from './sub.mjs';
import { normModel, modelFor, modelArgs, modelId, modelName, MODEL_KEYS, DEFAULT_MODEL, normEffort, effortFor, effortName, EFFORT_KEYS } from './src/models.js';
import { parseWhen, describe, valid as validWhen, untilText } from './src/when.js';

const cfg = loadConfig();
const HTML = path.join(ROOT, 'dist', 'command-centre-v2.html'); // built by build.mjs; shipped so npm start works without a build
const DATA = process.env.AO_DATA ? path.resolve(process.env.AO_DATA) : path.join(ROOT, 'data'); // AO_DATA: another data folder (npm run check uses a throwaway one, never the owner's)
const FILE = path.join(DATA, 'tasks.json');
const BRAIN = cfg.brainPath;
const NOTES_DIR = path.join(BRAIN, 'Agents Office');
const CLI_CWD = path.join(os.tmpdir(), 'agents-office-cli'); // an empty cwd: no CLAUDE.md, no repo context
const version = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; } catch { return '?'; } })();
const RUN_TIMEOUT = Math.max(60, +cfg.timeout || 300) * 1000; // agents with tools take longer than a plain draft
{ const m = normModel(cfg.model); if (cfg.model && !m) console.warn(`config: model must be sonnet, opus or fable (got "${cfg.model}") — using ${DEFAULT_MODEL}`); cfg.model = m || DEFAULT_MODEL; } // V3.6: three models, by name
{ const e = normEffort(cfg.effort); if (cfg.effort && !e) console.warn(`config: effort must be low, medium, high, xhigh or max (got "${cfg.effort}") — using the model's own`); cfg.effort = e || ''; } // V3.6.1: the office's effort, empty = the model's own
mcp.configure(cfg);
const TEAMS = teams.settings(cfg); // V3.2 (16 Sep): { enabled, max }
const roster = loadRoster(BRAIN);
const AGENTS = roster.agents; // id · department · lead · name · role · does · tools · brief
for (const w of roster.problems) console.warn('agents:', w);
let skills = loadSkills(BRAIN, AGENTS); // reloaded before every task and chat, so a new skill needs no restart
for (const w of skills.problems) console.warn('skills:', w);
// the roster's editable fields are re-read too (a brief written by the lead's interview, or by hand, lands without a restart)
function reloadRoster() {
  const r = loadRoster(BRAIN);
  for (const a of r.agents) { const cur = AGENTS.find(x => x.id === a.id); if (cur) Object.assign(cur, { name: a.name, role: a.role, does: a.does, tools: a.tools, brief: a.brief, model: a.model, effort: a.effort }); }
  if (r.problems.join() !== roster.problems.join()) for (const w of r.problems) console.warn('agents:', w);
  Object.assign(roster, { problems: r.problems, customised: r.customised, briefed: r.briefed, files: r.files });
}
const refreshSkills = () => { reloadRoster(); const s = loadSkills(BRAIN, AGENTS); if (s.problems.join() !== skills.problems.join()) for (const w of s.problems) console.warn('skills:', w); skills = s; return s; };
const leadOf = dept => AGENTS.find(a => a.department === dept && a.lead) || AGENTS.find(a => a.department === dept);
const setupMap = () => Object.fromEntries(DEPT_KEYS.map(k => [k, onboard.isSetUp(AGENTS, skills, k)]));

let backend = 'claude-cli', sdk = null;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    sdk = new Anthropic(); backend = 'anthropic-sdk';
  } catch (e) { console.warn('SDK not installed (npm install @anthropic-ai/sdk) — using the Claude CLI:', e.message.split('\n')[0]); }
}

/* ---------- storage ---------- */
// a missing file is an empty office; an unreadable one is NOT (reading it as [] and saving would wipe every task): it is kept aside and the request fails
const load = () => {
  let raw; try { raw = fs.readFileSync(FILE, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  try { return JSON.parse(raw); } catch {
    const aside = FILE.replace(/\.json$/, `.unreadable-${Date.now()}.json`); try { fs.copyFileSync(FILE, aside); } catch {}
    console.error(`tasks.json could not be read — a copy is at ${aside}`); throw new Error('no se pudo leer data/tasks.json (se guardó una copia al lado)');
  }
};
{ // one copy a day of the tasks and the routines file, the last 14 kept: data/backups/
  const dir = path.join(DATA, 'backups'), day = new Date().toISOString().slice(0, 10);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const [src, name] of [[FILE, 'tasks'], [routines.file(BRAIN), 'routines']]) { const dest = path.join(dir, `${name}-${day}.json`); if (fs.existsSync(src) && !fs.existsSync(dest)) fs.copyFileSync(src, dest); }
    const all = fs.readdirSync(dir).filter(f => /^(tasks|routines)-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const kind of ['tasks', 'routines']) { const mine = all.filter(f => f.startsWith(kind + '-')); for (const f of mine.slice(0, -14)) fs.rmSync(path.join(dir, f), { force: true }); }
  } catch (e) { console.warn('backup:', e.message); }
}
const save = list => { fs.mkdirSync(DATA, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(list, null, 2)); fs.renameSync(tmp, FILE); }; // write-then-rename: never a half-written tasks.json
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* ---------- the usage gauge (V3.6, A3): Claude's own numbers, the office's count underneath ---------- */
const USTATE = usage.loadState(DATA);
let usageCache = { at: 0, value: null, stale: true };
async function getUsage(force) {
  if (!force && !usageCache.stale && usageCache.value && Date.now() - usageCache.at < 60000) return usageCache.value;
  const u = await usage.fetchUsage();
  const v = u.ok ? { ...u, office: usage.fallback(USTATE).window } : { ...usage.fallback(USTATE), reason: u.reason };
  usageCache = { at: Date.now(), value: v, stale: false };
  return v;
}
function bumpUsage(u) { if (!u) return; Object.assign(USTATE, usage.record(USTATE, u)); usage.saveState(DATA, USTATE); usageCache.stale = true; }
const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); // «qué» → «que», not «qu»
const localDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }; // the owner's calendar day, not UTC's

/* ---------- ask Claude ---------- */
// askX → { text, tools }: tools = the MCP/web tools the agent actually called (for the office to
// light up). On the CLI the agent gets --allowedTools = every connected server the config allows
// (+ web); file tools, Bash and sub-agents stay off — the office is not a coding session.
// the model the agent's turn ran on: a --chrome run (V3.2 (16 Sep)) also reports a small Haiku helper call in modelUsage, so the first key is not the answer —
// prefer the key of the family we asked for, else the biggest non-Haiku talker
function ranOn(mu, want) {
  const keys = Object.keys(mu || {}); if (!keys.length) return null;
  const fam = normModel(want) || cfg.model;
  return keys.find(k => k.includes(fam)) || keys.filter(k => !/haiku/.test(k)).sort((a, b) => (mu[b].outputTokens || 0) - (mu[a].outputTokens || 0))[0] || keys[0];
}
// every `claude` the office started, so a timeout, a restart or Ctrl+C never leaves one behind still sending (Windows: the whole tree, MCP servers included)
const children = new Set();
const runsOf = new Map(); // task id → Set of its claude processes (a team has several)
const stopping = new Set(); // task ids the owner stopped: their failure reads «stopped by you», not an error
function killTree(p) {
  if (!p || p.exitCode !== null) return;
  if (process.platform === 'win32') { try { spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { try { p.kill(); } catch {} } }
  else try { p.kill('SIGKILL'); } catch {}
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { for (const p of children) killTree(p); process.exit(0); });
process.on('exit', () => { for (const p of children) killTree(p); });
async function askX(system, user, { maxTokens = 4000, tools = true, timeout = RUN_TIMEOUT, model = cfg.model, effort = null, agent = null, taskId = null } = {}) { // agent: whose desk — its department's connectors (mcp.departments) + its own `tools` // model: sonnet · opus · fable · effort: low…max or null = the model's own (src/models.js)
  if (sdk) {
    const res = await sdk.messages.create({ model: modelId(model), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
    if (res.stop_reason === 'refusal') throw new Error('Claude declined this request');
    bumpUsage(res.usage);
    return { text: res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim(), tools: [], usage: res.usage, modelId: res.model };
  }
  fs.mkdirSync(CLI_CWD, { recursive: true });
  const allowed = tools ? mcp.allowedTools(agent) : [];
  // the system prompt goes in a file and the request on stdin: skills + notes + a revise can pass Windows' 32,767-character command line
  const sysFile = path.join(CLI_CWD, `system-${nid()}.txt`); fs.writeFileSync(sysFile, system);
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--system-prompt-file', sysFile,
    '--disallowedTools', ['Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'Agent', 'NotebookEdit', 'Task', ...(allowed.includes('WebFetch') ? [] : ['WebFetch', 'WebSearch']), ...mcp.disallowedTools(agent, tools)].join(',')];
  if (allowed.length) args.push('--allowedTools', allowed.join(','));
  args.push(...(tools ? mcp.cliArgs() : ['--no-chrome'])); // V3.2 (16 Sep): the owner's Chrome, when tools.browser is on
  args.push(...modelArgs(model, effort));
  const env = { ...process.env }; delete env.CLAUDECODE; // the CLI refuses to nest inside another Claude Code session
  return new Promise((resolve, reject) => {
    const p = spawn(mcp.CLAUDE_BIN, args, { cwd: CLI_CWD, env, stdio: ['pipe', 'pipe', 'pipe'] });
    children.add(p);
    if (taskId) { if (!runsOf.has(taskId)) runsOf.set(taskId, new Set()); runsOf.get(taskId).add(p); }
    p.stdin.on('error', () => {}); p.stdin.end(user);
    const cleanup = () => { children.delete(p); if (taskId && runsOf.has(taskId)) { runsOf.get(taskId).delete(p); if (!runsOf.get(taskId).size) runsOf.delete(taskId); } fs.rm(sysFile, { force: true }, () => {}); };
    let out = '', err = '', text = '', used = [], gotResult = false, isError = false, usageOut = null, modelUsed = null;
    const timer = setTimeout(() => { killTree(p); reject(new Error(`Claude took longer than ${timeout / 1000} s`)); }, timeout);
    const feed = line => {
      if (!line.trim()) return;
      let j; try { j = JSON.parse(line); } catch { return; }
      if (j.type === 'system' && j.subtype === 'init') mcp.fromInit(j);
      if (j.type === 'assistant' && j.message?.content) for (const b of j.message.content) if (b.type === 'tool_use' && b.name && !used.includes(b.name)) used.push(b.name);
      if (j.type === 'result') { gotResult = true; text = String(j.result || '').trim(); isError = !!j.is_error; usageOut = j.usage || null; modelUsed = ranOn(j.modelUsage, model); }
    };
    p.stdout.on('data', d => { out += d; let i; while ((i = out.indexOf('\n')) >= 0) { feed(out.slice(0, i)); out = out.slice(i + 1); } });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(timer); cleanup(); reject(new Error(e.code === 'ENOENT' ? 'Claude Code is not installed (claude not found on PATH — set CLAUDE_BIN to claude.exe)' : e.message)); });
    p.on('close', code => {
      clearTimeout(timer); cleanup(); feed(out);
      if (code !== 0 && !gotResult) return reject(new Error(`claude exited ${code}${err ? ': ' + err.trim().slice(0, 300) : ''}`));
      if (!gotResult) { try { text = String(JSON.parse(out).result || '').trim(); } catch { text = out.trim(); } }
      bumpUsage(usageOut);
      if (isError) return reject(new Error(text || 'Claude reported an error with no message')); // an API error is not a deliverable: never saved as a note
      resolve({ text, tools: used, usage: usageOut, modelId: modelUsed });
    });
  });
}
const ask = async (system, user, opts) => (await askX(system, user, { tools: false, ...opts })).text;
function parseJSON(text) {
  const s = text.replace(/```json|```/g, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}');
  return JSON.parse(s.slice(a, b + 1));
}

/* ---------- the brain: graph + context ---------- */
let graph = { notes: 0, nodes: [], links: [], floor: [] };
async function rebuildGraph() {
  try { graph = await layoutGraph(BRAIN); } catch (e) { console.warn('brain graph failed:', e.message); }
  return graph;
}
function vaultIndex() { // name → text (vault notes + live office notes)
  const { notes } = readVault(BRAIN); const m = new Map();
  for (const [name, n] of notes) m.set(name, n.text);
  for (const n of readOfficeNotes(BRAIN)) m.set(n.name, n.text);
  return m;
}
function businessContext(index) {
  const bits = [];
  for (const k of ['CLAUDE', 'index', 'business-model', 'voice']) if (index.has(k)) bits.push(`--- ${k}.md ---\n${index.get(k).slice(0, 1200)}`);
  return bits.join('\n\n');
}
// the notes an agent would read for this task: name/word overlap, department MOC first
function relevantNotes(index, dept, text, n = 4) {
  const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); // «página» → «pagina», so Spanish words are not split at the accent
  const words = new Set(fold(text).split(/[^a-z0-9]+/).filter(w => w.length > 3));
  const mocName = { emails: 'MOC-Emails', sales: 'MOC-Sales', marketing: 'MOC-Marketing', ops: 'MOC-Operations', fin: 'MOC-Finance', delivery: 'MOC-Delivery' }[dept];
  const scored = [];
  for (const [name, txt] of index) {
    if (['CLAUDE', 'index', 'log'].includes(name)) continue;
    const hay = fold(name + ' ' + txt.slice(0, 1500));
    let s = 0; for (const w of words) if (hay.includes(w)) s += fold(name).includes(w) ? 3 : 1;
    if (name === mocName) s += 2;
    if (s) scored.push([s, name]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const picks = scored.slice(0, n).map(x => x[1]);
  if (mocName && index.has(mocName) && !picks.includes(mocName)) picks.push(mocName);
  return picks;
}
function contextText(index, names) {
  return names.map(n => `--- ${n}.md ---\n${(index.get(n) || '').slice(0, 1800)}`).join('\n\n');
}

/* ---------- the roster, as Claude sees it ---------- */
const persona = a => `${a.name}${a.lead ? ' (lead)' : ''} · ${a.role} · ${a.does}`;
function rosterText(dept) { return AGENTS.filter(a => a.department === dept).map(a => { const sk = skills.names(a); return `- ${a.id} · ${persona(a)}${sk.length ? ' · skills: ' + sk.join(', ') : ''}`; }).join('\n'); }
// what an agent is told about itself: the job, the owner's standing instructions, the skills it follows
function agentBrief(a) {
  const lessons = learn.promptText(BRAIN, a);
  return (a.brief ? `\nSTANDING INSTRUCTIONS FROM THE OWNER\n${a.brief}\n` : '') + (skills.promptText(a) ? `\n${skills.promptText(a)}\n` : '') + (lessons ? `\n${lessons}\n` : '');
}
const toolKeys = names => [...new Set(names.map(n => /^mcp__/.test(n) ? mcp.keyOf(n) : n === 'WebSearch' || n === 'WebFetch' ? 'web' : null).filter(Boolean))];
async function route(dept, text) {
  const d = DEPTS[dept]; refreshSkills();
  const system = `You are the router for ${cfg.name}, a business whose departments are run by AI agents. ` +
    'Pick the single best agent for the owner\'s request — an agent whose skills match the request is the right one — and return ONLY a JSON object — no prose, no code fences.';
  const user = `Department: ${d.name}\nAgents (id · name · role · what they do):\n${rosterText(dept)}\n\nOwner's request: "${text}"\n\n` +
    'Return: {"agent":"<id from the list>","title":"<clean imperative task title, max 70 characters>","plan":["<step>","<step>","<step>"],"eta_minutes":<integer>,"why":"<one short sentence>","needs_ok":<true if doing this involves sending, posting, paying, deleting or changing anything outside this machine; false if it only reads and reports>}';
  const j = parseJSON(await ask(system, user, { maxTokens: 800, timeout: 150000, model: 'sonnet' })); // routing is a one-line JSON job: always Sonnet
  const valid = AGENTS.find(a => a.id === j.agent && a.department === dept);
  const agent = valid ? valid.id : (AGENTS.find(a => a.department === dept && a.lead) || AGENTS.find(a => a.department === dept)).id;
  return { agent, title: String(j.title || text).slice(0, 90), plan: Array.isArray(j.plan) ? j.plan.slice(0, 4).map(String) : [],
    eta: Number.isFinite(j.eta_minutes) ? j.eta_minutes : 30, why: String(j.why || ''), needsOk: typeof j.needs_ok === 'boolean' ? j.needs_ok : routines.guessNeedsOk(text) };
}
// the system prompt every agent run starts from: who it is, its brief, skills and lessons, its tools, the company, the notes for this task
function agentSystem(a, index, read, { extra = '', words = 260 } = {}) {
  const d = DEPTS[a.department];
  return `You are ${a.name}, ${a.role || 'an agent'}, in the ${d.name} department of ${cfg.name}. ${a.does}\n${agentBrief(a)}` + (extra ? `\n${extra}\n` : '') +
    'Escribe el entregable terminado en sí, no una descripción de lo que harías. Texto plano: un encabezado corto, luego secciones cortas o viñetas. ' +
    `Como máximo ${words} palabras, salvo que una skill o las instrucciones del dueño indiquen otra forma — eso prevalece. Sin preámbulo, sin despedida. Apóyalo en las notas de la empresa de abajo; donde falte un dato, haz una suposición razonable y márcala (assumed). ` +
    'Si usaste una herramienta, dilo en una línea al final ("Used: Gmail — searched the client thread").\n\n' +
    `${mcp.promptText(a)}\n\nCOMPANY NOTES\n${businessContext(index)}\n\nNOTES YOU READ FOR THIS TASK\n${contextText(index, read)}`;
}
const modeLineFor = (mode, task) => mode === 'draft' ? '\nPrepare everything, but send, post, pay or change NOTHING outside this machine: the owner reads this first and approves it. End with one line saying exactly what will go out when approved (or that nothing needs to).'
  : mode === 'approve' ? `\nThe owner has APPROVED the draft below. Carry out the outbound step now, exactly as drafted, with your tools (send, post, update). If a tool you need is not connected, say so and show what you would have sent. Then report in one short section: what went out, to whom, and anything that did not.\nApproved draft:\n${task.draft || task.result}` : '';
const pickFor = (task, a) => { // model + effort: four places, one precedence (task > routine > agent > office)
  const pick = modelFor({ task: task.model, routine: task.routineModel, agent: a.model, office: cfg.model });
  const eff = effortFor({ task: task.effort, routine: task.routineEffort, agent: a.effort, office: cfg.effort, model: pick.model });
  return { pick, eff };
};
// persist a task mid-run (a team's pieces move while the run is still going; the page polls /api/tasks)
function persist(task) { const l = load(); const i = l.findIndex(t => t.id === task.id); if (i >= 0) { l[i] = task; save(l); } }
async function run(task, feedback, mode) { // mode: undefined (a task from the bar) · 'routine' (read-only routine) · 'draft' (routine that waits for the OK) · 'approve' (the owner ticked it)
  if (task.team && TEAMS.enabled) { // V3.2 (16 Sep): a team task — the lead plans, the desks work at once, the lead writes the final
    if (mode === 'approve') return runTeamLead(task, feedback, mode); // the outbound step after the OK is the lead's alone
    if (feedback && task.team.pieces?.length) return runTeamLead(task, feedback, mode); // "revise: …" reworks the final from the same pieces
    return runTeam(task, mode);
  }
  const a = AGENTS.find(x => x.id === task.agent);
  refreshSkills();
  const index = vaultIndex();
  const read = relevantNotes(index, a.department, task.title + ' ' + task.text);
  const system = agentSystem(a, index, read);
  const routineLine = task.routine ? `\nThis is a routine (${task.when}): it runs on the office's own clock and the owner is not at the keyboard. It is now ${new Date().toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}${task.late ? `; this run is late, it was due ${new Date(task.due).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}. Do the work for now.`
    : task.dueAt ? `\nThis task was scheduled in advance for ${new Date(task.dueAt).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} and is running now; the owner is not at the keyboard${task.late ? ' and this run is late' : ''}. Do the work for now.` : '';
  const modeLine = modeLineFor(mode, task);
  const user = `Task: ${task.title}\nOwner's request: ${task.text}` + (task.plan?.length ? `\nAgreed plan: ${task.plan.join(' → ')}` : '') + routineLine + modeLine +
    (feedback && mode !== 'approve' ? `\n\nThe owner reviewed your previous version and asked for changes: "${feedback}"\nPrevious version:\n${task.result}` : '');
  const { pick, eff } = pickFor(task, a);
  const { text, tools, modelId: ran } = await askX(system, user, { model: pick.model, effort: eff.effort, agent: a, taskId: task.id });
  if (!text) throw new Error('Claude returned nothing');
  return { result: text, read, tools: toolKeys(tools), used: mcp.namesOf(tools), skills: skills.names(a), modelUsed: pick.model, modelFrom: pick.from, modelId: ran, effortUsed: eff.effort || '', effortFrom: eff.from };
}

/* ---------- V3.2 (16 Sep) Agent Teams: the lead plans, the desks work at once, the lead writes the final ---------- */
const nameOf = id => id === 'lead' ? 'the lead' : (AGENTS.find(a => a.id === id)?.name || id);
const routineLineFor = task => task.routine ? `\nThis is a routine (${task.when}): it runs on the office's own clock and the owner is not at the keyboard. It is now ${new Date().toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. Do the work for now.`
  : task.dueAt ? `\nThis task was scheduled in advance for ${new Date(task.dueAt).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} and is running now; the owner is not at the keyboard. Do the work for now.` : '';
async function runTeam(task, mode) {
  const lead = AGENTS.find(x => x.id === task.agent), dept = lead.department;
  refreshSkills();
  const index = vaultIndex();
  const seats = AGENTS.filter(a => a.department === dept).map(a => ({ id: a.id, lead: a.lead, name: a.name, role: a.role, does: a.does, skills: skills.names(a) }));
  const max = Math.min(TEAMS.max, teams.askedSize(task.text) || TEAMS.max);
  // 1. the plan — the lead splits the request across the desks (Sonnet, no tools: a JSON job)
  const pp = teams.planPrompt({ business: cfg.name, deptName: DEPTS[dept].name, lead, seats, text: task.text, title: task.title, max, notes: contextText(index, relevantNotes(index, dept, task.title + ' ' + task.text, 3)).slice(0, 4000) });
  let plan;
  try { plan = teams.parsePlan(await ask(pp.system, pp.user, { maxTokens: 1400, timeout: 150000, model: 'sonnet' }), { seats, lead, max, fallback: task }); }
  catch (e) { plan = { pieces: [{ agent: lead.id, title: task.title, text: task.text }], why: '', solo: true, error: e.message }; }
  task.team = { ...(task.team || {}), lead: lead.id, max, pieces: plan.pieces.map(p => ({ ...p, state: 'next' })), messages: [], why: plan.why, solo: plan.solo, plannedAt: Date.now() };
  persist(task);
  console.log(`  ⚑ ${task.id} team of ${plan.pieces.length}: ${plan.pieces.map(p => p.agent).join(' + ')}${plan.why ? ' — ' + plan.why : ''}`);
  // 2. the pieces — one Claude process per desk, at the same time (at most `max` in flight)
  const ids = task.team.pieces.map(p => p.agent);
  await teams.pool(task.team.pieces, max, async piece => {
    const a = AGENTS.find(x => x.id === piece.agent);
    piece.state = 'doing'; piece.startedAt = Date.now(); persist(task);
    try {
      const read = relevantNotes(index, dept, piece.title + ' ' + piece.text, 3);
      const system = agentSystem(a, index, read, { extra: teams.teamSection({ me: a, lead, pieces: task.team.pieces, nameOf }), words: 220 });
      const user = `Task (the whole request, for context): ${task.title}\nOwner's request: ${task.text}\n\nYOUR PIECE: ${piece.title}\n${piece.text}` + routineLineFor(task) + (mode === 'draft' ? modeLineFor('draft', task) : '');
      const { pick, eff } = pickFor(task, a);
      const { text, tools, modelId: ran } = await askX(system, user, { model: pick.model, effort: eff.effort, agent: a, taskId: task.id });
      const { body, messages } = teams.parseMessages(text, ids);
      Object.assign(piece, { result: body || '(empty)', tools: toolKeys(tools), used: mcp.namesOf(tools), read, modelId: ran, error: !text });
      for (const m of messages) task.team.messages.push({ from: a.id, to: m.to === lead.id ? 'lead' : m.to, text: m.text, at: Date.now() });
    } catch (e) { Object.assign(piece, { result: 'Could not complete this piece: ' + e.message, error: true }); }
    piece.state = 'done'; piece.doneAt = Date.now(); persist(task);
    console.log(`    ${piece.error ? '✗' : '✓'} ${a.name}: ${piece.title} (${(piece.result || '').length} chars${piece.tools?.length ? ', tools: ' + piece.tools.join(' ') : ''})`);
  });
  // 3. the final — the lead writes the deliverable from the pieces and the notes
  return runTeamLead(task, null, mode);
}
async function runTeamLead(task, feedback, mode) {
  const lead = AGENTS.find(x => x.id === task.agent), tm = task.team;
  refreshSkills();
  const index = vaultIndex();
  const read = relevantNotes(index, lead.department, task.title + ' ' + task.text);
  const system = agentSystem(lead, index, read, { extra: `TEAM\nYou lead this team. The pieces below were done by your teammates (one of them may be yours). You write the finished deliverable from them.`, words: 450 });
  const user = teams.synthPrompt({ task, pieces: tm.pieces || [], messages: tm.messages || [], nameOf, feedback: mode === 'approve' ? null : feedback }) + routineLineFor(task) + modeLineFor(mode, task);
  const { pick, eff } = pickFor(task, lead);
  const { text, tools, modelId: ran } = await askX(system, user, { model: pick.model, effort: eff.effort, maxTokens: 6000, agent: lead, taskId: task.id });
  if (!text) throw new Error('Claude returned nothing');
  const allTools = [...new Set([...(tm.pieces || []).flatMap(p => p.tools || []), ...toolKeys(tools)])];
  const allUsed = [...new Set([...(tm.pieces || []).flatMap(p => p.used || []), ...mcp.namesOf(tools)])];
  const allRead = [...new Set([...read, ...(tm.pieces || []).flatMap(p => p.read || [])])];
  return { result: text, read: allRead, tools: allTools, used: allUsed, skills: skills.names(lead), modelUsed: pick.model, modelFrom: pick.from, modelId: ran, effortUsed: eff.effort || '', effortFrom: eff.from, team: tm };
}
function writeNote(task) { // the deliverable becomes a note in the brain, linked to what was read
  fs.mkdirSync(NOTES_DIR, { recursive: true });
  const a = AGENTS.find(x => x.id === task.agent);
  const base = `${localDay(task.doneAt)} ${slug(task.title)}`;
  let name = base; // the same task re-run (a revise) keeps its note; another task with the same title that day gets «-2», never overwrites
  for (let n = 2; fs.existsSync(path.join(NOTES_DIR, name + '.md')) && !fs.readFileSync(path.join(NOTES_DIR, name + '.md'), 'utf8').includes(`\ntask: ${task.id}\n`); n++) name = `${base}-${n}`;
  const body = `---\nagent: ${a.name}\ndepartment: ${DEPTS[a.department].name}\ntask: ${task.id}\ndone: ${new Date(task.doneAt).toISOString()}${task.used?.length ? '\ntools: ' + task.used.join(', ') : ''}${task.skills?.length ? '\nskills: ' + task.skills.join(', ') : ''}${task.routine ? '\nroutine: ' + task.when + (task.late ? ' (late)' : '') : ''}${task.modelUsed ? '\nmodel: ' + modelName(task.modelUsed) + (task.modelFrom && task.modelFrom !== 'office' ? ' (' + task.modelFrom + ')' : '') : ''}${task.effortUsed ? '\neffort: ' + task.effortUsed + (task.effortFrom && task.effortFrom !== 'model' ? ' (' + task.effortFrom + ')' : '') : ''}${task.approved ? '\napproved: ' + new Date(task.approvedAt).toISOString() : ''}${task.team?.pieces?.length ? '\nteam: ' + task.team.pieces.map(p => nameOf(p.agent)).join(', ') : ''}\n---\n` +
    `# ${task.title}\n\n${task.result}\n\n---\nRead: ${(task.read || []).map(n => `[[${n}]]`).join(' · ') || '—'}\n` + teams.noteExtra(task.team, nameOf);
  fs.writeFileSync(path.join(NOTES_DIR, name + '.md'), body);
  return name;
}
async function chat(agentId, text, history) {
  const a = AGENTS.find(x => x.id === agentId); if (!a) throw new Error('unknown agent');
  const d = DEPTS[a.department]; refreshSkills();
  const index = vaultIndex();
  const read = relevantNotes(index, a.department, text, 3);
  const mine = load().filter(t => t.agent === agentId).slice(-6).map(t => `- [${t.state}] ${t.title}`).join('\n');
  const system = `You are ${a.name}, ${a.role || 'an agent'}, in the ${d.name} department of ${cfg.name}. ${a.does}\n${agentBrief(a)}` +
    'You are talking to the owner. Answer as this agent, in first person, briefly (under 120 words unless asked for detail), plainly, no hype. ' +
    'Use the company notes; say when something is not in them. If the owner asks you to look something up, use your tools. Nothing outbound is sent without the owner\'s explicit say-so.\n\n' +
    `${mcp.promptText(a)}\n\nCOMPANY NOTES\n${businessContext(index)}\n\nRELEVANT NOTES\n${contextText(index, read)}\n\nYOUR RECENT TASKS\n${mine || '—'}`;
  const convo = (history || []).slice(-8).map(m => `${m.who === 'user' ? 'Dueño' : a.name}: ${m.text}`).join('\n');
  const { text: reply, tools } = await askX(system, (convo ? convo + '\n' : '') + `Dueño: ${text}\n${a.name}:`, { maxTokens: 1200, agent: a, model: modelFor({ agent: a.model, office: cfg.model }).model, effort: effortFor({ agent: a.effort, office: cfg.effort, model: modelFor({ agent: a.model, office: cfg.model }).model }).effort });
  return { reply, read, tools: toolKeys(tools), used: mcp.namesOf(tools) };
}

/* ---------- a new task: the department's routing picks the desk (or the lead takes it as a team) ---------- */
async function newTask({ dept, text, team = false, at = null, by = 'you', model, effort, extra = {} }) {
  const r = await route(dept, String(text).trim());
  const asTeam = TEAMS.enabled && (team === true || teams.intent(text));
  const task = { id: nid(), dept, agent: asTeam ? leadOf(dept).id : r.agent, title: extra.title || r.title, text: String(text).trim(), plan: r.plan, eta: r.eta, why: asTeam ? `team — ${leadOf(dept).name} splits it across the desks` : r.why, state: 'next', addedAt: Date.now(), by,
    model: normModel(model) || undefined, effort: normEffort(effort) || undefined, team: asTeam ? { lead: leadOf(dept).id, asked: by } : undefined, ...extra };
  if (at) { task.state = 'scheduled'; task.dueAt = at; task.needsOk = r.needsOk; }
  const list = load(); list.push(task); save(list);
  console.log(`+ ${task.id} → ${task.agent}: ${task.title}${asTeam ? ' (team)' : ''}${at ? ' · scheduled ' + untilText(at) : ''}${by === 'sub' ? ' (via the Subgerente)' : ''}`);
  return task;
}

/* ---------- the Subgerente: one chat above the departments (sub.mjs) ---------- */
async function subChat(text) {
  const st = sub.load(DATA); refreshSkills();
  const system = sub.systemPrompt({ business: cfg.name, depts: DEPTS, agents: AGENTS, skillsOf: a => skills.names(a), routineDepts: routines.ALLOWED.map(k => DEPTS[k].name), status: sub.statusText(load(), AGENTS, DEPTS) });
  const convo = st.messages.slice(-10).map(m => `${m.who === 'user' ? 'Dueño' : 'Subgerente'}: ${m.text}${m.plan?.tasks?.length ? ' [repartí: ' + m.plan.tasks.map(t => `${t.title} → ${DEPTS[t.dept].name}${t.state === 'sent' ? ' (enviada)' : t.state === 'skipped' ? ' (descartada)' : ''}`).join('; ') + ']' : ''}`).join('\n');
  const out = await ask(system, (convo ? convo + '\n' : '') + `Dueño: ${text}\nSubgerente (solo JSON):`, { maxTokens: 3000, timeout: 180000 });
  const plan = sub.parsePlan(out, { depts: DEPTS, agents: AGENTS });
  const u = sub.message('user', text), m = sub.message('sub', plan.reply || (plan.tasks.length ? 'Así lo repartiría:' : '¿Me das un poco más de detalle?'), plan.tasks.length || plan.questions.length ? { plan: { tasks: plan.tasks, questions: plan.questions } } : {});
  st.messages.push(u, m); sub.save(DATA, st);
  console.log(`◆ subgerente: ${plan.tasks.length ? plan.tasks.length + ' piece' + (plan.tasks.length > 1 ? 's' : '') + ' → ' + plan.tasks.map(t => t.dept).join(', ') : 'reply'}`);
  return { messages: [u, m] };
}
async function subSend(msgId, edits) { // the owner pressed SEND: each included piece becomes a task in its department
  const st = sub.load(DATA); const m = st.messages.find(x => x.id === msgId);
  if (!m || !m.plan) return { error: 'ese plan ya no existe' };
  const byI = new Map((Array.isArray(edits) ? edits : []).map(e => [e.i, e]));
  const todo = [];
  for (const t of m.plan.tasks) {
    if (t.state !== 'proposed') continue;
    const e = byI.get(t.i) || {};
    if (e.include === false) { t.state = 'skipped'; continue; }
    if (e.dept && DEPTS[e.dept] && e.dept !== 'brain') t.dept = e.dept;
    if (typeof e.instruction === 'string' && e.instruction.trim()) t.instruction = e.instruction.trim().slice(0, 4000);
    if (typeof e.team === 'boolean') t.team = e.team;
    if (e.at === null) t.at = null; else if (typeof e.at === 'number' && e.at > Date.now()) t.at = e.at;
    todo.push(t);
  }
  if (!todo.length) { sub.save(DATA, st); return { ok: true, message: m, tasks: [] }; }
  const made = await Promise.all(todo.map(t => newTask({ dept: t.dept, text: t.instruction, team: t.team, at: t.at, by: 'sub', extra: { title: t.title, sub: { msg: m.id, i: t.i } } })
    .then(task => { t.state = 'sent'; t.taskId = task.id; t.agent = task.agent; return task; })
    .catch(err => { t.state = 'failed'; t.error = err.message; return null; })));
  const st2 = sub.load(DATA); const i = st2.messages.findIndex(x => x.id === m.id); if (i >= 0) st2.messages[i] = m; // re-read: another message may have landed while routing
  const sent = made.filter(Boolean);
  st2.messages.push(sub.message('sub', `Listo: envié ${sent.length} ${sent.length === 1 ? 'tarea' : 'tareas'} a ${[...new Set(sent.map(t => DEPTS[t.dept].name))].join(', ')}. Te aviso aquí cómo van.${todo.length > sent.length ? ` ${todo.length - sent.length} no se pudo enviar.` : ''}`));
  sub.save(DATA, st2);
  return { ok: true, message: m, tasks: sent, messages: st2.messages.slice(-2) };
}

/* ---------- routines: the office's own clock (V3.5) ---------- */
const RSTATE = routines.loadState(DATA);
let rlist = { routines: [], problems: [], path: routines.file(BRAIN) };
function loadRoutines() { // re-read from disk every time: a routine written by Claude Code, or by hand, lands without a restart
  const r = routines.load(BRAIN, AGENTS);
  if (r.problems.join() !== rlist.problems.join()) for (const w of r.problems) console.warn('routines:', w);
  rlist = r;
  const { list, changed } = routines.withState(r.routines, RSTATE);
  if (changed) routines.saveState(DATA, RSTATE);
  return list;
}
const routinesOut = () => { const list = loadRoutines(); return { routines: list, depts: routines.ALLOWED, path: rlist.path, problems: rlist.problems }; };
const agentName = id => AGENTS.find(a => a.id === id)?.name || id;
// routine-driven runs go one at a time, so a burst of catch-ups after a long sleep does not spawn five Claude processes at once
let queue = Promise.resolve();
const enqueue = fn => { const p = queue.then(fn, fn); queue = p.catch(e => console.error('run failed:', e.message)); return p; };
function fire(r, { due = Date.now(), late = false, by = 'routine' } = {}) { // the routine becomes a task and runs here, page or no page
  const task = { id: nid(), dept: r.dept, agent: r.agent, title: r.title, text: r.text, plan: r.plan || [], eta: 15, why: '', state: 'next', addedAt: Date.now(), by, routine: r.id, when: r.desc || describe(r.when), needsOk: r.needsOk, due, late, routineModel: r.model || undefined, routineEffort: r.effort || undefined, team: r.team && TEAMS.enabled ? { lead: r.agent, asked: 'routine' } : undefined };
  const list = load(); list.push(task); save(list);
  routines.advance(RSTATE, r, Date.now(), task.id, late); routines.saveState(DATA, RSTATE);
  console.log(`⏱ ${task.id} → ${task.agent}: ${task.title}${late ? ' (LATE · was due ' + new Date(due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ')' : ''}`);
  enqueue(() => runServerTask(task.id));
  return task;
}
async function runServerTask(id, { feedback, approve } = {}) {
  let list = load(); const task = list.find(t => t.id === id); if (!task) return null;
  task.state = 'doing'; task.startedAt = Date.now(); delete task.ask; save(list);
  try {
    const out = await run(task, feedback, approve ? 'approve' : task.needsOk ? 'draft' : 'routine');
    if (approve) { task.result = (task.draft || task.result) + '\n\n---\nAFTER YOUR OK\n' + out.result; task.approved = true; task.approvedAt = Date.now(); }
    else task.result = out.result;
    Object.assign(task, { read: out.read, tools: [...new Set([...(task.tools || []), ...out.tools])], used: [...new Set([...(task.used || []), ...out.used])], skills: out.skills, error: false, modelUsed: out.modelUsed, modelFrom: out.modelFrom, modelId: out.modelId, effortUsed: out.effortUsed, effortFrom: out.effortFrom, ...(out.team ? { team: out.team } : {}) });
    if (task.needsOk && !approve) { task.state = 'waiting'; task.draft = out.result; task.waitingAt = Date.now(); task.ask = routines.askLine(task); }
    else { task.state = 'done'; task.doneAt = Date.now(); task.note = writeNote(task); await rebuildGraph(); }
  } catch (e) {
    Object.assign(task, { state: 'done', doneAt: Date.now(), result: stopping.has(task.id) ? 'Detenida por ti antes de terminar.' : 'Could not complete this task: ' + e.message, error: true, stopped: stopping.has(task.id) || undefined });
  }
  stopping.delete(task.id);
  list = load(); const i = list.findIndex(t => t.id === task.id); if (i >= 0) list[i] = task; save(list);
  console.log(`${task.error ? '✗' : task.state === 'waiting' ? '⏸' : '✓'} ${task.id} ${task.error ? 'failed' : task.state === 'waiting' ? 'waiting for your OK' : 'done'} (${task.result.length} chars${task.tools?.length ? ', tools: ' + task.tools.join(' ') : ''}${task.note ? ', note: ' + task.note : ''})`);
  return task;
}
function tickRoutines() { // the clock never throws: an exception in a setInterval would stop the office
  try {
    let list; try { list = loadRoutines(); } catch (e) { console.warn('routines:', e.message); list = null; }
    if (list) for (const { routine, due, late } of routines.due(list, RSTATE)) fire(routine, { due, late });
    tickScheduled();
  } catch (e) { console.error('clock:', e.message); }
}
process.on('unhandledRejection', e => console.error('unhandled:', e && e.message || e)); // log it, keep the office up
process.on('uncaughtException', e => console.error('uncaught:', e && e.stack || e));
function tickScheduled() { // V3.2.1: a task scheduled for a date fires on its minute — late (once) if the office was off
  const now = Date.now(); let list = load(); let changed = false;
  for (const t of list) {
    if (t.state !== 'scheduled' || !(t.dueAt <= now)) continue;
    t.state = 'next'; t.due = t.dueAt; t.late = now - t.dueAt > routines.LATE_AFTER; t.addedAt = now; changed = true;
    console.log(`⏱ ${t.id} scheduled task fires → ${t.agent}: ${t.title}${t.late ? ' (LATE · was due ' + new Date(t.dueAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ')' : ''}`);
    enqueue(() => runServerTask(t.id));
  }
  if (changed) save(list);
}
const uniqueId = (base, list) => { let id = base || 'routine', n = 2; while (list.some(r => r.id === id)) id = `${base}-${n++}`; return id; };
// edits go to the file as it is on disk (routines.patchFile): saving the validated list would drop the routines the validator left out, and `team`
function editRoutine(id, patch) {
  const r = rlist.routines.find(x => x.id === id); if (!r) return null;
  if (!routines.patchFile(BRAIN, id, patch)) { Object.assign(r, patch); routines.save(BRAIN, rlist.routines); }
  if (patch.paused === false && RSTATE[id]) { RSTATE[id].nextAt = 0; routines.saveState(DATA, RSTATE); } // resumed: the next run is from now, not the one it slept through
  return loadRoutines().find(x => x.id === id);
}
function removeRoutine(id) {
  if (!rlist.routines.some(x => x.id === id)) return false;
  if (!routines.patchFile(BRAIN, id, null)) { rlist.routines = rlist.routines.filter(x => x.id !== id); routines.save(BRAIN, rlist.routines); }
  loadRoutines(); return true;
}
// a sentence (or the REPEAT picker) → a routine in the brain file. Claude names the agent, the title and whether it needs the OK.
async function makeRoutine({ dept, text, when, agent, needsOk, model, effort }) {
  let taskText = String(text || '').trim(), w = when, parsed = null;
  if (!w) {
    parsed = parseWhen(taskText);
    if (!parsed) return { error: 'No hay horario en esa frase. Di cuándo: "every weekday at 8am, …", "Mondays 9am, …", "every hour 9-5, …".', noSchedule: true };
    if (parsed.needsDay) return { error: '¿Qué día? Di "every Monday …" o "Mon and Thu …".', needsDay: true };
    if (parsed.needsTime) return { error: '¿A qué hora? Di "… at 8am" o "… at 17:30".', needsTime: true };
    w = parsed.when; taskText = parsed.text;
  }
  if (!validWhen(w)) return { error: 'Ese horario no está completo.' };
  if (!taskText) return { error: '¿Qué debe pasar? La frase tiene hora pero no tarea.' };
  loadRoutines();
  const r = await route(dept, taskText);
  const a = agent && AGENTS.find(x => x.id === agent && x.department === dept) ? agent : r.agent;
  const v = routines.validate({ id: uniqueId(slug(r.title).slice(0, 40), rlist.routines), dept, agent: a, title: r.title, text: taskText, when: w, needsOk: typeof needsOk === 'boolean' ? needsOk : r.needsOk, plan: r.plan, model: normModel(model) || undefined, effort: normEffort(effort) || undefined }, AGENTS, rlist.routines);
  if (v.problems.length) return { error: v.problems.join('; ') };
  rlist.routines.push(v.routine); routines.save(BRAIN, rlist.routines);
  const out = loadRoutines().find(x => x.id === v.routine.id);
  console.log(`⏱ routine ${out.id} → ${out.agent}: ${out.title} (${out.desc} · next ${untilText(out.nextAt)}${out.needsOk ? ' · waits for the OK' : ''})`);
  return { ok: true, routine: out, why: r.why, guessed: parsed?.guessed ? parsed.guessWord : null };
}
// B2: a routine said to an agent in chat. The lead routes it inside the department; a specialist takes it on.
async function routinesChat(a, text) {
  const t = String(text).trim(), dept = a.department, allowed = routines.ALLOWED.includes(dept);
  if (/^\s*(routines?|schedule|timetable|what(?:'s| is) (?:scheduled|on the (?:schedule|timetable)))\s*\??\s*$/i.test(t)) return { reply: allowed ? routines.listText(loadRoutines(), dept, AGENTS) : routines.refusal(dept) };
  const cmd = /^\s*(pause|stop|resume|start|unpause|delete|remove|run)\b\s*(?:the\s+)?(.*?)\s*[.!]?$/i.exec(t);
  if (cmd && allowed && !parseWhen(t)) {
    const list = loadRoutines(); const words = cmd[2].replace(/\s+(routine|one)$/i, ''); const r = routines.matchRoutine(list, dept, words);
    if (!r) return { reply: (list.some(x => x.dept === dept) ? '¿Cuál? ' : '') + routines.listText(list, dept, AGENTS) };
    const verb = cmd[1].toLowerCase();
    if (verb === 'run') { const task = fire(r, { by: 'you' }); return { reply: `Ejecutando "${r.title}" ahora — ${r.agent === a.id ? 'yo me encargo' : agentName(r.agent) + ' se encarga'}. Llega al panel${r.needsOk ? ' y espera tu visto bueno antes de enviar nada' : ''}.`, task }; }
    if (/pause|stop/.test(verb)) { editRoutine(r.id, { paused: true }); return { reply: `Pausada "${r.title}". Sigue en el horario; di "resume ${r.title.toLowerCase()}" para activarla de nuevo.` }; }
    if (/resume|start|unpause/.test(verb)) { const n = editRoutine(r.id, { paused: false }); return { reply: `"${r.title}" vuelve a estar activa — próxima ejecución ${untilText(n.nextAt)}.` }; }
    if (/delete|remove/.test(verb)) { removeRoutine(r.id); return { reply: `Eliminada "${r.title}". Fuera del horario.` }; }
  }
  const p = parseWhen(t);
  if (!p) return null;
  if (!allowed) return { reply: routines.refusal(dept) };
  if (p.needsDay) return { reply: '¿Qué día? Dilo de nuevo con el día: "every Monday at 9am, …".' };
  if (p.needsTime) return { reply: `¿A qué hora? Dilo de nuevo con la hora, p. ej. "every weekday at 8am, ${p.text ? p.text.slice(0, 60) : '…'}".` };
  if (!p.text) return { reply: 'Tengo la hora pero no la tarea. Dilo de nuevo con lo que debe pasar.' };
  const made = await makeRoutine({ dept, text: p.text, when: p.when, agent: a.lead ? undefined : a.id });
  if (made.error) return { reply: made.error };
  const r = made.routine, who = r.agent === a.id ? 'yo me encargo' : `${agentName(r.agent)} se encarga`;
  return { reply: `Listo. ${r.desc.charAt(0).toUpperCase() + r.desc.slice(1)}, ${who}.${made.guessed ? ` Tomé "${made.guessed}" como ${r.when.at}; di una hora para cambiarlo.` : ''} ${r.needsOk ? 'Lo que haya que enviar espera tu visto bueno primero.' : 'Solo lee, así que no te esperará.'} Próxima ejecución ${untilText(r.nextAt)}. Di "routines" para ver la lista, "pause ${r.title.toLowerCase()}" para detenerla.`, routine: r };
}

/* ---------- http ---------- */
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(body)); };
const MAX_BODY = 1 << 20; // 1 MB: a task, a chat turn or a routine is a few KB
const body = req => new Promise((resolve, reject) => {
  let s = '', size = 0;
  req.on('data', d => { size += d.length; if (size > MAX_BODY) { if (s !== null) reject(Object.assign(new Error('request too large'), { status: 413 })); s = null; return; } if (s !== null) s += d; }); // over the limit: stop keeping it, drain the rest, answer 413
  req.on('end', () => { if (s === null) return; try { resolve(s ? JSON.parse(s) : {}); } catch { reject(Object.assign(new Error('the body is not valid JSON'), { status: 400 })); } });
});
// The office listens on this machine only (cfg.host, default 127.0.0.1) and answers only its own page:
// a website open in another tab cannot POST to localhost to start agents that hold your Gmail and Chrome (CSRF),
// and a hostile DNS name pointed at 127.0.0.1 is refused by the Host check (DNS rebinding).
const HOST = cfg.host || '127.0.0.1';
const LOCAL_NAME = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
function trusted(req) {
  const host = String(req.headers.host || '');
  if (!cfg.host && !LOCAL_NAME.test(host)) return 'host';
  if (req.method === 'GET' || req.method === 'HEAD') return '';
  const o = req.headers.origin;
  if (o && o !== 'null') { try { if (new URL(o).host.toLowerCase() !== host.toLowerCase()) return 'origin'; } catch { return 'origin'; } }
  if ((req.method === 'POST' || req.method === 'PATCH') && req.headers['content-length'] !== '0' && !/^application\/json\b/i.test(req.headers['content-type'] || '')) return 'content-type';
  return '';
}
// the page, gzipped once per build (1.5 MB → ~0.6 MB); re-read when dist/ changes
let pageCache = { mtime: 0, raw: null, gz: null };
function page() {
  const st = fs.statSync(HTML);
  if (st.mtimeMs !== pageCache.mtime) { const raw = fs.readFileSync(HTML); pageCache = { mtime: st.mtimeMs, raw, gz: zlib.gzipSync(raw, { level: 9 }) }; }
  return pageCache;
}
/* ---------- the brain's notes: read one, move an office note to the bin ---------- */
const TRASH = path.join(NOTES_DIR, '.papelera'); // dot folder: out of the graph, out of the agents' context, hidden in Obsidian
function noteIndex() { // name → { path, group, office } — the only paths /api/note will ever open (the request never builds a path)
  const m = new Map();
  for (const [name, n] of readVault(BRAIN).notes) m.set(name, { path: n.path, group: n.group, office: false });
  for (const n of readOfficeNotes(BRAIN)) m.set(n.name, { path: n.path, group: 'Agents Office', office: true });
  return m;
}
function trashNote(t) { // a task's deliverable note → the bin (only a note the office wrote for THIS task)
  if (!t || !t.note) return null;
  const n = noteIndex().get(t.note); if (!n || !n.office || !insideBrain(n.path)) return null;
  if (!fs.readFileSync(n.path, 'utf8').includes(`\ntask: ${t.id}\n`)) return null;
  fs.mkdirSync(TRASH, { recursive: true });
  const dest = path.join(TRASH, `${path.basename(n.path, '.md')}__${Date.now()}.md`); fs.renameSync(n.path, dest);
  console.log(`🗑 note to the bin with its task: ${t.note}`);
  return path.basename(dest);
}
function insideBrain(p) { // no symlink, and the real path stays inside the brain folder
  try {
    if (fs.lstatSync(p).isSymbolicLink()) return false;
    const rel = path.relative(fs.realpathSync(BRAIN), fs.realpathSync(p));
    return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch { return false; }
}

await rebuildGraph();
{ // a restart cut these runs short: say so, instead of leaving them «in progress» forever
  const list = load(); let n = 0;
  for (const t of list) if (t.state === 'doing') { Object.assign(t, { state: 'done', doneAt: Date.now(), result: 'Se interrumpió: la oficina se reinició mientras el agente trabajaba. Vuelve a lanzarla si la necesitas.', error: true }); n++; }
  if (n) { save(list); console.log(`  ${n} task${n > 1 ? 's' : ''} interrupted by the restart, marked as failed`); }
}
function autoArchive() {
  const list = load(), cut = Date.now() - 30 * 864e5; let n = 0;
  for (const t of list) if (t.state === 'done' && !t.archived && (t.doneAt || 0) < cut) { t.archived = true; t.archivedAt = Date.now(); t.autoArchived = true; n++; }
  if (n) { save(list); console.log(`  ${n} finished task${n > 1 ? 's' : ''} older than 30 days archived`); }
}
autoArchive(); setInterval(autoArchive, 6 * 3600 * 1000);
if (mcp.useCache(path.join(DATA, 'mcp-cache.json'))) console.log('  connectors: showing the last known list while `claude mcp list` checks them (~40 s)');
const discovering = mcp.discover().then(async l => {
  console.log(`  connectors: ${l.filter(s => s.status === 'connected').length} connected of ${l.length} (claude mcp list)`);
  if (backend === 'claude-cli') { const pr = await mcp.probeTools({ cwd: CLI_CWD }); if (pr) console.log(`  tools: ${pr.tools} in a run${pr.long.length ? ` · ${pr.long.length} with names over 64 characters kept out (the API refuses them)` : ''}`); }
  return mcp.list();
});
const agentsOut = () => { const setup = setupMap(); return AGENTS.map(a => ({ id: a.id, name: a.name, role: a.role, does: a.does, tools: a.tools, brief: a.brief || '', model: a.model || '', effort: a.effort || '', skills: skills.names(a), lessons: learn.count(BRAIN, a.id), department: a.department, lead: a.lead,
  interviewer: leadOf(a.department).id === a.id, setUp: setup[a.department] })); };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const why = trusted(req);
  if (why) { console.warn(`refused ${req.method} ${url.pathname} (${why}: ${why === 'host' ? req.headers.host : why === 'origin' ? req.headers.origin : req.headers['content-type'] || 'none'})`); return json(res, 403, { error: `refused: ${why}` }); }
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/command-centre-v2.html' || url.pathname === '/dark')) {
      const pc = page();
      if (url.pathname === '/dark') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(pc.raw.toString('utf8').replace('<body>', '<body class="dark">')); } // /dark: the same file, opened in dark mode
      const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', vary: 'accept-encoding', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
      return res.end(gz ? pc.gz : pc.raw);
    }
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, version, backend, model: cfg.model, modelName: modelName(cfg.model), models: MODEL_KEYS, effort: cfg.effort || '', efforts: EFFORT_KEYS, name: cfg.name, brain: BRAIN, notes: graph.notes, depts: DEPT_KEYS,
      agents: agentsOut(), setup: setupMap(), routines: (l => ({ count: l.length, paused: l.filter(r => r.paused).length, depts: routines.ALLOWED }))(loadRoutines()), roster: { customised: roster.customised, briefed: roster.briefed, files: roster.files, problems: roster.problems }, skills: (({ count, shipped, brain, problems }) => ({ count, shipped, brain, problems }))(skills.summary()), tools: backend === 'claude-cli', mcp: mcp.summary(), teams: TEAMS, browser: mcp.summary().browser });
    if (url.pathname === '/api/agents') return json(res, 200, { agents: agentsOut(), problems: roster.problems, files: roster.files });
    if (url.pathname === '/api/skills') return json(res, 200, refreshSkills().summary()); // reloads from disk: edit a skill, hit this, see it
    if (url.pathname === '/api/lessons') return json(res, 200, { dir: learn.dir(BRAIN), agents: AGENTS.map(a => ({ id: a.id, name: a.name, ...learn.read(BRAIN, a.id) })).filter(x => x.rules.length || x.oneOffs.length) });
    if (url.pathname === '/api/mcp') { if (url.searchParams.get('refresh') === '1') await mcp.discover(); else if (!mcp.list().some(x => !x.browser)) await discovering; /* a known list answers at once; only a first-ever start waits for claude mcp list */ return json(res, 200, { ...mcp.summary(), tools: backend === 'claude-cli' }); }
    if (url.pathname === '/api/brain') return json(res, 200, graph);
    if (url.pathname === '/api/note' && req.method === 'GET') { // read one note of the brain, by name (the Brain's reader)
      const id = url.searchParams.get('id') || ''; const n = noteIndex().get(id);
      if (!n || !insideBrain(n.path)) return json(res, 404, { error: 'no such note' });
      const st = fs.statSync(n.path); let text = fs.readFileSync(n.path, 'utf8');
      const cut = text.length > 200000; if (cut) text = text.slice(0, 200000);
      return json(res, 200, { name: id, group: n.group, text, cut, size: st.size, modified: st.mtimeMs, deletable: n.office && /\ntask: /.test(text) });
    }
    if (url.pathname === '/api/note/trash' && req.method === 'POST') { // an office deliverable → <brain>/Agents Office/.papelera/ (reversible: /api/note/restore, or move it back by hand)
      const { id } = await body(req); const n = noteIndex().get(String(id || ''));
      if (!n || !n.office || !insideBrain(n.path)) return json(res, 404, { error: 'solo las notas que escribió la oficina (Agents Office) van a la papelera' });
      if (!/\ntask: /.test(fs.readFileSync(n.path, 'utf8'))) return json(res, 400, { error: 'esta nota no la escribió un agente: si quieres borrarla, hazlo tú desde la carpeta' });
      fs.mkdirSync(TRASH, { recursive: true });
      const dest = path.join(TRASH, `${path.basename(n.path, '.md')}__${Date.now()}.md`);
      fs.renameSync(n.path, dest);
      console.log(`🗑 note to the bin: ${id}`);
      return json(res, 200, { ok: true, trashed: path.basename(dest), graph: await rebuildGraph() });
    }
    if (url.pathname === '/api/note/restore' && req.method === 'POST') { // one note back out of the bin
      const { file } = await body(req); const f = path.basename(String(file || ''));
      const src = path.join(TRASH, f);
      if (!/__\d+\.md$/.test(f) || !fs.existsSync(src) || !insideBrain(src)) return json(res, 404, { error: 'no está en la papelera' });
      const name = f.replace(/__\d+\.md$/, ''); let dest = path.join(NOTES_DIR, name + '.md');
      for (let n = 2; fs.existsSync(dest); n++) dest = path.join(NOTES_DIR, `${name}-${n}.md`);
      fs.renameSync(src, dest);
      return json(res, 200, { ok: true, name: path.basename(dest, '.md'), graph: await rebuildGraph() });
    }
    if (url.pathname === '/api/usage') return json(res, 200, await getUsage(url.searchParams.get('refresh') === '1')); // V3.6: the plan's gauge (never a 500: unavailable is an answer)
    if (url.pathname === '/api/tasks' && req.method === 'GET') return json(res, 200, load());
    if (url.pathname === '/api/routines' && req.method === 'GET') return json(res, 200, routinesOut());
    if (url.pathname === '/api/routines' && req.method === 'POST') {
      const b = await body(req);
      if (!DEPTS[b.dept] || b.dept === 'brain') return json(res, 400, { error: 'unknown department' });
      if (!routines.ALLOWED.includes(b.dept)) return json(res, 400, { error: routines.refusal(b.dept), refused: true });
      const r = await makeRoutine({ dept: b.dept, text: b.text, when: b.when, agent: b.agent, needsOk: b.needsOk, model: b.model, effort: b.effort });
      return json(res, r.error ? 400 : 200, r);
    }
    const rm = url.pathname.match(/^\/api\/routines\/([^/]+)(?:\/(run|pause|resume))?$/);
    if (rm) {
      const r = loadRoutines().find(x => x.id === rm[1]);
      if (!r) return json(res, 404, { error: 'no such routine' });
      if (req.method === 'DELETE') { removeRoutine(r.id); return json(res, 200, { ok: true, routines: loadRoutines() }); }
      if (req.method !== 'POST' && req.method !== 'PATCH') return json(res, 405, { error: 'POST, PATCH or DELETE' });
      if (rm[2] === 'run') return json(res, 200, { ok: true, task: fire(r, { by: 'you' }), routines: loadRoutines() });
      if (rm[2] === 'pause' || rm[2] === 'resume') { editRoutine(r.id, { paused: rm[2] === 'pause' }); return json(res, 200, { ok: true, routines: loadRoutines() }); }
      const b = await body(req); const patch = {};
      if (typeof b.needsOk === 'boolean') patch.needsOk = b.needsOk; if (typeof b.paused === 'boolean') patch.paused = b.paused;
      if (typeof b.text === 'string') { const t = b.text.trim(); if (!t || t.length > 4000) return json(res, 400, { error: 'el texto de la rutina debe tener entre 1 y 4000 caracteres' }); patch.text = t; }
      if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 90);
      if (b.when !== undefined) {
        if (!validWhen(b.when)) return json(res, 400, { error: 'ese horario no está completo' });
        if (b.when.start && b.when.start < localDay(Date.now())) return json(res, 400, { error: 'la fecha de inicio ya pasó' });
        patch.when = b.when;
      }
      if (b.agent !== undefined) { const a = AGENTS.find(x => x.id === b.agent && x.department === r.dept); if (!a) return json(res, 400, { error: 'ese agente no está en el departamento de la rutina' }); patch.agent = a.id; }
      if (b.model !== undefined) patch.model = normModel(b.model) || '';
      if (b.effort !== undefined) patch.effort = normEffort(b.effort) || '';
      const out = editRoutine(r.id, patch); return json(res, 200, { ok: true, routine: out, routines: loadRoutines() });
    }
    if (url.pathname === '/api/tasks' && req.method === 'POST') {
      const { dept, text, model, effort, team, at } = await body(req);
      if (!DEPTS[dept] || dept === 'brain') return json(res, 400, { error: 'unknown department' });
      if (!text || !String(text).trim()) return json(res, 400, { error: 'empty task' });
      const dueAt = at ? (typeof at === 'number' ? at : Date.parse(at)) : null; // V3.2.1: a task for a date
      if (at && !(dueAt > 0)) return json(res, 400, { error: 'at must be a time (ms or ISO)' });
      if (dueAt && dueAt < Date.now() - 60000) return json(res, 400, { error: 'that time has passed — pick one that is still ahead' });
      const r = await route(dept, String(text).trim());
      const asTeam = TEAMS.enabled && (team === true || teams.intent(text)); // V3.2 (16 Sep): TEAM in the bar, or "as a team" in the sentence → the lead owns it and splits it
      const task = { id: nid(), dept, agent: asTeam ? leadOf(dept).id : r.agent, title: r.title, text: String(text).trim(), plan: r.plan, eta: r.eta, why: asTeam ? `team — ${leadOf(dept).name} splits it across the desks` : r.why, state: 'next', addedAt: Date.now(), by: 'you', model: normModel(model) || undefined, effort: normEffort(effort) || undefined, // model/effort: set on this task (beats routine, agent, office)
        team: asTeam ? { lead: leadOf(dept).id, asked: team === true ? 'you' : 'text' } : undefined };
      if (dueAt) { task.state = 'scheduled'; task.dueAt = dueAt; task.needsOk = r.needsOk; } // waits for its minute; needsOk decides whether it then waits for the OK
      const list = load(); list.push(task); save(list);
      console.log(`+ ${task.id} → ${task.agent}: ${task.title}${asTeam ? ' (team)' : ''}${dueAt ? ' · scheduled ' + untilText(dueAt) : ''}`);
      return json(res, 200, task);
    }
    const m = url.pathname.match(/^\/api\/tasks\/([^/]+)(?:\/(run|revise|approve|reject|stop|archive|repeat))?$/);
    if (m && m[2] === 'stop' && req.method === 'POST') { // the owner stops a running agent: its claude processes (and their MCP servers) are killed
      const t = load().find(x => x.id === m[1]);
      if (!t) return json(res, 404, { error: 'no such task' });
      if (t.state !== 'doing') return json(res, 409, { error: 'no está en curso' });
      stopping.add(t.id);
      const ps = runsOf.get(t.id); let n = 0;
      if (ps) for (const p of ps) { killTree(p); n++; }
      if (!n) { // nothing running here (the page was about to start it, or a restart lost it): close it now
        const l = load(); const x = l.find(y => y.id === t.id); Object.assign(x, { state: 'done', doneAt: Date.now(), result: 'Detenida por ti antes de terminar.', error: true, stopped: true }); save(l); stopping.delete(t.id);
      }
      console.log(`■ ${t.id} stopped by the owner (${n} process${n === 1 ? '' : 'es'})`);
      return json(res, 200, { ok: true, killed: n });
    }
    if (m && m[2] === 'archive' && req.method === 'POST') { // out of the lists (kept in tasks.json); note: true also moves its note to the bin
      const b = await body(req); const l = load(); const t = l.find(x => x.id === m[1]);
      if (!t) return json(res, 404, { error: 'no such task' });
      if (t.state === 'doing') return json(res, 409, { error: 'el agente está trabajando en ella — detenla primero' });
      t.archived = b.archived !== false; t.archivedAt = t.archived ? Date.now() : undefined; save(l);
      const trashed = t.archived && b.note ? trashNote(t) : null;
      return json(res, 200, { ok: true, task: t, trashed, graph: trashed ? await rebuildGraph() : undefined });
    }
    if (m && m[2] === 'repeat' && req.method === 'POST') { // the same work again, as a new task (same agent, same words)
      const src = load().find(x => x.id === m[1]);
      if (!src) return json(res, 404, { error: 'no such task' });
      const t = { id: nid(), dept: src.dept, agent: src.team ? leadOf(src.dept).id : src.agent, title: src.title, text: src.text, plan: src.plan || [], eta: src.eta || 30, why: 'otra vez', state: 'next', addedAt: Date.now(), by: 'you', model: src.model, effort: src.effort, needsOk: src.needsOk,
        team: src.team ? { lead: leadOf(src.dept).id, asked: 'repeat' } : undefined, repeatOf: src.id };
      const l = load(); l.push(t); save(l);
      console.log(`↻ ${t.id} repeats ${src.id}: ${t.title}`);
      return json(res, 200, t);
    }
    if (m && !m[2] && req.method === 'PATCH') { // edit a task that has not started: rewrite, reassign, move to a date or back, model, effort — or mark it done by hand
      const b = await body(req);
      const cur = load().find(t => t.id === m[1]);
      if (!cur) return json(res, 404, { error: 'no such task' });
      if (cur.state !== 'scheduled' && cur.state !== 'next') return json(res, 409, { error: 'solo se edita una tarea que aún no empezó' });
      if (cur.routine && cur.state === 'next') return json(res, 409, { error: 'es una ejecución de rutina: edita la rutina en el calendario' });
      const patch = {};
      if (b.state === 'done') { // «ya está hecha» — closed by the owner without running
        const l = load(); const t = l.find(x => x.id === m[1]); if (!t || (t.state !== 'next' && t.state !== 'scheduled')) return json(res, 409, { error: 'ya empezó' });
        Object.assign(t, { state: 'done', doneAt: Date.now(), result: 'Marcada como hecha por ti, sin ejecutarla.', manual: true }); save(l);
        return json(res, 200, t);
      }
      if (b.agent !== undefined) {
        const a = AGENTS.find(x => x.id === b.agent); if (!a) return json(res, 400, { error: 'no existe ese agente' });
        if (cur.team && !a.lead) return json(res, 400, { error: 'una tarea en equipo va al líder del departamento' });
        patch.agent = a.id; patch.dept = a.department;
      }
      if (b.at === null && cur.state === 'scheduled') { patch.state = 'next'; patch.dueAt = undefined; patch.addedAt = Date.now(); } // unscheduled: it goes to the queue now
      if (b.at !== undefined && b.at !== null) {
        const at = typeof b.at === 'number' ? b.at : /T\d/.test(String(b.at)) ? Date.parse(b.at) : NaN; // a date with no time would be read as UTC midnight: refused
        if (!(at > Date.now() - 60000)) return json(res, 400, { error: 'esa hora ya pasó — elige una que aún esté por venir' });
        if (at > Date.now() + 2 * 365 * 864e5) return json(res, 400, { error: 'como mucho dos años adelante' });
        patch.dueAt = at; if (cur.state === 'next') { patch.state = 'scheduled'; if (cur.needsOk === undefined) patch.needsOk = routines.guessNeedsOk(cur.text || cur.title); }
      }
      if (typeof b.text === 'string') {
        const t = b.text.trim(); if (!t || t.length > 4000) return json(res, 400, { error: 'el texto debe tener entre 1 y 4000 caracteres' });
        if (t !== cur.text) { patch.text = t; if (b.reroute !== false && b.agent === undefined) { const r = await route(patch.dept || cur.dept, t); Object.assign(patch, { title: r.title, plan: r.plan, needsOk: r.needsOk, why: r.why, ...(cur.team ? {} : { agent: r.agent }) }); } }
      }
      if (typeof b.title === 'string' && b.title.trim()) patch.title = b.title.trim().slice(0, 90);
      if (b.model !== undefined) patch.model = normModel(b.model) || undefined;
      if (b.effort !== undefined) patch.effort = normEffort(b.effort) || undefined;
      if (typeof b.needsOk === 'boolean') patch.needsOk = b.needsOk;
      const list = load(); const task = list.find(t => t.id === m[1]); // re-read: routing took a moment and the clock (or the page) may have started it
      if (!task || task.state !== cur.state) return json(res, 409, { error: 'la tarea ya empezó mientras la editabas' });
      Object.assign(task, patch); for (const k of Object.keys(patch)) if (patch[k] === undefined) delete task[k]; save(list);
      console.log(`✎ ${task.id} edited${patch.dueAt ? ' · now ' + untilText(task.dueAt) : ''}${patch.text ? ' · new text' : ''}${patch.agent ? ' · to ' + patch.agent : ''}${patch.state ? ' · ' + patch.state : ''}`);
      return json(res, 200, task);
    }
    if (m && req.method === 'POST' && (m[2] === 'approve' || m[2] === 'reject')) { // D1: the owner's tick on a routine's draft
      const task = load().find(t => t.id === m[1]);
      if (!task) return json(res, 404, { error: 'no such task' });
      if (task.state !== 'waiting') return json(res, 400, { error: 'this task is not waiting for your OK' });
      const { feedback } = m[2] === 'reject' ? await body(req) : {};
      const note = String(feedback || '').trim();
      { const l = load(); const t = l.find(x => x.id === task.id); if (!t || t.state !== 'waiting') return json(res, 409, { error: 'ya se está procesando' }); t.state = 'doing'; t.startedAt = Date.now(); save(l); } // claimed now: a second click (or «aprobar» in chat) cannot send it twice
      console.log(`${m[2] === 'approve' ? '✅' : '↩'} ${task.id} ${m[2] === 'approve' ? 'approved — ' + agentName(task.agent) + ' is sending' : 'sent back: ' + note.slice(0, 80)}`);
      enqueue(() => runServerTask(task.id, m[2] === 'approve' ? { approve: true } : { feedback: note || 'No es esto. Retrabájalo.' }))
        .then(t => { if (m[2] === 'reject' && note && t && !t.error) { const a = AGENTS.find(x => x.id === t.agent); return learn.classify(ask, a, t, note).then(v => { const r = learn.record(BRAIN, a, t, note, v); console.log(`  ↳ ${a.name} ${r.standing ? 'learned a rule' : 'noted a one-off'}: ${r.line.slice(0, 100)}`); }); } })
        .catch(e => console.warn('approval:', e.message));
      return json(res, 200, { ok: true, id: task.id, state: 'doing' });
    }
    if (m && req.method === 'POST' && (m[2] === 'run' || m[2] === 'revise')) {
      const list = load(); const task = list.find(t => t.id === m[1]);
      if (!task) return json(res, 404, { error: 'no such task' });
      if (task.state === 'doing' || task.state === 'scheduled') return json(res, 409, { error: task.state === 'doing' ? 'ya está en curso' : 'está programada: corre sola a su hora' });
      if (m[2] === 'run' && (task.routine || task.dueAt) && task.state !== 'done') return json(res, 409, { error: 'el reloj de la oficina la está corriendo' }); // server-owned: running it from the page too would run it twice and skip the OK
      const { feedback } = m[2] === 'revise' ? await body(req) : {};
      task.state = 'doing'; task.startedAt = Date.now(); save(list);
      try {
        const { result, read, tools, used, skills: sk, modelUsed, modelFrom, modelId: ran, effortUsed, effortFrom, team } = await run(task, feedback);
        Object.assign(task, { state: 'done', doneAt: Date.now(), result, read, tools, used, skills: sk, error: false, modelUsed, modelFrom, modelId: ran, effortUsed, effortFrom, ...(team ? { team } : {}) });
        task.note = writeNote(task);
        await rebuildGraph();
      } catch (e) {
        Object.assign(task, { state: 'done', doneAt: Date.now(), result: stopping.has(task.id) ? 'Detenida por ti antes de terminar.' : 'Could not complete this task: ' + e.message, error: true, stopped: stopping.has(task.id) || undefined });
      }
      stopping.delete(task.id);
      const l2 = load(); const i = l2.findIndex(t => t.id === task.id); if (i >= 0) l2[i] = task; save(l2);
      console.log(`${task.error ? '✗' : '✓'} ${task.id} ${task.error ? 'failed' : 'done'} (${task.result.length} chars${task.tools?.length ? ', tools: ' + task.tools.join(' ') : ''}${task.note ? ', note: ' + task.note : ''})`);
      json(res, 200, task);
      if (feedback && !task.error) { // learn from the correction, after the reply is out the door
        const a = AGENTS.find(x => x.id === task.agent);
        learn.classify(ask, a, task, feedback).then(v => { const r = learn.record(BRAIN, a, task, feedback, v); console.log(`  ↳ ${a.name} ${r.standing ? 'learned a rule' : 'noted a one-off'}: ${r.line.slice(0, 100)}`); })
          .catch(e => console.warn('learn:', e.message));
      }
      return;
    }
    if (m && req.method === 'DELETE') {
      const list = load(); const t = list.find(x => x.id === m[1]);
      if (!t) return json(res, 404, { error: 'no such task' });
      if (t.state === 'doing') return json(res, 409, { error: 'el agente está trabajando en ella — espera a que termine' }); // deleting it now would lose the run's result
      save(list.filter(x => x.id !== m[1]));
      const trashed = url.searchParams.get('note') === '1' ? trashNote(t) : null;
      return json(res, 200, { ok: true, trashed, graph: trashed ? await rebuildGraph() : undefined });
    }
    if (url.pathname === '/api/sub' && req.method === 'GET') return json(res, 200, sub.load(DATA));
    if (url.pathname === '/api/sub/chat' && req.method === 'POST') {
      const { text } = await body(req);
      if (!text || !String(text).trim()) return json(res, 400, { error: 'mensaje vacío' });
      if (String(text).length > 8000) return json(res, 400, { error: 'el mensaje es muy largo (máx. 8000 caracteres)' });
      return json(res, 200, await subChat(String(text).trim()));
    }
    if (url.pathname === '/api/sub/send' && req.method === 'POST') {
      const { msg, items } = await body(req);
      const r = await subSend(String(msg || ''), items);
      return json(res, r.error ? 404 : 200, r);
    }
    if (url.pathname === '/api/sub/clear' && req.method === 'POST') { sub.save(DATA, { messages: [] }); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const { agent, text, history } = await body(req);
      if (!text || !String(text).trim()) return json(res, 400, { error: 'empty message' });
      const a = AGENTS.find(x => x.id === agent); if (!a) return json(res, 400, { error: 'unknown agent' });
      if (!onboard.active(DATA, a.department)) { // V3.5: "every weekday at 8am, …" · "routines" · "pause …" · "run … now" — unless the lead is mid-interview
        const rc = await routinesChat(a, String(text).trim());
        if (rc) return json(res, 200, { reply: rc.reply, read: [], tools: [], interview: false, routine: rc.routine || null, routines: true });
      }
      if (leadOf(a.department).id === a.id) { // the department lead can run the set-up interview
        refreshSkills();
        const o = await onboard.handle(String(text).trim(), { dept: a.department, deptName: DEPTS[a.department].name, lead: a, agents: AGENTS.filter(x => x.department === a.department),
          connected: mcp.summary().servers?.filter(x => x.status === 'connected').map(x => x.name || x.key) || [], brainPath: BRAIN, dataDir: DATA, ask, business: cfg.name, afterWrite: refreshSkills });
        if (o) { if (o.wrote) console.log(`★ ${a.name} set up ${DEPTS[a.department].name}: ${o.wrote.briefs.length} briefs${o.wrote.skill ? ', skill ' + o.wrote.skill.name : ''}`); return json(res, 200, { reply: o.reply, read: [], tools: [], interview: !o.wrote, setup: setupMap() }); }
      }
      const r = await chat(agent, String(text).trim(), history);
      return json(res, 200, { ...r, interview: false });
    }
    json(res, 404, { error: 'not found' });
  } catch (e) { if (!e.status) console.error(e); if (!res.headersSent) json(res, e.status || 500, { error: e.message }); }
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${cfg.port} is already in use — is another office running? Close it, or set PORT.` : e.message); process.exit(1); });
server.listen(cfg.port, HOST, () => {
  console.log(`Agents Office ${version} → http://localhost:${cfg.port}`);
  console.log(`  business: ${cfg.name}   brain: ${BRAIN} (${graph.notes} notes, ${graph.links.length} links)   claude: ${backend} · ${modelName(cfg.model)}${cfg.effort ? ' · effort ' + cfg.effort : ''} by default (routing on Sonnet)`);
  getUsage(true).then(u => console.log(u.source === 'claude' ? `  usage: session ${u.session?.percent ?? '—'}% · week ${u.week?.percent ?? '—'}% (your Claude plan, as Claude Code shows it)` : `  usage: Claude's gauge unavailable (${u.reason}) — showing the office's own count`)).catch(() => {});
  console.log(`  tasks: ${FILE}   notes the agents write: ${NOTES_DIR}`);
  const rl = loadRoutines(); const nx = rl.filter(r => !r.paused && r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
  console.log(`  routines: ${rl.length} loaded${rl.some(r => r.paused) ? ' (' + rl.filter(r => r.paused).length + ' paused)' : ''}${nx ? ' · next ' + untilText(nx.nextAt) + ' ' + nx.title.toUpperCase() + ' (' + nx.agent + ')' : ''} · ${rlist.path}`);
  setInterval(tickRoutines, 20000); tickRoutines(); // the clock: every 20 s; the first tick catches up anything missed while the office was off (once, marked LATE)
  console.log(`  agents: 35 (${roster.customised} customised${roster.briefed ? ', ' + roster.briefed + ' briefed' : ''}${roster.files.length ? ' via ' + roster.files.join(' + ') : ''})   tools: ${backend === 'claude-cli' ? 'connected MCP servers' + (cfg.tools?.web === false ? '' : ' + web') + (mcp.browserOn() ? ' + the owner\'s Chrome (' + (mcp.browserState().installed ? 'extension paired' + (mcp.browserState().device ? ': ' + mcp.browserState().device : '') : 'extension NOT paired — run `claude --chrome` once') + ')' : '') : 'none on the API backend'}`);
  console.log(`  teams: ${TEAMS.enabled ? 'on — TEAM in the bar or "as a team" in the sentence; the lead splits it across up to ' + TEAMS.max + ' desks' : 'off (teams.enabled in office.config.json)'}`);
  const sk = skills.summary(); const setup = setupMap(); const notYet = DEPT_KEYS.filter(k => !setup[k]);
  console.log(`  skills: ${sk.count} (${sk.shipped} shipped in skills/, ${sk.brain} in ${path.join(NOTES_DIR, 'skills')})${sk.problems.length ? '   ⚠ ' + sk.problems.length + ' problem' + (sk.problems.length > 1 ? 's' : '') + ' — see npm run check' : ''}`);
  console.log(`  set up: ${notYet.length === DEPT_KEYS.length ? 'no department yet — open a lead\'s chat and say "configurar"' : notYet.length ? DEPT_KEYS.length - notYet.length + ' of 6 departments (not yet: ' + notYet.map(k => DEPTS[k].name).join(', ') + ')' : 'all six departments'}   lessons: ${learn.dir(BRAIN)}`);
});
