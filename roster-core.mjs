// Agents Office — the roster, PURE half (no fs): defaults, validation and merging of the roster sources. roster.mjs reads the files and calls this;
// the Cloudflare Worker (cloudflare/worker/lib/tareas/roster.js) calls it with the sources it keeps in D1.
import { AGENTS, DEPTS } from './src/data.js';
import { V1 } from './src/v1data.js';

export const EDITABLE = ['name', 'role', 'does', 'tools', 'brief', 'model', 'effort'];
const BRIEF_MAX = 2000;
const MODELS = ['sonnet', 'opus', 'fable']; // V3.6: an agent's model, by name; empty = the office default
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']; // V3.6.1: an agent's effort; empty = the office's, then the model's own

export function defaults() {
  return AGENTS.map(a => { const p = V1.find(x => x.id === a.id) || {}; return { id: a.id, department: a.dept, lead: !!a.lead, name: a.name, role: p.role || '', does: p.tagline || '', tools: [], brief: '', model: '', effort: '' }; });
}
// returns { agents, problems } — problems are human sentences, never thrown
export function validate(doc, base = defaults()) {
  const problems = [];
  const list = Array.isArray(doc) ? doc : Array.isArray(doc?.agents) ? doc.agents : null;
  if (!list) return { agents: base, problems: ['the file must be {"agents": [...]}'] };
  const out = base.map(a => ({ ...a, tools: [...a.tools] }));
  const seen = new Set();
  for (const e of list) {
    if (!e || typeof e !== 'object' || !e.id) { problems.push('an entry has no "id" — skipped'); continue; }
    const a = out.find(x => x.id === e.id);
    if (!a) { problems.push(`"${e.id}" is not one of the 35 seats — skipped (new agents are not supported; rename a seat instead)`); continue; }
    if (seen.has(e.id)) problems.push(`"${e.id}" appears twice — the later entry wins`);
    seen.add(e.id);
    if (e.department !== undefined && e.department !== a.department) problems.push(`"${e.id}": department cannot change (${a.department} → ${e.department}) — ignored`);
    if (e.lead !== undefined && !!e.lead !== a.lead) problems.push(`"${e.id}": lead cannot change — ignored`);
    for (const k of Object.keys(e)) if (!['id', 'department', 'lead', ...EDITABLE].includes(k)) problems.push(`"${e.id}": unknown field "${k}" — ignored`);
    if (e.name !== undefined) { const n = String(e.name).trim(); if (!n) problems.push(`"${e.id}": empty name — kept "${a.name}"`); else a.name = n.slice(0, 32).toUpperCase(); }
    if (e.role !== undefined) a.role = String(e.role).trim().slice(0, 80);
    if (e.does !== undefined) a.does = String(e.does).trim().slice(0, 400);
    if (e.tools !== undefined) { if (!Array.isArray(e.tools)) problems.push(`"${e.id}": tools must be a list — ignored`); else a.tools = e.tools.map(String).map(s => s.trim()).filter(Boolean).slice(0, 12); }
    if (e.model !== undefined) { // V3.6: sonnet · opus · fable, or empty for the office default
      const m = String(e.model || '').toLowerCase().trim();
      if (!m) a.model = ''; else if (MODELS.includes(m)) a.model = m; else problems.push(`"${e.id}": model must be sonnet, opus or fable (got "${e.model}") — kept ${a.model || 'the office default'}`);
    }
    if (e.effort !== undefined) { // V3.6.1: low · medium · high · xhigh · max, or empty
      const v = String(e.effort || '').toLowerCase().trim();
      if (!v) a.effort = ''; else if (EFFORTS.includes(v)) a.effort = v; else problems.push(`"${e.id}": effort must be low, medium, high, xhigh or max (got "${e.effort}") — kept ${a.effort || 'the default'}`);
    }
    if (e.brief !== undefined) { // a string, or a list of lines
      const b = (Array.isArray(e.brief) ? e.brief.map(String).join('\n') : String(e.brief)).trim();
      if (b.length > BRIEF_MAX) problems.push(`"${e.id}": brief is over ${BRIEF_MAX} characters — trimmed (put the long version in a skill)`);
      a.brief = b.slice(0, BRIEF_MAX);
    }
  }
  return { agents: out, problems };
}

/** Juntar las fuentes del roster, de la más floja a la más fuerte: [{ etiqueta, doc }] (doc null = no existe; { __error } = no es JSON). → { agents, problems, customised, briefed } */
export function fusionar(fuentes) {
  let agents = defaults(); const problems = [];
  for (const { etiqueta: rel, doc } of fuentes) {
    if (!doc) continue;
    if (doc.__error) { problems.push(`${rel}: not valid JSON (${doc.__error.split('\n')[0]}) — ignored`); continue; }
    const r = validate(doc, agents); agents = r.agents; problems.push(...r.problems.map(x => `${rel}: ${x}`));
  }
  const customised = agents.filter((a, i) => { const d = defaults()[i]; return a.name !== d.name || a.role !== d.role || a.does !== d.does || a.brief; }).length;
  return { agents, problems, customised, briefed: agents.filter(a => a.brief).length };
}
export const deptName = k => DEPTS[k]?.name || k;
