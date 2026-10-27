#!/usr/bin/env node
// Mide la búsqueda del Cerebro con las preguntas de evals-cerebro/preguntas.json (cerebro-evals.mjs).
//   node scripts/evals-cerebro.mjs              → imprime recall@1/3/5, MRR y las preguntas que no encontraron su nota
//   node scripts/evals-cerebro.mjs --guardar    → además deja el resultado como línea base (evals-cerebro/linea-base.json)
//   node scripts/evals-cerebro.mjs --vault ruta → otra carpeta de notas (por defecto brain-panaclaw/, las 59 notas de fábrica)
// No llama a ningún modelo ni cuesta nada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVault } from '../graph-build.mjs';
import { evaluarBusqueda, enlacesReales } from '../cerebro-evals.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVALS = path.join(RAIZ, 'evals-cerebro');

export const cargarBoveda = (vault = path.join(RAIZ, 'brain-panaclaw')) => readVault(vault).notes; // nombre → { group, path, text }
export const cargarNotas = (vault) => new Map([...cargarBoveda(vault)].map(([k, v]) => [k, v.text]));
export const cargarPreguntas = () => JSON.parse(fs.readFileSync(path.join(EVALS, 'preguntas.json'), 'utf8')).preguntas;
export const leerLineaBase = () => { try { return JSON.parse(fs.readFileSync(path.join(EVALS, 'linea-base.json'), 'utf8')); } catch { return null; } };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const notas = cargarNotas(arg('--vault') || undefined), preguntas = cargarPreguntas();
  const r = await evaluarBusqueda(notas, preguntas);
  const pct = (x) => (x * 100).toFixed(1) + ' %';
  console.log(`Búsqueda del Cerebro (BM25 por pasajes) · ${notas.size} notas · ${enlacesReales(notas).length} enlaces · ${r.n} preguntas`);
  console.log(`  recall@1 ${pct(r.recall[1])} · recall@3 ${pct(r.recall[3])} · recall@5 ${pct(r.recall[5])} · MRR ${r.mrr}`);
  const base = leerLineaBase();
  if (base?.busqueda) console.log(`  línea base (${base.fecha}): recall@5 ${pct(base.busqueda.recall[5])} · MRR ${base.busqueda.mrr}`);
  if (r.fallos.length) { console.log(`\nNo encontraron su nota entre las 5 primeras (${r.fallos.length}):`); for (const f of r.fallos) console.log(`  · ${f.id}: «${f.q}»\n      esperaba ${f.esperadas.join(' | ')} — obtuvo ${f.ranking.join(', ') || '(nada)'}`); }
  if (process.argv.includes('--guardar')) {
    const prev = leerLineaBase() || {};
    fs.writeFileSync(path.join(EVALS, 'linea-base.json'), JSON.stringify({ ...prev, fecha: new Date().toISOString().slice(0, 10), motor: prev.motor || 'bm25', busqueda: { n: r.n, recall: r.recall, mrr: r.mrr } }, null, 2) + '\n');
    console.log('\nLínea base de la búsqueda guardada.');
  }
}
