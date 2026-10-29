// Fase 4 (carril D): la fábrica del banco de presets en el Worker es la MISMA que lee la oficina local, byte a byte, y no usa node:fs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarFabrica as local } from '../../presets/fabrica.mjs';
import { cargarFabrica as enWorker } from '../../presets/fabrica-worker.js';
import { armarFabrica } from '../../presets/fabrica-core.mjs';
import { textoFabricaWorker } from '../../scripts/generar-fabrica-worker.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('armarFabrica del Worker == cargarFabrica() local, byte a byte', () => {
  const a = JSON.stringify(local()), b = JSON.stringify(enWorker());
  assert.equal(a.length, b.length);
  assert.ok(a === b, 'la fábrica del Worker difiere de la local');
  assert.deepEqual(enWorker().problemas, [], 'la fábrica no debe traer problemas');
  assert.ok(enWorker().presets.length >= 150);
});

test('presets/fabrica-worker.js está al día con la carpeta presets/ (si añades un grupo: node scripts/generar-fabrica-worker.mjs)', () => {
  assert.equal(fs.readFileSync(path.join(RAIZ, 'presets', 'fabrica-worker.js'), 'utf8'), textoFabricaWorker());
});

test('lo que corre en el Worker no importa node:* (la fábrica, su núcleo y la API pura del banco)', () => {
  for (const f of ['presets/fabrica-worker.js', 'presets/fabrica-core.mjs', 'presets-api-core.mjs', 'presets-notas.mjs', 'src/presets-core.js', 'src/escena3d-core.js']) {
    const t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    assert.ok(!/from\s+['"]node:/.test(t) && !/require\(['"]node:/.test(t), `${f} importa node:*`);
  }
});

test('armarFabrica avisa de un archivo suelto y de un grupo mal rotulado, igual que la lectura de la carpeta', () => {
  const base = { catalogo: {}, tipos: {}, canales: [], familias: {}, iconos: {}, sinonimos: null };
  const f = armarFabrica({ ...base, grupos: [{ id: 'luz', medio: 'image' }], archivos: { 'imagen/luz.json': { grupo: 'otro', presets: [{ id: 'a', categoria: 'otro' }] }, 'imagen/suelto.json': { grupo: 'x', presets: [] } } });
  assert.ok(f.problemas.some((p) => /dice grupo «otro», se esperaba «luz»/.test(p)));
  assert.ok(f.problemas.some((p) => /imagen\/suelto\.json: no es de ningún grupo/.test(p)));
});
