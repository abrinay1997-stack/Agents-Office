// Fase 11.5 PR B (30 oct 2026): GENERAR SERIE — el token de un solo uso, la bomba, los topes, la reserva y la liquidación, el reinicio y la cancelación. AQUÍ SE GASTA, así que se prueba
// con un Estudio de mentira (un motor «de pago» que contesta lo que el test decide) y con la oficina real SOLO con el motor gratis «prueba». Nunca una key real. Sin hora del día:
// el reloj, el día y el nonce se inyectan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as B from '../biblia-core.mjs';
import * as P from '../serie-propuesta-core.mjs';
import { crearAlmacen, vistaSerie, origenPermitido, crearCandado } from '../series.mjs';
import { crearGenerador } from '../series-generar.mjs';
import { crearSeries } from '../serie-local.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bib = B.normalizarBiblia({ paleta: [{ rol: 'primario', hex: '#1a2b3c' }], luz: 'cálida', nunca: ['fondos oscuros'], reglas: [] });
const aprobada = { existe: true, version: 1, estado: 'aprobada', biblia: bib };
const plano = (n, x = {}) => ({ n, rol: 'desarrollo', descripcion: `plano ${n}`, prompt: `Un sofá gris en la sala, toma ${n}`, ...x });
const ren = (a, b) => fs.renameSync(a, b);
const tmp = t => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-gen-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

/** Un Estudio de mentira: los trabajos los termina el test. `motor` dice si el motor es «de pago» o el gratis. */
function estudio(o = {}) {
  const E = { lista: [], enviados: [], rechazar: null, tope: null, limit: 40, motor: 'google', cancelas: [],
    models: () => [{ id: 'nb', engine: E.motor, kind: 'image', on: true }],
    budget: () => ({ limit: E.limit, dailyBudget: 0, monthlyBudget: 0 }),
    checkBudget(est) { if (E.tope != null && est > E.tope + 1e-9) throw new Error(`presupuesto del día del Estudio: esto cuesta aprox. US$${est} y quedan US$${E.tope}`); },
    submit(req) { if (E.rechazar) throw new Error(E.rechazar); const j = { id: 'j' + E.lista.length, state: 'queued', serie: req.serie, items: [], cost: 0, engine: E.motor, kind: 'image', error: null }; E.lista.push(j); E.enviados.push(req); return j; },
    job: id => E.lista.find(j => j.id === id) || null, jobs: () => E.lista, cancel(id) { E.cancelas.push(id); },
    ok(id, cost = 0.08) { Object.assign(E.job(id), { state: 'done', items: ['2026-10/x' + id + '.png'], cost }); },
    falla(id, error, errorClass = 'otro', causa = errorClass) { Object.assign(E.job(id), { state: 'failed', error, errorClass, causa }); },
    ...o };
  return E;
}
function montar(t, { n = 5, precio = 0.1, config = {}, extra = {}, planos = null, E = estudio() } = {}) {
  const f = path.join(tmp(t), 'series.json'), A = crearAlmacen({ archivo: f, renombrar: ren });
  const est = { t: 1_000_000, nonce: 0, precio, config: { reintentosMax: 1, ...config }, biblia: aprobada, activo: true, dia: '2026-10-30', audit: [] };
  const G = crearGenerador({ almacen: A, media: E, biblia: { leer: () => est.biblia }, capsDe: () => ({ maxRefs: 4 }), precioPlano: () => ({ generacion: est.precio }), config: () => est.config, activo: () => est.activo,
    ahora: () => est.t, nonce: () => 'nonce-' + String(++est.nonce).padStart(12, '0'), hoy: () => est.dia, auditar: l => est.audit.push(l), intervalo: 10, ...extra });
  const p = P.armarPropuesta({ brief: { titulo: 'Sofá', objetivo: 'vender' }, planos: planos || Array.from({ length: n }, (_, i) => plano(i + 1)), biblia: aprobada, hojas: [],
    ctx: { id: 'serie-1', capsDe: () => ({ maxRefs: 4 }), existeRef: () => true, precioPlano: () => ({ generacion: precio }), modeloUnico: 'nb', config: { reintentosMax: 1, ...config } } });
  const s = A.crear(p.serie, { costo_mostrado_usd: p.costoMostradoUsd });
  return { G, A, E, est, id: s.id, otra: () => crearAlmacen({ archivo: f, renombrar: ren }) };
}
const pedir = (o, modo = 'muestra') => o.G.generar({ id: o.id, modo }).cuerpo.confirmar;
const confirmar = (o, c, extra = {}) => o.G.generar({ id: o.id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo: c.modo, ...extra });
const autorizar = (o, modo = 'muestra') => { const c = pedir(o, modo), r = confirmar(o, c); assert.equal(r.estado, 200, JSON.stringify(r.cuerpo)); return r; };
const ticks = async (o, k = 1) => { for (let i = 0; i < k; i++) await o.G.tick(); };
const terminarUno = async (o, cost = 0.08) => { const j = o.E.lista.find(x => x.state === 'queued'); assert.ok(j, 'hay un trabajo en el aire'); o.E.ok(j.id, cost); await o.G.tick(); return j; };
const vista = o => o.A.uno(o.id);
const hastaHecho = async (o, k = 8) => { for (let i = 0; i < k; i++) { await ticks(o); const j = o.E.lista.find(x => x.state === 'queued'); if (j) o.E.ok(j.id); await ticks(o); } };

test('1 · pedir el clic NO gasta ni reserva ni envía: devuelve la cifra y un token, y la serie queda «espera_ok»', t => {
  const o = montar(t, { n: 5 }), r = o.G.generar({ id: o.id });
  assert.equal(r.estado, 200); const c = r.cuerpo.confirmar; assert.equal(r.cuerpo.gasta, false); assert.equal(c.planos, 3, 'la muestra son 3'); assert.equal(c.costoMostradoUsd, 0.6, '3 × (US$0,10 × 2 intentos posibles)'); assert.equal(c.topeUsd, 10);
  assert.match(c.texto, /gasta hasta US\$0\.6/); assert.equal(c.vence - o.est.t, 120000);
  const s = vista(o); assert.equal(s.estado, 'espera_ok'); assert.equal(s.libro, null, 'nada reservado'); assert.equal(s.autorizado, null); assert.equal(o.E.enviados.length, 0);
  assert.equal(o.G.generar({ id: o.id, modo: 'todo' }).cuerpo.confirmar.costoMostradoUsd, 1, 'todo: 5 × 0,20');
});

test('2 · agente 403, flag apagado 409, serie que no existe 404, modo raro 422 — y ninguno cambia nada', t => {
  const o = montar(t); const antes = JSON.stringify(vista(o));
  assert.equal(o.G.generar({ id: o.id, por: 'agente' }).estado, 403);
  o.est.activo = false; assert.equal(o.G.generar({ id: o.id }).estado, 409); o.est.activo = true;
  assert.equal(o.G.generar({ id: 'nada' }).estado, 404); assert.equal(o.G.generar({ id: o.id, modo: 'gratis' }).estado, 422); assert.equal(o.G.generar({}).estado, 404);
  assert.equal(JSON.stringify(vista(o)), antes); assert.equal(o.G.resolver({ id: o.id, clave: 'x', cobro: true, por: 'agente' }).estado, 403);
});

test('3 · el token: inválido (no quema el bueno), sin pedirlo antes, ya usado y vencido', async t => {
  const o = montar(t), sin = o.G.generar({ id: o.id, confirmacion: 'xyz', costoMostradoUsd: 0.6 }); assert.equal(sin.cuerpo.codigo, 'token', 'sin pedirlo antes');
  const c = pedir(o);
  const mal = o.G.generar({ id: o.id, confirmacion: 'nonce-000000000999', costoMostradoUsd: c.costoMostradoUsd }); assert.equal(mal.estado, 409); assert.equal(mal.cuerpo.codigo, 'token'); assert.equal(mal.cuerpo.confirmar, undefined, 'un token malo no recibe uno nuevo');
  assert.equal(vista(o).libro, null); assert.equal(o.E.enviados.length, 0);
  const r = confirmar(o, c); assert.equal(r.estado, 200, 'el bueno sigue valiendo'); assert.equal(vista(o).token_reg.usado, true);
  const dos = confirmar(o, c); assert.equal(dos.estado, 409); assert.equal(dos.cuerpo.codigo, 'usado', 'el mismo token no autoriza dos veces'); assert.equal(dos.cuerpo.confirmar, undefined);
  const p = montar(t); const c2 = pedir(p); p.est.t += 120001; const v = confirmar(p, c2);
  assert.equal(v.estado, 409); assert.equal(v.cuerpo.codigo, 'vencido'); assert.ok(v.cuerpo.confirmar && v.cuerpo.confirmar.token !== c2.token, 'trae uno nuevo con la cifra de ahora');
  assert.equal(p.E.enviados.length, 0); await ticks(p, 3); assert.equal(p.E.enviados.length, 0, 'sin clic no hay gasto');
  assert.equal(confirmar(p, v.cuerpo.confirmar).estado, 200, 'y con el nuevo sí');
});

test('3b · un token ya gastado no sirve otra vez aunque la serie vuelva a estar pausada y sin nada en el aire', async t => {
  const o = montar(t); const c = pedir(o); assert.equal(confirmar(o, c).estado, 200); await ticks(o); o.est.activo = false; o.E.ok('j0'); await ticks(o); o.est.activo = true; // el plano 1 queda liquidado y no arranca otro
  o.A.actualizar(o.id, y => ({ ...y, estado: 'pausado', autorizado: null, pausa_motivo: 'x' }));
  const re = confirmar(o, c); assert.equal(re.estado, 409); assert.equal(re.cuerpo.codigo, 'token', 'pausar borró el token: ese ya no existe y no recibe uno nuevo'); assert.equal(re.cuerpo.confirmar, undefined); assert.equal(o.E.enviados.length, 1);
});

test('4 · si cambia el hash, el costo, un tope o el modo entre la cifra y el clic: 409 con la cifra nueva y otro token; nunca gasta por la vieja', async t => {
  { const o = montar(t); const c = pedir(o); o.A.actualizar(o.id, y => { y.escaleta[0].prompt_exacto += ' otro encuadre'; return y; });
    const r = confirmar(o, c); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'hash'); assert.ok(r.cuerpo.confirmar.hash !== c.hash); assert.equal(o.E.enviados.length, 0); await ticks(o, 2); assert.equal(o.E.enviados.length, 0);
    assert.equal(confirmar(o, r.cuerpo.confirmar).estado, 200); }
  { const o = montar(t); const c = pedir(o); o.est.precio = 0.2; const r = confirmar(o, c); assert.equal(r.cuerpo.codigo, 'costo'); assert.equal(r.cuerpo.costoActualUsd, 1.2); assert.equal(r.cuerpo.confirmar.costoMostradoUsd, 1.2); assert.equal(o.E.enviados.length, 0);
    o.est.precio = 0.1; const c3 = pedir(o); o.est.precio = 0.05; assert.equal(confirmar(o, c3).estado, 200, 'si el precio BAJA no se gasta más de lo mostrado: pasa'); }
  { const o = montar(t); const c = pedir(o); const r = confirmar(o, c, { costoMostradoUsd: 0.1 }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'costo', 'la cifra que se confirma debe ser la mostrada'); assert.equal(o.E.enviados.length, 0); }
  { const o = montar(t); const c = pedir(o); o.est.config.topeSerieUsd = 5; const r = confirmar(o, c); assert.equal(r.cuerpo.codigo, 'tope'); assert.equal(r.cuerpo.topeUsd, 5); assert.equal(o.E.enviados.length, 0); }
  { const o = montar(t); const c = pedir(o); o.E.budget = () => ({ limit: 40, dailyBudget: 3, monthlyBudget: 0 }); assert.equal(confirmar(o, c).cuerpo.codigo, 'tope', 'cambiar el tope del Estudio también invalida el clic'); }
  { const o = montar(t, { n: 3 }); const c = pedir(o, 'muestra'); const r = confirmar(o, { ...c, modo: 'todo' }); assert.equal(r.cuerpo.codigo, 'modo'); assert.equal(o.E.enviados.length, 0); }
  { const o = montar(t); const c = pedir(o); o.est.biblia = { ...aprobada, version: 2 }; assert.equal(o.G.generar({ id: o.id, confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd }).cuerpo.codigo, 'biblia'); }
  { const o = montar(t, { n: 3, config: { topeSerieUsd: 0.5 } }); const r = o.G.generar({ id: o.id, modo: 'todo' }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'tope', 'el máximo (US$0,60) no cabe en US$0,50: no hay token'); }
});

test('5 · DOS clics a la vez con el mismo token: uno solo corre; cada plano se envía una vez', async t => {
  const o = montar(t, { n: 3 }), c = pedir(o, 'todo'), a = confirmar(o, c), b = confirmar(o, c); // el servidor atiende una petición tras otra: el segundo ya ve el token usado
  assert.deepEqual([a.estado, b.estado].sort(), [200, 409]);
  await hastaHecho(o, 3);
  assert.equal(o.E.enviados.length, 3); assert.deepEqual(o.E.enviados.map(r => r.serie.n).sort(), [1, 2, 3]); assert.equal(vista(o).estado, 'hecho');
});

test('6 · la bomba: la muestra de 3, un paso a la vez, marca serie:{id,n,intento}, y se espera tu decisión; luego «todo» termina', async t => {
  const o = montar(t, { n: 5 }); autorizar(o); assert.equal(vista(o).estado, 'muestra');
  await ticks(o); assert.equal(o.E.enviados.length, 1); const r1 = o.E.enviados[0];
  assert.deepEqual(r1.serie, { id: o.id, n: 1, intento: 1 }); assert.equal(r1.by, 'dimitri'); assert.equal(r1.kind, 'image'); assert.equal(r1.n, 1); assert.match(r1.prompt, /Biblia visual v1/); assert.match(r1.purpose, /plano 1/);
  await ticks(o, 3); assert.equal(o.E.enviados.length, 1, 'un paso a la vez: no envía otro mientras el primero está en el aire');
  let s = vista(o); assert.equal(s.escaleta[0].estado, 'corriendo'); assert.equal(s.libro.lineas[`${o.id}:1:1`].estado, 'reservado'); assert.equal(s.libro.lineas[`${o.id}:1:1`].max, 100000, 'reserva el máximo de UN intento (US$0,10)');
  assert.equal(o.A.usoDe(o.est.dia), 1, 'el cupo diario de series cuenta');
  await terminarUno(o); s = vista(o); assert.equal(s.escaleta[0].estado, 'listo'); assert.equal(s.escaleta[0].versiones.length, 1); assert.equal(s.libro.lineas[`${o.id}:1:1`].estado, 'liquidado'); assert.equal(s.libro.lineas[`${o.id}:1:1`].real, 80000, 'liquida lo real (US$0,08), no lo reservado');
  await ticks(o); await terminarUno(o); await ticks(o); await terminarUno(o); await ticks(o, 3);
  s = vista(o); assert.equal(o.E.enviados.length, 3); assert.equal(s.estado, 'muestra'); assert.equal(s.muestra_lista, true, 'la muestra está lista: espera tu decisión'); assert.deepEqual(s.escaleta.map(p => p.estado), ['listo', 'listo', 'listo', 'previsto', 'previsto']);
  assert.equal(o.G.generar({ id: o.id, modo: 'muestra' }).cuerpo.codigo, 'nada', 'la muestra no se repite');
  const c = pedir(o, 'todo'); assert.equal(c.planos, 2); assert.equal(c.costoMostradoUsd, 0.4, 'solo lo que falta'); assert.equal(confirmar(o, c).estado, 200);
  await hastaHecho(o, 3);
  s = vista(o); assert.equal(s.estado, 'hecho'); assert.equal(s.autorizado, null); assert.equal(o.E.enviados.length, 5); assert.equal(new Set(o.E.enviados.map(r => r.serie.n)).size, 5);
  const v = vistaSerie(s); assert.equal(v.gasto.gastadoUsd, 0.4); assert.equal(v.gasto.reservadoUsd, 0); assert.equal(v.gasto.mayorQueLoMostrado, false);
});

test('7 · un plano «skipped» jamás se genera, y la bomba no se confunde con él', async t => {
  const o = montar(t, { planos: [plano(1), plano(2, { prompt: '' }), plano(3)] }); assert.equal(vista(o).escaleta[1].estado, 'skipped');
  const c = pedir(o, 'todo'); assert.equal(c.planos, 2); confirmar(o, c); await hastaHecho(o, 3);
  assert.deepEqual(o.E.enviados.map(r => r.serie.n).sort(), [1, 3]); assert.equal(vista(o).estado, 'hecho'); assert.equal(vista(o).escaleta[1].estado, 'skipped');
});

test('8 · el tope de la serie corta A MITAD: pausa con motivo, no envía más, y seguir pide otro clic', async t => {
  const o = montar(t, { n: 4, config: { reintentosMax: 0 } }); autorizar(o, 'todo'); await ticks(o); await terminarUno(o); await ticks(o);
  assert.equal(o.E.enviados.length, 2, 'el segundo ya salió'); o.est.config.topeSerieUsd = 0.15; // el dueño baja el tope en Ajustes mientras corre: gastado 0,08 + este 0,10 reservado ya no caben
  await terminarUno(o); await ticks(o, 2);
  const s = vista(o); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /tope de la serie/); assert.equal(o.E.enviados.length, 2, 'no se envió el tercero'); assert.equal(s.autorizado, null, 'pausar quita la autorización');
  await ticks(o, 3); assert.equal(o.E.enviados.length, 2); assert.equal(s.escaleta[2].estado, 'previsto');
  o.est.config.topeSerieUsd = 10; const g = o.G.generar({ id: o.id, modo: 'todo' }); assert.equal(g.estado, 200); assert.ok(g.cuerpo.confirmar, 'seguir exige un clic nuevo con su cifra'); assert.equal(vista(o).estado, 'pausado');
});

test('9 · el presupuesto del Estudio (día/mes) y el cupo diario de series cortan ANTES de reservar y de enviar', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); o.E.tope = 0.05; await ticks(o);
  let s = vista(o); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /presupuesto del día del Estudio/); assert.equal(o.E.enviados.length, 0); assert.deepEqual(Object.keys(s.libro?.lineas || {}), [], 'nada se reservó');
  const p = montar(t, { n: 3 }); p.E.limit = 4; p.A.sumarUso(p.est.dia, 3); autorizar(p, 'todo'); await ticks(p);
  s = p.A.uno(p.id); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /cupo diario/); assert.equal(p.E.enviados.length, 0);
  const q = montar(t, { n: 2 }); q.E.limit = 4; q.A.sumarUso('2026-10-29', 3); autorizar(q, 'todo'); await ticks(q); assert.equal(q.E.enviados.length, 1, 'el cupo de ayer no cuenta hoy: se reinicia solo');
});

test('10 · el mes de carruseles: si el máximo no cabe en lo que queda del mes, ni siquiera hay token; y lo ya gastado del mes cuenta', async t => {
  const o = montar(t, { n: 2, config: { topeMesCarruselesUsd: 0.3 } }); o.A.actualizar(o.id, y => ({ ...y, brief: { ...y.brief, formato: 'carrusel' } }));
  const r = o.G.generar({ id: o.id, modo: 'todo' }); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'tope', 'cabe en la serie (US$0,40 de 10) pero no en el mes (US$0,30)'); assert.equal(o.E.enviados.length, 0);
  const p = montar(t, { n: 2, config: { topeMesCarruselesUsd: 0.5 } }); p.A.actualizar(p.id, y => ({ ...y, brief: { ...y.brief, formato: 'carrusel' } })); autorizar(p, 'todo'); await ticks(p); assert.equal(p.E.enviados.length, 1, 'cabe: sale');
  const q = montar(t, { n: 2, config: { topeMesCarruselesUsd: 0.5 }, planos: [plano(1), plano(2)] }); q.A.actualizar(q.id, y => ({ ...y, brief: { ...y.brief, formato: 'post' } }));
    q.est.config.topeMesCarruselesUsd = 0.01; assert.equal(q.G.generar({ id: q.id, modo: 'todo' }).estado, 200, 'un post no cuenta en el tope de carruseles (el formato real, no el título)');
});

test('11 · reinicio a mitad: sigue en el aire → no duplica; se cayó entre enviar y apuntar → se adopta por su marca; se cayó antes de enviar → se devuelve la reserva y se reintenta con otra clave', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); await ticks(o); assert.equal(o.E.enviados.length, 1);
  const A2 = o.otra(); // un proceso nuevo: lee lo que quedó en disco
  const G2 = crearGenerador({ almacen: A2, media: o.E, biblia: { leer: () => aprobada }, capsDe: () => ({ maxRefs: 4 }), precioPlano: () => ({ generacion: 0.1 }), config: () => o.est.config,
    activo: () => true, ahora: () => o.est.t, nonce: () => 'x'.repeat(20), hoy: () => o.est.dia, intervalo: 10 });
  await G2.tick(); await G2.tick(); assert.equal(o.E.enviados.length, 1, 'tras reiniciar no vuelve a enviar mientras el trabajo sigue en el aire');
  // (b) se cayó tras enviar y antes de apuntar el id del trabajo
  A2.actualizar(o.id, y => { y.pasos[`${o.id}:1:1`].job = null; y.pasos[`${o.id}:1:1`].estado = 'reservado'; return y; });
  await G2.tick(); assert.equal(A2.uno(o.id).pasos[`${o.id}:1:1`].job, 'j0', 'se adopta el trabajo por su marca'); assert.equal(o.E.enviados.length, 1);
  o.E.ok('j0'); await G2.tick(); assert.equal(A2.uno(o.id).libro.lineas[`${o.id}:1:1`].estado, 'liquidado'); assert.equal(A2.uno(o.id).escaleta[0].versiones.length, 1, 'una sola versión: no se cobra ni se guarda dos veces');
  assert.equal(o.E.enviados.length, 2, 'ya salió el plano 2'); // (c) se cayó ANTES de llamar al motor: reserva apuntada, ningún trabajo
  o.E.lista.length = 1; o.E.enviados.length = 1; A2.actualizar(o.id, y => { y.pasos[`${o.id}:2:1`].job = null; return y; });
  await G2.tick(); const s = A2.uno(o.id);
  assert.equal(s.libro.lineas[`${o.id}:2:1`].estado, 'liberado', 'la reserva que nunca salió se devuelve'); assert.ok(s.libro.lineas[`${o.id}:2:2`], 'el reintento usa una clave NUEVA (contador monótono): la liberada nunca se reutiliza');
  assert.equal(o.E.enviados.filter(r => r.serie.n === 2).length, 1, 'el plano 2 se envió una sola vez de verdad'); assert.equal(o.E.enviados.at(-1).serie.intento, 2);
});

test('12 · motor de PAGO: lo que se pierde, muere con la oficina, se cancela en marcha o falla de forma dudosa queda «incierto» (sigue contando) y lo decide el dueño; el gratis solo se repite', async t => {
  const o = montar(t, { n: 2 }); autorizar(o, 'todo'); await ticks(o); o.E.falla('j0', 'x', 'otro', 'interrumpido'); await ticks(o);
  let s = vista(o); const clave = `${o.id}:1:1`; assert.equal(s.libro.lineas[clave].estado, 'incierto'); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /puede haberse cobrado/); assert.equal(s.escaleta[0].estado, 'revisar');
  const v = vistaSerie(s); assert.equal(v.gasto.inciertoUsd, 0.1, 'sigue contando contra el tope'); assert.equal(v.pasos_inciertos[0].clave, clave);
  assert.equal(o.G.resolver({ id: o.id, clave, cobro: false }).estado, 200); s = vista(o); assert.equal(s.libro.lineas[clave].estado, 'liberado'); assert.equal(s.escaleta[0].estado, 'previsto'); assert.equal(o.G.resolver({ id: o.id, clave, cobro: false }).estado, 409, 'ya no está en duda');
  const g = montar(t, { n: 2, E: estudio({ motor: 'prueba' }) }); autorizar(g, 'todo'); await ticks(g); g.E.falla('j0', 'x', 'otro', 'interrumpido'); await ticks(g, 2);
  assert.equal(g.A.uno(g.id).libro.lineas[`${g.id}:1:1`].estado, 'liberado'); assert.equal(g.E.enviados.length, 2, 'gratis: se repite sin drama'); assert.equal(g.A.uno(g.id).estado, 'corriendo');
  const h = montar(t, { n: 2 }); autorizar(h, 'todo'); await ticks(h); h.E.lista.length = 0; await ticks(h); // el trabajo desapareció del Estudio con un motor de pago: no se sabe
  assert.equal(h.A.uno(h.id).libro.lineas[`${h.id}:1:1`].estado, 'incierto'); assert.equal(h.E.enviados.length, 1);
  const w = montar(t, { n: 2 }); autorizar(w, 'todo'); await ticks(w); w.E.lista.length = 0; await ticks(w); assert.equal(w.G.resolver({ id: w.id, clave: `${w.id}:1:1`, cobro: true, realUsd: 0.07 }).estado, 200);
  assert.equal(w.A.uno(w.id).libro.lineas[`${w.id}:1:1`].estado, 'liquidado'); assert.equal(w.A.uno(w.id).escaleta[0].estado, 'revisar', 'si hubo cobro no hay archivo: queda para revisar');
  const x = montar(t, { n: 2, E: estudio({ models: () => [] }) }); autorizar(x, 'todo'); await ticks(x); assert.equal(x.A.uno(x.id).pasos[`${x.id}:1:1`].engine, null); x.E.falla('j0', 'x', 'tiempo', 'tiempo'); await ticks(x);
  assert.equal(x.A.uno(x.id).libro.lineas[`${x.id}:1:1`].estado, 'incierto', 'un motor que no se resuelve cuenta como de PAGO (falla cerrado)');
  const u = montar(t, { n: 2 }); autorizar(u, 'todo'); await ticks(u); u.E.falla('j0', 'algo nuevo que nadie previó'); u.E.job('j0').causa = undefined; await ticks(u); assert.equal(u.A.uno(u.id).libro.lineas[`${u.id}:1:1`].estado, 'incierto', 'sin causa estructurada: dudoso');
});

test('13 · fallos: gratis → UN reintento con clave nueva y luego revisar; pago + transitorio → incierto; pago + claramente previo (sin saldo/key/pedido rechazado) → se libera y se pausa; contenido en pago → incierto', async t => {
  const o = montar(t, { n: 3, E: estudio({ motor: 'prueba' }) }); autorizar(o, 'todo'); await ticks(o); o.E.falla('j0', 'el servicio no respondió a tiempo', 'tiempo'); await ticks(o, 2);
  assert.equal(o.E.enviados.length, 2); assert.equal(o.E.enviados[1].serie.intento, 2); assert.equal(vista(o).libro.lineas[`${o.id}:1:1`].estado, 'liberado'); assert.equal(vista(o).estado, 'corriendo');
  o.E.falla('j1', 'el servicio no respondió a tiempo', 'tiempo'); await ticks(o, 2); let s = vista(o); assert.equal(s.escaleta[0].estado, 'revisar'); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /plano 1/); assert.equal(o.E.enviados.length, 2);
  const t1 = montar(t, { n: 3 }); autorizar(t1, 'todo'); await ticks(t1); t1.E.falla('j0', 'el servicio no respondió a tiempo', 'tiempo'); await ticks(t1, 2);
  assert.equal(t1.A.uno(t1.id).libro.lineas[`${t1.id}:1:1`].estado, 'incierto', 'pago + transitorio: pudo cobrarse'); assert.equal(t1.E.enviados.length, 1, 'no se repite solo'); assert.equal(t1.A.uno(t1.id).estado, 'pausado');
  const p = montar(t, { n: 3 }); autorizar(p, 'todo'); await ticks(p); p.E.falla('j0', 'sin saldo o créditos en el servicio', 'saldo', 'previo'); await ticks(p, 2); s = p.A.uno(p.id);
  assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /sin saldo/); assert.equal(s.escaleta[0].estado, 'previsto', 'no es culpa del plano'); assert.equal(s.fallos[1] || 0, 0); assert.equal(p.E.enviados.length, 1); assert.equal(s.libro.lineas[`${p.id}:1:1`].estado, 'liberado');
  const f = montar(t, { n: 3 }); autorizar(f, 'todo'); await ticks(f); f.E.falla('j0', 'no aceptó el pedido', 'formato', 'previo'); await ticks(f, 2); assert.equal(f.A.uno(f.id).libro.lineas[`${f.id}:1:1`].estado, 'liberado'); assert.equal(f.A.uno(f.id).escaleta[0].estado, 'revisar');
  const q = montar(t, { n: 3 }); autorizar(q, 'todo'); await ticks(q); q.E.falla('j0', 'bloqueado por su filtro de contenido', 'contenido'); await ticks(q, 2);
    assert.equal(q.A.uno(q.id).libro.lineas[`${q.id}:1:1`].estado, 'incierto', 'el filtro pudo saltar después de generar'); assert.equal(q.E.enviados.length, 1);
});

test('14 · el Estudio rechaza el envío ANTES de salir: se devuelve la reserva y el cupo y se pausa con el motivo; un costo real mayor que lo reservado pausa y se anota', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); o.E.rechazar = 'tope diario alcanzado: quedan 0 de 40'; await ticks(o);
  const s = vista(o); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /tope diario alcanzado/); assert.equal(s.libro.lineas[`${o.id}:1:1`].estado, 'liberado'); assert.equal(s.escaleta[0].estado, 'previsto'); assert.equal(o.A.usoDe(o.est.dia), 0);
  const p = montar(t, { n: 3 }); autorizar(p, 'todo'); await ticks(p); p.E.ok('j0', 0.5); await ticks(p, 2); const x = p.A.uno(p.id); assert.equal(x.libro.lineas[`${p.id}:1:1`].excedio, true); assert.equal(x.estado, 'pausado'); assert.match(x.pausa_motivo, /costó más de lo reservado/);
  assert.equal(vistaSerie(x).gasto.excedido, true);
});

test('15 · cancelar: lo en el aire se pide cancelar al Estudio; en un motor de pago ya en marcha es «incierto» (puede cobrarse igual), en cola se libera, gratis se libera; si terminó se liquida lo real; nada nuevo sale', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); await ticks(o);
  o.A.actualizar(o.id, y => ({ ...y, estado: 'cancelado', cancelada: true, autorizado: null, token_reg: null })); o.G.alCancelar(o.A.uno(o.id));
  assert.deepEqual(o.E.cancelas, ['j0']); o.E.falla('j0', 'Cancelado por ti.', 'cancelado'); await ticks(o, 3);
  const s = vista(o); assert.equal(s.libro.lineas[`${o.id}:1:1`].estado, 'incierto', 'cancelar un trabajo de pago ya en marcha pudo cobrarse'); assert.equal(o.E.enviados.length, 1, 'nada nuevo'); assert.equal(s.estado, 'cancelado');
  const c = montar(t, { n: 3 }); autorizar(c, 'todo'); await ticks(c); c.A.actualizar(c.id, y => ({ ...y, estado: 'cancelado', cancelada: true, autorizado: null })); c.E.falla('j0', 'Cancelado por ti.', 'cancelado', 'cancelado_en_cola'); await ticks(c, 2);
  assert.equal(c.A.uno(c.id).libro.lineas[`${c.id}:1:1`].estado, 'liberado', 'cancelado antes de salir: se libera');
  const g = montar(t, { n: 3, E: estudio({ motor: 'prueba' }) }); autorizar(g, 'todo'); await ticks(g); g.A.actualizar(g.id, y => ({ ...y, estado: 'cancelado', cancelada: true, autorizado: null })); g.E.falla('j0', 'Cancelado por ti.', 'cancelado'); await ticks(g, 2);
  assert.equal(g.A.uno(g.id).libro.lineas[`${g.id}:1:1`].estado, 'liberado', 'gratis: se libera');
  const p = montar(t, { n: 3 }); autorizar(p, 'todo'); await ticks(p); p.A.actualizar(p.id, y => ({ ...y, estado: 'cancelado', cancelada: true, autorizado: null })); p.E.ok('j0', 0.06); await ticks(p, 3);
  assert.equal(p.A.uno(p.id).libro.lineas[`${p.id}:1:1`].estado, 'liquidado', 'si el trabajo SÍ terminó, se liquida lo real'); assert.equal(p.E.enviados.length, 1); assert.equal(p.G.generar({ id: p.id }).estado, 409);
  const r = montar(t, { n: 3 }); autorizar(r, 'todo'); await ticks(r); r.E.lista.length = 0; r.A.actualizar(r.id, y => { y.pasos[`${r.id}:1:1`].job = null; return { ...y, estado: 'cancelado', cancelada: true, autorizado: null }; }); await ticks(r, 2);
  assert.equal(r.A.uno(r.id).libro.lineas[`${r.id}:1:1`].estado, 'liberado', 'una reserva que nunca salió se libera al cancelar'); assert.equal(r.E.enviados.length, 1);
});

test('16 · apagar el flag PAUSA la serie (lo del aire solo se liquida) y volver a encenderlo no la reanuda sola; cambiar la escaleta tras autorizar pausa; un plano sin modelo o sin referencia no se envía', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); await ticks(o); o.est.activo = false; await terminarUno(o); await ticks(o, 3);
  assert.equal(o.E.enviados.length, 1); assert.equal(vista(o).escaleta[0].estado, 'listo', 'lo del aire se liquidó'); assert.equal(vista(o).estado, 'pausado'); assert.match(vista(o).pausa_motivo, /se apagó/); assert.equal(vista(o).autorizado, null);
  o.est.activo = true; await ticks(o, 3); assert.equal(o.E.enviados.length, 1, 'encender el flag no reanuda con la autorización vieja: hace falta otro clic');
  const e = montar(t, { n: 3 }); autorizar(e, 'todo'); e.A.actualizar(e.id, y => { y.escaleta[1].prompt_exacto += ' cambiado a escondidas'; return y; }); await ticks(e, 2);
  assert.equal(vista(e).estado, 'pausado'); assert.match(vista(e).pausa_motivo, /escaleta cambió/); assert.equal(e.E.enviados.length, 0, 'la autorización era de OTRA escaleta');
  const p = montar(t, { n: 2, extra: { capsDe: () => null } }); autorizar(p, 'todo'); await ticks(p); assert.equal(p.E.enviados.length, 0); assert.equal(p.A.uno(p.id).escaleta[0].estado, 'revisar'); assert.equal(p.A.uno(p.id).estado, 'pausado');
  const q = montar(t, { n: 2, extra: { existeRef: () => false }, planos: [plano(1, { refs: ['2026-10/perdida.png'] }), plano(2)] }); autorizar(q, 'todo'); await ticks(q); assert.equal(q.E.enviados.length, 0); assert.match(q.A.uno(q.id).escaleta[0].motivo || '', /ya no está en la galería/);
});

test('17 · muchos tick a la vez no envían dos planos a la vez', async t => {
  const o = montar(t, { n: 4 }); autorizar(o, 'todo'); await Promise.all(Array.from({ length: 10 }, () => o.G.tick())); await Promise.all(Array.from({ length: 10 }, () => o.G.tick()));
  assert.equal(o.E.enviados.length, 1); assert.equal(Object.keys(vista(o).libro.lineas).length, 1);
});

test('18 · DINERO: ni agentes, ni Dimitri, ni los MCP, ni las ops de la oficina llegan a generar; la ruta no sabe gastar y un único sitio envía al Estudio', () => {
  const leer = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const mcps = fs.readdirSync(ROOT).filter(x => /-mcp\.mjs$/.test(x));
  for (const f of mcps.concat(['oficina/rutas.mjs', 'oficina/mapa.mjs', 'oficina/lecturas.mjs'])) { const s = leer(f); assert.doesNotMatch(s, /series-generar|serie_generar|\/api\/series|crearGenerador/, f); }
  for (const f of ['sub.mjs', 'sub-core.mjs', 'estudio-plan.mjs', 'agente-core.mjs', 'tareas-tools.mjs', 'contenido-tools.mjs']) { if (!fs.existsSync(path.join(ROOT, f))) continue; assert.doesNotMatch(leer(f), /series-generar|crearGenerador|\/api\/series|serie_generar/, f); }
  const local = leer('serie-local.mjs'); assert.doesNotMatch(local, /media\.submit|reservar\(|liquidar\(|fetch\(/, 'la ruta no sabe gastar: solo delega en el generador');
  const gen = leer('series-generar.mjs'); assert.equal((gen.match(/media\.submit\(/g) || []).length, 1, 'un único sitio envía al Estudio'); assert.match(gen, /por !== 'dueno'\) return err\(403/);
  const s = leer('serve.mjs'); assert.equal((s.match(/crearGeneradorSeries\(/g) || []).length, 1, 'serve.mjs lo crea una vez'); assert.doesNotMatch(s, /by: 'dimitri'[^\n]{0,200}series\.generar|generador\.generar\([^)]*por: 'dimitri'/);
});

test('18c · DINERO: ningún otro módulo (telegram, disparadores, rutinas, cola, MCP…) llama al generador ni a /api/series, y nadie que no sea el dueño puede escribir dimitri.serieGenerar', () => {
  const raiz = ['telegram.mjs', 'triggers.mjs', 'routines.mjs', 'settings.mjs', 'serve.mjs'], carpetas = ['.', 'oficina', 'contenido', 'tareas', 'anuncios', 'media', 'cloudflare/worker'];
  const permitido = new Set(['serve.mjs', 'serie-local.mjs', 'series.mjs', 'series-generar.mjs', 'serie-core.mjs', 'serie-topes-core.mjs', 'serie-propuesta-core.mjs', 'serie-vision-core.mjs', 'serie-deriva-core.mjs', 'biblia-core.mjs', 'media/trabajos.mjs']);
  const baja = d => d.startsWith('cloudflare') || ['oficina', 'contenido', 'tareas', 'anuncios', 'media'].includes(d);
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory()) return baja(d) ? walk(path.join(d, e.name)) : [];
    return /\.m?js$/.test(e.name) ? [path.join(d, e.name).replace(/^\.\//, '')] : [];
  });
  const todos = [...new Set(carpetas.flatMap(walk))].filter(f => !permitido.has(f) && !f.startsWith('tests/'));
  for (const f of todos) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /series-generar|serie_generar|crearGeneradorSeries|\/api\/series|serieGenerar/, f);
  assert.ok(raiz.every(f => fs.existsSync(path.join(ROOT, f))) && todos.includes('telegram.mjs') && todos.includes('triggers.mjs'), 'la lista revisó telegram y los disparadores');
  const ajustes = fs.readFileSync(path.join(ROOT, 'settings.mjs'), 'utf8'); assert.doesNotMatch(ajustes, /serieGenerar|['"`]dimitri\./, 'Ajustes (la API de settings) no puede escribir el flag');
  const src = fs.readFileSync(path.join(ROOT, 'serve.mjs'), 'utf8'); assert.doesNotMatch(src, /serieGenerar\s*=[^=]|serieGenerar\s*:\s*(true|false|b\.|body)/, 'serve.mjs solo LEE el flag, nunca lo escribe'); assert.ok((src.match(/\.serieGenerar === true/g) || []).length >= 2);
});


test('18b · la ruta: generar solo del dueño (agente 403, flag 409); la propuesta no puede gastar; la lectura no suelta el token', async t => {
  const d = tmp(t), A = crearAlmacen({ archivo: path.join(d, 's.json'), renombrar: ren }), E = estudio(); let activo = true;
  const G = crearGenerador({ almacen: A, media: E, biblia: { leer: () => aprobada }, capsDe: () => ({ maxRefs: 4 }), precioPlano: () => ({ generacion: 0.1 }), activo: () => activo, nonce: () => 'n'.repeat(20), hoy: () => '2026-10-30' });
  const S = crearSeries({ biblia: { leer: () => aprobada, hojas: () => [] }, activo: () => true, generarActivo: () => true, almacen: A, generador: G, capsDe: () => ({ maxRefs: 4 }), existeRef: () => true, precioPlano: () => ({ generacion: 0.1 }), modeloUnico: () => 'nb', id: () => 'serie-9' });
  const p = await S.ruta('POST', '/api/series/proponer', { cuerpo: { guardar: true, brief: { titulo: 'x' }, planos: [plano(1), plano(2)] } }); assert.equal(p.estado, 200); assert.equal(E.enviados.length, 0, 'proponer no envía nada');
  assert.equal((await S.ruta('POST', '/api/series/serie-9/generar', { cuerpo: {}, agente: true })).estado, 403);
  activo = false; assert.equal((await S.ruta('POST', '/api/series/serie-9/generar', { cuerpo: {} })).estado, 409); activo = true;
  const a = await S.ruta('POST', '/api/series/serie-9/generar', { cuerpo: {} }); assert.equal(a.estado, 200); const c = a.cuerpo.confirmar;
  const b = await S.ruta('POST', '/api/series/serie-9/generar', { cuerpo: { confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd, modo: 'muestra' } });
  assert.equal(b.estado, 200); assert.equal(b.cuerpo.gasta, true); await G.tick(); assert.equal(E.enviados.length, 1);
  assert.equal((await S.ruta('POST', '/api/series/serie-9/resolver', { cuerpo: { clave: 'x', cobro: true }, agente: true })).estado, 403);
  const l = await S.ruta('GET', '/api/series/serie-9'); assert.equal(l.cuerpo.serie.autorizada, true); assert.ok(!JSON.stringify(l.cuerpo).includes(c.token), 'la lectura no suelta el token');
});

// ---- la oficina REAL, solo con el motor gratis «prueba» ----
async function oficina(t, d, port, flags = { series: true, serieGenerar: true }, envExtra = {}) {
  fs.mkdirSync(path.join(d, 'brain'), { recursive: true }); fs.writeFileSync(path.join(d, 'office.config.local.json'), JSON.stringify({ dimitri: flags }));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(d, 'data'), AO_BRAIN: path.join(d, 'brain'), AO_LOCAL_CONFIG: path.join(d, 'office.config.local.json'), ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', CLAUDE_BIN: path.join(d, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '', ...envExtra };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: 'ignore' }); t.after(() => srv.kill());
  const base = `http://127.0.0.1:${port}`; for (let i = 0; i < 160; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch { /* aún */ } await new Promise(r => setTimeout(r, 250)); }
  const call = async (p, b, method = b === undefined ? 'GET' : 'POST') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b === undefined ? {} : { body: JSON.stringify(b) }) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };
  return { call, parar: () => new Promise(r => { srv.once('exit', r); srv.kill(); }) };
}
const hasta = async (fn, ms = 40000) => { const fin = Date.now() + ms; let v; while (Date.now() < fin) { v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 200)); } throw new Error('no llegó a tiempo'); };
const puerto = async () => { const probe = http.createServer(), port = await new Promise(r => probe.listen(0, '127.0.0.1', () => r(probe.address().port))); await new Promise(r => probe.close(r)); return port; };

test('19 · serve.mjs real (motor gratis «prueba»): token, agente 403, dos clics a la vez, la muestra, «todo», marca serie en cada trabajo y nada duplicado', { timeout: 120000 }, async t => {
  const d = tmp(t), o = await oficina(t, d, await puerto());
  assert.equal((await o.call('/api/biblia', { biblia: { ...bib, reglas: [] }, aprobar: true }, 'PUT')).status, 200);
  const modelo = (await o.call('/api/media/models')).j.models.find(m => m.kind === 'image' && m.engine === 'prueba' && m.on); assert.ok(modelo);
  const p = await o.call('/api/series/proponer', { guardar: true, brief: { titulo: 'Sofá' }, planos: Array.from({ length: 5 }, (_, i) => plano(i + 1, { modelo: modelo.id })) }); assert.equal(p.status, 200, JSON.stringify(p.j)); const id = p.j.guardada.id;
  assert.equal((await o.call(`/api/series/${id}/generar`, { by: 'agent' })).status, 403);
  const a = await o.call(`/api/series/${id}/generar`, {}); assert.equal(a.status, 200, JSON.stringify(a.j)); const c = a.j.confirmar; assert.equal(c.costoMostradoUsd, 0, 'el motor de prueba no cuesta'); assert.equal((await o.call('/api/media/jobs')).j.jobs.length, 0, 'pedir el clic no genera nada');
  assert.equal((await o.call(`/api/series/${id}/generar`, { confirmacion: 'no-es-el-token-0000', costoMostradoUsd: 0 })).status, 409);
  const [x, y] = await Promise.all([o.call(`/api/series/${id}/generar`, { confirmacion: c.token, costoMostradoUsd: 0, modo: 'muestra' }), o.call(`/api/series/${id}/generar`, { confirmacion: c.token, costoMostradoUsd: 0, modo: 'muestra' })]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409], JSON.stringify([x.j, y.j]));
  const m = await hasta(async () => { const s = (await o.call('/api/series/' + id)).j.serie; return s.muestra_lista ? s : null; }); assert.equal(m.progreso.listos, 3); assert.equal(m.estado, 'muestra');
  const jobs = (await o.call('/api/media/jobs')).j.jobs.filter(j => j.serie?.id === id); assert.equal(jobs.length, 3); assert.deepEqual(jobs.map(j => j.serie.n).sort(), [1, 2, 3]); assert.ok(jobs.every(j => j.by === 'dimitri' && j.serie.intento === 1));
  assert.equal((await o.call(`/api/series/${id}/generar`, { modo: 'muestra' })).status, 409, 'la muestra no se repite');
  const c2 = (await o.call(`/api/series/${id}/generar`, { modo: 'todo' })).j.confirmar; assert.equal(c2.planos, 2);
  assert.equal((await o.call(`/api/series/${id}/generar`, { confirmacion: c2.token, costoMostradoUsd: 0, modo: 'todo' })).status, 200);
  const f = await hasta(async () => { const s = (await o.call('/api/series/' + id)).j.serie; return s.estado === 'hecho' ? s : null; }); assert.equal(f.progreso.listos, 5); assert.ok(f.escaleta.every(q => q.versiones.length === 1), 'una versión por plano: nada duplicado');
  const todos = (await o.call('/api/media/jobs')).j.jobs.filter(j => j.serie?.id === id); assert.equal(todos.length, 5); assert.equal(f.gasto.gastadoUsd, 0);
  assert.equal((await o.call(`/api/series/${id}/generar`, { modo: 'todo' })).status, 409, 'una serie hecha no se genera');
});

test('20 · serve.mjs real: con el flag apagado generar da 409; la oficina se cae a mitad y al volver termina sin duplicar', { timeout: 150000 }, async t => {
  const d = tmp(t), port = await puerto(); let o = await oficina(t, d, port, { series: true, serieGenerar: false });
  await o.call('/api/biblia', { biblia: { ...bib, reglas: [] }, aprobar: true }, 'PUT');
  const modelo = (await o.call('/api/media/models')).j.models.find(m => m.kind === 'image' && m.engine === 'prueba' && m.on);
  assert.equal((await o.call('/api/series/proponer', { guardar: true, brief: { titulo: 'Sofá' }, planos: [plano(1, { modelo: modelo.id })] })).j.guardada, null, 'sin el flag no se guarda');
  await o.parar(); o = await oficina(t, d, port, { series: true, serieGenerar: true });
  const p = await o.call('/api/series/proponer', { guardar: true, brief: { titulo: 'Sofá' }, planos: Array.from({ length: 12 }, (_, i) => plano(i + 1, { modelo: modelo.id })) }); const id = p.j.guardada.id;
  await o.parar(); o = await oficina(t, d, port, { series: true, serieGenerar: false }); assert.equal((await o.call(`/api/series/${id}/generar`, {})).status, 409);
  await o.parar(); o = await oficina(t, d, port, { series: true, serieGenerar: true });
  const c = (await o.call(`/api/series/${id}/generar`, { modo: 'todo' })).j.confirmar; assert.equal((await o.call(`/api/series/${id}/generar`, { confirmacion: c.token, costoMostradoUsd: 0, modo: 'todo' })).status, 200);
  await hasta(async () => ((await o.call('/api/series/' + id)).j.serie.progreso.listos >= 1)); await o.parar(); // se cae sin despedirse
  o = await oficina(t, d, port, { series: true, serieGenerar: true });
  let f = await hasta(async () => { const s = (await o.call('/api/series/' + id)).j.serie; return ['hecho', 'pausado'].includes(s.estado) ? s : null; }, 60000);
  if (f.estado === 'pausado') { // tras un reinicio NO se retoma sola: pausa con motivo y pide un clic nuevo
    assert.match(f.pausa_motivo, /reinició/); assert.equal(f.autorizada, false); const antes = (await o.call('/api/media/jobs')).j.jobs.filter(j => j.serie?.id === id).length; await new Promise(r => setTimeout(r, 3500));
    assert.equal((await o.call('/api/media/jobs')).j.jobs.filter(j => j.serie?.id === id).length, antes, 'no lanzó planos nuevos por su cuenta');
    const c2 = await hasta(async () => { const g = await o.call(`/api/series/${id}/generar`, { modo: 'todo' }); return g.status === 200 ? g.j.confirmar : null; }); assert.equal((await o.call(`/api/series/${id}/generar`, { confirmacion: c2.token, costoMostradoUsd: 0, modo: 'todo' })).status, 200);
    f = await hasta(async () => { const s = (await o.call('/api/series/' + id)).j.serie; return s.estado === 'hecho' ? s : null; }, 60000);
  }
  assert.equal(f.estado, 'hecho'); assert.equal(f.progreso.listos, 12); assert.ok(f.escaleta.every(q => q.versiones.length === 1), 'cada plano tiene UNA sola versión tras el reinicio');
  const jobs = (await o.call('/api/media/jobs')).j.jobs, hechos = jobs.filter(j => j.serie?.id === id && j.state === 'done').flatMap(j => j.items);
  assert.equal(new Set(hechos).size, 12, 'doce imágenes distintas, ninguna repetida'); assert.ok(!JSON.stringify(f).includes('.svg'), 'la vista no expone nombres de archivo');
});

test('21 · tras un reinicio se RECONCILIA pero NO se lanza nada nuevo: la serie pasa a pausada con motivo y pide un clic nuevo; y una autorización caduca a las 6 h aunque no haya reinicio (reloj inyectado)', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); await ticks(o); assert.equal(o.E.enviados.length, 1);
  const A2 = o.otra(), G2 = crearGenerador({ almacen: A2, media: o.E, biblia: { leer: () => aprobada }, capsDe: () => ({ maxRefs: 4 }), precioPlano: () => ({ generacion: 0.1 }), config: () => o.est.config,
    activo: () => true, ahora: () => o.est.t, nonce: () => 'y'.repeat(20), hoy: () => o.est.dia, intervalo: 10 });
  o.E.ok('j0'); G2.alArrancar(); let s = A2.uno(o.id);
  assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /reinició/); assert.equal(s.autorizado, null); assert.equal(s.escaleta[0].estado, 'listo', 'lo que estaba en el aire se liquidó'); assert.equal(s.libro.lineas[`${o.id}:1:1`].estado, 'liquidado');
  await G2.tick(); await G2.tick(); assert.equal(o.E.enviados.length, 1, 'ningún plano nuevo sin un clic nuevo');
  const c = G2.generar({ id: o.id, modo: 'todo' }).cuerpo.confirmar; assert.ok(c.token && c.costoMostradoUsd > 0, 'hace falta un token nuevo');
  const p = montar(t, { n: 3 }); autorizar(p, 'todo'); p.est.t += 6 * 3600e3 + 1; await ticks(p, 2);
  assert.equal(p.A.uno(p.id).estado, 'pausado'); assert.match(p.A.uno(p.id).pausa_motivo, /caducó/); assert.equal(p.E.enviados.length, 0, 'caducada: no envía');
  const q = montar(t, { n: 3 }); autorizar(q, 'todo'); q.est.t += 6 * 3600e3 - 1000; await ticks(q); assert.equal(q.E.enviados.length, 1, 'antes de las 6 h sigue valiendo');
});

test('22 · resolver: solo el dueño, solo sobre un paso incierto, y el cobro real debe ser un número finito ≥ 0 y no pasar de lo reservado', async t => {
  const o = montar(t, { n: 2 }); autorizar(o, 'todo'); await ticks(o); o.E.lista.length = 0; await ticks(o); const clave = `${o.id}:1:1`;
  for (const mal of [NaN, -1, Infinity, '0.05', {}, 5]) assert.equal(o.G.resolver({ id: o.id, clave, cobro: true, realUsd: mal }).estado, 422, String(mal));
  assert.equal(vista(o).libro.lineas[clave].estado, 'incierto', 'ninguno de los inválidos tocó nada'); assert.equal(o.G.resolver({ id: o.id, clave: 'otra', cobro: true }).estado, 409);
  assert.equal(o.G.resolver({ id: o.id, clave, cobro: 'si' }).estado, 422); assert.equal(o.G.resolver({ id: o.id, clave, cobro: true, realUsd: 0.1 }).estado, 200); assert.equal(vista(o).libro.lineas[clave].real, 100000);
  assert.equal((await import('../serie-topes-core.mjs')).resolverIncierto({ tope: 9, lineas: { x: { estado: 'incierto', max: 100 } } }, 'x', true, NaN).libro.lineas.x.real, 100, 'NaN o negativo caen al máximo reservado, nunca a un número raro');
});

test('23 · el cupo de series devuelto usa el día en que se sumó; el texto del clic dice los reintentos; origen y candado', async t => {
  const o = montar(t, { n: 2 }); autorizar(o, 'todo'); await ticks(o); assert.equal(o.A.usoDe('2026-10-30'), 1); o.est.dia = '2026-10-31'; o.A.actualizar(o.id, y => { y.pasos[`${o.id}:1:1`].job = null; return y; }); o.E.lista.length = 0; await ticks(o);
  assert.equal(o.A.usoDe('2026-10-30'), 0, 'se devolvió en el día de origen'); assert.equal(o.A.usoDe('2026-10-31'), 1, 'y el nuevo intento cuenta en el día de hoy (sin quedar en negativo)');
  const p = montar(t, { n: 2 }); assert.match(p.G.generar({ id: p.id }).cuerpo.confirmar.texto, /incluye hasta 1 reintento por plano/);
  const casos = [['127.0.0.1:4520', undefined, true], ['localhost:4520', 'http://localhost:4520', true], ['[::1]:4520', undefined, true], ['evil.com', undefined, false], ['127.0.0.1.evil.com:80', undefined, false],
    ['127.0.0.1:4520', 'http://evil.com', false], ['127.0.0.1:4520', 'http://127.0.0.1:9999', false], ['127.0.0.1:4520', 'no es url', false], [undefined, undefined, false]];
  for (const [h, org, ok] of casos) assert.equal(origenPermitido({ host: h, origin: org }).ok, ok, `${h} ${org}`);
  const f = path.join(tmp(t), 'l.lock'); let ahora = 1000, viva = true; const c1 = crearCandado({ archivo: f, pid: 11, ahora: () => ahora, vivo: () => viva }), c2 = crearCandado({ archivo: f, pid: 22, ahora: () => ahora, vivo: () => viva });
  assert.equal(c1.tener(), true); assert.equal(c2.tener(), false, 'otro proceso vivo con latido reciente'); ahora += 10000; assert.equal(c1.tener(), true); ahora += 31000; assert.equal(c2.tener(), true, 'latido viejo: toma el relevo'); assert.equal(c1.tener(), false);
  viva = false; assert.equal(c1.tener(), true, 'el dueño murió: se puede tomar'); c1.liberar(); assert.equal(fs.existsSync(f), false);
  const g = montar(t, { n: 2, extra: { candado: { tener: () => false } } }); autorizar(g, 'todo'); await ticks(g, 2); assert.equal(g.E.enviados.length, 0, 'sin el candado la bomba no da pasos de gasto');
});

test('24 · serve.mjs real: Host o Origin ajenos dan 403 en lo que gasta o libera dinero; ni la API ni retry pueden escribir la marca `serie` de un trabajo', { timeout: 90000 }, async t => {
  const d = tmp(t), port = await puerto(), o = await oficina(t, d, port);
  const llamar = (ruta, { host, origin, cuerpo = '{}' } = {}) => new Promise(res => { const r = http.request({ host: '127.0.0.1', port, path: ruta, method: 'POST', headers: { 'content-type': 'application/json', ...(host ? { host } : {}), ...(origin ? { origin } : {}) } }, rs => { rs.resume();
    rs.on('end', () => res(rs.statusCode)); }); r.end(cuerpo); });
  for (const ruta of ['/api/series/x/generar', '/api/series/x/resolver', '/api/series/x/pausar', '/api/series/x/cancelar']) {
    assert.equal(await llamar(ruta, { host: 'evil.example' }), 403, ruta + ' con Host ajeno'); assert.equal(await llamar(ruta, { origin: 'http://evil.example' }), 403, ruta + ' con Origin ajeno');
      assert.notEqual(await llamar(ruta), 403, ruta + ' desde localhost pasa a la lógica (404 si no existe)');
  }
  const modelo = (await o.call('/api/media/models')).j.models.find(m => m.kind === 'image' && m.engine === 'prueba' && m.on);
  const j = await o.call('/api/media/jobs', { prompt: 'una tarjeta', model: modelo.id, serie: { id: 'ajena', n: 1, intento: 1 }, wait: 20000 }); assert.equal(j.status, 200); assert.equal(j.j.job.serie, undefined, 'la API no copia el campo serie');
  const r = await o.call(`/api/media/jobs/${j.j.job.id}/retry`, {}); assert.ok(r.status === 200 || r.status === 400); assert.equal(r.j.job?.serie, undefined);
  assert.equal((await o.call('/api/media/jobs')).j.jobs.some(x => x.serie), false);
  for (const [ruta, cuerpo, sinGuardar] of [['/api/series/revisar-plano', '{}'], ['/api/series/proponer', '{"guardar":true}']]) {
    for (const o2 of [{ host: 'evil.example' }, { origin: 'http://evil.example' }, { origin: 'null' }]) assert.equal(await llamar(ruta, { ...o2, cuerpo }), 403, `${ruta} ${JSON.stringify(o2)}`);
    assert.notEqual(await llamar(ruta, { host: `[::1]:${port}`, cuerpo }), 403, ruta + ' con Host [::1] pasa'); assert.notEqual(await llamar(ruta, { cuerpo }), 403);
  }

});

test('25 · motor de PAGO: un «hecho» sin costo no borra el gasto (se liquida lo estimado); resolver busca la clave con hasOwn; el aviso de pasos inciertos sale en la confirmación', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); await ticks(o); o.E.ok('j0', 0); await ticks(o);
  assert.equal(vista(o).libro.lineas[`${o.id}:1:1`].real, 100000, 'pago con costo 0: como mínimo lo reservado para generar');
  for (const costo of [NaN, -5]) { await ticks(o); const j = o.E.lista.find(x => x.state === 'queued'); o.E.ok(j.id, costo); await ticks(o); }
  assert.ok(Object.values(vista(o).libro.lineas).every(l => l.estado === 'liquidado' && l.real >= 100000), 'ningún cost raro liquida a 0 en pago');
  const g = montar(t, { n: 2, E: estudio({ motor: 'prueba' }) }); autorizar(g, 'todo'); await ticks(g); g.E.ok('j0', 0); await ticks(g); assert.equal(g.A.uno(g.id).libro.lineas[`${g.id}:1:1`].real, 0, 'gratis: 0');
  const r = montar(t, { n: 2 }); autorizar(r, 'todo'); await ticks(r); r.E.lista.length = 0; await ticks(r);
  for (const k of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) assert.equal(r.G.resolver({ id: r.id, clave: k, cobro: true, realUsd: 0.05 }).estado, 409, k);
  assert.match(r.G.generar({ id: r.id, modo: 'todo' }).cuerpo.confirmar.texto, /OJO: hay 1 paso incierto/); assert.equal(r.G.generar({ id: r.id, modo: 'todo' }).cuerpo.confirmar.inciertos, 1);
});

test('26 · sin el candado ni reconcilia ni arranca: otra instancia no pausa ni toca series ajenas', async t => {
  const o = montar(t, { n: 2 }); autorizar(o, 'todo'); await ticks(o); o.E.ok('j0');
  const B2 = crearGenerador({ almacen: o.otra(), media: o.E, biblia: { leer: () => aprobada }, capsDe: () => ({ maxRefs: 4 }), precioPlano: () => ({ generacion: 0.1 }), activo: () => true, nonce: () => 'z'.repeat(20), hoy: () => o.est.dia, candado: { tener: () => false } });
  B2.alArrancar(); assert.equal(B2.reconciliar(), 0); assert.equal(o.otra().uno(o.id).estado, 'muestra' === o.otra().uno(o.id).estado ? 'muestra' : 'corriendo', 'no la pausó'); assert.equal(o.otra().uno(o.id).escaleta[0].estado, 'corriendo', 'ni liquidó su trabajo');
});

test('27 · motor de PAGO: aunque la causa diga «previo», si el trabajo tiene id remoto (el proveedor lo aceptó) NO se libera: queda incierto', async t => {
  const o = montar(t, { n: 2 }); autorizar(o, 'todo'); await ticks(o); o.E.falla('j0', 'sin saldo', 'saldo', 'previo'); o.E.job('j0').remote = 1; await ticks(o);
  assert.equal(vista(o).libro.lineas[`${o.id}:1:1`].estado, 'incierto'); assert.equal(vista(o).escaleta[0].estado, 'revisar');
  const p = montar(t, { n: 2 }); autorizar(p, 'todo'); await ticks(p); p.E.falla('j0', 'sin saldo', 'saldo', 'previo'); await ticks(p); assert.equal(p.A.uno(p.id).libro.lineas[`${p.id}:1:1`].estado, 'liberado', 'sin id remoto sí era previo');
});

test('24b · con AO_HOST (la puerta global de Host abierta) las rutas que gastan o escriben siguen exigiendo localhost: Host ajeno 403 en las 4, en revisar-plano y en proponer con guardar; proponer sin guardar no', { timeout: 90000 }, async t => {
  const d = tmp(t), port = await puerto(); await oficina(t, d, port, { series: true, serieGenerar: true }, { AO_HOST: '127.0.0.1' });
  const llamar = (ruta, host, cuerpo = '{}') => new Promise(res => { const r = http.request({ host: '127.0.0.1', port, path: ruta, method: 'POST', headers: { 'content-type': 'application/json', host } }, rs => { rs.resume(); rs.on('end', () => res(rs.statusCode)); }); r.end(cuerpo); });
  for (const ruta of ['/api/series/x/generar', '/api/series/x/resolver', '/api/series/x/pausar', '/api/series/x/cancelar', '/api/series/revisar-plano']) assert.equal(await llamar(ruta, 'evil.example'), 403, ruta);
  assert.equal(await llamar('/api/series/proponer', 'evil.example', '{"guardar":true}'), 403); assert.notEqual(await llamar('/api/series/proponer', 'evil.example'), 403, 'sin guardar no escribe: queda fuera');
  assert.notEqual(await llamar('/api/series/revisar-plano', `127.0.0.1:${port}`), 403);
});

test('28 · segunda guarda del generador con un Estudio falso: causa previo o cancelado_en_cola con id remoto o con el pedido ya aceptado → INCIERTO; sin ninguno de los dos → se libera', async t => {
  for (const [causa, extra, esperado] of [['previo', { remote: 1 }, 'incierto'], ['previo', { aceptado: true }, 'incierto'], ['cancelado_en_cola', { remote: 1 }, 'incierto'], ['cancelado_en_cola', { aceptado: true }, 'incierto'], ['cancelado_en_cola', {}, 'liberado'], ['previo', {}, 'liberado']]) {
    const o = montar(t, { n: 2 }); autorizar(o, 'todo'); await ticks(o); o.E.falla('j0', 'x', 'saldo', causa); Object.assign(o.E.job('j0'), extra); await ticks(o);
    assert.equal(vista(o).libro.lineas[`${o.id}:1:1`].estado, esperado, `${causa} ${JSON.stringify(extra)}`);
  }
});

test('29 · I1: al liquidar quedan fijados el estado y el real del paso (no solo el libro); el token cubre el número de pasos inciertos; el tope del Estudio se mira con lo reservado COMPLETO (con visión)', async t => {
  const o = montar(t, { n: 2 }); autorizar(o, 'todo'); await ticks(o); o.E.ok('j0', 0.08); await ticks(o); const pa = vista(o).pasos[`${o.id}:1:1`];
  assert.equal(pa.estado, 'liquidado'); assert.equal(pa.realUsd, 0.08);
  const p = montar(t, { n: 2 }); const c = pedir(p, 'todo'); const otra = p.A.crear({ ...vista(p), id: 'otra-serie' }); p.A.actualizar(otra.id, y => ({ ...y, libro: { tope: 1e7, lineas: { 'otra-serie:1:1': { estado: 'incierto', max: 100000 } } } }));
  const r = confirmar(p, c); assert.equal(r.estado, 409); assert.equal(r.cuerpo.codigo, 'incierto'); assert.equal(r.cuerpo.confirmar.inciertos, 1); assert.equal(p.E.enviados.length, 0);
  const q = montar(t, { n: 2, extra: { costoRevision: () => ({ qa: 0, vision: 0.1 }) } }); autorizar(q, 'todo'); q.E.tope = 0.15; await ticks(q);
  assert.equal(q.A.uno(q.id).estado, 'pausado'); assert.match(q.A.uno(q.id).pausa_motivo, /presupuesto del día/); assert.equal(q.E.enviados.length, 0, 'generar (0,10) cabe en 0,15 pero generar + visión (0,20) no');
});
