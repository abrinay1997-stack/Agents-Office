// Revisión de control (9 oct 2026): Dimitri y cualquier IA conectada controlan el calendario, las tareas y Contenido con UNA lista
// cerrada de cambios (sub.OPS), validada contra la oficina (sub.parseOps) — lo del dueño no se toca como si fuera de un agente, lo que no
// se puede se dice en palabras, y el JSON se lee aunque el modelo escriba algo antes (cualquier IA, no solo Claude).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sub from '../sub.mjs';
import { opLabel, whenWords, opsHTML } from '../src/sub-ops.js';
import { ACCIONES } from '../oficina/rutas.mjs';
import { MAPA, REGLAS_ASISTENTE } from '../oficina/mapa.mjs';
import { crearRutasOficina } from '../oficina/rutas.mjs';
import { crearAcciones } from '../anuncios/acciones.mjs';
import { armarVista } from '../anuncios/modelo.mjs';

const NOW = new Date('2026-10-09T10:00:00');
const DEPTS = { emails: { name: 'Emails' }, sales: { name: 'Ventas' }, marketing: { name: 'Marketing' }, ops: { name: 'Operaciones' }, fin: { name: 'Finanzas' }, delivery: { name: 'Entregas' }, brain: { name: 'Cerebro' } };
const AGENTS = [{ id: 'mia', department: 'marketing', lead: true, name: 'MIA' }, { id: 'rex', department: 'sales', lead: true, name: 'REX' }, { id: 'cobra', department: 'fin', lead: true, name: 'COBRA' }];
const ctx = (o = {}) => ({ depts: DEPTS, agents: AGENTS, routineDepts: ['fin', 'marketing', 'sales'], now: NOW.getTime(), piezaHas: id => id === 'p-1',
  routines: [{ id: 'cobros', title: 'Cobros', when: { kind: 'weekly', days: [1], at: '09:00' }, nextAt: new Date('2026-10-12T09:00').getTime(), text: 'Lista los cobros', needsOk: true }, { id: 'parada', title: 'Parada', paused: true, when: { kind: 'daily', at: '08:00' } }],
  tasks: [{ id: 'ag1', state: 'scheduled', title: 'Post', agent: 'mia', dueAt: NOW.getTime() + 864e5 }, { id: 'mio1', state: 'next', title: 'Llamar a Juan', person: 'Tú', limite: '2026-10-10' }, { id: 'per1', state: 'next', title: 'Visitar', person: 'Ana' }, { id: 'hecha1', state: 'done', title: 'Informe', agent: 'cobra', error: true }, { id: 'mio2', state: 'done', title: 'Firmar', person: 'Tú' }], ...o });

test('las tareas del dueño no se mueven ni se cancelan como si fueran de un agente; se cambian por su fecha límite, se delegan o se marcan hechas', () => {
  const r = sub.parseOps([
    { type: 'tarea_mover', id: 'mio1', at: '2026-10-11T10:00' }, { type: 'tarea_cancelar', id: 'mio1' }, { type: 'tarea_cancelar', id: 'per1' },
    { type: 'tarea_editar', id: 'mio1', limite: '2026-10-14T16:00', prioridad: 'alta' }, { type: 'mia_delegar', id: 'mio1', dept: 'sales', nota: 'Llámalo tú' }, { type: 'mia_hecha', id: 'mio1' },
    { type: 'mia_hecha', id: 'ag1' }, { type: 'mia_hecha', id: 'mio2' }, { type: 'mia_delegar', id: 'mio1', dept: 'brain' }, { type: 'tarea_mover', id: 'ag1', at: '2026-10-11T10:00' }], ctx());
  assert.deepEqual(r.ops.map(o => o.type), ['tarea_editar', 'mia_delegar', 'mia_hecha', 'tarea_mover']);
  assert.equal(r.ops[0].mia, true); assert.equal(r.ops[0].limite, '2026-10-14T16:00'); assert.deepEqual(r.ops[0].antes, { prioridad: 'media', limite: '2026-10-10' }, 'lo de antes, para deshacer');
  assert.equal(r.ops[1].dept, 'sales'); assert.equal(r.ops[1].agent, null);
  const por = Object.fromEntries(r.motivos.map((m, i) => [`${m.type}#${i}`, m.why]));
  assert.match(por['tarea_mover#0'], /es del dueño: se mueve cambiando su fecha límite/);
  assert.match(por['tarea_cancelar#1'], /es del dueño: solo él la quita/);
  assert.match(por['tarea_cancelar#2'], /la tiene Ana/);
  assert.match(por['mia_hecha#3'], /no es del dueño/); assert.match(por['mia_hecha#4'], /ya estaba hecha/);
  assert.equal(r.dropped.length, 6, 'dropped sigue siendo la lista de tipos (compatibilidad)');
});

test('las rutinas enteras: pausar, reanudar, cambiar el horario o el pedido, correr ahora — y nada sobre una rutina que no existe', () => {
  const r = sub.parseOps([
    { type: 'rutina_pausar', id: 'cobros' }, { type: 'rutina_pausar', id: 'parada' }, { type: 'rutina_reanudar', id: 'parada' }, { type: 'rutina_reanudar', id: 'cobros' },
    { type: 'rutina_editar', id: 'cobros', when: { kind: 'monthly', day: -1, at: '17:00' }, needsOk: false }, { type: 'rutina_editar', id: 'cobros', when: { kind: 'monthly', at: '17:00' } }, { type: 'rutina_editar', id: 'cobros' },
    { type: 'rutina_ahora', id: 'cobros' }, { type: 'rutina_ahora', id: 'nada' }], ctx());
  assert.deepEqual(r.ops.map(o => o.type), ['rutina_pausar', 'rutina_reanudar', 'rutina_editar', 'rutina_ahora']);
  const ed = r.ops[2]; assert.deepEqual(ed.when, { kind: 'monthly', at: '17:00', day: -1 }); assert.equal(ed.needsOk, undefined, 'Dimitri solo puede ENCENDER el OK; apagarlo es del dueño en la tarjeta');
  assert.deepEqual(ed.antes.when, { kind: 'weekly', days: [1], at: '09:00' });
  assert.deepEqual(r.motivos.map(m => m.why), ['ya estaba pausada', 'no estaba pausada', 'el horario no está completo', 'no dice qué cambiar', 'esa rutina no existe']);
  const dueno = sub.parseOps([{ type: 'rutina_editar', id: 'cobros', needsOk: false }], { ...ctx(), owner: true });
  assert.equal(dueno.ops[0].needsOk, false, 'el dueño, en su tarjeta, sí puede quitar el OK');
});

test('repetir lo que falló, llenar la semana y piezas en las nueve redes', () => {
  const r = sub.parseOps([{ type: 'tarea_repetir', id: 'hecha1' }, { type: 'tarea_repetir', id: 'ag1' }, { type: 'tarea_repetir', id: 'mio2' },
    { type: 'contenido_llenar', dias: 40, redes: ['instagram', 'orkut'], pide: 'Que sean reels' }, { type: 'pieza_crear', titulo: 'Hola', redes: ['linkedin', 'x'], texto: 'Hola' }], ctx());
  assert.deepEqual(r.ops.map(o => o.type), ['tarea_repetir', 'contenido_llenar', 'pieza_crear']);
  assert.equal(r.ops[0].fallo, true); assert.equal(r.ops[1].dias, 14, 'como mucho 14 días'); assert.deepEqual(r.ops[1].redes, ['instagram']);
  assert.deepEqual(r.ops[2].redes, ['linkedin', 'x']);
  assert.match(sub.motivosText(r.motivos), /No incluyo 2 cambios que pensé: repetir una tarea — todavía no terminó; repetir una tarea — es de una persona/);
});

test('aprobar, enviar, publicar, pagar o borrar no existe en la lista: ni Dimitri ni una IA conectada lo pueden pedir', () => {
  const malos = ['aprobar_pieza', 'pieza_aprobar', 'publicar', 'enviar_correo', 'pagar', 'rutina_borrar', 'tarea_borrar', 'aprobar_tarea'];
  const r = sub.parseOps(malos.map(type => ({ type, id: 'p-1' })), ctx());
  assert.equal(r.ops.length, 0); assert.deepEqual(r.dropped, malos);
  for (const t of sub.OPS) assert.doesNotMatch(t, /aprob|envi|public|pag[oa]|borr|elimin|delete|send|approve|publish|pay/i, `«${t}» no puede sonar a una acción de fuera`);
});

test('cada cambio de la lista tiene su texto en la tarjeta, su línea en el prompt de Dimitri y sus campos para el asistente', () => {
  const p = sub.systemPrompt({ business: 'PanaClaw', depts: DEPTS, agents: AGENTS, skillsOf: () => [], routineDepts: ['fin'], status: '', now: NOW });
  for (const t of sub.OPS) {
    assert.ok(p.includes(`"type":"${t}"`), `el prompt describe ${t}`);
    assert.ok(ACCIONES[t], `oficina/rutas.mjs → ACCIONES describe ${t}`);
    assert.ok(opLabel({ type: t, title: 'X', titulo: 'X', id: 'x', when: { kind: 'daily', at: '09:00' }, at: NOW.getTime(), dept: 'fin', redes: ['instagram'], prioridad: 'alta' }, { deptName: k => k }), `la tarjeta dice qué hace ${t}`);
  }
  assert.ok(p.includes(MAPA), 'Dimitri conoce el mapa de la oficina');
  assert.match(REGLAS_ASISTENTE, /Aprobar, enviar, publicar, pagar ni borrar/);
});

test('la rutina mensual se lee en palabras y su tarjeta no la convierte en semanal (sin botones de días)', () => {
  assert.equal(whenWords({ kind: 'monthly', day: 15, at: '09:00' }), 'el día 15 de cada mes a las 09:00');
  assert.equal(whenWords({ kind: 'monthly', day: -1, at: '18:00' }), 'el último día de cada mes a las 18:00');
  assert.equal(whenWords({ kind: 'monthly', nth: 2, weekday: 2, at: '09:00', count: 6 }), 'el segundo martes de cada mes a las 09:00, 6 veces');
  const m = { id: 'm1', ops: [{ k: 0, type: 'rutina_crear', state: 'proposed', dept: 'fin', title: 'Cierre', text: 'Cierre', when: { kind: 'monthly', day: -1, at: '18:00' }, needsOk: true }] };
  const h = opsHTML(m, { esc: s => String(s), deptName: k => k });
  assert.doesNotMatch(h, /so-day/); assert.match(h, /el último día de cada mes/);
  const w = opsHTML({ ...m, ops: [{ ...m.ops[0], when: { kind: 'weekly', days: [1], at: '09:00' } }] }, { esc: s => String(s), deptName: k => k });
  assert.match(w, /so-day/);
});

test('el JSON de la respuesta se lee aunque el modelo piense en voz alta antes, ponga un ejemplo o lo meta en un bloque de código', () => {
  const ok = JSON.stringify({ mode: 'plan', reply: 'Hecho', ops: [{ type: 'rutina_pausar', id: 'cobros' }] });
  for (const raw of [ok, '```json\n' + ok + '\n```', 'Voy a pensarlo: el dueño quiere {pausar}. ' + ok, 'Ejemplo: {"type":"x"}\nRespuesta: ' + ok + '\nListo.', 'Ejemplo {"a":1} ' + ok + ' y otro {"b":2}']) {
    const p = sub.parsePlan(raw, { depts: DEPTS, agents: AGENTS, now: NOW.getTime() });
    assert.equal(p.mode, 'plan', raw.slice(0, 40)); assert.equal(p.reply, 'Hecho'); assert.equal(p.ops.length, 1); assert.ok(!p.bad && !p.cut);
  }
  const conComillas = sub.pickJSON('nota: {"mode":"charla","reply":"dice \\"}\\" y sigue"}'); assert.equal(conComillas.j.reply, 'dice "}" y sigue');
  const cortada = sub.parsePlan('Pienso… {"mode":"charla","reply":"Esto se cor', { depts: DEPTS, agents: AGENTS }); assert.equal(cortada.cut, true); assert.equal(cortada.reply, 'Esto se cor');
  assert.equal(sub.parsePlan('Solo texto, sin JSON.', { depts: DEPTS, agents: AGENTS }).reply, 'Solo texto, sin JSON.');
});

test('Dimitri ve cómo sale lo publicado y el calendario de tareas en palabras, con ids', () => {
  const e = { modo: 'real', conductor: { id: 'meta', nombre: 'Meta directo', ok: false, motivo: 'falta el permiso instagram_content_publish', cuota: { nuestras: 3, usadas: 12, total: 50 } }, cuenta: { espera: 2, entregando: 0, en_red: 1, fallo: 1 } };
  const t = sub.publicacionText(e);
  assert.match(t, /modo REAL/); assert.match(t, /NO está listo: falta el permiso/); assert.match(t, /Instagram en 24 h: 12\/50 según Meta/); assert.match(t, /FALLARON 1/);
  assert.equal(sub.publicacionText(null), '');
  const c = sub.calendarioText({ desde: '2026-10-09', hasta: '2026-10-15', tareas: [{ id: 'ag1', title: 'Post', agent: 'mia', state: 'scheduled', dueAt: new Date('2026-10-10T09:00').getTime() }], rutinas: [{ at: new Date('2026-10-12T09:00').getTime(), id: 'cobros', title: 'Cobros', agent: 'cobra', skip: true }], mias: [{ id: 'mio1', title: 'Llamar a Juan', limite: '2026-10-10T16:00', state: 'next' }], piezas: [], name: id => id.toUpperCase() });
  assert.match(c, /«Post» \(MIA, scheduled, id ag1\)/); assert.match(c, /«Cobros» \(COBRA, rutina cobros, SALTADA\)/); assert.match(c, /2026-10-10 16:00 «Llamar a Juan» \(id mio1\)/); assert.match(c, /Contenido: nada\./);
  const s = sub.statusText([...ctx().tasks, { id: 'w1', state: 'waiting', title: 'Correo a Sol', agent: 'mia' }], AGENTS, DEPTS);
  assert.match(s, /Correo a Sol \(MIA, id w1\)/, 'lo que espera el OK lleva su id'); assert.doesNotMatch(s, /Llamar a Juan/, 'lo del dueño va aparte (resumenDueno)'); assert.match(s, /Visitar \(Ana, persona, id per1\)/);
});

// ---------------------------------------------------------------- Fase A2 de Anuncios (9 oct 2026): la regla del dinero

const ANUNCIOS = { C1: { tipo: 'campana', nombre: 'Combo', estado: 'PAUSED', presupuesto: { tipo: 'diario', usd: 15 } }, S1: { tipo: 'conjunto', nombre: 'Panamá', estado: 'ACTIVE', presupuesto: { tipo: null, usd: null } }, A1: { tipo: 'anuncio', nombre: 'Foto', estado: 'ACTIVE', presupuesto: { tipo: null, usd: null } } };

test('A2: las ops de anuncios — el id tiene que estar en lo leído de Meta, el presupuesto en US$ y en el sentido correcto, y lo de gasto va marcado', () => {
  for (const t of sub.OPS_GASTO) assert.ok(sub.OPS.includes(t), t);
  for (const t of Object.keys(sub.ANUNCIO_TIPO)) assert.ok(sub.OPS.includes(t), t);
  assert.deepEqual(sub.OPS_GASTO, ['anuncio_activar', 'anuncio_reanudar', 'anuncio_subir_presupuesto', 'anuncio_relanzar']);
  const r = sub.parseOps([{ type: 'anuncio_activar', id: 'C1' }, { type: 'anuncio_activar', id: 'NADA' }, { type: 'anuncio_bajar_presupuesto', id: 'C1', valor: 20 }, { type: 'anuncio_bajar_presupuesto', id: 'C1', valor: 'US$10' },
    { type: 'anuncio_subir_presupuesto', id: 'A1', valor: 30 }, { type: 'anuncio_subir_presupuesto', id: 'S1', valor: 30 }, { type: 'anuncio_pausar', id: 'C1' }, { type: 'anuncio_pausar', id: 'A1' }, { type: 'anuncio_relanzar', id: 'C1' }], ctx({ anuncio: id => ANUNCIOS[id] || null }));
  assert.deepEqual(r.ops.map(o => o.type), ['anuncio_activar', 'anuncio_bajar_presupuesto', 'anuncio_pausar', 'anuncio_relanzar']);
  assert.equal(r.ops[0].gasto, true); assert.equal(r.ops[0].nombre, 'Combo'); assert.equal(r.ops[1].valor, 10); assert.equal(r.ops[1].gasto, undefined);
  assert.deepEqual(r.motivos.map(m => m.why), ['ese id no está en lo leído de Meta', 'bajar es a menos de US$15', 'un anuncio no tiene presupuesto propio: es el de su conjunto o su campaña', 'eso no tiene presupuesto propio', 'ya está en pausa']);
});

test('A2: ningún tipo de OPS_GASTO se hace sin la confirmación del dueño — el asistente recibe 403 y Dimitri solo la cifra', async () => {
  // el asistente: oficina/rutas.mjs corta antes de validar y antes de runOp
  let corridas = 0, salida = null; const res = {};
  const rutas = crearRutasOficina({ json: (r, code, b) => { salida = { code, b }; }, body: async req => req.cuerpo, sub, opsContext: () => ctx({ anuncio: id => ANUNCIOS[id] || null }), runOp: async () => { corridas++; }, undoOp: async () => ({}), estadoTexto: () => '', calendarioTexto: () => '' });
  for (const type of sub.OPS_GASTO) {
    await rutas({ method: 'POST', cuerpo: { op: { type, id: 'C1', valor: 30 } } }, res, new URL('http://x/api/oficina/accion'));
    assert.equal(salida.code, 403, type); assert.match(salida.b.error, /gasta dinero/);
  }
  assert.equal(corridas, 0, 'runOp nunca corrió');
  await rutas({ method: 'POST', cuerpo: { op: { type: 'anuncio_pausar', id: 'A1' } } }, res, new URL('http://x/api/oficina/accion'));
  assert.equal(salida.code, 200, JSON.stringify(salida.b)); assert.equal(corridas, 1, 'pausar sí');
  assert.match(ACCIONES.anuncio_activar, /NO desde aquí/);

  // Dimitri y el asistente contra anuncios/acciones.mjs: nada que gaste llega a Meta (solo validate_only) sin el token y el dueño
  const hoy = new Date().toISOString().slice(0, 10), fin = new Date(Date.now() + 5 * 864e5).toISOString();
  const guardado = { cuenta: { id: 'act_1', currency: 'USD', timezone_name: 'UTC', account_status: 1 },
    campanas: [{ id: 'C1', name: 'Combo · AO:b1', objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', effective_status: 'PAUSED', daily_budget: '1500', spend_cap: '15000', stop_time: fin },
      { id: 'C2', name: 'Vieja · AO:b1', objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', effective_status: 'PAUSED', daily_budget: '500', start_time: '2026-01-01T00:00:00+0000', stop_time: '2026-01-05T00:00:00+0000' }],
    conjuntos: [{ id: 'S1', campaign_id: 'C1', name: 'PA', status: 'ACTIVE', effective_status: 'CAMPAIGN_PAUSED', learning_stage_info: { status: 'SUCCESS' } }, { id: 'S2', campaign_id: 'C2', name: 'PA', status: 'ACTIVE', effective_status: 'CAMPAIGN_PAUSED', end_time: '2026-01-05T00:00:00+0000' }],
    anuncios: [{ id: 'A1', adset_id: 'S1', campaign_id: 'C1', name: 'Foto', status: 'ACTIVE', effective_status: 'CAMPAIGN_PAUSED' }], creativos: [] };
  const sync = { listo: () => ({ ok: true }), vista: () => armarVista({ guardado, filas: [], rango: '7d', hoy, topes: {}, hayCifras: true }), topes: () => ({ diario: 100, mensual: 3000, campana: 1000 }), hoy: () => hoy, ponerObjeto() {}, anotar() {}, sincronizar: async () => ({ ok: true }) };
  const meta = [];
  const ads = { leer: async id => [...guardado.campanas, ...guardado.conjuntos, ...guardado.anuncios].find(x => x.id === id), cambiar: async (id, campos, o = {}) => { meta.push({ id, campos, validar: !!o.validar }); return { success: true }; }, copiar: async (id, campos, o = {}) => { meta.push({ id, copia: true, validar: !!o.validar }); return { success: true, copied_campaign_id: 'CX' }; } };
  const acc = crearAcciones({ sync, ads });
  const pedidos = { anuncio_activar: { id: 'C1' }, anuncio_reanudar: { id: 'C1' }, anuncio_subir_presupuesto: { id: 'C1', valor: 18 }, anuncio_relanzar: { id: 'C2' } };
  for (const type of sub.OPS_GASTO) {
    const b = { tipo: sub.ANUNCIO_TIPO[type], ...pedidos[type] };
    assert.equal((await acc.accion({ ...b, por: 'asistente' })).status, 403, type + ' del asistente');
    const d = await acc.accion({ ...b, por: 'dimitri' });
    assert.equal(d.status, 200, type + ': ' + JSON.stringify(d.cuerpo)); assert.ok(d.cuerpo.confirmar?.token, type); assert.ok(!d.cuerpo.ok, type + ': Dimitri no lo hace');
    assert.equal((await acc.accion({ ...b, por: 'dimitri', confirmacion: d.cuerpo.confirmar.token })).status, 403, type + ': Dimitri no confirma');
    assert.equal((await acc.accion({ ...b, confirmacion: 'inventado' })).status, 409, type + ': un token inventado no vale');
  }
  assert.ok(meta.length > 0 && meta.every(x => x.validar), 'a Meta solo le llegó validate_only: ' + JSON.stringify(meta.filter(x => !x.validar)));
});
