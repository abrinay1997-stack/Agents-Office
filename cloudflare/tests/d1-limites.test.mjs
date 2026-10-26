// Límites de D1 que SQLite de Node (las pruebas) no tiene y que solo rompen en producción con un «Error interno»:
//  · una consulta compuesta admite como mucho 5 términos («too many terms in compound SELECT»): `union` ≤ 4 por archivo del Worker;
//  · una sentencia admite como mucho 100 parámetros: nada de `in (?,?,…)` armado con más de 90 marcas a mano.
// Se encontró con «Restablecer oficina» (11 `union all`): pasaba todas las pruebas y fallaba al abrir la pestaña. Ver docs/cloudflare.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'worker');
const archivos = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.js') ? [p] : []; });

test('ninguna consulta del Worker usa más de 4 `union` (D1 admite 5 términos)', () => {
  for (const f of archivos(RAIZ)) {
    const n = (readFileSync(f, 'utf8').match(/\bunion(\s+all)?\b\s+select/gi) || []).length;
    assert.ok(n <= 4, `${f.slice(RAIZ.length)}: ${n} «union»: D1 falla con «too many terms in compound SELECT». Usa subconsultas escalares en UNA fila, o un lote de consultas.`);
  }
});
