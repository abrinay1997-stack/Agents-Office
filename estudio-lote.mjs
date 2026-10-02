// Agents Office — el LOTE que propone Dimitri (banco de presets F3, E7; docs/propuesta-banco-presets.md §8.2, §8.3, §15 y D16).
// PURO: sin archivos, sin red, sin serve.mjs. El servidor le pasa el banco (presets.todos), los canales, las carpetas, cuántas
// fotos hay en cada una, las hojas leídas, y una función `compile(pedido) → plan` (presets.compilar): aquí se valida lo que
// Claude propuso, se calcula su costo con el MISMO compilador que usa el Estudio, y se decide si falta un dato (y entonces se
// pregunta con opciones, DIM-06). Nada se crea ni se gasta aquí: el lote solo nace con PROBAR o GENERAR en
// POST /api/sub/studio (la única puerta, serve.mjs → subStudio → lotes.crear).
//
//   parseLote(raw, ctx)            → { lote, preguntas, avisos }    lote.state: 'proposed' | 'skipped' (con error) | null si hay preguntas
//   preguntasLote(faltan, ctx)     → [{ id, q, options, multi, other }]  (la forma de sub.parseQuestions); faltan: fotos · canal · carpetaHoja
//   cuerpoCrear(lote, edits, msg)  → el cuerpo de lotes.crear (sin gastar: el lote nace «previsto»)
//   escenaDe(raw)                  → la escena 3D normalizada, desde la forma corta que escribe Claude o la larga del editor (§16)
//   progresoDe(lotePublico)        → lo que pinta la tarjeta viva del chat (barra, cuentas, antes/después)
//   parseAccionesLote(list, ctx)   → solo lote_pausar · lote_reanudar · lote_reintentar · lote_aprobar, validadas contra el lote real
//   lotesText(lotes)               → los lotes recientes en pocas líneas, para que Dimitri los nombre por su id
import * as e3 from './src/escena3d-core.js';
import { modoAdmite } from './src/presets-core.js';

export const ACCIONES_LOTE = /* @__PURE__ */ Object.freeze(['lote_pausar', 'lote_reanudar', 'lote_reintentar', 'lote_aprobar']);
export const CANALES_PRIMERO = /* @__PURE__ */ Object.freeze(['web', 'ig-feed', 'fbshop', 'amazon']); // D14: los de Panamá primero; Amazon por el 85 %
export const MAX_PILA = 12;
const IMG_RE = /\.(png|jpe?g|webp)$/i;
const ACTIVOS = new Set(['muestra', 'corriendo']);

const limpio = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const nombreCarpeta = v => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); // la misma regla que media.addFolder
export const usd = v => { const x = +v || 0; return 'US$' + (x > 0 && x < 0.1 ? x.toFixed(3) : x.toFixed(2)).replace('.', ','); };
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ---------- la escena 3D (§16): la forma corta de Claude → la del editor ---------- */
/**
 * Claude escribe { tipo, toma, distancia, proporcion, fondo, ancho?, alto?, fondoCm?, giro?, elevacion? } (ids de escena3d-core:
 * TIPOS, TOMAS, DISTANCIAS); el editor guarda { producto, camara, cuadro, fondo }. Las dos llegan normalizadas: el piso es el
 * cero, la cámara nunca baja de él, y el contrapicado sube el producto si hace falta. null si no hay escena.
 */
export function escenaDe(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.producto || raw.camara) return e3.normalizar(raw);
  let e = e3.normalizar({});
  const tipo = typeof raw.tipo === 'string' ? raw.tipo.trim().toLowerCase() : '';
  if (tipo) e = e3.TIPOS.some(t => t.id === tipo) ? e3.conTipo(e, tipo) : e3.normalizar({ ...e, producto: { ...e.producto, tipo } });
  const med = { ancho: raw.ancho, alto: raw.alto, fondo: raw.fondoCm ?? raw.profundidad };
  if ([med.ancho, med.alto, med.fondo].some(v => Number.isFinite(+v) && +v > 0)) e = e3.normalizar({ ...e, producto: { ...e.producto, ...Object.fromEntries(Object.entries(med).filter(([, v]) => Number.isFinite(+v) && +v > 0).map(([k, v]) => [k, +v])) } });
  if (Number.isFinite(+raw.giro)) e = e3.normalizar({ ...e, producto: { ...e.producto, giro: +raw.giro } });
  if (typeof raw.proporcion === 'string') e = e3.normalizar({ ...e, cuadro: { proporcion: raw.proporcion } });
  if (raw.fondo && typeof raw.fondo === 'object') e = e3.normalizar({ ...e, fondo: raw.fondo });
  else if (typeof raw.fondo === 'string' && raw.fondo.trim()) e = e3.normalizar({ ...e, fondo: /^#?[0-9a-f]{3,6}$/i.test(raw.fondo.trim()) ? { tipo: 'color', valor: raw.fondo.trim() } : { tipo: 'locacion', valor: raw.fondo.trim() } });
  if (Number.isFinite(+raw.lente)) e = e3.normalizar({ ...e, camara: { ...e.camara, lente: +raw.lente } });
  if (typeof raw.toma === 'string' && e3.TOMAS.some(t => t.id === raw.toma)) e = e3.aplicarToma(e, raw.toma);
  if (Number.isFinite(+raw.elevacion) && +raw.elevacion > 0) e = e3.normalizar({ ...e, producto: { ...e.producto, elevacion: +raw.elevacion } });
  const d = raw.distancia;
  if (typeof d === 'string' && e3.DISTANCIAS.some(x => x.id === d)) e = e3.aplicarDistancia(e, d);
  else if (Number.isFinite(+d) && +d > 0) e = e3.normalizar({ ...e, camara: { ...e.camara, distancia: +d } }); // cm, del centro al lente en el suelo
  return e;
}
/** La escena en una línea para la tarjeta: «Frontal · a nivel de los ojos · a 6,4 m con 50 mm · ocupa ~60 % del ancho». */
export const escenaEs = e => (e ? e3.describirEscena(e).resumen : '');

/* ---------- preguntar lo que falta (DIM-06) ---------- */
/** faltan: ['canal'] | ['fotos'] | los dos. Opciones de 2 a 4, la recomendada primero, y «otra» para escribir. */
export function preguntasLote(faltan = [], { canales = [], folders = [] } = {}) {
  const out = [];
  if (faltan.includes('fotos')) {
    const top = folders.filter(f => (+f.n || 0) > 0).sort((a, b) => (+b.n || 0) - (+a.n || 0)).slice(0, 3);
    out.push({ id: 'fotos', q: '¿Qué fotos uso para el lote?', options: top.length >= 2 ? top.map((f, k) => ({ label: limpio(`«${f.name}» (${f.n})${k === 0 ? ' (recomendado)' : ''}`, 40), value: `la carpeta «${f.name}»` })) : [], multi: false, other: true, why: 'Un lote sale de una carpeta del Estudio, de las fotos seleccionadas o de un Excel.' });
  }
  if (faltan.includes('carpetaHoja')) {
    const top = folders.filter(f => (+f.n || 0) > 0).sort((a, b) => (+b.n || 0) - (+a.n || 0)).slice(0, 4);
    out.push({ id: 'fotos', q: '¿En qué carpeta están las fotos que nombra la hoja?', options: top.length >= 2 ? top.map((f, k) => ({ label: limpio(`«${f.name}» (${f.n})${k === 0 ? ' (recomendado)' : ''}`, 40), value: `las fotos de la hoja están en la carpeta «${f.name}»` })) : [], multi: false, other: true, why: 'La hoja dice el nombre de cada archivo; los busco en esa carpeta del Estudio.' });
  }
  if (faltan.includes('canal')) {
    const by = new Map(canales.map(c => [c.id, c]));
    const opts = CANALES_PRIMERO.map(id => by.get(id)).filter(Boolean).map((c, k) => {
      const pct = c.ocupacion ? ` ${Math.round(c.ocupacion * 100)} %` : '';
      const label = c.id === 'web' ? `Web con margen${pct}` : c.id === 'ig-feed' ? 'Instagram 4:5' : c.id === 'fbshop' ? 'FB/IG Shop' : `${c.nombre.split('·')[0].trim()}${pct}`;
      return { label: limpio(label + (k === 0 ? ' (recomendado)' : ''), 40), value: c.nombre };
    });
    out.push({ id: 'canal', q: '¿Para dónde son las fotos?', options: opts.length >= 2 ? opts : [], multi: false, other: true, why: 'El canal fija el tamaño, el formato y a qué distancia queda el producto.' });
  }
  return out;
}

/* ---------- el lote que propone Dimitri ---------- */
function canalDe(v, canales) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const f = fold(v);
  return canales.find(c => c.id === v.trim().toLowerCase()) || canales.find(c => fold(c.nombre) === f) || canales.find(c => fold(c.nombre).startsWith(f) || f.startsWith(fold(c.nombre).split(' ')[0] + ' ')) || null;
}
function carpetaDe(v, folders) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const f = fold(v);
  const exacta = folders.find(c => c.id === v || fold(c.name) === f);
  if (exacta) return exacta;
  const parecidas = folders.filter(c => fold(c.name).includes(f) || f.includes(fold(c.name)));
  return parecidas.length === 1 ? parecidas[0] : null;
}
/** La pila que propuso Claude → solo ids que existen y que trabajan sobre una foto; lo quitado se dice. */
export function pilaLimpia(pila, presets = [], { conRef = false } = {}) {
  const byId = new Map(presets.map(p => [p.id, p])), avisos = [], out = [];
  for (const x of (Array.isArray(pila) ? pila : []).slice(0, 20)) {
    const it = typeof x === 'string' ? { id: x } : x && typeof x === 'object' ? x : null;
    if (!it || typeof it.id !== 'string') continue;
    const p = byId.get(it.id);
    if (!p) { avisos.push(`No conozco el preset «${limpio(it.id, 40)}»: lo quité.`); continue; }
    if (!(p.medios || []).includes('image')) { avisos.push(`«${p.nombre}» es para ${(p.medios || []).includes('video') ? 'video' : 'sonido'}, no para fotos: lo quité.`); continue; }
    if (!modoAdmite(p, conRef ? 'foto+ref' : 'foto')) { avisos.push(`«${p.nombre}» no trabaja sobre tus fotos: lo quité.`); continue; }
    if (out.some(y => y.id === p.id)) continue;
    out.push({ id: p.id, ...(it.params && typeof it.params === 'object' && !Array.isArray(it.params) ? { params: it.params } : {}) });
    if (out.length >= MAX_PILA) break;
  }
  return { pila: out, avisos };
}

/**
 * raw: { nombre, fotos: { carpeta } | { ids } | { hoja, carpeta?, ids? }, receta: { pila, canal, escena, refs, ejes, idea }, modelo, muestra, carpeta_destino, por_que }
 * ctx: { presets, canales, folders: [{ id, name, n }], fotosDe(folderId) → [ids], galleryHas(id), hojas(id) → { nombre, filas, sinFoto, porArchivo } | null,
 *        compile(pedido) → plan, models, budget, max (100), muestraDesde (10), muestra (3) }
 * → { lote, preguntas, avisos }. Con preguntas, lote es null: Dimitri pregunta en vez de proponer (§8.1).
 */
export function parseLote(raw, ctx = {}) {
  const { presets = [], canales = [], folders = [], fotosDe = () => [], galleryHas = () => false, hojas = () => null, compile = null, models = [], budget = null } = ctx;
  const max = +ctx.max || 100, muestraDesde = +ctx.muestraDesde || 10, muestraDef = +ctx.muestra || 3;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { lote: null, preguntas: [], avisos: [] };
  const r = raw.receta && typeof raw.receta === 'object' ? raw.receta : {};
  const avisos = [], faltan = [];

  // las fotos: una carpeta, unos ids de la galería o una hoja leída
  const F = raw.fotos && typeof raw.fotos === 'object' ? raw.fotos : typeof raw.carpeta === 'string' ? { carpeta: raw.carpeta } : {};
  let fotos = null, n = 0, muestras = [], fotosEs = '', primera = null;
  if (typeof F.hoja === 'string' && F.hoja) {
    const h = hojas(F.hoja);
    if (h) {
      fotos = { hoja: F.hoja }; n = +h.filas || 0; fotosEs = `${plural(n, 'fila', 'filas')} de «${limpio(h.nombre, 60)}»`;
      if (h.sinFoto?.length) avisos.push(`${plural(h.sinFoto.length, 'fila no tiene', 'filas no tienen')} foto (${h.sinFoto.slice(0, 8).map(x => '#' + x).join(', ')}): ${h.sinFoto.length === 1 ? 'queda' : 'quedan'} para revisar sin gastar.`);
      // §6.1: la hoja que NOMBRA archivos («cama-roma.jpg») los busca en una carpeta de la galería o entre las fotos adjuntas; sin ellas, se pregunta
      const ids = Array.isArray(F.ids) ? [...new Set(F.ids.filter(x => typeof x === 'string' && IMG_RE.test(x) && galleryHas(x)))] : [];
      const c = typeof F.carpeta === 'string' && F.carpeta.trim() ? carpetaDe(F.carpeta, folders) : null;
      if (F.carpeta && !c) avisos.push(`No encuentro la carpeta «${limpio(F.carpeta, 60)}» en el Estudio.`);
      if (c) { fotos.carpeta = c.id; fotosEs += ` · fotos en «${c.name}»`; muestras = (fotosDe(c.id) || []).filter(x => IMG_RE.test(x)).slice(0, 8); primera = muestras[0] || null; }
      else if (ids.length) { fotos.ids = ids; fotosEs += ` · ${plural(ids.length, 'foto adjunta', 'fotos adjuntas')}`; muestras = ids.slice(0, 8); primera = ids[0]; }
      else if ((+h.porArchivo || 0) > 0) faltan.push('carpetaHoja');
    } else avisos.push('Esa hoja ya no está en memoria: vuelve a adjuntarla.');
  } else if (Array.isArray(F.ids)) {
    const ids = [...new Set(F.ids.filter(x => typeof x === 'string' && IMG_RE.test(x) && galleryHas(x)))];
    if (ids.length < F.ids.length) avisos.push(`${plural(F.ids.length - ids.length, 'foto no está', 'fotos no están')} en la galería: no ${F.ids.length - ids.length === 1 ? 'va' : 'van'}.`);
    if (ids.length) { fotos = { ids }; n = ids.length; muestras = ids.slice(0, 8); primera = ids[0]; fotosEs = plural(n, 'foto elegida', 'fotos elegidas'); }
  } else if (typeof F.carpeta === 'string' && F.carpeta.trim()) {
    const c = carpetaDe(F.carpeta, folders);
    if (c) { const ids = (fotosDe(c.id) || []).filter(x => IMG_RE.test(x)); fotos = { carpeta: c.id }; n = ids.length; muestras = ids.slice(0, 8); primera = ids[0] || null; fotosEs = `${plural(n, 'foto', 'fotos')} de «${c.name}»`; }
    else avisos.push(`No encuentro la carpeta «${limpio(F.carpeta, 60)}» en el Estudio.`);
  }
  if (!fotos) faltan.push('fotos');

  // el canal: lo pide siempre (§8.1: sin canal no hay tamaño ni distancia)
  const canal = canalDe(r.canal ?? raw.canal, canales);
  if (!canal) { faltan.push('canal'); if (r.canal || raw.canal) avisos.push(`No conozco el canal «${limpio(r.canal || raw.canal, 40)}».`); }
  if (faltan.length) return { lote: null, preguntas: preguntasLote(faltan, { canales, folders }), avisos };

  // la receta
  const refs = (Array.isArray(r.refs) ? r.refs : r.refs && typeof r.refs === 'object' ? Object.values(r.refs) : []).slice(0, 4).map(x => (typeof x === 'string' ? { id: x } : x)).filter(x => x && typeof x.id === 'string' && galleryHas(x.id))
    .map(x => ({ id: x.id, ...(x.ejes && typeof x.ejes === 'object' ? { ejes: x.ejes } : {}) }));
  const lp = pilaLimpia(r.pila ?? raw.presets, presets, { conRef: refs.length > 0 }); avisos.push(...lp.avisos);
  const escena = escenaDe(r.escena);
  const idea = limpio(r.idea, 600);
  const nombre = limpio(raw.nombre, 80) || `Lote ${fotosEs || ''}`.trim();
  const base = { nombre, fotos, fotosEs, n, muestras, receta: { pila: lp.pila, canal: canal.id, ...(escena ? { escena } : {}), ...(refs.length ? { refs } : {}), ...(r.ejes && typeof r.ejes === 'object' ? { ejes: r.ejes } : {}), ...(idea ? { idea } : {}) },
    canalEs: canal.nombre, canales: canales.map(c => ({ id: c.id, nombre: c.nombre })), escenaEs: escenaEs(escena), recetaEs: lp.pila.map(x => ({ id: x.id, nombre: presets.find(p => p.id === x.id)?.nombre || x.id, ...(x.params?.intensidad ? { intensidad: x.params.intensidad } : {}) })),
    carpetaDestino: nombreCarpeta(raw.carpeta_destino ?? raw.carpetaDestino) || `${nombre} · resultados`, porQue: limpio(raw.por_que ?? raw.porQue, 300),
    muestra: Number.isInteger(+raw.muestra) && +raw.muestra >= 0 && raw.muestra !== null && raw.muestra !== '' ? Math.min(10, +raw.muestra) : n >= muestraDesde ? muestraDef : 0, avisos };
  const skip = error => ({ lote: { ...base, modelo: null, modelName: '', alternativas: [], estimate: { total: 0, porFoto: 0, muestraUsd: 0, fits: false, why: error }, state: 'skipped', error }, preguntas: [], avisos });
  if (!lp.pila.length && !escena && !idea) return skip('Sin receta: elige algún preset del banco.');
  if (!n) return skip(fotos.carpeta ? 'Esa carpeta no tiene fotos.' : 'No hay ninguna foto para el lote.');
  if (n > max) return skip(`Son ${n} fotos y el tope del lote es ${max}: divídelo en dos o súbelo en Ajustes → Estudio.`);
  if (typeof compile !== 'function') return skip('El banco de presets no está disponible.');

  // el costo con el mismo compilador del Estudio, sobre una foto de la serie (o una de muestra si vienen de una hoja)
  const pedido = { pila: lp.pila, params: { canal: canal.id }, entradas: { foto: [primera || 'lote/muestra.png'], referencias: refs }, escena, idea, n: 1, ...(typeof raw.modelo === 'string' && raw.modelo ? { model: raw.modelo } : {}) };
  let plan; try { plan = compile(pedido); } catch (e) { return skip(`No pude preparar la receta: ${e.message}`); }
  if (plan?.errores?.length) return skip(plan.errores.join(' · '));
  if (raw.modelo && plan.model && plan.model !== raw.modelo) avisos.push(`Pediste ${limpio(raw.modelo, 40)}, que no sirve para esta receta o no está encendido: uso ${models.find(m => m.id === plan.model)?.name || plan.model}.`);
  for (const a of plan.avisos || []) avisos.push(limpio(a.texto || a, 200));
  const soloLocal = !!plan.soloLocal, porFoto = soloLocal ? 0 : +(+plan.costo?.usd || 0).toFixed(4);
  const total = +(porFoto * n).toFixed(3), muestraUsd = +(porFoto * Math.min(n, base.muestra || muestraDef)).toFixed(3);
  const est = estimarLote({ total, n: soloLocal ? 0 : n, budget });
  const nm = id => models.find(m => m.id === id)?.name || id;
  return { lote: { ...base, avisos: [...new Set(avisos)], modelo: plan.model || null, modelName: plan.model ? nm(plan.model) : 'en tu máquina', porque: limpio(plan.porque, 200), soloLocal, pasos: (plan.pasos_es || []).slice(0, 14),
    alternativas: (plan.alternativas || []).filter(a => a && a.id && a.on !== false).slice(0, 5).map(a => ({ id: a.id, name: nm(a.id) })),
    estimate: { total, porFoto, muestraUsd, fits: est.fits, why: est.why }, state: 'proposed' }, preguntas: [], avisos };
}
/** ¿Cabe en lo que queda hoy y este mes? n: las fotos que van a la IA (lo local no cuenta). */
export function estimarLote({ total = 0, n = 0, budget = null } = {}) {
  const no = [];
  if (budget) {
    if (budget.left != null && n > budget.left) no.push(`el tope de hoy (son ${n} y quedan ${budget.left})`);
    if (budget.costLeftDay != null && total > budget.costLeftDay + 1e-9) no.push(`el dinero del día (quedan ${usd(budget.costLeftDay)})`);
    if (budget.costLeftMonth != null && total > budget.costLeftMonth + 1e-9) no.push(`el del mes (quedan ${usd(budget.costLeftMonth)})`);
  }
  return { fits: !no.length, why: no.length ? `No cabe entero en ${no.join(' ni en ')}: el lote se pausará al llegar ahí.` : total ? `Cabe hoy: aprox. ${usd(total)}.` : 'Gratis: todo se hace en tu máquina.' };
}
/** El cuerpo de lotes.crear para un lote propuesto, con lo que el dueño cambió en la tarjeta (canal, modelo) y si prueba primero. */
export function cuerpoCrear(lote, { canal, modelo, probar = false } = {}, msg = null) {
  const receta = { ...lote.receta, ...(typeof canal === 'string' && canal ? { canal } : {}), ...(typeof modelo === 'string' && modelo ? { modelo } : lote.modelo ? { modelo: lote.modelo } : {}) };
  const F = lote.fotos || {}; // una hoja con su carpeta (o sus fotos adjuntas): lotes.mjs busca ahí los archivos que nombra (§6.1)
  const origen = F.hoja ? { hoja: F.hoja, ...(F.carpeta ? { fotosHoja: { carpeta: F.carpeta } } : F.ids ? { fotosHoja: { ids: F.ids } } : {}) } : F;
  return { nombre: lote.nombre, origen, receta, muestra: probar ? Math.max(1, lote.muestra || 3) : 0, carpetaDestino: lote.carpetaDestino, ...(msg ? { sub: { msg } } : {}) };
}

/* ---------- la tarjeta viva ---------- */
const ESTADO_ES = { previsto: 'preparado', espera_ok: 'espera tu OK', muestra: 'probando', corriendo: 'en marcha', pausado: 'pausado', hecho: 'terminado', cancelado: 'cancelado' };
const MARCA = { revisar: '⚠ revisar', fallo: '✕ falló', aprobada: '✓ aprobada' };
/** Un lote como lo publica lotes.mjs (pub) → lo que pinta la tarjeta del chat. Puro, y estable (sin horas) para no redibujar en balde. */
export function progresoDe(l) {
  if (!l || !Array.isArray(l.filas)) return null;
  const c = { en_cola: 0, editando: 0, verificando: 0, lista: 0, revisar: 0, aprobada: 0, fallo: 0, omitida: 0 };
  for (const f of l.filas) c[f.estado] = (c[f.estado] || 0) + 1;
  const total = l.filas.length, hechas = c.lista + c.revisar + c.aprobada + c.fallo + c.omitida;
  const pares = l.filas.filter(f => f.out && f.src).slice(-6).map(f => ({ n: f.n, src: f.src, out: f.out, estado: f.estado, marca: MARCA[f.estado] || '✓ lista', ...(f.sku ? { sku: f.sku } : {}), ...(f.error && f.estado !== 'lista' && f.estado !== 'aprobada' ? { motivo: limpio(f.error, 120) } : {}) }));
  const p = { id: l.id, nombre: l.nombre, estado: l.estado, motivo: l.motivo ? limpio(l.motivo, 200) : null, total, hechas, listas: c.lista, aprobadas: c.aprobada, revisar: c.revisar, fallo: c.fallo, omitidas: c.omitida, enCurso: c.editando + c.verificando, quedan: c.en_cola,
    gastado: +(+l.costo?.gastado || 0).toFixed(4), estimado: +(+l.costo?.estimado || 0).toFixed(4), muestraHecha: !!l.muestraHecha, pares };
  return { ...p, texto: progresoEs(p), estadoEs: l.estado === 'pausado' && p.motivo === 'muestra' ? 'muestra lista' : ESTADO_ES[l.estado] || l.estado }; // the page shows them as they are (it never carries this module: the page has a size budget)
}
/** «24 de 40 · 2 para revisar · 1 falló» */
export function progresoEs(p) {
  if (!p) return '';
  return [`${p.hechas} de ${p.total}`, p.listas + p.aprobadas ? `${p.listas + p.aprobadas} ${p.listas + p.aprobadas === 1 ? 'lista' : 'listas'}` : '', p.revisar ? `${p.revisar} para revisar` : '', p.fallo ? `${p.fallo} ${p.fallo === 1 ? 'falló' : 'fallaron'}` : ''].filter(Boolean).join(' · ');
}

/* ---------- las acciones cerradas sobre un lote (solo con clic) ---------- */
/**
 * list: lo que propuso Claude ({ type, lote, filas?, modelo? }); ctx.lote(id) → el lote publicado o null.
 * Cada acción sale con lo que se ve en su tarjeta (nombre, cuántas filas, el costo de reintentar) y state 'proposed'.
 * → { acciones, descartadas: [motivo] }
 */
export function parseAccionesLote(list, { lote = () => null } = {}) {
  const out = [], descartadas = [];
  for (const a of (Array.isArray(list) ? list : []).slice(0, 8)) {
    if (!a || typeof a !== 'object' || !ACCIONES_LOTE.includes(a.type)) continue;
    let l = null; try { l = typeof a.lote === 'string' ? lote(a.lote) : null; } catch { l = null; }
    if (!l) { descartadas.push(`${a.type}: no encuentro el lote «${limpio(a.lote, 30)}»`); continue; }
    const base = { type: a.type, lote: l.id, nombre: limpio(l.nombre, 80) };
    if (a.type === 'lote_pausar') { if (ACTIVOS.has(l.estado)) out.push(base); else descartadas.push(`el lote «${l.nombre}» no está en marcha`); continue; }
    if (a.type === 'lote_reanudar') { if (l.estado === 'pausado') out.push(base); else descartadas.push(`el lote «${l.nombre}» no está pausado`); continue; }
    const quiere = a.type === 'lote_aprobar' ? ['lista', 'revisar'] : ['fallo', 'revisar'];
    const sel = a.filas === 'listas' ? l.filas.filter(f => f.estado === 'lista') : a.filas === 'fallidas' ? l.filas.filter(f => f.estado === 'fallo') : a.filas === 'revisar' ? l.filas.filter(f => f.estado === 'revisar')
      : (Array.isArray(a.filas) ? a.filas : []).map(n => l.filas.find(f => f.n === +n)).filter(f => f && quiere.includes(f.estado));
    const filas = sel.filter(f => quiere.includes(f.estado) && (a.type !== 'lote_aprobar' || f.out));
    if (!filas.length) { descartadas.push(`el lote «${l.nombre}» no tiene filas para ${a.type === 'lote_aprobar' ? 'aprobar' : 'reintentar'}`); continue; }
    const filasOut = typeof a.filas === 'string' && ['listas', 'fallidas', 'revisar'].includes(a.filas) ? a.filas : filas.map(f => f.n);
    if (a.type === 'lote_aprobar') out.push({ ...base, filas: filasOut, cuantas: filas.length });
    else {
      const modelo = typeof a.modelo === 'string' && /^[a-z0-9.-]{2,60}$/i.test(a.modelo) ? a.modelo : null;
      out.push({ ...base, filas: filasOut, cuantas: filas.length, costo: +filas.reduce((s, f) => s + (+f.estimado || +f.costo || 0), 0).toFixed(4), ...(modelo ? { modelo } : {}) }); // gasta: la tarjeta lo dice
    }
  }
  return { acciones: out.map(a => ({ ...a, texto: accionLoteEs(a) })), descartadas };
}
/** Una acción de lote en palabras (la tarjeta del chat y el historial). */
export function accionLoteEs(a) {
  const f = a.cuantas ? ` ${plural(a.cuantas, 'foto', 'fotos')}` : '';
  if (a.type === 'lote_pausar') return `Pausar el lote «${a.nombre}»`;
  if (a.type === 'lote_reanudar') return `Reanudar el lote «${a.nombre}»`;
  if (a.type === 'lote_aprobar') return `Aprobar${f} del lote «${a.nombre}» (no se envía nada fuera)`;
  if (a.type === 'lote_reintentar') return `Reintentar${f} del lote «${a.nombre}»${a.modelo ? ` con ${a.modelo}` : ''} · gasta aprox. ${usd(a.costo)}`;
  return '';
}

/** Los lotes recientes para el bloque de Dimitri: así los nombra por su id en las acciones. */
export function lotesText(lotes = [], n = 5) {
  const ES = { previsto: 'previsto', espera_ok: 'espera tu OK', muestra: 'probando', corriendo: 'en marcha', pausado: 'pausado', hecho: 'terminado', cancelado: 'cancelado' };
  const l = (Array.isArray(lotes) ? lotes : []).filter(x => x && x.id).slice(0, n);
  if (!l.length) return '';
  return 'LOTES DEL ESTUDIO (recientes; usa su id en las acciones de lote):\n' + l.map(x => {
    const c = x.cuentas || {};
    return `- ${x.id} «${limpio(x.nombre, 60)}» · ${ES[x.estado] || x.estado}${x.motivo ? ` (${limpio(x.motivo, 80)})` : ''} · ${c.hechas ?? '?'}/${c.total ?? '?'}${c.revisar ? ` · ${c.revisar} revisar` : ''}${c.fallo ? ` · ${c.fallo} fallo` : ''}${c.lista ? ` · ${c.lista} listas` : ''} · gastado ${usd(x.costo?.gastado)}${x.costo?.estimado ? ` de ${usd(x.costo.estimado)}` : ''}`;
  }).join('\n');
}
