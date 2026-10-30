// `dia(ms)` de tareas/ (sin zona) tiene que dar la fecha de la OFICINA en el Worker, no la UTC: de 19:00 a 24:00 en Panamá la UTC va un día adelante
// y «hoy», «mañana» y las fechas límite de las listas salían corridas. Lo arregla `instalarZona` (fija también la zona de etiqueta-dia.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { instalarZona, quitarZona } from '../worker/lib/zona.js';
import { dia } from '../../tareas/dueno.mjs';
import { fijarZona } from '../../tareas/etiqueta-dia.mjs';

test('dia(ms) sin zona da la fecha de la oficina tras instalarZona', () => {
  try {
    instalarZona('America/Panama');
    assert.equal(dia(Date.parse('2026-10-30T00:30:00Z')), '2026-10-29'); // 19:30 del 29 en Panamá
    assert.equal(dia(Date.parse('2026-10-30T05:00:00Z')), '2026-10-30'); // 00:00 del 30
    assert.equal(dia(Date.parse('2026-10-30T04:59:00Z')), '2026-10-29');
  } finally { quitarZona(); fijarZona(undefined); }
});
