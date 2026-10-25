// El Durable Object Hub sin workerd: con un `state` y unos sockets de mentira. Lo que se afirma: topes (por persona y global), token bucket,
// presencia agrupada, identidad que sale del socket y no del mensaje, y que lo solo-admin no llega a un editor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hub, MAX_POR_PERSONA, MAX_SOCKETS, RAFAGA, AGRUPAR_MS } from '../worker/hub.js';

function socket(datos) {
  const w = { enviados: [], cerrado: null, attach: datos, send(m) { this.enviados.push(JSON.parse(m)); }, close(c, r) { this.cerrado = [c, r]; }, deserializeAttachment() { return this.attach; }, serializeAttachment(d) { this.attach = d; } };
  return w;
}
function hub(sockets = []) {
  const state = { getWebSockets: () => sockets.filter((s) => !s.cerrado) , acceptWebSocket() {}, setWebSocketAutoResponse() {} };
  return { h: new Hub(state), sockets };
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const persona = (userId, extra = {}) => socket({ userId, rol: 'editor', nombre: userId, color: '#111', foto: null, area: null, etiqueta: '', desde: Date.now(), ...extra });

test('tope POR PERSONA: al pasarse se cierra el más viejo de ESA persona, no el de otra', () => {
  const suyos = Array.from({ length: MAX_POR_PERSONA }, (_, i) => persona('ana', { desde: 1000 + i }));
  const ajeno = persona('bruno', { desde: 1 });
  const { h } = hub([ajeno, ...suyos]);
  h.hacerSitio('ana'); // va a entrar el socket 9 de Ana
  assert.deepEqual(suyos[0].cerrado?.[0], 4408, 'el más viejo de Ana se cierra');
  assert.ok(suyos.slice(1).every((s) => !s.cerrado) && !ajeno.cerrado);
  const { h: h2 } = hub([ajeno, ...suyos.slice(1)]); h2.hacerSitio('ana'); // con sitio, nadie se cierra
  assert.ok(suyos.slice(1).every((s) => !s.cerrado));
});

test('un editor no puede dejar sin presencia a los demás: 30 conexiones de uno solo dejan como mucho MAX_POR_PERSONA', () => {
  const todos = [persona('bruno')];
  const { h } = hub(todos);
  for (let i = 0; i < 30; i++) { h.hacerSitio('ana'); todos.push(persona('ana', { desde: 10 + i })); }
    assert.ok(todos.filter((s) => s.attach.userId === 'ana' && !s.cerrado).length <= MAX_POR_PERSONA);
  assert.ok(!todos[0].cerrado, 'Bruno sigue conectado');
});

test('tope global: con MAX_SOCKETS conectados, el siguiente recibe 503', async () => {
  const { h } = hub(Array.from({ length: MAX_SOCKETS }, (_, i) => persona('u' + i)));
  const r = await h.fetch(new Request('https://hub/conectar?userId=otra', { headers: { Upgrade: 'websocket' } }));
  assert.equal(r.status, 503);
});

test('token bucket: una ráfaga razonable pasa; inundar corta el socket con 1008 y no sigue procesando', async () => {
  const ws = persona('ana'); const { h } = hub([ws]);
  for (let i = 0; i < RAFAGA; i++) await h.webSocketMessage(ws, JSON.stringify({ tipo: 'vista', area: 'estudio', etiqueta: 'Estudio' }));
  assert.equal(ws.cerrado, null, 'hasta la ráfaga, bien');
  await h.webSocketMessage(ws, JSON.stringify({ tipo: 'vista', area: 'tareas', etiqueta: 'Tareas' }));
  assert.equal(ws.cerrado?.[0], 1008);
  assert.equal(ws.attach.area, 'estudio', 'el mensaje de más no se aplicó');
  // y las fichas se reponen con el tiempo
  const otro = persona('bruno'); const { h: h2 } = hub([otro]);
  for (let i = 0; i < RAFAGA; i++) assert.ok(h2.cabe(otro, 0));
  assert.equal(h2.cabe(otro, 0), false); assert.equal(h2.cabe(otro, 1000), true);
});

test('la presencia se AGRUPA: cien cambios seguidos son un solo mensaje con la lista final', async () => {
  const a = persona('ana'), b = persona('bruno'); const { h } = hub([a, b]);
  for (let i = 0; i < 5; i++) { b.attach.area = 'a' + i; h.presencia(); }
  assert.equal(a.enviados.length, 0, 'aún no ha salido nada');
  await esperar(AGRUPAR_MS + 80);
  const p = a.enviados.filter((m) => m.tipo === 'presencia');
  assert.equal(p.length, 1); assert.equal(p[0].presentes.find((x) => x.userId === 'bruno').area, 'a4');
});

test('una persona que se va sale de la presencia aunque su cierre llegue agrupado', async () => {
  const a = persona('ana'), b = persona('bruno'); const { h, sockets } = hub([a, b]);
  await h.webSocketClose(b); sockets.splice(1, 1);
  await esperar(AGRUPAR_MS + 80);
  assert.deepEqual(a.enviados.at(-1).presentes.map((x) => x.userId), ['ana']);
});

test('la identidad sale del socket: un mensaje «vista» con userId/nombre falsificados no cambia quién es', async () => {
  const a = persona('ana'), b = persona('bruno'); const { h } = hub([a, b]);
  await h.webSocketMessage(b, JSON.stringify({ tipo: 'vista', area: 'estudio', etiqueta: 'Estudio', userId: 'ana', nombre: 'Ana la fundadora', color: '#f00', rol: 'admin' }));
  assert.equal(b.attach.userId, 'bruno'); assert.equal(b.attach.nombre, 'bruno'); assert.equal(b.attach.rol, 'editor');
  await esperar(AGRUPAR_MS + 80);
  const lista = a.enviados.at(-1).presentes;
  assert.deepEqual(lista.map((x) => x.userId).sort(), ['ana', 'bruno']);
  assert.equal(lista.find((x) => x.userId === 'ana').area, null, 'Ana no se movió');
});

test('un área con forma rara o una etiqueta con marcas se descarta o se limpia; mensajes enormes o ilegibles no tiran nada', async () => {
  const a = persona('ana'); const { h } = hub([a]);
  await h.webSocketMessage(a, JSON.stringify({ tipo: 'vista', area: '<img onerror=x>', etiqueta: 'x' })); assert.equal(a.attach.area, null);
  await h.webSocketMessage(a, 'x'.repeat(5000)); await h.webSocketMessage(a, 'no json'); await h.webSocketMessage(a, new ArrayBuffer(4));
  await h.webSocketMessage(a, JSON.stringify({ tipo: 'vista', area: 'estudio', etiqueta: '<b>Estu\u0000dio</b>' }));
  assert.equal(a.attach.etiqueta, 'bEstudio/b');
});

test('lo solo-admin (ajustes, conectores, Dimitri…) llega a los administradores y a nadie más', () => {
  const adm = persona('ana', { rol: 'admin' }), ed = persona('bruno'), le = persona('carla', { rol: 'lectura' }); const { h } = hub([adm, ed, le]);
  h.difundir({ tipo: 'cambio', area: 'ajustes', nombre: 'los ajustes', soloAdmin: true });
  assert.equal(adm.enviados.length, 1); assert.equal(ed.enviados.length, 0); assert.equal(le.enviados.length, 0);
  assert.ok(!('soloAdmin' in adm.enviados[0]), 'la marca no sale al cliente');
  h.difundir({ tipo: 'cambio', area: 'tareas', nombre: 'Tareas' });
  assert.deepEqual([adm, ed, le].map((s) => s.enviados.length), [2, 1, 1]);
});
