// El Cerebro en la nube: las notas viven en D1 (`notas`) y el mapa 3D, ya calculado, en `grafo`.
// La búsqueda y los resúmenes son los mismos módulos puros que usa la oficina local.
import { buscarEnCerebro } from '../../../cerebro-busqueda.mjs';
import { summary } from '../../../memory.mjs';
import { ahora } from './ids.js';

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
  if (!faltan.length && !sobran) return g;
  const enlazados = nodos.filter((n) => n.d > 0), sueltos = nodos.filter((n) => !(n.d > 0) && hay.has(n.id));
  const hechos = (f) => {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(f.cab || ''), o = {};
    if (fm) for (const l of fm[1].split(/\r?\n/)) { const m = /^(agent|department|done):\s*(.+)$/.exec(l); if (m) o[m[1]] = m[2].trim(); }
    let t = o.done ? Date.parse(o.done) : NaN; if (!Number.isFinite(t)) t = Number(f.actualizado) || 0;
    return { t: Math.round(t / 1000), ...(o.agent ? { a: o.agent } : {}), ...(o.department ? { dep: o.department } : {}) };
  };
  const porNombre = new Map(filas.map((f) => [f.nombre, f]));
  const todos = [...sueltos.map((n) => ({ id: n.id, g: n.g, t: n.t, ...(n.a ? { a: n.a } : {}), ...(n.dep ? { dep: n.dep } : {}) })),
    ...faltan.map((f) => ({ id: f.nombre, g: f.grupo || '00-Meta', ...hechos(f) }))]
    .sort((a, b) => String(a.g).localeCompare(String(b.g)) || a.id.localeCompare(b.id));
  const N = enlazados.length;
  const anillo = todos.map((n, i) => { const ang = (i / Math.max(1, todos.length)) * Math.PI * 2 + 0.3, r = N ? 1.14 + (i % 3) * 0.035 : 0.6; return { ...n, d: 0, x: +(Math.cos(ang) * r).toFixed(3), y: +(Math.sin(ang) * r).toFixed(3) }; });
  const nodes = [...enlazados, ...anillo];
  return { ...(base || { links: [], extra: [], floor: null }), notes: nodes.length, nodes };
}

/** Lo que contesta GET /api/brain. Sin mapa todavía ni notas, uno vacío (la página conserva el de muestra); con notas nuevas, también ellas (conNotasNuevas). */
export async function leerGrafo(db) {
  const f = await db.prepare('select json from grafo where id = 1').first();
  const g = f ? JSON.parse(f.json) : null;
  const { results } = await db.prepare('select nombre, grupo, actualizado, substr(texto, 1, 600) cab from notas').all();
  const lleno = conNotasNuevas(g, results) ?? { notes: 0, nodes: [], links: [], extra: [], floor: null };
  return { ...lleno, learned: { w: {}, links: [] } }; // lo que aprende la memoria llega con los agentes (fase 4)
}

export async function buscar(db, q) {
  const { results } = await db.prepare('select nombre, texto from notas').all();
  return buscarEnCerebro(results.map((r) => [r.nombre, r.texto]), q);
}

/** Una nota, con la misma forma que /api/note local. null si no existe. */
export async function leerNota(db, nombre, { peek = false } = {}) {
  const n = await db.prepare('select nombre, grupo, oficina, texto, bytes, actualizado from notas where nombre = ?').bind(nombre).first();
  if (!n) return null;
  if (peek) {
    const cuerpo = sinCabecera(n.texto).replace(/^#+\s.*$/m, '').replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1').replace(/^\s*\|?\s*:?-{2,}.*$/gm, '')
      .replace(/[*_`>#|]+/g, ' ').replace(/(^|\s)[-:—]{2,}(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
    return { name: n.nombre, group: n.grupo, peek: summary(n.texto, 300) || cuerpo.slice(0, 260) + (cuerpo.length > 260 ? '…' : '') };
  }
  const corta = n.texto.length > MAX_NOTA;
  return { name: n.nombre, group: n.grupo, text: corta ? n.texto.slice(0, MAX_NOTA) : n.texto, cut: corta, size: n.bytes, modified: n.actualizado, deletable: !!n.oficina && /\ntask: /.test(n.texto) };
}

export async function contar(db) {
  const r = await db.prepare('select count(*) n, sum(oficina) o from notas').first();
  return { notas: r?.n ?? 0, deAgentes: r?.o ?? 0 };
}
