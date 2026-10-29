// Genera presets/fabrica-worker.js: la fábrica del banco de presets para el Worker (donde no hay node:fs). Importa cada JSON con
// `import … with { type: 'json' }` (precedente: cloudflare/worker/lib/tareas/roster.js) y llama a armarFabrica, el MISMO armazón puro que usa
// cargarFabrica() en la oficina local. Un archivo de grupo nuevo en presets/ → `node scripts/generar-fabrica-worker.mjs` y se commitea el resultado;
// cloudflare/tests/presets-fabrica-worker.test.mjs falla si el archivo quedó viejo.   Uso: node scripts/generar-fabrica-worker.mjs [--comprobar]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARPETA_DE_MEDIO, PARTES, rutaDeGrupo } from '../presets/fabrica-core.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'presets');

export function textoFabricaWorker(dir = DIR) {
  const grupos = JSON.parse(fs.readFileSync(path.join(dir, 'grupos.json'), 'utf8'));
  const rutas = [];
  for (const g of grupos) { if (!CARPETA_DE_MEDIO[g.medio]) continue; const r = rutaDeGrupo(g); if (fs.existsSync(path.join(dir, r))) rutas.push(r); }
  const carpetas = [...new Set(Object.values(CARPETA_DE_MEDIO))];
  const huerfanos = []; // un archivo suelto en una carpeta también se importa: así armarFabrica lo avisa igual que en la oficina local
  for (const c of carpetas) { const d = path.join(dir, c); if (fs.existsSync(d)) for (const f of fs.readdirSync(d).sort()) if (f.endsWith('.json') && !rutas.includes(`${c}/${f}`)) huerfanos.push(`${c}/${f}`); }
  const todas = [...rutas, ...huerfanos];
  const nombre = (r) => 'g_' + r.replace(/\.json$/, '').replace(/[^a-z0-9]+/gi, '_');
  const partes = PARTES.map((p) => [p, 'p_' + p.replace(/\.json$/, '')]);
  return [
    '// GENERADO por scripts/generar-fabrica-worker.mjs — no se edita a mano. La fábrica del banco de presets para el Worker.',
    '// Mismo armazón que presets/fabrica.mjs (cargarFabrica): ver presets/fabrica-core.mjs. El test cloudflare/tests/presets-fabrica-worker.test.mjs compara las dos, byte a byte.',
    "import { armarFabrica } from './fabrica-core.mjs';",
    ...partes.map(([p, n]) => `import ${n} from './${p}' with { type: 'json' };`),
    ...todas.map((r) => `import ${nombre(r)} from './${r}' with { type: 'json' };`),
    '',
    'const ARCHIVOS = {',
    ...todas.map((r) => `  '${r}': ${nombre(r)},`),
    '};',
    '',
    'let FAB = null;',
    '/** La fábrica (catálogo, grupos, presets, iconos…), armada una vez por instancia del Worker. */',
    'export function cargarFabrica() {',
    '  return (FAB ||= armarFabrica({',
    ...partes.map(([p, n]) => `    ${p.replace('.json', '')}: ${n},`),
    '    archivos: ARCHIVOS,',
    '  }));',
    '}',
    '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destino = path.join(DIR, 'fabrica-worker.js'), nuevo = textoFabricaWorker();
  if (process.argv.includes('--comprobar')) { const hay = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : ''; if (hay !== nuevo) { console.error('presets/fabrica-worker.js está viejo: node scripts/generar-fabrica-worker.mjs'); process.exit(1); } console.log('presets/fabrica-worker.js al día'); }
  else { fs.writeFileSync(destino, nuevo); console.log('✓ presets/fabrica-worker.js (' + nuevo.length + ' bytes de código)'); }
}
