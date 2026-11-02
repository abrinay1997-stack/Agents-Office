// Punto 18 de la auditoría de Anuncios: las rutinas de fábrica no llegan solas a la nube. GET/POST /api/routines/fabrica las añade SIN tocar ninguna que ya exista.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALTAR } from './d1-memoria.mjs';
import { oficina6, filas } from './fase6-ayudas.mjs';
import { semillaEnDisco, assetsDe } from './semilla-ayudas.mjs';
import { guardarFila } from '../worker/lib/almacen.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fabrica = JSON.parse(readFileSync(join(RAIZ, 'brain-panaclaw', 'Agents Office', 'routines.json'), 'utf8')).routines;

test('la rutina diaria de anuncios existe en la fábrica: marketing, ada, 07:30, solo lee y no pide OK', () => {
  const r = fabrica.find(x => x.id === 'lectura-anuncios-diaria');
  assert.ok(r); assert.equal(r.dept, 'marketing'); assert.equal(r.agent, 'ada'); assert.deepEqual(r.when, { kind: 'daily', at: '07:30' }); assert.equal(r.needsOk, false); assert.equal(r.paused, false);
  assert.match(r.text, /pausar, mantener o escalar/); assert.match(r.text, /No cambias nada en Meta/);
  assert.ok(fabrica.some(x => x.id === 'revision-anuncios' && x.when.kind === 'weekly'), 'la semanal sigue');
});

test('FÁBRICA: las que faltan se ven y se añaden; una que ya existe (aunque el dueño la haya cambiado) no se toca; un editor no puede', { skip: SALTAR }, async () => {
  const { dir } = await semillaEnDisco(), o = await oficina6({ extraEnv: { ASSETS: assetsDe(dir) } });
  const propia = { id: 'revision-anuncios', dept: 'marketing', agent: 'ada', title: 'La mía', text: 'Mi texto distinto', when: { kind: 'weekly', days: [3], at: '10:00' }, needsOk: true };
  await guardarFila(o.d1, 'rutinas', 'revision-anuncios', propia);
  const g = (await o.admin('GET', '/api/routines/fabrica')).j;
  assert.ok(g.faltan.some(x => x.id === 'lectura-anuncios-diaria' && x.valida)); assert.ok(!g.faltan.some(x => x.id === 'revision-anuncios'));
  const p = await o.admin('POST', '/api/routines/fabrica', {});
  assert.equal(p.status, 200, JSON.stringify(p.j)); assert.ok(p.j.añadidas.includes('lectura-anuncios-diaria')); assert.ok(!p.j.añadidas.includes('revision-anuncios'));
  const hay = filas(o.d1, "select id, json from filas where coleccion = 'rutinas'");
  assert.equal(JSON.parse(hay.find(x => x.id === 'revision-anuncios').json).title, 'La mía', 'lo del dueño intacto');
  const d = JSON.parse(hay.find(x => x.id === 'lectura-anuncios-diaria').json); assert.equal(d.needsOk, false); assert.equal(d.when.at, '07:30');
  const otra = (await o.admin('POST', '/api/routines/fabrica', {})).j; assert.deepEqual(otra.añadidas, [], 'repetirlo no duplica');
  const lista = (await o.admin('GET', '/api/routines')).j; assert.ok(lista.routines.some(r => r.id === 'lectura-anuncios-diaria'));
});

test('FÁBRICA: sin semilla en la instalación lo dice; y solo un administrador', { skip: SALTAR }, async () => {
  const o = await oficina6();
  const r = await o.admin('POST', '/api/routines/fabrica', {}); assert.equal(r.status, 409); assert.match(r.j.error, /no trae las rutinas de fábrica/);
  if (o.editor) { const e = await o.editor('POST', '/api/routines/fabrica', {}); assert.equal(e.status, 403); }
});
