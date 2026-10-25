// Fase 6 — Los exportadores de Dimitri y de Negocio leen lo de esta computadora y NUNCA llevan una llave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportar as dimitri } from '../../scripts/migrar/dimitri.mjs';
import { exportar as negocio } from '../../scripts/migrar/negocio.mjs';

test('exportar Dimitri y Negocio: lo que hay, en la forma de la nube, sin secretos', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mig6-')), data = path.join(raiz, 'data'), vault = path.join(raiz, 'cerebro'), ao = path.join(vault, 'Agents Office');
  fs.mkdirSync(data, { recursive: true }); fs.mkdirSync(ao, { recursive: true });
  fs.writeFileSync(path.join(data, 'subgerente.json'), JSON.stringify({ messages: [{ id: 'm1', role: 'user', text: 'hola', at: 1 }, { id: 'm2', role: 'assistant', text: 'listo', at: 2 }] }));
  fs.writeFileSync(path.join(data, 'kpis.json'), JSON.stringify({ defs: [{ id: 'ventas', name: 'Ventas' }], values: { ventas: [{ t: 1, v: 5 }] } }));
  fs.writeFileSync(path.join(ao, 'cifras.json'), JSON.stringify({ items: [{ name: 'Combo', value: '12' }] }));
  fs.writeFileSync(path.join(ao, 'triggers.json'), JSON.stringify({ triggers: [{ id: 'form', dept: 'sales', source: 'form', text: 'x', secret: 'NO' }] }));
  fs.writeFileSync(path.join(raiz, 'office.config.local.json'), JSON.stringify({ name: 'PanaClaw', telegram: { approvers: { 444555666: ['emails'] }, botToken: '123456789:AAFakeFakeFakeFakeFakeFakeFakeFake_abc', quiet: { from: '21:00', to: '07:00' } } })); // secrets-ok: de mentira
  const d = dimitri({ raiz, vault }), n = negocio({ raiz, vault });
  assert.equal(d.filas.subgerente.length, 2); assert.equal(d.filas.subgerente[0].id, 'm1');
  assert.equal(n.docs.kpis.defs.length, 1); assert.equal(n.docs.cifras.items[0].name, 'Combo'); assert.equal(n.docs.triggers.lista[0].id, 'form');
  assert.equal(n.docs.ajustes.name, 'PanaClaw'); assert.deepEqual(n.docs.ajustes.telegram.approvers['444555666'], ['emails']);
  const todo = JSON.stringify([d, n]); assert.ok(!/AAFake|botToken|"secret"/.test(todo), 'ninguna llave viaja');
  const vacio = negocio({ raiz: fs.mkdtempSync(path.join(os.tmpdir(), 'mig6v-')), vault: '' }); assert.deepEqual(vacio.docs, {});
});
