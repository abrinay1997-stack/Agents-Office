// Agents Office — Higgsfield's official request schemas, from its documentation (V4.4, 25 Sep 2026).
// Higgsfield publishes its whole API reference as one text file (docs.higgsfield.ai → «llms-full.txt»). Every model route
// in it has an «Endpoint ID» and a «Complete JSON schema». This script keeps only what the office needs — each route's
// fields, their types, allowed values, limits, defaults and which are required — in higgsfield-schemas.json, which
// media.mjs reads to build the Estudio's Higgsfield catalog and every request body. When Higgsfield adds a model or changes
// a field: download the new file and run
//   node scripts/higgsfield-schemas.mjs <ruta/al/llms-full.txt>
// then `npm run check` (tests/higgsfield.test.mjs checks every request the office can send against these schemas).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('uso: node scripts/higgsfield-schemas.mjs <llms-full.txt de docs.higgsfield.ai>'); process.exit(1); }
const text = fs.readFileSync(src, 'utf8');
const out = {};
for (const sec of text.split(/\n(?=# )/)) {
  const id = /\*\*Endpoint ID:\*\* `([^`]+)`/.exec(sec)?.[1]; if (!id) continue;
  const title = /^# (.+?)(?: API)?$/m.exec(sec)?.[1] || id;
  const js = /Complete JSON schema">\s*```json[^\n]*\n([\s\S]*?)\n\s*```/.exec(sec)?.[1]; if (!js) continue;
  let schema; try { schema = JSON.parse(js); } catch { console.warn('esquema ilegible: ' + id); continue; }
  let props = { ...(schema.properties || {}) }, req = [...(schema.required || [])];
  for (const k of ['allOf', 'anyOf', 'oneOf']) for (const x of schema[k] || []) props = { ...props, ...(x.properties || {}) };
  const p = {};
  for (const [name, v] of Object.entries(props)) {
    const alts = v.anyOf || v.oneOf || [];
    const types = [].concat(v.type || alts.map(x => x.type)).filter(t => t && t !== 'null');
    const e = v.enum || alts.flatMap(x => x.enum || []);
    const f = { t: types[0] || 'any' };
    if (e.length) f.e = e;
    for (const [k, to] of [['minimum', 'min'], ['maximum', 'max'], ['default', 'd'], ['maxItems', 'maxItems'], ['minItems', 'minItems']]) if (v[k] !== undefined && v[k] !== null) f[to] = v[k];
    p[name] = f;
  }
  out[id] = { title, req, p };
}
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'higgsfield-schemas.json');
fs.writeFileSync(dest, JSON.stringify({ source: 'https://docs.higgsfield.ai (llms-full.txt)', asOf: new Date().toISOString().slice(0, 10), endpoints: out }, null, 1) + '\n');
console.log(`${Object.keys(out).length} rutas → ${path.relative(process.cwd(), dest)}`);
