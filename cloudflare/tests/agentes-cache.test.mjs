// COS-01 (29 oct 2026): caché de prompt en los agentes. La marca va al final de lo que no cambia entre vueltas (última herramienta + sistema); ningún mensaje se marca (si no, el prefijo cambiaría
// cada vuelta y se rompería la regla de razonamiento-estable). El libro de costos ya guarda cache_read / cache_write: aquí se comprueba que llegan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, crearFetch, texto, usar, minutos, filas } from './agentes-ayudas.mjs';
import { armarLlamada } from '../worker/lib/agentes/llm.js';
import { cacheStats } from '../../costs-core.mjs';

const hs = [{ alias: 'a', descripcion: 'x', esquema: { type: 'object', properties: {} } }, { alias: 'b', descripcion: 'y', esquema: { type: 'object', properties: {} } }];
const base = { env: { ANTHROPIC_API_KEY: 'k' }, modelo: { id: 'claude-sonnet-5-5' }, herramientas: hs };
const prefijo = (c) => JSON.stringify({ tools: c.tools, system: c.system });

test('puro: con herramientas el sistema va en un bloque con cache_control y la última herramienta lleva la marca; los mensajes nunca', () => {
  const c = armarLlamada({ ...base, sistema: 'Eres un agente.', mensajes: [{ role: 'user', content: 'hola' }] }).cuerpo;
  assert.deepEqual(c.system, [{ type: 'text', text: 'Eres un agente.', cache_control: { type: 'ephemeral' } }]);
  assert.equal(c.tools[0].cache_control, undefined); assert.deepEqual(c.tools[1].cache_control, { type: 'ephemeral' });
  assert.ok(!JSON.stringify(c.messages).includes('cache_control'));
});

test('puro: lo variable (los mensajes) y sinHerramientas no tocan los bytes del prefijo', () => {
  const a = armarLlamada({ ...base, sistema: 'S', mensajes: [{ role: 'user', content: 'uno' }] }).cuerpo;
  const b = armarLlamada({ ...base, sistema: 'S', mensajes: [{ role: 'user', content: 'uno' }, { role: 'assistant', content: 'x' }, { role: 'user', content: 'otra cosa muy distinta' }] }).cuerpo;
  const c = armarLlamada({ ...base, sistema: 'S', mensajes: b.messages, sinHerramientas: true }).cuerpo;
  assert.equal(prefijo(a), prefijo(b)); assert.equal(prefijo(a), prefijo(c)); assert.deepEqual(c.tool_choice, { type: 'none' });
  assert.notEqual(prefijo(a), prefijo(armarLlamada({ ...base, sistema: 'S2', mensajes: a.messages }).cuerpo), 'control: un sistema distinto SÍ cambia el prefijo');
});

test('puro: sin herramientas, con Meta o con un sistema ya en bloques (Dimitri) no se añade ni se quita nada', () => {
  const m = [{ role: 'user', content: 'hola' }];
  assert.equal(armarLlamada({ ...base, herramientas: [], sistema: 'S', mensajes: m }).cuerpo.system, 'S');
  const meta = armarLlamada({ ...base, modelo: { id: 'muse-spark-1.3', meta: true }, sistema: 'S', mensajes: m }).cuerpo;
  assert.equal(meta.system, 'S'); assert.equal(meta.tools, undefined);
  const bloques = [{ type: 'text', text: 'fijo', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'variable' }];
  assert.deepEqual(armarLlamada({ ...base, sistema: bloques, mensajes: m }).cuerpo.system, bloques);
});

test('una tarea de varias vueltas: herramientas y sistema son idénticos byte a byte en cada vuelta, con la marca, y el libro anota lo escrito y lo leído de caché', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' } });
  await tarea(env, { text: 'Revisa el hilo de Ana y contesta.' });
  const con = (r, uso) => ({ ...r, usage: { input_tokens: 100, output_tokens: 50, ...uso } });
  const f = crearFetch({ herramientasMcp: { search_threads: { salida: 'Hilo con Ana.' } }, guion: [
    con(usar(['mcp__tareas__ver_mi_tarea', {}]), { cache_creation_input_tokens: 5000 }),
    con(usar(['mcp__gmail__search_threads', { query: 'Ana' }]), { cache_read_input_tokens: 5000 }),
    con(texto('Listo.\nFuentes: ninguna.'), { cache_read_input_tokens: 5100 }),
  ] });
  await minutos(env, f.fetchFn);
  const c = f.registro.anthropic.map((x) => x.cuerpo); assert.equal(c.length, 3);
  assert.ok(c[0].tools.length > 1); assert.ok(Array.isArray(c[0].system) && c[0].system[0].cache_control);
  for (const x of c.slice(1)) assert.equal(prefijo(x), prefijo(c[0]), 'el prefijo no cambia entre vueltas');
  assert.equal(c[0].tools.filter((t) => t.cache_control).length, 1);
  assert.ok(c.every((x) => !JSON.stringify(x.messages).includes('cache_control')), 'ningún mensaje lleva marca');
  const l = filas(d1, 'select cache_read, cache_write from costos where tarea is not null order by id');
  assert.equal(l.reduce((n, r) => n + r.cache_write, 0), 5000); assert.equal(l.reduce((n, r) => n + r.cache_read, 0), 10100);
});

test('cacheStats: tasa de aciertos y ahorro estimado con la tabla de precios (Sonnet 5: entrada 2, lectura 0,2, escritura 2,5 US$/Mtok)', () => {
  const lineas = [{ model: 'claude-sonnet-5', in: 100, cacheWrite: 10000, cacheRead: 0 }, { model: 'claude-sonnet-5', in: 100, cacheRead: 10000, cacheWrite: 0 }, { model: 'claude-sonnet-5', in: 100, cacheRead: 10000, cacheWrite: 0 }];
  const s = cacheStats(lineas);
  assert.equal(s.cacheRead, 20000); assert.equal(s.cacheWrite, 10000); assert.equal(s.input, 300);
  assert.ok(Math.abs(s.hitRatio - 20000 / 30300) < 1e-9);
  // ahorro = 20000 × (2 − 0,2) / 1e6 − 10000 × (2,5 − 2) / 1e6 = 0,036 − 0,005
  assert.equal(s.ahorroUsd, 0.031);
  assert.equal(cacheStats([{ model: 'claude-sonnet-5', in: 100, cacheWrite: 10000, cacheRead: 0 }]).ahorroUsd, -0.005, 'una escritura que nadie lee cuesta más que no cachear');
  assert.deepEqual(cacheStats([]), { cacheRead: 0, cacheWrite: 0, input: 0, hitRatio: 0, ahorroUsd: 0 });
});
