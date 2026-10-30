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
import { crearAlmacen, vistaSerie } from '../series.mjs';
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
    falla(id, error, errorClass = 'otro') { Object.assign(E.job(id), { state: 'failed', error, errorClass }); },
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

test('3b · un token usado no sirve otra vez aunque la serie vuelva a estar pausada y sin nada en el aire', async t => {
  const o = montar(t); const c = pedir(o); assert.equal(confirmar(o, c).estado, 200); await ticks(o); o.est.activo = false; o.E.ok('j0'); await ticks(o); o.est.activo = true; // el plano 1 queda liquidado y no arranca otro
  o.A.actualizar(o.id, y => ({ ...y, estado: 'pausado', autorizado: null, pausa_motivo: 'x' }));
  const re = confirmar(o, c); assert.equal(re.estado, 409); assert.equal(re.cuerpo.codigo, 'usado', 'ese token ya se usó'); assert.equal(re.cuerpo.confirmar, undefined); assert.equal(o.E.enviados.length, 1);
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

test('10 · el mes de carruseles: un tope de mes que no alcanza corta antes de enviar', async t => {
  const o = montar(t, { n: 2, config: { topeMesCarruselesUsd: 0.05 } }); o.A.actualizar(o.id, y => ({ ...y, brief: { ...y.brief, formato: 'carrusel' } }));
  const c = pedir(o, 'todo'); assert.equal(c.costoMostradoUsd, 0.4); confirmar(o, c); await ticks(o);
  assert.equal(vista(o).estado, 'pausado'); assert.match(vista(o).pausa_motivo, /tope del mes/); assert.equal(o.E.enviados.length, 0);
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

test('12 · un trabajo de PAGO que se pierde o muere con la oficina queda «incierto» (puede haberse cobrado), sigue contando y pide tu decisión; uno gratis solo se repite', async t => {
  const o = montar(t, { n: 2 }); autorizar(o, 'todo'); await ticks(o); o.E.falla('j0', 'se interrumpió: la oficina se reinició mientras generaba. Reintenta.'); await ticks(o);
  let s = vista(o); const clave = `${o.id}:1:1`; assert.equal(s.libro.lineas[clave].estado, 'incierto'); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /puede haberse cobrado/); assert.equal(s.escaleta[0].estado, 'revisar');
  const v = vistaSerie(s); assert.equal(v.gasto.inciertoUsd, 0.1, 'sigue contando contra el tope'); assert.equal(v.pasos_inciertos[0].clave, clave);
  assert.equal(o.G.resolver({ id: o.id, clave, cobro: false }).estado, 200); s = vista(o); assert.equal(s.libro.lineas[clave].estado, 'liberado'); assert.equal(s.escaleta[0].estado, 'previsto'); assert.equal(o.G.resolver({ id: o.id, clave, cobro: false }).estado, 409, 'ya no está en duda');
  const g = montar(t, { n: 2, E: estudio({ motor: 'prueba' }) }); autorizar(g, 'todo'); await ticks(g); g.E.falla('j0', 'se interrumpió: la oficina se reinició mientras generaba. Reintenta.'); await ticks(g, 2);
  assert.equal(g.A.uno(g.id).libro.lineas[`${g.id}:1:1`].estado, 'liberado'); assert.equal(g.E.enviados.length, 2, 'gratis: se repite sin drama'); assert.equal(g.A.uno(g.id).estado, 'corriendo');
  const h = montar(t, { n: 2 }); autorizar(h, 'todo'); await ticks(h); h.E.lista.length = 0; await ticks(h); // el trabajo desapareció del Estudio con un motor de pago: no se sabe
  assert.equal(h.A.uno(h.id).libro.lineas[`${h.id}:1:1`].estado, 'incierto'); assert.equal(h.E.enviados.length, 1);
  const w = montar(t, { n: 2 }); autorizar(w, 'todo'); await ticks(w); w.E.lista.length = 0; await ticks(w); assert.equal(w.G.resolver({ id: w.id, clave: `${w.id}:1:1`, cobro: true, realUsd: 0.07 }).estado, 200);
  assert.equal(w.A.uno(w.id).libro.lineas[`${w.id}:1:1`].estado, 'liquidado'); assert.equal(w.A.uno(w.id).escaleta[0].estado, 'revisar', 'si hubo cobro no hay archivo: queda para revisar');
});

test('13 · fallos: transitorio → UN reintento con clave nueva; luego revisar y pausa; sin saldo/key → pausa sin culpar al plano; contenido → revisar', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); await ticks(o); o.E.falla('j0', 'el servicio no respondió a tiempo', 'tiempo'); await ticks(o, 2);
  assert.equal(o.E.enviados.length, 2); assert.equal(o.E.enviados[1].serie.intento, 2); assert.equal(vista(o).libro.lineas[`${o.id}:1:1`].estado, 'liberado'); assert.equal(vista(o).estado, 'corriendo');
  o.E.falla('j1', 'el servicio no respondió a tiempo', 'tiempo'); await ticks(o, 2); let s = vista(o); assert.equal(s.escaleta[0].estado, 'revisar'); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /plano 1/); assert.equal(o.E.enviados.length, 2);
  const p = montar(t, { n: 3 }); autorizar(p, 'todo'); await ticks(p); p.E.falla('j0', 'sin saldo o créditos en el servicio', 'saldo'); await ticks(p, 2); s = p.A.uno(p.id);
  assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /sin saldo/); assert.equal(s.escaleta[0].estado, 'previsto', 'no es culpa del plano'); assert.equal(s.fallos[1] || 0, 0); assert.equal(p.E.enviados.length, 1);
  const q = montar(t, { n: 3 }); autorizar(q, 'todo'); await ticks(q); q.E.falla('j0', 'bloqueado por su filtro de contenido', 'contenido'); await ticks(q, 2);
  assert.equal(q.A.uno(q.id).escaleta[0].estado, 'revisar'); assert.equal(q.A.uno(q.id).estado, 'pausado'); assert.equal(q.E.enviados.length, 1);
});

test('14 · el Estudio rechaza el envío ANTES de salir: se devuelve la reserva y el cupo y se pausa con el motivo; un costo real mayor que lo reservado pausa y se anota', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); o.E.rechazar = 'tope diario alcanzado: quedan 0 de 40'; await ticks(o);
  const s = vista(o); assert.equal(s.estado, 'pausado'); assert.match(s.pausa_motivo, /tope diario alcanzado/); assert.equal(s.libro.lineas[`${o.id}:1:1`].estado, 'liberado'); assert.equal(s.escaleta[0].estado, 'previsto'); assert.equal(o.A.usoDe(o.est.dia), 0);
  const p = montar(t, { n: 3 }); autorizar(p, 'todo'); await ticks(p); p.E.ok('j0', 0.5); await ticks(p, 2); const x = p.A.uno(p.id); assert.equal(x.libro.lineas[`${p.id}:1:1`].excedio, true); assert.equal(x.estado, 'pausado'); assert.match(x.pausa_motivo, /costó más de lo reservado/);
  assert.equal(vistaSerie(x).gasto.excedido, true);
});

test('15 · cancelar: lo que va en el aire se pide cancelar al Estudio, se liquida solo lo real, no sale nada nuevo y la autorización muere', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); await ticks(o);
  o.A.actualizar(o.id, y => ({ ...y, estado: 'cancelado', cancelada: true, autorizado: null, token_reg: null })); o.G.alCancelar(o.A.uno(o.id));
  assert.deepEqual(o.E.cancelas, ['j0']); o.E.falla('j0', 'Cancelado por ti.'); await ticks(o, 3);
  const s = vista(o); assert.equal(s.libro.lineas[`${o.id}:1:1`].estado, 'liberado', 'lo reservado y no gastado se libera'); assert.equal(o.E.enviados.length, 1, 'nada nuevo'); assert.equal(s.estado, 'cancelado');
  const p = montar(t, { n: 3 }); autorizar(p, 'todo'); await ticks(p); p.A.actualizar(p.id, y => ({ ...y, estado: 'cancelado', cancelada: true, autorizado: null })); p.E.ok('j0', 0.06); await ticks(p, 3);
  assert.equal(p.A.uno(p.id).libro.lineas[`${p.id}:1:1`].estado, 'liquidado', 'si el trabajo SÍ terminó, se liquida lo real'); assert.equal(p.E.enviados.length, 1); assert.equal(p.G.generar({ id: p.id }).estado, 409);
});

test('16 · apagar el flag detiene la bomba (lo del aire solo se liquida); cambiar la escaleta tras autorizar pausa; un plano sin modelo o sin referencia no se envía', async t => {
  const o = montar(t, { n: 3 }); autorizar(o, 'todo'); await ticks(o); o.est.activo = false; await terminarUno(o); await ticks(o, 3);
  assert.equal(o.E.enviados.length, 1); assert.equal(vista(o).escaleta[0].estado, 'listo', 'lo del aire se liquidó'); assert.equal(vista(o).estado, 'corriendo');
  o.est.activo = true; o.A.actualizar(o.id, y => { y.escaleta[1].prompt_exacto += ' cambiado a escondidas'; return y; }); await ticks(o, 2);
  assert.equal(vista(o).estado, 'pausado'); assert.match(vista(o).pausa_motivo, /escaleta cambió/); assert.equal(o.E.enviados.length, 1, 'la autorización era de OTRA escaleta');
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
async function oficina(t, d, port, flags = { series: true, serieGenerar: true }) {
  fs.mkdirSync(path.join(d, 'brain'), { recursive: true }); fs.writeFileSync(path.join(d, 'office.config.local.json'), JSON.stringify({ dimitri: flags }));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(d, 'data'), AO_BRAIN: path.join(d, 'brain'), AO_LOCAL_CONFIG: path.join(d, 'office.config.local.json'), ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', CLAUDE_BIN: path.join(d, 'no-claude.exe'),
    TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '', VOYAGE_API_KEY: '' };
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
  const f = await hasta(async () => { const s = (await o.call('/api/series/' + id)).j.serie; return ['hecho', 'pausado'].includes(s.estado) ? s : null; }, 60000);
  assert.equal(f.estado, 'hecho', JSON.stringify({ e: f.estado, m: f.pausa_motivo })); assert.equal(f.progreso.listos, 12); assert.ok(f.escaleta.every(q => q.versiones.length === 1), 'cada plano tiene UNA sola versión tras el reinicio');
  const archivos = f.escaleta.map(q => q.versiones[0].archivo); assert.equal(new Set(archivos).size, 12, 'doce imágenes distintas, ninguna repetida');
});
