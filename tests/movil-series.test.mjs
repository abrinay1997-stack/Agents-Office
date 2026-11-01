// Versión móvil, Series de imágenes en la nube (N6): la vista solo existe con la nube, lleva la pantalla compartida con el conEstado de la versión móvil, y no habla con el servidor por su cuenta
// (todo pasa por cloudflare/public/nube-series.js, donde están los dos toques con la cifra del servidor).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const leer = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const vista = leer('src/movil/vistas/series.js'), pantalla = leer('cloudflare/public/nube-series.js'), indice = leer('src/movil/index.js');

test('móvil/series: se registra, solo con window.AO_NUBE, y entra en «Más → Trabajo»', () => {
  assert.match(indice, /vistas\/series\.js/); assert.match(indice, /agente, series\]\) r\(shell\)/);
  assert.match(vista, /if \(!window\.AO_NUBE\) return/); assert.match(vista, /id: 'series'/); assert.match(vista, /grupo: 'mas'/); assert.match(vista, /sec: 'trabajo'/);
});
test('móvil/series: usa conEstado y no llama al servidor ni inventa cifras ni tokens', () => {
  assert.match(vista, /import \{ conEstado \} from '\.\.\/\.\.\/accion\.js'/); assert.match(vista, /abrir\(cuerpo, \{ conEstado, movil: true \}\)/);
  assert.doesNotMatch(vista, /fetch\(|\/api\//);
});
test('pantalla compartida: todo dato pasa por esc(), el token y la cifra salen del servidor, y no se abre ningún motor de pago', () => {
  assert.doesNotMatch(pantalla, /permitirPago|seriesNubePago|pago: *true/);
  assert.match(pantalla, /costoMostradoUsd: e\.costoMostradoUsd/); assert.match(pantalla, /confirmacion: e\.token/); assert.match(pantalla, /'Idempotency-Key': idem\(\)/);
  assert.doesNotMatch(pantalla, /Math\.random\(\)/, 'ni el token ni la clave de idempotencia salen de Math.random');
});
