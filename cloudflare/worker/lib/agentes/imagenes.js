// «ver_imagen» en la nube (28 oct 2026): el agente MIRA una imagen de la galería del Estudio. Las imágenes viven en R2; la conversación del agente (corridas.datos, 1,5 MB como mucho) NO guarda sus bytes,
// guarda una REFERENCIA —{ type: 'ao_imagen', ref: '2026-10/foto.jpg' }— y esa referencia se cambia por la imagen de verdad justo antes de cada llamada al modelo.
// Por qué así y no editando lo guardado: en Claude 5 el razonamiento de una vuelta solo vale si el prefijo de la conversación (herramientas → sistema → mensajes) es idéntico en la vuelta siguiente.
// La expansión es determinista (el mismo archivo de la galería, los mismos bytes, el mismo orden): lo que se envía en la vuelta 5 empieza igual que lo de la vuelta 4.
import { tipoDe, motivoSinMirar, motivoPesada, motivoDimensiones, textoVista, topeDeTarea, topeDeBytes } from '../../../../ver-imagen-core.mjs';
import { dims } from '../../../../media/galeria-core.mjs';
import * as galeria from '../estudio/galeria.js';

export const BLOQUE = 'ao_imagen';

/** Cuántas imágenes se han mirado ya en esta conversación y cuánto pesan (las que están guardadas como referencia). */
export function contarImagenes(mensajes) { return resumenImagenes(mensajes).n; }
export function resumenImagenes(mensajes) {
  let n = 0, bytes = 0;
  for (const m of Array.isArray(mensajes) ? mensajes : []) if (m?.role === 'user' && Array.isArray(m.content)) for (const c of m.content) if (c?.type === 'tool_result' && Array.isArray(c.content)) for (const x of c.content) if (x?.type === BLOQUE) { n++; bytes += Number(x.bytes) || 0; }
  return { n, bytes };
}

/** Bytes → base64 sin pasarse de la pila (btoa con trozos). */
export function aBase64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Los mensajes tal como los ve la API: cada `ao_imagen` pasa a ser un bloque `image` con los bytes de R2. Sin ninguna referencia devuelve los MISMOS mensajes (sin copiar ni leer nada).
 * Si un archivo ya no está (se fue a la papelera y se purgó), ese bloque pasa a un texto que lo dice: el resto de la conversación sigue.
 */
export async function expandirImagenes(mensajes, { env }) {
  if (!contarImagenes(mensajes)) return mensajes;
  const cache = new Map();
  const bloque = async (b) => {
    if (b?.type !== BLOQUE) return b;
    const clave = galeria.validoId(b.ref);
    if (!clave) return { type: 'text', text: '[Una imagen que se miró antes ya no se puede abrir.]' };
    if (!cache.has(clave)) { const o = await env.MEDIA?.get(clave); cache.set(clave, o ? aBase64(await o.arrayBuffer()) : null); }
    const data = cache.get(clave);
    return data ? { type: 'image', source: { type: 'base64', media_type: b.media_type, data } } : { type: 'text', text: `[La imagen «${String(b.ref).split('/').pop()}» que se miró antes ya no está en la galería.]` };
  };
  const salida = [];
  for (const m of mensajes) {
    if (m?.role !== 'user' || !Array.isArray(m.content)) { salida.push(m); continue; }
    const content = [];
    for (const c of m.content) content.push(c?.type === 'tool_result' && Array.isArray(c.content) ? { ...c, content: await Promise.all(c.content.map(bloque)) } : c);
    salida.push({ ...m, content });
  }
  return salida;
}

/**
 * La herramienta `ver_imagen` de un agente en la nube: comprueba que la imagen está en la galería, que se puede mirar y que cabe, y devuelve una REFERENCIA (nunca los bytes).
 * → { texto, imagenes: [{ ref, media_type }] }. Lanza Error en palabras si no se puede (el agente lo lee y sigue sin ella).
 */
export async function verImagen({ env, db, id, yaMiradas = 0, bytesVistos = 0 }) {
  const ref = String(id || '').trim(); if (!ref) throw new Error('falta el id de la imagen (el de la galería, como «2026-10/foto.jpg»)');
  const tope = topeDeTarea(yaMiradas); if (tope) throw new Error(tope);
  const clave = galeria.validoId(ref); if (!clave || !(await galeria.existe(db, clave))) throw new Error(`«${ref.split('/').pop()}» no está en la galería del Estudio (¿ya la borraron? búscala con buscar_en_galeria).`);
  const no = motivoSinMirar(clave); if (no) throw new Error(no); // un video, un GIF, un audio…
  const cab = await env.MEDIA?.head(clave); if (!cab) throw new Error(`«${ref.split('/').pop()}» está en la lista de la galería pero su archivo no se encuentra.`);
  const pesada = motivoPesada(clave, cab.size); if (pesada) throw new Error(pesada);
  const demasiado = topeDeBytes(bytesVistos, cab.size, clave); if (demasiado) throw new Error(demasiado);
  const ficha = await galeria.item(db, clave).catch(() => null);
  let w = Number(ficha?.w) || 0, h = Number(ficha?.h) || 0;
  if (!(w > 0 && h > 0)) { const o = await env.MEDIA.get(clave); const wh = o ? dims(Buffer.from(await o.arrayBuffer()), clave.split('.').pop().toLowerCase().replace('jpeg', 'jpg')) : null; [w, h] = wh || [0, 0]; } // la ficha casi siempre lo trae; si no, se lee de la cabecera del archivo
  const grande = motivoDimensiones(clave, w, h); if (grande) throw new Error(grande);
  return { texto: textoVista(clave, { w, h, bytes: cab.size }), imagenes: [{ ref: clave, media_type: tipoDe(clave).mime, bytes: cab.size }] };
}
