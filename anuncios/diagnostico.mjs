// ============================================================
// Agents Office — Anuncios de Meta, Fase A5 (9 oct 2026): EL DIAGNÓSTICO. Puro: sin red, sin disco, sin reloj propio (la hora entra).
// docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §5 (Fase A5) y §7 (las 10 reglas).
//
// Con la vista de la cuenta (anuncios/modelo.mjs → armarVista, rango 7d: campañas → conjuntos → anuncios, con estados, aprendizaje y
// cifras), las filas diarias de insights (level=ad), el costo objetivo, los umbrales (biblioteca/marketing/campanas-pagadas/umbrales.json,
// o el del dueño en su Cerebro, que gana) y el reloj, devuelve SUGERENCIAS. Cada una dice qué dato la motiva (con la cifra), por qué,
// el cambio exacto (una acción de la A2, un borrador, creativos nuevos, revisar o impulsar), el efecto esperado y el riesgo.
// NUNCA hace nada: aplicar es del dueño (anuncios/sugerencias.mjs → anuncios/acciones.mjs, con sus dos clics si gasta), y el piloto
// automático (anuncios/piloto.mjs) solo puede pausar.
//
// Las reglas (§7), en el orden en que se miran:
//   rechazado · problemas   un anuncio que Meta rechazó (→ ada propone el texto corregido como borrador) o que tiene problemas (→ el motivo)
//   cuenta                  la cuenta con un pago pendiente o desactivada, o el gasto cerca de un tope
//   cortar                  gastó 2× el costo objetivo sin resultados, o 3× con un costo por resultado de más de 2× → pausar (baja el gasto)
//   aprendizaje             un conjunto aprendiendo NO se toca (solo se dice, en `notas`), salvo algo roto (lo de arriba)
//   esperar                 menos de 3 días con gasto o menos de 1× el objetivo gastado: no se juzga todavía (en `notas`)
//   fatiga                  frecuencia > 3 y el CTR un 30 % o más por debajo de sus primeros días → creativos nuevos, NO subir presupuesto
//   escalar                 fuera del aprendizaje, 3 días seguidos con el costo un 20 % o más bajo el objetivo → +20 % (gasta: dos clics),
//                           como mucho una vez cada 72 h y dentro de los topes
//   limitado                aprendizaje limitado → juntar, abrir el público, más presupuesto u optimizar más arriba (revisar)
//   estructura              más de 3 conjuntos parecidos que no salen del aprendizaje → juntarlos (y no se dice «limitado» de cada uno)
//   impulsar                una publicación con 3× las interacciones de la media de su red → impulsarla (Fase A4)
// AGRUPA: un objeto lleva una sola sugerencia (la más urgente); si todos los anuncios de un conjunto se cortan o se cansan, se dice del
// conjunto entero. Lo que no se puede medir se dice («sin píxel no sé cuántas compras vinieron del anuncio»), nunca se inventa.
// Ningún número suelto: todo umbral sale de `umbrales` (validarUmbrales lo comprueba, y `npm run check` puede llamarlo).
// ============================================================
import { cifras, resultadoDe, sumarDias, diasEntre, cuentaEstado, fechaEn } from './modelo.mjs';
import { evaluar, dinero } from './topes.mjs';

export const REGLAS = ['aprendizaje', 'limitado', 'esperar', 'cortar', 'fatiga', 'escalar', 'estructura', 'rechazado', 'problemas', 'cuenta', 'impulsar'];
/** Los tipos de cambio: los de anuncios/acciones.mjs (A2) y lo que no toca Meta. */
export const CAMBIOS = ['pausar', 'bajar_presupuesto', 'archivar', 'activar', 'reanudar', 'subir_presupuesto', 'alargar', 'relanzar', 'borrador', 'creativos', 'revisar', 'impulsar'];
/** Los que gastan (los DE_GASTO de anuncios/acciones.mjs; tests/anuncios-diagnostico.test.mjs comprueba que son los mismos). */
export const GASTA = new Set(['activar', 'reanudar', 'subir_presupuesto', 'alargar', 'relanzar']);
export const UMBRALES_REQUERIDOS = ['aprendizajeResultados', 'aprendizajeDias', 'esperarDias', 'esperarGastoCpa', 'cortarSinResultadoCpa', 'cortarGastoCpa', 'cortarCostoCpa', 'fatigaFrecuencia', 'fatigaFrecuenciaCritica', 'fatigaCaidaCtr', 'fatigaDiasBase', 'fatigaDiasRecientes', 'fatigaMinImpresiones', 'escalarBajoObjetivo', 'escalarDias', 'escalarSubida', 'escalarCadaHoras', 'saltoGrande', 'estructuraConjuntos', 'topeCerca', 'organicoVecesMedia', 'organicoMinPublicaciones', 'organicoDias', 'descartarDias', 'posponerDias', 'resultadoDias'];
const FRACCION = 'fracción';

// ---------------------------------------------------------------- los umbrales

/** Lo que debe tener umbrales.json; devuelve los problemas en palabras (vacío = bien). `parcial`: el del dueño, que puede traer solo algunos. */
export function validarUmbrales(j, { parcial = false } = {}) {
  const mal = [];
  if (!j || typeof j !== 'object' || !j.umbrales || typeof j.umbrales !== 'object') return ['falta el objeto «umbrales»'];
  for (const k of Object.keys(j.umbrales)) if (!UMBRALES_REQUERIDOS.includes(k)) mal.push(`«${k}» no es un umbral que la oficina use`);
  for (const k of UMBRALES_REQUERIDOS) {
    const u = j.umbrales[k];
    if (u === undefined) { if (!parcial) mal.push(`falta el umbral «${k}»`); continue; }
    const v = typeof u === 'number' ? u : u?.valor;
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) { mal.push(`«${k}»: el valor tiene que ser un número mayor que 0`); continue; }
    if (typeof u === 'number') { if (!parcial) mal.push(`«${k}»: falta su unidad y de dónde sale`); continue; }
    if (u.unidad === FRACCION && v > 1) mal.push(`«${k}»: es una fracción (0,2 = 20 %), no puede pasar de 1`);
    if (!parcial || u.unidad !== undefined) if (typeof u.unidad !== 'string' || !u.unidad.trim()) mal.push(`«${k}»: falta su unidad`);
    if (!parcial || u.fuente !== undefined) if (typeof u.fuente !== 'string' || !u.fuente.trim()) mal.push(`«${k}»: falta de dónde sale («fuente»: un archivo de la habilidad, «plan §…» u «oficina»)`);
    if (!parcial || u.frase !== undefined) if (typeof u.frase !== 'string' || u.frase.trim().length < 8) mal.push(`«${k}»: falta la frase de la que sale`);
  }
  return mal;
}
/** { clave: valor } de un umbrales.json. */
export const valoresDe = j => Object.fromEntries(Object.entries(j?.umbrales || {}).map(([k, u]) => [k, typeof u === 'number' ? u : u?.valor]));
/**
 * Los de fábrica con los del dueño encima (gana el del dueño, clave a clave; lo que no se entiende se ignora y se dice).
 * → { valores, umbrales (con su fuente), delDueno: [claves], problemas }
 */
export function mezclarUmbrales(fabrica, delDueno = null) {
  const umbrales = structuredClone(fabrica?.umbrales || {}), problemas = validarUmbrales(fabrica).map(p => `de fábrica: ${p}`), propias = [];
  if (delDueno) {
    const mal = validarUmbrales(delDueno, { parcial: true });
    for (const p of mal) problemas.push(`del dueño: ${p} — se usa el de fábrica`);
    for (const [k, u] of Object.entries(delDueno.umbrales || {})) {
      if (!UMBRALES_REQUERIDOS.includes(k) || mal.some(p => p.startsWith(`«${k}»`))) continue;
      const v = typeof u === 'number' ? u : u.valor;
      if ((u?.unidad ?? umbrales[k]?.unidad) === FRACCION && v > 1) continue;
      umbrales[k] = { ...(umbrales[k] || {}), ...(typeof u === 'object' ? u : {}), valor: v, fuente: typeof u === 'object' && u.fuente ? u.fuente : 'el dueño (su Cerebro)', ...(typeof u === 'object' && u.frase ? {} : { frase: umbrales[k]?.frase || 'puesto por el dueño' }) };
      propias.push(k);
    }
  }
  return { valores: valoresDe({ umbrales }), umbrales, delDueno: propias, problemas };
}

// ---------------------------------------------------------------- el costo objetivo

const numDe = v => { if (typeof v === 'number') return Number.isFinite(v) ? v : null; const m = /-?\d+(?:[.,]\d+)?/.exec(String(v ?? '').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')); return m ? Number(m[0].replace(',', '.')) : null; };
const pct = v => { const n = numDe(v); return n === null ? null : n > 1 ? n / 100 : n; };
export const SIN_OBJETIVO = 'Sin costo objetivo no puedo juzgar el costo: ponlo en Ajustes → Anuncios («Costo por resultado que te parece bueno»), o añade a las cifras de la empresa el valor de una venta, el margen y la tasa de cierre.';
/**
 * El costo por resultado contra el que se juzga: el de Ajustes (anuncios.cpaObjetivo > 0) o, si es 0, el que sale de las cifras de la
 * empresa (cifras.json → items { name, value }): uno explícito («costo por resultado objetivo», «CPA»), o el de equilibrio = valor de una
 * venta × margen × tasa de cierre (pagados-b2b: «CPL de equilibrio = valor promedio del trato × tasa de contacto-a-cierre»).
 * → { valor, fuente: 'ajustes'|'cifras', texto } o { valor: null, motivo }.
 */
export function cpaObjetivo({ ajuste = 0, cifras: items = [] } = {}) {
  const a = numDe(ajuste);
  if (a !== null && a > 0) return { valor: Math.round(a * 100) / 100, fuente: 'ajustes', texto: `tu costo por resultado objetivo (${dinero(a)}, de Ajustes → Anuncios)` };
  const l = Array.isArray(items) ? items : [], de = re => l.find(x => re.test(String(x?.name || '')));
  const directo = de(/\b(cpa|cpl)\b|costo (objetivo )?por (resultado|conversaci|mensaje|contacto|cliente nuevo|venta|lead)/i);
  if (directo && numDe(directo.value) > 0) return { valor: Math.round(numDe(directo.value) * 100) / 100, fuente: 'cifras', texto: `«${directo.name}» de las cifras de la empresa (${dinero(numDe(directo.value))})` };
  const valor = de(/valor (promedio )?(de (un |una )?|por )?(cliente|venta|compra|trato)|ticket( promedio)?/i), margen = de(/margen/i), cierre = de(/cierre|conversi[oó]n (de )?(mensajes?|contactos?|conversaciones?)/i);
  const v = valor ? numDe(valor.value) : null, m = margen ? pct(margen.value) : null, c = cierre ? pct(cierre.value) : null;
  if (v > 0 && m > 0 && c > 0) { const e = Math.round(v * m * c * 100) / 100; return { valor: e, fuente: 'cifras', texto: `el de equilibrio con las cifras de la empresa: ${dinero(v)} × ${Math.round(m * 100)} % de margen × ${Math.round(c * 1000) / 10} % de cierre = ${dinero(e)} (por debajo de eso ganas; ponlo más bajo en Ajustes si quieres margen)` }; }
  return { valor: null, motivo: SIN_OBJETIVO };
}

// ---------------------------------------------------------------- las series

const CAMPO = { campana: 'campaign_id', conjunto: 'adset_id', anuncio: 'ad_id' };
const NIVEL_TXT = { campana: 'la campaña', conjunto: 'el conjunto', anuncio: 'el anuncio', cuenta: 'la cuenta', publicacion: 'la publicación' };
const r2 = v => Math.round(v * 100) / 100;
const veces = (a, b) => (b ? `${String(Math.round((a / b) * 10) / 10).replace('.', ',')} veces` : '');
/** Las filas de un objeto (por nivel) entre dos fechas. */
export const filasDe = (filas, nivel, id, desde, hasta) => filas.filter(f => f[CAMPO[nivel]] === id && f.date_start >= desde && f.date_start <= hasta);
/** ¿Se puede juzgar por costo por resultado? → null (sí) o el porqué no, en palabras. */
export function sinMedida(tipo, { pixel = false, destino = '' } = {}) {
  if (!tipo) return 'no sé qué cuenta como resultado para su objetivo';
  if (tipo === 'alcance') return 'busca alcance: se paga por mil personas, no por resultado, así que no se corta ni se escala por costo por resultado';
  if (tipo === 'perfil') return 'Meta no da todavía las visitas al perfil en sus cifras (POR VERIFICAR), así que no sé su costo por resultado';
  if (tipo === 'compras' && !pixel) return 'sin píxel no sé cuántas compras vinieron del anuncio';
  if (tipo === 'contactos' && !pixel && (!destino || destino === 'WEBSITE')) return 'sin píxel no sé cuántos contactos vinieron del anuncio';
  return null;
}

// ---------------------------------------------------------------- el diagnóstico

/**
 * @param {object} o
 * @param {object} o.vista        armarVista(..., rango '7d') (la frecuencia de 7 días sale de aquí: el alcance no se suma entre días)
 * @param {Array}  o.filas        filas diarias level=ad (de los últimos 30 días o más)
 * @param {string} o.hoy          'AAAA-MM-DD' en la zona de la cuenta (el día de hoy está a medias: no cuenta en las rachas)
 * @param {object} o.cpa          cpaObjetivo(...) → { valor, texto } | { valor: null, motivo }
 * @param {object} o.umbrales     { clave: valor } (mezclarUmbrales(...).valores)
 * @param {number} o.ahora        ms
 * @param {object} o.subidas      { id: ms } la última vez que se subió el presupuesto de cada objeto (del historial)
 * @param {object} o.topes        { diario, mensual, campana } — si están, «escalar» solo se propone si cabe
 * @param {boolean} o.pixel       si la cuenta tiene píxel (Ajustes → Anuncios)
 * @param {Array}  o.publicaciones lo publicado (Analíticas: { id, red, texto, publicadaAt, interacciones, alcance }) para «impulsar»
 * → { sugerencias: [...], notas: [{ regla, objeto?, texto }], sinObjetivo: string|null, cpa }
 */
export function diagnosticar({ vista, filas = [], hoy, cpa = null, umbrales: U = {}, ahora = Date.now(), subidas = {}, topes = null, pixel = false, publicaciones = [] } = {}) {
  const faltan = UMBRALES_REQUERIDOS.filter(k => !(Number(U[k]) > 0));
  if (faltan.length) throw new Error(`faltan umbrales: ${faltan.join(', ')}`);
  const out = [], notas = [], m = vista?.cuenta?.moneda || 'USD', d = v => dinero(v, m), objetivo = cpa?.valor > 0 ? cpa.valor : null;
  const ayer = sumarDias(hoy, -1), desde30 = sumarDias(hoy, -29), dias30 = diasEntre(desde30, hoy);
  const nota = (regla, texto, objeto = null) => notas.push({ regla, ...(objeto ? { objeto } : {}), texto });
  const obj = (nivel, o) => ({ id: o.id, nivel, nombre: o.nombre });
  const sug = s => { out.push({ ...s, id: `${s.regla}-${String(s.objeto.id).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 60)}${s.sufijo ? '-' + s.sufijo : ''}`, gasto: GASTA.has(s.cambio.tipo), sufijo: undefined }); };
  const PAUSAR_RIESGO = { reiniciaAprendizaje: false, gastaMas: false, texto: 'Pausar no reinicia el aprendizaje (editar sí) y deja de gastar al momento. Se puede reanudar (eso vuelve a gastar: dos clics).' };
  const sinObjetivo = objetivo ? null : (cpa?.motivo || SIN_OBJETIVO);

  // ---- la cuenta
  const cta = vista?.cuenta;
  if (cta) {
    const ce = cuentaEstado(cta.estado);
    if (cta.estado != null && ce.nivel !== 'ok') sug({ regla: 'cuenta', sufijo: 'estado', objeto: { id: cta.id, nivel: 'cuenta', nombre: cta.nombre || cta.id }, dato: `La cuenta publicitaria está: ${ce.texto.toLowerCase()}.`, porque: 'Mientras la cuenta no esté activa, Meta no entrega ningún anuncio aunque estén encendidos.', cambio: { tipo: 'revisar', id: cta.id }, efecto: 'Arreglado el pago o la revisión en el Administrador de anuncios → Facturación, los anuncios vuelven a salir solos.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'No cambia nada en la oficina: es un arreglo en Meta.' }, prioridad: 1 });
    const cerca = (gastado, tope, que, sufijo) => {
      if (gastado == null || !(tope > 0) || gastado < U.topeCerca * tope) return;
      sug({ regla: 'cuenta', sufijo, objeto: { id: cta.id, nivel: 'cuenta', nombre: cta.nombre || cta.id }, dato: `El gasto ${que} va en ${d(gastado)} de un tope de ${d(tope)} (${Math.round((gastado / tope) * 100)} %).`, porque: 'Pasar el tope es gastar más de lo que decidiste; la oficina no deja activar ni subir nada por encima, pero lo que ya está encendido sigue gastando.', cambio: { tipo: 'revisar', id: cta.id }, efecto: 'Bajar un presupuesto o pausar lo que menos rinde deja el gasto dentro del tope; subir el tope es tu decisión, en Ajustes → Anuncios.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'Pausar o bajar no gasta; subir el tope sí permite gastar más.' }, prioridad: 1 });
    };
    cerca(vista.gasto?.hoy, topes?.diario, 'de hoy', 'tope-dia'); cerca(vista.gasto?.mes, topes?.mensual, 'del mes', 'tope-mes');
    if (cta.spendCap > 0 && cta.gastado != null && cta.gastado >= U.topeCerca * cta.spendCap) sug({ regla: 'cuenta', sufijo: 'limite-meta', objeto: { id: cta.id, nivel: 'cuenta', nombre: cta.nombre || cta.id }, dato: `La cuenta lleva ${d(cta.gastado)} de su límite de gasto en Meta (${d(cta.spendCap)}).`, porque: 'Al llegar al límite de la cuenta, Meta deja de entregar todo.', cambio: { tipo: 'revisar', id: cta.id }, efecto: 'Sube o reinicia el límite en el Administrador de anuncios → Configuración de pagos, si quieres seguir.', riesgo: { reiniciaAprendizaje: false, gastaMas: true, texto: 'Subir el límite de la cuenta permite gastar más.' }, prioridad: 1 });
  }
  if (!objetivo) nota('esperar', sinObjetivo);

  // ---- campaña por campaña
  const fatigados = new Set(), rotos = new Set(), atascados = new Set();
  for (const c of vista?.campanas || []) {
    const campActiva = c.estado === 'ACTIVE';
    const conjuntos = c.conjuntos || [];
    for (const s of conjuntos) {
      const tipo = resultadoDe(c.objetivo, { optimizacion: s.optimizacion, destino: s.destino });
      const activo = campActiva && s.estado === 'ACTIVE', aprendiendo = s.aprendizaje?.estado === 'LEARNING';
      const noMide = sinMedida(tipo, { pixel, destino: s.destino });
      // rechazados y con problemas: siempre (un conjunto aprendiendo también: es algo roto)
      for (const a of s.anuncios || []) {
        if (a.estado === 'DISAPPROVED') {
          rotos.add(s.id);
          sug({ regla: 'rechazado', objeto: obj('anuncio', a), dato: `Meta rechazó «${a.nombre}»${a.revision?.length ? `: ${a.revision.slice(0, 2).join('; ')}` : ' (sin decir por qué)'}.`, porque: 'Un anuncio rechazado no se entrega. Corregir el texto o la imagen según lo que dice Meta y crearlo de nuevo es lo que lo vuelve a poner a trabajar.', cambio: { tipo: 'borrador', id: a.id }, efecto: 'El agente de anuncios propone el texto corregido como borrador de campaña; tú lo revisas y lo creas en pausa.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'El borrador nace en la oficina: nada cambia en Meta hasta que lo crees (en pausa) y lo actives.' }, prioridad: 1 });
        } else if (a.estado === 'WITH_ISSUES') {
          rotos.add(s.id);
          sug({ regla: 'problemas', objeto: obj('anuncio', a), dato: `«${a.nombre}» tiene problemas y no se entrega${a.problemas?.length ? `: ${a.problemas.slice(0, 2).join('; ')}` : ''}.`, porque: 'Meta no lo entrega mientras el problema siga, aunque esté encendido.', cambio: { tipo: 'revisar', id: a.id }, efecto: 'Resuelto el problema en el Administrador de anuncios (suele ser el enlace, la página o un permiso), vuelve a salir solo.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'Revisarlo no cambia nada en Meta por sí solo.' }, prioridad: 1 });
        }
      }
      if (!activo) continue;

      // cortar (anuncio por anuncio; un conjunto aprendiendo, solo lo que gasta sin NINGÚN resultado: eso es algo roto)
      const activos = (s.anuncios || []).filter(a => a.estado === 'ACTIVE');
      const corte = [];
      if (objetivo && !noMide) for (const a of activos) {
        const fs = filasDe(filas, 'anuncio', a.id, desde30, hoy), c30 = cifras(fs, tipo), diasGasto = new Set(fs.filter(f => Number(f.spend) > 0).map(f => f.date_start)).size;
        if (c30.gasto === null || c30.resultados === null || diasGasto < U.esperarDias) continue;
        const sin = c30.resultados === 0 && c30.gasto >= U.cortarSinResultadoCpa * objetivo;
        const caro = !aprendiendo && c30.resultados > 0 && c30.gasto >= U.cortarGastoCpa * objetivo && c30.costoPorResultado > U.cortarCostoCpa * objetivo;
        if (sin || caro) corte.push({ a, c30, sin });
      }
      if (corte.length) {
        rotos.add(s.id);
        if (corte.length === activos.length && activos.length > 1) {
          const g = r2(corte.reduce((t, x) => t + x.c30.gasto, 0)), res = corte.reduce((t, x) => t + x.c30.resultados, 0);
          sug({ regla: 'cortar', objeto: obj('conjunto', s), dato: `Sus ${activos.length} anuncios gastaron ${d(g)} en 30 días (${veces(g, objetivo)} tu costo objetivo de ${d(objetivo)}) con ${res} ${cifras([], tipo).resultadoTexto}.`, porque: `Pasaron el umbral de cortar: ${U.cortarSinResultadoCpa} veces el costo objetivo sin resultados, o ${U.cortarGastoCpa} veces con un costo por resultado de más de ${U.cortarCostoCpa} veces el objetivo. Juntos, en vez de anuncio por anuncio.`, cambio: { tipo: 'pausar', id: s.id }, efecto: `Deja de gastar unos ${d(r2(g / 30 * 7))} a la semana en algo que no trae ${cifras([], tipo).resultadoTexto}. Ten listo un reemplazo (nunca pauses sin uno): creativos nuevos para el mismo público.`, riesgo: PAUSAR_RIESGO, prioridad: 1 });
        } else for (const { a, c30, sin } of corte) {
          const ultimo = activos.length === 1;
          sug({ regla: 'cortar', objeto: obj('anuncio', a), dato: sin ? `Gastó ${d(c30.gasto)} en 30 días (${veces(c30.gasto, objetivo)} tu costo objetivo de ${d(objetivo)}) y ningún resultado (0 ${c30.resultadoTexto}).` : `Gastó ${d(c30.gasto)} en 30 días con ${c30.resultados} ${c30.resultadoTexto} a ${d(c30.costoPorResultado)} cada una: ${veces(c30.costoPorResultado, objetivo)} tu costo objetivo de ${d(objetivo)}.`, porque: sin ? `Pasó el umbral de cortar: ${U.cortarSinResultadoCpa} veces el costo objetivo sin ningún resultado.` : `Pasó el umbral de cortar: ${U.cortarGastoCpa} veces el costo objetivo gastado con un costo por resultado de más de ${U.cortarCostoCpa} veces el objetivo.`, cambio: { tipo: 'pausar', id: a.id }, efecto: `Ese dinero va a los anuncios que sí traen ${c30.resultadoTexto}${ultimo ? '. Es el último anuncio encendido del conjunto: el conjunto deja de entregar; prepara un reemplazo (nunca pauses sin uno)' : ''}.`, riesgo: PAUSAR_RIESGO, prioridad: 1 });
        }
      }

      if (aprendiendo && !rotos.has(s.id)) {
        nota('aprendizaje', `«${s.nombre}» está aprendiendo${s.aprendizaje?.conversiones != null ? ` (${s.aprendizaje.conversiones} de unos ${U.aprendizajeResultados} resultados en ${U.aprendizajeDias} días)` : ''}: no se toca —ni presupuesto, ni público, ni creativos— hasta que salga.`, obj('conjunto', s));
        continue;
      }
      if (noMide) nota('esperar', `«${s.nombre}»: ${noMide}.`, obj('conjunto', s));

      // fatiga (anuncio por anuncio; si se cansan todos, el conjunto)
      if (!aprendiendo) {
        const cansados = [];
        for (const a of activos) {
          if (corte.some(x => x.a.id === a.id)) continue;
          const conImpr = dias30.filter(f => f < hoy).map(f => ({ f, fs: filasDe(filas, 'anuncio', a.id, f, f) })).filter(x => x.fs.some(r => Number(r.impressions) > 0));
          if (conImpr.length < U.fatigaDiasBase + U.fatigaDiasRecientes) continue;
          const base = cifras(conImpr.slice(0, U.fatigaDiasBase).flatMap(x => x.fs), tipo), rec = cifras(conImpr.slice(-U.fatigaDiasRecientes).flatMap(x => x.fs), tipo);
          if (!(base.ctr > 0) || rec.ctr === null || base.impresiones < U.fatigaMinImpresiones || rec.impresiones < U.fatigaMinImpresiones) continue;
          const caida = (base.ctr - rec.ctr) / base.ctr, fr = a.cifras?.frecuencia;
          if (caida < U.fatigaCaidaCtr) continue;
          if (fr == null) { nota('fatiga', `«${a.nombre}»: su CTR bajó un ${Math.round(caida * 100)} % desde sus primeros días, pero sin el alcance de 7 días no sé su frecuencia: no puedo decir si es cansancio.`, obj('anuncio', a)); continue; }
          if (fr > U.fatigaFrecuencia) cansados.push({ a, caida, fr, base, rec });
        }
        if (cansados.length) {
          fatigados.add(s.id);
          const critico = cansados.some(x => x.fr > U.fatigaFrecuenciaCritica);
          const comun = { porque: `La misma gente lo ve una y otra vez (frecuencia por encima de ${String(U.fatigaFrecuencia).replace('.', ',')}) y cada vez hace menos clic (el CTR, un ${Math.round(U.fatigaCaidaCtr * 100)} % o más por debajo de sus primeros días): el anuncio se cansó. Subir el presupuesto solo lo enseñaría más a los mismos.`, efecto: 'El agente de anuncios propone variaciones del mejor anuncio (otro gancho, otra imagen u otro formato) para lanzarlas junto a este; las imágenes las generas tú en el Estudio, con su costo a la vista. NO se sube el presupuesto.', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'Lanzar anuncios nuevos junto al cansado no reinicia el aprendizaje; editar el que ya corre, sí. Generar imágenes en el Estudio cuesta (lo ves antes).' }, prioridad: critico ? 1 : 2 };
          if (cansados.length > 1 && cansados.length === activos.length) sug({ regla: 'fatiga', objeto: obj('conjunto', s), dato: `Sus ${cansados.length} anuncios se cansaron: frecuencia ${cansados.map(x => String(x.fr).replace('.', ',')).join(', ')} en 7 días y el CTR un ${Math.round(Math.min(...cansados.map(x => x.caida)) * 100)} %–${Math.round(Math.max(...cansados.map(x => x.caida)) * 100)} % más bajo que en sus primeros días.`, cambio: { tipo: 'creativos', id: s.id }, ...comun });
          else for (const x of cansados) sug({ regla: 'fatiga', objeto: obj('anuncio', x.a), dato: `Frecuencia ${String(x.fr).replace('.', ',')} en 7 días y el CTR en ${String(x.rec.ctr).replace('.', ',')} % (era ${String(x.base.ctr).replace('.', ',')} % en sus primeros días: un ${Math.round(x.caida * 100)} % menos).`, cambio: { tipo: 'creativos', id: x.a.id }, ...comun });
        }
      }

      // limitado (se agrupa con «estructura» más abajo)
      if (s.aprendizaje?.estado === 'FAIL' && !rotos.has(s.id)) {
        const necesita = objetivo ? r2((objetivo * U.aprendizajeResultados) / U.aprendizajeDias) : null, pres = s.presupuesto?.tipo === 'diario' ? s.presupuesto.usd : c.presupuesto?.tipo === 'diario' ? c.presupuesto.usd : null;
        sug({ regla: 'limitado', objeto: obj('conjunto', s), dato: `«${s.nombre}» tiene el aprendizaje limitado: no llega a los ${U.aprendizajeResultados} resultados en ${U.aprendizajeDias} días que Meta necesita${s.aprendizaje?.conversiones != null ? ` (lleva ${s.aprendizaje.conversiones})` : ''}.`, porque: `Con pocos resultados por semana, Meta no aprende a quién enseñárselo y el costo sube.${necesita !== null ? ` Para salir del aprendizaje le harían falta unos ${d(necesita)} al día (tu costo objetivo × ${U.aprendizajeResultados} ÷ ${U.aprendizajeDias})${pres != null ? `; ahora tiene ${d(pres)}` : ''}.` : ''}`, cambio: { tipo: 'revisar', id: s.id }, efecto: 'Juntarlo con otros conjuntos parecidos, abrir el público (Advantage+), darle más presupuesto u optimizar a un evento más arriba del embudo (de «compra» a «iniciar conversación») le da los resultados que necesita para aprender.', riesgo: { reiniciaAprendizaje: true, gastaMas: false, texto: 'Juntar conjuntos o cambiar la optimización reinicia el aprendizaje (es lo que se busca); subir el presupuesto gasta más (dos clics).' }, prioridad: 2 });
      }
    }

    // estructura: más de N conjuntos parecidos que no salen del aprendizaje (activos, con una semana o más)
    if (campActiva) {
      const grupos = new Map();
      for (const s of conjuntos) {
        if (s.estado !== 'ACTIVE' || !['LEARNING', 'FAIL'].includes(s.aprendizaje?.estado)) continue;
        const primero = s.inicio ? fechaEn(vista?.cuenta?.zona, Date.parse(String(s.inicio).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))) : filas.filter(f => f.adset_id === s.id && Number(f.spend) > 0).map(f => f.date_start).sort()[0];
        if (!primero || primero > sumarDias(hoy, -U.aprendizajeDias)) continue;
        const k = `${s.optimizacion || ''}|${s.destino || ''}`; (grupos.get(k) || grupos.set(k, []).get(k)).push(s);
      }
      for (const l of grupos.values()) if (l.length > U.estructuraConjuntos) {
        for (const s of l) atascados.add(s.id);
        const total = r2(l.reduce((t, s) => t + (s.presupuesto?.usd || 0), 0));
        sug({ regla: 'estructura', objeto: obj('campana', c), dato: `${l.length} conjuntos parecidos (la misma optimización) llevan más de ${U.aprendizajeDias} días sin salir del aprendizaje: ${l.slice(0, 5).map(s => `«${s.nombre}»`).join(', ')}${l.length > 5 ? '…' : ''}.`, porque: 'Pocos conjuntos con más presupuesto rinden más que muchos con poco: cada uno junta menos resultados de los que Meta necesita para aprender. Lo que más pesa es probar creativos, no partir el público.', cambio: { tipo: 'revisar', id: c.id }, efecto: `Juntarlos en uno (Advantage+ en el público, ${total > 0 ? `con la suma de sus presupuestos, ${d(total)} al día, y ` : ''}de 3 a 6 creativos) le da a Meta los resultados que necesita para aprender.`, riesgo: { reiniciaAprendizaje: true, gastaMas: false, texto: 'El conjunto nuevo empieza a aprender de cero; el gasto total no cambia si se suma lo mismo.' }, prioridad: 3 });
      }
    }

    // escalar: quien lleva el presupuesto (la campaña si es de presupuesto de campaña; si no, cada conjunto)
    if (!campActiva || !objetivo) continue;
    const portadores = c.presupuesto?.usd != null ? [{ nivel: 'campana', o: c, sets: conjuntos.filter(s => s.estado === 'ACTIVE') }] : conjuntos.filter(s => s.estado === 'ACTIVE' && s.presupuesto?.usd != null).map(s => ({ nivel: 'conjunto', o: s, sets: [s] }));
    for (const p of portadores) {
      if (!p.sets.length || p.sets.some(s => s.aprendizaje?.estado !== 'SUCCESS' || fatigados.has(s.id) || rotos.has(s.id))) continue;
      const tipos = [...new Set(p.sets.map(s => resultadoDe(c.objetivo, { optimizacion: s.optimizacion, destino: s.destino })))];
      if (tipos.length !== 1 || sinMedida(tipos[0], { pixel, destino: p.sets[0].destino })) continue;
      const racha = Array.from({ length: U.escalarDias }, (_, i) => sumarDias(ayer, -(U.escalarDias - 1 - i))).map(f => ({ f, c: cifras(filasDe(filas, p.nivel, p.o.id, f, f), tipos[0]) }));
      const tope = (1 - U.escalarBajoObjetivo) * objetivo;
      if (!racha.every(x => x.c.resultados > 0 && x.c.costoPorResultado !== null && x.c.costoPorResultado <= tope)) continue;
      const ultima = Number(subidas?.[p.o.id]) || 0;
      if (ultima && ahora - ultima < U.escalarCadaHoras * 3600e3) { nota('escalar', `«${p.o.nombre}» rinde bien, pero su presupuesto se subió hace menos de ${U.escalarCadaHoras} h: se espera antes de subir otra vez.`, obj(p.nivel, p.o)); continue; }
      const antes = p.o.presupuesto.usd, valor = Math.floor(antes * (1 + U.escalarSubida) * 100) / 100;
      if (!(valor > antes)) continue;
      const dia = p.o.presupuesto.tipo === 'diario';
      if (topes && vista?.cuenta) {
        const t = evaluar({ vista, tipo: 'subir_presupuesto', id: p.o.id, valor, topes, hoy, ahora });
        if (!t.ok) { nota('escalar', `«${p.o.nombre}» podría crecer un ${Math.round(U.escalarSubida * 100)} %, pero no cabe en tus topes: ${t.motivo}`, obj(p.nivel, p.o)); continue; }
      }
      sug({ regla: 'escalar', objeto: obj(p.nivel, p.o), dato: `${U.escalarDias} días seguidos con el costo por resultado bajo tu objetivo de ${d(objetivo)}: ${racha.map(x => d(x.c.costoPorResultado)).join(', ')} (${racha.reduce((t, x) => t + x.c.resultados, 0)} ${racha[0].c.resultadoTexto}).`, porque: `Está fuera del aprendizaje y cuesta un ${Math.round(U.escalarBajoObjetivo * 100)} % o más menos que tu objetivo: hay espacio para que gaste más al mismo costo. Se sube de a ${Math.round(U.escalarSubida * 100)} %: un salto de ${Math.round(U.saltoGrande * 100)} % o más reinicia el aprendizaje (para eso, mejor duplicarlo con más presupuesto).`, cambio: { tipo: 'subir_presupuesto', id: p.o.id, valor }, efecto: `${dia ? 'Hasta' : 'Presupuesto total de'} ${d(valor)}${dia ? ' al día' : ''} (de ${d(antes)}): más ${racha[0].c.resultadoTexto} si el costo aguanta. Se vuelve a mirar en ${U.escalarCadaHoras} h.`, riesgo: { reiniciaAprendizaje: false, gastaMas: true, texto: `Gasta hasta ${d(r2(valor - antes))} más ${dia ? 'al día' : 'en total'} (dos clics, dentro de tus topes). Un ${Math.round(U.escalarSubida * 100)} % no reinicia el aprendizaje.` }, prioridad: 2 });
    }
  }

  // ---- lo orgánico: una publicación muy por encima de la media de su red (Fase A4 la impulsa)
  const desdeOrg = ahora - U.organicoDias * 864e5, porRed = new Map();
  for (const p of publicaciones || []) { const t = Date.parse(p.publicadaAt); if (Number.isFinite(t) && Number.isFinite(Number(p.interacciones))) (porRed.get(p.red || '') || porRed.set(p.red || '', []).get(p.red || '')).push({ ...p, t, i: Number(p.interacciones) }); }
  const candidatas = [];
  for (const [red, l] of porRed) {
    if (l.length < U.organicoMinPublicaciones) continue;
    const media = l.reduce((t, p) => t + p.i, 0) / l.length; if (!(media > 0)) continue;
    for (const p of l) if (p.t >= desdeOrg && p.i >= U.organicoVecesMedia * media) candidatas.push({ p, red, media, x: p.i / media });
  }
  candidatas.sort((a, b) => b.x - a.x);
  for (const { p, red, media, x } of candidatas.slice(0, 1)) {
    const nombre = String(p.texto || '').split('\n')[0].slice(0, 60) || 'publicación';
    sug({ regla: 'impulsar', objeto: { id: String(p.id), nivel: 'publicacion', nombre }, dato: `En ${red === 'instagram' ? 'Instagram' : red === 'facebook' ? 'Facebook' : red || 'tus redes'}, «${nombre}» tuvo ${Math.round(p.i)} interacciones: ${veces(p.i, media)} tu media (${Math.round(media)}).`, porque: 'Lo que ya funcionó sin pagar suele funcionar como anuncio: la gente ya demostró que le interesa.', cambio: { tipo: 'impulsar', id: String(p.id) }, efecto: 'Un borrador de anuncio con esa publicación, en pausa; lo activas tú con su presupuesto (dos clics).', riesgo: { reiniciaAprendizaje: false, gastaMas: false, texto: 'El borrador no gasta; activarlo sí (dos clics, dentro de tus topes).' }, prioridad: 3 });
  }

  // ---- agrupar: «estructura» se come los «limitado» de sus conjuntos; un objeto, una sugerencia (la más urgente)
  const final = [], vistos = new Map();
  for (const s of out.filter(s => !(s.regla === 'limitado' && atascados.has(s.objeto.id))).sort((a, b) => a.prioridad - b.prioridad)) {
    const k = `${s.objeto.nivel}:${s.objeto.id}`;
    if (vistos.has(k) && s.objeto.nivel !== 'cuenta') continue;
    vistos.set(k, s); final.push(s);
  }
  return { sugerencias: final.map(({ sufijo, ...s }) => s), notas, sinObjetivo, cpa: objetivo ? { valor: objetivo, texto: cpa.texto || '' } : null };
}

// ---------------------------------------------------------------- qué pasó después

/** Qué cuenta como resultado para un objeto de la vista (buscar(vista, id)): el de su conjunto, o el de la campaña. */
export function tipoDe(r) {
  if (!r) return null;
  if (r.tipo === 'campana') return r.objeto.resultado ?? resultadoDe(r.objeto.objetivo);
  const s = r.tipo === 'conjunto' ? r.objeto : r.conjunto;
  return resultadoDe(r.campana?.objetivo, { optimizacion: s?.optimizacion, destino: s?.destino });
}

/**
 * Las cifras de los `dias` días después de aplicar contra los `dias` de antes (pura). null si todavía no pasaron.
 * → { desde, hasta, antes: {gasto, resultados, costoPorResultado, ctr}, despues: {...}, mejoro: bool|null, r: 0..1|null, texto }
 */
export function medirResultado({ filas = [], nivel, id, tipo = null, aplicadaEl, hoy, dias = 7, cambio = 'revisar', moneda = 'USD' } = {}) {
  if (!CAMPO[nivel] || !aplicadaEl || !hoy) return null;
  const hasta = sumarDias(aplicadaEl, dias); if (hoy <= hasta) return null;
  const corta = c => ({ gasto: c.gasto, resultados: c.resultados, costoPorResultado: c.costoPorResultado, ctr: c.ctr });
  const antes = corta(cifras(filasDe(filas, nivel, id, sumarDias(aplicadaEl, -dias), sumarDias(aplicadaEl, -1)), tipo));
  const despues = corta(cifras(filasDe(filas, nivel, id, sumarDias(aplicadaEl, 1), hasta), tipo));
  const d = v => dinero(v, moneda);
  let mejoro = null, texto;
  if (cambio === 'pausar' || cambio === 'bajar_presupuesto' || cambio === 'archivar') {
    mejoro = antes.gasto !== null && despues.gasto !== null ? despues.gasto < antes.gasto : null;
    texto = mejoro === null ? 'Sin cifras para comparar.' : `Gastó ${d(despues.gasto)} en los ${dias} días siguientes (antes, ${d(antes.gasto)}).`;
  } else {
    if (antes.costoPorResultado !== null && despues.costoPorResultado !== null) mejoro = despues.costoPorResultado <= antes.costoPorResultado;
    else if (antes.ctr !== null && despues.ctr !== null && cambio === 'creativos') mejoro = despues.ctr >= antes.ctr;
    texto = mejoro === null ? 'Sin cifras para comparar.' : `Costo por resultado: ${d(antes.costoPorResultado)} antes → ${d(despues.costoPorResultado)} después (${antes.resultados ?? 0} → ${despues.resultados ?? 0} resultados).`;
  }
  return { desde: sumarDias(aplicadaEl, 1), hasta, antes, despues, mejoro, r: mejoro === null ? null : mejoro ? 1 : 0.25, texto };
}
