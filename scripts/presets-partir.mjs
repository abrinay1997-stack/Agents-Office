// Banco de presets (F1, equipo de datos): parte docs/presets-catalogo.json en la fábrica de presets/, una sola vez.
//
//   node scripts/presets-partir.mjs              escribe presets/ (se niega si ya hay presets partidos)
//   node scripts/presets-partir.mjs --forzar     los vuelve a escribir encima (pierde lo editado a mano en presets/)
//   node scripts/presets-partir.mjs --comprobar  no escribe: dice qué preset de fábrica difiere del catálogo de docs/
//
// Después de partirlo, la fuente de verdad es presets/ (docs/presets-catalogo.json queda como la foto del 1 oct 2026).
// Lo que se añade a mano para el buscador va en presets/sinonimos.json, que este script no toca: así partir de nuevo
// no borra los sinónimos. La forma de cada archivo está en presets/fabrica.mjs (PARTES y rutaDeGrupo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rutaDeGrupo, cargarFabrica } from '../presets/fabrica.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, def) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const SRC = path.resolve(ROOT, arg('--catalogo', 'docs/presets-catalogo.json'));
const DIR = path.resolve(ROOT, arg('--dir', 'presets'));
const FORZAR = args.includes('--forzar'), COMPROBAR = args.includes('--comprobar');

const cat = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const json = v => JSON.stringify(v, null, 1) + '\n';
// lo que se escribe: un archivo por cosa compartida y uno por grupo, con los presets en el orden del catálogo
const salida = new Map();
salida.set('catalogo.json', { version: cat.version, fecha: cat.fecha, descripcion: 'Fábrica del banco de presets del Estudio, partida de docs/presets-catalogo.json (scripts/presets-partir.mjs). Especificación: docs/propuesta-banco-presets.md.', leyenda: cat.leyenda });
salida.set('grupos.json', cat.grupos);
salida.set('tipos.json', cat.tipos);
salida.set('canales.json', cat.canales);
salida.set('familias.json', cat.familias);
salida.set('iconos.json', cat.iconos);
const porGrupo = new Map();
for (const p of cat.presets) { if (!porGrupo.has(p.categoria)) porGrupo.set(p.categoria, []); porGrupo.get(p.categoria).push(p); }
for (const g of cat.grupos) {
  const lista = porGrupo.get(g.id) || [];
  if (!lista.length) continue; // «De PanaClaw» (mios) no tiene presets de fábrica: son notas del Cerebro
  salida.set(rutaDeGrupo(g), { grupo: g.id, presets: lista });
}
const sueltos = [...porGrupo.keys()].filter(k => !cat.grupos.some(g => g.id === k));
if (sueltos.length) { console.error('✗ presets con un grupo que no existe: ' + sueltos.join(', ')); process.exit(1); }

if (COMPROBAR) {
  const fab = cargarFabrica(DIR); const byId = new Map(fab.presets.map(p => [p.id, p]));
  const dif = cat.presets.filter(p => JSON.stringify(byId.get(p.id)) !== JSON.stringify(p)).map(p => p.id + (byId.has(p.id) ? ' (cambiado)' : ' (falta)'));
  const nuevos = fab.presets.filter(p => !cat.presets.some(q => q.id === p.id)).map(p => p.id);
  console.log(dif.length || nuevos.length ? `difieren del catálogo de docs/: ${dif.join(', ') || '—'} · nuevos: ${nuevos.join(', ') || '—'}` : '✓ presets/ es idéntico al catálogo de docs/');
  process.exit(0);
}
if (fs.existsSync(path.join(DIR, 'imagen')) && !FORZAR) {
  console.error('✗ presets/ ya está partido: la fuente de verdad es esa carpeta. Usa --forzar para volver a escribirla (pierde lo editado a mano) o --comprobar para ver diferencias.');
  process.exit(1);
}
for (const [rel, v] of salida) { const f = path.join(DIR, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, json(v)); }
const fab = cargarFabrica(DIR);
if (fab.presets.length !== cat.presets.length) { console.error(`✗ se perdieron presets al partir: ${fab.presets.length} de ${cat.presets.length}`); process.exit(1); }
console.log(`✓ ${salida.size} archivos en ${path.relative(ROOT, DIR)}/ · ${fab.presets.length} presets · ${Object.keys(fab.iconos).length} iconos · ${fab.canales.length} canales`);
