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
  let D = null, bloqueo = null; // bloqueo: no se pudo apartar un archivo roto; NO se escribe encima (falla cerrado)
  const plano = o => !!o && typeof o === 'object' && !Array.isArray(o), valida = s => plano(s) && typeof s.id === 'string' && ID_OK.test(s.id) && Array.isArray(s.escaleta) && s.escaleta.every(plano) && typeof s.estado === 'string';
  const normalizar = s => ({ ...s, intentos: plano(s.intentos) ? s.intentos : {}, pasos: plano(s.pasos) ? s.pasos : {}, fallos: plano(s.fallos) ? s.fallos : {}, libro: plano(s.libro) && plano(s.libro.lineas) ? s.libro : null,
    escaleta: s.escaleta.map(p => ({ ...p, versiones: Array.isArray(p.versiones) ? p.versiones : [], refs: Array.isArray(p.refs) ? p.refs : [] })) }); // una serie malformada no puede hacer lanzar a la bomba en cada tick
  const apartar = motivo => { try { fs.copyFileSync(archivo, `${archivo}.roto-${ahora()}`); } catch (e) { bloqueo = `${motivo}, y no se pudo apartar una copia (${e.code || e.message}): no se escribe encima de ${path.basename(archivo)}`; console.warn('series:', bloqueo); } };
  const cargar = () => {
    if (D) return D;
    let txt = null; try { txt = fs.readFileSync(archivo, 'utf8'); } catch { /* aún no existe */ }
    if (txt != null) {
      try {
        const j = JSON.parse(txt); if (!j || typeof j !== 'object' || !Array.isArray(j.series)) throw new Error('forma');
        const buenas = j.series.filter(valida); if (buenas.length !== j.series.length) apartar('el archivo de series traía elementos que no son series');
        const u = j.uso && typeof j.uso === 'object' && typeof j.uso.day === 'string' && Number.isFinite(j.uso.peso) ? { day: j.uso.day, peso: j.uso.peso } : { day: '', peso: 0 };
        D = { v: 1, uso: u, series: buenas.map(normalizar) };
      } catch { apartar('el archivo de series está roto'); D = null; }
    }
    return (D ||= { v: 1, uso: { day: '', peso: 0 }, series: [] });
  };
  /** Escribe `cand` (nada se asigna hasta que el disco lo tiene): si falla, la memoria sigue igual que el disco y el error se propaga. */
  const escribir = cand => {
    if (bloqueo) throw new Error(bloqueo);
    let series = cand.series;
    if (series.length > MAX_SERIES) { // se podan las terminadas más viejas; una viva nunca
      const viejas = series.filter(s => TERMINAL.has(s.estado)).sort((a, b) => (a.actualizada || 0) - (b.actualizada || 0)).slice(0, series.length - MAX_SERIES).map(s => s.id);
      series = series.filter(s => !viejas.includes(s.id));
    }
    const out = { ...cand, series }, tmp = archivo + '.tmp';
    fs.mkdirSync(path.dirname(archivo), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify(out)); renombrar(tmp, archivo);
    D = out;
  };
  const copia = s => (s ? structuredClone(s) : null);
  return {
    todas: () => cargar().series.map(copia),
    estadoDe: id => cargar().series.find(s => s.id === id)?.estado || null,
    uno: id => copia(cargar().series.find(s => s.id === id)),
    /** Guarda una serie NUEVA (la de armarPropuesta). Nunca pisa otra con el mismo id. */
    crear(serie, extra = {}) {
      const d = cargar(); let id = String(serie?.id || '');
      if (!ID_OK.test(id) || d.series.some(s => s.id === id)) id = `${ID_OK.test(id) ? id : 'serie'}-${azar()}`.slice(0, 60);
      const t = ahora(), s = { ...structuredClone(serie), id, estado: 'previsto', creada: t, actualizada: t, v: 1, escaleta_v: 1, intentos: {}, fallos: {}, pasos: {}, libro: null, autorizado: null, token_reg: null, ...extra };
      s.hash = hashEscaleta(s); escribir({ ...d, series: [...d.series, s] }); return copia(s);
    },
    /** Cambia una serie con una función SÍNCRONA (leer-modificar-escribir sin await entre medias: en un solo proceso es una comparación-e-intercambio). `fn(copia)` devuelve la copia
     *  cambiada o lanza; si devuelve `undefined` no se escribe nada. Sube `v`, y `escaleta_v` si la escaleta cambió. Si el disco falla, nada cambia en memoria y el error sale. */
    actualizar(id, fn) {
      const d = cargar(), i = d.series.findIndex(s => s.id === id); if (i < 0) return null;
      const antes = d.series[i], hecha = fn(structuredClone(antes)); if (hecha === undefined) return copia(antes);
      const s = { ...hecha, id: antes.id, creada: antes.creada, v: (antes.v || 1) + 1, actualizada: ahora() };
      const h = hashEscaleta(s); if (h !== antes.hash) s.escaleta_v = (antes.escaleta_v || 1) + 1; s.hash = h;
      const series = d.series.slice(); series[i] = s; escribir({ ...d, series }); return copia(s);
    },
    /** El cupo diario que usan las series (en unidades del Estudio): se reinicia solo al cambiar el día. */
    usoDe: day => { const u = cargar().uso; return u.day === day ? u.peso : 0; },
    sumarUso(day, peso) { const d = cargar(), base = d.uso.day === day ? d.uso.peso : 0, uso = { day, peso: Math.max(0, base + peso) }; escribir({ ...d, uso }); return uso.peso; },
  };
}

/** Lo que se enseña de una serie: LISTA BLANCA. Nunca el token ni lo que autoriza, ni el libro, ni el brief (objetivo, restricciones), ni los prompts completos ni los precios. */
const corto = (v, n) => (v == null ? null : String(v).slice(0, n));
const planoVista = p => ({ n: p.n, rol: p.rol, estado: p.estado, descripcion: corto(p.descripcion, 120), motivo: corto(p.motivo, 160), modelo: p.modelo || null, version: p.version || 0, clave: !!p.clave,
  versiones: (p.versiones || []).map(v => ({ v: v.v, intento: v.intento, costo_usd: v.costo_usd ?? 0 })) }); // sin `archivo`: su nombre lleva el prompt
export function vistaSerie(s) {
  if (!s) return null;
  const planos = s.escaleta || [], cuenta = e => planos.filter(p => p.estado === e).length;
  const r = s.libro ? resumenLibro(s.libro) : null, mostrado = s.costo_mostrado_usd ?? null;
  return { id: s.id, titulo: corto(s.titulo, 100), formato: corto(s.brief?.formato, 40), estado: s.estado, etiqueta: ETIQUETA[s.estado] || s.estado, creada: s.creada, actualizada: s.actualizada, v: s.v, hash: s.hash, escaleta_v: s.escaleta_v,
    biblia_version: s.biblia_version ?? null, modo: s.autorizado?.modo || null, tope_usd: s.tope_usd, pausa_motivo: corto(s.pausa_motivo, 300), muestra_lista: !!s.muestra_lista, cancelada: !!s.cancelada, fin: s.fin || null,
    autorizada: !!s.autorizado && (s.estado === 'muestra' || s.estado === 'corriendo'),
    progreso: { total: planos.length, listos: cuenta('listo'), revisar: cuenta('revisar'), previstos: cuenta('previsto'), corriendo: cuenta('corriendo'), omitidos: cuenta('skipped') },
    gasto: { mostradoUsd: mostrado, topeUsd: s.tope_usd, gastadoUsd: r ? u2usd(r.gastado) : 0, reservadoUsd: r ? u2usd(r.reservado) : 0, inciertoUsd: r ? u2usd(r.incierto) : 0,
      disponibleUsd: r ? u2usd(r.disponible) : s.tope_usd, excedido: r ? r.excedido : false, mayorQueLoMostrado: mostrado != null && r ? r.gastado > usd2u(mostrado) : false },
    escaleta: planos.map(planoVista),
    pasos_inciertos: Object.entries(s.pasos || {}).filter(([c]) => s.libro?.lineas?.[c]?.estado === 'incierto').map(([clave, x]) => ({ clave, n: x.n, intento: x.intento, maxUsd: u2usd(s.libro.lineas[clave].max) })) };
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

/** Defensa en profundidad para las rutas que gastan o liberan dinero (generar, resolver, pausar, cancelar), además de `by`/`agent` del cuerpo (que decide quien llama):
 *  el Host debe ser localhost, 127.0.0.1 o [::1] (anti DNS-rebinding) y el Origin, si viene, el MISMO origen (anti-CSRF desde una página de fuera). Pura. */
export function origenPermitido({ host, origin } = {}) {
  const h = String(host || '').toLowerCase(), m = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.exec(h);
  if (!m) return { ok: false, motivo: 'esta acción solo se hace desde la propia computadora (localhost)' };
  if (origin == null || origin === '') return { ok: true };
  let o; try { o = new URL(String(origin)); } catch { return { ok: false, motivo: 'Origin no válido' }; }
  return o.host.toLowerCase() === h && (o.protocol === 'http:' || o.protocol === 'https:') ? { ok: true } : { ok: false, motivo: 'la petición viene de otro origen' };
}

/** Candado simple de la bomba (no del almacén): un solo proceso por data/ da pasos de gasto. `tener()` lo adquiere o lo renueva; falla si otro proceso VIVO lo tiene (latido reciente).
 *  Dos procesos sobre el mismo data/ siguen sin ser un caso soportado para escribir series (el almacén no se coordina entre procesos): esto solo evita que los dos GASTEN. */
export function crearCandado({ archivo, pid = process.pid, ahora = () => Date.now(), vivo = p => { try { process.kill(p, 0); return true; } catch (e) { return e.code === 'EPERM'; } }, vidaMs = 30000 } = {}) {
  let mio = false;
  const leer = () => { try { const j = JSON.parse(fs.readFileSync(archivo, 'utf8')); return j && Number.isInteger(j.pid) && Number.isFinite(j.t) ? j : null; } catch { return null; } };
  const escribir = () => { try { fs.mkdirSync(path.dirname(archivo), { recursive: true }); fs.writeFileSync(archivo, JSON.stringify({ pid, t: ahora() })); return true; } catch { return false; } };
  return {
    tener() {
      const c = leer();
      if (c && c.pid !== pid && ahora() - c.t < vidaMs && vivo(c.pid)) { mio = false; return false; }
      mio = escribir(); return mio;
    },
    liberar() { const c = leer(); if (mio && c?.pid === pid) { try { fs.unlinkSync(archivo); } catch { /* ya */ } } mio = false; },
  };
}
