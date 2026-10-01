// Agents Office — la QA determinista del banco de presets (E3, 1 oct 2026; docs/propuesta-banco-presets.md §5.7, D9, D11, §16.5).
// Gratis y sin red: mide el resultado con la misma máscara que usa imagen-local.mjs. Lo que no se puede medir se dice
// «no medido» (ok: null) en vez de inventar un número. «Lista» ≠ «Aprobada»: aquí solo se decide «ok» o «revisar».
//
// Contrato:
//   deltaE2000(lab1, lab2)                         → número
//   iouSilueta(mascaraA, mascaraB, { lado: 64 })   → 0..1   (máscaras { producto, width, height, bbox } alineadas por su caja)
//   colorMedio(raw, mascara01)                     → [L, a, b] | null
//   deltaEMascara(rawA, mA, rawB, mB)              → { deltaE, zonas: [ΔE de 2×2], max } | null
//   ocupacionMedida(mascara)                       → { ocupacion, ancho, alto, bbox, medido: true } | { ocupacion: null, medido: false }
//   compararOcupacion(medida, estimada, { tolerancia: 0.12 }) → { ok, diferencia, motivo }   (escena 3D, §16.5)
//   verificar(buf, { qa[], original?, canal?, objetivo?, escena?, esEscena?, formato?, kb?, patron?, deltaEMax?, iouMin? })
//     → { estado: 'ok'|'revisar', checks: [{ id, ok: true|false|null, valor, objetivo, motivo }], medido, motivo }
import * as L from './imagen-local.mjs';

const rad = d => d * Math.PI / 180, grados = r => { const d = r * 180 / Math.PI; return d < 0 ? d + 360 : d; };
/** CIEDE2000 (Sharma, Wu y Dalal 2005), con kL = kC = kH = 1. */
export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2, Cm7 = Cm ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : grados(Math.atan2(b1, a1p)), h2p = C2p === 0 ? 0 : grados(Math.atan2(b2, a2p));
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p; if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hpm += h1p + h2p < 360 ? 360 : -360; hpm /= 2; }
  const T = 1 - 0.17 * Math.cos(rad(hpm - 30)) + 0.24 * Math.cos(rad(2 * hpm)) + 0.32 * Math.cos(rad(3 * hpm + 6)) - 0.20 * Math.cos(rad(4 * hpm - 63));
  const dTh = 30 * Math.exp(-(((hpm - 275) / 25) ** 2)), Cpm7 = Cpm ** 7, RC = 2 * Math.sqrt(Cpm7 / (Cpm7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2), SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T, RT = -Math.sin(rad(2 * dTh)) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

/** La silueta del producto llevada a un cuadrado de `lado` px, alineada por su caja y SIN deformarla (centrada). */
function silueta(m, lado) {
  const out = new Uint8Array(lado * lado), b = m.bbox; if (!b) return out;
  const s = lado / Math.max(b.w, b.h), ox = (lado - b.w * s) / 2, oy = (lado - b.h * s) / 2;
  for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
    const sx = Math.floor(b.x + (x + 0.5 - ox) / s), sy = Math.floor(b.y + (y + 0.5 - oy) / s);
    if (sx < b.x || sy < b.y || sx >= b.x + b.w || sy >= b.y + b.h) continue;
    out[y * lado + x] = m.producto[sy * m.width + sx] ? 1 : 0;
  }
  return out;
}
/** IoU de silueta: ¿es la misma forma con las mismas proporciones? (identidad, ≥ 0,85). */
export function iouSilueta(a, b, { lado = 64 } = {}) {
  if (!a?.bbox || !b?.bbox) return 0;
  const sa = silueta(a, lado), sb = silueta(b, lado); let i = 0, u = 0;
  for (let k = 0; k < sa.length; k++) { if (sa[k] && sb[k]) i++; if (sa[k] || sb[k]) u++; }
  return u ? i / u : 0;
}
export function colorMedio(r, m01) { const e = L.estadisticasLab(r, m01); return e ? e.media : null; }
/** ΔE2000 del color medio dentro de cada máscara, y por cuartos de su caja (un color que cambió solo en una parte se ve). */
export function deltaEMascara(ra, ma, rb, mb) {
  const ca = colorMedio(ra, ma.producto), cb = colorMedio(rb, mb.producto); if (!ca || !cb) return null;
  const zona = (r, m, qx, qy) => { const b = m.bbox, z = new Uint8Array(m.producto.length);
    for (let y = b.y + Math.floor(qy * b.h / 2); y < b.y + Math.floor((qy + 1) * b.h / 2); y++) for (let x = b.x + Math.floor(qx * b.w / 2); x < b.x + Math.floor((qx + 1) * b.w / 2); x++) { const i = y * m.width + x; z[i] = m.producto[i]; }
    return colorMedio(r, z); };
  const zonas = [];
  for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) { const za = zona(ra, ma, qx, qy), zb = zona(rb, mb, qx, qy); if (za && zb) zonas.push(+deltaE2000(za, zb).toFixed(2)); }
  return { deltaE: +deltaE2000(ca, cb).toFixed(2), zonas, max: zonas.length ? Math.max(...zonas) : null };
}
/** La ocupación real: el lado que manda de la caja del producto (sin sombra) ÷ el lienzo. */
export function ocupacionMedida(m) {
  if (!m?.bbox) return { ocupacion: null, medido: false, motivo: 'no se encontró el producto' };
  const ancho = m.bbox.w / m.width, alto = m.bbox.h / m.height;
  return { ocupacion: +Math.max(ancho, alto).toFixed(4), ancho: +ancho.toFixed(4), alto: +alto.toFixed(4), bbox: m.bbox, medido: true };
}
/**
 * La medida frente a la estimada por el escenario 3D (§16.5). `estimada` es un número (0..1) o { ancho, alto } (fracciones).
 * Se compara el mismo eje que dé la estimada; más de 12 puntos de diferencia → revisar («Reintentar más fuerte»).
 */
export function compararOcupacion(medida, estimada, { tolerancia = 0.12 } = {}) {
  if (!medida || medida.ocupacion == null) return { ok: null, diferencia: null, motivo: 'No medido: no se encontró el producto en el resultado.' };
  if (estimada == null) return { ok: null, diferencia: null, motivo: 'No hay ocupación estimada con qué comparar.' };
  let dif;
  if (typeof estimada === 'number') dif = medida.ocupacion - estimada;
  else { const d = []; if (estimada.ancho != null) d.push(medida.ancho - estimada.ancho); if (estimada.alto != null) d.push(medida.alto - estimada.alto); dif = d.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0); }
  const ok = Math.abs(dif) <= tolerancia, pts = Math.round(Math.abs(dif) * 100);
  return { ok, diferencia: +dif.toFixed(4), motivo: ok ? `El producto ocupa lo previsto (±${pts} puntos).` : `El producto sale ${dif > 0 ? 'más grande' : 'más pequeño'} que lo previsto por la escena: ${pts} puntos de diferencia.` };
}
export const sinRecorte = (bbox, W, H, margen = 1) => !!bbox && bbox.x >= margen && bbox.y >= margen && bbox.x + bbox.w <= W - margen && bbox.y + bbox.h <= H - margen;
const proporcion = p => { const m = /^(\d+(?:[.,]\d+)?):(\d+(?:[.,]\d+)?)$/.exec(String(p || '')); return m ? parseFloat(m[1].replace(',', '.')) / parseFloat(m[2].replace(',', '.')) : null; };

/** Todas las comprobaciones de `qa` sobre el resultado. Lo que no se puede medir sale ok: null con su motivo. */
export async function verificar(buf, opts = {}) {
  const { qa = [], canal = {}, objetivo = {}, escena, esEscena = false } = opts;
  // Se mide sobre una copia de ≤ 1024 px (las fracciones son las mismas); el blanco 255 del borde, sobre la imagen entera.
  const r = await L.leer(buf), mm = await L.mascaraParaMedir(r), m = mm.m, rm = mm.reducida || r;
  const occ = ocupacionMedida(m), checks = [], medido = { ocupacion: occ.ocupacion, bbox: mm.bbox, fondoBorde: null, iou: null, deltaE: null };
  const add = (id, ok, valor, obj, motivo) => checks.push({ id, ok, valor: valor ?? null, objetivo: obj ?? null, motivo });
  let orig = null, mo = null;
  const conOriginal = async () => { if (!orig && opts.original) { const o = await L.leer(opts.original), mmo = await L.mascaraParaMedir(o); orig = mmo.reducida || o; mo = mmo.m; } return !!orig; };
  let meta = null; const metadata = async () => { if (!meta && Buffer.isBuffer(buf)) { const sharp = (await import('sharp')).default; meta = await sharp(buf).metadata(); } return meta; };
  for (const id of qa) {
    switch (id) {
      case 'fondo-255': {
        const f = L.fondoBordeBlanco(r, m); medido.fondoBorde = +f.toFixed(4);
        add(id, f >= 0.98, +(f * 100).toFixed(1), 98, f >= 0.98 ? 'Fondo blanco puro en el borde.' : `Solo el ${(f * 100).toFixed(1)} % del borde es blanco 255 (hace falta 98 %).`); break;
      }
      case 'ocupacion': {
        if (esEscena) { add(id, null, null, null, 'No medido: en una escena el producto no se recorta contra un fondo liso.'); break; }
        const obj = objetivo.ocupacion ?? canal.ocupacion;
        if (escena?.ocupacionEstimada != null && obj == null) { const c = compararOcupacion(occ, escena.ocupacionEstimada, { tolerancia: escena.tolerancia ?? 0.12 }); add(id, c.ok, occ.ocupacion, escena.ocupacionEstimada, c.motivo); break; }
        if (obj == null || occ.ocupacion == null) { add(id, null, occ.ocupacion, obj, occ.ocupacion == null ? 'No medido: no se encontró el producto.' : 'Sin objetivo de ocupación.'); break; }
        const tol = objetivo.tolerancia ?? 0.03, ok = Math.abs(occ.ocupacion - obj) <= tol;
        add(id, ok, +(occ.ocupacion * 100).toFixed(1), +(obj * 100).toFixed(1), ok ? `El producto ocupa el ${(occ.ocupacion * 100).toFixed(1)} %.` : `El producto ocupa el ${(occ.ocupacion * 100).toFixed(1)} % y debía ocupar el ${(obj * 100).toFixed(0)} % (±${Math.round(tol * 100)}).`);
        break;
      }
      case 'escena': { // ocupación real frente a la estimada del escenario 3D (§16.5)
        const c = compararOcupacion(occ, escena?.ocupacionEstimada, { tolerancia: escena?.tolerancia ?? 0.12 }); add(id, c.ok, occ.ocupacion, escena?.ocupacionEstimada ?? null, c.motivo); break;
      }
      case 'sin-recorte': { const ok = sinRecorte(m.bbox, m.width, m.height); add(id, m.bbox ? ok : null, null, null, !m.bbox ? 'No medido: no se encontró el producto.' : ok ? 'El producto entra entero.' : 'El producto toca el borde: puede estar cortado.'); break; }
      case 'lado-min': { const min = canal.ancho ? Math.min(canal.ancho, canal.alto || canal.ancho) : objetivo.ladoMin; const lado = Math.min(r.width, r.height);
        add(id, min ? lado >= min : null, lado, min, !min ? 'Sin lado mínimo.' : lado >= min ? `${r.width}×${r.height} px.` : `Mide ${r.width}×${r.height} px; el canal pide al menos ${min} px.`); break; }
      case 'proporcion': { const p = proporcion(canal.proporcion || objetivo.proporcion); const real = r.width / r.height;
        add(id, p ? Math.abs(real - p) / p <= 0.01 : null, +real.toFixed(3), p ? +p.toFixed(3) : null, !p ? 'Sin proporción pedida.' : Math.abs(real - p) / p <= 0.01 ? 'Proporción exacta.' : `La proporción es ${real.toFixed(2)} y el canal pide ${p.toFixed(2)}.`); break; }
      case 'peso': { const max = canal.pesoMaxKB ?? objetivo.pesoMaxKB; const kb = Buffer.isBuffer(buf) ? buf.length / 1024 : opts.kb;
        add(id, max && kb != null ? kb <= max : null, kb != null ? +kb.toFixed(1) : null, max, !max ? 'Sin peso máximo.' : kb == null ? 'No medido.' : kb <= max ? `Pesa ${Math.round(kb)} KB.` : `Pesa ${Math.round(kb)} KB; el canal pide como mucho ${max} KB.`); break; }
      case 'alfa': { const md = await metadata(); let transp = false;
        if (md?.hasAlpha) for (let p = 3; p < r.data.length; p += 4) if (r.data[p] < 255) { transp = true; break; }
        add(id, md ? transp : null, null, null, !md ? 'No medido.' : transp ? 'Tiene transparencia de verdad.' : 'No tiene transparencia: el fondo está pintado.'); break; }
      case 'linea-suelo': { const pat = objetivo.lineaSuelo ?? opts.patron?.lineaSuelo; const base = m.bbox ? (m.bbox.y + m.bbox.h) / m.height : null;
        const ok = pat != null && base != null ? Math.abs(base - pat) <= 0.01 : null;
        add(id, ok, base != null ? +base.toFixed(4) : null, pat ?? null, ok == null ? 'No medido: falta la línea de la serie o el producto.' : ok ? 'La base está en la línea de la serie.' : `La base está al ${(base * 100).toFixed(1)} % y la serie al ${(pat * 100).toFixed(1)} %.`); break; }
      case 'identidad': {
        if (!(await conOriginal())) { add(id, null, null, null, 'No medido: falta la foto original.'); break; }
        if (esEscena) { add(id, null, null, null, 'No medido: en una escena la silueta no se separa con seguridad del fondo.'); break; }
        const iou = iouSilueta(mo, m), de = deltaEMascara(orig, mo, rm, m); medido.iou = +iou.toFixed(3); medido.deltaE = de?.deltaE ?? null;
        const iouMin = opts.iouMin ?? 0.85, deMax = opts.deltaEMax ?? 6;
        const okF = iou >= iouMin, okC = de ? de.deltaE <= deMax : false;
        add(id, okF && okC, { iou: medido.iou, deltaE: medido.deltaE }, { iou: iouMin, deltaE: deMax },
          okF && okC ? 'Mismo producto: misma forma y mismo color.' : !okF ? `La forma del producto cambió (coincide un ${(iou * 100).toFixed(0)} %, hace falta ${iouMin * 100} %).` : `El color del producto cambió (ΔE ${medido.deltaE}, el máximo es ${deMax}).`);
        break;
      }
      case 'delta-e': {
        let refRaw = null, mr = null;
        if (opts.patronImagen) { const o = await L.leer(opts.patronImagen), mmp = await L.mascaraParaMedir(o); refRaw = mmp.reducida || o; mr = mmp.m; }
        else if (await conOriginal()) { refRaw = orig; mr = mo; }
        if (!refRaw) { add(id, null, null, null, 'No medido: falta la foto con qué comparar el color.'); break; }
        const de = deltaEMascara(refRaw, mr, rm, m); const deMax = opts.deltaEMax ?? 3;
        medido.deltaE = de?.deltaE ?? null;
        add(id, de ? de.deltaE <= deMax : null, de?.deltaE ?? null, deMax, !de ? 'No medido: no se encontró el producto.' : de.deltaE <= deMax ? `Color fiel (ΔE ${de.deltaE}).` : `El color se aparta (ΔE ${de.deltaE}, el máximo es ${deMax}).`); break;
      }
      case 'sin-texto': add(id, null, null, null, 'No medido: buscar texto necesita la QA de visión (opcional, con su costo).'); break;
      default: add(id, null, null, null, `«${id}» no es una comprobación conocida.`);
    }
  }
  const fallos = checks.filter(c => c.ok === false);
  return { estado: fallos.length ? 'revisar' : 'ok', checks, medido, motivo: fallos.length ? fallos.map(c => c.motivo).join(' ') : null };
}
