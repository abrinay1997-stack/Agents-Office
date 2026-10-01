// El buscador del banco (src/presets-buscar.js): frases de tienda, sin tildes, en plural, con una letra de error
// (docs/propuesta-banco-presets.md §12, «presets-buscar»). Contra el catálogo de verdad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buscar, normalizar, raiz, cerca, sinonimosDe } from '../src/presets-buscar.js';
import { buscar as desdeCore } from '../src/presets-core.js';

const C = JSON.parse(fs.readFileSync(new URL('../docs/presets-catalogo.json', import.meta.url), 'utf8'));
const top = (q, n = 1, opts = { medio: 'image' }) => buscar(q, C.presets, opts).slice(0, n).map(r => r.id);
const arriba = (q, ids, n = 1, opts) => { const t = top(q, n, opts); assert.ok(t.some(id => ids.includes(id)), `«${q}» → ${t.join(', ')} (esperaba ${ids.join(' o ')})`); };

test('normalizar, raíz, una letra y sinónimos', () => {
  assert.equal(normalizar('  Catálogo   PARA la Web! '), 'catalogo para la web');
  assert.equal(normalizar('Más pequeña, ¿sí?'), 'mas pequena si');
  assert.equal(normalizar('un .cube y 4:5'), 'un .cube y 4:5');
  assert.equal(raiz('sombras'), raiz('sombra'));
  assert.equal(raiz('luces'), 'luz');
  assert.equal(raiz('oscura'), raiz('oscuro'));
  assert.ok(cerca('contraste', 'contrsate'), 'trasposición');
  assert.ok(cerca('amazon', 'amazonn'));
  assert.ok(!cerca('luz', 'lux'), 'las palabras cortas no se aproximan');
  assert.ok(sinonimosDe('atrás').includes('fondo'));
  assert.equal(desdeCore, buscar, 'presets-core reexporta el mismo buscador');
});

test('frases de tienda que deben encontrar el preset correcto', () => {
  arriba('se ve oscura', ['luz-mas-clara']);
  arriba('foto fea', ['cal-whatsapp', 'cat-proveedor']);
  arriba('quitar lo de atrás', ['fondo-blanco', 'cat-sin-fondo', 'limp-objetos'], 1);
  assert.ok(top('quitar lo de atrás', 3).includes('fondo-blanco'));
  arriba('que se vea pro', ['cat-web-panaclaw', 'luz-estudio']);
  arriba('para la web', ['cat-web-panaclaw']);
  arriba('para Instagram', ['enc-recortes-redes', 'mkt-carrusel', 'mkt-historia', 'cat-fbshop'], 1);
  arriba('para vender', ['cat-web-panaclaw']);
  arriba('la sábana arrugada', ['limp-arrugas']);
  arriba('foto de WhatsApp', ['cal-whatsapp', 'cat-whatsapp']);
  arriba('que no se corte', ['cat-margen-recortar', 'enc-distancia', 'enc-ampliar']);
  arriba('más espacio alrededor', ['cat-margen-recortar', 'enc-distancia', 'enc-ampliar']);
  arriba('como este anuncio', ['ref-anuncio']);
  arriba('que dé vueltas', ['vp-giro-360', 'cam-orbita'], 1, { medio: 'video' });
});

test('sin tildes, en plural y con una letra de error', () => {
  assert.equal(top('catalogo')[0].startsWith('cat-'), true);
  assert.deepEqual(top('catalogo', 3), top('catálogo', 3));
  const sombras = top('sombras', 5);
  assert.ok(sombras.some(id => id.startsWith('sombra-')) && sombras.includes('luz-abrir-sombras'), sombras.join());
  arriba('contrsate', ['luz-mas-contraste']);
  arriba('amazonn', ['cat-amazon']);
  arriba('WHATSAPP', ['cal-whatsapp', 'cat-whatsapp']);
});

test('«quitar sombra» es ambiguo: salen dos, los dos de sombra', () => {
  const r = buscar('quitar sombra', C.presets, { medio: 'image' });
  assert.equal(r[0].id, 'sombra-quitar');
  assert.ok(r.length >= 2 && /sombra/.test(r[1].id), r.slice(0, 3).map(x => x.id).join());
  assert.match(r[0].por, /buscar «quitar sombra»/, 'dice por qué salió');
});

test('filtros: medio, modo y grupo; sin texto, la portada (estrella, favoritos, recientes)', () => {
  assert.ok(buscar('vueltas', C.presets, { medio: 'image' }).every(r => C.presets.find(p => p.id === r.id).medios.includes('image')));
  const cero = buscar('fondo', C.presets, { medio: 'image', modo: 'cero' });
  assert.ok(cero.every(r => C.presets.find(p => p.id === r.id).modos.includes('cero')), 'en «Desde cero» no sale lo que necesita tu foto');
  assert.ok(buscar('', C.presets, { grupo: 'luz' }).every(r => r.id.startsWith('luz-')));
  const portada = buscar('', C.presets, { medio: 'image', favoritos: ['color-bn'], recientes: ['luz-mas-oscura'] });
  assert.equal(portada[0].id, 'color-bn'); assert.equal(portada[0].por, 'favorito');
  assert.ok(portada.some(r => r.id === 'luz-mas-oscura' && r.por === 'reciente'));
  assert.ok(portada.some(r => r.id === 'cat-web-panaclaw' && r.por === 'estrella'));
  assert.deepEqual(buscar('xyzw qqq', C.presets), []);
  assert.deepEqual(buscar('luz', null), []);
});
