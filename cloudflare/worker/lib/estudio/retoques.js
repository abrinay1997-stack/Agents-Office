// Fase 4 D: los retoques de foto SIN sharp, en el Worker. La oficina local los hace con sharp (imagen-local.mjs); aquí se hacen con las MISMAS
// funciones de píxel (imagen-local.mjs → correrPasos: luz, color, fondo blanco… son JavaScript puro sobre un raw RGBA) y el binding `IMAGES` de
// Cloudflare solo para entrar y salir del raw (decodificar a RGBA y, si la foto era JPEG, volver a JPEG). Todo detrás del interruptor
// `retoquesNube` del Estudio (apagado por defecto) y del binding IMAGES: sin uno de los dos, lo local sigue siendo «solo en la oficina».
//
// Qué SÍ y qué NO (OPS_NUBE): luz y color (exposición, sombras, altas, contraste, saturación, balance, quitar dominante, temperatura, blanco y negro,
// auto-niveles, grano), copiar el color de una referencia, el fondo blanco, la capa de sombra y quitar EXIF (toda salida ya va sin metadatos). NO: encuadrar,
// extender, nitidez, ruido, enderezar el horizonte, exportar por canal y las LUT de fábrica (necesitan sharp o archivos): esos presets siguen «solo en la oficina».
// La QA que mide (verificar.mjs) tampoco corre: nunca un ✓ inventado.
//
// POR VERIFICAR con el binding real (no se pudo probar aquí): que `output({ format: 'rgba' })` devuelva píxeles crudos; que respete la orientación EXIF.
// Si el binding contesta otra cosa, `decodificar` lanza un error en español y el retoque no se hace (nunca se guarda una imagen rota).
import { correrPasos } from '../../../../imagen-local.mjs';

export const MAX_LADO = 2048; // un Worker tiene CPU y 128 MB: una foto más grande se reduce (y se dice)
export const OPS_NUBE = new Set(['capa-sombra', 'exposicion', 'sombras', 'altas', 'contraste', 'saturacion', 'balance', 'dominante', 'temperatura', 'blanco-y-negro', 'auto-niveles', 'grano', 'transferir-color', 'fondo-blanco', 'quitar-exif']);
const NOMBRE = { encuadrar: 'encuadrar el producto', extender: 'ampliar la escena', nitidez: 'la nitidez', ruido: 'quitar el ruido', 'rotar-horizonte': 'enderezar el horizonte', exportar: 'exportar por canal', 'exportar-varios': 'exportar varios tamaños', lut: 'las LUT', lut3d: 'las LUT', 'exportar-lut': 'guardar el color como LUT', 'igualar-serie': 'igualar una serie' };
export const motivoOp = (op) => `${NOMBRE[op] || `«${op}»`} todavía no está en la nube: sigue en la oficina de tu computadora.`;

/** ¿Está encendido y se puede? (flag del Estudio + binding IMAGES). */
export const hayRetoques = (env, cfg) => cfg?.retoquesNube === true && typeof env?.['IMAGES']?.input === 'function';

const opsDe = (p) => [...(Array.isArray(p?.local) ? p.local.map((o) => o?.op) : []), ...(Array.isArray(p?.post) ? p.post.map((o) => (typeof o === 'string' ? o : o?.op)) : [])].filter(Boolean);
/** Por qué un preset no se puede hacer en la nube ('' si sí). Un preset solo se activa si TODOS sus pasos están en la tabla. */
export function motivoPreset(p) {
  for (const op of opsDe(p)) if (!OPS_NUBE.has(op)) return motivoOp(op);
  return '';
}
/** Lo mismo para un plan ya compilado (sus pasos de antes y de después). */
export function motivoPlan(plan) {
  const ops = [...(plan?.local?.antes || []), ...(plan?.local?.despues || []), ...(plan?.request?.pre || []), ...(plan?.request?.post || [])];
  for (const o of ops) if (!OPS_NUBE.has(o?.op)) return motivoOp(o?.op);
  return '';
}

/* ---------- entrar y salir del raw ---------- */
const flujo = (bytes) => new Blob([bytes]).stream();
const tamanoPara = (w, h) => { const k = Math.min(1, MAX_LADO / Math.max(w, h)); return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), reducida: k < 1 }; };

/** bytes de una imagen → { raw: {data,width,height}, formato, reducida } con IMAGES. */
export async function decodificar(env, bytes) {
  const IMG = env['IMAGES'];
  let info; try { info = await IMG.info(flujo(bytes)); } catch (e) { throw new Error(`no pude leer la imagen para retocarla: ${String(e?.message || e).slice(0, 120)}`); }
  if (!info?.width || !info?.height) throw new Error('no pude saber el tamaño de la imagen para retocarla');
  const t = tamanoPara(info.width, info.height);
  let res; try { res = await IMG.input(flujo(bytes)).transform(t.reducida ? { width: t.w, height: t.h, fit: 'scale-down' } : {}).output({ format: 'rgba' }); } catch (e) { throw new Error(`no pude abrir la imagen para retocarla: ${String(e?.message || e).slice(0, 120)}`); }
  const data = new Uint8Array(await res.response().arrayBuffer());
  if (data.length !== t.w * t.h * 4) throw new Error('el retoque en la nube no pudo leer los píxeles de esta imagen (el binding de imágenes devolvió otra cosa): se queda como está');
  return { raw: { data: Buffer.from(data.buffer, data.byteOffset, data.length), width: t.w, height: t.h }, formato: String(info.format || '').replace('image/', ''), reducida: t.reducida };
}

/* PNG a mano (con CompressionStream, que en un Worker es zlib): raw RGBA → bytes PNG. Sin ICC ni metadatos. */
const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const u32 = (n) => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const unir = (partes) => { const o = new Uint8Array(partes.reduce((a, p) => a + p.length, 0)); let i = 0; for (const p of partes) { o.set(p, i); i += p.length; } return o; };
async function deflate(bytes) { const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate')); return new Uint8Array(await new Response(s).arrayBuffer()); }
export async function codificarPng(raw) {
  const { data, width: W, height: H } = raw, fila = W * 4, bruto = new Uint8Array((fila + 1) * H);
  for (let y = 0; y < H; y++) { bruto[y * (fila + 1)] = 0; bruto.set(data.subarray(y * fila, (y + 1) * fila), y * (fila + 1) + 1); }
  const trozo = (tipo, d) => { const td = unir([Uint8Array.from(tipo, (c) => c.charCodeAt(0)), d]); return unir([u32(d.length), td, u32(crc32(td))]); };
  return unir([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), trozo('IHDR', unir([u32(W), u32(H), Uint8Array.of(8, 6, 0, 0, 0)])), trozo('IDAT', await deflate(bruto)), trozo('IEND', new Uint8Array(0))]);
}

/** Corre los pasos `ops` (los del plan: `{ op, … }`) sobre `bytes`. → { bytes, ext, ancho, alto, pasos, avisos }. Lanza si algún paso no está en OPS_NUBE (nada se hace a medias). */
export async function retocar(env, bytes, ops, { leerRef = null, canal = null } = {}) {
  for (const o of ops) if (!OPS_NUBE.has(o?.op)) throw new Error(motivoOp(o?.op));
  const { raw, formato, reducida } = await decodificar(env, bytes);
  let ref = null;
  const idRef = ops.find((o) => o?.op === 'transferir-color' && o.ref)?.ref; // copiar el color: la referencia es una imagen de la galería
  if (idRef && leerRef) { const b = await leerRef(idRef); if (b) ref = (await decodificar(env, b)).raw; }
  const E = await correrPasos(raw, ops.map(({ de, ...p }) => p), { canal, referencia: ref, formato: 'png' }, 'png');
  const png = await codificarPng(E.r), avisos = [...E.avisos];
  if (reducida) avisos.unshift(`La foto era más grande de ${MAX_LADO} px: en la nube se retoca a ${raw.width}×${raw.height}.`);
  const sinHacer = E.hechos.filter((p) => p.hecho === false);
  let out = png, ext = 'png';
  if (formato === 'jpeg' || formato === 'jpg') { // una foto JPEG vuelve a JPEG (si IMAGES no puede, se queda en PNG: nada se pierde)
    try { const j = await env['IMAGES'].input(flujo(png)).transform({ background: '#ffffff' }).output({ format: 'image/jpeg', quality: 92 }); out = new Uint8Array(await j.response().arrayBuffer()); ext = 'jpg'; } catch { avisos.push('No pude volver a JPEG: va como PNG.'); }
  }
  return { bytes: out, ext, ancho: E.r.width, alto: E.r.height, pasos: E.hechos, avisos, sinHacer: sinHacer.map((p) => p.aviso || (p.error ? `${p.op}: ${p.error}` : `${p.op}: no se hizo`)) };
}
