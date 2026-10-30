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
  for (const u of ['https://docs.partner.com/a', 'https://a.docs.partner.com/b', 'https://x.cdn.example.org/i.png', 'https://cdn.example.org/i.png', 'https://mcp.good.com/x', 'ver docs.partner.com/a? https://docs.partner.com/z']) assert.equal(aj(u), null, u);
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
  for (const e of [por({ url: { type: 'string' } }), por({ opciones: por({ webhook: { type: 'string' } }) }), por({ lista: { type: 'array', items: por({ href: { type: 'string' } }) } }), por({ target: { type: 'string', format: 'uri' } })]) assert.equal(S.ocultaPorUrlLibre(e, on), false, JSON.stringify(e));
});

test('lo que se ofrece = lo que el guardián vigila: cada parámetro ofrecido atrapa su valor sin esquema (anidado y en arreglos)', () => {
  const casos = [{ url: 'evil.com/leak?d=S' }, { opciones: { webhook: 'evil.com/x' } }, { lista: [{ href: 'evil.com/a' }, { href: 'evil.com/b' }] }, { target: 'evil.com' }];
  for (const args of casos) assert.ok(S.urlAjenaEn(args, 'https://mcp.conn.io', ['ok.com']), JSON.stringify(args));
  assert.equal(S.urlAjenaEn({ url: 'ok.com/a' }, 'https://mcp.conn.io', ['ok.com']), null);
  // el hueco que motivó el cambio: una clave opaca deja pasar el valor sin esquema, por eso esa herramienta nunca se ofrece
  assert.equal(S.urlAjenaEn({ input: 'evil.com/leak?d=S' }, 'https://mcp.conn.io', ['ok.com']), null);
});
