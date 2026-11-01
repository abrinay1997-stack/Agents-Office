// El aborto del SDK de Anthropic: desde 0.91 el `name` de APIUserAbortError es 'Error', así que serve.mjs lo reconoce también por la clase.
// (No se levanta el servidor: se prueba la clase del SDK y que serve.mjs la use.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('APIUserAbortError se reconoce por instanceof aunque su name no sea «APIUserAbortError»', async (t) => {
  let Anthropic; try { ({ default: Anthropic } = await import('@anthropic-ai/sdk')); } catch { return t.skip('el SDK es opcional y no está instalado'); }
  assert.equal(typeof Anthropic.APIUserAbortError, 'function');
  const e = new Anthropic.APIUserAbortError();
  assert.ok(e instanceof Anthropic.APIUserAbortError);
  assert.ok(e instanceof Error);
});

test('serve.mjs reconoce el aborto por nombre y por clase, sin romper si el SDK no está', () => {
  const src = fs.readFileSync(new URL('../serve.mjs', import.meta.url), 'utf8');
  assert.match(src, /SdkAbortError = Anthropic\.APIUserAbortError \|\| null/);
  assert.match(src, /e\?\.name === 'APIUserAbortError' \|\| \(SdkAbortError && e instanceof SdkAbortError\)/);
});
