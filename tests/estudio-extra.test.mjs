// La CARGA BAJO DEMANDA del Estudio (1 oct 2026, INF-09: la página tiene su presupuesto en check.mjs).
// El banco de presets, el escenario 3D y los lotes van en dist/estudio-extra.js (build-extra.mjs), no en la página; three.js no viaja
// dos veces; lo que la página sigue usando (la QA de la galería) se queda en ella. Aquí se construyen los dos paquetes en memoria
// (nada se escribe en dist/) y se comprueba qué lleva cada uno.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { construirExtra, threeQueSeComparte, COMPARTIDOS, CSS_APARTE } from '../build-extra.mjs';
import { motivoFallo, LOTE_ACTIVO, ARCHIVO } from '../src/estudio-carga.js';
import { threeCompartido } from '../src/three-compartido.js';

let extra = null;
const elExtra = async () => (extra ||= await construirExtra());
const entradasDe = async entrada => {
  const r = await build({ entryPoints: [entrada], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', metafile: true, define: { __AO_EXTRA_VERSION__: '"x"' }, logLevel: 'silent' });
  return Object.keys(Object.values(r.metafile.outputs)[0].inputs).map(f => f.replace(/\\/g, '/'));
};

test('el paquete aparte lleva el banco, su compilador y su buscador, el escenario 3D y los lotes, y no lleva three.js', async () => {
  const x = await elExtra();
  for (const f of ['src/studio-banco.js', 'src/studio-banco-core.js', 'src/studio-lotes.js', 'src/escena3d.js', 'src/escena3d-core.js', 'src/presets-core.js', 'src/presets-buscar.js'])
    assert.ok(x.aparte.includes(f), `${f} debería ir en dist/estudio-extra.js`);
  assert.ok(!x.aparte.some(f => f.includes('node_modules/three')), 'three.js no viaja en el paquete aparte');
  assert.ok(x.js.length < 400 * 1024, `el paquete aparte pesa ${Math.round(x.js.length / 1024)} KB: ¿se coló three.js?`);
  assert.match(x.js, /AO_ESTUDIO_EXTRA=\{/);
  assert.match(x.version, /^[0-9a-f]{12}$/);
  assert.ok(x.js.includes(`"${x.version}"`), 'el paquete lleva su versión, para que la página no use uno de otra construcción');
  assert.ok(!x.js.includes('@@AO_EXTRA_VERSION@@'));
});

test('la página no lleva nada del paquete aparte, salvo lo compartido; sí la cara diferida y la QA de la galería', async () => {
  const x = await elExtra(), pagina = await entradasDe('src/main.js');
  const colado = pagina.filter(f => x.aparte.includes(f));
  assert.deepEqual(colado, [], 'esto volvió a la página: impórtalo solo desde src/estudio-extra.js');
  for (const f of ['src/estudio-carga.js', 'src/studio-qa.js', 'src/three-compartido.js']) assert.ok(pagina.includes(f), `${f} va en la página`);
  for (const f of COMPARTIDOS) assert.ok(pagina.includes(f), `${f} es compartido: la página lo usa`);
});

test('el estilo del escenario y de los lotes viaja con el paquete, con la marca que cuenta check.mjs', async () => {
  const x = await elExtra();
  for (const f of CSS_APARTE) assert.ok(x.js.includes(`/* ---- src/css/${f} ---- */`), `${f} viaja con el paquete`);
  assert.match(x.js, /data-ao-extra/);
});

test('three.js compartido: cada THREE.X del paquete aparte lo da la página (src/three-compartido.js)', () => {
  const dado = threeCompartido(), nombres = threeQueSeComparte();
  for (const n of nombres) assert.ok(dado[n], `threeCompartido() no da ${n}`);
  assert.equal(typeof dado.OrbitControls, 'function');
  const usados = new Set(['src/escena3d.js', 'src/escena3d-core.js'].flatMap(f => [...readFileSync(f, 'utf8').matchAll(/\bTHREE\.([A-Za-z_]\w*)/g)].map(m => m[1])));
  for (const n of usados) assert.ok(nombres.has(n), `el escenario 3D usa THREE.${n} y la página no lo comparte`);
});

test('la tarjeta provisional de Lotes cuenta los lotes activos como los cuenta la pestaña de verdad', () => {
  const src = readFileSync('src/studio-lotes.js', 'utf8');
  const activos = JSON.parse(/export const ACTIVOS = Object\.freeze\((\[[^\]]*\])\)/.exec(src)[1].replace(/'/g, '"'));
  assert.deepEqual([...LOTE_ACTIVO], activos);
});

test('si no llega, el mensaje dice qué hacer: en file:// construir, servido revisar la oficina, de otra construcción recargar', () => {
  assert.equal(ARCHIVO, 'estudio-extra.js');
  assert.match(motivoFallo('file:', 'red'), /estudio-extra\.js/);
  assert.match(motivoFallo('file:', 'red'), /node build\.mjs/);
  assert.match(motivoFallo('http:', 'red'), /oficina/);
  assert.match(motivoFallo('http:', 'version'), /recarga/);
});
