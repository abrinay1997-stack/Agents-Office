// Ajustes → «Funciones nuevas»: encender y apagar desde la oficina lo que se publicó apagado. NO hay otro almacén ni otra lógica de escritura:
// el catálogo (qué función, en qué documento, qué ruta) y el cálculo de la mezcla son los de `funciones-core.mjs` (`plan`), los MISMOS que usa el botón
// de GitHub (cloudflare/scripts/encender-funciones.mjs). Aquí solo se lee cada documento con su versión y se guarda con compare-and-set: si otra persona lo
// cambió entre medias se vuelve a calcular; nunca se reemplaza un documento entero a ciegas y lo demás se conserva.
// Lo que el catálogo marca `lista: false` NO se enciende desde aquí (el panel dice por qué); apagar siempre se puede. Ningún secreto, ningún flag de gasto de pago.
import { FUNCIONES, porId, documentosDe, poner, leer, activa } from '../../../funciones-core.mjs';
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

/** Cambia UNA función. → { ok, id, de, a, cambio } o { error, status }.
 *  Cada documento se comprueba y se escribe POR SEPARADO (una función de `config` vive en dos: `ajustes` y `config-local`, y el que la lee puede ser cualquiera de los dos):
 *  se escribe solo donde la ruta no vale ya lo pedido, con compare-and-set, y al final se relee y se verifica que quedó en TODOS. Si no, error en palabras (nunca «Encendida» a medias). */
export async function cambiar(db, { id, activo }, usuario) {
  const f = typeof id === 'string' && FUNCIONES.some((x) => x.id === id) ? porId(id) : null; // el id exacto: ni espacios ni mayúsculas
  if (!f) return { error: 'Esa función no está en la lista.', status: 422 };
  if (activo !== true && activo !== false) return { error: '«activo» debe ser verdadero o falso.', status: 422 };
  if (f.panel) return { error: `${f.titulo}: se cambia en ${f.panel}, no desde aquí.`, status: 422 };
  if (activo === true && !f.lista) return { error: `${f.titulo}: no se puede encender todavía. ${f.porque || ''}`.trim(), status: 409 };
  const claves = documentosDe([f]);
  const primero = await leerTodos(db, claves);
  const de = activa(f, primero.docs);
  let escribio = false;
  for (let intento = 0; intento < 5; intento++) {
    const { docs, version } = intento === 0 ? primero : await leerTodos(db, claves);
    const faltan = claves.filter((c) => (leer(docs[c] || {}, f.ruta) === true) !== activo);
    if (!faltan.length) { // todos los documentos dicen lo pedido: verificado
      if (f.id === 'chat' && activo && (escribio || de !== activo)) await sembrarGeneral(db);
      if (escribio || de !== activo) { try { await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'funciones', String(usuario?.email || usuario?.nombre || 'alguien').slice(0, 120), JSON.stringify({ id: f.id, de: de ? 'encendida' : 'apagada', a: activo ? 'encendida' : 'apagada' })).run(); } catch { /* la auditoría no tumba un cambio ya hecho */ } }
      return { ok: true, id: f.id, de, a: activo, cambio: escribio || de !== activo };
    }
    try {
      for (const c of faltan) { await guardarDoc(db, c, poner(docs[c] || {}, f.ruta, activo), { espera: version[c] ?? 0 }); escribio = true; }
    } catch (e) { if (!e.conflicto) throw e; } // alguien guardó entre medias: se vuelve a leer y a comprobar cada documento
  }
  return { error: 'Alguien cambió los ajustes en este mismo momento y no pude dejarlo completo. Mira el estado y vuelve a intentarlo.', status: 409 };
}
