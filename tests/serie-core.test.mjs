import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as S from '../serie-core.mjs';

const caps = { 'nano': { maxRefs: 4, edit: true }, 'flux': { maxRefs: 1 } };
const capsDe = m => caps[m] || null;
const plano = (n, x = {}) => ({ n, prompt_exacto: `plano ${n} escena`, modelo: 'nano', refs: ['a.jpg'], ...x });
const serie = (x = {}) => ({ id: 's1', estado: 'previsto', biblia_version: 2, modelo_unico: 'nano', escaleta: [1, 2, 3, 4].map(n => S.crearPlano(plano(n))), ...x });
const autoriza = (s, over = {}) => {
  const reg = S.emitirToken({ serieId: s.id, hash: S.hashEscaleta(s), topeMax: 10, costoMostrado: 5, ahora: 1000, nonce: 'n'.repeat(20) });
  return S.verificarToken(reg, { token: reg.token, serieId: s.id, hash: S.hashEscaleta(s), topeMax: 10, costoActual: 5, ...over }, 2000);
};

test('estados: transiciones válidas e inválidas', () => {
  for (const [de, a] of Object.entries(S.TRANSICIONES)) for (const x of a) assert.ok(S.ESTADOS.includes(x) && S.ESTADOS.includes(de));
  assert.equal(S.puedeIr('previsto', 'hecho'), false);
  assert.equal(S.puedeIr('hecho', 'corriendo'), false);
  assert.equal(S.puedeIr('cancelado', 'previsto'), false);
  assert.equal(S.transicion(serie(), 'espera_ok').ok, true);
  assert.equal(S.transicion(serie(), 'hecho').codigo, 'transicion');
});
test('empezar a gastar o reanudar exige autorización válida', () => {
  const s = serie();
  assert.equal(S.transicion(s, 'muestra').codigo, 'sin_autorizacion');
  const r = S.transicion(s, 'muestra', { autorizacion: autoriza(s) });
  assert.equal(r.ok, true);
  assert.equal(S.transicion({ ...s, estado: 'pausado' }, 'corriendo').codigo, 'sin_autorizacion');
  const p = S.transicion({ ...s, estado: 'corriendo' }, 'pausado', { motivo: 'tope' });
  assert.equal(p.serie.pausa_motivo, 'tope');
});
test('plano: versiones y aprobación por versión', () => {
  let p = S.crearPlano(plano(1));
  p = S.nuevaVersion(p, { archivo: 'x1.jpg' });
  assert.equal(S.aprobarVersion(p, 1).ok, true);
  const ok = S.aprobarVersion(p, 1).plano;
  assert.equal(S.aprobacionVigente(ok), true);
  const p2 = S.nuevaVersion(ok, { archivo: 'x2.jpg', intento: 2 });
  assert.equal(S.aprobacionVigente(p2), false);
  assert.equal(S.aprobarVersion(p2, 1).codigo, 'version');
  assert.equal(p2.versiones.length, 2);
});
test('escaleta: refs que exceden maxRefs -> skipped con motivo, sin recorte', () => {
  const r = S.validarEscaleta([plano(1, { modelo: 'flux', refs: ['a', 'b'] }), plano(2), plano(3, { modelo: 'raro' }), plano(4, { prompt_exacto: ' ' })], { capsDe });
  assert.equal(r.planos[0].estado, 'skipped'); assert.match(r.planos[0].motivo, /no se recorta/); assert.equal(r.planos[0].refs.length, 2);
  assert.equal(r.planos[1].estado, 'previsto');
  assert.equal(r.planos[2].estado, 'skipped'); assert.equal(r.planos[3].estado, 'skipped');
  assert.equal(r.omitidos, 3);
});
test('escaleta: vacía, repetidos, ref perdida y precios inventados', () => {
  assert.equal(S.validarEscaleta([], { capsDe }).ok, false);
  const r = S.validarEscaleta([plano(1), plano(1), plano(2, { refs: ['gone'] }), plano(3, { prompt_exacto: 'sofá por $499' }), plano(4, { prompt_exacto: 'sofá por US$ 899', texto_en_imagen: 'x' })],
    { capsDe, existeRef: id => id !== 'gone', preciosPermitidos: ['US$899'] });
  assert.deepEqual(r.planos.map(p => p.estado), ['previsto', 'skipped', 'skipped', 'skipped', 'previsto']);
  assert.deepEqual(r.problemas.map(p => p.codigo), ['numero', 'ref_perdida', 'precio']);
});
test('tandas de ≤8 planos', () => {
  assert.deepEqual(S.tandas(30).map(t => t.hasta - t.desde + 1), [8, 8, 8, 6]);
  assert.equal(S.validarTanda(new Array(9).fill({})).ok, false);
  assert.equal(S.validarTanda(new Array(8).fill({})).ok, true);
});
test('sha256 coincide con node:crypto (ASCII, UTF-8, bordes de bloque)', () => {
  for (const t of ['', 'abc', 'sofá cama — ñandú 🛋', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000)]) assert.equal(S.sha256(t), createHash('sha256').update(t).digest('hex'), t.slice(0, 8));
});
test('hash de la escaleta: estable al estado, sensible al contenido', () => {
  const s = serie(), h = S.hashEscaleta(s);
  assert.equal(S.hashEscaleta({ ...s, estado: 'corriendo', escaleta: s.escaleta.map(p => ({ ...p, estado: 'listo', versiones: [{ v: 1 }], version: 1 })) }), h);
  assert.notEqual(S.hashEscaleta({ ...s, escaleta: s.escaleta.map((p, i) => i ? p : { ...p, prompt_exacto: 'otro' }) }), h);
  assert.notEqual(S.hashEscaleta({ ...s, escaleta: s.escaleta.map((p, i) => i ? p : { ...p, refs: ['z'] }) }), h);
  assert.notEqual(S.hashEscaleta({ ...s, biblia_version: 3 }), h);
  assert.equal(S.hashEscaleta({ ...s, escaleta: s.escaleta.map(p => ({ ajustes: { b: 1, a: 2 }, ...p })) }), S.hashEscaleta({ ...s, escaleta: s.escaleta.map(p => ({ ajustes: { a: 2, b: 1 }, ...p })) }));
});
test('idempotencia serie_id:n:intento', () => {
  assert.equal(S.claveIdempotencia('s1', 3, 2), 's1:3:2');
  assert.deepEqual(S.parsearClave('s1:3:2'), { serieId: 's1', n: 3, intento: 2 });
  for (const a of [['', 1, 1], ['s1', 0, 1], ['s1', 1, 0], ['s:1', 1, 1], ['s1', 1.5, 1]]) assert.throws(() => S.claveIdempotencia(...a));
  assert.equal(S.parsearClave('basura'), null);
});
test('token: un solo uso, vence, hash, serie, tope y costo', () => {
  const s = serie(), reg = S.emitirToken({ serieId: 's1', hash: S.hashEscaleta(s), topeMax: 10, costoMostrado: 5, ahora: 1000, nonce: 'x'.repeat(24) });
  const pres = { token: reg.token, serieId: 's1', hash: S.hashEscaleta(s), topeMax: 10, costoActual: 5 };
  assert.equal(S.verificarToken(reg, pres, 1000 + 119999).ok, true);
  assert.equal(S.verificarToken(reg, pres, 1000 + 120000).codigo, 'vencido');
  assert.equal(S.verificarToken(S.consumirToken(reg), pres, 1500).codigo, 'usado');
  assert.equal(S.verificarToken(reg, { ...pres, token: 'y'.repeat(24) }, 1500).codigo, 'token');
  assert.equal(S.verificarToken(reg, { ...pres, serieId: 's2' }, 1500).codigo, 'serie');
  assert.equal(S.verificarToken(reg, { ...pres, hash: 'otro' }, 1500).codigo, 'hash');
  assert.equal(S.verificarToken(reg, { ...pres, topeMax: 99 }, 1500).codigo, 'tope');
  assert.equal(S.verificarToken(reg, { ...pres, costoActual: 5.01 }, 1500).codigo, 'costo');
  assert.equal(S.verificarToken(null, pres, 1500).ok, false);
  assert.throws(() => S.emitirToken({ serieId: 's', hash: 'h', topeMax: 1, costoMostrado: 1, ahora: 1, nonce: 'corto' }));
});
test('DINERO: sin token+hash válidos nunca sale una acción de gasto', () => {
  const s = serie({ estado: 'corriendo' });
  const malas = [undefined, null, {}, { ok: false }, { ok: true }, { ok: true, serieId: 's1', hash: 'falso', topeMax: 10 }, { ok: true, serieId: 'otra', hash: S.hashEscaleta(s), topeMax: 10 }, { ok: true, serieId: 's1', hash: S.hashEscaleta(s), topeMax: 0 }, { ok: 'true', serieId: 's1', hash: S.hashEscaleta(s), topeMax: 10 }];
  for (const a of malas) assert.notEqual(S.siguientePaso(s, { autorizacion: a }).tipo, 'gasto');
  const buena = autoriza(s), g = S.siguientePaso(s, { autorizacion: buena });
  assert.equal(g.tipo, 'gasto'); assert.equal(g.n, 1); assert.equal(g.intento, 1);
  // cambiar la escaleta después del clic invalida la autorización
  const tocada = { ...s, escaleta: s.escaleta.map((p, i) => i ? p : { ...p, prompt_exacto: 'distinto' }) };
  assert.notEqual(S.siguientePaso(tocada, { autorizacion: buena }).tipo, 'gasto');
  // estados que no gastan
  for (const e of ['previsto', 'espera_ok', 'pausado', 'hecho', 'cancelado']) assert.notEqual(S.siguientePaso({ ...s, estado: e }, { autorizacion: buena }).tipo, 'gasto');
});
test('DINERO: ninguna función exportada devuelve gasto llamada sin autorización', () => {
  for (const [nombre, f] of Object.entries(S)) {
    if (typeof f !== 'function') continue;
    for (const args of [[], [null], [{}], [serie({ estado: 'corriendo' })], [serie({ estado: 'corriendo' }), {}], [serie({ estado: 'muestra' }), { autorizacion: { ok: true } }]]) {
      let r; try { r = f(...args); } catch { continue; }
      assert.ok(!(r && typeof r === 'object' && (r.tipo === 'gasto' || r.gasto === true && nombre !== 'validarOpSerie')), `${nombre} devolvió gasto sin autorización`);
    }
  }
});
test('la muestra se detiene a los 3 planos', () => {
  const s = serie({ estado: 'muestra' }); s.escaleta = s.escaleta.map((p, i) => i < 3 ? { ...p, estado: 'listo' } : p);
  const r = S.siguientePaso(s, { autorizacion: autoriza(s) });
  assert.equal(r.tipo, 'espera'); assert.equal(r.codigo, 'muestra_lista');
});
test('ops de serie: no aprueban, no programan, no publican', () => {
  assert.equal(S.validarOpSerie({ tipo: 'serie_a_calendario', estado: 'revision', por: 'dimitri' }).ok, true);
  for (const op of [{ tipo: 'serie_a_calendario', estado: 'aprobada' }, { tipo: 'serie_a_calendario', estado: 'programada' }, { tipo: 'serie_a_calendario', piezas: [{ estado: 'aprobada' }] },
    { tipo: 'serie_a_calendario', aprobar: true }, { tipo: 'serie_a_calendario', programada_para: '2026-11-01' }, { tipo: 'serie_a_calendario', publicar: true },
    { tipo: 'serie_a_calendario', meta: { x: 1 } }, { tipo: 'serie_editar_escaleta', cambios: { aprobada_por: 'dimitri' } }, { tipo: 'serie_a_calendario', estado: 'borrador' }, { tipo: 'serie_a_calendario', por: 'agente' }]) {
    assert.equal(S.validarOpSerie(op).ok, false, JSON.stringify(op));
  }
  assert.equal(S.validarOpSerie({ tipo: 'pieza_aprobar' }).codigo, 'tipo');
});
test('ops de gasto: solo el dueño', () => {
  for (const por of ['agente', 'asistente', 'mcp', 'dimitri', undefined]) for (const tipo of S.OPS_GASTO_SERIE) assert.equal(S.validarOpSerie({ tipo }, { por }).ok, false);
  assert.equal(S.validarOpSerie({ tipo: 'serie_generar' }, { por: 'dueno' }).gasto, true);
});
test('referencias: producto > personaje > biblia > anterior', () => {
  let r = S.ajustarReferencias({ maxRefs: 3, producto: ['p1'], personaje: ['c1'], biblia: ['b1', 'b2'], anterior: ['x'] });
  assert.deepEqual(r.refs, ['p1', 'c1', 'b1']); assert.deepEqual(r.descartadas.map(d => d.ref), ['b2', 'x']);
  r = S.ajustarReferencias({ maxRefs: 4, producto: ['p1'], personaje: [], biblia: ['b1'], anterior: ['x', 'p1'] });
  assert.deepEqual(r.refs, ['p1', 'b1', 'x']); assert.equal(r.descartadas.length, 0);
  r = S.ajustarReferencias({ maxRefs: 1, producto: ['p1', 'p2'] });
  assert.equal(r.rechazo, true); assert.equal(r.ok, false);
  assert.equal(S.ajustarReferencias({ maxRefs: 0, producto: ['p1'] }).rechazo, true);
  assert.equal(S.ajustarReferencias({ maxRefs: 0 }).ok, true);
});
