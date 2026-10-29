import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../serie-deriva-core.mjs';

const ev = { producto_personaje: 'ok', paleta: 'ok', estilo: 'ok', encuadre: 'ok' };
const bueno = { producto_personaje: 5, paleta: 4, estilo: 4, encuadre: 4, evidencia: ev };
const malo = { producto_personaje: 2, paleta: 3, estilo: 2, encuadre: 2, evidencia: ev };
test('ΔE: mismo color 0, blanco/negro ~100, hex inválido null', () => {
  assert.equal(D.deltaE('#FF0000', '#ff0000'), 0);
  assert.ok(D.deltaE('#000000', '#ffffff') > 99);
  assert.ok(D.deltaE('#0a3d62', '#0b3e63') < 2);
  assert.equal(D.deltaE('zz', '#fff'), null);
  assert.equal(D.deltaE('#fff', '#ffffff'), 0);
});
test('fidelidad de paleta con datos de ejemplo', () => {
  const ok = D.fidelidadPaleta(['#0a3d62', '#f6b93b'], ['#0b3e60', '#f5b83c', '#ffffff']);
  assert.equal(ok.medido, true); assert.equal(ok.ok, true);
  const fuera = D.fidelidadPaleta(['#0a3d62', '#f6b93b'], ['#ff0000']);
  assert.equal(fuera.ok, false); assert.equal(fuera.fuera.length, 2);
  assert.deepEqual(D.fidelidadPaleta([], ['#fff']), { medido: false, motivo: 'No medido' });
});
test('puntuación: sin evidencia el eje no cuenta; media y umbral', () => {
  const p = D.puntuarPlano(bueno); assert.equal(p.media, 4.25); assert.equal(p.derivado, false); assert.equal(p.completo, true);
  const q = D.puntuarPlano({ ...bueno, evidencia: { paleta: 'x' } }); assert.deepEqual(Object.keys(q.ejes), ['paleta']); assert.equal(q.completo, false);
  assert.equal(D.puntuarPlano(malo).derivado, true);
  assert.deepEqual(D.puntuarPlano(malo).bajo.sort(), ['encuadre', 'estilo', 'producto_personaje']);
  assert.equal(D.puntuarPlano({}).media, null);
  assert.equal(D.puntuarPlano(bueno, { deltaEMedia: 12 }).derivado, true);
  assert.equal(D.puntuarPlano({ ...bueno, paleta: 9 }).ejes.paleta, undefined);
});
test('pausa si dos planos SEGUIDOS derivan', () => {
  const b = D.puntuarPlano(bueno), m = D.puntuarPlano(malo);
  assert.equal(D.evaluarDeriva([b, m, b, m]).pausar, false);
  assert.equal(D.evaluarDeriva([b, m, m]).pausar, true);
  assert.equal(D.evaluarDeriva([m, m, b]).pausar, false);
  assert.equal(D.evaluarDeriva(undefined).pausar, false);
});
test('re-anclaje cada 5 y anclas fijas (nunca el plano anterior)', () => {
  assert.deepEqual([4, 5, 10, 11].map(n => D.debeReanclar(n)), [false, true, true, false]);
  assert.equal(D.debeReanclar(0), false);
  const a = D.anclasDe({ personajes: [{ refs: ['h1', 'h2'] }, { refs: ['h1'] }], escaleta: [{ n: 1, clave: true, aprobada_version: 1, versiones: [{ v: 1, archivo: 'k.jpg' }] }, { n: 2, versiones: [{ v: 1, archivo: 'prev.jpg' }] }] });
  assert.deepEqual(a, { hoja: ['h1', 'h2'], planoClave: 'k.jpg' });
  assert.equal(D.anclasDe({}).planoClave, null);
});
