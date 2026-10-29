// UX-08 (Fase 0b): «Más» móvil abre las vistas de escritorio por el DOM del escritorio. Si un id cambia, falla aquí y no en silencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fuente = leer('src/movil/escritorio.js');
const archivos = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'movil' ? [] : archivos(path.join(d, e.name))) : /\.(js|html)$/.test(e.name) ? [path.join(d, e.name)] : []);
const DONDE = [...archivos('src'), ...archivos('cloudflare/public')].map(f => leer(f)).join('\n');

// Cada id (#x) y cada clase de cierre usada por una entrada debe existir en la página o en el código que la dibuja.
const ids = [...new Set([...fuente.matchAll(/'#([A-Za-z][\w-]*)/g)].map(m => m[1]).concat([...fuente.matchAll(/clic\('([\w-]+)'\)/g)].map(m => m[1])))];
test('escritorio.js: cada #id que usa existe en la página o en el código que lo crea', () => {
  assert.ok(ids.length > 10);
  const muertos = ids.filter(id => !new RegExp(`id=["']${id}["']|["'#]${id}["']|\\bid\\s*[:=]\\s*["']${id}["']|\\.id\\s*=\\s*["']${id}["']`).test(DONDE));
  assert.deepEqual(muertos, [], 'ids muertos en ESCRITORIO: ' + muertos.join(', '));
});
test('escritorio.js: las clases de botones que clica existen (.tc-lab, .cp-x) y las pestañas de la nube', () => {
  for (const c of ['tc-lab', 'cp-x']) assert.ok(DONDE.includes(c), 'falta la clase ' + c);
  for (const t of ['nube-perfil', 'nube-equipo']) assert.ok(DONDE.includes(t), 'falta la pestaña ' + t);
});
test('escritorio.js: las clases de body de «abierta» las pone alguien', () => {
  for (const c of [...fuente.matchAll(/body\(([^)]*)\)/g)].flatMap(m => [...m[1].matchAll(/'(\w+)'/g)].map(x => x[1]))) assert.ok(new RegExp(`['"\`.]${c}['"\`]|${c}`).test(DONDE.replace(fuente, '')), 'nadie pone body.' + c);
});
test('ESCRITORIO: ids de entrada únicos y con título, abrir y cerrar', async () => {
  const { ESCRITORIO } = await import('../src/movil/escritorio.js');
  assert.equal(new Set(ESCRITORIO.map(e => e.id)).size, ESCRITORIO.length);
  for (const e of ESCRITORIO) for (const k of ['titulo', 'abrir', 'abierta', 'cerrar']) assert.ok(e[k], `${e.id} sin ${k}`);
});
