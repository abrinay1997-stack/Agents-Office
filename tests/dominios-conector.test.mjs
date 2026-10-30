// SEG-02 — `dominiosPermitidos` por conector: lo puro (urlAjenaEn con lista, el interruptor, la regla de ocultar). Sin reloj: no depende de la hora.
// Los casos hostiles del banco de ataques se repiten aquí CON una lista para ver que ninguno se vuelve permitido; la lista vacía = el comportamiento de siempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../safety.mjs';
import { URLS } from './fixtures/banco-ataques.mjs';

const CON = 'https://mcp.good.com/sse', L = ['docs.partner.com', '*.cdn.example.org'];
const aj = (url, extra = L) => S.urlAjenaEn({ url }, CON, extra);

test('lista vacía, ausente o rota = el comportamiento de siempre (todo el banco de direcciones da lo mismo)', () => {
  for (const u of URLS.filter(x => x.conector)) {
    const base = S.urlAjenaEn(u.args, u.conector);
    for (const v of [[], undefined, null, 'x.com', [5, '', '  ']]) assert.equal(S.urlAjenaEn(u.args, u.conector, v), base, u.id);
  }
});

test('un host de la lista pasa (y sus subdominios); el del conector sigue pasando', () => {
  for (const u of ['https://docs.partner.com/a', 'https://a.docs.partner.com/b', 'https://x.cdn.example.org/i.png', 'https://cdn.example.org/i.png', 'https://mcp.good.com/x']) assert.equal(aj(u), null, u);
  assert.equal(S.urlAjenaEn({ q: 'ver docs.partner.com/a? https://docs.partner.com/z' }, CON, L), null, 'texto libre bajo una clave que no es de dirección');
});

test('lo que se parece a un host de la lista NO pasa', () => {
  const malas = ['https://docs.partner.com.evil.test/x', 'https://evil.test/docs.partner.com', 'https://evil-docs.partner.com.test/', 'https://partner.com/x', 'https://example.org/x',
    'https://docs.partner.com@evil.test/', 'https://docs.partner.com\\@evil.test/', 'https://dоcs.partner.com/x', 'https://ｄocs.partner.com/x', 'https://evil.test/?u=https://docs.partner.com'];
  for (const u of malas) assert.ok(aj(u), u);
  assert.ok(S.urlAjenaEn({ url: 'https://docs.partner.com/a', otra: 'https://evil.test/x' }, CON, L), 'una sola dirección ajena entre varias basta');
  assert.ok(S.urlAjenaEn({ q: 'https://[::1]/x' }, CON, ['::1']), 'IPv6 literal nunca vale, ni en la lista');
});

test('«*.dominio» cubre también el dominio base; un `*` suelto no cubre nada', () => {
  assert.equal(S.urlAjenaEn({ u: 'https://a.b.com/x' }, CON, ['*.b.com']), null);
  assert.equal(S.urlAjenaEn({ u: 'https://b.com/x' }, CON, ['*.b.com']), null);
  assert.ok(S.urlAjenaEn({ u: 'https://evil.test/x' }, CON, ['*']), 'un * solo no es un dominio');
});

test('el banco de direcciones con una lista que NO incluye el destino: ninguna dirección ajena se vuelve propia', () => {
  for (const u of URLS.filter(x => x.conector && x.ajena && !x.limite)) assert.ok(S.urlAjenaEn(u.args, u.conector, L), `${u.id}: ${u.porque}`);
});

test('interruptor `safety.dominiosPorConector`: apagado por defecto, solo el booleano true lo enciende', () => {
  assert.equal(S.normalize({}).dominiosPorConector, false);
  for (const v of ['true', 1, 'sí', null, [], {}]) assert.equal(S.normalize({ dominiosPorConector: v }).dominiosPorConector, false, String(v));
  assert.equal(S.normalize({ dominiosPorConector: true }).dominiosPorConector, true);
});

test('ocultaPorUrlLibre: solo se ofrece con el interruptor Y una lista no vacía', () => {
  const con = { type: 'object', properties: { url: { type: 'string' } } }, sin = { type: 'object', properties: { q: { type: 'string' } } };
  assert.equal(S.ocultaPorUrlLibre(sin, { activo: true, dominios: [] }), false, 'sin parámetro de dirección nunca se oculta');
  assert.equal(S.ocultaPorUrlLibre(con), true);
  assert.equal(S.ocultaPorUrlLibre(con, { activo: false, dominios: L }), true, 'lista pero interruptor apagado: se oculta');
  assert.equal(S.ocultaPorUrlLibre(con, { activo: true, dominios: [] }), true, 'interruptor sin lista: se oculta');
  assert.equal(S.ocultaPorUrlLibre(con, { activo: 'true', dominios: L }), true, 'solo el booleano true');
  assert.equal(S.ocultaPorUrlLibre(con, { activo: true, dominios: L }), false);
});

test('FALLA CERRADO: solo se ofrece lo que el guardián sabe vigilar (todo parámetro de dirección con nombre reconocible)', () => {
  const on = { activo: true, dominios: L };
  const por = (props) => ({ type: 'object', properties: props });
  // ocultas aunque haya interruptor y lista: el nombre no es de dirección, el guardián no trataría su valor sin esquema como host
  assert.equal(S.ocultaPorUrlLibre(por({ input: { type: 'string', description: 'The URL to open' } }), on), true, 'por descripción');
  assert.equal(S.ocultaPorUrlLibre(por({ q: { type: 'string', format: 'uri' } }), on), true, 'por format:uri con nombre opaco');
  assert.equal(S.ocultaPorUrlLibre(por({ opciones: por({ entrada: { type: 'string', description: 'page address (URL)' } }) }), on), true, 'anidado');
  assert.equal(S.ocultaPorUrlLibre(por({ lista: { type: 'array', items: por({ cosa: { type: 'string', format: 'uri' } }) } }), on), true, 'en un arreglo');
  assert.equal(S.ocultaPorUrlLibre({ type: 'string', format: 'uri' }, on), true, 'el valor raíz');
  assert.equal(S.ocultaPorUrlLibre(por({ url: { type: 'string' }, input: { type: 'string', description: 'URL' } }), on), true, 'basta un parámetro no vigilable');
  // ofrecidas: nombre reconocible, también anidado y en arreglos
  for (const e of [por({ url: { type: 'string' } }), por({ urls: { type: 'array', items: { type: 'string' } } }), por({ target: { type: 'string', format: 'uri' } })]) assert.equal(S.ocultaPorUrlLibre(e, on), false, JSON.stringify(e));
  // anidado, objeto, mapa, arreglo de objetos, anyOf/oneOf/$ref: SIEMPRE oculto
  for (const e of [por({ opciones: por({ webhook: { type: 'string' } }) }), por({ lista: { type: 'array', items: por({ href: { type: 'string' } }) } }),
    por({ url: { type: 'object', properties: { x: { type: 'string' } } } }), por({ links: { type: 'object', additionalProperties: { type: 'string' } } }), por({ urls: { type: 'array', items: por({ a: { type: 'string' } }) } }),
    por({ link: { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: { type: 'string' } }] } }), por({ url: { oneOf: [{ type: 'string' }] } }), por({ url: { $ref: '#/$defs/u' } }), por({ url: { type: ['string', 'null'] } }), por({ url: { description: 'URL' } }),
    { anyOf: [por({ url: { type: 'string' } })] }, { type: 'object', properties: { url: { type: 'string' } }, patternProperties: { '^x': { type: 'string' } } }]) assert.equal(S.ocultaPorUrlLibre(e, on), true, JSON.stringify(e));
});

test('lo que se ofrece = lo que el guardián vigila: cada parámetro ofrecido atrapa su valor sin esquema (anidado y en arreglos)', () => {
  const casos = [{ url: 'evil.com/leak?d=S' }, { opciones: { webhook: 'evil.com/x' } }, { lista: [{ href: 'evil.com/a' }, { href: 'evil.com/b' }] }, { target: 'evil.com' }];
  for (const args of casos) assert.ok(S.urlAjenaEn(args, 'https://mcp.conn.io', ['ok.com']), JSON.stringify(args));
  assert.equal(S.urlAjenaEn({ url: 'ok.com/a' }, 'https://mcp.conn.io', ['ok.com']), null);
  // el hueco que motivó el cambio: una clave opaca deja pasar el valor sin esquema, por eso esa herramienta nunca se ofrece
  assert.equal(S.urlAjenaEn({ input: 'evil.com/leak?d=S' }, 'https://mcp.conn.io', ['ok.com']), null);
});

// ---- las reproducciones de la segunda revisión, EXACTAS: o la herramienta queda oculta o la llamada se bloquea ----
const LISTA = ['ok.com'], CONN = 'https://mcp.conn.io';
const esquemas = {
  'url objeto': { type: 'object', properties: { url: { type: 'object', properties: { x: { type: 'string' } } } } },
  'links mapa': { type: 'object', properties: { links: { type: 'object', additionalProperties: { type: 'string' } } } },
  'urls arreglo de objetos': { type: 'object', properties: { urls: { type: 'array', items: { type: 'object', properties: { a: { type: 'string' } } } } } },
  'link anyOf': { type: 'object', properties: { link: { anyOf: [{ type: 'string' }, { type: 'object', additionalProperties: { type: 'string' } }] } } },
};
const llamadas = { 'url objeto': { url: { x: 'evil.com/leak?d=S' } }, 'links mapa': { links: { a: 'evil.com/x' } }, 'urls arreglo de objetos': { urls: [{ a: 'evil.com/x' }] }, 'link anyOf': { link: { k: 'evil.com/x' } } };
test('reproducciones (a): parámetro de dirección objeto/mapa/arreglo de objetos/anyOf → la herramienta se oculta Y, si el modelo la llama igual, se bloquea', () => {
  for (const [n, e] of Object.entries(esquemas)) {
    assert.equal(S.ocultaPorUrlLibre(e, { activo: true, dominios: LISTA }), true, `${n}: debe quedar oculta`);
    assert.ok(S.urlAjenaEn(llamadas[n], CONN, LISTA), `${n}: la llamada debe bloquearse`);
  }
});
test('reproducciones (b): espacio, tab o salto de línea en un parámetro de dirección → se bloquea', () => {
  for (const v of ['evil.com/leak?d=a b', 'ev\til.com/leak', 'evil.com\n/leak', 'evil.com\r\n/leak', ' evil.com ', 'evil.com/\u0000x', 'evil.com\u000b/x', 'https://evil.com/a\tb']) assert.ok(S.urlAjenaEn({ url: v }, CONN, LISTA), JSON.stringify(v));
  assert.equal(S.urlAjenaEn({ url: ' ok.com/a\n' }, CONN, LISTA), null, 'espacios y salto de borde de un host permitido se limpian');
  assert.ok(S.urlAjenaEn({ url: 'ok.com/a b' }, CONN, LISTA), 'espacio interno aunque el host sea de la lista');
  assert.ok(S.urlAjenaEn({ urls: ['ok.com/a', 'evil.com/b c'] }, CONN, LISTA));
  assert.ok(S.urlAjenaEn({ input: 'ok.com', url: { deep: { deeper: { d3: { d4: { d5: { d6: 'ok.com' } } } } } } }, CONN, LISTA), 'demasiado hondo bajo una clave de dirección');
  assert.ok(S.urlAjenaEn({ url: 'x'.repeat(3000) }, CONN, LISTA));
});
test('(3) un string suelto bajo clave de dirección es siempre host/URL, tenga la forma que tenga', () => {
  for (const v of ['evil', 'EVIL.COM', 'evil.com:8080/x', '//evil.com/x', 'evil.com?d=S', 'localhost']) assert.ok(S.urlAjenaEn({ url: v }, CONN, LISTA), v);
  assert.equal(S.urlAjenaEn({ url: 'ok.com' }, CONN, LISTA), null); assert.equal(S.urlAjenaEn({ url: 'https://sub.ok.com/p?q=1' }, CONN, LISTA), null);
});
test('flag apagado o lista vacía = idéntico a main: los casos nuevos NO cambian urlAjenaEn sin lista', () => {
  const casos = [{ url: { x: 'evil.com/leak?d=S' } }, { url: 'evil.com/leak?d=a b' }, { url: 'ev\til.com/leak' }, { url: 'evil.com\n/leak' }, { urls: [{ a: 'evil.com/x' }] }, { url: 'ok.com/a' }, { url: ' mcp.conn.io/x ' }, { q: 'hola mundo' }];
  for (const a of casos) for (const v of [undefined, [], null]) assert.equal(S.urlAjenaEn(a, CONN, v), S.urlAjenaEn(a, CONN), JSON.stringify(a));
  // y sin lista el ocultar es siempre el de siempre
  for (const e of Object.values(esquemas)) assert.equal(S.ocultaPorUrlLibre(e, { activo: true, dominios: [] }), true);
  assert.equal(S.ocultaPorUrlLibre({ type: 'object', properties: { url: { type: 'string' } } }, { activo: false, dominios: LISTA }), true);
});

// ---- tercera revisión: valores no string y esquemas distintos de http/https (solo con lista) ----
test('con lista, bajo una clave de dirección un valor NO texto se bloquea (16909060 = 1.2.3.4, booleanos, objetos y arreglos con números)', () => {
  for (const a of [{ url: 16909060 }, { url: 1.5 }, { url: true }, { url: false }, { url: 10n }, { url: { n: 16909060 } }, { urls: [16909060] }, { urls: ['ok.com', 7] }, { link: { a: { b: false } } }, { urls: [{ a: 16909060 }] }])
    assert.ok(S.urlAjenaEn(a, CONN, LISTA), JSON.stringify(a, (_, v) => typeof v === 'bigint' ? String(v) : v));
  assert.equal(S.urlAjenaEn({ url: null }, CONN, LISTA), null, 'null = sin valor');
  assert.equal(S.urlAjenaEn({ limit: 5, ok: true, url: 'ok.com' }, CONN, LISTA), null, 'números en claves que no son de dirección no molestan');
});
test('con lista, bajo una clave de dirección solo valen http/https: file:, ftp:, data:, javascript:, mailto:… se bloquean, incluso con host vacío', () => {
  for (const v of ['file:///etc/passwd', 'FILE:///etc/passwd', 'file://ok.com/etc/passwd', 'ftp://ok.com/x', 'data:text/html,<b>x</b>', 'javascript:alert(1)', 'mailto:a@ok.com', 'gopher://ok.com/', 'ws://ok.com/x', 'http:ok.com', 'https:/ok.com', 'tel:+5075551234', 'view-source:https://ok.com']) assert.ok(S.urlAjenaEn({ url: v }, CONN, LISTA), v);
  for (const v of ['http://ok.com/a', 'HTTPS://OK.COM/a', 'ok.com:8080/a', 'https://sub.ok.com:8443/a?x=1']) assert.equal(S.urlAjenaEn({ url: v }, CONN, LISTA), null, v);
  assert.ok(S.urlAjenaEn({ url: 'evil.com:8080/a' }, CONN, LISTA), 'un puerto no esconde un host ajeno');
});
test('sin lista (o vacía) todo es idéntico al de antes también para números y esquemas', () => {
  const casos = [{ url: 16909060 }, { url: true }, { urls: [7] }, { url: 'file:///etc/passwd' }, { url: 'javascript:alert(1)' }, { url: 'data:text/html,x' }, { url: 'ftp://mcp.conn.io/x' }, { url: 'mailto:a@b.com' }];
  for (const a of casos) for (const v of [undefined, [], null]) assert.equal(S.urlAjenaEn(a, CONN, v), S.urlAjenaEn(a, CONN), JSON.stringify(a));
});
