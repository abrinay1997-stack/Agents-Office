#!/usr/bin/env node
// Agents Office — the secrets check (V4.4, 25 Sep 2026). The repository can be public and the brain's company notes travel
// through it, so before a commit nothing that looks like a key, a password, a card number or a Panamanian ID card may go in.
//   node scripts/secrets-scan.mjs --staged   what is about to be committed (the pre-commit hook in .githooks/ runs this)
//   node scripts/secrets-scan.mjs --all      every file git tracks (npm run check and CI run this)
//   node scripts/secrets-scan.mjs a.md b.js  those files
// A line that is fine as it is (an example, a test) carries the word secrets-ok; a whole path goes in .secretsignore.
// Exit 1 when something is found, with the file, the line and what it looks like (the value itself is masked).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const luhn = d => { let s = 0, alt = false; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; };
export const RULES = [
  ['clave de Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['clave de OpenAI', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/],
  ['clave de Google (Gemini)', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['clave de xAI (Grok)', /\bxai-[A-Za-z0-9]{32,}/],
  ['token de GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['token de Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['clave de AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['clave de Stripe', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
  ['token de bot de Telegram', /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/],
  ['clave privada', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ['key de Higgsfield o fal.ai', /\b(?:HF_KEY|HF_API_SECRET|FAL_KEY)\s*[=:]\s*["']?[A-Za-z0-9-]{8,}[:][A-Za-z0-9]{16,}/],
  ['contraseña o key escrita en el código', /\b(?:api[_-]?key|secret|token|password|passwd|contraseña|clave)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i],
  ['número de tarjeta', /\b(?:\d[ -]?){13,19}\b/, m => { const d = m.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && /^[3-6]/.test(d) && luhn(d) && !/^(\d)\1+$/.test(d); }],
  ['cédula panameña', /\b(?:[1-9]|1[0-3]|PE|E|N|[1-9]?AV|[1-9]?PI)-\d{1,4}-\d{3,6}\b/, m => { const [a, b, c] = m.split('-'); if (c.length < 3 || (b + c).replace(/\D/g, '').length < 5) return false; return !(/^\d+$/.test(a) && +b >= 1 && +b <= 12 && /^(19|20)\d\d$/.test(c)) && !(c.length === 4 && /^(19|20)/.test(c) && +a <= 31); }], // 12-09-2026 is a date, not an ID
];
const SKIP = [/^node_modules\//, /^dist\//, /^package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|mp4|webm|zip|woff2?|ttf|pdf|glb)$/i];
function ignored(file) {
  if (SKIP.some(r => r.test(file))) return true;
  let pats = []; try { pats = fs.readFileSync(path.join(ROOT, '.secretsignore'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')); } catch {}
  return pats.some(p => { const re = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*') + '$'); return re.test(file); });
}
const mask = s => s.length <= 8 ? '****' : s.slice(0, 4) + '…' + s.slice(-2);
/** Findings in one text: [{ line, kind, sample }]. */
export function scanText(text) {
  const out = [];
  String(text).split('\n').forEach((l, i) => {
    if (/secrets-ok/.test(l)) return;
    for (const [kind, re, ok] of RULES) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      for (const m of l.matchAll(g)) if (!ok || ok(m[0])) { out.push({ line: i + 1, kind, sample: mask(m[0]) }); break; }
    }
  });
  return out;
}
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
export function scanFiles(mode, files = []) {
  let list = files, read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (mode === 'staged') { list = git(['diff', '--cached', '--name-only', '--diff-filter=ACM']).split('\n').filter(Boolean); read = f => git(['show', ':' + f]); }
  if (mode === 'all') list = git(['ls-files']).split('\n').filter(Boolean);
  const found = [];
  for (const f of list) {
    if (ignored(f)) continue;
    let t; try { t = read(f); } catch { continue; }
    if (t.includes('\u0000')) continue; // binary
    for (const x of scanText(t)) found.push({ file: f, ...x });
  }
  return { files: list.length, found };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const mode = a.includes('--staged') ? 'staged' : a.includes('--all') ? 'all' : 'files';
  const { files, found } = scanFiles(mode, a.filter(x => !x.startsWith('--')));
  if (!found.length) { if (!a.includes('--quiet')) console.log(`secretos: nada en ${files} archivo(s)`); process.exit(0); }
  console.error(`\n✗ Parece haber datos privados en ${found.length} línea(s). No se sube hasta quitarlos:\n`);
  for (const f of found) console.error(`  ${f.file}:${f.line}  ${f.kind}  (${f.sample})`);
  console.error('\nSi es un ejemplo inofensivo, añade la palabra secrets-ok en esa línea, o la ruta en .secretsignore.\nLas keys van en variables de entorno, nunca en archivos.\n');
  process.exit(1);
}
