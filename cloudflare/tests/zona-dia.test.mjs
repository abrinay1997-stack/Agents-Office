// El «AAAA-MM-DD» de las reglas puras (tareas/etiqueta-dia.mjs → dia()) y los get*() de Date deben hablar de la MISMA zona de la oficina.
// Bug de producción (30 oct 2026): el Worker instalaba la zona solo en Date; dia() seguía en UTC, así que entre las 19:00 y las 24:00 de Panamá
// (00:00–05:00 UTC) «mañana» o «hoy» salían un día adelantados para una tarea con fecha límite (y la víspera no avisaba). Determinista: instantes fijos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarZona, quitarZona, conZona, DateReal } from '../worker/lib/zona.js';
import { dia } from '../../tareas/dueno.mjs';
import { avisosLimite } from '../../tareas/ritmo.mjs';

const NOCHE_PANAMA = DateReal.UTC(2026, 9, 30, 2, 30); // 21:30 del 29 oct en Panamá, ya 30 oct en UTC
const MANANA_PANAMA = DateReal.UTC(2026, 9, 30, 12, 0); // 07:00 del 30 oct en Panamá

test('con la zona de la oficina instalada, dia() es el día de Panamá y coincide con los get*() de Date', () => {
  quitarZona();
  assert.equal(dia(NOCHE_PANAMA), '2026-10-30', 'sin zona instalada (oficina local en UTC) es el día del proceso');
  instalarZona('America/Panama');
  try {
    assert.equal(dia(NOCHE_PANAMA), '2026-10-29');
    const d = new Date(NOCHE_PANAMA);
    assert.equal(dia(NOCHE_PANAMA), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, 'el mismo día que el que cuentan las reglas con getDate()');
    assert.equal(dia(MANANA_PANAMA), '2026-10-30');
  } finally { quitarZona(); }
  assert.equal(dia(NOCHE_PANAMA), '2026-10-30', 'quitarZona devuelve la zona del proceso');
});

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
