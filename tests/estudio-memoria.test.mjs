// V4.9 — el rastro del Estudio en el Cerebro y en la memoria. Run: npm test
// Un trabajo real (no «prueba») de Dimitri o de un agente, o una edición, deja su nota en <cerebro>/Agents Office/estudio/AAAA-MM/
// (que no viaja por GitHub); un archivo usado o con ⭐ enseña r = 1 a las notas que se leyeron para hacerlo, y uno tirado sin usar r = 0,
// una sola vez por trabajo (un lote con algo usado no castiga; recuperar de la papelera deshace el r = 0). Los agentes buscan en la galería por carpeta (estudio-mcp, contra una oficina de mentira).
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as media from '../media.mjs';
import * as memory from '../memory.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const KEYS = ['HF_KEY', 'HF_API_KEY', 'HF_API_SECRET', 'GEMINI_API_KEY', 'XAI_API_KEY', 'OPENAI_API_KEY', 'META_API_KEY', 'MODEL_API_KEY', 'FAL_KEY', 'AO_GEMINI_BASE', 'AO_META_BASE'];
async function withEnv(set, fn) {
  const keep = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k]; Object.assign(process.env, set);
  try { return await fn(); } finally { for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}
const png = (() => { const b = Buffer.alloc(64); Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(1080, 16); b.writeUInt32BE(1350, 20); return b; })();
async function google() { // a stand-in for Google that always answers one picture
  const srv = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] })); }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}
const fresh = () => { const brain = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-trail-')); media.configure({}, brain, path.join(brain, 'data')); return brain; };
const notesIn = brain => { const d = path.join(brain, 'Agents Office', 'estudio'); return fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).filter(f => String(f).endsWith('.md')).map(f => path.join(d, String(f))) : []; };

test('un creativo real de Dimitri deja su nota (front matter, prompt, archivos, notas leídas) y la ficha la nombra; una sola vez', async () => {
  const g = await google();
  try {
    await withEnv({ GEMINI_API_KEY: 'prueba-google', AO_GEMINI_BASE: g.base }, async () => {
      const brain = fresh(); const f = media.addFolder('Lanzamiento');
      const j = media.submit({ model: 'nano-banana-2', prompt: 'Taza "PanaClaw" en la playa: atardecer', by: 'dimitri', sub: { msg: 'm1', i: 0 }, purpose: 'post del lunes', read: ['00-Empresa/oferta', 'voice'], folder: f.id });
      const done = await media.wait(j.id, 10000); assert.equal(done.state, 'done', done.error);
      const when = new Date(2026, 8, 30, 14, 5, 9);
      const name = media.writeStudioNote(done, when);
      assert.match(name, /^2026-09-30 taza-panaclaw-en-la-playa-atardecer 140509$/);
      const file = path.join(brain, 'Agents Office', 'estudio', '2026-09', name + '.md');
      const txt = fs.readFileSync(file, 'utf8');
      assert.match(txt, /^---\nkind: creativo\nmodel: "nano-banana-2"\nby: dimitri\n/);
      assert.match(txt, /\nfolder: "Lanzamiento"\npurpose: "post del lunes"\nfiles:\n  - ".+\.png"\n/);
      assert.match(txt, /## Prompt\nTaza "PanaClaw" en la playa: atardecer\n/);
      assert.match(txt, new RegExp(`!\\[\\]\\(/media/${done.items[0].split('/').map(encodeURIComponent).join('/').replace(/[.]/g, '\\.')}\\)`));
      assert.match(txt, /Read: \[\[00-Empresa\/oferta\]\] · \[\[voice\]\]/);
      assert.equal(media.item(done.items[0]).note, name);
      assert.equal(media.writeStudioNote(done, new Date(2026, 8, 30, 15, 0, 0)), name, 'the same job writes no second note');
      assert.equal(notesIn(brain).length, 1);
    });
  } finally { g.srv.close(); }
});

test('una edición del dueño deja nota con su original; lo hecho con «prueba» o por el dueño sin editar, no', async () => {
  const g = await google();
  try {
    await withEnv({ GEMINI_API_KEY: 'prueba-google', AO_GEMINI_BASE: g.base }, async () => {
      const brain = fresh();
      const orig = media.upload({ name: 'producto.png', data: 'data:image/png;base64,' + png.toString('base64') });
      const ed = await media.wait(media.submit(media.editRequest({ file: orig.file, instruction: 'más luz' })).id, 10000);
      const n = media.writeStudioNote(ed); assert.ok(n);
      const txt = fs.readFileSync(notesIn(brain)[0], 'utf8');
      assert.match(txt, /\nby: you\n/); assert.match(txt, new RegExp(`versionOf: "${orig.file}"`)); assert.match(txt, /## Original\n!\[\]\(/); assert.doesNotMatch(txt, /Read:/);

      const mine = await media.wait(media.submit({ model: 'nano-banana-2', prompt: 'algo mío' }).id, 10000);
      assert.equal(media.needsNote(mine), false); assert.equal(media.writeStudioNote(mine), null);
      const fake = await media.wait(media.submit({ model: 'prueba', prompt: 'tarjeta', by: 'dimitri' }).id, 10000);
      assert.equal(media.needsNote(fake), false); assert.equal(media.writeStudioNote(fake), null);
      const agent = await media.wait(media.submit({ model: 'nano-banana-2', prompt: 'portada', by: 'agent', agent: 'newt', task: 't9' }).id, 10000);
      const na = media.writeStudioNote(agent); assert.ok(na);
      const ta = fs.readFileSync(notesIn(brain).find(p => p.includes('portada')), 'utf8');
      assert.match(ta, /\nby: agent\nagent: "newt"\ntask: "t9"\n/);
      assert.equal(notesIn(brain).length, 2);
    });
  } finally { g.srv.close(); }
});

test('usar o marcar ⭐ enseña r = 1 a las notas leídas, una vez por trabajo y sin inventar sinapsis entre ellas', async () => {
  fresh();
  const read = ['voice', '00-Empresa/oferta', '10-Business/precios'];
  const done = await media.wait(media.submit({ model: 'prueba', prompt: 'x', n: 2, by: 'dimitri', read }).id, 10000);
  const [a, b] = done.items;
  assert.deepEqual(media.learnArgs(a, 1), { id: 'm:' + done.id, r: 1, cited: read, read, pairs: false });
  assert.equal(media.learnArgs(b, 1).id, 'm:' + done.id, 'the two files of one job are one verdict');
  const sinNotas = await media.wait(media.submit({ model: 'prueba', prompt: 'y' }).id, 10000);
  assert.equal(media.learnArgs(sinNotas.items[0], 1), null, 'nothing read, nothing to learn');

  const mem = memory.emptyMemory(), now = Date.now();
  memory.reinforce(mem, media.learnArgs(a, 1), now);
  const once = JSON.stringify(mem.notes);
  memory.reinforce(mem, media.learnArgs(b, 1), now);
  assert.equal(JSON.stringify(mem.notes), once, 'the same job teaches once');
  assert.ok(mem.notes.voice.w > 0.5);
  assert.deepEqual(mem.edges, {}, 'read is not cited together: no learned link between every pair');

  assert.equal(media.wasUsed(media.item(b)), false);
  assert.deepEqual(media.markUsed(b, 'ref').used, ['ref']); assert.deepEqual(media.markUsed(b, 'ref').used, ['ref']);
  assert.equal(media.markUsed(b, 'otra'), null); assert.equal(media.wasUsed(media.item(b)), true);
  assert.equal(media.wasUsed({ fav: true }), true);
});

test('un lote mixto (⭐ uno, tirar los otros) no castiga las notas; r = 0 solo cuando se tiran todos sin usar', async () => {
  fresh();
  const read = ['voice', '00-Empresa/oferta'], now = Date.now();
  // Dimitri's lot of 4: the owner ⭐ one and throws the other three away
  const lot = await media.wait(media.submit({ model: 'prueba', prompt: 'lote', n: 4, by: 'dimitri', read }).id, 10000);
  const [keep, ...rest] = lot.items, mem = memory.emptyMemory();
  media.update(keep, { fav: true }); memory.reinforce(mem, media.learnArgs(keep, 1), now); const good = mem.notes.voice.w;
  for (const f of rest) { const a = media.learnArgs(f, 0); assert.equal(a, null, 'a file of the lot is still in the gallery: no verdict'); media.trash(f); }
  assert.equal(mem.notes.voice.w, good); assert.ok(good > 0.5);

  // a lot thrown away whole, file by file: only the last one teaches r = 0
  const bad = await media.wait(media.submit({ model: 'prueba', prompt: 'malo', n: 3, by: 'dimitri', read }).id, 10000), m2 = memory.emptyMemory();
  const [x, y, z] = bad.items;
  assert.equal(media.learnArgs(x, 0), null); media.trash(x);
  assert.equal(media.learnArgs(y, 0), null); const ty = media.trash(y);
  const last = media.learnArgs(z, 0); assert.equal(last.r, 0); assert.equal(last.id, 'm:' + bad.id);
  memory.reinforce(m2, last, now); const w0 = m2.notes.voice.w; assert.ok(w0 < 0.5);
  memory.reinforce(m2, media.learnArgs(z, 0), now); assert.equal(m2.notes.voice.w, w0, 'r = 0 also once');
  const tz = media.trash(z);

  // «Recuperar» (or DESHACER) takes the verdict back: as if it had never been judged
  assert.ok(media.restore(tz)); assert.equal(media.learnId(media.item(z)), 'm:' + bad.id);
  assert.equal(memory.forget(m2, media.learnId(media.item(z))), true);
  assert.equal(m2.notes.voice.w, 0.5); assert.equal(m2.applied['m:' + bad.id], undefined);
  assert.equal(memory.forget(m2, 'm:' + bad.id), false, 'nothing left to forget');
  assert.ok(media.restore(ty)); assert.equal(media.learnArgs(z, 0), null, 'back in the gallery: no verdict while another file of the lot is there');
});

test('una tarea solo ve como referencia lo que se le mandó (task.refs), nunca lo que ella misma generó (task.media)', () => {
  assert.equal(media.refsLine({ media: ['2026-09/salida.png'] }), '', 'its own output is not an input on a revise');
  assert.equal(media.refsLine({}), ''); assert.equal(media.refsLine(null), '');
  const l = media.refsLine({ refs: ['2026-09/producto.png'], media: ['2026-09/salida.png'] });
  assert.match(l, /^\nImágenes de la galería para esta tarea: 2026-09\/producto\.png \(ids del Estudio/); assert.doesNotMatch(l, /salida/);
  const src = fs.readFileSync(path.join(ROOT, 'serve.mjs'), 'utf8');
  assert.match(src, /'\/api\/media\/to-dept'[\s\S]{0,900}extra: \{ refs: \[file\] \}/, 'to-dept hands the file in as refs');
  assert.doesNotMatch(src, /task\.media\?\.length \? `\nImágenes/, 'run() no longer reads task.media as references');
});

test('las notas del Estudio no viajan por GitHub (cerebro del equipo y cerebro local)', () => {
  const ignored = f => spawnSync('git', ['check-ignore', '-q', f], { cwd: ROOT }).status === 0;
  for (const f of ['brain-panaclaw/Agents Office/estudio/2026-09/2026-09-30 taza 140509.md', 'brain/Agents Office/estudio/2026-09/2026-09-30 taza 140509.md', 'brain-panaclaw/Agents Office/media/folders.json'])
    assert.ok(ignored(f), `${f} debería estar ignorado por git`);
});

test('buscar_en_galeria filtra por carpeta (sin mayúsculas ni acentos) y dice la carpeta de cada resultado', async () => {
  const items = [{ file: '2026-09/a.png', kind: 'image', prompt: 'taza roja', folder: 'f1' }, { file: '2026-09/b.png', kind: 'image', prompt: 'taza azul', folder: 'f2' }, { file: '2026-09/c.png', kind: 'image', prompt: 'logo', upload: true }];
  const folders = [{ id: 'f1', name: 'Campaña Otoño', n: 1 }, { id: 'f2', name: 'Producto', n: 1 }];
  const srv = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(req.url.startsWith('/api/media/models') ? { models: [], engines: [], default: {} } : { items, folders })); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const p = spawn(process.execPath, [path.join(ROOT, 'estudio-mcp.mjs')], { env: { ...process.env, AO_OFFICE: `http://127.0.0.1:${srv.address().port}` } });
  let out = ''; const waiting = new Map();
  p.stdout.on('data', d => { out += d; let i; while ((i = out.indexOf('\n')) >= 0) { const m = JSON.parse(out.slice(0, i)); out = out.slice(i + 1); waiting.get(m.id)?.(m); } });
  let n = 0; const ask = (method, params) => new Promise(r => { const id = ++n; waiting.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  const call = async a => (await ask('tools/call', { name: 'buscar_en_galeria', arguments: a })).result.content[0].text;
  try {
    const list = (await ask('tools/list')).result.tools.find(t => t.name === 'buscar_en_galeria');
    assert.ok(list.inputSchema.properties.carpeta);
    const otono = await call({ carpeta: 'campana otono' });
    assert.match(otono, /^2026-09\/a\.png · imagen · carpeta «Campaña Otoño» · «taza roja»$/);
    assert.equal(await call({ carpeta: 'PRODUCTO', buscar: 'roja' }), 'Nada en la galería con eso en la carpeta «Producto».');
    assert.match(await call({ carpeta: 'no existe' }), /No hay una carpeta «no existe».*Campaña Otoño \(1\), Producto \(1\)/);
    for (const c of ['—', '¡¡', '#']) assert.match(await call({ carpeta: c }), /^No hay una carpeta .*Campaña Otoño \(1\), Producto \(1\)/, `«${c}» has no letters: it is no folder, not the first one`);
    assert.match(await call({ carpeta: 'o' }), /^No hay una carpeta «o»/, 'one letter is too little to guess a folder');
    const all = await call({});
    assert.equal(all.split('\n').length, 3); assert.match(all, /c\.png · imagen · subida por el dueño · «logo»/);
  } finally { p.kill(); srv.close(); }
});
