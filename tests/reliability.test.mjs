// V4.4 — retries, timeouts, the login, the queue, missed routine runs (reliability.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../reliability.mjs';
import { nextRun } from '../src/when.js';

test('which failures are worth another try', () => {
  assert.equal(R.classify('Claude took longer than 300 s'), 'timeout');
  assert.equal(R.classify('claude exited 1: socket hang up'), 'transient');
  assert.equal(R.classify('API Error: 529 overloaded'), 'transient');
  assert.equal(R.classify('Claude AI usage limit reached|1790352000'), 'limit');
  assert.equal(R.classify('Invalid API key · Please run /login'), 'login');
  assert.equal(R.classify('OAuth token has expired'), 'login');
  assert.equal(R.classify('Claude Code is not installed (claude not found on PATH)'), 'fatal');
  assert.equal(R.classify('Claude declined this request'), 'fatal');
});

test('retry later, longer after a timeout, never on a login problem', () => {
  const now = Date.parse('2026-09-25T10:00:00Z');
  const a = R.nextStep({}, 'socket hang up', {}, now);
  assert.equal(a.retry, true); assert.equal(a.at, now + 60_000); assert.equal(a.attempt, 1);
  const b = R.nextStep({ attempts: 1 }, 'socket hang up', {}, now);
  assert.equal(b.at, now + 300_000);
  assert.equal(R.nextStep({ attempts: 2 }, 'socket hang up', {}, now).retry, false); // default max 2
  assert.equal(R.nextStep({ attempts: 2 }, 'socket hang up', { max: 3 }, now).retry, true);
  assert.equal(R.nextStep({}, 'x', { max: 0 }, now).retry, false);
  const t = R.nextStep({}, 'Claude took longer than 300 s', {}, now);
  assert.equal(t.timeoutMul, 2);
  assert.equal(R.nextStep({ attempts: 1, timeoutMul: 2, lastErrorKind: 'timeout' }, 'Claude took longer than 600 s', {}, now).timeoutMul, 4);
  assert.equal(R.nextStep({}, 'Please run /login', {}, now).retry, false);
  assert.equal(R.nextStep({ stopped: true }, 'socket hang up', {}, now).retry, false);
  const lim = R.nextStep({}, 'usage limit reached|' + Math.round((now + 7200_000) / 1000), {}, now);
  assert.ok(lim.at >= now + 7200_000, 'waits for the reset');
});

test('where each waiting task sits in the queue', () => {
  const tasks = [
    { id: 'a', state: 'doing', agent: 'x' },
    { id: 'b', state: 'next', agent: 'x', addedAt: 1 },
    { id: 'c', state: 'next', agent: 'y', addedAt: 2 },
    { id: 'd', state: 'next', agent: 'z', addedAt: 3 },
    { id: 'e', state: 'next', agent: 'w', addedAt: 4, retryAt: Date.now() + 60_000 },
  ];
  const q = R.queueOf(tasks, 1, 2);
  assert.equal(q.b.why, 'agente');
  assert.equal(q.c.why, 'turno');
  assert.equal(q.d.why, 'oficina');
  assert.equal(q.e.why, 'reintento');
  assert.equal(q.d.pos, 3);
});

test('runs missed while the computer slept', () => {
  const when = { kind: 'daily', at: '09:00' };
  const first = nextRun(when, new Date('2026-09-20T08:00:00').getTime());
  const now = new Date('2026-09-23T10:00:00').getTime();
  assert.equal(R.missedRuns(first, now, t => nextRun(when, t)), 4); // the 20th, 21st, 22nd and 23rd at 09:00
  assert.equal(R.missedRuns(now + 1000, now, t => nextRun(when, t)), 0);
});
