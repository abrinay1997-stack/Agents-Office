// Fase 5 — la cola de publicación en el Worker: los tres candados (aprobada con su huella · el modo lo permite · el conductor está listo), el minuto de gracia, las 3 min de
// «vencida», el doble testigo, retirar lo que cambia, y que dos vueltas a la vez no entreguen dos veces. Con el simulacro y con Meta (el Meta de mentira de la raíz).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { montar, subirImagen, enPanama } from './contenido-ayudas.mjs';
import { cadaMinuto } from '../worker/modulos/contenido.js';

const MIN = 60e3, H = 3600e3;
const filaCola = (t, id) => { const f = t.d1._db.prepare('select json from contenido_cola where pieza = ?').get(id); return f ? JSON.parse(f.json) : null; };
const pieza = async (t, extra = {}) => {
  const cuando = enPanama(t.reloj + 12 * H);
  return (await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'Examen visual', ...cuando, texto: 'Agenda tu examen visual esta semana.', redes: ['facebook'], ...extra } })).datos.pieza;
};
const aprobar = async (t, p) => (await t.api(`/api/contenido/piezas/${p.id}/aprobar`, { metodo: 'POST', cuerpo: {} }));
const momentoDe = p => new Date(`${p.fecha}T${p.hora}:00-05:00`).getTime(); // Panamá = UTC−5, sin horario de verano

test('simulacro: aprobada → un minuto de gracia → entregada → «publicada» a su hora; nada sale de verdad', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false }); const p = await pieza(t); const ap = await aprobar(t, p); assert.equal(ap.status, 200);
  await cadaMinuto(t.env);
  assert.equal(filaCola(t, p.id).estado, 'espera', 'primero se encola');
  t.avanzar(30e3); await cadaMinuto(t.env);
  assert.equal(filaCola(t, p.id).estado, 'espera', 'antes del minuto para deshacer no se entrega');
  t.avanzar(40e3); await cadaMinuto(t.env);
  const e = filaCola(t, p.id); assert.equal(e.estado, 'en_red'); assert.equal(e.conductor, 'simulacro'); assert.equal(e.huella, ap.datos.pieza.aprobada.huella);
  const doc = await t.api('/api/contenido/piezas/' + p.id); assert.equal(doc.datos.pieza.entregada.conductor, 'simulacro', 'el segundo testigo: la pieza también lo dice');
  assert.equal(t.stand.llamadas.length, 0, 'en simulacro no se llama a Meta');
  t.ir(momentoDe(p) + 1 * MIN); await cadaMinuto(t.env);
  assert.equal(filaCola(t, p.id).estado, 'publicada');
  const cola = (await t.api('/api/contenido/cola')).datos;
  assert.equal(cola.modo, 'simulacro'); assert.equal(cola.cuenta.publicada, 1); assert.equal(cola.conductor.id, 'simulacro');
  // lo publicado no se vuelve a mandar nunca
  t.avanzar(10 * MIN); await cadaMinuto(t.env); assert.equal(filaCola(t, p.id).estado, 'publicada');
  const r = await t.api(`/api/contenido/piezas/${p.id}/entregar`, { metodo: 'POST', cuerpo: {} }); assert.equal(r.status, 409);
});

test('apagado no entrega nada; una pieza sin OK, tampoco; cambiar lo aprobado lo retira de la cola', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false });
  const p = await pieza(t); await cadaMinuto(t.env);
  assert.equal(filaCola(t, p.id), null, 'una pieza sin aprobar no entra a la cola');
  await aprobar(t, p);
  assert.equal((await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'apagado' } })).status, 200);
  t.avanzar(2 * MIN); await cadaMinuto(t.env); assert.equal(filaCola(t, p.id), null, 'apagado: nada se encola ni se entrega');
  await t.api('/api/contenido/config', { metodo: 'PUT', cuerpo: { modo: 'simulacro' } });
  await cadaMinuto(t.env); t.avanzar(2 * MIN); await cadaMinuto(t.env);
  assert.equal(filaCola(t, p.id).estado, 'en_red');
  // cambia lo que sale → pierde el OK → la próxima vuelta lo retira
  const mod = await t.api('/api/contenido/piezas/' + p.id, { metodo: 'PATCH', cuerpo: { texto: 'Un texto distinto, ya sin OK.' } }); assert.equal(mod.datos.soltada, true);
  t.avanzar(MIN); await cadaMinuto(t.env);
  assert.equal(filaCola(t, p.id).estado, 'cancelada'); assert.equal((await t.api('/api/contenido/piezas/' + p.id)).datos.pieza.entregada, null);
  // volverla a aprobar la entrega otra vez (la nueva versión)
  await aprobar(t, mod.datos.pieza); t.avanzar(MIN); await cadaMinuto(t.env); t.avanzar(2 * MIN); await cadaMinuto(t.env);
  assert.equal(filaCola(t, p.id).estado, 'en_red');
});

test('«vencida»: a menos de 3 minutos de su hora ya no se entrega y lo dice', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false }); await subirImagen(t.r2, '2026-10/foto.jpg');
  const p = await pieza(t); const ap = await aprobar(t, p); assert.equal(ap.status, 200);
  await cadaMinuto(t.env);
  t.ir(momentoDe(p) - 2 * MIN); await cadaMinuto(t.env);
  const e = filaCola(t, p.id); assert.equal(e.estado, 'fallo'); assert.match(e.error, /a tiempo/);
  assert.equal((await t.api(`/api/contenido/piezas/${p.id}/reintentar`, { metodo: 'POST', cuerpo: {} })).status, 409, 'su hora ya pasó: no se reintenta');
});

test('dos vueltas a la vez no entregan dos veces (el candado «vuelta»)', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false }); const p = await pieza(t); await aprobar(t, p); await cadaMinuto(t.env); t.avanzar(2 * MIN);
  await Promise.all([cadaMinuto(t.env), cadaMinuto(t.env), cadaMinuto(t.env)]);
  const sim = JSON.parse(t.d1._db.prepare('select json from docs where clave = ?').get('contenido.simulacro').json); // secrets-ok: es el nombre de un documento
  assert.equal(Object.keys(sim.posts).length, 1, 'una sola entrega al simulacro, aunque coincidan tres vueltas');
  // un candado vencido (otra vuelta que murió) lo toma la siguiente
  t.d1._db.prepare("insert or replace into contenido_candado (nombre, hasta, dueno) values ('vuelta', ?, 'muerta')").run(t.reloj + 60e3);
  const v1 = await cadaMinuto(t.env); assert.equal(v1.ocupada, true, 'con el candado vigente de otra, esta no hace nada');
  t.avanzar(2 * MIN); const v2 = await cadaMinuto(t.env); assert.notEqual(v2.ocupada, true, 'vencido el candado, se toma');
});

test('reintentar y «entregar ya» (solo el dueño) cambian la cola y dicen por qué no', { skip: SALTAR }, async () => {
  const t = await montar({ meta: false });
  const lejos = await t.api('/api/contenido/piezas', { metodo: 'POST', cuerpo: { titulo: 'lejos', ...enPanama(t.reloj + 5 * 24 * H), texto: 'Dentro de cinco días.', redes: ['facebook'] } });
  await aprobar(t, lejos.datos.pieza); await cadaMinuto(t.env); t.avanzar(2 * MIN); await cadaMinuto(t.env);
  assert.equal(filaCola(t, lejos.datos.pieza.id).estado, 'espera', 'faltan más de 24 h: se espera para poder editarla');
  assert.equal((await t.api(`/api/contenido/piezas/${lejos.datos.pieza.id}/reintentar`, { metodo: 'POST', cuerpo: {} })).status, 409);
  assert.equal((await t.api(`/api/contenido/piezas/${lejos.datos.pieza.id}/entregar`, { metodo: 'POST', cuerpo: {} })).status, 200);
  assert.equal(filaCola(t, lejos.datos.pieza.id).estado, 'en_red', 'entregar ya la manda sin esperar');
  assert.equal((await t.api('/api/contenido/piezas/p-20260101-aaaa/entregar', { metodo: 'POST', cuerpo: {} })).status, 409);
});
