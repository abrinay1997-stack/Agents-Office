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

test('los días rápidos del panel: hoy, mañana y los siguientes, con cuántas piezas ya salen ese día en esas redes', async () => {
  const { diasRapidos } = await import('../src/contenido-cola.js');
  const otras = [pz({ id: 'a', fecha: dia(1), hora: '09:00' }), pz({ id: 'b', fecha: dia(1), hora: '18:00', redes: ['facebook'] }), pz({ id: 'c', fecha: dia(2), estado: 'idea' }), pz({ id: 'yo', fecha: dia(3) })];
  const d = diasRapidos(['instagram'], otras, { ahora: AHORA, excluir: 'yo' });
  assert.equal(d.length, 7);
  assert.equal(d[0].fecha, dia(0)); assert.equal(d[0].corto, 'Hoy'); assert.equal(d[1].corto, 'Mañana');
  assert.equal(d[1].n, 1, 'solo cuenta la de Instagram, no la de Facebook');
  assert.equal(d[2].n, 0, 'una idea no ocupa el día');
  assert.equal(d[3].n, 0, 'la propia pieza no se cuenta');
  assert.match(d[2].corto, /^(lun|mar|mié|jue|vie|sáb|dom) \d+$/);
  assert.equal(diasRapidos(['instagram', 'facebook'], otras, { ahora: AHORA })[1].n, 2);
});

test('motivoPasado separa el día que pasó de la hora que pasó, y sin hora solo mira el día', async () => {
  const { motivoPasado } = await import('../src/contenido-cola.js');
  assert.match(motivoPasado(dia(-1), '', AHORA), /Ese día ya pasó/);
  assert.match(motivoPasado(dia(-1), '18:00', AHORA), /Ese día ya pasó/, 'una franja de un día anterior no dice «de hoy»');
  assert.match(motivoPasado(dia(0), '09:00', AHORA), /Esa hora ya pasó/);
  assert.equal(motivoPasado(dia(0), '', AHORA), null, 'hoy sin hora a las 10:00 se puede: no se inventa un 09:00');
  assert.equal(motivoPasado(dia(0), '18:00', AHORA), null);
  assert.equal(motivoPasado(dia(1), '08:00', AHORA), null);
  assert.equal(motivoPasado('', '', AHORA), null, 'al banco de ideas siempre se puede');
});

test('deshacerMover no se traga que no se pudo volver a aprobar', async () => {
  const { deshacerMover } = await import('../src/contenido-cola.js');
  const antes = { fecha: dia(0), hora: '10:05' };
  const ok = { patch: async (id, c) => ({ pieza: { id, ...c, estado: 'revision' } }), approve: async id => ({ pieza: { id, ...antes, estado: 'aprobada' } }) };
  const r1 = await deshacerMover(ok, 'a', antes);
  assert.equal(r1.mal, false); assert.equal(r1.pieza.estado, 'aprobada');
  const falla = { ...ok, approve: async () => { throw new Error('Falta menos de 10 min para su hora.'); } };
  const r2 = await deshacerMover(falla, 'a', antes);
  assert.equal(r2.mal, true); assert.equal(r2.pieza.estado, 'revision');
  assert.match(r2.aviso, /no se pudo volver a aprobar: Falta menos de 10 min/);
  await assert.rejects(deshacerMover({ ...ok, patch: async () => { throw new Error('sin red'); } }, 'a', antes), /sin red/, 'si ni siquiera vuelve a su fecha, lanza (el aviso dice «No se pudo deshacer»)');
});
