// `dia(ms)` de tareas/ (sin zona) tiene que dar la fecha de la OFICINA en el Worker, no la UTC: de 19:00 a 24:00 en Panamá la UTC va un día adelante
// y «hoy», «mañana» y las fechas límite de las listas salían corridas. Lo arregla `instalarZona` (fija también la zona de etiqueta-dia.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarZona, quitarZona, conZona, DateReal } from '../worker/lib/zona.js';
import { dia } from '../../tareas/dueno.mjs';
import { fijarZona } from '../../tareas/etiqueta-dia.mjs';
import { avisosLimite } from '../../tareas/ritmo.mjs';

test('dia(ms) sin zona da la fecha de la oficina tras instalarZona', () => {
  try {
    instalarZona('America/Panama');
    assert.equal(dia(Date.parse('2026-10-30T00:30:00Z')), '2026-10-29'); // 19:30 del 29 en Panamá
    assert.equal(dia(Date.parse('2026-10-30T05:00:00Z')), '2026-10-30'); // 00:00 del 30
    assert.equal(dia(Date.parse('2026-10-30T04:59:00Z')), '2026-10-29');
  } finally { quitarZona(); fijarZona(undefined); }
});

const NOCHE_PANAMA = DateReal.UTC(2026, 9, 30, 2, 30); // 21:30 del 29 oct en Panamá, ya 30 oct en UTC
const MANANA_PANAMA = DateReal.UTC(2026, 9, 30, 12, 0); // 07:00 del 30 oct en Panamá

// Añadido por el carril F (completa #102): la víspera de noche en Panamá y conZona/quitarZona.
test('la víspera de una fecha límite avisa de noche en Panamá (antes: 0 avisos entre 00:00 y 05:00 UTC)', () => {
  instalarZona('America/Panama');
  try {
    const limite = dia(NOCHE_PANAMA + 864e5); // «mañana» en Panamá
    assert.equal(limite, '2026-10-30');
    const t = { id: 'x', title: 'Declaración', limite, state: 'next', person: 'Tú' };
    assert.deepEqual(avisosLimite([t], NOCHE_PANAMA).map(a => a.tipo), ['vispera']);
  } finally { quitarZona(); }
});

test('conZona pone la zona del día solo mientras trabaja y la devuelve (también anidado y con error)', async () => {
  quitarZona();
  await conZona('America/Panama', async () => {
    assert.equal(dia(NOCHE_PANAMA), '2026-10-29');
    await conZona('Asia/Tokyo', async () => assert.equal(dia(NOCHE_PANAMA), '2026-10-29', 'el parche que ya había se respeta'));
  });
  assert.equal(dia(NOCHE_PANAMA), '2026-10-30');
  await assert.rejects(() => conZona('America/Panama', async () => { throw new Error('x'); }));
  assert.equal(dia(NOCHE_PANAMA), '2026-10-30');
  instalarZona('America/Panama'); await conZona('Asia/Tokyo', async () => {}); assert.equal(dia(NOCHE_PANAMA), '2026-10-29', 'con un parche permanente, conZona no lo cambia'); quitarZona();
});
