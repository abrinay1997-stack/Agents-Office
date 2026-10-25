// Agents Office — Anuncios de Meta, Fase A5 (9 oct 2026): LO QUE PASA DESPUÉS DE CADA LECTURA BUENA DE CIFRAS. Salió de serve.mjs (25 oct 2026,
// fase 7 de Cloudflare) para que la oficina local y el Worker hagan EXACTAMENTE lo mismo: el diagnóstico (anuncios/diagnostico.mjs, puro),
// el piloto automático si está encendido (solo pausa), las sugerencias, lo que pasó después de aplicar una (y, si vino de una tarea de ada,
// que la memoria aprenda) y, como mucho una vez al día, la sugerencia de escalar. Aquí no hay disco, ni red, ni reloj: todo entra.
import { diagnosticar, medirResultado, tipoDe } from './diagnostico.mjs';
import { buscar, fechaEn } from './modelo.mjs';

/**
 * @param {object} o
 * @param {object} o.sync        anuncios/sincronizar.mjs (conexion, datosDiagnostico, topes, subidas)
 * @param {object} o.sug         anuncios/sugerencias.mjs (actualizar, marcarAplicada, cerrarResultados, escalarDelDia)
 * @param {object} o.piloto      anuncios/piloto.mjs (correr)
 * @param {Function} o.umbrales  () → { valores, problemas } (cargarUmbrales)
 * @param {Function} o.cpa       () → el costo por resultado objetivo (cpaObjetivo)
 * @param {Function} o.publicaciones () → lo que Analíticas leyó (para «impulsar lo orgánico»); [] si no hay
 * @param {Function} o.aprender  (hecha, resultado) → que la memoria aprenda de la tarea de ada que propuso el cambio
 * @param {Function} o.avisar    (texto, { level, key })
 * @param {Function} o.avisarUmbrales (U) → avisa una vez de los problemas de umbrales.json
 * @param {Function} o.hora      () → la hora (0–23) de quien lee, para no mandar la de escalar de madrugada
 * @returns {Promise<object|null>} el diagnóstico, o null si todavía no hay cifras
 */
export async function trasSondeo({ sync, sug, piloto, umbrales, cpa, publicaciones = () => [], aprender = () => {}, avisar = () => {}, avisarUmbrales = () => {}, ahora = () => Date.now(), hora = () => new Date().getHours() }) {
  if (!sync.conexion().cifrasAt) return null;
  const U = umbrales();
  avisarUmbrales(U);
  if (!U.valores.fatigaFrecuencia) return null;
  const d = sync.datosDiagnostico(), topes = sync.topes();
  let pubs = []; try { pubs = publicaciones() || []; } catch { /* sin Analíticas, no hay «impulsar» */ }
  const diag = diagnosticar({ vista: d.vista, filas: d.filas, hoy: d.hoy, cpa: cpa(), umbrales: U.valores, ahora: ahora(), subidas: sync.subidas(), topes, pixel: d.pixel, publicaciones: pubs });
  const p = await piloto.correr({ sugerencias: diag.sugerencias, vista: d.vistaHoy, topes });
  sug.actualizar(diag);
  for (const h of p.hechas) if (h.ok && h.sugerencia) sug.marcarAplicada(h.sugerencia, { quien: 'piloto', hecho: h.hecho });
  const moneda = d.vista.cuenta?.moneda || 'USD';
  sug.cerrarResultados({
    medir: h => {
      if (!['campana', 'conjunto', 'anuncio'].includes(h.objeto?.nivel)) return { mejoro: null, r: null, texto: 'Esto no se mide con las cifras de un anuncio.' };
      return medirResultado({ filas: d.filas, nivel: h.objeto.nivel, id: h.objeto.id, tipo: tipoDe(buscar(d.vista, h.objeto.id)), aplicadaEl: fechaEn(d.zona, Date.parse(h.aplicadaAt)), hoy: d.hoy, dias: U.valores.resultadoDias, cambio: h.cambio?.tipo, moneda });
    },
    aprender, // como Contenido F4: las notas que citó la tarea de ada se acercan (o se alejan) según cómo le fue
  });
  const h = hora();
  if (h >= 9 && h < 20) { const x = sug.escalarDelDia(d.hoy); if (x) avisar(`📈 «${x.objeto.nombre}» rinde bien: ${x.dato} Propuesta: subir su presupuesto un 20 %, hasta US$${x.cambio.valor}. Gasta más: son tus dos toques, dentro de tus topes. (Anuncios → Sugerencias, J)`, { level: 'info', key: `anuncios-escalar:${x.id}@${x.cambio.valor}` }); }
  return diag;
}
