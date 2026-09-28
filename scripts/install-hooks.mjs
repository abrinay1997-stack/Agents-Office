#!/usr/bin/env node
// Agents Office (V4.4): point git at .githooks/ so the secrets check runs before every commit on this machine.
// npm install runs it (package.json → prepare) and so does npm run check. Quiet and harmless outside a git clone.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  execFileSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, stdio: 'ignore' });
  const cur = (() => { try { return execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } })();
  if (cur !== '.githooks') { execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: ROOT, stdio: 'ignore' }); console.log('git: la revisión de secretos antes de cada commit está activa (.githooks/pre-commit)'); }
} catch {}
