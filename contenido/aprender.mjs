// Agents Office (9 oct 2026, F4 de Contenido) — APRENDER de lo publicado. Puro: serve.mjs lo usa con lo que Analíticas leyó de Meta
// (src/contenido-publicadas.js junta cada publicación con su pieza) y lo prueban los tests.
//   puntuar(piezas, porPieza, { ahora, madura }) → Map(piezaId → { r, interacciones, alcance, lugar, de })
//      el lugar de cada pieza ya madura (publicada hace DIAS_DE_MADURACION días o más) entre las demás con cifras: la que más movió vale 1,
//      la que menos 0,25. Con menos de MINIMO piezas maduras no se puntúa nada: con dos publicaciones, «la mejor» es ruido.
//   lecciones({ piezas, porPieza, tareas, citadas, ahora }) → [{ id: 'contenido:<pieza>', r, cited, read, pieza, tarea }]
//      una pieza que escribió un agente (lleva su `tarea`) enseña a las notas que esa tarea citó en «Fuentes:»: lo que funcionó en las redes
//      acerca sus notas, lo que no funcionó las aleja (memory.reinforce, idempotente por pieza: si las cifras cambian, se corrige).
//   semanaContenido({ piezas, porPieza, sueltas, huecos, vuelven, conectado, ahora }) → el párrafo de redes del informe del lunes y de Dimitri
import { sumaResultados, numeroCorto } from '../src/contenido-publicadas.js';
import { DIAS_DE_MADURACION } from '../src/contenido-cifras.js';

export const MINIMO = 4;
const DIA = 864e5;
const pad = n => String(n).padStart(2, '0');
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const momento = p => (p?.fecha ? new Date(`${p.fecha}T${p.hora || '12:00'}:00`).getTime() : NaN);
const titulo = p => String(p?.titulo || String(p?.texto || '').split('\n')[0] || 'sin título').slice(0, 70);
const NOMBRE = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', threads: 'Threads', bluesky: 'Bluesky', tiktok: 'TikTok', pinterest: 'Pinterest', youtube: 'YouTube' };

export function puntuar(piezas = [], porPieza = {}, { ahora = Date.now(), madura = DIAS_DE_MADURACION } = {}) {
  const limite = ahora - madura * DIA;
  const conCifras = piezas.filter(p => porPieza[p.id]?.length && momento(p) <= limite).map(p => ({ p, s: sumaResultados(porPieza[p.id]) }));
  const out = new Map();
  if (conCifras.length < MINIMO) return out;
  conCifras.sort((a, b) => a.s.interacciones - b.s.interacciones || a.s.alcance - b.s.alcance);
  const n = conCifras.length;
  conCifras.forEach((x, i) => out.set(x.p.id, { r: Math.round((0.25 + 0.75 * (i / (n - 1))) * 100) / 100, interacciones: x.s.interacciones, alcance: x.s.alcance, lugar: n - i, de: n }));
  return out;
}

/** `citadas(tarea)` → { cited, read }: las notas que la tarea citó y las que leyó (serve.mjs usa memory.cited sobre su resultado). */
export function lecciones({ piezas = [], porPieza = {}, tareas = [], citadas = t => ({ cited: [], read: t.read || [] }), ahora = Date.now() } = {}) {
  const puntos = puntuar(piezas, porPieza, { ahora }), porId = new Map(tareas.map(t => [t.id, t]));
  const out = [];
  for (const p of piezas) {
    const pt = puntos.get(p.id), t = p.tarea && porId.get(p.tarea);
    if (!pt || !t) continue;
    const { cited = [], read = [] } = citadas(t) || {};
    if (!cited.length) continue; // sin «Fuentes:» no hay a qué atribuirle el resultado
    out.push({ id: `contenido:${p.id}`, r: pt.r, cited, read, pieza: p.id, tarea: t.id });
  }
  return out;
}

export function semanaContenido({ piezas = [], porPieza = {}, sueltas = [], huecos = [], vuelven = [], conectado = true, ahora = Date.now() } = {}) {
  const hoy = ymd(ahora), hace7 = ymd(ahora - 7 * DIA), en7 = ymd(ahora + 7 * DIA);
  const salieron = piezas.filter(p => p.fecha && p.fecha >= hace7 && p.fecha < hoy && (porPieza[p.id]?.length || p.salida?.estado === 'publicada'));
  const lineas = [];
  if (!conectado && !Object.keys(porPieza).length) lineas.push('Redes: Meta no está conectada, así que no hay cifras de lo publicado (Analíticas → «Conecta Meta»).');
  else if (!salieron.length && !sueltas.length) lineas.push('Redes (7 días): no salió nada.');
  else {
    const con = salieron.filter(p => porPieza[p.id]?.length).map(p => ({ p, s: sumaResultados(porPieza[p.id]) })).sort((a, b) => b.s.interacciones - a.s.interacciones);
    const total = con.reduce((a, x) => ({ alcance: a.alcance + x.s.alcance, interacciones: a.interacciones + x.s.interacciones }), { alcance: 0, interacciones: 0 });
    for (const m of sueltas) { total.alcance += +m.alcance || 0; total.interacciones += +m.interacciones || 0; }
    const porRed = {}; for (const p of salieron) for (const r of p.redes || []) porRed[r] = (porRed[r] || 0) + 1; for (const m of sueltas) porRed[m.red] = (porRed[m.red] || 0) + 1;
    let l = `Redes (7 días): salieron ${salieron.length + sueltas.length} publicaciones (${Object.entries(porRed).map(([r, n]) => `${NOMBRE[r] || r} ${n}`).join(', ')})${sueltas.length ? `, ${sueltas.length} hechas fuera de Contenido` : ''}; ${numeroCorto(total.alcance)} de alcance y ${numeroCorto(total.interacciones)} interacciones.`;
    if (con.length) l += ` La que más movió: «${titulo(con[0].p)}» (${numeroCorto(con[0].s.alcance)} de alcance, ${numeroCorto(con[0].s.interacciones)} interacciones).`;
    if (con.length > 2) l += ` La que menos: «${titulo(con.at(-1).p)}» (${numeroCorto(con.at(-1).s.interacciones)} interacciones).`;
    lineas.push(l);
  }
  const prox = piezas.filter(p => p.fecha && p.fecha >= hoy && p.fecha < en7 && p.estado !== 'idea');
  const cuenta = e => prox.filter(p => p.estado === e).length;
  lineas.push(`Próximos 7 días: ${prox.length} ${prox.length === 1 ? 'pieza' : 'piezas'} (${cuenta('aprobada')} aprobadas, ${cuenta('revision')} esperan tu OK, ${cuenta('borrador')} borradores)${huecos.length ? `; ${huecos.length} ${huecos.length === 1 ? 'día' : 'días'} sin nada (${huecos.slice(0, 4).map(h => h.fecha.slice(5)).join(', ')}): se tapan con «Llenar la semana»` : ''}.`);
  if (vuelven.length) lineas.push(`Puede volver (funcionó y no sale hace más de 8 semanas): ${vuelven.slice(0, 3).map(v => `«${titulo(v.pieza || v)}»`).join(', ')}.`);
  return lineas.join('\n');
}
