// 26 oct 2026 — ASIGNAR una tarea a otra cuenta de la plataforma, y que «Mías» sea de cada cuenta.
// Pedido del dueño: «no se pueden asignar las tareas a los usuarios que son administradores o aparte del equipo… en las Mías deberían estar las tareas
// que se asignan… si yo creo una tarea puedo definir quién la hace, no solo el equipo de agentes sino los usuarios de la plataforma».
// Contra una D1 de verdad en memoria (con las migraciones reales) y el Worker entero (login incluido).
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { instalarZona } from '../worker/lib/zona.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';

async function oficina() {
  instalarZona('America/Panama');
  const d1 = crearD1();
  const admin = await sembrar(d1, { email: 'ana.admin@panaclaw.test', rol: 'admin' });
  const admin2 = await sembrar(d1, { email: 'beto.admin@panaclaw.test', rol: 'admin' });
  const editor = await sembrar(d1, { email: 'carla@panaclaw.test', rol: 'editor' });
  const lectura = await sembrar(d1, { email: 'dani@panaclaw.test', rol: 'lectura' });
  const env = envDePrueba(d1);
  const entrar = async u => (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: u.email, contrasena: u.clave } })).headers.get('set-cookie').split(';')[0];
  const cookies = { ana: await entrar(admin), beto: await entrar(admin2), carla: await entrar(editor), dani: await entrar(lectura) };
  const como = quien => async (metodo, ruta, cuerpo) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', cookie: cookies[quien] }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), env);
    const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j };
  };
  return { d1, ana: como('ana'), beto: como('beto'), carla: como('carla'), dani: como('dani') };
}
const mias = async api => (await api('GET', '/api/tareas/mias')).j;
const idsDe = (m, lista) => m.listas[lista].pendientes.map(t => t.id);

test('/api/team lista las cuentas de la plataforma (con su rol) y dice quién eres', { skip: SALTAR }, async () => {
  const { ana, carla } = await oficina();
  const r = await ana('GET', '/api/team');
  assert.equal(r.status, 200);
  const nombres = r.j.people.map(p => p.name);
  assert.deepEqual(nombres.sort(), ['Ana admin', 'Beto admin', 'Carla', 'Dani'].sort());
  assert.ok(r.j.people.every(p => p.usuario === true), 'todas son cuentas');
  assert.equal(r.j.people.find(p => p.name === 'Carla').rol, 'editor');
  assert.equal(r.j.yo.nombre, 'Ana admin');
  assert.equal(r.j.yo.rol, 'admin');
  assert.equal((await carla('GET', '/api/team')).j.yo.nombre, 'Carla');
});

test('crear una tarea ASIGNADA a otra cuenta: es de ella, le sale en su Mías y quien la asigna la sigue en Delegadas', { skip: SALTAR }, async () => {
  const { ana, beto, carla } = await oficina();
  const c = await ana('POST', '/api/tareas/mias', { title: 'Revisar las fotos del lanzamiento', persona: 'Carla', nota: 'antes del viernes' });
  assert.equal(c.status, 200, JSON.stringify(c.j));
  assert.equal(c.j.tarea.person, 'Carla');
  assert.equal(c.j.tarea.delegada.por, 'Ana admin');
  assert.equal(c.j.tarea.delegada.a, 'persona:Carla');
  assert.equal(c.j.tarea.agent, undefined, 'no es de ningún agente');
  const id = c.j.tarea.id;

  const deCarla = await mias(carla);
  assert.ok(idsDe(deCarla, 'todas').includes(id), 'sale en las Mías de Carla');
  assert.ok(idsDe(deCarla, 'bandeja').includes(id));
  const deAna = await mias(ana);
  assert.ok(!idsDe(deAna, 'todas').includes(id), 'ya no es de Ana');
  assert.ok(idsDe(deAna, 'delegadas').includes(id), 'Ana la sigue en Delegadas');
  assert.ok(!idsDe(await mias(beto), 'delegadas').includes(id), 'Beto no la delegó: no le sale');
  assert.ok(!idsDe(await mias(beto), 'todas').includes(id));
});

test('«Para mí» es de CADA cuenta: lo de Carla no aparece en las Mías de Ana, y al revés', { skip: SALTAR }, async () => {
  const { ana, carla } = await oficina();
  const suya = (await carla('POST', '/api/tareas/mias', { title: 'Cuadrar la caja' })).j.tarea;
  const mia = (await ana('POST', '/api/tareas/mias', { title: 'Llamar al banco' })).j.tarea;
  assert.equal(suya.person, 'Carla');
  assert.equal(mia.person, 'Ana admin');
  assert.deepEqual([idsDe(await mias(carla), 'todas').includes(suya.id), idsDe(await mias(carla), 'todas').includes(mia.id)], [true, false]);
  assert.deepEqual([idsDe(await mias(ana), 'todas').includes(mia.id), idsDe(await mias(ana), 'todas').includes(suya.id)], [true, false]);
});

test('lo del dueño («Tú»: Telegram, Dimitri, un agente bloqueado) lo ven los administradores y no un editor', { skip: SALTAR }, async () => {
  const { d1, ana, beto, carla } = await oficina();
  const { crearTarea } = await import('../../tareas/modelo.mjs');
  const t = crearTarea({ person: 'Tú', title: 'Del dueño', by: 'telegram' }, { id: () => 'dueno1' });
  d1._db.prepare("insert into filas (coleccion, id, json, orden, actualizado) values ('tareas', ?, ?, 1, '')").run(t.id, JSON.stringify(t));
  assert.ok(idsDe(await mias(ana), 'todas').includes('dueno1'));
  assert.ok(idsDe(await mias(beto), 'todas').includes('dueno1'), 'cualquier administrador');
  assert.ok(!idsDe(await mias(carla), 'todas').includes('dueno1'), 'un editor no ve la lista del dueño');
});

test('la cuenta que recibe la tarea la trabaja: empezar, hecha, delegar a un agente; y firma con SU nombre', { skip: SALTAR }, async () => {
  const { ana, carla } = await oficina();
  const id = (await ana('POST', '/api/tareas/mias', { title: 'Armar el catálogo', persona: 'Carla' })).j.tarea.id;
  const e = await carla('POST', `/api/tareas/${id}/empezar`, { empezar: true });
  assert.equal(e.status, 200, JSON.stringify(e.j));
  assert.ok(e.j.tarea.empezada);
  assert.ok((e.j.tarea.cronometro || []).some(c => c.quien === 'Carla' && !c.fin), 'el cronómetro es de Carla');
  const h = await carla('POST', `/api/tareas/${id}/estado`, { a: 'done' });
  assert.equal(h.status, 200, JSON.stringify(h.j));
  assert.equal(h.j.tarea.state, 'done');
  assert.equal(h.j.tarea.hechaPor, 'Carla');
  assert.equal(h.j.tarea.result, 'Hecha por ti.');
  const m = await mias(carla);
  assert.equal(m.cuentas.hechasHoy, 1);
});

test('delegar una tarea tuya a otra cuenta (y no a ti mismo ni a alguien que no existe)', { skip: SALTAR }, async () => {
  const { ana, beto, carla } = await oficina();
  const id = (await ana('POST', '/api/tareas/mias', { title: 'Preparar la propuesta' })).j.tarea.id;
  assert.equal((await ana('POST', `/api/tareas/${id}/delegar`, { a: 'persona', persona: 'Ana admin' })).status, 400, 'a ti mismo no');
  assert.equal((await ana('POST', `/api/tareas/${id}/delegar`, { a: 'persona', persona: 'Nadie' })).status, 400);
  const d = await ana('POST', `/api/tareas/${id}/delegar`, { a: 'persona', persona: 'Beto admin', nota: 'tú lo cierras' });
  assert.equal(d.status, 200, JSON.stringify(d.j));
  assert.equal(d.j.tarea.person, 'Beto admin');
  assert.equal(d.j.tarea.handoff.from, 'Ana admin');
  assert.ok(idsDe(await mias(beto), 'todas').includes(id));
  assert.ok(idsDe(await mias(ana), 'delegadas').includes(id));
  // Carla (editora) no puede delegar lo que no es suyo
  assert.equal((await carla('POST', `/api/tareas/${id}/delegar`, { a: 'persona', persona: 'Dani' })).status, 409);
  // quien la delegó la recupera (el DESHACER); otro editor no se la quita
  assert.equal((await carla('POST', `/api/tareas/${id}/tomar`, {})).status, 409, 'un editor no le quita una tarea a otra cuenta');
  const t = await ana('POST', `/api/tareas/${id}/tomar`, { deshacer: true });
  assert.equal(t.status, 200, JSON.stringify(t.j));
  assert.equal(t.j.tarea.person, 'Ana admin');
  assert.equal(t.j.tarea.delegada, undefined);
});

test('asignar una tarea a quien no existe, o a un agente por error, se rechaza en palabras', { skip: SALTAR }, async () => {
  const { ana } = await oficina();
  const r = await ana('POST', '/api/tareas/mias', { title: 'x', persona: 'Fantasma' });
  assert.equal(r.status, 400);
  assert.match(r.j.error, /no está en la oficina/);
});

test('«Tú» está reservado: ninguna cuenta puede llamarse como el dueño y quedarse con sus tareas', { skip: SALTAR }, async () => {
  const { carla } = await oficina();
  for (const n of ['Tú', 'tu', ' TÚ ']) {
    const r = await carla('PATCH', '/api/yo', { nombre: n });
    assert.equal(r.status, 422, n);
    assert.match(r.j.error, /reservado/);
  }
  assert.equal((await carla('PATCH', '/api/yo', { nombre: 'Carla Pérez' })).status, 200);
});

test('una cuenta de solo lectura no crea ni asigna tareas', { skip: SALTAR }, async () => {
  const { dani } = await oficina();
  assert.equal((await dani('POST', '/api/tareas/mias', { title: 'x', persona: 'Carla' })).status, 403);
});

test('un editor también puede asignarle una tarea a un administrador', { skip: SALTAR }, async () => {
  const { carla, ana } = await oficina();
  const r = await carla('POST', '/api/tareas/mias', { title: 'Pedir el visto bueno del precio', persona: 'Ana admin' });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(r.j.tarea.person, 'Ana admin');
  assert.ok(idsDe(await mias(ana), 'todas').includes(r.j.tarea.id), 'le llega a la administradora');
  assert.ok(idsDe(await mias(carla), 'delegadas').includes(r.j.tarea.id), 'y Carla la sigue');
});

test('cambiarse el nombre en «Mi perfil» no pierde lo asignado: Mías, Delegadas y quién la delegó siguen siendo de esa cuenta', { skip: SALTAR }, async () => {
  const { ana, carla } = await oficina();
  const aCarla = (await ana('POST', '/api/tareas/mias', { title: 'Revisar el catálogo', persona: 'Carla' })).j.tarea;   // Ana → Carla
  const deAna = (await ana('POST', '/api/tareas/mias', { title: 'Llamar al proveedor' })).j.tarea;                      // de Ana
  const pasada = (await carla('POST', '/api/tareas/mias', { title: 'Pedir las cifras' })).j.tarea;
  await carla('POST', `/api/tareas/${pasada.id}/delegar`, { a: 'persona', persona: 'Ana admin' });                       // Carla → Ana
  // Carla cambia de nombre
  assert.equal((await carla('PATCH', '/api/yo', { nombre: 'Carla Pérez' })).status, 200);
  const m = await mias(carla);
  assert.ok(idsDe(m, 'todas').includes(aCarla.id), 'lo que le asignaron sigue en su Mías con el nombre nuevo');
  assert.ok(idsDe(m, 'delegadas').includes(pasada.id), 'y lo que ella delegó sigue en sus Delegadas');
  assert.equal((await carla('POST', `/api/tareas/${aCarla.id}/estado`, { a: 'done' })).j.tarea.hechaPor, 'Carla Pérez');
  // Ana ve lo que Carla le pasó y sigue viendo lo que ella le dio a Carla (que ahora se llama distinto)
  const mAna = await mias(ana);
  assert.ok(idsDe(mAna, 'todas').includes(pasada.id) && idsDe(mAna, 'todas').includes(deAna.id));
  assert.equal((await ana('GET', '/api/team')).j.people.some(p => p.name === 'Carla Pérez'), true);
  // y Ana puede asignarle a Carla con su nombre nuevo
  assert.equal((await ana('POST', '/api/tareas/mias', { title: 'Otra', persona: 'Carla Pérez' })).j.tarea.person, 'Carla Pérez');
  // Ana también se cambia: lo que ella delegó (y quién la delegó) no se pierde
  const antes = (await ana('POST', '/api/tareas/mias', { title: 'Para Carla de nuevo', persona: 'Carla Pérez' })).j.tarea.id;
  assert.equal((await ana('PATCH', '/api/yo', { nombre: 'Ana Ruiz' })).status, 200);
  const mAna2 = await mias(ana);
  assert.ok(idsDe(mAna2, 'delegadas').includes(antes), 'Ana sigue viendo en Delegadas lo que le asignó a Carla');
  assert.ok(idsDe(mAna2, 'todas').includes(deAna.id), 'y lo suyo');
  assert.equal((await ana('POST', `/api/tareas/${deAna.id}/estado`, { a: 'done' })).status, 200);
});
