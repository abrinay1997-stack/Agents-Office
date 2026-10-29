// node scripts/topes-codigo-nuevo.mjs [base]   — compara contra la base (origin/main por defecto) y falla si el código
// NUEVO pasa los topes de topes-core.mjs. Excepciones con motivo en scripts/topes-excepciones.json.
// Sin la base a mano (clon superficial) no falla: dice que no pudo comparar.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../config.mjs';
import { leerDiff, revisarTopes } from '../topes-core.mjs';

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const candidatas = process.argv[2] ? [process.argv[2]] : ['origin/main', 'main'];
const base = candidatas.find(b => { try { git('rev-parse', '--verify', b); return true; } catch { return false; } });
if (!base) { console.log('topes: no hay base con la que comparar (clon superficial); omitido'); process.exit(0); }
let ancla; try { ancla = git('merge-base', base, 'HEAD').trim(); } catch { console.log('topes: sin ancestro común con ' + base + '; omitido'); process.exit(0); }
const archivos = leerDiff(git('diff', '-U0', '--no-color', '--diff-filter=AM', ancla, 'HEAD'));
for (const a of archivos) if (a.nuevo) { try { const t = fs.readFileSync(path.join(ROOT, a.ruta), 'utf8'); a.lineas = t.split('\n').length; a.bytes = Buffer.byteLength(t); } catch { /* ya no existe */ } }
let excepciones = {}; try { excepciones = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'topes-excepciones.json'), 'utf8')); } catch { /* sin excepciones */ }
const fallos = revisarTopes(archivos, excepciones);
if (fallos.length) { for (const f of fallos) console.error(`  ✗ ${f.ruta}: ${f.motivo}`); process.exit(1); }
console.log(`topes: ${archivos.length} archivo(s) tocado(s) desde ${base}, ninguno pasa los topes del código nuevo`);
