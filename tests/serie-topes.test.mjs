import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../serie-topes-core.mjs';
import { weightOf } from '../estudio-pesos.mjs';

const plano = { generacion: 0.09, vision: 0.04, qa: 0.03 }; // ~US$0,16 por plano: QA + visión ≈ 40 %
test('estimación realista: 30 planos ≈ US$4,6–5,0 y el máximo (con 1 reintento) cabe en el tope por defecto', () => {
  const e = T.estimarSerie(new Array(30).fill(plano));
  assert.ok(e.esperadoUsd >= 4.6 && e.esperadoUsd <= 5.0, e.esperadoUsd);
  assert.ok(e.maximoUsd > e.esperadoUsd);
  assert.equal(T.cabeEnTope(e, T.CONFIG_SERIE.topeSerieUsd), true);
  assert.equal(T.cabeEnTope(T.estimarSerie(new Array(60).fill(plano)), 10), false);
  assert.equal(T.CONFIG_SERIE.topeSerieUsd, 10); assert.equal(T.CONFIG_SERIE.topeMesCarruselesUsd, 45);
  assert.equal(Object.isFrozen(T.CONFIG_SERIE), true);
});
test('el tope sale de la CONFIG, no de una constante', () => {
  const e = T.estimarSerie(new Array(30).fill(plano), { reintentosMax: 0 });
  assert.ok(e.maximoUsd < T.estimarSerie(new Array(30).fill(plano)).maximoUsd);
});
test('reservar -> liquidar -> idempotente', () => {
  let l = T.nuevoLibro(1);
  let r = T.reservar(l, 's:1:1', 0.4); assert.ok(r.ok); l = r.libro;
  assert.equal(T.reservar(l, 's:1:1', 0.4).repetida, true);
  assert.equal(T.resumenLibro(l).reservado, 400000);
  r = T.reservar(l, 's:2:1', 0.7); assert.equal(r.codigo, 'tope_serie');
  l = T.liquidar(l, 's:1:1', 0.3).libro;
  const res = T.resumenLibro(l); assert.equal(res.gastado, 300000); assert.equal(res.reservado, 0); assert.equal(res.disponible, 700000);
  assert.equal(T.liquidar(l, 's:1:1', 9).repetida, true); assert.equal(T.resumenLibro(l).gastado, 300000);
  assert.ok(T.reservar(l, 's:2:1', 0.7).ok);
});
test('real mayor que lo reservado se anota, no se oculta', () => {
  const l = T.liquidar(T.reservar(T.nuevoLibro(5), 'k:1:1', 0.1).libro, 'k:1:1', 0.5).libro;
  assert.equal(T.resumenLibro(l).excedido, true);
});
test('liberar devuelve la reserva; un paso incierto sigue contando hasta decidir', () => {
  let l = T.reservar(T.nuevoLibro(1), 'k:1:1', 0.6).libro;
  assert.equal(T.resumenLibro(T.liberar(l, 'k:1:1').libro).disponible, 1e6);
  assert.equal(T.reservar(T.liberar(l, 'k:1:1').libro, 'k:1:1', 0.1).codigo, 'liberada');
  l = T.marcarIncierto(l, 'k:1:1').libro;
  assert.equal(T.resumenLibro(l).incierto, 600000); assert.equal(T.reservar(l, 'k:2:1', 0.6).codigo, 'tope_serie');
  assert.equal(T.resumenLibro(T.resolverIncierto(l, 'k:1:1', false).libro).disponible, 1e6);
  assert.equal(T.resumenLibro(T.resolverIncierto(l, 'k:1:1', true, 0.5).libro).gastado, 500000);
  assert.equal(T.liberar(l, 'nada').codigo, 'no_reservado');
});
test('tope del mes, cupo diario y clave obligatoria', () => {
  const l = T.nuevoLibro(10);
  assert.equal(T.reservar(l, 'k:1:1', 3, { mes: { topeUsd: 45, gastadoUsd: 43 } }).codigo, 'tope_mes');
  assert.ok(T.reservar(l, 'k:1:1', 3, { mes: { topeUsd: 45, gastadoUsd: 40 } }).ok);
  assert.equal(T.reservar(l, '', 1).codigo, 'clave');
  assert.equal(T.cupoSerieDia(40), 30); assert.equal(T.cupoSerieDia(0), 0);
  assert.equal(T.reservar(l, 'k:2:1', 1, { dia: { limit: 40, usadoSeries: 26 }, kind: 'video' }).codigo, 'cupo_dia');
  assert.ok(T.reservar(l, 'k:2:1', 1, { dia: { limit: 40, usadoSeries: 25 }, kind: 'video' }).ok);
});
test('el peso sale de estudio-pesos.mjs (música 3, video 5)', () => {
  assert.equal(weightOf('music'), 3); assert.equal(weightOf('video'), 5);
  assert.equal(T.cupoDia({ limit: 40, usadoSeries: 28, kind: 'music' }).ok, false);
  assert.equal(T.cupoDia({ limit: 40, usadoSeries: 27, kind: 'music' }).ok, true);
});
