// Agents Office (8 oct 2026, C3) — LLENAR LA SEMANA y el CONTENIDO QUE VUELVE. Puro: lo usan el servidor (/api/contenido/llenar), la
// ventana de la página (src/contenido-llenar-ui.js, en el paquete del editor) y los tests.
//   huecos({ desde, dias, piezas, redes, grid, ahora, porDefecto }) → [{ fecha, hora, razon }]
//      un día sin nada en esas redes (las ideas no cuentan) es un hueco; su hora es la mejor de ese día (Metricool o lo ya publicado) o,
//      sin datos, `porDefecto`. Una hora a menos de una hora de ahora no vale: se busca la siguiente; si no queda ninguna, el día no entra.
//   queVuelven({ piezas, resultados, ahora, semanas, max }) → [{ pieza, resultado, ultima }]
//      lo que ya salió y funcionó (sus interacciones, de la mitad de arriba de lo publicado) y no salió —ni ella ni una copia suya— en las
//      últimas `semanas` semanas, ni está ya puesto para más adelante.
//   repartir(huecos, vuelven) → [{ ...hueco, que: 'marketing' | 'vuelve', vuelve? }]   (lo que vuelve tapa uno de cada tres huecos)
//   encargo({ huecos, redes, pide, nombreRed }) → el texto de la tarea para Marketing
//   origenVuelve(id) · raizDe(pieza)
import { sumaResultados } from './contenido-publicadas.js';

export const DIAS = 7;
export const SEMANAS_SIN_REPETIR = 8;
export const HORA_POR_DEFECTO = '18:00';
export const MARGEN_MIN = 60; // un hueco de hoy, al menos a una hora de ahora: da tiempo a escribirlo y aprobarlo
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
const momento = (f, h) => new Date(`${f}T${h}:00`).getTime();

export const origenVuelve = id => `vuelve:${id}`;
/** La pieza original de una copia que vuelve (las copias de copias apuntan a la misma). */
export const raizDe = p => (String(p?.origen || '').startsWith('vuelve:') ? String(p.origen).slice(7) : p?.id);

export function huecos({ desde, dias = DIAS, piezas = [], redes = [], grid = null, ahora = Date.now(), porDefecto = HORA_POR_DEFECTO } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || '')) return [];
  const out = [], minimo = ahora + MARGEN_MIN * 60e3;
  for (let i = 0; i < dias; i++) {
    const fecha = masDias(desde, i);
    if (momento(fecha, '23:59') < minimo) continue;
    if (piezas.some(p => p.fecha === fecha && p.estado !== 'idea' && (p.redes || []).some(r => redes.includes(r)))) continue;
    const dow = new Date(`${fecha}T12:00:00`).getDay();
    const mejores = grid ? grid[dow].map((v, h) => ({ hora: `${pad(h)}:00`, v })).filter(x => x.v >= 50).sort((a, b) => b.v - a.v) : [];
    const opciones = [...mejores.map(x => ({ hora: x.hora, razon: 'la mejor hora de ese día' })), { hora: porDefecto, razon: grid ? 'ese día no tiene una hora destacada' : 'todavía no hay mejores horas' }, { hora: '20:00', razon: 'la hora de hoy ya pasó' }];
    const elegida = opciones.find(o => momento(fecha, o.hora) >= minimo);
    if (elegida) out.push({ fecha, hora: elegida.hora, razon: elegida.razon });
  }
  return out;
}

export function queVuelven({ piezas = [], resultados = {}, ahora = Date.now(), semanas = SEMANAS_SIN_REPETIR, max = 6 } = {}) {
  const hoy = ymd(new Date(ahora)), limite = masDias(hoy, -semanas * 7);
  const conRes = piezas.filter(p => p.fecha && p.fecha < hoy && resultados[p.id]?.length).map(p => ({ pieza: p, resultado: sumaResultados(resultados[p.id]) }));
  if (!conRes.length) return [];
  const orden = conRes.map(x => x.resultado.interacciones).sort((a, b) => a - b), mediana = orden[Math.floor((orden.length - 1) / 2)];
  // la última vez que salió (o saldrá) cada original, contando sus copias
  const ultima = new Map();
  for (const p of piezas) { if (!p.fecha || p.estado === 'idea') continue; const r = raizDe(p); if (!ultima.has(r) || p.fecha > ultima.get(r)) ultima.set(r, p.fecha); }
  const mejor = new Map(); // una por original: la que más movió
  for (const x of conRes) {
    if (!(x.resultado.interacciones > 0) || x.resultado.interacciones < mediana) continue;
    const r = raizDe(x.pieza), u = ultima.get(r) || x.pieza.fecha;
    if (u >= limite) continue;
    if (!mejor.has(r) || x.resultado.interacciones > mejor.get(r).resultado.interacciones) mejor.set(r, { ...x, ultima: u });
  }
  return [...mejor.values()].sort((a, b) => b.resultado.interacciones - a.resultado.interacciones).slice(0, max);
}

export function repartir(hs = [], vuelven = []) {
  const plazas = hs.map((_, i) => i).filter(i => i % 3 === 1);
  if (!plazas.length && hs.length) plazas.push(0);
  const asignadas = new Map(); plazas.slice(0, vuelven.length).forEach((i, j) => asignadas.set(i, vuelven[j].pieza.id));
  return hs.map((h, i) => (asignadas.has(i) ? { ...h, que: 'vuelve', vuelve: asignadas.get(i) } : { ...h, que: 'marketing' }));
}

const DOWS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const diaCorto = f => { const d = new Date(`${f}T12:00:00`); return `${DOWS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`; };

export function encargo({ huecos: hs = [], redes = [], pide = '', nombreRed = r => r } = {}) {
  const lista = hs.map(h => `- ${diaCorto(h.fecha)} (${h.fecha}) a las ${h.hora}`).join('\n');
  const pedido = String(pide || '').trim().slice(0, 600);
  return `Llena estos huecos del calendario de Contenido con un borrador cada uno, para ${redes.map(nombreRed).join(' y ') || 'las redes de la empresa'}:\n${lista}\n\n`
    + 'Cómo:\n'
    + '1. Antes de escribir, mira ver_calendario_contenido (lo que ya sale esas semanas: no repitas tema), ver_analiticas y ver_mejor_hora. Si tienes la skill plan-contenido, síguela.\n'
    + '2. Un borrador por hueco con crear_borrador, con esa fecha, esa hora y esas redes exactas. Elige el formato que mejor funciona según Analíticas.\n'
    + '3. La imagen: búscala en la galería (buscar_en_galeria) o créala con el Estudio (generar_imagen) y ponla en medios. Si no puedes, deja el borrador sin imagen y dilo en sus notas.\n'
    + '4. El texto con la voz de la marca; primer comentario y hashtags si tocan; los precios y cifras, solo de las cifras de la empresa.\n'
    + '5. No apruebes, no programes y no publiques nada: el dueño los revisa y los aprueba.'
    + (pedido ? `\n\nLo que pide el dueño para esta semana: «${pedido}»` : '');
}
