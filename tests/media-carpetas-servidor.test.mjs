// Fase 1.a (29 oct 2026): las rutas de las carpetas en árbol contra el serve.mjs REAL (carpeta temporal), con estudio.carpetasArbol encendido en
// office.config.local.json y también apagado (las rutas de siempre no cambian). Sin Claude ni keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAADklEQVR4nGNgYGD4z4ADAAMFAAHiJVjLAAAAAElFTkSuQmCC';
async function oficina(t, arbol) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-carp-')), brain = path.join(dir, 'brain'); fs.mkdirSync(path.join(brain, '20-Brand'), { recursive: true });
  fs.writeFileSync(path.join(brain, '20-Brand', 'voice.md'), '# Voz\nCercana y directa.\n');
  const local = path.join(dir, 'office.config.local.json'); fs.writeFileSync(local, JSON.stringify(arbol ? { estudio: { carpetasArbol: true } } : {}));
  const probe = http.createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: local, CLAUDE_BIN: path.join(dir, 'no-claude.exe'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', MINIMAX_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const call = async (p, b, method = b ? 'POST' : 'GET') => { const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, j: await r.json().catch(() => null) }; };
  if ((await call('/api/health').catch(() => ({ status: 0 }))).status !== 200) throw new Error('la oficina no arrancó: ' + log.split('\n').slice(-6).join(' | '));
  return { call };
}

test('flag apagado: las rutas de siempre (nombre único global, borrar deja los archivos sin carpeta)', async t => {
  const { call } = await oficina(t, false);
  const a = (await call('/api/media/folders', { name: 'A' })).j.folder; assert.equal(a.parentId, undefined);
  assert.equal((await call('/api/media/folders', { name: 'a' })).status, 400);
  const u = (await call('/api/media/upload', { name: 'x', data: PNG, folder: a.id })).j.item;
  assert.equal((await call('/api/media/folders/' + a.id, null, 'DELETE')).j.freed, 1);
  assert.equal((await call('/api/media?folder=none')).j.items[0].file, u.file);
});

test('flag encendido: árbol, mover, ciclo 422, borrar con segundo toque y DESHACER', async t => {
  const { call } = await oficina(t, true);
  const A = (await call('/api/media/folders', { name: 'A' })).j.folder, B = (await call('/api/media/folders', { name: 'B', parentId: A.id })).j.folder, C = (await call('/api/media/folders', { name: 'C' })).j.folder;
  const f1 = (await call('/api/media/upload', { name: 'x', data: PNG, folder: B.id })).j.item;
  const arbol = (await call('/api/media/folders')).j.folders; assert.deepEqual([arbol.find(x => x.id === A.id).nTotal, arbol.find(x => x.id === B.id).ruta], [1, 'A / B']);
  assert.equal((await call('/api/media?folder=' + A.id)).j.total, 1, 'el filtro es recursivo');
  const ciclo = await call('/api/media/folders/' + A.id, { parentId: B.id }, 'PATCH'); assert.equal(ciclo.status, 422); assert.equal(ciclo.j.codigo, 'ciclo');
  assert.equal((await call('/api/media/folders/' + B.id, { parentId: C.id }, 'PATCH')).j.folder.ruta, 'C / B');
  const p = await call('/api/media/folders/' + C.id, null, 'DELETE'); assert.equal(p.status, 409); assert.deepEqual(p.j.confirmar, { archivos: 1, subcarpetas: 1 });
  assert.equal((await call('/api/media?folder=' + B.id)).j.total, 1, 'sin confirmar no se tocó nada');
  const ok = await call('/api/media/folders/' + C.id, { confirmar: p.j.confirmar }, 'DELETE'); assert.equal(ok.status, 200); assert.equal(ok.j.archivos, 1);
  assert.equal((await call('/api/media?folder=all')).j.total, 0);
  const u = await call('/api/media/folders/deshacer', { token: ok.j.deshacer.token }); assert.deepEqual([u.status, u.j.carpetas, u.j.archivos], [200, 2, 1]);
  assert.equal((await call('/api/media?folder=' + C.id)).j.items[0].file, f1.file);
});
