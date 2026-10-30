// Agents Office (30 oct 2026) — Fase 11.5 (carril K), oficina local, PR A: la SERIE PERSISTIDA. Almacén, lectura y estados. NO gasta, NO reserva, NO genera.
// Todo inyectado (archivo, renombrar, reloj): se prueba sin red y sin la hora del día. Lo puro vive en serie-core / serie-topes-core / serie-propuesta-core.
//   data/series.json  → { v, uso: { day, peso }, series: [serie] }  (escritura a un temporal y `renombrar` de fs-seguro.mjs; `data/` NO viaja por GitHub).
// Una serie guardada es la que SALIÓ de armarPropuesta (la oficina la calculó, no el navegador). Estados de serie-core:
//   previsto → espera_ok (hay un token pedido) → muestra → corriendo → hecho · pausado · cancelado  («generando» = muestra/corriendo; «hecha» = hecho).
// Versionado: `hash` = hashEscaleta (solo lo que cambia lo que se genera) y `escaleta_v` sube cada vez que ese hash cambia; `v` es el contador de cada escritura.
import fs from 'node:fs';
import path from 'node:path';
import { hashEscaleta, resumenLibro, nuevoLibro, u2usd, usd2u, TRANSICIONES } from './serie-core.mjs';

export const MAX_SERIES = 200; // más viejas ya terminadas se podan al guardar
export const ETIQUETA = { previsto: 'Prevista', espera_ok: 'Espera tu clic', muestra: 'Generando la muestra', corriendo: 'Generando', pausado: 'Pausada', hecho: 'Hecha', cancelado: 'Cancelada' };
const TERMINAL = new Set(['hecho', 'cancelado']);
const ID_OK = /^[\w-]{1,60}$/;

/** El almacén en un archivo. `renombrar(tmp, archivo)` es el de fs-seguro.mjs (en Windows reintenta). Un archivo roto se aparta (nunca se pierde ni se pisa en silencio). */
export function crearAlmacen({ archivo, renombrar, ahora = () => Date.now(), azar = () => Math.random().toString(36).slice(2, 6) } = {}) {
  if (!archivo || typeof renombrar !== 'function') throw new Error('el almacén de series necesita archivo y renombrar');
  let D = null;
  const cargar = () => {
    if (D) return D;
    let txt = null; try { txt = fs.readFileSync(archivo, 'utf8'); } catch { /* aún no existe */ }
    if (txt != null) {
      try { const j = JSON.parse(txt); if (j && typeof j === 'object' && Array.isArray(j.series)) D = { v: 1, uso: j.uso && typeof j.uso === 'object' ? j.uso : { day: '', peso: 0 }, series: j.series }; else throw new Error('forma'); }
      catch { try { fs.copyFileSync(archivo, `${archivo}.roto-${ahora()}`); } catch { /* ya */ } D = null; }
    }
    return (D ||= { v: 1, uso: { day: '', peso: 0 }, series: [] });
  };
  const escribir = () => {
    const d = cargar();
    if (d.series.length > MAX_SERIES) { // se podan las terminadas más viejas; una viva nunca
      const sobran = d.series.length - MAX_SERIES, viejas = d.series.filter(s => TERMINAL.has(s.estado)).sort((a, b) => (a.actualizada || 0) - (b.actualizada || 0)).slice(0, sobran).map(s => s.id);
      d.series = d.series.filter(s => !viejas.includes(s.id));
    }
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    const tmp = archivo + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); renombrar(tmp, archivo);
  };
  const copia = s => (s ? structuredClone(s) : null);
  return {
    todas: () => cargar().series.map(copia),
    estadoDe: id => cargar().series.find(s => s.id === id)?.estado || null, // barato (sin copiar): lo mira la poda de trabajos del Estudio
    uno: id => copia(cargar().series.find(s => s.id === id)),
    /** Guarda una serie NUEVA (la de armarPropuesta). Nunca pisa otra con el mismo id. */
    crear(serie, extra = {}) {
      const d = cargar(); let id = String(serie?.id || '');
      if (!ID_OK.test(id) || d.series.some(s => s.id === id)) id = `${ID_OK.test(id) ? id : 'serie'}-${azar()}`.slice(0, 60);
      const t = ahora(), s = { ...structuredClone(serie), id, estado: 'previsto', creada: t, actualizada: t, v: 1, escaleta_v: 1, intentos: {}, fallos: {}, pasos: {}, libro: null, autorizado: null, token_reg: null, ...extra };
      s.hash = hashEscaleta(s); d.series.push(s); escribir(); return copia(s);
    },
    /** Cambia una serie con una función SÍNCRONA (leer-modificar-escribir sin await entre medias: en un solo proceso es una comparación-e-intercambio). `fn(copia)` devuelve la copia
     *  cambiada o lanza; si devuelve `undefined` no se escribe nada. Sube `v`, y `escaleta_v` si la escaleta cambió. */
    actualizar(id, fn) {
      const d = cargar(), i = d.series.findIndex(s => s.id === id); if (i < 0) return null;
      const antes = d.series[i], hecha = fn(structuredClone(antes)); if (hecha === undefined) return copia(antes);
      const s = { ...hecha, id: antes.id, creada: antes.creada, v: (antes.v || 1) + 1, actualizada: ahora() };
      const h = hashEscaleta(s); if (h !== antes.hash) s.escaleta_v = (antes.escaleta_v || 1) + 1; s.hash = h;
      d.series[i] = s; escribir(); return copia(s);
    },
    /** El cupo diario que usan las series (en unidades del Estudio): se reinicia solo al cambiar el día. */
    usoDe: day => { const u = cargar().uso; return u.day === day ? u.peso : 0; },
    sumarUso(day, peso) { const d = cargar(); if (d.uso.day !== day) d.uso = { day, peso: 0 }; d.uso.peso = Math.max(0, d.uso.peso + peso); escribir(); return d.uso.peso; },
  };
}

/** Lo que se enseña de una serie: nunca el token ni lo que autoriza (solo si está autorizada), nunca el libro entero. */
export function vistaSerie(s) {
  if (!s) return null;
  const { token_reg, autorizado, libro, pasos, intentos, fallos, ...resto } = s; // eslint-disable-line no-unused-vars
  const planos = s.escaleta || [], cuenta = e => planos.filter(p => p.estado === e).length;
  const r = libro ? resumenLibro(libro) : null, mostrado = s.costo_mostrado_usd ?? null;
  return { ...resto, etiqueta: ETIQUETA[s.estado] || s.estado, autorizada: !!autorizado && (s.estado === 'muestra' || s.estado === 'corriendo'),
    progreso: { total: planos.length, listos: cuenta('listo'), revisar: cuenta('revisar'), previstos: cuenta('previsto'), corriendo: cuenta('corriendo'), omitidos: cuenta('skipped') },
    gasto: { mostradoUsd: mostrado, topeUsd: s.tope_usd, gastadoUsd: r ? u2usd(r.gastado) : 0, reservadoUsd: r ? u2usd(r.reservado) : 0, inciertoUsd: r ? u2usd(r.incierto) : 0,
      disponibleUsd: r ? u2usd(r.disponible) : s.tope_usd, excedido: r ? r.excedido : false, mayorQueLoMostrado: mostrado != null && r ? r.gastado > usd2u(mostrado) : false },
    pasos_inciertos: Object.entries(pasos || {}).filter(([c]) => libro?.lineas?.[c]?.estado === 'incierto').map(([clave, x]) => ({ clave, n: x.n, intento: x.intento, maxUsd: u2usd(libro.lineas[clave].max) })) };
}
export const resumenSerie = s => {
  const v = vistaSerie(s);
  return { id: v.id, titulo: v.titulo, estado: v.estado, etiqueta: v.etiqueta, progreso: v.progreso, gasto: v.gasto, hash: v.hash, escaleta_v: v.escaleta_v, biblia_version: v.biblia_version,
    creada: v.creada, actualizada: v.actualizada, pausa_motivo: v.pausa_motivo || null };
};

/** Pausar (reduce el gasto: no pide token) y cancelar. Puras sobre una copia: devuelven { ok, serie } o { ok:false, codigo, motivo }. */
export function pausarSerie(s, motivo = 'pausada por el dueño') {
  if (!['muestra', 'corriendo'].includes(s.estado)) return { ok: false, codigo: 'transicion', motivo: `una serie ${s.estado} no está generando: no hay nada que pausar` };
  return { ok: true, serie: { ...s, estado: 'pausado', pausa_motivo: String(motivo).slice(0, 300), autorizado: null, token_reg: null } };
}
export function cancelarSerie(s) {
  if (!(TRANSICIONES[s.estado] || []).includes('cancelado')) return { ok: false, codigo: 'transicion', motivo: `una serie ${s.estado} ya terminó: no se puede cancelar` };
  return { ok: true, serie: { ...s, estado: 'cancelado', pausa_motivo: null, autorizado: null, token_reg: null, cancelada: true } }; // la autorización muere con ella: lo que siga en el aire solo se liquida
}
export { nuevoLibro };
