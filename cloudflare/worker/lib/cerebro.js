// El Cerebro en la nube: las notas viven en D1 (`notas`) y el mapa 3D, ya calculado, en `grafo`.
// La búsqueda y los resúmenes son los mismos módulos puros que usa la oficina local.
import { buscarEnCerebro } from '../../../cerebro-busqueda.mjs';
import { summary } from '../../../memory.mjs';
import { ahora } from './ids.js';
import * as N from '../../../notas-core.mjs';

const MAX_NOTA = 200000;            // lo mismo que /api/note local: más largo se corta
const MAX_NOTA_SUBIDA = 1_000_000;  // una nota subida puede ser más larga que lo que se enseña
const LOTE_SQL = 25;

const sinCabecera = (t) => String(t).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

/** Valida lo que manda la herramienta de migración. { ok, notas } o { ok:false, error }. */
export function validarNotas(entrada) {
  if (!Array.isArray(entrada) || !entrada.length) return { ok: false, error: 'No hay notas que subir.' };
  if (entrada.length > 200) return { ok: false, error: 'Demasiadas notas en una subida (máximo 200).' };
  const notas = [];
  for (const n of entrada) {
    const nombre = String(n?.nombre ?? '').trim();
    if (!nombre || nombre.length > 200 || /[\\/\0]/.test(nombre) || nombre.startsWith('.')) return { ok: false, error: `Nombre de nota no válido: «${nombre.slice(0, 40)}».` };
    const texto = String(n?.texto ?? '');
    if (texto.length > MAX_NOTA_SUBIDA) return { ok: false, error: `La nota «${nombre}» es demasiado larga.` };
    const grupo = String(n?.grupo ?? '00-Meta').slice(0, 120) || '00-Meta';
    notas.push({ nombre, grupo, oficina: n?.oficina ? 1 : 0, texto, actualizado: Number.isFinite(+n?.actualizado) ? Math.trunc(+n.actualizado) : 0, tarea: n?.tarea ? String(n.tarea).slice(0, 80) : null });
  }
  return { ok: true, notas };
}

/** Guarda notas (las que ya están se reemplazan). Con `siMasNueva` (la migración desde la computadora), una nota que la nube editó DESPUÉS de la fecha de la copia de la computadora se queda como está:
 *  repetir la migración no pisa lo escrito aquí (un documento subido con ese nombre, la voz de marca…). → cuántas se enviaron */
export async function guardarNotas(db, notas, { siMasNueva = false } = {}) {
  const sql = `insert into notas (nombre, grupo, oficina, texto, bytes, actualizado, tarea) values (?,?,?,?,?,?,?)
    on conflict (nombre) do update set grupo=excluded.grupo, oficina=excluded.oficina, texto=excluded.texto, bytes=excluded.bytes, actualizado=excluded.actualizado, tarea=excluded.tarea${siMasNueva ? ' where excluded.actualizado >= notas.actualizado' : ''}`;
  for (let i = 0; i < notas.length; i += LOTE_SQL)
    await db.batch(notas.slice(i, i + LOTE_SQL).map((n) =>
      db.prepare(sql).bind(n.nombre, n.grupo, n.oficina, n.texto, new TextEncoder().encode(n.texto).length, n.actualizado, n.tarea)));
  return notas.length;
}

export async function guardarGrafo(db, grafo) {
  if (!grafo || !Array.isArray(grafo.nodes) || !Array.isArray(grafo.links)) return false;
  await db.prepare(`insert into grafo (id, json, notas, calculado) values (1,?,?,?)
    on conflict (id) do update set json=excluded.json, notas=excluded.notas, calculado=excluded.calculado`)
    .bind(JSON.stringify(grafo), Number(grafo.notes) || grafo.nodes.length, ahora()).run();
  return true;
}

/**
 * El mapa con las notas que llegaron DESPUÉS de calcularlo. El cálculo de fuerzas del mapa (graph-core.mjs) gasta más CPU de la que da un Worker, así que lo hace la
 * computadora del dueño al migrar; pero una nota nueva en la nube (un documento subido, la entrega de un agente, una nota de Contenido) no puede quedarse fuera del mapa
 * hasta la siguiente migración. Aquí entra como una neurona SIN enlaces, en el anillo exterior (donde graph-core.mjs pone las notas sueltas), sin tocar los enlaces,
 * el suelo ni los índices de las demás: los nodos con enlaces van primero y los sueltos al final, así que reordenar los sueltos no mueve ningún índice.
 * Una nota ya con enlaces que se borra se queda como está (quitarla movería los índices); una suelta que se borra, se va. Puro. → el mismo `g` si no hay nada que cambiar.
 * filas: [{ nombre, grupo, actualizado, cab }] (cab: el principio del texto, para la cabecera).
 */
export function conNotasNuevas(g, filas) {
  const base = g && Array.isArray(g.nodes) ? g : null;
  if (!base && !filas.length) return g;
  const nodos = base ? base.nodes : [], tiene = new Set(nodos.map((n) => n.id)), hay = new Set(filas.map((f) => f.nombre));
  const faltan = filas.filter((f) => !tiene.has(f.nombre)), sobran = nodos.some((n) => !(n.d > 0) && !hay.has(n.id));
  // 27 oct 2026: una nota con enlaces que se manda a la papelera SÍ sale del mapa. Los índices de `links` son posiciones en `nodos`: se quita el nodo y se rehacen (los demás enlaces no se mueven de sitio).
  const fantasmas = nodos.some((n) => n.d > 0 && !hay.has(n.id));
  if (!faltan.length && !sobran && !fantasmas) return g;
  const enlazadosTodos = nodos.filter((n) => n.d > 0), sueltos = nodos.filter((n) => !(n.d > 0) && hay.has(n.id));
  const enlazados = enlazadosTodos.filter((n) => hay.has(n.id));
  const nuevoDe = new Map(); // posición vieja en `nodos` → posición nueva (-1: se fue)
  nodos.forEach((n, i) => nuevoDe.set(i, n.d > 0 ? enlazados.indexOf(n) : -1));
  const rehacer = (pares) => (Array.isArray(pares) ? pares.map((p) => (Array.isArray(p) ? [nuevoDe.get(p[0]) ?? -1, nuevoDe.get(p[1]) ?? -1, ...p.slice(2)] : p)).filter((p) => !Array.isArray(p) || (p[0] >= 0 && p[1] >= 0)) : pares);
  const hechos = (f) => {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(f.cab || ''), o = {};
    if (fm) for (const l of fm[1].split(/\r?\n/)) { const m = /^(agent|department|done):\s*(.+)$/.exec(l); if (m) o[m[1]] = m[2].trim(); }
    let t = o.done ? Date.parse(o.done) : NaN; if (!Number.isFinite(t)) t = Number(f.actualizado) || 0;
    return { t: Math.round(t / 1000), ...(o.agent ? { a: o.agent } : {}), ...(o.department ? { dep: o.department } : {}) };
  };
  const todos = [...sueltos.map((n) => ({ id: n.id, g: n.g, t: n.t, ...(n.a ? { a: n.a } : {}), ...(n.dep ? { dep: n.dep } : {}) })),
    ...faltan.map((f) => ({ id: f.nombre, g: f.grupo || '00-Meta', ...hechos(f) }))]
    .sort((a, b) => String(a.g).localeCompare(String(b.g)) || a.id.localeCompare(b.id));
  const N0 = enlazados.length;
  const anillo = todos.map((n, i) => { const ang = (i / Math.max(1, todos.length)) * Math.PI * 2 + 0.3, r = N0 ? 1.14 + (i % 3) * 0.035 : 0.6; return { ...n, d: 0, x: +(Math.cos(ang) * r).toFixed(3), y: +(Math.sin(ang) * r).toFixed(3) }; });
  const nodes = [...enlazados, ...anillo];
  if (!fantasmas) return { ...(base || { links: [], extra: [], floor: null }), notes: nodes.length, nodes };
  // con nodos quitados, `extra` (menciones) pierde las que tocan a un nodo que se fue o a uno suelto (el anillo se reordena siempre): se conservan las demás
  const extra = rehacer((base.extra || []).filter((p) => !Array.isArray(p) || (p[0] < nodos.length && p[1] < nodos.length && nodos[p[0]]?.d > 0 && nodos[p[1]]?.d > 0)));
  return { ...base, notes: nodes.length, nodes, links: rehacer(base.links), extra };
}

/** Lo que contesta GET /api/brain. Sin mapa todavía ni notas, uno vacío (la página conserva el de muestra); con notas nuevas, también ellas (conNotasNuevas). */
export async function leerGrafo(db) {
  const f = await db.prepare('select json from grafo where id = 1').first();
  const g = f ? JSON.parse(f.json) : null;
  const { results } = await db.prepare('select nombre, grupo, actualizado, substr(texto, 1, 600) cab from notas').all();
  const lleno = conNotasNuevas(g, results) ?? { notes: 0, nodes: [], links: [], extra: [], floor: null, vacio: true }; // `vacio`: la página pinta un Cerebro sin notas, no el de muestra
  return { ...lleno, learned: { w: {}, links: [] } }; // lo que aprende la memoria llega con los agentes (fase 4)
}

export async function buscar(db, q) {
  const { results } = await db.prepare('select nombre, texto from notas').all();
  return buscarEnCerebro(results.map((r) => [r.nombre, r.texto]), q);
}

/** Una nota, con la misma forma que /api/note local. null si no existe. */
export async function leerNota(db, nombre, { peek = false, puedeEscribir = true } = {}) {
  const n = await db.prepare('select nombre, grupo, oficina, texto, bytes, actualizado from notas where nombre = ?').bind(nombre).first();
  if (!n) return null;
  if (peek) {
    const cuerpo = sinCabecera(n.texto).replace(/^#+\s.*$/m, '').replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1').replace(/^\s*\|?\s*:?-{2,}.*$/gm, '')
      .replace(/[*_`>#|]+/g, ' ').replace(/(^|\s)[-:—]{2,}(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    return { name: n.nombre, group: n.grupo, peek: summary(n.texto, 300) || cuerpo.slice(0, 260) + (cuerpo.length > 260 ? '…' : '') };
  }
  const corta = n.texto.length > MAX_NOTA;
  return { name: n.nombre, group: n.grupo, text: corta ? n.texto.slice(0, MAX_NOTA) : n.texto, cut: corta, size: n.bytes, modified: n.actualizado, deletable: puedeEscribir, editable: puedeEscribir && !corta, key: N.esClave(n.nombre) }; // 27 oct 2026: cualquier nota se puede editar y mandar a la papelera (vuelve en 30 días)
}

export async function contar(db) {
  const r = await db.prepare('select count(*) n, sum(oficina) o from notas').first();
  return { notas: r?.n ?? 0, deAgentes: r?.o ?? 0 };
}

/* ---------- escribir (27 oct 2026): crear, editar, añadir, papelera ---------- */

const bytesDe = (t) => new TextEncoder().encode(t).length;
const finGrupo = (g) => String(g || '').slice(0, 120);

/** Una nota nueva, escrita a mano (o por Dimitri con el clic del dueño). → { ok, nombre, modified } | { error, estado } */
export async function crearNota(db, { nombre, texto = '', grupo = '', por = '' } = {}) {
  const n = N.nombreValido(nombre); if (!n.ok) return { error: n.error, estado: 400 };
  const g = N.grupoValido(grupo); if (!g.ok) return { error: g.error, estado: 400 };
  const t = N.textoValido(texto); if (!t.ok) return { error: t.error, estado: 413 };
  const dup = await db.prepare('select nombre from notas where lower(nombre) = lower(?)').bind(n.nombre).first();
  if (dup) return { error: `Ya hay una nota llamada «${dup.nombre}». Ábrela y edítala, o elige otro nombre.`, estado: 409 };
  const cuando = Date.now();
  try { await db.prepare('insert into notas (nombre, grupo, oficina, texto, bytes, actualizado, tarea) values (?,?,0,?,?,?,null)').bind(n.nombre, finGrupo(g.grupo), t.texto, bytesDe(t.texto), cuando).run(); }
  catch { return { error: `Ya hay una nota llamada «${n.nombre}».`, estado: 409 }; } // dos a la vez
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'nota', por || 'oficina', JSON.stringify({ accion: 'crear', nota: n.nombre })).run().catch(() => {});
  return { ok: true, nombre: n.nombre, modified: cuando };
}

/** Reemplaza el texto de una nota. `base`: el `modified` que leíste; si otra persona la cambió entre medias, 409 (no se pisa). → { ok, nombre, modified, antes } | { error, estado } */
export async function guardarNota(db, { nombre, texto, base = null, por = '' } = {}) {
  const t = N.textoValido(texto, { vacio: false }); if (!t.ok) return { error: t.error, estado: 413 };
  const ya = await db.prepare('select nombre, texto, actualizado from notas where nombre = ?').bind(String(nombre ?? '')).first();
  if (!ya) return { error: 'Esa nota ya no existe (¿alguien la mandó a la papelera?).', estado: 404 };
  if (base !== null && base !== undefined && Number(base) !== Number(ya.actualizado)) return { error: 'Otra persona cambió esta nota mientras la editabas. Ábrela de nuevo para ver lo último y vuelve a hacer tu cambio.', estado: 409, modified: ya.actualizado };
  const cuando = Math.max(Date.now(), Number(ya.actualizado) + 1);
  const r = await db.prepare('update notas set texto = ?, bytes = ?, actualizado = ?, oficina = oficina where nombre = ? and actualizado = ?').bind(t.texto, bytesDe(t.texto), cuando, ya.nombre, ya.actualizado).run();
  if (!r.meta?.changes) return { error: 'Otra persona cambió esta nota mientras la guardabas. Ábrela de nuevo y repite tu cambio.', estado: 409 };
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'nota', por || 'oficina', JSON.stringify({ accion: 'editar', nota: ya.nombre, antes: ya.texto.length, despues: t.texto.length })).run().catch(() => {});
  return { ok: true, nombre: ya.nombre, modified: cuando, antes: ya.texto };
}

/** Añade `texto` al final de la nota (o de una sección) sin tocar lo que decía. → igual que guardarNota, con `antes` (para deshacer). */
export async function agregarANota(db, { nombre, texto, seccion = '', por = '' } = {}) {
  const ya = await db.prepare('select texto, actualizado from notas where nombre = ?').bind(String(nombre ?? '')).first();
  if (!ya) return { error: `No hay una nota llamada «${String(nombre ?? '').slice(0, 60)}».`, estado: 404 };
  const nuevo = N.agregarTexto(ya.texto, texto, { seccion });
  if (nuevo.length > N.MAX_NOTA) return { error: 'La nota quedaría demasiado larga.', estado: 413 };
  return guardarNota(db, { nombre, texto: nuevo, base: ya.actualizado, por });
}

/** A la papelera (se queda 30 días; vuelve con restaurarNota). → { ok, nombre, id } | { error, estado } */
export async function mandarAPapelera(db, nombre, { por = '' } = {}) {
  const n = await db.prepare('select nombre, grupo, oficina, texto, bytes, actualizado, tarea from notas where nombre = ?').bind(String(nombre ?? '')).first();
  if (!n) return { error: 'Esa nota no existe.', estado: 404 };
  const cuando = Date.now();
  // Atómico y atado a la revisión que leímos: si alguien guardó una edición entre el SELECT y esto, no se copia ni se borra nada (409) y su cambio no se pierde.
  const lote = await db.batch([
    db.prepare('insert into notas_papelera (nombre, grupo, oficina, texto, bytes, actualizado, tarea, borrada, por) select nombre, grupo, oficina, texto, bytes, actualizado, tarea, ?, ? from notas where nombre = ? and actualizado = ?').bind(cuando, por || null, n.nombre, n.actualizado),
    db.prepare('delete from notas where nombre = ? and actualizado = ?').bind(n.nombre, n.actualizado),
  ]);
  if (!lote[1]?.meta?.changes) return { error: 'Alguien cambió esta nota justo ahora. Ábrela de nuevo para ver lo último y vuelve a intentarlo.', estado: 409 };
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'nota', por || 'oficina', JSON.stringify({ accion: 'papelera', nota: n.nombre })).run().catch(() => {});
  const fila = await db.prepare('select id from notas_papelera where nombre = ? and borrada = ? order by id desc limit 1').bind(n.nombre, cuando).first();
  return { ok: true, nombre: n.nombre, id: String(fila?.id ?? '') };
}

/** Lo que hay en la papelera, con la forma de la oficina local ({ items: [{ file, name, at }], keepDays }). */
export async function listarPapelera(db) {
  const { results } = await db.prepare('select id, nombre, borrada from notas_papelera order by borrada desc, id desc limit 200').all();
  return { items: results.map((r) => ({ file: String(r.id), name: r.nombre, at: r.borrada })), keepDays: 30 };
}

/** Saca una nota de la papelera. Si su nombre ya lo usa otra, vuelve con «-2». → { ok, nombre } | { error, estado } */
export async function restaurarNota(db, id, { por = '' } = {}) {
  const n = /^\d{1,12}$/.test(String(id ?? '')) ? await db.prepare('select * from notas_papelera where id = ?').bind(Number(id)).first() : null;
  if (!n) return { error: 'No está en la papelera.', estado: 404 };
  let nombre = n.nombre;
  for (let k = 2; await db.prepare('select 1 x from notas where lower(nombre) = lower(?)').bind(nombre).first(); k++) nombre = `${n.nombre}-${k}`.slice(0, 80);
  await db.batch([
    db.prepare('insert into notas (nombre, grupo, oficina, texto, bytes, actualizado, tarea) values (?,?,?,?,?,?,?)').bind(nombre, n.grupo, n.oficina, n.texto, n.bytes, Date.now(), n.tarea),
    db.prepare('delete from notas_papelera where id = ?').bind(n.id),
  ]);
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'nota', por || 'oficina', JSON.stringify({ accion: 'restaurar', nota: nombre })).run().catch(() => {});
  return { ok: true, nombre };
}
