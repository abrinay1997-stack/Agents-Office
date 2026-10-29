// CON-06: la escala de la vista previa de la ventana de una pieza (pura) y que las pestañas quedan fuera de lo que se escala.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { escalaVista, MIN_ESCALA, UMBRAL_PX } from '../src/ventana-escala.js';
const L = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('si cabe, escala 1', () => assert.equal(escalaVista({ natural: 500, cabecera: 40, libre: 600 }), 1));
test('se encoge solo la maqueta y la cabecera cuenta como fija', () => {
  const z = escalaVista({ natural: 600, cabecera: 50, libre: 500 }); // maqueta 550 → caben 450
  assert.ok(Math.abs(z - 450 / 550) < 0.001);
});
test('nunca baja del piso de 0,75 (antes 0,4)', () => {
  assert.equal(MIN_ESCALA, 0.75);
  assert.equal(escalaVista({ natural: 1000, cabecera: 50, libre: 300 }), 0.75);
});
test('entradas raras no rompen: sin espacio o sin maqueta, escala 1', () => {
  assert.equal(escalaVista({ natural: 0, cabecera: 0, libre: 100 }), 1);
  assert.equal(escalaVista({ natural: 500, cabecera: 0, libre: -5 }), 1);
});
test('debounce: un cambio de menos de 8 px de alto se ignora; volver a 1 siempre se aplica', () => {
  const maqueta = 550, actual = 0.8, z = actual + (UMBRAL_PX - 1) / maqueta;
  assert.equal(escalaVista({ natural: 600, cabecera: 50, libre: 50 + z * maqueta, actual }), actual);
  assert.equal(escalaVista({ natural: 600, cabecera: 50, libre: 700, actual }), 1);
  assert.notEqual(escalaVista({ natural: 600, cabecera: 50, libre: 50 + (actual + 20 / maqueta) * maqueta, actual }), actual);
});
test('el ajuste ya no usa zoom ni escucha cambios de clase; el CSS escala solo la maqueta', () => {
  const js = L('src/ventana-ajuste.js'), css = L('src/css/editor-contenido.css');
  assert.doesNotMatch(js.replace(/\/\/.*$/gm, ''), /\.zoom|attributeFilter: \[[^\]]*'class'/);
  assert.match(css, /\.pz-side \.pz-preview \.pv-stage \{ transform: scale\(var\(--pzs, 1\)\)/);
  assert.doesNotMatch(css, /\.pz-side \.pz-preview \{[^}]*transform/, 'las pestañas (.pv-tabs) no se escalan');
});
