// Ajustes → Modelos en la nube: dónde se guarda (el doc 'modelos' de D1), cómo se lee con tolerancia, qué llaves hay (solo sí/no) y las pruebas.
// La validación y la precedencia son de modelos-core.mjs (la misma que usaría la oficina local). Aquí no hay NINGUNA dirección configurable:
// cada proveedor tiene su endpoint fijo en agentes/llm.js, así que ni un modelo personalizado puede mandar una llave a otro host.
import { leerDoc, guardarDoc } from './almacen.js';
import { validarAjustes, VACIO, PROVEEDORES, CATALOGO, todos, buscar, ficha, costoEstimado } from '../../../modelos-core.mjs';
import { elegirModelo, armarLlamada, llamarModelo, textoDe } from './agentes/llm.js';
import * as costos from './agentes/costos.js';
import { ahora } from './ids.js';
import { limpiarSecretos } from './secretos.js';

export const DOC = 'modelos';

/** El documento guardado, pasado otra vez por el validador: uno roto o viejo es «sin ajustes», nunca un error en medio de una tarea. */
export async function leerModelos(db) {
  if (!db) return null;
  try {
    const { valor } = await leerDoc(db, DOC, null);
    if (!valor) return null;
    const r = validarAjustes(valor);
    return r.ok ? r.valor : null;
  } catch { return null; }
}

/** Qué llaves hay en el Worker. SOLO un sí/no por proveedor: el valor no sale de aquí. */
export function llaves(env) {
  return Object.fromEntries(Object.values(PROVEEDORES).map(p => [p.id, !!(env?.[p.llave] || (p.llaveAlternativa && env?.[p.llaveAlternativa]))]));
}

/** Los modelos que de verdad están en uso ahora: los de los ajustes (o el de siempre) con llave puesta. Para el icono junto al perfil. */
export function activos(env, ajustes) {
  const ll = llaves(env), a = ajustes || VACIO();
  const ids = new Set([a.oficina, ...Object.values(a.funciones), ...Object.values(a.departamentos), ...Object.values(a.agentes)].filter(Boolean));
  if (!ids.size) ids.add(/^muse-/i.test(String(env?.AI_MODELO || '')) ? env.AI_MODELO : String(env?.AI_MODELO || '').startsWith('claude-') ? env.AI_MODELO : 'claude-sonnet-5-5');
  return [...ids].map(id => { const m = buscar(id, a) || { id, proveedor: /^muse-/i.test(id) ? 'meta' : 'anthropic', nombre: id }; return { id, proveedor: m.proveedor, nombre: m.nombre, personalizado: !!m.personalizado, llave: !!ll[m.proveedor] }; });
}

export async function guardarModelos(db, entrada, { quien = '', antes = null } = {}) {
  const r = validarAjustes(entrada);
  if (!r.ok) return r;
  await guardarDoc(db, DOC, r.valor);
  const cambios = diferencias(antes || VACIO(), r.valor);
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'modelos', quien, JSON.stringify({ cambios })).run();
  return { ok: true, valor: r.valor, cambios };
}

/** Qué cambió, en frases cortas (para la auditoría y para decírselo al dueño). Solo ids y nombres de modelos: nada secreto. */
export function diferencias(a, b) {
  const out = [];
  const pon = (donde, x, y) => { if ((x || '') !== (y || '')) out.push(`${donde}: ${x || 'sin asignar'} → ${y || 'sin asignar'}`); };
  pon('oficina', a.oficina, b.oficina);
  for (const k of new Set([...Object.keys(a.funciones || {}), ...Object.keys(b.funciones || {})])) pon(`función ${k}`, a.funciones?.[k], b.funciones?.[k]);
  for (const k of new Set([...Object.keys(a.departamentos || {}), ...Object.keys(b.departamentos || {})])) pon(`departamento ${k}`, a.departamentos?.[k], b.departamentos?.[k]);
  for (const k of new Set([...Object.keys(a.agentes || {}), ...Object.keys(b.agentes || {})])) pon(`agente ${k}`, a.agentes?.[k], b.agentes?.[k]);
  const ia = new Set((a.personalizados || []).map(p => p.id)), ib = new Set((b.personalizados || []).map(p => p.id));
  for (const id of ib) if (!ia.has(id)) out.push(`modelo personalizado añadido: ${id}`);
  for (const id of ia) if (!ib.has(id)) out.push(`modelo personalizado quitado: ${id}`);
  return out;
}

/** Todo lo que la pantalla necesita, de una vez. `cfgPrices`: los precios propios de Ajustes → Costos. */
export function vistaCompleta({ env, ajustes, cfgPrices = {}, agentes = [] }) {
  const a = ajustes || VACIO();
  return {
    proveedores: Object.values(PROVEEDORES).map(p => ({ id: p.id, nombre: p.nombre, llave: p.llave, llavePuesta: llaves(env)[p.id] })),
    catalogo: todos(a).map(m => ficha(m, cfgPrices)),
    ajustes: a,
    agentes: agentes.map(x => ({ id: x.id, nombre: x.name, depto: x.department, modelo: x.model || '' })),
    activos: activos(env, a),
    cuando: 'Los cambios valen desde la próxima tarea: lo que ya está corriendo termina con el modelo con que empezó.',
  };
}

const PREGUNTA_PRUEBA = 'Preséntate en dos frases y dime qué tan bueno eres para redactar un correo breve a un cliente.';
export const MAX_PRUEBA = 1000;
const TOPE_PRUEBAS_HORA = 30;

/** Una pregunta corta a UN modelo. Gasta poco (máx. 1.000 tokens de salida) y queda en el libro de costos como «prueba». → { ok, id, texto, ms, tokens, usd } | { ok: false, error } */
export async function probarModelo({ env, db, id, pedido = '', ajustes = null, fetchFn = (...a) => fetch(...a), maxTokens = 300 }) {
  const m = buscar(String(id || ''), ajustes);
  if (!m) return { ok: false, error: `«${String(id || '').slice(0, 40)}» no está en el catálogo.` };
  const pr = PROVEEDORES[m.proveedor];
  if (!llaves(env)[m.proveedor]) return { ok: false, error: `Falta el secreto ${pr.llave} en Cloudflare: sin él no se puede probar ${m.nombre}.` };
  const txt = String(pedido || PREGUNTA_PRUEBA).replace(/\s+/g, ' ').trim().slice(0, 600) || PREGUNTA_PRUEBA;
  const modelo = { id: m.id, meta: m.proveedor === 'meta' };
  const t0 = Date.now();
  try {
    const r = await llamarModelo({ env, modelo, sistema: 'Eres un modelo que alguien está probando. Responde en español, breve y directo.', mensajes: [{ role: 'user', content: txt }], herramientas: [], maxTokens: Math.min(MAX_PRUEBA, maxTokens), fetchFn });
    const ms = Date.now() - t0;
    let usd = 0;
    try { usd = await costos.anotar(db, { tipo: 'prueba', modelo: r.model || m.id, proveedor: m.proveedor, usage: r.usage, ms }); } catch { /* el libro no tumba la prueba */ }
    return { ok: true, id: m.id, nombre: m.nombre, texto: limpiarSecretos(textoDe(r.content)).slice(0, 3000), ms, tokens: { entrada: r.usage?.input_tokens ?? null, salida: r.usage?.output_tokens ?? null }, usd };
  } catch (e) {
    return { ok: false, id: m.id, nombre: m.nombre, error: limpiarSecretos(String(e?.message || 'falló')).replace(/\s*\[HTTP \d+\]/, '').slice(0, 300), ms: Date.now() - t0 };
  }
}

/** El tope de pruebas por hora (30): una prueba es barata, pero un bucle no. */
export async function pruebasEnLaHora(db) {
  const r = await db.prepare("select count(*) n from costos where tipo = 'prueba' and t >= ?").bind(Date.now() - 36e5).first();
  return r?.n ?? 0;
}
export const TOPE = TOPE_PRUEBAS_HORA;

/** El costo máximo de comparar dos modelos con este pedido: la entrada estimada por caracteres y la salida al tope. */
export function costoMaximoComparar(ids, pedido, ajustes, cfgPrices = {}, maxTokens = 300) {
  const tin = Math.ceil((String(pedido || PREGUNTA_PRUEBA).length + 120) / 3.2);
  const filas = ids.map(id => { const m = buscar(id, ajustes); const f = m && ficha(m, cfgPrices); return { id, usd: f?.precio ? costoEstimado(f.precio, tin, maxTokens) : null }; });
  return { filas, total: filas.reduce((n, f) => n + (f.usd || 0), 0), sinPrecio: filas.some(f => f.usd === null) };
}

export { elegirModelo, armarLlamada, CATALOGO };
