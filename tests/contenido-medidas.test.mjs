// V4.10 (1 oct 2026, auditoría CON-03/06, PRE-02/14): las reglas de proporción y de duración por fin se disparan (los medios llevan sus medidas,
// del registro .json del Estudio), y aprobar exige hora y un momento que venga. Lo de Juancito Ads sigue en contenido-reglas.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { revisarPublicacion, postDePieza, medidaDeItem, revisarMomento, PROGRAMAR } from '../src/contenido-reglas.js';
import { crearAlmacen, medidaDelEstudio } from '../contenido/piezas.mjs';

const pieza = o => ({ formato: 'post', redes: ['instagram'], medios: [], texto: 'Hola', hashtags: '', ...o });
const rev = p => revisarPublicacion(postDePieza(p), p.redes);

test('una imagen 9:16 como post del feed ya no pasa: error con su arreglo «Publicarla como historia»', () => {
  const r = rev(pieza({ medios: ['2026-10/v.jpg'], medidas: { '2026-10/v.jpg': { ancho: 1080, alto: 1920 } } }));
  assert.match(r.errores.join(' '), /1080×1920.*4:5/);
  assert.equal(Object.values(r.arreglos).find(a => a.codigo === 'formato:historia')?.etiqueta, 'Publicarla como historia');
  assert.equal(rev(pieza({ medios: ['2026-10/c.jpg'], medidas: { '2026-10/c.jpg': { ancho: 1080, alto: 1080 } } })).errores.length, 0, 'un cuadrado cabe');
  assert.equal(rev(pieza({ medios: ['2026-10/x.jpg'] })).errores.length, 0, 'sin medidas no se inventa un error');
});

test('una historia horizontal avisa; un video de historia de más de 60 s y un reel fuera de 3 s – 15 min son errores', () => {
  const h = rev(pieza({ formato: 'historia', texto: '', medios: ['2026-10/h.jpg'], medidas: { '2026-10/h.jpg': { ancho: 1920, alto: 1080 } } }));
  assert.match(h.avisos.join(' '), /no 9:16/);
  const hv = rev(pieza({ formato: 'historia', texto: '', medios: ['2026-10/h.mp4'], medidas: { '2026-10/h.mp4': { ancho: 9, alto: 16, duracion: 90 } } }));
  assert.match(hv.errores.join(' '), /60 s/);
  const largo = rev(pieza({ formato: 'reel', medios: ['2026-10/r.mp4'], medidas: { '2026-10/r.mp4': { duracion: 1200 } } }));
  assert.match(largo.errores.join(' '), /15 minutos/);
  const corto = rev(pieza({ formato: 'reel', medios: ['2026-10/r.mp4'], medidas: { '2026-10/r.mp4': { duracion: 2 } } }));
  assert.match(corto.errores.join(' '), /al menos 3 segundos/);
  assert.equal(rev(pieza({ formato: 'reel', medios: ['2026-10/r.mp4'], medidas: { '2026-10/r.mp4': { duracion: 30 } } })).errores.length, 0);
});

test('el aviso del JPEG dice la verdad: hoy hay que convertirla, la oficina no lo hace sola', () => {
  const r = rev(pieza({ medios: ['2026-10/a.png'] }));
  assert.match(r.avisos.join(' '), /todavía no lo hace sola/); assert.doesNotMatch(r.avisos.join(' '), /se convierten al programar/);
});

test('medidaDeItem lee el registro del Estudio: ancho y alto de una imagen, proporción y duración de un video', () => {
  assert.deepEqual(medidaDeItem({ w: 1080, h: 1350 }), { ancho: 1080, alto: 1350 });
  assert.deepEqual(medidaDeItem({ kind: 'video', settings: { aspectRatio: '9:16', duration: 8 } }), { ancho: 9, alto: 16, duracion: 8 });
  assert.deepEqual(medidaDeItem({ duration: '5' }), { duracion: 5 });
  assert.equal(medidaDeItem({}), null); assert.equal(medidaDeItem(null), null);
});

test('revisarMomento: sin hora no, lo pasado no, con menos de 10 min no; más de 75 días avisa', () => {
  const ahora = new Date('2026-10-01T10:00:00').getTime();
  assert.match(revisarMomento('2026-10-02', '', ahora).errores[0], /hora/);
  assert.match(revisarMomento('2026-09-30', '09:00', ahora).errores[0], /ya pasó/);
  assert.match(revisarMomento('2026-10-01', '10:05', ahora).errores[0], /10 minutos/);
  assert.deepEqual(revisarMomento('2026-10-02', '09:00', ahora).errores, []);
  assert.match(revisarMomento('2027-01-30', '09:00', ahora).avisos[0], new RegExp(String(PROGRAMAR.maxDias)));
  assert.match(revisarMomento('', '', ahora).errores[0], /día/);
});

test('el almacén pone a cada pieza las medidas del registro .json del Estudio, y aprobar las usa', () => {
  const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-medidas-')), media = path.join(brain, 'media', '2026-10');
  fs.mkdirSync(media, { recursive: true });
  fs.writeFileSync(path.join(media, 'alta.png'), 'x'); fs.writeFileSync(path.join(media, 'alta.json'), JSON.stringify({ file: '2026-10/alta.png', w: 1080, h: 1920 }));
  fs.writeFileSync(path.join(media, 'cuadrada.jpg'), 'x'); fs.writeFileSync(path.join(media, 'cuadrada.json'), JSON.stringify({ file: '2026-10/cuadrada.jpg', w: 1080, h: 1080 }));
  assert.deepEqual(medidaDelEstudio(path.join(brain, 'media'))('2026-10/alta.png'), { ancho: 1080, alto: 1920 });
  assert.equal(medidaDelEstudio(path.join(brain, 'media'))('../../etc/passwd'), null, 'nunca fuera del Estudio');
  let reloj = new Date('2026-10-01T10:00:00').getTime();
  const a = crearAlmacen({ dir: path.join(brain, 'contenido'), ahora: () => (reloj += 1000) });
  const p = a.crear({ fecha: '2026-10-05', hora: '09:00', texto: 'x', medios: ['2026-10/alta.png'] }).pieza;
  assert.deepEqual(p.medidas, { '2026-10/alta.png': { ancho: 1080, alto: 1920 } });
  assert.match(a.aprobar(p.id).error, /4:5/, 'el servidor tampoco la deja salir al feed');
  a.guardar(p.id, { medios: ['2026-10/cuadrada.jpg'] });
  assert.equal(a.aprobar(p.id).pieza.estado, 'aprobada');
  assert.ok(!fs.readFileSync(path.join(brain, 'contenido', '2026-10', `${p.id}.md`), 'utf8').includes('medidas'), 'las medidas no se escriben en la nota');
});

test('aprobar en el almacén exige hora y un momento que venga', () => {
  let reloj = new Date('2026-10-01T10:00:00').getTime();
  const a = crearAlmacen({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'ao-momento-')), ahora: () => (reloj += 1000) });
  const sinHora = a.crear({ fecha: '2026-10-05', texto: 'x', medios: ['2026-10/a.jpg'] }).pieza;
  assert.match(a.aprobar(sinHora.id).error, /ponle una hora/);
  const pasada = a.crear({ fecha: '2026-09-29', hora: '09:00', texto: 'x', medios: ['2026-10/a.jpg'] }).pieza;
  assert.match(a.aprobar(pasada.id).error, /ya pasó/);
});
