// P6: `crear_tarea` y `crear_mi_tarea` de la Capa 1 se quitaron del conector porque `tareas_cambiar` (accion «crear») hace lo mismo. Esta prueba lo demuestra: la lógica que tenían (oficina-tools.mjs → crearLlamador,
// la misma que sigue usando el MCP local) y la herramienta de dominio dejan en D1 LA MISMA tarea (título, departamento, persona, prioridad, límite, OK del dueño, hora de arranque), con el origen «mcp» y la marca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { mundo } from './mcp-ayudas.mjs';
import { personaActual } from '../worker/lib/mcp/tokens.js';
import { crearOficinaMcp } from '../worker/lib/mcp/capa1/oficina.js';
import { crearLlamador } from '../../oficina-tools.mjs';
import { herramienta } from '../worker/lib/mcp/registro.js';

const texto = (r) => r.j.result.content[0].text;
const dia = (d) => d.toISOString().slice(0, 10);
const tareas = (m) => m.db.prepare("select json from filas where coleccion = 'tareas' order by id").all().map((r) => JSON.parse(r.json));
/** Lo que importa de una tarea para comparar (sin id, hora de alta ni la marca de origen). */
const esencia = (t) => ({ title: t.title, dept: t.dept ?? null, person: t.person ?? null, prioridad: t.prioridad ?? null, limite: t.limite ?? null, needsOk: !!t.needsOk, at: t.dueAt ?? t.at ?? null, state: t.state, agent: t.agent ?? null });

test('LAS DOS HERRAMIENTAS VIEJAS YA NO ESTÁN en el conector (las cubre tareas_cambiar)', () => {
  assert.equal(herramienta('crear_tarea'), null); assert.equal(herramienta('crear_mi_tarea'), null);
  const t = herramienta('tareas_cambiar'); assert.ok(t.esquema.properties.accion.enum.includes('crear')); assert.ok(t.esquema.properties.at, 'admite `at` (hora de arranque) como crear_tarea');
});

test('EQUIVALENCIA — mi tarea: crear_mi_tarea (lógica de oficina-tools) y tareas_cambiar crear dejan la misma tarea', { skip: SALTAR }, async () => {
  const limite = dia(new Date(Date.now() + 5 * 864e5));
  const a = await mundo(), b = await mundo();
  const office = await crearOficinaMcp({ env: a.env, db: a.d1, usuario: await personaActual(a.d1, a.db.prepare('select id from users limit 1').get().id) }); // la MISMA persona que ve el conector
  const viejo = await crearLlamador({ office })('crear_mi_tarea', { titulo: 'Llamar a Ana', prioridad: 'alta', limite });
  assert.match(viejo, /En la lista del dueño/);
  const t = (await b.conectar({ alcance: 'oficina' })).tokens.access_token;
  const nuevo = texto(await b.llamar(t, 'tareas_cambiar', { accion: 'crear', titulo: 'Llamar a Ana', prioridad: 'alta', limite })); assert.match(nuevo, /Tarea creada/);
  const [x, y] = [tareas(a), tareas(b)]; assert.equal(x.length, 1); assert.equal(y.length, 1);
  assert.deepEqual(esencia(y[0]), esencia(x[0]), 'la misma tarea');
  assert.equal(y[0].by, 'mcp', 'el origen queda marcado (lo nuevo suma la marca)');
});

test('EQUIVALENCIA — trabajo para un departamento: crear_tarea y tareas_cambiar crear (con dept, límite y hora de arranque) dejan la misma tarea, siempre con el OK del dueño', { skip: SALTAR }, async () => {
  const limite = dia(new Date(Date.now() + 6 * 864e5)), at = `${dia(new Date(Date.now() + 2 * 864e5))}T10:00`;
  const a = await mundo(), b = await mundo();
  const office = await crearOficinaMcp({ env: a.env, db: a.d1, usuario: await personaActual(a.d1, a.db.prepare('select id from users limit 1').get().id) }); // la MISMA persona que ve el conector
  assert.match(await crearLlamador({ office })('crear_tarea', { dept: 'marketing', texto: 'Redacta un post sobre las camas', prioridad: 'media', limite, at }), /Tarea creada/);
  const t = (await b.conectar({ alcance: 'oficina' })).tokens.access_token;
  assert.match(texto(await b.llamar(t, 'tareas_cambiar', { accion: 'crear', dept: 'marketing', texto: 'Redacta un post sobre las camas', prioridad: 'media', limite, at })), /Tarea creada/);
  const [x, y] = [tareas(a), tareas(b)]; assert.equal(x.length, 1); assert.equal(y.length, 1);
  const ex = esencia(x[0]), ey = esencia(y[0]);
  assert.equal(ey.needsOk, true, 'por MCP siempre pide el OK'); assert.equal(ex.needsOk, true);
  assert.deepEqual(ey, ex, 'la misma tarea (departamento, límite, prioridad, hora de arranque, agente elegido por el jefe)');
  assert.match(y[0].text, /Redacta un post sobre las camas/); assert.equal(y[0].by, 'mcp');
});

test('`at` mal escrito en tareas_cambiar crear se rechaza con motivo y no crea nada', { skip: SALTAR }, async () => {
  const b = await mundo(), t = (await b.conectar({ alcance: 'oficina' })).tokens.access_token;
  const r = await b.llamar(t, 'tareas_cambiar', { accion: 'crear', dept: 'marketing', texto: 'x', at: 'mañana' });
  assert.equal(r.j.result.isError, true); assert.match(texto(r), /AAAA-MM-DDTHH:MM/); assert.equal(tareas(b).length, 0);
});
