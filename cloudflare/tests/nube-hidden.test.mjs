// El atributo `hidden` no basta cuando la oficina pone `display:flex` a la clase (.sg-f): el campo sigue a la vista. nube.css lo corrige y esta prueba lo exige.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = dirname(fileURLToPath(import.meta.url));
test('nube.css esconde de verdad los .sg-f con hidden (formulario de conectores MCP)', () => {
  const css = readFileSync(join(AQUI, '..', 'public', 'nube.css'), 'utf8');
  assert.match(css, /\.sg-f\[hidden\][^{]*\{\s*display:\s*none/);
  const js = readFileSync(join(AQUI, '..', 'public', 'nube-conectores.js'), 'utf8');
  for (const id of ['cn-cab', 'cn-aqui', 'cn-sec']) assert.ok(js.includes(`class="sg-f" id="${id}"`), `${id} sigue siendo un .sg-f`);
});
