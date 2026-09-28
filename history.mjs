// Agents Office — the history of skills and briefs (V4.4, 25 Sep 2026; audit D7). Every time the office reads the skills
// and the roster it compares each skill's SKILL.md and each agent's brief with what it saw last; a change keeps the new
// version in <data>/history/<kind>/<name>/<time>.md, so the owner can see what changed and when, and go back to any version
// from the office. The history stays on this machine (data/ does not travel).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
const safe = s => String(s).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60);
const indexFile = dataDir => path.join(dataDir, 'history', 'index.json');
const readIndex = dataDir => { try { return JSON.parse(fs.readFileSync(indexFile(dataDir), 'utf8')); } catch { return {}; } };

/**
 * items: [{ kind: 'skill' | 'brief', name, text, agents: [ids] }]. Stores what changed; returns the changes found now.
 * The first time an item is seen it is stored as its starting version (not counted as a change).
 */
export function snapshot(dataDir, items, now = Date.now()) {
  const idx = readIndex(dataDir), changed = [];
  for (const it of items) {
    const key = `${it.kind}:${it.name}`, h = hash(it.text || '');
    if (idx[key]?.hash === h) continue;
    const dir = path.join(dataDir, 'history', it.kind, safe(it.name));
    fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${now}.md`), it.text || '');
    const first = !idx[key];
    idx[key] = { hash: h, at: now, agents: it.agents || [], first: first ? now : idx[key].first, changedAt: first ? idx[key]?.changedAt || null : now };
    if (!first) changed.push({ kind: it.kind, name: it.name, at: now, agents: it.agents || [] });
  }
  if (changed.length || items.some(it => !readIndex(dataDir)[`${it.kind}:${it.name}`])) { fs.mkdirSync(path.dirname(indexFile(dataDir)), { recursive: true }); fs.writeFileSync(indexFile(dataDir) + '.tmp', JSON.stringify(idx)); fs.renameSync(indexFile(dataDir) + '.tmp', indexFile(dataDir)); }
  return changed;
}
/** The versions of one skill or brief, newest first: [{ at, size, preview }]. */
export function versions(dataDir, kind, name) {
  const dir = path.join(dataDir, 'history', kind, safe(name)); let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^\d+\.md$/.test(f)); } catch { return []; }
  return files.map(f => { const t = fs.readFileSync(path.join(dir, f), 'utf8'); return { at: +f.slice(0, -3), size: t.length, preview: t.replace(/^---[\s\S]*?---\s*/, '').slice(0, 160) }; }).sort((a, b) => b.at - a.at);
}
export function read(dataDir, kind, name, at) { try { return fs.readFileSync(path.join(dataDir, 'history', kind, safe(name), `${+at}.md`), 'utf8'); } catch { return null; } }
/** When each agent's skills or brief last changed (not counting the first sight): { agentId: ms } — for quality.drops. */
export function changesByAgent(dataDir) {
  const out = {};
  for (const v of Object.values(readIndex(dataDir))) if (v.changedAt) for (const a of v.agents || []) out[a] = Math.max(out[a] || 0, v.changedAt);
  return out;
}
