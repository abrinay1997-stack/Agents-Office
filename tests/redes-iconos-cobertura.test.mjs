// ICO-03 (Fase 0b, reducido por §0.1): cada red de REDES tiene su logo propio; el de conectores nace con el registro (Fase 5).
import test from 'node:test';
import assert from 'node:assert/strict';
import { REDES } from '../contenido/piezas-core.mjs';
import { REDES_CON_ICONO, iconoRed } from '../src/redes-iconos.js';

test('cada red de REDES tiene ícono propio (no el genérico)', () => {
  const sin = REDES.filter(r => !REDES_CON_ICONO.includes(r));
  assert.deepEqual(sin, [], 'redes sin ícono: ' + sin.join(', '));
  const gen = iconoRed('__no_existe__');
  for (const r of REDES) { const s = iconoRed(r); assert.match(s, /^<svg/); assert.notEqual(s, gen, r + ' cae en el genérico'); }
});
