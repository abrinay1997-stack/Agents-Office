// Agents Office (29 oct 2026) — Fase 11.3 (carril K), oficina local: la ruta que PROPONE una serie. Todo inyectado, sin red.
//   POST /api/series/proponer  { brief, planos }  → la propuesta (serie-propuesta-core.armarPropuesta). NO gasta, NO genera, NO guarda.
//   POST /api/series/revisar-plano { file, personajes?, texto_en_imagen?, confirmarUsd } → revisión por visión de un plano YA generado (11.4). Flag `dimitri.serieVision` (apagado); solo el dueño; sin confirmar el costo no llama a nada.
// Apagada con `dimitri.series` (por defecto). GENERAR SERIE (token + hash + tope) llega en otro PR; hasta entonces esta ruta no puede gastar porque no tiene con qué.
import { armarPropuesta, resumenPropuesta, preciosDeCifras } from './serie-propuesta-core.mjs';
import { armarPedidoVision, revisarPlano, fichaDeRevision, USD_POR_REVISION, MAX_REFS_VISION } from './serie-vision-core.mjs';
import { tipoDe } from './ver-imagen-core.mjs';

/** El cableado con el Estudio (media.mjs), aparte para probarlo con el de verdad. precio: null si no es fiable (falla cerrado). */
export function cablearMedia(media) {
  const modelo = id => (id ? media.models().find(x => x.id === id) : null);
  return {
    capsDe: id => { const m = modelo(id); return m && m.on && m.kind === 'image' ? media.capsOf(m) : null; },
    precioPlano: (id, aj) => { const m = modelo(id); if (!m) return null; const e = media.estimate({ model: id, n: 1, settings: aj || {} });
      return typeof e === 'number' && Number.isFinite(e) && (e > 0 || m.engine === 'prueba') ? { generacion: e, gratis: m.engine === 'prueba' } : null; },
    existeRef: id => !!media.resolve(id),
  };
}
/** Los topes de la serie desde office.config.json → dimitri (serieTopeUsd, serieTopeMesUsd, serieReintentos). Solo valores válidos; lo demás queda en CONFIG_SERIE. */
export function configDeAjustes(d) {
  const x = d && typeof d === 'object' ? d : {}, num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined);
  const c = { topeSerieUsd: num(x.serieTopeUsd, 1000), topeMesCarruselesUsd: num(x.serieTopeMesUsd, 10000), reintentosMax: Number.isInteger(x.serieReintentos) && x.serieReintentos >= 0 && x.serieReintentos <= 3 ? x.serieReintentos : undefined };
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined));
}
export function crearSeries({ biblia, capsDe, existeRef, precioPlano, cifras = () => ({}), activo = () => false, id = () => 'serie-' + Date.now().toString(36), config = null, modeloUnico = () => null, vision = null }) {
  const conf = () => (typeof config === 'function' ? config() : config) || null;
  // 11.4: `vision` = { activo(), media, copiaParaVer, mirar, auditar, destino, puedeVer(), motivoSinVer, presupuesto } — todo inyectado; sin él la ruta contesta 501
  const costoRevision = () => (vision?.activo?.() ? { qa: 0, vision: USD_POR_REVISION } : null); // la QA determinista es gratis; la visión se cuenta por intento
  const err = (estado, error, extra = {}) => ({ estado, cuerpo: { error, ...extra } });
  function proponer({ brief, planos, por = 'dueno' } = {}) {
    if (por !== 'dueno') return err(403, 'Proponer una serie es del dueño (o de Dimitri con su clic).');
    if (!activo()) return err(409, 'Las series están apagadas (office.config.json → dimitri.series).');
    const r = armarPropuesta({ brief, planos, biblia: biblia.leer(), hojas: biblia.hojas(), ctx: { id: id(), capsDe, existeRef, precioPlano, preciosPermitidos: preciosDeCifras(cifras()), config: conf(), modeloUnico: modeloUnico(), costoRevision: costoRevision() } });
    if (!r.ok) return err(r.codigo === 'sin_biblia' ? 409 : 422, r.motivo, { codigo: r.codigo, problemas: r.problemas });
    return { estado: 200, cuerpo: { ...r, resumen: resumenPropuesta(r), nota: 'Es una PROPUESTA: no se generó ni se gastó nada. GENERAR SERIE es el clic del dueño.' } };
  }
  /** Revisa por visión un plano YA generado (id de galería) contra la biblia aprobada y las hojas que nombra. Solo el dueño; apagado → 409; sin confirmar el costo no llama a nada. */
  async function revisar({ file, personajes = [], texto_en_imagen = '', descripcion = '', confirmarUsd = 0, por = 'dueno' } = {}) {
    if (por !== 'dueno') return err(403, 'Revisar por visión gasta un poco: es del dueño.');
    if (!vision?.activo?.()) return err(409, 'La revisión por visión está apagada (office.config.json → dimitri.serieVision).');
    if (!vision.mirar) return err(501, 'No hay un modelo de visión conectado en esta oficina.');
    const id = typeof file === 'string' ? file : '', M = vision.media, ficha = id ? M.item(id) : null;
    if (!ficha) return err(404, 'No encuentro esa imagen en la galería.');
    if (tipoDe(id).tipo !== 'imagen') return err(422, 'Solo se revisa una imagen (JPEG, PNG o WebP).');
    const b = biblia.leer(), porNombre = new Map(biblia.hojas().map(h => [String(h.nombre).toLowerCase(), h]));
    const usadas = []; for (const nm of (Array.isArray(personajes) ? personajes : []).slice(0, 6)) { const h = porNombre.get(String(nm).toLowerCase().trim()); if (!h) return err(422, `No hay una hoja llamada «${String(nm).slice(0, 60)}».`); usadas.push(h); }
    const refIds = [...new Set(usadas.flatMap(h => h.refs || []))].filter(r => r !== id && M.item(r)).slice(0, MAX_REFS_VISION);
    const pedido = armarPedidoVision({ biblia: b, hojas: usadas, plano: { texto_en_imagen, descripcion }, nRefs: refIds.length });
    if (!pedido.ok) return err(pedido.codigo === 'sin_biblia' ? 409 : 422, pedido.motivo, { codigo: pedido.codigo });
    if (!(Number(confirmarUsd) >= pedido.costoEstimadoUsd)) return err(409, `Revisar este plano cuesta unos US$${pedido.costoEstimadoUsd.toFixed(3)} (estimado) y no confirmaste ese costo.`, { costoEstimadoUsd: pedido.costoEstimadoUsd, gasta: false });
    const cargar = async () => { const c = await vision.copiaParaVer(M.resolve(id)), refs = []; // se llama DENTRO del turno de revisión: una petición en cola no carga su imagen
      for (const r of refIds) { const q = await vision.copiaParaVer(M.resolve(r)); refs.push({ media_type: q.media_type, data: q.data, file: r }); }
      return { imagen: { media_type: c.media_type, data: c.data, file: id }, refs }; };
    const carpetaDe = f => { const fid = f && f.folder; return fid ? (M.folders() || []).find(x => x.id === fid) || null : null; };
    const v = await revisarPlano({ pedido, cargar, ficha, carpeta: carpetaDe(ficha), refsFichas: refIds.map(r => { const f = M.item(r); return { ficha: f, carpeta: carpetaDe(f) }; }),
      activo: true, puedeVer: vision.puedeVer ? vision.puedeVer() : false, motivoSinVer: vision.motivoSinVer, destino: vision.destino, por, presupuesto: vision.presupuesto, auditar: vision.auditar, mirar: vision.mirar });
    const sinLlamar = { tope: 409, interno: 500, cola_llena: 429, carga: 422 }[v.codigo]; // no se llamó al modelo: el día/mes del Estudio no alcanza (409), falló el libro (500, falla cerrado), cola llena (429) o no se pudo preparar la imagen (422)
    if (sinLlamar) return err(sinLlamar, v.motivo, { codigo: v.codigo, gasta: !!v.puedeHaberCobrado, ...(v.puedeHaberCobrado ? { puedeHaberCobrado: true, costoUsd: v.costoUsd } : {}) }); // «gasta:false» solo si de verdad no se envió nada
    try { M.update(id, { qa_vision: fichaDeRevision(v, { biblia_version: b.version, ahora: Date.now() }) }); } catch { /* guardar la nota no es lo que importa */ }
    return { estado: 200, cuerpo: { veredicto: v, costoEstimadoUsd: pedido.costoEstimadoUsd, biblia_version: b.version, nota: v.estado === 'cumple' ? 'Cumple lo que se pudo comprobar. Aprobar sigue siendo tuyo.' : 'No está verificado como correcto: queda para tu revisión.' } };
  }
  async function ruta(metodo, pathname, { cuerpo = {}, agente = false } = {}) {
    if (pathname === '/api/series/revisar-plano' && metodo === 'POST') return revisar({ file: cuerpo.file, personajes: cuerpo.personajes, texto_en_imagen: cuerpo.texto_en_imagen, descripcion: cuerpo.descripcion, confirmarUsd: cuerpo.confirmarUsd, por: agente ? 'agente' : 'dueno' });
    if (pathname === '/api/series/proponer' && metodo === 'POST') return proponer({ brief: cuerpo.brief, planos: cuerpo.planos, por: agente ? 'agente' : 'dueno' });
    return null;
  }
  return { proponer, revisar, ruta };
}
