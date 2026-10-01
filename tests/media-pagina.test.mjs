// Auditoría 1 oct 2026 (INF-03) — la galería sin tope: /api/media pagina por cursor sobre el índice ENTERO, busca y filtra
// en el servidor y cuenta pestañas y carpetas sobre el total. Antes, desde el archivo 601, lo más viejo desaparecía del
// Estudio, de Ctrl+K, del selector de Contenido y de los recuentos. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as md from '../media.mjs';
import * as GF from '../src/galeria-filtro.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function box() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-pagina-')); md.configure({ media: {} }, dir, path.join(dir, 'data')); return dir; }
/** n fichas escritas directo al disco, como una galería de meses: f0 la más vieja. Cada 7.ª es favorita, cada 5.ª de un agente, cada 11.ª un video, cada 13.ª subida. */
function seed(root, n, { folderOf = () => null, sameTime = false } = {}) {
  for (let i = 0; i < n; i++) {
    const sub = `2026-${String(1 + (i % 9)).padStart(2, '0')}`, d = path.join(root, sub); fs.mkdirSync(d, { recursive: true });
    const vid = i % 11 === 0, file = `${sub}/f${i}.${vid ? 'mp4' : 'png'}`; fs.writeFileSync(path.join(root, file), 'x');
    const it = { id: file, file, kind: vid ? 'video' : 'image', at: sameTime ? 1e12 : 1e12 + i * 1000, prompt: `prompt ${i}${i === 0 ? ' Cafetería Ñandú' : ''}`, model: 'prueba',
      ...(i % 7 === 0 ? { fav: true } : {}), ...(i % 5 === 0 ? { by: 'agent', agent: 'mia', task: 't' + i } : { by: 'you' }), ...(i % 13 === 0 ? { upload: true } : {}), ...(folderOf(i) ? { folder: folderOf(i) } : {}) };
    fs.writeFileSync(path.join(d, `f${i}.json`), JSON.stringify(it));
  }
}
const walk = (o = {}) => { const seen = []; let before = null, pages = 0; do { const r = md.query({ ...o, before }); seen.push(...r.items.map(x => x.file)); before = r.next; pages++; } while (before && pages < 200); return { seen, pages }; };

test('puro: filtros, búsqueda sin acentos y con todas las palabras, recuentos y cursor', () => {
  const ids = new Set(['c1']);
  const a = { file: '2026-09/a.png', kind: 'image', at: 2, prompt: 'Taza ROJA de café', fav: true, folder: 'c1' }, b = { file: '2026-09/b.mp4', kind: 'video', at: 1, prompt: 'taza azul', by: 'agent', folder: 'borrada' }, c = { file: '2026-09/c.mp3', kind: 'audio', at: 1, prompt: 'jingle', wanted: 'music', upload: true };
  assert.equal(GF.matcher({ q: 'cafe roja' }, ids)(a), true, 'sin acentos ni mayúsculas, todas las palabras');
  assert.equal(GF.matcher({ q: 'cafe azul' }, ids)(a), false);
  assert.equal(GF.matcher({ folder: 'none' }, ids)(b), true, 'una carpeta que ya no existe cuenta como «sin carpeta»');
  assert.equal(GF.matcher({ folder: 'c1' }, ids)(a), true);
  assert.equal(GF.matcher({ kind: 'image,video' }, ids)(c), false);
  assert.equal(GF.matcher({ filter: 'music' }, ids)(c), true);
  assert.deepEqual(GF.counts([a, b, c], ids), { all: 3, fav: 1, you: 1, agent: 1, video: 1, up: 1, voice: 0, music: 1, none: 2 });
  assert.deepEqual([c, b, a].sort(GF.cmp).map(x => x.file), [a.file, c.file, b.file], 'lo nuevo primero; a igual hora, por nombre');
  assert.deepEqual(GF.parseCursor(GF.cursorOf(a)), { at: 2, file: a.file });
  assert.equal(GF.parseCursor('basura'), null);
  assert.equal(GF.miles(3412), '3.412'); assert.equal(GF.miles(120), '120'); assert.equal(GF.miles(1234567), '1.234.567');
});

test('650 fichas: por páginas se llega a todas, sin repetir; la 650 se encuentra; los recuentos son del total', () => {
  const dir = box();
  try {
    const f = md.addFolder('Vieja'); seed(md.dir(), 650, { folderOf: i => (i === 0 || i === 1 ? f.id : null) });
    const first = md.query({ n: 120 });
    assert.equal(first.items.length, 120); assert.equal(first.total, 650); assert.ok(first.next);
    assert.equal(first.items[0].file, '2026-02/f649.mp4', 'lo más nuevo primero');
    const { seen, pages } = walk({ n: 120 });
    assert.equal(seen.length, 650); assert.equal(new Set(seen).size, 650, 'ninguna repetida'); assert.equal(pages, 6);
    assert.equal(seen.at(-1), '2026-01/f0.mp4', 'la más vieja también');
    const q = md.query({ q: 'cafeteria nandu' }); assert.deepEqual(q.items.map(x => x.file), ['2026-01/f0.mp4'], 'la búsqueda va al servidor, sobre todo');
    assert.equal(q.total, 1);
    assert.equal(first.counts.all, 650); assert.equal(first.counts.fav, Math.ceil(650 / 7)); assert.equal(first.counts.video, Math.ceil(650 / 11));
    assert.equal(first.counts.none, 648); assert.equal(first.folders.find(x => x.id === f.id).n, 2, 'la carpeta cuenta las viejas');
    const inF = md.query({ folder: f.id }); assert.deepEqual(inF.items.map(x => x.file).sort(), ['2026-01/f0.mp4', '2026-02/f1.png']);
    const favs = walk({ filter: 'fav', n: 50 }).seen; assert.equal(favs.length, Math.ceil(650 / 7)); assert.ok(favs.includes('2026-01/f0.mp4'));
    assert.equal(md.query({ filter: 'agent' }).total, 130); assert.equal(md.query({ filter: 'up' }).total, 50);
    assert.equal(md.query({ kind: 'video' }).total, Math.ceil(650 / 11));
    assert.equal(md.removeFolder(f.id), 2); assert.equal(md.query({}).counts.none, 650, 'borrar la carpeta limpia también la 650');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('el cursor no salta ni repite aunque llegue algo nuevo arriba, ni con fichas a la misma hora', () => {
  const dir = box();
  try {
    seed(md.dir(), 30, { sameTime: true });
    const p1 = md.query({ n: 10 });
    const root = md.dir(), file = '2026-01/nueva.png'; fs.writeFileSync(path.join(root, file), 'x');
    fs.writeFileSync(path.join(root, '2026-01', 'nueva.json'), JSON.stringify({ id: file, file, kind: 'image', at: 2e12, prompt: 'nueva' }));
    let before = p1.next; const rest = [];
    while (before) { const r = md.query({ n: 10, before }); rest.push(...r.items.map(x => x.file)); before = r.next; }
    const all = [...p1.items.map(x => x.file), ...rest];
    assert.equal(all.length, 30); assert.equal(new Set(all).size, 30); assert.ok(!all.includes(file), 'la nueva sale arriba, en la próxima recarga');
    assert.equal(md.query({ n: 10 }).items[0].file, file);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('upto estira la página hasta un archivo viejo (el visor abre uno que no estaba cargado); offset también pagina', () => {
  const dir = box();
  try {
    seed(md.dir(), 300);
    const r = md.query({ n: 120, upto: '2026-02/f10.png' });
    assert.equal(r.items.at(-1).file, '2026-02/f10.png'); assert.equal(r.items.length, 290); assert.ok(r.next);
    assert.equal(md.query({ n: 120, upto: '2026-02/no-existe.png' }).items.length, 120, 'un archivo que no está: una página normal');
    const o = md.query({ n: 100, offset: 250 }); assert.equal(o.items.length, 50); assert.equal(o.next, null);
    assert.notEqual(md.query({ n: 100, offset: 150 }).next, null);
    assert.equal(md.query({ n: 0 }).items.length, 0, 'n=0: solo recuentos y carpetas');
    assert.equal(md.query({ n: 99999 }).items.length, 300); assert.equal(md.query({ n: 99999, offset: 0, kind: null }).items.length <= md.PAGE_MAX, true, 'una página nunca pasa del máximo');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('revisión INF-03: upto nunca estira más allá de PAGE_MAX; un archivo más lejano llega aparte (hit) y la página es normal', () => {
  const dir = box();
  try {
    seed(md.dir(), 1000);
    const r = md.query({ n: 120, upto: '2026-02/f1.png' }); // casi la más vieja: antes devolvía las 999 de delante
    assert.equal(r.items.length, 120, 'una página normal, no toda la galería');
    assert.ok(r.hit, 'el archivo pedido llega aparte'); assert.equal(r.hit.file, '2026-02/f1.png'); assert.equal(r.hitAt, 998);
    assert.ok(r.next, 'las páginas siguen desde la primera, no desde el archivo');
    const near = md.query({ n: 120, upto: '2026-09/f800.png' }); // dentro de PAGE_MAX: se estira como antes
    assert.equal(near.items.at(-1).file, '2026-09/f800.png'); assert.equal(near.items.length, 200); assert.equal(near.hit, undefined);
    const last = md.query({ n: 120, upto: '2026-05/f400.png' }); assert.equal(last.items.length, md.PAGE_MAX, 'la 600.ª todavía cabe'); assert.equal(last.hit, undefined);
    const edge = md.query({ n: 120, upto: '2026-04/f399.png' }); // la 601.ª: fuera del alcance
    assert.equal(edge.items.length, 120); assert.equal(edge.hit?.file, '2026-04/f399.png'); assert.equal(edge.hitAt, 600);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('exclude: lo que la pieza ya lleva sale de las páginas Y del total (el selector de Contenido cuadra «Ves X de Y»)', () => {
  const dir = box();
  try {
    seed(md.dir(), 50);
    const all = md.query({ n: 10, kind: 'image,video' }), quit = all.items.slice(0, 3).map(x => x.file);
    const r = md.query({ n: 10, kind: 'image,video', exclude: quit });
    assert.equal(r.total, all.total - 3); assert.ok(!r.items.some(x => quit.includes(x.file)));
    const { seen } = walk({ n: 7, exclude: quit }); assert.equal(seen.length, 47); assert.equal(new Set(seen).size, 47);
    assert.equal(md.query({ n: 10, exclude: ['2026-01/no-existe.png'] }).total, 50, 'un archivo que no está no cambia nada');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/** n fichas solo en la foto del índice (data/media-index.json), con sus carpetas de mes de verdad: así se mide la galería
 *  de 5.000 sin escribir 10.000 archivos (en una máquina con antivirus eso solo ya tarda minutos). */
function seedSnap(dir, n) {
  const root = md.dir(), months = {};
  for (let i = 0; i < n; i++) { const sub = `2026-${String(1 + (i % 9)).padStart(2, '0')}`; (months[sub] ||= { items: [] }).items.push({ id: `${sub}/f${i}.png`, file: `${sub}/f${i}.png`, kind: 'image', at: 1e12 + i * 1000, prompt: `prompt ${i} una taza de café con espuma`, model: 'prueba', ...(i % 7 === 0 ? { fav: true } : {}), ...(i % 5 === 0 ? { by: 'agent', agent: 'mia' } : { by: 'you' }) }); }
  for (const sub of Object.keys(months)) { fs.mkdirSync(path.join(root, sub), { recursive: true }); months[sub].mtime = fs.statSync(path.join(root, sub)).mtimeMs; }
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', 'media-index.json'), JSON.stringify({ v: 1, root, months }));
  md.configure({ media: {} }, dir, path.join(dir, 'data'), { warm: false });
}
test('5.000 fichas: una página, una búsqueda y un filtro salen de la memoria en milisegundos', () => {
  const dir = box();
  try {
    seedSnap(dir, 5000);
    let t = performance.now(); md.query({ n: 1 }); const cold = performance.now() - t; // from the snapshot: no .json is read
    const time = o => { const t0 = performance.now(); for (let i = 0; i < 10; i++) md.query(o); return (performance.now() - t0) / 10; };
    const page = time({ n: 120 }), search = time({ q: 'prompt 4999' }), fav = time({ filter: 'fav', n: 120 }), deep = time({ n: 120, offset: 4800 }), miss = time({ q: 'nada parecido' });
    console.log(`  5.000 fichas · índice desde la foto ${cold.toFixed(0)} ms · página ${page.toFixed(1)} ms · búsqueda ${search.toFixed(1)} ms · sin resultados ${miss.toFixed(1)} ms · favoritas ${fav.toFixed(1)} ms · página 41 ${deep.toFixed(1)} ms`);
    for (const [k, v] of Object.entries({ cold, page, search, fav, deep, miss })) assert.ok(v < 150, `${k}: ${v.toFixed(1)} ms`);
    assert.equal(md.query({ q: 'prompt 4999' }).items[0].file, '2026-05/f4999.png');
    assert.equal(md.query({ n: 1 }).counts.all, 5000);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('la foto del índice (data/media-index.json): arranca sin releer cada ficha, y un cambio de la oficina nunca se pierde', async () => {
  const dir = box();
  try {
    seed(md.dir(), 40); const cfgAgain = () => md.configure({ media: {} }, dir, path.join(dir, 'data'), { warm: false });
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    md.query({ n: 1 }); await new Promise(r => setTimeout(r, 2300));
    const snap = path.join(dir, 'data', 'media-index.json'); assert.ok(fs.existsSync(snap), 'la foto se guarda sola');
    // the office changes a record in place and «crashes» before the next snapshot: the month's mtime moved, so it is read again
    md.update('2026-01/f0.mp4', { fav: false, prompt: 'cambiada por la oficina' }); cfgAgain();
    assert.equal(md.query({ q: 'cambiada por la oficina' }).total, 1, 'el cambio sigue ahí tras reiniciar');
    // a file added from outside (the Explorer): its folder's mtime moves, it shows up
    const file = '2026-03/fuera.png'; fs.writeFileSync(path.join(md.dir(), file), 'x'); fs.writeFileSync(path.join(md.dir(), '2026-03', 'fuera.json'), JSON.stringify({ id: file, file, kind: 'image', at: 3e12, prompt: 'de fuera' }));
    cfgAgain(); assert.equal(md.query({ n: 1 }).items[0].file, file);
    assert.equal(md.query({}).total, 41);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/* ---------- el servidor de verdad ---------- */
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
test('GET /api/media: la respuesta de siempre para quien no pide páginas, y páginas con total, cursor, búsqueda y recuentos', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-pagina-srv-')), brain = path.join(dir, 'brain'), mroot = path.join(brain, 'Agents Office', 'media');
  fs.mkdirSync(mroot, { recursive: true }); seed(mroot, 650);
  const probe = http.createServer(), port = await listen(probe); await new Promise(r => probe.close(r));
  const env = { ...process.env, PORT: String(port), AO_DATA: path.join(dir, 'data'), AO_BRAIN: brain, AO_LOCAL_CONFIG: path.join(dir, 'office.config.local.json'),
    ANTHROPIC_API_KEY: '', CLAUDE_BIN: path.join(dir, 'no-claude.exe'), TELEGRAM_BOT_TOKEN: '', META_ACCESS_TOKEN: '', GEMINI_API_KEY: '', HF_KEY: '', HF_API_KEY: '', FAL_KEY: '', OPENAI_API_KEY: '', XAI_API_KEY: '', META_API_KEY: '', MODEL_API_KEY: '', VOYAGE_API_KEY: '' };
  const srv = spawn(process.execPath, ['serve.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  t.after(() => { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  const get = async p => { const r = await fetch(base + p); assert.equal(r.status, 200, log.slice(-800)); return r.json(); };
  const old = await get('/api/media');
  assert.equal(old.items.length, 600, 'quien no pide páginas recibe lo de siempre'); assert.ok(Array.isArray(old.models) && old.budget, 'con el catálogo');
  assert.equal(old.total, 650); assert.ok(old.next); assert.equal(old.counts.all, 650);
  const p1 = await get('/api/media?n=120');
  assert.equal(p1.items.length, 120); assert.equal(p1.total, 650); assert.equal(p1.models, undefined, 'una página no carga el catálogo');
  const withCat = await get('/api/media?n=10&catalog=1'); assert.ok(Array.isArray(withCat.models));
  let next = p1.next, n = p1.items.length; while (next) { const r = await get('/api/media?n=200&before=' + encodeURIComponent(next)); n += r.items.length; next = r.next; }
  assert.equal(n, 650);
  const q = await get('/api/media?q=' + encodeURIComponent('cafetería ñandú'));
  assert.deepEqual(q.items.map(x => x.file), ['2026-01/f0.mp4']);
  const byAgent = await get('/api/media?q=prompt%205&filter=agent&n=5'); assert.ok(byAgent.items.every(x => x.by === 'agent'));
  const kinds = await get('/api/media?kind=image&n=500'); assert.ok(kinds.items.every(x => x.kind === 'image'));
  const byName = await get('/api/media?q=' + encodeURIComponent('prompt 645') + '&n=5'); // f645: i % 5 === 0, an agent's — found by its prompt; the agent's name comes from the roster
  assert.deepEqual(byName.items.map(x => x.file), ['2026-07/f645.png']);
  const far = await get('/api/media?n=120&upto=' + encodeURIComponent('2026-02/f1.png')); // revisión INF-03: lo lejano llega aparte
  assert.equal(far.items.length, 120); assert.equal(far.hit.file, '2026-02/f1.png'); assert.equal(far.hitAt, 648);
  const not = await get('/api/media?n=5&not=' + encodeURIComponent(p1.items[0].file) + '&not=' + encodeURIComponent(p1.items[1].file));
  assert.equal(not.total, 648); assert.ok(!not.items.some(x => x.file === p1.items[0].file || x.file === p1.items[1].file));
});

test('buscar_en_galeria pide la búsqueda al servidor (toda la galería) y dice cuántas hay en total', async () => {
  const urls = [];
  const folders = [{ id: 'cabc12', name: 'Campaña Otoño', n: 900 }];
  const srv = http.createServer((req, res) => { urls.push(req.url); res.writeHead(200, { 'content-type': 'application/json' });
    const u = new URL(req.url, 'http://x'); res.end(JSON.stringify(u.searchParams.get('n') === '0' ? { items: [], folders, total: 5000, next: null } : { items: [{ file: '2025-01/vieja.png', kind: 'image', prompt: 'taza roja de 2025', folder: 'cabc12' }], folders, total: 40, next: '1|x' })); });
  const port = await listen(srv);
  const p = spawn(process.execPath, [path.join(ROOT, 'estudio-mcp.mjs')], { env: { ...process.env, AO_OFFICE: `http://127.0.0.1:${port}` } });
  let out = ''; const waiting = new Map();
  p.stdout.on('data', d => { out += d; let i; while ((i = out.indexOf('\n')) >= 0) { const m = JSON.parse(out.slice(0, i)); out = out.slice(i + 1); waiting.get(m.id)?.(m); } });
  let k = 0; const ask = (method, params) => new Promise(r => { const id = ++k; waiting.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  try {
    const text = (await ask('tools/call', { name: 'buscar_en_galeria', arguments: { buscar: 'Taza roja', carpeta: 'campaña otoño', solo_subidas: true, cantidad: 5 } })).result.content[0].text;
    const q = new URL(urls.at(-1), 'http://x').searchParams;
    assert.equal(q.get('q'), 'taza roja'); assert.equal(q.get('folder'), 'cabc12'); assert.equal(q.get('filter'), 'up'); assert.equal(q.get('n'), '5');
    assert.match(text, /^1 de 40 /); assert.match(text, /2025-01\/vieja\.png · imagen · carpeta «Campaña Otoño» · «taza roja de 2025»/);
  } finally { p.kill(); srv.close(); }
});
