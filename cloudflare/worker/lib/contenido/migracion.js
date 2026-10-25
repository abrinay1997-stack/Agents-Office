// Adopta lo que subió scripts/migrar/contenido.mjs (por /api/migrar/filas, a la tabla genérica `filas`) en las tablas de Contenido. Es la forma de mudar las piezas, la cola y la
// foto diaria de Analíticas de la computadora del dueño a la nube.
//  · NUNCA pisa lo que la nube ya tiene (insert or ignore): después de mudar, la nube manda, y repetir la migración no deshace lo hecho allá (una pieza que ya se editó aquí no vuelve a
//    como estaba, y una cola/agenda más nueva no se reemplaza por una vieja: eso volvería a publicar lo que ya salió).
//  · Lo que llega se vuelve a limpiar con las mismas reglas que una pieza nueva (normalizar), y los ajustes siempre quedan en «simulacro».
//  · ORDEN: primero las piezas, después la cola y lo demás. Una entrada de la cola sin su pieza se tomaría por «sin OK» y la vuelta del cron la soltaría; por eso, además, mientras quede algo
//    por adoptar la vuelta del cron NO corre (modulos/contenido.js: `svc.adoptando`).
//  · Va por tandas (`max` filas por vuelta): un Worker tiene un tope de consultas por invocación; lo que quede lo termina la próxima vuelta del cron.
import { normalizar, ID_RE } from '../../../../contenido/piezas-core.mjs';
import { completar } from './config.js';

const COLECCIONES = ['contenido-piezas', 'contenido-cola', 'contenido-dias', 'contenido-pubs', 'contenido-docs'];
const DOCS_PERMITIDOS = new Set(['contenido.meta.agenda', 'contenido.simulacro', 'contenido.mejores-horas', 'contenido.meta.cuentas', 'config.contenido']);
const LOTE = 25;

export async function hayQueAdoptar(db) { return !!(await db.prepare("select 1 x from filas where coleccion like 'contenido-%' limit 1").first()); }

/** → { adoptadas, descartadas, quedan }. `max` filas por llamada. */
export async function adoptar(db, { max = 120, ahora = Date.now } = {}) {
  const { results } = await db.prepare(`select coleccion, id, json from filas where coleccion in (${COLECCIONES.map(() => '?').join(',')}) order by case coleccion when 'contenido-piezas' then 0 when 'contenido-cola' then 1 when 'contenido-docs' then 2 when 'contenido-dias' then 3 else 4 end, orden, id limit ?`).bind(...COLECCIONES, max).all();
  const t = new Date(ahora()).toISOString(), sentencias = [], quitar = [];
  let adoptadas = 0, descartadas = 0;
  for (const f of results) {
    let v; try { v = JSON.parse(f.json); } catch { v = null; }
    quitar.push(db.prepare('delete from filas where coleccion = ? and id = ?').bind(f.coleccion, f.id));
    const s = sentenciaDe(db, f.coleccion, f.id, v, t);
    if (s) { sentencias.push(s); adoptadas++; } else descartadas++;
  }
  for (let i = 0; i < sentencias.length; i += LOTE) await db.batch(sentencias.slice(i, i + LOTE));
  for (let i = 0; i < quitar.length; i += LOTE) await db.batch(quitar.slice(i, i + LOTE));
  if (results.length) await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(t, 'migracion', 'sistema', JSON.stringify({ contenido: { adoptadas, descartadas } })).run();
  const quedan = (await db.prepare(`select count(*) n from filas where coleccion in (${COLECCIONES.map(() => '?').join(',')})`).bind(...COLECCIONES).first()).n;
  return { adoptadas, descartadas, quedan };
}

function sentenciaDe(db, coleccion, id, v, t) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  if (coleccion === 'contenido-piezas') {
    if (!ID_RE.test(String(id))) return null;
    const r = normalizar(v); if (r.error) return null;
    const p = Object.assign(r.pieza, { id, creada: String(v.creada || t), actualizada: String(v.actualizada || v.creada || t), aprobada: v.estado === 'aprobada' && v.aprobada ? v.aprobada : null, entregada: v.entregada || null, medidas: v.medidas && typeof v.medidas === 'object' ? v.medidas : {}, estado: r.pieza.estado === 'aprobada' && !v.aprobada ? 'revision' : r.pieza.estado });
    return db.prepare('insert or ignore into contenido_piezas (id, fecha, hora, estado, json, borrada, creada, actualizada) values (?,?,?,?,?,0,?,?)').bind(id, p.fecha || '', p.hora || '', p.estado, JSON.stringify(p), p.creada, p.actualizada);
  }
  if (coleccion === 'contenido-cola') return /^p-\d{8}-[a-f0-9]{4,8}$/.test(String(id)) ? db.prepare('insert or ignore into contenido_cola (pieza, json, actualizado) values (?,?,?)').bind(id, JSON.stringify(v), t) : null;
  if (coleccion === 'contenido-dias') return /^(facebook|instagram):[\w.-]+\|\d{4}-\d{2}-\d{2}$/.test(String(id)) ? db.prepare('insert or ignore into contenido_dias (id, mes, json) values (?,?,?)').bind(id, String(id).slice(-10, -3), JSON.stringify(v)) : null;
  if (coleccion === 'contenido-pubs') return /^(facebook|instagram):[\w.-]+\|[\w.-]+$/.test(String(id)) ? db.prepare('insert or ignore into contenido_pubs (id, publicada, json) values (?,?,?)').bind(id, String(v.publicadaAt || ''), JSON.stringify({ ...v, miniatura: '' })) : null; // la miniatura era un archivo de la computadora: la primera foto en la nube la baja otra vez
  if (coleccion === 'contenido-docs') {
    if (!DOCS_PERMITIDOS.has(id)) return null;
    const valor = id === 'config.contenido' ? { ...completar(v), modo: 'simulacro' } : v; // los ajustes llegan siempre en simulacro: que publique de verdad lo decide el dueño
    return db.prepare('insert or ignore into docs (clave, json, version, actualizado) values (?,?,1,?)').bind(id, JSON.stringify(valor), t);
  }
  return null;
}
