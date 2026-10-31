// Series en la nube, N2/N3 (solo lectura y propuesta): armar la PROPUESTA de una serie con el mismo núcleo puro que la oficina local (serie-propuesta-core.armarPropuesta) y, si se pide, GUARDARLA como «prevista».
// NO reserva, NO gasta, NO llama a ningún motor de imagen: lo único que consulta es el catálogo del Estudio (sus precios y capacidades, que son datos) y la galería (que las referencias existan).
// Lo guardado es lo que armó el Worker, nunca lo que mande el navegador. Una escaleta crece por TANDAS de hasta TANDA_MAX planos (cada llamada escribe pocas cosas y cabe en los límites de D1).
import * as catalogo from '../../../../media/catalogo.mjs';
import * as B from '../../../../biblia-core.mjs';
import { armarPropuesta, resumenPropuesta, preciosDeCifras, MAX_PLANOS_SERIE, precioSeguro } from '../../../../serie-propuesta-core.mjs';
import { cablearMedia, configDeAjustes, serieValida } from '../../../../series-bomba-core.mjs';
import { TANDA_MAX, estimarSerie, cabeEnTope, CONFIG_SERIE } from '../../../../serie-core.mjs';
import { prepararEstudio } from '../estudio/entorno.js';
import { cuales, validoId } from '../estudio/galeria.js';
import { leerCifras } from '../negocio.js';
import { leerCfg } from '../ajustes.js';
import { leerBiblia, leerHojas } from './biblia.js';

const azarPorDefecto = () => Math.random().toString(36).slice(2, 6).padEnd(4, '0');
const idNuevo = (ahora, azar) => `serie-${ahora.toString(36)}-${azar()}`.slice(0, 60);

/** Todo lo que necesita armar una propuesta, leído UNA vez: la biblia, las hojas, las cifras, los topes y qué referencias existen en la galería. */
async function contexto(env, db, { planos }) {
  await prepararEstudio(env, db); // enciende en el catálogo los motores según los secretos del Worker (solo datos)
  const [biblia, hojas, cifras, cfg] = await Promise.all([leerBiblia(db), leerHojas(db), leerCifras(db), leerCfg(db)]);
  const ids = new Set();
  for (const p of Array.isArray(planos) ? planos : []) for (const r of B.idsValidos(p?.refs, 12)) ids.add(r);
  for (const h of hojas) for (const r of h.refs || []) ids.add(r);
  for (const r of B.anclasDeBiblia(biblia.biblia)) ids.add(r);
  const existen = await cuales(db, [...ids]);
  const cable = cablearMedia(catalogo), config = configDeAjustes(cfg.dimitri);
  return { biblia, hojas, config, cable,
    ctxBase: { capsDe: cable.capsDe, precioPlano: cable.precioPlano, existeRef: (id) => { const v = validoId(id); return !!v && existen.has(v); }, preciosPermitidos: preciosDeCifras(cifras), config, modeloUnico: catalogo.defaultModel('image'), costoRevision: null } }; // sin revisión por visión en la nube todavía
}

/** → { estado, cuerpo }. `guardar: true` guarda la propuesta como «prevista» (no reserva ni gasta). */
export async function proponer(env, db, { brief, planos, guardar = false } = {}, { almacen, ahora = Date.now(), azar = azarPorDefecto } = {}) {
  const c = await contexto(env, db, { planos });
  const r = armarPropuesta({ brief, planos, biblia: c.biblia, hojas: c.hojas, ctx: { ...c.ctxBase, id: idNuevo(ahora, azar) } });
  if (!r.ok) return { estado: r.codigo === 'sin_biblia' ? 409 : 422, cuerpo: { error: r.motivo, codigo: r.codigo, problemas: r.problemas } };
  let guardada = null;
  if (guardar === true) {
    const s = await almacen.crear(r.serie, { costo_mostrado_usd: r.costoMostradoUsd, cabe: r.cabe, incluye_revision: r.incluyeRevision, brief: r.serie.brief });
    guardada = { id: s.id, hash: s.hash, estado: s.estado };
  }
  return { estado: 200, cuerpo: { ...r, resumen: resumenPropuesta(r), ...(guardar === true ? { guardada } : {}), nota: 'Es una PROPUESTA: no se generó ni se gastó nada.' } };
}

/** El costo máximo de lo que falta generar en TODA la escaleta (no solo de la tanda): lo que se le mostrará al dueño. null si algún plano no tiene precio fiable (falla cerrado: no se enseña un costo falso). */
export function recostear(escaleta, { precioPlano, config }) {
  const vivos = escaleta.filter((p) => p.estado !== 'skipped');
  const precios = vivos.map((p) => precioSeguro(precioPlano(p.modelo, p.ajustes)));
  if (!vivos.length || precios.some((x) => !x)) return { costoMostradoUsd: null, cabe: false };
  const est = estimarSerie(precios, config), tope = config?.topeSerieUsd ?? CONFIG_SERIE.topeSerieUsd;
  return { costoMostradoUsd: est.maximoUsd, cabe: cabeEnTope(est, tope) };
}

/** Añade UNA tanda (1 a TANDA_MAX planos) a una serie guardada que todavía no gasta (prevista o esperando el clic), con la biblia aprobada y la MISMA versión que ya tiene la serie.
 *  → { estado, cuerpo }. La escaleta cambia, así que cambia su hash: lo que se hubiera mostrado antes deja de valer (la serie vuelve a «prevista»). */
export async function anadirTanda(env, db, id, { planos } = {}, { almacen, ahora = Date.now(), azar = azarPorDefecto } = {}) {
  void ahora; void azar;
  const lista = Array.isArray(planos) ? planos : [];
  if (!lista.length || lista.length > TANDA_MAX) return { estado: 422, cuerpo: { error: `Una tanda lleva de 1 a ${TANDA_MAX} planos (llegaron ${lista.length}).`, codigo: 'tanda' } };
  const s0 = await almacen.uno(id);
  if (!s0) return { estado: 404, cuerpo: { error: 'No encuentro esa serie.' } };
  if (!['previsto', 'espera_ok'].includes(s0.estado)) return { estado: 409, cuerpo: { error: `Una serie ${s0.estado} ya no admite más planos: solo una prevista.`, codigo: 'estado' } };
  if (s0.escaleta.length + lista.length > MAX_PLANOS_SERIE) return { estado: 422, cuerpo: { error: `Una serie lleva como mucho ${MAX_PLANOS_SERIE} planos (ya tiene ${s0.escaleta.length}).`, codigo: 'larga' } };
  const c = await contexto(env, db, { planos: lista });
  if (!c.biblia.existe || c.biblia.estado !== 'aprobada' || c.biblia.version !== s0.biblia_version) return { estado: 409, cuerpo: { error: `La biblia visual vigente ya no es la v${s0.biblia_version} de esta serie (o no está aprobada): una tanda nueva exige la misma.`, codigo: 'biblia' } };
  const r = armarPropuesta({ brief: s0.brief, planos: lista, biblia: c.biblia, hojas: c.hojas, ctx: { ...c.ctxBase, id: s0.id, modeloUnico: s0.modelo_unico ?? c.ctxBase.modeloUnico, maxPlanos: TANDA_MAX } });
  if (!r.ok) return { estado: r.codigo === 'sin_biblia' ? 409 : 422, cuerpo: { error: r.motivo, codigo: r.codigo, problemas: r.problemas } };
  let desde = 0, fallo = null;
  const s = await almacen.actualizar(id, (y) => {
    if (!['previsto', 'espera_ok'].includes(y.estado)) { fallo = { estado: 409, error: `Una serie ${y.estado} ya no admite más planos.` }; return undefined; }
    if (y.escaleta.length + r.serie.escaleta.length > MAX_PLANOS_SERIE) { fallo = { estado: 422, error: `Una serie lleva como mucho ${MAX_PLANOS_SERIE} planos.` }; return undefined; }
    if (y.biblia_version !== s0.biblia_version) { fallo = { estado: 409, error: 'La biblia de la serie cambió mientras tanto.' }; return undefined; }
    desde = y.escaleta.length; // se renumera DENTRO del cambio: si otra tanda entró en medio, se vuelve a calcular con lo que hay
    const nuevos = r.serie.escaleta.map((p, i) => ({ ...p, n: desde + i + 1 }));
    const escaleta = [...y.escaleta, ...nuevos], rc = recostear(escaleta, { precioPlano: c.cable.precioPlano, config: c.config });
    return { ...y, escaleta, estado: 'previsto', token_reg: null, token_actual: null, autorizado: null, costo_mostrado_usd: rc.costoMostradoUsd, cabe: rc.cabe };
  });
  if (fallo) return { estado: fallo.estado, cuerpo: { error: fallo.error } };
  if (!s || !serieValida(s)) return { estado: 404, cuerpo: { error: 'No encuentro esa serie.' } };
  const problemas = r.problemas.map((p) => (Number.isInteger(p.n) ? { ...p, n: p.n + desde } : p));
  return { estado: 200, cuerpo: { agregados: r.serie.escaleta.length, omitidos: r.omitidos, problemas, hash: s.hash, escaleta: s.escaleta.length, gasta: false, nota: 'Se añadió la tanda. No se generó ni se gastó nada: la escaleta cambió, así que cualquier clic anterior ya no vale.' } };
}
