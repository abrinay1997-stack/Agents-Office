// SEG-01: /api/chat y /api/agentes/:id/ejecutar gastan modelo con la clave del dueño: tope por persona por minuto y por día.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, crearFetch, pagina, texto } from './agentes-ayudas.mjs';
import { tasaDia, cupoDeModelo } from '../worker/lib/equipo.js';

async function mundo(env = {}) {
  const o = await oficina({ env, conector: false });
  o.env.__pruebas = { fetch: crearFetch({ guion: Array.from({ length: 40 }, () => texto('ok')) }).fetchFn };
  return { ...o, p: await pagina(o) };
}
const chat = (m, quien = 'admin') => m.p[quien]('POST', '/api/chat', { agent: 'elead', text: 'Hola', history: [] });

test('tasaDia: cuenta por día, se reinicia al día siguiente y no la borra la poda por minuto', { skip: SALTAR }, async () => {
  const m = await mundo(); const db = m.env.DB; const t0 = Date.UTC(2026, 9, 29, 10, 0);
  for (let i = 1; i <= 3; i++) assert.equal((await tasaDia(db, 'x:1', 3, t0 + i * 60e3 * 120)).ok, true);
  assert.equal((await tasaDia(db, 'x:1', 3, t0 + 60e3 * 300)).ok, false, 'la cuarta del día no cabe, aunque pasaran horas entre una y otra');
  assert.equal((await tasaDia(db, 'x:1', 3, t0 + 864e5)).ok, true, 'al día siguiente vuelve a caber');
});

test('cupoDeModelo: dice el motivo en español, por minuto y por día', { skip: SALTAR }, async () => {
  const m = await mundo(); const db = m.env.DB; let ahora = Date.UTC(2026, 9, 29, 10, 0);
  const env = { RELOJ_MS: () => ahora };
  assert.equal(await cupoDeModelo(db, env, 'zz', 'u1', { porMinuto: 2, porDia: 3 }), null);
  assert.equal(await cupoDeModelo(db, env, 'zz', 'u1', { porMinuto: 2, porDia: 3 }), null);
  assert.match(await cupoDeModelo(db, env, 'zz', 'u1', { porMinuto: 2, porDia: 3 }), /muy rápido/);
  ahora += 120e3; // otro minuto: el rechazo por minuto no cuenta para el día (lleva 2)
  assert.equal(await cupoDeModelo(db, env, 'zz', 'u1', { porMinuto: 2, porDia: 3 }), null);
  assert.match(await cupoDeModelo(db, env, 'zz', 'u1', { porMinuto: 2, porDia: 3 }), /tope de hoy \(3 usos/);
  assert.equal(await cupoDeModelo(db, env, 'zz', 'u2', { porMinuto: 2, porDia: 3 }), null, 'es por persona');
});

test('/api/chat: pasado el tope por minuto contesta 429 y no llama al modelo; el editor tiene su propio cupo', { skip: SALTAR }, async () => {
  const m = await mundo({ CHAT_MAX_MINUTO: '2', RELOJ_MS: () => Date.UTC(2026, 9, 29, 10, 0) });
  assert.equal((await chat(m)).status, 200); assert.equal((await chat(m)).status, 200);
  const r = await chat(m);
  assert.equal(r.status, 429); assert.match(JSON.stringify(r.j), /muy rápido/);
  assert.equal((await chat(m, 'editor')).status, 200, 'otra persona, otro cupo');
});

test('/api/chat: el tope diario corta aunque pasen los minutos', { skip: SALTAR }, async () => {
  let ahora = Date.UTC(2026, 9, 29, 10, 0);
  const m = await mundo({ CHAT_MAX_DIA: '2', RELOJ_MS: () => ahora });
  assert.equal((await chat(m)).status, 200); ahora += 5 * 60e3;
  assert.equal((await chat(m)).status, 200); ahora += 5 * 60e3;
  const r = await chat(m);
  assert.equal(r.status, 429); assert.match(JSON.stringify(r.j), /tope de hoy/);
});

test('/api/agentes/:id/ejecutar: tiene su tope y el lector sigue en 403 antes de contar', { skip: SALTAR }, async () => {
  const m = await mundo({ EJECUTAR_MAX_MINUTO: '1', RELOJ_MS: () => Date.UTC(2026, 9, 29, 10, 0) });
  const ej = (q = 'admin') => m.p[q]('POST', '/api/agentes/olead/ejecutar', { texto: 'hola' });
  assert.notEqual((await ej()).status, 429);
  assert.equal((await ej()).status, 429);
  assert.equal((await m.p.lectura('POST', '/api/agentes/olead/ejecutar', { texto: 'hola' })).status, 403);
});
