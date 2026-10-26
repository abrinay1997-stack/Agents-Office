// 26 oct 2026 — Dimitri en la nube conoce al EQUIPO (las cuentas de la plataforma, con su rol) y sabe QUIÉN le escribe; y puede dejar una lista de tareas HECHA para una
// cuenta (proyecto, prioridad, fecha límite, pasos, lo que espera) en vez de repartirlo todo entre los escritorios. Pedido del dueño: «dejársela hecha a mi pareja, que es
// administrativa». Contra una D1 de verdad en memoria (migraciones reales), el Worker entero (login incluido) y un Anthropic de mentira.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { instalarZona } from '../worker/lib/zona.js';
import { quienEs } from '../worker/lib/dimitri/conversar.js';
import { cargarTareas } from '../worker/lib/tareas/sesion.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { mundo, dimitriDice, oficina6, TOKEN_BOT, SECRETO_WEBHOOK, DUENO_TG } from './fase6-ayudas.mjs';

async function oficina({ guion = [] } = {}) {
  instalarZona('America/Panama');
  const d1 = crearD1();
  const cuentas = { ana: await sembrar(d1, { email: 'ana.admin@panaclaw.test', rol: 'admin' }), beto: await sembrar(d1, { email: 'beto.admin@panaclaw.test', rol: 'admin' }),
    carla: await sembrar(d1, { email: 'carla@panaclaw.test', rol: 'editor' }), dani: await sembrar(d1, { email: 'dani@panaclaw.test', rol: 'lectura' }) };
  const m = mundo({ guion });
  const env = envDePrueba(d1, { ANTHROPIC_API_KEY: 'sk-ant-secreto-de-prueba' });
  env.__pruebas = { fetch: m.fetchFn, fetchIA: m.fetchFn };
  const cookies = {};
  for (const [k, u] of Object.entries(cuentas)) cookies[k] = (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: u.email, contrasena: u.clave } })).headers.get('set-cookie').split(';')[0];
  const como = (quien) => async (metodo, ruta, cuerpo) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', cookie: cookies[quien] }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), env);
    const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j };
  };
  return { d1, m, guion, ana: como('ana'), beto: como('beto'), carla: como('carla'), dani: como('dani') };
}
const sistema = (o, n = -1) => o.m.registro.anthropic.at(n).system;
const mensaje = (o, n = -1) => o.m.registro.anthropic.at(n).messages[0].content;
const sub = (r) => r.j.messages.find((x) => x.who === 'sub');

test('Dimitri ve las cuentas del equipo con su rol y sabe quién le escribe; el mensaje queda firmado', { skip: SALTAR }, async () => {
  const o = await oficina({ guion: [dimitriDice({ mode: 'charla', reply: 'Hola, Ana.' }), dimitriDice({ mode: 'charla', reply: 'Hola, Beto.' })] });
  const a = await o.ana('POST', '/api/sub/chat', { text: '¿Cuántos usuarios administrativos tenemos?' });
  assert.equal(a.status, 200);
  const s = sistema(o);
  assert.match(s, /<equipo>\nTe escribe ahora: Ana admin \(rol administrador\)\./);
  assert.match(s, /- Ana admin · cuenta de la plataforma, rol administrador · 0 tareas abiertas · es quien te escribe/);
  assert.match(s, /- Beto admin · cuenta de la plataforma, rol administrador/); assert.match(s, /- Carla · cuenta de la plataforma, rol editor/); assert.match(s, /- Dani · cuenta de la plataforma, rol solo lectura/);
  assert.match(mensaje(o), /Ana admin: ¿Cuántos usuarios administrativos tenemos\?/);
  assert.equal(a.j.messages[0].por, 'Ana admin'); assert.equal(sub(a).para, 'Ana admin');
  // la misma conversación la sigue otra administradora: el modelo ve de quién es cada cosa
  const b = await o.beto('POST', '/api/sub/chat', { text: 'Y yo, ¿qué puedo hacer?' }); assert.equal(b.status, 200);
  assert.match(sistema(o), /Te escribe ahora: Beto admin \(rol administrador\)\./); assert.match(sistema(o), /es quien te escribe/);
  assert.match(mensaje(o), /Ana admin: ¿Cuántos usuarios administrativos tenemos\?[\s\S]*Beto admin: Y yo, ¿qué puedo hacer\?/);
  // un editor o alguien de solo lectura no habla con Dimitri (como siempre)
  assert.equal((await o.carla('POST', '/api/sub/chat', { text: 'hola' })).status, 403); assert.equal((await o.dani('POST', '/api/sub/chat', { text: 'hola' })).status, 403);
});

test('una lista de tareas para Carla con proyecto, prioridad, fechas y pasos: ENVIAR la deja HECHA en SU lista (y lo «mío» de Ana, en la de Ana)', { skip: SALTAR }, async () => {
  const plan = { mode: 'plan', reply: 'Le dejo la lista a Carla y la firma es tuya.', proyecto: { nombre: 'Cierre de octubre', objetivo: 'Facturas al día', limite: '2026-10-31' }, tasks: [
    { dept: 'persona', persona: 'carla', title: 'Listar las facturas vencidas', instruction: 'Saca el listado de facturas vencidas.', why: 'es administrativa', prioridad: 'alta', limite: '2026-10-28', pasos: ['Abrir el listado', 'Marcar las de más de 30 días'] },
    { dept: 'persona', persona: 'Carla', title: 'Llamar a cada cliente', instruction: 'Llama a cada cliente.', why: 'sigue al listado', limite: '2026-10-30', espera: [0], pasos: ['Llamar', 'Anotar lo prometido'] },
    { dept: 'dueno', title: 'Firmar el cierre', instruction: 'Firma el cierre.', why: 'solo tú', limite: '2026-10-31', espera: [1] }] };
  const o = await oficina({ guion: [dimitriDice(plan)] });
  const a = await o.ana('POST', '/api/sub/chat', { text: 'Hazle a Carla una lista de tareas para el cierre de octubre' }); const m = sub(a);
  assert.equal(m.mode, 'plan'); assert.deepEqual(m.plan.tasks.map((t) => [t.dept, t.persona || null]), [['persona', 'Carla'], ['persona', 'Carla'], ['dueno', null]]);
  assert.equal((await cargarTareas(o.d1)).length, 0, 'proponer no crea nada');
  const e = await o.ana('POST', '/api/sub/send', { msg: m.id, items: [{ i: 0, include: true }, { i: 1, include: true }, { i: 2, include: true }] });
  assert.equal(e.status, 200, JSON.stringify(e.j)); assert.equal(e.j.tasks.length, 3);
  const t = await cargarTareas(o.d1), por = (x) => t.find((y) => y.title === x);
  const listar = por('Listar las facturas vencidas'), llamar = por('Llamar a cada cliente'), firmar = por('Firmar el cierre');
  assert.equal(listar.person, 'Carla'); assert.ok(!listar.agent, 'ningún escritorio la tiene'); assert.equal(listar.prioridad, 'alta'); assert.equal(listar.limite, '2026-10-28');
  assert.deepEqual(listar.pasos.map((p) => p.texto), ['Abrir el listado', 'Marcar las de más de 30 días']);
  assert.equal(listar.delegada.a, 'persona:Carla'); assert.equal(listar.delegada.por, 'Ana admin'); assert.equal(listar.handoff.from, 'Ana admin');
  assert.deepEqual(llamar.bloqueadaPor, [listar.id], 'espera al listado'); assert.ok(listar.proyecto && listar.proyecto === llamar.proyecto && listar.proyecto === firmar.proyecto, 'del mismo proyecto');
  assert.equal(firmar.person, 'Ana admin', '«para mí» es de quien escribió el pedido, no de la lista común');
  // dónde la ve cada quien
  const idsDe = (j, lista) => j.listas[lista].pendientes.map((x) => x.id);
  const deCarla = (await o.carla('GET', '/api/tareas/mias')).j;
  assert.ok([...idsDe(deCarla, 'todas')].includes(listar.id) && [...idsDe(deCarla, 'todas')].includes(llamar.id), 'Carla las tiene en SU Mías'); assert.ok(!idsDe(deCarla, 'todas').includes(firmar.id));
  const deAna = (await o.ana('GET', '/api/tareas/mias')).j;
  assert.ok(idsDe(deAna, 'todas').includes(firmar.id)); assert.ok(!idsDe(deAna, 'todas').includes(listar.id), 'las de Carla no están en la lista de Ana'); assert.ok(idsDe(deAna, 'delegadas').includes(listar.id), 'pero Ana las sigue en Delegadas');
  assert.ok(!idsDe((await o.beto('GET', '/api/tareas/mias')).j, 'todas').includes(listar.id), 'otra administradora no las ve en su Mías');
  assert.match(e.j.messages.at(-1).text, /la lista de Carla, la lista de Ana admin/); assert.match(e.j.messages.at(-1).text, /Cierre de octubre/);
  // Dimitri ya ve lo que Carla tiene abierto
  o.guion.push(dimitriDice({ mode: 'charla', reply: 'Tiene dos.' }));
  await o.ana('POST', '/api/sub/chat', { text: '¿Cómo va Carla?' });
  assert.match(sistema(o), /- Carla · cuenta de la plataforma, rol editor · 2 tareas abiertas/);
});

test('un nombre que no es del equipo no se inventa: la pieza queda en la lista de quien escribe y se dice; desde la tarjeta tampoco se cambia a una persona que no existe', { skip: SALTAR }, async () => {
  const plan = { mode: 'plan', reply: 'Va.', tasks: [{ dept: 'persona', persona: 'Fantasma', title: 'Algo', instruction: 'x', why: 'por ejemplo' }] };
  const o = await oficina({ guion: [dimitriDice(plan)] });
  const m = sub(await o.ana('POST', '/api/sub/chat', { text: 'Pásale algo a Fantasma' }));
  assert.equal(m.plan.tasks[0].dept, 'dueno'); assert.match(m.plan.tasks[0].why, /No encontré a «Fantasma» en el equipo/);
  const e = await o.ana('POST', '/api/sub/send', { msg: m.id, items: [{ i: 0, include: true }] }); assert.equal(e.status, 200);
  assert.equal((await cargarTareas(o.d1))[0].person, 'Ana admin');
  // y la tarjeta puede cambiarse a una persona que sí existe, pero no a una que no
  const plan2 = { mode: 'plan', reply: 'Va.', tasks: [{ dept: 'fin', title: 'Conciliar', instruction: 'x' }] };
  o.guion.push(dimitriDice(plan2));
  const m2 = sub(await o.ana('POST', '/api/sub/chat', { text: 'concilia el banco' }));
  await o.ana('POST', '/api/sub/send', { msg: m2.id, items: [{ i: 0, include: true, dept: 'persona', persona: 'Nadie' }] });
  const conc = (await cargarTareas(o.d1)).find((x) => x.title === 'Conciliar'); assert.equal(conc.dept, 'fin', 'una persona que no existe no cambia el destino'); assert.ok(!conc.person);
});

test('mia_delegar a una persona: Ana pasa SU tarea a Carla (una cuenta que no es ella), espera el clic y DESHACER la devuelve', { skip: SALTAR }, async () => {
  const o = await oficina();
  const mia = (await o.ana('POST', '/api/tareas/mias', { title: 'Cobrar a Sol' })).j.tarea; assert.equal(mia.person, 'Ana admin');
  o.guion.push(dimitriDice({ mode: 'plan', reply: 'Se la paso a Carla.', ops: [{ type: 'mia_delegar', id: mia.id, persona: 'carla', nota: 'Cóbrale hoy' }, { type: 'mia_delegar', id: mia.id, persona: 'Ana admin' }] }));
  const a = await o.ana('POST', '/api/sub/chat', { text: 'pásale a Carla lo de cobrarle a Sol' }); const m = sub(a);
  assert.equal(m.ops.length, 1); assert.equal(m.ops[0].persona, 'Carla'); assert.match(m.text, /esa persona eres tú/);
  assert.equal((await cargarTareas(o.d1)).find((x) => x.id === mia.id).person, 'Ana admin', 'proponer no mueve nada');
  const h = await o.ana('POST', '/api/sub/ops', { msg: m.id, items: [{ k: 0, include: true }] }); assert.equal(h.status, 200, JSON.stringify(h.j));
  const pasada = (await cargarTareas(o.d1)).find((x) => x.id === mia.id); assert.equal(pasada.person, 'Carla'); assert.equal(pasada.delegada.por, 'Ana admin'); assert.equal(pasada.delegada.a, 'persona:Carla');
  assert.equal((await o.ana('POST', '/api/sub/ops/undo', { msg: m.id, k: 0 })).status, 200);
  const vuelta = (await cargarTareas(o.d1)).find((x) => x.id === mia.id); assert.equal(vuelta.person, 'Ana admin', 'DESHACER la devuelve'); assert.ok(!vuelta.delegada);
});

test('quienEs: la cuenta de la sesión; por Telegram, la persona del equipo con ese id; el reloj, nadie', () => {
  const C = { personas: [{ name: 'Carla', telegram: '777000', rol: 'editor' }, { name: 'Ana admin', rol: 'admin' }] };
  assert.deepEqual(quienEs({ nombre: 'Ana admin', rol: 'admin', email: 'ana@x.test' }, C), { nombre: 'Ana admin', rol: 'admin', via: '' });
  assert.deepEqual(quienEs({ email: 'telegram:777000', rol: 'admin' }, C), { nombre: 'Carla', rol: 'editor', via: 'Telegram' });
  assert.deepEqual(quienEs({ email: 'telegram:999000', rol: 'admin' }, C), { nombre: null, rol: undefined, via: 'Telegram' });
  assert.equal(quienEs({ id: 'oficina', email: 'oficina', rol: 'editor' }, C), null);
  assert.equal(quienEs(null, C), null);
});

test('por Telegram: Dimitri sabe quién escribe (el id de Telegram de una persona de Ajustes → Equipo) y lo dice', { skip: SALTAR }, async () => {
  const o = await oficina6({ extraEnv: { TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: DUENO_TG, TELEGRAM_WEBHOOK_SECRET: SECRETO_WEBHOOK }, ajustes: { team: { people: [{ name: 'Avalon', depts: ['fin'], telegram: DUENO_TG }] } },
    guion: [dimitriDice({ mode: 'charla', reply: 'Hola, Avalon.' })] });
  const r = await o.anon('POST', '/api/telegram/webhook', { update_id: 5001, message: { message_id: 1, from: { id: +DUENO_TG }, chat: { id: +DUENO_TG, type: 'private' }, text: '¿qué tengo pendiente?' } }, { 'x-telegram-bot-api-secret-token': SECRETO_WEBHOOK });
  assert.equal(r.status, 200);
  const p = o.m.registro.anthropic.at(-1);
  assert.match(p.system, /<equipo>\nTe escribe ahora: Avalon, por Telegram\./); assert.match(p.messages[0].content, /Avalon: ¿qué tengo pendiente\?/);
});

test('«para mí» por Telegram: si la persona tiene cuenta, es de SU lista; si solo está en Ajustes → Equipo (sin Mías), queda en la del dueño y ella firma el aviso', { skip: SALTAR }, async () => {
  const plan = { mode: 'plan', reply: 'Anotado.', tasks: [{ dept: 'dueno', title: 'Llamar a la contadora', instruction: 'Llama a la contadora.', why: 'lo pidió', limite: '2026-10-29' }] };
  const extraEnv = { TELEGRAM_BOT_TOKEN: TOKEN_BOT, TELEGRAM_OWNER_ID: DUENO_TG, TELEGRAM_WEBHOOK_SECRET: SECRETO_WEBHOOK };
  const escribe = (o, n) => o.anon('POST', '/api/telegram/webhook', { update_id: n, message: { message_id: 1, from: { id: +DUENO_TG }, chat: { id: +DUENO_TG, type: 'private' }, text: 'recuérdame llamar a la contadora' } }, { 'x-telegram-bot-api-secret-token': SECRETO_WEBHOOK });
  for (const [ajustes, quien] of [[{ team: { people: [{ name: 'Avalon', telegram: DUENO_TG }] } }, 'Tú'], [{ team: { people: [{ name: 'Dueno', telegram: DUENO_TG }] } }, 'Dueno']]) { // «Dueno» es el nombre de la cuenta administradora de las ayudas: con cuenta
    const o = await oficina6({ extraEnv, ajustes, guion: [dimitriDice(plan)] });
    assert.equal((await escribe(o, 6001)).status, 200);
    const g = (await o.admin('GET', '/api/sub')).j.messages, m = g.find((x) => x.who === 'sub' && x.plan);
    assert.equal(m.para, ajustes.team.people[0].name);
    assert.equal((await o.admin('POST', '/api/sub/send', { msg: m.id, items: [{ i: 0, include: true }] })).status, 200);
    assert.equal((await cargarTareas(o.d1)).find((x) => /contadora/.test(x.title)).person, quien);
  }
});
