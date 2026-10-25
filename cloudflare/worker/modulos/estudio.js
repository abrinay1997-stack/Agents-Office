// El Estudio (imagen, video, voz y música) en la nube — fase 8a: el núcleo. Las mismas rutas y las mismas formas que la oficina
// local (serve.mjs), con la galería en R2 + D1 y los trabajos por pasos en el cron. Ver cloudflare/worker/lib/estudio/.
//
// Lo que SÍ está: el catálogo y el estado de los motores (según los secretos del Worker), la galería (listar, subir, carpetas,
// mover, favoritos y «usado», papelera de 30 días, recuperar, vaciar, zip, servir cada archivo), los trabajos (pedir, estado, esperar,
// cancelar, reintentar, olvidar, editar una imagen), los topes del día y del mes, «mejorar el prompt» y las voces propias de MiniMax.
// Lo que NO está (contesta 501 en español): el banco de presets, los lotes, las plantillas, «Mandar a un departamento» (tareas),
// entender un video o un audio, y todo lo que dependa de `sharp` (los retoques locales y la QA): no existe en un Worker.
import { json, error, prohibido } from '../lib/respuesta.js';
import { agentes } from '../lib/agentes.js';
import { texto as textoIA } from '../lib/ia.js';
import * as catalogo from '../../../media/catalogo.mjs';
import { MEDIA_MIME, sniffExt } from '../../../media/galeria-core.mjs';
import * as galeria from '../lib/estudio/galeria.js';
import * as trabajos from '../lib/estudio/trabajos.js';
import * as voces from '../lib/estudio/voces.js';
import { prepararEstudio, guardarConfig, validarConfig, leerConfig, motoresEncendidos } from '../lib/estudio/entorno.js';

export const nombre = 'estudio';
export const grupos = ['media', 'voces'];

const NO_ESTA = {
  presets: 'El banco de presets del Estudio todavía no está en la nube: sigue en la oficina de tu computadora.',
  lotes: 'Los lotes del Estudio todavía no están en la nube: siguen en la oficina de tu computadora.',
  plantillas: 'Las plantillas del Estudio todavía no están en la nube.',
  understand: 'Entender un video o un audio todavía no está en la nube.',
  'to-dept': 'Mandar una imagen a un departamento necesita las tareas, que todavía no están en la nube.',
};
const noEsta = (m) => json({ error: m, pendiente: true }, 501);
const MAX_JSON_SUBIDA = 24 * 1024 * 1024, MAX_ARCHIVO_PUT = 60 * 1024 * 1024;

/** Cómo se activa un motor EN LA NUBE (la oficina local dice «setx … en Windows»). */
const comoActivar = (e) => (e.env ? `Guarda ${e.env} como secreto del repositorio en GitHub (Settings → Secrets → Actions) y vuelve a desplegar.` : null);
const motoresNube = () => catalogo.engines().map((e) => ({ ...e, how: comoActivar(e) }));
const minimaxOn = () => catalogo.engines().some((e) => e.id === 'minimax' && e.on);
const porDefecto = () => Object.fromEntries(catalogo.KINDS.map((k) => [k, catalogo.defaultModel(k)]));
const NOMBRE_AGENTE = (id) => agentes().find((a) => a.id === id)?.name || '';

/** Dónde están las piezas de Contenido que usan un archivo (la papelera no se lleva lo que una pieza usa): `contenido_piezas`, las que no están en su papelera.
 *  Antes miraba una colección `piezas` que no existe y nada estaba nunca «en uso»: una imagen programada se iba a la papelera y a los 30 días de R2.
 *  Falla CERRADO: si no se puede comprobar, la función lanza y el archivo NO se borra (nunca devuelve [] por un error). */
async function usosEnContenido(db, file) {
  const patron = '%' + String(file).replace(/[\\%_]/g, (c) => '\\' + c) + '%'; // el nombre tal cual: un «_» o un «%» del archivo no son comodines
  const { results } = await db.prepare(`select id, json from contenido_piezas where borrada = 0 and json like ? escape '\\' limit 50`).bind(patron).all();
  const usos = [];
  for (const r of results) {
    let v = null; try { v = JSON.parse(r.json); } catch { usos.push({ id: r.id, titulo: '' }); continue; } // una pieza ilegible cuenta igual
    if ((v.medios || []).includes(file) || (v.historias || []).includes(file)) usos.push({ id: r.id, titulo: v.titulo || '' });
  }
  return usos.slice(0, 10);
}

/* ---------- servir un archivo (el módulo de rutas lo llama para /media/…; ver docs/cloudflare.md) ---------- */
export async function servirMedia({ req, env, db, ruta }) {
  const rel = galeria.validoId((() => { try { return decodeURIComponent(ruta.slice(7)); } catch { return ''; } })());
  if (!rel || !(await galeria.existe(db, rel))) return error('no such file', 404);
  return entregar(env, req, rel);
}
async function entregar(env, req, clave) {
  const ext = clave.split('.').pop().toLowerCase(), type = MEDIA_MIME[ext] || 'application/octet-stream';
  const head = await env.MEDIA.head(clave); if (!head) return error('no such file', 404);
  const size = head.size;
  const h = { 'content-type': type, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes', ...(ext === 'svg' ? { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}) };
  const rg = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (rg && size && (rg[1] !== '' || rg[2] !== '')) {
    const start = rg[1] === '' ? Math.max(0, size - (+rg[2] || 0)) : +rg[1], end = rg[1] !== '' && rg[2] !== '' ? Math.min(+rg[2], size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    const o = await env.MEDIA.get(clave, { range: { offset: start, length: end - start + 1 } }); if (!o) return error('no such file', 404);
    return new Response(req.method === 'HEAD' ? null : o.body, { status: 206, headers: { ...h, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
  }
  const o = await env.MEDIA.get(clave); if (!o) return error('no such file', 404);
  return new Response(req.method === 'HEAD' ? null : o.body, { status: 200, headers: { ...h, 'content-length': String(size) } });
}

const estadoDe = (e) => (e && Number.isInteger(e.estado) ? e.estado : e?.code === 'no-edit-engine' ? 409 : 400);

export async function manejar(ctx) {
  const { req, env, db, usuario, url, ruta, cuerpo } = ctx;
  const esMedia = ruta.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD');
  const esApi = ruta === '/api/media' || ruta.startsWith('/api/media/') || ruta === '/api/voces' || ruta.startsWith('/api/voces/');
  if (!esMedia && !esApi) return null;
  const metodo = req.method, lee = metodo === 'GET' || metodo === 'HEAD';
  if (!lee && usuario.rol === 'lectura') return prohibido('Tu rol solo puede mirar el Estudio.');
  if (esMedia) return servirMedia({ req, env, db, ruta });
  await prepararEstudio(env, db);
  const sp = url.searchParams;
  const aviso = (e) => json({ error: String(e?.message || e) }, estadoDe(e));
  let m;

  try {
    /* ---- lo que todavía no está ---- */
    for (const [k, msg] of Object.entries(NO_ESTA)) if (ruta === `/api/media/${k}` || ruta.startsWith(`/api/media/${k}/`)) return noEsta(msg);

    /* ---- la galería + el catálogo ---- */
    if (ruta === '/api/media' && metodo === 'GET') {
      const qs = (sp.get('q') || '').slice(0, 200), paged = ['n', 'before', 'offset', 'q', 'filter', 'folder', 'kind', 'upto', 'not'].some((k) => sp.has(k));
      const extra = qs.trim() ? (it) => (it.by === 'agent' ? NOMBRE_AGENTE(it.agent) : it.by === 'dimitri' ? 'Dimitri' : '') : null;
      const pg = await galeria.query(db, { q: qs, filter: sp.get('filter') || 'all', folder: sp.get('folder') || 'all', kind: sp.get('kind') || null, before: sp.get('before'), offset: sp.get('offset'), n: paged ? (sp.has('n') ? sp.get('n') : 120) : 600, upto: sp.get('upto'), extra, exclude: sp.getAll('not') });
      const page = { folders: pg.folders, items: pg.items, total: pg.total, next: pg.next, counts: pg.counts, rev: pg.rev, ...(pg.hit ? { hit: pg.hit, hitAt: pg.hitAt } : {}) };
      if (paged && sp.get('catalog') !== '1') return json(page);
      const cfg = await leerConfig(db);
      return json({ ...page, budget: await trabajos.budget(env, db), engines: motoresNube(), models: catalogo.models(), jobs: await trabajos.jobs(db), providers: catalogo.providers().map((p) => ({ ...p, how: comoActivar(p) })), default: porDefecto(), editModels: catalogo.editModels(), departments: Array.isArray(cfg.departments) ? cfg.departments : ['marketing', 'delivery', 'sales', 'ops'], ...(minimaxOn() ? { voices: await voces.summary(db) } : {}) });
    }
    if ((ruta === '/api/media/providers' || ruta === '/api/media/models') && metodo === 'GET') {
      const cfg = await leerConfig(db);
      return json({ providers: catalogo.providers().map((p) => ({ ...p, how: comoActivar(p) })), engines: motoresNube(), models: catalogo.models(), budget: await trabajos.budget(env, db), departments: Array.isArray(cfg.departments) ? cfg.departments : ['marketing', 'delivery', 'sales', 'ops'], default: porDefecto(), ...(minimaxOn() ? { voices: await voces.summary(db) } : {}) });
    }
    /* los topes del Estudio de la nube (en la oficina local son Ajustes → Estudio) */
    if (ruta === '/api/media/limites') {
      if (metodo === 'GET') return json({ limites: await leerConfig(db), budget: await trabajos.budget(env, db) });
      if (metodo === 'PUT') {
        if (usuario.rol !== 'admin') return prohibido('Solo un administrador cambia los topes del Estudio.');
        const v = validarConfig(await cuerpo(req)); if (!v.ok) return error(v.error, 422);
        const l = await guardarConfig(db, v.valor); await prepararEstudio(env, db);
        return json({ limites: l, budget: await trabajos.budget(env, db) });
      }
    }

    /* ---- carpetas ---- */
    if (ruta === '/api/media/folders' && metodo === 'POST') {
      const b = (await cuerpo(req)) || {};
      try { const f = await galeria.addFolder(db, b.name); const moved = Array.isArray(b.files) && b.files.length ? await galeria.moveTo(db, b.files, f.id) : 0; return json({ folder: f, moved, folders: await galeria.resumenCarpetas(db) }); }
      catch (e) { return error(e.message, 400); }
    }
    if ((m = ruta.match(/^\/api\/media\/folders\/(c[a-z0-9]{4,20})$/))) {
      if (metodo === 'PATCH') { const b = (await cuerpo(req)) || {}; try { return json({ folder: await galeria.renameFolder(db, m[1], b.name), folders: await galeria.resumenCarpetas(db) }); } catch (e) { return error(e.message, 400); } }
      if (metodo === 'DELETE') { try { const n = await galeria.removeFolder(db, m[1]); return json({ ok: true, freed: n, folders: await galeria.resumenCarpetas(db) }); } catch (e) { return error(e.message, 404); } }
    }
    if (ruta === '/api/media/move' && metodo === 'POST') {
      const b = (await cuerpo(req)) || {};
      try { const n = await galeria.moveTo(db, b.files, b.folder || null); return json({ ok: true, moved: n, folders: await galeria.resumenCarpetas(db) }); } catch (e) { return error(e.message, 400); }
    }

    /* ---- subir ---- */
    if (ruta === '/api/media/upload' && metodo === 'POST') {
      if (+req.headers.get('content-length') > MAX_JSON_SUBIDA) return error('el archivo es demasiado grande para subirlo así (máx. unos 17 MB de archivo)', 413);
      const b = (await cuerpo(req)) || {};
      try { return json({ item: await galeria.upload(env, db, b) }); } catch (e) { return error(e.message, 400); }
    }
    // la migración desde la computadora del dueño: los bytes de un archivo con su clave de siempre, solo administrador (scripts/migrar/estudio.mjs)
    if ((m = ruta.match(/^\/api\/media\/archivo\/(.+)$/)) && metodo === 'PUT') {
      if (usuario.rol !== 'admin') return prohibido('Solo un administrador sube archivos del Estudio.');
      if (+req.headers.get('content-length') > MAX_ARCHIVO_PUT) return error('el archivo pasa de 60 MB: es más de lo que un Worker puede recibir de una vez', 413);
      let clave; try { clave = decodeURIComponent(m[1]); } catch { return error('clave no válida', 400); }
      const buf = Buffer.from(await req.arrayBuffer());
      const ficha = (await db.prepare(`select json from filas where coleccion = 'estudio-fichas' and id = ?`).bind(clave).first());
      try { const f = await galeria.importar(env, db, clave, buf, ficha ? JSON.parse(ficha.json) : null); return json({ ok: true, file: f.file, kind: f.kind }); } catch (e) { return error(e.message, 422); }
    }

    /* ---- papelera ---- */
    if (ruta === '/api/media/trash' && metodo === 'GET') return json({ items: await galeria.trashList(db), days: galeria.BIN_DAYS });
    if (ruta === '/api/media/trash/file' && metodo === 'GET') {
      const k = await galeria.trashFile(db, sp.get('n')); if (!k) return error('no está en la papelera', 404);
      const r = await entregar(env, req, k); const h = new Headers(r.headers); h.set('cache-control', 'no-store'); return new Response(r.body, { status: r.status, headers: h });
    }
    if (ruta === '/api/media/trash/purge' && metodo === 'POST') {
      const b = (await cuerpo(req)) || {};
      if (b.all && usuario.rol !== 'admin') return prohibido('Solo un administrador vacía toda la papelera.');
      return json({ ok: true, removed: await galeria.purge(env, db, { bin: b.bin, all: !!b.all }) });
    }
    if (ruta === '/api/media/restore' && metodo === 'POST') {
      const b = (await cuerpo(req)) || {};
      return (await galeria.restore(db, b)) ? json({ ok: true }) : error('no se pudo recuperar (ya existe uno con ese nombre o se vació la papelera)', 409);
    }
    if (ruta === '/api/media/zip' && metodo === 'POST') {
      const b = (await cuerpo(req)) || {}, z = await galeria.zip(env, db, b.ids);
      if (z.demasiado) return error('Son demasiados archivos juntos para un solo .zip (más de 40 MB): descarga menos a la vez.', 413);
      if (!z.count) return error('nada que descargar', 404);
      return new Response(z.buf, { status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="estudio-${galeria.diaLocal(Date.now(), galeria.ZONA(env))}.zip"`, 'content-length': String(z.buf.length), 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' } });
    }

    /* ---- un archivo ---- */
    if ((m = ruta.match(/^\/api\/media\/item\/(.+)$/))) {
      let id; try { id = decodeURIComponent(m[1]); } catch { return error('no such file', 404); }
      if (metodo === 'GET') { const it = await galeria.item(db, id); return it ? json(it) : error('no such file', 404); }
      if (metodo === 'PATCH') {
        const b = (await cuerpo(req)) || {};
        if (b.used !== undefined && !['ref', 'pieza', 'calendario'].includes(b.used)) return error('used: ref, pieza o calendario', 400);
        let it = await galeria.update(db, id, { ...(typeof b.fav === 'boolean' ? { fav: b.fav } : {}) }); if (!it) return error('no such file', 404);
        if (b.used) it = (await galeria.markUsed(db, id, b.used)) || it;
        return json(it);
      }
      if (metodo === 'DELETE') {
        let usos; try { usos = await usosEnContenido(db, galeria.validoId(id) || id); } catch { return error('No pude comprobar si una pieza de Contenido usa este archivo: no lo borro. Inténtalo de nuevo en un momento.', 503); }
        if (usos.length) return json({ error: `Este archivo está en ${usos.length === 1 ? 'una pieza' : usos.length + ' piezas'} de Contenido (${usos.slice(0, 3).map((u) => '«' + (u.titulo || u.id) + '»').join(', ')}): quítalo de ahí primero`, piezas: usos }, 409);
        const t = await galeria.trash(db, id); return t ? json({ ok: true, undo: t }) : error('no such file', 404);
      }
    }

    /* ---- trabajos ---- */
    if (ruta === '/api/media/jobs' && metodo === 'GET') {
      await trabajos.empujar(env, db);
      return json({ jobs: await trabajos.jobs(db, { task: sp.get('task') || undefined, active: sp.get('active') === '1' }), budget: await trabajos.budget(env, db) });
    }
    if (ruta === '/api/media/jobs' && metodo === 'POST') {
      const b = (await cuerpo(req)) || {};
      const j = await trabajos.pedir(env, db, b, { usuario });
      const espera = Math.min(110000, Math.max(0, +b.wait || 0));
      return json({ job: espera ? await trabajos.wait(env, db, j.id, espera) : (j.engine === 'prueba' ? ((await trabajos.avanzar(env, db, j.id))?.job || j) : j), budget: await trabajos.budget(env, db) });
    }
    if (ruta === '/api/media/generate' && metodo === 'POST') { // la V1, para scripts: pedir y esperar
      const b = (await cuerpo(req)) || {};
      const j = await trabajos.pedir(env, db, b, { usuario }), hecho = await trabajos.wait(env, db, j.id, 100_000);
      if (hecho.state === 'failed') return error(hecho.error || 'falló', 400);
      if (hecho.state !== 'done') return json({ error: 'sigue en marcha: consulta /api/media/jobs/' + hecho.id, job: hecho }, 202);
      const items = []; for (const f of hecho.items) { const it = await galeria.item(db, f); if (it) items.push(it); }
      return json({ items, cost: hecho.cost, budget: await trabajos.budget(env, db), job: hecho });
    }
    if (ruta === '/api/media/edit' && metodo === 'POST') {
      const b = (await cuerpo(req)) || {};
      try {
        const j = await trabajos.pedirEdicion(env, db, { file: b.file, instruction: b.instruction, model: typeof b.model === 'string' ? b.model : undefined }, { usuario });
        const espera = Math.min(110000, Math.max(0, +b.wait || 0));
        return json({ job: espera ? await trabajos.wait(env, db, j.id, espera) : j, budget: await trabajos.budget(env, db) });
      } catch (e) { return e.code === 'no-edit-engine' ? json({ error: e.message, engines: e.engines.map((x) => ({ ...x, how: comoActivar({ env: catalogo.ENGINES[x.id]?.env }) })) }, 409) : aviso(e); }
    }
    if ((m = ruta.match(/^\/api\/media\/jobs\/([a-z0-9]+)(?:\/(retry|cancel))?$/))) {
      const id = m[1];
      if (metodo === 'GET' && !m[2]) {
        const w = Math.min(110000, Math.max(0, +sp.get('wait') || 0)); const j = w ? await trabajos.wait(env, db, id, w) : (await trabajos.empujar(env, db), await trabajos.job(db, id));
        return j ? json({ job: j }) : error('no such job', 404);
      }
      if (metodo === 'POST' && m[2] === 'retry') { const j = await trabajos.retry(env, db, id, { usuario }); return j ? json({ job: j }) : error('no such job', 404); }
      if (metodo === 'POST' && m[2] === 'cancel') { const j = await trabajos.cancel(env, db, id); return j ? json({ job: j }) : error('no such job', 404); }
      if (metodo === 'DELETE' && !m[2]) return (await trabajos.forget(db, id)) ? json({ ok: true }) : error('ese trabajo sigue en marcha', 409);
    }

    /* ---- mejorar la idea (una llamada de texto, sin herramientas) ---- */
    if (ruta === '/api/media/enhance' && metodo === 'POST') {
      const { prompt, kind, lang } = (await cuerpo(req)) || {}; const en = lang !== 'es';
      const idea = String(prompt || '').trim(); if (!idea) return error('escribe primero la idea', 400); if (idea.length > 3000) return error('la idea es muy larga', 400);
      const sys = 'Eres director de arte de PanaClaw. Convierte la idea del dueño en UN prompt de producción para un motor de ' + (kind === 'video' ? 'VIDEO: sujeto, acción, movimiento de cámara, ritmo, luz, estilo, sonido si aplica' : 'IMAGEN: sujeto, composición y encuadre, lente, luz, paleta, estilo, fondo') + '. ' +
        'Conserva todo lo que pidió (marca, colores, texto exacto entre comillas si lo pidió); no inventes texto, logos ni personas que no pidió. ' +
        (en ? 'Escríbelo en inglés (los motores lo entienden mejor), una sola línea, máximo 90 palabras. Devuelve SOLO un objeto JSON, sin bloque de código: {"prompt":"<el prompt en inglés>","es":"<el mismo prompt traducido al español, para que el dueño lo lea>"}.'
          : 'Escríbelo en español, una sola línea, máximo 90 palabras. Devuelve solo el prompt, sin comillas ni explicación.');
      const limpio = (x) => String(x || '').trim().replace(/^["'`]+|["'`]+$/g, '').split('\n').filter(Boolean).join(' ').slice(0, 1500);
      try {
        const raw = (await textoIA(env, { sistema: sys, usuario: idea, maxTokens: 900 })).texto;
        let out = { prompt: limpio(raw), es: '' };
        if (en) { try { const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); if (j && j.prompt) out = { prompt: limpio(j.prompt), es: limpio(j.es) }; } catch { /* texto plano */ } }
        return json({ ...out, lang: en ? 'en' : 'es' });
      } catch (e) { return error('no pude mejorarlo ahora: ' + e.message, 502); }
    }

    /* ---- las voces propias de MiniMax ---- */
    if (ruta === '/api/voces' || ruta.startsWith('/api/voces/')) {
      if (!minimaxOn()) return json({ error: 'MiniMax no tiene su llave en la nube: guarda MINIMAX_API_KEY como secreto del repositorio en GitHub (Settings → Secrets → Actions) y vuelve a desplegar.', how: comoActivar({ env: 'MINIMAX_API_KEY' }) }, 409);
      if (ruta === '/api/voces' && metodo === 'GET') return json({ voices: await voces.list(db), system: await voces.systemVoices() });
      const gasta = (ruta === '/api/voces/design' || ruta === '/api/voces/clone') && metodo === 'POST';
      if (gasta && usuario.rol !== 'admin') return prohibido('Solo un administrador diseña o clona voces (cuestan dinero).');
      const apunta = (modelo, usd) => db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'estudio', usuario.email, JSON.stringify({ voz: modelo, usd: +usd.toFixed(4) })).run();
      if (ruta === '/api/voces/design' && metodo === 'POST') {
        const b = (await cuerpo(req)) || {};
        try { await trabajos.checkBudget(env, db, voces.PRICE.design + (String(b.previewText || '').trim().slice(0, 500).length || 60) * voces.PRICE.previewPerChar); } catch (e) { return error(e.message, 409); }
        const out = await voces.design(db, { name: b.name, prompt: b.prompt, previewText: b.previewText });
        const pagado = voces.PRICE.design + out.chars * voces.PRICE.previewPerChar; await apunta('voice_design', pagado); await trabajos.charge(env, db, pagado);
        return json({ voice: out.voice, preview: out.preview ? Buffer.from(out.preview).toString('base64') : null });
      }
      if (ruta === '/api/voces/clone' && metodo === 'POST') {
        if (+req.headers.get('content-length') > MAX_JSON_SUBIDA) return error('la grabación es demasiado grande para subirla así', 413);
        const b = (await cuerpo(req)) || {};
        try { await trabajos.checkBudget(env, db, voces.PRICE.clone); } catch (e) { return error(e.message, 409); }
        let audio, filename;
        if (typeof b.audio === 'string' && b.audio) {
          const rel = galeria.validoId(b.audio); if (!rel || !(await galeria.existe(db, rel))) return error('no encuentro esa grabación en el Estudio', 404);
          if (!/\.(mp3|wav|m4a)$/i.test(rel)) return error('la grabación debe ser mp3, m4a o wav', 400);
          audio = await galeria.leerBytes(env, rel); filename = rel.split('/').pop();
        } else if (typeof b.audioBase64 === 'string' && b.audioBase64) {
          audio = Buffer.from(b.audioBase64.replace(/^data:[^,]*,/, ''), 'base64'); filename = String(b.filename || 'muestra.mp3').replace(/[\\/]/g, '_').slice(0, 120);
        } else return error('falta la grabación: elige un audio de la galería o súbelo', 400);
        const grabada = typeof b.audio === 'string' && /^grabaci[oó]n de voz/i.test(String((await galeria.item(db, b.audio))?.prompt || ''));
        const out = await voces.clone(db, { name: b.name, voiceId: b.voiceId, audio, filename, consent: b.consent, recorded: grabada });
        await apunta('voice_clone', voces.PRICE.clone); await trabajos.charge(env, db, voces.PRICE.clone);
        return json(out);
      }
      if ((m = ruta.match(/^\/api\/voces\/([A-Za-z][A-Za-z0-9_-]{0,255})$/)) && metodo === 'DELETE') {
        if (usuario.rol !== 'admin') return prohibido('Solo un administrador borra voces.');
        const r = await voces.remove(db, m[1]); return r ? json(r) : error('no tienes una voz con ese voiceId', 404);
      }
      return error('no such route', 404);
    }
  } catch (e) {
    if (e instanceof trabajos.ErrorPedido) return json({ error: e.message }, e.estado);
    if (ruta === '/api/voces' || ruta.startsWith('/api/voces/')) return error(String(e?.message || e).replace(/[A-Za-z0-9_-]{28,}/g, '…').slice(0, 300), 400); // como la oficina local: lo de las voces se dice en palabras (los errores de MiniMax ya vienen en español)
    return error('El Estudio no pudo con esto ahora: ' + String(e?.message || e).replace(/[A-Za-z0-9_-]{28,}/g, '…').slice(0, 200), 500, e);
  }
  return null;
}

/** El reloj del Estudio (lo que en serve.mjs eran los setInterval): avanza los trabajos y vacía la papelera vencida. */
export async function cadaMinuto(env) {
  const db = env.DB;
  await prepararEstudio(env, db);
  await trabajos.cadaMinuto(env, db);
  const ahora = Date.now(), min = new Date(ahora).getUTCMinutes();
  if (min === 7) await galeria.purge(env, db, { vencidos: true }); // una vez por hora
}
export { motoresEncendidos, sniffExt };
