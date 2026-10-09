// fs-seguro.mjs (9 oct 2026): renombrar con reintento. Lo normal sigue igual; un error que no es pasajero se lanza como antes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renombrar } from '../fs-seguro.mjs';

test('renombrar: lo de siempre (pisa el destino) y un error que no es pasajero se lanza', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-fs-'));
  const a = path.join(dir, 'a.json'), b = path.join(dir, 'b.json');
  fs.writeFileSync(b, 'viejo'); fs.writeFileSync(a, 'nuevo');
  renombrar(a, b);
  assert.equal(fs.readFileSync(b, 'utf8'), 'nuevo'); assert.equal(fs.existsSync(a), false);
  assert.throws(() => renombrar(path.join(dir, 'no-existe'), b), e => e.code === 'ENOENT');
});

test('el servidor no usa fs.renameSync a pelo: todo guardado pasa por renombrar', () => {
  const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const malos = [];
  const mirar = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'data', '.git', 'tests', 'src'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) mirar(p); else if (/\.mjs$/.test(e.name) && !['fs-seguro.mjs', 'build.mjs'].includes(e.name) && /fs\.renameSync\(/.test(fs.readFileSync(p, 'utf8'))) malos.push(path.relative(raiz, p));
  } };
  mirar(raiz);
  assert.deepEqual(malos, [], 'usa renombrar() de fs-seguro.mjs');
});
