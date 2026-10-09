// ============================================================
// Agents Office — Anuncios de Meta, Fase A5 (9 oct 2026): EL PILOTO AUTOMÁTICO. Apagado por defecto (Ajustes → Anuncios →
// «Piloto automático (solo para gastar MENOS)», `anuncios.pilotoAutomatico`). docs/plan-meta-anuncios-y-bandeja-2026-10-09.md §3.2 y §5 A5.
//
// Tras cada lectura de cifras, y SOLO si el dueño lo encendió, hace sin preguntar lo único que BAJA el gasto:
//   · pausar un anuncio (o un conjunto) que pasó el umbral de «cortar» del diagnóstico (anuncios/diagnostico.mjs);
//   · pausar TODAS las campañas activas si el gasto de hoy pasa el tope diario.
// Lo hace POR anuncios/acciones.mjs con `por: 'piloto'`, que ya solo admite pausar, bajar un presupuesto o archivar (lo demás: 403), y
// el único tipo que este archivo sabe pedir es PAUSAR (PUEDE, abajo): no hay aquí ni una línea que encienda o suba nada, aunque alguien
// lo configure para eso. Cada pausa avisa (aviso de la oficina y Telegram, con «↶ Deshacer»); deshacerla vuelve a gastar, así que es
// del dueño, con sus dos clics y dentro de sus topes (en Telegram, el botón pide la cifra; en la página, desde su fila en Anuncios).
// tests/anuncios-sugerencias.test.mjs comprueba que nunca pide otra cosa.
// ============================================================
export const PUEDE = Object.freeze(['pausar']);

/**
 * @param {object} o
 * @param {object} o.acciones   anuncios/acciones.mjs (accion)
 * @param {Function} o.ajustes  () → cfg.anuncios (se lee cada vez: Ajustes lo cambia en caliente)
 * @param {Function} o.avisar   (texto, { level, key }) → notice() de serve.mjs (y de ahí a Telegram)
 */
export function crearPiloto({ acciones, ajustes = () => ({}), avisar = () => {} }) {
  const encendido = () => ajustes()?.pilotoAutomatico === true;

  async function pausarUno(id, nombre, por) {
    const tipo = PUEDE[0];
    const r = await acciones.accion({ tipo, id, por: 'piloto' });
    if (r.status !== 200 || !r.cuerpo?.ok) return { id, ok: false, motivo: r.cuerpo?.motivo || r.cuerpo?.error || `HTTP ${r.status}` };
    avisar(`🤖 Piloto automático: pausé «${nombre}» (id ${id}). ${por} Deja de gastar ya. Deshacerlo vuelve a gastar: lo haces tú, con «↶ Deshacer» aquí o en Anuncios (J).`, { level: 'warn', key: `anuncios-piloto:${id}` });
    return { id, ok: true, hecho: r.cuerpo.hecho };
  }

  /**
   * @param {object} o
   * @param {Array}  o.sugerencias  las del diagnóstico de esta lectura
   * @param {object} o.vista        la vista de hoy (gasto.hoy y campañas activas)
   * @param {object} o.topes        { diario, … }
   * → { hechas: [{ id, ok, sugerencia?, hecho? }], motivo? }
   */
  async function correr({ sugerencias = [], vista = null, topes = {} } = {}) {
    if (!encendido()) return { hechas: [], motivo: 'apagado' };
    const hechas = [];
    const tope = Number(topes?.diario), hoy = vista?.gasto?.hoy;
    if (hoy != null && Number.isFinite(tope) && (tope > 0 ? hoy >= tope : hoy > 0)) {
      for (const c of (vista?.campanas || []).filter(x => x.estado === 'ACTIVE')) hechas.push(await pausarUno(c.id, c.nombre, `El gasto de hoy (US$${Number(hoy).toFixed(2)}) llegó al tope diario (US$${tope.toFixed(2)}).`));
      return { hechas };
    }
    for (const s of sugerencias.filter(x => x.regla === 'cortar' && x.cambio?.tipo === PUEDE[0])) {
      const r = await pausarUno(s.cambio.id, s.objeto?.nombre || s.cambio.id, `Pasó el umbral de cortar: ${s.dato}`);
      hechas.push({ ...r, sugerencia: s.id });
    }
    return { hechas };
  }
  return { correr, encendido, PUEDE };
}
