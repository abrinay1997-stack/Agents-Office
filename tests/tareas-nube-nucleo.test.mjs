// Lo que se separó de la oficina local para que el Worker de Cloudflare lo reutilice (puerto, fase 3): el .ics, las rutinas, el roster,
// el catálogo y el almacén de tareas. Cada prueba demuestra que el comportamiento LOCAL no cambió.
process.env.TZ = 'UTC'; // el .ics usa la hora local de la máquina: el valor de referencia se sacó en UTC
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { icsFeed } from '../calendario-ics.mjs';
import { muestra } from './fixtures/ics-muestra.mjs';
import * as routines from '../routines.mjs';
import * as routinesCore from '../routines-core.mjs';
import * as roster from '../roster.mjs';
import * as rosterCore from '../roster-core.mjs';
import { crearAlmacenTareas } from '../tareas/almacen.mjs';
import { crearAlmacenMemoria } from '../tareas/almacen-memoria.mjs';
import { crearCatalogo } from '../tareas/catalogo.mjs';
import { crearCatalogoCon } from '../tareas/catalogo-core.mjs';
import { crearTarea } from '../tareas/modelo.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

test('el .ics sale idéntico al que armaba serve.mjs (referencia sacada del código anterior, mismos datos y misma hora)', () => {
  const Real = Date, AHORA = Date.UTC(2026, 9, 25, 15, 30);
  const out = icsFeed({ rutinas: muestra.rutinas, tareas: muestra.tareas, agentes: muestra.agentes, depts: muestra.depts, nombre: muestra.nombre, ahora: new Real(AHORA) });
  assert.equal(out, fs.readFileSync(path.join(AQUI, 'fixtures', 'calendario-ics.golden.ics'), 'utf8'));
});

test('routines.mjs sigue exportando lo mismo que antes y su parte pura es la de routines-core.mjs', () => {
  assert.deepEqual(Object.keys(routines).sort(), ['ALLOWED', 'LATE_AFTER', 'NAMES', 'advance', 'askLine', 'due', 'file', 'guessNeedsOk', 'listText', 'load', 'loadState', 'matchRoutine', 'patchFile', 'refusal', 'save', 'saveState', 'stateFile', 'validate', 'withState']);
  for (const k of Object.keys(routinesCore)) assert.equal(routines[k], routinesCore[k], k);
});

test('roster.mjs: la oficina de verdad se lee igual con la parte pura (roster-core) que con los archivos', () => {
  assert.deepEqual(Object.keys(roster).sort(), ['FILE', 'LOCAL', 'brainFile', 'defaults', 'deptName', 'loadRoster', 'saveAgent', 'validate']);
  const r = roster.loadRoster();
  assert.equal(r.agents.length, 35);
  const doc = JSON.parse(fs.readFileSync(roster.FILE, 'utf8'));
  const dentro = rosterCore.fusionar([{ etiqueta: 'office.agents.json', doc }]);
  assert.equal(dentro.agents.length, 35);
  assert.deepEqual(dentro.problems, []);
  const malo = rosterCore.fusionar([{ etiqueta: 'x.json', doc: { __error: 'Unexpected token\nlinea 2' } }]);
  assert.match(malo.problems[0], /x\.json: not valid JSON \(Unexpected token\) — ignored/);
  const raro = rosterCore.fusionar([{ etiqueta: 'local', doc: { agents: [{ id: 'nadie', name: 'X' }, { id: 'elead', name: 'jefe de correo', department: 'sales' }] } }]);
  assert.ok(raro.problems.some(p => /not one of the 35 seats/.test(p)) && raro.problems.some(p => /department cannot change/.test(p)));
  assert.equal(raro.agents.find(a => a.id === 'elead').name, 'JEFE DE CORREO');
});

test('el catálogo de proyectos y etiquetas hace lo mismo con archivos que con una memoria cualquiera', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-cat-'));
  try {
    const a = crearCatalogo({ dataDir: dir, ahora: () => 1000 });
    let P = [], E = [];
    const b = crearCatalogoCon({ proyectos: { leer: () => P, escribir: l => { P = JSON.parse(JSON.stringify(l)); } }, etiquetas: { leer: () => E, escribir: l => { E = JSON.parse(JSON.stringify(l)); } } }, { ahora: () => 1000 });
    for (const c of [a, b]) {
      assert.equal(c.crearProyecto({ nombre: '' }).error, 'el proyecto necesita un nombre');
      const p = c.crearProyecto({ nombre: 'Lanzamiento de lentes', color: 'verde', limite: '2026-11-30' }).proyecto;
      assert.equal(p.id, 'pr-lanzamiento-de-lentes'); assert.equal(p.estado, 'activo');
      assert.equal(c.crearProyecto({ nombre: 'lanzamiento de lentes' }).error, 'ya hay un proyecto con ese nombre');
      assert.equal(c.cambiarProyecto(p.id, { limite: '30/11' }).error, 'la fecha límite va como AAAA-MM-DD');
      assert.equal(c.cambiarProyecto(p.id, { estado: 'pausa' }).proyecto.estado, 'pausa');
      const e = c.crearEtiqueta({ nombre: '#lentes' }).etiqueta; assert.equal(e.nombre, 'lentes');
      assert.equal(c.crearEtiqueta({ nombre: 'LENTES' }).existia, true);
      assert.deepEqual(c.borrarProyecto('pr-no-existe').status, 404);
      assert.equal(c.borrarEtiqueta(e.id).ok, true);
    }
    assert.deepEqual(P.map(p => [p.id, p.estado, p.color]), JSON.parse(fs.readFileSync(path.join(dir, 'tareas', 'proyectos.json'), 'utf8')).map(p => [p.id, p.estado, p.color]));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('el almacén en memoria cuenta lo mismo que el de archivos: versiones, bitácora y eventos', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-alm-'));
  try {
    let n = 0;
    const eventos = [];
    const bus = { emit: (tipo, d) => eventos.push([tipo, d.tarea?.id, d.por]) };
    const ahora = () => 5000 + (++n) * 0; // hora fija
    const arch = crearAlmacenTareas({ file: path.join(dir, 'tasks.json'), dataDir: dir, bus, ahora });
    const mem = crearAlmacenMemoria({ tareas: [], ahora });
    const t1 = crearTarea({ dept: 'ops', agent: 'o1', title: 'Una', text: 'Una' }, { id: () => 'aaaa1', ahora: 1 });
    const t2 = crearTarea({ dept: 'ops', agent: 'o1', title: 'Dos', text: 'Dos', plan: ['a', 'b'] }, { id: () => 'bbbb2', ahora: 2 });
    for (const alm of [arch, mem]) {
      const l = alm.load(); l.push(structuredClone(t1), structuredClone(t2)); alm.save(l, { por: 'dueno' });
      alm.cambiar('aaaa1', t => { t.prioridad = 'alta'; t.comments = [{ at: 1, by: 'Tú', text: 'hola' }]; }, { por: 'dueno' });
      alm.cambiar('bbbb2', t => { t.state = 'doing'; }, {});
      assert.equal(alm.cambiar('nada', () => {}).status, 404);
      alm.save(alm.load().filter(t => t.id !== 'bbbb2'), { por: 'dueno' });
    }
    const a = arch.load(), m = mem.load();
    assert.deepEqual(m, a);
    assert.equal(a[0].version, 2);
    await new Promise(r => setImmediate(r)); // el bus del almacén de archivos emite después de guardar
    const c = mem.cambios();
    assert.deepEqual(c.lineas, arch.bitacoraDesde(0)); // la bitácora, línea por línea, es la misma
    assert.deepEqual(c.eventos.map(([t, d]) => [t, d.tarea.id, d.por]), eventos);
    assert.ok(eventos.length >= 5 && eventos.some(e => e[0] === 'tarea.estado') && eventos.some(e => e[0] === 'tarea.borrada'));
    // nace aaaa1 (no existía en la base), bbbb2 nació y se borró (no se sube ni se borra de la base)
    assert.deepEqual(c.subir.map(x => x.tarea.id), ['aaaa1']);
    assert.deepEqual(c.borrar, []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('el almacén en memoria: lo que ya estaba en la base se sube con la versión que tenía al leer, y borrar la anota', () => {
  const t = crearTarea({ dept: 'ops', agent: 'o1', title: 'Vieja', text: 'Vieja' }, { id: () => 'cccc3', ahora: 3 });
  const mem = crearAlmacenMemoria({ tareas: [t, crearTarea({ dept: 'ops', agent: 'o1', title: 'Otra', text: 'Otra' }, { id: () => 'dddd4' })] });
  assert.deepEqual(mem.cambios().subir, []);
  mem.cambiar('cccc3', x => { x.etiquetas = ['e-x']; }, { por: 'dueno' });
  mem.save(mem.load().filter(x => x.id !== 'dddd4'), { por: 'dueno' });
  const c = mem.cambios();
  assert.deepEqual(c.subir.map(x => [x.tarea.id, x.versionAntes, x.tarea.version]), [['cccc3', 1, 2]]);
  assert.deepEqual(c.borrar, [{ id: 'dddd4', versionAntes: 1 }]);
  assert.ok(c.lineas.some(l => l.tipo === 'borrada' && l.tarea === 'dddd4'));
});
