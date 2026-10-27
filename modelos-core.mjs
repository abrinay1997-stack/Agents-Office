// Agents Office — modelos intercambiables a voluntad (25 oct 2026). Código PURO, compartido por la nube (Ajustes → Modelos) y la oficina local:
// el catálogo de modelos por proveedor, las capacidades de cada uno, la validación estricta de lo que guarda el dueño y la precedencia que decide
// qué modelo corre cada cosa. No toca red ni disco.
//
// Por qué un catálogo cerrado + «personalizado» acotado:
//  · El ENDPOINT de cada proveedor es fijo (anthropic → api.anthropic.com, meta → api.meta.ai): el dueño elige un modelo, NUNCA una dirección. Así una llave
//    no puede mandarse a un host arbitrario. Un proveedor nuevo exige un adaptador en el Worker; no se «inventa» desde un formulario.
//  · Un modelo personalizado lleva un id con la forma que ese proveedor usa (claude-… / muse-…) y las capacidades que el dueño declara.
//
// Precedencia (la de siempre, ampliada): tarea > rutina > agente (campo `model` del roster) > agente (esta pantalla) > departamento > función > oficina.
import { priceFor, PRICES_AS_OF } from './costs-core.mjs';

export const PROVEEDORES = {
  anthropic: { id: 'anthropic', nombre: 'Anthropic (Claude)', llave: 'ANTHROPIC_API_KEY', prefijo: /^claude-/ , host: 'api.anthropic.com' },
  meta: { id: 'meta', nombre: 'Meta (Muse)', llave: 'META_API_KEY', llaveAlternativa: 'MODEL_API_KEY', prefijo: /^muse-/, host: 'api.meta.ai' },
};

/** Capacidades: herramientas (conectores y herramientas internas), visión (imágenes en el pedido), razonamiento (piensa antes de contestar). */
export const CATALOGO = [
  { id: 'claude-fable-5-1', proveedor: 'anthropic', nombre: 'Claude Fable 5.1', herramientas: true, vision: true, razonamiento: true, nota: 'El más capaz y el más caro.' },
  { id: 'claude-opus-5-5', proveedor: 'anthropic', nombre: 'Claude Opus 5.5', herramientas: true, vision: true, razonamiento: true, nota: 'Mucho criterio para tareas delicadas.' },
  { id: 'claude-opus-5', proveedor: 'anthropic', nombre: 'Claude Opus 5', herramientas: true, vision: true, razonamiento: true, nota: 'Es el «Opus» de las tareas y rutinas.' },
  { id: 'claude-sonnet-5-5', proveedor: 'anthropic', nombre: 'Claude Sonnet 5.5', herramientas: true, vision: true, razonamiento: true, nota: 'Buen equilibrio entre calidad y costo.' },
  { id: 'claude-sonnet-5', proveedor: 'anthropic', nombre: 'Claude Sonnet 5', herramientas: true, vision: true, razonamiento: true, nota: 'Es el «Sonnet» de las tareas y rutinas.' },
  { id: 'claude-haiku-5-5', proveedor: 'anthropic', nombre: 'Claude Haiku 5.5', herramientas: true, vision: true, razonamiento: false, nota: 'Rápido y barato: clasificar, resumir, redactar corto.' },
  { id: 'muse-spark-1.3', proveedor: 'meta', nombre: 'Meta Muse Spark 1.3', herramientas: false, vision: false, razonamiento: false, nota: 'Solo redacta: la API de Meta no ofrece herramientas ni conectores MCP.' },
  { id: 'muse-spark-1.2', proveedor: 'meta', nombre: 'Meta Muse Spark 1.2', herramientas: false, vision: false, razonamiento: false, nota: 'Solo redacta: la API de Meta no ofrece herramientas ni conectores MCP.' },
];

/** Las funciones de la oficina a las que se les puede asignar un modelo. `cableado: false` = se muestra pero todavía no se puede cambiar (y se dice por qué). */
export const FUNCIONES = [
  { id: 'agentes', nombre: 'Agentes (todos)', ayuda: 'Cuando una tarea corre en un agente sin modelo propio.', herramientas: true },
  { id: 'dimitri', nombre: 'Dimitri (chat, plan, estudio)', ayuda: 'La mano derecha: conversa y propone; no usa herramientas.' },
  { id: 'redactar', nombre: 'Mejorar y redactar (Contenido, Anuncios)', ayuda: 'Los botones «✨ Mejorar con…» y los textos de campañas.' },
  { id: 'resumen', nombre: 'Resumen del lunes e informes', ayuda: 'El resumen semanal y los informes del mes.' },
  { id: 'enrutador', nombre: 'Enrutador (a qué agente va una tarea)', ayuda: 'Una llamada corta y barata: sirve un modelo pequeño.' },
  { id: 'revision', nombre: 'Revisión del jefe', ayuda: 'El jefe del departamento revisa lo delicado antes de que te llegue.' },
  { id: 'cerebro', nombre: 'Conectar notas del Cerebro', ayuda: 'El botón «Actualizar conexiones» del Cerebro: propone con qué notas enlazar una nota nueva. Una llamada corta: sirve un modelo pequeño y barato.' },
  { id: 'video', nombre: 'Entender video y audio', ayuda: 'Lo hace Muse Spark por una ruta propia (understand.mjs) y todavía no se puede cambiar aquí.', cableado: false },
];
export const FUNCION_IDS = FUNCIONES.filter(f => f.cableado !== false).map(f => f.id);
export const DEPARTAMENTOS = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];

const ID_PERSONALIZADO = /^[a-z][a-z0-9._-]{2,63}$/;
const MAX_PERSONALIZADOS = 12;
export const VACIO = () => ({ personalizados: [], oficina: '', funciones: {}, departamentos: {}, agentes: {} });

const objeto = v => v && typeof v === 'object' && !Array.isArray(v);
const texto = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);

/** Todos los modelos conocidos: el catálogo y los personalizados (ya validados). */
export const todos = (ajustes) => [...CATALOGO, ...((ajustes && ajustes.personalizados) || []).map(p => ({ ...p, personalizado: true }))];
export const buscar = (id, ajustes) => todos(ajustes).find(m => m.id === id) || null;

/** Valida UN modelo personalizado → { ok, valor } | { ok: false, error }. */
export function validarPersonalizado(p) {
  if (!objeto(p)) return { ok: false, error: 'Un modelo personalizado es un objeto.' };
  const proveedor = String(p.proveedor || '').toLowerCase();
  if (!PROVEEDORES[proveedor]) return { ok: false, error: `Proveedor desconocido «${texto(p.proveedor, 20)}». Hoy la oficina habla con ${Object.keys(PROVEEDORES).join(' y ')}; otro proveedor necesita un adaptador en el Worker.` };
  const id = String(p.id || '').trim().toLowerCase();
  if (!ID_PERSONALIZADO.test(id)) return { ok: false, error: `El id «${texto(p.id, 40)}» no es válido (minúsculas, números, punto, guion; 3 a 64).` };
  if (!PROVEEDORES[proveedor].prefijo.test(id)) return { ok: false, error: `Un modelo de ${PROVEEDORES[proveedor].nombre} lleva un id que empieza por ${proveedor === 'anthropic' ? '«claude-»' : '«muse-»'}.` };
  if (CATALOGO.some(m => m.id === id)) return { ok: false, error: `«${id}» ya está en el catálogo.` };
  const precio = n => (n === undefined || n === null || n === '' ? null : Number(n));
  const pin = precio(p.in), pout = precio(p.out);
  for (const [k, v] of [['in', pin], ['out', pout]]) if (v !== null && !(Number.isFinite(v) && v >= 0 && v <= 1000)) return { ok: false, error: `El precio «${k}» es en US$ por millón de tokens (0 a 1000).` };
  const herramientas = p.herramientas === undefined ? proveedor === 'anthropic' : p.herramientas === true;
  if (herramientas && proveedor === 'meta') return { ok: false, error: 'La API de Meta no ofrece herramientas: un modelo de Meta no puede declararse con herramientas.' };
  return { ok: true, valor: { id, proveedor, nombre: texto(p.nombre, 60) || id, herramientas, vision: p.vision === true, razonamiento: p.razonamiento === true, in: pin, out: pout, nota: texto(p.nota, 160) } };
}

/** Valida TODO lo que el dueño guarda → { ok, valor } | { ok: false, errores }. Lo desconocido se rechaza, no se ignora. */
export function validarAjustes(raw) {
  const e = objeto(raw) ? raw : {}, errores = [], v = VACIO();
  for (const k of Object.keys(e)) if (!(k in v)) errores.push(`Campo desconocido «${texto(k, 30)}».`);
  const pers = Array.isArray(e.personalizados) ? e.personalizados : [];
  if (pers.length > MAX_PERSONALIZADOS) errores.push(`Como mucho ${MAX_PERSONALIZADOS} modelos personalizados.`);
  for (const p of pers.slice(0, MAX_PERSONALIZADOS)) {
    const r = validarPersonalizado(p);
    if (!r.ok) errores.push(r.error); else if (v.personalizados.some(x => x.id === r.valor.id)) errores.push(`«${r.valor.id}» está repetido.`); else v.personalizados.push(r.valor);
  }
  const existe = id => !!buscar(id, v);
  const modelo = (id, donde) => { const s = String(id ?? '').trim(); if (!s) return ''; if (!existe(s)) { errores.push(`${donde}: «${texto(s, 40)}» no está en el catálogo.`); return ''; } return s; };
  v.oficina = modelo(e.oficina, 'Modelo de la oficina');
  if (e.funciones !== undefined && !objeto(e.funciones)) errores.push('Las funciones son un objeto.');
  for (const [k, id] of Object.entries(objeto(e.funciones) ? e.funciones : {})) {
    if (!FUNCION_IDS.includes(k)) { errores.push(`Función desconocida «${texto(k, 30)}».`); continue; }
    const m = modelo(id, `Función «${k}»`); if (m) v.funciones[k] = m;
  }
  for (const [k, id] of Object.entries(objeto(e.departamentos) ? e.departamentos : {})) {
    if (!DEPARTAMENTOS.includes(k)) { errores.push(`Departamento desconocido «${texto(k, 30)}».`); continue; }
    const m = modelo(id, `Departamento «${k}»`); if (m) v.departamentos[k] = m;
  }
  for (const [k, id] of Object.entries(objeto(e.agentes) ? e.agentes : {})) {
    if (!/^[a-z0-9-]{2,30}$/.test(k)) { errores.push(`Agente desconocido «${texto(k, 30)}».`); continue; }
    const m = modelo(id, `Agente «${k}»`); if (m) v.agentes[k] = m;
  }
  return errores.length ? { ok: false, errores } : { ok: true, valor: v };
}

/** Lo que el dueño ve de un modelo: precios por millón de tokens (de la tabla de costos, con su fecha) y capacidades. */
export function ficha(m, cfgPrices = {}) {
  const p = priceFor(m.id, cfgPrices);
  const propio = m.in != null || m.out != null ? { in: m.in, out: m.out } : null;
  const precio = propio && propio.in != null && propio.out != null ? { in: propio.in, out: propio.out, fuente: 'puesto por ti' } : p ? { in: p.in, out: p.out, fuente: `tabla de costos (${PRICES_AS_OF})`, aproximado: !p.model || p.model !== m.id } : null;
  return { id: m.id, proveedor: m.proveedor, nombre: m.nombre, herramientas: !!m.herramientas, vision: !!m.vision, razonamiento: !!m.razonamiento, nota: m.nota || '', personalizado: !!m.personalizado, precio };
}

/** Dólares estimados de una llamada de `tin` tokens de entrada y `tout` de salida con el precio de la ficha. */
export const costoEstimado = (precio, tin, tout) => (precio ? ((tin || 0) * precio.in + (tout || 0) * precio.out) / 1e6 : 0);

/**
 * Qué modelo del AJUSTE (no del roster, tarea o rutina) corresponde: agente > departamento > función > oficina. → { id, de } | null.
 * `de` dice DE DÓNDE salió, para decírselo al dueño.
 */
export function delAjuste(ajustes, { funcion = '', agente = '', depto = '' } = {}) {
  const a = ajustes || VACIO();
  const hay = id => (id && buscar(id, a) ? id : '');
  if (funcion === 'agentes' || (!funcion && (agente || depto))) {
    const x = hay(a.agentes?.[agente]); if (x) return { id: x, de: 'este agente (Ajustes → Modelos)' };
    const d = hay(a.departamentos?.[depto]); if (d) return { id: d, de: 'este departamento (Ajustes → Modelos)' };
    const f = hay(a.funciones?.agentes); if (f) return { id: f, de: 'la función «Agentes» (Ajustes → Modelos)' };
  } else if (funcion) {
    const f = hay(a.funciones?.[funcion]); if (f) return { id: f, de: `la función «${funcion}» (Ajustes → Modelos)` };
  }
  const o = hay(a.oficina); if (o) return { id: o, de: 'el modelo de la oficina (Ajustes → Modelos)' };
  return null;
}

/**
 * ¿Sirve este modelo para lo que se le va a pedir? `necesita`: { herramientas, vision }. → { ok, falta: [..] }.
 * Un modelo que no sirve NUNCA falla en silencio: quien llama decide caer a otro capaz (y decirlo) o rechazar.
 */
export function sirvePara(m, necesita = {}) {
  const falta = [];
  if (necesita.herramientas && !m.herramientas) falta.push('herramientas');
  if (necesita.vision && !m.vision) falta.push('imágenes');
  return { ok: !falta.length, falta };
}

/** El aviso en palabras para el selector. */
export function advertencia(m, { herramientas = false } = {}) {
  if (herramientas && !m.herramientas) return `${m.nombre} no usa herramientas: este agente solo podrá redactar. Si la tarea necesita conectores, la oficina la pasa a un modelo capaz y lo anota.`;
  return '';
}

/** A qué modelo cae una tarea que necesita herramientas cuando el elegido no las tiene: el primero del catálogo que sirva, en este orden de preferencia. */
export const FALLBACK_CAPAZ = ['claude-sonnet-5-5', 'claude-sonnet-5', 'claude-opus-5-5', 'claude-opus-5'];
export function capazDe(ajustes, { tieneAnthropic = true } = {}) {
  if (!tieneAnthropic) return null;
  for (const id of FALLBACK_CAPAZ) { const m = buscar(id, ajustes); if (m && m.herramientas) return m; }
  return todos(ajustes).find(m => m.herramientas && m.proveedor === 'anthropic') || null;
}
