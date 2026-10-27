// Cerebro en la nube — recalcular el mapa ENTERO (issue #45, idea 1; pedido del dueño: «que no dependa de mi computadora ni de migrar»).
// El mapa 3D se calculaba solo en la computadora del dueño (graph-core.mjs: d3-force) y se subía a D1; «Actualizar conexiones» solo lo mantenía al día SIN mover ninguna neurona. Aquí se calcula entero con
// el MISMO código (graph-core.mjs, el que usa la migración): todas las neuronas pueden moverse. Medido en Node: 59 notas ≈ 0,3 s de CPU, 600 ≈ 1 s, 1.500 ≈ 3 s. Eso cabe en un Worker de pago (30 s de CPU por
// petición) y NO en el plan gratuito (10 ms), que de todos modos ya no podría armar el índice de búsqueda de los agentes: por eso hay un tope de notas y la acción es del administrador y a mano.
// Seguro por diseño: el mapa anterior se guarda (doc `cerebro.mapa.anterior`) y se puede volver a él; al volver, las notas que cambiaron desde entonces se acomodan sin mover lo que estaba (reconciliarMapa).
// Las notas nunca se tocan: el mapa es solo el dibujo.
import { layoutGraphFromNotes } from '../../../graph-core.mjs';
import { analizarEnlaces, leerEstado, leerMapa, todasLasNotas, sincronizar, DOC_CONEXIONES } from './conexiones.js';
import { leerDoc, guardarDoc } from './almacen.js';
import { guardarGrafo } from './cerebro.js';
import { ahora } from './ids.js';

export const MAX_NOTAS_MAPA = 1500;           // más notas que esto y el cálculo se acerca al límite de CPU de un Worker
export const DOC_MAPA_ANTERIOR = 'cerebro.mapa.anterior';
const MAX_COPIA = 1_500_000;                  // una fila de D1 se corta a 2 MB: un mapa más grande que esto se calcula, pero sin copia para volver atrás

/** Lo puro: de las notas ({ nombre, grupo, actualizado, texto }) al mapa recién calculado { notes, nodes, links, extra, floor }. Siempre el mismo orden de notas (carpeta y nombre): el mismo texto da el mismo mapa. */
export async function calcularMapa(filas) {
  const ordenadas = [...filas].sort((a, b) => String(a.grupo || '').localeCompare(String(b.grupo || '')) || a.nombre.localeCompare(b.nombre));
  const notes = new Map(ordenadas.map((f) => [f.nombre, { group: f.grupo || '00-Meta', text: String(f.texto || ''), mtime: Number(f.actualizado) || 0 }]));
  const { pares } = analizarEnlaces(ordenadas); // los enlaces ya resueltos como en el resto del Cerebro (sin importar mayúsculas ni tildes)
  return layoutGraphFromNotes(notes, pares, { mtimeOf: (n) => n.mtime });
}

/** ¿Está d3-force en el paquete? Si no, graph-core usa su cálculo de reserva (distinto y más lento): se dice, no se esconde. */
const motorDelMapa = async () => { try { await import('d3-force'); return 'd3-force'; } catch { return 'interno'; } };

/** Lo que se ve al abrir el botón: cuántas notas hay, si caben, y si hay un mapa anterior al que volver. */
export async function estadoMapaCompleto(db, tope = MAX_NOTAS_MAPA) {
  const n = Number((await db.prepare('select count(*) n from notas').first())?.n ?? 0), c = (await leerDoc(db, DOC_MAPA_ANTERIOR, null)).valor;
  return { notas: n, tope, puede: n > 0 && n <= tope, copia: c?.g ? { at: c.at, por: c.por || '' } : null };
}

/** Recalcula el mapa entero y lo guarda. → { ok, notas, conectadas, lineas, menciones, motor, copia } o { error, estado }. */
export async function recalcularMapa({ db, por = '', tope = MAX_NOTAS_MAPA }) {
  const filas = await todasLasNotas(db);
  if (!filas.length) return { error: 'Todavía no hay notas que dibujar.', estado: 409 };
  if (filas.length > tope) return { error: `Son ${filas.length} notas: calcular el mapa entero aquí pasa del tope de ${tope}. Sigue calculándose desde tu computadora al migrar.`, estado: 409 };
  const [antes, est] = await Promise.all([leerMapa(db), leerEstado(db)]);
  const motor = await motorDelMapa(), nuevo = await calcularMapa(filas);
  // la cola de la IA («lo nuevo desde la última vez») se mide contra la fecha del mapa: se fija ANTES de que el mapa nuevo la adelante, o las notas editadas que aún esperan dejarían de salir
  if (!est.ref && antes.calculado) await guardarDoc(db, DOC_CONEXIONES, { ref: antes.calculado, revisadas: est.revisadas, ultima: est.ultima });
  let copia = false;
  if (antes.g && JSON.stringify(antes.g).length <= MAX_COPIA) { await guardarDoc(db, DOC_MAPA_ANTERIOR, { at: ahora(), por, g: antes.g }); copia = true; }
  await guardarGrafo(db, nuevo);
  const s = await sincronizar(db, filas); // el mapa nuevo ya es fiel a las notas; esto solo olvida lo que los agentes aprendieron de notas que ya no existen
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'cerebro', por || 'oficina', JSON.stringify({ accion: 'mapa-entero', notas: nuevo.notes, lineas: nuevo.links.length, motor, copia })).run().catch(() => {});
  return { ok: true, notas: nuevo.notes, conectadas: nuevo.nodes.filter((n) => n.d > 0).length, lineas: nuevo.links.length, menciones: nuevo.extra.length, motor, copia, memoria: s.memoria };
}

/** Vuelve al mapa de antes del último recálculo (una sola vez) y acomoda las notas que cambiaron desde entonces sin mover lo que estaba. */
export async function deshacerMapa({ db, por = '' }) {
  const c = (await leerDoc(db, DOC_MAPA_ANTERIOR, null)).valor;
  if (!c?.g) return { error: 'No hay un mapa anterior al que volver.', estado: 409 };
  await guardarGrafo(db, c.g);
  await guardarDoc(db, DOC_MAPA_ANTERIOR, { g: null }); // una sola vez: volver y volver a «volver» no es un vaivén
  const s = await sincronizar(db, await todasLasNotas(db));
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'cerebro', por || 'oficina', JSON.stringify({ accion: 'mapa-entero-deshacer' })).run().catch(() => {});
  return { ok: true, sinMapa: !s.mapa.hay, acomodadas: s.mapa.cambios?.nuevasEnElMapa || 0 };
}
