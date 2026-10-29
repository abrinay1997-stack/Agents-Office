// Agents Office — Fase 11.0 (carril K): deriva de estilo entre los planos de una serie, puro (plan K §13.4).
// La visión (otro modelo, otra familia) puntúa 4 ejes de 1 a 5 con evidencia; aquí solo se combinan números. No mide escenas con IoU: no se promete.
export const EJES = ['producto_personaje', 'paleta', 'estilo', 'encuadre'];
export const UMBRAL_DERIVA = 3; // < 3 de 5 = el plano se sale de la serie
export const REANCLAR_CADA = 5; // anclas fijas (hoja + plano clave aprobado), nunca el plano anterior encadenado
export const DELTA_E_MAX = 8; // prueba de ida y vuelta de la biblia (ΔE ≤ 8) y tope de color de un plano

export function hexARgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()) || (/^#?([0-9a-f]{3})$/i.exec(String(hex || '').trim()) && [0, String(hex).replace('#', '').split('').map(c => c + c).join('')]);
  if (!m) return null;
  const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbALab([r, g, b]) { // sRGB D65 -> CIE L*a*b*
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047, Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B, Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function deltaE(hexA, hexB) { // CIE76: suficiente para «¿es este el mismo color de la marca?»
  const a = hexARgb(hexA), b = hexARgb(hexB);
  if (!a || !b) return null;
  const [A, B] = [rgbALab(a), rgbALab(b)];
  return +Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]).toFixed(2);
}
// Cada color de la biblia contra el más cercano de los dominantes del plano. Sin dominantes medidos: «No medido», nunca un fallo inventado.
export function fidelidadPaleta(biblia, dominantes, max = DELTA_E_MAX) {
  const B = (biblia || []).filter(h => hexARgb(h)), D = (dominantes || []).filter(h => hexARgb(h));
  if (!B.length || !D.length) return { medido: false, motivo: 'No medido' };
  const por = B.map(h => ({ color: h, deltaE: Math.min(...D.map(d => deltaE(h, d))) }));
  const media = +(por.reduce((a, x) => a + x.deltaE, 0) / por.length).toFixed(2);
  return { medido: true, por, media, ok: por.every(x => x.deltaE <= max), fuera: por.filter(x => x.deltaE > max).map(x => x.color) };
}
// Puntuación de visión: { producto_personaje:4, paleta:5, estilo:4, encuadre:3, evidencia:{eje:'texto'} }. Un eje sin evidencia no cuenta como medido.
export function puntuarPlano(p, { deltaEMedia } = {}) {
  const ejes = {}, sinMedir = [];
  for (const e of EJES) {
    const v = +p?.[e], ev = typeof p?.evidencia?.[e] === 'string' && p.evidencia[e].trim();
    if (Number.isFinite(v) && v >= 1 && v <= 5 && ev) ejes[e] = Math.round(v); else sinMedir.push(e);
  }
  const medidos = Object.values(ejes);
  const media = medidos.length ? +(medidos.reduce((a, x) => a + x, 0) / medidos.length).toFixed(2) : null;
  const colorFuera = Number.isFinite(deltaEMedia) && deltaEMedia > DELTA_E_MAX;
  const bajo = Object.entries(ejes).filter(([, v]) => v < UMBRAL_DERIVA).map(([e]) => e);
  return { ejes, sinMedir, media, deltaE: Number.isFinite(deltaEMedia) ? deltaEMedia : null, bajo, derivado: (media !== null && media < UMBRAL_DERIVA) || colorFuera, completo: !sinMedir.length };
}
// Pausa si dos planos SEGUIDOS puntúan por debajo del umbral. `historial`: puntuaciones en orden de plano (puntuarPlano).
export function evaluarDeriva(historial) {
  const h = Array.isArray(historial) ? historial : []; let seguidos = 0;
  for (const p of h) seguidos = p?.derivado ? seguidos + 1 : 0;
  return seguidos >= 2 ? { pausar: true, motivo: `dos planos seguidos se alejan de la serie (media < ${UMBRAL_DERIVA}/5 o color fuera de la paleta)` } : { pausar: false, seguidos };
}
export const debeReanclar = (n, cada = REANCLAR_CADA) => Number.isInteger(n) && n > 0 && cada > 0 && n % cada === 0;
export function anclasDe(serie) { // refs fijas para reanclar: la hoja y el plano clave aprobado; NUNCA el plano anterior
  const hoja = (serie?.personajes || []).flatMap(p => p.refs || []), clave = (serie?.escaleta || []).find(p => p.clave && p.aprobada_version != null);
  const ultimo = clave?.versiones?.find(v => v.v === clave.aprobada_version);
  return { hoja: [...new Set(hoja)], planoClave: ultimo?.archivo || null };
}
