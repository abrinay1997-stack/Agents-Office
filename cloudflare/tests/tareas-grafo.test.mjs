// El módulo de tareas importa código de la raíz del repositorio (tareas/, routines-core.mjs, src/when.js…). Todo eso tiene que correr en un Worker:
// sin fs, sin child_process, sin path ni zlib, y sin paquetes de node_modules (el CI del Worker no instala las dependencias de la raíz).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

test('ningún archivo que importa el módulo de tareas usa fs, child_process, path ni zlib, ni un paquete de node_modules', () => {
  const visto = new Set(), cola = [path.resolve(AQUI, '../worker/modulos/tareas.js')], malos = [];
  while (cola.length) {
    const f = cola.pop(); if (visto.has(f)) continue; visto.add(f);
    const txt = fs.readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\/\*[\s\S]*?\*\//gm, '');
    for (const m of txt.matchAll(/^\s*(?:import|export)\b[^\n]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)) {
      const dest = m[1] || m[2];
      const nombre = path.relative(AQUI, f);
      if (/^node:(fs|child_process|path|zlib|dns|net|http|https|os)\b|^(fs|path|child_process|zlib)$/.test(dest)) malos.push(`${nombre} importa ${dest}`);
      else if (dest.startsWith('.')) cola.push(path.resolve(path.dirname(f), dest));
      else if (!dest.startsWith('node:')) malos.push(`${nombre} importa el paquete ${dest}`);
    }
  }
  assert.deepEqual(malos, []);
  assert.ok(visto.size > 25, `recorrió el grafo (${visto.size} archivos)`);
});
