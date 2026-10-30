// Series: la vista de una serie (lista blanca), PURA: la comparten la oficina local (series.mjs) y la nube (cloudflare/worker/modulos/series.js). Sin E/S.
import { resumenLibro, u2usd, usd2u } from './serie-core.mjs';
export const ETIQUETA = { previsto: 'Prevista', espera_ok: 'Espera tu clic', muestra: 'Generando la muestra', corriendo: 'Generando', pausado: 'Pausada', hecho: 'Hecha', cancelado: 'Cancelada' };
// En la nube el libro vive en SQL (series_libro) y llega como { reservado, gastado, incierto, excedido } en micro-USD; el tope sale de la serie.
const resumenSql = (s, q) => { const tope = usd2u(s.tope_usd ?? 0); return { tope, reservado: q.reservado, gastado: q.gastado, incierto: q.incierto, excedido: !!q.excedido, disponible: tope - q.reservado - q.gastado - q.incierto }; };
/** Lo que se enseña de una serie: LISTA BLANCA. Nunca el token ni lo que autoriza, ni el libro, ni el brief (objetivo, restricciones), ni los prompts completos ni los precios. */
const corto = (v, n) => (v == null ? null : String(v).slice(0, n));
const planoVista = p => ({ n: p.n, rol: p.rol, estado: p.estado, descripcion: corto(p.descripcion, 120), motivo: corto(p.motivo, 160), modelo: p.modelo || null, version: p.version || 0, clave: !!p.clave,
  versiones: (p.versiones || []).map(v => ({ v: v.v, intento: v.intento, costo_usd: v.costo_usd ?? 0 })) }); // sin `archivo`: su nombre lleva el prompt
export function vistaSerie(s, { libro: sql = null, inciertos = [] } = {}) {
  if (!s) return null;
  const planos = s.escaleta || [], cuenta = e => planos.filter(p => p.estado === e).length;
  const r = sql ? resumenSql(s, sql) : s.libro ? resumenLibro(s.libro) : null, mostrado = s.costo_mostrado_usd ?? null;
  return { id: s.id, titulo: corto(s.titulo, 100), formato: corto(s.brief?.formato, 40), estado: s.estado, etiqueta: ETIQUETA[s.estado] || s.estado, creada: s.creada, actualizada: s.actualizada, v: s.v, hash: s.hash, escaleta_v: s.escaleta_v,
    biblia_version: s.biblia_version ?? null, modo: s.autorizado?.modo || null, tope_usd: s.tope_usd, pausa_motivo: corto(s.pausa_motivo, 300), muestra_lista: !!s.muestra_lista, cancelada: !!s.cancelada, fin: s.fin || null,
    autorizada: !!s.autorizado && (s.estado === 'muestra' || s.estado === 'corriendo'),
    progreso: { total: planos.length, listos: cuenta('listo'), revisar: cuenta('revisar'), previstos: cuenta('previsto'), corriendo: cuenta('corriendo'), omitidos: cuenta('skipped') },
    gasto: { mostradoUsd: mostrado, topeUsd: s.tope_usd, gastadoUsd: r ? u2usd(r.gastado) : 0, reservadoUsd: r ? u2usd(r.reservado) : 0, inciertoUsd: r ? u2usd(r.incierto) : 0,
      disponibleUsd: r ? u2usd(r.disponible) : s.tope_usd, excedido: r ? r.excedido : false, mayorQueLoMostrado: mostrado != null && r ? r.gastado > usd2u(mostrado) : false },
    escaleta: planos.map(planoVista),
    pasos_inciertos: sql ? inciertos.map(x => ({ clave: x.clave, n: x.n, intento: x.intento, maxUsd: u2usd(x.max_micro) })) : Object.entries(s.pasos || {}).filter(([c]) => s.libro?.lineas?.[c]?.estado === 'incierto').map(([clave, x]) => ({ clave, n: x.n, intento: x.intento, maxUsd: u2usd(s.libro.lineas[clave].max) })) };
}
export const resumenSerie = s => {
  const v = vistaSerie(s);
  return { id: v.id, titulo: v.titulo, estado: v.estado, etiqueta: v.etiqueta, progreso: v.progreso, gasto: v.gasto, hash: v.hash, escaleta_v: v.escaleta_v, biblia_version: v.biblia_version,
    creada: v.creada, actualizada: v.actualizada, pausa_motivo: v.pausa_motivo || null };
};


/** La misma vista SIN dinero, para quien no es administrador (SEG-04: el rol «lectura» ve resultados, no dinero; el editor tampoco): fuera `gasto`, el tope, el costo de cada versión y lo que costó cada paso en duda.
 *  Se quedan los avances, los estados y cuáles pasos están en duda (sin cifra). Sirve para la vista y para el resumen de la lista. Pura. */
export function sinDinero(v) {
  if (!v) return v;
  const { gasto, tope_usd, pasos_inciertos, escaleta, ...r } = v; void gasto; void tope_usd;
  return { ...r, ...(escaleta ? { escaleta: escaleta.map(p => ({ ...p, versiones: (p.versiones || []).map(x => ({ v: x.v, intento: x.intento })) })) } : {}),
    ...(pasos_inciertos ? { pasos_inciertos: pasos_inciertos.map(x => ({ clave: x.clave, n: x.n, intento: x.intento })) } : {}) };
}
