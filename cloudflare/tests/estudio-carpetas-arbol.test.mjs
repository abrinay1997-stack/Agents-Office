// Fase 1.a (29 oct 2026): carpetas en árbol en el Estudio de la NUBE (rutas reales, D1 y R2 de mentira), detrás de estudio.config → carpetasArbol.
import test from 'node:test';
import assert from 'node:assert/strict';
import { manejar } from '../worker/lib/rutas.js';
import { SALTAR, crearD1, sembrar, envDePrueba, pedir } from './d1-memoria.mjs';
import { crearR2 } from './r2-memoria.mjs';

const png = (n) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 4, 0, 0, 0, 2, 0]), Buffer.alloc(30, n)]);
const dataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

async function montar(rol = 'admin', arbol = true) {
  const d1 = crearD1(), admin = await sembrar(d1, { rol: 'admin' }), R2 = crearR2(), env = { ...envDePrueba(d1), MEDIA: R2 };
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: admin.email, contrasena: admin.clave } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const api = async (ruta, o = {}) => { const res = await pedir(manejar, env, ruta, { ...o, cookie }); const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { /* */ } return { status: res.status, j }; };
  if (arbol) assert.equal((await api('/api/media/limites', { metodo: 'PUT', cuerpo: { carpetasArbol: true } })).status, 200);
  return { d1, env, api };
}
const sube = async (api, n, folder) => (await api('/api/media/upload', { metodo: 'POST', cuerpo: { name: n + '.png', data: dataUrl(png(n.length + n.charCodeAt(0))), ...(folder ? { folder } : {}) } })).j.item;
const mk = async (api, name, parentId) => (await api('/api/media/folders', { metodo: 'POST', cuerpo: { name, ...(parentId ? { parentId } : {}) } })).j.folder;

test('con el flag apagado: nada nuevo (sin parentId, borrar deja los archivos sin carpeta)', { skip: SALTAR }, async () => {
  const { api } = await montar('admin', false);
  const A = await mk(api, 'A'); assert.equal(A.parentId, undefined);
  const f = await sube(api, 'x', A.id);
  assert.equal((await api('/api/media/folders', { metodo: 'POST', cuerpo: { name: 'a' } })).status, 400);
  assert.equal((await api('/api/media/folders/' + A.id, { metodo: 'DELETE' })).j.freed, 1);
  assert.equal((await api('/api/media?folder=none')).j.total, 1); assert.ok(f);
  assert.equal((await api('/api/media/folders/reorder', { metodo: 'PATCH', cuerpo: { ids: [] } })).status === 200, false);
});

test('crear A/B/C, árbol con conteo recursivo, filtro recursivo, mover, ciclo 422 y reordenar', { skip: SALTAR }, async () => {
  const { api } = await montar();
  const A = await mk(api, 'A'), B = await mk(api, 'B', A.id), C = await mk(api, 'C', B.id), O = await mk(api, 'Otra');
  assert.equal((await api('/api/media/folders', { metodo: 'POST', cuerpo: { name: 'b', parentId: A.id } })).status, 400);
  const u1 = await sube(api, 'uno', A.id), u2 = await sube(api, 'dos', C.id);
  const arbol = (await api('/api/media/folders')).j.folders, por = Object.fromEntries(arbol.map((x) => [x.id, x]));
  assert.deepEqual([por[A.id].n, por[A.id].nTotal, por[C.id].ruta, por[B.id].nTotal], [1, 2, 'A / B / C', 1]);
  assert.equal((await api('/api/media?folder=' + A.id)).j.total, 2);
  assert.equal((await api('/api/media?folder=' + C.id)).j.total, 1);
  const x = await api('/api/media/folders/' + A.id, { metodo: 'PATCH', cuerpo: { parentId: C.id } });
  assert.equal(x.status, 422); assert.equal(x.j.codigo, 'ciclo');
  const m = await api('/api/media/folders/' + C.id, { metodo: 'PATCH', cuerpo: { parentId: O.id } });
  assert.equal(m.status, 200); assert.equal(m.j.folders.find((f) => f.id === C.id).ruta, 'Otra / C');
  assert.equal((await api('/api/media?folder=' + O.id)).j.total, 1);
  assert.equal(u1.folder, A.id); assert.ok(u2);
  const r = await api('/api/media/folders/reorder', { metodo: 'PATCH', cuerpo: { parentId: null, ids: [O.id, A.id] } });
  assert.deepEqual(r.j.folders.filter((f) => f.parentId === null).map((f) => f.id), [O.id, A.id]);
  assert.equal((await api('/api/media/folders/' + O.id, { metodo: 'PATCH', cuerpo: { orden: 1 } })).j.folders.filter((f) => !f.parentId).map((f) => f.id)[1], O.id);
  assert.equal((await api('/api/media/folders', { metodo: 'POST', cuerpo: { name: 'Huérfana', parentId: 'cnoexiste' } })).j.folder.parentId, null);
});

test('borrar: sin confirmar solo cuenta; con confirmar todo va a la papelera; DESHACER lo devuelve; solo un administrador', { skip: SALTAR }, async () => {
  const { api, d1 } = await montar();
  const A = await mk(api, 'Campaña mayo'), B = await mk(api, 'B', A.id), K = await mk(api, 'Otra');
  const f1 = await sube(api, 'a1', A.id), f2 = await sube(api, 'b1', B.id), g = await sube(api, 'otra', K.id);
  const p = await api('/api/media/folders/' + A.id, { metodo: 'DELETE' });
  assert.equal(p.status, 409); assert.equal(p.j.error, 'confirmar'); assert.deepEqual(p.j.confirmar, { archivos: 2, subcarpetas: 1 }); assert.match(p.j.texto, /«Campaña mayo» con 1 subcarpeta y 2 archivos/);
  assert.equal((await api('/api/media')).j.total, 3, 'no tocó nada');
  const d = await api('/api/media/folders/' + A.id, { metodo: 'DELETE', cuerpo: { confirmar: { archivos: 1, subcarpetas: 1 } } });
  assert.equal(d.status, 409); assert.equal(d.j.error, 'desfase');
  const ok = await api('/api/media/folders/' + A.id, { metodo: 'DELETE', cuerpo: { confirmar: p.j.confirmar } });
  assert.equal(ok.status, 200); assert.deepEqual([ok.j.carpetas, ok.j.archivos], [2, 2]); assert.deepEqual(ok.j.folders.map((f) => f.id), [K.id]);
  assert.deepEqual((await api('/api/media')).j.items.map((i) => i.file), [g.file]);
  assert.equal((await api('/api/media/trash')).j.items?.length ?? (await api('/api/media/trash')).j.length, 2);
  const u = await api('/api/media/folders/deshacer', { metodo: 'POST', cuerpo: { token: ok.j.deshacer.token } });
  assert.deepEqual([u.status, u.j.carpetas, u.j.archivos], [200, 2, 2]);
  const por = Object.fromEntries(u.j.folders.map((f) => [f.id, f]));
  assert.equal(por[B.id].parentId, A.id); assert.equal(por[A.id].nTotal, 2);
  assert.equal((await api('/api/media?folder=' + B.id)).j.items[0].file, f2.file); assert.ok(f1);
  assert.equal((await api('/api/media/folders/deshacer', { metodo: 'POST', cuerpo: { token: ok.j.deshacer.token } })).status, 410);
  assert.equal((await api('/api/media/folders/' + 'cnoexiste1', { metodo: 'DELETE' })).status, 404);
});

test('una pieza de Contenido que usa un archivo detiene el borrado; «dejar» lo deja en Sin carpeta', { skip: SALTAR }, async () => {
  const { api, d1 } = await montar();
  const A = await mk(api, 'A'), usado = await sube(api, 'usado', A.id), libre = await sube(api, 'libre', A.id);
  await d1.prepare("insert into contenido_piezas (id, json, borrada, creada, actualizada) values (?,?,0,'x','x')").bind('p1', JSON.stringify({ titulo: 'Post', medios: [usado.file] })).run();
  const c = { archivos: 2, subcarpetas: 0 };
  const r = await api('/api/media/folders/' + A.id, { metodo: 'DELETE', cuerpo: { confirmar: c } });
  assert.equal(r.status, 409); assert.equal(r.j.error, 'en-uso'); assert.equal(r.j.usadas[0].file, usado.file); assert.equal(r.j.usadas[0].piezas[0].titulo, 'Post');
  assert.equal((await api('/api/media')).j.total, 2);
  const d = await api('/api/media/folders/' + A.id, { metodo: 'DELETE', cuerpo: { confirmar: c, dejar: true } });
  assert.deepEqual([d.status, d.j.archivos, d.j.dejadas], [200, 1, 1]);
  assert.deepEqual((await api('/api/media?folder=none')).j.items.map((i) => i.file), [usado.file]); assert.ok(libre);
});

test('más de 90 archivos en una carpeta: el borrado y el deshacer van por lotes y cuadran', { skip: SALTAR }, async () => {
  const { api, d1, env } = await montar();
  const A = await mk(api, 'Grande');
  for (let i = 0; i < 95; i++) await d1.prepare(`insert into estudio_archivos (file, at, kind, json, papelera_at) values (?,?,?,?,null)`).bind(`2026-10/g${String(i).padStart(3, '0')}.png`, 1000 + i, 'image', JSON.stringify({ id: `2026-10/g${i}.png`, file: `2026-10/g${String(i).padStart(3, '0')}.png`, kind: 'image', at: 1000 + i, folder: A.id })).run();
  const p = await api('/api/media/folders/' + A.id, { metodo: 'DELETE' }); assert.equal(p.j.confirmar.archivos, 95);
  const ok = await api('/api/media/folders/' + A.id, { metodo: 'DELETE', cuerpo: { confirmar: p.j.confirmar } });
  assert.equal(ok.j.archivos, 95); assert.equal((await api('/api/media')).j.total, 0);
  const u = await api('/api/media/folders/deshacer', { metodo: 'POST', cuerpo: { token: ok.j.deshacer.token } });
  assert.equal(u.j.archivos, 95); assert.equal((await api('/api/media?folder=' + A.id)).j.total, 95); assert.ok(env);
});

test('un editor no borra carpetas ni deshace', { skip: SALTAR }, async () => {
  const { d1, env } = await montar();
  const ed = await sembrar(d1, { rol: 'editor', email: 'ed@x.test' });
  const r = await pedir(manejar, env, '/api/acceso', { metodo: 'POST', cuerpo: { email: ed.email, contrasena: ed.clave } });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const res = await pedir(manejar, env, '/api/media/folders/cabcdef', { metodo: 'DELETE', cookie });
  assert.equal(res.status, 403);
});
