// Las skills de los agentes en la nube, editables (GET/PUT/DELETE /api/skills…). Viven en `filas/skills` (una fila por skill, la forma que leen los agentes:
// agentes/contexto.js → skillsDe, salud.js, dimitri). Las reglas (topes, extensiones, cabecera) son las de la oficina local: skills-core.mjs, puro y compartido.
//  · papelera: `filas/skills-papelera` (30 días, id «nombre:<ms>»); nada se borra de verdad antes.
//  · historial: `filas/skills-historial` (id «nombre:<ms>», las últimas 20 versiones de cada skill, con el SKILL.md entero).
// Una skill es una instrucción para un agente: lo que escribe una persona pasa por safety.injectionIn solo para AVISAR (una skill legítima puede
// hablar de «ignorar» un formato viejo; bloquearla sería peor). Los candados de envío (guardián, OK del dueño) no dependen de lo que diga una skill.
import { validarSkill, resumenSkill, armarMd, LIMITES_API } from '../../../skills-core.mjs';
import { injectionIn } from '../../../safety.mjs';
import { DEPT_KEYS } from '../../../src/data.js';
import { leerFila, guardarFila, borrarFila, listarFilas } from './almacen.js';
import { cargarRoster } from './tareas/roster.js';
import { ahora } from './ids.js';

export const COL = 'skills', PAPELERA = 'skills-papelera', HISTORIAL = 'skills-historial';
export const DIAS_PAPELERA = 30, MAX_VERSIONES = 20;
const pad = n => String(n).padStart(13, '0');
const NOMBRE_URL = /^[a-z0-9][a-z0-9._-]{0,59}$/;

async function ctxRoster(db) { const r = await cargarRoster(db); return { agentIds: r.agents.map(a => a.id), deptKeys: DEPT_KEYS }; }

async function auditar(db, quien, detalle) {
  try { await db.prepare('insert into auditoria (at, tipo, quien, detalle) values (?,?,?,?)').bind(ahora(), 'skill', String(quien || 'alguien').slice(0, 120), JSON.stringify(detalle)).run(); } catch { /* la auditoría no tumba un cambio ya hecho */ }
}
/** Las filas de una colección cuyo id empieza por «nombre:» (rango, sin LIKE: el guion bajo de un nombre es comodín). */
async function deNombre(db, col, nombre) {
  const { results } = await db.prepare('select id, json from filas where coleccion = ? and id >= ? and id < ? order by id desc limit 100').bind(col, nombre + ':', nombre + ';').all();
  return results.map(r => ({ id: r.id, ...JSON.parse(r.json) }));
}
/** Un instante libre para `nombre` en `col` (dos escrituras en el mismo milisegundo no se pisan: se corre uno). */
async function instanteLibre(db, col, nombre) { let at = Date.now(); while (await leerFila(db, col, `${nombre}:${pad(at)}`)) at++; return at; }
async function guardarVersion(db, valor, por, accion) {
  const at = await instanteLibre(db, HISTORIAL, valor.name);
  await guardarFila(db, HISTORIAL, `${valor.name}:${pad(at)}`, { name: valor.name, at, por, accion, md: armarMd(valor), valor });
  const todas = await deNombre(db, HISTORIAL, valor.name);
  for (const v of todas.slice(MAX_VERSIONES)) await borrarFila(db, HISTORIAL, v.id);
}
async function podarPapelera(db) {
  const corte = Date.now() - DIAS_PAPELERA * 864e5;
  const { results } = await db.prepare('select id, json from filas where coleccion = ? limit 200').bind(PAPELERA).all();
  for (const r of results) { let v; try { v = JSON.parse(r.json); } catch { v = {}; } if (!(v.borrada > corte)) await borrarFila(db, PAPELERA, r.id); }
}
function sospecha(v) { return injectionIn([v.description, v.text, ...(v.files || []).map(f => f.text)].join('\n')); }

/** La lista: nombre, descripción, a quién llega, tamaño y problemas. */
export async function listar(db) {
  const [skills, c] = await Promise.all([listarFilas(db, COL, { limite: 200 }), ctxRoster(db)]);
  return { skills: skills.filter(s => s && s.name).map(s => resumenSkill(s, c)), total: skills.length, tope: LIMITES_API.maxSkills };
}
/** Una skill entera: el texto, los archivos y su SKILL.md armado. */
export async function leer(db, nombre) {
  if (!NOMBRE_URL.test(nombre)) return { error: 'No existe esa skill.', status: 404 };
  const s = await leerFila(db, COL, nombre);
  if (!s) return { error: 'No existe esa skill.', status: 404 };
  const c = await ctxRoster(db);
  return { skill: { ...resumenSkill(s, c), text: s.text, files: s.files || [], md: armarMd(s), actualizado: s.actualizado || null } };
}
/** Crear o reemplazar. `base` (opcional) = el `actualizado` que leíste: si otra persona la cambió, 409 y no se pisa. */
export async function guardar(db, nombre, cuerpo, usuario) {
  const c = await ctxRoster(db);
  const v = validarSkill(nombre, cuerpo, c);
  if (!v.ok) return { error: v.errores[0], errores: v.errores, status: 422 };
  const antes = await leerFila(db, COL, nombre);
  if (!antes) { const n = (await db.prepare('select count(*) n from filas where coleccion = ?').bind(COL).first()).n; if (n >= LIMITES_API.maxSkills) return { error: `Ya hay ${n} skills (el tope es ${LIMITES_API.maxSkills}); borra alguna antes de crear otra.`, status: 409 }; }
  if (cuerpo && cuerpo.base !== undefined && antes && String(antes.actualizado || '') !== String(cuerpo.base)) return { error: 'Otra persona cambió esta skill mientras la editabas. Léela de nuevo y vuelve a intentarlo.', status: 409 };
  if (cuerpo && cuerpo.base !== undefined && !antes) return { error: 'Esa skill ya no existe (¿alguien la borró?).', status: 409 };
  const por = usuario?.email || usuario?.nombre || 'alguien';
  const valor = { ...v.valor, actualizado: new Date().toISOString() };
  if (antes) await guardarVersion(db, antes, por, 'antes de reemplazar'); // el historial guarda lo que había: volver atrás siempre se puede
  await guardarFila(db, COL, nombre, valor, 0);
  await guardarVersion(db, valor, por, antes ? 'reemplazada' : 'creada');
  const aviso = sospecha(valor), avisos = [...v.avisos];
  if (aviso) avisos.push(`Ojo: el texto parece pedir que un agente se salte sus reglas («${aviso}»). Se guardó, pero revísalo: nada de lo que diga una skill abre un envío, un pago ni un borrado sin tu OK.`);
  await auditar(db, por, { accion: antes ? 'reemplazar' : 'crear', skill: nombre, bytes: valor.text.length, archivos: valor.files.length, sospecha: aviso || undefined });
  return { ok: true, creada: !antes, skill: resumenSkill(valor, c), avisos };
}
/** A la papelera (30 días). → { ok, id } — el id sirve para DESHACER. */
export async function borrar(db, nombre, usuario) {
  if (!NOMBRE_URL.test(nombre)) return { error: 'No existe esa skill.', status: 404 };
  const s = await leerFila(db, COL, nombre);
  if (!s) return { error: 'No existe esa skill.', status: 404 };
  const por = usuario?.email || usuario?.nombre || 'alguien', at = await instanteLibre(db, PAPELERA, nombre), id = `${nombre}:${pad(at)}`;
  await guardarFila(db, PAPELERA, id, { name: nombre, borrada: at, por, valor: s });
  await guardarVersion(db, s, por, 'antes de borrar');
  await borrarFila(db, COL, nombre);
  await podarPapelera(db);
  await auditar(db, por, { accion: 'papelera', skill: nombre });
  return { ok: true, id, vuelve: `POST /api/skills/papelera/restaurar { id }`, dias: DIAS_PAPELERA };
}
export async function verPapelera(db) {
  await podarPapelera(db);
  const { results } = await db.prepare('select id, json from filas where coleccion = ? order by id desc limit 200').bind(PAPELERA).all();
  return { items: results.map(r => { const v = JSON.parse(r.json); return { id: r.id, name: v.name, at: v.borrada, por: v.por }; }), keepDays: DIAS_PAPELERA };
}
/** Saca una skill de la papelera. Si el nombre ya lo usa otra, no pisa: pide borrar o renombrar. */
export async function restaurar(db, id, usuario) {
  const v = typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{0,59}:\d{13}$/.test(id) ? await leerFila(db, PAPELERA, id) : null;
  if (!v) return { error: 'No está en la papelera (¿pasaron los 30 días?).', status: 404 };
  if (await leerFila(db, COL, v.name)) return { error: `Ya existe otra skill llamada «${v.name}»: bórrala o renómbrala antes de recuperar esta.`, status: 409 };
  await guardarFila(db, COL, v.name, { ...v.valor, actualizado: new Date().toISOString() }, 0);
  await borrarFila(db, PAPELERA, id);
  const por = usuario?.email || usuario?.nombre || 'alguien';
  await guardarVersion(db, v.valor, por, 'recuperada de la papelera');
  await auditar(db, por, { accion: 'restaurar', skill: v.name });
  return { ok: true, name: v.name };
}
/** Las versiones de una skill (la más nueva primero) y, con `at`, una entera. */
export async function versiones(db, nombre, at) {
  if (!NOMBRE_URL.test(nombre)) return { error: 'No existe esa skill.', status: 404 };
  const todas = await deNombre(db, HISTORIAL, nombre);
  if (at === undefined) return { name: nombre, versions: todas.map(v => ({ at: v.at, por: v.por, accion: v.accion, size: v.md.length, preview: v.md.replace(/^---[\s\S]*?---\s*/, '').slice(0, 160) })) };
  const v = todas.find(x => x.at === Number(at));
  return v ? { name: nombre, at: v.at, por: v.por, accion: v.accion, text: v.md } : { error: 'Esa versión no existe.', status: 404 };
}
/** Vuelve a una versión (guardando antes lo de ahora). Pasa por la misma validación: una versión que ya no cabe (un agente que se fue) no vuelve. */
export async function volver(db, nombre, at, usuario) {
  const r = await versiones(db, nombre, at);
  if (r.error) return r;
  const v = (await deNombre(db, HISTORIAL, nombre)).find(x => x.at === Number(at));
  return guardar(db, nombre, { md: r.text, files: v.valor.files || [], todos: v.valor.everyone === true }, usuario);
}
