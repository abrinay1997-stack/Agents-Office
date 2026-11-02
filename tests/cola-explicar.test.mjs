// Punto 17 de la auditoría de Anuncios: «12 esperando, 0 en marcha» contaba tareas del dueño, de personas y bloqueadas, que la cola nunca arranca.
// explicarCola solo MIRA (usa planear tal cual) y dice en palabras por qué espera cada una. Todo con `ahora` fijo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { explicarCola, planear } from '../tareas/cola.mjs';

const AHORA = 1_000_000_000_000, H = 3600e3;
const t = (id, o = {}) => ({ id, state: 'next', agent: 'a' + id, addedAt: AHORA - 10 * 60e3, ...o });

test('lo tuyo, lo de personas y lo bloqueado NO cuentan como «esperando a la oficina» y se explican', () => {
  const lista = [
    ...Array.from({ length: 9 }, (_, i) => t('m' + i, { person: 'Tú', agent: undefined, addedAt: AHORA - 5 * H })),
    t('p1', { person: 'Ana', agent: undefined, addedAt: AHORA - 5 * H }),
    t('base', { state: 'doing', agent: 'x' }),
    t('b1', { bloqueadaPor: ['base'], addedAt: AHORA - 5 * H }),
    t('b2', { bloqueadaPor: ['base'], addedAt: AHORA - 5 * H }),
    t('w', { state: 'waiting' }),
  ];
  const r = explicarCola(lista, { ahora: AHORA });
  assert.equal(r.total, 12); assert.equal(r.razones.persona, 10); assert.equal(r.razones.bloqueada, 2);
  assert.equal(r.esperando, 0, 'nada espera de verdad a la oficina');
  assert.equal(r.masViejaMs, 0, 'las viejas del dueño no disparan el ámbar');
  assert.equal(r.okPendiente, 1);
  assert.match(r.texto, /12 en la lista: 10 son tuyas o de personas \(la oficina no las arranca sola\); 2 esperan a que termine otra tarea/);
  assert.match(r.texto, /1 espera tu OK/);
});

test('cada razón real tiene su frase: agente ocupado, sitio, presupuesto, reintento, llave y turno', () => {
  const ocupado = [t('d1', { state: 'doing', agent: 'ada' }), t('q1', { agent: 'ada' })];
  assert.equal(explicarCola(ocupado, { ahora: AHORA }).razones.agente, 1);
  assert.match(explicarCola(ocupado, { ahora: AHORA }).texto, /esperan? a que su agente termine/);
  const tres = [...['x', 'y', 'z'].map(i => t('r' + i, { state: 'doing', agent: i })), t('q2', { agent: 'w' })];
  const o = explicarCola(tres, { ahora: AHORA, max: 3 });
  assert.equal(o.razones.oficina, 1); assert.match(o.texto, /espera sitio \(la oficina hace 3 a la vez\)/);
  const pr = explicarCola([t('q3')], { ahora: AHORA, sinPresupuesto: true });
  assert.equal(pr.razones.presupuesto, 1); assert.match(pr.texto, /se acabó el presupuesto del mes/);
  const re = explicarCola([t('q4', { retryAt: AHORA + H })], { ahora: AHORA });
  assert.equal(re.razones.reintento, 1); assert.match(re.texto, /con reintento programado/);
  const ll = explicarCola([t('q5')], { ahora: AHORA, sinLlave: true });
  assert.equal(ll.razones.llave, 1); assert.match(ll.texto, /falta la llave de IA/);
  const tu = explicarCola([t('q6')], { ahora: AHORA });
  assert.equal(tu.razones.turno, 1); assert.match(tu.texto, /arranca en el próximo minuto/);
});

test('una real y vieja sí cuenta (para el ámbar); una real y reciente, no; y la lista vacía no dice nada', () => {
  const vieja = explicarCola([t('v', { state: 'next', agent: 'ada', addedAt: AHORA - 2 * H }), t('d', { state: 'doing', agent: 'ada' })], { ahora: AHORA });
  assert.equal(vieja.esperando, 1); assert.ok(vieja.masViejaMs > H);
  const nueva = explicarCola([t('n')], { ahora: AHORA }); assert.ok(nueva.masViejaMs < H);
  const vacia = explicarCola([], { ahora: AHORA }); assert.equal(vacia.texto, null); assert.equal(vacia.total, 0);
  assert.equal(explicarCola([t('z', { archived: true })], { ahora: AHORA }).total, 0);
});

test('explicarCola no cambia qué arranca: coincide con planear', () => {
  const lista = [t('a1'), t('a2', { person: 'Tú' }), t('a3', { bloqueadaPor: ['a1'] }), t('a4', { agent: 'otro' })];
  const { arrancar } = planear(lista, { ahora: AHORA, max: 3 });
  assert.deepEqual(arrancar.sort(), ['a1', 'a4']);
  assert.equal(explicarCola(lista, { ahora: AHORA, max: 3 }).razones.turno, arrancar.length);
});
