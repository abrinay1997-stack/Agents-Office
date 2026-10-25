#!/usr/bin/env node
// Copia la interfaz REAL de la oficina (la que arma `node build.mjs` en la raíz) a public/oficina/, de donde el Worker la sirve
// detrás del login. public/oficina/ se genera en cada despliegue y no se versiona.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DESTINO = join(RAIZ, 'cloudflare', 'public', 'oficina');
/** archivo de dist/ → nombre con el que lo pide la página (serve.mjs los sirve en la raíz) */
export const ARCHIVOS = { 'command-centre-v2.html': 'index.html', 'estudio-extra.js': 'estudio-extra.js', 'tareas-vista.js': 'tareas-vista.js', 'anuncios-vista.js': 'anuncios-vista.js', 'pieza-editor.js': 'pieza-editor.js', 'dictado.js': 'dictado.js', 'movil.js': 'movil.js' };

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(DESTINO, { recursive: true });
  for (const [de, a] of Object.entries(ARCHIVOS)) {
    const origen = join(RAIZ, 'dist', de);
    if (!existsSync(origen)) { console.error(`Falta dist/${de}: corre «node build.mjs» en la raíz antes.`); process.exit(1); }
    copyFileSync(origen, join(DESTINO, a));
  }
  console.log(`Oficina copiada a cloudflare/public/oficina/ (${Object.keys(ARCHIVOS).length} archivos).`);
}
