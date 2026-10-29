// Fase 1.a (29 oct 2026): carpetas en árbol en la galería LOCAL (media/galeria.mjs), detrás de estudio.carpetasArbol. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as md from '../media.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAADklEQVR4nGNgYGD4z4ADAAMFAAHiJVjLAAAAAElFTkSuQmCC';
function box(arbol = true) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-arbol-')); md.configure({ media: {}, ...(arbol ? { estudio: { carpetasArbol: true } } : {}) }, dir, path.join(dir, 'data')); return dir; }
const sube = (n, folder) => md.upload({ name: n + '.png', data: PNG, folder });

test('con el flag apagado nada cambia: sin parentId, sin ruta, nombre único en TODA la galería', () => {
  const dir = box(false);
  try {
    assert.equal(md.arbolOn(), false);
    const a = md.addFolder('A', { parentId: 'cnada' }); assert.equal(a.parentId, undefined);
    assert.throws(() => md.addFolder('a'), /ya hay una carpeta/);
    assert.deepEqual(Object.keys(md.folders()[0]).sort(), ['at', 'id', 'n', 'name']);
    assert.throws(() => md.moveFolder(a.id, null), /apagadas/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(md.dir(), 'folders.json'), 'utf8')).v, undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('crear A/B/C, mover B, rechazar A dentro de C, nombres entre hermanos, conteo recursivo y filtro recursivo', () => {
  const dir = box();
  try {
    const A = md.addFolder('A'), B = md.addFolder('B', { parentId: A.id }), C = md.addFolder('C', { parentId: B.id }), R = md.addFolder('Otra');
    assert.equal(C.parentId, B.id);
    assert.throws(() => md.addFolder('b', { parentId: A.id }), /ya hay una carpeta/);
    assert.equal(md.addFolder('B', { parentId: R.id }).name, 'B', 'el mismo nombre en otro padre');
    const u1 = sube('uno', A.id), u2 = sube('dos', B.id), u3 = sube('tres', C.id);
    const por = () => Object.fromEntries(md.folders().map(f => [f.id, f]));
    assert.deepEqual([por()[A.id].n, por()[A.id].nTotal, por()[C.id].ruta], [1, 3, 'A / B / C']);
    assert.deepEqual(md.query({ folder: A.id }).items.map(i => i.file).sort(), [u1.file, u2.file, u3.file].sort());
    assert.equal(md.query({ folder: C.id }).total, 1);
    assert.throws(() => md.moveFolder(A.id, C.id), e => e.codigo === 'ciclo');
    assert.throws(() => md.moveFolder(B.id, R.id), /ya hay una carpeta/); // «Otra» ya tiene una B
    md.moveFolder(C.id, R.id);
    assert.equal(por()[C.id].ruta, 'Otra / C'); assert.equal(por()[A.id].nTotal, 2);
    assert.ok(md.resolve(u3.file), 'ningún archivo se movió en disco'); assert.equal(md.item(u3.file).folder, C.id);
    assert.throws(() => md.addFolder('otra'), /ya hay una carpeta/);
    // reordenar
    const X = md.addFolder('X'), Y = md.addFolder('Y');
    md.reorderFolders(null, [Y.id, X.id]);
    const raiz = md.folders().filter(f => f.parentId === null).map(f => f.id); assert.ok(raiz.indexOf(Y.id) < raiz.indexOf(X.id));
    assert.throws(() => md.reorderFolders(null, [C.id]), /no está en ese nivel/);
    // un padre que no existe = raíz
    assert.equal(md.addFolder('Huérfana', { parentId: 'cnoexiste' }).parentId, null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('borrar una carpeta: sin confirmar solo cuenta; con confirmar borra todo a la papelera; DESHACER lo devuelve todo con los mismos ids', () => {
  const dir = box();
  try {
    const A = md.addFolder('A'), B = md.addFolder('B', { parentId: A.id }), K = md.addFolder('Otra');
    const f1 = sube('a1', A.id), f2 = sube('b1', B.id), f3 = sube('b2', B.id), g = sube('otra', K.id);
    const p = md.removeFolderTree(A.id);
    assert.deepEqual([p.pendiente, p.confirmar], [true, { archivos: 3, subcarpetas: 1 }]); assert.match(p.texto, /1 subcarpeta y 3 archivos/);
    assert.equal(md.folders().length, 3, 'no tocó nada');
    assert.ok(md.removeFolderTree(A.id, { confirmar: { archivos: 2, subcarpetas: 1 } }).desfase);
    assert.ok(md.item(f1.file), 'sigue ahí');
    const r = md.removeFolderTree(A.id, { confirmar: p.confirmar });
    assert.deepEqual([r.ok, r.carpetas, r.archivos], [true, 2, 3]); assert.ok(r.deshacer.token);
    assert.deepEqual(md.folders().map(f => f.id), [K.id]); assert.equal(md.item(f1.file), null);
    assert.equal(md.trashList().length, 3, 'en la papelera 30 días');
    assert.ok(md.item(g.file), 'lo de otra carpeta no se toca');
    const u = md.undoFolderDelete(r.deshacer.token);
    assert.deepEqual([u.carpetas, u.archivos], [2, 3]);
    const por = Object.fromEntries(md.folders().map(f => [f.id, f]));
    assert.equal(por[B.id].parentId, A.id); assert.equal(por[A.id].nTotal, 3); assert.equal(md.item(f3.file).folder, B.id);
    assert.throws(() => md.undoFolderDelete(r.deshacer.token), /ya no se puede/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('un archivo usado por una pieza detiene el borrado sin tocar nada; con `dejar` queda en «Sin carpeta»', () => {
  const dir = box();
  try {
    const A = md.addFolder('A'), a = sube('usado', A.id), b = sube('libre', A.id);
    const usadas = f => (f === a.file ? [{ id: 'p1', titulo: 'Post' }] : []);
    const c = { archivos: 2, subcarpetas: 0 };
    const r = md.removeFolderTree(A.id, { confirmar: c, usadas });
    assert.ok(r.enUso); assert.equal(r.usadas[0].file, a.file); assert.ok(md.item(b.file)); assert.equal(md.folders().length, 1);
    const d = md.removeFolderTree(A.id, { confirmar: c, usadas, dejar: true });
    assert.deepEqual([d.archivos, d.dejadas], [1, 1]);
    assert.equal(md.item(a.file).folder, null); assert.equal(md.item(b.file), null); assert.equal(md.folders().length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('el tope pasa de 200 a 500 con el árbol; un folders.json viejo se lee como raíces', () => {
  const dir = box();
  try {
    fs.mkdirSync(md.dir(), { recursive: true });
    fs.writeFileSync(path.join(md.dir(), 'folders.json'), JSON.stringify({ folders: [{ id: 'caaaaa', name: 'Vieja', at: 1 }] }));
    assert.deepEqual(md.folders().map(f => [f.name, f.parentId, f.ruta]), [['Vieja', null, 'Vieja']]);
    for (let i = 0; i < 205; i++) md.addFolder('n' + i);
    assert.equal(md.folders().length, 206);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
