// Agents Office (29 oct 2026, CON-08 / UX-04 / CON-15) — UNA sola manera de decir «Hoy», «Mañana» o «viernes 31 oct», en la zona de la oficina.
// Antes había cuatro generadores (`nombreDia` de tareas/dueno.mjs, `rel` de src/calendar-core.js y dos de src/contenido.js) con reglas
// distintas, y dos de ellos sumaban 24 h (más una hora «de colchón») a un instante para hallar «mañana»: el día del cambio de horario
// (24 o 25 h de largo) daba el día equivocado. Aquí el día se saca con `Intl.DateTimeFormat({ timeZone })` y «mañana» es aritmética de
// CALENDARIO sobre la fecha (no sobre milisegundos), así que el verano no la mueve. Puro, sin DOM: lo usan la página, el servidor y el
// Worker. Sin `zona`, la de este proceso (en el navegador, la del visitante; la oficina puede fijar la suya con `fijarZona`).
// Tests: tests/etiqueta-dia.test.mjs (matriz de zonas y cambios de horario).
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pad = n => String(n).padStart(2, '0');

let zonaOficina; // undefined = la de este proceso
/** La zona de la oficina (nombre IANA, p. ej. «America/Panama»); un nombre que Intl no conoce se ignora. */
export function fijarZona(nombre) { zonaOficina = zonaValida(nombre) ? nombre : undefined; return zonaOficina; }
export const zonaActual = () => zonaOficina;
export function zonaValida(z) { if (!z || typeof z !== 'string') return false; try { new Intl.DateTimeFormat('en', { timeZone: z }); return true; } catch { return false; } }

const fmts = new Map();
function formateador(zona) {
  const k = zona || ''; let f = fmts.get(k);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: zona || undefined, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); fmts.set(k, f); }
  return f;
}
/** Año, mes, día, hora y minuto de un instante en esa zona. */
export function partesEnZona(ms, zona = zonaOficina) {
  const o = {}; for (const p of formateador(zonaValida(zona) ? zona : undefined).formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute };
}
/** «AAAA-MM-DD» de un instante en esa zona. */
export function diaEnZona(ms, zona = zonaOficina) { const p = partesEnZona(ms, zona); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; }
/** Suma días de CALENDARIO a «AAAA-MM-DD» (nunca milisegundos: un día de cambio de horario no mide 24 h). */
export function sumarDias(fecha, n) { const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
/** Día de la semana (0 = domingo) de «AAAA-MM-DD». */
export const diaSemana = fecha => { const [y, m, d] = String(fecha).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** «hoy» · «manana» · «ayer» · null — de una fecha respecto a `ahora` en esa zona. */
export function relDia(fecha, ahora = Date.now(), zona = zonaOficina) {
  const f = String(fecha || '').slice(0, 10), hoy = diaEnZona(ahora, zona);
  return f === hoy ? 'hoy' : f === sumarDias(hoy, 1) ? 'manana' : f === sumarDias(hoy, -1) ? 'ayer' : null;
}

/**
 * La etiqueta de un día (y su hora, si la tiene), en la zona de la oficina.
 * @param {string} fecha «AAAA-MM-DD» (o «AAAA-MM-DDTHH:MM»: la hora se toma de ahí si `hora` no viene)
 * @param {string|null} hora «HH:MM» o vacío = sin hora
 * @param {number} ahora ms
 * @param {string} [zona] nombre IANA
 * @returns {{ rel: 'hoy'|'manana'|'ayer'|null, nombre: string, corto: string, hora: string|null, sinHora: boolean, texto: string }}
 *   nombre: «Hoy» · «Mañana» · «Ayer» · «viernes 31 oct» (lo que titula un grupo) · corto: «Hoy 31 oct» · «vie 1 nov» · texto: el corto + « · 14:30» o « · Sin hora».
 */
export function etiquetaDia(fecha, hora, ahora = Date.now(), zona = zonaOficina) {
  const f = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return { rel: null, nombre: 'Sin fecha', corto: 'Sin fecha', hora: null, sinHora: true, texto: 'Sin fecha' };
  const h = (hora || (String(fecha).length > 10 ? String(fecha).slice(11, 16) : '')) || null, hh = h && /^\d{2}:\d{2}$/.test(h) ? h : null;
  const rel = relDia(f, ahora, zona), [, m, d] = f.split('-').map(Number), dow = diaSemana(f);
  const fechaCorta = `${d} ${MESES[m - 1]}`, nombre = rel === 'hoy' ? 'Hoy' : rel === 'manana' ? 'Mañana' : rel === 'ayer' ? 'Ayer' : `${DIAS[dow]} ${fechaCorta}`;
  const corto = rel ? `${nombre} ${fechaCorta}` : `${DIAS[dow].slice(0, 3)} ${fechaCorta}`;
  return { rel, nombre, corto, hora: hh, sinHora: !hh, texto: `${corto} · ${hh || 'Sin hora'}` };
}
