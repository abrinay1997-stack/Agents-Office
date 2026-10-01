// Agents Office V4.10 (1 oct 2026, auditoría CON-05/13) — la COLA de lo que sale, en puro (sin DOM, con tests en tests/contenido-cola.test.mjs):
// cuándo sale una pieza, cuánto falta, si pisa a otra, cuál es el siguiente día libre y qué pide una acción del dueño.
// Lo usan la Programación (src/contenido.js) y el panel de la pieza (src/pieza.js).
import { revisarMomento } from './contenido-reglas.js';

const DIA = 864e5;
const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** El momento de una pieza en ms (el reloj de esta máquina). Sin hora, el principio del día; sin día, null. */
export function momentoDe(p) {
  if (!p?.fecha) return null;
  const [h, m] = (p.hora || '00:00').split(':').map(Number);
  return new Date(`${p.fecha}T00:00:00`).setHours(h, m, 0, 0);
}

/** «sale en 3 h», «sale en 2 días», «hace 40 min»: lo que la cola dice junto a cada pieza. */
export function cuentaAtras(ms, ahora = Date.now()) {
  const d = ms - ahora, abs = Math.abs(d), min = Math.round(abs / 60000), h = Math.round(abs / 3600000), dias = Math.round(abs / DIA);
  const t = min < 60 ? `${Math.max(1, min)} min` : h < 24 ? `${h} h` : `${dias} ${dias === 1 ? 'día' : 'días'}`;
  return d >= 0 ? `sale en ${t}` : `hace ${t}`;
}

/** Otra pieza que sale a la MISMA hora del mismo día en alguna de las mismas redes (dos publicaciones pisándose). */
export function choqueDe(p, otras = []) {
  if (!p?.fecha || !p?.hora) return null;
  return otras.find(o => o.id !== p.id && o.fecha === p.fecha && o.hora === p.hora && (o.redes || []).some(r => (p.redes || []).includes(r))) || null;
}

/** El siguiente día (desde mañana) sin ninguna pieza en esas redes: el «hueco» de Buffer o Later. → 'AAAA-MM-DD' */
export function siguienteHueco(redes = ['instagram'], otras = [], ahora = Date.now(), dias = 60) {
  const ocupado = new Set(otras.filter(o => o.fecha && (o.redes || []).some(r => redes.includes(r))).map(o => o.fecha));
  const d = new Date(ahora); d.setHours(12, 0, 0, 0);
  for (let i = 1; i <= dias; i++) { d.setDate(d.getDate() + 1); const k = ymd(d); if (!ocupado.has(k)) return k; }
  const m = new Date(ahora); m.setDate(m.getDate() + 1); return ymd(m);
}

/** ¿Pasó su hora sin salir? Una aprobada o por revisar con día y hora ya pasados (hasta F3 nada publica solo: hay que moverla). */
export const vencida = (p, ahora = Date.now()) => (p.estado === 'aprobada' || p.estado === 'revision') && !!p.fecha && !!p.hora && momentoDe(p) < ahora;

/**
 * Lo que pide una acción del dueño, con el porqué, en el orden en que sale: vencidas, cambiadas tras aprobarlas, por revisar, aprobadas sin hora.
 * → [{ pieza, motivo, puede }] (`puede`: se puede aprobar ya)
 */
export function requiereAccion(piezas = [], ahora = Date.now()) {
  const hoy = ymd(new Date(ahora)), out = [];
  for (const p of [...piezas].filter(p => p.fecha).sort((a, b) => momentoDe(a) - momentoDe(b))) {
    const errores = p.revision?.errores || [];
    const puede = p.estado === 'revision' && !errores.length && !revisarMomento(p.fecha, p.hora, ahora).errores.length;
    if (vencida(p, ahora)) out.push({ pieza: p, puede: false, motivo: p.estado === 'aprobada' ? 'Vencida: su hora pasó y no salió (la publicación automática llega al conectar Meta). Cámbiale el día.' : 'Su hora ya pasó sin aprobarla: cámbiale el día.' });
    else if (p.fecha < hoy) continue;
    else if (p.cambiadaTrasAprobar) out.push({ pieza: p, puede: false, motivo: 'Cambió después de aprobarla: vuelve a aprobarla.' });
    else if (p.estado === 'revision') out.push({ pieza: p, puede, motivo: errores.length ? '' : !p.hora ? 'Ponle una hora para poder aprobarla.' : 'Lista para tu visto bueno.' });
    else if (p.estado === 'aprobada' && !p.hora) out.push({ pieza: p, puede: false, motivo: 'Aprobada sin hora: ponle una.' });
  }
  return out;
}

/** Los próximos `n` días con lo que sale cada uno (los vacíos también: son huecos), más los días posteriores que tengan algo. → [[día, [piezas]]] */
export function colaPorDia(piezas = [], ahora = Date.now(), n = 14) {
  const hoy = new Date(ahora); hoy.setHours(12, 0, 0, 0);
  const dias = new Map(); for (let i = 0; i < n; i++) { const d = new Date(hoy); d.setDate(d.getDate() + i); dias.set(ymd(d), []); }
  const desde = ymd(new Date(ahora));
  for (const p of [...piezas].filter(p => p.fecha && p.fecha >= desde).sort((a, b) => momentoDe(a) - momentoDe(b))) { if (!dias.has(p.fecha)) dias.set(p.fecha, []); dias.get(p.fecha).push(p); }
  return [...dias.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Los próximos días para elegir con un clic en el panel, en vez de bajar por 120 opciones (CON-13): hoy, mañana y los siguientes,
 * cada uno con cuántas piezas ya salen ese día en esas redes (para ver de un vistazo qué día está libre). → [{ fecha, corto, largo, n }]
 */
export function diasRapidos(redes = [], otras = [], { ahora = Date.now(), dias = 7, excluir = '' } = {}) {
  const DOWC = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], out = [];
  const t0 = new Date(ahora); t0.setHours(0, 0, 0, 0);
  for (let i = 0; i < dias; i++) {
    const d = new Date(t0); d.setDate(d.getDate() + i); const f = ymd(d);
    const n = otras.filter(o => o.id !== excluir && o.fecha === f && o.estado !== 'idea' && (o.redes || []).some(r => redes.includes(r))).length;
    const corto = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${DOWC[d.getDay()]} ${d.getDate()}`;
    out.push({ fecha: f, corto, largo: `${i === 0 ? 'hoy, ' : i === 1 ? 'mañana, ' : ''}${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()]} ${d.getDate()}`, n });
  }
  return out;
}

/** Por qué no se puede llevar una pieza a ese día y esa hora (soltar o Mayús + flecha), o null si se puede.
 *  Un día anterior a hoy: «Ese día ya pasó». Hoy con una hora ya pasada: «Esa hora ya pasó». Sin hora solo cuenta el día:
 *  una pieza sin hora se guarda sin hora (no se le inventa un 09:00 para decir que «ya pasó»). */
export function motivoPasado(fecha, hora = '', ahora = Date.now()) {
  if (!fecha) return null;
  const hoy = ymd(new Date(ahora));
  if (fecha < hoy) return 'Ese día ya pasó: elige uno que venga.';
  if (hora && fecha === hoy && momentoDe({ fecha, hora }) < ahora) return 'Esa hora ya pasó: elige una más tarde.';
  return null;
}

/** DESHACER de mover una pieza aprobada: la devuelve a su día y su hora y la vuelve a aprobar. Si volver a aprobar falla
 *  (p. ej. ya no quedan 10 min hasta su hora), no se calla: el aviso lo dice y va marcado como error.
 *  `datos` es el de crearDatos (patch, approve). → { pieza, aviso, mal } */
export async function deshacerMover(datos, id, antes) {
  const b = await datos.patch(id, antes);
  try { const a = await datos.approve(id); return { pieza: a.pieza, aviso: 'Deshecho: vuelve a su fecha y sigue aprobada.', mal: false }; }
  catch (e) { return { pieza: b.pieza, aviso: `Vuelta a su fecha, pero no se pudo volver a aprobar: ${e.message || e}`, mal: true }; }
}
