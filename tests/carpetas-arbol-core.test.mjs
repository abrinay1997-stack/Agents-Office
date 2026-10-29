// Fase 1.a (29 oct 2026): lo PURO de las carpetas en árbol (media/galeria-core.mjs). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { arbol, normalizarCarpetas, descendientes, rutaIds, validarMover, nombreEntreHermanos, carpetaNueva, reordenar, planBorrado, confirmaBorrado, textoBorrado, topeCarpetas, hijosDe, MAX_PROFUNDIDAD } from '../media/galeria-core.mjs';
import * as GF from '../src/galeria-filtro.js';

const F = (id, name, parentId = null, orden = 0) => ({ id, name, parentId, orden });
const items = (...pares) => pares.flatMap(([folder, n]) => Array.from({ length: n }, (_, i) => ({ file: `${folder}-${i}`, folder })));

test('un folders.json viejo ({id,name,at}) es válido: todas raíces, orden = su posición', () => {
  const l = normalizarCarpetas([{ id: 'caaaaa', name: 'A', at: 1 }, { id: 'cbbbbb', name: 'B', at: 2 }]);
  assert.deepEqual(l.map(f => [f.parentId, f.orden]), [[null, 0], [null, 1]]);
});
test('padre inexistente, ella misma o un ciclo → raíz', () => {
  const l = normalizarCarpetas([F('ca', 'A', 'nada'), F('cb', 'B', 'cb'), F('cc', 'C', 'cd'), F('cd', 'D', 'cc')]);
  assert.equal(l.find(f => f.id === 'ca').parentId, null);
  assert.equal(l.find(f => f.id === 'cb').parentId, null);
  assert.ok(l.some(f => f.id === 'cc' && f.parentId === null) || l.some(f => f.id === 'cd' && f.parentId === null), 'el ciclo se rompe');
  assert.equal(arbol([], l).length, 4, 'todas siguen en el árbol');
});
test('arbol(): ruta, path, n directo y nTotal recursivo, en orden de recorrido', () => {
  const l = [F('cb', 'B', 'ca', 0), F('ca', 'A', null, 0), F('cc', 'C', 'cb', 0), F('cd', 'D', null, 1)];
  const a = arbol(items(['ca', 1], ['cb', 2], ['cc', 3], ['cd', 4], ['cgone', 9]), l), por = Object.fromEntries(a.map(x => [x.id, x]));
  assert.deepEqual(a.map(x => x.id), ['ca', 'cb', 'cc', 'cd']);
  assert.equal(por.cc.ruta, 'A / B / C'); assert.deepEqual(por.cc.path, ['ca', 'cb', 'cc']); assert.equal(por.cc.profundidad, 3);
  assert.deepEqual([por.ca.n, por.ca.nTotal, por.cb.n, por.cb.nTotal, por.cc.nTotal, por.cd.nTotal], [1, 6, 2, 5, 3, 4]);
  assert.deepEqual(por.ca.hijos, ['cb']);
});
test('arbol() acepta los recuentos ya hechos (la nube los saca con un group by)', () => {
  const a = arbol(null, [F('ca', 'A'), F('cb', 'B', 'ca')], { conteos: new Map([['ca', 1], ['cb', 2], ['cx', 5]]) });
  assert.deepEqual(a.map(x => x.nTotal), [3, 2]);
});
test('mover: ciclo y mover dentro de su propio hijo se rechazan; a la raíz y a otro padre, bien', () => {
  const l = [F('ca', 'A'), F('cb', 'B', 'ca'), F('cc', 'C', 'cb'), F('cd', 'D')];
  assert.equal(validarMover(l, 'ca', 'cc').codigo, 'ciclo');
  assert.equal(validarMover(l, 'ca', 'ca').codigo, 'ciclo');
  assert.equal(validarMover(l, 'ca', 'nada').codigo, 'padre');
  assert.equal(validarMover(l, 'nada', null).codigo, 'no-existe');
  assert.ok(validarMover(l, 'cb', null).ok); assert.ok(validarMover(l, 'cb', 'cd').ok);
});
test('profundidad máxima 8 contando el subárbol que se mueve', () => {
  const cadena = Array.from({ length: MAX_PROFUNDIDAD }, (_, i) => F('c' + 'abcdefgh'[i], 'N' + i, i ? 'c' + 'abcdefgh'[i - 1] : null));
  assert.equal(validarMover([...cadena, F('cz', 'Z')], 'cz', 'ch').codigo, 'profundidad');
  assert.ok(validarMover([...cadena, F('cz', 'Z')], 'cz', 'cg').ok);
  assert.throws(() => carpetaNueva(cadena, { id: 'cnueva', name: 'x', parentId: 'ch' }), /8 niveles/);
});
test('nombre único entre hermanos (sin mayúsculas ni acentos); en otro padre se puede repetir; auto añade (2)', () => {
  const l = [F('ca', 'Campaña'), F('cb', 'Fotos', 'ca')];
  assert.throws(() => nombreEntreHermanos(l, null, 'CAMPANA'), /ya hay una carpeta/);
  assert.equal(nombreEntreHermanos(l, null, 'Fotos'), 'Fotos');
  assert.equal(nombreEntreHermanos(l, 'ca', 'fotos', { auto: true }), 'fotos (2)');
  assert.equal(nombreEntreHermanos(l, 'ca', 'Fotos', { excluir: 'cb' }), 'Fotos', 'renombrarse a sí misma no choca');
  assert.throws(() => nombreEntreHermanos(l, null, '  '), /ponle un nombre/);
});
test('carpetaNueva: orden al final, padre inexistente = raíz, campos de lotes y agentes', () => {
  const l = [F('ca', 'A', null, 4)];
  const f = carpetaNueva(l, { id: 'cnuevo1', name: ' Lotes ', tipo: 'lote', creadaPor: 'lote', loteId: 'l1', parentId: 'nada', ahora: 7 });
  assert.deepEqual([f.name, f.parentId, f.orden, f.tipo, f.creadaPor, f.loteId, f.at], ['Lotes', null, 5, 'lote', 'lote', 'l1', 7]);
  assert.equal(carpetaNueva(l, { id: 'cx', name: 'x', tipo: 'otra', creadaPor: 'nadie' }).creadaPor, 'you');
});
test('reordenar: los pedidos primero, el resto detrás; uno de otro nivel falla', () => {
  const l = [F('ca', 'A', null, 0), F('cb', 'B', null, 1), F('cc', 'C', null, 2), F('cd', 'D', 'ca', 0)];
  assert.deepEqual(hijosDe(reordenar(l, null, ['cc', 'ca']), null).map(f => f.id), ['cc', 'ca', 'cb']);
  assert.throws(() => reordenar(l, null, ['cd']), /no está en ese nivel/);
});
test('planBorrado + confirmación + texto', () => {
  const l = [F('ca', 'Campaña mayo'), F('cb', 'B', 'ca'), F('cc', 'C', 'ca'), F('cd', 'D', 'cc'), F('ce', 'E')];
  const p = planBorrado(l, items(['ca', 20], ['cb', 50], ['cd', 50], ['ce', 7]), 'ca');
  assert.deepEqual([p.subcarpetas, p.nArchivos, p.carpetas.length], [3, 120, 4]);
  assert.ok(confirmaBorrado(p, { archivos: 120, subcarpetas: 3 }));
  assert.ok(!confirmaBorrado(p, { archivos: 119, subcarpetas: 3 })); assert.ok(!confirmaBorrado(p, null)); assert.ok(!confirmaBorrado(p, { archivos: '120', subcarpetas: 3 }));
  assert.match(textoBorrado('Campaña mayo', p), /«Campaña mayo» con 3 subcarpetas y 120 archivos/);
  assert.equal(planBorrado(l, [], 'cnada').carpetas.length, 0);
});
test('tope: 500 con aviso desde 490; 200 con el árbol apagado', () => {
  assert.equal(topeCarpetas(489).aviso, undefined); assert.match(topeCarpetas(490).aviso, /490 de 500/); assert.ok(!topeCarpetas(500).ok);
  assert.ok(topeCarpetas(199, false).ok); assert.ok(!topeCarpetas(200, false).ok);
});
test('el filtro por carpeta es recursivo con `sub`, y sin `sub` es el de siempre', () => {
  const l = [F('ca', 'A'), F('cb', 'B', 'ca')], ids = new Set(l.map(f => f.id));
  const its = [{ file: 'x', folder: 'ca' }, { file: 'y', folder: 'cb' }, { file: 'z' }];
  assert.deepEqual(its.filter(GF.matcher({ folder: 'ca' }, ids)).map(i => i.file), ['x']);
  assert.deepEqual(its.filter(GF.matcher({ folder: 'ca', sub: descendientes(l, 'ca') }, ids)).map(i => i.file), ['x', 'y']);
  assert.deepEqual(its.filter(GF.matcher({ folder: 'none', sub: descendientes(l, 'ca') }, ids)).map(i => i.file), ['z']);
  assert.deepEqual(rutaIds(l, 'cb'), ['ca', 'cb']);
});
