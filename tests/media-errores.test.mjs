// IMG-04 (auditoría del Estudio de imagen, 6 oct 2026): el error de un trabajo en español, por clase, con el original aparte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { explicar } from '../media/errores.mjs';
import { friendly } from '../media/motores.mjs';

test('un 400 de Google se lee en español, con quién falló y qué probar; el original queda aparte', () => {
  const r = explicar('Nano Banana 2: 400 Request contains an invalid argument.', 400);
  assert.equal(r.clase, 'formato');
  assert.match(r.texto, /^Nano Banana 2 no aceptó el pedido/);
  assert.match(r.texto, /otro formato u otro modelo/);
  assert.doesNotMatch(r.texto, /Request|400/);
  assert.equal(r.detalle, 'Nano Banana 2: 400 Request contains an invalid argument.');
});

test('el código se lee también del texto cuando no viene el status', () => {
  assert.equal(explicar('Kling 3: 422 unsupported aspect ratio').clase, 'formato');
  assert.equal(explicar('Soul 2: 503 Service Unavailable').clase, 'servicio');
  assert.match(explicar('Soul 2: 503 Service Unavailable').texto, /^Soul 2 tuvo un fallo de su lado/);
});

test('cada clase conserva las palabras que otros leen (lotes: créditos/saldo; check: contenido)', () => {
  assert.equal(explicar('Higgsfield: 403 Not enough credits', 403).clase, 'saldo');
  assert.match(explicar('Higgsfield: 403 Not enough credits', 403).texto, /créditos/);
  assert.equal(explicar('GPT Image: 401 Incorrect API key', 401).clase, 'key');
  assert.equal(explicar('fal: 402 insufficient balance', 402).clase, 'saldo');
  assert.match(explicar('fal: 402 insufficient balance', 402).texto, /saldo/);
  assert.equal(explicar('x: 429 Too Many Requests', 429).clase, 'espera');
  assert.equal(explicar('Higgsfield lo bloqueó por contenido (NSFW); cambia el prompt').clase, 'contenido');
  assert.match(explicar('blocked by safety system').texto, /contenido/);
  assert.equal(explicar('The operation was aborted due to timeout').clase, 'tiempo');
  assert.equal(explicar('fetch failed').clase, 'red');
});

test('un error que la oficina ya escribió en español pasa tal cual, sin detalle', () => {
  for (const m of ['no encuentro el archivo «x.png» en el Estudio', 'tardó más de 10 minutos; mira en el panel del servicio si terminó', 'el motor terminó sin devolver nada']) {
    const r = explicar(m); assert.equal(r.texto, m); assert.equal(r.detalle, ''); assert.equal(r.clase, 'otro');
  }
});

test('un error en inglés que no se reconoce no llega crudo: dice quién y qué hacer, y lo guarda aparte', () => {
  const r = explicar('Muse Image: something weird happened');
  assert.equal(r.clase, 'otro');
  assert.match(r.texto, /^Muse Image devolvió un error que la oficina no reconoce/);
  assert.equal(r.detalle, 'Muse Image: something weird happened');
  assert.equal(explicar('').texto, 'falló sin decir por qué; reintenta');
});

test('friendly() (lo que guarda el trabajo) es el texto de explicar()', () => {
  assert.equal(friendly('Nano Banana 2: 400 Request contains an invalid argument.', 400), explicar('Nano Banana 2: 400 Request contains an invalid argument.', 400).texto);
});

test('un error en español con código (MiniMax, la oficina) no se pisa con la frase genérica', () => {
  const m = 'MiniMax voz: tu cuenta de MiniMax no tiene saldo: recarga en platform.minimax.io';
  assert.equal(explicar(m, 400).texto, m);
  assert.equal(explicar('Muse Image: No image returned').clase, 'otro');
  assert.match(explicar('Muse Image: No image returned').texto, /no reconoce/);
});
