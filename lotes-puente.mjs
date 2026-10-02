// Agents Office — el PUENTE entre la pestaña Lotes (src/studio-lotes.js, E6) y el motor del lote (lotes.mjs, E5). Banco de presets F2,
// integración (1 oct 2026). Los dos equipos trabajaron a la vez y cada uno habló su idioma: la página manda el origen como
// { tipo: 'carpeta' | 'seleccion' | 'subidas' | 'hoja', … } y lee la vista previa en lote.previa; el motor quiere { carpeta | ids | hoja, … }
// y devuelve la vista aparte. Aquí, y solo aquí, se traduce de uno a otro. Todo es puro (tests/lotes-puente.test.mjs); serve.mjs lo usa
// en las rutas /api/media/lotes*.
import { CAMPOS } from './lotes-hoja.mjs';

const arr = v => (Array.isArray(v) ? v : []);
const err400 = msg => Object.assign(new Error(msg), { status: 400 });
const usd = v => 'US$' + (+v || 0).toFixed(2).replace('.', ',');

/** Quién pide: el dueño por defecto; Dimitri y los agentes llegan con su nombre (F3) y el motor les pone sus límites. */
export const quien = b => (b?.by === 'agent' || b?.by === 'dimitri' ? b.by : 'you');

/** Las columnas de una hoja leída, como las pinta el desplegable: una por cabecera, con el campo que tiene (o ''). */
export function columnasParaUI(h) {
  const cab = arr(h?.cabeceras), mapa = h?.columnas || {};
  return cab.map((nombre, i) => ({ i, nombre: String(nombre ?? '') || `Columna ${i + 1}`, campo: CAMPOS.find(c => mapa[c] === i) || '' }));
}

/** Lo que el desplegable dejó ([{ i?, nombre, campo }], en el orden de las cabeceras) → las correcciones del motor { campo: índice | null }.
 *  Cada campo que nadie tiene va explícito a null: si no, el emparejado automático lo volvería a poner. Un mapa ya del motor pasa tal cual. */
export function columnasAlMotor(c) {
  if (!c) return undefined;
  if (!Array.isArray(c)) return typeof c === 'object' ? c : undefined;
  const out = Object.fromEntries(CAMPOS.map(k => [k, null]));
  c.forEach((x, pos) => { const k = x?.campo; if (CAMPOS.includes(k) && out[k] == null) out[k] = Number.isInteger(x.i) ? x.i : pos; });
  return out;
}

/** El origen de la página → el del motor. Lo que ya viene en el idioma del motor (Dimitri, un agente, un test) pasa tal cual. */
export function origenDelPedido(o) {
  if (!o || typeof o !== 'object') throw err400('¿de dónde salen las fotos? Elige una carpeta, selecciona fotos, súbelas o trae un Excel');
  if (!o.tipo) return o;
  switch (o.tipo) {
    case 'carpeta': if (!o.carpeta) throw err400('elige la carpeta de la galería'); return { carpeta: String(o.carpeta) };
    case 'seleccion': case 'subidas': {
      const ids = arr(o.files).filter(x => typeof x === 'string');
      if (!ids.length) throw err400(o.tipo === 'seleccion' ? 'no hay ninguna foto seleccionada en la galería' : 'todavía no subiste ninguna foto');
      return { ids };
    }
    case 'hoja': {
      if (!o.hoja && !o.data) throw err400('vuelve a elegir la hoja: la oficina no la tiene');
      const fotos = arr(o.fotos).filter(x => typeof x === 'string');
      return { hoja: o.hoja || { name: o.nombre || 'hoja.xlsx', data: o.data }, ...(o.columnas ? { columnas: columnasAlMotor(o.columnas) } : {}), ...(fotos.length ? { sueltas: fotos.map(file => ({ file })) } : {}) };
    }
    case 'ejemplo': throw err400('las fotos de ejemplo solo existen en la demo');
    default: throw err400(`no conozco el origen «${String(o.tipo).slice(0, 20)}»`);
  }
}

/** Por qué está pausado, en las palabras que la página distingue: la muestra (se sigue con «continuar»), el dueño, el dinero o los créditos. */
export function pausaDe(lote) {
  if (lote?.estado !== 'pausado') return null;
  const m = String(lote.motivo || '');
  if (m === 'muestra') return { por: 'muestra', motivo: 'Probé con unas pocas: revísalas antes de seguir.' };
  const por = /lo pausaste/i.test(m) ? 'dueño' : /cr[eé]ditos|saldo|403|billing|permiso/i.test(m) ? 'creditos' : /presupuesto|tope/i.test(m) ? 'presupuesto' : 'otro';
  return { por, motivo: m || 'en pausa.' };
}

/**
 * La vista previa (lo que devuelve crear(), «prever» de §6.3) en la forma que la página lee en lote.previa (studio-lotes.js → previaDe).
 * nombreModelo(id) pone el nombre que ve el dueño en vez del id.
 */
export function previaParaUI(vista, lote, { nombreModelo = id => id } = {}) {
  const v = vista || {}, filas = arr(lote?.filas), cola = filas.filter(f => f.estado === 'en_cola');
  const k = Math.max(1, +lote?.muestra || 3), muestraCosto = +cola.slice(0, k).reduce((s, f) => s + (+f.estimado || 0), 0).toFixed(4);
  const hoy = v.hoy || {}, c = v.cabe || {}, tope = +lote?.tope?.usd || 0;
  const cabeMuestra = (hoy.costLeftDay == null || muestraCosto <= hoy.costLeftDay + 1e-9) && (hoy.costLeftMonth == null || muestraCosto <= hoy.costLeftMonth + 1e-9) && (!tope || muestraCosto <= tope + 1e-9);
  const primera = arr(v.filas).find(f => f.modelo);
  const todoLocal = arr(v.filas).length > 0 && arr(v.filas).every(f => f.soloLocal);
  const problemas = filas.filter(f => f.estado === 'revisar' && f.error).map(f => `#${f.n}${f.sku ? ` ${f.sku}` : ''}: ${f.error}`);
  return {
    total: filas.length, costo: +(+v.total || 0).toFixed(4), muestraCosto,
    modelo: primera ? nombreModelo(primera.modelo) : todoLocal ? 'En tu máquina (gratis)' : null, porque: primera?.porque || '',
    cabe: { ok: c.todo !== false, dia: c.dia !== false, mes: c.mes !== false, lote: c.lote !== false, cuenta: c.cuenta !== false, muestra: cabeMuestra, motivo: c.todo === false ? c.por : null },
    quedaHoy: hoy.costLeftDay ?? null,
    avisos: [...arr(lote?.avisos), ...problemas.slice(0, 12), ...(problemas.length > 12 ? [`y ${problemas.length - 12} filas más para revisar (no gastan)`] : [])].map(String),
    errores: cola.length ? [] : ['Ninguna foto se puede editar así: corrige la hoja o la receta (cada fila dice por qué).'],
    filas: arr(v.filas).map(f => ({ ...f, modelo: f.modelo ? nombreModelo(f.modelo) : f.soloLocal ? 'local · gratis' : null })),
    texto: `${filas.length} fotos · ${usd(v.total)}`,
  };
}

/** Un lote tal como lo pinta la página: con su pausa en palabras y, al crearlo, su vista previa. */
export function paraUI(lote, vista, o) {
  if (!lote) return lote;
  const out = { ...lote, pausa: pausaDe(lote) };
  if (vista) out.previa = previaParaUI(vista, lote, o);
  return out;
}

/** Un lote para la LISTA de la pestaña: lo que pinta su barra y sus cifras (el estado de cada fila), sin bitácora ni prompts. */
export function paraLista(lote) {
  if (!lote) return lote;
  const { bitacora, receta, avisos, ...l } = lote;
  return { ...paraUI(l), filas: arr(lote.filas).map(f => ({ n: f.n, estado: f.estado, sku: f.sku || '' })) };
}

/** ?que= del ZIP: «aprobadas» o «listas» (las listas y las aprobadas, lo que el botón llama «todo»). */
export const queZip = q => (q === 'aprobadas' ? 'aprobadas' : 'listas');
