// Fase 3, la revisión: los seis arreglos obligatorios (y tres opcionales) con su prueba. Contra una D1 de verdad en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import * as TAREAS from '../worker/modulos/tareas.js';
import { abrirSesion, conSesion, cargarTareas } from '../worker/lib/tareas/sesion.js';
import { instalarZona, quitarZona, DateReal, conZona, crearDateDeZona, instanteDeTexto, componentes, desfaseMin, describirZona } from '../worker/lib/zona.js';
import { guardarDoc } from '../worker/lib/almacen.js';
import { DOC_ESTADO } from '../worker/lib/tareas/rutinas.js';
import { crearTarea } from '../../tareas/modelo.mjs';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';

const RUTA_IA = { agent: 'piper', title: 'Armar la propuesta', plan: ['Leer', 'Escribir'], eta_minutes: 20, why: 'es de ventas', needs_ok: true };
const iaFalsa = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(RUTA_IA) }], usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 });

async function oficina() {
  instalarZona('America/Panama');
  const d1 = crearD1(); const admin = await sembrar(d1);
  const editor = await sembrar(d1, { email: 'editor@panaclaw.test', rol: 'editor' });
  const lectura = await sembrar(d1, { email: 'lee@panaclaw.test', rol: 'lectura' });
  const env = envDePrueba(d1, { ANTHROPIC_API_KEY: 'k', __pruebas: { fetchIA: iaFalsa } });
  const entrar = async u => (await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: u.email, contrasena: u.clave } })).headers.get('set-cookie').split(';')[0];
  const cookies = { admin: await entrar(admin), editor: await entrar(editor), lectura: await entrar(lectura) };
  const llamar = quien => async (metodo, ruta, cuerpo) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', cookie: cookies[quien] }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), env);
    const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = tx; } return { status: r.status, j };
  };
  return { d1, env, api: llamar('admin'), editor: llamar('editor'), lectura: llamar('lectura') };
}

test('ALTO-1: volcar 150 tareas cambiadas no pasa de 100 parámetros por sentencia (el límite de D1)', { skip: SALTAR }, async () => {
  const o = await oficina();
  await conSesion(o.d1, async s => { const l = s.alm.load(); for (let i = 0; i < 150; i++) l.push(crearTarea({ dept: 'ops', agent: 'olead', title: 'T' + i, text: 'T' + i }, { id: () => 'masiva' + i })); s.alm.save(l); });
  assert.equal((await cargarTareas(o.d1)).length, 150);
  const medida = { maximo: 0, sentencias: 0 }; const prep = o.d1.prepare;
  o.d1.prepare = sql => { medida.maximo = Math.max(medida.maximo, (sql.match(/\?/g) || []).length); medida.sentencias++; return prep(sql); };
  await conSesion(o.d1, async s => { const l = s.alm.load(); for (const t of l) t.title += '!'; s.alm.save(l); });
  o.d1.prepare = prep;
  assert.ok(medida.sentencias > 150, 'volcó las 150');
  assert.ok(medida.maximo <= 100, `una sentencia llevó ${medida.maximo} parámetros`);
  assert.ok((await cargarTareas(o.d1)).every(t => t.title.endsWith('!') && t.version === 2));
});

test('ALTO-2: cambiar lo que hace una rutina es del administrador; pausarla, de cualquiera que trabaje. Y needsOk:false en una tarea también', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = (await o.api('POST', '/api/routines', { dept: 'sales', text: 'cada día hábil a las 8, revisa el correo' })).j.routine;
  for (const cuerpo of [{ needsOk: false }, { text: 'otra cosa' }, { title: 'x' }, { when: { kind: 'daily', at: '09:00' } }, { agent: 'piper' }, { model: 'opus' }, { effort: 'max' }, { paused: true, needsOk: false }, {}])
    assert.equal((await o.editor('PATCH', '/api/routines/' + r.id, cuerpo)).status, 403, JSON.stringify(cuerpo));
  assert.equal((await o.editor('PATCH', '/api/routines/' + r.id, { paused: true })).status, 200);
  assert.equal((await o.editor('PATCH', '/api/routines/' + r.id, { paused: false })).status, 200);
  assert.equal((await o.lectura('PATCH', '/api/routines/' + r.id, { paused: true })).status, 403);
  const adm = await o.api('PATCH', '/api/routines/' + r.id, { needsOk: false, title: 'Nuevo título' });
  assert.deepEqual([adm.status, adm.j.routine.needsOk, adm.j.routine.title], [200, false, 'Nuevo título']);
  // una tarea sin pedir el visto bueno
  assert.equal((await o.editor('POST', '/api/tasks', { dept: 'sales', text: 'Manda el correo a Acme', needsOk: false })).status, 403);
  const t = (await o.editor('POST', '/api/tasks', { dept: 'sales', text: 'Arma la propuesta para Acme', needsOk: true })).j;
  assert.equal((await o.editor('PATCH', `/api/tasks/${t.id}`, { needsOk: false })).status, 403);
  assert.equal((await o.editor('PATCH', `/api/tasks/${t.id}`, { needsOk: true, title: 'Otro título' })).status, 200);
  assert.equal((await o.api('PATCH', `/api/tasks/${t.id}`, { needsOk: false })).j.needsOk, false);
  assert.equal((await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Lista de precios', needsOk: false })).status, 200);
});

test('BAJO: límites de rutinas (texto, horario con solo sus claves) y un conflicto que no cede es 409, no 500', { skip: SALTAR }, async () => {
  const o = await oficina();
  assert.equal((await o.api('POST', '/api/routines', { dept: 'ops', text: 'cada día a las 8, ' + 'x'.repeat(4100) })).status, 400);
  assert.equal((await o.api('POST', '/api/routines', { dept: 'ops', text: 'revisa los pagos', when: { kind: 'daily', at: '08:00', intruso: 'x', otro: {} } })).status, 200); // las claves de más se descartan
  const guardada = o.d1._db.prepare("select json from filas where coleccion = 'rutinas'").all().map(x => JSON.parse(x.json))[0];
  assert.deepEqual(Object.keys(guardada.when).sort(), ['at', 'kind']);
  assert.equal((await o.api('POST', '/api/routines', { dept: 'ops', text: 'revisa', when: 'cada lunes' })).status, 400);
  assert.equal((await o.api('POST', '/api/routines', { dept: 'ops', text: 'revisa', when: [] })).status, 400);
  const r = guardada.id;
  assert.equal((await o.api('PATCH', '/api/routines/' + r, { text: 'y'.repeat(4001) })).status, 400);
  assert.equal((await o.api('PATCH', '/api/routines/' + r, { when: { kind: 'weekly', at: '09:00', days: [1], otra: 1 } })).j.routine.when.otra, undefined);
  assert.equal((await o.api('PATCH', '/api/routines/' + r, { when: { kind: 'weekly', at: '09:00', days: [9] } })).status, 400);
  // un conflicto que no cede (la base nunca deja escribir) → «vuelve a intentarlo»
  const batch = o.d1.batch; o.d1.batch = async l => l.map(() => ({ success: true, meta: { changes: 0 } }));
  const x = await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Llama a Acme' });
  o.d1.batch = batch;
  assert.equal(x.status, 409); assert.equal(x.j.conflicto, true); assert.match(x.j.error, /vuelve a intentarlo/);
});

test('MEDIO-3: toda tarea cuyo JSON cambia sube de versión, aunque la bitácora no vea el cambio; así dos cambios a la vez no se pisan', { skip: SALTAR }, async () => {
  const o = await oficina();
  const t = (await o.api('POST', '/api/tasks', { dept: 'sales', text: 'Llama a Acme' })).j;
  assert.equal(t.version, 1);
  await conSesion(o.d1, async s => { s.alm.cambiar(t.id, x => { x.avisos = { vispera: 5 }; x.seenAt = 1; }); });
  assert.equal((await cargarTareas(o.d1))[0].version, 2, 'un cambio que la bitácora no cuenta también sube la versión');
  // dos sesiones abiertas a la vez sobre la misma tarea, cada una con un cambio «invisible»: la segunda choca en vez de pisar a la primera
  const a = await abrirSesion(o.d1), b = await abrirSesion(o.d1);
  a.alm.cambiar(t.id, x => { x.seenAt = 111; }); b.alm.cambiar(t.id, x => { x.avisos = { vencida: 9 }; });
  await a.terminar();
  await assert.rejects(() => b.terminar(), e => e.conflicto === true);
  const final = (await cargarTareas(o.d1))[0]; assert.deepEqual([final.seenAt, final.avisos, final.version], [111, { vispera: 5 }, 3]);
});

test('MEDIO-2: el reloj crea la tarea ANTES de adelantarse; si muere entre los dos pasos, el minuto siguiente confirma sin duplicar', { skip: SALTAR }, async () => {
  const o = await oficina();
  const r = (await o.api('POST', '/api/routines', { dept: 'ops', text: 'cada día a las 8, revisa los pagos', needsOk: false })).j.routine;
  await guardarDoc(o.d1, DOC_ESTADO, { [r.id]: { nextAt: Date.now() - 20e3, when: JSON.stringify(r.when), runs: 4 } });
  const prep = o.d1.prepare; let muere = true;
  o.d1.prepare = sql => { const st = prep(sql); return /^update docs set/.test(sql) ? { bind: (...a) => (muere && a.includes(DOC_ESTADO) ? { run: async () => { throw new Error('el Worker murió'); } } : st.bind(...a)) } : st; };
  await assert.rejects(() => TAREAS.cadaMinuto(o.env), /el Worker murió/);
  muere = false; o.d1.prepare = prep;
  const tras = await cargarTareas(o.d1);
  assert.equal(tras.length, 1, 'la tarea ya nació antes de que el reloj avanzara'); assert.equal(tras[0].routine, r.id);
  assert.equal((await o.api('GET', '/api/routines')).j.routines[0].runs, 4, 'y el reloj no avanzó');
  await TAREAS.cadaMinuto(o.env);
  assert.equal((await cargarTareas(o.d1)).length, 1, 'el reintento no duplica');
  assert.equal((await o.api('GET', '/api/routines')).j.routines[0].runs, 5, 'ahora sí se adelantó');
});

test('MEDIO-1: la zona se instala desde la entrada (fetch y cron); Date() sigue siendo función; Date.parse y «AAAA-MM-DD HH:MM» leen la zona de la oficina', { skip: SALTAR }, async () => {
  quitarZona();
  assert.equal(globalThis.Date, DateReal);
  const d1 = crearD1(); const env = envDePrueba(d1);
  await pedir(manejar, env, '/api/health'); // lib/rutas.js instala la zona
  assert.notEqual(globalThis.Date, DateReal);
  assert.equal(typeof Date(), 'string'); assert.equal(typeof Date.now(), 'number');
  assert.ok(new Date() instanceof Date); assert.ok(new DateReal() instanceof Date); assert.ok(new Date() instanceof DateReal);
  assert.equal(Date.parse('2026-10-26T09:00'), DateReal.UTC(2026, 9, 26, 14)); assert.equal(Date.parse('2026-10-26 09:00'), DateReal.UTC(2026, 9, 26, 14));
  assert.equal(new Date('2026-10-26 09:30').toISOString(), '2026-10-26T14:30:00.000Z');
  assert.equal(Date.parse('2026-10-26T09:00:00Z'), DateReal.UTC(2026, 9, 26, 9)); assert.equal(Date.parse('2026-10-26'), DateReal.UTC(2026, 9, 26)); assert.ok(Number.isNaN(Date.parse('no es fecha')));
  // el cron también la instala (el índice solo exporta el handler)
  quitarZona(); const { default: worker } = await import('../worker/index.js');
  assert.deepEqual(Object.keys(await import('../worker/index.js')).sort(), ['Hub', 'default']); // fase 10: además del handler, SOLO la clase del Durable Object (workerd la exige en el módulo main)
  await worker.scheduled({}, env); assert.notEqual(globalThis.Date, DateReal);
  // la API explícita (sin parche global) y el parche acotado
  assert.equal(instanteDeTexto('America/Panama', '2026-10-26 09:00'), DateReal.UTC(2026, 9, 26, 14)); assert.equal(instanteDeTexto('America/Panama', '2026-10-26'), null);
  assert.equal(desfaseMin('America/Panama', DateReal.UTC(2026, 9, 26)), -300); assert.equal(componentes('America/Panama', DateReal.UTC(2026, 9, 26, 2, 30)).h, 21);
  assert.deepEqual(describirZona('America/Panama', DateReal.UTC(2026, 9, 26)), { nombre: 'America/Panama', utc: 'UTC−05:00' });
  const Tokio = crearDateDeZona('Asia/Tokyo'); assert.equal(new Tokio('2026-10-26T09:00').toISOString(), '2026-10-26T00:00:00.000Z');
  quitarZona(); assert.equal(globalThis.Date, DateReal);
  assert.equal(await conZona('America/Panama', async () => new Date('2026-10-26T09:00').getTime()), DateReal.UTC(2026, 9, 26, 14)); assert.equal(globalThis.Date, DateReal, 'el Date de verdad vuelve');
  instalarZona('America/Panama'); await conZona('Asia/Tokyo', async () => {}); assert.ok(globalThis.Date.__zonaOficina, 'conZona respeta el parche que ya había');
});
