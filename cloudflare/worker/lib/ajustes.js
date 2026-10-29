// Ajustes en la nube (fase 6). En la oficina local son office.config.json (lo del equipo) + office.config.local.json (lo de esta máquina, que gana), y la pestaña
// Ajustes escribe en el segundo. Aquí son documentos de D1 (`docs`), con la MISMA forma que el JSON de la configuración:
//   'config' · 'tareas.config' · 'anuncios.ajustes' — lo que subió la migración (el equivalente de office.config.json); se leen y no se escriben desde Ajustes.
//   'ajustes'      — LO QUE ESCRIBE Ajustes. Es el que leen Tareas, Agentes y Costos (lib/tareas/contexto.js).
//   'config-local' — el mismo contenido que 'ajustes' (lo lee Anuncios, que ya lo esperaba con ese nombre). Se escriben JUNTOS, nunca por separado.
//   'config.contenido' y 'estudio.config' — los ajustes propios de Contenido y del Estudio (cada módulo ya los lee de ahí): los campos `contenido.*` y `media.*` de Ajustes van allí.
// Las definiciones de los campos (qué se puede cambiar, sus límites, sus textos) son las de settings.mjs: las mismas de la oficina local, sin copiar.
//
// REGLAS (los tests las muerden):
//  · NINGÚN secreto pasa por aquí: Ajustes no tiene campos de llaves y un cambio con pinta de llave (o de ruta que no está en la lista) se rechaza; las llaves son secretos del Worker.
//  · Solo un administrador escribe (lo comprueba el módulo).
//  · Un cambio que toca `approvals.*`, `costs.*`… conserva lo demás de ese grupo que subió la migración (la mezcla de documentos es de un solo nivel: sin esto, cambiar «segundos para deshacer»
//    se llevaría puesto el tope de importe que ya había).
import { FIELDS, GROUPS, clean, get, set } from '../../../settings.mjs';
import { leerDoc, guardarDoc, mutarDoc } from './almacen.js';
import * as cont from './contenido/config.js';
import * as estudio from './estudio/entorno.js';

export const DOCS_BASE = ['tareas.config', 'anuncios.ajustes', 'config'];
export const DOC_AJUSTES = 'ajustes', DOC_LOCAL = 'config-local';

const objeto = (v) => v && typeof v === 'object' && !Array.isArray(v);
/** Mezcla profunda: lo de `b` gana. Las listas se reemplazan enteras. */
export function unir(a, b) {
  if (!objeto(b)) return b === undefined ? a : b;
  const o = { ...(objeto(a) ? a : {}) };
  for (const [k, v] of Object.entries(b)) o[k] = unir(o[k], v);
  return o;
}

/** Varios documentos en UNA consulta: { clave: valor }. */
async function leerVarios(db, claves) {
  const { results } = await db.prepare(`select clave, json from docs where clave in (${claves.map(() => '?').join(',')})`).bind(...claves).all();
  const o = {};
  for (const r of results) { try { o[r.clave] = JSON.parse(r.json); } catch { /* un documento roto es uno que no está */ } }
  return o;
}

/** Lo de la migración (el office.config.json del equipo), sin lo que escribió Ajustes. */
export async function leerBase(db) {
  const d = await leerVarios(db, DOCS_BASE);
  return unir(unir(d['tareas.config'] ?? {}, d['anuncios.ajustes'] ?? {}), d.config ?? {});
}

/** La configuración que ve toda la oficina: la base, encima lo que escribió Ajustes, y los dos módulos con ajustes propios. */
export async function leerCfg(db) {
  const d = await leerVarios(db, [...DOCS_BASE, DOC_AJUSTES, DOC_LOCAL]);
  let cfg = unir(unir(unir(d['tareas.config'] ?? {}, d['anuncios.ajustes'] ?? {}), d.config ?? {}), unir(d[DOC_LOCAL] ?? {}, d[DOC_AJUSTES] ?? {}));
  // `telegram.approvers` es de REEMPLAZO, no de mezcla: quitar a un aprobador tiene que funcionar aunque la base migrada todavía lo traiga
  for (const [clave, vale] of [['approvers', objeto], ['admins', objeto]]) for (const doc of [d[DOC_AJUSTES], d[DOC_LOCAL]]) { const a = doc?.telegram?.[clave]; if (vale(a)) { cfg.telegram = { ...(cfg.telegram || {}), [clave]: Array.isArray(a) ? [...a] : { ...a } }; break; } } // de REEMPLAZO
  const c = await cont.leerConfig(db), e = await estudio.leerConfig(db);
  cfg = unir(cfg, {
    contenido: { modo: c.modo, conductor: c.conductor, entregarHorasAntes: c.entregarHorasAntes, redes: c.redes, bandejaFuente: c.bandejaFuente, departments: c.departamentos },
    media: Object.fromEntries(['dailyLimit', 'dailyBudget', 'monthlyBudget', 'maxPerRequest', 'concurrency'].filter((k) => e[k] !== undefined).map((k) => [k, e[k]])),
  });
  if (!cfg.name) cfg.name = 'PanaClaw'; // el nombre de la oficina que se ve mientras nadie ponga otro
  return cfg;
}

/** Los valores del formulario, uno por campo. */
export const valoresDe = (cfg) => Object.fromEntries(FIELDS.map((f) => [f.path, get(cfg, f.path)]));

// Lo que NUNCA puede entrar por Ajustes aunque alguien invente una ruta: el nombre de algo que guarda una llave.
const PINTA_DE_SECRETO = /(token|secret|secreto|api[-_]?key|apikey|passw|contrase|clave|credential|bearer|authorization)/i;
const NO_ES_SECRETO = ['hooks.tokenEnQuery']; // un interruptor (sí/no) que solo lleva «token» en el nombre: no guarda ni muestra ningún secreto
export const esSecreto = (ruta) => !NO_ES_SECRETO.includes(String(ruta)) && PINTA_DE_SECRETO.test(String(ruta));

// Los campos de `contenido.*` y de `media.*` se guardan donde cada módulo los lee.
const CONTENIDO_CLAVE = { 'contenido.modo': 'modo', 'contenido.conductor': 'conductor', 'contenido.redes': 'redes', 'contenido.entregarHorasAntes': 'entregarHorasAntes', 'contenido.bandejaFuente': 'bandejaFuente', 'contenido.departments': 'departamentos' };
const MEDIA_CLAVE = { 'media.dailyLimit': 'dailyLimit', 'media.dailyBudget': 'dailyBudget', 'media.monthlyBudget': 'monthlyBudget', 'media.maxPerRequest': 'maxPerRequest', 'media.concurrency': 'concurrency' };

/** Pone `ruta` = valor en `local`, guardando antes lo que la base ya tenía en ese grupo (ver la regla de arriba). */
function ponerConBase(local, base, ruta, valor) {
  const k = ruta.split('.')[0];
  if (ruta.includes('.') && objeto(base?.[k])) {
    const antes = objeto(local[k]) ? local[k] : {}, unido = unir(base[k], antes);
    // Quién aprueba o administra por Telegram se REEMPLAZA, no se mezcla: lo revocado no resucita al guardar otro ajuste (la base solo lo trae la primera vez).
    for (const q of ['approvers', 'admins']) if (Object.prototype.hasOwnProperty.call(antes, q)) unido[q] = antes[q];
    local[k] = unido;
  }
  set(local, ruta, valor);
}

/**
 * Valida y guarda un grupo de cambios { 'ruta': valor }. → { ok, errors: [texto], restart: false, guardados: [ruta] }.
 * En la nube todo se aplica al instante: ningún campo pide reiniciar (`restart` siempre false).
 */
export async function guardarCambios(db, cambios, { quien = 'alguien' } = {}) {
  const errors = [], buenos = {};
  const entradas = Object.entries(cambios && typeof cambios === 'object' && !Array.isArray(cambios) ? cambios : {});
  for (const [p, v] of entradas) {
    const f = FIELDS.find((x) => x.path === p);
    if (!f || esSecreto(p)) { errors.push(`«${String(p).slice(0, 60)}» no se puede cambiar desde aquí`); continue; }
    const r = clean(f, v); if (r.error) { errors.push(r.error); continue; }
    buenos[p] = r.value;
  }
  const rutas = Object.keys(buenos);
  if (!rutas.length) return { ok: true, errors, restart: false, guardados: [] };

  const generales = rutas.filter((p) => !(p in CONTENIDO_CLAVE) && !(p in MEDIA_CLAVE));
  // Contenido: lo valida SU módulo (completar/validarCambio) y lo guarda donde él lo lee.
  const pc = rutas.filter((p) => p in CONTENIDO_CLAVE);
  if (pc.length) {
    const cambio = Object.fromEntries(pc.map((p) => [CONTENIDO_CLAVE[p], buenos[p]]));
    const v = cont.validarCambio(cambio, await cont.leerConfig(db));
    if (!v.ok) errors.push(v.error); else await cont.guardarConfig(db, v.valor);
  }
  // Estudio: sus topes (validarConfig) a su documento.
  const pm = rutas.filter((p) => p in MEDIA_CLAVE);
  if (pm.length) {
    const v = estudio.validarConfig(Object.fromEntries(pm.map((p) => [MEDIA_CLAVE[p], buenos[p]])));
    if (!v.ok) errors.push(v.error); else await estudio.guardarConfig(db, v.valor);
  }
  if (generales.length) {
    const base = await leerBase(db);
    const aplicar = (doc) => { const local = objeto(doc) ? JSON.parse(JSON.stringify(doc)) : {}; for (const p of generales) ponerConBase(local, base, p, buenos[p]); return local; };
    await mutarDoc(db, DOC_AJUSTES, {}, aplicar);
    await mutarDoc(db, DOC_LOCAL, {}, aplicar); // el espejo que lee Anuncios: mismos valores, mismas rutas
  }
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'ajustes', String(quien).slice(0, 120), JSON.stringify({ cambia: rutas })).run();
  return { ok: true, errors, restart: false, guardados: rutas };
}

const DEPTS_APROBADOR = ['emails', 'sales', 'marketing', 'ops', 'fin', 'delivery'];
/** Quién aprueba por Telegram solo lo de algunos departamentos: { "<id numérico de Telegram>": ["emails","sales"] }. No es un campo del formulario (es una lista corta de ids), pero se guarda igual que los demás. */
export async function guardarAprobadores(db, aprobadores, { quien = 'alguien' } = {}) {
  if (!aprobadores || typeof aprobadores !== 'object' || Array.isArray(aprobadores)) return { error: 'manda { approvers: { "<id de Telegram>": ["emails", "sales"] } }' };
  const limpio = {};
  for (const [id, deptos] of Object.entries(aprobadores)) {
    if (!/^-?\d{4,15}$/.test(id)) return { error: `«${String(id).slice(0, 20)}» no es un id de Telegram (un número; pídeselo a @userinfobot)` };
    if (!Array.isArray(deptos) || deptos.some((d) => !DEPTS_APROBADOR.includes(d))) return { error: `los departamentos de ${id} son una lista de: ${DEPTS_APROBADOR.join(', ')}` };
    if (deptos.length) limpio[id] = [...new Set(deptos)];
  }
  const aplicar = (doc) => { const local = objeto(doc) ? JSON.parse(JSON.stringify(doc)) : {}; local.telegram = { ...(objeto(local.telegram) ? local.telegram : {}), approvers: limpio }; return local; };
  await mutarDoc(db, DOC_AJUSTES, {}, aplicar); await mutarDoc(db, DOC_LOCAL, {}, aplicar);
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'ajustes', String(quien).slice(0, 120), JSON.stringify({ cambia: ['telegram.approvers'], aprobadores: Object.keys(limpio).length })).run();
  return { ok: true, approvers: limpio };
}

/** Los administradores que usan el bot además de TELEGRAM_OWNER_ID: { "<id de Telegram>": "<correo del administrador>" }. SOLO un administrador los registra o quita (la lista entera reemplaza a la anterior); el id lo da @userinfobot.
 *  Cada correo tiene que ser hoy un administrador; y se vuelve a comprobar en CADA mensaje (`lib/telegram.js` → idsAdmins): quien pierde el rol admin deja de poder usar el bot. */
export async function guardarAdmins(db, admins, { quien = 'alguien' } = {}) {
  if (!objeto(admins) || Object.keys(admins).length > 10) return { error: 'manda { admins: { "<id de Telegram>": "<correo del administrador>" } } (hasta 10)' };
  const limpio = {};
  for (const [id, correo] of Object.entries(admins)) {
    if (!/^\d{4,15}$/.test(id)) return { error: `«${id.slice(0, 20)}» no es un id de Telegram (un número; pídeselo a @userinfobot)` };
    const u = await db.prepare('select rol from users where email = ?').bind(String(correo || '').toLowerCase().trim()).first();
    if (u?.rol !== 'admin') return { error: `«${String(correo || '').slice(0, 60)}» no es un administrador de esta oficina` };
    limpio[id] = String(correo).toLowerCase().trim();
  }
  const aplicar = (doc) => { const local = objeto(doc) ? JSON.parse(JSON.stringify(doc)) : {}; local.telegram = { ...(objeto(local.telegram) ? local.telegram : {}), admins: limpio }; return local; };
  await mutarDoc(db, DOC_AJUSTES, {}, aplicar); await mutarDoc(db, DOC_LOCAL, {}, aplicar);
  await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(new Date().toISOString(), 'ajustes', String(quien).slice(0, 120), JSON.stringify({ cambia: ['telegram.admins'], n: Object.keys(limpio).length })).run();
  return { ok: true, admins: limpio };
}

export { GROUPS, FIELDS };
export const leerDocAjustes = (db) => leerDoc(db, DOC_AJUSTES, {});
export const guardarDocAjustes = (db, v) => guardarDoc(db, DOC_AJUSTES, v);
