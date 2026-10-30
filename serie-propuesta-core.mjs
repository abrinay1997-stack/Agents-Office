// Agents Office (29 oct 2026) — Fase 11.3 (carril K), parte pura: PROPONER una serie de imágenes coherente con la biblia de marca.
// Sin E/S, sin reloj, sin llamar a ningún modelo; lo comparten la oficina local y (más adelante) la nube.
// REGLA DEL DINERO (§3): aquí solo se PROPONE. Nada de este archivo reserva, gasta ni genera: devuelve una serie en estado «previsto» con su costo máximo y el hash
// de la escaleta. Gastar es otro paso (siguientePaso de serie-core) que exige el clic del dueño, el token de un solo uso y ese mismo hash. El costo mostrado es el
// MÁXIMO de GENERACIÓN que el proveedor puede cobrar (precio por plano × (1 + reintentos)). La QA, la visión y las descripciones se cobran aparte (11.4) y, sin `ctx.costoRevision`, NO están en
// este número salvo que `ctx.costoRevision` ({ qa, vision } en US$ por intento, solo si la revisión por visión está encendida: 11.4) los sume; la tarjeta lo dice. Si un plano no tiene precio fiable (modelo desconocido, NaN, objeto), no se inventa 0: el costo queda sin calcular y la serie NO «cabe».
import { crearPlano, validarEscaleta, ajustarReferencias, hashEscaleta, presupuestoSerie, MAX_PLANOS } from './serie-core.mjs';
import { citarBiblia, verificarPedido, violaNunca, anclasDeBiblia, lineaDeHoja, normalizarHoja, idsValidos } from './biblia-core.mjs';
import { injectionIn } from './safety.mjs';

const cad = (v, max) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const RE_PRECIO = /(?:US\$|\$|B\/\.?)\s?\d[\d.,]*/g;
export const preciosDeCifras = cifras => [...new Set(JSON.stringify(cifras ?? '').matchAll(RE_PRECIO).map(m => m[0]))];
const sospechoso = (...textos) => { const l = textos.flat(Infinity).map(t => String(t ?? '')).filter(Boolean); return l.map(t => injectionIn(t)).find(Boolean) || injectionIn(l.join('\n')) || null; }; // campo a campo Y el conjunto
export const MAX_PLANOS_SERIE = 40; // una propuesta cabe en una llamada y en una tarjeta
const ROLES = new Set(['gancho', 'desarrollo', 'cierre', 'cta', 'plano']);
const valoresTexto = o => Object.values(o && typeof o === 'object' ? o : {}).filter(v => typeof v === 'string');
/** Un precio fiable: número finito y positivo (0 solo si el precio dice `gratis: true`, el motor de prueba). Un objeto, NaN o negativo → null (falla cerrado). */
/** Una semilla de generación: entero seguro ≥ 0 (número o texto numérico) o null. Nada de objetos, NaN, negativos ni cadenas raras. */
export const semillaSegura = v => { const n = typeof v === 'string' && /^\d{1,15}$/.test(v.trim()) ? Number(v) : v; return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null; };
/** El costo de revisar (US$ por intento) que se suma al precio de cada plano; solo números finitos ≥ 0, y `null` si no hay revisión. */
export const costoRevisionSeguro = c => { if (!c || typeof c !== 'object') return null; const f = x => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0); const r = { qa: f(c.qa), vision: f(c.vision) }; return r.qa || r.vision ? r : null; };
export const precioSeguro = p => { const g = p && typeof p === 'object' ? p.generacion : undefined; return typeof g === 'number' && Number.isFinite(g) && (g > 0 || (g === 0 && p.gratis === true)) ? p : null; };

export function normalizarBrief(b) {
  const r = b && typeof b === 'object' ? b : {};
  return { titulo: cad(r.titulo, 100), objetivo: cad(r.objetivo, 300), publico: cad(r.publico, 200), formato: cad(r.formato, 40), restricciones: cad(r.restricciones, 300) };
}

/**
 * Arma la propuesta. Entrada:
 *   brief      { titulo, objetivo, publico, formato, restricciones }
 *   planos     [{ n?, rol, descripcion, prompt, texto_en_imagen, modelo?, personajes?: [nombre de hoja], producto_refs?, refs?, clave?, ajustes?, semilla? }]
 *   biblia     lo que devuelve biblia.leer(): { existe, error?, estado, version, biblia }
 *   hojas      las hojas de personaje/producto del Cerebro
 *   ctx        { id, modeloUnico?, capsDe(modelo), existeRef(id), preciosPermitidos[], precioPlano(modelo, ajustes) → { generacion, qa?, … }, config?, topeUsd?, maxPlanos? }
 * Salida: { ok, serie, problemas[], presupuesto, costoMostradoUsd, topeUsd, cabe, hash, gasta:false } | { ok:false, codigo, motivo }
 */
export function armarPropuesta({ brief, planos, biblia, hojas = [], ctx = {} } = {}) {
  if (!biblia?.existe || biblia.error || biblia.estado !== 'aprobada') return { ok: false, codigo: 'sin_biblia', motivo: 'Una serie se apoya en la biblia visual APROBADA; todavía no hay una vigente (apruébala primero).' };
  const b = normalizarBrief(brief);
  const dentro = sospechoso(b.titulo, b.objetivo, b.publico, b.formato, b.restricciones);
  if (dentro) return { ok: false, codigo: 'inyeccion', motivo: `El brief trae órdenes escondidas (${dentro}); no se arma la serie.` };
  const lista = Array.isArray(planos) ? planos : [], max = Math.min(ctx.maxPlanos || MAX_PLANOS_SERIE, MAX_PLANOS_SERIE, MAX_PLANOS);
  if (lista.length > max) return { ok: false, codigo: 'larga', motivo: `Una propuesta lleva como mucho ${max} planos (llegaron ${lista.length}); pártela en tandas.` };
  if (!lista.length) return { ok: false, codigo: 'vacia', motivo: 'La serie no tiene planos.' };
  const version = biblia.version, bib = biblia.biblia, anclas = anclasDeBiblia(bib);
  const enBiblia = sospechoso(bib?.nunca, bib?.tono, bib?.luz, bib?.lente, bib?.grano, bib?.composicion, (bib?.paleta || []).map(c => c.rol), (bib?.tipografias || []).map(t => [t.rol, t.nombre]), bib?.logo?.reglas, (bib?.reglas || []).map(x => x.texto));
  if (enBiblia) return { ok: false, codigo: 'inyeccion_biblia', motivo: `La biblia trae órdenes escondidas (${enBiblia}); corrígela antes de armar una serie.` };
  const porNombre = new Map(hojas.map(normalizarHoja).map(h => [h.nombre.toLowerCase(), h]));
  const problemas = [], previos = new Map(), listos = [];
  const saltar = (n, raw, codigo, mensaje) => { problemas.push({ n, codigo, mensaje }); previos.set(n, { ...crearPlano({ ...raw, n }), estado: 'skipped', motivo: mensaje }); };

  lista.slice(0, max).forEach((raw, i) => {
    const n = i + 1, r = raw && typeof raw === 'object' ? raw : {}; // siempre se renumera: dos planos con el mismo n chocarían en la clave de idempotencia
    const susp = sospechoso(r.descripcion, r.prompt, r.texto_en_imagen, r.rol, valoresTexto(r.ajustes), r.modelo); // todo texto de terceros pasa por injectionIn; un plano sospechoso no entra
    if (susp) return saltar(n, { n }, 'inyeccion', `el plano ${n} trae órdenes escondidas (${susp}) y no entra a la serie`);
    const cuerpo = cad(r.prompt, 1500), texto = cad(r.texto_en_imagen, 160);
    if (!cuerpo) return saltar(n, { n, rol: r.rol }, 'prompt', `el plano ${n} no tiene prompt`);
    const modelo = r.modelo || ctx.modeloUnico || null, caps = ctx.capsDe ? ctx.capsDe(modelo) : { maxRefs: Infinity };
    if (!caps) return saltar(n, { n, rol: r.rol }, 'modelo', `el plano ${n} usa un modelo apagado o desconocido (${modelo || 'ninguno'})`);
    const nombres = (Array.isArray(r.personajes) ? r.personajes : []).map(x => cad(x, 80)), usadas = [];
    for (const nm of nombres) { const h = porNombre.get(nm.toLowerCase()); if (!h) return saltar(n, { n, rol: r.rol }, 'hoja', `el plano ${n} nombra «${nm}» y no hay una hoja con ese nombre`); usadas.push(h); }
    const hojaSusp = sospechoso(nombres, usadas.map(h => [h.nombre, h.tipo, h.descripcion, h.rasgos_fijos, h.vestuario, h.vistas, h.refs]));
    if (hojaSusp) return saltar(n, { n, rol: r.rol }, 'inyeccion', `el plano ${n}: la hoja trae órdenes escondidas (${hojaSusp}) y no entra`);
    const pidenFoto = usadas.find(h => h.tipo === 'producto' && !h.refs.length);
    if (pidenFoto) return saltar(n, { n, rol: r.rol }, 'producto', `el plano ${n} usa el producto «${pidenFoto.nombre}», que no tiene su foto real: sin ella no se genera`);
    // lo que el plano dice, sin la biblia, no puede violar un «nunca»; la biblia se cita al final, tal cual, una sola vez
    const viola = violaNunca(`${cuerpo} ${texto}`, bib);
    if (viola.length) return saltar(n, { n, rol: r.rol }, 'nunca', `el plano ${n} incluye lo que la biblia prohíbe: ${viola.join('; ')}`);
    const refsAj = ajustarReferencias({ maxRefs: caps.maxRefs ?? 0, producto: usadas.filter(h => h.tipo === 'producto').flatMap(h => h.refs), // la foto real sale SOLO de la hoja: el plano no la pone
      personaje: usadas.filter(h => h.tipo === 'personaje').flatMap(h => h.refs), biblia: anclas, anterior: idsValidos(r.refs, 12) });
    if (!refsAj.ok) return saltar(n, { n, rol: r.rol }, 'refs', `el plano ${n}: ${refsAj.motivo}`);
    for (const d of refsAj.descartadas) problemas.push({ n, codigo: 'ref_suelta', nivel: 'aviso', mensaje: `el plano ${n} no lleva la referencia ${d.ref} (${d.fuente}): el modelo no admite más` });
    const base = [cuerpo, ...usadas.map(lineaDeHoja)].join('\n'), cita = citarBiblia(base, bib, version);
    const v = verificarPedido({ prompt: cita.prompt, biblia: bib, version, versionPedido: cita.biblia_version });
    if (!v.ok) return saltar(n, { n, rol: r.rol }, 'cita', `el plano ${n}: ${v.motivos.join(' ')}`);
    listos.push({ n, rol: ROLES.has(String(r.rol)) ? String(r.rol) : 'desarrollo', descripcion: cad(r.descripcion, 300), refs: refsAj.refs, prompt_exacto: cita.prompt, texto_en_imagen: texto, modelo, ajustes: r.ajustes && typeof r.ajustes === 'object' ? r.ajustes : {}, semilla: semillaSegura(r.semilla), clave: !!r.clave });
  });

  if (!listos.length) return { ok: false, codigo: 'sin_planos', motivo: 'Ningún plano pasó las comprobaciones.', problemas };
  const v = validarEscaleta(listos, { capsDe: ctx.capsDe, existeRef: ctx.existeRef, preciosPermitidos: ctx.preciosPermitidos, maxPlanos: max });
  if (!v.ok && !v.planos.length) return { ok: false, codigo: 'vacia', motivo: v.problemas[0]?.mensaje || 'no quedó ningún plano válido' };
  for (const p of v.problemas) problemas.push(p);
  const todos = [...v.planos, ...previos.values()].sort((a, c) => a.n - c.n);
  const serie = { id: ctx.id || null, titulo: b.titulo, brief: b, biblia_version: version, modelo_unico: ctx.modeloUnico || null, estado: 'previsto', escaleta: todos, tope_usd: ctx.topeUsd ?? ctx.config?.topeSerieUsd ?? 10 };
  const vivos = todos.filter(p => p.estado !== 'skipped');
  if (!vivos.length) return { ok: false, codigo: 'sin_planos', motivo: 'Ningún plano pasó las comprobaciones.', problemas };
  const rev = costoRevisionSeguro(ctx.costoRevision); // 11.4: con la revisión por visión encendida, su costo por intento entra al total mostrado
  const precios = vivos.map(p => { const b = precioSeguro(ctx.precioPlano ? ctx.precioPlano(p.modelo, p.ajustes) : null); return b && rev ? { ...b, qa: (b.qa ?? 0) + rev.qa, vision: (b.vision ?? 0) + rev.vision } : b; });
  const sinPrecio = vivos.filter((_, i) => !precios[i]);
  const presupuesto = presupuestoSerie(serie, precios.map(x => x || {}), ctx.config);
  if (sinPrecio.length) { presupuesto.cabe = false; presupuesto.incompleto = true; presupuesto.maximoUsd = null; problemas.push({ n: null, codigo: 'precio_desconocido', nivel: 'aviso', mensaje: `no se pudo calcular el precio de los planos ${sinPrecio.map(p => p.n).join(', ')}: no se muestra un costo falso y la serie no cabe hasta que lo tenga` }); }
  else if (!presupuesto.cabe) problemas.push({ n: null, codigo: 'tope', nivel: 'aviso', mensaje: `el costo máximo (US$${presupuesto.maximoUsd}) pasa del tope de la serie (US$${presupuesto.topeUsd}): baja planos, usa un modelo más barato o sube el tope` });
  return { ok: true, serie, problemas, presupuesto, costoMostradoUsd: sinPrecio.length ? null : presupuesto.maximoUsd, topeUsd: presupuesto.topeUsd, cabe: presupuesto.cabe, hash: hashEscaleta(serie), gasta: false, incluyeRevision: !!rev, omitidos: todos.length - vivos.length };
}

/** Resumen corto para el chat/tarjeta (≤ 1.200 caracteres): nunca el prompt entero. */
export function resumenPropuesta(p) {
  if (!p?.ok) return cad(p?.motivo || 'sin propuesta', 300);
  const l = p.serie.escaleta.map(x => `${x.n}. ${x.estado === 'skipped' ? '✗ ' + cad(x.motivo, 80) : cad(x.descripcion || x.rol, 70)}`);
  return cad(`Serie «${p.serie.titulo}» · biblia v${p.serie.biblia_version} · ${p.serie.escaleta.length} planos (${p.omitidos} omitidos) · costo máximo ${p.incluyeRevision ? '' : 'de generación '}${p.costoMostradoUsd == null ? 'SIN CALCULAR' : 'US$' + p.costoMostradoUsd} ${p.incluyeRevision ? '(con QA y visión por intento)' : '(sin QA ni visión)'} de un tope de US$${p.topeUsd}${p.cabe ? '' : ' (NO cabe)'} · no gasta nada hasta GENERAR\n${l.join('\n')}`, 1200);
}
