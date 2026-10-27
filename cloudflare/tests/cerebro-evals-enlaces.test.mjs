// Cerebro — la preselección de «Actualizar conexiones», medida (issue #45). Se esconde cada enlace que el equipo SÍ escribió entre las 59 notas de fábrica y se mira si la nota enlazada aparece
// entre las ~25 candidatas que vería la IA. Sin IA, sin red, sin costo. La línea base está en evals/cerebro-busqueda/linea-base.json (`enlaces`); si este número baja, la preselección empeoró.
// La medida y sus reglas (los [[enlaces]] se quitan por completo para que el nombre no delate la respuesta) viven en cloudflare/scripts/evals-enlaces.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { medirPreseleccion } from '../scripts/evals-enlaces.mjs';
import { leerLineaBase } from '../../scripts/evals-cerebro.mjs';

test('la preselección de candidatas encuentra la mayoría de los enlaces que el equipo escribió (y no empeora)', async () => {
  const r = await medirPreseleccion();
  assert.ok(r.n > 60, `solo ${r.n} enlaces medidos`);
  const base = leerLineaBase()?.enlaces;
  assert.ok(base, 'falta la línea base de enlaces (node cloudflare/scripts/evals-enlaces.mjs --guardar)');
  assert.ok(r.recall >= base.recall - 0.02, `la preselección empeoró: ${base.recall} → ${r.recall} (no aparecieron: ${r.fallos.slice(0, 8).map((f) => f.join('→')).join(', ')})`);
});
