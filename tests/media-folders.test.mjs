// V4.6 — folders in the Estudio (media.mjs): labels in each file's record, never a move on disk. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as md from '../media.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAADklEQVR4nGNgYGD4z4ADAAMFAAHiJVjLAAAAAElFTkSuQmCC';
function box() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-folders-')); md.configure({ media: {} }, dir, path.join(dir, 'data')); return dir; }

test('a folder is made, named, renamed; two folders cannot share a name; an empty name is refused', () => {
  const dir = box();
  try {
    const a = md.addFolder('  Campaña   Navidad '); assert.equal(a.name, 'Campaña Navidad'); assert.match(a.id, /^c[a-z0-9]+$/);
    assert.throws(() => md.addFolder('campaña navidad'), /ya hay una carpeta/);
    assert.throws(() => md.addFolder('   '), /ponle un nombre/);
    const b = md.addFolder('Logos');
    assert.equal(md.renameFolder(b.id, 'Logos y marca').name, 'Logos y marca');
    assert.throws(() => md.renameFolder(b.id, 'CAMPAÑA NAVIDAD'), /ya hay una carpeta/);
    assert.throws(() => md.renameFolder('cnoexiste1', 'x'), /ya no existe/);
    assert.deepEqual(md.folders().map(f => [f.name, f.n]), [['Campaña Navidad', 0], ['Logos y marca', 0]]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('files move into a folder and out of it; the file itself stays where it was', () => {
  const dir = box();
  try {
    const up1 = md.upload({ name: 'producto.png', data: PNG }), up2 = md.upload({ name: 'logo.png', data: PNG });
    const f = md.addFolder('Producto');
    assert.equal(md.moveTo([up1.file, up2.file, 'no/existe.png'], f.id), 2);
    assert.equal(md.item(up1.file).folder, f.id); assert.ok(md.resolve(up1.file), 'the file did not move on disk');
    assert.equal(md.folders()[0].n, 2);
    assert.equal(md.moveTo([up2.file], null), 1); assert.equal(md.item(up2.file).folder, null);
    assert.throws(() => md.moveTo([up1.file], 'cnoexiste1'), /ya no existe/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an upload made inside a folder lands in it; a folder that does not exist is ignored', () => {
  const dir = box();
  try {
    const f = md.addFolder('Fotos del cliente');
    assert.equal(md.upload({ name: 'a.png', data: PNG, folder: f.id }).folder, f.id);
    assert.equal(md.upload({ name: 'b.png', data: PNG, folder: 'cnoexiste1' }).folder, undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('removing a folder keeps its files, now in no folder; the bin and back keep the folder', () => {
  const dir = box();
  try {
    const a = md.addFolder('Borrar'), b = md.addFolder('Guardar');
    const u1 = md.upload({ name: 'x.png', data: PNG, folder: a.id }), u2 = md.upload({ name: 'y.png', data: PNG, folder: b.id });
    assert.equal(md.removeFolder(a.id), 1);
    assert.equal(md.item(u1.file).folder, null); assert.ok(md.resolve(u1.file), 'the file is still there');
    assert.deepEqual(md.folders().map(f => f.name), ['Guardar']);
    const t = md.trash(u2.file); assert.ok(md.restore(t)); assert.equal(md.item(u2.file).folder, b.id);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
