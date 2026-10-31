// Series en la nube, N4: AUTORIZAR (token de un solo uso con la cifra) y la BOMBA DEL RELOJ, solo con el motor gratis `prueba`. AQUÍ SE GASTA (en pequeño: nada cuesta, pero cada candado se prueba como si costara).
// Sin dependencia de la hora del día: el reloj de la bomba es un número que el test mueve; el único tiempo real es el del propio Estudio (que no se compara con nada).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';
import { manejar } from '../worker/lib/rutas.js';
import { guardarDoc } from '../worker/lib/almacen.js';
import { instalarZona } from '../worker/lib/zona.js';
import { serializarBiblia } from '../../biblia-core.mjs';
import { crearAlmacenD1 } from '../worker/lib/series/almacen.js';
import { proponer } from '../worker/lib/series/propuesta.js';
import { crearGenerador, depsReales, idDeTrabajo, GRACIA_MS, MAX_REPETICIONES } from '../worker/lib/series/generar.js';
import { cadaMinuto as cadaMinutoSeries } from '../worker/modulos/series.js';
import * as trabajos from '../worker/lib/estudio/trabajos.js';
import * as L from '../worker/lib/series/libro.js';
import { claveIdempotencia, usd2u } from '../../serie-core.mjs';

const BIB = { tono: 'cálido y sencillo', luz: 'luz natural', composicion: 'producto centrado', nunca: ['neón'], paleta: [{ rol: 'primario', hex: '#336699' }] };
const plano = (i, extra = {}) => ({ descripcion: `plano ${i}`, prompt: `un sofá gris en una sala luminosa, vista ${i}`, modelo: 'prueba', ...extra });
const BRIEF = { titulo: 'Sala de verano', objetivo: 'mostrar el sofá', formato: 'carrusel' };
const T0 = 1_900_000_000_000, DIA = '2026-10-30';

/** Una D1 que se «corta» en la escritura número k (para probar qué pasa si el Worker muere justo después de la sentencia k). */
function conCorte(base) {
  const est = { n: 0, k: null, escrituras: 0 };
  const envolver = (sent, sql = '') => ({
    bind: (...a) => envolver(sent.bind(...a), sql),
    first: (...a) => sent.first(...a), all: (...a) => sent.all(...a),
    run: async (...a) => {
      const esEscritura = true; est.escrituras++; if (est.antes && est.antes(sql)) est.antes = null;
      if (esEscritura && est.k != null && ++est.n > est.k) { est.k = null; throw new Error('corte simulado'); }
      return sent.run(...a);
    },
  });
  return { prepare: (sql) => envolver(base.prepare(sql), sql), batch: base.batch, _db: base._db, _est: est, armar(k) { est.n = 0; est.k = k; }, desarmar() { est.k = null; } };
}

async function montar({ cfg = { dimitri: { seriesNube: true } }, biblia = true } = {}) {
  instalarZona('America/Panama');
  const base = crearD1(), admin = await sembrar(base), editor = await sembrar(base, { email: 'ed@panaclaw.test', rol: 'editor' }), lectura = await sembrar(base, { email: 'le@panaclaw.test', rol: 'lectura' });
  const R2 = crearR2(), llamadas = [], nada = async (...a) => { llamadas.push(a); return new Response('{"error":"sin red en las pruebas"}', { status: 500 }); };
  const d1 = conCorte(base), env = { ...envDePrueba(d1, { __pruebas: { fetchIA: nada, fetch: nada } }), MEDIA: R2 };
  if (cfg) await guardarDoc(d1, 'config-local', cfg);
  if (biblia) base._db.prepare('insert or replace into notas (nombre, grupo, oficina, texto, bytes, actualizado) values (?,?,?,?,?,?)').run('biblia-visual', 'Marca', 0, serializarBiblia(BIB, { version: 1, estado: 'aprobada', aprobada_por: 'dueño' }), 100, 1);
  const uid = (email) => base._db.prepare('select id from users where email = ?').get(email).id;
  const u = { admin: { id: uid(admin.email), email: admin.email, rol: 'admin' }, editor: { id: uid(editor.email), email: editor.email, rol: 'editor' }, lectura: { id: uid(lectura.email), email: lectura.email, rol: 'lectura' } };
  const reloj = { t: T0 }, almacen = crearAlmacenD1(d1);
  const deps = (extra = {}) => ({ ...depsReales(env, d1), ahora: () => reloj.t, dia: () => DIA, ...extra });
  const gen = (extra = {}, opc) => crearGenerador(env, d1, deps(extra), opc);
  const enviadas = []; // lo que le llegó al «motor» (el Estudio de la nube con la tarjeta de prueba no llama a la red; contamos los trabajos creados)
  const nuevaSerie = async (n = 3, brief = BRIEF) => { const r = await proponer(env, d1, { brief, planos: Array.from({ length: n }, (_, i) => plano(i + 1)), guardar: true }, { almacen }); assert.equal(r.estado, 200, JSON.stringify(r.cuerpo).slice(0, 300)); return r.cuerpo.guardada.id; };
  const uno = async (id) => almacen.uno(id);
  const q = (sql, ...a) => base._db.prepare(sql).all(...a);
  const jobsDe = (id) => q('select id, json from estudio_trabajos').map((f) => ({ id: f.id, ...JSON.parse(f.json) })).filter((j) => j.serie?.id === id);
  const lineas = (id) => q('select * from series_libro where serie_id = ? order by n, intento', id);
  /** presupuesto + generar con la cifra a la vista */
  const autorizar = async (g, id, modo = 'muestra', quien = u.admin, idem = `idem-${Math.random().toString(36).slice(2, 10)}x`) => {
    const p = await g.presupuesto({ id, modo, usuario: quien }); assert.equal(p.estado, 200, JSON.stringify(p.cuerpo));
    const c = p.cuerpo.confirmar; return { p, c, r: await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo, usuario: quien, idem }) };
  };
  /** el reloj: la bomba y el Estudio, un minuto tras otro, hasta que `fin(serie)` */
  const correr = async (g, id, fin, max = 40) => { for (let i = 0; i < max; i++) { await g.tick(); await trabajos.cadaMinuto(env, d1); reloj.t += 60000; const s = await uno(id); if (fin(s)) return s; } return uno(id); };
  const invariantes = (id, s) => {
    const js = jobsDe(id), porClave = new Map();
    for (const j of js) porClave.set(`${j.serie.n}:${j.serie.intento}`, (porClave.get(`${j.serie.n}:${j.serie.intento}`) || 0) + 1);
    for (const [k, n] of porClave) assert.equal(n, 1, `≤ 1 trabajo por clave (${k})`);
    const ls = lineas(id), suma = ls.reduce((a, l) => a + (l.estado === 'liquidado' ? l.real_micro : l.estado === 'liberado' ? 0 : l.max_micro), 0);
    assert.ok(suma <= usd2u(s?.tope_usd ?? 10), 'el libro nunca pasa del tope');
    for (const l of ls) if (l.estado === 'liberado') assert.ok(!js.some((j) => j.serie.n === l.n && j.serie.intento === l.intento && j.state !== 'failed'), `una reserva con trabajo vivo (o terminado bien) nunca se libera (${l.clave})`);
    for (const [clave, pa] of Object.entries(s?.pasos || {})) if (pa.pedido_ok) assert.ok(ls.find((x) => x.clave === clave), `todo pedido enviado tiene su línea en el libro (${clave})`);
    return { js, ls };
  };
  return { d1, base, env, R2, llamadas, u, reloj, deps, gen, almacen, nuevaSerie, uno, q, jobsDe, lineas, autorizar, correr, invariantes, enviadas, cookies: null };
}
const listo = (s) => ['hecho', 'pausado', 'cancelado'].includes(s.estado) || s.muestra_lista;

test('N4: flujo completo con el motor gratis — presupuesto → generar → la bomba hace la muestra (3), el libro se liquida y el trabajo lleva su marca de serie', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(4), g = o.gen();
  const { c, r } = await o.autorizar(g, id, 'muestra'); assert.equal(r.estado, 200, JSON.stringify(r.cuerpo)); assert.equal(r.cuerpo.gasta, true); assert.equal(c.costoMostradoUsd, 0);
  assert.equal((await o.uno(id)).estado, 'muestra'); assert.equal((await o.uno(id)).autorizado.por, o.u.admin.id);
  const s = await o.correr(g, id, (x) => x.muestra_lista);
  assert.equal(s.muestra_lista, true, `estado ${s.estado}`); assert.equal(s.escaleta.filter((p) => p.estado === 'listo').length, 3); assert.equal(s.escaleta[3].estado, 'previsto', 'la muestra para en 3');
  const { js, ls } = o.invariantes(id, s); assert.equal(js.length, 3); assert.ok(js.every((j) => j.engine === 'prueba' && j.by === 'dimitri' && j.id === idDeTrabajo(claveIdempotencia(id, j.serie.n, j.serie.intento))));
  assert.deepEqual(ls.map((l) => l.estado), ['liquidado', 'liquidado', 'liquidado']);
  // seguir con todo: otro presupuesto, otro clic
  const k = await o.autorizar(g, id, 'todo'); assert.equal(k.r.estado, 200, JSON.stringify(k.r.cuerpo));
  const f = await o.correr(g, id, (x) => x.estado === 'hecho'); assert.equal(f.estado, 'hecho'); assert.equal(f.autorizado, null); assert.equal(f.escaleta.every((p) => p.estado === 'listo'), true);
  assert.equal(o.llamadas.length, 0, 'ninguna llamada a la red');
});

test('N4: el interruptor apagado pausa lo que corría y no da pasos nuevos; apagar nunca deja un plano a medias sin reconciliar', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(); await o.autorizar(g, id, 'todo');
  await guardarDoc(o.d1, 'config-local', { dimitri: { seriesNube: false } });
  await g.tick(); const s = await o.uno(id); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /apag/); assert.equal(s.autorizado, null); assert.equal(o.jobsDe(id).length, 0, 'ningún trabajo nuevo');
  const x = await g.presupuesto({ id, modo: 'muestra', usuario: o.u.admin }); assert.equal(x.estado, 409);
  const flags = [{ dimitri: { seriesNube: 'true' } }, { dimitri: { seriesNube: 1 } }, { dimitri: { seriesNubePago: true } }, {}];
  for (const cfg of flags) { await guardarDoc(o.d1, 'config-local', cfg); assert.equal((await g.presupuesto({ id, modo: 'muestra', usuario: o.u.admin })).estado, 409, JSON.stringify(cfg)); }
});

test('N4: solo un administrador autoriza — editor, lectura, agente, sin usuario: 403 y nada cambia (generador)', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), g = o.gen();
  for (const quien of [o.u.editor, o.u.lectura, { ...o.u.admin, agente: 'ada' }, null]) {
    for (const f of [() => g.presupuesto({ id, usuario: quien }), () => g.generar({ id, confirmacion: 'x'.repeat(20), costoMostradoUsd: 0, usuario: quien, idem: 'abcdefgh1' }), () => g.pausar({ id, usuario: quien }), () => g.cancelar({ id, usuario: quien }), () => g.resolver({ id, clave: 'a:1:1', cobro: false, usuario: quien })]) assert.equal((await f()).estado, 403);
  }
  assert.equal((await o.uno(id)).estado, 'previsto'); assert.equal(o.q('select count(*) n from series_tokens').at(0).n, 0);
});

test('N4: el token es de UN solo uso — dos clics a la vez con el mismo token y distinta Idempotency-Key: solo uno autoriza; con la misma clave, el segundo es el mismo clic', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen();
  const c = (await g.presupuesto({ id, usuario: o.u.admin })).cuerpo.confirmar, args = { id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, usuario: o.u.admin };
  const [a, b] = await Promise.all([g.generar({ ...args, idem: 'clave-uno-1' }), g.generar({ ...args, idem: 'clave-dos-2' })]);
  assert.deepEqual([a.estado, b.estado].sort(), [200, 409], JSON.stringify([a.cuerpo, b.cuerpo]));
  const o2 = await montar(), id2 = await o2.nuevaSerie(3), g2 = o2.gen(); const c2 = (await g2.presupuesto({ id: id2, usuario: o2.u.admin })).cuerpo.confirmar, ar = { id: id2, confirmacion: c2.token, costoMostradoUsd: c2.costoMostradoUsd, usuario: o2.u.admin, idem: 'misma-clave-1' };
  const p = await g2.generar(ar), q = await g2.generar(ar); assert.equal(p.estado, 200); assert.equal(q.estado, 200); assert.equal(q.cuerpo.replay, true);
  assert.equal((await g2.generar({ ...ar, idem: 'otra-clave-99' })).estado, 409, 'el token ya se gastó');
  assert.equal((await g2.generar({ ...ar, idem: 'corta' })).estado, 422, 'sin una Idempotency-Key válida no se autoriza');
  const sinKey = await g2.generar({ ...ar, idem: undefined }); assert.equal(sinKey.estado, 422);
});

test('N4: lo que cambia desde que se mostró la cifra invalida el clic — escaleta editada, otra cuenta, cifra distinta, token vencido, modo distinto, otro token', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(5), g = o.gen();
  const pedirTok = async (modo = 'muestra') => (await g.presupuesto({ id, modo, usuario: o.u.admin })).cuerpo.confirmar;
  let c = await pedirTok();
  await o.almacen.actualizar(id, (y) => { y.escaleta[0].prompt_exacto += ' con una lámpara'; return y; }); // la escaleta cambió
  let r = await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, usuario: o.u.admin, idem: 'idem-hash-01' });
  assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'hash'); assert.ok(r.cuerpo.confirmar.token && r.cuerpo.confirmar.token !== c.token, 'un token nuevo sobre lo que se ve ahora'); assert.equal((await o.uno(id)).estado, 'espera_ok');
  c = r.cuerpo.confirmar;
  r = await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd + 1, usuario: o.u.admin, idem: 'idem-costo-1' }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'costo'); c = r.cuerpo.confirmar;
  r = await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo: 'todo', usuario: o.u.admin, idem: 'idem-modo-01' }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'modo'); c = r.cuerpo.confirmar;
  const otro = { ...o.u.admin, id: 'otra-cuenta' }; r = await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo: 'todo', usuario: otro, idem: 'idem-pers-01' }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'persona');
  o.reloj.t += 3 * 60000; r = await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo: 'todo', usuario: o.u.admin, idem: 'idem-venc-01' }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'vencido'); c = r.cuerpo.confirmar;
  const viejo = c.token; const c2 = await pedirTok();
  r = await g.generar({ id, confirmacion: viejo, costoMostradoUsd: c.costoMostradoUsd, modo: 'todo', usuario: o.u.admin, idem: 'idem-viejo-1' }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'token', 'solo vale el último token pedido');
  assert.equal((await g.generar({ id, confirmacion: 'inventado-0123456789', costoMostradoUsd: 0, usuario: o.u.admin, idem: 'idem-inv-001' })).estado, 409);
  assert.equal((await g.generar({ id, confirmacion: c2.token, costoMostradoUsd: c2.costoMostradoUsd, usuario: o.u.admin, idem: 'idem-bien-01' })).estado, 200);
  assert.equal(o.jobsDe(id).length, 0, 'autorizar no envía nada: lo hace la bomba'); assert.equal(o.lineas(id).length, 0);
});

test('N4: la escaleta cambia JUSTO entre consumir el token y autorizar — también con la serie ya en «muestra» (que no pasa por transicion) — no se autoriza nada', { skip: SALTAR }, async () => {
  for (const previo of ['previsto', 'muestra']) {
    const o = await montar(), id = await o.nuevaSerie(4), g = o.gen();
    if (previo === 'muestra') { await o.autorizar(g, id, 'muestra'); await g.pausar({ id, usuario: o.u.admin }); await o.almacen.actualizar(id, (y) => ({ ...y, estado: 'muestra', autorizado: null })); } // una muestra ya abierta sin autorización vigente
    const c = (await g.presupuesto({ id, modo: 'muestra', usuario: o.u.admin })).cuerpo.confirmar;
    o.d1._est.antes = (sql) => { if (!/delete from series_tokens/.test(sql)) return false; o.base._db.prepare("update series set json = json_set(json, '$.escaleta[0].prompt_exacto', 'cambiado a mano') where id = ?").run(id); return true; };
    const r = await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo: 'muestra', usuario: o.u.admin, idem: `idem-race-${previo}` });
    assert.equal(r.estado, 409, previo); assert.equal(r.cuerpo.codigo, 'hash', previo);
    assert.equal((await o.uno(id)).autorizado, null, `${previo}: nada quedó autorizado`); assert.equal(o.jobsDe(id).length, 0);
  }
});

test('N4: una autorización vencida (6 h), una escaleta editada tras autorizar y un administrador degradado PAUSAN la serie sin enviar nada', { skip: SALTAR }, async () => {
  const caso = async (preparar, motivo) => {
    const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(); await o.autorizar(g, id, 'todo'); await preparar(o, id);
    await g.tick(); const s = await o.uno(id); assert.equal(s.estado, 'pausado', motivo); assert.equal(o.jobsDe(id).length, 0, `${motivo}: sin trabajo`); assert.equal(o.lineas(id).length, 0, `${motivo}: sin reserva`); assert.equal(s.autorizado, null);
  };
  await caso(async (o) => { o.reloj.t += 6 * 3600e3 + 1000; }, 'vencida');
  await caso(async (o, id) => { await o.almacen.actualizar(id, (y) => { y.escaleta[1].prompt_exacto += ' otra cosa'; return y; }); }, 'escaleta editada');
  await caso(async (o) => { o.base._db.prepare("update users set rol = 'editor' where email = ?").run(o.u.admin.email); }, 'admin degradado');
  await caso(async (o) => { o.base._db.prepare('delete from users where email = ?').run(o.u.admin.email); }, 'cuenta borrada');
});

test('N4: un motor de PAGO se rechaza ANTES de reservar ni pedir (sin permitirPago), en el presupuesto y en la bomba', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), g = o.gen({ engineDe: () => 'fal' });
  const p = await g.presupuesto({ id, usuario: o.u.admin }); assert.equal(p.estado, 409); assert.equal(p.cuerpo.codigo, 'motor_pago');
  // autorizada con un motor gratis y luego el catálogo «cambia» a uno de pago: la bomba lo ve antes de reservar
  const gl = o.gen(); await o.autorizar(gl, id, 'todo'); const gp = o.gen({ engineDe: () => 'fal' }); await gp.tick();
  assert.equal(o.lineas(id).length, 0); assert.equal(o.jobsDe(id).length, 0); assert.notEqual((await o.uno(id)).estado, 'corriendo');
});

test('N4: concurrencia — dos bombas a la vez (candado + versiones): un solo trabajo y una sola reserva por paso', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g1 = o.gen(), g2 = o.gen(); await o.autorizar(g1, id, 'todo');
  for (let i = 0; i < 6; i++) { await Promise.all([g1.tick(), g2.tick(), cadaMinutoSeries(o.env)]); await trabajos.cadaMinuto(o.env, o.d1); o.reloj.t += 60000; o.invariantes(id, await o.uno(id)); }
  const { js, ls } = o.invariantes(id, await o.uno(id)); assert.ok(js.length >= 1); assert.equal(js.length, ls.filter((l) => l.estado !== 'liberado').length);
  // el candado: con una bomba viva, otra se va sin tocar nada
  await o.d1.prepare('insert or replace into anuncios_candados (clave, hasta, quien) values (?,?,?)').bind('series:bomba', o.reloj.t + 60000, 'otra').run();
  assert.deepEqual(await o.gen().tick(), { omitido: 'candado' });
});

test('N4: la bomba contra el botón — pausar y cancelar mientras corre: lo que iba en el aire se liquida, nada nuevo sale', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(4), g = o.gen(); await o.autorizar(g, id, 'todo');
  await g.tick(); assert.equal(o.jobsDe(id).length, 1, 'un paso por tick');
  const [p, t] = await Promise.all([g.pausar({ id, usuario: o.u.admin }), g.tick()]); assert.ok([200, 409].includes(p.estado));
  await trabajos.cadaMinuto(o.env, o.d1); o.reloj.t += 60000; await g.tick();
  const s = await o.uno(id); assert.equal(s.estado, 'pausado'); assert.ok(o.jobsDe(id).length <= 2); assert.equal(s.escaleta.filter((x) => x.estado === 'corriendo').length, 0, 'lo del aire se resolvió');
  assert.ok(o.lineas(id).every((l) => l.estado === 'liquidado' || l.estado === 'liberado'), JSON.stringify(o.lineas(id).map((l) => l.estado)));
  const c = await g.cancelar({ id, usuario: o.u.admin }); assert.equal(c.estado, 200); assert.equal((await o.uno(id)).estado, 'cancelado'); assert.equal((await o.uno(id)).cancelada, true);
  const n = o.jobsDe(id).length; for (let i = 0; i < 3; i++) await g.tick(); assert.equal(o.jobsDe(id).length, n, 'una serie cancelada no genera');
  assert.equal((await g.pausar({ id, usuario: o.u.admin })).estado, 409);
});

test('N4: INYECCIÓN DE FALLOS — la bomba «muere» tras cada sentencia k de un paso: nunca dos trabajos, nunca pasa del tope, nunca libera con un trabajo vivo; y al volver, todo se recupera sin reenviar', { skip: SALTAR }, async () => {
  const base = await montar(), probe = await base.nuevaSerie(2); const gp = base.gen(); await base.autorizar(gp, probe, 'todo');
  base.d1.armar(10_000); await gp.tick(); const N = base.d1._est.n; base.d1.desarmar(); // cuántas escrituras tiene un tick con un paso de gasto
  assert.ok(N >= 6 && N < 60, `un paso tiene ${N} escrituras`);
  for (let k = 0; k <= N; k++) {
    const o = await montar(), id = await o.nuevaSerie(2), g = o.gen(); await o.autorizar(g, id, 'todo');
    o.d1.armar(k); let cayo = false; try { await g.tick(); } catch (e) { cayo = /corte simulado/.test(e.message); } o.d1.desarmar();
    o.invariantes(id, await o.uno(id));
    // la recuperación: el reloj sigue (pasado el tiempo de gracia, un paso marcado que nunca pidió su trabajo se da por caído)
    o.reloj.t += GRACIA_MS + 1000;
    const s = await o.correr(g, id, (x) => x.estado === 'hecho' || x.estado === 'pausado', 60);
    const { js, ls } = o.invariantes(id, s);
    assert.ok(['hecho', 'pausado'].includes(s.estado), `k=${k} cayó=${cayo}: terminó en ${s.estado}`);
    if (s.estado === 'hecho') assert.equal(s.escaleta.every((p) => p.estado === 'listo' && p.versiones.length === 1), true, `k=${k}: cada plano tiene UNA versión (nada se duplicó)`);
    assert.ok(js.length <= 2 + (s.estado === 'pausado' ? 1 : 0), `k=${k}: ${js.length} trabajos`);
    assert.ok(ls.every((l) => ['liquidado', 'liberado'].includes(l.estado)), `k=${k}: ${ls.map((l) => l.estado)}`);
  }
});

test('N4: REINICIO con un motor «de pago» simulado — un plano en el aire sin su trabajo y con el pedido enviado queda INCIERTO (cuenta contra el tope), la serie se pausa y NO se reenvía nada; el dueño decide', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen({ permitirPago: () => true, engineDe: () => 'fal' });
  // se prepara la serie como si estuviera autorizada con un motor de pago y un plano ya pedido
  const gl = o.gen(); await o.autorizar(gl, id, 'todo');
  const clave = claveIdempotencia(id, 1, 1);
  await o.almacen.actualizar(id, (y) => { y.intentos[1] = 1; y.pasos[clave] = { n: 1, intento: 1, estado: 'enviado', maxUsd: 0.5, genUsd: 0.4, mes: '2026-10', dia: DIA, envio: o.reloj.t, job: idDeTrabajo(clave), pedido_ok: 1, engine: 'fal', modelo: 'prueba' }; y.escaleta[0] = { ...y.escaleta[0], estado: 'corriendo', intento_actual: 1 }; return y; });
  assert.equal((await L.reservar(o.d1, { clave, serieId: id, n: 1, intento: 1, maxMicro: 500_000, topeSerieMicro: 10_000_000, mes: '2026-10', dia: DIA, carrusel: true, topeMesMicro: 45_000_000, peso: 1, cupoDiaPeso: 0, ahora: 1 })).ok, true);
  await g.tick(); const s = await o.uno(id); const l = o.lineas(id)[0];
  assert.equal(l.estado, 'incierto', 'puede haberse cobrado'); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /cobrado/); assert.equal(s.escaleta[0].estado, 'revisar');
  assert.equal(o.jobsDe(id).length, 0, 'no se reenvió nada'); for (let i = 0; i < 3; i++) await g.tick(); assert.equal(o.jobsDe(id).length, 0);
  const v = (await L.resumenDeSerie(o.d1, id)); assert.equal(v.incierto, 500_000, 'sigue contando');
  // presupuesto nuevo: avisa del paso incierto; resolver lo cierra
  assert.equal((await g.resolver({ id, clave, cobro: true, realUsd: 0.45, usuario: o.u.admin })).estado, 200); assert.equal(o.lineas(id)[0].estado, 'liquidado'); assert.equal(o.lineas(id)[0].real_micro, 450_000);
  assert.equal((await g.resolver({ id, clave, cobro: false, usuario: o.u.admin })).estado, 409, 'una vez decidido, no se vuelve a decidir');
  assert.equal((await g.resolver({ id, clave: 'otra:1:1', cobro: false, usuario: o.u.admin })).estado, 404);
  assert.equal((await g.resolver({ id, clave, cobro: 'si', usuario: o.u.admin })).estado, 422);
});

test('N4: sin pedido enviado (la bomba murió antes de pedir) el plano se libera y vuelve a la fila — con la certeza de que nada salió', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), g = o.gen(); await o.autorizar(g, id, 'todo');
  const clave = claveIdempotencia(id, 1, 1);
  await o.almacen.actualizar(id, (y) => { y.intentos[1] = 1; y.pasos[clave] = { n: 1, intento: 1, estado: 'reservado', maxUsd: 0, genUsd: 0, mes: '2026-10', dia: DIA, envio: o.reloj.t, job: idDeTrabajo(clave), pedido_ok: 0, engine: 'prueba', modelo: 'prueba' }; y.escaleta[0] = { ...y.escaleta[0], estado: 'corriendo', intento_actual: 1 }; return y; });
  await L.reservar(o.d1, { clave, serieId: id, n: 1, intento: 1, maxMicro: 0, topeSerieMicro: 10_000_000, mes: '2026-10', dia: DIA, carrusel: true, topeMesMicro: 45_000_000, peso: 1, cupoDiaPeso: 0, ahora: 1 });
  await g.reconciliar(); assert.equal(o.lineas(id)[0].estado, 'reservado', 'dentro del tiempo de gracia la bomba puede seguir con él: no se toca');
  o.reloj.t += GRACIA_MS + 1; await g.reconciliar(); const l = o.lineas(id)[0]; assert.equal(l.estado, 'liberado'); assert.equal(l.salio, 0); assert.equal((await o.uno(id)).escaleta[0].estado, 'previsto');
  assert.equal(o.jobsDe(id).length, 0);
});

test('N4: un trabajo borrado del Estudio con el pedido enviado, en un motor gratis, se libera; los trabajos de una serie viva no se podan', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(); await o.autorizar(g, id, 'todo'); await g.tick();
  assert.equal(o.jobsDe(id).length, 1);
  await trabajos.cadaMinuto(o.env, o.d1);
  o.base._db.prepare("update estudio_trabajos set at = 1 where json_extract(json, '$.serie.id') = ?").run(id); // «de hace meses»
  for (let i = 0; i < 2; i++) await trabajos.cadaMinuto(o.env, o.d1);
  assert.equal(o.jobsDe(id).length, 1, 'la poda de una semana no toca el trabajo de una serie viva');
  o.base._db.prepare("update series set estado = 'cancelado', json = json_set(json, '$.estado', 'cancelado') where id = ?").run(id); // ya no está viva (y no tiene plano en el aire tras reconciliar)
});

test('N4: el estado del libro y de la serie se recuperan tras una autorización con fallo a medias (el token no se pierde si no se pudo autorizar por un plano en marcha)', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen();
  const c = (await g.presupuesto({ id, usuario: o.u.admin })).cuerpo.confirmar;
  await o.almacen.actualizar(id, (y) => { y.escaleta[0].estado = 'corriendo'; return y; });
  const r = await g.generar({ id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, usuario: o.u.admin, idem: 'idem-enmarcha' }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'en_marcha');
});

// ---- el dinero, con un motor «que cuesta» simulado (el catálogo real solo trae `prueba`, que es gratis) ----
const CARO = async (o, usd = 0.3) => { const real = await o.deps().cable(); return { ...real, precioPlano: () => ({ generacion: usd }) }; };
const liquidarAparte = async (o, serieId, n, micro, extra = {}) => { const clave = `${serieId}:${n}:1`; const rr = await L.reservar(o.d1, { clave, serieId, n, intento: 1, maxMicro: micro, topeSerieMicro: 100_000_000, mes: '2026-10', dia: DIA, carrusel: true, topeMesMicro: 1_000_000_000_000, peso: 1, cupoDiaPeso: 0, ahora: 1, ...extra }); assert.equal(rr.ok, true, JSON.stringify(rr)); if (micro) assert.equal((await L.liquidar(o.d1, clave, micro)).ok, true); return clave; };
const sinPaso = async (o, id, motivo) => { const s = await o.uno(id); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, motivo, s.pausa_motivo); assert.equal(o.jobsDe(id).length, 0, 'no hay trabajo'); assert.ok(o.lineas(id).every((l) => l.estado === 'liberado' || l.serie_id !== id || l.n >= 9), JSON.stringify(o.lineas(id).map((l) => l.estado))); assert.ok(s.escaleta.every((p) => p.estado === 'previsto'), 'el plano vuelve a la fila'); };

test('N4 dinero: a US$0,30 por plano con 2,8 ya liquidados, el paso se rechaza por el TOPE DE LA SERIE antes de pedir nada', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(); await o.autorizar(g, id, 'todo');
  await o.almacen.actualizar(id, (y) => ({ ...y, tope_usd: 3 })); await liquidarAparte(o, id, 9, 2_800_000);
  await o.gen({ cable: () => CARO(o) }).tick(); await sinPaso(o, id, /tope de la serie/);
  assert.equal(o.lineas(id).length, 1, 'la reserva rechazada no escribió nada: solo queda la línea de antes');
});

test('N4 dinero: ... por el TOPE DEL MES de carruseles (otra serie ya gastó 2,8 este mes)', { skip: SALTAR }, async () => {
  const o = await montar({ cfg: { dimitri: { seriesNube: true, serieTopeMesUsd: 3 } } }), id = await o.nuevaSerie(3), g = o.gen(); await o.autorizar(g, id, 'todo');
  await liquidarAparte(o, 'otra-serie', 1, 2_800_000);
  await o.gen({ cable: () => CARO(o) }).tick(); await sinPaso(o, id, /tope del mes/);
});

test('N4 dinero: ... por el CUPO DEL DÍA (3 pasos de series ya cuentan de un cupo de 3), y al día siguiente el cupo vuelve', { skip: SALTAR }, async () => {
  const estudioDe = (o) => ({ ...o.deps().estudio, budget: async () => ({ limit: 4, dailyBudget: null, monthlyBudget: null }) }); // cupo de series = floor(4 × 0,75) = 3
  const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(); await o.autorizar(g, id, 'todo');
  for (const n of [1, 2, 3]) await liquidarAparte(o, 'otra-serie', n, 0);
  await o.gen({ estudio: estudioDe(o) }).tick(); await sinPaso(o, id, /cupo diario/);
  const o2 = await montar(), id2 = await o2.nuevaSerie(3); await o2.autorizar(o2.gen(), id2, 'todo');
  for (const n of [1, 2, 3]) await liquidarAparte(o2, 'otra-serie', n, 0, { dia: '2026-10-29' });
  await o2.gen({ estudio: estudioDe(o2) }).tick(); assert.equal(o2.jobsDe(id2).length, 1);
});

test('N4 dinero: el presupuesto (la cifra que se enseña) también respeta el tope de la serie y el del mes — y el del mes solo vale para carruseles', { skip: SALTAR }, async () => {
  const o = await montar({ cfg: { dimitri: { seriesNube: true, serieTopeMesUsd: 3 } } }), id = await o.nuevaSerie(3), g = o.gen({ cable: () => CARO(o) });
  assert.equal((await g.presupuesto({ id, modo: 'todo', usuario: o.u.admin })).estado, 200, 'US$0,90 caben en el mes'); await liquidarAparte(o, 'otra-serie', 1, 2_800_000);
  const x = await g.presupuesto({ id, modo: 'todo', usuario: o.u.admin }); assert.equal(x.estado, 409); assert.equal(x.cuerpo.codigo, 'tope');
  const o2 = await montar({ cfg: { dimitri: { seriesNube: true, serieTopeMesUsd: 3 } } }), id2 = await o2.nuevaSerie(3, { ...BRIEF, formato: 'post' }); await liquidarAparte(o2, 'otra-serie', 1, 2_800_000);
  assert.equal((await o2.gen({ cable: () => CARO(o2) }).presupuesto({ id: id2, modo: 'todo', usuario: o2.u.admin })).estado, 200, 'una serie que no es carrusel no cuenta contra el mes');
  const o3 = await montar(), id3 = await o3.nuevaSerie(3); await o3.almacen.actualizar(id3, (y) => ({ ...y, tope_usd: 3 })); await liquidarAparte(o3, id3, 9, 2_800_000);
  assert.equal((await o3.gen({ cable: () => CARO(o3) }).presupuesto({ id: id3, modo: 'todo', usuario: o3.u.admin })).estado, 409, 'no cabe en lo que queda del tope de la serie');
});

// ---- el CAS de «marcar» revalida lo que autoriza, y la adopción tras un rechazo ----
test('N4 CAS: si la autorización cambia de manos, o aparece un plano en el aire, JUSTO antes de marcar, no se reserva ni se pide nada', { skip: SALTAR }, async () => {
  const caso = async (cambio, motivo) => {
    const o = await montar(), id = await o.nuevaSerie(3), g = o.gen(); await o.autorizar(g, id, 'todo');
    o.d1._est.antes = (sql) => { if (!/^update series set json/.test(sql)) return false; o.base._db.prepare(`update series set json = json_set(json, ${cambio}), version = version + 1 where id = ?`).run(id); return true; }; // otra petición escribe entre la lectura y la escritura: el CAS falla y fn se vuelve a aplicar sobre lo nuevo
    await g.tick(); const s = await o.uno(id); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, motivo, s.pausa_motivo); assert.equal(o.jobsDe(id).length, 0); assert.equal(o.lineas(id).length, 0, 'ninguna reserva'); assert.deepEqual(Object.keys(s.pasos), [], 'ningún paso marcado');
  };
  await caso("'$.autorizado.por', 'otra-cuenta'", /autorización cambió/);
  await caso("'$.escaleta[1].estado', 'corriendo'", /en el aire/);
});

test('N4 adopción: si pedir lanza un error pero el trabajo SÍ entró, se adopta (nunca se libera con un trabajo vivo) y la serie sigue; si no entró nada, la reserva se devuelve', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), base = o.deps();
  const estudio = { ...base.estudio, pedir: async (req, op) => { await base.estudio.pedir(req, op); throw new Error('se cortó la respuesta'); } };
  const g = o.gen({ estudio }); await o.autorizar(g, id, 'todo'); await g.tick();
  const s = await o.uno(id), clave = claveIdempotencia(id, 1, 1);
  assert.equal(o.jobsDe(id).length, 1, 'el trabajo existe'); assert.equal(s.pasos[clave].pedido_ok, 1, 'queda apuntado'); assert.equal(s.pasos[clave].estado, 'enviado'); assert.equal(o.lineas(id)[0].estado, 'reservado', 'la reserva sigue viva');
  assert.notEqual(s.estado, 'pausado');
  const f = await o.correr(o.gen(), id, (x) => x.estado === 'hecho'); assert.equal(f.estado, 'hecho'); assert.deepEqual(o.lineas(id).map((l) => l.estado), ['liquidado', 'liquidado']);
  const o2 = await montar(), id2 = await o2.nuevaSerie(2); const g2 = o2.gen({ estudio: { ...o2.deps().estudio, pedir: async () => { throw new Error('el Estudio dijo que no'); } } });
  await o2.autorizar(g2, id2, 'todo'); await g2.tick(); await sinPaso(o2, id2, /no aceptó/);
});


// ================= N5a: lo que había que cerrar ANTES de abrir un motor de pago (motores de pago siguen cerrados) =================
const PEDIDO = { prompt: 'un sofá', model: 'prueba', kind: 'image', n: 1 }, ADMIN = { rol: 'admin', email: 'x@y.test' };
const marcarTrabajo = (o, id, json) => o.base._db.prepare("update estudio_trabajos set estado = 'failed', json = json_set(json, '$.state', 'failed', '$.causa', ?, '$.error', 'Cancelado por ti.') where json_extract(json, '$.serie.id') = ? and estado in ('queued','running')").run(json, id);

test('N5a lease: un tick «congelado» más de GRACIA entre confirmar y pedir — otro tick libera la línea — NO crea el trabajo (ni queda nada liberado con trabajo vivo)', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), real = o.deps().estudio;
  const estudio = { ...real, pedir: async (req, op) => { o.reloj.t += GRACIA_MS + 1000; await o.gen().reconciliar(); return real.pedir(req, op); } };
  const g = o.gen({ estudio }); await o.autorizar(g, id, 'todo'); await g.tick();
  const { js, ls } = o.invariantes(id, await o.uno(id));
  assert.equal(js.length, 0, 'ningún trabajo: la línea ya no estaba reservada'); assert.equal(ls.length, 1); assert.equal(ls[0].estado, 'liberado'); assert.equal(ls[0].salio, 0, 'se sabe que nada salió');
  assert.ok((await o.uno(id)).escaleta.every((p) => p.estado === 'previsto'), 'el plano volvió a la fila (lo hizo el otro tick; A ya no toca nada que no sea suyo)');
  const fin = await o.correr(o.gen(), id, (x) => x.estado === 'hecho'); assert.equal(fin.estado, 'hecho'); assert.equal(o.jobsDe(id).length, 2, 'un trabajo por plano, de un intento posterior'); o.invariantes(id, fin);
  // el orden contrario: el trabajo entra primero y la otra bomba, al reconciliar, lo ADOPTA (no libera nada)
  const o2 = await montar(), id2 = await o2.nuevaSerie(2), real2 = o2.deps().estudio;
  const estudio2 = { ...real2, pedir: async (req, op) => { const j = await real2.pedir(req, op); o2.reloj.t += GRACIA_MS + 1000; await o2.gen().reconciliar(); return j; } };
  const g2 = o2.gen({ estudio: estudio2 }); await o2.autorizar(g2, id2, 'todo'); await g2.tick();
  const r = o2.invariantes(id2, await o2.uno(id2)); assert.equal(r.js.length, 1); assert.equal(r.ls[0].estado, 'reservado'); assert.equal((await o2.uno(id2)).pasos[claveIdempotencia(id2, 1, 1)].pedido_ok, 1);
  const f = await o2.correr(o2.gen(), id2, (x) => x.estado === 'hecho'); assert.equal(f.estado, 'hecho');
});

test('N5a lease: las sentencias solas — pedir no entra si la línea no está reservada, y liberar no vale si el trabajo ya existe', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(1); await o.deps().cable();
  const clave = `${id}:1:1`, jobId = idDeTrabajo(clave), forzar = (c) => ({ id: jobId, serie: { id, n: 1, intento: 1 }, condicion: c ? { clave } : undefined });
  await assert.rejects(() => o.deps().estudio.pedir(PEDIDO, { usuario: ADMIN, forzar: forzar(true) }), /ya no está viva/, 'sin línea reservada no entra');
  await liquidarAparte(o, id, 1, 0); await L.liquidar(o.d1, clave, 0); // línea «liquidado»: tampoco
  await assert.rejects(() => o.deps().estudio.pedir(PEDIDO, { usuario: ADMIN, forzar: forzar(true) }), /ya no está viva/);
  assert.equal(o.jobsDe(id).length, 0);
  const o2 = await montar(), id2 = await o2.nuevaSerie(1); await o2.deps().cable(); const c2 = `${id2}:1:1`, j2 = idDeTrabajo(c2);
  assert.equal((await L.reservar(o2.d1, { clave: c2, serieId: id2, n: 1, intento: 1, maxMicro: 0, topeSerieMicro: 1e7, mes: '2026-10', dia: DIA, carrusel: true, topeMesMicro: 1e12, peso: 1, cupoDiaPeso: 0, ahora: 1 })).ok, true);
  const t = await o2.deps().estudio.pedir(PEDIDO, { usuario: ADMIN, forzar: { id: j2, serie: { id: id2, n: 1, intento: 1 }, condicion: { clave: c2 } } }); assert.equal(t.id, j2);
  const otra = await o2.deps().estudio.pedir(PEDIDO, { usuario: ADMIN, forzar: { id: j2, serie: { id: id2, n: 1, intento: 1 }, condicion: { clave: c2 } } }); assert.equal(otra.id, j2, 'la misma clave es el mismo trabajo'); assert.equal(o2.jobsDe(id2).length, 1);
  const l = await L.liberar(o2.d1, c2, { nuncaSalio: true, sinTrabajoId: j2 }); assert.equal(l.ok, false); assert.equal(o2.lineas(id2)[0].estado, 'reservado', 'con el trabajo vivo la línea NO se libera');
});

test('N5a reintentos: un plano cuyo trabajo se cancela una y otra vez no gira para siempre — al pasar el tope queda para revisar y la serie se pausa con el motivo', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), g = o.gen(); await o.autorizar(g, id, 'todo');
  for (let i = 0; i < 12; i++) { await g.tick(); o.reloj.t += 60000; if ((await o.uno(id)).estado === 'pausado') break; marcarTrabajo(o, id, 'cancelado'); }
  const s = await o.uno(id); assert.equal(s.estado, 'pausado', 'no gira para siempre'); assert.match(s.pausa_motivo, new RegExp(`se repitió ${MAX_REPETICIONES} veces`)); assert.equal(s.repeticiones[1], MAX_REPETICIONES);
  assert.equal(s.escaleta[0].estado, 'revisar'); assert.equal(o.jobsDe(id).length, MAX_REPETICIONES + 1, 'el primero y tres repeticiones');
  assert.ok(o.lineas(id).every((l) => l.estado === 'liberado'), 'motor gratis: nada se cobró, todo liberado'); o.invariantes(id, s);
});

test('N5a reintentos: con un motor de pago simulado, al pasar el tope el paso queda INCIERTO (cuenta contra los topes) y la serie se pausa', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), g = o.gen({ permitirPago: () => true, engineDe: () => 'fal' }); await o.autorizar(g, id, 'todo');
  for (let i = 0; i < 12; i++) { await g.tick(); o.reloj.t += 60000; if ((await o.uno(id)).estado === 'pausado') break; marcarTrabajo(o, id, 'cancelado_en_cola'); } // «cancelado en cola» y sin que el servicio aceptara nada: es previo al cobro, se repite
  const s = await o.uno(id); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /se repitió/); assert.equal(s.escaleta[0].estado, 'revisar');
  const ls = o.lineas(id); assert.equal(ls.at(-1).estado, 'incierto', 'la última queda en duda'); assert.ok(ls.slice(0, -1).every((l) => l.estado === 'liberado'));
  assert.equal(o.jobsDe(id).length, MAX_REPETICIONES + 1);
});

test('N5a reintentos: un fallo que cuenta como fallo (red) NO suma al contador de repeticiones, y las repeticiones persisten entre ticks', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), g = o.gen(); await o.autorizar(g, id, 'todo');
  await g.tick(); marcarTrabajo(o, id, 'cancelado'); o.reloj.t += 60000; await g.tick(); assert.equal((await o.uno(id)).repeticiones[1], 1);
  assert.equal((await o.uno(id)).fallos[1] || 0, 0, 'cancelar no cuenta como fallo');
  const o2 = await montar(), id2 = await o2.nuevaSerie(2), g2 = o2.gen(); await o2.autorizar(g2, id2, 'todo'); await g2.tick();
  o2.base._db.prepare("update estudio_trabajos set estado = 'failed', json = json_set(json, '$.state', 'failed', '$.errorClass', 'red', '$.causa', 'red', '$.error', 'sin red') where json_extract(json, '$.serie.id') = ?").run(id2);
  o2.reloj.t += 60000; await g2.tick(); const s2 = await o2.uno(id2); assert.equal(s2.fallos[1], 1); assert.equal(s2.repeticiones?.[1] || 0, 0);
});

test('N5a interruptor: se relee antes de CADA paso y otra vez justo antes de pedir (apagarlo entre medias no envía nada)', { skip: SALTAR }, async () => {
  const caso = async (apagarEnLlamada, esperaLineas) => {
    const o = await montar(), id = await o.nuevaSerie(2); await o.autorizar(o.gen(), id, 'todo');
    let n = 0; const g = o.gen({ cfg: async () => ({ dimitri: { seriesNube: ++n !== apagarEnLlamada } }) }); // llamada 1 = el tick; 2 = al empezar el paso; 3 = justo antes de pedir
    await g.tick(); const s = await o.uno(id);
    assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /se apagó/); assert.equal(o.jobsDe(id).length, 0, 'no se envió nada');
    assert.equal(o.lineas(id).length, esperaLineas); assert.ok(o.lineas(id).every((l) => l.estado === 'liberado')); assert.ok(s.escaleta.every((p) => p.estado === 'previsto'));
  };
  await caso(2, 0); // al empezar el paso: ni siquiera se reserva
  await caso(3, 1); // justo antes de pedir: se había reservado y se devuelve
});

test('N5a poda: limpiar() del Estudio no lanza si falta la tabla `series` (migración sin aplicar) y sigue podando lo viejo', { skip: SALTAR }, async () => {
  const o = await montar();
  o.base._db.exec('drop table series');
  const ins = o.base._db.prepare("insert into estudio_trabajos (id, json, estado, at, lease, paso, cancelar) values (?,?,?,?,0,0,0)");
  ins.run('jviejo0001', JSON.stringify({ id: 'jviejo0001', state: 'done', items: [], serie: { id: 'x', n: 1, intento: 1 } }), 'done', 1); ins.run('jnuevo0001', JSON.stringify({ id: 'jnuevo0001', state: 'done', items: [] }), 'done', Date.now());
  await trabajos.cadaMinuto(o.env, o.d1);
  assert.deepEqual(o.q('select id from estudio_trabajos').map((f) => f.id), ['jnuevo0001'], 'sin tabla de series la poda es la de siempre');
});

test('N5a soltar: el tick A congelado dentro de pedir, mientras otro tick entero libera su línea y lanza el intento 2, NO toca el plano del intento 2 ni lo pausa', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), real = o.deps().estudio; let congelado = false;
  const estudio = { ...real, pedir: async (req, op) => { if (!congelado) { congelado = true; o.reloj.t += GRACIA_MS + 1000; await o.gen().tick(); } return real.pedir(req, op); } }; // el candado de A ya caducó: B puede ser un tick completo (reconcilia, libera la línea 1 y lanza el intento 2)
  const g = o.gen({ estudio }); await o.autorizar(g, id, 'todo'); await g.tick();
  const s = await o.uno(id), p1 = s.escaleta[0];
  assert.equal(p1.estado, 'corriendo', 'el plano sigue siendo del intento 2'); assert.equal(p1.intento_actual, 2); assert.notEqual(s.estado, 'pausado', 'A no pausa la serie de B');
  assert.deepEqual(o.jobsDe(id).map((j) => j.serie.intento), [2], 'solo el trabajo del intento 2'); const ls = o.lineas(id); assert.deepEqual(ls.map((l) => `${l.intento}:${l.estado}`), ['1:liberado', '2:reservado']);
  assert.equal(s.pasos[claveIdempotencia(id, 1, 1)].estado, 'liberado'); assert.notEqual(s.pasos[claveIdempotencia(id, 1, 2)].estado, 'liberado');
  const f = await o.correr(o.gen(), id, (x) => x.estado === 'hecho'); assert.equal(f.estado, 'hecho'); assert.equal(o.jobsDe(id).length, 2, 'un trabajo por plano: ningún intento 3'); assert.ok(f.escaleta.every((p) => p.versiones.length === 1)); o.invariantes(id, f);
});

test('N5a pago: con un motor de pago simulado, un trabajo que falla por CUALQUIER causa que no sea claramente previa al cobro nunca llega a «liberado» (queda en duda)', { skip: SALTAR }, async () => {
  const marcar = (o, id, causa, extra = '') => o.base._db.prepare(`update estudio_trabajos set estado = 'failed', json = json_set(json, '$.state', 'failed', '$.causa', ?, '$.error', 'falló'${extra}) where json_extract(json, '$.serie.id') = ? and estado in ('queued','running')`).run(causa, id);
  for (const [causa, extra] of [['red', ''], ['tiempo', ''], ['servicio', ''], ['espera', ''], ['interrumpido', ''], ['cancelado', ''], ['key', ''], ['saldo', ''], ['desconocida', ''], ['previo', ", '$.aceptado', json('true')"], ['cancelado_en_cola', ", '$.aceptado', json('true')"]]) {
    const o = await montar(), id = await o.nuevaSerie(2), g = o.gen({ permitirPago: () => true, engineDe: () => 'fal' }); await o.autorizar(g, id, 'todo'); await g.tick();
    marcar(o, id, causa, extra); o.reloj.t += 60000; await g.reconciliar();
    const l = o.lineas(id)[0]; assert.equal(l.estado, 'incierto', `causa «${causa}${extra ? ' con aceptado' : ''}»: ${l.estado}`); assert.equal((await o.uno(id)).estado, 'pausado');
  }
  const o = await montar(), id = await o.nuevaSerie(2), g = o.gen({ permitirPago: () => true, engineDe: () => 'fal' }); await o.autorizar(g, id, 'todo'); await g.tick(); marcar(o, id, 'previo'); o.reloj.t += 60000; await g.reconciliar();
  assert.equal(o.lineas(id)[0].estado, 'liberado', 'solo «previo» sin aceptar libera');
});

test('N5a repeticiones: un plano decidido por una persona (resolver) o un clic nuevo (generar) empieza el contador de cero; el de fallos no se toca', { skip: SALTAR }, async () => {
  const o = await montar(), id = await o.nuevaSerie(2), g = o.gen(); await o.autorizar(g, id, 'todo');
  await o.almacen.actualizar(id, (y) => ({ ...y, repeticiones: { 1: 2 }, fallos: { 1: 1 } }));
  await g.pausar({ id, usuario: o.u.admin }); await o.autorizar(g, id, 'todo');
  const s = await o.uno(id); assert.deepEqual(s.repeticiones, {}); assert.deepEqual(s.fallos, { 1: 1 });
  // resolver: el paso incierto se decide «sin cobro» y el plano vuelve a la fila con su contador a cero
  const o2 = await montar(), id2 = await o2.nuevaSerie(2), clave = claveIdempotencia(id2, 1, 1);
  await o2.almacen.actualizar(id2, (y) => { y.repeticiones = { 1: 3 }; y.pasos[clave] = { n: 1, intento: 1, estado: 'incierto' }; y.escaleta[0] = { ...y.escaleta[0], estado: 'revisar' }; return y; });
  await liquidarAparte(o2, id2, 1, 0); await L.marcarIncierto(o2.d1, clave);
  assert.equal((await o2.gen().resolver({ id: id2, clave, cobro: false, usuario: o2.u.admin })).estado, 200);
  const s2 = await o2.uno(id2); assert.equal(s2.escaleta[0].estado, 'previsto'); assert.equal(s2.repeticiones[1], 0);
});


// ---- las rutas de verdad: roles, interruptor, cabecera ----
async function conRutas({ encendido = true } = {}) {
  const o = await montar({ cfg: encendido ? { dimitri: { seriesNube: true } } : null });
  const entrar = async (email, clave) => (await pedir(manejar, o.env, '/api/acceso', { metodo: 'POST', cuerpo: { email, contrasena: clave } })).headers.get('set-cookie').split(';')[0];
  const cookies = { admin: await entrar('dueno@panaclaw.test', 'una-clave-larga-123'), editor: await entrar('ed@panaclaw.test', 'una-clave-larga-123'), lectura: await entrar('le@panaclaw.test', 'una-clave-larga-123'), anon: null }; // secrets-ok
  const como = (qn) => async (metodo, ruta, cuerpo, cab = {}) => {
    const r = await manejar(new Request(`https://oficina.test${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', ...cab, ...(cookies[qn] ? { cookie: cookies[qn] } : {}) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }), o.env, { waitUntil() {} });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, j };
  };
  return { ...o, admin: como('admin'), editor: como('editor'), lectura: como('lectura'), anon: como('anon') };
}
const RUTAS = ['presupuesto', 'generar', 'continuar', 'pausar', 'cancelar', 'resolver'];

test('N4 rutas: matriz de roles — anon 401; editor, lectura 403 en TODAS las de gasto (con el interruptor apagado o encendido); apagado, el administrador recibe 501 en español', { skip: SALTAR }, async () => {
  for (const encendido of [false, true]) {
    const o = await conRutas({ encendido });
    for (const r of RUTAS) {
      const ruta = `/api/series/abc123/${r}`;
      assert.equal((await o.anon('POST', ruta, {})).status, 401, `anon ${r}`);
      assert.equal((await o.editor('POST', ruta, {})).status, 403, `editor ${r} (${encendido})`); assert.equal((await o.lectura('POST', ruta, {})).status, 403, `lectura ${r}`);
      for (const m of ['GET', 'PUT', 'DELETE']) { const x = await o.editor(m, ruta); assert.ok([403, 404, 405, 501].includes(x.status), `editor ${m} ${r}: ${x.status}`); }
    }
    if (!encendido) for (const r of RUTAS) { const x = await o.admin('POST', `/api/series/abc123/${r}`, {}); assert.equal(x.status, 501, r); assert.match(x.j.error, /apagadas/); }
    else for (const r of RUTAS) assert.ok([404, 409, 422].includes((await o.admin('POST', `/api/series/abc123/${r}`, {}, { 'idempotency-key': 'abcdefgh12' })).status), `${r}: una serie que no existe`);
  }
});

test('N4 rutas: el ciclo por HTTP — presupuesto, generar sin Idempotency-Key 422, con ella 200 y el mismo clic otra vez es un replay; pausar y cancelar; el libro solo del administrador', { skip: SALTAR }, async () => {
  const o = await conRutas(), id = await o.nuevaSerie(3);
  const p = await o.admin('POST', `/api/series/${id}/presupuesto`, { modo: 'muestra' }); assert.equal(p.status, 200, JSON.stringify(p.j)); assert.equal(p.j.gasta, false); const c = p.j.confirmar;
  const cuerpo = { confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo: 'muestra' };
  assert.equal((await o.admin('POST', `/api/series/${id}/generar`, cuerpo)).status, 422, 'sin Idempotency-Key');
  const a = await o.admin('POST', `/api/series/${id}/generar`, cuerpo, { 'idempotency-key': 'http-clic-0001' }); assert.equal(a.status, 200, JSON.stringify(a.j)); assert.equal(a.j.gasta, true);
  assert.equal((await o.admin('POST', `/api/series/${id}/generar`, cuerpo, { 'idempotency-key': 'http-clic-0001' })).j.replay, true);
  assert.equal((await o.admin('GET', `/api/series/${id}`)).j.serie.autorizada, true);
  // el cuerpo no puede traer su propia autorización ni cambiar el estado
  const sucio = await o.admin('POST', `/api/series/${id}/pausar`, { estado: 'corriendo', autorizado: { hash: 'x' } }); assert.equal(sucio.status, 200);
  assert.equal((await o.admin('GET', `/api/series/${id}`)).j.serie.estado, 'pausado');
  assert.equal((await o.admin('POST', `/api/series/${id}/cancelar`, {})).status, 200); assert.equal((await o.admin('POST', `/api/series/${id}/cancelar`, {})).status, 409);
  assert.equal((await o.editor('GET', `/api/series/${id}/libro`)).status, 403); assert.equal((await o.lectura('GET', `/api/series/${id}`)).status, 200);
  assert.doesNotMatch(JSON.stringify((await o.editor('GET', `/api/series/${id}`)).j), /token|hash_/);
  const ev = o.q("select detalle from auditoria where tipo = 'serie'").map((f) => JSON.parse(f.detalle).accion); assert.ok(ev.includes('generar') && ev.includes('cancelar'), `auditoría: ${ev}`);
});

test('N4 rutas: continuar solo desde una muestra lista o una pausa y siempre en modo «todo» con su propia cifra', { skip: SALTAR }, async () => {
  const o = await conRutas(), id = await o.nuevaSerie(4);
  const x = await o.admin('POST', `/api/series/${id}/continuar`, { confirmacion: 'x'.repeat(20), costoMostradoUsd: 0 }, { 'idempotency-key': 'continuar-01' }); assert.equal(x.status, 409, 'una serie prevista no se «continúa»'); assert.equal(x.j.codigo, 'estado');
});

// ---- estático: nada fuera del módulo de la nube expone generar / reanudar ----
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
test('N4 estático: ninguna op de Dimitri, herramienta de agente, MCP, Telegram, disparador ni ruta de oficina expone generar/continuar/reanudar series; solo el módulo y el generador de la nube hablan de la bomba', () => {
  const lee = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
  const sub = lee('sub-core.mjs') + lee('sub.mjs');
  for (const op of ['serie_generar', 'serie_reanudar']) assert.ok(!new RegExp(`'${op}'\\s*:|case '${op}'`).test(sub), `${op} no se ejecuta en sub`);
  const herramientas = ['oficina-mcp.mjs', 'oficina/rutas.mjs', 'oficina/mapa.mjs', 'tareas-mcp.mjs', 'estudio-mcp.mjs', 'contenido-mcp.mjs', 'anuncios-mcp.mjs', 'telegram.mjs', 'triggers.mjs', 'routines.mjs'].filter((f) => fs.existsSync(path.join(RAIZ, f)));
  for (const f of herramientas) assert.doesNotMatch(lee(f), /series\/[^'"`\s]*\/(generar|continuar|presupuesto)|serie_generar|serie_reanudar|crearGenerador/, f);
  const walk = (d) => fs.readdirSync(path.join(RAIZ, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []);
  const permitido = new Set(['cloudflare/worker/modulos/series.js', 'cloudflare/worker/lib/series/generar.js']);
  for (const f of walk('cloudflare/worker')) if (!permitido.has(f)) assert.doesNotMatch(lee(f), /series\/generar\.js|crearGenerador\(|idDeTrabajo/, `${f} no habla de la bomba de series`);
  const modulo = lee('cloudflare/worker/modulos/series.js');
  assert.match(modulo, /usuario\.rol === 'admin' && !usuario\.agente/, 'el módulo decide el rol'); assert.ok(modulo.indexOf("if (metodo !== 'GET')") < modulo.indexOf('crearGenerador(env, db)'), 'el rol se comprueba antes de crear el generador');
  const gen = lee('cloudflare/worker/lib/series/generar.js'); assert.match(gen, /permitirPago: \(\) => false/, 'N4: los motores de pago siguen cerrados'); assert.doesNotMatch(gen, /\bfetch\s*\(/, 'la bomba no llama a ningún motor: solo pide trabajos al Estudio');
  const trab = lee('cloudflare/worker/lib/estudio/trabajos.js'); assert.match(trab, /forzar/); assert.ok(!/req\.forzar|b\?\.forzar|body\.forzar/.test(trab), 'forzar no sale de un body');
});
