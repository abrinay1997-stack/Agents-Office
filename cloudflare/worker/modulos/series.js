// Series de imágenes (storyboard, carruseles del mes) en la nube — N2/N3: SOLO LECTURA Y PROPUESTA. Nada aquí genera, reserva ni gasta: no hay bomba, no hay token de GENERAR y ninguna ruta llama a un motor.
//   GET  /api/series                    → { series: [resumen], activo }
//   GET  /api/series/<id>               → { serie: vista (lista blanca; el gasto sale del libro SQL) }
//   GET  /api/series/<id>/libro         → { lineas }  las líneas del libro de esa serie (solo lectura)
//   POST /api/series/proponer {brief, planos, guardar?}  → la PROPUESTA (con `guardar: true` se guarda como «prevista»; no gasta)
//   POST /api/series/<id>/tanda {planos}                 → añade 1 a 8 planos a una serie prevista (la escaleta cambia de hash)
// Todo detrás de `dimitri.seriesNube` (APAGADO por defecto): apagado, cada ruta contesta 501 en español. Escribir es SOLO de un administrador (nunca un agente); leer, de cualquier cuenta.
// generar, resolver, pausar y cancelar contestan 501: todavía no existen en la nube (llegan en su propio PR, con revisión doble).
import { json, error, prohibido } from '../lib/respuesta.js';
import { leerCfg } from '../lib/ajustes.js';
import { crearAlmacenD1 } from '../lib/series/almacen.js';
import { seriesNubeActiva } from '../lib/series/flags.js';
import { resumenDeSerie, inciertos, lineas } from '../lib/series/libro.js';
import { proponer, anadirTanda } from '../lib/series/propuesta.js';
import { vistaSerie, resumenSerie } from '../../../series-vista-core.mjs';
import { ID_SERIE_OK } from '../../../series-bomba-core.mjs';

export const nombre = 'series';
export const grupos = ['series'];

const APAGADO = 'Las series en la nube están apagadas: un administrador las enciende con dimitri.seriesNube. Mientras, siguen en la oficina de tu computadora.';
const AUN_NO = 'Generar, decidir un paso en duda, pausar y cancelar una serie todavía no están en la nube: siguen en la oficina de tu computadora.';
const noEsta = (m) => json({ error: m, pendiente: true }, 501);
const quien = (u) => String(u?.nombre || u?.email || 'alguien').slice(0, 80);
const auditar = (db, usuario, accion, detalle) => db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'serie', quien(usuario), JSON.stringify({ accion, ...detalle })).run();

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (ruta !== '/api/series' && !ruta.startsWith('/api/series/')) return null;
  const metodo = req.method, esAdmin = usuario.rol === 'admin' && !usuario.agente;
  const m = ruta.match(/^\/api\/series\/([\w-]{1,60})(?:\/(libro|tanda|generar|resolver|pausar|cancelar))?$/);
  const proponiendo = ruta === '/api/series/proponer' && metodo === 'POST';
  if (!proponiendo && !m && ruta !== '/api/series') return error('no such route', 404);

  // ---- quien escribe o decide: SOLO un administrador (el rol se comprueba ANTES del interruptor) ----
  if (metodo !== 'GET') {
    if (!esAdmin) return prohibido('Proponer o cambiar una serie es de un administrador (no de un agente ni de un editor).');
    if (metodo !== 'POST') return error('Método no permitido.', 405);
    if (m && ['generar', 'resolver', 'pausar', 'cancelar'].includes(m[2])) return noEsta(AUN_NO);
  }
  if (!seriesNubeActiva(await leerCfg(db))) return noEsta(APAGADO);
  const almacen = crearAlmacenD1(db);

  if (metodo === 'GET') {
    if (ruta === '/api/series') return json({ series: (await almacen.todas()).map((s) => resumenSerie(s)), activo: true });
    if (!m || (m[2] && m[2] !== 'libro')) return error('no such route', 404);
    if (m[1] === 'proponer') return error('no such route', 404);
    const s = await almacen.uno(m[1]);
    if (!s) return error('No encuentro esa serie.', 404);
    if (m[2] === 'libro') return json({ serie: s.id, lineas: await lineas(db, s.id) });
    return json({ serie: vistaSerie(s, { libro: await resumenDeSerie(db, s.id), inciertos: await inciertos(db, s.id) }) });
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
