// SEG-02 — `dominiosPermitidos` por conector en la nube: validación, quién edita, el guardián (falla cerrado), el chat con agentes y que el token no salga. Sin reloj.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR } from './d1-memoria.mjs';
import { oficina, crearFetch, texto, usar, filas, pagina, todoD1 } from './agentes-ayudas.mjs';
import { validarDominios, dominiosDe, dominiosPorServidor, publico, MAX_DOMINIOS } from '../worker/lib/conectores.js';
import { crearGuardian } from '../worker/lib/agentes/guardian.js';

const T = 1_750_000_000_000, CENT = 'CENTINELA-token-dominios-1a2b3c4d5e'; // secrets-ok

test('validarDominios: dominios sueltos y *.dominio; nada de esquema, ruta, puerto, IPs, locales ni «*» solo; ≤ 20', () => {
  assert.deepEqual(validarDominios(['Docs.Partner.com', '*.cdn.example.org', 'docs.partner.com']), { ok: true, lista: ['docs.partner.com', '*.cdn.example.org'] });
  assert.deepEqual(validarDominios('a.com\nb.com, c.com').lista, ['a.com', 'b.com', 'c.com'], 'texto, uno por línea');
  assert.deepEqual(validarDominios('').lista, []); assert.deepEqual(validarDominios(undefined).lista, []);
  const malos = ['https://a.com', 'a.com/ruta', 'a.com:8080', 'a b.com', '*', '*.', '*.com', 'com', 'a..com', 'localhost', 'x.local', 'x.internal', '10.0.0.1', '127.0.0.1', '[::1]', 'a@b.com', 'dоcs.com', 'a*.com', 'a.com\\x', '-a.com'];
  for (const mal of malos) assert.equal(validarDominios([mal]).ok, false, mal);
  assert.equal(validarDominios(Array.from({ length: MAX_DOMINIOS + 1 }, (_, i) => `d${i}.com`)).ok, false);
  assert.equal(validarDominios(Array.from({ length: MAX_DOMINIOS }, (_, i) => `d${i}.com`)).ok, true);
});

test('dominiosDe / dominiosPorServidor: lo roto o vacío es «ninguno»', () => {
  assert.deepEqual(dominiosDe({ dominios_permitidos: '["a.com"]' }), ['a.com']);
  for (const v of [null, undefined, '', 'no-json', '{"a":1}', '[5]']) assert.deepEqual(dominiosDe({ dominios_permitidos: v }), [], String(v));
  assert.deepEqual(dominiosPorServidor([{ nombre: 'g', dominios_permitidos: '["a.com"]' }, { nombre: 'h', dominios_permitidos: null }]), { g: ['a.com'] });
});

const dbFalsa = () => ({ prepare(sql) { return { bind: () => ({ run: async () => ({}), all: async () => ({ results: [] }) }) }; } });
const guardian = (ctx = {}, safety = {}) => crearGuardian({ db: dbFalsa(), estado: {}, ahora: () => T, ctx: { run: 'r', tarea: 't', agente: 'elead', dept: 'emails', writes: false, runMode: 'chat', policy: 'nunca', known: null, safety, amountLimit: 0, servers: ['gmail'], urls: { gmail: 'https://mcp.good.com/sse' }, ...ctx } });
const llamar = (g, url) => g.antes('mcp__gmail__search_threads', { url });

test('guardián: con interruptor y lista, el host de la lista pasa y lo demás se bloquea (url-ajena, motivo fijo)', async () => {
  const g = guardian({ dominios: { gmail: ['docs.partner.com'] } }, { dominiosPorConector: true });
  assert.equal((await llamar(g, 'https://docs.partner.com/a')).allow, true);
  for (const u of ['https://docs.partner.com.evil.test/a', 'https://evil.test/x', 'https://docs.partner.com@evil.test/']) { const d = await llamar(g, u); assert.equal(d.allow, false, u); assert.equal(d.code, 'url-ajena'); assert.ok(!/evil/.test(d.why)); }
});

test('guardián: interruptor APAGADO (o no booleano) ignora la lista; sin lista = como siempre', async () => {
  for (const safety of [{}, { dominiosPorConector: false }, { dominiosPorConector: 'true' }]) assert.equal((await llamar(guardian({ dominios: { gmail: ['docs.partner.com'] } }, safety), 'https://docs.partner.com/a')).code, 'url-ajena', JSON.stringify(safety));
  assert.equal((await llamar(guardian({}, { dominiosPorConector: true }), 'https://docs.partner.com/a')).code, 'url-ajena');
  assert.equal((await llamar(guardian({ dominios: { gmail: [] } }, { dominiosPorConector: true }), 'https://docs.partner.com/a')).code, 'url-ajena');
  assert.equal((await llamar(guardian({ dominios: { gmail: ['docs.partner.com'] } }, { dominiosPorConector: true }), 'https://mcp.good.com/x')).allow, true, 'el propio conector sigue pasando');
});

test('guardián: la lista de OTRO conector no vale; si algo se rompe, falla cerrado', async () => {
  const g = guardian({ dominios: { otro: ['docs.partner.com'] } }, { dominiosPorConector: true });
  assert.equal((await llamar(g, 'https://docs.partner.com/a')).code, 'url-ajena');
  const roto = guardian({ dominios: { get gmail() { throw new Error('boom'); } } }, { dominiosPorConector: true });
  const d = await llamar(roto, 'https://docs.partner.com/a'); assert.equal(d.allow, false); assert.equal(d.code, 'guardian');
});

test('guardián: la lista NO abre envíos (sin OK, o a un destinatario fuera del borrador, se bloquean igual)', async () => {
  const g = guardian({ dominios: { gmail: ['docs.partner.com'] }, writes: true, known: 'Para: ana@x.com' }, { dominiosPorConector: true });
  assert.equal((await g.antes('mcp__gmail__send_email', { to: 'evil@evil.test', body: 'hola' })).allow, false);
  const sinOk = guardian({ dominios: { gmail: ['docs.partner.com'] }, writes: false }, { dominiosPorConector: true });
  assert.equal((await sinOk.antes('mcp__gmail__send_email', { to: 'ana@x.com', body: 'hola' })).allow, false);
});

const NUEVO = (o = {}) => ({ nombre: 'zapier', url: 'https://mcp.zapier.example.com/api/mcp', auth_tipo: 'ninguna', departamentos: ['emails'], herramientas_lectura: ['search_threads'], herramientas_envio: [], ...o });

test('API: solo un administrador edita los dominios; se validan; se conservan; vacío los quita; auditados; el token no sale', { skip: SALTAR }, async () => {
  const { d1, env } = await oficina({ conector: false, env: { AO_CLAVE_CIFRADO: 'una-clave-de-cifrado-muy-larga-de-prueba-0123456789' } }); // secrets-ok
  const p = await pagina({ d1, env });
  for (const quien of ['editor', 'lectura']) assert.equal((await p[quien]('POST', '/api/conectores', NUEVO({ dominios_permitidos: ['a.com'] }))).status, 403, quien);
  for (const mal of [['https://a.com'], ['localhost'], ['10.0.0.1'], ['*'], Array.from({ length: 21 }, (_, i) => `d${i}.com`)]) assert.equal((await p.admin('POST', '/api/conectores', NUEVO({ dominios_permitidos: mal }))).status, 422, JSON.stringify(mal).slice(0, 30));
  const r = await p.admin('POST', '/api/conectores', NUEVO({ dominios_permitidos: ['Docs.Partner.com', '*.cdn.example.org'] }));
  assert.equal(r.status, 201); assert.deepEqual(r.j.conector.dominios_permitidos, ['docs.partner.com', '*.cdn.example.org']);
  for (const quien of ['editor', 'lectura']) assert.deepEqual((await p[quien]('GET', '/api/conectores')).j.conectores[0].dominios_permitidos, ['docs.partner.com', '*.cdn.example.org'], 'todos pueden VER la lista (no es secreto)');
  const sin = await p.admin('POST', '/api/conectores', NUEVO({ etiqueta: 'Otro nombre' })); assert.deepEqual(sin.j.conector.dominios_permitidos, ['docs.partner.com', '*.cdn.example.org'], 'sin el campo, se conserva');
  const aud = filas(d1, "select detalle from auditoria where tipo = 'conector'").map((a) => a.detalle).join('\n'); assert.match(aud, /"dominios":\["docs\.partner\.com"/);
  const vacio = await p.admin('POST', '/api/conectores', NUEVO({ dominios_permitidos: [] })); assert.deepEqual(vacio.j.conector.dominios_permitidos, []);
  assert.equal(filas(d1, 'select dominios_permitidos d from conectores_extra')[0].d, null);
  const t = await p.admin('POST', '/api/conectores', NUEVO({ auth_tipo: 'bearer', token: CENT, dominios_permitidos: ['a.com'] }));
  assert.equal(t.status, 200); assert.equal(t.texto.includes(CENT), false); assert.equal(todoD1(d1).includes(CENT), false);
  assert.deepEqual(publico({ nombre: 'x', url: 'https://a.example.com', dominios_permitidos: '["a.com"]', departamentos: '[]', herramientas_lectura: '[]', herramientas_envio: '[]' }, {}).dominios_permitidos, ['a.com']);
});

const ESQ = { type: 'object', properties: { url: { type: 'string', description: 'Dirección a leer' } } };
async function mundo({ dominios, interruptor, url = 'https://docs.partner.com/a' }) {
  const hs = { search_threads: { salida: 'Contenido de la página.', esquema: ESQ } };
  const o = await oficina({ ajustes: interruptor === undefined ? null : { safety: { dominiosPorConector: interruptor } } });
  if (dominios) o.d1._db.prepare("insert into conectores_extra (nombre, auth_tipo, dominios_permitidos, updated_at) values ('gmail','bearer',?,'x')").run(JSON.stringify(dominios));
  const f = crearFetch({ guion: [usar(['mcp__gmail__search_threads', { url }]), texto('Listo.')], herramientasMcp: hs });
  o.env.__pruebas = { fetch: f.fetchFn };
  return { ...o, f, hs, p: await pagina(o) };
}
const chat = (m) => m.p.admin('POST', '/api/chat', { agent: 'elead', text: 'Lee la página', history: [] });
const ofrecidas = (m) => (m.f.registro.anthropic[0].cuerpo.tools || []).map((t) => t.name);

test('chat con agentes: sin interruptor o sin lista, la herramienta con dirección sigue OCULTA', { skip: SALTAR }, async () => {
  for (const cfg of [{ dominios: ['docs.partner.com'] }, { interruptor: true }, { interruptor: false, dominios: ['docs.partner.com'] }, {}]) {
    const m = await mundo(cfg); const r = await chat(m); assert.equal(r.status, 200, JSON.stringify(r.j));
    assert.deepEqual(ofrecidas(m), [], JSON.stringify(cfg)); assert.ok(!m.hs.search_threads.llamadas);
  }
});

test('chat con agentes: con interruptor y lista se ofrece; cada dirección tiene que caer en la lista (decide el guardián)', { skip: SALTAR }, async () => {
  const m = await mundo({ dominios: ['docs.partner.com'], interruptor: true });
  const r = await chat(m); assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.deepEqual(ofrecidas(m), ['mcp__gmail__search_threads']); assert.equal(m.hs.search_threads.llamadas, 1);
  const m2 = await mundo({ dominios: ['docs.partner.com'], interruptor: true, url: 'https://evil.test/x?d=secreto' });
  const r2 = await chat(m2); assert.equal(r2.status, 200); assert.ok(!m2.hs.search_threads.llamadas, 'no se llamó al conector');
  const aud = filas(m2.d1, 'select codigo, decision, motivo from auditoria_agentes'); assert.ok(aud.some((x) => x.codigo === 'url-ajena' && x.decision === 'block'));
  assert.ok(!aud.some((x) => /evil/.test(x.motivo || '')), 'el motivo no repite la dirección');
});

test('validarDominios rechaza sufijos públicos amplios (con mensaje en español) y acepta un subdominio propio', () => {
  for (const amplio of ['github.io', 'vercel.app', 'netlify.app', 'pages.dev', 'workers.dev', 'herokuapp.com', 's3.amazonaws.com', 'amazonaws.com', 'blogspot.com', 'co.uk', 'com.pa', '*.github.io', 'GitHub.io']) {
    const r = validarDominios([amplio]); assert.equal(r.ok, false, amplio); assert.match(r.errores[0], /dominio público|cualquiera puede publicar/, amplio);
  }
  assert.equal(validarDominios(['miempresa.github.io']).ok, true); assert.equal(validarDominios(['docs.miempresa.com.pa']).ok, true);
});

test('dominiosDe revalida lo guardado: una fila escrita por otra vía no mete entradas inválidas', () => {
  const sucio = ['ok.com', '*', 'https://a.com', 'a.com/x', 'github.io', '10.0.0.1', ' b.com', 'C.com', '*.bien.org', 5, null];
  assert.deepEqual(dominiosDe({ dominios_permitidos: JSON.stringify(sucio) }), ['ok.com', '*.bien.org']);
  assert.equal(dominiosDe({ dominios_permitidos: JSON.stringify(Array.from({ length: 50 }, (_, i) => `d${i}.com`)) }).length, MAX_DOMINIOS);
});
