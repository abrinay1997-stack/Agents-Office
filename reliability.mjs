// Agents Office — reliability rules (V4.4, 25 Sep 2026). Pure functions, proven in tests/reliability.test.mjs:
//   which failures are worth retrying and when (B1), a longer clock for a run that timed out (B4),
//   a failure that means «sign in to Claude again» (B7), where a waiting task sits in the queue (B5),
//   and how many runs of a routine were missed while the computer slept (B2).
// office.config.json → "retries": { "max": 2, "backoff": [60, 300, 900] }   (seconds before each retry; max 0 = never)
//                      "timeout": 300                                       (seconds per agent run; a retry after a timeout gets twice as long, up to 4×)

export const RETRY_DEFAULTS = { max: 2, backoff: [60, 300, 900] };
export const retryConfig = r => { const o = { ...RETRY_DEFAULTS, ...(r || {}) }; o.max = Math.max(0, Math.min(5, +o.max || 0)); o.backoff = (Array.isArray(o.backoff) && o.backoff.length ? o.backoff : RETRY_DEFAULTS.backoff).map(n => Math.max(5, +n || 60)); return o; };

/** What kind of failure: 'login' (sign in again: no retry, tell the owner) · 'limit' (usage limit: retry after it resets) · 'timeout' · 'transient' (network, overload) · 'fatal' (will fail the same way: no retry). */
export function classify(message) {
  const m = String(message || '');
  if (/not installed|ENOENT|claude not found/i.test(m)) return 'fatal';
  if (/\b(401|unauthori[sz]ed|invalid api key|authentication|not logged in|log ?in again|please run \/login|\/login|oauth token (has )?expired|session expired|credentials)\b/i.test(m)) return 'login';
  if (/usage limit|limit reached|rate.?limit|\b429\b|quota|too many requests/i.test(m)) return 'limit';
  if (/took longer than|timed? ?out|ETIMEDOUT/i.test(m)) return 'timeout';
  if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network|fetch failed|overloaded|\b(500|502|503|504|529)\b|temporarily|try again|internal server error|service unavailable|exited (1|null)(?!\d)/i.test(m)) return 'transient';
  return 'fatal';
}
/** When a usage limit says when it resets («…|1790352000» or «resets at 3pm»), the epoch in ms; else null. */
export function resetAt(message, now = Date.now()) {
  const m = String(message || '');
  const ep = /\|\s*(\d{10})\b/.exec(m); if (ep) return +ep[1] * 1000;
  const hm = /resets? (?:at )?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(m);
  if (hm) { let h = +hm[1]; const min = +(hm[2] || 0); if (hm[3]) { h = h % 12 + (/pm/i.test(hm[3]) ? 12 : 0); } const d = new Date(now); d.setHours(h, min, 0, 0); if (d.getTime() <= now) d.setDate(d.getDate() + 1); return d.getTime(); }
  return null;
}
/**
 * After a failed run: retry or stop. task: { attempts, stopped }. → { retry: true, at, attempt, kind, timeoutMul } or { retry: false, kind, why }
 * The same error twice in a row on a non-network failure stops early: repeating it would only fail again.
 */
export function nextStep(task, message, cfg = {}, now = Date.now()) {
  const r = retryConfig(cfg), kind = classify(message), attempts = task.attempts || 0;
  if (task.stopped) return { retry: false, kind, why: 'detenida por ti' };
  if (kind === 'fatal') return { retry: false, kind, why: 'un error que se repetiría igual' };
  if (kind === 'login') return { retry: false, kind, why: 'hay que volver a iniciar sesión en Claude' };
  if (attempts >= r.max) return { retry: false, kind, why: `ya se intentó ${attempts + 1} veces` };
  if (kind === 'timeout' && task.lastErrorKind === 'timeout' && (task.timeoutMul || 1) >= 4) return { retry: false, kind, why: 'se pasó del tiempo incluso con cuatro veces más' };
  let at = now + r.backoff[Math.min(attempts, r.backoff.length - 1)] * 1000;
  if (kind === 'limit') at = Math.max(at, (resetAt(message, now) || 0) + 60000);
  const timeoutMul = kind === 'timeout' ? Math.min(4, (task.timeoutMul || 1) * 2) : (task.timeoutMul || 1);
  return { retry: true, at, attempt: attempts + 1, kind, timeoutMul };
}

/**
 * Where each waiting task sits. tasks: the list; running: count in flight; max: runs at once; now.
 * → { [id]: { pos, why, retryAt? } } — why: 'agente' (its desk is busy) · 'oficina' (every run slot is taken) · 'reintento' (waits for its retry) · 'turno'
 */
export function queueOf(tasks, runningCount, max, now = Date.now()) {
  const busy = new Set(tasks.filter(t => t.state === 'doing').map(t => t.agent));
  const waiting = tasks.filter(t => t.state === 'next' && !t.archived).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  const out = {}; let pos = 0, free = Math.max(0, max - runningCount);
  for (const t of waiting) {
    pos++;
    if (t.retryAt && t.retryAt > now) { out[t.id] = { pos, why: 'reintento', retryAt: t.retryAt }; continue; }
    if (busy.has(t.agent)) { out[t.id] = { pos, why: 'agente' }; continue; }
    if (free > 0) { free--; busy.add(t.agent); out[t.id] = { pos, why: 'turno' }; continue; }
    out[t.id] = { pos, why: 'oficina' };
  }
  return out;
}

/** How many runs fell between the missed due time and now (the computer slept or the office was off). next(t) → the run after t. */
export function missedRuns(firstDue, now, next, cap = 1000) {
  let n = 0, t = firstDue;
  while (t && t <= now && n < cap) { n++; const nt = next(t + 1000); if (!nt || nt <= t) break; t = nt; }
  return n;
}
