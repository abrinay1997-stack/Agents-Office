// Agents Office — costs and return (V4.4, 25 Sep 2026). Las cuentas, los precios y el presupuesto viven en costs-core.mjs (puro, también lo usa el Worker de Cloudflare);
// aquí solo está el libro en archivo de la oficina local: <data>/costs.jsonl, una línea por llamada a un modelo.
import fs from 'node:fs';
import path from 'node:path';
export * from './costs-core.mjs';

export const file = dataDir => path.join(dataDir, 'costs.jsonl');
export function append(dataDir, l) { try { fs.mkdirSync(dataDir, { recursive: true }); fs.appendFileSync(file(dataDir), JSON.stringify(l) + '\n'); } catch {} }
export function read(dataDir, since = 0) {
  let raw = ''; try { raw = fs.readFileSync(file(dataDir), 'utf8'); } catch { return []; }
  const out = []; for (const s of raw.split('\n')) { if (!s) continue; try { const j = JSON.parse(s); if (j.t >= since) out.push(j); } catch {} } return out;
}
