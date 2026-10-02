// Agents Office — el banco de presets del Estudio, lado servidor (integración F1, 1 oct 2026; docs/propuesta-banco-presets.md
// §4.3, §5, §6.4, §15 y §16). Junta la fábrica (presets/) con los presets del dueño (notas del Cerebro en Estudio/Presets/),
// compila un pedido con el mismo compilador puro que usa la página (src/presets-core.js) y lo aplica:
//   - todo local → un trabajo «local» del Estudio (sin IA, gratis, el original intacto);
//   - con IA     → un trabajo normal de media.submit (pasa por los topes del Estudio), con sus pasos locales y su QA después;
//   - con escenario 3D → la imagen guía de composición se dibuja aquí (escena3d-core.guiaPNG), se sube a la galería y va como
//     la última referencia, rotulada «LAYOUT GUIDE ONLY».
// compilar() nunca gasta; aplicar() es lo único que gasta, y solo lo llama la ruta POST /api/media/presets/apply (el clic del dueño).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { cargarFabrica } from './presets/fabrica.mjs';
import * as core from './src/presets-core.js';
import * as e3 from './src/escena3d-core.js';
import * as notas from './presets-notas.mjs';
import * as media from './media.mjs';
import { find as buscarEnGaleria } from './media/galeria.mjs'; // revisión F1: buscar sin copiar la galería (no es API de la fachada)
import * as L from './imagen-local.mjs';

const ID_RE = /^[a-z0-9-]{2,40}$/;
const arr = v => (Array.isArray(v) ? v : v == null ? [] : [v]);
const limpio = (s, n = 400) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n);
const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Las cifras de la empresa (cifras.json: [{ name, value }]) como objeto para «{cifras.precio}»: el nombre en minúsculas, sin
 *  tildes y con «_». Un precio nunca sale del preset. */
export function cifrasComoObjeto(items) {
  const o = {};
  for (const x of arr(items)) if (x && x.name != null && x.value != null && String(x.value).trim()) o[fold(x.name)] = String(x.value).trim();
  return o;
}

/** Limpia lo que manda la página: la pila, los parámetros, las entradas, la escena. Nada pasa sin forma conocida. */
export function pedidoLimpio(b = {}) {
  const pila = arr(b.pila).slice(0, 16).map(x => (typeof x === 'string' ? { id: x } : x)).filter(x => x && typeof x.id === 'string' && (ID_RE.test(x.id) || x.id === 'libre'))
    .map(x => (x.id === 'libre' ? { id: 'libre', texto: limpio(x.texto, 600) } : { id: x.id, ...(x.params && typeof x.params === 'object' && !Array.isArray(x.params) ? { params: x.params } : {}) }));
  const ids = v => arr(v).filter(x => typeof x === 'string' && x.length < 300).slice(0, 8);
  const E = b.entradas && typeof b.entradas === 'object' ? b.entradas : {};
  const referencias = arr(E.referencias).slice(0, 6).map(r => (typeof r === 'string' ? { id: r } : r)).filter(r => r && typeof r.id === 'string')
    .map(r => ({ id: r.id, ...(r.ejes && typeof r.ejes === 'object' ? { ejes: Object.fromEntries(core.EJES_REF.filter(k => r.ejes[k] != null).map(k => [k, Math.max(0, Math.min(3, Math.round(+r.ejes[k] || 0)))])) } : {}) }));
  const entradas = { foto: ids(E.foto ?? E.sujeto).slice(0, 1), referencias, ...(ids(E.lut).length ? { lut: ids(E.lut) } : {}) };
  const escena = b.escena && typeof b.escena === 'object' ? e3.normalizar(b.escena) : null;
  const params = b.params && typeof b.params === 'object' && !Array.isArray(b.params) ? b.params : {};
  return { pila, params, entradas, escena, idea: limpio(b.idea, 2000), producto: limpio(b.producto, 120), model: typeof b.model === 'string' && ID_RE.test(b.model) ? b.model : undefined,
    proporcion: typeof b.proporcion === 'string' && /^\d{1,2}(\.\d{1,2})?:\d{1,2}$/.test(b.proporcion) ? b.proporcion : undefined,
    n: Math.max(1, Math.min(4, +b.n || 1)), orden: b.orden === 'barato' ? 'barato' : undefined, folder: typeof b.folder === 'string' ? b.folder : undefined };
}

export function crearPresets({ brainPath, dataDir, cifras = () => [], onNota = () => {} } = {}) {
  let FAB = null, sharpOk = null;
  L.disponible().then(r => { sharpOk = !!r.ok; }).catch(() => { sharpOk = false; });
  const fab = () => (FAB ||= cargarFabrica());
  const carpeta = () => path.join(brainPath, ...notas.CARPETA.split('/'));
  const guias = new Map(); // hash de la escena → id de la guía ya subida a la galería
  // revisión F1: las guías que la caché ya entregó a otra petición. Una guía nueva solo va a la papelera si su submit falla
  // y nadie más la recibió mientras tanto (si no, el trabajo de la otra petición quedaría sin su guía).
  const entregadas = new Set();
  const canales = () => notas.conjuntoDeCanales(fab().canales); // las notas validan contra un Set de ids, no la lista de la fábrica

  /** Los presets del dueño: cada nota de <cerebro>/Estudio/Presets/*.md. Una nota rota se dice, no tumba el banco. */
  function propios() {
    const out = [], problemas = [], byId = new Map(fab().presets.map(p => [p.id, p]));
    let files = []; try { files = fs.readdirSync(carpeta()).filter(f => f.endsWith('.md')); } catch { return { propios: out, problemas }; }
    const vistos = new Map(); // id → archivo: dos notas con el mismo id («Catálogo web» y «Catalogo web») no se cargan las dos
    for (const f of files.sort()) {
      let md = ''; try { md = fs.readFileSync(path.join(carpeta(), f), 'utf8'); } catch { continue; }
      const r = notas.notaAPreset(md, { archivo: `${notas.CARPETA}/${f}`, byId, canales: canales() });
      if (!r.preset) { problemas.push(`${f}: ${r.problemas.join('; ')}`); continue; }
      if (vistos.has(r.preset.id)) { problemas.push(`${f}: tiene el mismo id (${r.preset.id}) que «${vistos.get(r.preset.id)}»; no se carga: renómbrala o cámbiale el id`); continue; }
      vistos.set(r.preset.id, f);
      if (r.problemas.length) problemas.push(`${f}: ${r.problemas.join('; ')}`);
      out.push(r.preset);
    }
    return { propios: out, problemas };
  }
  /** La fábrica y los del dueño en la forma del banco (un propio con el id de uno de fábrica lo tapa, §4.2). */
  function todos() {
    const { propios: ps, problemas } = propios();
    const byId = new Map(fab().presets.map(p => [p.id, p]));
    const banco = ps.map(p => notas.aPresetDeBanco(p, { byId, iconos: fab().iconos }));
    const tapados = new Set(banco.map(p => p.id));
    return { presets: [...fab().presets.filter(p => !tapados.has(p.id)), ...banco], propios: ps, problemas };
  }
  const contexto = () => {
    const models = media.models();
    return { models, caps: m => media.capsOf(m.id || m, { familias: fab().familias }), familias: fab().familias, tipos: fab().tipos, canales: fab().canales,
      cifras: cifrasComoObjeto(cifras()), capacidades: { local: sharpOk !== false }, escena3d: e3 };
  };

  /** Por qué un preset local no se puede hacer en esta versión (o '' si sí): su LUT de fábrica aún no está en presets/luts, o
   *  pide un archivo que el Estudio no sabe recibir (un .cube). Revisión F1: salían «gratis · en tu máquina» y el trabajo
   *  terminaba «done» con una copia idéntica. */
  function faltaLocal(p) {
    if (!p || p.ejecutor !== 'local') return '';
    for (const o of arr(p.local)) if (o && typeof o.archivo === 'string' && /\.cube$/i.test(o.archivo) && !fs.existsSync(path.join(L.DIR_LUTS, path.basename(o.archivo)))) return 'su LUT todavía no viene con la oficina';
    for (const en of arr(p.entradas)) if (en && (en.min || 0) > 0 && !['image', 'video', 'audio', 'music'].includes(en.medio)) return `el Estudio todavía no recibe ${en.medio === 'cube' ? 'archivos .cube' : `archivos «${en.medio}»`}`;
    return '';
  }

  /** GET /api/media/presets: la mezcla, filtrada por medio, modo y texto, cada uno con si algún modelo encendido (o lo local) lo sirve. */
  function lista({ medio, modo, q } = {}) {
    const t = todos(), ctx = contexto();
    let ps = t.presets.filter(p => !medio || arr(p.medios).includes(medio)).filter(p => !modo || core.modoAdmite(p, modo));
    if (q && String(q).trim()) { const hits = core.buscar(String(q).slice(0, 120), ps, { max: 40 }); const by = new Map(ps.map(p => [p.id, p])); ps = hits.map(h => ({ ...by.get(h.id), score: h.score, por: h.por })).filter(p => p.id); }
    const sirve = p => {
      if (p.ejecutor === 'local') { const falta = faltaLocal(p); return { on: sharpOk !== false && !falta, modelos: [], motivo: falta || (sharpOk === false ? 'no disponible en esta máquina' : '') }; }
      const kind = arr(p.medios)[0] || 'image';
      const c = core.modelosPara([{ id: p.id, preset: p, params: {} }], ctx.models, ctx.caps, { kind, modo: arr(p.modos)[0], familias: ctx.familias });
      const on = c.filter(x => x.on);
      return { on: on.length > 0, modelos: on.slice(0, 3).map(x => x.id), motivo: on.length ? '' : c[0]?.motivo || 'ningún modelo encendido' };
    };
    const f = fab(); // lo que la página necesita para pintar el banco (grupos, canales, iconos…); los presets van aparte, ya filtrados
    return { version: f.version, sharp: sharpOk !== false, presets: ps.map(p => ({ ...p, ...sirve(p) })), propios: t.propios.map(p => p.id), problemas: t.problemas,
      fabrica: { version: f.version, grupos: f.grupos, tipos: f.tipos, canales: f.canales, familias: f.familias, iconos: f.iconos, sinonimos: f.sinonimos } };
  }

  /** POST /api/media/presets/compile: el plan, sin gastar nada. */
  function compilar(b = {}) {
    const P = pedidoLimpio(b), { presets } = todos();
    const byId = new Map(presets.map(p => [p.id, p]));
    // un preset propio en la pila se abre en su receta (su pila, su canal, su escena y sus ejes)
    const pila = [], params = { ...P.params }; let escena = P.escena, refs = P.entradas.referencias;
    for (const it of P.pila) {
      const p = byId.get(it.id);
      if (p?.propio) {
        pila.push(...p.propio.pila);
        if (p.propio.canal && params.canal == null) params.canal = p.propio.canal;
        if (p.propio.escena && !escena) escena = e3.normalizar(p.propio.escena);
        if (p.propio.ejes && refs.length) refs = refs.map(r => ({ ...r, ejes: { ...p.propio.ejes, ...(r.ejes || {}) } }));
      } else pila.push(it);
    }
    const c = core.compilar({ ...contexto(), byId: presets, pila, params, entradas: { ...P.entradas, referencias: refs }, idea: P.idea, producto: P.producto, model: P.model, proporcion: P.proporcion, escena, n: P.n, orden: P.orden, kind: 'image' });
    for (const it of pila) { const falta = faltaLocal(byId.get(it.id)); if (falta) c.errores = [...arr(c.errores), `«${byId.get(it.id).nombre || it.id}» aún no se puede: ${falta}`]; }
    return { plan: c, pedido: { ...P, pila, params, escena, entradas: { ...P.entradas, referencias: refs } } };
  }

  /** La imagen guía de la escena, subida una vez por escena (la galería la muestra como «Guía de composición»). */
  function guiaDe(escena) {
    const h = createHash('sha1').update(JSON.stringify(e3.normalizar(escena))).digest('hex').slice(0, 16);
    const ya = guias.get(h); if (ya && media.resolve(ya)) { entregadas.add(ya); return { file: ya, nueva: false }; }
    // tras un reinicio la caché está vacía: la guía de esa escena sigue en la galería, marcada con su hash (find recorre el
    // índice sin copiar la galería entera, revisión F1)
    const vieja = buscarEnGaleria(x => x.guia === true && x.escena === h && media.resolve(x.file));
    if (vieja) { guias.set(h, vieja.file); entregadas.add(vieja.file); return { file: vieja.file, nueva: false }; }
    const it = media.upload({ name: 'Guía de composición (escenario 3D)', data: e3.guiaPNG(escena, { lado: 768 }) });
    try { media.update(it.file, { guia: true, escena: h }); } catch {}
    guias.set(h, it.file); return { file: it.file, nueva: true };
  }

  /** Lo de «antes» del modelo (enderezar, quitar la dominante, la luz y el color: §5.2) se hace aquí, sobre tu foto, y lo que va a
   *  la IA es esa copia preparada (en la galería, marcada `prep`, versión de tu foto). Tu foto nunca se toca. */
  async function preparar(foto, ops, folder) {
    const p = media.resolve(foto); if (!p) throw Object.assign(new Error('no encuentro tu foto en el Estudio'), { status: 400 });
    const out = await L.pipeline(fs.readFileSync(p), ops.map(({ de, ...o }) => o), {});
    const ext = out.formato === 'jpeg' || out.formato === 'jpg' ? 'jpeg' : out.formato;
    const it = media.upload({ name: 'Tu foto, preparada para la IA', data: `data:image/${ext};base64,${out.buffer.toString('base64')}`, folder });
    try { media.update(it.file, { prep: true, versionOf: foto, post: { pasos: out.pasos, avisos: out.avisos } }); } catch {}
    return it.file;
  }

  /** POST /api/media/presets/apply: compila y lo manda a hacer. Lo único que gasta, y pasa por los topes del Estudio (submit). */
  async function aplicar(b = {}, { by = 'you', agent = null, task = null } = {}) { // E8: un agente llega con su id y su tarea (el trabajo y su archivo dicen para qué tarea fue)
    const { plan: c0, pedido: P } = compilar(b);
    if (c0.errores.length) { const e = new Error(c0.errores.join(' · ')); e.status = 400; e.plan = c0; throw e; }
    const foto = P.entradas.foto[0];
    const receta = { pila: P.pila, params: P.params, ejes: P.entradas.referencias[0]?.ejes || null, escena: P.escena, canal: c0.request?.preset?.find(x => x.params?.canal)?.params.canal || P.params.canal || null, modelo: c0.model || null };
    const canal = receta.canal || undefined;
    const esEscena = !!(P.escena && P.escena.fondo?.tipo !== 'color') || P.pila.some(it => /^esc-/.test(it.id));
    if (c0.soloLocal) {
      if (!foto) { const e = new Error('Lo local trabaja sobre tu foto: súbela o elige una de la galería'); e.status = 400; throw e; }
      const ops = [...c0.local.antes, ...c0.local.despues];
      const byId = new Map(todos().presets.map(p => [p.id, p]));
      const j = media.submit({ local: true, source: foto, versionOf: foto, kind: 'image', prompt: c0.preset.map(x => byId.get(x.id)?.nombre || x.id).join(' + ') || 'Edición en tu máquina', post: ops, qa: c0.qa, medir: c0.medir, preset: c0.preset, canal, receta, by, agent, task, folder: P.folder });
      return { plan: c0, jobs: [j] };
    }
    // Revisión F1: la guía y la foto preparada se suben ANTES de submit (que es donde se miran los topes). Si submit dice que no,
    // lo que se acaba de crear va a la papelera: un clic repetido en GENERAR con el tope alcanzado no llena la galería de copias.
    const creados = [];
    try {
      let c = c0;
      if (c.guia?.pendiente) { const g = guiaDe(P.escena); if (g.nueva) creados.push(g.file); c = core.ponerGuia(c, g.file); }
      const req = { ...c.request, media: { ...c.request.media } };
      if (req.pre?.length && foto && req.media.reference?.[0] === foto) { // §5.2: lo de antes, antes — la IA recibe tu foto ya preparada
        if (!(await L.disponible()).ok) { const e = new Error('Lo de antes de la IA (luz y color) no está disponible en esta máquina: no se manda a la IA en su lugar'); e.status = 400; throw e; }
        const prep = await preparar(foto, req.pre, P.folder); creados.push(prep);
        req.media.reference = [prep, ...req.media.reference.slice(1)];
      }
      delete req.pre;
      const j = media.submit({ ...req, medir: c.medir, canal, esEscena, receta, by, agent, task, folder: P.folder, purpose: 'banco de presets' });
      return { plan: c, jobs: [j] };
    } catch (e) {
      for (const f of creados) {
        if (entregadas.has(f)) continue; // otra petición en vuelo ya usa esta guía: se queda (y en la caché)
        try { media.trash(f); } catch {} for (const [h, v] of guias) if (v === f) guias.delete(h);
      }
      throw e;
    }
  }

  /** POST /api/media/presets: «Guardar como preset» — una nota en <cerebro>/Estudio/Presets/<nombre>.md (una neurona del
   *  Cerebro). Desde un archivo de la galería (su receta) o desde la receta que manda el compositor. Si ya existe con ese nombre,
   *  la versión de antes va a data/history/presets/<id>/<ts>.md y la nueva sube su v (sus «## Notas» se conservan). */
  function guardar(b = {}) {
    const nombre = limpio(b.nombre, 48).replace(/[\\/:*?"<>|#^[\]]/g, '');
    if (!nombre) throw Object.assign(new Error('ponle un nombre al preset'), { status: 400 });
    let r = b.receta && typeof b.receta === 'object' ? b.receta : null;
    if (!r && typeof b.desde === 'string') {
      const it = media.item(b.desde);
      if (!it) throw Object.assign(new Error('no encuentro ese archivo en el Estudio'), { status: 404 });
      r = it.receta || (Array.isArray(it.preset) ? { pila: it.preset.map(p => ({ id: p.id, params: p.params || {} })) } : null);
      if (!r) throw Object.assign(new Error('esa imagen no salió de un preset: no hay receta que guardar'), { status: 400 });
    }
    if (!r || !arr(r.pila).length) throw Object.assign(new Error('la receta está vacía: elige algún preset antes de guardarla'), { status: 400 });
    const byId = new Map(fab().presets.map(p => [p.id, p]));
    const pila = arr(r.pila).map(x => (typeof x === 'string' ? { id: x, params: {} } : { id: String(x.id), params: x.params && typeof x.params === 'object' ? x.params : {} })).filter(x => byId.has(x.id)).slice(0, 16);
    if (!pila.length) throw Object.assign(new Error('ningún preset de esa receta existe en la fábrica'), { status: 400 });
    // Revisión F1: el id quita las tildes y el archivo no. «Catalogo web» cuando ya está «Catálogo web» es el mismo preset:
    // se guarda en esa nota (y su historial), no en una segunda con el mismo id.
    const mismo = propios().propios.find(x => x.id === notas.idDesdeNombre(nombre));
    const archivo = mismo ? path.basename(mismo.archivo) : notas.archivoDeNombre(nombre), f = path.join(carpeta(), archivo);
    const previa = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    const antes = previa ? notas.notaAPreset(previa, { byId }).preset : null;
    const hoy = new Date().toISOString().slice(0, 10);
    const base = pila[0] && byId.get(pila[0].id);
    const p = {
      tipo: 'propio', id: antes?.id || notas.idDesdeNombre(nombre), nombre, v: (antes?.v || 0) + 1, medio: 'image', icono: base?.icono?.id || 'marca',
      frase: limpio(b.frase, 140) || antes?.frase || `Mi receta: ${pila.map(x => byId.get(x.id)?.nombre || x.id).join(' + ')}`.slice(0, 140),
      basadoEn: base ? `${base.id}@${base.v || 1}` : null,
      receta: { pila, ejes: r.ejes && typeof r.ejes === 'object' ? r.ejes : null, escena: r.escena ? e3.normalizar(r.escena) : null, canal: typeof r.canal === 'string' ? r.canal : null, modelo: typeof r.modelo === 'string' ? r.modelo : null, fijas: arr(r.fijas).filter(x => typeof x === 'string').slice(0, 6) },
      marca: limpio(b.marca, 60) || antes?.marca || null, campana: limpio(b.campana, 60) || antes?.campana || null,
      enlaces: antes?.enlaces || [], buscar: antes?.buscar || [], estado: 'beta', creado: antes?.creado || hoy, actualizado: hoy,
    };
    const prob = notas.validarPropio(p, { byId, canales: canales() });
    if (prob.length) throw Object.assign(new Error(prob.join(' · ')), { status: 400 });
    fs.mkdirSync(carpeta(), { recursive: true });
    if (previa) { const h = path.join(dataDir, 'history', 'presets', p.id); fs.mkdirSync(h, { recursive: true }); fs.writeFileSync(path.join(h, `${Date.now()}.md`), previa); }
    const md = notas.presetANota(p, { byId, previa });
    fs.writeFileSync(f + '.tmp', md); fs.renameSync(f + '.tmp', f);
    try { onNota(); } catch {}
    return { preset: p, archivo: `${notas.CARPETA}/${archivo}`, nota: archivo.replace(/\.md$/, '') };
  }
  /** DELETE /api/media/presets/<id>: la nota va a la papelera del Cerebro de presets (Estudio/Presets/.papelera). */
  function borrar(id) {
    const p = propios().propios.find(x => x.id === id); if (!p) return false;
    const f = path.join(brainPath, ...p.archivo.split('/')), bin = path.join(carpeta(), '.papelera'); fs.mkdirSync(bin, { recursive: true });
    fs.renameSync(f, path.join(bin, `${Date.now()} ${path.basename(f)}`)); try { onNota(); } catch {}
    return true;
  }
  /** GET /api/media/presets/<id>/versiones: las versiones de antes de un preset del dueño. */
  function versiones(id) {
    if (!ID_RE.test(id)) return [];
    const h = path.join(dataDir, 'history', 'presets', id); let l = []; try { l = fs.readdirSync(h).filter(f => f.endsWith('.md')); } catch { return []; }
    return l.sort().reverse().map(f => { const md = fs.readFileSync(path.join(h, f), 'utf8'); const p = notas.notaAPreset(md).preset; return { at: +f.replace('.md', ''), v: p?.v || null, nombre: p?.nombre || id }; });
  }
  return { fabrica: fab, propios, todos, lista, compilar, aplicar, guardar, borrar, versiones, sharp: () => sharpOk };
}
