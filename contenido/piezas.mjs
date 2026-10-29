// Agents Office V4.7 (30 sep 2026) — las PIEZAS de contenido: lo que se quiere publicar, un día y una hora, en unas redes.
// Una pieza es una nota de texto (`<cerebro>/Agents Office/contenido/AAAA-MM/<id>.md`): una cabecera con lo que es (día, hora, formato,
// redes, estado, medios del Estudio) y el cuerpo con lo que se publica (el texto, el primer comentario, los hashtags). Se lee y se corrige
// a mano, la ven los agentes y el Cerebro, y NO viaja por GitHub: es la carpeta de las entregas, que el .gitignore ya excluye
// (el repositorio puede ser público y un texto sin publicar trae precios y lanzamientos).
//
// Aquí solo vive lo que se decide ANTES de publicar. Qué pasó al entregarla a Meta (ids, intentos, fallos) es de la cola (F3);
// las dos cosas se unen al pintar, igual que en Juancito Ads: el estado de la agenda no es la verdad de lo publicado.
//
//   parsear(md) · serializar(pieza) · huella(pieza) · normalizar(datos, previa)    → puros, con tests
//   crearAlmacen({ dir, medioExiste, medida, ahora })                               → { listar, leer, crear, guardar, aprobar, devolver, borrar, usos }
// (1 oct 2026) Cada pieza que sale de aquí lleva `medidas` ({ id: { ancho, alto, duracion } }, del registro .json de cada archivo del Estudio):
// sin ellas las reglas de proporción y de duración no se disparaban nunca. Y aprobar exige hora y un momento que venga (revisarMomento).
// Cubierto por tests/contenido-piezas.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { revisarPublicacion, postDePieza, medidaDeItem, revisarMomento } from '../src/contenido-reglas.js';
import { renombrar } from '../fs-seguro.mjs'; // 9 oct 2026: renombrar con reintento (Windows: EPERM/EBUSY al pisar un archivo abierto)
import { limpiarCuentas, cuentasLimpias, cuentasDeRedes } from '../src/contenido-cuentas.js'; // 9 oct 2026: la cuenta de cada red (qué página, qué Instagram)
// Salió el núcleo puro a piezas-core.mjs (lo usa también el Worker de Cloudflare); aquí se re-exporta igual que siempre.
import { ESTADOS, FORMATOS, REDES, NOMBRE_RED, parsear, serializar, huella, normalizar, ID_RE, FECHA_RE, SIN_FECHA, mesDe, PRONTO_MIN, ahoraMas, ahoraAbajo, nuevoId as nuevoIdCore } from './piezas-core.mjs';
export { ESTADOS, FORMATOS, REDES, NOMBRE_RED, parsear, serializar, huella, normalizar, PRONTO_MIN, ahoraMas };

/* ---------- el almacén: los archivos ---------- */
const MEDIO_RE = /^\d{4}-\d{2}\/[^/\\]+\.(png|jpe?g|webp|svg|mp4|webm)$/i;
/** Las medidas de un archivo del Estudio, leídas de su registro (`<cerebro>/Agents Office/media/AAAA-MM/<nombre>.json`, junto a esta carpeta). */
export const medidaDelEstudio = mediaDir => id => {
  const rel = String(id ?? '').replace(/\\/g, '/'); if (!MEDIO_RE.test(rel) || rel.includes('..')) return null;
  try { return medidaDeItem(JSON.parse(fs.readFileSync(path.join(mediaDir, rel.replace(/\.[^.]+$/, '.json')), 'utf8'))); } catch { return null; }
};
/** El día con que está guardada la nota (por su carpeta): si «Publicar ya» la cambia de mes, se mueve. */
const previaFecha = f => { const c = path.basename(path.dirname(f)); return c === SIN_FECHA ? '' : `${c}-01`; };
const nuevoId = (fecha, ahora) => nuevoIdCore(fecha, ahora, () => crypto.randomBytes(2).toString('hex'));

/**
 * `dir` es la carpeta de las piezas; `medioExiste(id)` dice si un archivo es del Estudio (así una pieza no apunta a algo que no está);
 * `ahora()` el momento actual (para probar). Todo lo que se escribe va a un temporal y se renombra: nunca una nota a medias.
 */
export function crearAlmacen({ dir, medioExiste = () => true, medida, ahora = Date.now, cuentasPorDefecto = () => ({}), validarCuenta = () => '' } = {}) {
  // 9 oct 2026: `cuentasPorDefecto()` → { facebook, instagram } (la página de Ajustes y su Instagram): una pieza nueva nace con la suya, así se ve
  // dónde sale aunque nadie elija. `validarCuenta(id)` → '' o por qué no vale (el token no la ve, un Instagram sin página): solo lo que llega.
  const cuentaMala = d => { for (const id of Object.values(cuentasLimpias(d?.cuentas))) { const m = validarCuenta(id); if (m) return m; } return ''; };
  const medidaDe = medida || medidaDelEstudio(path.join(dir || '.', '..', 'media'));
  const medidas = p => { const out = {}; for (const m of [...p.medios, ...p.historias]) { const x = medidaDe(m); if (x) out[m] = x; } return out; };
  const ruta = (id, fecha) => path.join(dir, mesDe(fecha), `${id}.md`);
  const escribir = (p, viejaFecha) => {
    const f = ruta(p.id, p.fecha); fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + '.tmp'; fs.writeFileSync(tmp, serializar(p)); renombrar(tmp, f);
    if (viejaFecha !== undefined && mesDe(viejaFecha) !== mesDe(p.fecha)) fs.rmSync(ruta(p.id, viejaFecha), { force: true }); // cambió de mes: se mueve, no se duplica
  };
  const carpetas = () => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => /^\d{4}-\d{2}$/.test(x) || x === SIN_FECHA).sort() : []);
  const deArchivo = f => { try { return parsear(fs.readFileSync(f, 'utf8'), { file: f }); } catch { return null; } };
  const buscar = id => { if (!ID_RE.test(String(id))) return null; for (const c of carpetas()) { const f = path.join(dir, c, `${id}.md`); if (fs.existsSync(f)) return f; } return null; };
  const todas = meses => { const out = []; for (const c of carpetas()) { if (meses && !meses.has(c)) continue; for (const f of fs.readdirSync(path.join(dir, c)).filter(x => x.endsWith('.md'))) { const p = deArchivo(path.join(dir, c, f)); if (p) out.push(p); } } return out; };
  const conEstado = p => ({ ...p, medidas: medidas(p), cambiadaTrasAprobar: p.estado === 'aprobada' && !!p.aprobada && p.aprobada.huella !== huella(p) });
  const revisar = p => revisarPublicacion(postDePieza({ ...p, medidas: p.medidas || medidas(p) }), p.redes);
  const medios = p => { for (const m of [...p.medios, ...p.historias]) if (!medioExiste(m)) return `el Estudio no tiene «${m}»`; return null; };

  return {
    dir, revisar,
    /** Las piezas de un rango de días (o todas), más las que no tienen día si se piden. Ordenadas por día y hora. */
    listar({ desde = '', hasta = '', sinFecha = false, estado, formato, red, q = '' } = {}) {
      let meses = null;
      if (FECHA_RE.test(desde) && FECHA_RE.test(hasta)) { // solo se abren las carpetas de los meses que toca el rango
        meses = new Set(); const fin = new Date(hasta + 'T00:00:00'); const d = new Date(desde + 'T00:00:00'); d.setDate(1);
        for (; d <= fin; d.setMonth(d.getMonth() + 1)) meses.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        if (sinFecha) meses.add(SIN_FECHA);
      }
      const needle = String(q).toLowerCase().trim();
      return todas(meses).filter(p => (p.fecha ? (!desde || p.fecha >= desde) && (!hasta || p.fecha <= hasta) : (sinFecha || (!desde && !hasta)))
        && (!estado || p.estado === estado) && (!formato || p.formato === formato) && (!red || p.redes.includes(red))
        && (!needle || `${p.titulo} ${p.texto} ${p.hashtags} ${p.notas}`.toLowerCase().includes(needle)))
        .map(conEstado).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (a.hora || '99').localeCompare(b.hora || '99') || a.creada.localeCompare(b.creada));
    },
    leer(id) { const f = buscar(id); const p = f && deArchivo(f); return p ? conEstado(p) : null; },
    crear(datos = {}, { por = 'dueno' } = {}) {
      const r = normalizar(datos); if (r.error) return { error: r.error };
      const p = r.pieza; const mal = medios(p); if (mal) return { error: mal };
      if (p.estado === 'aprobada') return { error: 'una pieza no nace aprobada: apruébala después, con «Aprobar»' };
      const cm = cuentaMala(datos); if (cm) return { error: cm };
      if (!Object.prototype.hasOwnProperty.call(datos, 'cuentas')) { const d0 = cuentasLimpias(cuentasPorDefecto() || {}); p.cuentas = Object.fromEntries(Object.entries(d0).filter(([r]) => p.redes.includes(r))); }
      p.id = nuevoId(p.fecha, ahora); p.creada = p.actualizada = new Date(ahora()).toISOString(); if (!datos.origen) p.origen = por;
      escribir(p); return { pieza: conEstado(p) };
    },
    /** Cambia lo que venga. Si estaba aprobada y cambia algo de lo que sale, deja de estarlo: el OK era de otro texto. */
    guardar(id, datos = {}) {
      const f = buscar(id), previa = f && deArchivo(f); if (!previa) return { error: 'esa pieza ya no existe', nada: true };
      if ('estado' in datos && datos.estado === 'aprobada' && previa.estado !== 'aprobada') return { error: 'para aprobar una pieza usa «Aprobar»: revisa antes que pueda salir' };
      const r = normalizar(datos, previa); if (r.error) return { error: r.error };
      const p = r.pieza; const mal = medios(p); if (mal) return { error: mal };
      const cm = cuentaMala(datos); if (cm) return { error: cm };
      p.id = previa.id; p.creada = previa.creada; p.actualizada = new Date(ahora()).toISOString();
      let soltada = false;
      if (previa.estado === 'aprobada' && p.estado === 'aprobada' && huella(p) !== (previa.aprobada?.huella ?? '')) { p.estado = 'revision'; p.aprobada = null; soltada = true; }
      if (p.estado !== 'aprobada') p.aprobada = null;
      escribir(p, previa.fecha); return { pieza: conEstado(p), soltada };
    },
    /** El OK del dueño: solo si puede salir (sin errores de las reglas de cada red), tiene día y hora, y ese momento todavía no pasó. */
    aprobar(id, { por = 'dueno', pronto = false, ya = false } = {}) {
      const f = buscar(id), p = f && deArchivo(f); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      if (ya) { const t = ahoraAbajo(ahora()); p.fecha = t.fecha; p.hora = t.hora; } // CON-04: «Publicar ahora» — el minuto en curso; solo lo pide la ruta publicar-ya
      else if (pronto) { const t = ahoraMas(ahora(), PRONTO_MIN); p.fecha = t.fecha; p.hora = t.hora; } // C1: aprobar «para ya» por el camino antiguo (PRONTO_MIN minutos)
      if (!p.fecha) return { error: 'ponle un día antes de aprobarla', errores: ['Sin día'] };
      const cuando = revisarMomento(p.fecha, p.hora, ahora(), ya ? { ya: true } : pronto ? { minMin: PRONTO_MIN - 1 } : undefined); if (cuando.errores.length) return { error: cuando.errores[0].replace(/^./, c => c.toLowerCase()), errores: cuando.errores };
      const { errores, avisos } = revisar(p); if (errores.length) return { error: 'todavía no puede salir: ' + errores[0], errores, avisos: [...avisos, ...cuando.avisos] };
      const mal = medios(p); if (mal) return { error: mal };
      p.estado = 'aprobada'; p.aprobada = { cuando: new Date(ahora()).toISOString(), huella: huella(p), por, ...(ya ? { ya: true } : {}) }; p.actualizada = p.aprobada.cuando; // `ya` solo vive aquí: lo lee la cola, nunca la petición
      escribir(p, f && previaFecha(f)); return { pieza: conEstado(p), avisos: [...avisos, ...cuando.avisos] };
    },
    /** Devolver una pieza a revisión (o a borrador): quita el OK. */
    devolver(id, estado = 'revision') {
      const f = buscar(id), p = f && deArchivo(f); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      p.estado = ['idea', 'borrador', 'revision'].includes(estado) ? estado : 'revision'; p.aprobada = null; p.actualizada = new Date(ahora()).toISOString();
      escribir(p); return { pieza: conEstado(p) };
    },
    /** M1: apunta (o borra, con null) en la nota lo entregado al conductor. No toca nada más ni la fecha de cambio: no es una edición. */
    marcarEntregada(id, valor) {
      const f = buscar(id), p = f && deArchivo(f); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      p.entregada = valor ? { conductor: String(valor.conductor || ''), huella: String(valor.huella || ''), cuando: String(valor.cuando || ''), remoto: valor.remoto || {} } : null;
      escribir(p); return { ok: true };
    },
    /** A la papelera de las piezas (`.papelera/`, junto a ellas): nada se pierde sin querer. */
    borrar(id) {
      const f = buscar(id); if (!f) return { error: 'esa pieza ya no existe', nada: true };
      const bin = path.join(dir, '.papelera'); fs.mkdirSync(bin, { recursive: true });
      renombrar(f, path.join(bin, `${ahora()}-${path.basename(f)}`)); return { ok: true };
    },
    /** Las piezas que usan un archivo del Estudio (para no dejar que la papelera se lo lleve). */
    usos(medio) { return todas().filter(p => p.medios.includes(medio) || p.historias.includes(medio)).map(p => ({ id: p.id, titulo: p.titulo, fecha: p.fecha })); },
  };
}
