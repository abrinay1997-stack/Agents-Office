// Series en la nube, N1: tablas (0200 y 0201), almacén con candado por versión, libro SQL (reserva atómica), poda y restablecer. SIN rutas, SIN bomba, SIN gasto: nada de esto llama a un motor.
// Todo con el tiempo como número fijo: ningún caso depende de la hora del día.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALTAR, crearD1, conLatencia } from './d1-memoria.mjs';
import { crearAlmacenD1, REINTENTOS } from '../worker/lib/series/almacen.js';
import * as L from '../worker/lib/series/libro.js';
import { seriesNubeActiva, seriesNubePagoActiva } from '../worker/lib/series/flags.js';
import { podar, RETENCION_DIAS } from '../worker/lib/mantenimiento.js';
import { DESTINOS, CONSERVA_TABLAS } from '../worker/lib/restablecer.js';
import { nuevoLibro, resumenLibro, reservar as pReservar, liquidar as pLiquidar, liberar as pLiberar, marcarIncierto as pIncierto, resolverIncierto as pResolver } from '../../serie-core.mjs';

const T0 = 1_800_000_000_000, DIA = 864e5;
const serie = (id = 'serie-1') => ({ id, titulo: id, brief: { formato: 'carrusel' }, biblia_version: 1, modelo_unico: 'prueba', tope_usd: 10,
  escaleta: [1, 2, 3].map((n) => ({ n, rol: 'desarrollo', prompt_exacto: `plano ${n}`, modelo: 'prueba', refs: [], ajustes: {}, estado: 'previsto', versiones: [] })) });
const R = (o = {}) => ({ clave: 's:1:1', serieId: 's', n: 1, intento: 1, maxMicro: 1_000_000, topeSerieMicro: 10_000_000, mes: '2026-10', dia: '2026-10-30', carrusel: false, topeMesMicro: 0, peso: 1, cupoDiaPeso: 0, ahora: T0, ...o });

test('d1-memoria rechaza lo que D1 rechaza: más de 100 parámetros y más de 5 términos compuestos', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  await assert.rejects(() => d1.prepare(`select ${'?,'.repeat(100)}?`).bind(...Array(101).fill(1)).first(), /too many SQL variables/);
  await d1.prepare(`select ${'?,'.repeat(99)}?`).bind(...Array(100).fill(1)).first(); // 100 sí
  await assert.rejects(() => d1.prepare('select 1 union select 2 union select 3 union select 4 union select 5 union select 6').all(), /compound/);
  await d1.prepare('select 1 union select 2 union select 3 union select 4 union select 5').all();
});

test('las migraciones crean las dos tablas, sin clave ajena en el libro', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  const cols = (t) => d1._db.prepare(`pragma table_info(${t})`).all().map((c) => c.name);
  assert.ok(cols('series').includes('version') && cols('series_libro').includes('max_micro'));
  assert.equal(d1._db.prepare('pragma foreign_key_list(series_libro)').all().length, 0, 'el libro es contabilidad: sin FK a series');
});

test('flags: apagados por defecto y solo `=== true` los enciende; el pago exige la serie en la nube', () => {
  for (const c of [undefined, null, {}, { dimitri: {} }, { dimitri: { seriesNube: 'true' } }, { dimitri: { seriesNube: 1 } }]) assert.equal(seriesNubeActiva(c), false);
  assert.equal(seriesNubePagoActiva({ dimitri: { seriesNubePago: true } }), false, 'sin seriesNube no vale');
  assert.equal(seriesNubePagoActiva({ dimitri: { seriesNube: true } }), false);
  assert.equal(seriesNubePagoActiva({ dimitri: { seriesNube: true, seriesNubePago: true } }), true);
});

/* ---------- almacén ---------- */
test('almacén: crear, leer, actualizar con versión y hash; no pisa un id existente', { skip: SALTAR }, async () => {
  const A = crearAlmacenD1(crearD1(), { ahora: () => T0, azar: () => 'abcd' });
  const a = await A.crear(serie()); assert.equal(a.estado, 'previsto'); assert.equal(a.v, 1); assert.ok(a.hash);
  const b = await A.crear(serie()); assert.equal(b.id, 'serie-1-abcd', 'el mismo id lleva un sufijo, nunca pisa');
  const c = await A.actualizar('serie-1', (s) => ({ ...s, estado: 'pausado' })); assert.equal(c.estado, 'pausado'); assert.equal(c.v, 2); assert.equal(c.escaleta_v, 1);
  const d = await A.actualizar('serie-1', (s) => { s.escaleta[0].prompt_exacto = 'otro'; return s; }); assert.equal(d.escaleta_v, 2); assert.notEqual(d.hash, a.hash);
  assert.equal((await A.actualizar('serie-1', () => undefined)).v, 3, 'undefined no escribe');
  assert.equal(await A.actualizar('no-existe', (s) => s), null);
  assert.equal(await A.estadoDe('serie-1'), 'pausado'); assert.equal((await A.todas()).length, 2); assert.equal(await A.uno('../x'), null);
  assert.deepEqual((await A.uno('serie-1')).pasos, {}, 'normalizada');
});
test('almacén: dos cambios a la vez (con latencia) se aplican los dos, nunca se pisan', { skip: SALTAR }, async () => {
  const base = crearD1(), A = crearAlmacenD1(conLatencia(base, { max: 5, semilla: 7 }), { ahora: () => T0 });
  await A.crear({ ...serie(), contador: 0 });
  await Promise.all(Array.from({ length: 4 }, () => A.actualizar('serie-1', (s) => ({ ...s, contador: s.contador + 1 }))));
  assert.equal((await A.uno('serie-1')).contador, 4, 'ningún incremento se perdió');
});
test('almacén: si no logra escribir en REINTENTOS vueltas, lanza (falla cerrado) y no guarda nada', { skip: SALTAR }, async () => {
  const d1 = crearD1(), A = crearAlmacenD1(d1, { ahora: () => T0 }); await A.crear(serie());
  const sucio = (sql) => d1.prepare(sql); // un competidor que sube la versión justo antes de cada escritura
  const mal = { ...d1, prepare: (sql) => (/^update series set json/.test(sql) ? { bind: (...a) => ({ run: async () => { d1._db.prepare('update series set version = version + 1 where id = ?').run('serie-1'); return sucio(sql).bind(...a).run(); } }) } : d1.prepare(sql)) };
  await assert.rejects(() => crearAlmacenD1(mal, { ahora: () => T0 }).actualizar('serie-1', (s) => ({ ...s, estado: 'cancelado' })), /demasiadas veces/);
  assert.notEqual(await A.estadoDe('serie-1'), 'cancelado'); assert.ok(REINTENTOS >= 3);
});
test('almacén: una serie demasiado grande no se guarda y una fila rota se salta', { skip: SALTAR }, async () => {
  const d1 = crearD1(), A = crearAlmacenD1(d1, { ahora: () => T0 });
  await assert.rejects(() => A.crear({ ...serie(), relleno: 'x'.repeat(1_100_000) }), /demasiado grande/);
  d1._db.prepare('insert into series (id, estado, version, json, creada, actualizada) values (?,?,?,?,?,?)').run('rota', 'previsto', 1, '{no es json', T0, T0);
  await A.crear(serie('buena')); assert.deepEqual((await A.todas()).map((s) => s.id), ['buena']);
});

/* ---------- libro ---------- */
test('libro: reservar es idempotente por clave y una liberada no se reutiliza', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  assert.deepEqual(await L.reservar(d1, R()), { ok: true });
  assert.deepEqual(await L.reservar(d1, R()), { ok: true, repetida: true });
  assert.equal((await L.resumenDeSerie(d1, 's')).reservado, 1_000_000, 'no se reservó dos veces');
  await L.liberar(d1, 's:1:1', { nuncaSalio: true });
  const r = await L.reservar(d1, R()); assert.equal(r.ok, false); assert.equal(r.codigo, 'liberada');
  assert.equal((await L.reservar(d1, R({ clave: '' }))).codigo, 'clave');
  assert.equal((await L.reservar(d1, R({ maxMicro: -1 }))).ok, false);
  assert.equal((await L.reservar(d1, R({ maxMicro: 1.5 }))).ok, false);
});
test('libro: tope de la serie, tope del mes de carruseles y cupo del día — cada uno con su código', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  assert.equal((await L.reservar(d1, R({ clave: 'a:1:1', serieId: 'a', maxMicro: 9_000_000 }))).ok, true);
  const t = await L.reservar(d1, R({ clave: 'a:2:1', serieId: 'a', maxMicro: 1_000_001 })); assert.equal(t.codigo, 'tope_serie');
  assert.equal((await L.reservar(d1, R({ clave: 'a:3:1', serieId: 'a', maxMicro: 1_000_000 }))).ok, true, 'exactamente el tope cabe');
  // mes: otras series de carruseles del mismo mes cuentan; las que no son carrusel no
  const d2 = crearD1();
  assert.equal((await L.reservar(d2, R({ clave: 'x:1:1', serieId: 'x', carrusel: true, maxMicro: 6_000_000, topeMesMicro: 10_000_000 }))).ok, true);
  assert.equal((await L.reservar(d2, R({ clave: 'n:1:1', serieId: 'n', carrusel: false, maxMicro: 9_000_000, topeMesMicro: 10_000_000 }))).ok, true, 'una serie que no es de carruseles no cuenta en el mes');
  const m = await L.reservar(d2, R({ clave: 'y:1:1', serieId: 'y', carrusel: true, maxMicro: 4_000_001, topeMesMicro: 10_000_000 })); assert.equal(m.codigo, 'tope_mes');
  assert.equal((await L.reservar(d2, R({ clave: 'y:1:2', serieId: 'y', carrusel: true, maxMicro: 4_000_000, topeMesMicro: 10_000_000 }))).ok, true);
  assert.equal((await L.reservar(d2, R({ clave: 'z:1:1', serieId: 'z', carrusel: true, mes: '2026-11', maxMicro: 9_000_000, topeMesMicro: 10_000_000 }))).ok, true, 'otro mes, otra cuenta');
  // cupo del día
  const d3 = crearD1();
  for (let i = 1; i <= 3; i++) assert.equal((await L.reservar(d3, R({ clave: `c:${i}:1`, serieId: 'c', n: i, maxMicro: 1, cupoDiaPeso: 3 }))).ok, true);
  assert.equal((await L.reservar(d3, R({ clave: 'c:4:1', serieId: 'c', n: 4, maxMicro: 1, cupoDiaPeso: 3 }))).codigo, 'cupo_dia');
  assert.equal((await L.reservar(d3, R({ clave: 'c:5:1', serieId: 'c', n: 5, maxMicro: 1, cupoDiaPeso: 3, dia: '2026-10-31' }))).ok, true, 'otro día');
  assert.equal(await L.usoDelDia(d3, '2026-10-30'), 3);
});
test('libro: el cupo del día solo se devuelve si se sabe que nada salió; un incierto sigue contando', { skip: SALTAR }, async () => {
  const d1 = crearD1();
  for (const [c, n] of [['a:1:1', 1], ['a:2:1', 2], ['a:3:1', 3]]) await L.reservar(d1, R({ clave: c, serieId: 'a', n, maxMicro: 1_000_000 }));
  await L.liberar(d1, 'a:1:1', { nuncaSalio: true }); await L.liberar(d1, 'a:2:1'); await L.marcarIncierto(d1, 'a:3:1');
  assert.equal(await L.usoDelDia(d1, '2026-10-30'), 2, 'la que nunca salió devolvió el cupo; la liberada tras salir y la incierta no');
  const r = await L.resumenDeSerie(d1, 'a'); assert.equal(r.reservado, 0); assert.equal(r.incierto, 1_000_000);
  assert.deepEqual((await L.inciertos(d1, 'a')).map((x) => x.clave), ['a:3:1']);
  assert.equal((await L.gastoDelMes(d1, '2026-10')), 0, 'sin carrusel no hay mes');
});
test('libro: liquidar anota el exceso y no se oculta; resolver incierto; las transiciones inválidas se explican', { skip: SALTAR }, async () => {
  const d1 = crearD1(); await L.reservar(d1, R({ clave: 'a:1:1', serieId: 'a', maxMicro: 1_000_000 })); await L.reservar(d1, R({ clave: 'a:2:1', serieId: 'a', n: 2, maxMicro: 1_000_000 }));
  assert.deepEqual(await L.liquidar(d1, 'a:1:1', 1_500_000), { ok: true });
  assert.deepEqual(await L.liquidar(d1, 'a:1:1', 1_500_000), { ok: true, repetida: true });
  assert.equal((await L.resumenDeSerie(d1, 'a')).excedido, true); assert.equal((await L.resumenDeSerie(d1, 'a')).gastado, 1_500_000);
  assert.equal((await L.liberar(d1, 'a:1:1')).codigo, 'no_reservado');
  assert.equal((await L.liquidar(d1, 'nada', 1)).codigo, 'sin_reserva');
  assert.equal((await L.resolverIncierto(d1, 'a:2:1', true)).codigo, 'no_incierto', 'solo se decide lo que está en duda');
  await L.marcarIncierto(d1, 'a:2:1'); assert.equal((await L.liquidar(d1, 'a:2:1', 1)).codigo, 'no_reservado', 'un incierto no se liquida solo');
  assert.deepEqual(await L.resolverIncierto(d1, 'a:2:1', true, 0), { ok: true });
  assert.equal((await L.lineaDe(d1, 'a:2:1')).real_micro, 1_000_000, 'con cobro y sin cifra se liquida con el máximo');
  assert.equal((await L.resolverIncierto(d1, 'a:2:1', false)).ok, false, 'decidir dos veces no cambia nada');
});
test('libro (concurrencia): 40 reservas a la vez con latencia nunca pasan del tope de la serie ni del mes', { skip: SALTAR }, async () => {
  const d1 = conLatencia(crearD1(), { max: 6, semilla: 3 });
  const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => L.reservar(d1, R({ clave: `p:${i + 1}:1`, serieId: 'p', n: i + 1, maxMicro: 700_000, topeSerieMicro: 10_000_000, carrusel: true, topeMesMicro: 6_000_000 }))));
  const ok = rs.filter((r) => r.ok).length;
  assert.equal(ok, 8, 'caben 8 de 700 mil en 6 millones del mes (el más estrecho)');
  const r = await L.resumenDeSerie(d1, 'p'); assert.ok(r.reservado <= 6_000_000);
  const d2 = conLatencia(crearD1(), { max: 6, semilla: 4 }), ids = Array.from({ length: 30 }, (_, i) => i + 1);
  await Promise.all(ids.map((i) => L.reservar(d2, R({ clave: `q:${i}:1`, serieId: 'q', n: i, maxMicro: 900_000, cupoDiaPeso: 7 }))));
  assert.equal(await L.usoDelDia(d2, '2026-10-30'), 7, 'el cupo del día tampoco se pasa');
});

/* ---------- el libro SQL es el espejo del libro puro (fuzz) ---------- */
test('fuzz: libro SQL y libro puro dan el mismo resumen en cada paso, y reservado + gastado + incierto ≤ tope', { skip: SALTAR }, async () => {
  for (let semilla = 1; semilla <= 12; semilla++) {
    let s = semilla >>> 0; const az = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32, pick = (l) => l[Math.floor(az() * l.length)];
    const d1 = crearD1(), topeMicro = 10_000_000, topeMes = 14_000_000, cupo = 12, nuncaSalio = new Set();
    let pl = nuevoLibro(10), n = 0;
    for (let i = 0; i < 120; i++) {
      const claves = Object.keys(pl.lineas), vivas = claves.filter((c) => pl.lineas[c].estado === 'reservado'), dudas = claves.filter((c) => pl.lineas[c].estado === 'incierto');
      const op = pick(['res', 'res', 'res', 'liq', 'lib', 'libn', 'inc', 'rep', 'resolver']);
      if (op === 'res' || (op === 'rep' && claves.length)) {
        const clave = op === 'rep' ? pick(claves) : `s:${++n}:1`, cents = 1 + Math.floor(az() * 400), r0 = resumenLibro(pl);
        const usado = claves.filter((c) => !nuncaSalio.has(c) || pl.lineas[c].estado !== 'liberado').length;
        const p = pReservar(pl, clave, cents / 100, { mes: { topeUsd: topeMes / 1e6, gastadoUsd: (r0.reservado + r0.gastado + r0.incierto) / 1e6 }, dia: { limit: Math.round(cupo / 0.75), usadoSeries: usado } });
        const q = await L.reservar(d1, R({ clave, serieId: 's', n: n || 1, maxMicro: cents * 10_000, topeSerieMicro: topeMicro, carrusel: true, topeMesMicro: topeMes, cupoDiaPeso: Math.floor(Math.round(cupo / 0.75) * 0.75) }));
        assert.equal(q.ok, p.ok, `semilla ${semilla} paso ${i}: reservar ${clave} (${q.codigo || ''} vs ${p.codigo || ''})`);
        if (p.ok) pl = p.libro;
      } else if (op === 'liq' && vivas.length) { const c = pick(vivas), real = Math.floor((pl.lineas[c].max / 1e6) * 100 * az()) / 100; pl = pLiquidar(pl, c, real).libro; assert.equal((await L.liquidar(d1, c, Math.round(real * 1e6))).ok, true); }
      else if ((op === 'lib' || op === 'libn') && vivas.length) { const c = pick(vivas); pl = pLiberar(pl, c).libro; if (op === 'libn') nuncaSalio.add(c); assert.equal((await L.liberar(d1, c, { nuncaSalio: op === 'libn' })).ok, true); }
      else if (op === 'inc' && vivas.length) { const c = pick(vivas); pl = pIncierto(pl, c).libro; assert.equal((await L.marcarIncierto(d1, c)).ok, true); }
      else if (op === 'resolver' && dudas.length) { const c = pick(dudas), cobro = az() < 0.5, real = cobro ? Math.floor((pl.lineas[c].max / 1e6) * 100 * az()) / 100 : 0; pl = pResolver(pl, c, cobro, real).libro; assert.equal((await L.resolverIncierto(d1, c, cobro, Math.round(real * 1e6))).ok, true); }
      const a = resumenLibro(pl), b = await L.resumenDeSerie(d1, 's');
      assert.deepEqual([b.reservado, b.gastado, b.incierto], [a.reservado, a.gastado, a.incierto], `semilla ${semilla} paso ${i}`);
      assert.ok(b.reservado + b.gastado + b.incierto <= topeMicro, 'nunca pasa del tope');
    }
  }
});

/* ---------- poda y restablecer ---------- */
test('poda: series terminadas a los 180 días y libro cerrado a los 400; lo vivo, lo reservado y lo incierto nunca', { skip: SALTAR }, async () => {
  const d1 = crearD1(), db = d1._db, ins = db.prepare('insert into series (id, estado, version, json, creada, actualizada) values (?, ?, 1, ?, ?, ?)');
  const viejo = T0 - 181 * DIA, joven = T0 - 10 * DIA;
  ins.run('hecha-vieja', 'hecho', '{}', viejo, viejo); ins.run('cancelada-vieja', 'cancelado', '{}', viejo, viejo); ins.run('hecha-joven', 'hecho', '{}', joven, joven);
  ins.run('viva-vieja', 'corriendo', '{}', viejo, viejo); ins.run('pausada-vieja', 'pausado', '{}', viejo, viejo);
  const lib = db.prepare(`insert into series_libro (clave, serie_id, n, intento, estado, max_micro, mes, dia, at) values (?, 'x', 1, 1, ?, 1, '2026-01', '2026-01-01', ?)`), muy = T0 - 401 * DIA;
  lib.run('l1', 'liquidado', muy); lib.run('l2', 'liberado', muy); lib.run('l3', 'reservado', muy); lib.run('l4', 'incierto', muy); lib.run('l5', 'liquidado', T0 - 30 * DIA);
  const n = await podar(d1, T0);
  assert.equal(n.series, 2); assert.equal(n.series_libro, 2);
  assert.deepEqual(db.prepare('select id from series order by id').all().map((r) => r.id), ['hecha-joven', 'pausada-vieja', 'viva-vieja']);
  assert.deepEqual(db.prepare('select clave from series_libro order by clave').all().map((r) => r.clave), ['l3', 'l4', 'l5']);
  assert.equal(RETENCION_DIAS.series, 180); assert.equal(RETENCION_DIAS.series_libro, 400);
});
test('restablecer: la serie se restablece con Dimitri y el libro del dinero se conserva siempre', () => {
  assert.ok(DESTINOS.dimitri.tablas.includes('series'));
  assert.ok(CONSERVA_TABLAS.includes('series_libro'));
  assert.ok(!Object.values(DESTINOS).some((d) => (d.tablas || []).includes('series_libro')), 'el libro no está en ningún ámbito');
});
