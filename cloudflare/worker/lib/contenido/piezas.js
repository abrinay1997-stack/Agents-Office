// El almacén de piezas de Contenido en D1: la misma interfaz que contenido/piezas.mjs → crearAlmacen (listar, leer, crear, guardar, aprobar, devolver,
// marcarEntregada, borrar, usos), pero asíncrona y contra la tabla `contenido_piezas` en vez de notas .md. TODA la regla (normalizar lo que llega,
// la huella de lo aprobado, qué se puede aprobar, «Publicar ya») es la de la oficina local: se importa de contenido/piezas-core.mjs y de src/contenido-reglas.js.
// Una diferencia a propósito: borrar manda la pieza a la papelera (`borrada = 1`) y ahí se queda 30 días (`purgarPapelera`), como `.papelera/` en la oficina local.
import { revisarPublicacion, postDePieza, medidaDeItem, revisarMomento } from '../../../../src/contenido-reglas.js';
import { cuentasLimpias } from '../../../../src/contenido-cuentas.js';
import { huella, normalizar, ID_RE, FECHA_RE, PRONTO_MIN, ahoraMas, ahoraAbajo, nuevoId } from '../../../../contenido/piezas-core.mjs';

const MEDIO_RE = /^\d{4}-\d{2}\/[^/\\]+\.(png|jpe?g|webp|svg|mp4|webm)$/i;
export const DIAS_PAPELERA = 30;
const hex4 = () => [...crypto.getRandomValues(new Uint8Array(2))].map(x => x.toString(16).padStart(2, '0')).join('');

/** Las medidas de un archivo del Estudio, de su registro (`<id sin extensión>.json` junto al archivo en R2, como en la carpeta local). */
export const medidaDeR2 = bucket => async id => {
  const rel = String(id ?? '').replace(/\\/g, '/'); if (!bucket || !MEDIO_RE.test(rel) || rel.includes('..')) return null;
  try { const o = await bucket.get(rel.replace(/\.[^.]+$/, '.json')); return o ? medidaDeItem(JSON.parse(await o.text())) : null; } catch { return null; }
};
/** ¿El Estudio tiene ese archivo? (la clave de R2 es el id, como en la galería local). Sin R2 (pruebas) se acepta. */
export const medioExisteEnR2 = bucket => async id => {
  const rel = String(id ?? '').replace(/\\/g, '/'); if (!bucket) return true;
  if (!rel || rel.includes('..') || rel.startsWith('/') || rel.length > 300) return false;
  try { return !!(await bucket.head(rel)); } catch { return false; }
};

export function crearAlmacenD1({ db, medioExiste = async () => true, medida = async () => null, ahora = Date.now, cuentasPorDefecto = () => ({}), validarCuenta = () => '' } = {}) {
  const cuentaMala = d => { for (const id of Object.values(cuentasLimpias(d?.cuentas))) { const m = validarCuenta(id); if (m) return m; } return ''; };
  // Las medidas de cada archivo (ancho, alto, duración) se leen del registro del Estudio UNA vez, al escribir la pieza, y se guardan con ella: así listar el
  // calendario no hace una lectura de R2 por archivo (un Worker tiene un tope de llamadas por petición). Un archivo del Estudio no cambia de medidas.
  const medidas = async p => { const out = {}; for (const m of [...p.medios, ...p.historias]) { const x = p.medidas?.[m] || await medida(m); if (x) out[m] = x; } return out; };
  const conMedidas = async p => { p.medidas = await medidas(p); return p; };
  const deFila = f => { if (!f) return null; try { const p = JSON.parse(f.json); p.id = f.id; return p; } catch { return null; } };
  const guardarFila = async (p, { nueva = false } = {}) => {
    const t = new Date(ahora()).toISOString(), json = JSON.stringify(p);
    if (nueva) await db.prepare('insert into contenido_piezas (id, fecha, hora, estado, json, borrada, creada, actualizada) values (?,?,?,?,?,0,?,?)').bind(p.id, p.fecha || '', p.hora || '', p.estado, json, p.creada || t, p.actualizada || t).run();
    else await db.prepare('update contenido_piezas set fecha=?, hora=?, estado=?, json=?, actualizada=? where id=?').bind(p.fecha || '', p.hora || '', p.estado, json, p.actualizada || t, p.id).run();
  };
  const buscar = async id => (ID_RE.test(String(id)) ? deFila(await db.prepare('select id, json from contenido_piezas where id = ? and borrada = 0').bind(id).first()) : null);
  const conEstado = async p => ({ ...p, medidas: p.medidas || {}, cambiadaTrasAprobar: p.estado === 'aprobada' && !!p.aprobada && p.aprobada.huella !== huella(p) });
  const revisar = async p => revisarPublicacion(postDePieza({ ...p, medidas: await medidas(p) }), p.redes);
  const mediosMalos = async p => { for (const m of [...p.medios, ...p.historias]) if (!(await medioExiste(m))) return `el Estudio no tiene «${m}»`; return null; };

  return {
    revisar,
    /** Las piezas de un rango de días (o todas), más las que no tienen día si se piden. Ordenadas por día y hora. */
    async listar({ desde = '', hasta = '', sinFecha = false, estado, formato, red, q = '' } = {}) {
      // Con UNA cota (el reloj de cada minuto pide `desde` y nada más) también va por el índice de fecha: antes solo lo hacía con las dos y la vuelta de cada minuto leía y desarmaba TODAS las piezas.
      const cotas = [FECHA_RE.test(desde) ? ['fecha >= ?', desde] : null, FECHA_RE.test(hasta) ? ['fecha <= ?', hasta] : null].filter(Boolean);
      let filas;
      if (cotas.length) {
        filas = (await db.prepare(`select id, json from contenido_piezas where borrada = 0 and ((fecha <> '' and ${cotas.map(c => c[0]).join(' and ')})${sinFecha ? " or fecha = ''" : ''})`).bind(...cotas.map(c => c[1])).all()).results;
      } else filas = (await db.prepare('select id, json from contenido_piezas where borrada = 0').all()).results;
      const needle = String(q).toLowerCase().trim();
      const todas = filas.map(deFila).filter(Boolean);
      const buenas = todas.filter(p => (p.fecha ? (!desde || p.fecha >= desde) && (!hasta || p.fecha <= hasta) : (sinFecha || (!desde && !hasta)))
        && (!estado || p.estado === estado) && (!formato || p.formato === formato) && (!red || p.redes.includes(red))
        && (!needle || `${p.titulo} ${p.texto} ${p.hashtags} ${p.notas}`.toLowerCase().includes(needle)));
      const out = []; for (const p of buenas) out.push(await conEstado(p));
      return out.sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999') || (a.hora || '99').localeCompare(b.hora || '99') || a.creada.localeCompare(b.creada));
    },
    async leer(id) { const p = await buscar(id); return p ? conEstado(p) : null; },
    async crear(datos = {}, { por = 'dueno' } = {}) {
      const r = normalizar(datos); if (r.error) return { error: r.error };
      const p = r.pieza; const mal = await mediosMalos(p); if (mal) return { error: mal };
      if (p.estado === 'aprobada') return { error: 'una pieza no nace aprobada: apruébala después, con «Aprobar»' };
      const cm = cuentaMala(datos); if (cm) return { error: cm };
      if (!Object.prototype.hasOwnProperty.call(datos, 'cuentas')) { const d0 = cuentasLimpias(cuentasPorDefecto() || {}); p.cuentas = Object.fromEntries(Object.entries(d0).filter(([r]) => p.redes.includes(r))); }
      p.creada = p.actualizada = new Date(ahora()).toISOString(); if (!datos.origen) p.origen = por;
      await conMedidas(p);
      for (let i = 0; i < 6; i++) { // dos piezas del mismo día con el mismo sufijo: otra suerte
        p.id = nuevoId(p.fecha, ahora, hex4);
        try { await guardarFila(p, { nueva: true }); return { pieza: await conEstado(p) }; }
        catch (e) { if (!/UNIQUE|constraint/i.test(String(e?.message))) throw e; }
      }
      return { error: 'no pude darle un número a la pieza: inténtalo otra vez' };
    },
    /** Cambia lo que venga. Si estaba aprobada y cambia algo de lo que sale, deja de estarlo: el OK era de otro texto. */
    async guardar(id, datos = {}) {
      const previa = await buscar(id); if (!previa) return { error: 'esa pieza ya no existe', nada: true };
      if ('estado' in datos && datos.estado === 'aprobada' && previa.estado !== 'aprobada') return { error: 'para aprobar una pieza usa «Aprobar»: revisa antes que pueda salir' };
      const r = normalizar(datos, previa); if (r.error) return { error: r.error };
      const p = r.pieza; const mal = await mediosMalos(p); if (mal) return { error: mal };
      const cm = cuentaMala(datos); if (cm) return { error: cm };
      p.id = previa.id; p.creada = previa.creada; p.actualizada = new Date(ahora()).toISOString();
      await conMedidas(p);
      let soltada = false;
      if (previa.estado === 'aprobada' && p.estado === 'aprobada' && huella(p) !== (previa.aprobada?.huella ?? '')) { p.estado = 'revision'; p.aprobada = null; soltada = true; }
      if (p.estado !== 'aprobada') p.aprobada = null;
      await guardarFila(p); return { pieza: await conEstado(p), soltada };
    },
    /** El OK del dueño: solo si puede salir (sin errores de las reglas de cada red), tiene día y hora, y ese momento todavía no pasó. */
    async aprobar(id, { por = 'dueno', pronto = false, ya = false } = {}) {
      const p = await buscar(id); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      if (ya) { const t = ahoraAbajo(ahora()); p.fecha = t.fecha; p.hora = t.hora; } // CON-04: «Publicar ahora» — el minuto en curso; solo lo pide la ruta publicar-ya
      else if (pronto) { const t = ahoraMas(ahora(), PRONTO_MIN); p.fecha = t.fecha; p.hora = t.hora; } // C1: aprobar «para ya» por el camino antiguo (PRONTO_MIN minutos)
      if (!p.fecha) return { error: 'ponle un día antes de aprobarla', errores: ['Sin día'] };
      const cuando = revisarMomento(p.fecha, p.hora, ahora(), ya ? { ya: true } : pronto ? { minMin: PRONTO_MIN - 1 } : undefined); if (cuando.errores.length) return { error: cuando.errores[0].replace(/^./, c => c.toLowerCase()), errores: cuando.errores };
      const { errores, avisos } = await revisar(p); if (errores.length) return { error: 'todavía no puede salir: ' + errores[0], errores, avisos: [...avisos, ...cuando.avisos] };
      const mal = await mediosMalos(p); if (mal) return { error: mal };
      await conMedidas(p);
      p.estado = 'aprobada'; p.aprobada = { cuando: new Date(ahora()).toISOString(), huella: huella(p), por, ...(ya ? { ya: true } : {}) }; p.actualizada = p.aprobada.cuando; // `ya` solo vive aquí: lo lee la cola, nunca la petición
      await guardarFila(p); return { pieza: await conEstado(p), avisos: [...avisos, ...cuando.avisos] };
    },
    /** Devolver una pieza a revisión (o a borrador): quita el OK. */
    async devolver(id, estado = 'revision') {
      const p = await buscar(id); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      p.estado = ['idea', 'borrador', 'revision'].includes(estado) ? estado : 'revision'; p.aprobada = null; p.actualizada = new Date(ahora()).toISOString();
      await guardarFila(p); return { pieza: await conEstado(p) };
    },
    /** M1: apunta (o borra, con null) en la pieza lo entregado al conductor. No toca nada más ni la fecha de cambio: no es una edición. */
    async marcarEntregada(id, valor) {
      const p = await buscar(id); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      p.entregada = valor ? { conductor: String(valor.conductor || ''), huella: String(valor.huella || ''), cuando: String(valor.cuando || ''), remoto: valor.remoto || {} } : null;
      await db.prepare('update contenido_piezas set json = ? where id = ?').bind(JSON.stringify(p), p.id).run(); return { ok: true };
    },
    /** A la papelera de las piezas: nada se pierde sin querer (30 días). */
    async borrar(id) {
      const p = await buscar(id); if (!p) return { error: 'esa pieza ya no existe', nada: true };
      await db.prepare('update contenido_piezas set borrada = ? where id = ?').bind(ahora(), p.id).run(); return { ok: true };
    },
    /** Las piezas que usan un archivo del Estudio (para no dejar que la papelera se lo lleve). */
    async usos(medio) { return (await this.listar({})).filter(p => p.medios.includes(medio) || p.historias.includes(medio)).map(p => ({ id: p.id, titulo: p.titulo, fecha: p.fecha })); },
    /** Lo que lleva más de 30 días en la papelera se borra de verdad. */
    async purgarPapelera() { const r = await db.prepare('delete from contenido_piezas where borrada > 0 and borrada < ?').bind(ahora() - DIAS_PAPELERA * 864e5).run(); return r.meta?.changes ?? 0; },
  };
}
