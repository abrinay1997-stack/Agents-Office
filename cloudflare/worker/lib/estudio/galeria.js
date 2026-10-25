// El Estudio en la nube: la GALERÍA. Los archivos están en R2 (env.MEDIA) con la MISMA clave que en la oficina local
// (`AAAA-MM/AAAA-MM-DD <prompt> HHMMSS.<ext>`, nunca reutilizada), su ficha (el .json de al lado) en D1 (`estudio_archivos`),
// las carpetas del dueño en el documento `estudio.carpetas`. Otros módulos (Contenido, Anuncios) leen de R2 con esas claves.
// Lo puro (nombres, bytes, filtros, zip) es el mismo que usa la oficina local: media/galeria-core.mjs y src/galeria-filtro.js.
import * as GF from '../../../../src/galeria-filtro.js';
import { slug, dims, AUDIO_EXT, kindOfExt, FILE_RE, cleanName, nombreBase, BIN_RE, BIN_DAYS, UPLOAD, MAGIC, sniffExt, MEDIA_MIME, zipFiles } from '../../../../media/galeria-core.mjs';
import { leerDoc, mutarDoc, guardarDoc } from '../almacen.js';

export { slug, MEDIA_MIME, BIN_DAYS, AUDIO_EXT };
export const PAGE_MAX = 600;
const CARPETAS = 'estudio.carpetas', REV = 'estudio.rev';
export const ZONA = (env) => (typeof env?.AO_ZONA === 'string' && env.AO_ZONA) || 'America/Panama'; // el día del dueño, no el de UTC

/** Las partes de la fecha del dueño (año, mes, día, hora…) en su zona horaria. */
export function partesLocales(ms, zona = 'America/Panama') {
  let f;
  try { f = new Intl.DateTimeFormat('en-GB', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { f = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}
export const diaLocal = (ms, zona) => { const p = partesLocales(ms, zona), z = (n) => String(n).padStart(2, '0'); return `${p.y}-${z(p.mo)}-${z(p.d)}`; };

/** Una ficha que cambió: sube el número de la galería (la página sabe así que hay que volver a leer). */
export async function subirRev(db) { return guardarDoc(db, REV, { t: Date.now() }); }
export async function rev(db) { return (await db.prepare('select version from docs where clave = ?').bind(REV).first())?.version ?? 0; }

const bytesDe = async (env, key) => { const o = await env.MEDIA.get(key); return o ? Buffer.from(await o.arrayBuffer()) : null; };
export const leerBytes = bytesDe;
const parse = (r) => JSON.parse(r.json);

/* ---------- guardar ---------- */
/** Guarda un archivo nuevo: R2 + su ficha. El nombre nunca se reutiliza (ni el de uno que está en la papelera: su ficha sigue ahí). → la ficha */
export async function store(env, db, buf, ext, meta, { ahora = Date.now(), zona = ZONA(env) } = {}) {
  const { sub, base } = nombreBase(partesLocales(ahora, zona), meta.prompt);
  const wh = dims(buf, ext), kind = kindOfExt(ext);
  let name = base, n = 2;
  for (;;) {
    const rel = `${sub}/${name}.${ext}`;
    const at = ahora + (n - 2); // dos archivos en el mismo milisegundo conservan el orden en que se hicieron
    const item = { id: rel, file: rel, kind, ext, at, ...(wh ? { w: wh[0], h: wh[1] } : {}), ...meta };
    const r = await db.prepare('insert or ignore into estudio_archivos (file, at, kind, json, papelera_at) values (?,?,?,?,null)').bind(rel, at, kind, JSON.stringify(item)).run();
    if (r.meta?.changes) {
      try { await env.MEDIA.put(rel, buf, { httpMetadata: { contentType: MEDIA_MIME[ext] || 'application/octet-stream' } }); }
      catch (e) { await db.prepare('delete from estudio_archivos where file = ?').bind(rel).run(); throw e; }
      await subirRev(db);
      return item;
    }
    name = `${base}-${n++}`; // tomado (ya hay uno con ese nombre, aunque sea en la papelera)
    if (n > 60) throw new Error('no pude encontrar un nombre libre para el archivo');
  }
}

/* ---------- leer ---------- */
const limpio = (id) => String(id || '').replace(/\\/g, '/');
export const validoId = (id) => { const rel = limpio(id); return FILE_RE.test(rel) && !rel.includes('..') ? rel : null; };
/** ¿Está en la galería (no en la papelera)? → true/false */
export async function existe(db, id) { const rel = validoId(id); if (!rel) return false; return !!(await db.prepare('select 1 x from estudio_archivos where file = ? and papelera_at is null').bind(rel).first()); }
/** De una lista de ids, los que están en la galería. */
export async function cuales(db, ids) {
  const rels = [...new Set((ids || []).map(validoId).filter(Boolean))].slice(0, 200), out = new Set();
  for (let i = 0; i < rels.length; i += 50) {
    const lote = rels.slice(i, i + 50);
    const { results } = await db.prepare(`select file from estudio_archivos where papelera_at is null and file in (${lote.map(() => '?').join(',')})`).bind(...lote).all();
    for (const r of results) out.add(r.file);
  }
  return out;
}
export async function item(db, id) { const rel = validoId(id); if (!rel) return null; const r = await db.prepare('select json from estudio_archivos where file = ? and papelera_at is null').bind(rel).first(); return r ? parse(r) : null; }
export async function update(db, id, patch) {
  const rel = validoId(id); if (!rel) return null;
  const r = await db.prepare('select json from estudio_archivos where file = ? and papelera_at is null').bind(rel).first(); if (!r) return null;
  const it = { ...parse(r), ...patch };
  await db.prepare('update estudio_archivos set json = ? where file = ?').bind(JSON.stringify(it), rel).run();
  await subirRev(db);
  return it;
}
const USES = ['ref', 'pieza', 'calendario'];
export async function markUsed(db, file, how) { if (!USES.includes(how)) return null; const it = await item(db, file); if (!it) return null; return update(db, file, { used: [...new Set([...(Array.isArray(it.used) ? it.used : []), how])] }); }
export const wasUsed = (it) => !!it && (it.fav === true || (Array.isArray(it.used) && it.used.length > 0));

/* ---------- carpetas: etiquetas del dueño, no directorios; el archivo no se mueve ---------- */
async function leerCarpetas(db) { const { valor } = await leerDoc(db, CARPETAS, { folders: [] }); return Array.isArray(valor.folders) ? valor.folders.filter((f) => f && /^c[a-z0-9]{4,20}$/.test(f.id) && typeof f.name === 'string') : []; }
export const carpetas = async (db, items, fl) => { fl = fl || await leerCarpetas(db); const count = new Map(); for (const it of items || []) if (it.folder) count.set(it.folder, (count.get(it.folder) || 0) + 1); return fl.map((f) => ({ ...f, n: count.get(f.id) || 0 })); };
export async function folderOf(db, id) { return (await leerCarpetas(db)).find((f) => f.id === id) || null; }
async function todas(db) { const { results } = await db.prepare('select json from estudio_archivos where papelera_at is null order by at desc, file desc').all(); return results.map(parse); }
export async function resumenCarpetas(db) { return carpetas(db, await todas(db)); }
export async function addFolder(db, name) {
  const nm = cleanName(name); if (!nm) throw new Error('ponle un nombre a la carpeta');
  let nueva;
  await mutarDoc(db, CARPETAS, { folders: [] }, (d) => {
    const l = d.folders || [];
    if (l.some((f) => f.name.toLowerCase() === nm.toLowerCase())) throw new Error(`ya hay una carpeta «${nm}»`);
    if (l.length >= 200) throw new Error('como mucho 200 carpetas');
    nueva = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: nm, at: Date.now() };
    return { folders: [...l, nueva] };
  });
  await subirRev(db); return nueva;
}
export async function renameFolder(db, id, name) {
  const nm = cleanName(name); if (!nm) throw new Error('ponle un nombre a la carpeta');
  let hecha;
  await mutarDoc(db, CARPETAS, { folders: [] }, (d) => {
    const l = d.folders || [], f = l.find((x) => x.id === id); if (!f) throw new Error('esa carpeta ya no existe');
    if (l.some((x) => x.id !== id && x.name.toLowerCase() === nm.toLowerCase())) throw new Error(`ya hay una carpeta «${nm}»`);
    f.name = nm; hecha = { ...f }; return { folders: l };
  });
  await subirRev(db); return hecha;
}
/** La carpeta se va; sus archivos se quedan, sin carpeta. → cuántos tenía */
export async function removeFolder(db, id) {
  let existia = false;
  await mutarDoc(db, CARPETAS, { folders: [] }, (d) => { const l = d.folders || []; existia = l.some((f) => f.id === id); return { folders: l.filter((f) => f.id !== id) }; });
  if (!existia) throw new Error('esa carpeta ya no existe');
  const r = await db.prepare(`update estudio_archivos set json = json_set(json, '$.folder', null) where json_extract(json, '$.folder') = ?`).bind(id).run();
  await subirRev(db); return r.meta?.changes ?? 0;
}
export async function moveTo(db, files, folder) {
  if (folder != null && !(await folderOf(db, folder))) throw new Error('esa carpeta ya no existe');
  let n = 0;
  for (const id of (Array.isArray(files) ? files : []).slice(0, 2000)) if (typeof id === 'string') {
    const rel = validoId(id); if (!rel) continue;
    const r = await db.prepare(`update estudio_archivos set json = json_set(json, '$.folder', ?) where file = ? and papelera_at is null`).bind(folder || null, rel).run();
    if (r.meta?.changes) n++;
  }
  if (n) await subirRev(db);
  return n;
}

/* ---------- consulta paginada (como media/galeria.mjs → query) ---------- */
export async function query(db, { q = '', filter = 'all', folder = 'all', kind = null, before = null, offset = 0, n = 120, upto = null, extra = null, exclude = null } = {}) {
  const items = await todas(db), fl = await leerCarpetas(db), ids = new Set(fl.map((f) => f.id));
  const skipF = new Set(Array.isArray(exclude) ? exclude.slice(0, 50).map(String) : []), m0 = GF.matcher({ q, filter, folder, kind }, ids, extra);
  const ok = skipF.size ? (it) => !skipF.has(it.file) && m0(it) : m0, cur = GF.parseCursor(before);
  const size = Math.max(0, Math.min(PAGE_MAX, Number.isFinite(+n) ? Math.floor(+n) : 120));
  let skip = Math.max(0, Math.floor(+offset || 0)), total = 0, after = 0, hit = -1, far = null, farAt = -1; const page = [];
  for (const it of items) {
    if (!ok(it)) continue; total++;
    if (cur && GF.cmp(it, cur) <= 0) continue;
    after++; if (skip) { skip--; continue; }
    if (page.length < size || (upto && hit < 0 && page.length < PAGE_MAX)) { if (it.file === upto) hit = page.length; page.push(it); }
    else if (upto && hit < 0 && !far && it.file === upto) { far = it; farAt = after - 1; }
  }
  if (upto && hit < 0) page.length = Math.min(page.length, size);
  const off = Math.max(0, Math.floor(+offset || 0)), more = after - off - page.length > 0;
  return { items: page, total, next: more && page.length ? GF.cursorOf(page[page.length - 1]) : null, counts: GF.counts(items, ids), folders: await carpetas(db, items, fl), rev: await rev(db), ...(far ? { hit: far, hitAt: farAt } : {}) };
}

/* ---------- papelera: 30 días; los archivos se quedan donde están en R2 y su ficha lleva cuándo se tiraron ---------- */
const binNames = (it, stamp) => { const base = it.file.split('/').pop(); return [`${stamp}-${base}`, `${stamp}-${base.replace(/\.[^.]+$/, '')}.json`]; };
export async function trash(db, id) {
  const rel = validoId(id); if (!rel) return null;
  const stamp = Date.now();
  const r = await db.prepare('update estudio_archivos set papelera_at = ? where file = ? and papelera_at is null').bind(stamp, rel).run();
  if (!r.meta?.changes) return null;
  await subirRev(db);
  return { id: rel, bin: binNames({ file: rel }, stamp) };
}
export async function restore(db, { id, bin } = {}) {
  const rel = validoId(id);
  if (!rel || !Array.isArray(bin) || !bin.length || bin.length > 2) return false;
  const stem = rel.split('/').pop().replace(/\.[^.]+$/, '');
  let stamp = null;
  for (const nm of bin) {
    const m = BIN_RE.exec(String(nm)); if (!m || String(nm).includes('..')) return false;
    if (m[2].replace(/\.[^.]+$/, '') !== stem) return false; // solo el archivo y su ficha, de vuelta a su propio nombre
    if (stamp != null && stamp !== +m[1]) return false; stamp = +m[1];
  }
  const r = await db.prepare('update estudio_archivos set papelera_at = null where file = ? and papelera_at = ?').bind(rel, stamp).run();
  if (!r.meta?.changes) return false;
  await subirRev(db); return true;
}
export async function trashList(db, ahora = Date.now()) {
  const { results } = await db.prepare('select json, papelera_at from estudio_archivos where papelera_at is not null order by papelera_at desc').all();
  return results.map((r) => {
    const it = parse(r), stamp = r.papelera_at, [nm, rec] = binNames(it, stamp);
    return { id: it.file, bin: [nm, rec], name: nm, prompt: it.prompt || it.file.split('/').pop(), kind: it.kind, at: it.at || null, trashedAt: stamp,
      daysLeft: Math.max(0, Math.ceil((stamp + BIN_DAYS * 864e5 - ahora) / 864e5)), modelName: it.modelName || it.model || '', upload: !!it.upload };
  });
}
/** La clave en R2 de un archivo de la papelera (solo de la papelera), para ver su miniatura. */
export async function trashFile(db, name) {
  const nm = String(name || ''); const m = BIN_RE.exec(nm);
  if (!m || nm.includes('..') || /[\\/]/.test(nm) || /\.json$/i.test(nm)) return null;
  const { results } = await db.prepare('select file from estudio_archivos where papelera_at = ?').bind(+m[1]).all();
  return results.find((r) => r.file.split('/').pop() === m[2])?.file || null;
}
/** Se van para siempre: estos de la papelera (su archivo y su ficha), o todo con { all: true }. → cuántos archivos se fueron (el archivo y su ficha cuentan cada uno, como en la oficina local) */
export async function purge(env, db, { bin, all, vencidos } = {}) {
  const { results } = await db.prepare('select file, papelera_at from estudio_archivos where papelera_at is not null').all();
  const nombres = new Set((all || vencidos ? [] : Array.isArray(bin) ? bin : []).map(String));
  let n = 0;
  for (const r of results) {
    const [nm, rec] = binNames({ file: r.file }, r.papelera_at);
    const va = all || (vencidos && r.papelera_at < Date.now() - BIN_DAYS * 864e5) || nombres.has(nm) || nombres.has(rec);
    if (!va) continue;
    await env.MEDIA.delete(r.file); await db.prepare('delete from estudio_archivos where file = ? and papelera_at = ?').bind(r.file, r.papelera_at).run();
    n += 2;
  }
  return n;
}

/* ---------- subidas del dueño ---------- */
export const TOPE_SUBIDA = { imagen: 12 * 1024 * 1024, otro: 25 * 1024 * 1024 };
/** Una foto, un video o un audio del dueño (data URL en base64). Se reconoce por sus primeros bytes, nunca por lo que diga. */
export async function upload(env, db, { name, data, folder } = {}) {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(data || ''));
  if (!m) throw new Error('el archivo no llegó bien');
  const ext = UPLOAD[m[1].toLowerCase()]; if (!ext) throw new Error('solo PNG, JPG, WEBP, MP4, WEBM, MP3, WAV, FLAC o M4A');
  const buf = Buffer.from(m[2], 'base64');
  if (!MAGIC[ext](buf)) throw new Error('el archivo no es lo que dice ser');
  const audio = AUDIO_EXT.includes(ext), vid = ext === 'mp4' || ext === 'webm';
  if (buf.length > (vid || audio ? TOPE_SUBIDA.otro : TOPE_SUBIDA.imagen)) throw new Error(vid ? 'el video pasa de 25 MB' : audio ? 'el audio pasa de 25 MB' : 'la imagen pasa de 12 MB');
  const title = String(name || 'subida').replace(/\.[^.]+$/, '').slice(0, 80) || 'subida';
  return store(env, db, buf, ext, { prompt: title, provider: 'subida', model: '', by: 'you', upload: true, agent: null, task: null, ...(folder && (await folderOf(db, folder)) ? { folder } : {}) });
}
/** Un archivo ya hecho (bytes crudos, sin base64) que entra a la galería con su clave: la migración desde la computadora del dueño. Conserva clave y ficha. */
export async function importar(env, db, clave, buf, ficha) {
  const rel = validoId(clave); if (!rel) throw new Error('clave de archivo no válida');
  const ext = rel.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
  if (sniffExt(buf, { svg: true }) !== (ext === 'jpeg' ? 'jpg' : ext)) throw new Error('el archivo no es lo que dice su extensión');
  const f = { ...(ficha && typeof ficha === 'object' && !Array.isArray(ficha) ? ficha : {}), id: rel, file: rel, ext, kind: kindOfExt(ext) };
  if (!Number.isFinite(+f.at)) f.at = Date.now();
  await env.MEDIA.put(rel, buf, { httpMetadata: { contentType: MEDIA_MIME[ext] || 'application/octet-stream' } });
  await db.prepare(`insert into estudio_archivos (file, at, kind, json, papelera_at) values (?,?,?,?,null)
    on conflict (file) do update set at=excluded.at, kind=excluded.kind, json=excluded.json`).bind(rel, +f.at, f.kind, JSON.stringify(f)).run();
  await subirRev(db);
  return f;
}

/** Varios archivos en un .zip (guardados sin comprimir). */
export async function zip(env, db, ids) {
  const files = [], seen = new Set(); let total = 0;
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, 200)) {
    if (!(await existe(db, id))) continue;
    const data = await bytesDe(env, validoId(id)); if (!data) continue;
    if (total + data.length > 100 * 1024 * 1024) break; total += data.length; // 100 MB: la memoria de un Worker es de 128 MB
    let name = validoId(id).split('/').pop(); const base = name; for (let n = 2; seen.has(name); n++) name = base.replace(/(\.[^.]+)$/, `-${n}$1`); seen.add(name);
    files.push({ name, data });
  }
  return zipFiles(files, new Date());
}

/** Los archivos de la galería (copias) para quien los necesita enteros: carpetas, recuentos. */
export const todasLasFichas = todas;
