#!/usr/bin/env node
// Inventario del puerto: qué grupos de rutas /api/* usa la interfaz y cuáles ya contesta el Worker.
// Uso: node cloudflare/scripts/inventario.mjs [--json]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTADAS } from '../worker/lib/portadas.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const archivos = (d, acc = []) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? archivos(p, acc) : /\.js$/.test(f) && acc.push(p); } return acc; };

export function gruposUsados(texto) {
  const g = new Map();
  for (const m of texto.matchAll(/['"`]\/api\/([a-zA-Z0-9_.-]+)/g)) g.set(m[1], (g.get(m[1]) || 0) + 1);
  return g;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const total = new Map();
  for (const f of archivos(join(RAIZ, 'src'))) for (const [k, n] of gruposUsados(readFileSync(f, 'utf8'))) total.set(k, (total.get(k) || 0) + n);
  const filas = [...total].sort((a, b) => b[1] - a[1]).map(([grupo, usos]) => ({ grupo, usos, enLaNube: PORTADAS.includes(grupo) }));
  if (process.argv.includes('--json')) console.log(JSON.stringify(filas, null, 1));
  else {
    for (const f of filas) console.log(`${f.enLaNube ? '✓' : '·'} /api/${f.grupo.padEnd(14)} ${String(f.usos).padStart(3)} usos`);
    const n = filas.filter((f) => f.enLaNube).length;
    console.log(`\n${n} de ${filas.length} grupos ya contestan en la nube.`);
  }
}
