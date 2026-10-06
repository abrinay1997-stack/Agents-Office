// IMG-46 (auditoría del Estudio de imagen, Fase 6, 6 oct 2026): cualquier configuración del compositor, como plantilla y nota del Cerebro.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as PL from '../plantillas.mjs';

test('ida y vuelta: la nota guarda modelo, ajustes, cantidad, prompt base y estilo', () => {
  const p = PL.limpiar({ nombre: 'Catálogo 4:5', kind: 'image', modelo: 'nano-banana-2', ajustes: { aspectRatio: '4:5', imageSize: '2K', mal: { x: 1 } }, n: 4, prompt: 'fondo blanco, luz suave', estilo: ['2026-10/a.png', '../../etc/passwd', 'C:/x.png'] });
  assert.equal(p.id, 'pl-catalogo-4-5');
  assert.deepEqual(p.estilo, ['2026-10/a.png'], 'nunca rutas del disco');
  assert.equal(p.ajustes.mal, undefined);
  const r = PL.deNota(PL.aNota(p), 'Catálogo 4:5.md');
  assert.deepEqual(r.problemas, []);
  for (const k of ['id', 'nombre', 'kind', 'modelo', 'n', 'prompt']) assert.equal(r.plantilla[k], p[k], k);
  assert.deepEqual(r.plantilla.ajustes, { aspectRatio: '4:5', imageSize: '2K' });
  assert.deepEqual(r.plantilla.estilo, ['2026-10/a.png']);
});

test('sin nombre no se guarda; la cantidad va de 1 a 8; sin prompt queda vacío', () => {
  assert.throws(() => PL.limpiar({ nombre: '  ' }), /nombre/);
  assert.equal(PL.limpiar({ nombre: 'x', n: 40 }).n, 8);
  assert.equal(PL.deNota(PL.aNota(PL.limpiar({ nombre: 'x' }))).plantilla.prompt, '');
  assert.equal(PL.deNota('# una nota cualquiera').plantilla, null);
});

test('en disco: guardar, reemplazar conservando las notas del dueño, listar y borrar a la papelera', () => {
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-pl-'));
  let avisos = 0; const s = PL.crearPlantillas({ brainPath: brain, onNota: () => avisos++ });
  const a = s.guardar({ nombre: 'Reel', kind: 'video', modelo: 'kling-3-std', n: 1 });
  const ruta = path.join(brain, a.archivo);
  fs.appendFileSync(ruta, 'Para los lanzamientos.\n');
  const b = s.guardar({ nombre: 'Reel', kind: 'video', modelo: 'veo-3.1-fast', n: 2 });
  assert.equal(b.reemplazo, true);
  assert.match(fs.readFileSync(ruta, 'utf8'), /Para los lanzamientos\./);
  assert.equal(s.lista().plantillas[0].modelo, 'veo-3.1-fast');
  assert.equal(s.borrar('pl-reel'), true); assert.equal(s.lista().plantillas.length, 0);
  assert.equal(fs.readdirSync(path.join(brain, PL.CARPETA, '.papelera')).length, 1);
  assert.equal(s.borrar('pl-reel'), false); assert.equal(avisos, 3);
});
