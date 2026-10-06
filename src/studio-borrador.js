// El BORRADOR del compositor del Estudio y la VARIACIÓN autónoma (auditoría del Estudio de imagen, IMG-01 e IMG-02, 6 oct 2026).
// Antes, Variar, Repetir, Animar y Usar de referencia escribían encima de lo que el dueño estaba componiendo (la idea, el
// modelo, las referencias, la cantidad) sin deshacer, y Variar además gastaba sin la confirmación de GENERAR y dejaba la
// imagen pegada como referencia del pedido siguiente. Aquí, lo puro:
//   pila(max) → { guardar(estado), deshacer() → estado | null, hay() }   las fotos del borrador antes de cada carga
//   copia(estado) · igual(a, b) · vacio(estado)                           comparar y clonar sin referencias compartidas
//   pedidoVariar(it, models, { respaldo, settingsDe }) → { req, modelo, cambio } | { error }
//     Variar es un pedido propio: el prompt, el modelo y los ajustes de ESA imagen, ella como única referencia, 1 archivo.
//     No lee ni toca el compositor. Si su modelo ya no está encendido o no acepta referencias, va el `respaldo` y lo dice.

export const copia = e => JSON.parse(JSON.stringify(e ?? null));
export const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Un borrador sin nada que perder: sin idea y sin material. */
export const vacio = e => !e || (!String(e.prompt || '').trim() && !Object.values(e.media || {}).some(l => (l || []).length));

/** Las fotos del borrador, la última arriba. Guardar dos veces lo mismo seguido no ocupa dos huecos. */
export function pila(max = 10) {
  const L = [];
  return {
    guardar(e) { const c = copia(e); if (L.length && igual(L[L.length - 1], c)) return false; L.push(c); if (L.length > max) L.shift(); return true; },
    deshacer() { return L.length ? L.pop() : null; },
    hay: () => L.length > 0,
    get n() { return L.length; },
  };
}

/**
 * La variación de una imagen como pedido autónomo.
 * @param it        la ficha de la galería ({ file, prompt, model, settings, kind })
 * @param models    los modelos de la página ({ id, name, kind, on, roles, settings })
 * @param respaldo  el modelo a usar si el suyo no sirve (el que la página elegiría para «Usar de referencia»)
 * @param settingsDe(m) los ajustes por defecto de un modelo (los de la página: lo último que el dueño eligió para él)
 */
export function pedidoVariar(it, models, { respaldo = null, settingsDe = () => ({}) } = {}) {
  if (!it || !it.file) return { error: 'No encuentro esa imagen.' };
  if (it.kind === 'video' || it.kind === 'audio' || /\.(mp4|webm|mp3|wav)$/i.test(it.file)) return { error: 'Variar es para imágenes.' };
  const suyo = models.find(m => m.id === it.model && m.kind === 'image');
  const sirve = m => m && m.on && m.kind === 'image' && (m.roles?.reference || 0) > 0;
  const m = sirve(suyo) ? suyo : sirve(respaldo) ? respaldo : null;
  if (!m) return { error: 'Ningún modelo encendido acepta una imagen de referencia para variarla.' };
  const base = { ...settingsDe(m) }, previos = m.id === it.model ? it.settings || {} : {};
  const settings = { ...base };
  for (const [k, v] of Object.entries(previos)) { const f = m.settings?.[k]; if (!f || k === 'seed') continue; /* IMG-45: Variar is another one, so never the same seed */ if (f.type === 'enum' && !f.values.includes(String(v))) continue; settings[k] = v; }
  // con otro modelo, el formato de la imagen se conserva si ese modelo lo hace
  const ar = it.settings?.aspectRatio; if (m.id !== it.model && ar && m.settings?.aspectRatio?.values?.includes(String(ar))) settings.aspectRatio = ar;
  return {
    modelo: m, cambio: !!suyo && m.id !== suyo.id || !suyo,
    req: { prompt: String(it.prompt || '').trim() || 'una variación de esta imagen', n: 1, kind: 'image', model: m.id, settings, media: { reference: [it.file] }, by: 'you', ...(it.folder ? { folder: it.folder } : {}) },
  };
}
