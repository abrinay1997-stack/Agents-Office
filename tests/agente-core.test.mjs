// agente-core.mjs y costs-core.mjs: lo puro que comparten la oficina local y el Worker de Cloudflare. Que la local siga diciendo lo mismo es lo que se prueba aquí.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '../agente-core.mjs';
import * as costsCore from '../costs-core.mjs';
import * as costs from '../costs.mjs';
import * as learn from '../learn.mjs';

test('costs.mjs sigue exportando todo lo de antes (la parte pura vive en costs-core.mjs, y el libro en archivo en costs.mjs)', () => {
  for (const k of Object.keys(costsCore)) assert.equal(costs[k], costsCore[k], k);
  for (const k of ['file', 'append', 'read']) assert.equal(typeof costs[k], 'function', k);
  assert.ok(!/from 'node:(fs|path)'/.test(fs.readFileSync(new URL('../costs-core.mjs', import.meta.url), 'utf8')), 'el núcleo no toca archivos');
});

test('las líneas de modo: el borrador no envía nada, la aprobada lleva el borrador, una rutina no añade nada', () => {
  assert.match(core.modeLineFor('draft', {}), /send, post, pay or change NOTHING/);
  assert.match(core.modeLineFor('approve', { draft: 'Para ana@x.com' }), /APPROVED[\s\S]*Para ana@x\.com/);
  assert.equal(core.modeLineFor('routine', {}), '');
  assert.equal(core.modeLineFor('approve', { result: 'R' }).includes('Approved draft:\nR'), true);
});

test('pasos, bloqueo y proyecto en el pedido', () => {
  const t = { pasos: [{ id: 'p1', texto: 'Leer', hecho: true }, { id: 'p2', texto: 'Escribir' }], limite: '2026-10-30T09:00', prioridad: 'alta', proyecto: 'x', pidioBloqueo: { porque: 'falta el precio' }, partial: 'Lo que llevaba' };
  const s = core.pasosLine(t, () => ({ nombre: 'Lanzamiento', objetivo: 'vender' }));
  assert.match(s, /1\. \[done\] Leer \(id p1\)/); assert.match(s, /Deadline: 2026-10-30 09:00/); assert.match(s, /HIGH priority/); assert.match(s, /project «Lanzamiento» — goal: vender/);
  assert.match(core.reanudaLine(t), /falta el precio[\s\S]*Lo que llevaba/); assert.equal(core.reanudaLine({}), '');
  assert.match(core.pasosLine({ plan: ['a', 'b'] }), /Agreed plan: a → b/);
});

test('el jefe revisa lo delicado (Contabilidad, palabras de contrato, importes sobre el tope) y no al propio jefe ni a una pieza de equipo', () => {
  const t = { title: 'Factura', text: 'x', dept: 'fin' };
  assert.equal(core.needsReview(t, 'ok', { agent: { id: 'invo' }, amountLimit: 200 }), true);
  assert.equal(core.needsReview(t, 'ok', { agent: { id: 'alead', lead: true }, amountLimit: 200 }), false);
  assert.equal(core.needsReview({ ...t, dept: 'sales', title: 'Hola', text: 'saludo' }, 'Total $950', { agent: { id: 'p' }, amountLimit: 200 }), true);
  assert.equal(core.needsReview({ ...t, dept: 'sales', title: 'Hola', text: 'saludo' }, 'Total $50', { agent: { id: 'p' }, amountLimit: 200 }), false);
  assert.equal(core.needsReview({ ...t, piece: true }, 'ok', { agent: { id: 'invo' } }), false);
  assert.equal(core.needsReview(t, 'ok', { agent: { id: 'invo' }, cfgReview: { enabled: false } }), false);
  const p = core.reviewPrompt({ task: t, lead: { name: 'JEFA' }, agent: { name: 'INVO' }, deptName: 'Contabilidad', negocio: 'PanaClaw', result: 'borrador' });
  assert.match(p.system, /JEFA, jefe de Contabilidad en PanaClaw/); assert.match(p.user, /Borrador de INVO:\nborrador/);
});

test('HANDOFF, las instrucciones base y las lecciones', () => {
  assert.ok(core.HANDOFF.test('**PASAR A UNA PERSONA:** falta una firma')); assert.ok(!core.HANDOFF.test('Hola'));
  assert.match(core.instruccionesBase(100), /Como máximo 100 palabras/); assert.match(core.instruccionesBase(), /«Fuentes:»/);
  assert.match(core.leccionesLine(['2026-10-01 · Sé breve ← "x" (t)']), /^LESSONS[\s\S]*- Sé breve$/); assert.equal(core.leccionesLine([]), '');
  assert.equal(core.agentBrief({ name: 'A' }), ''); assert.match(core.agentBrief({ brief: ['uno', 'dos'] }), /uno\ndos/);
});

test('clasificar una corrección: la local (learn.classify) y la nube usan la misma función', async () => {
  assert.equal(learn.classify, core.clasificarCorreccion);
  const v = await core.clasificarCorreccion(async () => '```json\n{"standing": true, "rule": "Sé breve"}\n```', { name: 'A', role: 'r', does: 'd' }, { title: 't' }, 'siempre breve');
  assert.deepEqual(v, { standing: true, rule: 'Sé breve' });
  assert.equal(await core.clasificarCorreccion(async () => 'no es json', { name: 'A' }, {}, 'x'), null);
  assert.deepEqual(core.parseJSON('antes {"a":1} después'), { a: 1 });
});
