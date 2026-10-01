// Agents Office — el Estudio en local: lo que se hace con sharp, gratis y exacto, sin llamar a ningún modelo
// (banco de presets, E3, 1 oct 2026; docs/propuesta-banco-presets.md §5.5, D3, D8, D9, D10, D20, D21 y §16.5).
//
// Regla de oro (D3): la luz, el color, la LUT, la transferencia de color, el encuadre y la exportación NUNCA van a un modelo
// generativo. Si sharp no carga, todo lo de aquí lanza NoDisponible («no disponible en esta máquina») y nada cae a la IA.
// Lo que de verdad necesita la IA (extender una escena que no es lisa, enderezar más de 5°) no se hace a escondidas: el paso
// se salta y deja { necesitaIA: true, aviso } para que el compilador o la página lo digan.
//
// Representación interna: «raw» = { data: Buffer RGBA (4 canales, sRGB 8 bits), width, height }. Las operaciones de píxel son
// funciones sobre raw (rápidas de probar); las que necesitan escalar, rotar o codificar usan sharp.
//
// Contrato (lo que importan media/trabajos.mjs, verificar.mjs, lotes.mjs y los tests):
//   disponible()                         → Promise<{ ok, version?, motivo? }>
//   leer(buf) / codificar(raw, opts)     → raw  /  Buffer
//   mascara(raw, { original?, maxLado? }) → { width, height, producto, alfa, sombra, bbox, bboxSombra, fondo, umbral, liso, metodo }
//   medir(buf | raw)                     → { width, height, bbox, ocupacion, ancho, alto, fondoBorde, liso, bboxSombra }
//   fondoBlanco(raw, { color, sombra: 'conservar'|'regenerar'|'quitar', mascara? }) → { raw, mascara }
//   encuadrar(raw, { ancho, alto, ocupacion, alinear, base, aireMinPx, fondo, escalaFija, mascara? }) → { raw, medido, avisos }
//   escalaSerie(items, { ancho, alto, ocupacion, aireMinPx }) → number[]   (una escala por foto, misma px/cm o misma px/px)
//   extender(raw, { px | factor, color? })  → { raw } | { necesitaIA, aviso }
//   tonos: exposicion, sombras, altas, contraste, saturacion, balance, dominante, temperatura, blancoYNegro, autoNiveles, grano
//   nitidez(raw, sigma) / ruido(raw, radio) / rotarHorizonte(raw, { angulo? })
//   leerCube(texto) / aplicarLut(raw, lut, fuerza) / exportarCube(lut, titulo) / lutIdentidad(n) / lutDeFuncion(fn, n)
//   estadisticasLab(raw, mascara?) / transferirColor(raw, ref, { fuerza, zona }) / guardarColorComoLut(raw, ref, opts)
//   medirSerie(raw) / igualarSerie(raw, patron)
//   exportar(raw, { canal | ancho, alto, formato, pesoMaxKB, fondo, ajuste, marketplace, sku, n }) → { buffer, ... }
//   exportarVarios(raw, canales[], opts) → [{ canal, ...exportar }]
//   pipeline(buf, pasos, ctx)            → { buffer, formato, ancho, alto, pasos[], medido, avisos[], lut?, varios?, nombre? }
//   resolverIntensidad(valor, intensidad) — { suave, normal, fuerte } → número
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

// ───────────────────────────── sharp (una sola carga; los tests pueden simular su ausencia) ─────────────────────────────
let sharpMod, sharpError, sharpCargado = false;
export class NoDisponible extends Error {
  constructor(motivo) { super('Las operaciones locales no están disponibles en esta máquina' + (motivo ? ' (' + motivo + ')' : '') + '. No se usa la IA en su lugar.'); this.code = 'no-disponible'; }
}
async function cargar() {
  if (!sharpCargado) {
    sharpCargado = true;
    try { sharpMod = (await import('sharp')).default; } catch (e) { sharpMod = null; sharpError = e.message; }
  }
  return sharpMod;
}
/** Solo para tests: usarSharp(null) simula una máquina sin sharp; usarSharp() vuelve a cargarlo. */
export function usarSharp(mod) {
  if (mod === undefined) { sharpCargado = false; sharpMod = undefined; sharpError = undefined; return; }
  sharpCargado = true; sharpMod = mod; sharpError = mod ? undefined : 'simulado: sharp no está';
}
async function S() { const s = await cargar(); if (!s) throw new NoDisponible(sharpError || 'sharp no carga'); return s; }
export async function disponible() {
  const s = await cargar();
  return s ? { ok: true, version: s.versions?.sharp || '?' } : { ok: false, motivo: 'no disponible en esta máquina' + (sharpError ? ': ' + sharpError : '') };
}

// ───────────────────────────── leer y codificar ─────────────────────────────
export const esRaw = x => !!x && typeof x === 'object' && !Buffer.isBuffer(x) && x.data && x.width > 0 && x.height > 0;
export function nuevoRaw(width, height, rgba = [255, 255, 255, 255]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = rgba[0]; data[i + 1] = rgba[1]; data[i + 2] = rgba[2]; data[i + 3] = rgba[3] ?? 255; }
  return { data, width, height };
}
const copiaRaw = r => ({ data: Buffer.from(r.data), width: r.width, height: r.height });

/** Buffer de imagen (jpg, png, webp…) → raw RGBA en sRGB, orientado según su EXIF (que después no se guarda). */
export async function leer(buf) {
  if (esRaw(buf)) return buf;
  const sharp = await S();
  const { data, info } = await sharp(buf, { failOn: 'none' }).rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
const deRaw = (sharp, r) => sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } });

/** raw → Buffer. formato png | jpg | webp. Siempre sRGB con su ICC y sin EXIF ni GPS (sharp no copia metadatos si no se le pide). */
export async function codificar(r, { formato = 'png', calidad = 92, fondo = '#FFFFFF', subMuestreo = '4:2:0' } = {}) {
  const sharp = await S();
  let img = deRaw(sharp, r);
  const f = normFormato(formato);
  if (f === 'jpeg') img = img.flatten({ background: fondo || '#FFFFFF' }).jpeg({ quality: calidad, mozjpeg: true, chromaSubsampling: subMuestreo });
  else if (f === 'webp') img = img.webp({ quality: calidad, alphaQuality: 100, smartSubsample: true });
  else img = img.png({ compressionLevel: 9 });
  return img.withIccProfile('srgb').toBuffer();
}
const normFormato = f => { f = String(f || 'png').toLowerCase(); return f === 'jpg' || f === 'jpeg' ? 'jpeg' : f === 'webp' ? 'webp' : 'png'; };
const EXT = { jpeg: 'jpg', webp: 'webp', png: 'png' };

// ───────────────────────────── color: sRGB ⇄ lineal ⇄ Lab (D65) ─────────────────────────────
const A_LINEAL = new Float64Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; A_LINEAL[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export const lineal = v8 => A_LINEAL[v8 < 0 ? 0 : v8 > 255 ? 255 : v8 | 0];
export function srgb8(l) { // lineal (0..1) → 0..255 redondeado
  if (!(l > 0)) return 0; if (l >= 1) return 255;
  const c = l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return Math.round(c * 255);
}
const XN = 0.95047, YN = 1, ZN = 1.08883;
const fLab = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
const fInv = t => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
/** lineal r,g,b → [L, a, b] */
export function linealALab(r, g, b, out = [0, 0, 0]) {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / XN;
  const y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / YN;
  const z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / ZN;
  const fx = fLab(x), fy = fLab(y), fz = fLab(z);
  out[0] = 116 * fy - 16; out[1] = 500 * (fx - fy); out[2] = 200 * (fy - fz); return out;
}
export const rgbALab = (r8, g8, b8, out) => linealALab(A_LINEAL[r8], A_LINEAL[g8], A_LINEAL[b8], out);
/** [L, a, b] → lineal r,g,b (sin recortar) */
export function labALineal(L, a, b, out = [0, 0, 0]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = fInv(fx) * XN, y = fInv(fy) * YN, z = fInv(fz) * ZN;
  out[0] = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  out[1] = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  out[2] = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z; return out;
}
export const labARgb = (L, a, b, out = [0, 0, 0]) => { labALineal(L, a, b, out); out[0] = srgb8(out[0]); out[1] = srgb8(out[1]); out[2] = srgb8(out[2]); return out; };
const luma = (r, g, b) => 0.2126729 * A_LINEAL[r] + 0.7151522 * A_LINEAL[g] + 0.0721750 * A_LINEAL[b];
export function hexARgb(h) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null;
  const s = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const c8 = v => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);

// ───────────────────────────── intensidad ─────────────────────────────
/** { suave, normal, fuerte } → el número de la intensidad pedida (normal si no se dice); un número se devuelve tal cual. */
export function resolverIntensidad(v, intensidad = 'normal') {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v[intensidad] ?? v.normal ?? v.suave ?? v.fuerte;
  return v;
}

// ───────────────────────────── máscara del sujeto (D10) ─────────────────────────────
function mediana(arr) { if (!arr.length) return 0; const a = Float64Array.from(arr).sort(); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function percentil(arr, p) { if (!arr.length) return 0; const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]; }
function filtroMediana(perfil, ventana) {
  const n = perfil.length, h = Math.max(1, ventana >> 1), out = new Float64Array(n);
  for (let i = 0; i < n; i++) { const s = []; for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) s.push(perfil[j]); out[i] = mediana(s); }
  return out;
}
/**
 * Un lado del fondo, robusto: una sombra o el producto que tocan el borde ocupan menos de un cuarto del lado y la mediana
 * ancha (25 %) los ignora; un degradado suave se sigue. Se trabaja sobre ≤ 128 tramos y se interpola de vuelta.
 */
function suavizarPerfil(perfil, frac = 0.25) {
  const n = perfil.length, k = Math.min(n, 128), tramos = new Float64Array(k);
  for (let i = 0; i < k; i++) { const a = Math.floor(i * n / k), b = Math.max(a + 1, Math.floor((i + 1) * n / k)); tramos[i] = mediana(Array.prototype.slice.call(perfil, a, b)); }
  const f = filtroMediana(tramos, Math.max(3, Math.round(k * frac) | 1)), out = new Float64Array(n);
  for (let j = 0; j < n; j++) { const x = (j + 0.5) * k / n - 0.5, i0 = clamp(Math.floor(x), 0, k - 1), i1 = Math.min(k - 1, i0 + 1), t = clamp(x - i0, 0, 1); out[j] = f[i0] * (1 - t) + f[i1] * t; }
  return out;
}

/**
 * El modelo del fondo: un parche de Coons con los cuatro bordes (aguanta degradados y viñeteo), en Lab.
 * Dos pasadas (las hace mascara()): la primera, sin saber nada, con una mediana muy ancha; la segunda excluye de la franja lo
 * que la primera vio como sujeto o sombra («excluir») y rellena esos huecos interpolando, así una sombra larga o una pata que
 * tocan el borde no oscurecen el fondo de toda esa zona.
 */
function modeloFondo(Lab, W, H, { excluir, frac = 0.25 } = {}) {
  const t = Math.max(2, Math.round(Math.min(W, H) * 0.02));
  const lado = (n, idx) => { // perfil por canal: mediana de la franja en cada fila/columna (sin lo excluido)
    const p = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    for (let i = 0; i < n; i++) {
      const ids = []; for (let k = 0; k < t; k++) { const j = idx(i, k); if (!excluir || !excluir[j]) ids.push(j); }
      for (let c = 0; c < 3; c++) p[c][i] = ids.length ? mediana(ids.map(j => Lab[c][j])) : NaN;
    }
    return p.map(per => suavizarPerfil(rellenarNaN(per), frac));
  };
  const izq = lado(H, (y, k) => y * W + k), der = lado(H, (y, k) => y * W + W - 1 - k);
  const arr = lado(W, (x, k) => k * W + x), aba = lado(W, (x, k) => (H - 1 - k) * W + x);
  const fondo = (x, y, c) => {
    const u = W > 1 ? x / (W - 1) : 0, v = H > 1 ? y / (H - 1) : 0;
    return ((1 - u) * izq[c][y] + u * der[c][y] + (1 - v) * arr[c][x] + v * aba[c][x]) / 2;
  };
  const mapas = () => [0, 1, 2].map(c => { // el fondo de cada píxel, de una vez (lo mismo que fondo(), sin llamadas)
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const v = H > 1 ? y / (H - 1) : 0, fila = izq[c][y], dif = der[c][y] - izq[c][y], o = y * W;
      for (let x = 0; x < W; x++) { const u = W > 1 ? x / (W - 1) : 0; out[o + x] = (fila + u * dif + arr[c][x] + v * (aba[c][x] - arr[c][x])) / 2; }
    }
    return out;
  });
  // Ruido del fondo: cuánto se aparta la franja del modelo. El umbral se adapta a él (fondo limpio → umbral bajo).
  const res = [];
  const paso = Math.max(1, Math.round((2 * (W + H) * t) / 20000));
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!(x < t || y < t || x >= W - t || y >= H - t)) continue;
    const i = y * W + x; if (excluir && excluir[i]) continue;
    if ((n++ % paso) !== 0) continue;
    let d = 0;
    for (let c = 0; c < 3; c++) { const e = Lab[c][i] - fondo(x, y, c); d += e * e; }
    res.push(Math.sqrt(d));
  }
  // ¿Liso? La desviación de los bordes respecto de su propio color medio (sin el modelo): un set de estudio da poco.
  const medio = [0, 1, 2].map(c => (mediana(izq[c]) + mediana(der[c]) + mediana(arr[c]) + mediana(aba[c])) / 4);
  let disp = 0, m = 0;
  for (const per of [izq, der, arr, aba]) for (let i = 0; i < per[0].length; i += Math.max(1, per[0].length >> 6)) { let d = 0; for (let c = 0; c < 3; c++) { const e = per[c][i] - medio[c]; d += e * e; } disp += Math.sqrt(d); m++; }
  // El percentil 90 (y no el máximo): lo que toca el borde (una sombra, una pata) no debe subir el umbral de toda la foto.
  return { fondo, mapas, t, ruido: percentil(res, 0.9) * 2, medio, liso: disp / Math.max(1, m) < 4 };
}
function rellenarNaN(p) { // huecos (todo excluido) por interpolación lineal entre los vecinos válidos
  const n = p.length; let ult = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(p[i])) continue;
    if (ult < i - 1) for (let j = ult + 1; j < i; j++) p[j] = ult < 0 ? p[i] : p[ult] + (p[i] - p[ult]) * (j - ult) / (i - ult);
    ult = i;
  }
  if (ult < 0) p.fill(50); else for (let j = ult + 1; j < n; j++) p[j] = p[ult];
  return p;
}

function componentes(mascara, W, H) { // 4-conexas; devuelve etiquetas y por componente { area, x0, y0, x1, y1 }
  const etq = new Int32Array(W * H), comps = [null]; const pila = new Int32Array(W * H); let id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!mascara[s] || etq[s]) continue;
    id++; let top = 0; pila[top++] = s; etq[s] = id; const c = { area: 0, x0: W, y0: H, x1: -1, y1: -1 };
    while (top) {
      const i = pila[--top], x = i % W, y = (i / W) | 0; c.area++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      if (x > 0 && mascara[i - 1] && !etq[i - 1]) { etq[i - 1] = id; pila[top++] = i - 1; }
      if (x < W - 1 && mascara[i + 1] && !etq[i + 1]) { etq[i + 1] = id; pila[top++] = i + 1; }
      if (y > 0 && mascara[i - W] && !etq[i - W]) { etq[i - W] = id; pila[top++] = i - W; }
      if (y < H - 1 && mascara[i + W] && !etq[i + W]) { etq[i + W] = id; pila[top++] = i + W; }
    }
    comps.push(c);
  }
  return { etq, comps };
}
export function cajaDe(m, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) { const f = y * W; for (let x = 0; x < W; x++) if (m[f + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function rellenarHuecos(prod, W, H) { // lo que no se alcanza desde el borde sin cruzar el producto es un hueco del producto
  const fuera = new Uint8Array(W * H), pila = new Int32Array(W * H); let top = 0;
  const empuja = i => { if (!prod[i] && !fuera[i]) { fuera[i] = 1; pila[top++] = i; } };
  for (let x = 0; x < W; x++) { empuja(x); empuja((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { empuja(y * W); empuja(y * W + W - 1); }
  while (top) {
    const i = pila[--top], x = i % W;
    if (x > 0) empuja(i - 1); if (x < W - 1) empuja(i + 1); if (i >= W) empuja(i - W); if (i < W * (H - 1)) empuja(i + W);
  }
  for (let i = 0; i < W * H; i++) if (!fuera[i]) prod[i] = 1;
}
/** Dilatación con una caja de (2r+1)², en O(N) con sumas por filas y columnas (para radios grandes). */
function dilatarCaja(m, W, H, r) {
  const fila = new Uint8Array(W * H), out = new Uint8Array(W * H), acc = new Int32Array(Math.max(W, H) + 1);
  for (let y = 0; y < H; y++) { const o = y * W; acc[0] = 0; for (let x = 0; x < W; x++) acc[x + 1] = acc[x] + m[o + x];
    for (let x = 0; x < W; x++) fila[o + x] = acc[Math.min(W, x + r + 1)] - acc[Math.max(0, x - r)] > 0 ? 1 : 0; }
  for (let x = 0; x < W; x++) { acc[0] = 0; for (let y = 0; y < H; y++) acc[y + 1] = acc[y] + fila[y * W + x];
    for (let y = 0; y < H; y++) out[y * W + x] = acc[Math.min(H, y + r + 1)] - acc[Math.max(0, y - r)] > 0 ? 1 : 0; }
  return out;
}
/** Media de una caja (2r+1)² sobre una máscara 0/1 → Float32 0..1 (suaviza el borde de una franja). */
function mediaCaja(m, W, H, r) {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), acc = new Float64Array(Math.max(W, H) + 1);
  for (let y = 0; y < H; y++) { const o = y * W; acc[0] = 0; for (let x = 0; x < W; x++) acc[x + 1] = acc[x] + m[o + x];
    for (let x = 0; x < W; x++) { const a = Math.max(0, x - r), b = Math.min(W, x + r + 1); tmp[o + x] = (acc[b] - acc[a]) / (b - a); } }
  for (let x = 0; x < W; x++) { acc[0] = 0; for (let y = 0; y < H; y++) acc[y + 1] = acc[y] + tmp[y * W + x];
    for (let y = 0; y < H; y++) { const a = Math.max(0, y - r), b = Math.min(H, y + r + 1); out[y * W + x] = (acc[b] - acc[a]) / (b - a); } }
  return out;
}
function erosionar(m, W, H, r) { const inv = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) inv[i] = m[i] ? 0 : 1; const d = dilatar(inv, W, H, r); for (let i = 0; i < m.length; i++) d[i] = d[i] ? 0 : 1; return d; }
function dilatar(m, W, H, r) {
  let a = m;
  for (let k = 0; k < r; k++) {
    const b = Uint8Array.from(a);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (a[i]) continue;
      if ((x > 0 && a[i - 1]) || (x < W - 1 && a[i + 1]) || (y > 0 && a[i - W]) || (y < H - 1 && a[i + W])) b[i] = 1;
    }
    a = b;
  }
  return a;
}

/**
 * La máscara del producto y, aparte, la de su sombra (D10, §5.5).
 * (b) sin original: distancia en Lab al modelo del fondo (los bordes), con un umbral que se adapta al ruido de ese fondo;
 *     se rellenan los huecos y se quitan las motas. La sombra es lo bajo, oscuro y de poco croma, pegado a la base.
 * (a) con un original alineado (mismo tamaño): la máscara del original guía la del resultado (lo que el modelo no movió).
 * `producto` y `sombra` son 0/1; `alfa` es 0..255 con un anillo de 1–2 px que sale de la propia mezcla de color del borde.
 */
export function mascara(r, { original, umbralMin = 2.5 } = {}) {
  const W = r.width, H = r.height, N = W * H, d = r.data;
  const Lab = [new Float32Array(N), new Float32Array(N), new Float32Array(N)], tmp = [0, 0, 0];
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const a = d[p + 3] / 255; // un PNG con transparencia: lo transparente cuenta como blanco
    if (a < 1) { const k = 255 * (1 - a); rgbALab(c8(d[p] * a + k), c8(d[p + 1] * a + k), c8(d[p + 2] * a + k), tmp); } else rgbALab(d[p], d[p + 1], d[p + 2], tmp);
    Lab[0][i] = tmp[0]; Lab[1][i] = tmp[1]; Lab[2][i] = tmp[2];
  }
  // Primera pasada (mediana ancha), y la segunda sin lo que la primera vio como sujeto o sombra.
  const mf1 = modeloFondo(Lab, W, H);
  const u1 = Math.max(umbralMin, mf1.ruido * 1.25 + 1), visto = new Uint8Array(N);
  { const B = mf1.mapas(); for (let i = 0; i < N; i++) { const e0 = Lab[0][i] - B[0][i], e1 = Lab[1][i] - B[1][i], e2 = Lab[2][i] - B[2][i]; visto[i] = e0 * e0 + e1 * e1 + e2 * e2 > u1 * u1 ? 1 : 0; } }
  const mf = modeloFondo(Lab, W, H, { excluir: dilatarCaja(visto, W, H, Math.max(2, Math.round(Math.min(W, H) * 0.015))), frac: 0.08 });
  // Un fondo sin ruido (el blanco puro que deja fondoBlanco) admite un umbral de 1: así un colchón 250 sobre 255 se ve.
  const umbral = Math.max(mf.ruido < 0.25 ? Math.min(1, umbralMin) : umbralMin, mf.ruido * 1.25 + 1);
  const dist = new Float32Array(N), dL = new Float32Array(N), dab = new Float32Array(N), [bgL, bgA, bgB] = mf.mapas();
  for (let i = 0; i < N; i++) {
    const e0 = Lab[0][i] - bgL[i], e1 = Lab[1][i] - bgA[i], e2 = Lab[2][i] - bgB[i];
    dist[i] = Math.sqrt(e0 * e0 + e1 * e1 + e2 * e2); dL[i] = e0; dab[i] = Math.sqrt(e1 * e1 + e2 * e2);
  }
  const fg = new Uint8Array(N); for (let i = 0; i < N; i++) fg[i] = dist[i] > umbral ? 1 : 0;
  // Candidatos a sombra: más oscuros que el fondo, casi sin color propio, no negros.
  const cand = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (fg[i] && dL[i] < -umbral * 0.5 && dab[i] < Math.max(4, umbral * 1.2) && dL[i] > -70) cand[i] = 1;
  const nucleo = new Uint8Array(N); for (let i = 0; i < N; i++) nucleo[i] = fg[i] && !cand[i] ? 1 : 0;
  let cajaN = cajaDe(nucleo, W, H);
  const sombra = new Uint8Array(N), prod = Uint8Array.from(fg);
  if (cajaN) {
    // Apertura de 2 px: el halo fino de un reescalado (una línea gris de 1–2 px pegada al borde del producto) no debe unir
    // la sombra con el producto. Lo que la apertura quitó vuelve a la sombra si la toca.
    const abierta = dilatar(erosionar(cand, W, H, 2), W, H, 2); for (let i = 0; i < N; i++) abierta[i] &= cand[i];
    const { etq, comps } = componentes(abierta, W, H);
    const cerca = dilatar(nucleo, W, H, 3);
    const cy1 = cajaN.y + cajaN.h - 1;
    const esSombra = new Uint8Array(comps.length);
    const toca = new Uint8Array(comps.length), fuera = new Int32Array(comps.length);
    for (let i = 0; i < N; i++) {
      const k = etq[i]; if (!k) continue;
      if (cerca[i]) toca[k] = 1;
      const x = i % W, y = (i / W) | 0;
      if (x < cajaN.x || x >= cajaN.x + cajaN.w || y > cy1) fuera[k]++;
    }
    for (let k = 1; k < comps.length; k++) {
      const c = comps[k];
      const bajo = c.y0 >= cajaN.y + cajaN.h * 0.5;           // empieza en la mitad baja del producto o más abajo
      const base = c.y1 >= cy1 - Math.max(2, H * 0.02);       // llega a la línea de la base
      const sale = fuera[k] >= c.area * 0.3 || c.y0 >= cy1 - Math.max(2, cajaN.h * 0.1); // se extiende fuera del producto o es una franja bajo él
      const pegada = toca[k] || c.y0 <= cy1 + H * 0.05;
      if (bajo && base && sale && pegada) esSombra[k] = 1;
    }
    for (let i = 0; i < N; i++) if (etq[i] && esSombra[etq[i]]) { sombra[i] = 1; prod[i] = 0; }
    const borde = dilatar(sombra, W, H, 2); for (let i = 0; i < N; i++) if (cand[i] && !abierta[i] && borde[i]) { sombra[i] = 1; prod[i] = 0; }
  }
  // Motas fuera: se quedan las piezas de al menos 0,5 % de la mayor (un cable o una pata suelta siguen).
  { const { etq, comps } = componentes(prod, W, H); let mayor = 0; for (let k = 1; k < comps.length; k++) mayor = Math.max(mayor, comps[k].area);
    const min = Math.max(9, mayor * 0.005); for (let i = 0; i < N; i++) if (etq[i] && comps[etq[i]].area < min) prod[i] = 0; }
  rellenarHuecos(prod, W, H);
  for (let i = 0; i < N; i++) if (prod[i]) sombra[i] = 0;
  let metodo = 'borde';
  if (original && esRaw(original) && original.width === W && original.height === H) {
    const mo = mascara(original, { umbralMin });
    const guia = dilatar(mo.producto, W, H, Math.max(2, Math.round(Math.min(W, H) * 0.01)));
    for (let i = 0; i < N; i++) prod[i] = prod[i] && guia[i] ? 1 : (mo.producto[i] && dist[i] > umbral * 0.5 ? 1 : 0);
    rellenarHuecos(prod, W, H); metodo = 'original';
  }
  // Alfa con antialias: dentro 255, fuera 0, y en el anillo de ±1 px la fracción de mezcla = distancia ÷ la del producto vecino.
  const alfa = new Uint8Array(N);
  for (let i = 0; i < N; i++) alfa[i] = prod[i] ? 255 : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = prod[i];
    if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && prod[i - 1] === v && prod[i + 1] === v && prod[i - W] === v && prod[i + W] === v
      && prod[i - W - 1] === v && prod[i - W + 1] === v && prod[i + W - 1] === v && prod[i + W + 1] === v) continue; // lejos del borde
    let borde = false, maxD = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx; if (prod[j] !== prod[i]) borde = true; if (prod[j] && dist[j] > maxD) maxD = dist[j];
    }
    if (!borde || maxD <= 0) continue;
    const f = clamp(dist[i] / maxD, 0, 1);
    alfa[i] = prod[i] ? Math.round(255 * Math.max(f, 0.5)) : Math.round(255 * Math.min(f, 0.5) * (dist[i] > umbral * 0.5 ? 1 : 0));
  }
  return { width: W, height: H, producto: prod, alfa, sombra, bbox: cajaDe(prod, W, H), bboxSombra: cajaDe(sombra, W, H),
    fondo: labARgb(mf.medio[0], mf.medio[1], mf.medio[2]), umbral: +umbral.toFixed(2), liso: mf.liso, metodo,
    nucleo: cajaN, _modelo: { fondo: mf.fondo, bgL, dist } };
}

/** % de la franja del borde, fuera del producto, que es exactamente 255,255,255. */
export function fondoBordeBlanco(r, m) {
  const W = r.width, H = r.height, t = Math.max(2, Math.round(Math.min(W, H) * 0.02)); let tot = 0, ok = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!(x < t || y < t || x >= W - t || y >= H - t)) continue;
    const i = y * W + x;
    if (m) { const j = m.width === W && m.height === H ? i : Math.min(m.height - 1, Math.floor(y * m.height / H)) * m.width + Math.min(m.width - 1, Math.floor(x * m.width / W)); if (m.producto[j] || m.sombra[j]) continue; }
    tot++; const p = i * 4; if (r.data[p] === 255 && r.data[p + 1] === 255 && r.data[p + 2] === 255) ok++;
  }
  return tot ? ok / tot : 0;
}

/**
 * La máscara para MEDIR (no para pintar): sobre una copia de como mucho maxLado px (1024: 1 px = 0,1 % del lienzo), 4× más
 * rápida en una foto de 2048². Devuelve la máscara reducida y su caja llevada a los píxeles de la imagen original.
 */
export async function mascaraParaMedir(r, { maxLado = 1024, ...opts } = {}) {
  const lado = Math.max(r.width, r.height);
  if (lado <= maxLado) { const m = mascara(r, opts); return { m, bbox: m.bbox, bboxSombra: m.bboxSombra }; }
  const sharp = await S(), k = maxLado / lado, w = Math.max(1, Math.round(r.width * k)), h = Math.max(1, Math.round(r.height * k));
  const red = { data: await deRaw(sharp, r).resize(w, h, { kernel: 'cubic' }).raw().toBuffer(), width: w, height: h };
  let original;
  if (opts.original && esRaw(opts.original) && opts.original.width === r.width && opts.original.height === r.height)
    original = { data: await deRaw(sharp, opts.original).resize(w, h, { kernel: 'cubic' }).raw().toBuffer(), width: w, height: h };
  const m = mascara(red, { ...opts, original });
  const ampliar = b => b && ({ x: Math.round(b.x * r.width / w), y: Math.round(b.y * r.height / h), w: Math.round(b.w * r.width / w), h: Math.round(b.h * r.height / h) });
  return { m, bbox: ampliar(m.bbox), bboxSombra: ampliar(m.bboxSombra), reducida: red };
}

/** Medidas sin tocar la imagen: la caja del PRODUCTO (sin sombra), su ocupación y el fondo del borde. */
export async function medir(buf, opts = {}) {
  const r = await leer(buf); const mm = opts.mascara ? { m: opts.mascara, bbox: opts.mascara.bbox, bboxSombra: opts.mascara.bboxSombra } : await mascaraParaMedir(r, opts);
  const m = mm.m, b = mm.bbox;
  const ancho = b ? b.w / r.width : 0, alto = b ? b.h / r.height : 0;
  return { width: r.width, height: r.height, bbox: b, bboxSombra: mm.bboxSombra, ocupacion: +Math.max(ancho, alto).toFixed(4),
    ancho: +ancho.toFixed(4), alto: +alto.toFixed(4), fondoBorde: +fondoBordeBlanco(r, m).toFixed(4), liso: m.liso, umbral: m.umbral };
}

// ───────────────────────────── fondo blanco puro (D10) ─────────────────────────────
/**
 * Pone el color pedido (blanco por defecto) SOLO fuera de la máscara. En el anillo del borde se descontamina el color del
 * fondo viejo (out = píxel + (1 − α)·(nuevo − viejo)), así no queda halo. La sombra es una capa: 'conservar' la multiplica
 * sobre el fondo nuevo con su misma densidad, 'regenerar' pone una de contacto suave, 'quitar' la borra.
 */
export function fondoBlanco(r, { color = '#FFFFFF', sombra = 'conservar', mascara: m0 } = {}) {
  const W = r.width, H = r.height, N = W * H;
  const m = m0 || mascara(r);
  const nuevo = hexARgb(color) || [255, 255, 255], nuevoLin = nuevo.map(v => A_LINEAL[v]);
  const out = copiaRaw(r), d = out.data, tmp = [0, 0, 0];
  // La capa de sombra cubre una franja generosa alrededor de lo detectado (3 % del lado) y resta el ruido (2 %): así la sombra
  // se desvanece sola hasta el blanco, sin el escalón donde el umbral la cortaba.
  const rc = Math.max(3, Math.round(Math.min(W, H) * 0.03));
  const capa = sombra === 'conservar' && m.bboxSombra ? mediaCaja(dilatarCaja(m.sombra, W, H, rc), W, H, rc >> 1) : null; // 0..1, se apaga hacia el borde de la franja
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = i * 4, a = m.alfa[i] / 255;
    if (a >= 1) { d[p + 3] = 255; continue; }
    if (a > 0) {
      labARgb(m._modelo.fondo(x, y, 0), m._modelo.fondo(x, y, 1), m._modelo.fondo(x, y, 2), tmp);
      for (let c = 0; c < 3; c++) d[p + c] = c8(d[p + c] + (1 - a) * (nuevo[c] - tmp[c]));
      d[p + 3] = 255; continue;
    }
    let s = 0;
    if (capa && capa[i] > 0) { const yl = luma(r.data[p], r.data[p + 1], r.data[p + 2]); const bl = fInv((m._modelo.bgL[i] + 16) / 116); s = clamp((1 - yl / Math.max(1e-4, bl) - 0.02) / 0.98, 0, 0.95) * Math.min(1, capa[i] * 2); if (s < 0.004) s = 0; }
    for (let c = 0; c < 3; c++) d[p + c] = s ? srgb8(nuevoLin[c] * (1 - s)) : nuevo[c];
    d[p + 3] = 255;
  }
  if (sombra === 'regenerar' && m.bbox) sombraDeContacto(out, m);
  return { raw: out, mascara: m };
}
function sombraDeContacto(out, m) { // elipse suave bajo la base, opacidad 0,35, solo sobre lo que no es producto
  const W = out.width, H = out.height, b = m.bbox, cx = b.x + b.w / 2, cy = b.y + b.h - 1, rx = b.w * 0.55, ry = Math.max(3, b.w * 0.05);
  for (let y = Math.max(0, Math.floor(cy - ry * 2)); y < Math.min(H, Math.ceil(cy + ry * 2)); y++) for (let x = Math.max(0, Math.floor(cx - rx * 1.5)); x < Math.min(W, Math.ceil(cx + rx * 1.5)); x++) {
    const i = y * W + x; if (m.alfa[i] >= 255) continue;
    const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; const s = 0.35 * Math.exp(-2 * e) * (1 - m.alfa[i] / 255); if (s < 0.005) continue;
    const p = i * 4; for (let c = 0; c < 3; c++) out.data[p + c] = srgb8(A_LINEAL[out.data[p + c]] * (1 - s));
  }
}

// ───────────────────────────── encuadrar sobre la caja del producto (D9) ─────────────────────────────
/** La escala que deja la caja del producto en `ocupacion` del lienzo (lado que manda) respetando el aire mínimo por lado. */
export function escalaPara(bbox, { ancho, alto, ocupacion = 0.75, aireMinPx = 0 }) {
  let s = Math.min(ocupacion * ancho / bbox.w, ocupacion * alto / bbox.h);
  if (aireMinPx > 0) s = Math.min(s, (ancho - 2 * aireMinPx) / bbox.w, (alto - 2 * aireMinPx) / bbox.h);
  return s;
}
/**
 * «Misma escala en toda la serie»: con medidas en cm (`cm: { ancho, alto }` por foto) cada foto sale a los mismos px por cm
 * (la cama king más grande que la queen); sin medidas, el mismo factor para todas (la mayor de la serie manda).
 * items: [{ bbox, cm? }] → una escala por foto.
 */
export function escalaSerie(items, opts) {
  if (!items.length) return [];
  if (items.every(it => it.cm && it.cm.ancho > 0 && it.cm.alto > 0)) {
    const pxPorCm = Math.min(...items.map(it => escalaPara({ w: it.cm.ancho, h: it.cm.alto }, opts)));
    return items.map(it => pxPorCm * it.cm.ancho / it.bbox.w);
  }
  const s = Math.min(...items.map(it => escalaPara(it.bbox, opts)));
  return items.map(() => s);
}

export async function encuadrar(r, { ancho, alto, ocupacion = 0.75, alinear = 'centro', base = 0.85, aireMinPx = 0, fondo, escalaFija, mascara: m0 } = {}) {
  const sharp = await S();
  ancho = Math.round(ancho || r.width); alto = Math.round(alto || r.height);
  const m = m0 || mascara(r), b = m.bbox, avisos = [];
  if (!b) return { raw: r, medido: { ocupacion: null, motivo: 'no se encontró el producto' }, avisos: ['No se encontró el producto en la foto: no se encuadró.'] };
  let s = escalaFija > 0 ? escalaFija : escalaPara(b, { ancho, alto, ocupacion, aireMinPx });
  if (!(s > 0)) { s = escalaPara(b, { ancho, alto, ocupacion }); avisos.push('El aire mínimo no cabe en este lienzo: se usó solo la ocupación.'); }
  if (s > 1.5) avisos.push(`La foto se agrandó ${s.toFixed(1)}×: puede perder nitidez (la original es pequeña para este canal).`);
  const rw = Math.max(1, Math.round(r.width * s)), rh = Math.max(1, Math.round(r.height * s));
  const relleno = hexARgb(fondo) || m.fondo || [255, 255, 255];
  const bw = b.w * s, bh = b.h * s;
  const left = Math.round(ancho / 2 - (b.x * s + bw / 2));
  let top = alinear === 'base' ? Math.round(base * alto - (b.y * s + bh)) : Math.round(alto / 2 - (b.y * s + bh / 2));
  if (alinear === 'base' && aireMinPx > 0) { const arriba = top + b.y * s; if (arriba < aireMinPx) top += Math.round(aireMinPx - arriba); }
  const cubre = left <= 0 && top <= 0 && left + rw >= ancho && top + rh >= alto;
  if (!cubre && !m.liso && !fondo) avisos.push('El fondo no es liso: el relleno de alrededor se nota. Extender una escena de verdad lo hace la IA, y se pide aparte.');
  const escalada = await deRaw(sharp, r).resize(rw, rh, { kernel: 'lanczos3' }).raw().toBuffer();
  const sx = Math.max(0, -left), sy = Math.max(0, -top), dx = Math.max(0, left), dy = Math.max(0, top);
  const w = Math.min(rw - sx, ancho - dx), h = Math.min(rh - sy, alto - dy);
  const lienzo = nuevoRaw(ancho, alto, [...relleno, 255]);
  if (w > 0 && h > 0) for (let y = 0; y < h; y++) escalada.copy(lienzo.data, ((dy + y) * ancho + dx) * 4, ((sy + y) * rw + sx) * 4, ((sy + y) * rw + sx + w) * 4);
  const caja = { x: Math.round(left + b.x * s), y: Math.round(top + b.y * s), w: Math.round(bw), h: Math.round(bh) };
  const recortado = caja.x < 0 || caja.y < 0 || caja.x + caja.w > ancho || caja.y + caja.h > alto;
  if (recortado) avisos.push('El producto no cabe entero en el lienzo con esta escala.');
  return { raw: lienzo, escala: s, avisos,
    medido: { ocupacion: +Math.max(bw / ancho, bh / alto).toFixed(4), ancho: +(bw / ancho).toFixed(4), alto: +(bh / alto).toFixed(4), bbox: caja,
      aire: { izq: caja.x, der: ancho - caja.x - caja.w, arriba: caja.y, abajo: alto - caja.y - caja.h }, recortado } };
}

/** Agranda el lienzo con el color del fondo. Solo si el fondo es liso; si no, no lo inventa: pide la IA. */
export function extender(r, { px, factor, color, mascara: m0 } = {}) {
  const m = m0 || mascara(r);
  if (!m.liso && !color) return { necesitaIA: true, aviso: 'El fondo no es liso: dar más espacio alrededor de una escena lo hace la IA (regenera los bordes).' };
  const extra = px != null ? Math.round(px) : Math.round(Math.max(r.width, r.height) * ((factor || 1.2) - 1) / 2);
  const W = r.width + 2 * extra, H = r.height + 2 * extra, c = hexARgb(color) || m.fondo;
  const out = nuevoRaw(W, H, [...c, 255]);
  for (let y = 0; y < r.height; y++) r.data.copy(out.data, ((y + extra) * W + extra) * 4, y * r.width * 4, (y + 1) * r.width * 4);
  return { raw: out };
}

// ───────────────────────────── tonos (curvas 1D sobre el raw) ─────────────────────────────
function aplicarCurva(r, f, mezcla) { // f: 0..1 → 0..1 sobre cada canal; mezcla opcional (Uint8 0..255 por píxel)
  const lut = new Uint8Array(256); for (let i = 0; i < 256; i++) lut[i] = c8(clamp(f(i / 255), 0, 1) * 255);
  const out = copiaRaw(r), d = out.data;
  for (let p = 0, i = 0; p < d.length; p += 4, i++) {
    if (mezcla) { const a = mezcla[i] / 255; if (!a) continue; for (let c = 0; c < 3; c++) d[p + c] = c8(d[p + c] + a * (lut[d[p + c]] - d[p + c])); }
    else { d[p] = lut[d[p]]; d[p + 1] = lut[d[p + 1]]; d[p + 2] = lut[d[p + 2]]; }
  }
  return out;
}
/** Exposición en pasos (EV), en luz lineal: +1 dobla la luz. */
export const exposicion = (r, ev = 0.4) => { const k = Math.pow(2, ev); const lut = new Uint8Array(256); for (let i = 0; i < 256; i++) lut[i] = srgb8(A_LINEAL[i] * k);
  const out = copiaRaw(r), d = out.data; for (let p = 0; p < d.length; p += 4) { d[p] = lut[d[p]]; d[p + 1] = lut[d[p + 1]]; d[p + 2] = lut[d[p + 2]]; } return out; };
/** Levanta (o hunde, si es negativo) las sombras sin tocar el blanco ni el negro puros. */
export const sombras = (r, c = 0.4) => aplicarCurva(r, x => x + clamp(c, -1, 1) * 2.5 * x * (1 - x) * (1 - x));
/** Recupera (negativo) o empuja las altas luces sin tocar los extremos. */
export const altas = (r, c = -0.4) => aplicarCurva(r, x => x + clamp(c, -1, 1) * 2.5 * x * x * (1 - x));
/** Contraste en S alrededor del gris medio (c de −0,45 a 0,45). */
export const contraste = (r, c = 0.2) => { c = clamp(c, -0.45, 0.45); return aplicarCurva(r, x => x - c * Math.sin(2 * Math.PI * x) / Math.PI); };
const esPiel = (r, g, b) => r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15 && Math.abs(r - g) > 15;
/** Saturación: mezcla con la luminancia. La piel se toca a un 30 % (protegerPiel). */
export function saturacion(r, c = 0.2, { protegerPiel = true } = {}) {
  const out = copiaRaw(r), d = out.data;
  for (let p = 0; p < d.length; p += 4) {
    const R = d[p], G = d[p + 1], B = d[p + 2], k = 1 + c * (protegerPiel && esPiel(R, G, B) ? 0.3 : 1);
    const Y = 0.299 * R + 0.587 * G + 0.114 * B;
    d[p] = c8(Y + (R - Y) * k); d[p + 1] = c8(Y + (G - Y) * k); d[p + 2] = c8(Y + (B - Y) * k);
  }
  return out;
}
function ganancias(r, gains) { // ganancias por canal en luz lineal
  const luts = gains.map(g => { const l = new Uint8Array(256); for (let i = 0; i < 256; i++) l[i] = srgb8(A_LINEAL[i] * g); return l; });
  const out = copiaRaw(r), d = out.data; for (let p = 0; p < d.length; p += 4) { d[p] = luts[0][d[p]]; d[p + 1] = luts[1][d[p + 1]]; d[p + 2] = luts[2][d[p + 2]]; } return out;
}
/**
 * Balance de blancos. 'mundo-gris': la media de los medios tonos (sin quemados ni negros) debe ser gris; 'neutro': el color
 * dado (un punto que debería ser blanco o gris) pasa a neutro. Se normaliza para no cambiar la luminancia.
 */
export function balance(r, { metodo = 'mundo-gris', neutro, fuerza = 1 } = {}) {
  let m;
  if (metodo === 'neutro' && neutro) m = (Array.isArray(neutro) ? neutro : hexARgb(neutro)).map(v => A_LINEAL[c8(v)]);
  else { const s = [0, 0, 0]; let n = 0; const d = r.data;
    for (let p = 0; p < d.length; p += 4) { const mx = Math.max(d[p], d[p + 1], d[p + 2]), mn = Math.min(d[p], d[p + 1], d[p + 2]); if (mx > 245 || mn < 10) continue; s[0] += A_LINEAL[d[p]]; s[1] += A_LINEAL[d[p + 1]]; s[2] += A_LINEAL[d[p + 2]]; n++; }
    if (!n) return copiaRaw(r); m = s.map(v => v / n); }
  const Y = 0.2126729 * m[0] + 0.7151522 * m[1] + 0.0721750 * m[2];
  return ganancias(r, m.map(v => 1 + fuerza * (Y / Math.max(1e-6, v) - 1)));
}
/** Quitar un tono (dominante): balance sobre los píxeles casi neutros, a un 70 %, para no apagar los colores de verdad. */
export function dominante(r, { fuerza = 0.7 } = {}) {
  const s = [0, 0, 0]; let n = 0; const d = r.data, lab = [0, 0, 0];
  for (let p = 0; p < d.length; p += 16) { rgbALab(d[p], d[p + 1], d[p + 2], lab); if (lab[0] < 15 || lab[0] > 97 || Math.hypot(lab[1], lab[2]) > 25) continue; s[0] += A_LINEAL[d[p]]; s[1] += A_LINEAL[d[p + 1]]; s[2] += A_LINEAL[d[p + 2]]; n++; }
  if (n < 20) return balance(r, { fuerza });
  return balance(r, { metodo: 'neutro', neutro: s.map(v => srgb8(v / n)), fuerza });
}
/** Más cálida (k > 0) o más fría, en grados aproximados respecto de la luz de día. */
export function temperatura(r, k = 600) { const t = clamp(k / 6500, -0.5, 0.5); return ganancias(r, [1 + t * 0.6, 1 + t * 0.1, 1 - t * 0.6]); }
export function blancoYNegro(r, { contraste: c = 0.15 } = {}) {
  const out = copiaRaw(r), d = out.data; for (let p = 0; p < d.length; p += 4) { const y = srgb8(luma(d[p], d[p + 1], d[p + 2])); d[p] = d[p + 1] = d[p + 2] = y; }
  return c ? contraste(out, c) : out;
}
/** Auto niveles: estira la luminancia entre el 0,5 % y el 99,5 %, igual para los tres canales (no cambia el color). */
export function autoNiveles(r) {
  const h = new Uint32Array(256), d = r.data; let n = 0;
  for (let p = 0; p < d.length; p += 4) { h[c8(0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2])]++; n++; }
  let lo = 0, hi = 255, acc = 0; for (; lo < 255; lo++) { acc += h[lo]; if (acc > n * 0.005) break; }
  acc = 0; for (; hi > 0; hi--) { acc += h[hi]; if (acc > n * 0.005) break; }
  if (hi - lo < 10) return copiaRaw(r);
  return aplicarCurva(r, x => (x * 255 - lo) / (hi - lo));
}
/** Grano de película, determinista (misma semilla, mismo grano: el lote no parpadea). */
export function grano(r, cantidad = 0.05, semilla = 1) {
  const out = copiaRaw(r), d = out.data; let s = (semilla * 2654435761) >>> 0;
  for (let p = 0; p < d.length; p += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s / 4294967296) - 0.5) * 2 * cantidad * 255; d[p] = c8(d[p] + n); d[p + 1] = c8(d[p + 1] + n); d[p + 2] = c8(d[p + 2] + n); }
  return out;
}
export async function nitidez(r, sigma = 1) { const sharp = await S(); return { data: await deRaw(sharp, r).sharpen({ sigma }).raw().toBuffer(), width: r.width, height: r.height }; }
export async function ruido(r, radio = 1) { const sharp = await S(); return { data: await deRaw(sharp, r).median(2 * Math.round(radio) + 1).raw().toBuffer(), width: r.width, height: r.height }; }

/**
 * El ángulo del horizonte en grados (positivo = la imagen está girada en sentido horario: una línea que debería ser
 * horizontal baja hacia la derecha). Por proyección: los bordes fuertes casi horizontales (y los casi verticales) se proyectan
 * sobre la normal de cada ángulo candidato (de -8° a 8°, cada 0,1°); el ángulo que más concentra la proyección es el de las
 * líneas. Aguanta el escalonado de los bordes sin antialias, que engaña a un histograma de gradientes. 0 si no hay líneas claras.
 */
export function anguloHorizonte(r) {
  const k = Math.min(1, 512 / Math.max(r.width, r.height)), W = Math.max(8, Math.round(r.width * k)), H = Math.max(8, Math.round(r.height * k));
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = (Math.min(r.height - 1, Math.floor(y / k)) * r.width + Math.min(r.width - 1, Math.floor(x / k))) * 4; g[y * W + x] = 0.299 * r.data[p] + 0.587 * r.data[p + 1] + 0.114 * r.data[p + 2]; }
  const pts = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, a = g[i - W - 1], b = g[i - W], c = g[i - W + 1], dd = g[i - 1], f = g[i + 1], h = g[i + W - 1], ii = g[i + W], j = g[i + W + 1];
    const gx = (c + 2 * f + j) - (a + 2 * dd + h), gy = (h + 2 * ii + j) - (a + 2 * b + c), m = Math.hypot(gx, gy);
    if (m < 60) continue;
    const ang = Math.atan2(Math.abs(Math.abs(gy) > Math.abs(gx) ? gx : gy), Math.abs(Math.abs(gy) > Math.abs(gx) ? gy : gx)) * 180 / Math.PI;
    if (ang > 12) continue; // ni horizontal ni vertical
    pts.push(x, y, m, Math.abs(gy) > Math.abs(gx) ? 0 : 1);
  }
  if (pts.length < 4 * 20) return 0;
  const n = Math.max(W, H) * 2 + 4, hist = new Float64Array(n * 2), puntos = [];
  for (let t = -80; t <= 80; t++) {
    const th = t / 10 * Math.PI / 180, co = Math.cos(th), si = Math.sin(th); hist.fill(0);
    for (let q = 0; q < pts.length; q += 4) {
      const x = pts[q], y = pts[q + 1], fam = pts[q + 3];
      const rho = fam === 0 ? y * co - x * si : x * co + y * si;
      hist[fam * n + clamp(Math.round(rho) + (n >> 1), 0, n - 1)] += pts[q + 2];
    }
    let s = 0; for (let b = 0; b < hist.length; b++) s += hist[b] * hist[b];
    puntos.push(s);
  }
  let mejor = 0; for (let i = 1; i < puntos.length; i++) if (puntos[i] > puntos[mejor]) mejor = i;
  const orden = Float64Array.from(puntos).sort(), med = orden[orden.length >> 1];
  if (!(puntos[mejor] > med * 1.15)) return 0;
  return +((mejor - 80) / 10).toFixed(1);
}
/** Endereza hasta ±5°; más que eso no lo hace (lo dice: es trabajo de la IA). Recorta el rectángulo interior y vuelve al tamaño. */
export async function rotarHorizonte(r, { angulo, maximo = 5 } = {}) {
  const a = angulo ?? anguloHorizonte(r);
  if (!a || Math.abs(a) < 0.1) return { raw: r, angulo: 0 };
  if (Math.abs(a) > maximo) return { raw: r, angulo: a, necesitaIA: true, aviso: `La foto está torcida ${Math.abs(a).toFixed(1)}°: más de ${maximo}° lo endereza la IA, aparte.` };
  const sharp = await S(), W = r.width, H = r.height, t = Math.abs(a) * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const rot = await deRaw(sharp, r).rotate(-a, { background: { r: 255, g: 255, b: 255, alpha: 1 } }).raw().toBuffer({ resolveWithObject: true });
  const k = Math.min(W / (W * c + H * s), H / (W * s + H * c)), cw = Math.floor(W * k), ch = Math.floor(H * k);
  const data = await sharp(rot.data, { raw: { width: rot.info.width, height: rot.info.height, channels: 4 } })
    .extract({ left: Math.floor((rot.info.width - cw) / 2), top: Math.floor((rot.info.height - ch) / 2), width: cw, height: ch })
    .resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer();
  return { raw: { data, width: W, height: H }, angulo: a };
}

// ───────────────────────────── LUT .cube (D8) ─────────────────────────────
/** Lee un .cube (3D o 1D). Devuelve { tipo: '3d'|'1d', tamano, min, max, datos: Float32Array (r más rápido), titulo }. */
export function leerCube(texto) {
  let tamano = 0, tipo = '3d', titulo = '', min = [0, 0, 0], max = [1, 1, 1]; const vals = [];
  for (const linea of String(texto).split(/\r?\n/)) {
    const l = linea.trim(); if (!l || l.startsWith('#')) continue;
    const p = l.split(/\s+/), k = p[0].toUpperCase();
    if (k === 'TITLE') titulo = l.slice(5).trim().replace(/^"|"$/g, '');
    else if (k === 'LUT_3D_SIZE') { tamano = +p[1]; tipo = '3d'; }
    else if (k === 'LUT_1D_SIZE') { tamano = +p[1]; tipo = '1d'; }
    else if (k === 'DOMAIN_MIN') min = p.slice(1, 4).map(Number);
    else if (k === 'DOMAIN_MAX') max = p.slice(1, 4).map(Number);
    else if (/^[-+.\d]/.test(p[0]) && p.length >= 3) vals.push(+p[0], +p[1], +p[2]);
  }
  const esperado = tipo === '3d' ? tamano ** 3 * 3 : tamano * 3;
  if (!(tamano >= 2) || (tipo === '3d' && tamano > 256)) throw new Error('El .cube no dice su tamaño (LUT_3D_SIZE o LUT_1D_SIZE).');
  if (vals.length !== esperado) throw new Error(`El .cube trae ${vals.length / 3} colores y su tamaño pide ${esperado / 3}.`);
  if (vals.some(v => !Number.isFinite(v))) throw new Error('El .cube tiene valores que no son números.');
  return { tipo, tamano, min, max, titulo, datos: Float32Array.from(vals) };
}
export function lutDeFuncion(fn, tamano = 33, titulo = '') {
  const n = tamano, datos = new Float32Array(n * n * n * 3), o = [0, 0, 0];
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) { fn(r / (n - 1), g / (n - 1), b / (n - 1), o); const i = ((b * n + g) * n + r) * 3; datos[i] = o[0]; datos[i + 1] = o[1]; datos[i + 2] = o[2]; }
  return { tipo: '3d', tamano: n, min: [0, 0, 0], max: [1, 1, 1], titulo, datos };
}
export const lutIdentidad = (n = 33) => lutDeFuncion((r, g, b, o) => { o[0] = r; o[1] = g; o[2] = b; }, n, 'Identidad');
/** Escribe un .cube 3D (de 17, 33 o 65) que abren DaVinci, Premiere, CapCut y el lote de video. */
export function exportarCube(lut, titulo) {
  const n = lut.tamano, out = [`TITLE "${String(titulo || lut.titulo || 'Agents Office').replace(/"/g, "'")}"`, `LUT_${lut.tipo === '1d' ? '1D' : '3D'}_SIZE ${n}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let i = 0; i < lut.datos.length; i += 3) out.push(`${lut.datos[i].toFixed(6)} ${lut.datos[i + 1].toFixed(6)} ${lut.datos[i + 2].toFixed(6)}`);
  return out.join('\n') + '\n';
}
/** Aplica una LUT con interpolación trilineal (3D) o lineal (1D). fuerza 0..1 mezcla con el original. */
export function aplicarLut(r, lut, fuerza = 1) {
  if (typeof lut === 'string') lut = leerCube(lut);
  const n = lut.tamano, D = lut.datos, out = copiaRaw(r), d = out.data, o = [0, 0, 0];
  const norm = (v, c) => clamp((v / 255 - lut.min[c]) / ((lut.max[c] - lut.min[c]) || 1), 0, 1) * (n - 1);
  const cache = new Map();
  for (let p = 0; p < d.length; p += 4) {
    const key = (d[p] << 16) | (d[p + 1] << 8) | d[p + 2]; let v = cache.get(key);
    if (v === undefined) {
      if (lut.tipo === '1d') for (let c = 0; c < 3; c++) { const x = norm(d[p + c], c), i0 = Math.floor(x), i1 = Math.min(n - 1, i0 + 1), f = x - i0; o[c] = D[i0 * 3 + c] * (1 - f) + D[i1 * 3 + c] * f; }
      else {
        const x = norm(d[p], 0), y = norm(d[p + 1], 1), z = norm(d[p + 2], 2);
        const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), z1 = Math.min(n - 1, z0 + 1);
        const fx = x - x0, fy = y - y0, fz = z - z0, at = (a, b, c, k) => D[((c * n + b) * n + a) * 3 + k];
        for (let k = 0; k < 3; k++) {
          const c00 = at(x0, y0, z0, k) * (1 - fx) + at(x1, y0, z0, k) * fx, c10 = at(x0, y1, z0, k) * (1 - fx) + at(x1, y1, z0, k) * fx;
          const c01 = at(x0, y0, z1, k) * (1 - fx) + at(x1, y0, z1, k) * fx, c11 = at(x0, y1, z1, k) * (1 - fx) + at(x1, y1, z1, k) * fx;
          o[k] = (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz;
        }
      }
      v = (c8(o[0] * 255) << 16) | (c8(o[1] * 255) << 8) | c8(o[2] * 255); cache.set(key, v);
    }
    const R = (v >> 16) & 255, G = (v >> 8) & 255, B = v & 255;
    if (fuerza >= 1) { d[p] = R; d[p + 1] = G; d[p + 2] = B; }
    else { d[p] = c8(d[p] + fuerza * (R - d[p])); d[p + 1] = c8(d[p + 1] + fuerza * (G - d[p + 1])); d[p + 2] = c8(d[p + 2] + fuerza * (B - d[p + 2])); }
  }
  return out;
}

// ───────────────────────────── transferencia de color Reinhard en Lab (D8) ─────────────────────────────
/** Media y desviación de L, a, b (en la máscara 0/1 si se da). */
export function estadisticasLab(r, m) {
  const d = r.data, s = [0, 0, 0], q = [0, 0, 0], lab = [0, 0, 0]; let n = 0;
  for (let i = 0, p = 0; p < d.length; i++, p += 4) { if (m && !m[i]) continue; rgbALab(d[p], d[p + 1], d[p + 2], lab); for (let c = 0; c < 3; c++) { s[c] += lab[c]; q[c] += lab[c] * lab[c]; } n++; }
  if (!n) return null;
  const media = s.map(v => v / n);
  return { media, desv: q.map((v, c) => Math.sqrt(Math.max(0, v / n - media[c] * media[c]))), n };
}
function mapaReinhard(origen, destino, fuerza) {
  const k = [0, 1, 2].map(c => destino.desv[c] / Math.max(0.5, origen.desv[c])).map(v => clamp(v, 0.25, 4));
  return (lab, out) => { for (let c = 0; c < 3; c++) { const t = (lab[c] - origen.media[c]) * k[c] + destino.media[c]; out[c] = lab[c] + fuerza * (t - lab[c]); } return out; };
}
/**
 * «Copiar color»: lleva la media y la desviación en Lab de la foto a las de la referencia (Reinhard). zona 'producto' toca
 * solo dentro de la máscara del producto (con su borde suave); 'todo', la imagen entera. fuerza 0,4 / 0,7 / 1.
 */
export function transferirColor(r, ref, { fuerza = 1, zona = 'todo', zonaReferencia = 'todo', mascara: m0 } = {}) {
  const m = zona === 'producto' ? (m0 || mascara(r)) : null;
  const mr = zonaReferencia === 'producto' ? mascara(ref).producto : null;
  const eo = estadisticasLab(r, m && m.producto), ed = estadisticasLab(ref, mr);
  if (!eo || !ed) return { raw: copiaRaw(r), aviso: 'No había producto que medir: el color no se copió.' };
  const f = mapaReinhard(eo, ed, fuerza), out = copiaRaw(r), d = out.data, lab = [0, 0, 0], o = [0, 0, 0], rgb = [0, 0, 0];
  for (let i = 0, p = 0; p < d.length; i++, p += 4) {
    const a = m ? m.alfa[i] / 255 : 1; if (!a) continue;
    rgbALab(d[p], d[p + 1], d[p + 2], lab); f(lab, o); labARgb(o[0], o[1], o[2], rgb);
    for (let c = 0; c < 3; c++) d[p + c] = a >= 1 ? rgb[c] : c8(d[p + c] + a * (rgb[c] - d[p + c]));
  }
  return { raw: out, origen: eo, destino: ed };
}
/** «Guardar este color como LUT»: la misma transferencia, escrita como .cube de 33 para el lote y el video. */
export function guardarColorComoLut(r, ref, { fuerza = 1, tamano = 33, titulo = 'Color copiado', zonaReferencia = 'todo' } = {}) {
  const mr = zonaReferencia === 'producto' ? mascara(ref).producto : null;
  const eo = estadisticasLab(r), ed = estadisticasLab(ref, mr), f = mapaReinhard(eo, ed, fuerza), lab = [0, 0, 0], o = [0, 0, 0];
  const lut = lutDeFuncion((R, G, B, out) => { linealALab(A_LINEAL[c8(R * 255)], A_LINEAL[c8(G * 255)], A_LINEAL[c8(B * 255)], lab); f(lab, o); labALineal(o[0], o[1], o[2], out); for (let c = 0; c < 3; c++) out[c] = srgb8(out[c]) / 255; }, tamano, titulo);
  return { lut, cube: exportarCube(lut, titulo) };
}

// ───────────────────────────── igualar la serie ─────────────────────────────
/** Lo que se iguala en una serie: exposición (L medio del producto), temperatura (a*, b* medios) y la línea del suelo. */
export function medirSerie(r, m0) {
  const m = m0 || mascara(r), e = estadisticasLab(r, m.producto);
  return { exposicion: e ? +e.media[0].toFixed(2) : null, a: e ? +e.media[1].toFixed(2) : null, b: e ? +e.media[2].toFixed(2) : null,
    lineaSuelo: m.bbox ? +((m.bbox.y + m.bbox.h) / r.height).toFixed(4) : null };
}
export function igualarSerie(r, patron, { mascara: m0 } = {}) {
  const m = m0 || mascara(r), act = medirSerie(r, m);
  if (act.exposicion == null || patron?.exposicion == null) return { raw: copiaRaw(r), aviso: 'Sin producto que medir: la serie no se igualó en esta foto.' };
  const yAct = fInv((act.exposicion + 16) / 116), yPat = fInv((patron.exposicion + 16) / 116);
  const ev = clamp(Math.log2(yPat / Math.max(1e-4, yAct)), -1, 1);
  let out = exposicion(r, ev);
  const da = clamp((patron.a ?? act.a) - act.a, -10, 10), db = clamp((patron.b ?? act.b) - act.b, -10, 10);
  if (Math.abs(da) > 0.3 || Math.abs(db) > 0.3) {
    const d = out.data, lab = [0, 0, 0], rgb = [0, 0, 0];
    for (let p = 0; p < d.length; p += 4) { rgbALab(d[p], d[p + 1], d[p + 2], lab); labARgb(lab[0], lab[1] + da, lab[2] + db, rgb); d[p] = rgb[0]; d[p + 1] = rgb[1]; d[p + 2] = rgb[2]; }
  }
  return { raw: out, ev: +ev.toFixed(3), da: +da.toFixed(2), db: +db.toFixed(2) };
}

// ───────────────────────────── exportar (D20) ─────────────────────────────
export function nombreArchivo({ sku, n = 1, formato = 'jpg' } = {}) {
  const base = String(sku || 'foto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'foto';
  return `${base}_${String(n).padStart(2, '0')}.${EXT[normFormato(formato)]}`;
}
const proporcionANumero = p => { const m = /^(\d+(?:[.,]\d+)?):(\d+(?:[.,]\d+)?)$/.exec(String(p || '')); return m ? parseFloat(m[1].replace(',', '.')) / parseFloat(m[2].replace(',', '.')) : null; };
/**
 * Al tamaño exacto del canal, en sRGB con su ICC, sin EXIF ni GPS. ajuste 'recortar' llena el cuadro (centrado en el producto
 * si se conoce su caja); 'rellenar' lo mete entero con el fondo. Con pesoMaxKB busca la mejor calidad que cabe. JPG 4:4:4
 * en los marketplaces (Amazon, Mercado Libre…: canal.grupo 'otras' o marketplace: true).
 */
export async function exportar(r, opts = {}) {
  const sharp = await S(), canal = opts.canal || {}, avisos = [];
  let W = Math.round(opts.ancho || canal.ancho || r.width), H = Math.round(opts.alto || canal.alto || r.height);
  if (!opts.alto && !canal.alto && proporcionANumero(opts.proporcion || canal.proporcion)) H = Math.round(W / proporcionANumero(opts.proporcion || canal.proporcion));
  const formato = normFormato(opts.formato || canal.formato || 'jpg');
  const fondo = opts.fondo || canal.fondo || '#FFFFFF', ajuste = opts.ajuste || 'recortar';
  const pesoMaxKB = opts.pesoMaxKB ?? canal.pesoMaxKB;
  const marketplace = opts.marketplace ?? canal.grupo === 'otras';
  let img;
  if (r.width === W && r.height === H) img = deRaw(sharp, r);
  else if (ajuste === 'rellenar') img = sharp(await deRaw(sharp, r).resize(W, H, { fit: 'contain', background: fondo, kernel: 'lanczos3' }).png().toBuffer());
  else { // recortar: escala para cubrir y ventana centrada en el producto (o en el centro)
    const s = Math.max(W / r.width, H / r.height), cw = Math.min(r.width, Math.round(W / s)), ch = Math.min(r.height, Math.round(H / s));
    const foco = opts.bbox ? { x: opts.bbox.x + opts.bbox.w / 2, y: opts.bbox.y + opts.bbox.h / 2 } : { x: r.width / 2, y: r.height / 2 };
    const left = clamp(Math.round(foco.x - cw / 2), 0, r.width - cw), top = clamp(Math.round(foco.y - ch / 2), 0, r.height - ch);
    if (opts.bbox && (opts.bbox.x < left || opts.bbox.y < top || opts.bbox.x + opts.bbox.w > left + cw || opts.bbox.y + opts.bbox.h > top + ch)) avisos.push('Para esta proporción el recorte corta el producto: mejor «rellenar» o encuadrar antes.');
    img = sharp(await deRaw(sharp, r).extract({ left, top, width: cw, height: ch }).resize(W, H, { kernel: 'lanczos3' }).png().toBuffer());
  }
  const raw = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const fin = { data: raw.data, width: raw.info.width, height: raw.info.height };
  const sub = marketplace ? '4:4:4' : (opts.subMuestreo || '4:2:0');
  let calidad = opts.calidad || 90, buffer = await codificar(fin, { formato, calidad, fondo, subMuestreo: sub });
  if (pesoMaxKB && formato !== 'png' && buffer.length > pesoMaxKB * 1024) { // búsqueda binaria de la calidad
    let lo = 50, hi = calidad - 1, mejor = null;
    while (lo <= hi) { const q = (lo + hi) >> 1; const b = await codificar(fin, { formato, calidad: q, fondo, subMuestreo: sub }); if (b.length <= pesoMaxKB * 1024) { mejor = { b, q }; lo = q + 1; } else hi = q - 1; }
    if (mejor) { buffer = mejor.b; calidad = mejor.q; } else { buffer = await codificar(fin, { formato, calidad: 50, fondo, subMuestreo: sub }); calidad = 50; avisos.push(`No cabe en ${pesoMaxKB} KB ni con calidad 50 (pesa ${Math.round(buffer.length / 1024)} KB).`); }
  } else if (pesoMaxKB && formato === 'png' && buffer.length > pesoMaxKB * 1024) avisos.push(`El PNG pesa ${Math.round(buffer.length / 1024)} KB, más que los ${pesoMaxKB} KB del canal.`);
  return { buffer, raw: fin, formato: EXT[formato], ancho: W, alto: H, kb: +(buffer.length / 1024).toFixed(1), calidad: formato === 'png' ? null : calidad,
    subMuestreo: formato === 'jpeg' ? sub : null, nombre: opts.sku ? nombreArchivo({ sku: opts.sku, n: opts.n, formato }) : null, avisos };
}
/** Un archivo por canal («Recortar para cada red»). */
export async function exportarVarios(r, canales, opts = {}) {
  const out = [];
  for (const canal of canales || []) out.push({ canal: canal.id, ...(await exportar(r, { ...opts, canal })) });
  return out;
}

// ───────────────────────────── el pipeline (lo llama runJob antes de store, §5.5 y §5.9) ─────────────────────────────
export const OPERACIONES = ['fondo-blanco', 'capa-sombra', 'encuadrar', 'extender', 'exposicion', 'sombras', 'altas', 'contraste', 'saturacion',
  'balance', 'dominante', 'temperatura', 'blanco-y-negro', 'auto-niveles', 'grano', 'nitidez', 'ruido', 'rotar-horizonte', 'lut', 'lut3d',
  'transferir-color', 'exportar-lut', 'igualar-serie', 'exportar', 'exportar-varios', 'quitar-exif'];
const GEOMETRIA = new Set(['encuadrar', 'extender', 'rotar-horizonte', 'exportar']);
const DIR_LUTS = path.join(RAIZ, 'presets', 'luts');
function leerLutDeArchivo(archivo, raiz = RAIZ) {
  const ruta = path.resolve(raiz, archivo), dir = path.resolve(raiz, 'presets', 'luts');
  if (!ruta.startsWith(dir + path.sep) || !ruta.toLowerCase().endsWith('.cube')) throw new Error('Una LUT de fábrica solo se lee de presets/luts/*.cube.');
  // sin la ruta de la máquina en el aviso (revisión F1: «ENOENT C:\\…\\pastel.cube» llegaba a la galería)
  try { return fs.readFileSync(ruta, 'utf8'); } catch { throw new Error(`falta la LUT «${path.basename(ruta)}» en presets/luts`); }
}
export { DIR_LUTS };

/**
 * Corre los pasos locales en orden sobre el buffer que devolvió el modelo (o la foto del dueño, si todo es local).
 * pasos: ['fondo-blanco', 'encuadrar', 'exportar'] o [{ op: 'exposicion', ev: { suave, normal, fuerte } }, …]
 * ctx: { intensidad, canal, encuadre: { ocupacion, alinear, base }, aireMinPx, sombra, original (buffer), referencia (buffer),
 *        lut (texto .cube), fuerza, zona, sku, n, patron (medirSerie), escalaFija, canales[], formatoEntrada, raiz }
 * Sin sharp lanza NoDisponible. Un paso que necesita la IA no se hace: queda { hecho: false, necesitaIA: true, aviso }.
 */
export async function pipeline(buf, pasos = [], ctx = {}) {
  const sharp = await S();
  const meta = esRaw(buf) ? {} : await sharp(buf, { failOn: 'none' }).metadata();
  let r = await leer(buf), m = null, formatoSalida = ctx.formato || ({ jpeg: 'jpg', webp: 'webp', png: 'png' })[meta.format] || 'png';
  const intensidad = ctx.intensidad || 'normal', canal = ctx.canal || null, avisos = [], hechos = [], res = {};
  const original = ctx.original ? await leer(ctx.original) : null, referencia = ctx.referencia ? await leer(ctx.referencia) : null;
  let medido = {}, sombraModo = ctx.sombra || 'conservar', exportado = null;
  const masc = () => (m ||= mascara(r, { original: original && original.width === r.width && original.height === r.height ? original : undefined }));
  for (const paso of pasos || []) {
    const p = typeof paso === 'string' ? { op: paso } : { ...paso }, op = p.op, t0 = Date.now(), reg = { op, hecho: true };
    const v = k => resolverIntensidad(p[k], intensidad);
    try {
      switch (op) {
        case 'capa-sombra': sombraModo = p.modo || sombraModo; break;
        case 'fondo-blanco': { const color = p.color || canal?.fondo || '#FFFFFF'; const o = fondoBlanco(r, { color, sombra: p.sombra || sombraModo, mascara: masc() }); r = o.raw; reg.umbral = o.mascara.umbral; break; }
        case 'encuadrar': {
          const enc = { ...(ctx.encuadre || {}), ...p };
          const ocup = enc.ocupacion ?? canal?.ocupacion ?? 0.75;
          const o = await encuadrar(r, { ancho: enc.ancho || canal?.ancho, alto: enc.alto || canal?.alto, ocupacion: ocup,
            alinear: enc.alinear === 'auto' ? 'centro' : (enc.alinear || (canal?.alinear === 'base' ? 'base' : 'centro')), base: ctx.patron?.lineaSuelo ?? enc.base ?? 0.85,
            aireMinPx: enc.aireMinPx ?? ctx.aireMinPx ?? canal?.aireMinPx ?? 0, fondo: enc.fondo ?? canal?.fondo ?? undefined, escalaFija: ctx.escalaFija, mascara: masc() });
          r = o.raw; m = null; medido = { ...medido, ...o.medido, objetivo: ocup }; avisos.push(...o.avisos); reg.medido = o.medido; break;
        }
        case 'extender': { const o = extender(r, { px: p.px, factor: p.factor, color: p.color, mascara: masc() }); if (o.necesitaIA) { reg.hecho = false; reg.necesitaIA = true; reg.aviso = o.aviso; avisos.push(o.aviso); } else { r = o.raw; m = null; } break; }
        case 'exposicion': r = exposicion(r, v('ev') ?? 0.4); break;
        case 'sombras': r = sombras(r, v('cantidad') ?? 0.4); break;
        case 'altas': r = altas(r, v('cantidad') ?? -0.4); break;
        case 'contraste': r = contraste(r, v('cantidad') ?? 0.2); break;
        case 'saturacion': r = saturacion(r, v('cantidad') ?? 0.2, { protegerPiel: p.protegerPiel !== false }); break;
        case 'balance': r = balance(r, { metodo: p.metodo === 'punto-neutro' ? 'neutro' : p.metodo, neutro: p.neutro, fuerza: v('fuerza') ?? 1 }); break;
        case 'dominante': r = dominante(r, { fuerza: v('fuerza') ?? 0.7 }); break;
        case 'temperatura': r = temperatura(r, v('k') ?? 600); break;
        case 'blanco-y-negro': r = blancoYNegro(r, { contraste: v('contraste') ?? 0.15 }); break;
        case 'auto-niveles': r = autoNiveles(r); break;
        case 'grano': r = grano(r, v('cantidad') ?? 0.05, ctx.semilla ?? 1); break;
        case 'nitidez': r = await nitidez(r, v('sigma') ?? 1); break;
        case 'ruido': r = await ruido(r, v('radio') ?? 1); break;
        case 'rotar-horizonte': { const o = await rotarHorizonte(r, { angulo: p.angulo }); if (o.necesitaIA) { reg.hecho = false; reg.necesitaIA = true; reg.aviso = o.aviso; avisos.push(o.aviso); } else { r = o.raw; m = null; reg.angulo = o.angulo; } break; }
        case 'lut': case 'lut3d': {
          const texto = ctx.lut || (p.archivo ? leerLutDeArchivo(p.archivo, ctx.raiz) : null);
          if (!texto) { reg.hecho = false; reg.aviso = 'Falta el archivo .cube.'; avisos.push(reg.aviso); break; }
          r = aplicarLut(r, texto, ctx.fuerza ?? v('fuerza') ?? 1); break;
        }
        case 'transferir-color': {
          if (!referencia) { reg.hecho = false; reg.aviso = 'Copiar el color necesita una referencia.'; avisos.push(reg.aviso); break; }
          const o = transferirColor(r, referencia, { fuerza: ctx.fuerza ?? v('fuerza') ?? 1, zona: ctx.zona || p.zona || 'todo', mascara: (ctx.zona || p.zona) === 'producto' ? masc() : undefined });
          r = o.raw; if (o.aviso) { reg.aviso = o.aviso; avisos.push(o.aviso); } break;
        }
        case 'exportar-lut': {
          if (!referencia) { reg.hecho = false; reg.aviso = 'Guardar el color como LUT necesita una referencia.'; avisos.push(reg.aviso); break; }
          res.lut = guardarColorComoLut(r, referencia, { fuerza: ctx.fuerza ?? 1, tamano: p.tamano || 33, titulo: ctx.tituloLut }).cube; break;
        }
        case 'igualar-serie': {
          if (!ctx.patron) { reg.hecho = false; reg.aviso = 'Igualar la serie necesita la foto patrón (la primera aprobada).'; avisos.push(reg.aviso); break; }
          const o = igualarSerie(r, ctx.patron, { mascara: masc() }); r = o.raw; reg.ev = o.ev; break;
        }
        case 'quitar-exif': break; // toda salida de aquí ya va sin EXIF ni GPS
        case 'exportar': {
          const mm = medido.bbox ? null : masc();
          exportado = await exportar(r, { canal, formato: p.formato || canal?.formato || formatoSalida, pesoMaxKB: p.pesoMaxKB, ajuste: p.ajuste, sku: ctx.sku, n: ctx.n, bbox: medido.bbox || mm?.bbox, marketplace: p.marketplace });
          r = exportado.raw; m = null; formatoSalida = exportado.formato; avisos.push(...exportado.avisos); reg.kb = exportado.kb; reg.calidad = exportado.calidad; break;
        }
        case 'exportar-varios': res.varios = (await exportarVarios(r, ctx.canales || [], { sku: ctx.sku, n: ctx.n })).map(({ raw, ...x }) => x); break;
        default: reg.hecho = false; reg.aviso = `«${op}» no es una operación local conocida.`; avisos.push(reg.aviso);
      }
    } catch (e) {
      if (e instanceof NoDisponible) throw e;
      reg.hecho = false; reg.error = e.message; avisos.push(`${op}: ${e.message}`);
    }
    if (GEOMETRIA.has(op) && reg.hecho) m = null;
    reg.ms = Date.now() - t0; hechos.push(reg);
  }
  const fin = await mascaraParaMedir(r);
  const caja = fin.bbox;
  medido = { ...medido, fondoBorde: +fondoBordeBlanco(r, fin.m).toFixed(4),
    ocupacionMedida: caja ? +Math.max(caja.w / r.width, caja.h / r.height).toFixed(4) : null, bboxMedida: caja };
  if (medido.ocupacion == null && medido.ocupacionMedida != null) { medido.ocupacion = medido.ocupacionMedida; medido.bbox = caja; }
  const buffer = exportado && exportado.raw === r ? exportado.buffer : await codificar(r, { formato: formatoSalida });
  return { buffer, formato: formatoSalida, ancho: r.width, alto: r.height, pasos: hechos, medido, avisos, nombre: exportado?.nombre || null, ...res };
}
