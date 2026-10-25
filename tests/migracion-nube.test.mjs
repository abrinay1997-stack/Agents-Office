// La herramienta de respaldo y la de migración al Cerebro de la nube.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { notasDelCerebro, lotes } from '../scripts/migrar-a-nube.mjs';
import { respaldar } from '../scripts/respaldo-local.mjs';
import { validarNotas } from '../cloudflare/worker/lib/cerebro.js';

function cerebroDePrueba() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-cerebro-'));
  fs.mkdirSync(path.join(d, '00-Empresa'), { recursive: true });
  fs.mkdirSync(path.join(d, 'Agents Office'), { recursive: true });
  fs.writeFileSync(path.join(d, '00-Empresa', 'oferta.md'), '# Oferta\nVer [[voz]].');
  fs.writeFileSync(path.join(d, '00-Empresa', 'voz.md'), '# Voz\nCálida.');
  fs.writeFileSync(path.join(d, 'Agents Office', '2026-10-25 entrega.md'), '---\ntask: t9\nagent: elead\n---\nBorrador [[oferta]].');
  return d;
}

test('notasDelCerebro lee las notas del equipo y las entregas, y el Worker las acepta', () => {
  const { notas, raw } = notasDelCerebro(cerebroDePrueba());
  assert.deepEqual(notas.map((n) => n.nombre).sort(), ['2026-10-25 entrega', 'oferta', 'voz']);
  const e = notas.find((n) => n.oficina);
  assert.equal(e.grupo, 'Agents Office'); assert.equal(e.tarea, 't9'); assert.ok(e.actualizado > 0);
  assert.ok(raw.some(([a, b]) => a === 'oferta' && b === 'voz'));
  assert.equal(validarNotas(notas).ok, true);
});

test('lotes respeta el máximo de notas y de bytes por subida', () => {
  const muchas = Array.from({ length: 250 }, (_, i) => ({ nombre: 'n' + i, texto: 'x' }));
  assert.deepEqual(lotes(muchas).map((l) => l.length), [100, 100, 50]);
  const grandes = Array.from({ length: 4 }, (_, i) => ({ nombre: 'g' + i, texto: 'y'.repeat(700_000) }));
  assert.deepEqual(lotes(grandes).map((l) => l.length), [2, 2]);
});

test('el respaldo copia data/ y las entregas, y deja un manifiesto; las capturas no', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-raiz-')), cer = cerebroDePrueba();
  fs.mkdirSync(path.join(raiz, 'data', 'capturas'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'data', 'tasks.json'), '{"tasks":[]}');
  fs.writeFileSync(path.join(raiz, 'data', 'capturas', 'x.png'), 'pesada');
  fs.writeFileSync(path.join(raiz, 'office.config.local.json'), '{}');
  const destino = path.join(os.tmpdir(), 'ao-resp-' + Date.now());
  const m = respaldar({ destino, raiz, cerebro: cer });
  assert.ok(fs.existsSync(path.join(destino, 'data', 'tasks.json')));
  assert.ok(!fs.existsSync(path.join(destino, 'data', 'capturas')));
  assert.ok(fs.existsSync(path.join(destino, 'cerebro', 'Agents Office', '2026-10-25 entrega.md')));
  assert.ok(fs.existsSync(path.join(destino, 'office.config.local.json')));
  assert.equal(m.partes.find((p) => p.nombre === 'data').archivos, 1);
  assert.ok(fs.existsSync(path.join(destino, 'MANIFIESTO.json')));
});

test('los exportadores de módulos se descubren por carpeta y las filas se parten en subidas de 200', async () => {
  const { exportadores, partirFilas } = await import('../scripts/migrar-a-nube.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-exp-'));
  fs.writeFileSync(path.join(dir, 'tareas.mjs'), "export async function exportar() { return { filas: { tareas: [{ id: 'a', valor: {} }] }, docs: {} }; }");
  fs.writeFileSync(path.join(dir, 'raro.mjs'), 'export const nada = 1;');
  const e = await exportadores(dir);
  assert.deepEqual(e.map((x) => x.modulo), ['tareas']);
  assert.deepEqual(partirFilas(Array.from({ length: 450 }, (_, i) => ({ id: String(i) }))).map((l) => l.length), [200, 200, 50]);
  assert.deepEqual(await exportadores(path.join(dir, 'no-existe')), []);
});
