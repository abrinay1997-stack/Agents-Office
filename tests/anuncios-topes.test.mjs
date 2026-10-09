// Fase A2 de Anuncios (9 oct 2026): los topes de gasto (anuncios/topes.mjs, puro). La regla del dinero (plan §3.4): lo que gasta pasa por
// el tope diario, el mensual y el de cada campaña, con la cifra en palabras, siempre redondeando HACIA ARRIBA y con un tope 0 = no gastar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluar, diasSemana, diasMes, diasHasta, arriba, dinero, bolsas, arbol, uso, diarioDeCampana, msDe } from '../anuncios/topes.mjs';

const TOPES = { diario: 20, mensual: 300, campana: 150 };
const LUNES = '2026-10-05', AHORA = Date.parse('2026-10-05T15:00:00Z');
const camp = (id, o = {}) => ({ id, nombre: o.nombre || id, estado: o.estado || 'PAUSED', presupuesto: o.presupuesto || { tipo: null, usd: null }, spendCap: o.spendCap ?? null, fin: o.fin || null, inicio: o.inicio || null,
  conjuntos: o.conjuntos || [{ id: id + '-s', nombre: 'Conjunto', estado: 'ACTIVE', presupuesto: { tipo: null, usd: null }, fin: null, aprendizaje: { estado: 'SUCCESS' }, anuncios: [{ id: id + '-a', nombre: 'Anuncio', estado: 'ACTIVE' }] }] });
const vista = (campanas, gastoMes = 0) => ({ cuenta: { moneda: 'USD', zona: 'America/Panama' }, gasto: { hoy: 0, semana: 0, mes: gastoMes }, campanas });
const ev = (v, o) => evaluar({ vista: v, topes: TOPES, hoy: LUNES, ahora: AHORA, ...o });

test('los días: la semana hasta el domingo, el mes hasta su último día, el fin incluido, y lo terminado no cuenta', () => {
  assert.equal(diasSemana('2026-10-05'), 7, 'lunes'); assert.equal(diasSemana('2026-10-11'), 1, 'domingo'); assert.equal(diasSemana('2026-10-09'), 3, 'viernes');
  assert.equal(diasMes('2026-10-05'), 27); assert.equal(diasMes('2026-02-28'), 1); assert.equal(diasMes('2028-02-28'), 2, 'bisiesto');
  assert.equal(diasHasta(LUNES, null), Infinity);
  assert.equal(diasHasta(LUNES, '2026-10-07T23:59:00-0500', { zona: 'America/Panama', ahora: AHORA }), 3);
  assert.equal(diasHasta(LUNES, '2026-10-01T00:00:00-0500', { zona: 'America/Panama', ahora: AHORA }), 0, 'ya terminó');
  assert.equal(msDe('2026-10-07T00:00:00-0500'), Date.parse('2026-10-07T05:00:00Z'), 'el formato de Meta (-0500) se entiende');
  assert.equal(arriba(15 * 7), 105); assert.equal(arriba(10 / 3), 3.34, 'hacia arriba, nunca a favor de gastar'); assert.equal(arriba(0.1 + 0.2), 0.3);
  assert.equal(dinero(15), 'US$15'); assert.equal(dinero(4.8), 'US$4.80'); assert.equal(dinero(Infinity), 'sin límite');
});

test('activar una campaña de US$15 al día un lunes: gasta hasta US$15 al día y US$105 esta semana; con su spend_cap de US$150 cabe', () => {
  const v = vista([camp('C1', { presupuesto: { tipo: 'diario', usd: 15 }, spendCap: 150 })]);
  const r = ev(v, { tipo: 'activar', id: 'C1' });
  assert.equal(r.ok, true, r.motivo);
  assert.deepEqual(r.cifras, { dia: 15, semana: 105, mes: 150, campana: 150 }, 'el mes y el total, con el spend_cap de Meta como techo');
  assert.equal(r.totales.antes.dia, 0); assert.equal(r.totales.despues.dia, 15);
});

test('el tope diario: lo que ya entrega más lo nuevo, con la cifra', () => {
  const v = vista([camp('C1', { estado: 'ACTIVE', presupuesto: { tipo: 'diario', usd: 10 }, spendCap: 100 }), camp('C2', { presupuesto: { tipo: 'diario', usd: 15 }, spendCap: 150 })]);
  const r = ev(v, { tipo: 'activar', id: 'C2' });
  assert.equal(r.ok, false); assert.equal(r.cual, 'diario'); assert.equal(r.tope, 20); assert.equal(r.quedaria, 25);
  assert.equal(r.motivo, 'Activar pasaría el tope diario: US$25 al día contra US$20.');
  assert.equal(ev(v, { tipo: 'subir_presupuesto', id: 'C1', valor: 12 }).ok, true, 'subir la que ya entrega de 10 a 12 (C2 sigue en pausa)');
  assert.match(ev(v, { tipo: 'subir_presupuesto', id: 'C1', valor: 21 }).motivo, /^Subir el presupuesto pasaría el tope diario: US\$21 al día contra US\$20\.$/);
});

test('el tope mensual: lo gastado este mes más lo comprometido hasta fin de mes; sin las cifras del mes, no se adivina', () => {
  const fin = '2026-10-07T23:59:00-0500';
  const v = vista([camp('C1', { presupuesto: { tipo: 'diario', usd: 15 }, fin })], 280);
  const r = ev(v, { tipo: 'activar', id: 'C1' });
  assert.equal(r.ok, false); assert.equal(r.cual, 'mensual'); assert.equal(r.quedaria, 325);
  assert.equal(r.motivo, 'Activar pasaría el tope mensual: US$325 este mes (US$280 ya gastados + US$45 comprometidos hasta fin de mes) contra US$300.');
  assert.equal(ev(vista(v.campanas, 200), { tipo: 'activar', id: 'C1' }).ok, true, 'con 200 gastados, 245 caben');
  const sin = ev(vista(v.campanas, null), { tipo: 'activar', id: 'C1' });
  assert.equal(sin.ok, false); assert.match(sin.motivo, /todavía no se leyeron de Meta las cifras de este mes/);
});

test('el tope por campaña: sin fin ni spend_cap gastaría sin límite; con fin, el total hasta su fin', () => {
  const sinFin = ev(vista([camp('C1', { nombre: 'Mensajes', presupuesto: { tipo: 'diario', usd: 5 } })]), { tipo: 'activar', id: 'C1' });
  assert.equal(sinFin.ok, false); assert.equal(sinFin.cual, 'campana'); assert.equal(sinFin.quedaria, Infinity);
  assert.match(sinFin.motivo, /dejaría «Mensajes» gastando sin límite: no tiene fecha de fin ni tope de gasto en Meta, y el tope por campaña es US\$150\. Ponle una fecha de fin\./);
  const largo = ev(vista([camp('C1', { nombre: 'Mensajes', presupuesto: { tipo: 'diario', usd: 10 }, fin: '2026-10-20T23:59:00-0500' })]), { tipo: 'activar', id: 'C1' });
  assert.equal(largo.ok, false); assert.equal(largo.quedaria, 160, '16 días × US$10'); assert.match(largo.motivo, /hasta US\$160 en total para «Mensajes» contra US\$150/);
  assert.equal(ev(vista([camp('C1', { presupuesto: { tipo: 'diario', usd: 10 }, fin: '2026-10-19T23:59:00-0500' })]), { tipo: 'activar', id: 'C1' }).ok, true, '15 días × 10 = 150 justos');
});

test('un presupuesto total compromete lo que le QUEDA, repartido hasta su fin (o el total, si Meta no dijo cuánto queda)', () => {
  const fin = '2026-10-07T23:59:00-0500'; // 3 días con hoy
  const conRestante = ev(vista([camp('C1', { presupuesto: { tipo: 'total', usd: 60, restante: 30 }, fin })]), { tipo: 'activar', id: 'C1' });
  assert.equal(conRestante.ok, true); assert.deepEqual(conRestante.cifras, { dia: 10, semana: 30, mes: 30, campana: 30 });
  const sinDato = ev(vista([camp('C1', { presupuesto: { tipo: 'total', usd: 60 }, fin })]), { tipo: 'activar', id: 'C1' });
  assert.deepEqual(sinDato.cifras, { dia: 20, semana: 60, mes: 60, campana: 60 }, 'sin budget_remaining, el total entero (hacia arriba)');
  const subir = ev(vista([camp('C1', { estado: 'ACTIVE', presupuesto: { tipo: 'total', usd: 60, restante: 30 }, fin })]), { tipo: 'subir_presupuesto', id: 'C1', valor: 90 });
  assert.equal(subir.cifras.campana, 60, 'subir el total de 60 a 90 suma 30 a lo que queda');
});

test('presupuesto en los conjuntos (sin CBO): activar la campaña enciende lo de los conjuntos encendidos; un anuncio rechazado no entrega', () => {
  const c = camp('C1', { spendCap: 150, fin: '2026-10-11T23:59:00-0500', conjuntos: [
    { id: 'S1', nombre: 'A', estado: 'ACTIVE', presupuesto: { tipo: 'diario', usd: 6 }, anuncios: [{ id: 'A1', estado: 'ACTIVE' }] },
    { id: 'S2', nombre: 'B', estado: 'PAUSED', presupuesto: { tipo: 'diario', usd: 9 }, anuncios: [{ id: 'A2', estado: 'ACTIVE' }] },
    { id: 'S3', nombre: 'C', estado: 'ACTIVE', presupuesto: { tipo: 'diario', usd: 4 }, anuncios: [{ id: 'A3', estado: 'DISAPPROVED' }] }] });
  const r = ev(vista([c]), { tipo: 'activar', id: 'C1' });
  assert.equal(r.ok, true); assert.equal(r.cifras.dia, 6, 'solo S1: S2 en pausa y S3 sin anuncio que entregue'); assert.equal(r.cifras.semana, 42);
  const v2 = vista([{ ...c, estado: 'ACTIVE' }]);
  assert.equal(ev(v2, { tipo: 'activar', id: 'S2' }).cifras.dia, 9, 'activar un conjunto: su presupuesto');
  const anuncio = ev(vista([c]), { tipo: 'activar', id: 'A2' });
  assert.equal(anuncio.ok, true); assert.equal(anuncio.cifras.dia, 0, 'el anuncio de un conjunto en pausa no gasta');
});

test('un tope 0 es «no gastar»; lo que no gasta sí pasa; lo que ya terminó no cuenta', () => {
  const v = vista([camp('C1', { presupuesto: { tipo: 'diario', usd: 1 }, spendCap: 100, fin: '2026-10-07T23:59:00-0500' })]);
  const cero = evaluar({ vista: v, tipo: 'activar', id: 'C1', topes: { diario: 0, mensual: 300, campana: 150 }, hoy: LUNES, ahora: AHORA });
  assert.equal(cero.ok, false); assert.match(cero.motivo, /contra US\$0 \(un tope 0 en Ajustes → Anuncios quiere decir «no gastar»\)/);
  assert.equal(evaluar({ vista: v, tipo: 'activar', id: 'C1', topes: {}, hoy: LUNES, ahora: AHORA }).ok, false, 'sin topes = 0: no se gasta');
  const terminada = vista([camp('C1', { presupuesto: { tipo: 'diario', usd: 50 }, fin: '2026-10-01T00:00:00-0500' })]);
  const r = ev(terminada, { tipo: 'activar', id: 'C1' });
  assert.equal(r.ok, true); assert.equal(r.cifras.dia, 0, 'terminó: no entrega aunque se encienda');
  assert.equal(ev(v, { tipo: 'activar', id: 'NO' }).ok, false);
});

test('alargar: lo que se suma hasta la fecha nueva, y alargar la campaña alarga los conjuntos que acababan antes', () => {
  const c = camp('C1', { estado: 'ACTIVE', presupuesto: { tipo: 'diario', usd: 5 }, fin: '2026-10-07T23:59:00-0500', conjuntos: [{ id: 'S1', estado: 'ACTIVE', presupuesto: {}, fin: '2026-10-07T23:59:00-0500', anuncios: [] }] });
  const r = ev(vista([c]), { tipo: 'alargar', id: 'C1', fin: '2026-10-14T23:59:00-0500' });
  assert.equal(r.ok, true); assert.equal(r.totales.antes.campana, 15); assert.equal(r.totales.despues.campana, 50);
  const b = bolsas(arbol(vista([c])), { hoy: LUNES, zona: 'America/Panama', ahora: AHORA });
  assert.equal(b.length, 1); assert.equal(b[0].dias, 3); assert.equal(uso(b[0], 7), 15);
  assert.equal(diarioDeCampana(vista([c]), 'C1'), 5);
});
