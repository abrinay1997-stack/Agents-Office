// IMG-09 · IMG-48 (auditoría del Estudio de imagen, 6 oct 2026): una sola lista de acciones para tarjeta, menú, pedido y visor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { acciones, tipoDe } from '../src/studio-acciones.js';

const ids = l => l.map(x => x.id);
const todo = { calendario: true, dimitri: true, tarea: true, preset: true, precioVariar: '~US$0.07/imagen' };

test('una imagen: Editar, Variar y Descargar a la vista; lo demás por grupos y la papelera aparte', () => {
  const a = acciones({ file: 'a.png', prompt: 'taza', kind: 'image' }, todo);
  assert.equal(a.tipo, 'img');
  assert.deepEqual(ids(a.primarias), ['edit', 'vary', 'dl']);
  assert.deepEqual(a.grupos.map(g => g.titulo), ['Crear a partir de esta', 'Organizar', 'Enviar a…']);
  assert.deepEqual(ids(a.grupos[0].items), ['ref', 'anim', 'again']);
  assert.deepEqual(ids(a.grupos[1].items), ['fav', 'move', 'preset', 'task']);
  assert.deepEqual(ids(a.grupos[2].items), ['cal', 'dimitri', 'dept'], 'la oficina, aparte de lo que se hace con la imagen');
  assert.equal(a.borrar.id, 'del');
  assert.match(a.primarias[1].title, /US\$0\.07/, 'Variar dice su precio');
});

test('ninguna acción sale dos veces en la misma lista', () => {
  for (const it of [{ file: 'a.png' }, { file: 'v.mp4', kind: 'video' }, { file: 'x.mp3', kind: 'audio' }, { file: 'u.png', upload: true }]) {
    const a = acciones(it, { ...todo, voz: true }); const l = [...ids(a.primarias), ...a.grupos.flatMap(g => ids(g.items)), a.borrar.id];
    assert.equal(new Set(l).size, l.length, `${it.file}: ${l}`);
  }
});

test('una subida no se repite; un video se repite y se descarga; un audio no va al calendario', () => {
  assert.ok(!ids(acciones({ file: 'u.png', upload: true }, todo).grupos[0].items).includes('again'));
  assert.deepEqual(ids(acciones({ file: 'v.mp4', kind: 'video' }, todo).primarias), ['again', 'dl']);
  assert.deepEqual(ids(acciones({ file: 'v.mp4', kind: 'video', upload: true }, todo).primarias), ['dl']);
  const aud = acciones({ file: 'x.mp3', kind: 'audio' }, { ...todo, voz: true });
  assert.deepEqual(ids(aud.primarias), ['othervoice', 'dl']);
  assert.ok(!aud.grupos.flatMap(g => ids(g.items)).includes('cal'));
});

test('lo que la oficina no tiene no aparece, y la favorita cambia su nombre', () => {
  const a = acciones({ file: 'a.png', fav: true }, {});
  assert.deepEqual(ids(a.grupos.find(g => g.id === 'enviar').items), ['dept']);
  assert.deepEqual(ids(a.grupos.find(g => g.id === 'organizar').items), ['fav', 'move']);
  assert.equal(a.grupos.find(g => g.id === 'organizar').items[0].label, 'Quitar de favoritas');
  assert.equal(tipoDe({ file: 'b.webm' }), 'vid'); assert.equal(tipoDe(null), 'img');
});

test('la fila de la tarjeta lleva a la vista Usar de referencia, Descargar y la papelera (pedido del dueño, 6 oct 2026)', () => {
  assert.deepEqual(ids(acciones({ file: 'a.png' }, todo).fila), ['edit', 'vary', 'ref', 'dl', 'del']);
  assert.deepEqual(acciones({ file: 'a.png' }, todo).fila.filter(x => x.icono).map(x => x.id), ['ref', 'dl', 'del'], 'las tres como iconos: caben');
  assert.deepEqual(ids(acciones({ file: 'v.mp4', kind: 'video' }, todo).fila), ['again', 'dl', 'del'], 'un video no se usa de referencia');
  assert.deepEqual(ids(acciones({ file: 'x.mp3', kind: 'audio' }, todo).fila), ['again', 'dl', 'del']);
});
