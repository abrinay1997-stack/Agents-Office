// Agents Office (29 oct 2026) — Fase 11.1 (carril K), oficina local: describir las imágenes de la galería con visión y dejar la descripción en su ficha.
// La lógica (qué falta, cuánto cuesta, qué es seguro de guardar) está en descripcion-core.mjs; aquí solo se junta con el disco y el modelo, todo INYECTADO
// (la galería, la reducción de la imagen, la llamada al modelo, la auditoría), así que se prueba sin red ni sharp.
//   · `plan()` y `leer()` NO gastan nada. `ejecutar()` es lo único que llama a un modelo y exige que quien lo pide haya visto el costo (`confirmarUsd`).
//   · Cada imagen que sale hacia el modelo pasa por privacidad-core.puedeEnviar (dentro del plan) y deja una línea `envio-tercero` en la auditoría.
//   · El tope se vigila ANTES de cada tanda con lo ya gastado de verdad (lo que informa el modelo), no solo con la estimación.
//   · Flag: office.config.json → estudio.descripcionesIA (apagado por defecto). Con el flag apagado, lo ya descrito se sigue leyendo.
import fs from 'node:fs';
import * as D from './descripcion-core.mjs';
import { lineaAuditoria } from './media/privacidad-core.mjs';

export function crearDescripcionLocal({ media, copiaParaVer, ask, auditar = () => {}, ahora = () => Date.now(), activo = () => false, topeUsd = () => 1, destino = 'anthropic', modelo = '' }) {
  const bytesDe = f => { try { const p = media.resolve(f.file); return p ? fs.statSync(p).size : 0; } catch { return 0; } };
  /** Las fichas de imagen que pide el llamador: ids explícitos, o una carpeta / búsqueda de la galería. */
  function seleccionar({ ids, folder, q } = {}) {
    if (Array.isArray(ids) && ids.length) return ids.slice(0, 300).map(id => media.item(String(id))).filter(Boolean);
    return (media.query({ folder: folder || 'all', q: q || '', kind: 'image', n: 200 }).items || []);
  }
  const carpetas = () => Object.fromEntries((media.folders() || []).map(f => [f.id, f]));
  function plan(sel, o = {}) { const fichas = seleccionar(sel); return { fichas, plan: D.planDescripcion(fichas, { forzar: !!o.forzar, destino, carpetas: carpetas(), topeUsd: topeUsd(), bytesDe }) }; }
  /** Lo ya descrito (paginado, ≤3.500 caracteres) — no gasta nada. */
  function leer(sel, { pagina = 1 } = {}) { const { fichas, plan: p } = plan(sel); return { ...D.resumenParaChat(fichas.filter(f => f.desc || f.desc_sospecha), { pagina }), pendientes: p.pendientes.length, costoEstimadoUsd: p.costoEstimadoUsd, omitidas: p.omitidas }; }

  async function ejecutar(sel, { forzar = false, confirmarUsd = 0, por = 'dueno' } = {}) {
    if (!activo()) { const e = new Error('Describir imágenes está apagado (office.config.json → estudio.descripcionesIA).'); e.status = 409; throw e; }
    const { plan: p } = plan(sel, { forzar });
    if (!p.pendientes.length) return { descritas: [], yaDescritas: p.yaDescritas, omitidas: p.omitidas, errores: [], gastoUsd: 0, costoEstimadoUsd: 0 };
    if (!(Number(confirmarUsd) >= p.costoEstimadoUsd)) { const e = new Error(`Describir ${p.pendientes.length} imágenes cuesta unos US$${p.costoEstimadoUsd.toFixed(3)} (estimado) y no confirmaste ese costo.`); e.status = 409; e.costoEstimadoUsd = p.costoEstimadoUsd; throw e; }
    const descritas = [], errores = [], omitidas = [...p.omitidas]; let gasto = 0, pausa = null;
    for (const tanda of p.tandas) {
      if (gasto + tanda.length * D.USD_POR_IMAGEN > topeUsd() + 1e-9) { pausa = `se paró al llegar al tope de US$${topeUsd().toFixed(2)} (llevaba US$${gasto.toFixed(3)})`; for (const id of tanda) omitidas.push({ id, motivo: pausa }); continue; }
      const imgs = [], ids = [], huellas = {};
      for (const id of tanda) {
        try { const c = await copiaParaVer(media.resolve(id)); imgs.push({ media_type: c.media_type, data: c.data, file: id }); ids.push(id); huellas[id] = D.huellaImagen(media.item(id), bytesDe({ file: id })); }
        catch (e) { errores.push({ id, motivo: e.message }); }
      }
      if (!ids.length) continue;
      for (const id of ids) auditar(lineaAuditoria(id, destino, por));
      let r; try { const { system, user } = D.promptDescripcion(ids.length); r = await ask(system, user, { images: imgs, kind: 'vision', maxTokens: 1500, timeout: 120000, tools: false }); }
      catch (e) { for (const id of ids) errores.push({ id, motivo: e.message }); continue; }
      gasto += Number(r.usd) || 0;
      const lei = D.leerRespuesta(r.text, ids, { modelo: r.modelId || modelo, ahora: ahora(), huellas });
      for (const [id, f] of lei) { if (f.error) { errores.push({ id, motivo: f.error }); continue; } media.update(id, f); descritas.push(id); } // un campo a la vez nunca pisa lo del dueño: update() mezcla
    }
    return { descritas, yaDescritas: p.yaDescritas, omitidas, errores, gastoUsd: Math.round(gasto * 10000) / 10000, costoEstimadoUsd: p.costoEstimadoUsd, ...(pausa ? { pausa } : {}) };
  }
  return { plan, leer, ejecutar, seleccionar };
}
