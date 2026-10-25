// Fase 4: lo que hace que los agentes sean seguros de dejar solos — candado de tarea, reintentos, presupuesto, límites por pasos, detener, revisión del jefe,
// pasar a una persona, bloqueos, y que ningún secreto llegue a D1 ni a una respuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, tareaEnDisco, crearFetch, texto, usar, minutos, filas, pagina, todoD1 } from './agentes-ayudas.mjs';
import { avanzar, crearCorrida } from '../worker/lib/agentes/ejecutor.js';
import { crearPresupuesto } from '../worker/lib/contenido/presupuesto.js';
import * as TAREAS from '../worker/modulos/tareas.js';
import * as CONTENIDO from '../worker/modulos/contenido.js';
import * as ESTUDIO from '../worker/modulos/estudio.js';

const GRANDE = { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' };
const deps = (env, fetchFn, extra = {}) => ({ env, db: env.DB, presupuesto: crearPresupuesto({ CONTENIDO_MAX_LLAMADAS: '500', CONTENIDO_MAX_CONSULTAS: '5000' }), modulos: [TAREAS, CONTENIDO, ESTUDIO], fetchFn, ahora: () => Date.now(), ...extra });
/** Una tarea tomada por la cola y con su corrida, sin ejecutar nada todavía. */
async function conCorrida(env, campos = {}, modo = 'task') {
  const t = await tarea(env, campos); const [tomada] = await TAREAS.tomarSiguiente(env.DB, { max: 3 });
  assert.equal(tomada.id, t.id); await crearCorrida(env.DB, tomada, { modo }); return tomada;
}

test('CANDADO: dos avances de la misma tarea a la vez → una sola ejecución (la otra ve «ocupada»)', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina();
  const t = await conCorrida(env);
  const f = crearFetch({ guion: [texto('Hecho.\nFuentes: —')] });
  const r = await Promise.all([avanzar(deps(env, f.fetchFn), t.id), avanzar(deps(env, f.fetchFn), t.id), avanzar(deps(env, f.fetchFn), t.id)]);
  assert.equal(r.filter(x => x.estado === 'ocupada').length, 2); assert.equal(r.filter(x => x.estado === 'hecha').length, 1);
  assert.equal(f.registro.anthropic.length, 1, 'el modelo se llamó UNA vez'); assert.equal(filas(d1, 'select count(*) n from costos')[0].n, 1);
});

test('CANDADO: dos relojes (cron) a la vez no arrancan la misma tarea dos veces', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE });
  const t = await tarea(env);
  const f = crearFetch({ guion: [texto('Una sola vez.\nFuentes: —'), texto('OTRA ejecución (no debería pasar)')] });
  await Promise.all([minutos(env, f.fetchFn), minutos(env, f.fetchFn)]);
  const d = await tareaEnDisco(d1, t.id);
  assert.equal(d.state, 'done'); assert.match(d.result, /Una sola vez/); assert.equal(f.registro.anthropic.length, 1);
  assert.equal(filas(d1, "select count(*) n from costos where tarea = ?", t.id)[0].n, 1);
});

test('CANDADO: el de un Worker que murió caduca solo; el de uno vivo se respeta', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina();
  const t = await conCorrida(env);
  const f = crearFetch({ guion: [texto('Listo.\nFuentes: —')] });
  d1._db.prepare("update corridas set candado = 'otro', candado_hasta = ?").run(Date.now() + 60_000);
  assert.equal((await avanzar(deps(env, f.fetchFn), t.id)).estado, 'ocupada'); assert.equal(f.registro.anthropic.length, 0);
  d1._db.prepare("update corridas set candado_hasta = ?").run(Date.now() - 1);
  assert.equal((await avanzar(deps(env, f.fetchFn), t.id)).estado, 'hecha');
});

test('DETENER: si el dueño la detiene mientras el agente piensa, no se escribe su resultado ni se paga un segundo envío', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE });
  const web = await pagina({ d1, env });
  const t = await tarea(env);
  const base = crearFetch({ guion: [texto('Resultado que NO debe guardarse.\nFuentes: —')] });
  let parado = false;
  const fetchFn = async (url, init) => { const r = await base.fetchFn(url, init); if (!parado && String(url).includes('anthropic')) { parado = true; assert.equal((await web.admin('POST', `/api/tasks/${t.id}/stop`, {})).status, 200); } return r; };
  const [res] = await minutos(env, fetchFn);
  assert.equal(res.avanzadas[0].estado, 'perdida');
  const d = await tareaEnDisco(d1, t.id); assert.equal(d.state, 'done'); assert.equal(d.stopped, true); assert.equal(d.result, 'Detenida por ti antes de terminar.'); assert.equal(d.note, undefined);
  assert.equal(filas(d1, 'select count(*) n from corridas')[0].n, 0);
});

test('REINTENTOS: un fallo pasajero (saturado) vuelve a la cola con su hora; pasada la hora, termina', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE });
  const t = await tarea(env);
  const mal = crearFetch({ fallaAnthropic: { estado: 529, mensaje: 'Overloaded' } });
  await minutos(env, mal.fetchFn);
  let d = await tareaEnDisco(d1, t.id);
  assert.equal(d.state, 'next'); assert.equal(d.attempts, 1); assert.equal(d.lastErrorKind, 'transient'); assert.ok(d.retryAt > Date.now()); assert.equal(d.tomadaPor, undefined);
  assert.equal(filas(d1, 'select count(*) n from corridas')[0].n, 0);
  const aun = crearFetch({ guion: [texto('No debería correr todavía.')] });
  await minutos(env, aun.fetchFn); assert.equal(aun.registro.anthropic.length, 0, 'antes de su hora no arranca');
  const ok = crearFetch({ guion: [texto('Ya sí.\nFuentes: —')] });
  await minutos(env, ok.fetchFn, 1, { ahora: () => d.retryAt + 1000 });
  d = await tareaEnDisco(d1, t.id); assert.equal(d.state, 'done'); assert.match(d.result, /Ya sí/); assert.equal(d.retryAt, undefined);
});

test('REINTENTOS: tras agotarlos, la tarea falla con su motivo y un aviso; un error de la llave no se reintenta nunca', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, ajustes: { retries: { max: 1, backoff: [5] } } });
  const t = await tarea(env);
  const mal = crearFetch({ fallaAnthropic: { estado: 502, mensaje: 'bad gateway' } });
  let ahora = Date.now();
  await minutos(env, mal.fetchFn, 1, { ahora: () => ahora }); let d = await tareaEnDisco(d1, t.id); assert.equal(d.state, 'next');
  ahora = d.retryAt + 1; await minutos(env, mal.fetchFn, 1, { ahora: () => ahora });
  d = await tareaEnDisco(d1, t.id); assert.equal(d.state, 'done'); assert.equal(d.error, true); assert.match(d.result, /Could not complete this task/); assert.equal(mal.registro.anthropic.length, 2);
  const t2 = await tarea(env, { title: 'Otra' });
  const login = crearFetch({ fallaAnthropic: { estado: 401, mensaje: 'invalid x-api-key' } });
  await minutos(env, login.fetchFn); const d2 = await tareaEnDisco(d1, t2.id);
  assert.equal(d2.state, 'done'); assert.equal(d2.errorKind, 'login'); assert.equal(login.registro.anthropic.length, 1); assert.match(d2.result, /rechazó la clave/);
  assert.ok(filas(d1, "select json from filas where coleccion = 'avisos'").some(a => /"kind":"login"/.test(a.json)));
  assert.ok(!todoD1(d1).includes('sk-ant-secreto-de-prueba'));
});

test('PRESUPUESTO: con stopAtBudget y el mes pasado de tope no arranca ninguna tarea nueva (el control sin tope sí)', { skip: SALTAR }, async () => {
  const caro = { t: Date.now(), usd: 5 };
  for (const [tope, arranca] of [[true, false], [false, true]]) {
    const { d1, env } = await oficina({ env: GRANDE, ajustes: { costs: { monthlyBudget: 1, stopAtBudget: tope } } });
    d1._db.prepare("insert into costos (t, tarea, agente, dept, tipo, modelo, proveedor, tin, tout, usd, fuente) values (?,?,?,?,?,?,?,?,?,?,?)").run(caro.t, null, 'elead', 'emails', 'task', 'claude-sonnet-5', 'anthropic', 1, 1, caro.usd, 'tabla');
    const t = await tarea(env); const f = crearFetch({ guion: [texto('Hecho.\nFuentes: —')] });
    const [r] = await minutos(env, f.fetchFn);
    assert.equal(r.tomadas.length, arranca ? 1 : 0, `stopAtBudget=${tope}`); assert.equal((await tareaEnDisco(d1, t.id)).state, arranca ? 'done' : 'next');
    if (arranca) assert.ok(filas(d1, "select json from filas where coleccion = 'avisos'").some(a => /"kind":"budget"/.test(a.json)), 'avisa que se pasó del presupuesto');
  }
});

test('LÍMITES POR PASOS: con muy pocas llamadas por invocación, una tarea larga avanza minuto a minuto sin repetir ninguna herramienta', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { AGENTES_MAX_LLAMADAS: '5', AGENTES_MAX_CONSULTAS: '60' }, conector: false });
  const t = await tarea(env, { text: 'Trabajo largo' });
  const guion = [1, 2, 3, 4].map(n => usar(['mcp__tareas__anotar_en_bitacora', { texto: `nota ${n}` }])); guion.push(texto('Todo hecho.\nFuentes: —'));
  const f = crearFetch({ guion });
  let minutosUsados = 0;
  for (; minutosUsados < 40; minutosUsados++) { await minutos(env, f.fetchFn); if ((await tareaEnDisco(d1, t.id)).state === 'done') break; }
  const d = await tareaEnDisco(d1, t.id);
  assert.equal(d.state, 'done'); assert.ok(minutosUsados >= 1, 'hizo falta más de un minuto'); assert.ok(minutosUsados < 40);
  assert.equal(f.registro.anthropic.length, 5, 'una llamada al modelo por cada respuesta del guion');
  const notas = filas(d1, "select json from tarea_bitacora where tarea = ?", t.id).map(l => JSON.parse(l.json)).filter(l => /^nota \d$/.test(l.texto || ''));
  assert.deepEqual(notas.map(n => n.texto).sort(), ['nota 1', 'nota 2', 'nota 3', 'nota 4'], 'cada herramienta corrió exactamente una vez');
  assert.equal(filas(d1, 'select count(*) n from corridas')[0].n, 0);
});

test('LÍMITES POR PASOS: la invocación no pasa de su tope de llamadas externas ni de consultas', { skip: SALTAR }, async () => {
  const { env } = await oficina({ env: { AGENTES_MAX_LLAMADAS: '6', AGENTES_MAX_CONSULTAS: '45' } });
  await tarea(env);
  const f = crearFetch({ guion: Array.from({ length: 10 }, () => usar(['mcp__gmail__search_threads', { query: 'x' }])), herramientasMcp: { search_threads: { salida: 'hilo' } } });
  const [r] = await minutos(env, f.fetchFn);
  assert.ok(r.llamadas <= 6 + 3, `llamadas externas ${r.llamadas}`); assert.ok(r.consultas <= 45 + 15, `consultas ${r.consultas}`);
  assert.equal(r.avanzadas[0].estado, 'pausada');
});

test('REVISIÓN DEL JEFE: en lo delicado (Contabilidad) el jefe revisa y el agente corrige una vez antes de que llegue al dueño', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, conector: false });
  const t = await tarea(env, { dept: 'fin', agent: 'invo', title: 'Factura de Ana', text: 'Prepara la factura de Ana.' });
  const f = crearFetch({ guion: [texto('Factura sin total.\nFuentes: —'), texto('{"ok": false, "fixes": ["Falta el total"]}'), texto('Factura con total US$100.\nFuentes: —')] });
  await minutos(env, f.fetchFn, 2); // el jefe revisa en un minuto; la corrección sigue en el siguiente
  const d = await tareaEnDisco(d1, t.id);
  assert.equal(f.registro.anthropic.length, 3); assert.match(f.registro.anthropic[1].cuerpo.system, /jefe de/); assert.match(f.registro.anthropic[2].cuerpo.messages[0].content, /Falta el total/);
  assert.equal(d.state, 'done'); assert.match(d.result, /total US\$100/); assert.equal(d.review.ok, false); assert.equal(d.review.by, 'alead');
  assert.ok(filas(d1, "select distinct tipo from costos").some(x => x.tipo === 'revision'), 'la revisión también se paga y se apunta');
});

test('PASAR A UNA PERSONA y PEDIR UN BLOQUEO: la tarea se entrega a quien corresponde con lo que llevaba', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, conector: false });
  const t = await tarea(env, { text: 'Llama al cliente y confirma.' });
  await minutos(env, crearFetch({ guion: [texto('PASAR A UNA PERSONA: hace falta una llamada.\nYa adelanté el guion.')] }).fetchFn);
  const d = await tareaEnDisco(d1, t.id); assert.equal(d.state, 'next'); assert.equal(d.person, 'Tú'); assert.equal(d.needsOk, false); assert.match(d.handoff.why, /llamada/); assert.ok(!/PASAR A UNA PERSONA/.test(d.result));
  const b = await tarea(env, { title: 'Cotizar', text: 'Cotiza el pedido de Ana.' });
  await minutos(env, crearFetch({ guion: [usar(['mcp__tareas__pedir_bloqueo', { porque: 'falta el precio de lista' }]), texto('Me detengo: falta el precio.\nFuentes: —')] }).fetchFn);
  const e = await tareaEnDisco(d1, b.id);
  assert.equal(e.state, 'next', 'se para con lo que lleva y espera'); assert.ok(e.bloqueadaPor?.length); assert.match(e.partial, /falta el precio/);
});

test('APROBACIONES: lo que lleva días sin visto bueno recuerda y caduca sin enviar nada', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, ajustes: { approvals: { undoSeconds: 0, remindAfterHours: 24, expireAfterDays: 7 } } });
  const web = await pagina({ d1, env });
  const t = await tarea(env, { needsOk: true });
  await minutos(env, crearFetch({ guion: [texto('Borrador. Para ana@x.com.\nFuentes: —')] }).fetchFn);
  assert.equal((await tareaEnDisco(d1, t.id)).state, 'waiting');
  await minutos(env, crearFetch({}).fetchFn, 1, { ahora: () => Date.now() + 25 * 3600e3 });
  assert.ok(filas(d1, "select json from filas where coleccion = 'avisos'").some(a => /"kind":"remind"/.test(a.json)));
  await minutos(env, crearFetch({}).fetchFn, 1, { ahora: () => Date.now() + 8 * 864e5 });
  const d = await tareaEnDisco(d1, t.id); assert.equal(d.state, 'done'); assert.equal(d.expired, true); assert.match(d.result, /CADUCÓ/);
  assert.equal((await web.admin('POST', `/api/tasks/${t.id}/approve`, {})).status, 400, 'ya no se puede aprobar lo caducado');
});

test('CONTEXTO: el agente trabaja con su brief, sus skills, las lecciones, las cifras y las notas del Cerebro', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, conector: false });
  d1._db.prepare("insert into filas (coleccion, id, json, orden, actualizado) values ('skills','propuesta',?,0,'x')").run(JSON.stringify({ name: 'propuesta', description: 'Cómo escribimos propuestas', agents: [], departments: ['emails'], everyone: false, text: 'Siempre tres precios.', files: [] }));
  d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('cifras', ?, 1, 'x')").run(JSON.stringify({ items: [{ name: 'Precio base', value: '100', unit: 'USD', note: '', updated: '2026-10-01' }] }));
  d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('feedback.elead', ?, 1, 'x')").run(JSON.stringify({ rules: ['2026-10-01 · Saluda con el nombre ← "x"'], oneOffs: [] }));
  d1._db.prepare("insert into notas (nombre, grupo, oficina, texto, bytes, actualizado) values (?,?,?,?,?,?)").run('politica-de-precios', '10-Business', 0, '# Política de precios\nEl descuento máximo es del 10% para clientes de Ana.', 80, Date.now());
  await tarea(env, { text: 'Responde a Ana sobre el descuento de precios.' });
  const f = crearFetch({}); await minutos(env, f.fetchFn);
  const s = f.registro.anthropic[0].cuerpo.system;
  assert.match(s, /SKILLS[\s\S]*Siempre tres precios/); assert.match(s, /Precio base: 100 USD/); assert.match(s, /LESSONS[\s\S]*Saluda con el nombre/); assert.match(s, /politica-de-precios\.md[\s\S]*descuento máximo/);
});

test('un equipo (TEAM) corre en la nube como el jefe solo, sin trabarse; y sin llave nada arranca', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE, conector: false });
  const t = await tarea(env, { team: { lead: 'elead', asked: 'you' } });
  await minutos(env, crearFetch({ guion: [texto('Hecho entre todos.\nFuentes: —')] }).fetchFn);
  assert.equal((await tareaEnDisco(d1, t.id)).state, 'done');
  const sin = await oficina({ conector: false, env: { ANTHROPIC_API_KEY: '' } });
  const t2 = await tarea(sin.env); const f = crearFetch({});
  const [r] = await minutos(sin.env, f.fetchFn); assert.deepEqual(r.tomadas, []); assert.equal((await tareaEnDisco(sin.d1, t2.id)).state, 'next'); assert.equal(f.registro.anthropic.length, 0);
});
