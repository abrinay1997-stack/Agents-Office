// Un turno del modelo que se llena antes de terminar (stop_reason «max_tokens»). Caso real (Avalon, 27 oct 2026): «dame 5 ideas de publicaciones» pide cinco borradores
// en UN turno, no cabía en 4000 tokens y la tarea fallaba SIEMPRE con «[HTTP 529]» (parecía una caída del proveedor y se reintentaba con el mismo límite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, tarea, tareaEnDisco, crearFetch, texto, respuesta, usar, minutos, filas } from './agentes-ayudas.mjs';
import { mensajeDeCorte, TOKENS_TURNO, TOKENS_TURNO_ALTO } from '../worker/lib/agentes/ejecutor.js';

const GRANDE = { AGENTES_MAX_CONSULTAS: '5000', AGENTES_MAX_LLAMADAS: '500' };
/** Un turno cortado a media llamada a una herramienta (la API entrega el bloque tool_use a medias). */
const cortadoEnHerramienta = (salida = TOKENS_TURNO) => respuesta([{ type: 'tool_use', id: 'tu_cortado', name: 'mcp__gmail__create_draft', input: {} }], { stop_reason: 'max_tokens', usage: { input_tokens: 100, output_tokens: salida } });
const cortadoEnTexto = (t, salida = TOKENS_TURNO) => respuesta([{ type: 'text', text: t }], { stop_reason: 'max_tokens', usage: { input_tokens: 100, output_tokens: salida } });
const cortadoPensando = (salida = TOKENS_TURNO) => respuesta([{ type: 'thinking', thinking: 'pienso…', signature: 'x' }], { stop_reason: 'max_tokens', usage: { input_tokens: 100, output_tokens: salida } });

test('CORTE: el turno que no cabe se repite UNA vez con más espacio, sin gastar un reintento de la tarea, y la llamada cortada nunca se ejecuta', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE });
  const t = await tarea(env);
  const herramientasMcp = { create_draft: { salida: 'borrador creado' } };
  const f = crearFetch({ guion: [cortadoEnHerramienta(), texto('Aquí van las 5 ideas.\nFuentes: —')], herramientasMcp });
  await minutos(env, f.fetchFn);
  const d = await tareaEnDisco(d1, t.id);
  assert.equal(d.state, 'done'); assert.notEqual(d.error, true); assert.match(d.result, /5 ideas/);
  assert.equal(d.attempts || 0, 0, 'no se gastó un reintento de la tarea');
  assert.equal(f.registro.anthropic.length, 2);
  assert.equal(f.registro.anthropic[0].cuerpo.max_tokens, TOKENS_TURNO, 'el primer turno ya trae más de los 4000 de antes');
  assert.ok(TOKENS_TURNO > 4000);
  assert.equal(f.registro.anthropic[1].cuerpo.max_tokens, TOKENS_TURNO_ALTO);
  assert.deepEqual(f.registro.anthropic[1].cuerpo.messages, f.registro.anthropic[0].cuerpo.messages, 'lo cortado no entra en la conversación: el modelo vuelve a intentarlo desde el mismo punto');
  assert.ok(!herramientasMcp.create_draft.llamadas, 'una llamada cortada a la mitad no se ejecuta jamás');
  assert.equal(filas(d1, 'select count(*) n from costos')[0].n, 2, 'el turno cortado también se pagó y se apunta');
});

test('CORTE: si tampoco cabe con el límite alto, la tarea falla UNA vez, sin reintentos y diciendo la verdad (nada de «HTTP 529»)', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE });
  const t = await tarea(env);
  const f = crearFetch({ guion: [cortadoEnHerramienta(), cortadoEnHerramienta(TOKENS_TURNO_ALTO), texto('NO debería llegar a esto')] });
  await minutos(env, f.fetchFn);
  const d = await tareaEnDisco(d1, t.id);
  assert.equal(d.state, 'done'); assert.equal(d.error, true); assert.equal(d.errorKind, 'fatal'); assert.equal(d.retryAt, undefined);
  assert.equal(f.registro.anthropic.length, 2, 'ni un tercer intento: repetirlo costaría lo mismo y fallaría igual');
  assert.match(d.result, /se quedó sin espacio para responder/); assert.match(d.result, /una publicación por tarea/);
  assert.match(d.result, /llamadas a herramientas: 1/);
  assert.doesNotMatch(d.result, /529|max_tokens|saturad/i);
  const dos = crearFetch({ guion: [texto('Otra tarea normal.\nFuentes: —')] });
  await tarea(env, { title: 'Otra' }); await minutos(env, dos.fetchFn); // el candado se soltó: la cola sigue
  assert.equal((await tareaEnDisco(d1, t.id)).tomadaPor, undefined);
});

test('CORTE: el límite alto queda apuntado en la corrida ANTES de repetir el turno: si el paso muere, el siguiente no vuelve a empezar con el bajo', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE });
  const t = await tarea(env);
  const base = crearFetch({ guion: [cortadoPensando(), texto('Listo.\nFuentes: —')] });
  let apuntado = null;
  const fetchFn = async (url, init) => { if (base.registro.anthropic.length === 1 && String(url).includes('anthropic')) apuntado = JSON.parse(filas(d1, 'select datos from corridas')[0].datos).maxTokens; return base.fetchFn(url, init); };
  await minutos(env, fetchFn);
  assert.equal(apuntado, TOKENS_TURNO_ALTO, 'al llegar la segunda llamada, la corrida ya recuerda el límite alto');
  assert.equal((await tareaEnDisco(d1, t.id)).state, 'done');
});

test('CORTE: el límite alto es solo para repetir el turno cortado: los turnos que siguen vuelven al normal (y al guardarse ya no lo recuerdan)', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE });
  const t = await tarea(env);
  const f = crearFetch({ guion: [cortadoPensando(), usar(['mcp__gmail__search_threads', { query: 'x' }]), texto('Listo.\nFuentes: —')], herramientasMcp: { search_threads: { salida: 'hilo' } } });
  await minutos(env, f.fetchFn);
  assert.deepEqual(f.registro.anthropic.map(x => x.cuerpo.max_tokens), [TOKENS_TURNO, TOKENS_TURNO_ALTO, TOKENS_TURNO], 'cortado → repetido con el alto → el turno siguiente, con el normal');
  assert.equal((await tareaEnDisco(d1, t.id)).state, 'done');
});

test('CORTE: una respuesta de TEXTO cortada se repite con más espacio; si sigue cortada se entrega con el aviso, nunca como si estuviera completa', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ env: GRANDE });
  const t = await tarea(env);
  const f = crearFetch({ guion: [cortadoEnTexto('Un informe larguísimo que se corta'), cortadoEnTexto('Un informe larguísimo que se corta otra vez', TOKENS_TURNO_ALTO)] });
  await minutos(env, f.fetchFn);
  const d = await tareaEnDisco(d1, t.id);
  assert.equal(f.registro.anthropic.length, 2);
  assert.equal(d.state, 'done'); assert.notEqual(d.error, true);
  assert.match(d.result, /se corta otra vez/); assert.match(d.result, /se cortó por el límite de longitud/); assert.match(d.result, new RegExp(String(TOKENS_TURNO_ALTO)));
});

test('CORTE: lo que se llevó el razonamiento se dice (para saber qué pedir distinto) y el mensaje cabe en lo que guarda la tarea', () => {
  const m = mensajeDeCorte(respuesta([{ type: 'thinking', thinking: 'a' }, { type: 'redacted_thinking', data: 'b' }, { type: 'tool_use', id: 'x', name: 'n', input: {} }, { type: 'text', text: 't' }], { usage: { output_tokens: 16000 } }), 16000);
  assert.match(m, /escribió 16000 tokens/); assert.match(m, /razonamiento: 2 bloques/); assert.match(m, /llamadas a herramientas: 1/); assert.match(m, /texto: 1/);
  assert.ok(m.length < 400, `cabe en las 400 letras que guarda la tarea (mide ${m.length})`);
  assert.match(mensajeDeCorte(respuesta([], { usage: {} }), 16000), /escribió 16000 tokens/, 'sin cifra de uso, dice el límite');
});
