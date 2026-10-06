// COMPARAR (auditoría del Estudio de imagen, IMG-14, Fase 6, 6 oct 2026). Antes, el antes y después solo existía en Lotes:
// una versión hecha con «Editar» se abría aparte y no había cómo poner dos resultados lado a lado. Ahora:
//   · con 2 a 4 imágenes seleccionadas, «Comparar» en la barra de selección;
//   · en el visor, «Comparar con la original» (una versión) o «Comparar con su última versión» (una original).
// Con dos imágenes se ven con una cortina que se arrastra (o con ← →); con tres o cuatro, en cuadrícula. Puro, con test.
//   queComparar(items)          → { items } | { error }
//   conSuPareja(it, itemOf)     → { items: [antes, después], titulo } | null
//   cortina(pos, tecla)         → la nueva posición (0–100) de la cortina para esa tecla, o null si no la mueve

export const MIN = 2, MAX = 4;
const esImagen = it => it && it.kind !== 'video' && it.kind !== 'audio' && !/\.(mp4|webm|mp3|wav|m4a|ogg|flac)$/i.test(String(it.file || ''));

export function queComparar(items = []) {
  const lista = items.filter(Boolean), imgs = lista.filter(esImagen);
  if (imgs.length < lista.length) return { error: 'Comparar es para imágenes: quita los videos y los audios de la selección.' };
  if (imgs.length < MIN) return { error: 'Elige al menos 2 imágenes para comparar.' };
  if (imgs.length > MAX) return { error: `Se comparan hasta ${MAX} a la vez: tienes ${imgs.length} seleccionadas.` };
  return { items: imgs };
}

export function conSuPareja(it, itemOf = () => null) {
  if (!esImagen(it)) return null;
  const orig = it.versionOf ? itemOf(it.versionOf) : null;
  if (esImagen(orig)) return { items: [orig, it], titulo: 'La original y esta versión' };
  const ultima = (it.versions || []).map(itemOf).filter(esImagen).pop();
  if (ultima) return { items: [it, ultima], titulo: 'Esta y su última versión' };
  return null;
}

export function cortina(pos, tecla) {
  const p = Number.isFinite(+pos) ? +pos : 50, c = v => Math.max(0, Math.min(100, v));
  return { ArrowLeft: c(p - 5), ArrowRight: c(p + 5), PageDown: c(p - 25), PageUp: c(p + 25), Home: 0, End: 100 }[tecla] ?? null;
}
