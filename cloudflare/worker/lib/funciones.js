// Ajustes → «Funciones nuevas»: encender y apagar desde la oficina lo que se publicó apagado. NO hay otro almacén ni otra lógica de escritura:
// el catálogo (qué función, en qué documento, qué ruta) y el cálculo de la mezcla son los de `funciones-core.mjs` (`plan`), los MISMOS que usa el botón
// de GitHub (cloudflare/scripts/encender-funciones.mjs). Aquí solo se lee cada documento con su versión y se guarda con compare-and-set: si otra persona lo
// cambió entre medias se vuelve a calcular; nunca se reemplaza un documento entero a ciegas y lo demás se conserva.
// Lo que el catálogo marca `lista: false` NO se enciende desde aquí (el panel dice por qué); apagar siempre se puede. Ningún secreto, ningún flag de gasto de pago.
import { FUNCIONES, porId, documentosDe, plan, activa } from '../../../funciones-core.mjs';
import { leerDoc, guardarDoc } from './almacen.js';
import { sembrarGeneral } from './chat/chat.js';

/** Lo que ya tiene su pantalla en Ajustes o su propio camino: se enseña con su estado y un enlace, no se duplica. */
export const ENLACES = [
  { id: 'significado', titulo: 'Buscar notas por significado', que: 'Tiene su propio camino de tres pasos: Indexar, Medir y Activar.', donde: 'Cerebro → Actualizar conexiones → paso 6', gasta: true },
  { id: 'hooks-token', titulo: 'Aceptar el token en la dirección (?token=)', que: 'Para los webhooks de formularios e indicadores. Apágalo cuando ya nadie lo use.', campo: 'hooks.tokenEnQuery', grupo: 'seguridad' },
  { id: 'publicar-ya', titulo: 'Botón «Publicar ahora» en Contenido', que: 'Publica una pieza en este minuto. Solo con modo «Real» y Meta directo; no se puede deshacer.', campo: 'contenido.publicarYa', grupo: 'contenido' },
];

const leerTodos = async (db, claves) => { const docs = {}, version = {}; for (const c of claves) { const d = await leerDoc(db, c, null); if (d.valor !== null) { docs[c] = d.valor; version[c] = d.version; } } return { docs, version }; };

/** El catálogo con el estado REAL de cada función. */
export async function listar(db) {
  const { docs } = await leerTodos(db, documentosDe(FUNCIONES));
  const funciones = FUNCIONES.map((f) => ({ id: f.id, titulo: f.titulo, que: f.que, nota: f.nota || null, gasta: f.gasta === true, lista: f.lista === true, porque: f.lista ? null : (f.porque || null), panel: f.panel || null, requiere: f.requiere || null, activa: activa(f, docs) }));
  const enlaces = ENLACES.map((e) => ({ ...e, activa: e.campo ? (e.campo.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), { ...(docs['config-local'] || {}), ...(docs.ajustes || {}) }) ?? (e.id === 'hooks-token' ? true : false)) === true : null }));
  return { funciones, enlaces };
}

/** Cambia UNA función. → { ok, id, de, a, cambio } o { error, status }. */
export async function cambiar(db, { id, activo }, usuario) {
  const f = typeof id === 'string' ? porId(id) : null;
  if (!f) return { error: 'Esa función no está en la lista.', status: 422 };
  if (activo !== true && activo !== false) return { error: '«activo» debe ser verdadero o falso.', status: 422 };
  if (f.panel) return { error: `${f.titulo}: se cambia en ${f.panel}, no desde aquí.`, status: 422 };
  if (activo === true && !f.lista) return { error: `${f.titulo}: no se puede encender todavía. ${f.porque || ''}`.trim(), status: 409 };
  const claves = documentosDe([f]);
  for (let intento = 0; intento < 4; intento++) {
    const { docs, version } = await leerTodos(db, claves);
    const p = plan(docs, [{ id: f.id, activo }]);
    if (p.avisos.length) return { error: p.avisos[0], status: 409 };
    const h = p.hechos[0];
    try {
      for (const [clave, valor] of Object.entries(p.cambios)) await guardarDoc(db, clave, valor, { espera: version[clave] ?? 0 });
    } catch (e) { if (e.conflicto) continue; throw e; }
    if (!h.yaEstaba) {
      if (f.id === 'chat' && activo) await sembrarGeneral(db);
      await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'funciones', String(usuario?.email || usuario?.nombre || 'alguien').slice(0, 120), JSON.stringify({ id: f.id, de: h.de ? 'encendida' : 'apagada', a: h.a ? 'encendida' : 'apagada' })).run();
    }
    return { ok: true, id: f.id, de: h.de, a: h.a, cambio: !h.yaEstaba };
  }
  return { error: 'Alguien cambió los ajustes en este mismo momento. Vuelve a intentarlo.', status: 409 };
}
