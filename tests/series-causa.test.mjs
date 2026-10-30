// Fase 11.5 (revisión de #108, ronda 2): la CAUSA estructurada de un trabajo fallido se prueba contra el media/trabajos.mjs REAL (no un Estudio falso) y, con él, contra el generador.
// Solo el motor gratis «prueba», cuyo RUN se sustituye en el test para fallar como lo haría un proveedor. Sin red, sin keys, sin hora del día.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as media from '../media.mjs';
import { RUN } from '../media/motores.mjs';
import { loadJobs } from '../media/trabajos.mjs';
import * as B from '../biblia-core.mjs';
import * as P from '../serie-propuesta-core.mjs';
import { crearAlmacen } from '../series.mjs';
import { crearGenerador } from '../series-generar.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-causa-')), DATA = path.join(dir, 'data'), BRAIN = path.join(dir, 'brain');
fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(BRAIN, { recursive: true });
media.configure({}, BRAIN, DATA, { warm: false });
const RUN_PRUEBA = RUN.prueba; // lo original, para devolverlo
const modelo = media.models().find(m => m.kind === 'image' && m.engine === 'prueba' && m.on);
const espera = ms => new Promise(r => setTimeout(r, ms));
const falla = (msg, { status, remote = false, code } = {}) => { RUN.prueba = async (_m, job) => { if (remote) job.remote = [{ id: 'remoto-1' }]; throw Object.assign(new Error(msg), { status, code }); }; };
const pedir = () => media.submit({ prompt: 'una tarjeta', model: modelo.id, kind: 'image', n: 1, by: 'dimitri' });
const terminar = async id => { for (let i = 0; i < 100; i++) { const j = media.job(id); if (j && (j.state === 'done' || j.state === 'failed')) return j; await espera(50); } throw new Error('el trabajo no terminó'); };
test.after(() => { RUN.prueba = RUN_PRUEBA; fs.rmSync(dir, { recursive: true, force: true }); });

test('causa REAL: el Estudio la pone según la FASE: sin id remoto un 401/saldo/pedido rechazado/sin conexión es «previo»; CON id remoto (el proveedor ya aceptó) nunca lo es', async () => {
  falla('Higgsfield: 401 unauthorized', { status: 401 }); let j = await terminar(pedir().id); assert.equal(j.state, 'failed'); assert.equal(j.causa, 'previo'); assert.equal(j.remote, 0);
  falla('el servicio: 402 insufficient credits', { status: 402 }); j = await terminar(pedir().id); assert.equal(j.causa, 'previo');
  falla('x: 400 invalid argument', { status: 400 }); j = await terminar(pedir().id); assert.equal(j.causa, 'previo');
  falla('connect ECONNREFUSED', { code: 'ECONNREFUSED' }); j = await terminar(pedir().id); assert.equal(j.causa, 'previo');
  falla('fal: 403 forbidden: not enough credits', { status: 403, remote: true }); j = await terminar(pedir().id); assert.equal(j.state, 'failed'); assert.equal(j.remote, 1, 'el proveedor aceptó el pedido');
  assert.notEqual(j.causa, 'previo', 'con id remoto un 403 al sondear NO es previo al cobro'); assert.equal(j.causa, 'key', 'queda con la clase del error');
  falla('fal: 404 not found', { status: 404, remote: true }); j = await terminar(pedir().id); assert.notEqual(j.causa, 'previo');
  falla('el servicio no respondió: timed out', {}); j = await terminar(pedir().id); assert.equal(j.causa, 'tiempo', 'un transitorio conserva su clase');
});

test('causa REAL: cancelar en cola → cancelado_en_cola; cancelar en marcha → cancelado; reiniciar con un trabajo en marcha → interrumpido', async () => {
  RUN.prueba = async () => { await espera(300); };
  const a = pedir(); const c = media.cancel(a.id); assert.equal(c.state, 'failed'); assert.equal(c.causa, 'cancelado_en_cola');
  RUN.prueba = async (_m, job) => { for (let i = 0; i < 100 && !job.cancel; i++) await espera(20); throw new Error('cancelado'); };
  const b = pedir(); await espera(150); assert.equal(media.job(b.id).state, 'running'); media.cancel(b.id); const f = await terminar(b.id); assert.equal(f.causa, 'cancelado');
  RUN.prueba = () => new Promise(() => {}); const d = pedir(); await espera(150); assert.equal(media.job(d.id).state, 'running');
  loadJobs(); const e = media.job(d.id); assert.equal(e.state, 'failed'); assert.equal(e.causa, 'interrumpido', 'un trabajo en marcha sin id remoto que muere con la oficina');
});

// el generador con el Estudio REAL: el motor se hace pasar por «de pago» solo en lo que el generador lee (el nombre del motor)
const bib = B.normalizarBiblia({ paleta: [{ rol: 'primario', hex: '#1a2b3c' }], luz: 'cálida', nunca: ['x'], reglas: [] });
const aprobada = { existe: true, version: 1, estado: 'aprobada', biblia: bib };
const plano = n => ({ n, rol: 'desarrollo', descripcion: `plano ${n}`, prompt: `Un sofá gris en la sala, toma ${n}` });
let uid = 0;
function generador(t, { pago, n = 3 }) {
  const ID = `serie-c${++uid}`;
  const A = crearAlmacen({ archivo: path.join(fs.mkdtempSync(path.join(dir, 's-')), 's.json'), renombrar: fs.renameSync }), est = { t: 1e6, k: 0 };
  const M = { submit: media.submit, job: media.job, jobs: media.jobs, cancel: media.cancel, checkBudget: media.checkBudget, budget: media.budget, models: () => media.models().map(m => ({ ...m, engine: pago ? 'pagado' : m.engine })) };
  const G = crearGenerador({ almacen: A, media: M, biblia: { leer: () => aprobada }, capsDe: () => ({ maxRefs: 4 }), precioPlano: () => ({ generacion: 0.1, ...(pago ? {} : {}) }), activo: () => true, ahora: () => est.t, nonce: () => 'n'.repeat(15) + (++est.k), hoy: () => '2026-10-30', intervalo: 10 });
  const p = P.armarPropuesta({ brief: { titulo: 'S' }, planos: Array.from({ length: n }, (_, i) => plano(i + 1)), biblia: aprobada, hojas: [], ctx: { id: ID, capsDe: () => ({ maxRefs: 4 }), existeRef: () => true, precioPlano: () => ({ generacion: 0.1 }), modeloUnico: modelo.id } });
  A.crear(p.serie); const c = G.generar({ id: ID, modo: 'todo' }).cuerpo.confirmar; assert.equal(G.generar({ id: ID, modo: 'todo', confirmacion: c.token, costoMostradoUsd: c.costoMostradoUsd }).estado, 200);
  return { G, A, ID, linea: () => Object.values(A.uno(ID).libro.lineas)[0], serie: () => A.uno(ID), trabajos: () => media.jobs().filter(j => j.serie?.id === ID) };
}
const hasta = async (fn, ms = 4000) => { const fin = Date.now() + ms; while (Date.now() < fin) { const v = fn(); if (v) return v; await espera(40); } throw new Error('no llegó'); };

test('PAGO + id remoto + 403 al sondear: queda INCIERTO (no se libera ni se reintenta: seguiría generando y cobrando); sin id remoto + 401: se libera y se pausa sin culpar al plano', async t => {
  falla('fal: 403 not enough credits', { status: 403, remote: true }); const a = generador(t, { pago: true });
  await a.G.tick(); await hasta(() => a.trabajos().some(j => j.state === 'failed' && j.remote === 1)); await a.G.tick(); await a.G.tick();
  assert.equal(a.linea().estado, 'incierto'); assert.equal(a.serie().estado, 'pausado'); assert.equal(a.serie().escaleta[0].estado, 'revisar'); assert.equal(a.trabajos().length, 1, 'no se envió otro');
  falla('Higgsfield: 401 unauthorized', { status: 401 }); const b = generador(t, { pago: true });
  await b.G.tick(); await hasta(() => b.trabajos().some(j => j.state === 'failed' && j.causa === 'previo')); await b.G.tick(); await b.G.tick();
  assert.equal(b.linea().estado, 'liberado'); assert.equal(b.serie().estado, 'pausado'); assert.equal(b.serie().escaleta[0].estado, 'previsto'); assert.match(b.serie().pausa_motivo, /key|válida|permiso/i);
});

test('GRATIS con el Estudio real: un trabajo interrumpido por un reinicio se REINTENTA (no queda en revisar) y un cancelado en cola vuelve a la fila', async t => {
  RUN.prueba = () => new Promise(() => {}); const g = generador(t, { pago: false, n: 2 });
  await g.G.tick(); await hasta(() => g.trabajos().some(j => j.state === 'running')); loadJobs(); await g.G.tick(); await g.G.tick();
  assert.equal(g.serie().escaleta[0].estado, 'corriendo', 'reintentó el mismo plano'); assert.notEqual(g.serie().escaleta[0].estado, 'revisar'); assert.equal(Object.values(g.serie().libro.lineas).filter(l => l.estado === 'liberado').length, 1);
  assert.deepEqual(g.trabajos().map(j => j.serie.intento).sort(), [1, 2]);
});
