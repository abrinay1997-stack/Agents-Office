// 26 oct 2026 — QUIÉN ES «YO» en las tareas, y asignar una tarea a otra persona (una cuenta de la plataforma o alguien de Ajustes → Equipo).
// Lo puro (tareas/identidad.mjs y cómo lo usan dueno.mjs y estados.mjs) y las rutas (/api/tareas/mias con `persona`, /delegar, /tomar) sobre una oficina
// temporal. Lo de la nube con cuentas de verdad está en cloudflare/tests/tareas-asignar.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearAlmacenTareas } from '../tareas/almacen.mjs';
import { crearBus } from '../tareas/eventos.mjs';
import { crearCatalogo } from '../tareas/catalogo.mjs';
import { crearRutasTareas } from '../tareas/rutas.mjs';
import { crearRutasDueno } from '../tareas/rutas-dueno.mjs';
import { crearTarea } from '../tareas/modelo.mjs';
import { visible } from '../tareas/estados.mjs';
import { nombresMios, esMia, miNombre, delegoYo, esNombreMio, yoPagina } from '../tareas/identidad.mjs';
import { deLista, cuentas, puedeTomar, puedeDelegar, delegadaPorMi, esDelDueno, dia } from '../tareas/dueno.mjs';
import { limpiarNombreCarpeta } from '../src/movil/estudio-puro.js';

const AHORA = new Date('2026-10-26T11:00').getTime(), HOY = dia(AHORA);
const ANA = { nombre: 'Ana', admin: true }, CARLA = { nombre: 'Carla', admin: false };
const t = (id, c = {}) => ({ id, state: 'next', title: 'Tarea ' + id, prioridad: 'media', addedAt: AHORA - 3600e3, ...c });

test('quién soy: sin cuentas es «Tú»; una cuenta es su nombre y, si administra, también «Tú»', () => {
  assert.deepEqual(nombresMios(null), ['Tú']);
  assert.deepEqual(nombresMios(CARLA), ['Carla']);
  assert.deepEqual(nombresMios(ANA), ['Ana', 'Tú']);
  assert.deepEqual([esMia({ person: 'Tú' }, null), esMia({ person: 'Carla' }, null), esMia({ person: 'Carla' }, CARLA), esMia({ person: 'Tú' }, CARLA), esMia({ person: 'Tú' }, ANA), esMia({ person: 'Carla' }, ANA), esMia({}, ANA), esMia(null, ANA)], [true, false, true, false, true, false, false, false]);
  assert.deepEqual([miNombre(null), miNombre(CARLA)], ['Tú', 'Carla']);
  assert.deepEqual([esNombreMio('Tú', CARLA), esNombreMio('Carla', CARLA), esNombreMio('Ana', CARLA), esNombreMio('Carla', null)], [true, true, false, false]);
});

test('la página lee quién es de window.AO_NUBE (y fuera del navegador no hay nadie)', () => {
  assert.equal(yoPagina(), null);
  globalThis.AO_NUBE = { yo: () => ({ nombre: 'Carla', rol: 'editor' }) };
  try { assert.deepEqual(yoPagina(), CARLA); assert.equal(esMia({ person: 'Carla' }), true, 'sin pasar yo, usa el de la página'); assert.equal(esDelDueno({ person: 'Tú' }), false); }
  finally { delete globalThis.AO_NUBE; }
  globalThis.AO_NUBE = { yo: () => null }; try { assert.equal(yoPagina(), null); } finally { delete globalThis.AO_NUBE; } // todavía no sabe quién es
});

test('Mías es de cada cuenta: lo asignado a Carla le sale a Carla, el administrador ve también lo del dueño, y lo que cada uno delegó lo sigue él', () => {
  const l = [t('a', { person: 'Carla', limite: HOY }), t('b', { person: 'Ana', limite: HOY }), t('c', { person: 'Tú', limite: HOY }), t('d', { agent: 'piper', dept: 'sales' }),
    t('e', { person: 'Carla', delegada: { at: AHORA, a: 'persona:Carla', por: 'Ana' } }), t('f', { person: 'Ana', delegada: { at: AHORA, a: 'persona:Ana', por: 'Carla' } }), t('g', { person: 'Beto', delegada: { at: AHORA, a: 'persona:Beto' } })];
  const ids = (yo, k) => deLista(l, k, { ahora: AHORA, yo }).pendientes.map(x => x.id).sort();
  assert.deepEqual(ids(CARLA, 'todas'), ['a', 'e']);
  assert.deepEqual(ids(ANA, 'todas'), ['b', 'c', 'f']);
  assert.deepEqual(ids(null, 'todas'), ['c'], 'sin cuentas: solo «Tú», como siempre');
  assert.deepEqual(ids(ANA, 'delegadas'), ['e', 'g'], 'Ana ve lo que ella delegó y lo de antes (sin «por»)');
  assert.deepEqual(ids(CARLA, 'delegadas'), ['f', 'g'], 'Carla: lo que delegó ella y lo de antes');
  assert.equal(cuentas(l, { ahora: AHORA, yo: CARLA }).hoy, 1);
  assert.equal(cuentas(l, { ahora: AHORA, yo: ANA }).hoy, 2);
  assert.deepEqual([delegoYo(l[4], ANA), delegoYo(l[4], CARLA), delegoYo({ delegada: {} }, CARLA)], [true, false, true]);
  assert.equal(delegadaPorMi(l[4], CARLA), false, 'Carla la tiene, no la delegó');
});

test('el estado que se ve: «Tuya» para mí, «En manos de una persona» para las demás', () => {
  assert.deepEqual([visible({ state: 'next', person: 'Carla' }, null, CARLA), visible({ state: 'next', person: 'Carla' }, null, ANA), visible({ state: 'next', person: 'Tú' }, null, ANA), visible({ state: 'next', person: 'Tú' }, null, CARLA)], ['tuya', 'en_manos', 'tuya', 'en_manos']);
  assert.equal(visible({ state: 'next', person: 'Tú' }), 'tuya', 'sin cuentas, como siempre');
});

test('tomar y delegar: solo lo mío se delega; lo que otra cuenta tiene no se lo quita un editor (un administrador sí, y quien la delegó la recupera)', () => {
  const deAgente = t('x', { agent: 'piper', dept: 'sales' }), deCarla = t('y', { person: 'Carla' }), mandada = t('z', { person: 'Beto', delegada: { at: AHORA, a: 'persona:Beto', por: 'Carla' } });
  assert.equal(puedeTomar(deAgente, CARLA).ok, true);
  assert.equal(puedeTomar(deCarla, CARLA).ok, false, 'ya es suya');
  assert.equal(puedeTomar(deCarla, ANA).ok, true, 'un administrador sí');
  assert.equal(puedeTomar(deCarla, { nombre: 'Dani', admin: false }).ok, false);
  assert.match(puedeTomar(deCarla, { nombre: 'Dani', admin: false }).motivo, /la tiene Carla/);
  assert.equal(puedeTomar(mandada, CARLA).ok, true, 'quien la delegó la recupera');
  assert.equal(puedeTomar(mandada, { nombre: 'Dani', admin: false }).ok, false);
  assert.equal(puedeDelegar(deCarla, CARLA).ok, true);
  assert.equal(puedeDelegar(deCarla, { nombre: 'Dani', admin: false }).ok, false);
  assert.equal(puedeDelegar(t('w', { person: 'Tú' }), ANA).ok, true);
  assert.equal(puedeDelegar(t('w', { person: 'Tú' }), CARLA).ok, false);
});

test('el nombre de una carpeta del Estudio se limpia igual que en el servidor', async () => {
  const { cleanName } = await import('../media/galeria-core.mjs');
  for (const n of ['  Navidad  ', 'a\u0000b<c>', 'x'.repeat(90), 'dos   espacios', '', null]) assert.equal(limpiarNombreCarpeta(n), cleanName(n), JSON.stringify(n));
});

/* ---------- las rutas, sobre una oficina temporal ---------- */
function oficina({ yo = () => null, personas = ['Ana', 'Carla'] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-ident-')), file = path.join(dir, 'tasks.json');
  const bus = crearBus(), alm = crearAlmacenTareas({ file, dataDir: dir, bus }), cat = crearCatalogo({ dataDir: dir });
  const avisadas = []; let n = 0;
  const agentes = [{ id: 'piper', department: 'sales', name: 'PIPER' }, { id: 'sam', department: 'sales', lead: true, name: 'SAM' }];
  const altaTarea = (c, { por, id } = {}) => { const x = crearTarea(c, { id: id || (() => 'tk' + (++n).toString().padStart(3, '0')) }); const l = alm.load(); l.push(x); alm.save(l, { por }); return x; };
  const json = (res, code, b) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(b)); };
  const body = req => new Promise(ok => { let s = ''; req.on('data', d => { s += d; }); req.on('end', () => ok(s ? JSON.parse(s) : {})); });
  const comun = { alm, cat, json, body, yo, pump: () => {}, agentes, depts: { sales: { name: 'Ventas' } }, leadOf: d => agentes.find(a => a.department === d && a.lead), avisar: () => {}, altaTarea, nombre: id => id };
  const rutas = crearRutasTareas(comun);
  const dueno = crearRutasDueno({ ...comun, personas: () => personas, avisarPersona: (p, tx) => avisadas.push([p, tx]), adivinarOk: () => false, exigeOk: () => false });
  const srv = http.createServer(async (req, res) => { const url = new URL(req.url, 'http://x'); if (!(await dueno(req, res, url) || await rutas(req, res, url))) json(res, 404, { error: 'no' }); });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const api = async (m, p, b) => { const x = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: x.status, ...(await x.json()) }; };
    r({ alm, api, avisadas, una: id => alm.load().find(x => x.id === id), cerrar: () => { srv.close(); fs.rmSync(dir, { recursive: true, force: true }); } });
  }));
}

test('sin cuentas (la oficina local): «para mí» sigue siendo «Tú» y se puede asignar a una persona de Ajustes → Equipo', async () => {
  const o = await oficina();
  try {
    const mia = (await o.api('POST', '/api/tareas/mias', { title: 'Llamar al banco' })).tarea;
    assert.equal(mia.person, 'Tú');
    const a = await o.api('POST', '/api/tareas/mias', { title: 'Revisar el inventario', persona: 'ana', nota: 'hoy' });
    assert.equal(a.status, 200, JSON.stringify(a));
    assert.deepEqual([a.tarea.person, a.tarea.delegada.a, a.tarea.delegada.por, a.a], ['Ana', 'persona:Ana', 'Tú', 'Ana'], 'se acepta «ana» y queda como está en Ajustes');
    assert.deepEqual(o.avisadas, [['Ana', '👤 El dueño te asignó «Revisar el inventario»: hoy.']]);
    assert.equal((await o.api('POST', '/api/tareas/mias', { title: 'x', persona: 'Nadie' })).status, 400);
    const m = await o.api('GET', '/api/tareas/mias');
    assert.deepEqual(m.listas.delegadas.pendientes.map(x => x.id), [a.tarea.id]);
    assert.deepEqual(m.listas.todas.pendientes.map(x => x.id), [mia.id]);
    assert.equal((await o.api('POST', '/api/tareas/mias', { title: 'otra', persona: 'yo' })).tarea.person, 'Tú', '«yo» es para mí');
  } finally { o.cerrar(); }
});

test('con cuentas: cada una firma con su nombre, asigna a otra y no se asigna a sí misma por la puerta de atrás', async () => {
  let quien = CARLA;
  const o = await oficina({ yo: () => quien, personas: ['Ana', 'Carla'] });
  try {
    const propia = (await o.api('POST', '/api/tareas/mias', { title: 'Cuadrar la caja', persona: 'Carla' })).tarea;
    assert.equal(propia.person, 'Carla'); assert.equal(propia.delegada, undefined, 'asignármela a mí es «para mí»');
    const paraAna = (await o.api('POST', '/api/tareas/mias', { title: 'Aprobar el precio', persona: 'Ana', nota: 'urgente' })).tarea;
    assert.deepEqual([paraAna.person, paraAna.delegada.por, paraAna.handoff.from], ['Ana', 'Carla', 'Carla']);
    assert.equal(o.una(paraAna.id).comments[0].by, 'Carla', 'la nota lleva su firma');
    assert.deepEqual(o.avisadas.at(-1), ['Ana', '👤 Carla te asignó «Aprobar el precio»: urgente.']);
    // el cronómetro y «hecha» firman con su nombre
    const e = await o.api('POST', `/api/tareas/${propia.id}/empezar`, { empezar: true });
    assert.ok(e.tarea.cronometro.some(c => c.quien === 'Carla' && !c.fin));
    const h = await o.api('POST', `/api/tareas/${propia.id}/estado`, { a: 'done' });
    assert.deepEqual([h.tarea.hechaPor, h.tarea.state], ['Carla', 'done']);
    // delegar lo suyo a Ana; a sí misma no
    const p2 = (await o.api('POST', '/api/tareas/mias', { title: 'Preparar la propuesta' })).tarea;
    assert.equal((await o.api('POST', `/api/tareas/${p2.id}/delegar`, { a: 'persona', persona: 'Carla' })).status, 400);
    const d = await o.api('POST', `/api/tareas/${p2.id}/delegar`, { a: 'persona', persona: 'Ana' });
    assert.deepEqual([d.status, d.tarea.person, d.tarea.delegada.por], [200, 'Ana', 'Carla']);
    // Ana (administradora) ve lo suyo; Carla ya no puede delegar lo que dejó de ser suyo
    quien = ANA;
    const mAna = await o.api('GET', '/api/tareas/mias');
    assert.ok(mAna.listas.todas.pendientes.some(x => x.id === p2.id) && mAna.listas.todas.pendientes.some(x => x.id === paraAna.id));
    quien = CARLA;
    assert.equal((await o.api('POST', `/api/tareas/${p2.id}/delegar`, { a: 'persona', persona: 'Carla' })).status, 409);
    // tomar: Carla recupera lo que ella delegó (el DESHACER)
    const t = await o.api('POST', `/api/tareas/${p2.id}/tomar`, { deshacer: true });
    assert.deepEqual([t.status, t.tarea.person, t.tarea.delegada], [200, 'Carla', undefined]);
  } finally { o.cerrar(); }
});
