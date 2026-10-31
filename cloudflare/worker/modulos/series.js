// Series de imágenes (storyboard, carruseles del mes) en la nube — N2/N3: SOLO LECTURA Y PROPUESTA. Nada aquí genera, reserva ni gasta: no hay bomba, no hay token de GENERAR y ninguna ruta llama a un motor.
//   GET  /api/series                    → { series: [resumen], activo }
//   GET  /api/series/<id>               → { serie: vista (lista blanca; el gasto sale del libro SQL) }
//   GET  /api/series/<id>/libro         → { lineas }  las líneas del libro de esa serie (solo lectura; SOLO administradores: lleva dinero)
//   POST /api/series/proponer {brief, planos, guardar?}  → la PROPUESTA (con `guardar: true` se guarda como «prevista»; no gasta)
//   POST /api/series/<id>/tanda {planos}                 → añade 1 a 8 planos a una serie prevista (la escaleta cambia de hash)
// Todo detrás de `dimitri.seriesNube` (APAGADO por defecto): apagado, cada ruta contesta 501 en español. Escribir es SOLO de un administrador (nunca un agente); leer la lista y la serie, de cualquier cuenta PERO sin dinero
// (SEG-04: el rol «lectura» ve resultados, no dinero; el editor tampoco): el gasto, los topes y las líneas del libro son solo de un administrador.
// N4 (30 oct 2026): autorizar y la bomba del reloj, SOLO con motores gratis (`prueba`): AQUÍ SE GASTA, así que cada ruta de gasto es solo de un administrador y pasa por el token de un solo uso con la cifra:
//   POST /api/series/<id>/presupuesto {modo}                      → la cifra y el token (no gasta)
//   POST /api/series/<id>/generar {confirmacion, costoMostradoUsd, modo}  (cabecera Idempotency-Key obligatoria) → autoriza 6 h; la bomba (reloj de cada minuto) da los pasos
//   POST /api/series/<id>/continuar {confirmacion, costoMostradoUsd}      → lo mismo con modo «todo», desde una muestra lista o una pausa
//   POST /api/series/<id>/pausar · /cancelar · /resolver {clave, cobro, realUsd}   (bajan el gasto o son contabilidad)
// Los motores de pago siguen cerrados (N5).
import { json, error, prohibido } from '../lib/respuesta.js';
import { leerCfg } from '../lib/ajustes.js';
import { crearAlmacenD1 } from '../lib/series/almacen.js';
import { seriesNubeActiva } from '../lib/series/flags.js';
import { resumenDeSerie, inciertos, lineas } from '../lib/series/libro.js';
import { proponer, anadirTanda } from '../lib/series/propuesta.js';
import { crearGenerador } from '../lib/series/generar.js';
import { vistaSerie, resumenSerie, sinDinero } from '../../../series-vista-core.mjs';
import { ID_SERIE_OK } from '../../../series-bomba-core.mjs';

export const nombre = 'series';
export const grupos = ['series'];

const APAGADO = 'Las series en la nube están apagadas: un administrador las enciende con dimitri.seriesNube. Mientras, siguen en la oficina de tu computadora.';
const noEsta = (m) => json({ error: m, pendiente: true }, 501);
const quien = (u) => String(u?.nombre || u?.email || 'alguien').slice(0, 80);
const auditar = (db, usuario, accion, detalle) => db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'serie', quien(usuario), JSON.stringify({ accion, ...detalle })).run();

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (ruta !== '/api/series' && !ruta.startsWith('/api/series/')) return null;
  const metodo = req.method, esAdmin = usuario.rol === 'admin' && !usuario.agente;
  const m = ruta.match(/^\/api\/series\/([\w-]{1,60})(?:\/(libro|tanda|presupuesto|generar|continuar|resolver|pausar|cancelar))?$/);
  const proponiendo = ruta === '/api/series/proponer' && metodo === 'POST';
  if (!proponiendo && !m && ruta !== '/api/series') return error('no such route', 404);

  // ---- el libro lleva dinero: solo un administrador (el rol se mira ANTES del interruptor, como lo demás) ----
  if (metodo === 'GET' && m && m[2] === 'libro' && !esAdmin) return prohibido('Las líneas del libro de una serie llevan dinero: son de un administrador.');

  // ---- quien escribe o decide: SOLO un administrador (el rol se comprueba ANTES del interruptor) ----
  if (metodo !== 'GET') {
    if (!esAdmin) return prohibido('Proponer o cambiar una serie es de un administrador (no de un agente ni de un editor).');
    if (metodo !== 'POST') return error('Método no permitido.', 405);
  }
  if (!seriesNubeActiva(await leerCfg(db))) return noEsta(APAGADO);
  const almacen = crearAlmacenD1(db);

  if (metodo === 'GET') {
    if (ruta === '/api/series') return json({ series: (await almacen.todas()).map((s) => (esAdmin ? resumenSerie(s) : sinDinero(resumenSerie(s)))), activo: true });
    if (!m || (m[2] && m[2] !== 'libro')) return error('no such route', 404);
    if (m[1] === 'proponer') return error('no such route', 404);
    const s = await almacen.uno(m[1]);
    if (!s) return error('No encuentro esa serie.', 404);
    if (m[2] === 'libro') return json({ serie: s.id, lineas: await lineas(db, s.id) });
    const v = vistaSerie(s, { libro: await resumenDeSerie(db, s.id), inciertos: await inciertos(db, s.id) });
    return json({ serie: esAdmin ? v : sinDinero(v) }); // quien no es administrador sabe QUÉ pasos están en duda, no cuánto
  }

  // ---- autorizar, pausar, cancelar, decidir un paso en duda: el generador (N4) ----
  const ACCIONES = ['presupuesto', 'generar', 'continuar', 'resolver', 'pausar', 'cancelar'];
  if (m && ACCIONES.includes(m[2]) && ID_SERIE_OK.test(m[1])) {
    try {
      const g = crearGenerador(env, db), b = (await ctx.cuerpo(req, 16 * 1024)) || {}, id = m[1];
      let r;
      if (m[2] === 'presupuesto') r = await g.presupuesto({ id, modo: b.modo === 'todo' ? 'todo' : 'muestra', usuario });
      else if (m[2] === 'generar' || m[2] === 'continuar') r = await g.generar({ id, confirmacion: b.confirmacion, costoMostradoUsd: b.costoMostradoUsd, modo: m[2] === 'continuar' ? 'todo' : (b.modo === 'todo' ? 'todo' : 'muestra'), usuario, idem: req.headers.get('idempotency-key'), soloDesde: m[2] === 'continuar' ? ['muestra', 'pausado'] : null });
      else if (m[2] === 'pausar') r = await g.pausar({ id, usuario });
      else if (m[2] === 'cancelar') r = await g.cancelar({ id, usuario });
      else r = await g.resolver({ id, clave: b.clave, cobro: b.cobro, realUsd: b.realUsd, usuario });
      return json(r.cuerpo, r.estado);
    } catch (e) {
      if (Number.isInteger(e?.status)) return error(e.message, e.status);
      if (/demasiadas veces|demasiado grande/.test(String(e?.message))) return error(e.message, 409);
      throw e;
    }
  }

  // ---- escribir (solo propuesta): nada gasta ----
  try {
    if (proponiendo) {
      const b = (await ctx.cuerpo(req, 128 * 1024)) || {};
      const r = await proponer(env, db, { brief: b.brief, planos: b.planos, guardar: b.guardar === true }, { almacen });
      if (r.estado === 200 && r.cuerpo.guardada) await auditar(db, usuario, 'guardar', { serie: r.cuerpo.guardada.id, hash: r.cuerpo.guardada.hash });
      return json(r.cuerpo, r.estado);
    }
    if (m && m[2] === 'tanda' && ID_SERIE_OK.test(m[1])) {
      const b = (await ctx.cuerpo(req, 64 * 1024)) || {};
      const r = await anadirTanda(env, db, m[1], { planos: b.planos }, { almacen });
      if (r.estado === 200) await auditar(db, usuario, 'tanda', { serie: m[1], hash: r.cuerpo.hash, agregados: r.cuerpo.agregados });
      return json(r.cuerpo, r.estado);
    }
  } catch (e) {
    if (Number.isInteger(e?.status)) return error(e.message, e.status);
    if (/demasiad|serie es demasiado grande/.test(String(e?.message))) return error(e.message, 409);
    throw e;
  }
  return error('no such route', 404);
}

/** El reloj de cada minuto: reconcilia lo que quedó en el aire y da UN paso (candado global). Sin series vivas ni planos en el aire no toca nada más que una consulta. */
export async function cadaMinuto(env) {
  const db = env.DB;
  let vivas = 0;
  try { vivas = (await db.prepare(`select count(*) n from series where estado in ('muestra','corriendo') or exists (select 1 from json_each(series.json, '$.escaleta') where json_extract(value, '$.estado') = 'corriendo')`).first()).n; }
  catch (e) { if (/no such table/i.test(String(e?.message))) return; throw e; }
  if (!vivas) return;
  await crearGenerador(env, db).tick();
}
