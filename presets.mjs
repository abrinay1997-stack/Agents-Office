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
import { renombrar } from './fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)

import * as API from './presets-api-core.mjs';
export { cifrasComoObjeto, pedidoLimpio } from './presets-api-core.mjs'; // siguen viviendo aquí para quien las importaba (tests, lotes)

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
    let files = []; try { files = fs.readdirSync(carpeta()).filter(f => f.endsWith('.md')); } catch { return { propios: [], problemas: [] }; }
    const lista = [];
    for (const f of files.sort()) { let md = ''; try { md = fs.readFileSync(path.join(carpeta(), f), 'utf8'); } catch { continue; } lista.push({ archivo: `${notas.CARPETA}/${f}`, nombre: f, md }); }
    return API.propiosDeNotas(lista, { fab: fab(), canales: canales() });
  }
  /** La fábrica y los del dueño en la forma del banco (un propio con el id de uno de fábrica lo tapa, §4.2). */
  function todos() { return API.bancoDe({ fab: fab(), ...propios() }); }
  const contexto = () => {
    const models = media.models();
    return API.contextoDe({ fab: fab(), models, caps: m => media.capsOf(m.id || m, { familias: fab().familias }), cifras: cifras(), local: sharpOk !== false });
  };
  const lutExiste = nombre => fs.existsSync(path.join(L.DIR_LUTS, path.basename(nombre)));

  /** GET /api/media/presets: la mezcla, filtrada por medio, modo y texto, cada uno con si algún modelo encendido (o lo local) lo sirve. */
  function lista(filtro = {}) { return API.listar(todos(), contexto(), filtro, { fab: fab(), lutExiste, sharp: sharpOk }); }

  /** POST /api/media/presets/compile: el plan, sin gastar nada. */
  function compilar(b = {}) { return API.compilar(b, todos(), contexto(), { lutExiste }); }

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
    const { plan: c0, pedido: P, foto, receta, canal, esEscena } = API.planAplicar(b, todos(), contexto(), { lutExiste });
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
    const nombre = API.nombreLimpio(b);
    let it = null; if (!(b.receta && typeof b.receta === 'object') && typeof b.desde === 'string') it = media.item(b.desde);
    const r = API.recetaDeGuardar(b, it);
    // Revisión F1: el id quita las tildes y el archivo no. «Catalogo web» cuando ya está «Catálogo web» es el mismo preset:
    // se guarda en esa nota (y su historial), no en una segunda con el mismo id.
    const mismo = propios().propios.find(x => x.id === notas.idDesdeNombre(nombre));
    const archivo = mismo ? path.basename(mismo.archivo) : notas.archivoDeNombre(nombre), f = path.join(carpeta(), archivo);
    const previa = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    const byId0 = new Map(fab().presets.map(p => [p.id, p]));
    const antes = previa ? notas.notaAPreset(previa, { byId: byId0 }).preset : null;
    const { p, byId } = API.presetParaGuardar(b, r, { fab: fab(), antes, hoy: new Date().toISOString().slice(0, 10), canales: canales() });
    fs.mkdirSync(carpeta(), { recursive: true });
    if (previa) { const h = path.join(dataDir, 'history', 'presets', p.id); fs.mkdirSync(h, { recursive: true }); fs.writeFileSync(path.join(h, `${Date.now()}.md`), previa); }
    const md = notas.presetANota(p, { byId, previa });
    fs.writeFileSync(f + '.tmp', md); renombrar(f + '.tmp', f);
    try { onNota(); } catch {}
    return { preset: p, archivo: `${notas.CARPETA}/${archivo}`, nota: archivo.replace(/\.md$/, '') };
  }
  /** DELETE /api/media/presets/<id>: la nota va a la papelera del Cerebro de presets (Estudio/Presets/.papelera). */
  function borrar(id) {
    const p = propios().propios.find(x => x.id === id); if (!p) return false;
    const f = path.join(brainPath, ...p.archivo.split('/')), bin = path.join(carpeta(), '.papelera'); fs.mkdirSync(bin, { recursive: true });
    renombrar(f, path.join(bin, `${Date.now()} ${path.basename(f)}`)); try { onNota(); } catch {}
    return true;
  }
  /** GET /api/media/presets/<id>/versiones: las versiones de antes de un preset del dueño. */
  function versiones(id) {
    if (!API.ID_RE.test(id)) return [];
    const h = path.join(dataDir, 'history', 'presets', id); let l = []; try { l = fs.readdirSync(h).filter(f => f.endsWith('.md')); } catch { return []; }
    return l.sort().reverse().map(f => { const md = fs.readFileSync(path.join(h, f), 'utf8'); const p = notas.notaAPreset(md).preset; return { at: +f.replace('.md', ''), v: p?.v || null, nombre: p?.nombre || id }; });
  }
  return { fabrica: fab, propios, todos, lista, compilar, aplicar, guardar, borrar, versiones, sharp: () => sharpOk };
}
