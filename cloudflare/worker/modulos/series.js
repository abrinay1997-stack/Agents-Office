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
//   GET  /api/series/libro/huerfanas · POST /api/series/libro/resolver {clave, cobro, realUsd?, confirmacion?}  (N6: líneas del libro que ninguna serie lleva; solo administrador; el segundo clic trae la cifra)
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
// SEG-04: los motivos de una pausa o de un plano pueden llevar cifras del tope del Estudio o precios; quien no es administrador solo ve que hay un motivo, sin cifras ni palabras de dinero.
// Heurística: el tope del Estudio no es un secreto, el dinero exacto sí. Se enmascara lo que parece una cifra de dinero o de tope (con símbolo, decimales, «tope de 12», «cupo 20 imágenes», «12 imágenes de cupo», «12.5 gastados», «cuesta 4.5»).
// El número de un «plano 2», «intento 3» o «paso 4» NO cuenta (los lookbehind). LÍMITE CONOCIDO: una cifra escrita en palabras («tope de doce», «tope mil») no se detecta.
const SIN_PLANO = String.raw`(?<!\b(?:plano|intento|paso)\s+)(?<!\d)`;
const CON_DINERO = [
  /(?:US\$|USD|\$)\s*\d|\d+(?:[.,]\d+)?\s*(?:US\$|USD|\$|d[óo]lares)|\d+[.,]\d{2,}|d[óo]lares/i,
  new RegExp(String.raw`\b(?:tope|presupuesto|cupo|gastad[oa]s?|disponible|reservad[oa]s?|l[ií]mite)\b[^.;\n]{0,30}?` + SIN_PLANO + String.raw`\d`, 'i'), // palabra de tope y, cerca, un número que no sea de un plano
  new RegExp(SIN_PLANO + String.raw`\d+(?:[.,]\d+)?\s+(?:im[aá]genes\s+)?(?:de\s+)?(?:cupo|presupuesto|tope|gastad[oa]s?|reservad[oa]s?)\b`, 'i'), // el número antes de la palabra: «12 de cupo», «12.5 gastados»
  /\bcuest\w*\s+(?:US\$|\$)?\s*\d/i,
];
const CORREO = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g;
export const sinCifras = (t) => { if (typeof t !== 'string') return t; const x = t.replace(CORREO, 'un administrador'); return CON_DINERO.some((r) => r.test(x)) ? 'Pausada por un tope o una revisión: un administrador tiene el detalle.' : x; };
const limpiarMotivos = (v) => (v && typeof v === 'object' ? { ...v, ...('pausa_motivo' in v ? { pausa_motivo: sinCifras(v.pausa_motivo) } : {}), ...(Array.isArray(v.escaleta) ? { escaleta: v.escaleta.map((p) => ({ ...p, motivo: sinCifras(p.motivo) })) } : {}) } : v);
const noEsta = (m) => json({ error: m, pendiente: true }, 501);
const quien = (u) => String(u?.nombre || u?.email || 'alguien').slice(0, 80);
const auditar = (db, usuario, accion, detalle) => db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'serie', quien(usuario), JSON.stringify({ accion, ...detalle })).run();

export async function manejar(ctx) {
  const { req, env, db, ruta, usuario } = ctx;
  if (ruta !== '/api/series' && !ruta.startsWith('/api/series/')) return null;
  const metodo = req.method, esAdmin = usuario.rol === 'admin' && !usuario.agente;
  const m = ruta.match(/^\/api\/series\/([\w-]{1,60})(?:\/(libro|tanda|presupuesto|generar|continuar|resolver|pausar|cancelar|huerfanas))?$/);
  const libroGlobal = m && m[1] === 'libro' && (m[2] === 'huerfanas' || m[2] === 'resolver'); // las líneas del libro SIN serie: /api/series/libro/huerfanas y /resolver
  const proponiendo = ruta === '/api/series/proponer' && metodo === 'POST';
  if (!proponiendo && !m && ruta !== '/api/series') return error('no such route', 404);

  // ---- el libro lleva dinero: solo un administrador (el rol se mira ANTES del interruptor, como lo demás) ----
  if (metodo === 'GET' && m && (m[2] === 'libro' || (libroGlobal && m[2] === 'huerfanas')) && !esAdmin) return prohibido('Las líneas del libro de una serie llevan dinero: son de un administrador.');

  // ---- quien escribe o decide: SOLO un administrador (el rol se comprueba ANTES del interruptor) ----
  if (metodo !== 'GET') {
    if (!esAdmin) return prohibido('Proponer o cambiar una serie es de un administrador (no de un agente ni de un editor).');
    if (metodo !== 'POST') return error('Método no permitido.', 405);
  }
  if (!seriesNubeActiva(await leerCfg(db))) return noEsta(APAGADO);
  const almacen = crearAlmacenD1(db);

  if (metodo === 'GET' && libroGlobal && m[2] === 'huerfanas') { const r = await crearGenerador(env, db).huerfanas({ usuario }); return json(r.cuerpo, r.estado); }
  if (metodo === 'GET') {
    if (ruta === '/api/series') return json({ series: (await almacen.todas()).map((s) => (esAdmin ? resumenSerie(s) : limpiarMotivos(sinDinero(resumenSerie(s))))), activo: true });
    if (!m || (m[2] && m[2] !== 'libro')) return error('no such route', 404);
    if (m[1] === 'proponer') return error('no such route', 404);
    const s = await almacen.uno(m[1]);
    if (!s) return error('No encuentro esa serie.', 404);
    if (m[2] === 'libro') return json({ serie: s.id, lineas: await lineas(db, s.id) });
    const v = vistaSerie(s, { libro: await resumenDeSerie(db, s.id), inciertos: await inciertos(db, s.id) });
    if (esAdmin) v.escaleta = v.escaleta.map((p) => { const raw = s.escaleta.find((q) => q.n === p.n), ult = raw?.versiones?.at?.(-1); return { ...p, intento: ult?.intento ?? null, imagen: typeof ult?.archivo === 'string' && ult.archivo && !/[\x00-\x1f\\?#]|\.\.|^\//.test(ult.archivo) ? ult.archivo.slice(0, 300) : null }; }); // la imagen del último intento: solo para un administrador (su nombre lleva el prompt)
    return json({ serie: esAdmin ? v : limpiarMotivos(sinDinero(v)) }); // quien no es administrador sabe QUÉ pasos están en duda, no cuánto
  }

  // ---- autorizar, pausar, cancelar, decidir un paso en duda: el generador (N4) ----
  if (libroGlobal && m[2] === 'resolver' && metodo === 'POST') {
    try { const b = (await ctx.cuerpo(req, 16 * 1024)) || {}, r = await crearGenerador(env, db).resolverHuerfana({ clave: b.clave, cobro: b.cobro, realUsd: b.realUsd, confirmacion: b.confirmacion, usuario }); return json(r.cuerpo, r.estado); }
    catch (e) { if (Number.isInteger(e?.status)) return error(e.message, e.status); throw e; }
  }
  const ACCIONES = ['presupuesto', 'generar', 'continuar', 'resolver', 'pausar', 'cancelar'];
  if (m && ACCIONES.includes(m[2]) && ID_SERIE_OK.test(m[1])) {
    try {
      const g = crearGenerador(env, db), b = (await ctx.cuerpo(req, 16 * 1024)) || {}, id = m[1];
      let r;
      if (m[2] === 'presupuesto') r = await g.presupuesto({ id, modo: b.modo === 'todo' ? 'todo' : 'muestra', usuario });
      else if (m[2] === 'generar' || m[2] === 'continuar') r = await g.generar({ id, confirmacion: b.confirmacion, costoMostradoUsd: b.costoMostradoUsd, modo: m[2] === 'continuar' ? 'todo' : (b.modo === 'todo' ? 'todo' : 'muestra'), usuario, idem: req.headers.get('idempotency-key'), soloDesde: m[2] === 'continuar' ? ['muestra', 'pausado'] : null });
      else if (m[2] === 'pausar') r = await g.pausar({ id, usuario });
      else if (m[2] === 'cancelar') r = await g.cancelar({ id, usuario });
      else r = await g.resolver({ id, clave: b.clave, cobro: b.cobro, realUsd: b.realUsd, confirmacion: b.confirmacion, usuario });
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
