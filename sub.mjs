// Agents Office — DIMITRI (see sub-core.mjs for the whole description: modes, ops, prompt, parsers). This file keeps ONLY what touches disk
// on the owner's machine (data/subgerente.json and its archive); everything pure lives in sub-core.mjs, which the Cloudflare Worker imports too
// (it has no files: its chat lives in D1). `export *` keeps every caller of './sub.mjs' working unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { renombrar } from './fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { MAX } from './sub-core.mjs';
export * from './sub-core.mjs';

export const file = dataDir => path.join(dataDir, 'subgerente.json');
export const archiveFile = dataDir => path.join(dataDir, 'subgerente-archivo.json');
export function load(dataDir) { try { const j = JSON.parse(fs.readFileSync(file(dataDir), 'utf8')); return { messages: Array.isArray(j.messages) ? j.messages : [] }; } catch { return { messages: [] }; } }
export function save(dataDir, st) {
  fs.mkdirSync(dataDir, { recursive: true });
  st.messages = st.messages.slice(-MAX);
  const tmp = file(dataDir) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(st, null, 2)); renombrar(tmp, file(dataDir));
}
/** «Nueva conversación» (V4.11): the conversation goes to data/subgerente-archivo.json (the last 10 kept), so it can come back (DESHACER). */
export function archive(dataDir) {
  const st = load(dataDir); if (!st.messages.length) return null;
  let a = []; try { a = JSON.parse(fs.readFileSync(archiveFile(dataDir), 'utf8')).archived || []; } catch {}
  const id = 'c' + Date.now().toString(36); a.push({ id, at: Date.now(), messages: st.messages }); a = a.slice(-10);
  fs.mkdirSync(dataDir, { recursive: true }); const tmp = archiveFile(dataDir) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ archived: a })); renombrar(tmp, archiveFile(dataDir));
  save(dataDir, { messages: [] });
  return id;
}
/** Brings an archived conversation back (the one just archived, by id): what was said after the clear is kept after it. */
export function restore(dataDir, id) {
  let a = []; try { a = JSON.parse(fs.readFileSync(archiveFile(dataDir), 'utf8')).archived || []; } catch {}
  const k = a.findIndex(x => x.id === id); if (k < 0) return false;
  const st = load(dataDir); st.messages = [...a[k].messages, ...st.messages]; save(dataDir, st);
  a.splice(k, 1); const tmp = archiveFile(dataDir) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ archived: a })); renombrar(tmp, archiveFile(dataDir));
  return true;
}
