// N0 (Fase 8): notificaciones POR PERSONA, como proyección ADICIONAL de los avisos de la oficina (lib/avisos.js). No reemplaza a `filas('avisos')` ni al doc `notices`
// (el semáforo y Dimitri siguen leyendo lo global; el `read` global y `st.avisosIds` no se tocan). Apagado por defecto: doc `notificaciones.config`.
//   activo ................ enciende la proyección (un administrador, POST /api/notificaciones/config)
//   lecturaVeResultados ... SEG-04 (SUPUESTO del plan, a confirmar por el dueño): por defecto `lectura` ve tareas y calendario, NO resultados de agentes, Cerebro interno ni anuncios.
// Qué categoría ve cada rol (D05): lectura solo notas, menciones, chat y tareas; editor además contenido y fallos de agentes, sin gasto (anuncios) ni Bandeja; admin todo.
// Un aviso que falla al proyectarse NUNCA tumba la acción que lo provocó (emitirAvisos lo atrapa).
import { leerDoc, guardarDoc } from './almacen.js';
import { claveNombre } from './equipo.js';
import { nombrePorCorreo } from './sesion.js';

export const DOC_CONFIG = 'notificaciones.config';
export const CATEGORIAS = ['notas', 'chat', 'menciones', 'aprobaciones', 'tareas', 'contenido', 'agentes', 'anuncios', 'bandeja', 'sistema'];
const BASE_LECTURA = ['notas', 'chat', 'menciones', 'tareas'];
export const POR_ROL = Object.freeze({
  admin: CATEGORIAS,
  editor: [...BASE_LECTURA, 'contenido', 'agentes'],
  lectura: BASE_LECTURA,
});
// kind del aviso → categoría. Lo que no se reconoce es 'sistema' (solo administradores): ante la duda, se avisa a menos gente.
const CATEGORIA_DE_KIND = Object.freeze({
  persona: 'tareas', limite: 'tareas', proyecto: 'tareas', late: 'tareas', handoff: 'tareas', mention: 'menciones',
  remind: 'aprobaciones', expired: 'aprobaciones', 'espera-ok': 'aprobaciones', 'approval-void': 'aprobaciones', 'budget-hold': 'aprobaciones',
  failed: 'agentes', limit: 'agentes', login: 'agentes', budget: 'agentes', 'envio-incierto': 'agentes', fatal: 'agentes', missed: 'agentes',
  anuncios: 'anuncios', contenido: 'contenido',
});
// Avisos globales (sin `persona`) que, aunque su categoría la vea un rol bajo, son de la oficina entera y solo le tocan a administradores.
const SOLO_ADMIN = new Set(['mention', 'remind', 'expired', 'espera-ok', 'approval-void', 'budget-hold', 'budget', 'login', 'envio-incierto']);
export const TOPE_TITULO = 240;

export function categoriaDe(aviso) {
  if (aviso?.categoria && CATEGORIAS.includes(aviso.categoria)) return aviso.categoria;
  if (aviso?.kind === 'contenido' && /^bandeja/.test(String(aviso.key || ''))) return 'bandeja';
  return CATEGORIA_DE_KIND[aviso?.kind] || 'sistema';
}

export const leerConfig = async (db) => ({ activo: false, lecturaVeResultados: false, ...((await leerDoc(db, DOC_CONFIG, {})).valor || {}) });
export async function guardarConfig(db, cambios) {
  const actual = await leerConfig(db), nueva = { activo: actual.activo === true, lecturaVeResultados: actual.lecturaVeResultados === true };
  for (const k of ['activo', 'lecturaVeResultados']) if (typeof cambios?.[k] === 'boolean') nueva[k] = cambios[k];
  await guardarDoc(db, DOC_CONFIG, nueva);
  return nueva;
}

/** ¿Este rol ve esta categoría? (con el supuesto SEG-04 detrás de `lecturaVeResultados`). */
export function veCategoria(rol, categoria, cfg = {}) {
  if ((POR_ROL[rol] || []).includes(categoria)) return true;
  return rol === 'lectura' && cfg.lecturaVeResultados === true && ['agentes', 'contenido'].includes(categoria);
}

async function personasActivas(db) {
  const { results } = await db.prepare('select u.id, u.email, u.rol, p.nombre from users u left join perfiles p on p.user_id = u.id where p.baja_at is null').all();
  return results.map((f) => ({ id: f.id, rol: f.rol, clave: claveNombre((f.nombre || '').trim() || nombrePorCorreo(f.email)) }));
}

/** A quién le toca un aviso. `aviso.persona` (un nombre) lo dirige a esa cuenta; sin él, a todos los roles que ven su categoría. Nunca al causante. → [{id, rol}] */
export function destinatarios(aviso, personas, cfg = {}, { causanteId = null } = {}) {
  const cat = categoriaDe(aviso);
  let lista;
  if (aviso.persona) { const k = claveNombre(aviso.persona); lista = personas.filter((p) => p.clave === k); }
  else lista = personas.filter((p) => !SOLO_ADMIN.has(aviso.kind) || p.rol === 'admin');
  const quien = causanteId || aviso.causanteId || null;
  return lista.filter((p) => p.id !== quien && veCategoria(p.rol, cat, cfg));
}

const enlaceDe = (a) => (a.task ? `tarea:${String(a.task).slice(0, 80)}` : null);

/** Escribe la proyección de los avisos recién emitidos. → cuántas notificaciones nuevas. Atrapa sus errores (un aviso no tumba nada). */
export async function proyectar(db, avisos, { ahora = Date.now(), cfg = null } = {}) {
  try {
    const c = cfg || await leerConfig(db);
    if (!c.activo || !avisos?.length) return 0;
    const personas = await personasActivas(db);
    const sentencias = [];
    for (const a of avisos) for (const p of destinatarios(a, personas, c)) {
      sentencias.push(db.prepare('insert into notificaciones (id, user_id, aviso_id, categoria, nivel, titulo, enlace, clave_dedupe, causante_id, creada_at) values (?,?,?,?,?,?,?,?,?,?) on conflict (user_id, aviso_id) do nothing')
        .bind(`${a.id}.${p.id.slice(0, 8)}`, p.id, a.id, categoriaDe(a), ['info', 'warn', 'error'].includes(a.level) ? a.level : 'info', String(a.text ?? '').slice(0, TOPE_TITULO), enlaceDe(a), a.key ? String(a.key).slice(0, 120) : null, a.causanteId || null, a.t ?? ahora));
    }
    for (let i = 0; i < sentencias.length; i += 50) await db.batch(sentencias.slice(i, i + 50));
    return sentencias.length;
  } catch (e) { console.error('[notificaciones] no se pudo proyectar:', e?.message ?? e); return 0; }
}

/** Lo de UNA persona: el contador del no leído y los últimos. Solo filas de `userId`. */
export async function listar(db, userId, { limite = 30, soloNoLeidas = false } = {}) {
  const n = Math.min(Math.max(parseInt(limite, 10) || 30, 1), 100);
  const { results } = await db.prepare(`select id, categoria, nivel, titulo, enlace, creada_at, leida_at from notificaciones where user_id = ?${soloNoLeidas ? ' and leida_at is null' : ''} order by creada_at desc, id desc limit ?`).bind(userId, n).all();
  const noLeidas = (await db.prepare('select count(*) n from notificaciones where user_id = ? and leida_at is null').bind(userId).first())?.n ?? 0;
  return { noLeidas, items: results.map((r) => ({ id: r.id, categoria: r.categoria, nivel: r.nivel, titulo: r.titulo, enlace: r.enlace, t: r.creada_at, leida: r.leida_at != null })) };
}

/** Marca leídas SOLO las de esta persona. `ids` = lista (como mucho 50) o `todas`. → { marcadas } o null si un id suelto no es suyo. */
export async function marcarLeidas(db, userId, { id = null, ids = null, todas = false }, ahora = Date.now()) {
  if (todas) { const r = await db.prepare('update notificaciones set leida_at = ? where user_id = ? and leida_at is null').bind(ahora, userId).run(); return { marcadas: r.meta?.changes ?? 0 }; }
  const lista = [...new Set((id ? [id] : Array.isArray(ids) ? ids : []).map((x) => String(x)).filter(Boolean))].slice(0, 50);
  if (!lista.length) return { marcadas: 0 };
  const suyas = (await db.prepare(`select id from notificaciones where user_id = ? and id in (${lista.map(() => '?').join(',')})`).bind(userId, ...lista).all()).results.map((r) => r.id);
  if (id && !suyas.length) return null; // un id ajeno o inexistente es lo mismo: 404
  if (!suyas.length) return { marcadas: 0 };
  const r = await db.prepare(`update notificaciones set leida_at = ? where user_id = ? and leida_at is null and id in (${suyas.map(() => '?').join(',')})`).bind(ahora, userId, ...suyas).run();
  return { marcadas: r.meta?.changes ?? 0 };
}
