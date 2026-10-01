// V4.10 (1 oct 2026): la cola de Contenido (src/contenido-cola.js) — cuenta atrás, choques, huecos, lo vencido y lo que pide acción.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cuentaAtras, choqueDe, siguienteHueco, vencida, requiereAccion, colaPorDia, momentoDe, ymd } from '../src/contenido-cola.js';

const AHORA = new Date('2026-10-01T10:00:00').getTime();
const dia = n => { const d = new Date(AHORA); d.setDate(d.getDate() + n); return ymd(d); };
const pz = o => ({ id: Math.random().toString(36).slice(2), fecha: '', hora: '', redes: ['instagram'], estado: 'borrador', revision: { errores: [] }, ...o });

test('la cuenta atrás habla en minutos, horas o días, hacia delante y hacia atrás', () => {
  assert.equal(cuentaAtras(AHORA + 30 * 60e3, AHORA), 'sale en 30 min');
  assert.equal(cuentaAtras(AHORA + 3 * 3600e3, AHORA), 'sale en 3 h');
  assert.equal(cuentaAtras(AHORA + 2 * 864e5, AHORA), 'sale en 2 días');
  assert.equal(cuentaAtras(AHORA - 864e5, AHORA), 'hace 1 día');
});

test('un choque es otra pieza a la misma hora del mismo día en una red compartida', () => {
  const a = pz({ id: 'a', fecha: dia(1), hora: '18:00', redes: ['instagram', 'facebook'] });
  const b = pz({ id: 'b', fecha: dia(1), hora: '18:00', redes: ['facebook'] });
  const c = pz({ id: 'c', fecha: dia(1), hora: '18:00', redes: ['instagram'] });
  assert.equal(choqueDe(a, [a, b]).id, 'b');
  assert.equal(choqueDe(pz({ fecha: dia(1), hora: '18:00', redes: ['facebook'] }), [c]), null, 'redes distintas no chocan');
  assert.equal(choqueDe(pz({ fecha: dia(1), hora: '' }), [c]), null, 'sin hora no se sabe');
});

test('el siguiente hueco es el primer día desde mañana sin nada en esas redes', () => {
  const otras = [pz({ fecha: dia(1), redes: ['instagram'] }), pz({ fecha: dia(2), redes: ['instagram'] }), pz({ fecha: dia(3), redes: ['facebook'] })];
  assert.equal(siguienteHueco(['instagram'], otras, AHORA), dia(3));
  assert.equal(siguienteHueco(['facebook'], otras, AHORA), dia(1));
});

test('vencida: aprobada o por revisar cuya hora ya pasó', () => {
  assert.equal(vencida(pz({ estado: 'aprobada', fecha: dia(-1), hora: '09:00' }), AHORA), true);
  assert.equal(vencida(pz({ estado: 'borrador', fecha: dia(-1), hora: '09:00' }), AHORA), false);
  assert.equal(vencida(pz({ estado: 'aprobada', fecha: dia(1), hora: '09:00' }), AHORA), false);
  assert.equal(momentoDe(pz({ fecha: '' })), null);
});

test('lo que requiere acción, con su porqué; solo lo que puede salir se aprueba de golpe', () => {
  const lista = [
    pz({ id: 'v', estado: 'aprobada', fecha: dia(-1), hora: '09:00' }),
    pz({ id: 'r', estado: 'revision', fecha: dia(2), hora: '12:00' }),
    pz({ id: 's', estado: 'revision', fecha: dia(2) }),
    pz({ id: 'e', estado: 'revision', fecha: dia(3), hora: '12:00', revision: { errores: ['Un reel necesita un video.'] } }),
    pz({ id: 'c', estado: 'aprobada', fecha: dia(4), hora: '12:00', cambiadaTrasAprobar: true }),
    pz({ id: 'b', estado: 'borrador', fecha: dia(5), hora: '12:00' }),
    pz({ id: 'viejo', estado: 'borrador', fecha: dia(-3), hora: '12:00' }),
  ];
  const r = requiereAccion(lista, AHORA);
  assert.deepEqual(r.map(x => x.pieza.id), ['v', 's', 'r', 'e', 'c'], 'en el orden en que salen (sin hora, al principio del día)');
  assert.match(r[0].motivo, /Vencida/);
  assert.deepEqual(r.filter(x => x.puede).map(x => x.pieza.id), ['r'], 'sin hora o con errores no se aprueba');
  assert.match(r.find(x => x.pieza.id === 's').motivo, /hora/);
});

test('la cola trae los 14 días (los vacíos son huecos) y después solo los días con algo', () => {
  const c = colaPorDia([pz({ fecha: dia(0), hora: '09:00' }), pz({ fecha: dia(20), hora: '09:00' }), pz({ fecha: dia(-2), hora: '09:00' })], AHORA);
  assert.equal(c.length, 15); assert.equal(c[0][0], dia(0)); assert.equal(c[0][1].length, 1);
  assert.equal(c.at(-1)[0], dia(20)); assert.equal(c.filter(([, l]) => !l.length).length, 13);
});
