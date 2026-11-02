// Versión móvil (2 nov 2026) — la AGENDA de Contenido con MINIATURAS. Lo puro (sin DOM, sin fecha del reloj: todo lo que depende del día recibe `ahora`
// o el día), con test en tests/movil-contenido-miniaturas.test.mjs. Lo usa src/movil/vistas/contenido.js (que dibuja) y el perfil.
// No decide nada de aprobar ni de publicar: solo cómo SE VE una pieza en una celda, una columna o una tarjeta.
import { formatoDe } from '../contenido-reglas.js';

/** Los cinco modos de ver la Agenda, el predeterminado primero. «Mes + lista» junta la cuadrícula de miniaturas con la lista del día. */
export const VISTAS = [
  ['mes-lista', 'Mes + lista'], ['miniaturas', 'Miniaturas'], ['semana', 'Semana'], ['puntos', 'Puntos'], ['lista', 'Lista'],
];
export const VISTA_DEFECTO = 'mes-lista';
export const LLAVE_VISTA = 'ao.mv.ct.vista';
/** Lo que haya guardado en el teléfono vale solo si es uno de los modos de hoy; si no, el predeterminado. */
export const normalizarVista = v => (VISTAS.some(([k]) => k === v) ? v : VISTA_DEFECTO);

/** Cuántas miniaturas caben en una celda del mes antes del «+N». */
export const MAX_CELDA = 3;
/** Cuántas caben en una columna de la semana. */
export const MAX_COLUMNA = 4;

const esVideo = s => /\.(mp4|webm|mov)(\?|$)/i.test(String(s || ''));
const pad = n => String(n).padStart(2, '0');
const ymdDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** El formato con el que se ve la pieza: el de su primera red. */
export const formatoPieza = p => formatoDe(p, (p?.redes || [])[0]);

/** Las primeras palabras del texto, para una pieza sin archivo (una idea o un texto): como mucho `max` letras, sin cortar una palabra a la mitad si se puede. */
export function primerasPalabras(p, max = 28) {
  const t = String(p?.titulo || p?.texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max), sp = corte.lastIndexOf(' ');
  if (t[max] === ' ') return corte.trim() + '…'; // el corte cae justo al final de una palabra
  return (sp > max * 0.5 ? corte.slice(0, sp) : corte).trim() + '…';
}

/**
 * Cómo se dibuja la miniatura de una pieza.
 *  · imagen   la primera imagen de la pieza;
 *  · video    un video: en una cuadrícula se dibuja como un recuadro con ▶ (no se decodifican 35 videos), en una tarjeta, su primer cuadro;
 *  · texto    sin archivo (una idea o un texto): un recuadro con el icono del formato y las primeras palabras.
 * `indicador` es «1/N» en un carrusel (o en cualquier pieza con varios archivos); `ratio` es la proporción de su formato (una historia, 9:16).
 * @returns {{ tipo:'imagen'|'video'|'texto', src:string|null, n:number, formato:string, ratio:string, indicador:string, texto:string }}
 */
export function miniaturaDe(p) {
  const medios = Array.isArray(p?.medios) ? p.medios.filter(Boolean) : [], hist = Array.isArray(p?.historias) ? p.historias.filter(Boolean) : [];
  const src = medios[0] || hist[0] || null, formato = formatoPieza(p), n = medios.length || hist.length;
  const tipo = !src ? 'texto' : esVideo(src) ? 'video' : 'imagen';
  const ratio = formato === 'historia' || formato === 'reel' ? '9:16' : formato === 'carrusel' ? '4:5' : '1:1';
  return { tipo, src, n, formato, ratio, indicador: n > 1 ? `1/${n}` : '', texto: tipo === 'texto' ? primerasPalabras(p) : '' };
}

/**
 * El estado que se VE de una pieza (nunca solo por color: lleva glifo y trazo). Recibe `sal` = textoSalida(p) (o null) para saber si ya está en cola o salió.
 * trazo: punteado = todavía no es una publicación; raya = a revisar; sólido = puede salir; doble = algo falló.
 * @returns {{ clave:string, nombre:string, glifo:string, trazo:'punteado'|'raya'|'solido'|'doble' }}
 */
export function estadoVisual(p, sal = null) {
  if (sal) {
    if (sal.malo) return { clave: 'fallo', nombre: 'Falló', glifo: '!', trazo: 'doble' };
    if (sal.clave === 'publicada') return { clave: 'publicada', nombre: 'Publicada', glifo: '✔', trazo: 'solido' };
    return { clave: 'programada', nombre: 'Programada', glifo: '◷', trazo: 'solido' };
  }
  switch (p?.estado) {
    case 'aprobada': return { clave: 'aprobada', nombre: 'Aprobada', glifo: '✓', trazo: 'solido' };
    case 'revision': return { clave: 'revision', nombre: 'A revisar', glifo: '●', trazo: 'raya' };
    case 'borrador': return { clave: 'borrador', nombre: 'Borrador', glifo: '✎', trazo: 'punteado' };
    default: return { clave: 'idea', nombre: 'Idea', glifo: '◌', trazo: 'punteado' };
  }
}
/** La leyenda de la cuadrícula: glifo + nombre, en el orden en que una pieza va avanzando. */
export const LEYENDA = [['◌', 'Idea'], ['✎', 'Borrador'], ['●', 'A revisar'], ['✓', 'Aprobada'], ['◷', 'Programada'], ['✔', 'Publicada'], ['!', 'Falló']];

/** Las piezas con día, agrupadas por día y ordenadas por hora (las sin hora, al final de su día). → Map<'AAAA-MM-DD', pieza[]> */
export function piezasPorDia(piezas = []) {
  const m = new Map();
  for (const p of piezas) { if (!p?.fecha) continue; if (!m.has(p.fecha)) m.set(p.fecha, []); m.get(p.fecha).push(p); }
  for (const v of m.values()) v.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99') || String(a.id).localeCompare(String(b.id)));
  return m;
}

/** Lo que enseña un día: hasta `max` piezas y cuántas quedan fuera (el «+N»). */
export function resumenDia(piezas = [], max = MAX_CELDA) {
  const n = piezas.length;
  return { mostrar: piezas.slice(0, max), mas: Math.max(0, n - max), n };
}

/** Los siete días (lunes a domingo) de la semana que contiene `dia`. */
export function diasDeSemana(dia) {
  const d = new Date(`${dia}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return [...Array(7)].map((_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return ymdDe(x); });
}

/** El nombre de un estado según cuántas piezas hay: «1 aprobada», «2 borradores», «3 a revisar», «2 fallaron». */
const PLURAL = { 'idea': 'ideas', 'borrador': 'borradores', 'a revisar': 'a revisar', 'aprobada': 'aprobadas', 'programada': 'programadas', 'publicada': 'publicadas', 'falló': 'fallaron' };
export const nombreN = (nombre, n) => { const b = String(nombre || '').toLowerCase(); return n === 1 ? b : (PLURAL[b] || b); };

/** La frase que lee un lector de pantalla de una celda: cuántas piezas y de qué estado («3 piezas: 2 borradores, 1 aprobada»). */
export function frasePiezas(piezas = [], estadoDe = p => estadoVisual(p)) {
  if (!piezas.length) return '';
  const cuenta = new Map();
  for (const p of piezas) { const e = estadoDe(p).nombre.toLowerCase(); cuenta.set(e, (cuenta.get(e) || 0) + 1); }
  return `${piezas.length} ${piezas.length === 1 ? 'pieza' : 'piezas'}: ${[...cuenta].map(([e, c]) => `${c} ${nombreN(e, c)}`).join(', ')}`;
}

/** Cuántas imágenes caben a la vez en la cuadrícula de un mes: con más de UMBRAL_IMG en pantalla, una sola por celda (y el «+N» dice cuántas más hay, que se ven en la lista). */
export const UMBRAL_IMG = 40;
export const TOPE_IMG = 60;
/**
 * Qué enseña cada celda del mes. `dias` son los días de la cuadrícula; `porDia` sale de piezasPorDia.
 * Nunca más de TOPE_IMG imágenes (<img>) en total: lo que no cabe se cuenta en el «+N».
 * @returns {Map<string, { mostrar: object[], mas: number, n: number }>}
 */
export function planMes(dias = [], porDia = new Map()) {
  const conImg = ps => ps.slice(0, MAX_CELDA).filter(p => miniaturaDe(p).tipo === 'imagen').length;
  const total = dias.reduce((a, d) => a + conImg(porDia.get(d) || []), 0);
  const max = total > UMBRAL_IMG ? 1 : MAX_CELDA, out = new Map();
  let imgs = 0;
  for (const d of dias) {
    const ps = porDia.get(d) || []; if (!ps.length) continue;
    const mostrar = [];
    for (const p of ps) {
      if (mostrar.length >= max) break;
      if (miniaturaDe(p).tipo === 'imagen') { if (imgs >= TOPE_IMG) continue; imgs++; }
      mostrar.push(p);
    }
    out.set(d, { mostrar, mas: ps.length - mostrar.length, n: ps.length });
  }
  return out;
}

/**
 * La dirección de una miniatura, o null si no es de fiar. Solo se acepta lo que sirve esta misma oficina: una clave del Estudio (→ /media/…) o una ruta
 * /media/… o /api/media/… del mismo origen. Cualquier otro http(s):// (o //host) NO se carga: la miniatura cae en el recuadro con icono.
 * `externa: true` (las miniaturas de Meta de Anuncios y Analíticas) admite además https://.
 */
/** Las rutas de esta oficina que sirven imágenes: la galería del Estudio y la copia local de las miniaturas de Analíticas. */
const RUTA_PROPIA = /^\/(?:media\/|api\/media\/|api\/contenido\/miniatura\/)/;
export function srcSeguro(src, { origen = typeof location !== 'undefined' ? location.origin : '', externa = false } = {}) {
  if (typeof src !== 'string' || !src.trim()) return null;
  const t = src.trim();
  if (/^\/\//.test(t) || /^[a-z][a-z0-9+.-]*:/i.test(t)) {
    let u; try { u = new URL(t, origen || undefined); } catch { return null; }
    if (origen && u.origin === origen && RUTA_PROPIA.test(u.pathname)) return u.pathname + u.search;
    if (externa && u.protocol === 'https:') return u.href;
    return null;
  }
  if (t.startsWith('/')) { let u; try { u = new URL(t, 'http://x'); } catch { return null; } return RUTA_PROPIA.test(u.pathname) ? u.pathname + u.search : null; }
  if (t.startsWith('demo/') || t.split('/').includes('..')) return null;
  return '/media/' + t.split('/').map(encodeURIComponent).join('/');
}
