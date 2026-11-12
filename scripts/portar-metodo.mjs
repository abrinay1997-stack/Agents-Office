// node scripts/portar-metodo.mjs <carpeta de CALENDARIOS-MARKETING-APP>
// Trae a metodo/ los módulos PUROS del «método de campañas» de la aplicación de calendarios de Juancito Ads (el curso
// de campañas: ciclo de ventas, números del negocio, revisión 3Q…) y sus tests. No se editan a mano aquí: si el
// calendario cambia una regla, se vuelve a correr este script y los tests dicen qué dejó de cuadrar. Lo propio de la
// oficina (dónde se guarda, cómo se lee de Meta, qué ve Dimitri) vive en anuncios/metodo*.mjs, no en estos archivos.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const origen = process.argv[2];
if (!origen || !fs.existsSync(path.join(origen, 'src', 'lib'))) { console.error('uso: node scripts/portar-metodo.mjs <carpeta del calendario>'); process.exit(1); }

// nombre en el calendario (src/lib/<x>.js) → nombre aquí (metodo/<y>.mjs)
export const MODULOS = {
  agenda: 'fechas', cicloVentas: 'ciclo-ventas', cicloNegocio: 'ciclo-negocio', umbrales3q: 'umbrales-3q', numerosNegocio: 'numeros-negocio',
  anuncios: 'meta-cifras', diagnostico: 'reglas-diagnostico', tresQ: 'tres-q', tiposArte: 'tipos-arte', consciencia: 'consciencia',
  scrapeCreators: 'scrape-creators', ventasSemana: 'ventas-semana', constantes: 'constantes',
};
const TESTS = ['agenda', 'cicloVentas', 'numerosNegocio', 'diagnostico', 'tresQ', 'scrapeCreators', 'ventasSemana'];

let commit = '';
try { commit = execFileSync('git', ['-C', origen, 'log', '-1', '--format=%h %ad', '--date=short'], { encoding: 'utf8' }).trim(); } catch { /* sin git: sin commit */ }

const cabecera = (de) => `// PORTADO de CALENDARIOS-MARKETING-APP (Juancito Ads) · ${de}${commit ? ` · commit ${commit}` : ''}.\n// NO se edita aquí: se regenera con \`node scripts/portar-metodo.mjs <calendario>\`. Lo propio de la oficina va en anuncios/metodo*.mjs.\n`;

/** Reescribe las importaciones relativas: "./tresQ.js" o "./consciencia" → "./tres-q.mjs"; lo que no está en MODULOS se deja y se avisa. */
function importaciones(texto, { base = './', archivo = '' } = {}) {
  return texto.replace(/(from\s+|import\s+)(["'])(\.\.?\/[^"']+)\2/g, (todo, pre, q, ruta) => {
    if (ruta === '../constants' || ruta === '../constants.js') return `${pre}${q}${base}constantes.mjs${q}`;
    const nombre = path.basename(ruta).replace(/\.js$/, '');
    if (MODULOS[nombre]) return `${pre}${q}${base}${MODULOS[nombre]}.mjs${q}`;
    console.warn(`  ! ${archivo}: importa «${ruta}», que no se porta`);
    return todo;
  });
}

fs.mkdirSync(path.join(ROOT, 'metodo'), { recursive: true });
for (const [de, a] of Object.entries(MODULOS)) {
  if (de === 'constantes') continue;
  const f = path.join(origen, 'src', 'lib', de + '.js');
  if (!fs.existsSync(f)) { console.warn(`  ! falta ${f}`); continue; }
  fs.writeFileSync(path.join(ROOT, 'metodo', a + '.mjs'), cabecera(`src/lib/${de}.js`) + importaciones(fs.readFileSync(f, 'utf8'), { archivo: de }));
}
// Lo único que estos módulos leen de src/constants.js del calendario: los meses.
fs.writeFileSync(path.join(ROOT, 'metodo', 'constantes.mjs'), cabecera('src/constants.js (solo MONTHS)')
  + 'export const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];\n');

for (const de of TESTS) {
  const f = path.join(origen, 'src', 'lib', de + '.test.js');
  if (!fs.existsSync(f)) { console.warn(`  ! falta ${f}`); continue; }
  const t = importaciones(fs.readFileSync(f, 'utf8'), { base: '../metodo/', archivo: de + '.test' }).replace(/from\s+(["'])vitest\1/, 'from "./vitest-compat.mjs"');
  fs.writeFileSync(path.join(ROOT, 'tests', `metodo-${MODULOS[de]}.test.mjs`), cabecera(`src/lib/${de}.test.js`) + t);
}
console.log(`metodo/: ${Object.keys(MODULOS).length} módulos y ${TESTS.length} tests portados${commit ? ' de ' + commit : ''}`);
