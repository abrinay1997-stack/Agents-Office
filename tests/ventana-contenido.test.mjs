// La ventana centrada de una pieza de Contenido (25 oct 2026): lo que se comprueba leyendo el código (el recorrido de navegador es scripts/ventana-contenido-recorrido.mjs).
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const L = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('la pieza es un diálogo modal siempre, con fondo que cierra', () => {
  const pieza = L('src/pieza.js'), cont = L('src/contenido.js'), css = L('src/css/contenido.css');
  assert.match(pieza, /isModal = true; host\.setAttribute\('role', 'dialog'\); host\.setAttribute\('aria-modal', 'true'\)/);
  assert.doesNotMatch(cont, /<aside class="ct-panel"/, 'un aside no admite role=dialog (axe: aria-allowed-role)');
  assert.match(cont, /<div class="ct-scrim" data-modal-keep><\/div>/);
  assert.match(cont, /\.ct-scrim'\)\.addEventListener\('click'/);
  assert.match(css, /\.ct-panel \{[^}]*margin: auto[^}]*min\(1120px/);
  assert.match(css, /@container cvview \(max-width: 819\.98px\)/, 'la hoja usa el contenedor que de verdad tiene #ctOv');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.ct-panel, \.ct-scrim \{ animation: none/);
});
test('los pasos: nombres accesibles, teclado y guardado, y van en el paquete del editor', () => {
  const pasos = L('src/ventana-pasos.js'), ed = L('src/pieza-editor.js'), pieza = L('src/pieza.js');
  assert.match(pasos, /aria-label="Paso \$\{n\}: \$\{t\}"/, 'con el texto oculto en el teléfono, cada paso necesita nombre (axe: button-name)');
  assert.match(pasos, /e\.altKey && \(e\.key === 'ArrowRight'/);
  assert.match(pasos, /new CustomEvent\('ao:guardar'\)/);
  assert.match(pieza, /addEventListener\('ao:guardar', \(\) => \{ flush\(\); \}\)/);
  assert.doesNotMatch(pasos + pieza.match(/ao:guardar[^\n]*/)[0], /approve|aprobar\(/, 'guardar no aprueba');
  assert.match(ed, /import '\.\/ventana-pasos\.js'/); assert.match(ed, /import '\.\/ventana-ajuste\.js'/);
});
