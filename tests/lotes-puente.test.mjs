// El puente entre la pestaña Lotes (studio-lotes.js) y el motor (lotes.mjs): banco de presets F2, integración.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../lotes-puente.mjs';
import { previaDe, columnasDe } from '../src/studio-lotes.js';

test('quién pide: el dueño salvo que diga dimitri o agent', () => {
  assert.equal(P.quien({}), 'you');
  assert.equal(P.quien({ by: 'agent' }), 'agent');
  assert.equal(P.quien({ by: 'dimitri' }), 'dimitri');
  assert.equal(P.quien({ by: 'root' }), 'you');
});

test('las columnas van y vuelven entre el desplegable y el motor', () => {
  const h = { cabeceras: ['Imagen', 'Código', 'Producto', 'Comentario'], columnas: { foto: 0, sku: 1, nombre: 2, preset: null, canal: null, encuadre: null, medidas: null, notas: 3 } };
  const ui = P.columnasParaUI(h);
  assert.deepEqual(ui.map(c => [c.nombre, c.campo]), [['Imagen', 'foto'], ['Código', 'sku'], ['Producto', 'nombre'], ['Comentario', 'notas']]);
  // la página las lee igual (una lista, no un mapa)
  assert.deepEqual(columnasDe(ui).map(c => c.campo), ['foto', 'sku', 'nombre', 'notas']);
  // el dueño quita «notas» y pone el comentario como preset: lo que nadie tiene va explícito a null
  ui[3].campo = 'preset';
  const m = P.columnasAlMotor(ui);
  assert.equal(m.preset, 3); assert.equal(m.notas, null); assert.equal(m.foto, 0); assert.equal(m.canal, null);
  assert.deepEqual(P.columnasAlMotor({ foto: 2 }), { foto: 2 }, 'un mapa del motor pasa tal cual');
});

test('el origen de la página se traduce al del motor', () => {
  assert.deepEqual(P.origenDelPedido({ tipo: 'carpeta', carpeta: 'c1' }), { carpeta: 'c1' });
  assert.deepEqual(P.origenDelPedido({ tipo: 'seleccion', files: ['2026-10/a.png', 7] }), { ids: ['2026-10/a.png'] });
  assert.deepEqual(P.origenDelPedido({ tipo: 'subidas', files: ['2026-10/b.jpg'] }), { ids: ['2026-10/b.jpg'] });
  const h = P.origenDelPedido({ tipo: 'hoja', hoja: 'habc123', nombre: 'x.xlsx', filas: [{}], columnas: [{ nombre: 'Foto', campo: 'foto' }], fotos: ['2026-10/c.png'] });
  assert.equal(h.hoja, 'habc123'); assert.equal(h.columnas.foto, 0); assert.deepEqual(h.sueltas, [{ file: '2026-10/c.png' }]);
  assert.deepEqual(P.origenDelPedido({ carpeta: 'Bodega' }), { carpeta: 'Bodega' }, 'el idioma del motor pasa tal cual');
  for (const malo of [null, { tipo: 'carpeta' }, { tipo: 'seleccion', files: [] }, { tipo: 'hoja' }, { tipo: 'ejemplo', n: 3 }, { tipo: 'disco' }])
    assert.throws(() => P.origenDelPedido(malo), e => e.status === 400 && /[a-záéíóúñ]/.test(e.message));
});

test('la pausa se dice en las palabras que la página distingue', () => {
  assert.equal(P.pausaDe({ estado: 'corriendo' }), null);
  assert.equal(P.pausaDe({ estado: 'pausado', motivo: 'muestra' }).por, 'muestra');
  assert.equal(P.pausaDe({ estado: 'pausado', motivo: 'lo pausaste tú.' }).por, 'dueño');
  assert.equal(P.pausaDe({ estado: 'pausado', motivo: 'el motor dice «sin créditos»' }).por, 'creditos');
  assert.equal(P.pausaDe({ estado: 'pausado', motivo: 'el tope del lote (US$1,00) no alcanza' }).por, 'presupuesto');
});

const lote = (over = {}) => ({ id: 'Labcd1', estado: 'previsto', muestra: 3, tope: { usd: 0 }, avisos: ['fila 4: «Más luz» se suma'],
  filas: [1, 2, 3, 4, 5].map(n => ({ n, estado: n === 5 ? 'revisar' : 'en_cola', error: n === 5 ? 'sin foto' : null, estimado: 0.04, sku: 'S' + n })), ...over });
const vista = { total: 0.16, filas: [{ n: 1, modelo: 'nano-banana-2', porque: 'edita conservando', soloLocal: false, costo: 0.04 }], cabe: { dia: true, mes: true, lote: true, cuenta: true, todo: true, por: 'Cabe hoy.' }, hoy: { costLeftDay: 2, costLeftMonth: 20 } };

test('la vista previa del motor se lee en la página como §6.3 pide', () => {
  const l = P.paraUI(lote(), vista, { nombreModelo: id => (id === 'nano-banana-2' ? 'Nano Banana 2' : id) });
  const p = previaDe(l);
  assert.equal(p.total, 5); assert.equal(p.costo, 0.16); assert.equal(p.muestraCosto, 0.12);
  assert.equal(p.modelo, 'Nano Banana 2'); assert.equal(p.cabe, true); assert.equal(p.cabeMuestra, true); assert.equal(p.quedaHoy, 2);
  assert.ok(p.avisos.some(a => /#5 S5: sin foto/.test(a)), 'las filas que no se pueden editar se avisan sin bloquear');
  assert.deepEqual(p.errores, []);
});

test('si no cabe, GENERAR se apaga con el motivo; si ninguna fila sirve, hay error', () => {
  const p = previaDe(P.paraUI(lote(), { ...vista, cabe: { dia: false, mes: true, lote: true, cuenta: true, todo: false, por: 'No cabe entero en el presupuesto del día (quedan US$0,10)' }, hoy: { costLeftDay: 0.1, costLeftMonth: 20 } }));
  assert.equal(p.cabe, false); assert.match(p.motivo, /presupuesto del día/); assert.equal(p.cabeMuestra, false, 'la muestra (US$0,12) tampoco cabe en US$0,10');
  const todas = lote({ filas: [{ n: 2, estado: 'revisar', error: 'sin foto' }] });
  assert.equal(previaDe(P.paraUI(todas, { total: 0, filas: [], cabe: { todo: true }, hoy: {} })).errores.length, 1);
});

test('la lista lleva el estado de cada foto, sin bitácora ni prompts', () => {
  const l = P.paraLista({ ...lote({ estado: 'pausado', motivo: 'muestra' }), bitacora: [{ t: 'x' }], receta: { pila: [] } });
  assert.equal(l.bitacora, undefined); assert.equal(l.receta, undefined);
  assert.deepEqual(l.filas[0], { n: 1, estado: 'en_cola', sku: 'S1' });
  assert.equal(l.pausa.por, 'muestra');
});

test('el ZIP por defecto lleva lo listo y lo aprobado', () => {
  assert.equal(P.queZip(undefined), 'listas'); assert.equal(P.queZip('aprobadas'), 'aprobadas'); assert.equal(P.queZip('x'), 'listas');
});
