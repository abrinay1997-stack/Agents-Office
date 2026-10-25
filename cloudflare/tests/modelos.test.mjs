// Ajustes → Modelos: intercambiar modelos a voluntad y por función (25 oct 2026). Cada candado con su par que muerde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, tareaEnDisco, crearFetch, texto, minutos, filas, pagina, todoD1 } from './agentes-ayudas.mjs';
import { validarAjustes, delAjuste, sirvePara, capazDe, CATALOGO, ficha, VACIO } from '../../modelos-core.mjs';
import { elegirModelo } from '../worker/lib/agentes/llm.js';
import { texto as textoIA } from '../worker/lib/ia.js';

const A = (extra = {}) => ({ ...VACIO(), ...extra });

test('núcleo: el catálogo trae los modelos pedidos y cada uno con precio de la tabla de costos', () => {
  const ids = CATALOGO.map(m => m.id);
  for (const id of ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'muse-spark-1.3']) assert.ok(ids.includes(id), id);
  for (const m of CATALOGO) { const f = ficha(m); assert.ok(f.precio && f.precio.in > 0 && f.precio.out > 0, `${m.id} sin precio`); assert.match(f.precio.fuente, /tabla de costos \(\d{4}-\d{2}-\d{2}\)/); }
  assert.equal(CATALOGO.find(m => m.id === 'muse-spark-1.3').herramientas, false);
});

test('núcleo: la validación es estricta (modelo fuera del catálogo, proveedor inventado, campos extra, Meta con herramientas)', () => {
  assert.equal(validarAjustes({ oficina: 'claude-sonnet-5-5' }).ok, true);
  assert.equal(validarAjustes({ oficina: 'gpt-9' }).ok, false);
  assert.equal(validarAjustes({ funciones: { dimitri: 'claude-opus-5-5' } }).ok, true);
  assert.equal(validarAjustes({ funciones: { inventada: 'claude-opus-5-5' } }).ok, false);
  assert.equal(validarAjustes({ departamentos: { marte: 'claude-opus-5-5' } }).ok, false);
  assert.equal(validarAjustes({ endpoint: 'https://malo.example.com' }).ok, false, 'un campo desconocido se rechaza, no se ignora');
  const p = (o) => validarAjustes({ personalizados: [{ id: 'claude-nuevo-6', proveedor: 'anthropic', ...o }] });
  assert.equal(p({}).ok, true);
  assert.equal(p({ proveedor: 'openai' }).ok, false);
  assert.equal(p({ id: 'gpt-6' }).ok, false, 'el id debe empezar por el prefijo del proveedor');
  assert.equal(p({ id: 'claude-x', url: 'https://malo.example.com' }).ok, true, 'una url suelta no entra a ninguna parte (se descarta; el endpoint es fijo)');
  assert.equal(JSON.stringify(p({ url: 'https://malo.example.com', headers: { x: 1 } }).valor).includes('malo.example.com'), false);
  assert.equal(validarAjustes({ personalizados: [{ id: 'muse-nuevo-2', proveedor: 'meta', herramientas: true }] }).ok, false);
  assert.equal(validarAjustes({ personalizados: [{ id: 'claude-sonnet-5-5', proveedor: 'anthropic' }] }).ok, false, 'no se repite uno del catálogo');
  // un personalizado válido se puede asignar
  const r = validarAjustes({ personalizados: [{ id: 'claude-nuevo-6', proveedor: 'anthropic', in: 3, out: 15 }], oficina: 'claude-nuevo-6' });
  assert.equal(r.ok, true); assert.equal(r.valor.oficina, 'claude-nuevo-6');
});

test('núcleo: agente > departamento > función > oficina, y lo que no existe se salta', () => {
  const a = A({ oficina: 'claude-haiku-5-5', funciones: { agentes: 'claude-sonnet-5-5', dimitri: 'claude-opus-5-5' }, departamentos: { emails: 'muse-spark-1.3' }, agentes: { elead: 'claude-fable-5-1' } });
  assert.equal(delAjuste(a, { funcion: 'agentes', agente: 'elead', depto: 'emails' }).id, 'claude-fable-5-1');
  assert.equal(delAjuste(a, { funcion: 'agentes', agente: 'otro', depto: 'emails' }).id, 'muse-spark-1.3');
  assert.equal(delAjuste(a, { funcion: 'agentes', agente: 'otro', depto: 'sales' }).id, 'claude-sonnet-5-5');
  assert.equal(delAjuste(a, { funcion: 'dimitri' }).id, 'claude-opus-5-5');
  assert.equal(delAjuste(a, { funcion: 'redactar' }).id, 'claude-haiku-5-5', 'sin función propia, la oficina');
  assert.equal(delAjuste(A(), { funcion: 'redactar' }), null);
  assert.equal(sirvePara(CATALOGO.find(m => m.id === 'muse-spark-1.3'), { herramientas: true }).ok, false);
  assert.equal(capazDe(A(), { tieneAnthropic: false }), null);
  assert.ok(capazDe(A()).herramientas);
});

test('elegirModelo: tarea > rutina > roster > Ajustes → Modelos > AI_MODELO; Meta se reconoce y dice de dónde salió', () => {
  const m = A({ oficina: 'claude-haiku-5-5', funciones: { dimitri: 'muse-spark-1.3' }, agentes: { elead: 'claude-opus-5-5' } });
  const agente = { id: 'elead', department: 'emails' };
  assert.equal(elegirModelo({ task: { model: 'fable' }, agent: agente, env: {}, modelos: m }).id, 'claude-fable-5-1');
  assert.equal(elegirModelo({ task: { routineModel: 'opus' }, agent: agente, env: {}, modelos: m }).id, 'claude-opus-5');
  assert.equal(elegirModelo({ task: {}, agent: { ...agente, model: 'sonnet' }, env: {}, modelos: m }).id, 'claude-sonnet-5', 'el campo model del roster gana a esta pantalla');
  const x = elegirModelo({ task: {}, agent: agente, env: { AI_MODELO: 'claude-sonnet-5-5' }, modelos: m });
  assert.equal(x.id, 'claude-opus-5-5'); assert.match(x.de, /este agente/);
  assert.equal(elegirModelo({ task: {}, agent: { id: 'otro', department: 'sales' }, env: {}, modelos: m }).id, 'claude-haiku-5-5');
  const d = elegirModelo({ env: {}, modelos: m, funcion: 'dimitri' });
  assert.equal(d.meta, true); assert.equal(d.proveedor, 'meta'); assert.equal(d.caps.herramientas, false);
  assert.equal(elegirModelo({ env: { AI_MODELO: 'claude-sonnet-5-5' }, funcion: 'redactar' }).id, 'claude-sonnet-5-5', 'sin ajustes, todo como antes');
  assert.equal(elegirModelo({ task: {}, agent: agente, env: {} }).id, 'claude-sonnet-5');
});

test('una función de texto usa SU modelo (Meta, con su endpoint fijo y su llave) y deja el costo en el libro', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { META_API_KEY: 'meta-llave-de-prueba' }, conector: false });
  d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('modelos', ?, 1, 'x')").run(JSON.stringify(A({ funciones: { redactar: 'muse-spark-1.3' } })));
  const vistas = [];
  const fetchFn = async (url, init) => { vistas.push({ url: String(url), cab: init.headers, cuerpo: JSON.parse(init.body) }); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hola' }], usage: { input_tokens: 10, output_tokens: 5 }, model: 'muse-spark-1.3' }), { status: 200 }); };
  const r = await textoIA(env, { sistema: 's', usuario: 'u', fetchFn, funcion: 'redactar' });
  assert.equal(r.texto, 'Hola'); assert.equal(vistas[0].url, 'https://api.meta.ai/v1/messages'); assert.equal(vistas[0].cuerpo.model, 'muse-spark-1.3');
  assert.equal(vistas[0].cab.authorization, 'Bearer meta-llave-de-prueba');
  await textoIA(env, { sistema: 's', usuario: 'u', fetchFn, funcion: 'enrutador' }); // sin asignación propia: el de siempre (Anthropic)
  assert.equal(vistas[1].url, 'https://api.anthropic.com/v1/messages');
  const libro = filas(d1, "select tipo, modelo, proveedor from costos order by t");
  assert.deepEqual(libro.map(l => l.tipo), ['redactar', 'enrutador']); assert.equal(libro[0].proveedor, 'meta');
});

test('API: solo un administrador ve o cambia los modelos; el cambio queda en la auditoría; ninguna respuesta lleva una llave', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { META_API_KEY: 'meta-llave-secreta-xyz' }, conector: false });
  const p = await pagina({ d1, env });
  const g = await p.admin('GET', '/api/modelos');
  assert.equal(g.status, 200);
  assert.equal(g.j.proveedores.find(x => x.id === 'anthropic').llavePuesta, true); assert.equal(g.j.proveedores.find(x => x.id === 'meta').llavePuesta, true);
  assert.ok(g.j.catalogo.find(m => m.id === 'muse-spark-1.3').precio.in > 0);
  assert.equal(g.texto.includes('meta-llave-secreta-xyz'), false); assert.equal(g.texto.includes('sk-ant-secreto-de-prueba'), false);
  for (const quien of ['editor', 'lectura']) { assert.equal((await p[quien]('GET', '/api/modelos')).status, 403, quien); assert.equal((await p[quien]('PUT', '/api/modelos', { ajustes: A({ oficina: 'claude-opus-5-5' }) })).status, 403, quien); assert.equal((await p[quien]('POST', '/api/modelos/probar', { modelo: 'claude-opus-5-5' })).status, 403, quien); }
  assert.equal((await p.lectura('GET', '/api/modelos/activos')).status, 200, 'qué modelos hay en uso lo ve cualquiera con sesión');
  const mal = await p.admin('PUT', '/api/modelos', { ajustes: A({ oficina: 'gpt-9' }) });
  assert.equal(mal.status, 422);
  const bien = await p.admin('PUT', '/api/modelos', { ajustes: A({ oficina: 'claude-opus-5-5', funciones: { dimitri: 'muse-spark-1.3' } }) });
  assert.equal(bien.status, 200); assert.ok(bien.j.cambios.some(c => /oficina: sin asignar → claude-opus-5-5/.test(c)));
  const aud = filas(d1, "select * from auditoria where tipo = 'modelos'");
  assert.equal(aud.length, 1); assert.match(aud[0].detalle, /dimitri/);
  const act = await p.lectura('GET', '/api/modelos/activos');
  assert.deepEqual(act.j.activos.map(a => a.id).sort(), ['claude-opus-5-5', 'muse-spark-1.3']);
  for (const t of [bien.texto, act.texto, aud[0].detalle]) assert.equal(/meta-llave-secreta|sk-ant/.test(t), false);
});

test('probar y comparar: una pregunta corta, tiempo, tokens y costo; comparar avisa el costo ANTES y no llama sin confirmar', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { META_API_KEY: 'meta-llave-de-prueba' }, conector: false });
  const llamadas = [];
  env.__pruebas = { fetch: async (url, init) => { const c = JSON.parse(init.body); llamadas.push({ url: String(url), max: c.max_tokens, model: c.model }); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'respuesta de ' + c.model }], usage: { input_tokens: 40, output_tokens: 20 }, model: c.model }), { status: 200 }); } };
  const p = await pagina({ d1, env });
  const r = await p.admin('POST', '/api/modelos/probar', { modelo: 'claude-sonnet-5-5' });
  assert.equal(r.status, 200); assert.match(r.j.texto, /claude-sonnet-5-5/); assert.ok(r.j.usd > 0); assert.equal(r.j.tokens.salida, 20); assert.ok(r.j.ms >= 0);
  assert.ok(llamadas[0].max <= 1000);
  assert.equal(filas(d1, "select count(*) n from costos where tipo = 'prueba'")[0].n, 1);
  assert.equal((await p.admin('POST', '/api/modelos/probar', { modelo: 'gpt-9' })).status, 502);
  llamadas.length = 0;
  const sin = await p.admin('POST', '/api/modelos/comparar', { a: 'claude-opus-5-5', b: 'muse-spark-1.3' });
  assert.equal(sin.j.confirmar, true); assert.ok(sin.j.costoMaximo > 0); assert.equal(llamadas.length, 0, 'sin confirmar no se gasta nada');
  const con = await p.admin('POST', '/api/modelos/comparar', { a: 'claude-opus-5-5', b: 'muse-spark-1.3', confirmar: true });
  assert.equal(llamadas.length, 2); assert.equal(llamadas.find(l => l.model === 'muse-spark-1.3').url, 'https://api.meta.ai/v1/messages');
  assert.match(con.j.a.texto, /opus/); assert.match(con.j.b.texto, /muse/);
  assert.equal((await p.admin('POST', '/api/modelos/comparar', { a: 'claude-opus-5-5', b: 'claude-opus-5-5', confirmar: true })).status, 422);
  // sin la llave del proveedor, se dice cuál falta
  const { d1: d2, env: e2 } = await oficina({ conector: false }); e2.__pruebas = env.__pruebas;
  const p2 = await pagina({ d1: d2, env: e2 });
  const f = await p2.admin('POST', '/api/modelos/probar', { modelo: 'muse-spark-1.3' });
  assert.equal(f.status, 502); assert.match(f.j.error, /META_API_KEY/);
});

test('un agente con Muse y conectores NO falla en silencio: cae a un modelo capaz y la entrega lo dice; sin Anthropic se rechaza con motivo', { skip: SALTAR }, async () => {
  const GRANDE = { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' };
  const { d1, env } = await oficina({ env: GRANDE, ajustes: null });
  d1._db.prepare("insert into docs (clave, json, version, actualizado) values ('modelos', ?, 1, 'x')").run(JSON.stringify(A({ agentes: { elead: 'muse-spark-1.3' } })));
  const t = await tarea(env);
  const MCP = () => ({ search_threads: { salida: 'Hilo con Ana.' }, create_draft: { salida: 'borrador' }, send_email: { salida: 'enviado' } });
  const f = crearFetch({ herramientasMcp: MCP(), guion: [texto('Listo.\nFuentes: nada.')] });
  await minutos(env, f.fetchFn);
  const d = await tareaEnDisco(d1, t.id);
  assert.equal(d.state, 'done'); assert.equal(f.registro.anthropic.length > 0, true, 'se llamó a un modelo de Claude capaz');
  assert.match(d.result, /no usa herramientas: la hizo claude-sonnet-5-5/);
  // el control: un agente CON Muse y SIN conectores no cae: redacta con Meta y lo anota
  const { d1: d3, env: e3 } = await oficina({ env: { ...GRANDE, META_API_KEY: 'meta-llave-de-prueba' }, conector: false });
  d3._db.prepare("insert into docs (clave, json, version, actualizado) values ('modelos', ?, 1, 'x')").run(JSON.stringify(A({ agentes: { elead: 'muse-spark-1.3' } })));
  const t3 = await tarea(e3);
  const vistas = [];
  const ff = async (url, init) => { vistas.push({ url: String(url), cuerpo: JSON.parse(init.body) }); return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hecho con Muse.\nFuentes: nada.' }], usage: { input_tokens: 5, output_tokens: 5 }, model: 'muse-spark-1.3' }), { status: 200 }); };
  await minutos(e3, ff);
  const d3d = await tareaEnDisco(d3, t3.id);
  assert.equal(d3d.state, 'done'); assert.equal(vistas[0].url, 'https://api.meta.ai/v1/messages'); assert.equal(vistas[0].cuerpo.tools, undefined);
  assert.match(d3d.result, /Hecho con Muse/); assert.match(d3d.result, /no usa herramientas: esta tarea se redactó sin ellas/);
  // sin llave de Anthropic no hay a dónde caer: la tarea no corre con Muse a medias
  const { d1: d4, env: e4 } = await oficina({ env: { ...GRANDE, META_API_KEY: 'meta-llave-de-prueba' } });
  delete e4.ANTHROPIC_API_KEY;
  d4._db.prepare("insert into docs (clave, json, version, actualizado) values ('modelos', ?, 1, 'x')").run(JSON.stringify(A({ agentes: { elead: 'muse-spark-1.3' } })));
  const t4 = await tarea(e4); const f4 = crearFetch({ herramientasMcp: MCP() }); await minutos(e4, f4.fetchFn);
  const d4d = await tareaEnDisco(d4, t4.id);
  assert.equal(d4d.error, true, 'la tarea falla con motivo, no se hace a medias'); assert.equal(f4.registro.otros.some(u => u.includes('api.meta.ai')) || f4.registro.anthropic.length > 0, false, 'Muse no recibió una tarea que necesita herramientas');
  assert.match(String(d4d.lastError || d4d.result || ''), /no usa herramientas|Ajustes → Modelos/);
});

/* ---------- el medidor de la esquina en la nube ---------- */
import { usage } from '../../costs-core.mjs';
test('medidor: gasto de hoy y del mes en la zona de la oficina, ejecuciones y porcentaje solo con tope; el borde del día y del mes', () => {
  const ahora = Date.parse('2026-10-25T20:00:00Z');
  const L = (t, usd, task = 't1') => ({ t, usd, task, in: 100, out: 50, cacheRead: 0, cacheWrite: 0 });
  const lineas = [L(Date.parse('2026-10-25T15:00:00Z'), 0.42), L(Date.parse('2026-10-24T12:00:00Z'), 1.5), L(Date.parse('2026-09-30T12:00:00Z'), 99), L(Date.parse('2026-10-25T16:00:00Z'), 0.1, null)];
  const u = usage(lineas, { monthlyBudget: 30 }, ahora);
  assert.equal(u.today.usd, 0.52); assert.equal(u.today.runs, 1); assert.equal(u.today.tokens, 300);
  assert.equal(u.month.usd, 2.02); assert.equal(u.month.percent, 7); assert.equal(u.month.budget, 30);
  assert.equal(usage(lineas, {}, ahora).month.percent, null);
  assert.equal(usage([], { monthlyBudget: 30 }, ahora).today.usd, 0);
});

test('/api/usage: source «nube», con el porcentaje del tope del mes cuando lo hay (y sin la palabra ventana)', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ ajustes: { costs: { monthlyBudget: 10 } }, conector: false });
  d1._db.prepare("insert into costos (t, tarea, agente, dept, tipo, modelo, proveedor, tin, tout, cache_read, cache_write, usd, fuente) values (?,?,?,?,?,?,?,?,?,?,?,?,?)").run(Date.now() - 1000, 'x', 'elead', 'emails', 'task', 'claude-sonnet-5', 'anthropic', 1000, 500, 0, 0, 2.5, 'tabla');
  const p = await pagina({ d1, env });
  const u = (await p.admin('GET', '/api/usage')).j;
  assert.equal(u.source, 'nube'); assert.equal(u.month.budget, 10); assert.equal(u.month.percent, 25); assert.equal(u.today.usd, 2.5); assert.equal(u.today.runs, 1);
});
