// Agents Office (8 oct 2026, C2) — lo YA PUBLICADO en el calendario de Contenido, con sus resultados. Puro: lo usan el servidor
// (/api/contenido/publicadas), la demo y los tests.
// Una publicación de Meta (la que guarda Analíticas: { id, red, externoId, enlace, texto, publicadaAt, alcance, interacciones… }) se junta
// con la pieza de la que salió:
//   1. por su ENLACE: la cola apunta el enlace que Meta devolvió al publicar (`salida.redes[red].url`);
//   2. si no, por la red, la hora (± 35 min: Instagram sale desde esta computadora hasta 30 min tarde) y el principio del texto. Sin texto en
//      alguno de los dos lados, la hora tiene que estar a 10 min.
// Lo que no casa con ninguna pieza (lo que se publicó a mano, o antes de la oficina) sale como tarjeta propia, de solo lectura.
//   emparejar(piezas, publicaciones, { tolerancia }) → { porPieza: { [id]: [resultado] }, sueltas: [publicación] }
//   resultadoDe(pub) → { red, alcance, interacciones, meGusta, comentarios, vistas, enlace, publicadaAt, tipo }
//   sumaResultados(lista) → { alcance, interacciones, … } (las redes de una pieza, juntas)
//   cifrasTxt(r, { corto }) → «1,2 mil de alcance · 85 interacciones» · numeroCorto(n)

export const TOLERANCIA_MIN = 35;
export const TOLERANCIA_SIN_TEXTO_MIN = 10;

const pad = n => String(n).padStart(2, '0');
const ymdLocal = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const horaLocal = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const momentoDe = p => (p?.fecha && p?.hora ? new Date(`${p.fecha}T${p.hora}:00`).getTime() : NaN);
/** El enlace sin lo que cambia de una vez a otra (barra final, parámetros, www, http). */
export const enlaceLimpio = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
/** El principio del texto, solo letras y números (los emojis, los saltos y los signos no cuentan). */
export const huellaTexto = (t, n = 32) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, n);
/** Lo que una pieza dice en esa red (su texto propio, el de Facebook o el de todas). */
const textoEn = (p, red) => (p.textos?.[red] || (red === 'facebook' && p.textoFacebook) || p.texto || '');
const redBase = r => String(r || '').split('·')[0];

export function resultadoDe(pub) {
  return { id: pub.id, red: pub.red, tipo: pub.tipo || '', enlace: pub.enlace || '', publicadaAt: pub.publicadaAt || null, alcance: +pub.alcance || 0, interacciones: +pub.interacciones || 0, meGusta: +pub.meGusta || 0, comentarios: +pub.comentarios || 0, guardados: +pub.guardados || 0, compartidos: +pub.compartidos || 0, vistas: +pub.vistas || 0 };
}

/** ¿Casa el texto? Los dos con texto: uno empieza como el otro (lo corto manda, desde 12 letras). */
function casaTexto(a, b) {
  const x = huellaTexto(a), y = huellaTexto(b);
  if (!x || !y) return null; // no se sabe: lo decide la hora
  const n = Math.min(x.length, y.length);
  return n >= 12 ? x.slice(0, n) === y.slice(0, n) : x === y;
}

export function emparejar(piezas = [], publicaciones = [], { tolerancia = TOLERANCIA_MIN } = {}) {
  const porPieza = {}, sueltas = [], usadas = new Set();
  // 1. por enlace
  const porEnlace = new Map();
  for (const p of piezas) for (const [red, s] of Object.entries(p?.salida?.redes || {})) { const k = enlaceLimpio(s?.url); if (k && !/simulacro\.invalid/.test(k)) porEnlace.set(k, { p, red: redBase(red) }); }
  const pendientes = [];
  for (const pub of publicaciones) {
    const k = enlaceLimpio(pub?.enlace), hit = k && porEnlace.get(k);
    if (hit) { (porPieza[hit.p.id] ||= []).push(resultadoDe(pub)); usadas.add(`${hit.p.id}|${pub.red}`); continue; }
    pendientes.push(pub);
  }
  // 2. por red, hora y texto: la pieza más cercana en el tiempo que casa
  for (const pub of pendientes) {
    const t = Date.parse(pub?.publicadaAt || ''); if (!Number.isFinite(t)) { sueltas.push(pub); continue; }
    let mejor = null;
    for (const p of piezas) {
      if (!p?.id || !(p.redes || []).includes(pub.red) || usadas.has(`${p.id}|${pub.red}`)) continue;
      const m = momentoDe(p); if (!Number.isFinite(m)) continue;
      const dif = Math.abs(t - m), texto = casaTexto(textoEn(p, pub.red), pub.texto);
      if (texto === false) continue;
      if (dif > (texto ? tolerancia : TOLERANCIA_SIN_TEXTO_MIN) * 60e3) continue;
      if (!mejor || dif < mejor.dif) mejor = { p, dif };
    }
    if (mejor) { (porPieza[mejor.p.id] ||= []).push(resultadoDe(pub)); usadas.add(`${mejor.p.id}|${pub.red}`); }
    else sueltas.push(pub);
  }
  return { porPieza, sueltas };
}

export function sumaResultados(lista = []) {
  const s = { alcance: 0, interacciones: 0, meGusta: 0, comentarios: 0, guardados: 0, compartidos: 0, vistas: 0, redes: [] };
  for (const r of lista) { for (const k of ['alcance', 'interacciones', 'meGusta', 'comentarios', 'guardados', 'compartidos', 'vistas']) s[k] += +r[k] || 0; if (!s.redes.includes(r.red)) s.redes.push(r.red); }
  return s;
}

/** 1234 → «1,2 mil» · 12 500 → «12 mil» · 1 250 000 → «1,3 M». */
export function numeroCorto(n) {
  const v = Math.round(+n || 0), a = Math.abs(v);
  if (a < 1000) return String(v);
  if (a < 1e6) return `${(v / 1000).toFixed(a < 1e4 ? 1 : 0).replace('.', ',').replace(/,0$/, '')} mil`;
  return `${(v / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')} M`;
}

export function cifrasTxt(r, { corto = false } = {}) {
  if (!r) return '';
  if (corto) return `${numeroCorto(r.alcance)} · ${numeroCorto(r.interacciones)}`;
  return `${numeroCorto(r.alcance)} de alcance · ${numeroCorto(r.interacciones)} ${r.interacciones === 1 ? 'interacción' : 'interacciones'}`;
}

/** Una publicación suelta, como algo que el calendario sabe pintar: su día y su hora LOCALES. */
export function comoEvento(pub) {
  const t = Date.parse(pub?.publicadaAt || '');
  return Number.isFinite(t) ? { ...pub, fecha: ymdLocal(t), hora: horaLocal(t), at: t } : null;
}
