#!/usr/bin/env node
// Mide la preselección de candidatas de «Actualizar conexiones» (cloudflare/worker/lib/conexiones.js → parecidas) sobre las 59 notas de fábrica.
//   node cloudflare/scripts/evals-enlaces.mjs             → recall@25 de los enlaces escondidos y los que no aparecieron
//   node cloudflare/scripts/evals-enlaces.mjs --guardar   → deja el resultado como línea base (evals-cerebro/linea-base.json → enlaces)
// Prueba justa: en TODAS las notas los [[enlaces]] se quitan por completo (ni queda el nombre como palabra que delate la respuesta) y la nota sobre la que se pregunta no tiene ningún enlace, como
// una nota recién escrita. No llama a ningún modelo. La define cerebro-evals.mjs (evaluarEnlaces); la usa cloudflare/tests/cerebro-evals-enlaces.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarBoveda, leerLineaBase } from '../../scripts/evals-cerebro.mjs';
import { enlacesReales, quitarEnlaces, evaluarEnlaces } from '../../cerebro-evals.mjs';
import * as knowledge from '../../knowledge.mjs';
import { parecidas, analizarEnlaces } from '../worker/lib/conexiones.js';

const NO_ENLAZAR = new Set(['CLAUDE', 'index', 'log']);
const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'evals-cerebro', 'linea-base.json');

/**
 * → { n, recall, fallos }. `candidatasDe(desde, contexto)` (puede ser async) sustituye a parecidas() para medir otra preselección (por ejemplo, con significado);
 * recibe { nota, ix, textos, grupos, pares, grado } ya preparados sin los enlaces de `desde`, y devuelve nombres.
 */
export async function medirPreseleccion({ boveda = cargarBoveda(), candidatasDe = null } = {}) {
  const reales = new Map([...boveda].map(([k, v]) => [k, v.text])), enlaces = enlacesReales(reales);
  const limpios = new Map([...boveda].map(([k, v]) => [k, quitarEnlaces(v.text)]));
  const textos = new Map([...limpios].filter(([k]) => !NO_ENLAZAR.has(k))), grupos = new Map([...boveda].map(([k, v]) => [k, v.group]));
  const ix = knowledge.buildIndex(textos);
  const { pares, grado } = analizarEnlaces([...reales].map(([nombre, texto]) => ({ nombre, texto })));
  const cand = candidatasDe || ((desde, c) => parecidas(c).map((x) => x.nombre));
  // solo las notas que una persona podría escribir de nuevo: los índices (index/log/CLAUDE) no se enlazan
  const medibles = enlaces.filter(([d, h]) => !NO_ENLAZAR.has(d) && !NO_ENLAZAR.has(h));
  return evaluarEnlaces(medibles, async (desde) => cand(desde, {
    nota: { nombre: desde, grupo: grupos.get(desde), texto: limpios.get(desde) }, ix, textos, grupos, pares: pares.filter(([a, b]) => a !== desde && b !== desde), grado,
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await medirPreseleccion();
  console.log(`Preselección de candidatas (BM25) · ${r.n} enlaces escondidos · recall@25 ${(r.recall * 100).toFixed(1)} %`);
  const base = leerLineaBase()?.enlaces; if (base) console.log(`  línea base (${base.fecha || 's/f'}): ${(base.recall * 100).toFixed(1)} %`);
  if (r.fallos.length) console.log(`\nNo aparecieron (${r.fallos.length}):\n` + r.fallos.slice(0, 40).map(([d, h]) => `  · ${d} → ${h}`).join('\n'));
  if (process.argv.includes('--guardar')) {
    const prev = leerLineaBase() || {};
    fs.writeFileSync(BASE, JSON.stringify({ ...prev, enlaces: { fecha: new Date().toISOString().slice(0, 10), motor: 'bm25', n: r.n, recall: r.recall } }, null, 2) + '\n');
    console.log('\nLínea base de la preselección guardada.');
  }
}
