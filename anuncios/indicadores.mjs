// ============================================================
// Agents Office — Anuncios de Meta, Fase A6 (9 oct 2026): LOS INDICADORES DEL DUEÑO. docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §5.
//
// Tres números de los anuncios en «Cómo va el negocio» (data/kpis.json, business.mjs), como Analíticas lleva seguidores y alcance:
//   meta_gasto_anuncios   lo gastado este mes (días de la zona de la cuenta)
//   meta_costo_resultado  el costo por resultado de los últimos 30 días, del tipo de resultado con más gasto (sumar conversaciones
//                         con clics no dice nada: la misma regla del resumen de 7 días de anuncios/modelo.mjs)
//   meta_roas             lo vendido por cada dólar de anuncios en 30 días — SOLO con píxel y con compras medidas. Sin eso no se
//                         crea y se dice por qué: un ROAS de 0 sin píxel mentiría.
// Los crea el dueño con un botón (POST /api/anuncios/indicadores, solo él) y cada lectura buena de cifras los pone al día: UN punto por
// día (la lectura de cada hora corrige el del día, no suma otro). Solo en los indicadores que el dueño TIENE: si los borra, no vuelven.
// 10 oct 2026 (la API de conversiones, anuncios/conversiones.mjs): si el píxel no da el ROAS (no midió compras o su valor) pero el dueño
// registró ventas por la oficina (la Bandeja, Stripe, el webhook), el ROAS sale de ESAS ventas: lo vendido registrado en 30 días entre lo
// gastado en anuncios en 30 días. No es lo que Meta atribuye a los anuncios (son todas las ventas registradas), y `roasFuente` y el
// motivo lo dicen: 'meta' (lo que Meta atribuyó) o 'oficina' (las ventas que registraste aquí).
// Puro salvo `crearIndicadoresAnuncios`, que recibe cómo leer y guardar data/kpis.json (serve.mjs: loadKpis / saveKpis).
// ============================================================
import { cifras } from './modelo.mjs';

export const IDS = { gasto: 'meta_gasto_anuncios', costo: 'meta_costo_resultado', roas: 'meta_roas' };
const unidad = moneda => (!moneda || moneda === 'USD' ? 'US$' : String(moneda).slice(0, 8));
/** Las definiciones (business.validateDef las aceptaría tal cual). `unit` va en la moneda de la cuenta. */
export function definiciones(moneda = 'USD') {
  return [
    { id: IDS.gasto, name: 'Gasto en anuncios del mes', unit: unidad(moneda), better: 'down', goal: null },
    { id: IDS.costo, name: 'Costo por resultado de anuncios (30 días)', unit: unidad(moneda), better: 'down', goal: null },
    { id: IDS.roas, name: 'ROAS de anuncios (30 días)', unit: 'x', better: 'up', goal: null },
  ];
}
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = v => (v === null ? null : Math.round(v * 100) / 100);
// purchase_roas viene por fila como [{ action_type, value }]; las tres cuentan lo mismo: se toma la primera que esté (no se suman)
const TIPOS_ROAS = ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase'];

/**
 * Las compras y el ROAS de unas filas diarias. El ROAS de un periodo NO es el promedio de los diarios: es lo vendido entre lo gastado
 * (cada fila trae su ROAS; lo vendido de esa fila = ROAS × gasto). → { compras, gasto, vendido, roas, conValor }
 */
export function roasDe(filas = []) {
  const compras = cifras(filas, 'compras').resultados;
  let gasto = 0, vendido = 0, conValor = false;
  for (const f of filas) {
    const g = num(f.spend) || 0; gasto += g;
    const l = Array.isArray(f.purchase_roas) ? f.purchase_roas : [];
    const x = TIPOS_ROAS.map(t => l.find(a => a?.action_type === t)).find(Boolean);
    if (x && num(x.value) !== null) { conValor = true; vendido += num(x.value) * g; }
  }
  return { compras, gasto: r2(gasto), vendido: r2(vendido), roas: conValor && gasto > 0 ? r2(vendido / gasto) : null, conValor };
}

/** ¿Se puede crear el ROAS? → { puede, motivo } (el motivo, en palabras y con qué hacer). */
export function roasPosible({ pixel = false, filas30 = [], registradas = null } = {}) {
  const r0 = pixel ? roasDe(filas30) : null;
  if (r0 && r0.compras && r0.roas !== null) return { puede: true, motivo: '', fuente: 'meta' };
  if (registradas?.compras > 0 && roasDe(filas30).gasto > 0) return { puede: true, fuente: 'oficina', motivo: `El ROAS sale de las ${registradas.compras} venta(s) que registraste en la oficina (Bandeja, Stripe o el webhook) en 30 días, entre lo gastado en anuncios: son todas tus ventas registradas, no solo las que Meta atribuye a los anuncios.` };
  if (!pixel) return { puede: false, motivo: 'El ROAS no se creó: no hay píxel de Meta en Ajustes → Anuncios. Sin píxel, Meta no sabe qué se vendió por los anuncios (y un ROAS de 0 mentiría).' };
  const r = roasDe(filas30);
  if (!r.compras) return { puede: false, motivo: 'El ROAS no se creó: el píxel no midió ninguna compra de los anuncios en los últimos 30 días. Cuando las haya, vuelve a pulsar «Crear indicadores».' };
  if (r.roas === null) return { puede: false, motivo: 'El ROAS no se creó: Meta midió compras pero no su valor (purchase_roas). Revisa que el píxel mande el valor de cada compra.' };
  return { puede: true, motivo: '' };
}

/**
 * Los valores de hoy (puro). `vistaMes` y `vista30` son lo que contesta GET /api/anuncios con rango «mes» y «30d» (anuncios/modelo.mjs →
 * armarVista); `filas30`, las filas diarias de esos 30 días. null = no se sabe (nunca un 0 inventado).
 * → { meta_gasto_anuncios, meta_costo_resultado, meta_roas, resultadoTexto, moneda }
 */
export function valores({ vistaMes = null, vista30 = null, filas30 = [], pixel = false, registradas = null } = {}) {
  const moneda = vista30?.cuenta?.moneda || vistaMes?.cuenta?.moneda || 'USD';
  const gasto = num(vistaMes?.gasto?.mes);
  // el tipo de resultado con más gasto en 30 días (sus campañas), y su costo: gasto / resultados (el alcance no se suma entre campañas)
  const porTipo = {};
  for (const c of vista30?.campanas || []) { const k = c.resultado; if (!k || !c.cifras || c.cifras.gasto === null) continue; const t = (porTipo[k] ||= { gasto: 0, resultados: 0, campanas: [] }); t.gasto += c.cifras.gasto || 0; t.resultados += c.cifras.resultados || 0; t.campanas.push(c); }
  const [clave, t] = Object.entries(porTipo).sort((a, b) => b[1].gasto - a[1].gasto)[0] || [];
  let costo = null;
  if (t && clave === 'alcance') costo = t.campanas.length === 1 ? num(t.campanas[0].cifras.costoPorResultado) : null;
  else if (t && t.resultados > 0) costo = r2(t.gasto / t.resultados);
  const rp = roasPosible({ pixel, filas30, registradas });
  const g30 = roasDe(filas30).gasto, roas = !rp.puede ? null : rp.fuente === 'oficina' ? (g30 > 0 ? r2(registradas.vendido / g30) : null) : roasDe(filas30).roas;
  return { [IDS.gasto]: gasto, [IDS.costo]: costo, [IDS.roas]: roas, resultadoTexto: t?.campanas[0]?.cifras?.resultadoTexto || null, moneda, roasPosible: rp, roasFuente: rp.puede ? rp.fuente : null };
}

const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * @param {object} o
 * @param {object} o.sync      anuncios/sincronizar.mjs (vista, filas, hoy, conexion, listo)
 * @param {object} o.kpis      { leer: () => { defs, values }, guardar: k => void } — data/kpis.json (serve.mjs)
 * @param {Function} o.ajustes () → cfg.anuncios (el píxel)
 */
export function crearIndicadoresAnuncios({ sync, kpis, ajustes = () => ({}), ahora = () => Date.now(), registradas = () => null }) {
  const pixel = () => Boolean(String(ajustes()?.pixel || '').trim());
  /** Las filas diarias de los últimos 30 días (hoy incluido, en la zona de la cuenta). */
  const filas30 = () => { const h = sync.hoy(), d = new Date(`${h}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 29); return sync.filas(d.toISOString().slice(0, 10), h); };
  const reg = () => { try { return registradas() || null; } catch { return null; } }; // 10 oct 2026: las ventas registradas con la API de conversiones (30 días)
  const datos = () => valores({ vistaMes: sync.vista('mes'), vista30: sync.vista('30d'), filas30: filas30(), pixel: pixel(), registradas: reg() });
  /** Para la página: cuáles tiene el dueño, y si el ROAS se puede crear (y si no, por qué). */
  function estado() {
    const k = kpis.leer(), tiene = id => k.defs.some(x => x.id === id);
    let rp = { puede: false, motivo: '' }; try { rp = roasPosible({ pixel: pixel(), filas30: filas30(), registradas: reg() }); } catch { /* sin datos todavía */ }
    return { gasto: tiene(IDS.gasto), costo: tiene(IDS.costo), roas: tiene(IDS.roas), roasPosible: rp };
  }
  /** Pone el valor de hoy en los indicadores que el dueño tiene: un punto por día (el de hoy se corrige). → los ids actualizados */
  function llevar() {
    if (!sync.conexion?.().cifrasAt) return [];
    const v = datos(), k = kpis.leer(), t = ahora(), hechos = [];
    for (const id of Object.values(IDS)) {
      const val = v[id]; if (val === null || val === undefined || !k.defs.some(x => x.id === id)) continue;
      const l = (k.values[id] ||= []), last = l.at(-1);
      if (last && last.from === 'Meta anuncios' && mismoDia(last.t, t)) { if (last.v === val) continue; last.v = val; last.t = t; }
      else l.push({ t, v: val, from: 'Meta anuncios' });
      if (id === IDS.roas && v.roasFuente) l.at(-1).fuente = v.roasFuente; // 10 oct 2026: de dónde salió el ROAS de ese día
      k.values[id] = l.slice(-400); hechos.push(id);
    }
    if (hechos.length) kpis.guardar(k);
    return hechos;
  }
  /** El botón «Crear indicadores»: los define (sin tocar los que ya tenga) y pone el primer valor. → { creados, ya, motivo? } */
  function crear() {
    const k = kpis.leer(), v = (() => { try { return datos(); } catch { return { moneda: 'USD', roasPosible: roasPosible({ pixel: pixel() }) }; } })();
    const creados = [], ya = [];
    for (const def of definiciones(v.moneda)) {
      if (k.defs.some(x => x.id === def.id)) { ya.push(def.id); continue; }
      if (def.id === IDS.roas && !v.roasPosible.puede) continue;
      k.defs.push(def); creados.push(def.id);
    }
    if (creados.length) kpis.guardar(k);
    try { llevar(); } catch { /* sin cifras todavía: la próxima lectura los pone */ }
    const motivo = !k.defs.some(x => x.id === IDS.roas) ? v.roasPosible.motivo : '';
    return { creados, ya, ...(motivo ? { motivo } : {}) };
  }
  return { estado, llevar, crear };
}
