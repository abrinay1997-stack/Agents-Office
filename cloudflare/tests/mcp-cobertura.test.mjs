// «NINGÚN CABO SUELTO» (P6): toda ruta /api de ESCRITURA de la oficina o la cubre una herramienta del conector MCP (el `RUTAS` de su dominio) o está en `RUTAS_FUERA` con su motivo. Una ruta nueva que escribe y
// que nadie decidió HACE FALLAR esta prueba. La lista de rutas es la de la matriz de roles (rutas-escriben.mjs), que otra prueba mantiene completa; los dominios llevan su `RUTAS` dentro de su archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { ESCRIBEN } from './rutas-escriben.mjs';
import { RUTAS_FUERA } from '../worker/lib/mcp/rutas-fuera.js';
import { herramientas } from '../worker/lib/mcp/registro.js';
import '../worker/lib/mcp/base/index.js';
import '../worker/lib/mcp/dominios/index.js';

const DIR = new URL('../worker/lib/mcp/dominios/', import.meta.url);
const ESCRIBE = /^(POST|PUT|PATCH|DELETE)$/;
const aRegex = (p) => new RegExp('^' + p.replace(/:[A-Za-z_]+/g, '[^/]+') + '$');
/** Todas las rutas de ESCRITURA que declaran los dominios: ['POST', '/api/tareas/:id/delegar', 'tareas.js']. */
async function cubiertas() {
  const out = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.js') && x !== 'index.js')) {
    const m = await import(new URL(f, DIR));
    for (const r of m.RUTAS || []) { const [met, ruta] = String(r).split(' '); if (ESCRIBE.test(met)) out.push([met, ruta, f]); }
  }
  return out;
}

test('COBERTURA: toda ruta de escritura está cubierta por una herramienta o excluida con su motivo', async () => {
  const cub = (await cubiertas()).map(([, ruta]) => aRegex(ruta)), fuera = Object.keys(RUTAS_FUERA).map(aRegex);
  const sueltas = ESCRIBEN.filter((r) => !cub.some((x) => x.test(r)) && !fuera.some((x) => x.test(r)));
  assert.deepEqual(sueltas, [], `rutas que escriben y que ninguna herramienta del conector cubre ni está en RUTAS_FUERA (lib/mcp/rutas-fuera.js) con su motivo:\n${sueltas.join('\n')}`);
});

test('COBERTURA: RUTAS_FUERA no se queda vieja — cada entrada es una ruta que existe, tiene un motivo de verdad y no contradice a una herramienta', async () => {
  const claves = Object.keys(RUTAS_FUERA);
  for (const k of claves) {
    assert.match(k, /^\/api\/[a-z0-9\-/:]+$/i, k); assert.ok(typeof RUTAS_FUERA[k] === 'string' && RUTAS_FUERA[k].length >= 40, `${k}: el motivo debe explicar el porqué (≥ 40 letras)`);
    assert.ok(ESCRIBEN.some((r) => aRegex(k).test(r)), `${k}: no coincide con ninguna ruta de escritura de rutas-escriben.mjs (¿ya no existe?)`);
  }
  // una ruta no puede estar a la vez servida y vetada con el MISMO método y camino
  const servidas = new Set((await cubiertas()).map(([met, ruta]) => `${met} ${ruta}`));
  for (const k of claves) for (const met of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.ok(!servidas.has(`${met} ${k}`), `${met} ${k} está a la vez cubierta por una herramienta y en RUTAS_FUERA`);
});

test('COBERTURA: lo que cubre un dominio es de escritura de verdad y lo declara una herramienta registrada de ese dominio', async () => {
  const registrados = new Set(herramientas().map((h) => h.dominio));
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.js') && x !== 'index.js')) {
    const dominio = f.replace(/\.js$/, ''), m = await import(new URL(f, DIR));
    assert.ok(Array.isArray(m.RUTAS) || Object.isFrozen(m.RUTAS), `${f}: declara su RUTAS`);
    assert.ok(registrados.has(dominio), `${f}: ninguna herramienta registrada con dominio «${dominio}»`);
    for (const r of m.RUTAS) assert.match(String(r), /^(GET|POST|PUT|PATCH|DELETE) \/api\/[A-Za-z0-9\-/:._?=&]+( \(.*\))?$/, `${f}: «${r}» no es «MÉTODO /api/ruta» (con una nota entre paréntesis si hace falta)`);
  }
});
