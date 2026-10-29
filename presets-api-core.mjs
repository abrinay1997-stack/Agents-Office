// Agents Office — el banco de presets: el CÁLCULO de la API (PURO: sin archivos, sin red, sin sharp, sin D1).
// Lo comparten la oficina local (presets.mjs: lee archivos del Cerebro, aplica con media.submit) y la nube
// (cloudflare/worker/lib/estudio/presets.js: lee las notas de D1, aplica con trabajos.pedir). Aquí vive todo lo que decide qué se ve y qué se
// compila; quien llama pone solo las entradas (la fábrica, las notas, los modelos, las cifras, si hay sharp) y hace lo que gasta.
// Cubierto por tests/presets-servidor.test.mjs (local) y cloudflare/tests/presets-nube.test.mjs (nube).
import * as core from './src/presets-core.js';
import * as e3 from './src/escena3d-core.js';
import * as notas from './presets-notas.mjs';

export const ID_RE = /^[a-z0-9-]{2,40}$/;
export const KINDS = ['image', 'video', 'music', 'audio']; // F5 y F6: el banco también compila video, música y voz
export const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
export const limpio = (s, n = 400) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n);
const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Las cifras de la empresa (cifras.json: [{ name, value }]) como objeto para «{cifras.precio}»: el nombre en minúsculas, sin
 *  tildes y con «_». Un precio nunca sale del preset. */
export function cifrasComoObjeto(items) {
  const o = {};
  for (const x of arr(items)) if (x && x.name != null && x.value != null && String(x.value).trim()) o[fold(x.name)] = String(x.value).trim();
  return o;
}

/** Limpia lo que manda la página: la pila, los parámetros, las entradas, la escena. Nada pasa sin forma conocida. */
export function pedidoLimpio(b = {}) {
  const pila = arr(b.pila).slice(0, 16).map((x) => (typeof x === 'string' ? { id: x } : x)).filter((x) => x && typeof x.id === 'string' && (ID_RE.test(x.id) || x.id === 'libre'))
    .map((x) => (x.id === 'libre' ? { id: 'libre', texto: limpio(x.texto, 600) } : { id: x.id, ...(x.params && typeof x.params === 'object' && !Array.isArray(x.params) ? { params: x.params } : {}) }));
  const ids = (v) => arr(v).filter((x) => typeof x === 'string' && x.length < 300).slice(0, 8);
  const E = b.entradas && typeof b.entradas === 'object' ? b.entradas : {};
  const referencias = arr(E.referencias).slice(0, 6).map((r) => (typeof r === 'string' ? { id: r } : r)).filter((r) => r && typeof r.id === 'string')
    .map((r) => ({ id: r.id, ...(r.ejes && typeof r.ejes === 'object' ? { ejes: Object.fromEntries(core.EJES_REF.filter((k) => r.ejes[k] != null).map((k) => [k, Math.max(0, Math.min(3, Math.round(+r.ejes[k] || 0)))])) } : {}) }));
  const entradas = { foto: ids(E.foto ?? E.sujeto).slice(0, 1), referencias, ...(ids(E.lut).length ? { lut: ids(E.lut) } : {}) };
  // F5 (10 oct 2026): el video — sus fotogramas (inicial, final), su video (origen) o el de guía (copiar movimiento); uno de cada
  const kind = KINDS.includes(b.kind) ? b.kind : 'image';
  if (kind === 'video') for (const k of ['inicial', 'final', 'origen', 'guia']) { const v = ids(E[k]).slice(0, 1); if (v.length) entradas[k] = v; }
  const escena = b.escena && typeof b.escena === 'object' ? e3.normalizar(b.escena) : null;
  const params = b.params && typeof b.params === 'object' && !Array.isArray(b.params) ? b.params : {};
  return { kind, pila, params, entradas, escena, idea: limpio(b.idea, 2000), producto: limpio(b.producto, 120), model: typeof b.model === 'string' && ID_RE.test(b.model) ? b.model : undefined,
    proporcion: typeof b.proporcion === 'string' && /^\d{1,2}(\.\d{1,2})?:\d{1,2}$/.test(b.proporcion) ? b.proporcion : undefined,
    n: Math.max(1, Math.min(4, +b.n || 1)), orden: b.orden === 'barato' ? 'barato' : undefined, folder: typeof b.folder === 'string' ? b.folder : undefined };
}

/* ---------- el banco: la fábrica + los presets del dueño ---------- */
/** Los presets del dueño a partir de sus notas. `lista`: [{ archivo: 'Estudio/Presets/Catálogo web.md', nombre: 'Catálogo web.md', md }] EN EL ORDEN en que deben cargarse.
 *  Una nota rota se dice, no tumba el banco; dos notas con el mismo id: gana la primera y la otra se dice. → { propios, problemas } */
export function propiosDeNotas(lista, { fab, canales = null } = {}) {
  const out = [], problemas = [], byId = new Map(arr(fab?.presets).map((p) => [p.id, p])), vistos = new Map(), cs = canales ?? notas.conjuntoDeCanales(fab?.canales);
  for (const n of arr(lista)) {
    const r = notas.notaAPreset(n.md, { archivo: n.archivo, byId, canales: cs });
    if (!r.preset) { problemas.push(`${n.nombre}: ${r.problemas.join('; ')}`); continue; }
    if (vistos.has(r.preset.id)) { problemas.push(`${n.nombre}: tiene el mismo id (${r.preset.id}) que «${vistos.get(r.preset.id)}»; no se carga: renómbrala o cámbiale el id`); continue; }
    vistos.set(r.preset.id, n.nombre);
    if (r.problemas.length) problemas.push(`${n.nombre}: ${r.problemas.join('; ')}`);
    out.push(r.preset);
  }
  return { propios: out, problemas };
}
/** La fábrica y los del dueño en la forma del banco (un propio con el id de uno de fábrica lo tapa, §4.2). */
export function bancoDe({ fab, propios: ps = [], problemas = [] }) {
  const byId = new Map(fab.presets.map((p) => [p.id, p]));
  const banco = ps.map((p) => notas.aPresetDeBanco(p, { byId, iconos: fab.iconos }));
  const tapados = new Set(banco.map((p) => p.id));
  return { presets: [...fab.presets.filter((p) => !tapados.has(p.id)), ...banco], propios: ps, problemas };
}
/** Lo que el compilador necesita de fuera. `models`: la lista de modelos; `caps(m)`: sus capacidades; `capacidades.local`: ¿se pueden hacer los retoques locales aquí? */
export function contextoDe({ fab, models, caps, cifras = [], local = true }) {
  return { models, caps, familias: fab.familias, tipos: fab.tipos, canales: fab.canales, cifras: cifrasComoObjeto(cifras), capacidades: { local }, escena3d: e3 };
}

/** Por qué un preset local no se puede hacer en esta versión (o '' si sí): su LUT de fábrica aún no está en presets/luts, o
 *  pide un archivo que el Estudio no sabe recibir (un .cube). `lutExiste(nombre)`: ¿está ese LUT? (en la nube no hay carpeta: siempre true). */
export function faltaLocal(p, lutExiste = () => true) {
  if (!p || p.ejecutor !== 'local') return '';
  for (const o of arr(p.local)) if (o && typeof o.archivo === 'string' && /\.cube$/i.test(o.archivo) && !lutExiste(o.archivo)) return 'su LUT todavía no viene con la oficina';
  for (const en of arr(p.entradas)) if (en && (en.min || 0) > 0 && !['image', 'video', 'audio', 'music'].includes(en.medio)) return `el Estudio todavía no recibe ${en.medio === 'cube' ? 'archivos .cube' : `archivos «${en.medio}»`}`;
  return '';
}
const tocaLocal = (p) => p.ejecutor === 'local' || p.ejecutor === 'local+ia' || arr(p.local).length > 0 || arr(p.post).length > 0;

/** GET /api/media/presets: la mezcla, filtrada por medio, modo y texto, cada uno con si algún modelo encendido (o lo local) lo sirve.
 *  opts.sinLocal: motivo (texto) cuando aquí no se pueden hacer los retoques locales: los presets que lo exigen salen con `on:false` y ese motivo (no se ocultan). */
export function listar(banco, ctx, { medio, modo, q } = {}, { fab, sinLocal = '', lutExiste = () => true, sharp = true } = {}) {
  let ps = banco.presets.filter((p) => !medio || arr(p.medios).includes(medio)).filter((p) => !modo || core.modoAdmite(p, modo));
  if (q && String(q).trim()) { const hits = core.buscar(String(q).slice(0, 120), ps, { max: 40 }); const by = new Map(ps.map((p) => [p.id, p])); ps = hits.map((h) => ({ ...by.get(h.id), score: h.score, por: h.por })).filter((p) => p.id); }
  const sirve = (p) => {
    if (sinLocal && tocaLocal(p)) return { on: false, modelos: [], motivo: sinLocal };
    if (p.ejecutor === 'local') { const falta = faltaLocal(p, lutExiste); return { on: sharp !== false && !falta, modelos: [], motivo: falta || (sharp === false ? 'no disponible en esta máquina' : '') }; }
    const kind = arr(p.medios)[0] || 'image';
    const c = core.modelosPara([{ id: p.id, preset: p, params: {} }], ctx.models, ctx.caps, { kind, modo: arr(p.modos)[0], familias: ctx.familias });
    const on = c.filter((x) => x.on);
    return { on: on.length > 0, modelos: on.slice(0, 3).map((x) => x.id), motivo: on.length ? '' : c[0]?.motivo || 'ningún modelo encendido' };
  };
  return { version: fab.version, sharp: sharp !== false, presets: ps.map((p) => ({ ...p, ...sirve(p) })), propios: banco.propios.map((p) => p.id), problemas: banco.problemas,
    fabrica: { version: fab.version, grupos: fab.grupos, tipos: fab.tipos, canales: fab.canales, familias: fab.familias, iconos: fab.iconos, sinonimos: fab.sinonimos } };
}

/** POST /api/media/presets/compile: el plan, sin gastar nada. */
export function compilar(b, banco, ctx, { lutExiste = () => true } = {}) {
  const P = pedidoLimpio(b), byId = new Map(banco.presets.map((p) => [p.id, p]));
  // un preset propio en la pila se abre en su receta (su pila, su canal, su escena y sus ejes)
  const pila = [], params = { ...P.params }; let escena = P.escena, refs = P.entradas.referencias;
  for (const it of P.pila) {
    const p = byId.get(it.id);
    if (p?.propio) {
      pila.push(...p.propio.pila);
      if (p.propio.canal && params.canal == null) params.canal = p.propio.canal;
      if (p.propio.escena && !escena) escena = e3.normalizar(p.propio.escena);
      if (p.propio.ejes && refs.length) refs = refs.map((r) => ({ ...r, ejes: { ...p.propio.ejes, ...(r.ejes || {}) } }));
    } else pila.push(it);
  }
  const c = core.compilar({ ...ctx, byId: banco.presets, pila, params, entradas: { ...P.entradas, referencias: refs }, idea: P.idea, producto: P.producto, model: P.model, proporcion: P.proporcion, escena, n: P.n, orden: P.orden, kind: P.kind });
  for (const it of pila) { const falta = faltaLocal(byId.get(it.id), lutExiste); if (falta) c.errores = [...arr(c.errores), `«${byId.get(it.id).nombre || it.id}» aún no se puede: ${falta}`]; }
  return { plan: c, pedido: { ...P, pila, params, escena, entradas: { ...P.entradas, referencias: refs } } };
}

/** Lo que decide POST /api/media/presets/apply antes de gastar nada: compila, rechaza si el plan trae errores y arma la receta que queda
 *  en el archivo (para «Guardar como preset»). Quien llama hace lo que cuesta: subir la guía del escenario, la foto preparada, el trabajo.
 *  → { plan, pedido, foto, receta, canal, esEscena, byId } | lanza Error con `status` 400 y `plan`. */
export function planAplicar(b, banco, ctx, opts = {}) {
  const { plan: c0, pedido: P } = compilar(b, banco, ctx, opts);
  if (c0.errores.length) { const e = new Error(c0.errores.join(' · ')); e.status = 400; e.plan = c0; throw e; }
  const foto = P.entradas.foto[0];
  const receta = { kind: P.kind, pila: P.pila, params: P.params, ejes: P.entradas.referencias[0]?.ejes || null, escena: P.escena, canal: c0.request?.preset?.find((x) => x.params?.canal)?.params.canal || P.params.canal || null, modelo: c0.model || null };
  const canal = receta.canal || undefined;
  const esEscena = !!(P.escena && P.escena.fondo?.tipo !== 'color') || P.pila.some((it) => /^esc-/.test(it.id));
  return { plan: c0, pedido: P, foto, receta, canal, esEscena, byId: new Map(banco.presets.map((p) => [p.id, p])) };
}

/* ---------- «Guardar como preset»: lo puro ---------- */
const fallo = (msg, status = 400) => Object.assign(new Error(msg), { status });
/** El nombre de un preset a guardar, sin lo que un nombre de nota no admite; lanza si queda vacío (se mira ANTES de buscar la receta). */
export function nombreLimpio(b = {}) {
  const nombre = limpio(b.nombre, 48).replace(/[\\/:*?"<>|#^[\]]/g, '');
  if (!nombre) throw fallo('ponle un nombre al preset');
  return nombre;
}
/** El preset propio que sale de un pedido de guardar. `b`: { nombre, frase, marca, campana, receta | desde, kind }; `receta`: la ya resuelta (la del compositor o la del archivo de la galería);
 *  `antes`: el preset propio con ese nombre si ya existía (conserva su id, su v+1 y su creado); `hoy`: 'AAAA-MM-DD'. → { p, base } o lanza Error con `status`. */
export function presetParaGuardar(b, receta, { fab, antes = null, hoy, canales = null } = {}) {
  const nombre = nombreLimpio(b);
  const r = receta;
  if (!r || !arr(r.pila).length) throw fallo('la receta está vacía: elige algún preset antes de guardarla');
  const byId = new Map(fab.presets.map((p) => [p.id, p]));
  const pila = arr(r.pila).map((x) => (typeof x === 'string' ? { id: x, params: {} } : { id: String(x.id), params: x.params && typeof x.params === 'object' ? x.params : {} })).filter((x) => byId.has(x.id)).slice(0, 16);
  if (!pila.length) throw fallo('ningún preset de esa receta existe en la fábrica');
  const base = pila[0] && byId.get(pila[0].id);
  // F5: el medio sale de la receta (o, si no lo dice, del primer preset): una receta de video se guarda como preset de video
  const medio = KINDS.includes(r.kind) ? r.kind : KINDS.includes(b.kind) ? b.kind : arr(base?.medios)[0] || 'image';
  const p = {
    tipo: 'propio', id: antes?.id || notas.idDesdeNombre(nombre), nombre, v: (antes?.v || 0) + 1, medio, icono: base?.icono?.id || 'marca',
    frase: limpio(b.frase, 140) || antes?.frase || `Mi receta: ${pila.map((x) => byId.get(x.id)?.nombre || x.id).join(' + ')}`.slice(0, 140),
    basadoEn: base ? `${base.id}@${base.v || 1}` : null,
    receta: { pila, ejes: r.ejes && typeof r.ejes === 'object' ? r.ejes : null, escena: r.escena ? e3.normalizar(r.escena) : null, canal: typeof r.canal === 'string' ? r.canal : null, modelo: typeof r.modelo === 'string' ? r.modelo : null, fijas: arr(r.fijas).filter((x) => typeof x === 'string').slice(0, 6) },
    marca: limpio(b.marca, 60) || antes?.marca || null, campana: limpio(b.campana, 60) || antes?.campana || null,
    enlaces: antes?.enlaces || [], buscar: antes?.buscar || [], estado: 'beta', creado: antes?.creado || hoy, actualizado: hoy,
  };
  const prob = notas.validarPropio(p, { byId, canales: canales ?? notas.conjuntoDeCanales(fab.canales) });
  if (prob.length) throw fallo(prob.join(' · '));
  return { p, byId };
}
/** La receta de un pedido de guardar: la que manda el compositor (`b.receta`) o la del archivo de la galería (`b.desde`, ya leído en `item`). */
export function recetaDeGuardar(b, item) {
  if (b.receta && typeof b.receta === 'object') return b.receta;
  if (typeof b.desde === 'string') {
    if (!item) throw fallo('no encuentro ese archivo en el Estudio', 404);
    const r = item.receta || (Array.isArray(item.preset) ? { pila: item.preset.map((p) => ({ id: p.id, params: p.params || {} })) } : null);
    if (!r) throw fallo('esa imagen no salió de un preset: no hay receta que guardar');
    return r;
  }
  return null;
}
