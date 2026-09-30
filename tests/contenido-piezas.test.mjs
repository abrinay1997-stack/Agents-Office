// V4.7: las piezas de contenido (contenido/piezas.mjs) — la nota con cabecera, y el almacén que la lee y la escribe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parsear, serializar, huella, normalizar, crearAlmacen, ESTADOS } from '../contenido/piezas.mjs';

const nueva = (extra = {}) => normalizar({ titulo: 'Examen gratis', fecha: '2026-10-05', hora: '09:00', formato: 'carrusel', redes: ['instagram', 'facebook'], texto: 'Agenda tu cita.\n\nEs gratis.', ...extra }).pieza;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ao-piezas-'));
const IMG = ['2026-10/a.jpg', '2026-10/b.jpg'];
let reloj = Date.parse('2026-09-30T10:20:00Z');
const almacen = (over = {}) => crearAlmacen({ dir: tmp(), ahora: () => (reloj += 1000), ...over });

test('una pieza vuelve igual tras escribirla y leerla, con textos difíciles', () => {
  const p = { ...nueva({ titulo: 'Título: con «comillas» y "dobles" # y 100%', texto: 'Línea 1 ✦ 🎁\n\n## No es una sección conocida\nsigue el texto', comentario: 'Gracias por pasar', hashtags: '#optica #gafas', textoFacebook: 'Versión de Facebook', notas: 'Ojo: el precio cambia el lunes' }), id: 'p-20261005-a1b2', creada: '2026-09-30T10:20:00.000Z', actualizada: '2026-09-30T10:21:00.000Z', responsable: 'newt', origen: 'agente:newt', medios: ['2026-10/2026-10-01 examen gratis 101533.png', '2026-10/b.jpg'], aprobada: { cuando: '2026-09-30T11:00:00.000Z', huella: 'abc123', por: 'dueno' } };
  const md = serializar(p);
  assert.match(md, /^---\ntipo: pieza\nid: p-20261005-a1b2\n/);
  assert.deepEqual(parsear(md), p);
  assert.match(md, /\n## Primer comentario\nGracias por pasar\n/);
});

test('la cabecera se puede escribir a mano: listas en línea o en bloque, y lo que falte toma su valor de siempre', () => {
  const p = parsear('---\nid: p-20261006-ffff\nfecha: 2026-10-06\nformato: reel\nredes: [instagram, "facebook"]\nmedios:\n  - 2026-10/v.mp4\nestado: revision\n---\nHola\n');
  assert.equal(p.formato, 'reel'); assert.deepEqual(p.redes, ['instagram', 'facebook']); assert.deepEqual(p.medios, ['2026-10/v.mp4']);
  assert.equal(p.estado, 'revision'); assert.equal(p.texto, 'Hola'); assert.equal(p.hora, ''); assert.equal(p.aprobada, null);
  const mala = parsear('---\nid: p-20261006-ffff\nfecha: pronto\nformato: tiktok\nredes: [tiktok, instagram]\nestado: publicada\n---\n');
  assert.deepEqual([mala.fecha, mala.formato, mala.redes, mala.estado], ['', 'post', ['instagram'], 'borrador']);
  assert.equal(parsear('sin cabecera, solo texto').texto, 'sin cabecera, solo texto');
});

test('normalizar dice en palabras qué está mal, y solo toca lo que viene', () => {
  assert.match(normalizar({ fecha: '5 de octubre' }).error, /AAAA-MM-DD/);
  assert.match(normalizar({ fecha: '2026-02-31' }).error, /no existe/);
  assert.match(normalizar({ hora: '25:00' }).error, /HH:MM/);
  assert.match(normalizar({ formato: 'directo' }).error, /post, reel, carrusel, historia/);
  assert.match(normalizar({ redes: ['tiktok'] }).error, /«tiktok» no es una red/);
  assert.match(normalizar({ estado: 'publicada' }).error, /idea, borrador, revision, aprobada/);
  const p = nueva(); const q = normalizar({ texto: 'Otro' }, p).pieza;
  assert.equal(q.texto, 'Otro'); assert.equal(q.fecha, '2026-10-05'); assert.deepEqual(q.redes, ['instagram', 'facebook']);
  assert.equal(normalizar({}).pieza.formato, 'post'); assert.deepEqual(normalizar({}).pieza.redes, ['instagram']);
  assert.deepEqual(normalizar({ redes: 'instagram, Facebook, instagram' }).pieza.redes, ['instagram', 'facebook']);
});

test('un texto que trae una línea «## Notas» no se cuela en la sección de notas al volver a abrir la nota', () => {
  const p = { ...nueva({ texto: 'Primera línea\n## Notas\nesto sigue siendo del texto\n## Hashtags\n#uno', notas: 'de verdad, una nota' }), id: 'p-20261005-a1b2', creada: '2026-09-30T10:20:00.000Z', actualizada: '2026-09-30T10:20:00.000Z' };
  assert.match(p.texto, /^# Notas$/m); assert.match(p.texto, /^# Hashtags$/m);
  const q = parsear(serializar(p)); assert.equal(q.texto, p.texto); assert.equal(q.notas, 'de verdad, una nota'); assert.equal(q.hashtags, '');
});

test('la huella cambia con lo que sale y no con lo interno', () => {
  const p = nueva(); const h = huella(p);
  assert.equal(huella({ ...p, notas: 'algo interno', titulo: 'Otro título', responsable: 'x' }), h);
  for (const cambio of [{ texto: 'x' }, { hora: '10:00' }, { fecha: '2026-10-06' }, { redes: ['instagram'] }, { medios: ['2026-10/a.jpg'] }, { hashtags: '#a' }, { comentario: 'c' }])
    assert.notEqual(huella({ ...p, ...cambio }), h, JSON.stringify(cambio));
});

test('crear, leer y listar por rango: las piezas viven en carpetas por mes y las que no tienen día, aparte', () => {
  const a = almacen();
  const p1 = a.crear({ titulo: 'Uno', fecha: '2026-10-05', hora: '09:00', texto: 'x', medios: [] }).pieza;
  const p2 = a.crear({ titulo: 'Dos', fecha: '2026-10-30', texto: 'y' }).pieza;
  const p3 = a.crear({ titulo: 'Tres', fecha: '2026-11-02', hora: '08:00', texto: 'z' }).pieza;
  const p4 = a.crear({ titulo: 'Idea suelta', texto: 'sin día', estado: 'idea' }).pieza;
  assert.match(p1.id, /^p-20261005-[a-f0-9]{4}$/); assert.match(p4.id, /^p-20260930-/);
  assert.ok(fs.existsSync(path.join(a.dir, '2026-10', `${p1.id}.md`))); assert.ok(fs.existsSync(path.join(a.dir, 'sin-fecha', `${p4.id}.md`)));
  assert.equal(a.leer(p1.id).titulo, 'Uno'); assert.equal(a.leer('p-20261005-0000'), null); assert.equal(a.leer('../etc/passwd'), null);
  assert.deepEqual(a.listar({ desde: '2026-10-01', hasta: '2026-10-31' }).map(p => p.titulo), ['Uno', 'Dos']);
  assert.deepEqual(a.listar({ desde: '2026-10-28', hasta: '2026-11-03' }).map(p => p.titulo), ['Dos', 'Tres'], 'un rango que cruza de mes abre las dos carpetas');
  assert.deepEqual(a.listar({ desde: '2026-10-01', hasta: '2026-11-30', sinFecha: true }).map(p => p.titulo), ['Uno', 'Dos', 'Tres', 'Idea suelta']);
  assert.deepEqual(a.listar().map(p => p.titulo), ['Uno', 'Dos', 'Tres', 'Idea suelta']);
  assert.deepEqual(a.listar({ q: 'suelta' }).map(p => p.titulo), ['Idea suelta']);
  assert.deepEqual(a.listar({ estado: 'idea' }).map(p => p.titulo), ['Idea suelta']);
  assert.deepEqual(a.listar({ desde: '2026-10-01', hasta: '2026-10-31', red: 'facebook' }).length, 0);
  void p2; void p3;
});

test('las piezas de un mismo día salen por hora, y las sin hora al final del día', () => {
  const a = almacen();
  a.crear({ titulo: 'Tarde', fecha: '2026-10-05', hora: '18:00' }); a.crear({ titulo: 'Sin hora', fecha: '2026-10-05' }); a.crear({ titulo: 'Mañana', fecha: '2026-10-05', hora: '08:30' });
  assert.deepEqual(a.listar({ desde: '2026-10-05', hasta: '2026-10-05' }).map(p => p.titulo), ['Mañana', 'Tarde', 'Sin hora']);
});

test('una pieza no nace aprobada, ni se aprueba guardándola: se aprueba con «Aprobar»', () => {
  const a = almacen();
  assert.match(a.crear({ estado: 'aprobada' }).error, /no nace aprobada/);
  const p = a.crear({ fecha: '2026-10-05', texto: 'x' }).pieza;
  assert.match(a.guardar(p.id, { estado: 'aprobada' }).error, /usa «Aprobar»/);
});

test('aprobar exige que pueda salir y tenga día; el error trae el motivo y el arreglo está en las reglas', () => {
  const a = almacen({ medioExiste: m => IMG.includes(m) });
  const sinDia = a.crear({ texto: 'x', medios: [IMG[0]] }).pieza;
  assert.match(a.aprobar(sinDia.id).error, /ponle un día/);
  const sinMedios = a.crear({ fecha: '2026-10-05', texto: 'x' }).pieza;
  const r = a.aprobar(sinMedios.id); assert.match(r.error, /todavía no puede salir: Instagram necesita al menos una imagen o un video/); assert.equal(r.errores.length >= 1, true);
  a.guardar(sinMedios.id, { medios: [IMG[0]] });
  const ok = a.aprobar(sinMedios.id, { por: 'Abrinay' });
  assert.equal(ok.pieza.estado, 'aprobada'); assert.equal(ok.pieza.aprobada.por, 'Abrinay'); assert.equal(ok.pieza.aprobada.huella, huella(ok.pieza));
  assert.equal(a.leer(sinMedios.id).estado, 'aprobada', 'el OK queda escrito en la nota');
  assert.equal(a.aprobar('p-20200101-0000').nada, true);
});

test('cambiar lo que sale de una pieza aprobada le quita el OK; cambiar lo interno, no', () => {
  const a = almacen({ medioExiste: () => true });
  const p = a.crear({ fecha: '2026-10-05', texto: 'Hola', medios: [IMG[0]] }).pieza; a.aprobar(p.id);
  const interno = a.guardar(p.id, { notas: 'ojo con el precio', titulo: 'Otro título', responsable: 'Ana' });
  assert.equal(interno.pieza.estado, 'aprobada'); assert.equal(interno.soltada, false); assert.equal(interno.pieza.cambiadaTrasAprobar, false);
  const publico = a.guardar(p.id, { texto: 'Hola con precio nuevo' });
  assert.equal(publico.pieza.estado, 'revision'); assert.equal(publico.soltada, true); assert.equal(publico.pieza.aprobada, null);
  a.aprobar(p.id); assert.equal(a.guardar(p.id, { hora: '10:30' }).pieza.estado, 'revision');
  a.aprobar(p.id); assert.equal(a.guardar(p.id, { fecha: '2026-10-06' }).pieza.estado, 'revision');
});

test('una nota editada a mano después de aprobarla se nota: cambiadaTrasAprobar', () => {
  const a = almacen(); const p = a.crear({ fecha: '2026-10-05', texto: 'Hola', medios: [IMG[0]] }).pieza; a.aprobar(p.id);
  const f = path.join(a.dir, '2026-10', `${p.id}.md`); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Hola', 'Hola, editada fuera de la oficina'));
  const leida = a.leer(p.id); assert.equal(leida.estado, 'aprobada'); assert.equal(leida.cambiadaTrasAprobar, true);
});

test('mover una pieza a otro mes la cambia de carpeta sin duplicarla', () => {
  const a = almacen(); const p = a.crear({ fecha: '2026-10-30', texto: 'x' }).pieza;
  a.guardar(p.id, { fecha: '2026-11-02' });
  assert.ok(fs.existsSync(path.join(a.dir, '2026-11', `${p.id}.md`))); assert.ok(!fs.existsSync(path.join(a.dir, '2026-10', `${p.id}.md`)));
  a.guardar(p.id, { fecha: '' }); assert.ok(fs.existsSync(path.join(a.dir, 'sin-fecha', `${p.id}.md`)));
  assert.equal(a.listar().length, 1);
});

test('una pieza no apunta a un archivo que el Estudio no tiene', () => {
  const a = almacen({ medioExiste: m => m === IMG[0] });
  assert.match(a.crear({ medios: [IMG[1]] }).error, /el Estudio no tiene «2026-10\/b.jpg»/);
  const p = a.crear({ medios: [IMG[0]] }).pieza; assert.match(a.guardar(p.id, { historias: ['2026-10/x.png'] }).error, /el Estudio no tiene/);
});

test('devolver quita el OK; borrar manda a la papelera; usos dice qué piezas usan un archivo', () => {
  const a = almacen(); const p = a.crear({ titulo: 'Con imagen', fecha: '2026-10-05', texto: 'x', medios: [IMG[0]], historias: [IMG[1]] }).pieza; a.aprobar(p.id);
  assert.deepEqual(a.usos(IMG[0]).map(u => u.titulo), ['Con imagen']); assert.deepEqual(a.usos(IMG[1]).map(u => u.id), [p.id]); assert.deepEqual(a.usos('2026-10/otra.png'), []);
  const d = a.devolver(p.id); assert.equal(d.pieza.estado, 'revision'); assert.equal(d.pieza.aprobada, null);
  assert.equal(a.devolver(p.id, 'borrador').pieza.estado, 'borrador');
  assert.equal(a.borrar(p.id).ok, true); assert.equal(a.leer(p.id), null);
  assert.equal(fs.readdirSync(path.join(a.dir, '.papelera')).length, 1); assert.equal(a.listar().length, 0, 'la papelera no se lista');
  assert.equal(a.borrar(p.id).nada, true);
});

test('una nota rota o que no es una pieza no tumba la lista', () => {
  const a = almacen(); a.crear({ titulo: 'Buena', fecha: '2026-10-05' });
  fs.writeFileSync(path.join(a.dir, '2026-10', 'notas-sueltas.md'), 'esto lo escribió alguien a mano, sin cabecera');
  fs.writeFileSync(path.join(a.dir, '2026-10', 'p-20261005-zzzz.md'), '---\n:::\n---\n');
  assert.ok(a.listar().some(p => p.titulo === 'Buena'));
});

test('los estados que se deciden aquí son cuatro', () => assert.deepEqual(ESTADOS, ['idea', 'borrador', 'revision', 'aprobada']));
