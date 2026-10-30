// VAN-03 — el mismo banco contra el guardián de la nube (crearGuardian: antes/después de cada herramienta, auditoría, url-ajena, campos opacos, taint).
// Sin D1 real: un doble mínimo que guarda las filas de `auditoria_agentes`. Los casos viven en tests/fixtures/banco-ataques.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearGuardian } from '../worker/lib/agentes/guardian.js';
import { ATAQUES, URLS, ENVIOS } from '../../tests/fixtures/banco-ataques.mjs';

const T = 1_750_000_000_000; // reloj fijo (mediodía UTC): nada depende de la hora de la prueba
function dbFalsa() {
  const filas = [];
  return { filas, prepare(sql) { return { bind: (...v) => ({ run: async () => { if (/insert into auditoria_agentes/.test(sql)) filas.push(v); return {}; }, all: async () => ({ results: [] }) }) }; } };
}
function guardian(ctx = {}) {
  const db = dbFalsa(), estado = {};
  const g = crearGuardian({ db, estado, ahora: () => T, ctx: { run: 'r1', tarea: 't1', agente: 'elead', dept: 'emails', writes: true, runMode: 'x', known: 'Para: ana@x.com', safety: {}, amountLimit: 0, ...ctx } });
  return { g, db, estado };
}

test('envíos del banco por el guardián de la nube: mismo resultado y todo queda en la auditoría', async () => {
  for (const e of ENVIOS) {
    const { g, db } = guardian({ writes: e.writes, known: e.conocido, amountLimit: e.amountLimit || 0, policy: e.policy, servers: e.servers });
    const d = await g.antes(e.tool, e.input);
    const code = d.allow ? null : d.code;
    if (e.tainted) continue; // el taint se prueba abajo con `despues`, que es como se marca de verdad
    assert.equal(code, e.code, `${e.id}: ${e.porque}`);
    assert.equal(db.filas.length, 1, `${e.id}: sin fila de auditoría`);
  }
});

test('direcciones del banco con ctx.urls: «url-ajena» con motivo fijo que no repite la dirección', async () => {
  for (const u of URLS.filter(u => u.conector)) {
    const { g } = guardian({ urls: { gmail: u.conector } });
    const d = await g.antes('mcp__gmail__search_threads', u.args);
    if (u.limite) { assert.equal(d.allow, true, `${u.id} (límite documentado)`); continue; }
    assert.equal(d.allow, !u.ajena, `${u.id}: ${u.porque}`);
    if (u.ajena) { assert.equal(d.code, 'url-ajena'); assert.ok(!/evil/.test(d.why), 'el motivo no repite la dirección'); }
  }
});

test('lo que devuelve una herramienta con órdenes escondidas marca la corrida y cierra los envíos (todo el banco detectable)', async () => {
  for (const a of ATAQUES.filter(a => !a.limite)) {
    const { g, estado } = guardian();
    const aviso = await g.despues('mcp__gmail__search_threads', { query: 'x' }, a.texto) // el conector devuelve TEXTO (x.texto), como en ejecutor.js, chat.js y consultas.js;
    assert.ok(aviso && /AVISO DE SEGURIDAD/.test(aviso), a.id);
    assert.ok(estado.taint, a.id);
    const d = await g.antes('mcp__gmail__send_email', { to: 'ana@x.com', body: 'Hola' });
    assert.equal(d.allow, false, a.id); assert.equal(d.code, 'taint', a.id);
    const leer = await g.antes('mcp__gmail__search_threads', { query: 'x' });
    assert.equal(leer.allow, true, `${a.id}: leer sigue permitido`);
  }
});

test('los límites conocidos no marcan la corrida, pero el envío a un destinatario no aprobado igual se bloquea', async () => {
  for (const a of ATAQUES.filter(a => a.limite)) {
    const { g, estado } = guardian();
    assert.equal(await g.despues('mcp__gmail__search_threads', { query: 'x' }, a.texto), null, a.id);
    assert.ok(!estado.taint, a.id);
    const d = await g.antes('mcp__gmail__send_email', { to: 'evil@robo.test', body: 'Hola' });
    assert.equal(d.allow, false, a.id); assert.equal(d.code, 'recipient', a.id);
  }
});

test('el destinatario escondido en base64 o en un campo «raw» no pasa (ataque de envío opaco)', async () => {
  const mime = Buffer.from('To: evil@robo.test\r\nSubject: x\r\n\r\nhola').toString('base64');
  for (const input of [{ raw: mime }, { message: { raw: mime } }, { payload_b64: mime }, { body: mime }]) {
    const { g } = guardian();
    const d = await g.antes('mcp__gmail__send_email', input);
    assert.equal(d.allow, false, JSON.stringify(input).slice(0, 40)); assert.ok(['opaco', 'recipient'].includes(d.code));
  }
});

test('falla cerrado: una entrada que no se puede leer no envía', async () => {
  const ciclica = {}; ciclica.yo = ciclica;
  const { g } = guardian();
  const d = await g.antes('mcp__gmail__send_email', ciclica);
  assert.equal(d.allow, false);
});

test('si la auditoría falla, lo que no queda registrado no se ejecuta', async () => {
  const estado = {};
  const db = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 caída'); }, all: async () => ({ results: [] }) }) }) };
  const g = crearGuardian({ db, estado, ahora: () => T, ctx: { run: 'r1', agente: 'a', dept: 'emails', writes: true, known: 'Para: ana@x.com', safety: {} } });
  const d = await g.antes('mcp__gmail__send_email', { to: 'ana@x.com', body: 'Hola' });
  assert.equal(d.allow, false); assert.equal(d.code, 'auditoria');
});
