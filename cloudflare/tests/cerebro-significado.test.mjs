// Cerebro en la nube — buscar por SIGNIFICADO (issue #45, idea 2). Con las 59 notas de fábrica y un modelo de mentira (`env.__pruebas.embedder`).
// Ojo con lo que NO prueban estas pruebas: la CALIDAD de un modelo de verdad. El modelo de mentira junta a mano unos grupos de palabras que significan lo mismo (guarda/borran/conservan…); sirve para demostrar que el
// significado entra al ranking, que se indexa bien, que se apaga solo si falla y que nada se enciende sin medir. Cuánto ayuda el modelo real lo dice el botón «Medir» con las mismas preguntas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { mundoDelCerebro, crearNota, modelo, vecDe, DIM } from './cerebro-ayudas.mjs';
import * as knowledge from '../../knowledge.mjs';
import { cuantizar, descuantizar, embedder, pasajesDe, estadoSignificado, indexarLote, semanticaPara, vecinasPorSignificado, medirSignificado, activarSignificado, LOTE, MAX_PASAJES, MIN_COBERTURA } from '../worker/lib/significado.js';
import { notasRelevantes } from '../worker/lib/agentes/contexto.js';
import { guardarDoc, leerDoc } from '../worker/lib/almacen.js';

const NOTAS = (m) => m.semilla.notas.map((n) => ({ nombre: n.nombre, texto: n.texto, oficina: 0 }));
async function indexarTodo(m) { let r, llamadas = 0; do { r = await indexarLote({ db: m.d1, env: m.env }); assert.ok(r.ok, JSON.stringify(r)); llamadas++; } while (r.faltan && llamadas < 80); return llamadas; }

/* ---------- lo puro ---------- */
test('cuantizar: ida y vuelta casi exacta, el coseno no cambia, el signo se conserva', () => {
  const v = Array.from({ length: 64 }, (_, i) => Math.sin(i) * (i % 5 ? 1 : -2.5)), q = cuantizar(v), u = descuantizar(q.v);
  assert.equal(u.length, 64); assert.ok(u instanceof Int8Array); assert.equal(Math.sign(u[3]), Math.sign(v[3]));
  const coseno = (a, b) => { let x = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { x += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return x / Math.sqrt(na * nb); };
  assert.ok(coseno(v, u) > 0.999, 'cuantizar a 8 bits casi no mueve el ángulo: ' + coseno(v, u));
  assert.equal(cuantizar([0, 0, 0]).escala, 1, 'un vector de ceros no divide por cero');
});

test('embedder: el de las pruebas manda; luego Workers AI (si da vectores de verdad); luego los secretos; sin nada, null', async () => {
  const p = modelo(); assert.equal(embedder({ __pruebas: { embedder: p } }), p);
  const ai = embedder({ AI: { run: async (m, e) => ({ data: e.text.map(() => [0.1, 0.2]) }) } }); assert.equal(ai.id, 'cf-bge-m3'); assert.deepEqual(await ai.embed(['a', 'b']), [[0.1, 0.2], [0.1, 0.2]]);
  await assert.rejects(embedder({ AI: { run: async () => ({ data: [[1]] }) } }).embed(['a', 'b']), /no devolvió los vectores/);
  await assert.rejects(embedder({ AI: { run: async () => ({}) } }).embed(['a']), /no devolvió/);
  const g = embedder({ GEMINI_API_KEY: 'x' }); assert.equal(g.proveedor, 'google'); assert.match(g.id, /gemini/);
  assert.equal(embedder({}), null); assert.equal(embedder(null), null);
});

test('cada modelo de significado tiene precio por defecto: no se anota «sin-precio» y fuera del presupuesto', async () => {
  const { priceFor, line } = await import('../../costs-core.mjs');
  const ids = [embedder({ AI: { run() {} } }).id, embedder({ OPENAI_API_KEY: 'x' }).id, embedder({ VOYAGE_API_KEY: 'x' }).id, embedder({ GEMINI_API_KEY: 'x' }).id]; // secrets-ok
  assert.deepEqual(ids, ['cf-bge-m3', 'openai-text-embedding-3-small', 'voyage-voyage-3-5-lite', 'gemini-text-embedding-004']);
  for (const id of ids) { assert.ok(priceFor(id), `${id} sin precio`); assert.equal(line({ modelId: id, provider: 'x', usage: { input_tokens: 1000, output_tokens: 0 } }).source, 'tabla'); }
  assert.ok(line({ modelId: 'cf-bge-m3', provider: 'cloudflare', usage: { input_tokens: 1_000_000, output_tokens: 0 } }).usd > 0, 'un millón de tokens de bge-m3 cuesta algo');
  assert.equal(priceFor('claude-sonnet-5-5').provider, 'anthropic', 'los precios nuevos no pisan a los de siempre');
});

test('knowledge.search híbrido: un pasaje sin vector (una entrega nueva) no queda enterrado, y uno con vector parecido sube', () => {
  const notas = new Map([['con-vector', 'La retención de chats es de noventa días.'], ['sin-vector', 'Cuánto cuesta la tienda en línea: mil doscientos dólares.'], ['otra', 'Hablamos de colores y tipografías de la marca.']]);
  const ix = knowledge.buildIndex(notas), vectors = {};
  for (const d of ix.docs) if (d.note !== 'sin-vector') vectors[d.hash] = descuantizar(cuantizar(vecDe(d.text)).v);
  const q = 'cuánto cuesta la tienda en línea', r = knowledge.search(ix, q, { n: 3, vectors, queryVec: vecDe(q) });
  assert.equal(r[0].note, 'sin-vector', 'la que no tiene vector sigue ganando por sus palabras');
  const q2 = 'cuánto tiempo conservamos los chats', r2 = knowledge.search(ix, q2, { n: 3, vectors, queryVec: vecDe(q2) });
  assert.equal(r2[0].note, 'con-vector', 'por significado (conservamos ~ retención) aunque no comparta palabras');
});

/* ---------- indexar y usar ---------- */
test('estado e indexar: sin modelo se explica; con modelo se indexa por lotes, una vez, sin repetir ni gastar de más, y queda en el libro', { skip: SALTAR }, async () => {
  const sin = await mundoDelCerebro();
  assert.deepEqual([(await estadoSignificado({ db: sin.d1, env: sin.env })).hayModelo, (await indexarLote({ db: sin.d1, env: sin.env })).estado], [false, 409]);
  const reg = [], m = await mundoDelCerebro({ embedder: modelo(reg) });
  const e0 = await estadoSignificado({ db: m.d1, env: m.env }); assert.equal(e0.hayModelo, true); assert.equal(e0.conVector, 0); assert.ok(e0.pasajes > 59 && e0.pasajes <= MAX_PASAJES, String(e0.pasajes)); assert.equal(e0.activo, false);
  const llamadas = await indexarTodo(m); assert.equal(llamadas, Math.ceil(e0.pasajes / LOTE) + 0, 'un lote tras otro hasta terminar'); assert.ok(reg.every((n) => n <= LOTE));
  const e1 = await estadoSignificado({ db: m.d1, env: m.env }); assert.equal(e1.faltan, 0); assert.equal(e1.cobertura, 1);
  const antes = reg.length; assert.deepEqual(await indexarLote({ db: m.d1, env: m.env }), { ok: true, hechos: 0, faltan: 0, borrados: 0 }); assert.equal(reg.length, antes, 'si no falta nada, no se llama al modelo');
  assert.ok(m.d1._db.prepare("select count(*) n from costos where tipo = 'embeddings'").get().n >= llamadas, 'cada llamada queda en el libro');
  // editar una nota: solo se vuelve a embeber lo que cambió; borrar otra: sus vectores se van
  const nota = (await m.p.admin('GET', '/api/note?id=voice')).j; // una nota de fábrica no se edita aquí: se crea una propia
  await crearNota(m, 'Mía', 'Primer párrafo de mi nota con varias palabras para que sea un pasaje.\n\nSegundo párrafo, otro tema distinto.');
  const r1 = await indexarLote({ db: m.d1, env: m.env }); assert.equal(r1.hechos, 1, JSON.stringify(r1)); assert.equal(r1.borrados, 0);
  m.d1._db.prepare("update notas set texto = texto || '\n\nTercer párrafo nuevo sobre colores.' where nombre = 'Mía'").run();
  const r2 = await indexarLote({ db: m.d1, env: m.env }); assert.deepEqual([r2.hechos, r2.borrados], [1, 1], 'el pasaje cambió: nace su vector nuevo y se va el viejo');
  m.d1._db.prepare("delete from notas where nombre = 'Mía'").run();
  const r3 = await indexarLote({ db: m.d1, env: m.env }); assert.deepEqual([r3.hechos, r3.borrados], [0, 1], JSON.stringify(r3));
  assert.equal(m.d1._db.prepare("select count(*) n from notas_vectores where nota = 'Mía'").get().n, 0);
  assert.ok(nota, 'la nota de fábrica se leyó, no se tocó');
});

test('el modelo falla: se dice en palabras, no se guarda nada a medias y la búsqueda sigue por palabras', { skip: SALTAR }, async () => {
  const roto = { id: 'roto', nombre: 'Roto', proveedor: 'prueba', embed: async () => { throw new Error('saturado'); } };
  const m = await mundoDelCerebro({ embedder: roto });
  const r = await indexarLote({ db: m.d1, env: m.env }); assert.equal(r.estado, 502); assert.match(r.error, /no contestó: saturado/);
  assert.equal(m.d1._db.prepare('select count(*) n from notas_vectores').get().n, 0);
  const cuenta = { id: 'corto', nombre: 'Corto', proveedor: 'prueba', embed: async (t) => t.slice(1).map(vecDe) };
  m.env.__pruebas.embedder = cuenta; assert.match((await indexarLote({ db: m.d1, env: m.env })).error, /otra cantidad/);
});

test('semanticaPara: apagado, sin modelo, con pocos vectores o con el modelo caído no devuelve nada ni lanza; listo y encendido devuelve los vectores y el de la pregunta', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro({ embedder: modelo() }), q = 'cuánto tiempo guardan las conversaciones';
  assert.equal(await semanticaPara({ db: m.d1, env: m.env, texto: q }), null, 'apagado');
  await indexarTodo(m);
  assert.equal(await semanticaPara({ db: m.d1, env: m.env, texto: q }), null, 'indexado pero apagado: nada cambia hasta que lo enciendes');
  const forzado = await semanticaPara({ db: m.d1, env: m.env, texto: q, forzar: true }); assert.ok(forzado && forzado.queryVec.length === DIM && Object.keys(forzado.vectors).length > 50);
  assert.deepEqual(await activarSignificado({ db: m.d1, env: m.env, activo: true }), { ok: true, activo: true });
  assert.ok(await semanticaPara({ db: m.d1, env: m.env, texto: q }), 'encendido y listo');
  assert.equal(await semanticaPara({ db: m.d1, env: { ...m.env, __pruebas: { embedder: null } }, texto: q }), null, 'sin modelo');
  assert.equal(await semanticaPara({ db: m.d1, env: null, texto: q }), null, 'sin env');
  m.env.__pruebas.embedder = { id: 'mentira-1', nombre: 'caído', proveedor: 'p', embed: async () => { throw new Error('caído'); } };
  assert.equal(await semanticaPara({ db: m.d1, env: m.env, texto: q }), null, 'el modelo cae: se busca por palabras, sin error');
  m.env.__pruebas.embedder = modelo(); m.d1._db.prepare("delete from notas_vectores where rowid % 2 = 0").run();
  assert.equal(await semanticaPara({ db: m.d1, env: m.env, texto: q }), null, `con menos del ${MIN_COBERTURA * 100} % de pasajes con vector no se usa`);
});

test('los agentes encuentran por significado lo que las palabras no encuentran, solo cuando está encendido', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro({ embedder: modelo() }), mapa = new Map(NOTAS(m).map((n) => [n.nombre, n.texto])), mem = { v: 1, notes: {}, edges: {}, applied: {} };
  const q = '¿Cuánto tiempo guarda eBot las conversaciones de los clientes?';
  const solo = notasRelevantes(mapa, null, q, mem, 4); assert.ok(!solo.slice(0, 1).includes('privacidad-normas'), 'solo por palabras no era la primera');
  await indexarTodo(m); await activarSignificado({ db: m.d1, env: m.env, activo: true });
  const sem = await semanticaPara({ db: m.d1, env: m.env, texto: q });
  const con = notasRelevantes(mapa, null, q, mem, 4, sem); assert.ok(con.includes('privacidad-normas'), 'con significado sí: ' + con.join(', '));
});

test('«Actualizar conexiones» suma a las candidatas las notas cercanas por significado: parecidas() las mete aunque las palabras no coincidan, sin repetir ni salirse del tope', async () => {
  const { parecidas } = await import('../worker/lib/conexiones.js');
  const textos = new Map(Array.from({ length: 40 }, (_, i) => ['tema' + i, `Nota número ${i} sobre el asunto${i} y su zumbido${i} particular${i}.`])), grupos = new Map([...textos.keys()].map((k) => [k, 'g']));
  const ix = knowledge.buildIndex(textos), nota = { nombre: 'nueva', grupo: 'g', texto: 'Algo totalmente distinto: cuartoblanco.' };
  const sin = parecidas({ nota, ix, textos, grupos, pares: [] }).map((c) => c.nombre);
  const con = parecidas({ nota, ix, textos, grupos, pares: [[ 'nueva', 'tema7' ]], semanticas: ['tema30', 'tema30', 'nueva', 'index', 'tema7', 'no-existe', ...Array.from({ length: 12 }, (_, i) => 'tema' + i)] }).map((c) => c.nombre);
  assert.ok(!sin.includes('tema30')); assert.ok(con.includes('tema30'), 'entra por significado');
  assert.equal(new Set(con).size, con.length, 'sin repetir'); assert.ok(!con.includes('nueva') && !con.includes('index') && !con.includes('tema7') && !con.includes('no-existe'), 'ni ella misma, ni el índice, ni lo ya enlazado, ni lo que no existe');
  assert.ok(con.length <= 25, 'no pasa del tope de candidatas: ' + con.length);
});

test('«Actualizar conexiones» con el significado encendido: la IA ve la nota cercana por significado; vecinasPorSignificado la pone entre las primeras y respeta las exclusiones', { skip: SALTAR }, async () => {
  const pedidos = [], fetchIA = async (url, init) => { const c = JSON.parse(init.body); pedidos.push(typeof c.messages.at(-1).content === 'string' ? c.messages.at(-1).content : JSON.stringify(c.messages.at(-1).content)); return new Response(JSON.stringify({ id: 'x', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: '{"enlaces":[]}' }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 10 } }), { status: 200 }); };
  const m = await mundoDelCerebro({ embedder: modelo(), fetchIA });
  await crearNota(m, 'Conservar los chats', 'Conservamos los chats un trimestre y después se borran.');
  assert.deepEqual(await vecinasPorSignificado({ db: m.d1, env: m.env, texto: 'Conservamos los chats un trimestre' }), [], 'apagado: nada');
  await indexarTodo(m); await activarSignificado({ db: m.d1, env: m.env, activo: true });
  const v = await vecinasPorSignificado({ db: m.d1, env: m.env, texto: 'Conservamos los chats un trimestre y después se borran', excluir: new Set(['Conservar los chats']) }); // «Actualizar conexiones» siempre excluye a la propia nota
  assert.ok(v.slice(0, 3).includes('privacidad-normas'), 'entre las 3 más cercanas: ' + v.join(', ')); assert.ok(v.length <= 8);
  assert.ok(!(await vecinasPorSignificado({ db: m.d1, env: m.env, texto: 'Conservamos los chats un trimestre', excluir: new Set(['privacidad-normas', 'Conservar los chats']) })).includes('privacidad-normas'));
  await m.p.admin('POST', '/api/brain/actualizar', { paso: 'proponer', notas: ['Conservar los chats'] });
  assert.match(pedidos[0], /privacidad-normas/, 'la IA la ve entre las candidatas');
});

/* ---------- medir, activar y el Worker entero ---------- */
test('medir: palabras frente a significado con las preguntas de prueba; el significado de mentira arregla las que las palabras fallan y no rompe las que ya acertaban', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro({ embedder: modelo() });
  assert.match((await medirSignificado({ db: m.d1, env: m.env })).error, /Primero indexa/);
  await indexarTodo(m);
  const r = await medirSignificado({ db: m.d1, env: m.env });
  assert.equal(r.ok, true); assert.equal(r.n, 54); assert.ok(r.palabras.recall[5] >= 0.9, 'la línea base de palabras: ' + r.palabras.recall[5]);
  assert.ok(r.significado.recall[5] > r.palabras.recall[5], `el significado (de mentira) mejora: ${r.palabras.recall[5]} → ${r.significado.recall[5]}`);
  assert.ok(r.mejoran.length >= 2 && r.empeoran.length <= 3, `mejoran ${r.mejoran} / empeoran ${r.empeoran}`);
  const guardado = (await leerDoc(m.d1, 'cerebro.significado')).valor; assert.equal(guardado.medido.n, 54); assert.equal(guardado.activo, false, 'medir no enciende nada');
  m.d1._db.prepare("delete from notas where nombre not in ('voice', 'index', 'CLAUDE', 'contacto', 'cancelacion')").run();
  assert.match((await medirSignificado({ db: m.d1, env: m.env })).error, /no se puede medir/, 'si faltan casi todas las notas de las preguntas, no inventa un número');
});

test('activar: solo con casi todo indexado, y se puede apagar; el Worker: solo administradores, y el modelo se ve en el estado', { skip: SALTAR }, async () => {
  const m = await mundoDelCerebro({ embedder: modelo() });
  assert.equal((await m.p.admin('GET', '/api/brain/actualizar')).j.significadoHay, true);
  const no = await m.p.admin('POST', '/api/brain/actualizar', { paso: 'significado-activar', activo: true }); assert.equal(no.status, 409); assert.match(no.j.error, /Primero indexa/);
  for (const rol of ['editor', 'lectura']) for (const paso of ['significado', 'significado-indexar', 'significado-medir', 'significado-activar']) assert.equal((await m.p[rol]('POST', '/api/brain/actualizar', { paso })).status, 403, `${rol} ${paso}`);
  const e = (await m.p.admin('POST', '/api/brain/actualizar', { paso: 'significado' })).j; assert.equal(e.modelo.id, 'mentira-1'); assert.ok(e.faltan > 0);
  let r; do { r = (await m.p.admin('POST', '/api/brain/actualizar', { paso: 'significado-indexar' })).j; } while (r.faltan);
  assert.equal(r.significado.cobertura, 1);
  const si = (await m.p.admin('POST', '/api/brain/actualizar', { paso: 'significado-activar', activo: true })).j; assert.equal(si.significado.activo, true);
  const med = (await m.p.admin('POST', '/api/brain/actualizar', { paso: 'significado-medir' })).j; assert.equal(med.ok, true);
  const off = (await m.p.admin('POST', '/api/brain/actualizar', { paso: 'significado-activar', activo: false })).j; assert.equal(off.significado.activo, false); assert.equal(off.significado.medido.n, 54, 'apagar conserva la medición');
  assert.equal((await m.p.admin('POST', '/api/brain/actualizar', { paso: 'significado-activar', activo: 'sí' })).j.significado.activo, false, 'solo un true de verdad enciende');
  const sin = await mundoDelCerebro(); assert.equal((await sin.p.admin('GET', '/api/brain/actualizar')).j.significadoHay, false);
});
