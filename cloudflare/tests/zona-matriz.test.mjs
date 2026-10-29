// Matriz de zonas horarias sobre la implementación ÚNICA de la hora (worker/lib/zona.js), en puro. Es genérica: no sabe de tareas ni de
// Contenido (CON-08 y B17 tendrán su propio helper y sus casos). Cubre una zona sin horario de verano, UTC, una con medias horas,
// el cambio de hora de primavera y otoño, y un día 31.
import test from 'node:test';
import assert from 'node:assert/strict';
import { componentes, instanteDe, desfaseMin, zonaValida, instanteDeTexto } from '../worker/lib/zona.js';

const ZONAS = ['America/Panama', 'UTC', 'Europe/Madrid', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland', 'America/Sao_Paulo'];
const PIEDRAS = [[2026, 0, 31, 23, 59], [2026, 2, 8, 12, 0], [2026, 2, 29, 12, 0], [2026, 9, 31, 8, 30], [2026, 10, 1, 0, 0], [2026, 11, 31, 23, 30], [2028, 1, 29, 10, 15]];

test('todas las zonas de la matriz son válidas y una inventada no', () => {
  for (const z of ZONAS) assert.ok(zonaValida(z), z);
  assert.equal(zonaValida('Marte/Olympus'), false);
});
test('ida y vuelta: componentes(instanteDe(...)) devuelve lo que se pidió, en cada zona y fecha', () => {
  for (const z of ZONAS) for (const [y, mo, d, h, mi] of PIEDRAS) {
    const c = componentes(z, instanteDe(z, y, mo, d, h, mi));
    assert.deepEqual([c.y, c.mo, c.d, c.h, c.mi], [y, mo, d, h, mi], `${z} ${y}-${mo + 1}-${d} ${h}:${mi}`);
  }
});
test('Panamá no cambia de hora: −300 min todo el año; UTC es 0', () => {
  for (const [y, mo, d] of PIEDRAS) { const t = instanteDe('UTC', y, mo, d, 12); assert.equal(desfaseMin('America/Panama', t), -300); assert.equal(desfaseMin('UTC', t), 0); }
});
test('el día 31 + 1 rueda al mes siguiente igual en cualquier zona', () => {
  for (const z of ZONAS) { const c = componentes(z, instanteDe(z, 2026, 0, 32, 9, 0)); assert.deepEqual([c.mo, c.d, c.h], [1, 1, 9], z); }
});
test('el cambio de hora existe donde debe: Madrid pasa de +60 a +120 en marzo de 2026 y Kolkata no cambia', () => {
  assert.equal(desfaseMin('Europe/Madrid', instanteDe('UTC', 2026, 0, 15, 12)), 60);
  assert.equal(desfaseMin('Europe/Madrid', instanteDe('UTC', 2026, 6, 15, 12)), 120);
  assert.equal(desfaseMin('Asia/Kolkata', instanteDe('UTC', 2026, 6, 15, 12)), 330);
});
test('un texto sin zona se lee en la zona pedida, no en la de la máquina', () => {
  const a = instanteDeTexto('America/Panama', '2026-10-30T09:00'), b = instanteDeTexto('UTC', '2026-10-30T09:00');
  assert.equal(a - b, 5 * 3600_000);
  assert.equal(instanteDeTexto('UTC', 'mañana'), null);
});
