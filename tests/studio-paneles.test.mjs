// 6 oct 2026 (el dueño): los paneles del Estudio se ensanchan; lo de siempre es lo más angosto y la galería nunca baja de su mínimo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { anchos, IZQ, DER, GALERIA_MIN } from '../src/studio-paneles.js';

test('cada lado entre su mínimo (el tamaño de siempre) y su máximo', () => {
  assert.deepEqual(anchos(3000, 0, 0), { izq: IZQ.min, der: DER.min });
  assert.deepEqual(anchos(3000, 9999, 9999), { izq: IZQ.max, der: DER.max });
  assert.deepEqual(anchos(1440, 500, 600, { conDer: false }), { izq: 500, der: 0 });
});

test('si no cabe, cede primero el panel derecho y la galería conserva su mínimo', () => {
  const a = anchos(1440, 600, 900);
  assert.equal(a.izq, 600); assert.equal(a.der, 1440 - 600 - GALERIA_MIN);
  const b = anchos(1200, 760, 1100);
  assert.equal(b.der, DER.min, 'el derecho no baja de su mínimo'); assert.equal(b.izq, 1200 - DER.min - GALERIA_MIN, 'después cede el compositor');
});

import { nivelAncho, DESDE, PLEGAR_BAJO } from '../src/studio-paneles.js';
test('Fase 3: el nivel de la VISTA decide si el banco va al lado y si el compositor se pliega solo', () => {
  assert.equal(DESDE, IZQ.min + DER.min + GALERIA_MIN);
  assert.equal(nivelAncho(1512), 'ancho');
  assert.equal(nivelAncho(1512 - 440), 'medio', 'con Dimitri a 440 el banco ya no cabe al lado: pasa a hoja');
  assert.equal(nivelAncho(DESDE - 1), 'medio');
  assert.equal(nivelAncho(PLEGAR_BAJO), 'medio');
  assert.equal(nivelAncho(PLEGAR_BAJO - 1), 'estrecho');
  assert.equal(nivelAncho(1024 - 340), 'estrecho', 'a 1024 con Dimitri la vista mide 684: el compositor se pliega');
});
