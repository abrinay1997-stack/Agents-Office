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
