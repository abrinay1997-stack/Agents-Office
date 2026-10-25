// Dimitri en la nube, sesiones largas (23 oct 2026): 150 turnos con un modelo de mentira. Qué se mide: el tamaño del prompt por turno (no crece), las consultas a D1 por turno (el plan
// gratuito deja 50 por invocación: antes eran ~55), que lo que el dueño decidió en el turno 3 sigue en el prompt del 150, que el resumen viaja con SU conversación (archivar, abrir,
// restaurar, borrar), que una respuesta rota o una IA caída no estropean la sesión y que una respuesta que llega cuando el dueño ya cambió de conversación no se cuela en la nueva.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR, crearD1 } from './d1-memoria.mjs';
import { oficina6, dimitriDice, filas } from './fase6-ayudas.mjs';
import { conLecturaUnica } from '../worker/lib/dimitri/lectura-unica.js';
import * as chat from '../worker/lib/dimitri/chat.js';
import { MAX } from '../../sub-core.mjs';
import { informeSemanal, DOC_SEMANA } from '../worker/lib/dimitri/semanal.js';

const turno = (o, texto, extra = {}) => o.admin('POST', '/api/sub/chat', { text: texto, ...extra });
const PREF = 'Siempre usa tono cercano y nunca menciones precios en redes. Mi presupuesto es US$500';

/** Cuenta las consultas que de verdad llegan a D1 (un batch cuenta como una). */
function contar(d1) {
  const c = { n: 0 }; let dentro = false; const p0 = d1.prepare, b0 = d1.batch;
  const env = (st) => { const w = {}; for (const k of ['first', 'all', 'run']) w[k] = (...a) => { if (!dentro) c.n++; return st[k](...a); }; w.bind = (...a) => env(st.bind(...a)); return w; };
  d1.prepare = (s) => env(p0(s)); d1.batch = async (l) => { c.n++; dentro = true; try { return await b0(l); } finally { dentro = false; } };
  return c;
}
const respuesta = (i) => (i % 5 === 0 ? { mode: 'plan', reply: 'Lo reparto.', tasks: [{ dept: 'marketing', title: 'Post ' + i, instruction: 'Haz el post ' + i + ' con detalle. '.repeat(10), why: 'x' }, { dept: 'sales', title: 'Llamar ' + i, instruction: 'Llama a los clientes ' + 'y'.repeat(300), why: 'x' }] }
  : i % 5 === 2 ? { mode: 'pregunta', reply: 'Me falta un dato', questions: [{ id: 'p' + i, q: '¿Qué producto va en la campaña ' + i + '?', options: [{ label: 'Combo', value: 'Combo' }, { label: 'Peluches', value: 'Peluches' }] }] }
    : { mode: 'charla', reply: 'Respuesta larga '.repeat(30) + i });

test('150 turnos: el prompt no crece, D1 cabe en 50 consultas por turno y lo del turno 3 sigue ahí', { skip: SALTAR, timeout: 120000 }, async () => {
  const o = await oficina6(), q = contar(o.d1), tam = [], consultas = [];
  for (let i = 0; i < 150; i++) {
    o.m.guion.push(dimitriDice(respuesta(i)));
    const antes = q.n, r = await turno(o, i === 3 ? PREF : `Pedido ${i} del dueño sobre el tema ${i % 7}`);
    assert.equal(r.status, 200, 'turno ' + i + ': ' + r.texto.slice(0, 200));
    consultas.push(q.n - antes); const reg = o.m.registro.anthropic.at(-1); tam.push(reg.system.length + JSON.stringify(reg.messages).length);
  }
  assert.ok(Math.max(...consultas) <= 50, `consultas a D1 por turno (plan gratuito: 50): máx ${Math.max(...consultas)}, media ${(consultas.reduce((a, b) => a + b, 0) / consultas.length).toFixed(1)}`);
  assert.ok(tam[149] < tam[60] * 1.15, `el prompt se queda plano: turno 60 = ${tam[60]}, turno 149 = ${tam[149]}`);
  assert.ok(Math.max(...tam) < 45000, 'tope del prompt: ' + Math.max(...tam));
  const ultimo = o.m.registro.anthropic.at(-1);
  assert.match(ultimo.system, /<hilo>\nEsta sesión lleva/); assert.match(ultimo.system, /nunca menciones precios en redes/, 'lo que pidió en el turno 3 sigue en el prompt del 150');
  const g = (await o.admin('GET', '/api/sub')).j.messages; assert.equal(g.length, MAX, 'la página recibe los últimos MAX');
  assert.ok(filas(o.d1, "select count(*) n from filas where coleccion = 'subgerente'")[0].n <= MAX + chat.HOLGURA, 'en D1 no crece sin tope');
  assert.ok(filas(o.d1, "select length(json) l from filas where coleccion = 'subgerente-hilo' and id = 'actual'")[0].l < 3500, 'el resumen guardado es pequeño');
});

test('conLecturaUnica: un SELECT idéntico se hace una vez, cada lector recibe su copia y cualquier escritura (o olvidar) lo suelta', { skip: SALTAR }, async () => {
  const d1 = crearD1(), q = contar(d1), db = conLecturaUnica(d1);
  await db.prepare("insert into docs (clave, json, version, actualizado) values ('k','{\"a\":[1,2]}',1,'x')").run();
  const base = q.n, leer = () => db.prepare('select json, version from docs where clave = ?').bind('k').first();
  const [a, b] = [await leer(), await leer()]; assert.equal(q.n - base, 1, 'la segunda no llegó a D1'); a.json = 'estropeado'; assert.equal((await leer()).json, '{"a":[1,2]}', 'cada lector, su copia');
  const todas = () => db.prepare('select clave from docs order by clave').all(); const r1 = await todas(); r1.results.reverse(); r1.results.push({ clave: 'zzz' }); assert.deepEqual((await todas()).results.map((x) => x.clave), ['k'], 'un reverse() de uno no daña al otro');
  await db.prepare("update docs set json = '{\"a\":3}' where clave = 'k'").run();
  assert.equal(JSON.parse((await leer()).json).a, 3, 'tras escribir, vuelve a preguntar');
  await leer(); const n = q.n; db.olvidar(); await leer(); assert.equal(q.n - n, 1, 'olvidar() suelta lo recordado');
  await db.batch([db.prepare("insert into docs (clave, json, version, actualizado) values ('k2','{}',1,'x')")]); assert.equal((await db.prepare('select clave from docs where clave = ?').bind('k2').first()).clave, 'k2', 'un batch con sentencias envueltas funciona y también suelta');
  assert.equal(conLecturaUnica(db), db, 'no se envuelve dos veces'); assert.ok(db.__lecturaUnica.repetidas >= 2);
});

test('el hilo viaja con SU conversación: archivar, abrir, restaurar y borrar; al abrir una vieja el prompt trae el resumen de ESA', { skip: SALTAR }, async () => {
  const o = await oficina6();
  const hilos = () => filas(o.d1, "select id from filas where coleccion = 'subgerente-hilo' order by id").map((x) => x.id);
  // conversación A: más de MAX + HOLGURA mensajes → se pliega
  for (let i = 0; i < 75; i++) { o.m.guion.push(dimitriDice({ mode: 'charla', reply: 'ok ' + i })); await turno(o, i === 0 ? PREF : 'relleno A ' + i); }
  assert.deepEqual(hilos(), ['actual']);
  const idA = (await o.admin('POST', '/api/sub/clear', {})).j.archived; assert.ok(idA);
  assert.deepEqual(hilos(), [idA], 'al archivar, su resumen se va con ella');
  // conversación B con otra preferencia, también larga
  for (let i = 0; i < 75; i++) { o.m.guion.push(dimitriDice({ mode: 'charla', reply: 'ok ' + i })); await turno(o, i === 0 ? 'Recuerda: todo en inglés para el cliente B' : 'relleno B ' + i); }
  assert.deepEqual(hilos(), [idA, 'actual'].sort());
  const ab = await o.admin('POST', '/api/sub/abrir', { id: idA }); assert.equal(ab.status, 200); const idB = ab.j.archived;
  assert.deepEqual(hilos(), [idB, 'actual'].sort(), 'la abierta es «actual»; la que estaba abierta se guardó con el suyo');
  o.m.guion.push(dimitriDice({ mode: 'charla', reply: 'sigo en A' })); await turno(o, 'seguimos');
  const sis = o.m.registro.anthropic.at(-1).system;
  assert.match(sis, /nunca menciones precios/, 'el resumen de A'); assert.doesNotMatch(sis, /todo en inglés para el cliente B/, 'y no el de B');
  const del = await o.admin('POST', '/api/sub/borrar', { id: idB }); assert.equal(del.status, 200); assert.deepEqual(hilos(), ['actual'], 'borrar quita también su resumen');
  const nuevo = (await o.admin('POST', '/api/sub/clear', {})).j.archived; assert.ok(nuevo);
  assert.equal((await o.admin('POST', '/api/sub/restore', { id: nuevo })).status, 200); assert.deepEqual(hilos(), ['actual'], 'restaurar trae su resumen de vuelta');
});

test('una respuesta rota o una IA caída no estropean la sesión; una respuesta que llega después de cambiar de conversación no se mete en la nueva', { skip: SALTAR }, async () => {
  const o = await oficina6();
  o.m.guion.push(dimitriDice('{"mode":"charla","reply'), dimitriDice('{"mode":"plan","reply":"cortada","tasks":[{"dept":"marketing","title":"Pieza","instru'));
  const rota = await turno(o, 'primero'); assert.equal(rota.status, 200);
  const m = rota.j.messages[1]; assert.doesNotMatch(m.text, /\{"mode"/, 'el JSON crudo nunca llega al chat'); assert.equal(m.who, 'sub');
  o.m.guion.push(dimitriDice({ mode: 'charla', reply: 'ya estoy bien' })); assert.equal((await turno(o, 'segundo')).status, 200);
  const n0 = (await o.admin('GET', '/api/sub')).j.messages.length;
  // la IA se cae a mitad de sesión: 500, nada se guarda y el siguiente mensaje funciona
  const real = o.env.__pruebas.fetch; o.env.__pruebas.fetch = async () => { throw new Error('red caída'); };
  const caida = await turno(o, 'tercero'); assert.equal(caida.status, 500); assert.equal((await o.admin('GET', '/api/sub')).j.messages.length, n0, 'ni el mensaje del dueño ni media respuesta');
  o.env.__pruebas.fetch = real; o.m.guion.push(dimitriDice({ mode: 'charla', reply: 'de vuelta' })); assert.equal((await turno(o, 'cuarto')).status, 200);
  // el dueño abre «Nueva conversación» mientras Dimitri piensa
  o.env.__pruebas.fetch = async (u, init) => { if (String(u).startsWith('https://api.anthropic.com/')) await chat.archivar(o.env.DB); return real(u, init); };
  o.m.guion.push(dimitriDice({ mode: 'charla', reply: 'respuesta tardía' }));
  const tarde = await turno(o, 'quinto'); assert.equal(tarde.status, 500); assert.match(tarde.j.error, /Cambiaste de conversación/);
  assert.equal((await o.admin('GET', '/api/sub')).j.messages.length, 0, 'la conversación nueva sigue vacía');
});

test('la semana del informe del lunes se suelta si la IA falla (y se espera un rato antes de reintentar)', { skip: SALTAR }, async () => {
  const o = await oficina6(); const lunes = new Date('2026-10-26T09:00:00');
  const real = o.env.__pruebas.fetch; o.env.__pruebas.fetch = async () => { throw new Error('sin red'); };
  await assert.rejects(informeSemanal({ env: o.env, db: o.env.DB, ahora: lunes, fetchFn: o.env.__pruebas.fetch }), /sin red/);
  const doc = () => JSON.parse(filas(o.d1, 'select json from docs where clave = ?', DOC_SEMANA)[0].json);
  assert.ok(!doc().week, 'la semana quedó libre'); assert.ok(doc().fallo);
  assert.equal(await informeSemanal({ env: o.env, db: o.env.DB, ahora: new Date(lunes.getTime() + 60e3), fetchFn: real }), null, 'un minuto después no reintenta (espera 15)');
  o.m.guion.push(dimitriDice('Semana tranquila.'));
  const t = await informeSemanal({ env: o.env, db: o.env.DB, ahora: new Date(lunes.getTime() + 16 * 60e3), fetchFn: real }); assert.match(t, /Semana tranquila/);
  assert.equal(await informeSemanal({ env: o.env, db: o.env.DB, ahora: new Date(lunes.getTime() + 20 * 60e3), fetchFn: real }), null, 'ya salió: no sale dos veces');
});
