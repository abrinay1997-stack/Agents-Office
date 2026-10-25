// Agents Office V3.5 — routines: tasks the office does on its own clock.
//
// A routine is a line in <brain>/Agents Office/routines.json (yours: written by the task bar,
// by a department lead in chat, or by Claude Code). Run state — when each one is next due, when
// it last ran — lives in data/routines.json so the brain file stays clean config.
//
// Every department can have routines (24 Sep 2026; the first release had Emails, Accounting and Sales only).
//
//   { "id": "inbox-triage", "dept": "emails", "agent": "elead",
//     "title": "Triage the overnight inbox", "text": "Triage the overnight inbox: what needs me, …",
//     "when": { "kind": "weekdays", "at": "08:00" },      ← src/when.js
//     "needsOk": false, "paused": false, "model": "opus", "effort": "high" }   ← optional: model sonnet · opus · fable; effort low · medium · high · xhigh · max (default: the office's, then the model's own)
//
// needsOk (default true): the result waits in WAITING ON APPROVAL for the owner's tick before the
// agent does anything outbound. Switch it off for read-only routines.
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from './fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { validate } from './routines-core.mjs';
export * from './routines-core.mjs'; // la parte pura (validar, calcular la próxima ejecución, qué toca ahora…) vive en routines-core.mjs: el Worker de Cloudflare la importa sin fs

export const file = brainPath => path.join(brainPath, 'Agents Office', 'routines.json');
export const stateFile = dataDir => path.join(dataDir, 'routines.json');

const readJSON = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };

/** Read the brain file, validate every routine. { routines, problems, path } — bad routines are left out. */
export function load(brainPath, agents) {
  const p = file(brainPath);
  const doc = readJSON(p, null);
  const list = Array.isArray(doc) ? doc : Array.isArray(doc?.routines) ? doc.routines : [];
  const routines = [], problems = [];
  if (doc && !Array.isArray(doc) && !Array.isArray(doc.routines)) problems.push(`${p}: expected {"routines": [...]}`);
  for (const r of list) {
    const v = validate(r, agents, routines);
    if (v.problems.length) problems.push(...v.problems); else routines.push(v.routine);
  }
  return { routines, problems, path: p, exists: fs.existsSync(p) };
}

// write-then-rename: a crash mid-write never leaves the owner's file half written
function writeAtomic(p, text) { const tmp = p + '.tmp'; fs.writeFileSync(tmp, text); renombrar(tmp, p); }

export function save(brainPath, routines) {
  const p = file(brainPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const clean = routines.map(r => ({ id: r.id, dept: r.dept, agent: r.agent, title: r.title, text: r.text, when: r.when, needsOk: r.needsOk, paused: r.paused, ...(r.team ? { team: true } : {}), ...(r.model ? { model: r.model } : {}), ...(r.effort ? { effort: r.effort } : {}), ...(r.plan ? { plan: r.plan } : {}) }));
  writeAtomic(p, JSON.stringify({ routines: clean }, null, 2) + '\n');
  return p;
}

/** Edit one routine in the file AS IT IS ON DISK — routines the validator left out, and fields it does not
 *  know, stay untouched. patch = null removes it; a value of '' or undefined deletes that key. false if not found. */
export function patchFile(brainPath, id, patch) {
  const p = file(brainPath); const doc = readJSON(p, null);
  const list = Array.isArray(doc) ? doc : Array.isArray(doc?.routines) ? doc.routines : null;
  const i = list ? list.findIndex(r => r && r.id === id) : -1;
  if (i < 0) return false;
  if (patch === null) list.splice(i, 1);
  else for (const [k, v] of Object.entries(patch)) { if (v === undefined || v === '') delete list[i][k]; else list[i][k] = v; }
  writeAtomic(p, JSON.stringify(Array.isArray(doc) ? { routines: list } : doc, null, 2) + '\n');
  return true;
}

/* ---------- run state: data/routines.json → { [id]: { nextAt, lastAt, runs, lastTaskId } } ---------- */
export const loadState = dataDir => readJSON(stateFile(dataDir), {});
export function saveState(dataDir, st) { fs.mkdirSync(dataDir, { recursive: true }); const f = stateFile(dataDir); fs.writeFileSync(f + '.tmp', JSON.stringify(st, null, 2)); renombrar(f + '.tmp', f); } // V4.4 (B9): write, then rename — never half a file

