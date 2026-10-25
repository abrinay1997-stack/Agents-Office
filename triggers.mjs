// Agents Office — triggers, the owner's machine (see triggers-core.mjs for the description and the pure half). This file keeps the file
// <brain>/Agents Office/triggers.json and the token check against the environment variable.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validate } from './triggers-core.mjs';
export * from './triggers-core.mjs';

export const file = brain => path.join(brain, 'Agents Office', 'triggers.json');
export function load(brain, agents) {
  let j = { triggers: [] }; try { j = JSON.parse(fs.readFileSync(file(brain), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') return { triggers: [], problems: ['triggers.json no es JSON válido: ' + e.message] }; }
  return validate(j.triggers, agents);
}

/** The token check, in constant time. No AO_HOOK_TOKEN on this machine = every hook is refused. */
export function authorized(given, expected = process.env.AO_HOOK_TOKEN) {
  if (!expected || String(expected).length < 16 || !given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
