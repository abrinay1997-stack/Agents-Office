// Herramienta (no entra en `npm run check`): la tabla de la Biblioteca para docs/analisis-marketingskills-2026-10-07.md, sacada de
// la cabecera de cada habilidad (id, título, área, puestos, departamentos, referencias, evals). Reemplaza lo que hay bajo «<!-- tabla -->».
//   node scripts/biblioteca-tabla.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarBiblioteca, AREAS } from '../biblioteca.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'office.agents.json'), 'utf8')).agents;
const b = cargarBiblioteca({ raiz: ROOT, brainPath: null, agentes: roster, deptos: ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'] });
const nombre = Object.fromEntries(roster.map(a => [a.id, a.name]));
const filas = Object.keys(AREAS).flatMap(k => {
  const l = b.todas.filter(h => h.area === k); if (!l.length) return [];
  return [`| **${AREAS[k]}** | | | | |`, ...l.map(h => `| \`${h.id}\` | ${h.titulo} | ${h.agents.map(id => nombre[id] || id).join(', ')} | ${h.referencias.length} | ${h.origen.replace(/^marketingskills\//, '').replace(/ \(MIT.*$/, '')} |`)];
});
const tabla = `<!-- tabla -->\n${b.todas.length} habilidades, ${b.todas.reduce((n, h) => n + h.referencias.length, 0)} referencias.\n\n| Id | Habilidad | Puestos que más la usan | Referencias | Original |\n|---|---|---|---|---|\n${filas.join('\n')}\n`;
const doc = path.join(ROOT, 'docs', 'analisis-marketingskills-2026-10-07.md');
const t = fs.readFileSync(doc, 'utf8');
fs.writeFileSync(doc, t.replace(/<!-- tabla -->[\s\S]*?(?=\n## 5\.)/, tabla));
console.log(`✓ ${b.todas.length} habilidades en la tabla${b.problemas.length ? ` · ${b.problemas.length} problemas: ${b.problemas.slice(0, 3).join(' | ')}` : ''}`);
