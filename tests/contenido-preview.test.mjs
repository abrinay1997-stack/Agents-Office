// V4.10 (1 oct 2026): la vista previa por red y formato (src/contenido-preview.js) — lo puro: qué pestañas, qué proporción, dónde corta el pie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pestanasDe, proporcionFeed, cortePie, resumenAria, cuentaPara, ZONAS, NOMBRE_VISTA } from '../src/contenido-preview.js';

test('cada formato y cada red tienen su pestaña: una historia no se previsualiza como post, y Facebook tiene la suya', () => {
  assert.deepEqual(pestanasDe({ formato: 'post', redes: ['instagram', 'facebook'] }), ['ig-feed', 'ig-perfil', 'fb-feed']);
  assert.deepEqual(pestanasDe({ formato: 'carrusel', redes: ['instagram'] }), ['ig-feed', 'ig-perfil']);
  assert.deepEqual(pestanasDe({ formato: 'reel', redes: ['instagram', 'facebook'] }), ['ig-reel', 'ig-feed', 'ig-perfil', 'fb-reel']);
  assert.deepEqual(pestanasDe({ formato: 'historia', redes: ['instagram', 'facebook'] }), ['ig-historia', 'fb-historia']);
  assert.deepEqual(pestanasDe({ formato: 'post', redes: ['facebook'] }), ['fb-feed']);
  assert.ok(pestanasDe({ formato: 'post', redes: ['instagram'], historiaTambien: true }).includes('ig-historia'), '«también como historia» se puede mirar');
  assert.equal(NOMBRE_VISTA('fb-reel'), 'Facebook · Reel');
});

test('el feed respeta la proporción real entre 4:5 y 1.91:1, y dice cuándo se sale', () => {
  assert.equal(proporcionFeed({ ancho: 1080, alto: 1080 }).ratio, 1, 'un cuadrado se ve cuadrado (antes se recortaba a 4:5)');
  assert.equal(proporcionFeed({ ancho: 1080, alto: 1350 }).ratio, 0.8);
  const vertical = proporcionFeed({ ancho: 1080, alto: 1920 });
  assert.equal(vertical.fuera, 'alta'); assert.equal(vertical.ratio, 0.8);
  assert.equal(proporcionFeed({ ancho: 3000, alto: 1000 }).fuera, 'ancha');
  assert.equal(proporcionFeed({ ancho: 1920, alto: 1080 }).fuera, null);
  assert.deepEqual(proporcionFeed(null), { ratio: 0.8, real: null, fuera: null, medida: false }, 'sin medidas: 4:5 y lo dice');
});

test('el pie se corta por LÍNEAS, contando los saltos de línea, como Instagram (2) y Facebook (3)', () => {
  const corto = cortePie('Hola', { lineas: 2, cpl: 40 });
  assert.deepEqual([corto.visible, corto.cortado], ['Hola', false]);
  const dos = cortePie('Línea uno\n\n#optica #gafas', { lineas: 2, cpl: 40 });
  assert.equal(dos.cortado, true, 'la línea en blanco cuenta: Instagram enseña «Línea uno» y «… más»');
  assert.equal(dos.visible, 'Línea uno');
  const largo = cortePie('a'.repeat(200), { lineas: 2, cpl: 40, prefijo: 10 });
  assert.equal(largo.cortado, true); assert.ok(largo.antes <= 80 - 10 - 6 + 1, 'el nombre de la cuenta ocupa sitio en la primera línea');
  const fb = cortePie('uno\ndos\ntres\ncuatro', { lineas: 3, cpl: 44 });
  assert.equal(fb.visible, 'uno\ndos\ntres'); assert.equal(fb.cortado, true);
  assert.deepEqual(cortePie('', {}), { visible: '', cortado: false, antes: 0 });
});

test('las zonas que tapa la interfaz son las de Meta para reels e historias', () => {
  assert.deepEqual(ZONAS.reel, { arriba: 0.14, abajo: 0.35, lados: 0.06 });
  assert.deepEqual(ZONAS.historia, { arriba: 0.14, abajo: 0.2, lados: 0.06 });
});

test('el lector de pantalla oye qué vista es, cuánto texto se lee y qué tapa la interfaz', () => {
  const r = resumenAria({ medios: ['a.mp4'] }, 'ig-reel', { corte: { cortado: true, antes: 31 } });
  assert.match(r, /Instagram · Reel/); assert.match(r, /31 caracteres/); assert.match(r, /35 % inferior/);
  assert.match(resumenAria({ medios: [] }, 'ig-historia', {}), /no muestra el texto/);
  assert.match(resumenAria({ medios: ['a.png'] }, 'ig-feed', { fuera: 'alta' }), /no la acepta/);
});

test('la cuenta: la de Meta si está, si no la empresa; nunca «tu_cuenta»', () => {
  assert.equal(cuentaPara('instagram', { instagram: { usuario: 'panaclaw.pa' } }).nombre, 'panaclaw.pa');
  assert.equal(cuentaPara('instagram', { empresa: 'Óptica Pana Claw' }).nombre, 'opticapanaclaw');
  assert.equal(cuentaPara('facebook', { empresa: 'PanaClaw' }).nombre, 'PanaClaw');
  assert.equal(cuentaPara('facebook', { empresa: 'PanaClaw' }).iniciales, 'P');
  assert.notEqual(cuentaPara('instagram', {}).nombre, 'tu_cuenta');
});
