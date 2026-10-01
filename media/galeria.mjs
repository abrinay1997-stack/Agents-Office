// Agents Office — el Estudio: la GALERÍA (F0 del banco de presets, 1 oct 2026: salió de media.mjs, que es la fachada).
// Los archivos en <cerebro>/Agents Office/media/AAAA-MM/ con su ficha .json al lado (store), las carpetas del dueño, el
// índice en memoria con su foto en data/media-index.json (INF-02/INF-03), query() paginada, la papelera, las subidas, el zip
// y lo que el dueño usó (markUsed).
import fs from 'node:fs';
import path from 'node:path';
import * as GF from '../src/galeria-filtro.js'; // INF-03: qué ficha entra en una vista, igual en el servidor y en la página

let root = '';
export const dir = () => root;
/** configure(): the gallery's folder. */
export function setRoot(r) { root = r; }
/** configure(): the snapshot of the index in <dataDir>/media-index.json, and the first read in the background (h.warm !== false). */
export function startIndex(dataDir, warmIt = true) {
  clearTimeout(snapT); snapT = null; snapFile = path.join(dataDir, 'media-index.json'); loadSnap(); // INF-03
  if (warmIt) { const r = root; const w = WARM = warm(r).catch(() => {}).finally(() => { if (WARM === w) WARM = null; }); } // INF-03: the gallery's index, read in the background
}

/* ---------- storage ---------- */
export const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'imagen';
function dims(b, ext) { // width × height from the file header (png, jpg, webp, our svg) — the gallery lays out at the true ratio
  try {
    if (ext === 'png' && b.readUInt32BE(12) === 0x49484452) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (ext === 'jpg') { let i = 2; while (i + 9 < b.length) { if (b[i] !== 0xFF) return null; const mk = b[i + 1]; if (mk >= 0xC0 && mk <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(mk)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } }
    if (ext === 'webp' && b.toString('ascii', 8, 12) === 'WEBP') { const t = b.toString('ascii', 12, 16); if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)]; if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; if (t === 'VP8L') { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; } }
    if (ext === 'svg') { const m = /width="(\d+)" height="(\d+)"/.exec(b.toString('utf8', 0, 400)); if (m) return [+m[1], +m[2]]; }
  } catch {}
  return null;
}
/** A name is taken while its file, its record, or its copy in the bin exists — a restore never collides with a new picture. */
function taken(folder, name, ext) {
  if (fs.existsSync(path.join(folder, name + '.' + ext)) || fs.existsSync(path.join(folder, name + '.json'))) return true;
  const bin = path.join(root, '.papelera'); if (!fs.existsSync(bin)) return false;
  const tail = '-' + name + '.'; return fs.readdirSync(bin).some(f => f.includes(tail));
}
export const AUDIO_EXT = ['mp3', 'wav', 'flac', 'm4a', 'ogg']; // V4.10: MiniMax answers flac too; a voice to clone may come as m4a
export function store(buf, ext, meta) {
  const d = new Date(), sub = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const folder = path.join(root, sub); fs.mkdirSync(folder, { recursive: true });
  // the name is never reused (V4.4, 25 Sep 2026): «date + prompt» alone came back free when a file went to the bin, and the
  // next picture with the same prompt took it — the browser (and a reference or a deliverable pointing at it) showed the old one
  const hms = [d.getHours(), d.getMinutes(), d.getSeconds()].map(x => String(x).padStart(2, '0')).join('');
  let base = `${sub}-${String(d.getDate()).padStart(2, '0')} ${slug(meta.prompt)} ${hms}`, name = base;
  for (let n = 2; taken(folder, name, ext); n++) name = `${base}-${n}`;
  fs.writeFileSync(path.join(folder, name + '.' + ext), buf);
  const rel = `${sub}/${name}.${ext}`, wh = dims(buf, ext);
  const item = { id: rel, file: rel, kind: ext === 'mp4' || ext === 'webm' ? 'video' : AUDIO_EXT.includes(ext) ? 'audio' : 'image', ext, at: Date.now(), ...(wh ? { w: wh[0], h: wh[1] } : {}), ...meta };
  fs.writeFileSync(path.join(folder, name + '.json'), JSON.stringify(item, null, 2));
  idxPut(sub, { ...item });
  return item;
}
/* ---------- V4.6 (27 Sep 2026, the owner): folders to organise the gallery ----------
   Folders are the owner's own labels, not directories: a file stays where it is (the links in the deliverables and the
   references keep working) and its record says which folder it is in. <media>/folders.json keeps their names. */
const foldersFile = () => path.join(root, 'folders.json');
function readFolders() { try { const j = JSON.parse(fs.readFileSync(foldersFile(), 'utf8')); return Array.isArray(j.folders) ? j.folders.filter(f => f && /^c[a-z0-9]{4,20}$/.test(f.id) && typeof f.name === 'string') : []; } catch { return []; } }
function writeFolders(l) { fs.mkdirSync(root, { recursive: true }); const f = foldersFile(); fs.writeFileSync(f + '.tmp', JSON.stringify({ folders: l }, null, 1)); fs.renameSync(f + '.tmp', f); }
const cleanName = n => String(n ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
/** The folders, with how many files each holds (the ones in the bin do not count). */
export function folders(items = index().sorted, fl = readFolders()) { // INF-03: the index itself (read only), never a copy of 5,000 records per request
  const count = new Map(); for (const it of items) if (it.folder) count.set(it.folder, (count.get(it.folder) || 0) + 1);
  return fl.map(f => ({ ...f, n: count.get(f.id) || 0 }));
}
export const folderOf = id => readFolders().find(f => f.id === id) || null;
export function addFolder(name) {
  const nm = cleanName(name); if (!nm) throw new Error('ponle un nombre a la carpeta');
  const l = readFolders(); if (l.some(f => f.name.toLowerCase() === nm.toLowerCase())) throw new Error(`ya hay una carpeta «${nm}»`);
  if (l.length >= 200) throw new Error('como mucho 200 carpetas');
  const f = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: nm, at: Date.now() };
  writeFolders([...l, f]); return f;
}
export function renameFolder(id, name) {
  const nm = cleanName(name); if (!nm) throw new Error('ponle un nombre a la carpeta');
  const l = readFolders(), f = l.find(x => x.id === id); if (!f) throw new Error('esa carpeta ya no existe');
  if (l.some(x => x.id !== id && x.name.toLowerCase() === nm.toLowerCase())) throw new Error(`ya hay una carpeta «${nm}»`);
  f.name = nm; writeFolders(l); return f;
}
/** The folder goes; its files stay, with no folder. → how many files it held */
export function removeFolder(id) {
  const l = readFolders(); if (!l.some(f => f.id === id)) throw new Error('esa carpeta ya no existe');
  let n = 0; for (const it of all()) if (it.folder === id) { update(it.file, { folder: null }); n++; } // the whole gallery, never just its first 600
  writeFolders(l.filter(f => f.id !== id)); return n;
}
/** Files into a folder (null: out of any folder). → how many moved */
export function moveTo(files, folder) {
  if (folder != null && !readFolders().some(f => f.id === folder)) throw new Error('esa carpeta ya no existe');
  let n = 0; for (const id of (Array.isArray(files) ? files : []).slice(0, 2000)) if (typeof id === 'string' && update(id, { folder: folder || null })) n++;
  return n;
}
/* Auditoría 1 oct 2026 (INF-02): the gallery lives in memory. Every GET /api/media read every .json sidecar TWICE
   (list() and folders()) with sync I/O on the server's one thread: 600 files froze the whole office for seconds. Now each
   month folder is read once and kept with its folder's mtime; a month is read again only when that mtime moves (a file
   added, removed or renamed from outside, e.g. in the Explorer), and the office's own writes patch the index in place.
   The API is the same: list() hands back copies, never the index's own objects. */
const MONTH_RE = /^\d{4}-\d{2}$/;
let IDX = { root: '', months: new Map(), sorted: null, rev: 0, counts: null };
const mtimeOf = d => { try { return fs.statSync(d).mtimeMs; } catch { return -1; } };
/** INF-03: is the record's file there? From the folder's own listing (one readdir), not one existsSync per file: 5,000 of them took seconds. */
const fileThere = (r, sub, names, it) => it && typeof it.file === 'string' && (it.file.startsWith(sub + '/') && !it.file.slice(8).includes('/') ? names.has(it.file.slice(8)) : fs.existsSync(path.join(r, it.file)));
function scanMonth(sub) {
  const dir = path.join(root, sub), items = new Map();
  let names = []; try { names = fs.readdirSync(dir); } catch { return items; }
  const set = new Set(names);
  for (const f of names) {
    if (!f.endsWith('.json')) continue;
    try { const it = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (fileThere(root, sub, set, it)) items.set(it.file, it); } catch {}
  }
  return items;
}
/* INF-03: the first read of a big gallery (5,000 records) took seconds of sync I/O on the server's one thread. configure()
   starts reading it in the background with fs.promises; GET /api/media awaits ready() first, so it never blocks the office.
   A month is taken only if no sync read got there first; its mtime is read BEFORE its listing, so a file written meanwhile
   moves the mtime and the month is read again on the next index(). */
let WARM = null;
export const ready = () => WARM || Promise.resolve();
async function warm(r) {
  let subs = []; try { subs = (await fs.promises.readdir(r)).filter(x => MONTH_RE.test(x)); } catch { return; }
  for (const sub of subs) {
    if (root !== r) return;
    const dir = path.join(r, sub); let mt; try { mt = (await fs.promises.stat(dir)).mtimeMs; } catch { continue; }
    const cur = IDX.root === r ? IDX.months.get(sub) : null; if (cur && cur.mtime === mt) continue; // already read (or in the snapshot) and unchanged
    let names = []; try { names = await fs.promises.readdir(dir); } catch { continue; }
    const set = new Set(names), js = names.filter(f => f.endsWith('.json')), items = new Map();
    for (let i = 0; i < js.length; i += 64) await Promise.all(js.slice(i, i + 64).map(async f => { try { const it = JSON.parse(await fs.promises.readFile(path.join(dir, f), 'utf8')); if (fileThere(r, sub, set, it)) items.set(it.file, it); } catch {} }));
    if (root !== r) return; if (IDX.root !== r) IDX = { root: r, months: new Map(), sorted: null, rev: IDX.rev + 1, counts: null };
    if ((IDX.months.get(sub) || null) === cur) { IDX.months.set(sub, { mtime: mt, items }); IDX.sorted = null; } // a sync read that got there meanwhile wins
  }
}
/* INF-03: and a snapshot of the index in data/media-index.json (one file: 5,000 records read in ~35 ms where 5,000 small
   .json took over a minute on a busy Windows machine with its antivirus). It is only a head start: a month is trusted only
   while its folder's mtime is the one in the snapshot. Every file the office adds, removes or renames moves that mtime by
   itself; update() rewrites a record in place, which does not, so it moves the folder's mtime on purpose (bump). */
let snapFile = '', snapT = null;
function loadSnap() {
  if (!snapFile) return;
  try {
    const j = JSON.parse(fs.readFileSync(snapFile, 'utf8')); if (!j || j.v !== 1 || j.root !== root || !j.months) return;
    const months = new Map(); for (const [k, m] of Object.entries(j.months)) if (MONTH_RE.test(k) && m && Array.isArray(m.items)) months.set(k, { mtime: m.mtime, items: new Map(m.items.filter(it => it && typeof it.file === 'string').map(it => [it.file, it])) });
    IDX = { root, months, sorted: null, rev: IDX.rev + 1, counts: null };
  } catch {} // none yet, or unreadable: the folders are read as before
}
function saveSnapSoon() {
  if (!snapFile || snapT) return; const f = snapFile, r = root;
  snapT = setTimeout(() => {
    snapT = null; if (f !== snapFile || r !== root || IDX.root !== r || !fs.existsSync(r) || !fs.existsSync(path.dirname(f))) return;
    try { const months = {}; for (const [k, m] of IDX.months) months[k] = { mtime: m.mtime, items: [...m.items.values()] }; fs.writeFileSync(f + '.tmp', JSON.stringify({ v: 1, root: r, at: Date.now(), months })); fs.renameSync(f + '.tmp', f); } catch (e) { console.warn('media index:', e.message); }
  }, 2000); snapT.unref?.();
}
/** A record was rewritten in place: move its folder's mtime, so a snapshot taken before it is not trusted for that month. */
function bump(dir) { try { const t = Math.max(Date.now(), Math.floor(fs.statSync(dir).mtimeMs) + 1); fs.utimesSync(dir, new Date(t), new Date(t)); } catch {} }
function index() {
  if (IDX.root !== root) IDX = { root, months: new Map(), sorted: null, rev: IDX.rev + 1, counts: null };
  if (!root || !fs.existsSync(root)) { if (IDX.months.size || !IDX.sorted) { IDX.months.clear(); IDX.sorted = []; } return IDX; }
  const subs = fs.readdirSync(root).filter(x => MONTH_RE.test(x));
  for (const k of [...IDX.months.keys()]) if (!subs.includes(k)) { IDX.months.delete(k); IDX.sorted = null; }
  for (const sub of subs) {
    const mt = mtimeOf(path.join(root, sub)), cur = IDX.months.get(sub);
    if (!cur || cur.mtime !== mt) { IDX.months.set(sub, { mtime: mt, items: scanMonth(sub) }); IDX.sorted = null; }
  }
  if (!IDX.sorted) { IDX.sorted = [...IDX.months.values()].flatMap(m => [...m.items.values()]).sort(GF.cmp); IDX.rev++; IDX.counts = null; saveSnapSoon(); } // INF-03: a tie on the time sorts by name, so a cursor never skips nor repeats
  return IDX;
}
/** The office wrote into this month itself: patch the index and take the folder's new mtime, so it is not read again. */
function idxPut(sub, it) {
  if (IDX.root !== root) return; const m = IDX.months.get(sub); if (!m) return; // not indexed yet: the next read builds it
  if (it) m.items.set(it.file, it); m.mtime = mtimeOf(path.join(root, sub)); IDX.sorted = null;
}
function idxDrop(file) {
  const sub = String(file).slice(0, 7); if (IDX.root !== root) return; const m = IDX.months.get(sub); if (!m) return;
  m.items.delete(file); m.mtime = mtimeOf(path.join(root, sub)); IDX.sorted = null;
}
/** The whole gallery (copies), for counting and for changes that must reach every file, not one page. */
const all = () => index().sorted.map(it => ({ ...it }));
/** Everything in the studio, newest first (from the in-memory index of the .json sidecars). */
export function list({ limit = 600 } = {}) {
  return index().sorted.slice(0, limit).map(it => ({ ...it }));
}
/* Auditoría 1 oct 2026 (INF-03): the gallery had a cap of 600 and no pages — from file 601 on, the oldest vanished from
   the Estudio, Ctrl+K, the Contenido picker and the folder counts. query() searches, filters and counts over the WHOLE
   index and hands back one page: { items, total (what matches), next (cursor of the next page, or null), counts (the tabs
   and «Sin carpeta», over the whole gallery), rev }. A cursor is «time|file» of the last item seen: a new file arriving at
   the top never shifts the next page. `upto` stretches the page until that file is in it (the viewer opening one old file),
   never past PAGE_MAX: a file further down comes apart as `hit` (its record) and `hitAt` (its place in the view), and the page
   stays a normal one — stretching to it loaded the whole gallery into the Estudio at once (revisión de INF-03). */
export const PAGE_MAX = 600; // the old answer's size: a page is never bigger
export function query({ q = '', filter = 'all', folder = 'all', kind = null, before = null, offset = 0, n = 120, upto = null, extra = null, exclude = null } = {}) {
  const X = index(), fl = readFolders(), ids = new Set(fl.map(f => f.id)), sig = X.rev + ':' + [...ids].join(',');
  const skipF = new Set(Array.isArray(exclude) ? exclude.slice(0, 50).map(String) : []), m0 = GF.matcher({ q, filter, folder, kind }, ids, extra); // exclude: files the asker already has (a piece's own media), out of the pages AND the total, so «Ves X de Y» adds up
  const ok = skipF.size ? it => !skipF.has(it.file) && m0(it) : m0, cur = GF.parseCursor(before);
  const size = Math.max(0, Math.min(PAGE_MAX, Number.isFinite(+n) ? Math.floor(+n) : 120));
  let skip = Math.max(0, Math.floor(+offset || 0)), total = 0, after = 0, hit = -1, far = null, farAt = -1; const page = [];
  for (const it of X.sorted) {
    if (!ok(it)) continue; total++;
    if (cur && GF.cmp(it, cur) <= 0) continue; // at or before the cursor: already seen
    after++; if (skip) { skip--; continue; }
    if (page.length < size || (upto && hit < 0 && page.length < PAGE_MAX)) { if (it.file === upto) hit = page.length; page.push(it); }
    else if (upto && hit < 0 && !far && it.file === upto) { far = it; farAt = after - 1; } // further than a page can reach: apart
  }
  if (upto && hit < 0) page.length = Math.min(page.length, size); // that file is not in this view: a normal page
  const off = Math.max(0, Math.floor(+offset || 0)), more = after - off - page.length > 0;
  if (!X.counts || X.countsSig !== sig) { X.counts = GF.counts(X.sorted, ids); X.countsSig = sig; }
  return { items: page.map(it => ({ ...it })), total, next: more && page.length ? GF.cursorOf(page[page.length - 1]) : null, counts: { ...X.counts }, folders: folders(X.sorted, fl), rev: X.rev, ...(far ? { hit: { ...far }, hitAt: farAt } : {}) };
}
const FILE_RE = /^\d{4}-\d{2}\/[^/\\]+\.(png|jpe?g|webp|svg|mp4|webm|mp3|wav|flac|m4a|ogg)$/i; // V4.8: audio too, for Muse Spark to transcribe; V4.10: flac, m4a, ogg
/** A path inside the studio, or null (never outside it: the id comes from the request). */
export function resolve(id) {
  const rel = String(id || '').replace(/\\/g, '/');
  if (!FILE_RE.test(rel) || rel.includes('..')) return null;
  const p = path.join(root, rel); return fs.existsSync(p) ? p : null;
}
export function item(id) { const p = resolve(id); if (!p) return null; try { return JSON.parse(fs.readFileSync(p.replace(/\.[^.]+$/, '.json'), 'utf8')); } catch { return null; } }
export function update(id, patch) { const p = resolve(id); if (!p) return null; const j = p.replace(/\.[^.]+$/, '.json'); const it = JSON.parse(fs.readFileSync(j, 'utf8')); Object.assign(it, patch); fs.writeFileSync(j, JSON.stringify(it, null, 2)); bump(path.dirname(j)); if (typeof it.file === 'string') idxPut(it.file.slice(0, 7), { ...it }); return it; }
/** To <media>/.papelera (emptied after 30 days). Returns what `restore` needs to bring it back, or null. */
export function trash(id) {
  const p = resolve(id); if (!p) return null;
  const bin = path.join(root, '.papelera'); fs.mkdirSync(bin, { recursive: true });
  const stamp = Date.now(), names = [];
  for (const f of [p, p.replace(/\.[^.]+$/, '.json')]) if (fs.existsSync(f)) { const nm = `${stamp}-${path.basename(f)}`, to = path.join(bin, nm); fs.renameSync(f, to); try { fs.utimesSync(to, new Date(stamp), new Date(stamp)); } catch {} names.push(nm); } // dated the day it went in: the 30 days count from here
  idxDrop(String(id).replace(/\\/g, '/'));
  return { id: String(id).replace(/\\/g, '/'), bin: names };
}
export function restore({ id, bin } = {}) {
  const rel = String(id || '').replace(/\\/g, '/');
  if (!FILE_RE.test(rel) || rel.includes('..') || !Array.isArray(bin) || !bin.length || bin.length > 2) return false;
  const trashDir = path.join(root, '.papelera'), folder = path.join(root, path.dirname(rel)), stem = path.basename(rel).replace(/\.[^.]+$/, '');
  const moves = [];
  for (const nm of bin) {
    if (!/^\d+-[^/\\]+$/.test(String(nm)) || nm.includes('..')) return false;
    const orig = String(nm).replace(/^\d+-/, ''); if (orig.replace(/\.[^.]+$/, '') !== stem) return false; // only the file and its record, back to their own name
    const from = path.join(trashDir, nm), to = path.join(folder, orig);
    if (!fs.existsSync(from) || fs.existsSync(to)) return false;
    moves.push([from, to]);
  }
  fs.mkdirSync(folder, { recursive: true });
  for (const [from, to] of moves) fs.renameSync(from, to);
  let back = null; try { back = JSON.parse(fs.readFileSync(path.join(folder, stem + '.json'), 'utf8')); } catch {}
  idxPut(path.dirname(rel), back && back.file === rel ? back : null);
  return true;
}
/* V4.4 (25 Sep 2026): the bin, seen from the page — what is in it, its picture, how many days it has left, back or gone for good */
const BIN_RE = /^(\d{12,})-([^/\\]+)$/;
export const BIN_DAYS = 30;
const binDir = () => path.join(root, '.papelera');
/** Everything in the bin, newest first: one entry per thrown-away file (its record beside it). */
export function trashList() {
  const dir = binDir(); if (!root || !fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir), out = [];
  for (const nm of names) {
    const m = BIN_RE.exec(nm); if (!m || /\.json$/i.test(nm) || !/\.(png|jpe?g|webp|svg|mp4|webm|mp3|wav)$/i.test(nm)) continue;
    const stamp = +m[1], base = m[2], rec = `${m[1]}-${base.replace(/\.[^.]+$/, '')}.json`;
    let it = {}; try { it = JSON.parse(fs.readFileSync(path.join(dir, rec), 'utf8')); } catch {}
    const id = it.file || `${base.slice(0, 7)}/${base}`;
    out.push({ id, bin: names.includes(rec) ? [nm, rec] : [nm], name: nm, prompt: it.prompt || base, kind: /\.(mp4|webm)$/i.test(nm) ? 'video' : /\.(mp3|wav)$/i.test(nm) ? 'audio' : 'image', at: it.at || null, trashedAt: stamp,
      daysLeft: Math.max(0, Math.ceil((stamp + BIN_DAYS * 864e5 - Date.now()) / 864e5)), modelName: it.modelName || it.model || '', upload: !!it.upload });
  }
  return out.sort((a, b) => b.trashedAt - a.trashedAt);
}
/** The path of a file in the bin (only a file of the bin, never outside it), for its preview. */
export function trashFile(name) { const nm = String(name || ''); if (!BIN_RE.test(nm) || nm.includes('..') || /[\\/]/.test(nm)) return null; const p = path.join(binDir(), nm); return fs.existsSync(p) ? p : null; }
/** Gone for good: these bin entries (their file and record), or everything with { all: true }. Returns how many files went. */
export function purge({ bin, all } = {}) {
  const dir = binDir(); if (!root || !fs.existsSync(dir)) return 0;
  const names = all ? fs.readdirSync(dir) : (Array.isArray(bin) ? bin : []).map(String);
  let n = 0; for (const nm of names) { if (!BIN_RE.test(nm) || nm.includes('..') || /[\\/]/.test(nm)) continue; const p = path.join(dir, nm); if (fs.existsSync(p)) { fs.rmSync(p, { force: true }); n++; } }
  return n;
}
/* uploads: the owner's own photos and videos, to use as a reference or a first frame (never svg: it could carry script) */
const UPLOAD = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/flac': 'flac', 'audio/x-flac': 'flac', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a' }; // V4.8: mp3/wav, for transcribing; V4.10: flac, m4a (a voice to clone)
export const MAGIC = { png: b => b.length > 8 && b.readUInt32BE(0) === 0x89504E47, jpg: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF, webp: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP', mp4: b => b.toString('ascii', 4, 8) === 'ftyp', webm: b => b.length > 4 && b.readUInt32BE(0) === 0x1A45DFA3 , mp3: b => b.length > 3 && (b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)), wav: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE', flac: b => b.length > 4 && b.toString('ascii', 0, 4) === 'fLaC', m4a: b => b.length > 8 && b.toString('ascii', 4, 8) === 'ftyp' };
export function upload({ name, data, folder } = {}) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(data || ''));
  if (!m) throw new Error('el archivo no llegó bien');
  const ext = UPLOAD[m[1].toLowerCase()]; if (!ext) throw new Error('solo PNG, JPG, WEBP, MP4, WEBM, MP3, WAV, FLAC o M4A');
  const buf = Buffer.from(m[2], 'base64');
  if (!MAGIC[ext](buf)) throw new Error('el archivo no es lo que dice ser');
  const audio = AUDIO_EXT.includes(ext), vid = ext === 'mp4' || ext === 'webm';
  if (buf.length > (vid || audio ? 25 : 12) * 1024 * 1024) throw new Error(vid ? 'el video pasa de 25 MB' : audio ? 'el audio pasa de 25 MB' : 'la imagen pasa de 12 MB');
  const title = String(name || 'subida').replace(/\.[^.]+$/, '').slice(0, 80) || 'subida';
  return store(buf, ext, { prompt: title, provider: 'subida', model: '', by: 'you', upload: true, agent: null, task: null, ...(folder && folderOf(folder) ? { folder } : {}) }); // V4.6: into the folder the owner is looking at
}
/** Several files in one .zip (stored, not compressed: images and video are already compressed). */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zip(ids) {
  const files = [], seen = new Set(); let total = 0;
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, 200)) {
    const p = resolve(id); if (!p) continue;
    const data = fs.readFileSync(p); if (total + data.length > 400 * 1024 * 1024) break; total += data.length;
    let name = path.basename(p); for (let n = 2; seen.has(name); n++) name = path.basename(p).replace(/(\.[^.]+)$/, `-${n}$1`); seen.add(name);
    files.push({ name, data });
  }
  const d = new Date(), dt = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dd = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const nm = Buffer.from(f.name, 'utf8'), crc = crc32(f.data), sz = f.data.length;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8); h.writeUInt16LE(dt, 10); h.writeUInt16LE(dd, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(sz, 18); h.writeUInt32LE(sz, 22); h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, nm, f.data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10); c.writeUInt16LE(dt, 12); c.writeUInt16LE(dd, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(sz, 20); c.writeUInt32LE(sz, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nm); off += 30 + nm.length + sz;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return { buf: Buffer.concat([...parts, cd, e]), count: files.length };
}
/** A file the owner used (as a reference, in a piece, on the calendar): its record says how. */
const USES = ['ref', 'pieza', 'calendario'];
export function markUsed(file, how) { if (!USES.includes(how)) return null; const it = item(file); if (!it) return null; return update(file, { used: [...new Set([...(Array.isArray(it.used) ? it.used : []), how])] }); }
export const wasUsed = it => !!it && (it.fav === true || (Array.isArray(it.used) && it.used.length > 0));
