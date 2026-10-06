// Agents Office (6 oct 2026, plan M3) — la MEJOR HORA para publicar. Puro: lo usan el servidor (contenido/mejor-hora.mjs, que junta las
// fuentes) y la página (el panel de la pieza y la semana de Contenido, que lo enseñan).
//
// Una fuente da, por red, una lista de { dia (0 = domingo), hora (0–23), valor } — Metricool con su «best time», o lo nuestro: las
// interacciones de lo ya publicado (Analíticas). `cuadricula()` las pasa a una tabla 7 × 24 de 0 a 100, la media de las redes elegidas
// (cada red normalizada a su máximo, para que una con más volumen no tape a otra). Con poco dato, nada: una sugerencia sacada de dos
// publicaciones es ruido con aspecto de consejo (la misma regla que horaSugerida en contenido-cifras.js).
//   cuadricula({ red: [{dia, hora, valor}] }) → number[7][24] | null
//   deLoPublicado(publicaciones, { red, minimo }) → [{dia, hora, valor}]
//   mejoresDelDia(grid, fecha, n) → [{ hora: 'HH:MM', valor }]
//   siguienteBuena(grid, { ahora, ocupadas, umbral, dias }) → { fecha, hora, valor } | null
//   nivel(grid, fecha, h) → 0 | 1 | 2   (para sombrear la semana: 2 = de lo mejor, 1 = buena)

export const MINIMO_PUBLICACIONES = 8; // menos que esto en una red, y lo nuestro no sugiere nada
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function cuadricula(porRed = {}) {
  const redes = Object.values(porRed).filter(l => Array.isArray(l) && l.length);
  if (!redes.length) return null;
  const suma = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const lista of redes) {
    const t = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const x of lista) if (x.dia >= 0 && x.dia < 7 && x.hora >= 0 && x.hora < 24 && x.valor > 0) t[x.dia][x.hora] = Math.max(t[x.dia][x.hora], Number(x.valor));
    const max = Math.max(...t.flat()); if (!(max > 0)) continue;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) suma[d][h] += t[d][h] / max * 100;
  }
  const g = suma.map(f => f.map(v => Math.round(v / redes.length)));
  return Math.max(...g.flat()) > 0 ? g : null;
}

/**
 * Lo nuestro: las publicaciones que ya salieron (las de Analíticas: { publicadaAt, interacciones, red }), por hora y día de la semana.
 * Una hora sin publicaciones no dice nada (0); con menos de `minimo` publicaciones en total, no hay sugerencia.
 */
export function deLoPublicado(publicaciones = [], { red = '', minimo = MINIMO_PUBLICACIONES } = {}) {
  const lista = publicaciones.filter(p => p?.publicadaAt && (!red || !p.red || p.red === red));
  if (lista.length < minimo) return [];
  const celdas = new Map();
  for (const p of lista) {
    const d = new Date(p.publicadaAt); if (Number.isNaN(d.getTime())) continue;
    const k = `${d.getDay()}|${d.getHours()}`, c = celdas.get(k) || { n: 0, s: 0 };
    c.n++; c.s += Number(p.interacciones) || 0; celdas.set(k, c);
  }
  return [...celdas.entries()].map(([k, c]) => { const [dia, hora] = k.split('|').map(Number); return { dia, hora, valor: c.s / c.n }; }).filter(x => x.valor > 0);
}

/** Las mejores horas de ese día de la semana, de más a menos (para los botones del panel). */
export function mejoresDelDia(grid, fecha, n = 3) {
  if (!grid || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return [];
  const dia = new Date(`${fecha}T12:00:00`).getDay();
  return grid[dia].map((valor, h) => ({ hora: `${pad(h)}:00`, valor })).filter(x => x.valor >= 50).sort((a, b) => b.valor - a.valor).slice(0, n);
}

/**
 * El siguiente hueco bueno: desde dentro de una hora, en los próximos `dias`, la primera hora con valor ≥ `umbral` que no esté a menos de
 * una hora de otra pieza de esas redes (`ocupadas`, en ms). Si no hay ninguna tan buena, la mejor de esos días.
 */
export function siguienteBuena(grid, { ahora = Date.now(), ocupadas = [], umbral = 75, dias = 7 } = {}) {
  if (!grid) return null;
  const inicio = new Date(ahora + 3600e3); inicio.setMinutes(0, 0, 0); if (inicio.getTime() < ahora + 3600e3) inicio.setHours(inicio.getHours() + 1);
  const libre = ms => !ocupadas.some(o => Math.abs(o - ms) < 3600e3);
  let mejor = null;
  for (let i = 0; i < dias * 24; i++) {
    const t = new Date(inicio); t.setHours(inicio.getHours() + i); const v = grid[t.getDay()][t.getHours()];
    if (!v || !libre(t.getTime())) continue;
    const s = { fecha: ymd(t), hora: `${pad(t.getHours())}:00`, valor: v };
    if (v >= umbral) return s;
    if (!mejor || v > mejor.valor) mejor = s;
  }
  return mejor;
}

/** Cuánto sombrear una hora de la semana: 2 de lo mejor (≥ 80), 1 buena (≥ 55), 0 nada. */
export function nivel(grid, fecha, h) {
  if (!grid) return 0;
  const v = grid[new Date(`${fecha}T12:00:00`).getDay()]?.[h] || 0;
  return v >= 80 ? 2 : v >= 55 ? 1 : 0;
}

/** La frase de dónde sale la sugerencia. */
export const FUENTE = { metricool: 'según Metricool', propia: 'según lo que ya publicaste', ninguna: '' };
