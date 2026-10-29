import test from 'node:test';
import assert from 'node:assert/strict';
import { revisarTopes, leerDiff, esCodigo, TOPE_LINEA, TOPE_LINEAS_ARCHIVO } from '../topes-core.mjs';

test('una línea añadida de más del tope y un archivo nuevo enorme fallan; lo existente y los datos no', () => {
  const larga = 'x'.repeat(TOPE_LINEA + 1);
  const f = revisarTopes([
    { ruta: 'src/nuevo.js', nuevo: true, lineasAnadidas: [larga, 'ok'], lineas: TOPE_LINEAS_ARCHIVO + 1, bytes: 10 },
    { ruta: 'serve.mjs', nuevo: false, lineasAnadidas: ['corta'], lineas: 99999 },
    { ruta: 'tests/fixtures/x.json', nuevo: true, lineasAnadidas: [larga], lineas: 99999 },
    { ruta: 'dist/command-centre-v2.html', nuevo: false, lineasAnadidas: [larga] },
  ]);
  assert.deepEqual(f.map(x => x.ruta), ['src/nuevo.js', 'src/nuevo.js']);
});
test('una excepción con motivo exime al archivo', () => {
  assert.deepEqual(revisarTopes([{ ruta: 'src/a.js', nuevo: true, lineasAnadidas: ['x'.repeat(400)], lineas: 1 }], { 'src/a.js': 'tabla generada' }), []);
});
test('leerDiff separa archivos, nuevos y líneas añadidas', () => {
  const d = leerDiff('diff --git a/a.js b/a.js\nnew file mode 100644\n--- /dev/null\n+++ b/a.js\n@@ -0,0 +1,2 @@\n+uno\n+dos\ndiff --git a/b.js b/b.js\n--- a/b.js\n+++ b/b.js\n@@ -1 +1 @@\n-viejo\n+nuevo\n');
  assert.deepEqual(d, [{ ruta: 'a.js', nuevo: true, lineasAnadidas: ['uno', 'dos'] }, { ruta: 'b.js', nuevo: false, lineasAnadidas: ['nuevo'] }]);
  assert.ok(esCodigo('src/x.js') && !esCodigo('docs/a.md') && !esCodigo('package-lock.json'));
});
