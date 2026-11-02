// Versión móvil — la Agenda de Contenido con miniaturas: lo puro (sin reloj: los días son fijos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { VISTAS, VISTA_DEFECTO, normalizarVista, miniaturaDe, estadoVisual, piezasPorDia, resumenDia, diasDeSemana, frasePiezas, primerasPalabras, LEYENDA, MAX_CELDA } from '../src/movil/contenido-agenda-puro.js';

const P = (o = {}) => ({ id: 'p' + Math.random().toString(36).slice(2, 6), redes: ['instagram'], formato: 'post', medios: [], historias: [], estado: 'borrador', fecha: '2026-11-04', hora: '10:00', ...o });

test('los modos: cinco, el predeterminado es «Mes + lista» y lo guardado raro vuelve a él', () => {
  assert.equal(VISTAS.length, 5); assert.equal(VISTAS[0][0], 'mes-lista'); assert.equal(VISTA_DEFECTO, 'mes-lista');
  for (const [k] of VISTAS) assert.equal(normalizarVista(k), k);
  for (const x of [null, undefined, '', 'mes', 'otra', 42]) assert.equal(normalizarVista(x), 'mes-lista');
});

test('miniatura: imagen, video y texto; un carrusel dice 1/N; una historia es 9:16', () => {
  const img = miniaturaDe(P({ medios: ['2026-11/a.png'] }));
  assert.equal(img.tipo, 'imagen'); assert.equal(img.src, '2026-11/a.png'); assert.equal(img.indicador, ''); assert.equal(img.ratio, '1:1');
  const car = miniaturaDe(P({ formato: 'carrusel', medios: ['a.png', 'b.png', 'c.png'] }));
  assert.equal(car.indicador, '1/3'); assert.equal(car.n, 3); assert.equal(car.ratio, '4:5'); assert.equal(car.src, 'a.png');
  const vid = miniaturaDe(P({ formato: 'reel', medios: ['2026-11/v.MP4'] }));
  assert.equal(vid.tipo, 'video'); assert.equal(vid.ratio, '9:16');
  const his = miniaturaDe(P({ formato: 'historia', historias: ['h.png'] }));
  assert.equal(his.tipo, 'imagen'); assert.equal(his.ratio, '9:16'); assert.equal(his.src, 'h.png');
  const txt = miniaturaDe(P({ titulo: 'Lanzamos la colección de verano con descuentos para todos', medios: [] }));
  assert.equal(txt.tipo, 'texto'); assert.equal(txt.src, null); assert.ok(txt.texto.length <= 29 && txt.texto.endsWith('…'), txt.texto);
  assert.equal(miniaturaDe({}).tipo, 'texto'); assert.equal(miniaturaDe(null).tipo, 'texto');
});

test('el formato por red manda: una pieza que en su primera red es historia se ve 9:16', () => {
  assert.equal(miniaturaDe(P({ formato: 'post', formatos: { instagram: 'historia' }, medios: ['x.png'] })).ratio, '9:16');
});

test('primeras palabras: no corta una palabra a la mitad y no inventa nada', () => {
  assert.equal(primerasPalabras({ titulo: 'Hola mundo' }), 'Hola mundo');
  assert.equal(primerasPalabras({ texto: 'Una oferta increíble solo por hoy y mañana' }, 20), 'Una oferta increíble…');
  assert.equal(primerasPalabras({ texto: 'Una oferta increíble solo por hoy y mañana' }, 17), 'Una oferta…');
  assert.equal(primerasPalabras({}), '');
  assert.equal(primerasPalabras({ titulo: 'Supercalifragilisticoespialidosoextraordinario' }, 10), 'Supercalif…');
});

test('el estado que se ve lleva glifo y trazo propios, no solo color', () => {
  const claves = ['idea', 'borrador', 'revision', 'aprobada'].map(e => estadoVisual({ estado: e }));
  assert.deepEqual(claves.map(c => c.clave), ['idea', 'borrador', 'revision', 'aprobada']);
  const todos = [...claves, estadoVisual({ estado: 'aprobada' }, { clave: 'en_red' }), estadoVisual({ estado: 'aprobada' }, { clave: 'publicada' }), estadoVisual({ estado: 'aprobada' }, { clave: 'fallo', malo: true })];
  assert.deepEqual(todos.map(c => c.clave), ['idea', 'borrador', 'revision', 'aprobada', 'programada', 'publicada', 'fallo']);
  assert.equal(new Set(todos.map(c => c.glifo)).size, 7, 'cada estado tiene su glifo');
  assert.equal(todos.at(-1).trazo, 'doble'); assert.equal(todos[1].trazo, 'punteado');
  assert.deepEqual(LEYENDA.map(([g]) => g), todos.map(c => c.glifo), 'la leyenda dice lo mismo que los estados');
  assert.equal(estadoVisual(null).clave, 'idea');
});

test('por día: ordena por hora y las que no tienen hora van al final; las sin día no entran', () => {
  const a = P({ id: 'a', hora: '18:00' }), b = P({ id: 'b', hora: '09:00' }), c = P({ id: 'c', hora: '' }), d = P({ id: 'd', fecha: '2026-11-05' }), e = P({ id: 'e', fecha: '' });
  const m = piezasPorDia([a, b, c, d, e]);
  assert.deepEqual(m.get('2026-11-04').map(p => p.id), ['b', 'a', 'c']); assert.deepEqual([...m.keys()].sort(), ['2026-11-04', '2026-11-05']);
});

test('resumen de un día: hasta 3 y un +N con el resto', () => {
  const ps = [1, 2, 3, 4, 5].map(i => P({ id: 'x' + i }));
  assert.equal(MAX_CELDA, 3);
  assert.deepEqual([resumenDia(ps.slice(0, 2)).mostrar.length, resumenDia(ps.slice(0, 2)).mas], [2, 0]);
  assert.deepEqual([resumenDia(ps.slice(0, 3)).mostrar.length, resumenDia(ps.slice(0, 3)).mas], [3, 0]);
  const r = resumenDia(ps); assert.equal(r.mostrar.length, 3); assert.equal(r.mas, 2); assert.equal(r.n, 5);
  assert.deepEqual(resumenDia([]), { mostrar: [], mas: 0, n: 0 });
});

test('la semana: lunes a domingo, también cuando el día cae en domingo o en cambio de mes', () => {
  assert.deepEqual(diasDeSemana('2026-11-04'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.equal(diasDeSemana('2026-11-08')[0], '2026-11-02'); assert.equal(diasDeSemana('2026-11-02')[6], '2026-11-08');
  const w = diasDeSemana('2026-10-31'); assert.equal(w[0], '2026-10-26'); assert.equal(w[6], '2026-11-01');
});

test('la frase del lector de pantalla cuenta las piezas por estado', () => {
  assert.equal(frasePiezas([]), '');
  assert.equal(frasePiezas([P({ estado: 'aprobada' })]), '1 pieza: 1 aprobada');
  assert.equal(frasePiezas([P({ estado: 'borrador' }), P({ estado: 'borrador' }), P({ estado: 'aprobada' })]), '3 piezas: 2 borrador, 1 aprobada');
});
