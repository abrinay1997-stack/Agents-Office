// Agents Office — Fase 11.0 (carril K, plan K §4, §13): el núcleo PURO de una serie de imágenes (storyboard, carruseles del mes).
// Sin E/S, sin reloj propio (el `ahora` y el nonce llegan de fuera), sin llamar a ningún modelo. Lo comparten local y nube.
// REGLA DEL DINERO: ninguna función de aquí devuelve una acción que gaste sin el token de un solo uso Y el hash de la escaleta.
import { estimarSerie, cabeEnTope } from './serie-topes-core.mjs';
export * from './serie-topes-core.mjs';
export * as deriva from './serie-deriva-core.mjs';

export const ESTADOS = ['previsto', 'espera_ok', 'muestra', 'corriendo', 'pausado', 'hecho', 'cancelado'];
export const TRANSICIONES = {
  previsto: ['espera_ok', 'muestra', 'cancelado'], espera_ok: ['previsto', 'muestra', 'cancelado'], muestra: ['corriendo', 'pausado', 'cancelado'],
  corriendo: ['pausado', 'hecho', 'cancelado'], pausado: ['muestra', 'corriendo', 'cancelado'], hecho: [], cancelado: [],
};
const CON_GASTO = new Set(['muestra', 'corriendo']); // entrar a estos estados pone la bomba a trabajar: exige autorización
export const TANDA_MAX = 8; // planos que escribe UNA llamada de servidor (plan §13.7 K1-04)
export const MAX_PLANOS = 300;
export const ESTADOS_PLANO = ['previsto', 'corriendo', 'listo', 'revisar', 'skipped', 'omitido'];

// ---- Máquina de estados ----
export const puedeIr = (de, a) => !!TRANSICIONES[de] && TRANSICIONES[de].includes(a);
export function transicion(serie, a, { autorizacion, motivo } = {}) {
  const de = serie?.estado;
  if (!puedeIr(de, a)) return { ok: false, codigo: 'transicion', motivo: `una serie ${de} no puede pasar a ${a}` };
  if (CON_GASTO.has(a) && !autorizacionValida(serie, autorizacion)) return { ok: false, codigo: 'sin_autorizacion', motivo: 'gastar o reanudar exige el clic del dueño (token de un solo uso + hash de la escaleta)' };
  return { ok: true, serie: { ...serie, estado: a, ...(a === 'pausado' ? { pausa_motivo: motivo || 'sin motivo' } : { pausa_motivo: null }) } };
}

// ---- Plano y sus versiones ----
export function crearPlano(d = {}) {
  return { n: d.n, rol: d.rol || 'desarrollo', descripcion: d.descripcion || '', refs: Array.isArray(d.refs) ? [...d.refs] : [], prompt_exacto: d.prompt_exacto || '', texto_en_imagen: d.texto_en_imagen || '',
    modelo: d.modelo || null, ajustes: d.ajustes || {}, semilla: d.semilla ?? null, clave: !!d.clave, estado: 'previsto', motivo: null, versiones: [], version: 0, aprobada_version: null };
}
export function nuevaVersion(plano, datos = {}) { // cada intento o edición es una versión; nada se pisa
  const v = (plano.version || 0) + 1;
  return { ...plano, version: v, estado: 'listo', versiones: [...plano.versiones, { v, archivo: datos.archivo || null, intento: datos.intento ?? 1, prompt: datos.prompt || plano.prompt_exacto, modelo: datos.modelo || plano.modelo, semilla: datos.semilla ?? plano.semilla, costo_usd: datos.costo_usd ?? 0, qa: datos.qa || null }] };
}
export function aprobarVersion(plano, v) { // aprobación POR versión: si el plano cambió después, la aprobación vieja no vale
  if (v !== plano.version) return { ok: false, codigo: 'version', motivo: `el plano ya va por la versión ${plano.version}; revisa esa antes de aprobar` };
  return { ok: true, plano: { ...plano, aprobada_version: v } };
}
export const aprobacionVigente = plano => plano.aprobada_version != null && plano.aprobada_version === plano.version;

// ---- Escaleta: validar sin recortar nada en silencio ----
const RE_PRECIO = /(?:US\$|\$|B\/\.?)\s?\d[\d.,]*/g;
const normPrecio = s => String(s).replace(/\s/g, '').replace(/^US/i, '').toLowerCase();
// ctx: { capsDe(modelo) -> {maxRefs, edit} | null, existeRef(id) -> bool (opcional), preciosPermitidos: string[], maxPlanos }
export function validarEscaleta(escaleta, ctx = {}) {
  const problemas = [], l = Array.isArray(escaleta) ? escaleta : [], max = ctx.maxPlanos || MAX_PLANOS;
  if (!l.length) return { ok: false, planos: [], problemas: [{ n: null, codigo: 'vacia', mensaje: 'la escaleta no tiene planos' }] };
  if (l.length > max) problemas.push({ n: null, codigo: 'larga', mensaje: `la escaleta pasa de ${max} planos` });
  const permitidos = new Set((ctx.preciosPermitidos || []).map(normPrecio)), vistos = new Set();
  const planos = l.slice(0, max).map((raw, i) => {
    const p = crearPlano({ ...raw, n: raw?.n ?? i + 1 }), skip = (codigo, mensaje) => { problemas.push({ n: p.n, codigo, mensaje }); return { ...p, estado: 'skipped', motivo: mensaje }; };
    if (!Number.isInteger(p.n) || p.n < 1 || vistos.has(p.n)) return skip('numero', `el número de plano ${p.n} no es válido o está repetido`);
    vistos.add(p.n);
    if (!p.prompt_exacto.trim()) return skip('prompt', `el plano ${p.n} no tiene prompt`);
    const caps = ctx.capsDe ? ctx.capsDe(p.modelo) : { maxRefs: Infinity };
    if (!caps) return skip('modelo', `el plano ${p.n} usa un modelo apagado o desconocido (${p.modelo || 'ninguno'})`);
    if (p.refs.length > (caps.maxRefs ?? 0)) return skip('refs', `el plano ${p.n} lleva ${p.refs.length} referencias y ${p.modelo} admite ${caps.maxRefs || 0}; no se recorta en silencio`);
    const falta = ctx.existeRef ? p.refs.find(r => !ctx.existeRef(r)) : null;
    if (falta) return skip('ref_perdida', `el plano ${p.n} cita una referencia que ya no está en la galería (${falta})`);
    const ajeno = [...(p.prompt_exacto + ' ' + p.texto_en_imagen).matchAll(RE_PRECIO)].map(m => m[0]).find(x => !permitidos.has(normPrecio(x)));
    if (ajeno) return skip('precio', `el plano ${p.n} nombra un precio (${ajeno}) que no sale del catálogo ni de las cifras`);
    return p;
  });
  return { ok: !problemas.some(x => x.n === null) , planos, problemas, omitidos: planos.filter(p => p.estado === 'skipped').length };
}
export function tandas(total, por = TANDA_MAX) { const t = []; for (let d = 1; d <= total; d += por) t.push({ desde: d, hasta: Math.min(total, d + por - 1) }); return t; }
export function validarTanda(planosNuevos) { return Array.isArray(planosNuevos) && planosNuevos.length > 0 && planosNuevos.length <= TANDA_MAX ? { ok: true } : { ok: false, codigo: 'tanda', motivo: `una llamada escribe de 1 a ${TANDA_MAX} planos` }; }

// ---- Hash de la escaleta (SHA-256 síncrono, para no depender de node:crypto en el Worker) ----
const K = Uint32Array.from('428a2f98 71374491 b5c0fbcf e9b5dba5 3956c25b 59f111f1 923f82a4 ab1c5ed5 d807aa98 12835b01 243185be 550c7dc3 72be5d74 80deb1fe 9bdc06a7 c19bf174 e49b69c1 efbe4786 0fc19dc6 240ca1cc 2de92c6f 4a7484aa 5cb0a9dc 76f988da 983e5152 a831c66d b00327c8 bf597fc7 c6e00bf3 d5a79147 06ca6351 14292967 27b70a85 2e1b2138 4d2c6dfc 53380d13 650a7354 766a0abb 81c2c92e 92722c85 a2bfe8a1 a81a664b c24b8b70 c76c51a3 d192e819 d6990624 f40e3585 106aa070 19a4c116 1e376c08 2748774c 34b0bcb5 391c0cb3 4ed8aa4a 5b9cca4f 682e6ff3 748f82ee 78a5636f 84c87814 8cc70208 90befffa a4506ceb bef9a3f7 c67178f2'.split(' ').map(h => parseInt(h, 16)));
export function sha256(texto) {
  const b = new TextEncoder().encode(String(texto)), len = b.length, tot = ((len + 9 + 63) >> 6) << 6, m = new Uint8Array(tot);
  m.set(b); m[len] = 0x80; const dv = new DataView(m.buffer); dv.setUint32(tot - 8, Math.floor((len * 8) / 2 ** 32)); dv.setUint32(tot - 4, (len * 8) >>> 0);
  let h = Uint32Array.of(0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19); const w = new Uint32Array(64), rr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < tot; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), c = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + a + w[i - 7] + c) >>> 0; }
    let [a, b2, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) { const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) >>> 0; hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b2; b2 = a; a = (t1 + t2) >>> 0; }
    h = Uint32Array.of(h[0] + a, h[1] + b2, h[2] + c, h[3] + d, h[4] + e, h[5] + f, h[6] + g, h[7] + hh);
  }
  return [...h].map(x => x.toString(16).padStart(8, '0')).join('');
}
const canon = v => Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',')}}` : JSON.stringify(v ?? null);
// Solo lo que cambia lo que se genera (no el estado, ni las versiones, ni los comentarios): cambiar un prompt o una ref invalida la autorización.
export function hashEscaleta(serie) {
  const e = (serie?.escaleta || []).map(p => ({ n: p.n, rol: p.rol, descripcion: p.descripcion, refs: p.refs, prompt_exacto: p.prompt_exacto, texto_en_imagen: p.texto_en_imagen, modelo: p.modelo, ajustes: p.ajustes, semilla: p.semilla }));
  return sha256(canon({ biblia_version: serie?.biblia_version ?? null, modelo_unico: serie?.modelo_unico ?? null, e }));
}

// ---- Idempotencia: la clave es pura; persistirla con CAS ANTES de llamar al motor vendrá en 11.3 ----
export const claveIdempotencia = (serieId, n, intento) => {
  if (typeof serieId !== 'string' || !/^[\w-]+$/.test(serieId) || !Number.isInteger(n) || n < 1 || !Number.isInteger(intento) || intento < 1) throw new Error('clave de idempotencia inválida');
  return `${serieId}:${n}:${intento}`;
};
export const parsearClave = c => { const m = /^([\w-]+):(\d+):(\d+)$/.exec(String(c)); return m ? { serieId: m[1], n: +m[2], intento: +m[3] } : null; };

// ---- Token de GENERAR SERIE (un solo uso, atado a la escaleta y al tope) ----
export function emitirToken({ serieId, hash, topeMax, costoMostrado, ahora, nonce, ttlMs = 120000 }) {
  if (typeof nonce !== 'string' || nonce.length < 16) throw new Error('el nonce debe ser aleatorio y de al menos 16 caracteres');
  if (!(topeMax > 0) || !(costoMostrado >= 0) || !hash || !serieId || !Number.isFinite(ahora)) throw new Error('faltan datos para emitir el token');
  return { token: nonce, serieId, hash, topeMax, costoMostrado, emitido: ahora, vence: ahora + ttlMs, usado: false };
}
const igualSeguro = (a, b) => { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };
// pres: lo que llega con el clic { token, serieId, hash (CALCULADO en el servidor sobre la escaleta de ahora), topeMax, costoActual }. Devuelve la autorización (o el motivo del 409).
export function verificarToken(registro, pres, ahora) {
  const no = (codigo, motivo) => ({ ok: false, codigo, motivo });
  if (!registro || !pres) return no('token', 'falta el token');
  if (registro.usado) return no('usado', 'ese token ya se usó');
  if (!(ahora < registro.vence)) return no('vencido', 'el token venció; pídelo otra vez');
  if (!igualSeguro(registro.token, pres.token ?? '')) return no('token', 'token inválido');
  if (pres.serieId !== registro.serieId) return no('serie', 'el token es de otra serie');
  if (pres.hash !== registro.hash) return no('hash', 'la escaleta cambió desde que se mostró el costo; revísala y vuelve a pedir el clic');
  if (pres.topeMax !== registro.topeMax) return no('tope', 'el tope no es el que se mostró');
  if (pres.costoActual > registro.costoMostrado || pres.costoActual > registro.topeMax) return no('costo', 'el costo supera lo que se mostró o el tope');
  return { ok: true, serieId: registro.serieId, hash: registro.hash, topeMax: registro.topeMax, token: registro.token };
}
export const consumirToken = registro => ({ ...registro, usado: true });
// La autorización solo vale para ESTA escaleta tal como está ahora (hash recalculado) y esta serie.
export function autorizacionValida(serie, a) { return !!(a && a.ok === true && a.serieId === serie?.id && a.hash && a.hash === hashEscaleta(serie) && a.topeMax > 0); }

// ---- El único productor de acciones de gasto ----
// Devuelve el siguiente paso de la serie. Un paso de gasto SOLO sale con autorización válida (token + hash) y con serie en estado de gasto.
export function siguientePaso(serie, { autorizacion } = {}) {
  if (!serie || !CON_GASTO.has(serie.estado)) return { tipo: 'espera', motivo: `la serie está ${serie?.estado || 'sin estado'}` };
  if (!autorizacionValida(serie, autorizacion)) return { tipo: 'espera', codigo: 'sin_autorizacion', motivo: 'falta el token de un solo uso o la escaleta cambió' };
  const lim = serie.estado === 'muestra' ? 3 : Infinity, hechos = serie.escaleta.filter(p => p.estado === 'listo' || p.estado === 'revisar').length;
  if (serie.estado === 'muestra' && hechos >= lim) return { tipo: 'espera', codigo: 'muestra_lista', motivo: 'la muestra de 3 planos está lista; el dueño la compara y decide' };
  const p = serie.escaleta.find(x => x.estado === 'previsto');
  if (!p) return { tipo: 'fin', motivo: 'no quedan planos por generar' };
  return { tipo: 'gasto', n: p.n, plano: p, intento: (p.versiones.length || 0) + 1, topeMax: autorizacion.topeMax };
}

// ---- Referencias: prioridad de huecos (plan §13.4) ----
// producto > personaje > biblia > plano anterior. Producto y personaje son obligatorios: si no caben, el plano se rechaza (y pausa). Lo demás se suelta CON aviso.
export function ajustarReferencias({ maxRefs = 0, producto = [], personaje = [], biblia = [], anterior = [] } = {}) {
  const u = a => [...new Set(a || [])], P = u(producto), Pe = u(personaje).filter(x => !P.includes(x)), B = u(biblia).filter(x => !P.includes(x) && !Pe.includes(x)), A = u(anterior).filter(x => ![...P, ...Pe, ...B].includes(x));
  if (P.length + Pe.length > maxRefs) return { ok: false, rechazo: true, refs: [], descartadas: [], motivo: `el producto y el personaje (${P.length + Pe.length}) no caben en las ${maxRefs} referencias del modelo; no se genera con él` };
  const refs = [...P, ...Pe]; const descartadas = [];
  for (const [fuente, lista] of [['biblia', B], ['anterior', A]]) for (const r of lista) (refs.length < maxRefs ? refs.push(r) : descartadas.push({ ref: r, fuente }));
  return { ok: true, refs, descartadas };
}

// ---- Operaciones de serie que Dimitri puede proponer ----
export const OPS_SERIE = ['serie_proponer', 'serie_editar_escaleta', 'serie_pausar', 'serie_cancelar', 'serie_a_calendario'];
export const OPS_GASTO_SERIE = ['serie_generar', 'serie_reanudar']; // solo con el clic del dueño; MCP y agentes las rechazan
const PROHIBIDO_ESTADO = /^(aprobad[ao]|programad[ao]|publicad[ao]|approved|scheduled|published)$/i, PROHIBIDO_CLAVE = /^(aprobar|aprobada_por|programar|programada_para|publicar|meta|scheduled_publish_time|cuentas_meta)$/i;
function tocaPublicacion(v, ruta = '') {
  if (Array.isArray(v)) return v.map((x, i) => tocaPublicacion(x, `${ruta}[${i}]`)).find(Boolean) || null;
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (PROHIBIDO_CLAVE.test(k) && x) return `${ruta}.${k}`; if (k === 'estado' && typeof x === 'string' && PROHIBIDO_ESTADO.test(x)) return `${ruta}.estado=${x}`; const r = tocaPublicacion(x, `${ruta}.${k}`); if (r) return r; }
  return null;
}
// §13.1: «programarlas» = pieza en revisión, por:'dimitri'. Una op de serie nunca aprueba, programa ni publica. Devuelve {ok} o {ok:false, motivo}.
export function validarOpSerie(op, { por } = {}) {
  const tipo = op?.tipo || op?.type;
  if (OPS_GASTO_SERIE.includes(tipo)) return por === 'dueno' ? { ok: true, gasto: true } : { ok: false, codigo: 'gasto', motivo: `${tipo} gasta: solo el clic del dueño la ejecuta (no un agente, ni el asistente, ni un MCP)` };
  if (!OPS_SERIE.includes(tipo)) return { ok: false, codigo: 'tipo', motivo: `${tipo} no es una operación de serie` };
  const donde = tocaPublicacion(op); if (donde) return { ok: false, codigo: 'publicacion', motivo: `una operación de serie no aprueba, programa en Meta ni publica (${donde})` };
  if (tipo === 'serie_a_calendario' && op.estado !== undefined && op.estado !== 'revision') return { ok: false, codigo: 'estado', motivo: 'las piezas de una serie entran al calendario solo en estado revision' };
  if (tipo === 'serie_a_calendario' && op.por !== undefined && op.por !== 'dimitri') return { ok: false, codigo: 'por', motivo: 'las piezas de una serie las deja Dimitri (por: dimitri)' };
  return { ok: true, gasto: false };
}
// Resumen para la tarjeta: estimación + si cabe en el tope. Pura; no gasta ni reserva.
export function presupuestoSerie(serie, precios, config) {
  const est = estimarSerie(precios, config), tope = serie?.tope_usd ?? config?.topeSerieUsd ?? 10;
  return { ...est, topeUsd: tope, cabe: cabeEnTope(est, tope) };
}
