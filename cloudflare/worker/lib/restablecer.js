// «Restablecer oficina» en la nube (restablecer-core.mjs explica las decisiones). D1 y R2 hacen lo que en la oficina local hacen los archivos:
//  · antes de tocar nada se guarda un RESPALDO (gzip en R2, o en D1 si no hay R2) de todo lo que el pedido toca;
//  · lo que se quita y lo que se carga de fábrica va en UN solo lote de D1 (atómico: o pasa todo o no pasa nada) y con pocas sentencias (cabe en el plan gratuito);
//  · la semilla de fábrica (59 notas, mapa, equipo, rutinas y skills de PanaClaw) la lee de /semilla/ (lib/semilla.js), no de la computadora del dueño;
//  · nunca toca: usuarios, sesiones, llaves, conectores, auditoría, ajustes, lo de Meta ni los respaldos.
import { AMBITOS, MODOS, IDS_AMBITOS, POR_DEFECTO, CONSERVA, DIAS_RESPALDO, TOPE_RESPALDOS, validarPedido, resumenDePedido, nuevoPaso, verificarPaso, idRespaldo, venceRespaldo, textoRespaldo, traeFabrica } from '../../../restablecer-core.mjs';
import { manifiesto, notasSemilla, grafoSemilla, equipoSemilla } from './semilla.js';
import { leerDoc, guardarDoc, mutarDoc } from './almacen.js';
import { avisar } from './avisos.js';
import { hayCorriendo } from './series/libro.js';

export { MODOS, AMBITOS, POR_DEFECTO, CONSERVA, DIAS_RESPALDO, validarPedido };
export const DOC_RESPALDOS = 'restablecer.respaldos', DOC_PASO = 'restablecer.paso', PREFIJO_R2 = 'respaldos/', PREFIJO_DOC = 'restablecer.respaldo.';
const TOPE_RESPALDO_BYTES = 40 * 1024 * 1024, TOPE_LOTE_JSON = 700_000;

/** Dónde vive cada cosa que un ámbito restablece. Un test (cloudflare/tests/restablecer.test.mjs) exige que TODA tabla, colección y clave de D1 esté aquí o en CONSERVA_*: lo nuevo obliga a decidir. */
export const DESTINOS = {
  cerebro: { tablas: ['notas', 'grafo', 'notas_papelera'], docs: ['memoria', 'memory', 'notas.revisar', 'arranque.propuesta', 'arranque.aplicadas', 'cerebro.conexiones', 'cerebro.significado', 'cerebro.calidad', 'cerebro.mapa.anterior'], filas: ['notas-respaldo'] },
  habilidades: { filas: ['skills', 'biblioteca'] },
  equipo: { docs: ['agentes.cerebro', 'agentes.local'] },
  rutinas: { filas: ['rutinas'], docs: ['rutinas.estado'] },
  cifras: { docs: ['cifras', 'cifras.porconfirmar'] },
  kpis: { docs: ['kpis', 'kpi.lineas'] },
  tareas: { filas: ['tareas', 'tareas-archivo'], tablas: ['tarea_bitacora', 'corridas', 'ejecuciones'], docs: ['tareas.proyectos', 'tareas.etiquetas', 'enrutador.correcciones'], prefijosDocs: ['feedback.', 'ejemplos.'] },
  dimitri: { tablas: ['series'], filas: ['subgerente', 'subgerente-hilo'], prefijosFilas: ['subgerente:', 'subgerente-arch:'], docs: ['subgerente.archivo', 'dimitri.semanal'], prefijosDocs: ['subgerente.archivo:'] }, // desde el 27 oct 2026 cada cuenta tiene su sala (`subgerente:<cuenta>`) y su historial (`subgerente.archivo:<cuenta>`)
  estudio: { tablas: ['estudio_archivos', 'estudio_trabajos', 'estudio_lotes'], filas: ['estudio-fichas'], docs: ['estudio.rev', 'estudio.carpetas', 'estudio.carpetas-borradas'] },
  mcp: { tablas: ['mcp_clientes', 'mcp_codigos', 'mcp_tokens', 'mcp_solicitudes'] }, // NO es un ámbito que se elija en la pantalla: CUALQUIER restablecimiento (o restauración) corta todas las conexiones de Claude (sentenciasDeQuitar). Un respaldo no las lleva: restaurar no las resucita.
  contenido: { tablas: ['contenido_piezas', 'contenido_cola', 'contenido_candado', 'contenido_papelera'], docs: ['contenido.simulacro', 'contenido.meta.agenda', 'contenido.historias'], filas: ['contenido-piezas', 'contenido-cola', 'contenido-docs'] }, // las filas `contenido-*` son el paso de la migración (lib/contenido/migracion.js): de ahí pasan a las tablas
};
/** Lo que NO se restablece nunca (por tabla / clave / colección / prefijo): personas, accesos, llaves, auditoría, ajustes, Meta, respaldos. */
export const CONSERVA_TABLAS = ['users', 'sessions', 'sesiones_uso', 'conectores', 'conectores_extra', 'auditoria', 'auditoria_agentes', 'costos', 'perfiles', 'invitaciones', 'acceso_intentos', 'reinicios', 'anuncios_tokens', 'anuncios_candados', 'anuncios_tasa', 'hook_eventos', 'hook_token_query', 'publica_tasa', 'telegram_updates', 'contenido_dias', 'contenido_pubs', 'docs', 'filas', 'bandeja_items',
  'notas_personales', 'notas_estado', 'presencia_cuenta', 'cuenta_telegram', // N1: lo que las personas se dejan entre sí y su última visita no son de la oficina: un restablecimiento no lo toca
  'chat_canales', 'chat_miembros', 'chat_mensajes', // C0: lo que las personas se escriben no es de la oficina: un restablecimiento no lo toca
  'notificaciones', // N0: lo leído y no leído de cada persona no es de la oficina: un restablecimiento no lo toca
  'series_tokens', // series (N4): tokens de 2 minutos; no son de la oficina
  'series_libro', // series (N1): el libro del dinero es contabilidad: un restablecimiento no lo toca (lo reservado o en duda sigue contando contra los topes)
  'notas_vectores']; // los vectores de significado son datos derivados que se reconocen por el hash del texto: no entran al respaldo (pesan mucho) y se podan solos al indexar
export const CONSERVA_DOCS = ['mcp.config', 'config', 'notificaciones.config', 'chat.config', 'notas.config', 'ajustes', 'config-local', 'config.contenido', 'estudio.config', 'estudio.uso', 'estudio.voces', 'triggers', 'telegram.estado', 'tareas.config', 'notices', 'meta.freno', 'bandeja.abierta', 'contenido.meta.cuentas', 'contenido.meta.freno', 'contenido.metricool.subidas', 'contenido.mejores-horas', 'contenido.redes', 'contenido.modo', 'arranque.estado', 'sesion.estado', 'dimitri-ia-estado', DOC_RESPALDOS, DOC_PASO];
export const CONSERVA_PREFIJOS_DOCS = ['mcp.idem:', 'mcp.undo:', 'fs:', 'anuncios.', 'meta.', 'bandeja.', 'restablecer.', 'telegram.', 'config.', 'presencia.'];
export const CONSERVA_FILAS = ['avisos', 'contenido-dias', 'contenido-pubs']; // estas dos son el paso de la foto de Meta (Analíticas): se conservan

const dest = (ambitos) => {
  const t = { tablas: [], docs: [], prefijosDocs: [], filas: [], prefijosFilas: [] };
  for (const a of ambitos) { const d = DESTINOS[a] || {}; for (const k of Object.keys(t)) t[k].push(...(d[k] || [])); }
  return t;
};
const marcas = (n) => Array.from({ length: n }, () => '?').join(',');
const comoLike = (p) => p.replace(/[\\%_]/g, '\\$&') + '%';

/** El WHERE de docs y de filas para un conjunto de destinos. → { docs: { sql, args } | null, filas: { sql, args } | null } */
function filtros(t) {
  const d = [], da = [], f = [], fa = [];
  if (t.docs.length) { d.push(`clave in (${marcas(t.docs.length)})`); da.push(...t.docs); }
  for (const p of t.prefijosDocs) { d.push("clave like ? escape '\\'"); da.push(comoLike(p)); }
  if (t.filas.length) { f.push(`coleccion in (${marcas(t.filas.length)})`); fa.push(...t.filas); }
  for (const p of t.prefijosFilas) { f.push("coleccion like ? escape '\\'"); fa.push(comoLike(p)); }
  return { docs: d.length ? { sql: d.join(' or '), args: da } : null, filas: f.length ? { sql: f.join(' or '), args: fa } : null };
}

/* ---------- compresión del respaldo ---------- */
async function comprimir(texto) { const s = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function descomprimir(bytes) { const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')); return new Response(s).text(); }
const aB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

async function guardarArchivoRespaldo(env, db, id, texto) {
  const gz = await comprimir(texto);
  if (env.MEDIA?.put) { await env.MEDIA.put(PREFIJO_R2 + id + '.json.gz', gz, { httpMetadata: { contentType: 'application/gzip' } }); return { almacen: 'r2', bytes: gz.length }; }
  if (gz.length > 1_300_000) throw new Error('Este respaldo no cabe sin el almacén de archivos (R2). Conecta R2 o restablece menos cosas a la vez.');
  await guardarDoc(db, PREFIJO_DOC + id, { b64: aB64(gz) }); return { almacen: 'd1', bytes: gz.length };
}
async function leerArchivoRespaldo(env, db, r) {
  if (r.almacen === 'r2') { const o = await env.MEDIA?.get(PREFIJO_R2 + r.id + '.json.gz'); if (!o) return null; return JSON.parse(await descomprimir(new Uint8Array(await o.arrayBuffer()))); }
  const d = (await leerDoc(db, PREFIJO_DOC + r.id, null)).valor; return d ? JSON.parse(await descomprimir(deB64(d.b64))) : null;
}
async function borrarArchivoRespaldo(env, db, r) {
  if (r.almacen === 'r2') await env.MEDIA?.delete(PREFIJO_R2 + r.id + '.json.gz');
  else await db.prepare('delete from docs where clave = ?').bind(PREFIJO_DOC + r.id).run();
}

/* ---------- leer lo que un pedido toca (para el respaldo y para contar) ---------- */
export async function volcar(db, ambitos) {
  const t = dest(ambitos), f = filtros(t), v = { tablas: {}, docs: [], filas: [] };
  for (const tabla of t.tablas) v.tablas[tabla] = (await db.prepare(`select * from ${tabla}`).all()).results;
  if (f.docs) v.docs = (await db.prepare(`select clave, json, version, actualizado from docs where ${f.docs.sql}`).bind(...f.docs.args).all()).results;
  if (f.filas) v.filas = (await db.prepare(`select coleccion, id, json, orden, actualizado from filas where ${f.filas.sql}`).bind(...f.filas.args).all()).results;
  return v;
}

/** Cuánto hay ahora de cada cosa (una sola consulta). → { ambito: 'texto' } */
export async function cuentasDe(db) {
  // UNA fila con subconsultas, NO `union all`: D1 admite como mucho 5 términos en una consulta compuesta («too many terms in compound SELECT»), y SQLite de Node (las pruebas) admite 500.
  const n = await db.prepare(`select (select count(*) from notas) notas,
    (select count(*) from filas where coleccion = 'tareas') tareas, (select count(*) from filas where coleccion = 'rutinas') rutinas,
    (select count(*) from filas where coleccion = 'skills') skills, (select count(*) from filas where coleccion = 'biblioteca') propias, (select count(*) from filas where coleccion = 'subgerente') dimitri,
    (select count(*) from estudio_archivos) estudio, (select count(*) from contenido_piezas) contenido,
    (select count(*) from docs where clave in ('cifras','cifras.porconfirmar')) cifras, (select count(*) from docs where clave = 'kpis') kpis,
    (select count(*) from docs where clave in ('agentes.cerebro','agentes.local')) equipo`).first();
  const pl = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`;
  return {
    cerebro: n.notas ? pl(n.notas, 'nota', 'notas') : 'vacío', habilidades: n.skills + n.propias ? pl(n.skills + n.propias, 'skill o habilidad', 'skills y habilidades') : 'ninguna', equipo: n.equipo ? 'con cambios' : 'de fábrica',
    rutinas: n.rutinas ? pl(n.rutinas, 'rutina', 'rutinas') : 'ninguna', cifras: n.cifras ? 'con cifras' : 'vacías', kpis: n.kpis ? 'con indicadores' : 'vacío', tareas: n.tareas ? pl(n.tareas, 'tarea', 'tareas') : 'ninguna',
    dimitri: n.dimitri ? pl(n.dimitri, 'mensaje', 'mensajes') : 'sin conversación', estudio: n.estudio ? pl(n.estudio, 'archivo', 'archivos') : 'vacía', contenido: n.contenido ? pl(n.contenido, 'pieza', 'piezas') : 'sin piezas',
  };
}

/* ---------- escribir con json_each: UNA sentencia por tanda, sin importar cuántas filas ---------- */
const trozos = (filas, tope = TOPE_LOTE_JSON) => {
  const out = []; let cur = [], tam = 0;
  for (const f of filas) { const t = JSON.stringify(f).length; if (cur.length && tam + t > tope) { out.push(cur); cur = []; tam = 0; } cur.push(f); tam += t; }
  if (cur.length) out.push(cur);
  return out;
};
const COL_OK = /^[a-z_][a-z0-9_]*$/;
/** Sentencias que reinsertan filas de una tabla (los nombres de columnas salen del propio respaldo y se validan). */
function sentenciasInsertar(db, tabla, filas) {
  if (!filas.length) return [];
  const cols = Object.keys(filas[0]); if (!cols.every((c) => COL_OK.test(c)) || !COL_OK.test(tabla)) throw new Error('El respaldo tiene columnas raras: no se restaura.');
  return trozos(filas).map((lote) => db.prepare(`insert or replace into ${tabla} (${cols.join(',')}) select ${cols.map((c) => `json_extract(value, '$.${c}')`).join(',')} from json_each(?)`).bind(JSON.stringify(lote)));
}

/** Lo que carga «PanaClaw por defecto» en cada ámbito que trae algo de fábrica. → sentencias */
async function sentenciasDeFabrica(env, db, modo, ambitos, ahora) {
  const s = [];
  if (!traeFabrica(modo, 'cerebro') || !ambitos.includes('cerebro')) { /* nada */ } else {
    const notas = await notasSemilla(env), grafo = await grafoSemilla(env);
    if (!notas?.length) throw new Error('No encuentro las notas de fábrica en esta instalación (la semilla se genera en cada despliegue).');
    for (const lote of trozos(notas.map((n) => ({ nombre: n.nombre, grupo: n.grupo, texto: n.texto })))) {
      s.push(db.prepare(`insert or replace into notas (nombre, grupo, oficina, texto, bytes, actualizado, tarea) select json_extract(value,'$.nombre'), json_extract(value,'$.grupo'), 0, json_extract(value,'$.texto'), length(cast(json_extract(value,'$.texto') as blob)), ${Number(ahora)}, null from json_each(?)`).bind(JSON.stringify(lote)));
    }
    if (grafo) s.push(db.prepare("insert or replace into grafo (id, json, notas, calculado) values (1, ?, ?, ?)").bind(JSON.stringify(grafo), Number(grafo.notes) || notas.length, new Date(ahora).toISOString()));
  }
  if (traeFabrica(modo, 'habilidades') && ambitos.includes('habilidades')) {
    const eq = await equipoSemilla(env);
    const filas = (eq?.skills || []).map((x) => ({ coleccion: 'skills', id: String(x.id), json: JSON.stringify(x.valor), orden: x.orden ?? 0, actualizado: new Date(ahora).toISOString() }));
    s.push(...sentenciasInsertar(db, 'filas', filas));
  }
  if (traeFabrica(modo, 'rutinas') && ambitos.includes('rutinas')) {
    const eq = await equipoSemilla(env);
    const filas = (eq?.routines?.routines || []).filter((r) => r && /^[a-z0-9][a-z0-9-]{0,60}$/i.test(String(r.id))).map((r, i) => ({ coleccion: 'rutinas', id: String(r.id), json: JSON.stringify(r), orden: i, actualizado: new Date(ahora).toISOString() }));
    s.push(...sentenciasInsertar(db, 'filas', filas));
  }
  if (traeFabrica(modo, 'equipo') && ambitos.includes('equipo')) {
    const eq = await equipoSemilla(env);
    if (eq?.agents?.agents?.length) s.push(db.prepare("insert or replace into docs (clave, json, version, actualizado) values ('agentes.cerebro', ?, 1, ?)").bind(JSON.stringify(eq.agents), new Date(ahora).toISOString()));
  }
  return s;
}

/** Las sentencias que QUITAN lo de estos ámbitos (pocas: una por tabla y una para docs y otra para filas). */
function sentenciasDeQuitar(db, ambitos) {
  const t = dest(ambitos), f = filtros(t), s = [];
  for (const tabla of t.tablas) s.push(db.prepare(`delete from ${tabla}`));
  s.push(db.prepare('delete from mcp_tokens'), db.prepare('delete from mcp_codigos'), db.prepare('delete from mcp_solicitudes')); // un restablecimiento cambia la oficina por debajo de Claude: se corta TODA conexión (Claude vuelve a pedir permiso)
  if (f.docs) s.push(db.prepare(`delete from docs where ${f.docs.sql}`).bind(...f.docs.args));
  if (f.filas) s.push(db.prepare(`delete from filas where ${f.filas.sql}`).bind(...f.filas.args));
  return s;
}
const sentenciasDeVolver = (db, v) => [...Object.entries(v.tablas).flatMap(([tabla, filas]) => sentenciasInsertar(db, tabla, filas)), ...sentenciasInsertar(db, 'docs', v.docs), ...sentenciasInsertar(db, 'filas', v.filas)];

/* ---------- el estado que ve la página ---------- */
export async function estado(env, db, ahora = Date.now()) {
  const [m, cuentas, resp] = await Promise.all([manifiesto(env), cuentasDe(db), leerDoc(db, DOC_RESPALDOS, { lista: [] })]);
  const modos = MODOS.map((x) => (x.id === 'panaclaw' && !m ? { ...x, disponible: false, motivo: 'Esta instalación no trae la semilla de fábrica (se genera en cada despliegue).' } : x));
  const lista = (resp.valor.lista || []).filter((r) => r.vence > ahora);
  return {
    modos, ambitos: AMBITOS.map((a) => ({ ...a, actual: cuentas[a.id] })), porDefecto: POR_DEFECTO, conserva: CONSERVA, diasRespaldo: DIAS_RESPALDO,
    semilla: m ? { notas: m.notas, skills: m.skills, rutinas: m.rutinas, habilidades: m.habilidades, generado: m.generado } : null,
    respaldos: lista.map((r) => ({ id: r.id, at: r.at, vence: r.vence, modo: r.modo, modoNombre: MODOS.find((x) => x.id === r.modo)?.nombre || r.modo, resumen: r.resumen, ambitos: r.ambitos })),
  };
}

/** Paso 1: valida, cuenta y deja la clave de un solo uso. → { pendiente } o { error, status } */
/** Restablecer «Dimitri» (o restaurar un respaldo que lo trae) borra las series: con una GENERANDO (muestra o corriendo) o con un paso en el aire (aunque esté pausada) se niega, con su motivo. → null o { error, status: 409 }. */
async function guardiaSeries(db, ambitos) {
  if (!Array.isArray(ambitos) || !ambitos.includes('dimitri')) return null;
  const n = await hayCorriendo(db);
  return n > 0 ? { error: `Hay ${n === 1 ? 'una serie generando o con un paso en el aire' : n + ' series generando o con un paso en el aire'}: espera a que termine ${n === 1 ? 'ese paso' : 'esos pasos'} (o pausa la serie y vuelve a intentarlo) antes de restablecer a Dimitri; lo que lleva gastado no se borra del libro, pero la serie sí.`, status: 409 } : null;
}

export async function pedirRestablecer(env, db, pedido, { ahora = Date.now() } = {}) {
  const v = validarPedido(pedido); if (!v.ok) return { error: v.error, status: 400 };
  const gen = await guardiaSeries(db, v.ambitos); if (gen) return gen; // una serie generando no se borra: se pausa primero
  const m = await manifiesto(env);
  if (v.modo === 'panaclaw' && !m) return { error: 'Esta instalación no trae la semilla de fábrica: «PanaClaw por defecto» no está disponible aquí.', status: 409 };
  const cuentas = await cuentasDe(db), paso = nuevoPaso(v, ahora);
  await guardarDoc(db, DOC_PASO, paso);
  return { pendiente: { token: paso.token, vence: paso.vence, modo: v.modo, ambitos: v.ambitos, resumen: resumenDePedido({ modo: v.modo, ambitos: v.ambitos, cuentas, semilla: m }) } };
}

/** Paso 2: comprueba la clave y la palabra, guarda el respaldo y restablece. → { ok, respaldo, hecho } o { error, status } */
export async function confirmarRestablecer(env, db, { token, escribio }, { quien = '', ahora = Date.now() } = {}) {
  const guardado = (await leerDoc(db, DOC_PASO, null)).valor;
  const motivo = verificarPaso(guardado, { token, escribio }, ahora); if (motivo) return { error: motivo, status: 409 };
  const gen = await guardiaSeries(db, guardado.ambitos); if (gen) return gen; // ANTES de gastar la clave: se pausa la serie y se vuelve a confirmar con la misma
  // la clave es de UN solo uso: la quita quien llegue primero; el que llegue después no hace nada (y repetir la petición no restablece dos veces)
  const quitada = await db.prepare('delete from docs where clave = ? and json = ?').bind(DOC_PASO, JSON.stringify(guardado)).run();
  if (!quitada.meta?.changes) return { error: 'Esa confirmación ya se usó.', status: 409 };
  const { modo, ambitos } = guardado;
  const m = await manifiesto(env);
  if (modo === 'panaclaw' && !m) return { error: 'Esta instalación no trae la semilla de fábrica.', status: 409 };
  let fabrica; try { fabrica = await sentenciasDeFabrica(env, db, modo, ambitos, ahora); } // se arma ANTES de tocar nada: si falta la semilla, no se quitó nada
  catch (e) { return { error: String(e?.message || e), status: 409 }; }
  const respaldo = await crearRespaldo(env, db, { modo, ambitos, ahora, quien });
  if (respaldo.error) return respaldo;
  try { await db.batch([...sentenciasDeQuitar(db, ambitos), ...fabrica]); } // un lote: atómico (D1 lo ejecuta como una transacción: o pasa todo o no pasa nada)
  catch (e) { console.error('[restablecer]', e?.message ?? e); return { error: 'No se pudo restablecer y no cambió nada. El respaldo se guardó igual. Inténtalo otra vez.', status: 500 }; }
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date(ahora).toISOString(), 'restablecer', quien, JSON.stringify({ modo, ambitos, respaldo: respaldo.id })).run();
  await avisar(db, { kind: 'restablecer', level: 'warn', text: `${quien || 'Un administrador'} restableció la oficina (${textoRespaldo(modo, ambitos)}). Hay un respaldo para deshacerlo hasta el ${new Date(respaldo.vence).toLocaleDateString('es-PA')}.` }, ahora).catch(() => {});
  return { ok: true, respaldo: { id: respaldo.id, vence: respaldo.vence }, hecho: resumenDePedido({ modo, ambitos, cuentas: {}, semilla: m }) };
}

/** Guarda lo que el pedido toca. → { id, vence } o { error } */
async function crearRespaldo(env, db, { modo, ambitos, ahora, quien }) {
  const v = await volcar(db, ambitos);
  const texto = JSON.stringify({ v: 1, modo, ambitos, at: ahora, ...v }); // sin el nombre de quien lo pidió: eso va en el registro y en la auditoría
  if (texto.length > TOPE_RESPALDO_BYTES) return { error: `Hay demasiado para respaldar de una vez (${(texto.length / 1048576).toFixed(0)} MB). Restablece menos cosas a la vez.`, status: 413 };
  const id = idRespaldo(ahora), almacen = await guardarArchivoRespaldo(env, db, id, texto);
  const filas = Object.values(v.tablas).reduce((a, x) => a + x.length, 0) + v.docs.length + v.filas.length;
  const reg = { id, at: ahora, vence: venceRespaldo(ahora), modo, ambitos, almacen: almacen.almacen, bytes: almacen.bytes, resumen: `${textoRespaldo(modo, ambitos)} · ${filas} registro(s)`, quien };
  let sobran = [];
  await mutarDoc(db, DOC_RESPALDOS, { lista: [] }, (d) => { const l = [reg, ...(d.lista || [])]; sobran = l.slice(TOPE_RESPALDOS); return { lista: l.slice(0, TOPE_RESPALDOS) }; });
  for (const r of sobran) await borrarArchivoRespaldo(env, db, r).catch(() => {});
  return reg;
}

/** Restaura un respaldo (guarda antes el estado de ahora, por si te arrepientes de restaurar). → { ok, resumen } o { error, status } */
export async function restaurarRespaldo(env, db, { id }, { quien = '', ahora = Date.now() } = {}) {
  const lista = (await leerDoc(db, DOC_RESPALDOS, { lista: [] })).valor.lista || [], r = lista.find((x) => x.id === id);
  if (!r) return { error: 'Ese respaldo ya no está.', status: 404 };
  if (r.vence < ahora) return { error: 'Ese respaldo ya venció.', status: 410 };
  const dump = await leerArchivoRespaldo(env, db, r); if (!dump) return { error: 'No encuentro el archivo de ese respaldo.', status: 404 };
  const gen = await guardiaSeries(db, dump.ambitos); if (gen) return gen;
  const previo = await crearRespaldo(env, db, { modo: r.modo, ambitos: dump.ambitos, ahora, quien }); if (previo.error) return previo;
  try { await db.batch([...sentenciasDeQuitar(db, dump.ambitos), ...sentenciasDeVolver(db, dump)]); }
  catch (e) { console.error('[restablecer]', e?.message ?? e); return { error: 'No se pudo restaurar y no cambió nada. Inténtalo otra vez.', status: 500 }; }
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date(ahora).toISOString(), 'restablecer-deshacer', quien, JSON.stringify({ respaldo: id, ambitos: dump.ambitos })).run();
  await avisar(db, { kind: 'restablecer', level: 'warn', text: `${quien || 'Un administrador'} restauró el respaldo del ${new Date(r.at).toLocaleString('es-PA')} (${r.resumen}).` }, ahora).catch(() => {});
  return { ok: true, resumen: r.resumen };
}

/** Cada hora: los respaldos vencidos se borran y, con ellos, los archivos del Estudio que ya nadie usa (se quedaron 7 días por si te arrepentías). */
export async function purgarVencidos(env, db, ahora = Date.now()) {
  const { valor } = await leerDoc(db, DOC_RESPALDOS, { lista: [] });
  const vencidos = (valor.lista || []).filter((r) => r.vence <= ahora); if (!vencidos.length) return 0;
  for (const r of vencidos) {
    try {
      const dump = await leerArchivoRespaldo(env, db, r), claves = (dump?.tablas?.estudio_archivos || []).map((x) => x.file).filter(Boolean);
      for (let i = 0; i < claves.length && env.MEDIA?.delete; i += 200) {
        const lote = claves.slice(i, i + 200), vivas = new Set((await db.prepare(`select file from estudio_archivos where file in (${marcas(lote.length)})`).bind(...lote).all()).results.map((x) => x.file));
        const borrar = lote.filter((k) => !vivas.has(k)); if (borrar.length) await env.MEDIA.delete(borrar);
      }
      await borrarArchivoRespaldo(env, db, r);
    } catch (e) { console.error('[restablecer] purga:', e?.message ?? e); }
  }
  await mutarDoc(db, DOC_RESPALDOS, { lista: [] }, (d) => ({ lista: (d.lista || []).filter((r) => r.vence > ahora) }));
  return vencidos.length;
}
export { IDS_AMBITOS };
