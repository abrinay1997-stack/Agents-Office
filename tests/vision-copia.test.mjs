// src/vision-copia.js (28 oct 2026): las copias que Claude ve de una publicación — lo PURO (el reparto de fotogramas, los tiempos, los avisos al dueño).
// Lo que necesita un navegador (dibujar un canvas, un <video> de verdad) está en tests/vision-copia-navegador.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, shrinkStep, b64Bytes, tipoDeMedio, repartirFotogramas, tiemposDeFotogramas, resumenDeLecturas, avisosDeLectura, MAX_COPIAS, MAX_POR_VIDEO, VISION_SIDE, PIDE_DESDE_IMAGEN } from '../src/vision-copia.js';
import { MAX_IMAGES } from '../vision.mjs';

test('el tope de copias es el mismo que acepta el servidor (si uno cambia, el otro también)', () => {
  assert.equal(MAX_COPIAS, MAX_IMAGES);
  assert.equal(VISION_SIDE, 1568);
});

test('tipoDeMedio: JPEG, PNG y WebP son fotos; MP4, M4V, MOV y WebM son videos; un GIF o un audio no se pueden mirar', () => {
  for (const f of ['2026-10/a.jpg', '2026-10/a.JPEG', 'x/a.png', 'a.webp', '2026-10/foto.jpg?v=1']) assert.equal(tipoDeMedio(f), 'imagen', f);
  for (const f of ['2026-10/a.mp4', 'a.MOV', 'a.m4v', 'a.webm']) assert.equal(tipoDeMedio(f), 'video', f);
  for (const f of ['a.gif', 'a.mp3', 'a.svg', 'a', '', null, undefined]) assert.equal(tipoDeMedio(f), null, String(f));
});

test('repartirFotogramas: un solo reel = 4 cuadros; una foto y un video = la foto y 3 cuadros; cinco fotos = las 4 primeras', () => {
  const copias = r => r.plan.map(p => `${p.file}:${p.copias}`);
  assert.deepEqual(copias(repartirFotogramas(['a.mp4'])), ['a.mp4:4']);
  assert.deepEqual(copias(repartirFotogramas(['a.jpg', 'b.mp4'])), ['a.jpg:1', 'b.mp4:3']);
  assert.deepEqual(copias(repartirFotogramas(['a.jpg'])), ['a.jpg:1'], 'una foto es una imagen y nada más');
  assert.deepEqual(copias(repartirFotogramas(['a.mp4', 'b.mp4'])), ['a.mp4:2', 'b.mp4:2'], 'dos videos se reparten por igual');
  assert.deepEqual(copias(repartirFotogramas(['a.mp4', 'b.mp4', 'c.mp4'])), ['a.mp4:2', 'b.mp4:1', 'c.mp4:1'], 'el sobrante va al primero');
  const cinco = repartirFotogramas(['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg']);
  assert.deepEqual(copias(cinco), ['1.jpg:1', '2.jpg:1', '3.jpg:1', '4.jpg:1']); assert.equal(cinco.omitidos, 1);
  assert.ok(repartirFotogramas(['a.mp4']).plan[0].copias <= MAX_POR_VIDEO);
  const total = r => r.plan.reduce((n, p) => n + p.copias, 0);
  for (const medios of [['a.mp4', 'b.jpg', 'c.mp4', 'd.png', 'e.mp4'], ['a.jpg', 'b.mp4'], []]) assert.ok(total(repartirFotogramas(medios)) <= MAX_COPIAS, JSON.stringify(medios));
});

test('repartirFotogramas: lo que no se puede mirar (un GIF, un audio) se dice con su motivo y no gasta un hueco', () => {
  const r = repartirFotogramas(['a.gif', 'b.jpg', 'c.mp3', 3, null, '']);
  assert.deepEqual(r.plan.map(p => p.file), ['b.jpg']);
  assert.deepEqual(r.sinLeer.map(x => x.file), ['a.gif', 'c.mp3']);
  assert.ok(r.sinLeer.every(x => /no es una foto/.test(x.motivo)));
  assert.deepEqual(repartirFotogramas(undefined), { plan: [], sinLeer: [], omitidos: 0 });
});

test('tiemposDeFotogramas: repartidos por el medio de tramos iguales, nunca el primer ni el último instante', () => {
  assert.deepEqual(tiemposDeFotogramas(8, 4), [1, 3, 5, 7]);
  assert.deepEqual(tiemposDeFotogramas(10, 1), [5]);
  const t = tiemposDeFotogramas(0.5, 3); assert.equal(t.length, 3); assert.ok(t.every(x => x >= 0 && x <= 0.4), JSON.stringify(t));
  assert.deepEqual(tiemposDeFotogramas(0, 3), [0], 'un video sin duración conocida: el primer cuadro');
  assert.deepEqual(tiemposDeFotogramas(NaN, 2), [0]);
  const largo = tiemposDeFotogramas(3600, 4); assert.ok(largo.every((x, i) => x > (i ? largo[i - 1] : -1)) && largo.at(-1) < 3600);
});

test('el reductor: nunca amplía, baja la calidad y luego el tamaño, y cuenta bien los bytes de un base64', () => {
  assert.deepEqual(fitWithin(4000, 3000), { w: 1568, h: 1176, scaled: true });
  assert.deepEqual(fitWithin(800, 600), { w: 800, h: 600, scaled: false });
  assert.equal(shrinkStep({ w: 100, h: 100, q: 0.85 }, 10, 100), null);
  assert.deepEqual(shrinkStep({ w: 100, h: 100, q: 0.85 }, 1000, 100), { w: 100, h: 100, q: 0.75 });
  assert.deepEqual(shrinkStep({ w: 100, h: 100, q: 0.55 }, 1000, 100), { w: 80, h: 80, q: 0.85 });
  assert.equal(b64Bytes(Buffer.from('hola mundo').toString('base64')), 10);
  assert.equal(b64Bytes('data:image/jpeg;base64,' + Buffer.from('abc').toString('base64')), 3);
});

test('resumenDeLecturas y avisosDeLectura: dicen lo que miró de verdad y lo que NO pudo mirar, sin disimular', () => {
  assert.equal(resumenDeLecturas({ imagenes: [], fotos: 0, fotogramas: 0, videos: 0 }), '');
  assert.equal(resumenDeLecturas({ imagenes: [1, 2, 3], fotos: 1, fotogramas: 2, videos: 1 }), '1 foto y 2 cuadros de un video');
  assert.equal(resumenDeLecturas({ imagenes: [1, 2, 3, 4], fotos: 0, fotogramas: 4, videos: 2 }), '4 cuadros de 2 videos');

  const vio = avisosDeLectura({ vio: 2, miro: '1 foto y 1 cuadro de un video', vi: 'Una mesa de lentes y un letrero que dice «Examen gratis»' });
  assert.deepEqual(vio, [{ tipo: 'vio', texto: 'Miró 1 foto y 1 cuadro de un video: Una mesa de lentes y un letrero que dice «Examen gratis»' }]);
  const nover = avisosDeLectura({ vio: 0, miro: '', sinVer: 'el modelo que usa esta oficina (Meta Muse Spark) no mira imágenes' }, { que: 'la foto' });
  assert.equal(nover.length, 1); assert.equal(nover[0].tipo, 'aviso'); assert.match(nover[0].texto, /No pudo mirar la foto: el modelo .* no mira imágenes\. Esta propuesta sale solo del texto\./);
  const mixto = avisosDeLectura({ vio: 1, miro: '1 foto', vi: '' }, { sinLeer: [{ file: '2026-10/viejo.gif', motivo: 'no es una foto' }], omitidos: 2 });
  assert.deepEqual(mixto.map(a => a.tipo), ['vio', 'aviso', 'nota']);
  assert.match(mixto[1].texto, /No pude leer «viejo\.gif» para el agente: no es una foto\./); assert.match(mixto[2].texto, /Solo caben 4 imágenes: 2 archivos no se miraron\./);
  assert.deepEqual(avisosDeLectura({}, {}), [], 'una propuesta sin imágenes no dice nada de más');
  assert.match(PIDE_DESDE_IMAGEN, /sin inventar/);
});
