// C1 (8 oct 2026): el FORMATO DE CADA RED. Una pieza tiene su `formato` y, si alguna red sale distinta, `formatos: { red: formato }`.
// Sin `formatos` todo es como antes (lo aprobado sigue aprobado); con ellos, las reglas, la nota, las entregas y la vista previa lo siguen.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatoDe, formatoVisible, nombreFormato, formatoValido, formatoInicial, normalizarFormatos, ponFormato, formatosConRedes, gruposDeFormato,
  revisarPublicacion, aplicarArreglo, postDePieza,
} from '../src/contenido-reglas.js';
import { normalizar, parsear, serializar, huella } from '../contenido/piezas.mjs';
import { entregasDe } from '../contenido/entrega.mjs';
import { pestanasDe } from '../src/contenido-preview.js';

const pieza = o => ({ fecha: '2026-10-20', hora: '10:00', formato: 'post', redes: ['instagram', 'facebook'], medios: ['2026-10/a.jpg'], texto: 'Hola', hashtags: '', comentario: '', historias: [], ...o });
const rev = p => revisarPublicacion(postDePieza(p), p.redes);

test('cada red entiende el formato a su manera: un carrusel de Facebook es un post; lo que no es Short en YouTube es un video', () => {
  assert.equal(formatoDe({ formato: 'reel', formatos: { facebook: 'post' } }, 'facebook'), 'post');
  assert.equal(formatoDe({ formato: 'reel', formatos: { facebook: 'post' } }, 'instagram'), 'reel');
  assert.equal(formatoDe({ format: 'carrusel' }, 'x'), 'carrusel', 'también con la forma de las reglas');
  assert.equal(formatoVisible('facebook', 'carrusel'), 'post');
  assert.equal(formatoVisible('youtube', 'carrusel'), 'post');
  assert.equal(formatoVisible('tiktok', 'post'), 'reel');
  assert.equal(formatoVisible('x', 'historia'), 'historia');
  assert.deepEqual(['youtube', 'youtube', 'tiktok', 'pinterest', 'linkedin', 'instagram'].map((r, i) => nombreFormato(r, ['reel', 'post', 'reel', 'post', 'carrusel', 'carrusel'][i])), ['Short', 'Video', 'Video', 'Pin', 'Publicación', 'Carrusel']);
  assert.equal(formatoValido('x', 'historia'), false); assert.equal(formatoValido('instagram', 'historia'), true); assert.equal(formatoValido('x', 'reel'), true);
  assert.equal(formatoInicial('x', 'historia'), 'post'); assert.equal(formatoInicial('facebook', 'reel'), 'reel'); assert.equal(formatoInicial('tiktok', 'historia'), 'reel');
});

test('lo que se guarda: el formato es el de Instagram y `formatos` solo las redes que salen distinto; cambiar una no mueve las demás', () => {
  assert.deepEqual(normalizarFormatos(['facebook', 'instagram'], { facebook: 'post', instagram: 'reel' }), { formato: 'reel', formatos: { facebook: 'post' } });
  assert.deepEqual(normalizarFormatos(['instagram', 'facebook'], { instagram: 'carrusel', facebook: 'post' }), { formato: 'carrusel', formatos: {} }, 'Facebook publica igual un carrusel y un post');
  assert.deepEqual(normalizarFormatos(['linkedin', 'x'], { linkedin: 'post', x: 'post' }), { formato: 'post', formatos: {} }, 'sin Instagram, el de la primera red');
  const p = pieza({ redes: ['instagram', 'facebook', 'x'] });
  const a = ponFormato(p, 'instagram', 'historia');
  assert.deepEqual(a, { formato: 'historia', formatos: { facebook: 'post', x: 'post' } }, 'Facebook y X siguen como post');
  assert.deepEqual(ponFormato({ ...p, ...a }, 'facebook', 'historia'), { formato: 'historia', formatos: { x: 'post' } });
  assert.deepEqual(ponFormato({ ...p, ...a }, 'instagram', 'post'), { formato: 'post', formatos: {} }, 'vuelven a ser todas iguales');
  assert.deepEqual(formatosConRedes({ formato: 'historia', formatos: {}, redes: ['instagram'] }, ['instagram', 'x']), { formato: 'historia', formatos: { x: 'post' } }, 'X entra como post: no tiene historias');
  assert.deepEqual(formatosConRedes({ formato: 'reel', formatos: { facebook: 'post' }, redes: ['instagram', 'facebook'] }, ['instagram']), { formato: 'reel', formatos: {} });
  assert.deepEqual(gruposDeFormato({ formato: 'reel', formatos: { facebook: 'post' } }, ['instagram', 'facebook', 'tiktok']), [{ formato: 'reel', redes: ['instagram', 'tiktok'] }, { formato: 'post', redes: ['facebook'] }]);
});

test('las reglas revisan cada red con su formato, y el arreglo de un formato toca solo esas redes', () => {
  const sinVideo = pieza({ formato: 'reel', formatos: { facebook: 'post' } });
  const r = rev(sinVideo);
  assert.deepEqual(r.errores, ['Un reel necesita un video.']);
  const a = r.arreglos['Un reel necesita un video.'];
  assert.equal(a.codigo, 'formato:post:instagram'); assert.equal(a.etiqueta, 'Publicarlo como post en Instagram');
  const arreglado = aplicarArreglo(postDePieza(sinVideo), a.codigo);
  assert.equal(arreglado.format, 'post'); assert.deepEqual(arreglado.formatos, {});
  // Instagram como historia y X como post: X no «tiene historias», pero esta pieza no le pide una
  const hist = pieza({ formato: 'historia', formatos: { x: 'post' }, redes: ['instagram', 'x'], medios: ['2026-10/h.jpg'], medidas: { '2026-10/h.jpg': { ancho: 1080, alto: 1920 } } });
  assert.ok(!rev(hist).errores.some(e => /no tiene historias/.test(e)), rev(hist).errores.join(' | '));
  assert.ok(rev({ ...hist, formatos: {} }).errores.includes('X no tiene historias.'), 'sin el formato propio, X sí se queja');
  // sin `formatos`, exactamente lo de siempre
  const igual = pieza({ formato: 'reel' });
  assert.deepEqual(rev(igual), revisarPublicacion({ ...postDePieza(igual), formatos: undefined }, igual.redes));
  assert.equal(aplicarArreglo(postDePieza(igual), 'formato:post').format, 'post');
});

test('la nota guarda `formatos` solo si hace falta: lo aprobado antes no cambia de huella', () => {
  const vieja = normalizar(pieza()).pieza;
  assert.deepEqual(vieja.formatos, {});
  assert.ok(!/formatos/.test(serializar({ ...vieja, id: 'p-20261020-abcd', creada: '', actualizada: '' })), 'una pieza de siempre se escribe igual que antes');
  const h0 = huella(vieja);
  assert.equal(huella({ ...vieja, formatos: undefined }), h0);
  const nueva = normalizar({ formatos: { facebook: 'reel', x: 'reel' } }, { ...vieja, redes: ['instagram', 'facebook'] });
  assert.deepEqual(nueva.pieza.formatos, { facebook: 'reel' }, 'una red que la pieza no tiene no se guarda');
  assert.notEqual(huella(nueva.pieza), h0, 'cambiar el formato de una red cambia lo que sale');
  const txt = serializar({ ...nueva.pieza, id: 'p-20261020-abcd', creada: '', actualizada: '' });
  assert.match(txt, /^formatos: \{"facebook":"reel"\}$/m);
  assert.deepEqual(parsear(txt).formatos, { facebook: 'reel' });
  assert.match(normalizar({ formatos: { facebook: 'directo' } }).error, /el formato es uno de/);
  assert.match(normalizar({ formatos: { myspace: 'post' } }).error, /no es una red/);
  assert.deepEqual(normalizar({ formatos: null }, nueva.pieza).pieza.formatos, {});
});

test('las entregas: otra red con otro formato es otra publicación; la historia «también» no se repite donde ya es historia', () => {
  const e = entregasDe(pieza({ formato: 'reel', formatos: { facebook: 'post' }, medios: ['2026-10/v.mp4'] }));
  assert.deepEqual(e.map(x => [x.redes.join('+'), x.formato]), [['instagram', 'reel'], ['facebook', 'post']]);
  const conHist = entregasDe(pieza({ formato: 'historia', formatos: { facebook: 'post' }, historiaTambien: true, historias: ['2026-10/h.jpg'] }));
  assert.deepEqual(conHist.map(x => [x.variante, x.redes.join('+'), x.formato]), [['post', 'instagram', 'historia'], ['post', 'facebook', 'post'], ['historia', 'facebook', 'historia']]);
  assert.deepEqual(entregasDe(pieza({ formato: 'carrusel', medios: ['2026-10/a.jpg', '2026-10/b.jpg'] })).map(x => [x.redes.join('+'), x.formato]), [['instagram+facebook', 'carrusel']], 'sin formatos, una sola como siempre');
});

test('la vista previa enseña cada red con su formato', () => {
  assert.deepEqual(pestanasDe({ formato: 'reel', formatos: { facebook: 'post' }, redes: ['instagram', 'facebook'] }), ['ig-reel', 'ig-feed', 'ig-perfil', 'fb-feed']);
  assert.deepEqual(pestanasDe({ formato: 'historia', formatos: { x: 'post' }, redes: ['instagram', 'x'] }), ['ig-historia', 'x-feed']);
  assert.deepEqual(pestanasDe({ formato: 'post', formatos: { youtube: 'reel' }, redes: ['instagram', 'youtube'] }), ['ig-feed', 'ig-perfil', 'yt-short']);
});
