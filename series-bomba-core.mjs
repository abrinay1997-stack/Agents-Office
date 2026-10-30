// Agents Office (30 oct 2026) — Series en la nube, N0 (carril K): las DECISIONES de la bomba de series, puras. Las comparten la oficina local y, más adelante,
// el reloj de la nube. Sin E/S, sin reloj propio, sin llamar a ningún modelo: devuelven QUÉ hacer; quien llama lo hace (en local sobre un archivo, en la nube sobre D1).
// Se extrajo del generador local SIN cambiar su comportamiento (sus tests, los de causa y los de motores, siguen idénticos).
// REGLA DEL DINERO: de aquí solo sale un paso de gasto por `siguientePaso` (token + hash vigentes); una duda sobre un motor de pago es `incierto`, nunca `liberado`.
import { transicion, siguientePaso } from './serie-core.mjs';

const FLAG_GENERAR = 'dimitri.serieGenerar'; // (el único otro sitio que lo nombra es el generador local; ambos están en la lista permitida de tests/series-generar.test.mjs 18c)
export const MUESTRA = 3; // planos de la muestra (el mismo 3 de serie-core.siguientePaso)
export const TRANSITORIAS = new Set(['espera', 'tiempo', 'red', 'servicio']); // clases de errores.mjs que merecen el reintento automático
export const PARA_PAUSAR = new Set(['key', 'saldo']); // sin crédito o sin key: no es culpa del plano, se pausa la serie entera
export const GRATIS = new Set(['prueba', 'prueba-video', 'local']); // falla cerrado: todo motor que no sea uno de estos (o que no se resuelva) cuenta como de PAGO
export const pagadoDe = engine => !GRATIS.has(engine);
export const AUTORIZACION_MS = 6 * 3600e3; // una autorización caduca aunque no haya reinicio (6 h, igual en local y en la nube)
export const esCarrusel = s => /carrusel/i.test(s?.brief?.formato || ''); // el formato del brief, no el título

// ---- forma de una serie guardada (la misma en el archivo local y en D1) ----
export const ID_SERIE_OK = /^[\w-]{1,60}$/;
const esObjeto = o => !!o && typeof o === 'object' && !Array.isArray(o);
export const serieValida = s => esObjeto(s) && typeof s.id === 'string' && ID_SERIE_OK.test(s.id) && Array.isArray(s.escaleta) && s.escaleta.every(esObjeto) && typeof s.estado === 'string';
export const normalizarSerie = s => ({ ...s, intentos: esObjeto(s.intentos) ? s.intentos : {}, pasos: esObjeto(s.pasos) ? s.pasos : {}, fallos: esObjeto(s.fallos) ? s.fallos : {}, libro: esObjeto(s.libro) && esObjeto(s.libro.lineas) ? s.libro : null,
  escaleta: s.escaleta.map(p => ({ ...p, versiones: Array.isArray(p.versiones) ? p.versiones : [], refs: Array.isArray(p.refs) ? p.refs : [] })) }); // una serie malformada no puede hacer lanzar a la bomba en cada tick

export const autorizacionDe = s => (s.autorizado ? { ok: true, serieId: s.id, hash: s.autorizado.hash, topeMax: s.autorizado.topeMax } : null);

/** Lo que haría la bomba AHORA. `series`: todas (copias); `ctx`: { activo, ahora, autorizacionMs, concurrencia }.
 *  → { tipo: 'pausar_todas', ids, motivo } | { tipo: 'nada', motivo } | { tipo: 'caducada', id, motivo } | { tipo: 'terminar', id } | { tipo: 'pausar', id, motivo } | { tipo: 'muestra_lista', id } | { tipo: 'gasto', id, paso } */
export function planificarPaso(series, { activo = false, ahora = 0, autorizacionMs = AUTORIZACION_MS, concurrencia = 1 } = {}) {
  const l = Array.isArray(series) ? series : [];
  if (!activo) { // apagar el flag PAUSA lo que corría (sin plano en el aire): al volver a encenderlo no se reanuda con una autorización vieja, hace falta otro clic
    const ids = l.filter(x => (x.estado === 'muestra' || x.estado === 'corriendo') && !x.escaleta.some(p => p.estado === 'corriendo')).map(x => x.id);
    return { tipo: 'pausar_todas', ids, motivo: `generar series se apagó (${FLAG_GENERAR}): vuelve a pedir el clic para seguir` };
  }
  const enVuelo = l.reduce((n, s) => n + s.escaleta.filter(p => p.estado === 'corriendo').length, 0);
  if (enVuelo >= concurrencia) return { tipo: 'nada', motivo: 'concurrencia' };
  // una serie con la muestra lista espera TU decisión: no debe quitarle el turno a las demás
  const s = l.filter(x => x.estado === 'corriendo' || (x.estado === 'muestra' && !x.muestra_lista)).sort((a, b) => a.creada - b.creada)[0];
  if (!s) return { tipo: 'nada', motivo: 'sin series' };
  if (s.autorizado && ahora - s.autorizado.en > autorizacionMs) {
    return s.escaleta.some(p => p.estado === 'corriendo') ? { tipo: 'nada', motivo: 'caducada_con_plano_en_el_aire' } : { tipo: 'caducada', id: s.id, motivo: 'la autorización caducó (pasaron más de 6 horas): vuelve a pedir el clic para seguir' };
  }
  if (!s.escaleta.some(p => p.estado === 'previsto')) return s.escaleta.some(p => p.estado === 'corriendo') ? { tipo: 'nada', motivo: 'esperando lo que va en el aire' } : { tipo: 'terminar', id: s.id };
  const paso = siguientePaso(s, { autorizacion: autorizacionDe(s) });
  if (paso.tipo === 'gasto') return { tipo: 'gasto', id: s.id, paso };
  if (paso.codigo === 'sin_autorizacion') return { tipo: 'pausar', id: s.id, motivo: 'la escaleta cambió desde que autorizaste: revísala y vuelve a pedir el clic' };
  if (paso.codigo === 'muestra_lista' && !s.muestra_lista) return { tipo: 'muestra_lista', id: s.id };
  return { tipo: 'nada', motivo: paso.codigo || paso.tipo };
}

/** La serie ya no tiene nada que generar: pasa a «hecho» (la muestra, por «corriendo» con la misma autorización). → la serie nueva o `undefined` si no se puede. */
export function cerrarSerie(y, ahora) {
  let cur = y;
  if (cur.estado === 'muestra') { const r = transicion(cur, 'corriendo', { autorizacion: autorizacionDe(y) }); if (!r.ok) return undefined; cur = r.serie; }
  const h = transicion(cur, 'hecho');
  return h.ok ? { ...h.serie, autorizado: null, token_reg: null, fin: ahora } : undefined;
}

/** Cómo termina un paso que estaba en el aire, a partir del TRABAJO del Estudio (o de su ausencia). No toca nada: dice qué hacer.
 *  `e`: { hayPaso, apuntoJob (el paso ya tiene el id del trabajo), job: null | { state, items, cost, causa, errorClass, remote, aceptado, error }, pagado, genUsd, fallos (cuántos van en este plano), reintentosMax, cancelada, n }
 *  → { libro: null | 'liquidar' | 'liberar' | 'incierto', real, pasoEstado, plano: { estado, motivo } | { version: true }, pausa, pausaSiExcede, devolverUso, contarFallo } */
export function decidirResolucion(e) {
  const { n, job: j, pagado } = e;
  const volver = (estado, motivo) => ({ estado, motivo: motivo || null });
  if (!e.hayPaso) return { libro: null, pasoEstado: null, plano: volver('previsto'), pausa: null, devolverUso: 0, contarFallo: false }; // sin paso apuntado no se reservó nada
  if (!j && !e.apuntoJob) return { libro: 'liberar', pasoEstado: 'liberado', plano: volver('previsto'), pausa: null, devolverUso: 1, contarFallo: false }; // se cayó ANTES de llamar al motor: nunca salió
  if (!j) {
    if (pagado) return { libro: 'incierto', pasoEstado: 'incierto', plano: volver('revisar', 'puede haberse cobrado: el trabajo ya no aparece en el Estudio'), pausa: `el plano ${n} puede haberse cobrado y no se sabe cómo acabó: decide si hubo cobro`, devolverUso: 0, contarFallo: false };
    return { libro: 'liberar', pasoEstado: 'liberado', plano: volver('previsto'), pausa: null, devolverUso: 0, contarFallo: false };
  }
  if (j.state === 'done' && j.items?.length) {
    // en pago, un «hecho» sin costo no borra el gasto: como mínimo se liquida lo estimado para generar
    const real = pagado ? (j.cost > 0 ? j.cost : (e.genUsd ?? 0)) : Math.max(0, +j.cost || 0);
    return { libro: 'liquidar', real, pasoEstado: 'liquidado', plano: { version: true, archivo: j.items[0] }, pausa: null, pausaSiExcede: `el plano ${n} costó más de lo reservado: revisa antes de seguir`, devolverUso: 0, contarFallo: false };
  }
  // fallido: la CAUSA estructurada que pone el Estudio (nunca el texto del error). En un motor de PAGO, todo lo que no sea claramente previo al cobro queda «incierto»
  const causa = j.causa || '', clase = j.errorClass || '', aceptado = !!j.remote || j.aceptado === true; // `remote` o `aceptado` = el proveedor ya tomó el pedido: nunca es previo al cobro
  const previo = (causa === 'previo' || causa === 'cancelado_en_cola') && !aceptado;
  if (pagado && !previo) return { libro: 'incierto', pasoEstado: 'incierto', plano: volver('revisar', `puede haberse cobrado (${causa || 'causa desconocida'}): decide si hubo cobro`), pausa: `el plano ${n} puede haberse cobrado y no se sabe cómo acabó: decide si hubo cobro`, devolverUso: 0, contarFallo: false };
  const base = { libro: 'liberar', pasoEstado: 'liberado', pausa: null, devolverUso: 0 };
  if (causa === 'cancelado' || causa === 'cancelado_en_cola' || causa === 'interrumpido' || e.cancelada) return { ...base, plano: volver('previsto'), contarFallo: false }; // gratis (o cancelado antes de salir): se repite sin contar como fallo
  if (PARA_PAUSAR.has(clase)) return { ...base, plano: volver('previsto'), pausa: j.error || 'sin saldo o sin key en el motor', contarFallo: false };
  if (TRANSITORIAS.has(clase) && (e.fallos || 0) + 1 <= e.reintentosMax) return { ...base, plano: volver('previsto'), contarFallo: true };
  return { ...base, plano: volver('revisar', j.error || 'falló'), pausa: `el plano ${n} falló: ${j.error || 'sin motivo'}`, contarFallo: TRANSITORIAS.has(clase) };
}
