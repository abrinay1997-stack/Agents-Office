// Agents Office — quality (V4.4, 25 Sep 2026; audit D1, D2, D9, D10). Pure functions, proven in tests/quality.test.mjs:
//   how each desk is doing, week by week (first-try approvals, send-backs, 👍/👎, failures) and a warning when it drops
//   after its skill or brief changed (D1) · lessons without duplicates (D9) · what the router learns from the owner's
//   corrections (D10).

const weekStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
/**
 * A desk's score for a set of finished tasks, 0–100: a deliverable used as it came scores 100, one sent back loses 30
 * per send-back, 👎 loses 50, 👍 adds 10, a failure is 0.
 */
export function scoreOf(t) {
  if (t.error && !t.stopped) return 0;
  let s = 100 - 30 * (t.revisions || 0) - (t.editedDraft ? 15 : 0) - (t.expired ? 40 : 0);
  if (t.vote === 'down') s -= 50; if (t.vote === 'up') s += 10;
  return Math.max(0, Math.min(100, s));
}
/** Per agent: tasks, score, first-try %, send-backs, votes — this period and the one before. */
export function byAgent(tasks, agents, now = Date.now(), days = 28) {
  const cut = now - days * 864e5, prevCut = cut - days * 864e5;
  const fin = t => t.state === 'done' && !t.piece && !t.stopped;
  return agents.map(a => {
    const cur = tasks.filter(t => t.agent === a.id && fin(t) && (t.doneAt || 0) >= cut), prev = tasks.filter(t => t.agent === a.id && fin(t) && (t.doneAt || 0) >= prevCut && (t.doneAt || 0) < cut);
    const avg = l => l.length ? Math.round(l.reduce((s, t) => s + scoreOf(t), 0) / l.length) : null;
    return { id: a.id, name: a.name, dept: a.department, tasks: cur.length, score: avg(cur), before: avg(prev), firstTry: cur.length ? Math.round(100 * cur.filter(t => !t.revisions && !t.error && t.vote !== 'down').length / cur.length) : null, revisions: cur.reduce((s, t) => s + (t.revisions || 0), 0), up: cur.filter(t => t.vote === 'up').length, down: cur.filter(t => t.vote === 'down').length, failed: cur.filter(t => t.error).length };
  }).filter(x => x.tasks || x.before !== null);
}
/** D1: a desk whose score fell ≥ 20 points in the weeks after its skill / brief changed. changes: { agentId: ms } */
export function drops(tasks, agents, changes, now = Date.now()) {
  const out = [];
  for (const a of agents) {
    const at = changes[a.id]; if (!at || now - at > 45 * 864e5) continue;
    const mine = tasks.filter(t => t.agent === a.id && t.state === 'done' && !t.piece && !t.stopped);
    const before = mine.filter(t => (t.doneAt || 0) < at && (t.doneAt || 0) > at - 30 * 864e5), after = mine.filter(t => (t.doneAt || 0) >= at);
    if (before.length < 3 || after.length < 3) continue;
    const avg = l => l.reduce((s, t) => s + scoreOf(t), 0) / l.length, b = avg(before), f = avg(after);
    if (b - f >= 20) out.push({ agent: a.id, name: a.name, before: Math.round(b), after: Math.round(f), since: at });
  }
  return out;
}

/* ---------- D9: lessons without repeats ---------- */
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^\d{4}-\d{2}-\d{2}\s*·\s*/, '').replace(/\s*←\s*".*$/, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = s => new Set(norm(s).split(' ').filter(w => w.length > 2));
export function similar(a, b) { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / Math.min(A.size, B.size); }
/** The standing rules with near-duplicates folded (the newest wording kept). → { keep, dropped } */
export function dedupe(rules, threshold = 0.8) {
  const keep = [], dropped = [];
  for (const r of [...rules].reverse()) { if (keep.some(k => similar(k, r) >= threshold)) dropped.push(r); else keep.push(r); }
  return { keep: keep.reverse(), dropped };
}

/* ---------- D10: what the router learns from the owner's corrections ---------- */
/** The past corrections closest to a new request (by shared words), for the router's prompt. */
export function lessonsFor(corrections, dept, text, n = 6) {
  const w = words(text);
  return corrections.filter(c => c.dept === dept).map(c => { const cw = words(c.text); let i = 0; for (const x of cw) if (w.has(x)) i++; return { c, s: i / Math.max(1, Math.min(cw.size, w.size)) }; })
    .filter(x => x.s >= 0.25).sort((a, b) => b.s - a.s || b.c.t - a.c.t).slice(0, n).map(x => x.c);
}
export const lessonsText = (list, nameOf) => list.length ? '\nThe owner corrected the routing of similar requests before — follow these:\n' + list.map(c => `- "${String(c.text).slice(0, 120)}" → ${nameOf(c.to)} (not ${nameOf(c.from)})`).join('\n') : '';
/** Reassignment rate: of the tasks routed in the period, how many the owner moved to another desk. */
export function rerouteRate(tasks, corrections, now = Date.now(), days = 28) {
  const cut = now - days * 864e5, routed = tasks.filter(t => (t.addedAt || 0) >= cut && t.by === 'you' && !t.piece).length;
  const moved = corrections.filter(c => c.t >= cut).length;
  return { routed, moved, rate: routed ? Math.round(100 * moved / routed) : null };
}
