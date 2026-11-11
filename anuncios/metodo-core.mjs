// @ts-check
// El MÉTODO DE CAMPAÑAS en la oficina (11 nov 2026) — puro. Junta la teoría del curso de campañas que la aplicación de calendarios de
// Juancito Ads ya tenía (metodo/*.mjs, portados tal cual: ciclo de ventas, números del negocio, revisión 3Q) con lo que la oficina YA
// lee de Meta (anuncios/sincronizar.mjs: la estructura en data/anuncios/cuenta.json y las cifras diarias por anuncio).
//
// Diferencias con el calendario, a propósito:
//  · allí hay muchos clientes y cada uno tiene su ficha; aquí la oficina es UNA empresa: una ficha de números y una revisión.
//  · allí la revisión son 12 llamadas a Meta; aquí la estructura ya está leída y las tres ventanas llegan en UN lote
//    (meta-ads.ventanas3q). Sin esa lectura (Meta frenado, sin token), la revisión sale de las cifras diarias ya guardadas y lo dice:
//    sin clics únicos ni tiempo de video, que no se pueden sumar día a día.
//  · todo lo que se devuelve es para LEER. Nada de aquí cambia Meta: pausar, subir presupuesto o activar siguen por anuncios/acciones.mjs
//    con la regla del dinero (dos clics del dueño y sus topes).
import { limpiarNegocio, numeroMagico, costoAceptable, conLecturaMeta, objetivo, equilibrio, repartoPorEtapas, valoresDe, tieneNumeros, origenDe, simular, escenarios,
  entradasDelSimulador, modoSimuladorDe, CAMPOS_NEGOCIO, ORIGENES_DATO, MODOS_SIMULADOR, CAMPOS_SIMULADOR, TASA_CIERRE_DEFECTO } from '../metodo/numeros-negocio.mjs';
import { revisar, q1DeCuenta, limpiarEtapas, etapaDeNombre, rankingsDe, sumarFilas, cifras3q, textoDeRevision, VENTANAS, ETAPAS_REVISION } from '../metodo/tres-q.mjs';
import { limpiarUmbrales3q } from '../metodo/umbrales-3q.mjs';
import { cicloDe } from '../metodo/ciclo-negocio.mjs';
import { tipoNegocioDe, destinoNegocioDe } from '../metodo/ciclo-ventas.mjs';
import { tipoArteDe } from '../metodo/tipos-arte.mjs';
import { formatoMoneda } from '../metodo/meta-cifras.mjs';
import { deMeta, sumarDias } from './modelo.mjs';

export { limpiarNegocio, limpiarEtapas, limpiarUmbrales3q, tieneNumeros, VENTANAS, ETAPAS_REVISION, TASA_CIERRE_DEFECTO };

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const coma = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : String(Math.round(Number(n) * 10 ** d) / 10 ** d).replace('.', ','));
const encendida = (x) => String(x?.status ?? '').toUpperCase() === 'ACTIVE';

/** Las tres ventanas de la revisión, de días COMPLETOS (hasta ayer, como «últimos 7 días» del Ads Manager). `hoy` en la zona de la cuenta. */
export function ventanasDe(hoy) {
  const ayer = sumarDias(hoy, -1);
  return Object.fromEntries(VENTANAS.map((w) => [w, [sumarDias(hoy, -w), ayer]]));
}

/**
 * El respaldo sin lectura por ventanas: las cifras DIARIAS por anuncio que la oficina ya guarda, sumadas por nivel y ventana. Lo que no se
 * puede sumar entre días (alcance, clics únicos, frecuencia) no se inventa: queda sin dato y la Q2 lo dice.
 * → { campaign: { 30: [fila], 14, 7 }, adset, ad }
 */
export function filasDeDiarias(diarias = [], ventanas = {}) {
  const NIVEL = { campaign: 'campaign_id', adset: 'adset_id', ad: 'ad_id' };
  const out = { campaign: {}, adset: {}, ad: {} };
  for (const [w, [desde, hasta]] of Object.entries(ventanas)) {
    const delTramo = diarias.filter((f) => f?.date_start >= desde && f?.date_start <= hasta);
    for (const [nivel, campo] of Object.entries(NIVEL)) {
      const grupos = new Map();
      for (const f of delTramo) { const k = f[campo]; if (!k) continue; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(f); }
      out[nivel][w] = [...grupos].map(([id, l]) => {
        const s = sumarFilas(l), enlace = l.reduce((t, f) => t + num(f.inline_link_clicks), 0);
        return { ...s, inline_link_clicks: String(enlace), campaign_id: l[0].campaign_id, ...(nivel !== 'campaign' ? { adset_id: l[0].adset_id } : {}), ...(nivel === 'ad' ? { ad_id: l[0].ad_id } : {}), [campo]: id };
      });
    }
  }
  return out;
}

/**
 * El número mágico de la empresa como lo usa la revisión: el de conversación y el de compra, cada uno con su objetivo y su equilibrio.
 * `gasto`: lo gastado en 30 días, que hace de presupuesto del mes si nadie lo escribió. (La misma cuenta que el calendario.)
 */
export function numerosDe(negocioGuardado, { tasaDefecto, gasto = 0 } = {}) {
  const negocio = conLecturaMeta(limpiarNegocio(negocioGuardado), gasto > 0 ? { gasto } : null);
  const m = numeroMagico(negocio, { objetivoCampana: 'mensajes', tasaDefecto });
  const v = numeroMagico(negocio, { objetivoCampana: 'ventas', tasaDefecto });
  const aceptable = costoAceptable(negocio, { tasaDefecto });
  const web = negocio.destino === 'web';
  return {
    negocio, destino: negocio.destino,
    numeros: {
      conversacion: { objetivo: m.objetivo, equilibrio: m.equilibrio },
      compra: { objetivo: v.alterna?.objetivo ?? null, equilibrio: v.alterna?.equilibrio ?? null, roasObjetivo: v.objetivo, roasEquilibrio: v.equilibrio },
    },
    numero: {
      destino: negocio.destino, metrica: web ? 'Costo por compra' : 'Costo por conversación',
      objetivo: web ? v.alterna?.objetivo ?? null : m.objetivo, equilibrio: web ? v.alterna?.equilibrio ?? null : m.equilibrio,
      tasaCierre: m.tasaCierre, faltan: m.faltan, alarma: web ? v.alarma : m.alarma, textoAlarma: web ? v.textoAlarma : m.textoAlarma, aceptable,
    },
  };
}

const porCampo = (filas, campo) => new Map((filas ?? []).filter((f) => f?.[campo]).map((f) => [String(f[campo]), f]));

/** Lo guardado de Meta (cuenta.json) y las filas por nivel y ventana, con la forma que pide `revisar()` (metodo/tres-q.mjs). Solo lo ENCENDIDO. */
export function campanasParaRevisar(guardado, filas, etapas = {}) {
  const g = guardado || {}, moneda = g.cuenta?.currency || 'USD';
  const mapa = (nivel, campo) => Object.fromEntries(VENTANAS.map((w) => [w, porCampo(filas?.[nivel]?.[w], campo)]));
  const mc = mapa('campaign', 'campaign_id'), ms = mapa('adset', 'adset_id'), ma = mapa('ad', 'ad_id');
  const vent = (m, id) => Object.fromEntries(VENTANAS.map((w) => [w, m[w].get(String(id)) ?? null]));
  const manuales = limpiarEtapas(etapas);
  const estado = (x) => x.effective_status ?? x.status ?? '';
  const creativos = new Map((g.creativos || []).map((c) => [c.id, c]));
  return (g.campanas ?? []).filter(encendida).slice(0, 25).map((c) => {
    const id = String(c.id), nombre = c.name ?? '', delNombre = etapaDeNombre(nombre), manual = manuales[id];
    return {
      id, nombre, objetivo: c.objective ?? '', estado: estado(c), status: c.status ?? '',
      presupuestoDiario: deMeta(c.daily_budget, moneda, { ceroEsNada: true }), presupuestoTotal: deMeta(c.lifetime_budget, moneda, { ceroEsNada: true }),
      creada: c.created_time ?? '', actualizada: c.updated_time ?? '',
      etapa: delNombre || manual || '', etapaDe: delNombre ? 'nombre' : manual ? 'manual' : '',
      i: vent(mc, id),
      conjuntos: (g.conjuntos ?? []).filter((s) => String(s.campaign_id) === id).slice(0, 20).map((s) => ({
        id: String(s.id), nombre: s.name ?? '', estado: estado(s), status: s.status ?? '',
        presupuestoDiario: deMeta(s.daily_budget, moneda, { ceroEsNada: true }), optimizacion: s.optimization_goal ?? '',
        aprendizaje: s.learning_stage_info?.status ?? '', creada: s.created_time ?? s.start_time ?? '', actualizada: s.updated_time ?? '',
        i: vent(ms, s.id),
      })),
      anuncios: (g.anuncios ?? []).filter((a) => String(a.campaign_id) === id).slice(0, 40).map((a) => {
        const i = vent(ma, a.id), cre = a.creative?.id ? { ...creativos.get(a.creative.id), ...a.creative } : a.creative || {};
        return {
          id: String(a.id), nombre: a.name ?? '', conjuntoId: String(a.adset_id ?? ''), estado: estado(a), status: a.status ?? '',
          creada: a.created_time ?? '', actualizada: a.updated_time ?? '', titulo: cre.title ?? '', texto: String(cre.body ?? '').slice(0, 300),
          rankings: rankingsDe(i[7] ?? i[30]), i,
        };
      }),
    };
  });
}

/** Lo que se cambió desde la oficina (el historial de anuncios/acciones.mjs): id → fecha del último cambio. Esperar tras un cambio es la regla 2. */
export function cambiosDelHistorial(items = []) {
  const out = {};
  for (const h of items) { const id = h?.objeto?.id, f = String(h?.at ?? '').slice(0, 10); if (id && /^\d{4}-\d{2}-\d{2}$/.test(f) && (!out[id] || f > out[id])) out[id] = f; }
  return out;
}

const AVISO_LECTURA = {
  basico: 'Meta no dio las métricas nuevas (clics únicos, tiempo de reproducción): la Q2 va con las de siempre.',
  'sin-rankings': 'Meta no dio los rankings de calidad de los anuncios.',
  diario: 'Sin la lectura por ventanas: la revisión sale de las cifras diarias ya guardadas, sin clics únicos, % de mensajes ni tiempo de video (no se pueden sumar día a día).',
};

/**
 * La revisión 3Q de la cuenta. `lectura`: { filas, leidoCon, recortado, at } de meta-ads.ventanas3q, o null (entonces `diarias`).
 * → lo mismo que el calendario (numero, numeros, q1Cuenta, campanas con veredicto, resumen…) con `empresa` en lugar de cliente.
 */
export function armarRevision({ guardado = null, lectura = null, diarias = [], hoy, negocio = {}, etapas = {}, umbrales = {}, tasaDefecto = undefined, cambios = {}, costoMax = 0, empresa = '' } = {}) {
  const g = guardado || {}, cta = g.cuenta || {}, moneda = cta.currency || 'USD';
  const conLectura = Boolean(lectura?.filas?.campaign);
  const filas = conLectura ? lectura.filas : filasDeDiarias(diarias, ventanasDe(hoy));
  const leidoCon = conLectura ? lectura.leidoCon || 'completo' : 'diario';
  const gasto30 = cifras3q(sumarFilas(filas.campaign?.[30] ?? []))?.gasto ?? 0;
  const { destino, numeros, numero } = numerosDe(negocio, { tasaDefecto, gasto: gasto30 });
  const escrito = Number(costoMax) > 0 ? Number(costoMax) : 0;
  const r = revisar(campanasParaRevisar(g, filas, etapas), { numeros, umbrales, moneda, hoy, cambios, cuenta: cta.id || (cta.account_id ? `act_${cta.account_id}` : ''), destino, costoMax: escrito });
  return {
    cliente: { id: 'empresa', nombre: empresa || 'la empresa' },
    cuenta: { nombre: cta.name || '', externoId: cta.id || '', moneda, zona: cta.timezone_name || '' },
    hoy, numero, numeros,
    q1Cuenta: q1DeCuenta(filas.campaign ?? {}, { destino, numeros }),
    ...r,
    etapas: ETAPAS_REVISION, leidoCon, leidoAt: conLectura ? lectura.at || null : null, recortado: Boolean(lectura?.recortado),
    avisoLectura: AVISO_LECTURA[leidoCon] || '',
    costoMax: escrito || numero.aceptable?.valor || 0, origenCosto: escrito ? 'escrito' : numero.aceptable ? 'numero-magico' : 'promedio',
  };
}

/** La revisión en texto, para Dimitri, los agentes y el asistente (la misma función del calendario, con el aviso de la lectura delante). */
export function textoRevision(r, { max = 6500 } = {}) {
  const t = textoDeRevision(r, { max }).replace('Se ponen en Marca → Números del negocio.', 'Se ponen en Anuncios → Método → Números del negocio (o díselos a Dimitri).');
  const pie = [r.avisoLectura, r.numero?.alarma ? r.numero.textoAlarma : '', r.resumen?.pendientes ? `Pendientes de decisión: ${r.resumen.pendientes}.` : ''].filter(Boolean).join(' ');
  return (pie ? `${t}\n${pie}` : t).slice(0, max + 600);
}

/** Lo que la cuenta hizo en 30 días, para prellenar el simulador y comparar el número mágico con lo real. */
export function lecturaDe(filas30 = []) {
  const c = cifras3q(sumarFilas(filas30)); if (!c || !(c.gasto > 0)) return null;
  const unicos = filas30.reduce((s, f) => s + num(f.unique_inline_link_clicks), 0), alcance = filas30.reduce((s, f) => s + num(f.reach), 0), impresiones = c.impresiones || 0;
  return { gasto: c.gasto, cpm: c.cpm, costoConversacion: c.costoConversacion, costoCompra: c.costoCompra, roas: c.roas, conversaciones: c.conversaciones, compras: c.compras,
    // Los únicos por campaña SÍ se pueden juntar como aproximación de la cuenta (una persona en dos campañas cuenta dos veces): se rotula «aprox.».
    ctrUnico: unicos > 0 && alcance > 0 ? Math.round((unicos / alcance) * 10000) / 100 : null, frecuencia: alcance > 0 ? Math.round((impresiones / alcance) * 100) / 100 : null,
    pctMensajes: unicos > 0 && c.conversaciones ? Math.round((c.conversaciones / unicos) * 1000) / 10 : null, costoClicUnico: unicos > 0 ? Math.round((c.gasto / unicos) * 100) / 100 : null, aproximada: true };
}

/**
 * La FICHA de números del negocio, ya calculada: lo guardado con su origen, el objetivo (calculadora de presupuesto), el equilibrio
 * (rentabilidad), el número mágico, el reparto por etapa y el ciclo de ventas de ese negocio. `lectura`: lecturaDe(filas de 30 días).
 */
export function fichaNegocio(guardado, { lectura = null, tasaDefecto = undefined, moneda = 'USD' } = {}) {
  const n = conLecturaMeta(limpiarNegocio(guardado), lectura?.gasto > 0 ? { gasto: lectura.gasto } : null);
  const o = objetivo(n, { tasaDefecto }), e = equilibrio(n, { tasaDefecto });
  const magico = numeroMagico(n, { tasaDefecto, lectura });
  const ciclo = cicloDe(n.tipo, n.destino, { cuenta: n.cuenta });
  const modo = modoSimuladorDe(n.destino), ent = entradasDelSimulador(modo, lectura, n);
  return {
    negocio: n, moneda, tieneNumeros: tieneNumeros(guardado), perfilCompleto: Boolean(n.tipo && n.destino),
    campos: CAMPOS_NEGOCIO.map((c) => ({ id: c.id, nombre: c.nombre, unidad: c.unidad, ayuda: c.ayuda, como: c.como, valor: n[c.id]?.valor ?? null, origen: origenDe(n, c.id), origenTexto: ORIGENES_DATO[origenDe(n, c.id)] || '' })),
    valores: valoresDe(n, { tasaDefecto }), objetivo: o, equilibrio: e, magico,
    reparto: repartoPorEtapas(o.inversion ?? e.presupuesto, { cuenta: n.cuenta }), ciclo, lectura,
    simulador: { modo, entradas: ent.valores, origen: ent.origen, escenarios: Object.keys(ent.valores).length >= 3 ? escenarios(modo, ent.valores) : [] },
    faltan: [...new Set([...(o.faltan || []), ...(e.faltan || [])])],
  };
}

const NOMBRE_CAMPO = Object.fromEntries(CAMPOS_NEGOCIO.map((c) => [c.id, c.nombre]));
NOMBRE_CAMPO.costos = 'Costos variables (% de cada venta)';

/** La ficha en palabras: lo que Dimitri y los agentes leen antes de opinar de una campaña. */
export function textoNegocio(f) {
  if (!f) return '';
  const d = (v) => (v === null || v === undefined ? '—' : formatoMoneda(v, f.moneda)), n = f.negocio;
  const tipo = tipoNegocioDe(n.tipo)?.nombre, dest = destinoNegocioDe(n.destino)?.nombre;
  const l = [`NÚMEROS DEL NEGOCIO (${f.moneda}). Negocio: ${tipo || 'sin tipo'} · vende por ${dest || 'sin destino'}${n.cuenta ? ` · cuenta publicitaria ${n.cuenta === 'nueva' ? 'nueva' : 'con historial'}` : ''}.`];
  if (!f.tieneNumeros) l.push('Todavía no hay números escritos: sin ticket, costos y % a invertir no hay número mágico y cada campaña se compara solo con su propio mes.');
  const datos = f.campos.filter((c) => c.valor !== null).map((c) => `${c.nombre}: ${c.unidad === 'dinero' ? d(c.valor) : `${coma(c.valor)} %`} (${c.origenTexto.toLowerCase()})`);
  if (datos.length) l.push(`Datos: ${datos.join(' · ')}.`);
  if (n.costos.length) l.push(`Costos variables: ${n.costos.map((c) => `${c.nombre} ${coma(c.pct)} %`).join(', ')} → margen bruto ${coma(f.equilibrio.margenBruto)} %, margen efectivo ${coma(f.equilibrio.margenEfectivo)} %.`);
  const o = f.objetivo;
  if (o.costoCompra !== null) {
    const conv = o.costoConversacion !== null ? ` · ${d(o.costoConversacion)} por conversación (tasa de cierre ${coma(o.tasaCierre)} %)` : '';
    const inv = o.inversion ? ` · inversión del mes ${d(o.inversion)} para ${coma(o.ventasNecesarias, 0)} ventas` : '';
    l.push(`OBJETIVO (lo que se está dispuesto a pagar): ${d(o.costoCompra)} por venta${conv}${o.roas ? ` · ROAS ${coma(o.roas)}` : ''}${inv}.`);
  }
  const e = f.equilibrio;
  if (e.roas !== null) {
    const porVenta = e.cac !== null ? ` · ${d(e.cac)} por venta · ${d(e.costoConversacion)} por conversación` : '';
    l.push(`EQUILIBRIO (a partir de aquí se pierde dinero; modo «${e.modo === 'plataforma' ? 'solo la pauta' : 'todo el negocio'}»): ROAS ${coma(e.roas)}${porVenta}${e.presupuesto ? ` (con ${d(e.presupuesto)} de pauta al mes)` : ''}.`);
  }
  const m = f.magico;
  if (m.objetivo !== null || m.equilibrio !== null) {
    const u = (v) => (m.unidad === 'veces' ? coma(v) : d(v));
    l.push(`NÚMERO MÁGICO · ${m.metrica}: objetivo ${u(m.objetivo)} · equilibrio ${u(m.equilibrio)}${m.real !== null ? ` · real de 30 días ${u(m.real)}` : ''}.${m.alarma ? ' ALARMA: ' + m.textoAlarma : ''}`);
  }
  for (const a of o.avisos || []) l.push('Aviso: ' + a.texto);
  if (e.cargaTodosLosFijos) l.push('Aviso: la pauta carga sola todos los costos fijos (no hay ventas de otros canales escritas).');
  if (f.reparto.length) l.push(`Reparto del presupuesto por etapa: ${f.reparto.map((x) => `${x.nombre} ${coma(x.pct, 0)} % (${d(x.monto)})`).join(' · ')}.`);
  if (f.faltan.length) l.push(`Falta para calcularlo todo: ${f.faltan.map((k) => NOMBRE_CAMPO[k] || k).join(', ')}.`);
  const r = f.lectura;
  if (r) {
    const partes = [`gasto ${d(r.gasto)}`, r.conversaciones ? `${r.conversaciones} conversaciones a ${d(r.costoConversacion)}` : '', r.compras ? `${r.compras} compras a ${d(r.costoCompra)}` : '',
      r.cpm ? `CPM ${d(r.cpm)}` : '', r.ctrUnico ? `CTR único ${coma(r.ctrUnico)} %` : '', r.pctMensajes ? `${coma(r.pctMensajes, 1)} % de los clics escriben` : ''];
    l.push(`Lo real de Meta en 30 días${r.aproximada ? ' (aprox.)' : ''}: ${partes.filter(Boolean).join(' · ')}.`);
  }
  return l.join('\n');
}

/** El ciclo de ventas del negocio en palabras: qué pieza va en cada etapa, con qué tipo de arte, a quién y a dónde lleva. */
export function textoCiclo(ciclo) {
  if (!ciclo) return '';
  const que = `${tipoNegocioDe(ciclo.tipo)?.nombre || ciclo.tipo} por ${destinoNegocioDe(ciclo.destino)?.nombre || ciclo.destino}`;
  const l = [`CICLO DE VENTAS · ${que}. Objetivo de campaña: ${ciclo.nombreObjetivo} (${ciclo.objetivoMeta}).${ciclo.nota ? ' ' + ciclo.nota : ''}${ciclo.deducido ? ' (combinación deducida de la más parecida)' : ''}`];
  for (const e of ciclo.etapas) {
    l.push(`· ${e.nombre} (${e.reparto} % del presupuesto${e.ahora ? '' : '; todavía no: la cuenta es nueva'}): ${e.contenido} Tipos de arte: ${e.artes.map((a) => tipoArteDe(a)?.nombre || a).join(', ')}. Lleva ${e.lleva}.`);
  }
  return l.join('\n');
}

/** El simulador en palabras: tres escenarios con sus resultados. `entradas` en las unidades de CAMPOS_SIMULADOR. */
export function textoSimulacion(modo, entradas, moneda = 'USD') {
  const def = MODOS_SIMULADOR.find((m) => m.id === modo) || MODOS_SIMULADOR[0];
  const faltan = def.campos.filter((c) => !(Number(entradas?.[c]) > 0));
  if (faltan.length) return { ok: false, texto: `Para simular «${def.nombre}» faltan: ${faltan.map((c) => CAMPOS_SIMULADOR[c].nombre).join(', ')}.`, faltan };
  const val = (f) => (f.valor === null ? '—' : f.unidad === 'dinero' ? formatoMoneda(f.valor, moneda) : f.unidad === 'veces' ? coma(f.valor) : coma(f.valor, 0));
  const esc = escenarios(def.id, entradas);
  return { ok: true, escenarios: esc, texto: [`SIMULACIÓN · ${def.nombre} con ${formatoMoneda(Number(entradas.gasto), moneda)}:`, ...esc.map((s) => `· ${s.nombre} (${s.como.toLowerCase()}): ${s.filas.map((f) => `${f.nombre.toLowerCase()} ${val(f)}`).join(' · ')}`)].join('\n') };
}

export { simular, escenarios, cicloDe, MODOS_SIMULADOR, CAMPOS_SIMULADOR, CAMPOS_NEGOCIO };
